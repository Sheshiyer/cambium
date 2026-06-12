import assert from 'node:assert/strict';
import test from 'node:test';
import { createProceduralIslandGeometry, proceduralIslandProfiles } from './procedural-islands.ts';

test('every island silhouette has an authored procedural profile', () => {
  assert.deepEqual(Object.keys(proceduralIslandProfiles).sort(), [
    'forge-anvil',
    'memory-orbit',
    'ops-loop',
    'seed-crystal',
    'taste-knot',
  ]);
});

test('procedural island geometry is nontrivial and indexed', () => {
  const geometry = createProceduralIslandGeometry({ silhouette: 'memory-orbit', height: 1.05 });
  assert.ok((geometry.getAttribute('position')?.count ?? 0) > 40);
  assert.ok((geometry.index?.count ?? 0) > 100);
  assert.ok(geometry.boundingSphere?.radius);
});
