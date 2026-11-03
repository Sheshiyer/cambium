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

Local combined Worker:2,582,482 bytes, SHA256 `1f3b21a6de7c578e7251093c4058ed7c0dbd78e818031e0e9cc107a75ee082c7`. The stable full repository run passes2,690/2,693, leaving the same three baseline failure identities. GIT_OPTIONAL_LOCKS=0 prevents optional Git status-cache writes from contaminating the snapshot assertions; no source assertion is skipped. An earlier run with index snapshot races is retained separately. The selected native Swift identity suite passes47/47 with isolated temporary build output; the first Documents-based generated bundle encountered resource-fork signing metadata, which is not a source-code failure. The earlier authenticated candidate desktop/mobile proof covers the unchanged department frontend with real founder reads; it is not acceptance of this unuploaded backend candidate. No new authenticated post-promotion desktop/mobile result is claimed.

Before any newly approved upload, reread the actual current deployment, all52 binding configurations, runtime/global settings, current native release and accepted owner receipts. Stop on drift again. A combined upload and a later traffic assignment retain their separate gates.

Evidence: `artifact:departmental-live-integration-20261103/promote-version80-20261103/concurrent-release-drift.json`, `compatibility-inspection.json`, and the compatibility source receipt. The primary checkout, the original version80 branch and serving version82 remain intact.

## Current disposition

Owner choice resolved: preserve version82 and prepare this combined source. All external state remains unchanged by this task. The source/code and52-binding config are now concrete review artifacts, with a new exact upload gate and a later separate traffic gate. Version80 is retained as historical evidence, not selected for promotion after the newer native release was discovered. The requested ef6e0c74 rollback target remains recorded.
