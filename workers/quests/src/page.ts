// cambium-quests · the miniapp page (Thalia wing W2 — the Living Blueprint, v2 "100%").
// One served file, zero build step, zero dependencies. AAA mobile feel within doctrine:
// White-Hat juice only — glow means growth, never urgency. Taste cortex rules applied:
//   · transform/opacity animations exclusively (60fps, hardware-accelerated)
//   · house easing cubic-bezier(.16,1,.3,1); overshoot pop cubic-bezier(.34,1.56,.64,1)
//   · liquid-glass = 1px inner border + inset highlight; inner/tinted glow, never outer neon
//   · mono numerals; staggered cascades; full skeleton/empty/error/offline states
//   · prefers-reduced-motion kills every loop AND gesture inertia
// v2 adds the interaction layer: finger-tracked scene swipe (axis-locked, momentum, snap,
// rubber-band, live indicator), drag-to-dismiss sheet, pull-to-refresh, fractal arc
// drill-down (tap ring → zoom + parsed evidence facets), count-up numerals, tactile haptics.

import { CAMBIUM_LANES, CAMBIUM_SENSES, CAMBIUM_VISUAL_RAILS, CAMBIUM_VISUAL_STAGES, CAMBIUM_WAKE_STEPS } from '../../../shared/cambium-visual-contract.ts';

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Cambium · Mission Control</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:#00272B; --bg2:#012F34; --ink:#E0FF4F; --soft:#D6FFF6; --violet:#231651;
    --line:rgba(214,255,246,.09); --line2:rgba(214,255,246,.16); --glass:rgba(1,47,52,.72);
    --warn:#F8B560;
    --mc-bg:#00272B; --mc-panel:#012F34; --mc-panel-glass:rgba(1,47,52,.72);
    --mc-chartreuse:#E0FF4F; --mc-mint:#D6FFF6; --mc-warn:#F8B560;
    --mc-line:rgba(214,255,246,.09); --mc-line-strong:rgba(214,255,246,.16);
    --mc-active-fill:rgba(224,255,79,.08); --mc-warning-fill:rgba(248,181,96,.055);
    --mc-radius:8px; --mc-radius-compact:7px; --mc-safe-top:var(--sat); --mc-safe-bottom:var(--sab);
    --ease:cubic-bezier(.16,1,.3,1); --pop:cubic-bezier(.34,1.56,.64,1);
    --mono:ui-monospace,'JetBrains Mono',SFMono-Regular,Menlo,monospace;
    --sat:env(safe-area-inset-top); --sab:env(safe-area-inset-bottom);
  }
  *{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
  html,body{height:100%}
  body{
    background:var(--bg); color:var(--soft); overflow:hidden; overscroll-behavior:none;
    font:15px/1.5 -apple-system,'Satoshi','Euclid Circular A',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  /* mycelium substrate — fixed, non-scrolling, pointer-inert contour field. */
  .substrate{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0;
    background:
      linear-gradient(90deg,rgba(214,255,246,.035) 1px,transparent 1px) 0 0/24px 24px,
      linear-gradient(0deg,rgba(214,255,246,.026) 1px,transparent 1px) 0 0/24px 24px,
      repeating-radial-gradient(ellipse at 62% 38%,rgba(214,255,246,.045) 0 1px,transparent 1px 18px)}
  .substrate::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,39,43,.08),rgba(0,39,43,.88));opacity:.82}
  .blob{display:none}
  .grain{position:absolute;inset:0;opacity:.05;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
  .app{position:relative;height:100dvh;display:flex;flex-direction:column;z-index:1}

  header.root-status{padding:calc(var(--sat) + 14px) 18px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}
  .root-brand{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center}
  .root-brand-glyph{width:38px;height:38px;border:1px solid rgba(224,255,79,.32);border-radius:12px;display:grid;place-items:center;color:var(--ink);
    background:rgba(224,255,79,.055);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .root-brand-glyph svg{width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
  .root-brand-glyph .mc-fill{fill:currentColor;opacity:.16;stroke:currentColor}
  .root-brand-glyph .mc-core{fill:currentColor;stroke:none;opacity:.86}
  .root-brand-glyph .mc-soft{opacity:.42}
  .brand{min-width:0;font-size:21px;font-weight:750;letter-spacing:0;line-height:1.05}
  .brand small{display:block;font-size:11px;font-weight:400;opacity:.66;letter-spacing:.06em;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .root-chip-stack{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0}
  .chip{font:11px/1 var(--mono);padding:5px 10px;border:1px solid rgba(224,255,79,.32);
    border-radius:999px;color:var(--ink);white-space:nowrap;transition:color .4s var(--ease),border-color .4s var(--ease)}
  button.chip{appearance:none;background:transparent;cursor:pointer}
  .chip.stale{border-color:var(--warn);color:var(--warn)}

  /* pull-to-refresh — liquid droplet, lives above the track */
  .ptr{position:absolute;top:calc(var(--sat) + 56px);left:50%;z-index:3;pointer-events:none;
    transform:translate(-50%,-30px) scale(.4);opacity:0;transition:opacity .25s var(--ease)}
  .ptr.show{opacity:1}
  .ptr .drop{width:26px;height:26px;border-radius:50%;
    border:2px solid var(--ink);border-top-color:transparent}
  .ptr.spin .drop{animation:spin .7s linear infinite}
  .ptr-proof{position:absolute;top:31px;left:50%;transform:translateX(-50%);width:250px;text-align:center;
    font:10.5px/1.35 var(--mono);color:var(--ink);background:rgba(0,39,43,.9);
    border:1px solid var(--line);border-radius:8px;padding:6px 8px}

  .root-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:relative;margin:4px 16px 0;
    border-bottom:1px solid var(--line);gap:0;background:transparent}
  .root-tab{appearance:none;min-width:0;min-height:54px;background:none;border:0;color:var(--soft);opacity:.62;
    display:grid;grid-template-rows:auto auto auto;justify-items:center;align-content:center;gap:2px;
    font:650 11px/1 inherit;letter-spacing:0;padding:7px 2px 9px;cursor:pointer;
    transition:opacity .3s var(--ease),color .3s var(--ease),transform .2s var(--ease)}
  .root-tab-glyph{width:21px;height:21px;border:1px solid var(--line2);border-radius:50%;display:grid;place-items:center;
    color:var(--soft);background:rgba(1,47,52,.28);font:12px var(--mono)}
  .root-tab-glyph svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
  .root-tab-glyph .mc-fill{fill:currentColor;opacity:.12;stroke:currentColor}
  .root-tab-glyph .mc-core{fill:currentColor;stroke:none;opacity:.88}
  .root-tab-glyph .mc-soft,.root-tab-glyph .mc-dash{opacity:.42}
  .root-tab-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .root-tab small{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:8.5px/1.1 var(--mono);opacity:.55;text-transform:uppercase}
  .root-tab.on{opacity:1;color:var(--ink)}
  .root-tab.on .root-tab-glyph{color:var(--ink);border-color:rgba(224,255,79,.52);box-shadow:0 0 0 1px rgba(224,255,79,.18)}
  .root-tab:active{transform:scale(.97)}
  .ind.root-nav-indicator{position:absolute;bottom:-1px;left:0;width:20%;height:2px;background:var(--ink);
    border-radius:2px;transition:transform .45s var(--ease);box-shadow:0 0 8px rgba(224,255,79,.4)}

  /* ── commands panel ─────────────────────────── */
  .cmdgrp{font:10px var(--mono);letter-spacing:.1em;text-transform:uppercase;opacity:.45;margin:18px 0 9px}
  .cmdgrp:first-child{margin-top:4px}
  .tool-recommend{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:10px;border-color:rgba(224,255,79,.22)}
  .tool-context-strip,.tool-recent-strip,.story-filter-strip,.gate-filter-strip{display:flex;gap:7px;overflow-x:auto;padding:8px;margin-bottom:10px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28);scrollbar-width:none}
  .tool-context-strip span,.tool-context-strip button,.tool-recent-strip button,.story-filter-strip button,.gate-filter-strip button{flex:0 0 auto;border:1px solid var(--line2);border-radius:999px;background:rgba(1,47,52,.36);color:var(--soft);padding:6px 9px;font:10.5px/1 var(--mono)}
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
  .cmd.is-stale{border-color:rgba(248,181,96,.35)}
  .cmd .mc-state-token{align-self:center}
  .cmd .cgo{align-self:center;font-size:20px;color:var(--ink);opacity:.6}
  .li{padding:9px 0;border-bottom:1px solid var(--line)}
  .li:last-child{border-bottom:0}
  .li .cname{font:600 13px var(--mono);color:var(--soft)}
  .li .cargs{font:10.5px var(--mono);color:var(--ink);opacity:.7;text-transform:uppercase}

  /* min-height:0 lets the flex track be constrained to its allocated height
     (not grow to content) so the scenes' overflow-y:auto actually scrolls. */
  .track{flex:1;min-height:0;display:flex;will-change:transform;touch-action:pan-y}
  .scene{flex:0 0 100%;width:100%;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;
    padding:18px 18px calc(var(--sab) + 118px);overscroll-behavior:contain}

  /* ── quest line — the living vine ─────────────── */
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
  .stem.mission-control{padding-left:0;display:grid;gap:12px;--grow:0%}
  .stem.mission-control::before{display:none}
  .mission-empty{border:1px dashed rgba(248,181,96,.42);border-radius:8px;padding:14px;background:rgba(1,47,52,.34)}
  .mission-empty b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
  .mission-empty p{font-size:13px;opacity:.76;margin-bottom:12px}
  .mc-branch-chip{appearance:none;text-align:left;cursor:pointer;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center}
  .mc-branch-copy{display:block;min-width:0}
  .mc-branch-copy b{display:block;color:var(--ink);font-size:11px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mc-branch-copy small{display:block;max-width:132px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.72;font:10px/1.2 var(--mono)}
  .mc-branch-chip .mc-glyph{width:25px;height:25px;border-radius:7px}
  .mc-branch-chip .mc-state-token{min-height:20px;padding:3px 6px}
  .mc-branch-chip.is-selected{border-color:rgba(224,255,79,.55);background:rgba(224,255,79,.065)}
  .mc-section-title{font:11px var(--mono);color:var(--ink);text-transform:uppercase;letter-spacing:.08em;margin:3px 0}
  .mc-mission-card{position:relative;overflow:hidden;border:1px solid rgba(224,255,79,.36);background:rgba(1,47,52,.42);padding:14px;border-radius:8px;display:grid;gap:10px}
  .mc-mission-card::before{content:"";position:absolute;inset:0 0 30% 38%;opacity:.32;pointer-events:none;
    background:
      repeating-radial-gradient(ellipse at 62% 44%,rgba(214,255,246,.2) 0 1px,transparent 1px 12px),
      linear-gradient(135deg,transparent,rgba(224,255,79,.08))}
  .mc-mission-card>*{position:relative;z-index:1}
  .mc-mission-card h3{font-size:20px;line-height:1.12;color:var(--ink)}
  .mc-mission-card p{font-size:13px;opacity:.78}
  .mc-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .mc-card-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .mc-card-meta span,.mc-blocker-row,.mc-kpi-row{border:1px solid var(--line);border-radius:8px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono)}
  .mc-branch-texture{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:8px;background:linear-gradient(90deg,rgba(224,255,79,.09),rgba(1,47,52,.2))}
  .mc-branch-texture>span{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;min-width:0;font:11px/1.3 var(--mono)}
  .mc-branch-texture b{display:block;color:var(--ink);font-weight:650}
  .mc-branch-texture small{display:block;min-width:0;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mc-proof-list>span{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;min-height:48px;border-bottom:1px solid var(--line);padding:8px 10px;background:transparent;font:11px/1.35 var(--mono)}
  .mc-proof-list>span:last-child{border-bottom:0}
  .mc-proof-list>span>span{display:block;min-width:0}
  .mc-card-meta b,.mc-proof-list b,.mc-blocker-row b,.mc-kpi-row b{display:block;color:var(--ink);font-weight:650;margin-bottom:3px}
  .mc-questline-row{position:relative;display:grid;grid-template-rows:auto auto auto;gap:6px;justify-items:center;text-align:center;align-items:start;min-height:74px;padding:4px 3px}
  .mc-questline-row:not(:last-child)::after{content:"";position:absolute;left:calc(50% + 18px);right:-50%;top:18px;border-top:1px dashed var(--line2)}
  .mc-questline-row b{font-size:10.5px;line-height:1.15;max-width:76px;min-height:24px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .mc-questline-row .mc-state-token{max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
  .mission-tool-link{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
  .mission-tool-link b,.tool-recommend b,.story-hero b,.inspect-proof-summary b{display:block;color:var(--ink);font-size:13px;line-height:1.25}
  .mission-tool-link small,.tool-recommend small,.story-hero small,.inspect-proof-summary small{display:block;font:11px/1.35 var(--mono);opacity:.68;margin-top:3px}
  .mission-tool-link button,.tool-recommend button{appearance:none;border:1px solid rgba(224,255,79,.5);border-radius:8px;background:var(--ink);color:var(--bg);font:800 12px inherit;padding:9px 10px;cursor:pointer}

  /* ── operator map — R3F mechanics, Telegram density ───── */
	  @keyframes spin{to{transform:rotate(360deg)}}
	  @keyframes halo{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.045);opacity:.45}}
	  @keyframes orbitSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
	  @keyframes packetDrift{0%{transform:translateX(-8%);opacity:.42}50%{opacity:.95}100%{transform:translateX(8%);opacity:.5}}
	  @keyframes glyphBreathe{0%,100%{transform:scale(1);opacity:.86}50%{transform:scale(1.035);opacity:1}}
	  @keyframes warningAttention{0%{border-color:rgba(248,181,96,.42)}45%{border-color:rgba(248,181,96,.86)}100%{border-color:rgba(248,181,96,.5)}}
	  .mapwrap{display:flex;flex-direction:column;gap:12px;padding-top:2px}
	  .maphead{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;padding-bottom:4px}
	  .maphead h2{font-size:18px;letter-spacing:.01em;color:var(--ink)}
  .maphead p{font-size:12px;opacity:.68;max-width:48ch;margin-top:3px}
  .mapbadge{font:11px var(--mono);color:var(--ink);border:1px solid rgba(224,255,79,.28);
    border-radius:999px;padding:6px 10px;white-space:nowrap;appearance:none;background:transparent;cursor:pointer}
  .mapbadge:active{transform:scale(.96)}
  .wakegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
  .wake-step{appearance:none;text-align:left;color:var(--soft);min-width:0;padding:9px 9px;border:1px solid var(--line);border-radius:11px;background:rgba(1,47,52,.28);cursor:pointer}
  .wake-step b{display:block;font:10px var(--mono);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wake-step span{display:block;font-size:11px;opacity:.65;line-height:1.25;margin-top:3px;overflow-wrap:anywhere}
  .wake-step.wait{border-style:dashed;opacity:.72}
  .wake-step.done{background:rgba(224,255,79,.045)}
  .sensegrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  .sense{appearance:none;text-align:left;color:var(--soft);padding:10px;border:1px solid var(--line);
    border-radius:12px;background:rgba(1,47,52,.3);font:12px/1.35 inherit;cursor:pointer}
  .sense b{display:block;font:11px var(--mono);color:var(--ink);margin-bottom:3px}
  .sense.on{border-color:rgba(224,255,79,.32);background:rgba(224,255,79,.045)}
  .boxgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .ibox{appearance:none;text-align:left;color:var(--soft);min-height:76px;padding:10px;border:1px solid var(--line);
    border-radius:12px;background:rgba(1,47,52,.26);font:12px/1.35 inherit;cursor:pointer}
  .ibox b{display:block;font:11px var(--mono);color:var(--ink);margin-bottom:4px}
  .ibox span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;opacity:.72}
  .ibox.skill span{display:block;-webkit-line-clamp:unset;overflow:visible;overflow-wrap:anywhere}
	  .ibox.npc span{display:block;-webkit-line-clamp:unset;overflow:visible;overflow-wrap:anywhere}
	  .ibox.ready{border-color:rgba(224,255,79,.28);background:rgba(224,255,79,.04)}
	  .mc-branch-rail{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}
  .mc-branch-chip{flex:0 0 auto;min-width:178px;min-height:52px;border:1px solid var(--mc-line-strong);border-radius:var(--mc-radius);background:rgba(1,47,52,.38);color:var(--mc-mint);padding:8px 10px;font:11px var(--mono)}
	  .mc-glyph{width:28px;height:28px;border:1px solid var(--mc-line-strong);border-radius:var(--mc-radius);display:inline-grid;place-items:center;color:var(--mc-chartreuse);background:var(--mc-panel);position:relative;overflow:hidden;flex:none}
	  .mc-glyph svg{width:80%;height:80%;display:block;stroke:currentColor;fill:none;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
	  .mc-glyph .mc-fill{fill:currentColor;opacity:.16;stroke:currentColor}
	  .mc-glyph .mc-core{fill:currentColor;stroke:none;opacity:.86}
	  .mc-glyph .mc-soft{opacity:.42}
	  .mc-glyph .mc-dash{stroke-dasharray:1.4 2.5}
	  .mc-glyph.is-active,.mc-glyph.is-selected,.mc-glyph.is-complete{border-color:rgba(224,255,79,.42);background:var(--mc-active-fill)}
	  .mc-glyph.is-active::after,.mc-glyph.is-selected::after{content:"";position:absolute;inset:2px;border-radius:inherit;border:1px solid rgba(224,255,79,.24);pointer-events:none}
	  .mc-glyph.is-blocked,.mc-glyph.is-proof-needed{color:var(--mc-warn);border-color:rgba(248,181,96,.5);background:var(--mc-warning-fill)}
	  .mc-glyph.is-locked{color:rgba(214,255,246,.46);border-color:rgba(214,255,246,.1);opacity:.72}
	  .mc-glyph.is-stale{color:var(--mc-warn);border-color:rgba(248,181,96,.34)}
	  .mc-state-token{display:inline-flex;align-items:center;gap:6px;min-height:24px;border:1px solid var(--mc-line);border-radius:999px;padding:4px 8px;font:10px var(--mono);color:var(--mc-mint)}
	  .mc-state-token::before{content:"";width:6px;height:6px;border-radius:50%;border:1px solid currentColor;opacity:.75}
	  .mc-state-token.is-active::before,.mc-state-token.is-selected::before{background:currentColor}
	  .mc-state-token.is-complete::before{border-radius:50%;background:var(--mc-chartreuse);box-shadow:inset 0 0 0 2px var(--mc-panel)}
	  .mc-state-token.is-blocked::before,.mc-state-token.is-proof-needed::before{border-radius:2px;transform:rotate(45deg);background:transparent}
	  .mc-state-token.is-locked::before{border-radius:2px;opacity:.5}
	  .mc-state-token.is-stale::before{background:transparent;border-style:dashed}
	  .mc-state-token.is-active,.mc-state-token.is-selected,.mc-state-token.is-complete{border-color:rgba(224,255,79,.38);color:var(--mc-chartreuse)}
	  .mc-state-token.is-blocked,.mc-state-token.is-proof-needed{border-color:rgba(248,181,96,.5);color:var(--mc-warn);animation:warningAttention 2.4s var(--ease) 1 both}
	  .mc-state-token.is-stale{border-color:rgba(248,181,96,.36);color:var(--mc-warn)}
	  .mc-state-token.is-locked{opacity:.66}
	  .mc-orbit{position:relative;width:44px;height:44px;border-radius:50%;border:1px solid var(--mc-line-strong);display:grid;place-items:center;color:var(--mc-chartreuse);font:10px var(--mono);background:radial-gradient(circle,rgba(1,47,52,.96) 0 52%,transparent 53%),conic-gradient(currentColor calc(var(--mc-progress,0) * 1%),rgba(214,255,246,.08) 0)}
	  .mc-orbit::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:1px solid rgba(224,255,79,.24);border-left-color:transparent;pointer-events:none}
	  .mc-orbit[data-motion="orbitSweep"]::after{border-color:rgba(224,255,79,.4);border-left-color:transparent;animation:orbitSweep 4.8s var(--ease) infinite}
	  .mc-orbit.is-complete::after{border-color:rgba(224,255,79,.48)}
	  .mc-orbit.is-blocked,.mc-orbit.is-proof-needed,.mc-orbit.is-stale{color:var(--mc-warn);border-color:rgba(248,181,96,.44);background:radial-gradient(circle,rgba(1,47,52,.96) 0 52%,transparent 53%),conic-gradient(currentColor calc(var(--mc-progress,0) * 1%),rgba(248,181,96,.11) 0)}
	  .mc-orbit.is-proof-needed::after{border-style:dotted;border-color:rgba(248,181,96,.5)}
	  .mc-orbit.is-locked{color:rgba(214,255,246,.48);border-style:dashed}
	  .mc-orbit-label{position:relative;z-index:1;text-align:center;max-width:34px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	  .mc-orbit .mc-packet-dots{position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);min-height:6px;gap:3px;animation:none}
	  .mc-selected-halo{position:relative;box-shadow:0 0 0 1px rgba(224,255,79,.5),0 0 18px rgba(224,255,79,.18)}
	  .mc-selected-halo::after{content:"";position:absolute;inset:3px;border-radius:inherit;border:1px solid rgba(224,255,79,.22);pointer-events:none}
	  .mc-selected-halo[data-motion="orbitSweep"]::after{border-color:rgba(224,255,79,.42);border-left-color:transparent;animation:orbitSweep 5.6s var(--ease) infinite}
	  .mc-signal-rail{position:relative;min-height:20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center}
	  .mc-signal-rail.is-active{border-color:rgba(224,255,79,.34)}
	  .mc-signal-rail.is-blocked,.mc-signal-rail.is-proof-needed{border-color:rgba(248,181,96,.42);border-style:dashed}
	  .mc-signal-rail.is-locked{border-style:dashed;opacity:.62}
	  .mc-signal-rail .mc-rail-end{position:absolute;right:2px;top:50%;width:7px;height:7px;border:1px solid var(--mc-warn);transform:translateY(-50%) rotate(45deg);background:rgba(248,181,96,.1)}
	  .mc-packet-dots{display:flex;gap:5px;align-items:center;justify-content:center;min-height:20px;max-width:100%;overflow:hidden}
	  .mc-packet-dots[data-motion="packetDrift"]{animation:packetDrift 3.6s var(--ease) infinite alternate}
	  .mc-packet{width:4px;height:4px;border-radius:50%;background:var(--ink);box-shadow:0 0 7px rgba(224,255,79,.34);flex:0 0 auto}
	  .mc-packet-dots.is-blocked .mc-packet,.mc-packet-dots.is-proof-needed .mc-packet,.mc-packet-dots.is-stale .mc-packet{background:var(--mc-warn);box-shadow:0 0 7px rgba(248,181,96,.2)}
	  .mc-glyph[data-motion="glyphBreathe"] svg{transform-origin:center;animation:glyphBreathe 3.4s var(--ease) infinite}
  .mc-questline{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:0;border:1px solid var(--line);border-radius:8px;padding:9px;background:rgba(1,47,52,.26)}
  .mc-proof-list{display:grid;gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;font:11px var(--mono);color:var(--soft);background:rgba(1,47,52,.24)}
	  .mc-kpi-pulse{display:inline-grid;place-items:center;min-width:38px;min-height:38px;border-radius:50%;border:1px solid rgba(224,255,79,.34);color:var(--ink)}
	  .mc-state-stack{display:grid;gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:rgba(1,47,52,.26)}
	  .mc-state-row{appearance:none;text-align:left;color:var(--soft);display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;
	    min-height:56px;padding:9px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;font:12px/1.35 inherit}
	  .mc-state-row:last-child{border-bottom:0}
	  .mc-state-row b{display:block;color:var(--soft);font-size:13px;line-height:1.2;margin-bottom:2px}
	  .mc-state-row small{display:block;font:10.5px/1.25 var(--mono);opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	  .mc-state-row .mc-glyph{width:34px;height:34px}
	  .mc-state-row.is-selected{border-color:rgba(224,255,79,.36);background:rgba(224,255,79,.035)}
	  .mc-state-row.is-blocked{box-shadow:inset 2px 0 0 rgba(248,181,96,.7)}
	  .mc-action-row{position:static;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 0 2px}
	  .mc-action-row[data-component="GateActionRow"]{border-top:1px solid var(--line);margin-top:2px}
	  .mc-inspect-only{opacity:.72}
	  .component-board{display:grid;gap:12px;padding-bottom:18px}
	  .component-board-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;border:1px solid rgba(224,255,79,.24);border-radius:8px;padding:12px;background:rgba(1,47,52,.34)}
	  .component-board-head h2{font-size:19px;line-height:1.1;color:var(--ink)}
	  .component-board-head p{font-size:12px;opacity:.68;max-width:48ch;margin-top:4px}
	  .component-board-head span{font:10px var(--mono);color:var(--ink);border:1px solid rgba(224,255,79,.34);border-radius:999px;padding:4px 8px;white-space:nowrap}
	  .component-panel{border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.26);padding:11px;overflow:hidden}
	  .component-panel h3{font:11px var(--mono);color:var(--ink);letter-spacing:.08em;text-transform:uppercase;margin:0 0 10px}
	  .component-grid{display:grid;gap:8px}
	  .component-glyph-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
	  .component-state-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
	  .component-orbit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
	  .component-mission-grid,.component-motion-grid,.component-legend-grid{grid-template-columns:1fr}
	  .component-glyph-cell,.component-state-cell,.component-frame,.component-legend-item{min-width:0;border:1px solid var(--line);border-radius:8px;background:rgba(0,39,43,.28);padding:8px}
	  .component-glyph-cell{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
	  .component-glyph-cell b,.component-state-cell b,.component-frame b,.component-legend-item b{display:block;color:var(--soft);font-size:12px;line-height:1.2;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	  .component-glyph-cell small,.component-state-cell small,.component-frame small,.component-legend-item small{display:block;font:10.5px/1.35 var(--mono);opacity:.62;overflow-wrap:anywhere}
	  .component-state-cell{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
	  .component-orbit-grid .component-frame{text-align:center;display:grid;justify-items:center;gap:6px}
	  .component-sample{border:1px solid var(--line);border-radius:8px;background:rgba(0,39,43,.24);padding:9px;min-width:0}
	  .component-branch-chip-sample{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center}
	  .component-sample-title{font:11px var(--mono);color:var(--ink);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
	  .component-motion-frames{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:7px}
	  .component-motion-frames .mc-glyph,.component-motion-frames .mc-orbit{margin:auto}
	  .component-motion-frame{min-height:58px;display:grid;place-items:center;border:1px dashed var(--line2);border-radius:7px;background:rgba(1,47,52,.22)}
	  .component-legend-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center}
	  .component-legend-node{width:18px;height:18px;border-radius:50%;border:1px solid var(--line2);background:rgba(1,47,52,.45)}
	  .component-legend-node.is-rail{width:32px;height:2px;border-radius:2px;background:var(--line2)}
	  .component-legend-node.is-packet{width:7px;height:7px;background:var(--ink);box-shadow:0 0 8px rgba(224,255,79,.38)}
	  .component-legend-node.is-orbit{border-color:rgba(224,255,79,.46);background:conic-gradient(var(--ink) 70%,rgba(214,255,246,.1) 0)}
	  .component-legend-node.is-active{background:var(--ink);border-color:var(--ink)}
	  .component-legend-node.is-warning{background:var(--warn);border-color:var(--warn)}
	  .component-legend-node.is-locked{opacity:.46;border-style:dashed}
	  .component-legend-node.is-stale{border-color:var(--warn);border-style:dashed}
	  .stagegrid{display:grid;grid-template-columns:1fr;gap:8px}
  .stage-card{position:relative;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;
    padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:rgba(1,47,52,.36);color:var(--soft);
    cursor:pointer;opacity:0;transform:translateY(10px);animation:rise .5s var(--ease) forwards;animation-delay:calc(var(--i)*45ms)}
  .stage-card:active{transform:scale(.985)}
  .stage-card.active{border-color:rgba(224,255,79,.45);background:rgba(224,255,79,.06);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .stage-card.active::after{content:"";position:absolute;inset:-1px;border-radius:13px;
    border:1px solid rgba(224,255,79,.26);animation:halo 2.8s var(--ease) infinite;pointer-events:none}
  .stage-glyph{width:35px;height:35px;border-radius:12px;border:1px solid var(--line2);display:grid;place-items:center;
    font:700 13px var(--mono);color:var(--ink);background:var(--bg2)}
  .stage-card.done .stage-glyph{background:rgba(224,255,79,.12);box-shadow:inset 0 0 8px rgba(224,255,79,.22)}
  .stage-title{display:block;font-weight:700;font-size:14px}
  .stage-detail{display:block;font-size:12px;opacity:.68;line-height:1.35;margin-top:2px}
  .stage-count{font:11px var(--mono);color:var(--ink);opacity:.82;white-space:nowrap}
  .stagebar{display:block;height:4px;background:var(--line);border-radius:999px;overflow:hidden;margin-top:7px}
  .stagebar span{display:block;height:100%;background:var(--ink);border-radius:999px;transition:width .8s var(--ease)}
	  .railgrid{display:grid;gap:8px}
	  .rail{appearance:none;color:var(--soft);text-align:left;display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 12px;border:1px solid var(--line);
    border-radius:12px;background:rgba(1,47,52,.24);font:12px var(--mono);opacity:.9;cursor:pointer}
  .rail:active{transform:scale(.985)}
  .rail b{font-weight:650;color:var(--soft)}
  .rail span{color:var(--ink);opacity:.75}
  .rail.hot{border-color:rgba(224,255,79,.34);background:rgba(224,255,79,.045)}
  .mapnote{font:11px/1.5 var(--mono);opacity:.58}
  .inspect-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .inspect-group{appearance:none;text-align:left;color:var(--soft);display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start;
    min-width:0;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.3);padding:9px;cursor:pointer}
  .inspect-group b{display:block;color:var(--soft);font-size:12.5px;line-height:1.2;margin-bottom:2px;text-transform:capitalize}
  .inspect-group small{display:block;font:10.5px/1.35 var(--mono);opacity:.62;overflow-wrap:anywhere}
  .inspect-group .mc-state-token{grid-column:1 / -1;width:max-content}
  .facets{display:flex;flex-direction:column;gap:8px}
  .facet{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);
    border-radius:11px;font:12.5px var(--mono);
    opacity:0;transform:translateX(10px);animation:rise .45s var(--ease) forwards;animation-delay:calc(var(--i)*55ms)}
  .facet .dot{width:7px;height:7px;border-radius:50%;flex:none}
  .facet.done .dot{background:var(--ink);box-shadow:0 0 6px rgba(224,255,79,.5)}
  .facet.pend .dot{background:transparent;border:1.5px solid rgba(214,255,246,.4)}
  .dback{appearance:none;background:none;border:1px solid var(--line2);color:var(--soft);
    border-radius:10px;padding:9px 14px;margin-top:14px;font:600 12px inherit;cursor:pointer;
    transition:transform .2s var(--ease)}
  .dback:active{transform:scale(.96)}

  /* ── story — the continuous narrative, as cards ── */
  #beats{position:relative;display:flex;flex-direction:column;gap:12px}
  #beats::before{content:"";position:absolute;left:-2px;top:8px;bottom:8px;width:1.5px;pointer-events:none;
    background:linear-gradient(rgba(224,255,79,.32),var(--line));opacity:.55}
  .story-hero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center}
  .story-hero .mc-glyph{width:32px;height:32px}
  .story-timeline{display:flex;gap:6px;padding:8px;margin-bottom:2px;border:1px solid var(--line);border-radius:8px;background:rgba(1,47,52,.28)}
  .story-timeline i{height:5px;flex:1;border-radius:999px;background:rgba(214,255,246,.16)}
  .story-timeline i.is-complete{background:rgba(224,255,79,.55)}
  .story-timeline i.is-blocked,.story-timeline i.is-stale{background:rgba(248,181,96,.55)}
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
  .beat .lane{display:block;font:9.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;opacity:.5;margin-bottom:3px}
  .beat b{color:var(--soft)}
  .beat .mc-state-token{margin-top:8px}
  .beat.is-stale,.beat.is-blocked{border-color:rgba(248,181,96,.34)}
  .beat.noesis{border-color:rgba(214,255,246,.4);background:var(--glass);backdrop-filter:blur(10px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 20px rgba(214,255,246,.05)}
  .beat.noesis .ico{border-color:rgba(214,255,246,.5)}
  .beat.noesis .ico svg{opacity:1}
  .beat.noesis .lane{color:var(--soft);opacity:.85}

  /* ── gate ───────────────────────────────────── */
  .gate-shell{display:grid;gap:12px}
  .gate-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:12px;align-items:center;
    border:1px solid rgba(224,255,79,.28);border-radius:14px;padding:14px;background:linear-gradient(145deg,rgba(224,255,79,.06),rgba(1,47,52,.38) 60%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .gate-hero::after{content:"";position:absolute;right:-34px;top:-34px;width:124px;height:124px;border-radius:50%;
    border:1px dashed rgba(224,255,79,.22);opacity:.8;pointer-events:none;animation:orbitSweep 8s linear infinite}
  .gate-title-row{position:relative;z-index:1;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start}
  .gate-title-row h3{font-size:20px;line-height:1.1;color:var(--ink);margin:0 0 6px}
  .gate-title-row p{font-size:12.5px;line-height:1.45;opacity:.78;max-width:46ch}
  .gate-hero .mc-glyph{width:34px;height:34px;border-radius:11px}
  .gauge{position:relative;z-index:1;display:grid;place-items:center;margin:0;min-height:116px}
  .gauge .gate-orbit{width:128px;display:grid;place-items:center;gap:5px}
  .gauge svg{width:128px;max-width:100%;overflow:visible;filter:drop-shadow(0 0 10px rgba(224,255,79,.12))}
  .gauge .gv{font:700 21px var(--mono);fill:var(--ink)}
  .gauge .gl{font:9.5px var(--mono);fill:var(--soft);opacity:.55;letter-spacing:.08em}
  .gauge .gstate{font:9px var(--mono);fill:var(--warn);letter-spacing:.08em;text-transform:uppercase}
  .gate-orbit .gate-orbit-node{fill:var(--bg2);stroke:rgba(224,255,79,.38);stroke-width:1.5}
  .gate-orbit.is-active .gate-orbit-node,.gate-orbit.is-complete .gate-orbit-node{fill:var(--ink);stroke:rgba(224,255,79,.7)}
  .gate-orbit.is-blocked .gate-orbit-node,.gate-orbit.is-proof-needed .gate-orbit-node{fill:var(--warn);stroke:rgba(248,181,96,.58)}
  .gate-orbit .gate-orbit-caption{display:flex;justify-content:center;width:100%}
  .gate-orbit .mc-state-token{min-height:20px;padding:3px 7px;max-width:116px;text-align:center;justify-content:center}
  .gate-state-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .gate-state-strip span{min-width:0;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(1,47,52,.28);font:11px/1.35 var(--mono)}
  .gate-state-strip b{display:block;color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
  .gate-state-strip small{display:block;opacity:.76;overflow-wrap:anywhere}
  .gate-queue{display:grid;gap:10px}
  .gate-filter-strip{margin-bottom:2px}
  .gate-empty,.gate-error{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;border:1px dashed rgba(224,255,79,.28);
    border-radius:13px;padding:12px;background:rgba(1,47,52,.28);font:12.5px/1.48 var(--mono)}
  .gate-error{border-color:rgba(248,181,96,.44);background:rgba(248,181,96,.045)}
  .gate-empty b,.gate-error b{display:block;color:var(--soft);font-weight:650;margin-bottom:3px}
  .gate-empty span,.gate-error span{display:block;opacity:.76;overflow-wrap:anywhere}
  .ghead{font-size:17px;font-weight:650;color:var(--ink);margin-bottom:2px}
  .gsub{font-size:12px;opacity:.7;margin-bottom:16px;max-width:52ch}
  .gitem{position:relative;overflow:hidden;padding:12px;border:1px solid var(--line2);border-radius:14px;
    background:var(--glass);backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
    opacity:0;transform:translateY(12px);animation:rise .5s var(--pop) forwards;animation-delay:calc(var(--i)*70ms)}
  .gitem::after{content:"";position:absolute;inset:auto 12px 0;height:1px;background:linear-gradient(90deg,transparent,var(--line2),transparent);opacity:.7}
  .gitem.is-active,.gitem.is-complete{border-color:rgba(224,255,79,.3);background:linear-gradient(145deg,rgba(224,255,79,.055),rgba(1,47,52,.36))}
  .gitem.is-blocked,.gitem.is-proof-needed{border-color:rgba(248,181,96,.42);background:linear-gradient(145deg,rgba(248,181,96,.055),rgba(1,47,52,.34))}
  .gcard-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;margin-bottom:10px}
  .gitem .gid{font:11px var(--mono);color:var(--ink);opacity:.85}
  .gitem .gtitle{font-weight:650;margin:3px 0 0;color:var(--soft);overflow-wrap:anywhere}
  .gmeta{display:grid;grid-template-columns:96px 1fr;gap:5px 9px;margin:9px 0 11px;font-size:11.5px;line-height:1.35}
  .gmeta b{font:10px var(--mono);color:var(--ink);opacity:.72;text-transform:uppercase}
  .gmeta span{opacity:.74;overflow-wrap:anywhere}
  .gitem-details{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
  .gitem-details span{border:1px solid var(--line);border-radius:8px;padding:7px;font:10.5px/1.35 var(--mono);opacity:.76}
  .gitem-details b{display:block;color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .gitem .mc-signal-rail{margin:8px 0 10px}
  .gpriority{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
  .gpriority span{border:1px solid rgba(248,181,96,.36);border-radius:999px;padding:4px 8px;color:var(--warn);font:10px var(--mono);background:rgba(248,181,96,.04)}
  .gate-empty .mc-signal-rail,.gate-error .mc-signal-rail{margin-top:9px}
  .gbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .gbtns button{appearance:none;border:0;border-radius:10px;padding:11px;font:600 13px inherit;cursor:pointer;
    transition:transform .2s var(--ease)}
  .gbtns button:active{transform:scale(.97)}
  .gbtns .approve{background:var(--ink);color:var(--bg)}
  .gbtns .reroll{background:none;border:1px solid rgba(214,255,246,.4);color:var(--soft)}
  .gbtns .detail{background:rgba(1,47,52,.5);border:1px solid var(--line2);color:var(--ink)}
  .gbtns.command-copy{grid-template-columns:1fr;margin:12px 0}
  .gbtns.command-copy button{background:var(--ink);color:var(--bg)}
  .gnote{font:11px var(--mono);opacity:.6;margin-top:12px;line-height:1.5}

  /* ── sheet ──────────────────────────────────── */
  .veil{position:fixed;inset:0;background:rgba(0,20,23,.55);opacity:0;pointer-events:none;
    transition:opacity .35s var(--ease);z-index:10}
  .veil.on{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:11;padding:14px 20px calc(var(--sab) + 24px);
    background:var(--glass);backdrop-filter:blur(16px);
    border:1px solid var(--line2);border-bottom:0;border-radius:22px 22px 0 0;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 -18px 50px rgba(0,10,12,.45);
    max-height:calc(100dvh - var(--sat) - 10px);overflow:hidden;
    transform:translateY(105%);transition:transform .5s var(--pop);will-change:transform;touch-action:pan-y}
  .sheet.on{transform:translateY(0)}
  .grab{width:38px;height:4px;border-radius:99px;background:rgba(214,255,246,.25);margin:2px auto 16px}
  #sheetBody{max-height:calc(100dvh - var(--sat) - var(--sab) - 70px);overflow-y:auto;overscroll-behavior:contain;padding:0 1px 6px;scrollbar-width:none}
  #sheetBody::-webkit-scrollbar{display:none}
  .sheet .arc{font:12px var(--mono);color:var(--ink);opacity:.9}
  .sheet h2{font-size:19px;letter-spacing:.01em;margin:4px 0 8px}
  .sheet .nar{opacity:.85;margin-bottom:12px;line-height:1.55}
  .kv{display:grid;grid-template-columns:84px 1fr;gap:7px 10px;font-size:13px}
  .kv b{font:11px var(--mono);opacity:.55;font-weight:500;letter-spacing:.05em;text-transform:uppercase;padding-top:2px}
  .kv span{font-family:var(--mono);font-size:12.5px;line-height:1.5}
  .gatekv{grid-template-columns:124px minmax(0,1fr)}
  .status-complete,.status-active{color:var(--ink)} .status-locked{opacity:.6}
  .branch-sheet{display:grid;gap:11px;min-width:0}
  .branch-sheet-hero{position:relative;overflow:hidden;border:1px solid rgba(224,255,79,.27);border-radius:12px;padding:13px;
    background:linear-gradient(145deg,rgba(224,255,79,.055),rgba(1,47,52,.4) 62%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .branch-sheet-hero::after{content:"";position:absolute;right:-28px;top:-24px;width:120px;height:120px;border-radius:50%;
    border:1px dashed rgba(224,255,79,.22);opacity:.8;pointer-events:none;animation:orbitSweep 8s linear infinite}
  .branch-sheet-head{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:10px;align-items:center;z-index:1}
  .branch-sheet-head h2{margin:2px 0 1px;font-size:20px;line-height:1.12;color:var(--soft)}
  .branch-sheet-head .arc{opacity:.72;font-size:11px}
  .branch-sheet-hero .nar{position:relative;margin:10px 0 0;max-width:60ch;font-size:13.5px;z-index:1}
  .branch-sheet-glance{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
  .branch-sheet-glance span{min-width:0;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(1,47,52,.28);
    font:11px/1.35 var(--mono);overflow-wrap:anywhere}
  .branch-sheet-glance b{display:block;color:var(--ink);font-weight:650;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
  .branch-claim-guard{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;margin-top:10px;padding:9px;
    border:1px dashed rgba(248,181,96,.38);border-radius:10px;background:rgba(248,181,96,.045);font:12px/1.45 var(--mono)}
  .branch-claim-guard b{display:block;color:var(--warn);font-weight:650;margin-bottom:2px}
  .branch-claim-guard span{display:block;overflow-wrap:anywhere;opacity:.82}
  .branch-sheet-section{display:grid;gap:7px}
  .branch-sheet-section h3{font:11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);margin:0}
  .branch-sheet-timeline{display:grid;gap:7px;border-left:1px solid var(--line2);padding-left:10px}
  .branch-stage{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-height:42px}
  .branch-stage b{display:block;font-size:13px;overflow-wrap:anywhere}
  .branch-stage small{display:block;font:10.5px var(--mono);opacity:.58;margin-top:2px;overflow-wrap:anywhere}
  .branch-row-list{display:grid;gap:7px}
  .branch-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;border:1px solid var(--line);border-radius:10px;
    padding:9px;background:rgba(1,47,52,.28);font:12px/1.42 var(--mono);overflow:hidden}
  .branch-row.is-blocked{border-color:rgba(248,181,96,.42);background:rgba(248,181,96,.045)}
  .branch-row.is-proof-needed{border-color:rgba(248,181,96,.34)}
  .branch-row b{display:block;color:var(--soft);font-weight:650;margin-bottom:2px;overflow-wrap:anywhere}
  .branch-row span{display:block;opacity:.76;overflow-wrap:anywhere}
  .branch-row small{display:block;color:var(--ink);opacity:.58;margin-top:4px;overflow-wrap:anywhere}
  .branch-row .mc-state-token{min-height:22px;padding:3px 7px}
  .branch-kpi-grid{display:grid;grid-template-columns:1fr;gap:7px}
  .branch-kpi{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;border:1px solid var(--line);
    border-radius:10px;padding:9px;background:rgba(1,47,52,.28);font:12px/1.4 var(--mono)}
  .branch-kpi b{display:block;color:var(--soft);font-weight:650;overflow-wrap:anywhere}
  .branch-kpi span:last-child{display:block;opacity:.75;overflow-wrap:anywhere}
  .branch-inspect{display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px 9px;border-top:1px solid var(--line);padding-top:10px;
    font:11px/1.45 var(--mono);opacity:.72}
  .branch-inspect b{color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:.06em}
  .branch-inspect span{overflow-wrap:anywhere}

  /* ── skeleton / states ──────────────────────── */
  .skel{height:54px;border-bottom:1px solid var(--line);position:relative;overflow:hidden}
  .skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
    background:linear-gradient(90deg,transparent,rgba(214,255,246,.06),transparent);
    animation:shimmer 1.4s var(--ease) infinite}
  @keyframes shimmer{to{transform:translateX(100%)}}
  .state{padding:46px 6px;text-align:left;opacity:.85}
  .state b{display:block;color:var(--ink);margin-bottom:6px;font-size:15px}
  .state p{opacity:.8;margin-bottom:10px;line-height:1.5}
  .state code{font:12px var(--mono);opacity:.85;background:rgba(214,255,246,.06);padding:3px 7px;border-radius:6px}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .scene-chip{border:1px solid var(--line);background:rgba(224,255,79,.08);color:var(--ink);font:11px var(--mono);cursor:pointer}

  footer{flex:none;padding:8px 18px calc(var(--sab) + 12px);
    font:10.5px var(--mono);opacity:.5;background:linear-gradient(transparent,var(--bg) 45%);z-index:2;pointer-events:none}

	  @media (prefers-reduced-motion: reduce){
	    *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
	    .mc-orbit::after,.mc-orbit[data-motion="orbitSweep"]::after,.mc-selected-halo[data-motion="orbitSweep"]::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}
	  }
</style>
</head>
<body>
<div class="substrate"><div class="blob a"></div><div class="blob b"></div><div class="grain"></div></div>
<div class="app" data-component="MissionControlShell">
  <span class="sr" data-component="ComponentRegistry" data-source="docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md">Mission Control component registry</span>
  <header class="root-status" data-component="RootStatusStack">
    <div class="root-brand">
      <span class="root-brand-glyph" data-component="RootBrandGlyph" data-glyph-kind="genesis" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 3.8 19.5 11.2 27.4 8.8 23.8 16 27.4 23.2 19.5 20.8 16 28.2 12.5 20.8 4.6 23.2 8.2 16 4.6 8.8 12.5 11.2Z"/><path d="M16 6.8 18.1 12.6 24.2 12.1 19.4 16 24.2 19.9 18.1 19.4 16 25.2 13.9 19.4 7.8 19.9 12.6 16 7.8 12.1 13.9 12.6Z"/><circle class="mc-core" cx="16" cy="16" r="2.1"/><path class="mc-soft" d="M7 27c4.2-.6 6.8-.6 9.2.1 2.8.8 5.2.7 8.8-.4"/></svg></span>
      <div class="brand">Mission Control<small>tenant <span id="ten">cambium</span> · branch arcs</small></div>
    </div>
    <div class="root-chip-stack">
      <button id="sceneBadge" type="button" class="chip scene-chip" data-interaction-kind="sheet" data-source="tg-miniapp-scenes@v1">Mission</button>
      <button id="fresh" type="button" class="chip" data-interaction-kind="sheet" data-source="missing">syncing</button>
    </div>
  </header>
  <div class="ptr" id="ptr" data-refresh-route="/api/quests/cambium" data-refresh-writes="signed-actions-only"><div class="drop"></div><span id="ptrProof" class="ptr-proof">Pull to refresh updates /api/quests/cambium; decisions stay behind signed actions.</span></div>
  <nav class="root-nav" data-component="RootNav" aria-label="Mission Control scenes">
    <button id="tb0" class="root-tab on" data-component="RootSceneTab" data-root-scene="mission" data-nav-glyph="genesis" data-scene-source="tg-miniapp-scenes@v1" aria-selected="true"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="genesis" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 3.8 19.5 11.2 27.4 8.8 23.8 16 27.4 23.2 19.5 20.8 16 28.2 12.5 20.8 4.6 23.2 8.2 16 4.6 8.8 12.5 11.2Z"/><path d="M16 6.8 18.1 12.6 24.2 12.1 19.4 16 24.2 19.9 18.1 19.4 16 25.2 13.9 19.4 7.8 19.9 12.6 16 7.8 12.1 13.9 12.6Z"/><circle class="mc-core" cx="16" cy="16" r="2.1"/></svg></span><span class="root-tab-label">Mission</span><small>next move</small></button>
    <button id="tb1" class="root-tab" data-component="RootSceneTab" data-root-scene="gate" data-nav-glyph="gate" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="gate" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.8 27 24.8H5Z"/><path d="M16 6.8 24.7 23H7.3Z"/><path d="M16 12.8 20.8 20.8H11.2Z"/><path class="mc-core" d="M15.9 17.2 17.9 20.2H13.9Z"/></svg></span><span class="root-tab-label">Gate</span><small>review</small></button>
    <button id="tb2" class="root-tab" data-component="RootSceneTab" data-root-scene="tools" data-nav-glyph="ops" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="ops" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M7.2 13.4 21.8 6.7 27.6 13.3 20.1 24.7 5.4 20.3Z"/><path d="M8.2 14.2 21.5 8.2 26 13.6 19.3 23 6.8 19.4Z"/><path d="m10.1 15.3 9.5 3.7 4.6-4.9M19.6 19l1.9-10.8"/></svg></span><span class="root-tab-label">Tools</span><small>act</small></button>
    <button id="tb3" class="root-tab" data-component="RootSceneTab" data-root-scene="story" data-nav-glyph="proof" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="proof" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path class="mc-dash" d="M12.4 11.4c2.3.8 4.6.8 7.1.1M12.1 15.4c2.8.9 5.5.9 8.2 0"/></svg></span><span class="root-tab-label">Story</span><small>signals</small></button>
    <button id="tb4" class="root-tab" data-component="RootSceneTab" data-root-scene="inspect" data-nav-glyph="cortex" data-scene-source="tg-miniapp-scenes@v1" aria-selected="false"><span class="root-tab-glyph" data-component="RootNavGlyph" data-glyph-kind="cortex" aria-hidden="true"><svg viewBox="0 0 32 32"><circle class="mc-fill" cx="16" cy="16" r="10.8"/><circle cx="16" cy="16" r="10.3"/><circle cx="16" cy="16" r="4.1"/><circle class="mc-core" cx="16" cy="16" r="1.6"/><path d="M16 5.7v6.1M16 20.2v6.1M5.7 16h6.1M20.2 16h6.1"/></svg></span><span class="root-tab-label">Inspect</span><small>proof</small></button>
    <div class="ind root-nav-indicator" id="ind"></div>
  </nav>
  <div class="track" id="track">
    <section class="scene" id="sceneQ" aria-labelledby="sceneQTitle">
      <h2 id="sceneQTitle" class="sr">Mission</h2>
      <div class="stem" id="stem">
        <div class="skel"></div><div class="skel"></div><div class="skel"></div>
        <div class="skel"></div><div class="skel"></div>
      </div>
      <div class="bar"><div id="fill" class="fill"></div></div>
      <div class="meta"><span id="progress"></span><span id="here"></span></div>
    </section>
    <section class="scene" id="sceneG" aria-labelledby="sceneGTitle">
      <h2 id="sceneGTitle" class="sr">Gate</h2>
      <div class="gate-shell" data-component="GateChamber">
        <section class="gate-hero" data-component="GateMissionCard">
          <div class="gate-title-row">
            <span class="mc-glyph is-proof-needed" data-component="MissionGlyph" data-glyph-kind="gate" data-state="proof-needed" aria-hidden="true"><svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.8 27 24.8H5Z"/><path d="M16 6.8 24.7 23H7.3Z"/><path d="M16 12.8 20.8 20.8H11.2Z"/><path class="mc-core" d="M15.9 17.2 17.9 20.2H13.9Z"/><path class="mc-soft" d="M8.2 27.2c2.2-2.8 4.6-3.2 7.8-1.2 3.2-2 5.6-1.6 7.8 1.2"/></svg></span>
            <div>
              <h3>Gate · decisions</h3>
              <p>Review founder decisions tied to branches, missions, proof, consequence, and reversibility.</p>
            </div>
          </div>
          <div class="gauge" id="gauge" data-component="OrbitProgress"></div>
        </section>
        <div class="gate-state-strip" data-component="GateStateStack">
          <span><b>Decision</b><small>founder confirmation</small></span>
          <span><b>Effect</b><small>held for operator consumption</small></span>
          <span><b>Proof</b><small>evidence before action</small></span>
        </div>
        <div id="gate" class="gate-queue">loading the queue…</div>
      </div>
    </section>
    <section class="scene" id="sceneC" aria-labelledby="sceneCTitle">
      <h2 id="sceneCTitle" class="sr">Tools</h2>
      <div class="ghead">Tools · the operator toolbelt</div>
      <div class="gsub">the /ts-* command surface, run through the curios.self bot in Telegram.</div>
      <div id="cmds"></div>
    </section>
    <section class="scene" id="sceneS" aria-labelledby="sceneSTitle"><h2 id="sceneSTitle" class="sr">Story</h2><div id="beats"></div></section>
    <section class="scene" id="sceneF" aria-labelledby="sceneFTitle"><h2 id="sceneFTitle" class="sr">Inspect</h2><div class="mapwrap" id="mapwrap"></div></section>
  </div>
  <footer>every status derives from real world-state — no fake progress.</footer>
</div>
<div class="veil" id="veil"></div>
<div class="sheet" id="sheet"><div class="grab"></div><div id="sheetBody"></div></div>
<script>
'use strict';
const $ = id => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TG = window.Telegram && Telegram.WebApp;
const buzz = k => { try { TG && TG.HapticFeedback.impactOccurred(k); } catch(_){} };
const notify = k => { try { TG && TG.HapticFeedback.notificationOccurred(k); } catch(_){} };
if (TG) { TG.ready(); TG.expand(); try { TG.setHeaderColor('#00272B'); TG.setBackgroundColor('#00272B'); } catch(_){} }

const MARKS = {
  complete: '<svg viewBox="0 0 12 12"><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="#E0FF4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  active:   '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3" fill="#E0FF4F"/></svg>',
  locked:   '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="2.4" fill="none" stroke="rgba(214,255,246,.45)" stroke-width="1.4"/></svg>'
};
const MC_COMPONENT_SOURCE_REFS = Object.freeze([
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md',
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/01-component-glyph-state-board.md',
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/02-mission-control-state-stack-mobile.md',
  'docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/prompts/03-motion-storyboard-mobile.md'
]);
const MC_COMPONENT_PROPS = Object.freeze({
  OrbitProgress:['value','state','label','showPacketDots','ariaLabel'],
  SignalRail:['state','packetCount','label'],
  PacketFlow:['count','state','mode'],
  KpiPulse:['label','currentState','survival','betterThanSurvival'],
  SelectedHalo:['selected','surface'],
  Motion:['motion','state','reducedMotion']
});
const MC_COMPONENT_REGISTRY = Object.freeze({
  sourceRefs:MC_COMPONENT_SOURCE_REFS,
  propShapes:MC_COMPONENT_PROPS,
  MissionGlyph:['genesis','taste','build','ops','cortex','arc','proof','gate'],
  StateToken:['idle','active','selected','complete','blocked','locked','stale','proof-needed','reduced-motion'],
  OrbitProgress:['idle','active','complete','blocked','stale','proof-needed'],
  SelectedHalo:['branch-chip','mission-node','detail-sheet'],
  SignalRail:['idle','active','blocked','locked'],
  PacketFlow:['rail','texture','packet-bar'],
  BranchArcChip:['selected','active','stale','blocked','locked'],
  MissionCard:['next-mission','branch-sheet'],
  QuestlineTimeline:['seed','packet','proof','launch'],
  ProofList:['proof-needed','blocked','stale'],
  KpiPulse:['survival','better-than-survival'],
  GateActionRow:['review-gate','open-proof'],
  Motion:['orbitSweep','packetDrift','glyphBreathe','warningAttention','reducedMotion']
});
const MC_GLYPH_SVG = {
  genesis:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 3.8 19.5 11.2 27.4 8.8 23.8 16 27.4 23.2 19.5 20.8 16 28.2 12.5 20.8 4.6 23.2 8.2 16 4.6 8.8 12.5 11.2Z"/><path d="M16 6.8 18.1 12.6 24.2 12.1 19.4 16 24.2 19.9 18.1 19.4 16 25.2 13.9 19.4 7.8 19.9 12.6 16 7.8 12.1 13.9 12.6Z"/><circle class="mc-core" cx="16" cy="16" r="2.1"/><path class="mc-soft" d="M7 27c4.2-.6 6.8-.6 9.2.1 2.8.8 5.2.7 8.8-.4"/></svg>',
  taste:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M9.4 12.4 20.2 8.5a6.6 6.6 0 0 1 5 12.2L14.4 24.6a6.6 6.6 0 0 1-5-12.2Z"/><path d="M10.6 13.5 20.9 9.9a5 5 0 0 1 3.5 9.4L14.1 23a5 5 0 0 1-3.5-9.5Z"/><path class="mc-soft" d="m13 16.3 9.8-3.6M10.2 26.4c3.6.5 6.8-.2 9.4-1.3"/></svg>',
  build:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.7 27.5 25.2H4.5Z"/><path d="M16 6.8 25 23.4H7Z"/><path d="M16 13.2 20.6 21H11.4Z"/><path class="mc-soft" d="M9.2 25.2h13.6M12 22.9h8"/></svg>',
  ops:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M7.2 13.4 21.8 6.7 27.6 13.3 20.1 24.7 5.4 20.3Z"/><path d="M8.2 14.2 21.5 8.2 26 13.6 19.3 23 6.8 19.4Z"/><path d="m10.1 15.3 9.5 3.7 4.6-4.9M19.6 19l1.9-10.8"/><path class="mc-soft" d="M6.2 25.1c3.9-1.2 6.9-1.2 9.8.2"/></svg>',
  cortex:'<svg viewBox="0 0 32 32"><circle class="mc-fill" cx="16" cy="16" r="10.8"/><circle cx="16" cy="16" r="10.3"/><circle cx="16" cy="16" r="4.1"/><circle class="mc-core" cx="16" cy="16" r="1.6"/><path d="M16 5.7v6.1M16 20.2v6.1M5.7 16h6.1M20.2 16h6.1M8.7 8.7l4.3 4.3M19 19l4.3 4.3M23.3 8.7 19 13M13 19l-4.3 4.3"/></svg>',
  arc:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M24 7.2a9.8 9.8 0 1 0 0 17.6 11.6 11.6 0 1 1 0-17.6Z"/><path d="M24 7.2a9.8 9.8 0 1 0 0 17.6"/><path d="M22.1 11.7a5.7 5.7 0 1 0 0 8.6"/><path class="mc-soft" d="M6.8 27.1c2.4-.8 4.8-.8 7.3 0 2 .6 4 .5 6.4-.4"/></svg>',
  proof:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path d="M10.2 5.4c3.6 1.7 6.7 1.8 9.8.4 1.7-.7 3.3.5 3.2 2.3l-1 14.7c-.1 1.9-1.9 3-3.6 2.1-3.1-1.6-6.2-1.8-9.5-.5Z"/><path class="mc-dash" d="M12.4 11.4c2.3.8 4.6.8 7.1.1M12.1 15.4c2.8.9 5.5.9 8.2 0M11.8 19.3c2.1.7 4.4.8 6.8.2"/><path class="mc-soft" d="M7.2 27.2c5.9-2 11.8-1.9 17.6.1"/></svg>',
  gate:'<svg viewBox="0 0 32 32"><path class="mc-fill" d="M16 4.8 27 24.8H5Z"/><path d="M16 6.8 24.7 23H7.3Z"/><path d="M16 12.8 20.8 20.8H11.2Z"/><path class="mc-core" d="M15.9 17.2 17.9 20.2H13.9Z"/><path class="mc-soft" d="M8.2 27.2c2.2-2.8 4.6-3.2 7.8-1.2 3.2-2 5.6-1.6 7.8 1.2"/></svg>'
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mcStateKind(raw){
  const state = String(raw || '').toLowerCase();
  if (/reduced/.test(state)) return 'reduced-motion';
  if (/selected|focus/.test(state)) return 'selected';
  if (/verified|complete|ready|done/.test(state)) return 'complete';
  if (/stale/.test(state)) return 'stale';
  if (/blocked|warning|gap|missing/.test(state)) return 'blocked';
  if (/proof|review|pending/.test(state)) return 'proof-needed';
  if (/active|current|queued|running/.test(state)) return 'active';
  if (/locked|disabled/.test(state)) return 'locked';
  return 'idle';
}
function mcClass(base, state, extra){
  const kind = mcStateKind(state);
  return [base, 'is-' + kind, extra || ''].filter(Boolean).join(' ');
}
function mcGlyphSvg(kind, state, opts){
  const glyph = MC_COMPONENT_REGISTRY.MissionGlyph.includes(kind) ? kind : 'arc';
  const tone = mcStateKind(state);
  const motion = opts && opts.motion === 'glyphBreathe' && tone === 'active' && !RM ? ' data-motion="glyphBreathe" data-motion-primitive="glyphBreathe"' : '';
  return '<span class="' + mcClass('mc-glyph', tone) + '" data-component="MissionGlyph" data-glyph-kind="' + esc(glyph) + '" data-state="' + esc(tone) + '"' + motion + ' aria-hidden="true">' + MC_GLYPH_SVG[glyph] + '</span>';
}
function mcStateToken(state, label){
  const kind = mcStateKind(state);
  return '<span class="' + mcClass('mc-state-token', kind) + '" data-component="StateToken" data-state="' + esc(kind) + '" aria-label="state: ' + esc(label || kind) + '">' + esc(label || kind) + '</span>';
}
function mcPacketDots(count, state, opts){
  const kind = mcStateKind(state);
  const n = Math.max(1, Math.min(7, Number(count) || 1));
  const mode = (opts && opts.mode) || 'rail';
  const motion = kind === 'active' && !RM ? ' data-motion="packetDrift" data-motion-primitive="packetDrift"' : '';
  return '<span class="' + mcClass('mc-packet-dots', kind) + '" data-component="PacketFlow" data-state="' + esc(kind) + '" data-packet-count="' + n + '" data-packet-mode="' + esc(mode) + '"' + motion + ' aria-hidden="true">' + Array.from({ length:n }, () => '<i class="mc-packet"></i>').join('') + '</span>';
}
function mcOrbitProgress(opts){
  const value = Math.max(0, Math.min(100, Number(opts && opts.value) || 0));
  const label = opts && opts.label ? opts.label : value + '%';
  const kind = mcStateKind(opts && opts.state);
  const motion = kind === 'active' && !RM ? ' data-motion="orbitSweep" data-motion-primitive="orbitSweep"' : '';
  const packets = opts && opts.showPacketDots ? mcPacketDots(opts.packetCount || 3, kind, { mode:'orbit' }) : '';
  const aria = (opts && opts.ariaLabel) || ('progress ' + label + ' · ' + kind);
  return '<span class="' + mcClass('mc-orbit', kind) + '" data-component="OrbitProgress" data-state="' + esc(kind) + '" data-value="' + value + '"' + motion + ' role="img" aria-label="' + esc(aria) + '" style="--mc-progress:' + value + '"><span class="mc-orbit-label">' + esc(label) + '</span>' + packets + '</span>';
}
function mcSignalRail(opts){
  const kind = mcStateKind(opts && opts.state);
  const label = (opts && opts.label) || ('signal rail ' + kind);
  const end = kind === 'blocked' || kind === 'proof-needed' ? '<i class="mc-rail-end" aria-hidden="true"></i>' : '';
  return '<span class="' + mcClass('mc-signal-rail', kind) + '" data-component="SignalRail" data-state="' + esc(kind) + '" aria-label="' + esc(label) + '">' + mcPacketDots(opts && opts.packetCount, kind) + end + '</span>';
}
function mcKpiBars(progress, state){
  const kind = mcStateKind(state);
  const depth = Math.max(1, Math.min(3, Math.ceil((Number(progress) || 0) / 34)));
  return '<span class="mc-kpi-bars" data-component="PacketFlow" data-packet-mode="packet-bar" data-state="' + esc(kind) + '" data-signal-depth="' + depth + '" aria-label="signal depth ' + depth + ' of 3">' +
    [1, 2, 3].map(i => '<i data-active="' + (i <= depth ? 'true' : 'false') + '"></i>').join('') +
  '</span>';
}
function mcKpiPulse(row, index){
  const progress = mcKpiProgress(row);
  const state = mcKpiState(row);
  const kind = index === 0 ? 'survival' : 'better-than-survival';
  return '<div class="mc-kpi-row" data-component="KpiPulse" data-kpi-kind="' + kind + '" data-state="' + esc(mcStateKind(state)) + '">' +
    mcOrbitProgress({ value:progress, state, label:'KPI', ariaLabel:'KPI ' + (index + 1) + ' progress ' + progress + '%' }) +
    '<span class="mc-kpi-copy"><b>' + esc(row.label || ('KPI ' + (index + 1))) + '</b><span>' + esc((row.currentState || 'not proven') + ' · survival: ' + (row.survival || 'missing')) + '</span><small>' + esc(row.betterThanSurvival ? 'better: ' + row.betterThanSurvival : 'better-than-survival proof pending') + '</small>' + mcKpiBars(progress, state) + '</span>' +
  '</div>';
}
const MC_BOARD_GLYPHS = Object.freeze([
  ['genesis','Genesis','seed star'],
  ['taste','Taste','capsule proof'],
  ['build','Build','triangle scaffold'],
  ['ops','Ops','folded slab'],
  ['cortex','Cortex','radial ring'],
  ['arc','Arc','crescent path'],
  ['proof','Proof','curled receipt'],
  ['gate','Gate','triangle aperture'],
]);
const MC_BOARD_STATES = Object.freeze([
  ['idle','Idle','quiet rail'],
  ['active','Active','current work'],
  ['selected','Selected','focused branch'],
  ['complete','Complete','verified growth'],
  ['blocked','Blocked','hard stop'],
  ['locked','Locked','permission held'],
  ['stale','Stale','old proof'],
  ['reduced-motion','Reduced motion','static equivalent'],
]);
const MC_BOARD_ORBITS = Object.freeze([
  [0,'idle','0'],
  [25,'active','25'],
  [50,'active','50'],
  [75,'proof-needed','75'],
  [100,'complete','100'],
  [36,'blocked','blocked'],
  [18,'stale','stale'],
]);
const MC_BOARD_LEGEND = Object.freeze([
  ['node','Node','branch or proof point'],
  ['rail','Rail','path between points'],
  ['packet','Packet','moving proof unit'],
  ['orbit','Orbit','progress ring'],
  ['active','Active','current work'],
  ['warning','Warning','blocked or proof needed'],
  ['locked','Locked','permission gate'],
  ['stale','Stale','old evidence'],
]);
function mcBoardPanel(title, component, body){
  return '<section class="component-panel" data-component="' + esc(component) + '"><h3>' + esc(title) + '</h3>' + body + '</section>';
}
function renderComponentGlyphStateBoard(){
  return mcBoardPanel('1. Glyphs', 'ComponentGlyphStateBoard',
    '<div class="component-grid component-glyph-grid">' + MC_BOARD_GLYPHS.map(([kind, name, note]) =>
      '<div class="component-glyph-cell" data-component="GlyphAsset" data-glyph-kind="' + esc(kind) + '">' +
        mcGlyphSvg(kind, kind === 'gate' || kind === 'proof' ? 'proof-needed' : 'active') +
        '<span><b>' + esc(name) + '</b><small>' + esc(note) + '</small></span>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentStateBoard(){
  return mcBoardPanel('2. States', 'ComponentStateBoard',
    '<div class="component-grid component-state-grid">' + MC_BOARD_STATES.map(([state, name, note]) =>
      '<div class="component-state-cell" data-component="StateAsset" data-state="' + esc(state) + '">' +
        '<span><b>' + esc(name) + '</b><small>' + esc(note) + '</small></span>' +
        mcStateToken(state, state) +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentOrbitBoard(){
  return mcBoardPanel('3. Orbit Progress', 'ComponentOrbitProgressBoard',
    '<div class="component-grid component-orbit-grid">' + MC_BOARD_ORBITS.map(([value, state, label]) =>
      '<div class="component-frame" data-component="OrbitProgressAsset" data-state="' + esc(state) + '">' +
        mcOrbitProgress({ value, state, label: String(label) }) +
        '<small>' + esc(state) + '</small>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentMissionComponentsBoard(){
  const questline = '<div class="mc-questline" data-component="QuestlineTimeline">' +
    [['genesis','seed','complete'],['ops','packet','active'],['proof','proof','proof-needed'],['gate','launch','locked']].map(([glyph, label, state]) =>
      '<div class="mc-questline-row">' + mcGlyphSvg(glyph, state) + '<b>' + esc(label) + '</b>' + mcStateToken(state, state === 'proof-needed' ? 'proof' : state) + '</div>'
    ).join('') +
  '</div>';
  const proofList = '<div class="mc-proof-list" data-component="ProofList">' +
    '<span>' + mcGlyphSvg('proof', 'proof-needed') + '<span><b>ProofList</b>receipt required before claim</span>' + mcStateToken('proof-needed', 'proof') + '</span>' +
    '<span>' + mcGlyphSvg('build', 'blocked') + '<span><b>Blocked proof</b>missing live route or artifact</span>' + mcStateToken('blocked', 'blocked') + '</span>' +
  '</div>';
  const kpiPulse = mcKpiPulse({ label:'KpiPulse', currentState:'signal depth served', survival:'survival threshold', betterThanSurvival:'better-than-survival evidence' }, 0);
  const gateRow = '<div class="mc-action-row" data-component="GateActionRow">' +
    '<button type="button" data-component="GateAction" data-mission-action="gate">Review Gate</button>' +
    '<button type="button" class="secondary" data-component="ProofAction" data-mission-action="proof">Open Proof</button>' +
  '</div>';
  return mcBoardPanel('4. Mission Components', 'ComponentMissionComponentsBoard',
    '<div class="component-grid component-mission-grid">' +
      '<div class="component-sample component-branch-chip-sample mc-branch-chip is-selected" data-component="BranchArcChip">' + mcGlyphSvg('genesis', 'selected') + '<span class="mc-branch-copy"><b>BranchArcChip</b><small>selected glyph</small></span>' + mcStateToken('selected', 'selected') + '</div>' +
      '<section class="component-sample mc-mission-card" data-component="MissionCard"><div class="mc-card-head"><span>' + mcStateToken('active', 'Next Mission') + '</span>' + mcOrbitProgress({ value: 42, state: 'active', label: '42%' }) + '</div><h3>MissionCard</h3><p>hero branch objective with proof-bound progress.</p></section>' +
      '<div class="component-sample"><div class="component-sample-title">QuestlineTimeline</div>' + questline + '</div>' +
      '<div class="component-sample"><div class="component-sample-title">ProofList</div>' + proofList + '</div>' +
      '<div class="component-sample"><div class="component-sample-title">KpiPulse</div>' + kpiPulse + '</div>' +
      '<div class="component-sample"><div class="component-sample-title">GateActionRow</div>' + gateRow + '</div>' +
    '</div>'
  );
}
function renderComponentMotionBoard(){
  const motions = [
    ['orbitSweep','Orbit Sweep', [mcOrbitProgress({ value: 25, state: 'active', label: '25' }), mcOrbitProgress({ value: 50, state: 'active', label: '50' }), mcOrbitProgress({ value: 75, state: 'proof-needed', label: '75' })]],
    ['packetDrift','Packet Drift', [mcSignalRail({ state: 'idle', packetCount: 4 }), mcSignalRail({ state: 'active', packetCount: 6 }), mcSignalRail({ state: 'blocked', packetCount: 3 })]],
    ['glyphBreathe','Glyph Breathe', [mcGlyphSvg('genesis', 'active', { motion:'glyphBreathe' }), mcGlyphSvg('taste', 'selected'), mcGlyphSvg('gate', 'blocked')]],
    ['warningAttention','Warning Attention', [mcStateToken('proof-needed', 'proof'), mcStateToken('blocked', 'blocked'), mcStateToken('stale', 'stale')]],
    ['reducedMotion','Reduced Motion', [mcGlyphSvg('arc', 'reduced-motion'), mcStateToken('reduced-motion', 'static'), mcOrbitProgress({ value: 50, state: 'reduced-motion', label: 'RM' })]],
  ];
  return mcBoardPanel('5. Motion Primitives', 'ComponentMotionPrimitives',
    '<div class="component-grid component-motion-grid">' + motions.map(([motion, name, frames]) =>
      '<div class="component-frame" data-component="MotionPrimitive" data-motion="' + esc(motion) + '">' +
        '<b>' + esc(name) + '</b><small>' + esc(motion) + '</small>' +
        '<div class="component-motion-frames">' + frames.map(frame => '<span class="component-motion-frame">' + frame + '</span>').join('') + '</div>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentLegendBoard(){
  return mcBoardPanel('6. Legend', 'ComponentLegend',
    '<div class="component-grid component-legend-grid">' + MC_BOARD_LEGEND.map(([key, name, note]) =>
      '<div class="component-legend-item" data-component="LegendAsset" data-legend-kind="' + esc(key) + '">' +
        '<i class="component-legend-node is-' + esc(key) + '"></i>' +
        '<span><b>' + esc(name) + '</b><small>' + esc(note) + '</small></span>' +
      '</div>'
    ).join('') + '</div>'
  );
}
function renderComponentGallery(env){
  const wrap = $('mapwrap'); if (!wrap) return;
  const badge = $('sceneBadge');
  if (badge) {
    badge.textContent = 'Components';
    badge.dataset.scene = 'components';
    badge.dataset.ecosystemTarget = 'mission-control-components';
  }
  wrap.innerHTML =
    '<section class="component-board" data-component="ComponentGallery" data-source="01-component-glyph-state-board.png" data-fixture="' + esc((env && env.source) || 'unknown') + '">' +
      '<header class="component-board-head" data-component="ComponentBoardHeader"><div><h2>Glyph State Board</h2><p>Runtime extraction of the modular-components reference: glyphs, states, orbit progress, mission samples, motion primitives, and legend assets.</p></div><span>component proof</span></header>' +
      renderComponentGlyphStateBoard() +
      renderComponentStateBoard() +
      renderComponentOrbitBoard() +
      renderComponentMissionComponentsBoard() +
      renderComponentMotionBoard() +
      renderComponentLegendBoard() +
    '</section>';
}
const PARAMS = new URLSearchParams(location.search);
const TENANT = (PARAMS.get('tenant')
  || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || 'cambium').replace(/[^a-z0-9-]/gi,'') || 'cambium';
const REFRESH_ROUTE = '/api/quests/' + TENANT;
const SCENE_PARAM = String(PARAMS.get('scene') || '').toLowerCase();
const START_SCENE = ({ mission:0, quests:0, quest:0, q:0, gate:1, tools:2, commands:2, story:3, inspect:4, map:4, components:4, component:4, board:4 }[SCENE_PARAM] ?? 0);
$('ten').textContent = TENANT;
let LEDGER = null;
let ECOSYSTEM_ENV = null;
let FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'freshness missing' };

/* ── scene engine: tap + finger-tracked swipe (axis-locked, momentum, rubber-band) ── */
const track = $('track'), ind = $('ind'), SCN = 5;
let scene = START_SCENE;
const SCENE_META = [
  { label:'Mission', source:'tg-miniapp-scenes@v1', target:'product-branches', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; decisions stay behind signed actions' },
  { label:'Gate', source:'tg-miniapp-scenes@v1', target:'telegram', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; founder decisions require confirmation' },
  { label:'Tools', source:'tg-miniapp-scenes@v1', target:'hermes', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; tool actions remain explicit' },
  { label:'Story', source:'tg-miniapp-scenes@v1', target:'operator-narrative', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; story rows stay evidence-backed' },
  { label:'Inspect', source:'tg-miniapp-scenes@v1', target:'cambium-worker', refresh:'Pull to refresh updates ' + REFRESH_ROUTE + '; proof detail stays inspectable' },
];
$('ptr').dataset.refreshRoute = REFRESH_ROUTE;
$('ptrProof').textContent = 'Pull to refresh updates ' + REFRESH_ROUTE + '; decisions stay behind signed actions.';
const W = () => track.clientWidth || window.innerWidth;
function place(x, animate){
  track.style.transition = (animate && !RM) ? 'transform .5s var(--ease)' : 'none';
  track.style.transform = 'translate3d(' + x + 'px,0,0)';
}
function liveInd(x){ ind.style.transition='none';
  ind.style.transform = 'translateX(' + (100 * Math.min(SCN-1, Math.max(0, -x / W()))) + '%)'; }
function go(i, fromSwipe){
  scene = Math.min(SCN-1, Math.max(0, i));
  place(-scene * W(), true);
  ind.style.transition = RM ? 'none' : 'transform .45s var(--ease)';
  ind.style.transform = 'translateX(' + (100 * scene) + '%)';
  [0,1,2,3,4].forEach(n => { $('tb'+n).classList.toggle('on', n === scene); $('tb'+n).setAttribute && $('tb'+n).setAttribute('aria-selected', n === scene ? 'true' : 'false'); });
  updateSceneBadge();
  if (scene === 1) loadGate();
  if (scene === 2) renderCommands();
  if (!fromSwipe) buzz('light');
}
[0,1,2,3,4].forEach(n => $('tb'+n).onclick = () => go(n));
function updateSceneBadge(){
  const meta = SCENE_META[scene] || SCENE_META[0];
  const badge = $('sceneBadge');
  badge.textContent = meta.label;
  badge.dataset.scene = meta.label.toLowerCase();
  badge.dataset.ecosystemTarget = meta.target;
}
function interactionInventory(){
  const html = [$('mapwrap'), $('cmds'), $('beats'), $('gate'), $('sceneBadge'), $('fresh')]
    .map(el => el ? (el.outerHTML || el.innerHTML || '') : '').join('');
  return {
    sheet: /data-interaction-kind="sheet"|data-live=|data-tapestry=|data-wake=|data-sense=|data-lane=|data-skill=|data-npc=|data-live-proof=|data-policy=|data-decision=|data-social=|data-box=/.test(html),
    signedAction: /data-signed-action-entrypoint=|data-kind="approve"|data-kind="reroll"/.test(html),
    chatCommand: /data-interaction-kind="chat-command"/.test(html),
    readOnly: /data-interaction-kind="read-only"/.test(html),
  };
}
function reducedMotionProofRow(){
  const inv = interactionInventory();
  return '<b>reduced motion proof</b><span data-reduced-motion-proof="1" data-sheet="' + inv.sheet + '" data-signed-action="' + inv.signedAction + '" data-chat-command="' + inv.chatCommand + '" data-read-only="' + inv.readOnly + '">scene state changes remain visible; sheet=' + inv.sheet + ' · signed action=' + inv.signedAction + ' · chat command=' + inv.chatCommand + ' · read-only=' + inv.readOnly + '</span>';
}
function openSceneSheet(){
  const meta = SCENE_META[scene] || SCENE_META[0];
  $('sheetBody').innerHTML = '<div class="arc">view details · ' + esc(meta.label.toLowerCase()) + '</div><h2>' + esc(meta.label) + '</h2>' +
    '<div class="nar">Inspect keeps proof, packet, freshness, and system detail behind the main Mission Control flow.</div>' +
    '<div class="kv"><b>view</b><span>' + esc(meta.source) + '</span><b>target</b><span>' + esc(meta.target) + '</span><b>refresh</b><span>' + esc(meta.refresh) + '</span>' + reducedMotionProofRow() + '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
$('sceneBadge').onclick = openSceneSheet;

function isInteractiveSceneTarget(target){
  return Boolean(target && target.closest && target.closest('button,a,input,textarea,select,label,[role="button"],[data-no-scene-drag]'));
}

/* commands panel — the /ts-* co-founder interface.
   4th tuple element: live-data keys open sourced sheets; act/digest open
   chat-command guidance sheets; omitted kind is a read-only command reference. */
let CMDDATA = null;
let TOOL_GROUP_FILTER = 'all';
const CMDS = [
  ['Act', [
    ['ts-run', '<agent> <task>', 'Assign the next mission step', 'act'],
    ['ts-approve', '<id>', 'Approve a waiting decision', 'act'],
    ['ts-reject', '<id> <reason>', 'Send a decision back with reason', 'act'],
  ]],
  ['Ask', [
    ['ts-status', '', 'Check active arcs, agents, and work health', 'status'],
    ['ts-hermes', '', 'Check timers and service health', 'hermes'],
    ['ts-agents', '', 'Inspect who can take the next mission', 'agents'],
    ['ts-projects', '', 'Review active work tied to branches', 'work'],
    ['ts-agent', '<name>', 'Inspect one agent before dispatch'],
    ['ts-project', '<slug>', 'Inspect one project before action'],
  ]],
  ['Report', [
    ['ts-standup', '', 'Summarize today\\'s mission movement', 'digest'],
    ['ts-digest', '', 'Prepare the founder progress digest', 'digest'],
    ['ts-help', '', 'List available toolbelt commands', 'digest'],
  ]],
  ['Coordinate', [
    ['ts-handoffs', '', 'See decisions waiting on a founder', 'handoffs'],
    ['ts-vault', '<path>', 'Read supporting context by path'],
  ]],
];
const LIVE_CMD_KEYS = { status:1, hermes:1, agents:1, work:1, handoffs:1 };
const LIVE_CMD_NAMES = { status:'ts-status', hermes:'ts-hermes', agents:'ts-agents', work:'ts-projects', handoffs:'ts-handoffs' };
const COMMANDS_BY_NAME = {};
CMDS.forEach(([group, items]) => items.forEach(([name, args, desc, kind]) => {
  COMMANDS_BY_NAME[name] = { group, name, args, desc, kind:kind || 'reference' };
}));
let cmdsDrawn = false;
function toolGroupControls(){
  const groups = ['all'].concat(CMDS.map(([group]) => group));
  return '<div class="tool-context-strip" data-component="ToolGroupSegmentedControl">' + groups.map(group =>
    '<button type="button" class="' + (TOOL_GROUP_FILTER === group ? 'is-selected' : '') + '" data-tool-group="' + esc(group) + '">' + esc(group) + '</button>'
  ).join('') + '</div>';
}
function commandInteraction(kind){
  if (LIVE_CMD_KEYS[kind]) return 'sheet';
  if (kind === 'act' || kind === 'digest') return 'chat-command';
  return 'read-only';
}
function commandSource(kind){
  if (LIVE_CMD_KEYS[kind]) return 'paperclipCommandsData';
  if (kind === 'act' || kind === 'digest') return 'curios.self-chat-command';
  return 'curios.self-command-reference';
}
function commandPrimarySource(kind){
  if (LIVE_CMD_KEYS[kind]) return 'mission-toolbelt-live@v1';
  if (kind === 'act' || kind === 'digest') return 'curios.self-chat-command';
  return 'curios.self-command-reference';
}
function commandUsage(cmd){ return '/' + cmd.name + (cmd.args ? ' ' + cmd.args : ''); }
function hasClipboardApi(){
  const nav = globalThis.navigator;
  return !!(nav && nav.clipboard && typeof nav.clipboard.writeText === 'function');
}
async function copyCommandToClipboard(text, node){
  const nav = globalThis.navigator;
  if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== 'function') return { ok:false, reason:'clipboard unavailable' };
  await nav.clipboard.writeText(text);
  if (node) node.textContent = 'Copied command text';
  return { ok:true, copied:text };
}
function commandCopyControl(text){
  return hasClipboardApi()
    ? '<div class="gbtns command-copy"><button type="button" data-copy-command="' + esc(text) + '">Copy command text</button></div>'
    : '<div class="kv"><b>command text</b><span>' + esc(text) + '</span><b>copy</b><span>clipboard unavailable; select and copy this read-only command text</span></div>';
}
function wireCommandCopy(text){
  const btn = $('sheetBody').querySelector('[data-copy-command]');
  if (btn) btn.onclick = () => copyCommandToClipboard(text, btn).catch(() => { btn.textContent = 'Copy unavailable'; });
}
function commandGlyphKind(cmd){
  if (cmd.group === 'Act') return 'gate';
  if (cmd.group === 'Ask') return 'cortex';
  if (cmd.group === 'Report') return 'proof';
  if (cmd.group === 'Coordinate') return 'ops';
  return 'arc';
}
function commandAvailability(cmd){
  if (LIVE_CMD_KEYS[cmd.kind]) return CMDDATA ? 'active' : 'stale';
  if (cmd.kind === 'act' || cmd.kind === 'digest') return 'active';
  return 'idle';
}
function commandAvailabilityLabel(state){
  if (state === 'stale') return 'stale';
  if (state === 'active') return 'usable';
  return 'reference';
}
function toolRecommendationCard(){
  return '<section class="tool-recommend" data-component="ToolRecommendationPanel">' +
    mcGlyphSvg('ops', CMDDATA ? 'active' : 'stale') +
    '<span><b>Recommended next tool</b><small>Start with /ts-status before acting; it checks active arcs, agents, and work health.</small></span>' +
    '<button type="button" data-tool-recommend="ts-status">Open</button>' +
  '</section>';
}
function toolContextStrip(){
  const liveState = CMDDATA ? 'live data available' : 'live data stale';
  return '<div class="tool-context-strip" data-component="ToolContextChips">' +
    '<span>mission branch context</span><span>' + esc(liveState) + '</span><span>copy-only commands</span><span>signed decisions stay in Gate</span>' +
  '</div>';
}
function toolRecentStrip(){
  const recents = ['ts-status', 'ts-hermes', 'ts-standup'];
  return '<div class="tool-recent-strip" data-component="ToolRecentStrip">' + recents.map(name =>
    '<button type="button" data-tool-recent="' + esc(name) + '">/' + esc(name) + '</button>'
  ).join('') + '</div>';
}
function toolSafetyRow(kind){
  const label = LIVE_CMD_KEYS[kind] ? 'opens a live detail sheet' : kind === 'act' || kind === 'digest' ? 'copies command text for chat' : 'reference only';
  return '<div class="tool-safety-row" data-component="ToolSafetyRow">Safety: ' + esc(label) + '; the mini app does not send bot messages or mutate Paperclip from Tools.</div>';
}
function openCommandCardSheet(name){
  const cmd = COMMANDS_BY_NAME[name];
  if (!cmd) return;
  const interaction = commandInteraction(cmd.kind);
  const source = commandSource(cmd.kind);
  const text = commandUsage(cmd);
  const guidance = interaction === 'chat-command'
    ? 'Type this command in the curios.self bot chat. The mini app only copies command text; it does not send data, write Paperclip, or fabricate chat output.'
    : 'Reference command sheet. Type this command in the curios.self bot chat when you want this inspection.';
  $('sheetBody').innerHTML = '<div class="arc">command · ' + esc(interaction) + '</div><h2>' + esc('/' + cmd.name) + '</h2>' +
    '<div class="nar">' + esc(guidance) + '</div>' +
    '<div class="kv"><b>interaction</b><span>' + esc(interaction) + '</span><b>chat syntax</b><span>' + esc(text) + '</span><b>source</b><span>' + esc(source) + '</span><b>card group</b><span>' + esc(cmd.group) + '</span><b>description</b><span>' + esc(cmd.desc) + '</span><b>payload preview</b><span>' + esc(text) + '</span><b>mini app writes</b><span>none; copy only, no signed gate endpoint</span><b>signed action button</b><span>not rendered for command sheets</span></div>' +
    toolSafetyRow(cmd.kind) + commandCopyControl(text);
  wireCommandCopy(text);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(interaction === 'chat-command' ? 'medium' : 'light');
}
function renderCommands(){
  if (cmdsDrawn) return; cmdsDrawn = true;
  const groups = TOOL_GROUP_FILTER === 'all' ? CMDS : CMDS.filter(([group]) => group === TOOL_GROUP_FILTER);
  $('cmds').innerHTML = toolRecommendationCard() + toolGroupControls() + toolContextStrip() + toolRecentStrip() + groups.map(([group, items]) =>
    '<div class="cmdgrp">' + esc(group) + '</div>' +
    items.map(([name, args, desc, kind]) => {
      const live = kind && LIVE_CMD_KEYS[kind];
      const action = kind === 'act';
      const digest = kind === 'digest';
      const reference = !live && !action && !digest;
      const interaction = commandInteraction(kind || 'reference');
      const source = commandPrimarySource(kind || 'reference');
      const cmd = { group, name, args, desc, kind:kind || 'reference' };
      const state = commandAvailability(cmd);
      const classKind = live ? ' live' : action ? ' act' : reference ? ' ref' : digest ? ' report' : '';
      return '<button type="button" class="' + mcClass('cmd' + classKind, state) + '" data-component="ToolActionCard"' +
        ' data-interaction-kind="' + interaction + '" data-source="' + source + '"' +
        ' data-inspect-target="tools"' +
        ' data-command-kind="' + (kind || 'reference') + '"' +
        ' data-command-name="' + esc(name) + '"' +
        (state === 'stale' ? ' data-disabled-reason="live command data unavailable"' : '') +
        (live ? ' data-live="' + kind + '"' : '') + '>' +
        mcGlyphSvg(commandGlyphKind(cmd), state) +
        '<span class="tool-body"><span class="cdesc"><b>Mission effect</b>' + esc(desc) + '</span>' +
          '<span class="tool-syntax"><span class="cname">/' + esc(name) + '</span>' +
          (args ? '<span class="cargs">' + esc(args) + '</span>' : '') + '</span></span>' +
        mcStateToken(state, commandAvailabilityLabel(state)) +
        '<span class="cgo">›</span>' +
      '</button>';
    }).join('')
  ).join('') +
  '<div class="gnote" style="margin-top:18px">Use Tools to inspect, assign, coordinate, and report from the operator chat.</div>';
  $('cmds').querySelectorAll('[data-tool-group]').forEach(el => el.onclick = () => {
    TOOL_GROUP_FILTER = el.dataset.toolGroup || 'all';
    cmdsDrawn = false;
    renderCommands();
  });
  $('cmds').querySelectorAll('[data-tool-recommend],[data-tool-recent]').forEach(el => el.onclick = () => openCommandCardSheet(el.dataset.toolRecommend || el.dataset.toolRecent));
  $('cmds').querySelectorAll('.cmd').forEach(el => el.onclick = () => el.dataset.live ? openCmdSheet(el.dataset.live) : openCommandCardSheet(el.dataset.commandName));
}
function kvRows(pairs){ return '<div class="kv">' + pairs.map(([k,v]) => '<b>'+esc(k)+'</b><span>'+esc(v)+'</span>').join('') + '</div>'; }
function openCmdSheet(key){
  const d = CMDDATA;
  let title = '', body = '';
  const liveCommandText = '/' + (LIVE_CMD_NAMES[key] || 'ts-status');
  if (!d){ title = 'commands'; body = '<div class="nar">org data unavailable: Paperclip gateway unreachable; gateway was unreachable at the last refresh. Pull-to-refresh only; this sheet does not write local state, call signed gate endpoints, or synthesize command results.</div>'; }
  else if (key === 'status'){
    title = '/ts-status';
    body = kvRows([['source', 'Paperclip command data · paperclipCommandsData'], ['agents', String(d.status.agents)], ['work open', String(d.status.issuesOpen)], ['work done', String(d.status.issuesDone)], ['arcs', d.status.arcs], ['Hermes', d.status.hermes || 'unknown']]);
  } else if (key === 'hermes'){
    title = '/ts-hermes · services';
    body = kvRows([['source', 'Hermes runtime · paperclipCommandsData'], ['service statuses', String((d.services||[]).length)]]) +
      ((d.services||[]).length ? (d.services||[]).map(s => '<div class="li"><div><span class="cname">'+esc(s.name)+'</span> <span class="cargs">'+esc(s.status)+'</span><div class="cdesc">'+esc(s.detail || s.label)+'</div></div></div>').join('') : '<div class="nar">no Hermes service data.</div>');
  } else if (key === 'agents'){
    title = '/ts-agents · ' + (d.agents||[]).length;
    body = kvRows([['source', 'paperclipCommandsData']]) +
      ((d.agents||[]).length ? (d.agents||[]).map(a => '<div class="li"><div><span class="cname">'+esc(a.name)+'</span>'+(a.model?'<span class="cargs">'+esc(a.model)+'</span>':'')+'<div class="cdesc">model · '+esc(a.model || 'missing')+' · source paperclipCommandsData</div></div></div>').join('') : '<div class="nar">no agents.</div>');
  } else if (key === 'work'){
    title = '/ts-projects · active work';
    body = kvRows([['source', 'paperclipCommandsData']]) +
      ((d.work||[]).length ? (d.work||[]).map(w => '<div class="li"><div><span class="cname">'+esc(w.id)+'</span> <span class="cargs">'+esc(w.status)+'</span><div class="cdesc">title '+esc(w.title)+' · owner '+esc(w.who || w.owner || 'missing')+' · source '+esc(w.source || 'paperclipCommandsData')+'</div></div></div>').join('') : '<div class="nar">no active work.</div>');
  } else if (key === 'handoffs'){
    title = '/ts-handoffs · ' + (d.handoffs||[]).length;
    body = kvRows([['source', 'paperclipCommandsData'], ['gate relation', 'handoff rows are review context; signed gate actions stay in the Gate scene']]) +
      ((d.handoffs||[]).length ? (d.handoffs||[]).map(h => '<div class="li"><span class="cname">'+esc(h.id)+'</span> <span class="cargs">'+esc(h.status)+'</span><div class="cdesc">title '+esc(h.title)+' · source '+esc(h.source || 'paperclipCommandsData')+' · gate relation '+esc(h.gateRelation || 'founder gate review context only')+'</div></div>').join('') : '<div class="nar">nothing waiting on you.</div>');
  }
  $('sheetBody').innerHTML = '<div class="arc">live · derived with the ledger</div><h2>'+esc(title)+'</h2>' + body + toolSafetyRow(key) + commandCopyControl(liveCommandText);
  wireCommandCopy(liveCommandText);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
window.addEventListener('resize', () => place(-scene * W(), false));

// pointer drag: one handler set, decides axis on first move.
let drag = null;
track.addEventListener('pointerdown', e => {
  if (sheetState.open) return;
  if (isInteractiveSceneTarget(e.target)) return;
  drag = { sx:e.clientX, sy:e.clientY, base:-scene*W(), axis:null, lx:e.clientX, lt:e.timeStamp, v:0,
           scn: track.children[scene], ptr:false };
});
track.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.axis){
    if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
    if (Math.abs(dx) > Math.abs(dy)){ drag.axis = 'x'; try{ track.setPointerCapture(e.pointerId); }catch(_){} }
    else { drag.axis = 'y';
      // pull-to-refresh only at the very top, pulling down
      if (dy > 0 && drag.scn && drag.scn.scrollTop <= 0){ drag.ptr = true; try{ track.setPointerCapture(e.pointerId); }catch(_){} }
    }
  }
  if (drag.axis === 'x'){
    e.preventDefault();
    let x = drag.base + dx, min = -(SCN-1)*W(), max = 0;
    if (x > max) x = max + (x-max)*0.35;
    if (x < min) x = min + (x-min)*0.35;
    place(x, false); liveInd(x);
    drag.v = (e.clientX - drag.lx) / Math.max(1, e.timeStamp - drag.lt);
    drag.lx = e.clientX; drag.lt = e.timeStamp;
  } else if (drag.ptr){
    e.preventDefault();
    const pull = Math.min(90, dy * 0.5);
    const p = $('ptr');
    p.classList.add('show');
    p.style.transition = 'none';
    p.style.transform = 'translate(-50%,' + (pull - 30) + 'px) scale(' + (0.4 + pull/130) + ')';
    p.style.opacity = Math.min(1, dy/110);
    drag.pull = dy;
  }
});
function endDrag(e){
  if (!drag) return;
  const d = drag; drag = null;
  if (d.axis === 'x'){
    const dx = (e ? e.clientX : d.lx) - d.sx;
    let t = scene;
    if (d.v < -0.45 || dx < -W()*0.28) t = scene + 1;
    else if (d.v > 0.45 || dx > W()*0.28) t = scene - 1;
    if (t !== scene && t >= 0 && t < SCN) buzz('light');
    go(t, true);
  } else if (d.ptr){
    const p = $('ptr');
    p.style.transition = 'transform .4s var(--ease),opacity .3s var(--ease)';
    if (d.pull > 70){ p.classList.add('spin'); buzz('medium');
      p.style.transform = 'translate(-50%,8px) scale(1)';
      refresh().finally(() => { p.classList.remove('spin','show'); p.style.opacity=0;
        p.style.transform='translate(-50%,-30px) scale(.4)'; });
    } else { p.classList.remove('show'); p.style.opacity=0; p.style.transform='translate(-50%,-30px) scale(.4)'; }
  }
}
track.addEventListener('pointerup', endDrag);
track.addEventListener('pointercancel', endDrag);

/* ── bottom sheet (quest/ring detail) with drag-to-dismiss ── */
const veil = $('veil'), sheet = $('sheet');
const sheetState = { open:false };
function openSheet(row){
  const env = ECOSYSTEM_ENV || {};
  const policy = policyCard(env.ledger ? env : { ledger: LEDGER || { rows: [] } });
  const rawPolicy = env.policy || {};
  const nextActionSource = policy.state === 'ready' && rawPolicy.source
    ? rawPolicy.source
    : 'policy gap: ' + (rawPolicy.gap || rawPolicy.detail || (policy.blockers && policy.blockers[0]) || policy.detail || 'next-action recommendation policy missing');
  const nextActionRows = row.status === 'active'
    ? '<b>next action source</b><span>' + esc(nextActionSource) + '</span><b>next action</b><span>' + esc(policy.detail || 'policy action not served') + '</span>'
    : '';
  $('sheetBody').innerHTML =
    '<div class="arc">arc ' + esc(row.arc) + ' · ' + esc(row.id) + '</div>' +
    '<h2>' + esc(row.title) + '</h2>' +
    (row.narration ? '<div class="nar">' + esc(row.narration) + '</div>' : '') +
    '<div class="kv">' +
      '<b>source</b><span>' + esc(questSource(row)) + '</span>' +
      '<b>status</b><span class="status-' + esc(row.status) + '">' + esc(row.status) + '</span>' +
      '<b>arc</b><span>' + esc(row.arc || 'missing') + '</span>' +
      '<b>quest id</b><span>' + esc(row.id || 'missing') + '</span>' +
      '<b>evidence</b><span>' + esc(row.evidence) + '</span>' +
      nextActionRows +
      (row.reveals ? '<b>reveals</b><span>' + esc(row.reveals) + '</span>' : '') +
    '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function questSource(row){
  const env = ECOSYSTEM_ENV || {};
  return row.source || row.origin || (env.ledger && env.ledger.source) || env.source || 'missing';
}
function currentQuestRow(L){
  const rows = L && Array.isArray(L.rows) ? L.rows : [];
  const current = L && L.current;
  if (!current) return activeRow(L || { rows: [] }) || null;
  return rows.find(row => (current.id && row.id === current.id) || (row.arc === current.arc && row.title === current.title))
    || activeRow(L || { rows: [] })
    || current;
}
function currentQuestId(L){
  const row = currentQuestRow(L);
  const current = L && L.current;
  return (row && row.id) || (current && current.id) || 'not served';
}
function openProgressSheet(L){
  $('sheetBody').innerHTML = '<div class="arc">quest progress · quine</div><h2>Quest Progress</h2>' +
    '<div class="nar">Progress is derived from the served quest ledger, not browser-local completion.</div>' +
    '<div class="kv"><b>completed count</b><span>' + esc(L.completed) + '</span><b>total count</b><span>' + esc(L.total) + '</span><b>source</b><span>' + esc(questSource({})) + '</span><b>active quest id</b><span>' + esc(currentQuestId(L)) + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openFrontierSheet(L){
  const row = currentQuestRow(L);
  const current = L && L.current;
  $('sheetBody').innerHTML = '<div class="arc">quest frontier · quine</div><h2>Current Frontier</h2>' +
    '<div class="nar">' + esc(row ? 'The frontier points at the current active ledger row.' : 'No active frontier is currently served by the ledger.') + '</div>' +
    '<div class="kv"><b>current arc</b><span>' + esc((row && row.arc) || (current && current.arc) || 'complete') + '</span><b>quest title</b><span>' + esc((row && row.title) || (current && current.title) || 'no active quest') + '</span><b>evidence</b><span>' + esc((row && row.evidence) || (current && current.evidence) || 'frontier evidence not served') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row ? 'medium' : 'light');
}
function closeSheet(){ veil.classList.remove('on'); sheet.classList.remove('on'); sheetState.open=false;
  sheet.style.transition=''; sheet.style.transform=''; buzz('light'); }
veil.onclick = closeSheet;
let sdrag = null;
sheet.addEventListener('pointerdown', e => { sdrag = { sy:e.clientY, ly:e.clientY, lt:e.timeStamp, v:0 };
  try{ sheet.setPointerCapture(e.pointerId); }catch(_){} });
sheet.addEventListener('pointermove', e => {
  if (!sdrag) return;
  const dy = e.clientY - sdrag.sy; if (dy < 0) return;
  e.preventDefault();
  sheet.style.transition = 'none';
  sheet.style.transform = 'translateY(' + dy + 'px)';
  sdrag.v = (e.clientY - sdrag.ly) / Math.max(1, e.timeStamp - sdrag.lt);
  sdrag.ly = e.clientY; sdrag.lt = e.timeStamp;
});
function endSheet(e){ if (!sdrag) return; const d = sdrag; sdrag = null;
  const dy = (e ? e.clientY : d.ly) - d.sy;
  sheet.style.transition = 'transform .45s var(--pop)';
  if (dy > 90 || d.v > 0.5) closeSheet();
  else sheet.style.transform = 'translateY(0)';
}
sheet.addEventListener('pointerup', endSheet);
sheet.addEventListener('pointercancel', endSheet);

/* ── gate — one queued founder decision. initData proves the founder; the Worker validates (Ed25519). ── */
const initData = (TG && TG.initData) || '';
let GATE_ITEMS = [];
let GATE_FILTER = 'all';
function gateSource(it){ return (it && (it.paperclipSource || it.source || it.sourcePath || it.origin || (it.priority && it.priority.source))) || 'Paperclip · /internal/gate/' + TENANT; }
function gateOriginLabel(it){
  const raw = String(gateSource(it) || 'Paperclip');
  return raw.split(' · ')[0] || 'Paperclip';
}
function gateOwner(it){ return (it && (it.owner || it.assignee || it.founder || it.operator)) || 'owner not served'; }
function gateUpdatedAt(it){ return (it && (it.updatedAt || it.updated || it.ts || it.createdAt)) || 'updatedAt not served'; }
function gateSubject(it){ return (it && (it.id || it.title)) || 'handoff'; }
function gateEvidence(it){ return it.evidence || it.detail || it.status || 'evidence missing from handoff'; }
function gateBranchMission(it){
  const branch = it && (it.branchId || it.branch || it.productId || it.clientName);
  const mission = it && (it.missionId || it.mission || it.questId || it.title);
  return mcText(branch, 'branch not served') + ' · ' + mcText(mission, 'mission not served');
}
function gateReversibility(kind, it){ return (it && it.reversibility) || (kind === 'approve' ? 'reversible until consumed; supersede with a newer gate action' : 'reversible review request; no mutation until the org consumes it'); }
function gateQueueConsequence(raw, kind, subject){
  const fallback = kind === 'approve'
    ? 'queue founder approval for ' + subject + '; no Paperclip/org mutation until the operator consumes the queue'
    : 'queue founder reroll request for ' + subject + '; no Paperclip/org mutation until the operator consumes the queue';
  if (!raw) return fallback;
  const text = String(raw);
  const lower = String(text).toLowerCase();
  const explicitlyQueued = /\bqueu(?:e|ed|eing)\b/.test(lower);
  const explicitlyNonMutating = /(no|not|without)[^.;]*(paperclip|org|state|mutation|write|handling)/.test(lower) && /(consume|consumed|operator)/.test(lower);
  const directChangeVerb = /\b(changes?|changed|changing|updates?|updated|updating|mutates?|mutated|mutating|writes?|wrote|writing|executes?|executed|executing|applies?|applied|applying)\b/.test(lower);
  return explicitlyQueued && explicitlyNonMutating && !directChangeVerb ? text : fallback;
}
function gateConsequence(kind, it){
  const subject = gateSubject(it);
  if (kind === 'approve') return gateQueueConsequence(it && (it.approveConsequence || it.consequence), kind, subject);
  return gateQueueConsequence(it && (it.rerollConsequence || it.consequence), kind, subject);
}
function gateIdempotency(kind, it){
  const basis = it && typeof it === 'object' ? (it.idempotencyHint || it.id || 'unknown') : it;
  return kind + ':' + TENANT + ':' + basis;
}
function gatePriorityChips(it){
  const priority = it && it.priority ? it.priority : {};
  const chips = [];
  if (priority.risk) chips.push('risk · ' + priority.risk);
  if (priority.dependency) chips.push('dependency · ' + priority.dependency);
  if (priority.score != null) chips.push('score · ' + priority.score);
  return chips.length ? '<div class="gpriority">' + chips.slice(0, 4).map(chip => '<span>' + esc(chip) + '</span>').join('') + '</div>' : '';
}
function gateFilterKey(it){
  const state = mcStateKind((it && it.status) || 'proof-needed');
  if (state === 'blocked' || state === 'stale') return 'blocked';
  if (state === 'proof-needed' || state === 'active') return 'review';
  return 'all';
}
function renderGateFilters(items){
  const counts = {
    all:items.length,
    review:items.filter(item => gateFilterKey(item) === 'review').length,
    blocked:items.filter(item => gateFilterKey(item) === 'blocked').length,
  };
  return '<div class="gate-filter-strip" data-component="GateBranchFilterChips">' +
    Object.entries(counts).map(([id, count]) =>
      '<button type="button" class="' + (GATE_FILTER === id ? 'is-selected' : '') + '" data-gate-filter="' + esc(id) + '">' + esc(id) + ' · ' + count + '</button>'
    ).join('') +
  '</div>';
}
function renderGateQueue(items, source){
  if (!items.length) return renderGateEmpty(source);
  const filtered = items.map((item, index) => ({ item, index })).filter(row => GATE_FILTER === 'all' || gateFilterKey(row.item) === GATE_FILTER);
  return renderGateFilters(items) +
    (filtered.length ? filtered.map(row => renderGateItem(row.item, row.index)).join('') : '<div class="gnote">No Gate items match this branch filter.</div>') +
    '<div class="gnote">signed actions queue founder decisions; detail sheets carry audit proof.</div>';
}
function gateFact(label, value){
  return '<b>' + esc(label) + '</b><span>' + esc(value) + '</span>';
}
function renderGateEmpty(source){
  return '<div class="gate-empty" data-component="GateEmptyState" data-gate-state="empty" data-source="' + esc(source) + '">' +
    mcGlyphSvg('gate', 'locked') +
    '<div><b>no founder decisions waiting.</b><span>Gate is quiet. Evidence-backed approve and reroll choices appear here only after Cambium serves an open item.</span>' +
      mcSignalRail({ state:'locked', packetCount:3 }) +
      '<div class="gmeta gate-empty-meta">' +
        gateFact('Decision lane', 'waiting for open work') +
        gateFact('Founder action', 'confirmation appears with the next decision') +
      '</div>' +
      '<div class="gbtns"><button type="button" class="detail" data-gate-empty-nav="mission">Mission</button><button type="button" class="reroll" data-gate-empty-nav="inspect">Inspect</button></div>' +
    '</div>' +
  '</div>';
}
function renderGateError(source){
  return '<div class="gate-error" data-component="GateErrorState" data-gate-state="unreachable" data-source="' + esc(source) + '">' +
    mcGlyphSvg('gate', 'blocked') +
    '<div><b>network failure</b><span>' + esc(source) + ' unreachable; no local queue write.</span></div>' +
  '</div>';
}
function renderGateItem(it, i){
  const evidence = gateEvidence(it);
  const approveConsequence = gateConsequence('approve', it);
  const rerollConsequence = gateConsequence('reroll', it);
  const state = mcStateKind((it && it.status) || 'proof-needed');
  return '<div class="' + mcClass('gitem', state) + '" data-component="GateActionCard" style="--i:' + i + '" data-i="' + i + '" data-id="' + esc(it.id) + '" data-source="' + esc(gateSource(it)) + '">' +
    '<div class="gcard-head">' +
      mcGlyphSvg('gate', state) +
      '<div><div class="gid">' + esc(it.id) + '</div><div class="gtitle">' + esc(it.title) + '</div></div>' +
      mcStateToken(state, (it && it.status) || 'Gate review') +
    '</div>' +
    gatePriorityChips(it) +
    mcSignalRail({ state, packetCount:4 }) +
    '<div class="gbtns gate-actions">' +
    '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="approve" data-kind="approve">Approve</button><button type="button" class="reroll" data-interaction-kind="signed-action" data-signed-action-entrypoint="reroll" data-kind="reroll">Reroll</button><button type="button" class="detail" data-gate-detail="1">Details</button></div>' +
    '<div class="gmeta">' +
      gateFact('Decision waiting', gateSubject(it)) +
      gateFact('Branch / mission', gateBranchMission(it)) +
      gateFact('Proof attached', evidence) +
      gateFact('Approve consequence', approveConsequence) +
      gateFact('Reroll consequence', rerollConsequence) +
      gateFact('Reversibility', gateReversibility('approve', it)) +
    '</div>' +
    '<div class="gitem-details" data-component="GateRowExpansionDetails">' +
      '<span><b>State</b>' + esc(state) + '</span>' +
      '<span><b>Sync</b>' + esc(gateFilterKey(it) === 'blocked' ? 'needs proof before action' : 'ready for founder review') + '</span>' +
    '</div></div>';
}
function gateRows(rows){ return '<div class="kv gatekv">' + rows.map(([k,v]) => '<b>'+esc(k)+'</b><span>'+esc(v)+'</span>').join('') + '</div>'; }
function openGateSheet(arc, title, narrative, rows){
  $('sheetBody').innerHTML = '<div class="arc">' + esc(arc) + '</div><h2>' + esc(title) + '</h2>' +
    '<div class="nar">' + esc(narrative) + '</div>' + gateRows(rows);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateTelegramAuthFailure(error){
  openGateSheet('Telegram auth · blocked', 'Open inside Telegram',
    'This signed action must run inside Telegram with valid founder auth so initData can prove the founder. No local queue write was created.',
    [['source route','/api/gate/' + TENANT], ['response', error || 'missing initData (the gate opens inside Telegram)'], ['queue write','none']]);
}
function isGateAuthFailure(error){
  return /initData|Telegram|signature|auth_date|founder|verification unavailable/i.test(String(error || ''));
}
function openGateResultSheet(kind, subject, res, fallback){
  const duplicate = !!(res && res.duplicate);
  $('sheetBody').innerHTML = '<div class="arc">gate result · ' + esc(duplicate ? 'duplicate' : 'queued') + '</div><h2>' + esc(duplicate ? 'Original Queued Action Reused' : 'Founder Decision Queued') + '</h2>' +
    '<div class="nar">' + esc(duplicate
      ? 'Duplicate response reused the original queued action. This does not imply a new write.'
      : 'Signed action queued a founder decision only. Paperclip and org state do not mutate until an operator consumes the queue.') + '</div>' +
    gateRows([['action kind', kind], ['subject', subject], ['queued action', (res && res.queued) || 'missing'], ['idempotency', (res && res.idempotencyKey) || fallback.idempotencyKey], ['consequence', (res && res.consequence) || fallback.consequence], ['reversibility', (res && res.reversibility) || fallback.reversibility]]) +
    '<div class="gbtns"><button type="button" class="detail" data-gate-result-nav="mission">Mission</button><button type="button" class="reroll" data-gate-result-nav="inspect">Inspect</button></div>';
  $('sheetBody').querySelectorAll('[data-gate-result-nav]').forEach(el => el.onclick = () => {
    closeSheet();
    go(el.dataset.gateResultNav === 'mission' ? 0 : 4);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateDetailSheet(node){
  const item = GATE_ITEMS[Number(node.dataset.i)] || {};
  const evidence = gateEvidence(item);
  $('sheetBody').innerHTML = '<div class="arc">gate detail · proof</div><h2>' + esc(item.title || node.dataset.id || 'Gate item') + '</h2>' +
    '<div class="nar">Proof, consequence, reversibility, source, and sync state for this Gate row. Approve and reroll still require signed preflight.</div>' +
    gateRows([
      ['subject', gateSubject(item)],
      ['branch / mission', gateBranchMission(item)],
      ['proof attached', evidence],
      ['approve consequence', gateConsequence('approve', item)],
      ['reroll consequence', gateConsequence('reroll', item)],
      ['reversibility', gateReversibility('approve', item)],
      ['source', gateOriginLabel(item)],
      ['sync state', gateFilterKey(item) === 'blocked' ? 'blocked until proof resolves' : 'ready for founder review'],
    ]) +
    '<div class="gbtns"><button type="button" class="detail" data-gate-detail-nav="mission">Mission</button><button type="button" class="reroll" data-gate-detail-nav="inspect">Inspect</button></div>';
  $('sheetBody').querySelectorAll('[data-gate-detail-nav]').forEach(el => el.onclick = () => {
    closeSheet();
    go(el.dataset.gateDetailNav === 'mission' ? 0 : 4);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function openGatePreflight(kind, subject, node){
  const item = GATE_ITEMS[Number(node.dataset.i)] || {};
  const evidence = gateEvidence(item);
  const consequence = gateConsequence(kind, item);
  const reversibility = gateReversibility(kind, item);
  const idempotencyKey = gateIdempotency(kind, item.id ? item : subject);
  $('sheetBody').innerHTML = '<div class="arc">gate preflight · explicit confirmation</div><h2>' + esc(kind === 'approve' ? 'Approve Gate Item' : 'Reroll Gate Item') + '</h2>' +
    '<div class="nar">Review this signed action before queueing it. Confirmation queues a founder decision only; it does not mutate Paperclip or org state.</div>' +
    gateRows([['action kind',kind], ['subject',subject], ['evidence',evidence], ['consequence',consequence], ['reversibility',reversibility], ['source',gateOriginLabel(item)], ['source route','/api/gate/' + TENANT], ['initData status',initData ? 'present for Worker verification' : 'missing until opened inside Telegram'], ['idempotency',idempotencyKey]]) +
    '<div class="gbtns"><button type="button" class="approve" data-gate-confirm="' + esc(kind) + '">Confirm ' + esc(kind) + '</button><button type="button" class="reroll" data-gate-cancel="1">Cancel</button></div>';
  const confirm = $('sheetBody').querySelector('[data-gate-confirm]');
  if (confirm) confirm.onclick = () => { closeSheet(); gateAct(kind, subject, node); };
  const cancel = $('sheetBody').querySelector('[data-gate-cancel]');
  if (cancel) cancel.onclick = closeSheet;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function loadGate(){
  const el = $('gate');
  fetch('/api/quests/' + TENANT).then(r => r.ok ? r.json() : {}).then(d => {
    const items = (d && d.openItems) || [];
    GATE_ITEMS = items;
    const source = '/internal/gate/' + TENANT;
    el.innerHTML = renderGateQueue(items, source);
    loadGateWire(el, source);
  }).catch(() => {
    const source = '/internal/gate/' + TENANT;
    el.innerHTML = renderGateError(source);
  });
}
function loadGateWire(el, source){
  el.querySelectorAll('[data-gate-filter]').forEach(node => node.onclick = () => {
    GATE_FILTER = node.dataset.gateFilter || 'all';
    el.innerHTML = renderGateQueue(GATE_ITEMS, source);
    loadGateWire(el, source);
  });
  el.querySelectorAll('[data-gate-empty-nav]').forEach(node => node.onclick = () => go(node.dataset.gateEmptyNav === 'mission' ? 0 : 4));
    el.querySelectorAll('.gitem').forEach(node => {
      node.querySelector('.approve').onclick = () => openGatePreflight('approve', node.dataset.id, node);
      node.querySelector('.reroll').onclick = () => openGatePreflight('reroll', node.dataset.id, node);
      node.querySelector('[data-gate-detail]').onclick = () => openGateDetailSheet(node);
    });
}
function gateAct(kind, subject, node){
  const item = GATE_ITEMS[Number(node.dataset.i)] || {};
  const evidence = gateEvidence(item);
  const consequence = gateConsequence(kind, item);
  const reversibility = gateReversibility(kind, item);
  const idempotencyKey = gateIdempotency(kind, item.id ? item : subject);
  buzz('medium'); node.style.opacity = '.5';
  fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ kind, subject, initData, evidence, consequence, reversibility, idempotencyKey }) })
    .then(r => r.json()).then(res => {
      node.style.opacity='1';
      if (res.queued) {
        node.innerHTML = '<div class="gnote">'+(res.duplicate ? 'original queued action reused · no new write · ' : '')+esc(kind)+' founder decision queued for '+esc(subject)+' — key '+esc(res.idempotencyKey || idempotencyKey)+'</div>';
        openGateResultSheet(kind, subject, res, { idempotencyKey, consequence, reversibility });
      } else {
        const error = res.error || 'unknown';
        node.innerHTML = '<div class="gnote">refused: '+esc(error)+' · no local queue write.</div>';
        if (isGateAuthFailure(error)) openGateTelegramAuthFailure(error);
      }
      notify(res.queued ? 'success' : 'error');
    }).catch(() => { node.style.opacity='1'; node.innerHTML = '<div class="gnote">network failure — no local queue write.</div>'; });
}
function skillPromotionEvidence(skill){
  return skill.title + ' · ' + skill.detail;
}
function skillPromotionConsequence(skill){
  return 'founder review may promote ' + skill.title + ' to production after operator consumption';
}
function skillPromotionReversibility(){
  return 'queued promotion can be superseded until consumed; skill registry remains unchanged';
}
function skillPromotionIdempotency(skill){
  return 'promote-skill:' + TENANT + ':' + skill.title;
}
function sideQuestQueueId(side){
  return String(side.id || side.action.target || side.title || 'side-quest').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'side-quest';
}
function sideQuestQueueEvidence(side){
  return side.proof || side.detail || 'side quest proof missing from visual envelope';
}
function sideQuestQueueConsequence(side){
  return 'queue side quest ' + sideQuestQueueId(side) + ' for ' + (side.owner || 'operator') + ' follow-up; no browser-side completion';
}
function sideQuestQueueReversibility(){
  return 'queued side quest can be superseded until consumed; side quest ledger remains unchanged';
}
function sideQuestQueueIdempotency(side){
  return 'queue-side-quest:' + TENANT + ':' + sideQuestQueueId(side);
}
function sideQuestAct(side, node){
  const initData = TG && TG.initData || '';
  const subject = sideQuestQueueId(side);
  const evidence = sideQuestQueueEvidence(side);
  const consequence = sideQuestQueueConsequence(side);
  const reversibility = sideQuestQueueReversibility();
  const idempotencyKey = sideQuestQueueIdempotency(side);
  buzz('medium'); node.style.opacity = '.5'; node.textContent = 'queuing...';
  fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ kind:'queue-side-quest', subject, initData, evidence, consequence, reversibility, idempotencyKey, note:side.detail || '' }) })
    .then(r => r.json()).then(res => {
      node.style.opacity = '1';
      node.outerHTML = res.queued
        ? '<div class="gnote">'+(res.duplicate ? 'already queued · ' : '')+'side quest queued for '+esc(subject)+' — key '+esc(res.idempotencyKey || idempotencyKey)+'</div>'
        : '<div class="gnote">refused: '+esc(res.error || 'unknown')+'</div>';
      notify(res.queued ? 'success' : 'error');
    }).catch(() => { node.style.opacity='1'; node.outerHTML = '<div class="gnote">side quest queue unreachable.</div>'; });
}
function skillPromotionAct(skill, node){
  const initData = TG && TG.initData || '';
  const evidence = skillPromotionEvidence(skill);
  const consequence = skillPromotionConsequence(skill);
  const reversibility = skillPromotionReversibility();
  const idempotencyKey = skillPromotionIdempotency(skill);
  buzz('medium'); node.style.opacity = '.5'; node.textContent = 'queuing...';
  fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ kind:'promote-skill', subject:skill.title, initData, evidence, consequence, reversibility, idempotencyKey }) })
    .then(r => r.json()).then(res => {
      node.style.opacity = '1';
      node.outerHTML = res.queued
        ? '<div class="gnote">'+(res.duplicate ? 'already queued · ' : '')+'promotion queued for '+esc(skill.title)+' — key '+esc(res.idempotencyKey || idempotencyKey)+'</div>'
        : '<div class="gnote">refused: '+esc(res.error || 'unknown')+'</div>';
      notify(res.queued ? 'success' : 'error');
    }).catch(() => { node.style.opacity='1'; node.outerHTML = '<div class="gnote">promotion queue unreachable.</div>'; });
}

/* ── quest scene + count-up ── */
function countUp(node, to, suffix){
  if (RM){ node.textContent = to + suffix; return; }
  const dur = 900, t0 = performance.now();
  (function tick(t){ const p = Math.min(1, (t-t0)/dur), e = 1-Math.pow(1-p,3);
    node.textContent = Math.round(to*e) + suffix;
    if (p < 1) requestAnimationFrame(tick); })(t0);
}
function resetQuestSummary(text, frontier){
  const prog = $('progress');
  const here = $('here');
  prog.textContent = text;
  here.textContent = frontier;
  prog.onclick = null;
  here.onclick = null;
  delete prog.dataset.interactionKind;
  delete prog.dataset.source;
  delete here.dataset.interactionKind;
  delete here.dataset.source;
}
function renderQuests(L){
  const stem = $('stem');
  stem.classList.remove('mission-control');
  stem.innerHTML = L.rows.map((r, i) =>
    '<div class="q ' + r.status + '" style="--i:' + i + '" data-i="' + i + '" data-ecosystem-target="quine" data-interaction-kind="sheet" data-source="' + esc(questSource(r)) + '">' +
      '<div class="node">' + MARKS[r.status] + '</div>' +
      '<div><span class="arc">' + esc(r.arc) + '</span><span class="t">' + esc(r.title) + '</span>' +
      '<div class="ev">' + esc(r.evidence) + '</div></div>' +
    '</div>').join('');
  stem.querySelectorAll('.q').forEach(el => el.onclick = () => openSheet(L.rows[+el.dataset.i]));
  const pct = Math.round(100 * L.completed / L.total);
  requestAnimationFrame(() => { stem.style.setProperty('--grow', pct + '%'); $('fill').style.width = pct + '%'; });
  const prog = $('progress'); prog.innerHTML = '<span id="cu">0</span>/' + L.total + ' quests';
  prog.dataset.interactionKind = 'sheet';
  prog.dataset.source = questSource({});
  prog.onclick = () => openProgressSheet(L);
  countUp($('cu'), L.completed, '');
  const here = $('here');
  here.dataset.interactionKind = 'sheet';
  here.dataset.source = questSource({});
  here.onclick = () => openFrontierSheet(L);
  if (L.current) here.textContent = 'here → ' + L.current.arc + ' · ' + L.current.title;
  else here.textContent = 'frontier clear';
}

/* ── inspect — proof, packet, freshness, and system detail ── */
const N1 = (v) => (Math.round(v * 10) / 10);
const STAGES = ${JSON.stringify(CAMBIUM_VISUAL_STAGES)};
const RAILS = ${JSON.stringify(CAMBIUM_VISUAL_RAILS)};
const WAKE_CONTRACT = ${JSON.stringify(CAMBIUM_WAKE_STEPS)};
const SENSE_CONTRACT = ${JSON.stringify(CAMBIUM_SENSES)};
const LANE_CONTRACT = ${JSON.stringify(CAMBIUM_LANES)};
const hasText = (rows, rx) => rows.some(row => rx.test([row.title, row.evidence, row.id, row.arc].join(' ')));
const rowLabel = row => row.arc + ' · ' + row.title;
const stageTitle = id => (STAGES.find(stage => stage.id === id) || { title:id.toUpperCase() }).title;
function completedRows(L){ return L.rows.filter(row => row.status === 'complete'); }
function activeRow(L){ return L.rows.find(row => row.status === 'active'); }
function stageForArc(arc){
  const stage = STAGES.find(s => s.arcs.includes(String(arc)));
  return stage ? stage.id : 'ops';
}
function stageRows(L, stage){
  return L.rows.filter(row => stage.arcs.includes(String(row.arc)));
}
function minutesSince(iso){
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
}
function wakeSteps(env){
  const L = env.ledger;
  const served = env.wake && Array.isArray(env.wake.steps) ? env.wake.steps : null;
  if (served) {
    return WAKE_CONTRACT.map(step => {
      const row = served.find(s => s && s.id === step.id) || {};
      return {
        ...step,
        done:row.status === 'proved',
        detail:row.detail || row.gap || step.missing,
        proof:row.proof || row.gap || step.missing,
        source:row.source || (env.wake && env.wake.source) || 'missing',
        evidence:Array.isArray(row.evidence) ? row.evidence : [],
        history:row.history || { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] },
      };
    });
  }
  const active = activeRow(L);
  const rows = L.rows || [];
  return WAKE_CONTRACT.map(step => {
    const history = { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] };
    if (step.id === 'ingest') return { ...step, done:!!env.source, detail:env.source || step.missing, proof:env.source ? 'legacy source ' + env.source : step.missing, source:'legacy-local', evidence:[], history };
    if (step.id === 'route') return { ...step, done:!!active || L.completed === L.total, detail:active ? rowLabel(active) : 'all arcs complete', proof:active ? rowLabel(active) : L.completed + '/' + L.total + ' quests complete', source:'legacy-local', evidence:[], history };
    if (step.id === 'act') return { ...step, done:rows.some(row => row.status !== 'locked'), detail:L.completed + '/' + L.total + ' quest rows', proof:rows.filter(row => row.status !== 'locked').length + '/' + L.total + ' active or complete rows', source:'legacy-local', evidence:[], history };
    if (step.id === 'viability') return { ...step, done:hasText(rows, /viability|gate|approval|deposit|deploy|sign.?off|margin/i), detail:hasText(rows, /viability|gate|approval|deposit|deploy|sign.?off|margin/i) ? 'evidence present' : step.missing, proof:step.missing, source:'legacy-local', evidence:[], history };
    if (step.id === 'learn') return { ...step, done:hasText(rows, /memory|cortex|lesson|learn|mint|archive/i), detail:hasText(rows, /memory|cortex|lesson|learn|mint|archive/i) ? 'memory trace' : step.missing, proof:step.missing, source:'legacy-local', evidence:[], history };
    if (step.id === 'persist') return { ...step, done:!!env.derivedAt, detail:env.derivedAt ? 'ledger snapshot' : step.missing, proof:env.derivedAt ? 'derivedAt ' + env.derivedAt : step.missing, source:'legacy-local', evidence:[], history };
    return { ...step, done:false, detail:step.missing, proof:step.missing, source:'legacy-local', evidence:[], history };
  });
}
function renderWake(env){
  return '<div class="wakegrid">' + wakeSteps(env).map((step, i) =>
    '<button type="button" class="wake-step ' + (step.done ? 'done' : 'wait') + '" data-wake="' + i + '"><b>' + esc(step.label) + '</b><span>' + esc(step.detail) + '</span></button>'
  ).join('') + '</div>';
}
function senseEcosystemTarget(id){
  if (id === 'signal') return 'quine';
  if (id === 'memory') return 'cortex';
  if (id === 'risk' || id === 'drift') return 'operator-policy';
  return 'cambium-worker';
}
function senseEmptyDetail(sense){
  return sense.id === 'memory' ? 'no tenant cortex rows served' : sense.empty;
}
function senseCards(env){
  const senseEnv = env.senses || {};
  const served = Array.isArray(senseEnv.rows) ? senseEnv.rows : null;
  if (served) {
    return SENSE_CONTRACT.map(sense => {
      const row = served.find(item => item && item.id === sense.id) || {};
      const evidence = Array.isArray(row.evidence) ? row.evidence : [];
      const empty = senseEmptyDetail(sense);
      return {
        ...sense,
        on:!!row.on,
        detail:row.detail || row.gap || empty,
        proof:row.proof || row.gap || empty,
        source:row.source || senseEnv.source || 'missing',
        target:senseEcosystemTarget(sense.id),
        evidence,
      };
    });
  }
  const L = env.ledger;
  const rows = L.rows || [];
  const active = activeRow(L);
  const cortexRows = rows.filter(row => stageForArc(row.arc) === 'cortex');
  const riskRows = rows.filter(row => row.status === 'locked' || /pending|blocked|missing|unreachable|rejected/i.test(row.evidence || ''));
  const age = minutesSince(env.derivedAt);
  return SENSE_CONTRACT.map(sense => {
    const target = senseEcosystemTarget(sense.id);
    const empty = senseEmptyDetail(sense);
    if (sense.id === 'signal') return { ...sense, on:!!active, detail:active ? rowLabel(active) : empty, source:'legacy-local', target, evidence:[] };
    if (sense.id === 'memory') return { ...sense, on:cortexRows.some(row => row.status !== 'locked'), detail:cortexRows.length ? cortexRows.filter(row => row.status !== 'locked').length + '/' + cortexRows.length + ' cortex rows' : empty, source:'legacy-local', target, evidence:[] };
    if (sense.id === 'risk') return { ...sense, on:riskRows.length > 0, detail:riskRows.length ? riskRows.length + ' locked or pending traces' : empty, source:'legacy-local', target, evidence:[] };
    if (sense.id === 'drift') return { ...sense, on:age === null || age > 360, detail:age === null ? 'freshness missing' : age > 360 ? Math.round(age / 60) + 'h stale' : empty, source:'legacy-local', target, evidence:[] };
    return { ...sense, on:false, detail:empty, source:'legacy-local', target, evidence:[] };
  });
}
function renderSenses(env){
  return '<div class="sensegrid">' + senseCards(env).map(sense =>
    '<button type="button" class="sense ' + (sense.on ? 'on' : '') + '" data-interaction-kind="sheet" data-source="' + esc(sense.source || 'missing') + '" data-sense="' + sense.id + '" data-ecosystem-target="' + esc(sense.target || senseEcosystemTarget(sense.id)) + '"><b>' + esc(sense.title) + '</b>' + esc(sense.detail) + '</button>'
  ).join('') + '</div>';
}
function laneCards(env){
  const laneEnv = env.lanes || {};
  const stance = env.stance || {};
  const counts = laneEnv.counts || {};
  const total = Number(laneEnv.total ?? Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0));
  const sampleSize = Number(stance.sampleSize ?? total ?? 0);
  const ratios = stance.ratios || {};
  return LANE_CONTRACT.map(lane => {
    const n = Number(counts[lane.id] || 0);
    const ratio = n > 0 ? Number(ratios[lane.id] ?? (total ? n / total : 0)) : 0;
    const source = n > 0 ? (laneEnv.source || 'world.log') : 'missing';
    const laneSampleSize = n > 0 ? sampleSize : 0;
    return {
      ...lane,
      on:n > 0,
      detail:n > 0 ? n + ' move' + (n === 1 ? '' : 's') : (laneEnv.gap || lane.empty),
      source,
      count:n,
      ratio,
      sampleSize:laneSampleSize,
      worldLog:n > 0 ? n + ' world.log lane row' + (n === 1 ? '' : 's') : 'missing',
      stanceContribution:n > 0 && stance.status === 'ready'
        ? (Math.round(ratio * 100) + '% of tenant stance sample')
        : 'no stance contribution',
      recommendation:n > 0 ? 'read-only lane evidence; no browser action' : 'no recommendation',
    };
  });
}
function renderLanes(env){
  return '<div class="sensegrid">' + laneCards(env).map(lane =>
    '<button type="button" class="sense ' + (lane.on ? 'on' : '') + '" data-interaction-kind="sheet" data-source="' + esc(lane.source || 'missing') + '" data-lane="' + lane.id + '" data-ecosystem-target="operator-policy"><b>' + esc(lane.title) + '</b>' + esc(lane.detail) + '</button>'
  ).join('') + '</div>';
}
function stanceCard(env){
  const stance = env.stance || {};
  if (stance.status !== 'ready') {
    return {
      state:'wait',
      title:'STANCE GAP',
      detail:stance.gap || 'tenant lane-history rule not served',
    };
  }
  const ratios = stance.ratios || {};
  const ratioText = LANE_CONTRACT.map(lane => lane.title + ' ' + Math.round(Number(ratios[lane.id] || 0) * 100) + '%').join(' · ');
  return {
    state:'ready',
    title:stance.label || 'BALANCED',
    detail:(stance.sampleSize || 0) + '/' + (stance.window || 24) + ' tenant events · ' + ratioText,
  };
}
function renderStance(env){
  const stance = stanceCard(env);
  return '<div class="boxgrid"><button type="button" class="ibox ' + (stance.state === 'ready' ? 'ready' : '') + '" data-stance="1"><b>' + esc(stance.title) + '</b><span>' + esc(stance.detail) + '</span></button></div>';
}
function policyCard(env){
  const policy = env.policy || {};
  const blockers = Array.isArray(policy.blockers) ? policy.blockers : [];
  const cautions = Array.isArray(policy.cautions) ? policy.cautions : [];
  if (policy.status === 'ready' && policy.action) {
    return {
      state:'ready',
      title:policy.title || 'NEXT ACTION',
      detail:String(policy.action) + (policy.detail ? ' · ' + String(policy.detail) : ''),
      blockers,
      cautions,
    };
  }
  return {
    state:'wait',
    title:policy.title || 'POLICY GAP',
    detail:policy.detail || policy.gap || blockers[0] || 'next-action recommendation policy missing',
    blockers,
    cautions,
  };
}
function renderPolicy(env){
  const policy = policyCard(env);
  return '<div class="boxgrid"><button type="button" class="ibox ' + (policy.state === 'ready' ? 'ready' : '') + '" data-policy="1"><b>' + esc(policy.title) + '</b><span>' + esc(policy.detail) + '</span></button></div>';
}
function decisionContextCards(env){
  const ctx = env.decisionContext || {};
  const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
  if (!rows.length) {
    return [{
      title:'DECISION CONTEXT',
      state:'wait',
      detail:ctx.gap || 'advanced priority signals not served',
      proof:'decisionContext.rows missing from visual envelope',
      source:ctx.source || 'missing',
      scope:'tenant-only',
      evidence:[],
    }];
  }
  return rows.slice(0, 6).map(row => ({
    title:String(row.title || row.id || 'decision context').toUpperCase(),
    state:row.state === 'served' ? 'ready' : 'wait',
    detail:row.detail || row.gap || 'decision signal missing',
    proof:row.proof || row.gap || 'proof missing from decision signal row',
    source:row.source || ctx.source || 'missing',
    scope:row.scope || 'tenant-only',
    evidence:Array.isArray(row.evidence) ? row.evidence : [],
  }));
}
function renderDecisionContext(env){
  return '<div class="boxgrid">' + decisionContextCards(env).map((row, i) =>
    '<button type="button" class="ibox decision ' + (row.state === 'ready' ? 'ready' : '') + '" data-decision="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function sideQuestOverclaimText(value){
  return /\\b(reward|bonus|hidden\\s+quest|leaderboard|rank|social[-\\s]proof)\\b/i.test(String(value || ''));
}
function sideQuestSafeText(value, fallback){
  const text = String(value || '');
  const fallbackText = String(fallback || '');
  const safeFallback = sideQuestOverclaimText(fallbackText) ? 'served side quest field omitted' : fallbackText;
  return sideQuestOverclaimText(text) ? safeFallback : (text || safeFallback);
}
function sideQuestSafeAction(action, fallbackTarget){
  const safe = action || {};
  return {
    kind:safe.kind || 'inspect',
    label:sideQuestSafeText(safe.label, 'Inspect evidence'),
    target:sideQuestSafeText(safe.target, fallbackTarget || 'side quest'),
  };
}
function sideQuestSafeRuntime(runtime, fallbackStatus){
  const safe = runtime || {};
  return {
    source:sideQuestSafeText(safe.source, 'missing'),
    status:sideQuestSafeText(safe.status, fallbackStatus || 'triggered'),
    total:Number(safe.total || 0),
    proof:sideQuestSafeText(safe.proof, 'operator side-quest event proof omitted'),
    rows:Array.isArray(safe.rows) ? safe.rows.map(row => ({
      id:sideQuestSafeText(row && row.id, 'event'),
      status:sideQuestSafeText(row && row.status, 'queued'),
      source:sideQuestSafeText(row && row.source, safe.source || 'missing'),
      detail:sideQuestSafeText(row && row.detail, 'operator event detail omitted'),
      proof:sideQuestSafeText(row && row.proof, 'operator event proof omitted'),
    })) : [],
  };
}
function sideQuestCards(env){
  const side = env.sideQuests || {};
  const rows = Array.isArray(side.rows) ? side.rows : [];
  if (!rows.length) {
    return [{
      title:'SIDE QUESTS',
      state:'wait',
      status:'triggered',
      detail:side.gap || 'side quest triggers not served',
      trigger:'sideQuests.empty',
      proof:'no pure trigger rows served',
      owner:'system',
      action:{ label:'Wait for served triggers', kind:'inspect', target:'sideQuests' },
      lifetime:{ detail:'empty until a fresh visual envelope serves side quest rows' },
      completion:{ proof:'a sideQuests.rows entry is served from a pure trigger predicate' },
      runtime:{ source:'missing', status:'triggered', total:0, proof:'no operator side-quest events served', rows:[] },
    }];
  }
  return rows.slice(0, 6).map(row => {
    const runtime = row.runtime || { source:'missing', status:row.status || 'triggered', total:0, proof:'no operator side-quest events served', rows:[] };
    const status = runtime.status || row.status || 'triggered';
    const id = row.id || row.action?.target || row.title || 'side-quest';
    return {
      id:sideQuestSafeText(id, 'side-quest'),
      title:sideQuestSafeText(String(row.title || row.id || 'side quest').toUpperCase(), 'SERVED TRIGGER'),
      state:status === 'expired' ? 'wait' : 'ready',
      status:sideQuestSafeText(status, 'triggered'),
      detail:sideQuestSafeText(row.detail, 'side quest trigger active'),
      trigger:sideQuestSafeText(row.trigger, 'trigger missing'),
      proof:sideQuestSafeText(row.proof, 'proof missing from side quest row'),
      origin:sideQuestSafeText(row.origin || side.source, 'unknown'),
      owner:sideQuestSafeText(row.owner, 'system'),
      action:sideQuestSafeAction(row.action, 'side-quest'),
      lifetime:{ ...(row.lifetime || {}), detail:sideQuestSafeText(row.lifetime && row.lifetime.detail, 'lifetime not served') },
      completion:{ ...(row.completion || {}), proof:sideQuestSafeText(row.completion && row.completion.proof, 'completion proof not served') },
      runtime:sideQuestSafeRuntime(runtime, status),
    };
  });
}
function renderSideQuests(env){
  return '<div class="boxgrid">' + sideQuestCards(env).map((quest, i) =>
    '<button type="button" class="ibox side ' + (quest.state === 'ready' ? 'ready' : '') + '" data-side="' + i + '"' + (quest.state === 'ready' && ['refresh', 'founder-review', 'collect-evidence'].includes(String(quest.action.kind || '')) ? ' data-signed-action-entrypoint="queue-side-quest"' : '') + '><b>' + esc(quest.title) + '</b><span>' + esc(quest.detail) + '</span></button>'
  ).join('') + '</div>';
}
function socialCards(env){
  const social = env.social || {};
  const rows = Array.isArray(social.rows) ? social.rows : [];
  const overclaimText = value => /\\b(leaderboard|social[-\\s]proof|popularity|rank|follower|viral)\\b/i.test(String(value || ''));
  const safeMeta = (value, fallback) => overclaimText(value) ? fallback : (value || fallback);
  const overclaim = row => overclaimText([
    row && row.title,
    row && row.detail,
    row && row.proof,
    ...(Array.isArray(row && row.evidence) ? row.evidence.flatMap(item => item && typeof item === 'object' ? Object.values(item) : []) : []),
  ].filter(Boolean).join(' '));
  const safeEvidence = row => Array.isArray(row && row.evidence)
    ? row.evidence.filter(item => item && typeof item === 'object' && !overclaimText(Object.values(item).filter(Boolean).join(' '))).map(item => ({
      label:safeMeta(item.label, 'row'),
      status:safeMeta(item.status, 'served'),
      detail:safeMeta(item.detail, ''),
    }))
    : [];
  const safeRows = rows.filter(row => !overclaim(row));
  if (!safeRows.length) {
    return [{
      title:'SOCIAL GAP',
      state:'wait',
      detail:rows.length ? 'coordination rows rejected because they were not tenant handoff evidence' : safeMeta(social.gap, 'no tenant-scoped bridge or handoff evidence served'),
      proof:rows.length ? 'tenant handoff evidence must come from explicit bridge, handoff, or founder gate sources' : 'no coordination rows served',
      source:safeMeta(social.source, 'missing'),
      scope:safeMeta(social.scope, 'tenant-handoff-only'),
      evidence:[],
    }];
  }
  return safeRows.slice(0, 5).map(row => ({
    title:String(row.title || row.id || 'coordination').toUpperCase(),
    state:row.state === 'ready' ? 'ready' : 'wait',
    detail:safeMeta(row.detail || row.gap, 'coordination evidence missing'),
    proof:safeMeta(row.proof || row.gap, 'proof missing from coordination row'),
    source:safeMeta(row.source || social.source, 'coordination-evidence@v1'),
    scope:safeMeta(row.scope || social.scope, 'tenant-handoff-only'),
    evidence:safeEvidence(row),
  }));
}
function renderSocial(env){
  return '<div class="boxgrid">' + socialCards(env).map((row, i) =>
    '<button type="button" class="ibox social ' + (row.state === 'ready' ? 'ready' : '') + '" data-social="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function liveProofCards(env){
  const proof = env.liveProof || {};
  const rows = Array.isArray(proof.rows) ? proof.rows : [];
  const invariant = proof.invariant || 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.';
  if (!rows.length) {
    return [{
      title:'LIVE PROOF GAP',
      state:'wait',
      rawState:'gap',
      detail:proof.gap || 'live proof readiness not served',
      proof:'liveProof.rows missing from visual envelope',
      source:proof.source || 'missing',
      writes:'docs/plans/assets/tg-miniapp-live-proof/readiness.json',
      command:'npm run proof:tg-live-readiness',
      prerequisites:[{ label:'readiness.json', status:'blocked', detail:'not served' }],
      privacy:['capture plan is run guidance, not proof'],
      invariant,
    }];
  }
  return rows.slice(0, 3).map(row => {
    const prereqs = Array.isArray(row.prerequisites) ? row.prerequisites : [];
    const rawState = row.state || 'gap';
    const state = rawState === 'complete' || rawState === 'ready' ? 'ready' : rawState === 'ready-to-capture' ? 'capture' : 'wait';
    return {
      title:String(row.title || row.id || 'live proof').toUpperCase(),
      state,
      rawState,
      detail:row.detail || (prereqs.length ? prereqs.filter(item => item.status !== 'ready').length + '/' + prereqs.length + ' prerequisites blocked' : 'capture plan detail missing'),
      proof:row.proof || invariant,
      source:row.source || proof.source || 'missing',
      writes:row.writes || '',
      command:row.command || 'npm run proof:tg-live-readiness',
      prerequisites:prereqs.map((item, i) => ({
        label:item.label || item.id || ('prerequisite ' + (i + 1)),
        status:item.status || item.state || 'blocked',
        detail:item.detail || 'detail missing',
      })),
      privacy:Array.isArray(row.privacy) ? row.privacy : ['redacted receipt required'],
      invariant,
    };
  });
}
function renderLiveProof(env){
  return '<div class="boxgrid">' + liveProofCards(env).map((row, i) =>
    '<button type="button" class="ibox liveproof ' + (row.state === 'ready' ? 'ready' : '') + '" data-live-proof="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function branchEnvelope(env){
  return env.branchStories || {};
}
function branchRows(env){
  const branchEnv = branchEnvelope(env);
  return Array.isArray(branchEnv.rows) ? branchEnv.rows : [];
}
function branchGaps(branch){
  return Array.isArray(branch && branch.gaps) ? branch.gaps : [];
}
function branchGateForMission(branch, mission){
  const gates = Array.isArray(branch && branch.gates) ? branch.gates : [];
  return gates.find(gate => String(gate.gate || '').toLowerCase() === String(mission && mission.gate || '').toLowerCase()) || null;
}
function branchActiveMission(branch){
  const missions = Array.isArray(branch && branch.missions) ? branch.missions : [];
  return missions.find(mission => {
    const gate = branchGateForMission(branch, mission);
    return !gate || gate.status !== 'verified';
  }) || missions[0] || null;
}
function mcList(value){
  return Array.isArray(value) ? value : [];
}
function mcText(value, fallback){
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}
function mcShortLabel(value, fallback){
  const text = mcText(value, fallback).replace(/\s+/g, ' ');
  if (text.length <= 18) return text;
  const words = text.split(' ').filter(Boolean);
  return (words.length >= 2 ? words.slice(0, 2).join(' ') : text.slice(0, 17)).replace(/[.,;:]+$/,'') + '…';
}
function mcBranchId(branch, index){
  return mcText(branch && (branch.branchId || branch.productId || branch.arcId), 'branch-' + (index + 1));
}
function mcMissionState(branch, mission){
  const gate = branchGateForMission(branch, mission);
  const status = mcText((gate && gate.status) || (mission && mission.status), 'pending');
  return mcStateKind(status);
}
function mcOrganSlug(value){
  const text = String(value || '').toLowerCase();
  if (!text) return '';
  if (/genesis|seed|brand|brief|intake/.test(text)) return 'genesis';
  if (/taste|resonance|copy|visual|acceptance|privacy|review/.test(text)) return 'taste';
  if (/build|hands|code|qa|repo|widget|route|claim table|proof table|scaffold/.test(text)) return 'build';
  if (/cortex|memory|lesson|learn|recall/.test(text)) return 'cortex';
  if (/ops|will|hermes|garden|launch|gtm|tenant|publish|rollback|service|outreach|operate/.test(text)) return 'ops';
  return MC_COMPONENT_REGISTRY.MissionGlyph.includes(text) ? text : '';
}
function mcVisualStageFromArc(value){
  const arc = String(value || '').trim();
  if (!/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII)$/.test(arc)) return '';
  return stageForArc(arc);
}
function mcOrganMetaForBranch(branch, mission){
  const routes = mcList(branch && branch.controls && branch.controls.organRouting);
  const route = routes.find(row => !/verified|complete|done/i.test(String((row && (row.currentGate || row.status)) || ''))) || routes[0] || null;
  const routed = route && mcOrganSlug(route.organ || route.owner || route.output || route.currentGate);
  const candidates = [
    routed,
    mcOrganSlug(branch && (branch.organ || branch.visualStage || branch.stage)),
    mcOrganSlug(mission && (mission.owner || mission.gate || mission.dispatchTarget || mission.title)),
    mcVisualStageFromArc(branch && branch.arc),
    mcOrganSlug(branch && (branch.arcTitle || branch.role || branch.productId || branch.branchId)),
  ].filter(Boolean);
  const glyph = candidates.find(kind => MC_COMPONENT_REGISTRY.MissionGlyph.includes(kind)) || 'arc';
  const label = route && route.organ ? route.organ : stageTitle(glyph);
  const source = route ? 'organRouting' : (branch && branch.arc ? 'shared visual arc' : 'mission data');
  return {
    glyph,
    label:mcText(label, stageTitle(glyph)),
    source,
    detail:route ? mcText(route.currentGate || route.proofPath || route.owner, 'organ route pending') : mcText(branch && (branch.arcTitle || branch.role), 'branch organ inferred'),
  };
}
function mcGlyphForQuestStage(stage, index, total){
  const text = [stage && stage.glyph, stage && stage.organ, stage && stage.title, stage && stage.id, stage && stage.status].filter(Boolean).join(' ');
  if (/proof|receipt|evidence/i.test(text)) return 'proof';
  if (/gate|approval|review/i.test(text)) return 'gate';
  const organ = mcOrganSlug(text);
  if (organ) return organ;
  if (index === 0) return 'genesis';
  if (index === total - 1) return 'ops';
  return 'build';
}
function mcKpiState(row){
  const text = [row && row.currentState, row && row.survival, row && row.betterThanSurvival].filter(Boolean).join(' ');
  if (/blocked|missing|not proven|no signal|gap/i.test(text)) return 'proof-needed';
  return mcStateKind(text || 'active');
}
function mcKpiProgress(row){
  const state = mcKpiState(row);
  if (state === 'complete') return 100;
  if (state === 'blocked') return 28;
  if (state === 'proof-needed' || state === 'stale') return 42;
  return 64;
}
function mcUniqueRows(rows){
  const seen = {};
  return rows.filter(row => {
    const key = [row.label, row.source, row.detail].map(item => String(item || '')).join('|');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
function mcQuestline(branch){
  const served = mcList(branch && branch.questline);
  if (served.length) return served.map((stage, index) => ({
    id:mcText(stage && stage.id, 'stage-' + (index + 1)),
    title:mcText(stage && stage.title, 'Stage ' + (index + 1)),
    status:mcText(stage && stage.status, 'pending'),
    state:mcStateKind(stage && stage.status),
  }));
  const missions = mcList(branch && branch.missions);
  if (missions.length) return missions.map((mission, index) => ({
    id:mcText(mission && mission.missionId, 'mission-' + (index + 1)),
    title:mcText(mission && mission.title, 'Mission ' + (index + 1)),
    status:mcText((branchGateForMission(branch, mission) || {}).status, 'pending'),
    state:mcMissionState(branch, mission),
  }));
  const gates = mcList(branch && branch.gates);
  if (gates.length) return gates.map((gate, index) => ({
    id:mcText(gate && gate.gate, 'gate-' + (index + 1)),
    title:mcText(gate && gate.gate, 'Gate ' + (index + 1)),
    status:mcText(gate && gate.status, 'pending'),
    state:mcStateKind(gate && gate.status),
  }));
  return [{ id:'mission-gap', title:'Mission queue missing', status:'blocked', state:'blocked' }];
}
function mcBlockers(env, branch){
  const rows = [];
  mcList(branch && branch.gaps).forEach((gap, index) => {
    if (mcStateKind(gap && gap.status) !== 'complete') rows.push({
      id:mcText(gap && gap.id, 'gap-' + (index + 1)),
      label:mcText(gap && gap.detail, 'Branch gap'),
      state:mcStateKind(gap && gap.status),
      source:mcText(gap && gap.source, 'branchStories.gaps'),
    });
  });
  mcList(branch && branch.gates).forEach((gate, index) => {
    if (mcStateKind(gate && gate.status) !== 'complete') rows.push({
      id:'gate-' + (index + 1),
      label:mcText(gate && gate.gate, 'Gate') + ' · ' + mcText(gate && gate.requiredProof, 'required proof missing'),
      state:mcStateKind(gate && gate.status),
      source:'branchStories.gates',
    });
  });
  const approvals = branch && branch.controls ? mcList(branch.controls.approvals) : [];
  approvals.forEach((approval, index) => {
    if (mcStateKind(approval && approval.status) !== 'complete') rows.push({
      id:'approval-' + (index + 1),
      label:mcText((approval && (approval.requiredApproval || approval.failureMode || approval.permission)), 'Founder approval missing'),
      state:mcStateKind(approval && approval.status),
      source:'branch.controls.approvals',
    });
  });
  const policy = policyCard(env);
  if (policy.state !== 'ready') rows.push({
    id:'policy',
    label:policy.detail,
    state:'blocked',
    source:'policy',
  });
  liveProofCards(env).filter(row => row.state !== 'ready').forEach((row, index) => rows.push({
    id:'live-proof-' + (index + 1),
    label:row.title + ' · ' + row.detail,
    state:row.state === 'capture' ? 'proof-needed' : 'blocked',
    source:row.source || 'liveProof',
  }));
  return mcUniqueRows(rows);
}
function mcProofNeeded(branch, mission){
  const gate = branchGateForMission(branch, mission);
  const rows = [];
  const add = (label, source, detail) => {
    const safe = mcText(label, '');
    if (safe) rows.push({ label:safe, source, detail:mcText(detail, safe), state:'proof-needed' });
  };
  add(mission && mission.proofRequired, 'branchStories.missions', mission && mission.title);
  add(gate && gate.requiredProof, 'branchStories.gates', gate && gate.gate);
  mcList(branch && branch.proofPaths).forEach(proof => add(proof && proof.validates, 'branchStories.proofPaths', (proof && (proof.proofId || proof.promotes))));
  return mcUniqueRows(rows.length ? rows : [{ label:'proof requirement missing', source:'branchStories', detail:'mission proof requirement missing', state:'blocked' }]);
}
function mcKpis(branch){
  return mcList(branch && branch.kpis).map((kpi, index) => ({
    id:mcText(kpi && kpi.kpiId, 'kpi-' + (index + 1)),
    label:mcText(kpi && kpi.label, 'KPI ' + (index + 1)),
    currentState:mcText(kpi && kpi.currentState, 'not proven'),
    survival:mcText(kpi && kpi.survival, 'survival threshold missing'),
    betterThanSurvival:mcText(kpi && kpi.betterThanSurvival, 'better-than-survival threshold missing'),
    source:mcText(kpi && kpi.source, 'branchStories.kpis'),
  }));
}
function mcControls(branch){
  const controls = branch && branch.controls ? branch.controls : {};
  return {
    ui:controls.ui || {},
    approvals:mcList(controls.approvals),
    dispatchHints:mcList(controls.dispatchHints),
    policySignals:mcList(controls.policySignals),
    organRouting:mcList(controls.organRouting),
    variableContractPayloads:mcList(controls.variableContractPayloads),
    adapterServiceMap:mcList(controls.adapterServiceMap),
    evidenceLedger:mcList(controls.evidenceLedger),
    autonomyBoundary:mcText(controls.autonomyBoundary, 'proof must fold back before autonomy claims'),
  };
}
function buildMissionControlView(env){
  const branchEnv = branchEnvelope(env || {});
  const rows = branchRows(env || {});
  const requested = mcText(PARAMS.get('branch'), '');
  const selectedIndex = Math.max(0, rows.findIndex((branch, index) => requested && mcBranchId(branch, index) === requested));
  const branch = rows[selectedIndex] || rows[0] || null;
  const mission = branchActiveMission(branch);
  const promotion = branch && branch.promotion ? branch.promotion : {};
  const controls = mcControls(branch);
  const source = branch && branch.source ? branch.source : {};
  const nextMission = mission ? {
    id:mcText(mission.missionId, 'mission'),
    title:mcText(mission.title, 'Mission title missing'),
    owner:mcText(mission.owner, 'owner missing'),
    gate:mcText(mission.gate, 'gate missing'),
    proofRequired:mcText(mission.proofRequired, 'proof requirement missing'),
    dispatchTarget:mcText(mission.dispatchTarget, 'dispatch target missing'),
    state:mcMissionState(branch, mission),
  } : {
    id:'mission-gap',
    title:'Mission queue missing',
    owner:'operator',
    gate:'branch packet',
    proofRequired:'mission proof requirement missing',
    dispatchTarget:'inspect',
    state:'blocked',
  };
  return {
    source:mcText(branchEnv.source, 'product-branch-packets@v1'),
    selectedBranchId:branch ? mcBranchId(branch, selectedIndex) : requested,
    selectedBranch:branch,
    branches:rows.slice(0, 12).map((row, index) => {
      const active = branchActiveMission(row);
      return {
        id:mcBranchId(row, index),
        name:mcText(row && (row.name || row.productId), 'Product Branch'),
        arcTitle:mcText(row && row.arcTitle, 'branch arc'),
        state:branchCardState(row),
        organ:mcOrganMetaForBranch(row, active),
        nextMission:active ? mcText(active.title, 'Mission title missing') : 'mission queue missing',
        selected:row === branch,
      };
    }),
    vision:mcText(branch && branch.vision && branch.vision.statement, 'vision statement missing'),
    icp:mcText(branch && branch.icp && branch.icp.primary, 'ICP missing'),
    nextMission,
    questline:branch ? mcQuestline(branch) : [{ id:'branch-gap', title:'Branch packet missing', status:'blocked', state:'blocked' }],
    blockers:mcBlockers(env || {}, branch),
    proofNeeded:mcProofNeeded(branch, mission),
    kpis:mcKpis(branch),
    promotion:{
      state:mcText(promotion.state, 'proof-only'),
      currentGate:mcText(promotion.currentGate, nextMission.gate || 'proof gate missing'),
      rule:mcText(promotion.rule, 'proof first; no promotion without foldback evidence'),
    },
    activeOrgan:mcOrganMetaForBranch(branch, mission),
    controls,
    inspect:{
      source:mcText(branchEnv.source, 'product-branch-packets@v1'),
      packetFile:mcText(source.packetFile, 'source packet missing'),
      indexFile:mcText(source.indexFile, 'source index missing'),
      schema:mcText(source.schema, 'cambium.product_branch_packet.v1'),
      tenant:mcText(source.tenant, TENANT),
      derivedAt:mcText(env && env.derivedAt, 'derivedAt missing'),
    },
  };
}
function renderBranchArcRail(view){
  if (!view.branches.length) return '';
  return '<div class="mc-branch-rail">' + view.branches.map((branch, index) =>
    '<button type="button" class="' + mcClass('mc-branch-chip', branch.state, branch.selected ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-selected-surface="' + (branch.selected ? 'branch-chip' : 'none') + '" data-mission-branch="' + index + '" data-organ-route="' + esc(branch.organ.glyph) + '" data-interaction-kind="sheet" data-source="' + esc(view.source) + '"' + (branch.selected && !RM ? ' data-motion="orbitSweep" data-motion-primitive="orbitSweep"' : '') + '>' +
      mcGlyphSvg(branch.organ.glyph, branch.state, { motion: branch.selected ? 'glyphBreathe' : '' }) +
      '<span class="mc-branch-copy"><b>' + esc(branch.name) + '</b><small>' + esc(branch.organ.label + ' organ · ' + branch.nextMission) + '</small></span>' + mcStateToken(branch.state, branch.state) +
    '</button>'
  ).join('') + '</div>';
}
function renderMissionCard(view){
  const mission = view.nextMission;
  const progress = view.questline.length ? Math.round(100 * view.questline.filter(row => row.state === 'complete').length / view.questline.length) : 0;
  return '<section class="' + mcClass('mc-mission-card', mission.state) + '" data-component="MissionCard" data-interaction-kind="sheet" data-source="' + esc(view.source) + '">' +
    '<div class="mc-card-head"><div>' + mcStateToken(mission.state, 'Next Mission') + '<h3>' + esc(mission.title) + '</h3></div>' + mcOrbitProgress({ value:progress, state:mission.state, label:progress + '%' }) + '</div>' +
    '<p>' + esc(view.vision) + '</p>' +
    '<div class="mc-card-meta"><span><b>Owner</b>' + esc(mission.owner) + '</span><span><b>Gate</b>' + esc(mission.gate) + '</span><span><b>Dispatch</b>' + esc(mission.dispatchTarget) + '</span><span><b>Promotion</b>' + esc(view.promotion.state) + '</span></div>' +
    '<div class="mc-branch-texture" data-component="MissionOrganSignal" data-organ-route="' + esc(view.activeOrgan.glyph) + '">' +
      '<span>' + mcGlyphSvg(view.activeOrgan.glyph, mission.state) + '<span><b>Active organ</b><small>' + esc(view.activeOrgan.label + ' · ' + view.activeOrgan.detail) + '</small></span></span>' +
      mcPacketDots(Math.max(3, view.questline.length), mission.state, { mode:'texture' }) +
    '</div>' +
    mcSignalRail({ state:mission.state, packetCount:Math.max(3, view.questline.length) }) +
  '</section>';
}
function renderQuestlineTimeline(view){
  return '<div data-component="QuestlineTimeline"><div class="mc-section-title">Questline</div><div class="mc-questline">' + view.questline.map((stage, index) =>
    '<div class="mc-questline-row"><span>' + mcGlyphSvg(mcGlyphForQuestStage(stage, index, view.questline.length), stage.state) + '</span><b title="' + esc(stage.title) + '">' + esc(mcShortLabel(stage.title, 'Stage')) + '</b>' + mcStateToken(stage.state, stage.status) + '</div>'
  ).join('') + '</div></div>';
}
function renderMissionStateStack(view){
  const selected = view.selectedBranch ? view.selectedBranch.name || view.selectedBranchId || 'Selected branch' : 'Selected branch';
  const blocker = view.blockers[0] || { label:'No blockers served for this branch packet', state:'idle', source:view.source };
  const proof = view.proofNeeded[0] || { label:'Proof requirement missing', state:'proof-needed', detail:view.nextMission.proofRequired };
  const locked = view.questline.find(row => mcStateKind(row.state || row.status) === 'locked') || view.questline[view.questline.length - 1] || { title:'Launch lock', status:'locked', state:'locked' };
  const rows = [
    { glyph:'cortex', state:'selected', title:'Selected', detail:selected + ' · current focus', token:'selected' },
    { glyph:'gate', state:blocker.state || 'blocked', title:'Blocked by', detail:blocker.label || 'blocker detail missing', token:mcStateKind(blocker.state || 'blocked') },
    { glyph:'proof', state:proof.state || 'proof-needed', title:'Proof needed', detail:proof.label || proof.detail || 'evidence missing', token:'receipt' },
    { glyph:'ops', state:locked.state || locked.status || 'locked', title:'Locked', detail:(locked.title || 'next stage') + ' · waiting unlock', token:mcStateKind(locked.state || locked.status || 'locked') },
  ];
  return '<div data-component="MissionStateStack"><div class="mc-section-title">State Stack</div><div class="mc-state-stack">' + rows.map(row =>
    '<div class="' + mcClass('mc-state-row', row.state, row.state === 'selected' ? 'is-selected mc-selected-halo' : '') + '" data-selected-surface="' + (row.state === 'selected' ? 'mission-state-row' : 'none') + '">' +
      mcGlyphSvg(row.glyph, row.state) +
      '<span><b>' + esc(row.title) + '</b><small>' + esc(row.detail) + '</small></span>' +
      mcStateToken(row.state, row.token) +
    '</div>'
  ).join('') + '</div></div>';
}
function renderMissionBlockers(view){
  const rows = view.blockers.length ? view.blockers.slice(0, 5) : [{ label:'No blockers served for this branch packet', state:'idle', source:view.source }];
  return '<div><div class="mc-section-title">Blocked by</div><div class="mc-blockers">' + rows.map(row =>
    '<div class="' + mcClass('mc-blocker-row', row.state) + '"><b>' + esc(row.state || 'state') + '</b>' + esc(row.label || 'blocker detail missing') + '</div>'
  ).join('') + '</div></div>';
}
function renderMissionProofNeeded(view){
  return '<div data-component="ProofList"><div class="mc-section-title">Proof needed</div><div class="mc-proof-list">' + view.proofNeeded.slice(0, 5).map(row =>
    '<span class="' + mcClass('mc-proof-row', row.state) + '" data-mission-proof-row="1" data-interaction-kind="sheet">' + mcGlyphSvg('proof', row.state) + '<span><b>' + esc(row.label) + '</b>' + esc(row.detail || row.source || 'proof detail missing') + '</span><i aria-hidden="true">›</i></span>'
  ).join('') + '</div></div>';
}
function renderMissionKpis(view){
  const rows = view.kpis.length ? view.kpis.slice(0, 4) : [{ label:'KPI missing', currentState:'not proven', survival:'survival threshold missing' }];
  return '<div data-component="KpiPulse"><div class="mc-section-title">KPIs</div><div class="mc-kpis">' + rows.map((row, index) => mcKpiPulse(row, index)).join('') + '</div></div>';
}
function renderMissionActions(view){
  return '<div class="mc-action-row" data-component="GateActionRow">' +
    '<button type="button" data-no-scene-drag="1" data-mission-action="gate" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="product-branches" aria-label="Review current branch gate">Review Gate</button>' +
    '<button type="button" class="secondary" data-no-scene-drag="1" data-mission-action="proof" data-interaction-kind="sheet" data-source="' + esc(view.source) + '" data-ecosystem-target="product-branches" aria-label="Open current branch proof">Open Proof</button>' +
  '</div>';
}
function renderMissionToolLink(view){
  return '<section class="mission-tool-link" data-component="MissionToolLink" data-source="' + esc(view.source) + '">' +
    '<span><b>Suggested tool</b><small>/ts-status checks the branch before you assign or report the next mission step.</small></span>' +
    '<button type="button" data-mission-action="tools" data-no-scene-drag="1">Open Tools</button>' +
  '</section>';
}
function renderMissionControl(env){
  const stem = $('stem');
  const view = buildMissionControlView(env);
  stem.classList.add('mission-control');
  if (!view.selectedBranch) {
    stem.innerHTML = '<div class="mission-empty"><b>Mission control is waiting for branch packets.</b><p>No fake progress: branch arcs appear only after product packets reach the visual envelope.</p><div class="mc-action-row" data-component="GateActionRow"><button type="button" data-mission-action="refresh">Refresh</button><button type="button" class="secondary" data-mission-action="inspect">Inspect</button></div></div>';
    resetQuestSummary('branch packets waiting', 'inspect source');
    stem.querySelectorAll('[data-mission-action="refresh"]').forEach(el => el.onclick = () => refresh());
    stem.querySelectorAll('[data-mission-action="inspect"]').forEach(el => el.onclick = () => go(4));
    $('fill').style.width = '0%';
    return;
  }
  stem.innerHTML = [
    renderBranchArcRail(view),
    renderMissionCard(view),
    renderQuestlineTimeline(view),
    renderMissionStateStack(view),
    renderMissionProofNeeded(view),
    renderMissionToolLink(view),
    renderMissionActions(view),
    renderMissionKpis(view),
  ].join('');
  const branchIndex = Math.max(0, branchRows(env).findIndex(branch => branch === view.selectedBranch));
  const pct = view.questline.length ? Math.round(100 * view.questline.filter(row => row.state === 'complete').length / view.questline.length) : 0;
  $('fill').style.width = pct + '%';
  const prog = $('progress');
  prog.textContent = view.branches.length + ' branch arc' + (view.branches.length === 1 ? '' : 's');
  prog.dataset.interactionKind = 'sheet';
  prog.dataset.source = view.source;
  prog.onclick = () => openBranchMissionSheet(env, branchIndex, -1);
  const here = $('here');
  here.textContent = 'next: ' + view.nextMission.title;
  here.dataset.interactionKind = 'sheet';
  here.dataset.source = view.source;
  here.onclick = () => openBranchMissionSheet(env, branchIndex, 0);
  stem.querySelectorAll('[data-mission-branch]').forEach(el => el.onclick = () => openBranchMissionSheet(env, +el.dataset.missionBranch, -1));
  stem.querySelectorAll('.mc-mission-card').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0));
  stem.querySelectorAll('[data-mission-action="gate"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'gate'));
  stem.querySelectorAll('[data-mission-action="proof"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));
  stem.querySelectorAll('[data-mission-proof-row]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));
  stem.querySelectorAll('[data-mission-action="tools"]').forEach(el => el.onclick = () => { go(2); renderCommands(); });
}
function branchCardState(branch){
  const gaps = branchGaps(branch);
  if (gaps.some(gap => gap.status === 'blocked')) return 'blocked';
  if (gaps.length) return 'proof-needed';
  const gates = mcList(branch && branch.gates);
  if (gates.some(gate => mcStateKind(gate && gate.status) !== 'complete')) return 'proof-needed';
  const promotion = mcText(branch && branch.promotion && branch.promotion.state, '');
  if (/proof-only|organ-service/i.test(promotion)) return 'proof-needed';
  return 'active';
}
function branchCards(env){
  const branchEnv = branchEnvelope(env);
  const rows = branchRows(env);
  if (!rows.length) return [{
    title:'BRANCH GAP',
    state:'wait',
    detail:branchEnv.gap || 'product branch packets missing or empty',
    proof:'branchStories.rows missing from visual envelope',
    source:branchEnv.source || 'missing',
    branch:null,
  }];
  return rows.slice(0, 6).map(branch => {
    const mission = branchActiveMission(branch);
    const gaps = branchGaps(branch);
    const blocked = gaps.filter(gap => gap.status === 'blocked').length;
    const current = branch.controls && branch.controls.ui ? branch.controls.ui.currentFrontier : '';
    return {
      title:branch.name || branch.productId || branch.branchId || 'Product Branch',
      state:branchCardState(branch),
      detail:(branch.arcTitle || branch.role || 'branch arc') + (mission ? ' · next move ' + mission.title : '') + (blocked ? ' · ' + blocked + ' blocked gate(s)' : ''),
      proof:gaps.length ? gaps.slice(0, 3).map(gap => gap.detail).join(' · ') : 'branch packet has no reported gaps',
      source:(branch.source && branch.source.packetFile) || branchEnv.source || 'product-branch-packets@v1',
      frontier:current || (branch.promotion && branch.promotion.currentGate) || 'frontier not served',
      branch,
    };
  });
}
function renderBranchArcCard(branch, index){
  const state = branchCardState(branch);
  const mission = branchActiveMission(branch);
  const detail = (branch.arcTitle || branch.role || 'branch arc') + (mission ? ' · ' + mission.title : '');
  return '<button type="button" class="ibox branch ' + (state === 'ready' ? 'ready' : '') + '" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + index + '" data-ecosystem-target="product-branches"><b>' + esc(branch.name || branch.branchId || 'Branch') + '</b><span>' + esc(detail) + '</span></button>';
}
function renderBranchMissionCard(mission, branch, branchIndex, missionIndex){
  const gate = branchGateForMission(branch, mission);
  const status = (gate && gate.status) || 'no-signal';
  const ready = status === 'verified';
  const proof = mission.proofRequired || (gate && gate.requiredProof) || 'proof requirement missing';
  return '<button type="button" class="ibox branch-mission ' + (ready ? 'ready' : '') + '" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-mission="' + missionIndex + '" data-ecosystem-target="product-branches"><b>' + esc(mission.title || mission.missionId || 'Mission') + '</b><span>' + esc(status + ' gate · ' + proof) + '</span></button>';
}
function renderBranches(env){
  const cards = branchCards(env);
  return '<div class="boxgrid">' + cards.map((card, i) => card.branch
    ? renderBranchArcCard(card.branch, i)
    : '<button type="button" class="ibox branch" data-interaction-kind="sheet" data-source="' + esc(card.source || 'missing') + '" data-branch-gap="1" data-ecosystem-target="product-branches"><b>' + esc(card.title) + '</b><span>' + esc(card.detail) + '</span></button>'
  ).join('') + '</div>';
}
function renderBranchMissions(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.missions) ? branch.missions : []).slice(0, 3).map((mission, missionIndex) => renderBranchMissionCard(mission, branch, branchIndex, missionIndex)));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch"><b>MISSION GAP</b><span>branch mission queue missing</span></button>') + '</div>';
}
function renderBranchKpis(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.kpis) ? branch.kpis : []).slice(0, 2).map((kpi, kpiIndex) =>
    '<button type="button" class="ibox branch-kpi" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-kpi="' + kpiIndex + '" data-ecosystem-target="product-branches"><b>' + esc(kpi.label || kpi.kpiId || 'KPI') + '</b><span>' + esc((kpi.currentState || 'state missing') + ' · survival ' + (kpi.survival || 'missing')) + '</span></button>'
  ));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch"><b>KPI GAP</b><span>branch KPI controls missing</span></button>') + '</div>';
}
function renderBranchGates(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.gates) ? branch.gates : []).slice(0, 3).map((gate, gateIndex) =>
    '<button type="button" class="ibox branch-gate ' + (gate.status === 'verified' ? 'ready' : '') + '" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-gate="' + gateIndex + '" data-ecosystem-target="product-branches"><b>' + esc(gate.gate || 'Gate') + '</b><span>' + esc((gate.status || 'no-signal') + ' · ' + (gate.requiredProof || 'required proof missing')) + '</span></button>'
  ));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch"><b>GATE GAP</b><span>branch gate ledger missing</span></button>') + '</div>';
}
function renderBranchProof(env){
  const rows = branchRows(env);
  if (!rows.length) return renderBranches(env);
  const cards = rows.flatMap((branch, branchIndex) => (Array.isArray(branch.proofPaths) ? branch.proofPaths : []).slice(0, 3).map((proof, proofIndex) =>
    '<button type="button" class="ibox branch-proof" data-interaction-kind="sheet" data-source="product-branch-packets@v1" data-branch="' + branchIndex + '" data-branch-proof="' + proofIndex + '" data-ecosystem-target="product-branches"><b>' + esc(proof.proofId || 'Proof') + '</b><span>' + esc((proof.validates || 'validation missing') + ' · ' + (proof.promotes || 'promotion rule missing')) + '</span></button>'
  ));
  return '<div class="boxgrid">' + (cards.length ? cards.join('') : '<button type="button" class="ibox branch"><b>PROOF GAP</b><span>branch proof foldback missing</span></button>') + '</div>';
}
function branchMissionFocusLabel(focus){
  if (focus === 'gate') return 'branch gate';
  if (focus === 'proof') return 'branch proof';
  return 'branch mission';
}
function branchMissionFocusNarrative(branch, mission, gate, controls, focus){
  if (focus === 'gate') {
    return 'Review the active gate before this branch can advance: ' + (gate ? ((gate.gate || 'gate') + ' · ' + (gate.status || 'pending') + ' · ' + (gate.requiredProof || 'proof required')) : ((mission && mission.gate) || 'gate missing'));
  }
  if (focus === 'proof') {
    return 'Open the proof requirement for the next branch mission: ' + ((mission && mission.proofRequired) || (gate && gate.requiredProof) || 'proof requirement missing');
  }
  return controls.currentFrontier || (branch.vision && branch.vision.statement) || branch.arcTitle || 'branch frontier missing';
}
function branchSheetGlance(label, value){
  return '<span><b>' + esc(label) + '</b>' + esc(value || 'missing') + '</span>';
}
function branchSheetSection(title, body, fallback){
  const safeBody = body || (fallback ? '<div class="nar">' + esc(fallback) + '</div>' : '');
  return '<section class="branch-sheet-section"><h3>' + esc(title) + '</h3>' + safeBody + '</section>';
}
function branchSheetRow(title, detail, state, source){
  return '<div class="' + mcClass('branch-row', state) + '">' +
    mcStateToken(state, mcStateKind(state)) +
    '<div><b>' + esc(title || 'Item') + '</b><span>' + esc(detail || 'detail missing') + '</span>' +
    (source ? '<small>' + esc(source) + '</small>' : '') + '</div></div>';
}
function branchSheetTimeline(branch){
  const stages = mcQuestline(branch).slice(0, 6);
  return '<div class="branch-sheet-timeline" data-component="QuestlineTimeline">' + stages.map((stage, index) =>
    '<div class="' + mcClass('branch-stage', stage.state) + '">' +
      mcGlyphSvg(mcGlyphForQuestStage(stage, index, stages.length), stage.state) +
      '<div><b>' + esc(stage.title) + '</b><small>' + esc(stage.id || ('stage-' + (index + 1))) + '</small></div>' +
      mcStateToken(stage.state, stage.status) +
    '</div>'
  ).join('') + '</div>';
}
function branchSheetKpis(kpis){
  if (!kpis.length) return '';
  return '<div class="branch-kpi-grid" data-component="KpiPulse">' + kpis.slice(0, 4).map((kpi, i) =>
    '<div class="branch-kpi" data-component="KpiPulse" data-kpi-kind="' + (i === 0 ? 'survival' : 'better-than-survival') + '" data-state="' + esc(mcStateKind(mcKpiState(kpi))) + '">' +
      mcOrbitProgress({ value:mcKpiProgress(kpi), state:mcKpiState(kpi), label:'KPI ' + (i + 1) }) +
      '<span><b>KPI ' + (i + 1) + ' · ' + esc(kpi.label || kpi.kpiId || 'KPI') + '</b>' +
      '<span>' + esc((kpi.currentState || 'state missing') + ' · survival: ' + (kpi.survival || 'missing') + (kpi.betterThanSurvival ? ' · better: ' + kpi.betterThanSurvival : '')) + '</span>' + mcKpiBars(mcKpiProgress(kpi), mcKpiState(kpi)) + '</span>' +
    '</div>'
  ).join('') + '</div>';
}
function branchSheetProofList(branch, mission, proofPaths){
  const proofNeeded = mcProofNeeded(branch, mission).slice(0, 4).map((row, i) =>
    branchSheetRow('Proof ' + (i + 1) + ' · ' + row.label, row.detail, row.state, row.source)
  );
  const proofPathRows = proofPaths.slice(0, 4).map((proof, i) =>
    branchSheetRow('Proof path ' + (i + 1) + ' · ' + (proof.proofId || 'proof'), 'validates ' + (proof.validates || 'missing') + ' · promotes ' + (proof.promotes || 'missing'), 'proof-needed', 'branchStories.proofPaths')
  );
  return '<div class="branch-row-list" data-component="ProofList">' + proofNeeded.concat(proofPathRows).join('') + '</div>';
}
function branchSheetApprovalList(approvals){
  if (!approvals.length) return '';
  return '<div class="branch-row-list">' + approvals.slice(0, 5).map((approval, i) =>
    branchSheetRow('Permission ' + (i + 1) + ' · ' + (approval.permission || 'permission'), (approval.status || 'pending') + ' · ' + (approval.requiredApproval || approval.failureMode || 'approval proof missing'), approval.status || 'proof-needed', 'branch.controls.approvals')
  ).join('') + '</div>';
}
function branchSheetGapList(gaps){
  if (!gaps.length) return '';
  return '<div class="branch-row-list">' + gaps.slice(0, 6).map((gap, i) =>
    branchSheetRow('Gap ' + (i + 1) + ' · ' + (gap.status || 'pending'), gap.detail || 'gap detail missing', gap.status || 'blocked', gap.source || 'branchStories.gaps')
  ).join('') + '</div>';
}
function branchSheetInspect(branch, branchEnv){
  const source = branch && branch.source ? branch.source : {};
  return '<div class="branch-inspect" data-component="Inspect">' +
    '<b>Branch source</b><span>' + esc(source.packetFile || 'source packet missing') + '</span>' +
    '<b>Index</b><span>' + esc(source.indexFile || 'source index missing') + '</span>' +
    '<b>Schema</b><span>' + esc(source.schema || 'cambium.product_branch_packet.v1') + '</span>' +
    '<b>Envelope</b><span>' + esc((branchEnv && branchEnv.source) || 'product-branch-packets@v1') + '</span>' +
  '</div>';
}
function openBranchMissionSheet(env, branchIndex, missionIndex, focus){
  const branch = branchRows(env)[branchIndex] || branchRows(env)[0];
  if (!branch) {
    const branchEnv = branchEnvelope(env);
    $('sheetBody').innerHTML = '<div class="branch-sheet"><section class="branch-sheet-hero">' +
      '<div class="branch-sheet-head">' + mcGlyphSvg('gate', 'blocked') + '<div><div class="arc">branch gap · missing</div><h2>Branch Gap</h2></div>' + mcStateToken('blocked', 'Missing') + '</div>' +
      '<div class="nar">' + esc(branchEnv.gap || 'product branch packets missing or empty') + '</div>' +
      '<div class="branch-claim-guard">' + mcStateToken('blocked', 'Guard') + '<span><b>Proof rule</b>missing branch data cannot render ready work</span></div>' +
      '</section>' + branchSheetInspect({}, branchEnv) + '</div>';
    veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light'); return;
  }
  const branchEnv = branchEnvelope(env);
  const mission = missionIndex >= 0 && Array.isArray(branch.missions) ? branch.missions[missionIndex] : branchActiveMission(branch);
  const gate = mission ? branchGateForMission(branch, mission) : null;
  const gaps = branchGaps(branch);
  const kpis = Array.isArray(branch.kpis) ? branch.kpis : [];
  const proofPaths = Array.isArray(branch.proofPaths) ? branch.proofPaths : [];
  const approvals = branch.controls && Array.isArray(branch.controls.approvals) ? branch.controls.approvals : [];
  const controls = branch.controls && branch.controls.ui ? branch.controls.ui : {};
  const focusLabel = branchMissionFocusLabel(focus);
  const missionState = mcMissionState(branch, mission);
  const gateState = gate ? mcStateKind(gate.status) : missionState;
  const focusState = focus === 'gate' ? gateState : focus === 'proof' ? 'proof-needed' : missionState;
  const guardCopy = controls.blockedCopy || 'no unsupported launch, approval, or autonomy claim from this sheet';
  $('sheetBody').innerHTML = '<div class="branch-sheet" data-component="BranchMissionSheet">' +
    '<section class="branch-sheet-hero" data-component="MissionCard">' +
      '<div class="branch-sheet-head mc-selected-halo" data-component="SelectedHalo" data-selected-surface="detail-sheet">' + mcGlyphSvg(focus === 'gate' ? 'build' : focus === 'proof' ? 'proof' : 'arc', focusState) +
        '<div><div class="arc">' + esc(focusLabel) + ' · ' + esc(branch.branchId || branch.productId || 'branch') + '</div><h2>' + esc(branch.name || branch.productId || 'Product Branch') + '</h2></div>' +
        mcStateToken(focusState, focus === 'gate' ? 'Review gate' : focus === 'proof' ? 'Proof needed' : 'Selected') + '</div>' +
      '<div class="nar">' + esc(branchMissionFocusNarrative(branch, mission, gate, controls, focus)) + '</div>' +
      '<div class="branch-sheet-glance">' +
        branchSheetGlance('Arc', branch.arcTitle || branch.arcId || 'arc missing') +
        branchSheetGlance('Mission', mission ? ((mission.missionId || 'mission') + ' · ' + (mission.title || 'mission title missing')) : 'mission queue missing') +
        branchSheetGlance('Gate', gate ? ((gate.gate || 'gate') + ' · ' + (gate.status || 'pending')) : ((mission && mission.gate) || 'gate missing')) +
        branchSheetGlance('Dispatch', (mission && mission.dispatchTarget) || 'dispatch target missing') +
        branchSheetGlance('Promotion', (branch.promotion && branch.promotion.state) || 'promotion state missing') +
        branchSheetGlance('Proof required', (mission && mission.proofRequired) || (gate && gate.requiredProof) || 'proof requirement missing') +
      '</div>' +
      '<div class="branch-claim-guard">' + mcStateToken('blocked', 'Claim guard') + '<span><b>Claim guard</b>' + esc(guardCopy) + '</span></div>' +
    '</section>' +
    branchSheetSection('Questline', branchSheetTimeline(branch)) +
    branchSheetSection('Proof needed', branchSheetProofList(branch, mission, proofPaths)) +
    branchSheetSection('KPI pulse', branchSheetKpis(kpis), 'No KPI controls served for this packet yet.') +
    branchSheetSection('Permissions', branchSheetApprovalList(approvals), 'No extra founder permission rows served for this branch.') +
    branchSheetSection('Gaps', branchSheetGapList(gaps), 'No branch packet gaps served; proof still has to fold back through the listed paths.') +
    branchSheetInspect(branch, branchEnv) +
  '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(gaps.length ? 'light' : 'medium');
}
function auditRow(id, title, state, detail, proof, source){
  return { id, title, state, detail, proof, source };
}
function tapestryTarget(row){
  if (row.id === 'active-organ' || row.id === 'r3f-contract') return 'r3f';
  if (row.id === 'wake-health' || row.id === 'quest-frontier' || row.id === 'freshness-gaps') return 'quine';
  if (row.id === 'skill-mastery' || row.id === 'priority-signals') return 'operator-policy';
  if (row.id === 'mira-relationship' || row.id === 'npc-history' || row.id === 'memory-sense') return 'cortex';
  if (row.id === 'command-state') return 'hermes';
  if (row.id === 'live-proof') return 'live-proof';
  if (row.id === 'coordination-source') return 'paperclip';
  if (row.id === 'decision-context' || row.id === 'founder-stance') return 'operator-policy';
  return 'cambium-worker';
}
function tapestryRows(env){
  const L = env.ledger || env;
  const current = L.current || activeRow(L);
  const activeStage = stageForArc((current && current.arc) || 'XVII');
  const wake = wakeSteps(env.ledger ? env : { ledger:L });
  const wakeDone = wake.filter(step => step.done).length;
  const boxes = insightBoxes(env.ledger ? env : { ledger:L });
  const boxReady = boxes.filter(box => box.state === 'ready').length;
  const skills = skillCards(env.ledger ? env : { ledger:L });
  const skillReady = skills.filter(skill => skill.state === 'ready').length;
  const stance = stanceCard(env.ledger ? env : { ledger:L });
  const npcs = npcCards(env.ledger ? env : { ledger:L });
  const mira = npcs.find(npc => String(npc.title || '').toUpperCase() === 'MIRA') || npcs[0];
  const openItems = Array.isArray(env.openItems) ? env.openItems : [];
  const gateReady = openItems.some(item => (item.evidence || item.detail) && (item.consequence || item.approveConsequence || item.rerollConsequence) && item.reversibility && item.idempotencyHint);
  const commandReady = !!env.commands;
  const memory = senseCards(env.ledger ? env : { ledger:L }).find(sense => sense.id === 'memory');
  const decisions = decisionContextCards(env.ledger ? env : { ledger:L });
  const servedDecisions = decisions.filter(row => row.state === 'ready').length;
  const priorityDecisions = decisions.filter(row => row.state === 'ready' && row.source === 'operator-priority-signals');
  const socials = socialCards(env.ledger ? env : { ledger:L });
  const socialReady = socials.filter(row => row.state === 'ready').length;
  const npcHistory = (mira && mira.history) || {};
  const npcHistoryTotal = Number(npcHistory.total || 0);
  const live = env.liveProof || {};
  const liveRows = liveProofCards(env.ledger ? env : { ledger:L });
  const liveReady = live.status === 'ready' || (live.summary && live.summary.liveProofReady === true);
  const liveSummary = live.summary || {};
  const liveBlocked = Number.isFinite(Number(liveSummary.blocked)) ? Number(liveSummary.blocked) : liveRows.filter(row => row.state !== 'ready').length;
  const liveTotal = Number.isFinite(Number(liveSummary.total)) ? Number(liveSummary.total) : liveRows.length;
  const age = minutesSince(env.derivedAt);
  const fresh = age !== null && age <= 360;
  return [
    auditRow('active-organ', 'ACTIVE ORGAN', current ? 'ready' : 'wait', current ? stageTitle(activeStage) + ' · ' + (current.arc || 'arc') : 'no active quest frontier served', current ? 'stageForArc(' + (current.arc || 'unknown') + ')' : 'ledger.current missing', 'quest-ledger'),
    auditRow('wake-health', 'WAKE HEALTH', wakeDone > 0 ? 'ready' : 'wait', wakeDone + '/' + wake.length + ' wake steps proved', wake.map(step => step.id + ':' + (step.done ? 'proved' : 'missing')).join(' · '), 'wake envelope'),
    auditRow('quest-frontier', 'QUEST FRONTIER', current ? 'ready' : 'wait', current ? (current.arc || 'arc') + ' · ' + (current.title || 'active quest') : 'all arcs complete or frontier missing', current ? (current.id || current.title || 'frontier served') : 'frontier not served', 'quest-ledger'),
    auditRow('evidence-boxes', 'EVIDENCE BOXES', boxReady > 0 ? 'ready' : 'wait', boxReady + '/' + boxes.length + ' boxes ready', boxes.map(box => (box.title || 'box') + ':' + (box.state || 'wait')).join(' · '), 'insights'),
    auditRow('skill-mastery', 'SKILL MASTERY', skillReady > 0 ? 'ready' : 'wait', skillReady + '/' + skills.length + ' skills reliable or better', skills.map(skill => skill.title + ':' + skill.detail).join(' · '), 'skills'),
    auditRow('founder-stance', 'FOUNDER STANCE', stance.state === 'ready' ? 'ready' : 'wait', stance.detail, stance.title, 'tenant stance'),
    auditRow('mira-relationship', 'MIRA RELATIONSHIP', mira && mira.state === 'ready' ? 'ready' : 'wait', (mira && mira.detail) || 'Mira row missing', (mira && mira.proof) || 'relationship proof missing', 'npc'),
    auditRow('gate-consequences', 'GATE CONSEQUENCES', gateReady ? 'ready' : 'wait', gateReady ? openItems.length + ' open item(s) with evidence, consequence, reversibility, and idempotency' : 'no consequence-complete open gate item served', openItems.length ? openItems.slice(0, 3).map(item => item.id + ':' + (item.status || 'open')).join(' · ') : 'openItems empty', 'gate'),
    auditRow('command-state', 'COMMAND STATE', commandReady ? 'ready' : 'wait', commandReady ? 'live command data served' : 'org command data unavailable', commandReady ? 'commands envelope present' : 'env.commands missing', 'commands'),
    auditRow('memory-sense', 'MEMORY SENSE', memory && memory.on ? 'ready' : 'wait', (memory && memory.detail) || 'memory sense missing', (memory && memory.proof) || 'memory proof missing', 'senses'),
    auditRow('decision-context', 'DECISION CONTEXT', servedDecisions > 0 ? 'ready' : 'wait', servedDecisions + '/' + decisions.length + ' decision signals served', decisions.map(row => row.title + ':' + row.state).join(' · '), 'decisionContext'),
    auditRow('priority-signals', 'PRIORITY SIGNALS', priorityDecisions.length > 0 ? 'ready' : 'wait', priorityDecisions.length + '/6 explicit priority signals served', priorityDecisions.length ? priorityDecisions.map(row => row.title + ':' + row.detail).join(' · ') : 'operator-priority-signals@v1 missing or incomplete', 'decisionContext'),
    auditRow('coordination-source', 'COORDINATION SOURCE', socialReady > 0 ? 'ready' : 'wait', socialReady + '/' + socials.length + ' tenant coordination rows ready', socials.map(row => row.title + ':' + row.state).join(' · '), 'social'),
    auditRow('npc-history', 'NPC HISTORY', npcHistoryTotal > 0 ? 'ready' : 'wait', npcHistoryTotal + ' durable Mira/NPC event(s) served', npcHistoryTotal > 0 ? (npcHistory.source || 'operator-npc-events@v1') + ' · ' + Number(npcHistory.contradictions || 0) + ' contradiction(s)' : 'operator-npc-events@v1 missing', 'npc'),
    auditRow('live-proof', 'LIVE PROOF', liveReady ? 'ready' : 'wait', liveReady ? 'live-proof receipts validate ready' : liveBlocked + '/' + liveTotal + ' readiness checks blocked', live.invariant || 'capture plan is guidance, not proof', 'liveProof'),
    auditRow('r3f-contract', 'R3F CONTRACT', 'ready', STAGES.length + ' organs · ' + RAILS.length + ' rails', 'shared visual contract loaded into Telegram map', 'shared/cambium-visual-contract'),
    auditRow('freshness-gaps', 'FRESHNESS GAPS', fresh ? 'ready' : 'wait', age === null ? 'freshness missing' : fresh ? age + 'm since derivation' : Math.round(age / 60) + 'h stale', env.derivedAt || 'derivedAt missing', 'freshness'),
  ];
}
function renderTapestryAudit(env){
  return '<div class="boxgrid">' + tapestryRows(env).map((row, i) =>
    '<button type="button" class="ibox tapestry ' + (row.state === 'ready' ? 'ready' : '') + '" data-tapestry="' + i + '" data-ecosystem-target="' + esc(tapestryTarget(row)) + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function insightBoxes(env){
  const insightEnv = env.insights || {};
  const insightSource = insightEnv.source || 'missing';
  const served = Array.isArray(insightEnv.rows) ? insightEnv.rows : null;
  if (served) {
    if (!served.length) return [{
      title:'NO EVIDENCE BOXES',
      state:'wait',
      detail:insightEnv.gap || 'no quest evidence rows served for insight boxes',
      proof:insightEnv.gap || 'no served insight rows',
      source:insightSource,
      insightSource,
      missingSource:insightSource,
      evidence:[],
    }];
    return served.slice(0, 4).map(row => ({
      title:row.title || row.id || 'evidence box',
      state:row.state || 'wait',
      detail:row.detail || row.gap || row.proof || 'evidence pending',
      proof:row.proof || row.gap || 'proof missing from insight row',
      source:row.source || insightSource,
      insightSource,
      origin:row.origin || 'unknown',
      evidence:Array.isArray(row.evidence) ? row.evidence : [],
    }));
  }
  const L = env.ledger;
  const rows = [...completedRows(L).slice(-3), activeRow(L)].filter(Boolean).slice(-4);
  if (!rows.length) return [{ title:'NO EVIDENCE BOXES', state:'wait', detail:'push a derived ledger before the map can reveal work', proof:'legacy-local inference found no rows', source:'legacy-local', insightSource:'legacy-local', missingSource:'legacy-local', evidence:[] }];
  return rows.map(row => {
    const facet = facetsFrom(row.evidence)[0];
    return { title:rowLabel(row), state:row.status === 'complete' ? 'ready' : 'wait', detail:(facet && facet.label) || row.evidence || 'evidence pending', proof:row.evidence || 'evidence pending', source:'legacy-local', insightSource:'legacy-local', evidence:[] };
  });
}
function renderInsightBoxes(env){
  return '<div class="boxgrid">' + insightBoxes(env).map((box, i) =>
    '<button type="button" class="ibox ' + (box.state === 'ready' ? 'ready' : '') + '" data-box="' + i + '"><b>' + esc(box.title) + '</b><span>' + esc(box.detail) + '</span></button>'
  ).join('') + '</div>';
}
function agentSkillRoles(agent){
  const subsets = agent && agent.roleSubsets && typeof agent.roleSubsets === 'object' ? agent.roleSubsets : {};
  return Object.entries(subsets).map(([roleId, subset]) => {
    const permissions = Array.isArray(subset.permissions) ? subset.permissions.join(', ') : '';
    const commands = Array.isArray(subset.commands) ? subset.commands.join(', ') : '';
    const purpose = subset.purpose || '';
    return { roleId, version: subset.version || '', permissions, commands, purpose };
  });
}
function agentSkillDetail(agent){
  if (!agent) return '';
  const roles = agentSkillRoles(agent);
  const writeCount = Array.isArray(agent.writeCommands) ? agent.writeCommands.length : 0;
  const readCount = Array.isArray(agent.readCommands) ? agent.readCommands.length : 0;
  return (agent.domain || 'skill') + ' · ' + (agent.gameLayer || 'layer') + ' · loadout v' + (agent.version || 'unknown') + ' · ' + roles.length + ' roles · ' + readCount + ' read · ' + writeCount + ' write gated';
}
function skillCards(env){
  const skillEnv = env.skills || {};
  const rows = Array.isArray(skillEnv.rows) ? skillEnv.rows : [];
  const sourcePath = skillEnv.path || skillEnv.sourcePath || ('.operator/' + TENANT + '.skills.json');
  const source = skillEnv.source || 'missing';
  const gapCommand = 'quine write skills forge --tenant ' + TENANT;
  if (!rows.length) return [{
    title:'SKILL LABORS',
    state:'wait',
    detail:skillEnv.gap || 'skill registry missing',
    status:'missing',
    tier:'missing',
    tierLabel:'MISSING',
    uses:0,
    successRateText:'0%',
    recentRateText:'0%',
    sampleMinimum:'0/3 uses',
    promotionStatus:'blocked · NO PROMOTION · skill telemetry missing',
    promotion:{ status:'blocked', label:'NO PROMOTION', detail:'skill telemetry missing', requiredApproval:true },
    source,
    sourcePath,
    registryProof:'missing registry proof; source path is a gap target only',
    gapAction:sourcePath + ' · ' + gapCommand,
    gap:skillEnv.gap || 'skill registry missing',
  }];
  return rows.slice(0, 4).map(skill => {
    const agent = skill.agentSkill || null;
    const pct = Math.round(Number(skill.successRate || 0) * 100);
    const recent = Math.round(Number(skill.recentRate ?? skill.successRate ?? 0) * 100);
    const uses = Number(skill.uses ?? skill.sampleSize ?? 0);
    const sample = Number(skill.sampleSize ?? uses);
    const minimum = Number(skill.minimum ?? 3);
    const tier = String(skill.tier || (skill.declining ? 'declining' : sample < minimum ? 'unproven' : 'learning'));
    const label = String(skill.tierLabel || (tier === 'declining' ? 'DECLINING' : tier === 'unproven' ? 'UNPROVEN' : tier.toUpperCase()));
    const ready = !['unproven', 'declining'].includes(tier);
    const promotion = skill.promotion || {};
    const promotionDetail = promotion.label
      ? ' · promotion: ' + String(promotion.label) + (promotion.detail ? ' · ' + String(promotion.detail) : '')
      : '';
    const detail = (skill.gap
      ? label + ' · ' + skill.gap
      : label + ' · ' + sample + ' uses · ' + pct + '% total · ' + recent + '% recent') + promotionDetail;
    const agentDetail = agent ? agentSkillDetail(agent) : '';
    return {
      title:skill.id,
      state:ready ? 'ready' : 'wait',
      detail:String(skill.status || 'unknown') + ' · ' + (agentDetail || detail),
      status:String(skill.status || 'unknown'),
      tier,
      tierLabel:label,
      uses,
      successRateText:pct + '%',
      recentRateText:recent + '%',
      sampleMinimum:sample + '/' + minimum + ' uses',
      promotionStatus:String(promotion.status || 'blocked') + (promotion.label ? ' · ' + String(promotion.label) : '') + (promotion.requiredApproval ? ' · founder approval required' : ''),
      promotion,
      source,
      sourcePath,
      registryProof:skill.registryProof || sourcePath,
      gapAction:sourcePath + ' · ' + gapCommand,
      gap:skill.gap || '',
      agentSkill:agent,
    };
  });
}
function canQueueSkillPromotion(skill){
  return !!(skill && skill.promotion && skill.promotion.status === 'founder-review' && skill.tier !== 'declining' && skill.status !== 'production');
}
function renderSkills(env){
  return '<div class="boxgrid">' + skillCards(env).map((skill, i) =>
    '<button type="button" class="ibox skill ' + (skill.state === 'ready' ? 'ready' : '') + '" data-skill="' + i + '"' + (canQueueSkillPromotion(skill) ? ' data-signed-action-entrypoint="promote-skill"' : '') + '><b>' + esc(skill.title) + '</b><span>' + esc(skill.detail) + '</span></button>'
  ).join('') + '</div>';
}
function npcCards(env){
  const npcEnv = env.npc || {};
  const rows = Array.isArray(npcEnv.relationships) ? npcEnv.relationships : [];
  const missingStage = { id:'missing', label:'MISSING', detail:'relationship stage not served', confidence:0 };
  const missingAdvice = { status:'blocked', label:'NO ADVICE', detail:'no durable NPC advice event served', proof:'no durable NPC events served', action:{ kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' } };
  const missingHistory = { source:'missing', total:0, contradictions:0, rows:[] };
  if (!rows.length) return [{ title:'MIRA', state:'wait', detail:'MISSING · npc relationship state not served yet', proof:'no relationship rows served', stage:missingStage, events:[], history:missingHistory, advice:missingAdvice, scope:'missing', ecosystemTargets:['cortex', 'operator-npc-events'] }];
  return rows.map(npc => {
    const stage = npc.stage || missingStage;
    const advice = npc.advice || missingAdvice;
    const history = npc.history || missingHistory;
    const id = String(npc.id || 'npc');
    const ecosystemTargets = id === 'founder-npc'
      ? ['quest-ledger', 'operator-npc-events']
      : id === 'mira'
        ? ['cortex', 'operator-npc-events']
        : ['operator-npc-events'];
    return {
      title:id.toUpperCase(),
      state:npc.status === 'inferred' ? 'ready' : 'wait',
      detail:String(stage.label || 'MISSING') + ' · ' + (npc.detail || stage.detail || 'relationship signal missing'),
      proof:npc.proof || npc.detail || 'relationship proof missing',
      stage,
      events:Array.isArray(npc.events) ? npc.events : [],
      history,
      advice,
      scope:npc.scope || 'missing',
      ecosystemTargets,
    };
  });
}
function renderNpc(env){
  return '<div class="boxgrid">' + npcCards(env).map((npc, i) =>
    '<button type="button" class="ibox npc ' + (npc.state === 'ready' ? 'ready' : '') + '" data-npc="' + i + '"><b>' + esc(npc.title) + '</b><span>' + esc(npc.detail) + '</span></button>'
  ).join('') + '</div>';
}
function inspectGroupSummaries(env, L){
  const minutes = minutesSince(env && env.derivedAt);
  const stale = minutes === null || minutes > 360;
  const branchRows = (env && env.branchStories && Array.isArray(env.branchStories.rows)) ? env.branchStories.rows : [];
  const gateRows = Array.isArray(env && env.openItems) ? env.openItems : [];
  const policyRows = [policyCard(env || { ledger:L })];
  const proofRows = liveProofCards(env || { ledger:L });
  const evidenceRows = insightBoxes(env || { ledger:L });
  const toolCount = CMDS.reduce((sum, group) => sum + group[1].length, 0);
  return [
    { id:'freshness', title:'freshness', glyph:'cortex', state:stale ? 'stale' : 'active', detail:stale ? 'Envelope is stale or missing; refresh proof before trusting movement.' : 'Envelope age is inside the current proof window.' },
    { id:'policy', title:'policy', glyph:'build', state:policyRows.some(row => row.state === 'gap') ? 'blocked' : 'active', detail:String(policyRows.length) + ' policy checks keep operator action bounded.' },
    { id:'live-proof', title:'live proof', glyph:'proof', state:proofRows.some(row => row.state !== 'ready') ? 'proof-needed' : 'complete', detail:String(proofRows.length) + ' live readiness rows stay honest about blockers.' },
    { id:'branch-packets', title:'branch packets', glyph:'arc', state:branchRows.length ? 'active' : 'blocked', detail:branchRows.length ? String(branchRows.length) + ' branch packet(s) feed Mission.' : 'No branch packet rows; Mission must not fake progress.' },
    { id:'gates', title:'gates', glyph:'gate', state:gateRows.length ? 'proof-needed' : 'idle', detail:gateRows.length ? String(gateRows.length) + ' founder decision(s) waiting.' : 'No founder decisions are waiting.' },
    { id:'tools', title:'tools', glyph:'ops', state:env && env.commands ? 'active' : 'stale', detail:toolCount + ' toolbelt commands; live command data is ' + (env && env.commands ? 'available.' : 'not available.') },
    { id:'rails', title:'rails', glyph:'taste', state:'active', detail:String(RAILS.length) + ' visual contract rails remain inspectable here.' },
    { id:'evidence', title:'evidence', glyph:'proof', state:evidenceRows.length ? 'active' : 'proof-needed', detail:evidenceRows.length ? String(evidenceRows.length) + ' evidence rows can open proof sheets.' : 'Evidence detail is missing from this envelope.' },
  ];
}
function renderInspectGroups(env, L){
  return '<section class="inspect-groups" data-component="InspectGroupStack">' + inspectGroupSummaries(env, L).map(group =>
    '<button type="button" class="' + mcClass('inspect-group', group.state) + '" data-component="InspectGroup" data-interaction-kind="sheet" data-source="inspect-proof-layer@v1" data-inspect-target="' + esc(group.id) + '" data-inspect-group="' + esc(group.id) + '">' +
      mcGlyphSvg(group.glyph, group.state) +
      '<span><b>' + esc(group.title) + '</b><small>' + esc(group.detail) + '</small></span>' +
      mcStateToken(group.state, mcStateKind(group.state)) +
    '</button>'
  ).join('') + '</section>';
}
function inspectGroupDetailRows(id, env, L){
  const live = (env && env.liveProof) || {};
  const branchEnv = branchEnvelope(env || { ledger:L });
  const rows = {
    freshness:[
      ['stale envelope', FRESHNESS_STATE.stale ? 'yes · refresh before trusting movement' : 'no · current proof window'],
      ['derived at', (env && env.derivedAt) || 'missing'],
      ['ignored stale refresh', 'older envelopes never repaint Mission state'],
    ],
    policy:[
      ['policy authority', 'operator policy gates actions; primary pages do not expose debug rules'],
      ['copy containment', 'Mission, Gate, Tools, and Story keep source/schema words out of primary cards'],
      ['proof rule', 'blocked rows keep warning state until evidence resolves'],
    ],
    'live-proof':[
      ['ready count', String((live.summary && live.summary.ready) || 0)],
      ['blocked count', String((live.summary && live.summary.blocked) || liveProofCards(env || { ledger:L }).filter(row => row.state !== 'ready').length)],
      ['blockers', live.blockers && live.blockers.length ? live.blockers.join(' · ') : 'Telegram initData and device artifact may still be required'],
      ['secret redaction', 'receipts must stay redacted; no raw initData or bearer token belongs in screenshots'],
    ],
    'branch-packets':[
      ['packet source', branchEnv.source || 'missing'],
      ['schema', (branchEnv.schema || (branchEnv.rows && branchEnv.rows[0] && branchEnv.rows[0].source && branchEnv.rows[0].source.schema)) || 'cambium.product_branch_packet.v1'],
      ['missing diagnostics', branchRows(env || { ledger:L }).length ? 'branch rows served' : (branchEnv.gap || 'branch stories missing')],
    ],
    gates:[
      ['signed route', '/api/gate/' + TENANT],
      ['queue state', String(Array.isArray(env && env.openItems) ? env.openItems.length : 0) + ' open item(s)'],
      ['auth boundary', 'initData checked by Worker before queue write'],
    ],
    tools:[
      ['tool source', CMDDATA ? 'live command envelope available' : 'live command envelope stale'],
      ['command semantics', 'Tools copy command text or open sheets; signed decisions stay in Gate'],
      ['recent strip', '/ts-status · /ts-hermes · /ts-standup'],
    ],
    rails:[
      ['visual envelope', 'shared/cambium-visual-contract.ts'],
      ['organs', String(STAGES.length)],
      ['rails', String(RAILS.length)],
    ],
    evidence:[
      ['evidence rows', String(insightBoxes(env || { ledger:L }).length)],
      ['source containment', 'sources and proof paths are Inspect/sheet detail, not primary app copy'],
      ['mini app surface', 'workers/quests/src/page.ts'],
    ],
  };
  return rows[id] || [['detail', 'no specific detail rows served']];
}
function renderInspectProofSummary(env, L){
  const liveRows = liveProofCards(env || { ledger:L });
  const blocked = liveRows.filter(row => row.state !== 'ready').length;
  const branchCount = branchRows(env || { ledger:L }).length;
  return '<section class="inspect-proof-summary" data-component="InspectProofSummaryAction">' +
    '<b>Proof summary</b><small>' + branchCount + ' branch packet(s) · ' + blocked + ' live readiness blocker(s) · redacted receipts required.</small>' +
    '<div class="gbtns command-copy"><button type="button" data-inspect-summary="1">Open proof summary</button></div>' +
  '</section>';
}
function openInspectGroupSheet(id, env){
  const L = (env && env.ledger) || env || {};
  const group = inspectGroupSummaries(env || { ledger:L }, L).find(row => row.id === id) || inspectGroupSummaries(env || { ledger:L }, L)[0];
  $('sheetBody').innerHTML = '<div class="arc">inspect · ' + esc(group.id) + '</div><h2>' + esc(group.title) + '</h2>' +
    '<div class="nar">' + esc(group.detail) + '</div>' +
    '<div class="kv"><b>debug layer</b><span>Inspect keeps proof and architecture details behind the main app flow</span><b>state</b><span>' + esc(mcStateKind(group.state)) + '</span><b>source</b><span>inspect-proof-layer@v1</span>' +
    inspectGroupDetailRows(group.id, env || { ledger:L }, L).map(([label, value]) => '<b>' + esc(label) + '</b><span>' + esc(value) + '</span>').join('') +
    '<b>related page</b><span>' + esc(group.id === 'tools' ? 'Tools' : group.id === 'gates' ? 'Gate' : group.id === 'branch-packets' ? 'Mission' : 'Inspect') + '</span><b>trace action</b><span>Open the primary page, then return to Inspect for proof detail</span></div>' +
    '<div class="gbtns"><button type="button" data-inspect-page-link="' + esc(group.id === 'tools' ? 'tools' : group.id === 'gates' ? 'gate' : group.id === 'branch-packets' ? 'mission' : 'inspect') + '">Open related page</button></div>';
  $('sheetBody').querySelectorAll('[data-inspect-page-link]').forEach(el => el.onclick = () => {
    closeSheet();
    const target = el.dataset.inspectPageLink;
    go(target === 'mission' ? 0 : target === 'gate' ? 1 : target === 'tools' ? 2 : 4);
    if (target === 'tools') renderCommands();
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(group.state === 'blocked' || group.state === 'stale' ? 'medium' : 'light');
}
function openInspectSummarySheet(env){
  const L = (env && env.ledger) || env || {};
  const liveRows = liveProofCards(env || { ledger:L });
  const blockedRows = liveRows.filter(row => row.state !== 'ready');
  const summary = 'Cambium mini app proof summary: ' + branchRows(env || { ledger:L }).length + ' branch packet(s), ' + blockedRows.length + ' live readiness blocker(s), sources stay in Inspect, receipts stay redacted.';
  $('sheetBody').innerHTML = '<div class="arc">inspect · proof summary</div><h2>Proof Summary</h2>' +
    '<div class="nar">' + esc(summary) + '</div>' +
    '<div class="kv"><b>copy text</b><span>' + esc(summary) + '</span><b>surface</b><span>workers/quests/src/page.ts</span><b>redaction rule</b><span>no raw initData, bearer token, or secret value in proof artifacts</span></div>' +
    '<div class="gbtns command-copy"><button type="button" data-copy-proof-summary="' + esc(summary) + '">Copy proof summary</button></div>';
  const proofCopy = $('sheetBody').querySelector('[data-copy-proof-summary]');
  if (proofCopy) proofCopy.onclick = () => copyCommandToClipboard(summary, proofCopy).catch(() => { proofCopy.textContent = 'Copy unavailable'; });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function renderOperatorMap(env){
  const L = env.ledger || env;
  const activeStageId = stageForArc((L.current && L.current.arc) || 'XVII');
  const stageCards = STAGES.map((stage, i) => {
    const rows = stageRows(L, stage);
    const done = rows.filter(row => row.status === 'complete').length;
    const active = stage.id === activeStageId;
    const pct = rows.length ? Math.round(100 * done / rows.length) : 0;
    return '<button type="button" class="stage-card ' + (active ? 'active ' : '') + (done === rows.length && rows.length ? 'done' : '') + '" style="--i:' + i + '" data-stage="' + stage.id + '">' +
      '<span class="stage-glyph">' + esc(stage.glyph) + '</span>' +
      '<span><span class="stage-title">' + esc(stage.title) + '</span><span class="stage-detail">' + esc(stage.detail) + '</span>' +
        '<span class="stagebar"><span style="width:' + pct + '%"></span></span></span>' +
      '<span class="stage-count">' + done + '/' + rows.length + '</span>' +
    '</button>';
  }).join('');
  const railCards = RAILS.map(rail => {
    const hot = rail.from === activeStageId || rail.to === activeStageId;
    return '<button type="button" class="rail ' + (hot ? 'hot' : '') + '" data-interaction-kind="sheet" data-source="shared/cambium-visual-contract" data-rail="' + esc(rail.id || (rail.from + '-' + rail.to)) + '"><b>' + esc(stageTitle(rail.from)) + ' -> ' + esc(stageTitle(rail.to)) + '</b><span>' + esc(rail.label) + '</span></button>';
  }).join('');
  $('mapwrap').innerHTML =
    '<div class="maphead"><div><h2>Inspect</h2><p>Proof, packet, freshness, and system detail.</p></div>' +
      '<button type="button" class="mapbadge" data-interaction-kind="sheet" data-source="shared/cambium-visual-contract" data-ecosystem-target="r3f">frontier · ' + esc((L.current && L.current.arc) || 'complete') + '</button></div>' +
    renderInspectGroups(env.ledger ? env : { ledger:L }, L) +
    renderInspectProofSummary(env.ledger ? env : { ledger:L }, L) +
    '<div class="cmdgrp">freshness</div>' + renderTapestryAudit(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">wake</div>' + renderWake(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">lanes</div>' + renderLanes(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">stance</div>' + renderStance(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">policy</div>' + renderPolicy(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">decision context</div>' + renderDecisionContext(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">live proof</div>' + renderLiveProof(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">branch packets</div>' + renderBranches(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">missions</div>' + renderBranchMissions(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">KPIs</div>' + renderBranchKpis(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">gates</div>' + renderBranchGates(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">proof paths</div>' + renderBranchProof(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">side quests</div>' + renderSideQuests(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">coordination</div>' + renderSocial(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">senses</div>' + renderSenses(env.ledger ? env : { ledger:L }) +
    '<div class="stagegrid">' + stageCards + '</div>' +
    '<div class="cmdgrp">evidence</div>' + renderInsightBoxes(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">skill labors</div>' + renderSkills(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">companions</div>' + renderNpc(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">rails</div><div class="railgrid">' + railCards + '</div>' +
    '<div class="mapnote">Inspect keeps the low-level proof rows out of Mission, Gate, Tools, and Story.</div>';
  $('mapwrap').querySelectorAll('.mapbadge').forEach(el => el.onclick = () => openMapHeaderSheet(L));
  $('mapwrap').querySelectorAll('[data-inspect-group]').forEach(el => el.onclick = () => openInspectGroupSheet(el.dataset.inspectGroup, env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-inspect-summary]').forEach(el => el.onclick = () => openInspectSummarySheet(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('.rail').forEach(el => el.onclick = () => openRailSheet(el.dataset.rail, L));
  $('mapwrap').querySelectorAll('.stage-card').forEach(el => el.onclick = () => openMapSheet(L, el.dataset.stage));
  $('mapwrap').querySelectorAll('[data-wake]').forEach(el => el.onclick = () => openWakeBox(env.ledger ? env : { ledger:L }, +el.dataset.wake));
  $('mapwrap').querySelectorAll('.sense').forEach(el => el.onclick = () => openSenseSheet(env.ledger ? env : { ledger:L }, el.dataset.sense));
  $('mapwrap').querySelectorAll('[data-lane]').forEach(el => el.onclick = () => openLaneSheet(env.ledger ? env : { ledger:L }, el.dataset.lane));
  $('mapwrap').querySelectorAll('[data-stance]').forEach(el => el.onclick = () => openStanceBox(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-policy]').forEach(el => el.onclick = () => openPolicyBox(env.ledger ? env : { ledger:L }));
  $('mapwrap').querySelectorAll('[data-decision]').forEach(el => el.onclick = () => openDecisionContextBox(env.ledger ? env : { ledger:L }, +el.dataset.decision));
  $('mapwrap').querySelectorAll('[data-tapestry]').forEach(el => el.onclick = () => openTapestryBox(env.ledger ? env : { ledger:L }, +el.dataset.tapestry));
  $('mapwrap').querySelectorAll('[data-live-proof]').forEach(el => el.onclick = () => openLiveProofBox(env.ledger ? env : { ledger:L }, +el.dataset.liveProof));
  $('mapwrap').querySelectorAll('[data-branch-gap]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, 0, -1));
  $('mapwrap').querySelectorAll('.ibox.branch[data-branch]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, +el.dataset.branch, -1));
  $('mapwrap').querySelectorAll('[data-branch-mission]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, +el.dataset.branch, +el.dataset.branchMission));
  $('mapwrap').querySelectorAll('[data-branch-kpi],[data-branch-gate],[data-branch-proof]').forEach(el => el.onclick = () => openBranchMissionSheet(env.ledger ? env : { ledger:L }, +el.dataset.branch, -1));
  $('mapwrap').querySelectorAll('[data-side]').forEach(el => el.onclick = () => openSideQuestBox(env.ledger ? env : { ledger:L }, +el.dataset.side));
  $('mapwrap').querySelectorAll('[data-social]').forEach(el => el.onclick = () => openSocialBox(env.ledger ? env : { ledger:L }, +el.dataset.social));
  $('mapwrap').querySelectorAll('.ibox[data-box]').forEach(el => el.onclick = () => openInsightBox(env.ledger ? env : { ledger:L }, +el.dataset.box));
  $('mapwrap').querySelectorAll('[data-skill]').forEach(el => el.onclick = () => openSkillBox(env.ledger ? env : { ledger:L }, +el.dataset.skill));
  $('mapwrap').querySelectorAll('[data-npc]').forEach(el => el.onclick = () => openNpcBox(env.ledger ? env : { ledger:L }, +el.dataset.npc));
}
function openMapHeaderSheet(L){
  const row = currentQuestRow(L);
  const arc = (row && row.arc) || (L.current && L.current.arc) || 'complete';
  const organId = row ? stageForArc(arc) : 'complete';
  $('sheetBody').innerHTML = '<div class="arc">inspect · active frontier</div><h2>Inspect Header</h2>' +
    '<div class="nar">Inspect exposes source contracts, provenance, and low-level proof detail for the current frontier.</div>' +
    '<div class="kv"><b>active arc</b><span>' + esc(arc) + '</span><b>active organ</b><span>' + esc(row ? stageTitle(organId) : 'all organs complete') + '</span><b>source</b><span>shared/cambium-visual-contract</span><b>quest title</b><span>' + esc((row && row.title) || (L.current && L.current.title) || 'no active quest') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row ? 'medium' : 'light');
}
function railEcosystemTarget(rail){
  if (rail.lane === 'handoff') return 'paperclip';
  if (rail.lane === 'runner') return 'quine';
  if (rail.lane === 'background-emitter') return 'cortex';
  return 'r3f';
}
function stageEcosystemTarget(stageId){
  if (stageId === 'genesis') return 'genesis';
  if (stageId === 'taste') return 'taste';
  if (stageId === 'build') return 'build';
  if (stageId === 'ops') return 'ops';
  if (stageId === 'cortex') return 'cortex';
  return 'r3f';
}
function openRailSheet(railId, L){
  const rail = RAILS.find(item => item.id === railId) || RAILS.find(item => (item.from + '-' + item.to) === railId) || RAILS[0];
  const row = currentQuestRow(L);
  const activeOrgan = row ? stageForArc(row.arc) : 'complete';
  const hot = row && (rail.from === activeOrgan || rail.to === activeOrgan);
  const target = railEcosystemTarget(rail);
  $('sheetBody').innerHTML = '<div class="arc">rail · ' + esc(rail.id) + '</div><h2>' + esc(stageTitle(rail.from)) + ' -> ' + esc(stageTitle(rail.to)) + '</h2>' +
    '<div class="nar">' + esc(rail.label) + '</div>' +
    '<div class="kv"><b>data rail</b><span>' + esc(rail.id) + '</span><b>source</b><span>shared/cambium-visual-contract.ts</span><b>proof</b><span>shared/cambium-visual-contract.ts</span><b>ecosystem target</b><span>' + esc(target) + '</span><b>from organ</b><span>' + esc(stageTitle(rail.from)) + '</span><b>to organ</b><span>' + esc(stageTitle(rail.to)) + '</span><b>lane</b><span>' + esc(rail.lane || 'missing') + '</span><b>active arc</b><span>' + esc((row && row.arc) || 'complete') + '</span><b>active organ</b><span>' + esc(activeOrgan === 'complete' ? 'complete' : stageTitle(activeOrgan)) + '</span><b>active rail</b><span>' + esc(hot ? 'yes · touches active organ' : 'no · does not touch active organ') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(hot ? 'medium' : 'light');
}
// parse the evidence string into honest facets: "a · b · c" -> chips, "done" if it
// reads as a satisfied count (x/x) or lacks "pending", else "pending".
function facetsFrom(ev){
  return String(ev || '').split('·').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    const pend = /pending|todo|blocked|missing/i.test(s);
    const done = (m && m[1] === m[2] && +m[2] > 0) || (!pend && !m && /\\b(yes|done|signed|received|true)\\b/i.test(s));
    return { label: s, done: done && !pend };
  });
}
function openMapSheet(L, stageId){
  const stage = STAGES.find(s => s.id === stageId) || STAGES[0];
  const rows = stageRows(L, stage);
  const target = stageEcosystemTarget(stage.id);
  const stageMeta = '<div class="kv"><b>organ target</b><span>' + esc(target) + '</span><b>source</b><span>shared/cambium-visual-contract.ts</span><b>interaction</b><span>read-only stage inspection; no signed action is queued from this sheet</span></div>';
  const body = rows.length ? rows.map((row, i) => {
    const facets = facetsFrom(row.evidence);
    return '<div class="li"><span class="cname">' + esc(row.arc) + ' · ' + esc(row.title) + '</span> <span class="cargs">' + esc(row.status) + '</span>' +
      '<div class="facets" style="margin-top:8px">' + (facets.length ? facets.map((f,j) =>
        '<div class="facet ' + (f.done?'done':'pend') + '" style="--i:' + (i + j) + '"><span class="dot"></span>' + esc(f.label) + '</div>').join('') : '<div class="cdesc">' + esc(row.evidence) + '</div>') +
      '</div></div>';
  }).join('') : '<div class="nar">no quest rows currently mapped to this organ. Source: shared/cambium-visual-contract.ts.</div>';
  $('sheetBody').innerHTML = '<div class="arc">operator map · ' + esc(stage.id) + '</div><h2>' + esc(stage.title) + '</h2>' +
    '<div class="nar">' + esc(stage.detail) + '</div>' + stageMeta + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function qarg(value){
  return JSON.stringify(String(value || '').replace(/\\s+/g, ' ').trim());
}
function wakeEventCommand(wake, status){
  const step = wake.id || 'step';
  const detail = wake.detail || (status === 'proved' ? 'wake step proved' : 'wake step missing');
  const proof = wake.proof || detail;
  return 'quine write quests wake-event ' + step + ' ' + status + ' --detail ' + qarg(detail) + ' --proof ' + qarg(proof) + ' --target ' + qarg('wake:' + step) + ' --tenant ' + qarg(TENANT);
}
function openWakeBox(env, index){
  const wake = wakeSteps(env)[index] || wakeSteps(env)[0];
  const currentStatus = wake.done ? 'proved' : 'missing';
  const servedEvidence = Array.isArray(wake.evidence) ? wake.evidence : [];
  const history = wake.history || { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] };
  const evidence = servedEvidence.length
    ? '<div class="kv">' + servedEvidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '';
  const wakeActionRows = wake.done
    ? '<b>event command</b><span>' + esc(wakeEventCommand(wake, 'proved')) + '</span>'
    : '<b>side quest target</b><span>wake-proof</span><b>quine command</b><span>' + esc(wakeEventCommand(wake, 'missing')) + '</span>';
  const historyRows = Array.isArray(history.rows) && history.rows.length
    ? '<div class="kv">' + history.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.status || 'missing') + ' · ' + (row.source || history.source || 'missing') + ' · ' + (row.detail || row.proof || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no operator wake events served; this is the latest snapshot, not a historical trace.</div>';
  $('sheetBody').innerHTML = '<div class="arc">wake step · ' + esc(currentStatus) + '</div><h2>' + esc(wake.label) + '</h2>' +
    '<div class="nar">' + esc(wake.detail) + '</div><div class="kv"><b>current status</b><span>' + esc(currentStatus) + '</span><b>source</b><span>' + esc(wake.source || 'missing') + '</span><b>proof</b><span>' + esc(wake.proof || wake.detail) + '</span><b>wake event source</b><span>' + esc(history.source || 'missing') + '</span><b>history count</b><span>' + Number(history.total || 0) + '</span><b>wake history</b><span>' + esc((history.source || 'missing') + ' · ' + (history.status || 'none') + ' · ' + Number(history.total || 0) + ' event(s)') + '</span><b>history proof</b><span>' + esc(history.proof || 'history proof missing') + '</span><b>history relation</b><span>operator wake history is shown separately from the current served status</span>' + wakeActionRows + '</div>' + evidence + historyRows;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(wake.done ? 'medium' : 'light');
}
function openSenseSheet(env, senseId){
  const L = env.ledger;
  const cards = senseCards(env);
  const sense = cards.find(card => card.id === senseId) || cards[0];
  const servedEvidence = Array.isArray(sense.evidence) ? sense.evidence : [];
  let rows = [];
  if (sense.id === 'signal') rows = activeRow(L) ? [activeRow(L)] : [];
  if (sense.id === 'memory') rows = L.rows.filter(row => stageForArc(row.arc) === 'cortex');
  if (sense.id === 'risk') rows = L.rows.filter(row => row.status === 'locked' || /pending|blocked|missing|unreachable|rejected/i.test(row.evidence || ''));
  if (sense.id === 'drift') rows = L.rows.filter(row => row.status === 'active').slice(0, 1);
  const body = servedEvidence.length ? servedEvidence.map((item, i) =>
    '<div class="li"><span class="cname">' + esc(item.label || 'evidence') + '</span> <span class="cargs">' + esc(item.status || sense.source || 'served') + '</span><div class="cdesc">' + esc(item.detail || sense.proof || 'proof missing') + '</div></div>'
  ).join('') : rows.length ? rows.map((row, i) =>
    '<div class="li"><span class="cname">' + esc(rowLabel(row)) + '</span> <span class="cargs">' + esc(row.status) + '</span><div class="cdesc">' + esc(row.evidence) + '</div></div>'
  ).join('') : '<div class="nar">' + esc(sense.proof || 'no rows currently prove this sense; the map keeps this as an explicit gap.') + '</div>';
  $('sheetBody').innerHTML = '<div class="arc">sense · ' + esc(sense.id) + '</div><h2>' + esc(sense.title) + '</h2>' +
    '<div class="nar">' + esc(sense.detail) + '</div><div class="kv"><b>source</b><span>' + esc(sense.source || 'missing') + '</span><b>ecosystem target</b><span>' + esc(sense.target || senseEcosystemTarget(sense.id)) + '</span><b>proof</b><span>' + esc(sense.proof || sense.detail) + '</span></div>' + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openLaneSheet(env, laneId){
  const lane = laneCards(env).find(card => card.id === laneId) || laneCards(env)[0];
  $('sheetBody').innerHTML = '<div class="arc">lane · ' + esc(lane.id) + '</div><h2>' + esc(lane.title) + '</h2>' +
    '<div class="nar">' + esc(lane.detail) + '</div><div class="kv"><b>source</b><span>' + esc(lane.source || 'missing') + '</span><b>world.log</b><span>' + esc(lane.worldLog || 'missing') + '</span><b>count</b><span>' + Number(lane.count || 0) + '</span><b>ratio</b><span>' + Math.round(Number(lane.ratio || 0) * 100) + '%</span><b>sample size</b><span>' + Number(lane.sampleSize || 0) + '</span><b>stance contribution</b><span>' + esc(lane.stanceContribution || 'no stance contribution') + '</span><b>recommendation</b><span>' + esc(lane.recommendation || 'no recommendation') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(lane.on ? 'medium' : 'light');
}
function openStanceBox(env){
  const stance = stanceCard(env);
  $('sheetBody').innerHTML = '<div class="arc">tenant stance · ' + esc(stance.state) + '</div><h2>' + esc(stance.title) + '</h2>' +
    '<div class="nar">' + esc(stance.detail) + '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(stance.state === 'ready' ? 'medium' : 'light');
}
function openPolicyBox(env){
  const policy = policyCard(env);
  const blockers = policy.blockers && policy.blockers.length
    ? '<div class="kv">' + policy.blockers.slice(0, 4).map((blocker, i) => '<b>blocker ' + (i + 1) + '</b><span>' + esc(blocker) + '</span>').join('') + '</div>'
    : '';
  const cautions = policy.cautions && policy.cautions.length
    ? '<div class="kv">' + policy.cautions.slice(0, 3).map((caution, i) => '<b>caution ' + (i + 1) + '</b><span>' + esc(caution) + '</span>').join('') + '</div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">next action · ' + esc(policy.state) + '</div><h2>' + esc(policy.title) + '</h2>' +
    '<div class="nar">' + esc(policy.detail) + '</div>' + blockers + cautions;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(policy.state === 'ready' ? 'medium' : 'light');
}
function openDecisionContextBox(env, index){
  const row = decisionContextCards(env)[index] || decisionContextCards(env)[0];
  const evidence = row.evidence.length
    ? '<div class="kv">' + row.evidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '<div class="nar">no served evidence rows for this decision signal; it remains context, not policy authority.</div>';
  $('sheetBody').innerHTML = '<div class="arc">decision context · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>scope</b><span>' + esc(row.scope || 'tenant-only') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span></div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openLiveProofSummaryBox(env){
  const live = env.liveProof || {};
  const rows = liveProofCards(env);
  const summary = live.summary || {};
  const total = Number.isFinite(Number(summary.total)) ? Number(summary.total) : rows.length;
  const ready = Number.isFinite(Number(summary.ready)) ? Number(summary.ready) : rows.filter(row => row.state === 'ready').length;
  const blocked = Number.isFinite(Number(summary.blocked)) ? Number(summary.blocked) : rows.filter(row => row.state !== 'ready').length;
  const liveProofReady = live.status === 'ready' || summary.liveProofReady === true;
  const blockedRows = rows.filter(row => row.state !== 'ready').slice(0, 6);
  const blockedBlock = blockedRows.length
    ? '<div class="kv">' + blockedRows.map((row, i) => '<b>blocked row ' + (i + 1) + '</b><span>' + esc(row.title + ' · ' + row.detail) + '</span>').join('') + '</div>'
    : '<div class="nar">no blocked live-proof rows served.</div>';
  $('sheetBody').innerHTML = '<div class="arc">live proof summary · ' + esc(liveProofReady ? 'ready' : 'blocked') + '</div><h2>Live Proof Summary</h2>' +
    '<div class="nar">' + esc(live.invariant || 'capture plan is guidance, not proof') + '</div>' +
    '<div class="kv"><b>ready</b><span>' + ready + '</span><b>blocked</b><span>' + blocked + '</span><b>total</b><span>' + total + '</span><b>liveProofReady</b><span>' + esc(String(liveProofReady)) + '</span><b>source</b><span>' + esc(live.source || 'missing') + '</span></div>' + blockedBlock;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(liveProofReady ? 'medium' : 'light');
}
function openTapestryBox(env, index){
  const row = tapestryRows(env)[index] || tapestryRows(env)[0];
  if (row.id === 'wake-health') {
    const wake = wakeSteps(env);
    const firstMissing = wake.findIndex(step => !step.done);
    openWakeBox(env, firstMissing >= 0 ? firstMissing : 0);
    return;
  }
  if (row.id === 'evidence-boxes') {
    const boxes = insightBoxes(env);
    const firstWait = boxes.findIndex(box => box.state !== 'ready');
    openInsightBox(env, firstWait >= 0 ? firstWait : 0);
    return;
  }
  if (row.id === 'priority-signals') {
    const decisions = decisionContextCards(env);
    const firstPriority = decisions.findIndex(item => item.source === 'operator-priority-signals');
    openDecisionContextBox(env, firstPriority >= 0 ? firstPriority : 0);
    return;
  }
  if (row.id === 'coordination-source') {
    const socials = socialCards(env);
    const firstReady = socials.findIndex(item => item.state === 'ready');
    openSocialBox(env, firstReady >= 0 ? firstReady : 0);
    return;
  }
  if (row.id === 'npc-history' || row.id === 'mira-relationship') {
    const npcs = npcCards(env);
    const miraIndex = npcs.findIndex(npc => String(npc.title || '').toUpperCase() === 'MIRA');
    openNpcBox(env, miraIndex >= 0 ? miraIndex : 0);
    return;
  }
  if (row.id === 'command-state' && !env.commands) { openCmdSheet('status'); return; }
  if (row.id === 'live-proof') { openLiveProofSummaryBox(env); return; }
  if (row.id === 'decision-context') {
    const firstMissing = decisionContextCards(env).findIndex(item => item.state !== 'ready');
    openDecisionContextBox(env, firstMissing >= 0 ? firstMissing : 0);
    return;
  }
  const freshness = row.id === 'freshness-gaps'
    ? '<b>derivedAt</b><span>' + esc(env.derivedAt || 'missing') + '</span><b>stale threshold</b><span>360 minutes</span><b>refresh command</b><span>quine write quests push --tenant ' + esc(TENANT) + '</span>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">completion definition · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>ecosystem target</b><span>' + esc(tapestryTarget(row)) + '</span><b>requirement</b><span>' + esc(row.id || 'tapestry-row') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span>' + freshness + '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openSideQuestBox(env, index){
  const side = sideQuestCards(env)[index] || sideQuestCards(env)[0];
  const runtime = side.runtime || { source:'missing', status:side.status || 'triggered', total:0, proof:'no operator side-quest events served', rows:[] };
  const canQueue = side.state === 'ready' && ['refresh', 'founder-review', 'collect-evidence'].includes(String(side.action.kind || ''));
  const historyRows = Array.isArray(runtime.rows) && runtime.rows.length
    ? '<div class="kv">' + runtime.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.status || 'queued') + ' · ' + (row.source || runtime.source || 'missing') + ' · ' + (row.detail || row.proof || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no operator side-quest events served; this branch is only a trigger predicate.</div>';
  const action = canQueue
    ? '<div class="gbtns sideq"><button type="button" class="approve" data-queue-side-quest="1">Queue side quest</button></div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">side quest · ' + esc(side.state) + '</div><h2>' + esc(side.title) + '</h2>' +
    '<div class="nar">' + esc(side.detail) + '</div>' +
    '<div class="kv"><b>owner</b><span>' + esc(side.owner) + '</span><b>action</b><span>' + esc(side.action.label || side.action.kind || 'inspect') + '</span><b>target</b><span>' + esc(side.action.target || 'unknown') + '</span><b>lifetime</b><span>' + esc(side.lifetime.detail || 'lifetime not served') + '</span><b>completion</b><span>' + esc(side.completion.proof || 'completion proof not served') + '</span><b>queue effect</b><span>queued action only; side quest ledger and registry remain unchanged until the operator consumes the queued action</span><b>trigger</b><span>' + esc(side.trigger) + '</span><b>origin</b><span>' + esc(side.origin || 'unknown') + '</span><b>proof</b><span>' + esc(side.proof) + '</span><b>side quest history</b><span>' + esc((runtime.source || 'missing') + ' · ' + (runtime.status || side.status || 'triggered') + ' · ' + Number(runtime.total || 0) + ' event(s)') + '</span><b>history proof</b><span>' + esc(runtime.proof || 'runtime proof missing') + '</span></div>' + action + historyRows;
  const queue = $('sheetBody').querySelector('[data-queue-side-quest]');
  if (queue) queue.onclick = () => sideQuestAct(side, queue);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(side.state === 'ready' ? 'medium' : 'light');
}
function openSocialBox(env, index){
  const row = socialCards(env)[index] || socialCards(env)[0];
  const evidence = row.evidence.length
    ? '<div class="kv">' + row.evidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '<div class="nar">no coordination evidence rows served; the map keeps this as an explicit gap.</div>';
  $('sheetBody').innerHTML = '<div class="arc">coordination · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>scope</b><span>' + esc(row.scope || 'tenant-handoff-only') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span></div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openLiveProofBox(env, index){
  const row = liveProofCards(env)[index] || liveProofCards(env)[0];
  const prereqs = row.prerequisites.length
    ? '<div class="kv">' + row.prerequisites.slice(0, 14).map((item, i) => '<b>prereq ' + (i + 1) + '</b><span>' + esc((item.label || 'prerequisite') + ' · ' + (item.status || 'blocked') + ' · ' + (item.detail || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no prerequisites served; run the readiness command before capture.</div>';
  const privacy = row.privacy.length
    ? '<div class="kv">' + row.privacy.slice(0, 5).map((item, i) => '<b>privacy ' + (i + 1) + '</b><span>' + esc(item) + '</span>').join('') + '</div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">capture plan · not proof · ' + esc(row.rawState || row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>writes</b><span>' + esc(row.writes || 'receipt path missing') + '</span><b>command</b><span>' + esc(row.command || 'npm run proof:tg-live-readiness') + '</span><b>invariant</b><span>' + esc(row.invariant || 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.') + '</span><b>proof rule</b><span>' + esc(row.proof || row.detail) + '</span></div>' + prereqs + privacy;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row.state === 'ready' ? 'medium' : 'light');
}
function openInsightBox(env, index){
  const box = insightBoxes(env)[index] || insightBoxes(env)[0];
  const servedEvidence = Array.isArray(box.evidence) ? box.evidence : [];
  const evidence = servedEvidence.length
    ? '<div class="kv">' + servedEvidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '';
  const rowSource = box.source && box.source !== box.insightSource
    ? '<b>row source</b><span>' + esc(box.source) + '</span>'
    : '';
  const missingSource = box.state === 'ready'
    ? ''
    : '<b>missing insight source</b><span>' + esc(box.missingSource || box.insightSource || box.source || 'missing') + '</span>';
  $('sheetBody').innerHTML = '<div class="arc">evidence box · ' + esc(box.state) + '</div><h2>' + esc(box.title) + '</h2>' +
    '<div class="nar">' + esc(box.detail) + '</div><div class="kv"><b>source</b><span>' + esc(box.insightSource || box.source || 'missing') + '</span>' + rowSource + '<b>origin</b><span>' + esc(box.origin || 'unknown') + '</span><b>proof</b><span>' + esc(box.proof || box.detail) + '</span>' + missingSource + '</div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(box.state === 'ready' ? 'medium' : 'light');
}
function openSkillBox(env, index){
  const skill = skillCards(env)[index] || skillCards(env)[0];
  const agent = skill.agentSkill || null;
  const canPromote = canQueueSkillPromotion(skill);
  const consequence = canPromote ? skillPromotionConsequence(skill) : 'no production change from this sheet; skill registry remains the authority';
  const reversibility = canPromote ? skillPromotionReversibility() : 'no queued action is created; refresh the registry through quine write skills';
  const idempotencyKey = canPromote ? skillPromotionIdempotency(skill) : 'not queued';
  const founderApproval = canPromote
    ? 'required before production; operator consumer re-checks telemetry'
    : (skill.promotion && skill.promotion.requiredApproval ? 'blocked until telemetry is production-ready; founder approval is still required before production' : 'not required for this read-only state');
  const gap = skill.state === 'wait'
    ? '<div class="nar">gap action · ' + esc(skill.gapAction || ('.operator/' + TENANT + '.skills.json · quine write skills forge --tenant ' + TENANT)) + '</div>'
    : '';
  const caution = skill.tier === 'declining'
    ? '<div class="nar">caution · declining skills cannot be promoted from the mini app; record new successful uses before founder review.</div>'
    : '';
  const readOnly = !canPromote
    ? '<div class="nar">read-only · skill registry remains the authority; no founder review is queued from this state.</div>'
    : '';
  const action = canPromote
    ? '<div class="gbtns promote"><button type="button" class="approve" data-promote-skill="1">Queue founder review</button></div>'
    : '';
  const loadout = agent ? renderAgentSkillLoadout(agent) : '';
  $('sheetBody').innerHTML = '<div class="arc">skill labor · ' + esc(skill.state) + '</div><h2>' + esc(skill.title) + '</h2>' +
    '<div class="nar">' + esc(skill.detail) + '</div><div class="kv"><b>status</b><span>' + esc(skill.status || 'unknown') + '</span><b>tier</b><span>' + esc(skill.tierLabel || skill.tier || 'missing') + '</span><b>uses</b><span>' + esc(skill.uses ?? 0) + '</span><b>success rate</b><span>' + esc(skill.successRateText || '0%') + '</span><b>recent rate</b><span>' + esc(skill.recentRateText || '0%') + '</span><b>sample minimum</b><span>' + esc(skill.sampleMinimum || '0/3 uses') + '</span><b>promotion status</b><span>' + esc(skill.promotionStatus || 'blocked') + '</span><b>source path</b><span>' + esc(skill.sourcePath || ('.operator/' + TENANT + '.skills.json')) + '</span><b>registry proof</b><span>' + esc(skill.registryProof || skill.sourcePath || ('.operator/' + TENANT + '.skills.json')) + '</span></div>' + loadout + '<div class="kv"><b>consequence</b><span>' + esc(consequence) + '</span><b>reversibility</b><span>' + esc(reversibility) + '</span><b>idempotency key</b><span>' + esc(idempotencyKey) + '</span><b>founder approval</b><span>' + esc(founderApproval) + '</span></div>' + gap + caution + readOnly + action;
  const promote = $('sheetBody').querySelector('[data-promote-skill]');
  if (promote) promote.onclick = () => skillPromotionAct(skill, promote);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(skill.state === 'ready' ? 'medium' : 'light');
}
function renderAgentSkillLoadout(agent){
  const roles = agentSkillRoles(agent);
  const actionGroups = Array.isArray(agent.actionGroups) && agent.actionGroups.length
    ? '<div class="kv">' + agent.actionGroups.slice(0, 6).map(group => '<b>' + esc(group.label || group.id) + '</b><span>' + esc((group.state || 'future') + ' · ' + (Array.isArray(group.actionIds) ? group.actionIds.join(', ') : '') + (group.purpose ? ' · ' + group.purpose : '')) + '</span>').join('') + '</div>'
    : '';
  const roleRows = roles.length
    ? '<div class="kv">' + roles.slice(0, 8).map(role => '<b>' + esc(role.roleId) + '</b><span>v' + esc(role.version || 'unknown') + ' · ' + esc(role.permissions || 'no permissions') + ' · ' + esc(role.commands || 'no commands') + (role.purpose ? ' · ' + esc(role.purpose) : '') + '</span>').join('') + '</div>'
    : '<div class="nar">no role subsets served for this agent skill.</div>';
  const boundaries = Array.isArray(agent.boundaries) && agent.boundaries.length
    ? '<div class="kv">' + agent.boundaries.slice(0, 5).map((boundary, i) => '<b>boundary ' + (i + 1) + '</b><span>' + esc(boundary) + '</span>').join('') + '</div>'
    : '';
  return '<div class="kv"><b>domain</b><span>' + esc(agent.domain || 'unknown') + '</span><b>game layer</b><span>' + esc(agent.gameLayer || 'unknown') + '</span><b>loadout version</b><span>' + esc(agent.version || 'unknown') + '</span><b>skill id</b><span>' + esc(agent.skillId || 'unknown') + '</span><b>mini app area</b><span>' + esc(agent.miniAppArea || 'skills') + '</span><b>registry target</b><span>' + esc(agent.registryTarget || '.operator/<tenant>.skills.json') + '</span><b>invocations</b><span>' + esc(Array.isArray(agent.invocationKinds) ? agent.invocationKinds.join(', ') : 'none') + '</span><b>branches</b><span>' + esc(Array.isArray(agent.branches) ? agent.branches.join(', ') : 'none') + '</span><b>read commands</b><span>' + esc(Array.isArray(agent.readCommands) ? agent.readCommands.join(', ') : 'none') + '</span><b>write commands</b><span>' + esc(Array.isArray(agent.writeCommands) ? agent.writeCommands.join(', ') : 'none') + '</span></div>' + actionGroups + roleRows + boundaries;
}
function openNpcBox(env, index){
  const npc = npcCards(env)[index] || npcCards(env)[0];
  const stage = npc.stage || { id:'missing', label:'MISSING', detail:'relationship stage not served', confidence:0 };
  const advice = npc.advice || { status:'blocked', label:'NO ADVICE', detail:'no durable NPC advice event served', proof:'no durable NPC events served', action:{ kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' } };
  const history = npc.history || { source:'missing', total:0, contradictions:0, rows:[] };
  const confidence = Math.round(Number(stage.confidence || 0) * 100);
  const adviceAction = advice.action || { kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' };
  const events = Array.isArray(npc.events) && npc.events.length
    ? '<div class="kv">' + npc.events.slice(0, 4).map((event, i) => '<b>event ' + (i + 1) + '</b><span>' + esc((event.id || 'event') + ' · ' + (event.kind || 'unknown') + ' · ' + (event.source || 'missing') + ' · ' + (event.detail || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no relationship events served; the companion remains an explicit evidence gap.</div>';
  const contradictionBlock = Number(history.contradictions || 0) > 0
    ? '<div class="nar">advice is blocked by contradiction; review target ' + esc(adviceAction.target || 'npc') + '</div>'
    : '';
  const adviceBlock = '<div class="kv"><b>advice</b><span>' + esc((advice.label || 'NO ADVICE') + ' · ' + (advice.detail || 'no durable NPC advice event served')) + '</span><b>advice proof</b><span>' + esc(advice.proof || 'advice proof missing') + '</span><b>advice action</b><span>' + esc((adviceAction.kind || 'review') + ' · ' + (adviceAction.label || 'Review') + ' · ' + (adviceAction.target || 'npc')) + '</span><b>review target</b><span>' + esc(adviceAction.target || 'npc') + '</span></div>';
  const historyRows = Array.isArray(history.rows) && history.rows.length
    ? '<div class="kv">' + history.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.kind || 'note') + ' · ' + (row.source || history.source || 'missing') + ' · ' + (row.detail || row.evidence || 'detail missing')) + '</span>').join('') + '</div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">companion · ' + esc(npc.state) + '</div><h2>' + esc(npc.title) + '</h2>' +
    '<div class="nar">' + esc(npc.detail) + '</div><div class="kv"><b>stage</b><span>' + esc((stage.label || 'MISSING') + ' · ' + (stage.detail || 'relationship stage not served') + ' · ' + confidence + '% confidence') + '</span><b>ecosystem targets</b><span>' + esc((npc.ecosystemTargets || ['operator-npc-events']).join(' · ')) + '</span><b>scope</b><span>' + esc(npc.scope || 'missing') + '</span><b>proof</b><span>' + esc(npc.proof || npc.detail) + '</span><b>event count</b><span>' + esc(Number(history.total || 0)) + '</span><b>contradiction count</b><span>' + esc(Number(history.contradictions || 0)) + '</span><b>history</b><span>' + esc((history.source || 'missing') + ' · ' + Number(history.total || 0) + ' event(s) · ' + Number(history.contradictions || 0) + ' contradiction(s)') + '</span></div>' + adviceBlock + contradictionBlock + events + historyRows;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(npc.state === 'ready' ? 'medium' : 'light');
}

/* ── story scene — cards with per-lane icons ── */
const LANE_ICON = {
  heartbeat: '<svg viewBox="0 0 16 16"><path d="M1 8h3l2-4 3 8 2-4h4"/></svg>',
  paperclip: '<svg viewBox="0 0 16 16"><path d="M5.5 4.5v6a2.5 2.5 0 0 0 5 0V4a1.8 1.8 0 0 0-3.6 0v6.1"/></svg>',
  forge:     '<svg viewBox="0 0 16 16"><path d="M2 11l6-7 6 7"/><path d="M2 11h12"/></svg>',
  noesis:    '<svg viewBox="0 0 16 16"><path d="M8 1.5l5.5 6.5L8 14.5 2.5 8z"/></svg>',
  quest:     '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 6.5-7"/></svg>',
  beat:      '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.6"/></svg>'
};
let STORY_BEATS = [];
let STORY_GROUP_FILTER = 'all';
function storyBeatTarget(lane){
  if (lane === 'heartbeat') return 'quine';
  if (lane === 'paperclip') return 'paperclip';
  if (lane === 'forge') return 'operator-skills';
  if (lane === 'noesis') return 'operator-narrative';
  if (lane === 'quest') return 'quest-ledger';
  return 'operator-narrative';
}
function storyBeatSource(beat, lane){
  if (beat && beat.source) return beat.source;
  if (lane === 'paperclip') return 'paperclipActivityBeats';
  if (lane === 'quest') return 'quest-ledger';
  if (lane === 'heartbeat') return 'world.log';
  return 'operator-narrative';
}
function storyLaneLabel(lane, beat){
  if (beat && beat.noesis) return 'Drift';
  if (lane === 'quest') return 'Mission wins';
  if (lane === 'heartbeat' || lane === 'paperclip') return 'New signals';
  if (lane === 'forge') return 'Lessons';
  if (lane === 'noesis') return 'Drift';
  return 'New signals';
}
function storyBeatGroup(beat){
  const text = String((beat && beat.text) || '');
  const lane = (beat && beat.lane) || (beat && beat.noesis ? 'noesis' : 'beat');
  if ((beat && beat.noesis) || /stale|missing|contradict|blocked|drift/i.test(text)) return 'Drift';
  return storyLaneLabel(lane, beat);
}
function storyBeatState(beat){
  const group = storyBeatGroup(beat);
  if (group === 'Mission wins') return 'complete';
  if (group === 'Drift') return /blocked|contradict/i.test(String((beat && beat.text) || '')) ? 'blocked' : 'stale';
  if (group === 'Lessons') return 'active';
  return 'proof-needed';
}
function storyBeatGlyph(group){
  if (group === 'Mission wins') return 'proof';
  if (group === 'Lessons') return 'cortex';
  if (group === 'Drift') return 'gate';
  return 'arc';
}
function storyBeatContext(group, lane, beat){
  const text = String((beat && beat.text) || '');
  if (/gate|approve|reroll|decision/i.test(text)) return 'gate';
  if (/tool|command|\\/ts-|ts-/i.test(text)) return 'tools';
  if (group === 'Mission wins') return 'mission';
  if (group === 'Drift') return 'inspect';
  if (lane === 'quest') return 'mission';
  return 'inspect';
}
function storyContextScene(context){
  if (context === 'mission') return 0;
  if (context === 'gate') return 1;
  if (context === 'tools') return 2;
  if (context === 'story') return 3;
  return 4;
}
function renderStoryHero(beats){
  const latest = beats[0] || { text:'Story is waiting for mission movement', lane:'beat' };
  const group = storyBeatGroup(latest);
  return '<section class="story-hero" data-component="StoryLatestChangeHero">' +
    mcGlyphSvg(storyBeatGlyph(group), storyBeatState(latest)) +
    '<span><b>Latest change</b><small>' + esc(latest.text || 'Story beat text missing') + '</small></span>' +
  '</section>';
}
function renderStoryGroupControls(groups){
  const labels = ['all'].concat(groups);
  return '<div class="story-filter-strip" data-component="StoryGroupControls">' + labels.map(label =>
    '<button type="button" class="' + (STORY_GROUP_FILTER === label ? 'is-selected' : '') + '" data-story-filter="' + esc(label) + '">' + esc(label) + '</button>'
  ).join('') + '</div>';
}
function renderStoryTimeline(beats){
  return '<div class="story-timeline" data-component="StoryTimelineRail">' + beats.slice(0, 12).map(beat =>
    '<i class="is-' + esc(mcStateKind(storyBeatState(beat))) + '"></i>'
  ).join('') + '</div>';
}
function renderStoryBranchFilters(env){
  const branches = branchRows(env || {});
  if (!branches.length) return '<div class="story-filter-strip" data-component="StoryBranchFilterChips"><button type="button" class="is-selected" data-story-branch-filter="all">all branches</button><button type="button" data-story-branch-filter="missing">branch packets pending</button></div>';
  return '<div class="story-filter-strip" data-component="StoryBranchFilterChips"><button type="button" class="is-selected" data-story-branch-filter="all">all branches</button>' + branches.slice(0, 5).map(branch =>
    '<button type="button" data-story-branch-filter="' + esc(branch.branchId || branch.productId || branch.name || 'branch') + '">' + esc(branch.name || branch.branchId || 'branch') + '</button>'
  ).join('') + '</div>';
}
function renderStoryDigest(beats){
  const counts = ['Mission wins', 'New signals', 'Lessons', 'Drift'].map(group => [group, beats.filter(beat => storyBeatGroup(beat) === group).length]);
  return '<section class="story-hero" data-component="StoryDigestCards">' +
    mcGlyphSvg('proof', 'active') +
    '<span><b>Digest</b><small>' + counts.map(([group, count]) => group + ' ' + count).join(' · ') + '</small></span>' +
  '</section>';
}
function storyPacketTrail(beat){
  const group = storyBeatGroup(beat);
  const count = group === 'Mission wins' ? 4 : group === 'Drift' ? 2 : 3;
  return '<span data-component="StoryPacketTrail">' + mcPacketDots(count, storyBeatState(beat), { mode:'rail' }) + '</span>';
}
function openStoryBeat(index){
  const beat = STORY_BEATS[index] || STORY_BEATS[0];
  if (!beat) return;
  const lane = beat.lane || (beat.noesis ? 'noesis' : 'beat');
  const source = storyBeatSource(beat, lane);
  const target = storyBeatTarget(lane);
  const group = storyBeatGroup(beat);
  const context = storyBeatContext(group, lane, beat);
  const warning = /contradict/i.test(String(beat.text || ''))
    ? '<b>warning</b><span>contradiction requires Inspect review before this becomes a win</span>'
    : '';
  const paperclipRows = lane === 'paperclip'
    ? '<b>vault write</b><span>no direct vault write; Paperclip activity is read-only in this sheet</span>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">story beat · ' + esc(group.toLowerCase()) + '</div><h2>Story Beat</h2>' +
    '<div class="nar">' + esc(beat.text || 'story beat text missing') + '</div>' +
    '<div class="kv"><b>group</b><span>' + esc(group) + '</span><b>lane</b><span>' + esc(lane) + '</span><b>text</b><span>' + esc(beat.text || 'missing') + '</span><b>source</b><span>' + esc(source) + '</span><b>ecosystem target</b><span>' + esc(target) + '</span><b>context link</b><span>' + esc(context) + '</span><b>action</b><span>read-only story row; no execution action</span>' + warning + paperclipRows + '</div>' +
    '<div class="gbtns"><button type="button" data-story-target="' + esc(context) + '">' + esc(context === 'mission' ? 'Open Mission' : context === 'gate' ? 'Open Gate' : context === 'tools' ? 'Open Tools' : 'Open Inspect') + '</button></div>';
  $('sheetBody').querySelectorAll('[data-story-target]').forEach(el => el.onclick = () => {
    veil.classList.remove('on'); sheet.classList.remove('on'); sheetState.open = false;
    go(storyContextScene(el.dataset.storyTarget), true);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(lane === 'noesis' || lane === 'paperclip' ? 'medium' : 'light');
}
function renderStory(env){
  const served = env.beats && env.beats.length;
  const beats = served ? env.beats :
    env.ledger.rows.filter(r => r.status === 'complete').map(r => ({ text: r.title + ' — ' + r.evidence, lane: 'quest', noesis: false, source: 'quest-ledger' }));
  STORY_BEATS = beats;
  if (!beats.length) {
    $('beats').innerHTML = '<div class="state" data-interaction-kind="read-only" data-source="mission-story@v1" data-ecosystem-target="operator-narrative"><b>Story is waiting for mission movement.</b><p>New wins, signals, lessons, and drift appear here after evidence lands.</p><div class="gbtns"><button type="button" data-story-empty-action="mission">Mission</button><button type="button" class="reroll" data-story-empty-action="inspect">Inspect</button></div></div>';
    $('beats').querySelectorAll('[data-story-empty-action]').forEach(el => el.onclick = () => go(el.dataset.storyEmptyAction === 'mission' ? 0 : 4));
    return;
  }
  const groups = ['Mission wins', 'New signals', 'Lessons', 'Drift'].map(group => ({
    group,
    beats: beats.map((beat, index) => ({ beat, index })).filter(row => storyBeatGroup(row.beat) === group),
  })).filter(row => row.beats.length && (STORY_GROUP_FILTER === 'all' || STORY_GROUP_FILTER === row.group));
  const allGroups = ['Mission wins', 'New signals', 'Lessons', 'Drift'].filter(group => beats.some(beat => storyBeatGroup(beat) === group));
  $('beats').innerHTML = renderStoryHero(beats) + renderStoryGroupControls(allGroups) + renderStoryBranchFilters(env) + renderStoryDigest(beats) + renderStoryTimeline(beats) + (groups.length ? groups.map(({ group, beats: groupBeats }) =>
    '<section class="story-group" data-component="StoryGroup" data-story-group="' + esc(group.toLowerCase().replace(/\\s+/g, '-')) + '">' +
    '<div class="cmdgrp">' + esc(group) + '</div><div class="story-group-body">' +
    groupBeats.map(({ beat:b, index:i }) => {
    const lane = b.lane || 'beat';
    const state = storyBeatState(b);
    const context = storyBeatContext(group, lane, b);
    const contradiction = /contradict/i.test(String(b.text || ''));
    return '<button type="button" class="' + mcClass('beat' + (b.noesis ? ' noesis' : ''), state) + '" style="--i:' + Math.min(i, 20) + '" data-component="StoryBeatCard" data-interaction-kind="sheet" data-source="mission-story@v1" data-beat="' + i + '" data-lane="' + esc(lane) + '" data-story-context="' + esc(context) + '" data-ecosystem-target="operator-narrative"' + (contradiction ? ' data-story-warning="contradiction"' : '') + '>' +
      '<span class="ico">' + mcGlyphSvg(storyBeatGlyph(group), state) + '</span>' +
      '<span class="lane">' + esc(group) + '</span>' +
      '<b>' + esc(b.text || 'Story beat') + '</b>' +
      storyPacketTrail(b) +
      mcStateToken(state, group === 'Drift' ? 'drift' : group === 'Mission wins' ? 'win' : group === 'Lessons' ? 'lesson' : 'signal') +
    '</button>';
    }).join('') + '</div></section>'
  ).join('') : '<div class="state"><b>No story beats in this group.</b><p>Switch groups or refresh after new branch evidence lands.</p></div>');
  $('beats').querySelectorAll('[data-story-filter]').forEach(el => el.onclick = () => {
    STORY_GROUP_FILTER = el.dataset.storyFilter || 'all';
    renderStory(env);
  });
  $('beats').querySelectorAll('.beat').forEach(el => el.onclick = () => openStoryBeat(+el.dataset.beat));
}

/* ── freshness ── */
function markFreshnessChip(source){
  const f = $('fresh');
  f.dataset.interactionKind = 'sheet';
  f.dataset.source = source || 'missing';
}
function freshness(env){
  const f = $('fresh');
  const iso = env && env.derivedAt;
  const mins = minutesSince(iso);
  const stale = mins === null || mins > 360;
  const source = (env && env.source) || 'missing';
  FRESHNESS_STATE = {
    derivedAt: iso || 'missing',
    source,
    age: mins,
    stale,
    detail: mins === null ? 'freshness missing' : mins < 2 ? 'derived just now' : mins < 60 ? 'derived ' + mins + 'm ago' : 'derived ' + Math.round(mins / 60) + 'h ago',
  };
  f.textContent = FRESHNESS_STATE.detail;
  markFreshnessChip(source);
  f.classList.toggle('stale', stale);
}
function envelopeTime(env){
  const value = env && env.derivedAt;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function shouldPaintEnvelope(nextEnv){
  const currentTime = envelopeTime(ECOSYSTEM_ENV);
  const nextTime = envelopeTime(nextEnv);
  return currentTime === null || nextTime === null || nextTime >= currentTime;
}
function markStaleRefreshIgnored(nextEnv){
  const current = ECOSYSTEM_ENV || {};
  const f = $('fresh');
  FRESHNESS_STATE = {
    derivedAt: current.derivedAt || 'missing',
    source: (nextEnv && nextEnv.source) || (current && current.source) || REFRESH_ROUTE,
    age: minutesSince(current.derivedAt),
    stale: true,
    detail: 'stale refresh ignored',
  };
  f.textContent = FRESHNESS_STATE.detail;
  markFreshnessChip(FRESHNESS_STATE.source);
  f.classList.add('stale');
}
function openFreshnessSheet(){
  const s = FRESHNESS_STATE;
  $('sheetBody').innerHTML = '<div class="arc">freshness · ' + (s.stale ? 'stale' : 'fresh') + '</div><h2>Freshness</h2>' +
    '<div class="nar">' + (s.stale ? 'stale data is not live proof' : 'fresh envelope data can support the current read-only view') + '</div>' +
    '<div class="kv"><b>derivedAt</b><span>' + esc(s.derivedAt) + '</span><b>source</b><span>' + esc(s.source) + '</span><b>stale threshold</b><span>360 minutes</span><b>refresh command</b><span>quine write quests push --tenant cambium</span><b>pull refresh</b><span>re-fetches ' + esc(REFRESH_ROUTE) + ' and does not write operator state</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
$('fresh').onclick = openFreshnessSheet;

/* ── data ── */
// radial 270deg gauge of real progress (arcs grown / total) — the gate's evidence dial
function renderGauge(L){
  const wrap = $('gauge'); if (!wrap) return;
  const completed = Math.max(0, Number(L && L.completed) || 0);
  const total = Math.max(0, Number(L && L.total) || 0);
  const pct = total ? Math.min(1, completed / total) : 0;
  const state = total && completed >= total ? 'complete' : completed ? 'active' : 'locked';
  const label = state === 'complete' ? 'Queue clear' : state === 'active' ? 'Evidence growing' : 'Awaiting ledger';
  const r = 46, CIRC = 2 * Math.PI * r, ARC = 0.75;       // 270deg sweep
  const track = N1(ARC * CIRC), tgap = N1(CIRC - ARC * CIRC);
  const val = N1(pct * ARC * CIRC), vgap = N1(CIRC - pct * ARC * CIRC);
  const valCircle = RM
    ? '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + val + ' ' + vgap + '"/>'
    : '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 ' + N1(CIRC) + '">' +
        '<animate attributeName="stroke-dasharray" dur="1s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1" values="0 ' + N1(CIRC) + ';' + val + ' ' + vgap + '"/>' +
      '</circle>';
  wrap.innerHTML =
    '<div class="' + mcClass('gate-orbit', state) + '" data-component="GateOrbitProgress" data-shared-component="OrbitProgress" data-gate-orbit-state="' + esc(state) + '" data-state="' + esc(mcStateKind(state)) + '" data-value="' + Math.round(pct * 100) + '">' +
      '<svg viewBox="0 0 120 126" role="img" aria-label="' + esc(completed + ' of ' + total + ' arcs grown') + '">' +
        '<g transform="rotate(135 60 60)">' +
          '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="rgba(214,255,246,.12)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + track + ' ' + tgap + '"/>' +
          valCircle +
        '</g>' +
        '<circle class="gate-orbit-node" cx="22" cy="94" r="4"/>' +
        '<circle class="gate-orbit-node" cx="60" cy="14" r="4"/>' +
        '<circle class="gate-orbit-node" cx="98" cy="94" r="4"/>' +
        '<text class="gv" x="60" y="60" text-anchor="middle">' + completed + '/' + total + '</text>' +
        '<text class="gl" x="60" y="76" text-anchor="middle">ARCS GROWN</text>' +
      '</svg>' +
      '<div class="gate-orbit-caption">' + mcStateToken(state, label) + '</div>' +
    '</div>';
}
function paint(env){
  ECOSYSTEM_ENV = env;
  LEDGER = env.ledger;
  CMDDATA = env.commands || null;
  renderMissionControl(env);
  if (SCENE_PARAM === 'components' || SCENE_PARAM === 'component' || SCENE_PARAM === 'board') renderComponentGallery(env);
  else renderOperatorMap(env);
  renderStory(env); renderGauge(env.ledger); freshness(env);
}
function load(){
  return fetch(REFRESH_ROUTE).then(r => r.json()).then(env => {
    if (!shouldPaintEnvelope(env)){
      markStaleRefreshIgnored(env);
      return;
    }
    if (!env.ledger){
      ECOSYSTEM_ENV = env;
      LEDGER = null;
      $('stem').innerHTML =
        '<div class="state"><b>no ledger yet</b><p>the garden is unplanted for <strong>' + esc(TENANT) + '</strong>. No quest rows are rendered until a real ledger arrives.</p><code>quine write quests push --tenant ' + esc(TENANT) + '</code></div>';
      FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'empty ledger' };
      markFreshnessChip('missing');
      resetQuestSummary('empty ledger', 'push required');
      $('fresh').textContent = 'empty'; $('fresh').classList.add('stale'); return;
    }
    paint(env);
  }).catch(() => {
    ECOSYSTEM_ENV = null;
    LEDGER = null;
    $('stem').innerHTML =
      '<div class="state"><b>ledger unreachable</b><p>the mycelium is quiet — pull down to retry. Retry re-fetches ' + esc(REFRESH_ROUTE) + ' and performs no local write.</p></div>';
    FRESHNESS_STATE = { derivedAt:'missing', source:REFRESH_ROUTE, age:null, stale:true, detail:'offline' };
    markFreshnessChip(REFRESH_ROUTE);
    resetQuestSummary('ledger offline', 'retry fetch');
    $('fresh').textContent = 'offline'; $('fresh').classList.add('stale');
  });
}
function refresh(){ return load(); }
go(START_SCENE, true);
load();
</script>
</body>
</html>`;
