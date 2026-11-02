# Native identity contract (cambium.native-session.v1)

Status: server source and local tests exist. Handler wiring, the 0100
migration apply, client registration and any live browser grant have not been
done. Reviewed contract: `.planning/native-mac/NATIVE-SESSION-CONTRACT.md`.

Source: `workers/quests/src/native-session.ts` (routes, resolver, factory),
`workers/quests/src/native-session-d1.ts` (D1 store),
`workers/quests/migrations/0100_native_sessions.sql`.

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
- `redirect_uri`: `space.thoughtseed.cambium.native.dev:/native-session/callback`

A callback must use a reversed Thoughtseed-domain private scheme with the
single-slash path form. It may not contain an authority, userinfo, query,
fragment, or dot segments. Matching is exact.

### 1. Authorize: `GET /v1/native/session/authorize`

Opened in `ASWebAuthenticationSession`. The query takes exactly these
parameters, each once:

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

No cookie and no Access header. `Content-Type: application/json`, body of at
most 2048 bytes, with exactly these keys:

```json
{
  "contractVersion": "cambium.native-session.v1",
  "clientId": "space.thoughtseed.cambium.native.dev",
  "code": "cnc1_…",
  "codeVerifier": "<43-128 RFC 7636 unreserved chars>",
  "redirectUri": "space.thoughtseed.cambium.native.dev:/native-session/callback"
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
