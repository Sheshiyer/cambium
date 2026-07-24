// cambium-quests · miniapp page chunk — Gate scene CSS
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_GATE = `  /* ── gate ───────────────────────────────────── */
  .gate-shell{display:grid;gap:12px}
  .gate-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:center;
    border:1px solid rgba(224,255,79,.28);border-radius:14px;padding:14px;background:linear-gradient(145deg,rgba(224,255,79,.06),rgba(1,47,52,.38) 60%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .gate-hero::after{content:"";position:absolute;right:-34px;top:-34px;width:124px;height:124px;border-radius:50%;
    border:1px dashed rgba(224,255,79,.22);opacity:.8;pointer-events:none}
  .gate-title-row{position:relative;z-index:1;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start}
  .gate-title-row h3{font-size:20px;line-height:1.1;color:var(--ink);margin:0 0 6px}
  .gate-title-row p{font-size:12.5px;line-height:1.45;opacity:.78;max-width:46ch}
  .gate-hero .mc-glyph{width:34px;height:34px;border-radius:11px}
  .gauge{position:relative;z-index:1;display:grid;place-items:center;margin:0;min-height:116px}
  .gauge .gate-orbit{width:128px;display:grid;place-items:center;gap:5px}
  .gauge svg{width:128px;max-width:100%;overflow:visible;filter:drop-shadow(0 0 10px rgba(224,255,79,.12))}
  .gauge .gv{font:700 21px var(--mono);fill:var(--ink)}
  .gauge .gl{font:9.5px var(--mono);fill:var(--soft);opacity:.55;letter-spacing:0}
  .gauge .gstate{font:9px var(--mono);fill:var(--warn);letter-spacing:0;text-transform:uppercase}
  .gate-orbit .gate-orbit-node{fill:var(--bg2);stroke:rgba(224,255,79,.38);stroke-width:1.5}
  .gate-orbit.is-active .gate-orbit-node,.gate-orbit.is-complete .gate-orbit-node{fill:var(--ink);stroke:rgba(224,255,79,.7)}
  .gate-orbit.is-blocked .gate-orbit-node,.gate-orbit.is-proof-needed .gate-orbit-node{fill:var(--warn);stroke:rgba(255,199,161,.58)}
  .gate-orbit .gate-orbit-caption{display:flex;justify-content:center;width:100%}
  .gate-orbit .mc-state-token{min-height:20px;padding:3px 7px;max-width:116px;text-align:center;justify-content:center}
  .gate-progress-summary{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px;background:rgba(1,47,52,.22)}
  .gate-progress-summary .gauge{min-height:88px}
  .gate-progress-copy{font:11px/1.45 var(--mono);color:var(--soft)}
  .gate-progress-copy b{display:block;color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:0;margin-bottom:3px}
  .gate-progress-copy span{display:block;opacity:.72}
  .gate-state-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .gate-state-strip span{min-width:0;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono)}
  .gate-state-strip b{display:block;color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:0;margin-bottom:3px}
  .gate-state-strip small{display:block;opacity:.76;overflow-wrap:anywhere}
  .gate-hero-decision{border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono);margin-top:9px}
  .gate-hero-decision b{display:block;color:var(--ink);font-weight:650;margin-bottom:2px}
  .gate-queue{display:grid;gap:10px}
  .gate-filter-strip{margin-bottom:2px}
  .gate-empty,.gate-error{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;border:1px dashed rgba(224,255,79,.28);
    border-radius:13px;padding:12px;background:rgba(1,47,52,.28);font:12.5px/1.48 var(--mono)}
  .gate-error{border-color:rgba(255,199,161,.44);background:rgba(255,199,161,.045)}
  .gate-empty b,.gate-error b{display:block;color:var(--soft);font-weight:650;margin-bottom:3px}
  .gate-empty span,.gate-error span{display:block;opacity:.76;overflow-wrap:anywhere}
  .ghead{font-size:17px;font-weight:650;color:var(--ink);margin-bottom:2px}
  .gsub{font-size:12px;opacity:.7;margin-bottom:16px;max-width:52ch}
  .gitem{position:relative;overflow:hidden;padding:12px;border:1px solid var(--line2);border-radius:14px;
    background:var(--glass);backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
    opacity:0;transform:translateY(12px);animation:rise .5s var(--pop) forwards;animation-delay:calc(var(--i)*70ms)}
  .gitem::after{content:"";position:absolute;inset:auto 12px 0;height:1px;background:linear-gradient(90deg,transparent,var(--line2),transparent);opacity:.7}
  .gitem.is-active,.gitem.is-complete{border-color:rgba(224,255,79,.3);background:linear-gradient(145deg,rgba(224,255,79,.055),rgba(1,47,52,.36))}
  .gitem.is-blocked,.gitem.is-proof-needed{border-color:rgba(255,199,161,.42);background:linear-gradient(145deg,rgba(255,199,161,.055),rgba(1,47,52,.34))}
  .gcard-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;margin-bottom:10px}
  .gitem .gid{font:11px var(--mono);color:var(--ink);opacity:.85}
  .gitem .gtitle{font-weight:650;margin:3px 0 0;color:var(--soft);overflow-wrap:anywhere}
  .gmeta{display:grid;grid-template-columns:96px 1fr;gap:5px 9px;margin:9px 0 11px;font-size:11.5px;line-height:1.35}
  .gmeta b{font:10px var(--mono);color:var(--ink);opacity:.72;text-transform:uppercase}
  .gmeta span{opacity:.74;overflow-wrap:anywhere}
  .gitem-details{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
  .gitem-details span{border:1px solid var(--line);border-radius:8px;padding:7px;font:10.5px/1.35 var(--mono);opacity:.76}
  .gitem-details b{display:block;color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:0;margin-bottom:2px}
  .gate-proof-row{appearance:none;width:100%;min-height:56px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;
    border:1px solid var(--line);border-radius:8px;padding:9px 10px;margin:8px 0;background:rgba(1,47,52,.24);color:var(--soft);font:11px/1.35 var(--mono);text-align:left;cursor:pointer}
  .gate-proof-row:active{transform:scale(.99)}
  .gate-proof-row .mc-glyph{width:34px;height:34px;border-radius:8px}
  .gate-proof-copy{display:block;min-width:0}
  .gate-proof-copy b{display:block;color:var(--ink);font-size:12px;line-height:1.25;font-weight:650;margin-bottom:3px}
  .gate-proof-copy small{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font:10.5px/1.4 var(--mono);opacity:.72;overflow-wrap:anywhere}
  .gate-proof-open{font:20px/1 var(--mono);color:var(--ink);opacity:.72}
  .gate-route-receipt{display:grid;gap:6px;margin:8px 0 10px}
  .gate-route-pill,.gate-receipt-summary{border:1px solid var(--line);border-radius:8px;padding:7px 9px;background:rgba(1,47,52,.24);font:10.5px/1.35 var(--mono);overflow-wrap:anywhere}
  .gate-route-pill b,.gate-receipt-summary b{display:block;color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:0;margin-bottom:2px}
  .gate-route-pill span,.gate-receipt-summary span{opacity:.78}
  .gate-stale-chip{display:inline-flex;align-items:center;width:max-content;border:1px dashed rgba(255,199,161,.42);border-radius:999px;color:var(--warn);padding:3px 7px;font:10px var(--mono);margin-top:7px}
  .gitem .mc-signal-rail{margin:8px 0 10px}
  .gpriority{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
  .gpriority span{border:1px solid rgba(255,199,161,.36);border-radius:999px;padding:4px 8px;color:var(--warn);font:10px var(--mono);background:rgba(255,199,161,.04)}
  .gate-empty .mc-signal-rail,.gate-error .mc-signal-rail{margin-top:9px}
  .gbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .gbtns button{appearance:none;min-height:44px;border:0;border-radius:10px;padding:11px;font:600 13px inherit;cursor:pointer;
    transition:transform .2s var(--ease)}
  .gbtns button:active{transform:scale(.97)}
  .gbtns .approve{background:var(--ink);color:var(--bg)}
  .gbtns .reroll{background:none;border:1px solid rgba(214,255,246,.4);color:var(--soft)}
  .gbtns .detail{background:rgba(1,47,52,.5);border:1px solid var(--line2);color:var(--ink)}
  .gbtns button:disabled{cursor:wait;opacity:.72;transform:none}
  .gate-actions.is-queued{grid-template-columns:minmax(0,1fr) auto;align-items:stretch}
  .gate-actions.is-queued .detail{min-width:96px}
  .gate-queued-state{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;border:1px solid rgba(224,255,79,.3);
    border-radius:8px;padding:8px 10px;background:rgba(224,255,79,.055);color:var(--soft)}
  .gate-queued-state::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 3px rgba(224,255,79,.1)}
  .gate-queued-state b{display:block;color:var(--ink);font:650 10.5px/1.2 var(--mono);text-transform:uppercase;letter-spacing:0}
  .gate-queued-state small{display:block;margin-top:2px;font:10px/1.25 var(--mono);opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gate-result-actions .approve{grid-column:1/-1}
  .gbtns.command-copy{grid-template-columns:1fr;margin:12px 0}
  .gbtns.command-copy button{background:var(--ink);color:var(--bg)}
  .gnote{font:11px var(--mono);opacity:.6;margin-top:12px;line-height:1.5}
  .gate-submit-status{margin:10px 0 12px;padding:9px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.24);
    color:var(--ink);font:11px/1.45 var(--mono);overflow-wrap:anywhere}
  .gate-submit-status[data-gate-submit-status="pending"]{border-style:dashed;background:rgba(224,255,79,.07)}

`;
