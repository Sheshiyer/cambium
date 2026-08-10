// Cambium operator · onboarding script (M1 / A1, issue #9) — schema + router-fidelity tests.
// Run directly:  node --test bin/operator/onboarding/script.test.ts
// (A6 / issue #14 wires this dir into the npm-test glob; until then run it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { route } from '../router.ts';
import { ONBOARDING_SCRIPT, ONBOARDING_LENGTH, hatOf } from './script.ts';

const KNOWN_KINDS = new Set(['calling', 'drift', 'tweak', 'redirect', 'objection', 'metric', 'reposition', 'probe']);

function parseDoctrineRows() {
  const markdown = readFileSync(new URL('../../../ONBOARDING-OCTALYSIS.md', import.meta.url), 'utf8');
  return markdown
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.slice(1, line.lastIndexOf('|')).split('|').map((cell) => cell.trim());
      assert.equal(cells.length, 6, `unexpected onboarding doctrine row: ${line}`);
      const [n, title, founderExperience, driveText, layer, evidenceState] = cells;
      return {
        n: Number(n),
        title,
        founderExperience,
        drives: driveText.split('·').map(Number),
        layer,
        evidenceState,
      };
    });
}

function expectedRouteClass(layer, n) {
  if (layer.includes('noesis')) return 'midbrain';
  if (layer === 'macro') return 'macro';
  if (layer === 'micro') return 'micro';
  if (layer === 'meso' || layer === 'macro→meso' || layer === 'cross-run') return 'meso';
  assert.fail(`step ${n}: doctrine layer "${layer}" has no explicit RouteClass mapping`);
}

test('script · is exactly the 20 interactions, numbered 1..20 in order', () => {
  assert.equal(ONBOARDING_LENGTH, 20);
  assert.equal(ONBOARDING_SCRIPT.length, 20);
  ONBOARDING_SCRIPT.forEach((s, i) => assert.equal(s.n, i + 1, `step at index ${i} is n=${s.n}`));
});

test('doctrine parity · Markdown table and executable script match exactly', () => {
  const doctrine = parseDoctrineRows();
  assert.equal(doctrine.length, 20, 'ONBOARDING-OCTALYSIS.md must contain exactly 20 numbered interaction rows');

  const runtime = ONBOARDING_SCRIPT.map((step) => ({
    n: step.n,
    title: step.title,
    founderExperience: step.narration,
    drives: [step.drive, ...(step.secondaryDrives ?? [])],
    layer: step.doctrineLayer,
    evidenceState: step.evidenceState,
  }));

  assert.deepEqual(runtime, doctrine);
});

test('doctrine routing · every documented layer has one deterministic runtime class', () => {
  for (const step of ONBOARDING_SCRIPT) {
    assert.equal(step.expect, expectedRouteClass(step.doctrineLayer, step.n), `step ${step.n}: doctrine layer → expect`);
  }
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

test('hat / brain · hat follows motivation while mid-brain follows doctrine noesis', () => {
  for (const s of ONBOARDING_SCRIPT) {
    assert.equal(s.hat, hatOf(s.drive), `step ${s.n} hat`);
    assert.equal(s.brain === 'mid', s.expect === 'midbrain', `step ${s.n} brain/noesis`);
    if (s.expect !== 'midbrain') assert.notEqual(s.brain, 'mid', `step ${s.n} routine interaction`);
  }
});

test('noesis · only doctrine peaks 1, 18, and 20 bypass routine routing', () => {
  const peaks = ONBOARDING_SCRIPT.filter((step) => step.expect === 'midbrain').map((step) => step.n);
  assert.deepEqual(peaks, [1, 18, 20]);
  for (const step of ONBOARDING_SCRIPT) {
    assert.equal(route(step.event).noesis, [1, 18, 20].includes(step.n), `step ${step.n}: noesis doctrine`);
  }
});

test('noesis · motivational Drive 1 does not force routine story-reading into noesis', () => {
  const story = ONBOARDING_SCRIPT[3];
  assert.equal(story.title, 'Read the story');
  assert.equal(story.drive, 1);
  assert.equal(story.doctrineLayer, 'meso');
  assert.equal(story.expect, 'meso');
  assert.equal(route(story.event).noesis, false);
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

test('coverage · all doctrine-required route classes are exercised', () => {
  const classes = new Set(ONBOARDING_SCRIPT.map((s) => s.expect));
  for (const c of ['micro', 'meso', 'macro', 'midbrain']) assert.ok(classes.has(c), `route class "${c}" never taught`);
  assert.equal(classes.has('heartbeat'), false, 'the doctrine table has no heartbeat interaction');
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
