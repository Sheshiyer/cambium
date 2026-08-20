---
phase: 06-documentation-stewardship
reviewed: 2026-08-20T13:18:46Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - .project/HANDOFF.md
  - ISA.md
  - PROJECT.md
  - README.md
  - docs/LIFECYCLE.md
  - docs/README.md
  - docs/architecture/contracts/documentation-inventory-v1.md
  - docs/doctrine/README.md
  - package.json
  - scripts/check-documentation-inventory.mjs
  - scripts/documentation-inventory-sources.mjs
  - scripts/documentation-inventory.test.mjs
  - scripts/documentation-inventory.mjs
  - scripts/generate-documentation-inventory.mjs
  - scripts/generate-documentation-inventory.test.mjs
  - scripts/generate-temperance-flow.test.mjs
  - scripts/infinite-game-anchors.test.mjs
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-20T13:18:46Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The explicit Phase 6 corpus was reviewed for immutable commit selection, exhaustive inventory semantics, cross-format parity, zero-write behavior, lifecycle authority, historical Phase 5 compatibility, and privacy-gate reliability. The focused suites pass 43/43, but the implementation still has two ship-blocking trust gaps: Git replacement refs can substitute a different tree beneath the reported commit SHA, and the phase privacy sentinel has multiple false-negative paths. Three additional lifecycle/validation weaknesses should also be corrected.

## Critical Issues

### CR-01: Git replacement refs defeat the immutable explicit-commit guarantee

**Classification:** BLOCKER

**File:** `scripts/documentation-inventory-sources.mjs:39-50,114-130`

**Issue:** `runGit` invokes ordinary Git object resolution. Git therefore honors `refs/replace/*` while `rev-parse`, `ls-tree`, and `show` run. A repository can report the caller's original 40-hex commit as `sourceRevision` while enumerating and hashing the replacement commit's tree. This was reproduced in an isolated repository: the adapter returned the requested original SHA but emitted the replacement README digest. Changing the replace ref between calls can also make one compilation mix facts from different trees. The output is consequently not an immutable projection of the reported commit.

**Fix:** Disable replacement-object resolution for every Git call and add a regression fixture that replaces the selected commit but still expects the original tree bytes. For example:

```js
const result = spawnSync('/usr/bin/git', [
  '--no-replace-objects',
  '--no-optional-locks',
  '-C', root,
  ...args,
], {
  env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
  // existing stdio/encoding options
});
```

### CR-02: T-06-22 can certify Phase 6 while sensitive additions evade its scan

**Classification:** BLOCKER

**File:** `scripts/infinite-game-anchors.test.mjs:120-176`

**Issue:** The privacy gate has several independent false-negative paths. The scanner omits PEM private-key markers and raw private temporary checkout paths; its assignment regex misses normal quoted JSON token keys; and a matching synthetic-fixture rule skips the entire line, so unrelated sensitive text appended to that line is exempt too. In addition, the NUL `--name-status` parser consumes only one path for every status. A copy record has two paths, so copy detection can desynchronize the parser and omit the copied destination from the whole-file scan. Because the corresponding content diff is not forced to `--no-renames`, an exact copy may also have no added lines. T-06-22 can therefore pass despite committed sensitive bytes.

**Fix:** Use a single fail-closed scanner for complete changed blobs, remove whole-line exemptions, and make fixture exemptions exact to a known literal or file digest. Include PEM markers, quoted JSON/YAML keys, and all prohibited local path roots. Force path enumeration and content diffs to disable rename/copy collapsing, for example:

```js
git('diff', '--name-only', '-z', '--no-renames', `${baseSha}...HEAD`);
git('diff', '--unified=0', '--no-ext-diff', '--no-renames', `${baseSha}...HEAD`);
```

Add adversarial tests for a private-key header, a quoted token key, a private temporary checkout path, sensitive text sharing a synthetic-fixture line, and a config-enabled exact copy.

## Warnings

### WR-01: Filename suffixes silently override historical directory defaults

**Classification:** WARNING

**File:** `scripts/documentation-inventory.mjs:105-116`

**Issue:** `lifecycleFor` promotes every path ending in `SUMMARY.md`, `REVIEW.md`, or `VERIFICATION.md` to `evidentiary` before it applies the historical defaults for `docs/plans/` and `.planning/phases/`. The current output consequently promotes dozens of phase files with `exception: null`. A lookalike file can self-promote solely by its filename, contrary to the contract that historical directory defaults yield only to explicit source-backed item evidence.

**Fix:** Apply historical directory defaults before generic filename heuristics. If selected summaries or verification reports are intended evidence, define a documented source-backed exception class and emit its evidence pointer instead of promoting every matching basename.

### WR-02: The exported validator accepts semantically incoherent inventory entries

**Classification:** WARNING

**File:** `scripts/documentation-inventory.mjs:234-285`

**Issue:** `validateDocumentationInventory` checks field shape, vocabulary membership, and self-computed digests, but it does not bind lifecycle, purpose, overlap, anchors, disposition, or exception semantics to the entry path. It also permits the product-branch exception on a path outside `docs/plans/product-branches/`. A forged or corrupted object can therefore classify `VISION.md` as historical, attach an indexed-packet exception to an unrelated file, or pair a lifecycle with the wrong retain disposition and still validate after recomputing the unhashed authenticity-free digest.

**Fix:** Recompute and compare every deterministic entry fact during validation. At minimum, require the exact disposition for the lifecycle; exact `purposeFor`, `anchorsFor`, and `overlapFor` results; and constrain the indexed-packet exception to the product-branch directory and declared evidence path. Add tamper tests for each cross-field mismatch.

### WR-03: Lifecycle tests admit contradictory Active/Completed phase headings

**Classification:** WARNING

**File:** `scripts/infinite-game-anchors.test.mjs:202-248,357-366`

**Affected file:** `scripts/generate-temperance-flow.test.mjs:133-141`

**Issue:** Phase-state coherence is calculated without the Phase 6 acceptance heading, while the heading test accepts either `Active` or `Completed` independently. Thus `Completed Phase 6 acceptance` can pass at plan/execute 0/4 and `Active Phase 6 acceptance` can pass at verify 4/4. The historical-compatibility test also positively requires an `Active Phase 5 acceptance` heading to remain accepted after Phase 6 owns the lifecycle. These tests can preserve two contradictory active phase declarations instead of detecting stale authority labels.

**Fix:** Parse the unique acceptance heading as part of the state machine: `Active` may accompany only plan/execute prefix states, and `Completed` only verify with all criteria checked. Once a Phase 6 acceptance section exists, require Phase 5 evidence to use `Completed`, while retaining an isolated fixture for genuinely pre-Phase-6 Active Phase 5 snapshots.

---

_Reviewed: 2026-08-20T13:18:46Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
