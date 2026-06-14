# Cambium Ops Image-to-3D Trial Report

Date: 2026-06-12

## Input

- Source image: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source.png`
- Source prompt: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/ops-source-prompt.md`
- Generated with: `codex-gpt-image`, Codex OAuth, `gpt-image-2`, `1024x1024`

## Meshy Task

- Task ID: `019ebbbf-8657-7368-a8bd-46fcb514ae11`
- Pipeline: Meshy Image to 3D
- Request: `latest`, textured, PBR enabled, remesh enabled, target format `glb`, target polycount `60000`
- Consumed credits: `30`
- Ledger: `docs/plans/assets/cambium-r3f-game-engine-realignment/image-to-3d/meshy-image-task-ledger.json`

## Output

- Trial model: `apps/cambium-r3f/public/assets/meshy/image-to-3d/ops/model.glb`
- Trial thumbnail: `apps/cambium-r3f/public/assets/meshy/image-to-3d/ops/thumbnail.png`
- Trial manifest: `apps/cambium-r3f/public/assets/meshy/image-to-3d/manifest.json`
- Source PNG size: `1.6 MB`
- Trial GLB size: `18 MB`
- Thumbnail: `512x512`

## Visual Verdict

The image-to-3D trial is visually stronger than the earlier text-to-3D Ops mesh. It keeps the ring-island silhouette, low tactical terrain profile, hollow center, rocky contour strata, and Cambium chartreuse signal veins. The result reads more like an authored game asset and less like a generic generated token.

This is not runtime-ready yet. The GLB is above the current 15 MB per-asset budget and should not replace `/assets/meshy/islands/ops/model.glb` until it is optimized into a runtime derivative. That budget should not drive master generation; keep high-quality image-to-3D outputs as master candidates first, then optimize after visual approval.

## Next Decision

Use image-to-3D as the preferred art-pipeline direction for island candidates, but add one of these gates before replacement:

- Optimize the GLB through Blender/glTF tooling and verify it lands below the runtime budget.
- Rerun a lower-poly or remeshed Meshy derivative only after the high-quality master is visually approved.
- Build a local side-by-side route that can render text-to-3D and image-to-3D Ops assets under identical camera/material conditions.
