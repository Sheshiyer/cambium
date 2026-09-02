import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const pkg = JSON.parse(read('package.json'));
const ci = read('.github/workflows/ci.yml');
const releaseWorkflow = read('.github/workflows/release.yml');
const releaseScript = read('scripts/release.sh');
const workerDeploy = read('workers/quests/DEPLOY.md');
const labsWorkerDeploy = read('workers/quests/DEPLOY-LABS.md');
const legacySecretStaging = read('scripts/stage-marketing-create-secrets.sh');
const legacyPrepareProof = read('scripts/prove-marketing-create-prepare.sh');

test('release contract · one deterministic command owns local and workflow gates', () => {
  assert.equal(pkg.scripts['drift:audit'], 'node scripts/drift-audit.mjs');
  assert.equal(pkg.scripts['verify:release'], 'node scripts/verify-release.mjs');
  for (const workflow of [ci, releaseWorkflow]) {
    assert.match(workflow, /npm ci --prefix apps\/cambium-r3f/);
    assert.match(workflow, /npm run verify:release/);
  }
  assert.match(releaseScript, /npm run verify:release/);
  assert.match(read('scripts/verify-release.mjs'), /Fitcheck organ and quest projection/);
  assert.match(read('scripts/verify-release.mjs'), /fitcheck-mini-app-quest-states\.test\.ts/);
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

test('release contract · codename output uses a shell-safe workflow block', () => {
  assert.match(releaseWorkflow, /CODENAME="\$\(node -p "require\('\.\/package\.json'\)\.codename \|\| 'Muse'"\)"/);
  assert.match(releaseWorkflow, /printf 'codename=%s\\n' "\$CODENAME" >> "\$GITHUB_OUTPUT"/);
  assert.doesNotMatch(releaseWorkflow, /node -p \\"/);
});

test('release contract · Worker deployment documents an isolated verified rollback', () => {
  assert.match(workerDeploy, /## Rollback/);
  assert.match(workerDeploy, /DEPLOY-LABS\.md/);
  assert.match(workerDeploy, /legacy source.*read-only/is);
  assert.match(workerDeploy, /previous known-good release tag/);
  assert.match(workerDeploy, /isolated clean clone/);
  assert.match(labsWorkerDeploy, /quests-wrangler-profile\.mjs/);
  assert.match(labsWorkerDeploy, /--profile thoughtseed-labs/);
  assert.match(labsWorkerDeploy, /--config workers\/quests\/wrangler\.labs\.jsonc/);
  const sourceInventory = labsWorkerDeploy.indexOf('## Read-only 9d9d inventory');
  assert.ok(sourceInventory > 0, 'Labs runbook has an explicit source-inventory boundary');
  assert.doesNotMatch(
    labsWorkerDeploy.slice(0, sourceInventory),
    /workers\/quests\/wrangler\.jsonc/,
  );
  assert.match(
    labsWorkerDeploy.slice(sourceInventory),
    /--profile legacy-source --operation read/,
  );
  assert.match(legacySecretStaging, /CHECK_ONLY.*false[\s\S]{0,80}legacy_source_read_only/);
  assert.match(legacyPrepareProof, /fail 'legacy_source_read_only'/);
  assert.match(workerDeploy, /healthz\/gate/);
  assert.match(workerDeploy, /HTTP 401/);
});
