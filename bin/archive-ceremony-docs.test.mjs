import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync(new URL('../docs/archive/README.md', import.meta.url), 'utf8');
const fixture = JSON.parse(fs.readFileSync(new URL('../docs/archive/fixtures/demo-archive-receipt.json', import.meta.url), 'utf8'));
const releaseScope = JSON.parse(fs.readFileSync(new URL('../docs/archive/release-scope.json', import.meta.url), 'utf8'));
const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('archive ceremony docs define a generic project closeout contract', () => {
  assert.match(doc, /product event/);
  assert.match(doc, /project-closeout/);
  assert.match(doc, /projectArchived: true/);
  assert.match(doc, /Agent-plane, repository, deployment, CRM, and chat systems may all provide archive evidence/);
  assert.match(doc, /standalone release gate is the neutral project archive receipt/);
});

test('archive release scope separates product gate from adapter runtime retirement', () => {
  assert.equal(releaseScope.schema, 'cambium.archive-release-scope.v1');
  assert.equal(releaseScope.standaloneReleaseGate.status, 'satisfied');
  assert.equal(releaseScope.adapterRuntimeRetirement.releaseBlocker, false);
  assert.equal(releaseScope.adapterRuntimeRetirement.scope, 'adapter-operations');
  assert.match(releaseScope.releaseDecision, /close the standalone archive blocker/);
});

test('demo archive receipt fixture is tenant-scoped and generic', () => {
  assert.equal(fixture.tenant, 'demo-org');
  assert.equal(fixture.archives[0].routineId, 'project-closeout');
  assert.equal(fixture.archives[0].archived, true);
  assert.ok(fixture.archives[0].ceremony.every((line) => !/paperclip/i.test(line)));
  assert.ok(fixture.archives[0].ceremony.some((line) => /surviving channel adapters/.test(line)));
});

test('archive docs and fixture stay free of private host data', () => {
  assert.doesNotMatch(doc, privateLeak);
  assert.doesNotMatch(JSON.stringify(fixture), privateLeak);
  assert.doesNotMatch(JSON.stringify(releaseScope), privateLeak);
});
