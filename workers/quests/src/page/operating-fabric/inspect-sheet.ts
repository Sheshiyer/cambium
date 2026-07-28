// cambium-quests · operating fabric inspect sheet (Task 11).
// Read-only display of exact served node/edge data resolved from the
// projection by canonical identity. Never echoes the requested target back —
// only what was actually found (or the generic "unavailable" state).
// Bounded and escaped: identity, schema, source, graphVersion, generatedAt,
// asOf, read-only freshness, gaps (kind/detail only, max 24).
// Never renders evidenceRef, graphDigest, sourceRef, or any other property.
// Back/Close buttons only — data attributes only, no onclick/script/Gate.
// ES5-ish browser JS string composed into the boot IIFE by client.ts; the
// browser-side function is pure and return-only: no DOM, no listeners, no
// callbacks, no window/fetch/storage/eval/new Function.

import type { FabricEdge, FabricNode, MissionFabricProjectionV1 } from '../../mission-fabric.ts';

export type InspectTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edge'; edgeKind: FabricEdge['kind']; fromId: string; toId: string };

const MAX_GAPS = 24;

const SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)(?:hash)=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Secret detection happens BEFORE truncation, then the result is escaped.
function bounded(value: unknown, fallback: string, max = 120): string {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  if (text.length === 0 || SECRET_MARKER.test(text)) return fallback;
  const clipped = text.length > max ? text.slice(0, max - 1) + '…' : text;
  return esc(clipped);
}

// Canonical own-identity field per node.kind. Exactly one field is consulted
// per kind — never a fallback chain across kinds — so a node can never be
// matched by a field that does not belong to its own kind.
const NODE_ID_FIELD_BY_KIND: Record<FabricNode['kind'], string> = {
  work: 'workId',
  mission: 'missionId',
  task: 'taskId',
  agent: 'agentId',
  'skill-cluster': 'clusterId',
  run: 'runId',
  receipt: 'receiptId',
};

function nodeOwnId(node: FabricNode): string {
  const field = NODE_ID_FIELD_BY_KIND[node.kind];
  const value = node.value as Record<string, unknown>;
  const id = Object.prototype.hasOwnProperty.call(value, field) ? value[field] : undefined;
  return typeof id === 'string' ? id : '';
}

interface ResolvedNode {
  kind: 'node';
  nodeKind: FabricNode['kind'];
  id: string;
}

interface ResolvedEdge {
  kind: 'edge';
  edgeKind: FabricEdge['kind'];
  fromId: string;
  toId: string;
}

type Resolved = ResolvedNode | ResolvedEdge | null;

// Resolves an InspectTarget against the projection using an exact match.
// Requires exactly one match; zero or duplicate matches resolve to null,
// which renders the generic unavailable state without echoing the target.
function resolveTarget(projection: MissionFabricProjectionV1, target: InspectTarget): Resolved {
  if (target.kind === 'node') {
    if (typeof target.nodeId !== 'string' || target.nodeId.length === 0) return null;
    let match: FabricNode | null = null;
    let count = 0;
    for (const node of projection.nodes) {
      if (nodeOwnId(node) === target.nodeId) {
        match = node;
        count += 1;
      }
    }
    if (count !== 1 || match === null) return null;
    return { kind: 'node', nodeKind: match.kind, id: nodeOwnId(match) };
  }
  if (target.kind === 'edge') {
    if (typeof target.edgeKind !== 'string' || typeof target.fromId !== 'string' || typeof target.toId !== 'string') return null;
    if (target.edgeKind.length === 0 || target.fromId.length === 0 || target.toId.length === 0) return null;
    let match: FabricEdge | null = null;
    let count = 0;
    for (const edge of projection.edges) {
      if (edge.kind === target.edgeKind && edge.fromId === target.fromId && edge.toId === target.toId) {
        match = edge;
        count += 1;
      }
    }
    if (count !== 1 || match === null) return null;
    return { kind: 'edge', edgeKind: match.kind, fromId: match.fromId, toId: match.toId };
  }
  return null;
}

function gapsHtml(projection: MissionFabricProjectionV1, resolved: Resolved): string {
  if (resolved === null) return '<p class="of-inspect-gaps-empty">no gaps attached</p>';
  const allGaps = Array.isArray(projection.gaps) ? projection.gaps : [];
  const matching = allGaps.filter((g) =>
    resolved.kind === 'node'
      ? g.subjectId === resolved.id
      : g.subjectId === resolved.fromId || g.subjectId === resolved.toId,
  );
  const gaps = matching.slice(0, MAX_GAPS);
  if (gaps.length === 0) return '<p class="of-inspect-gaps-empty">no gaps attached</p>';
  return (
    '<ul class="of-inspect-gaps">' +
    gaps
      .map(
        (g) =>
          '<li><span class="of-gap-kind">' +
          bounded(g.kind, 'unknown', 64) +
          '</span>: <span class="of-gap-detail">' +
          bounded(g.detail, 'no detail', 120) +
          '</span></li>',
      )
      .join('') +
    '</ul>'
  );
}

function unavailableHtml(projection: MissionFabricProjectionV1): string {
  return (
    '<div class="arc">inspect</div>' +
    '<h2>Inspect unavailable</h2>' +
    '<div class="of-inspect-sheet" data-component="FabricInspectSheet">' +
    '<p class="of-inspect-unavailable">No exact, unique match was found in the served projection.</p>' +
    '</div>' +
    gapsHtml(projection, null) +
    '<div class="gbtns">' +
    '<button type="button" class="detail" data-of-inspect-back="1">Back</button>' +
    '<button type="button" class="reroll" data-of-inspect-close="1">Close</button>' +
    '</div>'
  );
}

// renderInspectSheet resolves target against projection and renders exact
// identity plus read-only provenance (schema, sourceOfTruth, graphVersion,
// generatedAt, asOf). Never echoes the requested target on failure to
// resolve; never renders evidenceRef, graphDigest, sourceRef, or any other
// property beyond the fixed identity + provenance + gap fields.
export function renderInspectSheet(projection: MissionFabricProjectionV1, target: InspectTarget): string {
  const resolved = resolveTarget(projection, target);
  if (resolved === null) return unavailableHtml(projection);

  const identityLabel = resolved.kind === 'node'
    ? 'node · ' + esc(resolved.nodeKind) + ':' + bounded(resolved.id, 'unknown', 128)
    : 'edge · ' + esc(resolved.edgeKind) + ': ' + bounded(resolved.fromId, 'unknown', 128) + ' → ' + bounded(resolved.toId, 'unknown', 128);

  const schema = bounded(projection.schema, 'schema not served', 120);
  const source = bounded(projection.sourceOfTruth, 'source not served', 64);
  const graphVersion = bounded(projection.graphVersion, 'graphVersion not served', 32);
  const generatedAt = bounded(projection.generatedAt, 'generatedAt not served', 64);
  const asOf = bounded(projection.asOf, 'asOf not served', 64);
  const readOnly = projection.readOnly === true ? 'read-only — this projection cannot be mutated from here' : 'read-only state not served';

  return (
    '<div class="arc">inspect · ' + (resolved.kind === 'node' ? esc(resolved.nodeKind) : esc(resolved.edgeKind)) + '</div>' +
    '<h2>' + (resolved.kind === 'node' ? 'Node inspect' : 'Edge inspect') + '</h2>' +
    '<div class="of-inspect-sheet" data-component="FabricInspectSheet">' +
    '<p class="of-inspect-identity">' + identityLabel + '</p>' +
    '<p class="of-inspect-schema">schema: ' + schema + '</p>' +
    '<p class="of-inspect-source">sourceOfTruth: ' + source + '</p>' +
    '<p class="of-inspect-graph-version">graphVersion: ' + graphVersion + '</p>' +
    '<p class="of-inspect-generated-at">generatedAt: ' + generatedAt + '</p>' +
    '<p class="of-inspect-as-of">asOf: ' + asOf + '</p>' +
    '<p class="of-inspect-read-only">' + readOnly + '</p>' +
    '</div>' +
    gapsHtml(projection, resolved) +
    '<div class="gbtns">' +
    '<button type="button" class="detail" data-of-inspect-back="1">Back</button>' +
    '<button type="button" class="reroll" data-of-inspect-close="1">Close</button>' +
    '</div>'
  );
}

// INSPECT_SHEET_BROWSER_JS: browser-valid ES5-ish JavaScript string. No
// TypeScript syntax or imports. Composed lexically into the boot IIFE by
// client.ts. ofRenderInspectSheet(projection, target) is a pure, return-only
// parity function of renderInspectSheet: it performs its own exact lookup
// against the projection, builds and returns an HTML string, and touches
// nothing else. No document/window/fetch/storage/eval/new Function, no
// listeners, no callbacks — the caller is responsible for placing the
// returned HTML and wiring the Back/Close data attributes.
export const INSPECT_SHEET_BROWSER_JS = String.raw`
var OF_INSPECT_MAX_GAPS = 24;
var OF_INSPECT_SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)(?:hash)=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;
var OF_INSPECT_NODE_ID_FIELD_BY_KIND = {
  'work': 'workId',
  'mission': 'missionId',
  'task': 'taskId',
  'agent': 'agentId',
  'skill-cluster': 'clusterId',
  'run': 'runId',
  'receipt': 'receiptId'
};
function ofInspectEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function ofInspectBounded(value, fallback, max) {
  var cap = typeof max === 'number' ? max : 120;
  var text = typeof value === 'string' ? value.replace(/^\s+|\s+$/g, '') : (typeof value === 'number' ? String(value) : '');
  if (text.length === 0 || OF_INSPECT_SECRET_MARKER.test(text)) return fallback;
  var clipped = text.length > cap ? text.slice(0, cap - 1) + '…' : text;
  return ofInspectEsc(clipped);
}
function ofInspectNodeOwnId(node) {
  var field = node && OF_INSPECT_NODE_ID_FIELD_BY_KIND[node.kind];
  if (!field) return '';
  var val = (node && node.value) || {};
  if (Object.prototype.hasOwnProperty.call(val, field)) {
    var id = val[field];
    if (typeof id === 'string') return id;
  }
  return '';
}
function ofInspectResolveTarget(projection, target) {
  if (!projection || !target) return null;
  if (target.kind === 'node') {
    if (typeof target.nodeId !== 'string' || target.nodeId.length === 0) return null;
    var nodes = Array.isArray(projection.nodes) ? projection.nodes : [];
    var nodeMatch = null;
    var nodeCount = 0;
    for (var ni = 0; ni < nodes.length; ni++) {
      if (ofInspectNodeOwnId(nodes[ni]) === target.nodeId) {
        nodeMatch = nodes[ni];
        nodeCount += 1;
      }
    }
    if (nodeCount !== 1 || !nodeMatch) return null;
    return { kind: 'node', nodeKind: nodeMatch.kind, id: ofInspectNodeOwnId(nodeMatch) };
  }
  if (target.kind === 'edge') {
    if (typeof target.edgeKind !== 'string' || typeof target.fromId !== 'string' || typeof target.toId !== 'string') return null;
    if (target.edgeKind.length === 0 || target.fromId.length === 0 || target.toId.length === 0) return null;
    var edges = Array.isArray(projection.edges) ? projection.edges : [];
    var edgeMatch = null;
    var edgeCount = 0;
    for (var ei = 0; ei < edges.length; ei++) {
      var e = edges[ei];
      if (e && e.kind === target.edgeKind && e.fromId === target.fromId && e.toId === target.toId) {
        edgeMatch = e;
        edgeCount += 1;
      }
    }
    if (edgeCount !== 1 || !edgeMatch) return null;
    return { kind: 'edge', edgeKind: edgeMatch.kind, fromId: edgeMatch.fromId, toId: edgeMatch.toId };
  }
  return null;
}
function ofInspectGapsHtml(projection, resolved) {
  if (!resolved) return '<p class="of-inspect-gaps-empty">no gaps attached</p>';
  var allGaps = (projection && Array.isArray(projection.gaps)) ? projection.gaps : [];
  var matching = [];
  for (var mi = 0; mi < allGaps.length; mi++) {
    var mg = allGaps[mi];
    if (!mg) continue;
    if (resolved.kind === 'node') {
      if (mg.subjectId === resolved.id) matching.push(mg);
    } else {
      if (mg.subjectId === resolved.fromId || mg.subjectId === resolved.toId) matching.push(mg);
    }
  }
  var gaps = matching.slice(0, OF_INSPECT_MAX_GAPS);
  if (gaps.length === 0) return '<p class="of-inspect-gaps-empty">no gaps attached</p>';
  var html = '<ul class="of-inspect-gaps">';
  for (var gi = 0; gi < gaps.length; gi++) {
    var g = gaps[gi];
    var gKind = ofInspectBounded(g && g.kind, 'unknown', 64);
    var gDetail = ofInspectBounded(g && g.detail, 'no detail', 120);
    html += '<li><span class="of-gap-kind">' + gKind + '</span>: <span class="of-gap-detail">' + gDetail + '</span></li>';
  }
  html += '</ul>';
  return html;
}
function ofInspectUnavailableHtml(projection) {
  return (
    '<div class="arc">inspect</div>' +
    '<h2>Inspect unavailable</h2>' +
    '<div class="of-inspect-sheet" data-component="FabricInspectSheet">' +
    '<p class="of-inspect-unavailable">No exact, unique match was found in the served projection.</p>' +
    '</div>' +
    ofInspectGapsHtml(projection, null) +
    '<div class="gbtns">' +
    '<button type="button" class="detail" data-of-inspect-back="1">Back</button>' +
    '<button type="button" class="reroll" data-of-inspect-close="1">Close</button>' +
    '</div>'
  );
}
// ofRenderInspectSheet: pure, return-only parity of renderInspectSheet.
// No document/window/fetch/storage/eval/new Function, no listeners.
function ofRenderInspectSheet(projection, target) {
  var resolved = ofInspectResolveTarget(projection, target);
  if (!resolved) return ofInspectUnavailableHtml(projection);
  var identityLabel;
  if (resolved.kind === 'node') {
    identityLabel = 'node · ' + ofInspectEsc(resolved.nodeKind) + ':' + ofInspectBounded(resolved.id, 'unknown', 128);
  } else {
    identityLabel = 'edge · ' + ofInspectEsc(resolved.edgeKind) + ': ' + ofInspectBounded(resolved.fromId, 'unknown', 128) + ' → ' + ofInspectBounded(resolved.toId, 'unknown', 128);
  }
  var schema = ofInspectBounded(projection.schema, 'schema not served', 120);
  var source = ofInspectBounded(projection.sourceOfTruth, 'source not served', 64);
  var graphVersion = ofInspectBounded(projection.graphVersion, 'graphVersion not served', 32);
  var generatedAt = ofInspectBounded(projection.generatedAt, 'generatedAt not served', 64);
  var asOf = ofInspectBounded(projection.asOf, 'asOf not served', 64);
  var readOnly = (projection.readOnly === true) ? 'read-only — this projection cannot be mutated from here' : 'read-only state not served';
  var kindLabel = resolved.kind === 'node' ? ofInspectEsc(resolved.nodeKind) : ofInspectEsc(resolved.edgeKind);
  var titleLabel = resolved.kind === 'node' ? 'Node inspect' : 'Edge inspect';
  return (
    '<div class="arc">inspect · ' + kindLabel + '</div>' +
    '<h2>' + titleLabel + '</h2>' +
    '<div class="of-inspect-sheet" data-component="FabricInspectSheet">' +
    '<p class="of-inspect-identity">' + identityLabel + '</p>' +
    '<p class="of-inspect-schema">schema: ' + schema + '</p>' +
    '<p class="of-inspect-source">sourceOfTruth: ' + source + '</p>' +
    '<p class="of-inspect-graph-version">graphVersion: ' + graphVersion + '</p>' +
    '<p class="of-inspect-generated-at">generatedAt: ' + generatedAt + '</p>' +
    '<p class="of-inspect-as-of">asOf: ' + asOf + '</p>' +
    '<p class="of-inspect-read-only">' + readOnly + '</p>' +
    '</div>' +
    ofInspectGapsHtml(projection, resolved) +
    '<div class="gbtns">' +
    '<button type="button" class="detail" data-of-inspect-back="1">Back</button>' +
    '<button type="button" class="reroll" data-of-inspect-close="1">Close</button>' +
    '</div>'
  );
}
`;
