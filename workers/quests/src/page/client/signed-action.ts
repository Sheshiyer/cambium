// cambium-quests · miniapp page chunk — Gate scene + signed action client (initData, preflight, queue posts)
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const CLIENT_SIGNED_ACTION = `/* ── gate — one queued founder decision. initData proves the founder; the Worker validates (Ed25519). ── */
const initData = (TG && TG.initData) || '';
let GATE_ITEMS = [];
let GATE_FILTER = 'all';
function actionRequestRows(env){
  const envelope = env && env.actionRequests;
  const rows = Array.isArray(envelope)
    ? envelope
    : envelope && Array.isArray(envelope.rows)
      ? envelope.rows
      : envelope && Array.isArray(envelope.actionRequests)
        ? envelope.actionRequests
        : [];
  return rows.filter(row => row && typeof row === 'object');
}
function actionRequestState(row){
  const status = String((row && row.status) || 'proposed');
  if (status === 'completed' || status === 'consumed') return 'complete';
  if (status === 'blocked' || status === 'needs_signed_confirmation') return 'blocked';
  if (status === 'queued' || status === 'awaiting_input') return 'active';
  return 'proof-needed';
}
function actionRequestSelectedOption(row){
  const options = Array.isArray(row && row.options) ? row.options : [];
  const selectedId = String((row && row.selectedOptionId) || '');
  return options.find(option => String(option && option.id) === selectedId)
    || options.find(option => option && (option.requiresSignedConfirmation || option.risk === 'high'))
    || options[0]
    || null;
}
function telegramTopicLabel(value){
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^clients?$/i.test(raw)) return 'Clients';
  return raw.split(/[-_\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
function gateTelegramMeta(it){
  const row = (it && it.actionRequest) || it || {};
  const topic = (row && row.topic) || {};
  const telegram = (it && it.telegram) || (row && row.telegram) || {};
  const topicLabel = telegramTopicLabel(telegram.topicLabel || telegram.topic || telegram.topicKey || topic.topicLabel || topic.topic || topic.topicKey || row.topicLabel || row.topicKey);
  const threadId = telegram.threadId || telegram.topicThreadId || topic.threadId || topic.topicThreadId || row.threadId || row.topicThreadId || '';
  const messageId = telegram.messageId || telegram.actionCardMessageId || topic.sourceMessageId || topic.messageId || topic.actionCardMessageId || row.sourceMessageId || row.messageId || row.actionCardMessageId || '';
  return { topicLabel, threadId:String(threadId || '').trim(), messageId:String(messageId || '').trim() };
}
function gateTelegramRoute(it){
  const meta = gateTelegramMeta(it);
  if (!meta.topicLabel && !meta.threadId && !meta.messageId) return '';
  const parts = [];
  parts.push(meta.topicLabel || 'Telegram topic');
  if (meta.threadId) parts.push('topic ' + meta.threadId);
  if (meta.messageId) parts.push('message ' + meta.messageId);
  return parts.join(' · ');
}
function gateReceiptExpectation(it){
  const row = (it && it.actionRequest) || it || {};
  const explicit = (it && it.receiptExpectation) || row.receiptExpectation;
  return explicit ? String(explicit) : '';
}
function gateLatestReceipt(it){
  const row = (it && it.actionRequest) || it || {};
  const latest = row && row.receipts && row.receipts.latest;
  return latest && latest.text ? String(latest.text) : '';
}
function actionRequestGateItems(env){
  return actionRequestRows(env).filter(row => !/completed|consumed|superseded/i.test(String(row.status || ''))).map(row => {
    const selected = actionRequestSelectedOption(row);
    const selectedLabel = selected && selected.label ? selected.label : (row.selectedOptionId || row.id || 'ActionRequest');
    const topic = row.topic || {};
    const telegram = row.telegram || {};
    const telegramRoute = {
      topicLabel:telegram.topicLabel || topic.topicLabel || telegram.topic || topic.topic || telegram.topicKey || topic.topicKey || row.topicLabel || row.topicKey || '',
      threadId:telegram.threadId || telegram.topicThreadId || topic.threadId || topic.topicThreadId || row.threadId || row.topicThreadId || '',
      messageId:telegram.messageId || telegram.actionCardMessageId || topic.sourceMessageId || topic.messageId || topic.actionCardMessageId || row.sourceMessageId || row.messageId || row.actionCardMessageId || '',
    };
    return {
      id:row.id || row.title || 'action-request',
      actionRequestId:row.id || '',
      selectedOptionId:row.selectedOptionId || (selected && selected.id) || '',
      title:row.title || 'ActionRequest',
      source:row.source || 'cambium-action-requests@v1',
      sourcePath:'cambium-action-requests@v1',
      status:row.status || 'proposed',
      owner:row.owner || 'founder',
      branchId:row.branchId || row.projectId || 'branch-not-served',
      branchLabel:row.branchLabel || row.projectName || row.branchId || 'branch not served',
      clientName:row.branchLabel || row.projectName || row.branchId || 'branch not served',
      missionId:row.missionId || row.questId || 'quest-not-served',
      updatedAt:row.updatedAt || row.createdAt || 'updatedAt not served',
      evidence:row.evidence || row.summary || row.why || 'ActionRequest evidence missing',
      consequence:row.consequence || row.next || 'founder choice updates ActionRequest state only',
      telegram:telegramRoute,
      receiptExpectation:row.receiptExpectation || '',
      approveConsequence:'queue founder approval for ' + (row.id || row.title || 'ActionRequest') + '; no external mutation until operator consumes the queue',
      rerollConsequence:String(row.status || '') === 'needs_signed_confirmation'
        ? 'queue signed Mini App confirmation for ' + selectedLabel + '; no external mutation until operator consumes the queue'
        : 'queue founder reroll request for ' + (row.id || row.title || 'ActionRequest') + '; no external mutation until operator consumes the queue',
      confirmConsequence:'queue signed Mini App confirmation for ' + selectedLabel + '; no external mutation until operator consumes the queue',
      reversibility:row.reversibility || 'ActionRequest can be superseded until consumed',
      idempotencyHint:row.idempotencyHint || row.id || 'action-request',
      priority:row.priority || { source:'cambium-action-requests@v1', risk:'review', dependency:'founder-choice', score:10 },
      actionRequest:row,
    };
  });
}
function gateItemsFromEnvelope(env){
  const openItems = Array.isArray(env && env.openItems) ? env.openItems : [];
  return openItems.concat(actionRequestGateItems(env || {}));
}
function gateSource(it){ return (it && (it.paperclipSource || it.source || it.sourcePath || it.origin || (it.priority && it.priority.source))) || 'Paperclip · /internal/gate/' + TENANT; }
function gateOriginLabel(it){
  const raw = String(gateSource(it) || 'Paperclip');
  return raw.split(' · ')[0] || 'Paperclip';
}
function gateOwner(it){ return (it && (it.owner || it.assignee || it.founder || it.operator)) || 'owner not served'; }
function gateUpdatedAt(it){ return (it && (it.updatedAt || it.updated || it.ts || it.createdAt)) || 'updatedAt not served'; }
function gateSubject(it){ return (it && (it.id || it.title)) || 'handoff'; }
function isActionRequestGateItem(it){ return !!(it && (it.actionRequest || it.sourcePath === 'cambium-action-requests@v1' || it.actionRequestId)); }
function gateActionRequestOption(it){ return actionRequestSelectedOption((it && it.actionRequest) || it || {}); }
function gateActionSubject(kind, it){ return kind === 'confirm-action-request' && isActionRequestGateItem(it) ? (it.actionRequestId || (it.actionRequest && it.actionRequest.id) || it.id || gateSubject(it)) : gateSubject(it); }
function gateEvidence(it){ return it.evidence || it.detail || it.status || 'evidence missing from handoff'; }
function gateBranchId(it){ return mcText(it && (it.branchId || it.branch || it.productId || it.clientName), 'branch-not-served').toLowerCase().replace(/[^a-z0-9-]+/g, '-'); }
function gateBranchFocus(it){ return gateBranchId(it); }
function gateBranchMission(it){
  const branch = it && (it.branchLabel || it.clientName || it.branch || it.productId || it.branchId);
  const mission = it && (it.missionId || it.mission || it.questId || it.title);
  return mcText(branch, 'branch not served') + ' · ' + mcText(mission, 'mission not served');
}
function gateReversibility(kind, it){ return (it && it.reversibility) || (kind === 'approve' ? 'reversible until consumed; supersede with a newer gate action' : 'reversible review request; no mutation until the org consumes it'); }
function gateReversibilityState(text){
  const value = String(text || '');
  if (/irreversible|cannot|unsafe|unknown|not reversible/i.test(value)) return 'blocked';
  if (/supersede|reversible|queued|until consumed/i.test(value)) return 'active';
  return 'proof-needed';
}
function gateQueueConsequence(raw, kind, subject){
  const fallback = kind === 'approve'
    ? 'queue founder approval for ' + subject + '; no Paperclip/org mutation until the operator consumes the queue'
    : kind === 'confirm-action-request'
      ? 'queue signed ActionRequest confirmation for ' + subject + '; no external mutation until operator consumes the queue'
      : 'queue founder reroll request for ' + subject + '; no Paperclip/org mutation until the operator consumes the queue';
  if (!raw) return fallback;
  const text = String(raw);
  const lower = String(text).toLowerCase();
  const explicitlyQueued = /\\bqueu(?:e|ed|eing)\\b/.test(lower);
  const explicitlyNonMutating = /(no|not|without)[^.;]*(paperclip|org|state|mutation|write|handling)/.test(lower) && /(consume|consumed|operator)/.test(lower);
  const directChangeVerb = /\\b(changes?|changed|changing|updates?|updated|updating|mutates?|mutated|mutating|writes?|wrote|writing|executes?|executed|executing|applies?|applied|applying)\\b/.test(lower);
  return explicitlyQueued && explicitlyNonMutating && !directChangeVerb ? text : fallback;
}
function gateConsequence(kind, it){
  const subject = gateActionSubject(kind, it);
  if (kind === 'approve') return gateQueueConsequence(it && (it.approveConsequence || it.consequence), kind, subject);
  if (kind === 'confirm-action-request') return gateQueueConsequence(it && (it.confirmConsequence || it.rerollConsequence || it.consequence), kind, subject);
  return gateQueueConsequence(it && (it.rerollConsequence || it.consequence), kind, subject);
}
function gateIdempotency(kind, it){
  if (kind === 'confirm-action-request' && isActionRequestGateItem(it)) {
    const option = gateActionRequestOption(it);
    return kind + ':' + TENANT + ':' + (it.actionRequestId || it.id || 'action-request') + ':' + ((option && option.id) || it.selectedOptionId || 'selected');
  }
  const basis = it && typeof it === 'object' ? (it.idempotencyHint || it.id || 'unknown') : it;
  return kind + ':' + TENANT + ':' + basis;
}
function gatePriorityChips(it){
  const priority = it && it.priority ? it.priority : {};
  const chips = [];
  if (priority.risk) chips.push('risk · ' + priority.risk);
  if (priority.dependency) chips.push('dependency · ' + priority.dependency);
  if (priority.score != null) chips.push('score · ' + priority.score);
  return chips.length ? '<div class="gpriority">' + chips.slice(0, 4).map(chip => '<span>' + esc(chip) + '</span>').join('') + '</div>' : '';
}
function gateFilterKey(it){
  const state = mcStateKind((it && it.status) || 'proof-needed');
  if (state === 'blocked' || state === 'stale') return 'blocked';
  if (state === 'proof-needed' || state === 'active') return 'review';
  return 'all';
}
function gateFilterMatch(item){
  if (GATE_FILTER === 'all') return true;
  if (GATE_FILTER.indexOf('branch:') === 0) return gateBranchId(item) === GATE_FILTER.slice(7);
  return gateFilterKey(item) === GATE_FILTER;
}
function gateFilterLabel(id){
  if (id.indexOf('branch:') === 0) return id.slice(7).replace(/-/g, ' ');
  return id;
}
function renderGateFilters(items){
  const counts = {
    all:items.length,
    review:items.filter(item => gateFilterKey(item) === 'review').length,
    blocked:items.filter(item => gateFilterKey(item) === 'blocked').length,
  };
  const branches = [];
  items.forEach(item => {
    const id = gateBranchId(item);
    if (!branches.some(row => row.id === id)) branches.push({ id, label:mcText(item && (item.branchId || item.branch || item.productId || item.clientName), 'branch not served'), count:items.filter(candidate => gateBranchId(candidate) === id).length });
  });
  return '<div class="gate-filter-strip" data-component="GateBranchFilterChips">' +
    Object.entries(counts).map(([id, count]) =>
      '<button type="button" class="' + (GATE_FILTER === id ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-filter-kind="' + esc(id) + '" data-gate-filter="' + esc(id) + '">' + esc(id) + ' · ' + count + '</button>'
    ).join('') + branches.map(branch =>
      '<button type="button" class="' + (GATE_FILTER === 'branch:' + branch.id ? 'is-selected mc-selected-halo' : '') + '" data-component="BranchArcChip" data-filter-kind="branch" data-gate-filter="branch:' + esc(branch.id) + '">' + esc(branch.label) + ' · ' + branch.count + '</button>'
    ).join('') +
  '</div>';
}
function renderGateQueue(items, source){
  if (!items.length) return renderGateEmpty(source);
  const filtered = items.map((item, index) => ({ item, index })).filter(row => gateFilterMatch(row.item));
  return renderGateFilters(items) +
    (filtered.length ? filtered.map(row => renderGateItem(row.item, row.index)).join('') : '<div class="gnote">No Gate items match ' + esc(gateFilterLabel(GATE_FILTER)) + '; urgent blockers stay visible under all.</div>') +
    '<div class="gnote">signed actions queue founder decisions; detail sheets carry audit proof.</div>';
}
function renderGateHeroDecision(items, source){
  const first = items[0] || null;
  const el = $('gateHeroDecision');
  if (!el) return;
  if (!first) {
    el.innerHTML = '<b>Decision waiting</b><span>No founder decision is waiting; Mission and Inspect stay available.</span>';
    el.dataset.gateHeroState = 'idle';
    return;
  }
  el.innerHTML = '<b>' + esc(gateSubject(first)) + '</b><span>' + esc(gateBranchMission(first)) + ' · proof: ' + esc(gateEvidence(first)) + '</span>';
  el.dataset.gateHeroState = mcStateKind(first.status || 'proof-needed');
  el.dataset.source = gateSource(first) || source;
}
function gateFact(label, value){
  return '<b>' + esc(label) + '</b><span>' + esc(value) + '</span>';
}
function renderGateEmpty(source){
  return '<div class="gate-empty" data-component="GateEmptyState" data-gate-state="empty" data-source="' + esc(source) + '">' +
    mcGlyphSvg('gate', 'locked') +
    '<div><b>no founder decisions waiting.</b><span>Gate is quiet. Evidence-backed approve and reroll choices appear here only after Cambium serves an open item.</span>' +
      mcSignalRail({ state:'locked', packetCount:3 }) +
      '<div class="gmeta gate-empty-meta">' +
        gateFact('Decision lane', 'waiting for open work') +
        gateFact('Founder action', 'confirmation appears with the next decision') +
      '</div>' +
      '<div class="gbtns"><button type="button" class="detail" data-gate-empty-nav="mission">Mission</button><button type="button" class="reroll" data-gate-empty-nav="inspect">Inspect</button></div>' +
    '</div>' +
  '</div>';
}
function renderGateError(source){
  return '<div class="gate-error" data-component="GateErrorState" data-gate-state="unreachable" data-source="' + esc(source) + '">' +
    mcGlyphSvg('gate', 'blocked') +
    '<div><b>network failure</b><span>' + esc(source) + ' unreachable; no local queue write.</span></div>' +
  '</div>';
}
function renderGateItem(it, i){
  const evidence = gateEvidence(it);
  const approveConsequence = gateConsequence('approve', it);
  const rerollConsequence = gateConsequence('reroll', it);
  const channelRoute = gateTelegramRoute(it);
  const receiptExpectation = gateReceiptExpectation(it);
  const latestReceipt = gateLatestReceipt(it);
  const state = it && it.actionRequest ? actionRequestState(it.actionRequest) : mcStateKind((it && it.status) || 'proof-needed');
  const reversibility = gateReversibility('approve', it);
  const reversibilityState = gateReversibilityState(reversibility);
  const stale = state === 'stale' || /not served|stale|old|expired/i.test(gateUpdatedAt(it));
  const actionRequestStatus = isActionRequestGateItem(it) ? String((it && it.status) || '') : '';
  const needsSignedActionRequest = actionRequestStatus === 'needs_signed_confirmation';
  const queuedActionRequest = actionRequestStatus === 'queued';
  const selectedOption = gateActionRequestOption(it);
  const selectedOptionLabel = selectedOption && selectedOption.label ? String(selectedOption.label) : '';
  const selectedOptionId = selectedOption && selectedOption.id ? selectedOption.id : ((it && it.selectedOptionId) || '');
  const actionButtons = needsSignedActionRequest
    ? '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="confirm-action-request" data-kind="confirm-action-request" data-action-request-option-id="' + esc(selectedOptionId) + '" data-risk-state="' + esc(reversibilityState) + '">Confirm signed</button><button type="button" class="detail" data-gate-detail="1">Details</button>'
    : queuedActionRequest
      ? '<span class="gate-queued-state" data-component="GateQueuedState" data-state="queued" aria-live="polite"><span><b>Queued</b><small>Awaiting operator consumption</small></span></span><button type="button" class="detail" data-gate-detail="1">Details</button>'
    : '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="approve" data-kind="approve" data-risk-state="' + esc(reversibilityState) + '">Approve safely</button><button type="button" class="reroll" data-interaction-kind="signed-action" data-signed-action-entrypoint="reroll" data-kind="reroll" data-risk-state="' + esc(reversibilityState) + '">Reroll safely</button><button type="button" class="detail" data-gate-detail="1">Details</button>';
  const actionFacts = queuedActionRequest
    ? gateFact('Queued consequence', gateConsequence('confirm-action-request', it)) +
      gateFact('Execution boundary', 'awaiting operator consumption; no external mutation has run')
    : gateFact('Approve consequence', approveConsequence) +
      gateFact('Reroll consequence', rerollConsequence) +
      (needsSignedActionRequest ? gateFact('Signed confirmation', gateConsequence('confirm-action-request', it)) : '');
  const actionRequestAttrs = it && it.actionRequestId
    ? ' data-action-request-id="' + esc(it.actionRequestId) + '" data-action-request-status="' + esc(it.status || 'proposed') + '" data-action-request-selected-option-id="' + esc(selectedOptionId) + '" data-ecosystem-target="action-requests"'
    : '';
  return '<div class="' + mcClass('gitem', state) + '" data-component="GateActionCard" style="--i:' + i + '" data-i="' + i + '" data-id="' + esc(it.id) + '" data-source="' + esc(gateSource(it)) + '"' + actionRequestAttrs + '>' +
    '<div class="gcard-head">' +
      mcGlyphSvg('gate', state) +
      '<div><div class="gid">' + esc(it.id) + '</div><div class="gtitle">' + esc(it.title) + '</div></div>' +
      mcStateToken(state, (it && it.status) || 'Gate review') +
    '</div>' +
    gatePriorityChips(it) +
    ((channelRoute || receiptExpectation || latestReceipt) ? '<div class="gate-route-receipt">' +
      (channelRoute ? '<div class="gate-route-pill" data-component="GateRoutePill"><b>Channel route</b><span>' + esc(channelRoute) + '</span></div>' : '') +
      (receiptExpectation ? '<div class="gate-receipt-summary" data-component="GateReceiptSummary"><b>Receipt</b><span>' + esc(receiptExpectation) + '</span></div>' : '') +
      (latestReceipt ? '<div class="gate-receipt-summary" data-component="GateLatestReceipt"><b>Latest receipt</b><span>' + esc(latestReceipt) + '</span></div>' : '') +
    '</div>' : '') +
    mcSignalRail({ state, packetCount:4 }) +
    (stale ? '<span class="gate-stale-chip" data-component="GateStaleSyncState" data-gate-stale-chip="1">' + esc(gateUpdatedAt(it)) + ' · refresh before deciding</span>' : '') +
    '<button type="button" class="gate-proof-row" data-gate-proof="1" data-interaction-kind="sheet" aria-label="Open proof details">' +
      mcGlyphSvg('proof', state === 'blocked' ? 'proof-needed' : state) +
      '<span class="gate-proof-copy"><b>Proof attached</b><small>' + esc(evidence) + '</small></span><span class="gate-proof-open" aria-hidden="true">›</span>' +
    '</button>' +
    '<div class="gbtns gate-actions' + (queuedActionRequest ? ' is-queued' : '') + '">' +
    actionButtons + '</div>' +
    '<div class="gmeta">' +
      gateFact('Decision waiting', gateSubject(it)) +
      gateFact('Branch / mission', gateBranchMission(it)) +
      (channelRoute ? gateFact('Channel route', channelRoute) : '') +
      (selectedOptionLabel ? gateFact('Selected option', selectedOptionLabel) : '') +
      (receiptExpectation ? gateFact('Receipt expectation', receiptExpectation) : '') +
      (latestReceipt ? gateFact('Latest receipt', latestReceipt) : '') +
      actionFacts +
      gateFact('Reversibility', reversibility) +
    '</div>' +
    '<div class="gitem-details" data-component="GateRowExpansionDetails">' +
      '<span><b>State</b>' + esc(state) + '</span>' +
      '<span><b>Sync</b>' + esc(stale ? 'stale; refresh before decisions' : queuedActionRequest ? 'queued; awaiting operator consumption' : gateFilterKey(it) === 'blocked' ? 'needs proof before action' : 'ready for founder review') + '</span>' +
      '<span><b>Updated</b>' + esc(gateUpdatedAt(it)) + '</span>' +
      '<span><b>Reversibility state</b>' + esc(reversibilityState) + '</span>' +
    '</div></div>';
}
function gateRows(rows){ return '<div class="kv gatekv">' + rows.map(([k,v]) => '<b>'+esc(k)+'</b><span>'+esc(v)+'</span>').join('') + '</div>'; }
function openGateSheet(arc, title, narrative, rows){
  $('sheetBody').innerHTML = '<div class="arc">' + esc(arc) + '</div><h2>' + esc(title) + '</h2>' +
    '<div class="nar">' + esc(narrative) + '</div>' + gateRows(rows);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateTelegramAuthFailure(error){
  openGateSheet('Telegram auth · blocked', 'Open inside Telegram',
    'This signed action must run inside Telegram with valid founder auth so initData can prove the founder. No local queue write was created.',
    [['source route','/api/gate/' + TENANT], ['response', error || 'missing initData (the gate opens inside Telegram)'], ['queue write','none']]);
}
function isGateAuthFailure(error){
  return /initData|Telegram|signature|auth_date|founder|verification unavailable/i.test(String(error || ''));
}
function returnFromGate(target, item){
  if (target === 'mission') MISSION_BRANCH_FOCUS = gateBranchFocus(item);
  closeSheet();
  go(target === 'mission' ? 0 : 4);
}
function openGateResultSheet(kind, subject, res, fallback, item){
  const duplicate = !!(res && res.duplicate);
  const isActionRequestConfirm = kind === 'confirm-action-request';
  const channelRoute = gateTelegramRoute(item);
  const receiptExpectation = gateReceiptExpectation(item);
  const latestReceipt = gateLatestReceipt(item);
  const rows = [['action kind', kind], ['subject', subject]];
  if (channelRoute) rows.push(['channel route', channelRoute]);
  if (latestReceipt) rows.push(['latest receipt', latestReceipt]);
  if (receiptExpectation) rows.push(['receipt expectation', receiptExpectation]);
  rows.push(['queued action', (res && res.queued) || 'missing'], ['idempotency', (res && res.idempotencyKey) || fallback.idempotencyKey], ['consequence', (res && res.consequence) || fallback.consequence], ['reversibility', (res && res.reversibility) || fallback.reversibility]);
  $('sheetBody').innerHTML = '<div class="arc">gate result · ' + esc(duplicate ? 'duplicate' : 'queued') + '</div><h2>' + esc(duplicate ? 'Original Queued Action Reused' : isActionRequestConfirm ? 'ActionRequest Signed Confirmation Queued' : 'Founder Decision Queued') + '</h2>' +
    '<div class="nar">' + esc(duplicate
      ? 'Duplicate response reused the original queued action. This does not imply a new write.'
      : isActionRequestConfirm
        ? 'Signed Mini App confirmation updated the canonical ActionRequest to queued. Client-facing send, spend, deploy, or outbound execution still waits for operator consumption.'
        : 'Signed action queued a founder decision only. Paperclip and org state do not mutate until an operator consumes the queue.') + '</div>' +
    gateRows(rows) +
    '<div class="gbtns gate-result-actions"><button type="button" class="approve" data-gate-result-refresh="1">Refresh receipt</button><button type="button" class="detail" data-gate-result-nav="mission">Mission</button><button type="button" class="reroll" data-gate-result-nav="inspect">Inspect</button></div>';
  $('sheetBody').querySelectorAll('[data-gate-result-nav]').forEach(el => el.onclick = () => {
    returnFromGate(el.dataset.gateResultNav, item);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateFailureSheet(kind, subject, error, fallback, item){
  $('sheetBody').innerHTML = '<div class="arc">gate result · refused</div><h2>Decision Not Queued</h2>' +
    '<div class="nar">The Worker refused this signed action. No local queue write was created, and branch proof is unchanged.</div>' +
    gateRows([['action kind', kind], ['subject', subject], ['reason', error || 'unknown'], ['idempotency', fallback.idempotencyKey], ['consequence', fallback.consequence], ['reversibility', fallback.reversibility], ['next step', 'Refresh Gate, then open proof details or return to Mission']]) +
    '<div class="gbtns"><button type="button" class="detail" data-gate-result-nav="mission">Mission</button><button type="button" class="reroll" data-gate-result-nav="inspect">Inspect</button></div>';
  $('sheetBody').querySelectorAll('[data-gate-result-nav]').forEach(el => el.onclick = () => {
    returnFromGate(el.dataset.gateResultNav, item);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateDetailSheet(node){
  const item = GATE_ITEMS[Number(node.dataset.i)] || {};
  const evidence = gateEvidence(item);
  const actionRequestStatus = isActionRequestGateItem(item) ? String((item && item.status) || '') : '';
  const needsSignedActionRequest = actionRequestStatus === 'needs_signed_confirmation';
  const queuedActionRequest = actionRequestStatus === 'queued';
  const detailActionKind = needsSignedActionRequest || queuedActionRequest ? 'confirm-action-request' : 'approve';
  const reversibility = gateReversibility(detailActionKind, item);
  const reversibilityState = gateReversibilityState(reversibility);
  const channelRoute = gateTelegramRoute(item);
  const receiptExpectation = gateReceiptExpectation(item);
  const actionRows = queuedActionRequest
    ? [
        ['queued consequence', gateConsequence('confirm-action-request', item)],
        ['execution boundary', 'awaiting operator consumption; no external mutation has run'],
      ]
    : [
        ['approve consequence', gateConsequence('approve', item)],
        ['reroll consequence', gateConsequence('reroll', item)],
        ...(needsSignedActionRequest ? [['signed confirmation', gateConsequence('confirm-action-request', item)]] : []),
      ];
  const narrative = needsSignedActionRequest
    ? 'Proof, consequence, reversibility, source, and sync state for this ActionRequest. The selected high-risk option requires signed Mini App confirmation.'
    : queuedActionRequest
      ? 'The signed confirmation is queued. Proof and receipt context remain available while execution waits for operator consumption.'
      : 'Proof, consequence, reversibility, source, and sync state for this Gate row. Approve and reroll still require signed preflight.';
  $('sheetBody').innerHTML = '<div class="arc">gate detail · proof</div><h2>' + esc(item.title || node.dataset.id || 'Gate item') + '</h2>' +
    '<div class="nar">' + esc(narrative) + '</div>' +
    gateRows([
      ['subject', gateSubject(item)],
      ['branch / mission', gateBranchMission(item)],
      ...(channelRoute ? [['channel route', channelRoute]] : []),
      ...(receiptExpectation ? [['receipt expectation', receiptExpectation]] : []),
      ['proof attached', evidence],
      ...actionRows,
      ['reversibility', reversibility],
      ['reversibility state', reversibilityState],
      ['source', gateOriginLabel(item)],
      ['updated at', gateUpdatedAt(item)],
      ['idempotency', gateIdempotency(detailActionKind, item)],
      ['sync state', queuedActionRequest ? 'queued; awaiting operator consumption' : gateFilterKey(item) === 'blocked' ? 'blocked until proof resolves' : 'ready for founder review'],
    ]) +
    '<div class="gbtns"><button type="button" class="detail" data-gate-detail-nav="mission">Mission</button><button type="button" class="reroll" data-gate-detail-nav="inspect">Inspect</button></div>';
  $('sheetBody').querySelectorAll('[data-gate-detail-nav]').forEach(el => el.onclick = () => {
    returnFromGate(el.dataset.gateDetailNav, item);
  });
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('light');
}
function gateSubmitAttr(name, value){ return ' data-gate-' + name + '="' + esc(value == null ? '' : value) + '"'; }
function gatePreflightSubmitAttrs(kind, subject, item, evidence, consequence, reversibility, idempotencyKey, option){
  const telegram = gateTelegramMeta(item);
  return gateSubmitAttr('confirm', kind) +
    gateSubmitAttr('subject', subject) +
    gateSubmitAttr('item-id', (item && item.id) || subject) +
    gateSubmitAttr('action-request-id', (item && (item.actionRequestId || (item.actionRequest && item.actionRequest.id))) || '') +
    gateSubmitAttr('option-id', (option && option.id) || (item && item.selectedOptionId) || '') +
    gateSubmitAttr('evidence', evidence) +
    gateSubmitAttr('consequence', consequence) +
    gateSubmitAttr('reversibility', reversibility) +
    gateSubmitAttr('idempotency-key', idempotencyKey) +
    gateSubmitAttr('branch-id', item && item.branchId) +
    gateSubmitAttr('mission-id', item && (item.missionId || item.questId)) +
    gateSubmitAttr('topic-label', telegram.topicLabel) +
    gateSubmitAttr('thread-id', telegram.threadId) +
    gateSubmitAttr('message-id', telegram.messageId) +
    gateSubmitAttr('receipt-expectation', gateReceiptExpectation(item));
}
function gateSubmitContext(button){
  const data = (button && button.dataset) || {};
  return {
    kind:data.gateConfirm || '', subject:data.gateSubject || '', itemId:data.gateItemId || '',
    actionRequestId:data.gateActionRequestId || '', optionId:data.gateOptionId || '',
    evidence:data.gateEvidence || '', consequence:data.gateConsequence || '',
    reversibility:data.gateReversibility || '', idempotencyKey:data.gateIdempotencyKey || '',
    branchId:data.gateBranchId || '', missionId:data.gateMissionId || '',
    topicLabel:data.gateTopicLabel || '', threadId:data.gateThreadId || '', messageId:data.gateMessageId || '',
    receiptExpectation:data.gateReceiptExpectation || '',
  };
}
function gateItemForSubmit(context){
  const current = GATE_ITEMS.find(item => String((item && item.id) || '') === context.itemId || String((item && item.actionRequestId) || '') === context.actionRequestId) || {};
  return Object.assign({}, current, {
    id:context.itemId || context.subject,
    actionRequestId:context.actionRequestId,
    selectedOptionId:context.optionId,
    branchId:context.branchId,
    missionId:context.missionId,
    evidence:context.evidence,
    confirmConsequence:context.consequence,
    reversibility:context.reversibility,
    telegram:{ topicLabel:context.topicLabel, threadId:context.threadId, messageId:context.messageId },
    receiptExpectation:context.receiptExpectation,
  });
}
function gateNodeForSubmit(context){
  const nodes = $('gate').querySelectorAll('.gitem');
  for (const node of nodes) {
    if ((context.itemId && node.dataset.id === context.itemId) || (context.actionRequestId && node.dataset.actionRequestId === context.actionRequestId)) return node;
  }
  return null;
}
function openGatePreflight(kind, subject, node){
  const item = GATE_ITEMS[Number(node.dataset.i)] || {};
  const evidence = gateEvidence(item);
  const consequence = gateConsequence(kind, item);
  const reversibility = gateReversibility(kind, item);
  const idempotencyKey = gateIdempotency(kind, item.id ? item : subject);
  const option = gateActionRequestOption(item);
  const channelRoute = gateTelegramRoute(item);
  const receiptExpectation = gateReceiptExpectation(item);
  const latestReceipt = gateLatestReceipt(item);
  const submitAttrs = gatePreflightSubmitAttrs(kind, subject, item, evidence, consequence, reversibility, idempotencyKey, option);
  const title = kind === 'approve' ? 'Approve Gate Item' : kind === 'confirm-action-request' ? 'Confirm ActionRequest' : 'Reroll Gate Item';
  const confirmText = kind === 'confirm-action-request' ? 'Confirm signed' : 'Confirm ' + kind;
  const rows = [['action kind',kind], ['subject',subject]];
  if (kind === 'confirm-action-request') rows.push(['selected option', (option && (option.label || option.id)) || item.selectedOptionId || 'selected option not served']);
  if (channelRoute) rows.push(['channel route', channelRoute]);
  if (latestReceipt) rows.push(['latest receipt', latestReceipt]);
  if (receiptExpectation) rows.push(['receipt expectation', receiptExpectation]);
  rows.push(['evidence',evidence], ['consequence',consequence], ['reversibility',reversibility], ['source',gateOriginLabel(item)], ['source route','/api/gate/' + TENANT], ['initData status',initData ? 'present for Worker verification' : 'missing until opened inside Telegram'], ['idempotency',idempotencyKey]);
  $('sheetBody').innerHTML = '<div class="arc">gate preflight · explicit confirmation</div><h2>' + esc(title) + '</h2>' +
    '<div class="nar">' + esc(kind === 'confirm-action-request'
      ? 'Review this signed ActionRequest confirmation before queueing it. Confirmation changes only the canonical ActionRequest state; execution still waits for operator consumption.'
      : 'Review this signed action before queueing it. Confirmation queues a founder decision only; it does not mutate Paperclip or org state.') + '</div>' +
    gateRows(rows) +
    '<div class="gate-submit-status" data-gate-submit-status="idle">Waiting for explicit signed confirmation. No queue write has been attempted.</div>' +
    '<div class="gbtns"><button type="button" class="approve"' + submitAttrs + '>' + esc(confirmText) + '</button><button type="button" class="reroll" data-gate-cancel="1">Cancel</button></div>';
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function setGateSubmitState(button, state, text){
  const status = $('sheetBody').querySelector('[data-gate-submit-status]');
  if (status) {
    status.textContent = text;
    if (status.dataset) status.dataset.gateSubmitStatus = state;
  }
  if (button) {
    const waiting = state === 'tap-received' || state === 'request-sent' || state === 'pending';
    button.textContent = waiting ? 'Queueing...' : text;
    button.disabled = waiting;
    if (button.dataset) button.dataset.gateSubmitState = state;
    if (button.setAttribute) button.setAttribute('aria-busy', waiting ? 'true' : 'false');
  }
}
function loadGate(){
  const el = $('gate');
  fetch('/api/quests/' + TENANT).then(r => r.ok ? r.json() : {}).then(d => {
    const items = gateItemsFromEnvelope(d || {});
    GATE_ITEMS = items;
    const source = '/internal/gate/' + TENANT;
    renderGateHeroDecision(items, source);
    el.innerHTML = renderGateQueue(items, source);
    loadGateWire(el, source);
  }).catch(() => {
    const source = '/internal/gate/' + TENANT;
    renderGateHeroDecision([], source);
    el.innerHTML = renderGateError(source);
  });
}
function loadGateWire(el, source){
  el.querySelectorAll('[data-gate-filter]').forEach(node => node.onclick = () => {
    GATE_FILTER = node.dataset.gateFilter || 'all';
    el.innerHTML = renderGateQueue(GATE_ITEMS, source);
    loadGateWire(el, source);
  });
  el.querySelectorAll('[data-gate-empty-nav]').forEach(node => node.onclick = () => go(node.dataset.gateEmptyNav === 'mission' ? 0 : 4));
    el.querySelectorAll('.gitem').forEach(node => {
      node.querySelectorAll('[data-kind]').forEach(button => button.onclick = () => {
        const item = GATE_ITEMS[Number(node.dataset.i)] || {};
        const kind = button.dataset.kind || 'approve';
        openGatePreflight(kind, gateActionSubject(kind, item), node);
      });
      const detail = node.querySelector('[data-gate-detail]');
      if (detail) detail.onclick = () => openGateDetailSheet(node);
      const proof = node.querySelector('[data-gate-proof]');
      if (proof) proof.onclick = () => openGateDetailSheet(node);
    });
}
function gateAct(submitButton){
  if (!submitButton || !submitButton.dataset) return;
  const priorState = submitButton.dataset.gateSubmitState || '';
  if (priorState === 'tap-received' || priorState === 'request-sent' || priorState === 'pending') return;
  const context = gateSubmitContext(submitButton);
  const kind = context.kind;
  const subject = context.subject;
  if (!kind || !subject) {
    setGateSubmitState(submitButton, 'error', 'Signed action context is incomplete. Reopen Gate and try again.');
    return;
  }
  const item = gateItemForSubmit(context);
  const node = gateNodeForSubmit(context);
  const evidence = context.evidence;
  const consequence = context.consequence;
  const reversibility = context.reversibility;
  const idempotencyKey = context.idempotencyKey;
  const payload = { kind, subject, initData, evidence, consequence, reversibility, idempotencyKey };
  if (kind === 'confirm-action-request') {
    payload.actionRequestId = context.actionRequestId || subject;
    payload.optionId = context.optionId;
  }
  buzz('medium');
  if (node && node.style) node.style.opacity = '.5';
  setGateSubmitState(submitButton, 'tap-received', 'Tap received; sending Worker request...');
  let request;
  try {
    request = fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify(payload) });
    setGateSubmitState(submitButton, 'request-sent', 'Worker request sent; waiting for response...');
  } catch (_) {
    if (node && node.style) node.style.opacity='1';
    setGateSubmitState(submitButton, 'error', 'Network failure before the Worker could queue this action.');
    openGateFailureSheet(kind, subject, 'network failure', { idempotencyKey, consequence, reversibility }, item);
    notify('error');
    return;
  }
  Promise.resolve(request)
    .then(r => Promise.resolve().then(() => r.json()).catch(() => ({ error: (r && r.ok === false) ? 'Worker returned a non-JSON refusal' : 'Worker returned an unreadable response' })).then(res => {
      if (r && r.ok === false && res && !res.error) res.error = 'Worker refused with HTTP ' + (r.status || 'error');
      return res || {};
    })).then(res => {
      if (node && node.style) node.style.opacity='1';
      if (res.queued) {
        if (node) node.innerHTML = '<div class="gnote">'+(res.duplicate ? 'original queued action reused · no new write · ' : '')+esc(kind === 'confirm-action-request' ? 'signed ActionRequest confirmation' : kind + ' founder decision')+' queued for '+esc(subject)+' — key '+esc(res.idempotencyKey || idempotencyKey)+'</div>';
        openGateResultSheet(kind, subject, res, { idempotencyKey, consequence, reversibility }, item);
        if (kind === 'confirm-action-request') setTimeout(loadGate, 350);
      } else {
        setGateSubmitState(submitButton, 'refused', 'Worker refused this signed action.');
        const error = res.error || 'unknown';
        if (node) node.innerHTML = '<div class="gnote">refused: '+esc(error)+' · no local queue write.</div>';
        if (isGateAuthFailure(error)) openGateTelegramAuthFailure(error);
        else openGateFailureSheet(kind, subject, error, { idempotencyKey, consequence, reversibility }, item);
      }
      notify(res.queued ? 'success' : 'error');
    }).catch(() => {
      if (node && node.style) node.style.opacity='1';
      setGateSubmitState(submitButton, 'error', 'Network failure before the Worker could queue this action.');
      if (node) node.innerHTML = '<div class="gnote">network failure — no local queue write.</div>';
      openGateFailureSheet(kind, subject, 'network failure', { idempotencyKey, consequence, reversibility }, item);
      notify('error');
    });
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

`;
