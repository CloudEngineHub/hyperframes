# Storyboard — HyperFrames Native Renderer Design Proposal

**Format:** 1920×1080
**Duration:** ~60 seconds
**Audio:** ElevenLabs TTS voiceover + minimal electronic underscore
**VO direction:** Calm, dry, technically confident. Measured pace. Short sentences breathe. Apple keynote register but for engineers.
**Style basis:** DESIGN.md — dark developer aesthetic, single teal accent, monospace everywhere

**Global guardrails:**

- Background stays `#0a0a0a` in every beat. Never lighter.
- Teal `#3CE6AC` is the only accent. Chrome red `#ef4444` used only as a data color in Beat 2.
- Every beat has 3+ animated elements — never static.
- Monospace for every number, label, and code string.
- Motion: err toward more movement. Subtle reads as static at 30fps.

**Underscore:** Minimal electronic. Sparse arpeggiated synth, low-frequency pad. Plays throughout at -18dB under VO. Fades to near-nothing in Beat 1 (just the stat), swells slightly in Beat 6 (resolution). Never competes with VO.

---

## Asset Audit

No captured website assets. All visuals are generated in-composition using:

- SVG path drawing (architecture flow, connector lines)
- Canvas 2D procedural (particle field background, noise texture)
- Monospace text (stat numbers, code, terminal lines)
- CSS geometric shapes (bars, pills, cards)

| Element                   | Type                  | Beat           | Role                           |
| ------------------------- | --------------------- | -------------- | ------------------------------ |
| `86%` stat                | Monospace counter     | Beat 1         | Hero number, full screen       |
| Chrome timeline bar       | SVG + CSS bar         | Beat 2         | Visual proof of bottleneck     |
| Architecture flow diagram | SVG path drawing      | Beat 3         | Two-layer system visualization |
| Adapter pill list         | Staggered CSS pills   | Beat 3         | Adapter ecosystem              |
| `--backend auto` terminal | Typed terminal line   | Beat 4         | Contract visualization         |
| Fallback code block       | Monospace text block  | Beat 4         | Fallback taxonomy              |
| Phase pills 01–07         | Staggered pill row    | Beat 5         | 7-phase plan                   |
| Benchmark bars            | Animated bar chart    | Beat 5         | Proof-first framing            |
| "A faster lane." headline | Per-word kinetic type | Beat 6         | Closer                         |
| HyperFrames wordmark      | Text logo             | Beat 1, Beat 6 | Opener + closer                |

---

## BEAT 1 — HOOK (0:00–0:08)

**VO:** "Eighty-six percent."

**Concept:** The camera opens on darkness. Then a single number materializes out of nothing — so large it fills the frame. This isn't a slide. It's a confrontation. The viewer doesn't know what it means yet. They want to.

**Visual:** Pure black void. A faint Canvas 2D particle field breathes across the background (200 slow-drifting dots, near-invisible, just enough to feel the space is alive). From the center, the number `86%` STAMPS into existence — JetBrains Mono, 280px, `#e5e5e5`. Below it, a muted label `of render time` types on character by character. A soft teal radial glow pulses behind the number — one slow breath in (0→0.12 opacity, 1.2s) and stays.

**Camera:** Static center. No movement — the number is the event.

**Depth layers:**

- BG: `#0a0a0a` + Canvas 2D particle field (opacity 0.08)
- MG: `86%` in monospace, `of render time` label below
- FG: subtle teal radial glow, HyperFrames wordmark top-left corner fades in at 0.5s

**Mood direction:** Monument energy. Think Apple's "1000 songs in your pocket" — one number, maximum silence around it.

**Animation choreography:**

- Canvas particle field: already animating at beat start, continuous slow drift
- `86%`: opacity 0→1, scale 0.92→1, duration 0.5s, `back.out(1.4)` — STAMPS in
- `of render time` label: characters type on, 0.02s per char, starts 0.6s after number appears
- Teal glow: opacity 0→0.12, 1.2s, `sine.inOut`, pulses once more at 1.8s
- HyperFrames wordmark: opacity 0→0.7, y:−8→0, 0.4s, starts at 0.5s

**Transition OUT:** Velocity-matched upward — y:−150, blur:30px, opacity 0, 0.33s `power2.in`

**SFX:** Deep sub-bass hit exactly when `86%` stamps in. Silence around it. Subtle ambient hum fades in at 1s.

---

## BEAT 2 — THE BOTTLENECK (0:08–0:18)

**VO:** "That's how much of render time Chrome spends just taking screenshots."

**Concept:** The number gets its context. We see a render pipeline profile — a horizontal timeline bar split into labeled segments. Chrome capture dominates it, overwhelmingly. The bar fills in left to right as the VO plays, making the viewer watch the problem build in real time.

**Visual:** A timeline bar visualization centered in frame. The bar is 1400px wide, 48px tall, `#141414` background, `#262626` border. Segments fill in left to right over 3 seconds:

- `Chrome capture 85.8%` → fills first in `#ef4444` (red), dominant
- `FFmpeg encode 8.2%` → `#737373` (muted)
- `Video extract 3.0%` → `#404040`
- `Other 3.0%` → `#2a2a2a`

Above the bar: `Apple Presentation Profile` label in monospace, muted. Below it: `109.0s total wall time` in small teal monospace. On the right side, floating labels slide in as each segment appears. The `85.8%` label appears in red with a counter that counts up from 0% to 85.8%.

**Depth layers:**

- BG: `#0a0a0a` + faint Canvas 2D horizontal scan lines (opacity 0.03)
- MG: Timeline bar + segment labels + percentage counter
- FG: `Chrome capture` label with arrow, teal total time annotation

**Mood direction:** Profiler output. Clinical, precise. Think Instruments or Datadog dashboard — the kind of data that makes an engineer lean in.

**Animation choreography:**

- Bar background: fades in at 0s, 0.3s
- Chrome segment: width 0→85.8%, 1.8s, `power2.out` — FILLS across the bar, filling the space with red
- Counter for 85.8%: COUNTS UP 0→85.8, 1.8s, `power2.out`, monospace
- Remaining segments: CASCADE in staggered 0.2s each after Chrome segment completes
- Labels SLIDE in from right, 0.25s each, staggered

**Transition OUT:** Whip pan left — x:−400, blur:24px, 0.3s `power3.in`

**SFX:** Each segment appearance gets a soft tick. Chrome segment fill accompanied by a continuous low drone that cuts precisely at beat end.

---

## BEAT 3 — THE SOLUTION (0:18–0:32)

**VO:** "The native renderer changes that. H T M L stays the authoring format. A Rust and Skia I R replaces the per-frame browser path for the subset we control."

**Concept:** We reveal the two-layer architecture — not as a slide, but as a living diagram that draws itself. The camera watches SVG path connectors trace from HTML authoring through the Native Compiler to the IR to Rust/Skia. Chrome floats to the side, still present, not gone — just no longer in the per-frame path.

**Visual:** An architecture flow diagram draws itself center-frame. Three nodes in a horizontal layout:

1. Left: `HTML` in a `#141414` rounded-rect card, teal border, teal text
2. Center: `Native Compiler` card, white border, white text
3. Right: `Rust / Skia IR` card, teal border, teal text

SVG path connectors draw between them left to right. Below the main flow, a smaller secondary path: `→ Chrome (fallback)` in muted red-gray.

Below the diagram, 5 adapter pills CASCADE in staggered: `GSAP` `Image` `Video` `Text Clips` `Audio` — small `#141414` pills with teal 1px borders and monospace text.

**Depth layers:**

- BG: `#0a0a0a` + subtle Canvas 2D grid dots (6x6 grid, opacity 0.05)
- MG: Architecture flow diagram + connector paths
- FG: Adapter pills row below, floating annotation labels

**Mood direction:** System architecture diagram. Precision and clarity. Think a whiteboard photo that's been cleaned up by a designer. The Chrome node positioned lower and muted — present but not dominant.

**Animation choreography:**

- Grid dots: fade in at 0s, opacity 0→0.05, 0.4s
- HTML card: SLIDES in from left, x:−80→0, opacity 0→1, 0.4s `power2.out`
- Connector path 1: DRAWS left to right, strokeDashoffset animation, 0.6s `power2.out`, starts 0.4s
- Compiler card: SLIDES in, x:30→0, 0.35s, starts after path 1 completes
- Connector path 2: DRAWS, 0.5s, starts after compiler appears
- Rust/Skia card: SLIDES in from right, 0.4s, starts after path 2 completes
- Chrome fallback path: DRAWS below, muted color, 0.4s, starts 0.5s after main flow completes
- Adapter pills: CASCADE in staggered 0.15s each, y:20→0, opacity 0→1, 0.3s each

**Transition OUT:** Zoom through — scale 0.75→1 on incoming, blur 20px→0, 0.5s `expo.out`

**SFX:** Soft electronic blip on each card appearance. Path draw sounds like a quiet pen stroke (sub-tick).

---

## BEAT 4 — THE CONTRACT (0:32–0:44)

**VO:** "The auto backend chooses transparently — native when the compiler can prove support, Chrome when it can't. Every decision is logged. Nothing changes silently."

**Concept:** A terminal. The auto backend making a decision in real time. The viewer watches `--backend auto` evaluate a composition, log its reasoning, and either accept or fall back — with a visible, readable reason code. This is the product contract made tangible.

**Visual:** A `#141414` terminal panel, 1200×500px, `1px solid #262626` border, `12px` border-radius, centered. Two sections:

**Left (60%):** Terminal with typed command:

```
❯ hyperframes render --backend auto ./composition
```

Then output types on line by line:

```
  → checking support...
  ✓ gsap.transform   native
  ✓ image.compositing native
  ✗ canvas.arbitrary  fallback → chrome

  backend: native (partial)
  fallback: unsupported.canvas
```

**Right (40%):** A simple two-column comparison — `native` column with teal check badges vs `chrome` column with muted badges. Rows: `GSAP timeline` `Image layers` `Canvas / WebGL` `Text clips`.

**Depth layers:**

- BG: `#0a0a0a` with faint horizontal scan lines
- MG: Terminal panel, centered
- FG: comparison table on right, teal `✓` and muted `✗` icons

**Mood direction:** Honest reporting. Clinical dashboard. The visual equivalent of `--verbose` output that you actually trust.

**Animation choreography:**

- Terminal panel: SLIDES in from below, y:40→0, opacity 0→1, 0.5s `power2.out`
- Command line: types on char by char over 0.8s, cursor blinks
- Output lines: each line SLIDES in y:10→0, opacity 0→1 staggered 0.2s per line
- `✓` badges: STAMP in scale 0.7→1, opacity 0→1, `back.out(2)`, each 0.15s apart
- Fallback `✗` appears in muted red-gray, same animation but `power2.out`
- Right comparison table: FADES in 0.4s after terminal output completes

**Transition OUT:** Blur through — blur:20px, 0.3s → incoming blur:20px→0, 0.25s `power3.out`

**SFX:** Terminal typing sounds (subtle mechanical clicks). Soft chime on each `✓`. Muted thud on `✗`.

---

## BEAT 5 — THE PLAN (0:44–0:54)

**VO:** "Seven phases. Starting with proof infrastructure — not speed claims. Can we detect support accurately? Can we prove quality gates? Can the auto backend be trusted?"

**Concept:** The 7-phase plan, rendered as a horizontal timeline of numbered pills. Phase 1 activates first — bright, teal, labeled. Phases 2–7 are present but dimmed. Below, two horizontal bars appear side by side: "Chrome path" (full width, muted red) vs "Native path" (shorter, teal) — a preview of the performance claim that the proof will eventually validate. The implicit message: we don't claim the win yet. We build the measurement system first.

**Visual:** Top half: horizontal pill row `01` `02` `03` `04` `05` `06` `07`. Pill `01` is teal-filled with label `Proof Infrastructure` below. Pills `02`–`07` are `#262626` outlines, muted.

Below pill row: two labeled bars

- `Chrome path (current)` — muted red, width 85% of container
- `Native path (target)` — teal, width 30%, with `? faster` label (question mark intentional)

Below bars: Three questions appear as monospace lines:

```
Can we detect support accurately?
Can we prove quality gates?
Can the auto backend be trusted?
```

**Depth layers:**

- BG: `#0a0a0a`
- MG: Pill row + bar comparison
- FG: Question lines, question-mark annotation on native bar

**Mood direction:** Project planning with epistemic honesty. We know what we don't know. The `?` is not a weakness — it's the whole point.

**Animation choreography:**

- Pills CASCADE in from left, staggered 0.12s each, y:−20→0, opacity 0→1, 0.3s
- Pill `01` pulses with teal glow once after appearing
- Label `Proof Infrastructure` SLIDES in below pill 01, 0.25s delay
- Chrome bar: FILLS left to right, 0.8s `power2.out`
- Native bar: FILLS left to right, 0.5s `power2.out`, starts 0.3s after chrome
- `? faster` label FADES in after native bar completes
- Question lines: each SLIDES in y:12→0, opacity 0→1, staggered 0.3s per line

**Transition OUT:** Velocity-matched upward — y:−150, blur:30px, 0.33s `power2.in`

**SFX:** Each pill appearance gets a soft tick. Teal glow on pill 01 is accompanied by a brief warm tone. Chrome bar fill plays a low continuous tone; native bar plays a higher, cleaner one.

---

## BEAT 6 — CLOSER (0:54–1:01)

**VO:** "Native rendering isn't replacing Chrome. It's giving the best HyperFrames work a faster lane. Let's build it right."

**Concept:** Clean resolution. The teal accent takes over. Per-word kinetic typography delivers the closer — each word arriving with purpose, not speed. The HyperFrames wordmark returns below. The final frame settles into stillness.

**Visual:** Black void. Per-word kinetic typography, centered:

Line 1: `Native rendering isn't replacing Chrome.` — system sans, 42px, `#737373` (muted)
Line 2 (pause): `It's giving the best HyperFrames work` — system sans, 42px, `#e5e5e5`
Line 3: `a faster lane.` — JetBrains Mono, 72px, **teal** `#3CE6AC`, bold

HyperFrames wordmark appears below at 5s into beat, opacity 0→0.8, gentle y drift −8→0.

Behind the teal words, a soft radial glow expands (0→160px, opacity 0→0.2, `sine.inOut`, 1.5s).

**Depth layers:**

- BG: `#0a0a0a` + radial teal bloom centered
- MG: Three lines of typography, staggered
- FG: HyperFrames wordmark bottom-center

**Mood direction:** Resolved. Earned. The energy isn't hype — it's confidence. Think the last card of an Apple presentation: one clean thought, held.

**Animation choreography:**

- Line 1 words: CASCADE in per-word, x:60→0 decay per word (60→12px), y:14→0, opacity 0→1, 0.35s each, `power2.out`, staggered 0.15s
- Line 2 words: same, starts after line 1 settles, 0.4s gap
- Line 3 words: STAMP in with more energy — scale 0.9→1, opacity 0→1, `back.out(1.3)`, staggered 0.2s
- `a faster lane.` final word gets a brief teal glow pulse after landing
- Radial bloom: EXPANDS behind teal text, 0→160px, 1.5s `sine.inOut`
- Wordmark: FLOATS in, y:−8→0, opacity 0→0.8, 0.5s `power2.out`, starts at 5s
- Hold final frame for 1.5s — full stillness

**Transition OUT:** Fade to black — opacity 0.8→0, 1.0s `power2.in` (end of video)

**SFX:** Subtle warmth pad swells under line 2. On `a faster lane.` — a single clean chime. Pad resolves. Silence under wordmark appearance.

---

## Production Architecture

```
videos/native-renderer-proposal/
├── index.html                    root — VO + underscore + beat orchestration
├── DESIGN.md                     brand reference
├── SCRIPT.md                     narration text
├── STORYBOARD.md                 THIS FILE
├── transcript.json               word-level timestamps (Step 5)
├── narration.wav                 TTS audio (Step 5)
└── compositions/
    ├── beat-1-hook.html
    ├── beat-2-bottleneck.html
    ├── beat-3-solution.html
    ├── beat-4-contract.html
    ├── beat-5-plan.html
    ├── beat-6-closer.html
    └── captions.html
```
