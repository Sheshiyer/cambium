// cambium-quests · miniapp page chunk — esc + state-kind + frozen shared component builders (T-013/T-014/T-026)
// Spec: frozen/01-component-anatomy.md (MissionGlyph 8 variants, StateToken 8 states, OrbitProgress,
// SignalRail, PacketFlow, KpiPulse) + frozen/03-motion-spec.md (orbitSweep, packetDrift, glyphBreathe,
// warningAttention, reducedMotion) + frozen/04-tokens-and-atlas.md (peach #FFC7A1 = blocked only;
// dotted-ring gauges at 0/25/50/75/100 — solid chartreuse arc grows clockwise over the dotted track).
// `proof-needed` is the runtime alias for the PENDING (dashed mint ring) treatment — not a 9th state.
// Backward-compatible builder signatures: mcGlyphSvg(kind, state, opts), mcStateToken(state, label),
// mcPacketDots(count, state, opts), mcOrbitProgress(opts), mcSignalRail(opts), mcKpiBars(progress, state),
// mcKpiPulse(row, index, opts), mcKpiDonut(opts), mcKpiDonutStop(value). Assembly order: page/index.ts.
export const COMPONENT_MISSION_CONTROL = `const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mcStateKind(raw){
  const state = String(raw || '').toLowerCase();
  if (/reduced/.test(state)) return 'reduced-motion';
  if (/selected|focus/.test(state)) return 'selected';
  if (/ready-for-review|external-wait|proposed|pending-review/.test(state)) return 'proof-needed';
  if (/approved/.test(state)) return 'active';
  if (/verified|complete|superseded|ready|done/.test(state)) return 'complete';
  if (/stale/.test(state)) return 'stale';
  if (/blocked|warning|gap|missing/.test(state)) return 'blocked';
  if (/proof|review|pending/.test(state)) return 'proof-needed';
  if (/active|current|queued|running/.test(state)) return 'active';
  if (/locked|disabled/.test(state)) return 'locked';
  return 'idle';
}
function mcClass(base, state, extra){
  const kind = mcStateKind(state);
  return [base, 'is-' + kind, extra || ''].filter(Boolean).join(' ');
}
/* StateToken icon atlas — state is icon + color + ring/dash style, never color alone (frozen/01). */
const MC_STATE_ICON = {
  'idle':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.4" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".65"/></svg>',
  'active':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="17 6" stroke-linecap="round" transform="rotate(-90 6 6)"/><circle cx="6" cy="6" r="1.3" fill="currentColor"/></svg>',
  'selected':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.7" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  'complete':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.8 6.2 5.4 7.8 8.4 4.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'blocked':'<svg viewBox="0 0 12 12"><path d="M6 1.7 10.9 9.9H1.1Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 4.5v2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="8.4" r=".7" fill="currentColor"/></svg>',
  'locked':'<svg viewBox="0 0 12 12"><rect x="2.6" y="5.4" width="6.8" height="4.8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.2 5.4V4a1.8 1.8 0 0 1 3.6 0v1.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  'stale':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.1" stroke-dasharray="1.2 2.1" opacity=".7"/></svg>',
  'proof-needed':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 2.2"/></svg>',
  'reduced-motion':'<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'
};
function mcGlyphSvg(kind, state, opts){
  const glyph = MC_COMPONENT_REGISTRY.MissionGlyph.includes(kind) ? kind : 'arc';
  const tone = mcStateKind(state);
  const motion = opts && opts.motion === 'glyphBreathe' && tone === 'active' && !RM ? ' data-motion="glyphBreathe" data-motion-primitive="glyphBreathe"' : '';
  return '<span class="' + mcClass('mc-glyph', tone) + '" data-component="MissionGlyph" data-glyph-kind="' + esc(glyph) + '" data-state="' + esc(tone) + '"' + motion + ' aria-hidden="true">' + MC_GLYPH_SVG[glyph] + '</span>';
}
function mcStateToken(state, label){
  const kind = mcStateKind(state);
  const icon = MC_STATE_ICON[kind] || MC_STATE_ICON.idle;
  return '<span class="' + mcClass('mc-state-token', kind) + '" data-component="StateToken" data-state="' + esc(kind) + '" aria-label="state: ' + esc(label || kind) + '"><i class="mc-token-icon" aria-hidden="true">' + icon + '</i><span class="mc-token-label">' + esc(label || kind) + '</span></span>';
}
function mcPacketDots(count, state, opts){
  const kind = mcStateKind(state);
  const n = Math.max(1, Math.min(7, Number(count) || 1));
  const mode = (opts && opts.mode) || 'rail';
  const motion = kind === 'active' && !RM ? ' data-motion="packetDrift" data-motion-primitive="packetDrift"' : '';
  return '<span class="' + mcClass('mc-packet-dots', kind) + '" data-component="PacketFlow" data-state="' + esc(kind) + '" data-packet-count="' + n + '" data-packet-mode="' + esc(mode) + '"' + motion + ' aria-hidden="true">' + Array.from({ length:n }, () => '<i class="mc-packet"></i>').join('') + '</span>';
}
/* OrbitProgress — dotted mint track + solid chartreuse arc clockwise from 12 o'clock + 4 cardinal nodes.
   blocked = peach dashed track, no fill, peach warning triangle centered; stale = faint dashed track, no fill. */
function mcOrbitProgress(opts){
  const value = Math.max(0, Math.min(100, Number(opts && opts.value) || 0));
  const label = opts && opts.label ? opts.label : value + '%';
  const kind = mcStateKind(opts && opts.state);
  const noFill = kind === 'blocked' || kind === 'stale' || kind === 'reduced-motion';
  const offset = 100 - (noFill ? 0 : value);
  const packets = opts && opts.showPacketDots && kind !== 'reduced-motion' ? mcPacketDots(opts.packetCount || 3, kind, { mode:'orbit' }) : '';
  const aria = (opts && opts.ariaLabel) || ('progress ' + label + ' · ' + kind);
  const motion = kind === 'active' && !RM ? ' data-motion="orbitSweep" data-motion-primitive="orbitSweep"' : '';
  const warning = kind === 'blocked'
    ? '<path class="mc-orbit-warning" d="M32 20.5 41 35.5H23Z" stroke-width="2" stroke-linejoin="round"/><path class="mc-orbit-warning" d="M32 26v3.8" stroke-width="2" stroke-linecap="round"/><circle class="mc-orbit-warning-fill" cx="32" cy="32.8" r="1.1"/>'
    : '';
  const svg = '<svg class="mc-orbit-svg" viewBox="0 0 64 64" aria-hidden="true">' +
    '<circle class="mc-orbit-track" cx="32" cy="32" r="26"/>' +
    '<circle class="mc-orbit-arc" cx="32" cy="32" r="26" pathLength="100" style="stroke-dashoffset:' + offset + '" transform="rotate(-90 32 32)"/>' +
    '<circle class="mc-orbit-node" cx="32" cy="4" r="1.6"/><circle class="mc-orbit-node" cx="60" cy="32" r="1.6"/><circle class="mc-orbit-node" cx="32" cy="60" r="1.6"/><circle class="mc-orbit-node" cx="4" cy="32" r="1.6"/>' +
    warning + '</svg>';
  return '<span class="' + mcClass('mc-orbit', kind) + '" data-component="OrbitProgress" data-state="' + esc(kind) + '" data-value="' + value + '" role="img" aria-label="' + esc(aria) + '"' + motion + ' style="--mc-progress:' + value + '">' + svg + '<span class="mc-orbit-label">' + esc(label) + '</span>' + packets + '</span>';
}
/* SignalRail — idle/active solid; blocked dashed peach + end marker; locked/proof-needed(pending) dashed mint. */
function mcSignalRail(opts){
  const kind = mcStateKind(opts && opts.state);
  const label = (opts && opts.label) || ('signal rail ' + kind);
  const end = kind === 'blocked' ? '<i class="mc-rail-end" aria-hidden="true"></i>' : '';
  return '<span class="' + mcClass('mc-signal-rail', kind) + '" data-component="SignalRail" data-state="' + esc(kind) + '" aria-label="' + esc(label) + '">' + mcPacketDots(opts && opts.packetCount, kind) + end + '</span>';
}
/* KpiPulse spark bars — ~15 thin chartreuse bars, varied deterministic heights; lit count from served progress. */
const MC_KPI_SPARK_HEIGHTS = [5, 8, 6, 10, 7, 12, 9, 6, 11, 8, 13, 7, 10, 6, 12];
function mcKpiBars(progress, state){
  const kind = mcStateKind(state);
  const total = MC_KPI_SPARK_HEIGHTS.length;
  const lit = Math.max(0, Math.min(total, Math.round((Number(progress) || 0) / 100 * total)));
  return '<span class="mc-kpi-bars" data-component="PacketFlow" data-packet-mode="packet-bar" data-state="' + esc(kind) + '" data-signal-depth="' + lit + '" data-signal-total="' + total + '" aria-label="signal depth ' + lit + ' of ' + total + '">' +
    MC_KPI_SPARK_HEIGHTS.map((h, i) => '<i data-active="' + (i < lit ? 'true' : 'false') + '" style="--mc-spark-h:' + h + 'px"></i>').join('') +
  '</span>';
}
/* KpiPulse donut stops (T-026, frozen/04): gauges render at 0/25/50/75/100 — served progress
   snaps to the nearest frozen stop so the donut arc always lands on a ratified state. */
const MC_KPI_DONUT_STOPS = Object.freeze([0, 25, 50, 75, 100]);
function mcKpiDonutStop(value){
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  let best = 0;
  MC_KPI_DONUT_STOPS.forEach(stop => { if (Math.abs(v - stop) < Math.abs(v - best)) best = stop; });
  return best;
}
/* KpiPulse donut (T-026, frozen/01 badge): concentric dotted-ring badge — OrbitProgress arc at a
   frozen stop inside the dashed inner ring (.mc-kpi-donut::before, decorative, zero geometry).
   blocked/stale render no fill; reduced-motion renders the static full thin mint ring. */
function mcKpiDonut(opts){
  const kind = mcStateKind(opts && opts.state);
  const stop = mcKpiDonutStop(opts && opts.value);
  const label = opts && opts.label ? opts.label : stop + '%';
  const aria = (opts && opts.ariaLabel) || ('progress ' + stop + '% · ' + kind);
  return '<span class="' + mcClass('mc-kpi-donut', kind) + '" data-component="KpiPulseDonut" data-donut-stop="' + stop + '" data-state="' + esc(kind) + '">' +
    mcOrbitProgress({ value:stop, state:kind, label, ariaLabel:aria }) +
  '</span>';
}
/* KpiPulse row — concentric dotted-ring donut badge + 2-line mono label + right-aligned spark bars.
   Donut snaps to MC_KPI_DONUT_STOPS; packet bars keep the raw served value. opts.title/opts.detail
   override the default copy shaping (Mission scene M10 rules); opts.detail '' deletes the line. */
function mcKpiPulse(row, index, opts){
  const progress = mcKpiProgress(row);
  const state = mcKpiState(row);
  const survival = index === 0;
  const kind = survival ? 'survival' : 'better-than-survival';
  const title = opts && opts.title ? String(opts.title) : (survival ? 'Survival: ' : 'Better: ') + (row.label || ('KPI ' + (index + 1)));
  const detail = opts && typeof opts.detail === 'string' ? opts.detail : (survival
    ? ((row.currentState || 'not proven') + ' · survival: ' + (row.survival || 'missing'))
    : (row.betterThanSurvival ? row.betterThanSurvival : 'better-than-survival proof pending'));
  const stop = mcKpiDonutStop(progress);
  return '<div class="mc-kpi-row" data-component="KpiPulse" data-kpi-kind="' + kind + '" data-state="' + esc(mcStateKind(state)) + '" data-donut-stop="' + stop + '">' +
    mcKpiDonut({ value:progress, state, label:'KPI', ariaLabel:'KPI ' + (index + 1) + ' progress ' + stop + '% · ' + mcStateKind(state) }) +
    '<span class="mc-kpi-copy"><b>' + esc(title) + '</b>' + (detail ? '<span>' + esc(detail) + '</span>' : '') + '</span>' +
    mcKpiBars(progress, state) +
  '</div>';
}
`;
