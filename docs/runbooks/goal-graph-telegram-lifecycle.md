# Telegram Goal Graph intake lifecycle

Status: pure intake contract; Worker route and D1 commit wiring are intentionally deferred.

## Contract

Telegram may propose a Goal Graph change with the bounded, versioned envelope
below. `tenantId` and the Telegram `source` are mandatory provenance. `kind` is
fixed to `telegram`; it is not a provider or model selector.

```json
{
  "schema": "cambium.telegram.goal-graph-intent.v1",
  "version": 1,
  "tenantId": "tenant-alpha",
  "source": {
    "kind": "telegram",
    "chatId": "-100123",
    "messageId": "42",
    "updateId": "9001",
    "threadId": "17"
  },
  "goal": {
    "desiredState": "publish the approved launch note",
    "namespace": "telegram",
    "scope": "macro",
    "externalId": null,
    "parentNodeId": null,
    "currentState": "unknown",
    "owner": "founder",
    "nextAction": null,
    "waitCondition": null,
    "proofRequired": false,
    "reviewAt": null,
    "status": "draft",
    "metadata": { "priority": "normal" }
  }
}
```

`namespace`, `scope`, `currentState`, `owner`, `proofRequired`, `reviewAt`,
`status`, and `metadata` have conservative defaults. `goal.desiredState` is
the only required goal field. The parser normalizes defaults before hashing.

The envelope is deliberately not a Telegram update. Raw `initData`, message
bodies, attachments, provider/model settings, credentials, routing hints,
arbitrary payloads, and projection envelopes are outside this contract.

## Bounds and rejection

The parser has no side effects and never throws for malformed input. Every
failure returns `{ accepted: false, rejected: true, status: "rejected", code,
errors }`. Payloads are limited to 16 KiB; metadata is limited to 32 scalar
keys and 2 KiB. Individual identifiers, fields, metadata keys, and metadata
values are bounded as documented by `TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS`.

Unknown keys are fail-closed. Keys resembling `provider`, `model`, `routing`,
`credential`, `projection`, `payload`, `origin`, or graph revision fields are
also rejected, including when nested in metadata. Projection-shaped input is
rejected before normal intent validation so a read model cannot fold back into
the authoritative lane.

## Deterministic replay

The normalized envelope is serialized with sorted object keys. Its SHA-256
`contentDigest` is copied into node `sourceDigest`; `sourceRef` is derived as
`telegram:<tenantId>:<chatId>:<messageId>`. The idempotency key is:

```text
telegram:goal-graph-intent:v1:<tenantId>:<chatId>:<messageId>:<contentDigest>
```

Telegram redelivery therefore produces byte-equal canonical serialization,
the same node identity, digest, and idempotency key. Changing tenant or source
changes provenance and replay identity.

## Compilation boundary

`parseTelegramGoalGraphIntent(input, context?)` calls the existing pure
`buildNode` and `compileGoalGraph` primitives. An optional in-memory context
(`expectedHeadDigest`, `actualHead`, `currentNodes`, `graphVersion`, `now`)
allows stale-head checks and proposal compilation. No D1 handle is accepted,
and no Worker, Telegram API, credential, or provider call is made. The result
contains a proposal change-set only; an approved D1 writer remains responsible
for persistence and CAS.

## Operational sequence once wiring exists

1. Receive the Telegram update and extract only the allow-listed fields.
2. Parse the envelope and persist a bounded rejection receipt on failure.
3. For an accepted result, use `idempotencyKey` to collapse redelivery.
4. Present the compiled proposal for the separate approval-bound D1 commit.
5. Commit only against the expected graph head; stale proposals produce no write.
6. Return a bounded receipt/projection that preserves tenant and source provenance.

