/** Shares the existing authenticated graph read and refresh owner. No signer,
 * storage, timer, publication consumer or canonical writer lives here. */
export const CLIENT_CURIOUS_DEPARTMENT_BRIDGE = String.raw`
const CuriousDepartmentBridge = (() => {
  const listeners = new Set();
  let revision = 0, value = null, closed = false, state = 'checking';
  const notify = () => listeners.forEach(fn => { try { fn(); } catch (_) {} });
  function hold() { ++revision; value = null; state = 'unavailable'; notify(); }
  async function refresh() {
    const current = ++revision;
    value = null; state = 'checking'; notify();
    if (closed || !FOUNDER_WEB || TENANT !== 'cambium') { state = 'unavailable'; notify(); return; }
    try {
      const raw = await CuriousGateBridge.graph();
      if (closed || current !== revision) return;
      value = CuriousPocketWorld.createDepartmentReader(raw); state = 'read';
    } catch (_) { if (current === revision) { value = null; state = 'unavailable'; } }
    if (!closed && current === revision) notify();
  }
  return {
    get:() => value,
    status:() => ({state,label:state === 'checking' ? 'Reading authenticated graph and available owner sources…' : state === 'read' ? 'Authenticated graph read; owner availability is listed separately' : 'The authenticated source read is held or unavailable. Refresh through the existing graph owner.'}),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refresh, hold,
    dispose() { closed = true; hold(); listeners.clear(); },
    resume() { closed = false; }
  };
})();`;
