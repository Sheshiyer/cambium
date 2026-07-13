/**
 * Pinned consumer snapshot of Hermes-owned Telegram topology.
 *
 * Hermes issue #88 owns the future versioned manifest and cross-repository
 * digest check. Until that exists, this module is the only Cambium runtime
 * owner for chat/topic identifiers and records the exact source revision.
 */
export const TELEGRAM_ROUTING_CONTRACT = {
  schema: 'thoughtseed.telegram-topic-map.snapshot.v1',
  sourceRepository: 'Sheshiyer/hermes-aws-ts',
  sourceCommit: '67ba40cda9fb935eb5b2a9955cc7edb5bd579657',
  tracker: 'https://github.com/Sheshiyer/hermes-aws-ts/issues/88',
} as const;

export const THOUGHTSEED_TELEGRAM_CHAT_ID = '-1002691202808';

export const TOPIC_QUEST_ROUTES = {
  hermes: { topicName: 'Hermes', threadId: 797, questId: 'the-gate', priority: 'normal', taskType: 'operations', title: 'Coordinate Hermes topic signal' },
  digests: { topicName: 'Digests', threadId: 798, questId: 'the-review', priority: 'normal', taskType: 'research', title: 'Synthesize digest topic signal' },
  dev: { topicName: 'Dev', threadId: 862, questId: 'the-build', priority: 'high', taskType: 'engineering', title: 'Act on Dev topic signal' },
  inbox: { topicName: 'Inbox', threadId: 800, questId: 'the-brief', priority: 'normal', taskType: 'general', title: 'Triage Inbox topic signal' },
  calendar: { topicName: 'Calendar', threadId: 801, questId: 'the-brief', priority: 'normal', taskType: 'operations', title: 'Prepare Calendar topic signal' },
  agent_ops: { topicName: 'Agent Ops', threadId: 802, questId: 'living-org', priority: 'high', taskType: 'operations', title: 'Investigate Agent Ops topic signal' },
  alerts: { topicName: 'Alerts', threadId: 803, questId: 'the-ship-gate', priority: 'urgent', taskType: 'operations', title: 'Escalate Alerts topic signal' },
  clients: { topicName: 'Clients', threadId: 804, questId: 'the-handoff', priority: 'high', taskType: 'general', title: 'Prepare Clients topic signal' },
} as const;
