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
- Typed Goal Graph intent envelopes through `/v1/bridge/goal-graph-intake`
  (pending proposals only; approval stays founder-signed — see below).
- Topic-derived Fabric assignments through
  [`/v1/bridge/topic-assignment`](../architecture/contracts/hermes-topic-routing-to-quests.md).

## Goal Graph Intake Lane

The intake route exists and is live: `POST /v1/bridge/goal-graph-intake` on the
quests Worker accepts one typed intent envelope and stores a bounded pending
proposal. The full lifecycle (approval, D1 commit, readback, failure states) is
the [Telegram Goal Graph intake lifecycle](../runbooks/goal-graph-telegram-lifecycle.md)
runbook; this section is the adapter-side contract.

An adapter such as Hermes submits `cambium.telegram.goal-graph-intent.v1`:

- `schema` / `version`: exactly `cambium.telegram.goal-graph-intent.v1` / `1`.
- `tenantId`: the portable tenant slug.
- `source`: `{ kind: "telegram", chatId, messageId }` with optional `updateId`
  and `threadId`. `kind` is fixed; it is not a provider or model selector.
- `goal`: `desiredState` is the only required field. `namespace`, `scope`,
  `externalId`, `parentNodeId`, `currentState`, `owner`, `nextAction`,
  `waitCondition`, `proofRequired`, `reviewAt`, `status`, and `metadata` are
  optional with conservative defaults. Metadata is scalar-only and bounded.

Submission rules:

- Authenticate with the admin bridge bearer token (or the scoped assignment
  token). Anything else is 401/403.
- Idempotency is the canonical key
  `telegram:goal-graph-intent:v1:<tenantId>:<chatId>:<messageId>:<contentDigest>`.
  Re-sending the same envelope returns 200 with `duplicate: true` and the
  original receipt; no second proposal is written. The same key with different
  content fails closed with 409, so an adapter must never reuse a
  chat/message pair for edited intent.
- Rejections are **HTTP 200 with `ok: false, accepted: false, rejected: true,
  code, errors, receiptId`** — a deliberate anti-redelivery-loop choice, since
  Telegram retries non-2xx. The adapter must branch on the body, not the
  status code, and may surface only the bounded `code`/`errors`/`receiptId`;
  the route never echoes payload content.
- An accepted proposal is pending in KV only. It becomes graph truth solely
  through the founder-signed `approve-goal-graph` gate action; the adapter has
  no approval authority.

Future work (not shipped): no bot auto-watches Telegram messages and no
automatic envelope extraction exists. Intake submission is operator-mediated —
an operator (or an operator-driven Hermes flow) composes and submits the typed
envelope, and `messageId` may be an attestation label when the platform message
id is not exposed to the operator.

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
