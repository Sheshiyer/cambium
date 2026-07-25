// cambium-quests · miniapp page chunk — Tools scene CSS (live action surfaces, T-019/T-020 rebuild).
// frozen/README: peach #FFC7A1 = blocked only (stale/locked ride dim mint dash/dot styles);
// state is icon + color + rail style, never color alone. .cmdgrp/.li/.cname/.cargs stay shared
// with Story and Inspect. Assembly order: page/index.ts.
export const STYLE_TOOLS = `  /* ── tools · live action surfaces ───────────── */
  .cmdgrp{font:10px var(--mono);letter-spacing:0;text-transform:uppercase;opacity:.45;margin:18px 0 9px}
  .cmdgrp:first-child{margin-top:4px}
  .tool-recommend{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:10px;border:1px solid rgba(224,255,79,.22);border-radius:var(--mc-radius);padding:10px 12px;background:rgba(1,47,52,.34)}
  .tool-recommend.is-idle{border-style:dashed;opacity:.78}
  .tool-recommend .mc-glyph{width:31px;height:31px}
  .tool-recommend span{min-width:0}
  .tool-recommend b{display:block;color:var(--ink);font-size:13px}
  .tool-recommend small{display:block;color:var(--soft);opacity:.78;font-size:11px;line-height:1.4;margin-top:2px;overflow-wrap:anywhere}
  .tool-recommend button{appearance:none;min-height:36px;border:1px solid rgba(224,255,79,.45);border-radius:999px;background:transparent;color:var(--mc-chartreuse);padding:7px 13px;font:600 11.5px var(--mono);cursor:pointer}
  .tool-recommend button:active{transform:scale(.96)}
  .tool-context-strip,.tool-recent-strip,.story-filter-strip,.gate-filter-strip{display:flex;flex-wrap:wrap;gap:7px;overflow:hidden;padding:8px;margin-bottom:10px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28)}
  .tool-context-strip span,.tool-context-strip button,.tool-recent-strip button,.story-filter-strip button,.gate-filter-strip button{flex:0 1 auto;min-width:0;max-width:100%;min-height:36px;border:1px solid var(--line2);border-radius:999px;background:rgba(1,47,52,.36);color:var(--soft);padding:6px 9px;font:10.5px/1.2 var(--mono);white-space:normal;overflow-wrap:anywhere}
  .tool-context-strip button,.tool-recent-strip button,.story-filter-strip button,.gate-filter-strip button{appearance:none;cursor:pointer}
  .tool-context-strip button.is-selected,.story-filter-strip button.is-selected,.gate-filter-strip button.is-selected{border-color:rgba(224,255,79,.48);color:var(--ink);background:rgba(224,255,79,.08)}
  .tool-context-item{display:inline-flex;align-items:center;gap:6px}
  .tool-context-item b{color:var(--ink);font-weight:650}
  .tool-context-item .mc-state-token{border:0;background:none;padding:0;min-height:0}
  .tool-safety-row{display:flex;align-items:center;gap:8px;font:11px/1.45 var(--mono);opacity:.78;margin-top:10px;border-top:1px solid var(--line);padding-top:9px}
  .cmd{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:12px 13px;margin-bottom:8px;
    text-align:left;
    color:var(--soft);font:inherit;
    border:1px solid var(--line);border-radius:var(--mc-radius);background:rgba(1,47,52,.34)}
  .cmd .mc-glyph{width:31px;height:31px}
  .cmd .tool-body{min-width:0;display:grid;gap:3px}
  .cmd .cname{font:600 13.5px var(--mono);color:var(--ink)}
  .cmd .tool-count{font:10.5px var(--mono);color:var(--soft);opacity:.62;overflow-wrap:anywhere}
  .cmd{cursor:pointer;transition:transform .2s var(--ease),border-color .3s var(--ease)}
  .cmd:active{transform:scale(.985)}
  .cmd.is-active,.cmd.is-complete{border-color:rgba(224,255,79,.28)}
  .cmd.is-stale{border-style:dotted;border-color:rgba(214,255,246,.28);opacity:.72}
  .cmd.is-locked{border-style:dashed;border-color:rgba(214,255,246,.34);opacity:.8}
  .cmd.is-blocked{border-color:rgba(255,199,161,.42);border-style:dashed}
  .cmd[data-tool-focus="1"]{box-shadow:0 0 0 1px rgba(224,255,79,.45),inset 0 1px 0 rgba(255,255,255,.08)}
  .cmd .mc-state-token{justify-self:end}
  .cmd .cgo{font-size:20px;color:var(--ink);opacity:.6}
  .tool-result-line{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:9px 10px;margin:0 0 10px;background:rgba(1,47,52,.24);font:11.5px/1.4 var(--mono);color:var(--soft);overflow-wrap:anywhere}
  .tool-handoff-row{display:grid;gap:9px;border:1px solid var(--line);border-radius:var(--mc-radius);padding:10px;margin:0 0 10px;background:rgba(1,47,52,.28)}
  .tool-handoff-row .mc-glyph{width:28px;height:28px}
  .tool-handoff-copy{display:block;min-width:0}
  .tool-handoff-copy b{display:block;color:var(--ink);font:650 12px/1.3 var(--mono);overflow-wrap:anywhere}
  .tool-handoff-copy small{display:block;margin-top:2px;font:10px/1.3 var(--mono);opacity:.6;overflow-wrap:anywhere}
  .tool-handoff-actions{display:flex;gap:8px}
  .tool-handoff-actions button{flex:1 1 0}
  .li{padding:9px 0;border-bottom:1px solid var(--line)}
  .li:last-child{border-bottom:0}
  .li .cname{font:600 13px var(--mono);color:var(--soft)}
  .li .cargs{font:10.5px var(--mono);color:var(--ink);opacity:.7;text-transform:uppercase}

  /* min-height:0 lets the flex track be constrained to its allocated height
     (not grow to content) so the scenes' overflow-y:auto actually scrolls. */
  .track{width:100%;max-width:100%;min-width:0;flex:1;min-height:0;display:flex;will-change:transform;touch-action:pan-y}
  .scene{flex:0 0 100%;width:100%;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;
    padding:18px 18px calc(var(--sab) + 118px);overscroll-behavior:contain}

`;
