import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FITCHECK_GOLDEN_PATH } from './fitcheck-golden-path.ts';
import {
  FITCHECK_LOOPS,
  FITCHECK_LOOP_PACK_SCHEMA,
  fitcheckLoopPackManifest,
  runAllFitcheckLoops,
  runFitcheckLoop,
} from './fitcheck-loop-pack.ts';

test('fitcheck loop pack covers golden-path operational stages', () => {
  const stages = FITCHECK_LOOPS.map((l) => l.stage);
  for (const need of [
    'identified',
    'systems-bound',
    'mapping-verified',
    'planned',
    'd1-eligible',
    'admitted',
    'pinned',
    'executed',
    'learned',
  ] as const) {
    assert.ok(stages.includes(need), `missing loop for ${need}`);
  }
  assert.equal(fitcheckLoopPackManifest().schema, FITCHECK_LOOP_PACK_SCHEMA);
  assert.equal(fitcheckLoopPackManifest().writesGoalGraph, false);
  assert.equal(fitcheckLoopPackManifest().workId, FITCHECK_GOLDEN_PATH.identity.workId);
});

test('identity and mapping loops pass on static golden path', () => {
  const id = runFitcheckLoop('fitcheck-loop-identified');
  assert.equal(id.exit, 'passed');
  assert.ok(id.probes.every((p) => p.status === 'pass'));

  const map = runFitcheckLoop('fitcheck-loop-mapping-verified');
  assert.notEqual(map.exit, 'failed');
  assert.ok(map.probes.some((p) => p.probeId === 'FIT-ISC-MAP-1' && p.status === 'pass'));
  assert.ok(map.probes.some((p) => p.probeId === 'FIT-ISC-MAP-2' && p.status === 'pass'));
});

test('held operational loops stay held without external evidence', () => {
  const admitted = runFitcheckLoop('fitcheck-loop-admitted');
  assert.equal(admitted.operationalHeld, true);
  assert.equal(admitted.exit, 'held');

  const pinned = runFitcheckLoop('fitcheck-loop-pinned');
  assert.equal(pinned.exit, 'held');

  const executed = runFitcheckLoop('fitcheck-loop-executed');
  assert.equal(executed.exit, 'held');
});

test('external evidence can clear admission/pin/execute probes without writing graph', () => {
  const admitted = runFitcheckLoop('fitcheck-loop-admitted', { d1TaskReadback: true });
  assert.equal(admitted.probes.find((p) => p.probeId === 'FIT-ISC-ADM-1')?.status, 'pass');

  const pinned = runFitcheckLoop('fitcheck-loop-pinned', { loadoutPinned: true });
  assert.equal(pinned.probes.find((p) => p.probeId === 'FIT-ISC-PIN-1')?.status, 'pass');

  const executed = runFitcheckLoop('fitcheck-loop-executed', { hermesReceipt: true });
  assert.equal(executed.probes.find((p) => p.probeId === 'FIT-ISC-EXE-1')?.status, 'pass');
});

test('runAllFitcheckLoops never claims Goal Graph mutation', () => {
  const all = runAllFitcheckLoops();
  assert.equal(all.length, FITCHECK_LOOPS.length);
  assert.ok(all.every((r) => typeof r.summary === 'string' && r.summary.length > 0));
  // Learning next-intent remains proposal-only on static path
  const learned = all.find((r) => r.loopId === 'fitcheck-loop-learned');
  assert.ok(learned);
  assert.equal(learned!.probes.find((p) => p.probeId === 'FIT-ISC-LRN-1')?.status, 'pass');
});
