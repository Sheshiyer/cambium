// cambium-quests · operating fabric canopy scene (Task 8 additive bundle).
// Derives the canopy ONLY from MissionFabricProjectionV1: work nodes partition
// into Saplings and Programs with type-specific lifecycle language, aggregate
// counts map deterministically from canonical source fields and typed gaps,
// and cards reuse the Task 7 pure visual grammar (escaping, redaction, bounds
// preserved). Selecting a work object is local focus only — no lifecycle
// mutation, no write, no extra authority decision.
//
// Documented view-model mapping (conservative; never overclaims):
//   total   = work nodes whose canonical kind is sapling or program
//   active  = sapling active is exactly value.status === 'active'
//             (currentState is never a second authority), or program
//             lifecycle is 'executing' | 'verifying'. The compiler may map
//             ready/approved SOURCE lifecycles into canonical status
//             'active' (WORK_ACTIVE_STATES); the canopy trusts that
//             canonical projection truth and never re-reads source.
//   blocked = status === 'blocked' exactly, for BOTH saplings and programs;
//             ProgramWork.lifecycle has no blocked member
//   stale   = work nodes whose workId is the subjectId of a typed 'stale'
//             gap only (stale-fence gaps name runs, not work objects)
// Cards are stable-sorted by workId and bounded at 24 per section; overflow
// renders as an explicit typed truncated state, never silent drops and never
// a relabelled stale/error component. workId and currentGate are bounded and
// secret-filtered through the same defensive policy as every other field.
import {
  renderFabricState,
  renderWorkCard,
  type FabricWorkNode,
  type Freshness,
} from './components.ts';
import type { MissionFabricProjectionV1 } from '../../mission-fabric.ts';
import {
  normalizePortfolioPayload,
  renderPortfolioCanopy,
  type PortfolioPayloadInput,
} from './portfolio.ts';

export const CANOPY_CARD_LIMIT = 24;

const CANOPY_ACTIVE_PROGRAM_LIFECYCLES = new Set(['executing', 'verifying']);
const SECRET_MARKER = /query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;

function canopyWorkNodes(projection: MissionFabricProjectionV1): FabricWorkNode[] {
  const nodes = Array.isArray(projection?.nodes) ? projection.nodes : [];
  return nodes.filter(
    (node): node is FabricWorkNode =>
      node?.kind === 'work' &&
      typeof node.value === 'object' &&
      node.value !== null &&
      (node.value.kind === 'sapling' || node.value.kind === 'program'),
  );
}

function isActiveWork(node: FabricWorkNode): boolean {
  const value = node.value;
  if (value.kind === 'program') {
    return CANOPY_ACTIVE_PROGRAM_LIFECYCLES.has(String(value.lifecycle ?? ''));
  }
  // Sapling active is exactly the canonical work status — currentState is
  // never consulted. Per SaplingWork, status is the only canonical signal.
  return value.status === 'active';
}

function isBlockedWork(node: FabricWorkNode): boolean {
  // Blocked is exactly status === 'blocked' for BOTH saplings and programs:
  // ProgramWork.lifecycle has no blocked member, so lifecycle is never read.
  return node.value.status === 'blocked';
}

function sortedSection(nodes: FabricWorkNode[]): FabricWorkNode[] {
  return [...nodes].sort((a, b) => {
    const left = String(a.value.workId ?? '');
    const right = String(b.value.workId ?? '');
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function renderSummary(works: FabricWorkNode[], gaps: MissionFabricProjectionV1['gaps']): string {
  const staleSubjects = new Set(
    (Array.isArray(gaps) ? gaps : [])
      .filter((gap) => gap?.kind === 'stale')
      .map((gap) => gap.subjectId)
      .filter((id): id is string => typeof id === 'string'),
  );
  const total = works.length;
  const active = works.filter(isActiveWork).length;
  const blocked = works.filter(isBlockedWork).length;
  const stale = works.filter((node) => staleSubjects.has(String(node.value.workId ?? ''))).length;
  const chip = (aggregate: string, value: number) =>
    `<span class="of-chip" data-aggregate="${aggregate}">${value}</span>`;
  return (
    `<div class="of-chip-row" data-component="FabricCanopySummary" aria-label="canopy aggregate counts">` +
    `<span class="of-chip">total ${chip('total', total)}</span>` +
    `<span class="of-chip">active ${chip('active', active)}</span>` +
    `<span class="of-chip">blocked ${chip('blocked', blocked)}</span>` +
    `<span class="of-chip">stale ${chip('stale', stale)}</span>` +
    `</div>`
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function boundedSafeId(value: unknown, fallback: string, max = 64): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0 || SECRET_MARKER.test(text)) return fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function renderTruncatedState(hiddenCount: number): string {
  const detail = `${hiddenCount} ${hiddenCount === 1 ? 'entry' : 'entries'} truncated at the canopy bound`;
  return (
    `<div class="of-state of-state-truncated" data-component="FabricState" data-state="truncated" ` +
    `role="status" aria-label="truncated: ${escapeAttr(detail)}">` +
    `<strong class="of-state-title">truncated</strong>` +
    `<p class="of-state-detail">${escapeAttr(detail)}</p>` +
    `</div>`
  );
}

function renderSection(
  section: 'saplings' | 'programs',
  heading: string,
  nodes: FabricWorkNode[],
  freshness: Freshness,
  graphVersion: number,
): string {
  const sorted = sortedSection(nodes);
  const visible = sorted.slice(0, CANOPY_CARD_LIMIT);
  const cards = visible
    .map((node) => {
      const card = renderWorkCard(node, { freshness, graphVersion });
      const workId = boundedSafeId(node.value.workId, 'redacted');
      const gate =
        node.value.kind === 'sapling'
          ? `<p class="of-card-note">current gate ${escapeAttr(boundedSafeId(node.value.currentGate, 'unknown gate'))}</p>`
          : '';
      const readOnlyCue = '<p class="of-card-note">read-only · selection changes local focus only</p>';
      const openControl =
        `<button type="button" class="of-tab of-control of-card-open" data-of-open-work="${escapeAttr(workId)}">open lineage</button>`;
      return card
        .replace(
          '<article class="of-card" data-component="FabricWorkCard"',
          `<article class="of-card" data-component="FabricWorkCard" data-work-id="${escapeAttr(workId)}"`,
        )
        .replace(
          /<p class="of-card-note">[^<]*<\/p>/,
          `${gate}${readOnlyCue}${openControl}`,
        );
    })
    .join('');
  const truncatedNote =
    sorted.length > visible.length ? renderTruncatedState(sorted.length - visible.length) : '';
  const empty =
    sorted.length === 0
      ? renderFabricState('empty').replace('no rows in this view', `no ${section} in this fabric`)
      : '';
  return (
    `<section class="of-canopy-list" data-of-canopy-list="${section}" aria-label="${heading}">` +
    `<h3 class="of-canopy-heading">${heading}</h3>` +
    (sorted.length === 0 ? empty : `<div class="of-card-grid">${cards}</div>${truncatedNote}`) +
    `</section>`
  );
}

export interface CanopyOptions extends PortfolioPayloadInput {
  freshness?: Freshness | null;
  error?: boolean;
  selectedPortfolioId?: string | null;
}

export function renderCanopy(
  projection: MissionFabricProjectionV1,
  options: CanopyOptions = {},
): string {
  if (options.error === true || projection === null || typeof projection !== 'object' || !Array.isArray(projection.nodes)) {
    return renderFabricState('error');
  }
  const portfolio = normalizePortfolioPayload(options);
  if (portfolio.mode !== 'none') {
    return renderPortfolioCanopy(
      projection,
      portfolio,
      typeof options.selectedPortfolioId === 'string' ? options.selectedPortfolioId : null,
    );
  }
  const freshness: Freshness =
    options.freshness && typeof options.freshness === 'object'
      ? options.freshness
      : { state: 'unknown' };
  const graphVersion = Number.isSafeInteger(projection.graphVersion) ? projection.graphVersion : Number.NaN;
  const works = canopyWorkNodes(projection);
  const saplings = works.filter((node) => node.value.kind === 'sapling');
  const programs = works.filter((node) => node.value.kind === 'program');
  const body =
    works.length === 0
      ? renderFabricState('empty')
      : renderSummary(works, projection.gaps) +
        renderSection('saplings', 'Saplings', saplings, freshness, graphVersion) +
        renderSection('programs', 'Programs', programs, freshness, graphVersion);
  return `<div class="of-canopy" data-component="FabricCanopy">${body}</div>`;
}

// ── browser renderer source ────────────────────────────────────────────────
// CANOPY_BROWSER_JS is the browser-side canopy renderer, expressed as plain
// browser-valid JavaScript source (no TypeScript syntax, no imports, no
// node builtins). It mirrors the derivation rules documented above and is
// composed lexically into the operating-fabric boot script by client.ts.
// Parity with the node renderer is enforced by tests against shared
// fixtures and hostile inputs — never by textual identity.
// The browser fail-closed signature policy lives in the shared helpers block
// in client.ts as a legible normalized grammar — query_id/auth_date/token
// unanchored, hash word-bounded via (?:^|\W) — that is boolean-equivalent to
// the verbatim canonical SECRET_MARKER above (proven by a generated
// adversarial matrix with zero divergences); the Node substrate below keeps
// the canonical Task 7 regex verbatim.
export const CANOPY_BROWSER_JS = String.raw`
function ofRenderTruncatedState(hiddenCount) {
  var detail = hiddenCount + ' ' + (hiddenCount === 1 ? 'entry' : 'entries') + ' truncated at the canopy bound';
  return '<div class="of-state of-state-truncated" data-component="FabricState" data-state="truncated" role="status" aria-label="truncated: ' + ofEsc(detail) + '">' +
    '<strong class="of-state-title">truncated</strong>' +
    '<p class="of-state-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}

function ofRenderSummary(works, gaps) {
  var staleSubjects = {};
  for (var gi = 0; gi < gaps.length; gi += 1) {
    var gap = gaps[gi];
    if (gap && gap.kind === 'stale' && typeof gap.subjectId === 'string') staleSubjects[gap.subjectId] = true;
  }
  var active = 0;
  var blocked = 0;
  var stale = 0;
  for (var wi = 0; wi < works.length; wi += 1) {
    var value = works[wi].value;
    if (value.kind === 'program' ? (value.lifecycle === 'executing' || value.lifecycle === 'verifying') : value.status === 'active') active += 1;
    if (value.status === 'blocked') blocked += 1;
    if (staleSubjects[String(value.workId || '')]) stale += 1;
  }
  function chip(aggregate, count) {
    return '<span class="of-chip" data-aggregate="' + aggregate + '">' + count + '</span>';
  }
  return '<div class="of-chip-row" data-component="FabricCanopySummary" aria-label="canopy aggregate counts">' +
    '<span class="of-chip">total ' + chip('total', works.length) + '</span>' +
    '<span class="of-chip">active ' + chip('active', active) + '</span>' +
    '<span class="of-chip">blocked ' + chip('blocked', blocked) + '</span>' +
    '<span class="of-chip">stale ' + chip('stale', stale) + '</span>' +
    '</div>';
}

function ofRenderCanopySection(section, heading, nodes) {
  var sorted = nodes.slice().sort(function (a, b) {
    var left = String(a.value.workId || '');
    var right = String(b.value.workId || '');
    return left < right ? -1 : left > right ? 1 : 0;
  });
  var visible = sorted.slice(0, OF_LINEAGE_LIMIT);
  var cards = '';
  for (var index = 0; index < visible.length; index += 1) {
    var node = visible[index];
    var workId = ofSafeId(node.value.workId, 'redacted');
    var lifecycle = valueLifecycle(node.value);
    var promotion = node.value.kind === 'sapling'
      ? '<div class="of-fact"><dt>promotion</dt><dd>' + ofEsc(ofSafeText(node.value.promotionState, 'unknown promotion')) + '</dd></div>'
      : '';
    var gate = node.value.kind === 'sapling'
      ? '<p class="of-card-note">current gate ' + ofEsc(ofSafeId(node.value.currentGate, 'unknown gate')) + '</p>'
      : '';
    cards += '<article class="of-card" data-component="FabricWorkCard" data-work-kind="' + ofEsc(node.value.kind) + '" data-work-id="' + ofEsc(workId) + '">' +
      '<header class="of-card-head"><h3 class="of-card-title">' + ofEsc(ofSafeText(node.value.name, 'unnamed work')) + '</h3></header>' +
      '<div class="of-card-body"><dl class="of-card-facts">' +
      '<div class="of-fact"><dt>type</dt><dd>' + ofEsc(node.value.kind) + '</dd></div>' +
      '<div class="of-fact"><dt>lifecycle</dt><dd>' + ofEsc(lifecycle) + '</dd></div>' +
      promotion +
      '</dl>' +
      gate +
      '<p class="of-card-note">read-only · selection changes local focus only</p>' +
      '<button type="button" class="of-tab of-control of-card-open" data-of-open-work="' + ofEsc(workId) + '">open lineage</button>' +
      '</div></article>';
  }
  var truncated = sorted.length > visible.length ? ofRenderTruncatedState(sorted.length - visible.length) : '';
  var empty = sorted.length === 0
    ? ofRenderState('empty', 'empty', 'no ' + section + ' in this fabric')
    : '';
  return '<section class="of-canopy-list" data-of-canopy-list="' + section + '" aria-label="' + heading + '">' +
    '<h3 class="of-canopy-heading">' + heading + '</h3>' +
    (sorted.length === 0 ? empty : '<div class="of-card-grid">' + cards + '</div>' + truncated) +
    '</section>';
}

function ofRenderCanopy(projection, options) {
  if (!ofValidProjection(projection)) return ofRenderState('error', 'error', 'failed to load the operating fabric');
  var portfolio = ofNormalizePortfolioPayload(options || {});
  if (portfolio.mode !== 'none') {
    return ofRenderPortfolioCanopy(
      projection,
      portfolio,
      options && typeof options.selectedPortfolioId === 'string' ? options.selectedPortfolioId : null
    );
  }
  var works = [];
  for (var index = 0; index < projection.nodes.length; index += 1) {
    var node = projection.nodes[index];
    if (node && node.kind === 'work' && node.value && (node.value.kind === 'sapling' || node.value.kind === 'program')) {
      works.push(node);
    }
  }
  var body;
  if (works.length === 0) {
    body = ofRenderState('empty', 'empty', 'no rows in this view');
  } else {
    var saplings = works.filter(function (node) { return node.value.kind === 'sapling'; });
    var programs = works.filter(function (node) { return node.value.kind === 'program'; });
    var gaps = Array.isArray(projection.gaps) ? projection.gaps : [];
    body = ofRenderSummary(works, gaps) +
      ofRenderCanopySection('saplings', 'Saplings', saplings) +
      ofRenderCanopySection('programs', 'Programs', programs);
  }
  return '<div class="of-canopy" data-component="FabricCanopy">' + body + '</div>';
}
`;
