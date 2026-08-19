---
phase: 05-ralph-and-temperance-flow-projection
reviewed: 2026-08-19T08:48:05Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - ISA.md
  - .project/HANDOFF.md
  - docs/architecture/contracts/temperance-flow-v1.md
  - docs/architecture/temperance-flow.v1.json
  - docs/architecture/temperance-flow.md
  - docs/runbooks/ralph-temperance-iteration.md
  - scripts/generate-temperance-flow.mjs
  - scripts/generate-temperance-flow.test.mjs
  - scripts/infinite-game-anchors.test.mjs
  - scripts/ralph-iteration.mjs
  - scripts/ralph-iteration.test.mjs
  - scripts/run-ralph-iteration.mjs
  - scripts/run-ralph-iteration.test.mjs
  - scripts/temperance-flow.mjs
  - scripts/temperance-flow-sources.mjs
  - scripts/temperance-flow.test.mjs
  - workers/quests/src/goal-graph/projection-contract.ts
  - workers/quests/src/goal-graph/projection-contract.test.ts
findings:
  critical: 6
  warning: 4
  info: 0
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-19T08:48:05Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The focused Phase 5 suites pass (54/54 across the five JavaScript suites and the Goal Graph projection-contract suite), but the passing tests omit several authority and crash-recovery paths. The bounded runner has no usable production execution path, exposes its verifier/executor injection as a public option, trusts unsigned recovery markers before approval, can repeat an irreversible effect if the first persistence write fails, omits the Intent Graph from its drift snapshot, and changes the approved route after projection. The source adapter also cannot faithfully advance one plan task at a time.

## Critical Issues

### CR-01 [BLOCKER]: The only executable runner path is a caller-controlled test bypass

**File:** `scripts/run-ralph-iteration.mjs:15-18,198-218`

**Issue:** `testAdapters` is part of the public `runRalphIteration` option allowlist. A caller can provide `manifestVerifier`, `approvalVerifier`, `executor`, and `verification` functions and thereby manufacture both fixed-boundary results and the external effects. Conversely, callers that do not provide `testAdapters.executor` and `testAdapters.verification` always reach line 211 and throw after fixed verification, because no production executor or verifier is wired anywhere in the repository. Thus the documented production runner is unusable without taking the exact path that bypasses its trust boundary.

**Fix:** Remove `testAdapters` from the exported production options. Wire production executor and declared-verification integrations inside a production entry point, and construct the runner through a non-exported or test-only dependency factory for tests. Add a test proving the public production API rejects every injected verifier/executor field and can complete through only the fixed integrations.

### CR-02 [BLOCKER]: Recovery trusts a forgeable summary comment before any approval check

**File:** `scripts/run-ralph-iteration.mjs:64-69,175-189`

**Issue:** `findRecord` parses the last repository-controlled HTML comment as trusted JSON. Recovery checks only that its `iterationDigest` equals the current action and that `resultDigest` matches the SHA-256 text pattern; it never recomputes the result digest, validates `prior.outcome`, checks the record schema, binds task/command/route/projection/source-set fields, or authenticates the stored host and owner receipts. This branch runs before `fixedVerify`. A crafted summary marker can therefore skip host verification, approval, execution, and declared verification, propagate forged data into STATE/handoff, and return an arbitrary `prior.outcome`.

**Fix:** Define and strictly validate a closed recovery-record schema. Recompute and compare every canonical digest, call `validateRalphIteration(prior.outcome)`, require exact equality with the newly derived action fields and preimages, and verify a durable host-signed recovery/approval receipt before entering recovery. Reject multiple, malformed, wrong-surface, or partially matching markers. Add tampering tests for every record field and for a marker containing only matching iteration/result-shaped strings.

### CR-03 [BLOCKER]: A crash before the first summary marker repeats the external effect

**File:** `scripts/run-ralph-iteration.mjs:212-245`

**Issue:** Execution and verification happen before any durable idempotency/recovery record exists. If `summaryAdapter`, `atomicWrite`, disk I/O, or the process fails before the summary rename completes, the next invocation finds no `prior` marker and executes and verifies the same unit again. Existing tests cover only state and handoff interruptions after the summary has already persisted; there is no summary-write interruption test. This violates the claimed no-double-effect guarantee and risks duplicate external mutations.

**Fix:** Make the external executor accept `iterationDigest` as an enforced idempotency key and return a durable, queryable execution receipt. On retry, resolve that receipt before deciding to execute. Persist a validated pre-effect intent on an existing governed surface if needed, then recover by receipt rather than by absence of the summary marker. Add crash tests before/during the summary adapter and atomic rename, and assert the executor/verification counts remain one.

### CR-04 [BLOCKER]: The pre-effect drift snapshot omits a declared projection source

**File:** `scripts/run-ralph-iteration.mjs:48-53,173-174`

**Issue:** `allProjectionPaths` includes ISA, GSD, plan, supporting, task, gate, and stop paths but omits `flow.references.intentGraph`. The runner therefore approves and executes against a snapshot that does not cover one of the projection's declared sources. The Intent Graph can change after projection/approval without the immediate pre-execution reread detecting drift, contradicting the runbook's “complete snapshot” requirement.

**Fix:** Include `flow.references.intentGraph` in `allProjectionPaths`, validate every collected path against the projection reference, and add a test that mutates the Intent Graph from an approval/verifier callback and proves execution does not run.

### CR-05 [BLOCKER]: The runner changes the route after the projection digest was fixed

**File:** `scripts/run-ralph-iteration.mjs:191-218`

**Issue:** The approved `expected.route` is built by replacing `action.route.receiptRef` with caller-supplied `options.receiptReference`. Host and owner results are checked against that modified route, but the pure reducer is then given an approval object containing the original `action.route` and only reuses the binding digest from the modified route. The code therefore relabels an approval for route A as approval for route B, despite the contract requiring exact task/command/route/projection binding.

**Fix:** Never mutate route intent after projection. Require `options.receiptReference === action.route.receiptRef` and verify exactly `action.route`; if the reference must be supplied later, regenerate and reapprove a new projection containing it. Preserve the verified route object through the reducer and add mismatch tests where only `receiptRef` differs.

### CR-06 [BLOCKER]: “One selected task” dispatches a phase-wide command and cannot advance to task two

**File:** `scripts/temperance-flow-sources.mjs:293-325,348-349`

**Issue:** For every incomplete plan, only task 1 can become `ready`; later tasks depend on `record.complete`, which is true only once the plan-level summary exists. The adapter then discards every task except `${active.identity}:1`. Yet the selected task's command is `/gsd:execute-phase 5`, a phase-wide operation rather than a task-scoped command. The projection can claim it selected exactly Task 1 while the executor runs the whole phase, and it has no durable state capable of selecting Task 2 or Task 3 on the next bounded iteration. This breaks the core one-unit safety invariant in both directions.

**Fix:** Choose one consistent unit. Either model the selected unit as the whole phase/plan and remove task-level claims, or introduce authoritative per-task completion evidence plus a task-scoped executable command. Add an integration fixture with three incomplete tasks that proves successive durable invocations select 1, then 2, then 3 and never execute more than the selected unit.

## Warnings

### WR-01 [WARNING]: Projection validation accepts malformed dependency and reason entries

**File:** `scripts/temperance-flow.mjs:530-548`

**Issue:** The validator checks only that `result.task.dependencies` and each blocked reason's `sources` are arrays. It does not validate dependency item keys, IDs, statuses, uniqueness, reason-source types, source-reference grammar, bounds, or redaction. A recomputed flow digest makes arbitrary nested values pass `validateTemperanceFlowProjection`, so the public validator does not enforce the closed contract that the compiler enforces.

**Fix:** Reuse closed item validators for every dependency and reason source, enforce the same status/ID/path/redaction rules as compilation, bound array sizes and strings, and add hand-built malformed projection tests rather than testing compiler output only.

### WR-02 [WARNING]: Ralph action validation does not validate its content-addressed identity

**File:** `scripts/ralph-iteration.mjs:57-75`

**Issue:** For `status: action`, `validateRalphIteration` accepts any syntactically valid SHA-256 `iterationDigest` without recomputing it from projection/source/task/command/route facts. It also accepts extra fields and does not validate the task, route, receipt/approval gates, verification gates, or persistence surface vocabulary. Mutated serialized actions can therefore be reported as valid.

**Fix:** Define a closed action schema, validate all nested fields and fixed persistence/stop values, and recompute `iterationDigest` from the canonical identity tuple before returning. Add mutation tests for command, route, task, gates, extra keys, and digest mismatch.

### WR-03 [WARNING]: Readiness decisions depend on bytes not represented by their source references

**File:** `scripts/temperance-flow-sources.mjs:247-260,262-283,341-346`

**Issue:** `isaApproved` scans acceptance/decision text while the ISA authority reference digests only `frontmatter.task`; `stateLive` scans the whole STATE phase while its reference digests only `Operator Next Step`; `handoffReviewed` reads the first heading while the exported supporting references point to three older planning-checkpoint list items; and plan completion depends on summary-file existence. The projection's source references therefore do not identify the evidence bytes that actually determine fresh/stale/active/complete decisions, making provenance diagnostics incomplete and allowing unrelated historical evidence to be presented as the basis for current readiness.

**Fix:** Create selectors for every decision-bearing value (approval state, current phase, reviewed checkpoint, and completion evidence), include those references in `sourceSetDigest`, and make all status derivation consume only the selected bytes. Add tests that mutate each decision-bearing line and require a named source-digest change.

### WR-04 [WARNING]: Generator publication can leave JSON and Markdown at different revisions

**File:** `scripts/generate-temperance-flow.mjs:179-182`

**Issue:** Write mode atomically replaces the JSON and Markdown files independently. If the second write fails, the first remains published, leaving the two promised digest-identical readbacks at different revisions until a later repair. The current tests cover deterministic success but not second-output failure.

**Fix:** Stage both outputs first, validate both staged files, then publish with a recoverable two-file transaction/rollback strategy, or generate one canonical artifact and derive the other during publication. Add a forced second-rename failure test that proves the prior pair remains intact.

---

_Reviewed: 2026-08-19T08:48:05Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
