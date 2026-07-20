import { canonicalDigest } from './lead-contracts.mjs';

export const LEAD_ADAPTER_CATALOG_ID = 'lead-adapters@1.0.0';
export const LEAD_ADAPTER_IDS = Object.freeze([
  'explee-read@1.0.0',
  'scrapegraphai-discover@1.0.0',
  'getleads-capture@1.0.0',
  'apollo-enrichment@1.0.0',
  'apollo-engagement@1.0.0',
  'composio-engagement@1.0.0',
  'elevenlabs-create@1.0.0',
  'runway-create@1.0.0',
]);

const STAGES = new Set(['discover', 'capture', 'enrich', 'understand', 'create', 'engage']);
const SPEND = new Set(['none', 'subscription', 'metered', 'gated']);
const ACTIVATIONS = new Set(['active_read_only', 'registered_disabled']);
const METHODS = new Set(['GET', 'POST']);
const SCHEDULE_PREREQUISITES = Object.freeze([
  'durable_task_state',
  'idempotency_keys',
  'provider_receipts',
  'stop_rules',
  'spend_accounting',
]);

function fail(message) {
  throw new Error(`lead adapter catalog: ${message}`);
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  record(value, label);
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  const extras = actual.filter((key) => !expected.includes(key));
  if (missing.length) fail(`${label} missing fields: ${missing.join(', ')}`);
  if (extras.length) fail(`${label} contains unknown fields: ${extras.join(', ')}`);
}

function strings(value, label, { minimum = 1 } = {}) {
  if (!Array.isArray(value) || value.length < minimum
      || value.some((item) => typeof item !== 'string' || item.length === 0)
      || new Set(value).size !== value.length) {
    fail(`${label} must contain unique non-empty strings`);
  }
  return value;
}

function validateAdapter(adapter, index) {
  const label = `adapters[${index}]`;
  exactKeys(adapter, [
    'id', 'provider', 'stages', 'jobs', 'risk_order', 'activation',
    'transport', 'spend', 'authority',
  ], label);
  if (adapter.id !== LEAD_ADAPTER_IDS[index]) fail(`${label}.id violates the fixed risk order`);
  if (typeof adapter.provider !== 'string' || adapter.provider.length === 0) fail(`${label}.provider is required`);
  const stages = strings(adapter.stages, `${label}.stages`);
  if (stages.some((stage) => !STAGES.has(stage))) fail(`${label}.stages contains an unknown lead stage`);
  strings(adapter.jobs, `${label}.jobs`);
  if (!Number.isSafeInteger(adapter.risk_order) || adapter.risk_order !== (index + 1) * 10) {
    fail(`${label}.risk_order must increase by ten`);
  }
  exactKeys(adapter.activation, ['state', 'network_enabled', 'schedule_enabled'], `${label}.activation`);
  if (!ACTIVATIONS.has(adapter.activation.state)) fail(`${label}.activation.state is invalid`);
  if (adapter.activation.schedule_enabled !== false) fail(`${label} cannot own schedule authority`);
  if (index === 0) {
    if (adapter.activation.state !== 'active_read_only' || adapter.activation.network_enabled !== true) {
      fail('Explee must be the only active read-only adapter');
    }
  } else if (adapter.activation.state !== 'registered_disabled' || adapter.activation.network_enabled !== false) {
    fail(`${label} must remain registered disabled`);
  }
  exactKeys(adapter.transport, ['kind', 'methods', 'mutation_enabled'], `${label}.transport`);
  if (!['provider_api', 'mcp', 'action_api'].includes(adapter.transport.kind)) {
    fail(`${label}.transport.kind is invalid`);
  }
  const methods = strings(adapter.transport.methods, `${label}.transport.methods`);
  if (methods.some((method) => !METHODS.has(method))) fail(`${label}.transport.methods is invalid`);
  const sideEffecting = stages.includes('engage')
    || ['elevenlabs-create@1.0.0', 'runway-create@1.0.0'].includes(adapter.id);
  if (adapter.transport.mutation_enabled !== sideEffecting) {
    fail(`${label}.transport.mutation_enabled must match provider side-effect authority`);
  }
  exactKeys(adapter.spend, ['tier', 'reservation_required', 'usage_settlement_required'], `${label}.spend`);
  if (!SPEND.has(adapter.spend.tier)) fail(`${label}.spend.tier is invalid`);
  const noSpend = adapter.spend.tier === 'none';
  if (adapter.spend.reservation_required !== !noSpend
      || adapter.spend.usage_settlement_required !== !noSpend) {
    fail(`${label}.spend ledger requirements do not match its tier`);
  }
  exactKeys(adapter.authority, ['owner', 'approval_required', 'receipt_required'], `${label}.authority`);
  if (adapter.authority.owner !== 'cambium' || adapter.authority.receipt_required !== true) {
    fail(`${label}.authority must remain Cambium-owned and receipt-bound`);
  }
  if (adapter.authority.approval_required !== stages.includes('engage')
      && !['elevenlabs-create@1.0.0', 'runway-create@1.0.0'].includes(adapter.id)) {
    fail(`${label}.authority approval requirement drifted`);
  }
  if (['elevenlabs-create@1.0.0', 'runway-create@1.0.0'].includes(adapter.id)
      && adapter.authority.approval_required !== true) {
    fail(`${label} must require approval`);
  }
}

export function validateLeadAdapterCatalog(catalog) {
  exactKeys(catalog, [
    'catalog_id', 'catalog_digest', 'authority', 'risk_policy',
    'recurring_schedule', 'adapters',
  ], 'catalog');
  if (catalog.catalog_id !== LEAD_ADAPTER_CATALOG_ID) fail(`catalog_id must be ${LEAD_ADAPTER_CATALOG_ID}`);
  if (!/^[a-f0-9]{64}$/.test(catalog.catalog_digest)) fail('catalog_digest must be lowercase SHA-256');
  const unsigned = structuredClone(catalog);
  delete unsigned.catalog_digest;
  if (canonicalDigest(unsigned) !== catalog.catalog_digest) fail('catalog_digest does not match canonical content');

  exactKeys(catalog.authority, ['owner', 'exclusive_runtime_writer'], 'authority');
  if (catalog.authority.owner !== 'cambium' || catalog.authority.exclusive_runtime_writer !== true) {
    fail('Cambium must remain the exclusive runtime writer');
  }
  exactKeys(catalog.risk_policy, ['order', 'rule'], 'risk_policy');
  if (catalog.risk_policy.rule !== 'lower_risk_must_be_proven_before_higher_risk_activation') {
    fail('risk policy rule drifted');
  }
  if (JSON.stringify(catalog.risk_policy.order) !== JSON.stringify(LEAD_ADAPTER_IDS)) {
    fail('risk policy order drifted');
  }

  exactKeys(catalog.recurring_schedule, ['armed', 'prerequisites'], 'recurring_schedule');
  if (catalog.recurring_schedule.armed !== false) fail('recurring schedules must remain unarmed');
  if (JSON.stringify(catalog.recurring_schedule.prerequisites) !== JSON.stringify(SCHEDULE_PREREQUISITES)) {
    fail('recurring schedule prerequisites drifted');
  }
  if (!Array.isArray(catalog.adapters) || catalog.adapters.length !== LEAD_ADAPTER_IDS.length) {
    fail(`adapters must contain exactly ${LEAD_ADAPTER_IDS.length} entries`);
  }
  catalog.adapters.forEach(validateAdapter);
  return {
    valid: true,
    catalog_id: catalog.catalog_id,
    catalog_digest: catalog.catalog_digest,
    adapter_ids: [...LEAD_ADAPTER_IDS],
    schedule_armed: false,
  };
}

export function evaluateRecurringScheduleArm(catalog, evidence = {}) {
  validateLeadAdapterCatalog(catalog);
  const missing = SCHEDULE_PREREQUISITES.filter((key) => evidence[key] !== true);
  return missing.length
    ? { allowed: false, schedule_armed: false, missing }
    : { allowed: true, schedule_armed: false, missing: [], requires_explicit_arm_change: true };
}

export { SCHEDULE_PREREQUISITES };
