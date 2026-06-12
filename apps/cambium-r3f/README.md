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

The Meshy key is expected as `MESHY_API_KEY` in `/Users/sheshnarayaniyer/.claude/.env` or the process environment. The pipeline is credit-safe by default: planning and prompt validation do not call Meshy, and paid preview/refine calls require `--execute`.

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
