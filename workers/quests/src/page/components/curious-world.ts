import { CURIOUS_WORLD_JS, CURIOUS_WORLD_CSS } from './curious-world.generated.ts';

// One maintained world, with the existing page-owned read and Gate bridges.
export const CURIOUS_WORLD_PAGE = `<style>${CURIOUS_WORLD_CSS}</style>
<style>
#curious-world[hidden],#curious-world-fallback[hidden]{display:none!important}
#curious-world{position:fixed;inset:0;background:#00272b}
#curious-world-fallback{position:fixed;inset:0;display:grid;place-content:center;gap:16px;padding:32px;max-width:700px;margin:auto}
#curious-world-fallback h1{font-size:clamp(26px,5vw,42px);line-height:1.15;margin:0;color:#e0ff4f}
#curious-world-fallback p{margin:0}#curious-world-retry{min-height:48px;width:fit-content;padding:10px 20px;background:#00272b;color:#e0ff4f;border:1px solid #e0ff4f;border-radius:24px;cursor:pointer}
</style>
<main id="curious-world" aria-label="Cambium Field Atlas" data-component="CuriousPocketWorld" data-evidence="source"></main>
<div id="curious-world-fallback" hidden role="status"><h1>Field Atlas needs a 3D connection.</h1><p>The world could not start. Check that WebGL is available in this browser, then try again.</p><button id="curious-world-retry" type="button">Retry Field Atlas</button></div>
<noscript>Enable JavaScript to explore Cambium Field Atlas.</noscript>
<script data-bundled="curious-pocket-world">${CURIOUS_WORLD_JS.replace(/<\/script/gi, '<\\/script')}</script>
<script>
(() => {
  const root = document.getElementById('curious-world');
  const retry = document.getElementById('curious-world-retry');
  const fallback = document.getElementById('curious-world-fallback');
  if (!root || !retry || !fallback) return;
  let mounted = null;
  let closing = false;
  let failedDuringMount = false;
  function unavailable() {
    if (closing) return;
    closing = true; failedDuringMount = true;
    const previous = mounted; mounted = null;
    if (previous) previous.dispose();
    root.hidden = true; root.replaceChildren(); fallback.hidden = false;
    retry.focus(); closing = false;
  }
  function enter() {
    if (mounted) { mounted.focus(); return; }
    fallback.hidden = true; root.hidden = false; failedDuringMount = false;
    try {
      const candidate = CuriousPocketWorld.mountCuriousWorld(root, {
        onExit:unavailable,
        getReadState:() => CuriousReadBridge.get(),
        subscribeRead:fn => CuriousReadBridge.subscribe(fn),
        getGateState:() => CuriousGateBridge.get(),
        subscribeGate:fn => CuriousGateBridge.subscribe(fn),
        readDecision:changeDigest => CuriousGateBridge.readDecision(changeDigest),
        reviewGate:changeDigest => CuriousGateBridge.review(changeDigest),
        renewGate:changeDigest => CuriousGateBridge.renew(changeDigest),
        readGraph:() => CuriousGateBridge.graph(),
        intakeGate:input => CuriousGateBridge.intake(input),
        getDepartmentState:() => CuriousDepartmentBridge.get(),
        getDepartmentStatus:() => CuriousDepartmentBridge.status(),
        subscribeDepartment:fn => CuriousDepartmentBridge.subscribe(fn),
        refreshDepartment:() => CuriousDepartmentBridge.refresh(),
        signGate:(kind, changeDigest) => CuriousGateBridge.sign(kind, changeDigest)
      });
      if (failedDuringMount) { candidate.dispose(); return; }
      mounted = candidate; mounted.focus();
    } catch (_) { unavailable(); }
  }
  retry.addEventListener('click', enter);
  window.addEventListener('pagehide', () => { if (mounted) { mounted.dispose(); mounted = null; } });
  window.addEventListener('pageshow', event => { if (event.persisted) enter(); });
  enter();
})();
</script>`;
