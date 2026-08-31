import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptUrl = new URL('prove-marketing-create-prepare.sh', import.meta.url);
const scriptPath = decodeURIComponent(scriptUrl.pathname);
const deployUrl = new URL('../workers/quests/DEPLOY.md', import.meta.url);

function withFakeWrangler(version = '4.95.0') {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cambium-wrangler-fixture-'));
  const npxPath = path.join(fixtureRoot, 'npx');
  fs.writeFileSync(npxPath, [
    '#!/bin/sh',
    'if test "$#" = 3 && test "$1" = "--no-install" && test "$2" = "wrangler" && test "$3" = "--version"; then',
    `  printf '%s\\n' ${JSON.stringify(version)}`,
    '  exit 0',
    'fi',
    'printf \'unexpected hermetic npx invocation\\n\' >&2',
    'exit 97',
    '',
  ].join('\n'), { mode: 0o700 });
  return {
    env: { ...process.env, PATH: `${fixtureRoot}${path.delimiter}${process.env.PATH ?? ''}` },
    cleanup: () => fs.rmSync(fixtureRoot, { recursive: true, force: true }),
  };
}

function runPrepare(args, env = {}, wranglerVersion = '4.95.0') {
  const fixture = withFakeWrangler(wranglerVersion);
  try {
    return spawnSync(scriptPath, args, {
      encoding: 'utf8',
      env: { ...fixture.env, ...env },
    });
  } finally {
    fixture.cleanup();
  }
}

test('prepare proof helper is statically bounded to the reviewed route and state', () => {
  const script = fs.readFileSync(scriptUrl, 'utf8');

  assert.match(script, /set \+x/);
  assert.match(script, /WRANGLER_WRITE_LOGS=false/);
  assert.match(script, /curl -q --config -/);
  assert.doesNotMatch(script, /curl --config -/);
  assert.match(script, /proxy = ""/);
  assert.doesNotMatch(script, /data-binary =/);
  assert.doesNotMatch(script, /output =/);
  assert.match(script, /--data-binary "@\$request_body" --output "\$response_path"/);
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

test('curl proof transport treats hostile temporary paths only as argv values', () => {
  const curlRoot = fs.mkdtempSync('/tmp/cambium-curl-argv-');
  const hostileDirectory = `${curlRoot}/quote"\nwrite-out = "INJECTED`;
  const requestPath = `${hostileDirectory}/request.json`;
  const responsePath = `${hostileDirectory}/response.json`;
  fs.mkdirSync(hostileDirectory);
  fs.writeFileSync(requestPath, '{}', { mode: 0o600 });
  const curlConfig = [
    'silent',
    'show-error',
    'proto = "=file"',
    'proxy = ""',
    'url = "file:///dev/null"',
    'write-out = "%{http_code}"',
    '',
  ].join('\n');

  try {
    const result = spawnSync('curl', [
      '-q',
      '--config',
      '-',
      '--data-binary',
      `@${requestPath}`,
      '--output',
      responsePath,
    ], {
      encoding: 'utf8',
      input: curlConfig,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '000');
    assert.equal(fs.existsSync(responsePath), true);
  } finally {
    fs.rmSync(curlRoot, { recursive: true, force: true });
  }
});

test('curl proof transport ignores inherited curl startup configuration', () => {
  const curlHome = fs.mkdtempSync('/tmp/cambium-curl-home-');
  const curlConfig = [
    'silent',
    'show-error',
    'proto = "=file"',
    'url = "file:///dev/null"',
    'output = "/dev/null"',
    '',
  ].join('\n');
  fs.writeFileSync(`${curlHome}/.curlrc`, 'write-out = "CURLRC_WAS_LOADED"\n', { mode: 0o600 });
  const env = {
    ...process.env,
    CURL_HOME: curlHome,
    HOME: curlHome,
    XDG_CONFIG_HOME: curlHome,
  };

  try {
    const unsafe = spawnSync('curl', ['--config', '-'], {
      encoding: 'utf8',
      env,
      input: curlConfig,
    });
    assert.equal(unsafe.status, 0, unsafe.stderr);
    assert.match(unsafe.stdout, /CURLRC_WAS_LOADED/);

    const safe = spawnSync('curl', ['-q', '--config', '-'], {
      encoding: 'utf8',
      env,
      input: curlConfig,
    });
    assert.equal(safe.status, 0, safe.stderr);
    assert.doesNotMatch(safe.stdout, /CURLRC_WAS_LOADED/);
  } finally {
    fs.rmSync(curlHome, { recursive: true, force: true });
  }
});

test('activation rollback health probes are endpoint-pinned and curlrc-independent', () => {
  const deploy = fs.readFileSync(deployUrl, 'utf8');
  const rollback = deploy.slice(deploy.indexOf('If Version 62 has already received traffic'));

  assert.match(rollback, /618193599d58486ffa1755971d7edf81bf1b9bb422161db75f472e49e23d4f45/);
  assert.match(rollback, /ba9ff22b02359797877fc53501822bbdae51c6b6854fbce49ae08c7cfbd6cc56/);
  assert.equal((rollback.match(/curl -q --proxy '' --proto '=https'/g) ?? []).length, 2);
  assert.equal((rollback.match(/--connect-timeout 5 --max-time 15 --max-filesize 65536/g) ?? []).length, 2);
});

test('prepare proof check-only gate runs without a credential or mutation', () => {
  const result = runPrepare(['--check-only'], { BRIDGE_TOKEN: '' });

  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    checkOnly: true,
    status: 'passed',
    wranglerStatus: 'pinned_4.95.0',
    counts: { dependencies: 13, forbiddenRouteCalls: 0 },
  });
});

test('prepare proof check-only gate fails closed on a wrong Wrangler version', () => {
  const result = runPrepare(['--check-only'], { BRIDGE_TOKEN: '' }, '4.94.0');

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /error=unexpected_wrangler_version\n$/);
  assert.equal(result.stdout, '');
});

test('prepare proof refuses every legacy write-capable invocation before credentials or network', () => {
  const result = runPrepare([], {
    BRIDGE_TOKEN: 'proof-token-must-remain-hidden',
    CAMBIUM_QUESTS_BASE_URL: 'https://example.invalid/',
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /error=legacy_source_read_only\n$/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /proof-token-must-remain-hidden/);
});

test('prepare proof keeps former origin inputs behind the legacy read-only boundary', async (t) => {
  const formerInputs = [
    '',
    'http://example.invalid',
    'https://operator:secret@example.invalid',
    'https://example.invalid/path',
    'https://example.invalid?probe=1',
    'https://example.invalid#fragment',
    'https://example.invalid/\nurl = "https://attacker.invalid"',
    'https://example.invalid/',
    `https://${['cambium-quests', 'sheshnarayan-iyer', 'workers', 'dev'].join('.')}/`,
  ];

  for (const baseUrl of formerInputs) {
    await t.test(baseUrl || 'missing origin', () => {
      const result = runPrepare([], {
        BRIDGE_TOKEN: 'proof-token-must-remain-hidden',
        CAMBIUM_QUESTS_BASE_URL: baseUrl,
      });

      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /error=legacy_source_read_only\n$/);
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, /proof-token-must-remain-hidden/);
    });
  }
});
