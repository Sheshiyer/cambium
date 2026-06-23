import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const doc = fs.readFileSync(new URL('../docs/visual/README.md', import.meta.url), 'utf8');
const scope = JSON.parse(fs.readFileSync(new URL('../docs/visual/release-scope.json', import.meta.url), 'utf8'));
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('visual release scope separates standalone gate from R3F final parity', () => {
  assert.equal(scope.schema, 'cambium.visual-release-scope.v1');
  assert.equal(scope.standaloneReleaseGate.status, 'satisfied');
  assert.equal(scope.r3fGameEngineRealignment.releaseBlocker, false);
  assert.equal(scope.r3fGameEngineRealignment.scope, 'visual-product-acceptance');
  assert.deepEqual(scope.r3fGameEngineRealignment.issues, [44, 45, 46, 47, 48, 49, 50, 51, 52]);
  assert.match(scope.releaseDecision, /remove R3F final visual parity from the non-visual standalone release blockers/);
});

test('visual release docs keep R3F checks in the final audit', () => {
  assert.match(doc, /npm run r3f:test/);
  assert.match(doc, /npm run r3f:build/);
  assert.match(doc, /release-facing docs must not claim final R3F visual parity/);
});

test('visual release scope stays free of private company state', () => {
  assert.doesNotMatch(doc, privateLeak);
  assert.doesNotMatch(JSON.stringify(scope), privateLeak);
});
