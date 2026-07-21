import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { productScreenOrder } from '../scene/route-registry.ts';
import {
  CONSTELLATION_HOME_MARKER,
  buildConstellationLayout,
  hubScreenIdFor,
  type TapestrySnapshot,
} from './constellation-layout.ts';
import { fixtureTapestry } from './fixture-tapestry.ts';
import { loadTapestrySnapshot } from './tapestry-loader.ts';

const here = dirname(fileURLToPath(import.meta.url));
const sceneSource = readFileSync(join(here, '../scene/CambiumScene.tsx'), 'utf8');

test('home overview renders the constellation layer as its primary marker', () => {
  assert.match(sceneSource, /mode === 'overview' \? <ConstellationMapField \/> : null/);
  assert.ok(sceneSource.includes('CONSTELLATION_HOME_MARKER'));
  assert.ok(sceneSource.includes(`name={${'CONSTELLATION_HOME_MARKER'}}`));
  assert.equal(CONSTELLATION_HOME_MARKER, 'constellation-home-overview');
});

test('hub -> screen mapping covers all five organ screens', () => {
  const layout = buildConstellationLayout(fixtureTapestry);
  const hubIds = layout.clusters.map((cluster) => cluster.hubId).sort();
  assert.deepEqual(hubIds, ['build', 'cortex', 'genesis', 'ops', 'taste']);

  for (const hubId of hubIds) {
    const screenId = hubScreenIdFor(hubId);
    assert.equal(screenId, `island-${hubId}`);
    assert.ok(
      (productScreenOrder as readonly string[]).includes(screenId),
      `expected ${screenId} to be a routable product screen`,
    );
  }
});

test('tapestry loader returns the fetched snapshot when the fetch succeeds', async (t) => {
  const originalFetch = globalThis.fetch;
  const remote: TapestrySnapshot = {
    ...fixtureTapestry,
    tenant: { ...fixtureTapestry.tenant, label: 'Remote Grove' },
  };
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => remote,
  })) as unknown as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const snapshot = await loadTapestrySnapshot();
  assert.equal(snapshot.tenant.label, 'Remote Grove');
});

test('tapestry loader falls back to the fixture when the fetch fails', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network offline');
  }) as unknown as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const snapshot = await loadTapestrySnapshot();
  assert.deepEqual(snapshot, fixtureTapestry);
});

test('tapestry loader falls back to the fixture on malformed payloads', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ schema: 'cambium.fractal-tapestry.snapshot.v1' }),
  })) as unknown as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const snapshot = await loadTapestrySnapshot();
  assert.deepEqual(snapshot, fixtureTapestry);
});
