# drawElement Fast Capture — Limitations & Findings Log

Canonical findings log for the `drawElementImage` fast-capture path. Referenced
from `frameCapture.ts`, `drawElementService.ts`, and `compileStage.ts`. Append
new findings here rather than burying them in commit messages.

See also: `fast-capture-architecture.md` (how the speedup + worker-encode work, the
per-frame cost model, and why worker-encode is macOS-GPU-only) and the
implementation spec `docs/superpowers/specs/2026-06-08-drawelement-alpha.md`.

---

## What it is

`canvas.drawElementImage(element, x, y)` (experimental Chrome
`--enable-features=CanvasDrawElement`) reads a DOM subtree's paint records
straight into a `<canvas layoutsubtree>`, bypassing the compositor. Used as a
capture mode in `packages/engine` as a faster alternative to
`Page.captureScreenshot`.

**Speedup is GPU- and density-bound, not universal:**
- Only faster on a **hardware GPU (macOS)**. On SwiftShader (Docker/Linux
  software rasterizer) there is no GPU→CPU readback to skip, so drawElement is
  parity-or-slower — it is **not used there** (routes to BeginFrame/screenshot).
- Speedup tracks **animation density**, not duration. p50 ≈ 1.0–1.4×; short
  dense comps reach ~2–3×; long comps with static holds approach 1.0× (nothing
  per-frame to save). A 691s dense comp still hit 1.42×.

**Per-frame cost model (macOS GPU, 1080p, ~16.3 ms/frame):** paint-event wait
~6.2 ms (37%, vsync floor), JPEG encode ~7.4 ms (57%), readback ~2.15 ms, seek
0.67 ms, drawElementImage itself ~0.4 ms. In-page `performance.now()`/`Date.now()`
are clamped in headless Chrome — only node-side timing is reliable.

---

## Capture-mode gates (whole-comp routing at session init / compile)

If any gate fires, the **entire** render routes to the platform baseline
(screenshot on macOS, BeginFrame on Linux). Gating is whole-composition, decided
once — there is **no per-frame gating** today.

| # | Gate | Signal | Bypass env | crbug |
|---|------|--------|-----------|-------|
| 1 | SwiftShader | software-GL detected | — | none (by design) |
| 2 | Video / caption-pattern | `<video>` present (compile-time `videoCount>0`; runtime `querySelector("video")`) | `HF_FAST_CAPTURE_VIDEO=true` | 521861819 |
| 3 | CSS 3D context | `matrix3d`/`perspective`/`preserve-3d`; failed 3D projection init | `HF_FAST_CAPTURE_3D=true` | 522872457 |
| 4 | CSS effects | `backdrop-filter`, `filter:blur()`, WebGL context (`__hf_accel_canvases`) | `HF_FAST_CAPTURE_CSSFX=true` | — |
| 5 | Stacked-fade | `__hfFadeTargets`: ≥2 fade targets ≥50% viewport, overlapping | `HF_FAST_CAPTURE_CROSSFADE=true` | — |

`detectCssEffectRisk` / `detectStackedFadeRisk` / `initThreeDProjection` live in
`threeDProjection.ts`. The autoAlpha rewrite (`HF_FAST_CAPTURE_AUTOALPHA`,
default on) rewrites `opacity`→`autoAlpha` so the stacked-fade gate is armed.

### Gate refinement: `filter:drop-shadow` removed (2026-06-15, commit 0b610805d)
Audit showed drop-shadow-only comps render fine through drawElement (53–58 dB)
and no damaged comp was drop-shadow-only. The rule only over-gated healthy
comps, so it was dropped. **Known residual over-gate:** `backdrop-filter` that is
*inert* (over a solid background) still gates 2 healthy comps — a static
computed-style check can't tell it's a no-op. Accepted as a safety cost.

---

## Damage classes (why the gates exist)

### Lim 2 — caption-pattern / stacked opacity (video is the proxy)
Multi-group nested opacity tweens (the captions pattern) composite wrong under
drawElement. `<video>` is used as a coarse proxy gate (root-caused 2026-06; it
is *not* animated promoted layers — it's the caption-pattern opacity bug). Pure
video comps composite fine via `drawImage(video)+drawElement` (58.8 dB); the
20 dB gap once seen was untagged media.

### Lim 3 — CSS 3D rendering contexts
drawElement paints 3D contexts incorrectly (mirrored backface even at rest;
siblings of the 3D context can drop out). Static-content 3D *can* render at
57.5 dB under `HF_FAST_CAPTURE_3D=true` projection, but animated 3D subtrees
fall back. 3D contexts are otherwise unpaintable.

### Lim 4 — backdrop-filter / filter:blur / WebGL
`backdrop-filter` samples the compositor backdrop, which single-element capture
can't reproduce. `filter:blur()` has paint-record vs compositor inconsistency.
WebGL/WebGPU canvases freeze at frame 0 under seek capture (no rAF) — handled
by a `getContext` instrumentation + `drawImage` composite where the canvas is
static; animated GLSL still falls back.

### Lim 6 — clip-cut boundary blackout (NEW 2026-06-15, NOT yet gated)
At a hard clip cut (`data-start`/`data-duration`, no `data-transition`),
drawElement renders the boundary frame **black**: it drops the outgoing clip one
frame before the screenshot does, and the incoming clip's paint record isn't
ready yet. Mid-clip frames are **pixel-identical (∞)**; only the ~1-frame cut
boundary fails (catastrophic, ~3 dB).

- **Not predictable from computed styles** — a solid-color clip has no
  backdrop/blend/filter signal; boundary-black frames are statistically
  identical to perfect frames by CSS (proven in the predictor spike below).
- **IS predictable from the clip schedule** — boundary frames =
  `⋃ clips { round(start·fps), round((start+duration)·fps) }`, computable before
  render. This is the actionable signal for a hybrid.
- **Confirmed in production (2026-06-15).** A clean fast-render of `7dec755f`
  (worker-encode on, **no probe**) outputs a solid-black frame at f240 (t=8.0,
  the yellow-clip cut). So this is real shipped damage, not a probe artifact.
- It surfaced inside a backdrop-gated comp where the backdrop-filter is on a tiny
  element and the flash is an unrelated full-bleed yellow scene clip — i.e. the
  gate caught the comp for the wrong reason. A clip-cut comp with **no** gated
  effect would ship these black flashes on the fast path.
- **Two sub-classes, two fixes.** The boundary condition either (a) *throws*
  `No cached paint record` (handled — see below) or (b) *succeeds silently with
  a black frame* (NOT caught by try/catch; needs the clip-schedule predictor to
  screenshot the boundary frame proactively). Still open for (b).

Same family as the **`No cached paint record` crash** (`drawElementService.ts`,
seen on 11 comps in the 400-comp eval): an element with no cached paint record
at frame N (display toggled / detached mid-timeline). drawElement *throws*
`InvalidStateError: ... No cached paint record for element` and aborts the whole
render. **FIXED (2026-06-15):** `frameCapture.ts` now catches this per frame (via
`isNoCachedPaintRecordError`) in both the serial (`captureFrameCore`) and
worker-encode (`captureFrameToBufferPipelined`) paths and falls back to
`captureScreenshot` for that single frame instead of aborting. Validated on
`29c3224f`: was a hard abort, now `RENDER_OK` with 11 frames screenshot-fallen-back.
This fixes the *throw* sub-class; the *silent black* sub-class (Lim 6b) is still
open.

---

## Fixes shipped (regressions closed)

- **body/html background loss** (223c4752): ancestor-bg fill; 6 comps 23–31→53–71 dB.
- **WebGL/WebGPU canvas freeze** (ec037e2a): getContext instrumentation + drawImage composite.
- **forceScreenshot honored** (bf8922cb): drawElement ignored compat hints; alpha keeps fast path.
- **style-N BeginFrame stall** (b2612bfc, 5d53f13c): compile-time video gate + liveness probe + autoAlpha rewrite.
- **autoAlpha retraction** (606b033aa, 612ec5a0e): retract rewrite flag when a runtime gate routes to fallback.
- **3D static projection** (`HF_FAST_CAPTURE_3D=true`): static-content 3D at 57.5 dB.

---

## Worker-encode (PR #1444, base #1295)

Off-main-thread JPEG encode via in-page OffscreenCanvas Worker; depth-2 pipeline
overlaps encode(N-1) with produce(N). macOS-GPU-only (`HF_DE_WORKER_ENCODE`,
default off). **Output is bit-identical to serial drawElement** (worker-vs-serial
PSNR=∞ proven) — zero quality cost. ~2× vs screenshot baseline. Any sub-50 dB
rows are inherited drawElement-path damage, not introduced by worker-encode.

---

## Open direction — hybrid (per-frame instead of whole-comp gating)

> **Resolved below.** A per-frame computed-style *threshold* predictor does NOT
> work (see Hybrid eval + "dependable pre-render calculation"). The viable design
> is **GSAP timeline-interval introspection** + clip schedule + static-effect scan.
> The two sub-problems below are the original framing, kept for context.

Goal: render most frames with drawElement, screenshot only incompatible frames.
Two distinct sub-problems, different predictability:

1. **Structural families (3d / webgl / blur / backdrop):** damage is moderate and
   *may* track a per-frame style signal (the gate's own detector run per frame).
   Spike data: 3d/stacked show moderate damage (PSNR 30–40 dB) but **no
   catastrophic black-outs**.
2. **Clip-cut boundaries (Lim 6):** catastrophic, **not** style-predictable,
   **schedule-predictable**. Screenshot the ±1 frame around each clip cut.

### Spike results (10 comps, 766 sampled frames, `EVERY=15`, gates bypassed)

Per-frame **computed-style predictor** (backdrop/blur/filter/3d/blend/mask/
stacked-fade) vs ground-truth PSNR(drawElement, screenshot):

| family | frames | comps | dmg<40dB | recall (signal\|dmg) | cat<12dB | cat & signal | precision (dmg\|signal) |
|--------|-------|-------|---------|------|---------|-----------|------|
| 3d | 151 | 3 | 28 | 32% | 0 | 0 | 33% |
| stacked | 90 | 2 | 24 | 71% | 0 | 0 | 35% |
| backdrop | 120 | 2 | 43 | 21% | 3 | **0** | 26% |
| blur | 186 | 2 | 36 | 47% | 1 | **0** | 13% |
| webgl | 8 | 1 | 1 | (sample too small) | 0 | 0 | — |

**Boundary-targeted spike** (4 comps, 43 frames, probe fires on the clip-schedule
boundary set ±1 in addition to the every-N grid):

| | frames | ok | dmg<40dB | BLACK<12dB |
|--|-------|-----|---------|-----------|
| clip-boundary | 27 | 16 | 8 | **3** |
| mid-clip | 16 | 13 | 3 | **0** |

**All catastrophic black frames are clip-boundary frames (3/3, none mid-clip).**
The clip-schedule predictor (`⋃ clips {round(start·fps), round((start+dur)·fps)}`)
catches 100% of black-outs. Only ~11% of boundaries actually black out, so
screenshotting every boundary over-shoots ~9×, but boundaries are sparse vs total
frames → cheap. **This is the actionable Lim 6b hybrid: screenshot clip-boundary
frames, drawElement everything else.**

**Verdict: the static style predictor is not viable.** Recall < 50% on 3 of 5
families (it misses most damaged frames) and precision 13–35% (it over-flags).
Critically, **every catastrophic frame (`cat<12dB`) has zero style signal**
(`cat & signal = 0`) — the clip-cut blackouts (Lim 6) are completely invisible
to computed-style inspection. The only reliable pre-render signal found is the
**clip schedule** (Lim 6), which predicts boundary frames deterministically.
Sampling caveat: `EVERY=15` undersamples 1-frame boundary events, so true
catastrophic counts are undercounts — sample boundary frames directly.

### Predictor spike harness (this branch, scratch — not committed)
- `packages/engine/src/services/frameCapture.ts` — env-gated probe in
  `prepareFrameForCapture` (`HF_PREDICT_PROBE=1`, `HF_PREDICT_OUT`,
  `HF_PREDICT_EVERY`): per sampled frame, captures screenshot-ref + drawElement-test
  (PNG) and a computed-style predictor (backdrop/blur/filter/3d/blend/mask/
  stacked-fade/largest-element). **Revert before merge.**
- `packages/producer/de-predict-run.sh` — forces drawElement (all gates bypassed)
  across sample comps per family + joins.
- `packages/producer/de-predict-psnr.mjs` — ffmpeg per-frame PSNR + signal join → `/tmp/predict/joined.jsonl`.

**Key spike result:** a static computed-style predictor is **insufficient** for
the dominant failure (clip-cut blackout). `EVERY=N` sampling also undersamples
1-frame boundary events — measure boundary frames directly from the clip schedule.

---

## Hybrid eval — every fallback comp through the hybrid path (2026-06-15)

Re-ran all 42 fallback rows from the worker-encode page through drawElement with
all gates bypassed + the per-frame fallback active (boundary + crash), full-frame
PSNR vs screenshot baseline. Harness: `packages/producer/de-hybrid.sh` (scratch).

| outcome | n | meaning |
|---------|---|---------|
| HYBRID-OK ≥45 dB | 3 | clip-cut comps the boundary fix genuinely rescues (`c44fbdaf` 89 dB) |
| marginal 40–45 | 4 | clip comps, close |
| **still-damaged <40** | 18 | continuous compositor damage — hybrid doesn't help |
| no-engage (forced ss) | 17 | raw-rAF / nondeterministic → drawElement never engages (correct) |

**Conclusions:**
1. **17/42 can't drawElement at all** and are *already* correctly force-screenshotted:
   they use `Date.now`/`performance.now`/`Math.random`/raw-rAF, so render-mode
   hints route them to screenshot (the deterministic-render rule). These are NOT
   hybrid candidates and must be excluded from any predictor's recall accounting —
   their "damage" is the comp's own nondeterminism (verified: `e25b918a` differs
   35 dB *screenshot-vs-screenshot*).
2. **The boundary/crash fix is real but narrow** — it cleanly rescues clip-cut
   comps (`c44fbdaf` 89 dB). It does **not** rescue style-gated comps: their
   damage is **continuous** (the effect is on-screen for most of the timeline), so
   screenshotting boundaries leaves the bulk damaged. The whole-comp gates are
   mostly justified.
3. **Mean PSNR is a misleading quality metric near black.** `af468890` scored
   25 dB but is ∞ on ~95% of frames; the mean is tanked by ~14-frame
   **dip-to-black crossfade** ramps where PSNR is mathematically brutal. BUT SSIM
   confirmed the crossfade frames are *genuinely* wrong (SSIM 0.48), not just a
   metric artifact — see below. Use SSIM (or luma-weighted) for transition frames.

### Lim 7 — drawElement drops opacity-animated semi-transparent overlays
`af468890` root cause: a full-screen white flash overlay
(`<div class="flash" style="background:#FFFFFF;opacity:0">`) with GSAP animating
`opacity: 0→1→0` over a transition. drawElement **drops the overlay** — renders the
dark scene underneath (navy) where the baseline shows white-over-dark (gray).
Plainly visible. The damaged interval is **exactly the tween span** (flash up
3.40–3.60 s = f102–108, down 3.65–4.05 s = f110–121), i.e. the same
group-opacity/stacked-fade compositing class as Lim 2 — drawElement composites a
semi-transparent layer differently from the compositor.

## The dependable pre-render calculation (design)

A per-frame computed-style *threshold* predictor failed (low recall, missed the
opacity peak, can't track a multi-frame ramp). The correct deterministic signal is
the **GSAP timeline interval**, not a per-frame guess or a fuzzy window:

> at-risk frames = ⋃ over every GSAP tween animating a **compositor-incompatible
> property** (opacity, filter, backdrop-filter, mix-blend-mode, 3D transform,
> mask/clip-path) on a visible element → its full `[startFrame, endFrame]`
> ∪ clip-cut boundary frames (schedule)
> ∪ statically-present compositor-effect frames (element visible throughout)

`window.__timelines` exposes every tween's target/properties/start/duration, so the
at-risk set is computed **once at init** by introspecting timeline + DOM — fully
deterministic, no per-frame screenshot, no windowing. Screenshot the at-risk
intervals, drawElement the rest; if at-risk dominates, fall through to the gate.

- **Deterministic by construction** given the (fixed, small) list of
  compositor-incompatible properties: the timeline gives exact intervals, the DOM
  gives exact static presence → 100% recall **for enumerated effects**.
- **Residual risk = property-list completeness.** An un-enumerated compositor
  effect still slips. The list is bounded (Chrome compositor features); each corpus
  miss adds one entry. This is the only part not provable by construction — a
  sparse measurement backstop (calibration PSNR/SSIM) would close it if a hard
  guarantee is required.

**Status:** designed, not built. Next step: prototype the `__timelines`
introspection → frame-interval calculator and validate it flags `af468890`'s
f102–121 exactly.

### Damage distribution of the 18 hybrid-damaged comps (2026-06-15, `de-dmgdist.sh`)
Per-frame PSNR (current hybrid vs screenshot baseline) → damaged-frame fraction.
**Mean PSNR badly mislead** — most "damaged" comps are near-perfect with sparse,
clustered damage:

| class | n | criterion | comps |
|-------|---|-----------|-------|
| **SPARSE** (fixable by interval predictor) | **13** | <25% frames damaged, clustered | 7882f09c·0670ee56 (0%), 4fa05434·b459dbe9·100c5fad·27388fb9·2666ea5d·6502a4ed (1%), 8f942142·7dec755f (2%), af468890 (4%), 4cf3ed60 (5%), 38e9ca4c (8%) |
| MIXED (partial win) | 1 | 25–50% | d0a3039a (35%) |
| **PERVASIVE** (gate-only, correct) | **4** | >50% | 9e3c36ba (55%), 4fcc7660 (77%), 5697cb63 (99%), 38097e59 (100%) |

Takeaway: the gates' *mean*-PSNR view overstated damage. Backdrop comps written
off as continuous (100c5fad/27388fb9/7dec755f, 26 dB mean) are only **1–2% damaged**
— a few near-black/transition frames tanked the mean. **The timeline-interval
predictor would convert 13 (+1 partial) of the 18 to healthy while keeping 92–100%
of frames on the fast path**; only 4 (effect on-screen most/all the time) stay
gated. This is the payoff sizing for building the predictor. (Damaged frames are
inferred to lie in tween/boundary intervals from their clustering; verified
directly only for af468890 — the predictor prototype confirms the rest.)

### Scratch
The engine-side investigation probes (`HF_PREDICT_PROBE`, `HF_INV_PROBE`,
`HF_SCRTIME`, `HF_FAST_CAPTURE_OPACITY_SS`, `runInventoryProbe`,
`frameHasOpacityRisk`, predictor fns) have been **stripped** from `frameCapture.ts`
— it now holds only the shipped 6a/6b fix. The findings they produced are recorded
in this doc. Producer-side scratch harnesses remain **untracked** (not committed),
reusable for the planned spikes: `de-hybrid.sh`, `de-predict-run.sh`,
`de-predict-psnr.mjs`.
