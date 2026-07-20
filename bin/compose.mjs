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
import { handleDeviation } from './lib/whyhandler.mjs';
import { defaultCortex } from './lib/cortex.mjs';
import { validateLeadOps } from './lib/lead-ops.mjs';
import { validateLeadContractCatalog } from './lib/lead-contracts.mjs';
import {
  validateMarketingAssetCatalog,
  validateMarketingCapabilityCatalog,
} from './lib/marketing-orchestration.mjs';
import { validateCreateAdapterCatalog } from './lib/create-adapters.mjs';

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
    subgraph: stage.subgraph ? { ...stage.subgraph } : null,
    requires: stage.requires || [],
    produces: stage.produces || [],
    blocking: stage.blocking || [],
    downstreamEffects: stage.downstream_effects || [],
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
    if (s.requires.length || s.produces.length) {
      lines.push(`     contract: requires [${s.requires.join(', ') || 'none'}] → produces [${s.produces.join(', ') || 'none'}]`);
    }
    if (s.blocking.length) {
      lines.push(`     blocking: ${s.blocking.join(', ')}`);
    }
    for (const effect of s.downstreamEffects) {
      lines.push(`     downstream: ${effect}`);
    }
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

function exactManifestKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (extras.length) throw new Error(`${label} contains unknown fields: ${extras.join(', ')}`);
  if (missing.length) throw new Error(`${label} is missing required fields: ${missing.join(', ')}`);
}

function assertLocalCompositionPath(value, label) {
  if (typeof value !== 'string'
      || value.length === 0
      || value.startsWith('/')
      || value.startsWith('~')
      || value.includes('\\')
      || value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} must be a local composition path`);
  }
}

function validateProductionManifest(manifest) {
  exactManifestKeys(manifest, [
    'id',
    'version',
    'pipeline',
    'lead_ops',
    'create_adapter_catalog',
  ], 'production composition manifest');
  if (manifest.id !== 'production-composition' || manifest.version !== '1.0.0') {
    throw new Error('production composition manifest must remain production-composition@1.0.0');
  }
  exactManifestKeys(manifest.pipeline, ['path'], 'production composition manifest pipeline reference');
  assertLocalCompositionPath(manifest.pipeline.path, 'production composition manifest pipeline path');
  if (manifest.pipeline.path !== 'pipeline.json') {
    throw new Error('production composition manifest pipeline path must remain pipeline.json');
  }
  exactManifestKeys(manifest.lead_ops, ['id', 'version', 'path'], 'production composition manifest lead reference');
  assertLocalCompositionPath(manifest.lead_ops.path, 'production composition manifest lead path');
  if (manifest.lead_ops.id !== 'lead-ops'
      || manifest.lead_ops.version !== '1.0.0'
      || manifest.lead_ops.path !== 'lead-ops.v1.json') {
    throw new Error('production composition manifest lead reference must remain lead-ops@1.0.0');
  }
  exactManifestKeys(
    manifest.create_adapter_catalog,
    ['id', 'version', 'path'],
    'production composition manifest create adapter reference',
  );
  assertLocalCompositionPath(
    manifest.create_adapter_catalog.path,
    'production composition manifest create adapter path',
  );
  if (manifest.create_adapter_catalog.id !== 'create-adapters'
      || manifest.create_adapter_catalog.version !== '1.0.0'
      || manifest.create_adapter_catalog.path !== 'create-adapters.v1.json') {
    throw new Error('production composition manifest create adapter reference must remain create-adapters@1.0.0');
  }
}

function loadReferencedJson(path, label) {
  try {
    return loadJson(path);
  } catch (error) {
    throw new Error(`${label} "${path}" could not be loaded: ${error.message}`);
  }
}

export function loadComposition(root) {
  const compositionRoot = join(root, 'composition');
  const registry = loadJson(join(root, 'registry.json'));
  const production = loadReferencedJson(
    join(compositionRoot, 'production.v1.json'),
    'production composition manifest',
  );
  validateProductionManifest(production);
  const pipeline = loadReferencedJson(
    join(compositionRoot, production.pipeline.path),
    'production pipeline',
  );
  const ops = Array.isArray(pipeline.stages)
    ? pipeline.stages.find((stage) => stage.id === 'ops')
    : null;
  const reference = ops?.subgraph;
  if (!reference || typeof reference !== 'object') {
    throw new Error('ops stage missing required lead subgraph reference');
  }
  if (reference.id !== 'lead-ops' || reference.version !== '1.0.0') {
    throw new Error('ops lead subgraph reference must be lead-ops@1.0.0');
  }
  if (typeof reference.path !== 'string'
    || reference.path.length === 0
    || reference.path.startsWith('/')
    || reference.path.split(/[\\/]/).includes('..')) {
    throw new Error('ops lead subgraph path must be a local composition path');
  }
  if (reference.id !== production.lead_ops.id
      || reference.version !== production.lead_ops.version
      || reference.path !== production.lead_ops.path) {
    throw new Error('production manifest lead reference must match the pipeline ops subgraph exactly');
  }
  const leadOps = loadReferencedJson(
    join(compositionRoot, production.lead_ops.path),
    'lead subgraph',
  );
  const validatedGraph = validateLeadOps(leadOps);
  if (validatedGraph.id !== reference.id || validatedGraph.version !== reference.version) {
    throw new Error('ops lead subgraph reference does not match the resolved graph identity');
  }
  const catalogReference = leadOps.contract_catalog;
  let leadContracts;
  try {
    leadContracts = loadJson(join(compositionRoot, catalogReference.path));
  } catch (error) {
    throw new Error(`lead contract catalog "${catalogReference.path}" could not be loaded: ${error.message}`);
  }
  const validatedCatalog = validateLeadContractCatalog(leadContracts);
  const expectedCatalogId = `${catalogReference.id}@${catalogReference.version}`;
  if (validatedCatalog.catalog_id !== expectedCatalogId) {
    throw new Error(`lead contract catalog identity mismatch: expected ${expectedCatalogId}`);
  }
  validateLeadOps(leadOps, { knownContractIds: validatedCatalog.contract_ids });

  const createAdapters = loadReferencedJson(
    join(compositionRoot, production.create_adapter_catalog.path),
    'create adapter catalog',
  );
  const expectedCreateCatalogId = `${production.create_adapter_catalog.id}@${production.create_adapter_catalog.version}`;
  if (createAdapters.catalog_id !== expectedCreateCatalogId) {
    throw new Error(`create adapter catalog identity mismatch: expected ${expectedCreateCatalogId}`);
  }
  const createReferences = createAdapters.references;
  if (!createReferences || typeof createReferences !== 'object' || Array.isArray(createReferences)) {
    throw new Error('create adapter catalog references are missing');
  }
  exactManifestKeys(createReferences, [
    'marketing_capabilities',
    'marketing_assets',
    'authority_contracts',
  ], 'create adapter catalog references');
  const expectedCreateReferences = {
    marketing_capabilities: {
      id: 'marketing-capabilities',
      version: '1.0.0',
      path: 'composition/marketing-capabilities.v1.json',
    },
    marketing_assets: {
      id: 'marketing-assets',
      version: '1.0.0',
      path: 'composition/contracts/marketing-assets.v1.json',
    },
    authority_contracts: {
      id: 'lead-ecosystem',
      version: '1.0.0',
      path: 'composition/contracts/lead-ecosystem.v1.json',
    },
  };
  for (const [name, catalogReference] of Object.entries(createReferences)) {
    if (!catalogReference || typeof catalogReference !== 'object' || Array.isArray(catalogReference)) {
      throw new Error(`create adapter catalog reference ${name} must be an object`);
    }
    assertLocalCompositionPath(catalogReference.path, `create adapter catalog reference ${name}`);
    const expected = expectedCreateReferences[name];
    if (!expected
        || catalogReference.id !== expected.id
        || catalogReference.version !== expected.version
        || catalogReference.path !== expected.path) {
      throw new Error(`create adapter catalog reference ${name} drifted from its immutable production target`);
    }
  }

  const marketingCapabilities = loadReferencedJson(
    join(root, createReferences.marketing_capabilities.path),
    'marketing capability catalog',
  );
  const validatedCapabilities = validateMarketingCapabilityCatalog(marketingCapabilities);
  const expectedCapabilitiesId = `${createReferences.marketing_capabilities.id}@${createReferences.marketing_capabilities.version}`;
  if (validatedCapabilities.schema_version !== expectedCapabilitiesId) {
    throw new Error(`marketing capability catalog identity mismatch: expected ${expectedCapabilitiesId}`);
  }

  const marketingAssets = loadReferencedJson(
    join(root, createReferences.marketing_assets.path),
    'marketing asset catalog',
  );
  const validatedAssets = validateMarketingAssetCatalog(marketingAssets);
  const expectedAssetsId = `${createReferences.marketing_assets.id}@${createReferences.marketing_assets.version}`;
  if (validatedAssets.catalog_id !== expectedAssetsId) {
    throw new Error(`marketing asset catalog identity mismatch: expected ${expectedAssetsId}`);
  }

  const authorityReference = createReferences.authority_contracts;
  const expectedAuthorityId = `${authorityReference.id}@${authorityReference.version}`;
  if (validatedCatalog.catalog_id !== expectedAuthorityId
      || authorityReference.path !== `composition/${catalogReference.path}`) {
    throw new Error('create adapter authority catalog reference must resolve the production lead authority catalog');
  }

  const validatedCreateAdapters = validateCreateAdapterCatalog(createAdapters, {
    recipeIds: validatedCapabilities.recipe_ids,
    marketingContractIds: validatedAssets.contract_ids,
    authorityContractIds: validatedCatalog.contract_ids,
  });
  return {
    registry,
    production,
    pipeline,
    leadOps,
    leadContracts,
    leadContractIds: validatedCatalog.contract_ids,
    marketingCapabilities,
    marketingAssets,
    createAdapters,
    createAdapterIds: validatedCreateAdapters.adapter_ids,
    createAdapterActivation: validatedCreateAdapters.activation_value,
  };
}

// the ONLY real spawn in Cambium — reached solely when the fail-closed gate allows it
function realRunner(inv) {
  const r = spawnSync(inv.cmd, inv.args, { cwd: inv.cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

export function parseRunArgs(rest) {
  const flags = { tenant: undefined, execute: false, approve: null, stage: null, input: null, intent: null };
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
    } else if (a === '--intent') {
      const v = valueOf(rest, i);
      if (v !== undefined) { flags.intent = v; i++; }
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
async function runCmd(root, { tenant, execute, approve, stage, input, intent }) {
  if (execute && !tenant) {
    console.log('refused: --execute requires a tenant — compose run <tenant> --execute --approve <stage>');
    return 2;
  }
  const { registry, pipeline } = loadComposition(root);
  const adapters = loadJson(join(root, 'adapters.json')).adapters;
  const cortex = defaultCortex(root); // I3: the why-handler writes through the unified cortex interface
  let stages = pipeline.stages;
  if (stage) {
    stages = stages.filter((s) => s.id === stage);
    if (!stages.length) {
      console.log(`unknown stage "${stage}" — stages: ${pipeline.stages.map((s) => s.id).join(', ')}`);
      return 1;
    }
  }
  // runPipeline threads each stage's output → the next stage's input (the hand-off)
  let results;
  try {
    results = await runPipeline({
      stages, registry, adapters, cambiumRoot: root, env: process.env,
      tenant, execute, approve, runner: realRunner, seedInput: input,
    });
  } catch (error) {
    console.log(`fail-closed: ${error.message}`);
    return 1;
  }
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
      if (res.contract && !res.contract.ok) {
        // I4: route the drift signal through the why-handler (classify → resolve → record)
        const { classification, resolution, line } = handleDeviation(
          { stage: res.stage, reason: res.contract.reason },
          { intent, ts: new Date().toISOString() },
        );
        try { cortex.writeDeviation(line); } catch { /* ledger best-effort — drift-logging stays non-fatal */ } // I3: through the unified cortex (local transport now; the CF Worker swaps in)
        lines.push(`     ⚠ drift — ${res.contract.reason}`);
        lines.push(`     ↳ why-handler: ${classification.kind} → ${resolution.action}${resolution.rationale ? ` ("${resolution.rationale}")` : ''}`);
        if (classification.kind === 'error') lines.push(`     ↳ if intentional (a redirect, not an error): re-run with --intent ${res.stage} (then say why)`);
      }
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
    const {
      registry,
      pipeline,
      leadOps,
      createAdapterIds,
    } = loadComposition(root);
    const plan = planPipeline({ registry, pipeline, tenant: cmd === 'plan' ? rest[0] : '<validate>' });
    if (cmd === 'plan') {
      console.log(formatPlan(plan));
    } else {
      const nOrgans = Object.keys(registry.organs).length;
      console.log(`✓ registry + pipeline valid — ${pipeline.stages.length} top-level stages, ${leadOps.stages.length} lead stages, ${createAdapterIds.length} disabled create adapter, ${nOrgans} organs, all resolve`);
    }
    return 0;
  }
  if (cmd === 'run') {
    return runCmd(root, parseRunArgs(rest));
  }
  console.log('usage: compose <plan|validate|run> [tenant] [--execute] [--approve <stage>] [--intent <stage>]');
  return cmd ? 1 : 0;
}

// ───────────────────────── isMain CLI guard ─────────────────────────

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  main(process.argv.slice(2), root).then((code) => process.exit(code));
}
