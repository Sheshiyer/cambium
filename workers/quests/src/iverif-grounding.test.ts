import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IVERIF_GROUNDING, getIVerifClaimsByStatus } from './iverif-grounding.ts';

test('IVerif grounding fixes the product, provider, and Telegram binding', () => {
  assert.deepEqual(IVERIF_GROUNDING.binding, {
    productId: 'iverif',
    cambiumBranch: 'iverif',
    expleeProjectId: 16_763,
    expleeCampaignId: 45_711,
    telegramTopic: 'clients',
    telegramThreadId: '804',
  });
});

test('IVerif grounding remains observe-only and blocks all provider mutation', () => {
  assert.equal(IVERIF_GROUNDING.policy.providerMode, 'observe-only');
  assert.deepEqual(IVERIF_GROUNDING.policy.allowedProviderMethods, ['GET']);
  assert.equal(IVERIF_GROUNDING.policy.providerMutationEnabled, false);
  assert.equal(IVERIF_GROUNDING.policy.outreachDispatchEnabled, false);
  assert.equal(IVERIF_GROUNDING.policy.sendEligible, false);
  assert.equal(IVERIF_GROUNDING.policy.promotionState, 'proof-only');
});

test('IVerif grounding pins source lineage and leaves unsourced product claims unverified', () => {
  assert.match(IVERIF_GROUNDING.snapshot.digest, /^[a-f0-9]{64}$/);
  assert.equal(IVERIF_GROUNDING.snapshot.sources.length, 7);
  for (const source of IVERIF_GROUNDING.snapshot.sources) {
    assert.match(source.path, /^iverif\/wiki-output\//);
    assert.match(source.digest, /^[a-f0-9]{64}$/);
    assert.ok(source.sourceEvidence);
  }
  assert.ok(IVERIF_GROUNDING.snapshot.sources.some((source) => source.path.endsWith('/audience/secondary-personas.md')));
  assert.equal(getIVerifClaimsByStatus('verified').length, 0);
});

test('IVerif grounding blocks every named high-risk claim family', () => {
  const blockedCategories = new Set(getIVerifClaimsByStatus('blocked').map((claim) => claim.category));
  assert.deepEqual(blockedCategories, new Set([
    'performance',
    'certification',
    'customer-proof',
    'programme',
    'onboarding',
    'market-statistic',
    'superlative',
    'compliance-guarantee',
  ]));
});

test('IVerif experiment changes exactly one variable and requires reply classification', () => {
  assert.equal(IVERIF_GROUNDING.experiment.variableCount, 1);
  assert.equal(IVERIF_GROUNDING.experiment.variable, 'discovery-framing');
  assert.equal(IVERIF_GROUNDING.baseline.replies, 17);
  assert.equal(IVERIF_GROUNDING.baseline.classifiedReplies, 0);
  assert.equal(IVERIF_GROUNDING.baseline.classificationRequired, 17);
  assert.match(IVERIF_GROUNDING.experiment.prerequisites[0], /Classify all 17/);
});

test('IVerif baseline preserves the reviewed Public Agencies observation', () => {
  assert.equal(IVERIF_GROUNDING.audience.campaign, 'Public Agencies');
  assert.equal(IVERIF_GROUNDING.audience.persona, 'Regulatory Auditor / Programme Administrator');
  assert.deepEqual(IVERIF_GROUNDING.baseline, {
    observedAt: '2026-07-16',
    source: 'direct Explee read observation',
    sends: 2_921,
    replies: 17,
    replyRatePercent: 0.6,
    hotLeads: 6,
    spendUsdCents: 8_763,
    poolUsed: 2_779,
    poolTotal: 2_887,
    classifiedReplies: 0,
    classificationRequired: 17,
  });
});
