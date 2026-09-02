import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TELEGRAM_ROUTING_CONTRACT,
  THOUGHTSEED_TELEGRAM_CHAT_ID,
  TOPIC_QUEST_ROUTES,
} from './telegram-routing.ts';

test('Telegram routing snapshot records its Hermes provenance', () => {
  assert.equal(TELEGRAM_ROUTING_CONTRACT.schema, 'thoughtseed.telegram-topic-map.v1');
  assert.equal(TELEGRAM_ROUTING_CONTRACT.sourceRepository, 'Sheshiyer/hermes-aws-ts');
  assert.equal(TELEGRAM_ROUTING_CONTRACT.sourceCommit, '1931f6c2d0d9260cfbf29c37413e1504e7ebf9e4');
  assert.equal(TELEGRAM_ROUTING_CONTRACT.manifestSha256, 'edcbbb34bb468107400767442df8c772c418a40a9e3747651404a23ec33c7d2a');
  assert.match(TELEGRAM_ROUTING_CONTRACT.tracker, /^https:\/\/github\.com\/Sheshiyer\/hermes-aws-ts\/issues\/\d+$/);
});

test('Telegram routing snapshot uses the current Thoughtseed Labs forum topics', () => {
  assert.equal(THOUGHTSEED_TELEGRAM_CHAT_ID, '-1003942929819');
  assert.equal(TOPIC_QUEST_ROUTES.dev.threadId, 4);
  assert.equal(TOPIC_QUEST_ROUTES.clients.threadId, 9);
  assert.deepEqual(Object.keys(TOPIC_QUEST_ROUTES), [
    'hermes', 'digests', 'dev', 'inbox', 'calendar', 'agent_ops', 'alerts', 'clients',
  ]);
});
