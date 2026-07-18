import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SPEND_VOCABULARY,
  normalizeSpendPolicy,
  validateSpendPolicy,
} from './lib/spend-policy.mjs';

const window = {
  starts_at: '2026-07-01T00:00:00.000Z',
  ends_at: '2026-08-01T00:00:00.000Z',
};

test('spend policy exposes the exact closed vocabulary', () => {
  assert.deepEqual(SPEND_VOCABULARY, ['none', 'subscription', 'metered', 'gated']);
  assert.equal(Object.isFrozen(SPEND_VOCABULARY), true);
});

test('legacy none and gated scalar values normalize without widening authority', () => {
  assert.deepEqual(normalizeSpendPolicy('none'), { tier: 'none' });
  assert.deepEqual(normalizeSpendPolicy('gated'), { tier: 'gated' });
  assert.deepEqual(normalizeSpendPolicy(undefined), { tier: 'gated' });
});

test('subscription requires a provider binding and bounded budget window', () => {
  const valid = validateSpendPolicy({
    spend: {
      tier: 'subscription',
      provider_binding: 'explee-readonly-v1',
      budget_window: window,
    },
    provider_io: 'network',
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.policy.tier, 'subscription');

  for (const spend of [
    { tier: 'subscription', budget_window: window },
    { tier: 'subscription', provider_binding: '', budget_window: window },
    { tier: 'subscription', provider_binding: 'explee-readonly-v1' },
  ]) {
    const result = validateSpendPolicy({ spend });
    assert.equal(result.ok, false, JSON.stringify(spend));
    assert.equal(result.code, 'invalid_spend_policy');
  }
});

test('metered requires a unit, positive finite limit, and bounded budget window', () => {
  const valid = validateSpendPolicy({
    spend: { tier: 'metered', unit: 'request', limit: 100, budget_window: window },
    provider_io: 'network',
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.policy.tier, 'metered');

  for (const spend of [
    { tier: 'metered', unit: '', limit: 1, budget_window: window },
    { tier: 'metered', unit: 'request', limit: 0, budget_window: window },
    { tier: 'metered', unit: 'request', limit: -1, budget_window: window },
    { tier: 'metered', unit: 'request', limit: Number.POSITIVE_INFINITY, budget_window: window },
    { tier: 'metered', unit: 'request', limit: 1 },
  ]) {
    const result = validateSpendPolicy({ spend });
    assert.equal(result.ok, false, JSON.stringify(spend));
    assert.equal(result.code, 'invalid_spend_policy');
  }
});

test('budget windows must contain ordered ISO date-time bounds', () => {
  for (const budget_window of [
    null,
    'monthly',
    {},
    { starts_at: 'not-a-date', ends_at: window.ends_at },
    { starts_at: '2026-02-30T00:00:00.000Z', ends_at: window.ends_at },
    { starts_at: window.starts_at, ends_at: 'not-a-date' },
    { starts_at: window.ends_at, ends_at: window.starts_at },
    { starts_at: window.starts_at, ends_at: window.starts_at },
  ]) {
    const result = validateSpendPolicy({
      spend: {
        tier: 'subscription',
        provider_binding: 'explee-readonly-v1',
        budget_window,
      },
    });
    assert.equal(result.ok, false, JSON.stringify(budget_window));
    assert.match(result.reason, /budget_window/);
  }
});

test('unknown tiers and malformed policy shapes fail closed', () => {
  for (const spend of [
    'free',
    'never',
    1,
    true,
    [],
    null,
    { tier: 'chaos' },
    { tier: 'none', limit: 10 },
  ]) {
    const result = validateSpendPolicy({ spend });
    assert.equal(result.ok, false, JSON.stringify(spend));
    assert.equal(result.code, 'invalid_spend_policy');
  }
});

test('none refuses an adapter that declares provider I/O', () => {
  for (const adapter of [
    { spend: 'none', provider_io: true },
    { spend: 'none', provider_io: 'network' },
    { spend: 'none', provider_io: 'read' },
    { spend: 'none', network_provider: true },
    { spend: 'none', provider: 'network' },
    { spend: 'none', provider: { transport: 'network' } },
  ]) {
    const result = validateSpendPolicy(adapter);
    assert.equal(result.ok, false, JSON.stringify(adapter));
    assert.equal(result.code, 'invalid_spend_policy');
    assert.match(result.reason, /provider I\/O/i);
  }
});

test('none remains valid for current local process adapters', () => {
  const result = validateSpendPolicy({
    spend: 'none',
    cmd: 'node',
    args: ['scripts/local.mjs'],
    provider_io: false,
  });
  assert.deepEqual(result, { ok: true, policy: { tier: 'none' } });
});
