import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatorPath = path.join(repositoryRoot, 'scripts/generate-intent-graph.mjs');
let sourceApi = null;

try {
  sourceApi = await import('./intent-graph-sources.mjs');
} catch {
  // RED must fail through a named contract assertion, never module resolution.
}

function requireSourceApi(label) {
  assert.ok(sourceApi?.buildIntentGraphSources, `${label}: generator source model is not implemented`);
  return sourceApi;
}

function runGenerator(root, args, { succeeds = true } = {}) {
  const result = spawnSync(process.execPath, [generatorPath, '--root', root, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (succeeds) {
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } else {
    assert.notEqual(result.status, 0, 'generator was expected to fail');
  }
  return result;
}

function declaredSourcePaths(model) {
  const paths = new Set();
  for (const node of model.nodes) {
    paths.add(node.source.path);
    for (const anchor of node.anchorReferences ?? []) paths.add(anchor.path);
    if (node.state.stopCondition.sourcePath) paths.add(node.state.stopCondition.sourcePath);
  }
  for (const edge of model.edges) paths.add(edge.source.path);
  return [...paths].sort();
}

function makeRepositoryFixture() {
  const api = requireSourceApi('readback fixture');
  const model = api.buildIntentGraphSources(repositoryRoot);
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-intent-readback-'));
  for (const relativePath of declaredSourcePaths(model)) {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.join(repositoryRoot, relativePath)));
  }
  return {
    root,
    json: path.join(root, 'docs/architecture/intent-graph.v1.json'),
    markdown: path.join(root, 'docs/architecture/intent-graph.md'),
    sourcePaths: declaredSourcePaths(model),
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

function outputArgs(fixture, mode) {
  return [
    mode,
    '--json-output', fixture.json,
    '--markdown-output', fixture.markdown,
  ];
}

function snapshotSources(fixture) {
  return Object.fromEntries(fixture.sourcePaths.map((relativePath) => [
    relativePath,
    readFileSync(path.join(fixture.root, relativePath)),
  ]));
}

function assertSourcesUnchanged(fixture, before) {
  for (const [relativePath, bytes] of Object.entries(before)) {
    assert.deepEqual(readFileSync(path.join(fixture.root, relativePath)), bytes, relativePath);
  }
}

test('actual repository source model compiles the complete authority chain', () => {
  const api = requireSourceApi('actual-source generator contract');
  const result = runGenerator(repositoryRoot, ['--json']);
  const graph = JSON.parse(result.stdout);
  const model = api.buildIntentGraphSources(repositoryRoot);

  assert.equal(result.stderr, '');
  assert.equal(graph.schema, 'cambium.intent-graph-projection.v1');
  assert.equal(graph.projectionAuthority, 'read_only');
  assert.equal(graph.nodes.length, model.nodes.length);
  assert.equal(graph.edges.length, model.edges.length);
  assert.deepEqual(new Set(graph.nodes.map(({ kind }) => kind)), new Set([
    'vision', 'mission', 'goal', 'task', 'evidence', 'learning', 'overlay', 'gate',
  ]));
  assert.deepEqual(new Set(graph.edges.map(({ kind }) => kind)), new Set([
    'directs', 'scopes', 'decomposes', 'proves', 'produces', 'closes',
    'renews', 'informs', 'references', 'gates',
  ]));
  assert.equal(api.INTENT_GRAPH_AUTHORITY_BOUNDARIES.d1GoalGraph.role, 'sole_operational_writer');
  assert.equal(api.INTENT_GRAPH_AUTHORITY_BOUNDARIES.intentGraph.role, 'read_only_projection');
});

test('write is byte-idempotent, check is read-only, and declared sources are preserved', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  const before = snapshotSources(fixture);

  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const firstJson = readFileSync(fixture.json);
  const firstMarkdown = readFileSync(fixture.markdown);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  assert.deepEqual(readFileSync(fixture.json), firstJson);
  assert.deepEqual(readFileSync(fixture.markdown), firstMarkdown);

  runGenerator(fixture.root, outputArgs(fixture, '--check'));
  runGenerator(fixture.root, outputArgs(fixture, '--check'));
  assert.deepEqual(readFileSync(fixture.json), firstJson);
  assert.deepEqual(readFileSync(fixture.markdown), firstMarkdown);
  assertSourcesUnchanged(fixture, before);
});

test('JSON and Markdown readbacks carry identical digests, IDs, and state facts', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const graph = JSON.parse(readFileSync(fixture.json, 'utf8'));
  const markdown = readFileSync(fixture.markdown, 'utf8');

  for (const value of [
    graph.schema,
    graph.graphDigest,
    graph.sourceSetDigest,
    ...graph.nodes.map(({ id }) => id),
    ...graph.edges.map(({ id }) => id),
  ]) assert.ok(markdown.includes(value), value);
  for (const node of graph.nodes) {
    for (const fact of [
      node.state.completion,
      node.state.approval,
      node.state.freshness,
      node.state.stopCondition.kind,
      String(node.state.stopCondition.satisfied),
    ]) assert.ok(markdown.includes(fact), `${node.id}: ${fact}`);
  }
  const gate = graph.nodes.find(({ kind }) => kind === 'gate');
  assert.equal(gate.state.completion, 'blocked');
  assert.notEqual(gate.state.completion, 'satisfied');
});

test('stale output and selected-source drift fail check with exact paths and selectors', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));

  writeFileSync(fixture.markdown, `${readFileSync(fixture.markdown, 'utf8')}stale\n`, 'utf8');
  let result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
  assert.match(result.stderr, /docs\/architecture\/intent-graph\.md/);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));

  const roadmap = path.join(fixture.root, '.planning/ROADMAP.md');
  writeFileSync(roadmap, readFileSync(roadmap, 'utf8').replace(
    '**Goal**: Operators can inspect a deterministic intent graph whose references preserve authority from enduring purpose through verified learning.',
    '**Goal**: Operators can inspect a changed deterministic intent graph.',
  ), 'utf8');
  result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
  assert.match(result.stderr, /\.planning\/ROADMAP\.md/);
  assert.match(result.stderr, /markdown\.bold-field:Phase 4: Provenance-Preserving Intent Graph#Goal/);
});

test('missing source fails closed with the affected repository-relative path', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  rmSync(path.join(fixture.root, '.planning/phases/03-canonical-infinite-game-anchors/03-VERIFICATION.md'));
  const result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
  assert.match(result.stderr, /\.planning\/phases\/03-canonical-infinite-game-anchors\/03-VERIFICATION\.md/);
  assert.match(result.stderr, /missing/);
});

test('tracking-only ROADMAP and ISA mutations leave generated bytes unchanged', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const beforeJson = readFileSync(fixture.json);
  const beforeMarkdown = readFileSync(fixture.markdown);

  const roadmap = path.join(fixture.root, '.planning/ROADMAP.md');
  writeFileSync(roadmap, readFileSync(roadmap, 'utf8')
    .replace('- [ ] 04-02-PLAN.md', '- [x] 04-02-PLAN.md')
    .replace('| 4. Provenance-Preserving Intent Graph | v0.4 | 1/3 | In Progress|', '| 4. Provenance-Preserving Intent Graph | v0.4 | 2/3 | In Progress|'), 'utf8');
  const isa = path.join(fixture.root, 'ISA.md');
  writeFileSync(isa, readFileSync(isa, 'utf8')
    .replace('phase: plan', 'phase: execute')
    .replace('progress: 0/5', 'progress: 2/5')
    .replace('updated: 2026-08-18T06:25:56+05:30', 'updated: 2026-08-18T07:00:00+05:30'), 'utf8');

  runGenerator(fixture.root, outputArgs(fixture, '--check'));
  assert.deepEqual(readFileSync(fixture.json), beforeJson);
  assert.deepEqual(readFileSync(fixture.markdown), beforeMarkdown);
});

test('selected ISA task mutation makes check stale and names frontmatter.task', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const isa = path.join(fixture.root, 'ISA.md');
  const isaSource = readFileSync(isa, 'utf8');
  const activeTask = isaSource.match(/^task: "([^"]+)"$/m);
  assert.ok(activeTask, 'fixture ISA must expose one quoted frontmatter task');
  writeFileSync(isa, isaSource.replace(
    activeTask[0],
    `task: "Mutated for freshness proof: ${activeTask[1]}"`,
  ), 'utf8');
  const result = runGenerator(fixture.root, outputArgs(fixture, '--check'), { succeeds: false });
  assert.match(result.stderr, /ISA\.md/);
  assert.match(result.stderr, /frontmatter\.task/);
});

test('outputs exclude doctrine bodies, local paths, secrets, and projection foldback sources', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  runGenerator(fixture.root, outputArgs(fixture, '--write'));
  const graph = JSON.parse(readFileSync(fixture.json, 'utf8'));
  const combined = `${readFileSync(fixture.json, 'utf8')}\n${readFileSync(fixture.markdown, 'utf8')}`;
  const tuples = graph.nodes.map(({ source }) => `${source.path}#${source.selector}`);

  assert.doesNotMatch(combined, /continued meaningful play through coordinated finite games/i);
  assert.doesNotMatch(combined, /Establish a provenance-preserving infinite-game architecture in which canonical doctrine/i);
  assert.equal(combined.includes(fixture.root), false);
  assert.doesNotMatch(combined, /AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
  assert.ok(tuples.every((tuple) => !tuple.startsWith('.planning/STATE.md#')));
  assert.ok(tuples.every((tuple) => !tuple.includes('intent-graph.v1.json') && !tuple.includes('intent-graph.md')));
  assert.ok(tuples.every((tuple) => !/ROADMAP\.md#.*(?:Plans|checkbox|status)/i.test(tuple)));
  assert.ok(tuples.every((tuple) => !/ISA\.md#frontmatter\.(?:phase|progress|updated)/.test(tuple)));
});

test('write refuses projection outputs outside the real repository root', (t) => {
  const fixture = makeRepositoryFixture();
  t.after(fixture.cleanup);
  const outside = path.join(tmpdir(), `intent-graph-outside-${process.pid}.json`);
  const result = runGenerator(fixture.root, [
    '--write', '--json-output', outside, '--markdown-output', fixture.markdown,
  ], { succeeds: false });
  assert.match(result.stderr, /outside|escape|repository root/i);
});

test('committed repository readbacks are current', () => {
  requireSourceApi('committed readback check');
  execFileSync(process.execPath, [generatorPath, '--check'], { cwd: repositoryRoot, stdio: 'pipe' });
});
