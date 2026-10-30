import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,descriptionResponse} from './portfolio-descriptions.ts';
import {DESCRIPTION_DATA} from './portfolio-descriptions.data.ts';
const load=(): any => structuredClone(DESCRIPTION_DATA);
test('24 source-pinned examples validate without WorkObject promotion',()=>{const v=load();assert.equal(v.records.length,24);assert.ok(validate(v));assert.ok(v.records.every(r=>r.workObjectId===null&&r.actionability==='none'));});
for(const key of ['tenantId','admitted','default','receiptId','execute','html','publicUrl'])test('reject authority or unsafe field '+key,()=>{let v=load();v.records[0][key]=true;assert.equal(validate(v),false);});
test('unknown and duplicate repository IDs fail closed',()=>{let v=load();v.records[0].repositoryId='invented';assert.equal(validate(v),false);v=load();v.records[1]=structuredClone(v.records[0]);assert.equal(validate(v),false);});
test('unverified WorkObject promotion rejected',()=>{let v=load();v.records[0].kind='existing-workobject-note';v.records[0].workObjectId='sapling:cambium';assert.equal(validate(v),false);});
test('malformed date, source digest and malicious text rejected',()=>{for(const mutate of [v=>v.records[0].observedOn='2026-02-30',v=>v.records[0].sources[0].sha256='0'.repeat(64),v=>v.records[0].description='<script>x</script>',v=>v.records[0].description='https://leak.test']){let v=load();mutate(v);assert.equal(validate(v),false);}});
test('prototype and getter properties rejected without invocation',()=>{let v=load();Object.setPrototypeOf(v.records[0],{admin:true});assert.equal(validate(v),false);let calls=0;v=load();Object.defineProperty(v.records[0],'description',{get(){calls++;throw Error('getter');},enumerable:true});assert.equal(validate(v),false);assert.equal(calls,0);});
test('sparse and accessor arrays rejected',()=>{let v=load();delete v.records[0];assert.equal(validate(v),false);let calls=0;v=load();Object.defineProperty(v.records,'0',{get(){calls++;throw Error('getter');},enumerable:true});assert.equal(validate(v),false);assert.equal(calls,0);});
test('unknown relationships and public audience rejected',()=>{let v=load();v.records[0].relationships=[{targetWorkObjectId:'sapling:invented',relation:'component',basis:'reported'}];assert.equal(validate(v),false);v=load();v.audience='public';assert.equal(validate(v),false);});
test('runtime acceptance and invalid lifecycle semantics rejected',()=>{let v=load();v.records[0].runtimeVerification='accepted';assert.equal(validate(v),false);v=load();v.records[0].lifecycle={value:'unknown',scope:'client-engagement',basis:'user-confirmed'};assert.equal(validate(v),false);});
test('inputs unchanged by successful validation',()=>{let v=load(),before=JSON.stringify(v);assert.ok(validate(v));assert.equal(JSON.stringify(v),before);});

test('invalid envelope yields no serialized response',()=>{const v=load();v.records[0].execute=true;assert.equal(descriptionResponse(v),null);});
