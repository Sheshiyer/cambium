import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  parseJsonc,
  resolveQuestsWranglerProfile,
} from './quests-wrangler-profile.mjs';

const cliUrl = new URL('./quests-wrangler-profile.mjs', import.meta.url);

test('JSONC parsing preserves URL strings while removing line comments', () => {
  const parsed = parseJsonc(`{
    // profile comment
    "url": "https://example.invalid/path//still-a-string",
    "enabled": true // trailing comment
  }`);

  assert.deepEqual(parsed, {
    url: 'https://example.invalid/path//still-a-string',
    enabled: true,
  });
});

test('Labs production resolves a validated deploy-capable binding set', () => {
  const resolved = resolveQuestsWranglerProfile({
    profile: 'labs-production',
    operation: 'deploy',
  });

  assert.deepEqual(resolved, {
    profile: 'labs-production',
    wranglerProfile: 'thoughtseed-labs',
    config: 'workers/quests/wrangler.labs.jsonc',
    accountId: '9d7cec1b5a32b2df8c6cdc1321ccd00b',
    workerName: 'cambium-quests',
    route: 'curious.thoughtseed.space',
    d1DatabaseId: 'c0aba88a-5c83-4481-b625-50356d8c98e8',
    questsKvId: '439547e617d9455fb752bfd651da9765',
    secretsKvId: '3ab0824953064453b8a1995a0b4da05e',
    sourceMode: 'production-authority',
    allowedOperations: ['read', 'write', 'deploy'],
  });
});

test('legacy source resolves only for read-only inventory', () => {
  const resolved = resolveQuestsWranglerProfile({
    profile: 'legacy-source',
    operation: 'read',
  });

  assert.deepEqual(resolved, {
    profile: 'legacy-source',
    wranglerProfile: '9d9d',
    config: 'workers/quests/wrangler.jsonc',
    accountId: '9d9d23b27f32e70ae3afb6a1aa2c0f10',
    workerName: 'cambium-quests',
    route: null,
    d1DatabaseId: 'f6b950ac-2480-4a7d-9dac-1ff7e951d936',
    questsKvId: '10aaa6e0a8a545c1afb5ceee7ef61c14',
    secretsKvId: null,
    sourceMode: 'read-only-rollback',
    allowedOperations: ['read'],
  });
});

for (const operation of ['write', 'deploy']) {
  test(`legacy source rejects ${operation} before command construction`, () => {
    assert.throws(
      () => resolveQuestsWranglerProfile({ profile: 'legacy-source', operation }),
      new RegExp(`legacy_source_forbids_${operation}`),
    );
  });
}

test('unknown and incomplete requests fail closed', () => {
  assert.throws(
    () => resolveQuestsWranglerProfile({ profile: 'unknown', operation: 'read' }),
    /unknown_profile/,
  );
  assert.throws(
    () => resolveQuestsWranglerProfile({ profile: 'labs-production' }),
    /unknown_operation/,
  );
});

test('CLI emits one machine-readable receipt and fails closed for legacy deploy', () => {
  const accepted = spawnSync(process.execPath, [
    cliUrl.pathname,
    '--profile', 'labs-production',
    '--operation', 'deploy',
  ], { encoding: 'utf8' });

  assert.equal(accepted.status, 0, accepted.stderr);
  assert.deepEqual(JSON.parse(accepted.stdout), {
    schema: 'cambium.quests-wrangler-profile.v1',
    status: 'accepted',
    profile: 'labs-production',
    operation: 'deploy',
    wranglerProfile: 'thoughtseed-labs',
    config: 'workers/quests/wrangler.labs.jsonc',
    accountId: '9d7cec1b5a32b2df8c6cdc1321ccd00b',
    workerName: 'cambium-quests',
    route: 'curious.thoughtseed.space',
    d1DatabaseId: 'c0aba88a-5c83-4481-b625-50356d8c98e8',
    questsKvId: '439547e617d9455fb752bfd651da9765',
    secretsKvId: '3ab0824953064453b8a1995a0b4da05e',
    sourceMode: 'production-authority',
    allowedOperations: ['read', 'write', 'deploy'],
  });

  const rejected = spawnSync(process.execPath, [
    cliUrl.pathname,
    '--profile', 'legacy-source',
    '--operation', 'deploy',
  ], { encoding: 'utf8' });

  assert.equal(rejected.status, 1, rejected.stdout);
  assert.equal(rejected.stdout, '');
  assert.match(rejected.stderr, /legacy_source_forbids_deploy/);
});
