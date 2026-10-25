# Founder proposal renewal and canonical 3D review

The existing 3D Founder Gate uses the canonical decision service for an authenticated Access founder. Telegram retains its existing signed flow. A renewed proposal is a new server-owned revision of the original intended change, with explicit source lineage and a fresh approval window. Renewal never records a decision or executes a graph change.

## Runtime prerequisites

- The deployed Worker must include the renewal/session handlers and rebuilt Curious world bundle from the same reviewed source revision.
- Cloudflare Access and the TeamForge founder verifier must validate the current human session. General UI access or a shared bearer does not establish founder authority.
- `FOUNDER_GATE_BINDINGS_JSON` must contain explicit reviewed `{founderId,tenantId}` pairs. Resolve the opaque founder ID from the verified session endpoint; resolve the tenant from actual admitted runtime records. Client names and WorkObject names do not create tenant identities.
- `QUESTS` must resolve the original stored intake records and persist new revisions. `BRIDGE_DB` must provide the existing Goal Graph authority and `0012_goal_graph_renewal_fence.sql`. Verify that `goal_graph_approval_family_unique` exists as a unique expression index over tenant and the canonical renewal root (falling back to the original approval ID). Missing authority or fence support holds decisions.
- The original proposal must be pending or stale, undecided, supported by the existing Goal Graph intake type, and eligible for a current-head rebase. Conflicting edits and already-applied changes cannot be approved through renewal.
- Promotion must preserve live resources, variables, secrets, global settings, domains and schedules. Use the current production profile and inspect a staged version before assigning traffic. The version-preservation configuration intentionally omits global routes.

## Authenticated flow

`GET /v1/founder/session` returns the verified opaque founder ID, explicit enrolled tenant IDs and canonical runtime readiness. It grants no enrollment. The client sends the same-origin Founder Web header; the server independently verifies the session.

`POST /v1/founder/proposal` reads the complete canonical proposal and its exact confirmation strings. An expired or stale review remains read-only until a valid renewal is loaded.

`POST /v1/founder/renew` accepts exactly `proposalId`, `version`, `changeDigest`, `nonce` and `expiresAt` from the original review. It rebases only the original intended delta on a consistent current-head snapshot, preserving unrelated nodes and refusing conflicting edits. The original record and any settled receipt remain intact. Replays reconcile through the existing intake idempotency mechanism.

The 3D UI then fetches the new canonical proposal and displays its entire review, change set, head/fence, source lineage, consequence and reversibility. Both approval and rejection require a fresh exact review. One confirmation sends one decision; an uncertain response causes one status read using that original decision tuple. It never automatically resubmits a decision.

The D1 authority fences the entire original/renewal family atomically, including sibling revisions and delayed original decisions. A graph-head comparison is an additional guard, not a replacement for that decision-family fence. Canonical receipt readback is required before the UI reports settlement.

## Verification boundaries

Pure/compiler, real SQLite adapter, handler, bridge and world tests establish source behavior. Local Workers smoke protects the existing growth flow using isolated synthetic storage. These checks do not establish a live founder identity, production enrollment, provider execution or an actual 3D decision. Record those separately from the signed-in deployed UI and subsequent canonical D1 readback.
