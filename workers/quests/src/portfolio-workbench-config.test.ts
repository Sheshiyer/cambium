import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const questsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Labs Portfolio Workbench resolves Plexus through its direct Worker origin', async () => {
  const config = await readFile(path.join(questsDir, 'wrangler.labs.jsonc'), 'utf8');

  assert.match(
    config,
    /"PLEXUS_WHOAMI_URL": "https:\/\/teamforge-api\.thoughtseedlabs\.workers\.dev\/v1\/whoami"/,
  );
  assert.doesNotMatch(
    config,
    /"PLEXUS_WHOAMI_URL": "https:\/\/plexus-api\.thoughtseed\.space\/v1\/whoami"/,
    'the protected custom hostname intercepts the forwarded cross-app Access JWT before Plexus can validate it',
  );
});

test('Labs native Mac profile pins the reviewed Curious tenant and exact callback', async () => {
  const { parseJsonc } = await import('../../../scripts/quests-wrangler-profile.mjs');
  const config = parseJsonc(await readFile(path.join(questsDir, 'wrangler.labs.jsonc'), 'utf8')) as {
    vars: Record<string, string>;
    d1_databases: Array<{ binding: string; migrations_dir?: string }>;
  };

  assert.equal(
    config.vars.PLEXUS_NATIVE_IDENTITY_URL,
    'https://teamforge-api.thoughtseedlabs.workers.dev/v1/native/identity',
  );
  assert.equal(config.vars.PLEXUS_NATIVE_IDENTITY_TENANT, 'cambium');
  assert.equal(config.vars.NATIVE_SESSION_OWNER_ORIGIN, 'https://curious.thoughtseed.space');
  assert.deepEqual(JSON.parse(config.vars.NATIVE_SESSION_CLIENTS_JSON), [{
    clientId: 'space.thoughtseed.cambium.native.dev',
    redirectUri: 'space.thoughtseed.cambium.native.dev://oauth/callback',
  }]);
  assert.equal('PLEXUS_NATIVE_IDENTITY_TOKEN' in config.vars, false);
  assert.equal(config.d1_databases.find((entry) => entry.binding === 'BRIDGE_DB')?.migrations_dir, 'migrations');
});
