import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOperatorPolicy, OPERATOR_POLICY_RULES_VERSION } from './operator-policy.ts';
import type { QuestLedger } from './quests.ts';

const ledgerWithFrontier = {
  rows: [],
  completed: 3,
  total: 17,
  current: { id: 'viability', arc: 'V', title: 'Viability' },
} as unknown as QuestLedger;

const priority = (
  risk: 'low' | 'medium' | 'high' | 'critical',
  dependency: 'none' | 'blocks-delivery' | 'blocked-by-external',
) => ({
  source: 'paperclip-priority@v1',
  risk,
  dependency,
  score: ({ none: 0, 'blocked-by-external': 10, 'blocks-delivery': 20 }[dependency]) +
    ({ low: 1, medium: 2, high: 3, critical: 4 }[risk]),
  reasons: [`${risk} risk`, `${dependency} dependency`],
});

const prioritySignals = (overrides: Record<string, unknown> = {}) => ({
  source: 'operator-priority-signals@v1',
  founderPreference: {
    targetId: 'THO-10',
    weight: 10,
    proof: 'founder ranked THO-10 as this refresh window priority',
  },
  ownerLoad: {
    owner: 'Mathis',
    openItems: 3,
    capacity: 2,
    proof: 'Paperclip capacity roster shows Mathis over capacity',
  },
  economicRisk: {
    amount: 12000,
    currency: 'USD',
    risk: 'high',
    proof: 'contract amount and unpaid deposit served by project ledger',
  },
  teamAvailability: {
    available: 1,
    required: 2,
    proof: 'team availability roster has one available reviewer',
  },
  memberRevocation: {
    revoked: false,
    proof: 'bridge membership revocation check returned none',
  },
  crossTenantUrgency: {
    score: 4,
    tenants: 3,
    proof: 'three tenants have active gate queues',
  },
  ...overrides,
});

test('operator policy blocks recommendations until stance and skill signals are proven', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'insufficient',
      label: null,
      dominant: null,
      sampleSize: 2,
      minimum: 6,
      gap: 'need 6 tenant events; found 2',
    },
    skills: { source: 'missing', rows: [], gap: 'skill registry missing' },
  });

  assert.equal(policy.source, 'operator-policy');
  assert.equal(policy.status, 'blocked');
  assert.equal(policy.action, null);
  assert.equal(policy.rulesVersion, OPERATOR_POLICY_RULES_VERSION);
  assert.deepEqual(policy.requiredSignals, ['active quest frontier', 'tenant stance sample', 'skill registry tier']);
  assert.match(policy.blockers.join(' · '), /need 6 tenant events/);
  assert.match(policy.blockers.join(' · '), /skill registry missing/);
});

test('operator policy emits a ready action only from frontier, ready stance, and reliable skill', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [
        { id: 'cambium-new-labor', tier: 'unproven', tierLabel: 'UNPROVEN', sampleSize: 1 },
        { id: 'cambium-ship-gate', tier: 'reliable', tierLabel: 'RELIABLE', sampleSize: 4 },
      ],
    },
  });

  assert.equal(policy.status, 'ready');
  assert.equal(policy.title, 'NEXT ACTION');
  assert.match(policy.action ?? '', /Advance V · Viability through MICRO-LED using cambium-ship-gate/);
  assert.match(policy.detail, /RELIABLE skill/);
  assert.deepEqual(policy.blockers, []);
  assert.match(policy.cautions.join(' · '), /production promotion still requires founder approval policy/);
});

test('operator policy prioritizes evidence-complete gate review over generic frontier work', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    gateItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      status: 'blocked',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-22T00:00:00.000Z',
      approveConsequence: 'approve THO-9 for Paperclip execution',
      rerollConsequence: 'reroll THO-9 and request revision before execution',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked:2026-06-22T00:00:00.000Z',
      priority: priority('critical', 'blocks-delivery'),
    }],
  });

  assert.equal(policy.status, 'ready');
  assert.match(policy.action ?? '', /Review gate item THO-9: Review launch copy/);
  assert.match(policy.detail, /blocked queue priority/);
  assert.match(policy.detail, /critical risk · blocks-delivery dependency/);
  assert.deepEqual(policy.requiredSignals, ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal']);
  assert.match(policy.cautions.join(' · '), /signed Gate flow/);
});

test('operator policy scores multiple gate items by status, dependency, risk, age, then id', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    gateItems: [
      {
        id: 'THO-8',
        title: 'Open build follow-up',
        status: 'open',
        updatedAt: '2026-06-22T01:00:00.000Z',
        evidence: 'THO-8 is open · owner Paperclip · updated 2026-06-22T01:00:00.000Z',
        approveConsequence: 'approve THO-8 for Paperclip execution',
        rerollConsequence: 'reroll THO-8 and request revision before execution',
        reversibility: 'queued action can be superseded until consumed',
        idempotencyHint: 'THO-8:open:2026-06-22T01:00:00.000Z',
        priority: priority('critical', 'blocks-delivery'),
      },
      {
        id: 'THO-10',
        title: 'Blocked launch proof',
        status: 'blocked',
        updatedAt: '2026-06-22T02:00:00.000Z',
        evidence: 'THO-10 is blocked · owner Paperclip · updated 2026-06-22T02:00:00.000Z',
        approveConsequence: 'approve THO-10 for Paperclip execution',
        rerollConsequence: 'reroll THO-10 and request revision before execution',
        reversibility: 'queued action can be superseded until consumed',
        idempotencyHint: 'THO-10:blocked:2026-06-22T02:00:00.000Z',
        priority: priority('low', 'none'),
      },
      {
        id: 'THO-9',
        title: 'Older blocked founder review',
        status: 'blocked',
        updatedAt: '2026-06-21T23:00:00.000Z',
        evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-21T23:00:00.000Z',
        approveConsequence: 'approve THO-9 for Paperclip execution',
        rerollConsequence: 'reroll THO-9 and request revision before execution',
        reversibility: 'queued action can be superseded until consumed',
        idempotencyHint: 'THO-9:blocked:2026-06-21T23:00:00.000Z',
        priority: priority('high', 'blocks-delivery'),
      },
    ],
  });

  assert.equal(policy.status, 'ready');
  assert.match(policy.action ?? '', /Review gate item THO-9: Older blocked founder review/);
  assert.match(policy.detail, /high risk · blocks-delivery dependency/);
  assert.match(policy.detail, /3 gate items ranked/);
  assert.doesNotMatch(policy.action ?? '', /THO-8|THO-10/);
});

test('operator policy blocks malformed gate items instead of ignoring the gate risk', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    gateItems: [{ id: 'THO-9', title: 'Review launch copy', status: 'blocked' }],
  });

  assert.equal(policy.status, 'blocked');
  assert.equal(policy.action, null);
  assert.match(policy.blockers.join(' · '), /gate item THO-9 missing evidence/);
  assert.deepEqual(policy.requiredSignals, ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal']);
});

test('operator policy blocks gate items missing risk or dependency priority signals', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    gateItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      status: 'blocked',
      evidence: 'THO-9 is blocked · owner Paperclip · updated 2026-06-22T00:00:00.000Z',
      approveConsequence: 'approve THO-9 for Paperclip execution',
      rerollConsequence: 'reroll THO-9 and request revision before execution',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked:2026-06-22T00:00:00.000Z',
    }],
  });

  assert.equal(policy.status, 'blocked');
  assert.equal(policy.action, null);
  assert.match(policy.blockers.join(' · '), /risk, or dependency/);
});

test('operator policy v1.4 ranks gate items with complete explicit priority signals', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    prioritySignals: prioritySignals() as any,
    gateItems: [
      {
        id: 'THO-9',
        title: 'Older blocked founder review',
        status: 'blocked',
        owner: 'Mathis',
        updatedAt: '2026-06-21T23:00:00.000Z',
        evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-21T23:00:00.000Z',
        approveConsequence: 'approve THO-9 for Paperclip execution',
        rerollConsequence: 'reroll THO-9 and request revision before execution',
        reversibility: 'queued action can be superseded until consumed',
        idempotencyHint: 'THO-9:blocked:2026-06-21T23:00:00.000Z',
        priority: priority('critical', 'blocks-delivery'),
      },
      {
        id: 'THO-10',
        title: 'Founder preferred delivery gate',
        status: 'blocked',
        owner: 'Paperclip',
        updatedAt: '2026-06-22T02:00:00.000Z',
        evidence: 'THO-10 is blocked · owner Paperclip · updated 2026-06-22T02:00:00.000Z',
        approveConsequence: 'approve THO-10 for Paperclip execution',
        rerollConsequence: 'reroll THO-10 and request revision before execution',
        reversibility: 'queued action can be superseded until consumed',
        idempotencyHint: 'THO-10:blocked:2026-06-22T02:00:00.000Z',
        priority: priority('high', 'blocks-delivery'),
      },
    ],
  });

  assert.equal(policy.status, 'ready');
  assert.equal(policy.rulesVersion, 'operator-policy@v1.4');
  assert.match(policy.action ?? '', /THO-10: Founder preferred delivery gate/);
  assert.match(policy.detail, /priority signals/);
  assert.match(policy.cautions.join(' · '), /founder preference THO-10/);
  assert.match(policy.cautions.join(' · '), /team availability below required capacity/);
  assert.deepEqual(policy.requiredSignals, [
    'gate item evidence',
    'gate consequences',
    'gate idempotency',
    'gate queue priority',
    'gate risk signal',
    'gate dependency signal',
    'founder preference signal',
    'owner capacity signal',
    'economic amount/currency risk',
    'team availability signal',
    'member revocation signal',
    'cross-tenant urgency score',
  ]);
});

test('operator policy refuses incomplete priority signals instead of falling back to visual context', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    prioritySignals: prioritySignals({ founderPreference: { targetId: 'THO-10', weight: 10 } }) as any,
    gateItems: [{
      id: 'THO-10',
      title: 'Founder preferred delivery gate',
      status: 'blocked',
      owner: 'Paperclip',
      updatedAt: '2026-06-22T02:00:00.000Z',
      evidence: 'THO-10 is blocked · owner Paperclip · updated 2026-06-22T02:00:00.000Z',
      approveConsequence: 'approve THO-10 for Paperclip execution',
      rerollConsequence: 'reroll THO-10 and request revision before execution',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-10:blocked:2026-06-22T02:00:00.000Z',
      priority: priority('critical', 'blocks-delivery'),
    }],
  });

  assert.equal(policy.status, 'blocked');
  assert.equal(policy.action, null);
  assert.match(policy.blockers.join(' · '), /founder preference signal missing target, weight, or proof/);
  assert.ok(policy.requiredSignals.includes('founder preference signal'));
});

test('operator policy blocks recommendations when served priority signals report member revocation', () => {
  const policy = evaluateOperatorPolicy({
    ledger: ledgerWithFrontier,
    stance: {
      status: 'ready',
      label: 'MICRO-LED',
      dominant: 'micro',
      sampleSize: 8,
      minimum: 6,
    },
    skills: {
      source: 'skill-registry',
      rows: [{ id: 'cambium-ship-gate', tier: 'production', tierLabel: 'PRODUCTION', sampleSize: 8 }],
    },
    prioritySignals: prioritySignals({
      memberRevocation: { revoked: true, proof: 'member token revoked before this refresh' },
    }) as any,
    gateItems: [{
      id: 'THO-10',
      title: 'Founder preferred delivery gate',
      status: 'blocked',
      owner: 'Paperclip',
      updatedAt: '2026-06-22T02:00:00.000Z',
      evidence: 'THO-10 is blocked · owner Paperclip · updated 2026-06-22T02:00:00.000Z',
      approveConsequence: 'approve THO-10 for Paperclip execution',
      rerollConsequence: 'reroll THO-10 and request revision before execution',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-10:blocked:2026-06-22T02:00:00.000Z',
      priority: priority('critical', 'blocks-delivery'),
    }],
  });

  assert.equal(policy.status, 'blocked');
  assert.equal(policy.action, null);
  assert.match(policy.blockers.join(' · '), /member revocation is active/);
});
