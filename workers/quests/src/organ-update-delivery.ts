/**
 * Pure, read-only compiler for receipt-backed organ updates.
 *
 * Cambium owns normalization and deterministic delivery intent. Hermes owns
 * Telegram transport. This module performs no network, storage, scheduling,
 * tenant activation, or approval mutation.
 */
import { createHash } from 'node:crypto';
import {
  TELEGRAM_ROUTING_CONTRACT,
  THOUGHTSEED_TELEGRAM_CHAT_ID,
  TOPIC_QUEST_ROUTES,
} from './telegram-routing.ts';

export const ORGAN_UPDATE_SIGNAL_SCHEMA = 'cambium.organ-update-signal.v1' as const;
export const ORGAN_UPDATE_DELIVERY_SCHEMA = 'cambium.organ-update-delivery.v1' as const;
export const ORGAN_UPDATE_PLAN_SCHEMA = 'cambium.organ-update-plan.v1' as const;
export const ORGAN_UPDATE_SUMMARY_SCHEMA = 'cambium.organ-update-delivery-summary.v1' as const;

export const ORGAN_IDS = ['genesis', 'taste', 'hands', 'will', 'cortex'] as const;
export type OrganId = typeof ORGAN_IDS[number];
export type OrganName = 'Genesis' | 'Taste' | 'Hands' | 'Will' | 'Cortex';
export type OrganUpdateStatus = 'ready' | 'complete' | 'blocked' | 'failed' | 'drifted';
export type OrganUpdateAudience = 'internal' | 'client';
export type OrganUpdateTrigger =
  | 'brand-intake'
  | 'brand-proof'
  | 'brief'
  | 'qa'
  | 'reroll'
  | 'build'
  | 'verification'
  | 'ship'
  | 'approved-business'
  | 'client-delivery'
  | 'evidence'
  | 'learning'
  | 'drift';

type TopicKey = keyof typeof TOPIC_QUEST_ROUTES;

export interface OrganUpdateProof {
  ref: string;
  digest: string;
}

export interface OrganUpdateSignal {
  schema: typeof ORGAN_UPDATE_SIGNAL_SCHEMA;
  tenantId: string;
  workObjectId: string;
  organ: OrganId;
  trigger: OrganUpdateTrigger;
  status: OrganUpdateStatus;
  audience: OrganUpdateAudience;
  summary: string;
  observedAt: string;
  proof: OrganUpdateProof;
  approvalRef?: string;
}

export interface OrganUpdateWorkflow {
  organ: OrganId;
  name: OrganName;
  triggers: readonly OrganUpdateTrigger[];
  stages: readonly string[];
  skillHints: readonly string[];
  defaultTopic: OrganUpdateTopic;
  escalationTopic: OrganUpdateTopic;
  approval: {
    requiredFor: 'client-audience' | 'none';
    authority: 'mini-app-gate' | 'not-required';
  };
  workflowDigest: string;
}

export interface OrganUpdateTopic {
  chatId: typeof THOUGHTSEED_TELEGRAM_CHAT_ID;
  topicKey: TopicKey;
  topicName: string;
  threadId: number;
}

export interface OrganUpdateDelivery {
  schema: typeof ORGAN_UPDATE_DELIVERY_SCHEMA;
  version: 1;
  deliveryId: string;
  deliveryDigest: string;
  tenantId: string;
  workObjectId: string;
  organ: OrganId;
  organName: OrganName;
  trigger: OrganUpdateTrigger;
  status: OrganUpdateStatus;
  audience: OrganUpdateAudience;
  observedAt: string;
  proof: OrganUpdateProof;
  approvalRef: string | null;
  requiresApproval: boolean;
  eventDriven: true;
  scheduleArmed: false;
  workflowDigest: string;
  topicMapDigest: string;
  route: OrganUpdateTopic;
  message: {
    format: 'plain-text';
    text: string;
    byteLength: number;
  };
}

export interface OrganUpdatePlan {
  schema: typeof ORGAN_UPDATE_PLAN_SCHEMA;
  version: 1;
  readOnly: true;
  eventDriven: true;
  scheduleArmed: false;
  topicMapDigest: string;
  planDigest: string;
  workflows: readonly OrganUpdateWorkflow[];
  activeDeliveries: readonly OrganUpdateDelivery[];
}

export interface OrganUpdateSummary {
  schema: typeof ORGAN_UPDATE_SUMMARY_SCHEMA;
  version: 1;
  readOnly: true;
  eventDriven: true;
  scheduleArmed: false;
  workflowCount: 5;
  defaultTopicCount: 5;
  escalationTopicCount: 1;
  approvalRequiredWorkflowCount: 1;
  planDigest: string;
}

type WorkflowSeed = Omit<OrganUpdateWorkflow, 'defaultTopic' | 'escalationTopic' | 'workflowDigest'> & {
  defaultTopicKey: TopicKey;
};

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;
const SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)hash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|PRIVATE KEY/i;
const ESCALATION_STATUSES = new Set<OrganUpdateStatus>(['blocked', 'failed', 'drifted']);
const SIGNAL_KEYS = new Set([
  'schema', 'tenantId', 'workObjectId', 'organ', 'trigger', 'status',
  'audience', 'summary', 'observedAt', 'proof', 'approvalRef',
]);
const PROOF_KEYS = new Set(['ref', 'digest']);

const WORKFLOW_SEEDS: readonly WorkflowSeed[] = [
  {
    organ: 'genesis',
    name: 'Genesis',
    triggers: ['brand-intake', 'brand-proof'],
    stages: ['intake', 'proof'],
    skillHints: ['brand discovery', 'visual identity'],
    defaultTopicKey: 'inbox',
    approval: { requiredFor: 'none', authority: 'not-required' },
  },
  {
    organ: 'taste',
    name: 'Taste',
    triggers: ['brief', 'qa', 'reroll'],
    stages: ['brief', 'quality review', 'reroll review'],
    skillHints: ['critique', 'quality review'],
    defaultTopicKey: 'digests',
    approval: { requiredFor: 'none', authority: 'not-required' },
  },
  {
    organ: 'hands',
    name: 'Hands',
    triggers: ['build', 'verification', 'ship'],
    stages: ['build', 'verification', 'ship gate'],
    skillHints: ['engineering', 'verification'],
    defaultTopicKey: 'dev',
    approval: { requiredFor: 'none', authority: 'not-required' },
  },
  {
    organ: 'will',
    name: 'Will',
    triggers: ['approved-business', 'client-delivery'],
    stages: ['business approval', 'client delivery'],
    skillHints: ['proposals', 'delivery operations'],
    defaultTopicKey: 'clients',
    approval: { requiredFor: 'client-audience', authority: 'mini-app-gate' },
  },
  {
    organ: 'cortex',
    name: 'Cortex',
    triggers: ['evidence', 'learning', 'drift'],
    stages: ['evidence', 'derived learning', 'drift review'],
    skillHints: ['evidence', 'systems learning'],
    defaultTopicKey: 'agent_ops',
    approval: { requiredFor: 'none', authority: 'not-required' },
  },
] as const;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function topic(topicKey: TopicKey): OrganUpdateTopic {
  const route = TOPIC_QUEST_ROUTES[topicKey];
  return {
    chatId: THOUGHTSEED_TELEGRAM_CHAT_ID,
    topicKey,
    topicName: route.topicName,
    threadId: route.threadId,
  };
}

function workflowFromSeed(seed: WorkflowSeed): OrganUpdateWorkflow {
  const body = {
    organ: seed.organ,
    name: seed.name,
    triggers: [...seed.triggers],
    stages: [...seed.stages],
    skillHints: [...seed.skillHints],
    defaultTopic: topic(seed.defaultTopicKey),
    escalationTopic: topic('alerts'),
    approval: { ...seed.approval },
  };
  return { ...body, workflowDigest: digest(body) };
}

const WORKFLOWS = WORKFLOW_SEEDS.map(workflowFromSeed);
const PLAN_BODY = {
  schema: ORGAN_UPDATE_PLAN_SCHEMA,
  version: 1 as const,
  readOnly: true as const,
  eventDriven: true as const,
  scheduleArmed: false as const,
  topicMapDigest: `sha256:${TELEGRAM_ROUTING_CONTRACT.manifestSha256}`,
  workflows: WORKFLOWS,
  activeDeliveries: [] as readonly OrganUpdateDelivery[],
};

export const ORGAN_UPDATE_PLAN: OrganUpdatePlan = Object.freeze({
  ...PLAN_BODY,
  planDigest: digest(PLAN_BODY),
});

export const ORGAN_UPDATE_SUMMARY: OrganUpdateSummary = Object.freeze({
  schema: ORGAN_UPDATE_SUMMARY_SCHEMA,
  version: 1,
  readOnly: true,
  eventDriven: true,
  scheduleArmed: false,
  workflowCount: 5,
  defaultTopicCount: 5,
  escalationTopicCount: 1,
  approvalRequiredWorkflowCount: 1,
  planDigest: ORGAN_UPDATE_PLAN.planDigest,
});

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, field: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`${field}.${key} is not allowed`);
  }
}

function safeId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value) || SECRET_MARKER.test(value)) {
    throw new TypeError(`${field} is invalid`);
  }
  return value;
}

function safeText(value: unknown, field: string, maxBytes: number): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || utf8Bytes(normalized) > maxBytes || SECRET_MARKER.test(normalized)) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new TypeError(`${field} is invalid`);
  return value as T;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('observedAt is invalid');
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new TypeError('observedAt is invalid');
  return value;
}

export function normalizeOrganUpdateSignal(value: unknown): OrganUpdateSignal {
  const input = record(value, 'signal');
  exactKeys(input, SIGNAL_KEYS, 'signal');
  if (input.schema !== ORGAN_UPDATE_SIGNAL_SCHEMA) throw new TypeError('signal.schema is invalid');
  const organ = enumValue(input.organ, ORGAN_IDS, 'organ');
  const workflow = WORKFLOWS.find((candidate) => candidate.organ === organ);
  if (!workflow) throw new TypeError('organ is invalid');
  const trigger = enumValue(input.trigger, workflow.triggers, 'trigger');
  const status = enumValue(input.status, ['ready', 'complete', 'blocked', 'failed', 'drifted'] as const, 'status');
  const audience = enumValue(input.audience, ['internal', 'client'] as const, 'audience');
  if (audience === 'client' && organ !== 'will') throw new TypeError('client audience is valid only for Will');
  const proofInput = record(input.proof, 'proof');
  exactKeys(proofInput, PROOF_KEYS, 'proof');
  const proof = {
    ref: safeId(proofInput.ref, 'proof.ref'),
    digest: typeof proofInput.digest === 'string' && SHA256.test(proofInput.digest)
      ? proofInput.digest
      : (() => { throw new TypeError('proof.digest is invalid'); })(),
  };
  const approvalRef = input.approvalRef === undefined
    ? undefined
    : safeId(input.approvalRef, 'approvalRef');
  if (organ === 'will' && audience === 'client' && !approvalRef) {
    throw new TypeError('client-audience Will delivery requires approvalRef');
  }
  return {
    schema: ORGAN_UPDATE_SIGNAL_SCHEMA,
    tenantId: safeId(input.tenantId, 'tenantId'),
    workObjectId: safeId(input.workObjectId, 'workObjectId'),
    organ,
    trigger,
    status,
    audience,
    summary: safeText(input.summary, 'summary', 320),
    observedAt: timestamp(input.observedAt),
    proof,
    ...(approvalRef ? { approvalRef } : {}),
  };
}

export function compileOrganUpdateDelivery(value: unknown): OrganUpdateDelivery {
  const signal = normalizeOrganUpdateSignal(value);
  const workflow = WORKFLOWS.find((candidate) => candidate.organ === signal.organ);
  if (!workflow) throw new TypeError('organ workflow is unavailable');
  const route = ESCALATION_STATUSES.has(signal.status) ? workflow.escalationTopic : workflow.defaultTopic;
  const messageText = [
    `${workflow.name} · ${signal.status} · ${signal.trigger}`,
    signal.workObjectId,
    signal.summary,
    `Proof: ${signal.proof.ref} · ${signal.proof.digest}`,
  ].join('\n');
  const message = {
    format: 'plain-text' as const,
    text: messageText,
    byteLength: utf8Bytes(messageText),
  };
  if (message.byteLength > 1024) throw new TypeError('message exceeds 1024 bytes');
  const identity = {
    signal,
    workflow,
    topicMapDigest: PLAN_BODY.topicMapDigest,
    route,
    messageBytes: message.text,
  };
  const identityDigest = digest(identity);
  const deliveryId = `organ-update_${identityDigest.slice('sha256:'.length, 'sha256:'.length + 32)}`;
  const withoutDigest = {
    schema: ORGAN_UPDATE_DELIVERY_SCHEMA,
    version: 1 as const,
    deliveryId,
    tenantId: signal.tenantId,
    workObjectId: signal.workObjectId,
    organ: signal.organ,
    organName: workflow.name,
    trigger: signal.trigger,
    status: signal.status,
    audience: signal.audience,
    observedAt: signal.observedAt,
    proof: signal.proof,
    approvalRef: signal.approvalRef ?? null,
    requiresApproval: workflow.approval.requiredFor === 'client-audience' && signal.audience === 'client',
    eventDriven: true as const,
    scheduleArmed: false as const,
    workflowDigest: workflow.workflowDigest,
    topicMapDigest: PLAN_BODY.topicMapDigest,
    route,
    message,
  };
  return { ...withoutDigest, deliveryDigest: digest(withoutDigest) };
}

export function organUpdatePlanForFounder(
  activeDeliveries: readonly OrganUpdateDelivery[] = [],
): OrganUpdatePlan {
  if (activeDeliveries.length === 0) return ORGAN_UPDATE_PLAN;
  const bounded = activeDeliveries.slice(0, 20);
  const body = { ...PLAN_BODY, activeDeliveries: bounded };
  return { ...body, planDigest: digest(body) };
}

export function validateOrganUpdateDelivery(value: unknown): value is OrganUpdateDelivery {
  try {
    const row = record(value, 'delivery');
    if (row.schema !== ORGAN_UPDATE_DELIVERY_SCHEMA || row.version !== 1) return false;
    const message = record(row.message, 'message');
    const lines = typeof message.text === 'string' ? message.text.split('\n') : [];
    if (lines.length !== 4) return false;
    const signal: OrganUpdateSignal = {
      schema: ORGAN_UPDATE_SIGNAL_SCHEMA,
      tenantId: row.tenantId as string,
      workObjectId: row.workObjectId as string,
      organ: row.organ as OrganId,
      trigger: row.trigger as OrganUpdateTrigger,
      status: row.status as OrganUpdateStatus,
      audience: row.audience as OrganUpdateAudience,
      summary: lines[2],
      observedAt: row.observedAt as string,
      proof: row.proof as unknown as OrganUpdateProof,
      ...(row.approvalRef ? { approvalRef: row.approvalRef as string } : {}),
    };
    const expected = compileOrganUpdateDelivery(signal);
    return canonicalJson(expected) === canonicalJson(row);
  } catch {
    return false;
  }
}
