# GroupSignature — the shared schema (linchpin)

One schema, three producers:

- the **Music Reader** emits one `GroupSignature` per **section** (over its whole span);
- the **Director** derives one per **group** when it subdivides a section;
- a **template's match-face** declares which `GroupSignature`s it fits.

Because all speak this vocabulary, matching a group to a template is mechanical. **Do not
let them drift.** Every field here is derived from `audiomap.json` (fact) — never invented
— so it holds at runtime with no video.

## Two levels: sections → groups

Segmentation is split across two stages by who knows what:

1. **Sections** (Music Reader, catalog-blind) — the musical macro-structure: runs of one
   gesture, snapped to real state-changes. Each section is a full `GroupSignature` over its
   whole span **plus** a `cut_candidates[]` menu — the musically-legal internal anchors a
   finer cut could land on. The Music Reader does **not** decide how many groups a section
   becomes.
2. **Groups** (Director, catalog-aware) — the treatment units a template actually binds to.
   The Director subdivides each section by acting on zero or more of its `cut_candidates`,
   because the right granularity depends on template native spans only it can see. A
   section kept whole is one group (== itself); a long / multi-gesture section becomes
   several. The Director derives each group's `GroupSignature` over its own slice.

`sections[]` (in `music-read.json`) tile the **whole track** (first at 0, last at
`duration_s`, no gaps/overlaps). The Director's `groups[]` (in `visual-plan.json`) tile it
too; every group carries the `section_id` it came from, and a section's groups tile that
section's span.

A **template matches a `group`** (which may be a whole section) — the match-face below is
unchanged. **Multiple templates inside one section are fine** (the brand spine unifies
them, not template reuse).

```jsonc
"sections": [
  {
    // a GroupSignature over the whole section span (every field below) + a cut menu
    "id": "s1",
    "span_sec": [19.412, 30.0], // [start,end], snapped to AudioMap anchors (re-snapped to nearest beat)
    "structural_type": "per_onset_sequential",
    "mood": ["dark", "cinematic"],
    // …all other GroupSignature fields, derived over the whole span…
    "cut_candidates": [
      // musically-legal internal cut points the Director MAY use; empty for a single
      // gesture; NEVER inside a rolls[] run; never leaving a sub-1-bar fragment.
      { "time": 23.963, "kind": "hard_stop", "strength": "strong" },
      { "time": 26.215, "kind": "surge", "strength": "strong" },
    ],
  },
]
```

## The object

```jsonc
{
  "id": "g1", // group id within the track
  "section_id": "s1", // the section this group lives in (its groups tile the section span)
  "span_sec": [0.0, 4.017], // [start, end], snapped to AudioMap anchors
  "span_bars": 2, // length in bars (rounded)

  "structural_type": "sustained_hold", // controlled vocab — see rubric below
  "mood": ["warm", "cinematic"], // controlled vocab, 1–3 tags

  // ── objective audio facts (straight from audiomap) ──
  "energy_level": "HIGH", // VOID | LOW | MEDIUM | HIGH (dominant phase)
  "energy": 0.8, // 0–1, mean of the dominant phase
  "density": "sparse", // sparse | medium | dense (audiomap fact)
  "onset_rate": 1.0, // onsets / sec over the span
  "onset_gap_bars": 2.05, // longest onset desert, in bars (key discriminator)
  "has_steady_grid": true, // stable bpm + ≥2 downbeats present
  "bpm": 129.2,

  // ── roll lane (from audiomap rolls[] overlapping the span; false/null if none) ──
  "has_roll": false, // any rolls[] entry overlaps the group
  "roll_kind": null, // dominant roll kind: fill | accel-roll | sustained-fill
  "roll_rate_per_min": 0, // hits/min of the dominant (longest) overlapping roll
  "roll_count": 0, // rolls[] entries overlapping the span

  // ── boundaries ──
  "entry": { "anchor": "downbeat", "time": 0.093 },
  "exit_trigger": { "type": "first_onset_reentry", "time": 4.017 },
}
```

## Field derivation (from audiomap — make this automatic)

| field                             | how to compute                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `span_sec`                        | the group's [start,end]; snap each to nearest `downbeats_sec` / `hard_stops` / `phrase` edge |
| `span_bars`                       | `round((end-start) / bar_dur)`, where `bar_dur = beats_per_bar * 60/bpm`                     |
| `energy_level` / `energy`         | the `energy_phases[]` block covering most of the span → its `level` / `energy`               |
| `density`                         | dominant `energy_phases[].density` over the span                                             |
| `onset_rate`                      | `count(events in span) / (end-start)`                                                        |
| `onset_gap_bars`                  | `max gap between consecutive events[].t inside the span` ÷ `bar_dur`                         |
| `has_steady_grid`                 | `tempo.n_bars >= 2` and bpm stable                                                           |
| `has_roll` / `roll_count`         | any / count of `rolls[]` overlapping the span                                                |
| `roll_kind` / `roll_rate_per_min` | `kind` / `rate_per_min` of the dominant (longest) overlapping roll                           |
| `entry`                           | first anchor at/after `start` (prefer `downbeat`)                                            |
| `exit_trigger`                    | see exit-trigger rule below                                                                  |

Worked example (group_1): max onset gap `3.971 − 0.163 = 3.808s`; `bar_dur =
4·(60/129.2) = 1.858s`; `onset_gap_bars = 3.808/1.858 = 2.05`. ✓

## exit_trigger rule (also the group boundary)

Pick the first that applies, snap its time to the nearest downbeat:

1. longest onset gap ≥ ~1.5 bars **and** an onset follows it → `first_onset_reentry`
   (the held section ends when rhythm re-enters — group_1).
2. a terminal `hard_stops[]` in the span → `hard_stop`.
3. a `SURGE` into a denser phase at the end → `surge`.
4. otherwise → `downbeat` (next bar) or `end` (track end).

> Per decision #2: the Music Reader proposes the boundary; when a chosen template's
> stop rule disagrees, the **Director reconciles** to the nearest AudioMap anchor.
> They rarely conflict because both come from these same facts.

## Controlled vocabularies (SEED — grows as we reverse)

These lists are the dictionary both sides must use. Adding a value is a deliberate
catalog change, not an ad-hoc string.

### `structural_type`

| value                  | the music                                                   | seen in            |
| ---------------------- | ----------------------------------------------------------- | ------------------ |
| `sustained_hold`       | energy present but few/no onsets — a held pad/riser         | group_1            |
| `per_onset_sequential` | discrete onsets drive one reveal each (typing/word-by-word) | group_2 (expected) |
| `roll_cascade`         | a `rolls[]` run → continuous cascade / multiply             | —                  |
| `dense_multiply`       | HIGH + dense, no single message → field/grid/strobe         | —                  |
| `void_breath`          | VOID / silence dominant → clear & hold                      | —                  |
| `hard_stop_freeze`     | terminal hard stop → freeze to negative space               | —                  |
| `drop_regime_change`   | SURGE into dense → system replace                           | —                  |

> `dense_multiply` is currently a **broad bucket** — three promoted templates live under
> it (`roll-flipbook-word-cycle`, `held-text-strobe-burst`, `poster-tile-mosaic`),
> disambiguated by their `match.requires` (a fast `sustained-fill` roll vs a tiny
> `onset_gap_bars` strobe vs a tessellating tile program). Candidate future subtypes:
> `held_strobe`, `tile_mosaic_program`. Split them out when a 4th example forces it.

### `structural_type` classification rubric (decision tree)

Run top-down, first match wins:

1. VOID dominant & `onset_rate ≈ 0` → `void_breath`
2. terminal `hard_stop` + freeze, little after → `hard_stop_freeze`
3. `rolls[]` spans most of the group → `roll_cascade`
4. `energy_level ≥ MEDIUM` & `density == sparse` & `onset_gap_bars ≥ 1.5` → `sustained_hold`
5. `density == dense` & `energy_level == HIGH` & no dominant readable mark → `dense_multiply`
6. onsets present, discrete, each plausibly one reveal → `per_onset_sequential`
7. `SURGE` into a denser phase → `drop_regime_change`
8. none fit cleanly → leave `structural_type: "unclassified"` and flag for a NEW type.

### `mood` (1–3 tags)

`warm` · `dark` · `hype` · `elegant` · `glitch` · `cinematic` · `playful` · `tense` ·
`dreamy` · `aggressive`. Derive from `energy_phases[].feel` (warm/heavy/bright/sparse)

- energy + the Gemini read's genre cues.

### `exit_trigger.type`

`first_onset_reentry` · `hard_stop` · `surge` · `downbeat` · `end`.

### role kinds (used by templates, see template-definition.md)

`message` (readable text) · `background` (field/texture) · `camera` · `asset` ·
`overlay` (grain/vignette/chrome).

### motion verbs (per role; each maps to an L0 primitive or a custom phrase)

`freeze_after_reveal` · `energy_envelope_breath` · `per_onset_pop` · `cascade` ·
`strobe` · `camera_push` · `hold` · `font_shuffle` (cycle typefaces on the beat) ·
`flipbook` (0ms word/glyph swap per 16th over a roll) · `scramble_decode` (scrambled →
locked phrase). Link the L0 id in the template's `uses_primitives`; a verb with no L0 id
is a custom phrase the impl defines.

> **Meta-templates** (a base + a program of beat-synced _operations_, e.g.
> `poster-tile-mosaic`) may declare an `operations` / `engine` block instead of role
> `motion` verbs — see template-definition.md extension fields.

## Self-check

- Every field traces to an `audiomap.json` value or a span of it.
- `structural_type`, `mood`, `exit_trigger.type`, role kinds, motion verbs are all from
  the controlled vocab (or explicitly flagged as a proposed new value).
- `sections[]` (music-read) and the Director's `groups[]` (visual-plan) each tile the whole
  track; every group's `section_id` names an existing section; a section's groups tile its
  `span_sec`.
- The same object validates whether it came from the Music Reader (a section), the Director
  (a group), or a template example.
