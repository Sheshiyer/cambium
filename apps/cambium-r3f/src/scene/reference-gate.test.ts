import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCambiumScene } from './scene-data.ts';
import { perceptualReferenceCriteria, scorePerceptualReferenceGate } from './reference-gate.ts';

test('perceptual reference gate covers the next art-pipeline requirements', () => {
  assert.deepEqual(perceptualReferenceCriteria.map((criterion) => criterion.id), [
    'silhouette-richness',
    'material-depth',
    'atmosphere-depth',
    'in-world-typography',
    'camera-choreography',
    'game-map-legibility',
  ]);
});

test('current scene model passes the structural reference gate before screenshot review', () => {
  const result = scorePerceptualReferenceGate(buildCambiumScene('home'));
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
  assert.ok(result.checks.every((check) => check.passed));
});
