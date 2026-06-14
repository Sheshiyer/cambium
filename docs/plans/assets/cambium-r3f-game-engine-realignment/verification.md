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

## Historical Screenshot Verification

- `npm run r3f:test` passed: 13 tests.
- `npm run r3f:build` passed.
- Local Vite server ran at `http://127.0.0.1:5175/`.
- Playwright captured all nine desktop routes at `1440x900`.

## Current QA Policy

As of the continuation pass, browser visual e2e is not the acceptance path. The app now carries a typed desktop QA policy in `apps/cambium-r3f/src/scene/desktop-qa-policy.ts`:

- target shell: macOS/laptop Electron
- review viewports: `1440x900`, `1512x982`, and `1728x1117`
- inputs: keyboard, mouse, and trackpad
- out of scope: mobile layouts, touch-first navigation, and phone breakpoint QA
- automated proof: unit tests, production build, root validation, and docs render check
- final visual/flow approval: user perceptual feedback on the desktop scene

Current continuation verification:

- `npm run r3f:test` passed: 43 tests.
- `npm run r3f:build` passed with named React, R3F, Three, Coolshapes, and vendor chunks.
- `npm run validate` passed.
- `npm run render-docs:check` passed.
- `npm test` passed: 249 tests.
- Browser visual e2e was deliberately skipped.

## CambiumField + Connector Batch

The next high-leverage visual batch replaces the scaffold-like checkerboard substrate with a living field and starts using the generated connector asset language between islands.

Implemented:

- `apps/cambium-r3f/src/world/cambium-field.ts` defines the dense vertex-colored CambiumField geometry, organic contour paths, and radial seam paths.
- `apps/cambium-r3f/src/world/generated-connectors.ts` binds the generated `rail-arc` optimized candidate as a scene-preview connector contract while keeping `promotedRuntimeAsset: false`.
- `CambiumScene` now renders `CambiumField` instead of the former flat plane plus `gridHelper`.
- `RailNetwork` now renders physical rail bodies, visible signal lanes, endpoint collars, packet flow, and generated `rail-arc` preview specimens.
- Tests assert the field is not checkerboard-based and that `gridHelper` does not return to the scene source.

Boundary:

- The `rail-arc` generated GLB is integrated as a preview connector language for visual flow review.
- It is still not auto-promoted as a final runtime asset; connector scale remains user-review gated.

## Living Flow + Visualization Batch

The follow-on batch turns generated source-plate props into procedural scene mesh grammar without claiming GLB promotion.

Implemented:

- `apps/cambium-r3f/src/world/living-flow-assets.ts` records source-plate-backed mesh roles for `signal-packet`, `emitter-node`, `process-beacon`, and `visualization-lens`.
- Rail packets are now faceted physical beads instead of plain spheres.
- Every rail endpoint receives an island connection port so rails feel attached to organ objects.
- The active process position is marked in world space by a physical `YOU ARE HERE` beacon.
- Focused islands render terrain seams so zoom states feel connected to the shared substrate.
- The visualization route renders flow, signal density, process heat, dependency graph, runner status, and emitter status as spatial overlay lenses instead of charts.

Boundary:

- These prop assets currently use procedural scene meshes guided by generated source plates.
- Additional paid image-to-3D GLBs for `signal-packet`, `emitter-node`, `process-beacon`, and `visualization-lens` remain future gated work.

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
- Keep route flow open for user feedback instead of treating screenshots as final acceptance.

## Art Pass 02 Update

Art Pass 02 implemented the first deeper art-pipeline layer: procedural island meshes, shader terrain strata, atmosphere sheets, CSS post-process overlays, in-world labels, cinematic camera drift, and a structural perceptual reference gate.

Evidence:

- `docs/plans/assets/cambium-r3f-game-engine-realignment/art-pass-02-verification.md`
- `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-contact-sheet.png`
- `docs/plans/assets/cambium-r3f-game-engine-realignment/verification/art-pass-02/desktop-nonblank-report.json`

Still not final reference parity. This pass is a stronger art foundation, not the end state.
