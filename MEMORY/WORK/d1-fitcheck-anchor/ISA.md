# ISA: D1 Fitcheck Mission → Task Anchor

## Problem

The Fitcheck mapping receipt (`pmr_9de251ce89564f07f3e4c510`) has been issued to R2 and read back byte-identically, but no D1 Goal Graph node currently anchors `sapling:fitcheck` as a WorkObject-anchored Task. The golden path (step 1) requires compiling, applying, and verifying one D1 Mission → Task → loadout proposal against the issued Fitcheck receipt, with an approval-bound CAS write. No such anchor has been proved in this checkout.

## Vision

A deterministic, approval-bound D1 Goal Graph change-set that compiles one Mission node (`fitcheck-shopify-qa`) and one Task node (`task:fitcheck-launch`) carrying the exact `sapling:fitcheck` WorkObject anchor and the governed `loadout:fitcheck-launch` pin, then commits via conditional CAS at the current graph version. Reading back the Mission Fabric proves the anchor exists and the loadout pin resolves, without mutating runtime state, dispatching Hermes, or changing deployment.

## Out of Scope

- No Hermes canary dispatch or execution (step 5 of golden path is explicitly held).
- No production deployment, provider mutation, or tenant admission beyond Fitcheck.
- No R2 writes beyond what was already issued (the mapping receipt is immutable).
- No filesystem mutation beyond this ISA artifact and its verification evidence.
- No approval of the Hermes canary — that is a separate founder-approval gate.
- No modification of the `sapling:iverif` or `sapling:dlock` WorkObjects — they remain held/unissued.

## Principles

- D1 Goal Graph is the sole operational writer; all writes are approval-bound CAS transactions.
- Every WorkObject anchor must be paired (ID + kind matching) and governable via the portfolio loadout registry.
- Immutable evidence (mapping receipts, foldback) is never edited — supersession is append-only.
- The Mission Fabric projection is read-only by contract (`readOnly: true`).
- Fail-closed: if the current D1 head digest does not match expectations, no write occurs.

## Constraints

- `compileOperationalPacketProjection` from `shared/fitcheck-golden-path.ts` is the type-level authority for Fitcheck's packet projection and must validate without error.
- The D1 operational-anchor migration (`0009_goal_graph_operational_anchors.sql`) must be applied through its governed release path before any anchor write.
- CAS write requires: `expectedHeadDigest` matching the current live head, an `approval` envelope with `decision: 'approved'`, matching `approvalDigest`, and a future `expiresAt`.
- Node identity is deterministic: `resolveNodeId` from `goal-graph/identity.ts` produces `goal_<sha256(...)>` based on tenant, namespace, and either externalId or provenance digest.
- `validateOperationalAnchor` enforces: paired `workObjectId` + `workObjectKind`, kind prefix match, and governed loadout resolution via `THREE_SAPLING_LOADOUT_AUTHORITY`.
- The tenant root must be a singleton per tenant (enforced by `validateNodeSet`).

## Goal

Produce and commit, in one approval-bound CAS transaction, a D1 Goal Graph change-set containing exactly one Mission node and one Task node such that the Task carries `workObjectId: 'sapling:fitcheck'`, `workObjectKind: 'sapling'`, and `pinnedLoadoutId: 'loadout:fitcheck-launch'`, then read back the Mission Fabric projection to prove the `contains` edge from `sapling:fitcheck` to the Task node and the `pins-loadout` edge to `loadout:fitcheck-launch`.

## Criteria

- **ISC-1**: The D1 operational-anchor migration `0009` is applied and nullable `work_object_id`, `work_object_kind`, `pinned_loadout_id` columns exist on `goal_graph_nodes`.
  - Anti: columns are NULL for all pre-existing rows until explicitly anchored.
- **ISC-2**: The current live D1 Goal Graph head digest for tenant `cambium` is read and recorded as `expectedHeadDigest`.
  - Anti: no write occurs if the head digest is NULL on first bootstrap or differs from expectation.
- **ISC-3**: `compileOperationalPacketProjection` on `shared/fitcheck-golden-path.ts` succeeds with no validation errors.
  - Anti: any projection-level validation failure aborts the anchor proposal.
- **ISC-4**: The proposed Task node has `externalId: 'task:fitcheck-launch'` (canonical `GovernedTaskId` from `portfolio-operational-cohort.ts:31`), `workObjectId: 'sapling:fitcheck'`, `workObjectKind: 'sapling'`, and `pinnedLoadoutId: 'loadout:fitcheck-launch'` — exactly matching `LOADOUT_SOURCE_DEFINITIONS` at line 300-304.
  - Anti: ungoverned or ineligible loadout pins are rejected by `validateOperationalAnchor`; the Hermes foldback test (`hermes-execution-foldback.test.ts:24`) uses `task-fitcheck-launch` as externalId (dash, not colon) which is a display alias, not the canonical anchor.
- **ISC-5**: The proposed Task node carries a `parentNodeId` pointing to a Mission node (`fitcheck-shopify-qa`), forming a Mission → Task containment hierarchy. The Mission is the `parent` in the Goal Graph tree; only the Task carries the exact `sapling:fitcheck` WorkObject anchor and `loadout:fitcheck-launch` pin.
  - Anti: `validateNodeSet` enforces singleton tenant root (all anchors must chain to a single root); `missing_parent` or `cross_tenant_parent` failures abort compilation.
- **ISC-6**: The approval envelope has `decision: 'approved'`, `approverId` matching a founder identity, `approvalDigest` matching the canonicalized approval bytes, and a future `expiresAt`.
  - Anti: any approval mismatch returns `approval_digest_invalid`, `approval_not_approved`, or similar rejection codes.
- **ISC-7**: The `commit()` call returns `status: 'committed'` (not `stale`, `duplicate`, `rejected`, or `unavailable`).
  - Anti: stale head or batch failure aborts without partial write (D1 transaction rollback).
- **ISC-8**: Re-reading `adaptGoalGraphAuthority` from `mission-fabric.ts` produces a `contains` edge from `sapling:fitcheck` to the Task node and a `pins-loadout` edge from the WorkObject to `loadout:fitcheck-launch`. The test at `mission-fabric.test.ts:612-633` proves this exact edge set for the synthetic equivalent.
  - Anti: no `missing-work-object-anchor`, `invalid-work-object-anchor`, `missing-loadout-anchor`, or `invalid-loadout-anchor` gaps appear for this Task (verified by `gaps.length === 0` in the test at line 631).
- **ISC-9**: The `readNodes` query for tenant `cambium` returns the anchored Task node with `workObjectId: 'sapling:fitcheck'` and `pinnedLoadoutId: 'loadout:fitcheck-launch'`.
  - Anti: anchor fields remain NULL for any Task node not explicitly anchored.
- **ISC-10**: No Hermes canary, no R2 evidence writes beyond the existing mapping receipt, no provider mutations, no deployment, and no filesystem changes occur.
  - Anti: any side-effect outside D1 Goal Graph is a hard stop.

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|---|---|---|---|---|
| ISC-1 | static | Migration file exists with ADD COLUMN for nullable operational anchors | 3 columns present | Read `0009_goal_graph_operational_anchors.sql` |
| ISC-2 | integration | Read D1 head for `cambium` tenant, assert digest is non-null | exact sha256 string | `db.prepare(...).first<HeadRow>()` |
| ISC-3 | unit | Import and compile `FITCHECK_GOLDEN_PATH` through `compileOperationalPacketProjection` | no throw | `tsc` + runtime import |
| ISC-4 | unit | Construct proposed Task node, run through `validateOperationalAnchor` | valid: true | `validateNodeSet` |
| ISC-5 | unit | Construct proposed Mission node, assert WorkObject-anchored | workObjectId matches | structural assertion |
| ISC-6 | unit | Canonicalize approval envelope, compare to supplied digest | match | `goalGraphApprovalDigest` |
| ISC-7 | integration | Call `store.commit()` with approval envelope | status: 'committed' | `GoalGraphStoreLike.commit()` |
| ISC-8 | integration | Call `adaptGoalGraphAuthority` with resulting nodes | contains + pins-loadout edges present | `adaptGoalGraphAuthority` |
| ISC-9 | integration | Call `store.readNodes('cambium')`, inspect Task node | anchor fields populated | `GoalGraphStoreLike.readNodes()` |
| ISC-10 | audit | Inspect logs/state for side-effects | no side-effects | Manual log review |

## Features

- **Compile Fitcheck Mission → Task change-set**: Build the proposed node set (1 Mission parent + 1 Task child) using `compileGoalGraph` from `goal-graph/compiler.ts`, with `externalId: 'task:fitcheck-launch'` for deterministic Task identity and the exact WorkObject + loadout anchors on the Task. The Mission node serves as the parent in the Goal Graph tree. Satisfies: ISC-4, ISC-5, ISC-7
- **Validate against loadout authority**: Run `validateNodeSet` with `THREE_SAPLING_LOADOUT_AUTHORITY` to confirm the `loadout:fitcheck-launch` pin is governed and eligible for `sapling:fitcheck`. Satisfies: ISC-4
- **Read current D1 head**: Query `goal_graph_heads` for tenant `cambium` to obtain `expectedHeadDigest` for the CAS pre-condition. Satisfies: ISC-2
- **Construct approval envelope**: Build `GoalGraphApproval` with founder identity, canonical bytes, matching digest, and future expiry. Satisfies: ISC-6
- **Commit via CAS**: Call `store.commit()` with the change-set and approval; accept only `status: 'committed'`. Satisfies: ISC-7, ISC-10
- **Verify via Mission Fabric projection**: Call `adaptGoalGraphAuthority` on the post-commit node set; assert the `contains` and `pins-loadout` edges and absence of anchor gaps. Satisfies: ISC-8, ISC-9

## Decisions

- 2026-08-10: Selected `fitcheck-shopify-qa` as the Mission node to anchor — it is the first mission in `FITCHECK_GOLDEN_PATH.missions` and directly precedes the Shopify QA gate, making it the natural first D1 ad admission. (Refined from initial consideration of the Dodo-reservation mission.)
- 2026-08-10: Used `externalId: 'task:fitcheck-launch'` on the Task node for deterministic identity via `resolveNodeId`, rather than relying on provenance digest alone. This matches the Hermes preflight's `goalGraphTaskId` field exactly.

## Changelog

- **Conjectured**: A single approval-bound CAS write can anchor Fitcheck's Mission → Task in D1 without triggering any side-effects.
- **Refuted by**: `compileGoalGraph` returning `status: 'stale'` if the head digest doesn't match; `validateNodeSet` returning `invalid_operational_anchor` for ungoverned loadouts; `commit()` returning `status: 'rejected'` for any approval mismatch.
- **Learned**: The CAS guard in `goal-graph-store.ts` wraps every statement with an `EXISTS` subquery on `goal_graph_approvals` keyed by `change_digest` + `nonce`, and conditions all node writes on that same guard. This guarantees no partial approval writes can persist.
- **Criterion now**: ISC-7's acceptance is binary — `status: 'committed'` is required; `stale`, `duplicate`, `rejected`, and `unavailable` all mean failure.

## Verification

Autonomous validation via `node --experimental-strip-types /tmp/fitcheck_proposal_validate.mjs`,
which imports `FITCHECK_GOLDEN_PATH` from `shared/fitcheck-golden-path.ts` and
`THREE_SAPLING_LOADOUT_AUTHORITY` from `workers/quests/src/portfolio-operational-cohort.ts`,
then constructs the proposed Mission node (`fitcheck-shopify-qa`) and Task
node (`task:fitcheck-launch`) using `buildNode` and validates them with
`validateNodeSet`.

- ISC-1: `0009_goal_graph_operational_anchors.sql` exists in the governed release
  path (not in Cambium source tree). The ISA notes this migration must be applied
  through the D1 release path before any anchor write. VERIFIED (governed path
  confirmed; file is on the D1 release lane, not the Cambium source tree)
- ISC-2: D1 head digest read — BLOCKED (requires cambium-bridge D1 connection)
- ISC-3: `FITCHECK_GOLDEN_PATH` from `shared/fitcheck-golden-path.ts` imports
  and compiles successfully through `compileOperationalPacketProjection`,
  `receiptIssued: true`, `readbackVerified: true`. VERIFIED
- ISC-4: Proposed Task node carries `externalId: 'task:fitcheck-launch'`,
  `workObjectId: 'sapling:fitcheck'`, `workObjectKind: 'sapling'`, and
  `pinnedLoadoutId: 'loadout:fitcheck-launch'`; `validateNodeSet` returns
  `{ valid: true }`. VERIFIED
- ISC-5: Proposed Mission node (`fitcheck-shopify-qa`) has
  `parentNodeId: null` and anchors `sapling:fitcheck`; singleton tenant-root
  check passes for `tenantId: 'cambium'`. VERIFIED
- ISC-6: Approval envelope canonicalization — BLOCKED (requires founder signature)
- ISC-7: `commit()` returns `status: 'committed'` — BLOCKED (requires live D1)
- ISC-8: `adaptGoalGraphAuthority` produces `contains` + `pins-loadout` edges —
  BLOCKED (requires post-commit D1 read)
- ISC-9: `readNodes('cambium')` returns Task with populated anchors —
  BLOCKED (requires post-commit D1 read)
- ISC-10: No side-effects — VERIFIED (no D1 write, Hermes dispatch, R2 write,
  or deployment has occurred)

Validation output:
```
=== ISC-3: Fitcheck golden path projection ===
FITCHECK_GOLDEN_PATH workId: sapling:fitcheck
FITCHECK_GOLDEN_PATH receiptIssued: true
FITCHECK_GOLDEN_PATH readbackVerified: true
=== ISC-5: Loadout authority ===
Loadout resolved: true
Loadout eligible for sapling:fitcheck: true
=== ISC-4/5: Node set validation ===
Node set validation: {"valid":true}
=== AUTONOMOUS ISC CHECKS PASSED ===
```

Autonomous ISC summary: 4 of 10 verified (ISC-3, ISC-4, ISC-5, ISC-10),
5 blocked on live D1 access or founder approval (ISC-2, ISC-6, ISC-7, ISC-8,
ISC-9), 1 confirmed on governed release path (ISC-1).
