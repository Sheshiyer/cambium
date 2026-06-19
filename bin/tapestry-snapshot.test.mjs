import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { writeDemoTenantFixture } from '../scripts/demo-tenant-fixture.mjs';
import { buildTapestrySnapshot, writeTapestrySnapshot } from '../scripts/tapestry-snapshot.mjs';

const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('tapestry snapshot exports the six-scale standalone map', async () => {
  const root = await fs.mkdtemp(join(os.tmpdir(), 'cambium-tapestry-'));
  writeDemoTenantFixture({ root, tenant: 'demo-org' });

  const snapshot = buildTapestrySnapshot({
    root,
    tenant: 'demo-org',
    generatedAt: '2026-06-19T00:00:00.000Z',
  });

  assert.equal(snapshot.schema, 'cambium.fractal-tapestry.snapshot.v1');
  assert.equal(snapshot.standalone, true);
  assert.deepEqual(snapshot.recursion, ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio']);
  assert.equal(snapshot.field.role, 'living-fractal-substrate');
  assert.equal(snapshot.field.symmetry, 'organ-radial');
  assert.deepEqual(snapshot.nodes.map((node) => node.id), ['genesis', 'taste', 'build', 'ops', 'cortex']);
  assert.ok(snapshot.rails.some((rail) => rail.from === 'cortex' && rail.lane === 'memory'));
  assert.equal(snapshot.telemetry.completedQuestCount, 3);
  assert.doesNotMatch(JSON.stringify(snapshot), privateLeak);
});

test('tapestry snapshot writes a bounded JSON file', async () => {
  const root = await fs.mkdtemp(join(os.tmpdir(), 'cambium-tapestry-write-'));
  const out = join(root, 'snapshot', 'demo-org.json');
  writeDemoTenantFixture({ root, tenant: 'demo-org' });

  const result = writeTapestrySnapshot({
    root,
    tenant: 'demo-org',
    out,
    generatedAt: '2026-06-19T00:00:00.000Z',
  });
  const written = JSON.parse(await fs.readFile(result.out, 'utf8'));

  assert.equal(written.tenant.id, 'demo-org');
  assert.ok(Buffer.byteLength(JSON.stringify(written), 'utf8') < 20000);
});
