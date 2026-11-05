// D1 adapter tests. Uses an in-memory SQLite database with the real migrations.
// The owner is a test fake. Nothing here reaches production D1.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { d1NativeLaunchStore } from './native-launch-d1.ts';
import {
  NATIVE_LAUNCH_CONTRACT,
  NATIVE_LAUNCH_PATHS,
  createNativeLaunchHost,
  nativeLaunchHttp,
  nativeLaunchRequestKey,
  type NativeLaunchCapabilityTuple,
  type NativeLaunchExecutionOwner,
  type NativeLaunchOwnerSubmit,
  type NativeLaunchScope,
} from './native-launch.ts';
import type { GoalGraphD1DatabaseLike, GoalGraphD1StatementLike } from './goal-graph-store.ts';

const SCOPE: NativeLaunchScope = { tenantId: 'tenant-alpha', principalId: 'founder-1' };
const NOW = '2026-11-02T00:30:00.000Z';
const DIGEST = `sha256:${'c'.repeat(64)}`;
const NONCE = 'nonce_abcdefghijklmnopqrstuv';
const CAPABILITY: NativeLaunchCapabilityTuple = {
  workId: 'sapling:cambium', admissionRef: 'adm-d1-1', graphVersion: 1, loadoutId: 'loadout-1',
  inputDigest: DIGEST, executionPlant: 'temperance-hands', supportedAction: 'launch',
  expiresAt: '2026-11-02T02:00:00.000Z',
};

class SqliteD1 implements GoalGraphD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');
  failNextInsert = false;

  prepare(sql: string): GoalGraphD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: GoalGraphD1StatementLike = {
      bind: (...next: unknown[]) => { values = next; return api; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => {
        if (this.failNextInsert && /INSERT INTO native_launch_requests/.test(sql)) {
          this.failNextInsert = false;
          throw new Error('D1_ERROR: simulated write failure');
        }
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return api;
  }
}

async function harness(options: { admissionExpires?: string; head?: number } = {}) {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0007_goal_graph.sql', import.meta.url), 'utf8'));
  db.db.exec(await readFile(new URL('../migrations/0099_native_launch_requests.sql', import.meta.url), 'utf8'));
  db.db.prepare(`INSERT INTO goal_graph_heads (tenant_id, graph_version, graph_digest, committed_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`).run(SCOPE.tenantId, options.head ?? 1, `sha256:${'0'.repeat(64)}`, NOW, NOW);
  db.db.prepare(`INSERT INTO native_launch_admissions (tenant_id, admission_ref, principal_id, work_id, graph_version,
    loadout_id, input_digest, execution_plant, supported_action, expires_at, status, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`).run(SCOPE.tenantId, CAPABILITY.admissionRef, SCOPE.principalId,
    CAPABILITY.workId, CAPABILITY.graphVersion, CAPABILITY.loadoutId, CAPABILITY.inputDigest, CAPABILITY.executionPlant,
    CAPABILITY.supportedAction, options.admissionExpires ?? CAPABILITY.expiresAt, NOW);
  return db;
}

class CountingOwner implements NativeLaunchExecutionOwner {
  submits: NativeLaunchOwnerSubmit[] = [];
  reads = 0;
  submitFails = false;
  state: 'queued' | 'running' | 'not_found' = 'queued';
  supports(plant: string, action: string) { return plant === 'temperance-hands' && action === 'launch'; }
  async submit(input: NativeLaunchOwnerSubmit) {
    this.submits.push(input);
    await new Promise(resolve => setTimeout(resolve, 5));
    if (this.submitFails) throw new Error('lost response');
    return { state: 'queued' as const, ownerRef: 'owner-1' };
  }
  async read() { this.reads++; return { state: this.state, ownerRef: 'owner-1' }; }
}

function hostFor(db: SqliteD1, owner: CountingOwner, scope: NativeLaunchScope = SCOPE, now = NOW) {
  return createNativeLaunchHost({
    verify: async req => req.headers.get('authorization') === 'Bearer founder-token' ? scope : null,
    store: d1NativeLaunchStore(db), owner, now: () => now,
  })!;
}

const post = (path: string, body: unknown, token = 'Bearer founder-token') => new Request(`http://worker.test${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: token }, body: JSON.stringify(body),
});
const launch = (requestId = 'client-request-0001', attemptId = 'client-attempt-0001', nonce = NONCE, extra: Record<string, unknown> = {}) => ({
  contractVersion: NATIVE_LAUNCH_CONTRACT, requestId, attemptId, idempotencyNonce: nonce, capability: CAPABILITY, ...extra,
});

function insertAdmission(db: SqliteD1, ref: string, workId = CAPABILITY.workId, extra: {
  principalId?: string; tenantId?: string; expiresAt?: string; status?: string; plant?: string; graph?: number; recordedAt?: string;
} = {}) {
  db.db.prepare(`INSERT INTO native_launch_admissions (tenant_id, admission_ref, principal_id, work_id, graph_version,
    loadout_id, input_digest, execution_plant, supported_action, expires_at, status, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    extra.tenantId ?? SCOPE.tenantId, ref, extra.principalId ?? SCOPE.principalId, workId,
    extra.graph ?? CAPABILITY.graphVersion, CAPABILITY.loadoutId, CAPABILITY.inputDigest,
    extra.plant ?? CAPABILITY.executionPlant, CAPABILITY.supportedAction,
    extra.expiresAt ?? CAPABILITY.expiresAt, extra.status ?? 'active', extra.recordedAt ?? NOW,
  );
}

test('D1 lists only the verified scope and work, with current hold and no writes', async () => {
  const db = await harness();
  insertAdmission(db, 'adm-consumed');
  insertAdmission(db, 'adm-expired', CAPABILITY.workId, { expiresAt: '2026-11-02T00:00:00.000Z' });
  insertAdmission(db, 'adm-revoked', CAPABILITY.workId, { status: 'revoked' });
  insertAdmission(db, 'adm-hermes', CAPABILITY.workId, { plant: 'hermes-remote' });
  insertAdmission(db, 'adm-other-work', 'sapling:other');
  insertAdmission(db, 'adm-foreign', CAPABILITY.workId, { principalId: 'founder-2', tenantId: 'tenant-beta' });
  db.db.prepare(`INSERT INTO goal_graph_heads (tenant_id, graph_version, graph_digest, committed_at, updated_at)
    VALUES ('tenant-beta', 1, ?, ?, ?)`).run(`sha256:${'1'.repeat(64)}`, NOW, NOW);
  insertAdmission(db, 'adm-stale', CAPABILITY.workId, { graph: 4 });
  const owner = new CountingOwner();
  const host = hostFor(db, owner);
  const before = db.db.prepare('SELECT COUNT(*) AS n FROM native_launch_requests').get() as { n: number };
  const admissionsBefore = db.db.prepare('SELECT COUNT(*) AS n FROM native_launch_admissions').get() as { n: number };
  const headsBefore = db.db.prepare('SELECT graph_version FROM goal_graph_heads WHERE tenant_id = ?').get(SCOPE.tenantId) as { graph_version: number };

  const listed = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId,
  }), host);
  const body = await listed.json() as { readOnly: boolean; truncated: boolean; workId: string; admissions: Array<{ admissionRef: string; availability: string; reason: string; existingRequest?: { requestId: string } }> };
  assert.equal(listed.status, 200);
  assert.equal(body.readOnly, true);
  assert.equal(body.truncated, false);
  assert.equal(body.workId, CAPABILITY.workId);
  assert.deepEqual(body.admissions.map(row => [row.admissionRef, row.availability, row.reason]), [
    ['adm-consumed', 'supported', 'current'],
    ['adm-d1-1', 'supported', 'current'],
    ['adm-expired', 'unavailable', 'admission_expired'],
    ['adm-hermes', 'unsupported', 'owner_does_not_support'],
    ['adm-revoked', 'unavailable', 'admission_revoked'],
    ['adm-stale', 'unavailable', 'graph_changed'],
  ]);
  assert.equal(owner.submits.length, 0);
  assert.equal(owner.reads, 0);
  assert.equal((db.db.prepare('SELECT COUNT(*) AS n FROM native_launch_requests').get() as { n: number }).n, before.n);
  assert.equal((db.db.prepare('SELECT COUNT(*) AS n FROM native_launch_admissions').get() as { n: number }).n, admissionsBefore.n);
  assert.equal((db.db.prepare('SELECT graph_version FROM goal_graph_heads WHERE tenant_id = ?').get(SCOPE.tenantId) as { graph_version: number }).graph_version, headsBefore.graph_version);

  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch('client-request-0009', 'client-attempt-0009', 'nonce_consumedconsumedconsumed')), host);
  const after = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId,
  }), host)).json() as { admissions: Array<{ admissionRef: string; availability: string; reason: string; existingRequest?: { requestId: string; attemptId: string } }> };
  const consumed = after.admissions.find(row => row.admissionRef === 'adm-d1-1');
  assert.deepEqual(consumed && { availability: consumed.availability, reason: consumed.reason, existingRequest: consumed.existingRequest }, {
    availability: 'unavailable', reason: 'admission_consumed',
    existingRequest: { requestId: 'client-request-0009', attemptId: 'client-attempt-0009' },
  });

  const foreign = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: 'sapling:missing',
  }), host)).text();
  const absent = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: 'sapling:missing',
  }), host)).text();
  const otherWork = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: 'sapling:other',
  }), hostFor(db, owner, { tenantId: 'tenant-beta', principalId: 'founder-2' }))).text();
  assert.equal(foreign, absent.replace('sapling:absent', 'sapling:missing'));
  assert.match(otherWork, /"admissions":\[\]/);
  assert.equal(JSON.parse(otherWork).admissions.length, 0);
});

test('D1 admission listing is deterministic, bounded at 32 and marks truncation', async () => {
  const db = await harness();
  for (let index = 0; index < 40; index += 1) insertAdmission(db, `adm-${String(index).padStart(2, '0')}`);
  const owner = new CountingOwner();
  const listed = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId,
  }), hostFor(db, owner));
  const body = await listed.json() as { truncated: boolean; admissions: Array<{ admissionRef: string }> };
  assert.equal(body.admissions.length, 32);
  assert.equal(body.truncated, true);
  assert.deepEqual(body.admissions.map(row => row.admissionRef), body.admissions.map(row => row.admissionRef).slice().sort());
  assert.equal(body.admissions[0].admissionRef, 'adm-00');
  assert.equal(body.admissions.at(-1)?.admissionRef, 'adm-31');
  assert.equal(owner.submits.length, 0);
  const again = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId,
  }), hostFor(db, owner))).json() as { admissions: Array<{ admissionRef: string }> };
  assert.deepEqual(again.admissions.map(row => row.admissionRef), body.admissions.map(row => row.admissionRef));
});

test('D1 reservation is one row per admission and returns the same row on canonical replay', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  const host = hostFor(db, owner);
  const first = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  assert.equal(first.status, 202);
  const replay = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  assert.equal((await replay.json() as { status: string }).status, 'duplicate');
  assert.equal(owner.submits.length, 1);
});

test('concurrent launches with different requestIds on one admission call the owner exactly once', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  const host = hostFor(db, owner);
  const responses = await Promise.all([
    nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch('client-request-A', 'client-attempt-A', 'nonce_aaaaaaaaaaaaaaaaaaaaaa')), host),
    nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch('client-request-B', 'client-attempt-B', 'nonce_bbbbbbbbbbbbbbbbbbbbbbbb')), host),
  ]);
  const statuses = responses.map(r => r.status).sort();
  assert.deepEqual(statuses, [202, 409]);
  assert.equal(owner.submits.length, 1);
  assert.equal(db.db.prepare('SELECT count(*) n FROM native_launch_requests').get()?.n, 1);
});

test('concurrent identical launches on the same requestId call the owner exactly once', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  const host = hostFor(db, owner);
  const responses = await Promise.all([
    nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host),
    nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host),
  ]);
  assert.equal(owner.submits.length, 1);
  assert.ok(responses.every(r => r.status === 202 || r.status === 200));
});

test('owner submit receives the durable request key as its idempotency token', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(db, owner));
  assert.equal(owner.submits[0].idempotencyToken, nativeLaunchRequestKey(SCOPE, 'client-request-0001'));
  assert.equal(owner.submits[0].idempotencyToken, owner.submits[0].requestKey);
});

test('lost owner response then status readback reconciles without a second dispatch', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  owner.submitFails = true;
  const host = hostFor(db, owner);
  const lost = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  assert.equal(lost.status, 503);
  const durable = db.db.prepare('SELECT dispatch, execution FROM native_launch_requests').get() as { dispatch: string; execution: string };
  assert.deepEqual([durable.dispatch, durable.execution], ['owner_unknown', 'unknown']);

  owner.submitFails = false;
  owner.state = 'running';
  const status = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001',
  }), host);
  const json = await status.json() as { execution: { state: string } };
  assert.equal(json.execution.state, 'running');
  assert.equal(owner.submits.length, 1);
  const retry = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  assert.equal(retry.status, 200);
  assert.equal(owner.submits.length, 1);
});

test('restart with a durable row reads the same request and status without re-reserving', async () => {
  const db = await harness();
  const first = new CountingOwner();
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(db, first));

  const restarted = new CountingOwner();
  restarted.state = 'running';
  const host = hostFor(db, restarted);
  const status = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001',
  }), host);
  assert.equal((await status.json() as { execution: { state: string } }).execution.state, 'running');
  assert.equal(restarted.submits.length, 0);
  const relaunch = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  assert.equal((await relaunch.json() as { status: string }).status, 'duplicate');
  assert.equal(restarted.submits.length, 0);
});

test('changed pins, nonce, attempt or a second requestId on a consumed admission refuse', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  const host = hostFor(db, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  const pin = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, { ...launch(), capability: { ...CAPABILITY, loadoutId: 'other' } }), host);
  assert.equal((await pin.json() as { code: string }).code, 'request_changed');
  const attempt = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch('client-request-0001', 'client-attempt-ZZ', NONCE)), host);
  assert.equal((await attempt.json() as { code: string }).code, 'request_changed');
  const second = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch('client-request-0002', 'client-attempt-0002', 'nonce_zzzzzzzzzzzzzzzzzzzzzzzz')), host);
  assert.equal((await second.json() as { code: string }).code, 'admission_consumed');
  assert.equal(owner.submits.length, 1);
});

test('stale graph head, expired and revoked admissions refuse before any owner call', async () => {
  const stale = await harness({ head: 2 });
  const staleOwner = new CountingOwner();
  const staleRes = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(stale, staleOwner));
  assert.equal((await staleRes.json() as { code: string }).code, 'graph_changed');
  assert.equal(staleOwner.submits.length, 0);

  const expired = await harness({ admissionExpires: '2026-11-02T00:00:00.000Z' });
  const expiredOwner = new CountingOwner();
  const expiredRes = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(expired, expiredOwner, SCOPE, NOW));
  assert.equal((await expiredRes.json() as { code: string }).code, 'admission_expired');
  assert.equal(expiredOwner.submits.length, 0);

  const revoked = await harness();
  revoked.db.prepare("UPDATE native_launch_admissions SET status = 'revoked'").run();
  const revokedOwner = new CountingOwner();
  const revokedRes = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(revoked, revokedOwner));
  assert.equal((await revokedRes.json() as { code: string }).code, 'admission_revoked');
  assert.equal(revokedOwner.submits.length, 0);
});

test('foreign principal cannot reserve or read another principal admission', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  const intruder = { tenantId: SCOPE.tenantId, principalId: 'founder-2' };
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(db, owner, intruder));
  assert.equal((await res.json() as { code: string }).code, 'admission_not_current');
  const cap = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef }), hostFor(db, owner, intruder));
  assert.match(await cap.text(), /no_admission/);
  assert.equal(owner.submits.length, 0);
});

test('persistence failure before submit calls no owner and does not leak store text', async () => {
  const db = await harness();
  db.failNextInsert = true;
  const owner = new CountingOwner();
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(db, owner));
  const text = await res.text();
  assert.equal(res.status, 503);
  assert.equal(owner.submits.length, 0);
  assert.doesNotMatch(text, /D1_ERROR|simulated|stack/);
});

test('admission pins are immutable and requests cannot be deleted in D1', async () => {
  const db = await harness();
  assert.throws(() => db.db.prepare('UPDATE native_launch_admissions SET loadout_id = ?').run('changed'), /immutable/);
  assert.throws(() => db.db.prepare("UPDATE native_launch_admissions SET status = 'active'").run(), /may only be revoked/);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), hostFor(db, new CountingOwner()));
  assert.throws(() => db.db.prepare('DELETE FROM native_launch_requests').run(), /retained/);
  assert.throws(() => db.db.prepare("UPDATE native_launch_requests SET request_key = 'hacked'").run(), /identity is immutable/);
});

test('terminal execution cannot be overwritten by a later owner observation', async () => {
  const db = await harness();
  const owner = new CountingOwner();
  const host = hostFor(db, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launch()), host);
  db.db.prepare("UPDATE native_launch_requests SET execution = 'failed'").run();
  owner.state = 'running';
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001',
  }), host);
  assert.equal(db.db.prepare('SELECT execution FROM native_launch_requests').get()?.execution, 'failed');
});
