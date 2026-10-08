// Display-only read summary. No credentials, principal, payload or action API.
// Kept in the existing page's lexical scope rather than a new network owner.
export const CLIENT_CURIOUS_READ_BRIDGE = String.raw`
const CuriousReadBridge = (() => {
  let snapshot = { state:'source', label:'Source exploration · checking scoped read' };
  const listeners = new Set();
  let revision = -1;
  function notify(next) {
    snapshot = Object.freeze(next);
    listeners.forEach(fn => { try { fn(snapshot); } catch (_) {} });
  }
  return {
    get: () => snapshot,
    subscribe(fn) { listeners.add(fn); fn(snapshot); return () => listeners.delete(fn); },
    quest(env, nextRevision) {
      if (nextRevision < revision) return;
      revision = nextRevision;
      if (!env || env.schema !== 1 || env.tenant !== TENANT || !env.ledger ||
          !Array.isArray(env.ledger.rows) || typeof env.derivedAt !== 'string' ||
          !Number.isFinite(Date.parse(env.derivedAt)) || Date.parse(env.derivedAt) > Date.now() + 60000) {
        notify({state:'held', label:'Source exploration · scoped read unverified'}); return;
      }
      const stale = Date.now() - Date.parse(env.derivedAt) > 360 * 60000;
      notify({state:stale ? 'stale' : 'read', label:stale ? 'Source exploration · scoped read stale' : 'Source world · scoped read available'});
    },
    hold(state, nextRevision) {
      if (nextRevision < revision) return;
      revision = nextRevision;
      const labels = {auth:'access needed',offline:'connection offline',missing:'route unavailable',error:'service unavailable',empty:'no ledger yet'};
      notify({state:state === 'auth' ? 'auth' : 'held', label:'Source exploration · ' + (labels[state] || 'scoped read unverified')});
    },
    pending(nextRevision) {
      if (nextRevision < revision) return;
      revision = nextRevision;
      notify({state:'source',label:'Source exploration · checking scoped read'});
    }
  };
})();
`;
