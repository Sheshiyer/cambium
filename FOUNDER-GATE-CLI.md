# Founder Gate CLI — issue 393 local vertical slice

Run with Node 26 from this isolated checkout. No installation is needed.

## Existing host prerequisite

The server must serve the existing /founder/api/quests/:tenant and /founder/api/gate/:tenant routes from PR389 and verify Cloudflare Access plus TeamForge founder role. Use an already-established founder Access JWT session supplied through CAMBIUM_ACCESS_JWT. It is sent as the CF_Authorization cookie, which the existing server supports and which permits the Access edge to evaluate the session. No token value is printed. The existing server also currently requires its Gate configuration and D1 store to be present, even on the Access path. The CLI does not enroll an identity, obtain a token, alter Access, configure a service token, store credentials, or accept a shared bearer as founder identity. Do not paste credentials into command arguments or reports. CAMBIUM_ORIGIN defaults to the Curious HTTPS origin; CAMBIUM_TENANT defaults to thoughtseed.

## Commands

```sh
node bin/founder-gate.mjs --help
node bin/founder-gate.mjs read DIGEST
node bin/founder-gate.mjs approve DIGEST --version VERSION --expiry 'EXACT_EXPIRY_FROM_READ' --confirm 'EXACT_APPROVE_CONFIRMATION_FROM_READ'
node bin/founder-gate.mjs reject DIGEST --version VERSION --expiry 'EXACT_EXPIRY_FROM_READ' --confirm 'EXACT_REJECT_CONFIRMATION_FROM_READ'
node bin/founder-gate.mjs status DIGEST
```

Replace DIGEST, VERSION and quoted placeholders with values from the authenticated read. Read displays the server-owned proposal, founder inspect, summary, consequence, reversibility, nonce/expiry/head/fence and exact approval/rejection confirmation strings. Every decision performs a fresh read and fails before POST if the reviewed version, expiry, confirmation or founder inspect changed. The stable key is decision-kind + tenant + change digest; the existing server remains the signer/authenticator and canonical D1 authority. No local ledger is created.

An acknowledged response must explicitly contain ok plus committed/rejected before the CLI reports a decision. A timeout or uncertain response causes one read-only reconciliation attempt and exits with status unknown (exit 2); there is no automatic retry of a decision. Existing status history is labeled canonicalReadback:false because it is a KV projection. A missing row is unknown, never rejected or safe-to-retry. Exact D1 uncertain-outcome recovery requires the new canonical status host binding in this patch; it is not presently configured. Do not infer success from projected UI history alone.

## Proof and remaining operations

Offline tests inject synthetic sessions and responses. No live request or decision has been performed. These commands are locally runnable source, not a verified live end-to-end claim. To enable the new canonical status/plugin route, review a server-owned proposal resolver and canonical founder/tenant mapping against verified Access/Telegram/OAuth identity, wire founderDecisionHost, and separately authorize deployment. Production Cortex still needs reviewed founder-bound OAuth source reconciliation; shared bearer authentication alone cannot authorize a founder decision. No credential enrollment, policy change or deployment is required or performed merely to run the offline tests/help command.

## Read-only smoke commands

Zero-network smoke (no credential needed): `node bin/founder-gate.mjs --help`.
Authenticated proposal smoke, only if the environment already contains the existing session: `node bin/founder-gate.mjs read DIGEST` (replace DIGEST with a known proposal digest). This sends GET only; it neither creates a session nor approves anything. No live smoke was executed in this task.

Review: CLI sends same-origin Origin and x-cambium-founder-web:1; Fetch supplies the destination Host. No Sec-Fetch-Site is forged. The server checks Origin/Host and independently verifies Access JWT plus TeamForge founder role for decisions. Redirects fail before forwarding the cookie. Session values are not in argv, logs, files or exceptions. HTTP errors omit remote bodies; malformed or mismatched success responses remain unknown. Read/status contain no POST path. Session acquisition is deliberately outside this tool.

Verification commands: `npm test` is the repository's full suite (not run in this sparse checkout); the isolated suite is `node --test bin/founder-gate.test.mjs workers/quests/src/founder-decision.test.ts workers/quests/src/goal-graph-store.test.ts workers/quests/src/goal-graph/*.test.ts`. The installed Cortex compiler's strict core check reports the same missing node:crypto declarations on both base 664b94b and this candidate; see founder-typecheck-base.txt and founder-typecheck.txt. No dependency installation was attempted.

Independent-review fixes: exact confirmation now includes nonce/head/fence and a canonical SHA-256 fingerprint of the entire reviewed row, including founder inspect and informed consequence text. Rejection acknowledgement must carry the exact approvalNonce; older servers omitting it are treated as unknown. The patch adds that response field to the existing rejection path. 514 focused and existing-route tests pass. Deployment remains held for parent independent-review clearance.
