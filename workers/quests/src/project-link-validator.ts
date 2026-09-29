import {
  PORTFOLIO_CATALOG,
  PORTFOLIO_CATALOG_DIGEST,
  type PortfolioClassification,
  type PortfolioLifecycle,
} from './portfolio-catalog.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST } from './portfolio-root-map.generated.ts';

export const PROJECT_LINK_SCHEMA = 'thoughtseed.project-link.v1' as const;

const SAFE_CLIENT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CF_ACCOUNT_ID = /^[a-f0-9]{32}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
const HTTPS_URL = /^https:\/\//;
const WORK_ID = /^(?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_LINK_KINDS = ['client-branch', 'sapling', 'internal-program'] as const;
const PROJECT_LINK_LIFECYCLES = ['active', 'paused', 'completed', 'archived', 'needs-review'] as const;
const SOURCE_OF_TRUTH = ['vault', 'github', 'cambium', 'mixed'] as const;
const SYNC_STATUS = ['local-only', 'mapped', 'synced', 'stale', 'conflict'] as const;
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;

export type ProjectLinkKind = typeof PROJECT_LINK_KINDS[number];
export type ProjectLinkLifecycle = typeof PROJECT_LINK_LIFECYCLES[number];
type SourceOfTruth = typeof SOURCE_OF_TRUTH[number];
type SyncStatus = typeof SYNC_STATUS[number];

interface ClientIdentity {
  id: string;
  name: string;
  cloudflareAccountId?: string;
  cloudflareProfile?: string;
}

interface CambiumBinding {
  workIds: string[];
  portfolioCatalogDigest?: string;
  rootMapDigest?: string;
  planningAuthority: string[];
}

interface SupersetHand {
  display: string;
  branchPrefix: string;
  localPath: string;
}

interface Worktree {
  name: string;
  purpose: string;
}

interface ExecutionContext {
  supersetHands: SupersetHand[];
  worktrees: Worktree[];
}

interface RepoMapping {
  name: string;
  github: string;
  localPath?: string;
  description?: string;
}

interface LiveSite {
  url: string;
  label?: string;
}

interface ExternalRef {
  system: string;
  id: string;
  url?: string;
}

interface LinkMapping {
  workspace?: string;
  repos: RepoMapping[];
  liveSites: LiveSite[];
  externalRefs: ExternalRef[];
}

interface ProofMetadata {
  sourceOfTruth: SourceOfTruth;
  syncStatus: SyncStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectLink {
  schema: typeof PROJECT_LINK_SCHEMA;
  kind: ProjectLinkKind;
  lifecycle: ProjectLinkLifecycle;
  client?: ClientIdentity;
  cambium: CambiumBinding;
  execution: ExecutionContext;
  mapping: LinkMapping;
  proof: ProofMetadata;
}

export class ProjectLinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectLinkValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(record: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new ProjectLinkValidationError(`${label} fields are invalid`);
  }
}

function optionalExactFields(record: Record<string, unknown>, required: readonly string[], optional: readonly string[], label: string): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some((field) => !(field in record)) || Object.keys(record).some((field) => !allowed.has(field))) {
    throw new ProjectLinkValidationError(`${label} fields are invalid`);
  }
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new ProjectLinkValidationError(`${field} must be text`);
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > max) throw new ProjectLinkValidationError(`${field} is invalid`);
  return normalized;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  return text(value, field, max);
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ProjectLinkValidationError(`${field} is invalid`);
  }
  return value as T;
}

function patterned(value: unknown, field: string, rx: RegExp, max = 500): string {
  const normalized = text(value, field, max);
  if (!rx.test(normalized)) throw new ProjectLinkValidationError(`${field} is invalid`);
  return normalized;
}

function optionalPattern(value: unknown, field: string, rx: RegExp, max = 500): string | undefined {
  if (value === undefined) return undefined;
  return patterned(value, field, rx, max);
}

function list<T>(value: unknown, field: string, item: (entry: unknown, index: number) => T, min = 0, max = Number.POSITIVE_INFINITY): T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new ProjectLinkValidationError(`${field} is invalid`);
  }
  return value.map(item);
}

function unique(values: string[], field: string): string[] {
  if (new Set(values).size !== values.length) throw new ProjectLinkValidationError(`${field} must be unique`);
  return values;
}

function uniqueItems<T>(values: T[], field: string): T[] {
  if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) {
    throw new ProjectLinkValidationError(`${field} must be unique`);
  }
  return values;
}

function validCalendarDate(value: unknown, field: string): string {
  const date = patterned(value, field, ISO_DATE, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ProjectLinkValidationError(`${field} must be a valid calendar date`);
  }
  return date;
}

function optionalCalendarDate(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : validCalendarDate(value, field);
}

function httpsUrl(value: unknown, field: string, github = false): string {
  const normalized = patterned(value, field, github ? GITHUB_URL : HTTPS_URL);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new ProjectLinkValidationError(`${field} is invalid`);
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) throw new ProjectLinkValidationError(`${field} is invalid`);
  return normalized;
}

function relativePath(value: unknown, field: string): string {
  const normalized = text(value, field, 300);
  if (ABSOLUTE_PATH.test(normalized)) throw new ProjectLinkValidationError(`${field} must not be an absolute path`);
  return normalized;
}

function optionalRelativePath(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : relativePath(value, field);
}

function validateClient(value: unknown): ClientIdentity {
  if (!isRecord(value)) throw new ProjectLinkValidationError('client must be an object');
  optionalExactFields(value, ['id', 'name'], ['cloudflareAccountId', 'cloudflareProfile'], 'client');
  return {
    id: patterned(value.id, 'client.id', SAFE_CLIENT_ID, 64),
    name: text(value.name, 'client.name', 120),
    cloudflareAccountId: optionalPattern(value.cloudflareAccountId, 'client.cloudflareAccountId', CF_ACCOUNT_ID, 32),
    cloudflareProfile: optionalText(value.cloudflareProfile, 'client.cloudflareProfile', 64),
  };
}

function validateCambium(value: unknown): CambiumBinding {
  if (!isRecord(value)) throw new ProjectLinkValidationError('cambium must be an object');
  optionalExactFields(value, ['workIds', 'planningAuthority'], ['portfolioCatalogDigest', 'rootMapDigest'], 'cambium');
  const workIds = unique(list(value.workIds, 'cambium.workIds', (entry, index) =>
    patterned(entry, `cambium.workIds[${index}]`, WORK_ID, 128), 1, 64), 'cambium.workIds');
  const planningAuthority = unique(list(value.planningAuthority, 'cambium.planningAuthority', (entry, index) =>
    text(entry, `cambium.planningAuthority[${index}]`, 500), 1, 64), 'cambium.planningAuthority');
  const portfolioCatalogDigest = optionalPattern(value.portfolioCatalogDigest, 'cambium.portfolioCatalogDigest', SHA256_REF, 71);
  const rootMapDigest = optionalPattern(value.rootMapDigest, 'cambium.rootMapDigest', SHA256, 64);
  if (portfolioCatalogDigest && portfolioCatalogDigest !== PORTFOLIO_CATALOG_DIGEST) {
    throw new ProjectLinkValidationError('cambium.portfolioCatalogDigest does not match the shipped portfolio catalog');
  }
  if (rootMapDigest && rootMapDigest !== PORTFOLIO_ROOT_MAP_DIGEST) {
    throw new ProjectLinkValidationError('cambium.rootMapDigest does not match the reviewed root map');
  }
  return { workIds, planningAuthority, portfolioCatalogDigest, rootMapDigest };
}

function validateSupersetHand(value: unknown, index: number): SupersetHand {
  if (!isRecord(value)) throw new ProjectLinkValidationError(`execution.supersetHands[${index}] must be an object`);
  exactFields(value, ['display', 'branchPrefix', 'localPath'], `execution.supersetHands[${index}]`);
  return {
    display: text(value.display, `execution.supersetHands[${index}].display`, 80),
    branchPrefix: text(value.branchPrefix, `execution.supersetHands[${index}].branchPrefix`, 40),
    localPath: relativePath(value.localPath, `execution.supersetHands[${index}].localPath`),
  };
}

function validateWorktree(value: unknown, index: number): Worktree {
  if (!isRecord(value)) throw new ProjectLinkValidationError(`execution.worktrees[${index}] must be an object`);
  exactFields(value, ['name', 'purpose'], `execution.worktrees[${index}]`);
  return {
    name: text(value.name, `execution.worktrees[${index}].name`, 120),
    purpose: text(value.purpose, `execution.worktrees[${index}].purpose`, 200),
  };
}

function validateExecution(value: unknown): ExecutionContext {
  if (!isRecord(value)) throw new ProjectLinkValidationError('execution must be an object');
  exactFields(value, ['supersetHands', 'worktrees'], 'execution');
  return {
    supersetHands: list(value.supersetHands, 'execution.supersetHands', validateSupersetHand, 0, 64),
    worktrees: list(value.worktrees, 'execution.worktrees', validateWorktree, 0, 64),
  };
}

function validateRepo(value: unknown, index: number): RepoMapping {
  if (!isRecord(value)) throw new ProjectLinkValidationError(`mapping.repos[${index}] must be an object`);
  optionalExactFields(value, ['name', 'github'], ['localPath', 'description'], `mapping.repos[${index}]`);
  const localPath = optionalRelativePath(value.localPath, `mapping.repos[${index}].localPath`);
  return {
    name: text(value.name, `mapping.repos[${index}].name`, 120),
    github: httpsUrl(value.github, `mapping.repos[${index}].github`, true),
    localPath,
    description: optionalText(value.description, `mapping.repos[${index}].description`, 300),
  };
}

function validateLiveSite(value: unknown, index: number): LiveSite {
  if (!isRecord(value)) throw new ProjectLinkValidationError(`mapping.liveSites[${index}] must be an object`);
  optionalExactFields(value, ['url'], ['label'], `mapping.liveSites[${index}]`);
  return {
    url: httpsUrl(value.url, `mapping.liveSites[${index}].url`),
    label: optionalText(value.label, `mapping.liveSites[${index}].label`, 80),
  };
}

function validateExternalRef(value: unknown, index: number): ExternalRef {
  if (!isRecord(value)) throw new ProjectLinkValidationError(`mapping.externalRefs[${index}] must be an object`);
  optionalExactFields(value, ['system', 'id'], ['url'], `mapping.externalRefs[${index}]`);
  return {
    system: text(value.system, `mapping.externalRefs[${index}].system`, 40),
    id: text(value.id, `mapping.externalRefs[${index}].id`, 160),
    url: value.url === undefined ? undefined : httpsUrl(value.url, `mapping.externalRefs[${index}].url`),
  };
}

function validateMapping(value: unknown): LinkMapping {
  if (!isRecord(value)) throw new ProjectLinkValidationError('mapping must be an object');
  optionalExactFields(value, ['repos', 'liveSites', 'externalRefs'], ['workspace'], 'mapping');
  const workspace = optionalRelativePath(value.workspace, 'mapping.workspace');
  return {
    workspace,
    repos: uniqueItems(list(value.repos, 'mapping.repos', validateRepo, 1, 100), 'mapping.repos'),
    liveSites: list(value.liveSites, 'mapping.liveSites', validateLiveSite, 0, 64),
    externalRefs: list(value.externalRefs, 'mapping.externalRefs', validateExternalRef, 0, 64),
  };
}

function validateProof(value: unknown): ProofMetadata {
  if (!isRecord(value)) throw new ProjectLinkValidationError('proof must be an object');
  optionalExactFields(value, ['sourceOfTruth', 'syncStatus', 'createdAt', 'updatedAt'], ['verifiedAt', 'verifiedBy'], 'proof');
  const verifiedAt = optionalCalendarDate(value.verifiedAt, 'proof.verifiedAt');
  const verifiedBy = optionalText(value.verifiedBy, 'proof.verifiedBy', 64);
  if ((verifiedAt && !verifiedBy) || (!verifiedAt && verifiedBy)) {
    throw new ProjectLinkValidationError('proof.verifiedAt and proof.verifiedBy must both be present or both absent');
  }
  return {
    sourceOfTruth: oneOf(value.sourceOfTruth, 'proof.sourceOfTruth', SOURCE_OF_TRUTH),
    syncStatus: oneOf(value.syncStatus, 'proof.syncStatus', SYNC_STATUS),
    verifiedAt,
    verifiedBy,
    createdAt: validCalendarDate(value.createdAt, 'proof.createdAt'),
    updatedAt: validCalendarDate(value.updatedAt, 'proof.updatedAt'),
  };
}

function expectedClassification(kind: ProjectLinkKind): PortfolioClassification {
  return kind;
}

function allowedLifecycle(linkLifecycle: ProjectLinkLifecycle, record: { lifecycle?: PortfolioLifecycle; operationalOverlay?: 'paused' }): boolean {
  if (linkLifecycle === 'needs-review') return true;
  if (linkLifecycle === 'paused') return record.operationalOverlay === 'paused';
  if (!record.lifecycle) return linkLifecycle === 'active';
  if (linkLifecycle === 'active') return ['proposed', 'approved', 'executing', 'verifying'].includes(record.lifecycle);
  if (linkLifecycle === 'completed') return record.lifecycle === 'complete';
  return record.lifecycle === 'retired';
}

function validateCatalogBinding(link: Pick<ProjectLink, 'kind' | 'lifecycle' | 'client' | 'cambium'>): void {
  const classification = expectedClassification(link.kind);
  for (const workId of link.cambium.workIds) {
    const record = PORTFOLIO_CATALOG.records.find((candidate) => candidate.workId === workId);
    if (!record) throw new ProjectLinkValidationError(`cambium.workIds contains unknown canonical WorkObject: ${workId}`);
    if (classification && record.classification !== classification) {
      throw new ProjectLinkValidationError(`kind does not match the catalog classification for ${workId}`);
    }
    if (link.kind === 'client-branch') {
      if (!record.accountId) {
        throw new ProjectLinkValidationError(`catalog account is missing for client-branch WorkObject: ${workId}`);
      }
      if (link.client?.id !== record.accountId) {
        throw new ProjectLinkValidationError(`client.id does not match the catalog account for ${workId}`);
      }
    }
    if (!allowedLifecycle(link.lifecycle, record)) {
      throw new ProjectLinkValidationError(`lifecycle does not match the catalog lifecycle for ${workId}`);
    }
  }
}

export function validateProjectLink(raw: unknown): ProjectLink {
  if (!isRecord(raw)) throw new ProjectLinkValidationError('project-link must be an object');
  optionalExactFields(raw, ['schema', 'kind', 'lifecycle', 'cambium', 'execution', 'mapping', 'proof'], ['client'], 'project-link');
  if (raw.schema !== PROJECT_LINK_SCHEMA) {
    throw new ProjectLinkValidationError(`schema must be '${PROJECT_LINK_SCHEMA}'`);
  }
  const kind = oneOf(raw.kind, 'kind', PROJECT_LINK_KINDS);
  const lifecycle = oneOf(raw.lifecycle, 'lifecycle', PROJECT_LINK_LIFECYCLES);
  if (kind === 'client-branch' && raw.client === undefined) {
    throw new ProjectLinkValidationError("kind 'client-branch' requires client");
  }
  if (kind !== 'client-branch' && raw.client !== undefined) {
    throw new ProjectLinkValidationError('client is only valid for client-branch links');
  }
  const client = raw.client === undefined ? undefined : validateClient(raw.client);
  const cambium = validateCambium(raw.cambium);
  const execution = validateExecution(raw.execution);
  const mapping = validateMapping(raw.mapping);
  const proof = validateProof(raw.proof);
  const result = { schema: PROJECT_LINK_SCHEMA, kind, lifecycle, client, cambium, execution, mapping, proof };
  validateCatalogBinding(result);
  return result;
}
