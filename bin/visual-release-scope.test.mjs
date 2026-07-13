import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const doc = fs.readFileSync(new URL('../docs/visual/README.md', import.meta.url), 'utf8');
const scope = JSON.parse(fs.readFileSync(new URL('../docs/visual/release-scope.json', import.meta.url), 'utf8'));
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('visual release scope is evergreen and contains no GitHub issue mirror', () => {
  assert.equal(scope.schema, 'cambium.visual-release-scope.v1');
  assert.equal(scope.standaloneReleaseGate.status, 'satisfied');
  assert.equal(scope.r3f.releaseBlocker, false);
  assert.equal('issues' in scope.r3f, false);
  assert.equal('milestone' in scope.r3f, false);
  assert.deepEqual(scope.r3f.deterministicGates, ['npm run r3f:test', 'npm run r3f:build']);
  assert.match(scope.releaseDecision, /deterministic R3F gates are required/);
});

test('visual release docs keep R3F checks in the final audit', () => {
  assert.match(doc, /npm run r3f:test/);
  assert.match(doc, /npm run r3f:build/);
  assert.match(doc, /do not claim that a\s+human has accepted visual parity/);
});

test('visual release scope stays free of private company state', () => {
  assert.doesNotMatch(doc, privateLeak);
  assert.doesNotMatch(JSON.stringify(scope), privateLeak);
});
