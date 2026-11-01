# Distillation proposal — 1 November 2026

Status: `proposal-only`. The Cambium owner has not accepted or rejected it.

This document is the distillation pass named by the 1 November reconciliation ledger. It records a reading of that ledger. It does not change the ledger's dispositions.

## Seam

[`temperance-integration.v1.json`](../architecture/contracts/temperance-integration.v1.json) defines seam `learning-proposal`:

| Field | Value |
|---|---|
| From | `noesis-cambium` |
| To | `cambium` |
| Effect | `proposal-only` |
| Required | `source-reference`, `freshness`, `confidence`, `review-owner` |

`effects_authorized` is `false`. Seams `admitted-work` and `verified-result` stay `reference-only` and are unused here.

`github.com/Sheshiyer/noesis-cambium` (`thoughtseed-local`) was not readable when the ledger was written, and it was not added as a remote. This proposal is staged in the company repository, `github.com/Sheshiyer/cambium`. It does not claim the personal plant authored it.

## Source

- Ledger: [`2026-11-01-worktree-branch-pr-reconciliation.md`](2026-11-01-worktree-branch-pr-reconciliation.md)
- Handoff: `.project/HANDOFF.md`, section “Worktree, branch, and PR reconciliation — 1 November 2026”
- Contract: `docs/architecture/contracts/temperance-integration.v1.json`

The 26 October reconciliation is used only where the 1 November ledger already carries a fact forward. Those carried facts are marked below. This pass does not reopen the reconciliation decisions.

## Freshness

- Ledger date: 1 November 2026, counted after `git fetch origin` on that date.
- `main` = `origin/main` = `8261d4840988e2e1c6fa6c2eb85cee96d4344b58`.
- This proposal did not fetch again, did not re-run the blob probes, and did not reclassify any branch.

## Confidence

### Directly counted

The ledger counted these after fetch. The two sums are arithmetic on those rows, not a new Git probe.

| Count | What the ledger counted |
|---|---|
| 1 | Registered worktree, clean and matching its remote |
| 43 | Remote refs: symbolic `origin/HEAD`, `origin/main`, and 41 topic branches |
| 11 | Open pull requests, none edited |
| 5 | Landed branches left in place: 3 with residual 0, 2 whose tip equals a merged pull-request head and whose files have later drift on `main` |
| 25 | Held branch names that still have a unique non-journal residual |
| 41 | Topic branch names: 11 open-PR heads + 5 landed + 25 held |
| 6 names / 3 tips | Stash pairs. Each pair shares one tip, so the distillation counts three stash snapshots |

### Carried or read off the ledger

This pass did not open the trees behind these notes.

- File-role phrases in the ledger (experiment docs, body face, runbooks, portfolio catalog data, architecture refresh) are that document's characterizations.
- “Runtime landed through #395” is the 1 November ledger citing the 26 October ledger.
- CRM contact data on `codex/iverif-fr-gtm-20260911` is the October handoff. The files were not opened. The do-not-merge disposition stands.
- The three conflict paths on #397 are the ledger's recorded `git merge-tree` result.
- “34 worktrees” is the operator-machine figure in the October ledger. Those disks are not this checkout, and this proposal does not re-verify them.
- Noesis Cambium's branches, pull requests, and worktrees are unknown. Unreadable is a counted credential result. Emptiness and equality are not inferred.
- The held groups below are a reading of the ledger's “Why it stays” column. They are not a new disposition.

## Review owner

The Cambium owner. This proposal is not auto-approved.

`PROJECT.md` names Codex as the default interactive governor. That role does not accept this document. The integration contract names `isa` as `acceptance_owner`. No ISA acceptance is claimed, and no Gate receipt is attached.

Accepting this proposal accepts the distillation as a learning record. Acceptance authorizes no merge, close, delete, rebase, Gate decision, or push.

## Distillation

### Open pull requests

Eleven open. Four are the taste-hands set. Three of those heads fork independently from `main`. One pull request is stacked on the experiment branch.

- **#414**, draft, base `main`, head `cursor/experiment-taste-hands-v0.1-2h-e7e3`, ahead/behind 3/0, 7 experiment docs. The ledger leaves it a draft and not for merge.
- **#415**, base `cursor/experiment-taste-hands-v0.1-2h-e7e3` (not `main`), head `cursor/cloud-agent-environment-4a6d`, 4/0 from `main`, 8 files including the experiment packet plus `AGENTS.md`. It merges into the experiment branch. Merging it does not land that note on `main`. The ledger says it must not be flattened onto `main` by itself.
- **#421**, base `main`, head `cursor/adopt-taste-hands-v0.1-e7e3`, 2/0, 9 files: the body face plus `docs/architecture/contracts/taste-hands-v0.1/`. It does not contain the location CSS.
- **#422**, base `main`, head `cursor/location-readout-binding-e7e3`, 1/0, 2 files: the location stylesheet and its test. It does not contain the contract or the body face.

Seven are foreign to that set. The ledger left them untouched.

- **#419**, head `cursor/phase-10-gsd-plan-5b84`, 1/0, residual 6. Held Phase 10 GSD plans.
- **#420**, head `cursor/phase-9-inventory-preflight-5b84`, 2/0, residual 7. Phase 9 inventory preflight.
- **#391**, draft, head `codex/employee-growth-release-20261023`, 14/5, residual 9. Evidence and Hermes receipt runbooks. The ledger records that the runtime landed through #395.
- **#397**, draft, head `claude/gate-learning-edge-20261024`, 3/14, residual 31. Recorded conflicts in `apps/cambium-r3f/src/curious-world/index.ts`, `docs/architecture/system-atlas.v1.json`, and `workers/quests/src/page/components/curious-world.generated.ts`. Author rebase remains outstanding.
- **#407**, draft, head `claude/cortex-text-seam-growth`, 3/3, residual 1: `bin/operator/cortex-text.test.ts`.
- **#408**, draft, head `claude/growth-approval-card-b2`, 1/4, residual 7. Growth approval decision draft.
- **#409**, draft, head `claude/clio-deployment-manifest-e1`, 2/3, residual 1: `docs/architecture/contracts/employee-clio-deployment-manifest-v1.md`.

### Landed branches

Five branches are landed and still on the remote. None were deleted.

Residual 0:

- `codex/continuous-learning-docs-20260911`
- `codex/main-reconciled-20261006` — the old local `main` named in the October ledger; the name also appears on merged #382
- `codex/plexus-admission-contract-20260905`

Tip equals a merged pull-request head, and `main` has since changed some of those files:

- `codex/reconcile-cambium-reviewed-20260927` — merged #378, 15 later-drift files
- `feat/phase0-r2-collector-growth-index-ecosystem-graph` — merged #379, later drift in `.gitignore` and `package.json`

### Held branches

Twenty-five names still have a unique non-journal residual. Collapsing the three duplicate stash names leaves 22 histories. Nothing was deleted.

Do not merge:

- `codex/iverif-fr-gtm-20260911`. The October handoff records CRM contact data on this branch. This pass did not open those files.

Three stash snapshots, not six. Each pair is one history:

| Snapshot | Names | Tip | Ledger note |
|---|---|---|---|
| 0 | `stash-0-20260807`, `stash-backup-20260807-0` | `ab1755f139` | Portfolio catalog data |
| 1 | `stash-1-20260807`, `stash-backup-20260807-1` | `f072eb5d49` | Architecture refresh docs |
| 2 | `stash-2-20260807`, `stash-backup-20260807-2` | `086f8631f6` | Earlier architecture refresh docs |

The name appears on a merged pull request, and the tip is not that pull-request head:

- `codex/curious-release-0.4.0` — merged name #384
- `codex/founder-onboarding-alpha-20261013` — merged name #385; includes viewport evidence commits
- `codex/reconcile-cambium-20260927` — merged name #380
- `project-management/relocation-records` — name appears on #286; tip is far behind `main` and is not that pull-request head

The other held names, in ledger order:

- `codex/cambium-census-20260908` — census quick-task docs not fully absorbed
- `codex/cambium-portfolio-mapping-20260906` — portfolio mapping audit not fully absorbed
- `codex/cambium-stage3-readiness` — messaging-consent readiness doc and parity test
- `codex/checkpoint-cambium-20260927` — eleven-organ field-guide checkpoint
- `codex/hr-github-knowledge-rebased-20260819` — founder-gated HR workflow files
- `codex/portfolio-draft-recovery-20261025` — portfolio draft recovery follow-up to #405
- `codex/reconcile-observed-repository-intake-20260907` — ownership publication notes
- `codex/superset-cambium-admission-canary` — `.temperance/project.json` only
- `codex/website-intake-cambium-20260924` — `workers/quests/src/index.ts` and `workers/quests/wrangler.labs.jsonc`
- `codex/wip-classification-phase9-20260903` — Phase 9 classification notes, distinct from open #420
- `docs/teamforge-flow-preservation-20261028` — `docs/plans/2026-10-28-teamforge-flow-preservation.md`; no pull request
- `hermes/project-link-validator-043e201` — `workers/quests/src/project-link-validator.test.ts`
- `park/dirty-primary-20260903` — parked dirty primary from before a reset to `origin/main`
- `tooling/hands-cli-binding` — Hands CLI binding across project docs and quests worker files

### Checkout recorded by the ledger

One worktree, on `cursor/location-readout-binding-e7e3`, clean and matching `origin`. Local `main`, `cursor/experiment-taste-hands-v0.1-2h-e7e3`, and `cursor/adopt-taste-hands-v0.1-e7e3` also matched their remotes. No second worktree was present to collapse.

## Boundary

This proposal is not a merge, not a Gate decision, and not a push to `noesis-cambium`.

- Every pull request and branch stays unmerged, unclosed, unrebased, and undeleted. #414, #415, #421, and #422 stay as the ledger left them. #397's author rebase stays outstanding.
- No Gate receipt, renewal, or approval is created.
- No `noesis-cambium` remote is added, nothing is pushed there, and the two repositories are not declared equal.
- `effects_authorized` remains `false`.

## Owner response

The Cambium owner accepts or rejects this distillation. Until that response is recorded, the status stays `proposal-only`.
