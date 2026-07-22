import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { d1LeadRuntimeStore } from './lead-runtime-store.ts';
import {
  executeLeadStages,
  runIverifCaptureEnrich,
  validateLeadStageDag,
} from './lead-runtime.ts';
import type { IVerifExpleeObserver } from './iverif-explee.ts';

const NOW = '2026-07-20T12:00:00.000Z';

class SqliteD1 {
  db = new DatabaseSync(':memory:');

  prepare(sql: string) {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api = {
      bind: (...next: unknown[]) => {
        values = next;
        return api;
      },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => {
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return api;
  }
}

async function harness() {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0006_lead_runtime_spine.sql', import.meta.url), 'utf8'));
  return { db, store: d1LeadRuntimeStore(db) };
}

function sequentialUuid() {
  let value = 0;
  return () => `runtime-id-${String(++value).padStart(3, '0')}`;
}

function observerFixture(calls: string[]): Pick<IVerifExpleeObserver, 'getNeedReplyInbox' | 'getThread'> {
  return {
    async getNeedReplyInbox() {
      calls.push('inbox');
      return {
        source: { provider: 'explee-public-api', observedAt: NOW },
        tab: 'need_reply',
        contacts: [
          {
            personId: 'person-z', latestIntent: null, sentCount: 1, replyCount: 1,
            latestSentAt: null, latestReplyAt: null,
          },
          {
            personId: 'person-a', latestIntent: 'hot_lead', sentCount: 2, replyCount: 1,
            latestSentAt: '2026-07-20T11:00:00.000Z',
            latestReplyAt: '2026-07-20T11:30:00.000Z',
          },
        ],
        total: 2,
        omittedContacts: 0,
        pageCount: 1,
        truncated: false,
      };
    },
    async getThread(personId: string) {
      calls.push(`thread:${personId}`);
      return {
        source: { provider: 'explee-public-api', observedAt: NOW },
        personId,
        canReply: true,
        replyBlockedReason: null,
        latestIntent: 'hot_lead',
        messageCount: 1,
        truncated: false,
        messages: [{
          messageId: `sha256:${'b'.repeat(64)}`,
          type: 'reply',
          intent: 'hot_lead',
          status: null,
          timestamp: '2026-07-20T11:30:00.000Z',
        }],
      };
    },
  };
}

test('DAG validation is bounded and execution follows deterministic topological order', async () => {
  const calls: string[] = [];
  const stages = [
    { id: 'enrich', dependsOn: ['capture'], execute: async () => calls.push('enrich') },
    { id: 'discover', execute: async () => calls.push('discover') },
    { id: 'capture', dependsOn: ['discover'], execute: async () => calls.push('capture') },
  ];
  assert.deepEqual(validateLeadStageDag(stages), ['discover', 'capture', 'enrich']);
  const result = await executeLeadStages({ stages });
  assert.deepEqual(result.order, ['discover', 'capture', 'enrich']);
  assert.deepEqual(calls, ['discover', 'capture', 'enrich']);

  assert.throws(() => validateLeadStageDag([
    { id: 'a', dependsOn: ['b'], execute: async () => undefined },
    { id: 'b', dependsOn: ['a'], execute: async () => undefined },
  ]), /lead_stage_cycle/);
  assert.throws(() => validateLeadStageDag(Array.from({ length: 17 }, (_, index) => ({
    id: `stage-${index}`,
    execute: async () => undefined,
  }))), /lead_stage_graph_size_invalid/);
});

test('a failed stage blocks dependents and missing spend authority prevents adapter invocation', async () => {
  const calls: string[] = [];
  const result = await executeLeadStages({
    stages: [
      {
        id: 'capture',
        async execute() {
          calls.push('capture');
          throw Object.assign(new Error('capture_failed'), { code: 'capture_failed' });
        },
      },
      {
        id: 'enrich',
        dependsOn: ['capture'],
        async execute() {
          calls.push('enrich');
        },
      },
      {
        id: 'paid-create',
        metered: true,
        async execute() {
          calls.push('paid-create');
        },
      },
    ],
  });
  assert.deepEqual(calls, ['capture']);
  assert.deepEqual(result.stages.capture, { status: 'failed', code: 'capture_failed' });
  assert.deepEqual(result.stages.enrich, {
    status: 'blocked', code: 'dependency_not_completed', dependencies: ['capture'],
  });
  assert.deepEqual(result.stages['paid-create'], { status: 'failed', code: 'spend_reservation_required' });
});

test('stop rules are checked immediately before the next adapter call', async () => {
  let adapterCalls = 0;
  const result = await executeLeadStages({
    stages: [{
      id: 'capture',
      async execute() {
        adapterCalls += 1;
      },
    }],
    shouldStop: () => true,
  });
  assert.equal(adapterCalls, 0);
  assert.deepEqual(result.stages.capture, { status: 'stopped', code: 'stop_rule_matched' });
});

test('bounded Iverif capture/enrich persists one canonical lead, GET receipt, and deliberate zero settlement', async () => {
  const { db, store } = await harness();
  const calls: string[] = [];
  const result = await runIverifCaptureEnrich({
    tenantId: 'thoughtseed',
    idempotencyKey: 'iverif-run-001',
    observer: observerFixture(calls),
    store,
    now: () => NOW,
    uuid: sequentialUuid(),
  });
  assert.equal(result.status, 'completed');
  if (result.status !== 'completed') return;
  assert.deepEqual(calls, ['inbox', 'thread:person-a']);
  assert.equal(result.receipt.observationCount, 1);
  assert.equal(result.receipt.spendUnits, 0);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_records').get().count, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_source_aliases').get().count, 1);
  assert.deepEqual({ ...db.db.prepare(`
    SELECT method, provider_id, source_id FROM lead_observation_receipts
  `).get() }, { method: 'GET', provider_id: 'explee-public-api', source_id: 'person-a' });
  assert.deepEqual({ ...db.db.prepare(`
    SELECT r.status, r.reserved_units, r.settled_units, u.used_units
    FROM lead_spend_reservations r
    JOIN lead_provider_usage u ON u.reservation_id = r.reservation_id
  `).get() }, { status: 'settled', reserved_units: 0, settled_units: 0, used_units: 0 });
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_cortex_foldbacks').get().count, 1);
  const foldback = db.db.prepare('SELECT * FROM lead_cortex_foldbacks').get();
  assert.ok(Object.keys(foldback).every((key) => !/(email|phone|source_id|lead_id|alias|identity|payload)/i.test(key)));
});

test('replaying the Iverif task returns its prior receipt without provider calls or duplicate leads', async () => {
  const { db, store } = await harness();
  const firstCalls: string[] = [];
  const first = await runIverifCaptureEnrich({
    tenantId: 'thoughtseed', idempotencyKey: 'iverif-run-001',
    observer: observerFixture(firstCalls), store, now: () => NOW, uuid: sequentialUuid(),
  });
  assert.equal(first.status, 'completed');
  const replayCalls: string[] = [];
  const replay = await runIverifCaptureEnrich({
    tenantId: 'thoughtseed', idempotencyKey: 'iverif-run-001',
    observer: observerFixture(replayCalls), store,
    now: () => '2026-07-20T13:00:00.000Z', uuid: sequentialUuid(),
  });
  assert.equal(replay.status, 'replay');
  if (first.status === 'completed' && replay.status === 'replay') {
    assert.equal(replay.receipt.leadId, first.receipt.leadId);
    assert.equal(replay.receipt.replayed, true);
  }
  assert.deepEqual(replayCalls, []);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_records').get().count, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_observation_receipts').get().count, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_provider_usage').get().count, 1);
});

test('Iverif stop rule durably stops the task before any observer call', async () => {
  const { db, store } = await harness();
  const calls: string[] = [];
  const result = await runIverifCaptureEnrich({
    tenantId: 'thoughtseed', idempotencyKey: 'iverif-run-stopped',
    observer: observerFixture(calls), store, now: () => NOW,
    uuid: sequentialUuid(), shouldStop: ({ nextStage }) => nextStage === 'capture',
  });
  assert.deepEqual(result, { status: 'stopped', code: 'stop_before_capture' });
  assert.deepEqual(calls, []);
  assert.equal(db.db.prepare(`
    SELECT status FROM lead_loop_tasks WHERE idempotency_key = 'iverif-run-stopped'
  `).get().status, 'stopped');
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_records').get().count, 0);
});

test('expired lease with a persisted observation reconciles without another provider read', async () => {
  const { store } = await harness();
  const uuid = sequentialUuid();
  const firstCalls: string[] = [];
  const ambiguousStore = {
    ...store,
    async recordObservation(input: Parameters<typeof store.recordObservation>[0]) {
      await store.recordObservation(input);
      throw new Error('post_observation_crash');
    },
  };
  await assert.rejects(runIverifCaptureEnrich({
    tenantId: 'thoughtseed',
    idempotencyKey: 'iverif-run-observation-reconcile',
    observer: observerFixture(firstCalls),
    store: ambiguousStore,
    now: () => NOW,
    uuid,
  }), /post_observation_crash/);
  assert.deepEqual(firstCalls, ['inbox', 'thread:person-a']);

  const replayCalls: string[] = [];
  const reconciled = await runIverifCaptureEnrich({
    tenantId: 'thoughtseed',
    idempotencyKey: 'iverif-run-observation-reconcile',
    observer: observerFixture(replayCalls),
    store,
    now: () => '2026-07-20T13:00:00.000Z',
    uuid,
  });
  assert.equal(reconciled.status, 'completed');
  assert.deepEqual(replayCalls, []);
});

test('expired lease without a durable observation fails closed before provider replay', async () => {
  const { store } = await harness();
  const uuid = sequentialUuid();
  const interruptedStore = {
    ...store,
    async reserveSpend() {
      throw new Error('pre_observation_crash');
    },
  };
  await assert.rejects(runIverifCaptureEnrich({
    tenantId: 'thoughtseed',
    idempotencyKey: 'iverif-run-reconciliation-required',
    observer: observerFixture([]),
    store: interruptedStore,
    now: () => NOW,
    uuid,
  }), /pre_observation_crash/);

  const replayCalls: string[] = [];
  const reconciled = await runIverifCaptureEnrich({
    tenantId: 'thoughtseed',
    idempotencyKey: 'iverif-run-reconciliation-required',
    observer: observerFixture(replayCalls),
    store,
    now: () => '2026-07-20T13:00:00.000Z',
    uuid,
  });
  assert.deepEqual(reconciled, {
    status: 'failed',
    code: 'lead_run_reconciliation_required',
  });
  assert.deepEqual(replayCalls, []);
  assert.equal((await store.getTask('thoughtseed', 'runtime-id-001'))?.status, 'failed');
});
