import { CURIOUS_WORLD_JS, CURIOUS_WORLD_CSS } from './curious-world.generated.ts';

// Additive world uses the same document and existing read/action owners.
// No route, identity, authorization, or writer is introduced here.
export const CURIOUS_WORLD_PAGE = `<style>${CURIOUS_WORLD_CSS}</style>
<style>
body.curious-world-active{overflow:hidden!important}
#curious-world[hidden]{display:none!important}
#curious-world{position:fixed;inset:0;z-index:60;background:#00272b}
#curious-world-launch{position:fixed;right:14px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:45;min-height:44px;padding:10px 16px;border:1px solid #e0ff4f;border-radius:30px;background:#00272b;color:#e0ff4f;font:12px var(--mono,monospace)}
body.curious-world-active #curious-world-launch{display:none}
#curious-world-fallback{position:fixed;left:12px;right:12px;bottom:calc(124px + env(safe-area-inset-bottom));z-index:46;background:#012f34;color:#ffc7a1;border:1px solid #ffc7a1;padding:12px;font:12px var(--mono,monospace);border-radius:12px}
#curious-world-fallback[hidden]{display:none}
</style>
<section id="curious-world" hidden aria-label="Curious walkable source world" data-component="CuriousPocketWorld" data-evidence="source"></section>
<button id="curious-world-launch" type="button">Enter 3D world</button>
<p id="curious-world-fallback" hidden role="status">The 3D view is unavailable. The 2D workbench remains ready.</p>
<script data-bundled="curious-pocket-world">${CURIOUS_WORLD_JS.replace(/<\/script/gi, '<\\/script')}</script>
<script>
(() => {
  const root = document.getElementById('curious-world');
  const launch = document.getElementById('curious-world-launch');
  const fallback = document.getElementById('curious-world-fallback');
  if (!root || !launch || !fallback || typeof MutationObserver === 'undefined') return;
  let mounted = null;
  let exiting = false;
  let active = false;
  const backgrounds = () => [document.querySelector('[data-component="MissionControlShell"]'), document.getElementById('operating-fabric')].filter(Boolean);
  const observer = new MutationObserver(() => {
    if (!active) return;
    backgrounds().forEach(el => { if (!el.inert) el.inert = true; });
  });
  backgrounds().forEach(el => observer.observe(el, {attributes:true,attributeFilter:['hidden','inert']}));
  function exit() {
    if (exiting) return;
    exiting = true; active = false;
    const previous = mounted; mounted = null;
    if (previous) previous.dispose();
    root.hidden = true; root.replaceChildren();
    document.body.classList.remove('curious-world-active');
    backgrounds().forEach(el => { el.inert = el.hidden; });
    launch.focus(); exiting = false;
  }
  function openWorkbench(target) {
    exit();
    const fabric = document.getElementById('operating-fabric');
    if (fabric && !fabric.hidden) {
      const sceneName = target === 'gate' ? 'mission' : target === 'inspect' ? 'flow' : 'mission';
      const tab = fabric.querySelector('[data-of-tab="' + sceneName + '"]');
      if (tab) tab.click();
      if (target === 'gate') {
        const gate = fabric.querySelector('[data-of-gate-entrypoint]');
        if (gate) gate.click();
      } else if (target === 'inspect') {
        const atlas = fabric.querySelector('[data-of-system-atlas]');
        if (atlas) atlas.click();
      }
    } else if (typeof go === 'function') {
      if (target === 'inspect' && typeof renderInspect === 'function') {
        INSPECT_PANE = 'system'; renderInspect(typeof ECOSYSTEM_ENV === 'object' ? ECOSYSTEM_ENV : null);
      }
      go(target === 'gate' ? 1 : target === 'inspect' ? 4 : 0);
    }
  }
  function enter() {
    if (mounted) { mounted.focus(); return; }
    fallback.hidden = true; root.hidden = false;
    active = true; document.body.classList.add('curious-world-active');
    backgrounds().forEach(el => { el.inert = true; });
    try {
      if (typeof CuriousPocketWorld === 'undefined') throw new Error('world bundle unavailable');
      mounted = CuriousPocketWorld.mountCuriousWorld(root, {
        openWorkbench,
        onExit:reason => { exit(); if (typeof reason === 'string' && reason) fallback.hidden = false; },
        getReadState:() => CuriousReadBridge.get(),
        subscribeRead:fn => CuriousReadBridge.subscribe(fn)
      });
      mounted.focus();
    } catch (_) { exit(); fallback.hidden = false; }
  }
  launch.addEventListener('click', enter);
  window.addEventListener('pagehide', () => { exit(); observer.disconnect(); });
  // Explicit deep links can keep the workbench. A browser without WebGL falls
  // back through the same exit owner rather than shipping a blank screen.
  const query = new URLSearchParams(location.search);
  if (query.get('world') !== '0' && !query.has('scene') && !query.has('s')) enter();
})();
</script>`;
