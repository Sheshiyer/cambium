import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import {
  buildDemoTenantFixture,
  deleteDemoTenantFixture,
  validateTenantId,
  writeDemoTenantFixture,
} from '../scripts/demo-tenant-fixture.mjs';

const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('demo tenant fixture uses portable synthetic data only', () => {
  const fixture = buildDemoTenantFixture('demo-org');
  const text = JSON.stringify(fixture);

  assert.equal(fixture.tenant.id, 'demo-org');
  assert.match(fixture.project.evidence.at(-1), /^https:\/\/demo-org\.example\.com$/);
  assert.doesNotMatch(text, privateLeak);
  assert.equal(fixture.project.briefStatus, 'accepted');
});

test('demo tenant fixture validates portable org slugs', () => {
  assert.equal(validateTenantId('founder-led-team'), 'founder-led-team');
  assert.throws(() => validateTenantId('Founder Team'), /invalid tenant id/);
  assert.throws(() => validateTenantId('team--one'), /invalid tenant id/);
});

test('demo tenant fixture writes and cleans ignored runtime state', async () => {
  const root = await fs.mkdtemp(join(os.tmpdir(), 'cambium-demo-tenant-'));
  const targets = writeDemoTenantFixture({ root, tenant: 'demo-org' });

  const world = JSON.parse(await fs.readFile(targets.world, 'utf8'));
  const quests = JSON.parse(await fs.readFile(targets.quests, 'utf8'));
  const tenants = JSON.parse(await fs.readFile(targets.tenants, 'utf8'));

  assert.equal(world.tenant, 'demo-org');
  assert.equal(quests.generatedFrom, 'synthetic-demo-fixture');
  assert.deepEqual(tenants.map((tenant) => tenant.id), ['demo-org']);

  deleteDemoTenantFixture({ root, tenant: 'demo-org' });
  await assert.rejects(() => fs.stat(targets.world), /ENOENT/);
});
