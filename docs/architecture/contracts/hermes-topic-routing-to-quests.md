# Hermes Topic Routing To Cambium Quests

Status: active pinned consumer snapshot
Snapshot source: `Sheshiyer/hermes-aws-ts@1931f6c2d0d9260cfbf29c37413e1504e7ebf9e4`
Manifest SHA-256: `edcbbb34bb468107400767442df8c772c418a40a9e3747651404a23ec33c7d2a`
Runtime owner tracker: [Hermes #88](https://github.com/Sheshiyer/hermes-aws-ts/issues/88)

## Purpose

Thoughtseed Telegram topics are signal lanes. They help Hermes understand where
a message belongs, but they are not policy authority and they do not directly
mutate quest state.

The proactive path is:

1. AWS-hosted Hermes observes or generates a topic signal.
2. Hermes classifies it by the live Thoughtseed topic map.
3. Cambium validates the topic/thread and maps it to a quest arc.
4. Cambium queues a normal Fabric `project_task_assignment`.
5. Plexus/Hermes consume the assignment through the existing member-scoped
   bridge.
6. Routine/topic heartbeats report the assignment status back to the right
   Telegram topic.

## Route

`POST /v1/bridge/topic-assignment`

Auth is the same narrow bridge auth used for assignments:

- `BRIDGE_TOKEN`: admin/cofounder bridge token.
- `HERMES_ASSIGNMENT_TOKEN`: scoped Hermes token. It may create topic-derived
  assignments, but it still cannot enqueue arbitrary directives or read the
  admin inbox.

The route returns the same idempotent assignment shape as
`POST /v1/bridge/assign-task`, plus a topic projection:

```json
{
  "ok": true,
  "id": "assign-topic-dev-1",
  "memberId": "shesh",
  "taskId": "task_topic-dev-852",
  "projectId": "thoughtseed-ops",
  "eventId": "topic:thoughtseed-ops:dev:852:assigned",
  "correlationId": "topic:thoughtseed-ops:dev:852:assigned",
  "queued": true,
  "topic": {
    "topicKey": "dev",
    "threadId": 4,
    "questId": "the-build"
  }
}
```

## Input Shape

Minimum:

```json
{
  "topicKey": "dev",
  "threadId": 4,
  "sourceMessageId": "852",
  "summary": "Build route proof is stale and needs a fresh worker probe."
}
```

Optional fields:

- `chatId`: if present, must be `-1003942929819`.
- `memberId`: defaults to `shesh`.
- `projectId`: defaults to `thoughtseed-ops`.
- `projectName`: defaults to `Thoughtseed Ops`.
- `title`: defaults from the topic route.
- `taskId`, `eventId`, `correlationId`: override generated idempotency keys.
- `priority`, `taskType`, `questId`: override defaults only when valid.
- `clientId`, `clientName`: attach client context for Clients topic work.

## Topic Map

| Topic | Thread | Default quest | Default task type | Default priority |
| --- | ---: | --- | --- | --- |
| Hermes | 2 | `the-gate` | `operations` | `normal` |
| Digests | 3 | `the-review` | `research` | `normal` |
| Dev | 4 | `the-build` | `engineering` | `high` |
| Inbox | 5 | `the-brief` | `general` | `normal` |
| Calendar | 6 | `the-brief` | `operations` | `normal` |
| Agent Ops | 7 | `living-org` | `operations` | `high` |
| Alerts | 8 | `the-ship-gate` | `operations` | `urgent` |
| Clients | 9 | `the-handoff` | `general` | `high` |

## Proactive Rules

- Hermes should call this route when a topic signal has an actionable next step,
  stale proof, failed routine, client-facing approval need, or explicit owner.
- Hermes should not call this route for every message. Non-actionable topic
  chatter remains a heartbeat, digest item, or context note.
- Alerts are urgent by default. Clients are high priority by default and should
  still route external delivery through approval.
- The route validates the live chat/thread map so old Telegram IDs or wrong
  topics fail closed.
- Raw secrets, Telegram initData, bearer tokens, and sensitive account markers
  are not accepted as visible task text; unsafe text is replaced with a bounded
  fallback.

## Why This Is Proactive

The old flow was reactive: humans posted into topics, Hermes delivered digests,
and Cambium learned only after a task/report/evidence packet arrived.

The new flow lets Hermes turn a topic signal into a Cambium assignment at the
moment the signal appears. Cambium still owns the quest/Fabric ledger, and
Plexus still receives member-scoped work in the existing Fabric contract.

This creates a loop:

`topic signal -> quest-linked assignment -> Fabric task -> evidence/report -> topic heartbeat`

## Boundaries

- Telegram topic routing is signal intake, not execution authority.
- Telegram topic buttons and group/channel callbacks may create or route review
  signals, but founder-signed approval still requires the Mini App Gate path
  with valid Telegram WebView `initData`.
- Cambium remains the assignment and quest bridge owner.
- Plexus remains the member task/report surface.
- Hermes remains the hosted observer, classifier, cron runner, and delivery
  surface.
- Paperclip is provenance only.

## Ownership and drift

Hermes owns Telegram topology; Cambium owns quest mapping. Cambium's sole
runtime snapshot is `workers/quests/src/telegram-routing.ts`, which records the
exact Hermes source commit and the cross-repository tracker. Raw topic literals
must not be copied into handlers, tests, runbooks, or plans as current config.

Hermes #88 owns the canonical versioned manifest. Cambium vendors the manifest
and verifies its digest and runtime route projection in
`workers/quests/src/topic-map-drift.test.ts`. Re-vendor only from the Hermes
manifest at the recorded source commit, then update the source commit and
digest together. Historical evidence may retain older topic ids, but it is not
configuration.
