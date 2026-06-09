// Cambium operator · onboarding session (M1 / A2, issue #10) — the deterministic fold tests.
// Run directly:  node --test bin/operator/onboarding/session.test.ts   (A6/#14 wires the glob).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initOnboarding, advance, runOnboarding } from './session.ts';

test('session · folds all 20 interactions → stepIndex 20', () => {
  const { state } = runOnboarding();
  assert.equal(state.stepIndex, 20);
});

test('octalysis · drivesActivated ends covering exactly {1..8}', () => {
  const { state } = runOnboarding();
  assert.deepEqual([...state.drivesActivated].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('event sourcing · world.version === the number of steps folded (20)', () => {
  const { state } = runOnboarding();
  assert.equal(state.world.version, 20);
});

test('determinism · two runs produce identical drives, noesis, version, and setpoint', () => {
  const a = runOnboarding().state;
  const b = runOnboarding().state;
  assert.deepEqual(a.drivesActivated, b.drivesActivated);
  assert.equal(a.noesisMoments, b.noesisMoments);
  assert.equal(a.world.version, b.world.version);
  assert.deepEqual(a.world.brand.setpoint, b.world.brand.setpoint);
});

test('noesis · exactly the 3 mid-brain beats fire — #1, #18, #20', () => {
  const { state, decisions } = runOnboarding();
  assert.equal(state.noesisMoments, 3);
  const noesisSteps = decisions.map((d, i) => (d.noesis ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(noesisSteps, [1, 18, 20]);
});

test('setpoint · ONLY the evidence-backed macro moves (#2, #16) move x*; micro/mid-brain never do', () => {
  const { decisions } = runOnboarding();
  const moved = decisions.map((d, i) => (d.setpointMoved ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(moved, [2, 16]);
  for (const n of [1, 18, 20]) assert.equal(decisions[n - 1].setpointMoved, false, `mid-brain step ${n} moved x*`);
  for (const n of [3, 4, 5, 6, 7, 14]) assert.equal(decisions[n - 1].setpointMoved, false, `micro step ${n} moved x*`);
});

test('routing · every folded decision class matches the script expect (router fidelity end-to-end)', () => {
  const { steps, decisions } = runOnboarding();
  steps.forEach((s, i) => assert.equal(decisions[i].routing.class, s.expect, `step ${s.n} (${s.title})`));
});

test('viability · the run stays inside Viab(K) the whole way (no emergency, healthy runway)', () => {
  const { decisions } = runOnboarding();
  for (const d of decisions) assert.equal(d.emergency, false);
});

test('advance · is pure — same input twice yields the same next state, input untouched', () => {
  const s0 = initOnboarding();
  const a = advance(s0);
  const b = advance(s0);
  assert.equal(a.state.world.version, b.state.world.version);
  assert.deepEqual(a.state.drivesActivated, b.state.drivesActivated);
  assert.equal(a.state.stepIndex, 1);
  assert.equal(s0.stepIndex, 0, 'advance must not mutate the input state');
  assert.equal(s0.world.version, 0, 'advance must not mutate the input world');
});

test('input · founder text overrides the scripted artifact (the CTA word at #14)', () => {
  let s = initOnboarding();
  for (let i = 0; i < 14; i++) s = advance(s, i === 13 ? { text: 'Begin.' } : {}).state;
  assert.equal(s.world.artifacts.cta, 'Begin.');
});

test('completion · advancing past the end is a no-op done (step null)', () => {
  const { state } = runOnboarding();
  const r = advance(state);
  assert.equal(r.done, true);
  assert.equal(r.step, null);
  assert.equal(r.decision, null);
  assert.equal(r.state.stepIndex, 20);
});

test('inputs · runOnboarding threads a full inputs array by step index', () => {
  const inputs = new Array(20).fill({});
  inputs[13] = { text: 'Ship it.' };   // step #14 CTA
  const { state } = runOnboarding({ inputs });
  assert.equal(state.world.artifacts.cta, 'Ship it.');
  assert.equal(state.stepIndex, 20);
});
