// cambium-quests · miniapp page chunk — frozen shared component CSS (T-013/T-014)
// Spec: docs/plans/assets/tg-miniapp-mission-control-reference/frozen/01-component-anatomy.md,
// frozen/03-motion-spec.md, frozen/04-tokens-and-atlas.md. Implements the frozen anatomy exactly:
// state = icon + color + rail style (never color alone); chartreuse = current/actionable,
// peach #FFC7A1 = blocked/warning only, dotted/dashed = pending/in-transit, solid = settled.
// `proof-needed` is the runtime alias for the PENDING (dashed mint ring) treatment — not a 9th state.
export const STYLE_COMPONENTS = `  /* ── frozen shared components (T-013/T-014) ───── */
  /* 5 named animations, frozen/03: orbitSweep, packetDrift, glyphBreathe, warningAttention, reducedMotion. */
  /* orbitSweep: arc grows clockwise from 12 o'clock over the dotted track; static dashoffset is the resting state. */
  @keyframes orbitSweep{from{stroke-dashoffset:100}}
  /* packetDrift: ghosted trail along the rail; reduced-motion fallback = static dots, zero translation. */
  @keyframes packetDrift{0%{transform:translateX(-8%);opacity:.42}50%{opacity:.95}100%{transform:translateX(8%);opacity:.5}}
  /* glyphBreathe: subtle glyph emphasis; pairs with orbitSweep on selection (max 2 simultaneous). */
  @keyframes glyphBreathe{0%,100%{transform:scale(1);opacity:.86}50%{transform:scale(1.035);opacity:1}}
  /* warningAttention: persistent peach stroke + icon change, runs once, never pulses, no flashing. */
  @keyframes warningAttention{from{border-color:rgba(214,255,246,.16)}to{border-color:rgba(255,199,161,.62)}}

  /* MissionGlyph — identity mark, not a button; labels stay text-first (aria-hidden svg). */
  .mc-glyph{width:28px;height:28px;border:1px solid var(--mc-line-strong);border-radius:var(--mc-radius);display:inline-grid;place-items:center;color:var(--mc-chartreuse);background:var(--mc-panel);position:relative;overflow:hidden;flex:none}
  .mc-glyph svg{width:80%;height:80%;display:block;stroke:currentColor;fill:none;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
  .mc-glyph .mc-fill{fill:currentColor;opacity:.16;stroke:currentColor}
  .mc-glyph .mc-core{fill:currentColor;stroke:none;opacity:.86}
  .mc-glyph .mc-soft{opacity:.42}
  .mc-glyph .mc-dash{stroke-dasharray:1.4 2.5}
  .mc-glyph.is-idle{color:rgba(214,255,246,.5);border-color:var(--mc-line);opacity:.78}
  .mc-glyph.is-active,.mc-glyph.is-selected,.mc-glyph.is-complete{border-color:rgba(224,255,79,.42);background:var(--mc-active-fill)}
  .mc-glyph.is-active::after,.mc-glyph.is-selected::after{content:"";position:absolute;inset:2px;border-radius:inherit;border:1px solid rgba(224,255,79,.24);pointer-events:none}
  .mc-glyph.is-blocked{color:var(--mc-peach);border-color:rgba(255,199,161,.5);background:var(--mc-warning-fill)}
  .mc-glyph.is-proof-needed{color:var(--mc-mint);border-style:dashed;border-color:rgba(214,255,246,.34)}
  .mc-glyph.is-locked{color:rgba(214,255,246,.46);border-color:rgba(214,255,246,.1);opacity:.72}
  .mc-glyph.is-stale{color:rgba(214,255,246,.38);border-color:rgba(214,255,246,.12);opacity:.66}
  .mc-glyph.is-reduced-motion{color:var(--mc-mint);border-color:rgba(214,255,246,.3)}
  .mc-glyph[data-motion="glyphBreathe"] svg{transform-origin:center;animation:glyphBreathe 3.4s var(--ease) infinite}
  /* gate glyph is ALWAYS peach, every state (frozen/01 MissionGlyph table). */
  .mc-glyph[data-glyph-kind="gate"]{color:var(--mc-peach);border-color:rgba(255,199,161,.52);background:var(--mc-warning-fill);opacity:1}

  /* StateToken — 8 states, icon + color + ring/dash treatment. proof-needed = pending dashed ring. */
  .mc-state-token{display:inline-flex;align-items:center;gap:6px;min-height:24px;border:1px solid var(--mc-line);border-radius:999px;padding:4px 8px;font:10px var(--mono);color:var(--mc-mint)}
  .mc-token-icon{display:inline-grid;place-items:center;width:12px;height:12px;flex:none}
  .mc-token-icon svg{width:12px;height:12px;display:block}
  .mc-state-token.is-idle{opacity:.62}
  .mc-state-token.is-active{color:var(--mc-chartreuse);border-color:rgba(224,255,79,.38)}
  .mc-state-token.is-selected{color:var(--mc-chartreuse);border-color:rgba(224,255,79,.5);box-shadow:0 0 0 1px rgba(224,255,79,.22)}
  .mc-state-token.is-complete{color:var(--mc-chartreuse);border-color:rgba(224,255,79,.38)}
  .mc-state-token.is-blocked{color:var(--mc-peach);border-color:rgba(255,199,161,.55);background:var(--mc-warning-fill);animation:warningAttention .9s var(--ease) 1 both}
  .mc-state-token.is-proof-needed{color:var(--mc-mint);border-style:dashed;border-color:rgba(214,255,246,.4)}
  .mc-state-token.is-locked{opacity:.66;border-style:dashed}
  .mc-state-token.is-stale{opacity:.55;border-style:dotted}
  .mc-state-token.is-reduced-motion{color:var(--mc-mint);border-color:rgba(214,255,246,.34)}

  /* OrbitProgress — dotted mint track, solid chartreuse arc clockwise from 12 o'clock, 4 cardinal nodes. */
  .mc-orbit{position:relative;width:48px;height:48px;display:inline-grid;place-items:center;color:var(--mc-chartreuse);font:10px var(--mono);flex:none}
  .mc-orbit-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .mc-orbit-track{fill:none;stroke:rgba(214,255,246,.4);stroke-width:2;stroke-linecap:round;stroke-dasharray:.5 5.4}
  .mc-orbit-arc{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-dasharray:100}
  .mc-orbit-node{fill:rgba(214,255,246,.5)}
  .mc-orbit-label{position:relative;z-index:1;text-align:center;max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-orbit[data-motion="orbitSweep"] .mc-orbit-arc{animation:orbitSweep 1.4s var(--ease) both}
  .mc-orbit.is-active .mc-orbit-node,.mc-orbit.is-complete .mc-orbit-node{fill:var(--mc-chartreuse)}
  /* blocked: peach dashed track, no fill, peach warning triangle centered. */
  .mc-orbit.is-blocked{color:var(--mc-peach)}
  .mc-orbit.is-blocked .mc-orbit-track{stroke:rgba(255,199,161,.55);stroke-dasharray:3.4 3.4}
  .mc-orbit.is-blocked .mc-orbit-arc{display:none}
  .mc-orbit.is-blocked .mc-orbit-node{fill:rgba(255,199,161,.5)}
  .mc-orbit.is-blocked .mc-orbit-label{transform:translateY(14px);font-size:8px}
  .mc-orbit-warning{fill:none;stroke:var(--mc-peach)}
  .mc-orbit-warning-fill{fill:var(--mc-peach)}
  /* stale: faint dashed track, dimmer nodes, no fill. */
  .mc-orbit.is-stale{color:rgba(214,255,246,.42)}
  .mc-orbit.is-stale .mc-orbit-track{stroke:rgba(214,255,246,.2);stroke-dasharray:2.4 4.6}
  .mc-orbit.is-stale .mc-orbit-arc{display:none}
  .mc-orbit.is-stale .mc-orbit-node{fill:rgba(214,255,246,.26)}
  .mc-orbit.is-locked{color:rgba(214,255,246,.48)}
  .mc-orbit.is-locked .mc-orbit-track{stroke-dasharray:4 3}
  .mc-orbit.is-proof-needed .mc-orbit-track{stroke-dasharray:3.4 3.2}
  /* reducedMotion state: full solid thin mint ring, static, no packets. */
  .mc-orbit.is-reduced-motion{color:var(--mc-mint)}
  .mc-orbit.is-reduced-motion .mc-orbit-track{stroke:rgba(214,255,246,.6);stroke-dasharray:none;stroke-width:1.5}
  .mc-orbit.is-reduced-motion .mc-orbit-arc{display:none}
  .mc-orbit.is-reduced-motion .mc-orbit-node{fill:rgba(214,255,246,.4)}
  .mc-orbit .mc-packet-dots{position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);min-height:6px;gap:3px;animation:none}

  /* SelectedHalo — double concentric chartreuse ring (outer + inner), static. */
  .mc-selected-halo{position:relative;box-shadow:0 0 0 1px rgba(224,255,79,.5)}
  .mc-selected-halo::before{content:"";position:absolute;inset:-5px;border-radius:inherit;border:1px solid rgba(224,255,79,.3);pointer-events:none}
  .mc-selected-halo::after{content:"";position:absolute;inset:3px;border-radius:inherit;border:1px solid rgba(224,255,79,.22);pointer-events:none}

  /* SignalRail — idle/active solid; blocked dashed peach; locked + proof-needed(pending) dashed mint. */
  .mc-signal-rail{position:relative;min-height:20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center}
  .mc-signal-rail.is-active{border-color:rgba(224,255,79,.34)}
  .mc-signal-rail.is-blocked{border-color:rgba(255,199,161,.45);border-style:dashed}
  .mc-signal-rail.is-proof-needed{border-style:dashed;border-color:rgba(214,255,246,.28)}
  .mc-signal-rail.is-locked{border-style:dashed;opacity:.62}
  .mc-signal-rail .mc-rail-end{position:absolute;right:2px;top:50%;width:7px;height:7px;border:1px solid var(--mc-peach);transform:translateY(-50%) rotate(45deg);background:rgba(255,199,161,.1)}

  /* PacketFlow — small chartreuse squares on rails only, never over text; static under reduced motion. */
  .mc-packet-dots{display:flex;gap:5px;align-items:center;justify-content:center;min-height:20px;max-width:100%;overflow:hidden}
  .mc-packet-dots[data-motion="packetDrift"]{animation:packetDrift 3.6s var(--ease) infinite alternate}
  .mc-packet{width:4px;height:4px;border-radius:1px;background:var(--ink);box-shadow:0 0 7px rgba(224,255,79,.34);flex:0 0 auto}
  .mc-packet-dots.is-blocked .mc-packet{background:var(--mc-peach);box-shadow:0 0 7px rgba(255,199,161,.2)}
  .mc-packet-dots.is-proof-needed .mc-packet{background:rgba(214,255,246,.5);box-shadow:none}
  .mc-packet-dots.is-stale .mc-packet{background:rgba(214,255,246,.3);box-shadow:none}

  /* KpiPulse — dotted-ring badge (OrbitProgress) + 2-line mono label + ~15 chartreuse spark bars. */
  .mc-kpi-bars{display:flex;gap:2px;align-items:flex-end;min-height:14px}
  .mc-kpi-bars i{width:2px;height:var(--mc-spark-h,6px);border-radius:1px;background:rgba(214,255,246,.14)}
  .mc-kpi-bars i[data-active="true"]{background:rgba(224,255,79,.72);box-shadow:0 0 6px rgba(224,255,79,.16)}
  .mc-kpi-bars.is-blocked i[data-active="true"]{background:rgba(255,199,161,.66);box-shadow:0 0 6px rgba(255,199,161,.14)}

  /* legend assets (frozen vocabulary): node/rail/packet/orbit/active/warning/locked/stale */
  .component-legend-node{width:18px;height:18px;border-radius:50%;border:1px solid var(--line2);background:rgba(1,47,52,.45)}
  .component-legend-node.is-rail{width:32px;height:2px;border-radius:2px;background:var(--line2)}
  .component-legend-node.is-packet{width:7px;height:7px;border-radius:1px;background:var(--ink);box-shadow:0 0 8px rgba(224,255,79,.38)}
  .component-legend-node.is-orbit{border-color:rgba(214,255,246,.5);border-style:dashed;background:transparent}
  .component-legend-node.is-active{border-color:var(--mc-chartreuse);background:transparent;box-shadow:0 0 6px rgba(224,255,79,.3)}
  .component-legend-node.is-warning{width:0;height:0;border-radius:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid rgba(255,199,161,.85);border-top:0;background:transparent}
  .component-legend-node.is-locked{opacity:.46;border-style:dashed}
  .component-legend-node.is-stale{border-color:rgba(214,255,246,.3);border-style:dotted;opacity:.6}
`;
