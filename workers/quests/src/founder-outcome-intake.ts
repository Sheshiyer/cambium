import { createHash } from 'node:crypto';

export type FounderObservedOutcome = 'passed' | 'failed' | 'blocked' | 'needs-review';

export interface FounderOutcomeIntent {
  schema: 'cambium.founder-outcome-intent.v1';
  tenantId: 'cambium';
  workObjectId: 'sapling:fitcheck';
  branchId: 'fitcheck';
  missionId: 'fitcheck-shopify-qa';
  questId: 'fitcheck-shopify-widget-qa';
  outcome: FounderObservedOutcome;
  screenshotRef: string;
  widgetEventRef: string;
  note?: string;
  clientRequestId: string;
}

export interface FounderOutcomeAccepted {
  accepted: true;
  rejected: false;
  status: 'accepted';
  value: FounderOutcomeIntent;
  canonical: string;
  contentDigest: string;
  idempotencyKey: string;
  replayKey: string;
  errors: readonly [];
}

export interface FounderOutcomeRejected {
  accepted: false;
  rejected: true;
  status: 'rejected';
  code: 'malformed_input' | 'identity_mismatch' | 'unknown_key' | 'forbidden_key' | 'bounds_exceeded' | 'unsafe_reference' | 'unsafe_note';
  errors: readonly string[];
}

export type FounderOutcomeParseResult = FounderOutcomeAccepted | FounderOutcomeRejected;

export interface FounderOutcomeTransition {
  tenantId: 'cambium';
  namespace: 'fitcheck-founder-outcome';
  scope: 'proof';
  workObjectId: 'sapling:fitcheck';
  workObjectKind: 'sapling';
  branchId: 'fitcheck';
  missionId: 'fitcheck-shopify-qa';
  questId: 'fitcheck-shopify-widget-qa';
  pinnedLoadoutId: 'loadout:fitcheck-launch';
  parentNodeId: string;
  externalId: string;
  desiredState: 'Record the founder-observed Fitcheck Shopify QA outcome.';
  nextAction: 'Review the founder-submitted evidence candidate in Gate.';
  waitCondition: 'Await founder-approved Goal Graph commit.';
  status: 'active' | 'blocked' | 'paused';
  proofRequired: boolean;
  outcome: FounderObservedOutcome;
  metadata: {
    screenshotRef: string;
    widgetEventRef: string;
    clientRequestId: string;
    note?: string;
  };
}

const FIXED_FIELDS = {
  schema: 'cambium.founder-outcome-intent.v1',
  tenantId: 'cambium',
  workObjectId: 'sapling:fitcheck',
  branchId: 'fitcheck',
  missionId: 'fitcheck-shopify-qa',
  questId: 'fitcheck-shopify-widget-qa',
} as const;

const REQUIRED_KEYS = [
  'schema', 'tenantId', 'workObjectId', 'branchId', 'missionId', 'questId',
  'outcome', 'screenshotRef', 'widgetEventRef', 'clientRequestId',
] as const;
const ALLOWED_KEYS = new Set([...REQUIRED_KEYS, 'note']);
const FORBIDDEN_KEYS = new Set(['initData', 'initDataUnsafe', 'authorization', 'token', 'secret', 'password', 'rawPayload', 'payload']);
const OUTCOMES = new Set<FounderObservedOutcome>(['passed', 'failed', 'blocked', 'needs-review']);
const MAX_REFERENCE_LENGTH = 1024;
const MAX_NOTE_LENGTH = 2048;
const MAX_REQUEST_ID_LENGTH = 192;
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,191}$/;
const SAFE_OPAQUE_REFERENCE = /^(?:receipt|event):[A-Za-z0-9][A-Za-z0-9._:/-]{0,1023}$/;
const SAFE_PARENT_NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,511}$/;
const SECRET_MATERIAL = /(?:\bbearer\s+|\b(?:api[-_]?key|auth(?:orization)?|token|secret|password|signature|x-amz-signature)\s*[=:]|\binitdata\s*=|\bquery_id\s*=|\bhash\s*=)/i;
const LOCAL_PATH = /(?:^|\s)(?:file:|\/private\/|\/users\/|\/tmp\/|[a-z]:[\\/])/i;
const LOCAL_URL_PATH = /(?:file:|\/private\/|\/users\/|\/tmp\/|[a-z]:[\\/])/i;

type ProofReferenceKind = 'screenshot' | 'widget-event';

function rejected(code: FounderOutcomeRejected['code'], error: string): FounderOutcomeRejected {
  return { accepted: false, rejected: true, status: 'rejected', code, errors: [error] };
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value as Record<string, unknown> : null;
}

function normalizedText(value: unknown, field: string, maxLength: number): string | FounderOutcomeRejected {
  if (typeof value !== 'string') return rejected('malformed_input', `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) return rejected('malformed_input', `${field} must not be empty`);
  if (normalized.length > maxLength) return rejected('bounds_exceeded', `${field} exceeds its maximum length`);
  return normalized;
}

function unsafeText(value: string): boolean {
  return SECRET_MATERIAL.test(value) || LOCAL_PATH.test(value) || /^[{[]/.test(value);
}

function decodedUrlComponent(value: string): string | null {
  let decoded = value;
  for (let index = 0; index < 4; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return next;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}

function unsafeUrlComponent(value: string): boolean {
  const decoded = decodedUrlComponent(value);
  return decoded === null || SECRET_MATERIAL.test(decoded) || LOCAL_URL_PATH.test(decoded) || /[{[]/.test(decoded);
}

function isOpaqueReferenceKind(value: string, kind: ProofReferenceKind): boolean {
  if (!SAFE_OPAQUE_REFERENCE.test(value)) return false;
  const opaque = value.toLowerCase();
  if (kind === 'screenshot') return opaque.startsWith('receipt:') && opaque.includes('screenshot') && !opaque.includes('event');
  return (opaque.startsWith('receipt:') || opaque.startsWith('event:')) && opaque.includes('widget') && opaque.includes('event');
}

function isHttpsReferenceKind(url: URL, kind: ProofReferenceKind): boolean {
  const path = decodedUrlComponent(url.pathname);
  if (!path) return false;
  const normalizedPath = path.toLowerCase();
  return kind === 'screenshot'
    ? normalizedPath.includes('screenshot')
    : normalizedPath.includes('widget') && normalizedPath.includes('event');
}

function safeReference(value: string, kind: ProofReferenceKind): boolean {
  if (unsafeText(value)) return false;
  if (isOpaqueReferenceKind(value, kind)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) return false;
    if (unsafeUrlComponent(url.pathname)) return false;
    for (const [key, queryValue] of url.searchParams) {
      if (/(?:token|secret|password|signature|auth|key|hash|initdata|query_id|payload|event|user)/i.test(key)
        || unsafeUrlComponent(queryValue)) return false;
    }
    return isHttpsReferenceKind(url, kind);
  } catch {
    return false;
  }
}

function canonicalJson(value: Record<string, unknown>): string {
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`).join(',')}}`;
}

export function parseFounderOutcomeIntent(input: unknown): FounderOutcomeParseResult {
  try {
    const record = asPlainRecord(input);
    if (!record) return rejected('malformed_input', 'input must be a plain object');
    for (const key of Object.keys(record)) {
      if (FORBIDDEN_KEYS.has(key)) return rejected('forbidden_key', `${key} is not accepted`);
      if (!ALLOWED_KEYS.has(key)) return rejected('unknown_key', `${key} is not accepted`);
    }
    for (const key of REQUIRED_KEYS) {
      if (!(key in record)) return rejected('malformed_input', `${key} is required`);
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, expected] of Object.entries(FIXED_FIELDS)) {
      const value = normalizedText(record[key], key, 128);
      if (typeof value !== 'string') return value;
      if (value !== expected) return rejected('identity_mismatch', `${key} does not match the Fitcheck pilot`);
      normalized[key] = value;
    }
    const outcome = normalizedText(record.outcome, 'outcome', 32);
    if (typeof outcome !== 'string') return outcome;
    if (!OUTCOMES.has(outcome as FounderObservedOutcome)) return rejected('malformed_input', 'outcome is not supported');
    const screenshotRef = normalizedText(record.screenshotRef, 'screenshotRef', MAX_REFERENCE_LENGTH);
    if (typeof screenshotRef !== 'string') return screenshotRef;
    const widgetEventRef = normalizedText(record.widgetEventRef, 'widgetEventRef', MAX_REFERENCE_LENGTH);
    if (typeof widgetEventRef !== 'string') return widgetEventRef;
    if (!safeReference(screenshotRef, 'screenshot') || !safeReference(widgetEventRef, 'widget-event')) return rejected('unsafe_reference', 'references must be safe, correctly typed HTTPS or opaque receipt pointers');
    const clientRequestId = normalizedText(record.clientRequestId, 'clientRequestId', MAX_REQUEST_ID_LENGTH);
    if (typeof clientRequestId !== 'string') return clientRequestId;
    if (!SAFE_REQUEST_ID.test(clientRequestId)) return rejected('malformed_input', 'clientRequestId is not a safe opaque identifier');

    let note: string | undefined;
    if (record.note !== undefined) {
      const normalizedNote = normalizedText(record.note, 'note', MAX_NOTE_LENGTH);
      if (typeof normalizedNote !== 'string') return normalizedNote;
      if (unsafeText(normalizedNote)) return rejected('unsafe_note', 'note contains unsafe material');
      note = normalizedNote;
    }
    const value: FounderOutcomeIntent = {
      ...normalized as Pick<FounderOutcomeIntent, keyof typeof FIXED_FIELDS>,
      outcome: outcome as FounderObservedOutcome,
      screenshotRef,
      widgetEventRef,
      ...(note === undefined ? {} : { note }),
      clientRequestId,
    };
    const canonical = canonicalJson(value as unknown as Record<string, unknown>);
    const contentDigest = `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
    const idempotencyKey = `founder-outcome:v1:${value.tenantId}:${value.workObjectId}:${value.questId}:${value.clientRequestId}`;
    return {
      accepted: true,
      rejected: false,
      status: 'accepted',
      value,
      canonical,
      contentDigest,
      idempotencyKey,
      replayKey: `founder-outcome:v1:${value.tenantId}:${value.clientRequestId}:${contentDigest}`,
      errors: [],
    };
  } catch {
    return rejected('malformed_input', 'input could not be parsed safely');
  }
}

export function deriveFounderOutcomeTransition(value: FounderOutcomeIntent, parentNodeId: string): FounderOutcomeTransition {
  const parent = typeof parentNodeId === 'string' ? parentNodeId.trim() : '';
  if (!SAFE_PARENT_NODE_ID.test(parent) || parent.includes('..')) throw new TypeError('parentNodeId must be a bounded safe node identity');
  const status = value.outcome === 'passed' ? 'active' : value.outcome === 'needs-review' ? 'paused' : 'blocked';
  const canonical = canonicalJson(value as unknown as Record<string, unknown>);
  const contentDigest = `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
  return {
    tenantId: 'cambium',
    namespace: 'fitcheck-founder-outcome',
    scope: 'proof',
    workObjectId: 'sapling:fitcheck',
    workObjectKind: 'sapling',
    branchId: 'fitcheck',
    missionId: 'fitcheck-shopify-qa',
    questId: 'fitcheck-shopify-widget-qa',
    pinnedLoadoutId: 'loadout:fitcheck-launch',
    parentNodeId: parent,
    externalId: `founder-outcome:fitcheck-shopify-widget-qa:${value.clientRequestId}:${contentDigest}`,
    desiredState: 'Record the founder-observed Fitcheck Shopify QA outcome.',
    nextAction: 'Review the founder-submitted evidence candidate in Gate.',
    waitCondition: 'Await founder-approved Goal Graph commit.',
    status,
    proofRequired: value.outcome !== 'passed',
    outcome: value.outcome,
    metadata: {
      screenshotRef: value.screenshotRef,
      widgetEventRef: value.widgetEventRef,
      clientRequestId: value.clientRequestId,
      ...(value.note === undefined ? {} : { note: value.note }),
    },
  };
}
