// cambium-quests · miniapp page chunk — Tools scene CSS (commands panel)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_TOOLS = `  /* ── commands panel ─────────────────────────── */
  .cmdgrp{font:10px var(--mono);letter-spacing:0;text-transform:uppercase;opacity:.45;margin:18px 0 9px}
  .cmdgrp:first-child{margin-top:4px}
  .tool-recommend{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:10px;border-color:rgba(224,255,79,.22)}
  .tool-recommend.is-idle{border-style:dashed;opacity:.78}
  .tool-context-strip,.tool-recent-strip,.story-filter-strip,.gate-filter-strip{display:flex;flex-wrap:wrap;gap:7px;overflow:hidden;padding:8px;margin-bottom:10px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28)}
  .tool-context-strip span,.tool-context-strip button,.tool-recent-strip button,.story-filter-strip button,.gate-filter-strip button{flex:0 1 auto;min-width:0;max-width:100%;min-height:36px;border:1px solid var(--line2);border-radius:999px;background:rgba(1,47,52,.36);color:var(--soft);padding:6px 9px;font:10.5px/1.2 var(--mono);white-space:normal;overflow-wrap:anywhere}
  .tool-context-strip button,.tool-recent-strip button,.story-filter-strip button,.gate-filter-strip button{appearance:none;cursor:pointer}
  .tool-context-strip button.is-selected,.story-filter-strip button.is-selected,.gate-filter-strip button.is-selected{border-color:rgba(224,255,79,.48);color:var(--ink);background:rgba(224,255,79,.08)}
  .tool-safety-row{font:11px/1.45 var(--mono);opacity:.72;margin-top:10px;border-top:1px solid var(--line);padding-top:9px}
  .cmd{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:flex-start;gap:10px;padding:12px 13px;margin-bottom:8px;
    text-align:left;
    color:var(--soft);font:inherit;
    border:1px solid var(--line);border-radius:12px;background:rgba(1,47,52,.34)}
  .cmd .mc-glyph{width:31px;height:31px;margin-top:1px}
  .cmd .tool-body{min-width:0}
  .cmd .cname{font:600 13.5px var(--mono);color:var(--ink)}
  .cmd.act .cname{color:var(--soft)}
  .cmd .cargs{font:11px var(--mono);opacity:.5;margin-left:6px}
  .cmd .cdesc{color:var(--soft);font-size:12.5px;opacity:.78;line-height:1.45}
  .cmd .cdesc b{display:block;color:var(--soft);font-weight:650;margin-bottom:2px}
  .tool-syntax{margin-top:5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cmd{cursor:pointer;transition:transform .2s var(--ease),border-color .3s var(--ease)}
  .cmd:active{transform:scale(.985)}
  .cmd.live{border-color:rgba(224,255,79,.22)}
  .cmd.is-stale{border-color:rgba(255,199,161,.35)}
  .cmd.is-blocked,.cmd.is-locked{border-color:rgba(255,199,161,.42);border-style:dashed}
  .cmd[data-tool-focus="1"]{box-shadow:0 0 0 1px rgba(224,255,79,.45),inset 0 1px 0 rgba(255,255,255,.08)}
  .cmd .mc-state-token{align-self:center}
  .cmd .cgo{align-self:center;font-size:20px;color:var(--ink);opacity:.6}
  .tool-card-meta{grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}
  .tool-card-meta span{border:1px solid var(--line);border-radius:999px;padding:3px 7px;font:9.5px var(--mono);opacity:.7}
  .tool-disabled-reason{grid-column:2 / -1;color:var(--warn);font:10.5px/1.35 var(--mono);margin-top:3px}
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
