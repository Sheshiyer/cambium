import type { R2BucketLike } from './context-bindings.ts';
import { PORTFOLIO_CATALOG, PORTFOLIO_CLASSIFICATION_DIGEST } from './portfolio-catalog.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST } from './portfolio-root-map.generated.ts';

export const PORTFOLIO_ADMIN_ACTION_SCHEMA = 'thoughtseed.portfolio-admin-action.v1' as const;
export const PORTFOLIO_ADMIN_ACTION_EVIDENCE_SCHEMA = 'thoughtseed.portfolio-admin-action-evidence.v1' as const;
export const PORTFOLIO_ADMIN_ACTION_TRIGGER_SCHEMA = 'thoughtseed.portfolio-admin-action-trigger.v1' as const;
export const PORTFOLIO_ADMIN_ACTION_RECEIPT_SCHEMA = 'thoughtseed.portfolio-admin-action-receipt.v1' as const;
export const PROJECT_CREATION_INTENT_SCHEMA = 'thoughtseed.project-creation-intent.v1' as const;
export const PROJECT_CLOSEOUT_SCHEMA = 'thoughtseed.project-closeout.v1' as const;

const SHA256 = /^[0-9a-f]{64}$/;
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const SAFE_IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const SAFE_SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SAFE_CLIENT_FAMILY = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_GATE_RECEIPT = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_REPO_DOC_PATH = /^(?:[.]project|docs)\/[A-Za-z0-9._/-]+\.(?:md|json)$/;
const SAFE_R2_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{7,219}$/;
const TEXT = new TextEncoder();
const THOUGHTSEED_WORK_OBJECTS = new Map(PORTFOLIO_CATALOG.records.map((record) => [record.workId, record]));

type PortfolioId = 'thoughtseed';
type PortfolioAdminActionKind = 'reconcile-work-object' | 'create-thoughtseed-project' | 'close-work-object';
type NextFlow = 'repository-intake-review' | 'founder-gate-review' | 'project-creation-execution' | 'project-closeout';
type ApprovalStatus = 'pending-governed-intake' | 'founder-gate-pending' | 'execution-ready' | 'pending-project-closeout';
type ReceiptApprovalStatus = 'founder-gate-pending' | 'execution-ready' | null;

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

type ProjectRequestSource = 'local-founder' | 'agent' | 'rbac' | 'dgchat' | 'system';
type ProjectOrigin = 'thoughtseed-venture' | 'thoughtseed-internal' | 'client' | 'unknown';
type ProjectKind = 'sapling' | 'internal-program' | 'client-branch' | 'needs-review';

interface FounderApproval {
  receiptId: string;
  intentDigest: string;
}

interface ProjectCreationProposal {
  intentSchema: typeof PROJECT_CREATION_INTENT_SCHEMA;
  requestSource: ProjectRequestSource;
  name: string;
  slug: string;
  origin: ProjectOrigin;
  derivedKind: ProjectKind;
  clientFamilyId: string;
  founderApproval: FounderApproval | null;
}

interface ProjectCloseoutProposal {
  closeoutSchema: typeof PROJECT_CLOSEOUT_SCHEMA;
  disposition: 'completed' | 'closed' | 'terminated';
  finalSummary: string;
  handoffMarkdownPath: string;
  closureReceiptJsonPath: string;
  agentMemoryJsonPath: string;
  r2VaultPrefix: string;
  activeIndexDisposition: 'remove-from-active' | 'mark-finished';
  repositoryFinalStateReviewed: true;
  handoffDocumented: true;
  r2VaultRecorded: true;
  agentMemoryUpdated: true;
  activeIndexUpdated: true;
  downstreamFlowsStopped: true;
  successorWorkObjectId: string;
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
    kind: 'create-thoughtseed-project';
    portfolioId: 'thoughtseed';
    idempotencyKey: string;
    rootMapDigest: string;
    sourceDigest: string;
    subject: { id: string; name: string };
    proposal: ProjectCreationProposal;
  }
  | {
    schema: typeof PORTFOLIO_ADMIN_ACTION_SCHEMA;
    kind: 'close-work-object';
    portfolioId: 'thoughtseed';
    idempotencyKey: string;
    rootMapDigest: string;
    sourceDigest: string;
    subject: { id: string; name: string };
    proposal: ProjectCloseoutProposal;
  };

export interface PortfolioAdminActionReceipt {
  schema: typeof PORTFOLIO_ADMIN_ACTION_RECEIPT_SCHEMA;
  receiptId: string;
  actionDigest: string;
  recordedAt: string;
  status: 'queued';
  nextFlow: NextFlow;
  approvalStatus: ReceiptApprovalStatus;
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

export interface PortfolioFounderGateRecord {
  id: string;
  kind: 'approve';
  subject: string;
  founderId: string;
  status: 'queued' | 'consumed';
}

export interface PortfolioFounderGateResolverLike {
  resolve(receiptId: string): Promise<PortfolioFounderGateRecord | null>;
}

interface PortfolioAdminActionTrigger {
  schema: typeof PORTFOLIO_ADMIN_ACTION_TRIGGER_SCHEMA;
  receiptId: string;
  actionDigest: string;
  portfolioId: PortfolioId;
  kind: PortfolioAdminActionKind;
  subjectId: string;
  status: ApprovalStatus;
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

function confirmed(value: unknown, field: string): true {
  if (value !== true) throw new PortfolioAdminActionValidationError(`${field} must be confirmed`);
  return true;
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

function derivedProjectKind(origin: ProjectOrigin): ProjectKind {
  if (origin === 'thoughtseed-venture') return 'sapling';
  if (origin === 'thoughtseed-internal') return 'internal-program';
  if (origin === 'client') return 'client-branch';
  return 'needs-review';
}

function founderApproval(value: unknown): FounderApproval | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new PortfolioAdminActionValidationError('proposal.founderApproval is invalid');
  exactFields(value, ['receiptId', 'intentDigest'], 'proposal.founderApproval');
  const receiptId = boundedText(value.receiptId, 'proposal.founderApproval.receiptId', 128);
  const intentDigest = boundedText(value.intentDigest, 'proposal.founderApproval.intentDigest', 71);
  if (!SAFE_GATE_RECEIPT.test(receiptId) || !SHA256_REF.test(intentDigest)) {
    throw new PortfolioAdminActionValidationError('proposal.founderApproval is invalid');
  }
  return { receiptId, intentDigest };
}

function projectCreationProposal(value: unknown): ProjectCreationProposal {
  if (!isRecord(value)) throw new PortfolioAdminActionValidationError('proposal must be an object');
  exactFields(value, ['intentSchema', 'requestSource', 'name', 'slug', 'origin', 'clientFamilyId', 'founderApproval'], 'proposal');
  if (value.intentSchema !== PROJECT_CREATION_INTENT_SCHEMA) {
    throw new PortfolioAdminActionValidationError('proposal.intentSchema is invalid');
  }
  const requestSource = oneOf(value.requestSource, 'proposal.requestSource', ['local-founder', 'agent', 'rbac', 'dgchat', 'system'] as const);
  const name = boundedText(value.name, 'proposal.name', 120);
  const slug = boundedText(value.slug, 'proposal.slug', 64);
  if (!SAFE_SLUG.test(slug)) throw new PortfolioAdminActionValidationError('proposal.slug is invalid');
  const origin = oneOf(value.origin, 'proposal.origin', ['thoughtseed-venture', 'thoughtseed-internal', 'client', 'unknown'] as const);
  const clientFamilyId = boundedText(value.clientFamilyId, 'proposal.clientFamilyId', 64, false);
  if (origin === 'client' && !SAFE_CLIENT_FAMILY.test(clientFamilyId)) {
    throw new PortfolioAdminActionValidationError('client origin requires proposal.clientFamilyId');
  }
  if (origin !== 'client' && clientFamilyId) {
    throw new PortfolioAdminActionValidationError('non-client origin cannot set proposal.clientFamilyId');
  }
  return {
    intentSchema: PROJECT_CREATION_INTENT_SCHEMA,
    requestSource,
    name,
    slug,
    origin,
    derivedKind: derivedProjectKind(origin),
    clientFamilyId,
    founderApproval: founderApproval(value.founderApproval),
  };
}

function closeoutDocumentPath(value: unknown, field: string): string {
  const normalized = boundedText(value, field, 160);
  if (!SAFE_REPO_DOC_PATH.test(normalized) || normalized.includes('//') || normalized.includes('..')) {
    throw new PortfolioAdminActionValidationError(`${field} is invalid`);
  }
  return normalized;
}

function closeoutProposal(value: unknown): ProjectCloseoutProposal {
  if (!isRecord(value)) throw new PortfolioAdminActionValidationError('proposal must be an object');
  exactFields(value, [
    'closeoutSchema',
    'disposition',
    'finalSummary',
    'handoffMarkdownPath',
    'closureReceiptJsonPath',
    'agentMemoryJsonPath',
    'r2VaultPrefix',
    'activeIndexDisposition',
    'repositoryFinalStateReviewed',
    'handoffDocumented',
    'r2VaultRecorded',
    'agentMemoryUpdated',
    'activeIndexUpdated',
    'downstreamFlowsStopped',
    'successorWorkObjectId',
  ], 'proposal');
  if (value.closeoutSchema !== PROJECT_CLOSEOUT_SCHEMA) {
    throw new PortfolioAdminActionValidationError('proposal.closeoutSchema is invalid');
  }
  const r2VaultPrefix = boundedText(value.r2VaultPrefix, 'proposal.r2VaultPrefix', 220);
  if (!SAFE_R2_PREFIX.test(r2VaultPrefix) || r2VaultPrefix.includes('//') || r2VaultPrefix.includes('..')) {
    throw new PortfolioAdminActionValidationError('proposal.r2VaultPrefix is invalid');
  }
  const successorWorkObjectId = boundedText(value.successorWorkObjectId, 'proposal.successorWorkObjectId', 160, false);
  if (successorWorkObjectId && !SAFE_SUBJECT_ID.test(successorWorkObjectId)) {
    throw new PortfolioAdminActionValidationError('proposal.successorWorkObjectId is invalid');
  }
  return {
    closeoutSchema: PROJECT_CLOSEOUT_SCHEMA,
    disposition: oneOf(value.disposition, 'proposal.disposition', ['completed', 'closed', 'terminated'] as const),
    finalSummary: boundedText(value.finalSummary, 'proposal.finalSummary', 1200),
    handoffMarkdownPath: closeoutDocumentPath(value.handoffMarkdownPath, 'proposal.handoffMarkdownPath'),
    closureReceiptJsonPath: closeoutDocumentPath(value.closureReceiptJsonPath, 'proposal.closureReceiptJsonPath'),
    agentMemoryJsonPath: closeoutDocumentPath(value.agentMemoryJsonPath, 'proposal.agentMemoryJsonPath'),
    r2VaultPrefix,
    activeIndexDisposition: oneOf(value.activeIndexDisposition, 'proposal.activeIndexDisposition', ['remove-from-active', 'mark-finished'] as const),
    repositoryFinalStateReviewed: confirmed(value.repositoryFinalStateReviewed, 'proposal.repositoryFinalStateReviewed'),
    handoffDocumented: confirmed(value.handoffDocumented, 'proposal.handoffDocumented'),
    r2VaultRecorded: confirmed(value.r2VaultRecorded, 'proposal.r2VaultRecorded'),
    agentMemoryUpdated: confirmed(value.agentMemoryUpdated, 'proposal.agentMemoryUpdated'),
    activeIndexUpdated: confirmed(value.activeIndexUpdated, 'proposal.activeIndexUpdated'),
    downstreamFlowsStopped: confirmed(value.downstreamFlowsStopped, 'proposal.downstreamFlowsStopped'),
    successorWorkObjectId,
  };
}

export function validatePortfolioAdminAction(raw: unknown): PortfolioAdminAction {
  if (!isRecord(raw)) throw new PortfolioAdminActionValidationError('action must be an object');
  const kind = oneOf(raw.kind, 'kind', ['reconcile-work-object', 'create-thoughtseed-project', 'close-work-object'] as const);
  if (kind === 'reconcile-work-object' || kind === 'close-work-object') {
    exactFields(raw, ['schema', 'kind', 'portfolioId', 'idempotencyKey', 'rootMapDigest', 'sourceDigest', 'subject', 'proposal'], 'action');
    if (raw.schema !== PORTFOLIO_ADMIN_ACTION_SCHEMA || raw.portfolioId !== 'thoughtseed') {
      throw new PortfolioAdminActionValidationError(`${kind} action grammar is invalid`);
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
      proposal: kind === 'reconcile-work-object' ? workObjectProposal(raw.proposal) : closeoutProposal(raw.proposal),
    } as Extract<PortfolioAdminAction, { kind: 'reconcile-work-object' | 'close-work-object' }>;
  }

  exactFields(raw, ['schema', 'kind', 'portfolioId', 'idempotencyKey', 'rootMapDigest', 'sourceDigest', 'subject', 'proposal'], 'action');
  if (raw.schema !== PORTFOLIO_ADMIN_ACTION_SCHEMA || raw.portfolioId !== 'thoughtseed') {
    throw new PortfolioAdminActionValidationError('create-thoughtseed-project action grammar is invalid');
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
  const proposal = projectCreationProposal(raw.proposal);
  const subjectId = boundedText(raw.subject.id, 'subject.id', 64);
  const subjectName = boundedText(raw.subject.name, 'subject.name', 120);
  if (subjectId !== proposal.slug || subjectName !== proposal.name) {
    throw new PortfolioAdminActionValidationError('subject does not match the project creation proposal');
  }
  return {
    schema: PORTFOLIO_ADMIN_ACTION_SCHEMA,
    kind,
    portfolioId: 'thoughtseed',
    idempotencyKey: safeId(raw.idempotencyKey, 'idempotencyKey', SAFE_IDEMPOTENCY),
    rootMapDigest,
    sourceDigest,
    subject: { id: subjectId, name: subjectName },
    proposal,
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

function projectIntentCore(action: Extract<PortfolioAdminAction, { kind: 'create-thoughtseed-project' }>): unknown {
  const { founderApproval: _approval, ...proposal } = action.proposal;
  return { portfolioId: action.portfolioId, kind: action.kind, subject: action.subject, proposal };
}

export async function projectCreationIntentDigest(raw: unknown): Promise<string> {
  const action = validatePortfolioAdminAction(raw);
  if (action.kind !== 'create-thoughtseed-project') {
    throw new PortfolioAdminActionValidationError('project creation intent is required');
  }
  return `sha256:${await sha256(canonicalJson(projectIntentCore(action)))}`;
}

async function approvalFor(
  action: PortfolioAdminAction,
  founderGateResolver?: PortfolioFounderGateResolverLike,
): Promise<{
  status: ApprovalStatus;
  nextFlow: NextFlow;
  approvalStatus: PortfolioAdminActionReceipt['approvalStatus'];
}> {
  if (action.kind === 'reconcile-work-object') {
    return { status: 'pending-governed-intake', nextFlow: 'repository-intake-review', approvalStatus: null };
  }
  if (action.kind === 'close-work-object') {
    return { status: 'pending-project-closeout', nextFlow: 'project-closeout', approvalStatus: null };
  }
  if (action.proposal.origin === 'unknown') {
    return { status: 'founder-gate-pending', nextFlow: 'founder-gate-review', approvalStatus: 'founder-gate-pending' };
  }
  if (action.proposal.requestSource === 'local-founder') {
    if (action.proposal.founderApproval !== null) {
      throw new PortfolioAdminActionValidationError('local-founder intent cannot include founderApproval');
    }
    return { status: 'execution-ready', nextFlow: 'project-creation-execution', approvalStatus: 'execution-ready' };
  }
  const expectedDigest = `sha256:${await sha256(canonicalJson(projectIntentCore(action)))}`;
  if (!action.proposal.founderApproval) {
    return { status: 'founder-gate-pending', nextFlow: 'founder-gate-review', approvalStatus: 'founder-gate-pending' };
  }
  if (action.proposal.founderApproval.intentDigest !== expectedDigest) {
    throw new PortfolioAdminActionValidationError('founderApproval does not bind the normalized project intent');
  }
  if (!founderGateResolver) {
    throw new PortfolioAdminActionValidationError('founderApproval requires the trusted Founder Gate resolver');
  }
  const resolved = await founderGateResolver.resolve(action.proposal.founderApproval.receiptId);
  if (!resolved
    || resolved.id !== action.proposal.founderApproval.receiptId
    || resolved.kind !== 'approve'
    || resolved.subject !== expectedDigest
    || !resolved.founderId
    || !['queued', 'consumed'].includes(resolved.status)) {
    throw new PortfolioAdminActionValidationError('founderApproval was not verified by the trusted Founder Gate resolver');
  }
  return { status: 'execution-ready', nextFlow: 'project-creation-execution', approvalStatus: 'execution-ready' };
}

export function createPortfolioFounderGateResolver(kv: Pick<QueueKvLike, 'get'>): PortfolioFounderGateResolverLike {
  return {
    async resolve(receiptId) {
      if (!SAFE_GATE_RECEIPT.test(receiptId)) return null;
      const raw = await kv.get(`gate:thoughtseed:${receiptId}`);
      if (!raw) return null;
      try {
        const value = JSON.parse(raw) as unknown;
        if (!isRecord(value)
          || value.id !== receiptId
          || value.kind !== 'approve'
          || typeof value.subject !== 'string'
          || !SHA256_REF.test(value.subject)
          || typeof value.founderId !== 'string'
          || !value.founderId.trim()
          || !['queued', 'consumed'].includes(String(value.status))) return null;
        return {
          id: receiptId,
          kind: 'approve',
          subject: value.subject,
          founderId: value.founderId.trim(),
          status: value.status as 'queued' | 'consumed',
        };
      } catch {
        return null;
      }
    },
  };
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
    founderGateResolver?: PortfolioFounderGateResolverLike;
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
  const approval = await approvalFor(action, deps.founderGateResolver);
  const nextFlow = approval.nextFlow;
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
    status: approval.status,
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
    approvalStatus: approval.approvalStatus,
    duplicate: stored.duplicate && queued.duplicate,
  };
}
