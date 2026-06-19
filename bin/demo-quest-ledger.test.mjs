import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { writeDemoTenantFixture } from '../scripts/demo-tenant-fixture.mjs';
import { demoQuestLedgerText, loadDemoQuestLedger, renderDemoQuestLedger } from '../scripts/demo-quest-ledger.mjs';

const privateLeak = /(thoughtseed|curious\.thoughtseed\.space|\/Users\/|\/Volumes\/|cs_live_|@[a-z0-9.-]+\.(com|io))/i;

test('demo quest ledger renders from synthetic fixture state', async () => {
  const root = await fs.mkdtemp(join(os.tmpdir(), 'cambium-demo-quests-'));
  writeDemoTenantFixture({ root, tenant: 'demo-org' });

  const text = demoQuestLedgerText({ root, tenant: 'demo-org' });

  assert.match(text, /Demo Quest Ledger · synthetic fixture/);
  assert.match(text, /tenant: demo-org/);
  assert.match(text, /the-calling\s+✓/);
  assert.match(text, /the-archive\s+▸/);
  assert.match(text, /3\/4 demo arcs/);
  assert.match(text, /not private provider data/);
  assert.doesNotMatch(text, privateLeak);
});

test('demo quest ledger --seed path creates fixture state before rendering', async () => {
  const root = await fs.mkdtemp(join(os.tmpdir(), 'cambium-demo-quests-seed-'));
  const text = demoQuestLedgerText({ root, tenant: 'demo-org', seed: true });
  const ledger = loadDemoQuestLedger({ root, tenant: 'demo-org' });

  assert.equal(ledger.generatedFrom, 'synthetic-demo-fixture');
  assert.match(text, /source: synthetic-demo-fixture/);
});

test('demo quest ledger refuses non-synthetic ledgers', async () => {
  const root = await fs.mkdtemp(join(os.tmpdir(), 'cambium-demo-quests-live-'));
  await fs.mkdir(join(root, '.operator'));
  await fs.writeFile(
    join(root, '.operator', 'demo-org.quests.json'),
    JSON.stringify({ tenant: 'demo-org', generatedFrom: 'live-provider', arcs: [] }),
  );

  assert.throws(() => loadDemoQuestLedger({ root, tenant: 'demo-org' }), /not a synthetic-demo-fixture ledger/);
});

test('demo quest ledger renderer handles complete demo arcs', () => {
  const text = renderDemoQuestLedger({
    tenant: 'demo-org',
    generatedFrom: 'synthetic-demo-fixture',
    arcs: [
      { id: 'a', status: 'complete', evidence: 'one' },
      { id: 'b', status: 'complete', evidence: 'two' },
    ],
  });

  assert.match(text, /2\/2 demo arcs/);
  assert.match(text, /all demo arcs complete/);
});
