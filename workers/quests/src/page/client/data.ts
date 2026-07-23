// cambium-quests · miniapp page chunk — data load, gate gauge, boot, </script></body></html>
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_DATA = `/* ── data ── */
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
  ECOSYSTEM_ENV = env;
  LEDGER = env.ledger;
  CMDDATA = env.commands || null;
  renderMissionControl(env);
  if (SCENE_PARAM === 'components' || SCENE_PARAM === 'component' || SCENE_PARAM === 'board') renderComponentGallery(env);
  else renderInspect(env);
  renderStory(env); renderGauge(env.ledger); freshness(env);
}
function load(){
  return fetch(REFRESH_ROUTE).then(r => r.json()).then(env => {
    if (!shouldPaintEnvelope(env)){
      markStaleRefreshIgnored(env);
      return;
    }
    if (!env.ledger){
      ECOSYSTEM_ENV = env;
      LEDGER = null;
      $('stem').innerHTML =
        '<div class="state"><b>no ledger yet</b><p>the garden is unplanted for <strong>' + esc(TENANT) + '</strong>. No quest rows are rendered until a real ledger arrives.</p><code>quine write quests push --tenant ' + esc(TENANT) + '</code></div>';
      FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'empty ledger' };
      markFreshnessChip('missing');
      resetQuestSummary('empty ledger', 'push required');
      $('fresh').textContent = 'empty'; $('fresh').classList.add('stale'); return;
    }
    paint(env);
  }).catch(() => {
    ECOSYSTEM_ENV = null;
    LEDGER = null;
    $('stem').innerHTML =
      '<div class="state"><b>ledger unreachable</b><p>the mycelium is quiet — pull down to retry. Retry re-fetches ' + esc(REFRESH_ROUTE) + ' and performs no local write.</p></div>';
    FRESHNESS_STATE = { derivedAt:'missing', source:REFRESH_ROUTE, age:null, stale:true, detail:'offline' };
    markFreshnessChip(REFRESH_ROUTE);
    resetQuestSummary('ledger offline', 'retry fetch');
    $('fresh').textContent = 'offline'; $('fresh').classList.add('stale');
  });
}
function refresh(){ return load(); }
go(START_SCENE, true);
load();
</script>
</body>
</html>`;
