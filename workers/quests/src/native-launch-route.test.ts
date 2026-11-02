// Handle-level tests for the three native launch routes. Store and owner are
// TEST-only fakes; the production handler never constructs either.

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { handle, type HandlerDeps, type KvLike, type SimpleRequest } from './handler.ts';
import {
  NATIVE_LAUNCH_CONTRACT,
  NATIVE_LAUNCH_PATHS,
  createNativeLaunchHost,
  nativeLaunchHttp,
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
const FOREIGN: NativeLaunchScope = { tenantId: 'tenant-beta', principalId: 'founder-2' };
const NOW = '2026-11-02T00:00:00.000Z';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const CAPABILITY: NativeLaunchCapabilityTuple = {
  workId: 'sapling:cambium', admissionRef: 'adm-123', graphVersion: 1, loadoutId: 'loadout-alpha',
  inputDigest: DIGEST, executionPlant: 'temperance-hands', supportedAction: 'launch', expiresAt: '2026-11-02T01:00:00.000Z',
};
const NONCE = 'nonce_abcdefghijklmnopqrstuv';

class FakeStore implements NativeLaunchStore {
  rows = new Map<string, NativeLaunchRequestRow>();
  failReserve = false;

  async readAdmission(scope: NativeLaunchScope, admissionRef: string, _now: string): Promise<NativeLaunchAdmissionRead | null> {
    if (scope.principalId !== SCOPE.principalId || admissionRef !== CAPABILITY.admissionRef) return null;
    const consumed = [...this.rows.values()].find(row => row.admissionRef === admissionRef && row.principalId === scope.principalId);
    return { admission: { ...CAPABILITY, ...scope, status: 'active' }, hold: consumed ? 'admission_consumed' : null,
      consumedBy: consumed ? { requestId: consumed.requestId, attemptId: consumed.attemptId } : null };
  }

  async listAdmissions(scope: NativeLaunchScope, workId: string, now: string, limit: number): Promise<NativeLaunchAdmissionList> {
    if (workId !== CAPABILITY.workId) return { rows: [], truncated: false };
    const found = await this.readAdmission(scope, CAPABILITY.admissionRef, now);
    return { rows: found ? [found].slice(0, limit) : [], truncated: false };
  }

  async reserve(input: NativeLaunchReservation): Promise<NativeLaunchReserveResult> {
    if (this.failReserve) throw new Error('store unavailable');
    const same = this.rows.get(input.requestKey);
    if (same) return same.requestDigest === input.requestDigest ? { status: 'duplicate', row: same } : { status: 'conflict', code: 'request_changed' };
    if (input.principalId !== SCOPE.principalId) return { status: 'refused', code: 'admission_not_current' };
    const row: NativeLaunchRequestRow = { ...input.capability, ...input, dispatch: 'reserved', execution: 'unknown', ownerRef: null, reservedAt: input.now, observedAt: null };
    this.rows.set(row.requestKey, row);
    return { status: 'reserved', row };
  }

  async readRequest(scope: NativeLaunchScope, requestId: string) {
    return [...this.rows.values()].find(row => row.tenantId === scope.tenantId && row.principalId === scope.principalId && row.requestId === requestId) ?? null;
  }

  async recordObservation(scope: NativeLaunchScope, requestKey: string, observation: NativeLaunchObservation) {
    const row = this.rows.get(requestKey);
    if (!row || row.tenantId !== scope.tenantId || row.principalId !== scope.principalId) return null;
    Object.assign(row, { dispatch: observation.dispatch, execution: observation.execution, ownerRef: observation.ownerRef, observedAt: observation.observedAt });
    return { ...row };
  }
}

class FakeOwner implements NativeLaunchExecutionOwner {
  submits: NativeLaunchOwnerSubmit[] = [];
  reads = 0;
  submitFails = false;
  state: 'queued' | 'succeeded' | 'not_found' = 'queued';

  supports(plant: string, action: string) { return plant === 'temperance-hands' && action === 'launch'; }
  async submit(input: NativeLaunchOwnerSubmit) {
    this.submits.push(input);
    if (this.submitFails) throw new Error('lost response');
    return { state: 'queued' as const, ownerRef: 'synthetic-owner-1' };
  }
  async read(_input: unknown) { this.reads += 1; return { state: this.state, ownerRef: 'synthetic-owner-1' }; }
}

const deps = (): HandlerDeps => ({ kv: { get: async () => null, put: async () => {}, delete: async () => {} } as KvLike });

function hostOf(store: NativeLaunchStore, owner: NativeLaunchExecutionOwner, scope: NativeLaunchScope = SCOPE): NativeLaunchHost {
  return createNativeLaunchHost({
    verify: request => Promise.resolve(request.headers.get('authorization') === 'Bearer synthetic-founder' ? scope : null),
    store, owner, now: () => NOW,
  })!;
}

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): SimpleRequest {
  return { method, path, headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-founder', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) };
}

const launchBody = () => ({ contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001',
  attemptId: 'client-attempt-0001', idempotencyNonce: NONCE, capability: CAPABILITY });

test('all four native launch routes return 503 when no host is bound', async () => {
  for (const path of Object.values(NATIVE_LAUNCH_PATHS)) {
    const response = await handle(req('POST', path, { contractVersion: NATIVE_LAUNCH_CONTRACT }), deps());
    assert.equal(response.status, 503, path);
    assert.equal(JSON.parse(response.body as string).error, 'native_launch_unconfigured');
  }
});

test('injected verifier sees the actual request and resolves the verified scope', async () => {
  const store = new FakeStore();
  const seen: Request[] = [];
  const host = createNativeLaunchHost({
    verify: request => { seen.push(request); return Promise.resolve(SCOPE); },
    store, owner: new FakeOwner(), now: () => NOW,
  })!;
  const response = await handle(req('POST', NATIVE_LAUNCH_PATHS.capability,
    { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef }), hostDeps(host));
  assert.equal(response.status, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].headers.get('authorization'), 'Bearer synthetic-founder');
  assert.equal(JSON.parse(response.body as string).capability, 'supported');
});

test('a foreign verified scope receives the same refusal as a missing admission', async () => {
  const response = await handle(req('POST', NATIVE_LAUNCH_PATHS.capability,
    { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef }),
  hostDeps(hostOf(new FakeStore(), new FakeOwner(), FOREIGN)));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body as string).reason, 'no_admission');
});

test('wrong method and an unknown native path keep their existing responses', async () => {
  const host = hostOf(new FakeStore(), new FakeOwner());
  const method = await handle(req('GET', NATIVE_LAUNCH_PATHS.launch), hostDeps(host));
  assert.equal(method.status, 405);
  const unknown = await handle(req('POST', '/v1/native/launch/other', {}), hostDeps(host));
  assert.equal(unknown.status, 404);
});

test('duplicate launch, a lost owner response, and status return the original request', async () => {
  const store = new FakeStore();
  const owner = new FakeOwner();
  const bound = hostDeps(hostOf(store, owner));
  const first = await handle(req('POST', NATIVE_LAUNCH_PATHS.launch, launchBody()), bound);
  assert.equal(first.status, 202);
  const duplicate = await handle(req('POST', NATIVE_LAUNCH_PATHS.launch, launchBody()), bound);
  assert.equal(duplicate.status, 200);
  assert.equal(JSON.parse(duplicate.body as string).status, 'duplicate');
  assert.equal(owner.submits.length, 1);

  owner.submitFails = true;
  const lost = await handle(req('POST', NATIVE_LAUNCH_PATHS.launch, { ...launchBody(), requestId: 'client-request-0002', attemptId: 'client-attempt-0002' }), bound);
  assert.equal(lost.status, 503);
  assert.equal(JSON.parse(lost.body as string).status, 'unknown');
  owner.state = 'succeeded';
  const recovered = await handle(req('POST', NATIVE_LAUNCH_PATHS.status,
    { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0002', attemptId: 'client-attempt-0002' }), bound);
  const body = JSON.parse(recovered.body as string);
  assert.equal(recovered.status, 200);
  assert.equal(body.execution.state, 'succeeded');
  assert.equal(body.acceptance.state, 'not_evaluated');
  assert.equal(owner.submits.length, 2);
});

function hostDeps(host: NativeLaunchHost): HandlerDeps {
  return { ...deps(), nativeLaunchHost: host };
}

const FIXTURE_URL = new URL('./fixtures/native-launch-wire.v1.json', import.meta.url);
const WIRE_HEADERS = { 'content-type': 'application/json', authorization: 'Bearer synthetic-founder' };

/** Builds the fixture from real nativeLaunchHttp output. Synthetic scope and refs live only here. */
async function buildWireFixture() {
  const owner = new FakeOwner();
  const host = hostOf(new FakeStore(), owner);
  const unsupportedHost = hostOf(new FakeStore(), { supports: () => false, submit: async () => ({ state: 'queued' as const }), read: async () => ({ state: 'queued' as const }) });
  const lostOwner = new FakeOwner();
  lostOwner.submitFails = true;
  const lostHost = hostOf(new FakeStore(), lostOwner);
  const capabilityBody = { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId, admissionRef: CAPABILITY.admissionRef };
  const admissionsBody = { contractVersion: NATIVE_LAUNCH_CONTRACT, workId: CAPABILITY.workId };
  const noListStore = new FakeStore();
  (noListStore as { listAdmissions?: unknown }).listAdmissions = undefined;
  const noListHost = hostOf(noListStore, new FakeOwner());
  const statusBody = { contractVersion: NATIVE_LAUNCH_CONTRACT, requestId: 'client-request-0001', attemptId: 'client-attempt-0001' };
  const steps: Array<{ name: string; path: string; body: unknown; host: NativeLaunchHost; before?: () => void }> = [
    { name: 'admissions_current', path: NATIVE_LAUNCH_PATHS.admissions, body: admissionsBody, host },
    { name: 'admissions_other_work_empty', path: NATIVE_LAUNCH_PATHS.admissions, body: { ...admissionsBody, workId: 'sapling:other' }, host },
    { name: 'admissions_listing_unconfigured', path: NATIVE_LAUNCH_PATHS.admissions, body: admissionsBody, host: noListHost },
    { name: 'capability_supported', path: NATIVE_LAUNCH_PATHS.capability, body: capabilityBody, host },
    { name: 'capability_unavailable', path: NATIVE_LAUNCH_PATHS.capability, body: { ...capabilityBody, workId: 'sapling:other' }, host },
    { name: 'capability_unsupported', path: NATIVE_LAUNCH_PATHS.capability, body: capabilityBody, host: unsupportedHost },
    { name: 'launch_accepted_queued', path: NATIVE_LAUNCH_PATHS.launch, body: launchBody(), host },
    { name: 'admissions_consumed', path: NATIVE_LAUNCH_PATHS.admissions, body: admissionsBody, host },
    { name: 'launch_unknown_lost_owner_response', path: NATIVE_LAUNCH_PATHS.launch, body: launchBody(), host: lostHost },
    { name: 'status_unknown_request', path: NATIVE_LAUNCH_PATHS.status, body: { ...statusBody, requestId: 'client-request-9999', attemptId: 'client-attempt-9999' }, host },
    { name: 'status_recovered_succeeded', path: NATIVE_LAUNCH_PATHS.status, body: statusBody, host, before: () => { owner.state = 'succeeded'; } },
  ];
  const samples = [];
  for (const step of steps) {
    step.before?.();
    const text = JSON.stringify(step.body);
    const response = await nativeLaunchHttp(new Request(`https://cambium.invalid${step.path}`, { method: 'POST', headers: WIRE_HEADERS, body: text }), step.host);
    samples.push({ name: step.name, input: { method: 'POST', path: step.path, headers: WIRE_HEADERS, body: step.body },
      output: { status: response.status, body: await response.json() } });
  }
  return { contractVersion: NATIVE_LAUNCH_CONTRACT, synthetic: true, samples };
}

test('the stored wire fixture is exactly what the owner route produces', async () => {
  const actual = await buildWireFixture();
  if (process.env.WRITE_NATIVE_LAUNCH_FIXTURE === '1') writeFileSync(FIXTURE_URL, `${JSON.stringify(actual, null, 2)}\n`);
  const stored = JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));
  assert.deepEqual(stored, actual);
  const byName = new Map<string, { output: { status: number; body: Record<string, any> } }>(actual.samples.map(sample => [sample.name, sample as never]));
  assert.equal(byName.get('capability_supported')!.output.body.capability, 'supported');
  assert.equal(byName.get('capability_unavailable')!.output.body.capability, 'unavailable');
  assert.equal(byName.get('capability_unsupported')!.output.body.capability, 'unsupported');
  assert.equal(byName.get('launch_accepted_queued')!.output.body.execution.state, 'queued');
  assert.equal(byName.get('launch_unknown_lost_owner_response')!.output.body.execution.state, 'unknown');
  assert.equal(byName.get('status_unknown_request')!.output.status, 404);
  const recovered = byName.get('status_recovered_succeeded')!.output.body;
  assert.equal(recovered.execution.state, 'succeeded');
  assert.equal(recovered.acceptance.state, 'not_evaluated');
  assert.ok(!JSON.stringify(stored).includes('tenant-alpha'), 'scope never appears on the wire');
});

test('fixture captures the unknown launch reply after a lost owner response', async () => {
  const owner = new FakeOwner();
  owner.submitFails = true;
  const response = await nativeLaunchHttp(new Request(`https://cambium.invalid${NATIVE_LAUNCH_PATHS.launch}`,
    { method: 'POST', headers: WIRE_HEADERS, body: JSON.stringify(launchBody()) }), hostOf(new FakeStore(), owner));
  const body = await response.json() as Record<string, any>;
  assert.equal(response.status, 503);
  assert.equal(body.status, 'unknown');
  assert.equal(body.execution.state, 'unknown');
  assert.equal(body.acceptance.state, 'not_evaluated');
});
