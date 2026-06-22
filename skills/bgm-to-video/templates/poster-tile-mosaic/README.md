# Poster-Tile Mosaic · 3 beat-synced operations

> Reverse-engineered from **group_5** of the golden sample (the Namshi poster-grid scene).
> `structural_type: dense_multiply` · status: **draft**

**ONE base template, THREE operations.** The base is a packed **mosaic of
DIFFERENT-sized tiles** — **not** a uniform grid: tall / wide / small colored boxes
that tessellate to fill the frame **with no overlap** (thin seams only), exactly like
the source's 错落 wall. **Asset-free**: a tile is a colored box with a text label.
"Adding a box" = a new image; "changing a box color" = a new asset / recolor. Three
interchangeable, beat-synced operations act on that one mosaic:

| op                        | what it does                                                                                                                                             | what moves                       | source span          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------- |
| **A · staggerInOut**      | pop different-sized tiles in one-per-onset (top-right→bottom-left waterfall) until they pack the frame → hold on a downbeat → pop them out one-per-onset | transform + opacity (per tile)   | 0.58–2.08s (f14–f50) |
| **B · holdRecolor**       | snap the whole wall on at once, **lock positions**, recolor the grid as a unit on each beat                                                              | background color (per tile, 0ms) | 2.37–2.91s (f57–f70) |
| **C · snakeFill+overlay** | reveal tiles along a **snake path** to fill → recolor whole grid on the hard-stop → pop overlay "cutouts" on top, one-per-onset                          | reveal + one swap + overlay pops | 3.0–5.5s (f72–f137)  |

```
group_5_template/
  index.html   ← asset-free reference impl: mosaic + 3 operators + program runner
  program.json ← the default group_5 score as standalone, agent-editable DATA
  card.json    ← the spec: base template, operators, program_format, match signature
  assets/gsap.min.js   ← vendored (offline-safe lint/validate/render)
  renders/     ← group_5_recreate(.mp4 / _audio.mp4) + custom_demo.mp4 (a remixed program)
  README.md    ← this file
```

This is the answer to _"is it one base template used three ways?"_ — **yes.** The
implementation makes that literal: the same `tiles[]` mosaic is built once (by a
deterministic binary-split packer) and reused by all three operations; only the
**scheduling** differs. (Gemini's pass called the three "different systems" —
frame-by-frame inspection disproved that; see `card.json` provenance.)

---

## 1. How it beat-syncs (from `group_5.audiomap.json`)

**Nothing is on a timer.** Every move is a GSAP tween/`set` at an absolute audio
second from the analysis. Track facts: **BPM 129.2**, 4/4, downbeats **1.324 (f32) /
3.181 (f76) / 5.039 (f121)**, **hard_stop @ 4.0s** (largest energy drop, Δ-0.67).

The score is the **PROGRAM** — a data array of operator steps ([`program.json`](program.json),
mirrored inline as `DEFAULT_PROGRAM` in §3):

```jsonc
[
  {
    "op": "staggerInOut", // build → hold → exit
    "enter": [0.23, 0.37, 0.46, 0.6, 0.7, 0.84, 0.91, 1.07, 1.14, 1.28], // 10 onsets → 10 tiles
    "hold": 1.324, // downbeat f32
    "exit": [1.37, 1.51, 1.62, 1.74, 1.83, 1.97, 2.07],
  }, // staggered out (ends f50)
  {
    "op": "holdRecolor",
    "on": 2.35,
    "onTheme": 1, // snap on, lock, recolor
    "recolor": [2.42, 2.53, 2.81, 2.93],
    "themes": [2, 3, 1, 2],
    "off": 2.98,
  },
  {
    "op": "snakeFillOverlay", // fill → swap → overlay
    "fill": [3.04, 3.181, 3.44, 3.65, 3.79, 3.9], // 3.181 = downbeat f76 (accel)
    "swap": 4.0,
    "swapTheme": 4, // hard_stop "一键换装"
    "overlay": [4.11, 4.34, 4.48, 4.81, 4.97, 5.25, 5.48],
  }, // 7 onsets → 7 cutouts
]
```

**The rule of thumb:** structure (the build, the downbeat hold, the hard-stop swap)
leans on the strong grid; texture (per-onset reveals, per-beat recolors) rides the
dense onset stream in between.

---

## 2. Why _this beat_ → _this template_ (the matching intuition)

Reach for the tile-wall when the audiomap shows:

1. **A steady grid** (`has_steady_grid: true`) — you need downbeats to pin the
   build/hold/swap structure to.
2. **A dense, continuous onset stream** (`onset_gap_bars ≤ 0.5`) — _a hit available
   for every tile move_. group_5 is wall-to-wall snares/hihats; that's what lets one
   tile enter (or recolor, or fill) per onset.
3. **Distinct sub-phases you want to articulate differently** — an accumulate stretch,
   a held/rolling stretch, then a fill-and-drop. The three operations map onto exactly
   that shape: **build → recolor-on-roll → fill-then-drop**.
4. **A hard-stop / big DROP** mid-section — op C uses it for the full-grid "一键换装"
   recolor (`swap`), the single most dramatic beat in the scene.

Put plainly: **"steady grid + dense onsets + 2–3 contrasting sub-phases + a hard-stop"
is the fingerprint.** When you see it, you have a hit for every box you want to place,
recolor, or stack.

---

## 3. Usage

### Render with defaults (the group_5 recreation)

```bash
cd group_5_template
npx hyperframes lint . && npx hyperframes validate .
npx hyperframes render . -f 24 -o renders/group_5_recreate.mp4
# beat-matched proof (mux the original BGM):
ffmpeg -y -i renders/group_5_recreate.mp4 -i ../group_5.wav -c:v copy -c:a aac -shortest renders/group_5_recreate_audio.mp4
```

### Change the mosaic & labels (content only — no code edit)

```bash
npx hyperframes render . --variables '{
  "tiles": 16, "bands": 4, "gap": 6,
  "labels": "NEW,DROP,SALE,40% OFF,SHOP,NOW",
  "bgColor": "#111111"
}'
```

- **tiles** = how many different-sized boxes the packer tessellates the frame into.
- **bands** = how many horizontal row-bands the snake fill (OP C) sweeps through.
- **gap** = seam thickness (0 = truly edge-to-edge, no seams).
- The waterfall enter order, the snake path, and the per-onset mappings all adapt to
  the resulting mosaic automatically.
- **labels** is a comma list, cycled across tiles. **showText:false** hides labels for
  a pure color-block look.

### Recompose freely — compose by DATA, not code (the whole point)

The three operators (`staggerInOut`, `holdRecolor`, `snakeFillOverlay`) are **pure,
parameterized, order-independent** functions over the one shared mosaic. What runs — in
what order, on which beats — is a **data PROGRAM** (an array of `{op, ...beats}` steps).
The default group_5 score lives in [`program.json`](program.json) and inline as
`DEFAULT_PROGRAM` (§3); the runner (§7) just dispatches `OPS[step.op](step)`.

So you recompose **without touching operator code** — pass a `program` JSON string:

```bash
# Run ONE operator solo (just the snake-fill + overlay)
npx hyperframes render . --variables '{"program":"[{\"op\":\"snakeFillOverlay\",\"fill\":[0.3,0.8,1.3,1.8,2.3],\"swap\":2.8,\"swapTheme\":4,\"overlay\":[3.0,3.4,3.8,4.2]}]"}'

# REORDER + retime: recolor first, then build, then fill (B → A → C)
npx hyperframes render . --variables '{"program":"[{\"op\":\"holdRecolor\",\"on\":0.3,\"onTheme\":2,\"recolor\":[0.8,1.3,1.8],\"themes\":[3,1,4],\"off\":2.1},{\"op\":\"staggerInOut\",\"enter\":[2.4,2.6,2.8,3.0,3.2,3.4],\"exit\":[3.8,4.0,4.2]},{\"op\":\"snakeFillOverlay\",\"fill\":[4.4,4.7,5.0,5.3],\"swap\":5.4,\"overlay\":[5.5,5.65]}]"}'

# REPEAT an operator (build, exit, build again)
npx hyperframes render . --variables '{"program":"[{\"op\":\"staggerInOut\",\"enter\":[0.2,0.5,0.8,1.1],\"exit\":[1.5,1.8,2.1]},{\"op\":\"staggerInOut\",\"theme\":2,\"enter\":[2.5,2.8,3.1,3.4]}]"}'
```

Each step's fields are documented in [`card.json`](card.json) → `program_format`. An
agent composes by emitting this JSON (op names + beats) — it never edits JS. Steps
combine freely, reorder, repeat, or run solo; every operator re-shows tiles from hidden
and sets its own theme, so any sequence is safe.

> **Empty `program` = the built-in group_5 score.** Keep `program.json` and
> `DEFAULT_PROGRAM` in sync — `program.json` is the canonical, copy-pasteable data.

### Re-fit the beat to a different group (the part that changes per track)

Copy the new group's `audiomap.json` onset/downbeat seconds into the step beat lists
(in `program.json` / `DEFAULT_PROGRAM`). Each list grows or shrinks freely — more onsets
→ more tile moves; `beatAt()` distributes any tile count across any beat list. For a
longer/shorter piece, also set `DUR` and the root `data-duration` to the new span.

Add palettes to `THEMES`, faces to `FONTS`, more overlay slots are auto-built from the
program's hungriest `overlay` list — every move stays keyed to an audio second, so it
renders identically every time. Want a new move? add a function + an `OPS` key (§6) and
the program can call it by name.

> **Deterministic / asset-free:** only colored boxes + generic font stacks, no remote
> assets, no `Math.random` (scatter uses a deterministic index hash), no timers.
> See `references/builder-contract.md`. Lints clean (0 errors, 0 warnings); validates
> with no console errors.

---

## 4. Provenance

- **Source:** `bgm-golden-sample-reverse/gorup-by-group/group_5/group_5.mp4`
- **Audio:** `group_5.audiomap.json` (from `scripts/analyze-beatgrid.py`)
- **Video read:** `group_5.gemini-analysis.md` (Gemini 3 Pro) **corrected by
  frame-by-frame inspection** — Gemini mislabeled op B as a zero-gap two-row _banner_
  and concluded the three phases were "different systems." Pulling real frames at each
  onset proved B is the **same tile-wall recolored as a unit** (green→blue→pink), and
  that A/B/C share one asset family and one grid paradigm — i.e. one base template,
  three operations. Trust frames over sparse sampling for per-frame detail.
- **Open question for promotion:** the source omits an intro flourish (a green "III"
  glyph transition, 0–0.58s) that this template skips; decide whether to ship it as an
  optional pre-roll role. Also consider varying the per-phase grid _gap_ (the source
  loosens the gap in op A, tightens it in B/C) as an operation parameter.
