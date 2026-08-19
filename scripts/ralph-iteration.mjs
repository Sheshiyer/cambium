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
]);

const DIGEST = /^sha256:[a-f0-9]{64}$/;

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
    if (!value.task || typeof value.command !== 'string' || !value.route || value.externalStopCondition !== 'exit_after_one_unit') {
      throw new TypeError('Ralph action must contain exactly one task, command, route, and external stop');
    }
    if (!Array.isArray(value.declaredVerification) || !Array.isArray(value.persistenceSurfaces)) throw new TypeError('Ralph action gates are invalid');
  } else if (value.status === 'stop') {
    if (!RALPH_STOP_REASONS.includes(value.reason) || !DIGEST.test(value.resultDigest ?? '')) throw new TypeError('Ralph stop is invalid');
    const { resultDigest, ...digestable } = value;
    if (digestObject(digestable) !== resultDigest) throw new TypeError('Ralph replay result digest conflict');
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
  const identity = {
    projectionDigest: flow.flowDigest,
    sourceSetDigest: flow.sourceSetDigest,
    taskId: flow.result.task?.id ?? null,
    command: flow.result.command,
    route: flow.route.intent,
  };
  const iterationDigest = digestObject(identity);
  if (flow.result.status === 'blocked') {
    return stop(iterationDigest, 'flow_blocked', { blockedReasons: structuredClone(flow.result.reasons) });
  }
  const action = deepFreeze({
    schema: RALPH_ITERATION_SCHEMA,
    status: 'action',
    iterationDigest,
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
  });
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
