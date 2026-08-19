import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileTemperanceFlow } from './temperance-flow.mjs';

let subject = null;
try {
  subject = await import('./ralph-iteration.mjs');
} catch {
  // RED remains a named contract failure instead of module-resolution noise.
}

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function requireSubject(label) {
  assert.equal(typeof subject?.deriveRalphIteration, 'function', `${label}: Ralph derivation is not implemented`);
  assert.equal(typeof subject?.validateRalphIteration, 'function', `${label}: Ralph validation is not implemented`);
  return subject;
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-ralph-pure-'));
  const files = {
    'ISA.md': 'approved goal\n',
    '.planning/STATE.md': 'live transition\n',
    '.planning/phases/05/05-03-PLAN.md': 'active plan\n',
    '.planning/phases/05/05-02-SUMMARY.md': 'verified evidence\n',
    '.project/HANDOFF.md': 'reviewed handoff\n',
    'docs/architecture/intent-graph.v1.json': '{"schema":"cambium.intent-graph-projection.v1"}\n',
  };
  for (const [relative, body] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
  const source = (pathname, kind) => ({ path: pathname, kind, selector: 'whole-file', digest: digest(files[pathname]) });
  const taskSource = source('.planning/phases/05/05-03-PLAN.md', 'active_plan');
  const evidence = source('.planning/phases/05/05-02-SUMMARY.md', 'verification_evidence');
  const input = {
    repositoryRoot: root,
    authorities: {
      isa: { source: source('ISA.md', 'isa_goal'), status: 'approved', goal: 'goal' },
      gsd: { source: source('.planning/STATE.md', 'gsd_state'), status: 'live', phase: '5', transition: 'execute', command: '/gsd:execute-phase 5' },
      plan: { source: taskSource, status: 'active', phase: '5', plan: '03' },
    },
    supportingSources: [evidence, source('.project/HANDOFF.md', 'reviewed_handoff')],
    intentGraphRef: { path: 'docs/architecture/intent-graph.v1.json', schema: 'cambium.intent-graph-projection.v1', digest: digest(files['docs/architecture/intent-graph.v1.json']) },
    tasks: [{
      id: 'phase5-plan03-task01', name: 'Task 1', source: taskSource, status: 'ready', dependencies: [],
      command: '/gsd:execute-phase 5',
      route: { skillCluster: 'gsd-execute-phase', combo: 'te-dispatch-paid', lane: 'paid_execution', approvalRequired: true, receiptRef: 'manifest:phase5/task01' },
      gates: [
        { kind: 'declared_verification', source: evidence, satisfied: false },
        { kind: 'approval_boundary', source: taskSource, satisfied: false },
      ],
      stop: { kind: 'external_verification', source: evidence, satisfied: false },
    }],
    receiptVerification: {
      status: 'verified', freshness: 'fresh', receiptRef: 'manifest:phase5/task01', taskId: 'phase5-plan03-task01', command: '/gsd:execute-phase 5',
      route: { skillCluster: 'gsd-execute-phase', combo: 'te-dispatch-paid', lane: 'paid_execution' },
      observedAt: '2026-08-19T08:00:00.000Z', ageSeconds: 10, evidencePointer: 'manifest:event/task01',
      attribution: { provider: 'redacted-provider', model: 'redacted-model' },
    },
  };
  return { root, flow: compileTemperanceFlow(input), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function approval(action, overrides = {}) {
  return {
    status: 'approved', taskId: action.task.id, command: action.command, route: action.route,
    projectionDigest: action.projectionDigest, sourceSetDigest: action.sourceSetDigest,
    approvalDigest: digest('approval'), evidenceRef: 'manifest:approval/task01', ...overrides,
  };
}

test('FLOW-02 / ISC-1283 / D-03: fresh equal inputs derive byte-stable stateless iterations', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const api = requireSubject('fresh replay');
  const first = api.deriveRalphIteration(structuredClone(fx.flow));
  const second = api.deriveRalphIteration(structuredClone(fx.flow));
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.match(first.iterationDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.status, 'action');
  assert.equal(first.task.id, 'phase5-plan03-task01');
  assert.equal(first.command, '/gsd:execute-phase 5');
  assert.equal(first.externalStopCondition, 'exit_after_one_unit');
  assert.equal('ledger' in first, false);
});

test('FLOW-02 / ISC-1283 / D-04: one action carries exact verification, persistence, receipt, approval, and snapshot gates', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const action = requireSubject('one-unit envelope').deriveRalphIteration(fx.flow);
  assert.deepEqual(action.persistenceSurfaces, ['summary', 'state', 'handoff']);
  assert.deepEqual(action.declaredVerification.map(({ kind }) => kind), ['declared_verification']);
  assert.equal(action.receiptGate.status, 'satisfied');
  assert.equal(action.approvalGate.status, 'required');
  assert.equal(action.route.combo, 'te-dispatch-paid');
  assert.equal(Object.isFrozen(action), true);
});

test('FLOW-02 / ISC-1283 / D-05: blocked and terminal inputs stop with no command and cannot revive', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const api = requireSubject('blocked and terminal');
  const blocked = structuredClone(fx.flow);
  blocked.result = { status: 'blocked', task: null, command: null, reasons: [{ code: 'no_dependency_ready_task', sources: [] }] };
  blocked.route.resolved = null;
  blocked.flowDigest = digest('invalid-on-purpose');
  assert.throws(() => api.deriveRalphIteration(blocked), /flowDigest|projection/i);

  const action = api.deriveRalphIteration(fx.flow);
  const complete = api.deriveRalphIteration(fx.flow, {
    approval: approval(action), execution: { status: 'succeeded', evidenceRef: 'temperance:execution/task01' },
    verification: { status: 'passed', evidenceRef: 'temperance:verification/task01' },
    persistence: { summary: true, state: true, handoff: true },
  });
  assert.equal(complete.status, 'stop');
  assert.equal(complete.reason, 'iteration_complete');
  assert.throws(() => api.deriveRalphIteration(fx.flow, { ...complete, execution: { status: 'succeeded' } }), /terminal|reviv|result/i);
});

test('FLOW-02 / ISC-1283: failed execution, verification, and missing persistence each yield one stop', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const api = requireSubject('single stop reducer');
  const action = api.deriveRalphIteration(fx.flow);
  const base = { approval: approval(action) };
  const cases = [
    [{ ...base, execution: { status: 'failed', evidenceRef: 'temperance:execution/fail' } }, 'terminal'],
    [{ ...base, execution: { status: 'succeeded', evidenceRef: 'temperance:execution/ok' }, verification: { status: 'failed', evidenceRef: 'temperance:verification/fail' } }, 'verification_failed'],
    [{ ...base, execution: { status: 'succeeded', evidenceRef: 'temperance:execution/ok' }, verification: { status: 'passed', evidenceRef: 'temperance:verification/ok' }, persistence: { summary: true, state: false, handoff: false } }, 'persist_required'],
  ];
  for (const [result, reason] of cases) {
    const stop = api.deriveRalphIteration(fx.flow, result);
    assert.equal(stop.status, 'stop');
    assert.equal(stop.reason, reason);
    assert.equal('command' in stop, false);
  }
});

test('FLOW-03 / ISC-1284 / D-08: paid execution requires exact source/task/command/route/projection approval binding', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const api = requireSubject('approval binding');
  const action = api.deriveRalphIteration(fx.flow);
  const missing = api.deriveRalphIteration(fx.flow, {});
  assert.equal(missing.reason, 'approval_required');
  for (const mutation of [
    { taskId: 'attacker-task' }, { command: '/gsd:execute-phase 6' },
    { projectionDigest: digest('other-projection') }, { sourceSetDigest: digest('other-source-set') },
    { route: { ...action.route, combo: 'te-fast' } }, { status: 'denied' },
  ]) assert.equal(api.deriveRalphIteration(fx.flow, { approval: approval(action, mutation) }).reason, 'approval_required');
});

test('FLOW-02 / ISC-1283: same iteration with a different external result digest is a replay conflict', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const api = requireSubject('replay conflict');
  const action = api.deriveRalphIteration(fx.flow);
  const first = api.deriveRalphIteration(fx.flow, {
    approval: approval(action), execution: { status: 'succeeded', evidenceRef: 'temperance:execution/a' },
    verification: { status: 'passed', evidenceRef: 'temperance:verification/a' }, persistence: { summary: true, state: true, handoff: true },
  });
  assert.throws(() => api.validateRalphIteration({ ...first, resultDigest: digest('conflict') }, { expectedResultDigest: first.resultDigest }), /replay|digest|conflict/i);
});

test('FLOW-02 / WR-02: serialized actions reject mutated identity, gates, nested fields, and extras', (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const api = requireSubject('closed action validation');
  const action = api.deriveRalphIteration(fx.flow);
  const mutations = [
    { ...action, command: '/gsd:execute-phase 6' },
    { ...action, route: { ...action.route, combo: 'te-fast' } },
    { ...action, task: { ...action.task, id: 'other-task' } },
    { ...action, receiptGate: { ...action.receiptGate, status: 'bypassed' } },
    { ...action, approvalGate: { ...action.approvalGate, required: 'yes' } },
    { ...action, persistenceSurfaces: ['summary'] },
    { ...action, iterationDigest: digest('forged') },
    { ...action, attackerField: true },
  ];
  for (const mutation of mutations) assert.throws(() => api.validateRalphIteration(mutation), /action|schema|identity|digest|gate|route|task|persist/i);
});

test('FLOW-02 / ISC-1283: pure interpreter source contains no side-effect or mutable-ledger dependencies', () => {
  requireSubject('pure source shape');
  const source = readFileSync(new URL('./ralph-iteration.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /node:(?:fs|child_process|net|http|https|timers)|\b(?:spawn|exec|fetch)\s*\(|setInterval|setTimeout|D1|Worker|providerStack/);
  assert.doesNotMatch(source, /(?:let|var)\s+(?:ledger|cache|state|history|replay)/i);
});
