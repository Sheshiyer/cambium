# Cambium R3F Visual Engine

Maintained desktop visual engine for the Cambium v0.3.0 Urania constellation app.

## Scope

- Isolated Vite + React + React Three Fiber package.
- Source contract generated from the root Cambium pipeline, Cortex contracts, shared mini-app surface, frozen references, and quest line.
- Constellation overview with five organ clusters, cortex center, rail links, packet markers, HUD telemetry, MAP/SHEETS/WORKFORCE modes, identity context, and signed-action controls.
- Worker access is optional and configured through the in-app worker URL; missing or offline Worker data falls back honestly to synthetic local state.
- Visual tokens constrained to the Cambium/Cortex palette and motion rules.

## Commands

From the repo root:

```bash
npm run r3f:sync
npm run r3f:test
npm run r3f:build
npm run r3f:dev
npm run desktop:dev
npm run desktop:test
npm run desktop:smoke:packaged
npm run desktop:dist:mac:dir
npm run desktop:dist:mac
npm run r3f:meshy -- plan
```

## Contract

The generated bridge lives at `src/generated/source-contract.ts`. Refresh it with `npm run r3f:sync`; do not edit it by hand.

Frozen references remain owned by `docs/plans/assets/cambium-r3f-implementation/reference-freeze.json`.

`npm run sync:contracts` is deterministic and preserves the committed quest summary even when ignored `.operator` state exists locally. Refresh that summary from a local operator ledger only through the explicit `npm run sync:contracts:refresh` command, then review and commit the generated diff deliberately.

## Meshy Asset Pipeline

The Meshy key is expected as `MESHY_API_KEY` in `$HOME/.claude/.env` or the process environment. The pipeline is credit-safe by default: planning and prompt validation do not call Meshy, and paid preview/refine calls require `--execute`.

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

This app targets a macOS/laptop Electron shell. Mobile acceptance is out of scope. WORKFORCE can display the
current local or invited principal context; a remote principal directory remains a later governed surface.

Browser visual e2e and automated screenshot approval are skipped by request. Verification should use `npm run r3f:test`, `npm run r3f:build`, `npm run desktop:test`, `npm run validate`, and `npm run render-docs:check`; final flow acceptance comes from user perceptual feedback on the desktop scene.

## Electron desktop package

The desktop shell lives beside the renderer in `desktop/`. It loads the Vite output through the secure
`cambium://app/` protocol, with context isolation, disabled Node integration, renderer sandboxing,
denied permissions, blocked new windows, and navigation limited to the local app or development server.
The preload bridge exposes only a non-privileged desktop marker; the renderer does not receive Worker
credentials or filesystem APIs.

```bash
# Run the live renderer inside Electron during development.
npm run desktop:dev

# Build and inspect the local macOS application bundle.
npm run desktop:dist:mac:dir
# → release/mac-arm64/Cambium.app on Apple Silicon

# Build DMG and ZIP targets when local distribution artifacts are needed.
npm run desktop:dist:mac
```

`desktop:test` checks the shell policy, relative build output, required tapestry/GLB assets, and secret
exclusion. After `desktop:dist:mac:dir`, `desktop:smoke:packaged` launches the actual bundled executable
with GPU disabled and waits for the `cambium://app/` ready marker. The CI desktop workflow proves the
macOS unpacked artifact path. Developer ID signing and
notarization require explicitly provisioned Apple credentials; automatic updates are not enabled.
The app uses the operating system default icon until a reviewed Cambium icon asset is approved.

## Current Visual Flow Direction

The tactical overview uses `CambiumField` as the living substrate: dense organic geometry, contour paths, and radial seams instead of a checkerboard grid. Rail links use physical slabs, signal lanes, endpoint collars, packet markers, and the generated `rail-arc` connector candidate as a scene-preview specimen. The generated connector is still manual-review gated and is not marked as a promoted runtime asset.

The living flow layer uses generated source-plate prop language as procedural meshes: `signal-packet` beads travel over rails, `emitter-node` ports attach rail endpoints to islands, `process-beacon` marks the current process position in world space, and `visualization-lens` overlays render flow, density, heat, dependency, runner, and emitter status spatially instead of as charts.
