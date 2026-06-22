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
<title>curios.self · quest log</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:#00272B; --bg2:#012F34; --ink:#E0FF4F; --soft:#D6FFF6; --violet:#231651;
    --line:rgba(214,255,246,.09); --line2:rgba(214,255,246,.16); --glass:rgba(1,47,52,.72);
    --warn:#F8B560;
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
  /* mycelium substrate — fixed, non-scrolling, pointer-inert. Slow mesh blobs
     (transform-only) + static grain veil. Dead under reduced-motion. */
  .substrate{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0}
  .blob{position:absolute;width:130vw;height:130vw;border-radius:50%;opacity:.55;will-change:transform}
  .blob.a{left:-40vw;top:-55vw;
    background:radial-gradient(circle at 60% 60%,rgba(224,255,79,.07),transparent 55%);
    animation:drift 46s var(--ease) infinite alternate}
  .blob.b{right:-55vw;bottom:-60vw;
    background:radial-gradient(circle at 40% 35%,rgba(35,22,81,.55),transparent 60%);
    animation:drift 61s var(--ease) infinite alternate-reverse}
  @keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(7vw,5vw) scale(1.08)}}
  .grain{position:absolute;inset:0;opacity:.05;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
  .app{position:relative;height:100dvh;display:flex;flex-direction:column;z-index:1}

  header{padding:calc(var(--sat) + 16px) 18px 10px;display:flex;justify-content:space-between;align-items:baseline}
  .brand{font-size:21px;font-weight:750;letter-spacing:-.02em}
  .brand small{display:block;font-size:11px;font-weight:400;opacity:.6;letter-spacing:.06em;margin-top:2px}
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

  nav{display:grid;grid-template-columns:repeat(5,1fr);position:relative;margin:6px 12px 0;
    border-bottom:1px solid var(--line)}
  nav button{appearance:none;background:none;border:0;color:var(--soft);opacity:.5;
    font:600 12px/1 inherit;letter-spacing:.01em;padding:12px 0;cursor:pointer;
    transition:opacity .3s var(--ease),color .3s var(--ease)}
  nav button.on{opacity:1;color:var(--ink)}
  nav button:active{transform:scale(.96)}
  .ind{position:absolute;bottom:-1px;left:0;width:20%;height:2px;background:var(--ink);
    border-radius:2px;transition:transform .45s var(--ease);box-shadow:0 0 8px rgba(224,255,79,.4)}

  /* ── commands panel ─────────────────────────── */
  .cmdgrp{font:10px var(--mono);letter-spacing:.1em;text-transform:uppercase;opacity:.45;margin:18px 0 9px}
  .cmdgrp:first-child{margin-top:4px}
  .cmd{display:flex;align-items:flex-start;gap:12px;padding:12px 13px;margin-bottom:8px;
    border:1px solid var(--line);border-radius:12px;background:rgba(1,47,52,.34)}
  .cmd .cnode{flex:none;width:8px;height:8px;border-radius:50%;margin-top:5px;
    background:var(--ink);box-shadow:0 0 7px rgba(224,255,79,.4)}
  .cmd.act .cnode{background:var(--soft);box-shadow:0 0 7px rgba(214,255,246,.3)}
  .cmd .cname{font:600 13.5px var(--mono);color:var(--ink)}
  .cmd.act .cname{color:var(--soft)}
  .cmd .cargs{font:11px var(--mono);opacity:.5;margin-left:6px}
  .cmd .cdesc{font-size:12.5px;opacity:.72;margin-top:2px;line-height:1.45}
  .cmd.live{cursor:pointer;transition:transform .2s var(--ease),border-color .3s var(--ease)}
  .cmd.live:active{transform:scale(.985)}
  .cmd.live{border-color:rgba(224,255,79,.22)}
  .cmd .cgo{margin-left:auto;align-self:center;font-size:20px;color:var(--ink);opacity:.6}
  .li{padding:9px 0;border-bottom:1px solid var(--line)}
  .li:last-child{border-bottom:0}
  .li .cname{font:600 13px var(--mono);color:var(--soft)}
  .li .cargs{font:10.5px var(--mono);color:var(--ink);opacity:.7;text-transform:uppercase}

  /* min-height:0 lets the flex track be constrained to its allocated height
     (not grow to content) so the scenes' overflow-y:auto actually scrolls. */
  .track{flex:1;min-height:0;display:flex;will-change:transform;touch-action:pan-y}
  .scene{flex:0 0 100%;width:100%;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;
    padding:18px 18px calc(var(--sab) + 92px);overscroll-behavior:contain}

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

  /* ── operator map — R3F mechanics, Telegram density ───── */
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes halo{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.045);opacity:.45}}
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
  #beats{position:relative;display:flex;flex-direction:column;gap:9px}
  #beats::before{content:"";position:absolute;left:-2px;top:8px;bottom:8px;width:1.5px;pointer-events:none;
    background:linear-gradient(rgba(224,255,79,.32),var(--line));opacity:.55}
  .beat{position:relative;padding:12px 14px 12px 44px;border:1px solid var(--line);border-radius:13px;
    background:rgba(1,47,52,.38);opacity:0;transform:translateY(10px);font-size:13.5px;line-height:1.5;
    animation:rise .5s var(--ease) forwards;animation-delay:calc(var(--i)*38ms)}
  .beat .ico{position:absolute;left:12px;top:11px;width:21px;height:21px;display:grid;place-items:center;
    border-radius:7px;background:var(--bg2);border:1px solid var(--line)}
  .beat .ico svg{width:12px;height:12px;stroke:var(--soft);fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.8}
  .beat .lane{display:block;font:9.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;opacity:.5;margin-bottom:3px}
  .beat b{color:var(--soft)}
  .beat.noesis{border-color:rgba(214,255,246,.4);background:var(--glass);backdrop-filter:blur(10px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 20px rgba(214,255,246,.05)}
  .beat.noesis .ico{border-color:rgba(214,255,246,.5)}
  .beat.noesis .ico svg{opacity:1}
  .beat.noesis .lane{color:var(--soft);opacity:.85}

  /* ── gate ───────────────────────────────────── */
  .gauge{display:grid;place-items:center;margin:6px 0 18px}
  .gauge svg{width:168px;overflow:visible}
  .gauge .gv{font:700 21px var(--mono);fill:var(--ink)}
  .gauge .gl{font:9.5px var(--mono);fill:var(--soft);opacity:.55;letter-spacing:.08em}
  .ghead{font-size:17px;font-weight:650;color:var(--ink);margin-bottom:2px}
  .gsub{font-size:12px;opacity:.7;margin-bottom:16px;max-width:52ch}
  .gitem{padding:13px;margin-bottom:12px;border:1px solid var(--line2);border-radius:14px;
    background:var(--glass);backdrop-filter:blur(8px);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
    opacity:0;transform:translateY(12px);animation:rise .5s var(--pop) forwards;animation-delay:calc(var(--i)*70ms)}
  .gitem .gid{font:11px var(--mono);color:var(--ink);opacity:.85}
  .gitem .gtitle{font-weight:600;margin:3px 0 10px}
  .gmeta{display:grid;grid-template-columns:88px 1fr;gap:4px 9px;margin:8px 0 11px;font-size:11.5px;line-height:1.35}
  .gmeta b{font:10px var(--mono);color:var(--ink);opacity:.72;text-transform:uppercase}
  .gmeta span{opacity:.74;overflow-wrap:anywhere}
  .gbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .gbtns button{appearance:none;border:0;border-radius:10px;padding:11px;font:600 13px inherit;cursor:pointer;
    transition:transform .2s var(--ease)}
  .gbtns button:active{transform:scale(.97)}
  .gbtns .approve{background:var(--ink);color:var(--bg)}
  .gbtns .reroll{background:none;border:1px solid rgba(214,255,246,.4);color:var(--soft)}
  .gnote{font:11px var(--mono);opacity:.6;margin-top:12px;line-height:1.5}

  /* ── sheet ──────────────────────────────────── */
  .veil{position:fixed;inset:0;background:rgba(0,20,23,.55);opacity:0;pointer-events:none;
    transition:opacity .35s var(--ease);z-index:10}
  .veil.on{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:11;padding:14px 20px calc(var(--sab) + 30px);
    background:var(--glass);backdrop-filter:blur(16px);
    border:1px solid var(--line2);border-bottom:0;border-radius:22px 22px 0 0;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 -18px 50px rgba(0,10,12,.45);
    transform:translateY(105%);transition:transform .5s var(--pop);will-change:transform;touch-action:none}
  .sheet.on{transform:translateY(0)}
  .grab{width:38px;height:4px;border-radius:99px;background:rgba(214,255,246,.25);margin:2px auto 16px}
  .sheet .arc{font:12px var(--mono);color:var(--ink);opacity:.9}
  .sheet h2{font-size:19px;letter-spacing:.01em;margin:4px 0 8px}
  .sheet .nar{opacity:.85;margin-bottom:12px;line-height:1.55}
  .kv{display:grid;grid-template-columns:84px 1fr;gap:7px 10px;font-size:13px}
  .kv b{font:11px var(--mono);opacity:.55;font-weight:500;letter-spacing:.05em;text-transform:uppercase;padding-top:2px}
  .kv span{font-family:var(--mono);font-size:12.5px;line-height:1.5}
  .status-complete,.status-active{color:var(--ink)} .status-locked{opacity:.6}

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

  footer{position:fixed;left:0;right:0;bottom:0;padding:10px 18px calc(var(--sab) + 14px);
    font:10.5px var(--mono);opacity:.5;background:linear-gradient(transparent,var(--bg) 45%);z-index:2;pointer-events:none}

  @media (prefers-reduced-motion: reduce){
    *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  }
</style>
</head>
<body>
<div class="substrate"><div class="blob a"></div><div class="blob b"></div><div class="grain"></div></div>
<div class="app">
  <header>
    <div class="brand">Quest Log<small>the infinite game · tenant <span id="ten">cambium</span></small></div>
    <button id="sceneBadge" type="button" class="chip scene-chip" data-interaction-kind="sheet" data-source="tg-miniapp-scenes@v1">Quests</button>
    <button id="fresh" type="button" class="chip" data-interaction-kind="sheet" data-source="missing">syncing</button>
  </header>
  <div class="ptr" id="ptr" data-refresh-route="/api/quests/cambium" data-refresh-writes="none"><div class="drop"></div><span id="ptrProof" class="ptr-proof">Pull to refresh re-fetches /api/quests/cambium and does not write operator state.</span></div>
  <nav>
    <button id="tb0" class="on" data-scene-source="tg-miniapp-scenes@v1">Quests</button>
    <button id="tb1" data-scene-source="tg-miniapp-scenes@v1">Map</button>
    <button id="tb2" data-scene-source="tg-miniapp-scenes@v1">Story</button>
    <button id="tb3" data-scene-source="tg-miniapp-scenes@v1">Gate</button>
    <button id="tb4" data-scene-source="tg-miniapp-scenes@v1">Commands</button>
    <div class="ind" id="ind"></div>
  </nav>
  <div class="track" id="track">
    <section class="scene" id="sceneQ" aria-labelledby="sceneQTitle">
      <h2 id="sceneQTitle" class="sr">Quests</h2>
      <div class="stem" id="stem">
        <div class="skel"></div><div class="skel"></div><div class="skel"></div>
        <div class="skel"></div><div class="skel"></div>
      </div>
      <div class="bar"><div id="fill" class="fill"></div></div>
      <div class="meta"><span id="progress"></span><span id="here"></span></div>
    </section>
    <section class="scene" id="sceneF" aria-labelledby="sceneFTitle"><h2 id="sceneFTitle" class="sr">Map</h2><div class="mapwrap" id="mapwrap"></div></section>
    <section class="scene" id="sceneS" aria-labelledby="sceneSTitle"><h2 id="sceneSTitle" class="sr">Story</h2><div id="beats"></div></section>
    <section class="scene" id="sceneG" aria-labelledby="sceneGTitle">
      <h2 id="sceneGTitle" class="sr">Gate</h2>
      <div class="ghead">The Gate · the one write</div>
      <div class="gsub">approve or reroll an open work item — evidence-gated, founders only.</div>
      <div class="gauge" id="gauge"></div>
      <div id="gate">loading the queue…</div>
    </section>
    <section class="scene" id="sceneC" aria-labelledby="sceneCTitle">
      <h2 id="sceneCTitle" class="sr">Commands</h2>
      <div class="ghead">Commands · the co-founder interface</div>
      <div class="gsub">the /ts-* command surface, run through the curios.self bot in Telegram.</div>
      <div id="cmds"></div>
    </section>
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
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PARAMS = new URLSearchParams(location.search);
const TENANT = (PARAMS.get('tenant')
  || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || 'cambium').replace(/[^a-z0-9-]/gi,'') || 'cambium';
const REFRESH_ROUTE = '/api/quests/' + TENANT;
const SCENE_PARAM = String(PARAMS.get('scene') || '').toLowerCase();
const START_SCENE = ({ quests:0, quest:0, q:0, map:1, story:2, gate:3, commands:4 }[SCENE_PARAM] ?? 0);
$('ten').textContent = TENANT;
let LEDGER = null;
let ECOSYSTEM_ENV = null;
let FRESHNESS_STATE = { derivedAt:'missing', source:'missing', age:null, stale:true, detail:'freshness missing' };

/* ── scene engine: tap + finger-tracked swipe (axis-locked, momentum, rubber-band) ── */
const track = $('track'), ind = $('ind'), SCN = 5;
let scene = START_SCENE;
const SCENE_META = [
  { label:'Quests', source:'tg-miniapp-scenes@v1', target:'quine', refresh:'pull-to-refresh re-fetches ' + REFRESH_ROUTE + ' and does not write operator state' },
  { label:'Map', source:'tg-miniapp-scenes@v1', target:'r3f', refresh:'pull-to-refresh re-fetches ' + REFRESH_ROUTE + ' and does not write operator state' },
  { label:'Story', source:'tg-miniapp-scenes@v1', target:'paperclip', refresh:'pull-to-refresh re-fetches ' + REFRESH_ROUTE + ' and does not write operator state' },
  { label:'Gate', source:'tg-miniapp-scenes@v1', target:'telegram', refresh:'pull-to-refresh re-fetches ' + REFRESH_ROUTE + ' and does not write operator state; writes require signed founder action' },
  { label:'Commands', source:'tg-miniapp-scenes@v1', target:'hermes', refresh:'pull-to-refresh re-fetches ' + REFRESH_ROUTE + ' and does not write operator state' },
];
$('ptr').dataset.refreshRoute = REFRESH_ROUTE;
$('ptrProof').textContent = 'Pull to refresh re-fetches ' + REFRESH_ROUTE + ' and does not write operator state.';
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
  if (scene === 3) loadGate();
  if (scene === 4) renderCommands();
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
    sheet: /data-interaction-kind="sheet"|data-live=|data-tapestry=|data-wake=|data-skill=|data-npc=|data-live-proof=|data-policy=|data-decision=|data-social=|data-box=/.test(html),
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
  $('sheetBody').innerHTML = '<div class="arc">scene provenance · ' + esc(meta.label.toLowerCase()) + '</div><h2>' + esc(meta.label) + '</h2>' +
    '<div class="nar">This scene is read from the Telegram mini app scene registry and refreshed without local operator writes.</div>' +
    '<div class="kv"><b>scene source</b><span>' + esc(meta.source) + '</span><b>ecosystem target</b><span>' + esc(meta.target) + '</span><b>refresh rule</b><span>' + esc(meta.refresh) + '</span>' + reducedMotionProofRow() + '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
$('sceneBadge').onclick = openSceneSheet;

/* commands panel — the /ts-* co-founder interface.
   4th tuple element: a live-data key (status/agents/work/handoffs/hermes) → tappable,
   shows real org data in the sheet; 'act' → action (runs in chat); else reference. */
let CMDDATA = null;
const CMDS = [
  ['Status · live', [
    ['ts-status', '', 'Org health — agents, work, arcs', 'status'],
    ['ts-hermes', '', 'Hermes timers and Telegram brain', 'hermes'],
    ['ts-agents', '', 'The agent roster', 'agents'],
    ['ts-projects', '', 'Active work in the org', 'work'],
    ['ts-handoffs', '', 'Pending items awaiting a founder', 'handoffs'],
    ['ts-agent', '<name>', 'Show one agent\\'s detail'],
    ['ts-project', '<slug>', 'Show one project\\'s detail'],
    ['ts-vault', '<path>', 'Read a vault file or list a folder'],
  ]],
  ['Actions · in chat', [
    ['ts-run', '<agent> <task>', 'Assign a task to an agent', 'act'],
    ['ts-approve', '<id>', 'Approve a pending handoff', 'act'],
    ['ts-reject', '<id> <reason>', 'Reject a pending handoff', 'act'],
  ]],
  ['Digests · in chat', [
    ['ts-standup', '', 'Generate the daily standup'],
    ['ts-digest', '', 'The weekly founder digest'],
    ['ts-help', '', 'Show command help in chat'],
  ]],
];
let cmdsDrawn = false;
function renderCommands(){
  if (cmdsDrawn) return; cmdsDrawn = true;
  const liveKeys = { status:1, hermes:1, agents:1, work:1, handoffs:1 };
  $('cmds').innerHTML = CMDS.map(([group, items]) =>
    '<div class="cmdgrp">' + esc(group) + '</div>' +
    items.map(([name, args, desc, kind]) => {
      const live = kind && liveKeys[kind];
      const action = kind === 'act';
      const reference = !live && !action;
      const interaction = live ? 'sheet' : action ? 'chat-command' : 'read-only';
      const source = live ? 'paperclipCommandsData' : action ? 'curios.self-chat-command' : 'curios.self-command-reference';
      return '<div class="cmd' + (action ? ' act' : '') + (live ? ' live' : '') + (reference ? ' ref' : '') + '"' +
        ' data-interaction-kind="' + interaction + '" data-source="' + source + '"' +
        ' data-command-kind="' + (kind || 'reference') + '"' +
        (live ? ' data-live="' + kind + '"' : '') + '>' +
        '<span class="cnode"></span>' +
        '<div style="flex:1"><div><span class="cname">/' + esc(name) + '</span>' +
          (args ? '<span class="cargs">' + esc(args) + '</span>' : '') + '</div>' +
          '<div class="cdesc">' + esc(desc) + '</div></div>' +
        (live ? '<span class="cgo">›</span>' : '') +
      '</div>';
    }).join('')
  ).join('') +
  '<div class="gnote" style="margin-top:18px">live cards show real org state (refreshed with the ledger). actions &amp; digests run by typing the command to the curios.self bot.</div>';
  $('cmds').querySelectorAll('.cmd.live').forEach(el => el.onclick = () => openCmdSheet(el.dataset.live));
}
function kvRows(pairs){ return '<div class="kv">' + pairs.map(([k,v]) => '<b>'+esc(k)+'</b><span>'+esc(v)+'</span>').join('') + '</div>'; }
function openCmdSheet(key){
  const d = CMDDATA;
  let title = '', body = '';
  if (!d){ title = 'commands'; body = '<div class="nar">org data unavailable — the gateway was unreachable at the last refresh. pull to refresh.</div>'; }
  else if (key === 'status'){
    title = '/ts-status';
    body = kvRows([['agents', String(d.status.agents)], ['work open', String(d.status.issuesOpen)], ['work done', String(d.status.issuesDone)], ['arcs grown', d.status.arcs], ['hermes', d.status.hermes || 'unknown']]);
  } else if (key === 'hermes'){
    title = '/ts-hermes · services';
    body = (d.services||[]).length ? (d.services||[]).map(s => '<div class="li"><div><span class="cname">'+esc(s.name)+'</span> <span class="cargs">'+esc(s.status)+'</span><div class="cdesc">'+esc(s.detail || s.label)+'</div></div></div>').join('') : '<div class="nar">no Hermes service data.</div>';
  } else if (key === 'agents'){
    title = '/ts-agents · ' + (d.agents||[]).length;
    body = (d.agents||[]).length ? (d.agents||[]).map(a => '<div class="li"><span class="cname">'+esc(a.name)+'</span>'+(a.model?'<span class="cargs">'+esc(a.model)+'</span>':'')+'</div>').join('') : '<div class="nar">no agents.</div>';
  } else if (key === 'work'){
    title = '/ts-projects · active work';
    body = (d.work||[]).length ? (d.work||[]).map(w => '<div class="li"><div><span class="cname">'+esc(w.id)+'</span> <span class="cargs">'+esc(w.status)+'</span><div class="cdesc">'+esc(w.title)+' · '+esc(w.who)+'</div></div></div>').join('') : '<div class="nar">no active work.</div>';
  } else if (key === 'handoffs'){
    title = '/ts-handoffs · ' + (d.handoffs||[]).length;
    body = (d.handoffs||[]).length ? (d.handoffs||[]).map(h => '<div class="li"><span class="cname">'+esc(h.id)+'</span> <span class="cargs">'+esc(h.status)+'</span><div class="cdesc">'+esc(h.title)+'</div></div>').join('') : '<div class="nar">nothing waiting on you.</div>';
  }
  $('sheetBody').innerHTML = '<div class="arc">live · derived with the ledger</div><h2>'+esc(title)+'</h2>' + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
window.addEventListener('resize', () => place(-scene * W(), false));

// pointer drag: one handler set, decides axis on first move.
let drag = null;
track.addEventListener('pointerdown', e => {
  if (sheetState.open) return;
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

/* ── gate — the one write. initData proves the founder; the Worker validates (Ed25519). ── */
const initData = (TG && TG.initData) || '';
let GATE_ITEMS = [];
function gateEvidence(it){ return it.evidence || it.detail || it.status || 'evidence missing from handoff'; }
function gateReversibility(kind, it){ return (it && it.reversibility) || (kind === 'approve' ? 'reversible until consumed; supersede with a newer gate action' : 'reversible review request; no execution until the org consumes it'); }
function gateConsequence(kind, it){
  if (kind === 'approve') return (it && (it.approveConsequence || it.consequence)) || 'approve handoff for org execution';
  return (it && (it.rerollConsequence || it.consequence)) || 'reroll handoff and request revision';
}
function gateIdempotency(kind, it){
  const basis = it && typeof it === 'object' ? (it.idempotencyHint || it.id || 'unknown') : it;
  return kind + ':' + TENANT + ':' + basis;
}
function loadGate(){
  const el = $('gate');
  fetch('/api/quests/' + TENANT).then(r => r.ok ? r.json() : {}).then(d => {
    const items = (d && d.openItems) || [];
    GATE_ITEMS = items;
    if(!items.length){ el.innerHTML = '<div class="gnote">no open items waiting on you. The org is flowing.</div>'; return; }
    el.innerHTML = items.map((it,i) => {
      const evidence = gateEvidence(it);
      const approveKey = gateIdempotency('approve', it);
      const rerollKey = gateIdempotency('reroll', it);
      return '<div class="gitem" style="--i:'+i+'" data-i="'+i+'" data-id="'+esc(it.id)+'"><div class="gid">'+esc(it.id)+'</div>'+
      '<div class="gtitle">'+esc(it.title)+'</div><div class="gmeta">'+
        '<b>evidence</b><span>'+esc(evidence)+'</span>'+
        '<b>approve</b><span>'+esc(gateConsequence('approve', it))+'</span>'+
        '<b>reroll</b><span>'+esc(gateConsequence('reroll', it))+'</span>'+
        '<b>reversible</b><span>'+esc(gateReversibility('approve', it))+'</span>'+
        '<b>keys</b><span>'+esc(approveKey)+' / '+esc(rerollKey)+'</span>'+
      '</div><div class="gbtns">'+
      '<button class="approve">Approve</button><button class="reroll">Reroll</button></div></div>';
    }).join('') +
      '<div class="gnote">every action is signed by Telegram and executed by the org — no fake buttons.</div>';
    el.querySelectorAll('.gitem').forEach(node => {
      node.querySelector('.approve').onclick = () => gateAct('approve', node.dataset.id, node);
      node.querySelector('.reroll').onclick = () => gateAct('reroll', node.dataset.id, node);
    });
  }).catch(() => { el.innerHTML = '<div class="gnote">gate queue unreachable.</div>'; });
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
      node.innerHTML = res.queued
        ? '<div class="gnote">'+(res.duplicate ? 'already queued · ' : '')+esc(kind)+' queued for '+esc(subject)+' — key '+esc(res.idempotencyKey || idempotencyKey)+' · '+esc(res.consequence || consequence)+'</div>'
        : '<div class="gnote">refused: '+esc(res.error||'unknown')+'</div>';
      notify(res.queued ? 'success' : 'error');
    }).catch(() => { node.style.opacity='1'; node.innerHTML = '<div class="gnote">network error.</div>'; });
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

/* ── operator map — R3F mechanics ported as compact Telegram cards ── */
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
function senseCards(env){
  const senseEnv = env.senses || {};
  const served = Array.isArray(senseEnv.rows) ? senseEnv.rows : null;
  if (served) {
    return SENSE_CONTRACT.map(sense => {
      const row = served.find(item => item && item.id === sense.id) || {};
      const evidence = Array.isArray(row.evidence) ? row.evidence : [];
      return {
        ...sense,
        on:!!row.on,
        detail:row.detail || row.gap || sense.empty,
        proof:row.proof || row.gap || sense.empty,
        source:row.source || senseEnv.source || 'missing',
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
    if (sense.id === 'signal') return { ...sense, on:!!active, detail:active ? rowLabel(active) : sense.empty, source:'legacy-local', evidence:[] };
    if (sense.id === 'memory') return { ...sense, on:cortexRows.some(row => row.status !== 'locked'), detail:cortexRows.length ? cortexRows.filter(row => row.status !== 'locked').length + '/' + cortexRows.length + ' cortex rows' : sense.empty, source:'legacy-local', evidence:[] };
    if (sense.id === 'risk') return { ...sense, on:riskRows.length > 0, detail:riskRows.length ? riskRows.length + ' locked or pending traces' : sense.empty, source:'legacy-local', evidence:[] };
    if (sense.id === 'drift') return { ...sense, on:age === null || age > 360, detail:age === null ? 'freshness missing' : age > 360 ? Math.round(age / 60) + 'h stale' : sense.empty, source:'legacy-local', evidence:[] };
    return { ...sense, on:false, detail:sense.empty, source:'legacy-local', evidence:[] };
  });
}
function renderSenses(env){
  return '<div class="sensegrid">' + senseCards(env).map(sense =>
    '<button type="button" class="sense ' + (sense.on ? 'on' : '') + '" data-sense="' + sense.id + '"><b>' + esc(sense.title) + '</b>' + esc(sense.detail) + '</button>'
  ).join('') + '</div>';
}
function laneCards(env){
  const laneEnv = env.lanes || {};
  const counts = laneEnv.counts || {};
  return LANE_CONTRACT.map(lane => {
    const n = Number(counts[lane.id] || 0);
    return { ...lane, on:n > 0, detail:n > 0 ? n + ' move' + (n === 1 ? '' : 's') : (laneEnv.gap || lane.empty) };
  });
}
function renderLanes(env){
  return '<div class="sensegrid">' + laneCards(env).map(lane =>
    '<button type="button" class="sense ' + (lane.on ? 'on' : '') + '" data-lane="' + lane.id + '"><b>' + esc(lane.title) + '</b>' + esc(lane.detail) + '</button>'
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
    return {
      id:row.id || row.action?.target || row.title || 'side-quest',
      title:String(row.title || row.id || 'side quest').toUpperCase(),
      state:status === 'expired' ? 'wait' : 'ready',
      status,
      detail:row.detail || 'side quest trigger active',
      trigger:row.trigger || 'trigger missing',
      proof:row.proof || 'proof missing from side quest row',
      origin:row.origin || side.source || 'unknown',
      owner:row.owner || 'system',
      action:row.action || { label:'Inspect evidence', kind:'inspect', target:row.id || 'side quest' },
      lifetime:row.lifetime || { detail:'lifetime not served' },
      completion:row.completion || { proof:'completion proof not served' },
      runtime,
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
  if (!rows.length) {
    return [{
      title:'SOCIAL GAP',
      state:'wait',
      detail:social.gap || 'no tenant-scoped bridge or handoff evidence served',
      proof:'no coordination rows served',
      source:social.source || 'missing',
      scope:social.scope || 'tenant-handoff-only',
      evidence:[],
    }];
  }
  return rows.slice(0, 5).map(row => ({
    title:String(row.title || row.id || 'coordination').toUpperCase(),
    state:row.state === 'ready' ? 'ready' : 'wait',
    detail:row.detail || row.gap || 'coordination evidence missing',
    proof:row.proof || row.gap || 'proof missing from coordination row',
    source:row.source || social.source || 'missing',
    scope:row.scope || social.scope || 'tenant-handoff-only',
    evidence:Array.isArray(row.evidence) ? row.evidence : [],
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
function auditRow(id, title, state, detail, proof, source){
  return { id, title, state, detail, proof, source };
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
    auditRow('live-proof', 'LIVE PROOF', liveReady ? 'ready' : 'wait', liveReady ? 'live-proof receipts validate ready' : liveBlocked + '/' + liveTotal + ' readiness checks blocked', live.invariant || 'capture plan is guidance, not proof', 'liveProof'),
    auditRow('r3f-contract', 'R3F CONTRACT', 'ready', STAGES.length + ' organs · ' + RAILS.length + ' rails', 'shared visual contract loaded into Telegram map', 'shared/cambium-visual-contract'),
    auditRow('freshness-gaps', 'FRESHNESS GAPS', fresh ? 'ready' : 'wait', age === null ? 'freshness missing' : fresh ? age + 'm since derivation' : Math.round(age / 60) + 'h stale', env.derivedAt || 'derivedAt missing', 'freshness'),
  ];
}
function renderTapestryAudit(env){
  return '<div class="boxgrid">' + tapestryRows(env).map((row, i) =>
    '<button type="button" class="ibox tapestry ' + (row.state === 'ready' ? 'ready' : '') + '" data-tapestry="' + i + '"><b>' + esc(row.title) + '</b><span>' + esc(row.detail) + '</span></button>'
  ).join('') + '</div>';
}
function insightBoxes(env){
  const insightEnv = env.insights || {};
  const served = Array.isArray(insightEnv.rows) ? insightEnv.rows : null;
  if (served) {
    if (!served.length) return [{
      title:'NO EVIDENCE BOXES',
      state:'wait',
      detail:insightEnv.gap || 'no quest evidence rows served for insight boxes',
      proof:insightEnv.gap || 'no served insight rows',
      source:insightEnv.source || 'missing',
      evidence:[],
    }];
    return served.slice(0, 4).map(row => ({
      title:row.title || row.id || 'evidence box',
      state:row.state || 'wait',
      detail:row.detail || row.gap || row.proof || 'evidence pending',
      proof:row.proof || row.gap || 'proof missing from insight row',
      source:row.source || insightEnv.source || 'missing',
      origin:row.origin || 'unknown',
      evidence:Array.isArray(row.evidence) ? row.evidence : [],
    }));
  }
  const L = env.ledger;
  const rows = [...completedRows(L).slice(-3), activeRow(L)].filter(Boolean).slice(-4);
  if (!rows.length) return [{ title:'NO EVIDENCE BOXES', state:'wait', detail:'push a derived ledger before the map can reveal work', proof:'legacy-local inference found no rows', source:'legacy-local', evidence:[] }];
  return rows.map(row => {
    const facet = facetsFrom(row.evidence)[0];
    return { title:rowLabel(row), state:row.status === 'complete' ? 'ready' : 'wait', detail:(facet && facet.label) || row.evidence || 'evidence pending', proof:row.evidence || 'evidence pending', source:'legacy-local', evidence:[] };
  });
}
function renderInsightBoxes(env){
  return '<div class="boxgrid">' + insightBoxes(env).map((box, i) =>
    '<button type="button" class="ibox ' + (box.state === 'ready' ? 'ready' : '') + '" data-box="' + i + '"><b>' + esc(box.title) + '</b><span>' + esc(box.detail) + '</span></button>'
  ).join('') + '</div>';
}
function skillCards(env){
  const skillEnv = env.skills || {};
  const rows = Array.isArray(skillEnv.rows) ? skillEnv.rows : [];
  if (!rows.length) return [{ title:'SKILL LABORS', state:'wait', detail:skillEnv.gap || 'skill registry missing' }];
  return rows.slice(0, 4).map(skill => {
    const pct = Math.round(Number(skill.successRate || 0) * 100);
    const recent = Math.round(Number(skill.recentRate ?? skill.successRate ?? 0) * 100);
    const sample = Number(skill.sampleSize ?? skill.uses ?? 0);
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
    return {
      title:skill.id,
      state:ready ? 'ready' : 'wait',
      detail:String(skill.status || 'unknown') + ' · ' + detail,
      promotion,
    };
  });
}
function renderSkills(env){
  return '<div class="boxgrid">' + skillCards(env).map((skill, i) =>
    '<button type="button" class="ibox skill ' + (skill.state === 'ready' ? 'ready' : '') + '" data-skill="' + i + '"' + (skill.promotion && skill.promotion.status === 'founder-review' ? ' data-signed-action-entrypoint="promote-skill"' : '') + '><b>' + esc(skill.title) + '</b><span>' + esc(skill.detail) + '</span></button>'
  ).join('') + '</div>';
}
function npcCards(env){
  const npcEnv = env.npc || {};
  const rows = Array.isArray(npcEnv.relationships) ? npcEnv.relationships : [];
  const missingStage = { id:'missing', label:'MISSING', detail:'relationship stage not served', confidence:0 };
  const missingAdvice = { status:'blocked', label:'NO ADVICE', detail:'no durable NPC advice event served', proof:'no durable NPC events served', action:{ kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' } };
  const missingHistory = { source:'missing', total:0, contradictions:0, rows:[] };
  if (!rows.length) return [{ title:'MIRA', state:'wait', detail:'MISSING · npc relationship state not served yet', proof:'no relationship rows served', stage:missingStage, events:[], history:missingHistory, advice:missingAdvice, scope:'missing' }];
  return rows.map(npc => {
    const stage = npc.stage || missingStage;
    const advice = npc.advice || missingAdvice;
    const history = npc.history || missingHistory;
    return {
      title:String(npc.id || 'npc').toUpperCase(),
      state:npc.status === 'inferred' ? 'ready' : 'wait',
      detail:String(stage.label || 'MISSING') + ' · ' + (npc.detail || stage.detail || 'relationship signal missing'),
      proof:npc.proof || npc.detail || 'relationship proof missing',
      stage,
      events:Array.isArray(npc.events) ? npc.events : [],
      history,
      advice,
      scope:npc.scope || 'missing',
    };
  });
}
function renderNpc(env){
  return '<div class="boxgrid">' + npcCards(env).map((npc, i) =>
    '<button type="button" class="ibox npc ' + (npc.state === 'ready' ? 'ready' : '') + '" data-npc="' + i + '"><b>' + esc(npc.title) + '</b><span>' + esc(npc.detail) + '</span></button>'
  ).join('') + '</div>';
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
    '<div class="maphead"><div><h2>Operator Map</h2><p>R3F island mechanics, reduced to Telegram-native cards and rails.</p></div>' +
      '<button type="button" class="mapbadge" data-interaction-kind="sheet" data-source="shared/cambium-visual-contract" data-ecosystem-target="r3f">active · ' + esc((L.current && L.current.arc) || 'complete') + '</button></div>' +
    '<div class="cmdgrp">tapestry audit</div>' + renderTapestryAudit(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">today wake</div>' + renderWake(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">lanes</div>' + renderLanes(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">stance</div>' + renderStance(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">next action</div>' + renderPolicy(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">decision context</div>' + renderDecisionContext(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">live proof</div>' + renderLiveProof(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">side quests</div>' + renderSideQuests(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">coordination</div>' + renderSocial(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">senses</div>' + renderSenses(env.ledger ? env : { ledger:L }) +
    '<div class="stagegrid">' + stageCards + '</div>' +
    '<div class="cmdgrp">evidence boxes</div>' + renderInsightBoxes(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">skill labors</div>' + renderSkills(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">companions</div>' + renderNpc(env.ledger ? env : { ledger:L }) +
    '<div class="cmdgrp">rails</div><div class="railgrid">' + railCards + '</div>' +
    '<div class="mapnote">same mechanics as the R3F scene: five organs, packet rails, memory feed, active frontier, and evidence gates. no canvas, no heavy scene.</div>';
  $('mapwrap').querySelectorAll('.mapbadge').forEach(el => el.onclick = () => openMapHeaderSheet(L));
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
  $('sheetBody').innerHTML = '<div class="arc">operator map · active frontier</div><h2>Map Header</h2>' +
    '<div class="nar">The map header follows the same shared visual contract as the R3F scene.</div>' +
    '<div class="kv"><b>active arc</b><span>' + esc(arc) + '</span><b>active organ</b><span>' + esc(row ? stageTitle(organId) : 'all organs complete') + '</span><b>source</b><span>shared/cambium-visual-contract</span><b>quest title</b><span>' + esc((row && row.title) || (L.current && L.current.title) || 'no active quest') + '</span></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(row ? 'medium' : 'light');
}
function openRailSheet(railId, L){
  const rail = RAILS.find(item => item.id === railId) || RAILS.find(item => (item.from + '-' + item.to) === railId) || RAILS[0];
  const row = currentQuestRow(L);
  const hot = row && (rail.from === stageForArc(row.arc) || rail.to === stageForArc(row.arc));
  $('sheetBody').innerHTML = '<div class="arc">rail · ' + esc(rail.id) + '</div><h2>' + esc(stageTitle(rail.from)) + ' -> ' + esc(stageTitle(rail.to)) + '</h2>' +
    '<div class="nar">' + esc(rail.label) + '</div>' +
    '<div class="kv"><b>data rail</b><span>' + esc(rail.id) + '</span><b>source</b><span>shared/cambium-visual-contract</span><b>from organ</b><span>' + esc(stageTitle(rail.from)) + '</span><b>to organ</b><span>' + esc(stageTitle(rail.to)) + '</span><b>lane</b><span>' + esc(rail.lane || 'missing') + '</span><b>active arc</b><span>' + esc((row && row.arc) || 'complete') + '</span><b>active rail</b><span>' + esc(hot ? 'yes' : 'no') + '</span></div>';
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
  const body = rows.length ? rows.map((row, i) => {
    const facets = facetsFrom(row.evidence);
    return '<div class="li"><span class="cname">' + esc(row.arc) + ' · ' + esc(row.title) + '</span> <span class="cargs">' + esc(row.status) + '</span>' +
      '<div class="facets" style="margin-top:8px">' + (facets.length ? facets.map((f,j) =>
        '<div class="facet ' + (f.done?'done':'pend') + '" style="--i:' + (i + j) + '"><span class="dot"></span>' + esc(f.label) + '</div>').join('') : '<div class="cdesc">' + esc(row.evidence) + '</div>') +
      '</div></div>';
  }).join('') : '<div class="nar">no quest rows currently mapped to this organ.</div>';
  $('sheetBody').innerHTML = '<div class="arc">operator map · ' + esc(stage.id) + '</div><h2>' + esc(stage.title) + '</h2>' +
    '<div class="nar">' + esc(stage.detail) + '</div>' + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openWakeBox(env, index){
  const wake = wakeSteps(env)[index] || wakeSteps(env)[0];
  const servedEvidence = Array.isArray(wake.evidence) ? wake.evidence : [];
  const history = wake.history || { source:'missing', total:0, status:'none', proof:'no operator wake events served', rows:[] };
  const evidence = servedEvidence.length
    ? '<div class="kv">' + servedEvidence.slice(0, 4).map((item, i) => '<b>evidence ' + (i + 1) + '</b><span>' + esc((item.label || 'row') + ' · ' + (item.status || 'served') + ' · ' + (item.detail || '')) + '</span>').join('') + '</div>'
    : '';
  const historyRows = Array.isArray(history.rows) && history.rows.length
    ? '<div class="kv">' + history.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.status || 'missing') + ' · ' + (row.source || history.source || 'missing') + ' · ' + (row.detail || row.proof || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no operator wake events served; this is the latest snapshot, not a historical trace.</div>';
  $('sheetBody').innerHTML = '<div class="arc">wake step · ' + esc(wake.done ? 'proved' : 'missing') + '</div><h2>' + esc(wake.label) + '</h2>' +
    '<div class="nar">' + esc(wake.detail) + '</div><div class="kv"><b>source</b><span>' + esc(wake.source || 'missing') + '</span><b>proof</b><span>' + esc(wake.proof || wake.detail) + '</span><b>wake history</b><span>' + esc((history.source || 'missing') + ' · ' + (history.status || 'none') + ' · ' + Number(history.total || 0) + ' event(s)') + '</span><b>history proof</b><span>' + esc(history.proof || 'history proof missing') + '</span></div>' + evidence + historyRows;
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
    '<div class="nar">' + esc(sense.detail) + '</div><div class="kv"><b>source</b><span>' + esc(sense.source || 'missing') + '</span><b>proof</b><span>' + esc(sense.proof || sense.detail) + '</span></div>' + body;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openLaneSheet(env, laneId){
  const lane = laneCards(env).find(card => card.id === laneId) || laneCards(env)[0];
  $('sheetBody').innerHTML = '<div class="arc">lane · ' + esc(lane.id) + '</div><h2>' + esc(lane.title) + '</h2>' +
    '<div class="nar">' + esc(lane.detail) + '</div>';
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
function openTapestryBox(env, index){
  const row = tapestryRows(env)[index] || tapestryRows(env)[0];
  $('sheetBody').innerHTML = '<div class="arc">completion definition · ' + esc(row.state) + '</div><h2>' + esc(row.title) + '</h2>' +
    '<div class="nar">' + esc(row.detail) + '</div><div class="kv"><b>source</b><span>' + esc(row.source || 'missing') + '</span><b>requirement</b><span>' + esc(row.id || 'tapestry-row') + '</span><b>proof</b><span>' + esc(row.proof || row.detail) + '</span></div>';
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
    '<div class="kv"><b>owner</b><span>' + esc(side.owner) + '</span><b>action</b><span>' + esc(side.action.label || side.action.kind || 'inspect') + '</span><b>target</b><span>' + esc(side.action.target || 'unknown') + '</span><b>lifetime</b><span>' + esc(side.lifetime.detail || 'lifetime not served') + '</span><b>completion</b><span>' + esc(side.completion.proof || 'completion proof not served') + '</span><b>trigger</b><span>' + esc(side.trigger) + '</span><b>origin</b><span>' + esc(side.origin || 'unknown') + '</span><b>proof</b><span>' + esc(side.proof) + '</span><b>side quest history</b><span>' + esc((runtime.source || 'missing') + ' · ' + (runtime.status || side.status || 'triggered') + ' · ' + Number(runtime.total || 0) + ' event(s)') + '</span><b>history proof</b><span>' + esc(runtime.proof || 'runtime proof missing') + '</span></div>' + action + historyRows;
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
  $('sheetBody').innerHTML = '<div class="arc">evidence box · ' + esc(box.state) + '</div><h2>' + esc(box.title) + '</h2>' +
    '<div class="nar">' + esc(box.detail) + '</div><div class="kv"><b>source</b><span>' + esc(box.source || 'missing') + '</span><b>proof</b><span>' + esc(box.proof || box.detail) + '</span></div>' + evidence;
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(box.state === 'ready' ? 'medium' : 'light');
}
function openSkillBox(env, index){
  const skill = skillCards(env)[index] || skillCards(env)[0];
  const canPromote = skill.promotion && skill.promotion.status === 'founder-review';
  const action = canPromote
    ? '<div class="gbtns promote"><button type="button" class="approve" data-promote-skill="1">Queue founder review</button></div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">skill labor · ' + esc(skill.state) + '</div><h2>' + esc(skill.title) + '</h2>' +
    '<div class="nar">' + esc(skill.detail) + '</div>' + action;
  const promote = $('sheetBody').querySelector('[data-promote-skill]');
  if (promote) promote.onclick = () => skillPromotionAct(skill, promote);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz(skill.state === 'ready' ? 'medium' : 'light');
}
function openNpcBox(env, index){
  const npc = npcCards(env)[index] || npcCards(env)[0];
  const stage = npc.stage || { id:'missing', label:'MISSING', detail:'relationship stage not served', confidence:0 };
  const advice = npc.advice || { status:'blocked', label:'NO ADVICE', detail:'no durable NPC advice event served', proof:'no durable NPC events served', action:{ kind:'collect-evidence', label:'Record NPC evidence', target:'quine write quests npc-event' } };
  const history = npc.history || { source:'missing', total:0, contradictions:0, rows:[] };
  const confidence = Math.round(Number(stage.confidence || 0) * 100);
  const events = Array.isArray(npc.events) && npc.events.length
    ? '<div class="kv">' + npc.events.slice(0, 4).map((event, i) => '<b>event ' + (i + 1) + '</b><span>' + esc((event.id || 'event') + ' · ' + (event.kind || 'unknown') + ' · ' + (event.source || 'missing') + ' · ' + (event.detail || 'detail missing')) + '</span>').join('') + '</div>'
    : '<div class="nar">no relationship events served; the companion remains an explicit evidence gap.</div>';
  const adviceBlock = '<div class="kv"><b>advice</b><span>' + esc((advice.label || 'NO ADVICE') + ' · ' + (advice.detail || 'no durable NPC advice event served')) + '</span><b>advice proof</b><span>' + esc(advice.proof || 'advice proof missing') + '</span><b>advice action</b><span>' + esc(((advice.action && advice.action.label) || 'Review') + ' · ' + ((advice.action && advice.action.target) || 'npc')) + '</span></div>';
  const historyRows = Array.isArray(history.rows) && history.rows.length
    ? '<div class="kv">' + history.rows.slice(0, 4).map((row, i) => '<b>history ' + (i + 1) + '</b><span>' + esc((row.id || 'event') + ' · ' + (row.kind || 'note') + ' · ' + (row.source || history.source || 'missing') + ' · ' + (row.detail || row.evidence || 'detail missing')) + '</span>').join('') + '</div>'
    : '';
  $('sheetBody').innerHTML = '<div class="arc">companion · ' + esc(npc.state) + '</div><h2>' + esc(npc.title) + '</h2>' +
    '<div class="nar">' + esc(npc.detail) + '</div><div class="kv"><b>stage</b><span>' + esc((stage.label || 'MISSING') + ' · ' + (stage.detail || 'relationship stage not served') + ' · ' + confidence + '% confidence') + '</span><b>scope</b><span>' + esc(npc.scope || 'missing') + '</span><b>proof</b><span>' + esc(npc.proof || npc.detail) + '</span><b>history</b><span>' + esc((history.source || 'missing') + ' · ' + Number(history.total || 0) + ' event(s) · ' + Number(history.contradictions || 0) + ' contradiction(s)') + '</span></div>' + adviceBlock + events + historyRows;
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
function renderStory(env){
  const beats = env.beats && env.beats.length ? env.beats :
    env.ledger.rows.filter(r => r.status === 'complete').map(r => ({ text: r.title + ' — ' + r.evidence, lane: 'quest', noesis: false }));
  $('beats').innerHTML = beats.map((b, i) => {
    const lane = b.lane || 'beat';
    const ico = LANE_ICON[lane] || (b.noesis ? LANE_ICON.noesis : LANE_ICON.beat);
    return '<div class="beat' + (b.noesis ? ' noesis' : '') + '" style="--i:' + Math.min(i, 20) + '" data-interaction-kind="read-only" data-source="operator-narrative" data-beat="' + i + '" data-lane="' + esc(lane) + '">' +
      '<span class="ico">' + ico + '</span>' +
      '<span class="lane">' + esc(lane) + '</span>' +
      (b.noesis ? '<b>◆ noesis · </b>' : '') + esc(b.text) +
    '</div>';
  }).join('');
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
  const pct = L.total ? L.completed / L.total : 0;
  const r = 46, CIRC = 2 * Math.PI * r, ARC = 0.75;       // 270deg sweep
  const track = N1(ARC * CIRC), tgap = N1(CIRC - ARC * CIRC);
  const val = N1(pct * ARC * CIRC), vgap = N1(CIRC - pct * ARC * CIRC);
  const valCircle = RM
    ? '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + val + ' ' + vgap + '"/>'
    : '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 ' + N1(CIRC) + '">' +
        '<animate attributeName="stroke-dasharray" dur="1s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1" values="0 ' + N1(CIRC) + ';' + val + ' ' + vgap + '"/>' +
      '</circle>';
  wrap.innerHTML =
    '<svg viewBox="0 0 120 116">' +
      '<g transform="rotate(135 60 60)">' +
        '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="rgba(214,255,246,.12)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + track + ' ' + tgap + '"/>' +
        valCircle +
      '</g>' +
      '<text class="gv" x="60" y="60" text-anchor="middle">' + L.completed + '/' + L.total + '</text>' +
      '<text class="gl" x="60" y="76" text-anchor="middle">ARCS GROWN</text>' +
    '</svg>';
}
function paint(env){
  ECOSYSTEM_ENV = env;
  LEDGER = env.ledger;
  CMDDATA = env.commands || null;
  renderQuests(env.ledger); renderOperatorMap(env); renderStory(env); renderGauge(env.ledger); freshness(env);
}
function load(){
  return fetch(REFRESH_ROUTE).then(r => r.json()).then(env => {
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
