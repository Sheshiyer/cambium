import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolveQuestsWranglerProfile } from './quests-wrangler-profile.mjs';

const mapUrl = new URL(
  '../docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json',
  import.meta.url,
);

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
}

test('resource map matches both validated Wrangler profile receipts', () => {
  const map = JSON.parse(fs.readFileSync(mapUrl, 'utf8'));
  const labs = resolveQuestsWranglerProfile({
    profile: 'labs-production',
    operation: 'read',
  });
  const legacy = resolveQuestsWranglerProfile({
    profile: 'legacy-source',
    operation: 'read',
  });

  assert.equal(map.schema, 'cambium.cloudflare-resource-map.v1');
  assert.equal(map.production.profile, labs.wranglerProfile);
  assert.equal(map.production.config, labs.config);
  assert.equal(map.production.account_id, labs.accountId);
  assert.equal(map.production.worker.name, labs.workerName);
  assert.equal(map.production.worker.custom_domain, labs.route);
  assert.equal(map.production.d1.BRIDGE_DB.id, labs.d1DatabaseId);
  assert.equal(map.production.kv.QUESTS.id, labs.questsKvId);
  assert.equal(map.production.kv.SECRETS.id, labs.secretsKvId);

  assert.equal(map.legacy_source.profile, legacy.wranglerProfile);
  assert.equal(map.legacy_source.config, legacy.config);
  assert.equal(map.legacy_source.account_id, legacy.accountId);
  assert.equal(map.legacy_source.mode, legacy.sourceMode);
  assert.equal(map.legacy_source.d1.BRIDGE_DB.id, legacy.d1DatabaseId);
  assert.equal(map.legacy_source.kv.QUESTS.id, legacy.questsKvId);
  assert.deepEqual(map.legacy_source.allowed_operations, ['read']);
});

test('resource map contains strategies for every Cloudflare primitive without mutable counts or secrets', () => {
  const map = JSON.parse(fs.readFileSync(mapUrl, 'utf8'));

  assert.deepEqual(
    Object.keys(map.production).sort(),
    ['access', 'account_id', 'config', 'd1', 'kv', 'profile', 'r2', 'vectorize', 'worker'].sort(),
  );
  assert.equal(map.production.r2.THOUGHTSEED_VAULT.strategy, 'per-key-reconcile');
  assert.equal(map.production.r2.CONTEXT_PROJECTIONS.strategy, 'per-key-reconcile');
  assert.equal(map.production.vectorize.CAMBIUM_CORTEX.strategy, 'rebuild-from-provenance');
  assert.equal(map.production.d1.BRIDGE_DB.strategy, 'preserve-target-authority');
  assert.equal(map.production.kv.SECRETS.strategy, 'target-only-never-copy-values');

  const keys = collectKeys(map);
  for (const forbidden of ['object_count', 'bucket_size', 'secret', 'token', 'credential']) {
    assert.equal(
      keys.some((key) => key.toLowerCase() === forbidden),
      false,
      `forbidden mutable or sensitive key: ${forbidden}`,
    );
  }
});
