#!/usr/bin/env node
// Synthetic tenant fixture generator for standalone Cambium demos.
// Writes only ignored runtime state under .operator/.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TENANT_ID_RULE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function validateTenantId(id) {
  if (typeof id !== 'string' || id.length === 0) throw new Error('tenant id is required');
  if (id !== id.toLowerCase() || /\s/.test(id) || id.includes('--') || !TENANT_ID_RULE.test(id)) {
    throw new Error(`invalid tenant id "${id}"; use lowercase kebab-case, e.g. "demo-org"`);
  }
  return id;
}

export function buildDemoTenantFixture(tenant = 'demo-org') {
  const id = validateTenantId(tenant);
  const createdAt = '2026-06-19T00:00:00.000Z';
  return {
    tenant: {
      id,
      vision: 'Turn a clear founder promise into a living operating map.',
      mission: 'ship useful, on-brand work with synthetic demo evidence only',
      brand: { label: 'Demo Grove' },
      business: { runwayDays: 120 },
      createdAt,
    },
    world: {
      tenant: id,
      version: 4,
      vision: 'Turn a clear founder promise into a living operating map.',
      mission: 'ship useful, on-brand work with synthetic demo evidence only',
      goals: [
        'brief the first offer',
        'approve the build gate',
        'archive lessons into memory',
      ],
      brand: {
        setpoint: [0.42, 0.31],
        label: 'Demo Grove',
        trustRegion: 0.25,
        coherence: 0.82,
      },
      artifacts: {
        seed: 'A portable operating layer for a founder-led team.',
        positioning: 'A neutral company compiler that turns intent into coordinated work.',
        cta: 'begin',
        brief: 'Synthetic brief accepted for local demo only.',
        launch_note: 'Example launch packet for example.com.',
      },
      business: { runwayDays: 120 },
      log: [
        '#1 demo-seed -> micro',
        '#2 demo-brief -> meso',
        '#3 demo-approval -> macro',
        '#4 demo-heartbeat -> viability',
      ],
    },
    onboarding: {
      tenant: id,
      stepIndex: 20,
      drivesActivated: [1, 2, 3, 4, 5, 6, 7, 8],
      noesisMoments: 3,
      transcript: [
        'Synthetic founder names the promise.',
        'Synthetic team accepts the first operating map.',
      ],
    },
    project: {
      tenant: id,
      briefStatus: 'accepted',
      contractExists: true,
      depositReceived: true,
      repoExists: true,
      tenantProvisioned: true,
      specsFrozen: true,
      buildCommits: 3,
      reviewEvents: 2,
      gateApprovals: 1,
      deployEvents: 1,
      clientSignOff: true,
      lessonsMinted: 2,
      projectArchived: false,
      evidence: [
        'synthetic://brief/accepted',
        'synthetic://repo/demo-org',
        'https://demo-org.example.com',
      ],
    },
    questLedger: {
      tenant: id,
      generatedFrom: 'synthetic-demo-fixture',
      arcs: [
        { id: 'the-calling', status: 'complete', evidence: '20/20 synthetic onboarding steps' },
        { id: 'the-brief', status: 'complete', evidence: 'brief accepted · contract signed · deposit received' },
        { id: 'the-gate', status: 'complete', evidence: '1 synthetic approval through abstract gate' },
        { id: 'the-archive', status: 'active', evidence: 'lessons minted · archive pending' },
      ],
    },
  };
}

export function writeDemoTenantFixture({ root = process.cwd(), tenant = 'demo-org', force = false } = {}) {
  const fixture = buildDemoTenantFixture(tenant);
  const opDir = join(root, '.operator');
  mkdirSync(opDir, { recursive: true });

  const targets = {
    world: join(opDir, `${fixture.tenant.id}.world.json`),
    onboarding: join(opDir, `${fixture.tenant.id}.onboarding.json`),
    project: join(opDir, `${fixture.tenant.id}.project.json`),
    quests: join(opDir, `${fixture.tenant.id}.quests.json`),
    tenants: join(opDir, 'tenants.json'),
  };

  if (!force) {
    for (const file of Object.values(targets)) {
      if (existsSync(file)) throw new Error(`${file} already exists; rerun with --force to overwrite`);
    }
  }

  writeFileSync(targets.world, JSON.stringify(fixture.world, null, 2) + '\n');
  writeFileSync(targets.onboarding, JSON.stringify(fixture.onboarding, null, 2) + '\n');
  writeFileSync(targets.project, JSON.stringify(fixture.project, null, 2) + '\n');
  writeFileSync(targets.quests, JSON.stringify(fixture.questLedger, null, 2) + '\n');
  writeFileSync(targets.tenants, JSON.stringify([fixture.tenant], null, 2) + '\n');
  return targets;
}

export function deleteDemoTenantFixture({ root = process.cwd(), tenant = 'demo-org' } = {}) {
  const id = validateTenantId(tenant);
  const opDir = join(root, '.operator');
  const targets = [
    join(opDir, `${id}.world.json`),
    join(opDir, `${id}.onboarding.json`),
    join(opDir, `${id}.project.json`),
    join(opDir, `${id}.quests.json`),
  ];
  for (const file of targets) rmSync(file, { force: true });
}

function parseArgs(argv) {
  const args = { tenant: 'demo-org', root: process.cwd(), force: false, clean: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tenant') args.tenant = argv[++i];
    else if (arg === '--root') args.root = resolve(argv[++i]);
    else if (arg === '--force') args.force = true;
    else if (arg === '--clean') args.clean = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: npm run demo:tenant -- [--tenant demo-org] [--root .] [--force] [--clean]');
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
    const args = parseArgs(process.argv.slice(2));
    if (args.clean) {
      deleteDemoTenantFixture(args);
      console.log(`deleted synthetic tenant fixture: ${args.tenant}`);
    } else {
      const targets = writeDemoTenantFixture(args);
      console.log(`wrote synthetic tenant fixture: ${args.tenant}`);
      for (const [kind, file] of Object.entries(targets)) console.log(`- ${kind}: ${file}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
