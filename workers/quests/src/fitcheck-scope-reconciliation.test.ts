import test from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import POLICY from '../../../docs/project-management/fitcheck-scope-reconciliation.v1.json' with { type: 'json' };
import { FITCHECK_SCOPE_SCHEMA, compileFitcheckScope, parseFitcheckScopeBoundary, fitcheckScopeTaskMatches, fitcheckReferencesClear } from './fitcheck-scope-reconciliation.ts';
import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from './goal-graph-loadout-registry.ts';
import { handle } from './handler.ts';
const NOW='2026-11-04T12:00:00.000Z';
function fixture() {
 const removed=structuredClone(POLICY.removedNode) as any, retained=structuredClone(POLICY.retainedNode) as any;
 const root={...retained,nodeId:retained.parentNodeId,namespace:'root',externalId:'root',parentNodeId:null,scope:'macro',workObjectId:null,workObjectKind:null,pinnedLoadoutId:null};
 const nodes=[root,retained,removed],head=makeGoalGraphHead('cambium',nodes,18,NOW);
 const context={currentNodes:nodes,actualHead:head,loadoutAuthority:GOAL_GRAPH_LOADOUT_AUTHORITY,now:NOW};
 const compiled=compileFitcheckScope(context,head.graphDigest);assert.equal(compiled.compile.status,'compiled');if(compiled.compile.status!=='compiled')throw Error('fixture');
 const raw={schema:FITCHECK_SCOPE_SCHEMA,version:1,tenantId:'cambium',expectedHeadDigest:head.graphDigest,changeDigest:compiled.compile.changeSet.changeDigest};
 const entries=new Map<string,string>();let commits=0,clear=true;
 const deps:any={kv:{get:async(k:string)=>entries.get(k)??null,put:async(k:string,v:string)=>{entries.set(k,v)},list:async(p:string)=>[...entries.keys()].filter(k=>k.startsWith(p))},bridgeToken:'admin-fixture',assignmentToken:'assignment-fixture',now:()=>NOW,fitcheckReferenceReadback:async()=>clear,goalGraphStore:{readHead:async()=>head,readNodes:async()=>nodes,commit:async()=>{commits++;throw Error('commit forbidden')}}};
 const submit=(body:unknown=raw,token='admin-fixture')=>handle({method:'POST',path:'/v1/bridge/goal-graph-intake',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)},deps);
 return{removed,retained,context,compiled,raw,entries,deps,submit,commits:()=>commits,setClear(v:boolean){clear=v}};
}
test('Fitcheck canonical intake is closed, admin-only and pending-only with stable replay',async()=>{
 const h=fixture();assert.equal(parseFitcheckScopeBoundary({...h.raw,changeSet:{}}).accepted,false);
 assert.equal((await h.submit(h.raw,'wrong')).status,401);
 assert.equal((await h.submit(h.raw,'assignment-fixture')).status,403);
 const r=await h.submit();assert.equal(r.status,200,r.body);const receipt=JSON.parse(r.body);assert.equal(receipt.accepted,true);
 const key=`goal-graph-intake-task:cambium:${h.raw.changeDigest}`;const task=JSON.parse(h.entries.get(key)!);
 assert.equal(task.status,'pending');assert.equal(task.changeSet.nodesToCreate.length,1);assert.equal(task.changeSet.nodesToRemove.length,1);assert.equal(task.changeSet.nodesToUpdate.length,0);
 assert.equal(task.node.reviewAt,null);assert.equal(task.node.status,'blocked');assert.equal(task.node.metadata.preflightSha256,undefined);assert.ok(task.node.metadata.identityReconciliation.historicalPreflightSha256);
 const expiry=task.approvalExpiresAt;assert.equal((await h.submit()).status,200);assert.equal(JSON.parse(h.entries.get(key)!).approvalExpiresAt,expiry);assert.equal(h.commits(),0);
 assert.equal(fitcheckScopeTaskMatches(task,h.context),true);
 task.changeSet.nodesToCreate[0].reviewAt='2026-11-05T00:00:00.000Z';assert.equal(fitcheckScopeTaskMatches(task,h.context),false);
});
test('Fitcheck sources, head and live reference fences cannot be bypassed',async()=>{
 const h=fixture();h.setClear(false);assert.equal((await h.submit()).status,503);assert.equal(h.entries.size,0);h.setClear(true);
 assert.equal(JSON.parse((await h.submit({...h.raw,changeDigest:'a'.repeat(64)})).body).accepted,false);
 assert.equal((await h.submit({...h.raw,expectedHeadDigest:'b'.repeat(64)})).status,409);
 h.context.currentNodes[2].status='active';assert.throws(()=>compileFitcheckScope(h.context,h.context.actualHead.graphDigest));assert.equal(h.commits(),0);
});
test('reference readback fails closed on positive references, unavailable reads and absent rows',async()=>{
 const db=(v:any)=>({prepare:()=>({bind:()=>({first:async()=>v})})});
 assert.equal(await fitcheckReferencesClear(db({refs:0})),true);assert.equal(await fitcheckReferencesClear(db({refs:1})),false);assert.equal(await fitcheckReferencesClear(db(null)),false);
 assert.equal(await fitcheckReferencesClear({prepare(){throw Error('unavailable')}}),false);
});

const FOUNDER_HOST = 'curious.example.test';
const founderKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const founderJwk = founderKeys.publicKey.export({ format: 'jwk' });
function founderJwt(): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = part({ alg: 'RS256', kid: 'fitcheck-founder-test', typ: 'JWT' });
  const payload = part({
    iss: 'https://founder-fitcheck.cloudflareaccess.com',
    aud: 'a'.repeat(64),
    email: 'founder@thoughtseed.space',
    exp: Math.floor(Date.now() / 1000) + 600,
  });
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(founderKeys.privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}
function founderFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...founderJwk, kid: 'fitcheck-founder-test' }] }), { status: 200 });
    }
    if (url.includes('/v1/whoami')) {
      return new Response(JSON.stringify({ email: 'founder@thoughtseed.space', role: 'admin', isActive: true, identityId: 'pid_founder_web' }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}
const LEDGER = JSON.stringify({
  schema: 1, derivedAt: NOW, source: 'push', tenant: 'cambium',
  ledger: { completed: 0, total: 1, current: { arc: 'I', title: 'Held' }, rows: [] },
});

test('Fitcheck intake stays on the admin bridge and off public quest projections', async () => {
  const h = fixture();
  h.deps.plexus = { teamDomain: 'founder-fitcheck.cloudflareaccess.com', aud: 'a'.repeat(64), whoamiUrl: 'https://plexus.example.test/v1/whoami' };
  h.deps.plexusFetchImpl = founderFetch();
  h.deps.founderGateBindingsJson = JSON.stringify([{ founderId: 'access:pid_founder_web', tenantId: 'cambium' }]);
  const headers = {
    host: FOUNDER_HOST,
    origin: `https://${FOUNDER_HOST}`,
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
    'x-cambium-founder-web': '1',
    'cf-access-jwt-assertion': founderJwt(),
  };
  const founderIntake = await handle({ method: 'POST', path: '/v1/founder/intake', headers, body: JSON.stringify(h.raw) }, h.deps);
  assert.equal(founderIntake.status, 403);
  assert.equal(JSON.parse(founderIntake.body).error, 'canonical_owner_admin_required');
  assert.equal([...h.entries.keys()].some((key: string) => key.startsWith('goal-graph-intake')), false);
  assert.equal(h.commits(), 0);

  assert.equal((await h.submit()).status, 200);
  let taskReads = 0;
  const innerGet = h.deps.kv.get;
  h.deps.kv.get = async (key: string) => {
    if (key.includes(h.raw.changeDigest)) taskReads += 1;
    return innerGet(key);
  };
  await h.deps.kv.put('ledger:cambium', LEDGER);
  const publicDeps = { ...h.deps, plexus: undefined, plexusFetchImpl: undefined };
  const pub = await handle({ method: 'GET', path: '/api/quests/cambium', headers: {}, body: '' }, publicDeps);
  assert.equal(pub.status, 200, pub.body);
  assert.ok(taskReads >= 1, 'public projection reads the pending task before omitting it');
  assert.equal(JSON.parse(pub.body).goalGraphIntake, undefined);
  assert.doesNotMatch(pub.body, /fitcheck-scope-reconciliation|identityChanges|Shopify QA|supervised-launch gate/);

  const page = await handle({ method: 'GET', path: '/', headers: {}, body: '' }, h.deps);
  assert.equal(page.status, 200);
  const marker = 'globalThis.__CAMBIUM_INITIAL_QUEST_ENVELOPE__=';
  const start = page.body.indexOf(marker);
  assert.ok(start >= 0);
  const embedded = JSON.parse(page.body.slice(start + marker.length, page.body.indexOf(';</script>', start)));
  assert.equal(embedded.goalGraphIntake, undefined);
  assert.doesNotMatch(JSON.stringify(embedded), /fitcheck-scope-reconciliation|identityChanges|Shopify QA|supervised-launch gate/);

  const founderRead = await handle({
    method: 'GET', path: '/founder/api/quests/cambium',
    headers: { host: FOUNDER_HOST, 'cf-access-jwt-assertion': founderJwt() }, body: '',
  }, h.deps);
  assert.equal(founderRead.status, 200);
  const row = JSON.parse(founderRead.body).goalGraphIntake.rows[0];
  assert.equal(row.source, 'fitcheck-scope-reconciliation@v1');
  assert.equal(row.executionGranted, false);
  assert.equal(row.identityChanges, undefined);
  assert.equal(h.commits(), 0);
});
