import assert from 'node:assert/strict';
import test from 'node:test';
import { demoOrgTapestrySnapshot } from './demo-org-tapestry-fixture.ts';
import { buildCambiumSceneFromTapestrySnapshot } from './tapestry-snapshot-scene.ts';

const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('demo-org tapestry fixture is synthetic and standalone-safe', () => {
  const text = JSON.stringify(demoOrgTapestrySnapshot);
  assert.equal(demoOrgTapestrySnapshot.standalone, true);
  assert.equal(demoOrgTapestrySnapshot.tenant.id, 'demo-org');
  assert.deepEqual(demoOrgTapestrySnapshot.recursion, ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio']);
  assert.doesNotMatch(text, privateLeak);
});

test('R3F scene can derive node states and telemetry from the demo-org tapestry snapshot', () => {
  const scene = buildCambiumSceneFromTapestrySnapshot(demoOrgTapestrySnapshot);
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));

  assert.equal(byId.get('genesis')?.state, 'complete');
  assert.equal(byId.get('taste')?.state, 'active');
  assert.equal(byId.get('build')?.state, 'complete');
  assert.equal(byId.get('ops')?.state, 'active');
  assert.equal(byId.get('cortex')?.state, 'memory');
  assert.equal(byId.get('cortex')?.ring, 'dashed');
  assert.equal(scene.telemetry.completedQuests, 3);
  assert.equal(scene.telemetry.totalQuests, 4);
  assert.equal(scene.telemetry.activeArc, 'XVII');
  assert.equal(scene.telemetry.activeQuestId, 'the-archive');
  assert.match(scene.telemetry.progressLabel, /Demo Grove/);
  assert.match(scene.telemetry.derivedAtLabel, /synthetic-demo-fixture/);
});

test('R3F snapshot adapter preserves route references while replacing rail semantics', () => {
  const scene = buildCambiumSceneFromTapestrySnapshot(demoOrgTapestrySnapshot, 'island-cortex');

  assert.equal(scene.activeScreen.id, 'island-cortex');
  assert.equal(scene.nodes.filter((node) => node.selected).at(0)?.id, 'cortex');
  assert.ok(scene.references.length > 0);
  assert.ok(scene.screens.every((screen) => screen.id === 'asset-comparison' || screen.reference));
  assert.ok(scene.rails.some((rail) => rail.id === 'cortex-to-taste' && rail.lane === 'background-emitter' && rail.tone === 'memory'));
  assert.ok(scene.emitterLanes.some((lane) => lane.id === 'cortex-to-taste-emitter' && lane.label === 'MEMORY FEED'));
});
