// Cambium operator · cortex memory contract (M2 / B1, issue #15) — the ranking + shape contract.
// Lives in bin/operator/*.test.ts → already in the npm-test glob. node --test, native .ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankByCosine, isMemoryRecord } from './cortex-memory.ts';
import type { MemoryRecord } from './cortex-memory.ts';

function rec(id: string, vector: number[], over: Partial<MemoryRecord> = {}): MemoryRecord {
  return { id, kind: 'positioning', tenant: 't', vector, payload: {}, ts: 0, ...over };
}

test('rankByCosine · returns ScoredRecord[] sorted DESC by cosine', () => {
  const out = rankByCosine([1, 0], [rec('a', [1, 0]), rec('b', [0, 1]), rec('c', [0.7, 0.7])], 3);
  assert.deepEqual(out.map((s) => s.record.id), ['a', 'c', 'b']);
  assert.ok(out[0].score > out[1].score && out[1].score > out[2].score);
  assert.ok(Math.abs(out[0].score - 1) < 1e-9);   // identical direction → cosine 1
  assert.ok(Math.abs(out[2].score) < 1e-9);        // orthogonal → cosine 0
});

test('rankByCosine · honors k (top-k only)', () => {
  const out = rankByCosine([1, 0], [rec('a', [1, 0]), rec('b', [0.9, 0.1]), rec('c', [0, 1])], 2);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((s) => s.record.id), ['a', 'b']);
});

test('rankByCosine · deterministic tie-break by id when scores are equal', () => {
  const out = rankByCosine([1, 0], [rec('z', [1, 0]), rec('a', [1, 0])], 2);
  assert.deepEqual(out.map((s) => s.record.id), ['a', 'z']);   // equal cosine → id ascending
});

test('rankByCosine · filters by tenant + kind (M3 isolation + hybrid lanes)', () => {
  const recs = [
    rec('a', [1, 0], { tenant: 't1', kind: 'pain' }),
    rec('b', [1, 0], { tenant: 't2', kind: 'pain' }),
    rec('c', [1, 0], { tenant: 't1', kind: 'positioning' }),
  ];
  assert.deepEqual(rankByCosine([1, 0], recs, 5, { tenant: 't1', kind: 'pain' }).map((s) => s.record.id), ['a']);
  assert.deepEqual(rankByCosine([1, 0], recs, 5, { tenant: 't1' }).map((s) => s.record.id).sort(), ['a', 'c']);
});

test('rankByCosine · skips dimension-mismatched vectors (mixed embedders never crash search)', () => {
  const out = rankByCosine([1, 0], [rec('a', [1, 0]), rec('bad', [1, 0, 0, 0])], 5);
  assert.deepEqual(out.map((s) => s.record.id), ['a']);
});

test('rankByCosine · empty in / k=0 → empty out', () => {
  assert.deepEqual(rankByCosine([1, 0], [], 5), []);
  assert.deepEqual(rankByCosine([1, 0], [rec('a', [1, 0])], 0), []);
});

test('isMemoryRecord · accepts the contract shape, rejects malformed', () => {
  assert.ok(isMemoryRecord(rec('a', [1, 0])));
  assert.ok(!isMemoryRecord({ id: 'x' }));
  assert.ok(!isMemoryRecord(rec('', [1, 0])));                       // empty id
  assert.ok(!isMemoryRecord(rec('a', [1, 0], { kind: 'nope' as unknown as MemoryRecord['kind'] })));
  assert.ok(!isMemoryRecord(null));
});
