---
name: bgm-to-video
description: >
  Use when the user has a BGM / background-music track (audio file, or a video to pull
  audio from) and wants a music-grounded, beat-synced HyperFrames video. This is the
  template-driven path: a deterministic analyzer reads the beat, a Music Reader classifies
  the track into sections and marks where each could be cut finer (beat type + mood, no
  content), then a Director decides each section's groups (it alone sees the templates) and
  matches each to a reverse-engineered Group Template from a catalog and adapts
  it (binding copy, palette, and timing), falling back to free creative-coding when no
  template fits, and a Builder realizes it as one paused-GSAP HyperFrames composition.
  V1 is asset-free: typography, generative shader/geometry backgrounds, code-native
  motion. "template" names the method (match-and-adapt), not a fixed look.
metadata:
  {
    "tags": "bgm, music, beat-sync, templates, group-template, creative-coding, typography, gsap, hyperframes, visual-plan",
  }
---

# bgm-to-video — template-driven, music-grounded video

Input is a **BGM track**. Output is a beat-synced HyperFrames video where **music is the
spine; the visual for each group is chosen by matching a reverse-engineered template**,
not invented from scratch each time. When nothing matches, the Director free-composes —
the catalog is a head start, not a cage.

## Two layers

| Layer                      | Artifact                          | What it is                                                                    | Used by  |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------------------- | -------- |
| **L0 · Motion Primitives** | `references/motion-primitives.md` | atoms: one anchor → one GSAP micro-move                                       | Builder  |
| **L1 · Group Templates**   | `templates/<id>/`                 | a whole-group archetype (roles + timing + stop rule + exit), composed from L0 | Director |

The linchpin: the **Music Reader's per-group output** and a **template's match-face** are
the same schema — `GroupSignature` (`references/signature-schema.md`). Matching is then
mechanical.

## How templates get into the catalog

Templates are **reverse-engineered from golden-sample videos** by the
`bgm-golden_sample_reverse` skill (`reverse-to-template.md`): slice a group → beatgrid
(signature) → Gemini video analysis (roles/motion/transition) → a `card.json` (+ a
parameterized reference `index.html`), promoted into `templates/<id>/`.

## Pipeline

| #   | Phase      | Exec     | Artifact            | Detail                                                                                                              |
| --- | ---------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0   | init       | Bash     | `assets/bgm.mp3`    | create project, place/extract BGM                                                                                   |
| 1   | analyze    | Python   | `audiomap.json`     | deterministic beat / energy / roll / hard-stop analysis                                                             |
| 2   | read music | subagent | `music-read.json`   | Music Reader → `sections[]` (a `GroupSignature` each) + `cut_candidates[]` (classify only; no group-count decision) |
| 3   | plan       | subagent | `visual-plan.json`  | Director → subdivide sections into groups (catalog-aware) + match a template per group + adapt; else free-compose   |
| 4   | build      | subagent | `index.html`        | Builder → mount each group (fork template impl, or author from L0) on one timeline                                  |
| 5   | verify     | Bash     | gate                | lint + validate + inspect                                                                                           |
| 6   | render     | Bash     | `renders/video.mp4` | muxed video with BGM                                                                                                |
| 7   | finalize   | subagent | repaired output     | snapshot QA + one repair loop                                                                                       |

`SKILL_DIR` = this skill directory. `PROJECT_DIR` = `videos/<project-name>/`.

## Step 0 — Init project + place BGM

```bash
mkdir -p "$PROJECT_DIR/assets" "$PROJECT_DIR/renders"
cp "<user-music>" "$PROJECT_DIR/assets/bgm.mp3"   # extract from video first if needed
```

Optional style files at the project root: `frame.md`, `design.md` / `DESIGN.md`.

## Step 1 — Analyze the music

```bash
python3 <SKILL_DIR>/scripts/analyze-beatgrid.py "$PROJECT_DIR/assets/bgm.mp3" \
  -o "$PROJECT_DIR/audiomap.json" --print
```

Writes the canonical timing source. Sections are NOT baked in.

## Step 2 — Read music (Music Reader → music-read.json)

Dispatch one subagent. Prompt = full contents of [`agents/music-reader.md`](agents/music-reader.md) + dispatch context:

```text
SKILL_DIR: <absolute path>
PROJECT_DIR: <absolute path>
AudioMap: <PROJECT_DIR>/audiomap.json
Signature schema: <SKILL_DIR>/references/signature-schema.md
Write music read to: <PROJECT_DIR>/music-read.json
```

The Music Reader **only classifies**: it cuts the track into **sections** (musical
macro-structure), writes a `GroupSignature` per section, and lists each section's
**`cut_candidates`** — the musically-legal places it _could_ be cut finer. It does **not**
decide how many groups a section becomes (that needs the catalog, which it can't see). No
copy, no fonts, no colors, no layout.

## Step 3 — Plan (Director → visual-plan.json)

Dispatch one subagent. Prompt = full contents of [`agents/director.md`](agents/director.md) + dispatch context:

```text
SKILL_DIR: <absolute path>
PROJECT_DIR: <absolute path>
User request / brief: <user's request and supplied copy>
AudioMap: <PROJECT_DIR>/audiomap.json
MusicRead: <PROJECT_DIR>/music-read.json
Template catalog: read EVERY <SKILL_DIR>/templates/*/card.json (status:"promoted")
Signature schema: <SKILL_DIR>/references/signature-schema.md
Template definition: <SKILL_DIR>/references/template-definition.md
Transition catalog: <SKILL_DIR>/references/transition-catalog.md
Visual plan contract: <SKILL_DIR>/references/visual-plan-contract.md
Motion primitives (for free-compose): <SKILL_DIR>/references/motion-primitives.md
Style files to read if present: <PROJECT_DIR>/frame.md, design.md, DESIGN.md
Write visual plan to: <PROJECT_DIR>/visual-plan.json
```

The Director first **subdivides each section into groups** by acting on its
`cut_candidates` (catalog-aware: keep a section whole when one template fits, split it when
a template would be stretched or it spans multiple gestures), then matches each group to a
promoted template, binds the template's params (copy it writes from the brief, palette from
mood, anchors from this group's beats), reconciles the stop rule to the group boundary,
plans `fast_cut` transitions, and free-composes any group with no match. It does **not**
write HTML/GSAP.

## Step 4 — Build (Builder → index.html)

Dispatch one subagent. Prompt = full contents of [`agents/builder.md`](agents/builder.md) + dispatch context:

```text
SKILL_DIR: <absolute path>
PROJECT_DIR: <absolute path>
AudioMap: <PROJECT_DIR>/audiomap.json
VisualPlan: <PROJECT_DIR>/visual-plan.json
Template reference impls: for each group with a templateRef, <SKILL_DIR>/templates/<templateRef>/index.html
Visual plan contract: <SKILL_DIR>/references/visual-plan-contract.md
Template definition: <SKILL_DIR>/references/template-definition.md
Motion primitives: <SKILL_DIR>/references/motion-primitives.md
Builder contract: <SKILL_DIR>/references/builder-contract.md
BGM path for HTML: assets/bgm.mp3
Write composition to: <PROJECT_DIR>/index.html
```

The Builder mounts each group as a gated sub-scene on ONE paused timeline: fork the
group's template reference impl and re-host its tweens at the group's absolute audio
seconds (or author from L0 primitives when free-composed), then apply the group→group
transitions.

## Step 5 — Verify gates

```bash
( cd "$PROJECT_DIR" && npx hyperframes lint . && npx hyperframes validate . )
( cd "$PROJECT_DIR" && npx hyperframes inspect . )
```

Inspect: t=0, each group's `span_sec` start, each transition `at`, the final frame. On
failure → Step 7.

## Step 6 — Render

```bash
( cd "$PROJECT_DIR" && npx hyperframes render . -q draft -o renders/video.mp4 --fps 30 )
```

Expect video + audio, duration == `audiomap.audio.duration_sec`.

## Step 7 — Finalize / repair

Dispatch one subagent. Prompt = full contents of [`agents/finalize.md`](agents/finalize.md) + the contracts above + the verbatim gate-failure output. Finalize edits `index.html` only; if the plan is creatively wrong, return to Step 3.

## Resume table

| You have              | Continue from |
| --------------------- | ------------- |
| `assets/bgm.mp3` only | Step 1        |
| `audiomap.json`       | Step 2        |
| `music-read.json`     | Step 3        |
| `visual-plan.json`    | Step 4        |
| `index.html`          | Step 5        |
| gates passed          | Step 6        |
| a gate failed         | Step 7        |

## Directory layout

```
bgm-to-video/
  SKILL.md
  agents/        music-reader.md · director.md · builder.md · finalize.md
  references/    signature-schema.md · template-definition.md · transition-catalog.md
                 visual-plan-contract.md · motion-primitives.md (L0) · builder-contract.md
  scripts/       analyze-beatgrid.py
  templates/     <id>/ { card.json · index.html · README.md }   ← the L1 catalog
```
