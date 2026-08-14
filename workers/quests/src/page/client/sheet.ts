// cambium-quests · miniapp page chunk — bottom sheet (quest/ring detail) with drag-to-dismiss
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_SHEET = `/* ── bottom sheet (quest/ring detail) with drag-to-dismiss ── */
const veil = $('veil'), sheet = $('sheet'), sheetBody = $('sheetBody');
const sheetState = { open:false };
let founderOutcomeRequestId = '';
function founderOutcomeRequestIdentity(){
  if (!founderOutcomeRequestId) founderOutcomeRequestId = 'founder-outcome:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 14);
  return founderOutcomeRequestId;
}
function openFounderOutcomeSheet(mode){
  const initial = { screenshotRef:'', widgetEventRef:'', outcome:mode === 'add-proof' ? 'passed' : 'needs-review', note:'' };
  function showMessage(message){
    const status = sheetBody.querySelector('[data-founder-outcome-status]');
    if (!status) return;
    status.textContent = message;
    status.setAttribute('data-founder-outcome-status-state', message ? 'error' : 'idle');
    status.classList.toggle('is-error', !!message);
  }
  function render(values, message){
    sheetBody.innerHTML = '<div class="arc">founder evidence · fitcheck</div><h2>' + (mode === 'add-proof' ? 'Add proof' : 'Report outcome') + '</h2><p class="nar">Submit two receipt references for the observed Shopify widget outcome.</p>' +
      '<label class="founder-outcome-field">Screenshot receipt reference<input type="text" aria-label="Screenshot receipt reference" placeholder="HTTPS URL or opaque receipt reference"></label><label class="founder-outcome-field">Widget-event receipt reference<input type="text" aria-label="Widget-event receipt reference" placeholder="HTTPS URL or opaque receipt reference"></label>' +
      '<label class="founder-outcome-field">Observed outcome<select aria-label="Observed outcome"><option value="passed">passed</option><option value="failed">failed</option><option value="blocked">blocked</option><option value="needs-review">needs-review</option></select></label><label class="founder-outcome-field">Founder note (optional)<textarea aria-label="Founder note (optional)" maxlength="500"></textarea></label>' +
      '<div class="founder-outcome-claim-guard" data-founder-outcome-claim-guard="1"><b>Claim guard</b><span>This records an observed outcome; Gate and D1 decide the transition.</span></div><div class="founder-outcome-status" aria-live="polite" data-founder-outcome-status="1">' + esc(message || '') + '</div><button type="button" class="approve" data-founder-outcome-submit="1">Submit for Gate review</button>';
    const inputs = sheetBody.querySelectorAll('input'), outcome = sheetBody.querySelector('select'), note = sheetBody.querySelector('textarea');
    inputs[0].value = values.screenshotRef; inputs[1].value = values.widgetEventRef; outcome.value = values.outcome; note.value = values.note;
    const submit = sheetBody.querySelector('[data-founder-outcome-submit]');
    function restoreSubmit(){ submit.disabled = false; submit.setAttribute('aria-busy', 'false'); }
    sheetBody._founderOutcomeSubmit = () => {
      const current = { screenshotRef:String(inputs[0].value || '').trim(), widgetEventRef:String(inputs[1].value || '').trim(), outcome:String(outcome.value || 'needs-review'), note:String(note.value || '').trim() };
      if (!current.screenshotRef) { showMessage('Screenshot reference is required'); inputs[0].focus(); return; }
      if (!current.widgetEventRef) { showMessage('Widget-event reference is required'); inputs[1].focus(); return; }
      submit.disabled = true; submit.setAttribute('aria-busy', 'true');
      const payload = { schema:'cambium.founder-outcome-intent.v1', tenantId:'cambium', workObjectId:'sapling:fitcheck', branchId:'fitcheck', missionId:'fitcheck-shopify-qa', questId:'fitcheck-shopify-widget-qa', screenshotRef:current.screenshotRef, widgetEventRef:current.widgetEventRef, outcome:current.outcome, note:current.note, clientRequestId:founderOutcomeRequestIdentity(), initData:initData };
      Promise.resolve(fetch('/api/founder-outcomes/cambium', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) }))
        .then(r => r.json().then(body => ({ ok:r.ok, body }))).then(result => {
          if (!result.ok || !result.body || !result.body.candidate) { restoreSubmit(); showMessage('worker refused · no write'); return; }
          founderOutcomeRequestId = '';
          sheetBody.innerHTML = '<div class="arc">founder evidence · fitcheck</div><h2>Pending Gate</h2><p class="nar">Your observed outcome awaits the existing Gate review.</p><button type="button" class="approve" data-founder-outcome-open-gate="1">Open Gate</button>';
          sheetBody._founderOutcomeOpenGate = () => { closeSheet(); go(1); };
          Promise.resolve(refresh()).then(loadGate);
        }).catch(() => { restoreSubmit(); showMessage('network failure · no write'); });
    };
  }
  render(initial, ''); veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
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
sheetBody.addEventListener('click', e => {
  const submit = closestSheetTarget(e.target, '[data-founder-outcome-submit]');
  if (submit && typeof sheetBody._founderOutcomeSubmit === 'function') { if (e.preventDefault) e.preventDefault(); sheetBody._founderOutcomeSubmit(); return; }
  const gate = closestSheetTarget(e.target, '[data-founder-outcome-open-gate]');
  if (gate && typeof sheetBody._founderOutcomeOpenGate === 'function') { if (e.preventDefault) e.preventDefault(); sheetBody._founderOutcomeOpenGate(); }
});
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
