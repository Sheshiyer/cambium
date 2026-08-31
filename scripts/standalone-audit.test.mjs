import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedLiveDeploymentEvidencePath } from './standalone-audit.mjs';

test('standalone audit · live topology is evidence-only outside explicit runtime proof code', () => {
  assert.equal(isAllowedLiveDeploymentEvidencePath('docs/evidence/tg-miniapp/2026-06-30/redacted-device-proof.json'), true);
  assert.equal(isAllowedLiveDeploymentEvidencePath('ISA.md'), true);
  assert.equal(isAllowedLiveDeploymentEvidencePath('workers/quests/src/index.ts'), false);
  assert.equal(isAllowedLiveDeploymentEvidencePath('docs/runbooks/telegram-action-request-lifecycle.md'), false);
});

test('standalone audit · canonical Labs authority files may name the production route', () => {
  for (const file of [
    'docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json',
    'docs/superpowers/specs/2026-08-31-labs-consolidation-design.md',
    'scripts/quests-wrangler-profile.mjs',
    'scripts/quests-wrangler-profile.test.mjs',
    'workers/quests/DEPLOY.md',
    'workers/quests/DEPLOY-LABS.md',
  ]) {
    assert.equal(isAllowedLiveDeploymentEvidencePath(file), true, file);
  }
  assert.equal(isAllowedLiveDeploymentEvidencePath('scripts/unrelated-deploy.mjs'), false);
  assert.equal(isAllowedLiveDeploymentEvidencePath('workers/quests/DEPLOY-COPY.md'), false);
});
