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

## Connector Integration Update

The `rail-arc` optimized candidate now drives the visual connector language in the tactical overview as a scene-preview specimen. This is not a final promotion: the generated connector remains `promotedRuntimeAsset: false`, and scale approval is still gated by user review.

The main scene now combines:

- organic CambiumField substrate instead of checkerboard/grid helper
- physical basalt rail slabs
- chartreuse signal lanes
- endpoint collars
- generated `rail-arc` connector previews at rail midpoints
- packet markers riding above the physical connectors
- island connection ports on every rail endpoint
- a current-position process beacon in world space
- source-plate-derived procedural signal packets and emitter nodes

## Verification Commands

- `npm run r3f:test`
- `npm run r3f:build`
- browser visual e2e skipped by request; user feedback is the flow acceptance gate

Build hardening: Vite now splits React, R3F, Three, Coolshapes, and remaining vendor modules into named manual chunks so the R3F build warning does not stand in for visual acceptance work.
