# Roll-Driven Flipbook (Word Cycle → Optional Lock)

> Reverse-engineered from **gruop_3** of the golden sample (the fast word-flicker scene).
> `structural_type: dense_multiply` · status: **draft**

A general **fast word-flipbook**: a hi-hat **roll** drives a centred word that flips every
16th-note, cycling a word list to _fill the roll_. **On demand**, when a phrase is wanted,
the flicker resolves (scramble-decode) and **locks** into a final line. Background is pure
black (the original's rotating 3D shape / glitch field is an optional add-on role).

```
gruop_3_template/
  index.html   ← parameterized, asset-free reference impl (1 paused GSAP timeline)
  card.json    ← the spec: match-face + build-face
  README.md    ← this file
```

---

## 1. How it beat-syncs

Track facts (from `gruop_3.audiomap.json`): **BPM 129.2**, 4/4. The defining audio event
is a **sustained-fill hi-hat roll** — in the source at 3.71–6.66s, 21 hits, ~407 hits/min
— i.e. roughly a hit every **16th-note** (`60/129.2/4 = 0.116s`). That roll is the
flicker's clock.

**Timing is scene-relative** (rebased so content starts at ~0 — a template carries no dead
pre-roll; the source's 3.71s offset is removed):

| phase                     | what happens                                                                                          | scene time     |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | -------------- |
| **A — flicker**           | a centred word hard-swaps every **0.116s** (16th-note), cycling the word list, **filling** the window | `0.10 → 2.19s` |
| **— clear**               | the flicker clears (negative-space breath)                                                            | `~2.2s`        |
| **B — lock** _(optional)_ | a scrambled line decodes left→right and locks the phrase                                              | `2.33 → 3.33s` |
| **— hold**                | the locked phrase holds to the end                                                                    | `→ 3.8s`       |

The flicker rate is **roll-level**, ~4× faster than the per-onset rate — that's what makes
words _flicker_ instead of _read one at a time_.

> **Why duration isn't hard-coded.** Scene length is read from the root `data-duration`
> attribute (single source — `3.8s` here). The flicker length isn't a magic number either
> — it's `round((flipEnd − flipStart) / 16th)`, so it **auto-fills whatever window you
> give it**. Change the beat → the flipbook re-fits.

---

## 2. When you reach for this template (the matching signal)

The Music Reader emits a `GroupSignature`; **the single tell for this template is a fast
`rolls[]` entry** (`sustained-fill`, hundreds of hits/min). A roll means:

- the music is giving you a **dense grid of evenly-spaced slots** (16th-notes), and
- there's **no single readable message** to hold — it's energy/texture.

So you fill the grid with a **rapidly-cycling word flipbook** (`dense_multiply`). If a
**SURGE / downbeat follows** the roll, that's your cue to **lock** the flicker into a
final phrase (the optional resolve).

### The contrast that makes the choice mechanical

Same track, three groups, three different onset _rates_ → three different templates:

| group  | audio signature                      | rate            | → template                          | text behaviour               |
| ------ | ------------------------------------ | --------------- | ----------------------------------- | ---------------------------- |
| g1     | onset **desert** (`gap ≥1.5 bar`)    | ~0              | `held-message-living-field`         | text frozen, field moves     |
| g2     | **continuous onsets** (`gap <1 bar`) | ~3/s            | `typewriter-phrase-keyword-shuffle` | one word **per onset**       |
| **g3** | a **sustained-fill roll**            | **~7/s (16th)** | **`roll-flipbook-word-cycle`**      | words **flicker** (many/sec) |

Read it as a rate ladder: **no onsets → hold · onsets → type one word each · a roll →
flicker many words.** When the audiomap shows a roll, you reach for _this_ card.

---

## 3. Usage

### Render with defaults (the gruop_3 recreation)

```bash
cd gruop_3_template
npx hyperframes lint && npx hyperframes validate
npx hyperframes render -f 24 -o renders/out.mp4
```

### Change the words / lock phrase (content only — no code edit)

```bash
# flicker a different list, lock a different phrase
npx hyperframes render --variables '{
  "flipWords":"Ship,Iterate,Measure,Repeat",
  "resolveText":"build in public",
  "accentColor":"#39e6a0"
}'

# PURE FLICKER — no lock. Empty resolveText → the last cycled word just holds.
npx hyperframes render --variables '{"resolveText":""}'
```

- **`flipWords`** is cycled to fill the roll, however many you give (1 → N). More words →
  fewer repeats; fewer words → more loops. The fill count follows the beat, not the list.
- **`resolveText` empty → pure flicker** (on-demand lock: only set it when you want a
  phrase to land). `periodChar` empty → no accent dot.

### Re-fit to a different beat (the part that changes per track)

Two edits, both single-sourced. Timing is **scene-relative** — map your roll onto the
scene start (subtract the roll's absolute offset) so there's no dead pre-roll:

1. **Scene length** — set `data-duration` on `#root` in the HTML to your scene span.
2. **The `BEAT` block** at the top of the script:

```js
var BEAT = {
  bpm:          <tempo.bpm>,        // sets the 16th-note flip step automatically
  flipStart:    0.10,               // small lead-in (keep near 0 — no dead air)
  flipEnd:      0.10 + <rollLen>,   // rollLen = audiomap rolls[].end − rolls[].start
  resolveStart: flipEnd + ~0.14,    // short clear; only used if a lock phrase is set
  resolveLock:  resolveStart + ~1,  // place just before a downbeat in your track
};
// then set data-duration ≈ resolveLock + ~0.5 (hold)
```

That's it — the number of word-swaps, the decode step count, and the final hold all
derive from these + `data-duration`. No other timing constants to touch.

---

## 4. Implementation notes (why it's built this way)

- **Everything is a 0ms `tl.set(autoAlpha)` on a pre-built node** (content*swap flipbook).
  The scramble is a \_second* flipbook whose frames are progressively-resolved strings,
  baked deterministically at build time.
- **Avoided:** GSAP `tl.set({textContent})` and tween `onUpdate` — both silently fail
  under the seek-by-frame renderer (verified: they render black). Also avoided animating
  `scale` on a `translate(-50%,-50%)`-centred node (GSAP clobbers the centering) — layers
  are **grid-centred** instead.
- **Final-frame gotcha:** a `set` placed at the timeline's _last instant_ is dropped by
  the renderer, so the resolve locks slightly before the end and a no-op `tl.set(stack,
{opacity:1}, DUR)` extends the timeline so the held phrase renders to the end.
- Deterministic / asset-free: generic font stacks, no `Math.random`, no timers.

## 5. Provenance

- **Source:** `bgm-golden-sample-reverse/gorup-by-group/gruop_3/gruop_3.mp4`
- **Audio:** `gruop_3.audiomap.json` (from `scripts/analyze-beatgrid.py`)
- **Video read:** `gruop_3.gemini-analysis.md` (Gemini 3 Pro) **confirmed by frame-by-frame
  inspection** — Gemini's word list (Design → … → Event Management, 2 loops) and the
  decode-to-"everything you need." resolve both checked out against real frames.
- **Open for promotion:** identify the source's actual typefaces if a pixel-exact match
  is wanted (this impl reproduces the _mechanism_ with a generic bold sans), and decide
  whether to ship the rotating-3D / glitch background as a second role.
