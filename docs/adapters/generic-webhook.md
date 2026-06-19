# Generic Webhook Adapter

The generic webhook adapter is the reference adapter for new adopters. It accepts provider-neutral JSON and emits Cambium evidence without requiring chat, issue tracker, or deployment accounts.

## Port

`webhook-evidence`

## Input

```json
{
  "tenant": "demo-org",
  "kind": "approval",
  "source": "local-demo",
  "id": "evt_001",
  "summary": "Build gate approved",
  "occurredAt": "2026-06-19T00:00:00.000Z"
}
```

## Output

- A portable operator event for the tenant.
- Optional quest evidence for brief, gate, deploy, learning, or archive arcs.
- Optional cortex memory when the event carries reusable context.

## Failure Mode

If the payload is missing a tenant, kind, or id, reject it without mutating world state. If optional storage is unavailable, return the parsed event and record the storage miss as a warning.

## Privacy Boundary

Webhook payloads are runtime data. Keep captured payloads in `.operator/` or another ignored runtime directory. Commit only synthetic examples that use `example.com`.
