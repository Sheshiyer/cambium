// Cambium operator · cortex store on node:sqlite (M2 / B2, issue #16) — store tests.
// In bin/operator/*.test.ts → already in the npm-test glob. node:sqlite needs no flag in Node v26.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { sqliteCortex } from './cortex-sqlite.ts';
import type { MemoryRecord } from './cortex-memory.ts';

function rec(id: string, vector: number[], over: Partial<MemoryRecord> = {}): MemoryRecord {
  return { id, kind: 'positioning', tenant: 't', vector, payload: { note: id }, ts: 1, ...over };
}

test('store · fail-closed before init() — search/upsert throw, ready() is false', () => {
  const s = sqliteCortex();
  assert.equal(s.ready(), false);
  assert.throws(() => s.search([1, 0]), /not initialized/);
  assert.throws(() => s.upsert(rec('a', [1, 0])), /not initialized/);
});

test('store · init → upsert → search ranks by cosine (in-memory)', () => {
  const s = sqliteCortex();
  s.init();
  assert.equal(s.ready(), true);
  s.upsert(rec('a', [1, 0]));
  s.upsert(rec('b', [0, 1]));
  s.upsert(rec('c', [0.7, 0.7]));
  assert.deepEqual(s.search([1, 0], 3).map((r) => r.record.id), ['a', 'c', 'b']);
  assert.equal(s.count(), 3);
  s.close();
});

test('store · upsert replaces by id (no duplicates)', () => {
  const s = sqliteCortex();
  s.init();
  s.upsert(rec('a', [1, 0], { payload: { v: 1 } }));
  s.upsert(rec('a', [0, 1], { payload: { v: 2 } }));
  assert.equal(s.count(), 1);
  assert.equal(s.search([0, 1], 1)[0].record.payload.v, 2);
  s.close();
});

test('store · tenant + kind isolation is enforced in SQL (M3-ready)', () => {
  const s = sqliteCortex();
  s.init();
  s.upsert(rec('a', [1, 0], { tenant: 't1', kind: 'pain' }));
  s.upsert(rec('b', [1, 0], { tenant: 't2', kind: 'pain' }));
  s.upsert(rec('c', [1, 0], { tenant: 't1', kind: 'positioning' }));
  assert.deepEqual(s.search([1, 0], 5, { tenant: 't1' }).map((r) => r.record.id).sort(), ['a', 'c']);
  assert.deepEqual(s.search([1, 0], 5, { tenant: 't1', kind: 'pain' }).map((r) => r.record.id), ['a']);
  assert.equal(s.count({ tenant: 't2' }), 1);
  s.close();
});

test('store · persists across reopen (the WAL file survives close → re-init)', () => {
  const path = join(tmpdir(), `cambium-cortex-${process.pid}.db`);
  try {
    const a = sqliteCortex({ path });
    a.init();
    a.upsert(rec('a', [1, 0]));
    a.upsert(rec('b', [0, 1]));
    a.close();
    const b = sqliteCortex({ path });                          // fresh instance, same file
    b.init();
    assert.equal(b.count(), 2);
    assert.deepEqual(b.search([1, 0], 1).map((r) => r.record.id), ['a']);
    b.close();
  } finally {
    for (const ext of ['', '-wal', '-shm']) { try { rmSync(path + ext, { force: true }); } catch { /* ignore */ } }
  }
});

test('store · init() is idempotent', () => {
  const s = sqliteCortex();
  s.init();
  s.init();
  assert.equal(s.ready(), true);
  s.close();
});
