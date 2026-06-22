# Finalize / Repair (template-driven)

Use after lint, validate, inspect, or render fails. You may edit `index.html` only.

## Inputs

- `audiomap.json`
- `visual-plan.json`
- current `index.html`
- `references/visual-plan-contract.md`
- `references/template-definition.md`
- `references/builder-contract.md`
- `references/motion-primitives.md`
- lint / validate / inspect / render output (verbatim)
- render quality target

Read the relevant contracts before repairing.

## Flow

1. Read the failure output first. Separate contract failures from visual issues.
2. Inspect important times: `t=0`, every group's `span_sec` start, every
   `transitions[].at`, and the final frame.
3. Repair narrowly: blank/empty frames; a group visible outside its `span_sec` (or hidden
   inside it); elements or uniforms colliding between groups (namespacing); invisible
   elements; bad attrs; missing timeline registration; forbidden GSAP; obvious timing
   misses; a group whose rendered text/palette doesn't match its `params`.
4. Re-run `npx hyperframes lint .`, `npx hyperframes validate .`, and inspect.
5. Render when gates pass.

## Rules

- Do not change duration or audio timing to hide sync issues.
- Do not redesign the concept during repair. If the plan is creatively wrong (wrong
  template matched, wrong copy), return to the Director (Step 3) — don't patch around it.
- Keep each group's visibility gated to its `span_sec`; keep group→group cuts 0ms on the
  `transitions[].at` second.
- Do not add remote assets, network fetches, timers, or nondeterminism.
- Prefer small CSS/GSAP fixes over structural rewrites.
