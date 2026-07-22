import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { d1LeadRuntimeStore } from './lead-runtime-store.ts';
import type { LeadTaskReceipt } from './lead-runtime-store.ts';

const NOW = '2026-07-20T12:00:00.000Z';
const DIGEST = 'a'.repeat(64);

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

async function taskFixture(store: ReturnType<typeof d1LeadRuntimeStore>, suffix = '001') {
  const result = await store.createTask({
    taskId: `lead-task-${suffix}`,
    tenantId: 'thoughtseed',
    idempotencyKey: `lead-task-idempotency-${suffix}`,
    inputDigest: DIGEST,
    createdAt: NOW,
  });
  assert.notEqual(result.status, 'conflict');
  return result.status === 'conflict' ? null : result.task;
}

test('canonical lead capture replays one source alias and fails closed on normalized-email conflict', async () => {
  const { db, store } = await harness();
  const first = await store.captureLead({
    leadId: 'lead-001',
    aliasId: 'alias-001',
    tenantId: 'thoughtseed',
    providerId: 'synthetic-provider',
    sourceId: 'source-001',
    normalizedEmail: '  Person@Example.COM ',
    observedAt: NOW,
  });
  assert.equal(first.status, 'created');
  if (first.status === 'conflict') return;
  assert.equal(first.lead.normalizedEmail, 'person@example.com');

  const replay = await store.captureLead({
    leadId: 'lead-must-not-win',
    aliasId: 'alias-must-not-win',
    tenantId: 'thoughtseed',
    providerId: 'synthetic-provider',
    sourceId: 'source-001',
    normalizedEmail: 'person@example.com',
    observedAt: '2026-07-20T12:01:00.000Z',
  });
  assert.equal(replay.status, 'duplicate');
  if (replay.status !== 'conflict') assert.equal(replay.lead.leadId, 'lead-001');

  const conflict = await store.captureLead({
    leadId: 'lead-002',
    aliasId: 'alias-002',
    tenantId: 'thoughtseed',
    providerId: 'synthetic-provider',
    sourceId: 'source-002',
    normalizedEmail: 'PERSON@example.com',
    observedAt: '2026-07-20T12:02:00.000Z',
  });
  assert.deepEqual(conflict, { status: 'conflict', code: 'normalized_email_conflict' });
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_records').get().count, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_source_aliases').get().count, 1);

  assert.throws(() => db.db.prepare(`
    INSERT INTO lead_source_aliases (
      alias_id, tenant_id, lead_id, provider_id, source_id, first_observed_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run('alias-duplicate', 'thoughtseed', 'lead-001', 'synthetic-provider', 'source-001', NOW));
});

test('canonical lead capture repairs a deterministic lead left before its alias write', async () => {
  const { db, store } = await harness();
  db.db.prepare(`
    INSERT INTO lead_records (lead_id, tenant_id, normalized_email, created_at)
    VALUES (?, ?, ?, ?)
  `).run('lead-deterministic-001', 'thoughtseed', null, NOW);

  const repaired = await store.captureLead({
    leadId: 'lead-deterministic-001',
    aliasId: 'alias-deterministic-001',
    tenantId: 'thoughtseed',
    providerId: 'explee-public-api',
    sourceId: 'person-repair-001',
    observedAt: '2026-07-20T12:01:00.000Z',
  });

  assert.equal(repaired.status, 'duplicate');
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_records').get().count, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM lead_source_aliases').get().count, 1);
});

test('GET observation receipts are idempotent and immutable at the database boundary', async () => {
  const { db, store } = await harness();
  await store.captureLead({
    leadId: 'lead-001', aliasId: 'alias-001', tenantId: 'thoughtseed',
    providerId: 'explee-public-api', sourceId: 'person-001', observedAt: NOW,
  });
  const receipt = {
    observationReceiptId: 'observation-001',
    tenantId: 'thoughtseed',
    leadId: 'lead-001',
    providerId: 'explee-public-api',
    sourceId: 'person-001',
    method: 'GET' as const,
    idempotencyKey: 'observe-001',
    observationDigest: DIGEST,
    observedAt: NOW,
    recordedAt: NOW,
  };
  assert.equal((await store.recordObservation(receipt)).status, 'recorded');
  assert.equal((await store.recordObservation(receipt)).status, 'duplicate');
  assert.deepEqual(await store.recordObservation({ ...receipt, observationDigest: 'b'.repeat(64) }), {
    status: 'conflict',
    code: 'observation_idempotency_conflict',
  });
  assert.throws(() => db.db.prepare(`
    UPDATE lead_observation_receipts SET observation_digest = ?
    WHERE observation_receipt_id = ?
  `).run('c'.repeat(64), receipt.observationReceiptId), /immutable/);
  assert.throws(() => db.db.prepare(`
    DELETE FROM lead_observation_receipts WHERE observation_receipt_id = ?
  `).run(receipt.observationReceiptId), /immutable/);
});

test('spend reservation idempotency and settlement enforce usage at or below the reservation', async () => {
  const { db, store } = await harness();
  await taskFixture(store);
  const reservationInput = {
    reservationId: 'reservation-001',
    tenantId: 'thoughtseed',
    taskId: 'lead-task-001',
    providerId: 'synthetic-metered-provider',
    idempotencyKey: 'reservation-idempotency-001',
    reservedUnits: 100,
    createdAt: NOW,
  };
  assert.equal((await store.reserveSpend(reservationInput)).status, 'reserved');
  assert.equal((await store.reserveSpend({ ...reservationInput, reservationId: 'reservation-ignored' })).status, 'duplicate');
  assert.deepEqual(await store.reserveSpend({ ...reservationInput, reservedUnits: 101 }), {
    status: 'conflict',
    code: 'spend_reservation_idempotency_conflict',
  });
  assert.deepEqual(await store.settleUsage({
    usageId: 'usage-too-large',
    tenantId: 'thoughtseed',
    taskId: 'lead-task-001',
    reservationId: 'reservation-001',
    providerId: 'synthetic-metered-provider',
    idempotencyKey: 'usage-too-large',
    usedUnits: 101,
    receiptDigest: DIGEST,
    recordedAt: NOW,
  }), { status: 'conflict', code: 'provider_usage_exceeds_reservation' });
  assert.throws(() => db.db.prepare(`
    UPDATE lead_spend_reservations
    SET status = 'settled', settled_units = 0, settled_at = ?
    WHERE reservation_id = ?
  `).run(NOW, 'reservation-001'), /requires usage receipt/);

  const usageInput = {
    usageId: 'usage-001',
    tenantId: 'thoughtseed',
    taskId: 'lead-task-001',
    reservationId: 'reservation-001',
    providerId: 'synthetic-metered-provider',
    idempotencyKey: 'usage-idempotency-001',
    usedUnits: 80,
    receiptDigest: DIGEST,
    recordedAt: NOW,
  };
  assert.equal((await store.settleUsage(usageInput)).status, 'recorded');
  assert.equal((await store.settleUsage(usageInput)).status, 'duplicate');
  const settled = await store.getSpendReservation('thoughtseed', reservationInput.idempotencyKey);
  assert.equal(settled?.status, 'settled');
  assert.equal(settled?.settledUnits, 80);
  assert.throws(() => db.db.prepare(`
    UPDATE lead_spend_reservations SET settled_units = 79 WHERE reservation_id = ?
  `).run('reservation-001'), /immutable/);
  assert.throws(() => db.db.prepare(`
    UPDATE lead_provider_usage SET used_units = 79 WHERE usage_id = ?
  `).run('usage-001'), /immutable/);
});

test('task leases use fencing CAS and completed tasks replay their persisted receipt', async () => {
  const { store } = await harness();
  await taskFixture(store);
  const first = await store.claimTask({
    taskId: 'lead-task-001', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-001', claimedAt: NOW, leaseExpiresAt: '2026-07-20T12:05:00.000Z',
  });
  assert.deepEqual(first, {
    status: 'claimed', taskId: 'lead-task-001', claimId: 'claim-001', fencingToken: 1,
    leaseExpiresAt: '2026-07-20T12:05:00.000Z',
  });
  assert.deepEqual(await store.claimTask({
    taskId: 'lead-task-001', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-002', claimedAt: '2026-07-20T12:01:00.000Z',
    leaseExpiresAt: '2026-07-20T12:06:00.000Z',
  }), { status: 'busy', retryAfterMs: 240_000 });
  const takeover = await store.claimTask({
    taskId: 'lead-task-001', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-002', claimedAt: '2026-07-20T12:06:00.000Z',
    leaseExpiresAt: '2026-07-20T12:11:00.000Z',
  });
  assert.equal(takeover.status, 'claimed');
  if (takeover.status !== 'claimed') return;
  assert.equal(takeover.fencingToken, 2);

  const receipt: LeadTaskReceipt = {
    schemaVersion: 'lead_operator_receipt@1.0.0',
    taskId: 'lead-task-001',
    state: 'completed',
    leadId: 'lead-001',
    observationCount: 1,
    stagesCompleted: 2,
    spendUnits: 0,
    replayed: false,
    updatedAt: '2026-07-20T12:07:00.000Z',
  };
  assert.deepEqual(await store.completeTask({
    taskId: 'lead-task-001', claimId: 'claim-001', fencingToken: 1,
    receipt, completedAt: receipt.updatedAt,
  }), { status: 'conflict' });
  assert.equal((await store.completeTask({
    taskId: 'lead-task-001', claimId: takeover.claimId, fencingToken: takeover.fencingToken,
    receipt, completedAt: receipt.updatedAt,
  })).status, 'recorded');

  const replay = await store.claimTask({
    taskId: 'lead-task-001', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-003', claimedAt: '2026-07-20T12:20:00.000Z',
    leaseExpiresAt: '2026-07-20T12:25:00.000Z',
  });
  assert.equal(replay.status, 'terminal');
  if (replay.status === 'terminal' && replay.state === 'completed') {
    assert.equal(replay.receipt.leadId, 'lead-001');
    assert.equal(replay.receipt.replayed, true);
  }
});

test('loop tasks durably support failed and stopped terminal states', async () => {
  const { store } = await harness();
  await taskFixture(store, 'failed');
  const failedClaim = await store.claimTask({
    taskId: 'lead-task-failed', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-failed', claimedAt: NOW, leaseExpiresAt: '2026-07-20T12:05:00.000Z',
  });
  assert.equal(failedClaim.status, 'claimed');
  if (failedClaim.status === 'claimed') {
    assert.equal(await store.failTask({
      taskId: failedClaim.taskId, claimId: failedClaim.claimId,
      fencingToken: failedClaim.fencingToken, errorCode: 'adapter_failed', failedAt: NOW,
    }), 'recorded');
  }
  assert.equal((await store.getTask('thoughtseed', 'lead-task-failed'))?.status, 'failed');

  await taskFixture(store, 'stopped');
  const stoppedClaim = await store.claimTask({
    taskId: 'lead-task-stopped', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-stopped', claimedAt: NOW, leaseExpiresAt: '2026-07-20T12:05:00.000Z',
  });
  assert.equal(stoppedClaim.status, 'claimed');
  if (stoppedClaim.status === 'claimed') {
    assert.equal(await store.stopTask({
      taskId: stoppedClaim.taskId, claimId: stoppedClaim.claimId,
      fencingToken: stoppedClaim.fencingToken, reason: 'operator_stop', stoppedAt: NOW,
    }), 'recorded');
  }
  assert.equal((await store.getTask('thoughtseed', 'lead-task-stopped'))?.status, 'stopped');
});

test('cortex foldback persists derived numeric projection without a raw identity column', async () => {
  const { db, store } = await harness();
  await taskFixture(store);
  assert.throws(() => db.db.prepare(`
    INSERT INTO lead_cortex_foldbacks (
      foldback_id, tenant_id, task_id, transformation_version,
      leads_captured, observations_recorded, stages_completed, spend_units, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'foldback-premature', 'thoughtseed', 'lead-task-001', 'lead-runtime-derived-v1',
    1, 1, 2, 0, NOW,
  ), /must derive from completed task receipt/);
  const claim = await store.claimTask({
    taskId: 'lead-task-001', tenantId: 'thoughtseed', inputDigest: DIGEST,
    claimId: 'claim-foldback-001', claimedAt: NOW, leaseExpiresAt: '2026-07-20T12:05:00.000Z',
  });
  assert.equal(claim.status, 'claimed');
  if (claim.status !== 'claimed') return;
  assert.throws(() => db.db.prepare(`
    UPDATE lead_loop_tasks
    SET status = 'completed', receipt_json = '{}', updated_at = ?, terminal_at = ?
    WHERE task_id = ?
  `).run(NOW, NOW, 'lead-task-001'), /completed lead task receipt is invalid/);
  const receipt: LeadTaskReceipt = {
    schemaVersion: 'lead_operator_receipt@1.0.0',
    taskId: 'lead-task-001',
    state: 'completed',
    leadId: 'lead-001',
    observationCount: 1,
    stagesCompleted: 2,
    spendUnits: 0,
    replayed: false,
    updatedAt: NOW,
  };
  assert.equal((await store.completeTask({
    taskId: claim.taskId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    receipt,
    completedAt: NOW,
  })).status, 'recorded');
  const foldbackInput = {
    foldbackId: 'foldback-001',
    tenantId: 'thoughtseed',
    taskId: 'lead-task-001',
  };
  const foldback = {
    ...foldbackInput,
    transformationVersion: 'lead-runtime-derived-v1',
    leadsCaptured: 1,
    observationsRecorded: 1,
    stagesCompleted: 2,
    spendUnits: 0,
    completedAt: NOW,
  };
  assert.equal(await store.recordFoldback({
    ...foldbackInput,
    foldbackId: 'foldback-missing-task',
    taskId: 'missing-task',
  }), 'conflict');
  assert.equal(await store.recordFoldback({
    ...foldbackInput,
    foldbackId: 'foldback-wrong-tenant',
    tenantId: 'other-tenant',
  }), 'conflict');
  assert.equal(await store.recordFoldback({
    ...foldbackInput,
    observationsRecorded: 999,
    stagesCompleted: 999,
    spendUnits: 999,
  } as unknown as Parameters<typeof store.recordFoldback>[0]), 'conflict');
  assert.throws(() => db.db.prepare(`
    INSERT INTO lead_cortex_foldbacks (
      foldback_id, tenant_id, task_id, transformation_version,
      leads_captured, observations_recorded, stages_completed, spend_units, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'foldback-poisoned', 'thoughtseed', 'lead-task-001', 'lead-runtime-derived-v1',
    999, 999, 999, 999, '1999-01-01T00:00:00.000Z',
  ), /must derive from completed task receipt/);
  assert.equal(await store.recordFoldback(foldbackInput), 'recorded');
  assert.equal(await store.recordFoldback({ ...foldbackInput, foldbackId: 'foldback-replay' }), 'duplicate');
  assert.deepEqual(await store.getFoldback('thoughtseed', 'lead-task-001'), foldback);
  assert.equal(await store.getFoldback('other-tenant', 'lead-task-001'), null);
  const columns = db.db.prepare(`PRAGMA table_info('lead_cortex_foldbacks')`).all()
    .map((column) => String(column.name));
  assert.ok(columns.every((column) => !/(email|phone|alias|source_id|lead_id|identity|payload|text)/i.test(column)));
});
