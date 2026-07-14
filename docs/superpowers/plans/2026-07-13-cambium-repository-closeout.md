# Cambium Repository Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Cambium's current dirty and ref state, preserve the exact two-file static-orbit TDD commit and merge it with a complete canonical 38-capture viewport-proof refresh, retire only freshly proven contained branches, align local `main`, and enable automatic merged-head deletion.

**Architecture:** Treat closeout as a sequence of fail-closed state transitions. Create and restore-test an off-repository backup first; merge documentation, then preserve the two-file semantic commit and add a separate canonical viewport-proof refresh in one focused code-plus-proof pull request; take a second all-ref recovery bundle after those merges; then retire remote and local branches with a fresh per-ref proof before enabling `deleteBranchOnMerge` strictly last.

**Tech Stack:** Git, Git worktrees, GitHub CLI and REST API, Bash 4+, Node.js 26, `node:test`, npm, GitHub Actions.

## Global Constraints

- Before running any shell block, export caller-supplied absolute paths for `CAMBIUM_PRIMARY_WORKTREE`, `CAMBIUM_DOC_WORKTREE`, and `CAMBIUM_SALVAGE_WORKTREE`; backup paths resolve beneath `$HOME/.codex/backups/cambium`.
- Work only in `Sheshiyer/cambium` and the explicitly named Cambium worktrees.
- Preserve the dirty checkout until its 14 paths reconstruct byte-for-byte from an off-repository backup.
- Store preservation artifacts under `$HOME/.codex/backups/cambium/<UTC-timestamp>/`.
- Never copy either stale dirty file wholesale onto current `main`; reapply only the approved semantic hunks.
- Preserve the exact Task 3 semantic TDD commit `4b95e085bdc293a80db76e1db2430b2c6dc009c7`; do not amend, squash, or reconstruct it.
- Preserve its direct-parent relationship to the Task 4 proof-refresh commit. The branch may diverge from current `main` only at merge base `92fb2370770de65117e6aad0d31e6301f52d1ca9`, with base-to-main changes restricted to the two closeout documentation paths and no overlap with the code-plus-proof path set.
- The static-orbit semantic commit changes exactly `workers/quests/src/page.ts` and `workers/quests/src/handler.test.ts`.
- The static-orbit pull request contains those two semantic files, regenerated `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`, and only PNGs beneath that canonical proof directory whose bytes differ after the complete 38-capture refresh.
- Manually changing only `manifest.json.pageSourceSha256` is forbidden. Every one of the 38 canonical capture steps must succeed and appear in the refresh receipt even when a regenerated PNG is byte-identical and therefore absent from Git.
- Explicitly clear inherited viewport-proof filters for the canonical run, and persist the resulting proof-refresh commit SHA once. Reuse that immutable value for the expected-path diff, pull-request head checks, CI lookup, and `--match-head-commit`; never replace it with a later live value.
- Pull-request titles, bodies, and commit messages contain no GitHub issue-closing keyword followed by an issue number.
- Do not close, reopen, label, edit, comment on, or link a GitHub issue.
- Do not rewrite history, force-push branch content, force-delete a local branch, or use `git reset --hard`. Remote deletion uses only an exact-SHA `--force-with-lease` as a compare-and-swap guard.
- Do not delete or modify tags, releases, existing backups, or refs outside the captured candidate inventories.
- A skipped GitHub Actions step is not a passing merge gate.
- Every branch comparison uses the GitHub `main` SHA fetched immediately before that branch's deletion.
- Any branch with commits or files ahead is quarantined and left untouched.
- Remove a worktree only after its commit is reachable from current `main` and the worktree is clean.
- Enable `deleteBranchOnMerge=true` only after local and remote branch inventories contain `main` alone.

---

## Scope Check

The backup, pull requests, branch retirement, and prevention setting are distinct operational surfaces, but they form one irreversible safety chain: each later phase consumes evidence produced by the previous phase. They remain one implementation plan with two focused review pull requests rather than independent projects.

## File Structure

- Existing documentation branch `codex/cambium-repository-closeout-design` contains the committed specification and this plan.
- Create outside Git: `$HOME/.codex/backups/cambium/<UTC-timestamp>/` for manifests, bundles, patches, snapshots, checksums, and receipts.
- Create temporarily at `$CAMBIUM_SALVAGE_WORKTREE` for the semantic salvage.
- Modify only: `workers/quests/src/handler.test.ts` for static-orbit assertions.
- Modify only: `workers/quests/src/page.ts` for the static orbit implementation.
- Regenerate: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json` through the complete canonical viewport capture.
- Regenerate, but commit only when bytes differ: `docs/plans/assets/tg-miniapp-viewport-proof/*.png`.
- Create no new runtime source file, npm dependency, issue, tag, or release.

### Task 1: Create and prove the off-repository preservation snapshot

**Files:**
- Create outside repo: `$HOME/.codex/backups/cambium/<UTC-timestamp>/**`
- Read only: `$CAMBIUM_PRIMARY_WORKTREE/**`
- Read only: `$CAMBIUM_DOC_WORKTREE/**`

**Interfaces:**
- Consumes: current refs, worktrees, GitHub state, and the 14-path dirty checkout.
- Produces: `ACTIVE-CLOSEOUT` pointer, verified initial bundle, reconstructable dirty state, immutable checksums, and baseline GitHub fingerprints.

- [ ] **Step 1: Establish exact paths and repository identity**

Run in Bash 4+:

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
DOC_WT="${CAMBIUM_DOC_WORKTREE:?Set CAMBIUM_DOC_WORKTREE to the docs worktree}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="$HOME/.codex/backups/cambium/$STAMP"
mkdir -p "$BACKUP_DIR"/{git,dirty/untracked,github,receipts,verification}
printf '%s\n' "$BACKUP_DIR" > "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"

test "$(git -C "$ROOT" remote get-url origin)" = "https://github.com/Sheshiyer/cambium.git"
GH_MAIN=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
ORIGIN_MAIN=$(git -C "$ROOT" rev-parse origin/main)
test "$GH_MAIN" = "$ORIGIN_MAIN"
DIRTY_HEAD=$(git -C "$ROOT" rev-parse HEAD)
DOC_HEAD=$(git -C "$DOC_WT" rev-parse HEAD)
printf 'ROOT=%s\nDOC_WT=%s\nDIRTY_HEAD=%s\nDOC_HEAD=%s\nGH_MAIN=%s\n' \
  "$ROOT" "$DOC_WT" "$DIRTY_HEAD" "$DOC_HEAD" "$GH_MAIN" \
  > "$BACKUP_DIR/verification/context.env"
```

Expected: origin is exact, `GH_MAIN` equals `origin/main`, and the backup path is outside both worktrees.

- [ ] **Step 2: Capture Git, worktree, GitHub, issue, PR, tag, release, and setting inventories**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"

git -C "$ROOT" worktree list --porcelain > "$BACKUP_DIR/git/worktrees.before.txt"
git -C "$ROOT" for-each-ref \
  --sort=refname \
  --format='%(objectname)%09%(objecttype)%09%(refname)%09%(symref)' \
  | LC_ALL=C sort > "$BACKUP_DIR/git/refs.before.tsv"
git -C "$ROOT" ls-remote --heads --tags origin \
  | LC_ALL=C sort > "$BACKUP_DIR/git/origin-refs.before.tsv"

gh repo view Sheshiyer/cambium \
  --json nameWithOwner,url,defaultBranchRef,deleteBranchOnMerge,mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed \
  | jq -S . > "$BACKUP_DIR/github/repository.before.json"
gh api repos/Sheshiyer/cambium/rulesets \
  | jq -S . > "$BACKUP_DIR/github/rulesets.before.json"
gh pr list --repo Sheshiyer/cambium --state open --limit 1000 \
  --json number,state,title,headRefName,headRefOid,baseRefName,url \
  | jq -S . > "$BACKUP_DIR/github/pulls-open.before.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/pulls \
  -f state=all -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add | sort_by(.number)' \
  > "$BACKUP_DIR/github/pulls-all.before.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues \
  -f state=open -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add | map(select(has("pull_request") | not)) | sort_by(.number)' \
  > "$BACKUP_DIR/github/issues-open.before.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues \
  -f state=all -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add
      | map(select(has("pull_request") | not)
        | (.labels |= sort_by(.id))
        | (.assignees |= sort_by(.id)))
      | sort_by(.number)' \
  > "$BACKUP_DIR/github/issues-all.before.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues/comments \
  -f per_page=100 \
  | jq -S --slurpfile issues "$BACKUP_DIR/github/issues-all.before.json" '
      ($issues[0] | map(.number | tostring)) as $numbers
      | add
      | map(select((.issue_url | split("/") | last) as $n
        | ($numbers | index($n)) != null))
      | sort_by(.id)' \
  > "$BACKUP_DIR/github/issue-comments.before.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues/events \
  -f per_page=100 \
  | jq -S --slurpfile issues "$BACKUP_DIR/github/issues-all.before.json" '
      ($issues[0] | map(.number | tostring)) as $numbers
      | add
      | map(select((.issue.number | tostring) as $n
        | ($numbers | index($n)) != null))
      | sort_by(.id)' \
  > "$BACKUP_DIR/github/issue-events.before.json"
shasum -a 256 \
  "$BACKUP_DIR/github/issues-all.before.json" \
  "$BACKUP_DIR/github/issue-comments.before.json" \
  "$BACKUP_DIR/github/issue-events.before.json" \
  | awk '{print $1}' | shasum -a 256 | awk '{print $1}' \
  > "$BACKUP_DIR/github/issues.before.fingerprint"
gh release list --repo Sheshiyer/cambium --limit 100 \
  --json tagName,name,isDraft,isPrerelease,publishedAt \
  | jq -S . > "$BACKUP_DIR/github/releases.before.json"

test "$(jq length "$BACKUP_DIR/github/pulls-open.before.json")" -eq 0
test "$(jq length "$BACKUP_DIR/github/issues-open.before.json")" -eq 0
test "$(jq -r .deleteBranchOnMerge "$BACKUP_DIR/github/repository.before.json")" = false
test "$(jq length "$BACKUP_DIR/github/rulesets.before.json")" -eq 0

set +e
gh api --include repos/Sheshiyer/cambium/branches/main/protection \
  > "$BACKUP_DIR/github/main-protection.before.txt" 2>&1
protection_rc=$?
set -e
test "$protection_rc" -ne 0
rg -q '404' "$BACKUP_DIR/github/main-protection.before.txt"
```

Expected: open PR and issue arrays are empty, automatic merged-head deletion is false, rulesets are empty, and the protection probe records HTTP 404.

- [ ] **Step 3: Capture the exact dirty state**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"

printf '%s\n' \
  docs/architecture/DEPENDENCY-GRAPH.md \
  docs/architecture/REFRESH-NEEDED.md \
  docs/architecture/SERVICES.md \
  docs/plans/product-branches/fitcheck.md \
  docs/plans/product-branches/iverif.md \
  docs/plans/product-branches/schema.json \
  docs/plans/product-branches/snow-gloves-os.md \
  docs/plans/product-branches/vantyx.md \
  scripts/validate-product-branch-packets.mjs \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts \
  > "$BACKUP_DIR/dirty/tracked-modified-paths.expected.txt"
printf '%s\n' \
  docs/plans/2026-07-10-tg-miniapp-signed-gate-channel-quest-plan.md \
  docs/plans/product-branches/loop-library.md \
  docs/superpowers/plans/2026-07-05-cambium-branch-loop-library.md \
  > "$BACKUP_DIR/dirty/untracked-paths.expected.txt"
cat \
  "$BACKUP_DIR/dirty/tracked-modified-paths.expected.txt" \
  "$BACKUP_DIR/dirty/untracked-paths.expected.txt" \
  > "$BACKUP_DIR/dirty/dirty-paths.txt"

test "$(wc -l < "$BACKUP_DIR/dirty/tracked-modified-paths.expected.txt" | tr -d ' ')" -eq 11
test "$(wc -l < "$BACKUP_DIR/dirty/untracked-paths.expected.txt" | tr -d ' ')" -eq 3
test "$(wc -l < "$BACKUP_DIR/dirty/dirty-paths.txt" | tr -d ' ')" -eq 14
git -C "$ROOT" status --porcelain=v1 --untracked-files=all \
  > "$BACKUP_DIR/dirty/status.before.txt"
LC_ALL=C sort "$BACKUP_DIR/dirty/status.before.txt" \
  > "$BACKUP_DIR/dirty/status.approved.actual.txt"
git -C "$ROOT" status --porcelain=v1 -z --untracked-files=all \
  > "$BACKUP_DIR/dirty/status.before.z"
git -C "$ROOT" status --porcelain=v2 --branch -z --untracked-files=all \
  > "$BACKUP_DIR/dirty/status-v2-branch.before.z"
git -C "$ROOT" ls-files --stage -z \
  > "$BACKUP_DIR/dirty/index-stage.before.z"
git -C "$ROOT" diff --cached --binary --full-index --no-ext-diff --no-textconv --no-renames HEAD \
  > "$BACKUP_DIR/dirty/tracked-staged.patch"
git -C "$ROOT" diff --binary --full-index --no-ext-diff --no-textconv --no-renames \
  > "$BACKUP_DIR/dirty/tracked-unstaged.patch"
git -C "$ROOT" diff HEAD --binary --full-index --no-ext-diff --no-textconv --no-renames \
  > "$BACKUP_DIR/dirty/tracked-combined.patch"
git -C "$ROOT" diff --name-only HEAD -- \
  | LC_ALL=C sort > "$BACKUP_DIR/dirty/tracked-modified-paths.actual.txt"
git -C "$ROOT" ls-files --others --exclude-standard \
  | LC_ALL=C sort \
  > "$BACKUP_DIR/dirty/untracked-paths.txt"
test "$(wc -l < "$BACKUP_DIR/dirty/untracked-paths.txt" | tr -d ' ')" -eq 3
diff -u \
  "$BACKUP_DIR/dirty/tracked-modified-paths.expected.txt" \
  "$BACKUP_DIR/dirty/tracked-modified-paths.actual.txt" \
  > "$BACKUP_DIR/verification/tracked-modified-paths.diff"
diff -u \
  "$BACKUP_DIR/dirty/untracked-paths.expected.txt" \
  "$BACKUP_DIR/dirty/untracked-paths.txt" \
  > "$BACKUP_DIR/verification/untracked-paths.diff"
{
  while IFS= read -r path; do printf ' M %s\n' "$path"; done \
    < "$BACKUP_DIR/dirty/tracked-modified-paths.expected.txt"
  while IFS= read -r path; do printf '?? %s\n' "$path"; done \
    < "$BACKUP_DIR/dirty/untracked-paths.expected.txt"
} | LC_ALL=C sort > "$BACKUP_DIR/dirty/status.approved.expected.txt"
diff -u \
  "$BACKUP_DIR/dirty/status.approved.expected.txt" \
  "$BACKUP_DIR/dirty/status.approved.actual.txt" \
  > "$BACKUP_DIR/verification/approved-dirty-baseline.diff"
printf '%s\n' \
  "approved dirty baseline has exactly 11 modified tracked paths and three named untracked paths" \
  > "$BACKUP_DIR/receipts/approved-dirty-baseline.txt"

record_xattrs() {
  local root=$1
  local output=$2
  (
    cd "$root"
    while IFS= read -r path; do
      printf 'path\t%s\n' "$path"
      /usr/bin/xattr "$path" | LC_ALL=C sort | while IFS= read -r attr; do
        value=$(/usr/bin/xattr -px "$attr" "$path" | tr -d '[:space:]')
        printf 'attr\t%s\t%s\t%s\n' "$path" "$attr" "$value"
      done
    done < "$BACKUP_DIR/dirty/untracked-paths.txt"
  ) > "$output"
}

record_xattrs \
  "$ROOT" \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.exact.tsv"
awk -F '\t' '$1 != "attr" || $3 != "com.apple.provenance"' \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.exact.tsv" \
  > "$BACKUP_DIR/dirty/untracked-xattrs.source.normalized.tsv"
awk -F '\t' '$1 == "attr" && $3 == "com.apple.provenance" {print $2 "\t" $4}' \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.exact.tsv" \
  > "$BACKUP_DIR/dirty/untracked-xattrs.source.provenance.tsv"
cut -f1 "$BACKUP_DIR/dirty/untracked-xattrs.source.provenance.tsv" \
  | cmp - "$BACKUP_DIR/dirty/untracked-paths.expected.txt"

while IFS= read -r path; do
  mkdir -p "$BACKUP_DIR/dirty/untracked/$(dirname "$path")"
  /usr/bin/ditto --rsrc --extattr --acl \
    "$ROOT/$path" "$BACKUP_DIR/dirty/untracked/$path"
done < "$BACKUP_DIR/dirty/untracked-paths.txt"

record_xattrs \
  "$BACKUP_DIR/dirty/untracked" \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.exact.tsv"
awk -F '\t' '$1 != "attr" || $3 != "com.apple.provenance"' \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.exact.tsv" \
  > "$BACKUP_DIR/dirty/untracked-xattrs.backup.normalized.tsv"
awk -F '\t' '$1 == "attr" && $3 == "com.apple.provenance" {print $2 "\t" $4}' \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.exact.tsv" \
  > "$BACKUP_DIR/dirty/untracked-xattrs.backup.provenance.tsv"
cut -f1 "$BACKUP_DIR/dirty/untracked-xattrs.backup.provenance.tsv" \
  | cmp - "$BACKUP_DIR/dirty/untracked-paths.expected.txt"
diff -u \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.normalized.tsv" \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.normalized.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.source-backup.normalized.diff"
set +e
diff -u \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.provenance.tsv" \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.provenance.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.source-backup.provenance.diff"
provenance_diff_rc=$?
set -e
test "$provenance_diff_rc" -le 1

(
  cd "$ROOT"
  while IFS= read -r path; do shasum -a 256 "$path"; done \
    < "$BACKUP_DIR/dirty/dirty-paths.txt"
) > "$BACKUP_DIR/dirty/content.before.sha256"
```

Expected: status records 11 modified and three untracked paths; exact source and backup xattr values are retained, all three paths carry `com.apple.provenance`, and every other xattr matches exactly.

- [ ] **Step 4: Create and verify the initial all-ref bundle**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
BUNDLE=$BACKUP_DIR/git/cambium-initial-all-refs.bundle
SCRATCH=$(mktemp -d /tmp/cambium-bundle-check.XXXXXX)

git -C "$ROOT" bundle create "$BUNDLE" --all
git -C "$ROOT" bundle verify "$BUNDLE" \
  > "$BACKUP_DIR/verification/bundle-initial.verify.txt"
git bundle list-heads "$BUNDLE" \
  | LC_ALL=C sort > "$BACKUP_DIR/verification/bundle-initial.heads.tsv"

awk -F '	' '{print $3}' "$BACKUP_DIR/git/refs.before.tsv" | LC_ALL=C sort \
  > "$BACKUP_DIR/verification/expected-ref-names.txt"
awk '{print $2}' "$BACKUP_DIR/verification/bundle-initial.heads.tsv" | LC_ALL=C sort \
  > "$BACKUP_DIR/verification/bundled-ref-names.txt"
comm -23 \
  "$BACKUP_DIR/verification/expected-ref-names.txt" \
  "$BACKUP_DIR/verification/bundled-ref-names.txt" \
  > "$BACKUP_DIR/verification/bundle-initial.missing-refs.txt"
test ! -s "$BACKUP_DIR/verification/bundle-initial.missing-refs.txt"

awk -F '\t' 'length($4) > 0 {print $3 "\t" $4}' \
  "$BACKUP_DIR/git/refs.before.tsv" \
  > "$BACKUP_DIR/git/symbolic-refs.before.tsv"
grep -Fqx \
  $'refs/remotes/origin/HEAD\trefs/remotes/origin/main' \
  "$BACKUP_DIR/git/symbolic-refs.before.tsv"

git clone --mirror "$BUNDLE" "$SCRATCH/cambium.git"
git --git-dir="$SCRATCH/cambium.git" fsck --full
: > "$BACKUP_DIR/verification/bundle-initial.symbolic-refs.restored.tsv"
while IFS=$'\t' read -r ref target; do
  git --git-dir="$SCRATCH/cambium.git" symbolic-ref "$ref" "$target"
  actual_target=$(git --git-dir="$SCRATCH/cambium.git" symbolic-ref -q "$ref")
  test "$actual_target" = "$target"
  printf '%s\t%s\n' "$ref" "$actual_target" \
    >> "$BACKUP_DIR/verification/bundle-initial.symbolic-refs.restored.tsv"
done < "$BACKUP_DIR/git/symbolic-refs.before.tsv"
diff -u \
  "$BACKUP_DIR/git/symbolic-refs.before.tsv" \
  "$BACKUP_DIR/verification/bundle-initial.symbolic-refs.restored.tsv" \
  > "$BACKUP_DIR/verification/bundle-initial.symbolic-refs.diff"
while IFS=$'\t' read -r expected_sha expected_type ref symref; do
  actual_sha=$(git --git-dir="$SCRATCH/cambium.git" rev-parse "$ref^{object}")
  test "$actual_sha" = "$expected_sha"
  actual_type=$(git --git-dir="$SCRATCH/cambium.git" cat-file -t "$actual_sha")
  test "$actual_type" = "$expected_type"
done < "$BACKUP_DIR/git/refs.before.tsv"
printf '%s\n' "all manifest refs resolved with exact object IDs and types" \
  > "$BACKUP_DIR/verification/bundle-initial.restore.txt"
printf '%s\n' "all symbolic refs restored and verified, including origin/HEAD -> origin/main" \
  > "$BACKUP_DIR/receipts/bundle-initial.symbolic-refs.txt"
```

Expected: bundle verification succeeds, no expected ref name is missing, and every manifest ref resolves to the recorded SHA in the mirror clone.

- [ ] **Step 5: Reconstruct and compare the 14-path dirty state**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
BUNDLE=$BACKUP_DIR/git/cambium-initial-all-refs.bundle
DIRTY_HEAD=$(sed -n 's/^DIRTY_HEAD=//p' "$BACKUP_DIR/verification/context.env")
SCRATCH=$(mktemp -d /tmp/cambium-dirty-restore.XXXXXX)

git clone "$BUNDLE" "$SCRATCH/reconstructed"
git -C "$SCRATCH/reconstructed" checkout --detach "$DIRTY_HEAD"
if test -s "$BACKUP_DIR/dirty/tracked-staged.patch"; then
  git -C "$SCRATCH/reconstructed" apply --index "$BACKUP_DIR/dirty/tracked-staged.patch"
fi
if test -s "$BACKUP_DIR/dirty/tracked-unstaged.patch"; then
  git -C "$SCRATCH/reconstructed" apply "$BACKUP_DIR/dirty/tracked-unstaged.patch"
fi
while IFS= read -r path; do
  mkdir -p "$SCRATCH/reconstructed/$(dirname "$path")"
  /usr/bin/ditto --rsrc --extattr --acl \
    "$BACKUP_DIR/dirty/untracked/$path" "$SCRATCH/reconstructed/$path"
done < "$BACKUP_DIR/dirty/untracked-paths.txt"

record_xattrs() {
  local root=$1
  local output=$2
  (
    cd "$root"
    while IFS= read -r path; do
      printf 'path\t%s\n' "$path"
      /usr/bin/xattr "$path" | LC_ALL=C sort | while IFS= read -r attr; do
        value=$(/usr/bin/xattr -px "$attr" "$path" | tr -d '[:space:]')
        printf 'attr\t%s\t%s\t%s\n' "$path" "$attr" "$value"
      done
    done < "$BACKUP_DIR/dirty/untracked-paths.txt"
  ) > "$output"
}

record_xattrs \
  "$SCRATCH/reconstructed" \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.exact.tsv"
awk -F '\t' '$1 != "attr" || $3 != "com.apple.provenance"' \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.exact.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.normalized.tsv"
awk -F '\t' '$1 == "attr" && $3 == "com.apple.provenance" {print $2 "\t" $4}' \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.exact.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.provenance.tsv"
cut -f1 "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.provenance.tsv" \
  | cmp - "$BACKUP_DIR/dirty/untracked-paths.expected.txt"
diff -u \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.normalized.tsv" \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.normalized.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.source-reconstructed.normalized.diff"
diff -u \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.normalized.tsv" \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.normalized.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.backup-reconstructed.normalized.diff"
set +e
diff -u \
  "$BACKUP_DIR/dirty/untracked-xattrs.source.provenance.tsv" \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.provenance.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.source-reconstructed.provenance.diff"
source_provenance_diff_rc=$?
diff -u \
  "$BACKUP_DIR/dirty/untracked-xattrs.backup.provenance.tsv" \
  "$BACKUP_DIR/verification/untracked-xattrs.reconstructed.provenance.tsv" \
  > "$BACKUP_DIR/verification/untracked-xattrs.backup-reconstructed.provenance.diff"
backup_provenance_diff_rc=$?
set -e
test "$source_provenance_diff_rc" -le 1
test "$backup_provenance_diff_rc" -le 1
printf '%s\n' \
  "com.apple.provenance is present exactly once for every source, backup, and reconstructed path; value divergence is recorded but is not a reconstruction gate" \
  > "$BACKUP_DIR/receipts/untracked-xattrs.provenance-presence.txt"

git -C "$SCRATCH/reconstructed" ls-files --stage -z \
  | cmp - "$BACKUP_DIR/dirty/index-stage.before.z"
git -C "$SCRATCH/reconstructed" status --porcelain=v1 --untracked-files=all \
  > "$BACKUP_DIR/verification/status.reconstructed.txt"
diff -u \
  "$BACKUP_DIR/dirty/status.before.txt" \
  "$BACKUP_DIR/verification/status.reconstructed.txt"

(
  cd "$SCRATCH/reconstructed"
  while IFS= read -r path; do shasum -a 256 "$path"; done \
    < "$BACKUP_DIR/dirty/dirty-paths.txt"
) > "$BACKUP_DIR/verification/content.reconstructed.sha256"
diff -u \
  "$BACKUP_DIR/dirty/content.before.sha256" \
  "$BACKUP_DIR/verification/content.reconstructed.sha256"
```

Expected: status, index, file bytes, and all xattrs other than managed `com.apple.provenance` reconstruct exactly. Provenance exists on every path at all three stages, while its exact value differences remain recorded without gating reconstruction.

- [ ] **Step 6: Seal and verify the initial backup**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
(
  cd "$BACKUP_DIR"
  find . -type f ! -name 'SHA256SUMS.*' -print \
    | LC_ALL=C sort \
    | while IFS= read -r path; do shasum -a 256 "$path"; done \
    > SHA256SUMS.initial
  shasum -a 256 -c SHA256SUMS.initial
  for artifact in \
    ./github/pulls-all.before.json \
    ./dirty/tracked-modified-paths.expected.txt \
    ./dirty/tracked-modified-paths.actual.txt \
    ./dirty/untracked-paths.expected.txt \
    ./dirty/status.approved.expected.txt \
    ./dirty/status.approved.actual.txt \
    ./dirty/untracked-xattrs.source.exact.tsv \
    ./dirty/untracked-xattrs.source.normalized.tsv \
    ./dirty/untracked-xattrs.source.provenance.tsv \
    ./dirty/untracked-xattrs.backup.exact.tsv \
    ./dirty/untracked-xattrs.backup.normalized.tsv \
    ./dirty/untracked-xattrs.backup.provenance.tsv \
    ./git/symbolic-refs.before.tsv \
    ./verification/approved-dirty-baseline.diff \
    ./verification/bundle-initial.missing-refs.txt \
    ./verification/bundle-initial.symbolic-refs.restored.tsv \
    ./verification/bundle-initial.symbolic-refs.diff \
    ./verification/untracked-xattrs.reconstructed.exact.tsv \
    ./verification/untracked-xattrs.reconstructed.normalized.tsv \
    ./verification/untracked-xattrs.reconstructed.provenance.tsv \
    ./verification/untracked-xattrs.source-backup.normalized.diff \
    ./verification/untracked-xattrs.source-reconstructed.normalized.diff \
    ./verification/untracked-xattrs.backup-reconstructed.normalized.diff \
    ./verification/untracked-xattrs.source-backup.provenance.diff \
    ./verification/untracked-xattrs.source-reconstructed.provenance.diff \
    ./verification/untracked-xattrs.backup-reconstructed.provenance.diff \
    ./receipts/approved-dirty-baseline.txt \
    ./receipts/bundle-initial.symbolic-refs.txt \
    ./receipts/untracked-xattrs.provenance-presence.txt
  do
    rg -Fq "  $artifact" SHA256SUMS.initial
  done
)
```

Expected: every initial artifact reports `OK`. Stop the closeout if any step in Task 1 fails.

### Task 2: Validate and merge the documentation-only pull request

**Files:**
- Existing: `docs/superpowers/specs/2026-07-13-cambium-repository-closeout-design.md`
- Existing: `docs/superpowers/plans/2026-07-13-cambium-repository-closeout.md`

**Interfaces:**
- Consumes: verified Task 1 backup and the local documentation branch.
- Produces: merged documentation PR, CI receipt, merge SHA, and unchanged issue fingerprint.

- [ ] **Step 1: Revalidate the documentation branch boundary**

```bash
set -euo pipefail
DOC_WT="${CAMBIUM_DOC_WORKTREE:?Set CAMBIUM_DOC_WORKTREE to the docs worktree}"
cd "$DOC_WT"
git fetch origin
if ! git merge-base --is-ancestor origin/main HEAD; then
  git merge --no-edit origin/main
fi
test -z "$(git status --porcelain)"
actual=$(git diff --name-only origin/main...HEAD | LC_ALL=C sort)
expected=$(printf '%s\n' \
  docs/superpowers/plans/2026-07-13-cambium-repository-closeout.md \
  docs/superpowers/specs/2026-07-13-cambium-repository-closeout-design.md)
test "$actual" = "$expected"
git diff --check origin/main...HEAD
```

Expected: exactly the specification and implementation plan differ from current `main`.

- [ ] **Step 2: Run the current local release contract**

```bash
set -euo pipefail
cd "$CAMBIUM_DOC_WORKTREE"
npm ci --prefix apps/cambium-r3f
npm run verify:release
```

Expected: eight named gates pass and output ends with `Deterministic release verification passed.`

- [ ] **Step 3: Push and open the documentation PR without issue mutation**

```bash
set -euo pipefail
cd "$CAMBIUM_DOC_WORKTREE"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"

git push -u origin codex/cambium-repository-closeout-design
PR_URL=$(gh pr create --repo Sheshiyer/cambium \
  --base main \
  --head codex/cambium-repository-closeout-design \
  --title "docs: add Cambium repository closeout runbook" \
  --body "Documents the approved lossless backup, focused salvage, branch-retirement, verification, rollback, and recurrence-prevention procedure.")
PR=$(gh pr view "$PR_URL" --repo Sheshiyer/cambium --json number --jq .number)
printf '%s\n' "$PR" > "$BACKUP_DIR/receipts/documentation-pr.number"

gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues \
  -f state=all -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add
      | map(select(has("pull_request") | not)
        | (.labels |= sort_by(.id))
        | (.assignees |= sort_by(.id)))
      | sort_by(.number)' \
  > "$BACKUP_DIR/receipts/issues-all.after-documentation-open.json"
diff -u \
  "$BACKUP_DIR/github/issues-all.before.json" \
  "$BACKUP_DIR/receipts/issues-all.after-documentation-open.json"
```

Expected: one documentation PR exists and the full issue snapshot is byte-identical.

- [ ] **Step 4: Require the complete current CI job**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
read -r PR < "$BACKUP_DIR/receipts/documentation-pr.number"
HEAD_SHA=$(gh pr view "$PR" --repo Sheshiyer/cambium --json headRefOid --jq .headRefOid)

gh pr checks "$PR" --repo Sheshiyer/cambium --watch --interval 10
gh run list --repo Sheshiyer/cambium --workflow ci.yml \
  --event pull_request --commit "$HEAD_SHA" --limit 20 \
  --json databaseId,headSha,event,status,conclusion,url \
  > "$BACKUP_DIR/receipts/documentation-ci.runs.json"
RUN_ID=$(jq -er --arg sha "$HEAD_SHA" \
  'map(select(.headSha == $sha and .event == "pull_request")) | sort_by(.databaseId) | last | .databaseId' \
  "$BACKUP_DIR/receipts/documentation-ci.runs.json")
test "$RUN_ID" != null
gh run watch "$RUN_ID" --repo Sheshiyer/cambium --interval 10 --exit-status

gh run view "$RUN_ID" --repo Sheshiyer/cambium --json jobs \
  > "$BACKUP_DIR/receipts/documentation-ci.jobs.json"
jq -e '
  (.jobs | length) == 1 and
  .jobs[0].name == "deterministic release verification · node 26" and
  .jobs[0].status == "completed" and .jobs[0].conclusion == "success" and
  ([.jobs[].steps[] |
    select(.name == "Run actions/checkout@v4" or
           .name == "Set up Node 26" or
           .name == "Install retained R3F runtime" or
           .name == "Resolve Chromium" or
           .name == "Verify deterministic release contract" or
           .name == "Live readiness report (separate evidence)" or
           .name == "Upload live readiness report")] |
   length == 7 and all(.status == "completed" and .conclusion == "success"))
' "$BACKUP_DIR/receipts/documentation-ci.jobs.json"

gh run view "$RUN_ID" --repo Sheshiyer/cambium --log \
  > "$BACKUP_DIR/receipts/documentation-ci.log"
test "$(rg -o '== (drift audit|core tests|generated docs|standalone audit|standalone smoke|Telegram mobile contract|R3F tests|R3F build) ==' \
  "$BACKUP_DIR/receipts/documentation-ci.log" | LC_ALL=C sort -u | wc -l | tr -d ' ')" -eq 8
rg -q 'Deterministic release verification passed' "$BACKUP_DIR/receipts/documentation-ci.log"
! rg -q 'Release verification failed at:' "$BACKUP_DIR/receipts/documentation-ci.log"
```

Expected: the job and all seven required workflow steps succeed, and the log contains eight unique release-gate markers.

- [ ] **Step 5: Merge through GitHub and record proof**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
read -r PR < "$BACKUP_DIR/receipts/documentation-pr.number"
HEAD_SHA=$(gh pr view "$PR" --repo Sheshiyer/cambium --json headRefOid --jq .headRefOid)

test "$(gh repo view Sheshiyer/cambium --json deleteBranchOnMerge --jq .deleteBranchOnMerge)" = false
printf '%s\n' \
  docs/superpowers/plans/2026-07-13-cambium-repository-closeout.md \
  docs/superpowers/specs/2026-07-13-cambium-repository-closeout-design.md \
  > "$BACKUP_DIR/receipts/documentation-pr.expected-paths"
gh api --paginate --slurp -X GET "repos/Sheshiyer/cambium/pulls/$PR/files" \
  -f per_page=100 \
  | jq -S 'add | map({filename,status,previous_filename}) | sort_by(.filename)' \
  > "$BACKUP_DIR/receipts/documentation-pr.files.json"
gh api "repos/Sheshiyer/cambium/pulls/$PR" \
  > "$BACKUP_DIR/receipts/documentation-pr.meta.json"
test "$(jq .changed_files "$BACKUP_DIR/receipts/documentation-pr.meta.json")" -eq 2
jq -r '.[].filename' "$BACKUP_DIR/receipts/documentation-pr.files.json" \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/documentation-pr.rest-paths"
gh pr diff "$PR" --repo Sheshiyer/cambium --name-only \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/documentation-pr.files.txt"
cmp "$BACKUP_DIR/receipts/documentation-pr.expected-paths" \
  "$BACKUP_DIR/receipts/documentation-pr.rest-paths"
cmp "$BACKUP_DIR/receipts/documentation-pr.expected-paths" \
  "$BACKUP_DIR/receipts/documentation-pr.files.txt"
gh pr merge "$PR" --repo Sheshiyer/cambium --merge \
  --match-head-commit "$HEAD_SHA"
gh pr view "$PR" --repo Sheshiyer/cambium \
  --json number,state,headRefName,headRefOid,mergeCommit,mergedAt,url \
  | jq -S . > "$BACKUP_DIR/receipts/documentation-pr.merged.json"
test "$(jq -r .state "$BACKUP_DIR/receipts/documentation-pr.merged.json")" = MERGED
MERGE_SHA=$(jq -r .mergeCommit.oid "$BACKUP_DIR/receipts/documentation-pr.merged.json")

for attempt in $(seq 1 30); do
  gh run list --repo Sheshiyer/cambium --workflow ci.yml \
    --event push --commit "$MERGE_SHA" --limit 20 \
    --json databaseId,headSha,event,status,conclusion,url \
    > "$BACKUP_DIR/receipts/documentation-push-ci.runs.json"
  PUSH_RUN_ID=$(jq -r --arg sha "$MERGE_SHA" \
    'map(select(.headSha == $sha and .event == "push")) | sort_by(.databaseId) | last | .databaseId // empty' \
    "$BACKUP_DIR/receipts/documentation-push-ci.runs.json")
  test -n "$PUSH_RUN_ID" && break
  sleep 10
done
test -n "$PUSH_RUN_ID"
gh run watch "$PUSH_RUN_ID" --repo Sheshiyer/cambium --interval 10 --exit-status
gh run view "$PUSH_RUN_ID" --repo Sheshiyer/cambium --json jobs \
  > "$BACKUP_DIR/receipts/documentation-push-ci.jobs.json"
jq -e '
  (.jobs | length) == 1 and
  .jobs[0].name == "deterministic release verification · node 26" and
  .jobs[0].status == "completed" and .jobs[0].conclusion == "success" and
  ([.jobs[].steps[] |
    select(.name == "Verify deterministic release contract" or
           .name == "Live readiness report (separate evidence)" or
           .name == "Upload live readiness report")] |
   length == 3 and all(.status == "completed" and .conclusion == "success"))
' "$BACKUP_DIR/receipts/documentation-push-ci.jobs.json"
gh run view "$PUSH_RUN_ID" --repo Sheshiyer/cambium --log \
  > "$BACKUP_DIR/receipts/documentation-push-ci.log"
test "$(rg -o '== (drift audit|core tests|generated docs|standalone audit|standalone smoke|Telegram mobile contract|R3F tests|R3F build) ==' \
  "$BACKUP_DIR/receipts/documentation-push-ci.log" | LC_ALL=C sort -u | wc -l | tr -d ' ')" -eq 8
rg -q 'Deterministic release verification passed' "$BACKUP_DIR/receipts/documentation-push-ci.log"
! rg -q 'Release verification failed at:' "$BACKUP_DIR/receipts/documentation-push-ci.log"

test "$(gh pr list --repo Sheshiyer/cambium --state open --limit 1000 --json number | jq length)" -eq 0
test "$(gh issue list --repo Sheshiyer/cambium --state open --limit 1000 --json number | jq length)" -eq 0
```

Expected: the PR is merged, no PR or issue remains open, and the head branch still exists for later receipt-backed retirement.

### Task 3: Reapply the static-orbit change with focused TDD

**Files:**
- Modify: `workers/quests/src/handler.test.ts:2721-2860,4172-4184`
- Modify: `workers/quests/src/page.ts:251,306-317,665-668,779-785,830-838,959-965`

**Interfaces:**
- Consumes: current GitHub `main` after Task 2 and the preserved dirty semantic intent.
- Produces: `codex/tg-static-orbit-cleanup` with exact two-file commit `4b95e085bdc293a80db76e1db2430b2c6dc009c7` and focused red/green evidence. Task 4 adds proof without altering this commit.

- [ ] **Step 1: Create a clean branch and worktree from the exact current main SHA**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
SALVAGE_WT="${CAMBIUM_SALVAGE_WORKTREE:?Set CAMBIUM_SALVAGE_WORKTREE to the salvage worktree}"
test ! -e "$SALVAGE_WT"
! git -C "$ROOT" show-ref --verify --quiet refs/heads/codex/tg-static-orbit-cleanup
git -C "$ROOT" fetch --prune origin
MAIN_SHA=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
test "$MAIN_SHA" = "$(git -C "$ROOT" rev-parse origin/main)"
git -C "$ROOT" worktree add -b codex/tg-static-orbit-cleanup "$SALVAGE_WT" "$MAIN_SHA"
test -z "$(git -C "$SALVAGE_WT" status --porcelain)"
```

Expected: clean worktree `codex/tg-static-orbit-cleanup` is based on the exact GitHub `main` SHA.

- [ ] **Step 2: Establish the green baseline before changing tests**

```bash
cd "$CAMBIUM_SALVAGE_WORKTREE"
node --test \
  --test-name-pattern='page · (Mission Control visual primitives are named and reduced-motion safe|component route renders the reference glyph state board as components|Mission scene renders branch arcs, next mission, blockers, proof, KPIs, and actions)' \
  workers/quests/src/handler.test.ts
```

Expected: the three existing animated-orbit tests pass on current `main`.

- [ ] **Step 3: Write the failing static-orbit assertions**

Apply this patch to `workers/quests/src/handler.test.ts`:

```diff
@@
-    'orbitSweep',
+    'staticOrbit',
@@
-    '.mc-orbit::after,.mc-orbit[data-motion="orbitSweep"]::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}',
+    '.mc-orbit::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}',
@@
-    'data-motion="orbitSweep"',
+    'data-motion="staticOrbit"',
@@
-  assert.match(PAGE, /\.mc-selected-halo\[data-motion="orbitSweep"\]::after\{[^}]*animation:none/);
-  assert.doesNotMatch(PAGE, /\.mc-selected-halo\[data-motion="orbitSweep"\]::after\{[^}]*animation:orbitSweep/);
+  assert.doesNotMatch(PAGE, /@keyframes orbitSweep|animation:orbitSweep|data-motion="orbitSweep"|data-motion-primitive="orbitSweep"/);
+  assert.doesNotMatch(PAGE, /\.mc-selected-halo\[data-motion="orbitSweep"\]/);
```

Preserve the existing selected-branch-chip negative assertion and the gate/branch-sheet negative animation assertion.

- [ ] **Step 4: Run the focused tests and prove they fail for the intended reason**

```bash
cd "$CAMBIUM_SALVAGE_WORKTREE"
node --test \
  --test-name-pattern='page · (Mission Control visual primitives are named and reduced-motion safe|component route renders the reference glyph state board as components|Mission scene renders branch arcs, next mission, blockers, proof, KPIs, and actions)' \
  workers/quests/src/handler.test.ts
```

Expected: command exits non-zero because `staticOrbit` is absent and `orbitSweep` remains; unrelated tests are skipped, not failed.

- [ ] **Step 5: Implement the minimal static orbit**

Apply these exact semantic replacements to `workers/quests/src/page.ts`:

```diff
@@
-	  @keyframes orbitSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@@
-	  .mc-orbit::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(224,255,79,.24);border-left-color:transparent;pointer-events:none}
-	  .mc-orbit[data-motion="orbitSweep"]::after{border-color:rgba(224,255,79,.4);border-left-color:transparent;animation:orbitSweep 4.8s var(--ease) infinite}
+	  .mc-orbit::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(224,255,79,.24);pointer-events:none}
+	  .mc-orbit.is-active::after{border-color:rgba(224,255,79,.4)}
@@
-	  .mc-selected-halo[data-motion="orbitSweep"]::after{border-color:rgba(224,255,79,.22);animation:none}
@@
-	    .mc-orbit::after,.mc-orbit[data-motion="orbitSweep"]::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}
+	    .mc-orbit::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}
@@
-  Motion:['orbitSweep','packetDrift','glyphBreathe','warningAttention','reducedMotion']
+  Motion:['staticOrbit','packetDrift','glyphBreathe','warningAttention','reducedMotion']
@@
-  const motion = kind === 'active' && !RM ? ' data-motion="orbitSweep" data-motion-primitive="orbitSweep"' : '';
@@
-  return '<span class="' + mcClass('mc-orbit', kind) + '" data-component="OrbitProgress" data-state="' + esc(kind) + '" data-value="' + value + '"' + motion + ' role="img" aria-label="' + esc(aria) + '" style="--mc-progress:' + value + '"><span class="mc-orbit-label">' + esc(label) + '</span>' + packets + '</span>';
+  return '<span class="' + mcClass('mc-orbit', kind) + '" data-component="OrbitProgress" data-state="' + esc(kind) + '" data-value="' + value + '" role="img" aria-label="' + esc(aria) + '" style="--mc-progress:' + value + '"><span class="mc-orbit-label">' + esc(label) + '</span>' + packets + '</span>';
@@
-    ['orbitSweep','Orbit Sweep', [mcOrbitProgress({ value: 25, state: 'active', label: '25' }), mcOrbitProgress({ value: 50, state: 'active', label: '50' }), mcOrbitProgress({ value: 75, state: 'proof-needed', label: '75' })]],
+    ['staticOrbit','Static Orbit', [mcOrbitProgress({ value: 25, state: 'active', label: '25' }), mcOrbitProgress({ value: 50, state: 'active', label: '50' }), mcOrbitProgress({ value: 75, state: 'proof-needed', label: '75' })]],
```

- [ ] **Step 6: Run the focused green suite**

```bash
cd "$CAMBIUM_SALVAGE_WORKTREE"
node --test \
  --test-name-pattern='page · (Mission Control visual primitives are named and reduced-motion safe|component registry helpers enforce orbit rail packet KPI contracts|component route renders the reference glyph state board as components|Mission scene renders branch arcs, next mission, blockers, proof, KPIs, and actions)' \
  workers/quests/src/handler.test.ts
```

Expected: four tests pass, zero fail.

- [ ] **Step 7: Enforce semantic and two-file boundaries**

```bash
set -euo pipefail
cd "$CAMBIUM_SALVAGE_WORKTREE"
! rg -n 'orbitSweep' workers/quests/src/page.ts
rg -n 'staticOrbit' workers/quests/src/page.ts workers/quests/src/handler.test.ts
actual=$(git diff --name-only origin/main -- | LC_ALL=C sort)
expected=$(printf '%s\n' \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts)
test "$actual" = "$expected"
test -z "$(git ls-files --others --exclude-standard)"
git diff --check origin/main -- \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts
```

Expected: `page.ts` has no `orbitSweep` token, the diff contains exactly two files, and no untracked file exists.

- [ ] **Step 8: Commit only the two-file salvage**

```bash
set -euo pipefail
cd "$CAMBIUM_SALVAGE_WORKTREE"
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git diff --cached --check
test "$(git diff --cached --name-only | wc -l | tr -d ' ')" -eq 2
git commit -m "fix: make mission orbits static"
actual=$(git diff --name-only origin/main...HEAD | LC_ALL=C sort)
expected=$(printf '%s\n' \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts)
test "$actual" = "$expected"
```

Expected: one focused commit with no issue-closing keyword and exactly two changed paths.

### Task 4: Validate, merge, and receipt the static-orbit pull request

**Files:**
- Modify through PR: `workers/quests/src/page.ts`
- Modify through PR: `workers/quests/src/handler.test.ts`
- Regenerate through PR: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`
- Regenerate and include only when bytes differ: `docs/plans/assets/tg-miniapp-viewport-proof/*.png`
- Create outside repo: `<backup>/receipts/static-orbit-*`

**Interfaces:**
- Consumes: immutable Task 3 commit `4b95e085bdc293a80db76e1db2430b2c6dc009c7` and Task 1 GitHub/issue baseline.
- Produces: merged focused code-plus-proof PR, a separate canonical 38-capture proof-refresh commit and receipt, full local and GitHub CI proof, merge SHA, and unchanged issue state.

- [ ] **Step 1: Regenerate and validate the complete canonical viewport proof, then run the entire local release contract**

```bash
set -euo pipefail
cd "$CAMBIUM_SALVAGE_WORKTREE"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
PROOF_DIR=docs/plans/assets/tg-miniapp-viewport-proof
SEMANTIC_SHA=4b95e085bdc293a80db76e1db2430b2c6dc009c7
EXPECTED_BASE=92fb2370770de65117e6aad0d31e6301f52d1ca9

git fetch --prune origin
MAIN_SHA=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
test "$MAIN_SHA" = "$(git rev-parse origin/main)"
test "$(git rev-parse HEAD)" = "$SEMANTIC_SHA"
test -z "$(git status --porcelain --untracked-files=all)"

MERGE_BASE=$(git merge-base "$MAIN_SHA" HEAD)
test "$MERGE_BASE" = "$EXPECTED_BASE"
main_since_base=$(git diff --name-only "$MERGE_BASE..$MAIN_SHA" | LC_ALL=C sort)
test -n "$main_since_base"
while IFS= read -r path; do
  case "$path" in
    docs/superpowers/specs/2026-07-13-cambium-repository-closeout-design.md|docs/superpowers/plans/2026-07-13-cambium-repository-closeout.md) ;;
    *) exit 1 ;;
  esac
done <<< "$main_since_base"

semantic_paths=$(git diff-tree --no-commit-id --name-only -r "$SEMANTIC_SHA" | LC_ALL=C sort)
expected_semantic_paths=$(printf '%s\n' \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts)
test "$semantic_paths" = "$expected_semantic_paths"
test -z "$(comm -12 \
  <(printf '%s\n' "$main_since_base" | LC_ALL=C sort) \
  <(printf '%s\n' "$semantic_paths" | LC_ALL=C sort))"

rm -f \
  .artifacts/tg-miniapp-viewport/failure.json \
  .artifacts/tg-miniapp-viewport/browser-diagnostics.json
CAPTURE_PATHS=$(env -u TG_VIEWPORT_PROOF_FILTER node --input-type=module -e \
  "import { VIEWPORT_PROOF_CAPTURE_STEPS } from './workers/quests/src/visual-viewport-proof.mjs'; process.stdout.write(JSON.stringify(VIEWPORT_PROOF_CAPTURE_STEPS.map(({ path }) => path)))")
test "$(jq length <<< "$CAPTURE_PATHS")" -eq 38
test "$(jq 'unique | length' <<< "$CAPTURE_PATHS")" -eq 38
env -u TG_VIEWPORT_PROOF_FILTER npm run proof:tg-viewport
test ! -e .artifacts/tg-miniapp-viewport/failure.json
test ! -e .artifacts/tg-miniapp-viewport/browser-diagnostics.json
test -z "$(git ls-files --others --exclude-standard)"

PAGE_SHA=$(node --input-type=module -e \
  "import { createHash } from 'node:crypto'; import { PAGE } from './workers/quests/src/page.ts'; process.stdout.write(createHash('sha256').update(PAGE).digest('hex'))")
test "$(jq -r .pageSourceSha256 "$PROOF_DIR/manifest.json")" = "$PAGE_SHA"
jq -e '
  (.proofs | length) == 38 and
  ([.proofs[].path] | unique | length) == 38 and
  all(.proofs[];
    (.path | type == "string") and (.path | endswith(".png")) and
    (.bytes | type == "number") and
    (.sha256 | test("^[a-f0-9]{64}$")))
' "$PROOF_DIR/manifest.json"

jq -r '.proofs[] | [.path,.intent,.fixture,(.bytes|tostring),.sha256] | @tsv' \
  "$PROOF_DIR/manifest.json" \
  > "$BACKUP_DIR/receipts/static-orbit-viewport-refresh.tsv"
test "$(wc -l < "$BACKUP_DIR/receipts/static-orbit-viewport-refresh.tsv" | tr -d ' ')" -eq 38

while IFS=$'\t' read -r path intent fixture bytes sha; do
  test -n "$intent"
  test -n "$fixture"
  file="$PROOF_DIR/$path"
  test -f "$file"
  test "$(wc -c < "$file" | tr -d ' ')" = "$bytes"
  test "$(shasum -a 256 "$file" | awk '{print $1}')" = "$sha"
done < "$BACKUP_DIR/receipts/static-orbit-viewport-refresh.tsv"

cmp \
  <(find "$PROOF_DIR" -maxdepth 1 -type f -name '*.png' -exec basename {} \; | LC_ALL=C sort) \
  <(jq -r '.proofs[].path' "$PROOF_DIR/manifest.json" | LC_ALL=C sort)

proof_changes=$(git diff --name-only -- "$PROOF_DIR" | LC_ALL=C sort)
test -n "$proof_changes"
printf '%s\n' "$proof_changes" | rg -Fxq "$PROOF_DIR/manifest.json"
while IFS= read -r path; do
  case "$path" in
    "$PROOF_DIR/manifest.json"|"$PROOF_DIR/"*.png) ;;
    *) exit 1 ;;
  esac
done <<< "$proof_changes"
test -z "$(git diff --name-only -- . ":(exclude)$PROOF_DIR/**")"
git diff --check

git add -u -- "$PROOF_DIR/manifest.json" "$PROOF_DIR"/*.png
staged_proof_changes=$(git diff --cached --name-only | LC_ALL=C sort)
test "$staged_proof_changes" = "$proof_changes"
test -z "$(git diff --name-only)"
git diff --cached --check
git commit -m "test: refresh static orbit viewport proof"
git rev-parse HEAD > "$BACKUP_DIR/receipts/static-orbit-pr.head-sha"
read -r VERIFIED_HEAD_SHA < "$BACKUP_DIR/receipts/static-orbit-pr.head-sha"
test "$VERIFIED_HEAD_SHA" = "$(git rev-parse HEAD)"
test "$(git show -s --format=%s HEAD)" = "test: refresh static orbit viewport proof"
test "$(git rev-parse HEAD^)" = "$SEMANTIC_SHA"
test -z "$(git status --porcelain --untracked-files=all)"

npm ci --prefix apps/cambium-r3f
npm run verify:release
test -z "$(git status --porcelain --untracked-files=all)"
```

Expected: the immutable two-file semantic commit remains the proof commit's parent; all 38 capture steps complete; the manifest binds the actual `PAGE` export and every listed PNG by byte count and SHA-256; the 38-row receipt includes byte-identical captures even when their PNGs do not appear in Git; only the manifest and byte-different canonical PNGs form the separate proof-refresh commit; all eight release gates pass; and the worktree remains clean. Editing only `pageSourceSha256` never satisfies this step.

- [ ] **Step 2: Derive the committed branch boundary, then push and open the focused code-plus-proof PR**

```bash
set -euo pipefail
cd "$CAMBIUM_SALVAGE_WORKTREE"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
read -r VERIFIED_HEAD_SHA < "$BACKUP_DIR/receipts/static-orbit-pr.head-sha"
PROOF_DIR=docs/plans/assets/tg-miniapp-viewport-proof
EXPECTED_BASE=92fb2370770de65117e6aad0d31e6301f52d1ca9

git fetch --prune origin
MAIN_SHA=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
test "$MAIN_SHA" = "$(git rev-parse origin/main)"
test "$(git rev-parse HEAD)" = "$VERIFIED_HEAD_SHA"
test -z "$(git status --porcelain --untracked-files=all)"

MERGE_BASE=$(git merge-base "$MAIN_SHA" HEAD)
test "$MERGE_BASE" = "$EXPECTED_BASE"
main_since_base=$(git diff --name-only "$MERGE_BASE..$MAIN_SHA" | LC_ALL=C sort)
test -n "$main_since_base"
while IFS= read -r path; do
  case "$path" in
    docs/superpowers/specs/2026-07-13-cambium-repository-closeout-design.md|docs/superpowers/plans/2026-07-13-cambium-repository-closeout.md) ;;
    *) exit 1 ;;
  esac
done <<< "$main_since_base"

git diff --name-only "origin/main...$VERIFIED_HEAD_SHA" \
  | LC_ALL=C sort \
  > "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths"
for required in \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts \
  "$PROOF_DIR/manifest.json"; do
  rg -Fxq "$required" "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths"
done
while IFS= read -r path; do
  case "$path" in
    workers/quests/src/handler.test.ts|workers/quests/src/page.ts|"$PROOF_DIR/manifest.json") ;;
    "$PROOF_DIR/"*.png) ;;
    *) exit 1 ;;
  esac
done < "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths"
test -z "$(comm -12 \
  <(printf '%s\n' "$main_since_base" | LC_ALL=C sort) \
  "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths")"
EXPECTED_COUNT=$(wc -l < "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths" | tr -d ' ')
test "$EXPECTED_COUNT" -ge 3

git push -u origin codex/tg-static-orbit-cleanup
PR_URL=$(gh pr create --repo Sheshiyer/cambium \
  --base main \
  --head codex/tg-static-orbit-cleanup \
  --title "fix: make mission progress orbits static with canonical proof" \
  --body "Removes the orbit sweep animation, retains static state styling, updates focused renderer assertions, and regenerates the complete canonical 38-capture viewport proof. The PR includes only the regenerated manifest and PNGs whose bytes differ. No GitHub issue state is changed.")
PR=$(gh pr view "$PR_URL" --repo Sheshiyer/cambium --json number --jq .number)
printf '%s\n' "$PR" > "$BACKUP_DIR/receipts/static-orbit-pr.number"
test "$(gh pr view "$PR" --repo Sheshiyer/cambium --json headRefOid --jq .headRefOid)" = "$VERIFIED_HEAD_SHA"

gh api --paginate --slurp -X GET "repos/Sheshiyer/cambium/pulls/$PR/files" \
  -f per_page=100 \
  | jq -S 'add | map({filename,status,previous_filename}) | sort_by(.filename)' \
  > "$BACKUP_DIR/receipts/static-orbit-pr.files.json"
gh api "repos/Sheshiyer/cambium/pulls/$PR" \
  > "$BACKUP_DIR/receipts/static-orbit-pr.meta.json"
test "$(jq .changed_files "$BACKUP_DIR/receipts/static-orbit-pr.meta.json")" -eq "$EXPECTED_COUNT"
jq -r '.[].filename' "$BACKUP_DIR/receipts/static-orbit-pr.files.json" \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/static-orbit-pr.rest-paths"
gh pr diff "$PR" --repo Sheshiyer/cambium --name-only \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/static-orbit-pr.gh-paths"
cmp "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths" \
  "$BACKUP_DIR/receipts/static-orbit-pr.rest-paths"
cmp "$BACKUP_DIR/receipts/static-orbit-pr.expected-paths" \
  "$BACKUP_DIR/receipts/static-orbit-pr.gh-paths"
```

Expected: the REST and CLI path lists exactly match the clean committed branch's derived path list: both semantic files, the regenerated manifest, and only byte-different PNGs beneath the canonical viewport-proof directory. The title and body disclose the full canonical refresh and contain no issue-closing keyword.

- [ ] **Step 3: Prove current CI executed rather than skipped**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
read -r PR < "$BACKUP_DIR/receipts/static-orbit-pr.number"
read -r VERIFIED_HEAD_SHA < "$BACKUP_DIR/receipts/static-orbit-pr.head-sha"

test "$(gh pr view "$PR" --repo Sheshiyer/cambium --json headRefOid --jq .headRefOid)" = "$VERIFIED_HEAD_SHA"
gh pr checks "$PR" --repo Sheshiyer/cambium --watch --interval 10
test "$(gh pr view "$PR" --repo Sheshiyer/cambium --json headRefOid --jq .headRefOid)" = "$VERIFIED_HEAD_SHA"
gh run list --repo Sheshiyer/cambium --workflow ci.yml \
  --event pull_request --commit "$VERIFIED_HEAD_SHA" --limit 20 \
  --json databaseId,headSha,event,status,conclusion,url \
  > "$BACKUP_DIR/receipts/static-orbit-ci.runs.json"
RUN_ID=$(jq -er --arg sha "$VERIFIED_HEAD_SHA" \
  'map(select(.headSha == $sha and .event == "pull_request")) | sort_by(.databaseId) | last | .databaseId' \
  "$BACKUP_DIR/receipts/static-orbit-ci.runs.json")
test "$RUN_ID" != null
gh run watch "$RUN_ID" --repo Sheshiyer/cambium --interval 10 --exit-status

gh run view "$RUN_ID" --repo Sheshiyer/cambium --json jobs \
  > "$BACKUP_DIR/receipts/static-orbit-ci.jobs.json"
jq -e '
  (.jobs | length) == 1 and
  .jobs[0].name == "deterministic release verification · node 26" and
  .jobs[0].status == "completed" and .jobs[0].conclusion == "success" and
  ([.jobs[].steps[] |
    select(.name == "Run actions/checkout@v4" or
           .name == "Set up Node 26" or
           .name == "Install retained R3F runtime" or
           .name == "Resolve Chromium" or
           .name == "Verify deterministic release contract" or
           .name == "Live readiness report (separate evidence)" or
           .name == "Upload live readiness report")] |
   length == 7 and all(.status == "completed" and .conclusion == "success"))
' "$BACKUP_DIR/receipts/static-orbit-ci.jobs.json"

gh run view "$RUN_ID" --repo Sheshiyer/cambium --log \
  > "$BACKUP_DIR/receipts/static-orbit-ci.log"
test "$(rg -o '== (drift audit|core tests|generated docs|standalone audit|standalone smoke|Telegram mobile contract|R3F tests|R3F build) ==' \
  "$BACKUP_DIR/receipts/static-orbit-ci.log" | LC_ALL=C sort -u | wc -l | tr -d ' ')" -eq 8
rg -q 'Deterministic release verification passed' "$BACKUP_DIR/receipts/static-orbit-ci.log"
! rg -q 'Release verification failed at:' "$BACKUP_DIR/receipts/static-orbit-ci.log"
```

Expected: overall job success, seven required step successes, and eight unique release-gate log markers.

- [ ] **Step 4: Recheck issue state, merge, and capture the merge receipt**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
read -r PR < "$BACKUP_DIR/receipts/static-orbit-pr.number"
read -r VERIFIED_HEAD_SHA < "$BACKUP_DIR/receipts/static-orbit-pr.head-sha"

gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues \
  -f state=all -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add
      | map(select(has("pull_request") | not)
        | (.labels |= sort_by(.id))
        | (.assignees |= sort_by(.id)))
      | sort_by(.number)' \
  > "$BACKUP_DIR/receipts/issues-all.before-static-orbit-merge.json"
diff -u \
  "$BACKUP_DIR/github/issues-all.before.json" \
  "$BACKUP_DIR/receipts/issues-all.before-static-orbit-merge.json"
test "$(gh repo view Sheshiyer/cambium --json deleteBranchOnMerge --jq .deleteBranchOnMerge)" = false

test "$(gh pr view "$PR" --repo Sheshiyer/cambium --json headRefOid --jq .headRefOid)" = "$VERIFIED_HEAD_SHA"
gh pr merge "$PR" --repo Sheshiyer/cambium --merge \
  --match-head-commit "$VERIFIED_HEAD_SHA"
gh pr view "$PR" --repo Sheshiyer/cambium \
  --json number,state,headRefName,headRefOid,mergeCommit,mergedAt,url \
  | jq -S . > "$BACKUP_DIR/receipts/static-orbit-pr.merged.json"
test "$(jq -r .state "$BACKUP_DIR/receipts/static-orbit-pr.merged.json")" = MERGED
MERGE_SHA=$(jq -r .mergeCommit.oid "$BACKUP_DIR/receipts/static-orbit-pr.merged.json")

for attempt in $(seq 1 30); do
  gh run list --repo Sheshiyer/cambium --workflow ci.yml \
    --event push --commit "$MERGE_SHA" --limit 20 \
    --json databaseId,headSha,event,status,conclusion,url \
    > "$BACKUP_DIR/receipts/static-orbit-push-ci.runs.json"
  PUSH_RUN_ID=$(jq -r --arg sha "$MERGE_SHA" \
    'map(select(.headSha == $sha and .event == "push")) | sort_by(.databaseId) | last | .databaseId // empty' \
    "$BACKUP_DIR/receipts/static-orbit-push-ci.runs.json")
  test -n "$PUSH_RUN_ID" && break
  sleep 10
done
test -n "$PUSH_RUN_ID"
gh run watch "$PUSH_RUN_ID" --repo Sheshiyer/cambium --interval 10 --exit-status
gh run view "$PUSH_RUN_ID" --repo Sheshiyer/cambium --json jobs \
  > "$BACKUP_DIR/receipts/static-orbit-push-ci.jobs.json"
jq -e '
  (.jobs | length) == 1 and
  .jobs[0].name == "deterministic release verification · node 26" and
  .jobs[0].status == "completed" and .jobs[0].conclusion == "success" and
  ([.jobs[].steps[] |
    select(.name == "Verify deterministic release contract" or
           .name == "Live readiness report (separate evidence)" or
           .name == "Upload live readiness report")] |
   length == 3 and all(.status == "completed" and .conclusion == "success"))
' "$BACKUP_DIR/receipts/static-orbit-push-ci.jobs.json"
gh run view "$PUSH_RUN_ID" --repo Sheshiyer/cambium --log \
  > "$BACKUP_DIR/receipts/static-orbit-push-ci.log"
test "$(rg -o '== (drift audit|core tests|generated docs|standalone audit|standalone smoke|Telegram mobile contract|R3F tests|R3F build) ==' \
  "$BACKUP_DIR/receipts/static-orbit-push-ci.log" | LC_ALL=C sort -u | wc -l | tr -d ' ')" -eq 8
rg -q 'Deterministic release verification passed' "$BACKUP_DIR/receipts/static-orbit-push-ci.log"
! rg -q 'Release verification failed at:' "$BACKUP_DIR/receipts/static-orbit-push-ci.log"

test "$(gh pr list --repo Sheshiyer/cambium --state open --limit 1000 --json number | jq length)" -eq 0
test "$(gh issue list --repo Sheshiyer/cambium --state open --limit 1000 --json number | jq length)" -eq 0
```

Expected: PR state is `MERGED`, open PR and issue counts are zero, and automatic branch deletion is still disabled.

### Task 5: Create the pre-deletion recovery anchor and retire remote branches

**Files:**
- Create outside repo: `<backup>/git/refs.pre-delete.tsv`
- Create outside repo: `<backup>/git/cambium-pre-delete-all-refs.bundle`
- Create outside repo: `<backup>/receipts/remote-*.json`

**Interfaces:**
- Consumes: both verified merge receipts and all surviving refs.
- Produces: second verified all-ref recovery anchor and a receipt for every deleted remote branch.

- [ ] **Step 1: Create a second all-ref bundle after both merges and before deletion**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
git -C "$ROOT" fetch --prune origin
test "$(gh pr list --repo Sheshiyer/cambium --state open --limit 1000 --json number | jq length)" -eq 0

git -C "$ROOT" for-each-ref \
  --sort=refname \
  --format='%(objectname)%09%(objecttype)%09%(refname)%09%(symref)' \
  | LC_ALL=C sort > "$BACKUP_DIR/git/refs.pre-delete.tsv"
BUNDLE=$BACKUP_DIR/git/cambium-pre-delete-all-refs.bundle
git -C "$ROOT" bundle create "$BUNDLE" --all
git -C "$ROOT" bundle verify "$BUNDLE" \
  > "$BACKUP_DIR/verification/bundle-pre-delete.verify.txt"
git bundle list-heads "$BUNDLE" \
  | LC_ALL=C sort > "$BACKUP_DIR/verification/bundle-pre-delete.heads.tsv"

SCRATCH=$(mktemp -d /tmp/cambium-pre-delete.XXXXXX)
git clone --mirror "$BUNDLE" "$SCRATCH/cambium.git"
git --git-dir="$SCRATCH/cambium.git" fsck --full
while IFS=$'\t' read -r expected_sha expected_type ref symref; do
  actual_sha=$(git --git-dir="$SCRATCH/cambium.git" rev-parse "$ref^{object}")
  test "$actual_sha" = "$expected_sha"
  actual_type=$(git --git-dir="$SCRATCH/cambium.git" cat-file -t "$actual_sha")
  test "$actual_type" = "$expected_type"
done < "$BACKUP_DIR/git/refs.pre-delete.tsv"
printf '%s\n' "all pre-delete refs resolved in mirror clone" \
  > "$BACKUP_DIR/verification/bundle-pre-delete.restore.txt"
```

Expected: every old, documentation, salvage, main, remote-tracking, and tag ref is recoverable at its exact pre-deletion SHA.

- [ ] **Step 2: Snapshot and review the remote deletion candidate set**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
gh api --paginate repos/Sheshiyer/cambium/branches \
  --jq '.[] | select(.name != "main") | [.name,.commit.sha] | @tsv' \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/remote-candidates.tsv"
! rg -q '^main	' "$BACKUP_DIR/receipts/remote-candidates.tsv"
test "$(wc -l < "$BACKUP_DIR/receipts/remote-candidates.tsv" | tr -d ' ')" -gt 0
```

Expected: the reviewed candidate file contains every non-`main` branch once and never contains `main`.

- [ ] **Step 3: Delete each remote branch only through a fresh compare gate**

Define and invoke this fail-closed Bash function:

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"

retire_remote_branch() {
  local branch=$1 recorded_sha=$2 main_sha live_sha receipt slug encoded compare_file
  slug=$(printf '%s' "$branch" | tr '/ ' '__')
  receipt="$BACKUP_DIR/receipts/remote-$slug.json"
  compare_file="$BACKUP_DIR/receipts/remote-$slug.compare.json"
  encoded=$(jq -rn --arg value "$branch" '$value | @uri')

  git -C "$ROOT" fetch --prune origin
  main_sha=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
  live_sha=$(gh api "repos/Sheshiyer/cambium/git/ref/heads/$encoded" --jq .object.sha)
  test "$live_sha" = "$recorded_sha"

  gh api "repos/Sheshiyer/cambium/compare/$main_sha...$live_sha" > "$compare_file"
  jq -e --arg main "$main_sha" --arg head "$live_sha" '
    .base_commit.sha == $main and
    .merge_base_commit.sha == $head and
    .ahead_by == 0 and
    (.files | length) == 0
  ' "$compare_file"
  rg -q "$recorded_sha" "$BACKUP_DIR/git/refs.pre-delete.tsv"

  jq -n \
    --arg branch "$branch" \
    --arg branchSha "$live_sha" \
    --arg mainSha "$main_sha" \
    --arg checkedAt "$(date -u +%FT%TZ)" \
    --argjson aheadBy "$(jq .ahead_by "$compare_file")" \
    --argjson fileCount "$(jq '.files | length' "$compare_file")" \
    '{branch:$branch,branchSha:$branchSha,mainSha:$mainSha,
      aheadBy:$aheadBy,fileCount:$fileCount,checkedAt:$checkedAt,
      reason:"contained in current main",deleted:false}' > "$receipt"

  test "$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)" = "$main_sha"
  git -C "$ROOT" push --porcelain \
    --force-with-lease="refs/heads/$branch:$live_sha" \
    origin --delete "$branch" \
    > "$BACKUP_DIR/receipts/remote-$slug.delete.log" 2>&1
  if git -C "$ROOT" ls-remote --exit-code --heads origin "$branch" >/dev/null; then
    return 1
  fi
  set +e
  gh api --include "repos/Sheshiyer/cambium/git/ref/heads/$encoded" \
    > "$BACKUP_DIR/receipts/remote-$slug.absence.txt" 2>&1
  absence_rc=$?
  set -e
  test "$absence_rc" -ne 0
  rg -q '404' "$BACKUP_DIR/receipts/remote-$slug.absence.txt"
  jq --arg deletedAt "$(date -u +%FT%TZ)" \
    '.deleted=true | .deletedAt=$deletedAt' "$receipt" > "$receipt.tmp"
  mv "$receipt.tmp" "$receipt"
}

while IFS=$'\t' read -r branch sha; do
  retire_remote_branch "$branch" "$sha"
done < "$BACKUP_DIR/receipts/remote-candidates.tsv"
```

Expected: every invocation records `aheadBy: 0`, `fileCount: 0`, an exact main SHA, and `deleted: true`. The function stops before deletion on any mismatch.

- [ ] **Step 4: Verify the remote inventory is exactly main**

```bash
set -euo pipefail
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
gh api --paginate repos/Sheshiyer/cambium/branches \
  --jq '.[] | [.name,.commit.sha] | @tsv' \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/remote-branches.after.tsv"
test "$(wc -l < "$BACKUP_DIR/receipts/remote-branches.after.tsv" | tr -d ' ')" -eq 1
test "$(cut -f1 "$BACKUP_DIR/receipts/remote-branches.after.tsv")" = main
```

Expected: GitHub exposes exactly one branch named `main`.

### Task 6: Restore the dirty checkout, align main, remove temporary worktrees, and retire local branches

**Files:**
- Restore from current branch HEAD: the 11 modified paths in the dirty checkout.
- Remove after verified backup: the three named untracked stale artifacts.
- Remove after merge proof: the two temporary closeout worktrees.

**Interfaces:**
- Consumes: verified dirty reconstruction, two merge receipts, pre-deletion bundle, and remote-only-`main` state.
- Produces: clean primary checkout on exact current `main` and local branch inventory containing `main` alone.

- [ ] **Step 1: Prove no concurrent dirty-tree change occurred after backup**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
git -C "$ROOT" status --porcelain=v1 --untracked-files=all \
  > "$BACKUP_DIR/verification/status.before-retirement.txt"
diff -u \
  "$BACKUP_DIR/dirty/status.before.txt" \
  "$BACKUP_DIR/verification/status.before-retirement.txt"
```

Expected: empty diff. If status changed, stop and create a new timestamped backup before continuing.

- [ ] **Step 2: Prove the static-orbit intent is reachable from current main**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
git -C "$ROOT" fetch --prune origin
git -C "$ROOT" show origin/main:workers/quests/src/page.ts \
  | rg -q 'staticOrbit'
if git -C "$ROOT" show origin/main:workers/quests/src/page.ts \
  | rg -q 'orbitSweep'; then
  exit 1
fi
```

Expected: current `origin/main` contains `staticOrbit` and no `orbitSweep`.

- [ ] **Step 3: Restore only the 11 tracked paths from the dirty branch HEAD**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
git -C "$ROOT" restore --source=HEAD --staged --worktree -- \
  docs/architecture/DEPENDENCY-GRAPH.md \
  docs/architecture/REFRESH-NEEDED.md \
  docs/architecture/SERVICES.md \
  docs/plans/product-branches/fitcheck.md \
  docs/plans/product-branches/iverif.md \
  docs/plans/product-branches/schema.json \
  docs/plans/product-branches/snow-gloves-os.md \
  docs/plans/product-branches/vantyx.md \
  scripts/validate-product-branch-packets.mjs \
  workers/quests/src/handler.test.ts \
  workers/quests/src/page.ts
```

Expected: only the three already backed-up untracked paths remain in `git status`.

- [ ] **Step 4: Remove exactly the three backed-up untracked stale artifacts**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
rm -f \
  "$ROOT/docs/plans/2026-07-10-tg-miniapp-signed-gate-channel-quest-plan.md" \
  "$ROOT/docs/plans/product-branches/loop-library.md" \
  "$ROOT/docs/superpowers/plans/2026-07-05-cambium-branch-loop-library.md"
test -z "$(git -C "$ROOT" status --porcelain)"
```

Expected: the stale branch worktree is clean. The three removed bytes remain in the verified backup.

- [ ] **Step 5: Remove clean merged temporary worktrees**

Run from `ROOT`, not from either worktree being removed:

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
DOC_WT="${CAMBIUM_DOC_WORKTREE:?Set CAMBIUM_DOC_WORKTREE to the docs worktree}"
SALVAGE_WT="${CAMBIUM_SALVAGE_WORKTREE:?Set CAMBIUM_SALVAGE_WORKTREE to the salvage worktree}"
git -C "$ROOT" fetch origin

for wt in "$DOC_WT" "$SALVAGE_WT"; do
  test -z "$(git -C "$wt" status --porcelain)"
  wt_sha=$(git -C "$wt" rev-parse HEAD)
  git -C "$ROOT" merge-base --is-ancestor "$wt_sha" origin/main
  rm -rf "$wt/apps/cambium-r3f/node_modules"
  git -C "$ROOT" worktree remove "$wt"
done
```

Expected: both temporary worktree paths are absent; no `--force` option was used.

- [ ] **Step 6: Switch the primary checkout to main and fast-forward**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
git -C "$ROOT" switch main
git -C "$ROOT" fetch --prune origin
git -C "$ROOT" merge --ff-only origin/main
GH_MAIN=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
test "$(git -C "$ROOT" rev-parse HEAD)" = "$GH_MAIN"
test "$(git -C "$ROOT" rev-parse origin/main)" = "$GH_MAIN"
test -z "$(git -C "$ROOT" status --porcelain)"
```

Expected: primary checkout is clean and local, remote-tracking, and GitHub `main` SHAs are identical.

- [ ] **Step 7: Retire each local feature branch through ancestry and recovery gates**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
git -C "$ROOT" for-each-ref \
  --format='%(refname:short)%09%(objectname)' refs/heads \
  | awk -F '	' '$1 != "main"' \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/local-candidates.tsv"

while IFS=$'\t' read -r branch branch_sha; do
  git -C "$ROOT" fetch --prune origin
  git -C "$ROOT" merge --ff-only origin/main
  main_sha=$(git -C "$ROOT" rev-parse HEAD)
  git -C "$ROOT" merge-base --is-ancestor "$branch_sha" "$main_sha"
  rg -q "$branch_sha" "$BACKUP_DIR/git/refs.pre-delete.tsv"

  slug=$(printf '%s' "$branch" | tr '/ ' '__')
  jq -n \
    --arg branch "$branch" \
    --arg branchSha "$branch_sha" \
    --arg mainSha "$main_sha" \
    --arg checkedAt "$(date -u +%FT%TZ)" \
    '{branch:$branch,branchSha:$branchSha,mainSha:$mainSha,
      ancestor:true,checkedAt:$checkedAt,
      reason:"ancestor of current main and present in verified pre-delete bundle",
      deleted:false}' > "$BACKUP_DIR/receipts/local-$slug.json"

  git -C "$ROOT" branch -d "$branch"
  test -z "$(git -C "$ROOT" for-each-ref --format='%(refname:short)' "refs/heads/$branch")"
  jq --arg deletedAt "$(date -u +%FT%TZ)" \
    '.deleted=true | .deletedAt=$deletedAt' \
    "$BACKUP_DIR/receipts/local-$slug.json" \
    > "$BACKUP_DIR/receipts/local-$slug.json.tmp"
  mv "$BACKUP_DIR/receipts/local-$slug.json.tmp" \
    "$BACKUP_DIR/receipts/local-$slug.json"
done < "$BACKUP_DIR/receipts/local-candidates.tsv"
```

Expected: `git branch -d` succeeds for each candidate without force; every receipt records ancestry and recovery-anchor proof.

- [ ] **Step 8: Verify the local inventory is exactly main**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
git -C "$ROOT" for-each-ref \
  --format='%(refname:short)%09%(objectname)' refs/heads \
  | LC_ALL=C sort > "$BACKUP_DIR/receipts/local-branches.after.tsv"
test "$(wc -l < "$BACKUP_DIR/receipts/local-branches.after.tsv" | tr -d ' ')" -eq 1
test "$(cut -f1 "$BACKUP_DIR/receipts/local-branches.after.tsv")" = main
```

Expected: exactly one local branch named `main` remains.

### Task 7: Prove final invariants and enable automatic merged-head deletion

**Files:**
- Create outside repo: `<backup>/github/*.after.json`
- Create outside repo: `<backup>/SHA256SUMS.final`

**Interfaces:**
- Consumes: local/remote-only-`main` state and all receipts.
- Produces: final closeout receipt, unchanged issue/tag/release proof, verified final backup, and `deleteBranchOnMerge=true`.

- [ ] **Step 1: Capture final read-only inventories before the setting mutation**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"

gh pr list --repo Sheshiyer/cambium --state open --limit 1000 \
  --json number,state,title,headRefName,headRefOid,baseRefName,url \
  | jq -S . > "$BACKUP_DIR/github/pulls-open.after.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues \
  -f state=open -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add | map(select(has("pull_request") | not)) | sort_by(.number)' \
  > "$BACKUP_DIR/github/issues-open.after.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues \
  -f state=all -f per_page=100 -f sort=created -f direction=asc \
  | jq -S 'add
      | map(select(has("pull_request") | not)
        | (.labels |= sort_by(.id))
        | (.assignees |= sort_by(.id)))
      | sort_by(.number)' \
  > "$BACKUP_DIR/github/issues-all.after.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues/comments \
  -f per_page=100 \
  | jq -S --slurpfile issues "$BACKUP_DIR/github/issues-all.after.json" '
      ($issues[0] | map(.number | tostring)) as $numbers
      | add
      | map(select((.issue_url | split("/") | last) as $n
        | ($numbers | index($n)) != null))
      | sort_by(.id)' \
  > "$BACKUP_DIR/github/issue-comments.after.json"
gh api --paginate --slurp -X GET repos/Sheshiyer/cambium/issues/events \
  -f per_page=100 \
  | jq -S --slurpfile issues "$BACKUP_DIR/github/issues-all.after.json" '
      ($issues[0] | map(.number | tostring)) as $numbers
      | add
      | map(select((.issue.number | tostring) as $n
        | ($numbers | index($n)) != null))
      | sort_by(.id)' \
  > "$BACKUP_DIR/github/issue-events.after.json"
shasum -a 256 \
  "$BACKUP_DIR/github/issues-all.after.json" \
  "$BACKUP_DIR/github/issue-comments.after.json" \
  "$BACKUP_DIR/github/issue-events.after.json" \
  | awk '{print $1}' | shasum -a 256 | awk '{print $1}' \
  > "$BACKUP_DIR/github/issues.after.fingerprint"
gh release list --repo Sheshiyer/cambium --limit 100 \
  --json tagName,name,isDraft,isPrerelease,publishedAt \
  | jq -S . > "$BACKUP_DIR/github/releases.after.json"
git -C "$ROOT" ls-remote --tags origin \
  | LC_ALL=C sort > "$BACKUP_DIR/git/origin-tags.after.tsv"
git -C "$ROOT" for-each-ref \
  --format='%(objectname)%09%(refname)' refs/tags \
  | LC_ALL=C sort > "$BACKUP_DIR/git/local-tags.after.tsv"

test "$(jq length "$BACKUP_DIR/github/pulls-open.after.json")" -eq 0
test "$(jq length "$BACKUP_DIR/github/issues-open.after.json")" -eq 0
diff -u "$BACKUP_DIR/github/issues-all.before.json" "$BACKUP_DIR/github/issues-all.after.json"
diff -u "$BACKUP_DIR/github/issue-comments.before.json" "$BACKUP_DIR/github/issue-comments.after.json"
diff -u "$BACKUP_DIR/github/issue-events.before.json" "$BACKUP_DIR/github/issue-events.after.json"
cmp "$BACKUP_DIR/github/issues.before.fingerprint" "$BACKUP_DIR/github/issues.after.fingerprint"
diff -u "$BACKUP_DIR/github/releases.before.json" "$BACKUP_DIR/github/releases.after.json"
diff -u \
  <(awk -F '	' '$2 ~ /^refs\/tags\//' "$BACKUP_DIR/git/origin-refs.before.tsv") \
  "$BACKUP_DIR/git/origin-tags.after.tsv"
diff -u \
  <(awk -F '	' '$3 ~ /^refs\/tags\// {print $1 "\t" $3}' "$BACKUP_DIR/git/refs.before.tsv") \
  "$BACKUP_DIR/git/local-tags.after.tsv"
```

Expected: zero open PRs/issues, full issue metadata unchanged, releases unchanged, and remote tags unchanged.

- [ ] **Step 2: Reconfirm branch and main SHA invariants**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
GH_MAIN=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)
test "$(git -C "$ROOT" rev-parse HEAD)" = "$GH_MAIN"
test "$(git -C "$ROOT" rev-parse origin/main)" = "$GH_MAIN"
test "$(git -C "$ROOT" for-each-ref --format='%(refname:short)' refs/heads)" = main
test "$(gh api --paginate repos/Sheshiyer/cambium/branches --jq '.[].name')" = main
test -z "$(git -C "$ROOT" status --porcelain)"
test "$(git -C "$ROOT" worktree list --porcelain | rg -c '^worktree ')" -eq 1
```

Expected: one clean worktree, one local branch, one remote branch, and one shared main SHA.

- [ ] **Step 3: Enable automatic merged-head deletion as the final repository mutation**

```bash
set -euo pipefail
gh api -X PATCH repos/Sheshiyer/cambium -F delete_branch_on_merge=true \
  | jq -S '{full_name,delete_branch_on_merge}' \
  > /tmp/cambium-delete-branch-setting.json
test "$(jq -r .delete_branch_on_merge /tmp/cambium-delete-branch-setting.json)" = true
test "$(gh repo view Sheshiyer/cambium --json deleteBranchOnMerge --jq .deleteBranchOnMerge)" = true
```

Expected: GitHub reports `deleteBranchOnMerge=true`. No further GitHub mutation follows.

- [ ] **Step 4: Write the final receipt and verify every backup artifact**

```bash
set -euo pipefail
ROOT="${CAMBIUM_PRIMARY_WORKTREE:?Set CAMBIUM_PRIMARY_WORKTREE to the primary checkout}"
read -r BACKUP_DIR < "$HOME/.codex/backups/cambium/ACTIVE-CLOSEOUT"
GH_MAIN=$(gh api repos/Sheshiyer/cambium/branches/main --jq .commit.sha)

jq -n \
  --arg completedAt "$(date -u +%FT%TZ)" \
  --arg mainSha "$GH_MAIN" \
  --arg backupDir "$BACKUP_DIR" \
  '{completedAt:$completedAt,mainSha:$mainSha,backupDir:$backupDir,
    localBranches:["main"],remoteBranches:["main"],
    openPullRequests:0,openIssues:0,worktrees:1,
    deleteBranchOnMerge:true,tagsChanged:false,releasesChanged:false,
    backupVerified:true}' > "$BACKUP_DIR/receipts/closeout.final.json"

(
  cd "$BACKUP_DIR"
  find . -type f ! -name 'SHA256SUMS.final' -print \
    | LC_ALL=C sort \
    | while IFS= read -r path; do shasum -a 256 "$path"; done \
    > SHA256SUMS.final
  shasum -a 256 -c SHA256SUMS.final
)
```

Expected: every artifact reports `OK` and `closeout.final.json` records the exact GitHub main SHA and all final invariants.

---

## Execution Stop Conditions

Stop before the associated mutation if any of these occurs:

- dirty status or content differs from the verified backup;
- an expected ref is absent from either verified bundle;
- a pull request contains an undeclared file;
- local or GitHub CI is failing, incomplete, or skipped;
- the full issue fingerprint changes;
- a branch tip changes after candidate capture;
- a compare reports any commit or file ahead;
- a local tip is not an ancestor of current main;
- a worktree is dirty or its tip is not reachable from current main;
- local, remote-tracking, and GitHub main SHAs disagree.

No stop condition authorizes force deletion, reset, history rewrite, or issue mutation.
