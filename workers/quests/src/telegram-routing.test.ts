import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TELEGRAM_ROUTING_CONTRACT,
  THOUGHTSEED_TELEGRAM_CHAT_ID,
  TOPIC_QUEST_ROUTES,
} from './telegram-routing.ts';

test('Telegram routing snapshot records its Hermes provenance', () => {
  assert.equal(TELEGRAM_ROUTING_CONTRACT.schema, 'thoughtseed.telegram-topic-map.snapshot.v1');
  assert.equal(TELEGRAM_ROUTING_CONTRACT.sourceRepository, 'Sheshiyer/hermes-aws-ts');
  assert.equal(TELEGRAM_ROUTING_CONTRACT.sourceCommit, '67ba40cda9fb935eb5b2a9955cc7edb5bd579657');
  assert.match(TELEGRAM_ROUTING_CONTRACT.tracker, /^https:\/\/github\.com\/Sheshiyer\/hermes-aws-ts\/issues\/\d+$/);
});

test('Telegram routing snapshot uses the current Hermes Dev topic and stable Clients topic', () => {
  assert.equal(THOUGHTSEED_TELEGRAM_CHAT_ID, '-1002691202808');
  assert.equal(TOPIC_QUEST_ROUTES.dev.threadId, 862);
  assert.equal(TOPIC_QUEST_ROUTES.clients.threadId, 804);
  assert.deepEqual(Object.keys(TOPIC_QUEST_ROUTES), [
    'hermes', 'digests', 'dev', 'inbox', 'calendar', 'agent_ops', 'alerts', 'clients',
  ]);
});
