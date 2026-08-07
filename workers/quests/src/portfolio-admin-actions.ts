import type { R2BucketLike } from './context-bindings.ts';
import { PORTFOLIO_CATALOG, PORTFOLIO_CLASSIFICATION_DIGEST } from './portfolio-catalog.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST, TRYAMBAKAM_PROJECTS } from './portfolio-root-map.generated.ts';

export const PORTFOLIO_ADMIN_ACTION_SCHEMA = 'thoughtseed.portfolio-admin-action.v1' as const;
export const PORTFOLIO_ADMIN_ACTION_EVIDENCE_SCHEMA = 'thoughtseed.portfolio-admin-action-evidence.v1' as const;
export const PORTFOLIO_ADMIN_ACTION_TRIGGER_SCHEMA = 'thoughtseed.portfolio-admin-action-trigger.v1' as const;
export const PORTFOLIO_ADMIN_ACTION_RECEIPT_SCHEMA = 'thoughtseed.portfolio-admin-action-receipt.v1' as const;

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const SAFE_SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._@/+-]{0,239}$/;
const TEXT = new TextEncoder();
const THOUGHTSEED_WORK_OBJECTS = new Map(PORTFOLIO_CATALOG.records.map((record) => [record.workId, record]));

type PortfolioId = 'thoughtseed' | 'tryambakam-noesis';
type PortfolioAdminActionKind = 'reconcile-work-object' | 'start-project-ingestion';
type NextFlow = 'repository-intake-review' | 'project-repository-ingestion';

interface RepositoryPlanningAuthority {
  kind: 'repository';
  repositoryId: string;
  fullName: string;
}

interface CambiumPlanningAuthority {
  kind: 'cambium';
  reason: string;
}

interface WorkObjectProposal {
  repositorySourceRef: string | null;
  repositoryDisposition: 'resolved' | 'no-repository' | 'unmatched' | 'ambiguous';
  origin: 'thoughtseed-venture' | 'thoughtseed-internal' | 'client' | 'unknown';
  clientFamilyId: string;
  planningAuthority: RepositoryPlanningAuthority | CambiumPlanningAuthority | null;
  repositoryPlanningReviewed: boolean;
  githubIssuesReviewed: boolean;
  legacyEvidenceReviewed: boolean;
  note: string;
}

interface ProjectIngestionProposal {
  status: 'awaiting-ingestion' | 'empty-hold';
}

export type PortfolioAdminAction =
  | {
    schema: typeof PORTFOLIO_ADMIN_ACTION_SCHEMA;
    kind: 'reconcile-work-object';
    portfolioId: 'thoughtseed';
    idempotencyKey: string;
    rootMapDigest: string;
    sourceDigest: string;
    subject: { id: string; name: string };
    proposal: WorkObjectProposal;
  }
  | {
    schema: typeof PORTFOLIO_ADMIN_ACTION_SCHEMA;
    kind: 'start-project-ingestion';
    portfolioId: 'tryambakam-noesis';
    idempotencyKey: string;
    rootMapDigest: string;
    subject: { id: string; name: string; path: string };
    proposal: ProjectIngestionProposal;
  };

export interface PortfolioAdminActionReceipt {
  schema: typeof PORTFOLIO_ADMIN_ACTION_RECEIPT_SCHEMA;
  receiptId: string;
  actionDigest: string;
  recordedAt: string;
  status: 'queued';
  nextFlow: NextFlow;
  duplicate: boolean;
}

interface StoredEvidence {
  schema: typeof PORTFOLIO_ADMIN_ACTION_EVIDENCE_SCHEMA;
  receiptId: string;
  actionDigest: string;
  actorDigest: string;
  recordedAt: string;
  nextFlow: NextFlow;
  action: PortfolioAdminAction;
}

export interface PortfolioAdminActionStoreLike {
  record(evidence: StoredEvidence): Promise<{ duplicate: boolean; recordedAt: string }>;
}

export interface PortfolioAdminActionQueueLike {
  enqueue(trigger: PortfolioAdminActionTrigger): Promise<{ duplicate: boolean }>;
}

interface PortfolioAdminActionTrigger {
  schema: typeof PORTFOLIO_ADMIN_ACTION_TRIGGER_SCHEMA;
  receiptId: string;
  actionDigest: string;
  portfolioId: PortfolioId;
  kind: PortfolioAdminActionKind;
  subjectId: string;
  status: 'pending-governed-intake';
  nextFlow: NextFlow;
  recordedAt: string;
  evidence: { kind: 'immutable-r2-receipt'; receiptId: string };
}

interface QueueKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export class PortfolioAdminActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioAdminActionValidationError';
  }
}

export class PortfolioAdminActionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioAdminActionConflictError';
  }
}

export class PortfolioAdminActionStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioAdminActionStorageError';
  }
}

export class PortfolioAdminActionQueueError extends Error {
  readonly durable: boolean;
  readonly receiptId: string;

  constructor(message: string, receiptId: string, durable = true) {
    super(message);
    this.name = 'PortfolioAdminActionQueueError';
    this.durable = durable;
    this.receiptId = receiptId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(record: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new PortfolioAdminActionValidationError(`${label} fields are invalid`);
  }
}

function boundedText(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== 'string') throw new PortfolioAdminActionValidationError(`${field} must be text`);
  const normalized = value.replace(/\s+/g, ' ').trim();
  if ((required && !normalized) || normalized.length > max) {
    throw new PortfolioAdminActionValidationError(`${field} is invalid`);
  }
  return normalized;
}

function digest(value: unknown, field: string): string {
  const normalized = boundedText(value, field, 64);
  if (!SHA256.test(normalized)) throw new PortfolioAdminActionValidationError(`${field} must be a sha256 hex digest`);
  return normalized;
}

function safeId(value: unknown, field: string, pattern: RegExp): string {
  const normalized = boundedText(value, field, 240);
  if (!pattern.test(normalized)) throw new PortfolioAdminActionValidationError(`${field} is invalid`);
  return normalized;
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new PortfolioAdminActionValidationError(`${field} must be boolean`);
  return value;
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new PortfolioAdminActionValidationError(`${field} is invalid`);
  }
  return value as T;
}

function planningAuthority(value: unknown): WorkObjectProposal['planningAuthority'] {
  if (value === null) return null;
  if (!isRecord(value)) throw new PortfolioAdminActionValidationError('proposal.planningAuthority is invalid');
  if (value.kind === 'repository') {
    exactFields(value, ['kind', 'repositoryId', 'fullName'], 'proposal.planningAuthority');
    return {
      kind: 'repository',
      repositoryId: boundedText(value.repositoryId, 'proposal.planningAuthority.repositoryId', 160),
      fullName: boundedText(value.fullName, 'proposal.planningAuthority.fullName', 160),
    };
  }
  if (value.kind === 'cambium') {
    exactFields(value, ['kind', 'reason'], 'proposal.planningAuthority');
    return { kind: 'cambium', reason: boundedText(value.reason, 'proposal.planningAuthority.reason', 300) };
  }
  throw new PortfolioAdminActionValidationError('proposal.planningAuthority.kind is invalid');
}

function workObjectProposal(value: unknown): WorkObjectProposal {
  if (!isRecord(value)) throw new PortfolioAdminActionValidationError('proposal must be an object');
  exactFields(value, [
    'repositorySourceRef',
    'repositoryDisposition',
    'origin',
    'clientFamilyId',
    'planningAuthority',
    'repositoryPlanningReviewed',
    'githubIssuesReviewed',
    'legacyEvidenceReviewed',
    'note',
  ], 'proposal');
  const repositorySourceRef = value.repositorySourceRef === null
    ? null
    : boundedText(value.repositorySourceRef, 'proposal.repositorySourceRef', 200);
  const repositoryDisposition = oneOf(value.repositoryDisposition, 'proposal.repositoryDisposition', ['resolved', 'no-repository', 'unmatched', 'ambiguous'] as const);
  const origin = oneOf(value.origin, 'proposal.origin', ['thoughtseed-venture', 'thoughtseed-internal', 'client', 'unknown'] as const);
  const clientFamilyId = boundedText(value.clientFamilyId, 'proposal.clientFamilyId', 64, false);
  const authority = planningAuthority(value.planningAuthority);
  if (origin === 'client' && !clientFamilyId) {
    throw new PortfolioAdminActionValidationError('client origin requires proposal.clientFamilyId');
  }
  if (origin !== 'client' && clientFamilyId) {
    throw new PortfolioAdminActionValidationError('non-client origin cannot set proposal.clientFamilyId');
  }
  if (repositoryDisposition === 'resolved' && authority?.kind !== 'repository') {
    throw new PortfolioAdminActionValidationError('resolved repository requires repository planning authority');
  }
  if (repositoryDisposition === 'no-repository' && authority?.kind !== 'cambium') {
    throw new PortfolioAdminActionValidationError('no-repository requires Cambium planning authority');
  }
  return {
    repositorySourceRef,
    repositoryDisposition,
    origin,
    clientFamilyId,
    planningAuthority: authority,
    repositoryPlanningReviewed: bool(value.repositoryPlanningReviewed, 'proposal.repositoryPlanningReviewed'),
    githubIssuesReviewed: bool(value.githubIssuesReviewed, 'proposal.githubIssuesReviewed'),
    legacyEvidenceReviewed: bool(value.legacyEvidenceReviewed, 'proposal.legacyEvidenceReviewed'),
    note: boundedText(value.note, 'proposal.note', 400, false),
  };
}

export function validatePortfolioAdminAction(raw: unknown): PortfolioAdminAction {
  if (!isRecord(raw)) throw new PortfolioAdminActionValidationError('action must be an object');
  const kind = oneOf(raw.kind, 'kind', ['reconcile-work-object', 'start-project-ingestion'] as const);
  if (kind === 'reconcile-work-object') {
    exactFields(raw, ['schema', 'kind', 'portfolioId', 'idempotencyKey', 'rootMapDigest', 'sourceDigest', 'subject', 'proposal'], 'action');
    if (raw.schema !== PORTFOLIO_ADMIN_ACTION_SCHEMA || raw.portfolioId !== 'thoughtseed') {
      throw new PortfolioAdminActionValidationError('reconcile-work-object action grammar is invalid');
    }
    if (!isRecord(raw.subject)) throw new PortfolioAdminActionValidationError('subject must be an object');
    exactFields(raw.subject, ['id', 'name'], 'subject');
    const rootMapDigest = digest(raw.rootMapDigest, 'rootMapDigest');
    const sourceDigest = digest(raw.sourceDigest, 'sourceDigest');
    if (rootMapDigest !== PORTFOLIO_ROOT_MAP_DIGEST) {
      throw new PortfolioAdminActionValidationError('rootMapDigest does not match the reviewed root map');
    }
    if (sourceDigest !== PORTFOLIO_CLASSIFICATION_DIGEST) {
      throw new PortfolioAdminActionValidationError('sourceDigest does not match the shipped portfolio catalog');
    }
    const subjectId = safeId(raw.subject.id, 'subject.id', SAFE_SUBJECT_ID);
    const subjectName = boundedText(raw.subject.name, 'subject.name', 160);
    const catalogRecord = THOUGHTSEED_WORK_OBJECTS.get(subjectId);
    if (!catalogRecord || catalogRecord.name !== subjectName) {
      throw new PortfolioAdminActionValidationError('subject does not match the shipped portfolio catalog');
    }
    return {
      schema: PORTFOLIO_ADMIN_ACTION_SCHEMA,
      kind,
      portfolioId: 'thoughtseed',
      idempotencyKey: safeId(raw.idempotencyKey, 'idempotencyKey', SAFE_IDEMPOTENCY),
      rootMapDigest,
      sourceDigest,
      subject: {
        id: subjectId,
        name: subjectName,
      },
      proposal: workObjectProposal(raw.proposal),
    };
  }

  exactFields(raw, ['schema', 'kind', 'portfolioId', 'idempotencyKey', 'rootMapDigest', 'subject', 'proposal'], 'action');
  if (raw.schema !== PORTFOLIO_ADMIN_ACTION_SCHEMA || raw.portfolioId !== 'tryambakam-noesis') {
    throw new PortfolioAdminActionValidationError('start-project-ingestion action grammar is invalid');
  }
  if (!isRecord(raw.subject)) throw new PortfolioAdminActionValidationError('subject must be an object');
  exactFields(raw.subject, ['id', 'name', 'path'], 'subject');
  if (!isRecord(raw.proposal)) throw new PortfolioAdminActionValidationError('proposal must be an object');
  exactFields(raw.proposal, ['status'], 'proposal');
  const rootMapDigest = digest(raw.rootMapDigest, 'rootMapDigest');
  if (rootMapDigest !== PORTFOLIO_ROOT_MAP_DIGEST) {
    throw new PortfolioAdminActionValidationError('rootMapDigest does not match the reviewed root map');
  }
  const subjectId = safeId(raw.subject.id, 'subject.id', SAFE_SUBJECT_ID);
  const subjectPath = safeId(raw.subject.path, 'subject.path', SAFE_PATH);
  const proposalStatus = oneOf(raw.proposal.status, 'proposal.status', ['awaiting-ingestion', 'empty-hold'] as const);
  const reviewedProject = TRYAMBAKAM_PROJECTS[subjectId as keyof typeof TRYAMBAKAM_PROJECTS];
  if (!reviewedProject || reviewedProject.path !== subjectPath || reviewedProject.status !== proposalStatus) {
    throw new PortfolioAdminActionValidationError('subject does not match one reviewed shallow Tryambakam project');
  }
  return {
    schema: PORTFOLIO_ADMIN_ACTION_SCHEMA,
    kind,
    portfolioId: 'tryambakam-noesis',
    idempotencyKey: safeId(raw.idempotencyKey, 'idempotencyKey', SAFE_IDEMPOTENCY),
    rootMapDigest,
    subject: {
      id: subjectId,
      name: boundedText(raw.subject.name, 'subject.name', 160),
      path: subjectPath,
    },
    proposal: {
      status: proposalStatus,
    },
  };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', TEXT.encode(value) as unknown as BufferSource);
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function nextFlowFor(action: PortfolioAdminAction): NextFlow {
  return action.kind === 'reconcile-work-object'
    ? 'repository-intake-review'
    : 'project-repository-ingestion';
}

export function createPortfolioAdminActionStore(bucket: R2BucketLike): PortfolioAdminActionStoreLike {
  if (!bucket.put) throw new PortfolioAdminActionStorageError('portfolio action R2 binding is not writable');
  return {
    async record(evidence) {
      const keyHash = await sha256(`${evidence.action.portfolioId}:${evidence.action.idempotencyKey}`);
      const key = `admin/portfolio/actions/v1/${evidence.action.portfolioId}/${keyHash}.json`;
      const body = canonicalJson(evidence);
      const existing = await bucket.get(key);
      if (existing) {
        const prior = parseStoredEvidence(await existing.text());
        if (!prior || prior.receiptId !== evidence.receiptId || prior.actionDigest !== evidence.actionDigest) {
          throw new PortfolioAdminActionConflictError('portfolio action idempotency conflict');
        }
        return { duplicate: true, recordedAt: prior.recordedAt };
      }
      let stored;
      try {
        stored = await bucket.put!(key, TEXT.encode(body), {
          onlyIf: { etagDoesNotMatch: '*' },
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            schema: PORTFOLIO_ADMIN_ACTION_EVIDENCE_SCHEMA,
            receiptId: evidence.receiptId,
          },
        });
      } catch {
        const winner = await bucket.get(key);
        if (!winner) throw new PortfolioAdminActionStorageError('portfolio action R2 write failed');
        const prior = parseStoredEvidence(await winner.text());
        if (!prior || prior.receiptId !== evidence.receiptId || prior.actionDigest !== evidence.actionDigest) {
          throw new PortfolioAdminActionConflictError('portfolio action idempotency conflict');
        }
        return { duplicate: true, recordedAt: prior.recordedAt };
      }
      if (stored) return { duplicate: false, recordedAt: evidence.recordedAt };
      const winner = await bucket.get(key);
      if (!winner) throw new PortfolioAdminActionStorageError('portfolio action R2 write was not confirmed');
      const prior = parseStoredEvidence(await winner.text());
      if (!prior || prior.receiptId !== evidence.receiptId || prior.actionDigest !== evidence.actionDigest) {
        throw new PortfolioAdminActionConflictError('portfolio action idempotency conflict');
      }
      return { duplicate: true, recordedAt: prior.recordedAt };
    },
  };
}

function parseStoredEvidence(raw: string): Pick<StoredEvidence, 'receiptId' | 'actionDigest' | 'recordedAt'> | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)
      || value.schema !== PORTFOLIO_ADMIN_ACTION_EVIDENCE_SCHEMA
      || typeof value.receiptId !== 'string'
      || typeof value.actionDigest !== 'string'
      || typeof value.recordedAt !== 'string'
      || !Number.isFinite(Date.parse(value.recordedAt))) return null;
    return {
      receiptId: value.receiptId,
      actionDigest: value.actionDigest,
      recordedAt: value.recordedAt,
    };
  } catch {
    return null;
  }
}

export function createPortfolioAdminActionQueue(kv: QueueKvLike): PortfolioAdminActionQueueLike {
  return {
    async enqueue(trigger) {
      const key = `portfolio-admin:trigger:v1:${trigger.receiptId}`;
      const body = canonicalJson(trigger);
      const existing = await kv.get(key);
      if (existing !== null) {
        if (existing !== body) throw new PortfolioAdminActionConflictError('portfolio action trigger conflict');
        return { duplicate: true };
      }
      await kv.put(key, body);
      return { duplicate: false };
    },
  };
}

export async function recordPortfolioAdminAction(
  raw: unknown,
  deps: {
    store: PortfolioAdminActionStoreLike;
    queue: PortfolioAdminActionQueueLike;
    actorId: string;
    now: () => string;
  },
): Promise<PortfolioAdminActionReceipt> {
  const action = validatePortfolioAdminAction(raw);
  const recordedAt = deps.now();
  if (!Number.isFinite(Date.parse(recordedAt))) {
    throw new PortfolioAdminActionValidationError('server clock is invalid');
  }
  const actionDigestHex = await sha256(canonicalJson(action));
  const actionDigest = `sha256:${actionDigestHex}`;
  const receiptId = `pa_${actionDigestHex.slice(0, 24)}`;
  const nextFlow = nextFlowFor(action);
  const evidence: StoredEvidence = {
    schema: PORTFOLIO_ADMIN_ACTION_EVIDENCE_SCHEMA,
    receiptId,
    actionDigest,
    actorDigest: `sha256:${await sha256(deps.actorId)}`,
    recordedAt,
    nextFlow,
    action,
  };
  const stored = await deps.store.record(evidence);
  const trigger: PortfolioAdminActionTrigger = {
    schema: PORTFOLIO_ADMIN_ACTION_TRIGGER_SCHEMA,
    receiptId,
    actionDigest,
    portfolioId: action.portfolioId,
    kind: action.kind,
    subjectId: action.subject.id,
    status: 'pending-governed-intake',
    nextFlow,
    recordedAt: stored.recordedAt,
    evidence: { kind: 'immutable-r2-receipt', receiptId },
  };
  let queued;
  try {
    queued = await deps.queue.enqueue(trigger);
  } catch (error) {
    if (error instanceof PortfolioAdminActionConflictError) throw error;
    throw new PortfolioAdminActionQueueError('portfolio action evidence is durable but its trigger is pending retry', receiptId);
  }
  return {
    schema: PORTFOLIO_ADMIN_ACTION_RECEIPT_SCHEMA,
    receiptId,
    actionDigest,
    recordedAt: stored.recordedAt,
    status: 'queued',
    nextFlow,
    duplicate: stored.duplicate && queued.duplicate,
  };
}
