# Worktree, branch, and PR reconciliation — 1 November 2026

Ledger only. `origin/main` was not moved. No remote branch was deleted, no pull request was merged or closed, and no rebase was performed. Noesis Cambium was not added as a remote.

## Answer

This checkout is not synced with Noesis Cambium, and the Temperance contract says it must not be treated as a mirror.

- The only remote is `origin` = `github.com/Sheshiyer/cambium`.
- `main` = `origin/main` = `8261d4840988e2e1c6fa6c2eb85cee96d4344b58`.
- [`docs/architecture/contracts/temperance-integration.v1.json`](../architecture/contracts/temperance-integration.v1.json) names `github.com/Sheshiyer/noesis-cambium` as the personal Thoughtseed plant (`thoughtseed-local`). Cambium remains the company repository. The seams `admitted-work` and `verified-result` are `reference-only`. `learning-proposal` is `proposal-only`. `effects_authorized` is `false`.
- `gh repo view Sheshiyer/noesis-cambium` returned “Could not resolve to a Repository”. A repository search under `Sheshiyer` returned nothing. This credential cannot read that repo, so none of its branches, pull requests, or worktrees were reconciled.
- The [26 October reconciliation](2026-10-26-worktree-branch-reconciliation.md) described 34 worktrees on the operator machine. Those disks are not mounted here. This ledger covers GitHub plus the single cloud checkout.

## Method

Counted after `git fetch origin` on 1 November 2026. Remote refs: 43, of which `origin/HEAD` is symbolic, `origin/main` is the trunk, and 41 are topic branches.

Each topic branch was judged with the October probes:

1. Tip SHA equals a merged pull-request head.
2. Tip is an ancestor of `origin/main`.
3. Every non-journal file the branch itself changed has the same blob on `origin/main`.

“Changed” is the diff from the merge-base with `origin/main` to the branch tip. Journal files excluded from the residual are `ISA.md`, `.project/HANDOFF.md`, `.planning/HANDOFF.json`, `.planning/STATE.md`, and `docs/architecture/system-atlas.v1.json`. Ahead/behind counts are commits on the branch since the merge-base, then commits on `main` since that base.

Dispositions:

| Disposition | Meaning | Action taken |
|---|---|---|
| `keep-open-pr` | Head of an open pull request | Left open |
| `landed-blobs` | Non-journal residual is 0 | Left in place |
| `landed-pr-head-later-drift` | Tip equals a merged PR head, and `main` has since changed some of those files | Left in place |
| `held` | Unique non-journal residual remains | Left in place |

## This checkout

One registered worktree. It is clean and matches its remote.

| Branch checked out | Tip | Remote |
|---|---|---|
| `cursor/location-readout-binding-e7e3` | `294157ead4839d615b9d6e762dfc2c3270437758` | matches `origin` |

Local branches also present, each matching its remote, none with extra commits:

| Branch | Tip |
|---|---|
| `main` | `8261d4840988e2e1c6fa6c2eb85cee96d4344b58` |
| `cursor/experiment-taste-hands-v0.1-2h-e7e3` | `4e1930953e` |
| `cursor/adopt-taste-hands-v0.1-e7e3` | `7f035aadbb` |

There is no uncommitted work and no second worktree to collapse.

## Open pull requests

Eleven open. None were edited.

### Taste-hands set

Three branches fork independently from `main`. One pull request is stacked on the experiment branch and must not be flattened onto `main` by itself.

| PR | Draft | Base | Head | Tip | Ahead/behind | Unique non-journal files |
|---|---|---|---|---|---|---|
| [#414](https://github.com/Sheshiyer/cambium/pull/414) | yes | `main` | `cursor/experiment-taste-hands-v0.1-2h-e7e3` | `4e1930953e` | 3/0 | 7 experiment docs |
| [#415](https://github.com/Sheshiyer/cambium/pull/415) | no | `cursor/experiment-taste-hands-v0.1-2h-e7e3` | `cursor/cloud-agent-environment-4a6d` | `f60fb8ee9d` | 4/0 from `main` | 8, including the experiment packet plus `AGENTS.md` |
| [#421](https://github.com/Sheshiyer/cambium/pull/421) | no | `main` | `cursor/adopt-taste-hands-v0.1-e7e3` | `7f035aadbb` | 2/0 | 9, body face plus `docs/architecture/contracts/taste-hands-v0.1/` |
| [#422](https://github.com/Sheshiyer/cambium/pull/422) | no | `main` | `cursor/location-readout-binding-e7e3` | `294157ead4` | 1/0 | 2, location stylesheet and its test |

#414 stays a draft and is not for merge. #415 merges into the experiment branch, not into `main`. Merging #415 does not land the toolchain note on `main`. #421 does not contain the location CSS. #422 does not contain the contract or the body face.

### Other open reviews

Foreign to the taste-hands set. Left untouched.

| PR | Draft | Head | Tip | Ahead/behind | Residual | Note |
|---|---|---|---|---|---|---|
| [#419](https://github.com/Sheshiyer/cambium/pull/419) | no | `cursor/phase-10-gsd-plan-5b84` | `f547e5fa2a` | 1/0 | 6 | Held Phase 10 GSD plans |
| [#420](https://github.com/Sheshiyer/cambium/pull/420) | no | `cursor/phase-9-inventory-preflight-5b84` | `72269c34aa` | 2/0 | 7 | Phase 9 inventory preflight |
| [#391](https://github.com/Sheshiyer/cambium/pull/391) | yes | `codex/employee-growth-release-20261023` | `5679f92737` | 14/5 | 9 | Evidence and Hermes receipt runbooks only. October ledger already recorded that the runtime landed through #395 |
| [#397](https://github.com/Sheshiyer/cambium/pull/397) | yes | `claude/gate-learning-edge-20261024` | `0afb3f9419` | 3/14 | 31 | `git merge-tree` against `origin/main` still conflicts in `apps/cambium-r3f/src/curious-world/index.ts`, `docs/architecture/system-atlas.v1.json`, and `workers/quests/src/page/components/curious-world.generated.ts`. Author rebase remains outstanding |
| [#407](https://github.com/Sheshiyer/cambium/pull/407) | yes | `claude/cortex-text-seam-growth` | `c1eec4e987` | 3/3 | 1 | `bin/operator/cortex-text.test.ts` |
| [#408](https://github.com/Sheshiyer/cambium/pull/408) | yes | `claude/growth-approval-card-b2` | `a526cffc61` | 1/4 | 7 | Growth approval decision draft |
| [#409](https://github.com/Sheshiyer/cambium/pull/409) | yes | `claude/clio-deployment-manifest-e1` | `06c6865637` | 2/3 | 1 | `docs/architecture/contracts/employee-clio-deployment-manifest-v1.md` |

## Landed, still on the remote

Non-journal blobs already match `origin/main`. Branches were not deleted.

| Branch | Tip | Date | Ahead/behind | Probe |
|---|---|---|---|---|
| `codex/continuous-learning-docs-20260911` | `236a83efbb` | 2026-09-11 | 1/27 | residual 0 |
| `codex/main-reconciled-20261006` | `37309d4c1a` | 2026-10-06 | 73/24 | residual 0. This is the old local `main` named in the October ledger. Name also appears on merged #382 |
| `codex/plexus-admission-contract-20260905` | `1ee87a597c` | 2026-09-05 | 1/31 | residual 0 |

Tip equals a merged pull-request head. `main` has since changed some of those paths, so the branch is not a byte match today. Still not deleted.

| Branch | Tip | Merged PR | Later-drift files |
|---|---|---|---|
| `codex/reconcile-cambium-reviewed-20260927` | `27b6187e2f` | #378 | 15 |
| `feat/phase0-r2-collector-growth-index-ecosystem-graph` | `010c472ca7` | #379 | `.gitignore`, `package.json` |

## Held

Unique non-journal content remains. Nothing was deleted. Residual is the count of files the branch changed whose blob differs from `origin/main` today.

| Branch | Tip | Date | Ahead/behind | Residual | Why it stays |
|---|---|---|---|---|---|
| `codex/cambium-census-20260908` | `2f8458fc24` | 2026-09-08 | 18/31 | 13 | Census quick-task docs not fully absorbed |
| `codex/cambium-portfolio-mapping-20260906` | `9f85b41d55` | 2026-09-07 | 10/31 | 17 | Portfolio mapping audit not fully absorbed |
| `codex/cambium-stage3-readiness` | `bc89566cf9` | 2026-09-27 | 1/26 | 2 | Messaging-consent readiness doc and parity test |
| `codex/checkpoint-cambium-20260927` | `02bb29b182` | 2026-09-27 | 7/31 | 34 | Eleven-organ field-guide checkpoint |
| `codex/curious-release-0.4.0` | `7b3d62280b` | 2026-10-08 | 5/23 | 22 | Merged name #384, tip is not that PR head |
| `codex/founder-onboarding-alpha-20261013` | `7d9742dede` | 2026-10-13 | 7/23 | 60 | Merged name #385, tip is not that PR head. Includes viewport evidence commits |
| `codex/hr-github-knowledge-rebased-20260819` | `21d49089ae` | 2026-08-19 | 1/39 | 5 | Founder-gated HR workflow files |
| `codex/iverif-fr-gtm-20260911` | `ec6a3d6f67` | 2026-09-27 | 1/27 | 17 | Do not merge. The October handoff records CRM contact data on this branch. This pass did not open those files |
| `codex/portfolio-draft-recovery-20261025` | `cb174dfc57` | 2026-10-26 | 1/5 | 6 | Portfolio draft recovery follow-up to #405 |
| `codex/reconcile-cambium-20260927` | `5b37cb6875` | 2026-09-29 | 21/26 | 15 | Merged name #380, tip is not that PR head |
| `codex/reconcile-observed-repository-intake-20260907` | `faaf36464d` | 2026-09-07 | 15/31 | 16 | Ownership publication notes |
| `codex/superset-cambium-admission-canary` | `b7df9a9110` | 2026-08-30 | 1/34 | 1 | `.temperance/project.json` only |
| `codex/website-intake-cambium-20260924` | `0cfe6797ab` | 2026-09-27 | 1/27 | 2 | `workers/quests/src/index.ts`, `workers/quests/wrangler.labs.jsonc` |
| `codex/wip-classification-phase9-20260903` | `b2cd83f644` | 2026-09-03 | 1/31 | 7 | Phase 9 classification notes, distinct from open #420 |
| `docs/teamforge-flow-preservation-20261028` | `15b0a6c2f7` | 2026-10-30 | 1/0 | 1 | `docs/plans/2026-10-28-teamforge-flow-preservation.md`. No pull request |
| `hermes/project-link-validator-043e201` | `98ae697727` | 2026-09-29 | 1/24 | 1 | `workers/quests/src/project-link-validator.test.ts` |
| `park/dirty-primary-20260903` | `6f4c440dc9` | 2026-09-03 | 3/34 | 64 | Parked dirty primary from before a reset to `origin/main` |
| `project-management/relocation-records` | `115f4230a6` | 2026-08-08 | 17/221 | 234 | Name appears on #286. Tip is far behind `main` and is not that PR head |
| `stash-0-20260807` | `ab1755f139` | 2026-08-06 | 3/173 | 2 | Same tip as `stash-backup-20260807-0`. Portfolio catalog data |
| `stash-1-20260807` | `f072eb5d49` | 2026-06-29 | 2/428 | 3 | Same tip as `stash-backup-20260807-1`. Architecture refresh docs |
| `stash-2-20260807` | `086f8631f6` | 2026-06-29 | 2/429 | 3 | Same tip as `stash-backup-20260807-2`. Earlier architecture refresh docs |
| `stash-backup-20260807-0` | `ab1755f139` | 2026-08-06 | 3/173 | 2 | Duplicate of `stash-0-20260807` |
| `stash-backup-20260807-1` | `f072eb5d49` | 2026-06-29 | 2/428 | 3 | Duplicate of `stash-1-20260807` |
| `stash-backup-20260807-2` | `086f8631f6` | 2026-06-29 | 2/429 | 3 | Duplicate of `stash-2-20260807` |
| `tooling/hands-cli-binding` | `8fb64ab8c1` | 2026-08-07 | 6/221 | 10 | Hands CLI binding across project docs and quests worker files |

The three stash pairs are one history each. A distillation pass should count three stash snapshots, not six.

## Distillation boundary

This ledger is the map for a later distillation pass. The pass is not this change. Learning that belongs in Cambium stays a `learning-proposal` from Noesis Cambium: source, freshness, confidence, and a review owner. It is not a merge, not a Gate decision, and not a push to `noesis-cambium`.

## Not done

- No remote was added for `noesis-cambium`.
- No branch was pushed there, and the two repositories were not declared equal.
- #414, #415, #421, and #422 were not merged. #397 and #415 were not rebased.
- Host Temperance, OmniRoute, credentials, and the operator-machine worktrees were not inspected.
