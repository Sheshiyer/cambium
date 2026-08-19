import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

let subject = null;
try {
  subject = await import('./temperance-flow.mjs');
} catch {
  // RED is expressed through named assertions, never module-resolution noise.
}

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const FLOW_SCHEMA = 'cambium.temperance-flow-projection.v1';
const LIFECYCLE = [
  'reread',
  'select_one',
  'execute_external',
  'verify_declared',
  'persist_existing_surfaces',
  'exit_external_condition',
];

function requireSubject(requirement) {
  assert.ok(subject, `${requirement}: Temperance flow compiler contract is not implemented`);
  return subject;
}

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function source(pathname, kind, body) {
  return { path: pathname, kind, selector: 'whole-file', digest: digest(body) };
}

function makeRepository() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-temperance-flow-'));
  const outside = mkdtempSync(path.join(tmpdir(), 'cambium-temperance-flow-outside-'));
  const files = {
    'ISA.md': '---\ntask: Build one safe Temperance flow\nphase: execute\nprogress: 0/4\n---\n',
    '.planning/STATE.md': '# State\n\n## Operator Next Step\n\n`/gsd:execute-phase 5`\n',
    '.planning/phases/05/05-01-PLAN.md': '<task type="auto"><name>Task 1: Define the flow contract</name></task>\n',
    '.planning/phases/04/04-VERIFICATION.md': '# Verification\n\nstatus: passed\n',
    '.project/HANDOFF.md': '# Handoff\n\nReviewed Phase 5 execution pickup.\n',
    'docs/architecture/intent-graph.v1.json': '{"schema":"cambium.intent-graph-projection.v1","graphDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\n',
  };
  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body, 'utf8');
  }
  writeFileSync(path.join(outside, 'secret.md'), 'outside\n', 'utf8');
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'docs', 'escape.md'));
  return {
    root,
    files,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    },
  };
}

function validInput(repo) {
  const isa = source('ISA.md', 'isa_goal', repo.files['ISA.md']);
  const state = source('.planning/STATE.md', 'gsd_state', repo.files['.planning/STATE.md']);
  const plan = source('.planning/phases/05/05-01-PLAN.md', 'active_plan', repo.files['.planning/phases/05/05-01-PLAN.md']);
  const taskSource = { ...plan, selector: 'whole-file' };
  const evidence = source('.planning/phases/04/04-VERIFICATION.md', 'verification_evidence', repo.files['.planning/phases/04/04-VERIFICATION.md']);
  const handoff = source('.project/HANDOFF.md', 'reviewed_handoff', repo.files['.project/HANDOFF.md']);
  const intentGraph = {
    path: 'docs/architecture/intent-graph.v1.json',
    schema: 'cambium.intent-graph-projection.v1',
    digest: digest(repo.files['docs/architecture/intent-graph.v1.json']),
  };
  return {
    authorities: {
      isa: { source: isa, status: 'approved', goal: 'Build one safe Temperance flow' },
      gsd: { source: state, status: 'live', phase: '5', transition: 'execute', command: '/gsd:execute-phase 5' },
      plan: { source: plan, status: 'active', phase: '5', plan: '01' },
    },
    supportingSources: [evidence, handoff],
    intentGraphRef: intentGraph,
    tasks: [{
      id: '05-01-task-1',
      name: 'Task 1: Define the flow contract',
      source: taskSource,
      status: 'ready',
      dependencies: [],
      command: '/gsd:execute-phase 5',
      route: {
        skillCluster: 'cambium',
        combo: 'te-dispatch-paid',
        lane: 'paid_execution',
        approvalRequired: false,
        receiptRef: 'manifest:event:2879',
      },
      gates: [{ kind: 'declared_verification', source: evidence, satisfied: false }],
      stop: { kind: 'external_verification', source: evidence, satisfied: false },
    }],
    receiptVerification: null,
  };
}

function compile(repo, input = validInput(repo)) {
  return requireSubject('FLOW-01 / ISC-1282').compileTemperanceFlow({ repositoryRoot: repo.root, ...input });
}

function readyProjection(repo) {
  const flow = compile(repo);
  assert.equal(flow.result.status, 'ready');
  return flow;
}

function freshReceipt(input, overrides = {}) {
  const task = input.tasks[0];
  return {
    status: 'verified',
    freshness: 'fresh',
    receiptRef: task.route.receiptRef,
    taskId: task.id,
    command: task.command,
    route: {
      skillCluster: task.route.skillCluster,
      combo: task.route.combo,
      lane: task.route.lane,
    },
    observedAt: '2026-08-19T06:30:00.000Z',
    ageSeconds: 30,
    evidencePointer: 'manifest:event:2879',
    attribution: { provider: 'command-code', model: 'deepseek/deepseek-v4-pro' },
    ...overrides,
  };
}

test('FLOW-01 / ISC-1282 / D-01: approved ISA, live GSD, then active-plan frontier yields one command', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const api = requireSubject('FLOW-01 / ISC-1282 / D-01');
  const flow = readyProjection(repo);

  assert.equal(api.TEMPERANCE_FLOW_SCHEMA, FLOW_SCHEMA);
  assert.equal(flow.schema, FLOW_SCHEMA);
  assert.equal(flow.projectionAuthority, 'read_only');
  assert.deepEqual(flow.authorityOrder, ['isa_goal', 'gsd_state', 'active_plan']);
  assert.equal(flow.result.command, '/gsd:execute-phase 5');
  assert.equal(flow.result.task.id, '05-01-task-1');
  assert.equal('commands' in flow, false);
  assert.equal('queue' in flow, false);
  assert.match(flow.sourceSetDigest, SHA256);
  assert.match(flow.flowDigest, SHA256);
});

test('FLOW-01 / ISC-1282 / D-02: missing, stale, conflicting, or ambiguous authority blocks without command', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const mutations = [
    (input) => { delete input.authorities.isa; },
    (input) => { input.authorities.isa.status = 'stale'; },
    (input) => { input.authorities.gsd.status = 'stale'; },
    (input) => { input.authorities.plan.status = 'ambiguous'; },
    (input) => { input.authorities.gsd.phase = '4'; },
    (input) => { input.authorities.plan.phase = '6'; },
    (input) => { input.tasks[0].command = '/gsd:plan-phase 5'; },
  ];
  for (const mutate of mutations) {
    const input = validInput(repo);
    mutate(input);
    const flow = compile(repo, input);
    assert.equal(flow.result.status, 'blocked');
    assert.equal(flow.result.command, null);
    assert.equal(flow.result.task, null);
    assert.ok(flow.result.reasons.length >= 1);
    assert.equal(flow.route.resolved, null);
  }
});

test('FLOW-01 / ISC-1282: no plan, zero ready tasks, multiple ready tasks, blocked dependencies, and terminal work block', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const cases = [
    (input) => { input.authorities.plan.status = 'missing'; },
    (input) => { input.tasks[0].status = 'pending'; },
    (input) => { input.tasks.push({ ...structuredClone(input.tasks[0]), id: '05-01-task-2', name: 'Task 2' }); },
    (input) => { input.tasks[0].dependencies = [{ id: '04-04-task-1', status: 'pending' }]; },
    (input) => { input.tasks[0].status = 'complete'; input.tasks[0].stop.satisfied = true; },
  ];
  for (const mutate of cases) {
    const input = validInput(repo);
    mutate(input);
    const flow = compile(repo, input);
    assert.equal(flow.result.status, 'blocked');
    assert.equal(flow.result.command, null);
    assert.ok(flow.result.reasons.length > 0);
  }
});

test('FLOW-01 / ISC-1282: command grammar and selected task identity are closed', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  for (const command of [
    'gsd execute 5',
    '/gsd:execute-phase 5 && touch owned',
    '/gsd:execute-phase ../5',
    '/gsd:execute-phase 5 --force',
    '/temperance:dispatch 5',
  ]) {
    const input = validInput(repo);
    input.authorities.gsd.command = command;
    input.tasks[0].command = command;
    assert.throws(() => compile(repo, input), /command|grammar|GSD/i);
  }
  const duplicate = validInput(repo);
  duplicate.tasks.push(structuredClone(duplicate.tasks[0]));
  assert.throws(() => compile(repo, duplicate), /duplicate|identity/i);
});

test('FLOW-02 / ISC-1283 / D-03 / D-04: lifecycle is one ordered read-select-execute-verify-persist-exit iteration', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const flow = readyProjection(repo);
  assert.deepEqual(flow.lifecycle, LIFECYCLE);
  assert.equal(flow.result.task.dependencies.length, 0);
  assert.deepEqual(flow.gates.map(({ kind }) => kind), ['declared_verification']);
  assert.deepEqual(flow.stops.map(({ kind }) => kind), ['external_verification']);
  assert.equal(flow.stops[0].satisfied, false);
});

test('FLOW-02 / ISC-1283 / D-05: mutable ledgers, schedulers, callbacks, self-certification, and terminal revival are rejected', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const forbiddenMutations = [
    (input) => { input.queue = []; },
    (input) => { input.scheduler = { interval: 1000 }; },
    (input) => { input.mutableLedger = {}; },
    (input) => { input.dispatch = () => {}; },
    (input) => { input.write = () => {}; },
    (input) => { input.tasks[0].selfCertified = true; },
    (input) => { input.tasks[0].status = 'complete'; input.tasks[0].stop.satisfied = false; },
  ];
  for (const mutate of forbiddenMutations) {
    const input = validInput(repo);
    mutate(input);
    assert.throws(() => compile(repo, input), /field|ledger|scheduler|dispatch|write|terminal|complete|certif/i);
  }
});

test('FLOW-03 / ISC-1284 / D-06: route intent remains inspectable without resolved attribution', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const flow = readyProjection(repo);
  assert.deepEqual(flow.route.intent, {
    skillCluster: 'cambium',
    combo: 'te-dispatch-paid',
    lane: 'paid_execution',
    approvalRequired: false,
    receiptRef: 'manifest:event:2879',
  });
  assert.equal(flow.route.resolved, null);
});

test('FLOW-03 / ISC-1284 / D-07: only a fresh task-command-route-bound verified adapter result exposes provider attribution', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const verified = validInput(repo);
  verified.receiptVerification = freshReceipt(verified);
  const resolved = compile(repo, verified).route.resolved;
  assert.deepEqual(resolved, {
    receiptRef: 'manifest:event:2879',
    freshness: 'fresh',
    observedAt: '2026-08-19T06:30:00.000Z',
    ageSeconds: 30,
    evidencePointer: 'manifest:event:2879',
    provider: 'command-code',
    model: 'deepseek/deepseek-v4-pro',
  });

  for (const receipt of [
    { status: 'missing' },
    { status: 'unverified' },
  ]) {
    const input = validInput(repo);
    input.receiptVerification = receipt;
    assert.equal(compile(repo, input).route.resolved, null);
  }

  const mismatches = [
    { freshness: 'stale' },
    { taskId: '05-02-task-1' },
    { command: '/gsd:execute-phase 6' },
    { receiptRef: 'manifest:event:other' },
    { route: { skillCluster: 'cambium', combo: 'te-fast', lane: 'paid_execution' } },
  ];
  for (const mismatch of mismatches) {
    const input = validInput(repo);
    input.receiptVerification = freshReceipt(input, mismatch);
    const flow = compile(repo, input);
    assert.equal(flow.result.status, 'blocked');
    assert.equal(flow.result.command, null);
    assert.equal(flow.route.resolved, null);
  }
});

test('FLOW-03 / ISC-1284 / D-08: host policy, credentials, quotas, failover, and unredacted attribution are rejected', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  for (const [field, value] of [
    ['providerStack', ['provider-a', 'provider-b']],
    ['quota', 10],
    ['failoverPolicy', 'provider-a then provider-b'],
    ['credential', 'secret-value'],
    ['apiKey', 'sk-not-allowed'],
    ['promptBody', 'private prompt'],
    ['responseBody', 'private response'],
    ['nativeSessionId', 'session-123'],
  ]) {
    const input = validInput(repo);
    input.tasks[0].route[field] = value;
    assert.throws(() => compile(repo, input), /forbidden|field|secret|provider|quota|failover|prompt|session/i);
  }

  for (const attribution of [
    { provider: 'Bearer abcdefghijklmnop', model: 'safe-model' },
    { provider: 'safe-provider', model: '/Users/operator/private-model' },
    { provider: 'safe-provider', model: 'BEGIN PRIVATE KEY material' },
  ]) {
    const input = validInput(repo);
    input.receiptVerification = freshReceipt(input, { attribution });
    assert.throws(() => compile(repo, input), /redact|secret|private|absolute|attribution/i);
  }
});

test('FLOW-04 / ISC-1285 / D-09: semantic input permutations yield deterministic projection and Markdown parity', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const api = requireSubject('FLOW-04 / ISC-1285 / D-09');
  const input = validInput(repo);
  const first = compile(repo, input);
  const permuted = structuredClone(input);
  permuted.supportingSources.reverse();
  permuted.tasks[0].dependencies.reverse();
  permuted.tasks[0].gates.reverse();
  const second = compile(repo, permuted);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(api.validateTemperanceFlowProjection(first), first);

  const markdown = api.renderTemperanceFlowMarkdown(first);
  for (const value of [
    first.schema,
    first.projectionAuthority,
    first.sourceSetDigest,
    first.flowDigest,
    first.result.status,
    first.result.command,
    first.result.task.id,
    first.route.intent.skillCluster,
    first.route.intent.combo,
    first.route.intent.lane,
    first.stops[0].kind,
  ]) assert.ok(markdown.includes(String(value)), `Markdown must preserve ${value}`);
});

test('FLOW-04 / ISC-1285 / D-10: Intent Graph linkage is one reference and cannot extend its closed vocabulary', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const flow = readyProjection(repo);
  assert.deepEqual(Object.keys(flow.references.intentGraph).sort(), ['digest', 'path', 'schema']);
  assert.equal(flow.references.intentGraph.schema, 'cambium.intent-graph-projection.v1');

  for (const mutate of [
    (input) => { input.intentGraphRef.nodeKinds = ['vision', 'command']; },
    (input) => { input.intentGraphRef.edgeKinds = ['dispatches']; },
    (input) => { input.intentGraphRef.lifecycle = ['scheduled']; },
    (input) => { input.intentGraphRef.authorities = ['flow']; },
    (input) => { input.intentGraphRef.schema = FLOW_SCHEMA; },
  ]) {
    const input = validInput(repo);
    mutate(input);
    assert.throws(() => compile(repo, input), /Intent Graph|vocabulary|field|schema|reference/i);
  }
});

test('FLOW-04 / ISC-1285 / D-11: paths are contained, source bodies stay absent, and compilation makes zero source mutation', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const before = Object.fromEntries(Object.entries(repo.files).map(([key]) => [key, readFileSync(path.join(repo.root, key))]));
  const flow = readyProjection(repo);
  const serialized = JSON.stringify(flow);
  for (const [key, bytes] of Object.entries(before)) {
    assert.deepEqual(readFileSync(path.join(repo.root, key)), bytes);
    assert.equal(serialized.includes(repo.files[key]), false);
  }
  assert.equal(serialized.includes(repo.root), false);
  assert.equal(serialized.includes('/Users/'), false);
  assert.equal(serialized.includes('/Volumes/'), false);

  for (const pathname of [path.join(repo.root, 'ISA.md'), '../ISA.md', 'docs/escape.md', 'docs/missing.md']) {
    const input = validInput(repo);
    input.authorities.isa.source.path = pathname;
    assert.throws(() => compile(repo, input), /path|absolute|contain|realpath|source/i);
  }
});

test('FLOW-04 / ISC-1285: read-only validation rejects foldback, unknown fields, and blocked-as-complete contradictions', (t) => {
  const repo = makeRepository();
  t.after(repo.cleanup);
  const api = requireSubject('FLOW-04 / ISC-1285');
  const flow = readyProjection(repo);

  for (const mutate of [
    (value) => { value.projectionAuthority = 'operational'; },
    (value) => { value.queue = []; },
    (value) => { value.result.status = 'blocked'; value.result.reasons = [{ code: 'conflict', sources: [] }]; },
    (value) => { value.result.status = 'complete'; },
    (value) => { value.route.intent.providerStack = []; },
    (value) => { value.references.isa.body = 'copied authority'; },
  ]) {
    const candidate = structuredClone(flow);
    mutate(candidate);
    assert.throws(() => api.validateTemperanceFlowProjection(candidate), /read_only|field|blocked|command|status|provider|source|digest/i);
  }

  const folded = validInput(repo);
  folded.authorities.isa = structuredClone(flow);
  assert.throws(() => compile(repo, folded), /projection|authority|foldback|schema/i);
});
