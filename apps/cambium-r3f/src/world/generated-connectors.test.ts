import assert from 'node:assert/strict';
import test from 'node:test';
import { generatedRailConnectorContract, railConnectorCanPromote } from './generated-connectors.ts';

test('generated rail connector uses the image-to-3D optimized candidate as a scene preview', () => {
  assert.equal(generatedRailConnectorContract.id, 'rail-arc');
  assert.equal(generatedRailConnectorContract.integrationMode, 'scene-preview');
  assert.match(generatedRailConnectorContract.model, /image-to-3d\/rail-arc\/optimized\/model\.glb$/);
  assert.equal(generatedRailConnectorContract.source, 'image-to-3d-optimized-candidate');
});

test('generated rail connector remains blocked from automatic promotion', () => {
  assert.equal(generatedRailConnectorContract.promotedRuntimeAsset, false);
  assert.equal(railConnectorCanPromote(), false);
  assert.match(generatedRailConnectorContract.blocker, /scale/i);
});
