// cambium-quests · operating fabric visual grammar (Task 7 additive bundle).
// Pure string renderers for the shared operating-fabric components: authority
// badges, freshness badges, work/agent/skill-cluster cards, typed gaps, edges,
// and distinct loading/empty/stale/unauthorized/error states.
// All renderers are read-only, escape every projection-derived string, never
// expose raw evidence/prompts/tokens/Telegram auth/private payloads, and reuse
// the shared design tokens (no parallel design system).
// Node view-model types alias the canonical mission-fabric contracts in
// ../../mission-fabric.ts — no parallel authority contract lives here.

import type {
  FabricEdge as CanonicalFabricEdge,
  FabricGap as CanonicalFabricGap,
  FabricNode as CanonicalFabricNode,
  FabricWorkNode as CanonicalFabricWorkNode,
} from '../../mission-fabric.ts';

type Escapable = string | number | boolean | null | undefined;

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: Escapable): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

function bounded(value: Escapable, max = 120): string {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

// ── shared view-model types (bounded, fail-closed) ─────────────────────────
// Node types alias the canonical mission-fabric contracts; nothing here
// redeclares work/agent/skill-cluster/gap/edge shapes as a second authority.

export type FabricWorkNode = CanonicalFabricWorkNode;
export type FabricAgentNode = Extract<CanonicalFabricNode, { kind: 'agent' }>;
export type FabricSkillClusterNode = Extract<CanonicalFabricNode, { kind: 'skill-cluster' }>;
export type FabricGap = CanonicalFabricGap;
export type FabricEdge = CanonicalFabricEdge;

export interface AuthorityRef {
  sourceRef: string;
  graphVersion: number;
}

export interface Freshness {
  state: 'fresh' | 'stale' | 'unknown';
  checkedAt?: string | null;
}

// Raw credential/auth markers and precise prompt-content/injection signatures
// that must never render, even when the projection itself is hostile.
// Renderers fail closed to a neutral label. Prompt markers match only raw
// prompt content (`prompt: …`, `prompt = …`) and explicit `prompt injection`
// phrasing — never the bare word, so legitimate labels such as
// `Prompt Engineering` or `promptly verify` render faithfully. This is
// signature-based defensive output safety, not semantic prompt-injection
// detection.
const SECRET_MARKER_PATTERN =
  /query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;

// Raw bounded fail-closed policy for free-text fields: returns the raw text
// unescaped, or the neutral fallback when empty/marker-bearing. Callers apply
// exactly one esc() pass at the point of emission so visible text, data
// attributes, and aria-labels are always single-escaped.
function rawTextOrFallback(value: Escapable, fallback: string): string {
  const text = bounded(value).trim();
  if (text.length === 0 || SECRET_MARKER_PATTERN.test(text)) return fallback;
  return text;
}

function failsClosedOnSecrets(value: Escapable, fallback: string): string {
  const raw = rawTextOrFallback(value, fallback);
  return raw === fallback ? fallback : esc(raw);
}

// Canonical runtime discriminants mirrored from ../../mission-fabric.ts.
// Hostile or noncanonical values never reach visible text or data attributes.
const WORK_KINDS = new Set(['sapling', 'program']);
const WORK_STATUSES = new Set(['draft', 'ready', 'active', 'blocked', 'paused', 'complete', 'retired']);
const PROGRAM_LIFECYCLES = new Set(['proposed', 'approved', 'executing', 'verifying', 'complete', 'retired']);
const SAPLING_PROMOTION_STATES = new Set(['proof-only', 'supervised-branch', 'autonomous-branch']);
const AGENT_STATUSES = new Set(['offline', 'available', 'assigned', 'running', 'blocked']);
const CLUSTER_STATUSES = new Set(['inactive', 'available', 'active', 'degraded']);
const EDGE_KINDS = new Set([
  'contains',
  'depends-on',
  'assigned-to',
  'requires-cluster',
  'pins-loadout',
  'executes',
  'produces',
  'proves',
  'informs-next-intent',
]);

function allowlisted(value: Escapable, allowed: ReadonlySet<string>): string {
  const text = String(value ?? '').trim();
  return allowed.has(text) ? text : 'unknown';
}

// ── authority badge ─────────────────────────────────────────────────────────

export function renderAuthorityBadge(authority: AuthorityRef): string {
  const sourceRefRaw = rawTextOrFallback(authority?.sourceRef, 'unknown authority');
  const sourceRef = esc(sourceRefRaw);
  const rawVersion = authority?.graphVersion;
  const version = Number.isSafeInteger(rawVersion) && (rawVersion as number) >= 0 ? (rawVersion as number) : null;
  const versionLabel = version !== null ? `graphVersion ${version}` : 'version unknown';
  const aria = esc(`authority: ${sourceRefRaw} · ${versionLabel}`);
  return (
    `<span class="of-badge of-badge-authority" data-component="FabricAuthorityBadge" ` +
    `data-authority="${sourceRef}" aria-label="${aria}">` +
    `<span class="of-badge-label">${sourceRef}</span>` +
    `<span class="of-badge-meta">${versionLabel}</span>` +
    `</span>`
  );
}

// ── freshness badge ─────────────────────────────────────────────────────────

export function renderFreshnessBadge(freshness: Freshness | null | undefined): string {
  const source = freshness && typeof freshness === 'object' ? freshness : null;
  const rawCheckedAt = source?.checkedAt ? String(source.checkedAt) : null;
  // Only a bounded, canonical ISO-8601 timestamp counts as freshness proof;
  // anything else downgrades the badge to unknown and emits no time element.
  const checkedAt =
    rawCheckedAt !== null &&
    rawCheckedAt.length <= 64 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/.test(rawCheckedAt) &&
    !Number.isNaN(Date.parse(rawCheckedAt))
      ? rawCheckedAt
      : null;
  const declared = source?.state === 'fresh' || source?.state === 'stale' ? source.state : 'unknown';
  const state = rawCheckedAt !== null && checkedAt === null ? 'unknown' : declared;
  const label = checkedAt ? `${state} · ${checkedAt}` : state;
  return (
    `<span class="of-badge of-badge-freshness is-${state}" data-component="FabricFreshnessBadge" ` +
    `data-state="${state}" aria-label="freshness: ${esc(label)}">` +
    `<span class="of-badge-label">${esc(state)}</span>` +
    (checkedAt ? `<time class="of-badge-meta" datetime="${esc(checkedAt)}">${esc(checkedAt)}</time>` : '') +
    `</span>`
  );
}

// ── shared card shell ───────────────────────────────────────────────────────

function cardShell(
  component: string,
  title: string,
  body: string,
  extraAttrs = '',
): string {
  return (
    `<article class="of-card" data-component="${component}"${extraAttrs}>` +
    `<header class="of-card-head"><h3 class="of-card-title">${title}</h3></header>` +
    `<div class="of-card-body">${body}</div>` +
    `</article>`
  );
}

// ── work card ───────────────────────────────────────────────────────────────

export function renderWorkCard(
  node: FabricWorkNode,
  context?: { freshness: Freshness; graphVersion: number; evidenceRef?: string | null } | null,
): string {
  const value = (node?.value ?? {}) as Record<string, unknown>;
  const name = failsClosedOnSecrets(value.name as Escapable, 'unnamed work');
  const workKind = allowlisted(value.kind as Escapable, WORK_KINDS);
  const workType = workKind === 'unknown' ? 'unknown type' : workKind;
  // ProgramWork renders its program lifecycle; SaplingWork keeps its status /
  // currentState runtime semantics. Runtime values are allowlisted against the
  // canonical discriminants; neither widens nor invents values.
  const lifecycle =
    workKind === 'program'
      ? allowlisted((value.lifecycle ?? value.status ?? value.currentState) as Escapable, PROGRAM_LIFECYCLES) === 'unknown'
        ? 'unknown state'
        : allowlisted((value.lifecycle ?? value.status ?? value.currentState) as Escapable, PROGRAM_LIFECYCLES)
      : workKind === 'sapling'
        ? (() => {
            const status = allowlisted(value.status as Escapable, WORK_STATUSES);
            if (status !== 'unknown') return status;
            const current = allowlisted(value.currentState as Escapable, new Set([...WORK_STATUSES, ...PROGRAM_LIFECYCLES]));
            return current === 'unknown' ? 'unknown state' : failsClosedOnSecrets(value.currentState as Escapable, 'unknown state');
          })()
        : 'unknown state';
  const promotion =
    workKind === 'sapling'
      ? (() => {
          const allowed = allowlisted(value.promotionState as Escapable, SAPLING_PROMOTION_STATES);
          if (allowed === 'unknown') return 'unknown promotion';
          return failsClosedOnSecrets(value.promotionState as Escapable, 'unknown promotion');
        })()
      : null;
  const sourceRef = failsClosedOnSecrets(value.sourceRef as Escapable, 'unknown authority');
  const authorityBadge = renderAuthorityBadge({
    sourceRef: typeof value.sourceRef === 'string' ? value.sourceRef : '',
    graphVersion: context && typeof context === 'object' ? context.graphVersion : Number.NaN,
  });
  const freshnessBadge = renderFreshnessBadge(context && typeof context === 'object' ? context.freshness : null);
  const body =
    `<dl class="of-card-facts">` +
    `<div class="of-fact"><dt>type</dt><dd>${workType}</dd></div>` +
    `<div class="of-fact"><dt>lifecycle</dt><dd>${lifecycle}</dd></div>` +
    (promotion !== null ? `<div class="of-fact"><dt>promotion</dt><dd>${promotion}</dd></div>` : '') +
    `<div class="of-fact"><dt>authority</dt><dd>${sourceRef}</dd></div>` +
    `</dl>` +
    `<div class="of-card-badges">${authorityBadge}${freshnessBadge}</div>` +
    `<p class="of-card-note">read-only · no lifecycle mutations</p>`;
  return cardShell('FabricWorkCard', name, body, ` data-work-kind="${esc(workKind)}"`);
}

// ── agent card ──────────────────────────────────────────────────────────────

export function renderAgentCard(
  node: FabricAgentNode,
  context?: { capabilities: readonly string[]; assignment: string | null } | null,
): string {
  const value = (node?.value ?? {}) as Record<string, unknown>;
  const name = failsClosedOnSecrets(value.agentId as Escapable, 'unknown agent');
  const role = failsClosedOnSecrets(value.role as Escapable, 'unknown role');
  const statusAllowed = allowlisted(value.status as Escapable, AGENT_STATUSES);
  const status = statusAllowed;
  const contextValue = context && typeof context === 'object' ? context : null;
  const assignment = contextValue?.assignment ? failsClosedOnSecrets(contextValue.assignment, 'unassigned') : null;
  const capabilities = Array.isArray(contextValue?.capabilities) ? contextValue.capabilities : [];
  const chips = capabilities
    .slice(0, 6)
    .map(
      (capability) =>
        `<span class="of-chip" data-component="FabricCapabilityChip">${failsClosedOnSecrets(capability, 'redacted')}</span>`,
    )
    .join('');
  const overflow =
    capabilities.length > 6
      ? `<span class="of-chip of-chip-more" data-component="FabricCapabilityOverflow">+${capabilities.length - 6} more</span>`
      : '';
  const gap =
    assignment === null
      ? '<p class="of-card-gap" data-component="FabricGap">assignment gap · no assignment</p>'
      : '';
  const body =
    `<dl class="of-card-facts">` +
    `<div class="of-fact"><dt>role</dt><dd>${role}</dd></div>` +
    `<div class="of-fact"><dt>status</dt><dd>${status}</dd></div>` +
    `<div class="of-fact"><dt>assignment</dt><dd>${assignment ?? 'no assignment'}</dd></div>` +
    `</dl>` +
    (chips ? `<div class="of-chip-row" aria-label="capabilities">${chips}${overflow}</div>` : '') +
    gap;
  return cardShell('FabricAgentCard', name, body, ` data-agent-status="${esc(statusAllowed)}"`);
}

// ── skill-cluster card ──────────────────────────────────────────────────────

export function renderSkillClusterCard(
  node: FabricSkillClusterNode,
  context?: { coverage: { eligible: number; covered: number }; freshness: Freshness } | null,
): string {
  const value = (node?.value ?? {}) as Record<string, unknown>;
  const name = failsClosedOnSecrets(value.name as Escapable, 'unknown cluster');
  const stateAllowed = allowlisted(value.status as Escapable, CLUSTER_STATUSES);
  const state = stateAllowed;
  const contextValue = context && typeof context === 'object' ? context : null;
  const { eligible, covered } = contextValue?.coverage ?? {};
  const coverageValid =
    Number.isSafeInteger(eligible) &&
    Number.isSafeInteger(covered) &&
    (eligible as number) >= 0 &&
    (covered as number) >= 0 &&
    (covered as number) <= (eligible as number);
  const coverageLabel = coverageValid ? `${covered} of ${eligible}` : 'coverage unknown';
  const freshnessBadge = renderFreshnessBadge(contextValue?.freshness ?? null);
  const provenance = failsClosedOnSecrets(value.sourceRef as Escapable, 'unknown authority');
  const body =
    `<dl class="of-card-facts">` +
    `<div class="of-fact"><dt>state</dt><dd>${state}</dd></div>` +
    `<div class="of-fact"><dt>coverage</dt><dd>${coverageLabel}</dd></div>` +
    `<div class="of-fact"><dt>provenance</dt><dd>${provenance}</dd></div>` +
    `</dl>` +
    `<div class="of-card-badges">${freshnessBadge}</div>`;
  return cardShell('FabricSkillClusterCard', name, body, ` data-cluster-status="${esc(stateAllowed)}"`);
}

// ── typed gap ───────────────────────────────────────────────────────────────

export function renderGapState(gap: FabricGap): string {
  const kindRaw = rawTextOrFallback(gap?.kind, 'unknown gap');
  const subjectRaw = gap?.subjectId ? rawTextOrFallback(gap.subjectId, 'unknown subject') : 'unscoped';
  const detail = failsClosedOnSecrets(gap?.detail, 'no detail available');
  const kindEscaped = esc(kindRaw);
  return (
    `<div class="of-gap" data-component="FabricGap" data-gap-kind="${kindEscaped}" ` +
    `role="status" aria-label="gap: ${kindEscaped} on ${esc(subjectRaw)}">` +
    `<span class="of-gap-kind">${kindEscaped}</span>` +
    `<span class="of-gap-subject">${esc(subjectRaw)}</span>` +
    `<p class="of-gap-detail">${detail}</p>` +
    `</div>`
  );
}

// ── edge ────────────────────────────────────────────────────────────────────

export function renderFabricEdge(edge: FabricEdge): string {
  const kindAllowed = allowlisted(edge?.kind as Escapable, EDGE_KINDS);
  const kind = kindAllowed === 'unknown' ? 'unknown relation' : kindAllowed;
  const fromIdRaw = rawTextOrFallback(edge?.fromId, 'redacted');
  const toIdRaw = rawTextOrFallback(edge?.toId, 'redacted');
  return (
    `<span class="of-edge" data-component="FabricEdge" data-edge-kind="${esc(kindAllowed)}" ` +
    `aria-label="${esc(`${fromIdRaw} ${kind} ${toIdRaw}`)}">` +
    `<span class="of-edge-from">${esc(fromIdRaw)}</span>` +
    `<span class="of-edge-kind">${kind}</span>` +
    `<span class="of-edge-to">${esc(toIdRaw)}</span>` +
    `</span>`
  );
}

// ── distinct state renderer ─────────────────────────────────────────────────

export function renderFabricState(
  state: 'loading' | 'empty' | 'stale' | 'unauthorized' | 'error',
): string {
  const copy: Record<string, { title: string; detail: string }> = {
    loading: { title: 'loading', detail: 'fetching the operating fabric' },
    empty: { title: 'empty', detail: 'no rows in this view' },
    stale: { title: 'stale', detail: 'evidence is older than the freshness window' },
    unauthorized: { title: 'unauthorized', detail: 'not authorized to view this fabric' },
    error: { title: 'error', detail: 'failed to load the operating fabric' },
  };
  // Runtime-allowlist the state before it reaches class/data attributes so a
  // hostile runtime value can never break out of the bounded error fallback.
  const safeState = Object.hasOwn(copy, state) ? state : 'error';
  const entry = copy[safeState]!;
  return (
    `<div class="of-state of-state-${safeState}" data-component="FabricState" data-state="${safeState}" ` +
    `role="status" aria-label="${esc(entry.title)}: ${esc(entry.detail)}">` +
    `<strong class="of-state-title">${esc(entry.title)}</strong>` +
    `<p class="of-state-detail">${esc(entry.detail)}</p>` +
    `</div>`
  );
}
