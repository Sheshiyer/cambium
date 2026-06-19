# Cambium R3F Visual Engine

Phase 1 app surface for the Cambium 2.5D process map.

## Scope

- Isolated Vite + React + React Three Fiber package.
- Source contract generated from the root Cambium pipeline, Cortex contracts, frozen screenshot manifest, and quest line.
- Initial overview scene with stage nodes, cortex rail links, packet markers, and HUD telemetry.
- Visual tokens constrained to the Cambium/Cortex palette and motion rules.

## Commands

From the repo root:

```bash
npm run r3f:sync
npm run r3f:test
npm run r3f:build
npm run r3f:dev
npm run r3f:meshy -- plan
```

## Contract

The generated bridge lives at `src/generated/source-contract.ts`. Refresh it with `npm run r3f:sync`; do not edit it by hand.

Frozen references remain owned by `docs/plans/assets/cambium-r3f-implementation/reference-freeze.json`.

## Meshy Asset Pipeline

The Meshy key is expected as `MESHY_API_KEY` in the process environment or in `CAMBIUM_ENV_FILE` (`~/.config/cambium/.env` by default). The pipeline is credit-safe by default: planning and prompt validation do not call Meshy, and paid preview/refine calls require `--execute`.

Prompt specs live at `asset-prompts/meshy-island-prompts.json`.

```bash
# Dry-run plan with credit estimate.
npm run r3f:meshy -- plan

# Paid preview generation. Estimated 20 credits for Meshy-6 preview.
npm run r3f:meshy -- preview --island genesis --execute

# Free status check for a task id.
npm run r3f:meshy -- status --task-id <task-id>

# Paid texture refine. Estimated 10 credits.
npm run r3f:meshy -- refine --island genesis --preview-task-id <preview-task-id> --execute

# Download a completed GLB into the Vite public asset manifest.
npm run r3f:meshy -- download --island genesis --task-id <refine-task-id> --execute
```

Downloaded assets are written under `public/assets/meshy/islands/<island>/` and indexed in `public/assets/meshy/islands/manifest.json`. Do not commit API keys or signed Meshy URLs.

## Routes

- `/` — home overview
- `/#island-genesis`
- `/#island-taste`
- `/#island-build`
- `/#island-ops`
- `/#island-cortex`
- `/#elements-settings`
- `/#visualizations`
- `/#figma-components`
- `/#asset-comparison`

## Desktop QA Boundary

This app targets a macOS/laptop Electron shell. Mobile acceptance is out of scope.

Browser visual e2e and automated screenshot approval are skipped by request. Verification should use `npm run r3f:test`, `npm run r3f:build`, `npm run validate`, and `npm run render-docs:check`; final flow acceptance comes from user perceptual feedback on the desktop scene.

## Current Visual Flow Direction

The tactical overview uses `CambiumField` as the living substrate: dense organic geometry, contour paths, and radial seams instead of a checkerboard grid. Rail links use physical slabs, signal lanes, endpoint collars, packet markers, and the generated `rail-arc` connector candidate as a scene-preview specimen. The generated connector is still manual-review gated and is not marked as a promoted runtime asset.

The living flow layer uses generated source-plate prop language as procedural meshes: `signal-packet` beads travel over rails, `emitter-node` ports attach rail endpoints to islands, `process-beacon` marks the current process position in world space, and `visualization-lens` overlays render flow, density, heat, dependency, runner, and emitter status spatially instead of as charts.
