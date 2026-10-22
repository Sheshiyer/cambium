// Founder Gate bridge for the 3D Field Atlas. It lives in the existing page's
// lexical scope beside CuriousReadBridge: the world receives sanitized pending
// goal proposals and one sign() entry point, never initData, nonces or any
// network owner. sign() posts the unchanged founder-verified /api/gate route
// with the Mini App's Telegram initData; outside Telegram there is no signer and
// every proposal is read-only. Signing fails closed unless the latest verified
// read carried the founder-only Inspect projection and that projection is
// consistent. The Worker remains the authority for every decision.
export const CLIENT_CURIOUS_GATE_BRIDGE = String.raw`
const CuriousGateBridge = (() => {
  const SOURCE = 'telegram-goal-graph-intake@v1';
  const LIST_SCHEMA = 'cambium.goal-graph-gate-row-list.v1';
  const INSPECT_SCHEMA = 'cambium.goal-graph-founder-inspect.v1';
  const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/;
  const KINDS = { 'approve-goal-graph':'approve', 'reject-goal-graph':'reject' };
  const listeners = new Set();
  const inflight = new Set();
  let revision = -1;
  let state = 'checking';
  let rows = [];
  function signer() { return typeof initData === 'string' && initData.length > 0 ? 'telegram' : 'none'; }
  function text(value, max) { return typeof value === 'string' ? value.slice(0, max) : ''; }
  function scalar(value) {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' && value.length <= 240 ? value : undefined;
  }
  function inspectOf(raw, row) {
    if (!raw || typeof raw !== 'object' || raw.schema !== INSPECT_SCHEMA) return null;
    if (raw.changeDigest !== row.changeDigest || raw.nodeId !== row.nodeId) return null;
    const anchors = {};
    for (const key of ['workObjectId', 'workObjectKind', 'pinnedLoadoutId']) {
      const value = scalar(raw[key]);
      if (value === undefined) return null;
      anchors[key] = value;
    }
    if (!Array.isArray(raw.executionAdmission) || raw.executionAdmission.length > 16) return null;
    const admission = [];
    for (const entry of raw.executionAdmission) {
      if (!entry || typeof entry.key !== 'string' || entry.key.indexOf('executionAdmission') !== 0 || entry.key.length > 64) return null;
      const value = scalar(entry.value);
      if (value === undefined) return null;
      admission.push(Object.freeze({ key:entry.key, value }));
    }
    const issues = Array.isArray(raw.issues) ? raw.issues.filter(issue => typeof issue === 'string').slice(0, 8).map(issue => issue.slice(0, 160)) : [];
    return Object.freeze({
      changeDigest:row.changeDigest, nodeId:row.nodeId,
      workObjectId:anchors.workObjectId, workObjectKind:anchors.workObjectKind, pinnedLoadoutId:anchors.pinnedLoadoutId,
      executionAdmission:Object.freeze(admission),
      admissionState:['exact', 'absent', 'invalid'].indexOf(raw.admissionState) >= 0 ? raw.admissionState : 'invalid',
      consistent:raw.consistent === true && issues.length === 0,
      issues:Object.freeze(issues),
    });
  }
  function rowOf(raw) {
    if (!raw || typeof raw !== 'object' || raw.kind !== 'goal-graph-intake' || raw.source !== SOURCE) return null;
    if (raw.status !== 'pending' || raw.tenantId !== TENANT || typeof raw.changeDigest !== 'string' || !DIGEST.test(raw.changeDigest)) return null;
    if (typeof raw.approvalNonce !== 'string' || !raw.approvalNonce || raw.approvalNonce.length > 240) return null;
    if (typeof raw.approvalExpiresAt !== 'string' || !Number.isFinite(Date.parse(raw.approvalExpiresAt))) return null;
    const row = {
      changeDigest:raw.changeDigest, nodeId:text(raw.nodeId, 160),
      title:text(raw.title, 160) || 'Goal proposal', summary:text(raw.summary, 240),
      sourceRef:text(raw.sourceRef, 160), receivedAt:text(raw.receivedAt, 64),
      approvalNonce:raw.approvalNonce, approvalExpiresAt:raw.approvalExpiresAt,
      consequence:text(raw.consequence, 300), reversibility:text(raw.reversibility, 300),
    };
    row.inspect = inspectOf(raw.founderInspect, row);
    return row;
  }
  function blockedReason(row, expired) {
    if (signer() !== 'telegram') return 'Read-only here. Open Curious inside Telegram to sign.';
    if (state !== 'read') return 'Waiting for a verified read before signing.';
    if (!row.inspect) return 'Founder Inspect was not served to this session, so signing stays closed.';
    if (!row.inspect.consistent) return 'Inspect found an inconsistency, so signing stays closed.';
    if (inflight.has(row.changeDigest)) return 'A signature for this proposal is in flight.';
    return expired ? 'The approval window has expired. Reject it, or ask for a fresh proposal.' : '';
  }
  function build() {
    const now = Date.now();
    const proposals = rows.map(row => {
      const expired = Date.parse(row.approvalExpiresAt) <= now;
      const reason = blockedReason(row, expired);
      const open = !reason || reason.indexOf('expired') >= 0;
      return Object.freeze({
        changeDigest:row.changeDigest, nodeId:row.nodeId, title:row.title, summary:row.summary,
        sourceRef:row.sourceRef, receivedAt:row.receivedAt, approvalExpiresAt:row.approvalExpiresAt,
        consequence:row.consequence, reversibility:row.reversibility, inspect:row.inspect, expired,
        canApprove:!reason, canReject:open, blockedReason:reason, signing:inflight.has(row.changeDigest),
      });
    });
    const founderRead = proposals.some(proposal => proposal.inspect);
    const label = state === 'checking' ? 'Checking the founder read'
      : state !== 'read' ? 'Gate read held · nothing can be signed'
        : signer() !== 'telegram' ? 'Read-only · open in Telegram to sign'
          : proposals.length && !founderRead ? 'Read-only · this Telegram account is not a verified founder'
            : 'Founder signing ready';
    return Object.freeze({ state, signer:signer(), label, proposals:Object.freeze(proposals) });
  }
  function notify() {
    const snapshot = build();
    listeners.forEach(fn => { try { fn(snapshot); } catch (_) {} });
  }
  function accept(nextRevision) {
    if (nextRevision < revision) return false;
    revision = nextRevision;
    return true;
  }
  function result(ok, outcome, message) { return Object.freeze({ ok, outcome, message }); }
  return {
    get: () => build(),
    subscribe(fn) { listeners.add(fn); fn(build()); return () => listeners.delete(fn); },
    quest(env, nextRevision) {
      if (!accept(nextRevision)) return;
      const list = env && env.goalGraphIntake;
      if (!env || env.schema !== 1 || env.tenant !== TENANT) { state = 'held'; rows = []; }
      else if (list === undefined) { state = 'read'; rows = []; }
      else if (!list || list.schema !== LIST_SCHEMA || list.tenantId !== TENANT || !Array.isArray(list.rows)) { state = 'held'; rows = []; }
      else { state = 'read'; rows = list.rows.map(rowOf).filter(Boolean).slice(0, 25); }
      notify();
    },
    hold(_state, nextRevision) {
      if (!accept(nextRevision)) return;
      state = 'held'; rows = []; notify();
    },
    pending(nextRevision) {
      if (!accept(nextRevision)) return;
      state = 'checking'; notify();
    },
    sign(kind, changeDigest) {
      const verb = KINDS[kind];
      if (!verb) return Promise.resolve(result(false, 'blocked', 'Unsupported Gate action.'));
      const row = rows.find(item => item.changeDigest === changeDigest);
      const proposal = build().proposals.find(item => item.changeDigest === changeDigest);
      if (!row || !proposal) return Promise.resolve(result(false, 'blocked', 'This proposal is no longer pending.'));
      if (verb === 'approve' ? !proposal.canApprove : !proposal.canReject) return Promise.resolve(result(false, 'blocked', proposal.blockedReason || 'Signing is closed.'));
      inflight.add(changeDigest); notify();
      const payload = {
        kind, subject:changeDigest, initData,
        nonce:row.approvalNonce, expiresAt:row.approvalExpiresAt,
        idempotencyKey:kind + ':' + TENANT + ':' + changeDigest,
        evidence:'founder reviewed goal proposal ' + changeDigest + ' in the Field Atlas Gate',
        consequence:verb === 'approve' ? row.consequence : 'founder rejection retires this goal proposal; the goal graph is not written',
        reversibility:row.reversibility,
      };
      let request;
      try {
        request = fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      } catch (_) { request = Promise.reject(new Error('network')); }
      return Promise.resolve(request).then(response => Promise.resolve().then(() => response.json()).catch(() => ({})).then(body => {
        body = body && typeof body === 'object' ? body : {};
        const settled = response && response.ok !== false && body.ok === true;
        if (settled && verb === 'approve' && body.committed === true) return result(true, body.duplicate ? 'duplicate' : 'committed', body.duplicate ? 'Already committed · the original approval was reused.' : 'Approved · committed to the goal graph.');
        if (settled && verb === 'reject' && body.rejected === true) return result(true, body.duplicate ? 'duplicate' : 'rejected', body.duplicate ? 'Already rejected · nothing changed.' : 'Rejected · the goal graph was not written.');
        const status = Number(response && response.status) || 0;
        const reason = text(body.code || body.error, 80);
        if (status === 401 || status === 403) return result(false, 'auth', 'Telegram founder verification failed · no write.');
        return result(false, 'refused', 'Refused · no write' + (reason ? ' · ' + reason : '') + '.');
      }), () => result(false, 'network', 'Network failure · no write.')).then(outcome => {
        inflight.delete(changeDigest); notify();
        if (outcome.ok && typeof refresh === 'function') Promise.resolve().then(() => refresh()).catch(() => {});
        return outcome;
      });
    },
  };
})();
`;
