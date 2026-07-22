import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateLeadContractCatalog,
  validateProviderConformanceFixture,
} from './lib/lead-contracts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

async function loadJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

async function inputs() {
  return {
    catalog: await loadJson(join(root, 'composition', 'contracts', 'lead-ecosystem.v1.json')),
    fixture: await loadJson(join(root, 'examples', 'provider-conformance', 'synthetic-observation.json')),
  };
}

test('synthetic provider observation conforms deterministically without network access', async () => {
  const { catalog, fixture } = await inputs();
  validateLeadContractCatalog(catalog);
  let calls = 0;
  const network = async () => {
    calls += 1;
    throw new Error('network sentinel: provider access is forbidden');
  };

  const first = validateProviderConformanceFixture(catalog, fixture, { network });
  const second = validateProviderConformanceFixture(catalog, structuredClone(fixture), { network });

  assert.equal(calls, 0, 'offline conformance must never invoke the injected network function');
  assert.deepEqual(first, second, 'the same fixture must produce the same receipt');
  assert.deepEqual(first, {
    valid: true,
    mode: 'offline-fixture',
    fixture_id: 'synthetic-company-observation@1.0.0',
    observation_id: 'provider-observation-synthetic-001',
    observation_digest: fixture.expected_observation_digest,
    mutation_enabled: false,
    network_calls: 0,
  });
});

test('provider conformance fails on cross-record drift before any network call', async () => {
  const { catalog, fixture } = await inputs();
  let calls = 0;
  const network = () => {
    calls += 1;
    throw new Error('network sentinel');
  };

  const drifted = structuredClone(fixture);
  drifted.provider_binding.provider_permission_id = 'provider-permission-missing';
  assert.throws(
    () => validateProviderConformanceFixture(catalog, drifted, { network }),
    /permission reference mismatch/i,
  );
  assert.equal(calls, 0);
});

test('provider conformance rejects caller overrides, unsafe targets, and mutation widening offline', async () => {
  const { catalog, fixture } = await inputs();
  const network = () => {
    throw new Error('network sentinel');
  };

  const override = structuredClone(fixture);
  override.observation.payload_facts[0].account_id = 'caller-account';
  assert.throws(
    () => validateProviderConformanceFixture(catalog, override, { network }),
    /caller-owned override.*account_id/i,
  );

  const remote = structuredClone(fixture);
  remote.provider_contract.target_refs = ['remote://forbidden-provider'];
  assert.throws(
    () => validateProviderConformanceFixture(catalog, remote, { network }),
    /offline local fixture target/i,
  );

  const mutation = structuredClone(fixture);
  mutation.provider_binding.mutation_enabled = true;
  assert.throws(
    () => validateProviderConformanceFixture(catalog, mutation, { network }),
    /mutation_enabled must remain false/i,
  );
});

test('provider conformance rejects endpoint, timeout, retry, schema-drift, and receipt-policy widening offline', async () => {
  const { catalog, fixture } = await inputs();
  let calls = 0;
  const network = () => {
    calls += 1;
    throw new Error('network sentinel');
  };

  const mutations = [
    ['endpoint method', (copy) => { copy.provider_contract.endpoint_allowlist[0].methods = ['POST']; }],
    ['timeout', (copy) => { copy.provider_contract.timeout_ms = 0; }],
    ['retry', (copy) => { copy.provider_contract.retry_policy.max_attempts = 100; }],
    ['schema drift', (copy) => { copy.provider_contract.schema_drift_policy = 'accept'; }],
    ['receipt', (copy) => { copy.provider_contract.receipt_policy = 'raw_payload'; }],
  ];

  for (const [label, mutate] of mutations) {
    const widened = structuredClone(fixture);
    mutate(widened);
    assert.throws(
      () => validateProviderConformanceFixture(catalog, widened, { network }),
      undefined,
      `${label} widening must fail closed`,
    );
  }
  assert.equal(calls, 0);
});
