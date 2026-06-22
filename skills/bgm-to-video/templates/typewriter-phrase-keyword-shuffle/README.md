# Typewriter Phrase / Keyword Font-Shuffle

> Reverse-engineered from **group_2** of the golden sample (the "growth through creativity." scene).
> `structural_type: per_onset_sequential` · status: **draft**

Words type in **one-per-onset** to spell a short phrase; then **one keyword** cycles
through a library of typefaces **on the beat** while the rest of the line holds dead
still. Background is pure black (the original's glitch field is an optional add-on role).

```
templates/typewriter-phrase-keyword-shuffle/
  index.html   ← parameterized, asset-free reference impl (1 paused GSAP timeline)
  card.json    ← the spec: match-face + build-face
  README.md    ← this file
```

---

## 1. How it beat-syncs (from `group_2.audiomap.json`)

The whole scene is nailed to the audiomap. **Nothing is on a timer** — every move is a
GSAP tween/`set` at an absolute audio-second taken straight from the analysis.

Track facts: **BPM 129.2**, 4/4, `bar_dur = 4·(60/129.2) = 1.858s`. Every move rides a
**hi-hat onset** from `audiomap.events[]` (this scene is the quiet pre-drop build — low
energy, but the hats tick continuously).

### Phase A — spell-out (typewriter, accumulating)

One word pops in per onset and **stays** (it does not replace the previous word):

| visual                        | audiomap anchor  | `audiomap` field |
| ----------------------------- | ---------------- | ---------------- |
| `growth` pops                 | **0.557s** hihat | `events[1].t`    |
| `through` pops                | **0.906s** hihat | `events[2].t`    |
| `creativity` pops (base face) | **1.231s** hihat | `events[3].t`    |
| orange `.` punches in         | **1.440s** hihat | `events[4].t`    |

→ in the impl: `LEAD_ONSETS = [0.557, 0.906]`, `KEY_ONSET = 1.231`, `PERIOD_ONSET = 1.440`.
Each is a `fromTo(autoAlpha 0→1, scale .92→1)` ~100ms reactive pop landing on the onset.

### Phase B — keyword font-shuffle (on the beat, 0ms hard swaps)

Once the phrase is set, **only `creativity`** changes — it flips typeface on each
following onset; `growth through` and the `.` stay locked in the base face:

| visual                                  | audiomap anchor  | font preset |
| --------------------------------------- | ---------------- | ----------- |
| → upright serif                         | **1.904s** hihat | `FONTS[1]`  |
| → heavy serif                           | **2.392s** hihat | `FONTS[2]`  |
| → italic serif                          | **2.624s** hihat | `FONTS[3]`  |
| → back to base bold sans, then **HOLD** | **3.088s** hihat | `FONTS[0]`  |

→ in the impl: `SHUFFLE = [{t,font}, …]`. Each row is a `tl.set(keyEl, fontProps(i), t)`
— **0ms**, because a font flip is a percussive hit (the contract's `content_swap` rule:
easing a hit kills it).

### Phase C — exit

Scene ends at **3.85s**, just before the **3.855s kick** (`events[11]`, the first
`MEDIUM`→`HIGH` SURGE / drop). The phrase locks; the drop is where the _next_ group's
regime change begins. `exit_trigger: surge` (snapped to downbeat `3.808`).

> **The rule of thumb:** structure (word entries, the final lock) leans on the strong
> grid; texture (the per-beat font flips) rides the syncopated hi-hats in between.

---

## 2. Why _this beat_ → _this template_ (the matching intuition)

This is the important part. When the Music Reader emits a `GroupSignature` and you (or
the Director) look at the audiomap, **these are the tells that should make you reach for
this template:**

1. **A steady grid is present.** `has_steady_grid: true` — stable BPM, ≥2 downbeats.
   Without a reliable grid you can't put one word per beat.
2. **The onset stream is CONTINUOUS, not a desert.** `onset_gap_bars: 0.28` (≪ 1 bar) —
   the hi-hats keep ticking ~every 0.3–0.5s. This is the single biggest discriminator.
   It means: _there is a hit available for every move you want to make_ — one per word on
   the way in, then one per font-flip after.
3. **Discrete, individually-placeable onsets.** Each `events[]` entry is a clean
   weak/syncopated hit → rubric step 6 → `per_onset_sequential`. Each onset can carry
   exactly one reveal.
4. **A run of onsets at the head you can map to words** (Phase A) **+ a continuing tick
   afterward** (Phase B). That two-part shape — _accumulate, then animate-in-place_ — is
   what this template is built around.
5. **It ends on a SURGE/drop** (or hard*stop). The build resolves into something bigger,
   so the scene's job is to \_fill the pre-drop bars with readable, rhythmic typography*.

Put plainly: **"steady grid + a continuous hi-hat stream + low-energy pre-drop build +
ends on a drop" is the fingerprint.** The moment you see that in the audiomap, this
template fits — you have a hit for every word and a hit for every font change.

### The contrast that makes it click

The exact same track, one group earlier (group_1), is the **opposite** signature and
wants the **opposite** template:

|                   | `held-message-living-field` (group_1) | `typewriter-phrase-keyword-shuffle` (group_2) |
| ----------------- | ------------------------------------- | --------------------------------------------- |
| `structural_type` | `sustained_hold`                      | `per_onset_sequential`                        |
| `onset_gap_bars`  | **≥ 1.5** (onset _desert_)            | **< 1.0** (continuous)                        |
| energy gate       | `energy_level ≥ MEDIUM`               | not gated (low is fine)                       |
| what moves        | the **background** (text frozen)      | the **text** (per onset / per beat)           |
| because…          | no onsets → nothing to hit → hold     | onsets everywhere → hit everything            |

So the decision is mechanical: **onset desert → hold the message; continuous onset
stream → type it / shuffle it.** Same `match.requires` predicates both sides read; see
`card.json`.

---

## 3. Usage

### Render with defaults (the group_2 recreation)

```bash
cd templates/typewriter-phrase-keyword-shuffle   # or this folder
npx hyperframes lint && npx hyperframes validate
npx hyperframes render -f 24 -o renders/out.mp4
```

### Change the words (content only — no code edit)

`params` are `data-composition-variables`; fill them with `--variables`:

```bash
npx hyperframes render --variables '{
  "lead1":"built",  "lead2":"for",  "lead3":"",
  "keyword":"speed", "periodChar":".",
  "accentColor":"#39e6a0"
}'
```

- **Lead words are 1–3 and optional.** Leave `lead2`/`lead3` empty to ship a 1- or
  2-word lead (`""` is skipped, the line rebuilds and re-centers automatically). The
  **keyword** is always the last, shuffling word.
- **`periodChar`** empty → no trailing accent dot.

### Re-fit the beat to a different group (the part that changes per track)

Content lives in `--variables`; **musical timing lives in the script** (`index.html`,
section `// 3. BEAT MAP`). When you reuse this template on a _new_ group, copy the new
group's `audiomap.json` numbers in:

```js
var LEAD_ONSETS  = [ … ];   // one events[].t per lead word, in order
var KEY_ONSET    = … ;      // events[].t where the keyword types in
var PERIOD_ONSET = … ;      // events[].t for the accent char (or remove)
var SHUFFLE = [             // one row per font-flip — add as MANY as the beat has
  { t: <events[].t or beats_sec[]>, font: <index into FONTS[]> },
  …
];
var DUR = <scene end, just before the next drop/hard_stop>;
```

**You can have more (or fewer) flips than group_2's four.** `SHUFFLE` is just a list —
add a row for every beat you want a change on. Re-use a `font` index to repeat a face,
or walk new indices for a longer cycle.

### Preset more fonts

The keyword cycles the **`FONTS[]` preset library** (top of the script). It ships **8**
offline-safe faces (bold sans · upright serif · heavy serif · italic serif · monospace ·
condensed sans · light sans-italic · bold serif-italic). `FONTS[0]` is the **base** face
shared with the lead words. Add entries freely — every `{ family, weight, style }` is
valid; `fontProps(i)` wraps the index so `SHUFFLE` can point anywhere. More beats →
preset more faces and walk through them.

> **Deterministic / asset-free:** only generic font stacks (no remote/Google fonts), no
> `Math.random`, no timers — every flip is keyed to an audio second, so it renders
> identically every time. See `references/builder-contract.md`.

---

## 4. Provenance

- **Source:** `bgm-golden-sample-reverse/gorup-by-group/group_2/group_2.mp4`
- **Audio:** `group_2.audiomap.json` (from `scripts/analyze-beatgrid.py`)
- **Video read:** `group_2_text-only.gemini-analysis.md` (Gemini 3 Pro) **corrected by
  frame-by-frame inspection** — the Gemini pass reported the keyword as static; pulling
  real frames at each onset proved it shuffles typeface. Trust frames over sparse
  sampling for per-frame detail.
- **Open question for promotion:** identify the _actual_ typefaces in the source if a
  pixel-exact match is wanted (this impl reproduces the _mechanism_ with generic faces),
  and decide whether to ship the glitch-field background as a second role.
