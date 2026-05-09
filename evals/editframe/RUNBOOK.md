# Devbox Eval Runbook

Run from the devbox, not from a Mac workstation.

```bash
ssh -i ~/.ssh/miguel.sierra-dev.pem ubuntu@10.0.9.220
cd /home/ubuntu/workspaces/hyperframes-oss
```

## What The Current Run Tested

1. Fresh Editframe project creation with `npm create @editframe@latest -- html -d editframe-smoke -y`.
2. Editframe creator flag mismatch: `--skip-skills` is advertised by help but rejected by the parser in `@editframe/create@0.49.7`.
3. Editframe default local render with `npx editframe render --no-include-audio --fps 30`.
4. Editframe browser fallback render with `EF_RENDER.renderStreaming({ fps: 30, codec: "vp9", includeAudio: false })`.
5. Fresh HyperFrames project creation with `npx hyperframes@latest init --example blank --skip-skills`.
6. HyperFrames `lint`, `validate`, timestamp `snapshot`, and local `render` through the published CLI.

## Required Artifacts Per Run

- generated source for both tools
- render logs
- `ffprobe` JSON for every successful output
- timestamp snapshots at 1.2s, 5.0s, 8.5s, and 9.4s
- codec support probe for browser/WebCodecs paths
- HTML report and JSON result summary

## Interpretation Rules

- Default command success weighs more than hidden fallback success.
- Do not compare render speed across different codecs as a final performance result.
- Do not score visual taste without blind judges.
- Cloud/API claims require live authenticated runs before being treated as proof.
