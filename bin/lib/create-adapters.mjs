import { canonicalDigest } from './lead-contracts.mjs';
import { validateSpendPolicy } from './spend-policy.mjs';

export const CREATE_ADAPTER_CATALOG_ID = 'create-adapters@1.0.0';
export const CREATE_ADAPTER_ID = 'founder-article-nvidia@1.0.0';
export const CREATE_ADAPTER_SECRET_BINDING = 'NVIDIA_MARKETING_CREATE_API_KEY';

const VERSIONED_ID = /^[a-z][a-z0-9_-]*@\d+\.\d+\.\d+$/;
const DIGEST = /^[a-f0-9]{64}$/;
const FORBIDDEN_CALLER_FIELDS = new Set([
  'tenant',
  'tenant_id',
  'provider',
  'model',
  'url',
  'endpoint',
  'prompt',
  'messages',
  'credential',
  'credentials',
  'secret',
  'api_key',
  'apiKey',
  'token',
  'temperature',
  'maxTokens',
]);
const TOP_LEVEL_INPUT_FIELDS = Object.freeze([
  'requestId',
  'idempotencyKey',
  'actorId',
  'budgetReservationId',
  'expiresAt',
  'brief',
]);
const BRIEF_FIELDS = Object.freeze([
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
const FACT_FIELDS = Object.freeze(['claimId', 'text', 'sourceDigest']);

function fail(message, path = '') {
  throw new Error(`create adapter validation: ${message}${path ? ` at ${path}` : ''}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function object(value, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, keys, label) {
  object(value, label);
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (extras.length) fail(`${label} contains unknown fields: ${extras.join(', ')}`);
  if (missing.length) fail(`${label} is missing required fields: ${missing.join(', ')}`);
}

function exactMembers(actual, expected, label) {
  if (!Array.isArray(actual)
      || actual.length !== expected.length
      || new Set(actual).size !== actual.length
      || expected.some((value) => !actual.includes(value))) {
    fail(`${label} must contain exactly: ${expected.join(', ')}`);
  }
}

function safeLocalPath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    fail(`${label} must be a non-empty local path`);
  }
  if (value.startsWith('/') || value.startsWith('~') || value.includes('\\')) {
    fail(`${label} must be a portable local path`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`${label} must not escape its local composition root`);
  }
}

function assertNoInlineSecretValues(value) {
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      const childPath = `${path}.${key}`;
      const secretContainer = /(?:^|\.)(?:secret|credential|credentials)(?:\.|$)/i.test(childPath);
      if (secretContainer
          && /^(?:value|literal|api_?key|token|password|private_?key|credential)$/i.test(key)) {
        fail('inline secret values are forbidden; store only a Worker binding descriptor', childPath);
      }
      if (typeof child === 'string' && /^(?:Bearer\s+|sk-|nvapi-)/i.test(child)) {
        fail('inline secret-like values are forbidden', childPath);
      }
      visit(child, childPath);
    }
  };
  visit(value, '$');
}

function validateReference(reference, expected, label) {
  exactKeys(reference, Object.keys(expected), label);
  for (const [key, value] of Object.entries(expected)) {
    if (key === 'contract_ids') {
      exactMembers(reference.contract_ids, value, `${label}.contract_ids`);
    } else if (reference[key] !== value) {
      fail(`${label}.${key} must remain ${String(value)}`);
    }
  }
  safeLocalPath(reference.path, `${label}.path`);
}

function validateStringSchema(schema, label, { max = 4096 } = {}) {
  const keys = ['type', 'minLength', 'maxLength'];
  if (Object.hasOwn(schema, 'pattern')) keys.push('pattern');
  exactKeys(schema, keys, label);
  if (schema.type !== 'string'
      || !Number.isInteger(schema.minLength)
      || !Number.isInteger(schema.maxLength)
      || schema.minLength < 0
      || schema.maxLength < Math.max(1, schema.minLength)
      || schema.maxLength > max) {
    fail(`${label} must be a bounded string schema`);
  }
  if (Object.hasOwn(schema, 'pattern') && (typeof schema.pattern !== 'string' || schema.pattern.length > 256)) {
    fail(`${label}.pattern must be a bounded string`);
  }
}

function validateObjectSchema(schema, expectedFields, label) {
  exactKeys(schema, ['type', 'additionalProperties', 'required', 'properties'], label);
  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    fail(`${label} must be a closed object schema`);
  }
  exactMembers(schema.required, expectedFields, `${label}.required`);
  exactKeys(schema.properties, expectedFields, `${label}.properties`);
}

function assertCallerRoutingAbsent(schema) {
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isObject(node)) return;
    if (isObject(node.properties)) {
      for (const key of Object.keys(node.properties)) {
        if (FORBIDDEN_CALLER_FIELDS.has(key)) {
          fail(`caller-owned routing field ${key} is forbidden`, `${path}.properties.${key}`);
        }
      }
    }
    for (const [key, child] of Object.entries(node)) visit(child, `${path}.${key}`);
  };
  visit(schema, 'input.schema');
}

function validateInput(input, marketingContractIds) {
  exactKeys(input, ['source_contract_id', 'schema'], 'adapter.input');
  if (!marketingContractIds.includes(input.source_contract_id)) {
    fail(`unknown marketing contract ${input.source_contract_id}`);
  }
  if (input.source_contract_id !== 'asset_brief@1.0.0') {
    fail('adapter input source must remain asset_brief@1.0.0');
  }
  assertCallerRoutingAbsent(input.schema);
  validateObjectSchema(input.schema, TOP_LEVEL_INPUT_FIELDS, 'adapter.input.schema');
  for (const field of TOP_LEVEL_INPUT_FIELDS.filter((field) => field !== 'brief')) {
    validateStringSchema(input.schema.properties[field], `adapter.input.schema.properties.${field}`, {
      max: field === 'expiresAt' ? 35 : 128,
    });
  }
  const brief = input.schema.properties.brief;
  validateObjectSchema(brief, BRIEF_FIELDS, 'adapter.input.schema.properties.brief');
  for (const field of BRIEF_FIELDS.filter((field) => field !== 'facts')) {
    const max = field === 'objective'
      ? 512
      : field === 'audience' || field === 'callToAction'
        ? 256
        : 128;
    validateStringSchema(brief.properties[field], `adapter.input.schema.properties.brief.properties.${field}`, { max });
  }
  const facts = brief.properties.facts;
  exactKeys(facts, ['type', 'minItems', 'maxItems', 'uniqueItems', 'items'], 'adapter.input.schema.properties.brief.properties.facts');
  if (facts.type !== 'array'
      || !Number.isInteger(facts.minItems)
      || !Number.isInteger(facts.maxItems)
      || facts.minItems !== 1
      || facts.maxItems !== 16
      || facts.uniqueItems !== true) {
    fail('facts must be a unique bounded array containing one to sixteen items');
  }
  validateObjectSchema(facts.items, FACT_FIELDS, 'adapter.input.schema.properties.brief.properties.facts.items');
  for (const field of FACT_FIELDS) {
    const max = field === 'text' ? 1000 : 128;
    validateStringSchema(
      facts.items.properties[field],
      `adapter.input.schema.properties.brief.properties.facts.items.properties.${field}`,
      { max },
    );
  }
  for (const digestField of ['productPacketDigest', 'evidenceSnapshotDigest', 'seedDigest']) {
    const digestSchema = brief.properties[digestField];
    if (digestSchema.minLength !== 64
        || digestSchema.maxLength !== 64
        || digestSchema.pattern !== '^[a-f0-9]{64}$') {
      fail(`${digestField} must remain a lowercase SHA-256 schema`);
    }
  }
  const sourceDigest = facts.items.properties.sourceDigest;
  if (sourceDigest.minLength !== 64
      || sourceDigest.maxLength !== 64
      || sourceDigest.pattern !== '^[a-f0-9]{64}$') {
    fail('sourceDigest must remain a lowercase SHA-256 schema');
  }
}

function validateAdapter(adapter, context) {
  exactKeys(adapter, [
    'id',
    'stage',
    'tenant_id',
    'recipe_id',
    'activation',
    'provider',
    'secret',
    'prompt_template',
    'spend',
    'input',
    'approval',
    'outputs',
  ], 'adapter');
  if (adapter.id !== CREATE_ADAPTER_ID) fail(`adapter id must remain ${CREATE_ADAPTER_ID}`);
  if (adapter.stage !== 'create') fail('adapter stage must remain create');
  if (adapter.tenant_id !== 'thoughtseed') fail('adapter tenant must remain fixed to thoughtseed');
  if (!context.recipeIds.includes(adapter.recipe_id)) fail(`unknown recipe ${String(adapter.recipe_id)}`);
  if (adapter.recipe_id !== 'founder-article-draft@1.0.0') {
    fail('adapter recipe must remain founder-article-draft@1.0.0');
  }

  exactKeys(adapter.activation, ['state', 'value_derivation'], 'adapter.activation');
  if (adapter.activation.state !== 'registered_disabled') {
    fail('adapter activation must remain registered_disabled');
  }
  if (adapter.activation.value_derivation !== '<adapter_id>:<catalog_digest>') {
    fail('adapter activation must derive the exact adapter-plus-catalog digest value');
  }

  exactKeys(adapter.provider, [
    'id',
    'url',
    'method',
    'model',
    'parameters',
    'timeout_ms',
    'maximum_response_bytes',
    'network_attempts',
  ], 'adapter.provider');
  if (adapter.provider.id !== 'nvidia') fail('adapter provider must remain nvidia');
  if (adapter.provider.url !== 'https://integrate.api.nvidia.com/v1/chat/completions') {
    fail('adapter provider URL drifted');
  }
  if (adapter.provider.method !== 'POST') fail('adapter provider method must remain POST');
  if (adapter.provider.model !== 'meta/llama-3.1-70b-instruct') fail('adapter model drifted');
  exactKeys(adapter.provider.parameters, ['stream', 'temperature', 'max_tokens'], 'adapter.provider.parameters');
  if (adapter.provider.parameters.stream !== false
      || adapter.provider.parameters.temperature !== 0.2
      || adapter.provider.parameters.max_tokens !== 1800) {
    fail('adapter provider parameters drifted');
  }
  if (adapter.provider.timeout_ms !== 30000) fail('adapter timeout must remain 30000ms');
  if (adapter.provider.maximum_response_bytes !== 65536) fail('adapter response bound must remain 65536 bytes');
  if (adapter.provider.network_attempts !== 1) fail('adapter network attempts must remain one');

  exactKeys(adapter.secret, ['binding', 'storage', 'exclusivity', 'exposure'], 'adapter.secret');
  if (adapter.secret.binding !== CREATE_ADAPTER_SECRET_BINDING
      || adapter.secret.storage !== 'cloudflare_worker_secret'
      || adapter.secret.exclusivity !== 'this_adapter_only'
      || adapter.secret.exposure !== 'authorization_bearer_header_only') {
    fail(`exclusive secret binding must remain ${CREATE_ADAPTER_SECRET_BINDING} in Worker-only storage`);
  }

  exactKeys(adapter.prompt_template, ['id', 'sha256'], 'adapter.prompt_template');
  if (adapter.prompt_template.id !== 'thoughtseed-founder-article@1.0.0'
      || adapter.prompt_template.sha256 !== 'd1d1db81ae9b1eaeb9ba3f799a9a7fdeb61e87bc2805fdab4b29761274963a80') {
    fail('prompt template identity or digest drifted');
  }

  const spend = validateSpendPolicy(adapter);
  if (!spend.ok || canonicalDigest(spend.policy) !== canonicalDigest({ tier: 'gated' })) {
    fail('adapter spend must remain gated');
  }

  validateInput(adapter.input, context.marketingContractIds);

  exactKeys(adapter.approval, ['required', 'contract_id', 'authority_owner', 'decision_scope'], 'adapter.approval');
  if (!context.authorityContractIds.includes(adapter.approval.contract_id)) {
    fail(`unknown authority contract ${String(adapter.approval.contract_id)}`);
  }
  if (adapter.approval.required !== true
      || adapter.approval.contract_id !== 'approval_decision@1.0.0'
      || adapter.approval.authority_owner !== 'cambium'
      || adapter.approval.decision_scope !== 'exact_action_digest') {
    fail('adapter approval must remain Cambium-owned and exact-action-digest bound');
  }

  exactKeys(adapter.outputs, ['contract_ids', 'execution_mode', 'server_owned'], 'adapter.outputs');
  if (!Array.isArray(adapter.outputs.contract_ids)) fail('adapter.outputs.contract_ids must be an array');
  for (const contractId of adapter.outputs.contract_ids) {
    const known = context.marketingContractIds.includes(contractId)
      || context.authorityContractIds.includes(contractId);
    if (!known) fail(`unknown output contract ${contractId}`);
  }
  exactMembers(adapter.outputs.contract_ids, ['asset_draft@1.0.0', 'operator_receipt@1.0.0'], 'adapter.outputs.contract_ids');
  exactKeys(adapter.outputs.server_owned, [
    'adapterId',
    'artifactDigest',
    'publishEligible',
    'externalAction',
  ], 'adapter.outputs.server_owned');
  if (adapter.outputs.execution_mode !== 'review_only'
      || adapter.outputs.server_owned.adapterId !== CREATE_ADAPTER_ID
      || adapter.outputs.server_owned.artifactDigest !== 'worker_computed_sha256'
      || adapter.outputs.server_owned.publishEligible !== false
      || adapter.outputs.server_owned.externalAction !== 'none') {
    fail('adapter outputs must remain review-only without external action or publication authority');
  }
}

/**
 * Validate the one canonical fixed-tenant create adapter. This is a pure
 * registration check: it grants no provider, deployment, or publication authority.
 */
export function validateCreateAdapterCatalog(catalog, {
  recipeIds = [],
  marketingContractIds = [],
  authorityContractIds = [],
} = {}) {
  object(catalog, 'catalog');
  assertNoInlineSecretValues(catalog);
  exactKeys(catalog, [
    'catalog_id',
    'version',
    'authority',
    'references',
    'adapters',
    'catalog_digest',
  ], 'catalog');
  if (catalog.catalog_id !== CREATE_ADAPTER_CATALOG_ID
      || catalog.version !== '1.0.0'
      || catalog.authority !== 'cambium') {
    fail('catalog identity must remain create-adapters@1.0.0 under Cambium authority');
  }
  if (typeof catalog.catalog_digest !== 'string' || !DIGEST.test(catalog.catalog_digest)) {
    fail('catalog_digest must be a lowercase SHA-256 digest');
  }
  const unsigned = structuredClone(catalog);
  delete unsigned.catalog_digest;
  const computedDigest = canonicalDigest(unsigned);
  if (computedDigest !== catalog.catalog_digest) {
    fail('catalog digest does not match canonical JSON excluding catalog_digest');
  }

  exactKeys(catalog.references, [
    'marketing_capabilities',
    'marketing_assets',
    'authority_contracts',
  ], 'catalog.references');
  validateReference(catalog.references.marketing_capabilities, {
    id: 'marketing-capabilities',
    version: '1.0.0',
    path: 'composition/marketing-capabilities.v1.json',
  }, 'catalog.references.marketing_capabilities');
  validateReference(catalog.references.marketing_assets, {
    id: 'marketing-assets',
    version: '1.0.0',
    path: 'composition/contracts/marketing-assets.v1.json',
  }, 'catalog.references.marketing_assets');
  validateReference(catalog.references.authority_contracts, {
    id: 'lead-ecosystem',
    version: '1.0.0',
    path: 'composition/contracts/lead-ecosystem.v1.json',
    contract_ids: ['approval_decision@1.0.0', 'operator_receipt@1.0.0'],
  }, 'catalog.references.authority_contracts');

  for (const [label, values] of [
    ['recipeIds', recipeIds],
    ['marketingContractIds', marketingContractIds],
    ['authorityContractIds', authorityContractIds],
  ]) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !VERSIONED_ID.test(value))) {
      fail(`${label} must be a list of validated versioned IDs`);
    }
  }

  if (!Array.isArray(catalog.adapters) || catalog.adapters.length !== 1) {
    fail('catalog must contain exactly one adapter');
  }
  validateAdapter(catalog.adapters[0], { recipeIds, marketingContractIds, authorityContractIds });

  return {
    valid: true,
    catalog_id: catalog.catalog_id,
    catalog_digest: catalog.catalog_digest,
    adapter_ids: [catalog.adapters[0].id],
    activation_value: `${catalog.adapters[0].id}:${catalog.catalog_digest}`,
  };
}
