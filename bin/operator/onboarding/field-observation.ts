// Pure local intake. Field Report snapshot/activity semantics inform this contract;
// this is not its deployed API or an activity.py execution packet.
import { createHash } from 'node:crypto';

export const FIELD_OBSERVATION_SCHEMA = 'cambium.onboarding.field-observation.v1';
export const FIELD_PROPOSAL_SCHEMA = 'cambium.onboarding.field-proposal.v1';
export const FIELD_REPORT_SITE = 'https://field-report.witnessalchemist.chatgpt.site';
const KINDS = ['product', 'draft', 'repository', 'host', 'board', 'idea', 'editorial', 'workItem'];
const DIGEST_TYPES = ['source-sha256', 'receipt-sha256', 'payload-fingerprint-sha256'];

export interface FieldObservation {
  schema: typeof FIELD_OBSERVATION_SCHEMA;
  source: { site: string; repository: 'Sheshiyer/field-report'; sourceVersion: string; schemaReference: string };
  selectedRecord: { kind: string; id: string };
  observedAt: string;
  sourceEvidence: { reference: string; digest?: { type: 'source-sha256' | 'receipt-sha256' | 'payload-fingerprint-sha256'; value: string } };
  freshness: { cached: boolean; stale: boolean; sourceStatus: string };
  intendedOutcome: string;
  evidenceGaps: string[];
  canonicalWorkObject?: { reference: string; verificationReference: string; verificationDigest: string };
}

function fail(field: string): never { throw new Error(`Invalid field observation: ${field}`); }
function object(value: unknown, keys: string[], required = keys): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('object');
  const v = value as Record<string, any>;
  if (Object.keys(v).some(k => !keys.includes(k)) || required.some(k => !Object.hasOwn(v, k))) return fail('fields');
  return v;
}
function text(value: unknown, field: string, max = 1000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) fail(field);
}
function reference(value: unknown, field: string): void {
  text(value, field);
  let url: URL;
  try { url = new URL(value); } catch { return fail(field); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search) fail(field);
}
function sha(value: unknown, field: string): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(field);
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}

/** Validates caller-selected provenance, never verifies remote truth or admits operational work. */
export function compileFieldObservation(value: unknown) {
  const v = object(value, ['schema', 'source', 'selectedRecord', 'observedAt', 'sourceEvidence', 'freshness', 'intendedOutcome', 'evidenceGaps', 'canonicalWorkObject'],
    ['schema', 'source', 'selectedRecord', 'observedAt', 'sourceEvidence', 'freshness', 'intendedOutcome', 'evidenceGaps']);
  if (v.schema !== FIELD_OBSERVATION_SCHEMA) fail('schema');
  const source = object(v.source, ['site', 'repository', 'sourceVersion', 'schemaReference']);
  if (source.site !== FIELD_REPORT_SITE || source.repository !== 'Sheshiyer/field-report') fail('source identity');
  if (typeof source.sourceVersion !== 'string' || !/^[a-f0-9]{40}$/.test(source.sourceVersion)) fail('sourceVersion');
  reference(source.schemaReference, 'schemaReference');
  const schemaUrl = new URL(source.schemaReference);
  if (schemaUrl.origin !== 'https://github.com' || schemaUrl.hash
    || !schemaUrl.pathname.startsWith(`/Sheshiyer/field-report/blob/${source.sourceVersion}/`)
    || schemaUrl.pathname.endsWith('/')) fail('schema version reference');
  const record = object(v.selectedRecord, ['kind', 'id']);
  if (!KINDS.includes(record.kind)) fail('record kind');
  text(record.id, 'record id', 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(record.id)) fail('record id');
  if (typeof v.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.observedAt)
    || !Number.isFinite(Date.parse(v.observedAt)) || new Date(v.observedAt).toISOString() !== v.observedAt) fail('observedAt');
  const evidence = object(v.sourceEvidence, ['reference', 'digest'], ['reference']);
  reference(evidence.reference, 'source reference');
  if ('digest' in evidence) {
    const digest = object(evidence.digest, ['type', 'value']);
    if (!DIGEST_TYPES.includes(digest.type)) fail('digest type');
    sha(digest.value, 'digest value');
  }
  const freshness = object(v.freshness, ['cached', 'stale', 'sourceStatus']);
  if (typeof freshness.cached !== 'boolean' || typeof freshness.stale !== 'boolean') fail('freshness');
  text(freshness.sourceStatus, 'sourceStatus', 200);
  text(v.intendedOutcome, 'intendedOutcome', 2000);
  if (!Array.isArray(v.evidenceGaps) || v.evidenceGaps.length > 20) fail('evidenceGaps');
  v.evidenceGaps.forEach((gap: unknown) => text(gap, 'evidence gap', 500));
  if ('canonicalWorkObject' in v) {
    const work = object(v.canonicalWorkObject, ['reference', 'verificationReference', 'verificationDigest']);
    if (typeof work.reference !== 'string' || !/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._/-]{0,199}$/.test(work.reference)) fail('WorkObject reference');
    reference(work.verificationReference, 'WorkObject verification reference');
    sha(work.verificationDigest, 'WorkObject verification digest');
  }
  const holds = ['deployed-api-compatibility-unverified', 'source-truth-unverified', 'tenant-unresolved', 'operational-admission-held'];
  if (!v.canonicalWorkObject) holds.push('canonical-work-object-unresolved');
  else holds.push('work-object-verification-requires-authority-readback');
  if (freshness.cached) holds.push('cached-observation');
  if (freshness.stale) holds.push('stale-observation');
  if (evidence.digest?.type !== 'source-sha256') holds.push('underlying-source-sha-unverified');
  const proposal = {
    schema: FIELD_PROPOSAL_SCHEMA,
    observation: structuredClone(v) as FieldObservation,
    sourceIds: [`${record.kind}:${record.id}`],
    authority: 'proposal-only' as const,
    status: 'awaiting-human-review' as const,
    admitted: false as const,
    executionAllowed: false as const,
    holds,
  };
  // Same sorted-key SHA-256 integrity convention as activity.py; distinct packet schema.
  return { ...proposal, fingerprint: createHash('sha256').update(JSON.stringify(canonical(proposal))).digest('hex') };
}
