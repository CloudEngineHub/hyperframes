# Held Message / Living Field

The first promoted Group Template. Reverse-engineered from **group_1** of the golden
sample `bgm_test_2` (the "PREVIOUSLY ON / DUCKLIFE" recap card). Chinese name the user
uses: 静止文字 · 活背景.

In `visual-plan-contract.md` / motion terms it is the **macro-stable + micro-volatile
hold**: the message is frozen, the blurred field carries all the motion.

## When the Director picks it (match-face)

A group whose `GroupSignature` is **heavy-but-sparse with an onset desert**:
`energy_level >= MEDIUM`, `density == sparse`, `onset_gap_bars >= 1.5`, steady grid.
Mood fit: warm / dark / elegant / cinematic. See `card.json`.

The hold ends at the **first onset re-entry** (or a hard stop), snapped to the next
downbeat — that is both the group boundary and the template's stop rule.

## What it renders (build-face)

- **message** (text) — `freeze_after_reveal`: a held title block (mark + title +
  tagline). Reveal (blur+scale settle, brief per-letter entrance) then dead still for the
  whole span. Three slots: `markText` (big) + `titleText` + `tagText`.
- **field** (background) — `energy_envelope_breath`: a real-time WebGL flow field
  (fbm + curl noise). Colorful chromatic light-leak at entry, breathes up on the SURGE,
  then settles dark with a central glow for the hold.

## Files

- `card.json` — the spec (match-face + build-face).
- `index.html` — the **generic `webgl-textures-playground`** reference implementation
  (asset-free, CDN three.js + GSAP, one paused timeline; passes lint + validate).
  Composition-variables == the card's `params`: `markText`, `titleText`, `tagText`,
  `bgColor/colorLow/colorMid/colorHigh/accentColor`, `flowSpeed`. The group_1 DUCKLIFE
  recap (kicker + hero, the warm light-leak settle) is one parameterization of this engine.

## Params → recolor / re-text

```bash
npx hyperframes render --variables '{
  "markText":"DUCKLIFE","titleText":"PREVIOUSLY ON","tagText":"",
  "colorLow":"#100a2e","colorMid":"#d23b5e","colorHigh":"#ffd9c2","accentColor":"#ffb27a"
}'
```

## Provenance

Reversed via `skills/bgm-golden_sample_reverse/reverse-to-template.md` from
`bgm-golden-sample-reverse/gorup-by-group/group_1` (audiomap + Gemini analysis). The
reference impl here is the generic `group_1/webgl-textures-playground` (the user's chosen
canonical impl); the DUCKLIFE-specific `recreate-webgl` was an earlier parameterization.
