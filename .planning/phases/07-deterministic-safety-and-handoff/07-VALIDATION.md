---
phase: 7
slug: deterministic-safety-and-handoff
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) on Node 26 |
| **Config file** | none — `package.json` `scripts.test` glob includes `scripts/*.test.mjs` |
| **Quick run command** | `node --test scripts/deterministic-safety.test.mjs scripts/check-deterministic-safety.test.mjs scripts/infinite-game-anchors.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds focused; full `npm test` per current CI |

---

## Sampling Rate

- **After every task commit:** Run the focused `node --test` on files that task touched.
- **After every plan wave:** Run the quick run command above.
- **Before `/gsd:verify-work`:** `npm test` plus `npm run --silent safety:check -- --source-revision <committed SHA>` plus complementary `docs:inventory:check`, intent-graph `--check`, temperance-flow `--check`, `drift:audit`, `render-docs:check`, `standalone:audit`, `git diff --check`.
- **Max feedback latency:** 30 seconds for the focused suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SAFE-01 | T-07-01 | Copied VISION/MISSION paragraph fails; dirty tree ignored | unit | `node --test scripts/deterministic-safety.test.mjs --test-name-pattern='SAFE-01'` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | SAFE-02 | T-07-02 | Overlay planner/goal claims fail; ISA.md and STATE.md allowed | unit | `node --test scripts/deterministic-safety.test.mjs --test-name-pattern='SAFE-02'` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | SAFE-03 | T-07-03 | Stale selector digest fails; CF account / Worker UUID not privacy hits | unit | `node --test scripts/deterministic-safety.test.mjs --test-name-pattern='SAFE-03'` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | SAFE-01..03 | T-07-04 | CLI requires `--source-revision`; zero writes; non-zero on hit | integration | `node --test scripts/check-deterministic-safety.test.mjs` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | SAFE-04 | T-07-05 | ISC-1290..1293 and HANDOFF name fixtures, D-15, next command | unit | `node --test --test-name-pattern='SAFE-0|Phase 7' scripts/infinite-game-anchors.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/deterministic-safety.test.mjs` — RED stubs for SAFE-01..03 synthetic Git fixtures
- [ ] `scripts/check-deterministic-safety.test.mjs` — RED stubs for CLI/package/zero-write
- [ ] Extend `scripts/infinite-game-anchors.test.mjs` Phase 6 lifecycle matrix to admit Phase 7 `plan 0/4` then `verify 4/4`
- [ ] Framework install: none — Node 26 already required by CI

Existing infrastructure covers the runner. Wave 0 is failing tests, not a new harness.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reviewed HANDOFF checkpoint names live Worker `089181f6` and D1 digest `846400e1…` without authorizing CAS/upload | SAFE-04 / D-16 | Packet review is human | Read `.project/HANDOFF.md` last checkpoint after execute; confirm D-15 holds remain unresolved |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending until `/gsd:execute-phase 7` Wave 0 turns RED then GREEN
