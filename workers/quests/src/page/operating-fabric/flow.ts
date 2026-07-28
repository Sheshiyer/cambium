// cambium-quests · operating fabric flow scene (Task 9 additive bundle).
// Renders deterministic Task → Run → Receipt columns with visible directional
// paths from the exact MissionFabricProjectionV1 truth. Derivation runs only
// on explicit ids, canonical edges, and typed gaps — never title joins, never
// substring joins, never invented readiness/progress, never causal invention,
// never direct actions.
//
// Documented derivation rules (view-model mapping):
//   rows      = one per deduplicated canonical task node, stable-sorted by
//               taskId; input order never changes visible truth. Lookup
//               dictionaries are prototype-safe (Map / Object.create(null)),
//               so hostile ids such as __proto__ or constructor never corrupt
//               membership.
//   duplicates= nodes sharing one canonical kind+ID reconcile to EXACTLY ONE
//               canonical node by a deterministic tie-break over EXPLICIT
//               per-kind operational fields only — canonical lineage fields
//               (taskId on runs, runId/taskId on receipts), rendered
//               statuses/states, rendered dependencies, and the assignment
//               field the agentId filter reads — with the pairwise
//               lexicographically smaller canonical form winning. Selection
//               compares the full normalized raw value of each operational
//               field through injective canonical JSON and code-unit
//               ordering, so every distinct hostile lineage ID stays
//               distinguishable without any digest or probabilistic
//               collision claim. Raw hostile values are read solely to
//               order candidates inside the comparator and are never
//               rendered, logged, or placed in a public fact ID.
//               Titles, evidenceRefs, digests, approvalRef, sourceRef,
//               prompts/payloads, and every other non-rendered proof
//               material NEVER decide a winner; when excluded fields are
//               the only difference, surviving object identity may follow
//               input order but every rendered/filtered/topology byte is
//               provably identical. Selection never reads input order,
//               object insertion order, or locale-sensitive comparison, and
//               never merges contradictory fields into a synthetic node.
//   filters   = { workId?, agentId?, state? } apply FIRST, before the fact
//               bound. workId scopes through contains edges (work→mission,
//               mission→task); agentId matches exact canonical executes and
//               assigned-to edges plus the task's assignedAgentId field —
//               never run.value.agentId alone; state matches the canonical
//               task status. Title text never matches, and secret-bearing
//               filter input matches nothing and never echoes.
//   bound     = the candidate fact universe is computed across ALL rows of
//               the filtered view first — every distinct canonical Task, Run,
//               and Receipt node — then a deterministic column+canonical-ID
//               bound caps the visible set at exactly 96, task column
//               included. Overflow renders the exact copy 'showing 96 of N'
//               where N counts every distinct fact in the FILTERED view
//               (never only kept rows, never duplicate hostile nodes or
//               contradictory links twice). Rows whose task fact is beyond
//               the bound never render.
//   runs      = canonical run nodes whose run.taskId resolves to the row's
//               taskId. Rejected stale-fence or unverifiable-fence runs are
//               never run nodes: the projection drops them, and the scene
//               renders their typed 'stale-fence'/'unverifiable-fence' gaps
//               as the only fence truth. No current fence, stale fence, or
//               readiness value is ever invented.
//   executor  = per run, only when an exact 'executes' edge (agentId →
//               runId) resolves to a canonical agent node; otherwise the
//               honest label 'executor not present in projection' and the raw
//               id never renders. Two runs in one row resolve independently.
//   receipts  = canonical receipt nodes render as bounded id+status facts
//               when their node is canonical AND either receipt.runId
//               resolves to a canonical run OR an exact produces/proves edge
//               resolves to canonical nodes.
//   proof     = proof comes ONLY from exact canonical edges that AGREE with
//               the receipt's canonical ownership, attached to the CURRENT
//               row's bounded receipt fact: 'produces' requires runId →
//               receiptId where the run belongs to the row AND the run's
//               task equals the receipt's canonical taskId; 'proves'
//               requires receiptId → the row's own taskId AND the receipt's
//               canonical taskId equals that task AND the receipt's canonical
//               run resolves to a run whose task is the same task.
//               Contradictory, wrong-target, cross-task, conflicting-run,
//               reversed, missing-target, and bare fields grant nothing on
//               any row. Every rendered proof stays attached to its bounded
//               receipt fact with bounded ID/status — there are no
//               target-only proof chips.
//   gaps      = typed fence gaps attach only through exact canonical IDs,
//               computed against the FULL canonical row set BEFORE filters
//               run: the gap subjectId equals the row's taskId or one of the
//               row's existing runIds. Substring, title, and detail joins
//               never attach. A gap that attaches to a filtered-out row is
//               dropped with that row — it never reappears as 'unscoped'.
//               Only a genuinely unmappable gap (naming only a rejected
//               absent run or no selected row) stays in an honest unscoped
//               typed-gap section rendered in BOTH representations — even
//               when the view has zero task rows. No run, fence, or cause is
//               invented. Empty state is valid only when there are no
//               selected rows AND no relevant unscoped typed gaps.
//   missing   = a task with no accepted run renders 'run not present in
//               projection'; an accepted run with no canonical receipt
//               renders 'receipt not present in projection'. Causes are never
//               invented; typed source gaps render separately.
//   parity    = the visual graph is an aria-hidden three-column table (no
//               span siblings under tr, no fourth td); the accessible linear
//               list is the semantic truth and carries observed/desired
//               state, dependencies, per-run status/executor, per-receipt
//               status/proof, typed gaps, and honest missing labels. Both
//               expose the exact same unique fact-ID set. Direction is
//               visible through static path markup inside cells — never
//               animation-dependent.
//   redaction = every projection-derived text AND attribute — fact IDs, row
//               IDs, dependency/executor/proof attributes, gap subjects and
//               details — passes the bounded fail-closed canonical policy.
//               Secret-bearing canonical IDs never render raw: the fact-ID
//               layer assigns each DISTINCT selected canonical node a
//               collision-safe, deterministic, non-secret public ID from one
//               of two PROVABLY DISJOINT namespaces — benign raw IDs render
//               as `${kind}:id:${bounded benign raw}` and hostile IDs render
//               as `${kind}:redacted:${ordinal}` (kind-scoped redacted
//               ordinals derived from the canonical full-column order). The
//               `id:` and `redacted:` segments can never collide: no
//               user-controlled benign raw ID can ever equal a generated
//               redacted identity, so every distinct selected fact keeps a
//               unique graph/list ID and the combined visible node count
//               still caps at 96. Fact selection/counting keys on canonical
//               fact keys — never on display or public IDs — and truncation
//               accounting is byte-identical across substrates. Row identity
//               is the disjoint public row ID `task:${taskPublicId}`, never
//               the visible display label. Raw evidenceRefs, raw digests,
//               payloads, prompts, tokens, Telegram auth, and private client
//               data never render.
// The scene is read-only: no write path, no Gate/RBAC/assignment logic, no
// fetch, no event handlers.
import {
  renderFabricState,
  type FabricGap,
} from './components.ts';
import type { MissionFabricProjectionV1 } from '../../mission-fabric.ts';

export const FLOW_FACT_LIMIT = 96;

type FabricNodeOf<K extends string> = Extract<MissionFabricProjectionV1['nodes'][number], { kind: K }>;
type TaskNode = FabricNodeOf<'task'>;
type RunNode = FabricNodeOf<'run'>;
type ReceiptNode = FabricNodeOf<'receipt'>;
type AgentNode = FabricNodeOf<'agent'>;
type FabricEdge = MissionFabricProjectionV1['edges'][number];

const SECRET_MARKER = /query_id=|auth_date=|\bhash=|Bearer\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\bprompt\s*[:=]|prompt\s+injection/i;
const FENCE_GAP_KINDS = new Set(['stale-fence', 'unverifiable-fence']);
const REDACTED_ID = 'redacted';

export interface FlowFilters {
  workId?: string;
  agentId?: string;
  state?: string;
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

// Collision-safe public identity: every DISTINCT selected canonical node
// gets a unique, deterministic, non-secret public identity from one of two
// PROVABLY DISJOINT namespaces. Benign raw IDs render inside the reserved
// `id:` namespace (`${kind}:id:${bounded benign raw}`); hostile raw IDs
// render inside the reserved `redacted:` namespace
// (`${kind}:redacted:${ordinal}`, ordinals derived from the canonical
// full-column order). Because every benign identity carries the `id:`
// segment and every generated redacted identity carries the `redacted:`
// segment, no user-controlled benign raw ID can ever equal a generated
// redacted identity — the scheme is injective over the union of both
// input classes by construction, in both substrates. Secret-bearing or
// overlong raw IDs never render; their nodes still keep unique public IDs
// so nothing is lost to collisions and graph/list parity holds exactly.
// Visible display labels are a separate concern: benign labels stay bounded
// raw text and hostile labels stay non-secret ordinals, but display labels
// are NEVER used as identity (fact selection/counting keys on canonical
// fact keys; row identity is the disjoint public row ID below).
export const FILTER_INPUT_LIMIT = 64;

function isHostileId(rawId: string): boolean {
  const text = rawId.trim();
  return text.length === 0 || text.length > FILTER_INPUT_LIMIT || SECRET_MARKER.test(text);
}

function publicDisplayId(prefix: 'task' | 'run' | 'receipt', rawId: string, ordinal: number): string {
  if (isHostileId(rawId)) return `${prefix}-${String(ordinal).padStart(3, '0')}`;
  return rawId.trim();
}

function publicFactId(prefix: 'task' | 'run' | 'receipt', rawId: string, ordinal: number): string {
  if (isHostileId(rawId)) return `${prefix}:redacted:${String(ordinal).padStart(3, '0')}`;
  return `${prefix}:id:${rawId.trim()}`;
}

// Collision-safe public ROW identity: a disjoint row namespace derived from
// the task's public fact ID — never the visible display label — so a benign
// `task-NNN` row can never alias a hostile node's generated display ordinal.
function publicRowId(taskPublicId: string): string {
  return `task:${taskPublicId}`;
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function fact(label: string, value: string, attr?: string): string {
  const attribute = attr ? ` ${attr}` : '';
  return `<div class="of-fact"${attribute}><dt>${label}</dt><dd>${value}</dd></div>`;
}

interface FlowRow {
  task: TaskNode;
  runs: RunNode[];
  receiptsByRunId: Map<string, ReceiptNode[]>;
  rowReceipts: ReceiptNode[];
  rowProduced: Set<string>;
  rowProven: Set<string>;
  executorByRunId: Map<string, AgentNode | null>;
  dependencies: string[];
  gaps: FabricGap[];
  taskPublicId: string;
  taskDisplayId: string;
  runPublicById: Map<string, string>;
  runDisplayById: Map<string, string>;
  receiptPublicById: Map<string, string>;
  receiptDisplayById: Map<string, string>;
}

interface FlowView {
  rows: FlowRow[];
  unscopedGaps: FabricGap[];
  visibleFactKeys: Set<string>;
  visibleCount: number;
  totalFacts: number;
}

// Deterministic duplicate reconciliation: nodes sharing one canonical
// kind+ID never resolve first-input-wins. Each node is serialized to a
// canonical JSON form (keys sorted, array order preserved) over ONLY the
// explicit per-kind operational fields, and the pairwise code-unit smaller
// form wins — never input order, never object insertion order, never
// locale-sensitive comparison. Selection is TOTAL over every downstream
// truth-affecting operational field while NEVER echoing hostile values:
//   1. Only explicit per-kind OPERATIONAL fields participate — canonical
//      lineage/topology joins, rendered statuses/states, rendered
//      dependencies, and the assignment fields the agentId filter reads.
//      Titles, evidenceRefs, inputDigest/outputDigest, approvalRef,
//      sourceRef, prompts/payloads, timing, loadout, missionId, and every
//      other non-consumed field NEVER decide a winner. When excluded
//      fields are the only difference between duplicates, the surviving
//      object identity may follow input order, but every rendered,
//      filtered, and topology-affecting byte is provably identical — this
//      is render-equivalence, honestly documented, not a claimed total
//      object winner over non-consumed fields.
//   2. The comparator is an injective canonical JSON serialization of the
//      full normalized operational values, ordered by code-unit
//      comparison. It is collision-free by construction — no digest, no
//      BigInt, no probabilistic claim. Raw hostile values are read solely
//      to order candidates inside the comparator; the representation is
//      private and is never rendered, logged, placed in a public fact ID,
//      or included in any report.
// Contradictory duplicates never merge into a synthetic node — exactly one
// input node survives per canonical kind+ID.

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(source[key])}`).join(',')}}`;
}

// Per-kind OPERATIONAL field order: the ONLY fields allowed to decide a
// duplicate winner, because they are the only fields actually consumed by
// resolveFlowView to affect Flow topology, filters, visible statuses,
// dependencies, executors, or proof:
//   task    — status (rendered + state filter), desiredState (rendered),
//             assignedAgentId (agentId filter), dependencyIds (rendered)
//   run     — taskId (row topology), status (rendered)
//   receipt — runId/taskId (topology + proof agreement), status (rendered)
//   agent   — (none: agentId is the canonical ID, equal by construction;
//             role/runtime/status/sourceRef never render, never filter)
// missionId is NOT consumed: workId scoping uses explicit canonical
// contains edges and never reads task.value.missionId, so it is excluded.
// Everything else — titles, evidenceRefs, inputDigest, outputDigest,
// approvalRef, sourceRef, prompts/payloads, loadout, timing, unknown
// fields — is COMPLETELY EXCLUDED from selection and never rendered.
const DUP_OPERATIONAL_FIELDS: Record<string, string[]> = {
  task: ['status', 'desiredState', 'assignedAgentId', 'dependencyIds'],
  run: ['taskId', 'status'],
  receipt: ['runId', 'taskId', 'status'],
  agent: [],
};

// The comparator compares the full normalized raw value of each operational
// field through injective canonical JSON and code-unit ordering. It is
// collision-free by construction — no digest, no BigInt, no probabilistic
// claim. Raw hostile values are read solely to order candidates; the
// comparator representation is private and never renders.
function dupKey(node: { kind: string; value: unknown }): string {
  const value = (node.value ?? {}) as Record<string, unknown>;
  const operational = DUP_OPERATIONAL_FIELDS[node.kind] ?? [];
  return operational
    .map((field) => `${JSON.stringify(field)}:${canonicalJson(value[field])}`)
    .join(',');
}

function dedupeById<T extends { kind: string; value: unknown }>(nodes: readonly T[], idOf: (node: T) => string): T[] {
  const seen = new Map<string, { node: T; key: string }>();
  for (const node of nodes) {
    const id = idOf(node);
    if (id.length === 0) continue;
    const key = dupKey(node);
    const existing = seen.get(id);
    if (existing === undefined || key < existing.key) seen.set(id, { node, key });
  }
  return [...seen.values()].map((entry) => entry.node);
}

function resolveFlowView(projection: MissionFabricProjectionV1, filters: FlowFilters): FlowView {
  const nodes = Array.isArray(projection.nodes) ? projection.nodes : [];
  const edges = Array.isArray(projection.edges) ? projection.edges : [];
  const gaps = Array.isArray(projection.gaps) ? projection.gaps : [];

  const tasks = dedupeById(
    nodes.filter((node): node is TaskNode => node?.kind === 'task' && typeof node.value?.taskId === 'string'),
    (node) => String(node.value.taskId ?? ''),
  ).sort((a, b) => compareId(String(a.value.taskId ?? ''), String(b.value.taskId ?? '')));
  const runs = dedupeById(
    nodes.filter((node): node is RunNode => node?.kind === 'run' && typeof node.value?.runId === 'string'),
    (node) => String(node.value.runId ?? ''),
  ).sort((a, b) => compareId(String(a.value.runId ?? ''), String(b.value.runId ?? '')));
  const receipts = dedupeById(
    nodes.filter((node): node is ReceiptNode => node?.kind === 'receipt' && typeof node.value?.receiptId === 'string'),
    (node) => String(node.value.receiptId ?? ''),
  ).sort((a, b) => compareId(String(a.value.receiptId ?? ''), String(b.value.receiptId ?? '')));
  const agents = dedupeById(
    nodes.filter((node): node is AgentNode => node?.kind === 'agent' && typeof node.value?.agentId === 'string'),
    (node) => String(node.value.agentId ?? ''),
  );
  const agentById = new Map(agents.map((agent) => [String(agent.value.agentId ?? ''), agent]));
  const taskById = new Map(tasks.map((task) => [String(task.value.taskId ?? ''), task]));
  const runById = new Map(runs.map((run) => [String(run.value.runId ?? ''), run]));
  const receiptById = new Map(receipts.map((receipt) => [String(receipt.value.receiptId ?? ''), receipt]));

  const runsByTaskId = new Map<string, RunNode[]>();
  for (const run of runs) {
    const taskId = String(run.value?.taskId ?? '');
    const list = runsByTaskId.get(taskId) ?? [];
    list.push(run);
    runsByTaskId.set(taskId, list);
  }

  // Per-run executor: ONLY an exact canonical executes edge (agentId → runId)
  // whose agent node exists resolves an executor — never run.value.agentId.
  const executorByRunId = new Map<string, AgentNode | null>();
  for (const edge of edges) {
    if (!edge || edge.kind !== 'executes') continue;
    const runId = String(edge.toId ?? '');
    if (!runById.has(runId) || executorByRunId.has(runId)) continue;
    executorByRunId.set(runId, agentById.get(String(edge.fromId ?? '')) ?? null);
  }

  // Receipt visibility: a canonical receipt whose receipt.runId resolves to a
  // canonical run, or which is named by an exact canonical produces/proves
  // edge, renders as a bounded fact. Proof GRANT is agreement-validated below.
  const receiptsByRunId = new Map<string, ReceiptNode[]>();
  const pushReceiptForRun = (runId: string, receipt: ReceiptNode): void => {
    const list = receiptsByRunId.get(runId) ?? [];
    if (!list.includes(receipt)) {
      list.push(receipt);
      list.sort((a, b) => compareId(String(a.value.receiptId ?? ''), String(b.value.receiptId ?? '')));
      receiptsByRunId.set(runId, list);
    }
  };
  for (const receipt of receipts) {
    const runId = String(receipt.value?.runId ?? '');
    if (runId.length > 0 && runById.has(runId)) pushReceiptForRun(runId, receipt);
  }
  // Agreement-validated proof: a canonical produces edge must agree with the
  // receipt's canonical runId and the run's canonical task; a canonical
  // proves edge must agree with the receipt's canonical taskId and the
  // receipt's canonical run's task. Contradictory, cross-task, wrong-target,
  // conflicting-run, reversed, and missing-target edges grant NOTHING on any
  // row — no target-only proof chips exist.
  const producedByRunId = new Map<string, Set<string>>();
  const provenByReceiptId = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!edge) continue;
    if (edge.kind === 'produces') {
      const runId = String(edge.fromId ?? '');
      const receiptId = String(edge.toId ?? '');
      const run = runById.get(runId);
      const receipt = receiptById.get(receiptId);
      if (run === undefined || receipt === undefined) continue;
      // The edge must agree with the receipt's canonical run and the run's
      // canonical task; a conflicting-run or cross-task produces edge grants
      // nothing (the receipt's canonical linkage below keeps visibility).
      const agrees =
        String(receipt.value?.runId ?? '') === runId &&
        String(receipt.value?.taskId ?? '').length > 0 &&
        String(receipt.value?.taskId ?? '') === String(run.value?.taskId ?? '');
      if (!agrees) continue;
      const set = producedByRunId.get(runId) ?? new Set<string>();
      set.add(receiptId);
      producedByRunId.set(runId, set);
      pushReceiptForRun(runId, receipt);
    }
    if (edge.kind === 'proves') {
      const receiptId = String(edge.fromId ?? '');
      const taskId = String(edge.toId ?? '');
      const receipt = receiptById.get(receiptId);
      if (receipt === undefined || !taskById.has(taskId)) continue;
      // The edge must agree with the receipt's canonical task AND with the
      // receipt's canonical run's task; a contradictory proves edge grants
      // nothing on either row.
      const receiptTaskId = String(receipt.value?.taskId ?? '');
      const receiptRunId = String(receipt.value?.runId ?? '');
      const run = runById.get(receiptRunId);
      const agrees =
        receiptTaskId.length > 0 &&
        receiptTaskId === taskId &&
        run !== undefined &&
        String(run.value?.taskId ?? '') === taskId;
      if (!agrees) continue;
      const set = provenByReceiptId.get(receiptId) ?? new Set<string>();
      set.add(taskId);
      provenByReceiptId.set(receiptId, set);
      if (run !== undefined) pushReceiptForRun(receiptRunId, receipt);
    }
  }

  const dependsOnEdges = edges.filter((edge): edge is FabricEdge => edge?.kind === 'depends-on');
  const assignedToEdges = edges.filter((edge): edge is FabricEdge => edge?.kind === 'assigned-to');

  const allRows: FlowRow[] = tasks.map((task) => {
    const taskId = String(task.value.taskId ?? '');
    const taskRuns = (runsByTaskId.get(taskId) ?? []).slice();
    const receiptsByRun: Map<string, ReceiptNode[]> = new Map();
    const rowReceipts: ReceiptNode[] = [];
    const rowProduced = new Set<string>();
    const rowProven = new Set<string>();
    for (const run of taskRuns) {
      const runId = String(run.value.runId ?? '');
      const list = receiptsByRunId.get(runId) ?? [];
      receiptsByRun.set(runId, list);
      for (const receipt of list) {
        rowReceipts.push(receipt);
        const receiptId = String(receipt.value.receiptId ?? '');
        if (producedByRunId.get(runId)?.has(receiptId)) rowProduced.add(receiptId);
        if (provenByReceiptId.get(receiptId)?.has(taskId)) rowProven.add(receiptId);
      }
    }
    const dependencies = new Set<string>();
    if (Array.isArray(task.value?.dependencyIds)) {
      for (const id of task.value.dependencyIds) if (typeof id === 'string') dependencies.add(id);
    }
    for (const edge of dependsOnEdges) {
      if (edge.fromId === taskId && typeof edge.toId === 'string') dependencies.add(edge.toId);
    }
    const rowExecutor = new Map<string, AgentNode | null>();
    for (const run of taskRuns) {
      const runId = String(run.value.runId ?? '');
      rowExecutor.set(runId, executorByRunId.has(runId) ? executorByRunId.get(runId)! : null);
    }
    // Exact-ID gap attachment only: the gap subjectId must equal the row's
    // taskId or one of the row's existing runIds. Computed against the FULL
    // canonical row set BEFORE filters — a gap that attaches to a
    // filtered-out row drops with that row and never reappears as unscoped.
    const rowGaps = gaps.filter((gap) => {
      if (!gap || !FENCE_GAP_KINDS.has(String(gap.kind ?? ''))) return false;
      if (gap.subjectId === taskId) return true;
      return taskRuns.some((run) => gap.subjectId === String(run.value.runId ?? ''));
    });
    return {
      task,
      runs: taskRuns,
      receiptsByRunId: receiptsByRun,
      rowReceipts,
      rowProduced,
      rowProven,
      executorByRunId: rowExecutor,
      dependencies: [...dependencies].sort(compareId),
      gaps: rowGaps,
      taskPublicId: '',
      taskDisplayId: '',
      runPublicById: new Map<string, string>(),
      runDisplayById: new Map<string, string>(),
      receiptPublicById: new Map<string, string>(),
      receiptDisplayById: new Map<string, string>(),
    };
  });

  // Filters apply FIRST — the bound and truncation copy describe the
  // selected view only. Filter inputs are bounded (64 chars max) and
  // secret-filtered; any overlong or secret-bearing value fails closed to an
  // empty view without echoing and without surfacing unrelated scoped gaps.
  const filterHostile = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    return text.length > FILTER_INPUT_LIMIT || SECRET_MARKER.test(text);
  };
  const anyHostileFilter =
    filterHostile(filters.workId) || filterHostile(filters.agentId) || filterHostile(filters.state);
  let rows: FlowRow[] = anyHostileFilter ? [] : allRows;
  const workId = typeof filters.workId === 'string' ? filters.workId.trim() : '';
  if (workId.length > 0 && rows.length > 0) {
    const missionIds = new Set(
      edges.filter((edge) => edge?.kind === 'contains' && edge.fromId === workId).map((edge) => edge.toId),
    );
    const taskIds = new Set(
      edges.filter((edge) => edge?.kind === 'contains' && missionIds.has(edge.fromId)).map((edge) => edge.toId),
    );
    rows = rows.filter((row) => taskIds.has(String(row.task.value.taskId ?? '')));
  }
  const agentId = typeof filters.agentId === 'string' ? filters.agentId.trim() : '';
  if (agentId.length > 0 && rows.length > 0) {
    rows = rows.filter((row) => {
      const taskId = String(row.task.value.taskId ?? '');
      if (row.task.value?.assignedAgentId === agentId) return true;
      for (const edge of assignedToEdges) {
        if (edge.fromId === taskId && edge.toId === agentId) return true;
      }
      return row.runs.some((run) => executorByRunId.get(String(run.value.runId ?? ''))?.value.agentId === agentId);
    });
  }
  const state = typeof filters.state === 'string' ? filters.state.trim() : '';
  if (state.length > 0 && rows.length > 0) {
    rows = rows.filter((row) => row.task.value?.status === state);
  }

  // Unscoped typed gaps: only genuinely unmappable gaps (never attached to
  // ANY canonical row in the full pre-filter set) enter the honest unscoped
  // section. Scoped-out gaps drop with their filtered-out rows.
  const attachedAnywhere = new Set<FabricGap>();
  for (const row of allRows) for (const gap of row.gaps) attachedAnywhere.add(gap);
  const unscopedGaps =
    rows.length === 0 && anyHostileFilter
      ? []
      : gaps.filter((gap) => gap && FENCE_GAP_KINDS.has(String(gap.kind ?? '')) && !attachedAnywhere.has(gap));

  // Candidate fact universe across ALL filtered rows BEFORE the bound: every
  // distinct canonical Task/Run/Receipt node in the selected view counts in
  // N, and public IDs are assigned from the canonical full-column order over
  // the ENTIRE selected view — deterministic, kind-scoped, and drawn from
  // the provably disjoint benign `id:` / hostile `redacted:` namespaces.
  // Selection and counting key on canonical fact keys — NEVER on display or
  // public IDs — so truncation accounting is byte-identical across
  // substrates even under adversarial ID collisions.
  const candidateFactOrder: string[] = [];
  const ordinalByFactKey = new Map<string, number>();
  const publicByFactKey = new Map<string, string>();
  const assignFact = (factKey: string, prefix: 'task' | 'run' | 'receipt', rawId: string): void => {
    if (ordinalByFactKey.has(factKey)) return;
    const ordinal = ordinalByFactKey.size;
    ordinalByFactKey.set(factKey, ordinal);
    publicByFactKey.set(factKey, publicFactId(prefix, rawId, ordinal));
    candidateFactOrder.push(factKey);
  };
  for (const row of rows) {
    assignFact(`task:${String(row.task.value.taskId ?? '')}`, 'task', String(row.task.value.taskId ?? ''));
  }
  for (const row of rows) {
    for (const run of row.runs) {
      assignFact(`run:${String(run.value.runId ?? '')}`, 'run', String(run.value.runId ?? ''));
    }
  }
  for (const row of rows) {
    for (const receipt of row.rowReceipts) {
      assignFact(`receipt:${String(receipt.value.receiptId ?? '')}`, 'receipt', String(receipt.value.receiptId ?? ''));
    }
  }
  const totalFacts = candidateFactOrder.length;
  const visibleFactKeys = new Set(candidateFactOrder.slice(0, FLOW_FACT_LIMIT));
  const visibleCount = visibleFactKeys.size;
  const keptRows = rows.filter((row) => visibleFactKeys.has(`task:${String(row.task.value.taskId ?? '')}`));

  for (const row of keptRows) {
    const taskId = String(row.task.value.taskId ?? '');
    const taskFactKey = `task:${taskId}`;
    row.taskPublicId = publicByFactKey.get(taskFactKey) ?? publicFactId('task', taskId, ordinalByFactKey.get(taskFactKey) ?? 0);
    row.taskDisplayId = publicDisplayId('task', taskId, ordinalByFactKey.get(taskFactKey) ?? 0);
    for (const run of row.runs) {
      const runId = String(run.value.runId ?? '');
      const runFactKey = `run:${runId}`;
      row.runPublicById.set(runId, publicByFactKey.get(runFactKey) ?? publicFactId('run', runId, ordinalByFactKey.get(runFactKey) ?? 0));
      row.runDisplayById.set(runId, publicDisplayId('run', runId, ordinalByFactKey.get(runFactKey) ?? 0));
    }
    for (const receipt of row.rowReceipts) {
      const receiptId = String(receipt.value.receiptId ?? '');
      const receiptFactKey = `receipt:${receiptId}`;
      row.receiptPublicById.set(
        receiptId,
        publicByFactKey.get(receiptFactKey) ?? publicFactId('receipt', receiptId, ordinalByFactKey.get(receiptFactKey) ?? 0),
      );
      row.receiptDisplayById.set(
        receiptId,
        publicDisplayId('receipt', receiptId, ordinalByFactKey.get(receiptFactKey) ?? 0),
      );
    }
  }

  return { rows: keptRows, unscopedGaps, visibleFactKeys, visibleCount, totalFacts };
}

function renderGapBlock(gap: FabricGap): string {
  const kind = safeText(gap.kind, 'unknown gap');
  const subject = gap.subjectId ? safeText(gap.subjectId, 'unknown subject') : 'unscoped';
  const detail = safeText(gap.detail, 'no detail available');
  return (
    `<div class="of-gap" data-component="FabricGap" data-of-gap-kind="${kind}" role="status" aria-label="gap: ${kind} on ${subject}">` +
    `<span class="of-gap-kind">${kind}</span>` +
    `<span class="of-gap-subject">${subject}</span>` +
    `<p class="of-gap-detail">${detail}</p>` +
    `</div>`
  );
}

function renderFlowRow(row: FlowRow, visibleFactKeys: Set<string>): string {
  const taskId = String(row.task.value.taskId ?? '');
  const taskFactId = row.taskPublicId;
  const taskDisplay = row.taskDisplayId;
  const taskCell =
    fact('task', escAttr(taskDisplay), `data-of-fact="${escAttr(taskFactId)}"`) +
    fact('observed', safeText(row.task.value?.status, 'unknown state')) +
    fact('desired', safeText(row.task.value?.desiredState, 'unknown desired state')) +
    row.dependencies
      .map((id) => fact('depends on', escAttr(safeId(id, REDACTED_ID)), `data-of-dependency="${escAttr(safeId(id, REDACTED_ID))}"`))
      .join('');

  const runCellParts: string[] = [];
  const visibleRuns = row.runs.filter((run) => visibleFactKeys.has(`run:${String(run.value.runId ?? '')}`));
  if (visibleRuns.length > 0) {
    for (const run of visibleRuns) {
      const runId = String(run.value.runId ?? '');
      const executor = row.executorByRunId.get(runId) ?? null;
      runCellParts.push(
        fact('run', escAttr(row.runDisplayById.get(runId) ?? ''), `data-of-fact="${escAttr(row.runPublicById.get(runId) ?? '')}"`) +
          fact('status', safeText(run.value?.status, 'unknown state')) +
          (executor !== null
            ? fact('executor', escAttr(safeId(executor.value.agentId, REDACTED_ID)), `data-of-executor="${escAttr(safeId(executor.value.agentId, REDACTED_ID))}"`)
            : fact('executor', 'executor not present in projection')),
      );
    }
  } else {
    runCellParts.push(fact('run', 'run not present in projection'));
  }

  const receiptCellParts: string[] = [];
  const visibleReceipts = row.rowReceipts.filter((receipt) =>
    visibleFactKeys.has(`receipt:${String(receipt.value.receiptId ?? '')}`),
  );
  if (visibleReceipts.length > 0) {
    for (const receipt of visibleReceipts) {
      const receiptId = String(receipt.value.receiptId ?? '');
      const kinds: string[] = [];
      if (row.rowProduced.has(receiptId)) kinds.push('produces');
      if (row.rowProven.has(receiptId)) kinds.push('proves');
      const proof = kinds.join(' · ');
      receiptCellParts.push(
        fact('receipt', escAttr(row.receiptDisplayById.get(receiptId) ?? ''), `data-of-fact="${escAttr(row.receiptPublicById.get(receiptId) ?? '')}"`) +
          fact('status', safeText(receipt.value?.status, 'unknown state')) +
          (kinds.length > 0
            ? fact('proof', escAttr(proof), `data-of-proof="${escAttr(proof)}"`)
            : fact('proof', 'proof not present in projection')),
      );
    }
  } else if (visibleRuns.length > 0) {
    receiptCellParts.push(fact('receipt', 'receipt not present in projection'));
    receiptCellParts.push(fact('proof', 'proof not present in projection'));
  } else {
    receiptCellParts.push(fact('receipt', 'receipt not present in projection'));
  }
  const typedGaps = row.gaps.map(renderGapBlock).join('');
  if (typedGaps) receiptCellParts.push(typedGaps);

  // Visible direction lives INSIDE the cells as static path markup — never
  // animation-dependent, and never a span sibling directly under tr.
  const pathTaskRun = visibleRuns.length > 0 ? '<span class="of-flow-path" aria-hidden="true" data-of-path="task-run">→</span>' : '';
  const pathRunReceipt =
    visibleRuns.length > 0 && visibleReceipts.length > 0
      ? '<span class="of-flow-path" aria-hidden="true" data-of-path="run-receipt">→</span>'
      : '';
  return (
    `<tr data-of-flow-row="${escAttr(publicRowId(taskFactId))}">` +
    `<td data-of-flow-cell="task">${taskCell}${pathTaskRun}</td>` +
    `<td data-of-flow-cell="run">${runCellParts.join('')}${pathRunReceipt}</td>` +
    `<td data-of-flow-cell="receipt">${receiptCellParts.join('')}</td>` +
    `</tr>`
  );
}

function renderLinearList(view: FlowView): string {
  const items: string[] = [];
  for (const row of view.rows) {
    const taskId = String(row.task.value.taskId ?? '');
    const taskFactId = row.taskPublicId;
    const taskDisplay = row.taskDisplayId;
    const visibleRuns = row.runs.filter((run) => view.visibleFactKeys.has(`run:${String(run.value.runId ?? '')}`));
    const visibleReceipts = row.rowReceipts.filter((receipt) =>
      view.visibleFactKeys.has(`receipt:${String(receipt.value.receiptId ?? '')}`),
    );
    const runLabel = visibleRuns.length > 0 ? `run ${row.runDisplayById.get(String(visibleRuns[0]!.value.runId ?? '')) ?? ''}` : 'run not present in projection';
    const receiptLabel = visibleReceipts.length > 0 ? `receipt ${row.receiptDisplayById.get(String(visibleReceipts[0]!.value.receiptId ?? '')) ?? ''}` : 'receipt not present in projection';
    const direction = `flow: task ${taskDisplay} · ${runLabel} · ${receiptLabel}`;
    const stateFacts =
      `<span class="of-flow-item-fact" data-of-task-status="${escAttr(safeId(row.task.value?.status, 'unknown state'))}">${safeText(row.task.value?.status, 'unknown state')}</span>` +
      `<span class="of-flow-item-fact" data-of-task-desired="${escAttr(safeId(row.task.value?.desiredState, 'unknown desired state'))}">${safeText(row.task.value?.desiredState, 'unknown desired state')}</span>`;
    const dependencyFacts = row.dependencies
      .map((id) => `<span class="of-flow-item-fact" data-of-dependency="${escAttr(safeId(id, REDACTED_ID))}">${escAttr(safeId(id, REDACTED_ID))}</span>`)
      .join('');
    const runFacts = visibleRuns
      .map((run) => {
        const runId = String(run.value.runId ?? '');
        const executor = row.executorByRunId.get(runId) ?? null;
        return (
          `<span class="of-flow-item-fact" data-of-fact="${escAttr(row.runPublicById.get(runId) ?? '')}">${escAttr(row.runDisplayById.get(runId) ?? '')}</span>` +
          `<span class="of-flow-item-fact" data-of-run-status="${escAttr(safeId(run.value?.status, 'unknown state'))}">${safeText(run.value?.status, 'unknown state')}</span>` +
          (executor !== null
            ? `<span class="of-flow-item-fact" data-of-executor="${escAttr(safeId(executor.value.agentId, REDACTED_ID))}">${escAttr(safeId(executor.value.agentId, REDACTED_ID))}</span>`
            : `<span class="of-flow-item-fact">executor not present in projection</span>`)
        );
      })
      .join('');
    const receiptFacts = visibleReceipts
      .map((receipt) => {
        const receiptId = String(receipt.value.receiptId ?? '');
        const kinds: string[] = [];
        if (row.rowProduced.has(receiptId)) kinds.push('produces');
        if (row.rowProven.has(receiptId)) kinds.push('proves');
        const proof = kinds.join(' · ');
        return (
          `<span class="of-flow-item-fact" data-of-fact="${escAttr(row.receiptPublicById.get(receiptId) ?? '')}">${escAttr(row.receiptDisplayById.get(receiptId) ?? '')}</span>` +
          `<span class="of-flow-item-fact" data-of-receipt-status="${escAttr(safeId(receipt.value?.status, 'unknown state'))}">${safeText(receipt.value?.status, 'unknown state')}</span>` +
          (kinds.length > 0
            ? `<span class="of-flow-item-fact" data-of-proof="${escAttr(proof)}">${escAttr(proof)}</span>`
            : `<span class="of-flow-item-fact">proof not present in projection</span>`)
        );
      })
      .join('');
    const missingLabels =
      (visibleRuns.length === 0 ? `<span class="of-flow-item-fact">run not present in projection</span>` : '') +
      (visibleReceipts.length === 0 ? `<span class="of-flow-item-fact">receipt not present in projection</span>` : '');
    const gapFacts = row.gaps.map(renderGapBlock).join('');
    items.push(
      `<li class="of-flow-item" data-of-fact="${escAttr(taskFactId)}">` +
        `<span class="of-flow-direction">${escAttr(direction)}</span>` +
        stateFacts +
        dependencyFacts +
        runFacts +
        receiptFacts +
        missingLabels +
        gapFacts +
        `</li>`,
    );
  }
  const unscoped =
    view.unscopedGaps.length > 0
      ? `<li class="of-flow-item of-flow-item-unscoped" data-of-flow-unscoped-gaps="true">` +
        `<span class="of-flow-direction">typed gaps not scoped to a visible task</span>` +
        view.unscopedGaps.map(renderGapBlock).join('') +
        `</li>`
      : '';
  return `<ol class="of-flow-list" data-of-flow-fallback="linear">${items.join('')}${unscoped}</ol>`;
}

export function renderFlow(
  projection: MissionFabricProjectionV1,
  filters: FlowFilters = {},
): string {
  if (projection === null || typeof projection !== 'object' || !Array.isArray(projection.nodes)) {
    return renderFabricState('error');
  }
  if (projection.schema !== 'cambium.mission-fabric-projection.v1' || !Array.isArray(projection.edges)) {
    return renderFabricState('error');
  }
  const view = resolveFlowView(projection, filters);
  if (view.rows.length === 0 && view.unscopedGaps.length === 0) {
    return `<div class="of-flow" data-component="FabricFlow">${renderFabricState('empty')}</div>`;
  }
  const rowHtml = view.rows.map((row) => renderFlowRow(row, view.visibleFactKeys)).join('');
  const truncated =
    view.totalFacts > view.visibleCount
      ? `<p class="of-flow-truncation" data-of-flow-truncation="true">showing ${view.visibleCount} of ${view.totalFacts}</p>`
      : '';
  const unscopedRow =
    view.unscopedGaps.length > 0
      ? `<tr data-of-flow-unscoped-gaps="true"><td data-of-flow-cell="task" colspan="3">` +
        `<div class="of-fact"><dt>typed gaps not scoped to a visible task</dt><dd>unscoped</dd></div>` +
        view.unscopedGaps.map(renderGapBlock).join('') +
        `</td></tr>`
      : '';
  const graph =
    `<table class="of-flow-graph" data-of-flow-representation="graph" aria-hidden="true">` +
    `<thead><tr>` +
    `<th data-of-flow-column="task">Task</th>` +
    `<th data-of-flow-column="run">Run</th>` +
    `<th data-of-flow-column="receipt">Receipt</th>` +
    `</tr></thead>` +
    `<tbody>${rowHtml}${unscopedRow}</tbody>` +
    `</table>`;
  const list = renderLinearList(view);
  return (
    `<div class="of-flow" data-component="FabricFlow">` +
    truncated +
    graph +
    list +
    `</div>`
  );
}

// ── browser renderer source ────────────────────────────────────────────────
// FLOW_BROWSER_JS is the browser-side flow renderer, expressed as plain
// browser-valid JavaScript source (no TypeScript syntax, no imports, no node
// builtins). It mirrors the derivation rules documented above exactly and is
// composed lexically into the operating-fabric boot script by client.ts — no
// source transformer, no eval, no ambient mutable renderer global. Full-HTML
// parity with the node renderer is enforced by tests across the fixture and
// every corrective reproduction.
// The browser fail-closed signature policy lives in the shared helpers block
// in client.ts as a legible normalized grammar — query_id/auth_date/token
// unanchored, hash word-bounded via (?:^|\W) — that is boolean-equivalent to
// the verbatim canonical SECRET_MARKER above (proven by a generated
// adversarial matrix with zero divergences); the Node substrate keeps the
// canonical Task 7 regex verbatim.
export const FLOW_BROWSER_JS = String.raw`
function ofRenderFlow(projection, filters) {
  if (!ofValidProjection(projection)) {
    return '<div class="of-state of-state-error" data-component="FabricState" data-state="error" role="status" aria-label="error: failed to load the operating fabric">' +
      '<strong class="of-state-title">error</strong>' +
      '<p class="of-state-detail">failed to load the operating fabric</p>' +
      '</div>';
  }
  var FLOW_FACT_LIMIT_BROWSER = 96;
  var FLOW_REDACTED_ID = 'redacted';
  var FLOW_FILTER_INPUT_LIMIT = 64;
  var nodes = Array.isArray(projection.nodes) ? projection.nodes : [];
  var edges = Array.isArray(projection.edges) ? projection.edges : [];
  var gaps = Array.isArray(projection.gaps) ? projection.gaps : [];
  function compareId(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function fact(label, value, attr) {
    var attribute = attr ? ' ' + attr : '';
    return '<div class="of-fact"' + attribute + '><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }
  function escAttr(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeText(value, fallback, max) {
    var limit = typeof max === 'number' ? max : 120;
    var text = typeof value === 'string' ? value.trim() : '';
    if (text.length === 0 || OF_SECRET_MARKER.test(text)) return fallback;
    return escAttr(text.length > limit ? text.slice(0, limit - 1) + '…' : text);
  }
  function safeId(value, fallback, max) {
    var limit = typeof max === 'number' ? max : 64;
    var text = typeof value === 'string' ? value.trim() : '';
    if (text.length === 0 || OF_SECRET_MARKER.test(text)) return fallback;
    return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
  }
  function isHostileId(rawId) {
    var text = typeof rawId === 'string' ? rawId.trim() : '';
    return text.length === 0 || text.length > FLOW_FILTER_INPUT_LIMIT || OF_SECRET_MARKER.test(text);
  }
  function padOrdinal(ordinal) {
    var digits = String(ordinal);
    return digits.length >= 3 ? digits : ('000' + digits).slice(-3);
  }
  function publicDisplayId(prefix, rawId, ordinal) {
    if (isHostileId(rawId)) return prefix + '-' + padOrdinal(ordinal);
    return rawId.trim();
  }
  // Collision-safe public identity: benign raw IDs render inside the
  // reserved 'id:' namespace and hostile raw IDs inside the reserved
  // 'redacted:' namespace — provably disjoint, so no user-controlled benign
  // raw ID can ever equal a generated redacted identity. Selection/counting
  // keys on canonical fact keys, never on display or public IDs.
  function publicFactId(prefix, rawId, ordinal) {
    if (isHostileId(rawId)) return prefix + ':redacted:' + padOrdinal(ordinal);
    return prefix + ':id:' + rawId.trim();
  }
  // Collision-safe public ROW identity: derived from the task's public fact
  // ID — never the visible display label.
  function publicRowId(taskPublicId) {
    return 'task:' + taskPublicId;
  }
  function isFenceGap(gap) {
    return gap && (gap.kind === 'stale-fence' || gap.kind === 'unverifiable-fence');
  }
  function renderGapBlock(gap) {
    var gapKind = safeText(gap && gap.kind, 'unknown gap');
    var gapSubject = gap && gap.subjectId ? safeText(gap.subjectId, 'unknown subject') : 'unscoped';
    var gapDetail = safeText(gap && gap.detail, 'no detail available');
    return '<div class="of-gap" data-component="FabricGap" data-of-gap-kind="' + gapKind + '" role="status" aria-label="gap: ' + gapKind + ' on ' + gapSubject + '">' +
      '<span class="of-gap-kind">' + gapKind + '</span>' +
      '<span class="of-gap-subject">' + gapSubject + '</span>' +
      '<p class="of-gap-detail">' + gapDetail + '</p>' +
      '</div>';
  }
  // Deterministic duplicate reconciliation: one canonical kind+ID never
  // resolves first-input-wins. Canonical JSON (keys sorted, arrays kept)
  // over EXPLICIT per-kind operational fields only; the pairwise code-unit
  // smaller form wins. Never input order, insertion order, titles, raw
  // evidence, raw digests, approvalRef, sourceRef, prompts/payloads, or
  // locale-sensitive comparison; contradictory duplicates never merge. The
  // comparator reads the full normalized raw operational values solely to
  // order candidates — injective, collision-free by construction, no
  // digest, no BigInt, and never rendered.
  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') {
      var primitive = JSON.stringify(value);
      return primitive === undefined ? 'null' : primitive;
    }
    if (Array.isArray(value)) {
      var parts = [];
      for (var vi = 0; vi < value.length; vi += 1) parts.push(canonicalJson(value[vi]));
      return '[' + parts.join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    var entries = [];
    for (var wi = 0; wi < keys.length; wi += 1) entries.push(JSON.stringify(keys[wi]) + ':' + canonicalJson(value[keys[wi]]));
    return '{' + entries.join(',') + '}';
  }
  // Per-kind OPERATIONAL field order: the ONLY fields allowed to decide a
  // duplicate winner — the fields actually consumed for topology joins,
  // rendered statuses/states, rendered dependencies, and the agentId-filter
  // assignment field. missionId is NOT consumed (workId scoping uses
  // explicit contains edges only) and is excluded. Titles, evidenceRefs,
  // digests, approvalRef, sourceRef, prompts/payloads, and every other
  // non-consumed field never participate.
  var DUP_OPERATIONAL_FIELDS = {
    task: ['status', 'desiredState', 'assignedAgentId', 'dependencyIds'],
    run: ['taskId', 'status'],
    receipt: ['runId', 'taskId', 'status'],
    agent: [],
  };
  // The comparator compares the full normalized raw value of each
  // operational field through injective canonical JSON and code-unit
  // ordering. Collision-free by construction — no digest, no BigInt, no
  // probabilistic claim. Raw hostile values are read solely to order
  // candidates; the representation is private and never renders.
  function dupKey(node) {
    var value = node.value || {};
    var operational = Object.prototype.hasOwnProperty.call(DUP_OPERATIONAL_FIELDS, node.kind) ? DUP_OPERATIONAL_FIELDS[node.kind] : [];
    var parts = [];
    for (var qi = 0; qi < operational.length; qi += 1) {
      parts.push(JSON.stringify(operational[qi]) + ':' + canonicalJson(value[operational[qi]]));
    }
    return parts.join(',');
  }
  var taskMap = Object.create(null);
  var runMap = Object.create(null);
  var receiptMap = Object.create(null);
  var agentMap = Object.create(null);
  var dupKeyByMapId = Object.create(null);
  function chooseCanonical(map, bucket, id, node) {
    var slot = bucket + ':' + id;
    var key = dupKey(node);
    if (!Object.prototype.hasOwnProperty.call(dupKeyByMapId, slot) || key < dupKeyByMapId[slot]) {
      dupKeyByMapId[slot] = key;
      map[id] = node;
    }
  }
  for (var ni = 0; ni < nodes.length; ni += 1) {
    var node = nodes[ni];
    if (!node || !node.value) continue;
    if (node.kind === 'task' && typeof node.value.taskId === 'string') chooseCanonical(taskMap, 'task', node.value.taskId, node);
    if (node.kind === 'run' && typeof node.value.runId === 'string') chooseCanonical(runMap, 'run', node.value.runId, node);
    if (node.kind === 'receipt' && typeof node.value.receiptId === 'string') chooseCanonical(receiptMap, 'receipt', node.value.receiptId, node);
    if (node.kind === 'agent' && typeof node.value.agentId === 'string') chooseCanonical(agentMap, 'agent', node.value.agentId, node);
  }
  var taskIds = Object.keys(taskMap).sort(compareId);
  var runIds = Object.keys(runMap).sort(compareId);
  var receiptIds = Object.keys(receiptMap).sort(compareId);
  var runsByTaskId = Object.create(null);
  for (var ri = 0; ri < runIds.length; ri += 1) {
    var run = runMap[runIds[ri]];
    var runTaskId = String(run.value.taskId || '');
    if (!runsByTaskId[runTaskId]) runsByTaskId[runTaskId] = [];
    runsByTaskId[runTaskId].push(run);
  }
  // Per-run executor: ONLY an exact canonical executes edge whose agent node
  // exists — never run.value.agentId.
  var executorByRunId = Object.create(null);
  for (var xi = 0; xi < edges.length; xi += 1) {
    var execEdge = edges[xi];
    if (!execEdge || execEdge.kind !== 'executes') continue;
    var execRunId = String(execEdge.toId || '');
    if (!runMap[execRunId] || Object.prototype.hasOwnProperty.call(executorByRunId, execRunId)) continue;
    executorByRunId[execRunId] = agentMap[String(execEdge.fromId)] || null;
  }
  var receiptsByRunId = Object.create(null);
  function pushReceiptForRun(runId, receipt) {
    if (!receiptsByRunId[runId]) receiptsByRunId[runId] = [];
    var list = receiptsByRunId[runId];
    if (list.indexOf(receipt) === -1) {
      list.push(receipt);
      list.sort(function (a, b) { return compareId(String(a.value.receiptId || ''), String(b.value.receiptId || '')); });
    }
  }
  for (var ci = 0; ci < receiptIds.length; ci += 1) {
    var visibleCandidate = receiptMap[receiptIds[ci]];
    var visibleRunId = String(visibleCandidate.value.runId || '');
    if (visibleRunId.length > 0 && runMap[visibleRunId]) pushReceiptForRun(visibleRunId, visibleCandidate);
  }
  // Agreement-validated proof: a canonical produces edge must agree with the
  // receipt's canonical runId and the run's canonical task; a canonical
  // proves edge must agree with the receipt's canonical taskId and the
  // receipt's canonical run's task. Contradictory, cross-task, wrong-target,
  // conflicting-run, reversed, and missing-target edges grant NOTHING on any
  // row — no target-only proof chips exist.
  var producedByRunId = Object.create(null);
  var provenByReceiptId = Object.create(null);
  for (var ei = 0; ei < edges.length; ei += 1) {
    var edge = edges[ei];
    if (!edge) continue;
    if (edge.kind === 'produces') {
      var producesRunId = String(edge.fromId || '');
      var producesReceiptId = String(edge.toId || '');
      var producesRun = runMap[producesRunId];
      var producesReceipt = receiptMap[producesReceiptId];
      if (producesRun === undefined || producesReceipt === undefined) continue;
      var producesAgrees =
        String(producesReceipt.value.runId || '') === producesRunId &&
        String(producesReceipt.value.taskId || '').length > 0 &&
        String(producesReceipt.value.taskId || '') === String(producesRun.value.taskId || '');
      if (!producesAgrees) continue;
      if (!producedByRunId[producesRunId]) producedByRunId[producesRunId] = Object.create(null);
      producedByRunId[producesRunId][producesReceiptId] = true;
      pushReceiptForRun(producesRunId, producesReceipt);
    }
    if (edge.kind === 'proves') {
      var provesReceiptId = String(edge.fromId || '');
      var provesTaskId = String(edge.toId || '');
      var provesReceipt = receiptMap[provesReceiptId];
      if (provesReceipt === undefined || !taskMap[provesTaskId]) continue;
      var provesReceiptTaskId = String(provesReceipt.value.taskId || '');
      var provesReceiptRunId = String(provesReceipt.value.runId || '');
      var provesRun = runMap[provesReceiptRunId];
      var provesAgrees =
        provesReceiptTaskId.length > 0 &&
        provesReceiptTaskId === provesTaskId &&
        provesRun !== undefined &&
        String(provesRun.value.taskId || '') === provesTaskId;
      if (!provesAgrees) continue;
      if (!provenByReceiptId[provesReceiptId]) provenByReceiptId[provesReceiptId] = Object.create(null);
      provenByReceiptId[provesReceiptId][provesTaskId] = true;
      if (provesRun !== undefined) pushReceiptForRun(provesReceiptRunId, provesReceipt);
    }
  }
  var dependsOnEdges = [];
  var assignedToEdges = [];
  for (var di = 0; di < edges.length; di += 1) {
    if (edges[di] && edges[di].kind === 'depends-on') dependsOnEdges.push(edges[di]);
    if (edges[di] && edges[di].kind === 'assigned-to') assignedToEdges.push(edges[di]);
  }
  var allRows = [];
  for (var ti = 0; ti < taskIds.length; ti += 1) {
    var taskId = taskIds[ti];
    var task = taskMap[taskId];
    var taskRuns = runsByTaskId[taskId] ? runsByTaskId[taskId].slice() : [];
    var rowReceipts = [];
    var rowProduced = Object.create(null);
    var rowProven = Object.create(null);
    var rowExecutor = Object.create(null);
    for (var rj = 0; rj < taskRuns.length; rj += 1) {
      var rowRunId = String(taskRuns[rj].value.runId || '');
      var runReceipts = receiptsByRunId[rowRunId] || [];
      rowExecutor[rowRunId] = Object.prototype.hasOwnProperty.call(executorByRunId, rowRunId) ? executorByRunId[rowRunId] : null;
      for (var rk = 0; rk < runReceipts.length; rk += 1) {
        rowReceipts.push(runReceipts[rk]);
        var rowReceiptId = String(runReceipts[rk].value.receiptId || '');
        if (producedByRunId[rowRunId] && producedByRunId[rowRunId][rowReceiptId]) rowProduced[rowReceiptId] = true;
        if (provenByReceiptId[rowReceiptId] && provenByReceiptId[rowReceiptId][taskId]) rowProven[rowReceiptId] = true;
      }
    }
    var dependencySet = Object.create(null);
    if (Array.isArray(task.value.dependencyIds)) {
      for (var dj = 0; dj < task.value.dependencyIds.length; dj += 1) {
        if (typeof task.value.dependencyIds[dj] === 'string') dependencySet[task.value.dependencyIds[dj]] = true;
      }
    }
    for (var dk = 0; dk < dependsOnEdges.length; dk += 1) {
      if (dependsOnEdges[dk].fromId === taskId && typeof dependsOnEdges[dk].toId === 'string') dependencySet[dependsOnEdges[dk].toId] = true;
    }
    // Exact-ID gap attachment only — computed against the FULL canonical row
    // set BEFORE filters; a gap attaching to a filtered-out row drops with it.
    var rowGaps = [];
    for (var gi = 0; gi < gaps.length; gi += 1) {
      if (!isFenceGap(gaps[gi])) continue;
      if (gaps[gi].subjectId === taskId) {
        rowGaps.push(gaps[gi]);
        continue;
      }
      for (var gl = 0; gl < taskRuns.length; gl += 1) {
        if (gaps[gi].subjectId === String(taskRuns[gl].value.runId || '')) {
          rowGaps.push(gaps[gi]);
          break;
        }
      }
    }
    allRows.push({
      task: task,
      runs: taskRuns,
      rowReceipts: rowReceipts,
      rowProduced: rowProduced,
      rowProven: rowProven,
      executorByRunId: rowExecutor,
      dependencies: Object.keys(dependencySet).sort(compareId),
      gaps: rowGaps,
      taskPublicId: '',
      taskDisplayId: '',
      runPublicById: Object.create(null),
      runDisplayById: Object.create(null),
      receiptPublicById: Object.create(null),
      receiptDisplayById: Object.create(null),
    });
  }
  // Filters apply FIRST — bounded (64 chars) and secret-filtered; any
  // overlong or secret-bearing value fails closed to an empty view without
  // echoing and without surfacing unrelated scoped gaps.
  function filterHostile(value) {
    if (typeof value !== 'string') return false;
    var text = value.trim();
    return text.length > FLOW_FILTER_INPUT_LIMIT || OF_SECRET_MARKER.test(text);
  }
  var activeFilters = filters && typeof filters === 'object' ? filters : {};
  var anyHostileFilter = filterHostile(activeFilters.workId) || filterHostile(activeFilters.agentId) || filterHostile(activeFilters.state);
  var rows = anyHostileFilter ? [] : allRows;
  var workId = typeof activeFilters.workId === 'string' ? activeFilters.workId.trim() : '';
  if (workId.length > 0 && rows.length > 0) {
    var missionScope = Object.create(null);
    var taskScope = Object.create(null);
    for (var fi = 0; fi < edges.length; fi += 1) {
      if (edges[fi] && edges[fi].kind === 'contains' && edges[fi].fromId === workId) missionScope[edges[fi].toId] = true;
    }
    for (var fj = 0; fj < edges.length; fj += 1) {
      if (edges[fj] && edges[fj].kind === 'contains' && missionScope[edges[fj].fromId]) taskScope[edges[fj].toId] = true;
    }
    var scopedRows = [];
    for (var fk = 0; fk < rows.length; fk += 1) {
      if (taskScope[String(rows[fk].task.value.taskId || '')]) scopedRows.push(rows[fk]);
    }
    rows = scopedRows;
  }
  var agentFilter = typeof activeFilters.agentId === 'string' ? activeFilters.agentId.trim() : '';
  if (agentFilter.length > 0 && rows.length > 0) {
    var agentRows = [];
    for (var fl = 0; fl < rows.length; fl += 1) {
      var row = rows[fl];
      var rowTaskId = String(row.task.value.taskId || '');
      var matches = row.task.value.assignedAgentId === agentFilter;
      if (!matches) {
        for (var fa = 0; fa < assignedToEdges.length; fa += 1) {
          if (assignedToEdges[fa].fromId === rowTaskId && assignedToEdges[fa].toId === agentFilter) {
            matches = true;
            break;
          }
        }
      }
      if (!matches) {
        for (var fm = 0; fm < row.runs.length; fm += 1) {
          var filterRunId = String(row.runs[fm].value.runId || '');
          var filterExecutor = Object.prototype.hasOwnProperty.call(executorByRunId, filterRunId) ? executorByRunId[filterRunId] : null;
          if (filterExecutor && filterExecutor.value.agentId === agentFilter) {
            matches = true;
            break;
          }
        }
      }
      if (matches) agentRows.push(row);
    }
    rows = agentRows;
  }
  var stateFilter = typeof activeFilters.state === 'string' ? activeFilters.state.trim() : '';
  if (stateFilter.length > 0 && rows.length > 0) {
    var stateRows = [];
    for (var fn = 0; fn < rows.length; fn += 1) {
      if (rows[fn].task.value.status === stateFilter) stateRows.push(rows[fn]);
    }
    rows = stateRows;
  }
  // Unscoped typed gaps: only genuinely unmappable gaps (never attached to
  // ANY canonical row in the full pre-filter set) enter the honest unscoped
  // section — never dropped, never row-guessed, never scoped-out echoes.
  var attachedAnywhere = [];
  for (var ag = 0; ag < allRows.length; ag += 1) {
    for (var ah = 0; ah < allRows[ag].gaps.length; ah += 1) attachedAnywhere.push(allRows[ag].gaps[ah]);
  }
  var unscopedGaps = [];
  if (!(rows.length === 0 && anyHostileFilter)) {
    for (var ui = 0; ui < gaps.length; ui += 1) {
      if (isFenceGap(gaps[ui]) && attachedAnywhere.indexOf(gaps[ui]) === -1) unscopedGaps.push(gaps[ui]);
    }
  }
  // Candidate fact universe across ALL filtered rows BEFORE the bound: every
  // distinct canonical Task/Run/Receipt node in the selected view counts in
  // N, and public IDs come from the canonical full-column order over the
  // ENTIRE selected view — deterministic, kind-scoped, drawn from the
  // provably disjoint benign 'id:' / hostile 'redacted:' namespaces.
  // Selection and counting key on canonical fact keys — NEVER on display or
  // public IDs — byte-identical with the Node substrate.
  var ordinalByFactKey = Object.create(null);
  var publicByFactKey = Object.create(null);
  var candidateFactOrder = [];
  function assignFact(factKey, prefix, rawId) {
    if (Object.prototype.hasOwnProperty.call(ordinalByFactKey, factKey)) return;
    var ordinal = candidateFactOrder.length;
    ordinalByFactKey[factKey] = ordinal;
    publicByFactKey[factKey] = publicFactId(prefix, rawId, ordinal);
    candidateFactOrder.push(factKey);
  }
  for (var cft = 0; cft < rows.length; cft += 1) {
    assignFact('task:' + String(rows[cft].task.value.taskId || ''), 'task', String(rows[cft].task.value.taskId || ''));
  }
  for (var cfr = 0; cfr < rows.length; cfr += 1) {
    for (var cfr2 = 0; cfr2 < rows[cfr].runs.length; cfr2 += 1) {
      assignFact('run:' + String(rows[cfr].runs[cfr2].value.runId || ''), 'run', String(rows[cfr].runs[cfr2].value.runId || ''));
    }
  }
  for (var cfc = 0; cfc < rows.length; cfc += 1) {
    for (var cfc2 = 0; cfc2 < rows[cfc].rowReceipts.length; cfc2 += 1) {
      assignFact('receipt:' + String(rows[cfc].rowReceipts[cfc2].value.receiptId || ''), 'receipt', String(rows[cfc].rowReceipts[cfc2].value.receiptId || ''));
    }
  }
  var totalFacts = candidateFactOrder.length;
  var visibleFactKeys = Object.create(null);
  var visibleCount = 0;
  for (var vf = 0; vf < candidateFactOrder.length && vf < FLOW_FACT_LIMIT_BROWSER; vf += 1) {
    visibleFactKeys[candidateFactOrder[vf]] = true;
    visibleCount += 1;
  }
  var keptRows = [];
  for (var kr = 0; kr < rows.length; kr += 1) {
    if (visibleFactKeys['task:' + String(rows[kr].task.value.taskId || '')]) keptRows.push(rows[kr]);
  }
  for (var pm = 0; pm < keptRows.length; pm += 1) {
    var keptRow = keptRows[pm];
    var keptTaskId = String(keptRow.task.value.taskId || '');
    var keptTaskKey = 'task:' + keptTaskId;
    var keptTaskOrdinal = Object.prototype.hasOwnProperty.call(ordinalByFactKey, keptTaskKey) ? ordinalByFactKey[keptTaskKey] : 0;
    keptRow.taskPublicId = Object.prototype.hasOwnProperty.call(publicByFactKey, keptTaskKey) ? publicByFactKey[keptTaskKey] : publicFactId('task', keptTaskId, keptTaskOrdinal);
    keptRow.taskDisplayId = publicDisplayId('task', keptTaskId, keptTaskOrdinal);
    for (var pmr = 0; pmr < keptRow.runs.length; pmr += 1) {
      var pmRunId = String(keptRow.runs[pmr].value.runId || '');
      var pmRunKey = 'run:' + pmRunId;
      var pmRunOrdinal = Object.prototype.hasOwnProperty.call(ordinalByFactKey, pmRunKey) ? ordinalByFactKey[pmRunKey] : 0;
      keptRow.runPublicById[pmRunId] = Object.prototype.hasOwnProperty.call(publicByFactKey, pmRunKey) ? publicByFactKey[pmRunKey] : publicFactId('run', pmRunId, pmRunOrdinal);
      keptRow.runDisplayById[pmRunId] = publicDisplayId('run', pmRunId, pmRunOrdinal);
    }
    for (var pmc = 0; pmc < keptRow.rowReceipts.length; pmc += 1) {
      var pmReceiptId = String(keptRow.rowReceipts[pmc].value.receiptId || '');
      var pmReceiptKey = 'receipt:' + pmReceiptId;
      var pmReceiptOrdinal = Object.prototype.hasOwnProperty.call(ordinalByFactKey, pmReceiptKey) ? ordinalByFactKey[pmReceiptKey] : 0;
      keptRow.receiptPublicById[pmReceiptId] = Object.prototype.hasOwnProperty.call(publicByFactKey, pmReceiptKey) ? publicByFactKey[pmReceiptKey] : publicFactId('receipt', pmReceiptId, pmReceiptOrdinal);
      keptRow.receiptDisplayById[pmReceiptId] = publicDisplayId('receipt', pmReceiptId, pmReceiptOrdinal);
    }
  }
  if (keptRows.length === 0 && unscopedGaps.length === 0) {
    return '<div class="of-flow" data-component="FabricFlow">' +
      '<div class="of-state of-state-empty" data-component="FabricState" data-state="empty" role="status" aria-label="empty: no rows in this view">' +
      '<strong class="of-state-title">empty</strong>' +
      '<p class="of-state-detail">no rows in this view</p>' +
      '</div>' +
      '</div>';
  }
  function renderRow(rowData) {
    var rowTaskId = String(rowData.task.value.taskId || '');
    var taskCell = fact('task', escAttr(rowData.taskDisplayId), 'data-of-fact="' + escAttr(rowData.taskPublicId) + '"') +
      fact('observed', safeText(rowData.task.value.status, 'unknown state')) +
      fact('desired', safeText(rowData.task.value.desiredState, 'unknown desired state'));
    for (var depIndex = 0; depIndex < rowData.dependencies.length; depIndex += 1) {
      var depId = rowData.dependencies[depIndex];
      taskCell += fact('depends on', escAttr(safeId(depId, FLOW_REDACTED_ID)), 'data-of-dependency="' + escAttr(safeId(depId, FLOW_REDACTED_ID)) + '"');
    }
    var runCell = '';
    var visibleRuns = [];
    for (var runIndex = 0; runIndex < rowData.runs.length; runIndex += 1) {
      if (visibleFactKeys['run:' + String(rowData.runs[runIndex].value.runId || '')]) visibleRuns.push(rowData.runs[runIndex]);
    }
    if (visibleRuns.length > 0) {
      for (var runVisible = 0; runVisible < visibleRuns.length; runVisible += 1) {
        var visibleRun = visibleRuns[runVisible];
        var visibleRunId = String(visibleRun.value.runId || '');
        var runExecutor = Object.prototype.hasOwnProperty.call(rowData.executorByRunId, visibleRunId) ? rowData.executorByRunId[visibleRunId] : null;
        runCell += fact('run', escAttr(rowData.runDisplayById[visibleRunId] || ''), 'data-of-fact="' + escAttr(rowData.runPublicById[visibleRunId] || '') + '"') +
          fact('status', safeText(visibleRun.value.status, 'unknown state')) +
          (runExecutor !== null
            ? fact('executor', escAttr(safeId(runExecutor.value.agentId, FLOW_REDACTED_ID)), 'data-of-executor="' + escAttr(safeId(runExecutor.value.agentId, FLOW_REDACTED_ID)) + '"')
            : fact('executor', 'executor not present in projection'));
      }
    } else {
      runCell += fact('run', 'run not present in projection');
    }
    var receiptCell = '';
    var visibleReceipts = [];
    for (var receiptIndex = 0; receiptIndex < rowData.rowReceipts.length; receiptIndex += 1) {
      if (visibleFactKeys['receipt:' + String(rowData.rowReceipts[receiptIndex].value.receiptId || '')]) visibleReceipts.push(rowData.rowReceipts[receiptIndex]);
    }
    if (visibleReceipts.length > 0) {
      for (var receiptVisible = 0; receiptVisible < visibleReceipts.length; receiptVisible += 1) {
        var visibleReceipt = visibleReceipts[receiptVisible];
        var visibleReceiptId = String(visibleReceipt.value.receiptId || '');
        var kinds = [];
        if (rowData.rowProduced[visibleReceiptId]) kinds.push('produces');
        if (rowData.rowProven[visibleReceiptId]) kinds.push('proves');
        var proof = kinds.join(' · ');
        receiptCell += fact('receipt', escAttr(rowData.receiptDisplayById[visibleReceiptId] || ''), 'data-of-fact="' + escAttr(rowData.receiptPublicById[visibleReceiptId] || '') + '"') +
          fact('status', safeText(visibleReceipt.value.status, 'unknown state')) +
          (kinds.length > 0 ? fact('proof', escAttr(proof), 'data-of-proof="' + escAttr(proof) + '"') : fact('proof', 'proof not present in projection'));
      }
    } else if (visibleRuns.length > 0) {
      receiptCell += fact('receipt', 'receipt not present in projection');
      receiptCell += fact('proof', 'proof not present in projection');
    } else {
      receiptCell += fact('receipt', 'receipt not present in projection');
    }
    for (var gapIndex = 0; gapIndex < rowData.gaps.length; gapIndex += 1) {
      receiptCell += renderGapBlock(rowData.gaps[gapIndex]);
    }
    // Visible direction lives INSIDE the cells as static path markup — never
    // animation-dependent, never a span sibling directly under tr.
    var pathTaskRun = visibleRuns.length > 0 ? '<span class="of-flow-path" aria-hidden="true" data-of-path="task-run">→</span>' : '';
    var pathRunReceipt = visibleRuns.length > 0 && visibleReceipts.length > 0 ? '<span class="of-flow-path" aria-hidden="true" data-of-path="run-receipt">→</span>' : '';
    return '<tr data-of-flow-row="' + escAttr(publicRowId(rowData.taskPublicId)) + '">' +
      '<td data-of-flow-cell="task">' + taskCell + pathTaskRun + '</td>' +
      '<td data-of-flow-cell="run">' + runCell + pathRunReceipt + '</td>' +
      '<td data-of-flow-cell="receipt">' + receiptCell + '</td>' +
      '</tr>';
  }
  var rowHtml = '';
  for (var rowIndex = 0; rowIndex < keptRows.length; rowIndex += 1) {
    rowHtml += renderRow(keptRows[rowIndex]);
  }
  var unscopedRow = '';
  if (unscopedGaps.length > 0) {
    var unscopedGapHtml = '';
    for (var ug = 0; ug < unscopedGaps.length; ug += 1) unscopedGapHtml += renderGapBlock(unscopedGaps[ug]);
    unscopedRow = '<tr data-of-flow-unscoped-gaps="true"><td data-of-flow-cell="task" colspan="3">' +
      '<div class="of-fact"><dt>typed gaps not scoped to a visible task</dt><dd>unscoped</dd></div>' +
      unscopedGapHtml +
      '</td></tr>';
  }
  var listItems = '';
  for (var listIndex = 0; listIndex < keptRows.length; listIndex += 1) {
    var listRow = keptRows[listIndex];
    var listTaskId = String(listRow.task.value.taskId || '');
    var listVisibleRuns = [];
    for (var li = 0; li < listRow.runs.length; li += 1) {
      if (visibleFactKeys['run:' + String(listRow.runs[li].value.runId || '')]) listVisibleRuns.push(listRow.runs[li]);
    }
    var listVisibleReceipts = [];
    for (var lj = 0; lj < listRow.rowReceipts.length; lj += 1) {
      if (visibleFactKeys['receipt:' + String(listRow.rowReceipts[lj].value.receiptId || '')]) listVisibleReceipts.push(listRow.rowReceipts[lj]);
    }
    var runLabel = listVisibleRuns.length > 0 ? 'run ' + (listRow.runDisplayById[String(listVisibleRuns[0].value.runId || '')] || '') : 'run not present in projection';
    var receiptLabel = listVisibleReceipts.length > 0 ? 'receipt ' + (listRow.receiptDisplayById[String(listVisibleReceipts[0].value.receiptId || '')] || '') : 'receipt not present in projection';
    var direction = 'flow: task ' + listRow.taskDisplayId + ' · ' + runLabel + ' · ' + receiptLabel;
    var stateFacts = '<span class="of-flow-item-fact" data-of-task-status="' + escAttr(safeId(listRow.task.value.status, 'unknown state')) + '">' + safeText(listRow.task.value.status, 'unknown state') + '</span>' +
      '<span class="of-flow-item-fact" data-of-task-desired="' + escAttr(safeId(listRow.task.value.desiredState, 'unknown desired state')) + '">' + safeText(listRow.task.value.desiredState, 'unknown desired state') + '</span>';
    var dependencyFacts = '';
    for (var ld = 0; ld < listRow.dependencies.length; ld += 1) {
      var listDepId = listRow.dependencies[ld];
      dependencyFacts += '<span class="of-flow-item-fact" data-of-dependency="' + escAttr(safeId(listDepId, FLOW_REDACTED_ID)) + '">' + escAttr(safeId(listDepId, FLOW_REDACTED_ID)) + '</span>';
    }
    var runFacts = '';
    for (var lk = 0; lk < listVisibleRuns.length; lk += 1) {
      var listRunId = String(listVisibleRuns[lk].value.runId || '');
      var listExecutor = Object.prototype.hasOwnProperty.call(listRow.executorByRunId, listRunId) ? listRow.executorByRunId[listRunId] : null;
      runFacts += '<span class="of-flow-item-fact" data-of-fact="' + escAttr(listRow.runPublicById[listRunId] || '') + '">' + escAttr(listRow.runDisplayById[listRunId] || '') + '</span>' +
        '<span class="of-flow-item-fact" data-of-run-status="' + escAttr(safeId(listVisibleRuns[lk].value.status, 'unknown state')) + '">' + safeText(listVisibleRuns[lk].value.status, 'unknown state') + '</span>' +
        (listExecutor !== null
          ? '<span class="of-flow-item-fact" data-of-executor="' + escAttr(safeId(listExecutor.value.agentId, FLOW_REDACTED_ID)) + '">' + escAttr(safeId(listExecutor.value.agentId, FLOW_REDACTED_ID)) + '</span>'
          : '<span class="of-flow-item-fact">executor not present in projection</span>');
    }
    var receiptFacts = '';
    for (var ll = 0; ll < listVisibleReceipts.length; ll += 1) {
      var listReceiptId = String(listVisibleReceipts[ll].value.receiptId || '');
      var listKinds = [];
      if (listRow.rowProduced[listReceiptId]) listKinds.push('produces');
      if (listRow.rowProven[listReceiptId]) listKinds.push('proves');
      var listProof = listKinds.join(' · ');
      receiptFacts += '<span class="of-flow-item-fact" data-of-fact="' + escAttr(listRow.receiptPublicById[listReceiptId] || '') + '">' + escAttr(listRow.receiptDisplayById[listReceiptId] || '') + '</span>' +
        '<span class="of-flow-item-fact" data-of-receipt-status="' + escAttr(safeId(listVisibleReceipts[ll].value.status, 'unknown state')) + '">' + safeText(listVisibleReceipts[ll].value.status, 'unknown state') + '</span>' +
        (listKinds.length > 0
          ? '<span class="of-flow-item-fact" data-of-proof="' + escAttr(listProof) + '">' + escAttr(listProof) + '</span>'
          : '<span class="of-flow-item-fact">proof not present in projection</span>');
    }
    var missingLabels = (listVisibleRuns.length === 0 ? '<span class="of-flow-item-fact">run not present in projection</span>' : '') +
      (listVisibleReceipts.length === 0 ? '<span class="of-flow-item-fact">receipt not present in projection</span>' : '');
    var gapFacts = '';
    for (var lg = 0; lg < listRow.gaps.length; lg += 1) gapFacts += renderGapBlock(listRow.gaps[lg]);
    listItems += '<li class="of-flow-item" data-of-fact="' + escAttr(listRow.taskPublicId) + '">' +
      '<span class="of-flow-direction">' + escAttr(direction) + '</span>' +
      stateFacts +
      dependencyFacts +
      runFacts +
      receiptFacts +
      missingLabels +
      gapFacts +
      '</li>';
  }
  if (unscopedGaps.length > 0) {
    var unscopedListGaps = '';
    for (var ul = 0; ul < unscopedGaps.length; ul += 1) unscopedListGaps += renderGapBlock(unscopedGaps[ul]);
    listItems += '<li class="of-flow-item of-flow-item-unscoped" data-of-flow-unscoped-gaps="true">' +
      '<span class="of-flow-direction">typed gaps not scoped to a visible task</span>' +
      unscopedListGaps +
      '</li>';
  }
  var truncated = totalFacts > visibleCount
    ? '<p class="of-flow-truncation" data-of-flow-truncation="true">showing ' + visibleCount + ' of ' + totalFacts + '</p>'
    : '';
  return '<div class="of-flow" data-component="FabricFlow">' +
    truncated +
    '<table class="of-flow-graph" data-of-flow-representation="graph" aria-hidden="true">' +
    '<thead><tr>' +
    '<th data-of-flow-column="task">Task</th>' +
    '<th data-of-flow-column="run">Run</th>' +
    '<th data-of-flow-column="receipt">Receipt</th>' +
    '</tr></thead>' +
    '<tbody>' + rowHtml + unscopedRow + '</tbody>' +
    '</table>' +
    '<ol class="of-flow-list" data-of-flow-fallback="linear">' + listItems + '</ol>' +
    '</div>';
}
`;
