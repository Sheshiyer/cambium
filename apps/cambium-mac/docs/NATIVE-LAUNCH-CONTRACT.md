# Native launch owner contract (`cambium.native-launch.v1`)

2 November 2026. Source contract for the `NativeLaunchCapability` owner seam named
in [ARCHITECTURE.md](ARCHITECTURE.md). The Worker source exists and has local
tests. It is **not wired** into the Worker handler, has no applied migration,
no bound execution owner and no admission writer. Nothing here launches real
work yet.

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

- Unknown or foreign request: `404 not_found` (identical replies).
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
| After reserve, before `submit` | `reserved`, owner never called | Status reads `not_found` and stays unknown. Re-dispatch needs a separate owner-reviewed rule; none exists. |
| `submit` reached owner, reply lost | `reserved` or `owner_unknown` | Status reads the owner by `requestKey`. |
| Observation write failed | `reserved` | Status reconciles through the owner. |

## Swift integration (future)

`LaunchClient` should model `NativeLaunchCapabilityTuple`, persist
`{requestId, attemptId, idempotencyNonce, tuple}` in `LocalState` before
sending, map `unknown`/timeout to status recovery, and offer another launch only
after a terminal readback. `RunClient` uses `/status` with the original IDs.
Neither ever sends tenant or principal in a body.

## Integration instructions (not yet done)

1. **Migration.** Confirm `0099` does not collide with a later number, then apply through the reviewed migration path. It depends on `goal_graph_heads` (0007).
2. **Handler deps.** Add an optional `nativeLaunchHost?: NativeLaunchHost` to `HandlerDeps` in `workers/quests/src/handler.ts`.
3. **Route.** In `handle()`, beside the `/v1/founder/*` branch, match the three paths in `NATIVE_LAUNCH_PATHS`, build a `Request` exactly as that branch does, call `nativeLaunchHttp(request, host)` and map its status, headers and text.
4. **Host.** Build the host with `createNativeLaunchHost({ verify, store: d1NativeLaunchStore(env.BRIDGE_DB), owner, now })`. `verify` must resolve the founder through `resolveFounderWebSigner` and map it to one tenant using an explicit reviewed binding, as `founderBindings` does. Because launch bodies carry no tenant, the binding must name exactly one tenant per principal, or a header-free tenant selector must be designed and reviewed. If any dependency is missing, pass `undefined`; the routes then return 503.
5. **Owner.** Implement one `NativeLaunchExecutionOwner` per plant. It must treat `idempotencyToken` as an idempotency key and support `read` by `requestKey`. No arbitrary shell command, shared runner token or self-claimed Hermes lease.
6. **Admission writer.** A separate owner-reviewed path writes `native_launch_admissions`. Until one exists, every capability is `unavailable`.

## Unproved runtime bindings

Native authentication and credential exchange; principal→tenant binding for this
route; Cloudflare D1 behaviour of the single-statement CAS and unique-violation
errors (tested only on local SQLite); any idempotent execution owner for either
plant; the admission writer; migration application; Swift client; real admitted
launch and result.
