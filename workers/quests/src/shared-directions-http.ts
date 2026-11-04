import type { HandlerDeps, SimpleRequest, SimpleResponse } from './handler.ts';
import { resolveComposedNativeSession } from './native-session-composition.ts';
import { validateDirectionDraft, type SharedDirection } from './shared-directions.ts';
import { isOperationalWorkSource } from './operational-work-intake.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
const reply = (status: number, body: unknown): SimpleResponse => ({status, headers, body: JSON.stringify(body)});
const fail = (status: number, error: string) => reply(status, {error});
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Drafts only. A saved direction is never an approval, admission or launch. */
export async function sharedDirectionsHttp(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const match = /^\/v1\/directions\/([a-z][a-z0-9-]{1,63})(?:\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127}))?$/.exec(req.path);
  if (!match) return fail(400,'invalid_request');
  if (['cookie','x-api-key','x-auth-token','x-access-token','proxy-authorization'].some(key => (req.headers[key] ?? '').trim())) return fail(400,'mixed_credentials');
  const resolved = await resolveComposedNativeSession(req,deps.nativeSessionHost);
  if (resolved.kind === 'refused') return 'status' in resolved ? fail(resolved.status, resolved.error) : fail(resolved.response.status, 'native_session_unavailable');
  if (resolved.kind !== 'native') return fail(401, 'native_session_required');
  if (resolved.scope.tenantId !== match[1]) return fail(403,'tenant_mismatch');
  const scope = {tenantId:resolved.scope.tenantId,principal:resolved.scope.founderId};
  const store = deps.sharedDirectionStore;
  if (!store) return fail(503,'direction_store_unavailable');
  try {
    if (req.method === 'GET') {
      if (!match[2]) {
        let workContext: {workObjectId:string;workNodeId:string;graphHeadDigest:string}|null=null;
        if(deps.goalGraphStore) {
          const graph=deps.goalGraphStore;
          const head=await graph.readHead(scope.tenantId);const nodes=await graph.readNodes(scope.tenantId);const again=await graph.readHead(scope.tenantId);
          if(head&&again&&head.graphDigest===again.graphDigest&&head.graphVersion===again.graphVersion
              &&makeGoalGraphHead(scope.tenantId,nodes,head.graphVersion,head.committedAt).graphDigest===head.graphDigest) {
            const sources=nodes.filter(node=>isOperationalWorkSource(node)&&node.status!=='retired');
            if(sources.length===1)workContext={workObjectId:'sapling:cambium',workNodeId:sources[0].nodeId,graphHeadDigest:head.graphDigest};
          }
        }
        return reply(200,{schema:'cambium.direction-list.v1',...scope,directions:await store.list(scope,null),workContext});
      }
      const direction=await store.read(scope,match[2]);
      return direction ? reply(200,{schema:'cambium.direction-result.v1',...scope,direction,replayed:false}) : fail(404,'direction_not_found');
    }
    const update=req.method==='PUT' && !!match[2];
    if (!update && !(req.method==='POST' && !match[2])) return fail(405,'method_not_allowed');
    if (!req.body || new TextEncoder().encode(req.body).length>65536) return fail(400,'invalid_request');
    let raw:unknown;try {raw=JSON.parse(req.body);}catch{return fail(400,'invalid_request');}
    const keys=['schema','operationId','draft',...(update?['expectedRevision']:[])];
    if (!object(raw) || Object.keys(raw).length!==keys.length || !keys.every(key=>Object.hasOwn(raw,key))
        || raw.schema!==(update?'cambium.direction-update.v1':'cambium.direction-create.v1')
        || typeof raw.operationId!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(raw.operationId)
        || !validateDirectionDraft(raw.draft) || (update && (!Number.isSafeInteger(raw.expectedRevision)||raw.expectedRevision<1))) return fail(400,'invalid_request');
    const draft=raw.draft;
    const canonical=JSON.stringify({method:req.method,target:match[2]??null,schema:raw.schema,operationId:raw.operationId,
      expectedRevision:update?raw.expectedRevision:0,draft:{title:draft.title,body:draft.body,workObjectId:draft.workObjectId,workNodeId:draft.workNodeId,graphHeadDigest:draft.graphHeadDigest,signalPins:draft.signalPins.map(pin=>({id:pin.id,revision:pin.revision}))}});
    const receipt=await store.receipt(scope,raw.operationId);
    if(receipt) return receipt.request===canonical ? reply(200,{schema:'cambium.direction-result.v1',...scope,direction:JSON.parse(receipt.result),replayed:true}):fail(409,'operation_conflict');
    const graph=deps.goalGraphStore;const signals=deps.sharedSignalStore;
    if(!graph || !signals)return fail(503,'direction_sources_unavailable');
    const head=await graph.readHead(scope.tenantId);const nodes=await graph.readNodes(scope.tenantId);const again=await graph.readHead(scope.tenantId);
    if(!head || !again || head.graphDigest!==again.graphDigest || head.graphVersion!==again.graphVersion
        || makeGoalGraphHead(scope.tenantId,nodes,head.graphVersion,head.committedAt).graphDigest!==head.graphDigest)return fail(503,'graph_read_unconfirmed');
    if(head.graphDigest!==draft.graphHeadDigest)return fail(409,'graph_changed');
    const work=nodes.find(node=>node.nodeId===draft.workNodeId);
    if(!work || !isOperationalWorkSource(work) || work.status==='retired' || work.workObjectId!==draft.workObjectId)return fail(409,'work_join_required');
    for(const pin of draft.signalPins) {
      const signal=await signals.read(scope,pin.id);
      if(!signal)return fail(404,'signal_not_found');
      if(signal.revision!==pin.revision)return fail(409,'signal_changed');
      if(!signal.projectIds.includes(draft.workObjectId))return fail(409,'signal_project_mismatch');
    }
    const current=update?await store.read(scope,match[2]!):null;
    if(update&&!current)return fail(404,'direction_not_found');
    if(current&&current.revision!==raw.expectedRevision)return fail(409,'revision_conflict');
    const now=(deps.now??(()=>new Date().toISOString()))();
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(now)||Number.isNaN(Date.parse(now))||new Date(now).toISOString()!==now)return fail(503,'clock_unavailable');
    const direction:SharedDirection={...draft,id:current?.id??crypto.randomUUID(),...scope,revision:(current?.revision??0)+1,createdAt:current?.createdAt??now,updatedAt:now};
    const reverified=await resolveComposedNativeSession(req,deps.nativeSessionHost);
    if(reverified.kind!=='native'||reverified.tokenDigest!==resolved.tokenDigest||reverified.scope.founderId!==scope.principal||reverified.scope.tenantId!==scope.tenantId||reverified.scope.clientId!==resolved.scope.clientId)return fail(403,'authorization_changed');
    const result=await store.write(scope,raw.operationId,canonical,direction,current?.revision??0);
    if(result==='operation_conflict'||result==='revision_conflict')return fail(409,result);
    if(result==='replay'){
      const saved=await store.receipt(scope,raw.operationId);
      if(!saved||saved.request!==canonical)return fail(409,'operation_conflict');
      return reply(200,{schema:'cambium.direction-result.v1',...scope,direction:JSON.parse(saved.result),replayed:true});
    }
    return reply(update?200:201,{schema:'cambium.direction-result.v1',...scope,direction,replayed:false});
  }catch{return fail(503,'direction_store_unavailable');}
}
