import assert from 'node:assert/strict';
import test from 'node:test';

import { recordWorkflowLearningEvent, summarizeWorkflowLearningMonth, type WorkflowLearningKvLike } from './workflow-learning.ts';

function fakeKv(): WorkflowLearningKvLike {
  const rows = new Map<string, string>();
  return {
    async get(key) { return rows.get(key) ?? null; },
    async put(key, value) { rows.set(key, value); },
    async list(prefix) { return [...rows.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

test('monthly Ralph evidence loop groups bounded failures without changing workflows', async () => {
  const kv = fakeKv();
  for (const [id, kind, rootCause] of [
    ['evt-1', 'failed', 'renderer_timeout'],
    ['evt-2', 'retry_exhausted', 'renderer_timeout'],
    ['evt-3', 'missed_cron', 'scheduler_gap'],
  ] as const) {
    const recorded = await recordWorkflowLearningEvent(kv, {
      schema: 'thoughtseed.workflow-learning-event.v1', id, tenantId: 'cambium',
      workflowId: 'thoughtseed.hr.monthly-payroll.v1', at: '2026-08-18T10:00:00.000Z',
      kind, rootCause, summary: 'Safe bounded operational evidence', retryable: true,
      source: 'hermes',
    });
    assert.equal(recorded.status, 200);
  }

  const summary = await summarizeWorkflowLearningMonth(kv, { tenantId: 'cambium', month: '2026-08' });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.eventCount, 3);
  assert.deepEqual(summary.body.rootCauses, [
    { rootCause: 'renderer_timeout', count: 2 },
    { rootCause: 'scheduler_gap', count: 1 },
  ]);
  assert.equal(summary.body.automaticChanges, false);
  assert.equal((summary.body.replayCases as any[]).length, 2);
});

test('learning event storage rejects secrets and idempotency conflicts', async () => {
  const kv = fakeKv();
  const base = {
    schema: 'thoughtseed.workflow-learning-event.v1', id: 'evt-1', tenantId: 'cambium',
    workflowId: 'thoughtseed.hr.monthly-payroll.v1', at: '2026-08-18T10:00:00.000Z',
    kind: 'failed', rootCause: 'renderer_timeout', summary: 'Safe evidence', retryable: true, source: 'hermes',
  };
  assert.equal((await recordWorkflowLearningEvent(kv, base)).status, 200);
  assert.equal((await recordWorkflowLearningEvent(kv, base)).body.duplicate, true);
  assert.equal((await recordWorkflowLearningEvent(kv, { ...base, summary: 'different evidence' })).status, 409);
  assert.equal((await recordWorkflowLearningEvent(kv, { ...base, id: 'evt-secret', summary: 'Authorization: Bearer top-secret' })).status, 400);
});

