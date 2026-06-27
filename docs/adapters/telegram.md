# Telegram Adapter

Telegram can be a chat and approval adapter for teams that already work there. It is one surface for the abstract founder approval lane, not Cambium's default product identity.

## Port

`chat` and `approval`

Telegram implements the shared [approval lane](./approval.md). It should emit the same `cambium.approval.v1` event as the CLI and web adapters.

## Inputs

- Founder approval commands.
- Group or channel messages that can become project evidence.
- Bot callbacks for gate decisions.

## Outputs

- Approval events for the operator.
- Quest evidence for gate and review arcs.
- Optional memory records after redaction.
- Topic-derived Fabric assignments through
  [`/v1/bridge/topic-assignment`](../architecture/contracts/hermes-topic-routing-to-quests.md).

## Proactive Topic Routing

A hosted Hermes worker may classify a runtime Telegram topic signal and ask
Cambium to queue a quest-linked Fabric assignment. Cambium validates the live
topic/thread map before creating the assignment, and Telegram remains signal
intake rather than execution authority.

## Failure Mode

If bot credentials or allowed founder IDs are missing, the approval adapter should be unavailable and the CLI/web approval adapters should remain usable.

## Tenant Mapping

Map chat IDs to portable org slugs through ignored runtime config. Do not commit live chat IDs or founder account IDs.

## Privacy Boundary

Commit synthetic IDs only. Redact direct account identifiers, message exports, and private invite links before any doc or fixture is added to the repository.
