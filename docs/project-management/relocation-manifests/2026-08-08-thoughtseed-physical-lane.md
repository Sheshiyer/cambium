# Thoughtseed physical lane manifest

Status: Phase 1 applied and verified; Phase 2 remains blocked on local-state reconciliation and separate approval.

Preflight receipt: `docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-preflight.v1.json`.

## Order

1. Cambium archive-first promote/swap.
2. Temperance landing-page promote-authority de-dup after local-state reconciliation.
3. Symphonics stays held until the future native SDK / Tuya React Native app role is exact.

## Shared Boundary

`$PROJECTS_ROOT/thoughtseed` is the shallow portfolio root. Active WorkObject folders live directly under `$PROJECTS_ROOT/thoughtseed/<folder>`.

`$PROJECTS_ROOT/thoughtseed/thoughtseed-labs` remains R2/vault infrastructure context, never a WorkObject folder. This manifest must not move, rename, archive, or promote anything inside `thoughtseed-labs`.

## Phase 1: Cambium

Decision: archive-first promote.

Applied after the founder supplied the exact approval text `approve live apply phase 1 Cambium archive-first promote`.

The canonical slot `$PROJECTS_ROOT/thoughtseed/cambium` is now the exact `Sheshiyer/cambium` Git checkout. The former non-Git `cambium` state is preserved at `$PROJECTS_ROOT/thoughtseed/_physical-relocation-archive-2026-08-08/cambium-pre-git-authority`; it was moved, not overwritten or deleted.

The archive target is `$PROJECTS_ROOT/thoughtseed/_physical-relocation-archive-2026-08-08/cambium-pre-git-authority`. The manifest creates the archive container because the older `_home-cleanup-2026-08-08` infrastructure folder is no longer present on disk and has been approved as ignorable, non-blocking drift.

Apply receipt: `docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-1-apply-receipt.v1.json`.

Accepted post-apply root-map digest: `8a3b3bb07018ebbf44f4ad13e88b3f48f616d43daa1b7faf7d03f4ddfc6dafbe`.

## Phase 2: Temperance

Decision: defer promote-authority.

The canonical slot `$PROJECTS_ROOT/thoughtseed/temperance-engine-landing-page` exists but is not a Git repository. The nested checkout `$PROJECTS_ROOT/thoughtseed/website/temperance-engine-landing-page` is the exact `Sheshiyer/temperance_engine_landing_page` authority.

This phase is not live-apply ready. Before any de-duplication, preserve local-only state, review the `.gitignore` delta, clean or archive the nested untracked `_PROJECT-STATUS.md`, and choose whether the `website` container remains infrastructure or is archived.

## Held

Symphonics is not part of the physical apply lane. Do not create a `symphonics` folder, do not generate active mapping receipts, and do not remove it from `missingClientAccounts` until the future native-app role is exact.

## Live-Apply Gate

A future live apply must prove:

- fresh depth-one directory comparison before mutation;
- fresh Git identity and clean-state probes for every moved checkout;
- exact archive or rollback target for every changed folder;
- root-map digest regenerated after accepted physical state;
- separate founder live-apply approval.
