# Telegram operator surface

Status: active
Owner: Cambium quests Worker (branch-map route) and the Hermes Telegram plugin (operator commands)
Runtime sources: `workers/quests/src/handler.ts` (branch-map route), Hermes Telegram plugin (operator commands)

## Boundary

This surface is read-and-propose only. The branch-map route mutates nothing.
The operator commands queue one bounded synthetic task whose terminal state is
`awaiting_human_approval`. Neither surface exposes raw task data, artifact
bytes, R2 keys, provider credentials, or customer payloads.

## Discover current state

Check the Worker before giving instructions:

```bash
curl --fail --silent "$CAMBIUM_PUBLIC_BASE_URL/healthz/gate"
```

`gateConfigured: true` means signed Telegram auth is available. An
unauthenticated branch-map read must fail closed with 401; a 200 or 500
without auth is an incident, not a configuration quirk.

## Branch-map read route

`GET /v1/branch-map/{tenant}` returns the read-only branch traversal
projection. Live Telegram `initData` travels in the `X-Telegram-Init-Data`
header and is validated server-side (signature, freshness, founder allowlist).
The tenant must be in the server-owned `branchMapTenants` allowlist (default
`['cambium']`).

| Status | Cause |
| --- | --- |
| `200` | Versioned envelope `cambium.telegram.branch-map-route.v1`: projection, rendered sheet, and a proof object binding graph, projection, sheet, and authenticated-read digests |
| `400` | Bad tenant, or a non-GET method |
| `401` | Missing, stale, malformed, or non-founder `initData` |
| `403` | Tenant not in the branch-map allowlist |
| `404` | No graph head for the tenant |
| `503` | Telegram auth, graph store, or receipt store not configured, or projection/sheet digest failure |

The route contract and projection rules live in
[`docs/architecture/contracts/tg-miniapp-contract-v2.md`](../architecture/contracts/tg-miniapp-contract-v2.md)
§4 and [`docs/architecture/branch-traversal-map.md`](../architecture/branch-traversal-map.md);
this runbook owns the operator procedure. A committed goal-graph proposal is
read back through this route — see the
[Telegram Goal Graph intake lifecycle](./goal-graph-telegram-lifecycle.md).

## Operator commands (Hermes Telegram plugin)

The founder runs the synthetic service-agreement canary from the allowlisted
Telegram surface without JSON, a coding CLI, or SSH:

- `/ts-agreement-draft canary [request-key]` — create or replay one stable D1
  task through the scoped assignment credential. An exact replay returns the
  same task with `duplicate: true`; no second directive or artifact is
  created.
- `/ts-agreement-status <task-id>` — read back the redacted D1 receipt:
  allowlisted fields only (task state, artifact digest and length, and the
  human-approval boundary). Raw task and artifact reads stay 403 under the
  assignment token.

Registration is default-off and requires
`HERMES_SERVICE_AGREEMENT_OPERATOR_ENABLED=true` on the Hermes side. The
founder/group allowlist remains enforced, and a one-version rollback must
leave no orphan operator task. The canary remains synthetic: it creates no
real-client agreement, approves no terms, and delivers nothing externally.

Live identities (task ids, artifact digests, worker versions) are dated proof
and belong to the completion record
(`.planning/phases/02-telegram-operator-intake/02-01-SUMMARY.md`), not to this
procedure — per `docs/LIFECYCLE.md`, an active runbook never freezes a live
task id, digest, or deploy version into prose.

## Redaction

Never paste tokens, raw Telegram `initData`, founder identifiers, private chat
identifiers, artifact bytes, or R2 keys into an issue, plan, screenshot
caption, or proof artifact.
