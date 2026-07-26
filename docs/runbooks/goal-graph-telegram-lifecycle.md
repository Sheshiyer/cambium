# Telegram Goal Graph intake lifecycle

Status: live. The intake route, founder approval bridge, gate surfacing, and D1
CAS commit are shipped and deployed (Worker version `ec7f080d`, 100% traffic on
the production custom domain per `workers/quests/DEPLOY.md`; intake + bridge
commit `190284e`, gate UI commit `74fd709`). Live end-to-end proof exists; see
Evidence.

Runtime sources: `workers/quests/src/goal-graph-intake.ts` (pure parser),
`workers/quests/src/handler.ts` (intake route, gate-row projection,
`approve-goal-graph` bridge), `workers/quests/src/page/client/signed-action.ts`
(Mini App gate client).

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

## 200-on-rejection route contract

`POST /v1/bridge/goal-graph-intake` returns **HTTP 200 for parser rejections**:

```json
{
  "ok": false,
  "accepted": false,
  "rejected": true,
  "status": "rejected",
  "schema": "cambium.goal-graph-intake-rejection.v1",
  "tenantId": "tenant-alpha",
  "code": "malformed_input",
  "errors": ["…"],
  "receiptId": "ggi-rej-<24 hex>"
}
```

`errors` is bounded (at most 8 entries, 240 bytes each) and carries the
parser's error shape only — no payload content, metadata value, or raw
Telegram content is ever echoed. The same bounded receipt is persisted in KV
at `goal-graph-intake-rejection:<tenant>:<receiptId>`; the receipt tenant is a
best-effort read of the payload's `tenantId` (`unknown` when it is missing or
not tenant-shaped), never trusted provenance.

The 200 is deliberate: Telegram retries non-2xx deliveries, so a malformed
message must never crash-loop or redelivery-loop the lane. Callers must read
`ok`/`accepted` in the body; the HTTP status alone does not distinguish
acceptance from rejection.

## Deterministic replay and idempotency

The normalized envelope is serialized with sorted object keys. Its SHA-256
`contentDigest` is copied into node `sourceDigest`; `sourceRef` is derived as
`telegram:<tenantId>:<chatId>:<messageId>`. The idempotency key is:

```text
telegram:goal-graph-intent:v1:<tenantId>:<chatId>:<messageId>:<contentDigest>
```

Telegram redelivery therefore produces byte-equal canonical serialization,
the same node identity, digest, and idempotency key. Changing tenant or source
changes provenance and replay identity.

The route collapses redelivery on that canonical key: a replay returns HTTP
200 with the original task receipt and `duplicate: true`, and never writes a
second record. The same key carrying a different `contentDigest` fails closed
with 409.

## Compilation boundary

`parseTelegramGoalGraphIntent(input, context?)` calls the existing pure
`buildNode` and `compileGoalGraph` primitives. An optional in-memory context
(`expectedHeadDigest`, `actualHead`, `currentNodes`, `graphVersion`, `now`)
allows stale-head checks and proposal compilation. No D1 handle is accepted,
and no Worker, Telegram API, credential, or provider call is made. The result
contains a proposal change-set only; the approval-bound D1 writer remains
responsible for persistence and CAS.

## Live lane

1. **Intake** — `POST /v1/bridge/goal-graph-intake` with the admin bridge
   bearer token (or the scoped assignment token); any other credential gets
   401/403. The route parses, then re-parses with the live context so the
   proposal is pinned to the **current** graph head
   (`expectedHeadDigest` = head digest, `graphVersion` = head version + 1). A
   parse result that does not compile against that head is refused with 409
   `goal_graph_stale_head` before any write.
2. **Pending proposal in KV, not D1** — an accepted proposal is stored at
   `goal-graph-intake-task:<tenant>:<changeDigest>` under schema
   `cambium.goal-graph-intake-task.v1` (status `pending`, plus intent, node,
   change-set, and pinned digests). D1 stays the graph authority with
   immutability triggers; an unapproved proposal has no business in graph
   tables. The acceptance receipt is HTTP 200 `{ ok: true, accepted: true,
   duplicate, status: "pending", idempotencyKey, changeDigest, contentDigest,
   sourceRef, sourceDigest, nodeId, graphVersion, expectedHeadDigest,
   receivedAt }`.
3. **Gate surfacing** — pending proposals are projected as bounded gate rows
   (`cambium.goal-graph-gate-row.v1`, at most 25, newest first) into
   `GET /internal/gate/{tenant}` and into the founder quests envelope as
   `goalGraphIntake` (`cambium.goal-graph-gate-row-list.v1`). Rows carry
   digests, a bounded desiredState-derived title/summary, source ref, and
   consequence/reversibility strings — never the intent envelope, change-set,
   metadata, or founder identity. The Mini App Gate tab renders each row with
   Approve + Inspect; committed or stale proposals leave the active list.
4. **Approval** — the founder signs in the Mini App (Gate tab → Goal proposal
   row → Approve → preflight → signed submit). The client posts
   `POST /api/gate/{tenant}` with `kind: "approve-goal-graph"` and
   `subject` = the change digest, plus live `initData`. The approval binds
   tenant, change digest, intent version, founder user id, expiry (default 15
   minutes), and nonce (default
   `goal-graph-approval:<tenant>:<changeDigest>`) into a canonical approval
   digest.
5. **Commit** — the bridge commits the stored change-set through the D1 goal
   graph store as a CAS against the intake-pinned head.
6. **Readback** — `GET /v1/branch-map/{tenant}` with signed Telegram init
   data in `X-Telegram-Init-Data` returns the versioned projection, sheet,
   and proof (`cambium.telegram.branch-map-route.v1`). The tenant must be in
   the server-owned `branchMapTenants` allowlist (default `['cambium']`);
   anything else is 403. Operator procedure: see
   [Telegram operator surface](./telegram-operator-surface.md).

## Failure states

| State | Response | What it means |
| --- | --- | --- |
| Parser rejection | 200 `{ ok: false, rejected: true, code, errors, receiptId }` | Bounded rejection receipt persisted; never echoes payload content |
| Redelivery of an accepted intent | 200 `duplicate: true` | Original task receipt; single write |
| Idempotency key, different content | 409 | Same canonical key, different `contentDigest`; fail-closed |
| Proposal no longer matches the head | 409 `goal_graph_stale_head` | No write; a stale approval also marks the KV task `stale` so a fresh message can pin the current head |
| Replay of a committed approval | 200 `duplicate: true, replayed: true` | Original head, nonce, and approval digest returned; nothing written |
| Unknown or non-pending task | 404 / 409 | Unknown change digest, or a task whose status cannot be approved |
| Goal graph store absent or unreadable | 503 | Fail-closed; no proposal, no commit |

Committed graph revisions are immutable; supersede with a new approved
proposal.

## Evidence

Live production proof (2026-07-26, Worker `ec7f080d`): intake changeDigest
`394556383a1e31a0…` → founder in-app signed approval → D1 head
`846400e1fa237048…` at graphVersion 1, with intake replay collapsing to
`duplicate: true` and the gate envelope draining to zero pending rows after
commit. Proof artifacts: `.artifacts/tg-miniapp-live-proof/t041-*.json`
(local only; `.artifacts/` is gitignored — cite the digests above, not the
files, in committed docs).
