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
  assert.equal(TELEGRAM_ROUTING_CONTRACT.sourceCommit, '0e4736254b1846259b2ea317fb791cc6e9b7e312');
  assert.equal(TELEGRAM_ROUTING_CONTRACT.manifestSha256, '520fef0b316f8029e858674e7bb948be997d772f0b2ccffd64a3dfd0b6eebd8c');
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
