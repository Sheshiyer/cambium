// cambium-quests · miniapp page chunk — Tools scene: command catalog, availability, sheets, copy affordance
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const SCENE_TOOLS = `let CMDDATA = null;
let TOOL_GROUP_FILTER = 'all';
let TOOL_FOCUS = '';
let TOOL_CONTEXT_BRANCH = '';
const CMDS = [
  ['Act', [
    ['ts-run', '<agent> <task>', 'Assign the next mission step', 'act'],
    ['ts-approve', '<id>', 'Approve a waiting decision', 'act'],
    ['ts-reject', '<id> <reason>', 'Send a decision back with reason', 'act'],
  ]],
  ['Ask', [
    ['ts-status', '', 'Check active arcs, agents, and work health', 'status'],
    ['ts-hermes', '', 'Check timers and service health', 'hermes'],
    ['ts-agents', '', 'Inspect who can take the next mission', 'agents'],
    ['ts-projects', '', 'Review active work tied to branches', 'work'],
    ['ts-agent', '<name>', 'Inspect one agent before dispatch'],
    ['ts-project', '<slug>', 'Inspect one project before action'],
  ]],
  ['Report', [
    ['ts-standup', '', 'Summarize today\\'s mission movement', 'digest'],
    ['ts-digest', '', 'Prepare the founder progress digest', 'digest'],
    ['ts-help', '', 'List available toolbelt commands', 'digest'],
  ]],
  ['Coordinate', [
    ['ts-handoffs', '', 'See decisions waiting on a founder', 'handoffs'],
    ['ts-vault', '<path>', 'Read supporting context by path'],
  ]],
];
const LIVE_CMD_KEYS = { status:1, hermes:1, agents:1, work:1, handoffs:1 };
const LIVE_CMD_NAMES = { status:'ts-status', hermes:'ts-hermes', agents:'ts-agents', work:'ts-projects', handoffs:'ts-handoffs' };
const COMMANDS_BY_NAME = {};
CMDS.forEach(([group, items]) => items.forEach(([name, args, desc, kind]) => {
  COMMANDS_BY_NAME[name] = { group, name, args, desc, kind:kind || 'reference' };
}));
let cmdsDrawn = false;
function toolGroupControls(){
  const groups = ['all'].concat(CMDS.map(([group]) => group));
  return '<div class="tool-context-strip" data-component="ToolGroupSegmentedControl">' + groups.map(group =>
    '<button type="button" class="' + (TOOL_GROUP_FILTER === group ? 'is-selected' : '') + '" data-tool-group="' + esc(group) + '">' + esc(group) + '</button>'
  ).join('') + '</div>';
}
function commandInteraction(kind){
  if (LIVE_CMD_KEYS[kind]) return 'sheet';
  if (kind === 'act' || kind === 'digest') return 'chat-command';
  return 'read-only';
}
function commandSource(kind){
  if (LIVE_CMD_KEYS[kind]) return 'paperclipCommandsData';
  if (kind === 'act' || kind === 'digest') return 'curios.self-chat-command';
  return 'curios.self-command-reference';
}
function commandPrimarySource(kind){
  if (LIVE_CMD_KEYS[kind]) return 'mission-toolbelt-live@v1';
  if (kind === 'act' || kind === 'digest') return 'curios.self-chat-command';
  return 'curios.self-command-reference';
}
function commandUsage(cmd){ return '/' + cmd.name + (cmd.args ? ' ' + cmd.args : ''); }
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
function hasClipboardApi(){
  const nav = globalThis.navigator;
  return !!(nav && nav.clipboard && typeof nav.clipboard.writeText === 'function');
}
async function copyCommandToClipboard(text, node, doneLabel){
  const nav = globalThis.navigator;
  if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') return { ok:false, reason:'clipboard unavailable' };
  await nav.clipboard.writeText(text);
  if (node) node.textContent = doneLabel || 'Copied command text';
  return { ok:true, copied:text };
}
function commandCopyControl(text){
  return hasClipboardApi()
    ? '<div class="gbtns command-copy"><button type="button" data-copy-command="' + esc(text) + '">Copy command text</button></div>'
    : '<div class="kv"><b>command text</b><span>' + esc(text) + '</span><b>copy</b><span>clipboard unavailable; select and copy this read-only command text</span></div>';
}
function wireCommandCopy(text){
  const btn = $('sheetBody').querySelector('[data-copy-command]');
  if (btn) btn.onclick = () => copyCommandToClipboard(text, btn).catch(() => { btn.textContent = 'Copy unavailable'; });
}
function wireToolSheetNav(){
  $('sheetBody').querySelectorAll('[data-tool-audit-link]').forEach(el => el.onclick = () => {
    closeSheet();
    go(4);
    openInspectGroupSheet('tools', toolEnv());
  });
  $('sheetBody').querySelectorAll('[data-tool-back]').forEach(el => el.onclick = () => {
    closeSheet();
    go(el.dataset.toolBack === 'mission' ? 0 : 2);
  });
}
function commandGlyphKind(cmd){
  if (cmd.group === 'Act') return 'gate';
  if (cmd.group === 'Ask') return 'cortex';
  if (cmd.group === 'Report') return 'proof';
  if (cmd.group === 'Coordinate') return 'ops';
  return 'arc';
}
function commandAvailability(cmd){
  const ctx = toolMissionContext();
  const openItems = Array.isArray(toolEnv().openItems) ? toolEnv().openItems.length : GATE_ITEMS.length;
  if (LIVE_CMD_KEYS[cmd.kind]) return CMDDATA ? 'active' : 'stale';
  if (cmd.name === 'ts-approve' || cmd.name === 'ts-reject') return openItems ? 'proof-needed' : 'locked';
  if (cmd.name === 'ts-run') return ctx.mission && ctx.mission.state !== 'blocked' ? 'active' : 'proof-needed';
  if (cmd.kind === 'digest') return ctx.proofRows.length ? 'proof-needed' : 'active';
  if (cmd.kind === 'act') return 'active';
  return 'idle';
}
function commandAvailabilityLabel(state){
  if (state === 'locked') return 'locked';
  if (state === 'blocked') return 'blocked';
  if (state === 'proof-needed') return 'needs proof';
  if (state === 'stale') return 'stale';
  if (state === 'active') return 'usable';
  return 'reference';
}
function commandDisabledReason(cmd, state){
  if (state === 'stale') return 'live command data unavailable; pull to refresh or inspect Tools audit';
  if (state === 'locked') return 'no waiting founder decision is served for this command';
  if (state === 'blocked') return 'blocked until proof resolves';
  if (state === 'proof-needed' && (cmd.name === 'ts-run' || cmd.name === 'ts-approve' || cmd.name === 'ts-reject')) return 'use Gate or Open Proof before acting';
  return '';
}
function commandExpectedReceipt(cmd){
  if (cmd.group === 'Report') return 'digest receipt or proof summary';
  if (cmd.group === 'Coordinate') return 'handoff/status receipt';
  if (cmd.group === 'Act') return 'chat command copied; operator consumes separately';
  if (LIVE_CMD_KEYS[cmd.kind]) return 'live detail sheet';
  return 'read-only command reference';
}
function commandTargetSystem(cmd){
  if (cmd.name === 'ts-hermes') return 'Hermes services';
  if (cmd.name === 'ts-handoffs') return 'Paperclip handoffs';
  if (cmd.name === 'ts-vault') return 'Vault context';
  if (cmd.group === 'Act') return 'curios.self operator chat';
  if (cmd.group === 'Report') return 'founder report';
  return 'Cambium operator context';
}
function recommendedToolName(){
  const ctx = toolMissionContext();
  if (!ctx.branchId || ctx.branchId === 'branch pending') return '';
  if (ctx.blockers.some(row => /gate|approval|founder/i.test(row.label || row.source || ''))) return 'ts-handoffs';
  if (ctx.proofRows.length) return 'ts-standup';
  if (ctx.stale || !CMDDATA) return 'ts-status';
  return 'ts-run';
}
function toolRecommendationCard(){
  const ctx = toolMissionContext();
  const name = recommendedToolName();
  if (!name) return '<section class="tool-recommend is-idle" data-component="ToolRecommendationPanel" data-tool-recommend-state="empty">' +
    mcGlyphSvg('ops', 'idle') +
    '<span><b>No mission recommendation yet</b><small>Tools will suggest a command after branch packets reach Mission.</small></span>' +
  '</section>';
  const cmd = COMMANDS_BY_NAME[name];
  const reason = name === 'ts-handoffs' ? 'Founder decision context is the current blocker.' : name === 'ts-standup' ? 'Proof-needed rows should become a progress receipt.' : name === 'ts-run' ? 'Mission context is ready for assignment.' : 'Refresh status before acting on ' + ctx.branchName + '.';
  return '<section class="tool-recommend" data-component="ToolRecommendationPanel" data-tool-recommend-command="' + esc(name) + '">' +
    mcGlyphSvg(commandGlyphKind(cmd), commandAvailability(cmd)) +
    '<span><b>Recommended next tool</b><small>/' + esc(name) + ' · ' + esc(reason) + '</small></span>' +
    '<button type="button" data-tool-recommend="' + esc(name) + '">Open</button>' +
  '</section>';
}
function toolContextStrip(){
  const ctx = toolMissionContext();
  return '<div class="tool-context-strip" data-component="ToolContextChips">' +
    mcStateToken(ctx.stale ? 'stale' : 'active', ctx.branchName) +
    mcStateToken(ctx.mission.state || 'proof-needed', ctx.mission.gate || 'mission gate') +
    mcStateToken(CMDDATA ? 'active' : 'stale', CMDDATA ? 'live tools' : 'tools stale') +
    '<span>signed decisions stay in Gate</span>' +
  '</div>';
}
function toolRecentStrip(){
  const ctx = toolMissionContext();
  const recents = (ctx.blockers.length ? ['ts-handoffs', 'ts-status', 'ts-standup'] : ctx.proofRows.length ? ['ts-standup', 'ts-status', 'ts-help'] : ['ts-status', 'ts-hermes', 'ts-standup']);
  return '<div class="tool-recent-strip" data-component="ToolRecentStrip" data-derived-from="current-state">' + recents.map(name =>
    '<button type="button" data-tool-recent="' + esc(name) + '">/' + esc(name) + '</button>'
  ).join('') + '</div>';
}
function toolSafetyRow(kind, cmd){
  const label = LIVE_CMD_KEYS[kind] ? 'opens a live detail sheet' : kind === 'act' || kind === 'digest' ? 'copies command text for chat' : 'reference only';
  const expected = cmd ? commandExpectedReceipt(cmd) : label;
  const proof = toolMissionContext().proofRows[0];
  return '<div class="tool-safety-row" data-component="ToolSafetyRow"><b>Safety before syntax</b>: ' + esc(label) + '; expected result: ' + esc(expected) + '; required proof: ' + esc((proof && proof.label) || 'none served') + '. Tools does not send bot messages or mutate Paperclip.</div>';
}
function openCommandCardSheet(name){
  const cmd = COMMANDS_BY_NAME[name];
  if (!cmd) return;
  const interaction = commandInteraction(cmd.kind);
  const source = commandSource(cmd.kind);
  const text = commandUsage(cmd);
  const guidance = interaction === 'chat-command'
    ? 'Type this command in the curios.self bot chat. The mini app only copies command text; it does not send data, write Paperclip, or fabricate chat output.'
    : 'Reference command sheet. Type this command in the curios.self bot chat when you want this inspection.';
  $('sheetBody').innerHTML = '<div class="arc">command · ' + esc(interaction) + '</div><h2>' + esc('/' + cmd.name) + '</h2>' +
    '<div class="nar">' + esc(guidance) + '</div>' +
    toolSafetyRow(cmd.kind, cmd) +
    '<div class="kv"><b>interaction</b><span>' + esc(interaction) + '</span><b>chat syntax</b><span>' + esc(text) + '</span><b>source</b><span>' + esc(source) + '</span><b>card group</b><span>' + esc(cmd.group) + '</span><b>target system</b><span>' + esc(commandTargetSystem(cmd)) + '</span><b>description</b><span>' + esc(cmd.desc) + '</span><b>payload preview</b><span>' + esc(text) + '</span><b>expected receipt</b><span>' + esc(commandExpectedReceipt(cmd)) + '</span><b>mini app writes</b><span>none; copy only, no signed gate endpoint</span><b>signed action button</b><span>not rendered for command sheets</span></div>' +
    '<div class="gbtns"><button type="button" class="detail" data-tool-audit-link="tools">Inspect audit</button><button type="button" class="reroll" data-tool-back="mission">Mission</button></div>' +
    commandCopyControl(text);
  wireCommandCopy(text);
  wireToolSheetNav();
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(interaction === 'chat-command' ? 'medium' : 'light');
}
function renderCommands(){
  if (cmdsDrawn) return; cmdsDrawn = true;
  if (TOOL_FOCUS && COMMANDS_BY_NAME[TOOL_FOCUS]) TOOL_GROUP_FILTER = COMMANDS_BY_NAME[TOOL_FOCUS].group;
  const groups = TOOL_GROUP_FILTER === 'all' ? CMDS : CMDS.filter(([group]) => group === TOOL_GROUP_FILTER);
  $('cmds').innerHTML = toolRecommendationCard() + toolGroupControls() + toolContextStrip() + toolRecentStrip() + groups.map(([group, items]) =>
    '<div class="cmdgrp">' + esc(group) + '</div>' +
    items.map(([name, args, desc, kind]) => {
      const live = kind && LIVE_CMD_KEYS[kind];
      const action = kind === 'act';
      const digest = kind === 'digest';
      const reference = !live && !action && !digest;
      const interaction = commandInteraction(kind || 'reference');
      const source = commandPrimarySource(kind || 'reference');
      const cmd = { group, name, args, desc, kind:kind || 'reference' };
      const state = commandAvailability(cmd);
      const disabledReason = commandDisabledReason(cmd, state);
      const classKind = live ? ' live' : action ? ' act' : reference ? ' ref' : digest ? ' report' : '';
      return '<button type="button" class="' + mcClass('cmd' + classKind, state) + '" data-component="ToolActionCard"' +
        ' data-interaction-kind="' + interaction + '" data-source="' + source + '"' +
        ' data-inspect-target="tools"' +
        ' data-command-kind="' + (kind || 'reference') + '"' +
        ' data-command-name="' + esc(name) + '"' +
        (TOOL_FOCUS === name ? ' data-tool-focus="1"' : '') +
        (disabledReason ? ' data-disabled-reason="' + esc(disabledReason) + '"' : '') +
        (live ? ' data-live="' + kind + '"' : '') + '>' +
        mcGlyphSvg(commandGlyphKind(cmd), state) +
        '<span class="tool-body"><span class="cdesc"><b>Mission effect</b>' + esc(desc) + '</span>' +
          '<span class="tool-syntax"><span class="cname">/' + esc(name) + '</span>' +
          (args ? '<span class="cargs">' + esc(args) + '</span>' : '') + '</span></span>' +
        mcStateToken(state, commandAvailabilityLabel(state)) +
        '<span class="tool-card-meta"><span>' + esc(commandTargetSystem(cmd)) + '</span><span>' + esc(commandExpectedReceipt(cmd)) + '</span></span>' +
        (disabledReason ? '<span class="tool-disabled-reason">' + esc(disabledReason) + ' · Inspect details</span>' : '') +
        '<span class="cgo">›</span>' +
      '</button>';
    }).join('')
  ).join('') +
  '<div class="gnote" style="margin-top:18px">Use Tools to inspect, assign, coordinate, and report from the operator chat.</div>';
  $('cmds').querySelectorAll('[data-tool-group]').forEach(el => el.onclick = () => {
    TOOL_GROUP_FILTER = el.dataset.toolGroup || 'all';
    cmdsDrawn = false;
    renderCommands();
  });
  $('cmds').querySelectorAll('[data-tool-recommend],[data-tool-recent]').forEach(el => el.onclick = () => openCommandCardSheet(el.dataset.toolRecommend || el.dataset.toolRecent));
  $('cmds').querySelectorAll('.cmd').forEach(el => el.onclick = () => el.dataset.live ? openCmdSheet(el.dataset.live) : openCommandCardSheet(el.dataset.commandName));
}
function kvRows(pairs){ return '<div class="kv">' + pairs.map(([k,v]) => '<b>'+esc(k)+'</b><span>'+esc(v)+'</span>').join('') + '</div>'; }
function openCmdSheet(key){
  const d = CMDDATA;
  let title = '', body = '';
  const liveCommandText = '/' + (LIVE_CMD_NAMES[key] || 'ts-status');
  if (!d){ title = 'commands'; body = '<div class="nar">org data unavailable: Paperclip gateway unreachable; gateway was unreachable at the last refresh. Pull-to-refresh only; this sheet does not write local state, call signed gate endpoints, or synthesize command results.</div>'; }
  else if (key === 'status'){
    title = '/ts-status';
    body = kvRows([['source', 'Paperclip command data · paperclipCommandsData'], ['agents', String(d.status.agents)], ['work open', String(d.status.issuesOpen)], ['work done', String(d.status.issuesDone)], ['arcs', d.status.arcs], ['Hermes', d.status.hermes || 'unknown']]);
  } else if (key === 'hermes'){
    title = '/ts-hermes · services';
    body = kvRows([['source', 'Hermes runtime · paperclipCommandsData'], ['service statuses', String((d.services||[]).length)]]) +
      ((d.services||[]).length ? (d.services||[]).map(s => '<div class="li"><div><span class="cname">'+esc(s.name)+'</span> <span class="cargs">'+esc(s.status)+'</span><div class="cdesc">'+esc(s.detail || s.label)+'</div></div></div>').join('') : '<div class="nar">no Hermes service data.</div>');
  } else if (key === 'agents'){
    title = '/ts-agents · ' + (d.agents||[]).length;
    body = kvRows([['source', 'paperclipCommandsData']]) +
      ((d.agents||[]).length ? (d.agents||[]).map(a => '<div class="li"><div><span class="cname">'+esc(a.name)+'</span>'+(a.model?'<span class="cargs">'+esc(a.model)+'</span>':'')+'<div class="cdesc">model · '+esc(a.model || 'missing')+' · source paperclipCommandsData</div></div></div>').join('') : '<div class="nar">no agents.</div>');
  } else if (key === 'work'){
    title = '/ts-projects · active work';
    body = kvRows([['source', 'paperclipCommandsData']]) +
      ((d.work||[]).length ? (d.work||[]).map(w => '<div class="li"><div><span class="cname">'+esc(w.id)+'</span> <span class="cargs">'+esc(w.status)+'</span><div class="cdesc">title '+esc(w.title)+' · owner '+esc(w.who || w.owner || 'missing')+' · source '+esc(w.source || 'paperclipCommandsData')+'</div></div></div>').join('') : '<div class="nar">no active work.</div>');
  } else if (key === 'handoffs'){
    title = '/ts-handoffs · ' + (d.handoffs||[]).length;
    body = kvRows([['source', 'paperclipCommandsData'], ['gate relation', 'handoff rows are review context; signed gate actions stay in the Gate scene']]) +
      ((d.handoffs||[]).length ? (d.handoffs||[]).map(h => '<div class="li"><span class="cname">'+esc(h.id)+'</span> <span class="cargs">'+esc(h.status)+'</span><div class="cdesc">title '+esc(h.title)+' · source '+esc(h.source || 'paperclipCommandsData')+' · gate relation '+esc(h.gateRelation || 'founder gate review context only')+'</div></div>').join('') : '<div class="nar">nothing waiting on you.</div>');
  }
  const cmd = COMMANDS_BY_NAME[LIVE_CMD_NAMES[key] || 'ts-status'] || { group:'Ask', name:LIVE_CMD_NAMES[key] || 'ts-status', args:'', desc:'live command', kind:key };
  $('sheetBody').innerHTML = '<div class="arc">live · derived with the ledger</div><h2>'+esc(title)+'</h2>' + body + toolSafetyRow(key, cmd) + '<div class="gbtns"><button type="button" class="detail" data-tool-audit-link="tools">Inspect audit</button><button type="button" class="reroll" data-tool-back="mission">Mission</button></div>' + commandCopyControl(liveCommandText);
  wireCommandCopy(liveCommandText);
  wireToolSheetNav();
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
`;
