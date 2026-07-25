// cambium-quests · miniapp page chunk — Tools scene: live action surfaces (T-019/T-020 rebuild).
// frozen/05 §4 bans copy-paste command blocks app-wide; frozen/06 §1.4 (T1–T12) rewrites this scene
// into five live operator surfaces (Org status / Services / Agents / Active work / Handoffs), each
// glyph + label ≤4 words + mono count + canonical StateToken (§2.3) + result token on tap (T4).
// Mutating intent lives only on Handoffs: rows act in-app through the Gate signed-action client
// (preflight → POST /api/gate → receipt token + state flip, §2.4/G19) — zero chat commands (T1),
// zero clipboard (T1), zero kv walls (05 §3; command detail moved to Inspect per T4/T9/T10).
// Copy: Suggested panel (T6), context chips minus duplicate span (T7), canonical token subtitles
// (T8), read-only token line (T5/N-06), empty tokens (T11), footer deleted (T12).
// Data contract: docs/architecture/contracts/scenes/tools.json (fixtures: scenes/fixtures/tools.fixture.json).
// Assembly order: page/index.ts.
export const SCENE_TOOLS = `let CMDDATA = null;
let TOOL_FOCUS = '';
let TOOL_CONTEXT_BRANCH = '';
let cmdsDrawn = false;
/* Canonical StateToken subtitles (frozen/06 §2.3) — context-free, same words on every tab. */
const TOOL_TOKEN_LABEL = { complete:'verified', active:'ready', 'proof-needed':'needs proof', blocked:'blocked', stale:'refresh first', locked:'on hold', queued:'awaits operator', selected:'selected', idle:'waiting', receipt:'receipt' };
function toolTokenLabel(state){ return TOOL_TOKEN_LABEL[mcStateKind(state)] || 'waiting'; }
/* The five live action surfaces (frozen/06 T4). CMDS keeps the [group, items] shape so the Inspect
   tools group count (inspect.ts) keeps working until its own rebuild lands. */
const TOOL_SURFACES = [
  { id:'status', label:'Org status', glyph:'cortex' },
  { id:'hermes', label:'Services', glyph:'ops' },
  { id:'agents', label:'Agents', glyph:'build' },
  { id:'work', label:'Active work', glyph:'arc' },
  { id:'handoffs', label:'Handoffs', glyph:'gate' },
];
const CMDS = [['Live', TOOL_SURFACES]];
/* Legacy focus bridge: Mission/Story still set TOOL_FOCUS to retired chat names ('ts-status');
   normalize to a surface id without keeping the retired names in this scene. */
const TOOL_FOCUS_ALIAS = { projects:'work', project:'work', agent:'agents' };
function toolFocusSurface(){
  const raw = String(TOOL_FOCUS || '').replace(/^\\//, '').replace(/^ts-/, '');
  const id = TOOL_FOCUS_ALIAS[raw] || raw;
  return TOOL_SURFACES.some(surface => surface.id === id) ? id : '';
}
function toolEnv(){
  return ECOSYSTEM_ENV || { ledger: LEDGER || { rows: [] } };
}
function toolMissionContext(){
  const env = toolEnv();
  const view = buildMissionControlView(env);
  return {
    branchId:TOOL_CONTEXT_BRANCH || view.selectedBranchId || 'branch pending',
    branchName:view.selectedBranch ? mcText(view.selectedBranch.name || view.selectedBranch.productId, view.selectedBranchId || 'Branch') : 'Branch packets pending',
    mission:view.nextMission || { title:'Mission queue missing', gate:'branch packet', proofRequired:'mission proof requirement missing', dispatchTarget:'inspect', state:'blocked' },
    proofRows:view.proofNeeded || [],
    blockers:view.blockers || [],
    stale:view.stale,
  };
}
function toolClamp(text, max){
  const words = mcText(text, 'detail missing').split(/\\s+/).filter(Boolean);
  return words.length > max ? words.slice(0, max).join(' ') + '…' : words.join(' ');
}
/* frozen/05 §4.1 bans copy affordances app-wide; the Inspect proof summary now renders mono
   values inline, so the clipboard helpers that lived here for it are gone (P2-W3). */
function toolHandoffs(){ return CMDDATA && Array.isArray(CMDDATA.handoffs) ? CMDDATA.handoffs : []; }
function toolSurfaceCount(id){
  const d = CMDDATA;
  if (!d) return '';
  if (id === 'status') return d.status ? String(d.status.agents) + ' agents · ' + String(d.status.issuesOpen) + ' open' : 'status missing';
  if (id === 'hermes') return String((d.services || []).length) + ' services';
  if (id === 'agents') return String((d.agents || []).length) + ' agents';
  if (id === 'work') return String((d.work || []).length) + ' open';
  if (id === 'handoffs') return String(toolHandoffs().length) + ' waiting';
  return '';
}
/* Empty-token lines (frozen/06 T11, ≤ 12 words, flat declaratives). */
function toolSurfaceEmpty(id){
  const d = CMDDATA;
  if (!d) return '';
  if (id === 'status') return d.status ? '' : 'status missing';
  if (id === 'hermes') return (d.services || []).length ? '' : 'no services served';
  if (id === 'agents') return (d.agents || []).length ? '' : 'no agents served';
  if (id === 'work') return (d.work || []).length ? '' : 'no open work served';
  return '';
}
/* Surface state (tools.json states.derivation): stale = commands envelope missing; locked =
   no waiting founder decision; active = live surface with fresh data. */
function toolSurfaceState(id){
  if (!CMDDATA) return 'stale';
  if (id === 'handoffs') return toolHandoffs().length ? 'active' : 'locked';
  return 'active';
}
/* Suggested panel (frozen/06 T6): reason ≤ 6 words, no command syntax; idle → 'no suggestion yet'. */
function toolSuggestion(){
  const ctx = toolMissionContext();
  if (!ctx.branchId || ctx.branchId === 'branch pending') return null;
  if (ctx.blockers.some(row => /gate|approval|founder/i.test(row.label || row.source || ''))) return { surface:'handoffs', reason:'a founder decision blocks this branch' };
  if (ctx.proofRows.length) return { surface:'status', reason:'proof rows need a progress receipt' };
  if (ctx.stale || !CMDDATA) return { surface:'status', reason:'refresh status first' };
  return { surface:'work', reason:'mission ready to assign' };
}
function toolSuggestionPanel(){
  const suggestion = toolSuggestion();
  if (!suggestion) return '<section class="tool-recommend is-idle" data-component="ToolRecommendationPanel" data-tool-recommend-state="empty">' +
    mcGlyphSvg('ops', 'idle') +
    '<span><b>Suggested</b><small>no suggestion yet</small></span>' +
    '<button type="button" data-tool-suggest-mission="1">Open Mission</button>' +
  '</section>';
  const surface = TOOL_SURFACES.find(row => row.id === suggestion.surface) || TOOL_SURFACES[0];
  return '<section class="tool-recommend" data-component="ToolRecommendationPanel" data-tool-recommend-surface="' + esc(surface.id) + '">' +
    mcGlyphSvg(surface.glyph, toolSurfaceState(surface.id)) +
    '<span><b>Suggested</b><small>' + esc(suggestion.reason) + '</small></span>' +
    '<button type="button" data-tool-suggest="' + esc(surface.id) + '">Open</button>' +
  '</section>';
}
/* Context chips (frozen/06 T7): branch · mission gate · tools freshness as canonical tokens;
   the duplicate 'signed decisions stay in Gate' span is covered by the sheet token line (T5). */
function toolContextStrip(){
  const ctx = toolMissionContext();
  const branchState = ctx.stale ? 'stale' : 'active';
  const missionState = mcStateKind(ctx.mission.state || 'proof-needed');
  const toolsState = CMDDATA ? 'active' : 'stale';
  return '<div class="tool-context-strip" data-component="ToolContextChips">' +
    '<span class="tool-context-item"><b>' + esc(toolClamp(ctx.branchName, 2)) + '</b>' + mcStateToken(branchState, toolTokenLabel(branchState)) + '</span>' +
    '<span class="tool-context-item"><b>' + esc(toolClamp(ctx.mission.gate, 2)) + '</b>' + mcStateToken(missionState, toolTokenLabel(missionState)) + '</span>' +
    '<span class="tool-context-item"><b>tools</b>' + mcStateToken(toolsState, toolTokenLabel(toolsState)) + '</span>' +
  '</div>';
}
/* Action surface card (frozen/06 T4): glyph + label ≤ 4 words + mono count + StateToken + chevron.
   State rides icon + color + rail style, never color or text alone (frozen/README). */
function toolSurfaceCard(surface, focus){
  const state = toolSurfaceState(surface.id);
  const kind = mcStateKind(state);
  const count = toolSurfaceCount(surface.id);
  const interaction = kind === 'locked' || kind === 'stale' ? 'read-only' : 'sheet';
  return '<button type="button" class="' + mcClass('cmd live', state) + '" data-component="ToolActionCard"' +
    ' data-interaction-kind="' + interaction + '" data-source="mission-toolbelt-live@v1"' +
    ' data-inspect-target="tools" data-tool-surface="' + esc(surface.id) + '"' +
    (focus === surface.id ? ' data-tool-focus="1"' : '') + '>' +
    mcGlyphSvg(surface.glyph, state) +
    '<span class="tool-body"><span class="cname">' + esc(surface.label) + '</span>' +
      (count ? '<span class="tool-count">' + esc(count) + '</span>' : '') + '</span>' +
    mcStateToken(state, toolTokenLabel(state)) +
    '<span class="cgo">›</span>' +
  '</button>';
}
function renderCommands(){
  cmdsDrawn = true;
  const focus = toolFocusSurface();
  const cmds = $('cmds');
  cmds.innerHTML = toolSuggestionPanel() + toolContextStrip() +
    TOOL_SURFACES.map(surface => toolSurfaceCard(surface, focus)).join('');
  cmds.querySelectorAll('.cmd').forEach(el => el.onclick = () => openToolSurfaceSheet(el.dataset.toolSurface));
  cmds.querySelectorAll('[data-tool-suggest]').forEach(el => el.onclick = () => openToolSurfaceSheet(el.dataset.toolSuggest));
  cmds.querySelectorAll('[data-tool-suggest-mission]').forEach(el => el.onclick = () => go(0));
}
/* Handoff action row (T-019): Approve/Reroll run in-app through the Gate signed-action client
   (toolHandoffAct in client/signed-action.ts) — no chat command ever leaves this device. */
function toolHandoffRow(h, i){
  const status = mcStateKind(h.status || 'proposed');
  return '<div class="tool-handoff-row" data-component="ToolHandoffActionRow" data-tool-handoff-index="' + i + '" data-tool-handoff-id="' + esc(h.id || ('handoff-' + i)) + '">' +
    mcGlyphSvg('gate', status) +
    '<span class="tool-handoff-copy"><b>' + esc(h.title || h.id || 'handoff') + '</b><small>' + esc(h.id || 'id missing') + '</small></span>' +
    '<div class="gbtns gate-actions tool-handoff-actions">' +
      '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="approve" data-tool-act="approve" data-tool-handoff-index="' + i + '">Approve</button>' +
      '<button type="button" class="reroll" data-interaction-kind="signed-action" data-signed-action-entrypoint="reroll" data-tool-act="reroll" data-tool-handoff-index="' + i + '">Reroll</button>' +
    '</div>' +
  '</div>';
}
/* Read-only token line (frozen/06 T5/N-06 teaser): the only safety copy left on this scene. */
function toolSafetyTokenLine(){
  return '<div class="tool-safety-row" data-component="ToolSafetyRow">' + mcStateToken('idle', toolTokenLabel('idle')) + '<span>read-only · signed decisions stay in Gate</span></div>';
}
function toolResultLine(state, text){
  return '<div class="tool-result-line" data-component="ToolResultToken" data-tool-result-state="' + esc(mcStateKind(state)) + '">' + mcStateToken(state, toolTokenLabel(state)) + '<span>' + esc(text) + '</span></div>';
}
/* Surface result sheet (T-020): result feedback token + state flip visible without leaving the
   tab. kv/lists stay in Inspect (T4/T10); empty states are tokens (T11); unreachable = token +
   Retry (T11). Handoffs carry the in-app signed actions (T-019). */
function openToolSurfaceSheet(id){
  const surface = TOOL_SURFACES.find(row => row.id === id) || TOOL_SURFACES[0];
  const state = toolSurfaceState(surface.id);
  let result;
  if (!CMDDATA) {
    result = toolResultLine('stale', 'live data unreachable · pull to refresh');
  } else if (surface.id === 'handoffs') {
    const rows = toolHandoffs();
    result = rows.length
      ? toolResultLine('active', rows.length + ' waiting') + rows.map(toolHandoffRow).join('')
      : toolResultLine('locked', 'no handoffs waiting');
  } else {
    const empty = toolSurfaceEmpty(surface.id);
    result = toolResultLine(state, surface.label + ' · ' + toolSurfaceCount(surface.id)) +
      (empty ? toolResultLine('idle', empty) : '');
  }
  $('sheetBody').innerHTML = '<div class="arc">tools · ' + esc(surface.id) + '</div><h2>' + esc(surface.label) + '</h2>' +
    result + toolSafetyTokenLine() +
    '<div class="gbtns">' +
      (!CMDDATA ? '<button type="button" class="approve" data-tool-retry="' + esc(surface.id) + '">Retry</button>' : '') +
      '<button type="button" class="detail" data-tool-audit-link="tools">Inspect</button>' +
      '<button type="button" class="reroll" data-tool-back="mission">Mission</button>' +
    '</div>';
  wireToolSheet(surface.id);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(CMDDATA ? 'medium' : 'light');
}
/* Legacy hook: Inspect's command-state row still calls openCmdSheet('status') until its rebuild. */
function openCmdSheet(key){ openToolSurfaceSheet(key); }
function wireToolSheet(id){
  $('sheetBody').querySelectorAll('[data-tool-audit-link]').forEach(el => el.onclick = () => {
    closeSheet();
    go(4);
    openInspectGroupSheet('tools', toolEnv());
  });
  $('sheetBody').querySelectorAll('[data-tool-back]').forEach(el => el.onclick = () => {
    closeSheet();
    go(el.dataset.toolBack === 'mission' ? 0 : 2);
  });
  $('sheetBody').querySelectorAll('[data-tool-retry]').forEach(el => el.onclick = () => {
    refresh().then(() => openToolSurfaceSheet(el.dataset.toolRetry || id));
  });
  $('sheetBody').querySelectorAll('[data-tool-act]').forEach(button => button.onclick = () => {
    const index = Number(button.dataset.toolHandoffIndex);
    const card = $('cmds').querySelector('[data-tool-surface="handoffs"]');
    toolHandoffAct(button.dataset.toolAct || 'approve', toolHandoffs()[index] || {}, card);
  });
}
`;
