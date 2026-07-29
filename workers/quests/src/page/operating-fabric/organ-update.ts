import {
  ORGAN_UPDATE_PLAN,
  ORGAN_UPDATE_SUMMARY,
  organUpdatePlanForFounder,
  validateOrganUpdateDelivery,
  type OrganUpdateDelivery,
} from '../../organ-update-delivery.ts';

export type OrganUpdateViewMode = 'none' | 'detail' | 'aggregate';
export type OrganUpdateScene = 'mission' | 'flow' | 'workforce' | 'forge' | 'inspect' | 'gate';

export interface OrganUpdateViewInput {
  organUpdateDelivery?: unknown;
  organUpdateDeliverySummary?: unknown;
}

export interface OrganUpdateTopicView {
  topicKey: string;
  topicName: string;
  threadId: number;
}

export interface OrganUpdateWorkflowView {
  organ: string;
  name: string;
  triggers: string[];
  stages: string[];
  skillHints: string[];
  defaultTopic: OrganUpdateTopicView;
  escalationTopic: OrganUpdateTopicView;
  approvalRequiredFor: string;
}

export interface OrganUpdateActiveView {
  deliveryId: string;
  deliveryDigest: string;
  workObjectId: string;
  organ: string;
  trigger: string;
  status: string;
  proofRef: string;
  route: OrganUpdateTopicView;
  requiresApproval: boolean;
}

export interface NormalizedOrganUpdateView {
  mode: OrganUpdateViewMode;
  planDigest: string | null;
  workflows: OrganUpdateWorkflowView[];
  activeDeliveries: OrganUpdateActiveView[];
  workflowCount: number;
  eventDriven: boolean;
  scheduleArmed: boolean;
}

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const DELIVERY_ID = /^organ-update_[0-9a-f]{32}$/;
const SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\W)hash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|PRIVATE KEY/i;
const ORGAN_ORDER = ['genesis', 'taste', 'hands', 'will', 'cortex'];
const ORGAN_NAMES = ['Genesis', 'Taste', 'Hands', 'Will', 'Cortex'];
const TOPIC_KEYS = ['inbox', 'digests', 'dev', 'clients', 'agent_ops'];

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safe(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`);
  const text = value.trim();
  if (!text || text.length > max || SECRET_MARKER.test(text)) throw new TypeError(`${field} is invalid`);
  return text;
}

function stringList(value: unknown, field: string, limit: number): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > limit) throw new TypeError(`${field} is invalid`);
  return value.map((item, index) => safe(item, `${field}[${index}]`, 80));
}

function topicView(value: unknown, field: string): OrganUpdateTopicView {
  const row = objectValue(value);
  if (!row) throw new TypeError(`${field} must be an object`);
  const threadId = row.threadId;
  if (!Number.isSafeInteger(threadId) || Number(threadId) <= 0) throw new TypeError(`${field}.threadId is invalid`);
  return {
    topicKey: safe(row.topicKey, `${field}.topicKey`, 32),
    topicName: safe(row.topicName, `${field}.topicName`, 48),
    threadId: Number(threadId),
  };
}

function workflowView(value: unknown, index: number): OrganUpdateWorkflowView {
  const row = objectValue(value);
  if (!row) throw new TypeError(`workflows[${index}] must be an object`);
  const approval = objectValue(row.approval);
  if (!approval) throw new TypeError(`workflows[${index}].approval must be an object`);
  const workflowDigest = safe(row.workflowDigest, `workflows[${index}].workflowDigest`);
  if (!SHA256.test(workflowDigest)) throw new TypeError(`workflows[${index}].workflowDigest is invalid`);
  const result = {
    organ: safe(row.organ, `workflows[${index}].organ`, 32),
    name: safe(row.name, `workflows[${index}].name`, 48),
    triggers: stringList(row.triggers, `workflows[${index}].triggers`, 8),
    stages: stringList(row.stages, `workflows[${index}].stages`, 8),
    skillHints: stringList(row.skillHints, `workflows[${index}].skillHints`, 8),
    defaultTopic: topicView(row.defaultTopic, `workflows[${index}].defaultTopic`),
    escalationTopic: topicView(row.escalationTopic, `workflows[${index}].escalationTopic`),
    approvalRequiredFor: safe(approval.requiredFor, `workflows[${index}].approval.requiredFor`, 32),
  };
  if (
    result.organ !== ORGAN_ORDER[index]
    || result.name !== ORGAN_NAMES[index]
    || result.defaultTopic.topicKey !== TOPIC_KEYS[index]
    || result.escalationTopic.topicKey !== 'alerts'
  ) throw new TypeError(`workflows[${index}] is not canonical`);
  return result;
}

function activeView(value: unknown, index: number): OrganUpdateActiveView {
  const row = objectValue(value);
  if (!row) throw new TypeError(`activeDeliveries[${index}] must be an object`);
  const proof = objectValue(row.proof);
  if (!proof) throw new TypeError(`activeDeliveries[${index}].proof is invalid`);
  const deliveryId = safe(row.deliveryId, `activeDeliveries[${index}].deliveryId`, 64);
  const deliveryDigest = safe(row.deliveryDigest, `activeDeliveries[${index}].deliveryDigest`, 80);
  const organ = safe(row.organ, `activeDeliveries[${index}].organ`, 32);
  if (!DELIVERY_ID.test(deliveryId) || !SHA256.test(deliveryDigest) || !ORGAN_ORDER.includes(organ)) {
    throw new TypeError(`activeDeliveries[${index}] identity is invalid`);
  }
  if (row.eventDriven !== true || row.scheduleArmed !== false) {
    throw new TypeError(`activeDeliveries[${index}] scheduling boundary is invalid`);
  }
  return {
    deliveryId,
    deliveryDigest,
    workObjectId: safe(row.workObjectId, `activeDeliveries[${index}].workObjectId`, 128),
    organ,
    trigger: safe(row.trigger, `activeDeliveries[${index}].trigger`, 48),
    status: safe(row.status, `activeDeliveries[${index}].status`, 32),
    proofRef: safe(proof.ref, `activeDeliveries[${index}].proof.ref`, 128),
    route: topicView(row.route, `activeDeliveries[${index}].route`),
    requiresApproval: row.requiresApproval === true,
  };
}

export function normalizeOrganUpdateView(input: OrganUpdateViewInput): NormalizedOrganUpdateView {
  const hasDetail = input.organUpdateDelivery !== undefined && input.organUpdateDelivery !== null;
  const hasSummary = input.organUpdateDeliverySummary !== undefined && input.organUpdateDeliverySummary !== null;
  if (!hasDetail && !hasSummary) {
    return {
      mode: 'none', planDigest: null, workflows: [], activeDeliveries: [],
      workflowCount: 0, eventDriven: false, scheduleArmed: false,
    };
  }
  if (hasDetail) {
    const plan = objectValue(input.organUpdateDelivery);
    if (
      !plan
      || plan.schema !== 'cambium.organ-update-plan.v1'
      || plan.version !== 1
      || plan.readOnly !== true
      || plan.eventDriven !== true
      || plan.scheduleArmed !== false
      || !Array.isArray(plan.workflows)
      || plan.workflows.length !== 5
      || !Array.isArray(plan.activeDeliveries)
      || plan.activeDeliveries.length > 20
    ) throw new TypeError('organUpdateDelivery is invalid');
    const planDigest = safe(plan.planDigest, 'organUpdateDelivery.planDigest');
    const topicMapDigest = safe(plan.topicMapDigest, 'organUpdateDelivery.topicMapDigest');
    if (!SHA256.test(planDigest) || !SHA256.test(topicMapDigest)) throw new TypeError('organUpdateDelivery digest is invalid');
    if (!plan.activeDeliveries.every(validateOrganUpdateDelivery)) {
      throw new TypeError('organUpdateDelivery active delivery is invalid');
    }
    const expectedPlan = organUpdatePlanForFounder(plan.activeDeliveries as OrganUpdateDelivery[]);
    if (canonicalJson(plan) !== canonicalJson(expectedPlan)) {
      throw new TypeError('organUpdateDelivery canonical digest is invalid');
    }
    return {
      mode: 'detail',
      planDigest,
      workflows: plan.workflows.map(workflowView),
      activeDeliveries: plan.activeDeliveries.map(activeView),
      workflowCount: 5,
      eventDriven: true,
      scheduleArmed: false,
    };
  }
  const summary = objectValue(input.organUpdateDeliverySummary);
  if (
    !summary
    || summary.schema !== 'cambium.organ-update-delivery-summary.v1'
    || summary.version !== 1
    || summary.readOnly !== true
    || summary.eventDriven !== true
    || summary.scheduleArmed !== false
    || summary.workflowCount !== 5
    || summary.defaultTopicCount !== 5
    || summary.escalationTopicCount !== 1
    || summary.approvalRequiredWorkflowCount !== 1
  ) throw new TypeError('organUpdateDeliverySummary is invalid');
  const planDigest = safe(summary.planDigest, 'organUpdateDeliverySummary.planDigest');
  if (!SHA256.test(planDigest)) throw new TypeError('organUpdateDeliverySummary.planDigest is invalid');
  if (canonicalJson(summary) !== canonicalJson(ORGAN_UPDATE_SUMMARY)) {
    throw new TypeError('organUpdateDeliverySummary canonical digest is invalid');
  }
  return {
    mode: 'aggregate', planDigest, workflows: [], activeDeliveries: [],
    workflowCount: 5, eventDriven: true, scheduleArmed: false,
  };
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"]/g, (char) =>
    char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;');
}

function activeFor(normalized: NormalizedOrganUpdateView, workObjectId: string | null): OrganUpdateActiveView | null {
  if (!workObjectId) return null;
  return normalized.activeDeliveries.find((delivery) => delivery.workObjectId === workObjectId) ?? null;
}

export function renderOrganUpdateCanopy(
  normalized: NormalizedOrganUpdateView,
  selectedWorkObjectId: string | null = null,
): string {
  if (normalized.mode === 'none') return '';
  if (normalized.mode === 'aggregate') {
    return (
      `<section class="of-organ-plan" data-component="OrganUpdatePlan" data-organ-mode="aggregate">` +
      `<header class="of-organ-head"><div><span class="of-eyebrow">Delivery fabric</span><h3>Organ updates</h3></div>` +
      `<span class="of-badge">5 workflows · event-driven</span></header>` +
      `<p class="of-card-note">Workflow details are restricted. No recurring schedule is armed.</p>` +
      `</section>`
    );
  }
  const active = activeFor(normalized, selectedWorkObjectId);
  const cards = normalized.workflows.map((workflow) => {
    const isActive = active?.organ === workflow.organ;
    return (
      `<article class="of-card of-organ-card" data-organ="${esc(workflow.organ)}"${isActive ? ' aria-current="true"' : ''}>` +
      `<header class="of-card-head"><h4 class="of-card-title">${esc(workflow.name)}</h4>` +
      `<span class="of-badge">${esc(workflow.defaultTopic.topicName)}</span></header>` +
      `<div class="of-chip-row">${workflow.triggers.map((trigger) => `<span class="of-chip">${esc(trigger)}</span>`).join('')}</div>` +
      `<p class="of-card-note">skills · ${workflow.skillHints.map(esc).join(', ')} · hints only</p>` +
      `<p class="of-card-note">${workflow.approvalRequiredFor === 'client-audience' ? 'client delivery · Gate approval required' : 'internal receipt delivery'}</p>` +
      `</article>`
    );
  }).join('');
  return (
    `<section class="of-organ-plan" data-component="OrganUpdatePlan" data-organ-mode="detail">` +
    `<header class="of-organ-head"><div><span class="of-eyebrow">Delivery fabric</span><h3>Organ updates</h3></div>` +
    `<span class="of-badge">receipt → Telegram topic</span></header>` +
    `<p class="of-card-note" data-organ-active-state="${active ? 'receipt-backed' : 'none'}">` +
    `${active ? `${esc(active.organ)} update · ${esc(active.status)} · ${esc(active.route.topicName)}` : 'No receipt-backed organ update for the selected WorkObject.'}</p>` +
    `<div class="of-organ-grid">${cards}</div>` +
    `<p class="of-card-note">Blocked, failed, or drifted updates route to Alerts. No General fallback. No recurring schedule.</p>` +
    `</section>`
  );
}

export function renderOrganUpdateSceneContext(
  scene: OrganUpdateScene,
  normalized: NormalizedOrganUpdateView,
  selectedWorkObjectId: string | null,
): string {
  if (normalized.mode !== 'detail' || !selectedWorkObjectId) return '';
  const active = activeFor(normalized, selectedWorkObjectId);
  const workflow = active
    ? normalized.workflows.find((candidate) => candidate.organ === active.organ) ?? null
    : null;
  let detail = 'No active organ update: an authoritative receipt has not named an organ for this WorkObject.';
  if (active && workflow) {
    if (scene === 'mission') {
      detail = `${workflow.name} · ${active.status} · ${active.route.topicName}`;
    } else if (scene === 'flow') {
      detail = `${active.trigger} → ${active.route.topicName} · receipt-backed`;
    } else if (scene === 'workforce') {
      detail = `capability hints · ${workflow.skillHints.join(', ')} · not assignments`;
    } else if (scene === 'forge') {
      detail = `workflow stages · ${workflow.stages.join(' → ')} · not execution state`;
    } else if (scene === 'inspect') {
      detail = `delivery · ${active.deliveryId}<br>proof · ${active.proofRef}<br>digest · ${active.deliveryDigest}`;
    } else {
      detail = active.requiresApproval
        ? 'client-audience consequence requires the existing Mini App Gate'
        : 'delivery context only · no Gate action synthesized';
    }
  } else if (scene === 'workforce') {
    detail += ' Capability hints remain visible in Canopy; none are assignments.';
  }
  return (
    `<section class="of-organ-context" data-organ-context="${scene}" ` +
    `data-organ-active="${active ? 'receipt-backed' : 'none'}" aria-label="Organ update delivery context">` +
    `<strong>Organ update</strong><p>${detail}</p></section>`
  );
}

// Browser-valid mirror. Any supplied malformed detail throws during pre-render;
// the boot client catches it before activation and leaves the legacy shell on.
export const ORGAN_UPDATE_BROWSER_JS = String.raw`
var OF_ORGAN_BASE_PLAN = ${JSON.stringify(ORGAN_UPDATE_PLAN)};
var OF_ORGAN_BASE_SUMMARY = ${JSON.stringify(ORGAN_UPDATE_SUMMARY)};
var OF_ORGAN_ORDER = ['genesis','taste','hands','will','cortex'];
var OF_ORGAN_NAMES = ['Genesis','Taste','Hands','Will','Cortex'];
var OF_ORGAN_TOPICS = ['inbox','digests','dev','clients','agent_ops'];
var OF_ORGAN_DIGEST = /^sha256:[0-9a-f]{64}$/;
var OF_ORGAN_DELIVERY_ID = /^organ-update_[0-9a-f]{32}$/;
function ofOrganCanonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(ofOrganCanonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + ofOrganCanonicalJson(value[key]);
  }).join(',') + '}';
}
function ofOrganObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function ofOrganSafe(value, field, max) {
  var text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || OF_SECRET_MARKER.test(text)) throw new TypeError(field + ' is invalid');
  return text;
}
function ofOrganList(value, field, limit) {
  if (!Array.isArray(value) || !value.length || value.length > limit) throw new TypeError(field + ' is invalid');
  return value.map(function (item, index) { return ofOrganSafe(item, field + '[' + index + ']', 80); });
}
function ofOrganTopic(value, field) {
  var row = ofOrganObject(value);
  if (!row || !Number.isSafeInteger(row.threadId) || row.threadId <= 0) throw new TypeError(field + ' is invalid');
  return { topicKey: ofOrganSafe(row.topicKey, field + '.topicKey', 32), topicName: ofOrganSafe(row.topicName, field + '.topicName', 48), threadId: row.threadId };
}
function ofOrganWorkflow(value, index) {
  var row = ofOrganObject(value);
  var approval = row && ofOrganObject(row.approval);
  if (!row || !approval || !OF_ORGAN_DIGEST.test(ofOrganSafe(row.workflowDigest, 'workflowDigest', 80))) throw new TypeError('workflow is invalid');
  var workflow = {
    organ: ofOrganSafe(row.organ, 'organ', 32),
    name: ofOrganSafe(row.name, 'name', 48),
    triggers: ofOrganList(row.triggers, 'triggers', 8),
    stages: ofOrganList(row.stages, 'stages', 8),
    skillHints: ofOrganList(row.skillHints, 'skillHints', 8),
    defaultTopic: ofOrganTopic(row.defaultTopic, 'defaultTopic'),
    escalationTopic: ofOrganTopic(row.escalationTopic, 'escalationTopic'),
    approvalRequiredFor: ofOrganSafe(approval.requiredFor, 'approval.requiredFor', 32)
  };
  if (workflow.organ !== OF_ORGAN_ORDER[index] || workflow.name !== OF_ORGAN_NAMES[index] ||
      workflow.defaultTopic.topicKey !== OF_ORGAN_TOPICS[index] || workflow.escalationTopic.topicKey !== 'alerts') {
    throw new TypeError('workflow is not canonical');
  }
  return workflow;
}
function ofOrganActive(value) {
  var row = ofOrganObject(value);
  var proof = row && ofOrganObject(row.proof);
  if (!row || !proof || !OF_ORGAN_DELIVERY_ID.test(ofOrganSafe(row.deliveryId, 'deliveryId', 64)) ||
      !OF_ORGAN_DIGEST.test(ofOrganSafe(row.deliveryDigest, 'deliveryDigest', 80)) ||
      OF_ORGAN_ORDER.indexOf(row.organ) === -1 || row.eventDriven !== true || row.scheduleArmed !== false) {
    throw new TypeError('active delivery is invalid');
  }
  return {
    deliveryId: row.deliveryId,
    deliveryDigest: row.deliveryDigest,
    workObjectId: ofOrganSafe(row.workObjectId, 'workObjectId', 128),
    organ: row.organ,
    trigger: ofOrganSafe(row.trigger, 'trigger', 48),
    status: ofOrganSafe(row.status, 'status', 32),
    proofRef: ofOrganSafe(proof.ref, 'proof.ref', 128),
    route: ofOrganTopic(row.route, 'route'),
    requiresApproval: row.requiresApproval === true
  };
}
function ofNormalizeOrganUpdateView(input) {
  var hasDetail = input && input.organUpdateDelivery !== undefined && input.organUpdateDelivery !== null;
  var hasSummary = input && input.organUpdateDeliverySummary !== undefined && input.organUpdateDeliverySummary !== null;
  if (!hasDetail && !hasSummary) return { mode:'none', planDigest:null, workflows:[], activeDeliveries:[], workflowCount:0, eventDriven:false, scheduleArmed:false };
  if (hasDetail) {
    var plan = ofOrganObject(input.organUpdateDelivery);
    if (!plan || plan.schema !== 'cambium.organ-update-plan.v1' || plan.version !== 1 || plan.readOnly !== true ||
        plan.eventDriven !== true || plan.scheduleArmed !== false || !Array.isArray(plan.workflows) ||
        plan.workflows.length !== 5 || !Array.isArray(plan.activeDeliveries) || plan.activeDeliveries.length > 20 ||
        !OF_ORGAN_DIGEST.test(ofOrganSafe(plan.planDigest, 'planDigest', 80)) ||
        !OF_ORGAN_DIGEST.test(ofOrganSafe(plan.topicMapDigest, 'topicMapDigest', 80))) throw new TypeError('organUpdateDelivery is invalid');
    // The current browser surface admits only the exact server-pinned,
    // receipt-empty plan. Dynamic active deliveries remain hidden until the
    // browser can cryptographically recompute their delivery and plan digests.
    if (ofOrganCanonicalJson(plan) !== ofOrganCanonicalJson(OF_ORGAN_BASE_PLAN)) {
      throw new TypeError('organUpdateDelivery canonical digest is invalid');
    }
    return {
      mode:'detail', planDigest:plan.planDigest, workflowCount:5, eventDriven:true, scheduleArmed:false,
      workflows:plan.workflows.map(ofOrganWorkflow), activeDeliveries:plan.activeDeliveries.map(ofOrganActive)
    };
  }
  var summary = ofOrganObject(input.organUpdateDeliverySummary);
  if (!summary || summary.schema !== 'cambium.organ-update-delivery-summary.v1' || summary.version !== 1 ||
      summary.readOnly !== true || summary.eventDriven !== true || summary.scheduleArmed !== false ||
      summary.workflowCount !== 5 || summary.defaultTopicCount !== 5 || summary.escalationTopicCount !== 1 ||
      summary.approvalRequiredWorkflowCount !== 1 ||
      !OF_ORGAN_DIGEST.test(ofOrganSafe(summary.planDigest, 'planDigest', 80))) throw new TypeError('organUpdateDeliverySummary is invalid');
  if (ofOrganCanonicalJson(summary) !== ofOrganCanonicalJson(OF_ORGAN_BASE_SUMMARY)) {
    throw new TypeError('organUpdateDeliverySummary canonical digest is invalid');
  }
  return { mode:'aggregate', planDigest:summary.planDigest, workflows:[], activeDeliveries:[], workflowCount:5, eventDriven:true, scheduleArmed:false };
}
function ofOrganActiveFor(normalized, workObjectId) {
  if (!workObjectId) return null;
  for (var i = 0; i < normalized.activeDeliveries.length; i += 1) {
    if (normalized.activeDeliveries[i].workObjectId === workObjectId) return normalized.activeDeliveries[i];
  }
  return null;
}
function ofRenderOrganUpdateCanopy(normalized, selectedWorkObjectId) {
  if (normalized.mode === 'none') return '';
  if (normalized.mode === 'aggregate') return '<section class="of-organ-plan" data-component="OrganUpdatePlan" data-organ-mode="aggregate">' +
    '<header class="of-organ-head"><div><span class="of-eyebrow">Delivery fabric</span><h3>Organ updates</h3></div><span class="of-badge">5 workflows · event-driven</span></header>' +
    '<p class="of-card-note">Workflow details are restricted. No recurring schedule is armed.</p></section>';
  var active = ofOrganActiveFor(normalized, selectedWorkObjectId);
  var cards = normalized.workflows.map(function (workflow) {
    var isActive = active && active.organ === workflow.organ;
    return '<article class="of-card of-organ-card" data-organ="' + ofEsc(workflow.organ) + '"' + (isActive ? ' aria-current="true"' : '') + '>' +
      '<header class="of-card-head"><h4 class="of-card-title">' + ofEsc(workflow.name) + '</h4><span class="of-badge">' + ofEsc(workflow.defaultTopic.topicName) + '</span></header>' +
      '<div class="of-chip-row">' + workflow.triggers.map(function (trigger) { return '<span class="of-chip">' + ofEsc(trigger) + '</span>'; }).join('') + '</div>' +
      '<p class="of-card-note">skills · ' + workflow.skillHints.map(ofEsc).join(', ') + ' · hints only</p>' +
      '<p class="of-card-note">' + (workflow.approvalRequiredFor === 'client-audience' ? 'client delivery · Gate approval required' : 'internal receipt delivery') + '</p></article>';
  }).join('');
  return '<section class="of-organ-plan" data-component="OrganUpdatePlan" data-organ-mode="detail">' +
    '<header class="of-organ-head"><div><span class="of-eyebrow">Delivery fabric</span><h3>Organ updates</h3></div><span class="of-badge">receipt → Telegram topic</span></header>' +
    '<p class="of-card-note" data-organ-active-state="' + (active ? 'receipt-backed' : 'none') + '">' +
    (active ? ofEsc(active.organ) + ' update · ' + ofEsc(active.status) + ' · ' + ofEsc(active.route.topicName) : 'No receipt-backed organ update for the selected WorkObject.') + '</p>' +
    '<div class="of-organ-grid">' + cards + '</div><p class="of-card-note">Blocked, failed, or drifted updates route to Alerts. No General fallback. No recurring schedule.</p></section>';
}
function ofRenderOrganUpdateSceneContext(scene, normalized, selectedWorkObjectId) {
  if (normalized.mode !== 'detail' || !selectedWorkObjectId) return '';
  var active = ofOrganActiveFor(normalized, selectedWorkObjectId);
  var workflow = null;
  if (active) for (var i = 0; i < normalized.workflows.length; i += 1) if (normalized.workflows[i].organ === active.organ) workflow = normalized.workflows[i];
  var detail = 'No active organ update: an authoritative receipt has not named an organ for this WorkObject.';
  if (active && workflow) {
    if (scene === 'mission') detail = workflow.name + ' · ' + active.status + ' · ' + active.route.topicName;
    else if (scene === 'flow') detail = active.trigger + ' → ' + active.route.topicName + ' · receipt-backed';
    else if (scene === 'workforce') detail = 'capability hints · ' + workflow.skillHints.join(', ') + ' · not assignments';
    else if (scene === 'forge') detail = 'workflow stages · ' + workflow.stages.join(' → ') + ' · not execution state';
    else if (scene === 'inspect') detail = 'delivery · ' + active.deliveryId + '<br>proof · ' + active.proofRef + '<br>digest · ' + active.deliveryDigest;
    else detail = active.requiresApproval ? 'client-audience consequence requires the existing Mini App Gate' : 'delivery context only · no Gate action synthesized';
  } else if (scene === 'workforce') detail += ' Capability hints remain visible in Canopy; none are assignments.';
  return '<section class="of-organ-context" data-organ-context="' + scene + '" data-organ-active="' + (active ? 'receipt-backed' : 'none') +
    '" aria-label="Organ update delivery context"><strong>Organ update</strong><p>' + detail + '</p></section>';
}
`;
