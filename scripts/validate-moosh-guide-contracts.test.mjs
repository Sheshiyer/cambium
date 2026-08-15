import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const contractPaths = [
  'docs/guide/cambium-moosh-coverage-model.json',
  'docs/guide/cambium-moosh-coverage.json',
  'docs/guide/cambium-surface-inventory.json',
  'docs/guide/capture.config.json',
  'docs/guide/guide-manifest.json',
  'docs/videos/film.json',
];

test('Moosh guide contracts cover every declared Cambium surface', () => {
  const inventory = readJson('docs/guide/cambium-surface-inventory.json');
  const model = readJson('docs/guide/cambium-moosh-coverage-model.json');
  const coverage = readJson('docs/guide/cambium-moosh-coverage.json');

  const inventoryIds = inventory.surfaces.map(({ id }) => id);
  const modelIds = model.surfaces.map(({ id }) => id);
  assert.equal(new Set(inventoryIds).size, inventoryIds.length);
  assert.deepEqual(modelIds.sort(), [...inventoryIds].sort());
  assert.deepEqual(Object.keys(coverage.surface_modes).sort(), [...inventoryIds].sort());

  const laneIds = new Set(Object.keys(model.evidence_lanes));
  const tierIds = new Set(Object.keys(model.authority_tiers));
  for (const surface of model.surfaces) {
    assert.ok(laneIds.has(surface.ui_evidence), `${surface.id} has an unknown UI lane`);
    assert.ok(laneIds.has(surface.system_evidence), `${surface.id} has an unknown system lane`);
    assert.ok(tierIds.has(surface.authority), `${surface.id} has an unknown authority tier`);
    assert.ok(surface.does_not_prove, `${surface.id} must state what its evidence does not prove`);
  }
});

test('Moosh film remains within its declared runtime bound', () => {
  const film = readJson('docs/videos/film.json');
  const duration = film.shots.reduce((total, shot) => total + shot.dur, 0);
  assert.ok(duration <= film.maxSeconds);
});

test('Moosh contracts contain no machine-local checkout paths', () => {
  for (const relativePath of contractPaths) {
    const body = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.doesNotMatch(body, /\/(?:Users|Volumes|private)\//);
  }
});
