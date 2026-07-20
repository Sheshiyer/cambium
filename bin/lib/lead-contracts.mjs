import { createHash } from 'node:crypto';

export const REQUIRED_CONTRACT_NAMES = Object.freeze([
  'lead_record',
  'provider_observation',
  'source_alias',
  'identity_resolution',
  'suppression_state',
  'icp_score',
  'signal_batch',
  'content_asset',
  'action_request',
  'approval_decision',
  'execution_attempt',
  'outcome_event',
  'reconciliation',
  'compensation',
  'operator_receipt',
  'provider_binding',
  'provider_contract',
  'provider_permission',
  'writer_lease',
  'derived_learning',
]);

const PROVIDER_RECORDS = new Set([
  'provider_observation',
  'provider_binding',
  'provider_contract',
  'provider_permission',
]);
const PROVIDER_OVERRIDE_KEYS = new Set([
  'account_id',
  'account_override',
  'campaign_id',
  'campaign_override',
  'project_id',
  'project_override',
  'tenant_override',
  'workspace_override',
]);
const SECRET_KEYS = /^(?:authorization|cookie|set_cookie|api_?key|access_?token|refresh_?token|token|password|passwd|client_?secret|private_?key|credential|credentials|secret)$/i;
const SENSITIVE_RECEIPT_KEYS = /^(?:email|phone|name|address|payload|content|document|body|url|identity|contact|credential|token|provider_response)$/i;
const RAW_LEARNING_KEYS = /(?:^|_)(?:raw|email|phone|address|identity|alias|contact|payload|text|domain)(?:_|$)/i;
const SEMVER = /^\d+\.\d+\.\d+$/;
const SECRET_REF = /^secretref:\/\/[a-z0-9][a-z0-9._/-]{2,255}$/;
const LOCAL_REF_PREFIX = '#/$defs/';

function fail(message, path = '') {
  const suffix = path ? ` at ${path}` : '';
  throw new Error(`lead contract validation: ${message}${suffix}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalDigest(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function walk(value, visitor, path = '$') {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${path}.${key}`);
}

function resolveLocalRef(catalog, ref) {
  if (typeof ref !== 'string' || !ref.startsWith(LOCAL_REF_PREFIX)) {
    fail(`local-only $ref required; received ${String(ref)}`);
  }
  const name = ref.slice(LOCAL_REF_PREFIX.length);
  if (!name || name.includes('/') || !catalog.$defs?.[name]) fail(`unresolved local $ref ${ref}`);
  return catalog.$defs[name];
}

function assertClosedAndBounded(schema, catalog, path, activeRefs = new Set()) {
  if (!isObject(schema)) fail('schema node must be an object', path);
  if (schema.$ref) {
    const resolved = resolveLocalRef(catalog, schema.$ref);
    if (activeRefs.has(schema.$ref)) return;
    const next = new Set(activeRefs).add(schema.$ref);
    assertClosedAndBounded(resolved, catalog, schema.$ref, next);
    return;
  }

  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) fail('closed object requires additionalProperties false', path);
    if (!isObject(schema.properties)) fail('closed object requires properties', path);
    if (!Array.isArray(schema.required)) fail('closed object requires required list', path);
    for (const [key, child] of Object.entries(schema.properties)) {
      assertClosedAndBounded(child, catalog, `${path}.properties.${key}`, activeRefs);
    }
  }

  if (schema.type === 'array') {
    if (!Number.isInteger(schema.maxItems) || schema.maxItems < 0) fail('bounded array requires maxItems', path);
    if (!schema.items) fail('array requires items', path);
    assertClosedAndBounded(schema.items, catalog, `${path}.items`, activeRefs);
  }

  if (schema.type === 'string' && !Number.isInteger(schema.maxLength)) {
    fail('bounded string requires maxLength', path);
  }
  if ((schema.type === 'integer' || schema.type === 'number')
      && (!Number.isFinite(schema.minimum) || !Number.isFinite(schema.maximum))) {
    fail('bounded number requires minimum and maximum', path);
  }
}

function assertInlineSecretsAbsent(value) {
  function visit(node, path) {
    if (typeof node === 'string') {
      let url;
      try {
        url = new URL(node);
      } catch {
        return;
      }
      if (url.username || url.password) fail('inline secret in URL userinfo', path);
      for (const key of url.searchParams.keys()) {
        if (SECRET_KEYS.test(key)) fail(`inline secret in URL query ${key}`, path);
      }
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      if (key.endsWith('_ref') && typeof child === 'string' && SECRET_REF.test(child)) continue;
      if (SECRET_KEYS.test(key)) fail(`inline secret field ${key}`, `${path}.${key}`);
    }
  }
  walk(value, visit);
}

function assertCallerOverridesAbsent(value) {
  function visit(node, path) {
    if (!isObject(node)) return;
    for (const key of Object.keys(node)) {
      const childPath = `${path}.${key}`;
      if (PROVIDER_OVERRIDE_KEYS.has(key)) fail(`caller-owned override ${key} is forbidden`, childPath);
      if (key === 'tenant_id' && path !== '$.tenant' && !path.endsWith('.tenant')) {
        fail('caller-owned override tenant_id is only valid inside the authoritative tenant envelope', childPath);
      }
    }
  }
  walk(value, visit);
}

function assertDerivedOnly(value) {
  function visit(node, path) {
    if (!isObject(node)) return;
    for (const key of Object.keys(node)) {
      if (RAW_LEARNING_KEYS.test(key)) fail(`derived learning contains raw identity field ${key}`, `${path}.${key}`);
    }
  }
  walk(value, visit);
  if (value.minimum_cohort_size < 10) fail('derived learning minimum_cohort_size violates minimum 10');
}

function assertSafeReceipt(value) {
  function visit(node, path) {
    if (!isObject(node)) return;
    for (const key of Object.keys(node)) {
      if (SENSITIVE_RECEIPT_KEYS.test(key)) fail(`operator receipt exposes sensitive field ${key}`, `${path}.${key}`);
    }
  }
  walk(value, visit);
  if (value.redaction_applied !== true) fail('operator receipt redaction_applied must remain true');
}

function sameValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function validateSchemaValue(value, schema, catalog, path = '$') {
  if (schema.$ref) return validateSchemaValue(value, resolveLocalRef(catalog, schema.$ref), catalog, path);

  if ('const' in schema && !sameValue(value, schema.const)) fail(`must equal constant ${JSON.stringify(schema.const)}`, path);
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => sameValue(candidate, value))) {
    fail(`must be one of ${schema.enum.join(', ')}`, path);
  }

  if (schema.type === 'object') {
    if (!isObject(value)) fail('must be an object', path);
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) fail(`missing required property ${required}`, path);
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) fail(`unknown property ${key} in closed object`, `${path}.${key}`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateSchemaValue(value[key], childSchema, catalog, `${path}.${key}`);
    }
    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('must be an array', path);
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) fail(`requires at least ${schema.minItems} items`, path);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) fail(`allows at most ${schema.maxItems} items`, path);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(canonicalize(item)))).size !== value.length) {
      fail('array items must be unique', path);
    }
    value.forEach((item, index) => validateSchemaValue(item, schema.items, catalog, `${path}[${index}]`));
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') fail('must be a string', path);
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) fail(`requires minLength ${schema.minLength}`, path);
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) fail(`exceeds maxLength ${schema.maxLength}`, path);
    if (schema.pattern && !(new RegExp(schema.pattern, 'u')).test(value)) fail(`does not match ${schema.pattern}`, path);
    return;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') fail('must be a boolean', path);
    return;
  }

  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) fail('must be an integer', path);
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail('must be a finite number', path);
  } else if (schema.type) {
    fail(`unsupported schema type ${schema.type}`, path);
  }
  if ((schema.type === 'integer' || schema.type === 'number') && value < schema.minimum) {
    fail(`${path.split('.').at(-1)} violates minimum ${schema.minimum}`, path);
  }
  if ((schema.type === 'integer' || schema.type === 'number') && value > schema.maximum) {
    fail(`${path.split('.').at(-1)} violates maximum ${schema.maximum}`, path);
  }
}

function getContract(catalog, contractId) {
  const item = catalog.contracts?.find(({ id }) => id === contractId);
  if (!item) fail(`unknown contract ${contractId}`);
  return item;
}

function semanticValidate(name, value) {
  if (name === 'identity_resolution') {
    if (new Set(value.source_alias_ids).size !== value.source_alias_ids.length) {
      fail('identity resolution source aliases must be unique');
    }
    if (value.source_alias_ids.includes(value.canonical_lead_id)) {
      fail('identity resolution canonical lead cannot be its own source alias');
    }
    if (value.expected_revision !== value.revision - 1) {
      fail('stale identity revision: expected_revision must equal revision minus one');
    }
    if (['merged', 'split'].includes(value.resolution_state) && value.lineage_ids.length === 0) {
      fail(`${value.resolution_state} identity resolution requires lineage`);
    }
    if (value.resolution_state === 'merged' && value.lineage_ids.includes(value.canonical_lead_id)) {
      fail('identity resolution self-merge is forbidden');
    }
  }

  if (name === 'suppression_state') {
    if (value.suppressed && value.reasons.length === 0) fail('suppressed records require at least one reason');
    if (value.dominates_actions !== true) fail('suppression must dominate downstream actions');
    if (value.consent_basis === 'withdrawn' && value.suppressed !== true) {
      fail('withdrawn consent must remain suppressed');
    }
    if (value.reasons.includes('hard_bounce') && value.suppressed !== true) {
      fail('bounce suppression must remain suppressed');
    }
    if (value.reasons.includes('opt_out') && value.suppressed !== true) {
      fail('opt-out suppression must remain suppressed');
    }
    if (value.propagation.aliases !== true || value.propagation.channels !== true) {
      fail('suppression must propagate across aliases and channels');
    }
    if (value.provider_refresh_cannot_clear !== true) {
      fail('provider refresh cannot clear suppression');
    }
  }

  if (name === 'content_asset' && Date.parse(value.expires_at) <= Date.parse(value.created_at)) {
    fail('content asset expiry must follow creation');
  }

  if (name === 'action_request') {
    const digest = canonicalActionDigest(value);
    if (value.action_digest !== digest) fail('canonical action digest mismatch');
  }

  if (name === 'approval_decision' && value.scope !== 'exact_action') {
    fail('approval scope must be exact_action');
  }

  if (name === 'provider_contract') {
    if (value.mutation_default !== false) fail('provider mutation_default must remain false');
    if (!value.target_refs.every((target) => /^fixture:\/\/[a-z0-9][a-z0-9._/-]{2,255}$/.test(target))) {
      fail('provider contracts require an offline local fixture target');
    }
    if (value.supported_operations.some((operation) => operation !== 'observe')) {
      fail('provider contract operations must remain observation-only');
    }
    if (value.endpoint_allowlist.some((endpoint) => endpoint.methods.some((method) => !['GET', 'HEAD'].includes(method)))) {
      fail('provider contract requires observation-only endpoint methods');
    }
    const targets = new Set(value.target_refs);
    if (value.endpoint_allowlist.some((endpoint) => !targets.has(endpoint.endpoint_ref))) {
      fail('provider endpoint allowlist must use declared offline local fixture targets');
    }
    if (value.timeout_ms < 100 || value.timeout_ms > 30000) {
      fail('provider timeout_ms violates bounded range');
    }
    if (value.retry_policy.max_attempts > 3) {
      fail('provider retry max_attempts violates maximum 3');
    }
    if (value.retry_policy.max_delay_ms < value.retry_policy.base_delay_ms) {
      fail('provider retry max_delay_ms must not precede base_delay_ms');
    }
    if (value.schema_drift_policy !== 'fail_closed') {
      fail('provider contract schema drift policy must fail closed');
    }
    if (value.receipt_policy !== 'redacted_digest_only') {
      fail('provider contract receipt policy must remain redacted_digest_only');
    }
  }

  if (name === 'execution_attempt') {
    if (value.state === 'ambiguous' && value.reconciliation_required !== true) {
      fail('ambiguous attempts require reconciliation');
    }
    if (Date.parse(value.completed_at) < Date.parse(value.started_at)) fail('execution completion precedes start');
    if (value.prior_attempt_id === value.record_id) fail('execution attempt cannot reference itself as prior attempt');
  }

  if (name === 'outcome_event' && Date.parse(value.observed_at) < Date.parse(value.occurred_at)) {
    fail('outcome observation cannot precede provider occurrence');
  }

  if (name === 'writer_lease' && Date.parse(value.expires_at) <= Date.parse(value.acquired_at)) {
    fail('writer lease expiry must follow acquisition');
  }

  if (name === 'reconciliation' && value.resolution === 'matched' && value.expected_state !== value.observed_state) {
    fail('matched reconciliation requires equal expected and observed state');
  }

  if (name === 'provider_binding') {
    if (value.mutation_enabled !== false) fail('provider mutation_enabled must remain false');
    if (value.kill_switch !== 'engaged') fail('provider kill switch must remain engaged');
  }

  if (name === 'provider_permission' && value.allowed_operations.some((operation) => operation !== 'observe')) {
    fail('provider permission operations must remain observation-only');
  }

  if (name === 'operator_receipt') assertSafeReceipt(value);
  if (name === 'derived_learning') assertDerivedOnly(value);
}

export function validateLeadContractCatalog(catalog) {
  if (!isObject(catalog)) fail('catalog must be an object');
  if (!SEMVER.test(catalog.version ?? '')) fail('catalog version must be semantic');
  if (catalog.catalog_id !== `lead-ecosystem@${catalog.version}`) fail('catalog_id must bind lead-ecosystem@version');
  if (!isObject(catalog.$defs)) fail('catalog requires $defs');
  if (!Array.isArray(catalog.contracts)) fail('catalog requires contracts');

  for (const [name, schema] of Object.entries(catalog.$defs)) {
    assertClosedAndBounded(schema, catalog, `#/$defs/${name}`);
  }

  const ids = new Set();
  const names = new Set();
  for (const item of catalog.contracts) {
    if (!isObject(item)) fail('contract entry must be an object');
    if (!SEMVER.test(item.version ?? '')) fail(`contract ${item.name ?? '<unknown>'} version must be semantic`);
    if (ids.has(item.id)) fail(`duplicate contract id ${item.id}`);
    if (item.id !== `${item.name}@${item.version}`) fail(`contract ${item.name} id must equal name@version`);
    if (names.has(item.name)) fail(`duplicate contract name ${item.name}`);
    ids.add(item.id);
    names.add(item.name);
    if (!['lifecycle', 'provider', 'authority'].includes(item.category)) fail(`contract ${item.id} has invalid category`);
    if (item.owner !== 'cambium') fail(`contract ${item.id} must be owned by cambium`);
    if (!isObject(item.schema) || item.schema.type !== 'object') fail(`contract ${item.id} schema must be object`);
    if (item.schema.additionalProperties !== false) fail(`contract ${item.id} must be a closed object`);
    if (!item.schema.required?.includes('tenant')) fail(`contract ${item.id} must require tenant`);
    const tenantRef = item.schema.properties?.tenant?.$ref;
    resolveLocalRef(catalog, tenantRef);
    if (tenantRef !== '#/$defs/tenant_envelope') {
      fail(`contract ${item.id} must use the bounded closed tenant envelope`);
    }
    assertClosedAndBounded(item.schema, catalog, `contracts.${item.id}.schema`);
  }

  for (const required of REQUIRED_CONTRACT_NAMES) {
    if (!names.has(required)) fail(`missing required contract ${required}`);
  }
  if (names.size !== REQUIRED_CONTRACT_NAMES.length) fail('catalog contains unsupported contract names');

  walk(catalog, (node) => {
    if (isObject(node) && Object.hasOwn(node, '$ref')) resolveLocalRef(catalog, node.$ref);
  });

  return { valid: true, catalog_id: catalog.catalog_id, contract_ids: [...ids] };
}

export function validateContractInstance(catalog, contractId, value) {
  const item = getContract(catalog, contractId);
  assertInlineSecretsAbsent(value);
  if (PROVIDER_RECORDS.has(item.name)) assertCallerOverridesAbsent(value);
  if (item.name === 'derived_learning') assertDerivedOnly(value);
  if (item.name === 'operator_receipt') assertSafeReceipt(value);
  semanticValidate(item.name, value);
  validateSchemaValue(value, item.schema, catalog);
  return { valid: true, contract_id: contractId, record_id: value.record_id };
}

function actionDigestPayload(actionRequest) {
  return {
    tenant_id: actionRequest.tenant?.tenant_id,
    action_request_id: actionRequest.record_id,
    provider_binding_id: actionRequest.provider_binding_id,
    capability: actionRequest.capability,
    operation: actionRequest.operation,
    endpoint_ref: actionRequest.endpoint_ref,
    tool_id: actionRequest.tool_id,
    http_method: actionRequest.http_method,
    adapter_version: actionRequest.adapter_version,
    canonicalization_version: actionRequest.canonicalization_version,
    payload_digest: actionRequest.payload_digest,
    credential_binding_digest: actionRequest.credential_binding_digest,
    budget_reservation_id: actionRequest.budget_reservation_id,
    actor_id: actionRequest.actor_id,
    expires_at: actionRequest.expires_at,
    idempotency_key: actionRequest.idempotency_key,
    suppression_revision: actionRequest.suppression_revision,
    eligibility: actionRequest.eligibility,
  };
}

export function canonicalActionDigest(actionRequest) {
  return canonicalDigest(actionDigestPayload(actionRequest));
}

export function validateApprovalBinding(actionRequest, approvalDecision, { now = null } = {}) {
  if (actionRequest.action_digest !== canonicalActionDigest(actionRequest)) fail('canonical action digest mismatch');
  if (approvalDecision.scope !== 'exact_action') fail('approval scope must be exact_action');
  if (approvalDecision.action_request_id !== actionRequest.record_id) fail('approval action request mismatch');
  if (approvalDecision.action_digest !== actionRequest.action_digest) fail('approval action digest mismatch');
  if (approvalDecision.tenant?.tenant_id !== actionRequest.tenant?.tenant_id) fail('approval tenant mismatch');
  if (approvalDecision.decision !== 'approved') fail('approval decision is not approved');
  if (Date.parse(approvalDecision.expires_at) > Date.parse(actionRequest.expires_at)) {
    fail('approval expiry cannot outlive action expiry');
  }
  if (now !== null && Date.parse(actionRequest.expires_at) <= Date.parse(now)) fail('action request has expired');
  if (now !== null && Date.parse(approvalDecision.expires_at) <= Date.parse(now)) fail('approval has expired');
  return { valid: true, action_digest: actionRequest.action_digest };
}

export function validateLifecycleInvariants({
  identityResolution,
  suppressionState,
  actionRequest,
  sourceAliases = [],
  leadRecord,
  stage = null,
}) {
  const tenants = [identityResolution, suppressionState, actionRequest, leadRecord, ...sourceAliases]
    .filter(Boolean)
    .map((record) => record.tenant?.tenant_id);
  if (new Set(tenants).size > 1) fail('lifecycle records cross tenant boundaries');
  if (stage && ['create', 'engage'].includes(stage)) {
    if (leadRecord?.status === 'expired') fail(`expired leads cannot enter ${stage}`);
    if (leadRecord?.consent_state === 'withdrawn') fail(`withdrawn leads cannot enter ${stage}`);
    if (suppressionState?.suppressed) fail(`suppressed leads cannot enter ${stage}`);
    if (actionRequest?.eligibility !== 'eligible') fail(`ineligible leads cannot enter ${stage}`);
  }
  if (suppressionState?.suppressed && actionRequest?.eligibility === 'eligible') {
    fail('suppression dominates approval and action eligibility');
  }
  if (identityResolution && new Set(identityResolution.source_alias_ids).size !== identityResolution.source_alias_ids.length) {
    fail('identity resolution source aliases must be unique');
  }
  return { valid: true };
}

export function validateProviderConformanceFixture(catalog, fixture, { network = null } = {}) {
  void network;
  if (!isObject(fixture) || fixture.fixture_version !== 'provider-conformance@1.0.0') {
    fail('unsupported provider conformance fixture version');
  }
  assertInlineSecretsAbsent(fixture);
  assertCallerOverridesAbsent(fixture);

  const providerContract = fixture.provider_contract;
  const permission = fixture.provider_permission;
  const binding = fixture.provider_binding;
  const observation = fixture.observation;
  validateContractInstance(catalog, 'provider_contract@1.0.0', providerContract);
  validateContractInstance(catalog, 'provider_permission@1.0.0', permission);
  validateContractInstance(catalog, 'provider_binding@1.0.0', binding);
  validateContractInstance(catalog, 'provider_observation@1.0.0', observation);

  if (providerContract.provider_permission_id !== permission.record_id) fail('provider contract permission reference mismatch');
  if (binding.provider_contract_id !== providerContract.record_id) fail('provider binding contract reference mismatch');
  if (binding.provider_permission_id !== permission.record_id) fail('provider binding permission reference mismatch');
  if (observation.provider_binding_id !== binding.record_id) fail('provider observation binding reference mismatch');

  const tenants = [providerContract, permission, binding, observation].map((record) => record.tenant.tenant_id);
  if (new Set(tenants).size !== 1) fail('provider fixture crosses tenant boundaries');
  const digest = canonicalDigest(observation);
  if (fixture.expected_observation_digest !== digest) fail('provider observation digest mismatch');

  return {
    valid: true,
    mode: 'offline-fixture',
    fixture_id: fixture.fixture_id,
    observation_id: observation.record_id,
    observation_digest: digest,
    mutation_enabled: binding.mutation_enabled,
    network_calls: 0,
  };
}
