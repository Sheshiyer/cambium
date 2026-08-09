import { createHash } from 'node:crypto';

import {
  RAW_CLASSIFICATION_REVIEW,
  RAW_HISTORICAL_PRODUCTS,
  RAW_OPERATIONAL_GAP_WORK_IDS,
  RAW_PROGRAMS,
  RAW_SAPLINGS,
} from './portfolio-catalog-data.ts';

export const PORTFOLIO_CLASSIFICATION_DIGEST = '18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542';

export const PORTFOLIO_CATALOG_DIGEST = 'sha256:448cd80278a7f8e1055c229a8cd4b692f56493f88e579814f30cfe5bbf12354e';
const CANONICAL_ID = /^(?:sapling|branch|program|historical-product|review):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORK_ID = /^(?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|file:\/\/)/;
const MAX_RECORDS = 96;
const MAX_HISTORICAL = 32;
const MAX_REVIEW = 32;
const MAX_GAPS = 64;

const FORBIDDEN_KEYS = new Set([
  'desiredState',
  'currentState',
  'ownerId',
  'nextAction',
  'blocker',
  'proofRequired',
  'reviewAt',
  'sourceDigest',
  'goalGraphRef',
  'goals',
  'missions',
  'tasks',
  'runs',
  'receipts',
  'assignments',
  'loadouts',
  'approvals',
  'tenantActivation',
  'rbac',
  'billing',
  'health',
  'readiness',
]);

export type PortfolioClassification = 'sapling' | 'client-branch' | 'internal-program';
export type PortfolioProgramKind = 'client' | 'company' | 'capability' | 'operations';
export type PortfolioLifecycle = 'proposed' | 'approved' | 'executing' | 'verifying' | 'complete' | 'retired';
export type PortfolioPromotionState = 'proof-only' | 'supervised-branch';
export type PortfolioTenantStatus =
  | 'canonical'
  | 'canonical-parent'
  | 'documented-not-runtime-verified'
  | 'not-applicable'
  | 'unresolved';
export type PortfolioViewerRole = 'founder' | 'operator' | 'viewer';

export interface PortfolioAlias {
  value: string;
  namespace: string;
  tenantAuthority: false;
}

export interface PortfolioTenantIdentity {
  status: PortfolioTenantStatus;
  tenantId: string | null;
}

export interface PortfolioCatalogRecord {
  canonicalId: string;
  workId: string;
  name: string;
  kind: 'sapling' | 'program';
  classification: PortfolioClassification;
  tenantIdentity: PortfolioTenantIdentity;
  parentTenant?: string;
  provenance: readonly string[];
  linkedCanonicalIds: readonly string[];
  aliases: readonly PortfolioAlias[];
  portfolioStatus?: 'active';
  promotionState?: PortfolioPromotionState;
  programKind?: PortfolioProgramKind;
  lifecycle?: PortfolioLifecycle;
  operationalOverlay?: 'paused';
  accountId?: string;
  commercialReuse?: 'white-labelable';
}

export interface PortfolioHistoricalProduct {
  canonicalId: string;
  name: string;
  status: 'archived' | 'completed' | 'paused' | 'white-labelable';
  linkedCanonicalId: string | null;
  provenance: readonly string[];
}

export interface PortfolioClassificationReview {
  canonicalId: string;
  source: string;
  needed: string;
}

export interface PortfolioOperationalGap {
  workId: string;
  gapKind: 'mission-data-needed';
  missingFields: readonly string[];
}

export interface PortfolioCatalogSummary {
  total: 74;
  saplings: 20;
  clientBranches: 39;
  internalPrograms: 15;
  classificationReview: 0;
  historicalProducts: 20;
  operationalGaps: 49;
}

export interface PortfolioCatalogV1 {
  schema: 'cambium.portfolio-catalog.v1';
  version: 1;
  status: 'proposed-read-only';
  readOnly: true;
  sourceSchema: 'thoughtseed.work-object-registry.v1';
  sourceGeneratedAt: '2026-07-29T06:46:00Z';
  classificationDigest: string;
  catalogDigest: string;
  authority: {
    classification: 'vault';
    operational: 'd1-goal-graph';
  };
  summary: PortfolioCatalogSummary;
  records: readonly PortfolioCatalogRecord[];
  historicalProducts: readonly PortfolioHistoricalProduct[];
  classificationReview: readonly PortfolioClassificationReview[];
  operationalGaps: readonly PortfolioOperationalGap[];
}

export interface PortfolioViewerProjection {
  summary: PortfolioCatalogSummary;
  detail: PortfolioCatalogV1 | null;
}

export interface PortfolioJoinMatch {
  canonicalId: string;
  runtimeWorkId: string;
}

export interface PortfolioRuntimeIdentityCollision {
  workId: string;
  occurrences: number;
}

export interface PortfolioJoinReport {
  matchedCount: number;
  catalogOrphanCount: number;
  runtimeOrphanCount: number;
  runtimeIdentityCollisionCount: number;
  matches: readonly PortfolioJoinMatch[];
  catalogOrphans: readonly string[];
  runtimeOrphans: readonly string[];
  runtimeIdentityCollisions: readonly PortfolioRuntimeIdentityCollision[];
}

export class PortfolioCatalogValidationError extends Error {
  constructor(message: string) {
    super(`portfolio catalog validation failed: ${message}`);
    this.name = 'PortfolioCatalogValidationError';
  }
}

const MISSING_MISSION_FIELDS = Object.freeze([
  'desiredState',
  'currentState',
  'ownerId',
  'nextAction',
  'blocker',
  'proofRequired',
  'reviewAt',
  'sourceDigest',
  'goalGraphRef',
] as const);

const SUMMARY: PortfolioCatalogSummary = Object.freeze({
  total: 74,
  saplings: 20,
  clientBranches: 39,
  internalPrograms: 15,
  classificationReview: 0,
  historicalProducts: 20,
  operationalGaps: 49,
});

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function materializeRecords(): PortfolioCatalogRecord[] {
  const saplings: PortfolioCatalogRecord[] = RAW_SAPLINGS.map((row) => {
    const [workId, name, promotionState, tenantStatus, tenantId, provenance, linkedWorkIds = [], aliases = [], commercialReuse] = row;
    return compact({
      canonicalId: workId,
      workId,
      name,
      kind: 'sapling' as const,
      classification: 'sapling' as const,
      portfolioStatus: 'active' as const,
      promotionState,
      tenantIdentity: { status: tenantStatus, tenantId },
      parentTenant: tenantId ?? undefined,
      provenance: [...provenance],
      linkedCanonicalIds: [...linkedWorkIds],
      aliases: aliases.map(([value, namespace]) => ({ value, namespace, tenantAuthority: false as const })),
      commercialReuse,
    });
  });
  const programs: PortfolioCatalogRecord[] = RAW_PROGRAMS.map((row) => {
    const [workId, name, programKind, lifecycle, tenantStatus, tenantId, provenance, accountId, linkedWorkIds = [], overlay, commercialReuse] = row;
    return compact({
      canonicalId: workId,
      workId,
      name,
      kind: 'program' as const,
      classification: programKind === 'client' ? 'client-branch' as const : 'internal-program' as const,
      programKind,
      lifecycle,
      tenantIdentity: { status: tenantStatus, tenantId },
      parentTenant: tenantId ?? undefined,
      provenance: [...provenance],
      linkedCanonicalIds: [...linkedWorkIds],
      aliases: [],
      accountId,
      operationalOverlay: overlay,
      commercialReuse,
    });
  });
  return [...saplings, ...programs].sort((a, b) => a.workId.localeCompare(b.workId));
}

function catalogHashPayload(catalog: Omit<PortfolioCatalogV1, 'catalogDigest'> | PortfolioCatalogV1): Record<string, unknown> {
  const { catalogDigest: _catalogDigest, ...payload } = catalog as PortfolioCatalogV1;
  return payload;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function buildCatalog(): PortfolioCatalogV1 {
  const withoutDigest: Omit<PortfolioCatalogV1, 'catalogDigest'> = {
    schema: 'cambium.portfolio-catalog.v1',
    version: 1,
    status: 'proposed-read-only',
    readOnly: true,
    sourceSchema: 'thoughtseed.work-object-registry.v1',
    sourceGeneratedAt: '2026-07-29T06:46:00Z',
    classificationDigest: PORTFOLIO_CLASSIFICATION_DIGEST,
    authority: {
      classification: 'vault',
      operational: 'd1-goal-graph',
    },
    summary: SUMMARY,
    records: materializeRecords(),
    historicalProducts: RAW_HISTORICAL_PRODUCTS.map(([canonicalId, name, status, linkedCanonicalId, source]) => ({
      canonicalId,
      name,
      status,
      linkedCanonicalId,
      provenance: [source],
    })),
    classificationReview: RAW_CLASSIFICATION_REVIEW.map(([canonicalId, source, needed]) => ({
      canonicalId,
      source,
      needed,
    })),
    operationalGaps: RAW_OPERATIONAL_GAP_WORK_IDS.map((workId) => ({
      workId,
      gapKind: 'mission-data-needed',
      missingFields: MISSING_MISSION_FIELDS,
    })),
  };
  return {
    ...withoutDigest,
    catalogDigest: sha256(withoutDigest),
  };
}

function fail(message: string): never {
  throw new PortfolioCatalogValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rejectForbiddenMaterial(value: unknown, path = 'catalog'): void {
  if (typeof value === 'string' && ABSOLUTE_PATH.test(value)) fail(`${path} contains an absolute path`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbiddenMaterial(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`${path}.${key} is a live operational field`);
    rejectForbiddenMaterial(entry, `${path}.${key}`);
  }
}

function expectEnum(value: unknown, allowed: readonly string[], field: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(`${field} has an invalid enum value`);
}

function validateRecord(record: PortfolioCatalogRecord, index: number): void {
  const field = `records[${index}]`;
  if (!isRecord(record)) fail(`${field} is not an object`);
  if (record.canonicalId !== record.workId || !WORK_ID.test(record.workId)) fail(`${field}.workId is not canonical`);
  if (typeof record.name !== 'string' || !record.name || record.name.length > 160) fail(`${field}.name is invalid`);
  expectEnum(record.kind, ['sapling', 'program'], `${field}.kind`);
  expectEnum(record.classification, ['sapling', 'client-branch', 'internal-program'], `${field}.classification`);
  expectEnum(record.tenantIdentity?.status, ['canonical', 'canonical-parent', 'documented-not-runtime-verified', 'not-applicable', 'unresolved'], `${field}.tenantIdentity.status`);
  const tenantId = record.tenantIdentity?.tenantId;
  if (record.tenantIdentity.status === 'canonical' || record.tenantIdentity.status === 'canonical-parent') {
    if (typeof tenantId !== 'string' || !tenantId) fail(`${field}.tenantIdentity.tenantId is required`);
  } else if (tenantId !== null) {
    fail(`${field}.tenantIdentity.tenantId must be null`);
  }
  if (record.parentTenant !== undefined && record.parentTenant !== tenantId) fail(`${field}.parentTenant drifted`);
  if (record.operationalOverlay !== undefined) expectEnum(record.operationalOverlay, ['paused'], `${field}.operationalOverlay`);
  if (record.commercialReuse !== undefined) expectEnum(record.commercialReuse, ['white-labelable'], `${field}.commercialReuse`);
  if (record.kind === 'sapling') {
    if (record.classification !== 'sapling' || !record.workId.startsWith('sapling:')) fail(`${field} has mismatched Sapling identity`);
    if (record.portfolioStatus !== 'active') fail(`${field}.portfolioStatus has an invalid enum value`);
    expectEnum(record.promotionState, ['proof-only', 'supervised-branch'], `${field}.promotionState`);
    if (record.programKind !== undefined || record.lifecycle !== undefined) fail(`${field} mixes Sapling and Program fields`);
  } else {
    expectEnum(record.programKind, ['client', 'company', 'capability', 'operations'], `${field}.programKind`);
    expectEnum(record.lifecycle, ['proposed', 'approved', 'executing', 'verifying', 'complete', 'retired'], `${field}.lifecycle`);
    const expectedClassification = record.programKind === 'client' ? 'client-branch' : 'internal-program';
    const expectedPrefix = record.programKind === 'client' ? 'branch:' : 'program:';
    if (record.classification !== expectedClassification || !record.workId.startsWith(expectedPrefix)) fail(`${field} has mismatched Program identity`);
    if (record.promotionState !== undefined) fail(`${field} mixes Program and Sapling fields`);
  }
  if (!Array.isArray(record.provenance)
    || record.provenance.length < 1
    || record.provenance.length > 8
    || record.provenance.some((source) => typeof source !== 'string' || !source || source.length > 240)) fail(`${field}.provenance is invalid`);
  if (!Array.isArray(record.linkedCanonicalIds) || record.linkedCanonicalIds.some((id) => typeof id !== 'string' || !CANONICAL_ID.test(id))) fail(`${field}.linkedCanonicalIds is invalid`);
  if (!Array.isArray(record.aliases) || record.aliases.some((alias) => (
    !isRecord(alias)
    || typeof alias.value !== 'string'
    || !alias.value
    || typeof alias.namespace !== 'string'
    || !alias.namespace
    || alias.tenantAuthority !== false
  ))) fail(`${field}.aliases is invalid`);
  if (record.workId === 'sapling:fitcheck') {
    if (record.parentTenant !== 'cambium' || record.tenantIdentity.tenantId !== 'cambium') fail('Fitcheck parent tenant drifted');
    const aliasValues = record.aliases.map((alias) => alias.value).sort();
    if (canonicalJson(aliasValues) !== canonicalJson(['FitCheck', 'getfitcheck'])) fail('Fitcheck aliases drifted');
  }
}

export function validatePortfolioCatalog(catalog: unknown): asserts catalog is PortfolioCatalogV1 {
  if (!isRecord(catalog)) fail('catalog is not an object');
  if (catalog.schema !== 'cambium.portfolio-catalog.v1' || catalog.version !== 1) fail('schema or version drifted');
  if (catalog.status !== 'proposed-read-only' || catalog.readOnly !== true) fail('catalog is not proposed read-only');
  if (catalog.sourceSchema !== 'thoughtseed.work-object-registry.v1') fail('source schema drifted');
  if (catalog.sourceGeneratedAt !== '2026-07-29T06:46:00Z') fail('source generation time drifted');
  if (catalog.classificationDigest !== PORTFOLIO_CLASSIFICATION_DIGEST) fail('classification digest drifted');
  if (!isRecord(catalog.authority)
    || catalog.authority.classification !== 'vault'
    || catalog.authority.operational !== 'd1-goal-graph') fail('authority drifted');
  if (!SHA256.test(String(catalog.catalogDigest ?? ''))) fail('catalog digest is malformed');
  rejectForbiddenMaterial(catalog);

  const records = catalog.records;
  const historicalProducts = catalog.historicalProducts;
  const classificationReview = catalog.classificationReview;
  const operationalGaps = catalog.operationalGaps;
  if (!Array.isArray(records) || records.length !== 74 || records.length > MAX_RECORDS) fail('record count drifted');
  if (!Array.isArray(historicalProducts) || historicalProducts.length !== 20 || historicalProducts.length > MAX_HISTORICAL) fail('historical count drifted');
  if (!Array.isArray(classificationReview) || classificationReview.length !== 0 || classificationReview.length > MAX_REVIEW) fail('classification review count drifted');
  if (!Array.isArray(operationalGaps) || operationalGaps.length !== 49 || operationalGaps.length > MAX_GAPS) fail('operational gap count drifted');

  records.forEach((record, index) => validateRecord(record as PortfolioCatalogRecord, index));
  const ids = records.map((record) => (record as PortfolioCatalogRecord).workId);
  if (new Set(ids).size !== ids.length) fail('duplicate WorkObject identity');
  const saplings = records.filter((record) => (record as PortfolioCatalogRecord).classification === 'sapling').length;
  const clients = records.filter((record) => (record as PortfolioCatalogRecord).classification === 'client-branch').length;
  const programs = records.filter((record) => (record as PortfolioCatalogRecord).classification === 'internal-program').length;
  if (saplings !== 20 || clients !== 39 || programs !== 15) fail('classification counts drifted');

  const historicalIds = new Set<string>();
  for (const [index, value] of historicalProducts.entries()) {
    if (!isRecord(value)
      || typeof value.canonicalId !== 'string'
      || !/^historical-product:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.canonicalId)
      || historicalIds.has(value.canonicalId)
      || typeof value.name !== 'string'
      || !value.name
      || !['archived', 'completed', 'paused', 'white-labelable'].includes(String(value.status))
      || (value.linkedCanonicalId !== null && (typeof value.linkedCanonicalId !== 'string' || !WORK_ID.test(value.linkedCanonicalId)))
      || !Array.isArray(value.provenance)
      || value.provenance.length !== 1) fail(`historicalProducts[${index}] is invalid`);
    historicalIds.add(value.canonicalId);
  }
  const reviewIds = new Set<string>();
  for (const [index, value] of classificationReview.entries()) {
    if (!isRecord(value)
      || typeof value.canonicalId !== 'string'
      || !/^review:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.canonicalId)
      || reviewIds.has(value.canonicalId)
      || typeof value.source !== 'string'
      || !value.source
      || typeof value.needed !== 'string'
      || !value.needed) fail(`classificationReview[${index}] is invalid`);
    reviewIds.add(value.canonicalId);
  }
  const gapIds = new Set<string>();
  for (const [index, value] of operationalGaps.entries()) {
    if (!isRecord(value)
      || typeof value.workId !== 'string'
      || !WORK_ID.test(value.workId)
      || !ids.includes(value.workId)
      || gapIds.has(value.workId)
      || value.gapKind !== 'mission-data-needed'
      || !Array.isArray(value.missingFields)
      || canonicalJson(value.missingFields) !== canonicalJson(MISSING_MISSION_FIELDS)) fail(`operationalGaps[${index}] is invalid`);
    gapIds.add(value.workId);
  }

  const summary = catalog.summary;
  if (!isRecord(summary)
    || summary.total !== 74
    || summary.saplings !== 20
    || summary.clientBranches !== 39
    || summary.internalPrograms !== 15
    || summary.classificationReview !== 0
    || summary.historicalProducts !== 20
    || summary.operationalGaps !== 49) fail('summary drifted');

  const actualDigest = sha256(catalogHashPayload(catalog as unknown as PortfolioCatalogV1));
  if (actualDigest !== catalog.catalogDigest) fail('catalog digest does not match canonical content');
  if (actualDigest !== PORTFOLIO_CATALOG_DIGEST) {
    fail(`checked-in catalog digest drifted: expected ${PORTFOLIO_CATALOG_DIGEST}, received ${actualDigest}`);
  }
}

const BUILT_CATALOG = buildCatalog();
validatePortfolioCatalog(BUILT_CATALOG);
export const PORTFOLIO_CATALOG: PortfolioCatalogV1 = deepFreeze(BUILT_CATALOG);

export function portfolioCatalogForViewer(
  catalog: PortfolioCatalogV1,
  role: PortfolioViewerRole | string,
): PortfolioViewerProjection {
  validatePortfolioCatalog(catalog);
  return {
    summary: catalog.summary,
    detail: role === 'founder' ? catalog : null,
  };
}

function runtimeWorkIdFrom(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const candidate = value.kind === 'work' && isRecord(value.value) ? value.value : value;
  if (!isRecord(candidate) || typeof candidate.workId !== 'string') return null;
  const workId = candidate.workId.trim();
  return /^[A-Za-z0-9_.:-]{1,160}$/.test(workId) ? workId : null;
}

function canonicalRuntimeIdentity(value: unknown): { canonicalId: string; runtimeWorkId: string } | null {
  if (!isRecord(value)) return null;
  const candidate = value.kind === 'work' && isRecord(value.value) ? value.value : value;
  if (!isRecord(candidate)) return null;
  const runtimeWorkId = runtimeWorkIdFrom(value);
  if (runtimeWorkId === null) return null;
  const slug = '[a-z0-9]+(?:-[a-z0-9]+)*';
  if (candidate.kind === 'sapling') {
    if (new RegExp(`^sapling:${slug}$`).test(runtimeWorkId)) return { canonicalId: runtimeWorkId, runtimeWorkId };
    return null;
  }
  if (candidate.kind !== 'program') return null;
  const prefix = candidate.programKind === 'client' ? 'branch' : (
    candidate.programKind === 'company' || candidate.programKind === 'capability' || candidate.programKind === 'operations'
      ? 'program'
      : null
  );
  if (!prefix) return null;
  if (new RegExp(`^${prefix}:${slug}$`).test(runtimeWorkId)) return { canonicalId: runtimeWorkId, runtimeWorkId };
  return null;
}

export function buildPortfolioJoinReport(
  catalog: PortfolioCatalogV1,
  runtimeWorkNodes: readonly unknown[],
  tenantId = 'cambium',
): PortfolioJoinReport {
  validatePortfolioCatalog(catalog);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId)) throw new TypeError('tenantId must be a canonical tenant slug');
  const catalogIds = new Set(catalog.records.map((record) => record.workId));
  const joinEligibleIds = new Set(
    catalog.records
      .filter((record) => (
        record.tenantIdentity.status === 'not-applicable'
        || (
          (record.tenantIdentity.status === 'canonical' || record.tenantIdentity.status === 'canonical-parent')
          && record.tenantIdentity.tenantId === tenantId
        )
      ))
      .map((record) => record.workId),
  );
  const runtimeIdentities = new Map<string, { runtimeWorkId: string; occurrences: number }>();
  const rejectedRuntimeIds = new Set<string>();
  for (const node of Array.isArray(runtimeWorkNodes) ? runtimeWorkNodes : []) {
    const identity = canonicalRuntimeIdentity(node);
    if (!identity) {
      const rejected = runtimeWorkIdFrom(node);
      if (rejected !== null) rejectedRuntimeIds.add(rejected);
      continue;
    }
    const existing = runtimeIdentities.get(identity.canonicalId);
    runtimeIdentities.set(identity.canonicalId, {
      runtimeWorkId: identity.runtimeWorkId,
      occurrences: (existing?.occurrences ?? 0) + 1,
    });
  }
  const runtimeIdentityCollisions = [...runtimeIdentities.entries()]
    .filter(([, identity]) => identity.occurrences > 1)
    .map(([workId, identity]) => ({ workId, occurrences: identity.occurrences }))
    .sort((a, b) => a.workId.localeCompare(b.workId));
  const collisionIds = new Set(runtimeIdentityCollisions.map((collision) => collision.workId));
  const matches = [...runtimeIdentities.entries()]
    .filter(([canonicalId]) => joinEligibleIds.has(canonicalId) && !collisionIds.has(canonicalId))
    .map(([canonicalId, identity]) => ({ canonicalId, runtimeWorkId: identity.runtimeWorkId }))
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  const matchedIds = new Set(matches.map((match) => match.canonicalId));
  const catalogOrphans = [...catalogIds].filter((id) => !matchedIds.has(id)).sort();
  const runtimeOrphans = [...new Set([
    ...rejectedRuntimeIds,
    ...[...runtimeIdentities.keys()].filter((id) => !joinEligibleIds.has(id) || collisionIds.has(id)),
  ])].sort();
  return deepFreeze({
    matchedCount: matches.length,
    catalogOrphanCount: catalogOrphans.length,
    runtimeOrphanCount: runtimeOrphans.length,
    runtimeIdentityCollisionCount: runtimeIdentityCollisions.length,
    matches,
    catalogOrphans,
    runtimeOrphans,
    runtimeIdentityCollisions,
  });
}

export function portfolioPairDigest(graphDigest: string, catalogDigest: string): string {
  if (typeof graphDigest !== 'string' || !SHA256.test(graphDigest)) throw new TypeError('graphDigest must be sha256:<hex>');
  if (typeof catalogDigest !== 'string' || !SHA256.test(catalogDigest)) throw new TypeError('catalogDigest must be sha256:<hex>');
  return sha256({ graphDigest, catalogDigest });
}
