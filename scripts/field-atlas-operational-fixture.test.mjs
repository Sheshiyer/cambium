import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createFieldAtlasOperationalFixture} from './field-atlas-operational-fixture.mjs';

const instant=Date.parse('2026-11-04T00:00:00Z'),origin='http://127.0.0.1:45231';
function setup(){let time=instant;const fixture=createFieldAtlasOperationalFixture({now:()=>time});fixture.bind(origin);fixture.select('action-request-pending');return {fixture,setTime:v=>time=v};}
function send(fixture,{body=fixture.requestBody(),url=origin+'/api/gate/cambium',method='POST',host='127.0.0.1:45231',remote='127.0.0.1',contentType='application/json'}={}){
  const req=new EventEmitter();Object.assign(req,{method,headers:{host,'content-type':contentType},socket:{remoteAddress:remote},resume(){}});
  const res=new EventEmitter();Object.assign(res,{status:null,body:null,writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}});
  const handled=fixture.handle(req,res,new URL(url));req.emit('data',typeof body==='string'?body:JSON.stringify(body));req.emit('end');return {handled,res};
}
test('synthetic confirmation exposes request-sent before settlement and never a real owner write',()=>{
  const {fixture}=setup();const {res}=send(fixture);assert.equal(res.status,null);assert.equal(fixture.snapshot().state,'request-sent');
  assert.equal(fixture.snapshot().acceptedPosts,1);assert.equal(fixture.snapshot().pendingResponses,1);assert.equal(fixture.release(),true);
  assert.equal(res.status,200);assert.equal(res.body.queued,fixture.ownerRead().requestId);assert.equal(res.body.realOwnerWrites,0);assert.equal(fixture.snapshot().state,'queued');
  assert.equal(send(fixture).res.status,409);assert.equal(fixture.snapshot().acceptedPosts,1);assert.equal(fixture.snapshot().duplicatePosts,1);assert.equal(fixture.release(),false);
  fixture.select('action-request-pending');assert.equal(fixture.snapshot().state,'queued');
  assert.equal(send(fixture).res.status,409);assert.equal(fixture.snapshot().acceptedPosts,0);assert.equal(fixture.snapshot().duplicatePosts,1);
});
test('wrong owner identity, local envelope version/digest/freshness and unavailable capability fail closed',()=>{
  for(const key of ['tenantId','requestId','optionId','version','digest','observedAt','expiresAt','schema','authority']){
    const {fixture}=setup();const read=fixture.ownerRead();read[key]=key==='version'?2:'wrong';
    assert.throws(()=>fixture.select('action-request-pending',read),/conflict/);assert.equal(send(fixture).res.status,403);assert.equal(fixture.snapshot().acceptedPosts,0);
  }
  const {fixture,setTime}=setup();setTime(instant+1_800_000);assert.throws(()=>fixture.select('action-request-pending'),/expired/);assert.equal(send(fixture).res.status,403);
  assert.throws(()=>fixture.select('missing-owner'),/Unknown/);assert.equal(fixture.snapshot().state,'held');
});
test('remote origins, credentials, rebinding, foreign hosts/peers, methods and routes refuse before transition',()=>{
  for(const target of ['https://127.0.0.1:45231','http://localhost:45231','http://example.com:45231','http://user@127.0.0.1:45231','http://127.0.0.1:45231/path']){
    assert.throws(()=>createFieldAtlasOperationalFixture({now:instant}).bind(target),/loopback/);
  }
  const {fixture}=setup();assert.throws(()=>fixture.bind('http://127.0.0.1:45232'),/change/);
  for(const input of [{url:'http://example.com/api/gate/cambium'},{host:'example.com'},{remote:'192.0.2.1'},{method:'GET'},{url:origin+'/api/gate/foreign'},{url:origin+'/founder/api/gate/cambium'},{url:origin+'/api/gate/cambium?override=1'},{contentType:'text/plain'}]){
    const {handled,res}=send(fixture,input);assert.equal(handled,true);assert.ok(res.status>=400);assert.equal(fixture.snapshot().acceptedPosts,0);
  }
});
test('kind/request/subject/option/idempotency/auth conflicts, extra fields and malformed JSON cannot queue',()=>{
  for(const key of ['kind','subject','actionRequestId','optionId','idempotencyKey','initData']){
    const {fixture}=setup();const body=fixture.requestBody();body[key]='wrong';assert.equal(send(fixture,{body}).res.status,409);assert.equal(fixture.snapshot().acceptedPosts,0);
  }
  for(const body of ['invalid','null','[]']){const {fixture}=setup();assert.ok(send(fixture,{body}).res.status>=400);assert.equal(fixture.snapshot().acceptedPosts,0);}
  const {fixture}=setup();assert.equal(send(fixture,{body:{...fixture.requestBody(),target:'https://example.com'}}).res.status,409);
  assert.equal(send(fixture,{body:'x'.repeat(16_001)}).res.status,413);assert.equal(fixture.snapshot().acceptedPosts,0);
});
test('expiry after selection and repeated in-flight confirmation preserve exactly one accepted POST',()=>{
  const {fixture,setTime}=setup();const first=send(fixture);assert.equal(send(fixture).res.status,409);assert.equal(fixture.snapshot().acceptedPosts,1);
  fixture.close();assert.equal(first.res.status,503);assert.equal(fixture.snapshot().state,'held');
  fixture.select('action-request-pending');setTime(instant+1_800_001);assert.equal(send(fixture).res.status,409);assert.equal(fixture.snapshot().acceptedPosts,0);
});
