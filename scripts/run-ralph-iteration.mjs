import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { deriveRalphIteration, validateRalphIteration } from './ralph-iteration.mjs';
import { validateTemperanceFlowProjectionSources } from './temperance-flow.mjs';
import { createTemperanceHostCommandRunner } from './temperance-host-boundary.mjs';
import { compareAndSwapTextFile } from './versioned-file-cas.mjs';

const FIXED_ISSUER = 'temperance-manifest-bridge';
const FIXED_AUDIENCE = 'cambium-ralph-iteration';
const HOST_SCHEMA = 'temperance.manifest-verification.v1';
const APPROVAL_SCHEMA = 'temperance.owner-approval.v1';
const EXECUTION_SCHEMA = 'temperance.execution-receipt.v1';
const VERIFICATION_SCHEMA = 'temperance.declared-verification-receipt.v1';
const MARKER = 'cambium-ralph-result-v1';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_REFERENCE = /^(?:manifest|temperance):[A-Za-z0-9._:/-]+$/;
const ALLOWED_OPTIONS = new Set([
  'root', 'projectionPath', 'receiptReference', 'approvalReference', 'dryRun',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

const digestBytes = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const digestObject = (value) => digestBytes(canonicalJson(value));

function contained(root, relative, { mayCreate = false } = {}) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0')) throw new TypeError('runner paths must be repository-relative POSIX paths');
  const normalized = path.posix.normalize(relative);
  if (normalized !== relative || normalized === '..' || normalized.startsWith('../')) throw new TypeError('runner path escapes repository root');
  const lexical = path.join(root, ...relative.split('/'));
  const entry = lstatSync(lexical, { throwIfNoEntry: false });
  if (entry?.isSymbolicLink()) throw new TypeError(`runner path ${relative} must not be a symlink`);
  if (!entry && !mayCreate) throw new TypeError(`runner path ${relative} is missing`);
  const parent = realpathSync(path.dirname(lexical));
  const resolved = entry ? realpathSync(lexical) : path.join(parent, path.basename(lexical));
  const relation = path.relative(root, resolved);
  if (relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) throw new TypeError(`runner path ${relative} escapes repository root`);
  return resolved;
}

function readRelative(root, relative) {
  return readFileSync(contained(root, relative), 'utf8');
}

function allProjectionPaths(flow) {
  const values = [flow.references.isa, flow.references.gsd, flow.references.plan, flow.references.intentGraph, ...flow.references.supporting];
  if (flow.result.task?.source) values.push(flow.result.task.source);
  values.push(...flow.gates.map(({ source }) => source), ...flow.stops.map(({ source }) => source));
  return [...new Set(values.filter(Boolean).map(({ path: pathname }) => pathname))].sort();
}

function snapshot(root, relativePaths) {
  const files = Object.fromEntries([...new Set(relativePaths)].sort().map((relative) => [relative, digestBytes(readRelative(root, relative))]));
  return { files, digest: digestObject(files) };
}

function gitValue(root, args, label, { optional = false } = {}) {
  const result = spawnSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const value = result.status === 0 ? result.stdout.trim() : '';
  if (!value && !optional) throw new TypeError(`runner cannot resolve ${label} from the reviewed checkout`);
  return value || null;
}

function resolveCheckoutIdentity(root) {
  const topLevel = realpathSync(gitValue(root, ['rev-parse', '--show-toplevel'], 'repository root'));
  if (topLevel !== root) throw new TypeError('runner root must equal the reviewed Git checkout root');
  const reviewedCommit = gitValue(root, ['rev-parse', 'HEAD'], 'reviewed commit');
  if (!/^[a-f0-9]{40,64}$/.test(reviewedCommit)) throw new TypeError('runner reviewed commit is invalid');
  const commonRaw = gitValue(root, ['rev-parse', '--git-common-dir'], 'repository identity');
  const commonDirectory = realpathSync(path.resolve(root, commonRaw));
  const origin = gitValue(root, ['config', '--get', 'remote.origin.url'], 'repository origin', { optional: true });
  return Object.freeze({
    repositoryId: digestObject({ commonDirectory: digestBytes(commonDirectory), origin: origin === null ? null : digestBytes(origin) }),
    reviewedCommit,
    rootDigest: digestBytes(root),
  });
}

function markerFor(record, surface) {
  return `\n<!-- ${MARKER} ${JSON.stringify({ ...record, surface })} -->\n`;
}

function persistencePathsFor(action) {
  const planPath = action.task.source.path;
  if (!/^\.planning\/phases\/[^/]+\/[^/]+-PLAN\.md$/.test(planPath)) {
    throw new TypeError('Ralph action plan source cannot derive its summary persistence surface');
  }
  return Object.freeze({
    summary: planPath.replace(/-PLAN\.md$/, '-SUMMARY.md'),
    state: '.planning/STATE.md',
    handoff: '.project/HANDOFF.md',
  });
}

function findRecord(body) {
  const matches = [...body.matchAll(new RegExp(`<!-- ${MARKER} (\\{[^\\n]+\\}) -->`, 'g'))];
  const markerCount = body.split(`<!-- ${MARKER}`).length - 1;
  if (markerCount === 0) return null;
  if (markerCount !== 1 || matches.length !== 1) throw new TypeError('Ralph recovery surface must contain exactly one well-formed result marker');
  try { return JSON.parse(matches[0][1]); } catch { throw new TypeError('Ralph recovery marker is not valid JSON'); }
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function verifyBoundary(value, expected, kind, now) {
  const schema = kind === 'approval' ? APPROVAL_SCHEMA : HOST_SCHEMA;
  const status = kind === 'approval' ? 'approved' : 'verified';
  const refKey = kind === 'approval' ? 'approvalRef' : 'receiptRef';
  const allowed = new Set([
    'schema', 'verified', 'status', 'issuer', 'audience', 'issuedAt', 'expiresAt', 'nonce',
    refKey, 'taskId', 'command', 'route', 'projectionDigest', 'sourceSetDigest',
    'sourceSnapshotDigest', 'persistencePaths', 'checkout', 'evidenceRef', 'payloadDigest',
  ]);
  if (!value || Object.keys(value).some((key) => !allowed.has(key))) return null;
  if (value.schema !== schema || value.verified !== true || value.status !== status
      || value.issuer !== FIXED_ISSUER || value.audience !== FIXED_AUDIENCE) return null;
  const issued = Date.parse(value.issuedAt);
  const expires = Date.parse(value.expiresAt);
  const current = Date.parse(now);
  if (![issued, expires, current].every(Number.isFinite) || issued > current || expires <= current || expires <= issued || expires - issued > 3_600_000) return null;
  if (!SAFE_REFERENCE.test(value[refKey] ?? '') || value[refKey] !== expected.reference
      || value.taskId !== expected.taskId || value.command !== expected.command
      || value.projectionDigest !== expected.projectionDigest || value.sourceSetDigest !== expected.sourceSetDigest
      || value.sourceSnapshotDigest !== expected.sourceSnapshotDigest
      || !same(value.route, expected.route) || !same(value.persistencePaths, expected.persistencePaths)
      || !same(value.checkout, expected.checkout)
      || !SAFE_REFERENCE.test(value.evidenceRef ?? '')
      || typeof value.nonce !== 'string' || value.nonce.length === 0 || !DIGEST.test(value.payloadDigest ?? '')) return null;
  return {
    status,
    evidenceRef: value.evidenceRef,
    bindingDigest: digestObject({
      schema, status, reference: value[refKey], taskId: value.taskId, command: value.command,
      route: value.route, projectionDigest: value.projectionDigest, sourceSetDigest: value.sourceSetDigest,
      sourceSnapshotDigest: value.sourceSnapshotDigest, persistencePaths: value.persistencePaths,
      checkout: value.checkout, nonce: value.nonce, payloadDigest: value.payloadDigest,
    }),
  };
}

function protectedIntegrations(root, boundaryOptions) {
  const run = createTemperanceHostCommandRunner({ ...boundaryOptions, workingDirectory: root });
  const jsonInput = (value) => `${canonicalJson(value)}\n`;
  return Object.freeze({
    manifestVerifier: async (_expected, reference) => run('manifestVerifier', ['--json', '--reference', reference, '--kind', 'receipt']),
    approvalVerifier: async (_expected, reference) => run('manifestVerifier', ['--json', '--reference', reference, '--kind', 'approval']),
    executionReceiptResolver: async ({ iterationDigest }) => run(
      'ralphExecutor', ['--json', '--lookup', '--idempotency-key', iterationDigest], undefined, { allowMissing: true },
    ),
    executor: async (request) => run('ralphExecutor', ['--json', '--execute'], jsonInput(request)),
    verificationReceiptResolver: async ({ iterationDigest }) => run(
      'ralphVerifier', ['--json', '--lookup', '--idempotency-key', iterationDigest], undefined, { allowMissing: true },
    ),
    verification: async (request) => run('ralphVerifier', ['--json', '--verify'], jsonInput(request)),
  });
}

function validateExecutionReceipt(value, action, sourceSnapshotDigest) {
  const allowed = ['schema', 'status', 'idempotencyKey', 'taskId', 'command', 'route', 'checkout', 'sourceSnapshotDigest', 'evidenceRef', 'payloadDigest'];
  if (!value || Object.keys(value).sort().join() !== allowed.sort().join()) throw new TypeError('execution receipt must use the closed schema');
  if (value.schema !== EXECUTION_SCHEMA || value.status !== 'succeeded' || value.idempotencyKey !== action.iterationDigest
      || value.taskId !== action.task.id || value.command !== action.command || !same(value.route, action.route)
      || !same(value.checkout, action.checkout)
      || value.sourceSnapshotDigest !== sourceSnapshotDigest || !SAFE_REFERENCE.test(value.evidenceRef ?? '')
      || !DIGEST.test(value.payloadDigest ?? '')) throw new TypeError('execution receipt is not bound to the Ralph iteration');
  return value;
}

function validateVerificationReceipt(value, action, execution) {
  const allowed = ['schema', 'status', 'idempotencyKey', 'taskId', 'checkout', 'declaredVerificationDigest', 'executionEvidenceRef', 'evidenceRef', 'payloadDigest'];
  if (!value || Object.keys(value).sort().join() !== allowed.sort().join()) throw new TypeError('verification receipt must use the closed schema');
  if (value.schema !== VERIFICATION_SCHEMA || value.status !== 'passed' || value.idempotencyKey !== action.iterationDigest
      || value.taskId !== action.task.id || value.declaredVerificationDigest !== digestObject(action.declaredVerification)
      || !same(value.checkout, action.checkout)
      || value.executionEvidenceRef !== execution.evidenceRef || !SAFE_REFERENCE.test(value.evidenceRef ?? '')
      || !DIGEST.test(value.payloadDigest ?? '')) throw new TypeError('verification receipt is not bound to the Ralph iteration');
  return value;
}

function stopFromAction(action, reason, facts = {}) {
  const base = { schema: 'cambium.ralph-iteration.v1', status: 'stop', iterationDigest: action.iterationDigest, reason, ...facts };
  return Object.freeze({ ...base, resultDigest: digestObject(base) });
}

async function persistOne({ root, relative, surface, expectedDigest, record, adapter, writer }) {
  const target = contained(root, relative);
  const expectedRecord = { ...record, surface };
  return compareAndSwapTextFile({
    target,
    expectedDigest,
    ...(writer === undefined ? {} : { writer }),
    isAlreadyApplied: (current) => {
      const existing = findRecord(current);
      return existing !== null && same(existing, expectedRecord);
    },
    buildNext: async (current) => {
      const append = markerFor(record, surface);
      const next = adapter ? await adapter({ surface, path: relative, current, append, expectedDigest, record: structuredClone(record) }) : `${current}${append}`;
      if (typeof next !== 'string') throw new TypeError(`${surface} adapter must return complete text`);
      const nextRecord = findRecord(next);
      if (!same(nextRecord, expectedRecord)) {
        throw new TypeError(`${surface} adapter must preserve the complete stable Ralph receipt`);
      }
      return next;
    },
  });
}

function recoverySourceCheck(root, record, surfaces) {
  const { surface: _summarySurface, ...baseRecord } = record;
  for (const [relative, expectedDigest] of Object.entries(record.sourceFiles)) {
    const current = readRelative(root, relative);
    const surface = Object.entries(surfaces).find(([, pathname]) => pathname === relative)?.[0];
    if (surface) {
      const applied = findRecord(current);
      if (applied && same(applied, { ...baseRecord, surface })) continue;
    }
    if (digestBytes(current) !== expectedDigest) return false;
  }
  return true;
}

function validateRecoveryRecord(record, action, expected, paths, host, approved) {
  const allowed = [
    'surface', 'schema', 'iterationDigest', 'resultDigest', 'sourceSnapshotDigest', 'sourceFiles',
    'preimages', 'persistencePaths', 'taskId', 'command', 'route', 'projectionDigest', 'sourceSetDigest',
    'checkout', 'hostEvidenceRef', 'approvalEvidenceRef', 'executionEvidenceRef', 'verificationEvidenceRef', 'outcome',
  ];
  if (!record || Object.keys(record).sort().join() !== allowed.sort().join()) throw new TypeError('Ralph recovery record must use the closed schema');
  if (record.surface !== 'summary' || record.schema !== MARKER || record.iterationDigest !== action.iterationDigest
      || record.taskId !== action.task.id || record.command !== action.command || !same(record.route, action.route)
      || !same(record.checkout, action.checkout)
      || !same(record.persistencePaths, paths)
      || record.projectionDigest !== action.projectionDigest || record.sourceSetDigest !== action.sourceSetDigest
      || record.hostEvidenceRef !== host.evidenceRef || record.approvalEvidenceRef !== approved.evidenceRef) {
    throw new TypeError('Ralph recovery record is not bound to the approved action');
  }
  if (!record.sourceFiles || typeof record.sourceFiles !== 'object' || Array.isArray(record.sourceFiles)
      || Object.keys(record.sourceFiles).length === 0
      || Object.values(record.sourceFiles).some((digest) => !DIGEST.test(digest))) throw new TypeError('Ralph recovery source snapshot is invalid');
  if (digestObject(record.sourceFiles) !== record.sourceSnapshotDigest) throw new TypeError('Ralph recovery source snapshot digest is invalid');
  if (!record.preimages || Object.keys(record.preimages).sort().join() !== ['handoff', 'state', 'summary'].sort().join()) throw new TypeError('Ralph recovery preimages are invalid');
  for (const [surface, relative] of Object.entries(paths)) {
    if (record.preimages[surface] !== record.sourceFiles[relative]) throw new TypeError('Ralph recovery preimage is not in the approved source snapshot');
  }
  const outcome = validateRalphIteration(record.outcome, { expectedResultDigest: record.resultDigest });
  if (outcome.status !== 'stop' || outcome.reason !== 'iteration_complete'
      || outcome.iterationDigest !== record.iterationDigest || outcome.resultDigest !== record.resultDigest
      || !SAFE_REFERENCE.test(record.executionEvidenceRef ?? '') || !SAFE_REFERENCE.test(record.verificationEvidenceRef ?? '')) {
    throw new TypeError('Ralph recovery outcome is not a completed bounded iteration');
  }
  if (!same(expected.route, record.route)) throw new TypeError('Ralph recovery route differs from the approved projection');
  return record;
}

function approvalFor(action, approved) {
  return {
    status: 'approved', taskId: action.task.id, command: action.command, route: action.route,
    projectionDigest: action.projectionDigest, sourceSetDigest: action.sourceSetDigest,
    checkout: action.checkout,
    approvalDigest: approved.bindingDigest, evidenceRef: approved.evidenceRef,
  };
}

function validateOptionsShape(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('runner options must be an object');
  const extras = Object.keys(options).filter((key) => !ALLOWED_OPTIONS.has(key));
  if (extras.length > 0) throw new TypeError(`runner options contain forbidden field(s): ${extras.join(', ')}`);
}

async function runWithIntegrations(options, integrations, clock) {
  validateOptionsShape(options);
  const root = realpathSync(options.root);
  if (!statSync(root).isDirectory()) throw new TypeError('runner root must be a directory');
  contained(root, options.projectionPath);
  if (!SAFE_REFERENCE.test(options.receiptReference ?? '') || !SAFE_REFERENCE.test(options.approvalReference ?? '')) throw new TypeError('runner requires opaque host receipt and approval references');
  const resolveCheckout = integrations?.checkoutIdentityResolver ?? resolveCheckoutIdentity;
  const checkout = resolveCheckout(root);
  const flow = JSON.parse(readRelative(root, options.projectionPath));
  const action = deriveRalphIteration(flow, undefined, { checkout });
  if (action.status === 'stop') return action;
  const paths = persistencePathsFor(action);
  const resolvedPaths = Object.values(paths).map((relative) => contained(root, relative));
  if (new Set(resolvedPaths).size !== resolvedPaths.length) throw new TypeError('Ralph persistence surfaces must resolve to three distinct files');
  const summaryBody = readRelative(root, paths.summary);
  const prior = findRecord(summaryBody);
  if (!prior) {
    try {
      validateTemperanceFlowProjectionSources(flow, root);
    } catch {
      return stopFromAction(action, 'source_drift');
    }
  }
  if (options.dryRun !== false) return action;
  if (options.receiptReference !== action.route.receiptRef) throw new TypeError('runner receipt reference must exactly match the projected route intent');

  const sourcePaths = [options.projectionPath, ...allProjectionPaths(flow), ...Object.values(paths)];
  if (!prior && ['state', 'handoff'].some((surface) => findRecord(readRelative(root, paths[surface])) !== null)) {
    return stopFromAction(action, 'source_drift');
  }
  const initial = prior
    ? { files: prior.sourceFiles, digest: prior.sourceSnapshotDigest }
    : snapshot(root, sourcePaths);
  const expected = {
    taskId: action.task.id,
    command: action.command,
    route: action.route,
    projectionDigest: action.projectionDigest,
    sourceSetDigest: action.sourceSetDigest,
    sourceSnapshotDigest: initial.digest,
    persistencePaths: paths,
    checkout,
  };
  const manifestRaw = await integrations.manifestVerifier(expected, options.receiptReference);
  const host = verifyBoundary(manifestRaw, { ...expected, reference: options.receiptReference }, 'host', clock());
  const approvalRaw = await integrations.approvalVerifier(expected, options.approvalReference);
  const approved = verifyBoundary(approvalRaw, { ...expected, reference: options.approvalReference }, 'approval', clock());
  if (!host || !approved) return stopFromAction(action, 'approval_required');

  if (prior) {
    try {
      validateRecoveryRecord(prior, action, expected, paths, host, approved);
    } catch {
      return stopFromAction(action, 'source_drift');
    }
    if (!recoverySourceCheck(root, prior, paths)) return stopFromAction(action, 'source_drift');
  } else {
    const immediate = snapshot(root, sourcePaths);
    if (!same(initial.files, immediate.files) || initial.digest !== immediate.digest) return stopFromAction(action, 'source_drift');
  }
  if (!same(resolveCheckout(root), checkout)) return stopFromAction(action, 'source_drift');

  let execution = await integrations.executionReceiptResolver({ iterationDigest: action.iterationDigest, checkout });
  if (execution === null || execution === undefined) {
    execution = await integrations.executor({
      schema: 'cambium.ralph-execution-request.v2', idempotencyKey: action.iterationDigest,
      taskId: action.task.id, command: action.command, route: action.route, checkout,
      sourceSnapshot: initial,
    });
  }
  try { execution = validateExecutionReceipt(execution, action, initial.digest); } catch {
    return deriveRalphIteration(flow, { approval: approvalFor(action, approved), execution: { status: 'failed', evidenceRef: null } }, { checkout });
  }

  let verification = await integrations.verificationReceiptResolver({ iterationDigest: action.iterationDigest, checkout });
  if (verification === null || verification === undefined) {
    verification = await integrations.verification({
      schema: 'cambium.ralph-verification-request.v1', idempotencyKey: action.iterationDigest,
      taskId: action.task.id, checkout, declaredVerification: action.declaredVerification,
      executionEvidenceRef: execution.evidenceRef,
    });
  }
  try { verification = validateVerificationReceipt(verification, action, execution); } catch {
    return deriveRalphIteration(flow, {
      approval: approvalFor(action, approved),
      execution: { status: execution.status, evidenceRef: execution.evidenceRef },
      verification: { status: 'failed', evidenceRef: null },
    }, { checkout });
  }
  const approval = approvalFor(action, approved);
  const reducedExecution = { status: execution.status, evidenceRef: execution.evidenceRef };
  const reducedVerification = { status: verification.status, evidenceRef: verification.evidenceRef };
  const completed = deriveRalphIteration(flow, {
    approval,
    execution: reducedExecution,
    verification: reducedVerification,
    persistence: { summary: true, state: true, handoff: true },
  }, { checkout });
  const record = {
    schema: MARKER,
    iterationDigest: completed.iterationDigest,
    resultDigest: completed.resultDigest,
    sourceSnapshotDigest: initial.digest,
    sourceFiles: initial.files,
    preimages: Object.fromEntries(Object.entries(paths).map(([surface, relative]) => [surface, initial.files[relative]])),
    persistencePaths: paths,
    taskId: action.task.id,
    command: action.command,
    route: expected.route,
    projectionDigest: action.projectionDigest,
    sourceSetDigest: action.sourceSetDigest,
    checkout,
    hostEvidenceRef: host.evidenceRef,
    approvalEvidenceRef: approved.evidenceRef,
    executionEvidenceRef: execution.evidenceRef,
    verificationEvidenceRef: verification.evidenceRef,
    outcome: completed,
  };
  if (prior && (prior.executionEvidenceRef !== execution.evidenceRef
      || prior.verificationEvidenceRef !== verification.evidenceRef
      || prior.resultDigest !== record.resultDigest)) return stopFromAction(action, 'source_drift');
  for (const surface of ['summary', 'state', 'handoff']) {
    const outcome = await persistOne({
      root, relative: paths[surface], surface, expectedDigest: record.preimages[surface], record,
      adapter: integrations[`${surface}Adapter`],
      writer: integrations.atomicWriter,
    });
    if (outcome.status === 'cas_conflict') return stopFromAction(action, 'cas_conflict');
  }
  return completed;
}

export async function runRalphIteration(options) {
  validateOptionsShape(options);
  if (options.dryRun !== false) {
    return runWithIntegrations(options, null, () => new Date().toISOString());
  }
  let integrations;
  try {
    integrations = protectedIntegrations(realpathSync(options.root));
  } catch {
    const action = await runWithIntegrations({ ...options, dryRun: true }, null, () => new Date().toISOString());
    if (action.status === 'stop') return action;
    return stopFromAction(action, 'host_boundary_unavailable', {
      hostBoundary: {
        status: 'unavailable',
        owner: 'temperance_engine',
        requiredAction: 'separately_authorized_installation',
      },
    });
  }
  return runWithIntegrations(options, integrations, () => new Date().toISOString());
}

export function createProtectedRalphIterationRunnerForTesting(boundaryOptions, clock) {
  if (typeof clock !== 'function') throw new TypeError('protected boundary test runner requires a deterministic clock');
  return (options) => runWithIntegrations(options, protectedIntegrations(realpathSync(options.root), boundaryOptions), clock);
}

export function createRalphIterationRunnerForTesting(integrations) {
  const required = [
    'manifestVerifier', 'approvalVerifier', 'executionReceiptResolver', 'executor',
    'verificationReceiptResolver', 'verification',
  ];
  if (!integrations || required.some((key) => typeof integrations[key] !== 'function') || typeof integrations.clock !== 'function') {
    throw new TypeError('test runner requires complete explicit integrations and a deterministic clock');
  }
  return (options) => runWithIntegrations(options, integrations, integrations.clock);
}
