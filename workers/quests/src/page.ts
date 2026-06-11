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
  .chip.stale{border-color:var(--warn);color:var(--warn)}

  /* pull-to-refresh — liquid droplet, lives above the track */
  .ptr{position:absolute;top:calc(var(--sat) + 56px);left:50%;z-index:3;pointer-events:none;
    transform:translate(-50%,-30px) scale(.4);opacity:0;transition:opacity .25s var(--ease)}
  .ptr.show{opacity:1}
  .ptr .drop{width:26px;height:26px;border-radius:50%;
    border:2px solid var(--ink);border-top-color:transparent}
  .ptr.spin .drop{animation:spin .7s linear infinite}

  nav{display:grid;grid-template-columns:repeat(4,1fr);position:relative;margin:6px 14px 0;
    border-bottom:1px solid var(--line)}
  nav button{appearance:none;background:none;border:0;color:var(--soft);opacity:.5;
    font:600 13px/1 inherit;letter-spacing:.03em;padding:12px 0;cursor:pointer;
    transition:opacity .3s var(--ease),color .3s var(--ease)}
  nav button.on{opacity:1;color:var(--ink)}
  nav button:active{transform:scale(.96)}
  .ind{position:absolute;bottom:-1px;left:0;width:25%;height:2px;background:var(--ink);
    border-radius:2px;transition:transform .45s var(--ease);box-shadow:0 0 8px rgba(224,255,79,.4)}

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
  .meta #here{text-align:right;color:var(--ink);opacity:.85}

  /* ── fractal ────────────────────────────────── */
  .fwrap{display:grid;place-items:center;padding-top:6px;position:relative}
  .fcap{font:11px var(--mono);opacity:.6;text-align:left;width:100%;margin-top:14px;max-width:60ch;
    transition:opacity .35s var(--ease)}
  #rings .ring{cursor:pointer}
  #rings .ring:active{opacity:.7}
  #ringsG{transition:transform .6s var(--ease);transform-box:view-box;transform-origin:0 0}
  #rings .pulse{animation:breathe 2.6s var(--ease) infinite;transform-origin:center;transform-box:fill-box}
  .orbit{animation:spin 90s linear infinite;transform-origin:center;transform-box:fill-box;will-change:transform}
  @keyframes spin{to{transform:rotate(360deg)}}
  .halo{animation:halo 2.8s var(--ease) infinite;transform-origin:center;transform-box:fill-box}
  @keyframes halo{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.045);opacity:.45}}
  .seed{animation:breathe 2.6s var(--ease) infinite;transform-origin:center;transform-box:fill-box}
  /* drill-down detail panel */
  .drill{position:absolute;inset:auto 0 0;padding:16px;border-radius:18px 18px 0 0;
    background:var(--glass);backdrop-filter:blur(12px);border:1px solid var(--line2);border-bottom:0;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
    transform:translateY(115%);transition:transform .5s var(--pop);will-change:transform}
  .drill.on{transform:translateY(0)}
  .drill .darc{font:12px var(--mono);color:var(--ink)}
  .drill h3{font-size:18px;margin:3px 0 4px;letter-spacing:.01em}
  .drill .dstat{font:11px var(--mono);text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:12px}
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
  #beats{display:flex;flex-direction:column;gap:9px}
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
    <span id="fresh" class="chip">syncing</span>
  </header>
  <div class="ptr" id="ptr"><div class="drop"></div></div>
  <nav>
    <button id="tb0" class="on">Quests</button>
    <button id="tb1">Fractal</button>
    <button id="tb2">Story</button>
    <button id="tb3">Gate</button>
    <div class="ind" id="ind"></div>
  </nav>
  <div class="track" id="track">
    <section class="scene" id="sceneQ">
      <div class="stem" id="stem">
        <div class="skel"></div><div class="skel"></div><div class="skel"></div>
        <div class="skel"></div><div class="skel"></div>
      </div>
      <div class="bar"><div id="fill" class="fill"></div></div>
      <div class="meta"><span id="progress"></span><span id="here"></span></div>
    </section>
    <section class="scene" id="sceneF"><div class="fwrap" id="fwrap"></div></section>
    <section class="scene" id="sceneS"><div id="beats"></div></section>
    <section class="scene" id="sceneG">
      <div class="ghead">The Gate · the one write</div>
      <div class="gsub">approve or reroll an open work item — evidence-gated, founders only.</div>
      <div class="gauge" id="gauge"></div>
      <div id="gate">loading the queue…</div>
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
const TENANT = (new URLSearchParams(location.search).get('tenant')
  || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || 'cambium').replace(/[^a-z0-9-]/gi,'') || 'cambium';
$('ten').textContent = TENANT;
let LEDGER = null;

/* ── scene engine: tap + finger-tracked swipe (axis-locked, momentum, rubber-band) ── */
const track = $('track'), ind = $('ind'), SCN = 4;
let scene = 0;
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
  [0,1,2,3].forEach(n => $('tb'+n).classList.toggle('on', n === scene));
  if (scene === 3) loadGate();
  if (!fromSwipe) buzz('light');
}
[0,1,2,3].forEach(n => $('tb'+n).onclick = () => go(n));
window.addEventListener('resize', () => place(-scene * W(), false));

// pointer drag: one handler set, decides axis on first move.
let drag = null;
track.addEventListener('pointerdown', e => {
  if (sheetState.open || drillOpen) return;
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
  $('sheetBody').innerHTML =
    '<div class="arc">arc ' + esc(row.arc) + ' · ' + esc(row.id) + '</div>' +
    '<h2>' + esc(row.title) + '</h2>' +
    (row.narration ? '<div class="nar">' + esc(row.narration) + '</div>' : '') +
    '<div class="kv">' +
      '<b>status</b><span class="status-' + esc(row.status) + '">' + esc(row.status) + '</span>' +
      '<b>evidence</b><span>' + esc(row.evidence) + '</span>' +
      (row.reveals ? '<b>reveals</b><span>' + esc(row.reveals) + '</span>' : '') +
    '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
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
function loadGate(){
  const el = $('gate');
  fetch('/api/quests/' + TENANT).then(r => r.ok ? r.json() : {}).then(d => {
    const items = (d && d.openItems) || [];
    if(!items.length){ el.innerHTML = '<div class="gnote">no open items waiting on you. The org is flowing.</div>'; return; }
    el.innerHTML = items.map((it,i) =>
      '<div class="gitem" style="--i:'+i+'" data-id="'+esc(it.id)+'"><div class="gid">'+esc(it.id)+'</div>'+
      '<div class="gtitle">'+esc(it.title)+'</div><div class="gbtns">'+
      '<button class="approve">Approve</button><button class="reroll">Reroll</button></div></div>').join('') +
      '<div class="gnote">every action is signed by Telegram and executed by the org — no fake buttons.</div>';
    el.querySelectorAll('.gitem').forEach(node => {
      node.querySelector('.approve').onclick = () => gateAct('approve', node.dataset.id, node);
      node.querySelector('.reroll').onclick = () => gateAct('reroll', node.dataset.id, node);
    });
  }).catch(() => { el.innerHTML = '<div class="gnote">gate queue unreachable.</div>'; });
}
function gateAct(kind, subject, node){
  buzz('medium'); node.style.opacity = '.5';
  fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ kind, subject, initData }) })
    .then(r => r.json()).then(res => {
      node.style.opacity='1';
      node.innerHTML = res.queued
        ? '<div class="gnote">'+esc(kind)+' queued for '+esc(subject)+' — the org will act and confirm in chat.</div>'
        : '<div class="gnote">refused: '+esc(res.error||'unknown')+'</div>';
      notify(res.queued ? 'success' : 'error');
    }).catch(() => { node.style.opacity='1'; node.innerHTML = '<div class="gnote">network error.</div>'; });
}

/* ── quest scene + count-up ── */
function countUp(node, to, suffix){
  if (RM){ node.textContent = to + suffix; return; }
  const dur = 900, t0 = performance.now();
  (function tick(t){ const p = Math.min(1, (t-t0)/dur), e = 1-Math.pow(1-p,3);
    node.textContent = Math.round(to*e) + suffix;
    if (p < 1) requestAnimationFrame(tick); })(t0);
}
function renderQuests(L){
  const stem = $('stem');
  stem.innerHTML = L.rows.map((r, i) =>
    '<div class="q ' + r.status + '" style="--i:' + i + '" data-i="' + i + '">' +
      '<div class="node">' + MARKS[r.status] + '</div>' +
      '<div><span class="arc">' + esc(r.arc) + '</span><span class="t">' + esc(r.title) + '</span>' +
      '<div class="ev">' + esc(r.evidence) + '</div></div>' +
    '</div>').join('');
  stem.querySelectorAll('.q').forEach(el => el.onclick = () => openSheet(L.rows[+el.dataset.i]));
  const pct = Math.round(100 * L.completed / L.total);
  requestAnimationFrame(() => { stem.style.setProperty('--grow', pct + '%'); $('fill').style.width = pct + '%'; });
  const prog = $('progress'); prog.innerHTML = '<span id="cu">0</span>/' + L.total + ' quests';
  countUp($('cu'), L.completed, '');
  if (L.current) $('here').textContent = 'here → ' + L.current.arc + ' · ' + L.current.title;
}

/* ── fractal scene — tree-ring cross-section, with tap-ring drill-down ── */
let drillOpen = false;
function ringGeom(L){
  const n = L.rows.length, C = 170, r0 = 30, step = (C - 24 - r0) / Math.max(1, n - 1);
  return { n, C, r0, step };
}
const GOLD = 2.39996323;   // golden angle (rad) — phyllotaxis node distribution
const N1 = (v) => (Math.round(v * 10) / 10);
function nodeXY(C, r, i){ const a = -Math.PI / 2 + i * GOLD; return [C + r * Math.cos(a), C + r * Math.sin(a)]; }
function renderFractal(L){
  const { n, C, r0, step } = ringGeom(L);
  const TAU = Math.PI * 2;
  const grown = L.rows.filter(r => r.status === 'complete').length;
  const rOuter = r0 + (n - 1) * step;
  const CHECK = (x, y) => '<path d="M' + N1(x-2.4) + ' ' + N1(y) + ' l1.7 1.8 l3.1 -3.6" fill="none" stroke="#00272B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';

  const defs =
    '<defs>' +
      '<radialGradient id="heart" cx="50%" cy="50%">' +
        '<stop offset="0%" stop-color="rgba(224,255,79,.13)"/>' +
        '<stop offset="55%" stop-color="rgba(35,22,81,.12)"/>' +
        '<stop offset="100%" stop-color="rgba(224,255,79,0)"/></radialGradient>' +
      '<radialGradient id="edge" cx="50%" cy="50%">' +
        '<stop offset="89%" stop-color="rgba(224,255,79,0)"/>' +
        '<stop offset="96%" stop-color="rgba(224,255,79,.30)"/>' +
        '<stop offset="100%" stop-color="rgba(224,255,79,0)"/></radialGradient>' +
      '<filter id="cells" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="7" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>' +
    '</defs>';

  // faint radial spokes — divide the disc into sectors (Swiss-grid precision)
  let spokes = '';
  for (let s = 0; s < 12; s++){
    const a = (s / 12) * TAU;
    spokes += '<line x1="' + C + '" y1="' + C + '" x2="' + N1(C + (rOuter + 8) * Math.cos(a)) + '" y2="' + N1(C + (rOuter + 8) * Math.sin(a)) +
      '" stroke="rgba(214,255,246,.07)" stroke-width=".6"/>';
  }

  // circular heartwood over the grown radius — soft field, subtle cells (no square)
  const rGrown = grown > 0 ? r0 + (grown - 1) * step : r0;
  const heartwood = '<circle cx="' + C + '" cy="' + C + '" r="' + rGrown + '" fill="url(#heart)"/>' +
    (grown > 0 ? '<circle cx="' + C + '" cy="' + C + '" r="' + rGrown + '" fill="rgba(224,255,79,.05)" filter="url(#cells)"/>' : '');

  // concentric rings — fine and layered; glow contained to the active cambium band
  let ringLines = '';
  L.rows.forEach((row, i) => {
    const r = r0 + i * step, k = row.status;
    if (k === 'active'){
      ringLines += '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="none" stroke="url(#edge)" stroke-width="13"/>' +
        '<circle class="halo" cx="' + C + '" cy="' + C + '" r="' + r + '" fill="none" stroke="rgba(224,255,79,.8)" stroke-width="1.6"/>';
    } else if (k === 'complete'){
      ringLines += '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="none" stroke="rgba(224,255,79,.4)" stroke-width="1"/>' +
        '<circle cx="' + C + '" cy="' + C + '" r="' + N1(r - 2) + '" fill="none" stroke="rgba(214,255,246,.07)" stroke-width=".6" stroke-dasharray="1 6"/>';
    } else {
      ringLines += '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="none" stroke="rgba(140,118,210,.26)" stroke-width=".8" stroke-dasharray="2 9"/>';
    }
  });

  // arc nodes — distributed AROUND the rings on a phyllotaxis spiral (not stacked)
  const nodes = L.rows.map((row, i) => {
    const r = r0 + i * step, k = row.status;
    const [nx, ny] = nodeXY(C, r, i);
    const stroke = k === 'locked' ? 'rgba(160,140,220,.6)' : '#E0FF4F';
    const fill = k === 'locked' ? '#0B2024' : '#01343A';
    const rad = k === 'active' ? 8 : 6;
    const glow = k === 'active' ? '<circle class="halo" cx="' + N1(nx) + '" cy="' + N1(ny) + '" r="14" fill="rgba(224,255,79,.16)"/>' : '';
    const mark = k === 'complete'
      ? CHECK(nx, ny)
      : '<text x="' + N1(nx) + '" y="' + N1(ny + 2.6) + '" text-anchor="middle" font-size="7" font-family="ui-monospace,monospace" fill="' + stroke + '">' + esc(row.arc) + '</text>';
    return '<g class="ring" data-i="' + i + '" data-x="' + N1(nx) + '" data-y="' + N1(ny) + '">' +
      '<circle cx="' + N1(nx) + '" cy="' + N1(ny) + '" r="15" fill="transparent"/>' + glow +
      '<circle class="' + (k === 'active' ? 'pulse' : '') + '" cx="' + N1(nx) + '" cy="' + N1(ny) + '" r="' + rad +
        '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (k === 'active' ? 1.8 : 1.2) + '"/>' + mark +
      '</g>';
  }).join('');

  // "you are here" leader line to the active node
  const ai = L.rows.findIndex(r => r.status === 'active');
  let label = '';
  if (ai >= 0){
    const [ax, ay] = nodeXY(C, r0 + ai * step, ai);
    // fixed top-right label with a leader to the active node — never clips the frame
    label = '<line x1="' + N1(ax) + '" y1="' + N1(ay) + '" x2="300" y2="24" stroke="rgba(224,255,79,.5)" stroke-width="1"/>' +
      '<circle cx="' + N1(ax) + '" cy="' + N1(ay) + '" r="2" fill="#E0FF4F"/>' +
      '<text x="332" y="21" text-anchor="end" font-size="9.5" font-family="ui-monospace,monospace" fill="#E0FF4F">cambium — you are here</text>';
  }

  $('fwrap').innerHTML =
    '<svg id="rings" viewBox="0 0 340 340" width="100%" style="max-width:392px">' + defs +
      '<g id="ringsG">' +
        '<g class="orbit">' + heartwood + '</g>' + spokes + ringLines + nodes +
        '<circle class="seed" cx="' + C + '" cy="' + C + '" r="4.5" fill="#E0FF4F"/>' +
        '<circle cx="' + C + '" cy="' + C + '" r="9" fill="none" stroke="rgba(224,255,79,.3)" stroke-width=".7"/>' + label +
      '</g>' +
    '</svg>' +
    '<div class="fcap" id="fcap">the venture as a living cross-section — each arc a ring from the heartwood out; nodes are the arcs themselves, and the glowing band is the cambium, the living edge where growth happens now. tap a node to drill in.</div>' +
    '<div class="drill" id="drill"></div>';
  document.querySelectorAll('#rings .ring').forEach(g => g.onclick = () => drillArc(L, +g.dataset.i, +g.dataset.x, +g.dataset.y));
}
// parse the evidence string into honest facets: "a · b · c" → chips, "done" if it
// reads as a satisfied count (x/x) or lacks "pending", else "pending".
function facetsFrom(ev){
  return String(ev || '').split('·').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    const pend = /pending|todo|blocked|missing/i.test(s);
    const done = (m && m[1] === m[2] && +m[2] > 0) || (!pend && !m && /\\b(yes|done|signed|received|true)\\b/i.test(s));
    return { label: s, done: done && !pend };
  });
}
function drillArc(L, i, nx, ny){
  const row = L.rows[i], C = 170;
  if (nx === undefined){ const g = ringGeom(L); [nx, ny] = nodeXY(C, g.r0 + i * g.step, i); }
  const k = 2.3;                                  // zoom toward the tapped node
  const rg = $('ringsG');
  rg.style.transform = 'translate(' + N1(C - k * nx) + 'px,' + N1(C - k * ny) + 'px) scale(' + k + ')';
  const facets = facetsFrom(row.evidence);
  const d = $('drill');
  d.innerHTML =
    '<div class="darc">arc ' + esc(row.arc) + ' · ' + esc(row.id) + '</div>' +
    '<h3>' + esc(row.title) + '</h3>' +
    '<div class="dstat status-' + esc(row.status) + '">' + esc(row.status) + '</div>' +
    '<div class="facets">' + facets.map((f,j) =>
      '<div class="facet ' + (f.done?'done':'pend') + '" style="--i:'+j+'"><span class="dot"></span>' + esc(f.label) + '</div>').join('') + '</div>' +
    '<button class="dback" id="dback">← back to the trunk</button>';
  d.classList.add('on'); drillOpen = true; buzz('medium');
  $('fcap').style.opacity = '0';
  $('dback').onclick = undrill;
}
function undrill(){
  $('ringsG').style.transform = '';
  $('drill').classList.remove('on'); drillOpen = false;
  $('fcap').style.opacity = ''; buzz('light');
}

/* ── story scene — cards with per-lane icons ── */
const LANE_ICON = {
  heartbeat: '<svg viewBox="0 0 16 16"><path d="M1 8h3l2-4 3 8 2-4h4"/></svg>',
  multica:   '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="2"/><path d="M6.5 6.5h3v3h-3z"/></svg>',
  teamforge: '<svg viewBox="0 0 16 16"><path d="M2 11l6-7 6 7"/><path d="M2 11h12"/></svg>',
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
    return '<div class="beat' + (b.noesis ? ' noesis' : '') + '" style="--i:' + Math.min(i, 20) + '">' +
      '<span class="ico">' + ico + '</span>' +
      '<span class="lane">' + esc(lane) + '</span>' +
      (b.noesis ? '<b>◆ noesis · </b>' : '') + esc(b.text) +
    '</div>';
  }).join('');
}

/* ── freshness ── */
function freshness(iso){
  const f = $('fresh');
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  f.textContent = 'derived ' + (mins < 2 ? 'just now' : mins < 60 ? mins + 'm ago' : Math.round(mins / 60) + 'h ago');
  f.classList.toggle('stale', mins > 360);
}

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
  LEDGER = env.ledger;
  renderQuests(env.ledger); renderFractal(env.ledger); renderStory(env); renderGauge(env.ledger); freshness(env.derivedAt);
}
function load(){
  return fetch('/api/quests/' + TENANT).then(r => r.json()).then(env => {
    if (!env.ledger){
      $('stem').innerHTML =
        '<div class="state"><b>no ledger yet</b><p>the garden is unplanted for <strong>' + esc(TENANT) + '</strong>.</p><code>quine write quests push --tenant ' + esc(TENANT) + '</code></div>';
      $('fresh').textContent = 'empty'; return;
    }
    paint(env);
  }).catch(() => {
    $('stem').innerHTML =
      '<div class="state"><b>ledger unreachable</b><p>the mycelium is quiet — pull down to retry.</p></div>';
    $('fresh').textContent = 'offline'; $('fresh').classList.add('stale');
  });
}
function refresh(){ return load(); }
load();
</script>
</body>
</html>`;
