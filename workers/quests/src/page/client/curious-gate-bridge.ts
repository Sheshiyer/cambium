// Founder Gate bridge for the 3D Field Atlas. It lives in the existing page's
// lexical scope beside CuriousReadBridge: the world receives sanitized pending
// goal proposals plus review/renew/sign entry points, never initData or any
// network owner. Telegram sign() posts the founder-verified /api/gate route
// with the Mini App's Telegram initData, or, on the /founder web surface, with
// the Cloudflare Access session the Worker verifies as the founder. Anywhere
// else there is no signer and every proposal is read-only. Signing fails closed unless the latest verified
// read carried the founder-only Inspect projection and that projection is
// consistent. The Worker remains the authority for every decision.
export const CLIENT_CURIOUS_GATE_BRIDGE = String.raw`
const CuriousGateBridge = (() => {
  const SOURCE = 'telegram-goal-graph-intake@v1';
  const LIST_SCHEMA = 'cambium.goal-graph-gate-row-list.v1';
  const INSPECT_SCHEMA = 'cambium.goal-graph-founder-inspect.v1';
  const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/;
  const KINDS = { 'approve-goal-graph':'approve', 'reject-goal-graph':'reject' };
  const PATH_SCHEMA = 'cambium.goal-graph-path.v1';
  const PLACES = { gate:'purpose', hands:'plant', 'launch-lead':'growth' };
  const STAGES = ['committed', 'directive-queued', 'runner-claimed', 'receipt', 'learning'];
  const listeners = new Set();
  const inflight = new Set();
  const reviews = new Map();
  const uncertain = new Set();
  let revision = -1;
  let state = 'checking';
  let rows = [];
  let paths = [];
  let sessionLabel = '';
  function signer() {
    if (typeof initData === 'string' && initData.length > 0) return 'telegram';
    return FOUNDER_WEB ? 'access' : 'none';
  }
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
  // Display-only placement served by the Worker; anything unknown stays at the Gate.
  function placementOf(raw) {
    const id = raw && typeof raw.landmarkId === 'string' && Object.prototype.hasOwnProperty.call(PLACES, raw.landmarkId) ? raw.landmarkId : 'gate';
    return Object.freeze({ landmarkId:id, districtId:PLACES[id] });
  }
  function pathOf(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.changeDigest !== 'string' || !DIGEST.test(raw.changeDigest)) return null;
    if (raw.decision !== 'approved' && raw.decision !== 'rejected') return null;
    const reached = raw.reached === null ? null : STAGES.indexOf(raw.reached) >= 0 ? raw.reached : undefined;
    if (reached === undefined) return null;
    return Object.freeze({
      changeDigest:raw.changeDigest, title:text(raw.title, 160) || 'Goal proposal', decision:raw.decision,
      decidedAt:text(raw.decidedAt, 64), reached, placement:placementOf(raw.placement),
    });
  }
  function rowOf(raw) {
    if (!raw || typeof raw !== 'object' || raw.kind !== 'goal-graph-intake' || ![SOURCE, 'founder-proposal-renewal@v1'].includes(raw.source)) return null;
    const renewableStale = raw.status === 'stale' && raw.renewOnly === true && raw.canRenew === true;
    if ((raw.status !== 'pending' && !renewableStale) || raw.tenantId !== TENANT || typeof raw.changeDigest !== 'string' || !DIGEST.test(raw.changeDigest)) return null;
    if (typeof raw.approvalNonce !== 'string' || !raw.approvalNonce || raw.approvalNonce.length > 240) return null;
    if (typeof raw.approvalExpiresAt !== 'string' || !Number.isFinite(Date.parse(raw.approvalExpiresAt))) return null;
    const row = {
      changeDigest:raw.changeDigest, nodeId:text(raw.nodeId, 160),
      proposalId:raw.proposalId || TENANT + ':' + raw.changeDigest, version:raw.version, canRenew:raw.canRenew === true, renewOnly:renewableStale || raw.renewOnly === true,
      title:text(raw.title, 160) || 'Goal proposal', summary:text(raw.summary, 240),
      sourceRef:text(raw.sourceRef, 160), receivedAt:text(raw.receivedAt, 64),
      approvalNonce:raw.approvalNonce, approvalExpiresAt:raw.approvalExpiresAt,
      consequence:text(raw.consequence, 300), reversibility:text(raw.reversibility, 300),
      placement:placementOf(raw.placement), fence:raw.fence, expectedHeadVersion:raw.expectedHeadVersion,
    };
    row.inspect = inspectOf(raw.founderInspect, row);
    return row;
  }
  function blockedReason(row, expired) {
    if (signer() === 'none') return 'Read-only here. Sign in at /founder, or open Curious inside Telegram, to sign.';
    if (state !== 'read') return 'Waiting for a verified read before signing.';
    if (!row.inspect) return 'Founder Inspect was not served to this session, so signing stays closed.';
    if (!row.inspect.consistent) return 'Inspect found an inconsistency, so signing stays closed.';
    if (inflight.has(row.changeDigest)) return 'A signature for this proposal is in flight.';
    if (uncertain.has(row.changeDigest)) return 'Outcome unconfirmed. Reload the canonical receipt before another decision.';
    if (expired) return 'The approval window has expired. Renew and review before deciding.';
    if (row.renewOnly || row.canRenew) return 'This proposal needs a fresh revision. Renew and review before deciding.';
    if (signer() === 'access' && !reviews.has(row.changeDigest)) return 'Read the complete canonical proposal before deciding.';
    return '';
  }
  function build() {
    const now = Date.now();
    const proposals = rows.map(row => {
      const expired = Date.parse(row.approvalExpiresAt) <= now;
      const reason = blockedReason(row, expired);
      const reviewed = reviews.get(row.changeDigest);
      const open = !reason;
      return Object.freeze({
        changeDigest:row.changeDigest, nodeId:row.nodeId, title:row.title, summary:row.summary,
        sourceRef:row.sourceRef, receivedAt:row.receivedAt, approvalExpiresAt:row.approvalExpiresAt,
        consequence:row.consequence, reversibility:row.reversibility, inspect:row.inspect, expired, placement:row.placement,
        canApprove:!reason && !row.renewOnly, canReject:open && !row.renewOnly, renewOnly:row.renewOnly, blockedReason:reason, signing:inflight.has(row.changeDigest),
        canRenew:signer() === 'access' && state === 'read' && row.canRenew && !inflight.has(row.changeDigest) && !uncertain.has(row.changeDigest),
        canonicalReview:reviewed ? JSON.stringify({proposalId:reviewed.proposalId,version:reviewed.version,changeDigest:reviewed.changeDigest,nonce:reviewed.nonce,expiresAt:reviewed.expiresAt,summary:reviewed.summary,review:reviewed.review}, null, 2) : null,
      });
    });
    const founderRead = proposals.some(proposal => proposal.inspect);
    const label = state === 'checking' ? 'Checking the founder read'
      : state !== 'read' ? 'Gate read held · nothing can be signed'
        : signer() === 'none' ? 'Read-only · sign in at /founder to sign'
          : signer() === 'access' && sessionLabel ? sessionLabel
          : proposals.length && !founderRead ? (signer() === 'access' ? 'Read-only · this Access account is not a verified founder' : 'Read-only · this Telegram account is not a verified founder')
            : sessionLabel || 'Founder signing ready';
    return Object.freeze({ state, signer:signer(), label, proposals:Object.freeze(proposals), paths:Object.freeze(state === 'read' ? paths : []) });
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
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  async function confirmation(p, decision) {
    const bytes = new TextEncoder().encode(canonical(p.review));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    return decision + ' proposal ' + p.proposalId + ' version ' + p.version + ' digest ' + p.changeDigest + ' expires ' + p.expiresAt + ': ' + p.summary + ' review sha256:' + hex;
  }
  async function call(path, body) {
    const response = await fetch('/v1/founder/' + path, {method:'POST', credentials:'same-origin', redirect:'error',
      headers:{'content-type':'application/json','x-cambium-founder-web':'1'}, body:JSON.stringify(body)});
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('unreadable'); }
    if (!response.ok && response.status !== 409) {
      const error = new Error(response.status === 401 || response.status === 403 ? 'Founder Access verification or tenant admission failed. Sign in with an enrolled founder.'
        : response.status === 503 ? 'Founder Gate unavailable. The owner must configure founder enrollment and tenant admission; no automatic enrollment.' : 'Founder Gate refused the request.');
      error.status = response.status; throw error;
    }
    return data;
  }
  async function readProposal(row) {
    const data = await call('proposal', {proposalId:row.proposalId});
    const p = data && data.proposal;
    const r = p && p.review;
    if (data.status !== 'review' || data.writerAuthority !== false || !p || !r
      || p.proposalId !== row.proposalId || p.tenantId !== TENANT || p.changeDigest !== row.changeDigest
      || !Number.isInteger(p.version) || p.version < 1 || (row.version !== undefined && p.version !== row.version)
      || typeof p.nonce !== 'string' || !p.nonce || !Number.isFinite(Date.parse(p.expiresAt)) || (row.approvalNonce !== undefined && p.nonce !== row.approvalNonce) || p.expiresAt !== row.approvalExpiresAt
      || r.tenantId !== TENANT || r.changeDigest !== p.changeDigest || r.approvalNonce !== p.nonce || r.approvalExpiresAt !== p.expiresAt
      || !r.founderInspect || r.founderInspect.consistent !== true || r.founderInspect.changeDigest !== p.changeDigest
      || typeof r.consequence !== 'string' || typeof r.reversibility !== 'string'
      || p.summary !== r.summary + ' Consequence: ' + r.consequence + ' Reversibility: ' + r.reversibility
      || !r.changeSet || r.changeSet.tenantId !== TENANT || r.changeSet.changeDigest !== p.changeDigest
      || !['nodesToCreate','nodesToUpdate','nodesToRemove'].every(key => Array.isArray(r.changeSet[key]))
      || !Number.isInteger(r.graphVersion) || r.graphVersion < 1 || r.fence !== r.graphVersion || r.expectedHeadVersion !== r.graphVersion - 1
      || r.changeSet.graphVersion !== r.graphVersion
      || (row.fence !== undefined && r.fence !== row.fence) || (row.expectedHeadVersion !== undefined && r.expectedHeadVersion !== row.expectedHeadVersion)
      || data.approveConfirmation !== await confirmation(p, 'approved') || data.rejectConfirmation !== await confirmation(p, 'rejected')) throw new Error('Canonical review changed or is incomplete. Refresh and review again.');
    return JSON.parse(JSON.stringify({...p,approveConfirmation:data.approveConfirmation,rejectConfirmation:data.rejectConfirmation}));
  }
  function receipt(data, input) {
    const r = data && data.receipt;
    if (!data || data.writerAuthority !== false || data.canonicalReadback !== true) throw new Error('Unverified canonical readback');
    if (data.status === 'pending' && !r && !data.receiptDigest) return result(false,'pending','Canonical status is pending. No decision was confirmed; review again before deciding.');
    if (!r || !DIGEST.test(data.receiptDigest || '') || !['approved','rejected','conflict'].includes(data.status)
      || r.proposalId !== input.proposalId || r.tenantId !== TENANT || r.version !== input.version || r.changeDigest !== input.changeDigest
      || r.nonce !== input.nonce || r.expiresAt !== input.expiresAt || typeof r.founderId !== 'string' || !r.founderId
      || !['approved','rejected'].includes(r.decision) || !Number.isFinite(Date.parse(r.decidedAt))
      || (r.channel !== null && !['curious','telegram','plugin'].includes(r.channel))
      || (data.status !== 'conflict' && data.status !== r.decision) || (data.status === 'conflict' && r.decision === input.decision)) throw new Error('Receipt does not match the reviewed proposal');
    return result(r.decision === input.decision, r.decision === input.decision ? r.decision : 'refused',
      'Canonical receipt ' + data.receiptDigest + '\n' + JSON.stringify(r, null, 2));
  }
  function refreshProjection() { if (typeof refresh === 'function') Promise.resolve().then(() => refresh()).catch(() => {}); }
  async function webSign(kind, row) {
    const prior = reviews.get(row.changeDigest);
    if (!prior) return result(false,'blocked','Read the complete canonical proposal before deciding.');
    const fresh = await readProposal(row);
    if (!rows.includes(row) || canonical(prior) !== canonical(fresh)) { reviews.delete(row.changeDigest); return result(false,'blocked','Proposal changed. Read the complete fresh review before deciding.'); }
    if (Date.parse(fresh.expiresAt) <= Date.now()) return result(false,'blocked','Proposal expired. Renew and review before deciding.');
    const decision = kind === 'approve-goal-graph' ? 'approved' : 'rejected';
    const input = {proposalId:fresh.proposalId,version:fresh.version,changeDigest:fresh.changeDigest,nonce:fresh.nonce,expiresAt:fresh.expiresAt,
      decision,confirmation:decision === 'approved' ? fresh.approveConfirmation : fresh.rejectConfirmation};
    let outcome;
    try { outcome = receipt(await call('decision',input),input); }
    catch (error) {
      if (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404) return result(false,'auth',error.message);
      // One read of the ORIGINAL tuple. Never retry a business decision.
      try { outcome = receipt(await call('status',input),input); }
      catch (_) { uncertain.add(row.changeDigest); outcome = result(false,'uncertain','Outcome unconfirmed. Canonical receipt readback failed; do not resubmit this decision.'); }
    }
    reviews.delete(row.changeDigest);
    return outcome;
  }
  return {
    async review(changeDigest) {
      const row = rows.find(item => item.changeDigest === changeDigest);
      if (signer() !== 'access' || state !== 'read' || !row || inflight.has(changeDigest)) return result(false,'blocked','Canonical review is unavailable.');
      try {
        const sessionResponse = await fetch('/v1/founder/session',{method:'GET',credentials:'same-origin',redirect:'error',headers:{'x-cambium-founder-web':'1'}});
        const session = await sessionResponse.json();
        if (!sessionResponse.ok || session.writerAuthority !== false || typeof session.founderId !== 'string' || !session.founderId || !Array.isArray(session.tenantIds)) throw new Error('Founder session unavailable. Sign in with an enrolled founder; the owner must configure tenant admission.');
        sessionLabel = 'Founder ' + session.founderId + (session.enrolled ? ' · enrolled' : ' · enrollment required') + (session.canonicalReady ? '' : ' · runtime configuration required');
        if (!session.enrolled || !session.tenantIds.includes(TENANT) || !session.canonicalReady) throw new Error(sessionLabel + '. The owner must configure explicit founder and tenant enrollment.');
        const p = await readProposal(row); if (rows.includes(row)) reviews.set(changeDigest,p); notify(); return result(true,'review','Complete canonical review loaded.'); }
      catch (error) { reviews.delete(changeDigest); notify(); return result(false,'blocked',error.message); }
    },
    async renew(changeDigest) {
      const row = rows.find(item => item.changeDigest === changeDigest);
      if (!row || !build().proposals.find(item => item.changeDigest === changeDigest)?.canRenew) return result(false,'blocked','This proposal cannot be renewed here.');
      inflight.add(changeDigest); notify();
      try {
        const old = await readProposal(row);
        const data = await call('renew',{proposalId:old.proposalId,version:old.version,changeDigest:old.changeDigest,nonce:old.nonce,expiresAt:old.expiresAt});
        if (!['renewed','duplicate'].includes(data.status) || data.writerAuthority !== false || !DIGEST.test(data.changeDigest || '')
          || data.proposalId !== TENANT + ':' + data.changeDigest || !Number.isInteger(data.version) || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error('Renewal was not confirmed. Refresh before continuing.');
        // The new revision must be fetched and independently verified before any decision.
        const fresh = await readProposal({proposalId:data.proposalId,changeDigest:data.changeDigest,version:data.version,approvalExpiresAt:data.expiresAt});
        const next = rowOf({...fresh.review,proposalId:fresh.proposalId,version:fresh.version,canRenew:false});
        if (!next || fresh.review.status !== 'pending' || next.renewOnly) throw new Error('Fresh proposal projection unavailable. Refresh the Gate.');
        rows = rows.filter(item => item.changeDigest !== changeDigest && item.changeDigest !== next.changeDigest).concat(next);
        reviews.set(next.changeDigest,fresh); notify();
        return {...result(true,'renewed','Review renewed. Read the complete new proposal before deciding.'),changeDigest:data.changeDigest};
      } catch (error) { return result(false,'blocked',error.message); }
      finally { reviews.delete(changeDigest); inflight.delete(changeDigest); notify(); refreshProjection(); }
    },
    get: () => build(),
    subscribe(fn) { listeners.add(fn); fn(build()); return () => listeners.delete(fn); },
    quest(env, nextRevision) {
      if (!accept(nextRevision)) return;
      const list = env && env.goalGraphIntake;
      const decisions = env && env.goalGraphDecisions;
      paths = decisions && decisions.schema === PATH_SCHEMA && decisions.tenantId === TENANT && Array.isArray(decisions.rows)
        ? decisions.rows.map(pathOf).filter(Boolean).slice(0, 8) : [];
      if (!env || env.schema !== 1 || env.tenant !== TENANT) { state = 'held'; rows = []; paths = []; }
      else if (list === undefined) { state = 'read'; rows = []; }
      else if (!list || list.schema !== LIST_SCHEMA || list.tenantId !== TENANT || !Array.isArray(list.rows)) { state = 'held'; rows = []; }
      else { state = 'read'; rows = list.rows.map(rowOf).filter(Boolean).slice(0, 25); }
      for (const [digest, review] of reviews) { const current = rows.find(row => row.changeDigest === digest); if (!current || current.version !== review.version || current.approvalNonce !== review.nonce || current.approvalExpiresAt !== review.expiresAt || (current.fence !== undefined && current.fence !== review.review.fence) || (current.expectedHeadVersion !== undefined && current.expectedHeadVersion !== review.review.expectedHeadVersion)) reviews.delete(digest); }
      notify();
    },
    hold(_state, nextRevision) {
      if (!accept(nextRevision)) return;
      state = 'held'; rows = []; paths = []; notify();
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
      if (signer() === 'access') return webSign(kind,row).catch(error => result(false,'blocked',error.message)).finally(() => { inflight.delete(changeDigest); notify(); refreshProjection(); });
      const web = false;
      const payload = {
        kind, subject:changeDigest, initData:web ? '' : initData,
        nonce:row.approvalNonce, expiresAt:row.approvalExpiresAt,
        idempotencyKey:kind + ':' + TENANT + ':' + changeDigest,
        evidence:'founder reviewed goal proposal ' + changeDigest + ' in the Field Atlas Gate',
        consequence:verb === 'approve' ? row.consequence : 'founder rejection retires this goal proposal; the goal graph is not written',
        reversibility:row.reversibility,
      };
      let request;
      try {
        const headers = web ? { 'content-type':'application/json', 'x-cambium-founder-web':'1' } : { 'content-type':'application/json' };
        request = fetch(API_BASE + '/api/gate/' + TENANT, { method:'POST', credentials:'same-origin', headers, body:JSON.stringify(payload) });
      } catch (_) { request = Promise.reject(new Error('network')); }
      // Only an explicit receipt is success, and only a readable 4xx refusal
      // (or the auth gate) is a confirmed "no write". A 5xx, an unreadable
      // body, a receipt-less 2xx or a dropped response may follow a recorded
      // decision, so it is reported as unconfirmed and always read back.
      const UNREADABLE = {};
      return Promise.resolve(request).then(response => Promise.resolve().then(() => response.json()).catch(() => UNREADABLE).then(body => {
        const readable = body !== UNREADABLE && !!body && typeof body === 'object';
        body = readable ? body : {};
        const status = Number(response && response.status) || 0;
        const settled = readable && response && response.ok !== false && body.ok === true;
        if (settled && verb === 'approve' && body.committed === true) return result(true, body.duplicate ? 'duplicate' : 'committed', body.duplicate ? 'Already committed · the original approval was reused.' : 'Approved · committed to the goal graph.');
        if (settled && verb === 'reject' && body.rejected === true) return result(true, body.duplicate ? 'duplicate' : 'rejected', body.duplicate ? 'Already rejected · nothing changed.' : 'Rejected · the goal graph was not written.');
        if (status === 401 || status === 403) return result(false, 'auth', (web ? 'Founder Access verification failed' : 'Telegram founder verification failed') + ' · no write.');
        const reason = text(body.code || body.error, 80);
        if (readable && reason && (status === 400 || status === 404 || status === 409)) return result(false, 'refused', 'Refused · no write · ' + reason + '.');
        if (body.error === 'goal_graph_commit_reconciliation_required') return result(false, 'uncertain', 'The goal graph may already hold this approval; its receipt needs reconciliation. Re-reading the Gate.');
        return result(false, 'uncertain', 'Outcome unconfirmed · the decision may have been recorded. Re-reading the Gate before anything else.');
      }), () => result(false, 'uncertain', 'Network failure · the outcome is unconfirmed. Re-reading the Gate before anything else.')).then(outcome => {
        inflight.delete(changeDigest); notify();
        // Read back after every settled attempt so the Gate shows the authority's state.
        if (typeof refresh === 'function') Promise.resolve().then(() => refresh()).catch(() => {});
        return outcome;
      });
    },
  };
})();
`;
