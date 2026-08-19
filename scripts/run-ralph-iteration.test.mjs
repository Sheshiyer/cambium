import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateRalphIteration } from './ralph-iteration.mjs';
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
  writeFileSync(statePath, readFileSync(statePath, 'utf8')
    .replace(/^Phase: \d+ of 7 \([^\n]+\)$/m, 'Phase: 5 of 7 (Ralph and Temperance Flow Projection)')
    .replace(/\/gsd:[^`]+/, '/gsd:execute-phase 5'));
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
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'fixture@example.invalid'],
    ['config', 'user.name', 'Fixture'],
    ['add', '.'],
    ['commit', '-qm', 'reviewed fixture checkout'],
  ]) {
    const result = spawnSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
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
      sourceSnapshotDigest: expected.sourceSnapshotDigest,
      persistencePaths: expected.persistencePaths,
      checkout: expected.checkout,
      evidenceRef: 'manifest:event/task01', payloadDigest: digest('host-payload'),
    },
    approval: {
      schema: 'temperance.owner-approval.v1', verified: true, status: 'approved',
      issuer: 'temperance-manifest-bridge', audience: 'cambium-ralph-iteration', issuedAt,
      expiresAt: '2026-08-19T09:00:00.000Z', nonce: 'approval-nonce', approvalRef: 'manifest:approval/task01',
      taskId: expected.taskId, command: expected.command, route: expected.route,
      projectionDigest: expected.projectionDigest, sourceSetDigest: expected.sourceSetDigest,
      sourceSnapshotDigest: expected.sourceSnapshotDigest,
      persistencePaths: expected.persistencePaths,
      checkout: expected.checkout,
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
      assert.equal(request.schema, 'cambium.ralph-execution-request.v2');
      assert.equal(request.sourceSnapshot.digest, objectDigest(request.sourceSnapshot.files));
      for (const [relative, expectedDigest] of Object.entries(request.sourceSnapshot.files)) {
        assert.equal(digest(readFileSync(path.join(fx.root, relative))), expectedDigest, relative);
      }
      const result = spawnSync(process.execPath, [fx.executable, fx.effects], { encoding: 'utf8' });
      const receipt = {
        schema: 'temperance.execution-receipt.v1', status: result.status === 0 ? 'succeeded' : 'failed',
        idempotencyKey: request.idempotencyKey, taskId: request.taskId, command: request.command,
        route: request.route, checkout: request.checkout, sourceSnapshotDigest: request.sourceSnapshot.digest,
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
        checkout: request.checkout,
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
    approvalReference: 'manifest:approval/task01',
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

test('FLOW-02 / CR-03: production derives three fixed surfaces and rejects digest-only replay markers', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const options = runOptions(fx);
  for (const injected of [
    { summaryPath: fx.statePath },
    { statePath: fx.summaryPath },
    { handoffPath: fx.summaryPath },
  ]) {
    await assert.rejects(requireRunner('caller persistence path rejection')({ ...options, ...injected }), /forbidden|path|option/i);
  }

  const action = await requireRunner('derive fixed persistence identity')({ ...options, dryRun: undefined });
  const stateTarget = path.join(fx.root, fx.statePath);
  writeFileSync(stateTarget, `${readFileSync(stateTarget, 'utf8')}\n<!-- cambium-ralph-result-v1 ${JSON.stringify({
    iterationDigest: action.iterationDigest,
    resultDigest: digest('attacker-result'),
    surface: 'state',
  })} -->\n`);
  const stopped = await requireRunner('reject digest-only state replay')(options);
  assert.equal(stopped.reason, 'source_drift');
  assert.equal(existsSync(fx.effects), false);
  assert.equal(readFileSync(path.join(fx.root, fx.handoffPath), 'utf8').includes(action.iterationDigest), false);
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
    (x) => ({ ...x, checkout: { ...x.checkout, rootDigest: digest('other-root') } }),
  ]) {
    const fx = fixture(); t.after(fx.cleanup);
    const custom = adapters(fx);
    const original = custom.approvalVerifier;
    custom.approvalVerifier = async (expected) => mutate(await original(expected));
    const result = await requireRunner('approval rejection')(runOptions(fx, { testAdapters: custom }));
    assert.equal(result.reason, 'approval_required');
    assert.doesNotThrow(() => validateRalphIteration(result));
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

test('FLOW-02 / CR-02: checkout identity drift and clone replay stop before execution', async (t) => {
  const first = fixture(); const second = fixture();
  t.after(first.cleanup); t.after(second.cleanup);
  const firstAction = await requireRunner('first checkout identity')({ ...runOptions(first), dryRun: undefined });
  const secondAction = await requireRunner('second checkout identity')({ ...runOptions(second), dryRun: undefined });
  assert.notEqual(firstAction.checkout.repositoryId, secondAction.checkout.repositoryId);
  assert.notEqual(firstAction.checkout.rootDigest, secondAction.checkout.rootDigest);
  assert.notEqual(firstAction.iterationDigest, secondAction.iterationDigest);

  const custom = adapters(first);
  const originalApproval = custom.approvalVerifier;
  custom.approvalVerifier = async (expected) => {
    const approved = await originalApproval(expected);
    const changed = spawnSync('/usr/bin/git', ['-C', first.root, 'commit', '--allow-empty', '-qm', 'concurrent HEAD drift'], { encoding: 'utf8' });
    assert.equal(changed.status, 0, changed.stderr || changed.stdout);
    return approved;
  };
  const stopped = await requireRunner('checkout HEAD revalidation')(runOptions(first, { testAdapters: custom }));
  assert.equal(stopped.reason, 'source_drift');
  assert.equal(existsSync(first.effects), false);
});

test('FLOW-02 / CR-01: production-equivalent execution resolves owner-protected digest-bound host commands', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const { testAdapters: _ignored, ...publicOptions } = runOptions(fx, { dryRun: undefined });
  const action = await requireRunner('derive protected boundary bindings')(runOptions(fx, { dryRun: undefined }));
  const hostRoot = path.dirname(fx.executable);
  const configPath = path.join(hostRoot, 'fixed-config.json');
  const currentBindings = verificationResults({
    taskId: action.task.id, command: action.command, route: action.route,
    projectionDigest: action.projectionDigest, sourceSetDigest: action.sourceSetDigest,
    sourceSnapshotDigest: (() => {
      const flow = JSON.parse(readFileSync(path.join(fx.root, fx.projectionPath), 'utf8'));
      const sourcePaths = [
        fx.projectionPath,
        flow.references.isa?.path,
        flow.references.gsd?.path,
        flow.references.plan?.path,
        flow.references.intentGraph.path,
        ...flow.references.supporting.map(({ path: pathname }) => pathname),
        flow.result.task?.source.path,
        ...flow.gates.map(({ source }) => source.path),
        ...flow.stops.map(({ source }) => source.path),
        fx.summaryPath,
        fx.statePath,
        fx.handoffPath,
      ].filter(Boolean);
      const sourceFiles = Object.fromEntries([...new Set(sourcePaths)].sort().map((relative) => [
        relative,
        digest(readFileSync(path.join(fx.root, relative))),
      ]));
      return objectDigest(sourceFiles);
    })(),
    persistencePaths: { summary: fx.summaryPath, state: fx.statePath, handoff: fx.handoffPath },
    checkout: action.checkout,
  });
  writeFileSync(configPath, JSON.stringify(currentBindings));
  const node = process.execPath;
  const commands = {
    'temperance-manifest-verify': `#!${node}
import{appendFileSync,readFileSync}from'node:fs';const u=new URL('.',import.meta.url);appendFileSync(new URL('environment.log',u),process.env.CAMBIUM_ATTACKER_VALUE??'scrubbed');const c=JSON.parse(readFileSync(new URL('fixed-config.json',u),'utf8'));const k=process.argv[process.argv.indexOf('--kind')+1];process.stdout.write(JSON.stringify(k==='approval'?c.approval:c.host));\n`,
    'temperance-ralph-execute': `#!${node}
import{appendFileSync,existsSync,readFileSync,writeFileSync}from'node:fs';const u=new URL('.',import.meta.url),p=new URL('execution-receipt.json',u);const lookup=process.argv.includes('--lookup');if(lookup){if(!existsSync(p))process.exit(3);process.stdout.write(readFileSync(p,'utf8'));}else{let b='';for await(const c of process.stdin)b+=c;const r=JSON.parse(b);appendFileSync(new URL('effects.log',u),'execute\\n');appendFileSync(new URL('cwd.log',u),process.cwd()+'\\n');const out={schema:'temperance.execution-receipt.v1',status:'succeeded',idempotencyKey:r.idempotencyKey,taskId:r.taskId,command:r.command,route:r.route,checkout:r.checkout,sourceSnapshotDigest:r.sourceSnapshot.digest,evidenceRef:'temperance:execution/task01',payloadDigest:'${digest('execution-payload')}'};writeFileSync(p,JSON.stringify(out));process.stdout.write(JSON.stringify(out));}\n`,
    'temperance-ralph-verify': `#!${node}
import{createHash}from'node:crypto';import{appendFileSync,existsSync,readFileSync,writeFileSync}from'node:fs';const u=new URL('.',import.meta.url),p=new URL('verification-receipt.json',u);const cj=v=>Array.isArray(v)?'['+v.map(cj).join(',')+']':v===null||typeof v!=='object'?JSON.stringify(v):'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+cj(v[k])).join(',')+'}';const lookup=process.argv.includes('--lookup');if(lookup){if(!existsSync(p))process.exit(3);process.stdout.write(readFileSync(p,'utf8'));}else{let b='';for await(const c of process.stdin)b+=c;const r=JSON.parse(b);appendFileSync(new URL('effects.log',u),'verify\\n');const out={schema:'temperance.declared-verification-receipt.v1',status:'passed',idempotencyKey:r.idempotencyKey,taskId:r.taskId,checkout:r.checkout,declaredVerificationDigest:'sha256:'+createHash('sha256').update(cj(r.declaredVerification)).digest('hex'),executionEvidenceRef:r.executionEvidenceRef,evidenceRef:'temperance:verification/task01',payloadDigest:'${digest('verification-payload')}'};writeFileSync(p,JSON.stringify(out));process.stdout.write(JSON.stringify(out));}\n`,
  };
  const descriptors = {};
  for (const [name, body] of Object.entries(commands)) {
    const pathname = path.join(hostRoot, name);
    writeFileSync(pathname, body);
    chmodSync(pathname, 0o700);
    descriptors[name === 'temperance-manifest-verify' ? 'manifestVerifier' : name === 'temperance-ralph-execute' ? 'ralphExecutor' : 'ralphVerifier'] = {
      path: name,
      digest: digest(body),
    };
  }
  const manifestPath = path.join(hostRoot, 'boundary.v1.json');
  writeFileSync(manifestPath, JSON.stringify({
    schema: 'temperance.cambium-ralph-boundary.v1', issuer: 'temperance-engine', audience: 'cambium-ralph-iteration', commands: descriptors,
  }));
  chmodSync(hostRoot, 0o700);
  const savedAttacker = process.env.CAMBIUM_ATTACKER_VALUE;
  process.env.CAMBIUM_ATTACKER_VALUE = 'leaked';
  t.after(() => savedAttacker === undefined ? delete process.env.CAMBIUM_ATTACKER_VALUE : process.env.CAMBIUM_ATTACKER_VALUE = savedAttacker);
  const protectedRunner = subject.createProtectedRalphIterationRunnerForTesting(
    { installationRoot: hostRoot, manifestPath }, () => '2026-08-19T08:30:00.000Z',
  );
  const result = await protectedRunner({ ...publicOptions, dryRun: false });
  assert.equal(result.reason, 'iteration_complete');
  assert.deepEqual(readFileSync(fx.effects, 'utf8').trim().split('\n'), ['execute', 'verify']);
  assert.equal(readFileSync(path.join(hostRoot, 'cwd.log'), 'utf8').trim(), realpathSync(fx.root));
  assert.equal(readFileSync(path.join(hostRoot, 'environment.log'), 'utf8'), 'scrubbedscrubbed');

  const tampered = `${commands['temperance-ralph-execute']}\n// attacker mutation\n`;
  writeFileSync(path.join(hostRoot, 'temperance-ralph-execute'), tampered);
  await assert.rejects(
    async () => subject.createProtectedRalphIterationRunnerForTesting(
      { installationRoot: hostRoot, manifestPath }, () => '2026-08-19T08:30:00.000Z',
    )({ ...publicOptions, dryRun: undefined }),
    /digest does not match/i,
  );
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

test('FLOW-02 / CR-01: live selected-source drift blocks dry-run and execution before any effect', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const projection = JSON.parse(readFileSync(path.join(fx.root, fx.projectionPath), 'utf8'));
  const planPath = projection.references.plan.path;
  const planTarget = path.join(fx.root, planPath);
  writeFileSync(planTarget, `${readFileSync(planTarget, 'utf8')}\n<!-- revoked after projection -->\n`);

  const { testAdapters: _ignored, ...publicOptions } = runOptions(fx, { dryRun: undefined });
  const inspected = await subject.runRalphIteration(publicOptions);
  assert.equal(inspected.status, 'stop');
  assert.equal(inspected.reason, 'source_drift');

  const attempted = await requireRunner('live source parity')(runOptions(fx));
  assert.equal(attempted.status, 'stop');
  assert.equal(attempted.reason, 'source_drift');
  assert.equal(existsSync(fx.effects), false);
});

test('FLOW-02 / CR-01: public dry-run is host-independent and absent host execution fails closed', async (t) => {
  const fx = fixture(); t.after(fx.cleanup);
  const { testAdapters: _ignored, ...publicOptions } = runOptions(fx, { dryRun: undefined });
  const inspected = await subject.runRalphIteration(publicOptions);
  assert.equal(inspected.status, 'action');
  assert.match(inspected.checkout.repositoryId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(inspected.checkout.reviewedCommit, spawnSync('/usr/bin/git', ['-C', fx.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim());
  assert.match(inspected.checkout.rootDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(existsSync(fx.effects), false);

  const stopped = await subject.runRalphIteration({ ...publicOptions, dryRun: false });
  assert.equal(stopped.status, 'stop');
  assert.equal(stopped.reason, 'host_boundary_unavailable');
  assert.deepEqual(stopped.hostBoundary, {
    status: 'unavailable',
    owner: 'temperance_engine',
    requiredAction: 'separately_authorized_installation',
  });
  assert.equal(existsSync(fx.effects), false);
  assert.doesNotMatch(JSON.stringify(stopped), /\/Users\/|\/Volumes\/|\.temperance_engine|credential|secret/i);
});
