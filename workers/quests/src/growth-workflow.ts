/** Bounded organization drafting capability. D1 owns requests; native execution owns outcomes. */
import type { D1DatabaseLike } from './index.ts';
export const GROWTH_REFS = [
  '20-operations/growth/README.md',
  '20-operations/growth/department/execution-map.md',
  '20-operations/growth/department/organ-map.md',
  '20-operations/growth/department/workflows.md',
] as const;
export const GROWTH_ROLES = ['ceo','scientist','engineer','designer','synthesist','hermes'] as const;
export type GrowthRole = typeof GROWTH_ROLES[number];
export interface GrowthInput {
  schema: 'thoughtseed.growth.request.v1'; requestId: string; tenantId: string; memberId: string;
  scope: 'org-growth'; role: GrowthRole; objective: string; contextRefs: string[];
  contextProjectionDigest: string; contextSourceCommit: string; externalAction: 'none';
}
export interface GrowthResult {
  schema: 'thoughtseed.growth.result.v1'; requestId: string; role: GrowthRole; content: string;
  sources: Array<{path: string; digest: string}>; approvalState: 'draft'; externalAction: 'none';
}
export interface GrowthRecord {
  id: string; input: GrowthInput; contextSources: Array<{path:string;digest:string}>; intentDigest: string; runnerMemberId: string; directiveId: string;
  status: 'queued'|'running'|'retrying'|'failed'|'draft_ready'; result: GrowthResult|null;
  createdAt: string; updatedAt: string;
}
export interface GrowthStore {
  create(record: GrowthRecord, limits?: {maxPending:number;maxDaily:number}): Promise<'created'|'duplicate'|'conflict'|'busy'>;
  get(id: string): Promise<GrowthRecord|null>;
  update(id: string, status: GrowthRecord['status'], result: GrowthResult|null, at: string): Promise<void>;
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const keys = (x: Record<string,unknown>, allowed: string[]) => Object.keys(x).every(k=>allowed.includes(k)) && allowed.every(k=>k in x);
const safe = (x: unknown) => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const digest = (x: unknown) => typeof x === 'string' && /^sha256:[a-f0-9]{64}$/.test(x);
export function parseGrowthRequest(x: unknown): Pick<GrowthInput,'requestId'|'scope'|'role'|'objective'|'contextRefs'>|null {
  if (!record(x) || !keys(x,['requestId','scope','role','objective','contextRefs']) || !safe(x.requestId)
    || x.scope !== 'org-growth' || !GROWTH_ROLES.includes(x.role as GrowthRole)
    || typeof x.objective !== 'string' || !x.objective.trim() || x.objective.length>4000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x.objective)
    || !Array.isArray(x.contextRefs) || !x.contextRefs.length || x.contextRefs.length>4
    || new Set(x.contextRefs).size !== x.contextRefs.length
    || !x.contextRefs.every(p=>GROWTH_REFS.includes(p as typeof GROWTH_REFS[number]))) return null;
  return x as unknown as Pick<GrowthInput,'requestId'|'scope'|'role'|'objective'|'contextRefs'>;
}
export function parseGrowthInput(x: unknown): GrowthInput|null {
  if (!record(x) || !keys(x,['schema','requestId','tenantId','memberId','scope','role','objective','contextRefs','contextProjectionDigest','contextSourceCommit','externalAction'])) return null;
  const {schema,tenantId,memberId,contextProjectionDigest,contextSourceCommit,externalAction,...request} = x;
  if (schema !== 'thoughtseed.growth.request.v1' || externalAction !== 'none' || !safe(tenantId) || !safe(memberId)
    || !digest(contextProjectionDigest) || typeof contextSourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(contextSourceCommit) || !parseGrowthRequest(request)) return null;
  return x as unknown as GrowthInput;
}
export function parseGrowthResult(x: unknown): GrowthResult|null {
  if (!record(x) || !keys(x,['schema','requestId','role','content','sources','approvalState','externalAction'])
    || x.schema !== 'thoughtseed.growth.result.v1' || !safe(x.requestId) || !GROWTH_ROLES.includes(x.role as GrowthRole)
    || typeof x.content !== 'string' || !x.content.trim() || x.content.length>16000
    || x.approvalState !== 'draft' || x.externalAction !== 'none' || !Array.isArray(x.sources)
    || !x.sources.length || x.sources.length>4 || new Set(x.sources.map(s=>record(s)?s.path:null)).size!==x.sources.length
    || !x.sources.every(s=>record(s) && keys(s,['path','digest']) && GROWTH_REFS.includes(s.path as typeof GROWTH_REFS[number]) && digest(s.digest))) return null;
  return x as unknown as GrowthResult;
}
export function parseGrowthPolicy(tenants: string|undefined, runnerMemberId: string|undefined, pending?: string, daily?: string): {tenantIds:string[];runnerMemberId:string;maxPending:number;maxDaily:number}|undefined {
  try { const ids: unknown = JSON.parse(tenants??'null');
    if (!Array.isArray(ids) || !ids.length || ids.length>100 || !ids.every(safe) || !safe(runnerMemberId)) return undefined;
    const maxPending = pending === undefined ? 10 : Number(pending);
    const maxDaily = daily === undefined ? 50 : Number(daily);
    if (!Number.isSafeInteger(maxPending) || maxPending<1 || maxPending>10 || !Number.isSafeInteger(maxDaily) || maxDaily<1 || maxDaily>50) return undefined;
    return {tenantIds:ids, runnerMemberId:runnerMemberId!,maxPending,maxDaily};
  } catch { return undefined; }
}
export function d1GrowthStore(db: D1DatabaseLike): GrowthStore {
  const get = async(id:string):Promise<GrowthRecord|null> => {
    const row = await db.prepare('SELECT record_json, status, result_json, updated_at FROM bridge_growth_requests WHERE id = ?').bind(id).first<{record_json:string;status:GrowthRecord['status'];result_json:string|null;updated_at:string}>();
    if (!row) return null;
    const task: GrowthRecord = {...JSON.parse(row.record_json),status:row.status,result:row.result_json?JSON.parse(row.result_json):null,updatedAt:row.updated_at};
    // Task status/result are a projection. The existing fenced execution row remains
    // authoritative even if the process stopped between outcome commit and projection update.
    const execution = await db.prepare('SELECT idempotency_key, input_digest, outcome_status, terminal, attestation_json, outcome_recorded_at FROM bridge_executions WHERE member_id = ? AND directive_id = ?')
      .bind(task.runnerMemberId,task.directiveId).first<{idempotency_key:string;input_digest:string;outcome_status:string|null;terminal:number;attestation_json:string|null;outcome_recorded_at:string|null}>();
    if (execution && execution.idempotency_key === task.id && execution.input_digest === task.intentDigest) {
      if (execution.terminal === 1 && execution.outcome_status === 'executed' && execution.attestation_json) {
        const attestation = JSON.parse(execution.attestation_json);
        const result = parseGrowthResult(attestation.growthResult);
        if (attestation.command === 'growth.request.draft' && attestation.inputDigest === task.intentDigest
          && result && result.requestId === task.input.requestId && result.role === task.input.role) {
          task.status = 'draft_ready'; task.result = result;
          task.updatedAt = execution.outcome_recorded_at ?? task.updatedAt;
        }
      } else if (execution.terminal === 1 && execution.outcome_status === 'failed') {
        task.status = 'failed'; task.result = null; task.updatedAt = execution.outcome_recorded_at ?? task.updatedAt;
      } else if (execution.outcome_status === 'retryable') {
        task.status = 'retrying'; task.updatedAt = execution.outcome_recorded_at ?? task.updatedAt;
      }
    }
    return task;
  };
  return {get,
    async create(r, limits={maxPending:10,maxDaily:50}) {
      const inserted = await db.prepare(`
        INSERT OR IGNORE INTO bridge_growth_requests
          (id, tenant_id, member_id, request_id, intent_digest, record_json, status, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE (
          SELECT COUNT(*) FROM bridge_growth_requests g
          WHERE tenant_id = ? AND member_id = ? AND status IN ('queued','running','retrying')
            AND NOT EXISTS (
              SELECT 1 FROM bridge_executions e
              WHERE e.member_id = json_extract(g.record_json,'$.runnerMemberId')
                AND e.directive_id = json_extract(g.record_json,'$.directiveId')
                AND e.idempotency_key = g.id AND e.input_digest = g.intent_digest AND e.terminal = 1
            )
        ) < ?
        AND (SELECT COUNT(*) FROM bridge_growth_requests WHERE tenant_id = ? AND member_id = ? AND created_at >= ?) < ?
      `)
        .bind(r.id,r.input.tenantId,r.input.memberId,r.input.requestId,r.intentDigest,JSON.stringify(r),r.status,r.createdAt,r.updatedAt,r.input.tenantId,r.input.memberId,limits.maxPending,r.input.tenantId,r.input.memberId,`${r.createdAt.slice(0,10)}T00:00:00.000Z`,limits.maxDaily).run();
      const stored=await get(r.id);
      if (!stored) return 'busy';
      if (stored.intentDigest!==r.intentDigest) return 'conflict';
      return inserted.meta?.changes === 1 ? 'created' : 'duplicate';
    },
    async update(id,status,result,at) {
      await db.prepare(`UPDATE bridge_growth_requests SET status = ?, result_json = COALESCE(?, result_json), updated_at = ? WHERE id = ? AND (status NOT IN ('draft_ready','failed') OR status = ?)`)
        .bind(status,result?JSON.stringify(result):null,at,id,status).run();
    },
  };
}
