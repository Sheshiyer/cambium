# Hermes Topic Routing To Cambium Quests

Status: implemented locally
Date: 2026-06-25

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
    "threadId": 799,
    "questId": "the-build"
  }
}
```

## Input Shape

Minimum:

```json
{
  "topicKey": "dev",
  "threadId": 799,
  "sourceMessageId": "852",
  "summary": "Build route proof is stale and needs a fresh worker probe."
}
```

Optional fields:

- `chatId`: if present, must be `-1002691202808`.
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
| Hermes | 797 | `the-gate` | `operations` | `normal` |
| Digests | 798 | `the-review` | `research` | `normal` |
| Dev | 799 | `the-build` | `engineering` | `high` |
| Inbox | 800 | `the-brief` | `general` | `normal` |
| Calendar | 801 | `the-brief` | `operations` | `normal` |
| Agent Ops | 802 | `living-org` | `operations` | `high` |
| Alerts | 803 | `the-ship-gate` | `operations` | `urgent` |
| Clients | 804 | `the-handoff` | `general` | `high` |

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
- Cambium remains the assignment and quest bridge owner.
- Plexus remains the member task/report surface.
- Hermes remains the hosted observer, classifier, cron runner, and delivery
  surface.
- Paperclip is provenance only.
