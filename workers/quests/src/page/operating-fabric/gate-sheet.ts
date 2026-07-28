// cambium-quests · operating fabric gate sheet.
// Pure preflight adapter: given an exact-identity selected node and an
// explicit approve-goal-graph governed action, decides whether to open a
// governed gate preflight. Never derives an action. Never renders a Confirm
// button or triggers a confirm action. Delegates to openGatePreflight exactly
// once, and only when freshness is exactly 'fresh' and the selection/action
// are fully valid.

import type { FabricNode, MissionFabricProjectionV1 } from '../../mission-fabric.ts';

export interface GateGovernedAction {
  kind: 'approve-goal-graph';
  subject: string;
  objectId: string;
  nonce: string;
  expiresAt: string;
  expectedHeadVersion: number;
  fence: number;
}

export interface GateSheetSelection {
  selected: FabricNode | null;
  action: GateGovernedAction | null;
}

export interface GateSheetOrigin {
  sceneId: string;
  focusId: string;
}

export interface GateSheetContext {
  freshness?: string;
  origin?: GateSheetOrigin;
  openGatePreflight?: (kind: string, subject: string, node: null, seed: Record<string, unknown>) => void;
}

export interface GateSheetBinding {
  tenant: string;
  changeDigest: string;
  nonce: string;
  expiresAt: string;
  graphVersion: number;
  fence: number;
}

export interface GateSheetResult {
  opened: boolean;
  confirmDisabled: boolean;
  routeTo: 'gate' | 'inspect';
  html: string;
  binding: GateSheetBinding | null;
  origin: GateSheetOrigin;
  dismiss: (reason: string) => GateSheetOrigin;
}

const NODE_KIND_TO_ID_KEY: Record<string, string> = {
  work: 'workId',
  mission: 'missionId',
  task: 'taskId',
  agent: 'agentId',
  'skill-cluster': 'clusterId',
  run: 'runId',
  receipt: 'receiptId',
};

const SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)(?:hash)=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;

const GATE_SHEET_MAX_CHARS = 128;
const DEFAULT_ORIGIN: GateSheetOrigin = { sceneId: 'canopy', focusId: '' };

function gateEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gateSafe(value: unknown, fallback: string, max = GATE_SHEET_MAX_CHARS): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0 || SECRET_MARKER.test(text)) return fallback;
  const clipped = text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return gateEsc(clipped);
}

function canonicalNodeId(node: FabricNode): string | null {
  const key = NODE_KIND_TO_ID_KEY[node.kind];
  if (key === undefined) return null;
  const value = node.value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
  const id = value[key];
  return isBoundedSafeString(id, 128) ? id : null;
}

const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;

function isBoundedSafeString(value: unknown, max: number): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (text.length === 0 || text.length > max) return false;
  if (CONTROL_CHAR_RE.test(text)) return false;
  if (SECRET_MARKER.test(text)) return false;
  return true;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isSafeOrigin(origin: unknown): origin is GateSheetOrigin {
  if (typeof origin !== 'object' || origin === null) return false;
  const candidate = origin as Record<string, unknown>;
  if (
    !Object.prototype.hasOwnProperty.call(candidate, 'sceneId') ||
    !Object.prototype.hasOwnProperty.call(candidate, 'focusId')
  ) {
    return false;
  }
  if (!isBoundedSafeString(candidate.sceneId, 64)) return false;
  if (typeof candidate.focusId !== 'string') return false;
  if (candidate.focusId.trim().length > 0 && !isBoundedSafeString(candidate.focusId, 64)) return false;
  return true;
}

function normalizeOrigin(origin: unknown): GateSheetOrigin {
  if (!isSafeOrigin(origin)) return DEFAULT_ORIGIN;
  return { sceneId: origin.sceneId, focusId: origin.focusId };
}

function renderInspectOnlyHtml(): string {
  return (
    '<div class="arc">gate preflight</div>' +
    '<h2>Approve goal proposal</h2>' +
    '<p class="gate-preflight-line" data-component="GatePreflightConsequence">' +
    'Inspect-only — approve gate unavailable until the projection is refreshed.' +
    '</p>' +
    '<div class="gbtns">' +
    '<button type="button" class="reroll" data-of-gate-sheet-close="1">Close</button>' +
    '</div>'
  );
}

function renderFreshHtml(tenant: string, digest: string, nonce: string, expiresAt: string): string {
  return (
    '<div class="arc">gate preflight</div>' +
    '<h2>Approve goal proposal</h2>' +
    '<div class="of-gate-sheet-meta" data-component="FabricGateSheet">' +
    '<p class="of-gate-tenant">tenant: ' + gateSafe(tenant, 'unknown', 64) + '</p>' +
    '<p class="of-gate-digest">digest: ' + gateSafe(digest, 'unknown', 128) + '</p>' +
    '<p class="of-gate-nonce">nonce: ' + gateSafe(nonce, 'unknown', 64) + '</p>' +
    '<p class="of-gate-expiry">expiresAt: ' + gateSafe(expiresAt, 'unknown', 64) + '</p>' +
    '</div>' +
    '<p class="gate-preflight-line" data-component="GatePreflightConsequence">' +
    'Opening governed approval — founder approval commits this goal proposal to the goal graph for tenant ' +
    gateSafe(tenant, 'unknown', 64) + '; the goal graph commits only after this signature.' +
    '</p>' +
    '<div class="gbtns">' +
    '<button type="button" class="reroll" data-of-gate-sheet-close="1">Close</button>' +
    '</div>'
  );
}

export function renderGateSheetPreflight(
  projection: MissionFabricProjectionV1,
  selection: GateSheetSelection,
  context: GateSheetContext = {},
): GateSheetResult {
  const origin = normalizeOrigin(context.origin);
  const dismiss = (_reason: string): GateSheetOrigin => origin;

  const failResult = (): GateSheetResult => ({
    opened: false,
    confirmDisabled: true,
    routeTo: 'inspect',
    html: renderInspectOnlyHtml(),
    binding: null,
    origin,
    dismiss,
  });

  const { selected, action } = selection;
  if (selected === null || action === null) return failResult();
  if (projection.nodes.indexOf(selected) === -1) return failResult();

  const canonicalId = canonicalNodeId(selected);
  if (canonicalId === null) return failResult();

  if (!isBoundedSafeString(projection.tenantId, 64)) return failResult();

  if (
    action.kind !== 'approve-goal-graph' ||
    action.subject !== canonicalId ||
    !isBoundedSafeString(action.objectId, 128) ||
    !isBoundedSafeString(action.nonce, 128) ||
    !isBoundedSafeString(action.expiresAt, 128) ||
    !isFiniteNonNegativeInteger(action.expectedHeadVersion) ||
    !isFiniteNonNegativeInteger(action.fence)
  ) {
    return failResult();
  }

  if (context.freshness !== 'fresh' || typeof context.openGatePreflight !== 'function') {
    return failResult();
  }

  const binding: GateSheetBinding = {
    tenant: projection.tenantId,
    changeDigest: action.objectId,
    nonce: action.nonce,
    expiresAt: action.expiresAt,
    graphVersion: action.expectedHeadVersion,
    fence: action.fence,
  };

  const seed: Record<string, unknown> = {
    tenant: binding.tenant,
    changeDigest: binding.changeDigest,
    nonce: binding.nonce,
    expiresAt: binding.expiresAt,
    graphVersion: binding.graphVersion,
    fence: binding.fence,
    consequence:
      'opening governed approval — founder approval commits the goal proposal to the goal graph for tenant ' +
      binding.tenant + '; the goal graph commits only after this signature',
    idempotencyKey: 'approve-goal-graph:' + binding.tenant + ':' + binding.changeDigest,
  };

  context.openGatePreflight('approve-goal-graph', action.subject, null, seed);

  return {
    opened: true,
    confirmDisabled: true,
    routeTo: 'gate',
    html: renderFreshHtml(binding.tenant, binding.changeDigest, binding.nonce, binding.expiresAt),
    binding,
    origin,
    dismiss,
  };
}

// ── Generic reachable Gate entrypoint (Task 11) ─────────────────────────────
// renderGateEntrypoint takes an exact served pending cambium.goal-graph-intake.v1
// row (never a synthesized/projection-derived proposal) and either opens the
// governed preflight exactly once, or renders an honest disabled state: no
// pending item, or a missing/expired/malformed fence. Never invents a nonce,
// digest, or fence value — every field is validated against the exact served
// shape before openGatePreflight is called.

export interface GatePendingItem {
  changeDigest: string;
  tenant: string;
  nonce: string;
  expiresAt: string;
  expectedHeadVersion: number;
  fence: number;
  evidence: string;
  consequence: string;
  reversibility: string;
  title?: string;
}

export interface GateEntrypointContext {
  openGatePreflight?: (kind: string, subject: string, node: null, seed: Record<string, unknown>) => void;
  now?: () => number;
}

export interface GateEntrypointResult {
  opened: boolean;
  disabled: boolean;
  reason: 'opened' | 'no-pending' | 'invalid' | 'expired';
  html: string;
}

function renderGateEntrypointDisabledHtml(reason: 'no-pending' | 'invalid' | 'expired'): string {
  const message =
    reason === 'no-pending'
      ? 'No pending goal proposal is waiting for founder approval.'
      : reason === 'expired'
        ? 'This goal proposal approval window has expired or is missing its fence — refresh to fetch a current one.'
        : 'This goal proposal is missing a valid approval fence and cannot be opened.';
  return (
    '<button type="button" class="of-control of-gate-entrypoint-btn" disabled aria-disabled="true" ' +
    'data-of-gate-entrypoint="1" data-of-gate-entrypoint-state="' + gateEsc(reason) + '" aria-label="' + gateEsc(message) + '">' +
    'Gate' +
    '</button>'
  );
}

function renderGateEntrypointEnabledHtml(): string {
  return (
    '<button type="button" class="of-control of-gate-entrypoint-btn" ' +
    'data-of-gate-entrypoint="1" data-of-gate-entrypoint-state="ready" aria-label="Open governed approval for the pending goal proposal">' +
    'Gate' +
    '</button>'
  );
}

export function isValidGatePendingItem(pending: unknown): pending is GatePendingItem {
  if (typeof pending !== 'object' || pending === null) return false;
  const item = pending as Record<string, unknown>;
  return (
    isBoundedSafeString(item.changeDigest, 128) &&
    isBoundedSafeString(item.tenant, 64) &&
    isBoundedSafeString(item.nonce, 128) &&
    isBoundedSafeString(item.expiresAt, 128) &&
    isFiniteNonNegativeInteger(item.expectedHeadVersion) &&
    isFiniteNonNegativeInteger(item.fence)
  );
}

export function renderGateEntrypoint(
  pending: GatePendingItem | null,
  context: GateEntrypointContext = {},
): GateEntrypointResult {
  if (pending === null) {
    return { opened: false, disabled: true, reason: 'no-pending', html: renderGateEntrypointDisabledHtml('no-pending') };
  }
  if (!isValidGatePendingItem(pending)) {
    return { opened: false, disabled: true, reason: 'invalid', html: renderGateEntrypointDisabledHtml('invalid') };
  }
  const now = typeof context.now === 'function' ? context.now() : Date.now();
  const expiresAtMs = Date.parse(pending.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    return { opened: false, disabled: true, reason: 'expired', html: renderGateEntrypointDisabledHtml('expired') };
  }
  if (typeof context.openGatePreflight !== 'function') {
    return { opened: false, disabled: true, reason: 'invalid', html: renderGateEntrypointDisabledHtml('invalid') };
  }

  const seed: Record<string, unknown> = {
    tenant: pending.tenant,
    changeDigest: pending.changeDigest,
    nonce: pending.nonce,
    expiresAt: pending.expiresAt,
    graphVersion: pending.expectedHeadVersion,
    fence: pending.fence,
    evidence: gateSafe(pending.evidence, 'goal proposal evidence missing', 120),
    consequence: gateSafe(
      pending.consequence,
      'founder signature commits this goal proposal to the goal graph; no graph write happens before approval',
      160,
    ),
    reversibility: gateSafe(
      pending.reversibility,
      'reversible until signed: an unsigned proposal never mutates the goal graph',
      120,
    ),
    idempotencyKey: 'approve-goal-graph:' + pending.tenant + ':' + pending.changeDigest,
    item: {
      id: 'goal-graph-intake:' + pending.changeDigest,
      title: gateSafe(pending.title, 'Telegram goal proposal', 120),
      nonce: pending.nonce,
      expiresAt: pending.expiresAt,
      expectedHeadVersion: pending.expectedHeadVersion,
      fence: pending.fence,
    },
  };

  context.openGatePreflight('approve-goal-graph', pending.changeDigest, null, seed);

  return { opened: true, disabled: false, reason: 'opened', html: renderGateEntrypointEnabledHtml() };
}

// GATE_ENTRYPOINT_BROWSER_JS: ES5-compatible parity of renderGateEntrypoint,
// isValidGatePendingItem for composing into the boot IIFE. Pure: no DOM
// mutation beyond the returned HTML, no fetch/storage/eval/new Function.
export const GATE_ENTRYPOINT_BROWSER_JS = String.raw`
function ofGateEntrypointDisabledHtml(reason) {
  var message = reason === 'no-pending'
    ? 'No pending goal proposal is waiting for founder approval.'
    : reason === 'expired'
      ? 'This goal proposal approval window has expired or is missing its fence — refresh to fetch a current one.'
      : 'This goal proposal is missing a valid approval fence and cannot be opened.';
  return '<button type="button" class="of-control of-gate-entrypoint-btn" disabled aria-disabled="true" ' +
    'data-of-gate-entrypoint="1" data-of-gate-entrypoint-state="' + ofGateEsc(reason) + '" aria-label="' + ofGateEsc(message) + '">' +
    'Gate' +
    '</button>';
}
function ofGateEntrypointEnabledHtml() {
  return '<button type="button" class="of-control of-gate-entrypoint-btn" ' +
    'data-of-gate-entrypoint="1" data-of-gate-entrypoint-state="ready" aria-label="Open governed approval for the pending goal proposal">' +
    'Gate' +
    '</button>';
}
function ofIsValidGatePendingItem(pending) {
  if (typeof pending !== 'object' || pending === null) return false;
  return (
    ofGateIsBoundedSafeString(pending.changeDigest, 128) &&
    ofGateIsBoundedSafeString(pending.tenant, 64) &&
    ofGateIsBoundedSafeString(pending.nonce, 128) &&
    ofGateIsBoundedSafeString(pending.expiresAt, 128) &&
    ofGateFiniteNonNegativeInteger(pending.expectedHeadVersion) &&
    ofGateFiniteNonNegativeInteger(pending.fence)
  );
}
function ofRenderGateEntrypoint(pending, context) {
  var ctx = context || {};
  if (pending === null || pending === undefined) {
    return { opened: false, disabled: true, reason: 'no-pending', html: ofGateEntrypointDisabledHtml('no-pending') };
  }
  if (!ofIsValidGatePendingItem(pending)) {
    return { opened: false, disabled: true, reason: 'invalid', html: ofGateEntrypointDisabledHtml('invalid') };
  }
  var now = typeof ctx.now === 'function' ? ctx.now() : Date.now();
  var expiresAtMs = Date.parse(pending.expiresAt);
  if (!isFinite(expiresAtMs) || expiresAtMs <= now) {
    return { opened: false, disabled: true, reason: 'expired', html: ofGateEntrypointDisabledHtml('expired') };
  }
  if (typeof ctx.openGatePreflight !== 'function') {
    return { opened: false, disabled: true, reason: 'invalid', html: ofGateEntrypointDisabledHtml('invalid') };
  }
  var seed = {
    tenant: pending.tenant,
    changeDigest: pending.changeDigest,
    nonce: pending.nonce,
    expiresAt: pending.expiresAt,
    graphVersion: pending.expectedHeadVersion,
    fence: pending.fence,
    evidence: ofGateSafe(pending.evidence, 'goal proposal evidence missing', 120),
    consequence: ofGateSafe(
      pending.consequence,
      'founder signature commits this goal proposal to the goal graph; no graph write happens before approval',
      160
    ),
    reversibility: ofGateSafe(
      pending.reversibility,
      'reversible until signed: an unsigned proposal never mutates the goal graph',
      120
    ),
    idempotencyKey: 'approve-goal-graph:' + pending.tenant + ':' + pending.changeDigest,
    item: {
      id: 'goal-graph-intake:' + pending.changeDigest,
      title: ofGateSafe(pending.title, 'Telegram goal proposal', 120),
      nonce: pending.nonce,
      expiresAt: pending.expiresAt,
      expectedHeadVersion: pending.expectedHeadVersion,
      fence: pending.fence
    }
  };
  ctx.openGatePreflight('approve-goal-graph', pending.changeDigest, null, seed);
  return { opened: true, disabled: false, reason: 'opened', html: ofGateEntrypointEnabledHtml() };
}
`;

// GATE_SHEET_BROWSER_JS: ES5-compatible parity of renderGateSheetPreflight for
// composing into the boot IIFE. Pure: no DOM, listeners, window/global
// assignment, fetch, storage, eval, or new Function. openGatePreflight is
// invoked only via the context argument passed in by the caller.
export const GATE_SHEET_BROWSER_JS = String.raw`
var OF_GATE_KIND_TO_ID_KEY = {
  work: 'workId',
  mission: 'missionId',
  task: 'taskId',
  agent: 'agentId',
  'skill-cluster': 'clusterId',
  run: 'runId',
  receipt: 'receiptId'
};
var OF_GATE_SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)(?:hash)=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;
var OF_GATE_MAX_CHARS = 128;
var OF_GATE_DEFAULT_ORIGIN = { sceneId: 'canopy', focusId: '' };

function ofGateEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ofGateSafe(value, fallback, max) {
  var m = typeof max === 'number' ? max : OF_GATE_MAX_CHARS;
  var text = typeof value === 'string' ? value.replace(/^\s+|\s+$/g, '') : '';
  if (text.length === 0 || OF_GATE_SECRET_MARKER.test(text)) return fallback;
  var clipped = text.length > m ? text.slice(0, m - 1) + '…' : text;
  return ofGateEsc(clipped);
}

function ofGateHasControlChar(text) {
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function ofGateIsBoundedSafeString(value, max) {
  if (typeof value !== 'string') return false;
  var text = value.replace(/^\s+|\s+$/g, '');
  if (text.length === 0 || text.length > max) return false;
  if (ofGateHasControlChar(text)) return false;
  if (OF_GATE_SECRET_MARKER.test(text)) return false;
  return true;
}

function ofGateCanonicalNodeId(node) {
  var key = OF_GATE_KIND_TO_ID_KEY[node && node.kind];
  if (key === undefined) return null;
  var value = (node && node.value) || {};
  if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
  var id = value[key];
  return ofGateIsBoundedSafeString(id, 128) ? id : null;
}

function ofGateFiniteNonNegativeInteger(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 0;
}

function ofGateIsSafeOrigin(origin) {
  if (typeof origin !== 'object' || origin === null) return false;
  if (
    !Object.prototype.hasOwnProperty.call(origin, 'sceneId') ||
    !Object.prototype.hasOwnProperty.call(origin, 'focusId')
  ) {
    return false;
  }
  if (!ofGateIsBoundedSafeString(origin.sceneId, 64)) return false;
  if (typeof origin.focusId !== 'string') return false;
  if (origin.focusId.replace(/^\s+|\s+$/g, '').length > 0 && !ofGateIsBoundedSafeString(origin.focusId, 64)) return false;
  return true;
}

function ofGateNormalizeOrigin(origin) {
  if (!ofGateIsSafeOrigin(origin)) return OF_GATE_DEFAULT_ORIGIN;
  return { sceneId: origin.sceneId, focusId: origin.focusId };
}

function ofGateRenderInspectOnlyHtml() {
  return (
    '<div class="arc">gate preflight</div>' +
    '<h2>Approve goal proposal</h2>' +
    '<p class="gate-preflight-line" data-component="GatePreflightConsequence">' +
    'Inspect-only — approve gate unavailable until the projection is refreshed.' +
    '</p>' +
    '<div class="gbtns">' +
    '<button type="button" class="reroll" data-of-gate-sheet-close="1">Close</button>' +
    '</div>'
  );
}

function ofGateRenderFreshHtml(tenant, digest, nonce, expiresAt) {
  return (
    '<div class="arc">gate preflight</div>' +
    '<h2>Approve goal proposal</h2>' +
    '<div class="of-gate-sheet-meta" data-component="FabricGateSheet">' +
    '<p class="of-gate-tenant">tenant: ' + ofGateSafe(tenant, 'unknown', 64) + '</p>' +
    '<p class="of-gate-digest">digest: ' + ofGateSafe(digest, 'unknown', 128) + '</p>' +
    '<p class="of-gate-nonce">nonce: ' + ofGateSafe(nonce, 'unknown', 64) + '</p>' +
    '<p class="of-gate-expiry">expiresAt: ' + ofGateSafe(expiresAt, 'unknown', 64) + '</p>' +
    '</div>' +
    '<p class="gate-preflight-line" data-component="GatePreflightConsequence">' +
    'Opening governed approval — founder approval commits this goal proposal to the goal graph for tenant ' +
    ofGateSafe(tenant, 'unknown', 64) + '; the goal graph commits only after this signature.' +
    '</p>' +
    '<div class="gbtns">' +
    '<button type="button" class="reroll" data-of-gate-sheet-close="1">Close</button>' +
    '</div>'
  );
}

function ofRenderGateSheetPreflight(projection, selection, context) {
  var ctx = context || {};
  var origin = ofGateNormalizeOrigin(ctx.origin);
  var dismiss = function (_reason) { return origin; };

  function failResult() {
    return {
      opened: false,
      confirmDisabled: true,
      routeTo: 'inspect',
      html: ofGateRenderInspectOnlyHtml(),
      binding: null,
      origin: origin,
      dismiss: dismiss
    };
  }

  var selected = selection ? selection.selected : null;
  var action = selection ? selection.action : null;
  if (selected === null || selected === undefined || action === null || action === undefined) return failResult();

  var nodes = (projection && projection.nodes) || [];
  var found = false;
  for (var ni = 0; ni < nodes.length; ni++) {
    if (nodes[ni] === selected) { found = true; break; }
  }
  if (!found) return failResult();

  var canonicalId = ofGateCanonicalNodeId(selected);
  if (canonicalId === null) return failResult();

  if (!ofGateIsBoundedSafeString(projection && projection.tenantId, 64)) return failResult();

  if (
    action.kind !== 'approve-goal-graph' ||
    action.subject !== canonicalId ||
    !ofGateIsBoundedSafeString(action.objectId, 128) ||
    !ofGateIsBoundedSafeString(action.nonce, 128) ||
    !ofGateIsBoundedSafeString(action.expiresAt, 128) ||
    !ofGateFiniteNonNegativeInteger(action.expectedHeadVersion) ||
    !ofGateFiniteNonNegativeInteger(action.fence)
  ) {
    return failResult();
  }

  if (ctx.freshness !== 'fresh' || typeof ctx.openGatePreflight !== 'function') {
    return failResult();
  }

  var binding = {
    tenant: projection.tenantId,
    changeDigest: action.objectId,
    nonce: action.nonce,
    expiresAt: action.expiresAt,
    graphVersion: action.expectedHeadVersion,
    fence: action.fence
  };

  var seed = {
    tenant: binding.tenant,
    changeDigest: binding.changeDigest,
    nonce: binding.nonce,
    expiresAt: binding.expiresAt,
    graphVersion: binding.graphVersion,
    fence: binding.fence,
    consequence:
      'opening governed approval — founder approval commits the goal proposal to the goal graph for tenant ' +
      binding.tenant + '; the goal graph commits only after this signature',
    idempotencyKey: 'approve-goal-graph:' + binding.tenant + ':' + binding.changeDigest
  };

  ctx.openGatePreflight('approve-goal-graph', action.subject, null, seed);

  return {
    opened: true,
    confirmDisabled: true,
    routeTo: 'gate',
    html: ofGateRenderFreshHtml(binding.tenant, binding.changeDigest, binding.nonce, binding.expiresAt),
    binding: binding,
    origin: origin,
    dismiss: dismiss
  };
}
`;
