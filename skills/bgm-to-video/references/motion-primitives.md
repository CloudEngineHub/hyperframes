# Motion Primitives — recipe catalog for Builder

The atomic layer: one anchor → one micro-move. Group Templates (L1) are composed from
these; the Builder also reaches here directly when a group is free-composed. **Not a
fixed API** — they are creative-coding recipes.

One flat catalog. The **recipe** column tells you what to lift:

- **✓** — a runnable, lint-clean composition at `motion-primitives/<id>/index.html`. Open
  it and lift the relevant tweens.
- **≈ `<id>`** — no separate file; use that existing recipe, it's the same idea.
- **—** — no standalone file. Implement it inline from the description + `builder-contract.md`;
  these are one-liners (e.g. a 0ms `tl.set`) or moves a template realizes internally.

## Timing & latency (applies to every primitive)

Quantified from frame-accurate reverse engineering of beat-synced reels:

- **Hard hits are 0ms.** Cuts, palette flips, content swaps, freezes are `tl.set(...)`
  with no duration — the percussion _is_ the motion. Easing a hit kills it.
- **Lead the anchor.** A move that must _land_ on a beat (a wipe covering the frame, a
  count-up locking, two blocks colliding to centre) should **start ~40–190ms early** so it
  completes ON the anchor. Reactive entrances — something appearing _because_ of the hit —
  fire 0–45ms after.
- **Eased entrances: 300–500ms** (scale punch, slides, camera pushes). **Macro builds:
  800–2000ms** spanning a whole roll / silence.
- **Magnitudes:** scale-punch entrance 0→1; weight pulse 1→1.06; hero fill up to 1→5;
  chromatic split ~20px, resolve clean in ≤150ms.
- **Per-bar caps:** one accumulating element per audio hit (not a burst); a camera move at
  most once per phrase, never per beat; a dense flip/strobe system runs ≤2–3s.
- **Tension-builds lock.** A count-up / sequential build / morph must _resolve on_ a
  downbeat or hard_stop, never trail off mid-bar.

## Catalog

Each runnable recipe is self-contained and lint-clean: showcase chrome stripped,
system-font fallback, shared `../assets/gsap.min.js`, one paused timeline on
`window.__timelines["main"]`. To use one, read its `index.html` and lift the tweens.

| id                       | anchor                           | what it does                                                                                                                                                           | recipe                     |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `01-hypercut_whip`       | beat / hard_stop                 | fast whip-pan hard cut between frames                                                                                                                                  | ✓                          |
| `02-kinetic_letter_in`   | downbeat / phrase                | per-letter kinetic entrance                                                                                                                                            | ✓                          |
| `03-braam_punch`         | drop / surge                     | big "braam" impact — scale + weight slam                                                                                                                               | ✓                          |
| `04-chromatic_split`     | snare / glitch / surge           | RGB channel split / glitch on a word                                                                                                                                   | ✓                          |
| `05-mask_reveal`         | section_start / downbeat         | clip-path mask wipe reveal                                                                                                                                             | ✓                          |
| `07-screen_shake`        | drop / crash / kick              | camera/screen shake jitter                                                                                                                                             | ✓                          |
| `08-binary_decrypt`      | roll / build                     | scramble→decode text (binary → word)                                                                                                                                   | ✓                          |
| `09-dolly_zoom`          | phrase / build                   | vertigo dolly-zoom (scale vs perspective)                                                                                                                              | ✓                          |
| `10-iris_open`           | section_start / reveal           | circular iris-open reveal                                                                                                                                              | ✓                          |
| `11-electric_arc`        | accent / glitch                  | electric arc / lightning accent                                                                                                                                        | ✓                          |
| `12-neon_flicker`        | hold / texture                   | neon-sign flicker                                                                                                                                                      | ✓                          |
| `13-chrome_sweep`        | downbeat / reveal                | metallic specular sweep across text                                                                                                                                    | ✓                          |
| `15-slot_machine_reveal` | roll → downbeat                  | slot-machine spin-to-land character reveal                                                                                                                             | ✓                          |
| `16-liquid_morph`        | phrase / transition              | liquid / blob morph                                                                                                                                                    | ✓                          |
| `17-gooey_metaball`      | build / drop                     | gooey metaball merge field                                                                                                                                             | ✓                          |
| `18-3d_card_flip`        | downbeat / swap                  | 3D card flip (rotateY)                                                                                                                                                 | ✓                          |
| `19-crash_zoom_in`       | drop / surge                     | violent crash zoom-in                                                                                                                                                  | ✓                          |
| `20-spotlight_sweep`     | reveal / hold                    | spotlight / gradient sweep over text                                                                                                                                   | ✓                          |
| `21-outline_to_fill`     | downbeat / reveal                | stroke outline → solid fill                                                                                                                                            | ✓                          |
| `22-counting_punch`      | roll → downbeat                  | number count-up that punches & locks                                                                                                                                   | ✓                          |
| `24-particle_burst`      | drop / crash                     | particle explosion burst                                                                                                                                               | ✓                          |
| `25-radial_burst_lines`  | drop / surge                     | radial speed-lines burst                                                                                                                                               | ✓                          |
| `26-pixel_dissolve`      | transition / hard_stop           | pixelated dissolve                                                                                                                                                     | ✓                          |
| `27-datamosh_smear`      | glitch / transition              | datamosh / motion smear                                                                                                                                                | ✓                          |
| `28-text_wave_distort`   | hold / texture                   | wavy text distortion                                                                                                                                                   | ✓                          |
| `bg_flow_field`          | energy / whole span (bed)        | generative WebGL curl-noise flow-field **background bed** — palette-driven, breathes on the energy envelope; run it underneath and compose any foreground move over it | ✓                          |
| `blur_resolve`           | stop / final hold                | blur-in to crisp focus, then blur-out on the cut                                                                                                                       | ✓                          |
| `chromatic_pressure`     | snare / glitch                   | RGB split / digital tension on a transient                                                                                                                             | ≈ `04-chromatic_split`     |
| `color_grid_shuffle`     | onset                            | grid of cells recoloured by a deterministic index per onset                                                                                                            | —                          |
| `content_swap`           | beat                             | 0ms swap of stacked nodes — the workhorse percussive move                                                                                                              | ≈ `15-slot_machine_reveal` |
| `directional_fill`       | beat / reveal                    | directional wipe-fill (scaleX) sweeping across bars                                                                                                                    | ✓                          |
| `flash_cut`              | drop / crash                     | full-frame flash masking a word/colour state change                                                                                                                    | ✓                          |
| `freeze_hold`            | hard_stop                        | freeze the moving system and hold it (desaturate + vignette)                                                                                                           | —                          |
| `hard_cut`               | beat / hard_stop                 | sample-accurate 0ms colour-block + word cut                                                                                                                            | ✓                          |
| `mosaic_pack`            | beat / build                     | scattered tiles fly in and pack into a grid                                                                                                                            | ✓                          |
| `negative_space_hold`    | silence / hard_stop / final hold | kill busy layers, hold one readable mark in empty space                                                                                                                | —                          |
| `overlay_pop`            | accent                           | badge / lower-third overlay pops in over a base                                                                                                                        | —                          |
| `palette_flip`           | section change                   | same layout re-skins via 0ms palette-variable flips                                                                                                                    | ✓                          |
| `staggered_exit`         | phrase / transition              | ordered cascade-out clearing the frame                                                                                                                                 | ✓                          |
| `staggered_reveal`       | build                            | ordered cascade-in of a stack / list                                                                                                                                   | —                          |
| `system_replace`         | drop / regime change             | hard-cut the entire visual system, then boot the new one                                                                                                               | —                          |
| `text_spectral_rays`     | phrase / sweep (hero text)       | volumetric spectral light-rays cast by a wordmark toward a sweeping light cursor — grain + RGB-split; **WebGL hero-text system**                                       | ✓                          |
| `tile_mosaic`            | build / reveal                   | grid of tiles revealed in a diagonal sweep, assembling a poster                                                                                                        | ✓                          |
| `typewriter_reveal`      | roll / build                     | char/word type-on, explicit per-span set (no `stagger`) + caret                                                                                                        | ✓                          |
| `value_counter`          | roll → downbeat                  | count-up that locks on a downbeat / hard_stop                                                                                                                          | ≈ `22-counting_punch`      |
| `word_grid_burst`        | onsets → downbeat                | grid of words revealed per onset, refocus one on a downbeat                                                                                                            | ✓                          |

> **Template-private verbs.** Some templates declare motion verbs realized only inside their
> own impl — e.g. `held_lockup`, `anchor_pop_in`, `word_slot_cycle`, `per_line_color`,
> `scene_palette_flip`, `beat_jitter_shake`, `box_zoom_wipe` (split-anchor-word-slot),
> `motion-blur` (logo-split). Those live in the template's own `index.html` / README, not
> here. Promote one into this catalog only when a second template needs it.

## How to combine

- One dominant system per group; layer at most one texture recipe over one structural recipe.
- Structure on strong beats (cuts, camera, system_replace → downbeat / phrase / section_start);
  texture on weak / syncopated hits (content_swap, typewriter letters, chromatic accents).
- A roll is an accumulation container — build during it, hard-cut to a clean layout on the
  downbeat that ends it.
- `drop` ≠ `downbeat`: a downbeat is a cut within the regime; a drop is a regime change
  (`system_replace`, total clear, element-count jump).
- Let silence remove density (`negative_space_hold`).
- **Background beds are a layer, not a move.** A bed (e.g. `bg_flow_field`) runs the whole
  span on the **energy / phrase** channel, leaving the **beat anchors** free for the
  foreground — so it composes cleanly _under_ any discrete primitive (text `content_swap`,
  `hard_cut`, a held mark…). One bed at a time; when mounting into a group, merge the bed's
  uniform tweens onto the group's master timeline (don't run a second timeline), bundle a
  local `three`/WebGL (no CDN), and repaint via the timeline's `onUpdate` (no rAF).
- **WebGL "system" primitives come in two roles:** a **bed** (`bg_flow_field`, behind
  everything) and a **hero-text treatment** (`text_spectral_rays`, which rasterizes the
  wordmark and _is_ the hero). Use at most one of each; feed text/raster locally (no CDN
  fonts), repaint via `onUpdate`.
- **`text_spectral_rays` renders its OWN wordmark — never give the word a second source.**
  It draws the solid letters AND the rays from one glyph mask (perfectly registered). Do NOT
  use it as a "rays-only" layer behind a separate DOM logo (or stack `content_swap` /
  `chromatic_pressure` on the same word): the two fonts/positions won't match and you get a
  doubled / ghosted wordmark — and deleting the shader's letter terms does not fix it (the
  ray mask is still the second, misaligned copy). Let the shader be the wordmark; hide any
  DOM logo (keep it only as an invisible layout spacer). If you move the word off
  frame-center, move the light cursor's `y` by the same amount. Full recipe:
  [`motion-primitives/text_spectral_rays/USAGE.md`](motion-primitives/text_spectral_rays/USAGE.md).
