# Master Comparison Verification

## Scope

This pass adds `#asset-comparison`, a scene-native R3F QA route for side-by-side review of:

- source plates from the image-first pass
- current promoted runtime Meshy text-to-3D assets
- high-quality image-to-3D masters and their optimized runtime candidates

The route is a post-freeze QA surface, not part of the original nine screenshot-reference routes.

## Screenshot Evidence

- Screenshot: `asset-comparison.png`
- Asset Review Bay screenshot: `asset-review-bay.png`
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

## Asset Review Bay Continuation

The `#asset-comparison` route now includes a fourth in-world review instrument beside `SOURCE`, `CURRENT`, and `MASTER`.

Review is deliberately advisory, not automatic. Each candidate carries a weighted perceptual packet:

- source fidelity
- silhouette richness
- material depth
- scale legibility
- runtime derivative status
- scene fit

The review threshold is `86`, but the gate state remains `manual-approval-required` for every asset. A candidate can be `review-ready` without being promoted.

Current status:

| Asset | Review Score | Readiness | Blocker | Promotion |
| --- | ---: | --- | --- | --- |
| `genesis` | `86` | `review-ready` | none | `not-promoted` |
| `rail-arc` | `80` | `needs-art-pass` | connector scale needs scene-side approval | `not-promoted` |

## Verification Commands

- `npm run r3f:test`
- `npm run r3f:build`
- Playwright route capture at `#asset-comparison`

Known residual: Vite still emits the existing large Three/R3F chunk warning.
