// Generate synthetic signal wire responses through the real handler, native
// scope resolution, current catalog and local SQLite migration. No live calls.
// Output is explicitly selected and temporary; no credentials leave the process.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve, join } from 'node:path';
import { handle, type HandlerDeps } from '../../../../../workers/quests/src/handler.ts';
import { createNativeSessionHost } from '../../../../../workers/quests/src/native-session.ts';
import { d1SharedSignalStore } from '../../../../../workers/quests/src/shared-signals-d1.ts';
import { PORTFOLIO_CATALOG } from '../../../../../workers/quests/src/portfolio-catalog.ts';

const output = process.env.CAMBIUM_SIGNALS_FIXTURE_DIR;
if (!output) throw Error('Explicit temporary output directory required');
mkdirSync(output, { recursive: true });
const now = '2026-11-03T00:00:00.000Z';
const scope = { founderId: 'synthetic-signal-founder', tenantId: 'cambium',
  clientId: 'space.thoughtseed.cambium.native.dev', expiresAt: '2026-11-03T01:00:00.000Z' };
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(resolve('workers/quests/migrations/0102_shared_signals.sql'), 'utf8'));
const d1 = {
  prepare(sql: string) {
    const statement = db.prepare(sql); let values: any[] = [];
    return {
      bind(...next: any[]) { values = next; return this; },
      async first<T>() { return (statement.get(...values) as T | undefined) ?? null; },
      async all<T>() { return { results: statement.all(...values) as T[] }; },
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
    };
  },
};
const nativeSessionHost = createNativeSessionHost({
  ownerOrigin: 'https://signals.example.invalid',
  clients: [{ clientId: scope.clientId, redirectUri: `${scope.clientId}://oauth/callback` }],
  verifyBrowserFounder: async () => null,
  resolveFounderAccess: async () => ({ role: 'founder', enrolledTenants: ['cambium'] }),
  now: () => now, randomBytes: n => crypto.getRandomValues(new Uint8Array(n)),
  store: { saveCode: async () => {}, peekCode: async () => null, grant: async () => false,
    readSession: async () => scope, revoke: async () => false },
  consent: { save: async () => {}, consume: async () => false },
});
assert.ok(nativeSessionHost);
const deps = { kv: { get: async () => null, put: async () => {} },
  nativeSessionHost, sharedSignalStore: d1SharedSignalStore(d1), now: () => now } as HandlerDeps;
const headers = { host: 'signals.example.invalid', authorization: `Bearer cns1_${'A'.repeat(43)}` };
async function call(method: string, path: string, body?: unknown) {
  return handle({ method, path, headers, ...(body ? { body: JSON.stringify(body) } : {}) }, deps);
}
function save(name: string, value: unknown) {
  writeFileSync(join(output!, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}
try {
  assert.ok(PORTFOLIO_CATALOG.records.some(r => r.workId === 'sapling:cambium'));
  const input = { schema: 'cambium.signal-capture.v1', operationId: 'synthetic-wire-capture',
    title: 'Synthetic integration signal', body: 'Contract verification only.',
    source: { system: 'field-report', recordId: 'synthetic-observation', version: '1', reference: null, observedAt: now },
    projectIds: ['sapling:cambium'] };
  const created = await call('POST', '/v1/signals/cambium', input);
  assert.equal(created.status, 201, String(created.body));
  const original = JSON.parse(String(created.body));
  save('signals-created', original);
  const replay = await call('POST', '/v1/signals/cambium', input);
  assert.equal(replay.status, 200); save('signals-replayed', JSON.parse(String(replay.body)));
  const changed = await call('PUT', `/v1/signals/cambium/${original.signal.id}`, {
    schema: 'cambium.signal-update.v1', operationId: 'synthetic-wire-update', expectedRevision: 1,
    title: 'Updated integration signal', body: input.body, projectIds: input.projectIds,
  });
  assert.equal(changed.status, 200, String(changed.body));
  save('signals-updated', JSON.parse(String(changed.body)));
  const listed = await call('GET', '/v1/signals/cambium?projectId=sapling%3Acambium');
  assert.equal(listed.status, 200); save('signals-list', JSON.parse(String(listed.body)));
  const detail = await call('GET', `/v1/signals/cambium/${original.signal.id}`);
  assert.equal(detail.status, 200); save('signals-detail', JSON.parse(String(detail.body)));
  const forbidden = await call('GET', '/v1/signals/foreign');
  assert.equal(forbidden.status, 403);
  console.log(JSON.stringify({ schema: 'cambium.signal-wire-probe.v1', synthetic: true,
    localSQLite: true, currentCatalogRecords: PORTFOLIO_CATALOG.records.length,
    exactProject: 'sapling:cambium', capture: created.status, replay: replay.status,
    update: changed.status, list: listed.status, detail: detail.status, foreignTenant: forbidden.status }));
} finally { db.close(); }
