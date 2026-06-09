// Cambium operator · the offline cortex loop (M2 / B5, issue #19) — remember (B4) + recall end-to-end.
// Hermetic: in-memory node:sqlite store + the offline stub embedder. node --test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './world.ts';
import { makeEmbedder } from './embed.ts';
import { sqliteCortex } from './cortex-sqlite.ts';
import { wakeAsync } from './orchestrate.ts';
import type { GameEvent } from './types.ts';

function loopHarness() {
  const store = sqliteCortex();
  store.init();
  const embedder = makeEmbedder({ offline: true });
  const ledger: string[] = [];
  const world = createWorld({
    tenant: 't', vision: 'v',
    brand: { setpoint: [], label: 'studio', trustRegion: 0.25, coherence: 0.7 },
    business: { runwayDays: 120 },
  });
  const opts = { record: (l: string) => ledger.push(l), embedder, store, icpOpts: { offline: true }, founderOpts: { offline: true } };
  return { store, embedder, ledger, world, opts };
}

const PRICING: GameEvent = { id: 'm1', kind: 'redirect', note: 'pricing pushback' };

test('loop · the first wake has nothing to recall but writes a memory', async () => {
  const { store, world, opts } = loopHarness();
  const r = await wakeAsync(world, PRICING, { ...opts, now: () => 1 });
  assert.equal(r.decision.recall, undefined);
  assert.ok(r.memory);
  assert.equal(store.count(), 1);
  store.close();
});

test('loop · a replayed situation is RECALLED — decision.recall + the why-handler ledger line', async () => {
  const { store, ledger, world, opts } = loopHarness();
  const r1 = await wakeAsync(world, PRICING, { ...opts, now: () => 1 });
  const r2 = await wakeAsync(r1.world, { id: 'm2', kind: 'redirect', note: 'pricing pushback' }, { ...opts, now: () => 2 });
  assert.ok(r2.decision.recall, 'recall should be populated on the replay');
  assert.ok(r2.decision.recall!.count >= 1);
  assert.ok(r2.decision.recall!.nearest!.score > 0.99, 'an identical situation → cosine ~1');
  assert.match(ledger[ledger.length - 1], /recall/, 'the deviation ledger line carries the recall');
  assert.equal(store.count(), 2);
  store.close();
});

test('loop · recall is tenant-scoped — another venture cannot see this one (M3-ready)', async () => {
  const { store, world, opts } = loopHarness();
  await wakeAsync(world, PRICING, { ...opts, now: () => 1 });                     // tenant t writes
  const other = createWorld({
    tenant: 'other', vision: 'v',
    brand: { setpoint: [], label: 'studio', trustRegion: 0.25, coherence: 0.7 },
    business: { runwayDays: 120 },
  });
  const r = await wakeAsync(other, { id: 'm2', kind: 'redirect', note: 'pricing pushback' }, { ...opts, now: () => 2 });
  assert.equal(r.decision.recall, undefined, "tenant t's memory must not leak into tenant other");
  assert.equal(store.count({ tenant: 'other' }), 1);
  store.close();
});

test('loop · rememberMemory:false recalls without writing (dry)', async () => {
  const { store, world, opts } = loopHarness();
  await wakeAsync(world, PRICING, { ...opts, now: () => 1 });
  const before = store.count();
  await wakeAsync(world, { id: 'm2', kind: 'redirect', note: 'pricing pushback' }, { ...opts, now: () => 2, rememberMemory: false });
  assert.equal(store.count(), before, 'a dry wake must not write a memory');
  store.close();
});
