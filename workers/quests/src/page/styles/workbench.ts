// Source-bound atlas grammar applied to the working scene shell.
// The track remains exactly one viewport wide; go()/swipe read track.clientWidth.
// No status, progress, actions, image requests or motion are invented by this layer.
// Assemble after the scene/sheet CSS and before STYLE_STATES.
export const STYLE_WORKBENCH = `
  .substrate{
    background:
      repeating-radial-gradient(ellipse at 18% 24%,rgba(214,255,246,.025) 0 1px,transparent 1px 32px),
      radial-gradient(ellipse at 90% 4%,rgba(224,255,79,.04),transparent 48%),
      var(--bg);
  }
  .substrate .grain{opacity:.025}
  .app{
    max-width:1120px;margin-inline:auto;background:rgba(0,39,43,.92);
    border-inline:1px solid var(--line);isolation:isolate;
  }
  .app header.root-status{padding:calc(var(--sat) + 20px) 28px 16px;gap:16px}
  .app .root-brand{gap:12px}
  .app .root-brand-glyph{width:48px;height:48px;border-radius:16px;background:rgba(224,255,79,.035)}
  .app .root-brand-glyph svg{width:32px;height:32px}
  .app .brand{font-size:24px;font-weight:680;letter-spacing:-.035em;line-height:1.12}
  .app .brand small{font-size:12px;line-height:1.3;opacity:.75;letter-spacing:0;margin-top:4px}
  .app .root-chip-stack{gap:8px}
  .app .chip{min-height:44px;padding:9px 13px;font-size:11px;border-radius:8px}
  .app .scene-chip{border-color:var(--line2);background:rgba(214,255,246,.035);color:var(--soft)}
  .app .root-nav{
    margin:0 28px 0;padding:8px 0 12px;gap:8px;border-bottom:1px solid var(--line2);
  }
  .app .root-tab{
    min-height:60px;padding:8px 12px;grid-template-columns:32px minmax(0,1fr);
    grid-template-rows:auto auto;column-gap:10px;row-gap:3px;justify-items:start;
    align-items:center;align-content:center;border:1px solid transparent;border-radius:8px;
    opacity:.8;background:rgba(1,47,52,.2);text-align:left;
  }
  .app .root-tab-glyph{grid-row:span 2;width:32px;height:32px;border-radius:10px;background:transparent}
  .app .root-tab-glyph svg{width:23px;height:23px}
  .app .root-tab-label{font-size:13px;font-weight:600;line-height:1.2}
  .app .root-tab small{font:11px/1.25 var(--mono);opacity:.7}
  .app .root-tab.on{border-color:rgba(224,255,79,.32);background:rgba(224,255,79,.055);opacity:1}
  .app .root-tab.on .root-tab-glyph{box-shadow:none}
  .app .root-nav-indicator{height:2px;bottom:-1px;box-shadow:none}
  .app .track{width:100%;max-width:100%;min-width:0}
  .app .scene{
    padding:24px 28px calc(var(--sab) + 40px);scrollbar-width:thin;
    scrollbar-color:rgba(214,255,246,.2) transparent;
  }
  .app .scene-heading{
    display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center;
    margin:0 0 24px;min-width:0;
  }
  .app .scene-heading-glyph{
    display:grid;place-items:center;width:48px;height:48px;border-radius:50%;
    border:1px solid var(--line2);color:var(--soft);background:rgba(1,47,52,.36);position:relative;
  }
  .app .scene-heading-glyph::after{
    content:"";position:absolute;inset:5px;border:1px dotted rgba(214,255,246,.2);border-radius:50%;pointer-events:none;
  }
  .app .scene-heading-glyph[data-glyph-kind="gate"]{color:var(--warn);border-style:dashed;border-color:rgba(255,199,161,.35)}
  .app .scene-heading-glyph svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
  .app .scene-heading-glyph .mc-fill{fill:currentColor;opacity:.1}
  .app .scene-heading-glyph .mc-core{fill:currentColor;stroke:none}
  .app .scene-heading-glyph .mc-dash{stroke-dasharray:2 3}
  .app .scene-heading-copy{min-width:0}
  .app .scene-heading-cue{display:block;font:11px/1.4 var(--mono);color:rgba(214,255,246,.72);margin-bottom:3px}
  /* Stable title IDs/class stay in the scaffold; the workbench reveals them. */
  .app .scene-heading h2.sr{
    position:static;width:auto;height:auto;overflow:visible;clip:auto;white-space:normal;
    color:var(--mc-paper);font-size:clamp(24px,3.2vw,32px);line-height:1.05;letter-spacing:-.04em;font-weight:620;
  }
  .app .scene-guide{display:flex;align-items:center;gap:8px;min-width:0;font:10px/1.4 var(--mono);color:rgba(214,255,246,.7)}
  .app .scene-guide span{white-space:nowrap}
  .app .scene-guide i{width:22px;height:1px;background:var(--line2);position:relative}
  .app .scene-guide i::after{content:"";position:absolute;right:0;top:-2px;width:5px;height:5px;border:1px solid rgba(214,255,246,.45);background:var(--bg);border-radius:50%}
  .app .scene-context{font:12px/1.5 var(--mono);color:rgba(214,255,246,.72);margin:-8px 0 16px;max-width:62ch}

  .app .mc-mission-card{padding:22px;gap:14px;background:rgba(1,47,52,.68)}
  .app .mc-card-title{font-size:25px;font-weight:620;line-height:1.12;letter-spacing:-.025em}
  .app .mc-mission-card p{font-size:14px;line-height:1.5;opacity:.85}
  .app .mc-meta-grid{gap:10px;font-size:12px}
  .app .mc-info{font-size:12px;line-height:1.5}
  .app .mc-info summary{min-height:44px;display:flex;align-items:center;gap:7px}
  .app .mc-eyebrow{font-size:11px;letter-spacing:.08em}
  .app .mc-section-title{margin:8px 0 3px;font-size:11px;line-height:1.4;letter-spacing:.04em}
  .app .mc-state-row{min-height:64px;padding:12px}
  .app .mc-state-row small{font-size:11px;line-height:1.4;opacity:.75}
  .app .mc-proof-list>button{min-height:64px;padding:12px;font-size:12px;line-height:1.5}
  .app .mc-kpi-row{padding:12px;font-size:12px;line-height:1.5}
  .app .mc-branch-chip{min-height:64px;padding:10px 12px}
  .app .mc-branch-copy b{font-size:12px}
  .app .mc-branch-copy small{font-size:11px;line-height:1.4;opacity:.78}
  .app .mission-tool-link,.app .tool-recommend,.app .story-hero,.app .inspect-proof-summary{padding:16px}
  .app .mission-tool-link b,.app .tool-recommend b,.app .story-hero b,.app .inspect-proof-summary b{font-size:15px;font-weight:600}
  .app .mission-tool-link small,.app .tool-recommend small,.app .story-hero small,.app .inspect-proof-summary small{font-size:12px;line-height:1.5;opacity:.78}
  .app .mc-action-row button,.app .mission-tool-link button{font-size:13px;min-height:48px}
  .app .mc-founder-outcome button,.app .mc-founder-outcome-actions button{min-height:44px}
  .app .bar{height:4px;margin:20px 0 10px}
  .app .meta{font-size:11px;line-height:1.5;opacity:.8}

  .app .gate-hero{border-radius:8px;padding:20px;border-color:rgba(255,199,161,.3);background:linear-gradient(145deg,rgba(255,199,161,.035),rgba(1,47,52,.6) 70%)}
  .app .gate-hero::after{border-color:rgba(255,199,161,.16)}
  .app .gate-title-row h3{font-size:21px;line-height:1.2;letter-spacing:-.025em;font-weight:620;color:var(--mc-paper)}
  .app .gate-title-row p{font-size:13px;opacity:.82}
  .app .gate-hero-decision{margin-top:14px;padding:12px;font-size:12px;line-height:1.5}
  .app .gate-progress-summary{padding:12px;border-radius:8px}
  .app .gate-progress-copy{font-size:12px;line-height:1.5}
  .app .gate-state-strip span{position:relative;border-radius:8px;padding:12px;font-size:12px}
  .app .gate-state-strip span:not(:last-child)::after{content:"→";position:absolute;right:-7px;top:50%;transform:translateY(-50%);font-size:12px;color:rgba(214,255,246,.55);background:var(--bg);z-index:1}
  .app .gate-state-strip b{font-weight:500;text-transform:none}
  .app .gate-state-strip small{font-size:11px;line-height:1.5;opacity:.78}
  .app .grow-copy .gtitle{font-family:inherit;font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
  .app .grow-copy .gsub-line{font-size:12px;line-height:1.5;opacity:.72}
  .app .grow-chev{min-width:44px;min-height:44px}
  .app .gate-empty,.app .gate-error{padding:16px;border-radius:8px;font-size:13px}

  .app .tool-context-strip,.app .tool-recent-strip,.app .story-filter-strip,.app .gate-filter-strip{padding:8px;gap:8px;background:rgba(1,47,52,.4)}
  .app .tool-context-strip button,.app .tool-recent-strip button,.app .story-filter-strip button,.app .gate-filter-strip button{min-height:44px;padding:8px 12px;font-size:11px}
  .app .tool-recommend button{min-height:44px;padding:8px 14px;font-size:12px}
  .app .cmd{min-height:96px;padding:16px;margin:0;gap:12px;background:rgba(1,47,52,.58)}
  .app .cmd .mc-glyph{width:40px;height:40px}
  .app .cmd .cname{font-family:inherit;font-size:16px;font-weight:600;line-height:1.25;letter-spacing:-.02em}
  .app .cmd .tool-count{font-size:12px;line-height:1.45;opacity:.76}
  .app .tool-panel-freshness{font-size:11px;line-height:1.45}
  .app .tool-panel-freshness small{opacity:.76}
  .app #cmds{display:grid;gap:12px;min-width:0}
  .app #cmds>.tool-recommend,.app #cmds>.tool-context-strip{margin:0}
  .app .story-signal-copy{font-size:12px;line-height:1.5}
  .app .beat{min-height:76px;padding:14px 16px;background:rgba(1,47,52,.58)}
  .app .beat .mc-glyph{width:34px;height:34px}
  .app .story-teaser{gap:6px 10px}
  .app .story-group .cmdgrp{font-size:11px;line-height:1.5;opacity:.75;margin:10px 0 4px}
  .app .story-group-body{gap:10px}
  .app .story-packet-rail{padding-inline:24px}
  .app .mapwrap{gap:16px}
  .app .maphead{gap:16px;align-items:center}
  .app .maphead h2{font-size:20px;font-weight:620;letter-spacing:-.02em;color:var(--soft)}
  .app #mapwrap>.maphead h2{display:none}
  .app .maphead p{font-size:13px;line-height:1.5;opacity:.8}
  .app .inspect-pane-switcher{padding:5px;gap:6px;background:rgba(1,47,52,.4)}
  .app .inspect-pane-switcher button{font-size:12px}
  .app .inspect-pane-section{gap:12px}
  .app .inspect-pane-heading{font-size:11px;letter-spacing:.04em}
  .app .inspect-group{min-height:82px;padding:14px;gap:10px}
  .app .inspect-group b{font-size:15px;font-weight:600;line-height:1.3}
  .app .inspect-group small{font-size:12px;line-height:1.5;opacity:.76}
  .app .inspect-disclosure>summary{min-height:48px;font-size:12px}
  .app .wake-step{min-height:72px;padding:12px}
  .app .wake-step b{font-size:11px}
  .app .wake-step span{font-size:12px;line-height:1.45;opacity:.78}
  .app .ibox,.app .sense{min-height:84px;padding:14px}
  .app .ibox b,.app .sense b{font-size:12px;line-height:1.4}
  .app .ibox span{font-size:13px;line-height:1.5;opacity:.8}

  /* Failure cards retain truthful state. Ring/rail ornament conveys no success. */
  .app .state,.app .mission-empty{
    min-width:0;max-width:720px;padding:28px;border:1px dashed rgba(214,255,246,.28);
    border-radius:8px;background:linear-gradient(145deg,rgba(214,255,246,.025),rgba(1,47,52,.68));
    opacity:1;position:relative;overflow:hidden;
  }
  .app .state::before{
    content:"";display:block;width:48px;height:48px;margin-bottom:20px;border:1px dashed rgba(214,255,246,.5);
    border-radius:50%;background:radial-gradient(circle,rgba(214,255,246,.5) 0 3px,transparent 3px 13px,rgba(214,255,246,.1) 13px 14px,transparent 14px);
  }
  .app .state b,.app .mission-empty b{font-size:23px;line-height:1.2;font-weight:600;letter-spacing:-.03em;color:var(--mc-paper);margin-bottom:12px}
  .app .state p,.app .mission-empty p{max-width:54ch;font-size:14px;line-height:1.6;opacity:.82;margin-bottom:18px;overflow-wrap:anywhere}
  .app .state code{display:inline-block;max-width:100%;font-size:12px;line-height:1.5;overflow-wrap:anywhere;white-space:normal;padding:6px 10px}
  .app .state-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;max-width:100%}
  .app .state-actions button,.app .state-actions a{
    appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;
    border:1px solid var(--line2);border-radius:8px;padding:10px 16px;max-width:100%;
    background:rgba(1,47,52,.6);color:var(--soft);font-family:inherit;font-size:13px;font-weight:600;line-height:1.35;text-decoration:none;cursor:pointer;
  }
  .app .state-actions button:first-child,.app .state-actions a:first-child{border-color:rgba(224,255,79,.55);background:var(--ink);color:var(--bg)}
  .app .state-actions button:disabled,.app .state-actions a[aria-disabled="true"]{opacity:.55;cursor:default}
  .app .skel{height:76px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.35);margin-bottom:12px}

  .app button:focus-visible,.app a:focus-visible,.app summary:focus-visible,.sheet button:focus-visible,.sheet a:focus-visible,.sheet summary:focus-visible{
    outline:2px solid var(--ink);outline-offset:3px;
  }
  .sheet{width:min(720px,100%);max-width:100%;margin-inline:auto;background:rgba(1,47,52,.97);padding:16px 24px calc(var(--sab) + 24px);border-radius:20px 20px 0 0}
  .sheet .gbtns button,.sheet .gate-inspect-link,.sheet .founder-outcome-field input,.sheet .founder-outcome-field select{min-height:44px}
  .sheet .grab{width:44px}
  .sheet #sheetBody{padding-inline:2px;scrollbar-width:thin;scrollbar-color:rgba(214,255,246,.2) transparent}
  .sheet h2{font-size:24px;font-weight:620;line-height:1.15;letter-spacing:-.025em}
  .sheet .kv{font-size:13px;line-height:1.5;gap:10px 12px}
  .sheet .kv b{font-size:11px;opacity:.72}
  .sheet .branch-sheet-section h3{font-size:12px}

  @media(min-width:800px){
    .app #stem.mission-control{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}
    .app #stem.mission-control>.mc-branch-rail,.app #stem.mission-control>.mission-stale-notice,.app #stem.mission-control>.mission-empty,.app #stem.mission-control>.state{grid-column:1/-1}
    .app #stem.mission-control>.mc-mission-card{grid-column:1;grid-row:span 2}
    .app #stem.mission-control>.mc-state-stack,.app #stem.mission-control>.mc-proof-list{grid-column:2}
    .app #stem.mission-control>.mc-action-row{grid-column:1}
    .app .gate-shell{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}
    .app .gate-hero{height:100%}
    .app .gate-state-strip,.app .gate-queue{grid-column:1/-1}
    .app .gate-progress-summary{height:100%;min-height:176px}
    .app #cmds{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .app #cmds>.tool-recommend,.app #cmds>.tool-context-strip,.app #cmds>.state{grid-column:1/-1}
    .app .inspect-groups{grid-template-columns:repeat(2,minmax(0,1fr))}
    .app .inspect-group{border-right:1px solid var(--line)}
    .app .inspect-group:nth-child(even){border-right:0}
    .app .inspect-group:nth-last-child(2){border-bottom:0}
    .app .boxgrid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .app .sensegrid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .app #beats{max-width:860px;margin-inline:auto}
  }
  @media(min-width:1184px){
    .app{height:calc(100dvh - 48px);margin-top:24px;border:1px solid var(--line2);border-radius:20px;box-shadow:0 24px 80px rgba(0,15,18,.28)}
    .app header.root-status{padding-top:20px}
  }
  @media(max-width:700px){
    .app{border-inline:0}
    .app header.root-status{padding:calc(var(--sat) + 14px) 16px 12px;grid-template-columns:minmax(0,1fr) auto;gap:10px}
    .app .root-brand{gap:10px}
    .app .root-brand-glyph{width:40px;height:40px;border-radius:12px}
    .app .root-brand-glyph svg{width:28px;height:28px}
    .app .brand{font-size:21px}
    .app .brand small{font-size:11px}
    .app .root-chip-stack{gap:6px}
    .app .chip{padding-inline:10px;font-size:10px}
    .app .root-nav{margin:0 12px;padding:4px 0 10px;gap:4px}
    .app .root-tab{min-height:62px;padding:6px 2px;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;gap:5px;justify-items:center;text-align:center}
    .app .root-tab-glyph{grid-row:auto;width:27px;height:27px;border-radius:9px}
    .app .root-tab-glyph svg{width:21px;height:21px}
    .app .root-tab-label{font-size:11px;line-height:1.2}
    .app .root-tab small{display:none}
    .app .scene{padding:20px 16px calc(var(--sab) + 32px)}
    .app .scene-heading{grid-template-columns:40px minmax(0,1fr) auto;gap:10px;margin-bottom:20px}
    .app .scene-heading-glyph{width:40px;height:40px}
    .app .scene-heading-glyph svg{width:27px;height:27px}
    .app .scene-heading-cue{font-size:11px}
    .app .scene-guide{font-size:9px;gap:5px}
    .app .scene-guide i{width:12px}
    .app .mc-mission-card{padding:16px;gap:12px}
    .app .mc-card-title{font-size:22px}
    .app .mc-card-head{max-width:100%;padding-right:32px}
    .app .mc-eyebrow,.app .mc-meta-grid,.app .mc-info{max-width:100%}
    .app .mc-constellation{opacity:.18}
    .app .gate-hero{padding:16px}
    .app .gate-state-strip span{padding:10px 8px;font-size:11px}
    .app .cmd{min-height:88px;padding:14px;gap:10px}
    .app .cmd .mc-glyph{width:32px;height:32px}
    .app .cmd .cname{font-size:15px}
    .app .cmd .mc-state-token{max-width:90px;font-size:10px}
    .app .maphead{grid-template-columns:minmax(0,1fr);gap:10px}
    .app .mapbadge{justify-self:start}
    .app .inspect-group{padding:12px}
    .app .state,.app .mission-empty{padding:24px 20px}
    .app .state b,.app .mission-empty b{font-size:21px}
    .sheet{padding-inline:18px;border-radius:18px 18px 0 0}
  }
  @media(max-width:480px){
    .app header.root-status{grid-template-columns:minmax(0,1fr)}
    .app .root-chip-stack{width:100%;justify-content:flex-start}
    .app .root-chip-stack .chip{min-width:76px}
    .app .scene-guide{display:none}
    .app .scene-heading{grid-template-columns:40px minmax(0,1fr)}
    .app .scene-context{font-size:11px}
    .app .grow-head{grid-template-columns:44px minmax(0,1fr) auto;gap:8px}
    .app .grow-head .gate-row-dot{display:none}
    .app .grow-copy .gtitle{font-size:13px;line-height:1.45}
    .app .grow-copy .gsub-line{font-size:11px}
    .app .cmd{grid-template-columns:auto minmax(0,1fr) auto;gap:10px}
    .app .cmd .mc-state-token{grid-column:2;justify-self:start;max-width:100%}
    .app .cmd .cgo{grid-column:3;grid-row:1/span 2}
    .app .state-actions{display:grid;grid-template-columns:minmax(0,1fr)}
    .app .state-actions button,.app .state-actions a{width:100%}
    .app .mc-meta-row{grid-template-columns:68px minmax(0,1fr);gap:8px}
    .app .mission-tool-link,.app .story-hero,.app .inspect-proof-summary{padding:14px}
    .app .wakegrid{grid-template-columns:minmax(0,1fr)}
    .app .wake-step{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;align-items:center;min-height:52px}
    .app .wake-step span{margin:0}
    .app .tool-recommend{grid-template-columns:auto minmax(0,1fr)}
    .app .tool-recommend button{grid-column:1/-1;width:100%}
    .app .tool-context-strip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
    .app .tool-context-strip .tool-context-item{display:grid;align-items:start;justify-items:start;gap:5px}
    .app .tool-context-strip .tool-context-item .mc-state-token{max-width:100%;white-space:normal}
    .sheet .gate-preflight-meta{align-items:flex-start;flex-wrap:wrap}
  }
  @media(max-width:350px){
    .app header.root-status{padding-inline:14px}
    .app .root-nav{margin-inline:10px}
    .app .scene{padding-inline:14px}
    .app .root-tab-label{font-size:11px}
    .app .gate-state-strip{gap:6px}
    .app .gate-state-strip small{font-size:10px}
    .app .boxgrid,.app .sensegrid{grid-template-columns:minmax(0,1fr)}
    .app .beat{grid-template-columns:auto minmax(0,1fr);gap:10px;padding:12px}
    .app .beat .mc-state-token{grid-column:2;justify-self:start;max-width:100%}
    .app .story-hero[data-component="StoryDigestCards"]{grid-template-columns:auto minmax(0,1fr)}
    .app .story-hero[data-component="StoryDigestCards"]>.mc-state-token{grid-column:2;justify-self:start}
  }
  @media(prefers-reduced-motion:reduce){
    .app .scene,.sheet #sheetBody{scroll-behavior:auto}
    .app .track,.sheet,.veil{transition:none!important}
  }
`;
