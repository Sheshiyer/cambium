# Web Approval Adapter

The web approval adapter is a browser surface for the same approval lane. It can be implemented as a standalone web form, an embedded miniapp, or an internal portal, but the browser surface is not Cambium's product identity.

## Port

`approval`

## Inputs

- authenticated browser session or signed request.
- tenant slug.
- subject id.
- approval kind: `approve`, `reroll`, `reject`, or `hold`.
- compact evidence summary.

## Outputs

- `cambium.approval.v1` event.
- queued gate action for the operator.
- optional UI receipt for the user.

## Failure Mode

- missing auth returns 401.
- missing adapter configuration returns 503.
- stale signatures are rejected.
- unavailable queue storage leaves the action pending.

## Tenant Mapping

Map the authenticated organization or workspace to a portable Cambium org slug. Keep the mapping in runtime configuration, not in source code.

## Privacy Boundary

Do not commit live browser session payloads, screenshots with private names, or request logs. Web fixtures should use `demo-org`, `example.com`, and synthetic approval subjects.

## Relationship to Telegram

Telegram WebApp approval is one implementation of this adapter. A non-Telegram browser form should be able to emit the same approval event.
