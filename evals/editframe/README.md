# Editframe Evaluation Suite

This suite compares HyperFrames and Editframe on real execution paths, not only docs claims.

Current devbox run:

- Report: `reports/devbox-2026-04-30.html`
- Machine-readable results: `reports/devbox-2026-04-30-results.json`
- Artifacts: `artifacts/devbox-2026-04-30/`

The eval intentionally separates:

- default user path: the command a new user would run first
- expert fallback path: lower-level API or codec workarounds
- source/docs evidence: product capabilities not authenticated or exercised live
- subjective quality: requires blind human judging and is not decided by this run

## Current Devbox Conclusion

On `ip-10-0-9-220`, HyperFrames is more reliable for default local MP4 rendering. The published HyperFrames CLI rendered a valid 10s 1920x1080 H.264 MP4. The published Editframe CLI failed on its default AVC WebCodecs encoder config, but the same Editframe fixture rendered successfully through `EF_RENDER.renderStreaming({ codec: "vp9" })`.

This is not a final taste benchmark. It is a devbox execution/workflow eval over one precise-timing fixture.
