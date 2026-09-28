import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const PROBE = join(REPO_ROOT, 'scripts/ecosystem-liveness-probe.mjs');
const GRAPH = join(REPO_ROOT, 'docs/architecture/contracts/ecosystem-graph.v1.json');

test('probe writes a separate output file and never touches the graph file', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ecosystem-liveness-'));
  const output = join(tempRoot, 'liveness.json');
  const ecosystemRoot = join(tempRoot, 'ecosystem');
  mkdirSync(ecosystemRoot, { recursive: true });

  const graphBefore = readFileSync(GRAPH, 'utf8');
  try {
    const result = spawnSync(
      process.execPath,
      [PROBE, '--graph', GRAPH, '--output', output, '--ecosystem-root', ecosystemRoot],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(existsSync(output), 'expected liveness output file to be written');

    const liveness = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(liveness.schema, 'thoughtseed.ecosystem-liveness.v1');
    assert.equal(liveness.authority, 'proposal-only');
    assert.deepEqual(liveness.allowedPorts, [8766, 31337, 20128]);
    assert.ok(Array.isArray(liveness.repos));
    assert.ok(Array.isArray(liveness.ports));
    assert.equal(liveness.ports.length, 3);
    for (const portEntry of liveness.ports) {
      assert.ok([8766, 31337, 20128].includes(portEntry.port));
    }

    const graphAfter = readFileSync(GRAPH, 'utf8');
    assert.equal(graphAfter, graphBefore, 'graph file must not be modified by the liveness probe');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('probe reports directory-not-found for repos that do not exist under ecosystem-root', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ecosystem-liveness-'));
  const output = join(tempRoot, 'liveness.json');
  const ecosystemRoot = join(tempRoot, 'empty-ecosystem');
  mkdirSync(ecosystemRoot, { recursive: true });

  try {
    const result = spawnSync(
      process.execPath,
      [PROBE, '--graph', GRAPH, '--output', output, '--ecosystem-root', ecosystemRoot],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const liveness = JSON.parse(readFileSync(output, 'utf8'));
    assert.ok(liveness.repos.length > 0);
    for (const repo of liveness.repos) {
      assert.equal(repo.checked, false);
      assert.equal(repo.reason, 'directory-not-found');
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('probe only ever checks the fixed port allow-list', () => {
  const source = readFileSync(PROBE, 'utf8');
  assert.match(source, /ALLOWED_PORTS = \[8766, 31337, 20128\]/);
});
