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
    accessTeamDomain: 'thoughtseedlabs.cloudflareaccess.com',
    accessAudienceIds: [
      'dd832e556cd9ee7c4e2fb9fddc6bb16bccd64d1b28b0784f84884a69f8a2f3d9',
      '38b502a01f4063c5521191e084c7fd9b086099c0061b045145cd93165b9af8d0',
      '29e1c8a6760778891fe1278ea0c8639afba1eb41a0008a7fd14850e4168911b5',
      '481fc6643a62b3a4f58778e61b21f571b7039e6357c6e481a4949101f27776fe',
    ],
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
    accessTeamDomain: 'red-queen-4dfa.cloudflareaccess.com',
    accessAudienceIds: [
      '027d9959d1bab2ffb291b294b2cf49427fe63608a44c228fd05c3c7731ee60d7',
      '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200',
      'd3892b5d2a62027029b09b2fd015a9e8074d5efb38c443099f803517cb3feb51',
    ],
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
    accessTeamDomain: 'thoughtseedlabs.cloudflareaccess.com',
    accessAudienceIds: [
      'dd832e556cd9ee7c4e2fb9fddc6bb16bccd64d1b28b0784f84884a69f8a2f3d9',
      '38b502a01f4063c5521191e084c7fd9b086099c0061b045145cd93165b9af8d0',
      '29e1c8a6760778891fe1278ea0c8639afba1eb41a0008a7fd14850e4168911b5',
      '481fc6643a62b3a4f58778e61b21f571b7039e6357c6e481a4949101f27776fe',
    ],
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
