# Native identity contract (cambium.native-session.v1)

Status: server source and local tests exist. Handler wiring, the 0100 and 0101
migration applies, client registration and any live browser grant have not been
done. Reviewed contract: `.planning/native-mac/NATIVE-SESSION-CONTRACT.md`.

Source: `workers/quests/src/native-session.ts` (routes, resolver, factory),
`workers/quests/src/native-session-d1.ts` (D1 store),
`workers/quests/migrations/0100_native_sessions.sql`, and
`workers/quests/migrations/0101_native_consent.sql`.

The Mac app gets a short delegated founder session through an external browser
and PKCE S256 (RFC 8252, RFC 7636). It is not an identity authority. Access or
Plexus verifies the founder in the browser. Every exchange and every session
read re-checks that founder's current role and explicit tenant enrollment
through server callbacks. There is no refresh token, no client secret, and no
cookie extraction.

## Credentials

| Value | Format | Lifetime | Stored as |
| --- | --- | --- | --- |
| Authorization code | `cnc1_` + 43 base64url chars (256 random bits) | 60 s from issue | SHA-256 hex |
| Session token | `cns1_` + 43 base64url chars (256 random bits) | 15 min from exchange | SHA-256 hex |

The server treats an `Authorization` header that contains `cns1_` or `cnc1_`
as the native realm. Other bearer values are not touched. A native-realm header
that is malformed, unknown, expired, revoked, or sent together with a browser
credential (`cf-access-jwt-assertion`, `x-telegram-init-data`, or a
`CF_Authorization` cookie) is refused. The server never falls back to browser
identity for it.

## Wire payloads

Dev client registration (one exact callback per client):

- `client_id`: `space.thoughtseed.cambium.native.dev`
- `redirect_uri`: `space.thoughtseed.cambium.native.dev://oauth/callback`

This is the callback the normative `.planning/native-mac/NATIVE-SESSION-CONTRACT.md`
and the Swift client register: scheme `space.thoughtseed.cambium.native.dev`,
host `oauth`, path `/callback`. A callback must use a reversed
Thoughtseed-domain private scheme followed by `//`, a lowercase host, and one
or more non-empty path segments. It may not contain userinfo, a port, a query,
a fragment, percent-encoding, or `.`/`..` segments. Other schemes are refused.
The registry match is exact string equality, so a shape-valid callback still
fails unless it is the registered one.

Generated wire vector: `workers/quests/src/fixtures/native-session-wire.v1.json`.
The test `native identity wire fixture equals real handler output` drives
authorize, exchange, read and logout through the real handlers with fixed
synthetic randomness (consent draws precede code bytes `0x02` and token bytes
`0x03`) and a
clock with fractional milliseconds, then compares the result to the file. The
values are synthetic and are not credentials. The file holds no
`Authorization` header. The client builds `Bearer <token>` itself. Regenerate
with `NATIVE_SESSION_WRITE_FIXTURE=1 node --test workers/quests/src/native-session.test.ts`.

### 1. Authorize: `GET /v1/native/session/authorize` and `POST /v1/native/session/authorize`

Opened in `ASWebAuthenticationSession`.
- `GET /v1/native/session/authorize`: validates existing verified founder, client, redirect, challenge, state and tenant, then stores a short-lived one-time consent intent and returns `200` with an HTML consent form and a Secure SameSite=Strict HttpOnly cookie (`cambium_native_consent`). It writes no authorization code.
- `POST /v1/native/session/authorize`: requires the same Access founder and current role/enrollment, exact intent bound to all GET inputs, CSRF token matching the secure cookie plus hidden form field. Atomically consumes the intent in D1 once, then mints an authorization code and returns `302` with `Location: <redirect_uri>?code=cnc1_…&state=<state>`. Any replay, cross-founder, changed challenge, client, tenant, redirect or state, expired intent, missing cookie/CSRF, or direct POST returns categorical refusal (`400` `consent_required`) and zero code writes.

The query takes exactly these parameters, each once:

| Parameter | Rule |
| --- | --- |
| `client_id` | registered client |
| `redirect_uri` | that client's exact callback |
| `code_challenge` | `BASE64URL(SHA256(verifier))`, exactly 43 chars |
| `code_challenge_method` | `S256` |
| `state` | 22–128 base64url chars, fresh per attempt |
| `tenant` | optional; nominates one tenant from current enrollment |

On success the server returns `302` with
`Location: <redirect_uri>?code=cnc1_…&state=<state>`. If the founder has one
enrolled tenant, the server selects it. If the founder has several and no
`tenant` was sent, the server returns `409`:
`{"contractVersion":"cambium.native-session.v1","error":"tenant_selection_required","tenants":["…"]}`.
The client then restarts with `tenant` set.

### 2. Exchange: `POST /v1/native/session/exchange`

No cookie, no Access header, and no `Authorization` header. A request that
carries a `CF_Authorization` cookie, `cf-access-jwt-assertion`,
`x-telegram-init-data`, or any `Authorization` value is refused with `400`
`mixed_credentials` before the browser verifier or the store runs.
`Content-Type: application/json`, body of at most 2048 bytes, with exactly
these keys:

```json
{
  "contractVersion": "cambium.native-session.v1",
  "clientId": "space.thoughtseed.cambium.native.dev",
  "code": "cnc1_…",
  "codeVerifier": "<43-128 RFC 7636 unreserved chars>",
  "redirectUri": "space.thoughtseed.cambium.native.dev://oauth/callback"
}
```

Response `200`:

```json
{
  "contractVersion": "cambium.native-session.v1",
  "token": "cns1_…",
  "tokenType": "Bearer",
  "expiresAt": "2026-11-02T00:45:00.000Z",
  "founderId": "<Access/Plexus founder ID>",
  "tenantId": "<selected tenant>",
  "clientId": "space.thoughtseed.cambium.native.dev",
  "role": "founder",
  "enrolled": true
}
```

### 3. Read: `GET /v1/native/session`

Send `Authorization: Bearer cns1_…`. The `200` body has the same fields as the
exchange response, without `token`.

### 4. Logout: `POST /v1/native/session/logout`

Send `Authorization: Bearer cns1_…`, `Content-Type: application/json`, and the
body `{}`. Response `200`: `{"contractVersion":"cambium.native-session.v1","revoked":true}`.
Only that token is revoked. Other sessions keep working.

## Errors

Every error body is `{"contractVersion":"cambium.native-session.v1","error":"<code>"}`,
plus `tenants` on 409 or `retry` on an ambiguous exchange failure. Bodies never
include URLs, headers, store errors, request bodies, codes, or tokens. All
responses send `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

| Status | `error` |
| --- | --- |
| 400 | `invalid_request`, `invalid_client`, `invalid_grant`, `mixed_credentials` |
| 401 | `unauthorized` |
| 403 | `forbidden` (role or enrollment missing, or a foreign tenant) |
| 405 / 413 / 415 | `method_not_allowed` / `input_too_large` / `json_required` |
| 409 | `tenant_selection_required` |
| 503 | `native_session_unconfigured`, `native_session_unavailable` |

A replayed, expired, or lost code, or a wrong verifier, all return the same
`invalid_grant`.

Stored rows are untrusted. An impossible timestamp (for example month 13 or
hour 25) or a malformed founder, tenant, or client value refuses with
`invalid_grant` (exchange) or `401` (read). A clock that returns such a value
yields `503`. Nothing throws a 500. After the awaited role and enrollment
lookups, the server re-reads the unused code (exchange) or the live session
(read) at a fresh clock. A code consumed, or a session revoked or expired,
during that wait is refused.

## Client rules

- Keep one authorization transaction open at a time. Discard callbacks that were canceled, arrive late, or belong to an older transaction.
- Check the callback scheme and path and the `state` value before you exchange.
- Never resend an exchange. If the response is lost or the server returns `503` with `"retry":"restart_authorization"`, start a new authorization. The code is single-use, so it can never create a second session.
- Keep the token in actor memory only, redact it from debug output, and drop it at `expiresAt`, on logout, or when you switch context. A `401` or `403` from a native route ends the session.

## Runtime bindings required before activation

`createNativeSessionHost` returns `undefined`, and every route returns `503`
`native_session_unconfigured`, unless all of these bindings are supplied and
valid:

- `verifyBrowserFounder(request)`: the existing Access/Plexus founder verifier for browser navigation.
- `currentRole(founderId)` and `enrolledTenants(founderId)`: owner-backed lookups for the current role and explicit enrollment.
- `clients`: the reviewed client registry.
- `store`: `d1NativeSessionStore(env.DB)`, after the 0100 migration has been reviewed and applied.
- `now()`, which must return canonical ISO `…sss Z`, and `randomBytes`, for example `standardNativeRandom`.
- `ownerOrigin`: the exact HTTPS origin.

These steps remain unproven: the Access-protected origin, the registered
callback, the owner's role lookup, the migration apply, and handler
composition, where the router calls `resolveNativeSession` before any browser
auth.

## Handler Composition

- **Exact Routing**: Native session routes (`NATIVE_SESSION_PATHS`), native launch routes (`NATIVE_LAUNCH_PATHS`), canonical founder gate (`/v1/founder/{proposal,decision,status,renew}`), and exact-tenant Mission Fabric (`/v1/mission-fabric/{tenant}`) dispatch before generic routes.
- **Host Binding**: The incoming request Host header must exactly match the host of the configured `ownerOrigin`. Mismatched or missing hosts are refused with `400` (`invalid_request`).
- **Unbound State**: Without an explicit `nativeSessionHost` binding, all session routes return `503` (`native_session_unconfigured`) before any lookup.
- **Founder Scoping**: Native founder gate requests construct a scoped access host locked to the exact resolved founder ID and tenant ID, bypassing body tenants and browser fallback, with a pre-write re-verification guard.
- **Route Fencing**: Native bearer tokens accessing unsupported routes are early-refused with `403` (`native_route_unsupported`), preventing global auth elevation.

