# Design System

## Overview

DataFast's visual identity is warm, clean, and founder-friendly — a deliberate contrast to the data-heavy complexity of traditional analytics tools. The layout follows a classic SaaS landing page structure: centered hero with inline product demo, horizontal tweet marquee for social proof, numbered steps section, 2x2 feature grid with embedded video demos, integrations logo grid, pricing cards, and a massive reviews section. The background is a consistent warm off-white (#FBFAF9) with white (#FFFFFF) card surfaces, accented by a distinctive warm coral (#E16540) for all CTAs and brand highlights. Typography is exclusively DM Sans with a playful Fuzzy Bubbles handwriting accent for decorative squiggles and annotations.

## Colors

- **Primary CTA / Accent**: `#E16540` — warm coral-orange used for all buttons, links, and brand emphasis
- **Text Primary**: `#262626` — near-black for headings and body copy
- **Text Secondary**: `#595451` — warm gray for subheadings, labels, and muted text
- **Surface Background**: `#FBFAF9` — warm off-white for the page background
- **Card Surface**: `#FFFFFF` — pure white for feature cards and elevated sections
- **Border / Divider**: `#E5E7EB` — light gray for subtle card borders and separators
- **Success Green**: `#4ADE80` — used in dashboard metrics for positive indicators
- **Error Red**: `#F87171` — used in dashboard metrics for negative indicators
- **Warning Yellow**: `#FACC15` — used in dashboard metrics for caution states

## Typography

- **Primary**: DM Sans (variable, 100-1000). Used everywhere — headings at 800 weight (48-60px), subheadings at 600 (18-20px), body at 400 (16px). Clean, geometric, highly readable.
- **Accent**: Fuzzy Bubbles (400). Handwritten style used sparingly for decorative annotations like "Try this" labels and squiggle underlines. Adds playfulness.
- **System**: -apple-system / BlinkMacSystemFont. Fallback for UI elements.

## Elevation

Elevation is minimal and flat. Cards use thin 1px borders (#E5E7EB) with generous border-radius (12-16px) rather than shadows. The overall depth strategy relies on background color shifts (off-white → white) to create visual layering. The hero product demo is the only element with notable depth — it's framed in a browser-chrome mockup with rounded corners and a subtle shadow. No glassmorphism, no gradients on surfaces.

## Components

- **Browser Chrome Demo**: Faux browser window with traffic-light dots and URL bar, containing the analytics dashboard screenshot. The centerpiece of the hero.
- **Horizontal Tweet Marquee**: Two rows of tweet cards scrolling in opposite directions — left-to-right and right-to-left — creating a continuous social proof wall.
- **Numbered Steps**: Three numbered cards (1-2-3) with icon, title, and description. Simple vertical flow.
- **Feature Video Grid**: 2x2 grid of white cards, each with a heading, description, and an embedded video/image demo with a play button overlay.
- **Integration Logo Grid**: Two-column layout (CODE vs NO-CODE) of rounded-corner cells containing partner logos (Next.js, Shopify, WordPress, etc.).
- **Pricing Cards**: Side-by-side plan cards with coral "Start" CTA, feature checklists, and a "Popular" badge with pulse animation.
- **Social Proof Counter**: Avatar stack (8 circular photos) with "Loved by 17,051 users" text. Appears in hero and footer CTA.
- **Handwritten Squiggle**: SVG curly underline decoration in coral, used under key phrases for emphasis. Rotated and scaled for variety.

## Do's and Don'ts

### Do's

- Use warm coral (#E16540) exclusively for interactive elements — buttons, links, emphasis
- Keep backgrounds warm (off-white #FBFAF9) rather than cool gray
- Use generous whitespace and padding — the site breathes
- Maintain the friendly, founder-speaks-to-founder tone
- Use DM Sans at heavy weight (800) for impact headings

### Don'ts

- Do not use dark backgrounds — the entire identity is light and airy
- Do not use complex shadows or glassmorphism — keep elevation flat with borders
- Do not use multiple accent colors — coral is the only pop color
- Do not use small, dense layouts — everything is spacious and scannable
- Do not use formal or corporate language — the tone is casual and direct
