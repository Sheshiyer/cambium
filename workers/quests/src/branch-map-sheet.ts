/**
 * Pure Telegram branch-map sheet renderer.
 *
 * A sheet is a bounded read model over a validated BranchMapProjection. It
 * never changes node status, invents receipts, or invokes a Worker/provider.
 * Source references are useful operator evidence, but they are untrusted text
 * and are redacted before they reach Telegram.
 */

import type {
  BranchMapBranch,
  BranchMapGap,
  BranchMapProjection,
  BranchMapReceipt,
  BranchMapCampaignOverlay,
  BranchMapWikiOverlay,
} from './branch-map.ts';

export const BRANCH_MAP_SHEET_SCHEMA = 'cambium.telegram.branch-map-sheet.v1' as const;
export const BRANCH_MAP_SHEET_VERSION = 1 as const;
export const BRANCH_MAP_SHEET_MAX_ROWS = 128 as const;
export const BRANCH_MAP_SHEET_MAX_TEXT_LENGTH = 4096 as const;
export const BRANCH_MAP_SHEET_MAX_ROW_LENGTH = 280 as const;

export type BranchMapSheetRowKind = 'branch' | 'organ' | 'receipt' | 'campaign' | 'wiki' | 'gap';

export interface BranchMapSheetRow {
  kind: BranchMapSheetRowKind;
  id: string;
  branchId: string | null;
  nodeId: string | null;
  organId: string | null;
  status: string;
  title: string;
  detail: string;
  sourceRef: string | null;
}

export interface BranchMapSheetCounts {
  branch: number;
  organ: number;
  receipt: number;
  campaign: number;
  wiki: number;
  gap: number;
}

export interface BranchMapSheet {
  schema: typeof BRANCH_MAP_SHEET_SCHEMA;
  version: typeof BRANCH_MAP_SHEET_VERSION;
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  projectionDigest: string;
  sourceRef: string;
  rows: readonly BranchMapSheetRow[];
  counts: BranchMapSheetCounts;
  truncated: boolean;
  text: string;
}

export interface BranchMapSheetOptions {
  maxRows?: number;
  maxTextLength?: number;
  maxRowLength?: number;
}

export interface BranchMapSheetValidationResult {
  valid: boolean;
  value?: BranchMapProjection;
  errors: readonly string[];
}

export type BranchMapSheetRenderResult =
  | { accepted: true; status: 'accepted'; sheet: BranchMapSheet }
  | { accepted: false; status: 'rejected'; errors: readonly string[] };

const ROW_ORDER: readonly BranchMapSheetRowKind[] = ['branch', 'organ', 'receipt', 'campaign', 'wiki', 'gap'];
const ROW_ORDER_INDEX = new Map(ROW_ORDER.map((kind, index) => [kind, index]));
const JWT = /\b(?:eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+\b/g;
const LONG_SECRET = /\b[A-Za-z0-9+/=_-]{48,}\b/g;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function bounded(value: unknown, field: string, limit = 512): string {
  if (!nonEmpty(value)) throw new Error(`${field} must be a non-empty string`);
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (normalized.length > limit) throw new Error(`${field} exceeds ${limit} characters`);
  return normalized;
}

function redactSecretValues(value: string): string {
  let output = value;
  // URI/query and key=value forms. Keep the key for diagnosis, never the value.
  output = output.replace(/(^|[?&;\s])((?:access[_-]?token|api[_-]?key|authorization|bearer|callback[_-]?data|chat[_-]?id|client[_-]?secret|credential|init[_-]?data|nonce|password|passwd|private[_-]?key|refresh[_-]?token|secret|session|signature|token))\s*[:=]\s*([^&;\s]+)/gi, '$1$2=[REDACTED]');
  output = output.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/=_-]+/gi, '$1 [REDACTED]');
  output = output.replace(JWT, '[REDACTED]');
  // Do not print opaque high-entropy material that is not labelled.
  output = output.replace(LONG_SECRET, (candidate) => {
    if (/^(?:sha256:)?[a-f0-9]{48,}$/i.test(candidate)) return candidate;
    return '[REDACTED]';
  });
  return output;
}

/** Redact and bound a source reference before it crosses the Telegram seam. */
export function redactBranchMapSourceRef(value: unknown, limit = 180): string | null {
  if (value === null || value === undefined) return null;
  if (!nonEmpty(value)) return '[REDACTED]';
  let output = redactSecretValues(value.trim().replace(/[\u0000-\u001f\u007f]/g, ' '));
  // Protect URL user-info and common opaque path segments carrying credentials.
  output = output.replace(/(https?:\/\/)([^/@\s]+):([^/@\s]+)@/gi, '$1[REDACTED]@');
  output = output.replace(/(\/(?:token|secret|credential|session)\/)[^/\s]+/gi, '$1[REDACTED]');
  if (output.length > limit) output = `${output.slice(0, Math.max(0, limit - 1))}…`;
  return output;
}

function safeText(value: unknown, limit = 160): string {
  if (value === null || value === undefined) return '';
  const text = redactSecretValues(String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim());
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1))}…` : text;
}

function exactProjectionShape(value: unknown): value is BranchMapProjection {
  if (!isRecord(value)) return false;
  return value.schema === 'cambium.goal-graph-branch-map.v1'
    && value.version === 1
    && value.versionLabel === 'goal-graph-branch-map@1.0.0'
    && nonEmpty(value.tenantId)
    && typeof value.graphVersion === 'number'
    && Number.isSafeInteger(value.graphVersion)
    && value.graphVersion > 0
    && nonEmpty(value.graphDigest)
    && nonEmpty(value.generatedAt)
    && !Number.isNaN(Date.parse(value.generatedAt))
    && nonEmpty(value.sourceRef)
    && nonEmpty(value.projectionDigest)
    && Array.isArray(value.nodes)
    && Array.isArray(value.branches)
    && Array.isArray(value.receipts)
    && Array.isArray(value.lineage)
    && isRecord(value.overlays)
    && Array.isArray(value.overlays.campaigns)
    && Array.isArray(value.overlays.wiki)
    && Array.isArray(value.gaps);
}

function validateArrayObjects(value: readonly unknown[], field: string, errors: string[]): void {
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) errors.push(`${field}[${index}] must be an object`);
  }
}

/**
 * Validate the minimum immutable envelope required by the renderer. The
 * branch-map compiler performs the domain-level checks; this second guard
 * protects the Telegram seam when a caller receives a plain JSON object.
 */
export function validateBranchMapProjectionForSheet(input: unknown): BranchMapSheetValidationResult {
  const errors: string[] = [];
  if (!exactProjectionShape(input)) return { valid: false, errors: ['branch map projection envelope is invalid'] };
  validateArrayObjects(input.nodes, 'nodes', errors);
  validateArrayObjects(input.branches, 'branches', errors);
  validateArrayObjects(input.receipts, 'receipts', errors);
  validateArrayObjects(input.lineage, 'lineage', errors);
  validateArrayObjects(input.overlays.campaigns, 'overlays.campaigns', errors);
  validateArrayObjects(input.overlays.wiki, 'overlays.wiki', errors);
  validateArrayObjects(input.gaps, 'gaps', errors);
  if (errors.length) return { valid: false, errors };
  return { valid: true, value: input, errors: [] };
}

function row(
  kind: BranchMapSheetRowKind,
  id: string,
  fields: Omit<BranchMapSheetRow, 'kind' | 'id'>,
): BranchMapSheetRow {
  return { kind, id, ...fields };
}

function nodeSource(projection: BranchMapProjection, branchId: string): string {
  return projection.nodes.find((node) => node.branchId === branchId)?.sourceRef ?? projection.sourceRef;
}

function organKey(branchId: string, organId: string): string {
  return `${branchId}\u0000${organId}`;
}

function statusRank(status: string): number {
  if (status === 'blocked' || status === 'unknown') return 4;
  if (status === 'pending' || status === 'stale') return 3;
  if (status === 'paused' || status === 'claimed-paused') return 2;
  if (status === 'active' || status === 'observed-active') return 1;
  return 0;
}

function aggregateStatus(statuses: readonly string[], empty = 'pending'): string {
  if (statuses.length === 0) return empty;
  return statuses.reduce((winner, status) => statusRank(status) > statusRank(winner) ? status : winner, statuses[0]);
}

function branchRows(projection: BranchMapProjection): BranchMapSheetRow[] {
  return projection.branches.map((branch: BranchMapBranch) => row('branch', `branch:${branch.branchId}`, {
    branchId: branch.branchId,
    nodeId: null,
    organId: null,
    status: branch.authoritativeStatus,
    title: safeText(branch.label || branch.branchId, 100),
    detail: `${branch.nodeIds.length} node${branch.nodeIds.length === 1 ? '' : 's'}`,
    sourceRef: redactBranchMapSourceRef(nodeSource(projection, branch.branchId)),
  }));
}

function organRows(projection: BranchMapProjection): BranchMapSheetRow[] {
  const grouped = new Map<string, { branchId: string; organId: string; organName: string; statuses: string[]; sourceRefs: string[]; nodeIds: string[] }>();
  const ensure = (branchId: string, organId: string, organName: string) => {
    const key = organKey(branchId, organId);
    let value = grouped.get(key);
    if (!value) {
      value = { branchId, organId, organName, statuses: [], sourceRefs: [], nodeIds: [] };
      grouped.set(key, value);
    }
    return value;
  };

  for (const node of projection.nodes) {
    const metadata = isRecord(node.metadata) ? node.metadata : {};
    const metadataOrgan = nonEmpty(metadata.organ) ? metadata.organ : null;
    if (!metadataOrgan) continue;
    const organId = nonEmpty(metadata.organId) ? metadata.organId : `organ:${metadataOrgan.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const value = ensure(node.branchId, organId, metadataOrgan);
    value.statuses.push(node.authoritativeStatus);
    value.sourceRefs.push(node.sourceRef);
    value.nodeIds.push(node.nodeId);
  }
  for (const receipt of projection.receipts) {
    const value = ensure(receipt.branchId, receipt.organId, receipt.organName);
    value.statuses.push(receipt.status);
    value.sourceRefs.push(receipt.sourceRef);
    value.nodeIds.push(receipt.toNodeId);
  }

  return [...grouped.values()].sort((a, b) => `${a.branchId}\u0000${a.organId}`.localeCompare(`${b.branchId}\u0000${b.organId}`)).map((value) => row('organ', `organ:${value.branchId}:${value.organId}`, {
    branchId: value.branchId,
    nodeId: [...new Set(value.nodeIds)].sort()[0] ?? null,
    organId: value.organId,
    status: aggregateStatus(value.statuses),
    title: safeText(value.organName || value.organId, 100),
    detail: `${new Set(value.nodeIds).size} node${new Set(value.nodeIds).size === 1 ? '' : 's'}`,
    sourceRef: redactBranchMapSourceRef([...new Set(value.sourceRefs)].sort()[0] ?? null),
  }));
}

function receiptRows(projection: BranchMapProjection): BranchMapSheetRow[] {
  return [...projection.receipts].sort((a, b) => a.receiptId.localeCompare(b.receiptId)).map((receipt: BranchMapReceipt) => row('receipt', `receipt:${receipt.receiptId}`, {
    branchId: receipt.branchId,
    nodeId: receipt.toNodeId,
    organId: receipt.organId,
    status: receipt.status,
    title: safeText(`${receipt.organName} receipt`, 100),
    detail: safeText(`${receipt.receiptId} · observed ${receipt.observedAt}`, 160),
    sourceRef: redactBranchMapSourceRef(receipt.sourceRef),
  }));
}

function overlayRows(
  projection: BranchMapProjection,
  kind: 'campaign' | 'wiki',
  values: readonly (BranchMapCampaignOverlay | BranchMapWikiOverlay)[],
): BranchMapSheetRow[] {
  return [...values].sort((a, b) => a.overlayId.localeCompare(b.overlayId)).map((overlay) => row(kind, `${kind}:${overlay.overlayId}`, {
    branchId: overlay.branchId,
    nodeId: null,
    organId: null,
    status: overlay.status,
    title: safeText(overlay.label || overlay.overlayId, 100),
    detail: safeText(`${overlay.overlayId} · ${overlay.freshness}`, 160),
    sourceRef: redactBranchMapSourceRef(overlay.sourceRef),
  }));
}

function gapRows(projection: BranchMapProjection): BranchMapSheetRow[] {
  return [...projection.gaps].sort((a, b) => a.gapId.localeCompare(b.gapId)).map((gap: BranchMapGap) => row('gap', `gap:${gap.gapId}`, {
    branchId: gap.branchId,
    nodeId: gap.nodeId,
    organId: null,
    status: gap.kind,
    title: safeText(gap.code.replace(/_/g, ' '), 100),
    detail: safeText(gap.detail, 160),
    sourceRef: redactBranchMapSourceRef(projection.sourceRef),
  }));
}

function buildRows(projection: BranchMapProjection): BranchMapSheetRow[] {
  return [
    ...branchRows(projection),
    ...organRows(projection),
    ...receiptRows(projection),
    ...overlayRows(projection, 'campaign', projection.overlays.campaigns),
    ...overlayRows(projection, 'wiki', projection.overlays.wiki),
    ...gapRows(projection),
  ].sort((a, b) => (ROW_ORDER_INDEX.get(a.kind)! - ROW_ORDER_INDEX.get(b.kind)!) || a.id.localeCompare(b.id));
}

function countRows(rows: readonly BranchMapSheetRow[]): BranchMapSheetCounts {
  return rows.reduce((counts, value) => {
    counts[value.kind] += 1;
    return counts;
  }, { branch: 0, organ: 0, receipt: 0, campaign: 0, wiki: 0, gap: 0 });
}

function rowText(value: BranchMapSheetRow, maxRowLength: number): string {
  const source = value.sourceRef ? ` · source=${value.sourceRef}` : '';
  return safeText(`[${value.kind}] ${value.title} · ${value.status} · ${value.detail}${source}`, maxRowLength);
}

function renderText(
  projection: BranchMapProjection,
  rows: readonly BranchMapSheetRow[],
  maxTextLength: number,
  maxRowLength: number,
  omitted: number,
): string {
  const header = `Branch map · ${safeText(projection.tenantId, 80)} · graph ${safeText(projection.graphVersion, 40)} · generated=${safeText(projection.generatedAt, 40)} · digest=${safeText(projection.projectionDigest, 96)} · source=${redactBranchMapSourceRef(projection.sourceRef) ?? '[REDACTED]'}`;
  const lines = [header];
  for (const value of rows) {
    const line = rowText(value, maxRowLength);
    const candidate = `${lines.join('\n')}\n${line}`;
    if (candidate.length > maxTextLength) break;
    lines.push(line);
  }
  const renderedCount = lines.length - 1;
  const remaining = omitted + rows.length - renderedCount;
  if (remaining > 0) {
    const suffix = `… ${remaining} row${remaining === 1 ? '' : 's'} omitted`;
    while (`${lines.join('\n')}\n${suffix}`.length > maxTextLength && lines.length > 1) lines.pop();
    if (`${lines.join('\n')}\n${suffix}`.length <= maxTextLength) lines.push(suffix);
  }
  return lines.join('\n').slice(0, maxTextLength);
}

function optionLimit(value: number | undefined, fallback: number, field: string, max: number): number {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < 1 || candidate > max) throw new Error(`${field} must be an integer from 1 to ${max}`);
  return candidate;
}

/** Render a validated projection into a deterministic bounded Telegram sheet. */
export function renderBranchMapSheet(
  input: BranchMapProjection,
  options: BranchMapSheetOptions = {},
): BranchMapSheetRenderResult {
  const validated = validateBranchMapProjectionForSheet(input);
  if (!validated.valid || !validated.value) return { accepted: false, status: 'rejected', errors: validated.errors };
  try {
    const maxRows = optionLimit(options.maxRows, BRANCH_MAP_SHEET_MAX_ROWS, 'maxRows', BRANCH_MAP_SHEET_MAX_ROWS);
    const maxTextLength = optionLimit(options.maxTextLength, BRANCH_MAP_SHEET_MAX_TEXT_LENGTH, 'maxTextLength', BRANCH_MAP_SHEET_MAX_TEXT_LENGTH);
    const maxRowLength = optionLimit(options.maxRowLength, BRANCH_MAP_SHEET_MAX_ROW_LENGTH, 'maxRowLength', BRANCH_MAP_SHEET_MAX_ROW_LENGTH);
    const allRows = buildRows(validated.value);
    const rows = allRows.slice(0, maxRows);
    const truncated = rows.length < allRows.length;
    const counts = countRows(rows);
    const text = renderText(validated.value, rows, maxTextLength, maxRowLength, allRows.length - rows.length);
    return {
      accepted: true,
      status: 'accepted',
      sheet: {
        schema: BRANCH_MAP_SHEET_SCHEMA,
        version: BRANCH_MAP_SHEET_VERSION,
        tenantId: validated.value.tenantId,
        graphVersion: validated.value.graphVersion,
        graphDigest: validated.value.graphDigest,
        generatedAt: validated.value.generatedAt,
        projectionDigest: validated.value.projectionDigest,
        sourceRef: redactBranchMapSourceRef(validated.value.sourceRef) ?? '[REDACTED]',
        rows,
        counts,
        truncated,
        text,
      },
    };
  } catch (error) {
    return { accepted: false, status: 'rejected', errors: [error instanceof Error ? error.message : 'invalid branch map sheet options'] };
  }
}

export const buildBranchMapSheet = renderBranchMapSheet;
export const renderTelegramBranchMapSheet = renderBranchMapSheet;
