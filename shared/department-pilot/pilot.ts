import type { GoalGraphNode } from '../../workers/quests/src/goal-graph/types.ts';
import { composeStructuredPack, type ComposeHit, type ComposeTarget } from '../../workers/cortex-mcp/src/taste-compose.ts';
import { DEPARTMENTS, PRODUCTS, STAGE_BINDINGS, DESK_SKILL_REFERENCES, SKILL_REFERENCE_PINS, type DepartmentId, type ProductId, type KpiDefinition } from './catalog.ts';

export interface PilotInput {
  tenantId: string; now: string; expectedHeadDigest: string;
  graph: { tenantId: string; headDigest: string; observedAt: string; rootId?: string; nodes: GoalGraphNode[] };
  /** Explicit accepted-plan selection supplied by the GSD reader, not node metadata. */
  eligibility?: { sourceRef: string; taskIds: string[] };
}
export interface DepartmentBinding {
  departmentId: DepartmentId; category: string; roleId: string; clusterIds: readonly string[];
  deskId: string | null; inheritedFrom: string; sourceRef: string;
  skillRefs: Array<{id:string;clusterId:string;digest:string;origin:string;sourceRef:string}>;
}
export interface PilotNode {
  nodeId: string; parentNodeId: string | null; workObjectId: string;
  label: string; desiredState: string; currentState: string; nextAction: string | null;
  sourceRef: string; status: string; scope: string; dueAt: string | null;
  binding: DepartmentBinding | null; runtimeAssignment: 'unverified';
  objectiveRefs: string[]; kpiIds: string[]; evidenceRef: string | null;
  evidenceState: 'reference-supplied' | 'unavailable'; eligible: boolean; gap: string | null;
}
export interface PilotProduct {
  id: ProductId; label: string; sector: string; nodes: PilotNode[]; daily: PilotNode[]; monthly: PilotNode[];
}
export interface DepartmentPilot {
  schema: 'cambium.department-pilot.v1'; tenantId: string; headDigest: string; observedAt: string;
  day: string; month: string; quarter: string; fresh: boolean; gaps: string[];
  products: PilotProduct[]; executionGranted: false; missionCurrency: 'review-required';
}
const time = (value: string): number => {
  // Require an explicit timezone; date-only or local-time strings are ambiguous.
  const parts = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.exec(value) : null;
  if (!parts || Number(parts[2]) < 1 || Number(parts[2]) > 12 || Number(parts[3]) < 1
    || Number(parts[3]) > new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate()
    || Number(parts[4]) > 23 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid explicit time');
  return Date.parse(value);
};
const digest = (v: string): boolean => typeof v === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(v);
function windowAt(now: number): { day: string; month: string; quarter: string } {
  // Fixed IST offset avoids host timezone and locale differences; India has no DST.
  const day = new Date(now + 330 * 60_000).toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7), quarter: `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}` };
}
export function compileDepartmentPilot(input: PilotInput): DepartmentPilot {
  const now = time(input.now), observed = time(input.graph.observedAt);
  if (!input.tenantId || input.graph.tenantId !== input.tenantId) throw new Error('Graph tenant mismatch');
  if (!digest(input.expectedHeadDigest) || !digest(input.graph.headDigest)) throw new Error('Invalid head digest');
  if (input.graph.rootId !== undefined && (typeof input.graph.rootId !== 'string' || !input.graph.rootId || input.graph.nodes.some(n=>n.nodeId===input.graph.rootId))) throw new Error('Invalid graph boundary root');
  if (!Array.isArray(input.graph.nodes) || input.graph.nodes.length > 512) throw new Error('Graph node budget exceeded');
  const byId = new Map<string, GoalGraphNode>();
  for (const n of input.graph.nodes) {
    if (!n || typeof n.nodeId !== 'string' || !n.nodeId || n.nodeId.length > 512 || byId.has(n.nodeId)) throw new Error('Invalid or duplicate node identity');
    if (n.tenantId !== input.tenantId) throw new Error('Node tenant mismatch');
    if ([n.desiredState,n.currentState,n.sourceRef,n.owner].some(v => typeof v !== 'string' || v.length > 8192) || (n.nextAction !== null && (typeof n.nextAction !== 'string' || n.nextAction.length > 8192))) throw new Error('Invalid node text budget');
    if (!n.metadata || typeof n.metadata !== 'object' || Array.isArray(n.metadata)
      || typeof n.desiredState !== 'string' || typeof n.currentState !== 'string' || typeof n.sourceRef !== 'string'
      || (n.parentNodeId !== null && typeof n.parentNodeId !== 'string')) throw new Error('Malformed graph node');
    byId.set(n.nodeId, n);
  }
  for (const n of byId.values()) {
    const seen = new Set<string>(); let at: GoalGraphNode | undefined = n;
    while (at) {
      if (seen.has(at.nodeId)) throw new Error('Graph containment cycle');
      seen.add(at.nodeId); at = at.parentNodeId ? byId.get(at.parentNodeId) : undefined;
    }
  }
  const w = windowAt(now);
  const fresh = input.expectedHeadDigest === input.graph.headDigest && now >= observed && now - observed <= 24 * 3_600_000;
  if (input.eligibility && (typeof input.eligibility.sourceRef !== 'string' || !Array.isArray(input.eligibility.taskIds) || input.eligibility.taskIds.length > 512 || !input.eligibility.taskIds.every(id => typeof id === 'string'))) throw new Error('Invalid GSD eligibility');
  const eligibleOrder = input.eligibility?.sourceRef?.trim() ? [...new Set(input.eligibility.taskIds)] : [];
  const eligible = new Set(eligibleOrder);
  const resolve = (n: GoalGraphNode): DepartmentBinding | null => {
    let at: GoalGraphNode | undefined = n;
    while (at && at.workObjectId === n.workObjectId) {
      const stage = typeof at.metadata.stage === 'string' ? at.metadata.stage : '';
      const b = Object.hasOwn(STAGE_BINDINGS, stage) ? STAGE_BINDINGS[stage] : undefined;
      if (b) {
        const d = DEPARTMENTS[b.departmentId];
        return { ...b, roleId: d.roleId, clusterIds: [...d.clusters], deskId: b.deskId ?? null, inheritedFrom: at.nodeId, sourceRef: d.sourceRef, skillRefs: (DESK_SKILL_REFERENCES[b.deskId ?? ''] ?? []).map(id => ({...SKILL_REFERENCE_PINS[id]})) };
      }
      at = at.parentNodeId ? byId.get(at.parentNodeId) : undefined;
    }
    return null;
  };
  const products: PilotProduct[] = PRODUCTS.map(product => {
    const nodes: PilotNode[] = [...byId.values()].filter(n => n.workObjectId === product.workObjectId).map(n => {
      const binding = resolve(n);
      let containmentGap: string | null = null; let pathNode: GoalGraphNode | undefined = n;
      while(pathNode?.parentNodeId) {
        if (input.graph.rootId && pathNode.parentNodeId === input.graph.rootId) break;
        const parent = byId.get(pathNode.parentNodeId);
        if (!parent) { containmentGap = 'Ancestor missing from supplied snapshot'; break; }
        if (parent.workObjectId !== n.workObjectId) { containmentGap = 'Parent crosses work-object scope; inheritance stopped'; break; }
        pathNode = parent;
      }
      const due = Object.hasOwn(n.metadata, 'dueFor') ? n.metadata.dueFor : n.reviewAt;
      let dueAt: string | null = null; let invalidDue = false;
      try { if (due !== null && due !== undefined) { if (typeof due !== 'string') throw new Error('Invalid date type'); time(due); dueAt = due; } } catch { invalidDue = true; }
      const evidenceRef = typeof n.metadata.evidenceRef === 'string' ? n.metadata.evidenceRef : null;
      const roots: string[] = []; let ancestor: GoalGraphNode | undefined = n;
      while (ancestor && ancestor.workObjectId === n.workObjectId) {
        if (ancestor.scope === 'macro' || ancestor.scope === 'meso') roots.push(ancestor.nodeId);
        ancestor = ancestor.parentNodeId ? byId.get(ancestor.parentNodeId) : undefined;
      }
      return { nodeId: n.nodeId, parentNodeId: n.parentNodeId, workObjectId: product.workObjectId,
        label: typeof n.metadata.label === 'string' ? n.metadata.label : n.desiredState,
        desiredState: n.desiredState, currentState: n.currentState, nextAction: n.nextAction, sourceRef: n.sourceRef,
        scope: n.scope, status: n.status, dueAt, binding, runtimeAssignment: 'unverified' as const,
        objectiveRefs: roots, kpiIds: binding ? [`${product.id}:${binding.departmentId}:evidence-v1`] : [],
        evidenceRef, evidenceState: evidenceRef ? 'reference-supplied' as const : 'unavailable' as const,
        eligible: fresh && !!binding && !containmentGap && !invalidDue && eligible.has(n.nodeId) && n.status === 'active' && !n.waitCondition && n.metadata.facet === 'task',
        gap: [containmentGap, invalidDue ? 'Invalid source date; daily selection held' : null, binding ? null : 'No source-backed stage binding; category and role remain unbound'].filter(Boolean).join('; ') || null,
      };
    }).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const daily = eligibleOrder.flatMap(id => { const n = nodes.find(n => n.nodeId === id); return n?.eligible && (!n.dueAt || windowAt(time(n.dueAt)).day <= w.day) ? [n] : []; });
    const monthly = nodes.filter(n => n.dueAt && windowAt(time(n.dueAt)).month === w.month);
    return { id: product.id, label: product.label, sector: product.sector, nodes, daily, monthly };
  });
  const choices = new Map(products.flatMap(p => p.daily.map(n => [n.nodeId, {productId:p.id,node:n}] as const)));
  const selected = new Set<string>(), counts = new Map<string,number>();
  for(const id of eligibleOrder) {
    const item=choices.get(id); if(!item || selected.size>=10) continue;
    const key=`${item.productId}:${item.node.binding!.departmentId}`, count=counts.get(key)??0;
    if(count>=5)continue; counts.set(key,count+1); selected.add(id);
  }
  for(const product of products)product.daily=product.daily.filter(n=>selected.has(n.nodeId));
  return { schema: 'cambium.department-pilot.v1', tenantId: input.tenantId, headDigest: input.graph.headDigest,
    observedAt: input.graph.observedAt, ...w, fresh, products, executionGranted: false, missionCurrency: 'review-required',
    gaps: [ ...(products.flatMap(p=>p.nodes).some(n=>n.gap) ? ['Some nodes have missing bindings, ancestry or invalid dates; inspect their node gaps'] : []), ...(!fresh ? ['Graph frontier is changed, future-dated or older than 24 hours; daily recommendations held'] : []),
      ...(!input.eligibility?.sourceRef?.trim() ? ['GSD eligibility reader unavailable; no daily work admitted'] : []),
      'Role IDs are source references; current runtime assignment is unverified',
      'MISSION.md v0.4 horizon needs owner review before accepting new departmental objectives',
      'No standing-policy graph writer or cadence is activated by this projection' ] };
}
export function classifyPilotChange(kind: string): { disposition: 'automatic-read-only' | 'hitl'; executionGranted: false; reason: string } {
  const safe = ['refresh-view', 'deduplicate-view', 'select-eligible-view', 'draft-learning'].includes(kind);
  return { disposition: safe ? 'automatic-read-only' : 'hitl', executionGranted: false,
    reason: safe ? 'Derived source output only; no canonical mutation or dispatch' : 'Existing owner must review the exact consequential change' };
}
export interface KpiObservation {
  definitionId: string; version: number; productId: string; cohort: string; window: string;
  observedAt: string; sourceRef: string; numerator: number; denominator: number;
}
export function observeKpi(d: KpiDefinition, o: KpiObservation | null, now: string, window: string): { state: 'observed' | 'stale' | 'unavailable'; value: number | null; reason: string; sampleSize: number | null } {
  const missing = (reason: string) => ({ state: 'unavailable' as const, value: null, reason, sampleSize: null });
  const current = time(now);
  if (!o) return missing('Measurement source unavailable');
  if (o.definitionId !== d.id || o.version !== d.version || o.productId !== d.productId || o.cohort !== d.cohort || o.window !== window || typeof o.sourceRef !== 'string' || !o.sourceRef.trim()) return missing('Definition, product, cohort, window or provenance mismatch');
  if (![o.numerator, o.denominator].every(Number.isSafeInteger) || o.denominator <= 0 || o.numerator < 0 || o.numerator > o.denominator) return missing('Unknown or invalid eligible population');
  let observed: number; try { observed = time(o.observedAt); } catch { return missing('Invalid observation time'); }
  if (observed > current) return missing('Observation is future-dated');
  if (current - observed > d.maxAgeHours * 3_600_000) return { state: 'stale', value: null, reason: 'Measurement is older than its freshness rule', sampleSize: o.denominator };
  return { state: 'observed', value: o.numerator / o.denominator, reason: 'Supplied source observation; no target accepted', sampleSize: o.denominator };
}
/** Reuse Taste without copying raw reference bodies, prompts or a corpus into the folio. */
export function prepareTasteContext(intent: string, target: ComposeTarget, hits: ComposeHit[]) {
  if (hits.length > 8) throw new Error('Taste source budget exceeded');
  const pack = composeStructuredPack(intent.slice(0, 500), target, hits, []);
  return { state: hits.length ? 'supplied' as const : 'unavailable' as const,
    lineage: pack.taste_lineage, skills: pack.skills_extracted, sourceRef: 'workers/cortex-mcp/src/taste-compose.ts' };
}
export function learningCandidate(input: { productId: ProductId; departmentId: DepartmentId; hypothesis: string; evidenceRefs: string[]; evaluationRef: string; rollbackRef: string }) {
  if (!input.evidenceRefs.length || !input.evaluationRef || !input.rollbackRef) throw new Error('Learning requires evidence, evaluation and rollback references');
  return { ...input, evidenceRefs: [...input.evidenceRefs], state: 'candidate' as const,
    sourceRef: 'bin/operator/cortex-memory.ts', review: 'quarterly' as const, memoryWriteGranted: false as const };
}
