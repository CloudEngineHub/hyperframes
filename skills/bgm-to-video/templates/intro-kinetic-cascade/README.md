# Intro Kinetic Cascade · editorial phrase cascade with icon climax — `intro-kinetic-cascade`

A spoken / anchored line laid out as a sequence of big **editorial phrases** — each a
stacked poster with one enlarged accent **hero word** — revealed **word-by-word** on its
anchors, **hard cut-out** between phrases, climaxing on a phrase that **slides in** with a
**swappable, ringing icon** (bell / cursor / sparkle / … or any emoji / SVG).

> **Origin — a VO launch-video intro, adapted for the catalog.** Internalized from
> `act0-intro-bell` (the voiceover intro of the Timeline-Editor launch video). Its reveal
> times are **transcript word onsets**, so in origin it is **narration-driven**, not a
> beat-reversed musical group — bind `phrases[].times` to audio onsets to use it
> beat-driven. The original's Lottie bell + Google-Fonts Inter/Playfair + CDN GSAP are
> dropped here for an **offline** build, and the bell is now a **swappable icon**.

## Files

```
intro-kinetic-cascade/
  card.json          ← the spec (match-face + build-face)            · status: promoted
  index.html         ← reference impl (parameterized GSAP; data-driven phrases + icon)
  program.json       ← the default act0 phrases + climax (standalone, editable)
  assets/gsap.min.js ← bundled GSAP (offline-safe)
  renders/recreate.mp4 ← rendered proof @30fps (default light + bell)
```

No fonts bundled — system grotesque stack (`"Inter","Helvetica Neue",Arial`); the serif
hero falls back `Playfair Display → Georgia` (drop a Playfair woff2 + `@font-face` for the
exact source face). Icons are **inline SVG** (no Lottie). No remote assets.

## How it moves

Each **phrase** is a vertically-centered, left-aligned stack of lines — a small word, a
HUGE accent **hero word**, a closing line — with per-line `size` + `x` indent for the
editorial diagonal. Words **fade in one-by-one** on their anchors, the phrase holds, then
**hard cuts out**. The finale **climax** slides in from offscreen-right and **holds**,
carrying the ringing icon.

| stage           | what                                                           | anchor              |
| --------------- | -------------------------------------------------------------- | ------------------- |
| phrase reveal   | words fade in within a held poster (hero line big + accent)    | `phrases[].times[]` |
| cut-out         | phrase opacity → 0 (hard)                                      | `out − 0.10`        |
| climax slide-in | finale lockup slides x 1400→0, holds to end                    | `climax.in`         |
| icon ring       | glyph pops (scale 0.4→1) + damped wiggle + two expanding rings | `climax.iconAt`     |

## The icon knob (match it to the scene)

`icon` picks the ringing climax glyph. Built-in inline-SVG library:

`bell` (timing/alerts) · `cursor` (a click/UI) · `sparkle` (AI/magic) · `bolt` (speed) ·
`play` (video) · `check` (done) · `heart` (like) · `star` (featured)

…or pass an **emoji** (`"🔔"`, `"⚡️"`), a raw **`<svg>…</svg>`** string, or `"none"` for a
pure-text climax. The pop + ring emphasis is generic, so any glyph "rings". The `{icon}`
token in `climax.text` marks where it lands.

## Themes

`theme` = `light` (default — the act0 editorial look), `dark`, or `bold`. Each is an
AA-tuned palette (field bg + ink + a hero-accent ramp incl. a `"gradient"` sweep).

## Parameters (swap freely)

- `theme` — `light` | `dark` | `bold` (default `light`).
- `icon` — climax glyph: a library name, an emoji, a raw `<svg>`, or `none` (default `bell`).
- `phrases` — **JSON array** of `{ lines:[{text,size,x,hero?,accent?,font?}], out, times? }`.
  `times` (per word, reading order) = the VO/onset anchors; omit → auto-spread across the
  phrase. Empty → the built-in 3-phrase act0 intro.
- `climax` — **JSON object** `{ text, in, iconAt, hold, size }`; `text` embeds `{icon}`.
  Empty → the built-in `timing is {icon} tricky.`

Fill with `--variables` (read via `window.__hyperframes.getVariables()`):

```bash
npx hyperframes render intro-kinetic-cascade -f 30 --strict-variables \
  --variables '{"theme":"dark","icon":"sparkle","climax":"{\"text\":\"editing just got {icon} magic.\",\"in\":3.79,\"iconAt\":4.9,\"hold\":1.3,\"size\":150}"}'
```

## Aligning to a track (VO or beat)

- Precise sync: set each phrase's `times` to the word onset seconds (a transcript for VO,
  or `audiomap` onsets for a beat). Put the key word of each phrase on the strongest hit;
  land the climax icon on a downbeat / surge.
- Quick layout: drop `times` and the engine auto-spreads each phrase's words evenly.

## Verify

```bash
npx hyperframes lint     intro-kinetic-cascade   # clean
npx hyperframes validate intro-kinetic-cascade   # no console errors · text passes WCAG AA
npx hyperframes render   intro-kinetic-cascade -f 30
```

## Status

`promoted` — in the catalog, matchable by the Director. VO-origin: when first matched to a
real musical group, add that group as an `examples[]` entry and tighten `match.requires`.
