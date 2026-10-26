# Reviewed portfolio membership: local reconciliation

Base `37309d4c1a5690123680924e40c731e6a4b42c72`. Local proposal only; independent review and owner acceptance remain pending. No publication, runtime mutation, sync, receipt issue, deployment or execution.

## Authority and implementation

Reuse the existing operational packet registry and `OperationalRepositoryComponent` contract. Vault client briefs/project links remain canonical knowledge; this checked-in metadata is a bounded projection, not another tracker or a runtime vault dependency. No personal chat or contact data is copied. The digest-pinned 72-record action catalog and old mapping receipts are unchanged.

Membership, role lifecycle, project association, planning authority and execution targets are distinct. One selected non-historical repository owns planning for a component-bearing intake; all known membership travels alongside it. Co.Property document associations are not new registered project IDs. Existing account/family boundaries and project-bound infrastructure accounts remain unchanged.

- Workbench supplements display provenance and exact repository evidence; Intake exposes component multi-selection separately from primary planning repository. Incomplete drafts round-trip but cannot pass complete-intake readiness.
- JSON import/export and Markdown preserve arrays. Legacy drafts preserve primary selection, including ParkArea aliases; new requests canonicalize that same selected repository identity without altering the saved draft; new UI requests use full membership fallback. Legacy singular action validation injects no fields, preserving original digest/idempotency input.
- New component-bearing action validation rejects missing/unknown/duplicate components and altered ID, owner, role, lifecycle, project association, planning authority or client family.
- Existing immutable evidence contains the full array covered by action digest. Trigger references that receipt and remains `pending-governed-intake` / `repository-intake-review`; no execution approval. Replay returns the original receipt; conflicts remain rejected.
- Worker-hosted Workbench embed is rebuilt locally from source.

## Six-area audit

| Existing identity/account | Canonical Labs evidence | Known subset | Result and limit |
|---|---|---|---|
| `branch:tirak` / `tirak` | `60-client-ecosystem/tirak/project-links.md`, project brief, existing Plus authority decision | 10: 3 current, 3 historical, 4 source-supported roles awaiting sign-off | All ten available to Intake; backend/Plus customer/Plus admin/wiki remain `unreviewed`. Website and customer PWA separate. Exact PWA commit GitHub-publication caveat retained. |
| `branch:parkarea` / `parkarea` | `60-client-ecosystem/parkarea/context/README.md` | 3 current: web/backend, mobile, wiki | Exact metadata supplements older aliases; legacy primary choice preserved. |
| `branch:insight-realtors-legal-advisors` / same account | Existing Insight context/review notes | 1 confirmed website | Known subset only; no inferred second repository or legal entity. |
| `branch:co-property` / `co-property` | Client README and three nested briefs | 3 current projects, 7 historical client associations | Office OS, Website 2026, Academy remain separate document associations under legacy client aggregate. No new WorkObject/project IDs; HostScale, Nimbus, Wanderfruit and HeyZack not reassigned. |
| `branch:klear-karma` / `klear-karma` | Project links/brief | 4 current, 6 historical | Full set retained. Pineapple Labs Cloudflare profile `klear-karma` remains distinct from personal/default. |
| `branch:relovo` / `relovo` | Project brief | 1 current repo | Retained evidence, but absent from base Workbench/action catalog. No actionable entry or tenant invented; catalog-owner reconciliation required. |

35 known associations total, not exhaustive GitHub coverage. Current/historical are reviewed local roles, never GitHub archive state or accepted runtime deployment. Verified access state reflects prior authorized identity metadata, not fresh runtime admission.

## Actual downstream evidence and remaining handoff

No fresh runtime receipt, mapping issue/readback, reader ingestion or executor outcome was obtained. Previously denied paths were not retried. August batch-three mapping receipts remain `prepared-not-issued` and unchanged; prepared records do not prove admission.

Search of non-generated/non-test source in this base's `workers`, `apps`, `shared`, `scripts` found `portfolio-admin:trigger:v1` / `repository-intake-review` production references only in the producer and Workbench UI. This does not establish absence of a consumer elsewhere. Existing Hermes directive runner/admission is separate; no replacement planner, dispatcher or consumer is invented here. Tests prove the payload through immutable mock evidence and trigger reference, not live execution.

Next: independent review of this patch, then reconcile the actual existing runtime consumer and prove receipt-fetch/digest/full-membership readback before publication/admission. Resolve Relovo's owning catalog path separately. No live handoff is implied by this local preparation.

## Validation

App TypeScript passes. Broader app/domain/repository-intake/action/route/operational projection tests: 149 pass, one pre-existing skip (150 total). New integration tests cover five catalog-backed identities through export/import and receipt/trigger, replay, rejected omissions/identity/role/lifecycle/association/owner/family/authority changes with zero mock writes, historical planning rejection, Co.Property boundaries, Relovo absence, legacy payload equality and incomplete draft recovery. Vite build, bundle and static artifact audit are local only; no browser acceptance inferred. Historical catalog authority and receipt files remain identical to base. Full-repo tests and unrelated Gate work are outside this isolated patch.

A separate focused Worker TypeScript check is blocked by the unchanged base `workers/quests/src/context-bindings.ts:368` `RoutineContextItem.signalState` widening error (TS2322). This file is not modified by the patch; do not claim a green Worker typecheck.
