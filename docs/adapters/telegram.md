# Telegram Adapter

Telegram can be a chat and approval adapter for teams that already work there. It is one surface for the abstract founder approval lane, not Cambium's default product identity.

## Port

`chat` and `approval`

Telegram implements the shared [approval lane](./approval.md). It should emit the same `cambium.approval.v1` event as the CLI and web adapters.

## Inputs

- Founder approval commands.
- Group or channel messages that can become project evidence.
- Bot callbacks for gate decisions.

Group/channel messages can become evidence or ActionRequests; they do not replace the signed Mini App approval lane.

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

Hermes owns the live topic topology. Cambium consumes the pinned snapshot in
`workers/quests/src/telegram-routing.ts`; [Hermes issue #88](https://github.com/Sheshiyer/hermes-aws-ts/issues/88)
owns the versioned manifest and cross-repository digest follow-up.

## Failure Mode

If bot credentials or allowed founder IDs are missing, the approval adapter should be unavailable and the CLI/web approval adapters should remain usable.

## Tenant Mapping

Topic and chat routing identifiers are non-authoritative topology and must have
one pinned owner. Founder account IDs, credentials, invite links, and signed
WebView data remain ignored runtime configuration.

## Privacy Boundary

Commit synthetic IDs only. Redact direct account identifiers, message exports, and private invite links before any doc or fixture is added to the repository.
