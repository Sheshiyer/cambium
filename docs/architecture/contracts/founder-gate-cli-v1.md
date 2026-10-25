# Founder Gate: one reviewed CLI decision

Source-only follow-up to #395. No deployment, binding enrollment, live proposal decision, or business execution is authorized by this patch. Existing UI, Telegram, evidence-candidate and growth paths retain their existing behavior. The selected vertical slice is the existing CLI over the canonical decision service; voice/plugin enrollment is deferred.

## Flow

One existing Access session → one stored Telegram Goal Graph proposal → one exact approve/reject confirmation → one D1 receipt. There is no second channel confirmation. Read and status calls never decide or dispatch execution.

From the reviewed checkout, with `CAMBIUM_ACCESS_JWT` supplied privately from an existing founder Access session, set the non-secret origin and exact authorized tenant. Do not put session values in commands, logs or review artifacts.

```sh
export CAMBIUM_ORIGIN=https://curious.thoughtseed.space
export CAMBIUM_TENANT=cambium
node bin/founder-gate.mjs read "$DIGEST"
```

Inspect the returned `proposalId`, `version`, `expiresAt`, summary and complete `review` (including Inspect, consequences, reversibility, expected head and fence). Choose one decision only. Copy its exact returned confirmation; do not generate it from broad direction or automatically pipe the read into approval.

```sh
node bin/founder-gate.mjs approve "$DIGEST" --version "$VERSION" --expiry "$EXPIRY" --confirm "$REVIEWED_APPROVE_CONFIRMATION"
# Or reject, using rejectConfirmation from the same review:
node bin/founder-gate.mjs reject "$DIGEST" --version "$VERSION" --expiry "$EXPIRY" --confirm "$REVIEWED_REJECT_CONFIRMATION"
node bin/founder-gate.mjs status "$DIGEST"
```

The three canonical routes use POST JSON: `/v1/founder/proposal` accepts exactly `{proposalId}`; `/v1/founder/decision` and `/v1/founder/status` accept the existing seven-field decision envelope. `proposalId` is `TENANT:CHANGE_DIGEST`. Status uses the actual stored nonce/version/expiry and never writes a decision. `canonicalReadback:true` identifies an authoritative D1 query; settlement additionally requires an approved/rejected status and a fully bound receipt. Pending means the authoritative query found no decision; it does not prove a failed or delayed write can safely be resubmitted. Unknown responses exit the CLI with code 2.

An uncertain decision response triggers one status read of the original tuple, with no new proposal fetch or decision submission. If that also fails, use status later. If the proposal tuple changed or disappeared, stop and reconcile the original `(tenant, changeDigest, nonce)` receipt in D1 through an authorized operator; do not resubmit. A conflict is final for that tuple. A rejected proposal needs a new reviewed proposal to reconsider.

## Review and cross-channel consistency

The CLI independently recomputes the exact confirmation from the complete displayed review and validates its descriptor tuple. A response must explicitly carry `canonicalReadback:true` before the CLI accepts either a settled receipt or authoritative pending result. Historical receipts with `channel:null` remain readable and explicitly unattributed; the client never invents a channel.

The existing public pending list, founder decision history and internal Telegram Gate list now derive supported proposal decisions from D1 receipts, even when the KV task remains pending. Read paths do not repair KV or submit another decision. Stored ledger pending rows are discarded before deriving the fresh list; an unavailable or inconsistent D1 read cannot advertise an actionable pending proposal. Evidence candidates retain their existing projection rules.

A legacy approval retry can still return HTTP 409 and mark its KV task stale after a canonical decision has committed. Canonical proposal/status reads and idempotent decision recovery now remain available for that stale task only if D1 holds the exact existing receipt for the verified founder, tenant, digest, intent version, nonce and expiry. Full stored-review and change-set validation still applies. Missing or mismatched receipts remain forbidden; unavailable D1 remains unknown/503. Recovery returns the original receipt, including after expiry, without another decision write or KV repair. Stale tasks without a receipt cannot obtain new decision authority.

The service checks expiry again after reading the graph head and gives either writer one consistent decision timestamp. D1 rejects a first rejection at or beyond expiry. Existing immutable decisions remain readable after their approval window closes.

## Runtime prerequisites remaining

1. Review and publish this candidate through a separately approved release. These source changes are not running on production. The handoff's observed deployed version is `d362a432-b650-451e-83e7-6bcc2121b288`; rollback target is `15622021-5fad-48e0-a0f2-4dc6ff9b6943`. Both must be refreshed before any future release operation.
2. The existing Worker needs `BRIDGE_DB` with Goal Graph migrations `0007_goal_graph.sql` and `0009_goal_graph_operational_anchors.sql`, including approvals/events/heads/nodes and atomic batch support. No new ledger or migration is introduced. `QUESTS` must contain the existing server-owned intake task at `goal-graph-intake-task:TENANT:CHANGE_DIGEST`.
3. Existing `TF_ACCESS_TEAM_DOMAIN` and `TF_ACCESS_AUD` must match the session issuer and application audience. The existing Plexus whoami endpoint (default, or `PLEXUS_WHOAMI_URL`) must accept the verified session and resolve a matching active admin/founder identity. Access login alone grants no action authority. Existing JWKS and whoami availability/caching behavior is retained.
4. Add a separately reviewed Worker setting `FOUNDER_GATE_BINDINGS_JSON`: a nonempty JSON array of exact `{founderId,tenantId}` pairs. Use the verifier's existing opaque D1 approver format `access:IDENTITY_ID`; an email-derived identity uses the existing `access:sha256:HEX_DIGEST` format. No wildcard, client-supplied identity, example principal, or inherited `tenant:'*'` grants scope. This patch installs no real binding. Missing/malformed bindings, D1 receipt methods or Access configuration leave the canonical host unavailable with HTTP 503 and an actionable explanation.
5. Have one existing unexpired founder Access JWT for the configured audience. The CLI sends it as the Access cookie over HTTPS with same-origin and founder-web headers. No bridge bearer, Telegram initData, local dev fallback or new auth service is used on this path. Canonical routes verify identity inside the Worker; this patch does not modify edge Access policies.
6. Supply an existing supported stored Telegram Goal Graph proposal with intact Inspect/change-set digest, intent version, graph version/fence, expected head, nonce, and unexpired approval window. Evidence candidates remain on their existing path. A moved head or changed review requires a new review; the CLI cannot create proposals or approve arbitrary text.
7. After a separately authorized release/binding operation, verify the real founder read flow. A live decision test requires its own exact business-action approval. Another channel may read the same receipt only when its reviewed host resolves the same founder and tenant identity; this patch does not configure plugin/OAuth/Telegram identity aliases or claim live cross-channel acceptance.

## Local verification

`node --test bin/founder-gate.test.mjs workers/quests/src/founder-decision.test.ts workers/quests/src/goal-graph-store.test.ts workers/quests/src/growth-workflow.test.ts workers/quests/src/plexus-gate.test.ts`

`node --test --test-name-pattern='founder|goal graph|goal-graph|in-world gate|growth' workers/quests/src/handler.test.ts`

The selected handler tests use synthetic RSA-signed Access JWTs, the actual verifier and decision service, and an in-memory SQLite D1 adapter. They cover CLI approval/rejection, lost-response recovery, concurrent opposite decisions, cross-transport receipt equality, identity/tenant/CSRF failures, review drift, expiry and stale heads. They are local evidence; production, device and ordinary-user acceptance remain unproven. The handoff reports a stalled full-suite baseline and 59 existing normalized TypeScript diagnostics; this patch does not claim a full release pass.

PR #396 review follow-up adds negative regressions for expiry during an awaited head read, direct expired rejection, unbound/missing review data, projected readback flags, historical null attribution, and stale or unavailable D1/KV read projections. Test counts in the PR description refer to the final reviewed commit; the full-suite and production caveats above still apply.
