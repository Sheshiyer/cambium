# Reviewed portfolio membership: local reconciliation

Base `66a5b24c27f13a26b80e455fb219d7751b383771`, independently verified current main at replay start. Original candidate/base checkpoint is preserved separately. Local proposal only; independent review and owner acceptance remain pending. No publication, runtime mutation, sync, receipt issue, deployment or execution.

## Authority and implementation

Reuse the existing operational packet registry and `OperationalRepositoryComponent` contract. Vault client briefs/project links remain canonical knowledge; this checked-in metadata is a bounded projection, not another tracker or a runtime vault dependency. No personal chat or contact data is copied. The digest-pinned v2/73-record action catalog and its v1 historical version validator and old mapping receipts are unchanged.

Membership, role lifecycle, project association, planning authority and execution targets are distinct. One selected non-historical repository owns planning for a component-bearing intake; all known membership travels alongside it. Co.Property document associations are not new registered project IDs. Existing account/family boundaries and project-bound infrastructure accounts remain unchanged.

- Workbench supplements display provenance and exact repository evidence; Intake exposes component multi-selection separately from primary planning repository. Incomplete drafts round-trip but cannot pass complete-intake readiness.
- JSON import/export and Markdown preserve arrays. Legacy drafts preserve primary selection, including ParkArea aliases. New JSON/Markdown exports enrich absent membership through the existing registry without mutating imported state or receipt bytes. New UI requests canonicalize that same selected repository identity without changing the saved draft. Legacy singular action validation injects no fields, preserving original digest/idempotency input.
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
| `branch:relovo` / `relovo` | Project brief | 1 current repo | Uses the existing reviewed v2 catalog entry and admission from PR 387, including the preserved historical source ref. Full current membership round-trips through the existing action flow. Tenant remains unresolved; no admission/tenant is invented. |

35 known associations total, not exhaustive GitHub coverage. Current/historical are reviewed local roles, never GitHub archive state or accepted runtime deployment. Verified access state reflects prior authorized identity metadata, not fresh runtime admission.

## Actual downstream evidence and remaining handoff

No fresh runtime receipt, mapping issue/readback, reader ingestion or executor outcome was obtained. Previously denied paths were not retried. August batch-three mapping receipts remain `prepared-not-issued` and unchanged; prepared records do not prove admission.

Search of non-generated/non-test source in this base's `workers`, `apps`, `shared`, `scripts` found `portfolio-admin:trigger:v1` / `repository-intake-review` production references only in the producer and Workbench UI. This does not establish absence of a consumer elsewhere. Existing Hermes directive runner/admission is separate; no replacement planner, dispatcher or consumer is invented here. Tests prove the payload through immutable mock evidence and trigger reference, not live execution.

Next: independent review of this patch, then reconcile the actual existing runtime consumer and prove receipt-fetch/digest/full-membership readback before publication/admission. Relovo uses its already approved current-main catalog identity; tenant/runtime/execution verification remains separate. No live handoff is implied by this local preparation.

## Validation

App TypeScript passes. Broader app/domain/repository-intake/action/route/operational projection/catalog/mapping-receipt tests: 182 pass, one pre-existing skip (183 total). New integration tests cover all six catalog-backed identities through export/import and receipt/trigger, replay, rejected omissions/identity/role/lifecycle/association/owner/family/authority changes with zero mock writes, historical and unreviewed planning rejection, Co.Property boundaries, existing Relovo actionability, legacy payload equality, incomplete draft recovery and legacy JSON/Markdown enrichment. Vite build, bundle and static artifact audit pass locally; no browser acceptance inferred. Post-bundle route verification is run separately. Historical catalog authority, Relovo approval and v1 receipt evidence remain identical to the new base. Full-repo tests and unrelated Gate work are outside this isolated patch.

## Independent review fixes

- Unreviewed Tirak backend/Plus/wiki membership does not confer planning eligibility. UI choices disable non-current reviewed components; readiness checks include legacy singular drafts; Worker validation rejects known unapproved authorities even if the optional component array is omitted. The operational projection validator applies the same explicit lifecycle rule. Previously valid singular payload shape is unchanged; no historical stored evidence is rewritten.
- New JSON exports of legacy drafts populate full membership; Markdown also enriches already-exported legacy packets without changing those inputs. These draft-only projections do not run during immutable action receipt validation or replay.
- Relovo absence was caused by the stale original base. This candidate reuses current main's approved v2 entry and unchanged versioned v1 receipt validator; no duplicate identity or approval is introduced.

## Worker compiler baseline comparison

The focused Worker TypeScript check is not green. Candidate and a separate disposable exact-base copy both produce the same 68 error diagnostics, with no candidate-only or baseline-only diagnostics. These include the existing `context-bindings.ts:374` signalState error and existing graph/handler typing errors. Baseline comparison uses the same compiler and flags. Those files are outside this patch and are not repaired here. App-specific typecheck passes independently.

## Final identity review fix

Planning eligibility now resolves immutable repository ID, case-insensitive qualified name and source reference to the same reviewed component through one shared identity check. Existing generated ParkArea/Insight/Klear aliases are explicitly resolved; inconsistent ID/name/reference combinations fail. UI readiness and the Worker singular/component-bearing paths use the check; legacy valid request text is not rewritten. Casing regressions cover pending backend variants, current mobile variants, incorrect IDs/names/references, component-bearing equivalents and valid/mismatched ParkArea aliases.

Two untracked files, `apps/portfolio-cartographer/src/App 2.tsx` and `domain 2.ts`, are preserved and explicitly excluded from the patch and source manifest. Their bytes match clean-base source (`App 2.tsx` matches both prior and current bases; `domain 2.ts` matches current base). Their filesystem creation/modification time is 2026-10-26 00:32:04 +0530; the creating process/person is not established. No import references them; `main.tsx` imports `App.tsx`, and the app compiler's actual file list excludes both. They are unrelated local copies, not part of this implementation.
