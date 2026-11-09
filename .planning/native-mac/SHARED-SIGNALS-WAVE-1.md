# Shared signal capture / native Inbox — wave 1 contract

Owner requested implementation and hosted Phloem fan-out on 3 November 2026.
Scope: repository source, local D1/HTTP/native proof; no production migration,
deployment, account configuration or external Field Report repository mutation.
ISA owns acceptance. This manual task batch is distinct from injected next-wave
proposals and does not claim their approval receipts.

## Wire agreement

`GET /v1/signals/{tenant}` lists up to 100 scoped signals, newest first. Optional
`projectId` filters by exact canonical catalog identity; `cursor` is an opaque
bounded pagination token. Response:

```json
{"schema":"cambium.signal-list.v1","tenantId":"cambium","principal":"verified-founder","signals":[],"nextCursor":null}
```

`POST /v1/signals/{tenant}` captures a signal:

```json
{"schema":"cambium.signal-capture.v1","operationId":"caller-generated-uuid","title":"A bounded observation","body":"Selected evidence and context","source":{"system":"cambium-native","recordId":"caller-generated-source-uuid","version":"1","reference":"https://example.invalid/observation","observedAt":"2026-11-03T00:00:00.000Z"},"projectIds":["sapling:cambium"]}
```

Source system is `cambium-native` or `field-report`; reference may be null for
an original observation. Project IDs may be empty for Inbox capture. Each
nonempty association must exist in the current server-side display catalog,
without claiming an operational Work join. Preserve shared workspace membership
and canonical-parent records; do not infer tenant grants from catalog metadata.
Use the verified founder's exact tenant and current authorization for every
operation. This first slice uses native bearer authentication; the future Field
Report surface requires its own reviewed authentication adapter, not a synthetic
identity header. Native requests may declare `field-report` as source provenance;
that field is attribution, never producer authentication or execution authority.

`GET /v1/signals/{tenant}/{signalId}` reads one scoped signal.
`PUT /v1/signals/{tenant}/{signalId}` updates title/body/projectIds using
`{schema:"cambium.signal-update.v1",operationId,expectedRevision,title,body,projectIds}`.
Source provenance is immutable after capture.

Create returns 201 (200 for identical operation replay); update returns 200.
Both return `{schema:"cambium.signal-result.v1",tenantId,principal,signal,replayed}`.
Signal shape: `{id,tenantId,principal,title,body,source,projectIds,revision,createdAt,updatedAt}`.
Revision starts at 1. Timestamps use canonical ISO UTC milliseconds.
Different content under the same operation identity returns 409. Revision
conflicts return 409 without overwriting. Receipts and record writes must be
atomic in D1; after a lost response, the same operation can be retried safely.

Limits: title 200 characters; body 16000; at most 16 unique project IDs;
operation/source IDs and source version 128 characters; reference 2048; HTTP
body at most 64 KiB; response at most existing transport cap. Refuse unknown
fields, malformed dates, credential-bearing/unsafe references, foreign scope,
mixed credential headers and malformed URL/path/query input. Error responses
use fixed codes and do not echo source bodies. JSON is private/no-store.

## Native experience

Add Inbox navigation with list, detail, capture form and exact mapped-project
picker. Preserve existing Command-1..9 and Command-0 shortcuts; Inbox must not
reuse one. Show original provenance, saved/error/loading/empty states and
project associations. Projects dossier opens the corresponding filtered Inbox.
Use the served mapped catalog; no manually copied project list. An unattached
signal remains valid. Catalog association does not admit or launch work.

Standard mode uses existing identity, authorizer and transport. Demo uses a
labelled synthetic in-process owner. Scope change/sign-out invalidates in-flight
results. Keep a failed save's operation ID and content available for exact retry;
editing after uncertain save needs explicit reconciliation or a new operation.
Do not silently implement durable offline sync in this first source slice;
preserve user input and show its unsaved state. Full offline outbox is next tranche.

## Ownership and verification

- Backend worker owns new signal domain/store/tests, migration `0102_shared_signals.sql`,
  and scoped signal composition changes in `handler.ts`/`index.ts`.
- Native worker owns `Sources/CambiumCore/Signals.swift`, its tests, native state,
  views, simulator, Inbox tests and related snapshot page registration.
- Orchestrator owns this contract, integration, ISA and handoff. Workers must
  preserve concurrent work and not modify host/provider/routing state or spawn
  further workers. Worktrees start at committed HEAD; current dirty catalog is
  tested after integration and is never replaced by worker copies.

Boundary evidence: no identity/store, cross-tenant ID guesses, revoked identity,
invalid project IDs, exact replay/changed replay, revision races, pagination,
actual SQLite schema/store, native body/response decoding, scope switch while
loading/saving, dynamic mapped project picker, and labelled demo capture/read.
Real Field Report peer and standard-mode live delivery remain separate proof.
