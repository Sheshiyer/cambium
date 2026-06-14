import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import publicManifest from '../../public/assets/meshy/islands/manifest.json' with { type: 'json' };
import { islandDefinitions } from './island-registry.ts';
import { meshyAssetFor, meshyAssetManifestStatus, meshyIslandAssets } from './meshy-assets.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function publicPath(assetPath: string) {
  return path.join(appRoot, 'public', assetPath.replace(/^\//, ''));
}

test('Meshy asset manifest exposes a refined asset for every island', () => {
  assert.equal(meshyAssetManifestStatus, 'complete');
  assert.equal(publicManifest.status, meshyAssetManifestStatus);
  assert.deepEqual(Object.keys(meshyIslandAssets).sort(), Object.keys(islandDefinitions).sort());

  for (const islandId of Object.keys(islandDefinitions)) {
    const asset = meshyAssetFor(islandId);
    const publicAsset = publicManifest.assets[islandId as keyof typeof publicManifest.assets];
    assert.ok(asset, `${islandId} should resolve a Meshy asset`);
    assert.ok(publicAsset, `${islandId} should exist in the public manifest`);
    assert.equal(asset.id, islandId);
    assert.equal(asset.taskId, publicAsset.taskId);
    assert.equal(asset.model, publicAsset.model);
    assert.equal(asset.thumbnail, publicAsset.thumbnail);
    assert.equal(asset.stage, 'refined');
    assert.match(asset.model, new RegExp(`/assets/meshy/islands/${islandId}/model\\.glb$`));
    assert.match(asset.thumbnail, new RegExp(`/assets/meshy/islands/${islandId}/thumbnail\\.png$`));
    assert.ok(asset.sceneScale > 0.4 && asset.sceneScale < 0.9, `${islandId} scene scale should stay map-sized`);
  }
});

test('Meshy GLBs and thumbnails are present and stay within the desktop web budget', () => {
  for (const asset of Object.values(meshyIslandAssets)) {
    const modelPath = publicPath(asset.model);
    const thumbnailPath = publicPath(asset.thumbnail);
    assert.ok(existsSync(modelPath), `${asset.id} GLB should exist`);
    assert.ok(existsSync(thumbnailPath), `${asset.id} thumbnail should exist`);
    assert.ok(statSync(modelPath).size < 15 * 1024 * 1024, `${asset.id} GLB should stay under 15MB`);
  }
});
