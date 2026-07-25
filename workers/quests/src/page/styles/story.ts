// cambium-quests · miniapp page chunk — Story scene CSS (T-021 signal rows + T-022 PacketFlow rails).
// frozen/01: state = icon + color + rail style (peach #FFC7A1 = blocked only; dotted/dashed =
// pending or in-transit; solid = settled). frozen/03 rule 4: reduced motion = static dots, zero
// translation — handled globally in styles/states.ts plus the !RM data-motion gate in the
// SignalRail/PacketFlow builders. frozen/04: in-app card radius ≤ 8px. Assembly order: page/index.ts.
// Note: @keyframes rise is defined here once — gate/inspect rows referenced it since the T-009
// monolith split without a definition (dangling animation name); defining it repairs all three.
export const STYLE_STORY = `  /* ── story — beats as signal rows, PacketFlow rails between them ── */
  @keyframes rise{to{opacity:1;transform:none}}
  #beats{position:relative;display:flex;flex-direction:column;gap:12px}
  .story-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center}
  button.story-hero{appearance:none;text-align:left;color:var(--soft);cursor:pointer}
  .story-hero .mc-glyph{width:32px;height:32px}
  .story-hero[data-component="StoryDigestCards"]{grid-template-columns:auto minmax(0,1fr) auto}
  .story-teaser{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;min-width:0}
  .story-teaser-outcome{color:var(--soft)}
  .story-teaser-proof{padding-left:6px;border-left:1px solid var(--line);color:var(--mc-mint);overflow-wrap:anywhere}
  .story-teaser-proof.is-blocked{color:var(--mc-peach);border-left-color:rgba(255,199,161,.4)}
  .story-timeline{display:flex;gap:6px;padding:8px;margin-bottom:2px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28)}
  .story-timeline i{height:5px;flex:1;border-radius:999px;background:rgba(214,255,246,.16)}
  .story-timeline i.is-complete{background:rgba(224,255,79,.55)}
  .story-timeline i.is-blocked{background:rgba(255,199,161,.55)}
  .story-timeline i.is-stale{background:rgba(214,255,246,.3)}
  .story-group{display:grid;gap:8px}
  .story-group .cmdgrp{margin:4px 0 0}
  .story-group-body{display:grid;gap:6px}

  /* signal row (T-021): MissionGlyph + evidence teaser + StateToken; full beat text stays off the card */
  .beat{appearance:none;text-align:left;color:var(--soft);position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;min-width:0;
    padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.38);
    opacity:0;transform:translateY(10px);font-size:13px;line-height:1.4;
    animation:rise .5s var(--ease) forwards;animation-delay:calc(var(--i)*38ms);cursor:pointer}
  .beat:active{transform:scale(.985)}
  .beat .mc-glyph{width:26px;height:26px}
  .story-signal-copy{display:grid;gap:2px;min-width:0;font:11px/1.35 var(--mono)}
  .beat .mc-state-token{justify-self:end;max-width:104px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .beat.is-complete,.beat.is-active{border-color:rgba(224,255,79,.3)}
  .beat.is-blocked{border-color:rgba(255,199,161,.42)}
  .beat.is-stale{border-color:rgba(214,255,246,.14);opacity:.82}
  .beat.is-proof-needed{border-style:dashed}
  .beat.noesis{border-color:rgba(214,255,246,.3)}

  /* PacketFlow rails between beats (T-022): the rail line is centered under the dots; dots sit
     on the rail only, never over text. Rail style carries state: solid chartreuse = settled run,
     dashed mint = pending, dotted = stale, dashed peach + end marker = blocked. */
  .story-packet-rail{display:block;padding:0 18px;margin:-2px 0}
  .story-packet-rail .mc-signal-rail{min-height:14px;border:0}
  .story-packet-rail .mc-signal-rail::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px solid var(--line)}
  .story-packet-rail .mc-signal-rail.is-active::before,.story-packet-rail .mc-signal-rail.is-complete::before{border-top-color:rgba(224,255,79,.5)}
  .story-packet-rail .mc-signal-rail.is-blocked::before{border-top:1px dashed rgba(255,199,161,.5)}
  .story-packet-rail .mc-signal-rail.is-proof-needed::before,.story-packet-rail .mc-signal-rail.is-locked::before{border-top-style:dashed;border-top-color:rgba(214,255,246,.3)}
  .story-packet-rail .mc-signal-rail.is-stale::before{border-top-style:dotted;border-top-color:rgba(214,255,246,.25)}
  .story-packet-rail .mc-packet-dots{position:relative;min-height:14px}
  .story-packet-rail .mc-packet{width:3px;height:3px}

  /* beat sheet: full text + state tokens, no kv wall (frozen/06 S5) */
  .story-sheet-tokens{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
  .story-sheet-note{display:flex;gap:8px;align-items:center;font:11px var(--mono);opacity:.8;margin:8px 0}

`;
