# Transition Catalog (group → group)

Transitions between groups are L1 patterns, just like Group Templates. This catalog is
the interface; the Director picks a transition for each group boundary.

> **Decision #4: keep the interface, default EVERYTHING to `fast_cut` for now.** The
> reverse pipeline still _records_ the real observed transition on each template
> (`transition_out.observed`) so we can activate richer ones later — but the Director
> emits `fast_cut` for every boundary until we say otherwise.

## Entry schema

```jsonc
{
  "id": "fast_cut",
  "one_line": "Instant hard cut on the boundary downbeat. 0ms.",
  "anchor": "boundary.downbeat", // which audio moment it lands on
  "duration_ms": 0,
  "mechanism": "tl.set(): kill group A, show group B on the same frame — no tween.",
  "uses_primitives": ["hard_cut"], // L0 ids (bgm-motion-vocabulary.md)
  "status": "active", // active | recorded (known but not yet emitted)
}
```

## Active

### `fast_cut` — DEFAULT for all boundaries

- **Anchor:** the boundary downbeat (the group's `exit_trigger.time`, snapped).
- **Mechanism:** 0ms `tl.set()` — hide group A, reveal group B on the same frame. No
  crossfade, no tween. The cut _is_ the transition.
- **Why default:** zero-asset, never wrong, reads as decisive editing; lets us ship the
  template pipeline before investing in bespoke transitions.
- **Primitives:** `hard_cut`.

## Recorded (known from reverses, NOT emitted yet)

These come out of the reverse pipeline as `transition_out.observed`. Kept here as the
backlog to activate once fast_cut-everything is working.

### `anticipation_glitch_cut` _(observed: group_1 → group_2)_

- A few-frame chromatic/noise glitch on the **pre-beat** (the onset just before the
  boundary downbeat), impact landing on the downbeat. A "spring" that amplifies the
  next group's entrance. Primitives: `chromatic_pressure` + `hard_cut`.
- Status: `recorded`. To activate: add `"status":"active"` and let the Director choose
  it when a boundary's `exit_trigger.type == "first_onset_reentry"`.

## How the Director uses it (target)

For each adjacent group pair, set `transitions[]` entry `{ from, to, transition:
"fast_cut", at: boundary_time }`. Until further notice, `transition` is always
`fast_cut`. A template's `transition_out.observed` is metadata for the future, not an
instruction.
