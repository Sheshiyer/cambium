import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptUrl = new URL('prove-marketing-create-prepare.sh', import.meta.url);
const scriptPath = decodeURIComponent(scriptUrl.pathname);

test('prepare proof helper is statically bounded to the reviewed route and state', () => {
  const script = fs.readFileSync(scriptUrl, 'utf8');

  assert.match(script, /set \+x/);
  assert.match(script, /WRANGLER_WRITE_LOGS=false/);
  assert.match(script, /curl --config -/);
  assert.match(script, /both-secrets-staged-awaiting-explicit-deploy/);
  assert.match(script, /ACTIVATION_VERSION_NUMBER=62/);
  assert.match(script, /activation_version_not_exactly_100_percent/);
  assert.match(script, /founder-article-nvidia@1\.0\.0/);
  assert.match(script, /awaiting_human_approval/);
  assert.match(script, /duplicate == false/);
  assert.match(script, /duplicate == true/);
  assert.match(script, /approval_rows == 0/);
  assert.match(script, /unclaimed_rows == 1/);
  assert.match(script, /null_invocation_rows == 1/);
  assert.match(script, /null_artifact_rows == 1/);
  assert.match(script, /null_provider_rows == 1/);
  assert.match(script, /null_terminal_rows == 1/);
  assert.doesNotMatch(script, /integrate\.api\.nvidia\.com/);
  assert.doesNotMatch(script, /\/v1\/bridge\/marketing-renders\/[^'"$]+\/execute/);
});

test('prepare proof check-only gate runs without a credential or mutation', () => {
  const result = spawnSync(scriptPath, ['--check-only'], {
    encoding: 'utf8',
    env: { ...process.env, BRIDGE_TOKEN: '' },
  });

  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    checkOnly: true,
    status: 'passed',
    wranglerStatus: 'pinned_4.95.0',
    counts: { dependencies: 13, forbiddenRouteCalls: 0 },
  });
});
