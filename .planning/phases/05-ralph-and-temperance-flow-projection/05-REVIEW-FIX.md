---
phase: 05-ralph-and-temperance-flow-projection
fixed_at: 2026-08-19T11:15:01Z
review_path: .planning/phases/05-ralph-and-temperance-flow-projection/05-REVIEW.md
iteration: 3
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-08-19T11:15:01Z
**Source review:** `.planning/phases/05-ralph-and-temperance-flow-projection/05-REVIEW.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 8
- Fixed: 7
- Skipped: 1 external installation
- Repository-owned portions fixed: 8/8
- Protected host state modified: none

## Fixed Issues

### CR-02: Approval and execution are not bound to the reviewed checkout

**Files modified:** `docs/runbooks/ralph-temperance-iteration.md`, `scripts/ralph-iteration.mjs`, `scripts/run-ralph-iteration.mjs`, `scripts/run-ralph-iteration.test.mjs`, `scripts/temperance-host-boundary.mjs`
**Commit:** 778427d
**Status:** fixed: requires human verification
**Applied fix:** Bound canonical repository identity, reviewed commit, root digest, source snapshot, approval, host receipts, recovery records, and idempotency to one checkout. The public runner resolves and validates the Git root, launches protected commands with that root as `cwd`, and revalidates head/root/source bytes immediately before execution. Adversarial clone, root, head-drift, and child-cwd tests fail closed.

### CR-03: The checkpoint compare-and-swap can overwrite concurrent state

**Files modified:** `docs/runbooks/ralph-temperance-iteration.md`, `scripts/run-ralph-iteration.mjs`, `scripts/versioned-file-cas.mjs`, `scripts/versioned-file-cas.test.mjs`
**Commit:** c7f100c
**Status:** fixed: requires human verification
**Applied fix:** Added a lock-held versioned file CAS that compares digest and file identity/version facts while holding an exclusive bounded lock, durably writes and fsyncs the replacement, and recovers dead owners. Two real child processes prove exactly one update wins and a stale expected version reports `cas_conflict` without overwriting the winner.

### CR-04: Normalized Temperance projection schemas bypass the derived-data guard

**Files modified:** `workers/quests/src/goal-graph/projection-contract.ts`, `workers/quests/src/goal-graph/projection-contract.test.ts`
**Commit:** 0b30c6f
**Status:** fixed: requires human verification
**Applied fix:** Canonicalized every graph-family token through one separator-insensitive spelling before authoritative validation. Exact, collapsed, punctuation-normalized, malformed, and future Temperance projection variants are rejected from the D1 authoritative write path.

### WR-01: Ready projections accept contradictory phase and freshness metadata

**Files modified:** `scripts/temperance-flow.mjs`, `scripts/temperance-flow.test.mjs`, `scripts/ralph-iteration.test.mjs`
**Commits:** 4235948, ed019ec
**Status:** fixed: requires human verification
**Applied fix:** Closed ready-state semantics across command, active plan, route, and authority phase identities; normalized leading-zero and slug phase spellings; required every decision authority to be fresh; and required receipt freshness/resolution to agree. Rehashed contradictory fixtures are rejected.

### WR-02: Stop results accept arbitrary command and secret-bearing fields

**Files modified:** `scripts/ralph-iteration.mjs`, `scripts/ralph-iteration.test.mjs`
**Commit:** 41d00f2
**Status:** fixed: requires human verification
**Applied fix:** Replaced the open stop object with exact reason-specific schemas and bounded safe references, including the closed `host_boundary_unavailable` status. Command, prompt, credential, secret, and arbitrary extra fields are rejected before checkpointing or logging.

### WR-03: Reviewed handoff freshness ignores uncommitted implementation changes

**Files modified:** `scripts/temperance-flow-sources.mjs`, `scripts/generate-temperance-flow.test.mjs`
**Commits:** 5ae6840, ae2d5a6, 1aff7d7
**Status:** fixed: requires human verification
**Applied fix:** A reviewed handoff now becomes stale for tracked dirty implementation bytes while explicitly excluding handoff, generated projection, and review artifacts. Implementation-head selection likewise ignores derived-only commits, keeping readiness bound to the last real implementation change. Runtime-dirty and derived-publication fixtures prove both sides.

### WR-04: Concurrent generators can recover and overwrite each other's publication transaction

**Files modified:** `scripts/two-file-transaction.mjs`, `scripts/generate-temperance-flow.test.mjs`
**Commit:** aba8108
**Status:** fixed: requires human verification
**Applied fix:** Held a per-pair exclusive lock across journal recovery, staging, commit, and cleanup with bounded waiting and dead-owner recovery. A two-process regression pauses the first writer between renames and proves the second cannot recover or overwrite the live transaction.

## Skipped Issues

### CR-01: Production host boundary is still absent

**File:** `scripts/run-ralph-iteration.mjs:355-357`
**Reason:** The repository-owned behavior is fixed in commit d021de5: dry-run and read-only inspection initialize no protected integration, while non-dry execution fails closed with the bounded `host_boundary_unavailable` status and a separately authorized installation action. Installing the Manifest commands and production integration test against `~/.temperance_engine` remain a protected external task that this repository review did not authorize. Cambium documents that it never self-creates that boundary.
**Original issue:** The installed host lacks the separately owned Manifest command boundary required by non-dry production execution.

## Supporting Repository Fix

### CR-01 repository mitigation

**Files modified:** `docs/runbooks/ralph-temperance-iteration.md`, `scripts/run-ralph-iteration.mjs`, `scripts/run-ralph-iteration.test.mjs`
**Commit:** d021de5
**Applied fix:** Made public dry-run inspection lazily independent of the protected boundary and made non-dry absence produce an exact, redacted, actionable stop rather than `ENOENT` or implicit installation.

## Checkpoint Publication

**Files modified:** `.project/HANDOFF.md`, `docs/architecture/temperance-flow.md`, `docs/architecture/temperance-flow.v1.json`
**Commits:** 585bcd6, 4bc8af8
**Applied fix:** Recorded the bounded reviewed implementation checkpoint and regenerated the deterministic machine/human flow pair without treating derived publication as a new implementation head.

## Post-Auto Closure

After the three-pass automated fix cap, a bounded primary-agent TDD closure resolved the final repository findings without expanding into host-owned state:

- `2b9b7b6` — live selected-source parity now blocks stale dry-run and execution; host and owner receipts bind `sourceSnapshotDigest`; reducer external results and returned stops use closed safe schemas; compiler foldback detection canonicalizes collapsed Temperance, Intent Graph, and Goal Graph family spellings.
- `a1f75cd` — approval rejection includes `approvalEvidenceRef: null`, and every runner-created stop validates through `validateRalphIteration` before return.

The definitive independent re-review at `a1f75cd` reports `status: clean` with 0 Critical, 0 Warning, and 0 Info findings across all 18 reviewed files. The skipped item above remains an external owner-approved installation dependency, not a Cambium repository defect.

## Verification

- Focused Temperance Flow generator suite: 18/18 passed.
- Focused Ralph and versioned-CAS suite: 26/26 passed.
- Goal Graph projection-contract suite: 11/11 passed.
- Focused final runner suite: 16/16 passed.
- Focused final Ralph/runner/compiler suite: 43/43 passed.
- Full repository suite: 1,875/1,875 passed.
- Temperance Flow generator `--check`: passed.
- Handoff flow/source-set digest parity: passed.
- No host manifest, command, provider configuration, credential, or external deployment state was modified.

---

_Fixed: 2026-08-19T11:15:01Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
