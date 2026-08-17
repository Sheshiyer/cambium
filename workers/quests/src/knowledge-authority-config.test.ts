import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Labs config keeps GitHub knowledge authority and excludes retired R2 projections', async () => {
  const config = await readFile(new URL('../wrangler.labs.jsonc', import.meta.url), 'utf8');

  assert.match(
    config,
    /"PLEXUS_KNOWLEDGE_URL"\s*:\s*"https:\/\/teamforge-api\.thoughtseedlabs\.workers\.dev\/v1\/github\/knowledge\/routine-snapshot"/,
  );
  assert.doesNotMatch(config, /"binding"\s*:\s*"CONTEXT_PROJECTIONS"/);
});
