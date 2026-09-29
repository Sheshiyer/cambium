import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const VALIDATOR = join(REPO_ROOT, 'scripts/validate-ecosystem-graph.mjs');
const SCHEMA = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-graph.v1.schema.json');
const GRAPH = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-graph.v1.json');

function runValidator(graphPath, schemaPath = SCHEMA) {
  return spawnSync(process.execPath, [VALIDATOR, '--schema', schemaPath, '--graph', graphPath], {
    encoding: 'utf8'
  });
}

function withTempGraph(mutator, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ecosystem-graph-'));
  const tempGraph = join(tempRoot, 'ecosystem-graph.v1.json');
  try {
    const original = JSON.parse(readFileSync(GRAPH, 'utf8'));
    const mutated = mutator(original);
    writeFileSync(tempGraph, JSON.stringify(mutated, null, 2));
    return fn(tempGraph);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test('the committed ecosystem graph validates cleanly', () => {
  const result = runValidator(GRAPH);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /ecosystem-graph OK/);
});

test('rejects a graph whose authority is not proposal-only', () => {
  const result = withTempGraph(
    (graph) => ({ ...graph, authority: 'live' }),
    (path) => runValidator(path)
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /proposal-only/);
});

test('rejects a node missing a required field', () => {
  const result = withTempGraph(
    (graph) => {
      const nodes = graph.nodes.map((node, index) => (index === 0 ? { id: node.id, kind: node.kind } : node));
      return { ...graph, nodes };
    },
    (path) => runValidator(path)
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing required property "status"/);
});

test('rejects an edge with an invalid evidence value', () => {
  const result = withTempGraph(
    (graph) => {
      const edges = graph.edges.map((edge, index) => (index === 0 ? { ...edge, evidence: 'maybe' } : edge));
      return { ...graph, edges };
    },
    (path) => runValidator(path)
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid evidence|expected one of/);
});

test('rejects an edge whose endpoint does not match a declared node', () => {
  const result = withTempGraph(
    (graph) => {
      const edges = graph.edges.map((edge, index) => (index === 0 ? { ...edge, to: 'nonexistent-node' } : edge));
      return { ...graph, edges };
    },
    (path) => runValidator(path)
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match any node id/);
});

test('rejects duplicate node ids', () => {
  const result = withTempGraph(
    (graph) => ({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }),
    (path) => runValidator(path)
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate node id/);
});

test('every edge in the committed graph is graded doc-inferred or code-verified', () => {
  const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));
  for (const edge of graph.edges) {
    assert.ok(
      edge.evidence === 'doc-inferred' || edge.evidence === 'code-verified',
      `edge ${edge.from}->${edge.to} has evidence "${edge.evidence}"`
    );
  }
});
