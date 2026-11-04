import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createFieldAtlasOperationalFixture} from './field-atlas-operational-fixture.mjs';

test('real loopback requests bind the closed operational fixture and one pending response',async()=>{
  const fixture=createFieldAtlasOperationalFixture();let origin;
  const server=createServer((req,res)=>{
    if(!fixture.handle(req,res,new URL(req.url,origin))){res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  fixture.bind(origin);fixture.select('action-request-pending');
  const send=body=>fetch(origin+'/api/gate/cambium',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
    const wrong=await send({...fixture.requestBody(),optionId:'foreign'});assert.equal(wrong.status,409);await wrong.text();
    assert.equal(fixture.snapshot().acceptedPosts,0);
    const first=send(fixture.requestBody());
    for(let i=0;i<100 && fixture.snapshot().pendingResponses!==1;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(fixture.snapshot().pendingResponses,1);assert.equal(fixture.snapshot().state,'request-sent');
    const duplicate=await send(fixture.requestBody());assert.equal(duplicate.status,409);await duplicate.text();
    assert.equal(fixture.snapshot().acceptedPosts,1);assert.equal(fixture.snapshot().gatePosts,3);
    fixture.release();const response=await first;assert.equal(response.status,200);const body=await response.json();
    assert.equal(body.queued,fixture.ownerRead().requestId);assert.equal(body.realOwnerWrites,0);assert.equal(fixture.snapshot().pendingResponses,0);
  }finally{fixture.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
