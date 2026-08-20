import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const TEMPERANCE_FLOW_SCHEMA = 'cambium.temperance-flow-projection.v1';
export const TEMPERANCE_FLOW_PROJECTION_AUTHORITY = 'read_only';
export const TEMPERANCE_FLOW_STATUSES = Object.freeze(['ready', 'blocked']);
export const TEMPERANCE_FLOW_AUTHORITY_KINDS = Object.freeze(['isa_goal', 'gsd_state', 'active_plan']);
export const TEMPERANCE_FLOW_SOURCE_KINDS = Object.freeze([
  ...TEMPERANCE_FLOW_AUTHORITY_KINDS,
  'verification_evidence',
  'reviewed_handoff',
]);
export const TEMPERANCE_FLOW_ROUTE_LANES = Object.freeze(['native_orchestrator', 'paid_execution']);
export const TEMPERANCE_FLOW_RECEIPT_FRESHNESS = Object.freeze(['fresh', 'stale', 'missing']);
export const TEMPERANCE_FLOW_GATE_KINDS = Object.freeze(['declared_verification', 'approval_boundary']);
export const TEMPERANCE_FLOW_STOP_KINDS = Object.freeze([
  'external_verification',
  'approval_boundary',
  'finite_goal',
]);
export const TEMPERANCE_FLOW_LIFECYCLE_STEPS = Object.freeze([
  'reread',
  'select_one',
  'execute_external',
  'verify_declared',
  'persist_existing_surfaces',
  'exit_external_condition',
]);

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const GSD_COMMAND = /^\/gsd:(?:discuss-phase|execute-phase|plan-phase|secure-phase|verify-work) [0-9]+(?:\.[0-9]+)?$/;
const COMMAND_ROUTES = Object.freeze({
  'discuss-phase': { skillClusters: ['gsd-discuss-phase', 'cambium'], lane: 'native_orchestrator' },
  'execute-phase': { skillClusters: ['gsd-execute-phase', 'cambium'], lane: 'paid_execution' },
  'plan-phase': { skillClusters: ['gsd-plan-phase', 'cambium'], lane: 'native_orchestrator' },
  'secure-phase': { skillClusters: ['gsd-secure-phase', 'cambium'], lane: 'native_orchestrator' },
  'verify-work': { skillClusters: ['gsd-verify-work', 'cambium'], lane: 'native_orchestrator' },
});
const SAFE_RECEIPT_REFERENCE = /^(?:manifest|temperance):[A-Za-z0-9._:/-]+$/;
const DEPENDENCY_STATUSES = Object.freeze(['complete', 'satisfied', 'pending', 'blocked']);
const BLOCK_REASON_CODES = Object.freeze([
  'missing_isa_goal', 'isa_goal_not_approved', 'missing_gsd_state', 'gsd_state_not_live',
  'missing_active_plan', 'active_plan_not_unique_or_active', 'gsd_plan_phase_conflict',
  'no_dependency_ready_task', 'multiple_dependency_ready_tasks',
  'selected_command_conflicts_with_gsd_transition', 'receipt_not_fresh_or_bound',
]);
const SECRET_TEXT = /(?:\/Users\/|\/Volumes\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|Bearer [A-Za-z0-9._~-]{8,}|\b(?:api[_-]?key|credential|secret|token)[=:][^\s]+)/i;
const FORBIDDEN_KEYS = new Set([
  'queue',
  'scheduler',
  'mutableLedger',
  'dispatch',
  'write',
  'selfCertified',
  'providerStack',
  'quota',
  'credentials',
  'credential',
  'apiKey',
  'failoverPolicy',
  'promptBody',
  'responseBody',
  'nativeSessionId',
]);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function assertRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
}

function assertClosedKeys(value, allowed, label, { requireAll = true } = {}) {
  assertRecord(value, label);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new TypeError(`${label} contains forbidden field(s): ${extras.join(', ')}`);
  if (requireAll) {
    const missing = allowed.filter((key) => !(key in value));
    if (missing.length > 0) throw new TypeError(`${label} is missing field(s): ${missing.join(', ')}`);
  }
}

function rejectForbiddenDeep(value, label = 'flow input') {
  if (Array.isArray(value)) {
    value.forEach((entry) => rejectForbiddenDeep(entry, label));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`${label} contains forbidden field ${key}`);
    rejectForbiddenDeep(nested, `${label}.${key}`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function canonicalText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

function digestText(value) {
  return `sha256:${createHash('sha256').update(canonicalText(value), 'utf8').digest('hex')}`;
}

function digestObject(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function projectionShaped(value) {
  if (!isRecord(value)) return false;
  const schema = typeof value.schema === 'string' ? value.schema.toLowerCase() : '';
  const family = schema.replace(/[^a-z0-9]+/g, '');
  return schema === TEMPERANCE_FLOW_SCHEMA
    || (family.includes('temperanceflow') && family.includes('projection'))
    || (family.includes('intentgraph') && family.includes('projection'))
    || (family.includes('goalgraph') && family.includes('projection'));
}

function normalizeRelativePath(value, label) {
  if (!nonEmptyString(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    throw new TypeError(`${label} must be a safe repository-relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError(`${label} must not contain traversal or normalization drift`);
  }
  return normalized;
}

function containedFile(repositoryRoot, relativePath, label) {
  const normalized = normalizeRelativePath(relativePath, label);
  let actual;
  try {
    actual = realpathSync(path.join(repositoryRoot, ...normalized.split('/')));
  } catch {
    throw new TypeError(`${label} ${normalized} is missing`);
  }
  const relative = path.relative(repositoryRoot, actual);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new TypeError(`${label} ${normalized} escapes the repository root`);
  }
  if (!statSync(actual).isFile()) throw new TypeError(`${label} ${normalized} must resolve to a file`);
  return { normalized, actual };
}

function validateSelector(selector) {
  if (selector === 'whole-file') return;
  if (/^frontmatter\.[A-Za-z][A-Za-z0-9_-]*$/.test(selector)) return;
  if (selector.startsWith('markdown.heading:') && nonEmptyString(selector.slice('markdown.heading:'.length))) return;
  if (selector.startsWith('markdown.list-item:') && nonEmptyString(selector.slice('markdown.list-item:'.length))) return;
  if (selector.startsWith('text.line:') && nonEmptyString(selector.slice('text.line:'.length))) return;
  if (selector.startsWith('xml.task-name:') && nonEmptyString(selector.slice('xml.task-name:'.length))) return;
  throw new TypeError(`unknown or unsafe selector ${selector}`);
}

function exactMatch(matches, selector) {
  if (matches.length !== 1) throw new TypeError(`selector ${selector} must resolve exactly once; received ${matches.length}`);
  return canonicalText(matches[0]);
}

function headingSections(text, heading) {
  const lines = canonicalText(text).split('\n');
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (match?.[2] === heading) starts.push({ index, level: match[1].length });
  }
  return starts.map(({ index, level }) => {
    let end = lines.length - 1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = /^(#{1,6})\s+/.exec(lines[cursor]);
      if (next && next[1].length <= level) { end = cursor; break; }
    }
    return lines.slice(index, end).join('\n');
  });
}

export function selectTemperanceFlowContent(raw, selector) {
  return selectContent(raw, selector);
}

export function redactReviewedHandoffForDigest(selected) {
  return selected
    .replace(/(`implementation_head` is `)[a-f0-9]{40}(`)/, '$1<reviewed-implementation-head>$2')
    .replace(/^(- Generated (?:flowDigest|sourceSetDigest): )sha256:[a-f0-9]{64}$/gm, '$1<reviewed-generated-digest>');
}

function selectContent(raw, selector) {
  validateSelector(selector);
  const text = canonicalText(raw);
  if (selector === 'whole-file') return text;
  if (selector.startsWith('frontmatter.')) {
    const field = selector.slice('frontmatter.'.length);
    const lines = text.split('\n');
    if (lines[0] !== '---') throw new TypeError('frontmatter selector requires opening ---');
    const end = lines.indexOf('---', 1);
    if (end < 0) throw new TypeError('frontmatter selector requires closing ---');
    return exactMatch(lines.slice(1, end).filter((line) => line.startsWith(`${field}:`)), selector);
  }
  if (selector.startsWith('markdown.heading:')) {
    return exactMatch(headingSections(text, selector.slice('markdown.heading:'.length)), selector);
  }
  if (selector.startsWith('markdown.list-item:')) {
    const prefix = selector.slice('markdown.list-item:'.length);
    return exactMatch(text.split('\n').filter((line) => line.startsWith(prefix)), selector);
  }
  if (selector.startsWith('text.line:')) {
    const prefix = selector.slice('text.line:'.length);
    return exactMatch(text.split('\n').filter((line) => line.startsWith(prefix)), selector);
  }
  if (selector.startsWith('xml.task-name:')) {
    const name = selector.slice('xml.task-name:'.length);
    const matches = [];
    for (const match of text.matchAll(/<task\b[^>]*>[\s\S]*?<\/task>/g)) {
      const names = [...match[0].matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((entry) => entry[1]);
      if (names.length === 1 && names[0] === name) matches.push(match[0]);
    }
    return exactMatch(matches, selector);
  }
  throw new TypeError(`unknown or unsafe selector ${selector}`);
}

function compileSource(repositoryRoot, value, expectedKinds = TEMPERANCE_FLOW_SOURCE_KINDS) {
  assertClosedKeys(value, ['path', 'kind', 'selector', 'digest'], 'source reference');
  if (!expectedKinds.includes(value.kind)) throw new TypeError(`unknown or invalid source kind ${value.kind}`);
  if (!DIGEST.test(value.digest)) throw new TypeError('source digest must be a lowercase SHA-256 value');
  const { normalized, actual } = containedFile(repositoryRoot, value.path, 'source path');
  const selected = selectContent(readFileSync(actual, 'utf8'), value.selector);
  if (projectionShaped(parseJsonIfPossible(selected))) {
    throw new TypeError(`source ${normalized} is a projection and cannot enter an authority lane`);
  }
  const digestable = value.kind === 'reviewed_handoff'
    ? redactReviewedHandoffForDigest(selected)
    : selected;
  const actualDigest = digestText(digestable);
  if (actualDigest !== value.digest) throw new TypeError(`source digest mismatch for ${normalized}#${value.selector}`);
  return { path: normalized, kind: value.kind, selector: value.selector, digest: actualDigest };
}

function parseJsonIfPossible(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

function compileIntentGraphReference(repositoryRoot, value) {
  assertClosedKeys(value, ['path', 'schema', 'digest'], 'Intent Graph reference');
  if (value.schema !== 'cambium.intent-graph-projection.v1') {
    throw new TypeError('Intent Graph reference schema must remain cambium.intent-graph-projection.v1');
  }
  if (!DIGEST.test(value.digest)) throw new TypeError('Intent Graph reference digest must be lowercase SHA-256');
  const { normalized, actual } = containedFile(repositoryRoot, value.path, 'Intent Graph reference path');
  const actualDigest = digestText(readFileSync(actual, 'utf8'));
  if (actualDigest !== value.digest) throw new TypeError('Intent Graph reference digest mismatch');
  return { path: normalized, schema: value.schema, digest: actualDigest };
}

function safeText(value, label) {
  if (!nonEmptyString(value) || SECRET_TEXT.test(value)) throw new TypeError(`${label} must be non-empty and redacted`);
  return value;
}

function compileRoute(value) {
  assertClosedKeys(value, ['skillCluster', 'combo', 'lane', 'approvalRequired', 'receiptRef'], 'route intent');
  const skillCluster = safeText(value.skillCluster, 'route skillCluster');
  const combo = safeText(value.combo, 'route combo');
  if (!TEMPERANCE_FLOW_ROUTE_LANES.includes(value.lane)) throw new TypeError('route lane is invalid');
  if (typeof value.approvalRequired !== 'boolean') throw new TypeError('route approvalRequired must be boolean');
  if (value.receiptRef !== null && (!nonEmptyString(value.receiptRef) || !SAFE_RECEIPT_REFERENCE.test(value.receiptRef))) {
    throw new TypeError('route receiptRef must be null or a safe manifest reference');
  }
  return { skillCluster, combo, lane: value.lane, approvalRequired: value.approvalRequired, receiptRef: value.receiptRef };
}

function compileGate(repositoryRoot, value) {
  assertClosedKeys(value, ['kind', 'source', 'satisfied'], 'gate');
  if (!TEMPERANCE_FLOW_GATE_KINDS.includes(value.kind)) throw new TypeError('gate kind is invalid');
  if (typeof value.satisfied !== 'boolean') throw new TypeError('gate satisfied must be boolean');
  return { kind: value.kind, source: compileSource(repositoryRoot, value.source), satisfied: value.satisfied };
}

function compileStop(repositoryRoot, value) {
  assertClosedKeys(value, ['kind', 'source', 'satisfied'], 'stop condition');
  if (!TEMPERANCE_FLOW_STOP_KINDS.includes(value.kind)) throw new TypeError('stop condition kind is invalid');
  if (typeof value.satisfied !== 'boolean') throw new TypeError('stop condition satisfied must be boolean');
  return { kind: value.kind, source: compileSource(repositoryRoot, value.source), satisfied: value.satisfied };
}

function compileTask(repositoryRoot, value) {
  assertClosedKeys(value, ['id', 'name', 'source', 'status', 'dependencies', 'command', 'route', 'gates', 'stop'], 'plan task');
  safeText(value.id, 'task id');
  safeText(value.name, 'task name');
  if (!['ready', 'pending', 'blocked', 'complete'].includes(value.status)) throw new TypeError('task status is invalid');
  if (!GSD_COMMAND.test(value.command)) throw new TypeError('task command violates the closed GSD command grammar');
  if (!Array.isArray(value.dependencies)) throw new TypeError('task dependencies must be an array');
  const dependencies = value.dependencies.map((dependency) => {
    assertClosedKeys(dependency, ['id', 'status'], 'task dependency');
    safeText(dependency.id, 'dependency id');
    if (!DEPENDENCY_STATUSES.includes(dependency.status)) throw new TypeError('dependency status is invalid');
    return { id: dependency.id, status: dependency.status };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(dependencies.map(({ id }) => id)).size !== dependencies.length) throw new TypeError('duplicate dependency identity');
  if (!Array.isArray(value.gates) || value.gates.length === 0) throw new TypeError('task must declare at least one source-backed gate');
  const gates = value.gates.map((gate) => compileGate(repositoryRoot, gate))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const stop = compileStop(repositoryRoot, value.stop);
  if (value.status === 'complete' && !stop.satisfied) throw new TypeError('terminal complete task cannot be revived without a satisfied stop');
  return {
    id: value.id,
    name: value.name,
    source: compileSource(repositoryRoot, value.source, ['active_plan']),
    status: value.status,
    dependencies,
    command: value.command,
    route: compileRoute(value.route),
    gates,
    stop,
  };
}

function reason(code, sources) {
  return { code, sources: [...new Set(sources.filter(Boolean))].sort() };
}

function sourceLabel(value) {
  return value ? `${value.path}#${value.selector}@${value.digest}` : null;
}

function commandPhase(command) {
  const value = /^\/gsd:[a-z-]+ ([0-9]+(?:\.[0-9]+)?)$/.exec(command ?? '')?.[1];
  return value === undefined ? null : value.split('.').map((part) => String(Number(part))).join('.');
}

function activePlanPhase(sourcePath) {
  const value = /^\.planning\/phases\/([0-9]+)(?:-[^/]+)?\/[0-9]+-[0-9]+-PLAN\.md$/.exec(sourcePath ?? '')?.[1];
  return value === undefined ? null : String(Number(value));
}

function authorityPhase(value) {
  const match = /^0*([0-9]+)(?:\.0*([0-9]+))?/.exec(String(value ?? ''));
  return match ? [String(Number(match[1])), ...(match[2] === undefined ? [] : [String(Number(match[2]))])].join('.') : null;
}

function compileAuthority(repositoryRoot, value, kind, allowedStatus, fields) {
  if (value === undefined) return null;
  if (projectionShaped(value)) throw new TypeError(`${kind} authority rejects projection foldback`);
  assertClosedKeys(value, ['source', 'status', ...fields], `${kind} authority`);
  if (value.source.kind !== kind) throw new TypeError(`${kind} authority must carry a ${kind} source`);
  return {
    source: compileSource(repositoryRoot, value.source, [kind]),
    status: value.status,
    validStatus: value.status === allowedStatus,
    values: Object.fromEntries(fields.map((field) => [field, value[field]])),
  };
}

function compileReceipt(value, selectedTask, expectedCommand, reasons) {
  if (value === null || value === undefined) return null;
  assertRecord(value, 'receipt verification result');
  if (value.status === 'missing' || value.status === 'unverified') {
    assertClosedKeys(value, ['status'], 'receipt verification result');
    return null;
  }
  assertClosedKeys(value, [
    'status', 'freshness', 'receiptRef', 'taskId', 'command', 'route', 'observedAt',
    'ageSeconds', 'evidencePointer', 'attribution',
  ], 'verified receipt result');
  if (value.status !== 'verified') throw new TypeError('receipt result status is invalid');
  assertClosedKeys(value.route, ['skillCluster', 'combo', 'lane'], 'verified receipt route');
  assertClosedKeys(value.attribution, ['provider', 'model'], 'redacted receipt attribution');
  const provider = safeText(value.attribution.provider, 'receipt provider attribution');
  const model = safeText(value.attribution.model, 'receipt model attribution');
  const observedAt = safeText(value.observedAt, 'receipt observedAt');
  if (Number.isNaN(Date.parse(observedAt))) throw new TypeError('receipt observedAt must be an ISO timestamp');
  if (!Number.isInteger(value.ageSeconds) || value.ageSeconds < 0) throw new TypeError('receipt ageSeconds must be a non-negative integer');
  const evidencePointer = safeText(value.evidencePointer, 'receipt evidencePointer');
  if (!selectedTask
    || value.freshness !== 'fresh'
    || value.receiptRef !== selectedTask.route.receiptRef
    || value.taskId !== selectedTask.id
    || value.command !== expectedCommand
    || value.route.skillCluster !== selectedTask.route.skillCluster
    || value.route.combo !== selectedTask.route.combo
    || value.route.lane !== selectedTask.route.lane) {
    reasons.push(reason('receipt_not_fresh_or_bound', [sourceLabel(selectedTask?.source)]));
    return null;
  }
  return {
    receiptRef: value.receiptRef,
    freshness: value.freshness,
    observedAt,
    ageSeconds: value.ageSeconds,
    evidencePointer,
    provider,
    model,
  };
}

function canonicalSourceSet(references, tasks) {
  const values = [];
  for (const authority of ['isa', 'gsd', 'plan']) if (references[authority]) values.push(references[authority]);
  values.push(references.intentGraph, ...references.supporting);
  for (const task of tasks) {
    values.push(task.source, ...task.gates.map(({ source }) => source), task.stop.source);
  }
  const unique = new Map(values.map((value) => [canonicalJson(value), value]));
  return [...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function validateRepositoryRoot(value) {
  if (!nonEmptyString(value) || !path.isAbsolute(value)) throw new TypeError('repositoryRoot must be an absolute directory path');
  const actual = realpathSync(value);
  if (!statSync(actual).isDirectory()) throw new TypeError('repositoryRoot must resolve to a directory');
  return actual;
}

export function compileTemperanceFlow(input) {
  assertClosedKeys(input, ['repositoryRoot', 'authorities', 'supportingSources', 'intentGraphRef', 'tasks', 'receiptVerification'], 'Temperance flow compiler input');
  rejectForbiddenDeep(input);
  const repositoryRoot = validateRepositoryRoot(input.repositoryRoot);
  if (projectionShaped(input.authorities)) throw new TypeError('projection foldback cannot enter authority input');
  assertClosedKeys(input.authorities, ['isa', 'gsd', 'plan'], 'authority set', { requireAll: false });

  const isa = compileAuthority(repositoryRoot, input.authorities.isa, 'isa_goal', 'approved', ['goal']);
  const gsd = compileAuthority(repositoryRoot, input.authorities.gsd, 'gsd_state', 'live', ['phase', 'transition', 'command']);
  const plan = compileAuthority(repositoryRoot, input.authorities.plan, 'active_plan', 'active', ['phase', 'plan']);
  if (gsd && !GSD_COMMAND.test(gsd.values.command)) throw new TypeError('GSD authority command violates the closed command grammar');

  if (!Array.isArray(input.supportingSources)) throw new TypeError('supportingSources must be an array');
  const supporting = input.supportingSources.map((value) => compileSource(repositoryRoot, value, ['verification_evidence', 'reviewed_handoff']))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const intentGraph = compileIntentGraphReference(repositoryRoot, input.intentGraphRef);
  if (!Array.isArray(input.tasks) || input.tasks.length > 4096) throw new TypeError('tasks must be a bounded array');
  const tasks = input.tasks.map((value) => compileTask(repositoryRoot, value));
  if (new Set(tasks.map(({ id }) => id)).size !== tasks.length) throw new TypeError('duplicate task identity');
  tasks.sort((left, right) => left.id.localeCompare(right.id));

  const references = {
    isa: isa?.source ?? null,
    gsd: gsd?.source ?? null,
    plan: plan?.source ?? null,
    intentGraph,
    supporting,
  };
  const reasons = [];
  if (!isa) reasons.push(reason('missing_isa_goal', []));
  else if (!isa.validStatus) reasons.push(reason('isa_goal_not_approved', [sourceLabel(isa.source)]));
  if (!gsd) reasons.push(reason('missing_gsd_state', []));
  else if (!gsd.validStatus) reasons.push(reason('gsd_state_not_live', [sourceLabel(gsd.source)]));
  if (!plan) reasons.push(reason('missing_active_plan', []));
  else if (!plan.validStatus) reasons.push(reason('active_plan_not_unique_or_active', [sourceLabel(plan.source)]));
  if (gsd && plan && gsd.values.phase !== plan.values.phase) {
    reasons.push(reason('gsd_plan_phase_conflict', [sourceLabel(gsd.source), sourceLabel(plan.source)]));
  }

  const readyTasks = tasks.filter((task) => task.status === 'ready'
    && task.dependencies.every(({ status }) => status === 'complete' || status === 'satisfied'));
  if (readyTasks.length !== 1) {
    reasons.push(reason(readyTasks.length === 0 ? 'no_dependency_ready_task' : 'multiple_dependency_ready_tasks', tasks.map(({ source }) => sourceLabel(source))));
  }
  const selectedTask = readyTasks.length === 1 ? readyTasks[0] : null;
  if (selectedTask && gsd && selectedTask.command !== gsd.values.command) {
    reasons.push(reason('selected_command_conflicts_with_gsd_transition', [sourceLabel(selectedTask.source), sourceLabel(gsd.source)]));
  }
  if (selectedTask && gsd && plan) {
    const phases = [
      commandPhase(selectedTask.command),
      authorityPhase(gsd.values.phase),
      authorityPhase(plan.values.phase),
      activePlanPhase(selectedTask.source.path),
    ];
    if (phases.some((phase) => phase === null || phase !== phases[0])) {
      reasons.push(reason('selected_command_conflicts_with_gsd_transition', [sourceLabel(selectedTask.source), sourceLabel(gsd.source), sourceLabel(plan.source)]));
    }
  }

  const routeTask = selectedTask ?? (tasks.length === 1 ? tasks[0] : null);
  const expectedCommand = gsd?.values.command ?? selectedTask?.command ?? null;
  const resolved = compileReceipt(input.receiptVerification, routeTask, expectedCommand, reasons);
  const blocked = reasons.length > 0;
  const result = blocked
    ? { status: 'blocked', task: null, command: null, reasons: reasons.sort((left, right) => left.code.localeCompare(right.code)) }
    : {
        status: 'ready',
        task: {
          id: selectedTask.id,
          name: selectedTask.name,
          source: selectedTask.source,
          dependencies: selectedTask.dependencies,
        },
        command: expectedCommand,
        reasons: [],
      };
  const route = { intent: routeTask?.route ?? null, resolved: blocked ? null : resolved };
  const gates = selectedTask?.gates ?? [];
  const stops = selectedTask ? [selectedTask.stop] : [];
  const freshness = {
    authorities: {
      isa: isa?.validStatus ? 'fresh' : isa ? 'stale' : 'missing',
      gsd: gsd?.validStatus ? 'fresh' : gsd ? 'stale' : 'missing',
      plan: plan?.validStatus ? 'fresh' : plan ? 'stale' : 'missing',
    },
    receipt: resolved?.freshness ?? (input.receiptVerification?.status === 'verified' ? 'stale' : 'missing'),
  };
  const sourceSetDigest = digestObject(canonicalSourceSet(references, tasks));
  const withoutDigest = {
    schema: TEMPERANCE_FLOW_SCHEMA,
    projectionAuthority: TEMPERANCE_FLOW_PROJECTION_AUTHORITY,
    authorityOrder: [...TEMPERANCE_FLOW_AUTHORITY_KINDS],
    references,
    lifecycle: [...TEMPERANCE_FLOW_LIFECYCLE_STEPS],
    result,
    route,
    gates,
    freshness,
    stops,
    sourceSetDigest,
  };
  const projection = { ...withoutDigest, flowDigest: digestObject(withoutDigest) };
  return validateTemperanceFlowProjection(projection);
}

function validateProjectionSource(value, allowedKinds = TEMPERANCE_FLOW_SOURCE_KINDS) {
  assertClosedKeys(value, ['path', 'kind', 'selector', 'digest'], 'projection source reference');
  normalizeRelativePath(value.path, 'projection source path');
  validateSelector(value.selector);
  if (!allowedKinds.includes(value.kind) || !DIGEST.test(value.digest)) throw new TypeError('projection source reference is invalid');
  return value;
}

function validateProjectionIntentGraph(value) {
  assertClosedKeys(value, ['path', 'schema', 'digest'], 'projection Intent Graph reference');
  normalizeRelativePath(value.path, 'projection Intent Graph path');
  if (value.schema !== 'cambium.intent-graph-projection.v1' || !DIGEST.test(value.digest)) throw new TypeError('projection Intent Graph reference is invalid');
}

function validateProjectionRouteIntent(value) {
  if (value === null) return;
  assertClosedKeys(value, ['skillCluster', 'combo', 'lane', 'approvalRequired', 'receiptRef'], 'projection route intent');
  safeText(value.skillCluster, 'projection route skillCluster');
  safeText(value.combo, 'projection route combo');
  if (!TEMPERANCE_FLOW_ROUTE_LANES.includes(value.lane) || typeof value.approvalRequired !== 'boolean') throw new TypeError('projection route intent is invalid');
  if (value.receiptRef !== null && !SAFE_RECEIPT_REFERENCE.test(value.receiptRef)) throw new TypeError('projection route receiptRef is invalid');
}

function validateProjectionResolved(value) {
  if (value === null) return;
  assertClosedKeys(value, ['receiptRef', 'freshness', 'observedAt', 'ageSeconds', 'evidencePointer', 'provider', 'model'], 'resolved attribution');
  if (value.freshness !== 'fresh') throw new TypeError('resolved attribution must be fresh');
  if (!SAFE_RECEIPT_REFERENCE.test(value.receiptRef)) throw new TypeError('resolved attribution receiptRef is invalid');
  safeText(value.observedAt, 'resolved attribution observedAt');
  if (Number.isNaN(Date.parse(value.observedAt)) || !Number.isInteger(value.ageSeconds) || value.ageSeconds < 0) throw new TypeError('resolved attribution freshness evidence is invalid');
  safeText(value.evidencePointer, 'resolved attribution evidencePointer');
  safeText(value.provider, 'resolved provider');
  safeText(value.model, 'resolved model');
}

function validateProjectionGateOrStop(value, kindSet, label) {
  assertClosedKeys(value, ['kind', 'source', 'satisfied'], label);
  if (!kindSet.includes(value.kind) || typeof value.satisfied !== 'boolean') throw new TypeError(`${label} is invalid`);
  validateProjectionSource(value.source);
}

export function validateTemperanceFlowProjection(value) {
  rejectForbiddenDeep(value, 'Temperance flow projection');
  assertClosedKeys(value, [
    'schema', 'projectionAuthority', 'authorityOrder', 'references', 'lifecycle', 'result',
    'route', 'gates', 'freshness', 'stops', 'sourceSetDigest', 'flowDigest',
  ], 'Temperance flow projection');
  if (value.schema !== TEMPERANCE_FLOW_SCHEMA) throw new TypeError(`schema must equal ${TEMPERANCE_FLOW_SCHEMA}`);
  if (value.projectionAuthority !== 'read_only') throw new TypeError('Temperance flow projection must remain read_only');
  if (!DIGEST.test(value.sourceSetDigest) || !DIGEST.test(value.flowDigest)) throw new TypeError('projection digests must be lowercase SHA-256 values');
  if (canonicalJson(value.authorityOrder) !== canonicalJson(TEMPERANCE_FLOW_AUTHORITY_KINDS)) throw new TypeError('authority precedence is not canonical');
  if (canonicalJson(value.lifecycle) !== canonicalJson(TEMPERANCE_FLOW_LIFECYCLE_STEPS)) throw new TypeError('lifecycle must preserve the finite canonical order');

  assertClosedKeys(value.references, ['isa', 'gsd', 'plan', 'intentGraph', 'supporting'], 'projection references');
  for (const [key, kind] of [['isa', 'isa_goal'], ['gsd', 'gsd_state'], ['plan', 'active_plan']]) {
    if (value.references[key] !== null) validateProjectionSource(value.references[key], [kind]);
  }
  validateProjectionIntentGraph(value.references.intentGraph);
  if (!Array.isArray(value.references.supporting) || value.references.supporting.length > 4096) throw new TypeError('supporting references must be a bounded array');
  value.references.supporting.forEach((entry) => validateProjectionSource(entry, ['verification_evidence', 'reviewed_handoff']));

  assertClosedKeys(value.result, ['status', 'task', 'command', 'reasons'], 'flow result');
  if (!TEMPERANCE_FLOW_STATUSES.includes(value.result.status) || !Array.isArray(value.result.reasons) || value.result.reasons.length > 256) throw new TypeError('flow result status or reasons are invalid');
  if (value.result.status === 'ready') {
    if (!isRecord(value.result.task) || !GSD_COMMAND.test(value.result.command) || value.result.reasons.length !== 0) throw new TypeError('ready result requires exactly one task and one command');
    assertClosedKeys(value.result.task, ['id', 'name', 'source', 'dependencies'], 'selected task');
    safeText(value.result.task.id, 'selected task id');
    safeText(value.result.task.name, 'selected task name');
    validateProjectionSource(value.result.task.source, ['active_plan']);
    if (!Array.isArray(value.result.task.dependencies) || value.result.task.dependencies.length > 4096) throw new TypeError('selected task dependencies must be a bounded array');
    const dependencyIds = new Set();
    for (const dependency of value.result.task.dependencies) {
      assertClosedKeys(dependency, ['id', 'status'], 'selected task dependency');
      safeText(dependency.id, 'selected task dependency id');
      if (!DEPENDENCY_STATUSES.includes(dependency.status) || dependencyIds.has(dependency.id)) throw new TypeError('selected task dependency is invalid or duplicated');
      dependencyIds.add(dependency.id);
    }
    if (value.result.task.dependencies.some(({ status }) => status !== 'complete' && status !== 'satisfied')) {
      throw new TypeError('ready result cannot retain an incomplete dependency');
    }
  } else {
    if (value.result.task !== null || value.result.command !== null || value.result.reasons.length === 0) {
      throw new TypeError('blocked result requires zero commands, no task, and at least one reason');
    }
  }
  for (const entry of value.result.reasons) {
    assertClosedKeys(entry, ['code', 'sources'], 'blocked reason');
    if (!BLOCK_REASON_CODES.includes(entry.code)) throw new TypeError('blocked reason code is invalid');
    if (!Array.isArray(entry.sources) || entry.sources.length > 4096) throw new TypeError('blocked reason sources must be a bounded array');
    if (new Set(entry.sources).size !== entry.sources.length) throw new TypeError('blocked reason sources must be unique');
    for (const source of entry.sources) safeText(source, 'blocked reason source');
  }

  assertClosedKeys(value.route, ['intent', 'resolved'], 'projection route');
  validateProjectionRouteIntent(value.route.intent);
  validateProjectionResolved(value.route.resolved);
  if (value.result.status === 'ready' && value.route.intent === null) throw new TypeError('ready result requires one route intent');
  if (value.result.status === 'blocked' && value.route.resolved !== null) throw new TypeError('blocked result cannot expose resolved attribution');
  if (value.route.resolved && value.route.intent?.receiptRef !== value.route.resolved.receiptRef) throw new TypeError('resolved attribution must bind the route receiptRef');
  if (!Array.isArray(value.gates) || !Array.isArray(value.stops) || value.gates.length > 256 || value.stops.length > 256) throw new TypeError('gates and stops must be bounded arrays');
  value.gates.forEach((entry) => validateProjectionGateOrStop(entry, TEMPERANCE_FLOW_GATE_KINDS, 'projection gate'));
  value.stops.forEach((entry) => validateProjectionGateOrStop(entry, TEMPERANCE_FLOW_STOP_KINDS, 'projection stop'));
  if (value.result.status === 'ready') {
    if (canonicalJson(value.result.task.source) !== canonicalJson(value.references.plan)) throw new TypeError('ready task source must equal the declared active plan reference');
    const commandKind = /^\/gsd:([a-z-]+)/.exec(value.result.command)?.[1];
    const expectedRoute = COMMAND_ROUTES[commandKind];
    if (!expectedRoute || !expectedRoute.skillClusters.includes(value.route.intent.skillCluster) || value.route.intent.lane !== expectedRoute.lane) {
      throw new TypeError('ready task command and route intent are incoherent');
    }
    const declaredVerification = value.gates.filter(({ kind }) => kind === 'declared_verification');
    const approvalBoundaries = value.gates.filter(({ kind }) => kind === 'approval_boundary');
    if (declaredVerification.length === 0 || declaredVerification.some(({ satisfied }) => satisfied)) {
      throw new TypeError('ready result requires pending declared verification gates');
    }
    if (approvalBoundaries.length !== Number(value.route.intent.approvalRequired)
        || approvalBoundaries.some(({ satisfied }) => satisfied)) {
      throw new TypeError('ready route approval requirement must match its approval gate');
    }
    if (value.stops.length !== 1 || value.stops[0].kind !== 'external_verification' || value.stops[0].satisfied) {
      throw new TypeError('ready result requires one pending external verification stop');
    }
    const commandPhaseValue = commandPhase(value.result.command);
    const planPhaseValue = activePlanPhase(value.references.plan?.path);
    if (commandPhaseValue === null || planPhaseValue === null || commandPhaseValue !== planPhaseValue) {
      throw new TypeError('ready command phase must equal the declared active-plan phase');
    }
  }
  assertClosedKeys(value.freshness, ['authorities', 'receipt'], 'projection freshness');
  assertClosedKeys(value.freshness.authorities, ['isa', 'gsd', 'plan'], 'authority freshness');
  for (const freshness of Object.values(value.freshness.authorities)) if (!TEMPERANCE_FLOW_RECEIPT_FRESHNESS.includes(freshness)) throw new TypeError('authority freshness is invalid');
  if (!TEMPERANCE_FLOW_RECEIPT_FRESHNESS.includes(value.freshness.receipt)) throw new TypeError('receipt freshness is invalid');
  if (value.result.status === 'ready' && Object.values(value.freshness.authorities).some((freshness) => freshness !== 'fresh')) {
    throw new TypeError('ready result requires every decision authority to be fresh');
  }
  if ((value.freshness.receipt === 'fresh') !== (value.route.resolved !== null)) {
    throw new TypeError('fresh receipt status requires one bound resolved receipt');
  }
  if (value.freshness.receipt === 'missing' && value.route.resolved !== null) {
    throw new TypeError('missing receipt status cannot expose resolved attribution');
  }

  const sourceValues = [];
  for (const key of ['isa', 'gsd', 'plan']) if (value.references[key]) sourceValues.push(value.references[key]);
  sourceValues.push(value.references.intentGraph, ...value.references.supporting);
  const declaredReferences = new Set(sourceValues.map((entry) => canonicalJson(entry)));
  if (value.result.task) sourceValues.push(value.result.task.source);
  sourceValues.push(...value.gates.map(({ source }) => source), ...value.stops.map(({ source }) => source));
  if ([...(value.gates ?? []), ...(value.stops ?? [])].some(({ source }) => !declaredReferences.has(canonicalJson(source)))) {
    throw new TypeError('projection gate or stop source is not a declared reference');
  }
  const unique = new Map(sourceValues.map((entry) => [canonicalJson(entry), entry]));
  const sourceLabels = new Set(sourceValues.map((entry) => sourceLabel(entry)));
  for (const entry of value.result.reasons) {
    for (const source of entry.sources) if (!sourceLabels.has(source)) throw new TypeError('blocked reason source is not a declared projection reference');
  }
  const expectedSourceSet = digestObject([...unique.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, entry]) => entry));
  if (expectedSourceSet !== value.sourceSetDigest) throw new TypeError('sourceSetDigest does not match projection references');
  const { flowDigest: _ignored, ...digestable } = value;
  if (digestObject(digestable) !== value.flowDigest) throw new TypeError('flowDigest does not match canonical projection facts');
  return value;
}

export function validateTemperanceFlowProjectionSources(value, repositoryRoot) {
  const flow = validateTemperanceFlowProjection(value);
  for (const [key, kind] of [['isa', 'isa_goal'], ['gsd', 'gsd_state'], ['plan', 'active_plan']]) {
    if (flow.references[key] !== null) compileSource(repositoryRoot, flow.references[key], [kind]);
  }
  for (const source of flow.references.supporting) {
    compileSource(repositoryRoot, source, ['verification_evidence', 'reviewed_handoff']);
  }
  compileIntentGraphReference(repositoryRoot, flow.references.intentGraph);
  if (flow.result.task?.source) compileSource(repositoryRoot, flow.result.task.source, ['active_plan']);
  for (const gate of flow.gates) compileSource(repositoryRoot, gate.source);
  for (const stopCondition of flow.stops) compileSource(repositoryRoot, stopCondition.source);
  return flow;
}

function cell(value) {
  if (value === null || value === undefined) return '—';
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function referenceCell(value) {
  if (!value) return '—';
  return `${value.path}#${value.selector ?? value.schema}@${value.digest}`;
}

export function renderTemperanceFlowMarkdown(value) {
  const flow = validateTemperanceFlowProjection(value);
  const lines = [
    '# Cambium Temperance Flow',
    '',
    '> Read-only projection. This artifact cannot plan, dispatch, persist work, mutate D1, or resolve providers.',
    '',
    `- Schema: \`${flow.schema}\``,
    `- Projection authority: \`${flow.projectionAuthority}\``,
    `- Source-set digest: \`${flow.sourceSetDigest}\``,
    `- Flow digest: \`${flow.flowDigest}\``,
    `- Result: \`${flow.result.status}\``,
    `- Command: \`${cell(flow.result.command)}\``,
    `- Selected task: \`${cell(flow.result.task?.id)}\``,
    '',
    '## Authority precedence',
    '',
    flow.authorityOrder.map((kind, index) => `${index + 1}. \`${kind}\``).join('\n'),
    '',
    '## References',
    '',
    '| Role | Reference |',
    '| --- | --- |',
    `| ISA | \`${referenceCell(flow.references.isa)}\` |`,
    `| GSD state | \`${referenceCell(flow.references.gsd)}\` |`,
    `| Active plan | \`${referenceCell(flow.references.plan)}\` |`,
    `| Intent Graph | \`${referenceCell(flow.references.intentGraph)}\` |`,
    ...flow.references.supporting.map((entry) => `| Supporting evidence | \`${referenceCell(entry)}\` |`),
    '',
    '## Lifecycle',
    '',
    flow.lifecycle.map((step, index) => `${index + 1}. \`${step}\``).join('\n'),
    '',
    '## Route',
    '',
    `- Skill cluster: \`${cell(flow.route.intent?.skillCluster)}\``,
    `- Combo: \`${cell(flow.route.intent?.combo)}\``,
    `- Lane: \`${cell(flow.route.intent?.lane)}\``,
    `- Approval required: \`${cell(flow.route.intent?.approvalRequired)}\``,
    `- Receipt reference: \`${cell(flow.route.intent?.receiptRef)}\``,
    `- Resolved provider: \`${cell(flow.route.resolved?.provider)}\``,
    `- Resolved model: \`${cell(flow.route.resolved?.model)}\``,
    '',
    '## Gates and stops',
    '',
    '| Type | Kind | Satisfied | Source |',
    '| --- | --- | --- | --- |',
    ...flow.gates.map((entry) => `| Gate | ${entry.kind} | ${entry.satisfied} | \`${referenceCell(entry.source)}\` |`),
    ...flow.stops.map((entry) => `| Stop | ${entry.kind} | ${entry.satisfied} | \`${referenceCell(entry.source)}\` |`),
  ];
  if (flow.result.reasons.length > 0) {
    lines.push('', '## Blocked reasons', '', ...flow.result.reasons.map((entry) => `- \`${entry.code}\`: ${entry.sources.join(', ') || 'source unavailable'}`));
  }
  lines.push('', 'Source bodies and host routing policy remain in their owning systems.', '');
  return lines.join('\n');
}
