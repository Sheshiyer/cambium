// cambium-quests · miniapp page chunk — Story scene: beat cards with per-lane icons
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const SCENE_STORY = `/* ── story scene — cards with per-lane icons ── */
const LANE_ICON = {
  heartbeat: '<svg viewBox="0 0 16 16"><path d="M1 8h3l2-4 3 8 2-4h4"/></svg>',
  paperclip: '<svg viewBox="0 0 16 16"><path d="M5.5 4.5v6a2.5 2.5 0 0 0 5 0V4a1.8 1.8 0 0 0-3.6 0v6.1"/></svg>',
  forge:     '<svg viewBox="0 0 16 16"><path d="M2 11l6-7 6 7"/><path d="M2 11h12"/></svg>',
  noesis:    '<svg viewBox="0 0 16 16"><path d="M8 1.5l5.5 6.5L8 14.5 2.5 8z"/></svg>',
  quest:     '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 6.5-7"/></svg>',
  beat:      '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.6"/></svg>'
};
let STORY_BEATS = [];
let STORY_GROUP_FILTER = 'all';
let STORY_BRANCH_FILTER = 'all';
const STORY_GROUPS = ['Mission wins','New signals','Lessons','Drift'];
function storyBeatTarget(lane){
  if (lane === 'heartbeat') return 'quine';
  if (lane === 'paperclip') return 'paperclip';
  if (lane === 'forge') return 'operator-skills';
  if (lane === 'action-request') return 'action-requests';
  if (lane === 'noesis') return 'operator-narrative';
  if (lane === 'quest') return 'quest-ledger';
  return 'operator-narrative';
}
function storyBeatSource(beat, lane){
  if (beat && beat.source) return beat.source;
  if (lane === 'paperclip') return 'paperclipActivityBeats';
  if (lane === 'quest') return 'quest-ledger';
  if (lane === 'heartbeat') return 'world.log';
  if (lane === 'action-request') return 'cambium-action-requests@v1';
  return 'operator-narrative';
}
function storyLaneLabel(lane, beat){
  if (beat && beat.noesis) return 'Drift';
  if (lane === 'quest') return 'Mission wins';
  if (lane === 'heartbeat' || lane === 'paperclip') return 'New signals';
  if (lane === 'forge') return 'Lessons';
  if (lane === 'action-request') return 'New signals';
  if (lane === 'noesis') return 'Drift';
  return 'New signals';
}
function storyBeatGroup(beat){
  const text = String((beat && beat.text) || '');
  const lane = (beat && beat.lane) || (beat && beat.noesis ? 'noesis' : 'beat');
  const explicit = mcText(beat && (beat.group || beat.storyGroup || beat.kind), '');
  if (/mission|win|complete/i.test(explicit)) return 'Mission wins';
  if (/signal|new/i.test(explicit)) return 'New signals';
  if (/lesson|learn/i.test(explicit)) return 'Lessons';
  if (/drift|stale|blocked|missing|contradict/i.test(explicit)) return 'Drift';
  if (lane === 'forge' && /lesson|learn/i.test(text)) return 'Lessons';
  if ((beat && beat.noesis) || /stale|missing|contradict|blocked|drift/i.test(text)) return 'Drift';
  return storyLaneLabel(lane, beat);
}
function storyBeatState(beat){
  const group = storyBeatGroup(beat);
  if (group === 'Mission wins') return 'complete';
  if (group === 'Drift') return /blocked|contradict/i.test(String((beat && beat.text) || '')) ? 'blocked' : 'stale';
  if (group === 'Lessons') return 'active';
  return mcText(beat && (beat.proof || beat.evidence), '') ? 'active' : 'proof-needed';
}
function storyBeatGlyph(group){
  if (group === 'Mission wins') return 'proof';
  if (group === 'Lessons') return 'cortex';
  if (group === 'Drift') return 'gate';
  return 'arc';
}
function storyBeatBranch(beat){
  return mcText(beat && (beat.branchId || beat.branch || beat.productId || beat.clientName), '');
}
function hasUnassignedStoryBeats(beats){
  return mcList(beats).some(beat => !storyBeatBranch(beat));
}
function storyBeatOutcome(beat, group){
  const text = mcText(beat && (beat.outcome || beat.result || beat.detail), '');
  if (text) return text;
  if (group === 'Mission wins') return 'Mission moved';
  if (group === 'Lessons') return 'Lesson captured';
  if (group === 'Drift') return 'Needs follow-up';
  return 'New signal';
}
function storyBeatProofCue(beat, group){
  if (beat && (beat.proof || beat.evidence)) return mcText(beat.proof || beat.evidence, '');
  if (group === 'Mission wins') return 'Proof ready';
  if (group === 'Drift') return 'Proof needed';
  return 'Review evidence';
}
function storyBeatSourceSummary(beat, lane){
  const source = storyBeatSource(beat, lane);
  if (/action-requests/i.test(source)) return 'ActionRequest';
  if (/paperclip/i.test(source)) return 'Paperclip activity';
  if (/quest|ledger/i.test(source)) return 'Quest ledger';
  if (/world|heartbeat/i.test(source)) return 'World signal';
  return 'Operator narrative';
}
function storyBeatFollowup(beat, group){
  if (beat && beat.followup) return beat.followup;
  if (group === 'Drift') return 'Review the blocker before calling it a win';
  if (group === 'Mission wins') return 'Open Mission with this branch';
  if (group === 'Lessons') return 'Carry the lesson into the branch plan';
  return 'Decide whether this signal changes the next move';
}
function storyBeatContext(group, lane, beat){
  const explicit = mcText(beat && (beat.context || beat.relatedPage || beat.targetPage || beat.actionTarget), '').toLowerCase();
  if (/mission/.test(explicit)) return 'mission';
  if (/gate|approve|decision/.test(explicit)) return 'gate';
  if (/tool|command/.test(explicit)) return 'tools';
  if (/story/.test(explicit)) return 'story';
  if (/inspect|proof|evidence/.test(explicit)) return 'inspect';
  const text = String((beat && beat.text) || '');
  if (/gate|approve|reroll|decision/i.test(text)) return 'gate';
  if (/tool|command|\\/ts-|ts-/i.test(text)) return 'tools';
  if (/proof|evidence/i.test(text) && group !== 'Mission wins') return 'inspect';
  if (group === 'Mission wins') return 'mission';
  if (group === 'Drift') return 'inspect';
  if (lane === 'quest') return 'mission';
  return 'inspect';
}
function storyContextScene(context){
  if (context === 'mission') return 0;
  if (context === 'gate') return 1;
  if (context === 'tools') return 2;
  if (context === 'story') return 3;
  return 4;
}
function renderStoryHero(rows){
  if (!rows.length) {
    return '<button type="button" class="story-hero is-empty" data-component="StoryLatestChangeHero" data-interaction-kind="read-only">' +
      mcGlyphSvg('signal', 'dormant') +
      '<span><b>Latest change</b><small>No branch story yet · switch filters or refresh after evidence lands</small></span>' +
    '</button>';
  }
  const latestRow = rows[0];
  const latest = latestRow.beat;
  const group = storyBeatGroup(latest);
  return '<button type="button" class="story-hero" data-component="StoryLatestChangeHero" data-story-hero="' + latestRow.index + '" data-interaction-kind="sheet">' +
    mcGlyphSvg(storyBeatGlyph(group), storyBeatState(latest)) +
    '<span><b>Latest change</b><small>' + esc(latest.text || 'Story beat text missing') + ' · Open branch beat</small></span>' +
  '</button>';
}
function renderStoryGroupControls(groups, rows){
  const labels = ['all'].concat(groups);
  return '<div class="story-filter-strip" data-component="StoryGroupControls">' + labels.map(label =>
    '<button type="button" class="' + (STORY_GROUP_FILTER === label ? 'is-selected' : '') + '" data-story-filter="' + esc(label) + '">' + esc(label) + ' · ' + (label === 'all' ? rows.length : rows.filter(row => storyBeatGroup(row.beat) === label).length) + '</button>'
  ).join('') + '</div>';
}
function renderStoryTimeline(rows){
  return '<div class="story-timeline" data-component="StoryTimelineRail">' + rows.slice(0, 12).map(row =>
    '<i class="is-' + esc(mcStateKind(storyBeatState(row.beat))) + '"></i>'
  ).join('') + '</div>';
}
function renderStoryBranchFilters(env){
  const branches = branchRows(env || {});
  const hasUnassigned = hasUnassignedStoryBeats(STORY_BEATS);
  const unassignedSelected = hasUnassigned && (STORY_BRANCH_FILTER === 'missing' || STORY_BRANCH_FILTER === 'unassigned');
  const allSelected = STORY_BRANCH_FILTER === 'all' || (!hasUnassigned && (STORY_BRANCH_FILTER === 'missing' || STORY_BRANCH_FILTER === 'unassigned'));
  const unassignedChip = hasUnassigned ? '<button type="button" class="' + (unassignedSelected ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-story-branch-filter="unassigned">unassigned</button>' : '';
  if (!branches.length) {
    return '<div class="story-filter-strip" data-component="StoryBranchFilterChips"><button type="button" class="' + (allSelected ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-story-branch-filter="all">all branches</button>' + unassignedChip + '</div>';
  }
  return '<div class="story-filter-strip" data-component="StoryBranchFilterChips"><button type="button" class="' + (allSelected ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-story-branch-filter="all">all branches</button>' + unassignedChip + branches.slice(0, 5).map(branch => {
    const id = mcText(branch.branchId || branch.productId || branch.name, 'branch');
    const state = mcStateKind(mcBranchStatusText(branch));
    const stateClass = state === 'idle' ? '' : ' is-' + state;
    return '<button type="button" class="' + (STORY_BRANCH_FILTER === id ? 'is-selected mc-selected-halo' : '') + stateClass + '" data-component="BranchArcChip" data-story-branch-filter="' + esc(id) + '" data-story-branch-state="' + esc(state) + '">' + esc(branch.name || branch.branchId || 'branch') + '</button>';
  }
  ).join('') + '</div>';
}
function storyDigestState(rows){
  if (!rows.length) return 'idle';
  if (rows.some(row => storyBeatState(row.beat) === 'blocked')) return 'blocked';
  if (rows.some(row => storyBeatGroup(row.beat) === 'Drift')) return 'stale';
  if (rows.some(row => storyBeatState(row.beat) === 'proof-needed')) return 'proof-needed';
  return 'active';
}
function renderStoryDigest(rows){
  const counts = STORY_GROUPS.map(group => [group, rows.filter(row => storyBeatGroup(row.beat) === group).length]);
  const state = storyDigestState(rows);
  return '<button type="button" class="story-hero" data-component="StoryDigestCards" data-story-digest="1" data-story-digest-state="' + esc(state) + '" data-interaction-kind="sheet">' +
    mcGlyphSvg('proof', state) +
    '<span><b>Digest</b><small>' + counts.map(([group, count]) => group + ' ' + count).join(' · ') + '</small></span>' +
    '<i aria-hidden="true">›</i>' +
  '</button>';
}
function visibleStoryBeats(beats){
  const rows = beats.map((beat, index) => ({ beat, index }));
  if (STORY_BRANCH_FILTER === 'all') return rows;
  if (STORY_BRANCH_FILTER === 'unassigned' || STORY_BRANCH_FILTER === 'missing') {
    const unassignedRows = rows.filter(row => !storyBeatBranch(row.beat));
    return unassignedRows.length ? unassignedRows : rows;
  }
  return rows.filter(row => storyBeatBranch(row.beat) === STORY_BRANCH_FILTER);
}
function storyPacketTrail(beat){
  const group = storyBeatGroup(beat);
  if (!(group === 'Mission wins' || group === 'Drift')) return '';
  const count = group === 'Mission wins' ? 4 : group === 'Drift' ? 2 : 3;
  return '<span data-component="StoryPacketTrail">' + mcPacketDots(count, storyBeatState(beat), { mode:'rail' }) + '</span>';
}
function openStoryDigest(){
  const rows = visibleStoryBeats(STORY_BEATS).slice(0, 12).map(row => {
    const group = storyBeatGroup(row.beat);
    return '<button type="button" class="li" data-story-digest-beat="' + row.index + '"><span class="cname">' + esc(group) + '</span><div class="cdesc">' + esc(row.beat.text || 'story beat') + '</div></button>';
  }).join('');
  $('sheetBody').innerHTML = '<div class="arc">story · digest</div><h2>Story Digest</h2><div class="nar">Digest lists individual beats without hiding blockers.</div>' + (rows || '<div class="nar">No story beats served.</div>');
  $('sheetBody').querySelectorAll('[data-story-digest-beat]').forEach(el => el.onclick = () => openStoryBeat(+el.dataset.storyDigestBeat));
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function openStoryBeat(index){
  const beat = STORY_BEATS[index] || STORY_BEATS[0];
  if (!beat) return;
  const lane = beat.lane || (beat.noesis ? 'noesis' : 'beat');
  const source = storyBeatSource(beat, lane);
  const target = storyBeatTarget(lane);
  const group = storyBeatGroup(beat);
  const context = storyBeatContext(group, lane, beat);
  const beatBranch = storyBeatBranch(beat);
  const branchFocus = beatBranch;
  const warning = /contradict/i.test(String(beat.text || ''))
    ? '<b>warning</b><span>contradiction requires Inspect review before this becomes a win</span>'
    : '';
  const paperclipRows = lane === 'paperclip'
    ? '<b>vault write</b><span>no direct vault write; Paperclip activity is read-only in this sheet</span>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">story beat · ' + esc(group.toLowerCase()) + '</div><h2>Story Beat</h2>' +
    '<div class="nar">' + esc(beat.text || 'story beat text missing') + '</div>' +
    '<div class="kv"><b>group</b><span>' + esc(group) + '</span><b>lane</b><span>' + esc(lane) + '</span><b>mission</b><span>' + esc(branchFocus || 'branch context not served') + '</span><b>outcome</b><span>' + esc(storyBeatOutcome(beat, group)) + '</span><b>proof</b><span>' + esc(storyBeatProofCue(beat, group)) + '</span><b>from</b><span>' + esc(storyBeatSourceSummary(beat, lane)) + '</span><b>text</b><span>' + esc(beat.text || 'missing') + '</span><b>source</b><span>' + esc(source) + '</span><b>proof path</b><span>' + esc(target) + '</span><b>next</b><span>' + esc(storyBeatFollowup(beat, group)) + '</span><b>related page</b><span>' + esc(context) + '</span>' + warning + paperclipRows + '</div>' +
    '<div class="gbtns"><button type="button" data-story-target="' + esc(context) + '" data-story-branch-context="' + esc(branchFocus) + '">' + esc(context === 'mission' ? 'Open Mission' : context === 'gate' ? 'Open Gate' : context === 'tools' ? 'Open Tools' : 'Open Proof') + '</button><button type="button" class="reroll" data-story-target="inspect">Open Proof</button></div>';
  $('sheetBody').querySelectorAll('[data-story-target]').forEach(el => el.onclick = () => {
    veil.classList.remove('on'); sheet.classList.remove('on'); sheetState.open = false;
    if (el.dataset.storyTarget === 'mission') MISSION_BRANCH_FOCUS = el.dataset.storyBranchContext || '';
    go(storyContextScene(el.dataset.storyTarget), true);
    if (el.dataset.storyTarget === 'tools') { TOOL_FOCUS = 'ts-status'; cmdsDrawn = false; renderCommands(); }
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(lane === 'noesis' || lane === 'paperclip' ? 'medium' : 'light');
}
function storyEnvStale(env){
  const minutes = minutesSince(env && env.derivedAt);
  const text = [env && env.freshness && env.freshness.state, env && env.freshness && env.freshness.detail].filter(Boolean).join(' ');
  return FRESHNESS_STATE.stale || minutes === null || minutes > 360 || /stale|expired|old|refresh/i.test(text);
}
function renderStoryStaleBanner(env){
  if (!storyEnvStale(env || {})) return '';
  return '<section class="mission-stale-notice story-stale-notice" data-component="StoryStaleBanner" data-story-stale="1"><b>Last story check is stale.</b><span>Refresh before using these beats for a decision.</span></section>';
}
function renderStoryEmptyState(env){
  return renderStoryStaleBanner(env || {}) + '<div class="state" data-component="StoryEmptyState" data-interaction-kind="read-only" data-source="mission-story@v1" data-ecosystem-target="operator-narrative"><b>No branch story yet.</b><p>Wins, signals, lessons, and drift appear here after a branch has evidence.</p><div class="gbtns"><button type="button" data-story-empty-action="refresh">Refresh</button><button type="button" data-story-empty-action="mission">Open Mission</button><button type="button" class="reroll" data-story-empty-action="inspect">Open Proof</button></div></div>';
}
function actionRequestStoryBeats(env){
  return actionRequestRows(env || {}).map(row => {
    const status = String(row.status || 'proposed');
    const group = status === 'completed' || status === 'consumed'
      ? 'Mission wins'
      : status === 'blocked' || status === 'needs_signed_confirmation'
        ? 'Drift'
        : 'New signals';
    return {
      text:(row.branchLabel || row.projectName || row.branchId || 'Branch') + ' ActionRequest ' + status + ': ' + (row.title || row.id || 'founder choice'),
      lane:'action-request',
      group,
      context:group === 'Mission wins' ? 'inspect' : 'gate',
      branchId:row.branchId || row.projectId || '',
      source:'cambium-action-requests@v1',
      proof:row.evidence || row.summary || row.next || 'ActionRequest proof missing',
      outcome:row.next || row.status || 'founder choice pending',
      detail:row.summary || row.why || '',
      followup:row.next || 'Open Gate for founder choice, then Inspect for proof',
      actionRequestId:row.id,
    };
  });
}
function renderStory(env){
  const served = env.beats && env.beats.length;
  const actionBeats = actionRequestStoryBeats(env || {});
  const beats = served ? env.beats.concat(actionBeats) :
    actionBeats.length ? actionBeats :
      env.ledger.rows.filter(r => r.status === 'complete').map(r => ({ text: r.title + ' — ' + r.evidence, lane: 'quest', noesis: false, source: 'quest-ledger' }));
  STORY_BEATS = beats;
  if (!beats.length) {
    $('beats').innerHTML = renderStoryEmptyState(env);
    $('beats').querySelectorAll('[data-story-empty-action]').forEach(el => el.onclick = () => el.dataset.storyEmptyAction === 'refresh' ? refresh() : go(el.dataset.storyEmptyAction === 'mission' ? 0 : 4));
    return;
  }
  const visibleBeats = visibleStoryBeats(beats);
  const groups = STORY_GROUPS.map(group => ({
    group,
    beats: visibleBeats.filter(row => storyBeatGroup(row.beat) === group),
  })).filter(row => STORY_GROUP_FILTER === 'all' || STORY_GROUP_FILTER === row.group);
  $('beats').innerHTML = renderStoryHero(visibleBeats) + renderStoryStaleBanner(env) + renderStoryGroupControls(STORY_GROUPS, visibleBeats) + renderStoryBranchFilters(env) + renderStoryDigest(visibleBeats) + renderStoryTimeline(visibleBeats) + (groups.some(row => row.beats.length) ? groups.map(({ group, beats: groupBeats }) =>
    '<section class="story-group" data-component="StoryGroup" data-story-group="' + esc(group.toLowerCase().replace(/\\s+/g, '-')) + '">' +
    '<div class="cmdgrp">' + esc(group) + '</div><div class="story-group-body">' + (groupBeats.length ? groupBeats.map(({ beat:b, index:i }) => {
    const lane = b.lane || 'beat';
    const state = storyBeatState(b);
    const context = storyBeatContext(group, lane, b);
    const target = lane === 'action-request' ? storyBeatTarget(lane) : 'operator-narrative';
    const contradiction = /contradict/i.test(String(b.text || ''));
    return '<button type="button" class="' + mcClass('beat' + (b.noesis ? ' noesis' : ''), state) + '" style="--i:' + Math.min(i, 20) + '" data-component="StoryBeatCard" data-interaction-kind="sheet" data-source="mission-story@v1" data-beat="' + i + '" data-lane="' + esc(lane) + '" data-story-context="' + esc(context) + '" data-ecosystem-target="' + esc(target) + '"' + (contradiction ? ' data-story-warning="contradiction"' : '') + '>' +
      '<span class="ico">' + mcGlyphSvg(storyBeatGlyph(group), state) + '</span>' +
      '<span class="lane">' + esc(group) + '</span>' +
      '<b>' + esc(b.text || 'Story beat') + '</b>' +
      '<small>' + esc(storyBeatOutcome(b, group) + ' · ' + storyBeatProofCue(b, group)) + '</small>' +
      storyPacketTrail(b) +
      mcStateToken(state, group === 'Drift' ? 'drift' : group === 'Mission wins' ? 'win' : group === 'Lessons' ? 'lesson' : 'signal') +
    '</button>';
    }).join('') : '<div class="state" data-story-empty-group="' + esc(group) + '"><b>' + esc(group) + ' is empty.</b><p>Nothing in this lane yet. Refresh after branch evidence changes.</p></div>') + '</div></section>'
  ).join('') : '<div class="state"><b>No story beats in this group.</b><p>Switch groups or refresh after new branch evidence lands.</p></div>');
  $('beats').querySelectorAll('[data-story-hero]').forEach(el => el.onclick = () => openStoryBeat(+el.dataset.storyHero));
  $('beats').querySelectorAll('[data-story-digest]').forEach(el => el.onclick = () => openStoryDigest());
  $('beats').querySelectorAll('[data-story-filter]').forEach(el => el.onclick = () => {
    STORY_GROUP_FILTER = el.dataset.storyFilter || 'all';
    renderStory(env);
  });
  $('beats').querySelectorAll('[data-story-branch-filter]').forEach(el => el.onclick = () => {
    STORY_BRANCH_FILTER = el.dataset.storyBranchFilter || 'all';
    renderStory(env);
  });
  $('beats').querySelectorAll('.beat').forEach(el => el.onclick = () => openStoryBeat(+el.dataset.beat));
}

`;
