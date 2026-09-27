// cambium-quests · topic-map drift guard.
//
// Hermes owns Telegram topology. Cambium vendors the canonical manifest and
// checks that its runtime snapshot cannot silently drift from that contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  TELEGRAM_ROUTING_CONTRACT,
  TOPIC_QUEST_ROUTES,
  THOUGHTSEED_TELEGRAM_CHAT_ID,
} from './telegram-routing.ts';

/** SHA-256 of the canonical Hermes manifest at time of vendoring. */
const PIN = 'edcbbb34bb468107400767442df8c772c418a40a9e3747651404a23ec33c7d2a';

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
  assert.equal(TELEGRAM_ROUTING_CONTRACT.manifestSha256, PIN);
  assert.equal(
    digest,
    PIN,
    'vendored telegram-topic-map.v1.json changed without updating PIN (re-vendor from Hermes canonical)',
  );
});

test('runtime chat id matches the vendored manifest', () => {
  assert.equal(THOUGHTSEED_TELEGRAM_CHAT_ID, vendored.chatId);
});

test('runtime topic routes match the vendored canonical manifest', () => {
  const routeKeys = Object.keys(TOPIC_QUEST_ROUTES).sort();
  const manifestKeys = Object.keys(vendored.topics).sort();
  assert.deepEqual(routeKeys, manifestKeys, 'runtime topic keys drifted from the manifest');

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
