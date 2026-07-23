// cambium-quests · miniapp page chunk — <script> open, Telegram bridge, haptics, MARKS, MC component registry
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_CORE = `<script>
'use strict';
const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TG = window.Telegram && Telegram.WebApp;
const buzz = k => { try { TG && TG.HapticFeedback.impactOccurred(k); } catch(_){} };
const notify = k => { try { TG && TG.HapticFeedback.notificationOccurred(k); } catch(_){} };
if (TG) { TG.ready(); TG.expand(); try { TG.setHeaderColor('#00272B'); TG.setBackgroundColor('#00272B'); } catch(_){} }

const MARKS = {
  complete: '<svg viewBox="0 0 12 12"><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="#E0FF4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  active:   '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3" fill="#E0FF4F"/></svg>',
  locked:   '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="2.4" fill="none" stroke="rgba(214,255,246,.45)" stroke-width="1.4"/></svg>'
};
const MC_COMPONENT_SOURCE_REFS = Object.freeze([
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md',
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/01-component-glyph-state-board.md',
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/02-mission-control-state-stack-mobile.md',
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/03-motion-storyboard-mobile.md'
]);
const MC_COMPONENT_PROPS = Object.freeze({
  OrbitProgress:['value','state','label','showPacketDots','ariaLabel'],
  SignalRail:['state','packetCount','label'],
  PacketFlow:['count','state','mode'],
  KpiPulse:['label','currentState','survival','betterThanSurvival'],
  SelectedHalo:['selected','surface'],
  Motion:['motion','state','reducedMotion']
});
const MC_COMPONENT_REGISTRY = Object.freeze({
  sourceRefs:MC_COMPONENT_SOURCE_REFS,
  propShapes:MC_COMPONENT_PROPS,
  MissionGlyph:['genesis','taste','build','ops','cortex','arc','proof','gate'],
  StateToken:['idle','active','selected','complete','blocked','locked','stale','proof-needed','reduced-motion'],
  OrbitProgress:['idle','active','complete','blocked','stale','proof-needed'],
  SelectedHalo:['branch-chip','mission-node','detail-sheet'],
  SignalRail:['idle','active','blocked','locked'],
  PacketFlow:['rail','texture','packet-bar'],
  BranchArcChip:['selected','active','stale','blocked','locked'],
  MissionCard:['next-mission','branch-sheet'],
  QuestlineTimeline:['seed','packet','proof','launch'],
  ProofList:['proof-needed','blocked','stale'],
  KpiPulse:['survival','better-than-survival'],
  GateActionRow:['review-gate','open-proof'],
  Motion:['staticOrbit','packetDrift','glyphBreathe','warningAttention','reducedMotion']
});
`;
