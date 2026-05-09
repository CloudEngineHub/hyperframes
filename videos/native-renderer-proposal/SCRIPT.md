# Narration Script

## Video: HyperFrames Native Renderer — Design Proposal

**Duration target:** ~60 seconds
**Audience:** HeyGen / HyperFrames engineering and product team
**Tone:** Confident, direct, technical — peer to peer, not pitch

---

Eighty-six percent.

That's how much of render time Chrome spends just taking screenshots.

The native renderer changes that. H T M L stays the authoring format. A Rust and Skia I R replaces the per-frame browser path for the subset we control.

The auto backend chooses transparently — native when the compiler can prove support, Chrome when it can't. Every decision is logged. Nothing changes silently.

Adapters compile known primitives into a deterministic I R. G-SAP stays canonical. Text runs through Chrome once, cached as glyph clips, then composited.

Seven phases. Starting with proof infrastructure — not speed claims. Can we detect support accurately? Can we prove quality gates? Can the auto backend be trusted?

Then we grow the subset. One fixture at a time.

Native rendering isn't replacing Chrome. It's giving the best HyperFrames work a faster lane.

Let's build it right.

---

## Word count: ~143 words (~57 seconds at 2.5 wps)

## Beat cues

| Line                                         | Beat                    |
| -------------------------------------------- | ----------------------- |
| "Eighty-six percent."                        | Beat 1 — Hook           |
| "That's how much of render time..."          | Beat 2 — The Bottleneck |
| "The native renderer changes that..."        | Beat 3 — The Solution   |
| "The auto backend chooses..."                | Beat 4 — The Contract   |
| "Adapters compile known primitives..."       | Beat 4 continued        |
| "Seven phases. Starting with proof..."       | Beat 5 — The Plan       |
| "Then we grow the subset..."                 | Beat 5 continued        |
| "Native rendering isn't replacing Chrome..." | Beat 6 — Closer         |
| "Let's build it right."                      | Beat 6 — Closer         |
