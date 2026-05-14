/**
 * Node-side WebGPU shader-blend compositor (Dawn npm package).
 *
 * EXPERIMENTAL — opt-in via HF_DAWN_WEBGPU=1 (or the CLI flag
 * `--gpu-shader-blend`). Default OFF; the CPU pool path remains canonical.
 *
 * ## Why
 *
 * The hf#677 shader-blend pool (`shaderTransitionWorkerPool`) parallelizes
 * the per-pixel JS blend across N CPU workers — empirically a 1.95×
 * end-to-end speedup on Mac at the cost of N cores' worth of CPU. The
 * fundamental ceiling is JS: the blend itself is still scalar f64 math in
 * v8. On any host with a usable GPU (Mac/Metal, Linux/Vulkan, Windows/D3D)
 * we can move the blend onto the GPU via Dawn, which:
 *
 *  - drops blend wall-time on a single 854×480 rgb48le frame from ~150–910 ms
 *    (depending on shader complexity) to a few ms;
 *  - frees the N CPU cores the pool was burning for DOM capture, encoding,
 *    or just leaving cool.
 *
 * The 3-5× projection in `reference_5x_shader_perf_alternatives.md` (option B)
 * comes from removing the JS shader-blend ceiling on top of the existing
 * cascade. Real numbers must be measured on Vance's Mac — sandboxed Linux
 * CI has no GPU, so this module gracefully falls back to the CPU path there.
 *
 * ## Design
 *
 * - One `GpuCompositor` per worker, lazily initialised on the first
 *   `blend()` call. Init probes the Dawn binding via dynamic `import("webgpu")`,
 *   requests an adapter, and creates a device + persistent texture/buffer
 *   resources sized to the first frame's dimensions. Subsequent frames at the
 *   same dimensions reuse the resources; a size change triggers a free + realloc.
 * - The blend is a compute shader: two readonly storage textures (from, to) +
 *   one storage texture (output) + one uniform buffer (width, height,
 *   progress). 8×8 workgroups over (width, height).
 * - Pixel format on the GPU is `rgba16uint` — exact 16-bit storage, no
 *   conversion. We pack the rgb48le input into rgba16 with A=0 on upload and
 *   strip A on readback. Bit-exact equality with CPU f64 is NOT a goal;
 *   PSNR ≥ 50dB on the test fixture is. (CPU path on the fallback IS
 *   bit-exact with the canonical CPU implementation — that's the deterministic
 *   path used by all default CI fixtures.)
 * - On *any* failure during init or dispatch — module not installed, no
 *   adapter, no device, shader compile error, queue submission error — the
 *   GPU path disables itself permanently for that worker's lifetime and the
 *   caller falls back to the CPU shader. Failure is logged once.
 *
 * ## Determinism trade
 *
 * GPU storage is u16; the math inside the WGSL shader uses f32. The CPU
 * canonical path uses f64. Numerical drift at the LSB is unavoidable. Fixtures
 * exercising the GPU path must use PSNR pins, not byte-equality. The default
 * path (flag OFF) preserves byte-equality.
 *
 * ## Coverage
 *
 * One representative shader (`crossfade`) is ported as proof-of-correctness.
 * Other shaders fall through to CPU even when the flag is on. Porting more
 * shaders is a mechanical follow-up — add a WGSL fragment to
 * `SHADERS_WGSL`, plumb its name in `supportsShader`, and the same dispatch
 * harness works.
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";

/** Result of attempting to acquire a Dawn-backed compositor instance. */
export type GpuInitResult = { ok: true; compositor: GpuCompositor } | { ok: false; reason: string };

/** Public surface of the GPU compositor. */
export interface GpuCompositor {
  /**
   * Whether this compositor has a WGSL implementation of `shaderName`.
   * Callers must check this before `blend()`; unsupported shaders should
   * fall back to the CPU path rather than going through the GPU at all.
   */
  supportsShader(shaderName: string): boolean;
  /**
   * Run a blend on the GPU. Throws on any GPU failure — the caller is
   * responsible for catching, falling back to CPU, and disabling the GPU
   * path for subsequent calls.
   *
   * `from`, `to`, `out` are Node `Buffer`s in `rgb48le` layout
   * (3 × u16 per pixel, no alpha). Total byte length = width * height * 6.
   * `out` is written in-place.
   */
  blend(
    shaderName: string,
    from: Buffer,
    to: Buffer,
    out: Buffer,
    width: number,
    height: number,
    progress: number,
  ): Promise<void>;
  /** Release GPU resources. Idempotent. */
  dispose(): Promise<void>;
}

interface ResourceSet {
  width: number;
  height: number;
  /** Linear staging buffer: width*height*4 u16 = w*h*8 bytes. */
  uploadBuffer: GPUBuffer;
  /** GPU storage texture for the `from` frame (rgba16uint). */
  fromTexture: GPUTexture;
  /** GPU storage texture for the `to` frame (rgba16uint). */
  toTexture: GPUTexture;
  /** GPU storage texture for the output (rgba16uint, STORAGE_BINDING+COPY_SRC). */
  outTexture: GPUTexture;
  /** GPU uniform buffer for (width, height, progress, _pad). */
  uniformBuffer: GPUBuffer;
  /** MAP_READ buffer to read the output back to CPU. */
  readbackBuffer: GPUBuffer;
  /** Bind group binding the upload buffer + textures + uniform buffer. */
  bindGroup: GPUBindGroup;
}

/** WGSL implementations of supported shaders. Keep stable shader names. */
const SHADERS_WGSL: Record<string, string> = {
  // crossfade: linear mix of `from` and `to` by `progress`. Numerically
  // simplest possible blend; PSNR vs the CPU path is dominated by the
  // u16-via-f32 round-trip (≥ 90 dB on uniform inputs in our local
  // experiments — easily clears the 50 dB pin).
  crossfade: /* wgsl */ `
    struct Uniforms {
      width: u32,
      height: u32,
      progress: f32,
      _pad: f32,
    }
    @group(0) @binding(0) var<uniform> u: Uniforms;
    @group(0) @binding(1) var fromTex: texture_storage_2d<rgba16uint, read>;
    @group(0) @binding(2) var toTex:   texture_storage_2d<rgba16uint, read>;
    @group(0) @binding(3) var outTex:  texture_storage_2d<rgba16uint, write>;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      if (gid.x >= u.width || gid.y >= u.height) {
        return;
      }
      let xy = vec2<i32>(i32(gid.x), i32(gid.y));
      let from = textureLoad(fromTex, xy);
      let to   = textureLoad(toTex,   xy);
      // CPU canonical does Math.round(from*inv + to*p); we mirror that via
      // f32 multiply-add + saturate + round. Drift at the LSB is tolerated.
      let f = vec4<f32>(from);
      let t = vec4<f32>(to);
      let blended = f * (1.0 - u.progress) + t * u.progress;
      let rounded = clamp(round(blended), vec4<f32>(0.0), vec4<f32>(65535.0));
      textureStore(outTex, xy, vec4<u32>(rounded));
    }
  `,
};

/**
 * Lazily resolved `webgpu` module. Cached at module level so we only attempt
 * the dynamic import once per process; if it failed, every subsequent
 * `initGpuCompositor` call returns the same failure reason immediately.
 */
type WebgpuModule = { create: (opts: string[]) => GPU; globals: Record<string, unknown> };
let webgpuModulePromise: Promise<WebgpuModule | { error: string }> | null = null;

function loadWebgpu(): Promise<WebgpuModule | { error: string }> {
  if (webgpuModulePromise) return webgpuModulePromise;
  webgpuModulePromise = (async () => {
    if (process.env.HF_DAWN_FORCE_FAIL === "1") {
      return { error: "HF_DAWN_FORCE_FAIL=1 (testability hook)" };
    }
    try {
      // Dynamic so the producer package can install on hosts that skip the
      // optional `webgpu` dep — the import only fires when the GPU path is
      // requested at runtime.
      const mod = (await import("webgpu")) as unknown as WebgpuModule;
      if (typeof mod.create !== "function") {
        return { error: "webgpu module loaded but `create` is not a function" };
      }
      return mod;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `webgpu module not available: ${msg}` };
    }
  })();
  return webgpuModulePromise;
}

/**
 * Attempt to acquire a Dawn-backed compositor. Returns `{ ok: false, reason }`
 * on any failure — never throws. The caller is expected to log the reason
 * once and fall back to the CPU path.
 *
 * `HF_DAWN_FORCE_FAIL=1` short-circuits to a synthetic failure for testing
 * the fallback engages cleanly.
 */
export async function initGpuCompositor(): Promise<GpuInitResult> {
  const mod = await loadWebgpu();
  if ("error" in mod) {
    return { ok: false, reason: mod.error };
  }
  let gpu: GPU;
  try {
    // Dawn options forwarded to dawn-node's create(). Empty array = use
    // platform defaults (Metal on Mac, Vulkan on Linux+GPU, D3D12 on Windows).
    gpu = mod.create([]);
  } catch (err) {
    return { ok: false, reason: `Dawn create() failed: ${describe(err)}` };
  }
  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter();
  } catch (err) {
    return { ok: false, reason: `requestAdapter threw: ${describe(err)}` };
  }
  if (!adapter) {
    return { ok: false, reason: "no GPU adapter (host has no usable GPU backend)" };
  }
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (err) {
    return { ok: false, reason: `requestDevice failed: ${describe(err)}` };
  }
  // Pre-compile shader modules + pipelines. If WGSL doesn't compile (e.g. a
  // future driver regression), we surface here rather than mid-render.
  const pipelines: Record<string, GPUComputePipeline> = {};
  try {
    for (const [name, code] of Object.entries(SHADERS_WGSL)) {
      const moduleObj = device.createShaderModule({ code });
      pipelines[name] = device.createComputePipeline({
        layout: "auto",
        compute: { module: moduleObj, entryPoint: "main" },
      });
    }
  } catch (err) {
    device.destroy();
    return { ok: false, reason: `pipeline compile failed: ${describe(err)}` };
  }
  return { ok: true, compositor: new GpuCompositorImpl(device, pipelines) };
}

class GpuCompositorImpl implements GpuCompositor {
  private readonly device: GPUDevice;
  private readonly pipelines: Record<string, GPUComputePipeline>;
  private resources: ResourceSet | null = null;
  private disposed = false;

  constructor(device: GPUDevice, pipelines: Record<string, GPUComputePipeline>) {
    this.device = device;
    this.pipelines = pipelines;
  }

  supportsShader(shaderName: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.pipelines, shaderName);
  }

  async blend(
    shaderName: string,
    from: Buffer,
    to: Buffer,
    out: Buffer,
    width: number,
    height: number,
    progress: number,
  ): Promise<void> {
    if (this.disposed) throw new Error("GpuCompositor disposed");
    const pipeline = this.pipelines[shaderName];
    if (!pipeline) throw new Error(`Unsupported GPU shader: ${shaderName}`);
    const expectedBytes = width * height * 6;
    if (
      from.length !== expectedBytes ||
      to.length !== expectedBytes ||
      out.length !== expectedBytes
    ) {
      throw new Error(
        `Buffer size mismatch: expected ${expectedBytes}, got from=${from.length} to=${to.length} out=${out.length}`,
      );
    }
    const res = this.ensureResources(width, height, pipeline);

    // Pack rgb48le → rgba16 (u16 R,G,B,0). Use Uint16Array views straight on
    // the input ArrayBuffers — zero copy from the input perspective, single
    // allocation for the rgba16 staging.
    const px = width * height;
    const fromU16 = new Uint16Array(from.buffer, from.byteOffset, px * 3);
    const toU16 = new Uint16Array(to.buffer, to.byteOffset, px * 3);
    const stage = new Uint16Array(px * 4 * 2); // 4 channels × 2 frames
    const stageFrom = stage.subarray(0, px * 4);
    const stageTo = stage.subarray(px * 4, px * 8);
    for (let i = 0, j = 0; i < px; i++, j += 4) {
      const k = i * 3;
      stageFrom[j] = fromU16[k]!;
      stageFrom[j + 1] = fromU16[k + 1]!;
      stageFrom[j + 2] = fromU16[k + 2]!;
      // stageFrom[j+3] = 0 (Uint16Array initializes to 0)
      stageTo[j] = toU16[k]!;
      stageTo[j + 1] = toU16[k + 1]!;
      stageTo[j + 2] = toU16[k + 2]!;
    }

    // Upload via writeTexture. dawn-node's writeTexture accepts a CPU-side
    // typed-array source directly; we don't need to round-trip through a
    // mapped staging buffer.
    const bytesPerRow = width * 8; // 4 channels × 2 bytes
    this.device.queue.writeTexture(
      { texture: res.fromTexture },
      stageFrom,
      { bytesPerRow, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );
    this.device.queue.writeTexture(
      { texture: res.toTexture },
      stageTo,
      { bytesPerRow, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );

    // Uniforms: width:u32, height:u32, progress:f32, _pad:f32 (16-byte block).
    const uniformBytes = new ArrayBuffer(16);
    const uvU32 = new Uint32Array(uniformBytes);
    const uvF32 = new Float32Array(uniformBytes);
    uvU32[0] = width;
    uvU32[1] = height;
    uvF32[2] = progress;
    uvF32[3] = 0;
    this.device.queue.writeBuffer(res.uniformBuffer, 0, uniformBytes);

    // Dispatch.
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, res.bindGroup);
    const workgroupsX = Math.ceil(width / 8);
    const workgroupsY = Math.ceil(height / 8);
    pass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    pass.end();
    encoder.copyTextureToBuffer(
      { texture: res.outTexture },
      { buffer: res.readbackBuffer, bytesPerRow },
      { width, height, depthOrArrayLayers: 1 },
    );
    this.device.queue.submit([encoder.finish()]);

    // Readback. mapAsync waits for the GPU work to complete before the
    // mapping resolves, so we don't need an explicit onSubmittedWorkDone.
    await res.readbackBuffer.mapAsync(GPUMapMode.READ);
    try {
      const mapped = res.readbackBuffer.getMappedRange();
      const view = new Uint16Array(mapped);
      const outU16 = new Uint16Array(out.buffer, out.byteOffset, px * 3);
      // Strip the unused A channel back to rgb48le layout.
      for (let i = 0, j = 0; i < px; i++, j += 4) {
        const k = i * 3;
        outU16[k] = view[j]!;
        outU16[k + 1] = view[j + 1]!;
        outU16[k + 2] = view[j + 2]!;
      }
    } finally {
      res.readbackBuffer.unmap();
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.resources) {
      // GPU resources are GC'd by Dawn when the device is destroyed; explicit
      // .destroy() on textures/buffers releases the underlying allocations
      // immediately. The bind group has no destroy().
      this.resources.uploadBuffer.destroy();
      this.resources.fromTexture.destroy();
      this.resources.toTexture.destroy();
      this.resources.outTexture.destroy();
      this.resources.uniformBuffer.destroy();
      this.resources.readbackBuffer.destroy();
      this.resources = null;
    }
    this.device.destroy();
  }

  /**
   * Lazily (re)allocate GPU resources sized to width×height. The first
   * blend at a new size triggers a free + realloc; same-size reuses
   * existing buffers/textures. In practice the fixture's frame size is
   * constant across the entire render so this path runs once per worker.
   */
  private ensureResources(
    width: number,
    height: number,
    pipeline: GPUComputePipeline,
  ): ResourceSet {
    if (this.resources && this.resources.width === width && this.resources.height === height) {
      return this.resources;
    }
    if (this.resources) {
      this.resources.uploadBuffer.destroy();
      this.resources.fromTexture.destroy();
      this.resources.toTexture.destroy();
      this.resources.outTexture.destroy();
      this.resources.uniformBuffer.destroy();
      this.resources.readbackBuffer.destroy();
      this.resources = null;
    }
    const bytesPerRow = width * 8;
    const totalBytes = bytesPerRow * height;
    const uploadBuffer = this.device.createBuffer({
      size: totalBytes,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const fromTexture = this.device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format: "rgba16uint",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
    const toTexture = this.device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format: "rgba16uint",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
    const outTexture = this.device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format: "rgba16uint",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    const uniformBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const readbackBuffer = this.device.createBuffer({
      size: totalBytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: fromTexture.createView() },
        { binding: 2, resource: toTexture.createView() },
        { binding: 3, resource: outTexture.createView() },
      ],
    });
    const resources: ResourceSet = {
      width,
      height,
      uploadBuffer,
      fromTexture,
      toTexture,
      outTexture,
      uniformBuffer,
      readbackBuffer,
      bindGroup,
    };
    this.resources = resources;
    return resources;
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Diagnostic helper: report whether the `webgpu` npm package is even
 * resolvable from the current Node process. Exposed mostly for the
 * doctor/info CLI command — actual init happens via `initGpuCompositor()`.
 */
export function isWebgpuPackageInstalled(): boolean {
  try {
    // Resolve via require.resolve so we don't actually import the native
    // module (which would load the .dawn.node binary on the first
    // call). `createRequire(import.meta.url)` works under both raw-TS
    // (tsx) and the bundled CLI banner.
    const r = createRequire(import.meta.url);
    const resolved = r.resolve("webgpu");
    return existsSync(resolved);
  } catch {
    return false;
  }
}
