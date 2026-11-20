import type { GoalGraphNode } from '../../workers/quests/src/goal-graph/types.ts';
import { PRODUCTS, KPI_DEFINITIONS, type ProductId, type KpiDefinition } from './catalog.ts';
import { observeKpi, type KpiObservation } from './pilot.ts';

export interface DepartmentReadScope {
  tenantId: string; headDigest: string; observedAt: string; nodes: GoalGraphNode[];
}
export interface AcceptedGsdScope {
  tenantId: string; workObjectId: string; headDigest: string; observedAt: string; expiresAt: string;
  sourceRef: string; isaAcceptanceRef: string; planRef: string; planDigest: string;
  /** Owner order, never inferred from a date, graph approval, or model recommendation. */
  tasks: Array<{ nodeId: string; sequence: number; state: 'pending' | 'complete' | 'blocked'; dependsOn: Array<{ nodeId: string; satisfied: boolean; evidenceRef: string }> }>;
}
export interface GsdSourceHold { kind: 'owner-hold'; state: 'held' | 'unavailable'; sourceRef: string; reason: string }
export interface KpiSourceReadback { definition: KpiDefinition; observation: KpiObservation }
/** Server-only composition seams. Implementations must reread accepted owner sources.
 * These are not request-body fields, persisted approvals, or an admission API. */
export interface DepartmentSourceReaders {
  readAcceptedGsd?: (scope: DepartmentReadScope, workObjectId: string) => Promise<AcceptedGsdScope | GsdSourceHold | null>;
  readKpi?: (scope: DepartmentReadScope, definition: KpiDefinition, window: string) => Promise<KpiSourceReadback[] | null>;
}
export interface DepartmentSources {
  schema: 'cambium.department-sources.v1'; tenantId: string; headDigest: string; observedAt: string;
  gsd: Array<{ productId: ProductId; state: 'available' | 'held' | 'unavailable'; sourceRef: string | null; taskIds: string[]; reason: string }>;
  kpis: Array<{ definitionId: string; state: 'observed' | 'stale' | 'unavailable'; reason: string; observation: KpiObservation | null }>;
  executionGranted: false;
}
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 8192;
const digest = (v: unknown) => typeof v === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(v);
const timestamp = (v: unknown): number => typeof v === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN;

export function acceptedGsdSelection(scope: DepartmentReadScope, workObjectId: string, read: AcceptedGsdScope): string[] {
  const now = timestamp(scope.observedAt), at = timestamp(read.observedAt), expires = timestamp(read.expiresAt);
  if (read.tenantId !== scope.tenantId || read.workObjectId !== workObjectId || read.headDigest !== scope.headDigest
    || ![now, at, expires].every(Number.isFinite) || at > now || now - at > 24 * 3600_000 || expires <= now
    || ![read.sourceRef, read.isaAcceptanceRef, read.planRef].every(nonempty) || !digest(read.planDigest)
    || !Array.isArray(read.tasks) || read.tasks.length > 512) throw new Error('Accepted ISA/GSD scope, frontier, provenance or freshness is unconfirmed');
  const byId = new Map(scope.nodes.map(n => [n.nodeId, n]));
  const taskIds = new Set<string>(), sequences = new Set<number>();
  for (const t of read.tasks) {
    const node = byId.get(t.nodeId);
    if (!node || node.workObjectId !== workObjectId || node.metadata.facet !== 'task' || taskIds.has(t.nodeId)
      || !['pending','complete','blocked'].includes(t.state) || !Number.isSafeInteger(t.sequence) || t.sequence < 0 || sequences.has(t.sequence)
      || !Array.isArray(t.dependsOn) || t.dependsOn.length > 512) throw new Error('Accepted GSD identity or sequence is ambiguous');
    taskIds.add(t.nodeId); sequences.add(t.sequence);
    const ids = new Set<string>();
    for (const d of t.dependsOn) {
      if (!nonempty(d.nodeId) || d.nodeId === t.nodeId || ids.has(d.nodeId) || typeof d.satisfied !== 'boolean'
        || (d.satisfied && !nonempty(d.evidenceRef))) throw new Error('Accepted GSD dependency is unconfirmed');
      ids.add(d.nodeId);
    }
    // Bookkeeping prerequisites cannot disappear from the accepted owner read.
    const recorded = String(node.metadata.prerequisiteIds ?? '').split(',').map(id => id.trim()).filter(Boolean);
    if (recorded.some(id => !ids.has(id))) throw new Error('Accepted GSD read omits recorded planning prerequisites');
  }
  const tasks = new Map(read.tasks.map(t => [t.nodeId, t]));
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('Accepted GSD dependencies are cyclic');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of tasks.get(id)?.dependsOn ?? []) if (tasks.has(dep.nodeId)) {
      if (tasks.get(dep.nodeId)!.sequence >= tasks.get(id)!.sequence) throw new Error('GSD dependency sequence conflicts with owner order');
      visit(dep.nodeId);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of tasks.keys()) visit(id);
  return [...read.tasks].sort((a,b) => a.sequence - b.sequence)
    .filter(t => t.state === 'pending' && t.dependsOn.every(d => d.satisfied)).map(t => t.nodeId);
}

/** Read-through only. Missing cohorts/readers never become zero or a target. */
export async function readDepartmentSources(scope: DepartmentReadScope, readers?: DepartmentSourceReaders): Promise<DepartmentSources> {
  const month = new Date(timestamp(scope.observedAt) + 330 * 60_000).toISOString().slice(0,7);
  const gsd: DepartmentSources['gsd'] = [];
  for (const product of PRODUCTS) {
    const row: DepartmentSources['gsd'][number] = {productId:product.id,state:'unavailable',sourceRef:null,taskIds:[],reason:'Accepted ISA/GSD owner reader unavailable for this WorkObject; no daily work selected'};
    if (readers?.readAcceptedGsd) try {
      const result = await readers.readAcceptedGsd(structuredClone(scope), product.workObjectId);
      if (result && 'kind' in result && result.kind === 'owner-hold') {
        if (!nonempty(result.sourceRef) || !nonempty(result.reason) || !['held','unavailable'].includes(result.state)) throw new Error('Invalid owner hold');
        row.state=result.state; row.sourceRef=result.sourceRef; row.reason=result.reason;
      } else if (result) { row.taskIds=acceptedGsdSelection(scope,product.workObjectId,result as AcceptedGsdScope); row.sourceRef=result.sourceRef; row.state='available'; row.reason='Accepted owner scope and dependency-ready sequence; display only, execution still requires admission'; }
    } catch { row.state='held'; row.reason='ISA/GSD reader failed scope, dependency, sequence, frontier or freshness validation'; }
    gsd.push(row);
  }
  const kpis: DepartmentSources['kpis'] = [];
  for (const definition of KPI_DEFINITIONS) {
    const row: DepartmentSources['kpis'][number] = {definitionId:definition.id,state:'unavailable',reason:'Measurement owner or complete eligible cohort unavailable',observation:null};
    if (readers?.readKpi) try {
      const results = await readers.readKpi(structuredClone(scope),structuredClone(definition),month);
      if (results?.length === 1) {
        const result = results[0];
        // Immutable full definition, including formula, cohort, window policy and guardrail.
        if (Object.keys(result.definition).length !== Object.keys(definition).length
          || Object.entries(definition).some(([k,v]) => result.definition[k as keyof KpiDefinition] !== v)) throw new Error('KPI definition drift');
        const metric = observeKpi(definition,result.observation,scope.observedAt,month);
        row.state=metric.state; row.reason=metric.reason;
        if (metric.state === 'observed') row.observation=result.observation;
      } else if (results && results.length > 1) row.reason='Conflicting measurement revisions; owner must select one applicable observation';
    } catch { row.reason='Measurement reader failed immutable definition, cohort, denominator, window or provenance validation'; }
    kpis.push(row);
  }
  return {schema:'cambium.department-sources.v1',tenantId:scope.tenantId,headDigest:scope.headDigest,observedAt:scope.observedAt,gsd,kpis,executionGranted:false};
}
