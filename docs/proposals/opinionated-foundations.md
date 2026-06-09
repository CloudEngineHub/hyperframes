# Opinionated Foundations for Hyperframes — A Proposal

*Status: draft proposal for discussion. Author: deep-dive review of core / engine / producer / studio / registry.*

## 0. Thesis

Hyperframes' founding bet is **"any HTML that carries the right `data-*` attributes and passes
the linter is a workable composition."** That freedom is why it's easy to start and easy for an
LLM to emit. But the *same* freedom is what makes three things unreliable at scale:

1. **Deterministic render** — the highest-severity failure modes are explicitly *uncatchable by
   the linter* (the "load-bearing GSAP rules").
2. **Studio round-trip editing** (canvas + timeline) — Studio can only safely edit a narrow
   subset of what is legal to author, so most hand-written compositions are partly read-only.
3. **Reuse & scale** — there is no enforced structural convention, and the schema itself has
   forked into multiple dialects.

The proposal is **not** "make it less free." It's **a tiered opinionation model**: a *Strict
Profile* — the happy path the *entire* toolchain (render + Studio + catalog) guarantees end to
end — layered on top of today's permissive behavior, selected per-project in `hyperframes.json`
and enforced by the linter. Within that, concrete decision rules for sub-compositions, media,
GSAP/timeline structure, and the catalog.

---

## 1. How the foundation actually works (grounding)

A one-paragraph model so the recommendations are anchored:

- **The contract.** A page exposes `window.__hf.seek(t)` (duration + deterministic seek). Each
  composition registers a **paused** GSAP timeline at `window.__timelines[<data-composition-id>]`.
  The engine drives a frame clock `t = frame / fps` (rational fps, quantized per frame) and
  captures atomically (`HeadlessExperimental.beginFrame`). Nothing is real-time.
- **Two layers.** *HTML primitives* declare **when** a clip exists (`data-start`,
  `data-duration`, `data-track-index`) and the framework owns media playback + visibility.
  *Scripts* (GSAP) own **how it looks** — visual animation only. Mixing the two (scripted
  play/pause/seek, scripted show/hide) is the #1 documented breakage.
- **Render pipeline** (producer): compile → probe (browser-discover unknown durations) → extract
  video frames to images → mix audio (FFmpeg) → seek-capture every frame → encode. Sub-comp
  media is recursively inlined with time offsets; `window.__timelines[id]` for every
  `[data-composition-id]` must exist or capture stalls.
- **Studio.** HTML is the source of truth. Studio exposes **only edits it can round-trip
  deterministically** and treats everything else as read-only.

---

## 2. Where "free-form" leaks (the problem, with evidence)

### A. Determinism gaps the linter cannot catch
The docs ship an entire section — *Load-Bearing GSAP Rules* (`skills/hyperframes/references/
motion-principles.md`) — of failures that "lint clean and still ship broken":

- Two transform tweens on one element → `immediateRender` overwrites the first → element invisible.
- `tl.from()` inside `.clip` scenes flashes/▢skips under non-linear seek; must use `fromTo`.
- Bare `gsap.to()` / `requestAnimationFrame` for ambient motion → runs on wall-clock → absent in
  render even though it looks fine in preview.
- Missing `tl.set(el,{opacity:0,visibility:"hidden"})` hard-kill → elements resurrect on seek.
- Composition duration = GSAP timeline length, not media length → video silently truncated.

These are *conventions enforced by prose*, not by tooling. That's the definition of "too free."

### B. Editor round-trip gaps (Studio)
From `docs/contributing/studio-manual-dom-editing.mdx` and the Studio source, **move/resize is
only offered when** an element is `position: absolute|fixed`, has pixel `left/top`, and **has no
transform**. Consequences for ordinary, idiomatic compositions:

- Flex/grid children → emergent position → not directly movable (need explicit *Make movable*).
- **Transform-driven geometry is blocked** — i.e. anything GSAP is animating via `transform`
  cannot be moved on canvas while that's true.
- Needs a **stable patch target** (`id` or stable selector) or the node is read-only.
- Nested compositions are **opaque drill-down boundaries**.
- **Multiple GSAP timelines in one file disables the animation editor.**
- Script-generated DOM (`existsInSource:false`) is read-only.

So the editable surface is a *small island* inside the legal-composition ocean.

### C. Schema / dialect fragmentation
There are divergent attribute dialects in the tree:

- **Canonical / runtime / linter / registry:** `data-start`, `data-duration`, `data-track-index`,
  `data-width`/`data-height` on the composition `div`.
- **`packages/core/src/parsers/htmlParser.ts` (Studio's composition model):** reads `data-layer`,
  `data-end`, `data-composition-width`/`-height` on `<html>`, plus `data-x/y/scale/opacity`,
  `data-keyframes`, `data-source-duration`, `data-type`.

The linter actively **deprecates `data-layer` and `data-end`** (`deprecated_data_layer`,
`deprecated_data_end`) — yet the core parser still treats them as primary. Studio's model and the
render runtime therefore read *different* attributes. This is a latent correctness bug and a
direct symptom of under-specification.

### D. Structural ambiguity
- `data-track-index` overloads **three** meanings: z-order, row grouping, and the no-overlap
  constraint. There's no house convention for what each lane means.
- Duration is *derived* from `tl.duration()` (and probed in a browser), not declared — fragile
  and forces a probe stage.
- Inline vs external sub-composition is left entirely to taste.
- Relative-timing chains can nest arbitrarily (docs only *suggest* ≤3–4).

---

## 3. Proposal — a tiered Strict Profile

Add `"profile": "strict" | "standard" | "free"` to `hyperframes.json`.

- **free** — today's permissive behavior (escape hatch; nothing new enforced).
- **standard** — today's default lint set (unchanged).
- **strict** — the toolchain-guaranteed happy path: promotes ~15 current *warnings* to *errors*
  and adds the new rules below. This is what we recommend for teams, agents, and anything that
  will be edited in Studio or published to the catalog.

The rest of this section is the opinionated content, organized around your four questions plus a
cross-cutting schema item.

### 3.1 Sub-compositions — when and how (Q1)

**Use an *external* sub-composition (`data-composition-src`) when ANY of:**
- it is **reused ≥ 2 times** (then parametrize with `data-composition-variables`);
- it is a **scene** — a self-contained beat with its own internal timeline you want to move/trim
  as one unit on the timeline or drill into in Studio;
- it needs an **independent duration / lifecycle** or per-instance variables;
- it is (or should become) a **catalog block**.

**Inline a sub-composition only when** it is a genuine one-off, small, never reused, and takes no
variables. Otherwise prefer a file — files diff, version, lint, preview, and Studio-drill-down
cleanly.

**Opinionated structural rule — "scene = sub-composition; `index.html` = orchestrator."**
The top-level file should be thin: it hosts scene sub-comps, wires transitions, and carries the
master audio track. It should contain **little or no animation of its own**. Reasons: it matches
the Studio drill-down model (each scene is an editable unit), it keeps relative-timing references
*inside* a scene (they only resolve within one composition anyway), and it bounds file size
(the linter already warns at >300 lines and at >3 timed elements per track — make those
*scene-splitting* signals in strict).

**Anti-patterns to forbid/warn:**
- Nesting deeper than ~2–3 levels (relative timing breaks across boundaries; cognitive load).
- One sub-comp *per element* (over-fragmentation kills timeline ergonomics).

### 3.2 Media files — when and how (Q2)

**First principle: prefer the DOM over media files for anything that *could* be DOM.** Text,
shapes, charts, gradients, UI mockups, code blocks → author as HTML/CSS/SVG/canvas. They are
seekable, deterministic, Studio-editable, light, and need no extract stage. Reserve real media
for **real footage / photography / recorded or TTS audio**. Baking a motion graphic into an MP4
throws away editability *and* determinism guarantees *and* adds extraction cost.

**When you do use media:**
- Media (`<video>`/`<audio>`) are **primitive clips**; the framework owns playback. **Never**
  call `play/pause/currentTime` in scripts, and **never animate a `<video>`'s
  `width/height/top/left`** — wrap it and animate the wrapper.
- Assets live in `assets/`; **no base64**, **no placeholder URLs**, and prefer **local files**
  over remote (remote is localized at render, but local is faster and fully deterministic).
- **Images ≤ 2× canvas** dimensions (decode cost is `w×h×4`, independent of file size).
- **Exactly one audio owner per source** — mute the video or drop the duplicate `<audio>`
  (the linter's `video_audio_double_source` becomes an error in strict).
- **Captions/transcripts inline**, never `fetch()`-ed.
- If layout/timing depends on a clip's length, **declare `data-duration` explicitly** rather than
  relying on source-duration probing, and **set the composition tail** with `tl.set({}, {}, T)`.

### 3.3 GSAP & timeline structure (Q3) — the subtle one

This is where "be opinionated" pays off most. Establish a **canonical timeline contract**:

1. **Strict layer separation.** Primitive timing in `data-*` only; visual animation in GSAP only.
   No scripted visibility, no scripted media control. (Largely enforced already — keep it hard.)
2. **One paused master timeline per composition,** registered at the matching
   `data-composition-id`. Sub-comp timelines **auto-nest** — never add them manually. Strict:
   forbid >1 timeline per file (this is *also* what unlocks Studio's animation editor).
3. **Absolute placement, not tween-chaining.** Place tweens at absolute times
   (`tl.to(x, {...}, ABS_T)`) and use **labels** for scene starts. Predictable under random seek;
   far easier to retime and to reason about than long relative chains.
4. **One transform-driving tween per element at a time;** prefer `fromTo` over `from`; **hard-kill
   every exit** with `tl.set(...,{opacity:0,visibility:"hidden"})`. Promote the load-bearing rules
   from prose to enforced conventions / new lint heuristics wherever statically detectable.
5. **Ambient/looping motion attaches to `tl`** — never bare `gsap.to()` / `requestAnimationFrame`.

6. **The single highest-leverage convention — separate the *layout layer* from the *motion
   layer*.** Keep an element's **layout** in CSS (absolute + px, or a flex container) and let GSAP
   animate **only `transform` and `opacity`**. This reconciles the two biggest constraints in the
   whole system at once:
   - Studio canvas move/resize works (layout is plain CSS geometry, not transform-driven), **and**
   - the animation still plays (motion lives on `transform`, which Studio leaves alone and stores
     its own offsets beside).
   Strict rule `layout-motion-separation`: **warn when GSAP animates `left/top/width/height`**
   instead of `transform`. This one convention is what makes "free-form HTML" actually editable.

7. **Timeline editability is clip-level only.** Studio's timeline can move/trim/re-track *clips
   and sub-comps* — it **cannot** edit GSAP keyframes (those live in `<script>`). Therefore:
   **anything a user will want to retime on the timeline must be its own clip or sub-composition,
   not a GSAP beat buried in a script.** Design scenes accordingly.
8. **House track-lane semantics.** Define and document fixed lanes, e.g.
   `0` = base/background, `1` = main content/scenes, `2` = overlays/lower-thirds,
   `3` = captions, `8–9` = audio. Top row renders on top (matches Studio stacking). This turns
   the overloaded `data-track-index` into a predictable z-order + role convention.

### 3.4 Catalog & components (Q4)

The three formal types are well-designed; the gap is *guidance on when to reach for each* and
*holding project code to the same bar as published code.*

- **Component** (`hyperframes:component`, a snippet that inherits host size/duration): use for
  **cross-cutting effects that decorate a host** — grain, vignette, parallax, caption *styles*.
  Must be host-agnostic, transparent, scoped CSS, id-prefixed, deterministic, hard-killed.
- **Block** (`hyperframes:block`, sized + duration sub-comp embedded via `data-composition-src`):
  use for **self-contained, reusable, parametrized scenes** — charts, cards, transitions, VFX.
  Must declare `dimensions`, `duration`, and `variables`.
- **Example** (`hyperframes:example`): a full project scaffold via `hyperframes init --example`.

**Opinionated rules:**
- **Check the catalog before hand-rolling common patterns** — captions especially (15 ready
  styles). The skill already says this; make it a default step.
- **"Author every scene as if it were a catalog block."** The quality bar the catalog enforces
  (deterministic, paused+registered timeline, scoped CSS, prefixed ids, hard-kills) is exactly the
  bar that makes *any* sub-comp render- and edit-reliable. Make the block contract the
  project-level scene contract — i.e. **blocks are the sub-composition standard**, not a separate
  species.

### 3.5 Cross-cutting — schema convergence (the prerequisite)

Before any of the above can be enforced cleanly, **collapse the dialects into one canonical
schema** and make every consumer read it:

- Canonical = `data-start` / `data-duration` / `data-track-index` / `data-width`+`data-height` on
  the composition element. **Update `core`'s `htmlParser.ts` to read the canonical form** and fully
  retire `data-layer` / `data-end` / `data-composition-width`. Eliminating the parser↔runtime
  schism makes **Studio's model identical to the render model** — a correctness fix, not just
  tidiness.
- **Require stable, prefixed, human-readable `id`s** on every timed element and every editable
  text node. The linter already *warns* (`studio_missing_editable_id`); strict makes it an
  **error**. This is the concrete thing that unlocks reliable Studio round-trip.
- `hyperframes.json` becomes the **single source of project invariants**: `profile`, canvas dims,
  `fps`, track-lane semantics, asset dir, registry URL.

---

## 4. How to enforce it (make it real, not just docs)

1. **Profile flag + rule promotion.** `strict` promotes to errors: `studio_missing_editable_id`,
   `video_audio_double_source`, `media_preload_none`, `timed_element_missing_clip_class`,
   `deprecated_data_layer`, `deprecated_data_end`, the caption hard-kill warnings, etc.
2. **New strict lint rules** (start as warnings, graduate):
   - `layout-motion-separation` — GSAP animates `left/top/width/height` (use `transform`).
   - `single-transform-tween-per-element` (heuristic).
   - `require-tl-set-kill-on-exit` — exit fade without a following `tl.set` kill.
   - `require-external-scene-subcomp` — file > N lines / > N timed elements should be split.
   - `single-timeline-per-file`.
   - `ban-deep-relative-chains` (> 3 levels).
   - `require-explicit-composition-duration` (tail `tl.set`).
3. **Scaffold.** `hyperframes init --strict` emits the canonical skeleton: thin `index.html`
   orchestrator + `scenes/` (one block-style sub-comp each) + `assets/` + `design.md` +
   `hyperframes.json` with lane semantics.
4. **Codemods.** `hyperframes fmt`/migration to (a) convert deprecated dialect and (b) lift
   `left/top/size` GSAP tweens into transform-on-wrapper form.
5. **Studio strict affordances.** Studio already computes *why* a node isn't editable — surface a
   per-element "editable / why not" badge, and gate render behind a strict-lint pass so the
   "lints clean but broken" class becomes "won't pass strict."

---

## 5. Recommended phased rollout

- **Phase 1 (low risk, high leverage):** schema convergence (fix `htmlParser.ts`); promote the
  `id` rules; document the **layout/motion separation** convention and the **track-lane** house
  convention; ship `scene = sub-comp` guidance.
- **Phase 2:** introduce the `profile` flag and the new strict rules *as warnings*; ship
  `init --strict` scaffold.
- **Phase 3:** Studio strict-mode badges + render gate; codemods; make blocks the scene standard;
  graduate the strict warnings to errors.

---

## 6. Open questions for you to decide

1. **Default profile.** Recommend `standard` stays default; `strict` opt-in (and the *default for
   agent-generated and catalog-bound* projects). Agree?
2. **Intra-scene timeline keyframe editing.** If we ever want to retime *beats inside a scene* on
   the timeline (not just clips), GSAP-as-opaque-script has to give way to a serialized keyframe
   model — and the `data-keyframes` path already in the parser is a hint that this was once
   intended. Do we want to commit to that direction, or keep beats as code and scenes as the unit
   of timeline editing?
3. **Authoring cost of layout/motion separation.** It's a real constraint on hand-authoring. Is
   the editability payoff worth making it a *strict error* rather than a *warning*?

I can follow up by drafting any of: the `hyperframes.json` `profile` schema, the new lint rules
(with tests), or the `init --strict` scaffold.
