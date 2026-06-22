# Card Flyby · accelerating 3D deck cascade — `card-flyby`

A depth column of **N cards** rolls **forward** through perspective. On each landing
beat the next card **tumbles up into the front slot** and **wipes in** its solid colored
face (angled clip-path), the previous front card **tumbles forward + falls toward the
camera** on exit, and the cards behind **advance one slot**. Dwells **shrink card-to-card**,
so the deck reads as an **accelerating rush** into a **held final card**.

> **Origin — sandbox, not a golden-sample reverse.** Unlike the other catalog templates,
> this one was authored from the **`card-flyby` sandbox** composition (a Shader-Deck-style
> flyby), so there is **no source `audiomap.json` / Gemini read**. The match-face is a
> **hypothesis** about which music the look fits, and `card.json → examples[].synthetic`
> flags its cadence as design-intent. The first time this template is matched to a real
> reversed group, add that group as a real `examples[]` entry and tighten `requires`.

## Files

```
card-flyby/
  card.json          ← the spec (match-face + build-face)            · status: promoted
  index.html         ← reference impl (parameterized GSAP; data-driven deck)
  program.json       ← the default 6-card deck + landing schedule (standalone, editable)
  assets/gsap.min.js ← bundled GSAP (offline-safe)
  renders/recreate.mp4 ← rendered proof @30fps (the default deck)
```

No fonts are bundled — the look uses a system grotesque stack (`"Inter", "Helvetica
Neue", Arial`). The original sandbox pulled Inter from Google Fonts + GSAP from a CDN
and used a grab-bag of clashing per-card hexes; this promoted impl **drops the remote
deps** (offline), makes the formerly-hardcoded deck **data-driven**, and replaces the
ad-hoc colors with a cohesive **`theme` palette system**.

## How it moves

The scene carries a **static yaw** (side tilt); the cards' own **`rotateX`** drives the
tumble. Depth comes from **perspective (Z translation)** plus aggressive `rotateX` on the
cards behind — the rear card lies almost flat (~84°), each step closer rotates more
upright, the front card is level (0°) and face-on. On exit a card continues _past_
upright into a face-down tumble (`rotX → -88°`) while dropping down + toward the lens.

| slot      | role    | rotX    | what it is                                              |
| --------- | ------- | ------- | ------------------------------------------------------- |
| `far`     | back    | 84°     | a card just entered the column (invisible, opacity 0)   |
| `s3`→`s1` | depth   | 66°→22° | the rolling-forward column (opacity ramps in)           |
| `s0`      | front   | 0°      | upright, face-on — **wipes in its solid face here**     |
| `exit`    | leaving | −88°    | tumbles forward + falls down + toward camera, fades out |

A card's pose is a pure function of how many slots it sits **behind the current front
card** (`poseForRel(rel)`), so the column stays correctly depth-sorted and **any card
count just works** (z-index is set instantly at each swap — CSS can't depth-sort
non-intersecting planes). The default deck is 6 cards over 6.0s.

## Timing (`beat_map` in `card.json` / `landings`)

Content lives in `cards`; musical **timing** lives in `landings` — **one beat per card**,
absolute audio seconds. The default schedule `[0.40, 1.70, 2.70, 3.45, 4.00, 4.40]`
**accelerates** (gaps `1.30 → 1.00 → 0.75 → 0.55 → 0.40`); the final card lands early
enough to hold ~1.6s before the cut. Each landing tween **leads its beat** by its own
duration (`dur_i = clamp(0.32 · gap_into_i, 0.12, 0.42)`) so the card arrives _on_ the
hit; the face wipe runs over the last ~85% of that window.

Omit `landings` and an accelerating schedule is **auto-derived** from the card count +
duration (geometric ~0.78× gap decay) — so a 3- or 9-card deck cascades correctly with
no hand timing.

## Themes (the look knob)

`theme` picks a **cohesive palette** — one temperature/saturation family, so any card
count reads as a _designed_ set (the deck cycles the ramp in order; each face also gets a
gentle top→bottom tonal gradient for depth). White-on-card stays AA at the card type
sizes. Set `theme` and you have a whole new look in one knob.

| `theme`              | family                                                                |
| -------------------- | --------------------------------------------------------------------- |
| `aurora` _(default)_ | cool jewel arc — teal → ocean → indigo → violet → plum, on blue-black |
| `ember`              | warm sunset arc — wine → brick → rust → amber → ochre → bronze        |
| `mono`               | sleek monochrome blue staircase (dark → mid)                          |
| `slate`              | muted cool slate-grays — understated / editorial                      |

Add a palette by appending to the `THEMES` table in `index.html` (`bg` + `ink` + a
`colors[]` ramp).

## Parameters (swap freely)

- `theme` — palette preset: `aurora` | `ember` | `mono` | `slate` (default `aurora`).
- `bgColor` — override the radial field base. Empty → the theme's bg.
- `cards` — **JSON array** of `{ title, color? }`; `title` is the big centered hero (the
  only copy on each card). Its length sets the deck depth. `color` is **optional** — omit
  it and the card takes the next color from the theme ramp (cohesive by default); set it
  to override one card. Empty → the built-in 6-card demo deck. (See `program.json`.)
- `landings` — **JSON array** of land beats (abs seconds), one per card. Empty → derived.
- `yaw` — static scene side-tilt in degrees (default `−12`; `0` = face-on).

Fill them with `--variables` (read inside the comp via `window.__hyperframes.getVariables()`):

```bash
npx hyperframes render card-flyby -f 30 --strict-variables \
  --variables '{"theme":"ember","cards":"[{\"title\":\"BLACKOUT\"},{\"title\":\"THE HEIST\"}]","yaw":-8}'
```

## Match (when the Director should reach for it)

`structural_type: per_onset_sequential` — a **stream of discrete onsets that
accelerate** (a build into a downbeat) where you want to flash a **sequence of whole
cards** (titles / projects / posters / video tiles), one per hit, climaxing on a held
card. Discriminated from the typewriter / logo-sting `per_onset_sequential` templates by
revealing **whole cards** (not letters/words of one message) and by the **accelerating
cadence**. Put the card you want held longest on the strongest final hit. If the grid
goes quiet (`onset_gap_bars ≥ ~1.5`) this is the wrong template — use a hold template.

> Candidate finer `structural_type`: an `accel-roll` flavor of `roll_cascade` (the
> shrinking-dwell build) — flagged in `card.json` for catalog review, not yet a vocab
> value. Proposed motion verbs `deck_advance` / `wipe_reveal` / `tumble_fall` are
> likewise flagged.

## Verify

```bash
npx hyperframes lint     card-flyby   # clean (1 inherent window.__timelines note)
npx hyperframes validate card-flyby   # no console errors · text passes WCAG AA
npx hyperframes render   card-flyby -f 30
```

## Status

`promoted` — in the catalog, matchable by the Director. Because it is sandbox-origin (no
golden-sample provenance), the next reviewer pass should attach a **real reversed group**
as an `examples[]` entry and tighten `match.requires` against it.
