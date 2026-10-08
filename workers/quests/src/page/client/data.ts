// cambium-quests · miniapp page chunk — data load, gate gauge, boot, </script></body></html>
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
const CLIENT_DATA_BOOT_MARKER = 'go(START_SCENE, true);\nload();';

export const CLIENT_INITIAL_QUEST_HYDRATION = `function takeInitialQuestEnvelope(){
  const env = globalThis.__CAMBIUM_INITIAL_QUEST_ENVELOPE__;
  globalThis.__CAMBIUM_INITIAL_QUEST_ENVELOPE__ = undefined;
  if (!env || typeof env !== 'object' || Array.isArray(env)) return null;
  if (env.schema !== 1 || env.tenant !== TENANT) return null;
  if (typeof env.derivedAt !== 'string' || !Number.isFinite(Date.parse(env.derivedAt))) return null;
  if (!env.ledger || typeof env.ledger !== 'object' || Array.isArray(env.ledger) || !Array.isArray(env.ledger.rows)) return null;
  return env;
}
const INITIAL_QUEST_ENVELOPE = takeInitialQuestEnvelope();
if (INITIAL_QUEST_ENVELOPE) paint(INITIAL_QUEST_ENVELOPE);`;

export function injectInitialQuestHydration(page: string): string {
  const markerIndex = page.indexOf(CLIENT_DATA_BOOT_MARKER);
  if (markerIndex < 0 || markerIndex !== page.lastIndexOf(CLIENT_DATA_BOOT_MARKER)) {
    throw new Error('quest page must contain exactly one client data boot marker');
  }
  return page.replace(
    CLIENT_DATA_BOOT_MARKER,
    `go(START_SCENE, true);\n${CLIENT_INITIAL_QUEST_HYDRATION}\nload();`,
  );
}

export const CLIENT_DATA = `/* ── data ── */
let QUEST_READ_REVISION = 0;
let QUEST_READ_HELD = false;
function unavailablePanel(title, detail, state){
  return '<div class="state" data-ledger-state="' + esc(state || 'held') + '" role="status">' +
    '<span class="state-kicker">Curious · ' + esc(TENANT) + '</span><b>' + esc(title) + '</b><p>' + esc(detail) + '</p>' +
    '<div class="state-actions"><button type="button" data-ledger-retry>Retry connection</button>' +
    '<button type="button" data-ledger-system>Explore the system</button></div></div>';
}
function wireUnavailablePanel(container){
  if (!container) return;
  container.querySelectorAll('[data-ledger-retry]').forEach(button => button.onclick = () => refresh());
  container.querySelectorAll('[data-ledger-system]').forEach(button => button.onclick = () => {
    INSPECT_PANE = 'system'; renderInspect(null); go(4);
  });
}
function clearQuestPresentation(title, detail, state){
  CuriousReadBridge.hold(state, QUEST_READ_REVISION);
  QUEST_READ_HELD = true;
  ECOSYSTEM_ENV = null; LEDGER = null; CMDDATA = null; cmdsDrawn = false;
  $('fill').style.width = '0%';
  GATE_ITEMS = []; GATE_FILTER = 'all'; GATE_PREFLIGHT_ORIGIN = null; STORY_BEATS = [];
  MISSION_BRANCH_FOCUS = null;
  // Discard old local detail and callbacks. Submitted server actions retain
  // their request identity and are never cancelled or replayed by this read.
  closeSheet(); sheetBody.innerHTML = '';
  sheetBody._founderOutcomeSubmit = null; sheetBody._founderOutcomeOpenGate = null;
  const html = unavailablePanel(title, detail, state);
  ['stem','cmds','beats','gate'].forEach(id => { $(id).innerHTML = html; wireUnavailablePanel($(id)); });
  const hero = $('gateHeroDecision');
  if (hero) hero.innerHTML = '<b>' + esc(title) + '</b><span>Decisions wait for a verified read.</span>';
  renderGauge(null); renderInspect(null);
}
// radial 270deg gauge of real progress (arcs grown / total) — the gate's evidence dial
function renderGauge(L){
  const wrap = $('gauge'); if (!wrap) return;
  const completed = Math.max(0, Number(L && L.completed) || 0);
  const total = Math.max(0, Number(L && L.total) || 0);
  const pct = total ? Math.min(1, completed / total) : 0;
  const state = total && completed >= total ? 'complete' : completed ? 'active' : 'locked';
  const label = state === 'complete' ? 'Queue clear' : state === 'active' ? 'Evidence growing' : 'Awaiting ledger';
  const r = 46, CIRC = 2 * Math.PI * r, ARC = 0.75;       // 270deg sweep
  const track = N1(ARC * CIRC), tgap = N1(CIRC - ARC * CIRC);
  const val = N1(pct * ARC * CIRC), vgap = N1(CIRC - pct * ARC * CIRC);
  const valCircle = RM
    ? '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + val + ' ' + vgap + '"/>'
    : '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 ' + N1(CIRC) + '">' +
        '<animate attributeName="stroke-dasharray" dur="1s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1" values="0 ' + N1(CIRC) + ';' + val + ' ' + vgap + '"/>' +
      '</circle>';
  wrap.innerHTML =
    '<div class="' + mcClass('gate-orbit', state) + '" data-component="GateOrbitProgress" data-shared-component="OrbitProgress" data-gate-orbit-state="' + esc(state) + '" data-state="' + esc(mcStateKind(state)) + '" data-value="' + Math.round(pct * 100) + '">' +
      '<svg viewBox="0 0 120 126" role="img" aria-label="' + esc(completed + ' of ' + total + ' arcs grown') + '">' +
        '<g transform="rotate(135 60 60)">' +
          '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="rgba(214,255,246,.12)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + track + ' ' + tgap + '"/>' +
          valCircle +
        '</g>' +
        '<circle class="gate-orbit-node" cx="22" cy="94" r="4"/>' +
        '<circle class="gate-orbit-node" cx="60" cy="14" r="4"/>' +
        '<circle class="gate-orbit-node" cx="98" cy="94" r="4"/>' +
        '<text class="gv" x="60" y="60" text-anchor="middle">' + completed + '/' + total + '</text>' +
        '<text class="gl" x="60" y="76" text-anchor="middle">ARCS GROWN</text>' +
      '</svg>' +
      '<div class="gate-orbit-caption">' + mcStateToken(state, label) + '</div>' +
    '</div>';
}
function paint(env){
  CuriousReadBridge.quest(env, QUEST_READ_REVISION);
  QUEST_READ_HELD = false;
  ECOSYSTEM_ENV = env;
  LEDGER = env.ledger;
  CMDDATA = env.commands || null;
  /* Tools scenes re-render on fresh envelope data when the tab is visible (T-019/T-020). */
  cmdsDrawn = false;
  if (scene === 2) renderCommands();
  renderMissionControl(env);
  if (SCENE_PARAM === 'components' || SCENE_PARAM === 'component' || SCENE_PARAM === 'board') renderComponentGallery(env);
  else renderInspect(env);
  renderStory(env); renderGauge(env.ledger); freshness(env);
  GATE_ITEMS = gateItemsFromEnvelope(env);
  const gateSource = '/internal/gate/' + TENANT;
  renderGateHeroDecision(GATE_ITEMS, gateSource);
  $('gate').innerHTML = renderGateQueue(GATE_ITEMS, gateSource);
  loadGateWire($('gate'), gateSource);
}
function setLedgerUnreachableState(){
  FRESHNESS_STATE = { derivedAt:'missing', source:REFRESH_ROUTE, age:null, stale:true, detail:'offline' };
  clearQuestPresentation('ledger unreachable', 'The connection is quiet. Retry or pull down to retry. Retry re-fetches ' + REFRESH_ROUTE + ' and performs no local write.', 'offline');
  markFreshnessChip(REFRESH_ROUTE);
  resetQuestSummary('ledger offline', 'retry fetch');
  $('fresh').textContent = 'offline'; $('fresh').classList.add('stale');
}
function setAuthAccessState(){
  FRESHNESS_STATE = { derivedAt:'missing', source:REFRESH_ROUTE, age:null, stale:true, detail:'auth needed' };
  clearQuestPresentation('authenticated access needed', 'Open Curious through your approved Cloudflare Access session or the Telegram mini app, then retry. This tenant ledger requires an authenticated session before data is shown.', 'auth');
  markFreshnessChip(REFRESH_ROUTE);
  resetQuestSummary('authentication required', 'authorize tenant');
  $('fresh').textContent = 'auth'; $('fresh').classList.add('stale');
}
function setRouteUnavailableState(){
  FRESHNESS_STATE = { derivedAt:'missing', source:REFRESH_ROUTE, age:null, stale:true, detail:'route missing' };
  clearQuestPresentation('route unavailable', 'The requested tenant route is unavailable right now. Retry later or explore the source system.', 'missing');
  markFreshnessChip(REFRESH_ROUTE);
  resetQuestSummary('ledger route unavailable', 'retry fetch');
  $('fresh').textContent = 'missing'; $('fresh').classList.add('stale');
}
function setServiceUnavailableState(){
  FRESHNESS_STATE = { derivedAt:'missing', source:REFRESH_ROUTE, age:null, stale:true, detail:'service down' };
  clearQuestPresentation('service unavailable', 'The service is unavailable. Retry the connection before reviewing work, decisions or proof.', 'error');
  markFreshnessChip(REFRESH_ROUTE);
  resetQuestSummary('service unavailable', 'retry fetch');
  $('fresh').textContent = 'error'; $('fresh').classList.add('stale');
}
function onFetchFailure(){
  setLedgerUnreachableState();
}
function fetchQuestEnvelope(){
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = setTimeout(() => { if (controller) controller.abort(); }, 10000);
  const options = {
    ...(controller ? { signal: controller.signal } : {}),
    headers: initData ? { 'x-telegram-init-data': initData } : {},
  };
  return fetch(REFRESH_ROUTE, options).finally(() => clearTimeout(timeout));
}
function load(){
  const revision = ++QUEST_READ_REVISION;
  CuriousReadBridge.pending(revision);
  return fetchQuestEnvelope().then((r) => {
    if (revision !== QUEST_READ_REVISION) return;
    const status = Number(r && r.status) || 0;
    if (status === 401 || status === 403) {
      setAuthAccessState();
      return;
    }
    if (status === 404) {
      setRouteUnavailableState();
      return;
    }
    if (status >= 500 && status <= 599) {
      setServiceUnavailableState();
      return;
    }
    if (!r.ok && status) {
      setLedgerUnreachableState();
      return;
    }
    return r.json().then((env) => {
      if (revision !== QUEST_READ_REVISION) return;
      if (!env || typeof env !== 'object' || Array.isArray(env)) { setLedgerUnreachableState(); return; }
      if (!shouldPaintEnvelope(env)){
        markStaleRefreshIgnored(env);
        return;
      }
      if (!env.ledger){
        FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'empty ledger' };
        clearQuestPresentation('no ledger yet', 'The garden is unplanted for ' + TENANT + '. No quest rows are rendered until a real ledger arrives.', 'empty');
        markFreshnessChip('missing');
        resetQuestSummary('empty ledger', 'awaiting data');
        $('fresh').textContent = 'empty'; $('fresh').classList.add('stale'); return;
      }
      paint(env);
    });
  }).catch(() => { if (revision === QUEST_READ_REVISION) onFetchFailure(); });
}
function refresh(){ return load(); }
go(START_SCENE, true);
load();
</script>
</body>
</html>`;
