import type { R2BucketLike } from './context-bindings.ts';
import {
  PORTFOLIO_CATALOG,
  PORTFOLIO_CATALOG_DIGEST,
  PORTFOLIO_CLASSIFICATION_DIGEST,
} from './portfolio-catalog.ts';
import { PORTFOLIO_ROOT_MAP_DIGEST } from './portfolio-root-map.generated.ts';

export const PORTFOLIO_MAPPING_RECEIPT_SCHEMA = 'thoughtseed.portfolio-mapping-receipt.v1' as const;
export const PORTFOLIO_MAPPING_BUNDLE_SCHEMA = 'thoughtseed.portfolio-mapping-receipt-bundle.v1' as const;

const TEXT = new TextEncoder();
const WORK_ID = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPOSITORY_ID = /^(?:R_[A-Za-z0-9_-]{6,}|MDEwOlJlcG9zaXRvcnk[0-9A-Za-z+/=]+)$/;
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const CATALOG_BY_WORK_ID = new Map(PORTFOLIO_CATALOG.records.map((record) => [record.workId, record]));

export type MappingWorkObjectKind = 'sapling' | 'branch' | 'program';
export type MappingOriginAssertion = 'thoughtseed-origin' | 'client-origin' | 'linked-product-client-delivery' | 'co-founded-venture';
export type MappingRepositoryRole = 'product-source' | 'client-branch-source' | 'co-founded-venture-source';

export interface PortfolioMappingReceiptInput {
  schema: typeof PORTFOLIO_MAPPING_RECEIPT_SCHEMA;
  portfolioId: 'thoughtseed';
  batchId: string;
  founderApprovalId: string;
  decision: 'map-reviewed-repository';
  workObjectId: string;
  workObjectKind: MappingWorkObjectKind;
  originAssertion: MappingOriginAssertion;
  repositoryRole: MappingRepositoryRole;
  repository: {
    nameWithOwner: string;
    repositoryId: string;
    databaseId: number;
    isFork: boolean;
    defaultBranchRef: string;
    pushedAt: string;
  };
  rootMap: {
    folder: string | null;
    additionalFolders: string[];
    proposedKind: 'sapling' | 'client-branch' | 'internal-program' | 'needs-review' | 'co-founded-venture' | null;
    proposedKind: 'sapling' | 'client-branch' | 'internal-program' | 'needs-review' | null;
    accountId: string | null;
    workIds: string[];
    status: 'mapping-proposal' | 'no-shallow-folder';
  };
  lifecycle: string;
  catalogDigest: string;
  classificationDigest: string;
  rootMapDigest: string;
  repositoryEvidenceDigest: string;
}

export interface PortfolioMappingReceipt extends PortfolioMappingReceiptInput {
  receiptKind: 'mapping';
  receiptId: string;
  contentDigest: string;
  idempotencyKey: string;
  r2Key: string;
  status: 'prepared';
}

export interface PortfolioMappingReceiptStoreLike {
  record(receipt: PortfolioMappingReceipt): Promise<{ duplicate: boolean }>;
}

export class PortfolioMappingReceiptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioMappingReceiptValidationError';
  }
}

export class PortfolioMappingReceiptConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioMappingReceiptConflictError';
  }
}

export class PortfolioMappingReceiptStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioMappingReceiptStorageError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(record: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new PortfolioMappingReceiptValidationError(`${label} fields are invalid`);
  }
}

function text(value: unknown, field: string, max = 240, allowEmpty = false): string {
  if (typeof value !== 'string') throw new PortfolioMappingReceiptValidationError(`${field} must be text`);
  const normalized = value.replace(/\s+/g, ' ').trim();
  if ((!allowEmpty && !normalized) || normalized.length > max) {
    throw new PortfolioMappingReceiptValidationError(`${field} is invalid`);
  }
  return normalized;
}

function nullableText(value: unknown, field: string, max = 160): string | null {
  if (value === null) return null;
  return text(value, field, max);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

export function canonicalMappingReceiptJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', TEXT.encode(value) as unknown as BufferSource);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new PortfolioMappingReceiptValidationError(`${field} must be a text array`);
  }
  const normalized = value.map((entry, index) => text(entry, `${field}[${index}]`, 160));
  if (new Set(normalized).size !== normalized.length) {
    throw new PortfolioMappingReceiptValidationError(`${field} contains duplicates`);
  }
  return normalized.sort((left, right) => left.localeCompare(right));
}

function validateRootMap(value: unknown, workObjectId: string): PortfolioMappingReceiptInput['rootMap'] {
  if (!isRecord(value)) throw new PortfolioMappingReceiptValidationError('rootMap must be an object');
  exactFields(value, ['folder', 'additionalFolders', 'proposedKind', 'accountId', 'workIds', 'status'], 'rootMap');
  const folder = nullableText(value.folder, 'rootMap.folder');
  const additionalFolders = normalizeStringArray(value.additionalFolders, 'rootMap.additionalFolders');
  const accountId = nullableText(value.accountId, 'rootMap.accountId', 80);
  const workIds = normalizeStringArray(value.workIds, 'rootMap.workIds');
  const status = value.status;
  const proposedKind = value.proposedKind;
  if (!['mapping-proposal', 'no-shallow-folder'].includes(String(status))) {
    throw new PortfolioMappingReceiptValidationError('rootMap.status is invalid');
  }
  if (proposedKind !== null && !['sapling', 'client-branch', 'internal-program', 'needs-review', 'co-founded-venture'].includes(String(proposedKind))) {
    throw new PortfolioMappingReceiptValidationError('rootMap.proposedKind is invalid');
  }
  if (status === 'mapping-proposal') {
    if (!folder || proposedKind === null || !workIds.includes(workObjectId)) {
      throw new PortfolioMappingReceiptValidationError('mapped root context must contain the WorkObject');
    }
  } else if (folder !== null || proposedKind !== null || accountId !== null || workIds.length || additionalFolders.length) {
    throw new PortfolioMappingReceiptValidationError('folderless root context must remain empty');
  }
  return {
    folder,
    additionalFolders,
    proposedKind: proposedKind as PortfolioMappingReceiptInput['rootMap']['proposedKind'],
    accountId,
    workIds,
    status: status as PortfolioMappingReceiptInput['rootMap']['status'],
  };
}

export function validatePortfolioMappingReceiptInput(raw: unknown): PortfolioMappingReceiptInput {
  if (!isRecord(raw)) throw new PortfolioMappingReceiptValidationError('mapping receipt input must be an object');
  exactFields(raw, [
    'schema', 'portfolioId', 'batchId', 'founderApprovalId', 'decision', 'workObjectId', 'workObjectKind',
    'originAssertion', 'repositoryRole', 'repository', 'rootMap', 'lifecycle', 'catalogDigest',
    'classificationDigest', 'rootMapDigest', 'repositoryEvidenceDigest',
  ], 'mapping receipt input');
  if (raw.schema !== PORTFOLIO_MAPPING_RECEIPT_SCHEMA || raw.portfolioId !== 'thoughtseed' || raw.decision !== 'map-reviewed-repository') {
    throw new PortfolioMappingReceiptValidationError('mapping receipt grammar is invalid');
  }
  const batchId = text(raw.batchId, 'batchId', 128);
  const founderApprovalId = text(raw.founderApprovalId, 'founderApprovalId', 160);
  if (!SAFE_ID.test(batchId) || !SAFE_ID.test(founderApprovalId)) {
    throw new PortfolioMappingReceiptValidationError('mapping receipt authority IDs are invalid');
  }
  const workObjectId = text(raw.workObjectId, 'workObjectId', 160);
  const workIdMatch = WORK_ID.exec(workObjectId);
  const workObjectKind = raw.workObjectKind;
  if (!workIdMatch || !['sapling', 'branch', 'program'].includes(String(workObjectKind)) || workIdMatch[1] !== workObjectKind) {
    throw new PortfolioMappingReceiptValidationError('WorkObject ID and kind do not match');
  }
  if (!CATALOG_BY_WORK_ID.has(workObjectId)) {
    throw new PortfolioMappingReceiptValidationError('WorkObject is absent from the shipped catalog');
  }
  const originAssertion = raw.originAssertion;
  const repositoryRole = raw.repositoryRole;
  if (!['thoughtseed-origin', 'client-origin', 'linked-product-client-delivery', 'co-founded-venture'].includes(String(originAssertion))) {
    throw new PortfolioMappingReceiptValidationError('originAssertion is invalid');
  }
  if (!['product-source', 'client-branch-source', 'co-founded-venture-source'].includes(String(repositoryRole))) {
    throw new PortfolioMappingReceiptValidationError('repositoryRole is invalid');
  }
  if (workObjectKind === 'sapling' && (originAssertion !== 'thoughtseed-origin' || repositoryRole !== 'product-source')) {
    throw new PortfolioMappingReceiptValidationError('Sapling receipt provenance is inconsistent');
  }
  if (workObjectKind === 'branch' && (originAssertion === 'thoughtseed-origin' || repositoryRole === 'product-source')) {
    throw new PortfolioMappingReceiptValidationError('Client Branch receipt role is inconsistent');
  }
  if (!isRecord(raw.repository)) throw new PortfolioMappingReceiptValidationError('repository must be an object');
  exactFields(raw.repository, ['nameWithOwner', 'repositoryId', 'databaseId', 'isFork', 'defaultBranchRef', 'pushedAt'], 'repository');
  const nameWithOwner = text(raw.repository.nameWithOwner, 'repository.nameWithOwner', 200);
  const repositoryId = text(raw.repository.repositoryId, 'repository.repositoryId', 160);
  const defaultBranchRef = text(raw.repository.defaultBranchRef, 'repository.defaultBranchRef', 160);
  const pushedAt = text(raw.repository.pushedAt, 'repository.pushedAt', 40);
  if (!REPOSITORY_NAME.test(nameWithOwner) || !REPOSITORY_ID.test(repositoryId) || !SAFE_BRANCH.test(defaultBranchRef)) {
    throw new PortfolioMappingReceiptValidationError('repository identity is invalid');
  }
  if (!Number.isSafeInteger(raw.repository.databaseId) || Number(raw.repository.databaseId) <= 0) {
    throw new PortfolioMappingReceiptValidationError('repository.databaseId is invalid');
  }
  if (typeof raw.repository.isFork !== 'boolean' || !Number.isFinite(Date.parse(pushedAt))) {
    throw new PortfolioMappingReceiptValidationError('repository metadata is invalid');
  }
  const catalogDigest = text(raw.catalogDigest, 'catalogDigest', 71);
  const classificationDigest = text(raw.classificationDigest, 'classificationDigest', 64);
  const rootMapDigest = text(raw.rootMapDigest, 'rootMapDigest', 64);
  const repositoryEvidenceDigest = text(raw.repositoryEvidenceDigest, 'repositoryEvidenceDigest', 64);
  if (!SHA256_REF.test(catalogDigest) || catalogDigest !== PORTFOLIO_CATALOG_DIGEST) {
    throw new PortfolioMappingReceiptValidationError('catalogDigest does not match the shipped catalog');
  }
  if (!SHA256.test(classificationDigest) || classificationDigest !== PORTFOLIO_CLASSIFICATION_DIGEST) {
    throw new PortfolioMappingReceiptValidationError('classificationDigest does not match the reviewed source');
  }
  if (!SHA256.test(rootMapDigest) || rootMapDigest !== PORTFOLIO_ROOT_MAP_DIGEST) {
    throw new PortfolioMappingReceiptValidationError('rootMapDigest does not match the reviewed root map');
  }
  if (!SHA256.test(repositoryEvidenceDigest)) {
    throw new PortfolioMappingReceiptValidationError('repositoryEvidenceDigest is invalid');
  }
  return {
    schema: PORTFOLIO_MAPPING_RECEIPT_SCHEMA,
    portfolioId: 'thoughtseed',
    batchId,
    founderApprovalId,
    decision: 'map-reviewed-repository',
    workObjectId,
    workObjectKind: workObjectKind as MappingWorkObjectKind,
    originAssertion: originAssertion as MappingOriginAssertion,
    repositoryRole: repositoryRole as MappingRepositoryRole,
    repository: {
      nameWithOwner,
      repositoryId,
      databaseId: Number(raw.repository.databaseId),
      isFork: raw.repository.isFork,
      defaultBranchRef,
      pushedAt: new Date(pushedAt).toISOString(),
    },
    rootMap: validateRootMap(raw.rootMap, workObjectId),
    lifecycle: text(raw.lifecycle, 'lifecycle', 64),
    catalogDigest,
    classificationDigest,
    rootMapDigest,
    repositoryEvidenceDigest,
  };
}

export async function preparePortfolioMappingReceipt(raw: unknown): Promise<PortfolioMappingReceipt> {
  const input = validatePortfolioMappingReceiptInput(raw);
  const contentDigestHex = await sha256(canonicalMappingReceiptJson(input));
  const receiptId = `pmr_${contentDigestHex.slice(0, 24)}`;
  return {
    ...input,
    receiptKind: 'mapping',
    receiptId,
    contentDigest: `sha256:${contentDigestHex}`,
    idempotencyKey: `${input.portfolioId}:${input.batchId}:${input.workObjectId}:${input.repository.repositoryId}`,
    r2Key: `portfolio/thoughtseed/workobjects/${input.workObjectId}/mapping/${receiptId}.json`,
    status: 'prepared',
  };
}

export async function validatePortfolioMappingReceipt(raw: unknown): Promise<PortfolioMappingReceipt> {
  if (!isRecord(raw)) throw new PortfolioMappingReceiptValidationError('mapping receipt must be an object');
  exactFields(raw, [
    'schema', 'portfolioId', 'batchId', 'founderApprovalId', 'decision', 'workObjectId', 'workObjectKind',
    'originAssertion', 'repositoryRole', 'repository', 'rootMap', 'lifecycle', 'catalogDigest',
    'classificationDigest', 'rootMapDigest', 'repositoryEvidenceDigest', 'receiptKind', 'receiptId',
    'contentDigest', 'idempotencyKey', 'r2Key', 'status',
  ], 'mapping receipt');
  const {
    receiptKind: _receiptKind,
    receiptId: _receiptId,
    contentDigest: _contentDigest,
    idempotencyKey: _idempotencyKey,
    r2Key: _r2Key,
    status: _status,
    ...input
  } = raw;
  const expected = await preparePortfolioMappingReceipt(input);
  if (canonicalMappingReceiptJson(raw) !== canonicalMappingReceiptJson(expected)) {
    throw new PortfolioMappingReceiptValidationError('mapping receipt derivation is invalid');
  }
  return expected;
}

export function createPortfolioMappingReceiptStore(bucket: R2BucketLike): PortfolioMappingReceiptStoreLike {
  if (!bucket.put) throw new PortfolioMappingReceiptStorageError('mapping receipt R2 binding is not writable');
  return {
    async record(receipt) {
      const validated = await validatePortfolioMappingReceipt(receipt);
      const body = canonicalMappingReceiptJson(validated);
      const existing = await bucket.get(validated.r2Key);
      if (existing) {
        if (await existing.text() !== body) throw new PortfolioMappingReceiptConflictError('mapping receipt conflict');
        return { duplicate: true };
      }
      let stored;
      try {
        stored = await bucket.put!(validated.r2Key, TEXT.encode(body), {
          onlyIf: { etagDoesNotMatch: '*' },
          httpMetadata: { contentType: 'application/json' },
          customMetadata: { schema: PORTFOLIO_MAPPING_RECEIPT_SCHEMA, receiptId: validated.receiptId },
        });
      } catch {
        const winner = await bucket.get(validated.r2Key);
        if (!winner) throw new PortfolioMappingReceiptStorageError('mapping receipt R2 write failed');
        if (await winner.text() !== body) throw new PortfolioMappingReceiptConflictError('mapping receipt conflict');
        return { duplicate: true };
      }
      if (stored) return { duplicate: false };
      const winner = await bucket.get(validated.r2Key);
      if (!winner) throw new PortfolioMappingReceiptStorageError('mapping receipt R2 write was not confirmed');
      if (await winner.text() !== body) throw new PortfolioMappingReceiptConflictError('mapping receipt conflict');
      return { duplicate: true };
    },
  };
}
