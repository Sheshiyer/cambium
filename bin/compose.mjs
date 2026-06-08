#!/usr/bin/env node
// Cambium — the composition conductor (DRY-RUN).
//
// Loads the organ registry + the per-tenant pipeline, resolves every stage's
// organ, and prints/validates the composition plan. It PLANS the constellation;
// it does NOT execute the organs end-to-end (that is wire I2). Zero-dep, Node ESM.
//
//   compose plan [tenant]   — print the genesis→taste→build→ops plan for a tenant
//   compose validate        — assert every organ resolves; non-zero on failure
//
// Design: a PURE core (planPipeline/formatPlan take injected {registry,pipeline};
// no disk, no network) + a thin I/O shell (loadJson + main) that is the only place
// the filesystem is touched. Importable for tests via the isMain guard at the end.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ───────────────────────── pure core (no I/O) ─────────────────────────

/**
 * Resolve a pipeline against a registry into an ordered, organ-resolved plan.
 * Throws loudly if an organ referenced by a stage is not in the registry.
 * @param {{registry: object, pipeline: object, tenant?: string}} args
 */
export function planPipeline({ registry, pipeline, tenant } = {}) {
  if (!registry || typeof registry.organs !== 'object') {
    throw new Error('registry.organs missing — not a valid registry');
  }
  if (!pipeline || !Array.isArray(pipeline.stages)) {
    throw new Error('pipeline.stages missing — not a valid pipeline');
  }
  // resolve an organ id → the fields every consumer needs, or throw loudly
  const organOf = (organId, where) => {
    const organ = registry.organs[organId];
    if (!organ) {
      throw new Error(`unknown organ "${organId}" for ${where} — not in registry.json`);
    }
    return {
      organ: organId,
      organName: organ.name,
      repo: organ.repo,
      tier: organ.tier,
      entrypoint: organ.entrypoint,
    };
  };
  const steps = pipeline.stages.map((stage, i) => ({
    order: i + 1,
    stage: stage.id,
    title: stage.title,
    ...organOf(stage.organ, `stage "${stage.id}"`),
    input: stage.input,
    output: stage.output,
  }));
  const crosscutting = (pipeline.crosscutting || []).map((c) => ({
    id: c.id,
    title: c.title,
    ...organOf(c.organ, `crosscutting "${c.id}"`),
    feeds: c.feeds || [],
  }));
  return { tenant: tenant || '<tenant>', steps, crosscutting };
}

const tierTag = (tier) => (tier === 'paid' ? '💲 paid' : '○ free');

/** Render a plan (from planPipeline) as human-readable text. Pure. */
export function formatPlan(plan) {
  const lines = [];
  lines.push(`Cambium composition plan — tenant: ${plan.tenant}`);
  lines.push('idea → genesis → taste → build → ops   (cortex feeds all)');
  lines.push('');
  for (const s of plan.steps) {
    lines.push(`  ${s.order}. ${s.stage.padEnd(8)} → ${s.organName}  [${tierTag(s.tier)}]`);
    lines.push(`     ${s.input} → ${s.output}   ·   ${s.repo}`);
    lines.push(`     ↳ ${s.entrypoint}`);
    lines.push('');
  }
  for (const c of plan.crosscutting) {
    lines.push(`  ⟳ ${c.title} (${c.id})  [${tierTag(c.tier)}]  feeds: ${c.feeds.join(', ')}`);
    lines.push(`     ${c.repo}`);
  }
  return lines.join('\n');
}

// ───────────────────────── I/O shell (disk only here) ─────────────────────────

/** Read + parse a JSON file. The only filesystem entry point. */
export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function load(root) {
  return {
    registry: loadJson(join(root, 'registry.json')),
    pipeline: loadJson(join(root, 'composition', 'pipeline.json')),
  };
}

export function main(argv, root) {
  const [cmd, tenant] = argv;
  if (cmd !== 'plan' && cmd !== 'validate') {
    console.log('usage: compose <plan|validate> [tenant]');
    return cmd ? 1 : 0; // unknown cmd → error; bare `compose` → 0
  }
  const { registry, pipeline } = load(root);
  // validate reuses planPipeline: resolving every stage IS the validation
  const plan = planPipeline({ registry, pipeline, tenant: cmd === 'plan' ? tenant : '<validate>' });
  if (cmd === 'plan') {
    console.log(formatPlan(plan));
  } else {
    const nOrgans = Object.keys(registry.organs).length;
    console.log(`✓ registry + pipeline valid — ${pipeline.stages.length} stages, ${nOrgans} organs, all resolve`);
  }
  return 0;
}

// ───────────────────────── isMain CLI guard ─────────────────────────

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  process.exit(main(process.argv.slice(2), root));
}
