# Thoughtseed physical lane manifest

Status: Phases 1 and 2 applied and verified; Phase 3 Symphonics remains held.

Preflight receipt: `docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-preflight.v1.json`.

## Order

1. Cambium archive-first promote/swap.
2. Temperance landing-page archive-first promote after completed reconciliation and exact live-apply approval.
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

Decision: archive-first promote while preserving the `website` infrastructure container.

The canonical slot `$PROJECTS_ROOT/thoughtseed/temperance-engine-landing-page` exists but is not a Git repository. The nested checkout `$PROJECTS_ROOT/thoughtseed/website/temperance-engine-landing-page` is the exact `Sheshiyer/temperance_engine_landing_page` authority.

Reconciliation is complete and recorded in
`docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-2-preflight.v1.json`.
Fifty non-sensitive files are byte-identical. The shallow-only and changed
Finder metadata remains recoverable in the displaced-tree archive. The broader
shallow `.gitignore` is preserved but does not overwrite the tracked authority
policy. Sensitive ignored content was not inspected and remains protected by
archive-first movement.

The nested untracked `_PROJECT-STATUS.md` is identical to its shallow
counterpart and receives a dedicated archive target before a clean-Git
assertion. After promotion, the now-empty `website` directory remains
infrastructure, so the accepted 58-directory root map and digest stay unchanged.

The founder supplied the exact approval text
`approve live apply phase 2 Temperance archive-first promote preserve website container`.
The apply completed without copying, merging, overwriting, or deleting content.
The exact Git authority now occupies the canonical shallow slot; the prior
shallow state and nested status file remain in their named archive targets; the
`website` container remains empty infrastructure. Apply receipt:
`docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane-phase-2-apply-receipt.v1.json`.

## Held

Symphonics is not part of the physical apply lane. Do not create a `symphonics` folder, do not generate active mapping receipts, and do not remove it from `missingClientAccounts` until the future native-app role is exact.

## Live-Apply Gate

A future live apply must prove:

- fresh depth-one directory comparison before mutation;
- fresh Git identity and clean-state probes for every moved checkout;
- exact archive or rollback target for every changed folder;
- root-map digest regenerated after accepted physical state;
- separate founder live-apply approval.
