# Template definition — what a Group Template IS

A Group Template is a reverse-engineered, reusable archetype for **one whole group** of
a BGM track. It lives at `templates/<id>/` and has three parts:

```
templates/<id>/
  card.json     ← the spec: match-face + build-face (this doc)
  index.html    ← the reference implementation (parameterized, asset-free)
  README.md     ← human notes + provenance + the source frames
```

A card has **two faces**:

- **match-face** — small, structured, in `GroupSignature` vocab. The Director reads it
  to decide _does this template fit this group?_ Keep it concise (decision: simple).
- **build-face** — richer. Tells the Builder _how to realize it_: roles, fillable
  params, the reference impl, the primitives used, the exit transition.

## `card.json` schema

```jsonc
{
  // ── identity ──
  "id": "held-message-living-field",
  "name": "Held Message / Living Field",
  "one_line": "A readable mark held dead still over a soft, color-shifting blurred field.",
  "status": "draft", // draft (in reverse workspace) → promoted (in catalog)

  // ── MATCH FACE (GroupSignature predicates — see signature-schema.md) ──
  "match": {
    "structural_type": "sustained_hold",
    "requires": {
      // predicates over a group's GroupSignature
      "energy_level": ">=MEDIUM",
      "density": "sparse",
      "onset_gap_bars": ">=1.5",
      "has_steady_grid": true,
    },
    "mood_fit": ["warm", "dark", "elegant", "cinematic"],
    "span_bars": [2, 8], // typical extent
    "exit_trigger": ["first_onset_reentry", "hard_stop"],
  },

  // examples = real reversed groups this template was mined from. Auto-filled from each
  // sample's audiomap. More examples → more trustworthy `requires` thresholds.
  "examples": [
    {
      "sample": "bgm_test_2",
      "group": "g1",
      "bpm": 129.2,
      "energy": 0.8,
      "density": "sparse",
      "onset_gap_bars": 2.05,
      "span_sec": [0.0, 4.017],
    },
  ],

  // ── BUILD FACE ──
  "roles": {
    "message": {
      "kind": "message",
      "motion": "freeze_after_reveal", // reveal on entry, then dead still
      "anchor": "entry.downbeat",
      "notes": "readable ≥ whole span; no per-element motion (there are no onsets)",
    },
    "field": {
      "kind": "background",
      "motion": "energy_envelope_breath", // brightness/chroma track the energy envelope
      "anchor": "energy",
      "notes": "the ONLY thing moving; peaks at the SURGE; settles dark for the hold",
    },
    // optional: "camera", "asset", "overlay"
  },

  "params": {
    // fillable slots = composition-variables in index.html
    "text": { "type": "string", "maps_to": "message.content" },
    "palette": { "type": "object", "keys": ["bg", "colorLow", "colorMid", "colorHigh", "accent"] },
    "flowSpeed": { "type": "number", "default": 1 },
    "duration": { "type": "number", "from": "group.span_sec length" },
  },

  "reference_impl": "index.html",
  "uses_primitives": ["blur_resolve", "negative_space_hold", "chromatic_pressure"],

  // group→group exit. Default fast_cut for everything now (decision #4); the observed
  // transition is recorded for later.
  "transition_out": { "default": "fast_cut", "observed": "anticipation_glitch_cut" },

  // ── provenance ──
  "reversed_from": ["bgm-golden-sample-reverse/gorup-by-group/group_1"],
  "created": "fill at promotion time", // scripts can't call Date.now(); stamp by hand
}
```

### Required fields

`id`, `name`, `one_line`, `status`, `match` (`structural_type` + `requires` +
`mood_fit` + `exit_trigger`), `examples[]` (≥1), `roles` (≥1), `params`,
`reference_impl`, `transition_out`, `reversed_from`.

## Rules for each face

**match-face — keep it minimal.**

- `requires` predicates use simple operators: `">=X"`, `"<=X"`, `"==X"`, a literal, or a
  list (any-of). Only constrain fields that actually distinguish this template.
- Don't encode creative taste here — that's the build-face. The match-face answers one
  question: _does this group's signature fit?_

**build-face — whole-group, roles declared separately (decisions #1, #2).**

- One template covers the whole group (background + text together), but every moving
  thing is its own `role` with its own `motion` + `anchor`, so roles can be factored
  into composable role-templates later without rewriting cards.
- Each `role.motion` is a verb from the signature schema; each verb resolves to an L0
  primitive id listed in `uses_primitives` (or a custom phrase the Builder can implement).
- `params` are exactly the composition-variables the reference impl exposes (so the
  Builder fills them by passing `--variables`, no code edit needed for content/palette).

## Reference implementation (`index.html`)

- A HyperFrames composition (one paused GSAP timeline, deterministic, asset-free, passes
  `lint` + `validate`).
- Exposes `params` as `data-composition-variables` (text + palette + speed + duration).
- A template may **bundle local assets** under `assets/` when its look genuinely needs
  them (e.g. `held-text-strobe-burst` ships texture-mask PNGs + a local `gsap.min.js`).
  Local bundled assets are allowed; remote assets / remote fonts are not.

## Extension fields (allowed beyond the required set)

Cards may carry extra fields when a template needs them. Promoted examples use:

- `beat_map` — script-side musical timing constants the impl reads (onset / roll seconds,
  font / flip steps). Content lives in `params`; musical _timing_ lives here.
- `bundled_assets` — a note on what the impl ships under `assets/`.
- `base_template` / `operations` / `engine` / `program_format` / `program_data` —
  **meta-templates**: one base look + a data-driven _program_ of beat-synced operations
  (e.g. `poster-tile-mosaic`). The `program` param is the compose-by-data surface; the
  operator code is fixed. Such a card may omit the standard `roles` motion-verbs.
- `provenance` — the source video / audiomap / video-read the template was reversed from.
- `examples[]` entries may carry extra audio facts (`roll`, `bursts_sec`,
  `downbeats_sec`, …) beyond the required signature fields.

## Status lifecycle

`draft` (produced in the reverse workspace) → reviewed → `promoted` (copied into
`templates/<id>/`, added to the catalog). The Director only matches `promoted` cards.

## Worked example

The catalog ships five promoted templates (`held-message-living-field`,
`typewriter-phrase-keyword-shuffle`, `roll-flipbook-word-cycle`,
`held-text-strobe-burst`, `poster-tile-mosaic`) — each a real reversed group. Read any
`templates/<id>/card.json` for a filled-in reference.
