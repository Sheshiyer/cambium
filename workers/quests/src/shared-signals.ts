import { resolveComposedNativeSession } from './native-session-composition.ts';
import type { HandlerDeps, SimpleRequest, SimpleResponse } from './handler.ts';

export interface SignalScope { tenantId: string; principal: string }
export interface Signal extends SignalScope {
  id: string; title: string; body: string;
  source: { system: string; recordId: string; version: string; reference: string | null; observedAt: string };
  projectIds: string[]; revision: number; createdAt: string; updatedAt: string;
}
export interface SignalStore {
  read(scope: SignalScope, id: string): Promise<Signal | null>;
  receipt(scope: SignalScope, operationId: string): Promise<{request: string; result: string} | null>;
  list(scope: SignalScope, projectId: string | null, cursor: {createdAt: string; id: string} | null): Promise<Signal[]>;
  write(scope: SignalScope, operationId: string, request: string, signal: Signal, expectedRevision: number): Promise<'written' | 'replay' | 'operation_conflict' | 'revision_conflict'>;
}
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', pragma: 'no-cache', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
const respond = (status: number, body: unknown): SimpleResponse => ({ status, headers, body: JSON.stringify(body) });
const error = (status: number, code: string) => respond(status, { error: code });
const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const identifier = (v: unknown) => text(v, 128) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v as string);
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function reference(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== 'string' || v.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(v)) return false;
  try { const url = new URL(v); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    && !v.includes('?') && !v.includes('#'); } catch { return false; }
}
function cursorEncode(signal: Signal): string { return btoa(JSON.stringify({ createdAt: signal.createdAt, id: signal.id })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function cursorDecode(value: string): { createdAt: string; id: string } | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) return null;
  try { const v = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/'))); return object(v) && exact(v, ['createdAt', 'id']) && date(v.createdAt) && identifier(v.id) ? v as {createdAt: string; id: string} : null; } catch { return null; }
}

export async function sharedSignalsHttp(req: SimpleRequest, deps: HandlerDeps, catalog: ReadonlySet<string>): Promise<SimpleResponse> {
  const match = /^\/v1\/signals\/([a-z][a-z0-9-]{1,63})(?:\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127}))?$/.exec(req.path.split('?')[0]);
  if (!match || req.path.includes('#') || /%(?![0-9a-fA-F]{2})/.test(req.path)) return error(400, 'invalid_request');
  let url: URL;
  try { url = new URL(req.path, 'https://cambium.invalid'); } catch { return error(400, 'invalid_request'); }
  if ([...url.searchParams.keys()].some(k => !['projectId', 'cursor'].includes(k)) || [...url.searchParams.keys()].some(k => url.searchParams.getAll(k).length !== 1)) return error(400, 'invalid_request');
  const projectId = url.searchParams.get('projectId');
  const cursorText = url.searchParams.get('cursor');
  const cursor = cursorText === null ? null : cursorDecode(cursorText);
  if ((cursorText !== null && !cursor) || (projectId !== null && !text(projectId, 128)) || (match[2] && url.search) || (req.method !== 'GET' && url.search)) return error(400, 'invalid_request');
  if (['cookie', 'x-api-key', 'x-auth-token', 'x-access-token', 'proxy-authorization'].some(name => (req.headers[name] ?? '').trim())) return error(400, 'mixed_credentials');
  const resolved = await resolveComposedNativeSession(req, deps.nativeSessionHost);
  if (resolved.kind === 'refused') return 'status' in resolved ? error(resolved.status, resolved.error) : error(resolved.response.status, resolved.response.status === 401 ? 'unauthorized' : resolved.response.status === 403 ? 'forbidden' : resolved.response.status === 400 ? 'mixed_credentials' : 'native_session_unavailable');
  if (resolved.kind !== 'native') return error(401, 'native_session_required');
  if (resolved.scope.tenantId !== match[1]) return error(403, 'tenant_mismatch');
  // Catalog membership is protected source metadata; validate it only after
  // resolving the authenticated scope, so guesses cannot enumerate projects.
  if (projectId !== null && !catalog.has(projectId)) return error(400, 'invalid_request');
  const scope = { tenantId: resolved.scope.tenantId, principal: resolved.scope.founderId };
  const store = deps.sharedSignalStore;
  if (!store) return error(503, 'signal_store_unavailable');
  try {
    if (req.method === 'GET') {
      if (match[2]) { const signal = await store.read(scope, match[2]); return signal ? respond(200, { schema: 'cambium.signal-result.v1', ...scope, signal, replayed: false }) : error(404, 'signal_not_found'); }
      const signals = await store.list(scope, projectId, cursor);
      const page = signals.slice(0, 100);
      return respond(200, { schema: 'cambium.signal-list.v1', ...scope, signals: page, nextCursor: signals.length > 100 ? cursorEncode(page[page.length - 1]) : null });
    }
    if (!((req.method === 'POST' && !match[2]) || (req.method === 'PUT' && match[2]))) return error(405, 'method_not_allowed');
    if (!req.body || new TextEncoder().encode(req.body).length > 65536) return error(400, 'invalid_request');
    let payload: unknown; try { payload = JSON.parse(req.body); } catch { return error(400, 'invalid_request'); }
    const update = req.method === 'PUT';
    if (!object(payload) || !exact(payload, update ? ['schema', 'operationId', 'expectedRevision', 'title', 'body', 'projectIds'] : ['schema', 'operationId', 'title', 'body', 'source', 'projectIds'])
      || payload.schema !== (update ? 'cambium.signal-update.v1' : 'cambium.signal-capture.v1') || !text(payload.operationId, 128)
      || !text(payload.title, 200) || typeof payload.body !== 'string' || payload.body.length > 16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(payload.body)
      || !Array.isArray(payload.projectIds) || payload.projectIds.length > 16 || new Set(payload.projectIds).size !== payload.projectIds.length
      || !payload.projectIds.every((id: unknown) => typeof id === 'string' && text(id, 128))
      || (update && (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 1))) return error(400, 'invalid_request');
    if (!update && (!object(payload.source) || !exact(payload.source, ['system', 'recordId', 'version', 'reference', 'observedAt'])
      || !['cambium-native', 'field-report'].includes(payload.source.system) || !text(payload.source.recordId, 128)
      || !text(payload.source.version, 128) || !reference(payload.source.reference) || !date(payload.source.observedAt))) return error(400, 'invalid_request');
    // Canonical request includes the target, so an operation cannot be replayed on another signal.
    const canonical = update
      ? { schema: payload.schema, operationId: payload.operationId, expectedRevision: payload.expectedRevision, title: payload.title, body: payload.body, projectIds: payload.projectIds }
      : { schema: payload.schema, operationId: payload.operationId, title: payload.title, body: payload.body,
          source: { system: payload.source.system, recordId: payload.source.recordId, version: payload.source.version, reference: payload.source.reference, observedAt: payload.source.observedAt }, projectIds: payload.projectIds };
    const request = JSON.stringify({ method: req.method, target: match[2] ?? null, payload: canonical });
    const previous = await store.receipt(scope, payload.operationId);
    if (previous) return previous.request === request ? respond(200, { schema: 'cambium.signal-result.v1', ...scope, signal: JSON.parse(previous.result), replayed: true }) : error(409, 'operation_conflict');
    if (!payload.projectIds.every((id: string) => catalog.has(id))) return error(400, 'invalid_request');
    const current = update ? await store.read(scope, match[2]!) : null;
    if (update && !current) return error(404, 'signal_not_found');
    if (current && current.revision !== payload.expectedRevision) return error(409, 'revision_conflict');
    const now = (deps.now ?? (() => new Date().toISOString()))();
    if (!date(now)) return error(503, 'signal_store_unavailable');
    const signal: Signal = { id: current?.id ?? crypto.randomUUID(), ...scope, title: payload.title, body: payload.body,
      source: current?.source ?? payload.source, projectIds: payload.projectIds, revision: (current?.revision ?? 0) + 1,
      createdAt: current?.createdAt ?? now, updatedAt: now };
    const again = await resolveComposedNativeSession(req, deps.nativeSessionHost);
    if (again.kind !== 'native' || again.tokenDigest !== resolved.tokenDigest || again.scope.founderId !== scope.principal || again.scope.tenantId !== scope.tenantId || again.scope.clientId !== resolved.scope.clientId) return error(403, 'authorization_changed');
    const result = await store.write(scope, payload.operationId, request, signal, current?.revision ?? 0);
    if (result === 'operation_conflict' || result === 'revision_conflict') return error(409, result);
    if (result === 'replay') { const saved = await store.receipt(scope, payload.operationId); if (!saved || saved.request !== request) return error(409, 'operation_conflict'); return respond(200, { schema: 'cambium.signal-result.v1', ...scope, signal: JSON.parse(saved.result), replayed: true }); }
    return respond(update ? 200 : 201, { schema: 'cambium.signal-result.v1', ...scope, signal, replayed: false });
  } catch { return error(503, 'signal_store_unavailable'); }
}
