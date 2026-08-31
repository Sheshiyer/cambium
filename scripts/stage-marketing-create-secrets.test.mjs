import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const scriptUrl = new URL('stage-marketing-create-secrets.sh', import.meta.url);
const scriptPath = decodeURIComponent(scriptUrl.pathname);

test('legacy secret staging refuses every non-read-only invocation before Wrangler', () => {
  const result = spawnSync('/bin/bash', [scriptPath], {
    encoding: 'utf8',
    env: { HOME: '/tmp', PATH: '/usr/bin:/bin' },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /legacy_source_read_only/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /required command not found|trusted interactive TTY/);
});

test('marketing-create secret staging helper is fail-closed and non-deploying', () => {
  const script = fs.readFileSync(scriptUrl, 'utf8');

  assert.match(script, /^#!\/usr\/bin\/env bash\nset -euo pipefail/m);
  assert.match(script, /\[\[ -t 0 \]\]/);
  assert.match(script, /--check-only/);
  assert.match(script, /4\.95\.0/);

  assert.match(script, /9e6885ce-ea25-4158-ba71-69b8bdfc256b/);
  assert.match(script, /d24335443e95d0755168cc685db4b023947625f867180f6923dc56bd1517a546/);
  assert.match(script, /45442b5b6aafee3e88f22823d5caa5ef931a0c01eb9dc0c83ab2d0adbe20f8fd/);
  assert.match(script, /75471627720f10533316bd56c436293f16750d82cde1096afdc035072475363e/);
  assert.match(script, /founder-article-nvidia@1\.0\.0:ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f/);
  assert.match(script, /CANDIDATE_VERSION_NUMBER=60/);
  assert.match(script, /PROVIDER_VERSION_NUMBER=61/);
  assert.match(script, /ACTIVATION_VERSION_NUMBER=62/);

  assert.match(script, /sort_by\(\.number\)/);
  assert.match(script, /sort_by\(\.name, \.type\)/);
  assert.match(script, /versions secret put/);
  const secretPutInvocations = script
    .split('\n')
    .filter((line) => line.includes('secret put'));
  assert.equal(secretPutInvocations.length, 1);
  assert.match(secretPutInvocations[0], /versions secret put/);
  assert.match(script, /--dry-run/);
  assert.doesNotMatch(script, /curl|\/api\/marketing/);
  assert.doesNotMatch(script, /read\s+(?:-[^\n]*\s+)*[^\n]*(?:API_KEY|ACTIVATION)/);

  const deployInvocations = script
    .split('\n')
    .filter((line) => line.includes('versions deploy'));
  assert.equal(deployInvocations.length, 1);
  assert.match(deployInvocations[0], /--dry-run/);
});

test('marketing-create secret staging helper parses staged UUIDs from put stdout', () => {
  const script = fs.readFileSync(scriptUrl, 'utf8');

  assert.match(script, /put_stdout/);
  assert.match(script, /Created version/);
  assert.match(script, /script -q "\$put_stdout"/);
  assert.doesNotMatch(script, /\|\s*tee\s+"\$put_stdout"/);
  assert.match(script, /parse_put_uuid/);
  assert.match(script, /assert_latest_version/);
  assert.match(script, /assert_production_candidate/);
  assert.match(script, /write_redacted_state/);
  assert.match(script, /both-secrets-staged-awaiting-explicit-deploy/);
  assert.match(script, /secretValuesPresentInReceipt/);
});
