# Field Report, Curious and Cambium integration decisions

Recorded 3 November 2026 from the founder's sequential product decisions.
Decisions 1–16 are confirmed. The implementation proposal is linked below.
These are product requirements, not deployed behavior or an approval to migrate
production data. Root ISA owns acceptance; `.planning/` owns finite sequencing.

## Confirmed decisions

| # | Decision | Implementation consequence |
| --- | --- | --- |
| 1 | Native daily workflows in Cambium; specialized editing opens Field Report. | Native capture, review and operational coordination; retain the spatial editor as a peer surface. |
| 2 | Consolidate Field Report records into Cambium's backend; retain Field Report as an editing surface. | Define shared authenticated read/write contracts and migrate existing source records. This supersedes the proposed permanent split in record ownership. |
| 3 | Migrate in stages, proving one complete workflow before the remaining capabilities. | Each data group needs a declared writer, reconciliation, cutover and rollback; avoid competing writers during transition. |
| 4 | First workflow: signal → direction → approved work → result. | Prove continuity through the entire chain against mapped projects. |
| 5 | Both surfaces create signals and draft directions; Cambium handles approval and launch; Field Report retains spatial editing. | Shared editable records with distinct surface capabilities. Approval binds the reviewed revision. |
| 6 | Automatic online sync; offline drafts sync on reconnect; conflicts require review. | Durable scoped draft storage, revision checks and conflict handling are required. Approval and launch use a fresh backend connection. |
| 7 | Permit a tenant-scoped Inbox; require an exact project or WorkObject before approving work. | Project association is optional at capture. Name similarity cannot establish an operational join. |
| 8 | AI assists on request: summarize selected signals, suggest links and draft a direction for review. | Use selected, provenance-bearing context; retain review before approval. |
| 9 | Automatically accept eligible work when all predefined checks pass; send exceptions for review. | Distinguish execution completion from acceptance and record evidence for the acceptance outcome. Acceptance grants no additional effect permissions. |
| 10 | Reusable acceptance policies by work type, pinned on task approval; unusual work requires review. | Version policies and bind required checks/evidence before execution. Later policy changes do not change running work. |
| 11 | Thoughtseed Labs and its mapped projects first; preserve workspace ownership and access boundaries. | Use existing verified tenant/identity mappings. Do not invent a new tenant identifier from the workspace display name. |
| 12 | Uploaded assets in shared storage; external sources remain linked with provenance. | Shared asset identities/version/digests; external source identity and revision remain explicit. No bulk private-vault copy. |
| 13 | Search and attach Field Theory references from both surfaces; requested AI drafts use selected references; note editing stays in Field Theory. | Read-only source search and attachment with identity, revision and provenance; no Field Theory note writer in either surface. |
| 14 | Only explicitly selected Field Theory collections are searchable, with source permissions preserved. | Maintain workspace collection selection and enforce current source access for search, attachment and retrieval. The actual collections still need selection; no collection is enrolled by this decision alone. |
| 15 | Cambium itself (`sapling:cambium`) is the first complete workflow pilot. | Use its explicit local project-to-Work join as the source starting point; verify current owner-served identity and admission before real execution. All mapped projects remain in scope. |
| 16 | The pilot delivers a small code change with tests and a reviewable diff. | Name exact files, expected behavior, checks and a pinned acceptance policy before operational admission; acceptance does not authorize merge or deployment. |

## Implementation proposal

See the [staged implementation plan](../../../.planning/native-mac/FIELD-REPORT-INTEGRATION-PLAN.md).
All sixteen product decisions are confirmed. Actual Field Theory collection
identities and production migration/cutover remain concrete setup and owner gates.
The plan proposes the exact pilot task; it is not an operational admission receipt.

Field Theory search scope is now confirmed as selected collections. Search
scope alone grants no corpus-copy or note-edit authority.

## Existing implementation and required changes

Current source was inspected for this checkpoint. Neither an endpoint name nor
an external schema below is asserted to exist without producer evidence.

| Existing seam | Current behavior | Required change from confirmed decisions |
| --- | --- | --- |
| [Native knowledge contract](KNOWLEDGE-ADAPTER-CONTRACT.md) and `CambiumCore/KnowledgeClients.swift` | Separate Field Theory/Field Report reference decoders; caller-supplied exports; memory-only snapshots. | Keep source distinctions; add shared record and sync contracts after inspecting the actual producer schema. Existing reference envelopes cannot represent the full editing workflow. |
| `CambiumNative/State/OwnerServices.swift` | Standard mode installs unconfigured knowledge readers. | Connect authenticated source reads and supported mutations through the existing owner API. |
| `bin/operator/onboarding/field-observation.ts` | Pure, proposal-only intake with explicit provenance and holds. | Preserve provenance and proposal semantics while defining migrated record identity, revision and exact project joins. |
| [Mapped projects](PROJECTS-INTEGRATION.md) | Served catalog and explicit join report map canonical project IDs to operational Work. | Attach signals/directions through those exact identities; catalog membership alone cannot approve work. |
| [Native identity](NATIVE-IDENTITY-CONTRACT.md) and [launch](NATIVE-LAUNCH-CONTRACT.md) | Existing owner interfaces and local implementation evidence. | Prove live authenticated delivery and admitted launch before claiming the integrated workflow works. Historical runtime readbacks are not fresh activation evidence. |

Backend consolidation is a change in Field Report record ownership. It does
not merge knowledge records into the operational Goal Graph by default.
Operational intent still uses its owning admission contract; Hermes executes
admitted pinned work. Field Theory's knowledge authority remains distinct.

## Next finite implementation work

1. Finish producer parity inspection using the source findings below, including
   live deployed-version comparison through authorized access. Connector
   direction metadata alone cannot establish full schema or migration parity.
2. Compare its record IDs against the served project catalog and explicit
   Work joins. Prepare a migration mapping with unresolved records retained.
3. Specify shared signal/direction revisions, source lineage, authenticated
   workspace scope, mutations, sync cursors, conflicts and offline drafts.
4. Implement one complete mapped-project workflow locally, using fixtures
   whose shape has been verified against the producer. Prove both editing
   surfaces consume the same contract before retiring any old write path.
5. Add pinned acceptance policies and exception review, then verify result
   continuity and existing approval/launch behavior.
6. Prepare the exact migration/cutover, reconciliation and rollback packet.
   Production execution remains a separately approved owner action.

Field Theory search and reference attachment are confirmed for selected
collections. The actual collection identities and source interfaces still need
inspection and selection before enrollment. No full-library indexing is implied.

## Producer source inspection, 3 November 2026

Read-only inspection of the existing Fieldwork checkout (repository identity
`Sheshiyer/field-report` in Cambium's source mapping) found clean source revision
`1de59970cf0233d196ca5aa9d78bcf2ce8c54254`. This is local source evidence;
deployed parity and current stored data have not been established. No private
dataset, original media, credentials or record bodies are reproduced here.

| Producer source | Observed behavior | Migration implication |
| --- | --- | --- |
| `modules/snapshot.js` | Fetches `world-data.json`; caches it under `fieldwork.snapshot.v2`; supports eight record kinds and edges. Snapshot keys use `kind:id`, falling back to a positional ID. | Retain source kind and ID; reconcile missing identities explicitly. A positional fallback cannot establish a durable project join. |
| `hosting/worker/operations.js` | Builds its record map from the bundled snapshot using `id`, then `full_name`, then `name`. | Snapshot projection and operations may derive different fallback identities. Compare actual records before assigning shared backend IDs. |
| `hosting/db/schema.ts` | Declares `expedition`, `record_operations` and `research_runs`. Planning state uses a revisioned JSON body and previous body; record operations hold research, archive, approval and publication fields. | Migration must account for both bundled records and persisted overlays. Copying the snapshot alone loses edits and decisions. |
| `hosting/worker/field-report.js` | Plan GET initializes the owner row if absent. Plan PUT requires the next revision and uses compare-and-swap; conflict returns current state. | Even the source's plan GET can mutate storage. Use approved source exports/read-only inventory for preparation; preserve revision and conflict semantics. |
| `hosting/worker/operations.js` | Research batches have stable run IDs and digest receipts; identical replays return the prior receipt and conflicting content returns 409. | Reuse idempotent operation identity and readback; do not replace it with blind last-write-wins synchronization. |
| `hosting/worker/field-report.js` | Media uses a reviewed manifest, R2 size/SHA checks, and byte-range responses. Imports validate expected size/hash. | Preserve object identity, digest and seekable media behavior; reconcile target objects before any copy. |
| `hosting/worker/field-report.js` and `operations.js` | Sites dispatch supplies private-owner access. Browser record decisions require a trusted user header plus same-origin requests. The inspected schema has no per-record tenant columns. | Curious must supply its own verified identity and explicit tenant scope. Do not accept browser-supplied identity headers as equivalent to trusted dispatch assertions. |
| `hosting/worker/operations.js` | Public draft approval binds an exact fingerprint; queueing retains an unconfigured delivery-adapter status. | Preserve existing human publication permissions. Automatic result acceptance must not silently become public-post approval or delivery. |

The inspected Worker entrypoint exports `field-report.js`. Its route handlers
cover plans, research/operations, source previews, media, and proposal-only
activity preparation. No direction-event/cursor route was found in these
inspected Worker modules or database schema. The connected direction API may
belong to another version or layer; identify that owner before adapting its
events into the shared backend.

Next source checks are the snapshot-to-operation identity census, planning body
and undo model, spatial layout persistence, deployed source parity, and the
direction connector's producer contract. They can proceed independently of
selection of actual collections without editing the Field Theory source.

### Bounded identity census

A read-only Node census inspected the bundled `hosting/public/world-data.json`
at the producer revision above and compared declared repository fields against
the current working `RAW_SAPLINGS` and `RAW_PROGRAMS` provenance. No source
bodies or datasets were copied into Cambium. Snapshot SHA-256:
`271adce87f369e0e2c2dc6b9d44cbbd51889954f2e16bd87a22716500a837916`;
source observation date: `2026-10-07`.

| Record group | Count |
| --- | ---: |
| Products | 12 |
| Drafts | 7 |
| Repositories | 330 |
| Hosts | 63 |
| Boards | 22 |
| Ideas | 53 |
| Editorial | 15 |
| Work items | 8 |
| Total | 510 |

All 510 bundled records have explicit IDs, with no duplicate projected or
operations keys and no fallback disagreement in this particular snapshot.
The differing fallback algorithms remain a future-input concern, not an
observed collision in these records.

None of the source `id` values directly equals one of the 74 working action
catalog WorkObject IDs. Repository comparison found 78 candidate source rows;
three have more than one candidate WorkObject. This comparison only used
declared `repository` and repository-record `full_name`/`id` fields, normalizing
GitHub owner/repository case and stripping provenance subpaths. It did not use
names, inferred brands or arbitrary nested text. The remaining 432 records are
unresolved by this bounded method, not proven unmappable.

Concrete source-backed candidates include the HeyZack email-template repository
to `branch:heyzack`, the Saanmai repository to `branch:relovo`, Tirak repositories
to `branch:tirak`, the Fitcheck wiki to `sapling:fitcheck`, and the Lockwell
repository to `sapling:dlock`. Shared capability repositories can have several
legitimate project associations; do not choose one by array order. No candidate
was installed as an operational join or used to admit work.

The compared catalog is working source, including the concurrent uncommitted
catalog lane; these counts do not certify a committed or deployed catalog.
Review candidates against the owner-served identities before approving work.

Rerun this preparation without writing a mapping or contacting a service:

```sh
node scripts/probe-field-report-projects.mjs --snapshot "$FIELD_REPORT_SNAPSHOT"
node --test scripts/probe-field-report-projects.test.mjs
```

Set `FIELD_REPORT_SNAPSHOT` to the explicitly selected local snapshot file.
The probe emits counts and source-ID/repository/WorkObject candidate metadata
to stdout, never source bodies or the input file path. Keep its output private
unless its identifiers have been reviewed for sharing. It accepts bounded local
JSON and uses only the current working action catalog, not display proposals.
Its `catalogInputSha256` fingerprints that exact identity/provenance projection;
it is not the catalog owner's authority digest. The actual-source rerun produced
the counts above and catalog-input SHA-256
`1e5e570500fe782da1fbf41c235ff2a6b065b5262a9bbe58e50e5478fc1edf1d`.

Four focused tests pass: exact versus name-only matching and multiple project
candidates; missing/duplicate source IDs; refusal of credential-bearing or
query/fragment/foreign-host repository references; and malformed inputs.
`identityReviewRequired: false` in the real census means no missing/duplicate or
fallback identity problem was found. Candidate associations still require review
and `operationalAdmission` remains `none`.

The inspected mission plan model retains per-mission revisions, up to thirty
mission history entries, and twenty expedition undo snapshots. Migration must
preserve proposal-only stages and undo provenance; a checklist completion or
`ready-for-review` stage cannot become operational admission or accepted work.

## Planning and acceptance references

### Live dependency refresh, 3 November 2026

The existing GET-only `apps/cambium-mac/tools/probe-live-owner.sh` was rerun
after adding the census probe. Curious health returned 200; native session
returned 404; Mission Fabric and quest reads returned 401
`access_identity_required`; the proposed TeamForge identity route returned 501
`feature_not_ready`. `routeSurfaceReady` remains false. TeamForge PR #105 is
open, non-draft, mergeable, unmerged, with no reported checks or reviews.
This verifies the activation dependency remains unresolved. No merge, deployment,
secret write, migration or sign-in was performed.

### Source references

- [Native roadmap](../../../.planning/native-mac/2026-11-02-ROADMAP.md)
- [Native stories](STORIES.md)
- [Native architecture](ARCHITECTURE.md)
- [Project handoff](../../../.project/HANDOFF.md)
