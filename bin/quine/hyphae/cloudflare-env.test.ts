import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveCloudflareEnv } from './cloudflare-env.ts';

test('resolveCloudflareEnv prefers canonical CLOUDFLARE names', () => {
  const env = {
    CLOUDFLARE_API_TOKEN: 'canonical-token',
    CLOUDFLARE_ACCOUNT_ID: 'canonical-account',
    CF_API_TOKEN: 'alias-token',
    CF_ACCOUNT_ID: 'alias-account',
  };

  const resolved = resolveCloudflareEnv(env, '/tmp/does-not-exist');

  assert.equal(resolved.apiToken, 'canonical-token');
  assert.equal(resolved.accountId, 'canonical-account');
  assert.equal(resolved.source, 'env');
});

test('resolveCloudflareEnv supports temporary CF aliases from shell env', () => {
  const resolved = resolveCloudflareEnv({
    CF_API_TOKEN: 'alias-token',
    CF_ACCOUNT_ID: 'alias-account',
  }, '/tmp/does-not-exist');

  assert.equal(resolved.apiToken, 'alias-token');
  assert.equal(resolved.accountId, 'alias-account');
  assert.equal(resolved.source, 'env-alias');
});

test('resolveCloudflareEnv reads CF aliases from ~/.claude/.env compatible files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cambium-cf-env-'));
  const envPath = join(dir, '.claude', '.env');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(envPath, 'CF_API_TOKEN=\"file-token\"\nCF_ACCOUNT_ID=file-account\n');

  const resolved = resolveCloudflareEnv({}, envPath);

  assert.equal(resolved.apiToken, 'file-token');
  assert.equal(resolved.accountId, 'file-account');
  assert.equal(resolved.source, 'claude-env-alias');
});
