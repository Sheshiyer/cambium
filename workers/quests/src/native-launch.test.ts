// Protocol and transport tests for the native launch owner contract.
// Uses in-test fakes for store and owner only. Nothing here is production.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NATIVE_LAUNCH_ADMISSION_LIST_LIMIT,
  NATIVE_LAUNCH_CONTRACT,
  NATIVE_LAUNCH_MAX_BODY_BYTES,
  NATIVE_LAUNCH_PATHS,
  createNativeLaunchHost,
  nativeLaunchHttp,
  nativeLaunchRequestKey,
  nativeLaunchRequestDigest,
  validCapabilityTuple,
  type NativeLaunchAdmissionList,
  type NativeLaunchAdmissionRead,
  type NativeLaunchCapabilityTuple,
  type NativeLaunchExecutionOwner,
  type NativeLaunchHost,
  type NativeLaunchObservation,
  type NativeLaunchOwnerSubmit,
  type NativeLaunchRequestRow,
  type NativeLaunchReservation,
  type NativeLaunchReserveResult,
  type NativeLaunchScope,
  type NativeLaunchStore,
} from './native-launch.ts';

const SCOPE: NativeLaunchScope = { tenantId: 'tenant-alpha', principalId: 'founder-1' };
const NOW = '2026-11-02T00:00:00.000Z';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const CAPABILITY: NativeLaunchCapabilityTuple = {
  workId: 'sapling:cambium',
  admissionRef: 'adm-123',
  graphVersion: 1,
  loadoutId: 'loadout-alpha',
  inputDigest: DIGEST,
  executionPlant: 'temperance-hands',
  supportedAction: 'launch',
  expiresAt: '2026-11-02T01:00:00.000Z',
};
const NONCE = 'nonce_abcdefghijklmnopqrstuv';

class FakeStore implements NativeLaunchStore {
  admissions = new Map<string, { tuple: NativeLaunchCapabilityTuple; principalId: string; tenantId: string; status: 'active' | 'revoked' }>();
  rows = new Map<string, NativeLaunchRequestRow>();
  failReserve = false;

  seedAdmission(tuple = CAPABILITY, status: 'active' | 'revoked' = 'active', principalId = SCOPE.principalId, tenantId = SCOPE.tenantId) {
    this.admissions.set(`${tenantId}:${tuple.admissionRef}`, { tuple, principalId, tenantId, status });
  }

  async readAdmission(scope: NativeLaunchScope, admissionRef: string, now: string): Promise<NativeLaunchAdmissionRead | null> {
    const adm = this.admissions.get(`${scope.tenantId}:${admissionRef}`);
    if (!adm || adm.principalId !== scope.principalId) return null;
    const consumed = [...this.rows.values()].find(r => r.tenantId === scope.tenantId && r.admissionRef === admissionRef);
    const hold = adm.status !== 'active' ? 'admission_revoked'
      : adm.tuple.expiresAt <= now ? 'admission_expired'
      : consumed ? 'admission_consumed' : null;
    return {
      admission: { ...adm.tuple, tenantId: scope.tenantId, principalId: scope.principalId, status: adm.status },
      hold,
      consumedBy: consumed ? { requestId: consumed.requestId, attemptId: consumed.attemptId } : null,
    };
  }

  async reserve(input: NativeLaunchReservation): Promise<NativeLaunchReserveResult> {
    if (this.failReserve) throw new Error('disk I/O failure with secret detail');
    const same = this.rows.get(input.requestKey);
    if (same) return same.requestDigest === input.requestDigest ? { status: 'duplicate', row: same } : { status: 'conflict', code: 'request_changed' };
    const read = await this.readAdmission(input, input.capability.admissionRef, input.now);
    if (!read) return { status: 'refused', code: 'admission_not_current' };
    if (read.hold === 'admission_consumed') return { status: 'conflict', code: 'admission_consumed' };
    if (read.hold) return { status: 'refused', code: read.hold };
    const row: NativeLaunchRequestRow = {
      ...input.capability, requestKey: input.requestKey, tenantId: input.tenantId, principalId: input.principalId,
      requestId: input.requestId, attemptId: input.attemptId, idempotencyNonce: input.idempotencyNonce,
      requestDigest: input.requestDigest, dispatch: 'reserved', execution: 'unknown', ownerRef: null,
      reservedAt: input.now, observedAt: null,
    };
    this.rows.set(row.requestKey, row);
    return { status: 'reserved', row };
  }

  async readRequest(scope: NativeLaunchScope, requestId: string) {
    return [...this.rows.values()].find(r => r.tenantId === scope.tenantId && r.principalId === scope.principalId && r.requestId === requestId) ?? null;
  }

  async recordObservation(scope: NativeLaunchScope, requestKey: string, o: NativeLaunchObservation) {
    const r = this.rows.get(requestKey);
    if (!r || r.tenantId !== scope.tenantId || r.principalId !== scope.principalId) return null;
    if (!['succeeded', 'failed', 'refused', 'busy'].includes(r.execution)) {
      Object.assign(r, { execution: o.execution === 'unknown' ? r.execution : o.execution, dispatch: o.dispatch, ownerRef: o.ownerRef ?? r.ownerRef, observedAt: o.observedAt });
    }
    return { ...r };
  }
}

class FakeOwner implements NativeLaunchExecutionOwner {
  submits: NativeLaunchOwnerSubmit[] = [];
  reads = 0;
  submitFails = false;
  state: 'queued' | 'running' | 'succeeded' | 'not_found' = 'queued';

  supports(plant: string, action: string) { return plant === 'temperance-hands' && action === 'launch'; }

  async submit(input: NativeLaunchOwnerSubmit) {
    this.submits.push(input);
    if (this.submitFails) throw new Error('connection reset after owner may have accepted');
    return { state: 'queued' as const, ownerRef: 'owner-1' };
  }

  async read(_input: unknown) {
    this.reads++;
    return { state: this.state, ownerRef: 'owner-1' };
  }
}

const verifier = (scope: NativeLaunchScope | null) => async (req: Request) =>
  req.headers.get('authorization') === 'Bearer founder-token' ? scope : null;

function hostOf(store: NativeLaunchStore, owner: NativeLaunchExecutionOwner, scope: NativeLaunchScope | null = SCOPE, now = NOW) {
  return createNativeLaunchHost({ verify: verifier(scope), store, owner, now: () => now })!;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://worker.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer founder-token', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function launchBody(overrides: Record<string, unknown> = {}, capability: Partial<NativeLaunchCapabilityTuple> = {}) {
  return {
    contractVersion: NATIVE_LAUNCH_CONTRACT,
    requestId: 'client-request-0001',
    attemptId: 'client-attempt-0001',
    idempotencyNonce: NONCE,
    capability: { ...CAPABILITY, ...capability },
    ...overrides,
  };
}

test('factory returns no host unless every server dependency is injected', () => {
  const store = new FakeStore();
  const owner = new FakeOwner();
  assert.equal(createNativeLaunchHost({ store, owner, now: () => NOW }), undefined);
  assert.equal(createNativeLaunchHost({ verify: verifier(SCOPE), owner, now: () => NOW }), undefined);
  assert.equal(createNativeLaunchHost({ verify: verifier(SCOPE), store: {} as NativeLaunchStore, owner, now: () => NOW }), undefined);
});

test('unconfigured host closes every route with 503 and no store or owner call', async () => {
  for (const path of Object.values(NATIVE_LAUNCH_PATHS)) {
    const res = await nativeLaunchHttp(post(path, { contractVersion: NATIVE_LAUNCH_CONTRACT }), undefined);
    assert.equal(res.status, 503, path);
    assert.equal((await res.json() as { error: string }).error, 'native_launch_unconfigured');
  }
});

test('missing or foreign credentials return 401 before any store read', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const host = hostOf(store, owner, null);
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  assert.equal(res.status, 401);
  assert.equal(store.rows.size, 0);
  assert.equal(owner.submits.length, 0);
});

test('body identity fields are ignored and cannot choose a tenant or principal', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch,
    launchBody({ tenantId: 'tenant-beta', principalId: 'someone-else' })), hostOf(store, owner));
  assert.equal(res.status, 400);
  assert.equal(owner.submits.length, 0);
});

test('transport rejects wrong method, media type, extra keys and oversized bodies', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const host = hostOf(store, new FakeOwner());
  assert.equal((await nativeLaunchHttp(new Request(`http://worker.test${NATIVE_LAUNCH_PATHS.launch}`, { method: 'GET', headers: { authorization: 'Bearer founder-token' } }), host)).status, 405);
  assert.equal((await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody(), { 'content-type': 'text/plain' }), host)).status, 415);
  assert.equal((await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody({ extra: true })), host)).status, 400);
  const big = JSON.stringify(launchBody({ padding: 'x'.repeat(NATIVE_LAUNCH_MAX_BODY_BYTES) }));
  assert.equal((await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, big), host)).status, 413);
  assert.equal((await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, '{not json'), host)).status, 400);
  assert.equal((await nativeLaunchHttp(new Request(`http://worker.test/v1/native/launch/other`, { method: 'POST' }), host)).status, 404);
  assert.equal(store.rows.size, 0);
});

test('admission discovery lists the verified work and refuses a store that cannot list', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  store.seedAdmission({ ...CAPABILITY, admissionRef: 'adm-old', expiresAt: '2026-11-01T00:00:00.000Z' });
  store.seedAdmission({ ...CAPABILITY, admissionRef: 'adm-hermes', executionPlant: 'hermes-remote' });
  const owner = new FakeOwner();
  const host = hostOf(store, owner);
  const listed = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId,
  }), host);
  assert.equal(listed.status, 503);
  assert.equal((await listed.json() as { error: string }).error, 'native_launch_listing_unconfigured');
  assert.equal(store.rows.size, 0);
  assert.equal(owner.submits.length, 0);

  store.listAdmissions = async (scope, workId, now, limit): Promise<NativeLaunchAdmissionList> => {
    assert.equal(limit, NATIVE_LAUNCH_ADMISSION_LIST_LIMIT);
    const rows = [];
    for (const [key, admission] of [...store.admissions.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (admission.tenantId !== scope.tenantId || admission.principalId !== scope.principalId || admission.tuple.workId !== workId) continue;
      const found = await store.readAdmission(scope, admission.tuple.admissionRef, now);
      if (found) rows.push(found);
      void key;
    }
    return { rows: rows.slice(0, limit), truncated: rows.length > limit };
  };
  const body = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId,
  }), host)).json() as { readOnly: boolean; admissions: Array<{ admissionRef: string; availability: string; reason: string }> };
  assert.equal(body.readOnly, true);
  assert.deepEqual(body.admissions.map(row => [row.admissionRef, row.availability, row.reason]), [
    ['adm-123', 'supported', 'current'],
    ['adm-hermes', 'unsupported', 'owner_does_not_support'],
    ['adm-old', 'unavailable', 'admission_expired'],
  ]);
  const malformed = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, principalId: SCOPE.principalId,
  }), host);
  assert.equal(malformed.status, 400);
  assert.equal((await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, {
    contractVersion: NATIVE_LAUNCH_CONTRACT, workId: 'not a work',
  }), host)).status, 400);
  assert.equal((await nativeLaunchHttp(new Request(`http://worker.test${NATIVE_LAUNCH_PATHS.admissions}`, {
    method: 'GET', headers: { authorization: 'Bearer founder-token' },
  }), host)).status, 405);
  assert.equal(owner.submits.length, 0);
  assert.equal(store.rows.size, 0);
});

test('admission listing with a missing row array or non-boolean truncation is 503, never an empty work', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const host = hostOf(store, owner);
  const bodyFor = { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId };
  const broken: Array<() => Promise<NativeLaunchAdmissionList>> = [
    async () => ({ truncated: false } as unknown as NativeLaunchAdmissionList),
    async () => ({ rows: undefined, truncated: false } as unknown as NativeLaunchAdmissionList),
    async () => ({ rows: [], truncated: undefined } as unknown as NativeLaunchAdmissionList),
    async () => undefined as unknown as NativeLaunchAdmissionList,
  ];
  for (const list of broken) {
    store.listAdmissions = async () => list();
    const response = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.admissions, bodyFor), host);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { error: string }).error, 'native_launch_listing_unavailable');
  }
});

test('capability reports supported for the exact server-owned admission', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef }), hostOf(store, new FakeOwner()));
  const json = await res.json() as { capability: string; tuple: NativeLaunchCapabilityTuple };
  assert.equal(json.capability, 'supported');
  assert.deepEqual(json.tuple, CAPABILITY);
});

test('capability hides foreign, missing and mismatched-work admissions identically', async () => {
  const store = new FakeStore();
  store.seedAdmission(CAPABILITY, 'active', 'founder-2');
  const host = hostOf(store, new FakeOwner());
  const foreign = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef }), host)).text();
  const missing = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: 'adm-none' }), host)).text();
  assert.equal(foreign, missing);
  assert.match(foreign, /no_admission/);
});

test('capability reports unsupported and unavailable without inventing eligibility', async () => {
  const store = new FakeStore();
  store.seedAdmission({ ...CAPABILITY, executionPlant: 'hermes-remote' });
  const host = hostOf(store, new FakeOwner());
  const unsupported = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef }), host)).json() as { capability: string };
  assert.equal(unsupported.capability, 'unsupported');

  store.seedAdmission({ ...CAPABILITY, admissionRef: 'adm-old', expiresAt: '2026-11-01T00:00:00.000Z' });
  const expired = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: 'adm-old' }), host)).json() as { capability: string; reason: string };
  assert.deepEqual([expired.capability, expired.reason], ['unavailable', 'admission_expired']);

  store.seedAdmission({ ...CAPABILITY, admissionRef: 'adm-revoked' }, 'revoked');
  const revoked = await (await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.capability, { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: 'adm-revoked' }), host)).json() as { reason: string };
  assert.equal(revoked.reason, 'admission_revoked');
});

test('launch reserves before one owner submit that carries the durable request identity', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), hostOf(store, owner));
  assert.equal(res.status, 202);
  const json = await res.json() as { status: string; request: { requestKey: string }; execution: { state: string }; acceptance: { state: string } };
  assert.equal(json.status, 'recorded');
  assert.equal(json.execution.state, 'queued');
  assert.equal(json.acceptance.state, 'not_evaluated');
  assert.equal(owner.submits.length, 1);
  assert.equal(owner.submits[0].idempotencyToken, json.request.requestKey);
  assert.equal(owner.submits[0].requestKey, nativeLaunchRequestKey(SCOPE, 'client-request-0001'));
});

test('canonical duplicate returns the original row and never calls the owner again', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const host = hostOf(store, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  const again = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  assert.equal(again.status, 200);
  assert.equal((await again.json() as { status: string }).status, 'duplicate');
  assert.equal(owner.submits.length, 1);
});

test('changed pins, nonce or attempt on a reused requestId refuse without any owner call', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const host = hostOf(store, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  const changedPin = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody({}, { inputDigest: `sha256:${'b'.repeat(64)}` })), host);
  assert.equal(changedPin.status, 409);
  assert.equal((await changedPin.json() as { code: string }).code, 'request_changed');
  const changedNonce = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody({ idempotencyNonce: 'nonce_zyxwvutsrqponmlkjihgfe' })), host);
  assert.equal(changedNonce.status, 409);
  assert.equal(owner.submits.length, 1);
});

test('persistence failure before submit calls no owner and leaks no store detail', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  store.failReserve = true;
  const owner = new FakeOwner();
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), hostOf(store, owner));
  const text = await res.text();
  assert.equal(res.status, 503);
  assert.equal(owner.submits.length, 0);
  assert.doesNotMatch(text, /disk|secret|stack/i);
});

test('expired and revoked admissions refuse launch before any owner call', async () => {
  const store = new FakeStore();
  store.seedAdmission({ ...CAPABILITY, expiresAt: '2026-11-01T00:00:00.000Z' });
  const owner = new FakeOwner();
  const expired = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody({}, { expiresAt: '2026-11-01T00:00:00.000Z' })), hostOf(store, owner));
  assert.equal(expired.status, 409);
  assert.equal((await expired.json() as { code: string }).code, 'admission_expired');

  store.seedAdmission(CAPABILITY, 'revoked');
  const revoked = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), hostOf(store, owner));
  assert.equal((await revoked.json() as { code: string }).code, 'admission_revoked');
  assert.equal(owner.submits.length, 0);
});

test('unsupported plant or action refuses before reservation', async () => {
  const store = new FakeStore();
  store.seedAdmission({ ...CAPABILITY, executionPlant: 'hermes-remote' });
  const owner = new FakeOwner();
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody({}, { executionPlant: 'hermes-remote' })), hostOf(store, owner));
  assert.equal(res.status, 409);
  assert.equal((await res.json() as { code: string }).code, 'unsupported_plant_or_action');
  assert.equal(store.rows.size, 0);
  assert.equal(owner.submits.length, 0);
});

test('lost owner response becomes unknown and status reconciles through readback only', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  owner.submitFails = true;
  const host = hostOf(store, owner);
  const launch = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  assert.equal(launch.status, 503);
  assert.equal((await launch.json() as { execution: { state: string } }).execution.state, 'unknown');

  owner.state = 'running';
  const status = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001' }), host);
  assert.equal(status.status, 200);
  const json = await status.json() as { execution: { state: string }; retry: string };
  assert.equal(json.execution.state, 'running');
  assert.equal(json.retry, 'status_only');
  assert.equal(owner.submits.length, 1);
  assert.equal(owner.reads, 1);
});

test('owner not_found on status keeps the request unknown and never dispatches', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  owner.submitFails = true;
  const host = hostOf(store, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  owner.submitFails = false;
  owner.state = 'not_found';
  const res = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001' }), host);
  assert.equal((await res.json() as { status: string }).status, 'owner_not_found');
  assert.equal(owner.submits.length, 1);
});

test('status requires matching original IDs and never reveals foreign scope', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const host = hostOf(store, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);

  const wrongAttempt = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'other-attempt-01' }), host);
  assert.equal(wrongAttempt.status, 409);
  assert.equal((await wrongAttempt.json() as { code: string }).code, 'attempt_mismatch');

  const foreignHost = hostOf(store, owner, { tenantId: 'tenant-beta', principalId: 'founder-1' });
  const foreign = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001' }), foreignHost);
  const absent = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'never-issued-0001', attemptId: 'client-attempt-0001' }), host);
  assert.equal(foreign.status, 404);
  assert.equal(await foreign.text(), await absent.text());
  assert.equal(owner.submits.length, 1);
});

test('terminal execution is final and status does not re-read the owner', async () => {
  const store = new FakeStore();
  store.seedAdmission();
  const owner = new FakeOwner();
  const host = hostOf(store, owner);
  await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.launch, launchBody()), host);
  const row = [...store.rows.values()][0];
  row.execution = 'succeeded';
  const status = await nativeLaunchHttp(post(NATIVE_LAUNCH_PATHS.status, { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001' }), host);
  const json = await status.json() as { execution: { state: string; terminal: boolean }; retry: string };
  assert.deepEqual([json.execution.state, json.execution.terminal, json.retry], ['succeeded', true, 'none']);
  assert.equal(owner.reads, 0);
});

test('validCapabilityTuple rejects an impossible expiry without throwing', () => {
  const impossible = ['2026-02-31T00:00:00.000Z', '2026-13-01T00:00:00.000Z', '2026-11-02T25:00:00.000Z'];
  for (const expiresAt of impossible) {
    assert.doesNotThrow(() => assert.equal(validCapabilityTuple({ ...CAPABILITY, expiresAt }), false));
  }
  assert.equal(validCapabilityTuple(CAPABILITY), true);
});

test('nativeLaunchRequestDigest changes with every client-chosen field', () => {
  const base = { attemptId: 'a1', idempotencyNonce: NONCE, capability: CAPABILITY };
  const digest = nativeLaunchRequestDigest(base);
  assert.notEqual(digest, nativeLaunchRequestDigest({ ...base, attemptId: 'a2' }));
  assert.notEqual(digest, nativeLaunchRequestDigest({ ...base, idempotencyNonce: 'nonce_zyxwvutsrqponmlkjihgfe' }));
  assert.notEqual(digest, nativeLaunchRequestDigest({ ...base, capability: { ...CAPABILITY, graphVersion: 2 } }));
});
