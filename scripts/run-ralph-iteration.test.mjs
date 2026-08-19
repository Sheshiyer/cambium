import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileTemperanceFlow, renderTemperanceFlowMarkdown } from './temperance-flow.mjs';
import { buildTemperanceFlowSources } from './temperance-flow-sources.mjs';

const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);
let subject = null;
try {
  subject = await import('./run-ralph-iteration.mjs');
} catch {
  // RED remains a semantic assertion below.
}
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};
const objectDigest = (value) => digest(canonicalJson(value));

function requireRunner(label) {
  assert.equal(typeof subject?.createRalphIterationRunnerForTesting, 'function', `${label}: bounded Ralph test factory is not implemented`);
  return (options) => {
    const { testAdapters, ...productionOptions } = options;
    return subject.createRalphIterationRunnerForTesting(testAdapters)(productionOptions);
  };
}

function copy(root, relative) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(repositoryRoot, relative), target);
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'cambium-ralph-runner-'));
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'cambium-ralph-host-'));
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
  writeFileSync(statePath, readFileSync(statePath, 'utf8').replace(/\/gsd:[^`]+/, '/gsd:execute-phase 5'));
  const executable = path.join(hostRoot, 'fixture-executor.mjs');
  const verifier = path.join(hostRoot, 'fixture-verifier.mjs');
  writeFileSync(executable, "import{appendFileSync}from'node:fs';appendFileSync(process.argv[2],'execute\\n');\n");
  writeFileSync(verifier, "import{appendFileSync}from'node:fs';appendFileSync(process.argv[2],'verify\\n');\n");
  const effects = path.join(hostRoot, 'effects.log');
  const projectionPath = 'docs/architecture/temperance-flow.v1.json';
  const model = buildTemperanceFlowSources(root, { receiptReference: 'manifest:phase5/task01' });
  const flow = compileTemperanceFlow({ repositoryRoot: root, ...model });
  mkdirSync(path.dirname(path.join(root, projectionPath)), { recursive: true });
  writeFileSync(path.join(root, projectionPath), `${JSON.stringify(flow, null, 2)}\n`);
  writeFileSync(path.join(root, 'docs/architecture/temperance-flow.md'), renderTemperanceFlowMarkdown(flow));
  writeFileSync(path.join(root, summaryPath), '# Plan 05-03 Summary\n');
  return {
    root, summaryPath, statePath: '.planning/STATE.md', handoffPath: '.project/HANDOFF.md', projectionPath,
    executable, verifier, effects, executionReceipt: path.join(hostRoot, 'execution-receipt.json'),
    verificationReceipt: path.join(hostRoot, 'verification-receipt.json'),
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(hostRoot, { recursive: true, force: true });
    },
  };
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
    clock: () => '2026-08-19T08:30:00.000Z',
    manifestVerifier: async (expected) => (get() ?? verificationResults(expected)).host,
    approvalVerifier: async (expected) => (get() ?? verificationResults(expected)).approval,
    executionReceiptResolver: async () => existsSync(fx.executionReceipt) ? JSON.parse(readFileSync(fx.executionReceipt, 'utf8')) : null,
    executor: async (request) => {
      const result = spawnSync(process.execPath, [fx.executable, fx.effects], { encoding: 'utf8' });
      const receipt = {
        schema: 'temperance.execution-receipt.v1', status: result.status === 0 ? 'succeeded' : 'failed',
        idempotencyKey: request.idempotencyKey, taskId: request.taskId, command: request.command,
        route: request.route, sourceSnapshotDigest: request.sourceSnapshotDigest,
        evidenceRef: 'temperance:execution/task01', payloadDigest: digest('execution-payload'),
      };
      if (receipt.status === 'succeeded') writeFileSync(fx.executionReceipt, JSON.stringify(receipt));
      return receipt;
    },
    verificationReceiptResolver: async () => existsSync(fx.verificationReceipt) ? JSON.parse(readFileSync(fx.verificationReceipt, 'utf8')) : null,
    verification: async (request) => {
      const result = spawnSync(process.execPath, [fx.verifier, fx.effects], { encoding: 'utf8' });
      const receipt = {
        schema: 'temperance.declared-verification-receipt.v1', status: result.status === 0 ? 'passed' : 'failed',
        idempotencyKey: request.idempotencyKey, taskId: request.taskId,
        declaredVerificationDigest: objectDigest(request.declaredVerification),
        executionEvidenceRef: request.executionEvidenceRef,
        evidenceRef: 'temperance:verification/task01', payloadDigest: digest('verification-payload'),
      };
      if (receipt.status === 'passed') writeFileSync(fx.verificationReceipt, JSON.stringify(receipt));
      return receipt;
    },
    summaryAdapter: options.summaryAdapter,
    stateAdapter: options.stateAdapter,
    handoffAdapter: options.handoffAdapter,
    atomicWriter: options.atomicWriter,
  };
}

function runOptions(fx, extra = {}) {
  return {
    root: fx.root, projectionPath: fx.projectionPath, receiptReference: 'manifest:phase5/task01',
    approvalReference: 'manifest:approval/task01', summaryPath: fx.summaryPath,
    statePath: fx.statePath, handoffPath: fx.handoffPath,
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
    const intentGraph = path.join(fx.root, 'docs/architecture/intent-graph.v1.json');
    writeFileSync(intentGraph, `${readFileSync(intentGraph, 'utf8')}drift\n`);
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

test('FLOW-02 / CR-03: summary-adapter and atomic-rename crashes recover from host receipts without repeated effects', async (t) => {
  for (const mode of ['adapter', 'rename']) {
    const fx = fixture(); t.after(fx.cleanup);
    const interrupted = adapters(fx, mode === 'adapter'
      ? { summaryAdapter: () => { throw new Error('forced summary adapter crash'); } }
      : { atomicWriter: () => { throw new Error('forced summary rename crash'); } });
    await assert.rejects(requireRunner(`summary ${mode} crash`)(runOptions(fx, { testAdapters: interrupted })), /forced summary/);
    assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
    const recovered = await requireRunner(`summary ${mode} receipt recovery`)(runOptions(fx));
    assert.equal(recovered.reason, 'iteration_complete');
    assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  }
});

test('FLOW-03 / CR-05: caller receipt references cannot relabel the projected route', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  await assert.rejects(
    requireRunner('route receipt binding')(runOptions(fx, { receiptReference: 'manifest:phase5/other' })),
    /receipt reference|route intent|exactly match/i,
  );
  assert.equal(existsSync(fx.effects), false);
});

test('FLOW-02 / CR-02: forged, partial, duplicated, and field-tampered summary records never authorize recovery', async (t) => {
  const mutations = [
    (record) => ({ ...record, taskId: 'attacker-task' }),
    (record) => ({ ...record, route: { ...record.route, receiptRef: 'manifest:phase5/other' } }),
    (record) => ({ ...record, resultDigest: digest('forged-result') }),
    (record) => ({ ...record, outcome: { ...record.outcome, reason: 'terminal' } }),
    (record) => ({ ...record, sourceSnapshotDigest: digest('forged-source-snapshot') }),
    (record) => ({ ...record, executionEvidenceRef: 'temperance:execution/other' }),
    (record) => ({ ...record, attackerField: true }),
  ];
  for (const mutate of mutations) {
    const fx = fixture(); t.after(fx.cleanup);
    await requireRunner('seed recovery record')(runOptions(fx));
    const target = path.join(fx.root, fx.summaryPath);
    const body = readFileSync(target, 'utf8');
    const match = /<!-- cambium-ralph-result-v1 (\{[^\n]+\}) -->/.exec(body);
    assert.ok(match);
    const changed = body.replace(match[1], JSON.stringify(mutate(JSON.parse(match[1]))));
    writeFileSync(target, changed);
    const stopped = await requireRunner('reject tampered recovery')(runOptions(fx));
    assert.equal(stopped.reason, 'source_drift');
    assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  }

  const partial = fixture(); t.after(partial.cleanup);
  const action = await requireRunner('derive partial marker identity')({ ...runOptions(partial), dryRun: undefined });
  const partialTarget = path.join(partial.root, partial.summaryPath);
  writeFileSync(partialTarget, `${readFileSync(partialTarget, 'utf8')}\n<!-- cambium-ralph-result-v1 ${JSON.stringify({ surface: 'summary', iterationDigest: action.iterationDigest, resultDigest: digest('shape-only') })} -->\n`);
  assert.equal((await requireRunner('reject shape-only marker')(runOptions(partial))).reason, 'source_drift');
  assert.equal(existsSync(partial.effects), false);

  const duplicate = fixture(); t.after(duplicate.cleanup);
  await requireRunner('seed duplicate marker')(runOptions(duplicate));
  const duplicateTarget = path.join(duplicate.root, duplicate.summaryPath);
  const duplicateBody = readFileSync(duplicateTarget, 'utf8');
  writeFileSync(duplicateTarget, `${duplicateBody}${duplicateBody.match(/<!-- cambium-ralph-result-v1 \{[^\n]+\} -->/)[0]}\n`);
  await assert.rejects(requireRunner('reject duplicate marker')(runOptions(duplicate)), /exactly one|well-formed/i);
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
  const { testAdapters: _testOnly, ...publicOptions } = runOptions(fx);
  await assert.rejects(subject.runRalphIteration({ ...publicOptions, now: '2026-08-19T08:30:00.000Z' }), /forbidden|now|option/i);
  for (const injected of ['testAdapters', 'manifestVerifier', 'approvalVerifier', 'executor', 'verification']) {
    await assert.rejects(subject.runRalphIteration({ ...runOptions(fx), [injected]: () => ({}) }), /forbidden|option/i);
  }
});

test('FLOW-03 / CR-02: freshness clocks are factory-owned and sampled after each verifier response', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const custom = adapters(fx);
  const samples = ['2026-08-19T08:30:00.000Z', '2026-08-19T09:00:00.000Z'];
  custom.clock = () => samples.shift() ?? '2026-08-19T09:00:00.000Z';
  const result = await requireRunner('per-response freshness clock')(runOptions(fx, { testAdapters: custom }));
  assert.equal(result.reason, 'approval_required');
  assert.equal(existsSync(fx.effects), false);
  assert.equal(samples.length, 0, 'both verifier responses must receive an independent post-response clock sample');
});

test('FLOW-02 / CR-01: the public runner completes only through fixed host command integrations', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const { testAdapters: _ignored, ...publicOptions } = runOptions(fx, { dryRun: undefined });
  const action = await subject.runRalphIteration(publicOptions);
  const hostRoot = path.dirname(fx.executable);
  const configPath = path.join(hostRoot, 'fixed-config.json');
  const currentIssuedAt = new Date(Date.now() - 60_000).toISOString();
  const currentExpiresAt = new Date(Date.now() + 60_000).toISOString();
  const currentBindings = verificationResults({
    taskId: action.task.id, command: action.command, route: action.route,
    projectionDigest: action.projectionDigest, sourceSetDigest: action.sourceSetDigest,
  });
  currentBindings.host = { ...currentBindings.host, issuedAt: currentIssuedAt, expiresAt: currentExpiresAt };
  currentBindings.approval = { ...currentBindings.approval, issuedAt: currentIssuedAt, expiresAt: currentExpiresAt };
  writeFileSync(configPath, JSON.stringify(currentBindings));
  const commands = {
    'temperance-manifest-verify': `#!/usr/bin/env node
import{readFileSync}from'node:fs';const c=JSON.parse(readFileSync(process.env.CAMBIUM_FIXED_TEST_CONFIG,'utf8'));const k=process.argv[process.argv.indexOf('--kind')+1];process.stdout.write(JSON.stringify(k==='approval'?c.approval:c.host));\n`,
    'temperance-ralph-execute': `#!/usr/bin/env node
import{appendFileSync,existsSync,readFileSync,writeFileSync}from'node:fs';const lookup=process.argv.includes('--lookup');if(lookup){if(!existsSync(process.env.CAMBIUM_FIXED_EXECUTION_RECEIPT))process.exit(3);process.stdout.write(readFileSync(process.env.CAMBIUM_FIXED_EXECUTION_RECEIPT,'utf8'));}else{let b='';for await(const c of process.stdin)b+=c;const r=JSON.parse(b);appendFileSync(process.env.CAMBIUM_FIXED_EFFECTS,'execute\\n');const out={schema:'temperance.execution-receipt.v1',status:'succeeded',idempotencyKey:r.idempotencyKey,taskId:r.taskId,command:r.command,route:r.route,sourceSnapshotDigest:r.sourceSnapshotDigest,evidenceRef:'temperance:execution/task01',payloadDigest:'${digest('execution-payload')}'};writeFileSync(process.env.CAMBIUM_FIXED_EXECUTION_RECEIPT,JSON.stringify(out));process.stdout.write(JSON.stringify(out));}\n`,
    'temperance-ralph-verify': `#!/usr/bin/env node
import{createHash}from'node:crypto';import{appendFileSync,existsSync,readFileSync,writeFileSync}from'node:fs';const cj=v=>Array.isArray(v)?'['+v.map(cj).join(',')+']':v===null||typeof v!=='object'?JSON.stringify(v):'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+cj(v[k])).join(',')+'}';const lookup=process.argv.includes('--lookup');if(lookup){if(!existsSync(process.env.CAMBIUM_FIXED_VERIFICATION_RECEIPT))process.exit(3);process.stdout.write(readFileSync(process.env.CAMBIUM_FIXED_VERIFICATION_RECEIPT,'utf8'));}else{let b='';for await(const c of process.stdin)b+=c;const r=JSON.parse(b);appendFileSync(process.env.CAMBIUM_FIXED_EFFECTS,'verify\\n');const out={schema:'temperance.declared-verification-receipt.v1',status:'passed',idempotencyKey:r.idempotencyKey,taskId:r.taskId,declaredVerificationDigest:'sha256:'+createHash('sha256').update(cj(r.declaredVerification)).digest('hex'),executionEvidenceRef:r.executionEvidenceRef,evidenceRef:'temperance:verification/task01',payloadDigest:'${digest('verification-payload')}'};writeFileSync(process.env.CAMBIUM_FIXED_VERIFICATION_RECEIPT,JSON.stringify(out));process.stdout.write(JSON.stringify(out));}\n`,
  };
  for (const [name, body] of Object.entries(commands)) {
    const pathname = path.join(hostRoot, name);
    writeFileSync(pathname, body);
    chmodSync(pathname, 0o700);
  }
  const saved = {
    PATH: process.env.PATH,
    config: process.env.CAMBIUM_FIXED_TEST_CONFIG,
    execution: process.env.CAMBIUM_FIXED_EXECUTION_RECEIPT,
    verification: process.env.CAMBIUM_FIXED_VERIFICATION_RECEIPT,
    effects: process.env.CAMBIUM_FIXED_EFFECTS,
  };
  t.after(() => {
    process.env.PATH = saved.PATH;
    for (const [key, value] of [
      ['CAMBIUM_FIXED_TEST_CONFIG', saved.config], ['CAMBIUM_FIXED_EXECUTION_RECEIPT', saved.execution],
      ['CAMBIUM_FIXED_VERIFICATION_RECEIPT', saved.verification], ['CAMBIUM_FIXED_EFFECTS', saved.effects],
    ]) value === undefined ? delete process.env[key] : process.env[key] = value;
  });
  process.env.PATH = `${hostRoot}${path.delimiter}${saved.PATH}`;
  process.env.CAMBIUM_FIXED_TEST_CONFIG = configPath;
  process.env.CAMBIUM_FIXED_EXECUTION_RECEIPT = fx.executionReceipt;
  process.env.CAMBIUM_FIXED_VERIFICATION_RECEIPT = fx.verificationReceipt;
  process.env.CAMBIUM_FIXED_EFFECTS = fx.effects;
  const result = await subject.runRalphIteration({ ...publicOptions, dryRun: false });
  assert.equal(result.reason, 'iteration_complete');
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
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
