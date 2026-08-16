import type { OperationalPacketProjection } from '../../../../../shared/operational-packet-projection.ts';
import type { MissionFabricProjectionV1 } from '../../mission-fabric.ts';

export type PortfolioZone = 'saplings' | 'clients' | 'programs' | 'review' | 'historical';
export type PortfolioSceneContext = 'mission' | 'flow' | 'workforce' | 'forge' | 'inspect' | 'gate';

export const PORTFOLIO_LIFECYCLE_TEMPLATES = {
  saplings: 'Idea → Proposal → Evidence → Proof only → Supervised branch → Autonomous branch → Product review → outcome',
  clients: 'Lead → Qualified outcome → Scope/proposal → Approval → Kickoff → Delivery → Acceptance → Handoff → close/renew/expand',
  programs: 'Proposed → Approved → Executing → Verifying → Complete/Retired',
} as const;

export const PORTFOLIO_ZONE_PREVIEW_LIMIT = 2;
const PORTFOLIO_RECORD_LIMIT = 160;
const SECRET_MARKER = /query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;
const CANONICAL_PORTFOLIO_ID = /^(?:sapling|branch|program|review|historical-product):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANONICAL_RUNTIME_WORK_ID = /^(?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PORTFOLIO_SOURCE_DIGEST = /^[0-9a-f]{64}$/;

export interface PortfolioCounts {
  saplings: number;
  clients: number;
  programs: number;
  review: number;
  historical: number;
}

export interface PortfolioRecord {
  canonicalId: string;
  name: string;
  zone: PortfolioZone;
  classification: string;
  canonical: boolean;
  runtimeWorkId: string | null;
  aliases: string[];
  linkedCanonicalIds: string[];
  parentTenant: string | null;
  paused: boolean;
  sourceRegistry: string | null;
  sourceDigest: string | null;
  provenance: string[];
}

export interface NormalizedPortfolioPayload {
  mode: 'none' | 'detail' | 'aggregate-only';
  counts: PortfolioCounts;
  records: PortfolioRecord[];
}

export interface PortfolioPayloadInput {
  portfolioCatalog?: unknown;
  portfolioCatalogSummary?: unknown;
  portfolioJoinReport?: unknown;
}

export interface PortfolioPromotionProposal {
  kind: 'promote-portfolio';
  subject: string;
  evidence: string;
  consequence: string;
  reversibility: string;
  idempotencyKey: string;
  note: string;
}

type UnknownRecord = Record<string, unknown>;

const EMPTY_COUNTS: PortfolioCounts = {
  saplings: 0,
  clients: 0,
  programs: 0,
  review: 0,
  historical: 0,
};

const ZONE_PREFIX: Record<PortfolioZone, string> = {
  saplings: 'sapling:',
  clients: 'branch:',
  programs: 'program:',
  review: 'review:',
  historical: 'historical-product:',
};

function objectValue(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function safeString(value: unknown, fallback: string, max = 120): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0 || SECRET_MARKER.test(text)) return fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeOptionalString(value: unknown, max = 120): string | null {
  const text = safeString(value, '', max);
  return text.length > 0 ? text : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function finiteCount(value: unknown): number | null {
  if (Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 100_000) {
    return Number(value);
  }
  const row = objectValue(value);
  if (!row) return null;
  for (const key of ['count', 'total', 'classified']) {
    const nested = finiteCount(row[key]);
    if (nested !== null) return nested;
  }
  return null;
}

function firstCount(sources: UnknownRecord[], keys: string[]): number | null {
  for (const source of sources) {
    for (const key of keys) {
      const count = finiteCount(source[key]);
      if (count !== null) return count;
    }
  }
  return null;
}

function classificationValue(record: UnknownRecord): unknown {
  const classification = record.classification;
  const classificationObject = objectValue(classification);
  return classificationObject?.zone
    ?? classificationObject?.kind
    ?? classificationObject?.type
    ?? classification
    ?? record.workObjectType
    ?? record.recordType
    ?? record.kind
    ?? record.type;
}

function zoneFor(value: unknown, forcedZone?: PortfolioZone): PortfolioZone | null {
  if (forcedZone) return forcedZone;
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_\s]+/g, '-')
    : '';
  if (normalized === 'sapling' || normalized === 'saplings') return 'saplings';
  if (
    normalized === 'client' ||
    normalized === 'clients' ||
    normalized === 'branch' ||
    normalized === 'client-branch' ||
    normalized === 'client-program'
  ) return 'clients';
  if (
    normalized === 'program' ||
    normalized === 'programs' ||
    normalized === 'internal-program' ||
    normalized === 'capability-program'
  ) return 'programs';
  if (
    normalized === 'review' ||
    normalized === 'classification-review' ||
    normalized === 'unclassified'
  ) return 'review';
  if (
    normalized === 'historical' ||
    normalized === 'historical-product' ||
    normalized === 'historical-surface' ||
    normalized === 'product'
  ) return 'historical';
  return null;
}

function classificationLabel(zone: PortfolioZone): string {
  switch (zone) {
    case 'saplings': return 'Sapling';
    case 'clients': return 'Branch · Client';
    case 'programs': return 'Internal Program';
    case 'review': return 'Classification Review';
    case 'historical': return 'Historical Product';
  }
}

function stringList(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const safe = safeOptionalString(item, 64);
    if (safe === null || seen.has(safe)) continue;
    seen.add(safe);
    result.push(safe);
    if (result.length >= maxItems) break;
  }
  return result;
}

function aliasList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const aliases: string[] = [];
  for (const entry of value) {
    const row = objectValue(entry);
    const candidate = row
      ? (row.tenantAuthority === false ? row.value : null)
      : entry;
    const alias = safeOptionalString(candidate, 64);
    if (alias !== null && !aliases.includes(alias)) aliases.push(alias);
    if (aliases.length >= 12) break;
  }
  return aliases;
}

function provenanceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const entry of value) {
    const safe = safeOptionalString(entry, 120);
    if (
      safe === null ||
      /^(?:\/|[A-Za-z]:[\\/]|file:\/\/)/.test(safe) ||
      result.includes(safe)
    ) continue;
    result.push(safe);
    if (result.length >= 8) break;
  }
  return result;
}

function normalizeRecord(
  value: unknown,
  forcedZone?: PortfolioZone,
  rootClassificationDigest: string | null = null,
): PortfolioRecord | null {
  const row = objectValue(value);
  if (!row) return null;
  const zone = zoneFor(classificationValue(row), forcedZone);
  if (!zone) return null;
  const canonicalId = safeString(
    row.canonicalId ?? row.workId ?? row.portfolioId ?? row.id,
    `unmapped:${zone}`,
    64,
  );
  const canonical = CANONICAL_PORTFOLIO_ID.test(canonicalId) && canonicalId.startsWith(ZONE_PREFIX[zone]);
  const aliases = aliasList(row.aliases ?? row.displayAliases);
  if (canonicalId === 'sapling:fitcheck') {
    for (const alias of ['FitCheck', 'getfitcheck']) {
      if (!aliases.includes(alias)) aliases.push(alias);
    }
  }
  const source = objectValue(row.source);
  const tenantIdentity = objectValue(row.tenantIdentity);
  const provenance = provenanceList(row.provenance);
  const linkedValue = row.linkedCanonicalIds
    ?? row.linkedWorkIds
    ?? row.links
    ?? (typeof row.linkedCanonicalId === 'string' ? [row.linkedCanonicalId] : []);
  return {
    canonicalId,
    name: safeString(row.displayName ?? row.name ?? row.title ?? row.source, canonicalId),
    zone,
    classification: classificationLabel(zone),
    canonical,
    runtimeWorkId: null,
    aliases,
    linkedCanonicalIds: stringList(linkedValue, 16),
    parentTenant: canonicalId === 'sapling:fitcheck'
      ? 'cambium'
      : safeOptionalString(
          row.parentTenant ?? tenantIdentity?.parentTenant ?? tenantIdentity?.tenantId ?? row.tenantId,
          64,
        ),
    paused: row.paused === true ||
      row.operationalOverlay === 'paused' ||
      row.lifecycleOverlay === 'paused' ||
      row.overlay === 'paused',
    sourceRegistry: safeOptionalString(
      source?.registry ?? source?.source ?? row.sourceRegistry ?? row.source ?? provenance[0],
      120,
    ),
    sourceDigest: safeOptionalString(
      source?.digest ?? row.sourceDigest ?? row.classificationDigest ?? rootClassificationDigest,
      120,
    ),
    provenance,
  };
}

function catalogRows(catalog: unknown): Array<{ value: unknown; forcedZone?: PortfolioZone }> {
  if (Array.isArray(catalog)) return catalog.map((value) => ({ value }));
  const root = objectValue(catalog);
  if (!root) return [];
  const result: Array<{ value: unknown; forcedZone?: PortfolioZone }> = [];
  let hasFlatRows = false;
  for (const key of ['records', 'items', 'entries', 'workObjects']) {
    if (Array.isArray(root[key])) {
      for (const value of root[key] as unknown[]) result.push({ value });
      hasFlatRows = true;
      break;
    }
  }
  const sections = objectValue(root.sections) ?? root;
  const append = (zone: PortfolioZone, keys: string[]) => {
    for (const key of keys) {
      const rows = sections[key];
      if (!Array.isArray(rows)) continue;
      for (const value of rows) result.push({ value, forcedZone: zone });
      break;
    }
  };
  if (!hasFlatRows) {
    append('saplings', ['saplings', 'saplingRecords']);
    append('clients', ['clientBranches', 'clients', 'branches']);
    append('programs', ['internalPrograms', 'programs']);
  }
  append('review', ['classificationReview', 'classificationReviews', 'review', 'reviews']);
  append('historical', ['historicalProducts', 'historicalSurfaces', 'historical']);
  return result;
}

function sortRecords(records: PortfolioRecord[]): PortfolioRecord[] {
  const zoneOrder: PortfolioZone[] = ['saplings', 'clients', 'programs', 'review', 'historical'];
  return [...records].sort((left, right) => {
    const zoneDifference = zoneOrder.indexOf(left.zone) - zoneOrder.indexOf(right.zone);
    if (zoneDifference !== 0) return zoneDifference;
    return left.canonicalId < right.canonicalId ? -1 : left.canonicalId > right.canonicalId ? 1 : 0;
  });
}

export function normalizePortfolioPayload(input: PortfolioPayloadInput): NormalizedPortfolioPayload {
  const hasDetail = input.portfolioCatalog !== undefined && input.portfolioCatalog !== null;
  const hasSummary = input.portfolioCatalogSummary !== undefined && input.portfolioCatalogSummary !== null;
  if (!hasDetail && !hasSummary) {
    return { mode: 'none', counts: { ...EMPTY_COUNTS }, records: [] };
  }

  const records = sortRecords(
    catalogRows(input.portfolioCatalog)
      .slice(0, PORTFOLIO_RECORD_LIMIT)
      .map(({ value, forcedZone }) => normalizeRecord(
        value,
        forcedZone,
        safeOptionalString(objectValue(input.portfolioCatalog)?.classificationDigest, 120),
      ))
      .filter((record): record is PortfolioRecord => record !== null),
  );
  const joinReport = objectValue(input.portfolioJoinReport);
  const matches = Array.isArray(joinReport?.matches) ? joinReport.matches : [];
  const runtimeByCanonicalId = new Map<string, string>();
  for (const match of matches) {
    const row = objectValue(match);
    const canonicalId = safeOptionalString(row?.canonicalId, 64);
    const runtimeWorkId = safeOptionalString(row?.runtimeWorkId, 64);
    if (
      canonicalId === null ||
      runtimeWorkId === null ||
      canonicalId !== runtimeWorkId ||
      !CANONICAL_RUNTIME_WORK_ID.test(runtimeWorkId) ||
      runtimeByCanonicalId.has(canonicalId)
    ) continue;
    runtimeByCanonicalId.set(canonicalId, runtimeWorkId);
  }
  for (const record of records) {
    record.runtimeWorkId = runtimeByCanonicalId.get(record.canonicalId) ?? null;
  }
  const derived: PortfolioCounts = {
    saplings: records.filter((record) => record.zone === 'saplings').length,
    clients: records.filter((record) => record.zone === 'clients').length,
    programs: records.filter((record) => record.zone === 'programs').length,
    review: records.filter((record) => record.zone === 'review').length,
    historical: records.filter((record) => record.zone === 'historical').length,
  };
  const summary = objectValue(input.portfolioCatalogSummary);
  const sources = summary
    ? [
        summary,
        objectValue(summary.counts),
        objectValue(summary.zones),
        objectValue(summary.totals),
      ].filter((value): value is UnknownRecord => value !== null)
    : [];
  const counts: PortfolioCounts = {
    saplings: firstCount(sources, ['saplings', 'saplingCount']) ?? derived.saplings,
    clients: firstCount(sources, ['clients', 'clientBranches', 'branches', 'clientCount']) ?? derived.clients,
    programs: firstCount(sources, ['programs', 'internalPrograms', 'programCount']) ?? derived.programs,
    review: firstCount(sources, ['review', 'classificationReview', 'reviews', 'reviewCount']) ?? derived.review,
    historical: firstCount(sources, ['historical', 'historicalProducts', 'historicalSurfaces', 'historicalCount']) ?? derived.historical,
  };
  return {
    mode: hasDetail ? 'detail' : 'aggregate-only',
    counts,
    records: hasDetail ? records : [],
  };
}

function exactWorkNode(
  projection: MissionFabricProjectionV1,
  record: PortfolioRecord,
): MissionFabricProjectionV1['nodes'][number] | null {
  if (!record.canonical || record.runtimeWorkId === null || !Array.isArray(projection?.nodes)) return null;
  const runtimeWorkId = record.runtimeWorkId;
  return projection.nodes.find(
    (node) =>
      node?.kind === 'work' &&
      typeof node.value === 'object' &&
      node.value !== null &&
      node.value.workId === runtimeWorkId,
  ) ?? null;
}

export function portfolioRuntimeWorkId(
  projection: MissionFabricProjectionV1,
  record: PortfolioRecord,
): string | null {
  const node = exactWorkNode(projection, record);
  return node?.kind === 'work' && typeof node.value.workId === 'string'
    ? node.value.workId
    : null;
}

function recordTemplate(record: PortfolioRecord): string | null {
  if (record.zone === 'saplings') return PORTFOLIO_LIFECYCLE_TEMPLATES.saplings;
  if (record.zone === 'clients') return PORTFOLIO_LIFECYCLE_TEMPLATES.clients;
  if (record.zone === 'programs') return PORTFOLIO_LIFECYCLE_TEMPLATES.programs;
  return null;
}

export function portfolioPromotionProposal(
  projection: MissionFabricProjectionV1,
  record: PortfolioRecord,
): PortfolioPromotionProposal | null {
  const node = exactWorkNode(projection, record);
  const work = node?.kind === 'work' ? node.value : null;
  if (
    work?.kind !== 'sapling' ||
    record.runtimeWorkId !== record.canonicalId ||
    record.paused ||
    record.sourceDigest === null ||
    !PORTFOLIO_SOURCE_DIGEST.test(record.sourceDigest) ||
    work.currentGate.trim().length === 0 ||
    !['proof-only', 'supervised-branch', 'autonomous-branch'].includes(work.promotionState)
  ) return null;
  return {
    kind: 'promote-portfolio',
    subject: record.canonicalId,
    evidence: `portfolio promotion proposal only · exact WorkObject ${record.canonicalId} · served state ${work.promotionState} · current Gate ${work.currentGate} · source digest ${record.sourceDigest}`,
    consequence: `queue founder review for the next lifecycle state of ${record.canonicalId}; no lifecycle or catalog mutation occurs until operator consumption`,
    reversibility: 'queued Portfolio promotion can be superseded until consumed; lifecycle and catalog remain unchanged',
    idempotencyKey: `promote-portfolio:cambium:${record.canonicalId}:${record.sourceDigest.slice(0, 12)}`,
    note: `Portfolio proposal only · exact identity ${record.canonicalId} · served state ${work.promotionState} · current Gate ${work.currentGate}`,
  };
}

function summaryMarkup(counts: PortfolioCounts): string {
  const count = (key: keyof PortfolioCounts, label: string) =>
    `<span class="of-portfolio-count"><strong data-portfolio-count="${key}">${counts[key]}</strong> ${label}</span>`;
  return (
    `<div class="of-portfolio-summary" data-component="PortfolioSummary" aria-label="Portfolio classification counts">` +
    count('saplings', 'Saplings') +
    count('clients', 'Branches · Clients') +
    count('programs', 'Programs') +
    count('review', 'Review') +
    count('historical', 'historical') +
    `</div>`
  );
}

function filterMarkup(): string {
  const filter = (id: string, label: string, pressed: boolean) =>
    `<button type="button" class="of-control of-portfolio-filter" data-of-portfolio-filter="${id}" aria-pressed="${pressed}">${label}</button>`;
  return (
    `<div class="of-portfolio-filters" role="toolbar" aria-label="Filter portfolio zones">` +
    filter('all', 'All', true) +
    filter('saplings', 'Saplings', false) +
    filter('clients', 'Clients', false) +
    filter('programs', 'Programs', false) +
    filter('review', 'Review', false) +
    `</div>`
  );
}

function aliasesMarkup(record: PortfolioRecord): string {
  if (record.aliases.length === 0) return '';
  return (
    `<div class="of-portfolio-aliases" aria-label="Display aliases">` +
    record.aliases.map(
      (alias) => `<span class="of-chip" data-alias-authority="false">${escapeHtml(alias)}</span>`,
    ).join('') +
    `<p class="of-card-note">aliases are display-only · not tenant authority</p>` +
    `</div>`
  );
}

function linkedMarkup(record: PortfolioRecord): string {
  if (record.linkedCanonicalIds.length === 0) return '';
  return (
    `<p class="of-card-note">linked record · separate identity · ` +
    record.linkedCanonicalIds.map((id) => escapeHtml(id)).join(', ') +
    `</p>`
  );
}

function portfolioCard(
  projection: MissionFabricProjectionV1,
  record: PortfolioRecord,
  selectedPortfolioId: string | null,
): string {
  const exact = exactWorkNode(projection, record) !== null;
  const proposal = portfolioPromotionProposal(projection, record);
  const template = recordTemplate(record);
  const selected = selectedPortfolioId === record.canonicalId;
  const parent = record.parentTenant
    ? `<div class="of-fact"><dt>parent tenant</dt><dd>${escapeHtml(record.parentTenant)}</dd></div>`
    : '';
  const lifecycle = template
    ? (
        `<div class="of-portfolio-lifecycle" data-lifecycle-kind="${record.zone}">` +
        `<strong>Lifecycle template</strong>` +
        `<p>${escapeHtml(template)}</p>` +
        `<small>template only · not live state</small>` +
        (record.paused
          ? `<p class="of-portfolio-overlay" data-lifecycle-overlay="paused">Paused overlay</p>`
          : '') +
        `</div>`
      )
    : '';
  const select = record.canonical
    ? (
        `<button type="button" class="of-control of-portfolio-open" ` +
        `data-of-open-portfolio="${escapeHtml(record.canonicalId)}" ` +
        `aria-pressed="${selected}" aria-label="Focus ${escapeHtml(record.name)}">Focus</button>`
      )
    : '';
  const promote = proposal
    ? (
        `<p class="of-card-note">promotion proposal only · founder Gate review required</p>` +
        `<button type="button" class="of-control of-portfolio-promote" ` +
        `data-of-portfolio-promote="${escapeHtml(proposal.subject)}" ` +
        `data-of-portfolio-promote-state="proposal-only" ` +
        `aria-label="Request founder review for ${escapeHtml(record.name)} promotion">Request promotion review</button>`
      )
    : '';
  return (
    `<article class="of-card of-portfolio-card" data-portfolio-card ` +
    `data-portfolio-id="${escapeHtml(record.canonicalId)}" data-portfolio-kind="${record.zone}" ` +
    `data-portfolio-join="${exact ? 'exact' : 'missing'}"${selected ? ' aria-current="true"' : ''}>` +
    `<header class="of-card-head"><h4 class="of-card-title">${escapeHtml(record.name)}</h4>` +
    `<span class="of-badge">${escapeHtml(record.classification)}</span></header>` +
    `<div class="of-card-body"><dl class="of-card-facts">` +
    `<div class="of-fact"><dt>classification · read-only</dt><dd>${escapeHtml(record.classification)}</dd></div>` +
    `<div class="of-fact"><dt>Mission Fabric identity</dt><dd>${exact ? 'exact match' : 'missing'}</dd></div>` +
    parent +
    `</dl>` +
    aliasesMarkup(record) +
    linkedMarkup(record) +
    lifecycle +
    select +
    promote +
    `</div></article>`
  );
}

function zoneMarkup(
  projection: MissionFabricProjectionV1,
  zone: Exclude<PortfolioZone, 'historical'>,
  records: PortfolioRecord[],
  counts: PortfolioCounts,
  selectedPortfolioId: string | null,
): string {
  const zoneRecords = zone === 'review'
    ? records.filter((record) => record.zone === 'review' || record.zone === 'historical')
    : records.filter((record) => record.zone === zone);
  const title = zone === 'saplings'
    ? 'Saplings'
    : zone === 'clients'
      ? 'Branches · Clients'
      : zone === 'programs'
        ? 'Programs'
        : 'Review';
  const countLabel = zone === 'review'
    ? `${counts.review} review · ${counts.historical} historical`
    : `${counts[zone]} classified`;
  const preview = zoneRecords.slice(0, PORTFOLIO_ZONE_PREVIEW_LIMIT);
  const remainder = zoneRecords.slice(PORTFOLIO_ZONE_PREVIEW_LIMIT);
  const empty = zoneRecords.length === 0
    ? `<p class="of-card-note">No founder detail records in this zone.</p>`
    : '';
  const more = remainder.length > 0
    ? (
        `<details class="of-portfolio-more">` +
        `<summary class="of-control of-portfolio-summary-control">Show ${remainder.length} more ${title}</summary>` +
        `<div class="of-portfolio-grid">` +
        remainder.map((record) => portfolioCard(projection, record, selectedPortfolioId)).join('') +
        `</div></details>`
      )
    : '';
  return (
    `<section class="of-portfolio-zone" data-portfolio-zone="${zone}" aria-labelledby="ofPortfolio-${zone}">` +
    `<header class="of-portfolio-zone-head"><h3 id="ofPortfolio-${zone}">${title}</h3><span>${countLabel}</span></header>` +
    empty +
    `<div class="of-portfolio-grid">` +
    preview.map((record) => portfolioCard(projection, record, selectedPortfolioId)).join('') +
    `</div>` +
    more +
    `</section>`
  );
}

export function renderPortfolioCanopy(
  projection: MissionFabricProjectionV1,
  normalized: NormalizedPortfolioPayload,
  selectedPortfolioId: string | null = null,
): string {
  const summary = summaryMarkup(normalized.counts);
  if (normalized.mode === 'aggregate-only') {
    return (
      `<div class="of-canopy of-portfolio-canopy" data-component="PortfolioCanopy" ` +
      `data-portfolio-mode="aggregate-only">${summary}` +
      `<div class="of-state of-state-empty" role="status">` +
      `<strong class="of-state-title">Portfolio details restricted</strong>` +
      `<p class="of-state-detail">Aggregate classification counts only.</p>` +
      `</div></div>`
    );
  }
  const lifecycleLegend = (
    `<details class="of-portfolio-more of-lifecycle-legend">` +
    `<summary class="of-control of-portfolio-summary-control">Lifecycle templates</summary>` +
    `<dl class="of-card-facts">` +
    `<div class="of-fact"><dt>Sapling</dt><dd>${escapeHtml(PORTFOLIO_LIFECYCLE_TEMPLATES.saplings)}</dd></div>` +
    `<div class="of-fact"><dt>Client</dt><dd>${escapeHtml(PORTFOLIO_LIFECYCLE_TEMPLATES.clients)}</dd></div>` +
    `<div class="of-fact"><dt>Program</dt><dd>${escapeHtml(PORTFOLIO_LIFECYCLE_TEMPLATES.programs)}</dd></div>` +
    `</dl><p class="of-card-note">templates only · never inferred live state</p></details>`
  );
  return (
    `<div class="of-canopy of-portfolio-canopy" data-component="PortfolioCanopy" data-portfolio-mode="detail">` +
    summary +
    filterMarkup() +
    lifecycleLegend +
    zoneMarkup(projection, 'saplings', normalized.records, normalized.counts, selectedPortfolioId) +
    zoneMarkup(projection, 'clients', normalized.records, normalized.counts, selectedPortfolioId) +
    zoneMarkup(projection, 'programs', normalized.records, normalized.counts, selectedPortfolioId) +
    zoneMarkup(projection, 'review', normalized.records, normalized.counts, selectedPortfolioId) +
    `</div>`
  );
}

function scopedRuntimeIds(
  projection: MissionFabricProjectionV1,
  record: PortfolioRecord,
): Set<string> {
  const ids = new Set<string>();
  if (exactWorkNode(projection, record) === null) return ids;
  const runtimeWorkId = portfolioRuntimeWorkId(projection, record);
  if (runtimeWorkId === null) return ids;
  ids.add(runtimeWorkId);
  for (const node of projection.nodes) {
    if (
      node?.kind === 'task' &&
      typeof node.value === 'object' &&
      node.value !== null &&
      'workId' in node.value &&
      node.value.workId === runtimeWorkId &&
      typeof node.value.taskId === 'string'
    ) {
      ids.add(node.value.taskId);
    }
  }
  const edges = Array.isArray(projection.edges) ? projection.edges : [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (edge?.kind !== 'contains' || !ids.has(edge.fromId) || ids.has(edge.toId)) continue;
      ids.add(edge.toId);
      changed = true;
    }
  }
  return ids;
}

function explicitTargets(
  projection: MissionFabricProjectionV1,
  scopedIds: Set<string>,
  kind: string,
): string[] {
  if (scopedIds.size === 0 || !Array.isArray(projection.edges)) return [];
  return [...new Set(
    projection.edges
      .filter((edge) => edge?.kind === kind && scopedIds.has(edge.fromId))
      .map((edge) => safeOptionalString(edge.toId, 64))
      .filter((value): value is string => value !== null),
  )].sort();
}

function operationalPacketReferenceMarkup(
  scene: PortfolioSceneContext,
  operational: OperationalPacketProjection,
  exact: boolean,
  admitted: boolean,
): string {
  const authority = (
    `<div class="of-fitcheck-authority" data-operational-authority="packet-plan" data-fitcheck-authority="packet-plan">` +
    `<span class="of-badge">packet plan</span>` +
    `<span class="of-badge ${admitted ? 'is-fresh' : 'is-unknown'}">${escapeHtml(admitted ? operational.runtimeJoin.evidencedLabel : operational.runtimeJoin.heldLabel)}</span>` +
    `<span class="of-badge is-unknown">receipt proof absent</span>` +
    `</div>`
  );
  let body = '';
  if (scene === 'mission') {
    body = (
      `<p class="of-fitcheck-frontier">${escapeHtml(operational.story.currentFrontier)}</p>` +
      `<div class="of-fitcheck-rows">` +
      operational.missions.map((mission) => (
        `<article><span>${escapeHtml(mission.type)}</span><code>${escapeHtml(mission.missionId)}</code>` +
        `<strong>${escapeHtml(mission.title)}</strong>` +
        `<small>${escapeHtml(mission.gate)} · ${escapeHtml(mission.proofRequired)}</small></article>`
      )).join('') +
      `</div>` +
      `<div class="of-fitcheck-kpis">` +
      operational.kpis.map((kpi) => `<span>${escapeHtml(kpi.label)} · ${escapeHtml(kpi.currentState)}</span>`).join('') +
      `</div>`
    );
  } else if (scene === 'flow') {
    body = (
      `<div class="of-fitcheck-ladder">` +
      operational.executionLadder.map((stage) => {
        const evidenced = stage.current || (stage.stage === operational.runtimeJoin.evidenceStage && admitted);
        return (
          `<span data-fitcheck-stage="${escapeHtml(stage.stage)}" data-fitcheck-stage-state="${evidenced ? 'evidenced' : 'held'}">` +
          `${escapeHtml(stage.stage)}<small>${evidenced ? 'evidenced' : 'held'}</small></span>`
        );
      }).join('') +
      `</div>` +
      `<p class="of-fitcheck-loop"><strong>${escapeHtml(operational.loop.title)}</strong><br>` +
      `${escapeHtml(operational.loop.oneChangeRule)}<br><small>foldback → next-intent proposal → signed Gate → D1 CAS</small></p>`
    );
  } else if (scene === 'workforce') {
    body = (
      `<p class="of-card-note">packet owners and dispatch targets · not live assignments</p>` +
      `<div class="of-fitcheck-rows">` +
      operational.missions.map((mission) => (
        `<article><span>${escapeHtml(mission.owner)}</span><strong>${escapeHtml(mission.title)}</strong>` +
        `<small>${escapeHtml(mission.dispatchTarget)} · blocked by ${escapeHtml(mission.gate)}</small></article>`
      )).join('') +
      `</div>`
    );
  } else if (scene === 'forge') {
    body = (
      `<p class="of-card-note">packet route · never substitutes for a pinned loadout</p>` +
      `<div class="of-fitcheck-organs">` +
      operational.organs.map((organ) => `<span>${escapeHtml(organ.name)}<small>${escapeHtml(organ.state)}</small></span>`).join('') +
      operational.supportRails.map((rail) => `<span class="is-support">${escapeHtml(rail.name)}<small>support · ${escapeHtml(rail.state)}</small></span>`).join('') +
      `</div>`
    );
  } else if (scene === 'gate') {
    body = (
      `<p class="of-card-note">packet approval ledger · no Gate action synthesized</p>` +
      `<div class="of-fitcheck-gates">` +
      operational.gates.map((gate) => (
        `<article data-fitcheck-gate-state="${escapeHtml(gate.status)}"><strong>${escapeHtml(gate.gate)}</strong>` +
        `<span>${escapeHtml(gate.status)}</span><small>${escapeHtml(gate.requiredProof)}</small></article>`
      )).join('') +
      `</div>`
    );
  } else {
    body = (
      `<dl class="of-card-facts">` +
      `<div class="of-fact"><dt>packet</dt><dd>${escapeHtml(operational.sources.packet)}</dd></div>` +
      `<div class="of-fact"><dt>runtime</dt><dd>${escapeHtml(operational.authority.runtime)}</dd></div>` +
      `<div class="of-fact"><dt>proof</dt><dd>${escapeHtml(operational.authority.proof)}</dd></div>` +
      `</dl><p class="of-card-note">one WorkObject · multiple explicitly-owned systems</p>` +
      `<div class="of-fitcheck-rows">` +
      operational.repositoryComponents.map((component) => (
        `<article><span>${escapeHtml(component.roles.join(' · '))}</span><code>${escapeHtml(component.immutableRepositoryId ?? 'repository ID held')}</code>` +
        `<strong>${escapeHtml(component.nameWithOwner)}</strong>` +
        `<small>${escapeHtml(component.ownerWorkObjectId)} · ${escapeHtml(component.planningAuthority ? 'planning authority' : 'dependent component')}</small></article>`
      )).join('') +
      operational.workObjectDependencies.map((dependency) => (
        `<article><span>${escapeHtml(dependency.kind)} dependency</span><code>${escapeHtml(dependency.workObjectId)}</code>` +
        `<strong>${escapeHtml(dependency.purpose)}</strong><small>${dependency.required ? 'required' : 'optional'}</small></article>`
      )).join('') +
      `</div><p class="of-card-gap">${escapeHtml(operational.story.antiClaims)}</p>`
    );
  }
  // Pure L4 loop projection (no network) for Mini App Mission Fabric strip
  let loopStrip = '';
  try {
    // Lazy require pattern avoided; dynamic import not available in pure template string builders.
    // Inline minimal status from lifecycle ladder only if proactive helper is available on globalThis.
    const proactive = (globalThis as { __CAMBIUM_PROACTIVE_LOOP__?: {
      heldCount: number;
      failedCount: number;
      passedCount: number;
      nextFounderAction: string | null;
      ladder: Array<{ stage: string; exit: string; summary: string }>;
    } }).__CAMBIUM_PROACTIVE_LOOP__;
    if (proactive) {
      loopStrip =
        `<div class="of-fitcheck-loop" data-proactive-loop="cambium.proactive-loop-miniapp.v1">` +
        `<span>Proactive L4 loops · pass ${proactive.passedCount} · held ${proactive.heldCount} · fail ${proactive.failedCount}</span>` +
        (proactive.nextFounderAction
          ? `<strong>Next founder action: ${escapeHtml(proactive.nextFounderAction)}</strong>`
          : `<strong>No founder action queued</strong>`) +
        `<small>Projection only · not D1 admission · Hermes owns Telegram transport</small></div>`;
    }
  } catch {
    loopStrip = '';
  }

  return (
    `<div class="of-fitcheck-reference" data-operational-packet="${escapeHtml(operational.schema)}" data-fitcheck-golden-path="${escapeHtml(operational.schema)}" ` +
    `data-fitcheck-scene="${scene}"><header><span>${escapeHtml(operational.identity.name)} operational packet</span>` +
    `<strong>${escapeHtml(operational.identity.autonomyLabel)}</strong></header>${authority}${body}${loopStrip}</div>`
  );
}

export function renderPortfolioSceneContext(
  scene: string,
  projection: MissionFabricProjectionV1,
  record: PortfolioRecord | null,
): string {
  const allowed: PortfolioSceneContext[] = ['mission', 'flow', 'workforce', 'forge', 'inspect', 'gate'];
  if (!record || !allowed.includes(scene as PortfolioSceneContext)) return '';
  const exact = exactWorkNode(projection, record) !== null;
  const proposal = portfolioPromotionProposal(projection, record);
  const scopedIds = scopedRuntimeIds(projection, record);
  const template = recordTemplate(record);
  let detail = '';
  if (scene === 'mission') {
    detail = exact ? 'Mission Fabric identity exact match' : 'Mission Fabric identity missing';
  } else if (scene === 'flow') {
    detail = template
      ? `${template}<br><small>template only · not live state</small>`
      : 'Lifecycle template unavailable for this classification';
  } else if (scene === 'workforce') {
    const assignments = explicitTargets(projection, scopedIds, 'assigned-to');
    detail = assignments.length > 0
      ? `explicit assignments · ${assignments.map(escapeHtml).join(', ')}`
      : 'assignments unmapped';
  } else if (scene === 'forge') {
    const clusters = explicitTargets(projection, scopedIds, 'requires-cluster');
    const loadouts = explicitTargets(projection, scopedIds, 'pins-loadout');
    detail = (
      `${clusters.length > 0 ? `explicit clusters · ${clusters.map(escapeHtml).join(', ')}` : 'skills unmapped'}` +
      `<br>${loadouts.length > 0 ? `explicit loadout · ${loadouts.map(escapeHtml).join(', ')}` : 'loadout unmapped'}`
    );
  } else if (scene === 'inspect') {
    const provenance = [
      record.sourceRegistry ? `source · ${escapeHtml(record.sourceRegistry)}` : null,
      record.sourceDigest ? `digest · ${escapeHtml(record.sourceDigest)}` : null,
      record.provenance.length > 0
        ? `provenance · ${record.provenance.map(escapeHtml).join(', ')}`
        : null,
      `identity · ${escapeHtml(record.canonicalId)}`,
      `classification · ${escapeHtml(record.classification)}`,
    ].filter((value): value is string => value !== null);
    detail = provenance.join('<br>');
  } else {
    detail = proposal
      ? 'read-only catalog context · exact runtime identity · promotion proposal only · founder review required'
      : exact
        ? 'read-only catalog context · exact runtime identity · promotion request unavailable'
        : 'read-only catalog context · runtime identity missing · promotion request unavailable';
  }
  return (
    `<section class="of-portfolio-context" data-portfolio-context="${scene}" ` +
    `data-portfolio-join="${exact ? 'exact' : 'missing'}" aria-label="Selected portfolio context">` +
    `<strong>${escapeHtml(record.name)}</strong>` +
    `<p>${detail}</p>` +
    `</section>`
  );
}

// Plain browser-valid mirror. It accepts the same deliberately loose top-level
// response values as normalizePortfolioPayload so handler integration stays a
// two-field pass-through and old responses continue down the legacy path.
export const PORTFOLIO_BROWSER_JS = String.raw`
var OF_PORTFOLIO_TEMPLATES = {
  saplings: 'Idea → Proposal → Evidence → Proof only → Supervised branch → Autonomous branch → Product review → outcome',
  clients: 'Lead → Qualified outcome → Scope/proposal → Approval → Kickoff → Delivery → Acceptance → Handoff → close/renew/expand',
  programs: 'Proposed → Approved → Executing → Verifying → Complete/Retired'
};
var OF_PORTFOLIO_PREVIEW_LIMIT = 2;
var OF_PORTFOLIO_RECORD_LIMIT = 160;
function ofPortfolioObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function ofPortfolioSafe(value, fallback, max) {
  var text = typeof value === 'string' ? value.trim() : '';
  if (!text || OF_SECRET_MARKER.test(text)) return fallback;
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
function ofPortfolioOptional(value, max) {
  var text = ofPortfolioSafe(value, '', max);
  return text ? text : null;
}
function ofPortfolioCount(value) {
  if (Number.isSafeInteger(value) && value >= 0 && value <= 100000) return value;
  var row = ofPortfolioObject(value);
  if (!row) return null;
  var keys = ['count', 'total', 'classified'];
  for (var i = 0; i < keys.length; i += 1) {
    var nested = ofPortfolioCount(row[keys[i]]);
    if (nested !== null) return nested;
  }
  return null;
}
function ofPortfolioFirstCount(sources, keys) {
  for (var si = 0; si < sources.length; si += 1) {
    for (var ki = 0; ki < keys.length; ki += 1) {
      var count = ofPortfolioCount(sources[si][keys[ki]]);
      if (count !== null) return count;
    }
  }
  return null;
}
function ofPortfolioZone(value, forced) {
  if (forced) return forced;
  var normalized = typeof value === 'string' ? value.trim().toLowerCase().replace(/[_\s]+/g, '-') : '';
  if (normalized === 'sapling' || normalized === 'saplings') return 'saplings';
  if (['client', 'clients', 'branch', 'client-branch', 'client-program'].indexOf(normalized) !== -1) return 'clients';
  if (['program', 'programs', 'internal-program', 'capability-program'].indexOf(normalized) !== -1) return 'programs';
  if (['review', 'classification-review', 'unclassified'].indexOf(normalized) !== -1) return 'review';
  if (['historical', 'historical-product', 'historical-surface', 'product'].indexOf(normalized) !== -1) return 'historical';
  return null;
}
function ofPortfolioClassification(row) {
  var classification = row.classification;
  var nested = ofPortfolioObject(classification);
  return (nested && (nested.zone || nested.kind || nested.type)) || classification || row.workObjectType || row.recordType || row.kind || row.type;
}
function ofPortfolioLabel(zone) {
  return zone === 'saplings' ? 'Sapling'
    : zone === 'clients' ? 'Branch · Client'
    : zone === 'programs' ? 'Internal Program'
    : zone === 'review' ? 'Classification Review'
    : 'Historical Product';
}
function ofPortfolioList(value, limit) {
  if (!Array.isArray(value)) return [];
  var result = [];
  for (var i = 0; i < value.length && result.length < limit; i += 1) {
    var safe = ofPortfolioOptional(value[i], 64);
    if (safe && result.indexOf(safe) === -1) result.push(safe);
  }
  return result;
}
function ofPortfolioAliases(value) {
  if (!Array.isArray(value)) return [];
  var aliases = [];
  for (var i = 0; i < value.length && aliases.length < 12; i += 1) {
    var row = ofPortfolioObject(value[i]);
    var candidate = row ? (row.tenantAuthority === false ? row.value : null) : value[i];
    var alias = ofPortfolioOptional(candidate, 64);
    if (alias && aliases.indexOf(alias) === -1) aliases.push(alias);
  }
  return aliases;
}
function ofPortfolioProvenance(value) {
  if (!Array.isArray(value)) return [];
  var result = [];
  for (var i = 0; i < value.length && result.length < 8; i += 1) {
    var safe = ofPortfolioOptional(value[i], 120);
    if (!safe || /^(?:\/|[A-Za-z]:[\\/]|file:\/\/)/.test(safe) || result.indexOf(safe) !== -1) continue;
    result.push(safe);
  }
  return result;
}
function ofNormalizePortfolioRecord(value, forced, rootClassificationDigest) {
  var row = ofPortfolioObject(value);
  if (!row) return null;
  var zone = ofPortfolioZone(ofPortfolioClassification(row), forced);
  if (!zone) return null;
  var prefixes = { saplings: 'sapling:', clients: 'branch:', programs: 'program:', review: 'review:', historical: 'historical-product:' };
  var canonicalId = ofPortfolioSafe(row.canonicalId || row.workId || row.portfolioId || row.id, 'unmapped:' + zone, 64);
  var aliases = ofPortfolioAliases(row.aliases || row.displayAliases);
  if (canonicalId === 'sapling:fitcheck') {
    if (aliases.indexOf('FitCheck') === -1) aliases.push('FitCheck');
    if (aliases.indexOf('getfitcheck') === -1) aliases.push('getfitcheck');
  }
  var source = ofPortfolioObject(row.source) || {};
  var tenantIdentity = ofPortfolioObject(row.tenantIdentity) || {};
  var provenance = ofPortfolioProvenance(row.provenance);
  var linkedValue = row.linkedCanonicalIds || row.linkedWorkIds || row.links ||
    (typeof row.linkedCanonicalId === 'string' ? [row.linkedCanonicalId] : []);
  return {
    canonicalId: canonicalId,
    name: ofPortfolioSafe(row.displayName || row.name || row.title || row.source, canonicalId, 120),
    zone: zone,
    classification: ofPortfolioLabel(zone),
    canonical: /^(?:sapling|branch|program|review|historical-product):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonicalId) && canonicalId.indexOf(prefixes[zone]) === 0,
    runtimeWorkId: null,
    aliases: aliases,
    linkedCanonicalIds: ofPortfolioList(linkedValue, 16),
    parentTenant: canonicalId === 'sapling:fitcheck'
      ? 'cambium'
      : ofPortfolioOptional(row.parentTenant || tenantIdentity.parentTenant || tenantIdentity.tenantId || row.tenantId, 64),
    paused: row.paused === true || row.operationalOverlay === 'paused' || row.lifecycleOverlay === 'paused' || row.overlay === 'paused',
    sourceRegistry: ofPortfolioOptional(source.registry || source.source || row.sourceRegistry || row.source || provenance[0], 120),
    sourceDigest: ofPortfolioOptional(source.digest || row.sourceDigest || row.classificationDigest || rootClassificationDigest, 120),
    provenance: provenance
  };
}
function ofPortfolioRows(catalog) {
  if (Array.isArray(catalog)) return catalog.map(function (value) { return { value: value }; });
  var root = ofPortfolioObject(catalog);
  if (!root) return [];
  var result = [];
  var hasFlatRows = false;
  var flatKeys = ['records', 'items', 'entries', 'workObjects'];
  for (var fi = 0; fi < flatKeys.length; fi += 1) {
    if (Array.isArray(root[flatKeys[fi]])) {
      for (var fri = 0; fri < root[flatKeys[fi]].length; fri += 1) {
        result.push({ value: root[flatKeys[fi]][fri] });
      }
      hasFlatRows = true;
      break;
    }
  }
  var sections = ofPortfolioObject(root.sections) || root;
  function append(zone, keys) {
    for (var ki = 0; ki < keys.length; ki += 1) {
      var rows = sections[keys[ki]];
      if (!Array.isArray(rows)) continue;
      for (var ri = 0; ri < rows.length; ri += 1) result.push({ value: rows[ri], forcedZone: zone });
      break;
    }
  }
  if (!hasFlatRows) {
    append('saplings', ['saplings', 'saplingRecords']);
    append('clients', ['clientBranches', 'clients', 'branches']);
    append('programs', ['internalPrograms', 'programs']);
  }
  append('review', ['classificationReview', 'classificationReviews', 'review', 'reviews']);
  append('historical', ['historicalProducts', 'historicalSurfaces', 'historical']);
  return result;
}
function ofNormalizePortfolioPayload(input) {
  input = input || {};
  var hasDetail = input.portfolioCatalog !== undefined && input.portfolioCatalog !== null;
  var hasSummary = input.portfolioCatalogSummary !== undefined && input.portfolioCatalogSummary !== null;
  var empty = { saplings: 0, clients: 0, programs: 0, review: 0, historical: 0 };
  if (!hasDetail && !hasSummary) return { mode: 'none', counts: empty, records: [] };
  var rawRows = ofPortfolioRows(input.portfolioCatalog).slice(0, OF_PORTFOLIO_RECORD_LIMIT);
  var records = [];
  var catalogRoot = ofPortfolioObject(input.portfolioCatalog);
  var rootClassificationDigest = ofPortfolioOptional(catalogRoot && catalogRoot.classificationDigest, 120);
  for (var i = 0; i < rawRows.length; i += 1) {
    var record = ofNormalizePortfolioRecord(rawRows[i].value, rawRows[i].forcedZone, rootClassificationDigest);
    if (record) records.push(record);
  }
  var joinReport = ofPortfolioObject(input.portfolioJoinReport);
  var matches = joinReport && Array.isArray(joinReport.matches) ? joinReport.matches : [];
  var runtimeByCanonicalId = Object.create(null);
  for (var mi = 0; mi < matches.length; mi += 1) {
    var match = ofPortfolioObject(matches[mi]);
    var canonicalId = ofPortfolioOptional(match && match.canonicalId, 64);
    var runtimeWorkId = ofPortfolioOptional(match && match.runtimeWorkId, 64);
    if (!canonicalId || !runtimeWorkId || canonicalId !== runtimeWorkId || !/^(?:sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(runtimeWorkId)) continue;
    if (!Object.prototype.hasOwnProperty.call(runtimeByCanonicalId, canonicalId)) {
      runtimeByCanonicalId[canonicalId] = runtimeWorkId;
    }
  }
  for (var ji = 0; ji < records.length; ji += 1) {
    if (Object.prototype.hasOwnProperty.call(runtimeByCanonicalId, records[ji].canonicalId)) {
      records[ji].runtimeWorkId = runtimeByCanonicalId[records[ji].canonicalId];
    }
  }
  var order = ['saplings', 'clients', 'programs', 'review', 'historical'];
  records.sort(function (left, right) {
    var zoneDifference = order.indexOf(left.zone) - order.indexOf(right.zone);
    if (zoneDifference) return zoneDifference;
    return left.canonicalId < right.canonicalId ? -1 : left.canonicalId > right.canonicalId ? 1 : 0;
  });
  var derived = { saplings: 0, clients: 0, programs: 0, review: 0, historical: 0 };
  for (var di = 0; di < records.length; di += 1) derived[records[di].zone] += 1;
  var summary = ofPortfolioObject(input.portfolioCatalogSummary);
  var sources = [];
  if (summary) {
    sources.push(summary);
    var nestedKeys = ['counts', 'zones', 'totals'];
    for (var ni = 0; ni < nestedKeys.length; ni += 1) {
      var nested = ofPortfolioObject(summary[nestedKeys[ni]]);
      if (nested) sources.push(nested);
    }
  }
  function resolved(keys, fallback) {
    var count = ofPortfolioFirstCount(sources, keys);
    return count === null ? fallback : count;
  }
  var counts = {
    saplings: resolved(['saplings', 'saplingCount'], derived.saplings),
    clients: resolved(['clients', 'clientBranches', 'branches', 'clientCount'], derived.clients),
    programs: resolved(['programs', 'internalPrograms', 'programCount'], derived.programs),
    review: resolved(['review', 'classificationReview', 'reviews', 'reviewCount'], derived.review),
    historical: resolved(['historical', 'historicalProducts', 'historicalSurfaces', 'historicalCount'], derived.historical)
  };
  return { mode: hasDetail ? 'detail' : 'aggregate-only', counts: counts, records: hasDetail ? records : [] };
}
function ofPortfolioExactWork(projection, record) {
  if (!record || !record.canonical || !record.runtimeWorkId || !projection || !Array.isArray(projection.nodes)) return null;
  var runtimeWorkId = record.runtimeWorkId;
  for (var i = 0; i < projection.nodes.length; i += 1) {
    var node = projection.nodes[i];
    if (node && node.kind === 'work' && node.value && node.value.workId === runtimeWorkId) return node;
  }
  return null;
}
function ofPortfolioRuntimeWorkId(projection, record) {
  var node = ofPortfolioExactWork(projection, record);
  return node && node.value && typeof node.value.workId === 'string' ? node.value.workId : null;
}
function ofPortfolioTemplate(record) {
  return record.zone === 'saplings' ? OF_PORTFOLIO_TEMPLATES.saplings
    : record.zone === 'clients' ? OF_PORTFOLIO_TEMPLATES.clients
    : record.zone === 'programs' ? OF_PORTFOLIO_TEMPLATES.programs
    : null;
}
function ofPortfolioPromotionProposal(projection, record) {
  var node = ofPortfolioExactWork(projection, record);
  var work = node && node.value;
  if (
    !work ||
    work.kind !== 'sapling' ||
    !record ||
    record.runtimeWorkId !== record.canonicalId ||
    record.paused ||
    !String(work.currentGate || '').trim() ||
    ['proof-only', 'supervised-branch', 'autonomous-branch'].indexOf(work.promotionState) === -1 ||
    !/^[0-9a-f]{64}$/.test(String(record.sourceDigest || ''))
  ) return null;
  return {
    kind: 'promote-portfolio',
    subject: record.canonicalId,
    evidence: 'portfolio promotion proposal only · exact WorkObject ' + record.canonicalId + ' · served state ' + work.promotionState + ' · current Gate ' + work.currentGate + ' · source digest ' + record.sourceDigest,
    consequence: 'queue founder review for the next lifecycle state of ' + record.canonicalId + '; no lifecycle or catalog mutation occurs until operator consumption',
    reversibility: 'queued Portfolio promotion can be superseded until consumed; lifecycle and catalog remain unchanged',
    idempotencyKey: 'promote-portfolio:cambium:' + record.canonicalId + ':' + record.sourceDigest.slice(0, 12),
    note: 'Portfolio proposal only · exact identity ' + record.canonicalId + ' · served state ' + work.promotionState + ' · current Gate ' + work.currentGate
  };
}
function ofPortfolioSummaryMarkup(counts) {
  function count(key, label) {
    return '<span class="of-portfolio-count"><strong data-portfolio-count="' + key + '">' + counts[key] + '</strong> ' + label + '</span>';
  }
  return '<div class="of-portfolio-summary" data-component="PortfolioSummary" aria-label="Portfolio classification counts">' +
    count('saplings', 'Saplings') + count('clients', 'Branches · Clients') + count('programs', 'Programs') +
    count('review', 'Review') + count('historical', 'historical') + '</div>';
}
function ofPortfolioFilters() {
  function filter(id, label, pressed) {
    return '<button type="button" class="of-control of-portfolio-filter" data-of-portfolio-filter="' + id + '" aria-pressed="' + pressed + '">' + label + '</button>';
  }
  return '<div class="of-portfolio-filters" role="toolbar" aria-label="Filter portfolio zones">' +
    filter('all', 'All', true) + filter('saplings', 'Saplings', false) + filter('clients', 'Clients', false) +
    filter('programs', 'Programs', false) + filter('review', 'Review', false) + '</div>';
}
function ofPortfolioCard(projection, record, selectedId) {
  var exact = !!ofPortfolioExactWork(projection, record);
  var proposal = ofPortfolioPromotionProposal(projection, record);
  var template = ofPortfolioTemplate(record);
  var selected = selectedId === record.canonicalId;
  var parent = record.parentTenant
    ? '<div class="of-fact"><dt>parent tenant</dt><dd>' + ofEsc(record.parentTenant) + '</dd></div>'
    : '';
  var aliases = '';
  if (record.aliases.length) {
    aliases = '<div class="of-portfolio-aliases" aria-label="Display aliases">';
    for (var ai = 0; ai < record.aliases.length; ai += 1) {
      aliases += '<span class="of-chip" data-alias-authority="false">' + ofEsc(record.aliases[ai]) + '</span>';
    }
    aliases += '<p class="of-card-note">aliases are display-only · not tenant authority</p></div>';
  }
  var links = record.linkedCanonicalIds.length
    ? '<p class="of-card-note">linked record · separate identity · ' + record.linkedCanonicalIds.map(ofEsc).join(', ') + '</p>'
    : '';
  var lifecycle = template
    ? '<div class="of-portfolio-lifecycle" data-lifecycle-kind="' + record.zone + '"><strong>Lifecycle template</strong><p>' +
      ofEsc(template) + '</p><small>template only · not live state</small>' +
      (record.paused ? '<p class="of-portfolio-overlay" data-lifecycle-overlay="paused">Paused overlay</p>' : '') + '</div>'
    : '';
  var select = record.canonical
    ? '<button type="button" class="of-control of-portfolio-open" data-of-open-portfolio="' + ofEsc(record.canonicalId) +
      '" aria-pressed="' + selected + '" aria-label="Focus ' + ofEsc(record.name) + '">Focus</button>'
    : '';
  var promote = proposal
    ? '<p class="of-card-note">promotion proposal only · founder Gate review required</p>' +
      '<button type="button" class="of-control of-portfolio-promote" data-of-portfolio-promote="' + ofEsc(proposal.subject) +
      '" data-of-portfolio-promote-state="proposal-only" aria-label="Request founder review for ' + ofEsc(record.name) + ' promotion">Request promotion review</button>'
    : '';
  return '<article class="of-card of-portfolio-card" data-portfolio-card data-portfolio-id="' + ofEsc(record.canonicalId) +
    '" data-portfolio-kind="' + record.zone + '" data-portfolio-join="' + (exact ? 'exact' : 'missing') + '"' +
    (selected ? ' aria-current="true"' : '') + '><header class="of-card-head"><h4 class="of-card-title">' +
    ofEsc(record.name) + '</h4><span class="of-badge">' + ofEsc(record.classification) +
    '</span></header><div class="of-card-body"><dl class="of-card-facts"><div class="of-fact"><dt>classification · read-only</dt><dd>' +
    ofEsc(record.classification) + '</dd></div><div class="of-fact"><dt>Mission Fabric identity</dt><dd>' +
    (exact ? 'exact match' : 'missing') + '</dd></div>' + parent + '</dl>' + aliases + links + lifecycle + select + promote + '</div></article>';
}
function ofPortfolioZoneMarkup(projection, zone, records, counts, selectedId) {
  var zoneRecords = records.filter(function (record) {
    return zone === 'review' ? record.zone === 'review' || record.zone === 'historical' : record.zone === zone;
  });
  var title = zone === 'saplings' ? 'Saplings' : zone === 'clients' ? 'Branches · Clients' : zone === 'programs' ? 'Programs' : 'Review';
  var countLabel = zone === 'review' ? counts.review + ' review · ' + counts.historical + ' historical' : counts[zone] + ' classified';
  var preview = zoneRecords.slice(0, OF_PORTFOLIO_PREVIEW_LIMIT);
  var remainder = zoneRecords.slice(OF_PORTFOLIO_PREVIEW_LIMIT);
  var previewHtml = preview.map(function (record) { return ofPortfolioCard(projection, record, selectedId); }).join('');
  var more = remainder.length
    ? '<details class="of-portfolio-more"><summary class="of-control of-portfolio-summary-control">Show ' + remainder.length + ' more ' + title + '</summary><div class="of-portfolio-grid">' +
      remainder.map(function (record) { return ofPortfolioCard(projection, record, selectedId); }).join('') + '</div></details>'
    : '';
  return '<section class="of-portfolio-zone" data-portfolio-zone="' + zone + '" aria-labelledby="ofPortfolio-' + zone +
    '"><header class="of-portfolio-zone-head"><h3 id="ofPortfolio-' + zone + '">' + title + '</h3><span>' +
    countLabel + '</span></header>' + (zoneRecords.length ? '' : '<p class="of-card-note">No founder detail records in this zone.</p>') +
    '<div class="of-portfolio-grid">' + previewHtml + '</div>' + more + '</section>';
}
function ofRenderPortfolioCanopy(projection, normalized, selectedId) {
  var summary = ofPortfolioSummaryMarkup(normalized.counts);
  if (normalized.mode === 'aggregate-only') {
    return '<div class="of-canopy of-portfolio-canopy" data-component="PortfolioCanopy" data-portfolio-mode="aggregate-only">' +
      summary + '<div class="of-state of-state-empty" role="status"><strong class="of-state-title">Portfolio details restricted</strong>' +
      '<p class="of-state-detail">Aggregate classification counts only.</p></div></div>';
  }
  var legend = '<details class="of-portfolio-more of-lifecycle-legend"><summary class="of-control of-portfolio-summary-control">Lifecycle templates</summary><dl class="of-card-facts">' +
    '<div class="of-fact"><dt>Sapling</dt><dd>' + ofEsc(OF_PORTFOLIO_TEMPLATES.saplings) + '</dd></div>' +
    '<div class="of-fact"><dt>Client</dt><dd>' + ofEsc(OF_PORTFOLIO_TEMPLATES.clients) + '</dd></div>' +
    '<div class="of-fact"><dt>Program</dt><dd>' + ofEsc(OF_PORTFOLIO_TEMPLATES.programs) + '</dd></div>' +
    '</dl><p class="of-card-note">templates only · never inferred live state</p></details>';
  return '<div class="of-canopy of-portfolio-canopy" data-component="PortfolioCanopy" data-portfolio-mode="detail">' +
    summary + ofPortfolioFilters() + legend +
    ofPortfolioZoneMarkup(projection, 'saplings', normalized.records, normalized.counts, selectedId) +
    ofPortfolioZoneMarkup(projection, 'clients', normalized.records, normalized.counts, selectedId) +
    ofPortfolioZoneMarkup(projection, 'programs', normalized.records, normalized.counts, selectedId) +
    ofPortfolioZoneMarkup(projection, 'review', normalized.records, normalized.counts, selectedId) + '</div>';
}
function ofPortfolioScopedIds(projection, record) {
  var ids = Object.create(null);
  if (!ofPortfolioExactWork(projection, record)) return ids;
  var runtimeWorkId = ofPortfolioRuntimeWorkId(projection, record);
  if (!runtimeWorkId) return ids;
  ids[runtimeWorkId] = true;
  var nodes = projection.nodes || [];
  for (var ni = 0; ni < nodes.length; ni += 1) {
    var node = nodes[ni];
    if (node && node.kind === 'task' && node.value && node.value.workId === runtimeWorkId && typeof node.value.taskId === 'string') {
      ids[node.value.taskId] = true;
    }
  }
  var edges = projection.edges || [];
  var changed = true;
  while (changed) {
    changed = false;
    for (var ei = 0; ei < edges.length; ei += 1) {
      var edge = edges[ei];
      if (edge && edge.kind === 'contains' && ids[edge.fromId] && !ids[edge.toId]) {
        ids[edge.toId] = true;
        changed = true;
      }
    }
  }
  return ids;
}
function ofPortfolioTargets(projection, ids, kind) {
  var result = [];
  var edges = projection && Array.isArray(projection.edges) ? projection.edges : [];
  for (var i = 0; i < edges.length; i += 1) {
    var edge = edges[i];
    if (!edge || edge.kind !== kind || !ids[edge.fromId]) continue;
    var target = ofPortfolioOptional(edge.toId, 64);
    if (target && result.indexOf(target) === -1) result.push(target);
  }
  return result.sort();
}
function ofRenderPortfolioSceneContext(scene, projection, record) {
  var allowed = ['mission', 'flow', 'workforce', 'forge', 'inspect', 'gate'];
  if (!record || allowed.indexOf(scene) === -1) return '';
  var exact = !!ofPortfolioExactWork(projection, record);
  var proposal = ofPortfolioPromotionProposal(projection, record);
  var ids = ofPortfolioScopedIds(projection, record);
  var template = ofPortfolioTemplate(record);
  var detail = '';
  if (scene === 'mission') detail = exact ? 'Mission Fabric identity exact match' : 'Mission Fabric identity missing';
  else if (scene === 'flow') detail = template ? ofEsc(template) + '<br><small>template only · not live state</small>' : 'Lifecycle template unavailable for this classification';
  else if (scene === 'workforce') {
    var assignments = ofPortfolioTargets(projection, ids, 'assigned-to');
    detail = assignments.length ? 'explicit assignments · ' + assignments.map(ofEsc).join(', ') : 'assignments unmapped';
  } else if (scene === 'forge') {
    var clusters = ofPortfolioTargets(projection, ids, 'requires-cluster');
    var loadouts = ofPortfolioTargets(projection, ids, 'pins-loadout');
    detail = (clusters.length ? 'explicit clusters · ' + clusters.map(ofEsc).join(', ') : 'skills unmapped') +
      '<br>' + (loadouts.length ? 'explicit loadout · ' + loadouts.map(ofEsc).join(', ') : 'loadout unmapped');
  } else if (scene === 'inspect') {
    var facts = [];
    if (record.sourceRegistry) facts.push('source · ' + ofEsc(record.sourceRegistry));
    if (record.sourceDigest) facts.push('digest · ' + ofEsc(record.sourceDigest));
    if (record.provenance && record.provenance.length) facts.push('provenance · ' + record.provenance.map(ofEsc).join(', '));
    facts.push('identity · ' + ofEsc(record.canonicalId));
    facts.push('classification · ' + ofEsc(record.classification));
    detail = facts.join('<br>');
  } else {
    detail = proposal
      ? 'read-only catalog context · exact runtime identity · promotion proposal only · founder review required'
      : exact
        ? 'read-only catalog context · exact runtime identity · promotion request unavailable'
        : 'read-only catalog context · runtime identity missing · promotion request unavailable';
  }
  return '<section class="of-portfolio-context" data-portfolio-context="' + scene + '" data-portfolio-join="' +
    (exact ? 'exact' : 'missing') + '" aria-label="Selected portfolio context"><strong>' + ofEsc(record.name) +
    '</strong><p>' + detail + '</p></section>';
}
`;
