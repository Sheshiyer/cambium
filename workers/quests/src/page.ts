// cambium-quests · the miniapp page (Thalia wing W2 — the Living Blueprint).
// One served file, zero build step, zero dependencies. AAA-feel within doctrine:
// White-Hat juice only — glow means growth, never urgency. Taste directives:
// transform/opacity animations exclusively, house easing cubic-bezier(.16,1,.3,1),
// liquid-glass = inner border + inset highlight, stagger cascades, mono numerals,
// skeleton/empty/error states, prefers-reduced-motion kills every loop.

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>curios.self · quest log</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:#00272B; --bg2:#012F34; --ink:#E0FF4F; --soft:#D6FFF6; --violet:#231651;
    --line:rgba(214,255,246,.09); --glass:rgba(1,47,52,.72);
    --ease:cubic-bezier(.16,1,.3,1); --pop:cubic-bezier(.34,1.56,.64,1);
    --mono:ui-monospace,'JetBrains Mono',SFMono-Regular,Menlo,monospace;
  }
  *{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
  html,body{height:100%}
  body{
    background:var(--bg); color:var(--soft); overflow:hidden;
    font:15px/1.5 -apple-system,'Satoshi','Euclid Circular A',system-ui,sans-serif;
  }
  /* mycelium substrate — fixed, non-scrolling, pointer-inert */
  .substrate{position:fixed;inset:0;pointer-events:none;opacity:.5;
    background:
      radial-gradient(420px 300px at 85% -5%,rgba(224,255,79,.05),transparent 60%),
      radial-gradient(520px 380px at -10% 100%,rgba(35,22,81,.5),transparent 65%),
      radial-gradient(300px 220px at 50% 55%,rgba(214,255,246,.025),transparent 70%);}
  .app{position:relative;height:100dvh;display:flex;flex-direction:column}

  header{padding:18px 18px 10px;display:flex;justify-content:space-between;align-items:baseline}
  .brand{font-size:16px;font-weight:700;letter-spacing:.03em}
  .brand small{display:block;font-size:11px;font-weight:400;opacity:.6;letter-spacing:.06em}
  .chip{font:11px/1 var(--mono);padding:5px 10px;border:1px solid rgba(224,255,79,.35);
    border-radius:999px;color:var(--ink)}
  .chip.stale{border-color:#F87060;color:#F87060}

  nav{display:grid;grid-template-columns:repeat(3,1fr);position:relative;margin:6px 14px 0;
    border-bottom:1px solid var(--line)}
  nav button{appearance:none;background:none;border:0;color:var(--soft);opacity:.55;
    font:600 13px/1 inherit;letter-spacing:.04em;padding:12px 0;cursor:pointer;
    transition:opacity .3s var(--ease)}
  nav button.on{opacity:1;color:var(--ink)}
  nav button:active{transform:scale(.97)}
  .ind{position:absolute;bottom:-1px;left:0;width:33.333%;height:2px;background:var(--ink);
    transition:transform .45s var(--ease)}

  .track{flex:1;display:grid;grid-template-columns:repeat(3,100%);
    transition:transform .5s var(--ease);will-change:transform}
  .scene{overflow-y:auto;padding:18px 18px 96px;overscroll-behavior:contain}

  /* ── quest line ─────────────────────────────── */
  .stem{position:relative;padding-left:34px}
  .stem::before{content:"";position:absolute;left:11px;top:8px;bottom:8px;width:2px;
    background:linear-gradient(var(--ink) 0 var(--grow,0%),var(--line) var(--grow,0%) 100%);
    transition:--grow 1s var(--ease)}
  .q{position:relative;padding:13px 4px 13px 10px;border-bottom:1px solid var(--line);
    opacity:0;transform:translateY(14px) scale(.97);
    animation:rise .55s var(--pop) forwards;animation-delay:calc(var(--i)*75ms);cursor:pointer}
  .q:active{transform:scale(.985)}
  @keyframes rise{to{opacity:1;transform:none}}
  .node{position:absolute;left:-31px;top:15px;width:20px;height:20px;border-radius:50%;
    display:grid;place-items:center;background:var(--bg2);border:1.5px solid var(--line)}
  .node svg{width:11px;height:11px}
  .q.complete .node{border-color:var(--ink);box-shadow:inset 0 0 7px rgba(224,255,79,.45)}
  .q.active .node{border-color:var(--ink);animation:breathe 2.6s var(--ease) infinite}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
  .q .arc{font:11px var(--mono);opacity:.5;margin-right:7px}
  .q .t{font-weight:650}
  .q.active .t{color:var(--ink)}
  .q.locked{opacity:0;animation:rise .55s var(--pop) forwards;animation-delay:calc(var(--i)*75ms)}
  .q.locked .t,.q.locked .arc{opacity:.4}
  .ev{font:12px/1.45 var(--mono);opacity:.7;margin-top:3px}
  .bar{height:8px;background:var(--line);border-radius:99px;margin:22px 0 8px;overflow:hidden}
  .fill{height:100%;width:0;background:var(--ink);border-radius:99px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25);transition:width 1.1s var(--ease)}
  .meta{display:flex;justify-content:space-between;font:12px var(--mono);opacity:.75}

  /* ── fractal ────────────────────────────────── */
  .fwrap{display:grid;place-items:center;padding-top:6px}
  .fcap{font:11px var(--mono);opacity:.6;text-align:left;width:100%;margin-top:14px}
  #rings .ring{cursor:pointer;transition:opacity .3s var(--ease)}
  #rings .ring:active{opacity:.7}
  .halo{animation:halo 2.8s var(--ease) infinite;transform-origin:center;transform-box:fill-box}
  @keyframes halo{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.045);opacity:.45}}
  .seed{animation:breathe 2.6s var(--ease) infinite;transform-origin:center;transform-box:fill-box}

  /* ── story ──────────────────────────────────── */
  .beat{padding:12px 2px;border-bottom:1px solid var(--line);opacity:0;
    transform:translateY(10px);animation:rise .5s var(--ease) forwards;
    animation-delay:calc(var(--i)*45ms)}
  .beat .lane{font:10px var(--mono);letter-spacing:.08em;text-transform:uppercase;
    padding:2px 7px;border:1px solid var(--line);border-radius:99px;opacity:.75;margin-right:8px}
  .beat.noesis{margin:14px 0;padding:14px;border:1px solid rgba(214,255,246,.35);border-radius:14px;
    background:var(--glass);backdrop-filter:blur(8px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
  .beat.noesis .lane{border-color:rgba(214,255,246,.5);color:var(--soft);opacity:1}

  /* ── sheet ──────────────────────────────────── */
  .veil{position:fixed;inset:0;background:rgba(0,20,23,.55);opacity:0;pointer-events:none;
    transition:opacity .35s var(--ease);z-index:10}
  .veil.on{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:11;padding:20px 20px 30px;
    background:var(--glass);backdrop-filter:blur(14px);
    border:1px solid rgba(214,255,246,.16);border-bottom:0;border-radius:20px 20px 0 0;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 -18px 50px rgba(0,10,12,.45);
    transform:translateY(105%);transition:transform .5s var(--pop);will-change:transform}
  .sheet.on{transform:translateY(0)}
  .grab{width:38px;height:4px;border-radius:99px;background:rgba(214,255,246,.25);margin:0 auto 14px}
  .sheet .arc{font:12px var(--mono);color:var(--ink);opacity:.9}
  .sheet h2{font-size:19px;letter-spacing:.01em;margin:4px 0 8px}
  .sheet .nar{opacity:.85;margin-bottom:12px}
  .kv{display:grid;grid-template-columns:84px 1fr;gap:6px 10px;font-size:13px}
  .kv b{font:11px var(--mono);opacity:.55;font-weight:500;letter-spacing:.05em;text-transform:uppercase;padding-top:2px}
  .kv span{font-family:var(--mono);font-size:12.5px;line-height:1.5}
  .status-complete{color:var(--ink)} .status-active{color:var(--ink)} .status-locked{opacity:.6}

  /* ── skeleton / states ──────────────────────── */
  .skel{height:54px;border-bottom:1px solid var(--line);position:relative;overflow:hidden}
  .skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
    background:linear-gradient(90deg,transparent,rgba(214,255,246,.06),transparent);
    animation:shimmer 1.4s var(--ease) infinite}
  @keyframes shimmer{to{transform:translateX(100%)}}
  .state{padding:46px 10px;text-align:left;opacity:.8}
  .state b{display:block;color:var(--ink);margin-bottom:6px;font-size:15px}
  .state code{font:12px var(--mono);opacity:.8}

  footer{position:fixed;left:0;right:0;bottom:0;padding:10px 18px 16px;font:10.5px var(--mono);
    opacity:.5;background:linear-gradient(transparent,var(--bg) 45%)}

  @media (prefers-reduced-motion: reduce){
    *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  }
</style>
</head>
<body>
<div class="substrate"></div>
<div class="app">
  <header>
    <div class="brand">Quest Log<small>the infinite game · tenant cambium</small></div>
    <span id="fresh" class="chip">syncing</span>
  </header>
  <nav>
    <button id="tb0" class="on">Quests</button>
    <button id="tb1">Fractal</button>
    <button id="tb2">Story</button>
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
  </div>
  <footer>every status derives from real world-state — no fake progress.</footer>
</div>
<div class="veil" id="veil"></div>
<div class="sheet" id="sheet"><div class="grab"></div><div id="sheetBody"></div></div>
<script>
'use strict';
const TG = window.Telegram && Telegram.WebApp;
const buzz = k => { try { TG && TG.HapticFeedback.impactOccurred(k); } catch(_){} };
if (TG) { TG.ready(); TG.expand(); try { TG.setHeaderColor('#00272B'); TG.setBackgroundColor('#00272B'); } catch(_){} }

const MARKS = {
  complete: '<svg viewBox="0 0 12 12"><path d="M2 6.5 5 9.5 10 3" fill="none" stroke="#E0FF4F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  active:   '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="3" fill="#E0FF4F"/></svg>',
  locked:   '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="2.4" fill="none" stroke="rgba(214,255,246,.45)" stroke-width="1.4"/></svg>'
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* scenes */
let scene = 0;
const go = i => { scene = i;
  document.getElementById('track').style.transform = 'translateX(' + (-100 * i) + '%)';
  document.getElementById('ind').style.transform = 'translateX(' + (100 * i) + '%)';
  [0,1,2].forEach(n => document.getElementById('tb'+n).classList.toggle('on', n === i));
  buzz('light');
};
[0,1,2].forEach(n => document.getElementById('tb'+n).onclick = () => go(n));

/* sheet */
const veil = document.getElementById('veil'), sheet = document.getElementById('sheet');
function openSheet(row){
  document.getElementById('sheetBody').innerHTML =
    '<div class="arc">arc ' + esc(row.arc) + ' · ' + esc(row.id) + '</div>' +
    '<h2>' + esc(row.title) + '</h2>' +
    (row.narration ? '<div class="nar">' + esc(row.narration) + '</div>' : '') +
    '<div class="kv">' +
      '<b>status</b><span class="status-' + esc(row.status) + '">' + esc(row.status) + '</span>' +
      '<b>evidence</b><span>' + esc(row.evidence) + '</span>' +
      (row.reveals ? '<b>reveals</b><span>' + esc(row.reveals) + '</span>' : '') +
    '</div>';
  veil.classList.add('on'); sheet.classList.add('on'); buzz('medium');
}
const closeSheet = () => { veil.classList.remove('on'); sheet.classList.remove('on'); buzz('light'); };
veil.onclick = closeSheet;

/* quest scene */
function renderQuests(L){
  const stem = document.getElementById('stem');
  stem.innerHTML = L.rows.map((r, i) =>
    '<div class="q ' + r.status + '" style="--i:' + i + '" data-i="' + i + '">' +
      '<div class="node">' + MARKS[r.status] + '</div>' +
      '<div><span class="arc">' + esc(r.arc) + '</span><span class="t">' + esc(r.title) + '</span>' +
      '<div class="ev">' + esc(r.evidence) + '</div></div>' +
    '</div>').join('');
  stem.querySelectorAll('.q').forEach(el => el.onclick = () => openSheet(L.rows[+el.dataset.i]));
  requestAnimationFrame(() => {
    stem.style.setProperty('--grow', Math.round(100 * L.completed / L.total) + '%');
    document.getElementById('fill').style.width = (100 * L.completed / L.total) + '%';
  });
  document.getElementById('progress').textContent = L.completed + '/' + L.total + ' quests';
  if (L.current) document.getElementById('here').textContent = 'you are here → ' + L.current.arc + ' · ' + L.current.title;
}

/* fractal scene — the tree-ring cross-section: each arc one ring; the living edge is you */
function renderFractal(L){
  const n = L.rows.length, C = 170, r0 = 26, step = (C - 40 - r0) / Math.max(1, n - 1);
  const rings = L.rows.map((row, i) => {
    const r = r0 + i * step, k = row.status;
    const col = k === 'complete' ? 'rgba(224,255,79,.8)' : k === 'active' ? '#E0FF4F' : 'rgba(120,98,200,.45)';
    const w = k === 'active' ? 2.6 : 1.4;
    const fill = k === 'complete' ? 'rgba(224,255,79,.05)' : 'none';
    const halo = k === 'active'
      ? '<circle class="halo" cx="' + C + '" cy="' + C + '" r="' + (r + 7) + '" fill="none" stroke="rgba(224,255,79,.35)" stroke-width="1"/>' : '';
    return halo +
      '<g class="ring" data-i="' + i + '">' +
        '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="' + fill + '" stroke="' + col + '" stroke-width="' + w + '"' +
        (k === 'locked' ? ' stroke-dasharray="3 7"' : k === 'complete' ? ' stroke-dasharray="0"' : '') + '/>' +
        '<circle cx="' + C + '" cy="' + (C - r) + '" r="9" fill="#012F34" stroke="' + col + '" stroke-width="1.2"/>' +
        '<text x="' + C + '" y="' + (C - r + 3.5) + '" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" fill="' + col + '">' + esc(row.arc) + '</text>' +
      '</g>';
  }).join('');
  const active = L.rows.findIndex(r => r.status === 'active');
  const rA = active >= 0 ? r0 + active * step : null;
  const label = rA !== null
    ? '<line x1="' + (C + rA * 0.7071 + 6) + '" y1="' + (C - rA * 0.7071 - 6) + '" x2="' + (C + rA * 0.7071 + 26) + '" y2="' + (C - rA * 0.7071 - 26) + '" stroke="rgba(224,255,79,.6)" stroke-width="1"/>' +
      '<text x="' + (C + rA * 0.7071 + 30) + '" y="' + (C - rA * 0.7071 - 30) + '" font-size="10" font-family="ui-monospace,monospace" fill="#E0FF4F">cambium — you are here</text>'
    : '';
  document.getElementById('fwrap').innerHTML =
    '<svg id="rings" viewBox="0 0 340 340" width="100%" style="max-width:380px">' +
      '<circle class="seed" cx="' + C + '" cy="' + C + '" r="5" fill="#E0FF4F"/>' + rings + label +
    '</svg>' +
    '<div class="fcap">the venture as a living trunk — completed arcs are rings; the glowing edge is the cambium, where growth happens. tap a ring.</div>';
  document.querySelectorAll('#rings .ring').forEach(g => g.onclick = () => openSheet(L.rows[+g.dataset.i]));
}

/* story scene */
function renderStory(env){
  const beats = env.beats && env.beats.length ? env.beats :
    env.ledger.rows.filter(r => r.status === 'complete').map(r => ({ text: r.title + ' — ' + r.evidence, lane: 'quest', noesis: false }));
  document.getElementById('beats').innerHTML = beats.map((b, i) =>
    '<div class="beat' + (b.noesis ? ' noesis' : '') + '" style="--i:' + i + '">' +
      '<span class="lane">' + esc(b.lane || 'beat') + '</span>' +
      (b.noesis ? '<strong>◆ noesis</strong> · ' : '') + esc(b.text) +
    '</div>').join('');
}

/* freshness */
function freshness(iso){
  const f = document.getElementById('fresh');
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  f.textContent = 'derived ' + (mins < 2 ? 'just now' : mins < 60 ? mins + 'm ago' : Math.round(mins / 60) + 'h ago');
  if (mins > 360) f.classList.add('stale');
}

fetch('/api/quests/cambium').then(r => r.json()).then(env => {
  if (!env.ledger) {
    document.getElementById('stem').innerHTML =
      '<div class="state"><b>no ledger yet</b>the garden is unplanted.<br><code>quine write quests push --tenant cambium</code></div>';
    document.getElementById('fresh').textContent = 'empty';
    return;
  }
  renderQuests(env.ledger); renderFractal(env.ledger); renderStory(env); freshness(env.derivedAt);
}).catch(() => {
  document.getElementById('stem').innerHTML =
    '<div class="state"><b>ledger unreachable</b>the mycelium is quiet — check the connection and pull down to retry.</div>';
  document.getElementById('fresh').textContent = 'offline';
  document.getElementById('fresh').classList.add('stale');
});
</script>
</body>
</html>`;
