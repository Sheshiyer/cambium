// Phase G · Mission Fabric read client tests.
//
// Proves the reads-only client against the REAL Worker compiler + digest:
//   * flag-off returns a gap (no network),
//   * a compiler-built projection round-trips through the HTTP path,
//   * every failure mode (transport, timeout, 401/403/404, bad status,
//     malformed body, schema/tenant mismatch, cap, digest) resolves to a gap
//     and never throws.
//
// In-memory fake fetch only; no network, no external system, no writes.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMissionFabricProjection } from './mission-fabric.ts';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';
import {
  missionFabricUrl,
  readMissionFabric,
  verifyMissionFabricProjection,
  type FetchLike,
} from './mission-fabric-read-client.ts';

const TENANT = 'cambium-synthetic';
const BASE_URL = 'https://example.invalid';
const CLOCK = { now: () => '2026-07-28T09:00:03.000Z' };

/** A real, self-consistent projection (graphDigest === projectionDigest). */
function realProjection() {
  return buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: CLOCK });
}

/** Build a fake fetch that returns a fixed status/body for any URL. */
function fakeFetch(status: number, body: unknown, opts: { throwErr?: Error; captureUrl?: (u: string) => void } = {}): FetchLike {
  return async (url) => {
    opts.captureUrl?.(url);
    if (opts.throwErr) throw opts.throwErr;
    return {
      status,
      async json() {
        if (typeof body === 'string') throw new SyntaxError('not json');
        return body;
      },
      async text() {
        return typeof body === 'string' ? body : JSON.stringify(body);
      },
    };
  };
}

test('missionFabricUrl builds the canonical read path with tenant encoding', () => {
  assert.equal(
    missionFabricUrl(BASE_URL, 'cambium'),
    'https://example.invalid/v1/mission-fabric/cambium',
  );
  // trailing slash on base is trimmed; tenant is encoded
  assert.equal(
    missionFabricUrl(`${BASE_URL}/`, 'a b'),
    'https://example.invalid/v1/mission-fabric/a%20b',
  );
});

test('flag-off returns a gap and performs no network I/O', async () => {
  let called = false;
  const res = await readMissionFabric({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: false,
    fetchImpl: (() => {
      called = true;
      throw new Error('should not be called');
    }) as unknown as FetchLike,
  });
  assert.equal(called, false);
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'live-reads-disabled');
});

test('happy path: a compiler-built projection round-trips through the HTTP path', async () => {
  const projection = realProjection();
  let seenUrl = '';
  const res = await readMissionFabric({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    fetchImpl: fakeFetch(200, projection, { captureUrl: (u) => (seenUrl = u) }),
  });
  assert.equal(seenUrl, `${BASE_URL}/v1/mission-fabric/${TENANT}`);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.tenantId, TENANT);
    assert.equal(res.graphDigest, projection.graphDigest);
    assert.equal(res.projection.schema, 'cambium.mission-fabric-projection.v1');
  }
});

test('happy path also accepts a { projection } envelope', async () => {
  const projection = realProjection();
  const res = await readMissionFabric({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    fetchImpl: fakeFetch(200, { projection }),
  });
  assert.equal(res.ok, true);
});

test('auth failures resolve to unauthorized/forbidden gaps', async () => {
  for (const [status, reason] of [
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [500, 'bad-status'],
  ] as const) {
    const res = await readMissionFabric({
      baseUrl: BASE_URL,
      tenantId: TENANT,
      liveReads: true,
      fetchImpl: fakeFetch(status, { error: 'x' }),
    });
    assert.equal(res.ok, false);
    assert.equal(res.kind === 'gap' && res.reason, reason);
    assert.equal(res.kind === 'gap' && res.status, status);
  }
});

test('transport error resolves to a transport-error gap (never throws)', async () => {
  const res = await readMissionFabric({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    fetchImpl: fakeFetch(200, {}, { throwErr: new Error('ECONNREFUSED') }),
  });
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'transport-error');
});

test('abort resolves to a timeout gap', async () => {
  const abortErr = new Error('aborted');
  abortErr.name = 'AbortError';
  const res = await readMissionFabric({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    timeoutMs: 5,
    fetchImpl: fakeFetch(200, {}, { throwErr: abortErr }),
  });
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'timeout');
});

test('malformed JSON body resolves to a malformed-body gap', async () => {
  const res = await readMissionFabric({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    fetchImpl: fakeFetch(200, 'not-json'),
  });
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'malformed-body');
});

test('schema mismatch resolves to a schema-mismatch gap', () => {
  const res = verifyMissionFabricProjection(TENANT, { schema: 'wrong', projectionVersion: 1 });
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'schema-mismatch');
});

test('tenant mismatch resolves to a tenant-mismatch gap', () => {
  const projection = realProjection();
  const res = verifyMissionFabricProjection('some-other-tenant', projection);
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'tenant-mismatch');
});

test('cap violation resolves to a cap-exceeded gap', () => {
  const projection = realProjection();
  const tampered = { ...projection, nodes: new Array(513).fill(projection.nodes[0]) };
  const res = verifyMissionFabricProjection(TENANT, tampered);
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'cap-exceeded');
});

test('digest tampering resolves to a digest-mismatch gap', () => {
  const projection = realProjection();
  // Mutate a display field without recomputing the digest -> mismatch.
  const tampered = { ...projection, graphVersion: projection.graphVersion + 999 };
  const res = verifyMissionFabricProjection(TENANT, tampered);
  assert.equal(res.ok, false);
  assert.equal(res.kind === 'gap' && res.reason, 'digest-mismatch');
});
