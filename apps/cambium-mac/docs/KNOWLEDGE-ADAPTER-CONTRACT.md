# Knowledge adapter contract (native, read-only)

Scope: `KnowledgeClients.swift` in `CambiumCore`.

## Schemas are Cambium's own

| Source | Schema string |
| --- | --- |
| Field Theory | `cambium.native-field-theory-reference.v1` |
| Field Report | `cambium.native-field-report-reference.v1` |

These are a native transfer format proposed by this app. They are not the wire
schema of any external Field Theory or Field Report product, and nothing here
claims an external source emits them. A producer that wants to feed the app
must export this shape. Ownership of the format stays with Cambium until a
producer adopts it in a separate, reviewed change.

## Record shape

`{"records":[{id, source, schema, subjectId, tenantId, principal, sourceRef, observedAt, freshness, gaps, meaning}]}`

- `source` and `schema` must match the reader that decodes them. A Field Report
  export never decodes as Field Theory, and the reverse.
- `meaning` is `proposal` or `observation`. Neither is an admission.
- `sourceRef` is citation metadata only. It is never fetched, executed, or used
  as authority. Allowed: `http(s)` without credentials, `thoughtseed:`, `vault:`,
  `git:` with no `..`.
- `observedAt` and `freshness` are source facts. They stay separate from the
  app's cache age.

## Reader context and expiry

`AuthenticatedReaderContext` comes only from a verified session. The public
decoders reject an expired context (`KnowledgeError.expiredContext`), and
reject records whose tenant or principal differ from the context.

## Cache

`KnowledgeSnapshotStore` and `MissionFabricSnapshotStore` hold memory only.
`cacheTTL` defaults to 60 seconds. A hit also requires the original context
expiry to be in the future and the current session to match principal and
tenant. A renewed session does not extend an earlier context. An expired or
mismatched entry returns nil and needs a fresh read. Context switch or sign-out
calls `invalidate()`, which also defeats any load still pending.

## Errors

`KnowledgeError` payloads are fixed category strings (for example
`unsafeReference("credentials")`). They never echo export text or a bad
reference.

## Live bridges

Live Field Theory and Field Report bridges are unconfigured.
`UnconfiguredFieldTheoryReader` and `UnconfiguredFieldReportReader` always
refuse. The Supplied readers decode caller-provided `Data` only: no filesystem,
vault, CLI, Rhai, or memory writes, and no global session store.
