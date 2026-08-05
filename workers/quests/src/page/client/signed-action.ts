// cambium-quests · miniapp page chunk — Gate scene + signed action client (initData, preflight, queue posts)
// T-017/T-018 rebuild: decision queue as visual state stack (frozen/02 §5), Gate Attention strip
// (frozen/03 strip 5), GateActionRow anatomy (frozen/01), single-consequence-line preflight sheet
// (frozen/05 §3 + frozen/06 §2.4). Copy per frozen/06 G1–G20. The signed-action CLIENT CONTRACT is
// frozen by docs/architecture/contracts/tg-miniapp-contract-v2.md §2: runtime initData auth, the
// POST /api/gate payload shape, idempotency keys, and the queue consume flow are unchanged.
// Assembly order: page/index.ts.
export const CLIENT_SIGNED_ACTION = `/* ── gate — one queued founder decision. initData proves the founder; the Worker validates (Ed25519). ── */
const initData = (TG && TG.initData) || '';
let GATE_ITEMS = [];
let GATE_FILTER = 'all';
let GATE_PREFLIGHT_ORIGIN = null;
/* Canonical StateToken subtitles (frozen/06 §2.3) — context-free, same words on every tab. */
const GATE_STATE_SUBTITLE = { idle:'waiting', active:'ready', selected:'current focus', complete:'verified', blocked:'needs gate review', stale:'refresh first', locked:'on hold', 'proof-needed':'evidence missing', 'reduced-motion':'waiting' };
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
function gateReceiptExpectation(it){
  const row = (it && it.actionRequest) || it || {};
  const explicit = (it && it.receiptExpectation) || row.receiptExpectation;
  return explicit ? String(explicit) : '';
}
/* v2 §1 exit rule: consumed / completed / superseded rows leave the active Gate list. */
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
function goalGraphIntakeRows(env){
  const envelope = env && env.goalGraphIntake;
  const rows = Array.isArray(envelope)
    ? envelope
    : envelope && Array.isArray(envelope.rows)
      ? envelope.rows
      : envelope && Array.isArray(envelope.goalGraphIntake)
        ? envelope.goalGraphIntake
        : [];
  return rows.filter(row => row && typeof row === 'object');
}
function isGoalGraphGateItem(it){ return !!(it && (it.goalGraphIntake || it.sourcePath === 'telegram-goal-graph-intake@v1' || it.goalGraphChangeDigest)); }
function goalGraphGateItems(env){
  /* Exit rule mirrors v2 §1: committed / stale proposals leave the active Gate list. */
  return goalGraphIntakeRows(env).filter(row => String(row.status || 'pending') === 'pending').map(row => {
    const changeDigest = String((row && row.changeDigest) || '');
    return {
      id:row.id || ('goal-graph-intake:' + (changeDigest || 'unknown')),
      goalGraphChangeDigest:changeDigest,
      title:row.title || 'Telegram goal proposal',
      source:row.source || 'telegram-goal-graph-intake@v1',
      sourcePath:'telegram-goal-graph-intake@v1',
      status:'proposed',
      owner:row.owner || 'founder',
      branchId:row.branchId || 'goal-graph',
      branchLabel:row.branchLabel || 'Goal Graph',
      clientName:row.branchLabel || 'Goal Graph',
      missionId:row.nodeId || 'goal-graph-node',
      updatedAt:row.receivedAt || row.updatedAt || 'updatedAt not served',
      evidence:row.evidence || row.summary || 'goal proposal evidence missing from gate row',
      consequence:row.consequence || 'founder signature commits this Telegram goal proposal to the goal graph; no graph write happens before approval',
      reversibility:row.reversibility || 'reversible until signed: an unsigned proposal never mutates the goal graph; a stale head is refused without a write',
      idempotencyHint:row.idempotencyHint || changeDigest || 'goal-graph-intake',
      sourceRef:row.sourceRef || '',
      receivedAt:row.receivedAt || '',
      priority:row.priority || { source:'telegram-goal-graph-intake@v1', risk:'review', dependency:'founder-signature', score:10 },
      goalGraphIntake:row,
    };
  });
}
function gateItemsFromEnvelope(env){
  const openItems = Array.isArray(env && env.openItems) ? env.openItems : [];
  return openItems.concat(actionRequestGateItems(env || {})).concat(goalGraphGateItems(env || {}));
}
function gateSource(it){ return (it && (it.paperclipSource || it.source || it.sourcePath || it.origin || (it.priority && it.priority.source))) || 'Paperclip · /internal/gate/' + TENANT; }
function gateOwner(it){ return (it && (it.owner || it.assignee || it.founder || it.operator)) || 'owner not served'; }
function gateUpdatedAt(it){ return (it && (it.updatedAt || it.updated || it.ts || it.createdAt)) || 'updatedAt not served'; }
function gateSubject(it){ return (it && (it.id || it.title)) || 'handoff'; }
function isActionRequestGateItem(it){ return !!(it && (it.actionRequest || it.sourcePath === 'cambium-action-requests@v1' || it.actionRequestId)); }
function gateActionRequestOption(it){ return actionRequestSelectedOption((it && it.actionRequest) || it || {}); }
function gateActionSubject(kind, it){
  if (kind === 'approve-goal-graph' && isGoalGraphGateItem(it)) return it.goalGraphChangeDigest || (it.goalGraphIntake && it.goalGraphIntake.changeDigest) || gateSubject(it);
  return kind === 'confirm-action-request' && isActionRequestGateItem(it) ? (it.actionRequestId || (it.actionRequest && it.actionRequest.id) || it.id || gateSubject(it)) : gateSubject(it);
}
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
  /* approve-goal-graph commits on signature (no operator consume lane), so the
     served consequence bypasses the queue-only wording guard. */
  if (kind === 'approve-goal-graph') return String((it && it.consequence) || 'founder signature commits this goal proposal to the goal graph; no graph write happens before approval');
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
  const raw = String((it && it.status) || 'proof-needed');
  /* proposed / needs_signed_confirmation are review-ready (controls enabled, gate.json states.derivation). */
  if (raw === 'proposed' || raw === 'needs_signed_confirmation') return 'review';
  const state = mcStateKind(raw);
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
/* Row display state: served status + stale sync + irreversible reversibility (gate.json states.derivation). */
function gateRowState(it){
  const raw = String((it && it.status) || 'proof-needed');
  /* proposed = ready for founder review (active); proof-needed stays the missing-status default (gate.json). */
  const base = it && it.actionRequest ? actionRequestState(it.actionRequest) : (raw === 'proposed' ? 'active' : mcStateKind(raw));
  const stale = base === 'stale' || /not served|stale|old|expired/i.test(gateUpdatedAt(it));
  if (stale) return 'stale';
  if (gateReversibilityState(gateReversibility('approve', it)) === 'blocked') return 'blocked';
  return base;
}
function gateRowSubtitle(it, state){
  if (isActionRequestGateItem(it) && String((it && it.status) || '') === 'queued') return 'awaits operator';
  return GATE_STATE_SUBTITLE[mcStateKind(state)] || 'waiting';
}
/* Left ~60px state token (icon + color + rail, never color alone); words live in the row subtitle. */
function gateRowToken(state, subtitle){
  const kind = mcStateKind(state);
  const icon = MC_STATE_ICON[kind] || MC_STATE_ICON.idle;
  return '<span class="' + mcClass('gate-row-token', kind) + '" data-component="StateToken" data-state="' + esc(kind) + '" aria-hidden="true"><i class="mc-token-icon">' + icon + '</i></span>';
}
/* Gate Attention strip (frozen/03 strip 5): quiet → attention (peach stroke + triangle, warningAttention runs once) → review (filled peach Review pill). */
function gateReviewReady(it){
  if (isActionRequestGateItem(it) && String((it && it.status) || '') === 'needs_signed_confirmation') return true;
  return gateFilterKey(it) === 'review';
}
function renderGateAttention(items){
  const review = items.filter(gateReviewReady).length;
  const blocked = items.filter(item => gateFilterKey(item) === 'blocked').length;
  const state = review > 0 ? 'review' : blocked > 0 ? 'attention' : 'quiet';
  const copy = state === 'review' ? review + ' to review' : state === 'attention' ? blocked + ' blocked' : 'gate quiet';
  const tail = state === 'review'
    ? '<button type="button" class="gate-attn-review" data-gate-attention-review="1">Review</button>'
    : (state === 'attention' ? '<span class="gate-attn-triangle" data-motion-primitive="warningAttention" aria-hidden="true">' + MC_STATE_ICON.blocked + '</span>' : '') +
      '<span class="gate-attn-chev" aria-hidden="true">›</span>';
  return '<div class="' + 'gate-attention is-' + state + '" data-component="GateAttentionStrip" data-attention-state="' + state + '">' +
    mcGlyphSvg('gate', state === 'quiet' ? 'locked' : 'blocked') +
    '<span class="gate-attn-copy">' + esc(copy) + '</span>' + tail + '</div>';
}
function renderGateQueue(items, source){
  if (!items.length) return renderGateEmpty(source);
  const filtered = items.map((item, index) => ({ item, index })).filter(row => gateFilterMatch(row.item));
  return '<div class="gate-stack-header" data-component="GateStackHeader">Decision queue</div>' +
    renderGateAttention(items) +
    renderGateFilters(items) +
    '<div class="gate-stack" data-component="GateDecisionStack">' +
    (filtered.length ? filtered.map(row => renderGateItem(row.item, row.index)).join('') : '<div class="gnote">no rows match · blockers stay under all</div>') +
    '</div>' +
    '<div class="gnote">signed decisions queue here · proof lives in Inspect</div>';
}
function renderGateHeroDecision(items, source){
  const first = items[0] || null;
  const el = $('gateHeroDecision');
  if (!el) return;
  if (!first) {
    el.innerHTML = '<b>Gate quiet</b><span>mission and inspect stay open</span>';
    el.dataset.gateHeroState = 'idle';
    return;
  }
  el.innerHTML = '<b>' + esc(gateSubject(first)) + '</b><span>' + esc(gateBranchMission(first)) + '</span>';
  el.dataset.gateHeroState = mcStateKind(first.status || 'proof-needed');
  el.dataset.source = gateSource(first) || source;
}
function renderGateEmpty(source){
  return '<div class="gate-empty" data-component="GateEmptyState" data-gate-state="empty" data-source="' + esc(source) + '">' +
    mcGlyphSvg('gate', 'locked') +
    '<div><b>no founder decisions waiting.</b><span>decisions appear here when Cambium serves open work</span>' +
      mcSignalRail({ state:'locked', packetCount:3 }) +
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
  const state = gateRowState(it);
  const subtitle = gateRowSubtitle(it, state);
  const reversibility = gateReversibility('approve', it);
  const reversibilityState = gateReversibilityState(reversibility);
  const stale = state === 'stale';
  /* frozen/06 G7: chip copy is 'stale · refresh first'; the mono timestamp rides only when served
     (the 'updatedAt not served' fallback is state logic, never rendered copy — T-028 budget). */
  const updatedAtText = gateUpdatedAt(it);
  const servedUpdatedAt = updatedAtText === 'updatedAt not served' ? '' : updatedAtText;
  const actionRequestStatus = isActionRequestGateItem(it) ? String((it && it.status) || '') : '';
  const needsSignedActionRequest = actionRequestStatus === 'needs_signed_confirmation';
  const queuedActionRequest = actionRequestStatus === 'queued';
  const selectedOption = gateActionRequestOption(it);
  const selectedOptionId = selectedOption && selectedOption.id ? selectedOption.id : ((it && it.selectedOptionId) || '');
  const goalGraphItem = isGoalGraphGateItem(it);
  const actionButtons = goalGraphItem
    ? '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="approve-goal-graph" data-kind="approve-goal-graph" data-risk-state="' + esc(reversibilityState) + '">Approve</button><button type="button" class="detail" data-gate-detail="1">Inspect</button>'
    : needsSignedActionRequest
    ? '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="confirm-action-request" data-kind="confirm-action-request" data-action-request-option-id="' + esc(selectedOptionId) + '" data-risk-state="' + esc(reversibilityState) + '">Confirm</button><button type="button" class="detail" data-gate-detail="1">Inspect</button>'
    : queuedActionRequest
      ? '<span class="gate-queued-state" data-component="GateQueuedState" data-state="queued" aria-live="polite"><span><b>Queued</b><small>awaits operator</small></span></span><button type="button" class="detail" data-gate-detail="1">Inspect</button>'
      : '<button type="button" class="approve" data-interaction-kind="signed-action" data-signed-action-entrypoint="approve" data-kind="approve" data-risk-state="' + esc(reversibilityState) + '">Approve</button><button type="button" class="reroll" data-interaction-kind="signed-action" data-signed-action-entrypoint="reroll" data-kind="reroll" data-risk-state="' + esc(reversibilityState) + '">Reroll</button><button type="button" class="detail" data-gate-detail="1">Inspect</button>';
  const actionRequestAttrs = it && it.actionRequestId
    ? ' data-action-request-id="' + esc(it.actionRequestId) + '" data-action-request-status="' + esc(it.status || 'proposed') + '" data-action-request-selected-option-id="' + esc(selectedOptionId) + '" data-ecosystem-target="action-requests"'
    : '';
  const goalGraphAttrs = it && it.goalGraphChangeDigest
    ? ' data-goal-graph-change-digest="' + esc(it.goalGraphChangeDigest) + '" data-ecosystem-target="goal-graph-intake"'
    : '';
  return '<div class="' + mcClass('gitem', state) + '" data-component="GateActionCard" style="--i:' + i + '" data-i="' + i + '" data-id="' + esc(it.id) + '" data-source="' + esc(gateSource(it)) + '"' + actionRequestAttrs + goalGraphAttrs + '>' +
    '<div class="grow-head" data-component="GateStackRow">' +
      gateRowToken(state, subtitle) +
      '<div class="grow-copy"><div class="gtitle">' + esc(it.title) + '</div><div class="gsub-line">' + esc(subtitle) + '</div></div>' +
      '<span class="gate-row-dot" aria-hidden="true"></span>' +
      '<button type="button" class="grow-chev" data-gate-detail="1" aria-label="Inspect ' + esc(it.title || it.id || 'gate item') + '">›</button>' +
    '</div>' +
    gatePriorityChips(it) +
    (stale ? '<span class="gate-stale-chip" data-component="GateStaleSyncState" data-gate-stale-chip="1">stale · refresh first' + (servedUpdatedAt ? ' · ' + esc(servedUpdatedAt) : '') + '</span>' : '') +
    '<button type="button" class="gate-proof-row" data-gate-proof="1" data-interaction-kind="sheet" aria-label="Open proof details">' +
      mcGlyphSvg('proof', state === 'blocked' ? 'proof-needed' : state) +
      '<span class="gate-proof-copy"><b>Proof</b><small>' + esc(evidence) + '</small></span><span class="gate-proof-open" aria-hidden="true">›</span>' +
    '</button>' +
    '<div class="gbtns gate-actions' + (queuedActionRequest ? ' is-queued' : '') + '">' +
    actionButtons + '</div>' +
  '</div>';
}
function isGateAuthFailure(error){
  return /initData|Telegram|signature|auth_date|founder|verification unavailable/i.test(String(error || ''));
}
function returnFromGate(target, item){
  if (target === 'mission') MISSION_BRANCH_FOCUS = gateBranchFocus(item);
  closeSheet();
  go(target === 'mission' ? 0 : 4);
}
function gateWireSheetNav(item){
  $('sheetBody').querySelectorAll('[data-gate-result-nav]').forEach(el => el.onclick = () => {
    returnFromGate(el.dataset.gateResultNav, item);
  });
}
/* Receipt token + state flip, ≤ 8 words surrounding copy (frozen/05 §3, frozen/06 G16). */
function openGateResultSheet(kind, subject, res, fallback, item){
  const duplicate = !!(res && res.duplicate);
  const goalGraph = kind === 'approve-goal-graph';
  const title = duplicate
    ? (goalGraph ? 'Original goal approval reused' : 'Original queued action reused')
    : kind === 'confirm-action-request'
      ? 'ActionRequest confirmation queued'
      : goalGraph
        ? 'Goal proposal committed'
        : 'Founder decision queued';
  const receiptLine = duplicate
    ? (goalGraph ? 'already committed · original reused' : 'decision queued · original reused')
    : (goalGraph ? 'goal graph committed · receipt in Inspect' : 'decision queued · receipt in Inspect');
  $('sheetBody').innerHTML = '<div class="arc">gate result</div><h2>' + esc(title) + '</h2>' +
    '<div class="gate-result-line" data-component="GateReceiptToken">' + mcStateToken('complete', 'receipt') + '<span>' + esc(receiptLine) + '</span></div>' +
    /* Small receipt kv (frozen/06 G19: receipt carries the mono idempotency key). The no-kv-wall rule
       governs the preflight; the result sheet is a receipt surface, Inspect-adjacent, so two rows live here. */
    '<div class="gatekv" data-component="GateReceiptDetails">' +
      '<b>queued action</b><span>' + esc((res && (res.queued || res.id || res.nodeId)) || subject) + '</span>' +
      '<b>idempotency</b><span>' + esc((res && res.idempotencyKey) || (fallback && fallback.idempotencyKey) || 'receipt pending') + '</span>' +
    '</div>' +
    '<div class="gbtns gate-result-actions"><button type="button" class="approve" data-gate-result-refresh="1">Refresh</button><button type="button" class="detail" data-gate-result-nav="mission">Mission</button><button type="button" class="reroll" data-gate-result-nav="inspect">Inspect</button></div>';
  gateWireSheetNav(item);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateFailureSheet(kind, subject, error, fallback, item){
  const network = /network failure/i.test(String(error || ''));
  $('sheetBody').innerHTML = '<div class="arc">gate result</div><h2>Decision not queued</h2>' +
    '<div class="gate-result-line">' + mcStateToken('blocked', 'blocked') + '<span>' + esc(network ? 'network failure · no write' : 'worker refused · no queue write · proof unchanged') + '</span></div>' +
    '<div class="gbtns"><button type="button" class="detail" data-gate-result-nav="mission">Mission</button><button type="button" class="reroll" data-gate-result-nav="inspect">Inspect</button></div>';
  gateWireSheetNav(item);
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function openGateTelegramAuthFailure(error){
  $('sheetBody').innerHTML = '<div class="arc">Telegram auth</div><h2>Open inside Telegram</h2>' +
    '<div class="gate-result-line">' + mcStateToken('blocked', 'blocked') + '<span>signed actions run inside Telegram with founder auth</span></div>' +
    '<div class="gbtns"><button type="button" class="detail" data-gate-result-nav="mission">Mission</button><button type="button" class="reroll" data-gate-result-nav="inspect">Inspect</button></div>';
  gateWireSheetNav({});
  veil.classList.add('on'); sheet.classList.add('on'); sheetState.open = true; buzz('medium');
}
function gateSubmitAttr(name, value){ return ' data-gate-' + name + '="' + esc(value == null ? '' : value) + '"'; }
function gatePreflightSubmitAttrs(kind, subject, item, evidence, consequence, reversibility, idempotencyKey, option, note){
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
    gateSubmitAttr('receipt-expectation', gateReceiptExpectation(item)) +
    (note != null ? gateSubmitAttr('note', note) : '');
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
    receiptExpectation:data.gateReceiptExpectation || '', note:data.gateNote || '',
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
/* frozen/06 §2.4 — the preflight sheet renders ONLY these lines (served consequence strings are payload, not copy). */
const GATE_PREFLIGHT_TITLES = { approve:'Approve gate item', reroll:'Reroll gate item', 'promote-skill':'Promote skill', 'queue-side-quest':'Queue side quest', 'confirm-action-request':'Confirm action request', 'approve-goal-graph':'Approve goal proposal' };
function gatePreflightLine(kind, subject, item, option){
  if (kind === 'approve') return 'Queues founder approval for ' + subject + '; nothing mutates until an operator consumes the queue.';
  if (kind === 'reroll') return 'Queues a reroll request for ' + subject + '; current work stays unchanged until operator consumption.';
  if (kind === 'promote-skill') return 'Queues skill promotion review for ' + subject + '; the registry changes only after operator consumption.';
  if (kind === 'queue-side-quest') return 'Queues side quest ' + subject + ' for operator follow-up; nothing completes from this device.';
  if (kind === 'approve-goal-graph') return 'Signs founder approval for ' + ((item && item.title) || 'this goal proposal') + '; the goal graph commits only after this signature.';
  const optionToken = (option && (option.id || option.label)) || (item && item.selectedOptionId) || subject;
  return 'Queues signed confirmation for ' + optionToken + '; execution waits for operator consumption of the queue.';
}
/* One preflight sheet for every signed kind (approve / reroll / promote-skill / queue-side-quest / confirm-action-request / approve-goal-graph):
   glyph + title + ONE consequence line + reversibility state token + ONE Inspect link + Confirm/Cancel. No kv walls. */
function openGatePreflight(kind, subject, node, seed){
  const seeded = seed && typeof seed === 'object';
  const item = seeded && seed.item ? seed.item : (GATE_ITEMS[Number(node && node.dataset ? node.dataset.i : NaN)] || {});
  const evidence = seeded && seed.evidence != null ? seed.evidence : gateEvidence(item);
  const consequence = seeded && seed.consequence != null ? seed.consequence : gateConsequence(kind, item);
  const reversibility = seeded && seed.reversibility != null ? seed.reversibility : gateReversibility(kind, item);
  const idempotencyKey = seeded && seed.idempotencyKey ? seed.idempotencyKey : gateIdempotency(kind, item.id ? item : subject);
  const option = gateActionRequestOption(item);
  const note = seeded && seed.note != null ? seed.note : null;
  GATE_PREFLIGHT_ORIGIN = (seeded && seed.originNode) || null;
  const reversibilityState = gateReversibilityState(reversibility);
  const submitAttrs = gatePreflightSubmitAttrs(kind, subject, item, evidence, consequence, reversibility, idempotencyKey, option, note);
  const title = GATE_PREFLIGHT_TITLES[kind] || 'Approve gate item';
  $('sheetBody').innerHTML = '<div class="arc">gate preflight</div>' +
    '<div class="gate-preflight-head">' + mcGlyphSvg('gate', reversibilityState) + '<h2>' + esc(title) + '</h2></div>' +
    '<p class="gate-preflight-line" data-component="GatePreflightConsequence">' + esc(gatePreflightLine(kind, subject, item, option)) + '</p>' +
    '<div class="gate-preflight-meta">' +
      mcStateToken(reversibilityState === 'blocked' ? 'blocked' : 'active', reversibilityState === 'blocked' ? 'irreversible' : 'until consumed') +
      '<button type="button" class="gate-inspect-link" data-gate-preflight-inspect="1">Inspect</button>' +
    '</div>' +
    '<div class="gate-submit-status" data-gate-submit-status="idle"></div>' +
    '<div class="gbtns"><button type="button" class="approve"' + submitAttrs + '>Confirm</button><button type="button" class="reroll" data-gate-cancel="1">Cancel</button></div>';
  $('sheetBody').querySelectorAll('[data-gate-preflight-inspect]').forEach(el => el.onclick = () => { closeSheet(); go(4); });
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
  el.querySelectorAll('[data-gate-attention-review]').forEach(node => node.onclick = () => {
    const items = $('gate').querySelectorAll('.gitem');
    for (const row of items) {
      const item = GATE_ITEMS[Number(row.dataset.i)] || {};
      if (gateReviewReady(item) && row.scrollIntoView) { row.scrollIntoView({ block:'center' }); return; }
    }
  });
  el.querySelectorAll('.gitem').forEach(node => {
    node.querySelectorAll('[data-kind]').forEach(button => button.onclick = () => {
      const item = GATE_ITEMS[Number(node.dataset.i)] || {};
      const kind = button.dataset.kind || 'approve';
      openGatePreflight(kind, gateActionSubject(kind, item), node);
    });
    node.querySelectorAll('[data-gate-detail]').forEach(detail => detail.onclick = () => go(4));
    node.querySelectorAll('[data-gate-proof]').forEach(proof => proof.onclick = () => go(4));
  });
}
/* Receipt token inline (frozen/06 G19): queued · <kind> · <mono key> / refused · no write / network failure · no write. */
function gateReceiptNote(node, text){
  if (!node) return;
  const html = '<div class="gnote">' + esc(text) + '</div>';
  if (node.dataset && node.dataset.i != null && node.dataset.i !== '') node.innerHTML = html;
  else if ('outerHTML' in node) node.outerHTML = html;
  else node.innerHTML = html;
}
function gateAct(submitButton){
  if (!submitButton || !submitButton.dataset) return;
  const priorState = submitButton.dataset.gateSubmitState || '';
  if (priorState === 'tap-received' || priorState === 'request-sent' || priorState === 'pending') return;
  const context = gateSubmitContext(submitButton);
  const kind = context.kind;
  const subject = context.subject;
  if (!kind || !subject) {
    setGateSubmitState(submitButton, 'error', 'context incomplete · reopen gate');
    return;
  }
  const item = gateItemForSubmit(context);
  /* Prefer the seeded origin node (Tools handoff card / side-quest / skill rows) so the receipt
     token + state flip land on the surface the founder tapped; Gate card clicks leave
     GATE_PREFLIGHT_ORIGIN null and resolve through the queue as before. */
  const node = GATE_PREFLIGHT_ORIGIN || gateNodeForSubmit(context);
  const evidence = context.evidence;
  const consequence = context.consequence;
  const reversibility = context.reversibility;
  const idempotencyKey = context.idempotencyKey;
  const payload = { kind, subject, initData, evidence, consequence, reversibility, idempotencyKey };
  if (kind === 'confirm-action-request') {
    payload.actionRequestId = context.actionRequestId || subject;
    payload.optionId = context.optionId;
  }
  if (context.note) payload.note = context.note;
  buzz('medium');
  if (node && node.style) node.style.opacity = '.5';
  setGateSubmitState(submitButton, 'tap-received', 'sending…');
  let request;
  try {
    request = fetch('/api/gate/' + TENANT, { method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify(payload) });
    setGateSubmitState(submitButton, 'request-sent', 'sending…');
  } catch (_) {
    if (node && node.style) node.style.opacity='1';
    setGateSubmitState(submitButton, 'error', 'network failure · no write');
    gateReceiptNote(node, 'network failure · no write');
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
      /* approve-goal-graph commits on signature: the worker answers { ok, committed, ... }
         instead of a queued receipt, so success is res.committed for that kind. */
      const succeeded = !!res.queued || (kind === 'approve-goal-graph' && res.committed === true);
      if (succeeded) {
        if (kind === 'approve-goal-graph') {
          gateReceiptNote(node, res.duplicate
            ? 'goal graph committed · original approval reused'
            : 'committed · approve-goal-graph · ' + String(res.headDigest || idempotencyKey || '').replace(/^sha256:/, '').slice(0, 12));
        } else {
          gateReceiptNote(node, res.duplicate ? 'decision queued · original reused · ' + (res.idempotencyKey || idempotencyKey) : 'queued · ' + kind + ' · ' + (res.idempotencyKey || idempotencyKey));
        }
        setGateSubmitState(submitButton, 'queued', kind === 'approve-goal-graph' ? 'committed' : 'queued');
        openGateResultSheet(kind, subject, res, { idempotencyKey, consequence, reversibility }, item);
        if (kind === 'confirm-action-request' || kind === 'approve-goal-graph') setTimeout(loadGate, 350);
      } else {
        setGateSubmitState(submitButton, 'refused', 'refused · no write');
        const error = res.error || 'unknown';
        gateReceiptNote(node, 'refused · no write');
        if (isGateAuthFailure(error)) openGateTelegramAuthFailure(error);
        else openGateFailureSheet(kind, subject, error, { idempotencyKey, consequence, reversibility }, item);
      }
      notify(succeeded ? 'success' : 'error');
    }).catch(() => {
      if (node && node.style) node.style.opacity='1';
      setGateSubmitState(submitButton, 'error', 'network failure · no write');
      gateReceiptNote(node, 'network failure · no write');
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
/* frozen/06 G20 + §2.4: promote-skill and queue-side-quest route through the SAME preflight sheet as other gate actions. */
function sideQuestAct(side, node){
  const id = sideQuestQueueId(side);
  openGatePreflight('queue-side-quest', id, null, {
    item:{ id, branchId:(side && side.branchId) || '', missionId:(side && (side.questId || side.id)) || '' },
    evidence:sideQuestQueueEvidence(side),
    consequence:sideQuestQueueConsequence(side),
    reversibility:sideQuestQueueReversibility(),
    idempotencyKey:sideQuestQueueIdempotency(side),
    note:side.detail || '',
    originNode:node,
  });
}
function skillPromotionAct(skill, node){
  openGatePreflight('promote-skill', skill.title, null, {
    item:{ id:skill.title },
    evidence:skillPromotionEvidence(skill),
    consequence:skillPromotionConsequence(skill),
    reversibility:skillPromotionReversibility(),
    idempotencyKey:skillPromotionIdempotency(skill),
    originNode:node,
  });
}
/* T-019/T-020 extension: Tools handoff rows run through the SAME preflight sheet + queue client
   as Gate cards (extend, not rewrite). The origin node is the Handoffs surface card, so the
   receipt token + state flip land on the Tools tab without leaving it. Served consequence /
   reversibility / idempotency defaults come from the shared gate helpers. */
function toolHandoffAct(kind, handoff, node){
  const id = String((handoff && (handoff.id || handoff.title)) || 'handoff');
  openGatePreflight(kind === 'reroll' ? 'reroll' : 'approve', id, null, {
    item:{
      id,
      title:(handoff && handoff.title) || id,
      evidence:(handoff && (handoff.evidence || handoff.title)) || 'handoff evidence missing',
      branchId:(handoff && handoff.branchId) || '',
      missionId:(handoff && handoff.missionId) || '',
    },
    originNode:node,
  });
}

`;

// CONTEXTUAL_SHEET_RETURN_BROWSER_JS: browser-valid ES5-ish JavaScript installer.
// Installed only AFTER successful authenticated activation (called from client.ts),
// and safe to run on every activation: install state lives on the shared sheet
// object, not on a local closure var, so it survives across separate invocations
// of this installer body and stays idempotent — the wrap and the sheetBody
// listener each apply exactly once for the lifetime of the page.
// Captures lexical closeSheet (not window.closeSheet): reassigning the bare
// identifier updates the one global binding every other chunk already
// references (veil.onclick, drag-to-dismiss, gate cancel), so all of those
// routes keep resolving through the wrapped close without their own changes.
export const CONTEXTUAL_SHEET_RETURN_BROWSER_JS = String.raw`
(function () {
  if (!sheet || sheet._ofContextualSheetInstalled) return;
  sheet._ofContextualSheetInstalled = true;
  // Capture lexical closeSheet from the outer scope — never window.closeSheet.
  var ofOriginalClose = closeSheet;
  sheet._ofReturnCallback = null;
  sheet._ofSetReturnCallback = function (cb) { sheet._ofReturnCallback = cb; };
  sheet._ofClearReturnCallback = function () { sheet._ofReturnCallback = null; };
  // Reassign closeSheet in this scope: clears the callback slot, calls the
  // original close once, then invokes the callback once.
  closeSheet = function ofContextualClose() {
    var cb = sheet._ofReturnCallback;
    sheet._ofReturnCallback = null;
    ofOriginalClose();
    if (typeof cb === 'function') cb();
  };
  // Re-bind veil.onclick to the new closeSheet.
  if (veil) veil.onclick = closeSheet;
  // Single non-stacking sheetBody listener: Back / Close / Gate-close all
  // route through the wrapped lexical closeSheet.
  var sb = document.getElementById('sheetBody');
  if (sb) {
    sb.addEventListener('click', function (e) {
      var target = e && e.target;
      if (!target) return;
      var backEl = typeof target.closest === 'function' ? target.closest('[data-of-inspect-back]') : null;
      if (backEl) { if (e.preventDefault) e.preventDefault(); closeSheet(); return; }
      var closeEl = typeof target.closest === 'function' ? target.closest('[data-of-inspect-close]') : null;
      if (closeEl) { if (e.preventDefault) e.preventDefault(); closeSheet(); return; }
      var gateCloseEl = typeof target.closest === 'function' ? target.closest('[data-of-gate-sheet-close]') : null;
      if (gateCloseEl) { if (e.preventDefault) e.preventDefault(); closeSheet(); return; }
    });
  }
})();
`;

// OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS: composed ONLY into OPERATING_FABRIC_BOOT
// (never into CLIENT_SIGNED_ACTION). Reuses the SAME legacy auth/signing/
// preflight functions every other Gate surface uses — openGatePreflight for
// the preflight sheet, gateAct for the POST /api/gate/:tenant submit —
// without duplicating validation, signing, payload shape, or double-submit
// guards. Both functions are declared by CLIENT_SIGNED_ACTION as top-level
// function declarations in the same page's global scope; this module wraps
// them (capturing the originals first) so:
//   - openGatePreflight, once wrapped, binds the exact served descriptor
//     (changeDigest, tenant, nonce, expiresAt, expectedHeadVersion, fence)
//     from the seed onto the actual rendered confirm control as data
//     attributes, for approve-goal-graph only.
//   - gateAct, once wrapped, reads those exact bound fields off the confirm
//     control and — for approve-goal-graph only — POSTs exactly
//     { kind, subject, changeDigest, tenant, nonce, expiresAt,
//       expectedHeadVersion, fence, initData } to /api/gate/:tenant,
//     NEVER actor, reusing the legacy double-submit state machine
//     (setGateSubmitState/gateSubmitContext/gateReceiptNote/openGateResultSheet/
//     openGateFailureSheet) verbatim via the original gateAct's helpers.
//   - Any non-approve-goal-graph action falls straight through to the
//     ORIGINAL openGatePreflight / gateAct — never re-implemented, never
//     skipped. A goal-graph action with a missing, malformed, or expired
//     descriptor never falls through: openGatePreflight simply does not open
//     a preflight (so no Confirm control ever exists to bind to), and gateAct
//     fails closed with zero delegation to the original and zero fetch.
// If CLIENT_SIGNED_ACTION has not run yet, both wraps are no-ops.
export const OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS = String.raw`
(function () {
  if (typeof openGatePreflight !== 'function' || typeof gateAct !== 'function') return;
  if (openGatePreflight._ofWrapped) return;
  var ofOriginalOpenGatePreflight = openGatePreflight;
  var ofOriginalGateAct = gateAct;
  // ofBoundDescriptors: WeakMap-free registry keyed by the confirm button
  // itself, so the exact fence/nonce/expiry bound at preflight-open time is
  // exactly what gateAct reads at submit time — never re-derived, never
  // read back from the DOM's own (possibly stale) rendered text.
  var ofBoundDescriptors = [];
  function ofSetBoundDescriptor(node, descriptor) {
    for (var i = 0; i < ofBoundDescriptors.length; i++) {
      if (ofBoundDescriptors[i].node === node) { ofBoundDescriptors[i].descriptor = descriptor; return; }
    }
    ofBoundDescriptors.push({ node: node, descriptor: descriptor });
  }
  function ofGetBoundDescriptor(node) {
    for (var i = 0; i < ofBoundDescriptors.length; i++) {
      if (ofBoundDescriptors[i].node === node) return ofBoundDescriptors[i].descriptor;
    }
    return null;
  }
  function ofNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
  function ofFiniteNumber(value) { return typeof value === 'number' && isFinite(value); }
  // ofSafeBoundedString: internal-registration-only guard for a served field
  // used to key or transmit the descriptor. Rejects empty, overlong, and
  // control-character values. Never used to build DOM content.
  function ofSafeBoundedString(value, max) {
    if (typeof value !== 'string') return false;
    var trimmed = value.trim();
    if (trimmed.length === 0 || value.length > max) return false;
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code <= 31 || code === 127) return false;
    }
    return true;
  }
  function ofNonnegativeSafeInteger(value) {
    return typeof value === 'number' && isFinite(value) && Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
  }
  // ofValidDescriptorSeed: fail-closed — every one of the six served fields
  // must be present and well-formed, tenant must equal the page's own TENANT
  // (never a seed-supplied tenant), changeDigest must be exactly the canonical
  // goal-graph digest shape — bare 64 lowercase hex (the shape sha256() in
  // goal-graph/identity.ts actually returns) or that same digest with an
  // optional sha256: prefix (the shape the Worker's own changeDigest guard at
  // handler.ts also accepts) — nonce/expiresAt must be bounded safe strings,
  // graphVersion/fence must be nonnegative safe integers, and expiresAt must
  // parse to a future instant — or the descriptor is rejected outright
  // (never partially bound).
  function ofValidDescriptorSeed(seed) {
    if (!seed || typeof seed !== 'object') return false;
    if (!/^(?:sha256:)?[0-9a-f]{64}$/.test(String(seed.changeDigest || ''))) return false;
    if (seed.tenant !== TENANT) return false;
    if (!ofSafeBoundedString(seed.nonce, 128)) return false;
    if (!ofNonEmptyString(seed.expiresAt) || seed.expiresAt.length > 64) return false;
    if (!ofNonnegativeSafeInteger(seed.graphVersion)) return false;
    if (!ofNonnegativeSafeInteger(seed.fence)) return false;
    var expiresAtMs = Date.parse(seed.expiresAt);
    if (!isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
    return true;
  }
  openGatePreflight = function ofWrappedOpenGatePreflight(kind, subject, node, seed) {
    if (kind !== 'approve-goal-graph') { ofOriginalOpenGatePreflight(kind, subject, node, seed); return; }
    // Validate BEFORE opening the preflight: an invalid/missing/expired
    // descriptor opens no preflight at all, so no Confirm control ever exists
    // for it to bind to and no submit can ever follow.
    if (!ofValidDescriptorSeed(seed)) return;
    ofOriginalOpenGatePreflight(kind, subject, node, seed);
    var confirmNode = typeof $ === 'function' && $('sheetBody')
      ? $('sheetBody').querySelector('[data-gate-confirm="approve-goal-graph"]')
      : null;
    if (!confirmNode) return;
    ofSetBoundDescriptor(confirmNode, {
      changeDigest: seed.changeDigest,
      tenant: seed.tenant,
      nonce: seed.nonce,
      expiresAt: seed.expiresAt,
      expectedHeadVersion: seed.graphVersion,
      fence: seed.fence,
    });
  };
  openGatePreflight._ofWrapped = true;
  function ofFailClosed(submitButton) {
    if (submitButton && submitButton.dataset && typeof setGateSubmitState === 'function') {
      setGateSubmitState(submitButton, 'error', 'context incomplete · reopen gate');
    }
  }
  gateAct = function ofWrappedGateAct(submitButton) {
    // Inspect gateSubmitContext FIRST: non-goal kinds delegate to the
    // original with zero bridge logic and zero fetch of their own.
    var context = gateSubmitContext(submitButton);
    var kind = context.kind;
    var subject = context.subject;
    if (kind !== 'approve-goal-graph') { ofOriginalGateAct(submitButton); return; }
    // approve-goal-graph: fail closed on any invalid state — missing/malformed
    // descriptor, expired descriptor, or a bound tenant that no longer matches
    // TENANT — with ZERO delegation to the original and ZERO fetch.
    var descriptor = submitButton ? ofGetBoundDescriptor(submitButton) : null;
    if (!descriptor) { ofFailClosed(submitButton); return; }
    if (!ofValidDescriptorSeed({
      changeDigest: descriptor.changeDigest,
      tenant: descriptor.tenant,
      nonce: descriptor.nonce,
      expiresAt: descriptor.expiresAt,
      graphVersion: descriptor.expectedHeadVersion,
      fence: descriptor.fence,
    })) { ofFailClosed(submitButton); return; }
    if (!subject) { ofFailClosed(submitButton); return; }
    if (!submitButton.dataset) return;
    var priorState = submitButton.dataset.gateSubmitState || '';
    if (priorState === 'tap-received' || priorState === 'request-sent' || priorState === 'pending') return;
    var item = gateItemForSubmit(context);
    var evidence = context.evidence;
    var consequence = context.consequence;
    var reversibility = context.reversibility;
    // Exactly these fields, plus initData — never actor.
    var payload = {
      kind: kind,
      subject: subject,
      changeDigest: descriptor.changeDigest,
      tenant: descriptor.tenant,
      nonce: descriptor.nonce,
      expiresAt: descriptor.expiresAt,
      expectedHeadVersion: descriptor.expectedHeadVersion,
      fence: descriptor.fence,
      initData: initData,
    };
    buzz('medium');
    setGateSubmitState(submitButton, 'tap-received', 'sending…');
    var request;
    try {
      request = fetch('/api/gate/' + descriptor.tenant, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setGateSubmitState(submitButton, 'request-sent', 'sending…');
    } catch (_) {
      setGateSubmitState(submitButton, 'error', 'network failure · no write');
      openGateFailureSheet(kind, subject, 'network failure', { idempotencyKey: context.idempotencyKey, consequence: consequence, reversibility: reversibility }, item);
      notify('error');
      return;
    }
    Promise.resolve(request)
      .then(function (r) {
        return Promise.resolve()
          .then(function () { return r.json(); })
          .catch(function () { return { error: (r && r.ok === false) ? 'Worker returned a non-JSON refusal' : 'Worker returned an unreadable response' }; })
          .then(function (res) {
            if (r && r.ok === false && res && !res.error) res.error = 'Worker refused with HTTP ' + (r.status || 'error');
            return res || {};
          });
      })
      .then(function (res) {
        var succeeded = res.committed === true;
        if (succeeded) {
          setGateSubmitState(submitButton, 'queued', 'committed');
          openGateResultSheet(kind, subject, res, { idempotencyKey: context.idempotencyKey, consequence: consequence, reversibility: reversibility }, item);
          setTimeout(loadGate, 350);
        } else {
          setGateSubmitState(submitButton, 'refused', 'refused · no write');
          var error = res.error || 'unknown';
          if (isGateAuthFailure(error)) openGateTelegramAuthFailure(error);
          else openGateFailureSheet(kind, subject, error, { idempotencyKey: context.idempotencyKey, consequence: consequence, reversibility: reversibility }, item);
        }
        notify(succeeded ? 'success' : 'error');
      })
      .catch(function () {
        setGateSubmitState(submitButton, 'error', 'network failure · no write');
        openGateFailureSheet(kind, subject, 'network failure', { idempotencyKey: context.idempotencyKey, consequence: consequence, reversibility: reversibility }, item);
        notify('error');
      });
  };
})();
`;
