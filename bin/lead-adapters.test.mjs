import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LEAD_ADAPTER_IDS,
  SCHEDULE_PREREQUISITES,
  evaluateRecurringScheduleArm,
  validateLeadAdapterCatalog,
} from './lib/lead-adapters.mjs';
import { canonicalDigest } from './lib/lead-contracts.mjs';

const catalogUrl = new URL('../composition/lead-adapters.v1.json', import.meta.url);
const loadCatalog = async () => JSON.parse(await readFile(catalogUrl, 'utf8'));
const clone = (value) => structuredClone(value);

function resign(catalog) {
  const unsigned = clone(catalog);
  delete unsigned.catalog_digest;
  catalog.catalog_digest = canonicalDigest(unsigned);
  return catalog;
}

test('lead adapters are registered in the requested increasing-risk order', async () => {
  const catalog = await loadCatalog();
  const result = validateLeadAdapterCatalog(catalog);

  assert.deepEqual(result.adapter_ids, LEAD_ADAPTER_IDS);
  assert.deepEqual(catalog.adapters.map((adapter) => adapter.risk_order), [10, 20, 30, 40, 50, 60, 70, 80]);
  assert.deepEqual(catalog.adapters.slice(0, 3).map((adapter) => adapter.provider), [
    'explee',
    'scrapegraphai',
    'getleads.io',
  ]);
  assert.equal(catalog.adapters[3].id, 'apollo-enrichment@1.0.0');
  assert.deepEqual(catalog.adapters.slice(4, 6).map((adapter) => adapter.id), [
    'apollo-engagement@1.0.0',
    'composio-engagement@1.0.0',
  ]);
  assert.deepEqual(catalog.adapters.slice(6).map((adapter) => adapter.id), [
    'elevenlabs-create@1.0.0',
    'runway-create@1.0.0',
  ]);
});

test('only Explee read parity is active and it carries zero mutation or spend authority', async () => {
  const catalog = await loadCatalog();
  validateLeadAdapterCatalog(catalog);

  const [explee, ...inactive] = catalog.adapters;
  assert.deepEqual(explee.activation, {
    state: 'active_read_only',
    network_enabled: true,
    schedule_enabled: false,
  });
  assert.deepEqual(explee.transport, {
    kind: 'provider_api',
    methods: ['GET'],
    mutation_enabled: false,
  });
  assert.deepEqual(explee.spend, {
    tier: 'none',
    reservation_required: false,
    usage_settlement_required: false,
  });
  for (const adapter of inactive) {
    assert.equal(adapter.activation.state, 'registered_disabled');
    assert.equal(adapter.activation.network_enabled, false);
    assert.equal(adapter.activation.schedule_enabled, false);
  }
});

test('engagement and media adapters require approval, receipts, reservations, and usage settlement', async () => {
  const catalog = await loadCatalog();
  validateLeadAdapterCatalog(catalog);
  const gated = catalog.adapters.slice(4);

  for (const adapter of gated) {
    assert.equal(adapter.authority.owner, 'cambium');
    assert.equal(adapter.authority.approval_required, true);
    assert.equal(adapter.authority.receipt_required, true);
    assert.equal(adapter.spend.reservation_required, true);
    assert.equal(adapter.spend.usage_settlement_required, true);
  }
  for (const adapter of catalog.adapters.slice(4)) {
    assert.equal(adapter.transport.mutation_enabled, true);
  }
});

test('recurring schedules stay inert until every durable prerequisite passes', async () => {
  const catalog = await loadCatalog();
  const empty = evaluateRecurringScheduleArm(catalog, {});
  assert.deepEqual(empty, {
    allowed: false,
    schedule_armed: false,
    missing: SCHEDULE_PREREQUISITES,
  });

  for (const missing of SCHEDULE_PREREQUISITES) {
    const evidence = Object.fromEntries(SCHEDULE_PREREQUISITES.map((key) => [key, key !== missing]));
    assert.deepEqual(evaluateRecurringScheduleArm(catalog, evidence), {
      allowed: false,
      schedule_armed: false,
      missing: [missing],
    });
  }

  const complete = Object.fromEntries(SCHEDULE_PREREQUISITES.map((key) => [key, true]));
  assert.deepEqual(evaluateRecurringScheduleArm(catalog, complete), {
    allowed: true,
    schedule_armed: false,
    missing: [],
    requires_explicit_arm_change: true,
  });
});

test('catalog rejects risk reordering, schedule arming, authority drift, and digest drift', async () => {
  const catalog = await loadCatalog();
  const cases = [
    ['risk order', (value) => { [value.adapters[0], value.adapters[1]] = [value.adapters[1], value.adapters[0]]; }, /risk order|id violates/i],
    ['schedule armed', (value) => { value.recurring_schedule.armed = true; }, /unarmed/i],
    ['provider-owned runtime', (value) => { value.authority.owner = 'provider'; }, /Cambium/i],
    ['engagement without approval', (value) => { value.adapters[4].authority.approval_required = false; }, /approval/i],
  ];
  for (const [name, mutate, pattern] of cases) {
    const drifted = clone(catalog);
    mutate(drifted);
    resign(drifted);
    assert.throws(() => validateLeadAdapterCatalog(drifted), pattern, name);
  }

  const digestDrift = clone(catalog);
  digestDrift.adapters[0].jobs.push('hidden_job');
  assert.throws(() => validateLeadAdapterCatalog(digestDrift), /catalog_digest/i);
});
