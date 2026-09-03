/**
 * Pinned consumer snapshot of Hermes-owned Telegram topology.
 *
 * Hermes issue #88 owns the versioned manifest and cross-repository digest
 * contract. This module records the source base revision and exact digest used by
 * the vendored copy guarded in `topic-map-drift.test.ts`.
 */
export const TELEGRAM_ROUTING_CONTRACT = {
  schema: 'thoughtseed.telegram-topic-map.v1',
  sourceRepository: 'Sheshiyer/hermes-aws-ts',
  sourceCommit: 'e09ebfed7d6cbe69652d979c3c63f261c27fe27a',
  manifestSha256: 'edcbbb34bb468107400767442df8c772c418a40a9e3747651404a23ec33c7d2a',
  tracker: 'https://github.com/Sheshiyer/hermes-aws-ts/issues/88',
} as const;

export const THOUGHTSEED_TELEGRAM_CHAT_ID = '-1003942929819';

export const TOPIC_QUEST_ROUTES = {
  hermes: { topicName: 'Hermes', threadId: 2, questId: 'the-gate', priority: 'normal', taskType: 'operations', title: 'Coordinate Hermes topic signal' },
  digests: { topicName: 'Digests', threadId: 3, questId: 'the-review', priority: 'normal', taskType: 'research', title: 'Synthesize digest topic signal' },
  dev: { topicName: 'Dev', threadId: 4, questId: 'the-build', priority: 'high', taskType: 'engineering', title: 'Act on Dev topic signal' },
  inbox: { topicName: 'Inbox', threadId: 5, questId: 'the-brief', priority: 'normal', taskType: 'general', title: 'Triage Inbox topic signal' },
  calendar: { topicName: 'Calendar', threadId: 6, questId: 'the-brief', priority: 'normal', taskType: 'operations', title: 'Prepare Calendar topic signal' },
  agent_ops: { topicName: 'Agent Ops', threadId: 7, questId: 'living-org', priority: 'high', taskType: 'operations', title: 'Investigate Agent Ops topic signal' },
  alerts: { topicName: 'Alerts', threadId: 8, questId: 'the-ship-gate', priority: 'urgent', taskType: 'operations', title: 'Escalate Alerts topic signal' },
  clients: { topicName: 'Clients', threadId: 9, questId: 'the-handoff', priority: 'high', taskType: 'general', title: 'Prepare Clients topic signal' },
} as const;
