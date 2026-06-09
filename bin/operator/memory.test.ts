// Cambium operator · cortex memory writer (M2 / B4, issue #18) — the remember side.
// node --test; in the npm-test glob via bin/operator/*.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './world.ts';
import { wake } from './operator.ts';
import { makeEmbedder } from './embed.ts';
import { sqliteCortex } from './cortex-sqlite.ts';
import { rememberWake, situationText, buildRecall } from './memory.ts';
import type { GameEvent } from './types.ts';

function harness() {
  const store = sqliteCortex();
  store.init();
  const embedder = makeEmbedder({ offline: true });
  const world = createWorld({
    tenant: 't', vision: 'v',
    brand: { setpoint: [], label: 'studio', trustRegion: 0.25, coherence: 0.7 },
    business: { runwayDays: 120 },
  });
  return { store, embedder, world };
}

test('rememberWake · writes one MemoryRecord with the embedder dims + tenant + ts', async () => {
  const { store, embedder, world } = harness();
  const event: GameEvent = { id: 'e1', kind: 'tweak', note: 'cta tweak' };
  const { world: next, decision } = wake(world, event, { record: () => {} });
  const rec = await rememberWake(store, embedder, next, event, decision, 100);
  assert.equal(rec.tenant, 't');
  assert.equal(rec.vector.length, embedder.dims);
  assert.equal(rec.payload.eventId, 'e1');
  assert.equal(rec.ts, 100);
  assert.equal(store.count(), 1);
  store.close();
});

test('rememberWake · distinct wakes accumulate distinct records (version is in the id)', async () => {
  const { store, embedder, world } = harness();
  let w = world;
  for (const id of ['a', 'b', 'c']) {
    const ev: GameEvent = { id, kind: 'tweak', note: id };
    const r = wake(w, ev, { record: () => {} });
    w = r.world;
    await rememberWake(store, embedder, w, ev, r.decision, 1);
  }
  assert.equal(store.count(), 3);
  store.close();
});

test('situationText · captures kind + note + positioning (the situation, not the outcome)', () => {
  const { world } = harness();
  const t = situationText({ id: 'x', kind: 'redirect', note: 'pricing' }, world);
  assert.match(t, /redirect/);
  assert.match(t, /pricing/);
  assert.match(t, /studio/);
});

test('buildRecall · undefined when no hit clears the relevance threshold', () => {
  assert.equal(buildRecall([]), undefined);
  assert.equal(buildRecall([{ record: { id: 'x', kind: 'decision', tenant: 't', vector: [1], payload: {}, ts: 0 }, score: 0.1 }]), undefined);
});
