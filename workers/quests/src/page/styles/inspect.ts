// cambium-quests · miniapp page chunk — Inspect scene CSS (proof map, component board)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_INSPECT = `  /* ── inspect proof map — Telegram density ───── */
	  @keyframes spin{to{transform:rotate(360deg)}}
	  @keyframes halo{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.045);opacity:.45}}
	  @keyframes packetDrift{0%{transform:translateX(-8%);opacity:.42}50%{opacity:.95}100%{transform:translateX(8%);opacity:.5}}
	  @keyframes glyphBreathe{0%,100%{transform:scale(1);opacity:.86}50%{transform:scale(1.035);opacity:1}}
	  @keyframes warningAttention{0%{border-color:rgba(248,181,96,.42)}45%{border-color:rgba(248,181,96,.86)}100%{border-color:rgba(248,181,96,.5)}}
	  .mapwrap{display:flex;flex-direction:column;gap:12px;padding-top:2px}
	  .maphead{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;padding-bottom:4px}
	  .maphead h2{font-size:18px;letter-spacing:0;color:var(--ink)}
  .maphead p{font-size:12px;opacity:.68;max-width:48ch;margin-top:3px}
  .mapbadge{min-height:44px;display:inline-flex;align-items:center;font:11px var(--mono);color:var(--ink);border:1px solid rgba(224,255,79,.28);
    border-radius:999px;padding:6px 10px;white-space:nowrap;appearance:none;background:transparent;cursor:pointer}
  .mapbadge:active{transform:scale(.96)}
  .wakegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
  .wake-step{appearance:none;text-align:left;color:var(--soft);min-width:0;padding:9px 9px;border:1px solid var(--line);border-radius:11px;background:rgba(1,47,52,.28);cursor:pointer}
  .wake-step b{display:block;font:10px var(--mono);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wake-step span{display:block;font-size:11px;opacity:.65;line-height:1.25;margin-top:3px;overflow-wrap:anywhere}
  .wake-step.wait{border-style:dashed;opacity:.72}
  .wake-step.done{background:rgba(224,255,79,.045)}
  .sensegrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  .sense{appearance:none;text-align:left;color:var(--soft);padding:10px;border:1px solid var(--line);
    border-radius:12px;background:rgba(1,47,52,.3);font:12px/1.35 inherit;cursor:pointer}
  .sense b{display:block;font:11px var(--mono);color:var(--ink);margin-bottom:3px}
  .sense.on{border-color:rgba(224,255,79,.32);background:rgba(224,255,79,.045)}
  .boxgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .ibox{appearance:none;text-align:left;color:var(--soft);min-height:76px;padding:10px;border:1px solid var(--line);
    border-radius:12px;background:rgba(1,47,52,.26);font:12px/1.35 inherit;cursor:pointer}
  .ibox b{display:block;font:11px var(--mono);color:var(--ink);margin-bottom:4px}
  .ibox span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;opacity:.72}
  .ibox.skill span{display:block;-webkit-line-clamp:unset;overflow:visible;overflow-wrap:anywhere}
	  .ibox.npc span{display:block;-webkit-line-clamp:unset;overflow:visible;overflow-wrap:anywhere}
	  .ibox.ready{border-color:rgba(224,255,79,.28);background:rgba(224,255,79,.04)}
	  .mc-branch-rail{display:flex;width:100%;min-width:0;max-width:100%;gap:8px;overflow-x:auto;padding:2px 0 8px;overscroll-behavior-inline:contain;scrollbar-width:none;touch-action:pan-x}
  .mc-branch-rail::-webkit-scrollbar{display:none}
  .mc-branch-chip{flex:0 0 clamp(200px,68vw,232px);min-width:0;min-height:56px;border:1px solid var(--mc-line-strong);border-radius:var(--mc-radius);background:rgba(1,47,52,.38);color:var(--mc-mint);padding:8px 10px;font:11px var(--mono);scroll-snap-align:start}
	  .mc-glyph{width:28px;height:28px;border:1px solid var(--mc-line-strong);border-radius:var(--mc-radius);display:inline-grid;place-items:center;color:var(--mc-chartreuse);background:var(--mc-panel);position:relative;overflow:hidden;flex:none}
	  .mc-glyph svg{width:80%;height:80%;display:block;stroke:currentColor;fill:none;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
	  .mc-glyph .mc-fill{fill:currentColor;opacity:.16;stroke:currentColor}
	  .mc-glyph .mc-core{fill:currentColor;stroke:none;opacity:.86}
	  .mc-glyph .mc-soft{opacity:.42}
	  .mc-glyph .mc-dash{stroke-dasharray:1.4 2.5}
	  .mc-glyph.is-active,.mc-glyph.is-selected,.mc-glyph.is-complete{border-color:rgba(224,255,79,.42);background:var(--mc-active-fill)}
	  .mc-glyph.is-active::after,.mc-glyph.is-selected::after{content:"";position:absolute;inset:2px;border-radius:inherit;border:1px solid rgba(224,255,79,.24);pointer-events:none}
	  .mc-glyph.is-blocked,.mc-glyph.is-proof-needed{color:var(--mc-warn);border-color:rgba(248,181,96,.5);background:var(--mc-warning-fill)}
	  .mc-glyph.is-locked{color:rgba(214,255,246,.46);border-color:rgba(214,255,246,.1);opacity:.72}
	  .mc-glyph.is-stale{color:var(--mc-warn);border-color:rgba(248,181,96,.34)}
	  .mc-state-token{display:inline-flex;align-items:center;gap:6px;min-height:24px;border:1px solid var(--mc-line);border-radius:999px;padding:4px 8px;font:10px var(--mono);color:var(--mc-mint)}
	  .mc-state-token::before{content:"";width:6px;height:6px;border-radius:50%;border:1px solid currentColor;opacity:.75}
	  .mc-state-token.is-active::before,.mc-state-token.is-selected::before{background:currentColor}
	  .mc-state-token.is-complete::before{border-radius:50%;background:var(--mc-chartreuse);box-shadow:inset 0 0 0 2px var(--mc-panel)}
	  .mc-state-token.is-blocked::before,.mc-state-token.is-proof-needed::before{border-radius:2px;transform:rotate(45deg);background:transparent}
	  .mc-state-token.is-locked::before{border-radius:2px;opacity:.5}
	  .mc-state-token.is-stale::before{background:transparent;border-style:dashed}
	  .mc-state-token.is-active,.mc-state-token.is-selected,.mc-state-token.is-complete{border-color:rgba(224,255,79,.38);color:var(--mc-chartreuse)}
	  .mc-state-token.is-blocked,.mc-state-token.is-proof-needed{border-color:rgba(248,181,96,.5);color:var(--mc-warn);animation:warningAttention 2.4s var(--ease) 1 both}
	  .mc-state-token.is-stale{border-color:rgba(248,181,96,.36);color:var(--mc-warn)}
	  .mc-state-token.is-locked{opacity:.66}
	  .mc-orbit{position:relative;width:44px;height:44px;border-radius:50%;border:1px solid var(--mc-line-strong);display:grid;place-items:center;color:var(--mc-chartreuse);font:10px var(--mono);background:radial-gradient(circle,rgba(1,47,52,.96) 0 52%,transparent 53%),conic-gradient(currentColor calc(var(--mc-progress,0) * 1%),rgba(214,255,246,.08) 0)}
	  .mc-orbit::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(224,255,79,.24);pointer-events:none}
	  .mc-orbit.is-active::after{border-color:rgba(224,255,79,.4)}
	  .mc-orbit.is-complete::after{border-color:rgba(224,255,79,.48)}
	  .mc-orbit.is-blocked,.mc-orbit.is-proof-needed,.mc-orbit.is-stale{color:var(--mc-warn);border-color:rgba(248,181,96,.44);background:radial-gradient(circle,rgba(1,47,52,.96) 0 52%,transparent 53%),conic-gradient(currentColor calc(var(--mc-progress,0) * 1%),rgba(248,181,96,.11) 0)}
	  .mc-orbit.is-proof-needed::after{border-style:dotted;border-color:rgba(248,181,96,.5)}
	  .mc-orbit.is-locked{color:rgba(214,255,246,.48);border-style:dashed}
	  .mc-orbit-label{position:relative;z-index:1;text-align:center;max-width:34px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	  .mc-orbit .mc-packet-dots{position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);min-height:6px;gap:3px;animation:none}
	  .mc-selected-halo{position:relative;box-shadow:0 0 0 1px rgba(224,255,79,.5),0 0 18px rgba(224,255,79,.18)}
	  .mc-selected-halo::after{content:"";position:absolute;inset:3px;border-radius:inherit;border:1px solid rgba(224,255,79,.22);pointer-events:none}
	  .mc-signal-rail{position:relative;min-height:20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center}
	  .mc-signal-rail.is-active{border-color:rgba(224,255,79,.34)}
	  .mc-signal-rail.is-blocked,.mc-signal-rail.is-proof-needed{border-color:rgba(248,181,96,.42);border-style:dashed}
	  .mc-signal-rail.is-locked{border-style:dashed;opacity:.62}
	  .mc-signal-rail .mc-rail-end{position:absolute;right:2px;top:50%;width:7px;height:7px;border:1px solid var(--mc-warn);transform:translateY(-50%) rotate(45deg);background:rgba(248,181,96,.1)}
	  .mc-packet-dots{display:flex;gap:5px;align-items:center;justify-content:center;min-height:20px;max-width:100%;overflow:hidden}
	  .mc-packet-dots[data-motion="packetDrift"]{animation:packetDrift 3.6s var(--ease) infinite alternate}
	  .mc-packet{width:4px;height:4px;border-radius:50%;background:var(--ink);box-shadow:0 0 7px rgba(224,255,79,.34);flex:0 0 auto}
	  .mc-packet-dots.is-blocked .mc-packet,.mc-packet-dots.is-proof-needed .mc-packet,.mc-packet-dots.is-stale .mc-packet{background:var(--mc-warn);box-shadow:0 0 7px rgba(248,181,96,.2)}
	  .mc-glyph[data-motion="glyphBreathe"] svg{transform-origin:center;animation:glyphBreathe 3.4s var(--ease) infinite}
  .mc-questline{display:grid;width:100%;min-width:0;max-width:100%;grid-template-columns:minmax(0,1fr);gap:0;border:1px solid var(--line);border-radius:8px;padding:6px 9px;overflow:hidden;background:rgba(1,47,52,.26)}
  .mc-proof-list{display:grid;gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;font:11px var(--mono);color:var(--soft);background:rgba(1,47,52,.24)}
	  .mc-kpi-pulse{display:inline-grid;place-items:center;min-width:38px;min-height:38px;border-radius:50%;border:1px solid rgba(224,255,79,.34);color:var(--ink)}
	  .mc-state-stack{display:grid;gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:rgba(1,47,52,.26)}
	  .mc-state-row{appearance:none;text-align:left;color:var(--soft);display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;
	    min-height:56px;padding:9px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;font:12px/1.35 inherit}
	  .mc-state-row:last-child{border-bottom:0}
	  .mc-state-row b{display:block;color:var(--soft);font-size:13px;line-height:1.2;margin-bottom:2px}
	  .mc-state-row small{display:block;font:10.5px/1.25 var(--mono);opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	  .mc-state-row .mc-glyph{width:34px;height:34px}
	  .mc-state-row .mc-orbit{width:34px;height:34px}
	  .mc-state-row.is-selected{border-color:rgba(224,255,79,.36);background:rgba(224,255,79,.035)}
	  .mc-state-row.is-blocked{box-shadow:inset 2px 0 0 rgba(248,181,96,.7)}
	  .mc-state-row.is-proof-needed{box-shadow:inset 2px 0 0 rgba(248,181,96,.45)}
	  .mc-state-row:active{transform:scale(.99)}
	  .mission-stale-notice{border:1px dashed rgba(248,181,96,.42);border-radius:8px;padding:10px;background:rgba(248,181,96,.045);font:11.5px/1.45 var(--mono)}
	  .mission-stale-notice b{display:block;color:var(--warn);font-weight:650;margin-bottom:3px}
	  .mc-action-row{position:static;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 0 2px}
	  .mc-action-row[data-component="GateActionRow"]{border-top:1px solid var(--line);margin-top:2px}
	  .mc-inspect-only{opacity:.72}
	  .component-board{display:grid;gap:12px;padding-bottom:18px}
	  .component-board-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;border:1px solid rgba(224,255,79,.24);border-radius:8px;padding:12px;background:rgba(1,47,52,.34)}
	  .component-board-head h2{font-size:19px;line-height:1.1;color:var(--ink)}
	  .component-board-head p{font-size:12px;opacity:.68;max-width:48ch;margin-top:4px}
	  .component-board-head span{font:10px var(--mono);color:var(--ink);border:1px solid rgba(224,255,79,.34);border-radius:999px;padding:4px 8px;white-space:nowrap}
	  .component-panel{border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.26);padding:11px;overflow:hidden}
	  .component-panel h3{font:11px var(--mono);color:var(--ink);letter-spacing:0;text-transform:uppercase;margin:0 0 10px}
	  .component-grid{display:grid;gap:8px}
	  .component-glyph-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
	  .component-state-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
	  .component-orbit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
	  .component-mission-grid,.component-motion-grid,.component-legend-grid{grid-template-columns:1fr}
	  .component-glyph-cell,.component-state-cell,.component-frame,.component-legend-item{min-width:0;border:1px solid var(--line);border-radius:8px;background:rgba(0,39,43,.28);padding:8px}
	  .component-glyph-cell{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
	  .component-glyph-cell b,.component-state-cell b,.component-frame b,.component-legend-item b{display:block;color:var(--soft);font-size:12px;line-height:1.2;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	  .component-glyph-cell small,.component-state-cell small,.component-frame small,.component-legend-item small{display:block;font:10.5px/1.35 var(--mono);opacity:.62;overflow-wrap:anywhere}
	  .component-state-cell{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
	  .component-orbit-grid .component-frame{text-align:center;display:grid;justify-items:center;gap:6px}
	  .component-sample{border:1px solid var(--line);border-radius:8px;background:rgba(0,39,43,.24);padding:9px;min-width:0}
	  .component-branch-chip-sample{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center}
	  .component-sample-title{font:11px var(--mono);color:var(--ink);text-transform:uppercase;letter-spacing:0;margin-bottom:6px}
	  .component-motion-frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:7px}
	  .component-motion-frames .mc-glyph,.component-motion-frames .mc-orbit{margin:auto}
	  .component-motion-frame{min-height:58px;display:grid;place-items:center;border:1px dashed var(--line2);border-radius:7px;background:rgba(1,47,52,.22)}
	  .component-legend-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
	  .component-legend-node{width:18px;height:18px;border-radius:50%;border:1px solid var(--line2);background:rgba(1,47,52,.45)}
	  .component-legend-node.is-rail{width:32px;height:2px;border-radius:2px;background:var(--line2)}
	  .component-legend-node.is-packet{width:7px;height:7px;background:var(--ink);box-shadow:0 0 8px rgba(224,255,79,.38)}
	  .component-legend-node.is-orbit{border-color:rgba(224,255,79,.46);background:conic-gradient(var(--ink) 70%,rgba(214,255,246,.1) 0)}
	  .component-legend-node.is-active{background:var(--ink);border-color:var(--ink)}
	  .component-legend-node.is-warning{background:var(--warn);border-color:var(--warn)}
	  .component-legend-node.is-locked{opacity:.46;border-style:dashed}
	  .component-legend-node.is-stale{border-color:var(--warn);border-style:dashed}
	  .stagegrid{display:grid;grid-template-columns:1fr;gap:8px}
  .stage-card{position:relative;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;
    padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:rgba(1,47,52,.36);color:var(--soft);
    cursor:pointer;opacity:0;transform:translateY(10px);animation:rise .5s var(--ease) forwards;animation-delay:calc(var(--i)*45ms)}
  .stage-card:active{transform:scale(.985)}
  .stage-card.active{border-color:rgba(224,255,79,.45);background:rgba(224,255,79,.06);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .stage-card.active::after{content:"";position:absolute;inset:-1px;border-radius:13px;
    border:1px solid rgba(224,255,79,.26);animation:halo 2.8s var(--ease) infinite;pointer-events:none}
  .stage-glyph{width:35px;height:35px;border-radius:12px;border:1px solid var(--line2);display:grid;place-items:center;
    font:700 13px var(--mono);color:var(--ink);background:var(--bg2)}
  .stage-card.done .stage-glyph{background:rgba(224,255,79,.12);box-shadow:inset 0 0 8px rgba(224,255,79,.22)}
  .stage-title{display:block;font-weight:700;font-size:14px}
  .stage-detail{display:block;font-size:12px;opacity:.68;line-height:1.35;margin-top:2px}
  .stage-count{font:11px var(--mono);color:var(--ink);opacity:.82;white-space:nowrap}
  .stagebar{display:block;height:4px;background:var(--line);border-radius:999px;overflow:hidden;margin-top:7px}
  .stagebar span{display:block;height:100%;background:var(--ink);border-radius:999px;transition:width .8s var(--ease)}
	  .railgrid{display:grid;gap:8px}
	  .rail{appearance:none;color:var(--soft);text-align:left;display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 12px;border:1px solid var(--line);
    border-radius:12px;background:rgba(1,47,52,.24);font:12px var(--mono);opacity:.9;cursor:pointer}
  .rail:active{transform:scale(.985)}
  .rail b{font-weight:650;color:var(--soft)}
  .rail span{color:var(--ink);opacity:.75}
  .rail.hot{border-color:rgba(224,255,79,.34);background:rgba(224,255,79,.045)}
  .mapnote{font:11px/1.5 var(--mono);opacity:.58}
  .inspect-pane-switcher{display:grid;grid-template-columns:1fr 1fr;gap:4px;border:1px solid var(--line);border-radius:8px;padding:4px;background:rgba(1,47,52,.28)}
  .inspect-pane-switcher button{appearance:none;min-width:0;min-height:44px;border:0;border-radius:6px;background:transparent;color:var(--soft);font:650 11px/1 var(--mono);cursor:pointer}
  .inspect-pane-switcher button[aria-selected="true"]{background:var(--ink);color:var(--bg)}
  .inspect-pane{display:none;min-width:0;gap:12px}
  .inspect-pane.is-active{display:grid}
  .inspect-pane-section{display:grid;gap:8px;min-width:0}
  .inspect-pane-heading{font:11px/1.2 var(--mono);color:var(--ink);text-transform:uppercase}
  .inspect-disclosure{border-top:1px solid var(--line);padding-top:8px}
  .inspect-disclosure>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--soft);font:650 12px/1.3 var(--mono);cursor:pointer;list-style:none}
  .inspect-disclosure>summary::-webkit-details-marker{display:none}
  .inspect-disclosure>summary::after{content:"+";color:var(--ink);font:18px/1 var(--mono)}
  .inspect-disclosure[open]>summary::after{content:"−"}
  .inspect-disclosure-body{display:grid;gap:10px;padding:4px 0 10px}
  .inspect-groups{display:grid;grid-template-columns:1fr;gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:rgba(1,47,52,.22)}
  .inspect-group{appearance:none;text-align:left;color:var(--soft);display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start;
    min-width:0;min-height:64px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding:10px;cursor:pointer}
  .inspect-group:last-child{border-bottom:0}
  .inspect-group b{display:block;color:var(--soft);font-size:12.5px;line-height:1.2;margin-bottom:2px;text-transform:capitalize}
  .inspect-group small{display:block;font:10.5px/1.35 var(--mono);opacity:.62;overflow-wrap:anywhere}
  .inspect-group .mc-state-token{grid-column:2;width:max-content;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .facets{display:flex;flex-direction:column;gap:8px}
  .facet{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);
    border-radius:11px;font:12.5px var(--mono);
    opacity:0;transform:translateX(10px);animation:rise .45s var(--ease) forwards;animation-delay:calc(var(--i)*55ms)}
  .facet .dot{width:7px;height:7px;border-radius:50%;flex:none}
  .facet.done .dot{background:var(--ink);box-shadow:0 0 6px rgba(224,255,79,.5)}
  .facet.pend .dot{background:transparent;border:1.5px solid rgba(214,255,246,.4)}
  .dback{appearance:none;background:none;border:1px solid var(--line2);color:var(--soft);
    border-radius:10px;padding:9px 14px;margin-top:14px;font:600 12px inherit;cursor:pointer;
    transition:transform .2s var(--ease)}
  .dback:active{transform:scale(.96)}

`;
