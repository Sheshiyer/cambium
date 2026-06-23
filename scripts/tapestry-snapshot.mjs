#!/usr/bin/env node
// Export a portable fractal-tapestry snapshot from ignored tenant runtime state.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateTenantId } from './demo-tenant-fixture.mjs';

const field = {
  id: 'cambium-field',
  role: 'living-fractal-substrate',
  symmetry: 'organ-radial',
  width: 15.8,
  depth: 10.6,
  contourCount: 12,
  seamCount: 9,
};

const canonicalNodes = [
  { id: 'genesis', organ: 'genesis', title: 'Genesis', scale: 'organ', x: -4.8, z: -1.2 },
  { id: 'taste', organ: 'taste', title: 'Taste', scale: 'organ', x: -2.1, z: 1.2 },
  { id: 'build', organ: 'hands', title: 'Build', scale: 'organ', x: 1.4, z: 1.05 },
  { id: 'ops', organ: 'will', title: 'Ops', scale: 'organ', x: 4.4, z: -1.15 },
  { id: 'cortex', organ: 'cortex', title: 'Cortex', scale: 'organ', x: 0.1, z: -3.25 },
];

const canonicalRails = [
  { id: 'genesis-to-taste', from: 'genesis', to: 'taste', lane: 'handoff' },
  { id: 'taste-to-build', from: 'taste', to: 'build', lane: 'handoff' },
  { id: 'build-to-ops', from: 'build', to: 'ops', lane: 'runner' },
  { id: 'cortex-to-genesis', from: 'cortex', to: 'genesis', lane: 'memory' },
  { id: 'cortex-to-taste', from: 'cortex', to: 'taste', lane: 'memory' },
  { id: 'cortex-to-build', from: 'cortex', to: 'build', lane: 'memory' },
  { id: 'cortex-to-ops', from: 'cortex', to: 'ops', lane: 'memory' },
];

const recursion = ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio'];

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function statusForNode(node, world, quests) {
  const log = world?.log ?? [];
  const arcIds = new Set((quests?.arcs ?? []).filter((arc) => arc.status === 'complete').map((arc) => arc.id));
  if (node.id === 'cortex') return arcIds.has('the-archive') ? 'complete' : 'memory';
  if (node.id === 'genesis') return world?.artifacts?.seed ? 'complete' : 'pending';
  if (node.id === 'taste') return log.some((line) => line.includes('meso')) ? 'active' : 'pending';
  if (node.id === 'build') return world?.artifacts?.brief ? 'complete' : 'pending';
  if (node.id === 'ops') return log.some((line) => line.includes('viability')) ? 'active' : 'pending';
  return 'pending';
}

export function buildTapestrySnapshot({ root = process.cwd(), tenant = 'demo-org', generatedAt = new Date().toISOString() } = {}) {
  const id = validateTenantId(tenant);
  const opDir = join(root, '.operator');
  const world = readJson(join(opDir, `${id}.world.json`));
  const onboarding = readJson(join(opDir, `${id}.onboarding.json`));
  const project = readJson(join(opDir, `${id}.project.json`));
  const quests = readJson(join(opDir, `${id}.quests.json`));
  const tenants = readJson(join(opDir, 'tenants.json'), []);
  const tenantRecord = tenants.find((entry) => entry.id === id) ?? { id };

  if (!world) {
    throw new Error(`missing world fixture for "${id}"; run: npm run demo:tenant -- --tenant ${id} --force`);
  }

  const nodes = canonicalNodes.map((node) => ({
    ...node,
    status: statusForNode(node, world, quests),
    inputs: node.id === 'cortex' ? ['semantic_memory', 'structural_memory'] : [],
    outputs: node.id === 'cortex' ? ['genesis', 'taste', 'build', 'ops'] : [],
  }));

  return {
    schema: 'cambium.fractal-tapestry.snapshot.v1',
    generatedAt,
    standalone: true,
    tenant: {
      id,
      label: tenantRecord.brand?.label ?? world.brand?.label ?? 'Demo Org',
      vision: tenantRecord.vision ?? world.vision,
      mission: tenantRecord.mission ?? world.mission,
    },
    recursion,
    field,
    nodes,
    rails: canonicalRails,
    telemetry: {
      worldVersion: world.version,
      completedQuestCount: (quests?.arcs ?? []).filter((arc) => arc.status === 'complete').length,
      totalQuestCount: quests?.arcs?.length ?? 0,
      onboardingSteps: onboarding?.stepIndex ?? 0,
      projectArchived: project?.projectArchived ?? false,
      source: quests?.generatedFrom ?? 'tenant-runtime',
    },
    artifacts: {
      seed: world.artifacts?.seed,
      positioning: world.artifacts?.positioning,
      cta: world.artifacts?.cta,
    },
    quests: quests?.arcs ?? [],
  };
}

export function writeTapestrySnapshot({ root = process.cwd(), tenant = 'demo-org', out, generatedAt } = {}) {
  const snapshot = buildTapestrySnapshot({ root, tenant, generatedAt });
  const text = JSON.stringify(snapshot, null, 2) + '\n';
  if (out) {
    const target = resolve(out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    return { snapshot, out: target };
  }
  process.stdout.write(text);
  return { snapshot, out: null };
}

function parseArgs(argv) {
  const args = { root: process.cwd(), tenant: 'demo-org', out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = resolve(argv[++i]);
    else if (arg === '--tenant') args.tenant = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('usage: npm run tapestry:snapshot -- [--root .] [--tenant demo-org] [--out snapshot.json]');
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
    const result = writeTapestrySnapshot(parseArgs(process.argv.slice(2)));
    if (result.out) console.log(`wrote tapestry snapshot: ${result.out}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
