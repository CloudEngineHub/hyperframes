# Music Reader (template-driven) — classify only

Turn `audiomap.json` into `music-read.json`: cut the track into **sections** (musical
macro-structure), write a `GroupSignature` for each section, and list the musically-legal
**cut candidates** inside each (the internal anchors the Director _may_ subdivide on). You
**classify and surface facts**; you do not design, and **you do not decide group count** —
how finely a section is split is the Director's call, because only the Director sees the
template catalog.

You are not choosing visuals, copy, fonts, colors, layout, or motifs. You answer, per
section: _what kind of beat is this_, _what mood_, and _where could this legally be cut
finer_. Everything else is the Director's job.

## Inputs

- `audiomap.json` — factual music data.
- `references/signature-schema.md` — the `GroupSignature` schema + controlled vocab +
  derivation formulas + the `structural_type` classification rubric. **Read it first.**

## Output

Write exactly one valid JSON file to the requested path: `music-read.json`. No markdown,
no commentary.

```jsonc
{
  "duration_s": 7.198, // == audiomap.audio.duration_sec
  "bpm": 129.2,
  "one_line": "A held recap card that breaks into a per-onset typography hit.",
  "sections": [
    {
      // a section IS a GroupSignature over its whole span (so the Director can match it
      // as one group if it chooses not to subdivide) + the legal cut points inside it.
      "id": "s1",
      "span_sec": [0.0, 7.198], // snapped to AudioMap anchors; sections tile the track
      "structural_type": "per_onset_sequential", // the section's dominant archetype
      "mood": ["hype"],
      /* …every other GroupSignature field per references/signature-schema.md
         (energy_level, density, onset_rate, onset_gap_bars, has_roll, entry, exit_trigger, …),
         derived over the WHOLE section span … */
      "cut_candidates": [
        // internal anchors the Director MAY cut on — musically legal only. Empty for a
        // single-gesture section. NEVER a point inside a rolls[] run.
        { "time": 3.692, "kind": "key_moment", "strength": "strong" },
        { "time": 5.759, "kind": "phrase", "strength": "medium" },
      ],
    },
  ],
}
```

`sections[]` is an ordered list whose `span_sec` tile the whole track with no gaps or
overlaps (first starts at 0, last ends at `duration_s`). Each section is a full
`GroupSignature` (derived over its span) **plus** a `cut_candidates[]` menu. **There is no
`groups[]` here** — the Director creates groups in `visual-plan.json` by choosing which
cut candidates to act on.

## How to read (pipeline — run in order)

1. **Gestalt.** From `summary` / `tempo` / `audio.duration_sec` + the drum histogram +
   roll count, write the `one_line` and note the density arc.
2. **Segment into sections.** Walk `energy_phases[]` in order and split the track where the
   music genuinely changes state — at `hard_stops[]`, `SURGE`/`DROP` `key_moments`, the
   start/end of a `rolls[]` run, an **onset desert** (a long gap in `events[]`), or a big
   energy-level jump. Collapse adjacent phases that are really one gesture. Expect ~1–6
   sections; a short clip may be one. **Snap every boundary to an AudioMap anchor**
   (downbeat / hard_stop / phrase / key_moment / energy-phase edge), then **re-snap to the
   nearest `beats_sec`** (key_moments / energy-phase edges are 1-second-resolution facts;
   the beat grid is precise — tolerance ≤ ½ beat).
3. **Per section, build the `GroupSignature`** over the whole section span. Use the
   derivation table in `signature-schema.md` for every objective field (`energy_level`,
   `density`, `onset_rate`, `onset_gap_bars`, `has_steady_grid`, `span_bars`, `entry`),
   classify `structural_type` (rubric, top-down first-match; `unclassified` + a `note` if
   nothing fits), tag `mood` (1–3), and set `exit_trigger`. All from the audiomap — never
   invented.
4. **Per section, list `cut_candidates[]`** — the internal anchors the Director _may_ cut
   on. This is a **menu of musical facts, not a decision**: you do not pick how many groups,
   only where a cut would be legal.
   - **Include** each anchor that lies strictly inside the span: an internal `key_moment`
     (mini SURGE/DROP), a mid-section `hard_stop`, the edge of a partial `rolls[]` run, a
     `phrases[]` edge, or a clear onset-cluster gap (≥ ~1 bar between consecutive
     `events[]`). Tag each `{time, kind, strength}` and snap its `time` to the nearest beat.
   - **Exclude (illegal cuts):** any point **inside** a `rolls[]` run (a roll is one
     cascade), and any candidate that would leave a fragment **< ~1 bar**.
   - **Emit an empty list** for a single-gesture section (`void_breath` / `sustained_hold` /
     `hard_stop_freeze`) — it must never be subdivided.

> The Director reads the catalog (template native spans + what matches) and decides which
> of these candidates to act on; an unused candidate costs nothing. Detecting where a cut
> is _legal_ is musical (yours); deciding where a cut is _useful_ is catalog-aware (theirs).

## Worked example — a section + its cut candidates

Section `s_final` = `[19.412, 30.0]`, `per_onset_sequential`, ~4.6 bars @ 103.4 bpm, with
a `hard_stop` at ~24s and a `SURGE` at ~26s inside it. You emit it as **one section**
carrying its whole-span `GroupSignature` plus:

```jsonc
"cut_candidates": [
  { "time": 23.963, "kind": "hard_stop", "strength": "strong" }, // snapped to the downbeat
  { "time": 26.215, "kind": "surge", "strength": "strong" },
]
```

You do **not** decide whether this becomes 1, 2, or 3 groups. The Director may keep it
whole (if one template fits), or cut at one/both candidates (e.g. a per-onset opener + a
closing lockup) — that is its catalog-aware call.

## Section boundaries are proposals

You propose section `span_sec`; the Director may nudge a boundary to fit a chosen
template's stop rule, then reconcile to the nearest anchor (decision #2). Because both of
you derive from the same audiomap, this rarely moves anything — but write the most
defensible audio boundary, not a guess.

## Self-Check

- `duration_s == audiomap.audio.duration_sec`; `sections[].span_sec` tile it with no
  gap/overlap (first at 0, last at `duration_s`).
- Every section carries a full `GroupSignature` (every field traces to an audiomap value or
  a span of it) **plus** a `cut_candidates[]` list (possibly empty).
- Every `cut_candidates[].time` sits on an AudioMap anchor re-snapped to the nearest beat;
  none is inside a `rolls[]` run; none would leave a sub-1-bar fragment; single-gesture
  sections (`void_breath` / `sustained_hold` / `hard_stop_freeze`) have an empty list.
- `structural_type`, `mood`, `exit_trigger.type` are controlled-vocab (or `unclassified`
  with a note).
- **No `groups[]` and no group-count decision** anywhere — that is the Director's.
- No content, no fonts, no colors, no layout, no copy anywhere in the output.
