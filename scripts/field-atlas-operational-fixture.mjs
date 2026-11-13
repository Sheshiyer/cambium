// Passive, loopback-only synthetic ActionRequest owner for source proof.
// No fetch, credential, signature, persistence or real queue owner exists here.
import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const AUTHORITY='synthetic-loopback-operational-fixture';
const INIT_DATA='synthetic-viewport-fixture-only';
export function createFieldAtlasOperationalFixture({now=Date.now}={}){
  const clock=()=>typeof now==='function' ? now() : now;
  const createdAt=clock();
  if(!Number.isSafeInteger(createdAt))throw new Error('Invalid synthetic fixture clock');
  const request={schema:'thoughtseed.action-request.v1',tenantId:'cambium',id:'ar_viewport_foundation',selectedOptionId:'draft-follow-up',status:'needs_signed_confirmation'};
  const payload={kind:'confirm-action-request',subject:request.id,actionRequestId:request.id,optionId:request.selectedOptionId,
    idempotencyKey:`confirm-action-request:cambium:${request.id}:${request.selectedOptionId}`,initData:INIT_DATA,
    evidence:'synthetic:viewport-foundation',consequence:'Synthetic local queue response only',reversibility:'No real action or queue exists'};
  // Version/digest/freshness bind this fixture input envelope, not new fields
  // in the real owner's confirmation payload or an invented backend fence.
  const ownerRead=Object.freeze({schema:'cambium.viewport-operational-owner-read.v1',authority:AUTHORITY,
    tenantId:request.tenantId,requestId:request.id,optionId:request.selectedOptionId,version:1,digest:hash(request),
    observedAt:new Date(createdAt).toISOString(),expiresAt:new Date(createdAt+1_800_000).toISOString()});
  let origin=null,selected=false,attempted=false,settled=false,pending=null;
  let counters={requests:0,gatePosts:0,acceptedPosts:0,deniedRequests:0,duplicatePosts:0};
  const json=(res,status,value)=>{if(res.destroyed)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  function reject(res,status,reason){counters.deniedRequests++;json(res,status,{error:reason,authority:AUTHORITY});return true;}
  return {
    bind(base){
      const url=new URL(base);
      if(url.protocol!=='http:' || url.hostname!=='127.0.0.1' || !url.port || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error('Operational fixture requires an exact HTTP loopback origin');
      if(origin && origin!==url.origin)throw new Error('Operational fixture cannot change its bound origin');
      origin=url.origin;
    },
    ownerRead:()=>({...ownerRead}),
    requestBody:()=>({...payload}),
    select(name,read=ownerRead){
      selected=false;
      if(pending)throw new Error('Operational fixture has an unsettled response');
      // Selection resets observations, never the synthetic request's submit
      // latch. Refresh/reselection cannot turn an uncertain or queued request
      // into another accepted POST; a new test case gets a new fixture object.
      counters={requests:0,gatePosts:0,acceptedPosts:0,deniedRequests:0,duplicatePosts:0};
      if(name===null || name===undefined)return;
      if(name!=='action-request-pending')throw new Error('Unknown operational fixture capability');
      if(!read || JSON.stringify(Object.keys(read).sort())!==JSON.stringify(Object.keys(ownerRead).sort()) || Object.keys(ownerRead).some(key=>read[key]!==ownerRead[key]))throw new Error('Operational owner identity/version/digest/freshness conflict');
      if(clock()<Date.parse(read.observedAt) || clock()>=Date.parse(read.expiresAt))throw new Error('Operational owner read is stale or expired');
      selected=true;
    },
    snapshot:()=>({authority:AUTHORITY,selected,ownerRead:{...ownerRead},inputSha256:hash({ownerRead,payload}),...counters,
      state:pending?'request-sent':!selected?'held':settled?'queued':'needs_signed_confirmation',pendingResponses:pending?1:0,realOwnerWrites:0}),
    handle(req,res,url){
      if(!url.pathname.startsWith('/api/gate') && !url.pathname.startsWith('/founder/api/gate'))return false;
      counters.requests++;
      if(req.method==='POST')counters.gatePosts++;
      if(!origin || url.origin!==origin || req.headers.host!==new URL(origin).host || !['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))return reject(res,403,'Non-loopback or foreign target refused');
      if(!selected)return reject(res,403,'No operational fixture capability selected');
      if(url.pathname!=='/api/gate/cambium' || url.search || url.hash)return reject(res,404,'Unknown operational owner route');
      if(req.method!=='POST')return reject(res,405,'Operational owner requires POST');
      if(req.headers['content-type']!=='application/json')return reject(res,415,'Operational owner requires JSON');
      if(clock()<Date.parse(ownerRead.observedAt) || clock()>=Date.parse(ownerRead.expiresAt))return reject(res,409,'Operational owner read is stale or expired');
      let bytes='';let stopped=false;
      req.on('data',chunk=>{if(stopped)return;bytes+=String(chunk);if(Buffer.byteLength(bytes)>16_000){stopped=true;reject(res,413,'Operational body too large');req.resume();}});
      req.on('end',()=>{
        if(stopped)return;
        let body;try{body=JSON.parse(bytes);}catch{return reject(res,400,'Invalid operational JSON');}
        if(!body || Array.isArray(body) || JSON.stringify(Object.keys(body).sort())!==JSON.stringify(Object.keys(payload).sort()) || Object.keys(payload).some(key=>body[key]!==payload[key]))return reject(res,409,'Operational kind/subject/request/option/idempotency conflict');
        if(attempted){counters.duplicatePosts++;return reject(res,409,'Duplicate confirmation refused; read original status');}
        attempted=true;counters.acceptedPosts++;pending=res;
        res.once('close',()=>{if(pending===res){pending=null;selected=false;}});
      });
      return true;
    },
    release(){
      if(!pending)return false;
      const res=pending;pending=null;settled=true;
      json(res,200,{ok:true,queued:request.id,duplicate:false,kind:payload.kind,subject:request.id,idempotencyKey:payload.idempotencyKey,
        consequence:payload.consequence,reversibility:payload.reversibility,actionRequest:{...request,status:'queued'},authority:AUTHORITY,realOwnerWrites:0});return true;
    },
    close(){if(pending){const res=pending;pending=null;selected=false;json(res,503,{error:'Synthetic response cancelled',authority:AUTHORITY});}}
  };
}
