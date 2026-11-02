# Native launch owner contract (`cambium.native-launch.v1`)

2 November 2026. Source contract for the `NativeLaunchCapability` owner seam named
in [ARCHITECTURE.md](ARCHITECTURE.md). The Worker source exists and has local
tests. The four routes (admissions, capability, launch, status) are wired in the Worker handler. No migration is applied,
no execution owner, admission issuer or native identity is bound, and nothing
is deployed. Nothing here launches real work yet.

Source:

- [`workers/quests/src/native-launch.ts`](../../../workers/quests/src/native-launch.ts): protocol types, injectable host, HTTP functions.
- [`workers/quests/src/native-launch-d1.ts`](../../../workers/quests/src/native-launch-d1.ts): D1 request authority.
- [`workers/quests/migrations/0099_native_launch_requests.sql`](../../../workers/quests/migrations/0099_native_launch_requests.sql): admission and request tables.

## Authority boundaries

| Concern | Owner | This contract |
| --- | --- | --- |
| Identity (tenant, principal) | Injected per-request verifier | Consumes the verified result only. Body identity, URL fields and a shared runner bearer are never identity. |
| Admission | A separate owner-reviewed writer of `native_launch_admissions` | Reads and revalidates. Never creates, extends or renews an admission. |
| Request record | D1 `native_launch_requests` | Sole authority. No KV shadow and no in-memory production store. |
| Execution | Injected plant owner (`temperance-hands` or `hermes-remote`) | Calls `submit` once from the winning reservation; reconciles with `read`. |
| Acceptance (semantic verdict) | Separate verifier | Always `not_evaluated` here. |

The three reply sections stay separate: `request` (durable transport/dispatch
state), `execution` (owner-reported state), `acceptance` (never decided here).

## Admission pins

A server-owned admission pins `workId`, `admissionRef`, `graphVersion`,
`loadoutId`, `inputDigest`, `executionPlant` (`temperance-hands` |
`hermes-remote`), `supportedAction` (`launch`) and `expiresAt`, scoped to one
tenant and principal. The pins are immutable in D1. The only permitted change is
`active → revoked`. One admission backs at most one launch request.

## Routes

All routes are `POST`, `Content-Type: application/json`, body ≤ 4096 bytes,
exact keys, and `contractVersion: "cambium.native-launch.v1"`. Errors carry
no stack, store text or credential. Without a configured verifier, D1 store
and execution owner every route returns `503 native_launch_unconfigured`.

### `POST /v1/native/launch/admissions`

Body: exactly `{ contractVersion, workId }`. Read only discovery of the already-admitted
units for one work. It uses the same verified `NativeLaunchHost` scope and the same
`native_launch_admissions` rows as the other routes. It never creates or renews an
admission, never changes the Goal Graph, and never calls `owner.submit` or claims an owner job.
Tenant and principal come only from the verifier.

Reply: `{ contractVersion, workId, readOnly: true, admissions, truncated }`.

- `admissions` holds at most 32 records, ordered by `admissionRef` ascending (deterministic).
  The D1 query is `WHERE tenant_id = ? AND principal_id = ? AND work_id = ? ORDER BY admission_ref LIMIT 33`;
  the 33rd row is read only to set `truncated: true` and is never returned.
- Each record is `{ admissionRef, tuple, availability, reason, existingRequest? }`. `tuple` is the exact
  eight-key capability tuple. Availability is derived from `store.readAdmission` plus `owner.supports`, the
  same rules as the capability route, with no inference from work status or transport health:

| `availability` | `reason` |
| --- | --- |
| `supported` | `current` |
| `unsupported` | `owner_does_not_support` |
| `unavailable` | `admission_expired`, `admission_revoked`, `graph_changed`, `admission_consumed` (with `existingRequest` of the consuming original IDs) |

- Foreign and absent work are indistinguishable: both return `200` with an empty `admissions` list.
- A store without the optional `listAdmissions` method returns `503 native_launch_listing_unconfigured`.
  It is never reported as an empty successful list.
- A store whose page lacks a `rows` array or a boolean `truncated` returns `503 native_launch_listing_unavailable`.
  A missing page is never reported as an empty work. Rows outside the verified scope or work stay omitted.
- Malformed JSON, extra keys (including any `principalId`/`tenantId`), a malformed `workId`, a wrong method,
  a wrong media type and bodies over 4096 bytes use the same refusals as the other routes.

A listing is an observation. The client must still call the capability route for the selected
`admissionRef`, and launch still revalidates atomically at reserve time.

### `POST /v1/native/launch/capability`

Body: `{ contractVersion, workId, admissionRef }`. Read only.

| `capability` | Meaning |
| --- | --- |
| `supported` | Exact current admission; the owner supports its plant and action. Returns `tuple`. |
| `unsupported` | Admission exists; the configured owner does not support its plant/action. |
| `unavailable` | `no_admission` (missing, foreign or other work; identical replies), `admission_expired`, `admission_revoked`, `graph_changed` or `admission_consumed` (with the consuming original IDs). |

`supported` is early feedback only. Launch revalidates atomically.

### `POST /v1/native/launch`

Body: `{ contractVersion, requestId, attemptId, idempotencyNonce, capability }`,
where `capability` is the exact eight-key tuple from the capability reply.

The client must durably persist `requestId`, `attemptId`, `idempotencyNonce`
and the tuple **before** sending, and reuse them for every resend and status call.

Server order:

1. Verify identity; validate shape; refuse an unsupported plant/action (`409 unsupported_plant_or_action`).
2. Derive `requestKey = nlr_<sha256(contract, tenantId, principalId, requestId)>` and `requestDigest` over attempt, nonce and tuple.
3. `store.reserve`: one conditional insert that revalidates the current admission (see below).
4. Only on `reserved`: call `owner.submit` with `idempotencyToken = requestKey`.
5. Record the owner observation; a thrown or malformed reply records `owner_unknown`/`unknown`.

| HTTP | `status` / `code` | Meaning |
| --- | --- | --- |
| 202 | `recorded` | Owner answered `accepted`/`queued`/`running`/`succeeded`/`failed`. |
| 429 / 409 | `recorded` | Owner answered `busy` / `refused`. |
| 503 | `unknown` | Reservation outcome or owner reply unknown. Recover by status only. |
| 200 | `duplicate` | Canonical resend; returns the original row; no owner call. |
| 409 | `conflict`: `request_changed`, `attempt_collision`, `nonce_collision`, `admission_consumed` | Reused identity with different values, or the admission is already used. |
| 409 | `refused`: `admission_not_current`, `pins_changed`, `admission_expired`, `admission_revoked`, `graph_changed` | No new request. |

### `POST /v1/native/launch/status`

Body: `{ contractVersion, requestId, attemptId }`. Never dispatches.

- Unknown or foreign request: `404 not_found` (identical replies). The native
  client may deliberately resend only its persisted original request after this
  exact status response, with the same capability, nonce, request and attempt IDs,
  and only while that original capability remains current. Status itself never sends.
- Wrong `attemptId`: `409 attempt_mismatch`.
- Terminal row (`succeeded`, `failed`, `refused`, `busy`): returned without an owner read; `retry: none`.
- Otherwise `owner.read(requestKey)`. A known state is persisted. `not_found`
  returns `owner_not_found` and changes nothing: a lost submit may still arrive.
  An unreadable owner returns `503 readback_unavailable`.

## Idempotency and concurrency

- Unique indexes per `(tenant, principal)` on `requestId`, `attemptId` and
  `idempotencyNonce`, and per `(tenant, admissionRef)`, plus the `requestKey`
  primary key, make concurrent reservations collide. Only the insert that wrote
  the row calls the owner. Tests prove that two concurrent HTTP submissions
  produce one owner call.
- **Current-admission CAS.** The reservation is a single
  `INSERT … SELECT … FROM native_launch_admissions JOIN goal_graph_heads WHERE …`.
  The row exists only if, at write time, the admission is `active`, unexpired,
  pinned exactly as the client claims, and the tenant Goal Graph head is at the
  pinned `graphVersion`. Reads after a losing insert only classify the refusal.
- **Exactly-once is not claimed.** The contract guarantees at most one
  `submit` call per durable request from this Worker. External exactly-once
  effects additionally need an owner whose `submit` is idempotent on
  `idempotencyToken`. No production owner exists yet.

## Crash windows

External dispatch never runs inside a D1 statement or batch.

| Window | Durable state | Recovery |
| --- | --- | --- |
| Reserve insert committed, response lost | `reserved` row | Resend with the same IDs → `duplicate`; or status. |
| After reserve, before `submit` | `reserved`, owner never called | Status returns `owner_not_found` on the existing row and stays unknown. This is not the `404 not_found` proof; the client cannot resend from it. Re-dispatch needs a separate owner-reviewed rule; none exists. |
| `submit` reached owner, reply lost | `reserved` or `owner_unknown` | Status reads the owner by `requestKey`. |
| Observation write failed | `reserved` | Status reconciles through the owner. |

## Swift admission discovery

`apps/cambium-mac/Sources/CambiumCore/AdmissionDiscovery.swift` provides `HTTPAdmissionDiscovery`
(`AdmissionDiscovering`). It posts the exact two-key body, pins the verified session across the
awaited request (a switched principal or tenant, an expired session or an unconfigured session is
`notAdmitted`), and strictly validates the reply: exact root and record keys, matching `workId`, the
tuple's work and `admissionRef` equal to the record's, at most 32 records, no duplicate refs, and a
`reason` consistent with `availability`. Server states map to explicit errors (`unauthorized`,
`forbidden`, `unavailable`, `unconfigured`, `responseTooLarge`, `malformedResponse`, `transport`).
`transport` always carries the fixed category `"transport"`; the underlying error text is never kept, because it
can hold tokens or URIs.
A result never grants a `LaunchCapability`: the client must call
`HTTPLaunchClient.resolveCapability` for the selected `admissionRef`.

## Swift integration

`HTTPAdmissionDiscovery` lists existing admissions read only. The selected
supported reference is resolved by `HTTPLaunchClient` to a fresh owner capability.
`LaunchCoordinator` persists the original capability, request ID, attempt ID and
nonce in `FileRecoveryStore` before transmission. Unknown replies use status only
with the original IDs. A status `404 not_found` proves the owner has no request row
for those IDs and permits an explicit resend of the saved original while its
capability is valid. A row with `owner_not_found`, an unreadable owner, a timeout,
or changed pins does not grant that resend. The native interface exposes the
original retry only from the proved-absent saved record, including after restart.
Neither read nor launch sends tenant or principal as body authority. Transport,
execution and semantic acceptance remain separate in the result.

## Integration status

The handler routes the exact paths in `NATIVE_LAUNCH_PATHS` through `nativeLaunchHttp` using the
injected optional `nativeLaunchHost`. An absent host returns 503. The handler
constructs no store and no execution owner.

Still unbound:

1. **Migration.** Confirm `0099` does not collide with a later number, then apply through the reviewed migration path. It depends on `goal_graph_heads` (0007).
2. **Host.** Bind `createNativeLaunchHost({ verify, store: d1NativeLaunchStore(env.BRIDGE_DB), owner, now })` in the deployed owner runtime. `verify` must resolve the founder through the reviewed native session into an explicit tenant. Bodies carry no tenant authority. Missing dependencies keep the host undefined and routes return 503.
3. **Owner.** Implement one `NativeLaunchExecutionOwner` per plant. It must treat `idempotencyToken` as an idempotency key and support `read` by `requestKey`. No arbitrary shell command, shared runner token or self-claimed Hermes lease.
4. **Admission writer.** A separate owner-reviewed path writes `native_launch_admissions`. Until one exists, every capability is `unavailable`.

## Unproved runtime bindings

Native authentication and credential exchange; principal→tenant binding for this
route; Cloudflare D1 behaviour of the single-statement CAS and unique-violation
errors (tested only on local SQLite); any idempotent execution owner for either
plant; the admission writer; migration application; real admitted
launch and result. The Swift client and its local restart/lost-response checks
are implemented, but those checks do not prove a deployed owner or real job.
