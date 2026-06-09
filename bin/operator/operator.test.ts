// Cambium operator · end-to-end wake-loop tests. Run: npm test  (node --test, native .ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, viability, SOLVENCY_FLOOR_DAYS } from './world.ts';
import { route } from './router.ts';
import { wake, replay } from './operator.ts';
import { probeEvent } from './heartbeat.ts';
import { realIcp } from './npc.ts';
import type { GameEvent, WakeDeps } from './types.ts';

function harness() {
  const ledger: string[] = [];
  const deps: WakeDeps = { record: (l) => ledger.push(l) };
  const world = createWorld({
    tenant: 'thoughtseed', vision: 'turn complex requirements into coherent systems people can own',
    brand: { setpoint: [0, 0], label: 'founder-led systems studio', trustRegion: 0.25, coherence: 0.7 },
    business: { runwayDays: 120 },
  });
  return { world, deps, ledger };
}

test('micro · a tweak is applied, reversible, no setpoint move', () => {
  const { world, deps } = harness();
  const e: GameEvent = { id: 'e1', kind: 'tweak', artifact: { id: 'hero', text: 'Bring the requirement.' } };
  const { world: w, decision } = wake(world, e, deps);
  assert.equal(decision.routing.class, 'micro');
  assert.equal(decision.setpointMoved, false);
  assert.equal(w.artifacts.hero, 'Bring the requirement.');
  assert.equal(w.version, 1);
  assert.deepEqual(w.brand.setpoint, [0, 0]);
});

test('macro · a reposition WITHOUT evidence is held (fail-closed)', () => {
  const { world, deps } = harness();
  const e: GameEvent = { id: 'e2', kind: 'reposition', direction: [1, 0], evidence: false };
  const { world: w, decision } = wake(world, e, deps);
  assert.equal(decision.routing.gated, true);
  assert.equal(decision.gate?.allowed, false);
  assert.equal(decision.setpointMoved, false);
  assert.deepEqual(w.brand.setpoint, [0, 0]);   // setpoint did NOT move
});

test('macro · a reposition WITH evidence moves x*, clamped to the trust-region α', () => {
  const { world, deps } = harness();
  const e: GameEvent = { id: 'e3', kind: 'reposition', direction: [10, 0], evidence: true }; // ‖g‖=10 ≫ α
  const { world: w, decision } = wake(world, e, deps);
  assert.equal(decision.setpointMoved, true);
  const moved = Math.hypot(...w.brand.setpoint);
  assert.ok(moved <= world.brand.trustRegion + 1e-9, `‖Δx*‖ ${moved} must be ≤ α ${world.brand.trustRegion}`);
});

test('mid-brain · a calling routes to noesis (bypass), no routine tick', () => {
  const r = route({ id: 'e4', kind: 'calling' });
  assert.equal(r.class, 'midbrain');
  assert.equal(r.noesis, true);
  const { decision } = wake(harness().world, { id: 'e4', kind: 'calling' }, harness().deps);
  assert.equal(decision.noesis, true);
  assert.equal(decision.setpointMoved, false);
  assert.match(decision.action, /noesis/);
});

test('mid-brain · drift routes to noesis + escalates', () => {
  const { decision } = wake(harness().world, { id: 'e5', kind: 'drift', drives: [8] }, harness().deps);
  assert.equal(decision.noesis, true);
  assert.match(decision.action, /escalate/);
});

test('viability · a margin breach triggers an emergency override', () => {
  const { deps } = harness();
  const broke = createWorld({ tenant: 't', vision: 'v', business: { runwayDays: 5 } }); // < floor
  assert.equal(viability(broke).ok, false);
  const { world: w, decision } = wake(broke, { id: 'e6', kind: 'tweak' }, deps);
  assert.equal(decision.emergency, true);
  assert.equal(w.business.runwayDays, SOLVENCY_FLOOR_DAYS); // pulled back inside Viab(K)
  assert.equal(viability(w).ok, true);
});

test('event sourcing · folding a stream is deterministic (version = #events)', () => {
  const { world, deps } = harness();
  const stream: GameEvent[] = [
    { id: 'a', kind: 'calling' },
    { id: 'b', kind: 'tweak', artifact: { id: 'cta', text: 'x' } },
    { id: 'c', kind: 'reposition', direction: [1, 0], evidence: true },
  ];
  const w = replay(world, stream, deps);
  assert.equal(w.version, 3);
  assert.equal(w.log.length, 3);
});

test('every wake writes exactly one ledger line', () => {
  const { world, deps, ledger } = harness();
  wake(world, { id: 'z', kind: 'tweak' }, deps);
  assert.equal(ledger.length, 1);
  assert.match(ledger[0], /"stage":"z"/);
});

test('heartbeat · a probe is a viability sweep — no act, no setpoint move', () => {
  const { world, deps } = harness();
  const { decision } = wake(world, probeEvent(1), deps);
  assert.equal(decision.routing.class, 'heartbeat');
  assert.equal(decision.setpointMoved, false);
  assert.equal(decision.emergency, false);
  assert.match(decision.action, /viability sweep/);
});

test('heartbeat · warns BEFORE a breach (inside the kernel, close to the solvency floor)', () => {
  const { deps } = harness();
  // runway 40 → solvency margin 10: ≥0 (still in the game) but < the 15-day warn band
  const tight = createWorld({ tenant: 't', vision: 'v', business: { runwayDays: 40 } });
  assert.equal(viability(tight).ok, true);
  assert.deepEqual(viability(tight).warnings, ['solvency']);
  const { decision } = wake(tight, probeEvent(1), deps);
  assert.equal(decision.emergency, false);                 // not a breach — a warning
  assert.match(decision.action, /WARN.*solvency/);
});

test('realIcp · offline mode falls back to the deterministic stub', async () => {
  const r = await realIcp('founder-led systems studio', { offline: true });
  assert.equal(r.source, 'stub');
  assert.equal(r.pains.length, 3);
  assert.equal(r.direction.length, 2);
});

test('realIcp · uses the model when a key + fetch are present (injected fetch — no network)', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"pains":["fragmented vendors","breaks at handoff"],"direction":"toward owned end-to-end delivery","resonance":0.62}' } }] }),
  }) as any;
  const r = await realIcp('founder-led systems studio', { apiKey: 'test-key', fetchImpl: fakeFetch });
  assert.equal(r.source, 'llm');
  assert.deepEqual(r.pains, ['fragmented vendors', 'breaks at handoff']);
  assert.equal(r.directionLabel, 'toward owned end-to-end delivery');
  assert.equal(r.resonance, 0.62);
});

test('realIcp · a failing fetch fails soft to the stub', async () => {
  const boom = async () => { throw new Error('network'); };
  const r = await realIcp('x', { apiKey: 'k', fetchImpl: boom as any });
  assert.equal(r.source, 'stub');
});
