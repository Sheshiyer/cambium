import assert from 'node:assert/strict';
import test from 'node:test';

import { COMPONENT_MISSION_CONTROL } from './page/components/mission-control.ts';

test('Mini App keeps Fitcheck review and external waits non-terminal', () => {
  const readyForReview = COMPONENT_MISSION_CONTROL.indexOf('ready-for-review|external-wait|proposed|pending-review');
  const genericReadyComplete = COMPONENT_MISSION_CONTROL.indexOf('verified|complete|ready|done');

  assert.ok(readyForReview >= 0);
  assert.ok(genericReadyComplete >= 0);
  assert.ok(readyForReview < genericReadyComplete);
  assert.match(COMPONENT_MISSION_CONTROL, /if \(\/approved\/\.test\(state\)\) return 'active';/);
  assert.match(COMPONENT_MISSION_CONTROL, /ready-for-review\|external-wait\|proposed\|pending-review/);
});
