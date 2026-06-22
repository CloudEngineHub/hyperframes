# Visual Plan Contract (template-driven)

The Director writes `visual-plan.json`. It is a build spec, not code. Unlike the
scene-based plan, this one is **group-driven**: the Director **creates the groups** by
subdividing each `music-read.json` section at its `cut_candidates` (catalog-aware — see
director.md), then writes one entry per group, each either bound to a **promoted Group
Template** or **free-composed**, plus the group→group transitions.

## Output shape

```jsonc
{
  "compositionId": "bgm",
  "duration_s": 7.198, // == audiomap.audio.duration_sec, exactly
  "canvas": { "w": 1920, "h": 1080, "fps": 30 },

  // ── brand spine: ONE identity across all groups, so different templates still read
  // as one piece. The Director sets this from the brief's mood. ──
  "style": {
    "name": "warm cinematic recap",
    "mood": "warm / cinematic",
    "palette": ["#040406", "#100a2e", "#d23b5e", "#ffd9c2", "#ffb27a"],
    "font": "system-safe stack or local @font-face",
    "texture": "grain / light-leak",
  },

  // echoed from music-read.json (the source sections + cut_candidates the Director split).
  // Groups that share a section may use DIFFERENT templates — no reuse rule; the brand
  // spine unifies them.
  "sections": [
    {
      "id": "s1",
      "span_sec": [0.0, 7.198],
      "structural_type": "sustained_hold",
      "mood": ["warm", "cinematic"],
    },
  ],

  "groups": [
    {
      "id": "g1",
      "section_id": "s1", // the section this group was cut from
      "span_sec": [0.0, 4.017], // Director-chosen: between cut_candidates (or the whole section), reconciled to the stop rule
      "structural_type": "sustained_hold",
      "mood": ["warm", "cinematic"],

      "templateRef": "held-message-living-field", // a promoted template id, or null

      // params = the template's composition-variables, filled. Keys MUST match the
      // template card's `params`. (Omitted when templateRef is null.)
      "params": {
        "kickerText": "PREVIOUSLY ON",
        "heroText": "DUCKLIFE",
        "palette": {
          "bgColor": "#040406",
          "colorLow": "#100a2e",
          "colorMid": "#d23b5e",
          "colorHigh": "#ffd9c2",
          "accentColor": "#ffb27a",
        },
        "flowSpeed": 1,
        "duration": 4.017,
      },

      // bind each template role to this group's real anchors (absolute audio seconds)
      "role_bindings": {
        "message": { "reveal_at": 0.093, "motion": "freeze_after_reveal" },
        "field": { "drive": "energy_envelope", "surge_at": 1.0 },
      },

      // when templateRef is null, describe the free composition instead (uses L0):
      "free_design": null,
      // e.g. { "dominant_system": "per-onset typography", "layout": "...",
      //        "primitives": ["content_swap","scale_punch"], "density_topology": "accumulate" }
    },
  ],

  "transitions": [
    { "from": "g1", "to": "g2", "transition": "fast_cut", "at": 4.017 }, // default fast_cut
  ],

  // the Director owns the words (see Copy rules). Texture vs message decided per item.
  "copy": {
    "headline": "DUCKLIFE",
    "kickers": ["PREVIOUSLY ON"],
    "taglineWords": [],
    "keywords": [],
    "ctaWords": [],
    "logo": null,
  },

  "build_notes": ["one paused GSAP timeline", "no remote assets", "grain over every group"],
  "avoid": ["generic slideshow", "tiny unreadable hero text"],
}
```

Required fields: `compositionId`, `duration_s`, `canvas`, `style`, `groups[]`,
`transitions[]`, `copy`, `build_notes[]`. Echo `sections[]` from music-read for
traceability; each group carries its `section_id`.

## Group rules

- **The Director creates groups by subdividing sections** (director.md): each group's
  `span_sec` runs between chosen `cut_candidates` (or is the whole section), then is
  **reconciled** to the chosen template's stop rule (snap to the nearest AudioMap anchor —
  decision #2). Groups are in audio order; adjacent `span_sec` tile the timeline with no
  gaps/overlaps; the last ends at `duration_s`; no group is < ~1 bar.
- **Each group carries its `section_id`** (the section it was cut from). Groups that share a
  section may use **different templates** — match each independently; cohesion comes from
  the brand spine, not template reuse.
- **Every group is either `templateRef` (a promoted id) or `free_design`** — never both,
  never neither.
- **`params` keys must match the referenced card's `params`** exactly, so the Builder can
  pass them straight to the reference impl's composition-variables.
- **`role_bindings` use real anchor seconds** from this group's slice of the AudioMap, not
  the template's example times.

## Matching (how the Director picks a template — see template-definition.md)

For each group: keep promoted cards where `card.match.structural_type == group.structural_type`
**and** the group's `GroupSignature` satisfies every `card.match.requires` predicate
**and** `mood` overlaps `card.match.mood_fit`. Rank survivors by signature closeness /
example count; take the top. If none survive → `templateRef:null` + `free_design`
(compose from `motion-primitives.md`, one thesis for the group).

## Transitions

One entry per adjacent pair. **`transition` is always `"fast_cut"` for now**
(decision #4) — a 0ms hard cut at `at` (the boundary, = the earlier group's
`exit_trigger` time, snapped). The catalog interface allows richer transitions later; do
not emit them yet.

## Copy rules (Director owns the words)

- Keep any exact words the user supplied; otherwise invent with taste, on the brief's mood.
- **Message vs texture:** a word that must be read holds ≥1 beat, stable and focal; a word
  held <1 beat is texture (strobe/ticks). Never force a message onto a sub-beat.
- Copy fills template `params` (or, for free groups, rides the group's anchors). Do not
  hand-place every word's millisecond — declare the anchor + accumulate/stagger intent and
  leave micro-timing to the Builder.

## Brand spine

One type family, a ≤4–6 swatch palette, ≤2 accents per frame, applied across every group.
Different templates per group are fine — the spine is what unifies them.

## Self-check

- `duration_s == audiomap.audio.duration_sec`; groups tile it exactly; no group < ~1 bar;
  no group boundary lands inside a `rolls[]` run.
- Each group carries a `section_id` present in `sections[]`; its `span_sec` came from that
  section's `cut_candidates` (or is the whole section); groups in one section may use
  different templates.
- Every group resolves to a promoted `templateRef` **or** a `free_design`.
- Every `templateRef` exists under `templates/` and its `match.requires` is satisfied by
  the group's signature.
- `params` keys == the card's `params`; `role_bindings` use real AudioMap seconds.
- One `transitions[]` entry per boundary, all `fast_cut`.
