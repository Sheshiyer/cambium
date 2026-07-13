import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const pkg = JSON.parse(read('package.json'));
const ci = read('.github/workflows/ci.yml');
const releaseWorkflow = read('.github/workflows/release.yml');
const releaseScript = read('scripts/release.sh');

test('release contract · one deterministic command owns local and workflow gates', () => {
  assert.equal(pkg.scripts['drift:audit'], 'node scripts/drift-audit.mjs');
  assert.equal(pkg.scripts['verify:release'], 'node scripts/verify-release.mjs');
  for (const workflow of [ci, releaseWorkflow]) {
    assert.match(workflow, /npm ci --prefix apps\/cambium-r3f/);
    assert.match(workflow, /npm run verify:release/);
  }
  assert.match(releaseScript, /npm run verify:release/);
});

test('release contract · live readiness is uploaded without being mislabeled deterministic proof', () => {
  assert.match(ci, /npm run proof:tg-live-readiness/);
  assert.match(ci, /actions\/upload-artifact@v4/);
  assert.match(ci, /\.artifacts\/tg-miniapp-live-proof\/readiness\.json/);
  assert.match(releaseWorkflow, /Live readiness report \(separate evidence\)/);
  assert.doesNotMatch(releaseWorkflow, /TG mini app readiness proof \(non-strict\)/);
});

test('release contract · local release preflights before version mutation and uses no mtime authority', () => {
  const preflight = releaseScript.indexOf('npm run verify:release');
  const mutation = releaseScript.indexOf("p.version='");
  assert.ok(preflight >= 0 && mutation > preflight, 'deterministic preflight runs before package mutation');
  assert.doesNotMatch(releaseScript, /READINESS_LEDGER|LEDGER_TS|mtime|git checkout --/);
  assert.match(releaseScript, /git diff --quiet -- package\.json VERSIONS\.md/);
  assert.match(releaseScript, /origin\/main/);
});
