#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileMarketingPlan,
  evaluateManualMarketingLoop,
  runOfflineMarketingProof,
  validateMarketingAssetCatalog,
  validateMarketingCapabilityCatalog,
} from './lib/marketing-orchestration.mjs';

function fail(message) {
  throw new Error(`marketing orchestration CLI: ${message}`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['validate', 'plan', 'proof', 'loop-plan', 'loop'].includes(command)) {
    fail('command must be validate, plan, proof, loop-plan, or loop');
  }
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (!['--catalog', '--assets', '--fixture', '--now', '--seed', '--loop-id', '--outcome'].includes(option)) {
      fail(`unknown argument ${option}`);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) fail(`${option} requires a value`);
    options[option.slice(2)] = value;
    index += 1;
  }
  return options;
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function deterministicDependencies(options) {
  if (!options.now) fail('--now is required for deterministic proof or loop execution');
  if (!options.seed) fail('--seed is required for deterministic proof or loop execution');
  return {
    clock: () => options.now,
    seed: () => options.seed,
    network: () => {
      throw new Error('network sentinel: marketing orchestration is offline');
    },
  };
}

function redactedProofProjection(result) {
  if (result.status === 'blocked') {
    return {
      status: result.status,
      reason_code: result.reason_code,
      proof_digest: result.proof_digest,
      evidence_gap_brief: result.evidence_gap_brief,
      receipt: result.receipt,
    };
  }
  return {
    status: result.status,
    proof_digest: result.proof_digest,
    receipt: result.receipt,
    package: {
      record_id: result.package.record_id,
      package_digest: result.package.package_digest,
      rights_state: result.package.rights_state,
      approval_state: result.package.approval_state,
      publish_eligible: result.package.publish_eligible,
      execution_mode: result.package.execution_mode,
      accessibility_companion: result.package.accessibility_companion,
    },
  };
}

export async function runCli(argv) {
  const options = parseArgs(argv);
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const paths = {
    catalog: resolve(options.catalog ?? join(root, 'composition', 'marketing-capabilities.v1.json')),
    assets: resolve(options.assets ?? join(root, 'composition', 'contracts', 'marketing-assets.v1.json')),
    fixture: resolve(options.fixture ?? join(root, 'examples', 'marketing-orchestration', 'founder-article.synthetic.json')),
  };
  const capabilities = await loadJson(paths.catalog);
  const assets = await loadJson(paths.assets);

  if (options.command === 'validate') {
    const catalog = validateMarketingCapabilityCatalog(capabilities);
    const assetCatalog = validateMarketingAssetCatalog(assets);
    return {
      valid: true,
      mode: 'offline-review-only',
      capability_count: catalog.capability_count,
      capability_set_digest: catalog.capability_set_digest,
      orchestration_set_digest: catalog.orchestration_set_digest,
      recipe_count: catalog.recipe_ids.length,
      loop_count: catalog.loop_ids.length,
      asset_contract_count: assetCatalog.contract_ids.length,
    };
  }

  const fixture = await loadJson(paths.fixture);
  if (options.command === 'loop-plan') {
    const loopId = options['loop-id'] ?? 'content-decay@1.0.0';
    const loop = capabilities.loops.find(({ id }) => id === loopId);
    if (!loop) fail(`unknown loop ${loopId}`);
    return {
      status: loop.status,
      loop_id: loop.id,
      cadence: loop.cadence,
      acts_when: loop.acts_when,
      capability_sequence: loop.capability_sequence,
      body: loop.body,
      self_checks: loop.self_checks,
      state_policy: loop.state_policy,
      idempotency_policy: loop.idempotency_policy,
      stop_condition: loop.stop_condition,
      error_bailout: loop.error_bailout,
      output_destination: loop.output_destination,
      schedule_armed: loop.schedule_armed,
      execution_mode: loop.execution_mode,
      live_adapters: loop.live_adapters,
    };
  }
  const dependencies = deterministicDependencies(options);
  if (options.command === 'plan') {
    const outcomeId = options.outcome ?? 'founder_article';
    const recipe = capabilities.recipes.find(({ primary_asset_type: outcome }) => outcome === outcomeId);
    if (!recipe) fail(`unknown outcome ${outcomeId}`);
    const request = {
      ...structuredClone(fixture.request),
      outcome_id: outcomeId,
      channel_outcome: recipe.channel_outputs[0],
    };
    const plan = compileMarketingPlan(capabilities, request, dependencies);
    return {
      status: 'compiled',
      outcome_id: outcomeId,
      recipe_id: plan.recipe_id,
      plan_digest: plan.plan_digest,
      source_commit: plan.source_commit,
      source_closure_digest: plan.source_closure_digest,
      semantic_steps: plan.semantic_steps,
      contract_ids: plan.contract_ids,
      execution_mode: plan.execution_mode,
      live_adapters: plan.live_adapters,
    };
  }
  if (options.command === 'loop') {
    return evaluateManualMarketingLoop(
      capabilities,
      {
        loop_id: options['loop-id'] ?? 'content-decay@1.0.0',
        observation: fixture.loop_observation,
      },
      dependencies,
    );
  }

  return redactedProofProjection(
    runOfflineMarketingProof({ capabilities, assets, fixture }, dependencies),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
