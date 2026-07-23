// cambium-quests · miniapp page chunk — Mission scene CSS (quest line)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_MISSION = `  /* ── quest line — the living vine ─────────────── */
  .stem{position:relative;padding-left:40px}
  /* the grown vine: a glowing chartreuse stem up to --grow, faint beyond */
  .stem::before{content:"";position:absolute;left:13px;top:10px;bottom:10px;width:3px;border-radius:3px;
    background:linear-gradient(var(--ink) 0 var(--grow,0%),var(--line) var(--grow,0%) 100%);
    box-shadow:0 0 11px rgba(224,255,79,.32);transition:--grow 1.2s var(--ease)}
  .q{position:relative;padding:15px 4px 15px 12px;border-bottom:1px solid var(--line);
    opacity:0;transform:translateY(14px) scale(.97);
    animation:rise .55s var(--pop) forwards;animation-delay:calc(var(--i)*70ms);cursor:pointer}
  .q:active{transform:scale(.985)}
  @keyframes rise{to{opacity:1;transform:none}}
  .node{position:absolute;left:-38px;top:15px;width:25px;height:25px;border-radius:50%;
    display:grid;place-items:center;background:var(--bg2);border:1.5px solid var(--line);z-index:1}
  .node svg{width:13px;height:13px}
  .q.complete .node{border-color:var(--ink);background:rgba(224,255,79,.12);
    box-shadow:inset 0 0 9px rgba(224,255,79,.5),0 0 11px rgba(224,255,79,.22)}
  .q.active .node{border-color:var(--ink);background:rgba(224,255,79,.06);
    box-shadow:0 0 16px rgba(224,255,79,.5);animation:breathe 2.6s var(--ease) infinite}
  .q.active .node::after{content:"";position:absolute;inset:-7px;border-radius:50%;
    border:1px solid rgba(224,255,79,.45);animation:halo 2.6s var(--ease) infinite}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
  .q .arc{font:11px var(--mono);opacity:.5;margin-right:7px}
  .q .t{font-weight:650;font-size:15.5px}
  .q.active .t{color:var(--ink);text-shadow:0 0 12px rgba(224,255,79,.35)}
  .q.locked .t,.q.locked .arc{opacity:.4}
  .ev{font:12px/1.45 var(--mono);opacity:.7;margin-top:4px}
  .bar{height:8px;background:var(--line);border-radius:99px;margin:24px 0 8px;overflow:hidden;position:relative}
  .fill{height:100%;width:0;background:var(--ink);border-radius:99px;position:relative;overflow:hidden;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25);transition:width 1.2s var(--ease)}
  .fill::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
    background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.4) 50%,transparent 70%);
    animation:shimmer 3.2s var(--ease) infinite}
  .meta{display:flex;justify-content:space-between;gap:10px;font:12px var(--mono);opacity:.75}
  .meta span{cursor:pointer}
  .meta span:active{transform:scale(.97)}
  .meta #here{text-align:right;color:var(--ink);opacity:.85}
  .stem.mission-control{width:100%;min-width:0;padding-left:0;display:grid;gap:12px;--grow:0%}
  .stem.mission-control>*{min-width:0}
  .stem.mission-control::before{display:none}
  .mission-empty{border:1px dashed rgba(248,181,96,.42);border-radius:8px;padding:14px;background:rgba(1,47,52,.34)}
  .mission-empty b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
  .mission-empty p{font-size:13px;opacity:.76;margin-bottom:12px}
  .mc-branch-chip{appearance:none;text-align:left;cursor:pointer;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center}
  .mc-branch-copy{display:block;min-width:0}
  .mc-branch-copy b{display:block;color:var(--ink);font-size:11px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mc-branch-copy small{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.72;font:10px/1.25 var(--mono)}
  .mc-branch-chip .mc-glyph{width:25px;height:25px;border-radius:7px}
  .mc-branch-chip .mc-state-token{flex:none;min-height:20px;max-width:88px;padding:3px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-branch-chip.is-selected{border-color:rgba(224,255,79,.55);background:rgba(224,255,79,.065)}
  .mc-section-title{font:11px var(--mono);color:var(--ink);text-transform:uppercase;letter-spacing:0;margin:3px 0}
  .mc-mission-card{position:relative;overflow:hidden;border:1px solid rgba(224,255,79,.36);background:rgba(1,47,52,.42);padding:14px;border-radius:8px;display:grid;gap:10px}
  .mc-mission-card::before{content:"";position:absolute;inset:0 0 30% 38%;opacity:.32;pointer-events:none;
    background:
      repeating-radial-gradient(ellipse at 62% 44%,rgba(214,255,246,.2) 0 1px,transparent 1px 12px),
      linear-gradient(135deg,transparent,rgba(224,255,79,.08))}
  .mc-mission-card>*{position:relative;z-index:1}
  .mc-mission-card h3{font-size:18px;line-height:1.18;color:var(--ink);overflow-wrap:anywhere}
  .mc-mission-card p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;font-size:13px;line-height:1.48;opacity:.78}
  .mc-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px}
  .mc-card-head>div{min-width:0}
  .mc-card-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .mc-card-meta span,.mc-blocker-row,.mc-kpi-row{min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono);overflow-wrap:anywhere}
  .mc-branch-texture{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:8px;background:linear-gradient(90deg,rgba(224,255,79,.09),rgba(1,47,52,.2))}
  .mc-branch-texture>span{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;min-width:0;font:11px/1.3 var(--mono)}
  .mc-branch-texture b{display:block;color:var(--ink);font-weight:650}
  .mc-branch-texture small{display:block;min-width:0;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-proof-list>button{appearance:none;width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;min-height:56px;border:0;border-bottom:1px solid var(--line);padding:8px 10px;background:transparent;color:var(--soft);text-align:left;font:11px/1.35 var(--mono);cursor:pointer}
  .mc-proof-list>button:last-child{border-bottom:0}
  .mc-proof-list>button:active{background:rgba(224,255,79,.04)}
  .mc-proof-list>button>span{display:block;min-width:0;overflow-wrap:anywhere}
  .mc-card-meta b,.mc-proof-list b,.mc-blocker-row b,.mc-kpi-row b{display:block;color:var(--ink);font-weight:650;margin-bottom:3px}
  .mc-questline-row{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;min-height:56px;padding:8px 4px;text-align:left}
  .mc-questline-row:not(:last-child){border-bottom:1px solid var(--line)}
  .mc-questline-row:not(:last-child)::after{content:"";position:absolute;left:17px;top:calc(50% + 14px);bottom:calc(-50% + 14px);border-left:1px dashed var(--line2);pointer-events:none}
  .mc-questline-row[data-questline-stage-state="blocked"]::after,.mc-questline-row[data-questline-stage-state="proof-needed"]::after{border-left-color:rgba(248,181,96,.5)}
  .mc-questline-row .mc-signal-rail{display:none}
  .mc-questline-row>span:first-child{position:relative;z-index:1;display:grid;place-items:center}
  .mc-questline-row b{min-width:0;font-size:11px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
  .mc-questline-row .mc-state-token{justify-self:end;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-blockers,.mc-kpis{display:grid;gap:8px}
  .mc-kpi-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
  .mc-kpi-copy{display:grid;gap:3px;min-width:0}
  .mc-kpi-copy small{color:var(--muted)}
  .mc-kpi-bars{display:flex;gap:4px;align-items:end;min-height:14px;margin-top:3px}
  .mc-kpi-bars i{width:12px;border-radius:5px 5px 2px 2px;background:rgba(224,255,79,.62);box-shadow:0 0 8px rgba(224,255,79,.18)}
  .mc-kpi-bars i:nth-child(1){height:6px}.mc-kpi-bars i:nth-child(2){height:10px}.mc-kpi-bars i:nth-child(3){height:14px}
  .mc-action-row button{appearance:none;min-height:60px;border:1px solid rgba(224,255,79,.5);border-radius:8px;background:var(--ink);color:#00272B;font-weight:800;cursor:pointer;touch-action:manipulation}
  .mc-action-row button.secondary{border-color:var(--line2);background:rgba(1,47,52,.55);color:var(--soft)}
  .mission-tool-link,.tool-recommend,.story-hero,.inspect-proof-summary{border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28);padding:12px 13px}
  .mission-tool-link{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:center}
  .mission-tool-link>*{min-width:0}
  .mission-tool-link b,.tool-recommend b,.story-hero b,.inspect-proof-summary b{display:block;color:var(--ink);font-size:13px;line-height:1.25}
  .mission-tool-link small,.tool-recommend small,.story-hero small,.inspect-proof-summary small{display:block;font:11px/1.35 var(--mono);opacity:.68;margin-top:3px;overflow-wrap:anywhere}
  .inspect-proof-summary>small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere}
  .mission-tool-link button,.tool-recommend button{appearance:none;border:1px solid rgba(224,255,79,.5);border-radius:8px;background:var(--ink);color:var(--bg);font:800 12px inherit;padding:9px 10px;cursor:pointer}
  .mission-tool-link button{width:100%;min-height:44px}

`;
