// cambium-quests · topic-map drift guard (node:test, like everything beside it).
//
// Cambium vendors a byte-identical copy of the Hermes-owned canonical manifest
// `thoughtseed.telegram-topic-map.v1` (Hermes owns Telegram routing). This test
// pins the vendored copy by SHA-256 and asserts the Worker's inline
// TOPIC_QUEST_ROUTES matches it — so a divergence like the 2026-07 Dev
// `799`/`862` drift (#88) fails CI instead of misrouting Dev-topic signal.
//
// To update: re-copy the canonical file from the Hermes repo
// (hermes-aws-ts/contracts/thoughtseed.telegram-topic-map.v1.json) into this
// directory, set PIN to its new SHA-256, and reconcile TOPIC_QUEST_ROUTES.
// See hermes-aws-ts/contracts/README.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { TOPIC_QUEST_ROUTES, THOUGHTSEED_TELEGRAM_CHAT_ID } from './handler.ts';

/** SHA-256 (hex) of the canonical Hermes manifest at time of vendoring. */
const PIN = '520fef0b316f8029e858674e7bb948be997d772f0b2ccffd64a3dfd0b6eebd8c';

const VENDORED_URL = new URL('./telegram-topic-map.v1.json', import.meta.url);
const VENDORED_BYTES = readFileSync(VENDORED_URL);

interface VendoredTopic {
  topicName: string;
  threadId: number;
  questId: string;
  priority: string;
  taskType: string;
}
interface VendoredMap {
  version: string;
  chatId: string;
  topics: Record<string, VendoredTopic>;
}

const vendored = JSON.parse(VENDORED_BYTES.toString('utf8')) as VendoredMap;

test('vendored topic map matches the pinned canonical digest', () => {
  const digest = createHash('sha256').update(VENDORED_BYTES).digest('hex');
  assert.equal(
    digest,
    PIN,
    'vendored telegram-topic-map.v1.json changed without updating PIN (re-vendor from Hermes canonical)',
  );
});

test('handler chat id matches the vendored manifest', () => {
  assert.equal(THOUGHTSEED_TELEGRAM_CHAT_ID, vendored.chatId);
});

test('handler TOPIC_QUEST_ROUTES matches the vendored canonical manifest', () => {
  const routeKeys = Object.keys(TOPIC_QUEST_ROUTES).sort();
  const manifestKeys = Object.keys(vendored.topics).sort();
  assert.deepEqual(routeKeys, manifestKeys, 'handler topic keys drifted from the manifest');

  for (const key of manifestKeys) {
    const topic = vendored.topics[key];
    const route = TOPIC_QUEST_ROUTES[key as keyof typeof TOPIC_QUEST_ROUTES];
    assert.equal(route.topicName, topic.topicName, `${key}: topicName drift`);
    assert.equal(route.threadId, topic.threadId, `${key}: threadId drift`);
    assert.equal(route.questId, topic.questId, `${key}: questId drift`);
    assert.equal(route.priority, topic.priority, `${key}: priority drift`);
    assert.equal(route.taskType, topic.taskType, `${key}: taskType drift`);
  }
});
