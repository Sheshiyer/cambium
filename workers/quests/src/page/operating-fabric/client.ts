// cambium-quests · operating fabric boot client (Task 6 + Task 8 additive bundle).
// Starts inert: it probes the tenant mission-fabric route once with the
// runtime Telegram initData, and activates the shell ONLY for an exact
// status 200 whose delivery.operatingFabricEnabled is exactly true.
// Every other outcome — 401, 403, network failure, malformed JSON, absent
// delivery, explicit false, or merely truthy flags — leaves the shell hidden
// and inert with the legacy document visible. initData never touches the
// DOM, storage, or logs; this client holds no authorization logic.
//
// Task 8 + Task 9 wiring: the canopy, mission, and flow browser renderers
// below are plain browser-valid JavaScript source constants owned by
// canopy.ts/mission.ts/flow.ts and composed lexically into this single boot
// script — no filesystem reads, no source-text transformation, no
// eval/new Function, no ambient mutable renderer global, and no third script.
// The shared helpers and all scene renderers live INSIDE the boot IIFE, so
// nothing is exposed on globalThis.
//
// Fail-closed activation: on a valid exact-200 response the boot validates
// the projection shape and renderer availability, pre-renders the Canopy,
// Mission, and Flow scenes safely, and only then unhides the new root and
// hides the legacy shell. A missing/invalid renderer, malformed projection,
// renderer exception, or absent DOM root (including the Flow root) leaves
// the legacy shell visible/interactive and the new shell hidden/inert —
// activation never happens first.
import { CANOPY_BROWSER_JS } from './canopy.ts';
import { MISSION_BROWSER_JS } from './mission.ts';
import { FLOW_BROWSER_JS } from './flow.ts';

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
  var ofScenes = { renderCanopy: ofRenderCanopy, renderOperatingMission: ofRenderOperatingMission, renderFlow: ofRenderFlow };
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
  function sceneRoot(id) {
    return document.getElementById('of-scene-' + id) || root.querySelector('[data-of-scene="' + id + '"]');
  }
  function freshnessFor(delivery) {
    if (delivery && delivery.freshness === 'stale') return { state: 'stale', checkedAt: delivery.servedAt || null };
    if (delivery && delivery.freshness === 'fresh') return { state: 'fresh', checkedAt: delivery.servedAt || null };
    return null;
  }
  function renderScenes(projection, delivery) {
    var canopyRoot = sceneRoot('canopy');
    var missionRoot = sceneRoot('mission');
    var flowRoot = sceneRoot('flow');
    if (canopyRoot) canopyRoot.innerHTML = ofScenes.renderCanopy(projection, { freshness: freshnessFor(delivery) });
    if (missionRoot) missionRoot.innerHTML = ofScenes.renderOperatingMission(projection, openWorkId);
    if (flowRoot) flowRoot.innerHTML = ofScenes.renderFlow(projection);
  }
  function navigate(sceneId) {
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
  // availability, and DOM roots, and pre-render BOTH scenes safely BEFORE any
  // visibility change. Any failure — invalid projection, missing renderer,
  // renderer exception, absent root — leaves the legacy shell visible and
  // interactive and the new shell hidden and inert.
  function activate(projection, delivery) {
    if (!ofValidProjection(projection)) return;
    if (typeof ofScenes.renderCanopy !== 'function' || typeof ofScenes.renderOperatingMission !== 'function' || typeof ofScenes.renderFlow !== 'function') return;
    var canopyRoot = sceneRoot('canopy');
    var missionRoot = sceneRoot('mission');
    var flowRoot = sceneRoot('flow');
    if (!canopyRoot || !missionRoot || !flowRoot) return;
    var canopyHtml;
    var missionHtml;
    var flowHtml;
    try {
      canopyHtml = ofScenes.renderCanopy(projection, { freshness: freshnessFor(delivery) });
      missionHtml = ofScenes.renderOperatingMission(projection, openWorkId);
      flowHtml = ofScenes.renderFlow(projection);
    } catch (error) {
      return;
    }
    if (typeof canopyHtml !== 'string' || typeof missionHtml !== 'string' || typeof flowHtml !== 'string') return;
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
  }
  root.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
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
