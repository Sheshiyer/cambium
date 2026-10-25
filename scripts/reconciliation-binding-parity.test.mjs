import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('../docs/reconciliation/391-394-live-binding-metadata.json',import.meta.url),'utf8'));
const config=JSON.parse(readFileSync(new URL('../workers/quests/wrangler.reconcile-393.jsonc',import.meta.url),'utf8').split('\n').filter(line=>!line.trimStart().startsWith('//')).join('\n'));
test('preservation candidate retains all 46 binding identities without capturing variable or secret values',()=>{
 assert.equal(snapshot.bindings.length,46);assert.equal(config.keep_vars,true);assert.deepEqual(config.vars,{});
 const resources=[...config.kv_namespaces.map(b=>({name:b.binding,type:'kv_namespace',id:b.id})),...config.r2_buckets.map(b=>({name:b.binding,type:'r2_bucket',id:b.bucket_name})),...config.vectorize.map(b=>({name:b.binding,type:'vectorize',id:b.index_name})),...config.d1_databases.map(b=>({name:b.binding,type:'d1',id:b.database_id})),{name:config.ai.binding,type:'ai'}];
 const expected=snapshot.bindings.filter(b=>!['plain_text','secret_text'].includes(b.type));assert.equal(resources.length,expected.length);
 for(const b of expected){const c=resources.find(x=>x.name===b.name);assert.ok(c,b.name);assert.equal(c.type,b.type);if(b.type!=='ai')assert.equal(c.id,b.namespace_id??b.bucket_name??b.index_name??b.database_id??b.id);}
 assert.ok(snapshot.bindings.every(b=>!('text' in b)&&!('value' in b)));
 assert.equal(config.compatibility_date,snapshot.runtime.compatibility_date);assert.deepEqual(config.compatibility_flags,snapshot.runtime.compatibility_flags);
 assert.equal(config.routes,undefined,'version-only preservation must not apply global routes');assert.equal(config.name,'cambium-quests');
});
