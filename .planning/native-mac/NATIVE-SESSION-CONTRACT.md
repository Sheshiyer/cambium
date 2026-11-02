# Native founder session contract

Status: admitted for local source implementation and tests; no live activation.
This is Cambium-owned delegated session transfer using an external browser and
PKCE S256. It is not a full OAuth authorization-server conformance claim.
Existing Cloudflare Access/Plexus founder identity and explicit founder/tenant
bindings remain the identity authority. No password store, shared runner token,
refresh token, browser-cookie extraction, or local operational shadow is added.

## Browser authorization

`GET /v1/native/session/authorize` accepts exactly `client_id`, `redirect_uri`,
`code_challenge`, `code_challenge_method=S256`, `state`, and optional `tenant`.
GET is deliberate: ASWebAuthenticationSession starts a browser navigation.
A mandatory browser founder verifier verifies Access/Plexus independently of
request body claims. A mandatory reviewed client registry names one exact
callback per client. Callback URI has no embedded credentials, query or fragment;
redirect matching is exact. Native dev callback scheme is a distinct reversed
Thoughtseed domain, separate from any later production registration.

S256 challenge is exactly43 base64url characters; verifier is43–128 RFC7636
unreserved characters. State is22–128 base64url characters and is echoed only
to the registered callback. The native client verifies state and the exact
callback scheme/host/path before exchanging a code. It keeps one outstanding
transaction and invalidates canceled/older callbacks.

Tenant is a candidate only: the owner selects from current explicit enrollment.
One enrolled tenant can be selected automatically; multiple without a choice
return409 `tenant_selection_required` with that authenticated founder's allowed
tenants. Foreign/unknown tenant returns the same403 refusal.

Successful authorization returns302 to the exact registered callback with
`code` and `state`. Code has at least256 random bits; only its SHA256 digest is
stored in D1. Code TTL is60seconds, measured after browser founder verification.
All responses use no-store and no-referrer. No code/token is logged.

## Code exchange and session

`POST /v1/native/session/exchange` accepts JSON of at most2048bytes with exactly
`contractVersion: cambium.native-session.v1`, `clientId`, `code`, `codeVerifier`,
and `redirectUri`. It does not require an Access browser cookie or Access JWT:
PKCE proves possession, and the saved code determines founder and tenant. The
owner independently rechecks that stored founder's current role and enrollment
through mandatory server-owned callbacks before granting a session. It must not
call a browser-request verifier on the cookie-free native exchange request.

The D1 adapter performs one conditional session INSERT SELECT matching code
hash, client, redirect, computed challenge and unexpired code. A unique code
reference/session key permits at most one session for a code even with parallel
exchange. No unsafe read-then-consume claim. SQL equality is not described as
cryptographic constant-time comparison. Losing or repeated exchange returns the
same invalid-grant response as wrong verifier/client/redirect/expired code.

Session token has at least256 random bits, is opaque, returned once, and lives
for at most15minutes. Only token digest is stored. Session binds exact client,
founder and selected tenant. Code/session metadata is separate from operational
Goal Graph/decision/launch authority. An optional cleanup function may remove
expired records locally in tests; no scheduler is activated by this packet.

Exchange200 body: `contractVersion`, `token`, `tokenType: Bearer`, `expiresAt`,
`founderId`, `tenantId`, `clientId`, `role: founder`, `enrolled: true`.
`GET /v1/native/session` takes native bearer and returns the same scope/expiry
fields without token. `POST /v1/native/session/logout` takes native bearer and
empty JSON object, revoking only that session. Server-only revocation may be
provided as a store method; no new public admin/revoke route is required.

Errors contain contractVersion and a bounded categorical error, never raw
credentials, callback URL, headers, store errors, or request bodies. Invalid
request/client/grant400; unauthorized401; forbidden403; tenant selection409;
unconfigured503. Client registry, browser verifier, current-role lookup,
enrollment lookup, clock/randomness and store are mandatory owner bindings.
Missing any makes the factory return undefined and routes503.

## Authority-preserving resolution

Native bearer uses a distinct token prefix/realm, so unrelated existing bearer
users are not reinterpreted. A request presenting a native bearer and browser
credential is refused. Invalid native bearer never falls back to web identity.
Existing browser CSRF header/origin checks remain unchanged. Native bearer does
not require web-only CSRF headers. Every authenticated native read/action checks
current founder role, current enrollment, session expiry and revocation.

Adapters expose this verified scope to canonical Founder Gate, Mission Fabric
and native launch for the session's exact tenant only. Never accept body
founder/principal or a different tenant as authority. Native decision receipts
should identify a native channel instead of falsely labelling the surface
curious; additive source typing must preserve existing channel behavior.
No general member/admin/provider routes gain native access by default.

The native side composes existing SessionProvider/RequestAuthorizer/HTTPTransport
without changing the existing NativeSession enum constructor contract. Its actor
holds token and client metadata privately in memory, checks origin, client,
tenant, role and expiry before publishing a verified session, and redacts debug
descriptions. Logout/context switch invalidates pending generations and data
caches. Recovery references survive separately but confer no identity.

## Verification and activation

Backend tests use synthetic verifier/role/enrollment/registry and local SQLite
only. Falsify parallel/replayed exchange, changed verifier/client/redirect,
expiry, role/enrollment revocation, missing host, mixed credentials and leaks.
Native tests use injected browser/transport and RFC7636 vector, canceled/late
callback, wrong state/origin/redirect, lost exchange, logout and expiry. Successful
wire credentials stay inside tests and are not public runtime fixtures.

Actual Access-protected origin, registered callback, owner current-role lookup,
reviewed D1 migration and concrete launch execution owner remain separately
configured and unproved. No live browser grant or production migration is run
for local verification.

Primary references: [RFC8252](https://datatracker.ietf.org/doc/html/rfc8252),
[RFC7636](https://datatracker.ietf.org/doc/html/rfc7636). This contract corrects
GET browser navigation, cookie-free exchange, and current-role lookup explicitly.
