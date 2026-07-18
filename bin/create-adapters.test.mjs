import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateCreateAdapterCatalog,
} from './lib/create-adapters.mjs';
import { canonicalDigest } from './lib/lead-contracts.mjs';
import {
  validateMarketingAssetCatalog,
  validateMarketingCapabilityCatalog,
} from './lib/marketing-orchestration.mjs';
import { validateLeadContractCatalog } from './lib/lead-contracts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const clone = (value) => structuredClone(value);

async function loadJson(relativePath) {
  return JSON.parse(await readFile(join(root, relativePath), 'utf8'));
}

async function inputs() {
  const [catalog, capabilities, assets, authority] = await Promise.all([
    loadJson('composition/create-adapters.v1.json'),
    loadJson('composition/marketing-capabilities.v1.json'),
    loadJson('composition/contracts/marketing-assets.v1.json'),
    loadJson('composition/contracts/lead-ecosystem.v1.json'),
  ]);
  const capabilityResult = validateMarketingCapabilityCatalog(capabilities);
  const assetResult = validateMarketingAssetCatalog(assets);
  const authorityResult = validateLeadContractCatalog(authority);
  return {
    catalog,
    capabilities,
    assets,
    authority,
    context: {
      recipeIds: capabilityResult.recipe_ids,
      marketingContractIds: assetResult.contract_ids,
      authorityContractIds: authorityResult.contract_ids,
    },
  };
}

function resign(catalog) {
  const unsigned = clone(catalog);
  delete unsigned.catalog_digest;
  catalog.catalog_digest = canonicalDigest(unsigned);
  return catalog;
}

test('registers exactly one disabled fixed-tenant founder article NVIDIA adapter', async () => {
  const { catalog, context } = await inputs();
  const result = validateCreateAdapterCatalog(catalog, context);

  assert.deepEqual(result.adapter_ids, ['founder-article-nvidia@1.0.0']);
  assert.equal(result.catalog_id, 'create-adapters@1.0.0');
  assert.equal(result.catalog_digest, catalog.catalog_digest);
  assert.equal(
    result.activation_value,
    `founder-article-nvidia@1.0.0:${catalog.catalog_digest}`,
  );

  assert.equal(catalog.adapters.length, 1);
  const adapter = catalog.adapters[0];
  assert.equal(adapter.id, 'founder-article-nvidia@1.0.0');
  assert.equal(adapter.stage, 'create');
  assert.equal(adapter.tenant_id, 'thoughtseed');
  assert.equal(adapter.recipe_id, 'founder-article-draft@1.0.0');
  assert.deepEqual(adapter.activation, {
    state: 'registered_disabled',
    value_derivation: '<adapter_id>:<catalog_digest>',
  });
  assert.deepEqual(adapter.provider, {
    id: 'nvidia',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    method: 'POST',
    model: 'meta/llama-3.1-70b-instruct',
    parameters: {
      stream: false,
      temperature: 0.2,
      max_tokens: 1800,
    },
    timeout_ms: 30000,
    maximum_response_bytes: 65536,
    network_attempts: 1,
  });
  assert.deepEqual(adapter.secret, {
    binding: 'NVIDIA_MARKETING_CREATE_API_KEY',
    storage: 'cloudflare_worker_secret',
    exclusivity: 'this_adapter_only',
    exposure: 'authorization_bearer_header_only',
  });
  assert.deepEqual(adapter.prompt_template, {
    id: 'thoughtseed-founder-article@1.0.0',
    sha256: 'd1d1db81ae9b1eaeb9ba3f799a9a7fdeb61e87bc2805fdab4b29761274963a80',
  });
  assert.deepEqual(adapter.spend, { tier: 'gated' });
  assert.deepEqual(adapter.outputs, {
    contract_ids: ['asset_draft@1.0.0', 'operator_receipt@1.0.0'],
    execution_mode: 'review_only',
    server_owned: {
      adapterId: 'founder-article-nvidia@1.0.0',
      artifactDigest: 'worker_computed_sha256',
      publishEligible: false,
      externalAction: 'none',
    },
  });
});

test('catalog digest is canonical SHA-256 over every field except catalog_digest', async () => {
  const { catalog, context } = await inputs();
  const unsigned = clone(catalog);
  delete unsigned.catalog_digest;

  assert.equal(catalog.catalog_digest, canonicalDigest(unsigned));
  assert.match(catalog.catalog_digest, /^[a-f0-9]{64}$/);
  assert.equal(validateCreateAdapterCatalog(catalog, context).valid, true);
});

test('adapter input is one closed bounded inline schema without caller routing authority', async () => {
  const { catalog, context } = await inputs();
  validateCreateAdapterCatalog(catalog, context);
  const schema = catalog.adapters[0].input.schema;
  const serialized = JSON.stringify(schema);

  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties), [
    'requestId',
    'idempotencyKey',
    'actorId',
    'budgetReservationId',
    'expiresAt',
    'brief',
  ]);
  assert.deepEqual(Object.keys(schema.properties.brief.properties), [
    'briefId',
    'objective',
    'audience',
    'callToAction',
    'productPacketId',
    'productPacketDigest',
    'evidenceSnapshotDigest',
    'seedDigest',
    'facts',
  ]);
  assert.deepEqual(Object.keys(schema.properties.brief.properties.facts.items.properties), [
    'claimId',
    'text',
    'sourceDigest',
  ]);
  for (const forbidden of [
    'tenant',
    'provider',
    'model',
    'url',
    'endpoint',
    'prompt',
    'messages',
    'apiKey',
    'credential',
    'temperature',
    'maxTokens',
  ]) {
    assert.ok(!Object.hasOwn(schema.properties, forbidden));
    assert.doesNotMatch(serialized, new RegExp(`"${forbidden}"\\s*:`));
  }
});

test('rejects recipe, contract, reference, identity, routing, spend, and activation drift', async () => {
  const { catalog, context } = await inputs();
  const cases = [
    ['unknown recipe', (value) => { value.adapters[0].recipe_id = 'unknown-recipe@1.0.0'; }, /unknown recipe/i],
    ['unknown input contract', (value) => { value.adapters[0].input.source_contract_id = 'unknown-input@1.0.0'; }, /unknown marketing contract/i],
    ['unknown output contract', (value) => { value.adapters[0].outputs.contract_ids[0] = 'unknown-output@1.0.0'; }, /unknown output contract/i],
    ['path escape', (value) => { value.references.marketing_assets.path = '../marketing-assets.json'; }, /path|local/i],
    ['shared secret', (value) => { value.adapters[0].secret.binding = 'NVIDIA_API_KEY'; }, /exclusive|secret binding/i],
    ['enabled activation', (value) => { value.adapters[0].activation.state = 'enabled'; }, /registered_disabled/i],
    ['non-POST method', (value) => { value.adapters[0].provider.method = 'GET'; }, /POST/i],
    ['provider drift', (value) => { value.adapters[0].provider.id = 'openai'; }, /provider.*nvidia/i],
    ['URL drift', (value) => { value.adapters[0].provider.url = 'https://example.com/v1/chat/completions'; }, /URL/i],
    ['model drift', (value) => { value.adapters[0].provider.model = 'other/model'; }, /model/i],
    ['parameter drift', (value) => { value.adapters[0].provider.parameters.temperature = 0.8; }, /parameters/i],
    ['retry drift', (value) => { value.adapters[0].provider.network_attempts = 2; }, /attempt/i],
    ['spend drift', (value) => { value.adapters[0].spend.tier = 'none'; }, /gated/i],
    ['publication authority', (value) => { value.adapters[0].outputs.server_owned.publishEligible = true; }, /publish|review-only/i],
    ['output action', (value) => { value.adapters[0].outputs.server_owned.externalAction = 'publish'; }, /external action|review-only/i],
    ['prompt drift', (value) => { value.adapters[0].prompt_template.sha256 = 'f'.repeat(64); }, /prompt template/i],
  ];

  for (const [name, mutate, pattern] of cases) {
    const drifted = clone(catalog);
    mutate(drifted);
    resign(drifted);
    assert.throws(
      () => validateCreateAdapterCatalog(drifted, context),
      pattern,
      name,
    );
  }
});

test('rejects multiple adapters, duplicate IDs, unknown keys, and inline secrets', async () => {
  const { catalog, context } = await inputs();

  const multiple = clone(catalog);
  multiple.adapters.push(clone(multiple.adapters[0]));
  multiple.adapters[1].id = 'second-adapter@1.0.0';
  resign(multiple);
  assert.throws(() => validateCreateAdapterCatalog(multiple, context), /exactly one adapter/i);

  const duplicate = clone(catalog);
  duplicate.adapters.push(clone(duplicate.adapters[0]));
  resign(duplicate);
  assert.throws(() => validateCreateAdapterCatalog(duplicate, context), /exactly one|duplicate adapter/i);

  const unknownKey = clone(catalog);
  unknownKey.adapters[0].surprise = true;
  resign(unknownKey);
  assert.throws(() => validateCreateAdapterCatalog(unknownKey, context), /unknown fields/i);

  const inlineSecret = clone(catalog);
  inlineSecret.adapters[0].secret.value = 'do-not-store-me';
  resign(inlineSecret);
  assert.throws(() => validateCreateAdapterCatalog(inlineSecret, context), /inline secret|unknown fields/i);
});

test('rejects every caller-owned routing, prompt, credential, and generation schema field', async () => {
  const { catalog, context } = await inputs();
  for (const forbidden of [
    'tenant',
    'provider',
    'model',
    'url',
    'endpoint',
    'prompt',
    'messages',
    'apiKey',
    'credential',
    'temperature',
    'maxTokens',
  ]) {
    const drifted = clone(catalog);
    drifted.adapters[0].input.schema.properties[forbidden] = {
      type: 'string',
      minLength: 1,
      maxLength: 64,
    };
    drifted.adapters[0].input.schema.required.push(forbidden);
    resign(drifted);
    assert.throws(
      () => validateCreateAdapterCatalog(drifted, context),
      new RegExp(`caller-owned|${forbidden}`, 'i'),
    );
  }
});

test('rejects catalog drift even when the changed field is otherwise well formed', async () => {
  const { catalog, context } = await inputs();
  const drifted = clone(catalog);
  drifted.adapters[0].provider.maximum_response_bytes = 65535;

  assert.throws(() => validateCreateAdapterCatalog(drifted, context), /catalog digest/i);
});
