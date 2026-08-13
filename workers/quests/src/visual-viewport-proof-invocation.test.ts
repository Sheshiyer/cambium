import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { isDirectInvocation } from './visual-viewport-proof.mjs';

test('viewport proof runner recognizes a relative CLI entry path', () => {
  const entry = 'workers/quests/src/visual-viewport-proof.mjs';
  const moduleUrl = new URL('./visual-viewport-proof.mjs', import.meta.url).href;

  assert.equal(isDirectInvocation(entry, moduleUrl), true);
  assert.equal(isDirectInvocation(resolve(entry), moduleUrl), true);
  assert.equal(isDirectInvocation('/private/runner/visual-viewport-proof.mjs', moduleUrl), true);
  assert.equal(isDirectInvocation('workers/quests/src/other-proof.mjs', moduleUrl), false);
});
