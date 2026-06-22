# held-text-strobe-burst (group template)

A reusable HyperFrames template for the **Held Text / Strobe Burst** pattern: a word
held **dead still** in the center while its letterforms **flip through texture-filled
frames** every ~3 frames, in short bursts pinned to a drum roll / fill. The default
(and primary) look is the **Texture-Flip** technique — there is no shader and no video.
All state lives on one paused GSAP timeline → deterministic and seek-safe.

Reversed from `../gruop_4.mp4` (see `../gruop_4.bg-flicker.gemini-analysis.md`, burst 2 —
the "III" glyph whose interior style-transfers per beat). Sibling of **Held Message /
Living Field** (`webgl-textures-playground`): message holds, background carries the
motion — but here it _strobes_ in beat-quantized hits instead of breathing.

> Render at **24 fps** so the 0.125 s jumps land every 3 frames (the original cadence).

## The technique (Texture-Flip, foreground)

The word's letters are a **window**: `background-image: <solid-fill>, <texture-url>`
with `background-blend-mode: multiply`, clipped to the text (`background-clip: text`).
So each letter shows a **texture PNG tinted by a per-frame fill color**, over a solid
per-frame **background color**. N such frames are stacked as full-frame layers; the
strobe flips which one is visible (`tl.set(opacity)`, 0 ms — seek-safe). The texture
fills the whole letterform (`line-height ≥ 1` keeps the glyph inside the background-paint
box — with `line-height < 1` the cap tops/bottoms overflow it and leave untextured slivers).

A **persistent base** holds the word in a solid color on the idle (black) plate, so it
never disappears — it is the anchor. The **base-template default plan flickers
continuously across the whole clip and never stops**, so the idle base only shows if your
plan leaves gaps (e.g. the gruop_4 two-burst variant).

Three things change per beat: **texture** (material), **fill** (foreground tint),
**bg** (frame background). All snap to the strobe grid.

---

## What beat matches this template

The discriminator the Director uses — the **opposite** of a held pad (busy, not empty):

| Signature field   | Strobe Burst wants                 | Why                                                             |
| ----------------- | ---------------------------------- | --------------------------------------------------------------- |
| `density`         | **dense**                          | a strobe needs many hits to flip on                             |
| `energy_level`    | **≥ MEDIUM** (≥ HIGH in the burst) | flat-out hits, not a breath                                     |
| `onset_gap_bars`  | **≤ ~0.5 bar**                     | no onset deserts — a hit every fraction of a beat               |
| `has_rolls`       | **true**                           | a `rolls[]` run (accel-roll → SURGE, or a fill) is the _engine_ |
| `has_steady_grid` | true                               | jumps must quantize to a stable grid                            |
| `exit_trigger`    | `hard_stop` or `surge`             | the burst cuts clean to black, then the next section enters     |
| `span_bars`       | 1–2 (each burst ~0.4–0.7 s)        | a strobe that runs > 2–3 s tires the eye                        |

**Heuristic:** a high-hits/min roll inside a `dense` phase is a strobe-burst candidate.
Pin one burst per roll/fill; bound it by the `hard_stop` / `SURGE` that follows.

**gruop_4 facts that fired it** (from `../audiomap.json`):

- BPM 129; downbeat 1.254; grid 0.743 / 1.254 / 1.718 / 2.183.
- rolls: `0.09–0.79 accel-roll →SURGE`, `1.21–1.65 fill →DROP`, `1.93–3.00 accel-roll →SURGE`.
- `hard_stop` @ 2 s; SURGE@1 (+0.21), DROP@2 (−0.28), SURGE@3 (+0.78).
- Two bursts: **1.125–1.542 s** and **2.042–2.708 s**, jumps every 0.125 s.
- Burst 1 starts ~2 frames _before_ downbeat 1.254 (lead the anchor); burst 2 opens on
  the 2 s `hard_stop` + 1.93 accel-roll, ends 1 frame before the 2.76 snare.

---

## How to change it

Everything is a **composition variable** — fill with `--variables` (no code edit).

### 1. The word (instant)

`markText` — the held word (always on screen; box never moves). `fontStyle`:
`display` (Impact, bold condensed caps) or `serif` (Georgia italic). `markScale`
(0.3–2) sizes it.

### 2. The texture frames — `frames` (the core content)

A JSON array of texture-flip frames, cycled by strobe-step index:

```jsonc
[
  { "texture": "tiles-138", "bg": "#ff70b0", "fill": "#f0a020", "ink": "#2a0f1d" },
  { "texture": "lava", "bg": "#101127", "fill": "#ff5a2c" },
  { "texture": "onyx", "bg": "#e8e2d6", "fill": "#3a3a44" },
  // texture = file name (no .png) from assets/texture-mask-text/masks/  (66 available)
]
```

- **Replace the texture image** → change `texture` (66 masks bundled: `tiles-138`,
  `lava`, `onyx`, `marble-016`, `wood-066`, `concrete`, `metal-041-a`, `bricks-075-a`,
  `grass-005`, `snow-015`, …). List them: `ls assets/texture-mask-text/masks/ | sed 's/\.png$//'`.
- **Replace the foreground color** → change `fill` (multiplied INTO the texture inside
  the letters: light fill = bright/clear glyph, dark = moody, `#ffffff` = texture's own
  color). `ink` is optional (UI/decor color).
- **Replace the frame background** → change `bg` (solid color behind the word that beat).
- Empty `frames` → the built-in 7-frame texture-flip set.

`idleColor` / `idleInk` set the between-burst plate (default white word on black).
`decor: yes` adds the blueprint grid + crop border per frame.

### 3. Match the changes to the beat — `strobePlan` (the core timing knob)

A JSON array of bursts; the template fires a **0 ms flip** at every jump time, cycling
`frames` by a global step counter, and cuts back to the idle base at each `end` (unless
the burst runs to the composition end → no terminal black, so the default never stops).

**Default (base template): one continuous burst the whole clip** — flicker, no stops:

```jsonc
[{ "start": 0, "end": 3, "step": 0.125 }] // jump every 0.125 s, 0 → duration
```

**gruop_4-faithful variant** (two bursts pinned to the rolls, black gaps between):

```jsonc
[
  { "start": 1.125, "end": 1.542, "step": 0.125 }, // jump every 0.125 s
  {
    "start": 2.042,
    "end": 2.708,
    "jumps": [
      2.042,
      2.167, // OR list exact times
      2.292,
      2.417,
      2.5,
      2.625,
    ],
  },
]
```

**Building `strobePlan` from an AudioMap:**

1. **Find the roll(s).** Each `rolls[]` entry (or dense onset cluster) → one burst.
2. **Burst start = lead the anchor.** Open ~40–190 ms _before_ the kick/downbeat that
   launches the roll, so the first flip lands _on_ the hit (gruop_4 burst 1 leads 1.254
   by ~85 ms → start 1.125).
3. **Jumps = the grid the roll plays.** A 449/min hi-hat roll ≈ every 0.125 s →
   `step:0.125`. Irregular roll → list the actual `events[].t` as `jumps[]` so every
   flip sits on a real onset.
4. **Burst end = the stop.** End on the `hard_stop` / last snare / `SURGE` snapped to the
   next anchor; the template cuts to the held-word-on-black base there.
5. **Order `frames` for accents.** Put the highest-contrast texture/bg on the index that
   lands on the downbeat/kick; a near-black `bg` frame reads as a 1–2 frame blink-off.

Rule of thumb (`motion-primitives.md`): hard hits are **0 ms** (all flips are `tl.set`,
never tweened) and a dense strobe runs **≤ 2–3 s** — keep bursts short, let the
`hard_stop` clear them.

---

## Files

- `index.html` — reference implementation (Texture-Flip default + beat-matched plan).
  `lint`: 0 errors (2 cosmetic warnings — `invalid_composition_variables_declaration`,
  shared with the base template; and `Impact` font, carried from texture-flip, Arial
  fallback). `validate`: 0 errors (the 5 WCAG 1:1 warnings are intrinsic to
  `background-clip:text` — the checker can't read texture-filled glyphs).
- `assets/` — `gsap.min.js` + `texture-mask-text/masks/*.png` (66), copied from
  `../texture-flip` so the template is self-contained.
- `card.json` — draft template card. `meta.json` — name / dims / 24 fps / 3 s.
- `renders/proof.mp4` — proof render of the built-in config.

## Provenance

Reversed from `bgm-golden-sample-reverse/gorup-by-group/group_4` (`gruop_4.mp4`,
`audiomap.json`, `gruop_4.bg-flicker.gemini-analysis.md`). Texture-Flip technique +
assets from `group_4/texture-flip`. Timeline/overlay shape scaffolded on
`group_1/webgl-textures-playground`.
