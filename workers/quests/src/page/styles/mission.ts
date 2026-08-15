// cambium-quests · miniapp page chunk — Mission scene CSS (T-015 hero card + T-016 QuestlineTimeline).
// frozen/02-screen-composition.md §1-4: hero mission card (mono chartreuse eyebrow, bold sans
// paper-white title, 4-row mono meta grid, right-side branch-arc constellation texture) with the
// questline timeline INSIDE the card; frozen/01 connector grammar (solid chartreuse behind
// complete→active, dashed muted past the active node); frozen/03 motion hooks (orbitSweep on the
// active station orbit, packetDrift on solid/active rails; reduced-motion static fallbacks are
// covered by the global prefers-reduced-motion block in styles/states.ts).
// Legacy rules consumed by other chunks (story/tools/inspect scenes + component gallery) are kept.
// Assembly order: page/index.ts.
export const STYLE_MISSION = `  /* ── mission scene — visual-first (T-015/T-016) ── */
  .stem{position:relative}
  .stem.mission-control{width:100%;min-width:0;padding-left:0;display:grid;gap:12px;--grow:0%}
  .stem.mission-control>*{min-width:0}
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

  /* EMPTY panel (frozen/04): dashed circle + node icon, ≤12 words + actions */
  .mission-empty{border:1px dashed rgba(214,255,246,.3);border-radius:8px;padding:14px;background:rgba(1,47,52,.34)}
  .mission-empty b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
  .mission-empty p{font-size:13px;opacity:.76;margin-bottom:12px}
  .mc-empty-orbit{display:grid;place-items:center;width:34px;height:34px;margin-bottom:10px;border:1px dashed rgba(214,255,246,.4);border-radius:50%;color:var(--mc-mint)}
  .mc-empty-orbit svg{width:16px;height:16px}

  /* BranchArcChip rail (frozen/02 §2): glyph + name + mono count + state icon; selected = halo */
  .mc-branch-chip{appearance:none;text-align:left;cursor:pointer;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:8px;align-items:center}
  .mc-branch-copy{display:block;min-width:0}
  .mc-branch-copy b{display:block;color:var(--ink);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mc-branch-copy small{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.72;font:10px/1.25 var(--mono)}
  .mc-branch-count{font:10px var(--mono);color:var(--mc-chartreuse);white-space:nowrap}
  .mc-branch-state-icon{display:inline-grid;place-items:center;width:12px;height:12px;flex:none}
  .mc-branch-state-icon svg{width:12px;height:12px;display:block}
  .mc-branch-state-icon.is-active,.mc-branch-state-icon.is-selected,.mc-branch-state-icon.is-complete{color:var(--mc-chartreuse)}
  .mc-branch-state-icon.is-blocked{color:var(--mc-peach)}
  .mc-branch-state-icon.is-locked,.mc-branch-state-icon.is-stale,.mc-branch-state-icon.is-idle{color:rgba(214,255,246,.5)}
  .mc-branch-state-icon.is-proof-needed{color:var(--mc-mint)}
  .mc-branch-chip .mc-glyph{width:25px;height:25px;border-radius:7px}
  .mc-branch-chip .mc-state-token{flex:none;min-height:20px;max-width:88px;padding:3px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-branch-chip.is-selected{border-color:rgba(224,255,79,.55);background:rgba(224,255,79,.065)}
  /* Chip state colors (frozen/02 §2): blocked = peach, stale = muted gray NO accent, locked = dim.
     State wins over the chartreuse default; selection still rides the halo + aria-selected. */
  .mc-branch-chip.is-blocked{border-color:rgba(255,199,161,.5)}
  .mc-branch-chip.is-blocked .mc-branch-copy b{color:var(--mc-peach)}
  .mc-branch-chip.is-blocked .mc-branch-count{color:var(--mc-peach)}
  .mc-branch-chip.is-stale{border-color:rgba(214,255,246,.18)}
  .mc-branch-chip.is-stale .mc-branch-copy b{color:rgba(214,255,246,.5)}
  .mc-branch-chip.is-stale .mc-branch-count{color:rgba(214,255,246,.45)}
  .mc-branch-chip.is-locked .mc-branch-copy b{color:rgba(214,255,246,.45)}
  .mc-branch-chip.is-locked .mc-branch-count{color:rgba(214,255,246,.4)}
  .mc-section-title{font:11px var(--mono);color:var(--ink);text-transform:uppercase;letter-spacing:0;margin:3px 0}

  /* hero mission card (frozen/02 §3): surface fill, 1px border, faint contour, constellation right */
  .mc-mission-card{position:relative;overflow:hidden;border:1px solid rgba(224,255,79,.36);background:rgba(1,47,52,.42);padding:16px;border-radius:8px;display:grid;gap:10px}
  .mc-mission-card.is-blocked{border-color:rgba(255,199,161,.5);background:linear-gradient(rgba(255,199,161,.045),rgba(1,47,52,.42))}
  .mc-mission-card::before{content:"";position:absolute;inset:0 0 30% 38%;opacity:.32;pointer-events:none;
    background:
      repeating-radial-gradient(ellipse at 62% 44%,rgba(214,255,246,.2) 0 1px,transparent 1px 12px),
      linear-gradient(135deg,transparent,rgba(224,255,79,.08))}
  .mc-mission-card>*{position:relative;z-index:1}
  .mc-constellation{position:absolute;top:10px;right:8px;width:40%;max-width:168px;height:auto;z-index:0;opacity:.55;pointer-events:none}
  .mc-eyebrow{font:10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--mc-chartreuse);max-width:58%}
  .mc-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;max-width:58%}
  .mc-card-head>div{min-width:0}
  .mc-card-title{font-size:19px;line-height:1.18;font-weight:700;color:var(--mc-paper);overflow-wrap:break-word}
  .mc-mission-card h3:not(.mc-card-title){font-size:18px;line-height:1.18;color:var(--ink);overflow-wrap:anywhere}
  .mc-mission-card p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;font-size:13px;line-height:1.48;opacity:.78}
  .mc-meta-grid{display:grid;gap:8px;max-width:58%;font:11px/1.35 var(--mono)}
  .mc-meta-row{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px;min-width:0}
  .mc-meta-row b{color:rgba(214,255,246,.5);font-weight:400}
  .mc-meta-row span{color:var(--mc-mint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-info{font:11px/1.45 var(--mono);color:rgba(214,255,246,.78);max-width:58%}
  .mc-info summary{color:var(--mc-mint);cursor:pointer;list-style:none}
  .mc-info summary::before{content:"\\25B8 ";color:var(--mc-chartreuse)}
  .mc-info[open] summary::before{content:"\\25BE "}
  .mc-info p{margin:6px 0 0;opacity:.85}

/* QuestlineTimeline (T-016): stations + connector grammar, inside the hero card.
   Stations flex to share the card width (intrinsic fit down to 320px — never horizontal scroll,
   never hidden stations); captions clamp with ellipsis so long state words cannot overflow.
   The active-station orbit is an SVG ring INSIDE the station box: a rotated/abs-positioned
   div inflates scrollWidth past the card at 320px, so the sweep rides stroke-dashoffset
   (orbitSweep, frozen/03) which never changes geometry. */
  .mc-timeline{display:flex;align-items:flex-start;width:100%;min-width:0;padding-top:4px}
  .mc-timeline-station{display:grid;justify-items:center;gap:5px;flex:1 1 0;min-width:0;text-align:center}
  .mc-station{position:relative;width:28px;height:28px;display:grid;place-items:center;color:var(--mc-mint)}
  .mc-station-icon{display:grid;place-items:center;width:16px;height:16px}
  .mc-station-icon svg{width:16px;height:16px;display:block}
  .mc-station.is-complete,.mc-station.is-active,.mc-station.is-selected{color:var(--mc-chartreuse)}
  .mc-station.is-blocked{color:var(--mc-peach)}
  .mc-station.is-locked{color:rgba(214,255,246,.45)}
  .mc-station.is-stale{color:rgba(214,255,246,.4)}
  .mc-station.is-idle{color:rgba(214,255,246,.5)}
  .mc-station-orbit{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
  .mc-station-orbit-arc{fill:none;stroke:rgba(224,255,79,.55);stroke-width:1.2;stroke-dasharray:2.5 3}
  .mc-station-orbit-dot{fill:var(--mc-chartreuse)}
  .mc-station-orbit[data-motion="orbitSweep"] .mc-station-orbit-arc{animation:orbitSweep 1.4s var(--ease) both}
  .mc-timeline-name{font:600 11px/1.2 inherit;color:var(--mc-paper);max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal;overflow-wrap:break-word;text-align:center}
  /* State word renders in full at ≥361px (wraps at the hyphen, e.g. proof-/needed); the
     compact ≤360px density keeps the single-line ellipsis clamp. */
  .mc-timeline-state{font:9px/1.25 var(--mono);color:rgba(214,255,246,.55);max-width:100%;overflow:hidden;white-space:normal;overflow-wrap:break-word;text-align:center}
  .mc-connector{position:relative;flex:1 1 0;min-width:8px;height:2px;margin-top:13px;border-radius:2px}
  .mc-connector.is-solid{background:var(--mc-chartreuse);box-shadow:0 0 8px rgba(224,255,79,.35)}
  .mc-connector.is-dashed{background:repeating-linear-gradient(90deg,rgba(214,255,246,.35) 0 4px,transparent 4px 8px)}
  .mc-connector .mc-packet-dots{position:absolute;inset:-8px 0;min-height:0}
  .mc-connector .mc-packet{width:3px;height:3px}
  /* The previous six-column compression made a 320–430px timeline unreadable.
     Mobile keeps the same stations and rail grammar, but stacks them so labels,
     state, and actions retain their truthful, readable form. */
  @media (max-width:520px){
    .mc-mission-card{padding:14px}
    .mc-mission-card::before{inset:0;opacity:.18}
    .mc-constellation{width:48%;opacity:.2}
    .mc-eyebrow,.mc-card-head,.mc-meta-grid,.mc-info{max-width:100%}
    .mc-card-head{padding-right:38px}
    .mc-timeline{display:grid;grid-template-columns:minmax(0,1fr);gap:0;padding-top:6px}
    .mc-timeline-station{grid-template-columns:28px minmax(0,1fr);justify-items:start;align-items:center;gap:4px 10px;min-height:44px;text-align:left}
    .mc-station{grid-row:span 2}
    .mc-timeline-name,.mc-timeline-state{justify-self:start;max-width:100%;text-align:left}
    .mc-timeline-name{display:block;-webkit-line-clamp:unset;white-space:nowrap;text-overflow:ellipsis}
    .mc-timeline-state{white-space:nowrap;text-overflow:ellipsis}
    .mc-connector{width:1px;min-width:1px;height:12px;margin:0 0 0 13px;background:transparent;justify-self:start}
    .mc-connector.is-solid{background:var(--mc-chartreuse)}
    .mc-connector.is-dashed{background:repeating-linear-gradient(180deg,rgba(214,255,246,.35) 0 4px,transparent 4px 8px)}
    .mc-connector .mc-packet-dots{display:none}
  }

  /* ProofList rows (frozen/02 §6): dashed-ring icon + label + packet cluster + chevron */
  .mc-proof-list>button{appearance:none;width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:9px;align-items:center;min-height:56px;border:0;border-bottom:1px solid var(--line);padding:8px 10px;background:transparent;color:var(--soft);text-align:left;font:11px/1.35 var(--mono);cursor:pointer}
  .mc-proof-list>button:last-child{border-bottom:0}
  .mc-proof-list>button:active{background:rgba(224,255,79,.04)}
  .mc-proof-list>button>span{display:block;min-width:0;overflow-wrap:anywhere}
  .mc-proof-icon{display:inline-grid;place-items:center;width:14px;height:14px}
  .mc-proof-icon svg{width:14px;height:14px;display:block}
  .mc-proof-icon.is-blocked{color:var(--mc-peach)}
  .mc-proof-icon.is-proof-needed{color:var(--mc-mint)}
  .mc-proof-icon.is-complete{color:var(--mc-chartreuse)}
  .mc-proof-icon.is-stale,.mc-proof-icon.is-locked,.mc-proof-icon.is-idle{color:rgba(214,255,246,.5)}
  .mc-proof-list b,.mc-blocker-row b,.mc-kpi-row b{display:block;color:var(--ink);font-weight:650;margin-bottom:3px}

  /* KPI pulse rows */
  .mc-blockers,.mc-kpis{display:grid;gap:8px}
  .mc-kpi-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono);overflow-wrap:anywhere}
  .mc-kpi-copy{display:grid;gap:3px;min-width:0}
  .mc-kpi-copy small{color:var(--muted)}
  .mc-kpi-row .mc-kpi-bars{justify-self:end}

  /* GateActionRow + tool/loop links */
  .mc-action-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mc-action-row button{appearance:none;min-height:60px;border:1px solid rgba(224,255,79,.5);border-radius:8px;background:var(--ink);color:#00272B;font-weight:800;cursor:pointer;touch-action:manipulation}
  .mc-action-row button.secondary{border:1px solid rgba(224,255,79,.5);background:transparent;color:var(--mc-chartreuse)}
  .mission-tool-link,.tool-recommend,.story-hero,.inspect-proof-summary{border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28);padding:12px 13px}
  .mission-tool-link{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:center}
  .mission-tool-link>*{min-width:0}
  .mission-tool-link b,.tool-recommend b,.story-hero b,.inspect-proof-summary b{display:block;color:var(--ink);font-size:13px;line-height:1.25}
  .mission-tool-link small,.tool-recommend small,.story-hero small,.inspect-proof-summary small{display:block;font:11px/1.35 var(--mono);opacity:.68;margin-top:3px;overflow-wrap:anywhere}
  .mission-tool-link small.mc-loop-token{color:var(--mc-mint);opacity:.85}
  .inspect-proof-summary>small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere}
  .mission-tool-link button,.tool-recommend button{appearance:none;border:1px solid rgba(224,255,79,.5);border-radius:8px;background:var(--ink);color:var(--bg);font:800 12px inherit;padding:9px 10px;cursor:pointer}
  .mission-tool-link button{width:100%;min-height:44px}
  .mc-founder-outcome{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:center;border:1px solid rgba(224,255,79,.36);border-radius:8px;padding:10px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono)}
  .mc-founder-outcome b{color:var(--ink)} .mc-founder-outcome small{color:var(--mc-mint)}
  .mc-founder-outcome button,.mc-founder-outcome-actions button{appearance:none;min-height:40px;border:1px solid rgba(224,255,79,.5);border-radius:8px;background:transparent;color:var(--mc-chartreuse);font:700 12px inherit;padding:8px;cursor:pointer}
  .mc-founder-outcome-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .mc-founder-outcome-actions button:first-child{background:var(--ink);color:var(--bg)} .mc-founder-outcome-actions button:disabled{opacity:.5;cursor:default}

  /* legacy rules still consumed by the component gallery + legacy sheets (T-029 cleans up) */
  .mc-card-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .mc-card-meta span,.mc-blocker-row{min-width:0;border:1px solid var(--line);border-radius:8px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono);overflow-wrap:anywhere}
  .mc-card-meta b{display:block;color:var(--ink);font-weight:650;margin-bottom:3px}
  .mc-branch-texture{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:8px;background:linear-gradient(90deg,rgba(224,255,79,.09),rgba(1,47,52,.2))}
  .mc-branch-texture>span{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;min-width:0;font:11px/1.3 var(--mono)}
  .mc-branch-texture b{display:block;color:var(--ink);font-weight:650}
  .mc-branch-texture small{display:block;min-width:0;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-questline-row{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;min-height:56px;padding:8px 4px;text-align:left}
  .mc-questline-row:not(:last-child){border-bottom:1px solid var(--line)}
  .mc-questline-row:not(:last-child)::after{content:"";position:absolute;left:17px;top:calc(50% + 14px);bottom:calc(-50% + 14px);border-left:1px dashed var(--line2);pointer-events:none}
  .mc-questline-row[data-questline-stage-state="blocked"]::after{border-left-color:rgba(255,199,161,.5)}
  .mc-questline-row .mc-signal-rail{display:none}
  .mc-questline-row>span:first-child{position:relative;z-index:1;display:grid;place-items:center}
  .mc-questline-row b{min-width:0;font-size:11px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
  .mc-questline-row .mc-state-token{justify-self:end;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

`;
