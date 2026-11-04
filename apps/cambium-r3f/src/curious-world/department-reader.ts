import { normalizeFounderGraph } from './founder-graph.ts';
import type { DepartmentPilotReader } from './department-folio.ts';
import type { DepartmentSources } from '../../../../shared/department-pilot/readers.ts';
import type { GoalGraphNode } from '../../../../workers/quests/src/goal-graph/types.ts';
import { PRODUCTS, KPI_DEFINITIONS } from '../../../../shared/department-pilot/catalog.ts';

/** Same-origin authenticated graph response only. Legacy serving hosts expose
 * missing owner readers honestly; a bookkeeping decision never admits a task. */
export function createDepartmentReader(raw: unknown): DepartmentPilotReader {
  const graph = normalizeFounderGraph(raw);
  const input = { tenantId:'cambium', now:graph.servedAt, expectedHeadDigest:graph.head.graphDigest,
    graph:{tenantId:'cambium',headDigest:graph.head.graphDigest,observedAt:graph.servedAt,rootId:graph.rootId,nodes:graph.nodes as unknown as GoalGraphNode[]} };
  const source = (raw as {departmentSources?:DepartmentSources}).departmentSources;
  const reader: DepartmentPilotReader = {input,observations:[],readerStatus:[],sourceKind:'authenticated-founder'};
  if (!source) {
    reader.readerStatus=PRODUCTS.map(p=>`${p.label}: accepted ISA/GSD owner reader unavailable; daily work held`).concat(
      ['KPI owner readers unavailable on this serving host; recorded graph evidence is not a measured cohort']);
    return reader;
  }
  if (source.schema !== 'cambium.department-sources.v1' || source.tenantId !== 'cambium'
    || source.headDigest !== graph.head.graphDigest || source.observedAt !== graph.servedAt || source.executionGranted !== false
    || !Array.isArray(source.gsd) || source.gsd.length !== PRODUCTS.length
    || !Array.isArray(source.kpis) || source.kpis.length !== KPI_DEFINITIONS.length) throw new Error('Department owner readback is unconfirmed');
  const refs: string[] = [], tasks: string[] = [];
  const products = new Set<string>();
  for (const row of source.gsd) {
    if (!PRODUCTS.some(p=>p.id===row.productId) || products.has(row.productId) || !['available','held','unavailable'].includes(row.state)
      || typeof row.reason !== 'string' || !Array.isArray(row.taskIds) || row.taskIds.some(id=>typeof id!=='string')
      || new Set(row.taskIds).size !== row.taskIds.length || row.taskIds.length>512) throw new Error('Invalid GSD owner projection');
    products.add(row.productId);
    const workObject = PRODUCTS.find(p=>p.id===row.productId)!.workObjectId;
    if (row.taskIds.some(id=>!graph.nodes.some(n=>n.nodeId===id && n.workObjectId===workObject))) throw new Error('GSD projection crosses product scope');
    if (row.state==='available') {
      if (typeof row.sourceRef !== 'string' || !row.sourceRef.trim()) throw new Error('GSD source missing');
      refs.push(row.sourceRef);tasks.push(...row.taskIds);
    } else if(row.taskIds.length) throw new Error('Held GSD projection contains selected tasks');
    reader.readerStatus!.push(`${row.productId}: ${row.state} · ${row.reason}${row.sourceRef ? ' · '+row.sourceRef : ''}`);
  }
  if(refs.length) reader.input.eligibility={sourceRef:refs.join('; '),taskIds:tasks};
  const definitions = new Set<string>();
  for (const row of source.kpis) {
    if (!KPI_DEFINITIONS.some(d=>d.id===row.definitionId) || definitions.has(row.definitionId)
      || !['observed','stale','unavailable'].includes(row.state) || typeof row.reason!=='string'
      || (row.state==='observed' && (!row.observation || row.observation.definitionId!==row.definitionId))
      || (row.state!=='observed' && row.observation!==null)) throw new Error('Invalid KPI owner projection');
    definitions.add(row.definitionId);
    if(row.observation)reader.observations!.push(row.observation);
    reader.readerStatus!.push(`${row.definitionId}: ${row.state} · ${row.reason}`);
  }
  return reader;
}
