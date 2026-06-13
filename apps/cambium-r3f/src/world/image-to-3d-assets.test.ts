import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import publicManifest from '../../public/assets/meshy/image-to-3d/manifest.json' with { type: 'json' };
import optimizedManifest from '../../public/assets/meshy/image-to-3d/optimized-candidates.json' with { type: 'json' };
import { imageTo3dComparisonAssetFor, imageTo3dComparisonAssets } from './image-to-3d-assets.ts';
import { meshyIslandAssets } from './meshy-assets.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(appRoot, '../..');

function publicPath(assetPath: string) {
  return path.join(appRoot, 'public', assetPath.replace(/^\//, ''));
}

test('image-to-3D master comparison registry mirrors the public Meshy manifest', () => {
  assert.equal(publicManifest.pipeline, 'image-to-3d');
  assert.deepEqual(imageTo3dComparisonAssets.map((asset) => asset.id), ['genesis', 'rail-arc']);

  for (const asset of imageTo3dComparisonAssets) {
    const manifestAsset = publicManifest.assets[asset.id as keyof typeof publicManifest.assets];
    assert.ok(manifestAsset, `${asset.id} should exist in image-to-3D manifest`);
    assert.equal(asset.master.taskId, manifestAsset.taskId);
    assert.equal(asset.master.model, manifestAsset.model);
    assert.equal(asset.master.thumbnail, manifestAsset.thumbnail);
    assert.equal(asset.master.sourceImage, manifestAsset.sourceImage);
    assert.equal(asset.master.modelBytes, manifestAsset.modelBytes);
    assert.equal(asset.verdict, 'master-candidate');
    assert.equal(asset.promotionStatus, 'not-promoted');
  }
});

test('image-to-3D masters are QA-only and not the promoted runtime assets', () => {
  const genesis = imageTo3dComparisonAssetFor('genesis');
  const railArc = imageTo3dComparisonAssetFor('rail-arc');
  assert.ok(genesis);
  assert.ok(railArc);
  assert.equal(genesis.current?.model, meshyIslandAssets.genesis.model);
  assert.notEqual(genesis.master.model, meshyIslandAssets.genesis.model);
  assert.match(genesis.master.model, /\/assets\/meshy\/image-to-3d\/genesis\/model\.glb$/);
  assert.equal(railArc.current, undefined);
});

test('image-to-3D comparison assets have source textures and oversized master GLBs on disk', () => {
  for (const asset of imageTo3dComparisonAssets) {
    const sourcePath = path.join(repoRoot, asset.master.sourceImage);
    const sourceTexturePath = publicPath(asset.master.sourceTexture);
    const masterModelPath = publicPath(asset.master.model);
    const masterThumbnailPath = publicPath(asset.master.thumbnail);

    assert.ok(existsSync(sourcePath), `${asset.id} source image should exist for provenance`);
    assert.ok(existsSync(sourceTexturePath), `${asset.id} public source texture should exist`);
    assert.ok(existsSync(masterModelPath), `${asset.id} master GLB should exist`);
    assert.ok(existsSync(masterThumbnailPath), `${asset.id} master thumbnail should exist`);
    assert.equal(statSync(masterModelPath).size, asset.master.modelBytes);
    assert.ok(asset.master.modelBytes > 15 * 1024 * 1024, `${asset.id} master should remain above runtime budget until optimized`);
  }
});

test('optimized image-to-3D candidates pass runtime budget without promotion', () => {
  assert.equal(optimizedManifest.status, 'candidate');

  for (const asset of imageTo3dComparisonAssets) {
    const optimized = optimizedManifest.assets[asset.id as keyof typeof optimizedManifest.assets];
    assert.ok(optimized, `${asset.id} should have an optimized candidate manifest entry`);
    const optimizedPath = publicPath(asset.optimized.model);

    assert.equal(asset.optimized.model, optimized.optimizedModel);
    assert.equal(asset.optimized.modelBytes, optimized.outputBytes);
    assert.equal(asset.optimized.method, optimized.method);
    assert.equal(asset.optimized.promotionStatus, 'not-promoted');
    assert.equal(asset.optimized.runtimeBudgetStatus, 'pass');
    assert.ok(existsSync(optimizedPath), `${asset.id} optimized candidate should exist`);
    assert.equal(statSync(optimizedPath).size, asset.optimized.modelBytes);
    assert.ok(asset.optimized.modelBytes < optimizedManifest.runtimeBudgetBytes, `${asset.id} optimized candidate should pass runtime budget`);
    assert.notEqual(asset.optimized.model, meshyIslandAssets[asset.id as keyof typeof meshyIslandAssets]?.model);
  }
});

test('image-to-3D review gate is perceptual and never auto-promotes runtime assets', () => {
  const requiredCriteria = [
    'source-fidelity',
    'silhouette-richness',
    'material-depth',
    'scale-legibility',
    'runtime-derivative',
    'scene-fit',
  ];

  for (const asset of imageTo3dComparisonAssets) {
    assert.equal(asset.review.gate, 'perceptual-reference-comparison');
    assert.equal(asset.review.gateStatus, 'manual-approval-required');
    assert.equal(asset.review.threshold, 86);
    assert.deepEqual(asset.review.criteria.map((criterion) => criterion.id), requiredCriteria);
    assert.ok(asset.review.criteria.every((criterion) => criterion.score >= 1 && criterion.score <= 5));
    assert.ok(asset.review.score >= 75, `${asset.id} should be a serious candidate before review`);
    assert.equal(asset.promotionStatus, 'not-promoted');
    assert.equal(asset.optimized.promotionStatus, 'not-promoted');
    assert.match(asset.review.nextAction, /approval|Review/i);
  }

  assert.equal(imageTo3dComparisonAssetFor('genesis')?.review.readiness, 'review-ready');
  assert.equal(imageTo3dComparisonAssetFor('rail-arc')?.review.readiness, 'needs-art-pass');
  assert.ok(imageTo3dComparisonAssetFor('rail-arc')?.review.blockers.includes('connector scale needs scene-side approval'));
});
