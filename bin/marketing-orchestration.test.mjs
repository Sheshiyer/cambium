import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileMarketingPlan,
  evaluateManualMarketingLoop,
  assessReviewPackageBridgeReadiness,
  runOfflineMarketingProof,
  validateMarketingAssetCatalog,
  validateMarketingCapabilityCatalog,
} from './lib/marketing-orchestration.mjs';
import { runCli } from './marketing-orchestration.mjs';
import {
  canonicalDigest,
  validateContractInstance,
  validateLeadContractCatalog,
} from './lib/lead-contracts.mjs';
import { validateLeadOps } from './lib/lead-ops.mjs';
import { validateSpendPolicy } from './lib/spend-policy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const clone = (value) => structuredClone(value);

async function loadJson(relativePath) {
  return JSON.parse(await readFile(join(root, relativePath), 'utf8'));
}

async function inputs() {
  return {
    capabilities: await loadJson('composition/marketing-capabilities.v1.json'),
    assets: await loadJson('composition/contracts/marketing-assets.v1.json'),
    fixture: await loadJson('examples/marketing-orchestration/founder-article.synthetic.json'),
    leadCatalog: await loadJson('composition/contracts/lead-ecosystem.v1.json'),
    leadGraph: await loadJson('composition/lead-ops.v1.json'),
  };
}

test('runtime compiler exposes no network, secret, or scheduler primitive', async () => {
  const runtimeSource = [
    await readFile(join(root, 'bin/lib/marketing-orchestration.mjs'), 'utf8'),
    await readFile(join(root, 'bin/marketing-orchestration.mjs'), 'utf8'),
  ].join('\n');
  for (const forbidden of [
    /\bfetch\s*\(/,
    /process\.env/,
    /setInterval\s*\(/,
    /setTimeout\s*\(/,
    /node:(?:http|https|net|tls)/,
    /child_process/,
  ]) {
    assert.doesNotMatch(runtimeSource, forbidden);
  }
});

test('pins the official 47-skill source and exact 45-loop observation', async () => {
  const { capabilities } = await inputs();
  const result = validateMarketingCapabilityCatalog(capabilities);

  assert.equal(result.valid, true);
  assert.equal(capabilities.source.repository, 'https://github.com/coreyhaines31/marketingskills');
  assert.equal(capabilities.source.commit, '67264763cb107d61749f418d081c56e5bcbc0209');
  assert.equal(capabilities.source.license.spdx, 'MIT');
  assert.equal(
    capabilities.source.license.sha256,
    'b70d71e24e40fce5da8f4b6f9cd862096a048e433db7f3c8cac5e348e6d34591',
  );
  assert.equal(capabilities.source.skill_count, 47);
  assert.equal(capabilities.source.loop_definition_count, 45);
  assert.equal(
    capabilities.source.capability_set_digest,
    '7147c3e52094acce76e4cba08d0131eef40292d4c4ecab54a61013253f56faf5',
  );
  assert.equal(capabilities.capabilities.length, 47);
  assert.equal(new Set(capabilities.capabilities.map(({ id }) => id)).size, 47);
});

test('curates every capability and keeps execution authority structurally absent', async () => {
  const { capabilities } = await inputs();
  validateMarketingCapabilityCatalog(capabilities);

  const used = new Set([
    ...capabilities.recipes.flatMap(({ capability_chain: chain }) => chain),
    ...capabilities.loops.flatMap(({ capability_sequence: sequence }) => sequence),
  ]);
  for (const capability of capabilities.capabilities) {
    assert.match(capability.source_closure_digest, /^[a-f0-9]{64}$/);
    assert.ok(['eligible', 'reference_only', 'excluded'].includes(capability.curation_state));
    assert.ok([
      'context',
      'research',
      'strategy',
      'creation',
      'optimization',
      'distribution-planning',
      'measurement',
      'orchestration',
    ].includes(capability.classification));
    assert.deepEqual(capability.execution_envelope, {
      network: 'none',
      authentication: 'none',
      external_write: 'none',
      spend: 'none',
      schedule: 'none',
    });
    assert.equal(capability.max_execution_class, 'review_only');
    assert.ok(capability.prohibited_output_actions.includes('publish'));
    assert.ok(capability.prohibited_output_actions.includes('send'));
    assert.ok(capability.prohibited_output_actions.includes('spend'));
    assert.ok(capability.channel_support.length > 0);
    for (const channel of capability.channel_support) {
      assert.ok(['supported', 'unsupported'].includes(channel.status));
    }
    if (capability.curation_state === 'eligible') {
      assert.ok(used.has(capability.id), `${capability.id} must be used by a bounded recipe or loop`);
      assert.deepEqual(capability.semantic_fixture_ids, [
        `upstream-eval:${capability.upstream_directory}@${capability.upstream_version}`,
      ]);
    } else {
      assert.ok(capability.curation_reason.length > 0);
    }
  }
});

test('fails closed on duplicate, unknown, unpinned, path-escaping, and authority-bearing capabilities', async () => {
  const { capabilities } = await inputs();

  const duplicate = clone(capabilities);
  duplicate.capabilities[1].id = duplicate.capabilities[0].id;
  assert.throws(() => validateMarketingCapabilityCatalog(duplicate), /duplicate capability id/i);

  const unknownClass = clone(capabilities);
  unknownClass.capabilities[0].classification = 'growth-hacking';
  assert.throws(() => validateMarketingCapabilityCatalog(unknownClass), /classification/i);

  const unpinned = clone(capabilities);
  unpinned.source.commit = 'main';
  assert.throws(() => validateMarketingCapabilityCatalog(unpinned), /immutable.*commit/i);

  const escaping = clone(capabilities);
  escaping.capabilities[0].upstream_directory = '../outside';
  assert.throws(() => validateMarketingCapabilityCatalog(escaping), /path|directory/i);

  const authority = clone(capabilities);
  authority.capabilities[0].execution_envelope.network = 'provider';
  assert.throws(() => validateMarketingCapabilityCatalog(authority), /execution envelope|offline-zero/i);

  const forgedClosure = clone(capabilities);
  forgedClosure.capabilities[0].source_closure_digest = 'f'.repeat(64);
  assert.throws(() => validateMarketingCapabilityCatalog(forgedClosure), /capability set digest/i);

  const swappedRecipe = clone(capabilities);
  const founder = swappedRecipe.recipes.find(({ id }) => id === 'founder-article-draft@1.0.0');
  founder.capability_chain[1] = 'analytics@2.0.0';
  assert.throws(() => validateMarketingCapabilityCatalog(swappedRecipe), /orchestration set|definitions drifted/i);
});

test('defines six closed internal asset contracts with valid examples', async () => {
  const { assets } = await inputs();
  const result = validateMarketingAssetCatalog(assets);
  const expected = [
    'asset_brief@1.0.0',
    'asset_recipe@1.0.0',
    'asset_draft@1.0.0',
    'asset_variant@1.0.0',
    'asset_quality_report@1.0.0',
    'channel_package@1.0.0',
  ];

  assert.equal(result.valid, true);
  assert.deepEqual(assets.contracts.map(({ id }) => id).sort(), expected.sort());
  for (const contract of assets.contracts) {
    assert.equal(contract.owner, 'cambium');
    assert.equal(contract.category, 'capability');
    assert.equal(contract.stage, 'create');
    assert.equal(contract.schema.additionalProperties, false);
    assert.equal(validateContractInstance(assets, contract.id, contract.example).valid, true);
  }
  for (const [contractId, digestField] of [
    ['asset_recipe@1.0.0', 'plan_digest'],
    ['channel_package@1.0.0', 'package_digest'],
  ]) {
    const example = clone(assets.contracts.find(({ id }) => id === contractId).example);
    const storedDigest = example[digestField];
    delete example[digestField];
    assert.equal(storedDigest, canonicalDigest(example));
  }
  const channelPackage = assets.contracts.find(({ id }) => id === 'channel_package@1.0.0');
  assert.ok(channelPackage.schema.required.includes('accessibility_companion'));
});

test('compiles eight organic recipes and five manual loops but executes one of each honestly', async () => {
  const { capabilities, assets, fixture } = await inputs();
  validateMarketingCapabilityCatalog(capabilities);

  assert.equal(capabilities.recipes.length, 8);
  assert.equal(capabilities.loops.length, 5);
  assert.equal(capabilities.recipes.filter(({ status }) => status === 'executed').length, 1);
  assert.equal(capabilities.loops.filter(({ status }) => status === 'executed').length, 1);

  for (const item of [...capabilities.recipes, ...capabilities.loops]) {
    assert.equal(item.execution_mode, 'review_only');
    assert.deepEqual(item.live_adapters, []);
    assert.ok(['compiled', 'executed'].includes(item.status));
    assert.deepEqual(item.execution_envelope, {
      network: 'none',
      authentication: 'none',
      external_write: 'none',
      spend: 'none',
      schedule: 'none',
    });
  }
  for (const recipe of capabilities.recipes) {
    assert.ok(recipe.founder_job.length > 0);
    assert.ok(recipe.primary_asset_type.length > 0);
    assert.ok(recipe.purpose_metric.length > 0);
    assert.ok(recipe.self_checks.length > 0);
    assert.equal(recipe.approval_checkpoint.required, true);
    assert.equal(recipe.approval_checkpoint.decision_scope, 'exact_package_digest');
    assert.ok(recipe.review_budget.max_minutes > 0);
    assert.ok(recipe.review_budget.max_reviewers > 0);
    assert.equal(recipe.accessibility_companion.required, true);
    assert.deepEqual(validateSpendPolicy({ spend: recipe.spend }), {
      ok: true,
      policy: { tier: 'none' },
    });
    assert.equal(recipe.low_budget_quote.runtime_enabled, false);
    assert.ok(recipe.low_budget_quote.maximum_per_run >= 0);
    assert.ok(recipe.low_budget_quote.billing_unit.length > 0);
    assert.match(recipe.low_budget_quote.quote_expires_at, /Z$/);
    assert.equal(
      recipe.low_budget_quote.zero_spend_precursor_contract,
      'channel_package@1.0.0',
    );
  }
  for (const loop of capabilities.loops) {
    assert.equal(loop.cadence.mode, 'manual_check_only');
    assert.equal(loop.cadence.schedule_armed, false);
    assert.ok(loop.purpose_metric.length > 0);
    assert.ok(loop.body.maximum_steps > 0);
    assert.ok(loop.body.steps.length > 0);
    assert.ok(loop.self_checks.length > 0);
    assert.ok(Object.keys(loop.state_policy).length > 0);
    assert.ok(Object.keys(loop.idempotency_policy).length > 0);
    assert.ok(loop.stop_condition.length > 0);
    assert.ok(loop.error_bailout.length > 0);
    assert.ok(loop.manual_outcomes.length > 0);
    assert.deepEqual(loop.run_identity_fields, [
      'tenant_id',
      'loop_version',
      'observation_window',
      'input_digest',
    ]);
    assert.equal(loop.cursor_policy, 'advance_after_fenced_durable_artifact_receipt');
    assert.equal(loop.missed_cadence_policy, 'no_catch_up_without_approved_backfill');
    assert.equal(loop.output_destination, 'review_queue');
    assert.equal(loop.schedule_armed, false);
    assert.deepEqual(validateSpendPolicy({ spend: loop.spend }), {
      ok: true,
      policy: { tier: 'none' },
    });
    assert.equal(loop.low_budget_quote.runtime_enabled, false);
  }

  const plans = capabilities.recipes.map((recipe, index) => compileMarketingPlan(
    capabilities,
    {
      ...fixture.request,
      outcome_id: recipe.primary_asset_type,
      channel_outcome: recipe.channel_outputs[0],
    },
    {
      clock: () => '2026-07-18T12:00:00.000Z',
      seed: () => `recipe-plan-${index}`,
    },
  ));
  assert.equal(new Set(plans.map(({ plan_digest: digest }) => digest)).size, 8);
  for (const plan of plans) {
    assert.deepEqual(
      plan.semantic_steps.map(({ capability_id: id }) => id),
      plan.capability_chain,
    );
    assert.ok(plan.semantic_steps.every(({ quality_checks: checks }) => checks.length > 0));
  }

  const compiledRecipes = capabilities.recipes.filter(({ status }) => status === 'compiled');
  assert.equal(compiledRecipes.length, 7);
  for (const [index, recipe] of compiledRecipes.entries()) {
    const deferredFixture = clone(fixture);
    deferredFixture.request.outcome_id = recipe.primary_asset_type;
    deferredFixture.request.channel_outcome = recipe.channel_outputs[0];
    assert.throws(
      () => runOfflineMarketingProof(
        { capabilities, assets, fixture: deferredFixture },
        {
          clock: () => '2026-07-18T12:00:00.000Z',
          seed: () => `deferred-recipe-${index}`,
        },
      ),
      /compiled.*no executable adapter proof/i,
    );
  }

  const compiledLoops = capabilities.loops.filter(({ status }) => status === 'compiled');
  assert.equal(compiledLoops.length, 4);
  for (const [index, loop] of compiledLoops.entries()) {
    assert.throws(
      () => evaluateManualMarketingLoop(
        capabilities,
        { loop_id: loop.id, observation: fixture.loop_observation },
        {
          clock: () => '2026-07-18T12:00:00.000Z',
          seed: () => `deferred-loop-${index}`,
        },
      ),
      /compiled.*no executable adapter proof/i,
    );
  }
});

test('compiles and replays one full zero-spend founder article path without network access', async () => {
  const {
    capabilities, assets, fixture,
  } = await inputs();
  let networkCalls = 0;
  const deps = {
    clock: () => '2026-07-18T12:00:00.000Z',
    seed: () => 'marketing-proof-seed-v1',
    network: () => {
      networkCalls += 1;
      throw new Error('network sentinel: forbidden');
    },
  };

  const first = runOfflineMarketingProof({ capabilities, assets, fixture }, deps);
  const reorderedFixture = clone(fixture);
  reorderedFixture.request.evidence_snapshot.claims.reverse();
  const second = runOfflineMarketingProof(
    { capabilities: clone(capabilities), assets: clone(assets), fixture: reorderedFixture },
    deps,
  );

  assert.equal(networkCalls, 0);
  assert.deepEqual(first, second);
  assert.deepEqual(first.path, ['parsed', 'planned', 'review_gated', 'receipted']);
  assert.equal(first.status, 'awaiting_human_approval');
  assert.equal(first.execution_mode, 'review_only');
  assert.equal(first.network_calls, 0);
  assert.equal(first.package.publish_eligible, false);
  assert.equal(first.package.approval_state, 'awaiting_human_approval');
  assert.equal(first.package.rights_state, 'review_required');
  assert.equal(first.package.accessibility_companion.required, true);
  assert.equal(first.receipt.redaction_applied, true);
  assert.equal(first.receipt.next_action, 'review_exact_package_digest');
  assert.equal(first.receipt.artifact_count, 5);
  assert.equal(first.receipt.replay_safe, true);
  assert.ok(!Object.hasOwn(first.receipt, 'body'));
  assert.ok(!Object.hasOwn(first.receipt, 'identity'));
  assert.match(first.proof_digest, /^[a-f0-9]{64}$/);
  assert.match(first.plan.recipe_digest, /^[a-f0-9]{64}$/);
  assert.match(first.plan.source_closure_digest, /^[a-f0-9]{64}$/);
  assert.equal(first.plan.compiler_version, '1.0.0');
  assert.ok(first.plan.contract_ids.includes('asset_brief@1.0.0'));
  assert.ok(first.plan.contract_ids.includes('channel_package@1.0.0'));
  assert.ok(first.plan.capability_versions.length > 0);
  assert.equal(first.plan.source_commit, capabilities.source.commit);
  assert.equal(first.plan.recipe_id, 'founder-article-draft@1.0.0');
  assert.deepEqual(
    first.semantic_execution.operation_receipts.map(({ operation }) => operation),
    first.plan.semantic_steps.map(({ operation }) => operation),
  );
  assert.equal(first.semantic_execution.applied_operation_count, 4);
  assert.equal(first.quality_report.score_scope, 'structural_review_readiness');
  assert.equal(first.brief.product_packet_id, fixture.request.product_packet.packet_id);
  assert.equal(first.brief.product_packet_version, fixture.request.product_packet.packet_version);
  assert.equal(
    first.brief.evidence_snapshot_digest,
    fixture.request.evidence_snapshot.snapshot_digest,
  );
  assert.ok(first.package.attribution.length > 0);
  assert.deepEqual(first.package.asset_digests, first.drafts.map(({ content_digest: value }) => value));

  const plannedOnly = clone(fixture);
  plannedOnly.request.outcome_id = 'social_draft_set';
  plannedOnly.request.channel_outcome = 'social';
  assert.throws(
    () => runOfflineMarketingProof({ capabilities, assets, fixture: plannedOnly }, deps),
    /compiled.*no executable adapter proof/i,
  );
});

test('missing evidence yields a recovery brief and zero factual drafts', async () => {
  const {
    capabilities, assets, fixture,
  } = await inputs();
  const missing = clone(fixture);
  missing.request.evidence_snapshot.claims = [];
  missing.request.evidence_snapshot.snapshot_digest = canonicalDigest({
    observed_at: missing.request.evidence_snapshot.observed_at,
    claims: [],
  });

  const result = runOfflineMarketingProof(
    { capabilities, assets, fixture: missing },
    {
      clock: () => '2026-07-18T12:00:00.000Z',
      seed: () => 'marketing-proof-seed-v1',
      network: () => {
        throw new Error('network sentinel');
      },
    },
  );

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason_code, 'required_evidence_missing');
  assert.deepEqual(result.drafts, []);
  assert.equal(result.evidence_gap_brief.recovery_action, 'attach_verified_product_evidence');
});

test('evidence lineage and recipe channel routing fail closed on semantic drift', async () => {
  const { capabilities, assets, fixture } = await inputs();
  const deps = {
    clock: () => '2026-07-18T12:00:00.000Z',
    seed: () => 'marketing-proof-seed-v1',
    network: () => {
      throw new Error('network sentinel');
    },
  };

  const tamperedEvidence = clone(fixture);
  tamperedEvidence.request.evidence_snapshot.claims[0].statement = 'Unbound replacement claim.';
  assert.throws(
    () => runOfflineMarketingProof({ capabilities, assets, fixture: tamperedEvidence }, deps),
    /snapshot_digest.*canonical observed claims/i,
  );

  const wrongChannel = clone(fixture);
  wrongChannel.request.channel_outcome = 'video_short';
  assert.throws(
    () => runOfflineMarketingProof({ capabilities, assets, fixture: wrongChannel }, deps),
    /does not support channel outcome/i,
  );

  const tamperedProduct = clone(fixture);
  tamperedProduct.request.product_packet.promise = 'Unbound replacement promise.';
  assert.throws(
    () => runOfflineMarketingProof({ capabilities, assets, fixture: tamperedProduct }, deps),
    /value_digest does not bind the current product field value/i,
  );
});

test('founder CLI exposes a redacted validate, proof, and manual-loop surface', async () => {
  const validated = await runCli(['validate']);
  assert.deepEqual(validated, {
    valid: true,
    mode: 'offline-review-only',
    capability_count: 47,
    capability_set_digest: '7147c3e52094acce76e4cba08d0131eef40292d4c4ecab54a61013253f56faf5',
    orchestration_set_digest: '223d63575fdcf0c57f25eb76a1b2e00e12f981c67614245b4e5d3cd47410ce4d',
    recipe_count: 8,
    loop_count: 5,
    asset_contract_count: 6,
  });

  const proof = await runCli([
    'proof',
    '--now',
    '2026-07-18T12:00:00.000Z',
    '--seed',
    'marketing-proof-seed-v1',
  ]);
  assert.equal(proof.status, 'awaiting_human_approval');
  assert.equal(proof.package.publish_eligible, false);
  assert.ok(!JSON.stringify(proof).includes('Cambium keeps task'));

  const plan = await runCli([
    'plan',
    '--outcome',
    'social_draft_set',
    '--now',
    '2026-07-18T12:00:00.000Z',
    '--seed',
    'social-plan-v1',
  ]);
  assert.equal(plan.status, 'compiled');
  assert.equal(plan.outcome_id, 'social_draft_set');
  assert.equal(plan.recipe_id, 'social-repurposing@1.0.0');
  assert.ok(plan.contract_ids.includes('asset_variant@1.0.0'));

  const loop = await runCli([
    'loop',
    '--now',
    '2026-07-18T12:00:00.000Z',
    '--seed',
    'marketing-loop-seed-v1',
  ]);
  assert.equal(loop.status, 'skipped');
  assert.equal(loop.schedule_armed, false);

  const compiledLoop = await runCli([
    'loop-plan',
    '--loop-id',
    'content-repurposing@1.0.0',
  ]);
  assert.equal(compiledLoop.status, 'compiled');
  assert.equal(compiledLoop.loop_id, 'content-repurposing@1.0.0');
  assert.equal(compiledLoop.schedule_armed, false);
  assert.deepEqual(compiledLoop.live_adapters, []);
});

test('manual content-decay loop checks and skips with a machine-readable reason and no schedule', async () => {
  const { capabilities, fixture } = await inputs();
  const result = evaluateManualMarketingLoop(
    capabilities,
    {
      loop_id: 'content-decay@1.0.0',
      observation: fixture.loop_observation,
    },
    {
      clock: () => '2026-07-18T12:00:00.000Z',
      seed: () => 'marketing-loop-seed-v1',
    },
  );

  assert.equal(result.status, 'skipped');
  assert.equal(result.reason_code, 'asset_fresh');
  assert.equal(result.schedule_armed, false);
  assert.equal(result.output_destination, 'review_queue');
  assert.equal(result.refresh_brief, null);
  assert.equal(result.receipt.artifact_count, 0);
  assert.equal(result.receipt.next_action, 'no_action_asset_fresh');
  assert.equal(result.steps_executed.length, capabilities.loops[0].body.steps.length);
  assert.ok(result.self_checks.length > 0);

  const stale = evaluateManualMarketingLoop(
    capabilities,
    {
      loop_id: 'content-decay@1.0.0',
      observation: fixture.loop_observation,
    },
    {
      clock: () => '2026-08-20T12:00:00.000Z',
      seed: () => 'marketing-loop-seed-v1',
    },
  );
  assert.equal(stale.status, 'brief_ready');
  assert.equal(stale.reason_code, 'content_decay_detected');
  assert.equal(stale.refresh_brief.review_required, true);
  assert.match(stale.refresh_brief.brief_digest, /^[a-f0-9]{64}$/);
  assert.equal(stale.receipt.artifact_count, 1);
  assert.equal(stale.receipt.next_action, 'review_refresh_brief');
  assert.equal(stale.cursor_advanced, false);
  assert.equal(stale.schedule_armed, false);

  const declared = capabilities.loops.find(({ status }) => status === 'compiled');
  assert.throws(
    () => evaluateManualMarketingLoop(
      capabilities,
      { loop_id: declared.id, observation: fixture.loop_observation },
      { clock: () => '2026-07-18T12:00:00.000Z', seed: () => 'seed' },
    ),
    /compiled.*no executable adapter proof/i,
  );
});

test('review-package bridge validates full integrity and stays blocked without canonical approval', async () => {
  const { capabilities, assets, fixture } = await inputs();
  const proof = runOfflineMarketingProof(
    { capabilities, assets, fixture },
    {
      clock: () => '2026-07-18T12:00:00.000Z',
      seed: () => 'marketing-proof-seed-v1',
      network: () => {
        throw new Error('network sentinel');
      },
    },
  );
  const packageRecord = {
    ...proof.package,
    rights_state: 'cleared',
  };
  const { package_digest: ignoredDigest, ...packageDigestInput } = packageRecord;
  packageRecord.package_digest = canonicalDigest(packageDigestInput);
  const context = {
    now: '2026-07-18T12:00:00.000Z',
    current_source_asset_digest: packageRecord.source_asset_digest,
  };
  const ready = assessReviewPackageBridgeReadiness(assets, packageRecord, context);
  assert.equal(ready.review_ready, false);
  assert.equal(ready.publish_eligible, false);
  assert.equal(ready.requires_engage_authority, true);
  assert.equal(ready.reason_code, 'canonical_approval_decision_required');
  const selfApproved = {
    ...packageRecord,
    approval_state: 'approved',
  };
  const { package_digest: ignoredApprovedDigest, ...approvedDigestInput } = selfApproved;
  selfApproved.package_digest = canonicalDigest(approvedDigestInput);
  assert.throws(
    () => assessReviewPackageBridgeReadiness(assets, selfApproved, context),
    /validation/i,
  );
  assert.equal(
    assessReviewPackageBridgeReadiness(assets, {
      ...packageRecord,
      rights_state: 'restricted',
      package_digest: canonicalDigest({ ...packageDigestInput, rights_state: 'restricted' }),
    }, context).reason_code,
    'rights_not_cleared',
  );
  assert.equal(
    assessReviewPackageBridgeReadiness(assets, packageRecord, {
      now: '2026-08-20T00:00:00.000Z',
      current_source_asset_digest: packageRecord.source_asset_digest,
    }).reason_code,
    'asset_expired',
  );
  assert.equal(
    assessReviewPackageBridgeReadiness(assets, packageRecord, {
      now: context.now,
      current_source_asset_digest: 'b'.repeat(64),
    }).reason_code,
    'source_digest_changed',
  );
  assert.throws(
    () => assessReviewPackageBridgeReadiness(assets, {
      source_asset_digest: packageRecord.source_asset_digest,
      rights_state: 'cleared',
      freshness_expires_at: packageRecord.freshness_expires_at,
      approval_state: 'awaiting_human_approval',
      publish_eligible: false,
      execution_mode: 'review_only',
    }, context),
    /required property|validation/i,
  );
});

test('bridges through content_asset while preserving twenty lead records and six-stage authority', async () => {
  const { leadCatalog, leadGraph } = await inputs();
  validateLeadContractCatalog(leadCatalog);
  const graphResult = validateLeadOps(leadGraph);
  const contentAsset = leadCatalog.contracts.find(({ id }) => id === 'content_asset@1.0.0');

  assert.equal(leadCatalog.contracts.length, 20);
  assert.ok(contentAsset.schema.properties.asset_kind.enum.includes('marketing_review_package'));
  assert.deepEqual(graphResult.stages, [
    'discover',
    'capture',
    'enrich',
    'understand',
    'create',
    'engage',
  ]);
  assert.deepEqual(Object.keys(graphResult.authority.primitives).sort(), [
    'approval',
    'fencing',
    'lease',
    'receipt',
    'task',
  ]);
});
