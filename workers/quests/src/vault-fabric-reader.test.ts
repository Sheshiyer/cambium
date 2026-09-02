// Track A · vault-side Mission Fabric reader tests. Reads only; no network.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMissionFabricProjection } from './mission-fabric.ts';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';
import { readVaultFabricView } from './vault-fabric-reader.ts';
import type { FetchLike } from './mission-fabric-read-client.ts';

const TENANT = 'cambium-synthetic';
const BASE_URL = 'https://example.invalid';
const CLOCK = { now: () => '2026-07-28T09:00:03.000Z' };

function projectionFetch(): FetchLike {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: CLOCK });
  return async () => ({
    status: 200,
    async json() {
      return projection;
    },
    async text() {
      return JSON.stringify(projection);
    },
  });
}

test('flag-off yields a gap view without touching the network', async () => {
  const view = await readVaultFabricView({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: false,
  });
  assert.equal(view.ok, false);
  if (!view.ok) {
    assert.equal(view.reason, 'live-reads-disabled');
    assert.equal(view.tenantId, TENANT);
  }
});

test('live happy path yields a summary with counts, byKind, and open gaps', async () => {
  const view = await readVaultFabricView({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    fetchImpl: projectionFetch(),
  });
  assert.equal(view.ok, true);
  if (view.ok) {
    assert.equal(view.tenantId, TENANT);
    assert.ok(view.counts.nodes > 0, 'projection has nodes');
    assert.ok(Object.keys(view.counts.byKind).length > 0, 'byKind is populated');
    // The fixture carries two synthetic gaps; the reader surfaces them.
    assert.equal(view.openGaps.length, view.counts.gaps);
    assert.ok(view.graphDigest.startsWith('sha256:'));
    assert.equal(view.projection.schema, 'cambium.mission-fabric-projection.v1');
  }
});

test('transport failure degrades to a gap view (never throws)', async () => {
  const view = await readVaultFabricView({
    baseUrl: BASE_URL,
    tenantId: TENANT,
    liveReads: true,
    fetchImpl: (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as FetchLike,
  });
  assert.equal(view.ok, false);
  if (!view.ok) assert.equal(view.reason, 'transport-error');
});
