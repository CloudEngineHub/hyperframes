# Builder (template-driven) — mount groups on one timeline

Turn `visual-plan.json` + `audiomap.json` into one renderable HyperFrames `index.html`.
Each group is a **gated sub-scene**: for a `templateRef` group, fork the template's
reference impl and re-host it; for a `free_design` group, author from L0 primitives. All
groups share **one paused GSAP timeline** at absolute audio seconds.

## Inputs

- `visual-plan.json` — groups (templateRef + params + role_bindings, or free_design) + transitions.
- `audiomap.json` — timing truth.
- **Template reference impls** — `templates/<templateRef>/index.html` for each matched group.
- `references/template-definition.md`, `visual-plan-contract.md`, `motion-primitives.md`,
  `builder-contract.md`. Read `builder-contract.md` — the HyperFrames mechanics
  (root `#stage`, the `<audio>` tag, the one paused timeline, the forbidden list,
  seek-safety) are non-negotiable and unchanged.

Output: a single-file composition at the requested `index.html`.

## The core method: each group is a gated sub-scene

The whole video is ONE composition with ONE `#stage` and ONE paused timeline. Build it
group by group:

1. **One container per group** inside `#stage`:
   `<div class="group" id="g1" style="position:absolute; inset:0;">…</div>`. Stable id.
2. **Gate visibility by the group's span.** A group is only visible during its
   `span_sec`. Use 0ms `fast_cut` sets on the master timeline:
   `tl.set("#g1",{autoAlpha:1},start); tl.set("#g1",{autoAlpha:0},end);` (and start hidden
   at t=0 unless it's the first group). The transition between groups IS this hard cut.
3. **Re-host each group's animation at an OFFSET.** A template reference impl is a
   standalone composition (its own 0-based timeline). You **inline its DOM + CSS + shader
   into the group container** and **re-create its tweens on the master timeline shifted by
   the group's `start`**: a tween the impl placed at `t` goes at `start + t`. Map the
   impl's local reveal/hold/exit onto the group's real `role_bindings` seconds (e.g.
   reveal on `role_bindings.message.reveal_at`, field breath on `field.surge_at`). Set the
   group's element ids/uniform var names with a `g1_` prefix so multiple groups don't
   collide.
4. **Fill the template's params.** Apply `visual-plan.json` `params` as the concrete
   values (text content, palette → CSS vars / shader uniforms, flowSpeed, duration). You
   may pass them as the impl's composition-variables OR hard-code them into the inlined
   group — either way the rendered values must equal `params`.
5. **Free-design groups:** author the container from `motion-primitives.md` recipes, same
   gating + offset rules.

> WebGL templates: give each group its own `<canvas>` + renderer inside its container; a
> continuous render loop is fine (the reference impls already do this and explain why it
> stays deterministic — all _visible_ state comes from timeline-driven uniforms). Gate the
> container with `autoAlpha`, not by tearing down the renderer.

## Transitions

`visual-plan.json.transitions` are all `fast_cut`: realize each as the 0ms visibility
swap at `at` (hide the outgoing group, show the incoming one on the same frame). No
crossfade, no tween. The cut is the transition.

## Timeline discipline (from builder-contract.md)

- Exactly one `gsap.timeline({ paused:true })`; register `window.__timelines["<compositionId>"] = tl;`; end with `tl.seek(0);`.
- All tween positions are absolute audio seconds from `audiomap.json` (offset per group as above).
- Hard hits / cuts / palette flips are 0ms `tl.set(...)`. Eased entrances 300–500ms. Lead a move that must _land_ on a beat by ~40–190ms.
- No `stagger`, timers, `requestAnimationFrame` for visual _state_, `Math.random`, `Date.now`, remote assets/fonts, infinite repeats, render-critical callbacks. Fake them deterministically (see builder-contract.md).

## Self-Check

- Passes `npx hyperframes lint .` and `npx hyperframes validate .`.
- `#stage` + `<audio id="bgm" data-timeline-role="music" ...>`; one paused timeline; duration == `audiomap.audio.duration_sec`.
- Each group is visible exactly across its `span_sec` and hidden outside it; t=0 is not accidentally blank.
- Each group's rendered text/palette equals its `visual-plan.json` `params`.
- Group→group cuts are 0ms and land on the `transitions[].at` second.
- Group ids/var names are namespaced; no two groups' elements or uniforms collide.
- Final frame is intentional; main text readable, not colliding.
