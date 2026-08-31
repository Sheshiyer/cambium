#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PROFILE_CONTRACTS = Object.freeze({
  'labs-production': Object.freeze({
    wranglerProfile: 'thoughtseed-labs',
    config: 'workers/quests/wrangler.labs.jsonc',
    accountId: '9d7cec1b5a32b2df8c6cdc1321ccd00b',
    configAccountId: '9d7cec1b5a32b2df8c6cdc1321ccd00b',
    workerName: 'cambium-quests',
    route: 'curious.thoughtseed.space',
    accessTeamDomain: 'thoughtseedlabs.cloudflareaccess.com',
    accessAudienceIds: Object.freeze([
      'dd832e556cd9ee7c4e2fb9fddc6bb16bccd64d1b28b0784f84884a69f8a2f3d9',
      '38b502a01f4063c5521191e084c7fd9b086099c0061b045145cd93165b9af8d0',
      '29e1c8a6760778891fe1278ea0c8639afba1eb41a0008a7fd14850e4168911b5',
      '481fc6643a62b3a4f58778e61b21f571b7039e6357c6e481a4949101f27776fe',
    ]),
    d1DatabaseId: 'c0aba88a-5c83-4481-b625-50356d8c98e8',
    questsKvId: '439547e617d9455fb752bfd651da9765',
    secretsKvId: '3ab0824953064453b8a1995a0b4da05e',
    sourceMode: 'production-authority',
    allowedOperations: Object.freeze(['read', 'write', 'deploy']),
  }),
  'legacy-source': Object.freeze({
    wranglerProfile: '9d9d',
    config: 'workers/quests/wrangler.jsonc',
    accountId: '9d9d23b27f32e70ae3afb6a1aa2c0f10',
    configAccountId: null,
    workerName: 'cambium-quests',
    route: null,
    accessTeamDomain: 'red-queen-4dfa.cloudflareaccess.com',
    accessAudienceIds: Object.freeze([
      '027d9959d1bab2ffb291b294b2cf49427fe63608a44c228fd05c3c7731ee60d7',
      '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200',
      'd3892b5d2a62027029b09b2fd015a9e8074d5efb38c443099f803517cb3feb51',
    ]),
    d1DatabaseId: 'f6b950ac-2480-4a7d-9dac-1ff7e951d936',
    questsKvId: '10aaa6e0a8a545c1afb5ceee7ef61c14',
    secretsKvId: null,
    sourceMode: 'read-only-rollback',
    allowedOperations: Object.freeze(['read']),
  }),
});

const OPERATIONS = new Set(['read', 'write', 'deploy']);
const EXPECTED_R2 = new Map([
  ['THOUGHTSEED_VAULT', 'thoughtseed-vault'],
  ['CONTEXT_PROJECTIONS', 'thoughtseed-context-projections'],
]);
const EXPECTED_VECTORIZE = new Map([
  ['CAMBIUM_CORTEX', 'cambium-cortex'],
]);

export function parseJsonc(source) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (inString) {
      output += current;
      if (escaped) {
        escaped = false;
      } else if (current === '\\') {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }

    if (current === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }

    if (current === '/' && next === '*') {
      index += 2;
      while (
        index < source.length
        && !(source[index] === '*' && source[index + 1] === '/')
      ) {
        if (source[index] === '\n') output += '\n';
        index += 1;
      }
      if (index >= source.length) throw new Error('unterminated_jsonc_comment');
      index += 1;
      continue;
    }

    output += current;
  }

  return JSON.parse(output);
}

function bindingValue(bindings, binding, valueField) {
  return bindings?.find((candidate) => candidate.binding === binding)?.[valueField] ?? null;
}

function assertEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(code);
}

function assertArrayEqual(actual, expected, code) {
  if (
    actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(code);
  }
}

function assertNamedBindings(actualBindings, expectedBindings, valueField, codePrefix) {
  for (const [binding, expected] of expectedBindings) {
    assertEqual(
      bindingValue(actualBindings, binding, valueField),
      expected,
      `${codePrefix}_${binding.toLowerCase()}`,
    );
  }
}

function validateConfig(contract) {
  const absoluteConfig = path.join(REPOSITORY_ROOT, contract.config);
  const config = parseJsonc(fs.readFileSync(absoluteConfig, 'utf8'));

  assertEqual(config.name, contract.workerName, 'unexpected_worker_name');
  assertEqual(config.account_id ?? null, contract.configAccountId, 'unexpected_account_id');
  assertEqual(
    config.routes?.find((route) => route.custom_domain === true)?.pattern ?? null,
    contract.route,
    'unexpected_custom_domain',
  );
  assertEqual(
    config.vars?.TF_ACCESS_TEAM_DOMAIN ?? null,
    contract.accessTeamDomain,
    'unexpected_access_team_domain',
  );
  assertArrayEqual(
    (config.vars?.TF_ACCESS_AUD ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    contract.accessAudienceIds,
    'unexpected_access_audiences',
  );
  assertEqual(
    bindingValue(config.d1_databases, 'BRIDGE_DB', 'database_id'),
    contract.d1DatabaseId,
    'unexpected_bridge_db',
  );
  assertEqual(
    bindingValue(config.kv_namespaces, 'QUESTS', 'id'),
    contract.questsKvId,
    'unexpected_quests_kv',
  );
  assertEqual(
    bindingValue(config.kv_namespaces, 'SECRETS', 'id'),
    contract.secretsKvId,
    'unexpected_secrets_kv',
  );
  assertNamedBindings(config.r2_buckets, EXPECTED_R2, 'bucket_name', 'unexpected_r2');
  assertNamedBindings(config.vectorize, EXPECTED_VECTORIZE, 'index_name', 'unexpected_vectorize');
}

export function resolveQuestsWranglerProfile({ profile, operation } = {}) {
  if (!OPERATIONS.has(operation)) throw new Error('unknown_operation');

  const contract = PROFILE_CONTRACTS[profile];
  if (!contract) throw new Error('unknown_profile');
  if (!contract.allowedOperations.includes(operation)) {
    throw new Error(`legacy_source_forbids_${operation}`);
  }

  validateConfig(contract);

  return {
    profile,
    wranglerProfile: contract.wranglerProfile,
    config: contract.config,
    accountId: contract.accountId,
    workerName: contract.workerName,
    route: contract.route,
    accessTeamDomain: contract.accessTeamDomain,
    accessAudienceIds: [...contract.accessAudienceIds],
    d1DatabaseId: contract.d1DatabaseId,
    questsKvId: contract.questsKvId,
    secretsKvId: contract.secretsKvId,
    sourceMode: contract.sourceMode,
    allowedOperations: [...contract.allowedOperations],
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!['--profile', '--operation'].includes(flag) || index + 1 >= argv.length) {
      throw new Error('usage');
    }
    values[flag.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

function main() {
  try {
    const { profile, operation } = parseArgs(process.argv.slice(2));
    const resolved = resolveQuestsWranglerProfile({ profile, operation });
    process.stdout.write(`${JSON.stringify({
      schema: 'cambium.quests-wrangler-profile.v1',
      status: 'accepted',
      ...resolved,
      operation,
    })}\n`);
  } catch (error) {
    process.stderr.write(`status=blocked reason=${error.message}\n`);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
