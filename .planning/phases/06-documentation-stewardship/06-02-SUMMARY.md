---
phase: 06-documentation-stewardship
plan: 02
subsystem: documentation-inventory
tags: [node, cli, git-objects, deterministic-stdout, zero-write]

requires:
  - phase: 06-01-documentation-inventory-foundation
    provides: immutable commit-tree source adapter, closed inventory compiler, validator, and pure JSON/Markdown renderers
provides:
  - strict explicit-revision stdout-only JSON and Markdown inventory CLI
  - zero-write double-generation determinism and cross-format parity checker
  - caller-revision package commands with uncontaminated stdout
affects: [06-03-lifecycle-navigation, 06-04-phase-closure, documentation-maintainers]

tech-stack:
  added: []
  patterns: [single-format stdout, caller-supplied immutable revision, in-memory parity verification, closed CLI grammar]

key-files:
  created:
    - scripts/generate-documentation-inventory.mjs
    - scripts/check-documentation-inventory.mjs
    - scripts/generate-documentation-inventory.test.mjs
  modified:
    - package.json

key-decisions:
  - "Public inventory commands require a caller-supplied revision and resolve it to a full commit SHA before emitting either representation."
  - "Inventory JSON and Markdown remain ephemeral stdout views; the checker compares both formats twice in memory and creates no readback files."
  - "Package scripts fix only the output format or check entry point, never HEAD, a commit, or an output destination."

patterns-established:
  - "Closed stdout CLI: exactly one source revision and one JSON-or-Markdown format, with no write, output, staged, runtime, or provider options."
  - "Zero-write parity: validate canonical JSON, compare repeated bytes, and require Markdown to equal the pure renderer over the same validated object."

requirements-completed: [DOCS-01, DOCS-02, DOCS-04]

duration: 15min
completed: 2026-08-20
---

# Phase 6 Plan 2: Explicit-Revision Inventory Readbacks Summary

**Caller-selected commit inventories now emit deterministic machine JSON or human Markdown on stdout, with a no-write checker proving repeated-byte stability and complete shared-object parity.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-20T12:00:10Z
- **Completed:** 2026-08-20T12:15:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a strict CLI that resolves one explicit revision to its immutable full SHA, compiles one inventory object, and emits exactly one parseable JSON object or complete Markdown document.
- Added a zero-write checker that independently generates JSON twice and Markdown twice, rejects nondeterminism, validates canonical JSON, and proves format parity for revision, digests, entries, lifecycle, anchors, exceptions, and root-memory facts.
- Added package commands whose fixed arguments select only JSON, Markdown, or check behavior; the caller must supply the revision and no command publishes an output file.
- Added adversarial temporary-repository and exact package-level tests covering dirty worktrees, staged bytes, binary files, indexed exceptions, historical revisions, privacy, parser closure, checkout/locale independence, and repository/index preservation.

## Task Commits

Each TDD task was committed through explicit RED and GREEN gates:

1. **Task 1: Implement the stdout-only JSON and Markdown CLI**
   - `f16bcf6` — RED explicit-revision, parity, privacy, and zero-write CLI contract
   - `fe771aa` — GREEN strict parser and single-format stdout implementation
2. **Task 2: Add zero-write parity checking and caller-revision package commands**
   - `ba7fb60` — RED checker, controlled failure, and package stdout contract
   - `0730731` — GREEN in-memory checker and package command entry points

## Files Created/Modified

- `scripts/generate-documentation-inventory.mjs` — closed argument parser and explicit-commit JSON/Markdown stdout generator.
- `scripts/check-documentation-inventory.mjs` — repeated-generation determinism, canonical JSON validation, and full Markdown parity checker.
- `scripts/generate-documentation-inventory.test.mjs` — synthetic Git, package-level, privacy, side-effect, and controlled-failure coverage.
- `package.json` — `docs:inventory:json`, `docs:inventory:markdown`, and `docs:inventory:check` scripts without dependency changes.

## Decisions Made

- `HEAD` is accepted only when the caller explicitly supplies it; outputs and receipts always carry the resolved full 40-hex commit SHA.
- Successful generation has empty stderr and one complete stdout representation. Rejection produces no partial stdout and only bounded redacted diagnostics.
- The checker performs four independent commit-tree compilations and compares outputs in memory; it does not create temporary files, modify the Git index, or publish inventory artifacts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Removed Git-index mtime from the zero-write snapshot identity**
- **Found during:** Task 1 (stdout CLI GREEN verification)
- **Issue:** The test's own `git status` read refreshed the index mtime while leaving its bytes, mode, entries, and staged state identical, creating a false mutation failure.
- **Fix:** Kept byte digest, mode, and exact porcelain state as the Git-index invariants while continuing to compare every worktree file's bytes, mode, and mtime.
- **Files modified:** `scripts/generate-documentation-inventory.test.mjs`
- **Verification:** Task 1 passes 10/10 combined compiler/CLI tests; aggregate repository verification passes 1890/1890.
- **Committed in:** `fe771aa`

---

**Total deviations:** 1 auto-fixed (1 test bug).
**Impact on plan:** The correction removed a harness-created false positive without weakening source-file, Git-index-entry, mode, content, or status preservation checks.

## Issues Encountered

None.

## Verification Evidence

- Committed-head explicit-revision checker passes for `07307316771876f8e5a96791dfd4b3d24e4c58ae`, inventory digest `sha256:ce08a18a7ed684b539ac00d0a4917ae075f80872cb6740372d4609295152407d`, and 528 entries.
- Focused source/compiler/CLI/checker suite passes 13/13, including controlled nondeterminism and parity failures.
- Complete `npm test` passes 1890/1890 and discovers the new script tests through the existing aggregate glob.
- Repeated package-level Markdown hashes match; complete package JSON stdout parses directly with `JSON.parse`.
- `git diff --check` passes; no dependency or lockfile changes, deletions, committed inventory readbacks, or generated residue exist.

## Known Stubs

None.

## Threat Flags

None. The new file-access surface is the plan-declared read-only Git commit-tree boundary; no network, authentication, schema, runtime, provider, or external-state surface was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for `06-03-PLAN.md` to connect the committed lifecycle map and navigation indexes to these on-demand commands.
- Normal GSD STATE, ROADMAP, REQUIREMENTS, and session synchronization remains owned by the phase orchestrator.

## Self-Check: PASSED

- All three created files and the modified package manifest exist.
- Commits `f16bcf6`, `fe771aa`, `ba7fb60`, and `0730731` resolve in Git history.
- All task, plan, aggregate, zero-write, no-deletion, no-lockfile, and no-committed-readback gates pass.

---
*Phase: 06-documentation-stewardship*
*Completed: 2026-08-20*
