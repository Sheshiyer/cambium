import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateLeadOps } from './lib/lead-ops.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const graphPath = join(here, '..', 'composition', 'lead-ops.v1.json');
const clone = (value) => structuredClone(value);

async function canonicalGraph() {
  return JSON.parse(await readFile(graphPath, 'utf8'));
}

test('canonical lead operations graph is valid and preserves the six exact stages', async () => {
  const graph = await canonicalGraph();
  const result = validateLeadOps(graph);

  assert.deepEqual(result.stages, [
    'discover',
    'capture',
    'enrich',
    'understand',
    'create',
    'engage',
  ]);
  assert.deepEqual(result.entryNodes, ['discover']);
  assert.deepEqual(result.terminalNodes, ['engage']);
});

test('canonical graph makes Cambium the authority for task, lease, fencing, approval, and receipt', async () => {
  const graph = await canonicalGraph();
  const { authority } = validateLeadOps(graph);

  assert.equal(authority.system, 'cambium');
  assert.deepEqual(Object.keys(authority.primitives).sort(), [
    'approval',
    'fencing',
    'lease',
    'receipt',
    'task',
  ]);
  for (const primitive of Object.values(authority.primitives)) {
    assert.equal(primitive.owner, 'cambium');
  }
  assert.deepEqual(authority.non_authoritative_planes.sort(), [
    'capability',
    'hermes',
    'provider',
  ]);
});

test('canonical graph defines typed fan-out, joins, partial failure, reconciliation, and derived-only learning', async () => {
  const graph = await canonicalGraph();
  const result = validateLeadOps(graph);

  assert.ok(result.fanOuts.some((fanOut) => fanOut.targets.length >= 2));
  assert.ok(result.joins.some((join) => join.node === 'understand'));
  assert.ok(result.joins.some((join) => join.node === 'engage'));
  assert.equal(result.reconciliation.required, true);
  assert.equal(result.reconciliation.on_partial_failure, 'record-and-reconcile');
  assert.equal(result.learningFoldback.mode, 'derived-only');
  assert.equal(result.learningFoldback.target, 'cortex');
  assert.equal(result.learningFoldback.raw_identity, false);
  assert.equal(result.learningFoldback.authoritative, false);
});

test('rejects a cycle', async () => {
  const graph = clone(await canonicalGraph());
  graph.edges.push({
    from: 'engage',
    to: 'capture',
    contracts: ['operator_receipt@1.0.0'],
  });
  graph.nodes.find((node) => node.id === 'capture').entry_contracts.push('operator_receipt@1.0.0');

  assert.throws(() => validateLeadOps(graph), /cycle/i);
});

test('rejects dangling edge endpoints', async () => {
  const graph = clone(await canonicalGraph());
  graph.edges.push({
    from: 'discover',
    to: 'missing-stage',
    contracts: ['provider_observation@1.0.0'],
  });

  assert.throws(() => validateLeadOps(graph), /dangling.*missing-stage/i);
});

test('rejects unreachable nodes', async () => {
  const graph = clone(await canonicalGraph());
  graph.edges = graph.edges.filter((edge) => edge.to !== 'capture');

  assert.throws(() => validateLeadOps(graph), /unreachable.*capture/i);
});

test('rejects illegal topological stage order', async () => {
  const graph = clone(await canonicalGraph());
  [graph.stages[1], graph.stages[2]] = [graph.stages[2], graph.stages[1]];

  assert.throws(() => validateLeadOps(graph), /stage order/i);
});

test('rejects duplicate output ownership', async () => {
  const graph = clone(await canonicalGraph());
  graph.nodes.find((node) => node.id === 'capture').exit_contracts.push('provider_observation@1.0.0');

  assert.throws(() => validateLeadOps(graph), /duplicate output ownership.*provider_observation/i);
});

test('rejects joins whose required contracts are not supplied', async () => {
  const graph = clone(await canonicalGraph());
  const edge = graph.edges.find((candidate) => candidate.from === 'capture' && candidate.to === 'understand');
  edge.contracts = [];

  assert.throws(() => validateLeadOps(graph), /unsatisfied join.*understand.*source_alias/i);
});

test('rejects nodes without a path to a declared terminal', async () => {
  const graph = clone(await canonicalGraph());
  graph.edges = graph.edges.filter((edge) => edge.from !== 'create');

  assert.throws(() => validateLeadOps(graph), /terminal path.*create/i);
});

test('rejects unknown contract versions', async () => {
  const graph = clone(await canonicalGraph());
  graph.nodes.find((node) => node.id === 'capture').exit_contracts[0] = 'lead_record@2.0.0';

  assert.throws(() => validateLeadOps(graph), /unknown contract version.*2\.0\.0/i);
});

test('rejects missing entry eligibility gates', async () => {
  const graph = clone(await canonicalGraph());
  delete graph.nodes.find((node) => node.id === 'enrich').eligibility.entry;

  assert.throws(() => validateLeadOps(graph), /enrich.*entry eligibility gate/i);
});

test('rejects missing exit eligibility gates', async () => {
  const graph = clone(await canonicalGraph());
  delete graph.nodes.find((node) => node.id === 'engage').eligibility.exit;

  assert.throws(() => validateLeadOps(graph), /engage.*exit eligibility gate/i);
});

test('rejects raw or authoritative cortex foldback', async () => {
  const rawGraph = clone(await canonicalGraph());
  rawGraph.learning_foldback.raw_identity = true;
  assert.throws(() => validateLeadOps(rawGraph), /derived-only.*raw identity/i);

  const authorityGraph = clone(await canonicalGraph());
  authorityGraph.learning_foldback.authoritative = true;
  assert.throws(() => validateLeadOps(authorityGraph), /derived-only.*authoritative/i);
});

test('rejects absent reconciliation semantics', async () => {
  const graph = clone(await canonicalGraph());
  graph.reconciliation.required = false;

  assert.throws(() => validateLeadOps(graph), /reconciliation.*required/i);
});
