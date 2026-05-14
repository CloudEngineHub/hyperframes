/**
 * Tests for the Dawn/WebGPU shader-blend compositor.
 *
 * We can't depend on a working GPU adapter in CI — the Linux sandbox has
 * no Vulkan driver. So these tests focus on the surface that must work
 * regardless of host:
 *
 *  1. `HF_DAWN_FORCE_FAIL=1` short-circuits init to a clean failure (the
 *     env hook the CLI / worker rely on for fallback testability).
 *  2. `initGpuCompositor()` never throws. On a no-GPU host it returns
 *     `{ ok: false, reason }` and the caller can fall back without
 *     try/catch.
 *  3. When a GPU IS available (Vance's Mac, Linux+GPU), the compositor's
 *     crossfade output matches the CPU canonical path within PSNR ≥ 50dB.
 *     This branch is skipped when init fails — the test logs the reason
 *     instead so a regression on Mac surfaces cleanly without breaking CI
 *     elsewhere.
 *
 * Determinism note: we deliberately do NOT pin byte-equality with the CPU
 * shader. The whole point of the new path is f32 GPU math + u16 storage,
 * which differs from f64 CPU math at the LSB. PSNR is the right pin.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crossfade } from "@hyperframes/engine/shader-transitions";
import { initGpuCompositor } from "./shaderTransitionGpu.js";

const WIDTH = 32;
const HEIGHT = 16;
const PX = WIDTH * HEIGHT;
const BYTES = PX * 6;

function fillGradient(): Buffer {
  const buf = Buffer.alloc(BYTES);
  for (let i = 0; i < PX; i++) {
    const o = i * 6;
    buf.writeUInt16LE((i * 1024) & 0xffff, o);
    buf.writeUInt16LE(((i * 2048) & 0xffff) ^ 0xa5a5, o + 2);
    buf.writeUInt16LE(((i * 4096) & 0xffff) ^ 0x5a5a, o + 4);
  }
  return buf;
}

function fillSolid(r: number, g: number, b: number): Buffer {
  const buf = Buffer.alloc(BYTES);
  for (let i = 0; i < PX; i++) {
    const o = i * 6;
    buf.writeUInt16LE(r, o);
    buf.writeUInt16LE(g, o + 2);
    buf.writeUInt16LE(b, o + 4);
  }
  return buf;
}

/**
 * Peak signal-to-noise ratio in dB between two rgb48le buffers (16-bit
 * channel depth → MAX = 65535). >= 50 dB is the acceptance bar for the
 * GPU path (still visually indistinguishable from f64 canonical; passes
 * the eye / objective metric for transition rendering).
 */
function psnrDb(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) throw new Error("buffer length mismatch");
  const samples = a.length / 2;
  let sse = 0;
  for (let i = 0; i < samples; i++) {
    const av = a.readUInt16LE(i * 2);
    const bv = b.readUInt16LE(i * 2);
    const d = av - bv;
    sse += d * d;
  }
  if (sse === 0) return Infinity;
  const mse = sse / samples;
  const MAX = 65535;
  return 10 * Math.log10((MAX * MAX) / mse);
}

describe("shaderTransitionGpu", () => {
  const originalForceFail = process.env.HF_DAWN_FORCE_FAIL;

  beforeEach(() => {
    // Each test below sets its own value; reset between tests so they don't
    // bleed state. The module caches the loadWebgpu() promise, but each
    // suite-level test runs in a fresh vitest worker file so the cache is
    // only shared within a single `describe` — fine for these tests.
    delete process.env.HF_DAWN_FORCE_FAIL;
  });

  afterEach(() => {
    if (originalForceFail === undefined) {
      delete process.env.HF_DAWN_FORCE_FAIL;
    } else {
      process.env.HF_DAWN_FORCE_FAIL = originalForceFail;
    }
  });

  it("HF_DAWN_FORCE_FAIL short-circuits to a clean failure", async () => {
    process.env.HF_DAWN_FORCE_FAIL = "1";
    const result = await initGpuCompositor();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/HF_DAWN_FORCE_FAIL/);
    }
  });

  it("returns ok:false (never throws) on hosts without a GPU adapter", async () => {
    // No assertion on which branch we hit — we just assert the call never
    // throws and returns a structured result. On Vance's Mac this will
    // typically be `ok: true`; on the Linux sandbox it'll be
    // `{ ok: false, reason: "no GPU adapter..." }` or the
    // module-not-installed branch. Both are correct.
    const result = await initGpuCompositor();
    expect(typeof result).toBe("object");
    if (result.ok) {
      expect(typeof result.compositor.supportsShader).toBe("function");
      expect(result.compositor.supportsShader("crossfade")).toBe(true);
      expect(result.compositor.supportsShader("not-a-real-shader")).toBe(false);
      await result.compositor.dispose();
    } else {
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("crossfade output matches CPU canonical within PSNR >= 50dB when a GPU is available", async () => {
    const result = await initGpuCompositor();
    if (!result.ok) {
      // Skipped — host has no GPU. Log so a regression on Mac (where the
      // adapter SHOULD be available) is visible in the test output.
      // eslint-disable-next-line no-console
      console.log(`[shaderTransitionGpu.test] GPU branch skipped: ${result.reason}`);
      return;
    }
    const compositor = result.compositor;
    try {
      const from = fillGradient();
      const to = fillSolid(40000, 5000, 25000);
      const outGpu = Buffer.alloc(BYTES);
      const outCpu = Buffer.alloc(BYTES);
      await compositor.blend("crossfade", from, to, outGpu, WIDTH, HEIGHT, 0.5);
      crossfade(from, to, outCpu, WIDTH, HEIGHT, 0.5);
      const psnr = psnrDb(outGpu, outCpu);
      // eslint-disable-next-line no-console
      console.log(`[shaderTransitionGpu.test] crossfade PSNR vs CPU: ${psnr.toFixed(2)} dB`);
      expect(psnr).toBeGreaterThanOrEqual(50);
    } finally {
      await compositor.dispose();
    }
  });
});
