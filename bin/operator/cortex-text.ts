export type CortexTextAudience = 'founder' | 'workspace' | 'member';

export interface CortexTextScope {
  tenantId: string;
  projectId: string;
  sourcePlane: string;
  audience: CortexTextAudience;
  memberId?: string;
}

export interface CortexTextRequest extends CortexTextScope {
  query: string;
  limit?: number;
  maxCharacters?: number;
}

export type CortexTextAvailability = 'available' | 'empty' | 'unavailable' | 'denied' | 'stale';

export interface CortexTextCitation {
  uri: string;
  sha256: string;
}

export interface CortexTextItem {
  id: string;
  text: string;
  citations: CortexTextCitation[];
  rank: number;
}

export interface CortexTextResult {
  schema: 'cortex.text-recall.v1';
  availability: CortexTextAvailability;
  scope: CortexTextScope;
  authorityTier: 'projection';
  effectsAuthorized: false;
  retrievedAt: string;
  items: CortexTextItem[];
  reason?: string;
}

export interface CortexTextStore {
  recall(request: CortexTextRequest): Promise<CortexTextResult>;
}

export interface CortexTextHttpStoreOptions {
  endpoint: string;
  token: string;
  scope: CortexTextScope;
  fetch?: typeof globalThis.fetch;
}

export const MAX_ITEMS = 8;
export const MAX_CHARACTERS = 8000;
export const MAX_RESPONSE_BYTES = 128 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;

const SCHEMA = 'cortex.text-recall.v1';
const SCOPE_KEYS = ['tenantId', 'projectId', 'sourcePlane', 'audience', 'memberId'];
const SCOPE_KEY_SET = new Set(SCOPE_KEYS);
const REQUEST_KEYS = new Set([...SCOPE_KEYS, 'query', 'limit', 'maxCharacters']);
const RESULT_KEYS = new Set(['schema', 'availability', 'scope', 'authorityTier', 'effectsAuthorized', 'retrievedAt', 'items', 'reason']);
const ITEM_KEYS = new Set(['id', 'text', 'citations', 'rank']);
const CITATION_KEYS = new Set(['uri', 'sha256']);
const AUDIENCES = new Set<string>(['founder', 'workspace', 'member']);
const AVAILABILITY = new Set<string>(['available', 'empty', 'unavailable', 'denied', 'stale']);
const SHA256 = /^[0-9a-f]{64}$/;
const LOGICAL_URI = /^(?:vault|atlas|receipt):\/\/[A-Za-z0-9][A-Za-z0-9._~\/:#-]{0,511}$/;
const UNKNOWN_SCOPE: CortexTextScope = { tenantId: 'unknown', projectId: 'unknown', sourcePlane: 'unknown', audience: 'founder' };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const bounded = (v: unknown, max = 256): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const validUri = (v: unknown): v is string => typeof v === 'string' && LOGICAL_URI.test(v) && !v.includes('..');
const hasOnlyKeys = (v: Rec, allowed: Set<string>): boolean => Object.keys(v).every((k) => allowed.has(k));

export function isCortexTextScope(v: unknown): v is CortexTextScope {
  if (!isRec(v) || !hasOnlyKeys(v, SCOPE_KEY_SET)) return false;
  if (!bounded(v.tenantId) || !bounded(v.projectId) || !bounded(v.sourcePlane)) return false;
  if (typeof v.audience !== 'string' || !AUDIENCES.has(v.audience)) return false;
  if (v.audience === 'member') return bounded(v.memberId);
  return v.memberId === undefined;
}

export function copyScope(scope: CortexTextScope): Readonly<CortexTextScope> {
  const copy: CortexTextScope = {
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    sourcePlane: scope.sourcePlane,
    audience: scope.audience,
  };
  if (scope.memberId !== undefined) copy.memberId = scope.memberId;
  return Object.freeze(copy);
}

function sameScope(a: CortexTextScope, b: CortexTextScope): boolean {
  return (
    a.tenantId === b.tenantId &&
    a.projectId === b.projectId &&
    a.sourcePlane === b.sourcePlane &&
    a.audience === b.audience &&
    a.memberId === b.memberId
  );
}

function build(
  scope: CortexTextScope,
  availability: CortexTextAvailability,
  items: CortexTextItem[] = [],
  reason?: string,
  retrievedAt = new Date().toISOString(),
): CortexTextResult {
  const result: CortexTextResult = {
    schema: SCHEMA,
    availability,
    scope: copyScope(scope),
    authorityTier: 'projection',
    effectsAuthorized: false,
    retrievedAt,
    items,
  };
  if (reason !== undefined) result.reason = reason;
  return result;
}

export function validateEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('invalid endpoint');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const schemeOk = url.protocol === 'https:' || (url.protocol === 'http:' && loopback);
  if (!schemeOk || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new Error('invalid endpoint');
  }
  return url;
}

async function readLimited(response: Response, limit: number): Promise<string | null> {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > limit) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try { for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally { reader.releaseLock(); }
}

function parseItem(v: unknown): CortexTextItem | undefined {
  if (!isRec(v) || !hasOnlyKeys(v, ITEM_KEYS)) return undefined;
  const { id, text, rank, citations } = v;
  if (!bounded(id) || !bounded(text, MAX_CHARACTERS) || !Number.isSafeInteger(rank) || Number(rank) < 1) return undefined;
  if (!Array.isArray(citations) || citations.length < 1 || citations.length > 8) return undefined;
  const parsed: CortexTextCitation[] = [];
  for (const c of citations) {
    if (!isRec(c) || !hasOnlyKeys(c, CITATION_KEYS)) return undefined;
    const { uri, sha256 } = c;
    if (!validUri(uri) || typeof sha256 !== 'string' || !SHA256.test(sha256)) return undefined;
    parsed.push({ uri, sha256 });
  }
  return { id, text, citations: parsed, rank: Number(rank) };
}

function parseResponse(bound: CortexTextScope, raw: unknown, limit: number, maxChars: number): CortexTextResult {
  const malformed = () => build(bound, 'unavailable', [], 'malformed response');
  if (!isRec(raw) || !hasOnlyKeys(raw, RESULT_KEYS)) return malformed();
  const { schema, scope, authorityTier, effectsAuthorized, retrievedAt, availability, items } = raw;
  if (schema !== SCHEMA) return malformed();
  if (authorityTier !== 'projection' || effectsAuthorized !== false) {
    return build(bound, 'denied', [], 'authority mismatch');
  }
  if (!isCortexTextScope(scope) || !sameScope(scope, bound)) return build(bound, 'denied', [], 'scope mismatch');
  if (typeof retrievedAt !== 'string' || Number.isNaN(Date.parse(retrievedAt))) return malformed();
  if (typeof availability !== 'string' || !AVAILABILITY.has(availability) || !Array.isArray(items)) return malformed();
  if (availability !== 'available' && availability !== 'empty') {
    if (items.length !== 0) return malformed();
    return build(bound, availability as CortexTextAvailability, [], undefined, retrievedAt);
  }
  if (availability === 'empty' && items.length !== 0) return malformed();
  if (availability === 'available' && items.length === 0) return malformed();
  const kept: CortexTextItem[] = [];
  let budget = Math.min(maxChars, MAX_CHARACTERS);
  for (const entry of items.slice(0, limit)) {
    const item = parseItem(entry);
    if (!item) return malformed();
    if (budget <= 0) break;
    const text = item.text.slice(0, budget);
    budget -= text.length;
    kept.push({ ...item, text });
  }
  return build(bound, kept.length > 0 ? 'available' : 'empty', kept, undefined, retrievedAt);
}

export function createCortexTextHttpStore(options: CortexTextHttpStoreOptions): CortexTextStore {
  if (!isCortexTextScope(options.scope)) throw new Error('invalid scope');
  if (typeof options.token !== 'string' || !/^[!-~]{8,4096}$/.test(options.token)) throw new Error('invalid token');
  const bound = copyScope(options.scope);
  const target = `${validateEndpoint(options.endpoint).href.replace(/\/+$/, '')}/v1/recall`;
  const { token } = options;

  const send = async (request: CortexTextRequest): Promise<CortexTextResult> => {
    const req: unknown = request;
    if (!isRec(req) || !hasOnlyKeys(req, REQUEST_KEYS)) return build(bound, 'denied', [], 'invalid request');
    const requested = {
      tenantId: req.tenantId,
      projectId: req.projectId,
      sourcePlane: req.sourcePlane,
      audience: req.audience,
      memberId: req.memberId,
    };
    if (!isCortexTextScope(requested) || !sameScope(requested, bound)) {
      return build(bound, 'denied', [], 'scope mismatch');
    }
    const query = req.query;
    const limit = req.limit ?? 2;
    const maxCharacters = req.maxCharacters ?? 1200;
    if (typeof query !== 'string' || query.trim() === '' || query.length > 1000 || query.includes(token)) {
      return build(bound, 'denied', [], 'invalid request');
    }
    if (!isInt(limit, 1, MAX_ITEMS) || !isInt(maxCharacters, 1, MAX_CHARACTERS)) {
      return build(bound, 'denied', [], 'invalid request');
    }

    const doFetch = options.fetch ?? globalThis.fetch;
    let response: Response;
    try {
      response = await doFetch(target, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...bound, query, limit, maxCharacters }),
      });
    } catch {
      return build(bound, 'unavailable', [], 'network error');
    }
    if (!response.ok) return build(bound, 'unavailable', [], 'http error');
    const text = await readLimited(response, MAX_RESPONSE_BYTES);
    if (text === null) return build(bound, 'unavailable', [], 'response too large');
    if (text.includes(token)) return build(bound, 'unavailable', [], 'credential echo rejected');
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return build(bound, 'unavailable', [], 'malformed response');
    }
    return parseResponse(bound, raw, limit, maxCharacters);
  };

  return {
    async recall(request) {
      try {
        return await send(request);
      } catch {
        return build(bound, 'unavailable', [], 'internal error');
      }
    },
  };
}

export async function recallCortexText(
  store: CortexTextStore,
  scope: CortexTextScope,
  tenantId: string,
  query: string,
): Promise<CortexTextResult> {
  const shown = isCortexTextScope(scope) ? scope : UNKNOWN_SCOPE;
  if (shown === UNKNOWN_SCOPE || shown.tenantId !== tenantId) {
    return build(shown, 'denied', [], 'tenant mismatch');
  }
  try {
    const result = await store.recall({ ...copyScope(shown), query, limit: 2, maxCharacters: 1200 });
    return parseResponse(shown, result, 2, 1200);
  } catch {
    return build(shown, 'unavailable', [], 'recall failed');
  }
}
