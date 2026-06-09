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
import { spawnSync } from 'node:child_process';
import { runPipeline } from './lib/invoke.mjs';

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

// the ONLY real spawn in Cambium — reached solely when the fail-closed gate allows it
function realRunner(inv) {
  const r = spawnSync(inv.cmd, inv.args, { cwd: inv.cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

export function parseRunArgs(rest) {
  const flags = { tenant: undefined, execute: false, approve: null, stage: null, input: null };
  const valueOf = (rest, i) => {
    const next = rest[i + 1];
    return next !== undefined && !next.startsWith('--') ? next : undefined;
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--execute') {
      flags.execute = true;
    } else if (a === '--approve') {
      const v = valueOf(rest, i); // dangling --approve stays null — fail-safe
      if (v !== undefined) { flags.approve = v; i++; }
    } else if (a === '--stage') {
      const v = valueOf(rest, i);
      if (v !== undefined) { flags.stage = v; i++; }
    } else if (a === '--input') {
      const v = rest[i + 1]; // input may legitimately be any string (e.g. a path)
      if (v !== undefined) { flags.input = v; i++; }
    } else if (!a.startsWith('--') && flags.tenant === undefined) {
      flags.tenant = a;
    }
  }
  return flags;
}

// `run` — call each organ adapter along the pipeline, FAIL-CLOSED on spend.
// Dry-run (default) prints the exact command per stage; --execute spawns only stages
// explicitly approved (--approve <stage>); spend-gated stages otherwise refuse.
async function runCmd(root, { tenant, execute, approve, stage, input }) {
  if (execute && !tenant) {
    console.log('refused: --execute requires a tenant — compose run <tenant> --execute --approve <stage>');
    return 2;
  }
  const { registry, pipeline } = load(root);
  const adapters = loadJson(join(root, 'adapters.json')).adapters;
  let stages = pipeline.stages;
  if (stage) {
    stages = stages.filter((s) => s.id === stage);
    if (!stages.length) {
      console.log(`unknown stage "${stage}" — stages: ${pipeline.stages.map((s) => s.id).join(', ')}`);
      return 1;
    }
  }
  // runPipeline threads each stage's output → the next stage's input (the hand-off)
  const results = await runPipeline({
    stages, registry, adapters, cambiumRoot: root, env: process.env,
    tenant, execute, approve, runner: realRunner, seedInput: input,
  });
  const byStage = Object.fromEntries(results.map((r) => [r.stage, r]));
  const mode = execute ? (approve ? `--execute --approve ${approve}` : '--execute') : 'dry-run';
  const lines = [`Cambium run — tenant: ${tenant || '<tenant>'}  (${mode})`, ''];
  let spawned = 0;
  let refused = 0;
  for (const sdef of stages) {
    const res = byStage[sdef.id];
    const flow = `[${sdef.input} → ${sdef.output}]`; // the declared contract hand-off
    if (res.adapter === false) { lines.push(`  ${sdef.id.padEnd(8)} ${flow} · no adapter yet (planned)`); continue; }
    const inv = res.invocation;
    const from = res.inputFrom === 'prev-stage' ? '  ⟸ input from prior stage' : '';
    lines.push(`  ${sdef.id.padEnd(8)} ${flow} · ${inv.spend === 'gated' ? '💲 spend-gated' : '○ free'}${from}`);
    lines.push(`     ↳ cd ${inv.cwd} && ${inv.cmd} ${inv.args.join(' ')}`);
    if (res.spawned) {
      spawned++;
      lines.push(`     ▶ spawned (exit ${res.result.status})`);
      if (res.contract && !res.contract.ok) lines.push(`     ⚠ drift — ${res.contract.reason}`);
    } else { if (execute) refused++; lines.push(`     ⛔ ${res.gate.reason}`); }
  }
  lines.push('');
  lines.push(execute
    ? `${spawned} spawned · ${refused} refused (fail-closed).`
    : `dry-run — the flow above is genesis→taste→build→ops; each stage's output feeds the next. Execute a stage: compose run ${tenant || '<tenant>'} --execute --approve <stage>`);
  console.log(lines.join('\n'));
  return execute && refused > 0 ? 2 : 0;
}

export async function main(argv, root) {
  const [cmd, ...rest] = argv;
  if (cmd === 'plan' || cmd === 'validate') {
    const { registry, pipeline } = load(root);
    const plan = planPipeline({ registry, pipeline, tenant: cmd === 'plan' ? rest[0] : '<validate>' });
    if (cmd === 'plan') {
      console.log(formatPlan(plan));
    } else {
      const nOrgans = Object.keys(registry.organs).length;
      console.log(`✓ registry + pipeline valid — ${pipeline.stages.length} stages, ${nOrgans} organs, all resolve`);
    }
    return 0;
  }
  if (cmd === 'run') {
    return runCmd(root, parseRunArgs(rest));
  }
  console.log('usage: compose <plan|validate|run> [tenant] [--execute] [--approve <stage>]');
  return cmd ? 1 : 0;
}

// ───────────────────────── isMain CLI guard ─────────────────────────

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  main(process.argv.slice(2), root).then((code) => process.exit(code));
}
