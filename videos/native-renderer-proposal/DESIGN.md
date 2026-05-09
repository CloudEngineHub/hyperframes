# Design System

## Overview

HyperFrames uses a developer-dark aesthetic: near-black background with a single electric teal accent. The visual language is sparse, precise, and technical — monospace labels, thin borders, minimal surfaces. Depth comes from layered opacity and subtle glows, not gradients or glassmorphism. The tone is serious engineering, not consumer product.

## Colors

- **Primary Surface**: `#0a0a0a` — near-black background, the void every scene lives in
- **Secondary Surface**: `#141414` — elevated panels, code blocks, cards
- **Border**: `#262626` — thin 1px dividers, panel outlines
- **Primary Text**: `#e5e5e5` — headings, labels, display numbers
- **Muted Text**: `#737373` — secondary copy, annotations, timestamps
- **Accent Teal**: `#3CE6AC` — the single brand color: CTAs, highlights, glow source, active states
- **Accent Teal Glow**: `rgba(60,230,172,0.15)` — ambient bloom behind teal elements
- **Chrome Red (data)**: `#ef4444` — used only for the bottleneck stat beat
- **Native Green (data)**: `#3CE6AC` — paired with chrome red in comparison beats

## Typography

- **Monospace**: JetBrains Mono or Fira Code. Code blocks, terminal lines, stat labels, data values. All weights.
- **System Sans**: -apple-system / BlinkMacSystemFont. Body copy, beat subtitles. 16–24px range.
- **Display Scale**: stat numbers at 180–320px monospace; section titles at 64–96px sans; body at 20–28px.
- **Letter-spacing**: +0.04em on all-caps monospace labels. Normal on display numbers.

## Elevation

Flat surfaces only. No box-shadows or glassmorphism. Depth via:

- `border: 1px solid #262626` to separate panels
- Radial teal glow (`box-shadow: 0 0 60px rgba(60,230,172,0.12)`) to push elements forward
- Opacity layering: background elements at 20–40% opacity, midground at 60–80%, foreground at 100%

## Components

- **Stat Monument**: Large centered monospace number (180–320px), muted label beneath, teal radial glow behind
- **Terminal Block**: `#141414` rounded rect, monospace text, teal `❯` prompt, blinking cursor
- **Architecture Flow**: SVG path-drawn connectors linking labeled node boxes in a horizontal flow
- **Phase Pill Row**: Horizontal row of numbered pill badges `01` → `07`, teal accent on active phase
- **Code Diff Panel**: Split-screen panel — left muted/desaturated, right full-brightness with teal outline
- **Percentage Bar**: Horizontal bar, teal fill animating left-to-right, percentage counter above

## Do's and Don'ts

### Do's

- One accent color only — teal. Never add purple, orange, or blue as secondary accents.
- Use monospace for every number, stat, code, or command.
- Keep backgrounds pure dark — any surface lighter than `#1a1a1a` needs a strong reason.
- Use thin 1px borders to separate sections rather than background shifts.

### Don'ts

- Do not use gradients as backgrounds — stay in the void.
- Do not animate text larger than 320px — it reads as overdesigned at that scale.
- Do not use multiple accent colors in a single beat.
- Do not add drop shadows — use radial glow or bloom effects instead.
