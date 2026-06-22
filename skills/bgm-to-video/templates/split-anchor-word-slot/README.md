# Split-Anchor Word-Slot · 5 beat-synced operators

> Reverse-engineered from **group_6** of the golden sample (the "studio contre courant" kinetic-type scene).
> `structural_type: per_onset_sequential` · status: **draft**

**ONE base lockup, FIVE operators.** The base is a kinetic-typography **lockup**: a
**held left anchor column** of `R` rows (fixed words) beside a **torn-paper word-SLOT
box** on the right. `R` is data (the `anchors` comma-list length) — pass 2, 3, or 4
words and the geometry follows. Asset-free: just text + colored boxes. Five
interchangeable, beat-synced operators act on that one lockup:

| op         | what it does                                                                                                                    | what moves                        | source span                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| **lockup** | pop the `R` left anchor words in one-per-beat → reveal the empty slot box                                                       | per-word pop-in + box scale-in    | 0.13–0.50s (f3–f12)                        |
| **slot**   | swap a word-GROUP into the box: lines slide in per beat → hold → slide out (omit `exit` to hold). per-line color via `colors[]` | per-line textContent + slide/fade | 1.0–1.83s (f24–f44) & 2.04–2.75s (f49–f66) |
| **bg**     | flip the WHOLE scene to another theme on a beat (bg + anchor ink + box fill + slot ink invert, 0ms)                             | colors of root/box/anchors/lines  | f83 (blue→green)                           |
| **shake**  | global per-beat jitter of the whole lockup (x/y + rotation), one jolt per beat                                                  | transform of `#lockup`            | 2.16–4.18s (f52–f100)                      |
| **expand** | EXIT wipe: fade text → zoom the slot box until it fills the frame                                                               | text fade + box scale→30×         | 4.30–4.79s (f100–f114)                     |

```
group_6_template/
  index.html   ← asset-free reference impl: lockup + 5 operators + program runner
  program.json ← the default group_6 score as standalone, agent-editable DATA
  card.json    ← the spec: base template, operators, program_format, match signature
  assets/gsap.min.js   ← vendored (offline-safe lint/validate/render)
  renders/     ← group_6_recreate(.mp4 / _audio.mp4) + custom_demo.mp4
  README.md    ← this file
```

This answers the brief directly: **the fixed structure is a template; the content is
data.** Different words compose into the same lockup; the row count and the number of
background flips are program parameters; every move is keyed to a beat, so a new track
matches by swapping the beat numbers.

---

## 1. How it beat-syncs (from `../audiomap.json`)

**Nothing is on a timer.** Every move is a GSAP tween/`set` at an absolute audio second
from the analysis. Track facts: **~92 BPM**, 4/4, downbeats **2.322 (f56) / 4.923
(f118)**, a **sustained hihat fill 2.16–4.18s (f52–f100, 14 hits)**. The beat tracker is
only confident after 2.3s (the front is a VOID lead-in), so the early anchor pops ride
the onset list, not the grid.

The score is the **PROGRAM** — a data array of operator steps
([`program.json`](program.json), mirrored inline as `DEFAULT_PROGRAM` in §3 of
`index.html`):

```jsonc
[
  { "op": "lockup", "enter": [0.125, 0.333, 0.5], "box": 0.292, "theme": 0 }, // name locks in
  {
    "op": "slot",
    "words": ["I bring", "ideas", "to life"], // group 1 in→out
    "enter": [1.0, 1.167, 1.292],
    "exit": [1.667, 1.75, 1.833],
  },
  {
    "op": "slot",
    "words": ["you", "wanna", "see?"], // group 2, colored
    "enter": [2.042, 2.208, 2.375],
    "exit": [2.75, 2.75, 2.75],
    "colors": [0, 1, 1],
  },
  {
    "op": "shake",
    "amp": 15,
    "rot": 1.7,
    "settle": 0.13, // ride the hihat fill
    "beats": [2.16, 2.3, 2.44, 2.62, 2.76, 2.88, 3.06, 3.27, 3.41, 3.53, 3.71, 3.85, 4.09, 4.18],
  },
  { "op": "bg", "at": 3.458, "theme": 1 }, // blue → green (f83)
  { "op": "expand", "fade": 4.3, "at": 4.667, "to": 4.792 }, // zoom-wipe into f118
]
```

**Rule of thumb:** structure (the lock-in, the palette flip, the zoom-wipe) leans on the
strong downbeats; texture (per-word slot pops, the shake) rides the dense onset stream in
between.

---

## 2. Why _this beat_ → _this template_ (the matching intuition)

Reach for the anchor-slot lockup when the audiomap shows:

1. **A held idea + a stream of discrete onsets** — something to anchor on the left (a
   name / brand) and a hit for every word you pop on the right (`onset_gap_bars ≤ 1`).
2. **A dense run (roll / hihat fill)** to ride a **shake** on — group_6's f52–f100 fill
   is exactly the "jitter the whole thing" stretch.
3. **A strong downbeat to wipe out into** — the **expand** zoom lands its black-out one
   beat _before_ the f118 downbeat kick, so the next group "punches" in on the beat.
4. **Optional: one or two key hits to invert the palette** — schedule a `bg` flip on each.

Put plainly: **"a held name + per-onset words + one roll + a downbeat exit"** is the
fingerprint.

---

## 3. Usage

### Render with defaults (the group_6 recreation)

```bash
cd group_6_template
npx hyperframes lint . && npx hyperframes validate .
npx hyperframes render . -f 24 -o renders/group_6_recreate.mp4
# beat-matched proof (mux the original BGM):
ffmpeg -y -i renders/group_6_recreate.mp4 -i ../group_6.wav -c:v copy -c:a aac -shortest renders/group_6_recreate_audio.mp4
```

### Change the words (content only — no code edit)

```bash
# 2-row lockup, different phrase
npx hyperframes render . --variables '{
  "anchors": "make,it",
  "program": "[{\"op\":\"lockup\",\"enter\":[0.1,0.4],\"box\":0.3},{\"op\":\"slot\",\"words\":[\"move\",\"fast\"],\"enter\":[1.0,1.3],\"exit\":[1.9,1.9]},{\"op\":\"expand\",\"fade\":2.2,\"at\":2.5,\"to\":2.7}]"
}'
```

- **anchors** is a comma list — one word per row. Its length sets `R` (rows): 2 / 3 / 4.
- The slot box auto-sizes to the widest word-group; the slot operator distributes any
  word count across its `enter` / `exit` beat lists.
- **showText:false** hides all glyphs for a pure block/box look.

### Background changes once or twice (a parameter, on the beat)

```bash
# change TWICE: blue → green at 2.0s, green → ink at 3.6s
npx hyperframes render . --variables '{"program":"[{\"op\":\"lockup\",\"enter\":[0.1,0.3,0.5]},{\"op\":\"bg\",\"at\":2.0,\"theme\":1},{\"op\":\"bg\",\"at\":3.6,\"theme\":2},{\"op\":\"expand\",\"fade\":4.5,\"at\":4.8,\"to\":5.0}]"}'
```

`bg` is just another step — schedule **zero, one, or two** of them on whatever beats the
music gives you.

### Recompose freely — compose by DATA, not code (the whole point)

The five operators (`lockup`, `slot`, `bg`, `shake`, `expand`) are **pure, parameterized
functions** that write tweens at absolute audio seconds onto one shared timeline. They
are **order-independent and may overlap** (the `shake` runs _under_ the slot cycles and
the bg flip). What runs — on which beats — is the **PROGRAM** (a `{op, ...beats}` array).
So you recompose **without touching operator code**:

```bash
# Repeat the slot op three times (three word-groups), no shake, no bg flip
npx hyperframes render . --variables '{"program":"[{\"op\":\"lockup\",\"enter\":[0.1,0.3,0.5]},{\"op\":\"slot\",\"words\":[\"one\",\"two\",\"three\"],\"enter\":[1.0,1.2,1.4],\"exit\":[1.8,1.8,1.8]},{\"op\":\"slot\",\"words\":[\"four\",\"five\",\"six\"],\"enter\":[2.2,2.4,2.6],\"exit\":[3.0,3.0,3.0],\"colors\":[2,3,0]},{\"op\":\"slot\",\"words\":[\"seven\",\"eight\",\"nine\"],\"enter\":[3.4,3.6,3.8]},{\"op\":\"expand\",\"fade\":4.6,\"at\":4.9,\"to\":5.1}]"}'
```

Each step's fields are documented in [`card.json`](card.json) → `program_format`. An
agent composes by emitting this JSON (op names + beats) — it never edits JS.

> **Empty `program` = the built-in group_6 score.** Keep `program.json` and
> `DEFAULT_PROGRAM` in sync — `program.json` is the canonical, copy-pasteable data.

### Re-fit the beat to a different group (the part that changes per track)

Copy the new group's `audiomap.json` onset / downbeat seconds into the step beat lists.
Each list grows or shrinks freely — more onsets → more word pops; `beatAt()` distributes
any count across any beat list. For a longer / shorter piece set `DUR` and the root
`data-duration` to the new span. Add palettes to `THEMES`, accent colors to `ACCENTS`.

> **Deterministic / asset-free:** text + colored boxes only, no remote assets, no
> `Math.random` (shake uses a deterministic index hash), no timers. Lints clean,
> validates with no console errors.

---

## 4. Provenance

- **Source:** `bgm-golden-sample-reverse/gorup-by-group/group_6/group_6.mp4`
- **Audio:** `audiomap.json` (from `skills/bgm-to-video-new/scripts/analyze-beatgrid.py`)
- **Video read:** `group_6.gemini-analysis.md` (Gemini 3 Pro, 24fps) cross-checked by
  frame-by-frame contact sheets. Both agreed this is **kinetic typography, not an image
  grid** — left held `studio / contre / courant`; the right box cycled `I bring / ideas /
to life` then the colored `you / wanna / see?`; a one-frame blue→green palette flip at
  f83; a global shake riding the f52–f100 hihat fill; and a box zoom-wipe to black at
  f112–f114 leading into the f118 downbeat.
- **Corrections to the original read:** it is the **right slot box** (not a "left box")
  that zooms out, and the text is **masked / faded** under the zoom, not a soft dissolve.

### Tuning pass — Gemini 24fps side-by-side (`renders/sidebyside_*`)

A second pass rendered the recreate, stacked it beside the source (`renders/sidebyside_src-vs-recreate_v3.mp4`), and had Gemini 3 Pro grade the diff frame-by-frame
(`renders/sidebyside_v3.gemini-analysis.md`). The source reads as **acid/brutalist
collage with strong physical inertia**; v1 read as flat/linear UI motion. Applied:

1. **Constant lean** — the whole lockup rests at `BASE_TILT -3.5°`, the slot box leans
   `+2.6°` more. The source is never axis-aligned.
2. **Punchy easing + faux motion-blur** — slot words WHIP in from the right on `expo.out`
   with a `scaleX` stretch (1.6→1) that fakes horizontal motion blur; exit arcs down-left
   on `power3.in`. (Was a uniform, mechanical slide.)
3. **Faux-extended type** — inner `.t` span at `scaleX(1.12)` + weight 900 + tight
   tracking approximates a Druk-Wide / Monument-Extended face, asset-free. Bigger size,
   raised position (the lockup sits high-center).
4. **Per-line torn TAPES (not one box)** — this was the biggest "soul" gap (flagged in
   both Gemini passes + frame inspection). Each slot line is now its **own tape**: a
   white card sized to _its_ word (kills the dead space a shared box left behind narrow
   lines), with its own micro-rotation, a stair `margin-left` offset, a torn `clip-path`,
   and a drop shadow → a brutalist tape collage. The backing `#slotbox` is transparent
   during word phases (tapes sit straight on the colour field), and `bg` turns it into a
   solid torn card for the empty state + the expand zoom target.
5. **Brighter palette** — electric azure `#0a84ff` + lime/acid green `#5cf03a`.
6. **Stronger shake** — `amp 26px · rot 2.4° · back.out(3)` recoil around the base tilt.
   (Verified rendering by diffing adjacent shake-window frames — Gemini's v3 claim that
   the recreate was "static" was a low-res / anchoring misread.)
7. **Two-stage expand** — stage A grows the torn mass to ~half-frame (decelerating,
   `power2.out`) so the swell is _visible_ like the source (its mass is still only
   ~half-frame at f113); stage B then swallows the frame (`power2.in` + blur) and flattens
   to the solid black-out at ~f115, one beat before the f118 downbeat. (A single big-scale
   tween covered the frame far too early, because a large rest box hits full cover at a low
   scale.)

### Fix pass — review of the rendered cut

Three concrete defects spotted on playback, all fixed:

1. **Slot box covered the held words** (`courant`→`couran`, `make`→`mak`). Root cause: the
   faux-extend `scaleX` does **not** change an element's _layout_ width, so (a) the anchor
   glyphs rendered 12% wider than their layout box and overflowed RIGHT under the box, and
   (b) the slot tapes (GSAP `scaleX` from centre) bled 6% LEFT back over the anchors — the
   two overflows collided in the gap. Fixed three ways: anchors are **left-aligned** with
   each row's width **pinned to its measured scaled width** (`getBoundingClientRect`), the
   slot tapes scale from **`transform-origin: 0% 50%`** (rightward only). With the overflow
   tamed, `#slotbox margin-left` is the **press knob**: a small **negative** value (`-0.12em`)
   gives the source's tight collage TUCK — the tapes lightly press the tail of the longest
   anchor (`courant`'s `t` sits right at the tape edge) while every glyph stays legible. Use
   `0` for a clean kiss, more negative for a heavier tuck (too negative = white-on-white over
   the glyph; a tape with a contrasting `boxInk` can press further).
2. **Slot words overflowed their tape** (`bring`→`brin`) — the faux-extend `scaleX(1.12)`
   stretched only the text, not the tape background. Fixed: slot tapes carry the extend on
   the **line's GSAP `scaleX`** (the background stretches _with_ the text), `.sline .t` is
   reset to `scaleX(1)`, plus more right padding — the word always fits the strip.
3. **Final box was one clean block** — it should be a torn **collage of stacked, offset
   rectangles**. Fixed: the box is now **three sibling `.card` layers** (each its own
   offset + rotation + torn `clip-path`); they're transparent during word phases and turn
   black for the empty box + the expand zoom, scaling as one while staying staggered.

- **Open questions for promotion:** (1) expose `tear` (clip-path roughness), `tilt` /
  `boxTilt`, and the per-line stair offsets as params; (2) bundle a real Extended-Black
  font under `assets/` for an exact type match (currently faked with `scaleX`); (3) `shake`
  could auto-derive `beats` from the overlapping `rolls[]` span; (4) real motion blur isn't
  available in-engine — the `scaleX` squash + expand `blur()` only approximate it; (5) the
  source briefly shows an empty WHITE box before the first words / between groups — the
  per-line-tape model drops that (the colour field is bare until a tape whips in), a minor
  trade for killing the dead space.
