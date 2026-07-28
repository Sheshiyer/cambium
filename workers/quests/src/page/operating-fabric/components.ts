// cambium-quests · operating fabric visual grammar (Task 7 additive bundle).
// Pure string renderers for the shared operating-fabric components: authority
// badges, freshness badges, work/agent/skill-cluster cards, typed gaps, edges,
// and distinct loading/empty/stale/unauthorized/error states.
// All renderers are read-only, escape every projection-derived string, never
// expose raw evidence/prompts/tokens/Telegram auth/private payloads, and reuse
// the shared design tokens (no parallel design system).

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

function safeLabel(value: Escapable, fallback: string): string {
  const text = bounded(value).trim();
  return text.length > 0 ? esc(text) : fallback;
}

// ── shared view-model types (bounded, fail-closed) ─────────────────────────

export interface AuthorityRef {
  sourceRef: string;
  graphVersion: number;
}

export interface Freshness {
  state: 'fresh' | 'stale' | 'unknown';
  checkedAt?: string | null;
}

export interface FabricWorkNode {
  kind: 'work';
  value: {
    kind: 'sapling' | 'program';
    workId: string;
    name: string;
    status: string;
    currentState: string;
    sourceRef: string;
    [key: string]: unknown;
  };
}

export interface FabricAgentNode {
  kind: 'agent';
  value: {
    agentId: string;
    role: string;
    status: string;
    activeTaskIds: string[];
    sourceRef: string;
    [key: string]: unknown;
  };
}

export interface FabricSkillClusterNode {
  kind: 'skill-cluster';
  value: {
    clusterId: string;
    name: string;
    status: string;
    skillIds: string[];
    eligibleAgentIds: string[];
    sourceRef: string;
    [key: string]: unknown;
  };
}

export interface FabricGap {
  gapId: string;
  kind: string;
  subjectId: string | null;
  detail: string;
  evidenceRef: string | null;
}

export interface FabricEdge {
  kind: string;
  fromId: string;
  toId: string;
}

// ── authority badge ─────────────────────────────────────────────────────────

export function renderAuthorityBadge(authority: AuthorityRef): string {
  const sourceRef = safeLabel(authority?.sourceRef, 'unknown authority');
  const version = Number.isFinite(authority?.graphVersion) ? Math.trunc(authority.graphVersion) : null;
  const versionLabel = version !== null ? `graphVersion ${version}` : 'version unknown';
  const aria = `authority: ${sourceRef} · ${versionLabel}`;
  return (
    `<span class="of-badge of-badge-authority" data-component="FabricAuthorityBadge" ` +
    `data-authority="${esc(authority?.sourceRef ?? '')}" aria-label="${aria}">` +
    `<span class="of-badge-label">${sourceRef}</span>` +
    `<span class="of-badge-meta">${versionLabel}</span>` +
    `</span>`
  );
}

// ── freshness badge ─────────────────────────────────────────────────────────

export function renderFreshnessBadge(freshness: Freshness): string {
  const state = freshness?.state === 'fresh' || freshness?.state === 'stale' ? freshness.state : 'unknown';
  const checkedAt = freshness?.checkedAt ? String(freshness.checkedAt) : null;
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
  context: { freshness: Freshness; graphVersion: number; evidenceRef?: string | null },
): string {
  const value = node?.value ?? {};
  const name = safeLabel(value.name, 'unnamed work');
  const workType = safeLabel(value.kind, 'unknown type');
  const lifecycle = safeLabel(value.status ?? value.currentState, 'unknown state');
  const sourceRef = safeLabel(value.sourceRef, 'unknown authority');
  const authorityBadge = renderAuthorityBadge({ sourceRef: value.sourceRef ?? '', graphVersion: context.graphVersion });
  const freshnessBadge = renderFreshnessBadge(context.freshness);
  const body =
    `<dl class="of-card-facts">` +
    `<div class="of-fact"><dt>type</dt><dd>${workType}</dd></div>` +
    `<div class="of-fact"><dt>lifecycle</dt><dd>${lifecycle}</dd></div>` +
    `<div class="of-fact"><dt>authority</dt><dd>${sourceRef}</dd></div>` +
    `</dl>` +
    `<div class="of-card-badges">${authorityBadge}${freshnessBadge}</div>` +
    `<p class="of-card-note">read-only · no lifecycle mutations</p>`;
  return cardShell('FabricWorkCard', name, body, ` data-work-kind="${esc(value.kind ?? '')}"`);
}

// ── agent card ──────────────────────────────────────────────────────────────

export function renderAgentCard(
  node: FabricAgentNode,
  context: { capabilities: readonly string[]; assignment: string | null },
): string {
  const value = node?.value ?? {};
  const name = safeLabel(value.agentId, 'unknown agent');
  const role = safeLabel(value.role, 'unknown role');
  const status = safeLabel(value.status, 'unknown');
  const assignment = context.assignment ? safeLabel(context.assignment, 'unassigned') : null;
  const chips = (context.capabilities ?? [])
    .slice(0, 6)
    .map(
      (capability) =>
        `<span class="of-chip" data-component="FabricCapabilityChip">${safeLabel(capability, 'unknown')}</span>`,
    )
    .join('');
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
    (chips ? `<div class="of-chip-row" aria-label="capabilities">${chips}</div>` : '') +
    gap;
  return cardShell('FabricAgentCard', name, body, ` data-agent-status="${esc(value.status ?? '')}"`);
}

// ── skill-cluster card ──────────────────────────────────────────────────────

export function renderSkillClusterCard(
  node: FabricSkillClusterNode,
  context: { coverage: { eligible: number; covered: number }; freshness: Freshness },
): string {
  const value = node?.value ?? {};
  const name = safeLabel(value.name, 'unknown cluster');
  const state = safeLabel(value.status, 'unknown');
  const eligible = Number.isFinite(context.coverage?.eligible) ? context.coverage.eligible : 0;
  const covered = Number.isFinite(context.coverage?.covered) ? context.coverage.covered : 0;
  const coverageLabel = `${covered} of ${eligible}`;
  const freshnessBadge = renderFreshnessBadge(context.freshness);
  const provenance = safeLabel(value.sourceRef, 'unknown authority');
  const body =
    `<dl class="of-card-facts">` +
    `<div class="of-fact"><dt>state</dt><dd>${state}</dd></div>` +
    `<div class="of-fact"><dt>coverage</dt><dd>${coverageLabel}</dd></div>` +
    `<div class="of-fact"><dt>provenance</dt><dd>${provenance}</dd></div>` +
    `</dl>` +
    `<div class="of-card-badges">${freshnessBadge}</div>`;
  return cardShell('FabricSkillClusterCard', name, body, ` data-cluster-status="${esc(value.status ?? '')}"`);
}

// ── typed gap ───────────────────────────────────────────────────────────────

export function renderGapState(gap: FabricGap): string {
  const kind = safeLabel(gap?.kind, 'unknown gap');
  const subject = gap?.subjectId ? safeLabel(gap.subjectId, 'unknown subject') : 'unscoped';
  const detail = safeLabel(gap?.detail, 'no detail available');
  return (
    `<div class="of-gap" data-component="FabricGap" data-gap-kind="${esc(gap?.kind ?? '')}" ` +
    `role="status" aria-label="gap: ${kind} on ${subject}">` +
    `<span class="of-gap-kind">${kind}</span>` +
    `<span class="of-gap-subject">${subject}</span>` +
    `<p class="of-gap-detail">${detail}</p>` +
    `</div>`
  );
}

// ── edge ────────────────────────────────────────────────────────────────────

export function renderFabricEdge(edge: FabricEdge): string {
  const kind = safeLabel(edge?.kind, 'unknown relation');
  const fromId = safeLabel(edge?.fromId, 'unknown');
  const toId = safeLabel(edge?.toId, 'unknown');
  const label = `${fromId} ${kind} ${toId}`;
  return (
    `<span class="of-edge" data-component="FabricEdge" data-edge-kind="${esc(edge?.kind ?? '')}" ` +
    `aria-label="${esc(label)}">` +
    `<span class="of-edge-from">${fromId}</span>` +
    `<span class="of-edge-kind">${kind}</span>` +
    `<span class="of-edge-to">${toId}</span>` +
    `</span>`
  );
}

// ── distinct state renderer ─────────────────────────────────────────────────

export function renderFabricState(
  state: 'loading' | 'empty' | 'stale' | 'unauthorized' | 'error',
): string {
  const copy: Record<typeof state, { title: string; detail: string }> = {
    loading: { title: 'loading', detail: 'fetching the operating fabric' },
    empty: { title: 'empty', detail: 'no rows in this view' },
    stale: { title: 'stale', detail: 'evidence is older than the freshness window' },
    unauthorized: { title: 'unauthorized', detail: 'not authorized to view this fabric' },
    error: { title: 'error', detail: 'failed to load the operating fabric' },
  };
  const entry = copy[state] ?? copy.error;
  return (
    `<div class="of-state of-state-${state}" data-component="FabricState" data-state="${state}" ` +
    `role="status" aria-label="${esc(entry.title)}: ${esc(entry.detail)}">` +
    `<strong class="of-state-title">${esc(entry.title)}</strong>` +
    `<p class="of-state-detail">${esc(entry.detail)}</p>` +
    `</div>`
  );
}
