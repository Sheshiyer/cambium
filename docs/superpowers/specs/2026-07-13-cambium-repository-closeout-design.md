# Cambium Repository Closeout Design

**Date:** 2026-07-13
**Repository:** `Sheshiyer/cambium`
**Status:** Approved closeout design; canonical proof boundary corrected after Task 4 validation

## Purpose

Close Cambium's accumulated branch state without losing unique local work, silently changing GitHub issues, or treating generated and superseded artifacts as product changes. The final repository retains only `main`, aligns local and GitHub `main`, has no open pull requests or issues, and automatically removes merged pull-request head branches in the future.

## Verified starting state

The inventory below is a point-in-time baseline. Every destructive decision must be revalidated against live state immediately before execution.

- GitHub has zero open pull requests and zero open issues.
- GitHub has 13 non-`main` remote branches. Each compares to `main` with zero commits and zero files ahead.
- Git has 17 non-`main` local branches. Every local tip is an ancestor of `origin/main`.
- The active checkout is `codex/tg-story-inspect-clean-pass`, whose committed tip is contained in `origin/main` but whose working tree has 11 modified and three untracked paths.
- Local `main` is two commits behind the verified GitHub `main` baseline, `fcdcc230b08406e992880da4cd93273ca850e8e2`.
- `main` has no GitHub branch protection or ruleset. Merge safety is therefore enforced by this procedure.
- The CI workflow runs for pull requests to `main` without path filters. Its verify job runs `npm run verify:release`, which expands to eight deterministic gates, then generates and uploads the separate Telegram live-readiness report.
- `deleteBranchOnMerge` is currently disabled.
- Local and remote tag inventories include `archive/m5-phase-q-local`; tags, releases, and existing backups are outside the deletion scope.

## Goals

1. Preserve all pre-cleanup refs and all dirty working-tree content in an independently restorable backup before any destructive cleanup or salvage mutation.
2. Preserve the only unique semantic working-tree change as the exact two-file TDD commit `4b95e08`, then merge it through one focused code-plus-proof pull request containing those two files, a regenerated canonical viewport-proof manifest, and only regenerated PNGs whose bytes differ.
3. Discard only artifacts proven generated or superseded by current `main`.
4. Retire every contained non-`main` local and remote branch using a fresh per-branch safety check and deletion receipt.
5. Leave GitHub with zero open pull requests and issues, without changing issue state.
6. Align local `main` to the exact GitHub `main` SHA and leave the primary checkout clean.
7. Enable automatic deletion of merged pull-request head branches only after current cleanup is complete.

## Non-goals

- No history rewriting, force-pushing, tag deletion, release deletion, backup deletion, or cross-repository cleanup.
- No reopening, closing, labeling, editing, or commenting on GitHub issues.
- No attempt to preserve generated timestamp churn or older local copies of contracts already implemented more completely on `main`.
- No product feature beyond the approved static-orbit cleanup.

## Dirty-path disposition

Every dirty path is assigned exactly once.

### Focused salvage: two paths

- `workers/quests/src/page.ts`
- `workers/quests/src/handler.test.ts`

The source change removes the obsolete `orbitSweep` animation and expresses the state with static styling. The test change replaces animation assertions with assertions for that static state. This intent is not present on `origin/main`, and the focused dirty-tree tests pass.

These files are not copied wholesale from the 73-commit-old checkout. Their approved semantic hunks are reapplied to a fresh branch from the current GitHub `main`, and the resulting diff is reviewed against both the dirty source and current implementation.

### Generated churn: three paths

- `docs/architecture/DEPENDENCY-GRAPH.md`
- `docs/architecture/REFRESH-NEEDED.md`
- `docs/architecture/SERVICES.md`

`ArchitectureAssetsSync.hook.ts` identifies these as deterministic generated outputs. The local changes form a same-run timestamp/output refresh rather than authored architecture intent. Current `main` remains authoritative.

### Superseded or already tracked: nine paths

- `docs/plans/product-branches/fitcheck.md`
- `docs/plans/product-branches/iverif.md`
- `docs/plans/product-branches/schema.json`
- `docs/plans/product-branches/snow-gloves-os.md`
- `docs/plans/product-branches/vantyx.md`
- `scripts/validate-product-branch-packets.mjs`
- `docs/plans/2026-07-10-tg-miniapp-signed-gate-channel-quest-plan.md`
- `docs/plans/product-branches/loop-library.md`
- `docs/superpowers/plans/2026-07-05-cambium-branch-loop-library.md`

Merged pull requests #220 and #227–#229 provide the current broader product-branch and signed-gate contracts. The local validator is weaker than `main`, the local loop library omits the Client Delivery branch, and the 2026-07-05 plan is byte-identical to `main`. Preserving these local forms would reintroduce stale or duplicate state, so current `main` remains authoritative after their bytes are preserved in the backup.

## Preservation contract

The approved design and plan are written on a new clean documentation branch because the dirty checkout cannot safely host them. Before changing the dirty checkout, opening or merging pull requests, deleting any pre-task ref, or changing the repository setting, create a timestamped directory outside the repository:

`$HOME/.codex/backups/cambium/<UTC-timestamp>/`

It contains:

- repository identity and the current GitHub `main` SHA;
- complete local, remote, worktree, tag, pull-request, full issue, release, and relevant repository-setting inventories, including the documentation branch created for this specification;
- a branch/ref manifest recording ref name, object SHA, containment result, and disposition;
- an all-ref Git bundle;
- tracked staged and unstaged patches, including binary-safe metadata;
- copies of the three untracked files with original relative paths;
- hashes for every backup artifact and every untracked file;
- the 14-path disposition table and the later branch-deletion receipts.

The backup is accepted only when all of these checks pass:

1. A second hash pass matches the written checksum manifest.
2. `git bundle verify` succeeds.
3. `git bundle list-heads` contains the expected branches and tags.
4. A scratch clone outside both worktrees succeeds from the bundle.
5. Every manifest ref resolves to its expected SHA in the scratch clone.
6. Applying the dirty patch in a disposable checkout and comparing untracked-file hashes reconstructs the 14-path working state.

The backup directory is retained after cleanup. This design does not authorize its deletion.

## Pull-request structure

### Documentation history

This specification and its approved implementation plan live on the isolated documentation branch `codex/cambium-repository-closeout-design`. After plan approval, they are merged through one documentation-only pull request before the salvage pull request is opened. The documentation pull request follows the same full CI and no-issue-mutation gates as code changes. Keeping documentation separate preserves the review boundary around the static-orbit code and its canonical viewport proof.

### Static-orbit salvage

Create `codex/tg-static-orbit-cleanup` from a freshly fetched and SHA-verified `origin/main` in an isolated clean worktree. Reapply only the approved semantic changes to:

- `workers/quests/src/page.ts`
- `workers/quests/src/handler.test.ts`

The red/green semantic work remains the exact two-file commit `4b95e08`; do not amend, squash, or reconstruct it. On top of that commit, import the canonical capture-step registry read-only, require exactly 38 unique paths, explicitly clear any inherited capture filter, run the complete canonical `npm run proof:tg-viewport` capture, and commit its refresh separately as `test: refresh static orbit viewport proof`. The capture must execute all 38 steps successfully. Manually editing only `manifest.json.pageSourceSha256` is forbidden because that would relabel stale screenshots rather than regenerate proof.

The proof-refresh commit contains:

- `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json` regenerated by the complete capture;
- only canonical proof PNGs whose regenerated bytes differ from `origin/main`;
- no `failure.json`, `browser-diagnostics.json`, untracked file, or other generated artifact.

Every manifest proof row must name an existing PNG whose byte count and SHA-256 match the manifest. A 38-row receipt records every successful capture even when a regenerated PNG is byte-identical and therefore does not appear in Git.

Before push, require all of the following:

- commit `4b95e08` remains byte-for-byte unchanged and contains exactly the two semantic paths;
- comparison to the preserved dirty patch proves the intended semantic hunks were captured;
- focused quest-handler tests pass;
- the regenerated manifest's `pageSourceSha256` equals the digest of the actual exported `PAGE`, contains exactly 38 unique proof rows, and matches every listed PNG's bytes and SHA-256;
- the final branch diff contains the two semantic paths and the regenerated manifest, with every additional path restricted to a canonical viewport-proof PNG;
- the exact proof-refresh commit SHA is persisted before push and remains identical to local `HEAD` and the pull request head before path inspection, CI lookup, and compare-and-swap merge;
- `git diff --check` passes;
- local `npm run verify:release` passes;
- the worktree contains no unrelated untracked files.

Both commits, the pull-request title, and the pull-request body must not contain GitHub issue-closing keywords. The pull request explicitly discloses the complete canonical 38-capture proof refresh and links no issue because the verified open-issue snapshot is empty.

## Merge gate

For each approved pull request:

1. Refresh the GitHub `main` SHA. For the static-orbit branch, preserve `4b95e08` as the proof-refresh commit's direct parent and accept divergence only when the merge base is exactly `92fb237`, current `main` changed only the two closeout documentation paths since that base, and those paths do not overlap the derived code-plus-proof boundary. Any other drift stops the merge rather than rewriting or merging into the semantic commit.
2. Confirm the documentation diff matches its declared documentation-only boundary. For the static-orbit pull request, confirm the diff matches the derived committed-branch boundary: the two semantic files, the regenerated manifest, and only byte-different PNGs beneath the canonical viewport-proof directory.
3. Confirm the CI verify job actually ran for the pull-request SHA.
4. Inspect the job evidence: `verify:release` completed all eight gates, live-readiness report generation succeeded, and artifact upload succeeded. A skipped required step is not a pass.
5. Confirm the open-issue snapshot still equals zero and no issue was mutated.
6. Merge through GitHub without force operations, passing only the persisted proof-refresh SHA to the head-commit compare-and-swap guard.
7. Record pull-request number, head SHA, merge SHA, check-run URL, and merge time.

Because `main` is unprotected, this sequence is an explicit operational gate rather than a claimed repository-enforced guarantee.

## Branch retirement

Branch deletion starts only after approved pull requests are merged, their merge SHAs are verified on GitHub `main`, and the off-repository backup passes every restore check.

For every remote branch:

1. Fetch and record the current GitHub `main` SHA.
2. Compare the branch tip to that exact current SHA through the GitHub compare API.
3. Require `ahead_by == 0` and an empty changed-files list.
4. Record branch name, branch SHA, main SHA, comparison result, and reason.
5. Delete only that verified branch, then confirm the remote ref is absent.

For every local branch:

1. Fetch and record the current `origin/main` SHA.
2. Require `git merge-base --is-ancestor <branch-sha> <current-main-sha>` to succeed.
3. Confirm the branch SHA exists in the verified backup manifest and scratch restore.
4. Record branch name, branch SHA, main SHA, ancestry result, and reason.
5. Delete only that verified branch, then confirm the local ref is absent.

If `main` changes during cleanup, all remaining comparisons restart against the new SHA. Any branch with unique commits or files is quarantined and excluded from deletion pending a new explicit disposition.

The active dirty branch is retired last among local feature branches. After the backup and salvage merge are proven, restore its 11 tracked paths to current `main`, remove only its three named and backed-up untracked artifacts, confirm a clean status, switch the primary worktree to `main`, and then apply the same ancestry-and-manifest deletion gate.

The documentation and salvage worktrees are removed only after their branches are merged, their commits are reachable from current `main`, and the user-approved closeout plan authorizes worktree removal.

## Issues and pull requests

The before snapshot contains the exact open issue and pull-request lists, both empty. The procedure creates only the approved documentation and salvage pull requests, merges them, and verifies the after snapshot is again exactly empty.

No command in this design closes, reopens, labels, edits, comments on, or links an issue. Historical closed issues and the two closed-unmerged pull requests remain unchanged.

## Local `main` alignment

After branch retirement:

1. Fetch `origin` and record the exact GitHub `main` SHA.
2. Fast-forward local `main`; do not reset rewritten history or force-update it.
3. Require local `main`, `origin/main`, and the GitHub branches API to report the same SHA.
4. Require the primary checkout to be clean.

## Recurrence prevention

Automatic head-branch deletion is the final mutation. Only after the current branch inventory contains `main` alone, set GitHub `deleteBranchOnMerge` to `true`. Re-query repository settings and record the result.

This setting governs future merged pull requests. It is intentionally enabled after manual cleanup so no current branch disappears before its deletion receipt is captured.

## Rollback and recovery

- Before merge, abandon the isolated salvage branch/worktree and reconstruct the dirty state from the verified bundle, patch, and untracked-file copies.
- After merge, revert the focused merge normally; do not rewrite `main`.
- Recreate any deleted branch with `git branch <name> <recorded-sha>` and push it only if recovery is required.
- Restore the original dirty checkout in a scratch clone by applying the preserved patch and copying the hash-verified untracked files.
- If any backup, diff, CI, issue-state, or containment check fails, stop before the associated mutation and leave the remaining objects untouched.

## Completion proof

The closeout is complete only when one final receipt proves:

- local branch inventory is exactly `main`;
- GitHub branch inventory is exactly `main`;
- local `main`, `origin/main`, and GitHub `main` share one SHA;
- the primary worktree is clean and temporary worktrees are absent;
- open pull-request and issue snapshots are exactly empty;
- the approved documentation and salvage commits are reachable from `main`;
- the static-orbit proof-refresh commit, 38-row capture receipt, regenerated manifest, and manifest-bound PNG checks are present in the closeout evidence;
- every retired branch has a deletion receipt and is recoverable from the verified manifest/bundle;
- all tags, releases, and pre-existing backups are unchanged;
- the off-repository backup checksum and scratch-restore checks still pass;
- `deleteBranchOnMerge` is `true`.
