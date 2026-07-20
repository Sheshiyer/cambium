// cambium-quests · audit-log module (zero-dependency, Map-backed, tenant-partitioned).
//
// Each tenant has an append-only log of AuditEvents. Stored events are never
// mutated — listAudit returns frozen shallow copies. The store is a plain Map
// keyed by tenant; there is no persistence layer (callers own that concern).
//
// auditToStoryBeat maps an event into a beat shape compatible with the
// story-feed beat sources referenced in mini-app-surface-contract.ts (id, kind,
// title, detail, at).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEvent {
  /** ISO-8601 timestamp of the event. */
  at: string;
  /** Principal who performed / attempted the action. */
  principalId: string;
  /** Tenant scope. */
  tenant: string;
  /** Human-readable action label, e.g. "publish-branch", "view-envelope". */
  action: string;
  /** Target resource, e.g. "branch-argus", "map-subsection:lanes". */
  target: string;
  /** RBAC decision for this event. */
  decision: 'allowed' | 'denied';
  /** Optional explanation (required/meaningful for denied events). */
  reason?: string;
}

/** Shape returned by listAudit — frozen shallow copy of the stored event. */
type FrozenEvent = Readonly<AuditEvent>;

/** Story-feed beat shape, compatible with source beat controls in the
 *  story-feed section of mini-app-surface-contract.ts. */
export interface AuditStoryBeat {
  id: string;
  kind: 'audit';
  title: string;
  detail: string;
  at: string;
}

/** The audit store — a Map tenant → AuditEvent[]. */
export interface AuditStore {
  /** @internal */
  _map: Map<string, AuditEvent[]>;
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function makeAuditStore(): AuditStore {
  return { _map: new Map() };
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/** Append a single audit event. The event object is shallow-copied before
 *  storage to prevent callers from mutating stored data through a live
 *  reference. */
export function appendAudit(store: AuditStore, event: AuditEvent): void {
  const tenant = event.tenant;
  let events = store._map.get(tenant);
  if (!events) {
    events = [];
    store._map.set(tenant, events);
  }
  events.push({ ...event });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ListAuditOptions {
  tenant: string;
  principalId?: string;
  limit?: number;
}

/** List audit events for a tenant, optionally filtered by principalId.
 *  Returns frozen shallow copies — mutating a returned event cannot
 *  affect the store. Events are returned in append order; when limit is
 *  set, the most recent `limit` events are returned. */
export function listAudit(
  store: AuditStore,
  options: ListAuditOptions,
): readonly FrozenEvent[] {
  const events = store._map.get(options.tenant);
  if (!events || events.length === 0) return [];

  let filtered = options.principalId
    ? events.filter((e) => e.principalId === options.principalId)
    : events;

  if (options.limit !== undefined && options.limit < filtered.length) {
    filtered = filtered.slice(filtered.length - options.limit);
  }

  return filtered.map((e) => Object.freeze({ ...e }));
}

// ---------------------------------------------------------------------------
// Story-beat mapping
// ---------------------------------------------------------------------------

/**
 * Map an audit event to a story-feed-compatible beat shape.
 *
 * Denied events include the reason (if provided) in the detail string;
 * allowed events include the target. The title always contains the action
 * and decision.
 */
export function auditToStoryBeat(event: AuditEvent): AuditStoryBeat {
  const actionId = event.action.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const title = `${event.action} — ${event.decision}`;
  let detail: string;
  if (event.decision === 'denied') {
    detail = event.reason
      ? `Denied ${event.action} on ${event.target}: ${event.reason}`
      : `Denied ${event.action} on ${event.target}`;
  } else {
    detail = `${event.principalId} → ${event.target}`;
  }

  return {
    id: `audit-${actionId}-${event.decision}`,
    kind: 'audit',
    title,
    detail,
    at: event.at,
  };
}
