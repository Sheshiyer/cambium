// Track 3 · operating-picture wiring tests. Reads only; no network.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMissionFabricProjection } from './mission-fabric.ts';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';
import { operatingPicture, renderOperatingLine } from './operating-picture.ts';
import type { FetchLike } from './mission-fabric-read-client.ts';

const TENANT = 'cambium-synthetic';
const BASE_URL = 'https://curious.thoughtseed.space';
const CLOCK = { now: () => '2026-07-28T09:00:03.000Z' };

function projectionFetch(): FetchLike {
  const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: CLOCK });
  return async () => ({
    status: 200,
    async json() { return projection; },
    async text() { return JSON.stringify(projection); },
  });
}

test('flag-off renders a warning line and a gap view', async () => {
  const p = await operatingPicture({ baseUrl: BASE_URL, tenantId: TENANT, liveReads: false });
  assert.equal(p.view.ok, false);
  assert.match(p.line, /^⚠ /);
  assert.match(p.line, /live-reads-disabled/);
});

test('live picture renders a check line with counts and byKind', async () => {
  const p = await operatingPicture({
    baseUrl: BASE_URL, tenantId: TENANT, liveReads: true, fetchImpl: projectionFetch(),
  });
  assert.equal(p.view.ok, true);
  assert.match(p.line, /^✓ /);
  assert.match(p.line, /@ v\d+/);
  assert.match(p.line, /nodes/);
});

test('renderOperatingLine is pure over an ok view and surfaces open gaps', () => {
  const view = {
    ok: true as const, tenantId: 'cambium', graphVersion: 1, graphDigest: 'sha256:x',
    counts: { nodes: 3, edges: 2, gaps: 1, byKind: { work: 1, task: 2 } },
    openGaps: [{ gapId: 'g1', kind: 'missing-receipt', detail: 'x' }],
    projection: {} as never,
  };
  const line = renderOperatingLine(view);
  assert.match(line, /cambium @ v1/);
  assert.match(line, /task:2 work:1/);
  assert.match(line, /1 open gap/);
});
