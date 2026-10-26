#!/usr/bin/env node
/** Local Workers runtime smoke only. Synthetic identities, isolated storage, no remote bindings. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import { parseJsonc } from './quests-wrangler-profile.mjs';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const receiptPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const scratch = await mkdtemp(path.join(os.tmpdir(), 'cambium-growth-workerd-'));
const persist = path.join(scratch,'state');
const configPath = path.join(scratch,'wrangler.json');
const envFile = path.join(scratch,'.empty.env');
const authProfile = 'thoughtseed-labs';
const wrangler = process.env.WRANGLER_BIN || 'wrangler';
const source = parseJsonc(await readFile(path.join(root,'workers/quests/wrangler.labs.jsonc'),'utf8'));
const token = randomUUID();
const adminToken = randomUUID();
const deniedToken = randomUUID();
const config = {
  name:'employee-growth-local-smoke',main:path.join(root,'workers/quests/src/index.ts'),
  compatibility_date:source.compatibility_date,compatibility_flags:source.compatibility_flags,
  vars:{BRIDGE_TOKEN:adminToken,GROWTH_WORKFLOW_TENANTS_JSON:'["cambium"]',GROWTH_WORKFLOW_RUNNER_MEMBER_ID:'hermes-runner',GROWTH_WORKFLOW_MAX_PENDING:'3',GROWTH_WORKFLOW_MAX_DAILY:'10'},
  kv_namespaces:[{binding:'QUESTS',id:'00000000000000000000000000000001'}],
  d1_databases:[{binding:'BRIDGE_DB',database_name:'employee-growth-local-smoke',database_id:'00000000-0000-0000-0000-000000000001',migrations_dir:path.join(root,'workers/quests/migrations')}],
};
await writeFile(configPath,JSON.stringify(config),{mode:0o600});
await writeFile(envFile,'',{mode:0o600});
const childEnv={...process.env,WRANGLER_SEND_METRICS:'false',CI:'true',NO_COLOR:'1'};
const common=['--config',configPath,'--profile',authProfile,'--env-file',envFile];
async function cli(args) {
  try { return await exec(wrangler,[...args,...common],{cwd:scratch,env:childEnv,maxBuffer:2_000_000,timeout:120_000}); }
  catch(error) {throw new Error(`local Wrangler command failed (${args.slice(0,3).join(' ')}): ${String(error.stderr||error.stdout||error.message).slice(-2500)}`);}
}
await cli(['d1','migrations','apply','BRIDGE_DB','--local','--persist-to',persist]);
let seedCount=0;
async function kvPut(key,value) {
  const valuePath=path.join(scratch,`seed-${seedCount++}.json`);await writeFile(valuePath,value,{mode:0o600});
  await cli(['kv','key','put',key,'--binding','QUESTS','--path',valuePath,'--local','--persist-to',persist]);
}
async function seed(memberId,tenantId,memberToken) {
  const tokenHash=createHash('sha256').update(memberToken).digest('hex');
  await kvPut(`memtok:${tokenHash}`,memberId);
  await kvPut(`member:${memberId}`,JSON.stringify({memberId,tenantId,status:'active',tokenHash,tokenExp:Date.now()+3_600_000}));
}
await seed('synthetic-employee','cambium',token);
await seed('synthetic-other','cambium',deniedToken);
await seed('hermes-runner','cambium',randomUUID());
const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;await new Promise(resolve=>server.close(resolve));
let runtimeLog='';
const worker=spawn(wrangler,['dev','--local','--persist-to',persist,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0',...common],{cwd:scratch,env:childEnv,stdio:['ignore','pipe','pipe']});
worker.stdout.on('data',chunk=>{runtimeLog=(runtimeLog+chunk.toString()).slice(-30000);});
worker.stderr.on('data',chunk=>{runtimeLog=(runtimeLog+chunk.toString()).slice(-30000);});
const origin=`http://127.0.0.1:${port}`;
const checks=[];
async function call(name,method,route,bearer,body,expected) {
  const response=await fetch(origin+route,{method,headers:{...(bearer?{authorization:`Bearer ${bearer}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const text=await response.text();let parsed;try {parsed=JSON.parse(text);}catch {throw new Error(`${name}: non-JSON response HTTP ${response.status}: ${text.slice(0,300)}`);}
  assert.equal(response.status,expected,`${name}: ${text.slice(0,300)}`);checks.push({name,status:response.status});return parsed;
}
let receipt;
try {
  let ready=false;
  for(let i=0;i<150;i++) {
    if(worker.exitCode!==null) throw new Error(`local runtime exited: ${runtimeLog.slice(-2500)}`);
    try {await fetch(origin+'/version.json');ready=true;break;} catch {await new Promise(resolve=>setTimeout(resolve,200));}
  }
  assert.ok(ready,`local runtime did not start: ${runtimeLog.slice(-2500)}`);
  await call('unauthenticated context denied','GET','/v1/bridge/growth/context',null,null,401);
  await call('admin cannot impersonate employee','GET','/v1/bridge/growth/context',adminToken,null,403);
  const context=await call('employee reads reviewed context','GET','/v1/bridge/growth/context',token,null,200);
  assert.equal(context.sourceCommit.length,40);assert.equal(context.documents.length,4);
  for(const doc of context.documents) assert.equal(doc.excerptDigest,`sha256:${createHash('sha256').update(doc.excerpt).digest('hex')}`);
  const body={requestId:'synthetic-workerd-brief-1',scope:'org-growth',role:'synthesist',objective:'Draft a synthetic internal launch outline. No external action.',contextRefs:context.contextRefs};
  const submitted=await call('scoped handoff admitted','POST','/v1/bridge/growth/requests',token,body,200);
  const id=submitted.request.id;assert.match(id,/^growth_[a-f0-9]{32}$/);
  const replay=await call('exact idempotent replay','POST','/v1/bridge/growth/requests',token,body,200);assert.equal(replay.duplicate,true);assert.equal(replay.request.id,id);
  await call('changed intent conflicts','POST','/v1/bridge/growth/requests',token,{...body,objective:'Changed synthetic objective'},409);
  await call('private request denied to other member','GET',`/v1/bridge/growth/requests/${id}`,deniedToken,null,404);
  const read=await call('requesting member reads queued state','GET',`/v1/bridge/growth/requests/${id}`,token,null,200);assert.equal(read.request.status,'queued');
  const directives=await call('canonical runner directive is durable','GET','/v1/bridge/directives/hermes-runner',adminToken,null,200);
  assert.equal(directives.count,1);assert.equal(directives.directives[0].payload.command,'growth.request.draft');assert.equal(directives.directives[0].payload.input.memberId,'synthetic-employee');
  const rows=await cli(['d1','execute','BRIDGE_DB','--local','--persist-to',persist,'--command','SELECT COUNT(*) AS requests FROM bridge_growth_requests;','--json']);
  const parsedRows=JSON.parse(rows.stdout);assert.equal(parsedRows[0].results[0].requests,1);
  const sourceCommit=(await exec('git',['rev-parse','HEAD'],{cwd:root})).stdout.trim();
  receipt={schema:'thoughtseed.growth.workerd_local_smoke.v1',observedAt:new Date().toISOString(),sourceCommit,runtime:{wrangler:(await exec(wrangler,['--version'],{env:childEnv})).stdout.trim(),compatibilityDate:source.compatibility_date,compatibilityFlags:source.compatibility_flags,mode:'local',authProfile,isolatedPersistence:true,remoteBindings:false},context:{sourceCommit:context.sourceCommit,projectionDigest:context.projectionDigest,documents:context.documents.map(d=>({path:d.path,sourceDigest:d.sourceDigest,excerptDigest:d.excerptDigest}))},checks,d1RequestCount:1,synthetic:true,externalAction:'none',limitations:['No remote KV or D1 mutation','No deployment or production traffic change','No provider inference, Hermes execution or live employee acceptance in this smoke']};
  if(receiptPath)await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({ok:true,sourceCommit,checks:checks.length,d1RequestCount:1,receipt:receiptPath},null,2));
} finally {
  worker.kill('SIGTERM');await new Promise(resolve=>{worker.once('exit',resolve);setTimeout(resolve,5000).unref();});
  // Only this process's mkdtemp directory is removed; no shared Wrangler state is touched.
  await rm(scratch,{recursive:true,force:true});
}
