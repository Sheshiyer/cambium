// Cambium operator · skills — tests for the forge + telemetry (M4 / W2).
// Detection threshold, vault-schema-aligned minting, telemetry math, promotion on
// first verified use, decline → ONE amendment per streak, gotcha capture, and the
// re-forge invariant (upsert never resets telemetry).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signaturesFromDeviations, signaturesFromWorldLog, detectCandidates, mintSkill, upsertSkills,
} from './forge.ts';
import type { SkillCandidate } from './forge.ts';
import { recordUse, successRate, isDeclining } from './telemetry.ts';

const DEV_LINE = JSON.stringify({
  ts: '2026-06-09T15:16:48.106Z', stage: 'build', kind: 'error', action: 'reroll',
  rationale: null, reason: 'contract drift: missing artifact',
});

const WORLD_LOG = [
  '#8 onb-08-booster → meso · reroll (no setpoint move)',
  '#9 onb-09-meet-icp → meso · reroll (no setpoint move)',
  '#15 onb-15-error-or-intent → meso · reroll (no setpoint move)',
  '#3 onb-03-seed → micro · tweak applied (reversible · no setpoint move)',
  '#2 onb-02-vision → macro · setpoint moved (evidence + gate)',
];

function candidate(): SkillCandidate {
  return { signature: 'meso|reroll', source: 'world-log', occurrences: 8, samples: [WORLD_LOG[0]] };
}

test('forge · deviations lines parse to stage|kind|action signatures', () => {
  const sigs = signaturesFromDeviations([DEV_LINE, 'not json', '', DEV_LINE]);
  assert.equal(sigs.length, 2);
  assert.equal(sigs[0].signature, 'build|error|reroll');
  assert.equal(sigs[0].source, 'deviations');
});

test('forge · deviation signatures keep only the action HEAD (short stable ids)', () => {
  const verbose = JSON.stringify({
    stage: '1·calling', kind: 'midbrain', action: 'noesis · reaffirm the vision (calling)',
  });
  const sigs = signaturesFromDeviations([verbose]);
  assert.equal(sigs[0].signature, '1·calling|midbrain|noesis');
});

test('forge · world.log lines parse to lane|action signatures', () => {
  const sigs = signaturesFromWorldLog(WORLD_LOG);
  assert.equal(sigs.length, 5);
  assert.equal(sigs[0].signature, 'meso|reroll');
  assert.equal(sigs[3].signature, 'micro|tweak applied');
  assert.equal(sigs[4].signature, 'macro|setpoint moved');
});

test('forge · threshold 3 — two occurrences do not mint, three do', () => {
  const two = detectCandidates(signaturesFromWorldLog(WORLD_LOG.slice(0, 2)));
  assert.equal(two.length, 0);
  const three = detectCandidates(signaturesFromWorldLog(WORLD_LOG));
  assert.equal(three.length, 1);
  assert.equal(three[0].signature, 'meso|reroll');
  assert.equal(three[0].occurrences, 3);
});

test('forge · minted skill carries the vault schema fields', () => {
  const s = mintSkill(candidate(), 1000);
  assert.equal(s.skill_id, 'cambium-meso-reroll');
  assert.equal(s.status, 'candidate');
  assert.match(s.description, /USE WHEN/);
  assert.match(s.description, /NOT FOR/);
  assert.ok(s.trigger_signals.includes('meso|reroll'));
  assert.ok(s.required_inputs.every((r) => r.name && r.source));
  assert.ok(s.verification_steps.length >= 3);
  assert.match(s.promotion_rule, /founder approval/);
  assert.equal(s.telemetry.uses, 0);
});

test('telemetry · recordUse updates counts, scenarios, and rate', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, true, 'handled the booster reroll', 2000);
  s = recordUse(s, false, 'misfired on a fresh deviation', 3000);
  assert.equal(s.telemetry.uses, 2);
  assert.equal(s.telemetry.successes, 1);
  assert.equal(s.telemetry.failures, 1);
  assert.equal(s.telemetry.scenarios.length, 2);
  assert.equal(successRate(s), 0.5);
});

test('telemetry · first verified use promotes candidate → validated', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, true, undefined, 2000);
  assert.equal(s.status, 'validated');
});

test('telemetry · a failure does not promote', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, false, 'nope', 2000);
  assert.equal(s.status, 'candidate');
});

test('telemetry · failures capture gotchas (dedup)', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, false, 'same lesson', 2000);
  s = recordUse(s, false, 'same lesson', 3000);
  assert.deepEqual(s.telemetry.gotchas, ['same lesson']);
});

test('telemetry · decline appends ONE amendment per streak', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, true, undefined, 2000);                 // validated, rate 1.0
  s = recordUse(s, false, 'fail a', 3000);
  s = recordUse(s, false, 'fail b', 4000);                 // last3: 1 ok / 2 fail → 0.33 < 0.5 → declining
  assert.equal(isDeclining(s), true);
  assert.equal(s.telemetry.amendments.length, 1);
  assert.match(s.telemetry.amendments[0].reason, /success rate/);
  assert.match(s.telemetry.amendments[0].proposal, /gotchas/);
  s = recordUse(s, false, 'fail c', 5000);                 // still the same streak
  assert.equal(s.telemetry.amendments.length, 1, 'no amendment spam while the streak persists');
});

test('telemetry · recovery then a new decline appends a second amendment', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, false, 'f1', 2000);
  s = recordUse(s, false, 'f2', 3000);
  s = recordUse(s, false, 'f3', 4000);                     // streak 1 → amendment 1
  assert.equal(s.telemetry.amendments.length, 1);
  s = recordUse(s, true, undefined, 5000);
  s = recordUse(s, true, undefined, 6000);
  s = recordUse(s, true, undefined, 7000);
  s = recordUse(s, true, undefined, 8000);                 // last5 has 4 ok → recovered
  assert.equal(isDeclining(s), false);
  s = recordUse(s, false, 'g1', 9000);
  s = recordUse(s, false, 'g2', 10000);
  s = recordUse(s, false, 'g3', 11000);                    // decline again → amendment 2
  assert.equal(s.telemetry.amendments.length, 2);
});

test('forge · upsert keeps existing telemetry on re-forge', () => {
  let s = mintSkill(candidate(), 1000);
  s = recordUse(s, true, 'first win', 2000);
  const reforged = mintSkill({ ...candidate(), occurrences: 12 }, 9000);
  const merged = upsertSkills([s], [reforged]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].telemetry.uses, 1, 'telemetry survives');
  assert.equal(merged[0].status, 'validated', 'status survives');
  assert.equal(merged[0].source.occurrences, 12, 'evidence refreshed');
});

test('forge · brand-new signature mints alongside the existing registry', () => {
  const existing = [mintSkill(candidate(), 1000)];
  const fresh = mintSkill({ signature: 'build|error|reroll', source: 'deviations', occurrences: 4, samples: [DEV_LINE] }, 2000);
  const merged = upsertSkills(existing, [fresh]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((m) => m.skill_id === 'cambium-build-error-reroll'));
});
