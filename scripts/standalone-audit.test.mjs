import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedLiveDeploymentEvidencePath } from './standalone-audit.mjs';

test('standalone audit · live topology is evidence-only outside explicit runtime proof code', () => {
  assert.equal(isAllowedLiveDeploymentEvidencePath('docs/evidence/tg-miniapp/2026-06-30/redacted-device-proof.json'), true);
  assert.equal(isAllowedLiveDeploymentEvidencePath('ISA.md'), true);
  assert.equal(isAllowedLiveDeploymentEvidencePath('workers/quests/src/index.ts'), false);
  assert.equal(isAllowedLiveDeploymentEvidencePath('docs/runbooks/telegram-action-request-lifecycle.md'), false);
});
