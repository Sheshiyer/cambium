// cambium-quests · miniapp page chunk — bottom sheet (quest/ring detail) with drag-to-dismiss
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_SHEET = `/* ── bottom sheet (quest/ring detail) with drag-to-dismiss ── */
const veil = $('veil'), sheet = $('sheet'), sheetBody = $('sheetBody');
const sheetState = { open:false };
function openSheet(row){
  const env = ECOSYSTEM_ENV || {};
  const policy = policyCard(env.ledger ? env : { ledger: LEDGER || { rows: [] } });
  const rawPolicy = env.policy || {};
  const nextActionSource = policy.state === 'ready' && rawPolicy.source
    ? rawPolicy.source
    : 'policy gap: ' + (rawPolicy.gap || rawPolicy.detail || (policy.blockers && policy.blockers[0]) || policy.detail || 'next-action recommendation policy missing');
  const nextActionRows = row.status === 'active'
    ? '<b>next action source</b><span>' + esc(nextActionSource) + '</span><b>next action</b><span>' + esc(policy.detail || 'policy action not served') + '</span>'
    : '';
  $('sheetBody').innerHTML =
    '<div class="arc">arc ' + esc(row.arc) + ' · ' + esc(row.id) + '</div>' +
    '<h2>' + esc(row.title) + '</h2>' +
    (row.narration ? '<div class="nar">' + esc(row.narration) + '</div>' : '') +
    '<div class="kv">' +
      '<b>source</b><span>' + esc(questSource(row)) + '</span>' +
      '<b>status</b><span class="status-' + esc(row.status) + '">' + esc(row.status) + '</span>' +
      '<b>arc</b><span>' + esc(row.arc || 'missing') + '</span>' +
      '<b>quest id</b><span>' + esc(row.id || 'missing') + '</span>' +
      '<b>evidence</b><span>' + esc(row.evidence) + '</span>' +
      nextActionRows +
      (row.reveals ? '<b>reveals</b><span>' + esc(row.reveals) + '</span>' : '') +
    '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function questSource(row){
  const env = ECOSYSTEM_ENV || {};
  return row.source || row.origin || (env.ledger && env.ledger.source) || env.source || 'missing';
}
function currentQuestRow(L){
  const rows = L && Array.isArray(L.rows) ? L.rows : [];
  const current = L && L.current;
  if (!current) return activeRow(L || { rows: [] }) || null;
  return rows.find(row => (current.id && row.id === current.id) || (row.arc === current.arc && row.title === current.title))
    || activeRow(L || { rows: [] })
    || current;
}
function currentQuestId(L){
  const row = currentQuestRow(L);
  const current = L && L.current;
  return (row && row.id) || (current && current.id) || 'not served';
}
function openProgressSheet(L){
  $('sheetBody').innerHTML = '<div class="arc">quest progress · quine</div><h2>Quest Progress</h2>' +
    '<div class="nar">Progress is derived from the served quest ledger, not browser-local completion.</div>' +
    '<div class="kv"><b>completed count</b><span>' + esc(L.completed) + '</span><b>total count</b><span>' + esc(L.total) + '</span><b>source</b><span>' + esc(questSource({})) + '</span><b>active quest id</b><span>' + esc(currentQuestId(L)) + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openFrontierSheet(L){
  const row = currentQuestRow(L);
  const current = L && L.current;
  $('sheetBody').innerHTML = '<div class="arc">quest frontier · quine</div><h2>Current Frontier</h2>' +
    '<div class="nar">' + esc(row ? 'The frontier points at the current active ledger row.' : 'No active frontier is currently served by the ledger.') + '</div>' +
    '<div class="kv"><b>current arc</b><span>' + esc((row && row.arc) || (current && current.arc) || 'complete') + '</span><b>quest title</b><span>' + esc((row && row.title) || (current && current.title) || 'no active quest') + '</span><b>evidence</b><span>' + esc((row && row.evidence) || (current && current.evidence) || 'frontier evidence not served') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row ? 'medium' : 'light');
}
function closeSheet(){ veil.classList.remove('on'); sheet.classList.remove('on'); sheetState.open=false;
  sheet.style.transition=''; sheet.style.transform=''; buzz('light'); }
veil.onclick = closeSheet;
let sdrag = null;
function closestSheetTarget(target, selector){
  const node = target && target.nodeType === 3 ? target.parentElement : target;
  return node && node.closest ? node.closest(selector) : null;
}
function isInteractiveSheetTarget(target){
  return !!closestSheetTarget(target, 'button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]');
}
sheet.addEventListener('pointerdown', e => {
  if (isInteractiveSheetTarget(e.target) || (typeof e.button === 'number' && e.button !== 0)) { sdrag = null; return; }
  sdrag = { sy:e.clientY, ly:e.clientY, lt:e.timeStamp, v:0 };
  try{ sheet.setPointerCapture(e.pointerId); }catch(_){} });
sheet.addEventListener('pointermove', e => {
  if (!sdrag) return;
  const dy = e.clientY - sdrag.sy; if (dy < 0) return;
  e.preventDefault();
  sheet.style.transition = 'none';
  sheet.style.transform = 'translateY(' + dy + 'px)';
  sdrag.v = (e.clientY - sdrag.ly) / Math.max(1, e.timeStamp - sdrag.lt);
  sdrag.ly = e.clientY; sdrag.lt = e.timeStamp;
});
function endSheet(e){ if (!sdrag) return; const d = sdrag; sdrag = null;
  const dy = (e ? e.clientY : d.ly) - d.sy;
  sheet.style.transition = 'transform .45s var(--pop)';
  if (dy > 90 || d.v > 0.5) closeSheet();
  else sheet.style.transform = 'translateY(0)';
}
sheet.addEventListener('pointerup', endSheet);
sheet.addEventListener('pointercancel', endSheet);
sheetBody.addEventListener('click', e => {
  const confirm = closestSheetTarget(e.target, '[data-gate-confirm]');
  if (confirm) {
    if (e.preventDefault) e.preventDefault();
    gateAct(confirm);
    return;
  }
  const cancel = closestSheetTarget(e.target, '[data-gate-cancel]');
  if (cancel) {
    if (e.preventDefault) e.preventDefault();
    closeSheet();
    return;
  }
  const refresh = closestSheetTarget(e.target, '[data-gate-result-refresh]');
  if (refresh) {
    if (e.preventDefault) e.preventDefault();
    refresh.textContent = 'Refreshing...';
    loadGate();
  }
});

`;
