/** The protected Founder Gate renders no proposal data into the document. */
export function renderGrowthApprovalReview(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Growth review · Curious</title>
<style>
  :root { color-scheme: dark; font: 1rem/1.55 system-ui, sans-serif; background: #181722; color: #f5f0e6; }
  body { margin: 0; }
  main { width: min(45rem, calc(100% - 2rem)); margin: clamp(1.5rem, 8vw, 5rem) auto; }
  h1, h2, p { margin: 0 0 .75rem; }
  h1 { font-size: clamp(1.8rem, 6vw, 2.6rem); font-weight: 570; }
  h2 { font-size: 1.15rem; }
  header p, .hint { color: #cdc3d1; }
  section, #read-form { padding: 1rem; margin-block: 1rem; border: 1px solid #5a5367; border-radius: .65rem; background: #222030; }
  label { display: block; margin-block: .5rem; }
  button, input, select, textarea { font: inherit; border: 1px solid #817890; border-radius: .35rem; }
  input, select, textarea { box-sizing: border-box; width: 100%; background: #181722; color: inherit; padding: .55rem .65rem; }
  button { margin-top: .65rem; padding: .5rem .75rem; background: #e9d1a4; color: #211b24; font-weight: 650; cursor: pointer; }
  button:disabled { background: #565063; color: #f5f0e6; cursor: default; }
  :focus-visible { outline: 2px solid #e9d1a4; outline-offset: 3px; }
  pre { margin-block: .75rem; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .9rem; }
  #status { min-height: 1.5rem; }
</style>
</head>
<body>
<main>
  <header>
    <h1>Growth review</h1>
    <p>Founder Gate</p>
  </header>
  <section id="stage-panel" aria-labelledby="stage-heading" hidden>
    <h2 id="stage-heading">Stage a proposal</h2>
    <form id="stage-form">
      <label for="intake-json">Reviewed Growth intake JSON</label>
      <textarea id="intake-json" rows="7" maxlength="8192" autocomplete="off" spellcheck="false" required></textarea>
      <button id="stage-button" type="submit">Stage proposal</button>
    </form>
  </section>
  <form id="read-form">
    <label for="proposal-id">Proposal ID</label>
    <input id="proposal-id" type="text" maxlength="180" required autocomplete="off" spellcheck="false">
    <button id="read-button" type="submit">Read proposal</button>
  </form>
  <p id="status" role="status" aria-live="polite"></p>
  <section id="review-panel" aria-labelledby="review-heading" hidden>
    <h2 id="review-heading">Proposal and evidence</h2>
    <pre id="review-data"></pre>
  </section>
  <section id="decision-panel" aria-labelledby="decision-heading" hidden>
    <h2 id="decision-heading">Record founder decision</h2>
    <p class="hint">This records a decision receipt. Draft delivery and publication are separate actions.</p>
    <form id="decision-form">
      <label for="decision">Decision</label>
      <select id="decision" required>
        <option value="">Choose a decision</option>
        <option id="approve-option" value="approved">Approve</option>
        <option value="rejected">Reject</option>
      </select>
      <pre id="exact-confirmation"></pre>
      <label for="typed-confirmation">Copy the displayed confirmation exactly</label>
      <textarea id="typed-confirmation" rows="3" maxlength="2048" autocomplete="off" spellcheck="false" required></textarea>
      <button id="record-button" type="submit" disabled>Record decision</button>
    </form>
  </section>
  <button id="status-button" type="button" hidden>Check decision receipt</button>
  <section id="receipt-panel" aria-labelledby="receipt-heading" hidden>
    <h2 id="receipt-heading">Recorded decision</h2>
    <pre id="receipt-data"></pre>
  </section>
</main>
<script>
(() => {
  const byID = id => document.getElementById(id);
  const stagePanel = byID('stage-panel');
  const stageForm = byID('stage-form');
  const intakeJSON = byID('intake-json');
  const readForm = byID('read-form');
  const proposalID = byID('proposal-id');
  const readButton = byID('read-button');
  const status = byID('status');
  const reviewPanel = byID('review-panel');
  const decisionPanel = byID('decision-panel');
  const decisionForm = byID('decision-form');
  const decision = byID('decision');
  const typed = byID('typed-confirmation');
  const exact = byID('exact-confirmation');
  const record = byID('record-button');
  const checkStatus = byID('status-button');
  const receiptPanel = byID('receipt-panel');
  let review;
  let submitted;
  let busy = false;
  const idPattern = /^[a-z][a-z0-9-]{1,63}:sha256:[a-f0-9]{64}$/;

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }

  async function digestOf(value) {
    const bytes = new TextEncoder().encode(canonical(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function expectedConfirmation(proposal, kind) {
    const hash = await digestOf(proposal.review);
    return kind + ' growth row ' + proposal.proposalId + ' version ' + proposal.version + ' digest ' + proposal.changeDigest + ' expires ' + proposal.expiresAt + ': ' + proposal.summary + ' review sha256:' + hash;
  }

  async function call(path, body) {
    const response = await fetch('/v1/founder/growth/' + path, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-cambium-founder-web': '1' }, body: JSON.stringify(body)
    });
    return { ok: response.ok, data: await response.json() };
  }

  function envelope(kind, confirmation) {
    const { proposalId, version, changeDigest, nonce, expiresAt } = review.proposal;
    return { proposalId, version, changeDigest, nonce, expiresAt, decision: kind, confirmation };
  }

  function confirmationForChoice() {
    if (decision.value === 'approved') return review?.approveConfirmation ?? '';
    if (decision.value === 'rejected') return review?.rejectConfirmation ?? '';
    return '';
  }

  function updateForm() {
    const confirmation = confirmationForChoice();
    exact.textContent = confirmation;
    record.disabled = busy || !!submitted || !confirmation || confirmation !== typed.value;
  }

  function setBusy(value) {
    busy = value;
    byID('stage-button').disabled = value || !!submitted;
    intakeJSON.disabled = value || !!submitted;
    readButton.disabled = value || !!submitted;
    proposalID.disabled = value || !!submitted;
    checkStatus.disabled = value;
    updateForm();
  }

  async function stageProposal(event) {
    event.preventDefault();
    if (busy || submitted) return;
    let input;
    try {
      const raw = intakeJSON.value.trim();
      if (new TextEncoder().encode(raw).length > 8192) throw new Error('Intake too large');
      input = JSON.parse(raw);
      if (!input || !input.subject || typeof input.tenantId !== 'string') throw new Error('Invalid intake');
    } catch {
      status.textContent = 'Paste the reviewed Growth intake as one JSON object under 8 KB.';
      return;
    }
    setBusy(true);
    status.textContent = 'Staging the reviewed proposal…';
    let stagedID;
    try {
      const digest = await digestOf({ schema: 'thoughtseed.growth.approval-decision.v1', subject: input.subject });
      const expectedID = input.tenantId + ':sha256:' + digest;
      if (!idPattern.test(expectedID)) throw new Error('Invalid proposal ID');
      const { ok, data } = await call('intake', input);
      const proposal = data?.proposal;
      const staged = data?.status === 'review' && proposal?.schema === 'thoughtseed.growth.approval-proposal.v1'
        && proposal.proposalId === expectedID && canonical(proposal.subject) === canonical(input.subject);
      const settled = data?.canonicalReadback === true && ['approved', 'rejected'].includes(data.status)
        && data.receipt?.proposalId === expectedID;
      if (!ok || data?.writerAuthority !== false || data.externalAction !== 'none' || (!staged && !settled)) {
        throw new Error('Intake unavailable');
      }
      stagedID = expectedID;
      const url = new URL(location.href);
      url.searchParams.set('proposalId', stagedID);
      history.replaceState(null, '', url);
      proposalID.value = stagedID;
      stagePanel.hidden = true;
      intakeJSON.value = '';
    } catch {
      status.textContent = 'Staging could not be verified. Check your founder session and the exact intake JSON.';
    } finally {
      setBusy(false);
    }
    if (stagedID && stagePanel.hidden) readForm.requestSubmit();
  }

  function showReceipt(data, request) {
    const receipt = data?.receipt;
    if (data?.canonicalReadback !== true || data.writerAuthority !== false || data.externalAction !== 'none'
        || !receipt || receipt.schema !== 'thoughtseed.growth.approval-decision.v1'
        || !['approved', 'rejected'].includes(receipt.decision) || data.status !== receipt.decision
        || !/^[a-f0-9]{64}$/.test(data.receiptDigest ?? '')
        || ['proposalId', 'version', 'changeDigest', 'nonce', 'expiresAt'].some(key => Object.hasOwn(request, key) && receipt[key] !== request[key])) return false;
    byID('receipt-data').textContent = JSON.stringify({ receiptDigest: data.receiptDigest, receipt }, null, 2);
    receiptPanel.hidden = false;
    decisionPanel.hidden = true;
    checkStatus.hidden = true;
    submitted = undefined;
    status.textContent = 'Decision verified in the canonical ledger.';
    return true;
  }

  async function readProposal(event) {
    event.preventDefault();
    if (busy || submitted) return;
    const id = proposalID.value.trim();
    if (!idPattern.test(id)) {
      status.textContent = 'Enter a valid Growth proposal ID.';
      return;
    }
    review = undefined;
    reviewPanel.hidden = decisionPanel.hidden = receiptPanel.hidden = true;
    decision.value = typed.value = '';
    setBusy(true);
    status.textContent = 'Reading the stored proposal…';
    try {
      const { ok, data } = await call('proposal', { proposalId: id });
      if (ok && showReceipt(data, { proposalId: id })) return;
      if (data?.status === 'expired') {
        status.textContent = 'This proposal expired. Request a fresh proposal before deciding.';
        return;
      }
      const proposal = data?.proposal;
      if (!ok || data.status !== 'review' || data.writerAuthority !== false || data.externalAction !== 'none'
          || proposal?.schema !== 'thoughtseed.growth.approval-proposal.v1' || proposal.proposalId !== id
          || typeof proposal.nonce !== 'string' || !Number.isInteger(proposal.version) || proposal.version < 1
          || proposal.tenantId + ':' + proposal.changeDigest !== id || !Number.isFinite(Date.parse(proposal.expiresAt))
          || typeof proposal.summary !== 'string' || !proposal.review || typeof proposal.review !== 'object') {
        throw new Error('Unavailable proposal');
      }
      const mayApprove = data.actions?.approve === true && proposal.gate?.fence === 'pass'
        && proposal.gate?.grade === 'graded' && proposal.gate?.rowStatus === 'queued';
      const rejectConfirmation = await expectedConfirmation(proposal, 'rejected');
      const approveConfirmation = mayApprove ? await expectedConfirmation(proposal, 'approved') : null;
      if (data.rejectConfirmation !== rejectConfirmation || data.approveConfirmation !== approveConfirmation) throw new Error('Confirmation differs');
      review = { proposal, approveConfirmation, rejectConfirmation };
      byID('review-data').textContent = JSON.stringify(proposal, null, 2);
      reviewPanel.hidden = false;
      const request = envelope('rejected', rejectConfirmation);
      const check = await call('status', request);
      if (showReceipt(check.data, request)) return;
      if (!check.ok || check.data.status !== 'pending' || check.data.canonicalReadback !== true || check.data.writerAuthority !== false) throw new Error('Status unavailable');
      if (Date.parse(proposal.expiresAt) <= Date.now()) {
        status.textContent = 'This proposal expired. Request a fresh proposal before deciding.';
        return;
      }
      byID('approve-option').hidden = !mayApprove;
      byID('approve-option').disabled = !mayApprove;
      decisionPanel.hidden = false;
      status.textContent = mayApprove ? 'Review the evidence before recording a decision.' : 'Approval is held. Review the gate evidence.';
    } catch {
      status.textContent = 'The proposal or its decision status could not be verified. Check your founder session and proposal ID.';
    } finally {
      setBusy(false);
    }
  }

  async function readStatus() {
    if (!submitted) return;
    const request = submitted;
    try {
      const { data } = await call('status', request);
      if (showReceipt(data, request)) return;
    } catch { /* Leave the original attempt available for status readback. */ }
    checkStatus.hidden = false;
    status.textContent = 'Outcome unconfirmed. Check the original decision receipt before taking further action.';
  }

  async function submitDecision(event) {
    event.preventDefault();
    const confirmation = confirmationForChoice();
    if (busy || submitted || !confirmation || typed.value !== confirmation) return;
    if (Date.parse(review.proposal.expiresAt) <= Date.now()) {
      decisionPanel.hidden = true;
      status.textContent = 'This proposal expired. Request a fresh proposal before deciding.';
      return;
    }
    submitted = envelope(decision.value, confirmation);
    setBusy(true);
    decisionPanel.hidden = true;
    status.textContent = 'Checking the decision receipt…';
    try {
      const { data } = await call('decision', submitted);
      if (!showReceipt(data, submitted)) await readStatus();
    } catch {
      await readStatus();
    } finally {
      setBusy(false);
    }
  }

  readForm.addEventListener('submit', readProposal);
  stageForm.addEventListener('submit', stageProposal);
  decisionForm.addEventListener('submit', submitDecision);
  decision.addEventListener('change', () => { typed.value = ''; updateForm(); });
  typed.addEventListener('input', updateForm);
  checkStatus.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { await readStatus(); } finally { setBusy(false); }
  });
  const initialID = new URLSearchParams(location.search).get('proposalId');
  if (initialID && idPattern.test(initialID)) {
    proposalID.value = initialID;
    readForm.requestSubmit();
  } else {
    stagePanel.hidden = false;
  }
})();
</script>
</body>
</html>`;
}
