// cambium-quests · miniapp page chunk — esc + state-kind + component builders (glyph, state token, packets, orbit, rail, kpi)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const COMPONENT_MISSION_CONTROL = `const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mcStateKind(raw){
  const state = String(raw || '').toLowerCase();
  if (/reduced/.test(state)) return 'reduced-motion';
  if (/selected|focus/.test(state)) return 'selected';
  if (/verified|complete|ready|done/.test(state)) return 'complete';
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
function mcGlyphSvg(kind, state, opts){
  const glyph = MC_COMPONENT_REGISTRY.MissionGlyph.includes(kind) ? kind : 'arc';
  const tone = mcStateKind(state);
  const motion = opts && opts.motion === 'glyphBreathe' && tone === 'active' && !RM ? ' data-motion="glyphBreathe" data-motion-primitive="glyphBreathe"' : '';
  return '<span class="' + mcClass('mc-glyph', tone) + '" data-component="MissionGlyph" data-glyph-kind="' + esc(glyph) + '" data-state="' + esc(tone) + '"' + motion + ' aria-hidden="true">' + MC_GLYPH_SVG[glyph] + '</span>';
}
function mcStateToken(state, label){
  const kind = mcStateKind(state);
  return '<span class="' + mcClass('mc-state-token', kind) + '" data-component="StateToken" data-state="' + esc(kind) + '" aria-label="state: ' + esc(label || kind) + '">' + esc(label || kind) + '</span>';
}
function mcPacketDots(count, state, opts){
  const kind = mcStateKind(state);
  const n = Math.max(1, Math.min(7, Number(count) || 1));
  const mode = (opts && opts.mode) || 'rail';
  const motion = kind === 'active' && !RM ? ' data-motion="packetDrift" data-motion-primitive="packetDrift"' : '';
  return '<span class="' + mcClass('mc-packet-dots', kind) + '" data-component="PacketFlow" data-state="' + esc(kind) + '" data-packet-count="' + n + '" data-packet-mode="' + esc(mode) + '"' + motion + ' aria-hidden="true">' + Array.from({ length:n }, () => '<i class="mc-packet"></i>').join('') + '</span>';
}
function mcOrbitProgress(opts){
  const value = Math.max(0, Math.min(100, Number(opts && opts.value) || 0));
  const label = opts && opts.label ? opts.label : value + '%';
  const kind = mcStateKind(opts && opts.state);
  const packets = opts && opts.showPacketDots ? mcPacketDots(opts.packetCount || 3, kind, { mode:'orbit' }) : '';
  const aria = (opts && opts.ariaLabel) || ('progress ' + label + ' · ' + kind);
  return '<span class="' + mcClass('mc-orbit', kind) + '" data-component="OrbitProgress" data-state="' + esc(kind) + '" data-value="' + value + '" role="img" aria-label="' + esc(aria) + '" style="--mc-progress:' + value + '"><span class="mc-orbit-label">' + esc(label) + '</span>' + packets + '</span>';
}
function mcSignalRail(opts){
  const kind = mcStateKind(opts && opts.state);
  const label = (opts && opts.label) || ('signal rail ' + kind);
  const end = kind === 'blocked' || kind === 'proof-needed' ? '<i class="mc-rail-end" aria-hidden="true"></i>' : '';
  return '<span class="' + mcClass('mc-signal-rail', kind) + '" data-component="SignalRail" data-state="' + esc(kind) + '" aria-label="' + esc(label) + '">' + mcPacketDots(opts && opts.packetCount, kind) + end + '</span>';
}
function mcKpiBars(progress, state){
  const kind = mcStateKind(state);
  const depth = Math.max(1, Math.min(3, Math.ceil((Number(progress) || 0) / 34)));
  return '<span class="mc-kpi-bars" data-component="PacketFlow" data-packet-mode="packet-bar" data-state="' + esc(kind) + '" data-signal-depth="' + depth + '" aria-label="signal depth ' + depth + ' of 3">' +
    [1, 2, 3].map(i => '<i data-active="' + (i <= depth ? 'true' : 'false') + '"></i>').join('') +
  '</span>';
}
function mcKpiPulse(row, index){
  const progress = mcKpiProgress(row);
  const state = mcKpiState(row);
  const kind = index === 0 ? 'survival' : 'better-than-survival';
  return '<div class="mc-kpi-row" data-component="KpiPulse" data-kpi-kind="' + kind + '" data-state="' + esc(mcStateKind(state)) + '">' +
    mcOrbitProgress({ value:progress, state, label:'KPI', ariaLabel:'KPI ' + (index + 1) + ' progress ' + progress + '%' }) +
    '<span class="mc-kpi-copy"><b>' + esc(row.label || ('KPI ' + (index + 1))) + '</b><span>' + esc((row.currentState || 'not proven') + ' · survival: ' + (row.survival || 'missing')) + '</span><small>' + esc(row.betterThanSurvival ? 'better: ' + row.betterThanSurvival : 'better-than-survival proof pending') + '</small>' + mcKpiBars(progress, state) + '</span>' +
  '</div>';
}
`;
