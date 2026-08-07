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
