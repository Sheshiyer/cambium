#!/usr/bin/env node
// Render the standalone synthetic demo quest ledger from ignored .operator state.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateTenantId, writeDemoTenantFixture } from './demo-tenant-fixture.mjs';

const MARK = { complete: '✓', active: '▸', locked: '·' };

function meter(n, max, width = 14) {
  const filled = max > 0 ? Math.round((n / max) * width) : 0;
  return '█'.repeat(filled) + '·'.repeat(Math.max(0, width - filled));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadDemoQuestLedger({ root = process.cwd(), tenant = 'demo-org' } = {}) {
  const id = validateTenantId(tenant);
  const path = join(root, '.operator', `${id}.quests.json`);
  if (!existsSync(path)) {
    throw new Error(`missing synthetic quest ledger for "${id}"; run: npm run demo:tenant -- --tenant ${id} --force`);
  }
  const ledger = readJson(path);
  if (ledger.generatedFrom !== 'synthetic-demo-fixture') {
    throw new Error(`${path} is not a synthetic-demo-fixture ledger`);
  }
  if (!Array.isArray(ledger.arcs)) {
    throw new Error(`${path} missing arcs[]`);
  }
  return ledger;
}

export function renderDemoQuestLedger(ledger) {
  const total = ledger.arcs.length;
  const completed = ledger.arcs.filter((arc) => arc.status === 'complete').length;
  const current = ledger.arcs.find((arc) => arc.status === 'active')
    ?? ledger.arcs.find((arc) => arc.status !== 'complete');
  const lines = [
    '',
    '  ════════ Demo Quest Ledger · synthetic fixture ════════',
    '',
    `  tenant: ${ledger.tenant}`,
    `  source: ${ledger.generatedFrom}`,
    '',
  ];

  for (const arc of ledger.arcs) {
    const id = String(arc.id).padEnd(18);
    const mark = MARK[arc.status] ?? '?';
    lines.push(`  ${id}${mark}  ${arc.evidence ?? 'no evidence supplied'}`);
  }

  lines.push('');
  lines.push(`  progress  ${meter(completed, total)} ${completed}/${total} demo arcs`);
  if (current) {
    lines.push(`  you are here -> ${current.id}: ${current.evidence ?? current.status}`);
  } else {
    lines.push('  all demo arcs complete; run the real quest fold when live evidence is connected.');
  }
  lines.push('  demo status derives from the committed synthetic fixture, not private provider data.');
  return lines.join('\n');
}

export function demoQuestLedgerText({ root = process.cwd(), tenant = 'demo-org', seed = false } = {}) {
  if (seed) writeDemoTenantFixture({ root, tenant, force: true });
  return renderDemoQuestLedger(loadDemoQuestLedger({ root, tenant }));
}

function parseArgs(argv) {
  const args = { root: process.cwd(), tenant: 'demo-org', seed: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = resolve(argv[++i]);
    else if (arg === '--tenant') args.tenant = argv[++i];
    else if (arg === '--seed') args.seed = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: npm run demo:quests -- [--root .] [--tenant demo-org] [--seed]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  validateTenantId(args.tenant);
  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(demoQuestLedgerText(parseArgs(process.argv.slice(2))));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
