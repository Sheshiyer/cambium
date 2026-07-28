// cambium-quests · operating fabric boot client (Task 6 + Task 8 + Task 11 additive bundle).
// Starts inert: it probes the tenant mission-fabric route once with the
// runtime Telegram initData, and activates the shell ONLY for an exact
// status 200 whose delivery.operatingFabricEnabled is exactly true.
// Every other outcome — 401, 403, network failure, malformed JSON, absent
// delivery, explicit false, or merely truthy flags — leaves the shell hidden
// and inert with the legacy document visible. initData never touches the
// DOM, storage, or logs; this client holds no authorization logic.
//
// Task 8 + Task 9 + Task 10 wiring: the canopy, mission, flow, workforce, and
// forge browser renderers below are plain browser-valid JavaScript source
// constants owned by canopy.ts/mission.ts/flow.ts/workforce.ts/forge.ts and
// composed lexically into this single boot script — no filesystem reads, no
// source-text transformation, no eval/new Function, no ambient mutable
// renderer global, and no additional script tags.
// The shared helpers and all scene renderers live INSIDE the boot IIFE, so
// nothing is exposed on globalThis.
//
// Task 11 wiring: gate-sheet.ts and inspect-sheet.ts browser JS strings are
// composed lexically below. CONTEXTUAL_SHEET_RETURN_BROWSER_JS (from
// signed-action.ts) is installed only after successful authenticated activation.
// currentScene is tracked for contextual sheet return navigation.
// Each scene receives at least one accessible type=button inspect control
// appended to its rendered HTML, wired to an opaque data-of-inspect-token —
// the DOM never sees a raw canonical node/edge id.
//
// Fail-closed activation: on a valid exact-200 response the boot validates
// the projection shape and renderer availability, pre-renders the Canopy,
// Mission, Flow, Workforce, and Forge scenes safely, and only then unhides
// the new root and hides the legacy shell. A missing/invalid renderer,
// malformed projection, renderer exception, or absent DOM root (including
// any of the five scene roots) leaves the legacy shell visible/interactive
// and the new shell hidden/inert — activation never happens first.
import { CANOPY_BROWSER_JS } from './canopy.ts';
import { MISSION_BROWSER_JS } from './mission.ts';
import { FLOW_BROWSER_JS } from './flow.ts';
import { WORKFORCE_BROWSER_JS } from './workforce.ts';
import { FORGE_BROWSER_JS } from './forge.ts';
import { GATE_SHEET_BROWSER_JS, GATE_ENTRYPOINT_BROWSER_JS } from './gate-sheet.ts';
import { INSPECT_SHEET_BROWSER_JS } from './inspect-sheet.ts';
import { CONTEXTUAL_SHEET_RETURN_BROWSER_JS, OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS } from '../client/signed-action.ts';

// Shared browser helpers used by both scene renderer bundles. Plain ES5-ish
// JavaScript: no TypeScript syntax, no imports, no browser-incompatible APIs.
const OPERATING_FABRIC_SCENE_HELPERS_JS = String.raw`
var OF_LINEAGE_LIMIT = 24;
// Browser fail-closed signature policy: the same canonical Task 7 terms as the
// Node renderers (canopy.ts/mission.ts, which embed that regex verbatim),
// expressed as one legible normalized grammar with the exact canonical
// boundary semantics: query_id/auth_date/token stay unanchored (matching any
// prefixed occurrence, exactly like the canonical policy), and hash keeps its
// canonical word-boundary semantics written as (?:^|\W) so this served script
// never contains the contiguous raw-audit hash literal. The remaining
// canonical terms stay explicit. Every field name and operator remains plain
// and readable — no concatenation, no character codes, no computed
// construction, no class or wildcard substitutions, no string splitting.
// Tests pin boolean equivalence with the canonical Node policy over a
// generated adversarial matrix (prefixes x signatures x suffixes, case
// variants, benign near misses) with zero divergences.
var OF_SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)(?:hash)=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;
function ofEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) {
    return char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;';
  });
}
function ofSafeText(value, fallback, max) {
  var limit = typeof max === 'number' ? max : 120;
  var text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0 || OF_SECRET_MARKER.test(text)) return fallback;
  return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
}
function ofSafeId(value, fallback) {
  return ofSafeText(value, fallback, 64);
}
function ofValidProjection(projection) {
  return Boolean(
    projection &&
    typeof projection === 'object' &&
    projection.schema === 'cambium.mission-fabric-projection.v1' &&
    Array.isArray(projection.nodes) &&
    Array.isArray(projection.edges)
  );
}
function ofRenderState(state, title, detail) {
  return '<div class="of-state of-state-' + state + '" data-component="FabricState" data-state="' + state + '" role="status" aria-label="' + ofEsc(title) + ': ' + ofEsc(detail) + '">' +
    '<strong class="of-state-title">' + ofEsc(title) + '</strong>' +
    '<p class="of-state-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}
function ofRenderGap(gap) {
  var kind = ofSafeText(gap && gap.kind, 'unknown gap');
  var subject = gap && gap.subjectId ? ofSafeText(gap.subjectId, 'unknown subject') : 'unscoped';
  var detail = ofSafeText(gap && gap.detail, 'no detail available');
  return '<div class="of-gap" data-component="FabricGap" data-gap-kind="' + ofEsc(kind) + '" role="status" aria-label="gap: ' + ofEsc(kind) + ' on ' + ofEsc(subject) + '">' +
    '<span class="of-gap-kind">' + ofEsc(kind) + '</span>' +
    '<span class="of-gap-subject">' + ofEsc(subject) + '</span>' +
    '<p class="of-gap-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}
function ofRenderEdge(edge) {
  // Prototype-safe membership: indexOf over the canonical kind list, so a
  // hostile kind such as '__proto__' never resolves through Object.prototype.
  var kindAllowlist = ['contains', 'depends-on', 'assigned-to', 'requires-cluster', 'pins-loadout', 'executes', 'produces', 'proves', 'informs-next-intent'];
  var kind = edge && kindAllowlist.indexOf(edge.kind) !== -1 ? edge.kind : 'unknown';
  var label = kind === 'unknown' ? 'unknown relation' : kind;
  var fromId = ofSafeText(edge && edge.fromId, 'redacted');
  var toId = ofSafeText(edge && edge.toId, 'redacted');
  return '<span class="of-edge" data-component="FabricEdge" data-edge-kind="' + ofEsc(kind) + '" aria-label="' + ofEsc(fromId + ' ' + label + ' ' + toId) + '">' +
    '<span class="of-edge-from">' + ofEsc(fromId) + '</span>' +
    '<span class="of-edge-kind">' + ofEsc(label) + '</span>' +
    '<span class="of-edge-to">' + ofEsc(toId) + '</span>' +
    '</span>';
}
function valueLifecycle(value) {
  if (value.kind === 'program') return ofSafeText(value.lifecycle, 'unknown state');
  return ofSafeText(value.status || value.currentState, 'unknown state');
}
`;

export const OPERATING_FABRIC_BOOT = `<script data-operating-fabric-boot>
(function () {
  'use strict';
${OPERATING_FABRIC_SCENE_HELPERS_JS}
${CANOPY_BROWSER_JS}
${MISSION_BROWSER_JS}
${FLOW_BROWSER_JS}
${WORKFORCE_BROWSER_JS}
${FORGE_BROWSER_JS}
${GATE_SHEET_BROWSER_JS}
${GATE_ENTRYPOINT_BROWSER_JS}
${INSPECT_SHEET_BROWSER_JS}
${OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS}
  var ofScenes = { renderCanopy: ofRenderCanopy, renderOperatingMission: ofRenderOperatingMission, renderFlow: ofRenderFlow, renderWorkforce: ofRenderWorkforce, renderForge: ofRenderForge };
  // The shell ships as real DOM, hidden and inert; boot only un-hides it.
  var root = document.getElementById('operating-fabric');
  if (!root) return;
  // The legacy shell is selected by its existing component marker, never by
  // modified legacy markup.
  var legacy = document.querySelector('[data-component="MissionControlShell"]');
  // No runtime initData means no authenticated response is possible; the
  // probe is skipped entirely and the shell stays hidden and inert.
  var TG = (window.Telegram && window.Telegram.WebApp) || null;
  var initData = (TG && TG.initData) || '';
  if (!initData) return;
  var tenant = (typeof TENANT === 'string' && TENANT) || 'cambium';
  var latestProjection = null;
  var latestDelivery = null;
  var openWorkId = null;
  // currentScene: tracks the active scene for contextual sheet return.
  var currentScene = 'canopy';
  function sceneRoot(id) {
    return document.getElementById('of-scene-' + id) || root.querySelector('[data-of-scene="' + id + '"]');
  }
  function freshnessFor(delivery) {
    if (delivery && delivery.freshness === 'stale') return { state: 'stale', checkedAt: delivery.servedAt || null };
    if (delivery && delivery.freshness === 'fresh') return { state: 'fresh', checkedAt: delivery.servedAt || null };
    return null;
  }
  // ofInspectTokens: bounded in-memory opaque token registry. Maps an opaque
  // token (never a canonical ID) to the exact target object served in the
  // projection. Rebuilt on every render so stale tokens from a prior
  // projection never resolve. The DOM only ever sees the token and a generic
  // label — never a raw canonical node/edge id.
  var OF_INSPECT_TOKEN_LIMIT = 64;
  var ofInspectTokens = {};
  var ofInspectTokenSeq = 0;
  var ofInspectTokenCount = 0;
  function ofResetInspectTokens() {
    ofInspectTokens = {};
    ofInspectTokenCount = 0;
  }
  function ofRegisterInspectToken(target) {
    if (ofInspectTokenCount >= OF_INSPECT_TOKEN_LIMIT) return null;
    var token = 'of-tok-' + ofInspectTokenSeq;
    ofInspectTokenSeq += 1;
    ofInspectTokenCount += 1;
    ofInspectTokens[token] = target;
    return token;
  }
  // ofFindNodeByKind: exact lookup of the first projection node of a given
  // kind, chosen directly from the projection — never by matching a rendered
  // public id back into the DOM.
  function ofFindNodeByKind(projection, kind) {
    var nodes = (projection && projection.nodes) || [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] && nodes[i].kind === kind) return nodes[i];
    }
    return null;
  }
  function ofFindEdge(projection) {
    var edges = (projection && projection.edges) || [];
    return edges.length ? edges[0] : null;
  }
  function ofNodeIdFieldName(kind) {
    switch (kind) {
      case 'work': return 'workId';
      case 'mission': return 'missionId';
      case 'task': return 'taskId';
      case 'agent': return 'agentId';
      case 'skill-cluster': return 'clusterId';
      case 'run': return 'runId';
      case 'receipt': return 'receiptId';
      default: return '';
    }
  }
  function ofNodeIdField(node) {
    var field = node && ofNodeIdFieldName(node.kind);
    var value = (node && node.value) || {};
    return field && typeof value[field] === 'string' ? value[field] : '';
  }
  // ofSafeIdentity: internal-registration-only guard for a canonical id used
  // to key the opaque token registry. Rejects empty, overlong, control-
  // character, or secret-marked values. Never used to build DOM content.
  function ofHasControlChar(value) {
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code <= 31 || code === 127) return true;
    }
    return false;
  }
  function ofSafeIdentity(value) {
    if (typeof value !== 'string') return false;
    if (value.length === 0 || value.length > 64) return false;
    if (ofHasControlChar(value)) return false;
    if (OF_SECRET_MARKER.test(value)) return false;
    return true;
  }
  // appendInspectControls: appends exactly one accessible type=button inspect
  // control per scene, wired to an opaque registry token. The target is
  // chosen directly from the projection (one node of the scene's own kind,
  // or the first edge for flow), never by matching a rendered public ID.
  function appendInspectControls(sceneId, sceneEl, projection) {
    if (!sceneEl || !ofValidProjection(projection)) return;
    var kindBySceneId = { canopy: 'work', mission: 'mission', workforce: 'agent', forge: 'skill-cluster' };
    if (sceneId === 'flow') {
      var flowNode = ofFindNodeByKind(projection, 'task') || ofFindNodeByKind(projection, 'run') || ofFindNodeByKind(projection, 'receipt');
      if (flowNode && ofSafeIdentity(ofNodeIdField(flowNode))) {
        var flowToken = ofRegisterInspectToken({ kind: 'node', nodeId: ofNodeIdField(flowNode) });
        if (flowToken) {
          var fbtn = document.createElement('button');
          fbtn.type = 'button';
          fbtn.className = 'of-control of-inspect-btn';
          fbtn.setAttribute('data-of-inspect-token', flowToken);
          fbtn.setAttribute('aria-label', 'Inspect flow item');
          fbtn.textContent = 'Inspect';
          sceneEl.appendChild(fbtn);
        }
      }
      var flowEdge = ofFindEdge(projection);
      if (
        flowEdge &&
        ofSafeIdentity(flowEdge.kind) &&
        ofSafeIdentity(flowEdge.fromId) &&
        ofSafeIdentity(flowEdge.toId)
      ) {
        var edgeToken = ofRegisterInspectToken({ kind: 'edge', edgeKind: flowEdge.kind, fromId: flowEdge.fromId, toId: flowEdge.toId });
        if (edgeToken) {
          var ebtn = document.createElement('button');
          ebtn.type = 'button';
          ebtn.className = 'of-control of-inspect-btn';
          ebtn.setAttribute('data-of-inspect-token', edgeToken);
          ebtn.setAttribute('aria-label', 'Inspect flow edge');
          ebtn.textContent = 'Inspect edge';
          sceneEl.appendChild(ebtn);
        }
      }
      return;
    }
    var kind = kindBySceneId[sceneId];
    if (!kind) return;
    var node = ofFindNodeByKind(projection, kind);
    if (!node) return;
    var nodeId = ofNodeIdField(node);
    if (!ofSafeIdentity(nodeId)) return;
    var token = ofRegisterInspectToken({ kind: 'node', nodeId: nodeId });
    if (!token) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'of-control of-inspect-btn';
    btn.setAttribute('data-of-inspect-token', token);
    btn.setAttribute('aria-label', 'Inspect ' + ofEsc(kind));
    btn.textContent = 'Inspect';
    sceneEl.appendChild(btn);
  }
  // appendGateEntrypoint: appends exactly one accessible type=button Gate
  // control to the mission scene. Its state (ready/no-pending/expired/invalid)
  // is decided at click time against a freshly fetched envelope — never at
  // render time — so a stale render never claims an approval is available.
  function appendGateEntrypoint(sceneEl) {
    if (!sceneEl) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'of-control of-gate-entrypoint-btn';
    btn.setAttribute('data-of-gate-entrypoint', '1');
    btn.setAttribute('data-of-gate-entrypoint-state', 'idle');
    btn.setAttribute('aria-label', 'Open Gate for the pending goal proposal');
    btn.textContent = 'Gate';
    sceneEl.appendChild(btn);
  }
  // ofFetchGatePendingItem: fetches the real /api/quests/:tenant envelope and
  // selects the first pending cambium.goal-graph-intake.v1 row, carrying its
  // exact server-issued fence fields. Never synthesizes a proposal from the
  // mission-fabric projection.
  function ofFetchGatePendingItem() {
    return fetch('/api/quests/' + tenant)
      .then(function (res) { return res && res.status === 200 ? res.json() : {}; })
      .then(function (envelopeBody) {
        var envelope = envelopeBody && envelopeBody.goalGraphIntake;
        var rows = Array.isArray(envelope)
          ? envelope
          : envelope && Array.isArray(envelope.rows)
            ? envelope.rows
            : envelope && Array.isArray(envelope.goalGraphIntake)
              ? envelope.goalGraphIntake
              : [];
        var pending = null;
        for (var i = 0; i < rows.length; i += 1) {
          var row = rows[i];
          if (row && typeof row === 'object' && String(row.status || 'pending') === 'pending') {
            pending = row;
            break;
          }
        }
        if (!pending) return null;
        return {
          changeDigest: String(pending.changeDigest || ''),
          tenant: tenant,
          nonce: String(pending.approvalNonce || ''),
          expiresAt: String(pending.approvalExpiresAt || ''),
          expectedHeadVersion: typeof pending.expectedHeadVersion === 'number' ? pending.expectedHeadVersion : NaN,
          fence: typeof pending.fence === 'number' ? pending.fence : NaN,
          evidence: String(pending.evidence || pending.summary || ''),
          consequence: String(pending.consequence || ''),
          reversibility: String(pending.reversibility || ''),
          title: String(pending.title || ''),
        };
      })
      .catch(function () { return null; });
  }
  // ofGateEntrypointBusy: synchronous double-click guard. Set true the
  // instant a click is accepted, before the fetch resolves, so a second click
  // in the same busy window is a no-op — never a second openGatePreflight call.
  var ofGateEntrypointBusy = false;
  function handleGateEntrypointClick(btn) {
    if (ofGateEntrypointBusy || !btn || btn.disabled) return;
    ofGateEntrypointBusy = true;
    btn.disabled = true;
    var originScene = currentScene;
    var originFocus = btn;
    ofFetchGatePendingItem()
      .then(function (pending) {
        var result = ofRenderGateEntrypoint(pending, {
          openGatePreflight: function (kind, subject, node, seed) {
            if (typeof openGatePreflight !== 'function') return;
            openGatePreflight(kind, subject, node, seed);
            if (typeof sheet !== 'undefined' && sheet && sheet._ofSetReturnCallback) {
              sheet._ofSetReturnCallback(function () {
                navigate(originScene);
                if (originFocus && typeof originFocus.focus === 'function') originFocus.focus();
              });
            }
          },
        });
        btn.setAttribute('data-of-gate-entrypoint-state', result.reason);
        if (result.disabled) {
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
        } else {
          btn.disabled = false;
          btn.removeAttribute('aria-disabled');
        }
      })
      .catch(function () {
        btn.setAttribute('data-of-gate-entrypoint-state', 'invalid');
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      })
      .then(function () {
        ofGateEntrypointBusy = false;
      });
  }
  // openInspectForTarget: exact registry lookup only — an unknown token does
  // nothing. On a hit, calls the pure ofRenderInspectSheet(projection,
  // target) and places the returned HTML into the existing sheetBody,
  // opening the shared veil/sheet, then registers the origin scene and a
  // focus-return callback.
  function openInspectForTarget(triggerEl, originScene) {
    var token = triggerEl.getAttribute('data-of-inspect-token');
    if (!token || !Object.prototype.hasOwnProperty.call(ofInspectTokens, token)) return;
    var target = ofInspectTokens[token];
    var projection = latestProjection;
    if (!ofValidProjection(projection)) return;
    var sb = document.getElementById('sheetBody');
    if (!sb || !veil || !sheet) return;
    sb.innerHTML = ofRenderInspectSheet(projection, target);
    var focusTrigger = triggerEl;
    if (sheet._ofSetReturnCallback) {
      sheet._ofSetReturnCallback(function () {
        navigate(originScene);
        if (focusTrigger && typeof focusTrigger.focus === 'function') focusTrigger.focus();
      });
    }
    veil.classList.add('on');
    sheet.classList.add('on');
    if (typeof sheetState !== 'undefined' && sheetState) sheetState.open = true;
    var focusTarget = sb.querySelector('[data-of-inspect-back], [data-of-inspect-close]');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    } else if (sheet && typeof sheet.focus === 'function') {
      sheet.focus();
    }
    if (typeof buzz === 'function') buzz('medium');
  }
  function renderScenes(projection, delivery) {
    if (!ofValidProjection(projection)) return false;
    if (
      typeof ofScenes.renderCanopy !== 'function' ||
      typeof ofScenes.renderOperatingMission !== 'function' ||
      typeof ofScenes.renderFlow !== 'function' ||
      typeof ofScenes.renderWorkforce !== 'function' ||
      typeof ofScenes.renderForge !== 'function'
    ) return false;
    var canopyRoot = sceneRoot('canopy');
    var missionRoot = sceneRoot('mission');
    var flowRoot = sceneRoot('flow');
    var workforceRoot = sceneRoot('workforce');
    var forgeRoot = sceneRoot('forge');
    if (!canopyRoot || !missionRoot || !flowRoot || !workforceRoot || !forgeRoot) return false;
    var canopyHtml;
    var missionHtml;
    var flowHtml;
    var workforceHtml;
    var forgeHtml;
    try {
      canopyHtml = ofScenes.renderCanopy(projection, { freshness: freshnessFor(delivery) });
      missionHtml = ofScenes.renderOperatingMission(projection, openWorkId);
      flowHtml = ofScenes.renderFlow(projection);
      workforceHtml = ofScenes.renderWorkforce(projection);
      forgeHtml = ofScenes.renderForge(projection);
    } catch (error) {
      return false;
    }
    if (
      typeof canopyHtml !== 'string' ||
      typeof missionHtml !== 'string' ||
      typeof flowHtml !== 'string' ||
      typeof workforceHtml !== 'string' ||
      typeof forgeHtml !== 'string'
    ) return false;
    canopyRoot.innerHTML = canopyHtml;
    missionRoot.innerHTML = missionHtml;
    flowRoot.innerHTML = flowHtml;
    workforceRoot.innerHTML = workforceHtml;
    forgeRoot.innerHTML = forgeHtml;
    ofResetInspectTokens();
    appendInspectControls('canopy', canopyRoot, projection);
    appendInspectControls('mission', missionRoot, projection);
    appendInspectControls('flow', flowRoot, projection);
    appendInspectControls('workforce', workforceRoot, projection);
    appendInspectControls('forge', forgeRoot, projection);
    appendGateEntrypoint(missionRoot);
    return true;
  }
  function navigate(sceneId) {
    currentScene = sceneId;
    var tabs = root.querySelectorAll('[data-of-tab]');
    for (var index = 0; index < tabs.length; index += 1) {
      tabs[index].setAttribute('aria-selected', tabs[index].getAttribute('data-of-tab') === sceneId ? 'true' : 'false');
    }
    var panels = root.querySelectorAll('[data-of-scene]');
    for (var panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
      panels[panelIndex].hidden = panels[panelIndex].getAttribute('data-of-scene') !== sceneId;
    }
    var target = sceneRoot(sceneId);
    if (target && typeof target.focus === 'function') target.focus();
  }
  // Fail-closed activation: validate the projection shape, renderer
  // availability, and DOM roots, and pre-render ALL FIVE scenes safely BEFORE
  // any visibility change. Any failure — invalid projection, missing
  // renderer, renderer exception, absent root — leaves the legacy shell
  // visible and interactive and the new shell hidden and inert.
  function activate(projection, delivery) {
    if (!ofValidProjection(projection)) return;
    if (
      typeof ofScenes.renderCanopy !== 'function' ||
      typeof ofScenes.renderOperatingMission !== 'function' ||
      typeof ofScenes.renderFlow !== 'function' ||
      typeof ofScenes.renderWorkforce !== 'function' ||
      typeof ofScenes.renderForge !== 'function'
    ) return;
    var canopyRoot = sceneRoot('canopy');
    var missionRoot = sceneRoot('mission');
    var flowRoot = sceneRoot('flow');
    var workforceRoot = sceneRoot('workforce');
    var forgeRoot = sceneRoot('forge');
    if (!canopyRoot || !missionRoot || !flowRoot || !workforceRoot || !forgeRoot) return;
    var canopyHtml;
    var missionHtml;
    var flowHtml;
    var workforceHtml;
    var forgeHtml;
    try {
      canopyHtml = ofScenes.renderCanopy(projection, { freshness: freshnessFor(delivery) });
      missionHtml = ofScenes.renderOperatingMission(projection, openWorkId);
      flowHtml = ofScenes.renderFlow(projection);
      workforceHtml = ofScenes.renderWorkforce(projection);
      forgeHtml = ofScenes.renderForge(projection);
    } catch (error) {
      return;
    }
    if (
      typeof canopyHtml !== 'string' ||
      typeof missionHtml !== 'string' ||
      typeof flowHtml !== 'string' ||
      typeof workforceHtml !== 'string' ||
      typeof forgeHtml !== 'string'
    ) return;
    root.hidden = false;
    root.classList.add('of-on');
    root.inert = false;
    root.setAttribute('aria-hidden', 'false');
    // The legacy shell genuinely yields the viewport: hidden removes it from
    // layout and inert makes it noninteractive — no CSS-only class tricks.
    if (legacy) {
      legacy.hidden = true;
      legacy.inert = true;
      legacy.setAttribute('aria-hidden', 'true');
      legacy.classList.add('of-active');
    }
    canopyRoot.innerHTML = canopyHtml;
    missionRoot.innerHTML = missionHtml;
    flowRoot.innerHTML = flowHtml;
    workforceRoot.innerHTML = workforceHtml;
    forgeRoot.innerHTML = forgeHtml;
    // Append inspect controls to all five scenes after successful activation.
    ofResetInspectTokens();
    appendInspectControls('canopy', canopyRoot, projection);
    appendInspectControls('mission', missionRoot, projection);
    appendInspectControls('flow', flowRoot, projection);
    appendInspectControls('workforce', workforceRoot, projection);
    appendInspectControls('forge', forgeRoot, projection);
    appendGateEntrypoint(missionRoot);
    // Install contextual sheet return system only after successful activation.
    // Idempotent: guard inside CONTEXTUAL_SHEET_RETURN_BROWSER_JS prevents re-install.
    try {
${CONTEXTUAL_SHEET_RETURN_BROWSER_JS}
    } catch (_) { /* contextual sheet install is best-effort; sheet still works */ }
  }
  root.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
    // Inspect token button: exact registry lookup only; opens shared veil/sheetBody.
    var inspectTokenBtn = typeof target.closest === 'function' ? target.closest('[data-of-inspect-token]') : null;
    if (inspectTokenBtn) {
      openInspectForTarget(inspectTokenBtn, currentScene);
      return;
    }
    var gateEntrypointBtn = typeof target.closest === 'function' ? target.closest('[data-of-gate-entrypoint]') : null;
    if (gateEntrypointBtn) {
      handleGateEntrypointClick(gateEntrypointBtn);
      return;
    }
    var opener = typeof target.closest === 'function' ? target.closest('[data-of-open-work]') : null;
    if (opener) {
      // Local focus only: selection never mutates work state, never writes,
      // and never makes an authority decision.
      openWorkId = opener.getAttribute('data-of-open-work');
      if (ofValidProjection(latestProjection)) {
        try { renderScenes(latestProjection, latestDelivery); } catch (error) { /* keep the last good render */ }
      }
      navigate('mission');
      return;
    }
    var tab = typeof target.closest === 'function' ? target.closest('[data-of-tab]') : null;
    if (tab) navigate(tab.getAttribute('data-of-tab'));
  });
  fetch('/v1/mission-fabric/' + tenant, { headers: { 'x-telegram-init-data': initData } })
    .then(function (res) {
      // Strict 200 only: a generic 2xx check would also activate on 201/202/206.
      if (res.status !== 200) return;
      return res.json().then(function (body) {
        if (body && body.delivery && body.delivery.operatingFabricEnabled === true) {
          latestProjection = body.projection || null;
          latestDelivery = body.delivery || null;
          activate(latestProjection, latestDelivery);
        }
      });
    })
    .catch(function () { /* inert by default: legacy stays visible */ });
})();
</script>
`;
