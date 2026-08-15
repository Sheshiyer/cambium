// cambium-quests · miniapp page chunk — Mission scene, visual-first rebuild (T-015 + T-016).
// Spec: frozen/02-screen-composition.md §1-4 (hero mission card: eyebrow NEXT MISSION mono chartreuse
// caps, bold sans paper-white title, 4-row mono meta grid Owner/Gate/Dispatch/Promotion, right-side
// branch-arc constellation texture, questline timeline INSIDE the card) · frozen/01 QuestlineTimeline
// (4–6 stations, icon + 2-line caption, solid chartreuse behind complete→active, dashed muted past
// the active node; active station = filled core + solid ring + outer dashed orbit w/ satellite dots)
// · frozen/03 (orbitSweep on the active orbit, packetDrift on active rails, max 2 named animations)
// · frozen/06 M1–M12 copy dispositions + frozen/05 ≤90 words for the tab.
// Data contract: docs/architecture/contracts/scenes/mission.json (fixtures: scenes/fixtures/mission.fixture.json).
// Integration seam: legacy mission renderers still ship in scenes/inspect.ts (assembled after this
// chunk, so its function declarations win hoisting). The two globalThis rebinds at the bottom run
// after hoisting and route paint() + selectMissionBranch() to this scene until T-029 integration
// removes the legacy block. Assembly order: page/index.ts.
export const SCENE_MISSION = `/* ── mission scene — visual-first (T-015/T-016) ── */
function resetQuestSummary(text, frontier){
  const prog = $('progress');
  const here = $('here');
  prog.textContent = text;
  here.textContent = frontier;
  prog.onclick = null;
  here.onclick = null;
  delete prog.dataset.interactionKind;
  delete prog.dataset.source;
  delete here.dataset.interactionKind;
  delete here.dataset.source;
}
/* ProofList founder-readable labels (frozen/06 §2.1): served requirement → ≤4-word label.
   Fallback never renders raw requirement text. */
function mcSceneProofLabel(text){
  const t = String(text || '');
  if (/deploy url|preview link/i.test(t)) return 'Deploy URL';
  if (/viewport capture/i.test(t)) return 'Viewport capture';
  if (/readiness/i.test(t)) return 'Readiness receipt';
  if (/device capture|device artifact/i.test(t)) return 'Device capture';
  if (/release sha|final build/i.test(t)) return 'Release SHA';
  if (/telegram auth|initdata/i.test(t)) return 'Founder auth proof';
  if (/gate sign-off|approval record/i.test(t)) return 'Gate sign-off';
  if (/kpi|survival/i.test(t)) return 'KPI proof';
  if (/branch packet/i.test(t)) return 'Branch packet';
  if (/evidence|receipt/i.test(t)) return 'Evidence receipt';
  return 'Proof missing';
}
function mcSceneProofRows(branch, mission){
  const served = mcList(branch && branch.proof);
  const rows = served.length
    ? served.map(row => ({ label:mcSceneProofLabel(row && row.label), state:mcStateKind((row && row.state) || 'proof-needed'), source:'branchStories.proof' }))
    : mcProofNeeded(branch, mission).map(row => ({ label:mcSceneProofLabel(row && row.label), state:mcStateKind(row && row.state) === 'blocked' ? 'blocked' : 'proof-needed', source:'branchStories' }));
  return mcUniqueRows(rows).slice(0, 5);
}
/* Meta/value clamp: mono values stay ≤ 4 words (frozen/05 §2), real truncation ellipsis only. */
function mcSceneClamp(text, max){
  const words = mcText(text, 'detail missing').split(/\\s+/).filter(Boolean);
  return words.length > max ? words.slice(0, max).join(' ') + '…' : words.join(' ');
}
/* StateToken subtitles — frozen/06 §2.3 canonical set, context-free, flat declaratives. */
const MC_SCENE_TOKEN_LABEL = {
  complete:'verified', active:'ready', 'proof-needed':'needs proof', blocked:'blocked',
  stale:'refresh first', locked:'on hold', queued:'awaits operator', selected:'selected',
  idle:'waiting', receipt:'receipt'
};
function mcSceneTokenLabel(state){
  return MC_SCENE_TOKEN_LABEL[mcStateKind(state)] || 'waiting';
}
/* Work kind is source-shaped, not an aesthetic guess. The primary glyph and
   label make Saplings, client Programs, service Programs, and gaps visibly
   distinct before the user opens Inspect. */
function mcSceneWorkVariant(branch){
  const branchKind = mcText(branch && branch.branchKind, '').toLowerCase();
  if (branchKind === 'product') return { id:'sapling', label:'Sapling', glyph:'genesis' };
  if (branchKind === 'client') return { id:'client-program', label:'Client program', glyph:'taste' };
  if (branchKind === 'internal-service') {
    const text = [branch && branch.programKind, branch && branch.role, branch && branch.arcTitle].filter(Boolean).join(' ');
    return { id:'service-program', label:/capability/i.test(text) ? 'Capability program' : 'Operations program', glyph:/capability|cortex/i.test(text) ? 'cortex' : 'ops' };
  }
  return { id:'classification-gap', label:'Classification needed', glyph:'gate' };
}
/* This is a fixed pilot readback, never a branch or transition chooser. */
function mcFounderOutcomeState(env, branch, mission){
  const questId = 'fitcheck-shopify-widget-qa';
  const exact = TENANT === 'cambium' && mcText(branch && branch.branchId, '') === 'fitcheck' &&
    mcText(branch && branch.workObjectId, '') === 'sapling:fitcheck' &&
    mcText(mission && mission.missionId, '') === 'fitcheck-shopify-qa' &&
    mcList(branch && branch.questline).some(row => mcText(row && row.id, '') === questId);
  if (!exact) return { eligible:false };
  const pending = mcList(env && env.goalGraphIntake && env.goalGraphIntake.rows)
    .find(row => mcText(row && row.questId, '') === questId && /^(pending|review_pending)$/i.test(mcText(row && row.status, '')));
  if (pending) return { eligible:true, kind:'pending', outcome:mcText(pending.outcome, 'needs-review') };
  const committed = mcList(env && env.goalGraphOutcomes && env.goalGraphOutcomes.rows)
    .find(row => mcText(row && row.questId, '') === questId);
  if (committed) return { eligible:true, kind:'committed', outcome:mcText(committed.outcome, 'needs-review'), headDigest:mcText(committed.headDigest || (env.goalGraphOutcomes && env.goalGraphOutcomes.headDigest), ''), graphVersion:Number(committed.graphVersion || (env.goalGraphOutcomes && env.goalGraphOutcomes.graphVersion)) || 0 };
  const recovery = mcList(env && env.founderOutcomeRecovery && env.founderOutcomeRecovery.rows)
    .find(row => mcText(row && row.questId, '') === questId && mcText(row && row.status, '') === 'expired');
  return recovery ? { eligible:true, kind:'expired' } : { eligible:true, kind:'ready' };
}
function buildMissionSceneView(env){
  const branchEnv = branchEnvelope(env || {});
  const rows = branchRows(env || {});
  const requested = mcText(MISSION_BRANCH_FOCUS || PARAMS.get('branch'), '');
  const selectedIndex = Math.max(0, rows.findIndex((branch, index) => requested && mcBranchId(branch, index) === requested));
  const branch = rows[selectedIndex] || rows[0] || null;
  const mission = branchActiveMission(branch);
  const promotion = branch && branch.promotion ? branch.promotion : {};
  const controls = mcControls(branch);
  const source = branch && branch.source ? branch.source : {};
  const ledger = env && env.ledger ? env.ledger : {};
  const nextMission = mission ? {
    id:mcText(mission.missionId, 'mission'),
    title:mcText(mission.title, 'Mission title missing'),
    owner:mcText(mission.owner, 'owner missing'),
    gate:mcText(mission.gate, 'gate missing'),
    proofRequired:mcText(mission.proofRequired, 'proof requirement missing'),
    dispatchTarget:mcText(mission.dispatchTarget, 'dispatch target missing'),
    state:mcMissionState(branch, mission),
  } : {
    id:'mission-gap',
    title:'Mission queue missing',
    owner:'operator',
    gate:'branch packet',
    proofRequired:'mission proof requirement missing',
    dispatchTarget:'inspect',
    state:'blocked',
  };
  return {
    source:mcText(branchEnv.source, 'product-branch-packets@v1'),
    stale:mcBranchEnvelopeStale(env || {}, branchEnv),
    staleDetail:mcText(branchEnv.staleReason || (env && env.freshness && env.freshness.detail), 'stale branch packet'),
    selectedBranchId:branch ? mcBranchId(branch, selectedIndex) : requested,
    selectedBranch:branch,
    frontierArc:mcText(branch && branch.arcTitle, 'branch arc'),
    ledgerCompleted:Math.max(0, Number(ledger.completed) || 0),
    ledgerTotal:Math.max(0, Number(ledger.total) || 0),
    branches:rows.slice(0, 12).map((row, index) => {
      const active = branchActiveMission(row);
      const organ = mcOrganMetaForBranch(row, active);
      const rawState = branchCardState(row);
      const stages = mcQuestline(row);
      const variant = mcSceneWorkVariant(row);
      return {
        id:mcBranchId(row, index),
        name:mcText(row && (row.name || row.productId), 'Product Branch'),
        arcTitle:mcText(row && row.arcTitle, 'branch arc'),
        state:organ.neutral ? 'idle' : rawState,
        organ,
        variant,
        nextMission:active ? mcText(active.title, 'Mission title missing') : 'mission queue missing',
        done:stages.filter(stage => stage.state === 'complete').length,
        total:stages.length,
        selected:row === branch,
      };
    }),
    vision:mcText(branch && branch.vision && branch.vision.statement, 'vision statement missing'),
    icp:mcText(branch && branch.icp && branch.icp.primary, 'ICP missing'),
    nextMission,
    questline:branch ? mcQuestline(branch).slice(0, 6) : [{ id:'branch-gap', title:'Branch packet missing', status:'blocked', state:'blocked' }],
    blockers:mcBlockers(env || {}, branch),
    proofNeeded:mcSceneProofRows(branch, mission),
    kpis:mcKpis(branch),
    loops:branch ? mcLoopRows(env || {}, branch, mcBranchId(branch, selectedIndex)) : [],
    promotion:{
      state:mcText(promotion.state, 'proof-only'),
      currentGate:mcText(promotion.currentGate, nextMission.gate || 'proof gate missing'),
      rule:mcText(promotion.rule, 'proof first; no promotion without foldback evidence'),
    },
    activeOrgan:mcOrganMetaForBranch(branch, mission),
    workVariant:mcSceneWorkVariant(branch),
    founderOutcome:mcFounderOutcomeState(env || {}, branch, mission),
    controls,
    inspect:{
      source:mcText(branchEnv.source, 'product-branch-packets@v1'),
      packetFile:mcText(source.packetFile, 'source packet missing'),
      indexFile:mcText(source.indexFile, 'source index missing'),
      schema:mcText(source.schema, 'cambium.product_branch_packet.v1'),
      tenant:mcText(source.tenant, TENANT),
      derivedAt:mcText(env && env.derivedAt, 'derivedAt missing'),
    },
  };
}
/* BranchArcChip (frozen/02 §2): glyph + name (≤2 words) + mono count + state icon.
   State rides icon + color + border style — never color alone; the selected chip carries the halo. */
function renderSceneChipRail(view){
  if (!view.branches.length) return '';
  const variants = [...new Set(view.branches.map(branch => branch.variant.id))];
  const collectionLabel = variants.length === 1 && variants[0] === 'sapling' ? 'Saplings' : 'Work items';
  return '<div class="mc-branch-rail" role="tablist" aria-label="' + esc(collectionLabel) + '" data-horizontal-scroll="branch-rail" data-no-scene-drag="1">' + view.branches.map((branch, index) => {
    const kind = mcStateKind(branch.state);
    const count = branch.total ? '<span class="mc-branch-count">' + branch.done + '/' + branch.total + '</span>' : '';
    return '<button type="button" id="mission-branch-tab-' + index + '" role="tab" aria-selected="' + (branch.selected ? 'true' : 'false') + '" aria-controls="mission-branch-panel" aria-label="' + esc(branch.variant.label + ' · ' + branch.name + ' · ' + kind) + '" tabindex="' + (branch.selected ? '0' : '-1') + '" class="' + mcClass('mc-branch-chip', branch.state, branch.selected ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-work-variant="' + esc(branch.variant.id) + '" data-selected-surface="' + (branch.selected ? 'branch-chip' : 'none') + '" data-mission-branch="' + index + '" data-organ-route="' + esc(branch.organ.glyph) + '" data-no-scene-drag="1" data-interaction-kind="tab" data-source="' + esc(view.source) + '">' +
      mcGlyphSvg(branch.variant.glyph, branch.state) +
      '<span class="mc-branch-copy"><b>' + esc(branch.name) + '</b><small>' + esc(branch.variant.label) + '</small></span>' + count +
      '<i class="mc-branch-state-icon is-' + kind + '" aria-hidden="true">' + (MC_STATE_ICON[kind] || MC_STATE_ICON.idle) + '</i>' +
    '</button>';
  }).join('') + '</div>';
}
/* Branch-arc constellation texture (frozen/02 §3): thin chartreuse arcs, node dots, one filled hub
   with halo ring on the right ~45% of the hero card. Peach re-tint when the mission is blocked. */
function renderSceneConstellation(state){
  const kind = mcStateKind(state);
  const peach = kind === 'blocked';
  const stroke = peach ? 'rgba(255,199,161,.55)' : 'rgba(224,255,79,.5)';
  const hub = peach ? '#FFC7A1' : '#E0FF4F';
  return '<svg class="mc-constellation" viewBox="0 0 120 120" aria-hidden="true">' +
    '<path d="M12 96C34 78 44 60 62 52S98 40 110 22" fill="none" stroke="' + stroke + '" stroke-width="1" opacity=".45"/>' +
    '<path d="M20 108C40 96 62 88 76 70S96 44 104 36" fill="none" stroke="' + stroke + '" stroke-width="1" opacity=".3"/>' +
    '<circle cx="34" cy="78" r="2" fill="' + stroke + '"/>' +
    '<circle cx="62" cy="52" r="2" fill="' + stroke + '"/>' +
    '<circle cx="90" cy="40" r="1.6" fill="' + stroke + '"/>' +
    '<circle cx="76" cy="70" r="6.5" fill="none" stroke="' + stroke + '" stroke-width="1" stroke-dasharray="2.5 3" opacity=".7"/>' +
    '<circle cx="76" cy="70" r="3.4" fill="' + hub + '"/>' +
  '</svg>';
}
/* QuestlineTimeline (T-016, frozen/01 + 02 §4): 4–6 stations, icon + 2-line caption
   (name sans white 1 word / state mono muted 1 word). Connector grammar: solid chartreuse
   through the contiguous complete→active run; dashed muted past it. Active station = filled core +
   dashed SVG orbit ring with 4 satellite dots inside the station box (orbitSweep dash sweep
   when motion is allowed — stroke-dashoffset only, so geometry never inflates scrollWidth). */
function mcSceneStationIcon(kind){
  if (kind === 'active') return '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="6" r="1.9" fill="currentColor"/></svg>';
  return MC_STATE_ICON[kind] || MC_STATE_ICON.idle;
}
/* Station caption name: first word of the served stage title, punctuation-stripped (the reference
   board's stations are single words; full title stays in the title attribute). */
function mcSceneStationName(title){
  const first = mcText(title, 'Stage').split(/\\s+/).filter(Boolean)[0] || 'Stage';
  return first.replace(/[.,;:]+$/,'');
}
function renderSceneTimeline(view){
  const stages = view.questline.slice(0, 6);
  const currentIndex = Math.max(0, stages.findIndex(stage => mcStateKind(stage.state || stage.status) !== 'complete'));
  const stations = stages.map((stage, index) => {
    const kind = mcStateKind(stage.state || stage.status);
    const orbit = kind === 'active'
      ? '<svg class="mc-station-orbit" aria-hidden="true" viewBox="0 0 36 36"' + (RM ? '' : ' data-motion="orbitSweep" data-motion-primitive="orbitSweep"') + '><circle class="mc-station-orbit-arc" cx="18" cy="18" r="16"/><circle class="mc-station-orbit-dot" cx="18" cy="2" r="1.6"/><circle class="mc-station-orbit-dot" cx="34" cy="18" r="1.6"/><circle class="mc-station-orbit-dot" cx="18" cy="34" r="1.6"/><circle class="mc-station-orbit-dot" cx="2" cy="18" r="1.6"/></svg>'
      : '';
    return '<span class="mc-timeline-station" role="listitem" data-questline-stage-state="' + esc(kind) + '"' + (index === currentIndex ? ' aria-current="step"' : '') + '>' +
      '<span class="mc-station is-' + kind + '">' + orbit + '<i class="mc-station-icon" aria-hidden="true">' + mcSceneStationIcon(kind) + '</i></span>' +
      '<span class="mc-timeline-name" title="' + esc(mcText(stage.title, 'Stage')) + '">' + esc(mcSceneStationName(stage.title)) + '</span>' +
      '<span class="mc-timeline-state">' + esc(kind) + '</span>' +
    '</span>';
  });
  let body = '';
  let inRun = true;
  stations.forEach((station, index) => {
    body += station;
    if (index >= stations.length - 1) return;
    const left = mcStateKind(stages[index].state || stages[index].status);
    const right = mcStateKind(stages[index + 1].state || stages[index + 1].status);
    const solid = inRun && (left === 'complete' || left === 'active') && (right === 'complete' || right === 'active');
    if (right !== 'complete' && right !== 'active') inRun = false;
    body += '<span class="mc-connector ' + (solid ? 'is-solid' : 'is-dashed') + '" data-connector-state="' + (solid ? 'active' : 'pending') + '" aria-hidden="true">' + (solid && right === 'active' ? mcPacketDots(2, 'active') : '') + '</span>';
  });
  return '<div class="mc-timeline" role="list" aria-label="Questline stages" data-component="QuestlineTimeline" data-no-scene-drag="1">' + body + '</div>';
}
/* Hero mission card (frozen/02 §3+§4): eyebrow NEXT MISSION, bold sans paper-white title,
   OrbitProgress orbit, 4-row mono meta grid, constellation texture, collapsed why-this-mission
   info sheet (N-02 — body not counted at rest), signal rail, questline timeline inside the card. */
function renderSceneHeroCard(view){
  const mission = view.nextMission;
  const done = view.questline.filter(row => row.state === 'complete').length;
  const total = view.questline.length;
  const progress = total ? Math.round(100 * done / total) : 0;
  const selectedTabIndex = Math.max(0, view.branches.findIndex(branch => branch.selected));
  return '<section id="mission-branch-panel" role="tabpanel" aria-labelledby="mission-branch-tab-' + selectedTabIndex + '" class="' + mcClass('mc-mission-card', mission.state) + '" data-component="MissionCard" data-work-variant="' + esc(view.workVariant.id) + '" data-interaction-kind="sheet" data-source="' + esc(view.source) + '">' +
    renderSceneConstellation(mission.state) +
    '<span class="mc-eyebrow" data-component="MissionCardEyebrow">' + esc(view.workVariant.label) + '</span>' +
    '<span class="mc-next-label">NEXT MISSION</span>' +
    '<div class="mc-card-head"><div><h3 class="mc-card-title">' + esc(mission.title) + '</h3></div>' + mcOrbitProgress({ value:progress, state:mission.state, label:done + '/' + total, ariaLabel:'questline progress ' + done + ' of ' + total + ' · ' + mcStateKind(mission.state) }) + '</div>' +
    '<div class="mc-meta-grid">' +
      '<span class="mc-meta-row"><b>Owner:</b><span>' + esc(mission.owner) + '</span></span>' +
      '<span class="mc-meta-row"><b>Gate:</b><span>' + esc(mission.gate) + '</span></span>' +
      '<span class="mc-meta-row"><b>Dispatch:</b><span>' + esc(mission.dispatchTarget) + '</span></span>' +
      '<span class="mc-meta-row"><b>Promotion:</b><span>' + esc(view.promotion.state) + '</span></span>' +
    '</div>' +
    '<details class="mc-info"><summary>why this mission</summary><p>' + esc(view.vision) + '</p></details>' +
    mcSignalRail({ state:mission.state, packetCount:Math.max(3, view.questline.length) }) +
    renderSceneTimeline(view) +
  '</section>';
}
/* STATE STACK (frozen/02 §5 + M8): selected focus, first blocker folded in (label ≤3 words),
   first proof row, horizon stage. Subtitles are the frozen/06 §2.3 canonical token words for the
   row's true state; right indicator is the state icon (orbit on the proof row). */
function renderSceneStateStack(view){
  const blocker = view.blockers[0] || null;
  const proof = view.proofNeeded[0] || null;
  const horizon = view.questline[view.questline.length - 1] || { title:'Launch', status:'locked', state:'locked' };
  const rows = [
    { glyph:'cortex', state:'selected', title:'Selected', focus:'selected' },
    { glyph:'gate', state:blocker ? blocker.state : 'idle', title:'Blocked by', detail:blocker ? mcSceneClamp(blocker.label, 3) : 'no blockers served', focus:blocker && /proof/i.test(blocker.source || blocker.label || '') ? 'proof' : 'gate' },
    { glyph:'proof', state:proof ? proof.state : 'proof-needed', title:'Proof needed', detail:proof ? mcSceneClamp(proof.label, 3) : 'evidence missing', focus:'proof', orbit:true },
    { glyph:'ops', state:mcStateKind(horizon.state || horizon.status || 'locked'), title:mcSceneStationName(horizon.title), focus:'selected' },
  ];
  return '<div data-component="MissionStateStack"><div class="mc-section-title">State Stack</div><div class="mc-state-stack">' + rows.map(row => {
    const kind = mcStateKind(row.state);
    return '<button type="button" class="' + mcClass('mc-state-row', kind, kind === 'selected' ? 'is-selected mc-selected-halo' : '') + '" data-selected-surface="' + (kind === 'selected' ? 'mission-state-row' : 'none') + '" data-mission-state-action="' + esc(row.focus) + '" data-interaction-kind="sheet">' +
      mcGlyphSvg(row.glyph, kind) +
      '<span><b>' + esc(row.title) + '</b><small>' + esc(row.detail || mcSceneTokenLabel(kind)) + '</small></span>' +
      (row.orbit ? mcOrbitProgress({ value:42, state:'proof-needed', label:'Proof' }) : '<i class="mc-state-row-icon is-' + kind + '" aria-hidden="true">' + (MC_STATE_ICON[kind] || MC_STATE_ICON.idle) + '</i>') +
    '</button>';
  }).join('') + '</div></div>';
}
function renderSceneStaleNotice(view){
  if (!view.stale) return '';
  return '<section class="mission-stale-notice" data-component="MissionStalePacketState" data-mission-stale="1">' + mcStateToken('stale', 'refresh first') + '<span>' + esc(mcSceneClamp(view.staleDetail, 2)) + '</span></section>';
}
/* PROOF NEEDED (frozen/02 §6 + M9): label-only rows (≤4 words, frozen/06 §2.1), dashed-ring
   icon + packet-dot cluster + chevron; detail lives in Inspect. */
function renderSceneProofList(view){
  const rows = view.proofNeeded.length ? view.proofNeeded : [{ label:'Proof missing', state:'proof-needed' }];
  return '<div data-component="ProofList"><div class="mc-section-title">Proof needed</div><div class="mc-proof-list">' + rows.slice(0, 5).map(row => {
    const kind = mcStateKind(row.state);
    return '<button type="button" class="' + mcClass('mc-proof-row', kind) + '" data-mission-proof-row="1" data-interaction-kind="sheet">' +
      '<i class="mc-proof-icon is-' + kind + '" aria-hidden="true">' + (MC_STATE_ICON[kind] || MC_STATE_ICON['proof-needed']) + '</i>' +
      '<span><b>' + esc(row.label) + '</b></span>' +
      mcPacketDots(3, kind) +
      '<i aria-hidden="true">›</i></button>';
  }).join('') + '</div></div>';
}
/* KPI pulse (T-026 + M10): shared KpiPulse metric card — concentric donut badge snapped to the
   frozen 0/25/50/75/100 stops, 2-line mono label, packet bars at the served value. Label ≤3 words
   incl. kind prefix; better line = better · <mono> (≤2-word mono value) when served, else deleted.
   At rest the survival row leads; remaining served KPIs stay reachable in Inspect (06 §4 trim order 1). */
function renderSceneKpis(view){
  const rows = view.kpis.length ? view.kpis.slice(0, 1) : [{ label:'KPI missing', currentState:'not proven', survival:'survival threshold missing' }];
  return '<div data-component="KpiPulse"><div class="mc-section-title">KPIs</div><div class="mc-kpis">' + rows.map((row, index) => {
    const survival = index === 0;
    const base = mcSceneClamp(mcText(row && row.label, 'KPI ' + (index + 1)), 2);
    const title = /^(survival|better)/i.test(base) ? base : (survival ? 'Survival: ' : 'Better: ') + base;
    const detail = survival ? mcText(row && row.currentState, 'not proven') : (row && row.betterThanSurvival && row.betterThanSurvival !== 'better-than-survival threshold missing' ? 'better · ' + mcSceneClamp(row.betterThanSurvival, 2) : '');
    return mcKpiPulse(row, index, { title, detail });
  }).join('') + '</div></div>';
}
function renderSceneActions(view){
  const founder = view.founderOutcome || { eligible:false };
  const disabled = founder.kind === 'pending' ? ' disabled aria-disabled="true"' : '';
  const state = founder.kind === 'pending'
    ? '<section class="mc-founder-outcome" data-founder-outcome-state="pending"><b>Pending Gate</b><small>Outcome · ' + esc(founder.outcome) + '</small><button type="button" data-founder-outcome-open-gate="1">Open Gate</button></section>'
    : founder.kind === 'committed'
      ? '<section class="mc-founder-outcome" data-founder-outcome-state="committed"><b>Outcome · ' + esc(founder.outcome) + '</b><small>Head · ' + esc(founder.headDigest.slice(0, 12)) + ' · v' + founder.graphVersion + '</small></section>'
      : founder.kind === 'expired'
        ? '<section class="mc-founder-outcome" data-founder-outcome-state="expired"><b>Proposal expired</b><button type="button" data-founder-outcome-resubmit="1">Refresh and resubmit</button></section>' : '';
  const founderActions = founder.eligible ? '<div class="mc-founder-outcome-actions"><button type="button" data-founder-outcome-action="add-proof"' + disabled + '>Add proof</button><button type="button" data-founder-outcome-action="report-outcome"' + disabled + '>Report outcome</button></div>' : '';
  return state + founderActions + '<div class="mc-action-row" data-component="GateActionRow">' +
    '<button type="button" data-no-scene-drag="1" data-mission-action="gate" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="product-branches" aria-label="Review current branch gate">Review Gate</button>' +
    '<button type="button" class="secondary" data-no-scene-drag="1" data-mission-action="proof" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="product-branches" aria-label="Open current branch proof">Open Proof</button>' +
  '</div>';
}
/* Suggested tool (M6): chat-syntax deleted; branch status lives in Tools. */
function renderSceneToolLink(view){
  return '<section class="mission-tool-link" data-component="MissionToolLink" data-source="' + esc(view.source) + '">' +
    '<span><b>Suggested tool</b><small>branch status lives in Tools</small></span>' +
    '<button type="button" data-mission-action="tools" data-no-scene-drag="1">Open Tools</button>' +
  '</section>';
}
/* Loop controls (M7): mono cadence token only — cadence · boundary color (≤4 words). Loop
   titles, run modes, and stop rules stay in the Inspect loops sheet ('Open controls'). */
function mcSceneLoopCadence(row){
  const cadence = mcLoopCadence(row);
  if (cadence === 'manual approval required' || cadence === 'manual review') return cadence;
  const words = cadence.split(/\\s+/).filter(Boolean);
  return words.length > 2 ? words.slice(0, 2).join(' ') + '…' : cadence;
}
function renderSceneLoops(view){
  const rows = view.loops && view.loops.length ? view.loops.slice(0, 3) : [];
  if (!rows.length) return '';
  return '<section class="mission-tool-link" data-component="BranchLoopControls" data-ecosystem-target="branch-loops">' +
    '<span><b>Loop controls</b>' + rows.map(row => '<small class="mc-loop-token">' + esc(mcSceneLoopCadence(row) + ' · ' + mcText(row && row.boundaryColor, 'red')) + '</small>').join('') + '</span>' +
    '<button type="button" class="secondary" data-mission-action="loops" data-no-scene-drag="1" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="branch-loops">Open controls</button>' +
  '</section>';
}
/* EMPTY panel (frozen/04 + M12): dashed-circle node icon; title KEEP; body 6 words; Refresh/Inspect. */
function renderSceneEmpty(){
  return '<div class="mission-empty" data-component="MissionEmptyState">' +
    '<i class="mc-empty-orbit" aria-hidden="true">' + MC_STATE_ICON['proof-needed'] + '</i>' +
    '<b>Mission control is waiting for branch packets.</b>' +
    '<p>branch packets have not reached this device</p>' +
    '<div class="mc-action-row" data-component="GateActionRow"><button type="button" data-mission-action="refresh">Refresh</button><button type="button" class="secondary" data-mission-action="inspect">Inspect</button></div>' +
  '</div>';
}
function renderMissionScene(env){
  const stem = $('stem');
  const view = buildMissionSceneView(env);
  stem.classList.add('mission-control');
  if (!view.selectedBranch) {
    stem.innerHTML = renderSceneEmpty();
    resetQuestSummary('branch packets waiting', 'inspect source');
    stem.querySelectorAll('[data-mission-action="refresh"]').forEach(el => el.onclick = () => refresh());
    stem.querySelectorAll('[data-mission-action="inspect"]').forEach(el => el.onclick = () => go(4));
    $('fill').style.width = '0%';
    return;
  }
  stem.innerHTML = [
    renderSceneStaleNotice(view),
    renderSceneChipRail(view),
    renderSceneHeroCard(view),
    renderSceneStateStack(view),
    renderSceneProofList(view),
    renderSceneKpis(view),
    renderSceneActions(view),
    renderSceneToolLink(view),
    renderSceneLoops(view),
  ].join('');
  stem.querySelectorAll('.mc-info summary').forEach(el => el.onclick = event => { if (event && typeof event.stopPropagation === 'function') event.stopPropagation(); });
  bindMissionBranchRailTouch(stem.querySelector('.mc-branch-rail'));
  const branchIndex = Math.max(0, branchRows(env).findIndex(branch => branch === view.selectedBranch));
  const pct = view.questline.length ? Math.round(100 * view.questline.filter(row => row.state === 'complete').length / view.questline.length) : 0;
  $('fill').style.width = pct + '%';
  const prog = $('progress');
  prog.textContent = view.ledgerTotal ? view.ledgerCompleted + '/' + view.ledgerTotal + ' quests' : view.branches.length + ' branch arc' + (view.branches.length === 1 ? '' : 's');
  prog.dataset.interactionKind = 'sheet';
  prog.dataset.source = view.source;
  prog.onclick = () => openBranchMissionSheet(env, branchIndex, -1);
  const here = $('here');
  here.textContent = 'frontier · ' + mcSceneClamp(view.frontierArc, 2);
  here.dataset.interactionKind = 'sheet';
  here.dataset.source = view.source;
  here.onclick = () => openBranchMissionSheet(env, branchIndex, 0);
  const branchTabs = [...stem.querySelectorAll('[data-mission-branch]')];
  branchTabs.forEach((el, index) => {
    el.onclick = () => selectMissionBranch(env, +el.dataset.missionBranch, true);
    el.onkeydown = event => {
      const target = tabKeyTargetIndex(event, index, branchTabs.length);
      if (target === null) return;
      selectMissionBranch(env, +branchTabs[target].dataset.missionBranch, true);
    };
  });
  stem.querySelectorAll('.mc-mission-card').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0));
  stem.querySelectorAll('[data-mission-action="gate"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'gate'));
  stem.querySelectorAll('[data-mission-action="proof"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));
  stem.querySelectorAll('[data-mission-proof-row]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));
  stem.querySelectorAll('[data-mission-state-action]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, el.dataset.missionStateAction === 'selected' ? undefined : el.dataset.missionStateAction));
  stem.querySelectorAll('[data-mission-action="tools"]').forEach(el => el.onclick = () => { TOOL_FOCUS = 'ts-status'; TOOL_CONTEXT_BRANCH = view.selectedBranchId || ''; go(2); cmdsDrawn = false; renderCommands(); });
  stem.querySelectorAll('[data-mission-action="loops"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'loops'));
  stem.querySelectorAll('[data-founder-outcome-action]').forEach(el => el.onclick = () => openFounderOutcomeSheet(el.dataset.founderOutcomeAction));
  stem.querySelectorAll('[data-founder-outcome-open-gate]').forEach(el => el.onclick = () => go(1));
  stem.querySelectorAll('[data-founder-outcome-resubmit]').forEach(el => el.onclick = () => openFounderOutcomeSheet('report-outcome'));
  stem.addEventListener('click', event => {
    const action = event.target && event.target.closest ? event.target.closest('[data-founder-outcome-action]') : null;
    if (action) { if (event.preventDefault) event.preventDefault(); openFounderOutcomeSheet(action.dataset.founderOutcomeAction); return; }
    const gate = event.target && event.target.closest ? event.target.closest('[data-founder-outcome-open-gate]') : null;
    if (gate) { if (event.preventDefault) event.preventDefault(); go(1); return; }
    const resubmit = event.target && event.target.closest ? event.target.closest('[data-founder-outcome-resubmit]') : null;
    if (resubmit) { if (event.preventDefault) event.preventDefault(); openFounderOutcomeSheet('report-outcome'); }
  });
}
/* Integration seam (T-015): legacy mission renderers still ship in scenes/inspect.ts, which is
   assembled after this chunk, so its function declarations win hoisting. These rebinds run after
   hoisting, so paint() and selectMissionBranch() land on this scene. T-029 removes the legacy
   block; the rebinds can go with it. */
globalThis.renderMissionControl = renderMissionScene;
globalThis.buildMissionControlView = buildMissionSceneView;

`;
