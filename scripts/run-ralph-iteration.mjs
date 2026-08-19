import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deriveRalphIteration } from './ralph-iteration.mjs';

const FIXED_VERIFIER = 'temperance-manifest-verify';
const FIXED_ISSUER = 'temperance-manifest-bridge';
const FIXED_AUDIENCE = 'cambium-ralph-iteration';
const HOST_SCHEMA = 'temperance.manifest-verification.v1';
const APPROVAL_SCHEMA = 'temperance.owner-approval.v1';
const MARKER = 'cambium-ralph-result-v1';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_REFERENCE = /^(?:manifest|temperance):[A-Za-z0-9._:/-]+$/;
const ALLOWED_OPTIONS = new Set([
  'root', 'projectionPath', 'receiptReference', 'approvalReference', 'summaryPath', 'statePath',
  'handoffPath', 'now', 'dryRun', 'testAdapters',
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
  const values = [flow.references.isa, flow.references.gsd, flow.references.plan, ...flow.references.supporting];
  if (flow.result.task?.source) values.push(flow.result.task.source);
  values.push(...flow.gates.map(({ source }) => source), ...flow.stops.map(({ source }) => source));
  return [...new Set(values.filter(Boolean).map(({ path: pathname }) => pathname))].sort();
}

function snapshot(root, relativePaths) {
  const files = Object.fromEntries([...new Set(relativePaths)].sort().map((relative) => [relative, digestBytes(readRelative(root, relative))]));
  return { files, digest: digestObject(files) };
}

function markerFor(record, surface) {
  return `\n<!-- ${MARKER} ${JSON.stringify({ surface, ...record })} -->\n`;
}

function findRecord(body) {
  const matches = [...body.matchAll(new RegExp(`<!-- ${MARKER} (\\{[^\\n]+\\}) -->`, 'g'))];
  if (matches.length === 0) return null;
  const parsed = JSON.parse(matches.at(-1)[1]);
  return parsed;
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
    'evidenceRef', 'payloadDigest',
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
      || !same(value.route, expected.route) || !SAFE_REFERENCE.test(value.evidenceRef ?? '')
      || typeof value.nonce !== 'string' || value.nonce.length === 0 || !DIGEST.test(value.payloadDigest ?? '')) return null;
  return {
    status,
    evidenceRef: value.evidenceRef,
    bindingDigest: digestObject({
      schema, status, reference: value[refKey], taskId: value.taskId, command: value.command,
      route: value.route, projectionDigest: value.projectionDigest, sourceSetDigest: value.sourceSetDigest,
      nonce: value.nonce, payloadDigest: value.payloadDigest,
    }),
  };
}

function fixedVerify(reference, kind) {
  const result = spawnSync(FIXED_VERIFIER, ['--json', '--reference', reference, '--kind', kind], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error || result.status !== 0) throw new TypeError(`fixed host Manifest verifier failed for ${reference}`);
  try { return JSON.parse(result.stdout); } catch { throw new TypeError('fixed host Manifest verifier returned invalid JSON'); }
}

function atomicWrite(target, content) {
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  renameSync(temporary, target);
}

function stopFromAction(action, reason) {
  const base = { schema: 'cambium.ralph-iteration.v1', status: 'stop', iterationDigest: action.iterationDigest, reason };
  return Object.freeze({ ...base, resultDigest: digestObject(base) });
}

async function persistOne({ root, relative, surface, expectedDigest, record, adapter }) {
  const target = contained(root, relative);
  const current = readFileSync(target, 'utf8');
  const existing = findRecord(current);
  if (existing?.iterationDigest === record.iterationDigest && existing?.resultDigest === record.resultDigest) return { status: 'already_applied' };
  if (digestBytes(current) !== expectedDigest) return { status: 'cas_conflict' };
  const append = markerFor(record, surface);
  const next = adapter ? await adapter({ surface, path: relative, current, append, expectedDigest, record: structuredClone(record) }) : `${current}${append}`;
  if (typeof next !== 'string') throw new TypeError(`${surface} adapter must return complete text`);
  const nextRecord = findRecord(next);
  if (nextRecord?.iterationDigest !== record.iterationDigest || nextRecord?.resultDigest !== record.resultDigest) {
    throw new TypeError(`${surface} adapter must preserve the stable Ralph receipt`);
  }
  if (digestBytes(readFileSync(target, 'utf8')) !== expectedDigest) return { status: 'cas_conflict' };
  atomicWrite(target, next);
  return { status: 'applied' };
}

function recoverySourceCheck(root, record, surfaces) {
  for (const [relative, expectedDigest] of Object.entries(record.sourceFiles)) {
    const current = readRelative(root, relative);
    const surface = Object.entries(surfaces).find(([, pathname]) => pathname === relative)?.[0];
    if (surface) {
      const applied = findRecord(current);
      if (applied?.iterationDigest === record.iterationDigest && applied?.resultDigest === record.resultDigest) continue;
    }
    if (digestBytes(current) !== expectedDigest) return false;
  }
  return true;
}

export async function runRalphIteration(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('runner options must be an object');
  const extras = Object.keys(options).filter((key) => !ALLOWED_OPTIONS.has(key));
  if (extras.length > 0) throw new TypeError(`runner options contain forbidden field(s): ${extras.join(', ')}`);
  const root = realpathSync(options.root);
  if (!statSync(root).isDirectory()) throw new TypeError('runner root must be a directory');
  const paths = {
    summary: options.summaryPath,
    state: options.statePath,
    handoff: options.handoffPath,
  };
  for (const relative of [options.projectionPath, ...Object.values(paths)]) contained(root, relative);
  if (!SAFE_REFERENCE.test(options.receiptReference ?? '') || !SAFE_REFERENCE.test(options.approvalReference ?? '')) throw new TypeError('runner requires opaque host receipt and approval references');
  const flow = JSON.parse(readRelative(root, options.projectionPath));
  const action = deriveRalphIteration(flow);
  if (action.status === 'stop') return action;
  if (options.dryRun !== false) return action;

  const sourcePaths = [options.projectionPath, ...allProjectionPaths(flow), ...Object.values(paths)];
  const initial = snapshot(root, sourcePaths);
  const summaryBody = readRelative(root, paths.summary);
  const prior = findRecord(summaryBody);
  if (prior) {
    if (prior.iterationDigest !== action.iterationDigest || !DIGEST.test(prior.resultDigest ?? '') || !recoverySourceCheck(root, prior, paths)) {
      return stopFromAction(action, 'source_drift');
    }
    for (const surface of ['summary', 'state', 'handoff']) {
      const outcome = await persistOne({
        root, relative: paths[surface], surface, expectedDigest: prior.preimages[surface], record: prior,
        adapter: options.testAdapters?.[`${surface}Adapter`],
      });
      if (outcome.status === 'cas_conflict') return stopFromAction(action, 'cas_conflict');
    }
    return prior.outcome;
  }

  const expected = {
    taskId: action.task.id,
    command: action.command,
    route: { ...action.route, receiptRef: options.receiptReference },
    projectionDigest: action.projectionDigest,
    sourceSetDigest: action.sourceSetDigest,
  };
  const adapters = options.testAdapters ?? {};
  const manifestRaw = adapters.manifestVerifier
    ? await adapters.manifestVerifier(expected)
    : fixedVerify(options.receiptReference, 'receipt');
  const approvalRaw = adapters.approvalVerifier
    ? await adapters.approvalVerifier(expected)
    : fixedVerify(options.approvalReference, 'approval');
  const host = verifyBoundary(manifestRaw, { ...expected, reference: options.receiptReference }, 'host', options.now ?? new Date().toISOString());
  const approved = verifyBoundary(approvalRaw, { ...expected, reference: options.approvalReference }, 'approval', options.now ?? new Date().toISOString());
  if (!host || !approved) return stopFromAction(action, 'approval_required');

  const immediate = snapshot(root, sourcePaths);
  if (!same(initial.files, immediate.files) || initial.digest !== immediate.digest) return stopFromAction(action, 'source_drift');
  if (typeof adapters.executor !== 'function' || typeof adapters.verification !== 'function') throw new TypeError('bounded executor and verification adapters are required');
  const execution = await adapters.executor({ taskId: action.task.id, command: action.command, route: expected.route, sourceSnapshotDigest: initial.digest });
  if (execution?.status !== 'succeeded') return deriveRalphIteration(flow, {
    approval: { status: 'approved', taskId: action.task.id, command: action.command, route: action.route, projectionDigest: action.projectionDigest, sourceSetDigest: action.sourceSetDigest, approvalDigest: approved.bindingDigest, evidenceRef: approved.evidenceRef },
    execution,
  });
  const verification = await adapters.verification({ taskId: action.task.id, declaredVerification: action.declaredVerification, executionEvidenceRef: execution.evidenceRef });
  const approval = { status: 'approved', taskId: action.task.id, command: action.command, route: action.route, projectionDigest: action.projectionDigest, sourceSetDigest: action.sourceSetDigest, approvalDigest: approved.bindingDigest, evidenceRef: approved.evidenceRef };
  if (verification?.status !== 'passed') return deriveRalphIteration(flow, { approval, execution, verification });
  const completed = deriveRalphIteration(flow, { approval, execution, verification, persistence: { summary: true, state: true, handoff: true } });
  const record = {
    schema: MARKER,
    iterationDigest: completed.iterationDigest,
    resultDigest: completed.resultDigest,
    sourceSnapshotDigest: initial.digest,
    sourceFiles: initial.files,
    preimages: Object.fromEntries(Object.entries(paths).map(([surface, relative]) => [surface, initial.files[relative]])),
    taskId: action.task.id,
    command: action.command,
    route: expected.route,
    projectionDigest: action.projectionDigest,
    sourceSetDigest: action.sourceSetDigest,
    hostEvidenceRef: host.evidenceRef,
    approvalEvidenceRef: approved.evidenceRef,
    executionEvidenceRef: execution.evidenceRef,
    verificationEvidenceRef: verification.evidenceRef,
    outcome: completed,
  };
  for (const surface of ['summary', 'state', 'handoff']) {
    const outcome = await persistOne({
      root, relative: paths[surface], surface, expectedDigest: record.preimages[surface], record,
      adapter: adapters[`${surface}Adapter`],
    });
    if (outcome.status === 'cas_conflict') return stopFromAction(action, 'cas_conflict');
  }
  return completed;
}
