// Cambium operator · onboarding script (M1 / A1, issue #9) — schema + router-fidelity tests.
// Run directly:  node --test bin/operator/onboarding/script.test.ts
// (A6 / issue #14 wires this dir into the npm-test glob; until then run it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../router.ts';
import { ONBOARDING_SCRIPT, ONBOARDING_LENGTH, hatOf, brainOf } from './script.ts';

const KNOWN_KINDS = new Set(['calling', 'drift', 'tweak', 'redirect', 'objection', 'metric', 'reposition', 'probe']);

test('script · is exactly the 20 interactions, numbered 1..20 in order', () => {
  assert.equal(ONBOARDING_LENGTH, 20);
  assert.equal(ONBOARDING_SCRIPT.length, 20);
  ONBOARDING_SCRIPT.forEach((s, i) => assert.equal(s.n, i + 1, `step at index ${i} is n=${s.n}`));
});

test('script · every event kind is a known EventKind', () => {
  for (const s of ONBOARDING_SCRIPT) assert.ok(KNOWN_KINDS.has(s.event.kind), `step ${s.n}: unknown kind "${s.event.kind}"`);
});

test('script · every event id is unique', () => {
  const ids = ONBOARDING_SCRIPT.map((s) => s.event.id);
  assert.equal(new Set(ids).size, 20, 'duplicate event id(s)');
});

test('script · every step has non-empty narration + reveals', () => {
  for (const s of ONBOARDING_SCRIPT) {
    assert.ok(s.narration.length > 0, `step ${s.n} narration`);
    assert.ok(s.reveals.length > 0, `step ${s.n} reveals`);
  }
});

test('octalysis · the 8 core drives are all covered as a PRIMARY drive', () => {
  const primary = [...new Set(ONBOARDING_SCRIPT.map((s) => s.drive))].sort((a, b) => a - b);
  assert.deepEqual(primary, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('octalysis · primary ∪ secondary drives cover 1..8', () => {
  const all = new Set();
  for (const s of ONBOARDING_SCRIPT) {
    all.add(s.drive);
    (s.secondaryDrives ?? []).forEach((d) => all.add(d));
  }
  for (let d = 1; d <= 8; d++) assert.ok(all.has(d), `drive ${d} never appears`);
});

test('hat / brain · are the pure functions of drive (the table cannot drift)', () => {
  for (const s of ONBOARDING_SCRIPT) {
    assert.equal(s.hat, hatOf(s.drive), `step ${s.n} hat`);
    assert.equal(s.brain, brainOf(s.drive), `step ${s.n} brain`);
  }
});

test('mid-brain rule · brain==="mid" ⟺ drive ∈ {1,8} ⟺ expect==="midbrain" (noesis)', () => {
  for (const s of ONBOARDING_SCRIPT) {
    const isMid = s.drive === 1 || s.drive === 8;
    assert.equal(s.brain === 'mid', isMid, `step ${s.n}: brain/drive mismatch`);
    assert.equal(s.expect === 'midbrain', isMid, `step ${s.n}: a mid-brain drive must route to noesis`);
  }
});

test('router fidelity · route(event).class === expect for ALL 20 (the real router)', () => {
  for (const s of ONBOARDING_SCRIPT) {
    const got = route(s.event).class;
    assert.equal(got, s.expect, `step ${s.n} (${s.title}) — kind "${s.event.kind}" routed ${got}, expected ${s.expect}`);
  }
});

test('router fidelity · every midbrain step also flags noesis=true', () => {
  for (const s of ONBOARDING_SCRIPT) {
    if (s.expect === 'midbrain') assert.equal(route(s.event).noesis, true, `step ${s.n} should be noesis`);
  }
});

test('arc · opens AND closes on White-Hat mid-brain Epic Meaning (drive 1) — infinite-game bookends', () => {
  const first = ONBOARDING_SCRIPT[0];
  const last = ONBOARDING_SCRIPT[ONBOARDING_SCRIPT.length - 1];
  for (const s of [first, last]) {
    assert.equal(s.drive, 1, `${s.title}: drive`);
    assert.equal(s.brain, 'mid', `${s.title}: brain`);
    assert.equal(s.hat, 'white', `${s.title}: hat`);
    assert.equal(s.expect, 'midbrain', `${s.title}: expect`);
  }
});

test('coverage · all five route classes are exercised across the tutorial', () => {
  const classes = new Set(ONBOARDING_SCRIPT.map((s) => s.expect));
  for (const c of ['micro', 'meso', 'macro', 'midbrain', 'heartbeat']) assert.ok(classes.has(c), `route class "${c}" never taught`);
});

test('white-hat dominant · grounded black hat stays the minority (the infinite-game shape)', () => {
  const tally = { white: 0, black: 0, neutral: 0 };
  for (const s of ONBOARDING_SCRIPT) tally[s.hat]++;
  assert.ok(tally.white > tally.black, `white ${tally.white} must dominate black ${tally.black}`);
  assert.equal(tally.white + tally.black + tally.neutral, 20);
});

test('phases · A..E are present and non-decreasing across the 20', () => {
  const order = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  let prev = -1;
  const seen = new Set();
  for (const s of ONBOARDING_SCRIPT) {
    seen.add(s.phase);
    assert.ok(order[s.phase] >= prev, `step ${s.n}: phase ${s.phase} went backwards`);
    prev = order[s.phase];
  }
  assert.deepEqual([...seen].sort(), ['A', 'B', 'C', 'D', 'E']);
});
