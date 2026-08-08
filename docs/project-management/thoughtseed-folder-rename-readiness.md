# Thoughtseed folder rename readiness

This is a planning artifact only. Batch 5 settles closeout and exclusion state; it does not rename, create, archive, move, or de-duplicate any physical folder.

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
| `cambium` / `cambium-authoritative` | Phase 1 preflight passed; archive-first promotion is the selected safe path. | Await exact live-apply approval: `approve live apply phase 1 Cambium archive-first promote`. |
| `website` / `temperance-engine-landing-page` | Manifest drafted but blocked on local-state reconciliation. | Preserve local artifacts, review `.gitignore` drift, then choose promote or preserve-container. |
| `symphonics` | Founder hold: missing shallow folder; repository evidence is planning/docs. | Defer until the future native SDK / Tuya React Native app role is exact. |
| `safvr` | Completed/closed Client Branch. | None unless the client relationship reopens. |
| `virtualtryon-3d` | Retired/ignored empty hold. | None unless founder-gated reopen reverses retirement. |
| `plugins` | Git identity or fold decision still needed. | None until repository identity or fold decision is approved. |

## Batch 5 Result

Batch 5 can proceed as closeout/exclusion complete with rename-manifest holds. The remaining shallow-folder issue is no longer a global blocker: `symphonics` stays in founder hold until a founder-approved manifest creates or maps the exact shallow folder.
