# Department/native compatibility candidate — source only

The requested version80 promotion was held before any traffic write because production had advanced to version82 / `323f4587-7066-4c89-b7db-d21c12493d7a`, source `ab94d63c`. That separately approved release adds shared Inbox endpoints, protected native browser consent and five binding configurations absent from version80. The existing serving deployment is `5097ee7b-0f01-4f37-b87e-94cc99d653db`. The owner's requested `ef6e0c74-697e-4938-9d15-e0e481c80dbe` rollback target is retained as a historical target; it does not contain those newer native capabilities.

Promoting the immutable version80 would replace the native release with a 47-binding version lacking the protected consent alias and shared Inbox routes. No traffic promotion, rollback, re-upload, schema operation, graph change or native enrollment was performed by this task. The owner then explicitly selected preserving version82 and preparing this compatible candidate. That selection authorizes source preparation; no new upload or traffic action is implied.

## Concrete compatible source

This isolated candidate starts from the reviewed department branch and carries only the existing native owner's additions:

- Preserve the department graph reader, source validation, automatic derived refresh, original IDs/parents, twelve explicit unavailable KPI states, existing Will/Taste/Cortex references, and the maintained portfolio validation.
- Reuse `ab94d63c`'s exact native-session browser alias/cookie-path code and regression tests, including the matching native-client authorization path.
- Reuse the already-serving shared signal store, route, D1 adapter and tests. The handler and Worker composition retain both departmentSources and sharedSignalStore. Migration0102 is retained as the owning release's schema source; no migration is executed here.
- `release/wrangler.labs.department-native-review.jsonc` inherits the52 already-serving binding names, including NATIVE_SESSION_CLIENTS_JSON, NATIVE_SESSION_OWNER_ORIGIN and the three PLEXUS_NATIVE_IDENTITY fields. It contains no values and adds no new permission or credential. It is a local review artifact, not upload authority.

The source change is a compatibility option. Neither the version80 upload approval nor its traffic approval authorizes uploading or promoting this different source/configuration.

## Observed local verification

510/510 focused handler, shared-signal, native-session, department and refresh boundary tests pass. TypeScript check passes. The department browser bundle remains byte-identical to the reviewed source, SHA256 `50c94586f0a01907d4f879f0846b4cbaed163302b9975a33174283b67004df50`. Wrangler dry-run compiles the52-binding candidate without upload. Emitted-Worker checks show no retired2D modules or markers.

Final local combined Worker:2,582,907 bytes, SHA256 `eee74fb907c0ff1eb2ca59802b7e327d0478b88b3278fe3b624c6085d5ab3f5b`. The stable full repository run passes2,690/2,693, leaving the same three baseline failure identities. GIT_OPTIONAL_LOCKS=0 prevents optional Git status-cache writes from contaminating the snapshot assertions; no source assertion is skipped. An earlier run with index snapshot races is retained separately. The selected native Swift identity suite passes47/47 with isolated temporary build output; the first Documents-based generated bundle encountered resource-fork signing metadata, which is not a source-code failure. The earlier authenticated candidate desktop/mobile proof covers the unchanged department frontend with real founder reads; it is not acceptance of this unuploaded backend candidate. No new authenticated post-promotion desktop/mobile result is claimed.

Before any newly approved upload, reread the actual current deployment, all52 binding configurations, runtime/global settings, current native release and accepted owner receipts. Stop on drift again. A combined upload and a later traffic assignment retain their separate gates.

Evidence: `artifact:departmental-live-integration-20261103/promote-version80-20261103/concurrent-release-drift.json`, `compatibility-inspection.json`, and the compatibility source receipt. The primary checkout, the original version80 branch and serving version82 remain intact.

## Current disposition

Owner choice resolved: preserve version82 and prepare this combined source. All external state remains unchanged by this task. The source/code and52-binding config are now concrete review artifacts, with a new exact upload gate and a later separate traffic gate. Version80 is retained as historical evidence, not selected for promotion after the newer native release was discovered. The requested ef6e0c74 rollback target remains recorded.

## Later concurrent diagnostic release retained

The native owner subsequently promoted version83 / `9b7663fe-5f6b-43d8-b74b-485a085bfbc0`, source `d113d8ab193e2d00aaa1a90d91682d0acaab95ea`, adding categorical consent diagnostics only. Its52 binding configurations and runtime match version82 exactly. This task did not change that traffic. The final combined candidate also carries that exact one-file diagnostic delta; messages contain fixed categories, not submitted fields or credentials.

Final focused Node verification passes559/559, including native session primitives/routes, shared signals, handler, department and refresh boundaries. The selected Swift native identity suite passes47/47. Typecheck passed before the pure diagnostic-logging addition; final Worker compilation, unchanged department bundle,52-binding dry-run and retired-surface guard pass afterward. The stable full repository checkpoint is2690/2693 with the same three baseline failures; the post-diagnostic full run is recorded in the final private source receipt.

The latest observed serving deployment is `1a902e7a-c1b0-4bd2-a6b8-7c1d58957516`,100% on version83. The source/config pins this observed native release and must be freshly reconciled again before any approved upload. Nothing here authorizes replacing a newer concurrent release.

Final post-diagnostic full run:2,690/2,693 passing, retaining exactly the three documented baseline failures. No new failure identity was introduced. This is source verification only; the combined candidate remains unuploaded and unpromoted.
