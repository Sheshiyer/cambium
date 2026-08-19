import { createHash } from 'node:crypto';
import { validateTemperanceFlowProjection } from './temperance-flow.mjs';

export const RALPH_ITERATION_SCHEMA = 'cambium.ralph-iteration.v1';
export const RALPH_STOP_REASONS = Object.freeze([
  'flow_blocked',
  'approval_required',
  'verification_failed',
  'persist_required',
  'terminal',
  'iteration_complete',
  'source_drift',
  'cas_conflict',
  'host_boundary_unavailable',
]);

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_REFERENCE = /^(?:manifest|temperance):[A-Za-z0-9._:/-]+$/;
const GSD_COMMAND = /^\/gsd:(?:execute-phase|verify-phase|plan-phase) [0-9]+(?:\.[0-9]+)?$/;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!same(actual, expected)) throw new TypeError(`${label} must use the closed schema`);
}

function safeString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024 || /[\0\r\n]/.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
}

function validateSource(value, label) {
  exactKeys(value, ['path', 'kind', 'selector', 'digest'], label);
  safeString(value.path, `${label} path`);
  safeString(value.kind, `${label} kind`);
  safeString(value.selector, `${label} selector`);
  if (!DIGEST.test(value.digest)) throw new TypeError(`${label} digest is invalid`);
}

function validateAction(value) {
  exactKeys(value, [
    'schema', 'status', 'iterationDigest', 'projectionDigest', 'sourceSetDigest', 'task', 'command',
    'route', 'receiptGate', 'approvalGate', 'declaredVerification', 'persistenceSurfaces',
    'externalStopCondition',
  ], 'Ralph action');
  if (!DIGEST.test(value.projectionDigest) || !DIGEST.test(value.sourceSetDigest)) throw new TypeError('Ralph action projection identity is invalid');
  if (!GSD_COMMAND.test(value.command)) throw new TypeError('Ralph action command is invalid');
  exactKeys(value.task, ['id', 'name', 'source', 'dependencies'], 'Ralph action task');
  safeString(value.task.id, 'Ralph action task id');
  safeString(value.task.name, 'Ralph action task name');
  validateSource(value.task.source, 'Ralph action task source');
  if (!Array.isArray(value.task.dependencies) || value.task.dependencies.length > 4096) throw new TypeError('Ralph action dependencies are invalid');
  const dependencyIds = new Set();
  for (const dependency of value.task.dependencies) {
    exactKeys(dependency, ['id', 'status'], 'Ralph action dependency');
    safeString(dependency.id, 'Ralph action dependency id');
    if (!['complete', 'satisfied', 'pending', 'blocked'].includes(dependency.status) || dependencyIds.has(dependency.id)) {
      throw new TypeError('Ralph action dependency is invalid');
    }
    dependencyIds.add(dependency.id);
  }
  if (value.task.dependencies.some(({ status }) => status !== 'complete' && status !== 'satisfied')) {
    throw new TypeError('Ralph action cannot retain an incomplete dependency');
  }
  exactKeys(value.route, ['skillCluster', 'combo', 'lane', 'approvalRequired', 'receiptRef'], 'Ralph action route');
  safeString(value.route.skillCluster, 'Ralph action route skillCluster');
  safeString(value.route.combo, 'Ralph action route combo');
  if (!['native_orchestrator', 'paid_execution'].includes(value.route.lane)
      || typeof value.route.approvalRequired !== 'boolean'
      || (value.route.receiptRef !== null && !SAFE_REFERENCE.test(value.route.receiptRef))) {
    throw new TypeError('Ralph action route is invalid');
  }
  exactKeys(value.receiptGate, ['required', 'status', 'evidenceRef'], 'Ralph receipt gate');
  if (typeof value.receiptGate.required !== 'boolean'
      || !['required', 'satisfied'].includes(value.receiptGate.status)
      || (value.receiptGate.evidenceRef !== null && !SAFE_REFERENCE.test(value.receiptGate.evidenceRef))) {
    throw new TypeError('Ralph receipt gate is invalid');
  }
  const paidLane = value.route.lane === 'paid_execution';
  if (value.receiptGate.required !== paidLane || (paidLane && value.route.receiptRef === null)
      || (value.receiptGate.status === 'satisfied') !== (value.receiptGate.evidenceRef !== null)) {
    throw new TypeError('Ralph paid route and receipt gate are incoherent');
  }
  exactKeys(value.approvalGate, ['required', 'status'], 'Ralph approval gate');
  if (typeof value.approvalGate.required !== 'boolean'
      || !['required', 'not_required'].includes(value.approvalGate.status)) throw new TypeError('Ralph approval gate is invalid');
  if (value.approvalGate.required !== value.route.approvalRequired
      || value.approvalGate.status !== (value.route.approvalRequired ? 'required' : 'not_required')) {
    throw new TypeError('Ralph route approval and approval gate are incoherent');
  }
  if (!Array.isArray(value.declaredVerification) || value.declaredVerification.length > 256) throw new TypeError('Ralph declared verification is invalid');
  for (const gate of value.declaredVerification) {
    exactKeys(gate, ['kind', 'source', 'satisfied'], 'Ralph declared verification gate');
    if (gate.kind !== 'declared_verification' || typeof gate.satisfied !== 'boolean') throw new TypeError('Ralph declared verification gate is invalid');
    validateSource(gate.source, 'Ralph declared verification source');
  }
  if (value.declaredVerification.length === 0 || value.declaredVerification.some(({ satisfied }) => satisfied)) {
    throw new TypeError('Ralph action requires pending declared projection verification');
  }
  if (!same(value.persistenceSurfaces, ['summary', 'state', 'handoff']) || value.externalStopCondition !== 'exit_after_one_unit') {
    throw new TypeError('Ralph action persistence or external stop is invalid');
  }
  const { iterationDigest: _ignored, ...identity } = value;
  if (digestObject(identity) !== value.iterationDigest) throw new TypeError('Ralph action iterationDigest does not match canonical identity');
}

function validateEvidenceReference(value, label, { nullable = true } = {}) {
  if (value === null && nullable) return;
  if (!SAFE_REFERENCE.test(value ?? '')) throw new TypeError(`${label} is invalid`);
}

function validatePersistence(value) {
  exactKeys(value, ['summary', 'state', 'handoff'], 'Ralph stop persistence');
  if (Object.values(value).some((status) => typeof status !== 'boolean')) {
    throw new TypeError('Ralph stop persistence is invalid');
  }
}

function validateStop(value) {
  const common = ['schema', 'status', 'iterationDigest', 'reason', 'resultDigest'];
  const factsByReason = {
    flow_blocked: ['blockedReasons'],
    approval_required: ['approvalEvidenceRef'],
    verification_failed: ['executionEvidenceRef', 'verificationEvidenceRef'],
    persist_required: ['approvalEvidenceRef', 'executionEvidenceRef', 'verificationEvidenceRef', 'persistence'],
    terminal: ['executionEvidenceRef'],
    iteration_complete: ['approvalEvidenceRef', 'executionEvidenceRef', 'verificationEvidenceRef', 'persistence'],
    source_drift: [],
    cas_conflict: [],
    host_boundary_unavailable: ['hostBoundary'],
  };
  if (!RALPH_STOP_REASONS.includes(value.reason)) throw new TypeError('Ralph stop reason is invalid');
  exactKeys(value, [...common, ...factsByReason[value.reason]], 'Ralph stop');
  if (!DIGEST.test(value.resultDigest ?? '')) throw new TypeError('Ralph stop result digest is invalid');

  if (value.reason === 'flow_blocked') {
    if (!Array.isArray(value.blockedReasons) || value.blockedReasons.length === 0 || value.blockedReasons.length > 4096) {
      throw new TypeError('Ralph blocked reasons are invalid');
    }
    for (const reason of value.blockedReasons) {
      exactKeys(reason, ['code', 'sources'], 'Ralph blocked reason');
      safeString(reason.code, 'Ralph blocked reason code');
      if (!Array.isArray(reason.sources) || reason.sources.length > 4096) throw new TypeError('Ralph blocked reason sources are invalid');
      for (const source of reason.sources) safeString(source, 'Ralph blocked reason source');
    }
  } else if (value.reason === 'approval_required') {
    validateEvidenceReference(value.approvalEvidenceRef, 'Ralph approval evidence');
  } else if (value.reason === 'verification_failed') {
    validateEvidenceReference(value.executionEvidenceRef, 'Ralph execution evidence', { nullable: false });
    validateEvidenceReference(value.verificationEvidenceRef, 'Ralph verification evidence');
  } else if (value.reason === 'terminal') {
    validateEvidenceReference(value.executionEvidenceRef, 'Ralph execution evidence');
  } else if (value.reason === 'persist_required' || value.reason === 'iteration_complete') {
    validateEvidenceReference(value.approvalEvidenceRef, 'Ralph approval evidence');
    validateEvidenceReference(value.executionEvidenceRef, 'Ralph execution evidence', { nullable: false });
    validateEvidenceReference(value.verificationEvidenceRef, 'Ralph verification evidence', { nullable: false });
    validatePersistence(value.persistence);
  } else if (value.reason === 'host_boundary_unavailable') {
    exactKeys(value.hostBoundary, ['status', 'owner', 'requiredAction'], 'Ralph host boundary status');
    if (value.hostBoundary.status !== 'unavailable' || value.hostBoundary.owner !== 'temperance_engine'
        || value.hostBoundary.requiredAction !== 'separately_authorized_installation') {
      throw new TypeError('Ralph host boundary status is invalid');
    }
  }

  const { resultDigest, ...digestable } = value;
  if (digestObject(digestable) !== resultDigest) throw new TypeError('Ralph replay result digest conflict');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestObject(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function stop(iterationDigest, reason, facts = {}) {
  const base = { schema: RALPH_ITERATION_SCHEMA, status: 'stop', iterationDigest, reason, ...facts };
  return deepFreeze({ ...base, resultDigest: digestObject(base) });
}

function approvalMatches(value, action) {
  return value?.status === 'approved'
    && value.taskId === action.task.id
    && value.command === action.command
    && same(value.route, action.route)
    && value.projectionDigest === action.projectionDigest
    && value.sourceSetDigest === action.sourceSetDigest
    && DIGEST.test(value.approvalDigest ?? '')
    && typeof value.evidenceRef === 'string'
    && value.evidenceRef.length > 0;
}

export function validateRalphIteration(value, options = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Ralph iteration must be an object');
  if (value.schema !== RALPH_ITERATION_SCHEMA || !DIGEST.test(value.iterationDigest ?? '')) throw new TypeError('Ralph iteration schema or digest is invalid');
  if (value.status === 'action') {
    validateAction(value);
  } else if (value.status === 'stop') {
    validateStop(value);
  } else {
    throw new TypeError('Ralph iteration status must be action or stop');
  }
  if (options.expectedResultDigest && value.resultDigest !== options.expectedResultDigest) {
    throw new TypeError('Ralph replay result digest conflict');
  }
  return value;
}

export function deriveRalphIteration(flowInput, externalResult) {
  const flow = validateTemperanceFlowProjection(structuredClone(flowInput));
  const blockedIdentity = {
    projectionDigest: flow.flowDigest,
    sourceSetDigest: flow.sourceSetDigest,
    taskId: flow.result.task?.id ?? null,
    command: flow.result.command,
    route: flow.route.intent,
  };
  const blockedIterationDigest = digestObject(blockedIdentity);
  if (flow.result.status === 'blocked') {
    return stop(blockedIterationDigest, 'flow_blocked', { blockedReasons: structuredClone(flow.result.reasons) });
  }
  const actionWithoutDigest = {
    schema: RALPH_ITERATION_SCHEMA,
    status: 'action',
    projectionDigest: flow.flowDigest,
    sourceSetDigest: flow.sourceSetDigest,
    task: structuredClone(flow.result.task),
    command: flow.result.command,
    route: structuredClone(flow.route.intent),
    receiptGate: {
      required: flow.route.intent?.lane === 'paid_execution',
      status: flow.route.resolved?.freshness === 'fresh' ? 'satisfied' : 'required',
      evidenceRef: flow.route.resolved?.evidencePointer ?? null,
    },
    approvalGate: {
      required: Boolean(flow.route.intent?.approvalRequired),
      status: flow.route.intent?.approvalRequired ? 'required' : 'not_required',
    },
    declaredVerification: structuredClone(flow.gates.filter(({ kind }) => kind === 'declared_verification')),
    persistenceSurfaces: ['summary', 'state', 'handoff'],
    externalStopCondition: 'exit_after_one_unit',
  };
  const action = deepFreeze({ ...actionWithoutDigest, iterationDigest: digestObject(actionWithoutDigest) });
  const iterationDigest = action.iterationDigest;
  if (externalResult === undefined) return validateRalphIteration(action);
  if (externalResult?.status === 'stop') throw new TypeError('terminal Ralph result cannot be revived');
  if (action.approvalGate.required && !approvalMatches(externalResult?.approval, action)) {
    return stop(iterationDigest, 'approval_required', { approvalEvidenceRef: null });
  }
  if (externalResult?.execution?.status !== 'succeeded') {
    return stop(iterationDigest, 'terminal', { executionEvidenceRef: externalResult?.execution?.evidenceRef ?? null });
  }
  if (externalResult?.verification?.status !== 'passed') {
    return stop(iterationDigest, 'verification_failed', {
      executionEvidenceRef: externalResult.execution.evidenceRef,
      verificationEvidenceRef: externalResult?.verification?.evidenceRef ?? null,
    });
  }
  const persistence = externalResult.persistence ?? {};
  const complete = ['summary', 'state', 'handoff'].every((surface) => persistence[surface] === true);
  return stop(iterationDigest, complete ? 'iteration_complete' : 'persist_required', {
    approvalEvidenceRef: externalResult.approval?.evidenceRef ?? null,
    executionEvidenceRef: externalResult.execution.evidenceRef,
    verificationEvidenceRef: externalResult.verification.evidenceRef,
    persistence: { summary: persistence.summary === true, state: persistence.state === true, handoff: persistence.handoff === true },
  });
}
