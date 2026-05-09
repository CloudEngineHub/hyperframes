# Storyboard — DataFast Product Launch

**Format:** 1920x1080
**Audio:** TTS voiceover + warm electronic underscore + SFX
**VO direction:** Mid-20s male, energetic but not hype. Founder-talks-to-founder register. Think: a smart friend explaining their new favorite tool over coffee. Casual contractions, natural pauses.
**Style basis:** DESIGN.md — warm off-white backgrounds, coral #E16540 accents, DM Sans bold headings, clean and spacious with depth from browser-chrome mockups.

**Global guardrails:**

- Light backgrounds only — warm off-white (#FBFAF9) and white (#FFFFFF). Never dark.
- Coral (#E16540) is the only pop color. Use it for emphasis, CTAs, highlights, animated accents.
- Motion should feel smooth and confident, not frantic. DM Sans heavy weight for impact.
- Generous whitespace. The brand breathes.

**Music direction:** Warm lo-fi electronic. Clean guitar sample loop with soft kick, light hi-hats. Already playing when video starts. Sits under VO, never competes. Subtle energy lift at Beat 3 (features), resolves gently into Beat 5.

---

## Asset Audit

| Asset                          | Type       | Assign to Beat | Role                                |
| ------------------------------ | ---------- | -------------- | ----------------------------------- |
| og-image.png                   | Logo/OG    | Beat 1, Beat 5 | Brand mark, opener + closer         |
| image-47.svg                   | Logo SVG   | Beat 1, Beat 5 | DataFast wordmark                   |
| scroll-000.png                 | Screenshot | Beat 1         | Hero dashboard demo — centerpiece   |
| scroll-006.png                 | Screenshot | Beat 3         | Dashboard with chart/metrics detail |
| scroll-031.png                 | Screenshot | Beat 3         | Feature grid — 4 capabilities       |
| scroll-043.png                 | Screenshot | Beat 4         | Integrations grid                   |
| svgs/fill-base-secondary.svg   | SVG        | Beat 1         | Handwritten squiggle decoration     |
| Profile photos (tweet avatars) | JPGs       | Beat 4         | Social proof avatar stack           |
| fonts/DM Sans woff2 files      | Fonts      | All beats      | Brand typography                    |

---

## BEAT 1 — THE HOOK (0.0s–5.4s, duration: 5.4s)

**VO:** "Most analytics tools drown you in data. DataFast shows you where the revenue is."

**Concept:** Split reality. The left side is chaos — a blur of dense numbers, tiny charts, overwhelming metrics. The right side is clarity — DataFast's clean dashboard breathing in warm light. The contrast IS the message. As the VO lands on "revenue," the chaos side dissolves and the clean side takes over the full frame.

**Visual:** Frame splits 50/50. LEFT: a collage of dense analytics gibberish — tiny numbers, overlapping bar charts, pie charts, cramped tables — all desaturated and slightly blurred, slowly drifting upward. Feels suffocating. RIGHT: DataFast dashboard (scroll-000.png) in a browser-chrome mockup with the traffic-light dots, warm and clean, floating on off-white. As VO says "DataFast," the left side wipes away with a coral (#E16540) sweep reveal and the dashboard expands to fill the frame with a gentle scale from 0.95 to 1.0. The DataFast logo (image-47.svg) fades in top-left. A handwritten squiggle SVG (fill-base-secondary.svg) draws itself under "revenue" in coral.

**Mood:** The relief of switching from complexity to simplicity. Think: opening a clean Notion page after drowning in a spreadsheet.

**Animation choreography:**

- Dense analytics collage: slow parallax drift upward (y: 0 to -80px, 5s, linear)
- Dashboard screenshot: FLOATS into right half at 0.3s (y: 40→0, opacity 0→1, 0.5s power2.out)
- On "DataFast" (VO ~2.5s): coral wipe reveal sweeps left→right (0.4s power2.inOut), dashboard scales 0.95→1.0 (0.5s power2.out)
- Logo: fades in top-left at 3s (0.3s)
- Squiggle SVG: draws itself via stroke-dashoffset at 3.5s (0.5s power2.out)
- Metric numbers on dashboard: counter animation from 0 to real values (staggered 0.2s each)

**Techniques:** SVG path drawing (squiggle), velocity-matched transitions, per-word typography

**Depth layers:**

- BG: warm off-white (#FBFAF9) fill
- MG: browser-chrome dashboard mockup with subtle shadow
- FG: DataFast logo, squiggle accent, floating metric highlights

**SFX:** Soft whoosh on the coral wipe reveal. Gentle "ding" as the first metric counter lands.

**Transition OUT:** Velocity-matched upward — y:-120, blur:20px, 0.33s power2.in

---

## BEAT 2 — THE JOURNEY (5.4s–15.1s, duration: 9.7s)

**VO:** "From first click to paying customer — see exactly which channels drive real money. Revenue per visitor. Conversion by source. The full user journey."

**Concept:** We're inside the dashboard now. This is the product tour beat — three key metrics materialize as floating stat cards, each one a window into what DataFast reveals. The metrics cascade in rhythm with the VO, creating a sense of progressive discovery. It's like flipping through the world's simplest analytics report.

**Visual:** Off-white canvas. Three floating metric cards cascade in from right, staggered. Card 1: "Revenue per visitor" with $0.44 counting up from $0.00. Card 2: "Conversion by source" with a mini horizontal bar chart (Direct, Twitter, Google). Card 3: "User journey" showing a simplified funnel path (Visit → Signup → Purchase) with an animated connecting line drawing between nodes. Behind the cards, a subtle dot-grid pattern provides texture. As each card enters, a coral highlight bar slides across its header.

**Mood:** Clean data visualization energy. Calm confidence — the numbers tell the story.

**Animation choreography:**

- Card 1: SLIDES in from right at 0.0s (x: 120→0, opacity 0→1, 0.5s power2.out), counter COUNTS UP $0.00→$0.44 over 0.8s
- Card 2: SLIDES in at 0.4s (same motion, staggered), bar chart bars GROW from 0 width (staggered 0.15s each, power2.out)
- Card 3: SLIDES in at 0.8s, funnel path SVG DRAWS itself left→right (stroke-dashoffset, 0.7s power2.out)
- Coral highlight bars: sweep across each card header on entry (0.2s power2.inOut)
- Dot-grid background: subtle parallax drift (x: 0→-30px over beat duration)
- On "full user journey" — all three cards settle into a neat row, slight scale pulse (1→1.02→1, 0.3s)

**Techniques:** SVG path drawing (funnel journey line), counter animations (revenue), CSS 3D subtle perspective tilt on cards

**Depth layers:**

- BG: off-white (#FBFAF9) with subtle dot-grid pattern
- MG: three stat cards with thin borders and card shadows
- FG: coral highlight accents, animated counters

**SFX:** Soft paper-slide sound on each card entry. Gentle click on counter completion.

**Transition OUT:** Blur through — blur:16px, opacity 0.5, 0.3s power2.in

---

## BEAT 3 — THREE STEPS (15.1s–21.1s, duration: 6.0s)

**VO:** "Three steps. Install a script. Connect your payments. Watch the insights roll in."

**Concept:** The simplicity pitch. Three numbered circles appear in sequence — 1, 2, 3 — each revealing its step with playful confidence. This beat should feel effortless, almost too easy. The handwritten Fuzzy Bubbles font appears as an annotation ("that's it!") after all three land, adding the founder's personality.

**Visual:** Clean off-white canvas. Three large circled numbers (①②③) in coral (#E16540) appear in a horizontal row. Below each, a short label types out character-by-character: "Install script" → "Connect payments" → "See insights." Between them, thin SVG connector lines draw from circle to circle. After all three land, a handwritten "that's it!" annotation in Fuzzy Bubbles appears with a bounce above the row. Below the steps, the dashboard screenshot (scroll-006.png) rises into view as a blurred background element, establishing that the result of these 3 steps is the beautiful dashboard.

**Mood:** "This is ridiculously simple." The anti-complexity statement. Think: a great product onboarding flow.

**Animation choreography:**

- Circle ①: STAMPS in at 0.0s (scale: 1.3→1, opacity 0→1, 0.25s back.out(1.4))
- Label "Install script": types on character-by-character at 0.3s (0.5s)
- Connector line 1→2: SVG DRAWS at 0.6s (stroke-dashoffset, 0.3s power2.out)
- Circle ②: STAMPS in at 0.8s
- Label "Connect payments": types on at 1.0s
- Connector line 2→3: SVG DRAWS at 1.3s
- Circle ③: STAMPS in at 1.5s
- Label "See insights": types on at 1.7s
- "that's it!" annotation: BOUNCES in at 2.2s (y: -20→0, scale 0.8→1, 0.4s back.out(1.6))
- Dashboard screenshot: rises from bottom at 2.5s (y: 200→80, opacity 0→0.3, blur 8px, 1s power2.out)

**Techniques:** Character-by-character typing (step labels), SVG path drawing (connector lines), per-word typography ("that's it!" annotation)

**Depth layers:**

- BG: off-white (#FBFAF9)
- MG: numbered circles, labels, connector lines
- FG: handwritten annotation, dashboard screenshot (blurred, far bg)

**SFX:** Light "pop" on each circle stamp. Typewriter clicks during label typing. Playful "boing" on the annotation bounce.

**Transition OUT:** Whip pan right — x:400, blur:20px, 0.3s power3.in

---

## BEAT 4 — SOCIAL PROOF (21.1s–24.5s, duration: 3.4s)

**VO:** "Over seventeen thousand founders already made the switch."

**Concept:** The crowd has spoken. A wall of social proof materializes — avatar photos cascade into frame like a crowd assembling, while the "17,051" number counts up dramatically in the center. Twitter/X testimonial cards peek in from the edges, giving glimpses of real praise. This beat is about VOLUME — the sheer number of people who love this product.

**Visual:** Center stage: "17,051" in massive DM Sans 800 weight, coral color, counting up from 0. Around it, a circular constellation of small avatar photos (from captured tweet profile pics) orbit slowly. 4-5 tweet cards peek in from the edges at slight angles (±3-5°), showing snippets: "SaaS perfection," "better than Google Analytics," "no brainer." Each tweet card has a thin border, white background, and the X logo. Below the number: "founders already made the switch" in secondary text.

**Mood:** Overwhelming social proof. Not one testimonial — a movement. Think: App Store reviews counter hitting a milestone.

**Animation choreography:**

- "17,051" counter: COUNTS UP from 0 at 0.0s (2.0s, power2.out) with number odometer roll effect
- Avatar photos: CASCADE in a starburst pattern from center (staggered 0.05s each, 12-15 photos, scale 0→1, 0.3s back.out(1.2))
- Avatar orbit: slow continuous rotation of the avatar constellation (360° over 20s, linear)
- Tweet cards: SLIDE in from edges at staggered 0.5s intervals (4 cards, x: ±300→±position, 0.5s power2.out)
- On VO "switch" — everything pulses once (scale 1→1.03→1, 0.3s)
- Subtle confetti particles drift down from top (8-10 small coral dots, slow gravity fall)

**Techniques:** Counter animation (17,051), Canvas 2D procedural (confetti particles), CSS 3D perspective tilt on tweet cards

**Depth layers:**

- BG: off-white (#FBFAF9)
- MG: counter number, avatar constellation
- FG: tweet cards at edges, confetti particles

**SFX:** Rising "whoosh" during counter climb. Soft crowd murmur ambience (very low). "Ding" as counter lands on 17,051.

**Transition OUT:** Cross-Warp Morph shader — 0.6s, power2.inOut (this is the big brand moment transition)

---

## BEAT 5 — CTA (24.5s–31.5s, duration: 7.0s)

**VO:** "DataFast. Revenue-first analytics. Start your free trial at datafast."

**Concept:** The closer. Everything resolves to the brand. Clean, centered, confident. The DataFast logo and tagline occupy the frame with authority. The coral CTA button pulses with energy — an invitation, not a command. The avatar stack from the website ("Loved by 17,051 users") anchors the bottom, connecting this ending back to the social proof.

**Visual:** Off-white canvas, completely clean. DataFast logo (image-47.svg) at center, scaled large. Below it: "Revenue-first analytics" in DM Sans 600, secondary text color. Below that: the coral CTA button "Start your free trial →" with a gentle pulse animation. At the bottom: avatar stack (8 small circular photos in a row) with "Loved by 17,051 users" text. A final handwritten squiggle draws under the tagline. Subtle radial glow behind the logo in very light coral tint.

**Mood:** Confident, warm resolution. The friend-who-recommended-the-product smile. Think: Apple product page hero — clean, centered, inviting.

**Animation choreography:**

- Logo: fades in center at 0.0s (scale 0.9→1, opacity 0→1, 0.5s power2.out)
- "Revenue-first analytics": types on word-by-word at 0.5s (per-word kinetic, y:20→0 staggered)
- CTA button: SLIDES up at 1.2s (y: 30→0, opacity 0→1, 0.4s power2.out), then gentle continuous pulse (scale 1→1.02→1, 1.5s sine.inOut, repeat)
- Avatar stack: FLOATS in at 1.5s (y: 20→0, opacity 0→1, 0.3s)
- "Loved by 17,051 users": fades in at 1.8s
- Squiggle SVG: draws itself under tagline at 2.0s (stroke-dashoffset, 0.5s power2.out)
- Radial glow: slowly expands behind logo over full beat duration (scale 0.5→1.2, opacity 0→0.15)
- "datafa.st" URL: fades in bottom-right at 2.5s

**Techniques:** SVG path drawing (squiggle), per-word kinetic typography (tagline), variable font weight animation (logo emphasis)

**Depth layers:**

- BG: off-white (#FBFAF9) with subtle radial glow in light coral
- MG: logo, tagline, CTA button
- FG: avatar stack, URL, squiggle accent

**SFX:** Warm resolve chord (single note, sustained). Soft click on CTA appearance.

**Transition OUT:** None — hold final frame for 1s.

---

## Production Architecture

```
videos/datafast-launch/
├── index.html                    root — VO + underscore + beat orchestration
├── DESIGN.md                     brand reference
├── SCRIPT.md                     narration text
├── STORYBOARD.md                 THIS FILE — creative north star
├── transcript.json               word-level timestamps (from Step 5)
├── narration.wav                 TTS audio (from Step 5)
├── capture/                      captured website data
│   ├── screenshots/
│   ├── assets/
│   │   ├── svgs/
│   │   ├── fonts/
│   │   └── videos/
│   ├── extracted/
│   │   ├── tokens.json
│   │   ├── visible-text.txt
│   │   ├── asset-descriptions.md
│   │   ├── animations.json
│   │   └── detected-libraries.json
│   ├── AGENTS.md
│   └── CLAUDE.md
└── compositions/
    ├── beat-1-hook.html
    ├── beat-2-journey.html
    ├── beat-3-steps.html
    ├── beat-4-proof.html
    └── beat-5-cta.html
```
