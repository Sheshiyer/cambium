# Native session current-identity dependency

Status: source review, 2026-11-02. Cambium native session source is locally
implemented and held unbound. This packet names the missing owner interface;
it does not register a client, grant authority, change another repository, or
activate a Worker.

## Current source evidence

- TeamForge `main` was inspected through the connected GitHub source at commit
  `80714a5642af622d4d86ecc0bf1b313f0844e490`. Its
  [`/v1/whoami` route](https://github.com/Sheshiyer/team-forge-ts/blob/80714a5642af622d4d86ecc0bf1b313f0844e490/cloudflare/worker/src/routes/v1.ts)
  requires a verified Cloudflare Access JWT. It returns 401 when that identity
  is absent and cannot answer a cookie-free native code exchange or bearer read.
- The [Plexus session source](https://github.com/Sheshiyer/team-forge-ts/blob/80714a5642af622d4d86ecc0bf1b313f0844e490/cloudflare/worker/src/lib/plexus-session.ts)
  resolves the request's Access email to an active identity. It has an internal
  ID query, but the inspected route surface does not expose a current,
  service-authenticated identity-by-ID answer. A repository search found no
  `getIdentityById` or `/v1/identity` route; this is source evidence, not a
  claim about every deployed or private service.
- Cambium's [`native-session.ts`](../../workers/quests/src/native-session.ts)
  requires `currentRole(founderId)` and `enrolledTenants(founderId)` on consent,
  code exchange and every bearer read. The production
  [`index.ts`](../../workers/quests/src/index.ts) does not compose a
  `NativeSessionHost`; unbound native routes return 503 in the local handler.
  Direct-origin live probes previously returned 404 for the native session
  path. Thus local route tests and a signed Mac bundle do not establish a
  usable live founder session.

## Interface the identity owner needs to provide

An owner-reviewed, service-authenticated lookup by opaque Plexus identity ID
must return only the current identity status, role and workspace binding needed
for the native session decision. It must be independent of the caller's browser
cookie and must not auto-provision a new identity. Every lookup must read
current authoritative state; a five-minute browser `whoami` cache is not a
revocation check. Unknown, inactive, mismatched-workspace, malformed,
unavailable and unauthorized results fail closed.

Cambium should map only an active `admin` identity to founder. It must bind the
returned identity ID exactly to the ID stored in the one-time code or session.
TeamForge's workspace ID is not a Cambium tenant ID: the selected tenant must
also be present in a separately reviewed, current founder-to-tenant enrollment
source. Neither a role alone nor a catalog record grants that enrollment.
Service authentication, call origin, response schema, freshness and revocation
semantics require an explicit owner contract before the adapter is coded.
Do not put a broad TeamForge Bearer token, Cloudflare service token, or browser
JWT into the Mac app.

## Cambium activation sequence after that contract exists

1. Implement and test the narrow service adapter against the pinned owner
   schema. Inject it as `currentRole` and an independently reviewed enrollment
   callback into `createNativeSessionHost`; fail closed on every error.
2. Register one exact native client ID/callback and bind the browser founder
   verifier, owner origin and D1 stores. Review migrations 0100/0101 against
   the target database before applying them in an approved rollout.
3. Compose the native session and launch hosts in the actual Worker entry point.
   Verify an enrolled founder's authorize, consent, code exchange, exact-tenant
   catalog, decision and already-admitted launch; verify role/tenant revocation,
   wrong client, replay, mixed credentials and cross-tenant denial.
4. Read back the deployed route and D1 state, capture rollback version and
   route/secret/binding reversal, and run real owner Mac acceptance. A 200
   health check or local test is not this proof.

No service route, owner enrollment authority, migration apply, client registry
or live founder session was changed by this source review.
