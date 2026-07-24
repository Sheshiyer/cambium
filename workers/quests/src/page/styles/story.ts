// cambium-quests · miniapp page chunk — Story scene CSS (narrative cards)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_STORY = `  /* ── story — the continuous narrative, as cards ── */
  #beats{position:relative;display:flex;flex-direction:column;gap:12px}
  #beats::before{content:"";position:absolute;left:-2px;top:8px;bottom:8px;width:1.5px;pointer-events:none;
    background:linear-gradient(rgba(224,255,79,.32),var(--line));opacity:.55}
  .story-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center}
  button.story-hero{appearance:none;text-align:left;color:var(--soft);cursor:pointer}
  .story-hero .mc-glyph{width:32px;height:32px}
  .story-hero[data-component="StoryDigestCards"]{grid-template-columns:auto minmax(0,1fr) auto}
  .story-timeline{display:flex;gap:6px;padding:8px;margin-bottom:2px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28)}
  .story-timeline i{height:5px;flex:1;border-radius:999px;background:rgba(214,255,246,.16)}
  .story-timeline i.is-complete{background:rgba(224,255,79,.55)}
  .story-timeline i.is-blocked,.story-timeline i.is-stale{background:rgba(255,199,161,.55)}
  .story-group{display:grid;gap:8px}
  .story-group .cmdgrp{margin:4px 0 0}
  .story-group-body{display:grid;gap:8px}
  .beat{appearance:none;text-align:left;color:var(--soft);position:relative;padding:12px 14px 12px 46px;border:1px solid var(--line);border-radius:13px;
    background:rgba(1,47,52,.38);opacity:0;transform:translateY(10px);font-size:13.5px;line-height:1.5;
    animation:rise .5s var(--ease) forwards;animation-delay:calc(var(--i)*38ms);cursor:pointer}
  .beat:active{transform:scale(.985)}
  .beat .ico{position:absolute;left:12px;top:11px;width:21px;height:21px;display:grid;place-items:center;
    border-radius:7px;background:var(--bg2);border:1px solid var(--line)}
  .beat .ico .mc-glyph{width:21px;height:21px;border:0;background:transparent}
  .beat .ico svg{width:12px;height:12px;stroke:var(--soft);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.8}
  .beat .lane{display:block;font:9.5px var(--mono);letter-spacing:0;text-transform:uppercase;opacity:.5;margin-bottom:3px}
  .beat b{color:var(--soft)}
  .beat small{display:block;font:10.5px/1.35 var(--mono);opacity:.64;margin-top:4px;overflow-wrap:anywhere}
  .beat .mc-state-token{margin-top:8px}
  .beat.is-stale,.beat.is-blocked{border-color:rgba(255,199,161,.34)}
  .beat.noesis{border-color:rgba(214,255,246,.4);background:var(--glass);backdrop-filter:blur(10px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 20px rgba(214,255,246,.05)}
  .beat.noesis .ico{border-color:rgba(214,255,246,.5)}
  .beat.noesis .ico svg{opacity:1}
  .beat.noesis .lane{color:var(--soft);opacity:.85}

`;
