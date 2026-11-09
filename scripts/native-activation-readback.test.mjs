import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, copyFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Exercise the real packet generator with an isolated owner CLI. No network,
// Swift build, credentials or repository worktree mutations occur in fixtures.
async function packet(mode){
 const root=await mkdtemp(path.join(tmpdir(),'native-readback-test-'));
 try{
  const tools=path.join(root,'apps/cambium-mac/tools'),bin=path.join(root,'bin');
  await mkdir(tools,{recursive:true});await mkdir(bin);
  await mkdir(path.join(root,'workers/quests/migrations'),{recursive:true});
  await copyFile(new URL('../apps/cambium-mac/tools/probe-activation-readiness.sh',import.meta.url),path.join(tools,'probe.sh'));
  for(const file of ['0100_native_sessions.sql','0101_native_consent.sql'])await writeFile(path.join(root,'workers/quests/migrations',file),'-- fixture\n');
  const executable=async(file,text)=>writeFile(file,'#!/bin/sh\n'+text,{mode:0o755});
  await executable(path.join(tools,'probe-live-owner.sh'),`echo '{"routeSurfaceReady":false}'\n`);
  await executable(path.join(tools,'probe-current-portfolio.sh'),`echo '{"catalogDigest":"sha256:fixture"}'\n`);
  await executable(path.join(bin,'git'),`case "$1" in rev-parse) echo fixture-head;; esac\n`);
  await executable(path.join(bin,'gh'),`exit 1\n`);
  await executable(path.join(bin,'npx'),`
case "$*" in
 *'deployments status'*) echo '{"id":"fixture","versions":[]}' ;;
 *'migrations list'*) if [ "$FIXTURE_MODE" = fail ]; then exit 1; fi ;;
 *'secret list'*) if [ "$FIXTURE_MODE" = fail ]; then exit 1; fi; echo '[]' ;;
 *'d1 execute'*) if [ "$FIXTURE_MODE" = fail ]; then echo '{"error":{"code":7403}}'; exit 1; fi; echo '[{"success":true,"results":[],"meta":{"rows_written":0,"changes":0,"changed_db":false}}]' ;;
 *) exit 9 ;;
esac\n`);
  const run=spawnSync('sh',[path.join(tools,'probe.sh')],{encoding:'utf8',env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,FIXTURE_MODE:mode,CAMBIUM_RUN_LIVE_BINDING_READBACK:'1',CAMBIUM_RUN_WRANGLER_DRY_RUN:'0'}});
  assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout).runtimeReadback;
 }finally{await rm(root,{recursive:true,force:true});}
}
test('failed owner reads stay unavailable instead of proving empty schema or absent secrets',async()=>{
 const r=await packet('fail');assert.equal(r.status,'partial');
 assert.deepEqual(r.reads,{deployment:'read',migrations:'unavailable',secrets:'unavailable',schema:'unavailable'});
 assert.equal(r.nativeD1Tables,null);assert.equal(r.unappliedMigrations,null);
 assert.equal(r.remoteSecretCount,null);assert.equal(r.dedicatedNativeIdentitySecretPresent,null);
});
test('successful empty reads can establish absence without confusing it with a failed read',async()=>{
 const r=await packet('ok');assert.equal(r.status,'read');assert.equal(r.reads.schema,'read');
 assert.deepEqual(r.nativeD1Tables,[]);assert.deepEqual(r.unappliedMigrations,[]);
 assert.equal(r.remoteSecretCount,0);assert.equal(r.dedicatedNativeIdentitySecretPresent,false);
});
