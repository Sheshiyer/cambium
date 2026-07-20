import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSTELLATION_ACCENTS,
  buildConstellationLayout,
  type TapestrySnapshot,
} from './constellation-layout.ts';

function makeSnapshot(nodes: TapestrySnapshot['nodes']): TapestrySnapshot {
  return {
    tenant: {
      id: 'thoughtseed',
      label: 'Thoughtseed',
      vision: 'Cultivate living knowledge systems for resilient ventures',
      mission: 'Grow the grove',
    },
    recursion: ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio'],
    field: { id: 'cambium-field', width: 15.8, depth: 10.6 },
    nodes,
  };
}

const organNodes: TapestrySnapshot['nodes'] = [
  { id: 'cortex', organ: 'cortex', title: 'Cortex', scale: 'organ', x: 0, z: 0, status: 'active', inputs: [], outputs: [] },
  { id: 'genesis', organ: 'genesis', title: 'Genesis', scale: 'organ', x: -4.8, z: -1.2, status: 'complete', inputs: [], outputs: [] },
  { id: 'signal', organ: 'signal', title: 'Signal', scale: 'organ', x: 3.1, z: 2.4, status: 'active', inputs: [], outputs: [] },
  { id: 'harvest', organ: 'harvest', title: 'Harvest', scale: 'organ', x: 1.2, z: -3.8, status: 'active', inputs: [], outputs: [] },
];

const branchNodes: TapestrySnapshot['nodes'] = [
  { id: 'genesis-seed', organ: 'genesis', title: 'Seed Rites', scale: 'cluster', x: -4.5, z: -1.0, status: 'active', inputs: [], outputs: [] },
  { id: 'genesis-spark', organ: 'genesis', title: 'First Spark', scale: 'skill', x: -5.0, z: -1.4, status: 'draft', inputs: [], outputs: [] },
  { id: 'signal-beacon', organ: 'signal', title: 'Beacon', scale: 'cluster', x: 3.0, z: 2.2, status: 'active', inputs: [], outputs: [] },
];

test('non-cortex hubs sit on a ring at equal angles with cortex at center', () => {
  const layout = buildConstellationLayout(makeSnapshot(organNodes));
  const cortex = layout.clusters.find((cluster) => cluster.hubId === 'cortex');
  assert.ok(cortex);
  assert.deepEqual(cortex.nodes[0].position, [0, 0, 0]);

  const ringClusters = layout.clusters.filter((cluster) => cluster.hubId !== 'cortex');
  const ringRadius = 15.8 / 2.2;
  for (const cluster of ringClusters) {
    const hub = cluster.nodes.find((node) => node.depth === 0);
    assert.ok(hub);
    const distance = Math.hypot(hub.position[0], hub.position[2]);
    assert.ok(Math.abs(distance - ringRadius) < 1e-9);
  }

  const angles = ringClusters.map((cluster) => {
    const hub = cluster.nodes.find((node) => node.depth === 0);
    return Math.atan2(hub!.position[2], hub!.position[0]);
  });
  const expectedStep = (Math.PI * 2) / ringClusters.length;
  for (let i = 1; i < angles.length; i += 1) {
    const delta = (angles[i] - angles[i - 1] + Math.PI * 2) % (Math.PI * 2);
    assert.ok(Math.abs(delta - expectedStep) < 1e-9);
  }
});

test('cortex cluster receives the depth accent and ring clusters use palette order', () => {
  const layout = buildConstellationLayout(makeSnapshot(organNodes));
  const cortex = layout.clusters.find((cluster) => cluster.hubId === 'cortex');
  assert.equal(cortex?.accent, 'depth');
  const ringClusters = layout.clusters.filter((cluster) => cluster.hubId !== 'cortex');
  ringClusters.forEach((cluster, index) => {
    assert.equal(cluster.accent, CONSTELLATION_ACCENTS[index % CONSTELLATION_ACCENTS.length]);
  });
});

test('layout is deterministic across repeated builds', () => {
  const snapshot = makeSnapshot([...organNodes, ...branchNodes]);
  const first = buildConstellationLayout(snapshot);
  const second = buildConstellationLayout(snapshot);
  assert.deepEqual(first, second);
});

test('dendrite trees stay within four levels and edges reference real nodes', () => {
  const layout = buildConstellationLayout(makeSnapshot([...organNodes, ...branchNodes]));
  for (const cluster of layout.clusters) {
    const ids = new Set(cluster.nodes.map((node) => node.id));
    for (const node of cluster.nodes) {
      assert.ok(node.depth <= 4, `node ${node.id} exceeds depth 4`);
      if (node.depth > 0) {
        assert.ok(node.parentId && ids.has(node.parentId));
      }
    }
    for (const [from, to] of cluster.edges) {
      assert.ok(ids.has(from), `edge source ${from} missing`);
      assert.ok(ids.has(to), `edge target ${to} missing`);
    }
  }
});

test('branch nodes attach to their organ cluster with hub-to-child edges', () => {
  const layout = buildConstellationLayout(makeSnapshot([...organNodes, ...branchNodes]));
  const genesis = layout.clusters.find((cluster) => cluster.hubId === 'genesis');
  assert.ok(genesis);
  const seed = genesis.nodes.find((node) => node.id === 'genesis-seed');
  assert.ok(seed);
  assert.equal(seed.parentId, 'genesis');
  assert.equal(seed.depth, 1);
  assert.ok(genesis.edges.some(([from, to]) => from === 'genesis' && to === 'genesis-seed'));
});

test('placeholder branches are synthesized when a hub has no children', () => {
  const layout = buildConstellationLayout(makeSnapshot(organNodes));
  for (const cluster of layout.clusters) {
    const placeholders = cluster.nodes.filter((node) => node.status === 'placeholder');
    assert.ok(placeholders.length >= 3 && placeholders.length <= 5, `${cluster.hubId} placeholder count`);
    assert.ok(placeholders.every((node) => node.depth === 1 && node.parentId === cluster.hubId));
  }
});

test('empty snapshot returns no clusters', () => {
  const layout = buildConstellationLayout(makeSnapshot([]));
  assert.deepEqual(layout.center, [0, 0, 0]);
  assert.deepEqual(layout.clusters, []);
});
