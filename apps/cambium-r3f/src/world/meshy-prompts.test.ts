import assert from 'node:assert/strict';
import test from 'node:test';
import promptSpec from '../../asset-prompts/meshy-island-prompts.json' with { type: 'json' };
import { islandDefinitions } from './island-registry.ts';

test('Meshy prompt spec covers every Cambium island once', () => {
  const promptIds = promptSpec.islands.map((island) => island.id).sort();
  assert.deepEqual(promptIds, Object.keys(islandDefinitions).sort());
});

test('Meshy prompts stay within API prompt limits and reject literal architecture', () => {
  for (const island of promptSpec.islands) {
    assert.ok(island.prompt.length <= 600, `${island.id} prompt should fit Meshy API limit`);
    assert.ok(island.texturePrompt.length <= 600, `${island.id} texture prompt should fit Meshy API limit`);
    assert.doesNotMatch(`${island.prompt} ${island.texturePrompt}`, /building|city|factory|character|people/i);
    assert.ok(island.targetPolycount >= 12000 && island.targetPolycount <= 30000);
  }
});

test('Meshy credit estimate is explicit before paid generation', () => {
  assert.equal(promptSpec.estimatedCredits.fullAssetPerIsland, 30);
  assert.equal(promptSpec.estimatedCredits.fullSetOfFive, 150);
});
