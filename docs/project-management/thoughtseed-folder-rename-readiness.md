# Thoughtseed folder rename readiness

This artifact now records one completed physical transition: Cambium Phase 1 archive-first promotion. Batch 5 itself remains source-controlled closeout/exclusion work and does not authorize later physical changes.

Active manifest proposal: `docs/project-management/relocation-manifests/2026-08-08-thoughtseed-physical-lane.v1.json`.

## Boundary

`$PROJECTS_ROOT/thoughtseed` is the shallow portfolio root. Active WorkObject folders live directly under `$PROJECTS_ROOT/thoughtseed/<folder>`.

`$PROJECTS_ROOT/thoughtseed/thoughtseed-labs` is R2/vault infrastructure context, never a WorkObject folder. Evidence references from `thoughtseed-labs` may support `program:thoughtseed-vault`, but they do not make the vault context live project state, code history, repository ownership, or planning authority.

## When Renames Happen

Physical renames happen only after a separate founder-approved relocation manifest exists. That manifest must list exact `from` and `to` paths, archive or rollback targets, closeout disposition where relevant, dry-run directory comparison, post-apply directory comparison, root-map digest regeneration, and a separate live-apply approval.

The rename pass should not run during repository evidence mapping, Batch 5 closeout/exclusion handling, R2 evidence prefix planning, or Workbench bundle regeneration.

## Current Decisions

| Subject | State | Next physical action |
| --- | --- | --- |
| `thoughtseed-labs` | Infrastructure boundary is settled. | None for active WorkObject mapping. |
| `cambium` / `cambium-authoritative` | Phase 1 applied and verified. The exact Git checkout now occupies `cambium`; stale non-Git state is preserved in `_physical-relocation-archive-2026-08-08/cambium-pre-git-authority`. | None unless rollback is required; use the Phase 1 apply receipt. |
| `website` / `temperance-engine-landing-page` | Phase 2 applied and verified. The clean exact checkout now occupies the shallow slot; prior shallow state and nested status remain archived; `website` remains empty infrastructure. | None unless rollback is required; use the Phase 2 apply receipt. |
| `symphonics` | Founder hold: missing shallow folder; repository evidence is planning/docs. | Defer until the future native SDK / Tuya React Native app role is exact. |
| `safvr` | Completed/closed Client Branch. | None unless the client relationship reopens. |
| `virtualtryon-3d` | Retired/ignored empty hold. | None unless founder-gated reopen reverses retirement. |
| `plugins` | Git identity or fold decision still needed. | None until repository identity or fold decision is approved. |

## Batch 5 Result

Batch 5 is closeout/exclusion complete. Cambium Phase 1 is applied under its
separate approved manifest and receipt. Temperance Phase 2 is also applied and
verified under its preflight and apply receipt. `symphonics` stays in founder
hold until a future founder-approved manifest creates or maps the exact shallow
folder.
