// Cambium spend policy — schema validation only, with no runtime/provider authority.
//
// Current adapters use legacy scalar `none` and `gated` values. They normalize into
// the same typed policy shape used by future subscription/metered adapters, while
// every unknown or malformed value remains fail-closed.

export const SPEND_VOCABULARY = Object.freeze([
  'none',
  'subscription',
  'metered',
  'gated',
]);

const SPEND_TIERS = new Set(SPEND_VOCABULARY);
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key));
}

function validIsoDateTime(value) {
  if (!nonEmptyString(value) || !ISO_DATE_TIME.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const calendarMatches = calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day;
  return calendarMatches && Number.isFinite(Date.parse(value));
}

function validateBudgetWindow(window) {
  if (!isRecord(window)) return 'budget_window must be an object';
  const extras = unknownKeys(window, new Set(['starts_at', 'ends_at']));
  if (extras.length) return `budget_window contains unknown fields: ${extras.join(', ')}`;
  if (!validIsoDateTime(window.starts_at)) {
    return 'budget_window.starts_at must be an ISO date-time';
  }
  if (!validIsoDateTime(window.ends_at)) {
    return 'budget_window.ends_at must be an ISO date-time';
  }
  const startsAt = Date.parse(window.starts_at);
  const endsAt = Date.parse(window.ends_at);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return 'budget_window bounds must be valid ISO date-times';
  }
  if (endsAt <= startsAt) return 'budget_window.ends_at must be after starts_at';
  return null;
}

function providerUsesNetwork(adapter) {
  const providerIo = adapter?.provider_io;
  if (providerIo === true || nonEmptyString(providerIo) || isRecord(providerIo)) return true;

  const networkProvider = adapter?.network_provider;
  if (networkProvider === true || nonEmptyString(networkProvider) || isRecord(networkProvider)) return true;

  const provider = adapter?.provider;
  if (provider === 'network') return true;
  return isRecord(provider) && (
    provider.network === true
    || provider.transport === 'network'
    || provider.kind === 'network'
    || provider.type === 'network'
  );
}

/**
 * Convert the two legacy scalar policies and typed policies to one canonical shape.
 * Missing spend retains the historical gated default. Malformed values throw so a
 * caller cannot accidentally treat them as a permissive tier.
 */
export function normalizeSpendPolicy(value) {
  if (value === undefined) return { tier: 'gated' };
  if (typeof value === 'string') {
    if (!SPEND_TIERS.has(value)) throw new TypeError(`unknown spend tier "${value}"`);
    return { tier: value };
  }
  if (!isRecord(value)) throw new TypeError('spend policy must be a tier string or object');
  if (!nonEmptyString(value.tier)) throw new TypeError('spend policy tier must be a non-empty string');
  if (!SPEND_TIERS.has(value.tier)) throw new TypeError(`unknown spend tier "${value.tier}"`);
  return { ...value };
}

function invalid(reason) {
  return { ok: false, code: 'invalid_spend_policy', reason };
}

/**
 * Validate one adapter's spend declaration. This is intentionally non-throwing so
 * runtime gates can return a structured refusal instead of entering execution.
 */
export function validateSpendPolicy(adapter = {}) {
  if (!isRecord(adapter)) return invalid('adapter must be an object');

  let policy;
  try {
    policy = normalizeSpendPolicy(hasOwn(adapter, 'spend') ? adapter.spend : undefined);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'malformed spend policy');
  }

  if (policy.tier === 'none' || policy.tier === 'gated') {
    const extras = unknownKeys(policy, new Set(['tier']));
    if (extras.length) return invalid(`${policy.tier} spend policy contains unknown fields: ${extras.join(', ')}`);
  }

  if (policy.tier === 'subscription') {
    const extras = unknownKeys(policy, new Set(['tier', 'provider_binding', 'budget_window']));
    if (extras.length) return invalid(`subscription spend policy contains unknown fields: ${extras.join(', ')}`);
    if (!nonEmptyString(policy.provider_binding)) {
      return invalid('subscription spend policy requires provider_binding');
    }
    const windowError = validateBudgetWindow(policy.budget_window);
    if (windowError) return invalid(windowError);
  }

  if (policy.tier === 'metered') {
    const extras = unknownKeys(policy, new Set([
      'tier',
      'unit',
      'limit',
      'budget_window',
      'provider_binding',
    ]));
    if (extras.length) return invalid(`metered spend policy contains unknown fields: ${extras.join(', ')}`);
    if (!nonEmptyString(policy.unit)) return invalid('metered spend policy requires a non-empty unit');
    if (!Number.isFinite(policy.limit) || policy.limit <= 0) {
      return invalid('metered spend policy requires a positive finite limit');
    }
    if (hasOwn(policy, 'provider_binding') && !nonEmptyString(policy.provider_binding)) {
      return invalid('metered provider_binding must be a non-empty string when present');
    }
    const windowError = validateBudgetWindow(policy.budget_window);
    if (windowError) return invalid(windowError);
  }

  if (policy.tier === 'none' && providerUsesNetwork(adapter)) {
    return invalid('spend:none cannot declare provider I/O or a network provider');
  }

  return { ok: true, policy };
}
