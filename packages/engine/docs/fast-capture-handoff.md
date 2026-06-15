# drawElement Fast Capture — Session Handoff / Continuation Plan

**Audience:** the next engineer/agent continuing this work. Written to be
self-contained and prescriptive. Read the two companion docs first:
- `fast-capture-architecture.md` — how the speedup works, worker-encode, cost model, why macOS-only, density-bound.
- `fast-capture-limitations.md` — gates, damage classes (Lim 2/3/4/6/7), the predictor design, eval results, damage distribution.

This doc = **what's done, exact repo/branch state, how to run everything, and the
two concrete next tasks step-by-step.**

---

## 0. TL;DR — where things stand

- **Shipped & validated** (committed, NOT pushed): per-frame screenshot fallback
  in drawElement — (6a) catches `No cached paint record` crashes, (6b) screenshots
  clip-cut boundary frames it would otherwise render black. Both in both serial and
  worker-encode capture paths.
- **Investigated** the "hybrid" question exhaustively: can we drawElement comps that
  currently fall back, screenshotting only bad frames? Answer: **yes for 13–14 of 18
  damaged comps**, via a **deterministic timeline-interval predictor** (NOT per-frame
  style guessing, which failed).
- **NEXT WORK (not started):**
  1. **Build the timeline-interval predictor** — the actual fix for 13/18 damaged comps. (Task A below.)
  2. **macOS static-frame dedup spike** — separate speedup lever. (Task B below.)

---

## 1. Git state (exact)

- Worktree: `/Users/vanceingalls/src/wt/hyperframes/blend-diff`
- Branch: **`drawelement-perframe-fallback`**, HEAD = `09a123d63`
- Graphite stack (bottom→top), all on this branch's history:
  ```
  main
   → 5ea76a52d  perf: worker-offload JPEG encode (PR #1444 base work)
   → dd0bd4aaf  fix: harden worker-encode pipeline (review)
   → e27afcdb4  fix: close worker-encode orphan/hang/corruption (re-review)
   → 09a123d63  fix: per-frame screenshot fallback (THIS session's shipped work)
  ```
  Note: PR #1444 = worker-encode; PR #1295 = the base drawelement-fast-capture branch (gates + worker-encode stacked above it).
- **NOT pushed.** Per standing rule, do not push / `gt submit` until the user asks.
- **Uncommitted:** `packages/engine/docs/fast-capture-limitations.md` (latest damage-distribution section). Commit it (see §5 commit note).
- **Untracked scratch (do NOT commit — investigation tooling):**
  `packages/producer/{de-dmgdist.sh, de-hybrid.sh, de-predict-run.sh, de-predict-psnr.mjs, de-we-suite.sh, de-we-fast.sh, we-render.mjs}`
- The engine probe scratch (`HF_PREDICT_PROBE`, `HF_INV_PROBE`, `HF_SCRTIME`,
  `HF_FAST_CAPTURE_OPACITY_SS`) was **already stripped** from `frameCapture.ts` —
  it holds only the shipped 6a/6b fix. If you re-add probes for Task A, strip again before commit.

### What the shipped fix looks like (in `packages/engine/src/services/frameCapture.ts`)
- `isNoCachedPaintRecordError(err)` — exported helper.
- `computeClipBoundaryFrames(page, fps)` — reads `[data-start]` elements, returns a
  `Set` of `{round(start·fps), round((start+dur)·fps)}` ±1 frames.
- `CaptureSession.clipBoundaryFrames?: Set<number>` — populated in `initializeSession`
  when capture resolves to drawelement (env off-switch `HF_FAST_CAPTURE_BOUNDARY_SS=false`).
- In `captureFrameCore` (serial) and `captureFrameToBufferPipelined` (worker): if
  `clipBoundaryFrames.has(frameIndex)` → `pageScreenshotCapture` instead of drawElement;
  and a `try/catch` around the drawElement capture that screenshots on `isNoCachedPaintRecordError`.

**This boundary fix is the TEMPLATE for Task A** — Task A generalizes
`clipBoundaryFrames` from "clip cuts only" to "all at-risk intervals."

---

## 2. Environment & gotchas (CRITICAL — a weaker model will trip on these)

- **Build/commit hook fails** on stale local SDK deps (`@hyperframes/core build` /
  linkedom). It's environmental, CI-clean. **Commit with `git commit --no-verify`**
  (or `gt create --no-verify`). Typecheck/lint pass fine; the hook failure is NOT your code.
- **macOS has no `timeout` command.** Never use `timeout N cmd` — it silently no-ops.
  For long renders: run in background, poll with `while pgrep -f "<pattern>"; do sleep 5; done`, then read the log.
- **Background renders can leave zombies.** If a render hangs, `pkill -f "we-render.mjs /tmp/cc-all/<prefix>"`. Check for strays: `pgrep -fl we-render.mjs`.
- **In-page timers are clamped** in headless Chrome (`performance.now`/`Date.now` ≈ 0).
  Only node-side `Date.now()` around `page.evaluate` is reliable for timing.
- **Mean PSNR is misleading near black** and for sparse damage. A few near-black or
  transition frames tank the mean even when 95%+ of frames are perfect. Use per-frame
  PSNR distribution (damaged-frame fraction) + SSIM, not mean PSNR, to judge quality.
- **Some comps are nondeterministic** (`performance.now`/`Date.now`/`Math.random`/raw
  `requestAnimationFrame`). They're force-screenshotted by render-mode hints already —
  they can't drawElement and their "damage" is their own (two screenshot renders differ).
  Exclude them from any drawElement quality accounting.
- **drawElement is macOS-GPU-only.** On Linux/Docker (SwiftShader) it isn't used.
- **Package manager: bun** (not pnpm/npm). Lint/format: `bunx oxlint <file>` / `bunx oxfmt <file>`. Typecheck engine: `cd packages/engine && bunx tsc --noEmit -p tsconfig.json`.

### Gate-bypass env vars (force drawElement to engage despite gates — for evals)
```
HF_FAST_CAPTURE_CSSFX=true       # backdrop-filter / filter:blur / webgl gate
HF_FAST_CAPTURE_CROSSFADE=true   # stacked-fade gate
HF_FAST_CAPTURE_3D=true          # 3D gate (compile + runtime)
HF_FAST_CAPTURE_VIDEO=true       # video gate (compile + runtime)
HF_FAST_CAPTURE_BOUNDARY_SS=false # disable the shipped boundary screenshot fallback
```
Leave `HF_FAST_CAPTURE_AUTOALPHA` default (on).

---

## 3. The eval harnesses (untracked, in `packages/producer/`)

All run from `packages/producer/`. All use `we-render.mjs` (renders one comp; mode
from env). Corpus: `/tmp/cc-all/` (1013 community comps, dir = `<uuid>`); manifest
`/tmp/cc-manifest.json` (has `dir`, `gate` per comp).

| script | what it does | output |
|--------|-------------|--------|
| `we-render.mjs <compDir> <out.mp4>` | render one comp; mode via env (`PRODUCER_EXPERIMENTAL_FAST_CAPTURE`, `HF_DE_WORKER_ENCODE`, gate-bypass envs). Prints `RENDER_OK`, `TOTAL_MS`, engine logs. | mp4 |
| `de-hybrid.sh` | the 42 fallback comps through hybrid (gates bypassed + per-frame fallback) vs screenshot baseline; whole-video PSNR. | `/tmp/hybrid-eval.jsonl` |
| `de-dmgdist.sh` | the 18 hybrid-damaged comps: per-frame PSNR → damaged-frame fraction + clustering → SPARSE/MIXED/PERVASIVE. | `/tmp/dmgdist.jsonl` |
| `de-predict-run.sh` + `de-predict-psnr.mjs` | per-frame predictor-signal probe (needs the `HF_PREDICT_PROBE` engine probe re-added) + ffmpeg PSNR join. | `/tmp/predict/joined.jsonl` |

Per-comp render pattern (single comp, e.g. baseline vs hybrid):
```bash
cd /Users/vanceingalls/src/wt/hyperframes/blend-diff/packages/producer
dir=$(find /tmp/cc-all -maxdepth 1 -type d -name "af468890*" | head -1)
# screenshot baseline:
PRODUCER_EXPERIMENTAL_FAST_CAPTURE=false HF_DE_WORKER_ENCODE=false \
  PRODUCER_BROWSER_GPU_MODE=hardware PRODUCER_ENABLE_BROWSER_POOL=false \
  bun we-render.mjs "$dir" /tmp/base.mp4
# hybrid (drawElement + per-frame fallback, gates bypassed):
HF_FAST_CAPTURE_CSSFX=true HF_FAST_CAPTURE_CROSSFADE=true HF_FAST_CAPTURE_3D=true HF_FAST_CAPTURE_VIDEO=true \
  PRODUCER_EXPERIMENTAL_FAST_CAPTURE=true HF_DE_WORKER_ENCODE=true \
  PRODUCER_BROWSER_GPU_MODE=hardware PRODUCER_ENABLE_BROWSER_POOL=false \
  bun we-render.mjs "$dir" /tmp/hyb.mp4
# per-frame PSNR (ffmpeg writes per-frame stats; line N => psnr_avg:<v|inf>):
ffmpeg -i /tmp/hyb.mp4 -i /tmp/base.mp4 -lavfi "psnr=stats_file=/tmp/x.psnr" -f null -
# SSIM (better than PSNR near black): -lavfi ssim
# view a frame: ffmpeg -y -i /tmp/hyb.mp4 -vf "select=eq(n\,240)" -vframes 1 /tmp/f240.png   then Read the png
```

---

## 4. Key findings (so a continuation doesn't re-derive them)

1. **Per-frame style prediction FAILS** (recall 21–71%, precision 13–35%). Don't go down that path.
2. **The deterministic signal that WORKS** = GSAP timeline intervals + clip schedule.
3. **Lim 6 (clip-cut boundary blackout):** drawElement renders hard clip-cut frames
   black (outgoing clip dropped a frame before incoming paints). FIXED (6b). Verified: 7dec755f f240 black→correct.
4. **Lim 7 (semi-transparent overlay drop):** drawElement drops opacity-animated
   full-screen overlays (e.g. a white `.flash` div tweened opacity 0→1→0) → renders
   the layer underneath. Damaged interval = the tween's `[start,end]` frames. NOT fixed; Task A fixes it.
5. **`No cached paint record` crash:** FIXED (6a) — was 11-comp crash class. Verified: 29c3224f aborted→completes.
6. **Damage distribution of the 18 hybrid-damaged comps** (`/tmp/dmgdist.jsonl`):
   **13 SPARSE** (0–8% frames damaged, clustered) → fixable by Task A;
   **1 MIXED** (d0a3039a, 35%); **4 PERVASIVE** (9e3c36ba 55%, 4fcc7660 77%,
   5697cb63 99%, 38097e59 100%) → stay gated, correct.
7. **macOS `captureScreenshot` is flat ~24 ms/frame** regardless of static/dynamic
   content (no dedup) → Task B opportunity. (BeginFrame/Linux DOES dedup via `hasDamage`.)
8. **Speedup is density-bound, not duration-bound** (~1.0× on static-heavy comps; up to 3× dense).

---

## 5. TASK A — Build the timeline-interval at-risk predictor (the fix for 13/18)

**Goal:** at session init, compute the set of "at-risk" frames deterministically from
the GSAP timeline + clip schedule. During capture, screenshot at-risk frames,
drawElement the rest. This generalizes the shipped `clipBoundaryFrames` mechanism.

**Why this is the right design (already validated):** damaged frames are NOT
predictable from per-frame computed styles, but ARE bounded by the frame intervals of
GSAP tweens that animate compositor-incompatible properties (opacity, filter,
backdrop-filter, mix-blend-mode, 3D transform, mask/clip-path), plus clip-cut
boundaries. Proven on af468890: damaged frames f102–121 == the `.flash` opacity tween
span. 13 of 18 damaged comps are sparse → screenshotting these intervals makes them
healthy while keeping 92–100% of frames fast.

### Step A1 — Inspect the GSAP timeline shape
GSAP timelines are registered on `window.__timelines` (per CLAUDE.md: "GSAP timelines
must be paused and registered on window.__timelines"). In a page context, enumerate
tweens. Find the API: a GSAP timeline exposes `.getChildren(true,true,true)` →
array of tweens; each tween has `.startTime()` (seconds, in timeline coords),
`.duration()`, `.targets()` (DOM elements), and `.vars` (the animated props, e.g.
`{opacity:1, x:100}`). **Verify this in a real page first** — write a tiny
`page.evaluate` that dumps, for af468890, every tween's `{start, dur, props:Object.keys(vars), targetTag}`. Confirm you can see the `.flash` opacity tween at start≈3.4s dur≈0.2s.

  Gotcha: timelines may be nested (sub-timelines). Recurse via `getChildren`. Tween
  start times are relative to their parent timeline — convert to absolute by summing
  parent offsets, or use the root timeline's `.totalTime()` mapping. SAFEST: for each
  tween, compute its absolute `[start,end]` via GSAP's own global time
  (`tween.globalTime?` or walk parents). Validate against af468890's known f102–121.

### Step A2 — Define the compositor-incompatible property set
A tween is "at-risk" if it animates ANY of: `opacity`, `autoAlpha`, `filter`,
`backdropFilter`/`backdrop-filter`, `mixBlendMode`/`mix-blend-mode`, `webkitFilter`,
any 3D transform prop (`rotationX`,`rotationY`,`z`,`rotateX`,`rotateY`,`translateZ`),
`clipPath`/`clip-path`, `maskImage`/`mask`. Also: any element that is STATICALLY (no
tween) one of these the whole time → handled by the existing whole-comp gate, leave gated.
  - Conservative bias: when unsure if a prop is compositor-incompatible, INCLUDE it
    (over-screenshot = slower, under-screenshot = shipped damage). Recall > precision.

### Step A3 — Compute the at-risk frame set
For each at-risk tween: `for f in [floor(start·fps)-1 .. ceil((start+dur)·fps)+1]: atRisk.add(f)`
(±1 margin). Union with the existing `computeClipBoundaryFrames` set. Store on
`session.clipBoundaryFrames` (rename to `session.atRiskFrames` or add a second set).

  Implementation: add a `computeTimelineAtRiskFrames(page, fps)` next to
  `computeClipBoundaryFrames` in `frameCapture.ts`; call it in `initializeSession`
  right after the boundary computation; merge into the same Set used by the capture branches.
  Env off-switch: `HF_FAST_CAPTURE_INTERVAL_SS=false`.

### Step A4 — Validate
1. **af468890 must flag f102–121** (the known flash tween). Add a debug log of the
   at-risk set size + ranges; render af468890 with the new predictor; confirm.
2. **Re-run the 13 sparse comps** through hybrid+interval-predictor (use de-dmgdist.sh
   pattern, but with the predictor on instead of bypass) and confirm per-frame PSNR:
   the previously-damaged frames are now screenshotted (→ ∞ or healthy) and the
   damaged-frame fraction drops to ~0. Target: all 13 reach >45 dB mean (or 0% damaged frames).
3. **Confirm speedup survives:** the at-risk set should be a small fraction of frames
   for the sparse comps (it was 0–8% damaged → at-risk should be similar small %). Log
   `atRiskFrames.size / totalFrames` per comp; should be <25% for the SPARSE set.
4. **The 4 PERVASIVE comps** (9e3c36ba, 4fcc7660, 5697cb63, 38097e59): at-risk fraction
   will be high (>50%) → add a go/no-go: if at-risk fraction > ~40%, fall through to
   the whole-comp gate (full screenshot) — don't bother with hybrid.

### Step A5 — Ship
Strip any debug logging/probes. Typecheck + oxlint + oxfmt. Commit on the stack
(`gt create --no-verify -m "..."` stacked on `drawelement-perframe-fallback`).
Update `fast-capture-limitations.md` (mark Lim 7 fixed, record the lift on the 13 comps).

---

## 6. TASK B — macOS static-frame dedup spike (separate lever)

**Premise (measured):** macOS `Page.captureScreenshot` is flat ~24 ms/frame; static
holds re-capture identical frames for nothing. BeginFrame/Linux already dedups via
`hasDamage` (returns `lastFrameCache`). Port the idea to macOS.

**Detection (deterministic, pre-capture):** a frame is static iff NO GSAP tween is
active in `[t_prev, t_now]` AND no video AND no canvas/webgl present (those may redraw
without a tween). Reuse the SAME `window.__timelines` introspection as Task A — a frame
with no active tween + no dynamic media = identical to the previous frame → skip
capture, reuse the previous buffer.

**Caveats (from prior probe, memory `project-fast-capture-perf-model`):** dedup is
NARROW — ~89% of comps disqualified (78% have a canvas, 11% video); eligible comps
often have continuous tweens (zero static frames). Best case ~31% frames skippable
(long-holds presentation). **Under-detection = stale/frozen frame (correctness bug)** —
bias conservative.

**First step:** DON'T build yet. Measure the TRUE static-frame fraction across the
corpus via timeline introspection (NOT the JPEG-byte-size proxy, which overcounts).
Reuse Task A's tween-interval machinery: static frames = total − union(all tween
active intervals) − dynamic-media frames. Report the distribution; size the payoff;
THEN decide.

---

## 7. Reference data

- **The 18 hybrid-damaged comps + classification:** `/tmp/dmgdist.jsonl`. Summary:
  - SPARSE/fixable (13): 7882f09c, 0670ee56, 4fa05434, b459dbe9, 100c5fad, 27388fb9, 2666ea5d, 6502a4ed, 8f942142, 7dec755f, af468890, 4cf3ed60, 38e9ca4c
  - MIXED (1): d0a3039a (35%)
  - PERVASIVE/gate-only (4): 9e3c36ba (55%), 4fcc7660 (77%), 5697cb63 (99%), 38097e59 (100%)
- **Hybrid eval (all 42 fallback comps):** `/tmp/hybrid-eval.jsonl` (fields: n, bok, hok, inj, boundary, crash, refell, psnr).
- **Best validated golden comp for Task A:** `af468890` — flash overlay crossfade,
  damaged frames f102–121 (and f290–300-ish, f470-480-ish; tween repeats per scene).
  Use it as the unit test for the predictor.
- **Verse dashboard (live):** https://www.heygenverse.com/a/9e71f3dc-23c8-4260-b45f-8e9e65a34c1c
  (worker-encode + hybrid eval; fallback rows show hybrid PSNR + verdict tag). Data
  asset `aa298d41-bdff-4b87-950c-107870f536ce` (v4). To update: edit `/tmp/we-page.html`,
  upload new data via `hv_upload_asset` (content=...), update `DATA_URL`, `hv_update`
  the app (id `9e71f3dc-...`). Pass HTML content, not a URL.
- **Memory:** `project-drawelement-clip-boundary-blackout` and
  `project-fast-capture-perf-model` (have the condensed findings + commit SHAs).

---

## 8. Definition of done for the next stream
- Task A shipped: 13 sparse comps render healthy (>45 dB / ~0% damaged frames) on the
  fast path with the interval predictor, at-risk fraction logged, 4 pervasive comps
  correctly fall through to gate. Committed on the stack, docs updated.
- Task B: static-frame fraction measured across corpus; go/no-go decision recorded.
- Then (user's call): push the stack / `gt submit`.
