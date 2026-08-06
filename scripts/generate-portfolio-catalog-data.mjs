#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function trimTrailing(fixedFields, optionalValues) {
  let lastDefinedIndex = -1;
  optionalValues.forEach((value, index) => {
    if (value !== undefined) lastDefinedIndex = index;
  });
  return [...fixedFields, ...optionalValues.slice(0, lastDefinedIndex + 1)];
}

const SAPLING_TENANT_STATUSES = new Set(['canonical', 'canonical-parent', 'unresolved']);
const PROGRAM_TENANT_STATUSES = new Set(['canonical', 'documented-not-runtime-verified', 'not-applicable', 'unresolved']);
const PROGRAM_KINDS = new Set(['client', 'company', 'capability', 'operations']);

function requireSourceRefs(w) {
  if (!Array.isArray(w.sourceRefs) || w.sourceRefs.length === 0) {
    throw new Error(`${w.workId}: missing or empty sourceRefs`);
  }
  return [...w.sourceRefs];
}

function requireTenantIdentity(w, allowedStatuses) {
  const identity = w.tenantIdentity;
  if (!identity || typeof identity.status !== 'string') {
    throw new Error(`${w.workId}: missing tenantIdentity`);
  }
  if (!allowedStatuses.has(identity.status)) {
    throw new Error(`${w.workId}: tenantIdentity.status "${identity.status}" is not a recognized value`);
  }
  return identity;
}

function transformSapling(w) {
  const identity = requireTenantIdentity(w, SAPLING_TENANT_STATUSES);
  const sourceRefs = requireSourceRefs(w);
  const fixed = [w.workId, w.name, w.promotionState, identity.status, identity.tenantId, sourceRefs];
  const linkedWorkIds = w.linkedWorkIds && w.linkedWorkIds.length ? [...w.linkedWorkIds] : undefined;
  const aliases = w.identityAliases && w.identityAliases.length
    ? w.identityAliases.map((a) => [a.value, a.namespace])
    : undefined;
  const commercialReuse = w.commercialReuse;
  return trimTrailing(fixed, [linkedWorkIds, aliases, commercialReuse]);
}

function transformProgram(w) {
  if (!PROGRAM_KINDS.has(w.programKind)) {
    throw new Error(`${w.workId}: programKind "${w.programKind}" is not a recognized value`);
  }
  const identity = requireTenantIdentity(w, PROGRAM_TENANT_STATUSES);
  const sourceRefs = requireSourceRefs(w);
  const fixed = [w.workId, w.name, w.programKind, w.lifecycle, identity.status, identity.tenantId, sourceRefs];
  const accountId = w.accountId;
  const linkedWorkIds = w.linkedWorkIds && w.linkedWorkIds.length ? [...w.linkedWorkIds] : undefined;
  const overlay = w.operationalStatus === 'paused' ? 'paused' : undefined;
  const commercialReuse = w.commercialReuse;
  return trimTrailing(fixed, [accountId, linkedWorkIds, overlay, commercialReuse]);
}

export function transformRegistryToRawData(registry) {
  const saplings = [];
  const programs = [];
  for (const w of registry.workObjects) {
    if (w.kind === 'sapling') saplings.push(transformSapling(w));
    else programs.push(transformProgram(w));
  }
  const historicalProducts = registry.historicalProductSurfaces.map((h) => [
    h.id,
    h.name,
    h.status,
    h.linkedWorkId ?? null,
    h.sourceRef,
  ]);
  // unresolvedCandidates is empty as of this generator's authoring (the
  // registry's classification backlog was fully resolved before this piece
  // was built) — this mapping is inferred from the last non-empty snapshot
  // of RAW_CLASSIFICATION_REVIEW and has no live example to verify against.
  const classificationReview = registry.unresolvedCandidates.map((c) => [
    c.workId ?? `review:${String(c.name ?? c.path).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    c.name ?? c.path,
    c.needed ?? c.reason,
  ]);
  const operationalGapWorkIds = registry.operationalGaps.map((g) => g.workId);
  return { saplings, programs, historicalProducts, classificationReview, operationalGapWorkIds };
}

function formatValue(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`;
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return JSON.stringify(v);
}

function formatTuple(tuple) {
  return `[${tuple.map(formatValue).join(', ')}]`;
}

function formatArrayOfTuples(name, typeAnnotation, tuples, asConst) {
  const decl = typeAnnotation ? `export const ${name}: ${typeAnnotation} = ` : `export const ${name} = `;
  const suffix = asConst ? ' as const;' : ';';
  if (tuples.length === 0) return `${decl}[]${suffix}`;
  const lines = tuples.map((t) => `  ${formatTuple(t)},`);
  return `${decl}[\n${lines.join('\n')}\n]${suffix}`;
}

// RAW_HISTORICAL_PRODUCTS and RAW_CLASSIFICATION_REVIEW must carry an
// explicit array type rather than relying on `as const` inference from
// their contents: when the array is empty (as RAW_CLASSIFICATION_REVIEW
// is today, since the registry's unresolvedCandidates backlog is fully
// resolved), `[] as const` infers the literal empty-tuple type `readonly
// []`, and `.map(([a, b, c]) => ...)` over that produces `never` for the
// callback parameter — a real `tsc` error (TS2488) that `node --test`
// never catches, since it strips types without type-checking.

export function formatRawDataModule(raw, headerLines) {
  const parts = [
    ...headerLines,
    '',
    "export type RawAlias = readonly [value: string, namespace: string];",
    "export type RawSapling = readonly [",
    "  workId: string,",
    "  name: string,",
    "  promotionState: 'proof-only' | 'supervised-branch',",
    "  tenantStatus: 'canonical' | 'canonical-parent' | 'unresolved',",
    "  tenantId: string | null,",
    "  provenance: readonly string[],",
    "  linkedWorkIds?: readonly string[],",
    "  aliases?: readonly RawAlias[],",
    "  commercialReuse?: 'white-labelable',",
    "];",
    "export type RawProgram = readonly [",
    "  workId: string,",
    "  name: string,",
    "  programKind: 'client' | 'company' | 'capability' | 'operations',",
    "  lifecycle: 'proposed' | 'approved' | 'executing' | 'verifying' | 'complete' | 'retired',",
    "  tenantStatus: 'canonical' | 'documented-not-runtime-verified' | 'not-applicable' | 'unresolved',",
    "  tenantId: string | null,",
    "  provenance: readonly string[],",
    "  accountId?: string,",
    "  linkedWorkIds?: readonly string[],",
    "  overlay?: 'paused',",
    "  commercialReuse?: 'white-labelable',",
    "];",
    "export type RawHistoricalProduct = readonly [",
    "  canonicalId: string,",
    "  name: string,",
    "  status: 'archived' | 'completed' | 'white-labelable' | 'paused',",
    "  linkedCanonicalId: string | null,",
    "  source: string,",
    "];",
    "export type RawClassificationReview = readonly [",
    "  canonicalId: string,",
    "  source: string,",
    "  needed: string,",
    "];",
    "",
    formatArrayOfTuples('RAW_SAPLINGS', 'readonly RawSapling[]', raw.saplings, false),
    "",
    formatArrayOfTuples('RAW_PROGRAMS', 'readonly RawProgram[]', raw.programs, false),
    "",
    formatArrayOfTuples('RAW_HISTORICAL_PRODUCTS', 'readonly RawHistoricalProduct[]', raw.historicalProducts, false),
    "",
    formatArrayOfTuples('RAW_CLASSIFICATION_REVIEW', 'readonly RawClassificationReview[]', raw.classificationReview, false),
    "",
    `export const RAW_OPERATIONAL_GAP_WORK_IDS = [\n${raw.operationalGapWorkIds.map((id) => `  '${id}',`).join('\n')}\n] as const;`,
    "",
  ];
  return parts.join('\n');
}

function main() {
  const registryPath = process.argv[2];
  if (!registryPath) {
    console.error('Usage: node scripts/generate-portfolio-catalog-data.mjs <path-to-work-object-registry.v1.json>');
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const raw = transformRegistryToRawData(registry);

  const workersHeader = [
    '// Normalized, deployment-safe projection of',
    '// thoughtseed-labs/00-meta/work-object-registry.v1.json.',
    '// Source inventory paths and operational payloads are intentionally omitted.',
  ];
  const appsHeader = [
    '// Standalone snapshot for the proposal-only Portfolio Cartographer.',
    '// Copied byte-for-byte from workers/quests/src/portfolio-catalog-data.ts',
    `// regenerated by scripts/generate-portfolio-catalog-data.mjs; domain.ts binds it to the verified semantic digest.`,
    '//',
    ...workersHeader,
  ];

  const workersOut = formatRawDataModule(raw, workersHeader);
  const appsOut = formatRawDataModule(raw, appsHeader);

  writeFileSync(new URL('../workers/quests/src/portfolio-catalog-data.ts', import.meta.url), workersOut);
  writeFileSync(new URL('../apps/portfolio-cartographer/src/portfolio-catalog-data.ts', import.meta.url), appsOut);

  const saplingCount = raw.saplings.length;
  const programCount = raw.programs.length;
  const clientCount = raw.programs.filter((p) => p[2] === 'client').length;
  const internalCount = programCount - clientCount;

  console.log(JSON.stringify({
    total: saplingCount + programCount,
    saplings: saplingCount,
    clientBranches: clientCount,
    internalPrograms: internalCount,
    classificationReview: raw.classificationReview.length,
    historicalProducts: raw.historicalProducts.length,
    operationalGaps: raw.operationalGapWorkIds.length,
    classificationDigestValue: registry.classificationDigest?.value,
  }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
