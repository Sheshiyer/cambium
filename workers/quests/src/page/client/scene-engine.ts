// cambium-quests · miniapp page chunk — scene engine: tap + finger-tracked swipe, scene meta, interaction inventory
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
import { MINI_APP_SECTIONS } from '../../mini-app-surface-contract.ts';

const SCENE_TARGET_BY_SCENE = Object.fromEntries(
  MINI_APP_SECTIONS.map((section) => [section.scene, section.target]),
);

export const CLIENT_SCENE_ENGINE = `/* ── scene engine: tap + finger-tracked swipe (axis-locked, momentum, rubber-band) ── */
const track = $('track'), ind = $('ind'), SCN = 5;
let scene = START_SCENE;
const SCENE_TARGET_BY_SCENE = ${JSON.stringify(SCENE_TARGET_BY_SCENE)};
const SCENE_META = [
  { kind:'primary', label:'Mission', target:SCENE_TARGET_BY_SCENE.mission, summary:'Next branch move, gate, and proof cue stay together for founder review.', next:'Open the active mission card or send blocked choices to Gate.', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; decisions stay behind signed actions' },
  { kind:'primary', label:'Gate', target:SCENE_TARGET_BY_SCENE.gate, summary:'Founder decisions stay explicit, reversible, and separated from read-only review.', next:'Review the queued choice, then approve or reroll with confirmation.', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; founder decisions require confirmation' },
  { kind:'primary', label:'Tools', target:SCENE_TARGET_BY_SCENE.tools, summary:'Live operator surfaces stay read-only; waiting handoffs act in-app through signed gate actions.', next:'Open a surface for live counts, or approve a waiting handoff in-app.', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; tool actions remain explicit' },
  { kind:'primary', label:'Story', target:SCENE_TARGET_BY_SCENE.story, summary:'Story rows summarize wins, signals, lessons, and drift after evidence lands.', next:'Open a beat for context or return to Mission, Gate, or Tools.', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; story rows stay evidence-backed' },
  { kind:'inspect', label:'Inspect', source:'tg-miniapp-scenes@v1', target:SCENE_TARGET_BY_SCENE.inspect, refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; proof detail stays inspectable' },
];
$('ptr').dataset.refreshRoute = REFRESH_ROUTE;
$('ptrProof').textContent = 'Pull to refresh updates ' + REFRESH_ROUTE + '; decisions stay behind signed actions.';
const W = () => track.clientWidth || window.innerWidth;
function place(x, animate){
  track.style.transition = (animate && !RM) ? 'transform .5s var(--ease)' : 'none';
  track.style.transform = 'translate3d(' + x + 'px,0,0)';
}
function liveInd(x){ ind.style.transition='none';
  ind.style.transform = 'translateX(' + (100 * Math.min(SCN-1, Math.max(0, -x / W()))) + '%)'; }
function go(i, fromSwipe){
  scene = Math.min(SCN-1, Math.max(0, i));
  place(-scene * W(), true);
  ind.style.transition = RM ? 'none' : 'transform .45s var(--ease)';
  ind.style.transform = 'translateX(' + (100 * scene) + '%)';
  [0,1,2,3,4].forEach(n => { $('tb'+n).classList.toggle('on', n === scene); $('tb'+n).setAttribute && $('tb'+n).setAttribute('aria-selected', n === scene ? 'true' : 'false'); });
  updateSceneBadge();
  if (scene === 1) loadGate();
  if (scene === 2) renderCommands();
  if (!fromSwipe) buzz('light');
}
[0,1,2,3,4].forEach(n => $('tb'+n).onclick = () => go(n));
function updateSceneBadge(){
  const meta = SCENE_META[scene] || SCENE_META[0];
  const badge = $('sceneBadge');
  badge.textContent = meta.label;
  badge.dataset.scene = meta.label.toLowerCase();
  badge.dataset.ecosystemTarget = meta.target;
}
function interactionInventory(){
  const html = [$('mapwrap'), $('cmds'), $('beats'), $('gate'), $('sceneBadge'), $('fresh')]
    .map(el => el ? (el.outerHTML || el.innerHTML || '') : '').join('');
  return {
    sheet: /data-interaction-kind="sheet"|data-live=|data-tapestry=|data-wake=|data-sense=|data-lane=|data-skill=|data-npc=|data-live-proof=|data-policy=|data-decision=|data-social=|data-box=/.test(html),
    signedAction: /data-signed-action-entrypoint=|data-kind="approve"|data-kind="reroll"/.test(html),
    chatCommand: /data-interaction-kind="chat-command"/.test(html),
    readOnly: /data-interaction-kind="read-only"/.test(html),
  };
}
function reducedMotionProofRow(){
  const inv = interactionInventory();
  return '<b>reduced motion proof</b><span data-reduced-motion-proof="1" data-sheet="' + inv.sheet + '" data-signed-action="' + inv.signedAction + '" data-chat-command="' + inv.chatCommand + '" data-read-only="' + inv.readOnly + '">scene state changes remain visible; sheet=' + inv.sheet + ' · signed action=' + inv.signedAction + ' · chat command=' + inv.chatCommand + ' · read-only=' + inv.readOnly + '</span>';
}
function openSceneSheet(){
  const meta = SCENE_META[scene] || SCENE_META[0];
  if (meta.kind === 'inspect') {
    $('sheetBody').innerHTML = '<div class="arc">view details · inspect</div><h2>Inspect</h2>' +
      '<div class="nar">Inspect keeps proof, packet, freshness, and system detail behind the main Mission Control flow.</div>' +
      '<div class="kv"><b>view</b><span>' + esc(meta.source) + '</span><b>target</b><span>' + esc(meta.target) + '</span><b>refresh</b><span>' + esc(meta.refresh) + '</span>' + reducedMotionProofRow() + '</div>';
  } else {
    $('sheetBody').innerHTML = '<div class="arc">mission control · ' + esc(meta.label.toLowerCase()) + '</div><h2>' + esc(meta.label) + '</h2>' +
      '<div class="nar">' + esc(meta.summary) + '</div>' +
      '<div class="kv"><b>summary</b><span>' + esc(meta.summary) + '</span><b>next</b><span>' + esc(meta.next) + '</span><b>refresh</b><span>' + esc(meta.refresh) + '</span></div>';
  }
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
$('sceneBadge').onclick = openSceneSheet;

function isInteractiveSceneTarget(target){
  return Boolean(target && target.closest && target.closest('button,a,input,textarea,select,label,[role="button"],[data-no-scene-drag]'));
}

/* commands panel — the /ts-* co-founder interface.
   4th tuple element: live-data keys open sourced sheets; act/digest open
   chat-command guidance sheets; omitted kind is a read-only command reference. */
`;
