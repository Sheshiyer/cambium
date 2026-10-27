# Live-gate evidence receipts (empty until separately approved)

This directory is **intentionally empty** in the source-only compatibility
packet. The verifier's `--check` mode fails closed until every live-gate
evidence receipt below exists as a real, reviewed file in this directory.

Required evidence receipts (one JSON file each, exact name):

| File | Gate | ISC |
|---|---|---|
| `dot-entitlement.receipt.json` | Dot entitlement for the approved workspace | ISC-2476 |
| `workspace-admin-enablement.receipt.json` | Workspace-admin enablement for private plugins | ISC-2476 |
| `plugin-connection.receipt.json` | Private-plugin connection to the exact Access-protected deployment | ISC-2476, ISC-2477 |
| `service-credentials.receipt.json` | Service credentials owned by the approved principal | ISC-2476 |
| `deployed-version.receipt.json` | Deployed-version verification against the exact bindings digest | ISC-2476, ISC-2477 |
| `mcp-endpoint.receipt.json` | Reviewed live MCP endpoint after all five gates pass | ISC-2480, ISC-2482 |
| `readback.receipt.json` | Authoritative readback proving a compiled action intent | ISC-2485, ISC-2487 |
| `rollback.receipt.json` | Captured prior adapter and deployment identities for rollback | ISC-2500, ISC-2501 |
| `marketplace-import.receipt.json` | Admin-controlled Agent Plugins marketplace sync into the exact approved workspace, binding the exact marketplace-file digest and complete plugin-directory packet digest to the initial and repeated sync report digests and confirming that a re-sync produced no change | ISC-2476, ISC-2477 |
| `end-to-end-canary.receipt.json` | Clean Dot session plus joined behavioral canary over the exact nine prerequisite receipts: preserved authority, tool catalog, persistent context, local/cloud parity, held surfaces, one approved channel, stop/late results, rollback restore, disconnect reconciliation, version negotiation, and Vision-to-Learning lineage | ISC-2478, ISC-2490..2505 |

The first nine receipts prove independent infrastructure readiness only. They
must never produce a full-compatibility verdict by themselves. The tenth canary
receipt is separately owner-approved, must be verified after all nine, and
binds their complete canonical bodies through `prerequisiteReceiptSetDigest`.
Its nested evidence is closed and digest-only; zero/one counters and exact enums
prove the required no-effect, no-fallback, no-second-writer, replay, stop, and
upgrade-required outcomes without storing prompts, responses, sessions, or
credentials. All ten top-level evidence digests and all conceptually distinct
canary proof digests must be different; only explicit semantic joins may reuse a
digest. Until that joined canary is present and valid, the verifier reports
`infrastructure compatibility gates: OK; behavioral acceptance: HELD`.

Every receipt carries the same `workspaceRefDigest` and `tenantRefDigest`. Raw
workspace, tenant, entitlement, region, principal, audience, plugin, connection,
credential, deployment, and manifest identifiers are forbidden; receipts keep
only SHA-256 references. The verifier rejects a set assembled from different
workspaces or tenants, even when each receipt is independently well formed.

## What each receipt must not contain

- No secrets, tokens, or credentials.
- No absolute machine paths.
- No native session identifiers.
- No prompt or response bodies.
- No cross-tenant identifiers.

Receipt creation, deployment, workspace administration, credential provision,
and every external mutation are separately owner-approved and outside the
scope of this repository packet.

## Deployment admission before receipt creation

Before an approved operator changes the live deployment, validate the reviewed
source policy:

```bash
node scripts/check-openai-mcp-deployment-admission.mjs --check-policy
```

After separately collecting the proposed configuration into a temporary,
redacted snapshot, compute its canonical digest without exposing values:

```bash
node scripts/check-openai-mcp-deployment-admission.mjs \
  --snapshot /path/to/redacted-snapshot.json \
  --print-configuration-digest
```

The owner reviews that exact snapshot and digest through the separately approved
activation process. Only after that approval, admit the unchanged snapshot:

```bash
node scripts/check-openai-mcp-deployment-admission.mjs \
  --snapshot /path/to/redacted-snapshot.json \
  --approved-configuration-digest sha256:<approved-digest>
```

The snapshot is not a live receipt. It carries no secret values or raw binding
targets: service targets, configured-secret presence, deployed version, and
rollback target are distinct SHA-256 references. The deployed-version digest
must equal the digest recomputed from the compatibility manifest's reviewed
Worker runtime sources. Snapshot-only admission is held; `READY` also requires
the separately owner-approved canonical configuration digest. The checker opens
no network, reads no Wrangler state, writes nothing, and reports only labels and
verdicts. `READY` admits the unchanged, approved configuration for activation;
it does not perform or prove deployment, OAuth registration, plugin connection,
or authoritative readback.
