---
phase: 3
slug: canonical-infinite-game-anchors
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for two dependency-ordered plans: `03-01 → 03-02`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` on the repository-supported Node runtime |
| **Config file** | None; root `package.json` already includes `scripts/*.test.mjs` in `npm test` |
| **Quick run command** | `node --test scripts/infinite-game-anchors.test.mjs` |
| **Full suite command** | `npm test && npm run drift:audit && npm run render-docs:check` |
| **Estimated runtime** | Quick under 5 seconds; full feedback under 60 seconds |

---

## Sampling Rate

- **After 03-01 Task 1 RED commit:** Preserve expected failing TAP output and reject syntax, module-resolution, and uncaught missing-file failures.
- **Before 03-01 Task 2 commit:** Rerun focused root/ISA tests plus deterministic ISA readback after setting `progress: 2/4` and evidence.
- **During 03-02 Task 1 before ISA closure:** Run focused tests and the full suite while ISA remains at `progress: 2/4`.
- **Before the 03-02 Task 1 commit:** Rerun the entire focused contract plus deterministic ISA readback after setting `phase: verify`, `progress: 4/4`, and evidence.
- **After the single 03-02 Task 1 commit:** Run commit-range patch, forbidden-path, non-destructive, sensitive-material, and three-commit boundary verification.
- **Before `$gsd-verify-work 3`:** Every row below and the post-commit range gate must be green.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01a | 01 | 0 / RED | ANCHOR-01 | T-03-01 / T-03-02 | Missing/non-canonical Vision fails semantically, not through an uncaught read | contract RED | `node --test scripts/infinite-game-anchors.test.mjs` (expected non-zero) | ❌ W0 | ⬜ pending |
| 03-01-01b | 01 | 0 / RED | ANCHOR-02 | T-03-01 / T-03-02 | Missing renewable Mission lifecycle fails semantically | contract RED | `node --test scripts/infinite-game-anchors.test.mjs` (expected non-zero) | ❌ W0 | ⬜ pending |
| 03-01-01c | 01 | 0 / RED | ANCHOR-03 | T-03-03 | Repository Mission / FabricMission ambiguity fails semantically | contract RED | `node --test scripts/infinite-game-anchors.test.mjs` (expected non-zero) | ❌ W0 | ⬜ pending |
| 03-01-01d | 01 | 0 / RED | ANCHOR-04 | T-03-01 / T-03-04 | Missing/copied provenance fails semantically | contract RED | `node --test scripts/infinite-game-anchors.test.mjs` (expected non-zero) | ❌ W0 | ⬜ pending |
| 03-01-02a | 01 | 1 | ANCHOR-01 | T-03-01 / T-03-02 / T-03-05 | Vision is singular, non-finite, review-gated doctrine | contract GREEN + ISA readback | `node --test --test-name-pattern='canonical root anchors|ISA binds' scripts/infinite-game-anchors.test.mjs` | ❌ W0 | ⬜ pending |
| 03-01-02b | 01 | 1 | ANCHOR-02 | T-03-01 / T-03-02 / T-03-05 | Mission exposes event horizon, evidence, renewal, and retirement/replacement | contract GREEN + ISA readback | Same focused command plus Plan 03-01 deterministic ISA assertion | ❌ W0 | ⬜ pending |
| 03-01-02c | 01 | 1 | ANCHOR-04 | T-03-01 / T-03-02 | Exact goal, stable ISCs, Test Strategy, Feature, and root references preserve authority | contract GREEN + ISA readback | Plan 03-01 Task 2 `<verify>` | ❌ W0 | ⬜ pending |
| 03-02-01a | 02 | 2 | ANCHOR-03 | T-03-03 | Both Mission Fabric docs preserve D1 ownership, read-only projection, and frozen runtime shapes | integration/full | `node --test scripts/infinite-game-anchors.test.mjs && npm test` | ❌ W0 | ⬜ pending |
| 03-02-01b | 02 | 2 | ANCHOR-04 | T-03-01 / T-03-04 | Indexes/lifecycle link without copied doctrine; docs remain renderable and drift-safe | integration/docs | `npm run drift:audit && npm run render-docs:check` | ❌ W0 | ⬜ pending |
| 03-02-01c | 02 | 2 | ANCHOR-03 | T-03-03 / T-03-05 | ISA closes ISC-1275 only after full evidence, rerun, and deterministic readback | ISA state readback | Plan 03-02 Task 1 `<verify>` | ❌ W0 | ⬜ pending |
| 03-02-01d | 02 | 2 | ANCHOR-04 | T-03-01 / T-03-04 / T-03-05 | ISA closes ISC-1276 only after full evidence; committed range contains no forbidden material | ISA + commit-range | Plan 03-02 Task 1 `<verify>` and `<post_commit_verify>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/infinite-game-anchors.test.mjs` — create four semantic tests covering ANCHOR-01 through ANCHOR-04 and ISC-1273 through ISC-1276.
- [ ] RED proof — required semantic failure while rejecting `SyntaxError`, `ERR_MODULE_NOT_FOUND`, `ENOENT`, and top-level missing-file errors.
- [x] Exact ISA goal input — supplied verbatim in both plans and resolved research; never infer or paraphrase it.
- [x] Test framework — existing Node built-ins and root test glob require no installation or manifest change.

---

## Manual-Only Verifications

All Phase 3 behaviors have automated semantic, regression, documentation, deterministic ISA readback, commit-range, and sensitive-material probes. Normal PR review remains a release boundary, not a substitute for these checks.

---

## Validation Sign-Off

- [x] Every task has automated verification; Wave 0 belongs to 03-01 Task 1.
- [x] Sampling continuity covers both commits in 03-01 and the atomic commit in 03-02.
- [x] ISA evidence/status edits are followed by focused and deterministic readback before each commit.
- [x] Final scope/privacy proof reads committed merge-base→HEAD state, never an uncommitted diff.
- [x] No watch-mode flags are used.
- [x] Feedback latency is bounded below 60 seconds.
- [x] `nyquist_compliant: true` is set in frontmatter.

**Approval:** pending plan-checker revalidation and execution
