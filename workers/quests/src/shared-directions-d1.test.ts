import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { d1SharedDirectionStore } from './shared-directions-d1.ts';
import type { SharedDirection } from './shared-directions.ts';
function setup() {
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0103_shared_directions.sql',import.meta.url),'utf8'));
 const d1:any={prepare(sql:string){const statement=db.prepare(sql);let args:any[]=[];return{bind(...values:any[]){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return{results:statement.all(...args)};},async run(){return{meta:{changes:Number(statement.run(...args).changes)}};}};}};
 return{db,store:d1SharedDirectionStore(d1)};
}
const scope={tenantId:'cambium',principal:'founder-1'};
function direction():SharedDirection{return{id:'direction-1',...scope,title:'Improve capture',body:'Make a small verified change.',workObjectId:'sapling:cambium',workNodeId:'goal-node',graphHeadDigest:'a'.repeat(64),signalPins:[{id:'signal-1',revision:3}],revision:1,createdAt:'2026-11-04T00:00:00.000Z',updatedAt:'2026-11-04T00:00:00.000Z'};}
test('direction store atomic receipt, replay, changed request, scoped reads and revision race',async()=>{
 const {db,store}=setup();const value=direction();
 assert.equal(await store.write(scope,'create','request',value,0),'written');
 assert.equal(await store.write(scope,'create','request',{...value,id:'discarded-race-id'},0),'replay');
 assert.equal(await store.write(scope,'create','changed',value,0),'operation_conflict');
 assert.equal((await store.read(scope,value.id))?.revision,1);
 for(const foreign of [{...scope,tenantId:'other'},{...scope,principal:'other'}]){assert.equal(await store.read(foreign,value.id),null);assert.deepEqual(await store.list(foreign,null),[]);assert.equal(await store.receipt(foreign,'create'),null);}
 const update={...value,title:'Revised',revision:2};
 const results=await Promise.all([store.write(scope,'update-a','a',update,1),store.write(scope,'update-b','b',{...update,title:'Other'},1)]);
 assert.deepEqual(results.sort(),['revision_conflict','written']);
 assert.equal((await store.read(scope,value.id))?.revision,2);
 assert.equal((db.prepare('SELECT count(*) n FROM shared_direction_operations').get() as any).n,2);
 assert.equal((await store.list(scope,'sapling:cambium')).length,1);assert.deepEqual(await store.list(scope,'sapling:other'),[]);
});
test('scope/document mismatch and changed creation time cannot publish a receipt or document',async()=>{
 const {db,store}=setup();const value=direction();
 await assert.rejects(store.write({...scope,principal:'foreign'},'bad','bad',value,0));
 assert.equal(await store.write(scope,'create','ok',value,0),'written');
 await assert.rejects(store.write(scope,'bad-update','bad',{...value,revision:2,createdAt:'2026-11-03T00:00:00.000Z'},1));
 assert.equal(await store.receipt(scope,'bad-update'),null);assert.equal((await store.read(scope,value.id))?.revision,1);
 assert.throws(()=>db.prepare('INSERT INTO shared_direction_operations VALUES (?,?,?,?,?,?,?)').run('other','foreign','malicious','bad',value.id,0,JSON.stringify(value)),/direction_document_invalid/);
 assert.equal((db.prepare('SELECT count(*) n FROM shared_directions').get() as any).n,1);
});
