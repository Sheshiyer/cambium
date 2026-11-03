# Department founder integration — review candidate

The November 3 implementation continues the approved source pilot on its isolated branch. It reconciles the maintained backend with the serving founder read/intake and 3D host seams. It does not replace newer native-session, Cortex/MCP Gate or portfolio code with the recovered serving snapshot.

## What is connected

The current 3D host supplies `getDepartmentState`, `getDepartmentStatus`, `subscribeDepartment` and `refreshDepartment` through the existing page-owned authenticated `CuriousGateBridge.graph()` GET. The Department folio owns no fetch, signer, storage or timer. Initial session reads, existing host refresh events, page restoration and explicit refresh reread the source. Reader notifications and view changes recompute the derived view. Revision fences discard late reads; failed reads clear the projection; close unsubscribes; page disposal refuses late restoration.

`GET /v1/founder/graph` retains Access/Plexus verification, positive founder/tenant enrollment, same-origin protection, complete graph digest validation and the final current-head check. It adds a bounded `departmentSources` read projection before that final fence. Native credential realms remain refused before the browser-only routes. Existing proposal, review, renewal, decision, replay and D1 CAS owners are retained.

The graph slice's declared company root is a containment boundary, not a fabricated product node. Product IDs, node IDs, parents and exact existing dates are preserved. Duplicate, missing and misleading containment links fail closed. The six Will desks, indexed profile/cluster/spoke references, Taste composer and Cortex candidate lane are reused.

## Accepted GSD reader boundary

`DepartmentSourceReaders.readAcceptedGsd` is a server composition seam for an **existing owner reader** which freshly validates accepted ISA/GSD sources. It is never populated from browser JSON, graph metadata, a due date, a generated recommendation, or an unverified cached orchestration. Its bounded output carries the exact tenant/WorkObject/head, source time and expiry, ISA acceptance reference, immutable plan digest/reference, task identities, owner sequence, task state and attributable dependency satisfaction. The adapter checks product identity, freshness, unique order, dependency cycles, predecessor sequence and inclusion of recorded planning prerequisites. Only pending dependency-ready items enter the display selection. Dispatch still requires the original admission/claim owner.

No accepted owner reader is bound in the current production composition. This candidate intentionally leaves `HandlerDeps.departmentReaders` absent unless the source owner supplies that existing authenticated read contract. It creates no mirrored plan, new approval store, persisted grant or host service.

Actual source reads on November 3 found:

- LumenBar source head `0c552cbea0dd1239218bbccd49c7770ac0555029`: no root ISA or GSD state/orchestration/approval packet at the inspected owner paths. No accepted task-to-graph mapping was available.
- Temperance source head `4ca571242a55d7a51ee3f605d8a53e8176aad7c0`: Phase 1 complete; Phase 2 discuss/plan required. Cached orchestration `plan_7779dfa5d14f432ca1a3` is draft, approval absent, readiness/execution blocked. The cached next wave is complete with no tasks. These files do not admit any launch bookkeeping task.

The product roots were read only. The unavailable/held result is a real integration outcome, not acceptance of a new departmental plan. Positive owner-read examples in tests are explicitly synthetic.

## KPI reader boundary

`DepartmentSourceReaders.readKpi` connects a compatible existing measurement owner when available. Full immutable definition/version/formula/cohort/freshness policy must match. The observation must match product and reporting window, carry provenance/time, and have a safe positive eligible denominator. Duplicate revisions, changed definitions, wrong cohorts/windows, future/stale readings, missing populations and reader failures cannot produce a measured value. Targets remain unset.

The current host has no compatible complete cohort measurement reader for these twelve definitions. Its D1 bookkeeping decisions and recorded editorial/release references are available as evidence references, but are not live public readback, an eligible denominator, adoption, retention or device acceptance. All twelve measurements therefore remain explicitly unavailable. No LumenBar telemetry, target, consumer change or external publication was added. Local accepted-work-unit receipts also retain their existing local-source domain and do not establish production acceptance.

## Authenticated browser proof

A temporary IAB tab loaded the exact candidate document at the authenticated founder origin. Only that tab's document was substituted through developer tooling; its session and graph GETs used the actual serving endpoints. This proves candidate UI → authenticated owner → current graph → derived UI. It does not prove a new Worker upload or production rollout. The document substitution was removed by restoring the normal serving page after QA.

The fresh canonical read was head11 / `68d3c34c2dd54ee2351e063bc0dd54bb468d8164550bd3af2c8cc10502d3e32f`, 128 product nodes, 64 per product, seven decisions. Desktop and measured 390×844 mobile checks cover source/head provenance, daily holds, monthly existing slots, KPI unavailable state, original identity/parent inspection, refresh, keyboard return and wrapping. Evidence is retained privately under `artifact:departmental-live-integration-20261103/`.

## Release and rollback

Production remains version `ef6e0c74-697e-4938-9d15-e0e481c80dbe` at 100%, source `c145554`. The same version was the latest uploaded version at readback. The current settings, 47 binding names/types, sole `0 */6 * * *` cron and enabled worker/preview exposure were freshly read. No Access, route, binding, cron, resource, credential or deployment mutation occurred.

`docs/plans/department-pilot/release/wrangler.labs.department-review.jsonc` is a value-free exact review candidate using those same 47 inherited bindings and the observed runtime/global settings. It adds no binding, migration or reader authority. The stock Labs config is not a substitute for this parity review. Wrangler dry-run compilation is local and uploaded no version. The actual emitted Worker passes the retired-module/marker guard.

Before upload, refresh current deployment **and latest uploaded version**, settings fingerprint, names/types, cron and exposure; stop on drift. New exact upload approval is required by `workers/quests/DEPLOY-LABS.md`. After upload, compare actual version/config readback before a separately approved traffic assignment. Historical approvals for c145554 authorize neither action for this candidate.

The primary rollback target for this new candidate is the currently serving `ef6e0c74-697e-4938-9d15-e0e481c80dbe` at 100%. Retain its source/config and receipt before promotion. Use the existing Labs traffic owner for an explicitly reviewed rollback; no legacy account deployment is involved. No schema or canonical data change is in this candidate, so traffic rollback has no data reversal to perform. Any future canonical bookkeeping change still requires its own exact-head review/confirmation/CAS, and cannot be reversed by traffic rollback.

The full-release gate still includes the old Telegram viewport manifest and pre-existing privacy checks. Current authenticated candidate proof is separate; it must not be relabeled as that historical manifest. Any narrow release acceptance needs a fresh owner decision against the concrete candidate and exact remaining failures.


## Upload outcome — November 3, 2026

The owner explicitly approved uploading `fcbb68f9` with this exact 47-binding configuration and the documented baseline failures, with traffic held for a separate approval. The clean source/config and complete settings fingerprint matched before the operation. The rebuilt and actual-upload artifacts both matched the reviewed Worker SHA-256 `e431304a0c4863df66a29fb22df5596d9f46394e329fc080572156835031f75d` (2,570,089 bytes). Wrangler4.156.1 uploaded with strict conflict checking.

Actual uploaded candidate: **version80 / `e3750ef4-86dc-4980-a5a2-1b9331120c85`**, created `2026-11-03T17:15:51.344067Z`. The Cloudflare version readback confirms the source annotation, all47 binding names/types/configurations exactly equal to serving, and identical runtime. The full prior settings fingerprint is reproduced after substituting the previous version annotations: the settings delta is upload metadata only. Sole cron, worker/preview exposure and operational settings remain unchanged.

Actual version-preview GETs returned the exact generated candidate JS and CSS, no retired2D shell or Telegram SDK, health200 with Gate configured, and unauthenticated graph401. This is uploaded-version source/denial verification, not authenticated candidate runtime acceptance or production promotion. The prior authenticated temporary-document proof remains separately scoped.

Deployment `d27c5b87-57ec-4774-82f8-21a518d23ccb` remains unchanged: **100% on `ef6e0c74-697e-4938-9d15-e0e481c80dbe`**. No traffic assignment, canonical graph write, migration or social action occurred. The source-pilot baseline failures remain recorded, not waived as passing tests. The upload approval is consumed by this exact version; it does not authorize another upload or traffic change.

Attributable receipts: `artifact:departmental-live-integration-20261103/upload-fcbb68f9-20261103/{preflight.json,upload-command-receipt.json,uploaded-version-verification.json,version-preview-readback.json,deployment-after.log}`. A later documentation checkpoint does not change the code/config uploaded from `fcbb68f9`.
