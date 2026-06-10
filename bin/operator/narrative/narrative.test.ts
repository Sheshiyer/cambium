// Cambium operator · narrative — tests (Thalia wing W3). Prose per lane, noesis set
// apart, deviation reasons carried, the shared grammar honored, fallback honest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatsFromWorldLog, beatsFromDeviations, narrate } from './narrative.ts';

const LOG = [
  '#1 onb-01-calling → noesis · reaffirm the vision (calling)',
  '#3 onb-03-seed → micro · tweak applied (reversible · no setpoint move)',
  '#8 onb-08-booster → meso · reroll (no setpoint move)',
  '#15 onb-15-error-or-intent → meso · intent absorbed → setpoint moved (gated)',
  '#16 onb-16-move-goal → macro · setpoint moved (evidence + gate)',
  '#17 onb-17-viability → heartbeat · viability sweep',
  'not a log line at all',
];

test('narrative · world-log lines become lane-true prose', () => {
  const beats = beatsFromWorldLog(LOG);
  assert.equal(beats.length, 6, 'unparseable lines skipped');
  assert.match(beats[1].text, /micro move.*reversible/i);
  assert.match(beats[2].text, /rerolled toward the same goal/);
  assert.match(beats[3].text, /intent.*absorbed.*goal moved/i);
  assert.match(beats[4].text, /setpoint moved through the evidence gate/);
  assert.match(beats[5].text, /heartbeat swept the board/);
});

test('narrative · noesis beats are set apart with the existential voice', () => {
  const beats = beatsFromWorldLog(LOG);
  assert.equal(beats[0].noesis, true);
  assert.equal(beats[0].lane, 'noesis');
  assert.match(beats[0].text, /mid-brain woke/);
  assert.ok(beats.slice(1).every((b) => !b.noesis));
});

test('narrative · step numbers ride along', () => {
  const beats = beatsFromWorldLog(LOG);
  assert.deepEqual(beats.map((b) => b.n), [1, 3, 8, 15, 16, 17]);
});

test('narrative · drift noesis reads as the edge, not the calling', () => {
  const [beat] = beatsFromWorldLog(['#18 onb-18-drift → noesis · defensive (loss/drift) + escalate to the human']);
  assert.match(beat.text, /drift sensed.*handed to the founder/i);
});

test('narrative · deviations map to prose with the reason carried', () => {
  const beats = beatsFromDeviations([
    JSON.stringify({ stage: 'build', kind: 'error', action: 'reroll', reason: 'contract drift: missing artifact' }),
    'junk line',
    JSON.stringify({ stage: '16·reposition-no-ev', kind: 'macro', action: 'macro · hold (no real-player evidence)', rationale: null, reason: 'fail-closed' }),
  ]);
  assert.equal(beats.length, 2);
  assert.match(beats[0].text, /Why: contract drift/);
  assert.match(beats[1].text, /gate held.*Why: fail-closed/i);
});

test('narrative · macro hold vs move read differently', () => {
  const [hold] = beatsFromWorldLog(['#16 x → macro · hold (no real-player evidence — fail-closed)']);
  const [move] = beatsFromWorldLog(['#16 x → macro · setpoint moved (evidence + gate)']);
  assert.match(hold.text, /gate held/);
  assert.match(move.text, /moved through the evidence gate/);
});

test('narrative · narrate merges, keeps order, and caps to limit', () => {
  const beats = narrate(LOG, [JSON.stringify({ kind: 'probe', action: 'heartbeat · viability sweep' })], 4);
  assert.equal(beats.length, 4);
  assert.equal(beats.at(-1)!.source, 'deviations');
});

test('narrative · raw line rides along for audit', () => {
  const beats = beatsFromWorldLog([LOG[2]]);
  assert.equal(beats[0].raw, LOG[2]);
});
