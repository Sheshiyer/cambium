/**
 * The boundary between the D1 Goal Graph and its read/projection lanes.
 *
 * This module intentionally has no Worker, D1, Telegram, clock, or digest
 * dependencies.  A projection is evidence about a graph revision; it is never
 * a new graph command.  Keeping that distinction here makes it possible for
 * every consumer (including an offline fallback) to enforce the same rule.
 */

export const GOAL_GRAPH_PROJECTION_SCHEMA = 'cambium.goal-graph-projection.v1' as const;
export const GOAL_GRAPH_PROJECTION_SCHEMA_VERSION = 'goal-graph-projection@1.0.0' as const;
export const INTENT_GRAPH_PROJECTION_SCHEMA = 'cambium.intent-graph-projection.v1' as const;
export const TEMPERANCE_FLOW_PROJECTION_SCHEMA = 'cambium.temperance-flow-projection.v1' as const;

/** Origins are intentionally extensible: adapters name themselves, while the
 * schema and provenance fields remain closed and versioned. */
export type GoalGraphProjectionOrigin = string;

export interface GoalGraphProjectionEnvelope<TPayload = Record<string, unknown>> {
  /** Contract discriminator. */
  schema: typeof GOAL_GRAPH_PROJECTION_SCHEMA;
  /** Component or lane that produced this read model. */
  origin: GoalGraphProjectionOrigin;
  /** Version of the authoritative graph that was projected. */
  graph_version: string | number;
  /** Digest of the authoritative graph revision, not of a consumer payload. */
  graph_digest: string;
  /** Tenant boundary carried through every read and reconciliation operation. */
  tenant: string;
  /** Stable reference to the source receipt/revision. */
  source_ref: string;
  /** Bounded, redacted read payload. */
  payload: TPayload;
}

export interface ProjectionValidationResult<TPayload = Record<string, unknown>> {
  valid: boolean;
  value?: GoalGraphProjectionEnvelope<TPayload>;
  errors: readonly string[];
}

export interface AuthoritativeInputValidationResult<TInput = unknown> {
  /** False for every derived graph projection, including a malformed envelope. */
  accepted: boolean;
  value?: TInput;
  reason?:
    | 'goal_graph_projection_is_not_authoritative'
    | 'intent_graph_projection_is_not_authoritative'
    | 'temperance_flow_projection_is_not_authoritative'
    | 'invalid_projection_envelope';
  errors: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Build an envelope without calculating a digest.  Digest calculation belongs
 * to the D1 writer; accepting a caller-supplied digest here would blur that
 * authority boundary.  The returned value is frozen to prevent accidental
 * mutation between validation and serialization.
 */
export function createProjectionEnvelope<TPayload extends Record<string, unknown>>(
  input: Omit<GoalGraphProjectionEnvelope<TPayload>, 'schema'> & { schema?: typeof GOAL_GRAPH_PROJECTION_SCHEMA },
): GoalGraphProjectionEnvelope<TPayload> {
  if (!isRecord(input.payload)) throw new TypeError('projection payload must be an object');
  return Object.freeze({
    schema: GOAL_GRAPH_PROJECTION_SCHEMA,
    origin: input.origin,
    graph_version: input.graph_version,
    graph_digest: input.graph_digest,
    tenant: input.tenant,
    source_ref: input.source_ref,
    payload: input.payload,
  }) as GoalGraphProjectionEnvelope<TPayload>;
}

/**
 * Validate the wire envelope.  This function is deliberately pure and returns
 * all failures at once so callers can put the complete reason in a receipt.
 * Graph digests are opaque references at this seam: SHA-256 is the current
 * convention, but an algorithm migration must not invalidate old envelopes.
 */
export function validateProjectionEnvelope<TPayload = Record<string, unknown>>(
  input: unknown,
): ProjectionValidationResult<TPayload> {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['projection envelope must be an object'] };
  }

  if (input.schema !== GOAL_GRAPH_PROJECTION_SCHEMA) {
    errors.push(`schema must equal ${GOAL_GRAPH_PROJECTION_SCHEMA}`);
  }
  if (!nonEmptyString(input.origin)) errors.push('origin must be a non-empty string');
  const graphVersionIsValid = nonEmptyString(input.graph_version)
    || (typeof input.graph_version === 'number' && Number.isSafeInteger(input.graph_version) && input.graph_version > 0);
  if (!graphVersionIsValid) errors.push('graph_version must be a non-empty string or positive integer');
  if (!nonEmptyString(input.graph_digest)) errors.push('graph_digest must be a non-empty string');
  if (!nonEmptyString(input.tenant)) errors.push('tenant must be a non-empty string');
  if (!nonEmptyString(input.source_ref)) errors.push('source_ref must be a non-empty string');
  if (!isRecord(input.payload)) errors.push('payload must be an object');

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: input as unknown as GoalGraphProjectionEnvelope<TPayload>,
    errors: [],
  };
}

/** Compatibility spelling used by callers that name the subject explicitly. */
export const validateGoalGraphProjection = validateProjectionEnvelope;
export const validateGoalGraphProjectionEnvelope = validateProjectionEnvelope;

/** A schema/origin marker is enough to keep malformed projections out of the
 * authoritative lane; callers must not treat failed validation as raw input. */
export function isGoalGraphProjection(input: unknown): boolean {
  if (!isRecord(input)) return false;
  if (input.schema === GOAL_GRAPH_PROJECTION_SCHEMA) return true;
  if (input.schema === GOAL_GRAPH_PROJECTION_SCHEMA_VERSION) return true;
  const schema = typeof input.schema === 'string'
    ? input.schema.toLowerCase().replace(/[_\s]+/g, '-')
    : '';
  const origin = typeof input.origin === 'string'
    ? input.origin.toLowerCase().replace(/[_\s]+/g, '-')
    : '';
  const namesGoalGraph = schema.includes('goal-graph') || schema.includes('goalgraph');
  if (namesGoalGraph && schema.includes('projection')) return true;
  if (origin.includes('goal-graph') || origin.includes('goalgraph') || origin.includes('d1-goal')) return true;
  // A future projection schema or a malformed envelope still carries the
  // distinctive graph provenance tuple.  Keep it out of the writer while the
  // projection validator reports the precise schema/field failures.
  return Boolean(origin) && (origin.includes('projection') || origin.includes('foldback'))
    && ('graph_version' in input || 'graph_digest' in input || 'source_ref' in input);
}

/** Intent Graph read models are also derived projections. An exact or future
 * schema marker is sufficient to keep even malformed envelopes out of D1. */
export function isIntentGraphProjection(input: unknown): boolean {
  if (!isRecord(input)) return false;
  if (input.schema === INTENT_GRAPH_PROJECTION_SCHEMA) return true;
  const schema = typeof input.schema === 'string'
    ? input.schema.toLowerCase().replace(/[_\s]+/g, '-')
    : '';
  const namesIntentGraph = schema.includes('intent-graph') || schema.includes('intentgraph');
  return namesIntentGraph && schema.includes('projection');
}

/** Temperance flow readbacks are inspection-only projections. Exact,
 * malformed, and normalized future schema markers all stay out of D1. */
export function isTemperanceFlowProjection(input: unknown): boolean {
  if (!isRecord(input)) return false;
  if (input.schema === TEMPERANCE_FLOW_PROJECTION_SCHEMA) return true;
  const schema = typeof input.schema === 'string'
    ? input.schema.toLowerCase().replace(/[_\s]+/g, '-')
    : '';
  return schema.includes('temperance-flow') && schema.includes('projection');
}

/** One family discriminator shared by every fresh-authority boundary. */
export function isDerivedGraphProjection(input: unknown): boolean {
  return isGoalGraphProjection(input)
    || isIntentGraphProjection(input)
    || isTemperanceFlowProjection(input);
}

/**
 * Guard the source/projection boundary.  A projection can be valid evidence
 * and still be forbidden as a fresh Goal Graph command.  The rejection is
 * intentionally represented as data rather than an exception so an adapter
 * can persist a bounded receipt and stop without a retry loop.
 */
export function validateAuthoritativeInput<TInput = unknown>(
  input: TInput,
): AuthoritativeInputValidationResult<TInput> {
  if (isGoalGraphProjection(input)) {
    const projection = validateProjectionEnvelope(input);
    return {
      accepted: false,
      reason: projection.valid
        ? 'goal_graph_projection_is_not_authoritative'
        : 'invalid_projection_envelope',
      errors: projection.valid
        ? ['goal-graph projections cannot be accepted as fresh authoritative input']
        : [...projection.errors, 'goal-graph projection cannot enter the authoritative writer'],
    };
  }
  if (isIntentGraphProjection(input)) {
    return {
      accepted: false,
      reason: 'intent_graph_projection_is_not_authoritative',
      errors: ['intent graph projection cannot be accepted as fresh authoritative input'],
    };
  }
  if (isTemperanceFlowProjection(input)) {
    return {
      accepted: false,
      reason: 'temperance_flow_projection_is_not_authoritative',
      errors: ['Temperance flow projection cannot be accepted as fresh authoritative input'],
    };
  }
  return { accepted: true, value: input, errors: [] };
}

export const validateFreshAuthoritativeInput = validateAuthoritativeInput;
export const validateGoalGraphAuthoritativeInput = validateAuthoritativeInput;

/** Throwing form for command handlers that already use exception-based guards. */
export function assertAuthoritativeInput<TInput = unknown>(input: TInput): TInput {
  const result = validateAuthoritativeInput(input);
  if (!result.accepted) throw new Error(result.errors.join('; '));
  return input;
}

export type ReconciliationClass = 'unchanged' | 'replaced' | 'retired' | 'split' | 'merged' | 'unmapped';
export type ProofDisposition = 'preserve' | 'revalidate' | 'retire' | 'review_required';
export type ReconciliationOutcome = 'accepted' | 'review_required';

export interface GoalGraphNodeMapping {
  /** Node IDs in the prior authoritative graph revision. */
  from: readonly string[];
  /** Node IDs in the current authoritative graph revision. */
  to: readonly string[];
}

export interface NodeReconciliationResult {
  mapping: GoalGraphNodeMapping;
  classification: ReconciliationClass;
  proofDisposition: ProofDisposition;
  outcome: ReconciliationOutcome;
  reviewRequired: boolean;
  reason: string;
}

function normalizeNodeIds(value: readonly string[], field: string): string[] {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of value) {
    if (!nonEmptyString(id)) throw new TypeError(`${field} contains an invalid node id`);
    const normalized = id.trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function classify(from: readonly string[], to: readonly string[]): ReconciliationClass {
  if (from.length === 1 && to.length === 1) return from[0] === to[0] ? 'unchanged' : 'replaced';
  if (from.length === 1 && to.length === 0) return 'retired';
  if (from.length === 1 && to.length > 1) return 'split';
  if (from.length > 1 && to.length === 1) return 'merged';
  return 'unmapped';
}

/**
 * Reconcile one lineage boundary.  The helper never mutates either input and
 * never silently carries proof through a many-to-one or one-to-many change.
 */
export function reconcileNodeMapping(mapping: GoalGraphNodeMapping): NodeReconciliationResult;
export function reconcileNodeMapping(from: readonly string[], to: readonly string[]): NodeReconciliationResult;
export function reconcileNodeMapping(
  mappingOrFrom: GoalGraphNodeMapping | readonly string[],
  maybeTo?: readonly string[],
): NodeReconciliationResult {
  const from = Array.isArray(mappingOrFrom)
    ? normalizeNodeIds(mappingOrFrom, 'from')
    : normalizeNodeIds(mappingOrFrom.from, 'from');
  const to = Array.isArray(mappingOrFrom)
    ? normalizeNodeIds(maybeTo ?? [], 'to')
    : normalizeNodeIds(mappingOrFrom.to, 'to');
  const classification = classify(from, to);

  switch (classification) {
    case 'unchanged':
      return {
        mapping: { from, to }, classification,
        proofDisposition: 'preserve', outcome: 'accepted', reviewRequired: false,
        reason: 'the same node ID exists in both graph revisions',
      };
    case 'replaced':
      return {
        mapping: { from, to }, classification,
        proofDisposition: 'revalidate', outcome: 'accepted', reviewRequired: false,
        reason: 'a one-to-one node replacement requires fresh proof',
      };
    case 'retired':
      return {
        mapping: { from, to }, classification,
        proofDisposition: 'retire', outcome: 'accepted', reviewRequired: false,
        reason: 'the prior node has no successor and its proof is retired',
      };
    case 'split':
      return {
        mapping: { from, to }, classification,
        proofDisposition: 'review_required', outcome: 'review_required', reviewRequired: true,
        reason: 'one node maps to multiple successors; proof lineage is ambiguous and needs review',
      };
    case 'merged':
      return {
        mapping: { from, to }, classification,
        proofDisposition: 'review_required', outcome: 'review_required', reviewRequired: true,
        reason: 'multiple nodes map to one successor; proof lineage is ambiguous and needs review',
      };
    default:
      return {
        mapping: { from, to }, classification,
        proofDisposition: 'review_required', outcome: 'review_required', reviewRequired: true,
        reason: 'node lineage is neither one-to-one nor a supported retirement; review is required',
      };
  }
}

export function classifyNodeMapping(
  from: readonly string[],
  to: readonly string[],
): ReconciliationClass {
  return reconcileNodeMapping(from, to).classification;
}

export const reconcileNodes = reconcileNodeMapping;
export const reconcileGoalGraphNodes = reconcileNodeMapping;
