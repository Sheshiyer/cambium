/**
 * Pure Telegram -> Goal Graph intake boundary.
 *
 * This file deliberately knows nothing about Workers, D1, Telegram secrets, or
 * provider adapters.  It accepts a small, versioned intent envelope, turns it
 * into a provenance-bound node, and (optionally) compiles that node through the
 * pure Goal Graph compiler.  A malformed value is data (`accepted: false`),
 * never an exception that could cause a Telegram redelivery loop.
 */

import { createHash } from 'node:crypto';
import { buildNode } from './goal-graph/identity.ts';
import { compileGoalGraph } from './goal-graph/compiler.ts';
import type {
  GoalGraphCompileInput,
  GoalGraphCompileResult,
  GoalGraphHead,
  GoalGraphInputNode,
  GoalGraphNode,
} from './goal-graph/types.ts';

export const TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA = 'cambium.telegram.goal-graph-intent.v1' as const;
export const TELEGRAM_GOAL_GRAPH_INTENT_VERSION = 1 as const;

/** Bounds are intentionally small: this is an intent receipt, not a payload bus. */
export const TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS = Object.freeze({
  payloadBytes: 16_384,
  metadataBytes: 2_048,
  metadataKeys: 32,
  metadataKeyBytes: 64,
  metadataValueBytes: 512,
  fieldBytes: 512,
  identifierBytes: 256,
});

export interface TelegramGoalGraphSource {
  /** Fixed discriminator; adapters must not smuggle provider routing here. */
  kind: 'telegram';
  chatId: string;
  messageId: string;
  updateId?: string;
  threadId?: string;
}

export type TelegramGoalMetadataValue = string | number | boolean | null;

export interface TelegramGoalGraphFields {
  namespace: string;
  externalId: string | null;
  parentNodeId: string | null;
  scope: GoalGraphNode['scope'];
  desiredState: string;
  currentState: string;
  owner: string;
  nextAction: string | null;
  waitCondition: string | null;
  proofRequired: boolean;
  reviewAt: string | null;
  status: GoalGraphNode['status'];
  metadata: Record<string, TelegramGoalMetadataValue>;
}

export interface TelegramGoalGraphIntent {
  schema: typeof TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA;
  version: typeof TELEGRAM_GOAL_GRAPH_INTENT_VERSION;
  tenantId: string;
  source: TelegramGoalGraphSource;
  goal: TelegramGoalGraphFields;
}

/** Input form allows only the documented defaults/fields; no raw Telegram update. */
export interface TelegramGoalGraphIntentInput {
  schema: typeof TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA;
  version: typeof TELEGRAM_GOAL_GRAPH_INTENT_VERSION;
  tenantId: string;
  source: TelegramGoalGraphSource;
  goal: Partial<TelegramGoalGraphFields> & Pick<TelegramGoalGraphFields, 'desiredState'>;
}

export interface TelegramGoalGraphCompileContext {
  expectedHeadDigest?: string | null;
  actualHead?: GoalGraphHead | null;
  currentNodes?: readonly GoalGraphNode[];
  graphVersion?: number;
  now?: string;
}

export type TelegramGoalGraphIntakeErrorCode =
  | 'malformed_input'
  | 'unknown_key'
  | 'forbidden_key'
  | 'projection_input'
  | 'bounds_exceeded'
  | 'compile_rejected';

export interface TelegramGoalGraphRejected {
  accepted: false;
  rejected: true;
  status: 'rejected';
  code: TelegramGoalGraphIntakeErrorCode;
  errors: readonly string[];
}

export interface TelegramGoalGraphAccepted {
  accepted: true;
  rejected: false;
  status: 'accepted';
  value: TelegramGoalGraphIntent;
  /** The exact normalized bytes hashed for the content digest. */
  canonical: string;
  contentDigest: string;
  /** Alias used when binding the node's source provenance. */
  sourceDigest: string;
  sourceRef: string;
  idempotencyKey: string;
  node: GoalGraphNode;
  compile: GoalGraphCompileResult;
}

export type TelegramGoalGraphIntakeResult = TelegramGoalGraphAccepted | TelegramGoalGraphRejected;

const ROOT_KEYS = new Set(['schema', 'version', 'tenantId', 'source', 'goal']);
const SOURCE_KEYS = new Set(['kind', 'chatId', 'messageId', 'updateId', 'threadId']);
const GOAL_KEYS = new Set([
  'namespace', 'externalId', 'parentNodeId', 'scope', 'desiredState', 'currentState',
  'owner', 'nextAction', 'waitCondition', 'proofRequired', 'reviewAt', 'status', 'metadata',
]);

const FORBIDDEN_KEY_NAMES = new Set([
  'provider', 'providers', 'model', 'models', 'routing', 'route', 'routes',
  'credential', 'credentials', 'secret', 'secrets', 'token', 'authorization',
  'projection', 'origin', 'graphversion', 'graphdigest', 'source-ref', 'sourceref',
  'payload', 'rawtelegram', 'initdata', 'webhook', 'adapter', 'tool', 'tools',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[_.\-\s]/g, '');
}

function isForbiddenKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return FORBIDDEN_KEY_NAMES.has(key.toLowerCase()) || FORBIDDEN_KEY_NAMES.has(normalized)
    || normalized.includes('credential') || normalized.includes('projection')
    || normalized.includes('provider') || normalized.includes('routing')
    || normalized.includes('model');
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function boundedString(value: unknown, field: string, limit = TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.fieldBytes): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  const normalized = value.trim();
  if (byteLength(normalized) > limit) throw new Error(`${field} exceeds ${limit} bytes`);
  return normalized;
}

function boundedIdentifier(value: unknown, field: string): string {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value);
  return boundedString(value, field, TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.identifierBytes);
}

function optionalNullableString(value: unknown, field: string, limit = TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.fieldBytes): string | null {
  if (value === undefined || value === null) return null;
  return boundedString(value, field, limit);
}

function stableJson(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number is not serializable');
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
      throw new Error('value is not JSON serializable');
    }
    return JSON.stringify(value);
  }
  if (seen.has(value)) throw new Error('cyclic input is not serializable');
  seen.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => stableJson(item, seen)).join(',')}]`;
  } else {
    const record = value as Record<string, unknown>;
    result = `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key], seen)}`).join(',')}}`;
  }
  seen.delete(value);
  return result;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function reject(code: TelegramGoalGraphIntakeErrorCode, errors: readonly string[]): TelegramGoalGraphRejected {
  return { accepted: false, rejected: true, status: 'rejected', code, errors: [...errors] };
}

function collectForbidden(value: unknown, path: string, errors: string[], seen = new Set<object>()): void {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbidden(item, `${path}[${index}]`, errors, seen));
    return;
  }
  for (const key of Object.keys(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isForbiddenKey(key)) errors.push(`${childPath} is forbidden at the Telegram intent boundary`);
    collectForbidden((value as Record<string, unknown>)[key], childPath, errors, seen);
  }
}

function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, path: string, errors: string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function validateMetadata(value: unknown): Record<string, TelegramGoalMetadataValue> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error('goal.metadata must be an object');
  const keys = Object.keys(value);
  if (keys.length > TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.metadataKeys) throw new Error(`goal.metadata exceeds ${TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.metadataKeys} keys`);
  const output: Record<string, TelegramGoalMetadataValue> = {};
  for (const key of keys) {
    if (isForbiddenKey(key)) throw new Error(`goal.metadata.${key} is forbidden at the Telegram intent boundary`);
    if (byteLength(key) > TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.metadataKeyBytes) throw new Error(`goal.metadata.${key} key is too large`);
    const item = value[key];
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean' && item !== null) {
      throw new Error(`goal.metadata.${key} must be a scalar`);
    }
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error(`goal.metadata.${key} must be finite`);
    if (byteLength(String(item)) > TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.metadataValueBytes) throw new Error(`goal.metadata.${key} value is too large`);
    output[key] = item;
  }
  const canonical = stableJson(output);
  if (byteLength(canonical) > TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.metadataBytes) throw new Error(`goal.metadata exceeds ${TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.metadataBytes} bytes`);
  return output;
}

function sourceRef(tenantId: string, source: TelegramGoalGraphSource): string {
  return `telegram:${tenantId}:${source.chatId}:${source.messageId}`;
}

function normalizeInput(input: unknown): TelegramGoalGraphIntent {
  if (!isRecord(input)) throw new Error('intent must be an object');
  const errors: string[] = [];
  rejectUnknownKeys(input, ROOT_KEYS, 'intent', errors);
  if (input.schema !== TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA) errors.push(`intent.schema must equal ${TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA}`);
  if (input.version !== TELEGRAM_GOAL_GRAPH_INTENT_VERSION) errors.push('intent.version must equal 1');
  const tenantId = boundedIdentifier(input.tenantId, 'intent.tenantId');
  if (!isRecord(input.source)) errors.push('intent.source must be an object');
  if (!isRecord(input.goal)) errors.push('intent.goal must be an object');
  if (errors.length > 0) throw new Error(errors.join('; '));

  const sourceInput = input.source as Record<string, unknown>;
  const goalInput = input.goal as Record<string, unknown>;
  const sourceErrors: string[] = [];
  rejectUnknownKeys(sourceInput, SOURCE_KEYS, 'intent.source', sourceErrors);
  if (sourceInput.kind !== undefined && sourceInput.kind !== 'telegram') sourceErrors.push('intent.source.kind must equal telegram');
  const goalErrors: string[] = [];
  rejectUnknownKeys(goalInput, GOAL_KEYS, 'intent.goal', goalErrors);
  if (sourceErrors.length || goalErrors.length) throw new Error([...sourceErrors, ...goalErrors].join('; '));

  const source: TelegramGoalGraphSource = {
    kind: 'telegram',
    chatId: boundedIdentifier(sourceInput.chatId, 'intent.source.chatId'),
    messageId: boundedIdentifier(sourceInput.messageId, 'intent.source.messageId'),
  };
  const updateId = sourceInput.updateId === undefined ? undefined : boundedIdentifier(sourceInput.updateId, 'intent.source.updateId');
  const threadId = sourceInput.threadId === undefined ? undefined : boundedIdentifier(sourceInput.threadId, 'intent.source.threadId');
  if (updateId !== undefined) source.updateId = updateId;
  if (threadId !== undefined) source.threadId = threadId;

  const scope = goalInput.scope === undefined ? 'macro' : goalInput.scope;
  if (scope !== 'macro' && scope !== 'meso' && scope !== 'micro' && scope !== 'proof') throw new Error('goal.scope is invalid');
  const status = goalInput.status === undefined ? 'draft' : goalInput.status;
  if (status !== 'draft' && status !== 'active' && status !== 'blocked' && status !== 'paused' && status !== 'retired') throw new Error('goal.status is invalid');
  const proofRequired = goalInput.proofRequired === undefined ? false : goalInput.proofRequired;
  if (typeof proofRequired !== 'boolean') throw new Error('goal.proofRequired must be boolean');
  const reviewAt = optionalNullableString(goalInput.reviewAt, 'goal.reviewAt');
  if (reviewAt !== null && Number.isNaN(Date.parse(reviewAt))) throw new Error('goal.reviewAt must be an ISO date');
  const goal: TelegramGoalGraphFields = {
    namespace: goalInput.namespace === undefined ? 'telegram' : boundedString(goalInput.namespace, 'goal.namespace', TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.identifierBytes),
    externalId: optionalNullableString(goalInput.externalId, 'goal.externalId', TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.identifierBytes),
    parentNodeId: optionalNullableString(goalInput.parentNodeId, 'goal.parentNodeId', TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.identifierBytes),
    scope,
    desiredState: boundedString(goalInput.desiredState, 'goal.desiredState'),
    currentState: goalInput.currentState === undefined ? 'unknown' : boundedString(goalInput.currentState, 'goal.currentState'),
    owner: goalInput.owner === undefined ? 'founder' : boundedString(goalInput.owner, 'goal.owner'),
    nextAction: optionalNullableString(goalInput.nextAction, 'goal.nextAction'),
    waitCondition: optionalNullableString(goalInput.waitCondition, 'goal.waitCondition'),
    proofRequired,
    reviewAt,
    status,
    metadata: validateMetadata(goalInput.metadata),
  };
  return { schema: TELEGRAM_GOAL_GRAPH_INTENT_SCHEMA, version: TELEGRAM_GOAL_GRAPH_INTENT_VERSION, tenantId, source, goal };
}

function projectionLike(input: unknown): boolean {
  if (!isRecord(input)) return false;
  const schema = typeof input.schema === 'string' ? input.schema.toLowerCase() : '';
  if (schema.includes('projection') || schema.includes('goal-graph-projection')) return true;
  return Object.keys(input).some((key) => ['payload', 'origin', 'graph_version', 'graph_digest', 'source_ref'].includes(key.toLowerCase()));
}

/** Canonical serializer for an already-normalized intent. */
export function canonicalizeTelegramGoalGraphIntent(value: TelegramGoalGraphIntent): string {
  return stableJson(value);
}

export const serializeTelegramGoalGraphIntent = canonicalizeTelegramGoalGraphIntent;

export function makeTelegramGoalGraphIdempotencyKey(tenantId: string, source: TelegramGoalGraphSource, contentDigest: string): string {
  return `telegram:goal-graph-intent:v1:${tenantId}:${source.chatId}:${source.messageId}:${contentDigest}`;
}

export const telegramGoalGraphIdempotencyKey = makeTelegramGoalGraphIdempotencyKey;

function compileContext(context: TelegramGoalGraphCompileContext | undefined): Required<TelegramGoalGraphCompileContext> {
  return {
    expectedHeadDigest: context?.expectedHeadDigest ?? null,
    actualHead: context?.actualHead ?? null,
    currentNodes: context?.currentNodes ?? [],
    graphVersion: context?.graphVersion ?? 1,
    now: context?.now ?? '1970-01-01T00:00:00.000Z',
  };
}

/**
 * Parse and compile one intent.  `context` is entirely in-memory and optional;
 * supplying D1 handles is impossible by type and unnecessary by design.
 */
export function parseTelegramGoalGraphIntent(input: unknown, context?: TelegramGoalGraphCompileContext): TelegramGoalGraphIntakeResult {
  try {
    if (projectionLike(input)) return reject('projection_input', ['goal-graph projection-shaped input cannot enter Telegram intake']);
    const rawCanonical = stableJson(input);
    if (byteLength(rawCanonical) > TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.payloadBytes) return reject('bounds_exceeded', [`intent payload exceeds ${TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.payloadBytes} bytes`]);
    const forbidden: string[] = [];
    collectForbidden(input, 'intent', forbidden);
    if (forbidden.length > 0) return reject('forbidden_key', forbidden);
    const value = normalizeInput(input);
    const canonical = canonicalizeTelegramGoalGraphIntent(value);
    if (byteLength(canonical) > TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.payloadBytes) return reject('bounds_exceeded', [`normalized intent exceeds ${TELEGRAM_GOAL_GRAPH_INTAKE_LIMITS.payloadBytes} bytes`]);
    const contentDigest = `sha256:${sha256(canonical)}`;
    const sourceRefValue = sourceRef(value.tenantId, value.source);
    const nodeInput: GoalGraphInputNode = {
      tenantId: value.tenantId,
      namespace: value.goal.namespace,
      externalId: value.goal.externalId,
      parentNodeId: value.goal.parentNodeId,
      scope: value.goal.scope,
      desiredState: value.goal.desiredState,
      currentState: value.goal.currentState,
      owner: value.goal.owner,
      nextAction: value.goal.nextAction,
      waitCondition: value.goal.waitCondition,
      proofRequired: value.goal.proofRequired,
      reviewAt: value.goal.reviewAt,
      status: value.goal.status,
      sourceRef: sourceRefValue,
      sourceDigest: contentDigest,
      graphVersion: compileContext(context).graphVersion,
      metadata: value.goal.metadata,
    };
    const compileInput = compileContext(context);
    // `buildNode` is the identity primitive used by every Goal Graph lane. Its
    // convenience `now` argument is not part of the durable node, so discard
    // the helper-only property before returning/compiling the proposal.
    const { now: _helperNow, ...node } = buildNode({ ...nodeInput, now: compileInput.now });
    const compile = compileGoalGraph({
      tenantId: value.tenantId,
      expectedHeadDigest: compileInput.expectedHeadDigest,
      actualHead: compileInput.actualHead,
      currentNodes: compileInput.currentNodes,
      proposedNodes: [node],
      graphVersion: compileInput.graphVersion,
      sourceRef: sourceRefValue,
      sourceDigest: contentDigest,
      now: compileInput.now,
    });
    return {
      accepted: true,
      rejected: false,
      status: 'accepted',
      value,
      canonical,
      contentDigest,
      sourceDigest: contentDigest,
      sourceRef: sourceRefValue,
      idempotencyKey: makeTelegramGoalGraphIdempotencyKey(value.tenantId, value.source, contentDigest),
      node,
      compile,
    };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'malformed intent';
    const code: TelegramGoalGraphIntakeErrorCode = message.includes('forbidden') ? 'forbidden_key'
      : message.includes('not allowed') ? 'unknown_key'
        : message.includes('exceeds') ? 'bounds_exceeded' : 'malformed_input';
    return reject(code, [message]);
  }
}

export const parseTelegramGoalGraphIntake = parseTelegramGoalGraphIntent;
export const parseTelegramIntent = parseTelegramGoalGraphIntent;
/** Compatibility names for callers that describe the operation as compilation. */
export const compileTelegramGoalGraphIntent = parseTelegramGoalGraphIntent;
export const parseGoalGraphTelegramIntent = parseTelegramGoalGraphIntent;
