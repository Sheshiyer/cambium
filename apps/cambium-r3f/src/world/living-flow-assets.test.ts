import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCambiumScene } from '../scene/scene-data.ts';
import {
  activeProcessNode,
  createIslandPorts,
  createRailPacketMarkers,
  createVisualizationOverlaySpecs,
  livingFlowAssets,
} from './living-flow-assets.ts';

test('living flow assets map generated source plates into procedural scene meshes without auto-promotion', () => {
  assert.deepEqual(livingFlowAssets.map((asset) => asset.id), [
    'signal-packet',
    'emitter-node',
    'process-beacon',
    'visualization-lens',
  ]);
  assert.ok(livingFlowAssets.every((asset) => asset.integrationMode === 'procedural-scene-mesh'));
  assert.ok(livingFlowAssets.every((asset) => asset.promotedRuntimeAsset === false));
});

test('island ports attach every rail endpoint to the organ graph', () => {
  const scene = buildCambiumScene();
  const ports = createIslandPorts(scene.nodes, scene.rails);
  assert.equal(ports.length, scene.rails.length * 2);
  assert.ok(ports.some((port) => port.nodeId === 'cortex' && port.kind === 'memory'));
  assert.ok(ports.every((port) => Number.isFinite(port.position[0]) && Number.isFinite(port.rotationY)));
});

test('rail packet markers are spatial and tied to rail packet counts', () => {
  const scene = buildCambiumScene();
  const rail = scene.rails.find((candidate) => candidate.id === 'taste-to-build');
  assert.ok(rail);
  const packets = createRailPacketMarkers(scene.nodes, rail);
  assert.equal(packets.length, rail.packetCount + 1);
  assert.ok(packets.every((packet) => packet.position[1] > 0.3));
});

test('current process beacon resolves to the active organ when no island is selected', () => {
  const overview = buildCambiumScene();
  assert.equal(activeProcessNode(overview.nodes)?.id, 'taste');
  const cortex = buildCambiumScene('island-cortex');
  assert.equal(activeProcessNode(cortex.nodes)?.id, 'cortex');
});

test('visualization overlays cover flow, density, heat, dependencies, runner, and emitters', () => {
  const scene = buildCambiumScene('visualizations');
  const overlays = createVisualizationOverlaySpecs(scene.visualizationLayers);
  assert.deepEqual(overlays.map((overlay) => overlay.role), [
    'flow-map',
    'signal-density',
    'process-heat',
    'dependency-graph',
    'runner-status',
    'emitter-status',
  ]);
});
