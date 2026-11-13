// Local browser fixture for the EXISTING founder session/read/proposal seam.
// Every identity is synthetic. This server has no credential, D1 or action owner.
import {createHash} from 'node:crypto';
import {reviewConfirmation} from '../bin/founder-gate.mjs';
export const FIELD_ATLAS_FIXTURE_DIGEST='6'.repeat(64);
// The existing bridge displays these proposal fields and the COMPLETE nested
// review. The duplicate top-level tenantId is validated by the bridge and is
// not part of its display projection; review.tenantId remains included.
export function fieldAtlasDisplayedReview(p){
  return {proposalId:p.proposalId,version:p.version,changeDigest:p.changeDigest,nonce:p.nonce,expiresAt:p.expiresAt,summary:p.summary,review:p.review};
}
export function fieldAtlasReviewFingerprint(value){
  const canonical=item=>Array.isArray(item) ? '['+item.map(canonical).join(',')+']' : item && typeof item==='object'
    ? '{'+Object.keys(item).sort().map(key=>JSON.stringify(key)+':'+canonical(item[key])).join(',')+'}' : JSON.stringify(item);
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function createFieldAtlasFounderFixture({now:fixedNow}={}){
  let selected=null,counters={};
  const fixtures=new Map();
  const json=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  return {
    select(name){
      counters={envelopeReads:0,proposalReads:0,graphReads:0,sessionReads:0,decisionPosts:0,renewalPosts:0,unexpectedRequests:0};
      if(!name){selected=null;return;}
      if(!['empty','pending'].includes(name))throw new Error('Unknown local founder fixture');
      if(fixtures.has(name)){selected=fixtures.get(name);return;}
      const now=fixedNow ?? Date.now(),time=new Date(now).toISOString(),digest=FIELD_ATLAS_FIXTURE_DIGEST,expires=new Date(now+1_800_000).toISOString();
      const admission=[['executionAdmissionClusterId','cluster:viewport-fixture'],['executionAdmissionDirectiveId','directive:viewport-fixture'],['executionAdmissionDispatchDigest','sha256:'+'7'.repeat(64)],['executionAdmissionIdempotencyKey','directive:viewport-fixture'],['executionAdmissionMemberId','fixture-member'],['executionAdmissionSchema','cambium.goal-graph.execution-admission.v1']].map(([key,value])=>({key,value}));
      const row={schema:'cambium.goal-graph-gate-row.v1',kind:'goal-graph-intake',id:'goal-graph-intake:'+digest,tenantId:'cambium',status:'pending',changeDigest:digest,nodeId:'goal_viewport_fixture',
        proposalId:'cambium:'+digest,version:1,title:'Goal proposal · Fitcheck source verification',summary:'Synthetic local source review only',source:'telegram-goal-graph-intake@v1',sourceRef:'synthetic:viewport-fitcheck',
        consequence:'A real signature would commit this proposal; this local fixture cannot write a graph or execute work.',reversibility:'Cancel before a signature; no decision is submitted by this proof.',receivedAt:time,
        approvalNonce:'goal-graph-approval:cambium:'+digest,approvalExpiresAt:expires,expectedHeadVersion:4,fence:5,
        desiredState:'Verify the synthetic Fitcheck source slice',scope:'meso',
        founderInspect:{schema:'cambium.goal-graph-founder-inspect.v1',changeDigest:digest,nodeId:'goal_viewport_fixture',workObjectId:'branch:fitcheck',workObjectKind:'branch',pinnedLoadoutId:'loadout:viewport-fixture',executionAdmission:admission,admissionState:'exact',consistent:true,issues:[]}};
      const review={...row,graphVersion:5,fence:5,expectedHeadVersion:4,changeSet:{tenantId:'cambium',changeDigest:digest,graphVersion:5,nodesToCreate:[{id:row.nodeId,title:'Verify synthetic Fitcheck source',description:'Browser fixture only; no graph or execution owner.'}],nodesToUpdate:[],nodesToRemove:[]}};
      const proposal={proposalId:row.proposalId,tenantId:'cambium',version:1,changeDigest:digest,nonce:row.approvalNonce,expiresAt:expires,summary:`${row.summary} Consequence: ${row.consequence} Reversibility: ${row.reversibility}`,review};
      const full={status:'review',writerAuthority:false,proposal,approveConfirmation:reviewConfirmation(proposal,'approved'),rejectConfirmation:reviewConfirmation(proposal,'rejected')};
      const envelope={schema:1,tenant:'cambium',derivedAt:time,ledger:{rows:[]},goalGraphIntake:{schema:'cambium.goal-graph-gate-row-list.v1',ok:true,tenantId:'cambium',count:name==='empty'?0:1,rows:name==='empty'?[]:[row]}};
      selected={name,time,envelope,full,digest:createHash('sha256').update(JSON.stringify({envelope,full})).digest('hex')};
      fixtures.set(name,selected);
    },
    snapshot(){return selected ? {name:selected.name,observedAt:selected.time,inputSha256:selected.digest,reviewSha256:fieldAtlasReviewFingerprint(fieldAtlasDisplayedReview(selected.full.proposal)),authority:'synthetic-local-founder-read-fixture',...counters,
      methodCounts:{envelopeGET:counters.envelopeReads,sessionGET:counters.sessionReads,graphGET:counters.graphReads,proposalPOST:counters.proposalReads,deniedDecisionPOST:counters.decisionPosts,deniedRenewalPOST:counters.renewalPosts}} : null;},
    handle(req,res,url){
      if(!selected)return false;
      const reject=(status=405)=>{counters.unexpectedRequests++;json(res,status,{error:'Unexpected local fixture method, identity or route'});return true;};
      if(url.pathname.startsWith('/founder/api/quests/')){
        if(url.pathname!=='/founder/api/quests/cambium' || url.search)return reject(404);
        if(req.method!=='GET')return reject();
        counters.envelopeReads++;json(res,200,selected.envelope);return true;
      }
      if(['/v1/founder/session','/v1/founder/graph','/v1/founder/proposal'].includes(url.pathname)){
        if(url.search || req.headers['x-cambium-founder-web']!=='1')return reject(403);
        if(req.method!==(url.pathname.endsWith('/proposal')?'POST':'GET'))return reject();
      }
      if(url.pathname==='/v1/founder/session'){counters.sessionReads++;json(res,200,{founderId:'founder:viewport-fixture',enrolled:true,canonicalReady:true,tenantIds:['cambium'],writerAuthority:false});return true;}
      if(url.pathname==='/v1/founder/graph'){counters.graphReads++;json(res,200,{schema:'cambium.founder.bookkeeping-graph.v1',origin:'d1',tenantId:'cambium',canonicalReadback:true,writerAuthority:false,executionGranted:false,head:{graphVersion:4,graphDigest:'5'.repeat(64)},rootId:'synthetic-viewport-root',nodes:[],edges:[],decisions:[],servedAt:selected.time});return true;}
      if(url.pathname==='/v1/founder/proposal'){
        if(!String(req.headers['content-type'] || '').startsWith('application/json'))return reject(415);
        counters.proposalReads++;let bytes='';req.on('data',chunk=>{bytes+=String(chunk);if(bytes.length>64_000)req.destroy();});req.on('end',()=>{
          try{const body=JSON.parse(bytes);if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).join(',')!=='proposalId' || body.proposalId!==selected.full.proposal.proposalId)throw new Error('Unknown fixture proposal');json(res,200,selected.full);}
          catch{counters.unexpectedRequests++;json(res,400,{error:'invalid local fixture request'});}
        });return true;
      }
      if(url.pathname==='/v1/founder/decision' && req.method==='POST')counters.decisionPosts++;
      else if(url.pathname==='/v1/founder/renew' && req.method==='POST')counters.renewalPosts++;
      else if(url.pathname==='/v1/founder/decision' || url.pathname==='/v1/founder/renew')return reject();
      else if(url.pathname.startsWith('/v1/founder/'))return reject(404);
      else return false;
      json(res,403,{error:'Local viewport fixture has no decision or renewal writer'});return true;
    }
  };
}
export function fieldAtlasFixtureInputDigest(name,observedAt){
  const now=Date.parse(observedAt);if(!Number.isFinite(now))throw new Error('Fixture time is invalid');
  const fixture=createFieldAtlasFounderFixture({now});fixture.select(name);return fixture.snapshot().inputSha256;
}
export function fieldAtlasFixtureReviewDigest(name,observedAt){
  const now=Date.parse(observedAt);if(!Number.isFinite(now))throw new Error('Fixture time is invalid');
  const fixture=createFieldAtlasFounderFixture({now});fixture.select(name);return fixture.snapshot().reviewSha256;
}
