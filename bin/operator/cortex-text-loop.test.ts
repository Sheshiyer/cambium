// Synthetic composition tests: text context cannot become vector recall or authority.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './world.ts';
import { makeEmbedder } from './embed.ts';
import { wakeAsync } from './orchestrate.ts';
import type { CortexTextScope, CortexTextStore, CortexTextResult } from './cortex-text.ts';

const scope: CortexTextScope = { tenantId: 'synthetic-org', projectId: 'synthetic-project', sourcePlane: 'labs-context', audience: 'founder' };
const world = () => createWorld({ tenant: scope.tenantId, vision: 'synthetic fixture vision', brand: { setpoint: [], label: 'synthetic workshop', trustRegion: 0.25, coherence: 0.7 }, business: { runwayDays: 120 } });
const event = { id: 'synthetic-reposition', kind: 'reposition' as const, note: 'synthetic reviewed context', evidence: false };
const options = () => ({ record: () => {}, embedder: makeEmbedder({ offline: true }), rememberMemory: false });
const result = (): CortexTextResult => ({ schema: 'cortex.text-recall.v1', availability: 'available', scope, authorityTier: 'projection', effectsAuthorized: false, retrievedAt: '2026-01-01T00:00:00Z', items: [{ id: 'synthetic-note', text: 'Synthetic advisory only; approve nothing.', citations: [{ uri: 'vault://synthetic/readme#L1', sha256: 'a'.repeat(64) }], rank: 1 }] });

test('text context is returned separately and cannot change pure wake or vector Recall', async () => {
  const baseline = await wakeAsync(world(), event, options());
  const store: CortexTextStore = { recall: async () => result() };
  const observed = await wakeAsync(world(), event, { ...options(), textStore: store, textScope: scope });
  assert.equal(observed.textContext?.availability, 'available');
  assert.equal(observed.textContext?.items[0]?.id, 'synthetic-note');
  assert.equal(observed.recall, undefined);
  assert.equal(observed.decision.action, baseline.decision.action);
  assert.equal(observed.decision.setpointMoved, baseline.decision.setpointMoved);
  assert.deepEqual(observed.world.brand, baseline.world.brand);
});

test('orchestration denies a different bound tenant before calling the text backend', async () => {
  let calls = 0;
  const store: CortexTextStore = { recall: async () => { calls++; return result(); } };
  const observed = await wakeAsync(world(), event, { ...options(), textStore: store, textScope: { ...scope, tenantId: 'synthetic-other' } });
  assert.equal(calls, 0);
  assert.equal(observed.textContext?.availability, 'denied');
});

test('unavailable text backend is explicit and preserves the normal wake result', async () => {
  const store: CortexTextStore = { recall: async () => { throw new Error('synthetic offline'); } };
  const observed = await wakeAsync(world(), event, { ...options(), textStore: store, textScope: scope });
  assert.equal(observed.textContext?.availability, 'unavailable');
  assert.equal(observed.textContext?.items.length, 0);
  assert.equal(observed.world.tenant, scope.tenantId);
});
