import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

let subject = null;
try {
  subject = await import('./intent-graph.mjs');
} catch {
  // RED must be a named contract failure, never an unhandled module error.
}

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const NODE_ID = /^intent_[a-f0-9]{64}$/;
const EDGE_ID = /^intent_edge_[a-f0-9]{64}$/;

function requireSubject(requirement) {
  assert.ok(subject, `${requirement}: intent graph compiler contract is not implemented`);
  return subject;
}

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function makeRepository() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-intent-graph-'));
  const files = {
    'VISION.md': '# Vision\r\n\r\n## Just Cause\r\nContinue meaningful play.\r\n',
    'MISSION.md': '# Mission\n\n## Current pursuit\nPreserve provenance.\n',
    'ISA.md': [
      '---',
      'task: Build the provenance intent graph',
      'phase: plan',
      'progress: 0/5',
      'updated: 2026-08-18',
      '---',
      '',
      '# ISA',
      '',
      '- [ ] Reviewed Phase 4 gate: execution remains approval-bound',
      '',
    ].join('\n'),
    '.planning/ROADMAP.md': [
      '# Roadmap',
      '',
      '### Phase 4: Provenance-Preserving Intent Graph',
      '**Goal**: Operators inspect one deterministic graph.',
      '**Status**: Ready',
      '- [ ] 04-01-PLAN.md',
      '',
      '### Another Phase',
      '**Goal**: A similarly named field that must not match.',
      '',
    ].join('\n'),
    '.planning/STATE.md': '# Generated planning state\n',
    '.planning/phases/04/04-01-PLAN.md': [
      '<tasks>',
      '<task type="auto">',
      '  <name>Task 1: Compile the graph</name>',
      '  <action>Compile a read-only projection.</action>',
      '</task>',
      '</tasks>',
      '',
    ].join('\n'),
    'docs/evidence.md': '# Evidence\n\nVerified compiler behavior.\n',
    'docs/learning.md': '# Learning\n\nVerified facts inform review.\n',
    'docs/overlay.md': '# Overlay\n\nReferences only.\n',
    'docs/architecture/intent-graph.v1.json': '{}\n',
    'docs/architecture/intent-graph.md': '# Generated\n',
  };

  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body, 'utf8');
  }

  const outside = mkdtempSync(path.join(tmpdir(), 'cambium-intent-outside-'));
  writeFileSync(path.join(outside, 'secret.md'), 'outside\n', 'utf8');
  symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'docs', 'escape.md'));

  return {
    root,
    outside,
    files,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    },
  };
}

const completeState = (overrides = {}) => ({
  completion: 'pending',
  approval: 'not_required',
  freshness: 'fresh',
  blockedReason: null,
  stopCondition: {
    kind: 'none',
    sourcePath: null,
    selector: null,
    satisfied: false,
  },
  ...overrides,
});

function source(pathname, authority, selector, selectedContent) {
  return { path: pathname, authority, selector, digest: digest(selectedContent) };
}

function edgeSource(pathname, selector, selectedContent) {
  return { path: pathname, selector, digest: digest(selectedContent) };
}

function validInput() {
  const visionSection = '## Just Cause\nContinue meaningful play.\n';
  const missionSection = '## Current pursuit\nPreserve provenance.\n';
  const roadmapGoal = '**Goal**: Operators inspect one deterministic graph.\n';
  const isaTask = 'task: Build the provenance intent graph\n';
  const planTask = [
    '<task type="auto">',
    '  <name>Task 1: Compile the graph</name>',
    '  <action>Compile a read-only projection.</action>',
    '</task>',
    '',
  ].join('\n');
  const gateLine = '- [ ] Reviewed Phase 4 gate: execution remains approval-bound\n';
  const evidence = '# Evidence\n\nVerified compiler behavior.\n';
  const learning = '# Learning\n\nVerified facts inform review.\n';
  const overlay = '# Overlay\n\nReferences only.\n';

  const nodes = [
    {
      key: 'vision', kind: 'vision', lifecycle: 'enduring',
      source: source('VISION.md', 'vision_anchor', 'markdown.heading:Just Cause', visionSection),
      state: completeState({ completion: 'not_applicable' }),
    },
    {
      key: 'mission', kind: 'mission', lifecycle: 'renewable',
      source: source('MISSION.md', 'repository_mission', 'markdown.heading:Current pursuit', missionSection),
      state: completeState({ completion: 'pending', stopCondition: {
        kind: 'mission_review', sourcePath: 'MISSION.md', selector: 'markdown.heading:Current pursuit', satisfied: false,
      } }),
    },
    {
      key: 'goal-phase-4', kind: 'goal', lifecycle: 'finite',
      source: source('.planning/ROADMAP.md', 'gsd_planning', 'markdown.bold-field:Phase 4: Provenance-Preserving Intent Graph#Goal', roadmapGoal),
      state: completeState({ completion: 'pending', stopCondition: {
        kind: 'finite_goal', sourcePath: '.planning/ROADMAP.md', selector: 'markdown.bold-field:Phase 4: Provenance-Preserving Intent Graph#Goal', satisfied: false,
      } }),
    },
    {
      key: 'goal-approved', kind: 'goal', lifecycle: 'finite',
      source: source('ISA.md', 'isa_acceptance', 'frontmatter.task', isaTask),
      state: completeState({ completion: 'pending', approval: 'approved' }),
    },
    {
      key: 'task', kind: 'task', lifecycle: 'planned',
      source: source('.planning/phases/04/04-01-PLAN.md', 'gsd_planning', 'xml.task-name:Task 1: Compile the graph', planTask),
      state: completeState(),
    },
    {
      key: 'evidence', kind: 'evidence', lifecycle: 'verified',
      source: source('docs/evidence.md', 'verification_evidence', 'whole-file', evidence),
      state: completeState({ completion: 'satisfied', stopCondition: {
        kind: 'external_verification', sourcePath: 'docs/evidence.md', selector: 'whole-file', satisfied: true,
      } }),
    },
    {
      key: 'learning', kind: 'learning', lifecycle: 'historical',
      source: source('docs/learning.md', 'historical_learning', 'whole-file', learning),
      state: completeState({ completion: 'satisfied' }),
    },
    {
      key: 'overlay', kind: 'overlay', lifecycle: 'derived',
      source: source('docs/overlay.md', 'derived_reference', 'whole-file', overlay),
      anchorReferences: [
        { path: 'VISION.md', digest: digest('# Vision\n\n## Just Cause\nContinue meaningful play.\n') },
        { path: 'MISSION.md', digest: digest('# Mission\n\n## Current pursuit\nPreserve provenance.\n') },
      ],
      state: completeState({ completion: 'not_applicable' }),
    },
    {
      key: 'gate', kind: 'gate', lifecycle: 'gated',
      source: source('ISA.md', 'isa_acceptance', 'markdown.list-item:- [ ] Reviewed Phase 4 gate:', gateLine),
      state: completeState({
        completion: 'blocked', approval: 'required', blockedReason: 'Reviewed execution approval is still required.',
        stopCondition: {
          kind: 'approval_boundary', sourcePath: 'ISA.md', selector: 'markdown.list-item:- [ ] Reviewed Phase 4 gate:', satisfied: false,
        },
      }),
    },
  ];

  const byKey = Object.fromEntries(nodes.map((node) => [node.key, node]));
  const e = (from, kind, to) => ({
    from, kind, to,
    source: edgeSource(byKey[from].source.path, byKey[from].source.selector,
      from === 'vision' ? visionSection
        : from === 'mission' ? missionSection
          : from === 'goal-phase-4' ? roadmapGoal
            : from === 'task' ? planTask
              : from === 'evidence' ? evidence
                : from === 'learning' ? learning
                  : from === 'overlay' ? overlay
                    : gateLine),
  });

  return {
    nodes,
    edges: [
      e('vision', 'directs', 'mission'),
      e('mission', 'scopes', 'goal-phase-4'),
      e('goal-phase-4', 'decomposes', 'task'),
      e('task', 'proves', 'evidence'),
      e('evidence', 'produces', 'learning'),
      e('evidence', 'closes', 'goal-phase-4'),
      e('gate', 'renews', 'goal-approved'),
      e('learning', 'informs', 'gate'),
      e('overlay', 'references', 'vision'),
      e('overlay', 'references', 'mission'),
      e('gate', 'gates', 'goal-approved'),
    ],
  };
}

function compile(root, input = validInput()) {
  return requireSubject('GRAPH-01 / ISC-1277').compileIntentGraph({ repositoryRoot: root, ...input });
}

test('GRAPH-01 / ISC-1277: semantic input order produces byte-stable IDs, ordering, and digests', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const api = requireSubject('GRAPH-01 / ISC-1277');
  const input = validInput();
  const first = compile(repo.root, input);
  const permuted = compile(repo.root, { nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() });

  assert.equal(api.INTENT_GRAPH_SCHEMA, 'cambium.intent-graph-projection.v1');
  assert.equal(first.schema, api.INTENT_GRAPH_SCHEMA);
  assert.equal(first.projectionAuthority, 'read_only');
  assert.deepEqual(first, permuted);
  assert.deepEqual(first.nodes.map(({ id }) => id), [...first.nodes.map(({ id }) => id)].sort());
  assert.deepEqual(first.edges.map(({ id }) => id), [...first.edges.map(({ id }) => id)].sort());
  assert.ok(first.nodes.every(({ id }) => NODE_ID.test(id)));
  assert.ok(first.edges.every(({ id }) => EDGE_ID.test(id)));
  assert.match(first.sourceSetDigest, SHA256);
  assert.match(first.graphDigest, SHA256);
  assert.deepEqual(api.validateIntentGraphProjection(first), first);
});

test('GRAPH-02 / ISC-1278: canonical source provenance is complete and content-addressed', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const graph = compile(repo.root);

  for (const node of graph.nodes) {
    assert.deepEqual(Object.keys(node.source).sort(), ['authority', 'digest', 'path', 'selector']);
    assert.equal(path.isAbsolute(node.source.path), false);
    assert.match(node.source.digest, SHA256);
    assert.ok(node.source.selector.length > 0);
    assert.ok(node.lifecycle.length > 0);
    assert.deepEqual(Object.keys(node.state).sort(), ['approval', 'blockedReason', 'completion', 'freshness', 'stopCondition']);
  }
  assert.equal(graph.nodes.find(({ kind }) => kind === 'vision').source.digest,
    digest('## Just Cause\nContinue meaningful play.\n'));
});

test('GRAPH-02 / ISC-1278: unsafe paths, stale digests, and ambiguous selectors fail closed', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const base = validInput();
  const vision = base.nodes.find(({ key }) => key === 'vision');
  const invalidSources = [
    { ...vision.source, path: path.join(repo.root, 'VISION.md') },
    { ...vision.source, path: '../outside.md' },
    { ...vision.source, path: 'docs/escape.md' },
    { ...vision.source, path: 'docs/missing.md' },
    { ...vision.source, path: 'docs' },
    { ...vision.source, digest: digest('tampered') },
    { ...vision.source, selector: 'markdown.heading:Missing' },
  ];
  for (const sourceValue of invalidSources) {
    const input = structuredClone(base);
    input.nodes.find(({ key }) => key === 'vision').source = sourceValue;
    assert.throws(() => compile(repo.root, input));
  }

  writeFileSync(path.join(repo.root, 'docs', 'ambiguous.md'), '- fact: one\n- fact: two\n', 'utf8');
  const ambiguous = structuredClone(base);
  ambiguous.nodes.find(({ key }) => key === 'vision').source = {
    path: 'docs/ambiguous.md', authority: 'vision_anchor',
    selector: 'markdown.list-item:- fact:', digest: digest('- fact: one\n'),
  };
  assert.throws(() => compile(repo.root, ambiguous), /exactly once|ambiguous|multiple/i);
});

test('selector stability: tracking mutations cannot stale selected ROADMAP Goal or ISA task', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const baseline = compile(repo.root);
  const selected = (graph, authority) => graph.nodes.find((node) => node.source.authority === authority && node.kind === 'goal');

  writeFileSync(path.join(repo.root, '.planning/ROADMAP.md'), repo.files['.planning/ROADMAP.md']
    .replace('**Status**: Ready', '**Status**: Executing')
    .replace('- [ ] 04-01-PLAN.md', '- [x] 04-01-PLAN.md'), 'utf8');
  writeFileSync(path.join(repo.root, 'ISA.md'), repo.files['ISA.md']
    .replace('phase: plan', 'phase: execute')
    .replace('progress: 0/5', 'progress: 1/5')
    .replace('updated: 2026-08-18', 'updated: 2026-08-19'), 'utf8');
  const unrelated = compile(repo.root);
  assert.deepEqual(selected(unrelated, 'gsd_planning'), selected(baseline, 'gsd_planning'));
  assert.deepEqual(selected(unrelated, 'isa_acceptance'), selected(baseline, 'isa_acceptance'));

  writeFileSync(path.join(repo.root, '.planning/ROADMAP.md'), repo.files['.planning/ROADMAP.md']
    .replace('Operators inspect one deterministic graph.', 'Operators inspect a changed graph.'), 'utf8');
  const changedRoadmapInput = validInput();
  const changedRoadmapDigest = digest('**Goal**: Operators inspect a changed graph.\n');
  changedRoadmapInput.nodes.find(({ key }) => key === 'goal-phase-4').source.digest = changedRoadmapDigest;
  changedRoadmapInput.edges.find(({ from }) => from === 'goal-phase-4').source.digest = changedRoadmapDigest;
  const changedRoadmap = compile(repo.root, changedRoadmapInput);
  assert.equal(selected(changedRoadmap, 'gsd_planning').id, selected(baseline, 'gsd_planning').id);
  assert.notEqual(selected(changedRoadmap, 'gsd_planning').source.digest, selected(baseline, 'gsd_planning').source.digest);

  writeFileSync(path.join(repo.root, '.planning/ROADMAP.md'), repo.files['.planning/ROADMAP.md'], 'utf8');
  writeFileSync(path.join(repo.root, 'ISA.md'), repo.files['ISA.md']
    .replace('task: Build the provenance intent graph', 'task: Build a revised provenance graph'), 'utf8');
  const changedIsaInput = validInput();
  changedIsaInput.nodes.find(({ key }) => key === 'goal-approved').source.digest = digest('task: Build a revised provenance graph\n');
  const changedIsa = compile(repo.root, changedIsaInput);
  assert.equal(selected(changedIsa, 'isa_acceptance').id, selected(baseline, 'isa_acceptance').id);
  assert.notEqual(selected(changedIsa, 'isa_acceptance').source.digest, selected(baseline, 'isa_acceptance').source.digest);
});

test('excluded-source contract rejects GSD state, generated outputs, and mutable tracking selectors', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const base = validInput();
  const excluded = [
    ['.planning/STATE.md', 'whole-file'],
    ['docs/architecture/intent-graph.v1.json', 'whole-file'],
    ['docs/architecture/intent-graph.md', 'whole-file'],
    ['.planning/ROADMAP.md', 'whole-file'],
    ['.planning/ROADMAP.md', 'markdown.bold-field:Phase 4: Provenance-Preserving Intent Graph#Status'],
    ['ISA.md', 'whole-file'],
    ['ISA.md', 'frontmatter.phase'],
    ['ISA.md', 'frontmatter.progress'],
    ['ISA.md', 'frontmatter.updated'],
  ];
  for (const [pathname, selector] of excluded) {
    const input = structuredClone(base);
    input.nodes.find(({ key }) => key === 'vision').source = {
      path: pathname, authority: 'vision_anchor', selector, digest: digest('irrelevant\n'),
    };
    assert.throws(() => compile(repo.root, input), /forbidden|excluded|selector|source/i);
  }
});

test('GRAPH-03 / ISC-1279: overlays reference only canonical root anchors without copied authority', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const graph = compile(repo.root);
  const overlay = graph.nodes.find(({ kind }) => kind === 'overlay');
  assert.equal(overlay.source.authority, 'derived_reference');
  assert.deepEqual(overlay.anchorReferences.map(({ path: pathname }) => pathname), ['MISSION.md', 'VISION.md']);
  assert.equal('content' in overlay, false);

  for (const mutate of [
    (node) => { node.source.authority = 'vision_anchor'; },
    (node) => { node.content = 'Continue meaningful play.'; },
    (node) => { node.anchorReferences = [{ path: 'docs/learning.md', digest: digest('# Learning\n\nVerified facts inform review.\n') }]; },
    (node) => { node.anchorReferences[0].digest = digest('wrong'); },
  ]) {
    const input = validInput();
    mutate(input.nodes.find(({ key }) => key === 'overlay'));
    assert.throws(() => compile(repo.root, input), /overlay|anchor|authority|field|digest/i);
  }
});

test('GRAPH-04 / ISC-1280: evidence and learning transitions stay read-only and preserve anchors', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const visionBefore = readFileSync(path.join(repo.root, 'VISION.md'));
  const missionBefore = readFileSync(path.join(repo.root, 'MISSION.md'));
  const graph = compile(repo.root);
  assert.deepEqual(readFileSync(path.join(repo.root, 'VISION.md')), visionBefore);
  assert.deepEqual(readFileSync(path.join(repo.root, 'MISSION.md')), missionBefore);
  assert.ok(graph.edges.some(({ kind }) => kind === 'closes'));
  assert.ok(graph.edges.some(({ kind }) => kind === 'renews'));

  const badLearning = validInput();
  badLearning.nodes.find(({ key }) => key === 'learning').source.authority = 'isa_acceptance';
  assert.throws(() => compile(repo.root, badLearning), /learning|ISA|authority/i);

  const badRenewal = validInput();
  badRenewal.nodes.find(({ key }) => key === 'gate').source.authority = 'verification_evidence';
  assert.throws(() => compile(repo.root, badRenewal), /renew|gate|ISA|authority/i);
});

test('all ten allowed edge relations compile and every wrong source kind fails closed', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const graph = compile(repo.root);
  assert.deepEqual(new Set(graph.edges.map(({ kind }) => kind)), new Set([
    'directs', 'scopes', 'decomposes', 'proves', 'produces', 'closes', 'renews', 'informs', 'references', 'gates',
  ]));

  const wrongSources = {
    directs: 'mission', scopes: 'vision', decomposes: 'mission', proves: 'goal-phase-4', produces: 'task',
    closes: 'task', renews: 'learning', informs: 'evidence', references: 'gate', gates: 'learning',
  };
  for (const [kind, wrongSource] of Object.entries(wrongSources)) {
    const input = validInput();
    const edge = input.edges.find((candidate) => candidate.kind === kind);
    edge.from = wrongSource;
    assert.throws(() => compile(repo.root, input), new RegExp(`${kind}|edge|direction|matrix`, 'i'));
  }
});

test('edge validation rejects unknown kinds, missing endpoints, self edges, and duplicate identities', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  for (const mutate of [
    (input) => { input.edges[0].kind = ''; },
    (input) => { input.edges[0].kind = 'commands'; },
    (input) => { input.edges[0].to = 'missing'; },
    (input) => { input.edges[0].to = input.edges[0].from; },
    (input) => { input.edges.push(structuredClone(input.edges[0])); },
    (input) => { input.nodes.push({ ...structuredClone(input.nodes[0]), key: 'duplicate-vision' }); },
  ]) {
    const input = validInput();
    mutate(input);
    assert.throws(() => compile(repo.root, input));
  }
});

test('GRAPH-05 / ISC-1281: approval, freshness, stop, blocked, and completion contradictions fail closed', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const graph = compile(repo.root);
  const gate = graph.nodes.find(({ kind }) => kind === 'gate');
  assert.equal(gate.state.completion, 'blocked');
  assert.equal(gate.state.approval, 'required');
  assert.equal(gate.state.freshness, 'fresh');
  assert.ok(gate.state.blockedReason.length > 0);
  assert.equal(gate.state.stopCondition.kind, 'approval_boundary');
  assert.equal(gate.state.stopCondition.satisfied, false);

  const mutations = [
    (state) => { delete state.approval; },
    (state) => { state.completion = 'complete'; },
    (state) => { state.freshness = 'unknown'; },
    (state) => { state.blockedReason = null; },
    (state) => { state.stopCondition.satisfied = true; },
    (state) => { state.approval = 'approved'; state.completion = 'satisfied'; state.blockedReason = 'still blocked'; },
  ];
  for (const mutate of mutations) {
    const input = validInput();
    mutate(input.nodes.find(({ key }) => key === 'gate').state);
    assert.throws(() => compile(repo.root, input), /state|completion|blocked|approval|freshness|stop/i);
  }
});

test('projection foldback rejects both intent and D1 Goal Graph projection-shaped authority input', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const api = requireSubject('projection foldback');
  for (const schema of ['cambium.intent-graph-projection.v1', 'cambium.goal-graph-projection.v1']) {
    assert.throws(() => api.compileIntentGraph({ schema, repositoryRoot: repo.root, nodes: [], edges: [] }), /projection|authority|foldback/i);
    writeFileSync(path.join(repo.root, 'docs', 'projection.json'), JSON.stringify({ schema, nodes: [] }), 'utf8');
    const input = validInput();
    input.nodes.find(({ key }) => key === 'vision').source = {
      path: 'docs/projection.json', authority: 'vision_anchor', selector: 'whole-file',
      digest: digest(JSON.stringify({ schema, nodes: [] })),
    };
    assert.throws(() => compile(repo.root, input), /projection|authority|foldback/i);
  }
});

test('renderer validates the projection and emits references, state, and digests without source bodies', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const api = requireSubject('intent graph renderer');
  const graph = compile(repo.root);
  const markdown = api.renderIntentGraphMarkdown(graph);
  assert.match(markdown, /read-only/i);
  assert.match(markdown, new RegExp(graph.graphDigest));
  assert.match(markdown, new RegExp(graph.sourceSetDigest));
  for (const { id } of [...graph.nodes, ...graph.edges]) assert.match(markdown, new RegExp(id));
  assert.match(markdown, /approval/i);
  assert.match(markdown, /freshness/i);
  assert.match(markdown, /blocked/i);
  assert.doesNotMatch(markdown, /Continue meaningful play\.|Preserve provenance\.|Verified compiler behavior\./);

  const tampered = structuredClone(graph);
  tampered.graphDigest = digest('tampered');
  assert.throws(() => api.renderIntentGraphMarkdown(tampered), /digest|valid/i);
});
