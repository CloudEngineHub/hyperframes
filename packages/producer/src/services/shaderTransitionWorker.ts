/**
 * Worker entry point for off-main-thread shader-blend execution.
 *
 * The hf#677 follow-up moved the layered transition pipeline (dual-scene
 * seek/mask/screenshot) onto per-worker DOM sessions, but the per-pixel JS
 * shader-blend at the tail of `processLayeredTransitionFrame` still ran on
 * the orchestrator's main event loop. Complex shaders (`domain-warp`,
 * `swirl-vortex`, `glitch`) iterate every pixel of the rgb48le buffer with
 * multiple noise/sample calls per pixel — hundreds of milliseconds per call
 * — so N concurrent DOM workers all firing shader-blends saturated the
 * single Node thread. The empirical worker-count sweep on the #677 fixture
 * (w=1=218s, w=2=183s, w=6=184s, w=12=188s) flattens after w=2, which is the
 * single-threaded-downstream signature.
 *
 * This worker runs `TRANSITIONS[shader](from, to, output, w, h, p)` on a
 * dedicated Node `worker_threads` Worker. The pool dispatches one frame at
 * a time per worker. The rgb48le scratch Buffers are moved in and out via
 * `transferList` — zero-copy at the ArrayBuffer level — so the only
 * per-frame cost is the postMessage round-trip (~sub-millisecond on the
 * 2.4 MB 854×480 buffers) plus the shader-blend itself.
 *
 * Lifecycle:
 *
 * 1. Pool constructor spawns N of these workers up front.
 * 2. Main thread posts `{ shader, bufferA, bufferB, output, width, height,
 *    progress }` with `transferList: [bufferA, bufferB, output]`. The three
 *    ArrayBuffers are detached on the sender; the caller must NOT touch
 *    them until the worker replies.
 * 3. Worker wraps each ArrayBuffer as a Node Buffer view (zero-copy),
 *    invokes `TRANSITIONS[shader] ?? crossfade`, and posts `{ ok: true,
 *    output }` back with `transferList: [output]`. (The two input ArrayBuffers
 *    are also returned so the main thread can re-attach them to the worker's
 *    `LayeredTransitionBuffers` slot for reuse on the next frame.)
 * 4. On unknown shader / runtime exception, worker posts `{ ok: false, error,
 *    bufferA, bufferB, output }` — all three are still transferred back so
 *    the caller can release them.
 *
 * The worker holds no per-frame state. It is shared across DOM-session
 * workers and across the entire render — only spawned once at render start
 * and terminated at render end.
 */

import { parentPort } from "node:worker_threads";
// Import the shader-blend table from a dedicated `./shader-transitions`
// subpath export of `@hyperframes/engine` rather than the package root.
// Rationale:
//
// 1. `shaderTransitions.ts` is fully self-contained (no internal imports).
//    Going through engine's root index pulls in the rest of the engine
//    graph, which fails under `worker_threads` + tsx in dev/test: the
//    tsx loader's `.js → .ts` rewrite does NOT survive the Worker
//    boundary, so internal specifiers like `./config.js` from `index.ts`
//    fail to resolve. The subpath sidesteps that by pointing the
//    resolver straight at the import-free file.
//
// 2. In the production esbuild bundle (build.mjs entry
//    `src/services/shaderTransitionWorker.ts`) the workspace alias plugin
//    redirects `@hyperframes/engine/shader-transitions` to the same TS
//    source and bundles it inline, so behavior is identical.
import { TRANSITIONS, crossfade } from "@hyperframes/engine/shader-transitions";
// Native WebGPU compositor (Dawn). Opt-in via HF_DAWN_WEBGPU=1. The module
// gracefully reports back when Dawn isn't available; this worker falls back
// to the CPU shader path in that case (and for any shader without a WGSL
// implementation). See `shaderTransitionGpu.ts` for the design.
//
// Import strategy: a *dynamic* import is used rather than a top-level
// import because raw-TS worker_threads execution (vitest + tsx) cannot
// rewrite sibling `.js` relative specifiers through the Worker boundary —
// the tsx `.js → .ts` resolver hook applies on the parent's module graph
// but not on `new Worker(<ts-file>)`'s independent graph. A *dynamic*
// `import(...)` defers resolution to first use, and is also gated by the
// HF_DAWN_WEBGPU flag — when off (the default), the GPU module is never
// loaded at all, so the test/dev path never trips. Under tsup, both forms
// inline the module into the bundle identically.
import type { GpuCompositor } from "./shaderTransitionGpu.js";

interface ShaderJobRequest {
  shader: string;
  bufferA: ArrayBuffer;
  bufferB: ArrayBuffer;
  output: ArrayBuffer;
  width: number;
  height: number;
  progress: number;
}

interface ShaderJobOk {
  ok: true;
  bufferA: ArrayBuffer;
  bufferB: ArrayBuffer;
  output: ArrayBuffer;
}

interface ShaderJobErr {
  ok: false;
  error: string;
  bufferA: ArrayBuffer;
  bufferB: ArrayBuffer;
  output: ArrayBuffer;
}

export type ShaderJobResult = ShaderJobOk | ShaderJobErr;

/**
 * GPU init state for this worker. Resolves once on first message if the
 * HF_DAWN_WEBGPU flag is set. After resolution it's either a usable
 * compositor or a permanent disable (logged once). The flag is read on
 * first use so tests can flip it without spawning a new worker.
 */
type GpuState =
  | { kind: "uninit" }
  | { kind: "initing"; promise: Promise<GpuState> }
  | { kind: "off"; reason: string }
  | { kind: "on"; compositor: GpuCompositor };
let gpuState: GpuState = { kind: "uninit" };

async function ensureGpuState(): Promise<GpuState> {
  if (gpuState.kind === "on" || gpuState.kind === "off") return gpuState;
  if (gpuState.kind === "initing") return gpuState.promise;
  if (process.env.HF_DAWN_WEBGPU !== "1") {
    gpuState = { kind: "off", reason: "HF_DAWN_WEBGPU not set" };
    return gpuState;
  }
  const initPromise: Promise<GpuState> = (async () => {
    // Dynamic import (see top-of-file comment): defer GPU module load to
    // first use, and gate it on HF_DAWN_WEBGPU so the dev/test path
    // never trips the worker_threads `.js` resolver. The relative
    // specifier resolves through the tsup bundle inlining in
    // production and the tsx loader in dev (which DOES handle the
    // dynamic-import path via its `--import` esm-loader registration,
    // unlike top-level worker-internal sibling `.js` imports).
    try {
      const mod =
        (await import("./shaderTransitionGpu.js")) as typeof import("./shaderTransitionGpu.js");
      const result = await mod.initGpuCompositor();
      if (result.ok) {
        gpuState = { kind: "on", compositor: result.compositor };
        // eslint-disable-next-line no-console
        console.log("[shaderTransitionWorker] GPU compositor active (Dawn/WebGPU)");
      } else {
        gpuState = { kind: "off", reason: result.reason };
        // eslint-disable-next-line no-console
        console.warn(
          `[shaderTransitionWorker] GPU compositor unavailable, falling back to CPU: ${result.reason}`,
        );
      }
    } catch (err) {
      // Module load itself failed (e.g. raw-TS worker boundary rejected
      // the sibling .js specifier). Treat as a clean "no GPU" — the CPU
      // path runs as before.
      const reason = err instanceof Error ? err.message : String(err);
      gpuState = { kind: "off", reason: `GPU module load failed: ${reason}` };
      // eslint-disable-next-line no-console
      console.warn(
        `[shaderTransitionWorker] GPU module not loadable, falling back to CPU: ${reason}`,
      );
    }
    return gpuState;
  })();
  gpuState = { kind: "initing", promise: initPromise };
  return initPromise;
}

async function runBlend(msg: ShaderJobRequest): Promise<void> {
  const { shader, bufferA, bufferB, output, width, height, progress } = msg;
  const bufA = Buffer.from(bufferA);
  const bufB = Buffer.from(bufferB);
  const out = Buffer.from(output);

  let usedGpu = false;
  try {
    const state = await ensureGpuState();
    if (state.kind === "on" && state.compositor.supportsShader(shader)) {
      try {
        await state.compositor.blend(shader, bufA, bufB, out, width, height, progress);
        usedGpu = true;
      } catch (err) {
        // Mid-flight GPU failure — disable the GPU path for the rest of
        // this worker's life rather than thrashing init on every frame, and
        // fall through to CPU below so the current frame still completes.
        const reason = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.warn(
          `[shaderTransitionWorker] GPU blend failed mid-render, disabling GPU path: ${reason}`,
        );
        await state.compositor.dispose().catch(() => undefined);
        gpuState = { kind: "off", reason: `mid-render failure: ${reason}` };
      }
    }
    if (!usedGpu) {
      const fn = TRANSITIONS[shader] ?? crossfade;
      fn(bufA, bufB, out, width, height, progress);
    }
    const reply: ShaderJobOk = {
      ok: true,
      bufferA,
      bufferB,
      output,
    };
    parentPort!.postMessage(reply, [bufferA, bufferB, output]);
  } catch (err) {
    const reply: ShaderJobErr = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      bufferA,
      bufferB,
      output,
    };
    parentPort!.postMessage(reply, [bufferA, bufferB, output]);
  }
}

if (!parentPort) {
  // Defensive — this module is only meaningful inside a worker_thread.
  // If imported on the main thread (e.g. by an accidental top-level test),
  // do nothing rather than throwing, so static analysis stays clean.
  // eslint-disable-next-line no-console
  console.warn("[shaderTransitionWorker] no parentPort; module loaded on main thread");
} else {
  parentPort.on("message", (msg: ShaderJobRequest) => {
    // Fire-and-forget — runBlend handles its own reply + error path.
    void runBlend(msg);
  });
}
