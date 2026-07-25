// cambium-quests · miniapp page chunk — Story scene, signal rows + PacketFlow rails (T-021 + T-022).
// Spec: frozen/01-component-anatomy.md (state = icon + color + rail style, never color or text alone;
// MissionGlyph per group, StateToken canonical subtitles) · frozen/03-motion-spec.md (packetDrift on the
// single active rail only — max one animated focal point; reducedMotion = static dots, zero translation)
// · frozen/05 + frozen/06 S1–S9 (≤70 words at rest: hero + digest + group/branch chips + max 6 signal
// rows; beat full text leaves the primary surface — cards carry the outcome · proof-cue teaser only)
// · frozen/04 EMPTY panel (dashed circle + glyph, ≤12 words + actions).
// Data contract: docs/architecture/contracts/scenes/story.json (fixtures: scenes/fixtures/story.fixture.json).
// Every row derives from served beats / ActionRequest rows / completed ledger rows — no invented narrative.
// Assembly order: page/index.ts (after scenes/mission.ts, which provides mcSceneClamp + mcSceneTokenLabel).
export const SCENE_STORY = `/* ── story scene — signal rows with state tokens + PacketFlow rails (T-021/T-022) ── */
let STORY_BEATS = [];
let STORY_GROUP_FILTER = 'all';
let STORY_BRANCH_FILTER = 'all';
const STORY_GROUPS = ['Mission wins','New signals','Lessons','Drift'];
/* At-rest row cap (frozen/06 S9): digest + latest change + max 6 signal rows; the remainder stays
   reachable via the group chips. A stale envelope trims the cap first (frozen/06 §4 trim order 1)
   so the stale banner never pushes the tab over its 70-word budget. */
const STORY_ROW_LIMIT = 6;
const STORY_ROW_LIMIT_STALE = 4;
function storyBeatTarget(lane){
  if (lane === 'heartbeat') return 'quine';
  if (lane === 'paperclip') return 'paperclip';
  if (lane === 'forge') return 'operator-skills';
  if (lane === 'action-request') return 'action-requests';
  if (lane === 'noesis') return 'operator-narrative';
  if (lane === 'quest') return 'quest-ledger';
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
/* Signal-row teaser (frozen/06 S2/S3 + N-05): outcome ≤ 2 words + proof cue ≤ 2 words, rendered as
   two spans with a CSS hairline separator so no separator character burns a budget word. Full beat
   text leaves the card; it stays in the beat sheet until Inspect's evidence group absorbs it. */
function storyBeatTeaser(beat, group){
  return {
    outcome: mcSceneClamp(storyBeatOutcome(beat, group), 2),
    proof: mcSceneClamp(storyBeatProofCue(beat, group), 2),
  };
}
function renderStoryTeaserSpans(beat, group){
  const teaser = storyBeatTeaser(beat, group);
  return '<span class="story-teaser-outcome">' + esc(teaser.outcome) + '</span><span class="story-teaser-proof is-' + mcStateKind(storyBeatState(beat)) + '">' + esc(teaser.proof) + '</span>';
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
/* Latest change hero (frozen/06 S4): 'Latest change' + teaser ≤ 8 words, no 'Open branch beat' tail. */
function renderStoryHero(rows){
  if (!rows.length) {
    return '<button type="button" class="story-hero is-empty" data-component="StoryLatestChangeHero" data-interaction-kind="read-only">' +
      mcGlyphSvg('signal', 'dormant') +
      '<span><b>Latest change</b><small>No branch story yet</small></span>' +
    '</button>';
  }
  const latestRow = rows[0];
  const latest = latestRow.beat;
  const group = storyBeatGroup(latest);
  return '<button type="button" class="story-hero" data-component="StoryLatestChangeHero" data-story-hero="' + latestRow.index + '" data-interaction-kind="sheet">' +
    mcGlyphSvg(storyBeatGlyph(group), storyBeatState(latest)) +
    '<span><b>Latest change</b><small class="story-teaser">' + renderStoryTeaserSpans(latest, group) + '</small></span>' +
  '</button>';
}
/* Group filter chips (frozen/06 S1 KEEP): label + mono chartreuse count, BranchArcChip count canon. */
function renderStoryGroupControls(groups, rows){
  const labels = ['all'].concat(groups);
  return '<div class="story-filter-strip" data-component="StoryGroupControls">' + labels.map(label =>
    '<button type="button" class="' + (STORY_GROUP_FILTER === label ? 'is-selected' : '') + '" data-story-filter="' + esc(label) + '">' + esc(label) + ' <span class="mc-branch-count">' + (label === 'all' ? rows.length : rows.filter(row => storyBeatGroup(row.beat) === label).length) + '</span></button>'
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
/* Digest (frozen/06 S1 KEEP): glyph + mono group counts; the counts are the copy. */
function renderStoryDigest(rows){
  const counts = STORY_GROUPS.map(group => [group, rows.filter(row => storyBeatGroup(row.beat) === group).length]);
  const state = storyDigestState(rows);
  return '<button type="button" class="story-hero" data-component="StoryDigestCards" data-story-digest="1" data-story-digest-state="' + esc(state) + '" data-interaction-kind="sheet">' +
    mcGlyphSvg('proof', state) +
    '<span><small>' + counts.map(([group, count]) => group + ' ' + count).join(' · ') + '</small></span>' +
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
/* PacketFlow rails between beats (T-022). Rail grammar mirrors the QuestlineTimeline connector
   canon (frozen/01 + 02 §4): solid chartreuse through the complete→active run, peach only when a
   beat is blocked, dotted when stale, dashed when pending/proof-needed. Dots render inside the
   SignalRail element only — never inside a row's text container. Max one animated focal point
   (frozen/03 rule 6): the first active rail keeps packetDrift; later active rails settle to solid
   complete. Under prefers-reduced-motion mcSignalRail/mcPacketDots emit no data-motion, so the
   same markup renders static rails with static dots (frozen/03 rule 4 canonical fallback). */
function storyRailState(a, b){
  const sa = mcStateKind(storyBeatState(a));
  const sb = mcStateKind(storyBeatState(b));
  if (sa === 'blocked' || sb === 'blocked') return 'blocked';
  if (sa === 'stale' || sb === 'stale') return 'stale';
  const settled = s => s === 'complete' || s === 'active';
  if (settled(sa) && settled(sb)) return sb === 'active' ? 'active' : 'complete';
  if (sa === 'proof-needed' || sb === 'proof-needed') return 'proof-needed';
  return 'idle';
}
function renderStoryPacketRail(a, b, focalUsed){
  let state = storyRailState(a, b);
  if (state === 'active' && focalUsed) state = 'complete';
  const kind = mcStateKind(state);
  return {
    focal: kind === 'active',
    html: '<span class="story-packet-rail" data-component="StoryPacketRail" data-rail-state="' + esc(kind) + '">' + mcSignalRail({ state, packetCount:3 }) + '</span>',
  };
}
/* Signal row (T-021): MissionGlyph per group + evidence teaser (outcome · proof cue) + StateToken
   with the frozen/06 §2.3 canonical subtitle. State rides icon + color + rail style, never alone. */
function renderStorySignalRow(row, group){
  const b = row.beat;
  const i = row.index;
  const lane = b.lane || 'beat';
  const state = storyBeatState(b);
  const context = storyBeatContext(group, lane, b);
  const target = lane === 'action-request' ? storyBeatTarget(lane) : 'operator-narrative';
  const contradiction = /contradict/i.test(String(b.text || ''));
  return '<button type="button" class="' + mcClass('beat story-signal' + (b.noesis ? ' noesis' : ''), state) + '" style="--i:' + Math.min(i, 20) + '" data-component="StoryBeatCard" data-interaction-kind="sheet" data-source="mission-story@v1" data-beat="' + i + '" data-lane="' + esc(lane) + '" data-story-context="' + esc(context) + '" data-ecosystem-target="' + esc(target) + '"' + (contradiction ? ' data-story-warning="contradiction"' : '') + '>' +
    mcGlyphSvg(storyBeatGlyph(group), state) +
    '<span class="story-signal-copy story-teaser">' + renderStoryTeaserSpans(b, group) + '</span>' +
    mcStateToken(state, mcSceneTokenLabel(state)) +
  '</button>';
}
/* Digest sheet (frozen/06 S6): narrative deleted — rows speak; the empty line is KEEP. */
function openStoryDigest(){
  const rows = visibleStoryBeats(STORY_BEATS).slice(0, 12).map(row => {
    const group = storyBeatGroup(row.beat);
    return '<button type="button" class="li" data-story-digest-beat="' + row.index + '"><span class="cname">' + esc(group) + '</span><div class="cdesc">' + esc(row.beat.text || 'story beat') + '</div></button>';
  }).join('');
  $('sheetBody').innerHTML = '<div class="arc">story · digest</div><h2>Story Digest</h2>' + (rows || '<div class="nar">No story beats served.</div>');
  $('sheetBody').querySelectorAll('[data-story-digest-beat]').forEach(el => el.onclick = () => openStoryBeat(+el.dataset.storyDigestBeat));
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
/* Beat sheet (frozen/06 S5 final): full text + state token + nav; the kv wall is deleted — its
   provenance rows are absorbed into Inspect's evidence group (scenes/inspect.ts). The Open Proof
   nav routes straight into that Inspect evidence sheet for this beat. Contradiction reads as the
   blocked StateToken + the Open Proof link, never as a prose warning. */
function openStoryBeat(index){
  const beat = STORY_BEATS[index] || STORY_BEATS[0];
  if (!beat) return;
  const lane = beat.lane || (beat.noesis ? 'noesis' : 'beat');
  const group = storyBeatGroup(beat);
  const state = storyBeatState(beat);
  const context = storyBeatContext(group, lane, beat);
  const beatBranch = storyBeatBranch(beat);
  const branchFocus = beatBranch;
  const paperclipNote = lane === 'paperclip'
    ? '<div class="story-sheet-note">' + mcStateToken('locked', 'on hold') + '<span>paperclip activity stays read-only</span></div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">story beat · ' + esc(group.toLowerCase()) + '</div><h2>Story Beat</h2>' +
    '<div class="nar">' + esc(beat.text || 'story beat text missing') + '</div>' +
    '<div class="story-sheet-tokens">' + mcStateToken(state, mcSceneTokenLabel(state)) + '</div>' +
    paperclipNote +
    '<div class="gbtns"><button type="button" data-story-target="' + esc(context) + '" data-story-branch-context="' + esc(branchFocus) + '">' + esc(context === 'mission' ? 'Open Mission' : context === 'gate' ? 'Open Gate' : context === 'tools' ? 'Open Tools' : 'Open Proof') + '</button>' + (context === 'inspect' ? '' : '<button type="button" class="reroll" data-story-target="inspect">Open Proof</button>') + '</div>';
  $('sheetBody').querySelectorAll('[data-story-target]').forEach(el => el.onclick = () => {
    veil.classList.remove('on'); sheet.classList.remove('on'); sheetState.open = false;
    if (el.dataset.storyTarget === 'mission') MISSION_BRANCH_FOCUS = el.dataset.storyBranchContext || '';
    go(storyContextScene(el.dataset.storyTarget), true);
    if (el.dataset.storyTarget === 'tools') { TOOL_FOCUS = 'ts-status'; cmdsDrawn = false; renderCommands(); }
    /* S5 final: Open Proof lands on the Inspect evidence sheet for this beat (provenance rows live there). */
    if (el.dataset.storyTarget === 'inspect') openInspectEvidenceSheet(ECOSYSTEM_ENV, index);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(lane === 'noesis' || lane === 'paperclip' ? 'medium' : 'light');
}
function storyEnvStale(env){
  /* Compute from the envelope alone — paint() calls freshness(env) after renderStory(env), so the
     FRESHNESS_STATE global still holds the boot value ('no freshness' → stale) on first paint. */
  const minutes = minutesSince(env && env.derivedAt);
  const text = [env && env.freshness && env.freshness.state, env && env.freshness && env.freshness.detail].filter(Boolean).join(' ');
  return minutes === null || minutes > 360 || /stale|expired|old|refresh/i.test(text);
}
/* Stale banner (frozen/06 S7): token-led — stale token + 'story stale' + 'refresh before deciding'. */
function renderStoryStaleBanner(env){
  if (!storyEnvStale(env || {})) return '';
  return '<section class="mission-stale-notice story-stale-notice" data-component="StoryStaleBanner" data-story-stale="1">' + mcStateToken('stale', 'refresh first') + '<b>story stale</b><span>refresh before deciding</span></section>';
}
/* EMPTY panel (frozen/04 + frozen/06 S8): title KEEP, body 'beats land after branch evidence'. */
function renderStoryEmptyState(env){
  return renderStoryStaleBanner(env || {}) + '<div class="state" data-component="StoryEmptyState" data-interaction-kind="read-only" data-source="mission-story@v1" data-ecosystem-target="operator-narrative"><b>No branch story yet.</b><p>beats land after branch evidence</p><div class="gbtns"><button type="button" data-story-empty-action="refresh">Refresh</button><button type="button" data-story-empty-action="mission">Open Mission</button><button type="button" class="reroll" data-story-empty-action="inspect">Open Proof</button></div></div>';
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
  const rowLimit = storyEnvStale(env || {}) ? STORY_ROW_LIMIT_STALE : STORY_ROW_LIMIT;
  const groups = STORY_GROUPS.map(group => ({
    group,
    beats: visibleBeats.filter(row => storyBeatGroup(row.beat) === group),
  })).filter(row => STORY_GROUP_FILTER === 'all' || STORY_GROUP_FILTER === row.group);
  let remaining = rowLimit;
  let focalUsed = false;
  let prevSectionLast = null;
  const sections = [];
  groups.forEach(({ group, beats: groupBeats }) => {
    const slug = esc(group.toLowerCase().replace(/\\s+/g, '-'));
    if (!groupBeats.length) {
      /* Empty lanes only render a panel under an explicit group filter; in the 'all' view the
         digest counts already say the lane is empty (frozen/06 S9 at-rest structure). */
      if (STORY_GROUP_FILTER !== 'all') {
        sections.push('<section class="story-group" data-component="StoryGroup" data-story-group="' + slug + '">' +
          '<div class="cmdgrp">' + esc(group) + '</div><div class="story-group-body"><div class="state" data-story-empty-group="' + esc(group) + '"><b>' + esc(group) + ' is empty.</b><p>nothing in this lane yet</p></div></div></section>');
      }
      return;
    }
    const slice = groupBeats.slice(0, Math.max(0, remaining));
    if (!slice.length) return;
    remaining -= slice.length;
    let body = '';
    slice.forEach((row, rowIndex) => {
      if (rowIndex > 0) {
        const rail = renderStoryPacketRail(slice[rowIndex - 1].beat, row.beat, focalUsed);
        focalUsed = focalUsed || rail.focal;
        body += rail.html;
      }
      body += renderStorySignalRow(row, group);
    });
    /* Inter-section rail: the packet flow continues across group boundaries, so consecutive
       rendered rows always connect — the rail sits between sections, never over text. */
    if (prevSectionLast) {
      const rail = renderStoryPacketRail(prevSectionLast, slice[0].beat, focalUsed);
      focalUsed = focalUsed || rail.focal;
      sections.push(rail.html);
    }
    prevSectionLast = slice[slice.length - 1].beat;
    sections.push('<section class="story-group" data-component="StoryGroup" data-story-group="' + slug + '">' +
      '<div class="cmdgrp">' + esc(group) + '</div><div class="story-group-body">' + body + '</div></section>');
  });
  $('beats').innerHTML = renderStoryHero(visibleBeats) + renderStoryStaleBanner(env) + renderStoryGroupControls(STORY_GROUPS, visibleBeats) + renderStoryBranchFilters(env) + renderStoryDigest(visibleBeats) + renderStoryTimeline(visibleBeats) + (groups.some(row => row.beats.length) ? sections.join('') : '<div class="state"><b>No story beats in this group.</b><p>switch groups or refresh</p></div>');
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
