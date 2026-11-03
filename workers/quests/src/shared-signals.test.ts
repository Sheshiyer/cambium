import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { handle } from './handler.ts';
import { d1SharedSignalStore } from './shared-signals-d1.ts';
import { PORTFOLIO_CATALOG, PORTFOLIO_DISPLAY_CATALOG } from './portfolio-catalog.ts';
import { sharedSignalsHttp } from './shared-signals.ts';

const now = '2026-11-03T00:00:00.000Z';
const token = 'cns1_0123456789abcdef0123456789abcdef0123456789a';
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0102_shared_signals.sql', import.meta.url), 'utf8'));
  const d1 = { prepare(sql: string) { const statement = db.prepare(sql); let args: any[] = []; return {
    bind(...values: any[]) { args = values; return this; },
    async first<T>() { return (statement.get(...args) as T) ?? null; },
    async all<T>() { return { results: statement.all(...args) as T[] }; },
    async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
  }; } };
  let authorized = true;
  const nativeSessionHost: any = { deps: { ownerOrigin: 'https://cambium.test', now: () => now,
    store: { readSession: async () => ({ founderId: 'founder-1', tenantId: 'cambium', clientId: 'client-1', expiresAt: '2026-11-04T00:00:00.000Z' }) },
    currentRole: async () => authorized ? 'founder' : null, enrolledTenants: async () => ['cambium'] }, client: () => ({}) };
  const deps: any = { kv: {}, nativeSessionHost, sharedSignalStore: d1SharedSignalStore(d1), now: () => now };
  const call = (method: string, path: string, payload?: any, extra: Record<string, string> = {}) => handle({ method, path,
    headers: { host: 'cambium.test', authorization: `Bearer ${token}`, ...extra }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }, deps);
  const capture = (operationId: string, projectIds = ['sapling:cambium']) => ({ schema: 'cambium.signal-capture.v1', operationId,
    title: 'A signal', body: 'Evidence', source: { system: 'field-report', recordId: operationId, version: '1', reference: null, observedAt: now }, projectIds });
  return { db, deps, call, capture, revoke: () => { authorized = false; } };
}
const parsed = (response: any) => JSON.parse(response.body);

test('signal associations support the same dynamic display catalog the native picker receives', async () => {
  const h = setup();
  const actionIds = new Set(PORTFOLIO_CATALOG.records.map(record => record.workId));
  const sourceOnly = PORTFOLIO_DISPLAY_CATALOG.records.filter(record => !actionIds.has(record.workId));
  assert.ok(sourceOnly.length > 0);
  for (const [index, record] of sourceOnly.entries()) {
    const saved = await h.call('POST', '/v1/signals/cambium', h.capture(`source-link-${index}`, [record.workId]));
    assert.equal(saved.status, 201, String(saved.body));
    assert.deepEqual(parsed(saved).signal.projectIds, [record.workId]);
    assert.equal('admission' in parsed(saved).signal, false);
  }
  assert.equal((await h.call('POST', '/v1/signals/cambium', h.capture('invented', ['sapling:not-in-catalog']))).status, 400);
});

test('capture, replay, revisions, scoped reads and immutable provenance use atomic receipts', async () => {
  const h = setup(); const input = h.capture('capture-1');
  const created = await h.call('POST', '/v1/signals/cambium', input);
  assert.equal(created.status, 201, String(created.body)); const signal = parsed(created).signal;
  assert.equal(signal.revision, 1); assert.equal(signal.source.system, 'field-report');
  const replay = await h.call('POST', '/v1/signals/cambium', input);
  assert.equal(replay.status, 200); assert.equal(parsed(replay).replayed, true); assert.deepEqual(parsed(replay).signal, signal);
  assert.equal((await h.call('POST', '/v1/signals/cambium', { ...input, body: 'changed' })).status, 409);
  assert.equal((await h.call('GET', `/v1/signals/other/${signal.id}`)).status, 403);
  const beforeRead = (h.db.prepare('SELECT total_changes() n').get() as any).n;
  assert.equal((await h.call('GET', `/v1/signals/cambium/${signal.id}`)).status, 200);
  assert.equal((await h.call('GET', '/v1/signals/cambium')).status, 200);
  assert.equal((h.db.prepare('SELECT total_changes() n').get() as any).n, beforeRead);
  const originalRead = h.deps.nativeSessionHost.deps.store.readSession;
  h.deps.nativeSessionHost.deps.store.readSession = async () => ({ ...(await originalRead()), founderId: 'founder-2' });
  assert.equal((await h.call('GET', `/v1/signals/cambium/${signal.id}`)).status, 404);
  h.deps.nativeSessionHost.deps.store.readSession = originalRead;
  const update = { schema: 'cambium.signal-update.v1', operationId: 'update-1', expectedRevision: 1, title: 'Updated', body: 'Body', projectIds: [] };
  const [a, b] = await Promise.all([h.call('PUT', `/v1/signals/cambium/${signal.id}`, update), h.call('PUT', `/v1/signals/cambium/${signal.id}`, { ...update, operationId: 'update-2' })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const winner = a.status === 200 ? update : { ...update, operationId: 'update-2' };
  const again = await h.call('PUT', `/v1/signals/cambium/${signal.id}`, winner);
  assert.equal(parsed(again).replayed, true); assert.deepEqual(parsed(again).signal.source, signal.source);
  assert.equal(Number((h.db.prepare('SELECT count(*) n FROM shared_signal_operations').get() as any).n), 2);
  h.revoke(); assert.equal((await h.call('GET', '/v1/signals/cambium')).status, 403);
});

test('revalidation before mutation refuses a revoked identity and simultaneous replay remains one record', async () => {
  const h = setup(); let lookups = 0;
  h.deps.nativeSessionHost.deps.currentRole = async () => ++lookups === 1 ? 'founder' : null;
  assert.equal((await h.call('POST', '/v1/signals/cambium', h.capture('revoked'))).status, 403);
  assert.equal(Number((h.db.prepare('SELECT count(*) n FROM shared_signals').get() as any).n), 0);
  h.deps.nativeSessionHost.deps.currentRole = async () => 'founder';
  const input = h.capture('race');
  const responses = await Promise.all([h.call('POST', '/v1/signals/cambium', input), h.call('POST', '/v1/signals/cambium', input)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  assert.equal(parsed(responses[0]).signal.id, parsed(responses[1]).signal.id);
  assert.equal(Number((h.db.prepare('SELECT count(*) n FROM shared_signal_operations').get() as any).n), 1);
  assert.equal(Number((h.db.prepare('SELECT count(*) n FROM shared_signals').get() as any).n), 1);
});

test('capture and update receipts replay after catalog removal, while new or changed operations fail', async () => {
  const h = setup();
  const invoke = (method: string, path: string, payload: unknown, catalog: string[]) => sharedSignalsHttp({ method, path,
    headers: { host: 'cambium.test', authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }, h.deps, new Set(catalog));
  const capture = h.capture('capture-before-removal');
  const created = await invoke('POST', '/v1/signals/cambium', capture, ['sapling:cambium']);
  assert.equal(created.status, 201);
  const signal = parsed(created).signal;
  const update = { schema: 'cambium.signal-update.v1', operationId: 'update-before-removal', expectedRevision: 1,
    title: 'Updated', body: 'Evidence', projectIds: ['sapling:cambium'] };
  const updated = await invoke('PUT', `/v1/signals/cambium/${signal.id}`, update, ['sapling:cambium']);
  assert.equal(updated.status, 200);
  const capturedReplay = await invoke('POST', '/v1/signals/cambium', capture, []);
  const updateReplay = await invoke('PUT', `/v1/signals/cambium/${signal.id}`, update, []);
  assert.equal(capturedReplay.status, 200); assert.equal(parsed(capturedReplay).replayed, true);
  assert.deepEqual(parsed(capturedReplay).signal, signal);
  assert.equal(updateReplay.status, 200); assert.equal(parsed(updateReplay).replayed, true);
  assert.deepEqual(parsed(updateReplay).signal, parsed(updated).signal);
  assert.equal((await invoke('POST', '/v1/signals/cambium', { ...capture, body: 'changed' }, [])).status, 409);
  assert.equal((await invoke('PUT', `/v1/signals/cambium/${signal.id}`, { ...update, body: 'changed' }, [])).status, 409);
  assert.equal((await invoke('POST', '/v1/signals/cambium', h.capture('new-after-removal'), [])).status, 400);
  h.revoke();
  assert.equal((await invoke('POST', '/v1/signals/cambium', capture, [])).status, 403);
});

test('source references reject query strings and fragments, including signed credentials', async () => {
  const h = setup();
  for (const reference of ['https://example.test/path?X-Amz-Signature=secret', 'https://example.test/path?X-Goog-Credential=secret',
    'https://example.test/path#access_token=secret', 'https://example.test/path?', 'https://example.test/path#']) {
    const input = h.capture('reference'); input.source.reference = reference as any;
    assert.equal((await h.call('POST', '/v1/signals/cambium', input)).status, 400, reference);
  }
  const input = h.capture('clean-reference'); input.source.reference = 'https://example.test/path' as any;
  assert.equal((await h.call('POST', '/v1/signals/cambium', input)).status, 201);
});

test('pagination, catalog filters and invalid inputs fail closed', async () => {
  const h = setup();
  for (let i = 0; i < 102; i++) assert.equal((await h.call('POST', '/v1/signals/cambium', h.capture(`op-${i}`, i % 2 ? [] : ['sapling:cambium']))).status, 201);
  const first = parsed(await h.call('GET', '/v1/signals/cambium'));
  assert.equal(first.signals.length, 100); assert.ok(first.nextCursor);
  const second = parsed(await h.call('GET', `/v1/signals/cambium?cursor=${first.nextCursor}`));
  assert.equal(second.signals.length, 2); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.signals, ...second.signals].map((s: any) => s.id)).size, 102);
  const filtered = parsed(await h.call('GET', '/v1/signals/cambium?projectId=sapling%3Acambium'));
  assert.equal(filtered.signals.length, 51);
  assert.equal((await h.call('GET', '/v1/signals/cambium?cursor=garbage')).status, 400);
  assert.equal((await h.call('GET', '/v1/signals/cambium?projectId=sapling%3Abogus')).status, 400);
  for (const payload of [{ ...h.capture('bad'), projectIds: ['sapling:bogus'] }, { ...h.capture('bad'), extra: true },
    { ...h.capture('bad'), source: { ...h.capture('bad').source, reference: 'https://user:pass@example.com/' } },
    { ...h.capture('bad'), source: { ...h.capture('bad').source, observedAt: '2026-02-30T00:00:00.000Z' } }]) {
    assert.equal((await h.call('POST', '/v1/signals/cambium', payload)).status, 400);
  }
});

test('missing auth/store, mixed credentials and unsupported native routes refuse', async () => {
  const h = setup();
  for (const project of ['sapling:cambium', 'sapling:not-in-catalog']) {
    assert.equal((await h.call('GET', `/v1/signals/cambium?projectId=${encodeURIComponent(project)}`, undefined, { authorization: '' })).status, 401);
  }
  assert.equal((await h.call('GET', '/v1/signals/cambium', undefined, { 'x-principal': 'fake' })).status, 400);
  assert.equal((await h.call('GET', '/v1/signals/cambium', undefined, { 'x-api-key': 'fake' })).status, 400);
  assert.equal((await h.call('GET', '/healthz')).status, 403);
  h.deps.sharedSignalStore = undefined;
  assert.equal((await h.call('GET', '/v1/signals/cambium')).status, 503);
  h.deps.nativeSessionHost = undefined;
  assert.equal((await h.call('GET', '/v1/signals/cambium')).status, 503);
});
