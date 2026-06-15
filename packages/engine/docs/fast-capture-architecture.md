# drawElement Fast Capture — Architecture & Performance

How the fast-capture path works, why the worker-encode optimization exists, and
why it only applies on the macOS-GPU path. Companion to
`fast-capture-limitations.md` (which covers *what drawElement can't render*); this
doc covers *how the speedup works and where*.

---

## Capture modes & the "who encodes" model

Rendering = capture each frame to an encoded image (JPEG/PNG), then feed those to
ffmpeg, which re-encodes to H.264. There are three capture mechanisms, and the key
difference between them is **who runs the per-frame image encode, and on which
thread**:

| mode | pixel path | image encode | where it runs |
|------|-----------|--------------|---------------|
| **screenshot** (`Page.captureScreenshot`) | full compositor → readback (slow) | **Chrome encodes internally** | C++, off the page's JS thread (free to us) |
| **BeginFrame** (`HeadlessExperimental.beginFrame`, Linux headless-shell) | atomic paint+capture+encode in one CDP call | **Chrome encodes internally** | C++, off-thread, indivisible |
| **drawElement** (macOS GPU) | reads paint records directly into a canvas (fast) | **we** call `canvas.toDataURL()` | **page JS main thread** |

The mental model:

- **screenshot** = slow pixel path + *free off-thread encode* (Chrome does it).
- **drawElement (naive)** = fast pixel path + *costly on-thread encode* (we do it in JS).
- **drawElement + worker** = fast pixel path + *off-thread encode* — best of both.

drawElement's whole win is the **fast pixel path**: it reads the painted subtree's
paint records straight into a `<canvas layoutsubtree>`, skipping the full
compositor pipeline and the expensive GPU→CPU screenshot readback. The price it
pays is that Chrome only hands back **raw pixels** — so *we* have to encode them,
and the naive way to do that (`toDataURL`) runs on the page's main thread.

---

## Per-frame cost model (macOS GPU, 1080p, ~16 ms/frame)

Measured 2026-06-14 via env-gated isolation probes. Reliable timer is node-side
`Date.now()` around `page.evaluate` — in-page `performance.now()`/`Date.now()` are
clamped to ~0 in headless Chrome, don't trust them.

| step | cost | notes |
|------|------|-------|
| seek (CDP round-trip) | 0.67 ms | jump the page to frame N's time; fusing round-trips not worth it |
| paint-event wait | ~6.2 ms (37%) | vsync-locked, ~0.37 frame avg; **no cheap fix**, BeginFrame unavailable on macOS GPU |
| drawElementImage + dispatch | 0.4 ms | the actual paint-record read; near-free |
| GPU→CPU readback (`getImageData`) | ~2.15 ms | unavoidable, ffmpeg needs pixels |
| **`toDataURL` JPEG encode** | **~7.36 ms (57%)** | biggest single cost; pure double-work (ffmpeg re-encodes to H.264) |

Two facts drive the design:
- The **encode is the dominant cost** (57%), bigger than everything else combined.
- It's **double work** — we JPEG-encode only to hand it to ffmpeg, which throws the
  JPEG away and re-encodes to H.264.

### Speedup is density-bound, not duration-bound
Measured distribution (macOS GPU, drawElement vs screenshot): p50 ~1.02×; short
dense (<10 s) p50 ~1.30×; long (>120 s) ~1.00×. Speedup tracks **animation density**
(fraction of frames with real per-frame change), not total length. Proof it's not
duration: `268b09db`, the longest comp tested (691 s) but dense throughout
(continuous motion, 62 audio tracks), hit **1.42×**, not 1.0×.

**Static-frame handling differs by capture path — be precise about which:**

- **BeginFrame (Linux):** Chrome's BeginFrame pipeline keeps a `lastFrameCache`;
  when a frame's `hasDamage` is `false` it **returns the previously captured
  buffer** — static frames are skipped (no recapture, no re-encode), so they're
  effectively free on the baseline. (See `discardWarmupCapture` for why chunk
  workers must prime this cache.)
- **macOS screenshot (the drawElement baseline):** `pageScreenshotCapture` calls
  `Page.captureScreenshot` **every frame** — no damage check, no cache, no
  copy-fill.
- **drawElement (macOS):** does **not** skip static frames either — it *forces* a
  paint each frame by toggling the `__hf_de_tick` sentinel, guaranteeing a fresh
  snapshot "even when this frame's seek produced no paint-level change", with a
  250 ms safety-net timeout.

So on macOS both paths capture every frame. The density-dependence there is
**not** explained by frame-skipping. The most likely driver is that Chrome's
per-frame `captureScreenshot` cost scales with how much the compositor must do, so
on a cheap static frame drawElement's *absolute* saving shrinks and the ratio
trends to 1.0× — but this has **not been isolated by measurement** (per-frame
screenshot cost vs content was not profiled). Treat the macOS mechanism as
unconfirmed; the density-bound *outcome* is measured, the *cause* on macOS is not.

### Why JPEG at all (don't ship raw)
The captured pixels live in the headless browser; we ship them to Node over CDP. A
raw 1080p frame is ~8 MB; a base64 JPEG is a fraction. Shipping raw was **measured
at ~109 ms/frame (11× worse)** — readback + base64 of 8 MB + transport. So the
compact JPEG-over-CDP *is* the right transport. The problem was never *that* we
encode — it's *where* the encode runs.

---

## Worker-encode (PR #1444)

### The problem: `toDataURL` blocks the main thread
`canvas.toDataURL()` runs **synchronously on the page's main thread**, so the loop
was serial — while the main thread spends 7.4 ms compressing frame N, it can't
start producing frame N+1:

```
frame N:    [seek][paint][read][====JPEG encode 7.4ms====]
frame N+1:                                                [seek][paint]...
```

### The fix: encode in an OffscreenCanvas Web Worker, pipelined
1. Main thread does seek + paint + drawElement read → gets an `ImageBitmap`.
2. It **transfers** the bitmap to a worker (transferable = zero-copy handoff, not a
   clone).
3. The **worker** runs the JPEG encode while the main thread **immediately starts
   the next frame**.

This is a **depth-2 pipeline** (`runWorkerEncodePipelineLoop` in
`captureStreamingStage.ts`): frame N's encode overlaps frame N+1's produce. Per-frame
wall-clock drops toward `max(produce, encode)` instead of `produce + encode`:

```
frame N:    [produce][--encode N (worker)--]
frame N+1:           [produce][--encode N+1--]
```

`produceDrawElementFrame` (`drawElementService.ts`) returns
`{ encodeResult: Promise<Buffer> }` immediately; the loop awaits the *previous*
frame's encode while producing the current one. The base64 result stays **inside
the worker** so it never burdens the page main thread.

### Results
- **~2× vs the screenshot baseline** (capture-phase A/B vs serial drawElement: 1.49–1.84×).
- **Bit-identical output** — worker frames vs serial-drawElement frames = PSNR ∞
  (same bytes). The compression math is unchanged; only *where* it runs moved. Zero
  quality cost — this was the gate to ship.

### Hardening (two review rounds)
Moving work into a worker added failure modes:
- Orphaned encode promises (unhandled rejection if a frame's encode is in flight at
  abort) → source-level `void encodeResult.catch(() => {})`.
- Lost worker message → per-frame **30 s watchdog**.
- Allocation churn → reuse **one** OffscreenCanvas across frames.
- `bmp.close()` on the no-worker fallback path; empty-encode reject;
  `exposeFunction` bound-pages guard; Blob-URL revoke.

### Config / gating
Off by default; `enableDrawElementWorkerEncode` / env `HF_DE_WORKER_ENCODE`. Engages
only when capture resolved to drawElement **and** `beginFrameTimeTicks === 0` (macOS
GPU) **and** output is opaque JPEG.

### Remaining ceiling
The base64 JPEG still travels over CDP as text. The next theoretical win is a
**binary side-channel** (e.g. websocket) to skip base64 — bigger lift, out of scope
here. The design deliberately keeps base64 in the worker so it never hits the page
main thread.

---

## Why worker-encode is macOS-GPU-only

It offloads exactly one cost — the in-page `toDataURL`. The other environments don't
have that cost to offload.

### Docker / SwiftShader (Linux containers): drawElement isn't used at all
drawElement's advantage is skipping the **GPU→CPU readback** a screenshot pays. On
SwiftShader (software rasterizer, no GPU) there is no GPU→CPU boundary — rendering is
already on the CPU — so drawElement is parity-or-slower and we don't engage it. No
drawElement → no worker-encode (it lives inside that path). And the bottleneck there
is the **software raster**, not the encode, so overlapping the encode would hide the
wrong cost.

### BeginFrame (Linux headless-shell): the encode is browser-side and atomic
BeginFrame returns the **already-encoded** image from a single `beginFrame` CDP call
— Chrome does paint + capture + compress together, internally. So:
- **Nothing to offload** — there's no in-page `toDataURL`; the encode the worker
  would take over doesn't exist in page JS.
- **Nothing to overlap** — one indivisible call; you can't split paint/capture/encode
  apart from JS to pipeline them.
- BeginFrame mode doesn't use the drawElement canvas, which worker-encode needs (it
  transfers the `ImageBitmap` from it). Gating is literally `beginFrameTimeTicks === 0`
  = "only when *not* BeginFrame."

### macOS GPU: the one place the cost exists
macOS GPU has **no BeginFrame**, so the Mac path captures via paint-event-synced
drawElement + an in-page `toDataURL`. That `toDataURL` is the offloadable cost, and
produce/encode are separable → pipelineable. That combination exists only on the
Mac-GPU-drawElement path — exactly where worker-encode applies.

**Summary:** worker-encode isn't broken elsewhere — the cost it removes only exists on
macOS GPU. Speedups for the other environments would be *different* optimizations
(attacking software-raster cost on SwiftShader, or a binary transport), not this one.

---

## Future work / planned spikes

### Spike: macOS static-frame dedup (the BeginFrame trick, ported to macOS)
**Measured fact:** `Page.captureScreenshot` on macOS is **flat ~24 ms/frame
regardless of content** (static frames ≈ dynamic frames; profiled on af468890 via
`HF_SCRTIME`). So we pay full price re-capturing identical frames on static holds.
BeginFrame/Linux already skips these (`hasDamage` → reuse `lastFrameCache`); macOS
does not.

**Idea:** detect static frames *before* capture and reuse the previous buffer.
Detection must be deterministic + conservative — the right signal is **GSAP
timeline introspection** (`window.__timelines`): a frame is static iff no tween is
active in `[t_prev, t_now]` AND no video/canvas/webgl present. This is the **same
machinery** as the dependable hybrid predictor (see `fast-capture-limitations.md`)
→ one prototype, two payoffs (skip static frames + screenshot at-risk frames).

**Why it's attractive:** complements drawElement — dedup wins on the static-heavy /
long comps where drawElement gives ~1.0×, and it helps the screenshot-fallback
majority (forced-screenshot + gated comps), not just drawElement-eligible ones.

**Why scope it carefully (prior probe, ~18 comps):** ~89% of comps are disqualified
— 78% have an accelerated canvas (may redraw any frame), 11% video; eligible comps
often have continuous tweens (zero static frames). Best case ~31% frames skippable
(long-holds presentation). Under-detection = stale/frozen frame (correctness bug).

**First step:** measure the *true* static-frame fraction across the corpus via
timeline introspection (NOT the crude JPEG-byte-size proxy, which overcounts), to
size the real population and payoff before building. Fold into the hybrid-predictor
prototype.

### Spike: dependable hybrid predictor (timeline-interval at-risk calculator)
See `fast-capture-limitations.md` → "The dependable pre-render calculation."
`window.__timelines` → frame intervals where a compositor-incompatible property is
animating, ∪ clip-schedule boundaries, ∪ static-effect-visible frames → screenshot
those, drawElement the rest. Validate it flags af468890's f102–121 exactly. Shares
the timeline-introspection core with the dedup spike above.
