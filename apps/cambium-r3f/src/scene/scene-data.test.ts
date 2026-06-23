import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCambiumScene } from './scene-data.ts';
import { screenOrder } from './route-registry.ts';
import { sourceContract } from '../generated/source-contract.ts';
import { CAMBIUM_LANES, CAMBIUM_SENSES, CAMBIUM_VISUAL_RAILS, CAMBIUM_VISUAL_STAGES, CAMBIUM_WAKE_STEPS } from '../../../../shared/cambium-visual-contract.ts';

test('scene adapter exposes the Cambium organ islands plus cortex', () => {
  const scene = buildCambiumScene();
  assert.deepEqual(scene.nodes.map((node) => node.id), CAMBIUM_VISUAL_STAGES.map((stage) => stage.id));
  assert.equal(scene.nodes.find((node) => node.id === 'cortex')?.state, 'memory');
  assert.equal(scene.rails.some((rail) => rail.from === 'cortex' && rail.to === 'taste'), true);
  assert.ok(scene.nodes.every((node) => node.silhouette && node.biome && node.cameraTarget.zoom > 100));
});

test('scene adapter stays aligned with the shared TG visual contract', () => {
  const scene = buildCambiumScene();
  assert.deepEqual(sourceContract.visual.stages, CAMBIUM_VISUAL_STAGES);
  assert.deepEqual(sourceContract.visual.rails, CAMBIUM_VISUAL_RAILS);
  assert.deepEqual(sourceContract.visual.wakeSteps, CAMBIUM_WAKE_STEPS);
  assert.deepEqual(sourceContract.visual.senses, CAMBIUM_SENSES);
  assert.deepEqual(sourceContract.visual.lanes, CAMBIUM_LANES);
  assert.deepEqual(sourceContract.visual.stageMetadata.map((stage) => stage.id), CAMBIUM_VISUAL_STAGES.map((stage) => stage.id));
  const questArcs = new Set(sourceContract.questSummary.questLine.map((quest) => String(quest.arc)));
  const stageArcOwners = new Map<string, string>();
  for (const stage of CAMBIUM_VISUAL_STAGES) {
    const metadata = sourceContract.visual.stageMetadata.find((candidate) => candidate.id === stage.id);
    assert.ok(metadata, `missing visual metadata for stage ${stage.id}`);
    assert.equal(metadata.visualTitle, stage.title);
    assert.equal(metadata.visualDetail, stage.detail);
    assert.deepEqual(metadata.arcs, stage.arcs);
    assert.ok(['pipeline.stage', 'pipeline.crosscutting'].includes(metadata.source));
    assert.ok(metadata.organ.length > 0, `stage ${stage.id} should keep its R3F organ metadata`);
    assert.ok(metadata.r3fTitle.length > 0, `stage ${stage.id} should keep its R3F title metadata`);
    for (const arc of stage.arcs.map(String)) {
      assert.equal(stageArcOwners.has(arc), false, `quest arc ${arc} has multiple stage owners`);
      stageArcOwners.set(arc, stage.id);
    }
    const node = scene.nodes.find((candidate) => candidate.id === stage.id);
    assert.ok(node, `missing visual stage ${stage.id}`);
    assert.ok(node.title.length > 0, `stage ${stage.id} should keep its R3F stage title`);
  }
  assert.deepEqual(new Set(stageArcOwners.keys()), questArcs);
  for (const contractRail of CAMBIUM_VISUAL_RAILS) {
    const rail = scene.rails.find((candidate) => candidate.id === contractRail.id);
    assert.ok(rail, `missing visual rail ${contractRail.id}`);
    assert.equal(rail.from, contractRail.from);
    assert.equal(rail.to, contractRail.to);
    assert.equal(rail.lane, contractRail.lane);
  }
});

test('R3F source contract preserves every shared TG rail label', () => {
  const scene = buildCambiumScene();
  const sceneRailIds = new Set(scene.rails.map((rail) => rail.id));
  const r3fLabelsByRail = new Map(sourceContract.visual.rails.map((rail) => [rail.id, rail.label]));

  assert.deepEqual(
    sourceContract.visual.rails.filter((rail) => sceneRailIds.has(rail.id)).map((rail) => rail.label),
    CAMBIUM_VISUAL_RAILS.map((rail) => rail.label),
  );

  for (const rail of CAMBIUM_VISUAL_RAILS) {
    assert.equal(sceneRailIds.has(rail.id), true, `missing R3F rail ${rail.id} for TG label ${rail.label}`);
    assert.equal(r3fLabelsByRail.get(rail.id), rail.label, `missing R3F TG rail label ${rail.label}`);
  }
});

test('scene adapter preserves quest progress and frozen references', () => {
  const scene = buildCambiumScene();
  assert.equal(scene.telemetry.activeArc, 'complete');
  assert.equal(scene.telemetry.completedQuests, 17);
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

test('scene model exposes desktop manual-feedback QA policy', () => {
  const scene = buildCambiumScene();
  assert.equal(scene.qaPolicy.visualFeedbackGate.browserVisualE2E, 'skipped-by-user-request');
  assert.equal(scene.qaPolicy.visualFeedbackGate.reviewer, 'user');
  assert.equal(scene.qaPolicy.electronReadiness.targetShell, 'electron-macos-laptop');
  assert.ok(scene.qaPolicy.desktopViewports.some((viewport) => viewport.id === 'macbook-air-13'));
});

test('overview art direction locks the reference-matched home pass', () => {
  const scene = buildCambiumScene('home');
  assert.equal(scene.overviewArtDirection.routeId, 'home');
  assert.equal(scene.overviewArtDirection.domChrome, 'minimal-world-first');
  assert.ok(scene.overviewArtDirection.mapOccupancyTarget >= 0.7);
  assert.ok(scene.overviewArtDirection.cameraZoom >= 84);
  assert.ok(scene.overviewArtDirection.islandGlyphScale >= 1.3);
  assert.ok(scene.overviewArtDirection.railParticleMultiplier >= 4);
  assert.deepEqual(Object.keys(scene.overviewArtDirection.heroGlyphs), ['genesis', 'taste', 'build', 'ops', 'cortex']);
  assert.match(scene.overviewArtDirection.heroGlyphs.genesis, /star/);
  assert.match(scene.overviewArtDirection.heroGlyphs.build, /triangular/);
  assert.match(scene.overviewArtDirection.heroGlyphs.cortex, /wheel/);
});
