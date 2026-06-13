import assert from 'node:assert/strict';
import test from 'node:test';
import { routeDrafts, screenOrder } from './route-registry.ts';

test('route registry covers the frozen Phase 2 screen tasks in order', () => {
  assert.deepEqual(screenOrder, [
    'home',
    'island-genesis',
    'island-taste',
    'island-build',
    'island-ops',
    'island-cortex',
    'elements-settings',
    'visualizations',
    'figma-components',
    'asset-comparison',
  ]);
  assert.deepEqual(routeDrafts.map((route) => route.taskId), ['T005', 'T006', 'T007', 'T008', 'T009', 'T010', 'T011', 'T012', 'T013', 'R3F-GE-ASSET-QA']);
  assert.deepEqual(routeDrafts.map((route) => route.issue), [31, 32, 33, 34, 35, 36, 37, 38, 39, 52]);
});

test('every route preserves visible exact-label anchors from its prompt', () => {
  for (const route of routeDrafts) {
    assert.ok(route.exactLabels.includes(route.title), `${route.id} should include its title as an exact label`);
    assert.ok(route.exactLabels.length >= 5, `${route.id} should expose enough route labels for visual QA`);
  }
});

test('phase 3 route support exists through camera modes and screen modes', () => {
  assert.ok(routeDrafts.some((route) => route.defaultCamera === 'overview'));
  assert.ok(routeDrafts.some((route) => route.defaultCamera === 'node'));
  assert.ok(routeDrafts.some((route) => route.defaultCamera === 'flat'));
  assert.ok(routeDrafts.some((route) => route.mode === 'settings'));
  assert.ok(routeDrafts.some((route) => route.mode === 'visualizations'));
  assert.ok(routeDrafts.some((route) => route.mode === 'components'));
  assert.ok(routeDrafts.some((route) => route.mode === 'asset-comparison'));
});

test('route copy frames the app as a tactical engine rather than a SaaS dashboard', () => {
  const joined = routeDrafts.map((route) => `${route.title} ${route.description}`).join(' ');
  assert.doesNotMatch(joined, /dashboard|card grid|SaaS/i);
  assert.match(routeDrafts[0].description, /2\.5D organ map/);
  assert.match(routeDrafts.find((route) => route.id === 'asset-comparison')?.description ?? '', /Scene-native comparison bench/);
});

test('asset comparison route exposes review and hold language before promotion', () => {
  const route = routeDrafts.find((candidate) => candidate.id === 'asset-comparison');
  assert.ok(route);
  assert.equal(route.eyebrow, 'SOURCE · CURRENT · MASTER · REVIEW');
  assert.ok(route.exactLabels.includes('REVIEW'));
  assert.ok(route.exactLabels.includes('HOLD'));
  assert.ok(route.exactLabels.includes('NOT PROMOTED'));
  assert.equal(route.panels.find((panel) => panel.title === 'REVIEW')?.value, 'manual');
});
