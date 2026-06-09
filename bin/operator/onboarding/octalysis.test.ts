// Cambium operator · onboarding Octalysis meter (M1 / A5, issue #13) — ledger + panel tests.
// Run directly: node --test bin/operator/onboarding/octalysis.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOnboarding } from './session.ts';
import { octalysisLedger, renderOctalysisPanel, DRIVE_NAMES } from './octalysis.ts';

test('ledger · completing the script lights all 8 core drives', () => {
  const { state } = runOnboarding();
  const L = octalysisLedger(state);
  assert.deepEqual([...L.drivesActivated].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(L.drivesActivated.length, 8);
});

test('ledger · every one of the 8 drives is engaged at least once across the script', () => {
  const { state } = runOnboarding();
  const L = octalysisLedger(state);
  assert.deepEqual(L.drivesCovered, [1, 2, 3, 4, 5, 6, 7, 8]);
  for (let d = 1; d <= 8; d++) assert.ok(L.driveHits[d] >= 1, `drive ${d} never engaged`);
});

test('ledger · the hat split sums to the step count (20)', () => {
  const { state } = runOnboarding();
  const L = octalysisLedger(state);
  assert.equal(L.hatTally.white + L.hatTally.neutral + L.hatTally.black, L.total);
  assert.equal(L.total, 20);
});

test('ledger · the brain axis sums to 20; mid === noesis moments (the mid-brain → noesis identity)', () => {
  const { state } = runOnboarding();
  const L = octalysisLedger(state);
  assert.equal(L.brainTally.left + L.brainTally.right + L.brainTally.mid, 20);
  assert.equal(L.brainTally.mid, L.noesisMoments);
});

test('ledger · White-Hat dominant + at least one noesis moment (the infinite-game shape)', () => {
  const { state } = runOnboarding();
  const L = octalysisLedger(state);
  assert.ok(L.hatTally.white > L.hatTally.black, `white ${L.hatTally.white} must beat black ${L.hatTally.black}`);
  assert.ok(L.noesisMoments >= 1);
  assert.equal(L.noesisMoments, 3);
});

test('panel · renders all 8 drive names, the 8/8 verdict, and the hat/brain balances', () => {
  const { state } = runOnboarding();
  const lines: string[] = [];
  renderOctalysisPanel(state, (s) => lines.push(s));
  const text = lines.join('\n');
  for (let d = 1; d <= 8; d++) assert.ok(text.includes(DRIVE_NAMES[d]), `missing drive name ${d}`);
  assert.match(text, /\(8\/8\)/);
  assert.match(text, /hat balance:\s+white \d+ · neutral \d+ · black \d+/);
  assert.match(text, /brain axis:\s+left \d+ · right \d+ · mid \d+/);
  assert.match(text, /noesis moments:\s+3/);
});

test('panel · marks lit drives with ✓ (all 8 after a full session)', () => {
  const { state } = runOnboarding();
  const lines: string[] = [];
  renderOctalysisPanel(state, (s) => lines.push(s));
  const checks = lines.filter((l) => /^  \d  /.test(l) && l.includes('✓')).length;
  assert.equal(checks, 8, 'all 8 drive rows should be marked lit');
});
