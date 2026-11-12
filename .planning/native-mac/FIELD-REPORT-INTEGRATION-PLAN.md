# Shared Field Report / Curious / Cambium implementation proposal

Source checkpoint, 3 November: shared signal capture/list/detail/update, local
D1 atomic receipts, native Inbox and dynamic project associations are implemented
and locally verified. See [implementation notes](../../apps/cambium-mac/docs/SHARED-SIGNALS.md).
This does not close tranche A's real Field Report peer or live delivery proof.
Remaining tranches and production migration are unchanged.

3 November 2026. Based on the founder's sixteen confirmed
[decisions](../../apps/cambium-mac/docs/FIELD-REPORT-INTEGRATION-DECISIONS.md).
This proposal extends the existing native lane. It does not change the active
GSD v0.5 Phase 9 consolidation state or issue operational admission. Root
`ISA.md` remains the acceptance ledger. Promote finite executor packets there
and into the owning roadmap before dispatch; do not treat this file as a second
acceptance ledger. No phase or criterion is marked complete here.

## Delivery target

For Thoughtseed Labs, both Field Report and Cambium Mac create signals and draft
directions against Cambium's shared backend. Automatic online sync and durable
offline drafts retain user changes; conflicts require review. Cambium approves
and launches exact admitted work. Results return to both surfaces, with eligible
work accepted through the task's pinned policy and exceptions sent for review.
Field Report retains spatial editing. Field Theory supplies permission-checked
references from selected collections; note editing remains at its source.

The first proof uses `sapling:cambium`. Every other mapped project stays in
scope and must remain discoverable, with operational availability reported
according to real joins/admission rather than source-catalog membership.

## Existing evidence and gaps

- `OwnerServices.swift` still installs unconfigured knowledge readers in standard
  mode. Reference decoders and their memory-only store do not implement shared
  signals, editable directions, durable drafts or automatic acceptance.
- The local Field Report source has snapshot records, D1 expedition/operations/
  research overlays, and R2 media. The inspected source's Sites private-owner
  boundary must be replaced by an explicit verified identity contract wherever
  migrated data is served through Curious.
- The current-source census finds 510 records and 78 repository-based source
  association candidates, including three multiple-project candidates. It is
  preparation evidence, not a mapping receipt or operational join.
- Latest read-only activation evidence: Curious native session 404; TeamForge
  native identity 501; protected fabric reads 401. PR #105 remains unmerged.
  Recheck before activation; do not treat these observations as permanent facts.
- Direction connector producer/version and current deployed Field Report parity
  remain unresolved. Actual selected Field Theory collection IDs are not chosen.

## Implementation sequence

Each tranche delivers a vertical workflow, including relevant persistence, owner
API and consuming UI. These are additive extensions to existing services; no
new bridge daemon, scheduler, resident organ or routing owner is proposed.

### A. Shared signal and project identity

Owning Cambium areas: existing Worker composition/handler, migrations beside
the current `BRIDGE_DB` migrations, `CambiumCore` clients/models, native state
and scene modules. New source filenames and migration numbers are selected
after checking the current checkout for concurrent allocations.

- Define a shared signal identity, verified tenant/principal scope, source
  system/record/version, observation timestamp, evidence references, revision
  and optional project associations. Retain source IDs separately from backend
  IDs and operational Work IDs.
- Add authenticated capture/list/detail mutations to the existing owner Worker.
  Use a caller operation ID, expected revision and durable response receipt.
  Repeating the same request returns its original outcome; changed content under
  that ID returns a conflict. Queries are bounded and tenant-filtered.
- Create native Inbox and project-linked signal views. Show saved/syncing/error
  states, source provenance and unresolved identity explicitly.
- Define the Field Report client adapter in its owning repository packet. The
  first proof requires real Field Report capture and native readback as well as
  the reverse. A native fixture-only screen cannot satisfy this tranche.
- Reconcile source associations against served project identities. Preserve
  multiple legitimate project links and review ambiguity. Approval requires
  one exact operational target and a verified join.

Verify: cross-tenant denial, role denial, changed revision, lost response/replay,
exact source identity, Inbox without a project, and both-surface readback of
the same saved revision. Archive/restore and duplicate source handling preserve
lineage. No source body or private corpus enters tracked fixtures.

### B. Directions, references and offline editing

- Add revisioned direction drafts linked to selected signals and evidence.
  Both editors use the same backend mutation/read contracts.
- Persist a scoped local draft outbox separately from disposable read caches.
  Use operation identities that survive restart and retain unknown save outcomes.
  Reconcile status before resending. Show a conflict review with both versions;
  do not silently overwrite either version.
- Partition drafts by identity/workspace. Lock access on sign-out and define an
  explicit recovery/export or discard path for unsynced drafts. Revoked access
  must prevent upload. Do not accidentally discard drafts through existing cache
  invalidation calls.
- Search only enrolled Field Theory collections through a supported source
  interface. Preserve source permissions, revision and provenance at attachment
  and retrieval time. Unsupported/unavailable sources show an explicit state.
- Add on-request AI direction drafting using selected signals/references through
  the existing hosted Phloem transport. Resolve credentials server-side through
  the owning contract. Preserve citations and distinguish suggested project
  links from verified associations.

Verify: two editors changing one revision, offline/restart/reconnect, duplicate
save attempts, sign-out and identity switch, revoked collection access, missing
source revision, AI failure, and user-edited AI drafts. Live sign-in is required
for approval and launch; offline editing creates drafts only.

### C. Approval, admitted launch and acceptance

- Extend the existing founder review with the exact direction revision, target
  WorkObject, task scope, expected artifact, evidence, budget/stop condition and
  acceptance policy ID/version/digest. Bind those values to the approved intent.
- Reuse existing Gate/CAS, native session and native launch interfaces. Hermes
  executes admitted pinned work. A direction edit requires renewed review;
  a stale target or revoked identity refuses admission/launch.
- Record result-ready separately from accepted. Evaluate required checks against
  the exact attempt/artifact revision. Missing, failed, stale or inconclusive
  evidence produces review-required. Policy changes after launch do not alter
  the pinned decision.
- Store an acceptance receipt with policy digest, check evidence and result
  identity. Return it to both surfaces. Exceptions become linked follow-up
  proposals. Automatic acceptance grants no publication, merge or deployment
  permission.

Verify: pinned-policy substitution, partial check success, missing artifact,
stale evidence, result from another attempt, duplicate terminal results,
revocation, uncertain launch status and restart recovery. Prove one real native
approval/admitted launch/terminal readback when runtime owners are activated.

### D. Shared assets and remaining Field Report migration

- Inventory snapshot records and persisted overlays separately, including undo,
  archive, research receipts and existing publication fingerprints. Verify the
  direction connector producer rather than assuming local routes match it.
- Build a migration manifest with per-record source version/digest, destination
  identity, tenant ownership, project associations, transformation and conflicts.
  Hold unresolved ownership; Thoughtseed-first does not enroll Noesis records.
- Store uploads under shared asset identities with versions/digests and verify
  bytes on readback. Preserve media range requests and original references.
  Retain external links with provenance; no broad knowledge-vault migration.
- Move each data group through prepare → reconcile → freeze its old writer →
  final delta → switch consumers → read back → retain rollback source. A timeout
  requires status reconciliation. Never allow both backends to independently
  acknowledge edits to the same migrated record.
- Preserve Field Report's spatial scene, editing, search, import/export and undo
  behavior while moving its persistence behind shared contracts. Inventory
  browser-local spatial state explicitly before claiming migration parity.

Verify: source/destination counts and digests, broken links, media seek, target
newer than source, same-key digest conflict, edits during cutover, cancellation,
writer fencing and rollback with post-cutover edits retained. Production data
copy, schema apply, writer switch and deployment use their exact owner-approved
rollback packets; this plan does not execute them.

## Concrete pilot proposal

Subject: `sapling:cambium`; tenant: verified `cambium` owner scope.

Observed signal: the Field Report project census fingerprints the source bytes
but its output omits the source observation date and accepts any string as that
date. The inspected snapshot is dated `2026-10-07`; operators need that date
alongside candidate project associations.

Proposed direction: expose and validate the source observation date in the
existing read-only census. Keep date-only source semantics; do not fabricate a
precise observation timestamp or treat fetch time as source freshness.

Code scope: `scripts/probe-field-report-projects.mjs` and its focused test file.
Expected artifact: a reviewable diff plus machine-readable test evidence.
No production effect, external source edit, commit/merge or deployment belongs
to this operational work request.

Proposed pinned policy `repository-change.v1` for this bounded task:

1. Valid calendar dates in the producer's date-only format are preserved in an
   explicit `sourceObservedAt` field; invalid dates and absent dates fail with
   bounded diagnostics. Any timestamp support must be explicitly specified.
2. Tests reject impossible dates, malformed strings and absent fields; they
   preserve the existing exact repository matching, no-body output, ambiguity
   handling and no-admission behavior.
3. Run `node --test scripts/probe-field-report-projects.test.mjs`, then run the
   probe against the selected actual snapshot. Verify date `2026-10-07` and
   unchanged mapping results for identical catalog/source inputs.
4. The result diff contains only the two named files and passes
   `git diff --check`. Check evidence is bound to the artifact revision/digest;
   a check from another checkout or revision cannot accept this artifact.
5. All checks must pass for automatic result acceptance. Any missing evidence,
   changed scope or failed check sends the task to review. The policy name and
   schema are proposed until the acceptance-policy owner implements them.

Run this task through the completed shared workflow after A–C and live identity/
launch activation. Doing this edit directly during planning would not prove
capture → direction → admission → execution → accepted result. The full
integration is not complete merely because this small pilot's tests pass.

## Owner packets and next executable boundary

| Owner | Work packet | Dependency |
| --- | --- | --- |
| Cambium | Shared signals/directions API, native capture/read/sync, Gate/launch joins and policy result projection | Verified identity contract and current project catalog |
| Field Report | Consume shared APIs, retain spatial editor, export/reconcile old state and switch each data-group writer | Source/deployed parity and shared API contract |
| TeamForge/Plexus | Native identity route review/merge/deploy and tenant map | Existing PR #105 and exact owner activation task |
| Hermes | Admitted pinned code execution and original-request result evidence | Current launch contract and supported work class |
| Field Theory | Selected collection identities and supported permission-preserving search | Actual collection/source inspection; no note writer |

First source implementation packet: tranche A signal capture/list/detail and
native Inbox against local databases plus a contract-compatible Field Report
fixture. Prepare its finite files, schema and boundary checks in the native GSD
lane; fixture proof remains distinct from the required peer-source change.
Do not dispatch the injected next wave without its matching claimed approval.

The production critical path is identity activation → shared API deployment →
both editors' read/write proof → Gate/admitted launch → terminal/policy readback.
Local A–C source work can advance while owner activation is pending.

## Full completion evidence

The integration requires all sixteen decisions to be implemented and verified,
not just the pilot. Retain both-surface capture/edit/sync/conflict proof, exact
mapped project links, the real Cambium pilot with acceptance receipt, Field
Theory selected-collection permission tests, shared assets, migration parity,
native keyboard/accessibility/light-dark proof, restart recovery, and the exact
signed application/deployed versions. Repeat the workflow across additional
mapped projects before broader cutover; unsupported operational projects retain
an explicit gap. Record actual acceptance in root ISA without weakening the
existing native launch or consolidation gates.
