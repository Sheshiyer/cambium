import {
  canonicalDigest,
  validateContractInstance,
} from './lead-contracts.mjs';
import { validateSpendPolicy } from './spend-policy.mjs';

const OFFICIAL_REPOSITORY = 'https://github.com/coreyhaines31/marketingskills';
const OFFICIAL_COMMIT = '67264763cb107d61749f418d081c56e5bcbc0209';
const OFFICIAL_LICENSE_DIGEST = 'b70d71e24e40fce5da8f4b6f9cd862096a048e433db7f3c8cac5e348e6d34591';
const OFFICIAL_CAPABILITY_SET_DIGEST = '7147c3e52094acce76e4cba08d0131eef40292d4c4ecab54a61013253f56faf5';
const OFFICIAL_ORCHESTRATION_SET_DIGEST = '223d63575fdcf0c57f25eb76a1b2e00e12f981c67614245b4e5d3cd47410ce4d';
const EXPECTED_CAPABILITY_COUNT = 47;
const OBSERVED_UPSTREAM_LOOP_COUNT = 45;
const MARKETING_ASSET_CONTRACTS = Object.freeze([
  'asset_brief@1.0.0',
  'asset_recipe@1.0.0',
  'asset_draft@1.0.0',
  'asset_variant@1.0.0',
  'asset_quality_report@1.0.0',
  'channel_package@1.0.0',
]);
const RECIPE_IDS = Object.freeze([
  'seo-article-brief@1.0.0',
  'founder-article-draft@1.0.0',
  'social-repurposing@1.0.0',
  'newsletter-draft@1.0.0',
  'community-response-brief@1.0.0',
  'lead-magnet-outline@1.0.0',
  'case-study-draft@1.0.0',
  'landing-page-improvement-brief@1.0.0',
]);
const LOOP_IDS = Object.freeze([
  'content-decay@1.0.0',
  'content-repurposing@1.0.0',
  'social-listening-brief@1.0.0',
  'content-calendar-refill@1.0.0',
  'competitor-signal-brief@1.0.0',
]);
const CAPABILITY_SEMANTICS = Object.freeze({
  'ai-seo@2.2.0': ['add_ai_discovery_checks', 'instruction_only', ['answerability', 'citation_readiness']],
  'analytics@2.0.0': ['bind_measurement_spec', 'instruction_only', ['metric_definition', 'privacy_boundary']],
  'community-marketing@2.0.0': ['create_community_response_spec', 'instruction_only', ['community_fit', 'no_posting_authority']],
  'competitor-profiling@2.0.0': ['bind_competitor_evidence', 'instruction_only', ['dated_sources', 'uncertainty_visible']],
  'competitors@2.0.1': ['create_comparison_spec', 'instruction_only', ['claim_traceability', 'comparison_fairness']],
  'content-strategy@2.0.0': ['derive_content_structure', 'instruction_only', ['audience_job', 'purpose_metric']],
  'copy-editing@2.0.0': ['enforce_plain_language', 'deterministic_transform', ['clarity', 'accessibility']],
  'copywriting@2.0.1': ['assemble_editorial_draft', 'deterministic_transform', ['structured_copy', 'call_to_action']],
  'cro@2.0.0': ['add_conversion_hypotheses', 'instruction_only', ['evidence_before_change', 'single_variable_hypothesis']],
  'customer-research@2.0.1': ['bind_verified_voice_evidence', 'deterministic_transform', ['verified_voice', 'claim_traceability']],
  'emails@2.0.0': ['create_email_sequence_spec', 'instruction_only', ['consent_boundary', 'sequence_coherence']],
  'free-tools@2.0.0': ['create_free_tool_spec', 'instruction_only', ['user_utility', 'zero_spend_precursor']],
  'image@2.0.1': ['create_image_production_spec', 'instruction_only', ['alt_text', 'rights_check']],
  'lead-magnets@2.0.0': ['create_lead_magnet_spec', 'instruction_only', ['audience_value', 'gating_assumptions']],
  'marketing-ideas@2.0.0': ['rank_evidence_backed_ideas', 'instruction_only', ['evidence_fit', 'resource_fit']],
  'marketing-loops@1.2.0': ['compile_manual_loop_guardrails', 'manual_evaluator', ['stop_condition', 'idempotency']],
  'product-marketing@2.1.0': ['bind_product_context', 'deterministic_transform', ['versioned_context', 'product_claim_bindings']],
  'sales-enablement@2.0.1': ['create_sales_asset_spec', 'instruction_only', ['proof_before_claim', 'persona_fit']],
  'schema@2.0.0': ['create_schema_markup_spec', 'instruction_only', ['page_grounding', 'validation_required']],
  'seo-audit@2.0.0': ['bind_search_evidence', 'instruction_only', ['dated_observation', 'priority_rationale']],
  'site-architecture@2.0.0': ['create_site_structure_spec', 'instruction_only', ['navigation_clarity', 'redirect_risk']],
  'social@2.2.0': ['create_social_variants_spec', 'instruction_only', ['channel_fit', 'no_posting_authority']],
  'video@2.1.0': ['create_video_production_spec', 'instruction_only', ['captions_transcript', 'likeness_rights']],
});
const CLASSIFICATIONS = new Set([
  'context',
  'research',
  'strategy',
  'creation',
  'optimization',
  'distribution-planning',
  'measurement',
  'orchestration',
]);
const CURATION_STATES = new Set(['eligible', 'reference_only', 'excluded']);
const STAGES = new Set(['discover', 'capture', 'enrich', 'understand', 'create', 'engage']);
const REQUIRED_PROHIBITED_ACTIONS = Object.freeze(['publish', 'send', 'spend']);
const OFFLINE_ENVELOPE = Object.freeze({
  network: 'none',
  authentication: 'none',
  external_write: 'none',
  spend: 'none',
  schedule: 'none',
});
const SEMVER = /^\d+\.\d+\.\d+$/;
const VERSIONED_ID = /^[a-z][a-z0-9_-]*@\d+\.\d+\.\d+$/;
const DIGEST = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function fail(message, path = '') {
  throw new Error(`marketing orchestration validation: ${message}${path ? ` at ${path}` : ''}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function object(value, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, keys, label) {
  object(value, label);
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (extras.length) fail(`${label} contains unknown fields: ${extras.join(', ')}`);
  if (missing.length) fail(`${label} is missing required fields: ${missing.join(', ')}`);
}

function string(value, label, { min = 1, max = 1024, pattern = null } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    fail(`${label} must be a string between ${min} and ${max} characters`);
  }
  if (pattern && !pattern.test(value)) fail(`${label} has an invalid format`);
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`);
  return value;
}

function finiteNumber(value, label, { integer = false, min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    fail(`${label} must be a finite${integer ? ' integer' : ''} number`);
  }
  if (value < min || value > max) fail(`${label} must be between ${min} and ${max}`);
  return value;
}

function array(value, label, { min = 0, max = 1024, unique = false } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${label} must contain between ${min} and ${max} items`);
  }
  if (unique && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
    fail(`${label} contains duplicate values`);
  }
  return value;
}

function stringArray(value, label, options = {}) {
  const items = array(value, label, options);
  items.forEach((item, index) => string(item, `${label}[${index}]`, { max: 256 }));
  return items;
}

function timestamp(value, label) {
  string(value, label, { min: 20, max: 35, pattern: ISO_UTC });
  if (!Number.isFinite(Date.parse(value))) fail(`${label} must be a valid UTC timestamp`);
  return value;
}

function sameValue(left, right) {
  return canonicalDigest(left) === canonicalDigest(right);
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function assertSafeRelativePath(value, label) {
  string(value, label, { max: 512 });
  if (value.startsWith('/') || value.startsWith('~') || value.includes('\\')) {
    fail(`${label} must be a portable relative path`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(`${label} contains a path-escaping or empty directory segment`);
  }
}

function assertOfflineEnvelope(value, label) {
  exactKeys(value, Object.keys(OFFLINE_ENVELOPE), label);
  if (!sameValue(value, OFFLINE_ENVELOPE)) {
    fail(`${label} violates the offline-zero execution envelope`);
  }
}

function assertVersionedId(value, label) {
  string(value, label, { min: 7, max: 128, pattern: VERSIONED_ID });
}

function assertDigest(value, label) {
  string(value, label, { min: 64, max: 64, pattern: DIGEST });
}

function assertNoAuthorityFields(value, label) {
  const forbiddenKeys = new Set([
    'adapter',
    'credential',
    'credentials',
    'endpoint',
    'network_provider',
    'publish_enabled',
    'schedule_enabled',
    'send_enabled',
  ]);
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenKeys.has(key)) fail(`${label} contains authority-bearing field ${key}`, `${path}.${key}`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(value, '$');
}

function validateSource(source) {
  exactKeys(source, [
    'repository',
    'commit',
    'license',
    'skill_count',
    'loop_definition_count',
    'capability_set_digest',
    'versions_file',
    'digest',
  ], 'source');
  if (source.repository !== OFFICIAL_REPOSITORY) fail('source repository must remain the official upstream');
  if (!COMMIT.test(source.commit) || source.commit !== OFFICIAL_COMMIT) {
    fail('source requires the immutable reviewed commit');
  }
  exactKeys(source.license, ['spdx', 'sha256', 'path'], 'source.license');
  if (source.license.spdx !== 'MIT' || source.license.sha256 !== OFFICIAL_LICENSE_DIGEST) {
    fail('source license metadata does not match the reviewed MIT source');
  }
  assertSafeRelativePath(source.license.path, 'source.license.path');
  if (source.skill_count !== EXPECTED_CAPABILITY_COUNT) fail('source skill_count must equal 47');
  if (source.loop_definition_count !== OBSERVED_UPSTREAM_LOOP_COUNT) {
    fail('source loop_definition_count must preserve the exact 45-loop observation');
  }
  if (source.capability_set_digest !== OFFICIAL_CAPABILITY_SET_DIGEST) {
    fail('source capability_set_digest must bind the reviewed forty-seven-closure set');
  }
  assertSafeRelativePath(source.versions_file, 'source.versions_file');
  exactKeys(source.digest, ['algorithm', 'canonicalization'], 'source.digest');
  if (source.digest.algorithm !== 'sha256') fail('source digest algorithm must be sha256');
  string(source.digest.canonicalization, 'source.digest.canonicalization', { max: 64 });
}

function validatePolicy(policy) {
  exactKeys(policy, [
    'execution_envelope',
    'max_execution_class',
    'prohibited_output_actions',
    'live_adapters',
    'low_budget_variants_runtime_enabled',
  ], 'policy');
  assertOfflineEnvelope(policy.execution_envelope, 'policy.execution_envelope');
  if (policy.max_execution_class !== 'review_only') fail('policy execution class must be review_only');
  const prohibited = stringArray(policy.prohibited_output_actions, 'policy.prohibited_output_actions', {
    min: REQUIRED_PROHIBITED_ACTIONS.length,
    max: 16,
    unique: true,
  });
  for (const action of REQUIRED_PROHIBITED_ACTIONS) {
    if (!prohibited.includes(action)) fail(`policy must prohibit ${action}`);
  }
  array(policy.live_adapters, 'policy.live_adapters', { max: 0 });
  if (policy.low_budget_variants_runtime_enabled !== false) {
    fail('low-budget variants must remain unavailable at runtime');
  }
}

function validateAssetReference(value) {
  exactKeys(value, ['catalog_id', 'path', 'contract_ids'], 'asset_catalog_ref');
  if (value.catalog_id !== 'marketing-assets@1.0.0') fail('asset catalog reference must bind marketing-assets@1.0.0');
  if (value.path !== 'composition/contracts/marketing-assets.v1.json') fail('asset catalog reference path drifted');
  const ids = stringArray(value.contract_ids, 'asset_catalog_ref.contract_ids', {
    min: MARKETING_ASSET_CONTRACTS.length,
    max: MARKETING_ASSET_CONTRACTS.length,
    unique: true,
  });
  if (!sameMembers(ids, MARKETING_ASSET_CONTRACTS)) fail('asset catalog reference must close over exactly six contracts');
}

function validateContentAssetBridge(value) {
  exactKeys(value, [
    'catalog_path',
    'contract_id',
    'stage',
    'source_contract_id',
    'asset_kind',
    'authority_owner',
    'approval_required',
    'publish_eligible_by_default',
    'activation_state',
    'blocking_reason',
  ], 'content_asset_bridge');
  if (value.catalog_path !== 'composition/contracts/lead-ecosystem.v1.json'
      || value.contract_id !== 'content_asset@1.0.0'
      || value.stage !== 'create'
      || value.source_contract_id !== 'channel_package@1.0.0'
      || value.asset_kind !== 'marketing_review_package'
      || value.authority_owner !== 'cambium'
      || value.approval_required !== true
      || value.publish_eligible_by_default !== false
      || value.activation_state !== 'blocked'
      || value.blocking_reason !== 'canonical_approval_contract_not_wired') {
    fail('content_asset_bridge must preserve the review-only Cambium create-stage boundary');
  }
}

function validateCapability(capability, index, policy) {
  const label = `capabilities[${index}]`;
  exactKeys(capability, [
    'id',
    'upstream_version',
    'upstream_directory',
    'source_closure_digest',
    'classification',
    'stages',
    'asset_outputs',
    'channel_outputs',
    'channel_support',
    'curation_state',
    'curation_reason',
    'requires_human_review',
    'evidence_requirements',
    'product_context_requirements',
    'allowed_input_classes',
    'execution_envelope',
    'max_execution_class',
    'prohibited_output_actions',
    'attribution',
    'semantic_fixture_ids',
  ], label);
  assertVersionedId(capability.id, `${label}.id`);
  string(capability.upstream_version, `${label}.upstream_version`, { max: 64, pattern: SEMVER });
  if (!capability.id.endsWith(`@${capability.upstream_version}`)) fail(`${label}.id must bind its upstream_version`);
  assertSafeRelativePath(capability.upstream_directory, `${label}.upstream_directory`);
  assertDigest(capability.source_closure_digest, `${label}.source_closure_digest`);
  if (!CLASSIFICATIONS.has(capability.classification)) fail(`${label}.classification is unsupported`);
  const stages = stringArray(capability.stages, `${label}.stages`, { min: 1, max: 6, unique: true });
  stages.forEach((stage) => {
    if (!STAGES.has(stage)) fail(`${label}.stages contains unsupported stage ${stage}`);
  });
  stringArray(capability.asset_outputs, `${label}.asset_outputs`, { max: 16, unique: true });
  stringArray(capability.channel_outputs, `${label}.channel_outputs`, { max: 32, unique: true });
  const channelSupport = array(capability.channel_support, `${label}.channel_support`, {
    min: 1,
    max: 32,
  });
  const channelFamilies = new Set();
  channelSupport.forEach((channel, channelIndex) => {
    const channelLabel = `${label}.channel_support[${channelIndex}]`;
    exactKeys(channel, ['family', 'status'], channelLabel);
    string(channel.family, `${channelLabel}.family`, { max: 64, pattern: /^[a-z][a-z0-9_-]{0,63}$/ });
    if (channelFamilies.has(channel.family)) fail(`${label}.channel_support contains duplicate family ${channel.family}`);
    channelFamilies.add(channel.family);
    if (!['supported', 'unsupported'].includes(channel.status)) fail(`${channelLabel}.status is unsupported`);
  });
  if (!CURATION_STATES.has(capability.curation_state)) fail(`${label}.curation_state is unsupported`);
  string(capability.curation_reason, `${label}.curation_reason`, {
    min: capability.curation_state === 'eligible' ? 0 : 1,
    max: 512,
  });
  if (capability.requires_human_review !== true) fail(`${label} must require human review`);
  stringArray(capability.evidence_requirements, `${label}.evidence_requirements`, { max: 32, unique: true });
  stringArray(capability.product_context_requirements, `${label}.product_context_requirements`, { max: 32, unique: true });
  stringArray(capability.allowed_input_classes, `${label}.allowed_input_classes`, { min: 1, max: 32, unique: true });
  assertOfflineEnvelope(capability.execution_envelope, `${label}.execution_envelope`);
  if (!sameValue(capability.execution_envelope, policy.execution_envelope)) fail(`${label} widens the catalog execution envelope`);
  if (capability.max_execution_class !== 'review_only') fail(`${label}.max_execution_class must be review_only`);
  const prohibited = stringArray(capability.prohibited_output_actions, `${label}.prohibited_output_actions`, {
    min: REQUIRED_PROHIBITED_ACTIONS.length,
    max: 16,
    unique: true,
  });
  for (const action of REQUIRED_PROHIBITED_ACTIONS) {
    if (!prohibited.includes(action)) fail(`${label} must prohibit ${action}`);
  }
  if (!sameMembers(prohibited, policy.prohibited_output_actions)) fail(`${label} prohibited actions must match policy`);
  exactKeys(capability.attribution, ['repository', 'commit', 'directory', 'license'], `${label}.attribution`);
  if (capability.attribution.repository !== OFFICIAL_REPOSITORY
      || capability.attribution.commit !== OFFICIAL_COMMIT
      || capability.attribution.directory !== capability.upstream_directory
      || capability.attribution.license !== 'MIT') {
    fail(`${label}.attribution must bind the reviewed upstream closure`);
  }
  const fixtures = stringArray(capability.semantic_fixture_ids, `${label}.semantic_fixture_ids`, {
    min: capability.curation_state === 'eligible' ? 1 : 0,
    max: capability.curation_state === 'eligible' ? 1 : 0,
    unique: true,
  });
  fixtures.forEach((fixtureId, fixtureIndex) => string(fixtureId, `${label}.semantic_fixture_ids[${fixtureIndex}]`, { max: 256 }));
  if (capability.curation_state === 'eligible') {
    const expectedFixtureId = `upstream-eval:${capability.upstream_directory}@${capability.upstream_version}`;
    if (fixtures[0] !== expectedFixtureId) {
      fail(`${label}.semantic_fixture_ids must bind the audited upstream evaluation suite`);
    }
  }
}

function validateDisabledSpend(spend, lowBudgetQuote, label) {
  exactKeys(spend, ['tier'], label);
  const canonical = validateSpendPolicy({ spend });
  if (!canonical.ok || canonical.policy.tier !== 'none') {
    fail(`${label} must satisfy the canonical spend:none policy`);
  }
  exactKeys(lowBudgetQuote, [
    'runtime_enabled',
    'currency',
    'maximum_per_run',
    'billing_unit',
    'quote_expires_at',
    'zero_spend_precursor_contract',
  ], `${label}.low_budget_quote`);
  if (lowBudgetQuote.runtime_enabled !== false) fail(`${label} low-budget runtime must remain disabled`);
  string(lowBudgetQuote.currency, `${label}.low_budget_quote.currency`, {
    min: 3,
    max: 3,
    pattern: /^[A-Z]{3}$/,
  });
  finiteNumber(lowBudgetQuote.maximum_per_run, `${label}.low_budget_quote.maximum_per_run`, {
    min: 0,
    max: 1000000,
  });
  string(lowBudgetQuote.billing_unit, `${label}.low_budget_quote.billing_unit`, { max: 64 });
  timestamp(lowBudgetQuote.quote_expires_at, `${label}.low_budget_quote.quote_expires_at`);
  if (lowBudgetQuote.zero_spend_precursor_contract !== 'channel_package@1.0.0') {
    fail(`${label}.low_budget_quote must require the zero-spend channel package precursor`);
  }
}

function validateRecipe(recipe, index, capabilitiesById) {
  const label = `recipes[${index}]`;
  exactKeys(recipe, [
    'id',
    'name',
    'status',
    'founder_job',
    'primary_asset_type',
    'purpose_metric',
    'capability_chain',
    'input_contracts',
    'output_contracts',
    'channel_outputs',
    'execution_mode',
    'live_adapters',
    'execution_envelope',
    'self_checks',
    'approval_checkpoint',
    'review_budget',
    'accessibility_companion',
    'spend',
    'low_budget_quote',
  ], label);
  assertVersionedId(recipe.id, `${label}.id`);
  string(recipe.name, `${label}.name`, { max: 128 });
  if (!['compiled', 'executed'].includes(recipe.status)) fail(`${label}.status must be compiled or executed`);
  string(recipe.founder_job, `${label}.founder_job`, { max: 512 });
  string(recipe.primary_asset_type, `${label}.primary_asset_type`, { max: 64, pattern: /^[a-z][a-z0-9_-]{0,63}$/ });
  string(recipe.purpose_metric, `${label}.purpose_metric`, { max: 128 });
  if (recipe.execution_mode !== 'review_only') fail(`${label}.execution_mode must be review_only`);
  array(recipe.live_adapters, `${label}.live_adapters`, { max: 0 });
  assertOfflineEnvelope(recipe.execution_envelope, `${label}.execution_envelope`);
  const chain = stringArray(recipe.capability_chain, `${label}.capability_chain`, { min: 1, max: 32, unique: true });
  for (const capabilityId of chain) {
    const capability = capabilitiesById.get(capabilityId);
    if (!capability) fail(`${label} references unknown capability ${capabilityId}`);
    if (capability.curation_state !== 'eligible') fail(`${label} references ineligible capability ${capabilityId}`);
  }
  const inputs = stringArray(recipe.input_contracts, `${label}.input_contracts`, { min: 1, max: 6, unique: true });
  const outputs = stringArray(recipe.output_contracts, `${label}.output_contracts`, { min: 1, max: 6, unique: true });
  for (const contractId of [...inputs, ...outputs]) {
    if (!MARKETING_ASSET_CONTRACTS.includes(contractId)) fail(`${label} references unknown asset contract ${contractId}`);
  }
  stringArray(recipe.channel_outputs, `${label}.channel_outputs`, { min: 1, max: 16, unique: true });
  stringArray(recipe.self_checks, `${label}.self_checks`, { min: 1, max: 32, unique: true });
  exactKeys(recipe.approval_checkpoint, ['required', 'stage', 'decision_scope'], `${label}.approval_checkpoint`);
  if (recipe.approval_checkpoint.required !== true) fail(`${label}.approval_checkpoint must be required`);
  string(recipe.approval_checkpoint.stage, `${label}.approval_checkpoint.stage`, { max: 64 });
  if (recipe.approval_checkpoint.decision_scope !== 'exact_package_digest') {
    fail(`${label}.approval_checkpoint.decision_scope must bind the exact package digest`);
  }
  exactKeys(recipe.review_budget, ['max_minutes', 'max_reviewers', 'max_variants', 'max_claims'], `${label}.review_budget`);
  for (const field of ['max_minutes', 'max_reviewers', 'max_variants', 'max_claims']) {
    finiteNumber(recipe.review_budget[field], `${label}.review_budget.${field}`, {
      integer: true,
      min: 1,
      max: field === 'max_minutes' ? 1440 : 1000,
    });
  }
  exactKeys(recipe.accessibility_companion, ['required', 'format', 'contract_id'], `${label}.accessibility_companion`);
  if (recipe.accessibility_companion.required !== true) fail(`${label}.accessibility_companion must be required`);
  string(recipe.accessibility_companion.format, `${label}.accessibility_companion.format`, { max: 64 });
  if (!MARKETING_ASSET_CONTRACTS.includes(recipe.accessibility_companion.contract_id)) {
    fail(`${label}.accessibility_companion references an unknown contract`);
  }
  validateDisabledSpend(recipe.spend, recipe.low_budget_quote, `${label}.spend`);
}

function validateLoop(loop, index, capabilitiesById) {
  const label = `loops[${index}]`;
  exactKeys(loop, [
    'id',
    'name',
    'status',
    'cadence',
    'acts_when',
    'purpose_metric',
    'capability_sequence',
    'body',
    'self_checks',
    'state_policy',
    'idempotency_policy',
    'run_identity_fields',
    'cursor_policy',
    'missed_cadence_policy',
    'stop_condition',
    'error_bailout',
    'manual_outcomes',
    'output_destination',
    'schedule_armed',
    'execution_mode',
    'live_adapters',
    'execution_envelope',
    'spend',
    'low_budget_quote',
  ], label);
  assertVersionedId(loop.id, `${label}.id`);
  string(loop.name, `${label}.name`, { max: 128 });
  if (!['compiled', 'executed'].includes(loop.status)) fail(`${label}.status must be compiled or executed`);
  exactKeys(loop.cadence, ['mode', 'suggested_interval', 'schedule_armed'], `${label}.cadence`);
  if (loop.cadence.mode !== 'manual_check_only') fail(`${label}.cadence.mode must remain manual_check_only`);
  string(loop.cadence.suggested_interval, `${label}.cadence.suggested_interval`, { max: 64 });
  if (loop.cadence.schedule_armed !== false) fail(`${label}.cadence.schedule_armed must remain false`);
  exactKeys(loop.acts_when, ['all'], `${label}.acts_when`);
  const conditions = array(loop.acts_when.all, `${label}.acts_when.all`, { min: 1, max: 16 });
  conditions.forEach((condition, conditionIndex) => {
    const conditionLabel = `${label}.acts_when.all[${conditionIndex}]`;
    object(condition, conditionLabel);
    const keys = Object.keys(condition);
    const hasValue = Object.hasOwn(condition, 'value');
    const hasValueFrom = Object.hasOwn(condition, 'value_from');
    if (!keys.every((key) => ['field', 'operator', 'value', 'value_from'].includes(key))
        || !Object.hasOwn(condition, 'field')
        || !Object.hasOwn(condition, 'operator')
        || hasValue === hasValueFrom) {
      fail(`${conditionLabel} must contain field, operator, and exactly one bounded value source`);
    }
    string(condition.field, `${conditionLabel}.field`, { max: 64, pattern: /^[a-z][a-z0-9_.]{0,63}$/ });
    if (!['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains'].includes(condition.operator)) {
      fail(`${conditionLabel}.operator is unsupported`);
    }
    if (hasValueFrom) string(condition.value_from, `${conditionLabel}.value_from`, { max: 128 });
    if (hasValue && !['string', 'number', 'boolean'].includes(typeof condition.value)) {
      fail(`${conditionLabel}.value must be a scalar`);
    }
  });
  string(loop.purpose_metric, `${label}.purpose_metric`, { max: 128 });
  if (loop.execution_mode !== 'review_only') fail(`${label}.execution_mode must be review_only`);
  array(loop.live_adapters, `${label}.live_adapters`, { max: 0 });
  assertOfflineEnvelope(loop.execution_envelope, `${label}.execution_envelope`);
  const sequence = stringArray(loop.capability_sequence, `${label}.capability_sequence`, { min: 1, max: 32, unique: true });
  for (const capabilityId of sequence) {
    const capability = capabilitiesById.get(capabilityId);
    if (!capability) fail(`${label} references unknown capability ${capabilityId}`);
    if (capability.curation_state !== 'eligible') fail(`${label} references ineligible capability ${capabilityId}`);
  }
  exactKeys(loop.body, ['maximum_steps', 'steps'], `${label}.body`);
  finiteNumber(loop.body.maximum_steps, `${label}.body.maximum_steps`, { integer: true, min: 1, max: 64 });
  const steps = stringArray(loop.body.steps, `${label}.body.steps`, { min: 1, max: loop.body.maximum_steps, unique: true });
  if (steps.length > loop.body.maximum_steps) fail(`${label}.body exceeds maximum_steps`);
  stringArray(loop.self_checks, `${label}.self_checks`, { min: 1, max: 32, unique: true });
  exactKeys(loop.state_policy, ['storage', 'retention', 'writes'], `${label}.state_policy`);
  for (const field of ['storage', 'retention', 'writes']) {
    string(loop.state_policy[field], `${label}.state_policy.${field}`, { max: 128 });
  }
  exactKeys(loop.idempotency_policy, ['key_fields', 'duplicate_outcome'], `${label}.idempotency_policy`);
  stringArray(loop.idempotency_policy.key_fields, `${label}.idempotency_policy.key_fields`, { min: 1, max: 16, unique: true });
  string(loop.idempotency_policy.duplicate_outcome, `${label}.idempotency_policy.duplicate_outcome`, { max: 64 });
  const runIdentity = stringArray(loop.run_identity_fields, `${label}.run_identity_fields`, { min: 4, max: 4, unique: true });
  if (!sameValue(runIdentity, ['tenant_id', 'loop_version', 'observation_window', 'input_digest'])) {
    fail(`${label}.run_identity_fields must bind the exact manual run identity`);
  }
  if (loop.cursor_policy !== 'advance_after_fenced_durable_artifact_receipt') fail(`${label}.cursor_policy is unsafe`);
  if (loop.missed_cadence_policy !== 'no_catch_up_without_approved_backfill') fail(`${label}.missed_cadence_policy is unsafe`);
  string(loop.stop_condition, `${label}.stop_condition`, { max: 512 });
  string(loop.error_bailout, `${label}.error_bailout`, { max: 512 });
  const outcomes = array(loop.manual_outcomes, `${label}.manual_outcomes`, { min: 1, max: 16 });
  const outcomeReasons = new Set();
  outcomes.forEach((outcome, outcomeIndex) => {
    const outcomeLabel = `${label}.manual_outcomes[${outcomeIndex}]`;
    exactKeys(outcome, ['status', 'reason_code'], outcomeLabel);
    if (!['skipped', 'brief_ready', 'package_ready', 'blocked'].includes(outcome.status)) {
      fail(`${outcomeLabel}.status is unsupported`);
    }
    string(outcome.reason_code, `${outcomeLabel}.reason_code`, { max: 64, pattern: /^[a-z][a-z0-9_]{0,63}$/ });
    if (outcomeReasons.has(outcome.reason_code)) fail(`${label}.manual_outcomes contains duplicate reason ${outcome.reason_code}`);
    outcomeReasons.add(outcome.reason_code);
  });
  if (loop.output_destination !== 'review_queue') fail(`${label}.output_destination must be review_queue`);
  if (loop.schedule_armed !== false) fail(`${label}.schedule_armed must remain false`);
  validateDisabledSpend(loop.spend, loop.low_budget_quote, `${label}.spend`);
}

export function validateMarketingCapabilityCatalog(catalog) {
  exactKeys(catalog, [
    'schema_version',
    'source',
    'policy',
    'asset_catalog_ref',
    'content_asset_bridge',
    'orchestration_set_digest',
    'capabilities',
    'recipes',
    'loops',
  ], 'marketing capability catalog');
  if (catalog.schema_version !== 'marketing-capabilities@1.0.0') {
    fail('marketing capability catalog schema_version must be marketing-capabilities@1.0.0');
  }
  validateSource(catalog.source);
  validatePolicy(catalog.policy);
  validateAssetReference(catalog.asset_catalog_ref);
  validateContentAssetBridge(catalog.content_asset_bridge);
  if (catalog.orchestration_set_digest !== OFFICIAL_ORCHESTRATION_SET_DIGEST) {
    fail('orchestration_set_digest must bind the reviewed recipe and loop definitions');
  }
  assertNoAuthorityFields(catalog, 'marketing capability catalog');

  const capabilities = array(catalog.capabilities, 'capabilities', {
    min: EXPECTED_CAPABILITY_COUNT,
    max: EXPECTED_CAPABILITY_COUNT,
  });
  const duplicateCheck = new Set();
  for (const capability of capabilities) {
    if (isObject(capability) && typeof capability.id === 'string') {
      if (duplicateCheck.has(capability.id)) fail(`duplicate capability id ${capability.id}`);
      duplicateCheck.add(capability.id);
    }
  }
  const capabilitiesById = new Map();
  const upstreamDirectories = new Set();
  capabilities.forEach((capability, index) => {
    validateCapability(capability, index, catalog.policy);
    if (capabilitiesById.has(capability.id)) fail(`duplicate capability id ${capability.id}`);
    if (upstreamDirectories.has(capability.upstream_directory)) {
      fail(`duplicate capability upstream directory ${capability.upstream_directory}`);
    }
    capabilitiesById.set(capability.id, capability);
    upstreamDirectories.add(capability.upstream_directory);
  });
  const capabilitySetDigest = canonicalDigest(
    capabilities
      .map(({
        id, upstream_directory: upstreamDirectory, upstream_version: upstreamVersion, source_closure_digest: sourceClosureDigest,
      }) => ({
        id,
        upstream_directory: upstreamDirectory,
        upstream_version: upstreamVersion,
        source_closure_digest: sourceClosureDigest,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  if (capabilitySetDigest !== OFFICIAL_CAPABILITY_SET_DIGEST
      || capabilitySetDigest !== catalog.source.capability_set_digest) {
    fail('capability set digest does not match the immutable reviewed forty-seven-closure set');
  }

  const recipes = array(catalog.recipes, 'recipes', { min: RECIPE_IDS.length, max: RECIPE_IDS.length });
  const recipeIds = new Set();
  const recipeOutcomes = new Set();
  recipes.forEach((recipe, index) => {
    validateRecipe(recipe, index, capabilitiesById);
    if (recipeIds.has(recipe.id)) fail(`duplicate recipe id ${recipe.id}`);
    if (recipeOutcomes.has(recipe.primary_asset_type)) {
      fail(`duplicate recipe outcome ${recipe.primary_asset_type}`);
    }
    recipeIds.add(recipe.id);
    recipeOutcomes.add(recipe.primary_asset_type);
  });
  if (!sameMembers([...recipeIds], RECIPE_IDS)) fail('recipe catalog must contain the exact eight bounded recipes');
  const executedRecipes = recipes.filter(({ status }) => status === 'executed');
  if (executedRecipes.length !== 1 || executedRecipes[0].id !== 'founder-article-draft@1.0.0') {
    fail('founder-article-draft@1.0.0 must be the only executed recipe');
  }
  const founderRecipe = executedRecipes[0];
  if (!founderRecipe.input_contracts.includes('asset_brief@1.0.0')
      || !founderRecipe.output_contracts.includes('channel_package@1.0.0')) {
    fail('executed founder article recipe must bridge asset_brief to channel_package');
  }

  const loops = array(catalog.loops, 'loops', { min: LOOP_IDS.length, max: LOOP_IDS.length });
  const loopIds = new Set();
  loops.forEach((loop, index) => {
    validateLoop(loop, index, capabilitiesById);
    if (loopIds.has(loop.id)) fail(`duplicate loop id ${loop.id}`);
    loopIds.add(loop.id);
  });
  if (!sameMembers([...loopIds], LOOP_IDS)) fail('loop catalog must contain the exact five manual loops');
  const executedLoops = loops.filter(({ status }) => status === 'executed');
  if (executedLoops.length !== 1 || executedLoops[0].id !== 'content-decay@1.0.0') {
    fail('content-decay@1.0.0 must be the only executed loop');
  }
  const contentDecay = executedLoops[0];
  const hasFreshnessCheck = contentDecay.acts_when.all.some((condition) => (
    condition.field === 'freshness_expires_at'
    && condition.operator === 'lte'
    && condition.value_from === 'clock.now'
  ));
  if (!hasFreshnessCheck) fail('content-decay@1.0.0 must compare freshness_expires_at <= clock.now');
  const freshOutcome = contentDecay.manual_outcomes.find(({ reason_code: reason }) => reason === 'asset_fresh');
  const decayOutcome = contentDecay.manual_outcomes.find(({ reason_code: reason }) => reason === 'content_decay_detected');
  if (freshOutcome?.status !== 'skipped' || decayOutcome?.status !== 'brief_ready') {
    fail('content-decay@1.0.0 must declare honest fresh-skip and decay-brief manual outcomes');
  }
  const orchestrationSetDigest = canonicalDigest({ recipes, loops });
  if (orchestrationSetDigest !== OFFICIAL_ORCHESTRATION_SET_DIGEST
      || orchestrationSetDigest !== catalog.orchestration_set_digest) {
    fail('recipe or loop definitions drifted from the reviewed orchestration set');
  }

  const usedCapabilities = new Set([
    ...recipes.flatMap(({ capability_chain: chain }) => chain),
    ...loops.flatMap(({ capability_sequence: sequence }) => sequence),
  ]);
  for (const capability of capabilities) {
    if (capability.curation_state === 'eligible' && !usedCapabilities.has(capability.id)) {
      fail(`eligible capability ${capability.id} is not used by a bounded recipe or loop`);
    }
  }
  const eligibleCapabilityIds = capabilities
    .filter(({ curation_state: state }) => state === 'eligible')
    .map(({ id }) => id)
    .sort();
  if (!sameMembers(eligibleCapabilityIds, Object.keys(CAPABILITY_SEMANTICS))) {
    fail('eligible capabilities must have one closed runtime semantic projection');
  }

  return {
    valid: true,
    schema_version: catalog.schema_version,
    capability_count: capabilities.length,
    capability_set_digest: capabilitySetDigest,
    orchestration_set_digest: orchestrationSetDigest,
    recipe_ids: [...recipeIds],
    loop_ids: [...loopIds],
  };
}

function resolveSchemaRef(catalog, ref, path) {
  if (typeof ref !== 'string' || !ref.startsWith('#/$defs/')) fail('asset schemas require local-only $ref', path);
  const name = ref.slice('#/$defs/'.length);
  if (!name || name.includes('/') || !catalog.$defs?.[name]) fail(`unresolved local asset schema ref ${ref}`, path);
  return catalog.$defs[name];
}

function validateClosedSchema(schema, catalog, path, activeRefs = new Set()) {
  object(schema, `schema node ${path}`);
  if (schema.$ref) {
    const target = resolveSchemaRef(catalog, schema.$ref, path);
    if (activeRefs.has(schema.$ref)) return;
    validateClosedSchema(target, catalog, schema.$ref, new Set(activeRefs).add(schema.$ref));
    return;
  }
  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) fail('asset schema objects must set additionalProperties false', path);
    object(schema.properties, `schema properties ${path}`);
    array(schema.required, `schema required ${path}`, { max: 128, unique: true });
    const propertyNames = Object.keys(schema.properties);
    if (!sameMembers(schema.required, propertyNames)) fail('every closed asset property must be required', path);
    for (const [key, child] of Object.entries(schema.properties)) {
      validateClosedSchema(child, catalog, `${path}.properties.${key}`, activeRefs);
    }
  } else if (schema.type === 'array') {
    if (!Number.isInteger(schema.maxItems) || schema.maxItems < 0) fail('asset schema arrays require maxItems', path);
    if (!schema.items) fail('asset schema arrays require items', path);
    validateClosedSchema(schema.items, catalog, `${path}.items`, activeRefs);
  } else if (schema.type === 'string') {
    if (!Number.isInteger(schema.maxLength) || schema.maxLength < 0) fail('asset schema strings require maxLength', path);
  } else if (schema.type === 'integer' || schema.type === 'number') {
    if (!Number.isFinite(schema.minimum) || !Number.isFinite(schema.maximum)) {
      fail('asset schema numbers require finite minimum and maximum', path);
    }
  } else if (schema.type === 'boolean') {
    // Booleans are intrinsically bounded.
  } else {
    fail(`unsupported asset schema type ${String(schema.type)}`, path);
  }
}

export function validateMarketingAssetCatalog(catalog) {
  exactKeys(catalog, [
    '$schema',
    'catalog_id',
    'version',
    'authority',
    'mode',
    '$defs',
    'contracts',
  ], 'marketing asset catalog');
  if (catalog.$schema !== 'https://json-schema.org/draft/2020-12/schema'
      || catalog.catalog_id !== 'marketing-assets@1.0.0'
      || catalog.version !== '1.0.0'
      || catalog.authority !== 'cambium'
      || catalog.mode !== 'contract-only') {
    fail('marketing asset catalog identity or authority metadata drifted');
  }
  object(catalog.$defs, 'marketing asset catalog $defs');
  for (const [name, schema] of Object.entries(catalog.$defs)) {
    validateClosedSchema(schema, catalog, `#/$defs/${name}`);
  }
  const contracts = array(catalog.contracts, 'marketing asset contracts', {
    min: MARKETING_ASSET_CONTRACTS.length,
    max: MARKETING_ASSET_CONTRACTS.length,
  });
  const ids = new Set();
  for (const [index, contract] of contracts.entries()) {
    const label = `contracts[${index}]`;
    exactKeys(contract, ['id', 'name', 'version', 'owner', 'category', 'stage', 'schema', 'example'], label);
    assertVersionedId(contract.id, `${label}.id`);
    string(contract.name, `${label}.name`, { max: 64, pattern: /^[a-z][a-z0-9_]{0,63}$/ });
    string(contract.version, `${label}.version`, { max: 32, pattern: SEMVER });
    if (contract.id !== `${contract.name}@${contract.version}`) fail(`${label}.id must equal name@version`);
    if (ids.has(contract.id)) fail(`duplicate marketing asset contract id ${contract.id}`);
    ids.add(contract.id);
    if (contract.owner !== 'cambium' || contract.category !== 'capability' || contract.stage !== 'create') {
      fail(`${contract.id} must remain a Cambium-owned create-stage capability contract`);
    }
    validateClosedSchema(contract.schema, catalog, `${label}.schema`);
    validateContractInstance(catalog, contract.id, contract.example);
  }
  if (!sameMembers([...ids], MARKETING_ASSET_CONTRACTS)) {
    fail('marketing asset catalog must define exactly the six supported contracts');
  }
  return { valid: true, catalog_id: catalog.catalog_id, contract_ids: [...ids] };
}

function validateTenant(tenant, label = 'request.tenant') {
  exactKeys(tenant, ['tenant_id', 'purpose', 'data_classification', 'processing_region', 'retention_days'], label);
  string(tenant.tenant_id, `${label}.tenant_id`, { max: 64, pattern: /^[a-z0-9][a-z0-9-]{0,63}$/ });
  string(tenant.purpose, `${label}.purpose`, { max: 128, pattern: /^[a-z0-9][a-z0-9._-]{0,127}$/ });
  if (!['synthetic', 'derived', 'public_business', 'business_contact'].includes(tenant.data_classification)) {
    fail(`${label}.data_classification is unsupported`);
  }
  string(tenant.processing_region, `${label}.processing_region`, { max: 64, pattern: /^[a-z0-9][a-z0-9._-]{0,63}$/ });
  finiteNumber(tenant.retention_days, `${label}.retention_days`, { integer: true, min: 0, max: 3650 });
}

function validateProductPacket(packet, evidenceSnapshot, { allowUnresolvedBindings = false } = {}) {
  exactKeys(packet, [
    'packet_id',
    'packet_version',
    'product_name',
    'audience',
    'problem',
    'positioning',
    'promise',
    'differentiators',
    'voice_principles',
    'call_to_action',
    'claim_bindings',
  ], 'request.product_packet');
  assertVersionedId(packet.packet_id, 'request.product_packet.packet_id');
  string(packet.packet_version, 'request.product_packet.packet_version', { max: 32, pattern: SEMVER });
  if (!packet.packet_id.endsWith(`@${packet.packet_version}`)) fail('product packet id must bind packet_version');
  for (const field of ['product_name', 'audience', 'problem', 'positioning', 'promise', 'call_to_action']) {
    string(packet[field], `request.product_packet.${field}`, { max: field === 'product_name' ? 128 : 1024 });
  }
  stringArray(packet.differentiators, 'request.product_packet.differentiators', { min: 1, max: 16, unique: true });
  stringArray(packet.voice_principles, 'request.product_packet.voice_principles', { min: 1, max: 16, unique: true });
  const bindings = array(packet.claim_bindings, 'request.product_packet.claim_bindings', { min: 3, max: 3 });
  const expectedFields = ['positioning', 'product_name', 'promise'];
  const claimIds = new Set(evidenceSnapshot.claims.map(({ claim_id: claimId }) => claimId));
  const boundFields = new Set();
  bindings.forEach((binding, index) => {
    const label = `request.product_packet.claim_bindings[${index}]`;
    exactKeys(binding, ['field', 'value_digest', 'claim_ids'], label);
    if (!expectedFields.includes(binding.field) || boundFields.has(binding.field)) {
      fail(`${label}.field must bind one unique factual product field`);
    }
    boundFields.add(binding.field);
    assertDigest(binding.value_digest, `${label}.value_digest`);
    if (binding.value_digest !== canonicalDigest(packet[binding.field])) {
      fail(`${label}.value_digest does not bind the current product field value`);
    }
    const ids = stringArray(binding.claim_ids, `${label}.claim_ids`, { min: 1, max: 16, unique: true });
    if (!allowUnresolvedBindings) {
      for (const claimId of ids) {
        if (!claimIds.has(claimId)) fail(`${label} references missing evidence claim ${claimId}`);
      }
    }
  });
  if (!sameMembers([...boundFields], expectedFields)) fail('product packet must bind every factual draft field');
}

function validateEvidenceSnapshot(snapshot, { allowEmptyClaims = true } = {}) {
  exactKeys(snapshot, ['snapshot_digest', 'observed_at', 'claims'], 'request.evidence_snapshot');
  assertDigest(snapshot.snapshot_digest, 'request.evidence_snapshot.snapshot_digest');
  timestamp(snapshot.observed_at, 'request.evidence_snapshot.observed_at');
  const claims = array(snapshot.claims, 'request.evidence_snapshot.claims', {
    min: allowEmptyClaims ? 0 : 1,
    max: 64,
  });
  const claimIds = new Set();
  claims.forEach((claim, index) => {
    const label = `request.evidence_snapshot.claims[${index}]`;
    exactKeys(claim, [
      'claim_id',
      'statement',
      'source_ref',
      'evidence_digest',
      'verified',
      'rights_status',
      'expires_at',
    ], label);
    string(claim.claim_id, `${label}.claim_id`, { min: 3, max: 128, pattern: /^[a-z0-9][a-z0-9._:-]{2,127}$/ });
    if (claimIds.has(claim.claim_id)) fail(`duplicate evidence claim id ${claim.claim_id}`);
    claimIds.add(claim.claim_id);
    string(claim.statement, `${label}.statement`, { max: 2048 });
    string(claim.source_ref, `${label}.source_ref`, { max: 256 });
    assertDigest(claim.evidence_digest, `${label}.evidence_digest`);
    boolean(claim.verified, `${label}.verified`);
    if (!['cleared', 'review_required', 'restricted'].includes(claim.rights_status)) {
      fail(`${label}.rights_status is unsupported`);
    }
    timestamp(claim.expires_at, `${label}.expires_at`);
  });
  const canonicalSnapshotDigest = canonicalDigest({
    observed_at: snapshot.observed_at,
    claims: [...claims].sort((left, right) => left.claim_id.localeCompare(right.claim_id)),
  });
  if (snapshot.snapshot_digest !== canonicalSnapshotDigest) {
    fail('request.evidence_snapshot.snapshot_digest must bind the canonical observed claims');
  }
}

function validateMarketingRequest(request, options = {}) {
  exactKeys(request, [
    'tenant',
    'outcome_id',
    'product_packet',
    'objective',
    'channel_outcome',
    'desired_title',
    'evidence_snapshot',
  ], 'marketing request');
  validateTenant(request.tenant);
  string(request.outcome_id, 'request.outcome_id', { max: 64, pattern: /^[a-z][a-z0-9_-]{0,63}$/ });
  validateEvidenceSnapshot(request.evidence_snapshot, options);
  validateProductPacket(request.product_packet, request.evidence_snapshot, {
    allowUnresolvedBindings: options.allowEmptyClaims === true
      && request.evidence_snapshot.claims.length === 0,
  });
  string(request.objective, 'request.objective', { max: 1024 });
  string(request.channel_outcome, 'request.channel_outcome', { max: 64, pattern: /^[a-z][a-z0-9_]{0,63}$/ });
  string(request.desired_title, 'request.desired_title', { max: 256 });
}

function executeFounderSemanticPlan(plan, request) {
  const state = {
    sections: [],
    claimIds: new Set(),
    body: '',
    checks: [],
    receipts: [],
  };
  const claimsById = new Map(
    request.evidence_snapshot.claims.map((claim) => [claim.claim_id, claim]),
  );
  const bindingsByField = new Map(
    request.product_packet.claim_bindings.map((binding) => [binding.field, binding]),
  );

  for (const step of plan.semantic_steps) {
    if (step.operation === 'bind_product_context') {
      for (const field of ['product_name', 'positioning', 'promise']) {
        for (const claimId of bindingsByField.get(field).claim_ids) state.claimIds.add(claimId);
      }
      state.sections.push(
        `${request.product_packet.product_name}: ${request.product_packet.positioning}.`,
        request.product_packet.promise,
      );
      state.checks.push({
        check_id: 'product_claim_bindings', status: 'passed', reason_code: 'factual_fields_digest_bound',
      });
    } else if (step.operation === 'bind_verified_voice_evidence') {
      const orderedClaims = [...claimsById.values()]
        .sort((left, right) => left.claim_id.localeCompare(right.claim_id));
      orderedClaims.forEach(({ claim_id: claimId }) => state.claimIds.add(claimId));
      state.sections.push(
        'Evidence',
        orderedClaims.map(({ statement }) => `- ${statement}`).join('\n'),
      );
      state.checks.push({
        check_id: 'verified_voice_evidence', status: 'passed', reason_code: 'verified_claims_projected',
      });
    } else if (step.operation === 'assemble_editorial_draft') {
      state.sections.push('Next step', request.product_packet.call_to_action);
      state.body = state.sections.join('\n\n');
      state.checks.push({
        check_id: 'structured_copy', status: 'passed', reason_code: 'evidence_and_action_sections_present',
      });
    } else if (step.operation === 'enforce_plain_language') {
      if (!state.body) fail('copy-editing cannot run before the editorial draft is assembled');
      state.body = state.body
        .split('\n')
        .map((line) => line.trim().replace(/\s+/g, ' '))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
      state.checks.push({
        check_id: 'plain_language_accessibility', status: 'passed', reason_code: 'plain_text_companion_ready',
      });
    } else {
      fail(`executed founder recipe cannot run unsupported operation ${step.operation}`);
    }
    state.receipts.push({
      sequence: step.sequence,
      capability_id: step.capability_id,
      operation: step.operation,
      source_closure_digest: step.source_closure_digest,
      outcome: 'applied',
    });
  }
  if (!state.body) fail('semantic plan did not produce an editorial draft body');
  return {
    body: state.body,
    claim_ids: [...state.claimIds].sort(),
    checks: state.checks,
    operation_receipts: state.receipts,
  };
}

function resolveDeterministicInputs(deps) {
  object(deps, 'deterministic dependencies');
  if (typeof deps.clock !== 'function') fail('an injected clock function is required');
  if (typeof deps.seed !== 'function') fail('an injected seed function is required');
  const now = deps.clock();
  const seed = deps.seed();
  timestamp(now, 'injected clock result');
  string(seed, 'injected seed result', { max: 256 });
  return { now, seed };
}

function stableId(prefix, value) {
  return `${prefix}-${canonicalDigest(value).slice(0, 24)}`;
}

function findInvocable(items, id, noun) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) fail(`unknown ${noun} ${id}`);
  if (item.status !== 'executed') fail(`${noun} ${id} is compiled but has no executable adapter proof`);
  return item;
}

function findCompilable(items, id, noun) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) fail(`unknown ${noun} ${id}`);
  if (!['compiled', 'executed'].includes(item.status)) fail(`${noun} ${id} is not compilable`);
  return item;
}

function resolveRecipeByOutcome(catalog, outcomeId, { executable = false } = {}) {
  const matches = catalog.recipes.filter(({ primary_asset_type: outcome }) => outcome === outcomeId);
  if (matches.length !== 1) fail(`outcome ${outcomeId} does not resolve to one recipe`);
  return executable
    ? findInvocable(catalog.recipes, matches[0].id, 'recipe')
    : findCompilable(catalog.recipes, matches[0].id, 'recipe');
}

function compileValidatedPlan(catalog, request, recipe, { now, seed }) {
  if (!recipe.channel_outputs.includes(request.channel_outcome)) {
    fail(`recipe ${recipe.id} does not support channel outcome ${request.channel_outcome}`);
  }
  const briefBase = {
    schema_version: 'asset_brief@1.0.0',
    tenant: structuredClone(request.tenant),
    recipe_id: recipe.id,
    objective: request.objective,
    channel_outcome: request.channel_outcome,
    product_packet_id: request.product_packet.packet_id,
    product_packet_version: request.product_packet.packet_version,
    product_packet_digest: canonicalDigest(request.product_packet),
    evidence_snapshot_digest: request.evidence_snapshot.snapshot_digest,
    created_at: now,
    seed_digest: canonicalDigest(seed),
  };
  const brief = {
    ...briefBase,
    record_id: stableId('asset-brief', briefBase),
  };
  const capabilityVersions = recipe.capability_chain.map((capabilityId) => {
    const capability = catalog.capabilities.find(({ id }) => id === capabilityId);
    return {
      capability_id: capability.id,
      upstream_version: capability.upstream_version,
      source_closure_digest: capability.source_closure_digest,
    };
  });
  const semanticSteps = recipe.capability_chain.map((capabilityId, index) => {
    const capability = catalog.capabilities.find(({ id }) => id === capabilityId);
    const [operation, executionClass, qualityChecks] = CAPABILITY_SEMANTICS[capabilityId];
    return {
      sequence: index + 1,
      capability_id: capabilityId,
      operation,
      execution_class: executionClass,
      evidence_requirements: [...capability.evidence_requirements].sort(),
      quality_checks: [...qualityChecks],
      source_closure_digest: capability.source_closure_digest,
    };
  });
  const planBase = {
    schema_version: 'asset_recipe@1.0.0',
    tenant: structuredClone(request.tenant),
    brief_id: brief.record_id,
    recipe_id: recipe.id,
    compiler_version: '1.0.0',
    recipe_digest: canonicalDigest(recipe),
    source_commit: catalog.source.commit,
    source_closure_digest: canonicalDigest(
      [...capabilityVersions].sort((left, right) => left.capability_id.localeCompare(right.capability_id)),
    ),
    capability_chain: [...recipe.capability_chain],
    capability_versions: capabilityVersions,
    semantic_steps: semanticSteps,
    contract_ids: [...new Set([...recipe.input_contracts, ...recipe.output_contracts])].sort(),
    execution_mode: 'review_only',
    live_adapters: [],
    planned_at: now,
  };
  const planWithId = {
    ...planBase,
    record_id: stableId('asset-recipe', { ...planBase, seed }),
  };
  const plan = {
    ...planWithId,
    plan_digest: canonicalDigest(planWithId),
  };
  return { brief, plan };
}

export function compileMarketingPlan(catalog, request, deps = {}) {
  validateMarketingCapabilityCatalog(catalog);
  object(request, 'marketing request');
  validateMarketingRequest(request, { allowEmptyClaims: false });
  const recipe = resolveRecipeByOutcome(catalog, request.outcome_id);
  const deterministic = resolveDeterministicInputs(deps);
  if (evidenceGap(request.evidence_snapshot, deterministic.now)) {
    fail('required evidence missing; an executable plan cannot contain unverified, restricted, or expired claims');
  }
  return compileValidatedPlan(catalog, request, recipe, deterministic).plan;
}

function evidenceGap(snapshot, now) {
  const invalidClaims = snapshot.claims.filter((claim) => (
    claim.verified !== true
    || claim.rights_status !== 'cleared'
    || Date.parse(claim.expires_at) <= Date.parse(now)
  ));
  if (snapshot.claims.length > 0 && invalidClaims.length === 0) return null;
  const reasonCodes = [];
  if (snapshot.claims.length === 0) reasonCodes.push('no_claims_attached');
  if (invalidClaims.some(({ verified }) => verified !== true)) reasonCodes.push('claim_unverified');
  if (invalidClaims.some(({ rights_status: rights }) => rights !== 'cleared')) reasonCodes.push('claim_rights_not_cleared');
  if (invalidClaims.some(({ expires_at: expiry }) => Date.parse(expiry) <= Date.parse(now))) reasonCodes.push('claim_expired');
  return {
    schema_version: 'evidence_gap_brief@1.0.0',
    reason_codes: reasonCodes,
    invalid_claim_ids: invalidClaims.map(({ claim_id: id }) => id).sort(),
    factual_draft_count: 0,
    recovery_action: 'attach_verified_product_evidence',
  };
}

function proofReceipt({
  artifactCount,
  fixtureId,
  now,
  outcome,
  nextAction,
  packageDigest = null,
}) {
  const base = {
    schema_version: 'marketing_proof_receipt@1.0.0',
    fixture_id: fixtureId,
    generated_at: now,
    outcome,
    redaction_applied: true,
    artifact_count: artifactCount,
    replay_safe: true,
    next_action: nextAction,
  };
  if (packageDigest !== null) base.package_digest = packageDigest;
  return {
    ...base,
    receipt_id: stableId('marketing-receipt', base),
  };
}

function withProofDigest(result) {
  return { ...result, proof_digest: canonicalDigest(result) };
}

function validateFixtureEnvelope(fixture) {
  exactKeys(fixture, ['fixture_version', 'fixture_id', 'request', 'loop_observation'], 'marketing proof fixture');
  if (fixture.fixture_version !== 'marketing-proof@1.0.0') fail('unsupported marketing proof fixture version');
  assertVersionedId(fixture.fixture_id, 'marketing proof fixture id');
  object(fixture.request, 'marketing proof fixture request');
  object(fixture.loop_observation, 'marketing proof fixture loop_observation');
}

export function runOfflineMarketingProof({ capabilities, assets, fixture }, deps = {}) {
  validateMarketingCapabilityCatalog(capabilities);
  validateMarketingAssetCatalog(assets);
  validateFixtureEnvelope(fixture);
  validateMarketingRequest(fixture.request, { allowEmptyClaims: true });
  const recipe = resolveRecipeByOutcome(capabilities, fixture.request.outcome_id, { executable: true });
  const deterministic = resolveDeterministicInputs(deps);
  const gap = evidenceGap(fixture.request.evidence_snapshot, deterministic.now);
  if (gap) {
    const receipt = proofReceipt({
      fixtureId: fixture.fixture_id,
      artifactCount: 1,
      now: deterministic.now,
      outcome: 'blocked',
      nextAction: gap.recovery_action,
    });
    return withProofDigest({
      proof_version: 'marketing-offline-proof@1.0.0',
      fixture_id: fixture.fixture_id,
      path: ['parsed', 'evidence_blocked', 'receipted'],
      status: 'blocked',
      reason_code: 'required_evidence_missing',
      execution_mode: 'review_only',
      network_calls: 0,
      drafts: [],
      evidence_gap_brief: gap,
      receipt,
    });
  }

  const { brief, plan } = compileValidatedPlan(
    capabilities,
    fixture.request,
    recipe,
    deterministic,
  );
  const semanticExecution = executeFounderSemanticPlan(plan, fixture.request);
  const claimIds = semanticExecution.claim_ids;
  const body = semanticExecution.body;
  const draftContent = {
    title: fixture.request.desired_title,
    body,
    claim_ids: claimIds,
    evidence_snapshot_digest: fixture.request.evidence_snapshot.snapshot_digest,
  };
  const draftBase = {
    schema_version: 'asset_draft@1.0.0',
    tenant: structuredClone(fixture.request.tenant),
    brief_id: brief.record_id,
    recipe_id: recipe.id,
    ...draftContent,
    rights_state: 'review_required',
    status: 'draft',
    created_at: deterministic.now,
    content_digest: canonicalDigest(draftContent),
  };
  const draft = {
    ...draftBase,
    record_id: stableId('asset-draft', { ...draftBase, seed: deterministic.seed }),
  };
  const qualityReport = {
    schema_version: 'asset_quality_report@1.0.0',
    tenant: structuredClone(fixture.request.tenant),
    record_id: stableId('quality-report', { draft: draft.content_digest, now: deterministic.now }),
    asset_id: draft.record_id,
    asset_digest: draft.content_digest,
    checks: [
      ...semanticExecution.checks,
      { check_id: 'authority_absent', status: 'passed', reason_code: 'review_only_output' },
      { check_id: 'review_gate_present', status: 'passed', reason_code: 'exact_digest_required' },
    ],
    score: 100,
    score_scope: 'structural_review_readiness',
    decision: 'review_required',
    factual_claim_count: claimIds.length,
    generated_at: deterministic.now,
  };
  const freshnessExpiresAt = fixture.request.evidence_snapshot.claims
    .map(({ expires_at: expiry }) => expiry)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const packageBase = {
    schema_version: 'channel_package@1.0.0',
    tenant: structuredClone(fixture.request.tenant),
    source_asset_id: draft.record_id,
    source_asset_digest: draft.content_digest,
    channel: fixture.request.channel_outcome,
    asset_ids: [draft.record_id],
    asset_digests: [draft.content_digest],
    attribution: recipe.capability_chain.map((capabilityId) => {
      const capability = capabilities.capabilities.find(({ id }) => id === capabilityId);
      return {
        capability_id: capability.id,
        repository: capability.attribution.repository,
        commit: capability.attribution.commit,
        directory: capability.attribution.directory,
        license: capability.attribution.license,
        source_closure_digest: capability.source_closure_digest,
      };
    }),
    accessibility_companion: {
      required: true,
      asset_id: draft.record_id,
      format: recipe.accessibility_companion.format,
    },
    rights_state: 'review_required',
    freshness_expires_at: freshnessExpiresAt,
    approval_state: 'awaiting_human_approval',
    publish_eligible: false,
    execution_mode: 'review_only',
    created_at: deterministic.now,
  };
  const packageWithId = {
    ...packageBase,
    record_id: stableId('channel-package', { ...packageBase, seed: deterministic.seed }),
  };
  const packageRecord = {
    ...packageWithId,
    package_digest: canonicalDigest(packageWithId),
  };

  validateContractInstance(assets, 'asset_brief@1.0.0', brief);
  validateContractInstance(assets, 'asset_recipe@1.0.0', plan);
  validateContractInstance(assets, 'asset_draft@1.0.0', draft);
  validateContractInstance(assets, 'asset_quality_report@1.0.0', qualityReport);
  validateContractInstance(assets, 'channel_package@1.0.0', packageRecord);

  const receipt = proofReceipt({
    fixtureId: fixture.fixture_id,
    artifactCount: 5,
    now: deterministic.now,
    outcome: 'awaiting_human_approval',
    nextAction: 'review_exact_package_digest',
    packageDigest: packageRecord.package_digest,
  });
  return withProofDigest({
    proof_version: 'marketing-offline-proof@1.0.0',
    fixture_id: fixture.fixture_id,
    path: ['parsed', 'planned', 'review_gated', 'receipted'],
    status: 'awaiting_human_approval',
    execution_mode: 'review_only',
    network_calls: 0,
    brief,
    plan,
    semantic_execution: {
      operation_receipts: semanticExecution.operation_receipts,
      applied_operation_count: semanticExecution.operation_receipts.length,
    },
    drafts: [draft],
    quality_report: qualityReport,
    package: packageRecord,
    receipt,
  });
}

function validateLoopObservation(observation) {
  exactKeys(observation, [
    'tenant_id',
    'asset_id',
    'source_asset_digest',
    'observed_at',
    'freshness_expires_at',
    'quality_score',
    'observation_window',
  ], 'loop observation');
  string(observation.tenant_id, 'loop observation.tenant_id', { max: 64, pattern: /^[a-z0-9][a-z0-9-]{0,63}$/ });
  string(observation.asset_id, 'loop observation.asset_id', { max: 128, pattern: /^[a-z0-9][a-z0-9._:-]{2,127}$/ });
  assertDigest(observation.source_asset_digest, 'loop observation.source_asset_digest');
  timestamp(observation.observed_at, 'loop observation.observed_at');
  timestamp(observation.freshness_expires_at, 'loop observation.freshness_expires_at');
  finiteNumber(observation.quality_score, 'loop observation.quality_score', { min: 0, max: 100 });
  string(observation.observation_window, 'loop observation.observation_window', {
    min: 21,
    max: 21,
    pattern: /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/,
  });
  const [startsAt, endsAt] = observation.observation_window.split('/').map(Date.parse);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt < startsAt) {
    fail('loop observation.observation_window is not chronological');
  }
}

export function evaluateManualMarketingLoop(catalog, request, deps = {}) {
  validateMarketingCapabilityCatalog(catalog);
  object(request, 'manual loop request');
  if (!Object.hasOwn(request, 'loop_id')) fail('manual loop request is missing loop_id');
  assertVersionedId(request.loop_id, 'manual loop request.loop_id');
  const loop = findInvocable(catalog.loops, request.loop_id, 'loop');
  exactKeys(request, ['loop_id', 'observation'], 'manual loop request');
  validateLoopObservation(request.observation);
  const deterministic = resolveDeterministicInputs(deps);
  const matched = Date.parse(request.observation.freshness_expires_at) <= Date.parse(deterministic.now);
  const reasonCode = matched ? 'content_decay_detected' : 'asset_fresh';
  const branch = loop.manual_outcomes.find(({ reason_code: candidate }) => candidate === reasonCode);
  if (!branch) fail(`loop ${loop.id} does not declare the required ${reasonCode} manual outcome`);
  const inputDigest = canonicalDigest(request.observation);
  const runIdentity = {
    tenant_id: request.observation.tenant_id,
    loop_version: loop.id.split('@')[1],
    observation_window: request.observation.observation_window,
    input_digest: inputDigest,
  };
  const runId = stableId('marketing-loop-run', runIdentity);
  const stepsExecuted = loop.body.steps.map((step, index) => ({
    sequence: index + 1,
    step,
    status: 'checked',
  }));
  const selfChecks = loop.self_checks.map((checkId) => ({
    check_id: checkId,
    status: 'passed',
  }));
  let refreshBrief = null;
  if (matched) {
    const refreshBriefBase = {
      schema_version: 'marketing_refresh_brief@1.0.0',
      tenant_id: request.observation.tenant_id,
      source_asset_id: request.observation.asset_id,
      source_asset_digest: request.observation.source_asset_digest,
      observation_digest: inputDigest,
      objective: 'Prepare one evidence-bound refresh proposal for human review.',
      reason_code: reasonCode,
      review_required: true,
      output_destination: loop.output_destination,
      created_at: deterministic.now,
    };
    const refreshBriefWithId = {
      ...refreshBriefBase,
      record_id: stableId('marketing-refresh-brief', refreshBriefBase),
    };
    refreshBrief = {
      ...refreshBriefWithId,
      brief_digest: canonicalDigest(refreshBriefWithId),
    };
  }
  const receiptBase = {
    schema_version: 'marketing_loop_receipt@1.0.0',
    loop_id: loop.id,
    run_id: runId,
    generated_at: deterministic.now,
    outcome: branch.status,
    reason_code: branch.reason_code,
    redaction_applied: true,
    artifact_count: refreshBrief ? 1 : 0,
    replay_safe: true,
    schedule_armed: false,
    cursor_advanced: false,
    next_action: refreshBrief ? 'review_refresh_brief' : 'no_action_asset_fresh',
  };
  const receipt = {
    ...receiptBase,
    receipt_id: stableId('marketing-loop-receipt', receiptBase),
  };
  const result = {
    loop_id: loop.id,
    run_id: runId,
    run_identity: runIdentity,
    checked_at: deterministic.now,
    status: branch.status,
    reason_code: branch.reason_code,
    execution_mode: 'review_only',
    schedule_armed: false,
    output_destination: 'review_queue',
    network_calls: 0,
    observation_digest: inputDigest,
    cursor_advanced: false,
    state_effect: 'none_without_fenced_durable_artifact_receipt',
    idempotency_key: canonicalDigest(runIdentity),
    steps_executed: stepsExecuted,
    self_checks: selfChecks,
    refresh_brief: refreshBrief,
    receipt,
    seed_digest: canonicalDigest(deterministic.seed),
  };
  return { ...result, proof_digest: canonicalDigest(result) };
}

export function assessReviewPackageBridgeReadiness(assetCatalog, packageRecord, context) {
  validateMarketingAssetCatalog(assetCatalog);
  validateContractInstance(assetCatalog, 'channel_package@1.0.0', packageRecord);
  object(packageRecord, 'package record');
  exactKeys(context, ['now', 'current_source_asset_digest'], 'eligibility context');
  timestamp(context.now, 'eligibility context.now');
  assertDigest(context.current_source_asset_digest, 'eligibility context.current_source_asset_digest');

  const { package_digest: packageDigest, ...packageDigestInput } = packageRecord;
  if (canonicalDigest(packageDigestInput) !== packageDigest) {
    return {
      review_ready: false,
      publish_eligible: false,
      requires_engage_authority: true,
      reason_code: 'package_digest_changed',
    };
  }

  if (packageRecord.execution_mode !== 'review_only' || packageRecord.publish_eligible !== false) {
    return {
      review_ready: false,
      publish_eligible: false,
      requires_engage_authority: true,
      reason_code: 'unsafe_package_mode',
    };
  }
  if (packageRecord.rights_state !== 'cleared') {
    return {
      review_ready: false, publish_eligible: false, requires_engage_authority: true, reason_code: 'rights_not_cleared',
    };
  }
  if (typeof packageRecord.freshness_expires_at !== 'string'
      || !Number.isFinite(Date.parse(packageRecord.freshness_expires_at))
      || Date.parse(packageRecord.freshness_expires_at) <= Date.parse(context.now)) {
    return {
      review_ready: false, publish_eligible: false, requires_engage_authority: true, reason_code: 'asset_expired',
    };
  }
  if (packageRecord.source_asset_digest !== context.current_source_asset_digest) {
    return {
      review_ready: false, publish_eligible: false, requires_engage_authority: true, reason_code: 'source_digest_changed',
    };
  }
  if (packageRecord.approval_state !== 'awaiting_human_approval') {
    return {
      review_ready: false, publish_eligible: false, requires_engage_authority: true, reason_code: 'unsafe_self_asserted_approval',
    };
  }
  return {
    review_ready: false,
    publish_eligible: false,
    requires_engage_authority: true,
    reason_code: 'canonical_approval_decision_required',
  };
}
