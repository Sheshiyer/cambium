# Master Comparison Verification

## Scope

This pass adds `#asset-comparison`, a scene-native R3F QA route for side-by-side review of:

- source plates from the image-first pass
- current promoted runtime Meshy text-to-3D assets
- high-quality image-to-3D masters and their optimized runtime candidates

The route is a post-freeze QA surface, not part of the original nine screenshot-reference routes.

## Screenshot Evidence

- Screenshot: `asset-comparison.png`
- Pixel report: `desktop-nonblank-report.json`
- Browser route: `http://127.0.0.1:5174/#asset-comparison`
- Viewport: `1440x900`
- Canvas count: `1`
- Active route: `ASSET QA`
- Non-background ratio: `0.4445`
- Unique sampled colors: `8378`

## Optimization Evidence

The full master GLBs remain preserved under `public/assets/meshy/image-to-3d/{asset}/model.glb`.

Optimized candidates are separate files under `public/assets/meshy/image-to-3d/{asset}/optimized/model.glb` and are registered in `optimized-candidates.json`.

| Asset | Master | Optimized Candidate | Method | Runtime Budget |
| --- | ---: | ---: | --- | --- |
| `genesis` | `71,054,312` bytes | `12,317,204` bytes | `texture-1536-grid256` | pass |
| `rail-arc` | `55,987,668` bytes | `15,522,024` bytes | `texture-1536` | pass |

`genesis` needed local vertex clustering because texture-only optimization stayed at `33,242,196` bytes. `rail-arc` passed budget with texture resizing only.

## Promotion Gate

No optimized candidate is promoted into `src/world/meshy-assets.ts`.

The promoted runtime registry still points at `/assets/meshy/islands/*`. The optimized image-to-3D derivatives are QA/runtime candidates only until manual visual approval.

## Verification Commands

- `npm run r3f:test`
- `npm run r3f:build`
- Playwright route capture at `#asset-comparison`

Known residual: Vite still emits the existing large Three/R3F chunk warning.
