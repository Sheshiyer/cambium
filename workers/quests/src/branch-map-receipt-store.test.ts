import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import type { BranchMapReceipt } from './branch-map.ts';
import {
  d1BranchMapReceiptStore,
  type BranchMapReceiptD1DatabaseLike,
  type BranchMapReceiptD1StatementLike,
} from './branch-map-receipt-store.ts';

class SqliteD1 implements BranchMapReceiptD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');

  prepare(sql: string): BranchMapReceiptD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: BranchMapReceiptD1StatementLike = {
      bind: (...next: unknown[]) => { values = next; return api; },
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

const NOW = '2026-07-23T12:00:00.000Z';

function receipt(overrides: Partial<BranchMapReceipt> = {}): BranchMapReceipt {
  return {
    receiptId: 'receipt-001', tenantId: 'tenant-alpha', branchId: 'branch-a',
    organId: 'organ-1', organName: 'Genesis', fromNodeId: null, toNodeId: 'node-root',
    observedAt: NOW, evidenceRefs: ['source:one'], sourceRef: 'source:branch-a',
    sourceDigest: `sha256:${'a'.repeat(64)}`, graphVersion: 1, status: 'verified',
    ...overrides,
  };
}

async function harness() {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0008_branch_transition_receipts.sql', import.meta.url), 'utf8'));
  return { db, store: d1BranchMapReceiptStore(db) };
}

test('stores a tenant-scoped receipt and replays identical bytes idempotently', async () => {
  const { db, store } = await harness();
  const original = receipt();
  const stored = await store.recordReceipt(original, NOW);
  assert.equal(stored.status, 'stored');
  assert.equal(stored.replayed, false);
  const replay = await store.appendReceipt(original, '2026-07-23T13:00:00.000Z');
  assert.equal(replay.status, 'duplicate');
  assert.equal(replay.replayed, true);
  assert.deepEqual(await store.getReceipt('tenant-alpha', original.receiptId), original);
  assert.equal((await store.listReceipts('tenant-alpha')).length, 1);
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM goal_graph_branch_transition_receipts').get().count, 1);
});

test('same receipt ID with changed evidence is a conflict and tenants cannot cross-read', async () => {
  const { store } = await harness();
  const original = receipt();
  assert.equal((await store.recordReceipt(original)).status, 'stored');
  assert.equal((await store.recordReceipt({ ...original, tenantId: 'tenant-other' })).status, 'stored');
  const conflict = await store.recordReceipt({ ...original, evidenceRefs: ['tampered'] });
  assert.deepEqual(conflict, { status: 'conflict', replayed: false, code: 'receipt_identity_conflict' });
  assert.equal((await store.getReceipt('tenant-other', original.receiptId))?.tenantId, 'tenant-other');
  assert.equal((await store.listReceipts('tenant-other')).length, 1);
});

test('a different receipt ID cannot duplicate a tenant receipt digest', async () => {
  const { store } = await harness();
  const original = receipt();
  assert.equal((await store.recordReceipt(original)).status, 'stored');
  const duplicate = await store.recordReceipt({ ...original, receiptId: 'receipt-002' });
  assert.equal(duplicate.status, 'duplicate');
  if (duplicate.status === 'duplicate') assert.equal(duplicate.receipt.receiptId, original.receiptId);
});

test('receipt and database rows are append-only', async () => {
  const { db, store } = await harness();
  const original = receipt();
  assert.equal((await store.recordReceipt(original)).status, 'stored');
  assert.throws(() => db.db.prepare('UPDATE goal_graph_branch_transition_receipts SET status = ?').run('blocked'), /immutable/);
  assert.throws(() => db.db.prepare('DELETE FROM goal_graph_branch_transition_receipts').run(), /immutable/);
});

test('invalid transition is rejected before persistence', async () => {
  const { db, store } = await harness();
  const result = await store.recordReceipt(receipt({ fromNodeId: 'node-root', toNodeId: 'node-root' }));
  assert.equal(result.status, 'conflict');
  if (result.status === 'conflict') assert.equal(result.code, 'receipt_invalid');
  assert.equal(db.db.prepare('SELECT count(*) AS count FROM goal_graph_branch_transition_receipts').get().count, 0);
});

test('receipt listing is bounded and ordered by observed time then receipt ID', async () => {
  const { store } = await harness();
  await store.recordReceipt(receipt({ receiptId: 'receipt-late', observedAt: '2026-07-23T12:02:00.000Z', evidenceRefs: ['late'] }));
  await store.recordReceipt(receipt({ receiptId: 'receipt-early', observedAt: '2026-07-23T12:01:00.000Z', evidenceRefs: ['early'] }));
  await store.recordReceipt(receipt({ receiptId: 'receipt-middle', observedAt: '2026-07-23T12:01:00.000Z', evidenceRefs: ['middle'] }));
  const bounded = await store.listReceipts('tenant-alpha', undefined, 2);
  assert.deepEqual(bounded.map((item) => item.receiptId), ['receipt-early', 'receipt-middle']);
});
