// cambium-quests · operating fabric mission scene (Task 8 additive bundle).
// Renders the selected Work → Mission → Task lineage from explicit ids,
// contains/depends-on edges, and mission taskIds — never name/title joins.
// Desired vs observed state, dependencies, blockers, typed gaps, proof
// requirement, and receipt coverage come straight from canonical projection
// fields; readiness is never invented.
//
// Documented derivation rules (view-model mapping):
//   missions     = deduplicated by missionId and stable-sorted by missionId
//     before the 24-row bound; input order never changes visible truth.
//   tasks        = deduplicated by taskId with mission.taskIds as the explicit
//     membership source: ordered by the first membership sighting in
//     missionId order, then any unclaimed membership tasks by taskId.
//   contains     = deduplicated and sorted by kind/fromId/toId before bounding.
//   dependencies = the union of task.dependencyIds and depends-on edges
//     whose fromId is the taskId, deduplicated and sorted. Dependencies are
//     NEVER labelled blockers.
//   blockers     = only when task.status === 'blocked': the detail of typed
//     blocker gaps (kind 'blocker'/'blocked'/'missing-blocker') naming the
//     task as subjectId; 'blocker detail missing' when no typed gap carries
//     detail. A blocked task with no blocker evidence renders that honest
//     label — dependencies never masquerade as blockers.
//   proof        = task/mission proofRequirement when it is a non-empty
//     string; otherwise the explicit honest label 'proof requirement missing'
//     — never an invented 'proof required'.
//   coverage     = boolean only. latestReceiptId counts only when it resolves
//     to a canonical receipt node; an edge counts only as an exact
//     'produces'/'proves' edge whose fromId is a canonical receiptId and
//     whose toId is the taskId — a reversed task→receipt edge never counts.
//     When multiple valid receipt edges name one task, the lexicographically
//     smallest receiptId renders deterministically; coverage stays boolean.
//     Lookup dictionaries are prototype-safe (Map), so hostile ids such as
//     __proto__, constructor, or prototype never corrupt membership.
// Every id, title, objective, state, gap, proof, dependency, receipt, and
// selectedWorkId string is bounded and secret-filtered before reaching text
// or attributes. Governed actions stay with the signed Gate client; this
// scene renders an honest read-only cue and defers activation to Task 11.
import {
  renderFabricEdge,
  renderFabricState,
  renderGapState,
  type FabricGap,
} from './components.ts';
import type { MissionFabricProjectionV1 } from '../../mission-fabric.ts';

export const MISSION_LINEAGE_LIMIT = 24;

type FabricNodeOf<K extends string> = Extract<MissionFabricProjectionV1['nodes'][number], { kind: K }>;
type WorkNode = FabricNodeOf<'work'>;
type MissionNode = FabricNodeOf<'mission'>;
type TaskNode = FabricNodeOf<'task'>;
type ReceiptNode = FabricNodeOf<'receipt'>;

const BLOCKER_GAP_KINDS = new Set(['blocker', 'blocked', 'missing-blocker']);
const SECRET_MARKER = /query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;

function compareMissionId(a: MissionNode, b: MissionNode): number {
  const left = String(a.value?.missionId ?? '');
  const right = String(b.value?.missionId ?? '');
  return left < right ? -1 : left > right ? 1 : 0;
}

function dedupeSortEdges(edges: readonly MissionFabricProjectionV1['edges'][number][]): MissionFabricProjectionV1['edges'][number][] {
  const seen = new Set<string>();
  const deduped: MissionFabricProjectionV1['edges'][number][] = [];
  for (const edge of edges) {
    if (!edge) continue;
    const key = `${String(edge.kind ?? '')}|${String(edge.fromId ?? '')}|${String(edge.toId ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(edge);
  }
  return deduped.sort((a, b) => {
    const left = `${String(a.kind ?? '')}|${String(a.fromId ?? '')}|${String(a.toId ?? '')}`;
    const right = `${String(b.kind ?? '')}|${String(b.fromId ?? '')}|${String(b.toId ?? '')}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function escAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeText(value: unknown, fallback: string, max = 120): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0 || SECRET_MARKER.test(text)) return fallback;
  return escAttr(text.length > max ? `${text.slice(0, max - 1)}…` : text);
}

function safeId(value: unknown, fallback: string, max = 64): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length === 0 || SECRET_MARKER.test(text)) return fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function fact(label: string, value: string): string {
  return `<div class="of-fact"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function selectionEmpty(detail: string): string {
  return `<div class="of-mission-scene" data-component="FabricMissionLineage">${renderFabricState('empty').replace('no rows in this view', detail)}</div>`;
}

function governedCue(): string {
  return (
    `<p class="of-card-note" data-component="FabricGovernedCue">` +
    `read-only · governed by the signed Gate client · governed-action hook deferred to Task 11` +
    `</p>`
  );
}

function renderTruncatedState(kind: string, hiddenCount: number): string {
  const detail = `${hiddenCount} ${hiddenCount === 1 ? 'entry' : 'entries'} truncated at the ${kind} bound`;
  return (
    `<div class="of-state of-state-truncated" data-component="FabricState" data-state="truncated" ` +
    `role="status" aria-label="truncated: ${escAttr(detail)}">` +
    `<strong class="of-state-title">truncated</strong>` +
    `<p class="of-state-detail">${escAttr(detail)}</p>` +
    `</div>`
  );
}

function proofLabel(requirement: unknown): string {
  return typeof requirement === 'string' && requirement.trim().length > 0
    ? safeText(requirement, 'proof requirement missing')
    : 'proof requirement missing';
}

function renderTaskRow(
  task: TaskNode,
  dependencies: readonly string[],
  blockerDetails: readonly string[],
  gaps: readonly FabricGap[],
  receipt: ReceiptNode | null,
): string {
  const taskId = safeId(task.value?.taskId, 'redacted');
  const observed = safeText(task.value?.status, 'unknown state');
  const desired = safeText(task.value?.desiredState, 'unknown desired state');
  const dependencyNote =
    dependencies.length > 0
      ? fact('depends on', dependencies.map((id) => escAttr(safeId(id, 'redacted'))).join(', '))
      : '';
  const blockerNote =
    task.value?.status === 'blocked'
      ? fact('blocker', blockerDetails.length > 0 ? blockerDetails.join(' · ') : 'blocker detail missing')
      : '';
  const proofNote = fact('proof requirement', proofLabel(task.value?.proofRequirement));
  const receiptNote = fact(
    'receipt',
    receipt ? escAttr(safeId(receipt.value?.receiptId, 'redacted')) : 'no receipt',
  );
  const gapHtml = gaps.map((gap) => renderGapState(gap)).join('');
  return (
    `<li class="of-lineage-row" data-lineage-task="${escAttr(taskId)}">` +
    `<div class="of-card"><dl class="of-card-facts">` +
    fact('task', escAttr(taskId)) +
    fact('desired', desired) +
    fact('observed', observed) +
    dependencyNote +
    blockerNote +
    proofNote +
    receiptNote +
    `</dl>${gapHtml}</div></li>`
  );
}

export function renderOperatingMission(
  projection: MissionFabricProjectionV1,
  selectedWorkId: string | null,
): string {
  if (projection === null || typeof projection !== 'object' || !Array.isArray(projection.nodes)) {
    return renderFabricState('error');
  }
  if (typeof selectedWorkId !== 'string' || selectedWorkId.trim().length === 0) {
    return selectionEmpty('select a work object in Canopy to view its lineage');
  }
  const nodes = projection.nodes;
  const work = nodes.find(
    (node): node is WorkNode => node?.kind === 'work' && node.value?.workId === selectedWorkId,
  );
  if (!work) {
    return selectionEmpty('selected work object is not present in this fabric');
  }

  const edges = Array.isArray(projection.edges) ? projection.edges : [];
  const gaps = Array.isArray(projection.gaps) ? projection.gaps : [];
  // Contains edges are deduplicated and sorted by kind/fromId/toId before any
  // membership or bounding decision, so input order never changes truth.
  const sortedContains = dedupeSortEdges(edges.filter((edge) => edge?.kind === 'contains'));
  const containsTargets = new Set(
    sortedContains.filter((edge) => edge.fromId === selectedWorkId).map((edge) => edge.toId),
  );
  // Missions deduplicate by missionId and stable-sort by missionId before the
  // 24-row bound; duplicate nodes never duplicate rendered rows.
  const missionById = new Map<string, MissionNode>();
  for (const node of nodes) {
    if (node?.kind !== 'mission' || typeof node.value?.missionId !== 'string') continue;
    if (node.value.workId === selectedWorkId || containsTargets.has(node.value.missionId)) {
      if (!missionById.has(node.value.missionId)) missionById.set(node.value.missionId, node);
    }
  }
  const missions = [...missionById.values()].sort(compareMissionId);
  // Tasks deduplicate by taskId; membership stays explicit via mission.taskIds.
  const taskById = new Map<string, TaskNode>();
  for (const node of nodes) {
    if (node?.kind === 'task' && typeof node.value?.taskId === 'string' && !taskById.has(node.value.taskId)) {
      taskById.set(node.value.taskId, node);
    }
  }
  const receipts = nodes.filter((node): node is ReceiptNode => node?.kind === 'receipt');
  const receiptById = new Map(receipts.map((receipt) => [String(receipt.value?.receiptId ?? ''), receipt]));
  // Edge coverage: ONLY an exact produces/proves edge whose fromId is a
  // canonical receiptId and whose toId is the taskId. A reversed task→receipt
  // edge never counts. Multiple valid edges keep coverage boolean and render
  // the lexicographically smallest receiptId deterministically.
  const proofEdgeReceiptsByTask = new Map<string, ReceiptNode[]>();
  for (const edge of edges) {
    if (edge?.kind !== 'produces' && edge?.kind !== 'proves') continue;
    const fromReceipt = receiptById.get(String(edge.fromId));
    if (fromReceipt && typeof edge.toId === 'string') {
      const list = proofEdgeReceiptsByTask.get(edge.toId) ?? [];
      list.push(fromReceipt);
      proofEdgeReceiptsByTask.set(edge.toId, list);
    }
  }
  const proofEdgeTaskIds = new Map<string, ReceiptNode>();
  for (const [taskId, list] of proofEdgeReceiptsByTask) {
    const sorted = list.sort((a, b) =>
      String(a.value?.receiptId ?? '') < String(b.value?.receiptId ?? '') ? -1 : 1,
    );
    proofEdgeTaskIds.set(taskId, sorted[0]!);
  }

  const dependsOnEdges = edges.filter((edge) => edge?.kind === 'depends-on');
  const taskDependencies = (taskId: string, declared: unknown): string[] => {
    const ids = new Set<string>();
    if (Array.isArray(declared)) {
      for (const id of declared) if (typeof id === 'string') ids.add(id);
    }
    for (const edge of dependsOnEdges) {
      if (edge.fromId === taskId && typeof edge.toId === 'string') ids.add(edge.toId);
    }
    return [...ids].sort();
  };
  const blockerDetails = (taskId: string): string[] =>
    gaps
      .filter((gap) => gap?.subjectId === taskId && BLOCKER_GAP_KINDS.has(String(gap.kind ?? '')))
      .map((gap) => safeText(gap.detail, 'blocker detail missing'))
      .sort();

  const lineageTasks: TaskNode[] = [];
  const seenTaskIds = new Set<string>();
  const missionRows: string[] = [];
  const truncatedKinds: Array<[string, number]> = [];
  const boundedMissions = missions.slice(0, MISSION_LINEAGE_LIMIT);
  if (missions.length > boundedMissions.length) truncatedKinds.push(['mission', missions.length - boundedMissions.length]);
  for (const mission of boundedMissions) {
    const declaredIds = Array.isArray(mission.value?.taskIds) ? mission.value.taskIds : [];
    // mission.taskIds is the explicit membership source: each id resolves
    // through the deduplicated task map, so duplicates never duplicate rows.
    for (const declaredId of declaredIds) {
      if (typeof declaredId !== 'string') continue;
      const task = taskById.get(declaredId);
      if (task && !seenTaskIds.has(declaredId)) {
        seenTaskIds.add(declaredId);
        lineageTasks.push(task);
      }
    }
    const missionGaps = gaps.filter((gap) => gap?.subjectId === mission.value?.missionId);
    missionRows.push(
      `<li class="of-lineage-row" data-lineage-mission="${escAttr(safeId(mission.value?.missionId, 'redacted'))}">` +
        `<div class="of-card"><dl class="of-card-facts">` +
        fact('mission', safeText(mission.value?.title, 'unnamed mission')) +
        fact('desired', safeText(mission.value?.objective, 'unknown objective')) +
        fact('observed', safeText(mission.value?.status, 'unknown state')) +
        fact('proof requirement', proofLabel(mission.value?.proofRequirement)) +
        `</dl>${missionGaps.map((gap) => renderGapState(gap)).join('')}</div></li>`,
    );
  }

  const boundedTasks = lineageTasks.slice(0, MISSION_LINEAGE_LIMIT);
  if (lineageTasks.length > boundedTasks.length) truncatedKinds.push(['task', lineageTasks.length - boundedTasks.length]);
  const taskRows = boundedTasks.map((task) => {
    const taskId = String(task.value?.taskId ?? '');
    const dependencies = taskDependencies(taskId, task.value?.dependencyIds);
    const explicitReceipt =
      typeof task.value?.latestReceiptId === 'string' && task.value.latestReceiptId.length > 0
        ? receiptById.get(task.value.latestReceiptId) ?? null
        : null;
    const edgeReceipt = proofEdgeTaskIds.get(taskId) ?? null;
    const receipt = explicitReceipt ?? edgeReceipt;
    const taskGaps = gaps.filter((gap) => gap?.subjectId === taskId);
    return renderTaskRow(task, dependencies, blockerDetails(taskId), taskGaps, receipt);
  });

  const coverageTotal = lineageTasks.length;
  const coverageCovered = lineageTasks.filter((task) => {
    const taskId = String(task.value?.taskId ?? '');
    const explicit =
      typeof task.value?.latestReceiptId === 'string' && task.value.latestReceiptId.length > 0
        ? receiptById.get(task.value.latestReceiptId) ?? null
        : null;
    return explicit !== null || proofEdgeTaskIds.has(taskId);
  }).length;

  const lineageEmpty =
    missions.length === 0
      ? renderFabricState('empty').replace('no rows in this view', 'no missions or tasks in this lineage')
      : '';
  const missionIdSet = new Set(missions.map((mission) => mission.value?.missionId));
  const lineageEdges = sortedContains.filter(
    (edge) => edge.fromId === selectedWorkId || missionIdSet.has(edge.fromId),
  );
  const boundedEdges = lineageEdges.slice(0, MISSION_LINEAGE_LIMIT);
  if (lineageEdges.length > boundedEdges.length) truncatedKinds.push(['edge', lineageEdges.length - boundedEdges.length]);
  const edgeRows = boundedEdges
    .map((edge) => `<li class="of-lineage-edge">${renderFabricEdge(edge)}</li>`)
    .join('');
  const truncatedRows = truncatedKinds.map(([kind, hidden]) => renderTruncatedState(kind, hidden)).join('');

  const workKind = work.value?.kind === 'program' || work.value?.kind === 'sapling' ? work.value.kind : 'unknown';
  const workLifecycle =
    work.value?.kind === 'program' ? work.value?.lifecycle : (work.value?.status ?? work.value?.currentState);
  const workCard =
    `<article class="of-card" data-component="FabricWorkCard" data-lineage-work="${escAttr(safeId(selectedWorkId, 'redacted'))}" data-work-kind="${escAttr(workKind)}">` +
    `<header class="of-card-head"><h3 class="of-card-title">${safeText(work.value?.name, 'unnamed work')}</h3></header>` +
    `<div class="of-card-body"><dl class="of-card-facts">` +
    fact('type', escAttr(workKind)) +
    fact('desired', safeText(work.value?.desiredState, 'unknown desired state')) +
    fact('observed', safeText(workLifecycle, 'unknown state')) +
    `</dl></div></article>`;

  return (
    `<div class="of-mission-scene" data-component="FabricMissionLineage">` +
    workCard +
    `<span class="of-chip" data-receipt-coverage="${coverageCovered} of ${coverageTotal}">receipts ${coverageCovered} of ${coverageTotal}</span>` +
    governedCue() +
    (missions.length === 0
      ? lineageEmpty
      : `<ol class="of-lineage" data-lineage-kind="missions">${missionRows.join('')}</ol>` +
        (taskRows.length > 0
          ? `<ol class="of-lineage" data-lineage-kind="tasks">${taskRows.join('')}</ol>`
          : renderFabricState('empty').replace('no rows in this view', 'no tasks in this lineage')) +
        (edgeRows ? `<ul class="of-lineage-edges">${edgeRows}</ul>` : '') +
        truncatedRows) +
    `</div>`
  );
}

// ── browser renderer source ────────────────────────────────────────────────
// MISSION_BROWSER_JS is the browser-side mission lineage renderer, expressed
// as plain browser-valid JavaScript source (no TypeScript syntax, no imports,
// no node builtins). It mirrors the derivation rules documented above and is
// composed lexically into the operating-fabric boot script by client.ts.
// Parity with the node renderer is enforced by tests against shared fixtures
// and hostile inputs — never by textual identity.
// The browser fail-closed signature policy lives in the shared helpers block
// in client.ts as a legible normalized grammar — query_id/auth_date/token
// unanchored, hash word-bounded via (?:^|\W) — that is boolean-equivalent to
// the verbatim canonical SECRET_MARKER above (proven by a generated
// adversarial matrix with zero divergences); the Node substrate below keeps
// the canonical Task 7 regex verbatim.
export const MISSION_BROWSER_JS = String.raw`
function ofRenderMissionTruncated(kind, hiddenCount) {
  var detail = hiddenCount + ' ' + (hiddenCount === 1 ? 'entry' : 'entries') + ' truncated at the ' + kind + ' bound';
  return '<div class="of-state of-state-truncated" data-component="FabricState" data-state="truncated" role="status" aria-label="truncated: ' + ofEsc(detail) + '">' +
    '<strong class="of-state-title">truncated</strong>' +
    '<p class="of-state-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}

function ofProofLabel(requirement) {
  return typeof requirement === 'string' && requirement.trim().length > 0
    ? ofEsc(ofSafeText(requirement, 'proof requirement missing'))
    : 'proof requirement missing';
}

function ofRenderOperatingMission(projection, selectedWorkId) {
  if (!ofValidProjection(projection)) return ofRenderState('error', 'error', 'failed to load the operating fabric');
  if (typeof selectedWorkId !== 'string' || selectedWorkId.trim().length === 0) {
    return '<div class="of-mission-scene" data-component="FabricMissionLineage">' +
      ofRenderState('empty', 'empty', 'select a work object in Canopy to view its lineage') + '</div>';
  }
  var nodes = projection.nodes;
  var work = null;
  for (var wi = 0; wi < nodes.length; wi += 1) {
    if (nodes[wi] && nodes[wi].kind === 'work' && nodes[wi].value && nodes[wi].value.workId === selectedWorkId) {
      work = nodes[wi];
      break;
    }
  }
  if (!work) {
    return '<div class="of-mission-scene" data-component="FabricMissionLineage">' +
      ofRenderState('empty', 'empty', 'selected work object is not present in this fabric') + '</div>';
  }
  var edges = Array.isArray(projection.edges) ? projection.edges : [];
  var gaps = Array.isArray(projection.gaps) ? projection.gaps : [];
  // Contains edges dedupe and sort by kind/fromId/toId before membership or
  // bounding decisions, so input order never changes visible truth.
  function ofEdgeKey(edge) {
    return String(edge.kind || '') + '|' + String(edge.fromId || '') + '|' + String(edge.toId || '');
  }
  var sortedContains = [];
  var seenContains = Object.create(null);
  for (var ci = 0; ci < edges.length; ci += 1) {
    var containsEdge = edges[ci];
    if (!containsEdge || containsEdge.kind !== 'contains') continue;
    var containsKey = ofEdgeKey(containsEdge);
    if (seenContains[containsKey]) continue;
    seenContains[containsKey] = true;
    sortedContains.push(containsEdge);
  }
  sortedContains.sort(function (a, b) {
    var left = ofEdgeKey(a);
    var right = ofEdgeKey(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  var containsTargets = Object.create(null);
  var ei;
  for (ei = 0; ei < sortedContains.length; ei += 1) {
    if (sortedContains[ei].fromId === selectedWorkId) containsTargets[sortedContains[ei].toId] = true;
  }
  // Missions dedupe by missionId and stable-sort by missionId before the
  // 24-row bound; tasks dedupe by taskId with mission.taskIds as the
  // explicit membership source. Dictionaries are prototype-safe so hostile
  // ids such as __proto__ or constructor never corrupt membership.
  var missionById = Object.create(null);
  var missionIds = [];
  var taskById = Object.create(null);
  var receiptsById = Object.create(null);
  for (var ni = 0; ni < nodes.length; ni += 1) {
    var node = nodes[ni];
    if (!node || !node.value) continue;
    if (node.kind === 'mission' && typeof node.value.missionId === 'string' &&
        (node.value.workId === selectedWorkId || containsTargets[node.value.missionId])) {
      if (!missionById[node.value.missionId]) {
        missionById[node.value.missionId] = node;
        missionIds.push(node.value.missionId);
      }
    }
    if (node.kind === 'task' && typeof node.value.taskId === 'string' && !taskById[node.value.taskId]) taskById[node.value.taskId] = node;
    if (node.kind === 'receipt' && typeof node.value.receiptId === 'string') receiptsById[node.value.receiptId] = node;
  }
  missionIds.sort();
  var missions = [];
  for (var mj = 0; mj < missionIds.length; mj += 1) missions.push(missionById[missionIds[mj]]);
  // Edge coverage: ONLY an exact produces/proves edge whose fromId is a
  // canonical receiptId and whose toId is the taskId — a reversed task to
  // receipt edge never counts. Multiple valid edges keep coverage boolean
  // and render the lexicographically smallest receiptId deterministically.
  var proofEdgeReceipts = Object.create(null);
  for (ei = 0; ei < edges.length; ei += 1) {
    var edge = edges[ei];
    if (!edge || (edge.kind !== 'produces' && edge.kind !== 'proves')) continue;
    if (receiptsById[edge.fromId] && typeof edge.toId === 'string') {
      var candidates = proofEdgeReceipts[edge.toId];
      if (!candidates) {
        candidates = [];
        proofEdgeReceipts[edge.toId] = candidates;
      }
      candidates.push(String(edge.fromId));
    }
  }
  var proofEdgeTaskIds = Object.create(null);
  for (var taskKey in proofEdgeReceipts) {
    var candidateIds = proofEdgeReceipts[taskKey].sort();
    proofEdgeTaskIds[taskKey] = receiptsById[candidateIds[0]];
  }
  function dependenciesFor(task) {
    var ids = Object.create(null);
    var declared = Array.isArray(task.value.dependencyIds) ? task.value.dependencyIds : [];
    for (var di = 0; di < declared.length; di += 1) if (typeof declared[di] === 'string') ids[declared[di]] = true;
    for (var dj = 0; dj < edges.length; dj += 1) {
      var dep = edges[dj];
      if (dep && dep.kind === 'depends-on' && dep.fromId === task.value.taskId && typeof dep.toId === 'string') ids[dep.toId] = true;
    }
    return Object.keys(ids).sort();
  }
  function blockerDetailsFor(taskId) {
    var details = [];
    for (var bi = 0; bi < gaps.length; bi += 1) {
      var gap = gaps[bi];
      if (gap && gap.subjectId === taskId && (gap.kind === 'blocker' || gap.kind === 'blocked' || gap.kind === 'missing-blocker')) {
        details.push(ofEsc(ofSafeText(gap.detail, 'blocker detail missing')));
      }
    }
    return details.sort();
  }
  function receiptFor(task) {
    var explicit = typeof task.value.latestReceiptId === 'string' && task.value.latestReceiptId.length > 0
      ? receiptsById[task.value.latestReceiptId] || null
      : null;
    return explicit || proofEdgeTaskIds[task.value.taskId] || null;
  }
  function fact(label, value) {
    return '<div class="of-fact"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }
  var lineageTasks = [];
  var seenTaskIds = Object.create(null);
  var missionRows = '';
  var truncatedKinds = [];
  var boundedMissions = missions.slice(0, OF_LINEAGE_LIMIT);
  if (missions.length > boundedMissions.length) truncatedKinds.push(['mission', missions.length - boundedMissions.length]);
  for (var mi = 0; mi < boundedMissions.length; mi += 1) {
    var mission = boundedMissions[mi];
    var declaredIds = Array.isArray(mission.value.taskIds) ? mission.value.taskIds : [];
    for (var ti = 0; ti < declaredIds.length; ti += 1) {
      if (typeof declaredIds[ti] !== 'string') continue;
      var declaredTask = taskById[declaredIds[ti]];
      if (declaredTask && !seenTaskIds[declaredIds[ti]]) {
        seenTaskIds[declaredIds[ti]] = true;
        lineageTasks.push(declaredTask);
      }
    }
    var missionGaps = '';
    for (var gi = 0; gi < gaps.length; gi += 1) {
      if (gaps[gi] && gaps[gi].subjectId === mission.value.missionId) missionGaps += ofRenderGap(gaps[gi]);
    }
    missionRows += '<li class="of-lineage-row" data-lineage-mission="' + ofEsc(ofSafeId(mission.value.missionId, 'redacted')) + '">' +
      '<div class="of-card"><dl class="of-card-facts">' +
      fact('mission', ofEsc(ofSafeText(mission.value.title, 'unnamed mission'))) +
      fact('desired', ofEsc(ofSafeText(mission.value.objective, 'unknown objective'))) +
      fact('observed', ofEsc(ofSafeText(mission.value.status, 'unknown state'))) +
      fact('proof requirement', ofProofLabel(mission.value.proofRequirement)) +
      '</dl>' + missionGaps + '</div></li>';
  }
  var boundedTasks = lineageTasks.slice(0, OF_LINEAGE_LIMIT);
  if (lineageTasks.length > boundedTasks.length) truncatedKinds.push(['task', lineageTasks.length - boundedTasks.length]);
  var taskRows = '';
  var coverageCovered = 0;
  for (var li = 0; li < lineageTasks.length; li += 1) {
    if (receiptFor(lineageTasks[li])) coverageCovered += 1;
  }
  for (var ri = 0; ri < boundedTasks.length; ri += 1) {
    var task = boundedTasks[ri];
    var taskId = ofSafeId(task.value.taskId, 'redacted');
    var dependencies = dependenciesFor(task);
    var dependencyNote = dependencies.length > 0
      ? fact('depends on', dependencies.map(function (id) { return ofEsc(ofSafeId(id, 'redacted')); }).join(', '))
      : '';
    var blockerNote = '';
    if (task.value.status === 'blocked') {
      var details = blockerDetailsFor(task.value.taskId);
      blockerNote = fact('blocker', details.length > 0 ? details.join(' · ') : 'blocker detail missing');
    }
    var receipt = receiptFor(task);
    var taskGaps = '';
    for (var xi = 0; xi < gaps.length; xi += 1) {
      if (gaps[xi] && gaps[xi].subjectId === task.value.taskId) taskGaps += ofRenderGap(gaps[xi]);
    }
    taskRows += '<li class="of-lineage-row" data-lineage-task="' + ofEsc(taskId) + '">' +
      '<div class="of-card"><dl class="of-card-facts">' +
      fact('task', ofEsc(taskId)) +
      fact('desired', ofEsc(ofSafeText(task.value.desiredState, 'unknown desired state'))) +
      fact('observed', ofEsc(ofSafeText(task.value.status, 'unknown state'))) +
      dependencyNote +
      blockerNote +
      fact('proof requirement', ofProofLabel(task.value.proofRequirement)) +
      fact('receipt', receipt ? ofEsc(ofSafeId(receipt.value.receiptId, 'redacted')) : 'no receipt') +
      '</dl>' + taskGaps + '</div></li>';
  }
  var missionIdSet = Object.create(null);
  for (var ms = 0; ms < missions.length; ms += 1) missionIdSet[missions[ms].value.missionId] = true;
  var lineageEdges = [];
  for (ei = 0; ei < sortedContains.length; ei += 1) {
    var candidate = sortedContains[ei];
    if (candidate.fromId === selectedWorkId || missionIdSet[candidate.fromId]) lineageEdges.push(candidate);
  }
  var boundedEdges = lineageEdges.slice(0, OF_LINEAGE_LIMIT);
  if (lineageEdges.length > boundedEdges.length) truncatedKinds.push(['edge', lineageEdges.length - boundedEdges.length]);
  var edgeRows = '';
  for (var ui = 0; ui < boundedEdges.length; ui += 1) {
    edgeRows += '<li class="of-lineage-edge">' + ofRenderEdge(boundedEdges[ui]) + '</li>';
  }
  var truncatedRows = '';
  for (var vi = 0; vi < truncatedKinds.length; vi += 1) {
    truncatedRows += ofRenderMissionTruncated(truncatedKinds[vi][0], truncatedKinds[vi][1]);
  }
  var workKind = work.value.kind === 'program' || work.value.kind === 'sapling' ? work.value.kind : 'unknown';
  var workLifecycle = work.value.kind === 'program' ? work.value.lifecycle : (work.value.status || work.value.currentState);
  var workCard = '<article class="of-card" data-component="FabricWorkCard" data-lineage-work="' + ofEsc(ofSafeId(selectedWorkId, 'redacted')) + '" data-work-kind="' + ofEsc(workKind) + '">' +
    '<header class="of-card-head"><h3 class="of-card-title">' + ofEsc(ofSafeText(work.value.name, 'unnamed work')) + '</h3></header>' +
    '<div class="of-card-body"><dl class="of-card-facts">' +
    fact('type', ofEsc(workKind)) +
    fact('desired', ofEsc(ofSafeText(work.value.desiredState, 'unknown desired state'))) +
    fact('observed', ofEsc(ofSafeText(workLifecycle, 'unknown state'))) +
    '</dl></div></article>';
  var governed = '<p class="of-card-note" data-component="FabricGovernedCue">read-only · governed by the signed Gate client · governed-action hook deferred to Task 11</p>';
  var coverage = '<span class="of-chip" data-receipt-coverage="' + coverageCovered + ' of ' + lineageTasks.length + '">receipts ' + coverageCovered + ' of ' + lineageTasks.length + '</span>';
  var body;
  if (missions.length === 0) {
    body = ofRenderState('empty', 'empty', 'no missions or tasks in this lineage');
  } else {
    body = '<ol class="of-lineage" data-lineage-kind="missions">' + missionRows + '</ol>' +
      (taskRows
        ? '<ol class="of-lineage" data-lineage-kind="tasks">' + taskRows + '</ol>'
        : ofRenderState('empty', 'empty', 'no tasks in this lineage')) +
      (edgeRows ? '<ul class="of-lineage-edges">' + edgeRows + '</ul>' : '') +
      truncatedRows;
  }
  return '<div class="of-mission-scene" data-component="FabricMissionLineage">' + workCard + coverage + governed + body + '</div>';
}
`;
