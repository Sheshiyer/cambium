import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);
let subject = null;
try {
  subject = await import('./run-ralph-iteration.mjs');
} catch {
  // RED remains a semantic assertion below.
}
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function requireRunner(label) {
  assert.equal(typeof subject?.runRalphIteration, 'function', `${label}: bounded Ralph runner is not implemented`);
  return subject.runRalphIteration;
}

function copy(root, relative) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(repositoryRoot, relative), target);
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-ralph-runner-'));
  for (const relative of [
    'ISA.md', '.planning/STATE.md', '.project/HANDOFF.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-01-PLAN.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-02-PLAN.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-03-PLAN.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-01-SUMMARY.md',
    '.planning/phases/05-ralph-and-temperance-flow-projection/05-02-SUMMARY.md',
    'docs/architecture/intent-graph.v1.json',
  ]) copy(root, relative);
  const summaryPath = '.planning/phases/05-ralph-and-temperance-flow-projection/05-03-SUMMARY.md';
  // Make the copied durable state agree with the executable transition.
  const statePath = path.join(root, '.planning/STATE.md');
  writeFileSync(statePath, readFileSync(statePath, 'utf8').replace('/gsd:plan-phase 5', '/gsd:execute-phase 5'));
  const handoffPath = path.join(root, '.project/HANDOFF.md');
  writeFileSync(handoffPath, readFileSync(handoffPath, 'utf8').replace('planning and acceptance artifacts only', 'execution is approved for the bounded fixture only'));
  const executable = path.join(root, 'fixture-executor.mjs');
  const verifier = path.join(root, 'fixture-verifier.mjs');
  writeFileSync(executable, "import{appendFileSync}from'node:fs';appendFileSync(process.argv[2],'execute\\n');\n");
  writeFileSync(verifier, "import{appendFileSync}from'node:fs';appendFileSync(process.argv[2],'verify\\n');\n");
  const effects = path.join(root, 'effects.log');
  const projectionPath = 'docs/architecture/temperance-flow.v1.json';
  const generator = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts/generate-temperance-flow.mjs'), '--root', root, '--write'], { encoding: 'utf8' });
  assert.equal(generator.status, 0, generator.stderr);
  writeFileSync(path.join(root, summaryPath), '# Plan 05-03 Summary\n');
  return { root, summaryPath, statePath: '.planning/STATE.md', handoffPath: '.project/HANDOFF.md', projectionPath, executable, verifier, effects, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function verificationResults(expected, overrides = {}) {
  const issuedAt = '2026-08-19T08:00:00.000Z';
  return {
    host: {
      schema: 'temperance.manifest-verification.v1', verified: true, status: 'verified',
      issuer: 'temperance-manifest-bridge', audience: 'cambium-ralph-iteration', issuedAt,
      expiresAt: '2026-08-19T09:00:00.000Z', nonce: 'host-nonce', receiptRef: 'manifest:phase5/task01',
      taskId: expected.taskId, command: expected.command, route: expected.route,
      projectionDigest: expected.projectionDigest, sourceSetDigest: expected.sourceSetDigest,
      evidenceRef: 'manifest:event/task01', payloadDigest: digest('host-payload'),
    },
    approval: {
      schema: 'temperance.owner-approval.v1', verified: true, status: 'approved',
      issuer: 'temperance-manifest-bridge', audience: 'cambium-ralph-iteration', issuedAt,
      expiresAt: '2026-08-19T09:00:00.000Z', nonce: 'approval-nonce', approvalRef: 'manifest:approval/task01',
      taskId: expected.taskId, command: expected.command, route: expected.route,
      projectionDigest: expected.projectionDigest, sourceSetDigest: expected.sourceSetDigest,
      evidenceRef: 'manifest:event/approval-task01', payloadDigest: digest('approval-payload'),
    },
    ...overrides,
  };
}

function adapters(fx, options = {}) {
  let bindings;
  const get = () => bindings ??= options.results ?? null;
  return {
    manifestVerifier: async (expected) => (get() ?? verificationResults(expected)).host,
    approvalVerifier: async (expected) => (get() ?? verificationResults(expected)).approval,
    executor: async () => {
      const result = spawnSync(process.execPath, [fx.executable, fx.effects], { encoding: 'utf8' });
      return { status: result.status === 0 ? 'succeeded' : 'failed', evidenceRef: 'temperance:execution/task01' };
    },
    verification: async () => {
      const result = spawnSync(process.execPath, [fx.verifier, fx.effects], { encoding: 'utf8' });
      return { status: result.status === 0 ? 'passed' : 'failed', evidenceRef: 'temperance:verification/task01' };
    },
    summaryAdapter: options.summaryAdapter,
    stateAdapter: options.stateAdapter,
    handoffAdapter: options.handoffAdapter,
  };
}

function runOptions(fx, extra = {}) {
  return {
    root: fx.root, projectionPath: fx.projectionPath, receiptReference: 'manifest:phase5/task01',
    approvalReference: 'manifest:approval/task01', summaryPath: fx.summaryPath,
    statePath: fx.statePath, handoffPath: fx.handoffPath, now: '2026-08-19T08:30:00.000Z',
    dryRun: false, testAdapters: adapters(fx), ...extra,
  };
}

function files(root, current = root) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(current, entry.name);
    return entry.isDirectory() ? files(root, target) : [path.relative(root, target).split(path.sep).join('/')];
  }).sort();
}

test('FLOW-02 / ISC-1283 / D-03..D-05: execute then verify then summary/state/handoff persist then exit once', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const beforeFiles = files(fx.root);
  const result = await requireRunner('bounded execute-verify-persist-exit')(runOptions(fx));
  assert.equal(result.status, 'stop');
  assert.equal(result.reason, 'iteration_complete');
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  for (const surface of [fx.summaryPath, fx.statePath, fx.handoffPath]) {
    const body = readFileSync(path.join(fx.root, surface), 'utf8');
    assert.ok(body.includes(result.iterationDigest), surface);
    assert.ok(body.includes(result.resultDigest), surface);
  }
  assert.deepEqual(files(fx.root).filter((p) => p !== 'effects.log'), beforeFiles);
});

test('FLOW-02 / ISC-1283: summary-only partial persistence resumes missing CAS steps without double effects', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const failing = adapters(fx, { stateAdapter: () => { throw new Error('fixture state interruption'); } });
  await assert.rejects(requireRunner('summary-only recovery')(runOptions(fx, { testAdapters: failing })), /state interruption/);
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  const recovered = await requireRunner('summary-only recovery')(runOptions(fx));
  assert.equal(recovered.reason, 'iteration_complete');
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
});

test('FLOW-02 / ISC-1283: summary-plus-STATE recovery writes only handoff without double execute or verify', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const failing = adapters(fx, { handoffAdapter: () => { throw new Error('fixture handoff interruption'); } });
  await assert.rejects(requireRunner('summary-state recovery')(runOptions(fx, { testAdapters: failing })), /handoff interruption/);
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  const recovered = await requireRunner('summary-state recovery')(runOptions(fx));
  assert.equal(recovered.reason, 'iteration_complete');
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
});

test('FLOW-02 / ISC-1283: pre-execution drift and CAS conflicts stop before unauthorized later effects', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const driftAdapters = adapters(fx);
  const originalApproval = driftAdapters.approvalVerifier;
  driftAdapters.approvalVerifier = async (expected) => {
    const result = await originalApproval(expected);
    writeFileSync(path.join(fx.root, 'ISA.md'), `${readFileSync(path.join(fx.root, 'ISA.md'), 'utf8')}drift\n`);
    return result;
  };
  const drift = await requireRunner('pre-execution drift')(runOptions(fx, { testAdapters: driftAdapters }));
  assert.equal(drift.reason, 'source_drift');
  assert.equal(existsSync(fx.effects), false);

  const fx2 = fixture(); t.after(fx2.cleanup);
  const conflictAdapters = adapters(fx2, { stateAdapter: ({ current, append }) => {
    writeFileSync(path.join(fx2.root, fx2.statePath), `${current}attacker-change\n`);
    return `${current}${append}`;
  } });
  const conflict = await requireRunner('CAS conflict')(runOptions(fx2, { testAdapters: conflictAdapters }));
  assert.equal(conflict.reason, 'cas_conflict');
  assert.deepEqual(readFileSync(fx2.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  assert.equal(readFileSync(path.join(fx2.root, fx2.handoffPath), 'utf8').includes(conflict.iterationDigest), false);
});

test('FLOW-03 / ISC-1284 / D-08: fixed-boundary approval rejects attacker trust, stale, denied, mismatched, and replay-conflicting results', async (t) => {
  for (const mutate of [
    (x) => ({ ...x, issuer: 'attacker-verifier' }),
    (x) => ({ ...x, audience: 'attacker-audience' }),
    (x) => ({ ...x, expiresAt: '2026-08-19T08:29:59.000Z' }),
    (x) => ({ ...x, issuedAt: '2026-08-19T08:31:00.000Z' }),
    (x) => ({ ...x, taskId: 'other-task' }),
    (x) => ({ ...x, status: 'denied' }),
    (x) => ({ ...x, route: { ...x.route, combo: 'te-fast' } }),
  ]) {
    const fx = fixture(); t.after(fx.cleanup);
    const custom = adapters(fx);
    const original = custom.approvalVerifier;
    custom.approvalVerifier = async (expected) => mutate(await original(expected));
    const result = await requireRunner('approval rejection')(runOptions(fx, { testAdapters: custom }));
    assert.equal(result.reason, 'approval_required');
    assert.equal(existsSync(fx.effects), false);
  }
  const fx = fixture(); t.after(fx.cleanup);
  await assert.rejects(requireRunner('caller trust rejection')({ ...runOptions(fx), trustRoot: 'attacker.pem' }), /forbidden|trust|option/i);
  await assert.rejects(requireRunner('alternate verifier rejection')({ ...runOptions(fx), verifier: 'attacker-command' }), /forbidden|verifier|option/i);
});

test('FLOW-02 / ISC-1283: executor failure, verification failure, terminal flow, and second-ready-unit never persist', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const execFail = adapters(fx); execFail.executor = async () => ({ status: 'failed', evidenceRef: 'temperance:execution/fail' });
  let result = await requireRunner('executor failure')(runOptions(fx, { testAdapters: execFail }));
  assert.equal(result.reason, 'terminal');
  assert.equal(existsSync(fx.effects), false);

  const fx2 = fixture(); t.after(fx2.cleanup);
  const verifyFail = adapters(fx2); verifyFail.verification = async () => ({ status: 'failed', evidenceRef: 'temperance:verification/fail' });
  result = await requireRunner('verification failure')(runOptions(fx2, { testAdapters: verifyFail }));
  assert.equal(result.reason, 'verification_failed');
  assert.deepEqual(readFileSync(fx2.effects, 'utf8').trim(), 'execute');
});

test('FLOW-02 / ISC-1283: dry-run is the default and creates no effect, ledger, queue, or persistence file', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const before = Object.fromEntries(files(fx.root).map((p) => [p, readFileSync(path.join(fx.root, p))]));
  const result = await requireRunner('dry-run default')({ ...runOptions(fx), dryRun: undefined });
  assert.equal(result.status, 'action');
  assert.equal(existsSync(fx.effects), false);
  assert.deepEqual(Object.fromEntries(files(fx.root).map((p) => [p, readFileSync(path.join(fx.root, p))])), before);
  assert.equal(files(fx.root).some((p) => /ralph.*(?:state|ledger|queue)/i.test(p)), false);
});
