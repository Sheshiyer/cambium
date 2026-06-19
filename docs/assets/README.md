# Asset Provenance and Size Policy

Cambium ships as a standalone fractal tapestry. Visual assets may prove the
R3F direction, but they must not carry private company state, customer data, or
unclear redistribution assumptions into the product.

## Release Contract

- Every committed runtime visual asset is covered by `docs/assets/provenance.json`.
- Runtime GLB assets stay below 15 MB each.
- Oversized GLBs are allowed only as QA/reference candidates when the manifest
  marks them `qa-only-not-promoted` and points at an optimized runtime candidate.
- QA/reference assets are design evidence, not product defaults. Before a public
  standalone release they must either be removed, moved to release artifacts/LFS,
  or explicitly approved as distributable reference material.
- Screenshots and source plates must be synthetic Cambium reference material.
  They may show the fractal tapestry, organs, rails, UI states, or design
  comparisons, but not private org data, live credentials, private host paths,
  or customer transcripts.
- Generated assets must keep their provider/task provenance where available.
  If provider terms are not independently reviewed, the approval status remains
  `redistribution-review-required`.

## Current Decision

For the v0.2.x standalone-release track:

- Promoted runtime Meshy island GLBs remain in git because each is below the
  15 MB runtime budget and has matching task provenance in the public manifest.
- Image-to-3D master GLBs remain in git only as QA evidence while the R3F
  milestone is open. They are not runtime defaults and must keep matching
  optimized candidates under the runtime budget.
- Screenshot packs remain in git as synthetic visual QA evidence.
- No asset in this policy may depend on any specific company, chat provider,
  founder account, or live client workspace to render.

## Review Checklist

1. Add or update the provenance entry before committing new visual assets.
2. Mark whether the asset is `runtime`, `qa-reference`, or `docs-only`.
3. Set the source provider and task id, prompt file, or generating script.
4. Record license/terms state as `generated-review-required`,
   `project-owned-synthetic`, or a reviewed license id.
5. Record approval status: `approved-runtime`, `qa-only-not-promoted`,
   `docs-only`, or `redistribution-review-required`.
6. Run `npm test`, `npm run standalone:audit`, and `npm run r3f:test`.
