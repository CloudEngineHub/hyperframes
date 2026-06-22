# Builder Contract

This is the complete implementation contract for LLM-first BGM compositions. Builder
and Finalize must read it before editing `index.html`.

The timeline is seekable sheet music: one paused GSAP timeline, absolute audio-second
positions, deterministic elements, no browser-play-only tricks.

## Root Composition

The root is a real stage element, not `<html>`:

```html
<div
  id="stage"
  data-composition-id="bgm"
  data-start="0"
  data-duration="23.005"
  data-width="1920"
  data-height="1080"
></div>
```

- `data-composition-id` must equal the `window.__timelines` key.
- Use `data-duration`, not `data-composition-duration`.
- `data-width` / `data-height` define the frame.
- Root CSS must set explicit pixel `width` and `height`.
- Landscape 1920x1080 is default unless `visual-plan.json.canvas` requests otherwise.

## Audio

```html
<audio
  id="bgm"
  data-timeline-role="music"
  src="assets/bgm.mp3"
  data-start="0"
  data-duration="23.005"
  data-media-start="0"
  data-volume="1.0"
></audio>
```

- Source HTML uses `data-duration`; emitting raw `data-end` triggers lint warnings.
- `data-timeline-role="music"` marks the BGM track.
- The file must exist beside `index.html` at `assets/bgm.mp3`.

## Timeline

- Exactly one render-critical `gsap.timeline({ paused: true })`.
- Register it: `window.__timelines["<compositionId>"] = tl;`.
- End the script with `tl.seek(0);`.
- Tween positions are absolute audio seconds from `audiomap.json`.
- Percentage keyframes only live inside a single tween's `keyframes`.
- `easeEach` belongs inside `keyframes`, never as a sibling tween prop.

## Timing Discipline

- Group-level cuts land on `visual-plan.json` `groups[].span_sec` boundaries (= the
  `transitions[].at` seconds), snapped to nearby downbeats.
- Phrase moves use `audiomap.phrases[]`.
- Word entries and layout changes prefer `grid.downbeats_sec[]`.
- Micro accents use `grid.beats_sec[]` or selected `events[].t`.
- Rolls use `rolls[].start/end` and should feel continuous or cascading.
- Hard stops use `hard_stops[].t` and should visibly freeze, cut, or hold.

## Layout Before Animation

Build the most important static frame first:

- A scene container fills the stage.
- Use CSS grid/flex/padding for content layout.
- Use absolute positioning for decorative systems, overlays, masks, and generated
  geometry.
- Keep title-safe padding. Do not let hero text touch the frame edge.
- Use `vmin`, `clamp`, or measured CSS to keep type readable across aspect choices.

Animate from hidden/offscreen states into the CSS end-state. The CSS end-state is the
truth.

## Seek-Safe Reveal

- Delayed elements are hidden until entrance and visible after seeking.
- Initial hidden state may be inline CSS or `gsap.set(..., {autoAlpha:0})` at time 0.
- Reveal with `fromTo` or paired `set` + motion tweens.
- Finite repeats only.

## Forbidden

`tl.play()`, `setTimeout`, `setInterval`, `requestAnimationFrame`, runtime network,
remote assets, remote fonts, `Math.random`, `Date.now`, `new Date`, `ScrollTrigger`,
`repeat:-1`, render-critical callbacks, `.call()`, `.addLabel()`, `.addPause()`.

## Discouraged

- `stagger:` does not serialize cleanly; expand multi-element moves into explicit
  per-element tweens with offset positions.
- Google Fonts links fail in offline/sandboxed renders. Use system-safe stacks or
  local `@font-face`.
- Out-of-alias font family names can trigger lint warnings.

## Faking the forbidden patterns

The bans still leave you every move the music wants — do them deterministically:

- **Instead of `stagger`:** schedule explicit per-element work at `t + i*step` — either
  `delay: i*0.04` on each tween, or one `tl.set(el[i], props, eventTime[i])` per onset.
  This serialises cleanly and lands each element on its own beat.
- **Instead of `Math.random`:** derive variation from the index —
  `palette[(i*7 + step*3) % palette.length]`, a fixed coordinate/rotation table, or a
  hand-keyed scrambled-string array. Looks random, stays seek-deterministic.
- **Instant text / number swaps:** `tl.set(el, { textContent: "…" }, T)` is allowed and is
  the workhorse percussive move. Give the node `width: max-content` (or a fixed width) and
  centre it so a longer word does not reflow the layout.

## CSS Values

Complex CSS strings for `clipPath`, `filter`, or transforms should be valid CSS in the
HTML source. If a serializer path requires raw passthrough, use the repo convention:
`"__raw:'inset(0 0% 0 0)'"`.

## Visual QA

- `t=0` is not blank unless intentional silence is specified.
- The first meaningful visual appears during the first section.
- Drop / surge has a visible hit within about 0.15s of the intended anchor.
- Dense sections show visual density, not just a single static word.
- Hard stop creates a readable hold or freeze.
- Final frame is intentional.
- Main text is readable and not colliding.
- Palette is coherent; define colors once through CSS variables or one palette block.

## Inspect Targets

When running `hyperframes inspect`, include:

- `0`
- every `visual-plan.json` `groups[].span_sec` start
- every `transitions[].at`
- strongest `DROP` / `SURGE` key moments
- every `hard_stops[].t`
- start/end of major `rolls[]`
- `duration - 0.2`
