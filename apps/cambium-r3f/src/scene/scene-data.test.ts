import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCambiumScene } from './scene-data.ts';
import { screenOrder } from './route-registry.ts';

test('scene adapter exposes the Cambium organ islands plus cortex', () => {
  const scene = buildCambiumScene();
  assert.deepEqual(scene.nodes.map((node) => node.id), ['genesis', 'taste', 'build', 'ops', 'cortex']);
  assert.equal(scene.nodes.find((node) => node.id === 'cortex')?.state, 'memory');
  assert.equal(scene.rails.some((rail) => rail.from === 'cortex' && rail.to === 'taste'), true);
  assert.ok(scene.nodes.every((node) => node.silhouette && node.biome && node.cameraTarget.zoom > 100));
});

test('scene adapter preserves quest progress and frozen references', () => {
  const scene = buildCambiumScene();
  assert.equal(scene.telemetry.activeArc, 'X');
  assert.equal(scene.telemetry.completedQuests, 9);
  assert.equal(scene.telemetry.totalQuests, 17);
  assert.ok(scene.references.find((reference) => reference.taskId === 'T005' && reference.screen === 'home'));
  assert.ok(scene.nodes.every((node) => node.id === 'ops' || node.reference));
});

test('scene adapter binds every implemented route to its frozen reference', () => {
  const scene = buildCambiumScene();
  assert.deepEqual(scene.screens.map((screen) => screen.id), screenOrder);
  assert.equal(scene.screens.length, 10);
  const frozenScreens = scene.screens.filter((screen) => screen.id !== 'asset-comparison');
  assert.ok(frozenScreens.every((screen) => screen.reference?.taskId === screen.taskId));
  assert.equal(scene.screens.find((screen) => screen.id === 'asset-comparison')?.reference, undefined);
});

test('route selection highlights the active organ node', () => {
  const scene = buildCambiumScene('island-cortex');
  const selected = scene.nodes.filter((node) => node.selected);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'cortex');
  assert.equal(scene.activeScreen.exactLabels.includes('RECALL'), true);
});

test('game-engine model exposes emitters, controls, and scene-native visualization layers', () => {
  const scene = buildCambiumScene('visualizations');
  assert.ok(scene.emitterLanes.some((lane) => lane.label === 'BACKGROUND EMITTERS' || lane.label === 'MEMORY FEED'));
  assert.deepEqual(scene.engineControls.map((control) => control.kind), ['quality', 'material', 'emitter', 'camera', 'accessibility']);
  assert.ok(scene.visualizationLayers.some((layer) => layer.id === 'deps'));
  assert.equal(scene.activeScreen.mode, 'visualizations');
});
