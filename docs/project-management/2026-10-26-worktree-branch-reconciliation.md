# Worktree and branch reconciliation — 2026-10-26

Receipt for collapsing the `cambium` checkout set to one working head. Local
only: `origin/main` (`3e334e8`) was not moved, no remote branch was deleted,
no draft PR was merged. Every removed local branch is recoverable from the
SHA listed here; PR-less branches also carry an `archive/2026-10-26/<name>`
tag (slashes in the name become `--`).

## Starting state

- 34 registered worktrees, 22 GB on disk under `thoughtseed/`.
- 44 local branches plus `main`.
- Local `main` at `37309d4` (2026-10-06), diverged from `origin/main`
  `3e334e8` (2026-10-26) by 73 local and 19 remote commits.
- Primary checkout carried 32 modified tracked files and 36 untracked paths.
- Almost every PR was squash-merged, so ancestry reported every branch as
  unmerged. Merged status was therefore decided by three probes: the local
  tip equals the PR head SHA recorded by GitHub; the branch is an ancestor
  of a merged PR head; or every non-journal file the branch changed has a
  blob identical to `origin/main`. Journal files (`ISA.md`,
  `.project/HANDOFF.md`, `.planning/HANDOFF.json`, `.planning/STATE.md`,
  `docs/architecture/system-atlas.v1.json`) were excluded from the residual
  measure because every branch appends dated entries to them.

## Ending state

- Worktrees: the primary checkout at `thoughtseed/cambium` on `main`, plus
  four Codex-app-managed worktrees that were left registered (see below).
- `main == origin/main == 3e334e8`; no tracked modifications.
- Local branches: `main`, two open draft PR branches, one merged branch
  still checked out by a Codex worktree, and four preservation branches.
- 31 archive tags under `archive/2026-10-26/`.
- Disk under `thoughtseed/cambium*`: 4.7 GB (2.3 GB of that is the
  untracked `apps/cambium-showreel/out/` render folder).

## Preserved uncommitted work

| Branch | Parent | Source | Contents |
|---|---|---|---|
| `wip/local-main-openai-mcp-20261017` (`bd09be5`) | `37309d4` | primary checkout working tree | 123 files: OpenAI MCP seams in `workers/cortex-mcp` and `workers/quests` (2026-09-30), `openai/`, `tests/openai-ecosystem/`, `apps/cambium-showreel` source (renders and `node_modules` excluded by its own `.gitignore`), `CONTEXT.md`, `Plans/`, Oct 6 te-init edits to `.temperance/*` and `.planning/*`, Oct 13-17 edits to `workers/quests/src/handler.ts` and tests. Not reviewed, not for merge as-is; contains the privacy scan's negative-test strings. |
| `wip/curious-onboarding-controller-20261013` (`6238f9e`) | `7b3d622` | `cambium-curious-release-20261008` worktree | `OnboardingOverlay.tsx` split into `onboarding-controller.ts` plus tests and `onboarding.css`. |
| `codex/portfolio-draft-recovery-20261025` (`cb174df`) | `3e334e8` | Codex task-4 `portfolio-draft-recovery` | Follow-up to PR #405 review comments r4372134895 and r4372134899; based on current main so it merges cleanly. Codex also kept `portfolio-draft-recovery.patch` beside the worktree. |
| `wip/portfolio-reconciliation-draft-20261024` (`8ee20ff`) | `37309d4` | Codex task-4 `portfolio-reconciliation` | Pre-v2 draft of the reviewed-membership reconciliation; superseded by PR #405. |

The three worktree snapshots were taken through a temporary index, so the
worktrees' HEAD, index and files were not modified. The primary checkout's
untracked files were restored to disk after `main` was reset and remain
untracked there.

Two other uncommitted states were dropped as regenerated noise: the
identical six-file `te-init` edit (`.temperance/goal.json` schema v1 to v2
and a `.planning/STATE.md` note) in the `stage3-readiness` and
`website-intake` worktrees, which is also captured on
`wip/local-main-openai-mcp-20261017`; and the untracked
`.agents/skills/source-command-*` stubs that a tool generated into four
worktrees on 2026-10-14.

## Branch ledger

### Kept

| Branch | Tip | Why |
|---|---|---|
| `main` | `3e334e8` | Reset to `origin/main`. The former local tip `37309d4` is tagged `archive/2026-10-26/local-main`; its 73 checkpoint commits reached origin through PR #386 (whose body names #382 as superseded). Merge-tree against origin showed only journal lines left. |
| `claude/gate-learning-edge-20261024` | `0afb3f9` | Draft PR #397, 32 files, none yet in origin. Conflicts with origin/main in one hunk of `apps/cambium-r3f/src/curious-world/index.ts` (near line 439: origin's `gateReceiptStages()` helper versus the draft's inline stage list) plus two regenerable files (`docs/architecture/system-atlas.v1.json`, `workers/quests/src/page/components/curious-world.generated.ts`). Left untouched because the hunk is semantic; the draft's author should rebase. |
| `codex/employee-growth-release-20261023` | `a8ecb18` to `5679f92` | Draft PR #391. Its runtime changes landed through PR #395 (9 of 23 files were already byte-identical to origin, the rest were older versions). Merged `origin/main` into the branch, taking origin for `scripts/employee-growth-workerd-smoke.mjs` and `workers/quests/src/hermes-receipts-v2.test.ts` (both pinned byte-identical to live source by #395) and keeping both sides of `.project/HANDOFF.md`. Residual: seven `docs/evidence/2026-10-24-*.json` files, two `docs/runbooks/cortex-hermes-receipts-v2*.md`, and the handoff entry. Zero code files differ from origin/main. |
| `codex/reviewed-portfolio-membership-20261025` | `3d1ef81` | Merged as PR #405 (tip equals PR head). Kept only because the Codex task-4 `portfolio-reconciliation-v2` worktree has it checked out. Delete once that worktree is gone. |
| four `wip/` and `codex/portfolio-draft-recovery-20261025` | see above | Preservation branches, local only. |

### Deleted: tip equals the merged PR head (recoverable from the PR)

| Branch | Tip | PR |
|---|---|---|
| `claude/atlas-founder-gate-f16a93` | `217a896` | #388 |
| `claude/in-world-gate-20261023` | `b63a844` | #390 |
| `claude/project-link-validator-20261024` | `8674332` | #392 |
| `claude/relovo-loadout-20261022` | `2f81907` | #387 |
| `claude/wave0-alpha-into-main-20261022` | `548a90b` | #386 |
| `claude/web-founder-gate-20261022` | `fda6740` | #389 |
| `codex/curious-mission-dossiers` | `a2d990a` | #402 |
| `codex/founder-gate-simple` | `d5ed025` | #396 |
| `codex/founder-receipt-recovery` | `ba63899` | #398 |
| `codex/reconcile-cambium-reviewed-20260927` | `27b6187` | #378 |
| `feat/phase0-r2-collector-growth-index-ecosystem-graph` | `010c472` | #379 |

### Deleted with an archive tag: content reached origin another way

| Branch | Tip | Evidence |
|---|---|---|
| `claude/381-update-20261022` | `b768137` | Is the PR #381 head; merge-tree residual against origin is empty. |
| `claude/wave0-release-20261021` | `27646f3` | Zero patch-unique commits against the #386 branch. |
| `codex/wave0-wtfmedia-accepted-loop` | `84b5ebc` | Ancestor of the #386 branch. |
| `codex/curious-release-0.4.0` | `7b3d622` | PR #384 closed; ancestor of the #386 branch, which #386's body names as superseding #384. |
| `codex/reconcile-cambium-20260927` | `5b37cb6` | PR #380 closed; #386's body records it as already landed via #378. |
| `codex/temperance-integration-boundary-20261005` | `5d82f22` | Pre-rebase form of #381; residual is three `ISA.md` lines. Remote branch exists. |
| `backup/main-pre-rebase-20261006` | `bfbfb08` | One commit behind the former local `main`, which is itself archived. |
| `codex/curious-cf-0.4.0` | `c0aec2e` | Pre-release iteration; 90 of 106 changed files identical in origin, the rest are older versions of `curious-world/*` and `handler.test.ts` that origin later rewrote. |
| `codex/curious-cf-ready-0.4.0` | `a3bc033` | Same shape as above. |
| `codex/curious-cf-qualified-0.4.0` | `47c1258` | Same shape as above. |
| `codex/curious-cf-census-0.4.0` | `d0eed1d` | Same shape as above; was checked out by the `~/.codex` visualization worktree, which was detached in place. |
| `codex/cambium-system-atlas-20261007` | `6a2fba1` | 76 of 96 changed files identical in origin; the rest are older versions. |
| `codex/curious-scene-visuals-20261007` | `abae9df` | 31 of 46 identical; rest older. |
| `codex/cambium-atlas-app-wiring-20261007` | `d4f7ee5` | 20 of 35 identical; rest older. |
| `codex/employee-growth-workflow-20261023` | `b6f27ba` | Predecessor of the #391 branch; its contract doc is in origin, its handler delta is an older version. |
| `codex/founder-release-atlas-provenance` | `211aa77` | Residual is journal lines plus a generated atlas; origin's atlas passes the generator's `--check`. |
| `claude/privacy-scan-fixtures-20261024` | `2774c75` | Adds 24 synthetic-fixture lines to `scripts/infinite-game-anchors.test.mjs`; that test passes on origin/main without them. |
| `codex/cambium-stage3-readiness` | `bc89566` | Its parity test reads a sibling `hermes-stage3-readiness` checkout; origin's vendored-pin version supersedes it by design. Remote exists. |
| `codex/website-intake-cambium-20260924` | `0cfe679` | Residual removes `MISSION_FABRIC_TENANTS` and `ACCEPTANCE_OWNER_PUBKEYS` from `wrangler.labs.jsonc`, an older config. Remote exists. |
| `hermes/project-link-validator-043e201` | `98ae697` | Superseded by #392, which recovered the same validator. Remote exists. |
| `codex/continuous-learning-docs-20260911` | `236a83e` | Handoff lines only. Remote exists. |
| `codex/plexus-admission-contract-20260905` | `1ee87a5` | Every non-journal file identical in origin. Remote exists. |
| `codex/superset-cambium-admission-canary` | `b7df9a9` | Residual is a held `.temperance/project.json` edit the handoff marks as waiting on manifest regeneration. Remote exists. |
| `codex/cambium-census-20260908` | `2f8458f` | September portfolio mapping, superseded by #372 and #373. Remote exists. |
| `codex/cambium-portfolio-mapping-20260906` | `9f85b41` | Same. Remote exists. |
| `codex/reconcile-observed-repository-intake-20260907` | `faaf364` | Same. Remote exists. |
| `codex/checkpoint-cambium-20260927` | `02bb29b` | Superseded by #378. Remote exists. |
| `codex/iverif-fr-gtm-20260911` | `ec6a3d6` | Campaign evidence including `docs/evidence/2026-09-11-iverif-explee-campaign-learning/crm/contacts.json` (3,736 lines of contact data). Must not be merged. Remote branch still holds it. |
| `codex/wip-classification-phase9-20260903` | `b2cd83f` | September planning WIP. Remote exists. |
| `park/dirty-primary-20260903` | `6f4c440` | Parked dirty state from 2026-09-03. Remote exists. |

## Worktrees removed (28)

`thoughtseed/cambium-381-boundary-20261022`, `cambium-atlas-app-wiring-20261007`,
`cambium-curious-release-20261008`, `cambium-curious-scene-visuals-20261007`,
`cambium-deploy-083f7ea`, `cambium-deploy-18d2a55`, `cambium-deploy-51ce49d`,
`cambium-deploy-5da5019`, `cambium-deploy-8835d6d`,
`cambium-founder-gate-simple-20261024`, `cambium-founder-receipt-recovery-20261025`,
`cambium-gate-learning-20261024`, `cambium-in-world-gate`, `cambium-preserve-043e201`,
`cambium-privacy-fixtures-20261024`, `cambium-project-link-validator`,
`cambium-relovo-loadout-20261022`, `cambium-stage3-readiness`,
`cambium-system-atlas-20261007`, `cambium-wave0-into-main-20261022`,
`cambium-wave0-owner-binding`, `cambium-wave0-release-20261021`,
`cambium-web-founder-gate`, `cambium-website-intake-20260924`,
`thoughtseed/.worktrees/cambium-employee-growth-20261023`,
`thoughtseed/.superset-worktrees/d877e5a0-.../codex/iverif-fr-gtm`,
`cambium/.worktrees/temperance-integration-boundary-20261005`,
`cambium/.claude/worktrees/atlas-founder-gate-f16a93`.

The five `cambium-deploy-<sha>` folders were detached checkouts of commits
already on `origin/main`.

`thoughtseed/.worktrees/cambium-employee-growth-release-20261023` was kept
until the #391 test run finished and was then removed.

## Worktrees left registered

- `~/Documents/Codex/2026-10-24/task-4/portfolio-draft-recovery`,
  `.../portfolio-reconciliation`, `.../portfolio-reconciliation-v2`: that
  task folder was being written to during this run, so they were not
  removed; their edits are snapshotted on the branches above.
- `~/.codex/visualizations/2026/10/08/.../curious-cf-deploy/source`: clean,
  detached at `d0eed1d`.

## Folders that are not cambium worktrees

Untouched and reported only: `hermes-cron-repair-20261007` (152 KB of
receipts and patches), `hermes-vault-reconciliation-20261007` (108 KB),
`hermes-growth-portfolio-review-20261001` (7 MB of JSON evidence). These are
plain folders, not git checkouts. Sibling folders `cambium-showcase-ui-rebuild`
(a `thoughtseed-organ-console` checkout) and the three `hermes-aws-ts`
checkouts belong to other repositories.

## Remote branches on origin (not touched)

`git ls-remote --heads origin` lists 31 heads; the clone's fetch refspec is
`+refs/heads/main:refs/remotes/origin/main`, so only `main` is tracked
locally and `git branch -r` shows a stale 13-entry view. Twenty of the local
branches deleted above still exist on origin (for example
`codex/iverif-fr-gtm-20260911`, `codex/curious-release-0.4.0`,
`park/dirty-primary-20260903`), alongside `codex/founder-onboarding-alpha-20261013`,
`codex/main-reconciled-20261006`, `codex/hr-github-knowledge-rebased-20260819`,
`feat/cortex-mcp-structured-compose`, `project-management/relocation-records`,
`tooling/hands-cli-binding`, and the seven `stash-*` branches from 2026-08-07.
Deleting any of these is a separate, owner-approved action.

## Verification on `main` (`3e334e8`)

- `node scripts/generate-system-atlas.mjs --check`: exit 0.
- `node --test scripts/infinite-game-anchors.test.mjs`: exit 0.
- `npm test`: 2466 of 2467 pass; the single failure is
  `drift audit · viewport proof manifest PAGE digest is stale`, the stale
  canonical viewport fingerprint that the 2026-10-25 handoff entry already
  records as the only remaining failure on origin.
- `git fsck --no-dangling`: clean after removing a stray `.git/refs/.DS_Store`.
- Updated draft #391 (`5679f92`): `npm test` 2466 of 2467, the same single drift-audit failure as `main`.
