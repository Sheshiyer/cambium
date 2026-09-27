import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IVERIF_HISTORICAL_LESSONS,
  SAPLING_GTM_LEARNING_LOOP_SCHEMA,
  compileSaplingGtmLearning,
} from './sapling-gtm-learning-loop.ts';

const NOW = '2026-09-11T18:30:00.000Z';

test('learning loop schema and iverif lessons present', () => {
  assert.equal(SAPLING_GTM_LEARNING_LOOP_SCHEMA, 'cambium.sapling-gtm-learning-loop.v1');
  assert.ok(IVERIF_HISTORICAL_LESSONS.some((l) => l.label === 'money_guzzler'));
  assert.ok(IVERIF_HISTORICAL_LESSONS.some((l) => l.label === 'relative_winner'));
});

test('rejects reusing historical project as clean container', () => {
  const result = compileSaplingGtmLearning({
    saplingId: 'sapling:iverif',
    cleanExpleeProjectId: 16763,
    historicalProjectId: 16763,
    historicalLessons: IVERIF_HISTORICAL_LESSONS,
    liveCampaigns: [],
    brandPacketRef: 'meristem/brands/iverif',
  });
  assert.equal(result.ok, false);
});

test('compiles iverif continuous learning receipt from live 35674 shape', () => {
  const result = compileSaplingGtmLearning(
    {
      saplingId: 'sapling:iverif',
      cleanExpleeProjectId: 35674,
      historicalProjectId: 16763,
      historicalLessons: IVERIF_HISTORICAL_LESSONS,
      meristemTargetCampaignId: 159036,
      brandPacketRef: 'meristem/brands/iverif',
      ownedEmailFrom: 'wave@thoughtseed.space',
      liveCampaigns: [
        { id: 159032, name: 'Energy EPC Firms', status: 'listening' },
        { id: 159036, name: 'FR CEE — Délégataires & ops (Meristem)', status: 'listening', language: 'fr' },
        { id: 159037, name: 'Energy Lenders', status: 'listening' },
      ],
    },
    NOW,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.receipt.live.meristemTargetPresent, true);
  assert.equal(result.receipt.live.meristemTargetId, 159036);
  assert.ok(result.receipt.live.cloneIcpNamesStillPresent.includes('Energy EPC Firms'));
  assert.equal(result.receipt.foldback.doNotReuseHistoricalStats, true);
  assert.equal(result.receipt.foldback.spendApprovedRequired, true);
  assert.equal(result.receipt.nextHypotheses.length, 3);
  assert.ok(result.receipt.targetingRules.some((r) => r.id === 'LR-1' && r.severity === 'ban'));
  assert.ok(result.receipt.nextHypotheses.some((h) => h.prong === 'B-owned-email'));
});
