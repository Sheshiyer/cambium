# Approval Lane

The approval lane is Cambium's neutral human gate. It is the port that turns a proposed irreversible move into an auditable decision without binding Cambium to one chat product, founder account, or host organization.

Use it for:

- spend approval.
- macro setpoint moves.
- launch and ship gates.
- reroll versus accept decisions.
- promotion of learned skills from proposed to production.

## Port

`approval`

## Inputs

Every approval adapter should accept a compact request:

```json
{
  "tenant": "demo-org",
  "subject": "ship-gate:landing-page",
  "kind": "approve",
  "actor": "founder",
  "reason": "synthetic demo approval",
  "evidence": {
    "source": "example.com/demo-review",
    "summary": "reviewed synthetic launch checklist"
  }
}
```

Required fields:

- `tenant`: portable org slug.
- `subject`: stable id of the proposed action.
- `kind`: `approve`, `reroll`, `reject`, or `hold`.
- `actor`: role or adapter principal after redaction.
- `evidence`: short summary, not a raw provider payload.

## Outputs

Adapters emit an approval event that can be consumed by the operator, quest ledger, or project evidence fold:

```json
{
  "schema": "cambium.approval.v1",
  "tenant": "demo-org",
  "subject": "ship-gate:landing-page",
  "kind": "approve",
  "adapter": "cli",
  "receivedAt": "2026-06-19T00:00:00.000Z"
}
```

## Failure Mode

The approval lane must fail soft:

- missing adapter credentials produce an unavailable adapter, not a blocked local demo.
- queue storage failures leave the proposed action pending.
- ambiguous decisions become `hold`.
- provider verification failures are recorded as rejected authentication, not as product errors.

## Tenant Mapping

The adapter maps an external workspace, command context, or browser session to one portable org slug. Do not use chat IDs, channel IDs, account IDs, or host-specific workspace names as tenant ids.

## Privacy Boundary

Approval records may be committed only when synthetic. Real approvals belong in ignored runtime state or the adopter's private system of record.

Do not commit:

- direct account identifiers.
- chat message exports.
- approval screenshots with private names.
- raw customer evidence.
- live invite links.

## Current Adapter Choices

- [CLI approval](./cli-approval.md): local and CI-friendly approval input.
- [Web approval](./web-approval.md): browser form or miniapp approval surface.
- [Telegram](./telegram.md): chat/WebApp approval surface for teams already there.

The standalone baseline starts with zero provider credentials. `demo-org` fixtures use synthetic approvals only.
