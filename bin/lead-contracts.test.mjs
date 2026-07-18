import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REQUIRED_CONTRACT_NAMES,
  canonicalActionDigest,
  validateApprovalBinding,
  validateContractInstance,
  validateLeadContractCatalog,
  validateLifecycleInvariants,
} from './lib/lead-contracts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogPath = join(root, 'composition', 'contracts', 'lead-ecosystem.v1.json');

const clone = (value) => structuredClone(value);

async function loadCatalog() {
  return JSON.parse(await fs.readFile(catalogPath, 'utf8'));
}

function contract(catalog, name) {
  const found = catalog.contracts.find((candidate) => candidate.name === name);
  assert.ok(found, `catalog missing ${name}`);
  return found;
}

test('catalog declares every required lifecycle/provider contract exactly once', async () => {
  const catalog = await loadCatalog();
  const result = validateLeadContractCatalog(catalog);

  assert.equal(result.valid, true);
  assert.deepEqual(
    catalog.contracts.map(({ name }) => name).sort(),
    [...REQUIRED_CONTRACT_NAMES].sort(),
  );
  assert.equal(new Set(catalog.contracts.map(({ id }) => id)).size, catalog.contracts.length);
  for (const item of catalog.contracts) {
    assert.equal(item.id, `${item.name}@${item.version}`);
  }
});

test('every catalog example validates as its named closed contract', async () => {
  const catalog = await loadCatalog();
  validateLeadContractCatalog(catalog);

  for (const item of catalog.contracts) {
    assert.ok(item.example, `${item.id} needs a deterministic example`);
    const result = validateContractInstance(catalog, item.id, item.example);
    assert.equal(result.valid, true, `${item.id} example should validate`);
  }
});

test('catalog rejects duplicate IDs and IDs that do not bind name to version', async () => {
  const catalog = await loadCatalog();
  const duplicate = clone(catalog);
  duplicate.contracts[1].id = duplicate.contracts[0].id;
  assert.throws(() => validateLeadContractCatalog(duplicate), /duplicate contract id/i);

  const mismatched = clone(catalog);
  mismatched.contracts[0].id = `${mismatched.contracts[0].name}@9.9.9`;
  assert.throws(() => validateLeadContractCatalog(mismatched), /must equal name@version/i);
});

test('catalog rejects missing records, external refs, open shapes, and unbounded strings', async () => {
  const catalog = await loadCatalog();

  const missing = clone(catalog);
  missing.contracts = missing.contracts.filter(({ name }) => name !== 'writer_lease');
  assert.throws(() => validateLeadContractCatalog(missing), /missing required contract writer_lease/i);

  const external = clone(catalog);
  contract(external, 'lead_record').schema.properties.tenant.$ref = 'https://schemas.invalid/tenant.json';
  assert.throws(() => validateLeadContractCatalog(external), /local-only.*\$ref/i);

  const open = clone(catalog);
  contract(open, 'operator_receipt').schema.additionalProperties = true;
  assert.throws(() => validateLeadContractCatalog(open), /closed object/i);

  const unbounded = clone(catalog);
  delete contract(unbounded, 'lead_record').schema.properties.status.maxLength;
  assert.throws(() => validateLeadContractCatalog(unbounded), /bounded string/i);
});

test('all records use the bounded closed tenant envelope and local definitions', async () => {
  const catalog = await loadCatalog();
  validateLeadContractCatalog(catalog);

  assert.equal(catalog.$defs.tenant_envelope.additionalProperties, false);
  assert.ok(catalog.$defs.tenant_envelope.properties.tenant_id.maxLength <= 64);
  assert.ok(catalog.$defs.tenant_envelope.properties.purpose.maxLength <= 128);
  assert.ok(catalog.$defs.tenant_envelope.properties.retention_days.maximum <= 3650);

  for (const item of catalog.contracts) {
    assert.ok(item.schema.required.includes('tenant'), `${item.id} tenant must be required`);
    assert.equal(item.schema.properties.tenant.$ref, '#/$defs/tenant_envelope');
    assert.equal(item.schema.additionalProperties, false);
  }
});

test('recursive inline secrets are rejected while typed secret references remain data-only', async () => {
  const catalog = await loadCatalog();
  const binding = clone(contract(catalog, 'provider_binding').example);
  binding.runtime = { nested: { apiKey: 'plain-text-key' } };

  assert.throws(
    () => validateContractInstance(catalog, 'provider_binding@1.0.0', binding),
    /inline secret/i,
  );
  assert.match(contract(catalog, 'provider_binding').example.credential_ref, /^secretref:\/\//);
  assert.equal(
    validateContractInstance(catalog, 'provider_binding@1.0.0', contract(catalog, 'provider_binding').example).valid,
    true,
  );
});

test('provider records reject caller-owned tenant/account/project/campaign overrides', async () => {
  const catalog = await loadCatalog();
  const observation = clone(contract(catalog, 'provider_observation').example);
  observation.payload_facts[0].campaign_id = 'caller-chosen-campaign';

  assert.throws(
    () => validateContractInstance(catalog, 'provider_observation@1.0.0', observation),
    /caller-owned override.*campaign_id/i,
  );
});

test('exact approval binds the canonical action digest and cannot survive semantic drift', async () => {
  const catalog = await loadCatalog();
  const action = clone(contract(catalog, 'action_request').example);
  const approval = clone(contract(catalog, 'approval_decision').example);

  assert.equal(action.action_digest, canonicalActionDigest(action));
  assert.equal(validateApprovalBinding(action, approval, { now: '2026-07-18T00:00:00.000Z' }).valid, true);

  const badDigest = clone(approval);
  badDigest.action_digest = 'f'.repeat(64);
  assert.throws(() => validateApprovalBinding(action, badDigest), /action digest mismatch/i);

  const drifted = { ...action, capability: 'company_mutation' };
  assert.throws(() => validateApprovalBinding(drifted, approval), /canonical action digest mismatch/i);

  const reusableScope = { ...approval, scope: 'campaign' };
  assert.throws(() => validateApprovalBinding(action, reusableScope), /scope must be exact_action/i);
});

test('permission and data policy are required and provider mutation remains disabled', async () => {
  const catalog = await loadCatalog();
  const permission = clone(contract(catalog, 'provider_permission').example);
  delete permission.data_policy;
  assert.throws(
    () => validateContractInstance(catalog, 'provider_permission@1.0.0', permission),
    /missing required property data_policy/i,
  );

  const providerContract = clone(contract(catalog, 'provider_contract').example);
  providerContract.mutation_default = true;
  assert.throws(
    () => validateContractInstance(catalog, 'provider_contract@1.0.0', providerContract),
    /mutation_default must remain false/i,
  );

  const binding = clone(contract(catalog, 'provider_binding').example);
  binding.mutation_enabled = true;
  assert.throws(
    () => validateContractInstance(catalog, 'provider_binding@1.0.0', binding),
    /mutation_enabled must remain false/i,
  );
});

test('provider targets remain offline fixture references', async () => {
  const catalog = await loadCatalog();
  const providerContract = clone(contract(catalog, 'provider_contract').example);
  providerContract.target_refs = ['remote://forbidden-provider'];

  assert.throws(
    () => validateContractInstance(catalog, 'provider_contract@1.0.0', providerContract),
    /offline local fixture target/i,
  );
});

test('identity, suppression, writer lease, and derived-learning invariants fail closed', async () => {
  const catalog = await loadCatalog();

  const identity = clone(contract(catalog, 'identity_resolution').example);
  identity.source_alias_ids.push(identity.source_alias_ids[0]);
  assert.throws(
    () => validateContractInstance(catalog, 'identity_resolution@1.0.0', identity),
    /source aliases must be unique/i,
  );

  const suppression = clone(contract(catalog, 'suppression_state').example);
  suppression.suppressed = true;
  suppression.reasons = [];
  assert.throws(
    () => validateContractInstance(catalog, 'suppression_state@1.0.0', suppression),
    /suppressed records require at least one reason/i,
  );

  const action = clone(contract(catalog, 'action_request').example);
  action.eligibility = 'eligible';
  assert.throws(
    () => validateLifecycleInvariants({ identityResolution: identity, suppressionState: { ...suppression, reasons: ['opt_out'] }, actionRequest: action }),
    /suppression dominates/i,
  );

  const lease = clone(contract(catalog, 'writer_lease').example);
  lease.fencing_token = 0;
  assert.throws(
    () => validateContractInstance(catalog, 'writer_lease@1.0.0', lease),
    /fencing_token.*minimum/i,
  );

  const learning = clone(contract(catalog, 'derived_learning').example);
  learning.minimum_cohort_size = 1;
  assert.throws(
    () => validateContractInstance(catalog, 'derived_learning@1.0.0', learning),
    /minimum_cohort_size.*minimum/i,
  );

  const rawLearning = clone(contract(catalog, 'derived_learning').example);
  rawLearning.raw_email = 'person@example.invalid';
  assert.throws(
    () => validateContractInstance(catalog, 'derived_learning@1.0.0', rawLearning),
    /derived learning.*raw identity/i,
  );
});

test('operator receipts remain truthful, bounded, and redacted', async () => {
  const catalog = await loadCatalog();
  const receipt = clone(contract(catalog, 'operator_receipt').example);
  assert.equal(validateContractInstance(catalog, 'operator_receipt@1.0.0', receipt).valid, true);

  const unsafe = { ...receipt, email: 'person@example.invalid' };
  assert.throws(
    () => validateContractInstance(catalog, 'operator_receipt@1.0.0', unsafe),
    /operator receipt exposes sensitive field email/i,
  );

  const unredacted = { ...receipt, redaction_applied: false };
  assert.throws(
    () => validateContractInstance(catalog, 'operator_receipt@1.0.0', unredacted),
    /redaction_applied must remain true/i,
  );
});

test('identity resolution declares complete states, CAS, confidence, source, and lineage', async () => {
  const catalog = await loadCatalog();
  const item = contract(catalog, 'identity_resolution');
  const required = new Set(item.schema.required);
  const states = new Set(item.schema.properties.resolution_state.enum);

  assert.deepEqual(
    states,
    new Set(['ambiguous', 'matched', 'merged', 'split', 'review_required']),
  );
  for (const field of ['confidence', 'observed_at', 'source', 'revision', 'expected_revision', 'lineage_ids']) {
    assert.ok(required.has(field), `identity_resolution must require ${field}`);
  }

  const stale = clone(item.example);
  stale.expected_revision = stale.revision;
  assert.throws(
    () => validateContractInstance(catalog, item.id, stale),
    /stale identity revision|expected_revision.*revision/i,
  );

  const missingLineage = clone(item.example);
  missingLineage.resolution_state = 'merged';
  missingLineage.lineage_ids = [];
  assert.throws(
    () => validateContractInstance(catalog, item.id, missingLineage),
    /merged.*lineage/i,
  );

  const selfMerge = clone(item.example);
  selfMerge.resolution_state = 'merged';
  selfMerge.lineage_ids = [selfMerge.canonical_lead_id];
  assert.throws(
    () => validateContractInstance(catalog, item.id, selfMerge),
    /self-merge/i,
  );

  const crossTenantAlias = clone(contract(catalog, 'source_alias').example);
  crossTenantAlias.tenant.tenant_id = 'another-tenant';
  assert.throws(
    () => validateLifecycleInvariants({ identityResolution: item.example, sourceAliases: [crossTenantAlias] }),
    /cross tenant boundaries/i,
  );
});

test('suppression records bind consent, channels, disposition, propagation, and provider-refresh dominance', async () => {
  const catalog = await loadCatalog();
  const item = contract(catalog, 'suppression_state');
  const required = new Set(item.schema.required);
  for (const field of ['consent_basis', 'channel_scopes', 'retention_disposition', 'propagation', 'provider_refresh_cannot_clear']) {
    assert.ok(required.has(field), `suppression_state must require ${field}`);
  }

  const withdrawn = clone(item.example);
  withdrawn.consent_basis = 'withdrawn';
  withdrawn.suppressed = false;
  assert.throws(
    () => validateContractInstance(catalog, item.id, withdrawn),
    /withdrawn consent must remain suppressed/i,
  );

  const bounced = clone(item.example);
  bounced.reasons = ['hard_bounce'];
  bounced.suppressed = false;
  assert.throws(
    () => validateContractInstance(catalog, item.id, bounced),
    /bounce.*must remain suppressed/i,
  );

  const nonPropagating = clone(item.example);
  nonPropagating.propagation.aliases = false;
  assert.throws(
    () => validateContractInstance(catalog, item.id, nonPropagating),
    /suppression.*propagate/i,
  );

  const refreshClears = clone(item.example);
  refreshClears.provider_refresh_cannot_clear = false;
  assert.throws(
    () => validateContractInstance(catalog, item.id, refreshClears),
    /provider refresh cannot clear suppression/i,
  );
});

test('scores and content assets carry evidence, provenance, rights, approval, digest, and expiry', async () => {
  const catalog = await loadCatalog();
  const scoreRequired = new Set(contract(catalog, 'icp_score').schema.required);
  for (const field of ['evidence_refs', 'rule_version', 'model_version']) {
    assert.ok(scoreRequired.has(field), `icp_score must require ${field}`);
  }

  const assetRequired = new Set(contract(catalog, 'content_asset').schema.required);
  for (const field of ['provenance_refs', 'rights_status', 'approval_decision_id', 'content_digest', 'expires_at']) {
    assert.ok(assetRequired.has(field), `content_asset must require ${field}`);
  }
});

test('action digest binds every exact provider, target, credential, budget, actor, expiry, and replay field', async () => {
  const catalog = await loadCatalog();
  const item = contract(catalog, 'action_request');
  const required = new Set(item.schema.required);
  const boundFields = [
    'provider_binding_id',
    'capability',
    'endpoint_ref',
    'tool_id',
    'http_method',
    'adapter_version',
    'canonicalization_version',
    'payload_digest',
    'credential_binding_digest',
    'budget_reservation_id',
    'actor_id',
    'expires_at',
    'idempotency_key',
    'suppression_revision',
  ];
  for (const field of boundFields) assert.ok(required.has(field), `action_request must require ${field}`);

  const action = item.example;
  const approval = contract(catalog, 'approval_decision').example;
  for (const field of boundFields) {
    const changed = clone(action);
    if (typeof changed[field] === 'number') changed[field] += 1;
    else changed[field] = `${changed[field]}-changed`;
    assert.notEqual(canonicalActionDigest(changed), action.action_digest, `${field} must affect action digest`);
    assert.throws(
      () => validateApprovalBinding(changed, approval),
      /canonical action digest mismatch/i,
      `${field} drift must invalidate approval`,
    );
  }
});

test('attempt, outcome, reconciliation, compensation, and lease schemas preserve authority details', async () => {
  const catalog = await loadCatalog();
  const expectations = {
    execution_attempt: ['reconciliation_required', 'request_digest', 'response_digest', 'provider_receipt_digest', 'fencing_token', 'started_at', 'completed_at'],
    outcome_event: ['occurred_at', 'observed_at', 'provider_event_id', 'attribution'],
    writer_lease: ['campaign_scope', 'channel_scope'],
    reconciliation: ['expected_state', 'observed_state', 'resolution'],
    compensation: ['retry_eligible', 'repair_action', 'escalation_owner', 'deadline', 'receipt_digest'],
  };

  for (const [name, fields] of Object.entries(expectations)) {
    const required = new Set(contract(catalog, name).schema.required);
    for (const field of fields) assert.ok(required.has(field), `${name} must require ${field}`);
  }

  const ambiguous = clone(contract(catalog, 'execution_attempt').example);
  ambiguous.state = 'ambiguous';
  ambiguous.reconciliation_required = false;
  assert.throws(
    () => validateContractInstance(catalog, 'execution_attempt@1.0.0', ambiguous),
    /ambiguous attempts require reconciliation/i,
  );
});

test('provider contract pins endpoint methods and every offline execution safety policy', async () => {
  const catalog = await loadCatalog();
  const item = contract(catalog, 'provider_contract');
  const required = new Set(item.schema.required);
  for (const field of [
    'endpoint_allowlist',
    'timeout_ms',
    'retry_policy',
    'idempotency_policy',
    'redaction_policy',
    'reconciliation_policy',
    'receipt_policy',
    'api_schema_version',
    'schema_drift_policy',
    'error_classification',
  ]) {
    assert.ok(required.has(field), `provider_contract must require ${field}`);
  }

  const unsafeMethod = clone(item.example);
  unsafeMethod.endpoint_allowlist[0].methods = ['DELETE'];
  assert.throws(
    () => validateContractInstance(catalog, item.id, unsafeMethod),
    /observation-only endpoint method|must be one of/i,
  );

  const unboundedRetry = clone(item.example);
  unboundedRetry.retry_policy.max_attempts = 99;
  assert.throws(
    () => validateContractInstance(catalog, item.id, unboundedRetry),
    /max_attempts.*maximum/i,
  );
});

test('suppressed, expired, and withdrawn leads cannot enter create or engage', async () => {
  const catalog = await loadCatalog();
  const lead = clone(contract(catalog, 'lead_record').example);
  const suppression = clone(contract(catalog, 'suppression_state').example);
  const action = clone(contract(catalog, 'action_request').example);

  for (const stage of ['create', 'engage']) {
    assert.throws(
      () => validateLifecycleInvariants({ leadRecord: { ...lead, status: 'expired' }, suppressionState: suppression, actionRequest: action, stage }),
      /expired.*cannot enter (?:create|engage)/i,
    );
    assert.throws(
      () => validateLifecycleInvariants({ leadRecord: { ...lead, consent_state: 'withdrawn' }, suppressionState: suppression, actionRequest: action, stage }),
      /withdrawn.*cannot enter (?:create|engage)/i,
    );
    assert.throws(
      () => validateLifecycleInvariants({ leadRecord: lead, suppressionState: { ...suppression, suppressed: true, reasons: ['opt_out'] }, actionRequest: action, stage }),
      /suppressed.*cannot enter (?:create|engage)/i,
    );
  }
});
