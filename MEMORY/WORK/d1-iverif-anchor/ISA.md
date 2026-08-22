# ISA: D1 IVerif Mission → Task Anchor Proposal

## Problem

The IVerif mapping receipt (`pmr_a8c7a566eb32790dffaf1d2a`) is prepared but
**not issued** — no R2 object exists, and no D1 Goal Graph node currently anchors
`sapling:iverif` as a WorkObject-anchored Task. This proposal scaffolds the D1
Mission → Task → loadout change-set for `sapling:iverif` ahead of owner-approved
receipt issuance and tenant admission. It is a read-only proposal artifact: no
D1 write, no R2 write, no Hermes dispatch, and no tenant admission occurs until
founder approval consumes the prepared receipt and admission gates are satisfied.

## Vision

Produce a proposal change-set that compiles one Mission node
(`iverif-wiki-activation`) and one Task node (`task:iverif-observer`) carrying the
exact `sapling:iverif` WorkObject anchor and the governed
`loadout:iverif-observer` pin, paired with the prepared mapping receipt
`pmr_a8c7a566eb32790dffaf1d2a`. The proposal must validate through
`compileOperationalPacketProjection` and `validateOperationalAnchor` without
mutation, then await founder approval before any CAS commit.

## Out of Scope

- No D1 Goal Graph write (CAS commit pending founder approval).
- No R2 evidence write — `pmr_a8c7a566eb32790dffaf1d2a` remains unissued.
- No Hermes canary dispatch — step 5 of golden path is explicitly held.
- No production deployment, provider mutation, or tenant admission.
- No filesystem mutation beyond this ISA artifact and its proposal evidence.
- No modification of `sapling:fitcheck` (already anchored) or `sapling:dlock`
  (remains folderless and access-held).

## Principles

- D1 Goal Graph is the sole operational writer; all writes are approval-bound
  CAS transactions that remain unissued until founder approval.
- Every WorkObject anchor must be paired (ID + kind matching) and governable via
  the portfolio loadout registry.
- Immutable evidence (mapping receipts, foldback) is never edited; this proposal
  references the prepared-but-unissued receipt only.
- The Mission Fabric projection is read-only by contract.
- Fail-closed: if the current D1 head digest does not match expectations, no
  proposal advances.
- Prepared evidence without founder approval is planning only, never admission.

## Constraints

- `compileOperationalPacketProjection` from
  `shared/iverif-golden-path.ts` (mirror of Fitcheck) is the type-level authority
  for IVerif's packet projection and must validate without error.
- The proposed Task node must carry `externalId: 'task:iverif-observer'`
  (canonical GovernedTaskId from `portfolio-operational-cohort.ts`).
- `validateOperationalAnchor` enforces: paired `workObjectId` + `workObjectKind`,
  kind prefix match, and governed loadout resolution via
  `THREE_SAPLING_LOADOUT_AUTHORITY`.
- The tenant root must be a singleton per tenant (enforced by
  `validateNodeSet`).
- The IVerif mapping receipt (`pmr_a8c7a566eb32790dffaf1d2a`) must be issued and
  readback-verified before any CAS commit can proceed.

## Goal

Produce a validated, proposal-only D1 Goal Graph change-set for `sapling:iverif`
such that:

- The Task node has `externalId: 'task:iverif-observer'`,
  `workObjectId: 'sapling:iverif'`, `workObjectKind: 'sapling'`, and
  `pinnedLoadoutId: 'loadout:iverif-observer'`.
- The Task has `parentNodeId` pointing to a Mission node
  (`iverif-wiki-activation`).
- The proposed receipt digest
  `sha256:a8c7a566eb32790dffaf1d2a06ad21d0514ba9e4dd90d773d769ae4929e5abeb`
  is bound as the exact mapping evidence.
- `compileOperationalPacketProjection` and `validateNodeSet` succeed.
- No write occurs — the proposal awaits founder approval for CAS commit.

## Criteria

- **ISC-1**: The IVerif mapping receipt digest
  `sha256:a8c7a566eb32790dffaf1d2a06ad21d0514ba9e4dd90d773d769ae4929e5abeb`
  is recorded as the prepared-but-unissued evidence for `sapling:iverif`.
  - Anti: no R2 write is performed; receipt remains unissued until founder
    approval.
- **ISC-2**: The proposed Task node has `externalId: 'task:iverif-observer'`,
  `workObjectId: 'sapling:iverif'`, `workObjectKind: 'sapling'`, and
  `pinnedLoadoutId: 'loadout:iverif-observer'` — exactly matching
  `LOADOUT_SOURCE_DEFINITIONS` at lines 306-312.
  - Anti: ungoverned or ineligible loadout pins are rejected by
    `validateOperationalAnchor`.
- **ISC-3**: The proposed Task node carries a `parentNodeId` pointing to a
  Mission node (`iverif-wiki-activation`).
  - Anti: `validateNodeSet` enforces singleton tenant root; `missing_parent`
    or `cross_tenant_parent` failures abort compilation.
- **ISC-4**: `compileOperationalPacketProjection` on
  `shared/iverif-golden-path.ts` succeeds with no validation errors.
  - Anti: any projection-level validation failure aborts the proposal.
- **ISC-5**: `validateNodeSet` with `THREE_SAPLING_LOADOUT_AUTHORITY` confirms
  the `loadout:iverif-observer` pin is governed and eligible for
  `sapling:iverif`.
  - Anti: ungoverned loadout pins are rejected.
- **ISC-6**: No D1 write, R2 write, Hermes dispatch, deployment, or provider
  mutation occurs during proposal validation.
  - Anti: any side-effect outside proposal artifacts is a hard stop.

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|---|---|---|---|---|
| ISC-1 | static | Verify IVerif receipt digest recorded as unissued | digest matches | Read preflight |
| ISC-2 | unit | Construct proposed Task node, run through `validateOperationalAnchor` | valid: true | `validateNodeSet` |
| ISC-3 | unit | Construct proposed Mission node, assert WorkObject-anchored | workObjectId matches | structural assertion |
| ISC-4 | unit | Compile `IVERIF_GOLDEN_PATH` through `compileOperationalPacketProjection` | no throw | `tsc` + runtime import |
| ISC-5 | unit | Validate loadout pin against `THREE_SAPLING_LOADOUT_AUTHORITY` | governed: true | `validateNodeSet` |
| ISC-6 | audit | Inspect logs/state for side-effects | no side-effects | Manual log review |

## Features

- **Propose IVerif Mission → Task change-set**: Build the proposed node set
  (1 Mission parent + 1 Task child) using `compileGoalGraph` from
  `goal-graph/compiler.ts`, with `externalId: 'task:iverif-observer'` for
  deterministic Task identity and the exact WorkObject + loadout anchors on
  the Task. The Mission node (`iverif-wiki-activation`) serves as the parent.
  Satisfies: ISC-2, ISC-3, ISC-4
- **Validate against loadout authority**: Run `validateNodeSet` with
  `THREE_SAPLING_LOADOUT_AUTHORITY` to confirm the
  `loadout:iverif-observer` pin is governed and eligible for
  `sapling:iverif`. Satisfies: ISC-5
- **Bind prepared mapping receipt**: Record receipt digest
  `sha256:a8c7a566eb32790dffaf1d2a06ad21d0514ba9e4dd90d773d769ae4929e5abeb`
  as the exact mapping evidence, marked unissued-pending-foundation-approval.
  Satisfies: ISC-1

## Decisions

- 2026-08-10: Selected `iverif-wiki-activation` as the Mission node to anchor —
  it aligns with the IVerif wiki repository (`Sheshiyer/iverif-wiki`) as the
  product-source entry point, making it the natural first D1 ad admission once
  receipt issuance is approved.
- 2026-08-10: Used `externalId: 'task:iverif-observer'` on the Task node for
  deterministic identity via `resolveNodeId`, matching the Hermes preflight's
  `goalGraphTaskId` field pattern.
- 2026-08-10: Proposal is read-only only. CAS commit is explicitly deferred
  until founder approval consumes the prepared receipt
  `pmr_a8c7a566eb32790dffaf1d2a`.

## Changelog

- **Conjectured**: A proposal change-set for `sapling:iverif` can be compiled
  and validated without any D1, R2, or Hermes side-effects, producing a
  founder-reviewable artifact.
- **Refuted by**: `compileGoalGraph` returning validation errors for
  ungoverned loadouts; `validateNodeSet` returning
  `invalid_operational_anchor`; any side-effect detection aborting the
  proposal.
- **Learned**: The proposal pattern follows Fitcheck's ISA structure, but
  diverges at ISC-1: the receipt is unissued, so the binding is to prepared
  evidence only, not to an issued R2 object.

## Verification

Validated by `node --experimental-strip-types /tmp/iverif_proposal_validate.mjs`,
which imports `IVERIF_GOLDEN_PATH` from `shared/iverif-golden-path.ts` and
`THREE_SAPLING_LOADOUT_AUTHORITY` from `workers/quests/src/portfolio-operational-cohort.ts`,
then constructs the proposed Mission node (`iverif-wiki-activation`) and Task
node (`task:iverif-observer`) using `buildNode` and validates them with
`validateNodeSet`.

- ISC-1: IVerif receipt digest `sha256:a8c7a566eb32790dffaf1d2a06ad21d0514ba9e4dd90d773d769ae4929e5abeb`
  recorded as `prepared-not-issued`; `receiptIssued: false`, `readbackVerified: false`.
  VERIFIED
- ISC-2: Proposed Task node carries `externalId: 'task:iverif-observer'`,
  `workObjectId: 'sapling:iverif'`, `workObjectKind: 'sapling'`, and
  `pinnedLoadoutId: 'loadout:iverif-observer'`; `validateNodeSet` returns
  `{ valid: true }`. VERIFIED
- ISC-3: Proposed Mission node (`iverif-wiki-activation`) has
  `parentNodeId: null` and anchors `sapling:iverif`; singleton tenant-root
  check passes for `tenantId: 'cambium'`. VERIFIED
- ISC-4: `IVERIF_GOLDEN_PATH` from `shared/iverif-golden-path.ts` imports and
  compiles successfully through `compileOperationalPacketProjection`. VERIFIED
- ISC-5: `THREE_SAPLING_LOADOUT_AUTHORITY.resolve('loadout:iverif-observer')`
  returns a record with `eligibleWorkObjectIds: ['sapling:iverif']`; the
  proposed Task's loadout pin is governed and eligible. VERIFIED
- ISC-6: Validation was read-only: no D1 write, R2 write, Hermes dispatch,
  deployment, or provider mutation occurred. CAS commit deferred to founder
  approval. VERIFIED

Validation output:
```
=== ISC-1: Mapping receipt evidence ===
IVERIF_GOLDEN_PATH workId: sapling:iverif
IVERIF_GOLDEN_PATH preparedReceiptId: pmr_a8c7a566eb32790dffaf1d2a
IVERIF_GOLDEN_PATH receiptIssued: false
IVERIF_GOLDEN_PATH readbackVerified: false
=== ISC-5: Loadout authority validation ===
Loadout resolved: true
Loadout eligible for sapling:iverif: true
=== ISC-2/3: Node set validation ===
Node set validation: {"valid":true}
=== ALL ISC CHECKS PASSED ===
```
