// cambium-quests · miniapp page chunk — Gate scene CSS
// T-017/T-018 rebuild: decision queue as visual state stack (frozen/02 §5 — ~85px rows, left ~60px
// state token, mono title over mono muted subtitle, right status dot + chevron, hairline dividers,
// mono chartreuse small-caps header), Gate Attention strip (frozen/03 strip 5 — warningAttention
// runs once, never pulses; reduced-motion static via styles/states.ts), GateActionRow anatomy
// (frozen/01 — primary solid chartreuse fill dark text, secondary transparent 1px chartreuse border).
// Assembly order: page/index.ts.
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

  /* ── T-017 decision queue · visual state stack (frozen/02 §5) ── */
  .gate-stack-header{font:10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:2px 2px 0}
  .gate-stack{border:1px solid var(--line2);border-radius:8px;background:var(--glass);overflow:hidden}
  /* row = ~85px: left state token (~60px) → mono title over mono muted subtitle → right status dot + chevron.
     State is icon + color + left rail style, never color alone (frozen/README). */
  .gitem{position:relative;padding:12px 12px 12px 16px;
    opacity:0;transform:translateY(12px);animation:rise .5s var(--pop) forwards;animation-delay:calc(var(--i)*70ms)}
  .gitem + .gitem{border-top:1px solid var(--line)}
  .gitem::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:rgba(214,255,246,.16)}
  .gitem.is-active::before,.gitem.is-selected::before,.gitem.is-complete::before{background:var(--mc-chartreuse)}
  .gitem.is-blocked::before{background:var(--mc-peach)}
  .gitem.is-proof-needed::before,.gitem.is-locked::before,.gitem.is-idle::before{background:repeating-linear-gradient(180deg,rgba(214,255,246,.42) 0 4px,transparent 4px 8px)}
  .gitem.is-stale::before{background:repeating-linear-gradient(180deg,rgba(214,255,246,.22) 0 2px,transparent 2px 6px)}
  .gitem.is-blocked{background:linear-gradient(145deg,rgba(255,199,161,.05),rgba(1,47,52,.3))}
  .gitem.is-active,.gitem.is-selected{background:linear-gradient(145deg,rgba(224,255,79,.045),rgba(1,47,52,.3))}
  .grow-head{display:grid;grid-template-columns:60px minmax(0,1fr) auto auto;gap:10px;align-items:center;min-height:61px}
  .gate-row-token{width:44px;height:44px;border:1px solid var(--mc-line);border-radius:8px;display:grid;place-items:center;color:var(--mc-mint);background:rgba(1,47,52,.4)}
  .gate-row-token .mc-token-icon{width:20px;height:20px;display:grid;place-items:center}
  .gate-row-token .mc-token-icon svg{width:20px;height:20px;display:block}
  .gate-row-token.is-idle{opacity:.62}
  .gate-row-token.is-active,.gate-row-token.is-complete{color:var(--mc-chartreuse);border-color:rgba(224,255,79,.38)}
  .gate-row-token.is-selected{color:var(--mc-chartreuse);border-color:rgba(224,255,79,.5);box-shadow:0 0 0 1px rgba(224,255,79,.22)}
  .gate-row-token.is-blocked{color:var(--mc-peach);border-color:rgba(255,199,161,.55);background:var(--mc-warning-fill)}
  .gate-row-token.is-proof-needed{color:var(--mc-mint);border-style:dashed;border-color:rgba(214,255,246,.4)}
  .gate-row-token.is-locked{opacity:.66;border-style:dashed}
  .gate-row-token.is-stale{opacity:.55;border-style:dotted}
  .grow-copy{min-width:0}
  .grow-copy .gtitle{font:12.5px/1.3 var(--mono);color:var(--mc-paper);overflow-wrap:anywhere}
  .grow-copy .gsub-line{font:10.5px/1.35 var(--mono);color:var(--soft);opacity:.55;margin-top:2px}
  .gate-row-dot{width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(214,255,246,.4)}
  .gitem.is-active .gate-row-dot,.gitem.is-complete .gate-row-dot{border-color:var(--mc-chartreuse);background:rgba(224,255,79,.75)}
  .gitem.is-selected .gate-row-dot{border-color:var(--mc-chartreuse);background:transparent;box-shadow:0 0 0 2px rgba(224,255,79,.2)}
  .gitem.is-blocked .gate-row-dot{border-color:var(--mc-peach);background:var(--mc-peach)}
  .gitem.is-proof-needed .gate-row-dot{border-style:dashed;border-color:rgba(214,255,246,.55);background:transparent}
  .gitem.is-locked .gate-row-dot,.gitem.is-idle .gate-row-dot{border-color:rgba(214,255,246,.3);background:rgba(214,255,246,.18)}
  .gitem.is-stale .gate-row-dot{border-style:dotted;border-color:rgba(214,255,246,.35);background:transparent}
  .grow-chev{appearance:none;background:none;border:0;color:var(--soft);opacity:.6;font:18px/1 var(--mono);min-width:32px;min-height:44px;cursor:pointer}
  .grow-chev:active{transform:scale(.94)}
  .gitem .gpriority{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px 60px}
  .gpriority span{border:1px solid rgba(255,199,161,.36);border-radius:999px;padding:4px 8px;color:var(--warn);font:10px var(--mono);background:rgba(255,199,161,.04)}
  .gate-stale-chip{display:inline-flex;align-items:center;width:max-content;max-width:100%;border:1px dashed rgba(255,199,161,.42);border-radius:999px;color:var(--warn);padding:3px 7px;font:10px var(--mono);margin:0 0 8px 60px;overflow-wrap:anywhere}
  .gate-proof-row{appearance:none;width:100%;min-height:56px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;
    border:1px solid var(--line);border-radius:8px;padding:9px 10px;margin:0 0 10px;background:rgba(1,47,52,.24);color:var(--soft);font:11px/1.35 var(--mono);text-align:left;cursor:pointer}
  .gate-proof-row:active{transform:scale(.99)}
  .gate-proof-row .mc-glyph{width:34px;height:34px;border-radius:8px}
  .gate-proof-copy{display:block;min-width:0}
  .gate-proof-copy b{display:block;color:var(--ink);font-size:12px;line-height:1.25;font-weight:650;margin-bottom:3px}
  .gate-proof-copy small{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;font:10.5px/1.4 var(--mono);opacity:.72;overflow-wrap:anywhere}
  .gate-proof-open{font:20px/1 var(--mono);color:var(--ink);opacity:.72}
  .gate-empty .mc-signal-rail,.gate-error .mc-signal-rail{margin-top:9px}

  /* ── Gate Attention strip (frozen/03 strip 5): quiet → attention (peach stroke + triangle, once) → review (filled peach pill) ── */
  .gate-attention{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;
    border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:rgba(1,47,52,.28);font:11px var(--mono)}
  .gate-attention .mc-glyph{width:28px;height:28px}
  .gate-attn-copy{color:var(--soft);opacity:.85;overflow-wrap:anywhere}
  .gate-attn-chev{color:var(--soft);opacity:.5;font:16px/1 var(--mono)}
  .gate-attn-triangle{width:18px;height:18px;display:grid;place-items:center;color:var(--mc-peach)}
  .gate-attn-triangle svg{width:18px;height:18px;display:block}
  .gate-attention.is-attention{animation:warningAttention .9s var(--ease) 1 both;border-color:rgba(255,199,161,.62)}
  .gate-attention.is-review{border-color:rgba(255,199,161,.62);background:rgba(255,199,161,.045)}
  .gate-attn-review{appearance:none;border:0;border-radius:999px;background:var(--warn);color:var(--bg);
    font:650 11px/1 var(--mono);padding:8px 14px;min-height:32px;cursor:pointer}
  .gate-attn-review:active{transform:scale(.96)}

  /* ── T-018 GateActionRow (frozen/01): primary solid chartreuse fill dark text; secondary transparent 1px chartreuse border ── */
  .gbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .gbtns button{appearance:none;min-height:44px;border:0;border-radius:10px;padding:11px;font:600 13px inherit;cursor:pointer;
    transition:transform .2s var(--ease)}
  .gbtns button:active{transform:scale(.97)}
  .gbtns .approve{background:var(--ink);color:var(--bg)}
  .gbtns .reroll{background:none;border:1px solid rgba(214,255,246,.4);color:var(--soft)}
  .gbtns .detail{background:rgba(1,47,52,.5);border:1px solid var(--line2);color:var(--ink)}
  .gbtns button:disabled{cursor:wait;opacity:.72;transform:none}
  .gate-actions{display:flex;gap:8px}
  .gate-actions button{flex:1 1 0}
  .gate-actions .approve{flex:1 1 0;background:var(--ink);color:var(--bg)}
  .gate-actions .reroll,.gate-actions .detail{flex:1 1 0;background:transparent;border:1px solid rgba(224,255,79,.45);color:var(--ink)}
  .gate-actions.is-queued{align-items:stretch}
  .gate-actions.is-queued .detail{flex:0 0 auto;min-width:96px}
  .gate-queued-state{flex:1 1 0;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;border:1px solid rgba(224,255,79,.3);
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
  .gate-submit-status:empty{display:none}
  .gate-submit-status[data-gate-submit-status="pending"]{border-style:dashed;background:rgba(224,255,79,.07)}

`;
