# Logo Split / Lockup Pulse — `logo-split-lockup-pulse`

A short, beat-locked **logo/brand sting**. A two-part mark sits joined at center,
**splits left↔right** to open a gap, **grows a center word-lockup one word per onset**
(the key word lands on the downbeat surge), **snap-closes** on a hit, then **pulses**
with the roll/hihat bed before a fast cut.

Reversed from **group_7** of the golden sample — the **Lille — World Design Capital
2020** sting (left radial spark `☀` + `lille 2020` + right cloud `☁`, on a flat green
field).

## Files

```
group_7_template/
  card.json             ← the spec (match-face + build-face)   · status: draft
  index.html            ← reference impl (parameterized GSAP; inlined motion-blur snippet)
  assets/gsap.min.js    ← bundled GSAP (offline-safe)
  assets/fredoka-700.woff2 ← bundled heavy rounded face (@font-face "Lockup")
  renders/recreate.mp4 + renders/stills/  ← rendered proof @24fps
```

## What it covers (provenance — group_7, 24fps, BPM 92.3)

The marks move on a FEW discrete anchors only — the sustained hi-hat fill (f17–f86) is
texture, **not** a motion driver. Left + right brackets always move **together** (mirrored).

| stage          | frames  | time       | what                                                                                                     | beat                                |
| -------------- | ------- | ---------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| seed           | f2      | 0.083s     | joined bracket pair (full-outside / empty-middle) blooms in at center                                    | f2 perc onset                       |
| split + word 1 | f3–f6   | 0.13–0.25s | brackets **glide apart** to the full lockup width (held); `lille` eases into the gap                     | f6 onset                            |
| word 2         | f24     | 1.000s     | `2020` eases into the reserved space (brackets already open)                                             | **SURGE@1s / downbeat f24-25**      |
| hold           | f24–f49 | 1.0–2.08s  | `lille 2020` static                                                                                      | hi-hat fill bed (texture)           |
| snap-close     | f50     | 2.083s     | 1-frame hard cut: words vanish, brackets weld back together (impact streak via blur)                     | after f47 snare                     |
| see-saw        | f51–f63 | 2.13–2.63s | welded unit damped vertical bounce + building see-saw tilt (spark UP / cloud DOWN), settling high+tilted | **f51 / f55 / f58 / f63** (hi-hats) |
| exit           | f70     | 2.917s     | source hard-cuts to the next group (live footage)                                                        | `fast_cut` (near f71 kick)          |

Corrections baked in vs earlier reads: the close is a **1-frame hard snap** (not a
squeeze); after it the weld does a **damped vertical bounce + a rigid see-saw tilt**
(left-spark up / right-cloud down — one rigid unit rotating, **not** a scale-pulse and
**not** per-side independent), beat-synced and decaying; the marks **pre-open to full
width** (so word1 floats in wide brackets); the marks are **big enough to wrap the text**
(~2.5–3× letter height, ~140° spark fan), each with its mass on the **outer** side.

## Silkiness (what makes the motion fluid, not stiff)

- **Velocity motion blur** (inlined registry `motion-blur` snippet) on the two brackets —
  a one-sided SVG ghost trail proportional to speed, so the fast split-glide and the
  snap-impact read smooth instead of as hard frame jumps. Clears at rest.
- **Smooth, slightly longer eases** (`expo.out` split, `power3.out` word reveals,
  `power2.out` recoil) — no poppy `back.out`/elastic. Timing anchors are unchanged.
- A **gentle hold-drift** (`sine.inOut`) so the weld isn't dead-frozen.

## Parameters (swap freely)

- `bgColor` / `markColor` / `textColor` — palette (defaults: green `#249b5f`, cream `#e7e3dd`).
- `leftMark` / `rightMark` — **inline SVG** for each side. Empty → the default spark / cloud.
  Pass **two related SVGs**, or **the two halves of one logo** (left half + right half).
  Keep each mark's mass on its **outer** side so the pair reads as brackets framing the text.
- `word1..word4` — the lockup words, revealed one per onset and accumulating. Supports
  **1, 2, or 3+ words**; put the key word on the strongest beat. Empty slots are skipped.

## Adaptivity (`beat_map` in `index.html`)

Content lives in `params`; musical **timing** lives in the `beat_map` constants
(`ENTRY`, `SPLIT`, `WORD_ONSETS[]`, `CLOSE`, `DUR`) — filled from the matched group's
`audiomap.json`. The impl **measures each word at build time** and pre-opens the brackets
to the full lockup width, so any word count / length re-centers correctly. More words →
add `WORD_ONSETS` entries. The marks deliberately do **not** animate on the hi-hat bed.

## Verify

```bash
npx hyperframes lint  group_7_template   # clean (1 inherent window.__timelines note)
npx hyperframes validate group_7_template # no console errors
npx hyperframes render group_7_template -f 24
```

## Status

`draft` — in the reverse workspace. Promote per `reverse-to-template.md` Step 9 (copy to
`skills/bgm-to-video/templates/logo-split-lockup-pulse/`, set
`status:"promoted"`, stamp `created`) once reviewed. Proposed new motion verbs
(`split_open`, `snap_close`, `per_onset_pulse`) and the shared `per_onset_sequential`
structural_type are flagged in `card.json` for catalog review.
