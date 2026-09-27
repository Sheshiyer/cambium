import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IVERIF_GTM_LOOP_CONTEXT,
  SAPLING_GTM_LOOP_PACK_SCHEMA,
  SAPLING_GTM_LOOPS,
  evaluateSaplingGtmLoops,
} from './sapling-gtm-loop-pack.ts';

test('sapling GTM loop pack has six stages and stable schema', () => {
  assert.equal(SAPLING_GTM_LOOP_PACK_SCHEMA, 'cambium.sapling-gtm-loop-pack.v1');
  assert.equal(SAPLING_GTM_LOOPS.length, 6);
  const stages = SAPLING_GTM_LOOPS.map((l) => l.stage);
  assert.deepEqual(stages, [
    'bind-identity',
    'observe-learn',
    'clean-channel',
    'compose-drafts',
    'hermes-miniapp',
    'arm-spend',
  ]);
});

test('iverif calibration passes hygiene probes and holds spend', () => {
  const report = evaluateSaplingGtmLoops(IVERIF_GTM_LOOP_CONTEXT);
  const byLoop = Object.fromEntries(report.map((r) => [r.loopId, r.results]));

  assert.equal(byLoop['sapling-gtm-bind-identity'].every((p) => p.status === 'pass'), true);
  assert.equal(byLoop['sapling-gtm-clean-channel'].every((p) => p.status === 'pass'), true);
  assert.equal(byLoop['sapling-gtm-compose-drafts'].every((p) => p.status === 'pass'), true);

  const arm = byLoop['sapling-gtm-arm-spend'].find((p) => p.probeId === 'SGTM-ARM-1');
  assert.equal(arm?.status, 'held');

  const failCtx = {
    ...IVERIF_GTM_LOOP_CONTEXT,
    campaignStarted: true,
    spendApproved: false,
  };
  const armed = evaluateSaplingGtmLoops(failCtx)
    .find((r) => r.loopId === 'sapling-gtm-arm-spend')
    ?.results.find((p) => p.probeId === 'SGTM-ARM-1');
  assert.equal(armed?.status, 'fail');
});
