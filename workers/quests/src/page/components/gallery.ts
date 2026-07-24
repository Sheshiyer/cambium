// cambium-quests · miniapp page chunk — component gallery boards (glyph/state/orbit/mission/motion/legend)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const COMPONENT_GALLERY = `const MC_BOARD_GLYPHS = Object.freeze([
  ['genesis','Genesis','seed star'],
  ['taste','Taste','capsule proof'],
  ['build','Build','triangle scaffold'],
  ['ops','Ops','folded slab'],
  ['cortex','Cortex','radial ring'],
  ['arc','Arc','crescent path'],
  ['proof','Proof','curled receipt'],
  ['gate','Gate','triangle aperture'],
]);
const MC_BOARD_STATES = Object.freeze([
  ['idle','Idle','quiet rail'],
  ['active','Active','current work'],
  ['selected','Selected','focused branch'],
  ['complete','Complete','verified growth'],
  ['blocked','Blocked','hard stop'],
  ['locked','Locked','permission held'],
  ['stale','Stale','old proof'],
  ['reduced-motion','Reduced motion','static equivalent'],
]);
const MC_BOARD_ORBITS = Object.freeze([
  [0,'idle','0'],
  [25,'active','25'],
  [50,'active','50'],
  [75,'proof-needed','75'],
  [100,'complete','100'],
  [36,'blocked','blocked'],
  [18,'stale','stale'],
]);
const MC_BOARD_LEGEND = Object.freeze([
  ['node','Node','branch or proof point'],
  ['rail','Rail','path between points'],
  ['packet','Packet','moving proof unit'],
  ['orbit','Orbit','progress ring'],
  ['active','Active','current work'],
  ['warning','Warning','blocked or proof needed'],
  ['locked','Locked','permission gate'],
  ['stale','Stale','old evidence'],
]);
function mcBoardPanel(title, component, body){
  return '<section class="component-panel" data-component="' + esc(component) + '"><h3>' + esc(title) + '</h3>' + body + '</section>';
}
function renderComponentGlyphStateBoard(){
  return mcBoardPanel('1. Glyphs', 'ComponentGlyphStateBoard',
    '<div class="component-grid component-glyph-grid">' + MC_BOARD_GLYPHS.map(([kind, name, note]) =>
      '<div class="component-glyph-cell" data-component="GlyphAsset" data-glyph-kind="' + esc(kind) + '">' +
        mcGlyphSvg(kind, kind === 'gate' || kind === 'proof' ? 'proof-needed' : 'active') +
        '<span><b>' + esc(name) + '</b><small>' + esc(note) + '</small></span>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentStateBoard(){
  return mcBoardPanel('2. States', 'ComponentStateBoard',
    '<div class="component-grid component-state-grid">' + MC_BOARD_STATES.map(([state, name, note]) =>
      '<div class="component-state-cell" data-component="StateAsset" data-state="' + esc(state) + '">' +
        '<span><b>' + esc(name) + '</b><small>' + esc(note) + '</small></span>' +
        mcStateToken(state, state) +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentOrbitBoard(){
  return mcBoardPanel('3. Orbit Progress', 'ComponentOrbitProgressBoard',
    '<div class="component-grid component-orbit-grid">' + MC_BOARD_ORBITS.map(([value, state, label]) =>
      '<div class="component-frame" data-component="OrbitProgressAsset" data-state="' + esc(state) + '">' +
        mcOrbitProgress({ value, state, label: String(label) }) +
        '<small>' + esc(state) + '</small>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentMissionComponentsBoard(){
  const questline = '<div class="mc-questline" data-component="QuestlineTimeline">' +
    [['genesis','seed','complete'],['ops','packet','active'],['proof','proof','proof-needed'],['gate','launch','locked']].map(([glyph, label, state]) =>
      '<div class="mc-questline-row">' + mcGlyphSvg(glyph, state) + '<b>' + esc(label) + '</b>' + mcStateToken(state, state === 'proof-needed' ? 'proof' : state) + '</div>'
    ).join('') +
  '</div>';
  const proofList = '<div class="mc-proof-list" data-component="ProofList">' +
    '<button type="button" data-mission-proof-row="1">' + mcGlyphSvg('proof', 'proof-needed') + '<span><b>ProofList</b>receipt required before claim</span>' + mcStateToken('proof-needed', 'proof') + '</button>' +
    '<button type="button" data-mission-proof-row="1">' + mcGlyphSvg('build', 'blocked') + '<span><b>Blocked proof</b>missing live route or artifact</span>' + mcStateToken('blocked', 'blocked') + '</button>' +
  '</div>';
  const kpiPulse = mcKpiPulse({ label:'KpiPulse', currentState:'signal depth served', survival:'survival threshold', betterThanSurvival:'better-than-survival evidence' }, 0);
  const gateRow = '<div class="mc-action-row" data-component="GateActionRow">' +
    '<button type="button" data-component="GateAction" data-mission-action="gate">Review Gate</button>' +
    '<button type="button" class="secondary" data-component="ProofAction" data-mission-action="proof">Open Proof</button>' +
  '</div>';
  return mcBoardPanel('4. Mission Components', 'ComponentMissionComponentsBoard',
    '<div class="component-grid component-mission-grid">' +
      '<div class="component-sample component-branch-chip-sample mc-branch-chip is-selected" data-component="BranchArcChip">' + mcGlyphSvg('genesis', 'selected') + '<span class="mc-branch-copy"><b>BranchArcChip</b><small>selected glyph</small></span>' + mcStateToken('selected', 'selected') + '</div>' +
      '<section class="component-sample mc-mission-card" data-component="MissionCard"><div class="mc-card-head"><span>' + mcStateToken('active', 'Next Mission') + '</span>' + mcOrbitProgress({ value: 42, state: 'active', label: '42%' }) + '</div><h3>MissionCard</h3><p>hero branch objective with proof-bound progress.</p></section>' +
      '<div class="component-sample"><div class="component-sample-title">QuestlineTimeline</div>' + questline + '</div>' +
      '<div class="component-sample"><div class="component-sample-title">ProofList</div>' + proofList + '</div>' +
      '<div class="component-sample"><div class="component-sample-title">KpiPulse</div>' + kpiPulse + '</div>' +
      '<div class="component-sample"><div class="component-sample-title">GateActionRow</div>' + gateRow + '</div>' +
    '</div>'
  );
}
function renderComponentMotionBoard(){
  const motions = [
    ['orbitSweep','Orbit Sweep', [mcOrbitProgress({ value: 25, state: 'active', label: '25' }), mcOrbitProgress({ value: 50, state: 'active', label: '50' }), mcOrbitProgress({ value: 75, state: 'proof-needed', label: '75' })]],
    ['packetDrift','Packet Drift', [mcSignalRail({ state: 'idle', packetCount: 4 }), mcSignalRail({ state: 'active', packetCount: 6 }), mcSignalRail({ state: 'blocked', packetCount: 3 })]],
    ['glyphBreathe','Glyph Breathe', [mcGlyphSvg('genesis', 'active', { motion:'glyphBreathe' }), mcGlyphSvg('taste', 'selected'), mcGlyphSvg('gate', 'blocked')]],
    ['warningAttention','Warning Attention', [mcStateToken('proof-needed', 'proof'), mcStateToken('blocked', 'blocked'), mcStateToken('stale', 'stale')]],
    ['reducedMotion','Reduced Motion', [mcGlyphSvg('arc', 'reduced-motion'), mcStateToken('reduced-motion', 'static'), mcOrbitProgress({ value: 50, state: 'reduced-motion', label: 'RM' })]],
  ];
  return mcBoardPanel('5. Motion Primitives', 'ComponentMotionPrimitives',
    '<div class="component-grid component-motion-grid">' + motions.map(([motion, name, frames]) =>
      '<div class="component-frame" data-component="MotionPrimitive" data-motion="' + esc(motion) + '">' +
        '<b>' + esc(name) + '</b><small>' + esc(motion) + '</small>' +
        '<div class="component-motion-frames">' + frames.map(frame => '<span class="component-motion-frame">' + frame + '</span>').join('') + '</div>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentLegendBoard(){
  return mcBoardPanel('6. Legend', 'ComponentLegend',
    '<div class="component-grid component-legend-grid">' + MC_BOARD_LEGEND.map(([key, name, note]) =>
      '<div class="component-legend-item" data-component="LegendAsset" data-legend-kind="' + esc(key) + '">' +
        '<i class="component-legend-node is-' + esc(key) + '"></i>' +
        '<span><b>' + esc(name) + '</b><small>' + esc(note) + '</small></span>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentGallery(env){
  const wrap = $('mapwrap'); if (!wrap) return;
  const badge = $('sceneBadge');
  if (badge) {
    badge.textContent = 'Components';
    badge.dataset.scene = 'components';
    badge.dataset.ecosystemTarget = 'mission-control-components';
  }
  wrap.innerHTML =
    '<section class="component-board" data-component="ComponentGallery" data-source="01-component-glyph-state-board.png" data-fixture="' + esc((env && env.source) || 'unknown') + '">' +
      '<header class="component-board-head" data-component="ComponentBoardHeader"><div><h2>Glyph State Board</h2><p>Runtime extraction of the modular-components reference: glyphs, states, orbit progress, mission samples, motion primitives, and legend assets.</p></div><span>component proof</span></header>' +
      renderComponentGlyphStateBoard() +
      renderComponentStateBoard() +
      renderComponentOrbitBoard() +
      renderComponentMissionComponentsBoard() +
      renderComponentMotionBoard() +
      renderComponentLegendBoard() +
    '</section>';
}
`;
