# Cambium R3F Game-Engine Realignment Verification

## Summary

The R3F app has been realigned from a dashboard-like route scaffold into a desktop tactical-map scene. The implementation keeps the isolated `apps/cambium-r3f` package and source-contract generator, but replaces the visual layer with engine, world, materials, and diegetic HUD subsystems.

Correction after review: this pass is only a modest improvement over the prior scaffold, not final visual parity. Treat it as a better technical/art-direction foundation that still needs a deeper game-engine art pass.

## Evidence

- Milestone: [Cambium R3F Game Engine Realignment](https://github.com/Sheshiyer/cambium/milestone/7)
- Issue map: `docs/plans/assets/cambium-r3f-game-engine-realignment/github-issues.md`
- Desktop screenshots: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/`
- Contact sheet: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/desktop-contact-sheet.png`
- Nonblank report: `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/desktop-nonblank-report.json`

## Verification Commands

- `npm run r3f:test` passed: 13 tests.
- `npm run r3f:build` passed.
- Local Vite server ran at `http://127.0.0.1:5175/`.
- Playwright captured all nine desktop routes at `1440x900`.

## Screenshot Set

- `home.png`
- `island-genesis.png`
- `island-taste.png`
- `island-build.png`
- `island-ops.png`
- `island-cortex.png`
- `elements-settings.png`
- `visualizations.png`
- `figma-components.png`

## Not-Dashboard Review

Pass. The dominant experience is now a spatial tactical scene: organ islands, curved rails, packet markers, camera modes, contour substrate, and sparse HUD controls. The HUD remains secondary to the scene and route changes are represented as camera/world states rather than page panels.

Not accepted as final reference quality. The scene still needs authored/procedural mesh richness, stronger materials, post-processing atmosphere, in-world typographic systems, denser world composition, and a perceptual reference-comparison gate.

Remaining follow-ups:

- Build a deeper art pipeline for island meshes, shader materials, lighting, fog, and camera choreography.
- Add reference-comparison review criteria beyond nonblank pixels and route coverage.
- Split the large Three/R3F production chunk in a later performance-hardening issue.

## Art Pass 02 Update

Art Pass 02 implemented the first deeper art-pipeline layer: procedural island meshes, shader terrain strata, atmosphere sheets, CSS post-process overlays, in-world labels, cinematic camera drift, and a structural perceptual reference gate.

Evidence:

- `docs/plans/assets/cambium-r3f-game-engine-realignment/art-pass-02-verification.md`
- `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-contact-sheet.png`
- `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-nonblank-report.json`

Still not final reference parity. This pass is a stronger art foundation, not the end state.
