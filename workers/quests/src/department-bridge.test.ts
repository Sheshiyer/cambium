import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { CLIENT_CURIOUS_DEPARTMENT_BRIDGE } from './page/client/curious-department-bridge.ts';
function setup(founder=true) {
 const pending:Array<{resolve:(v:any)=>void;reject:(e:any)=>void}>=[];
 const context:any={FOUNDER_WEB:founder,TENANT:'cambium',CuriousGateBridge:{graph:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))},CuriousPocketWorld:{createDepartmentReader:(raw:any)=>({input:raw})}};
 vm.runInNewContext(CLIENT_CURIOUS_DEPARTMENT_BRIDGE+'\nthis.bridge=CuriousDepartmentBridge;',context);return {bridge:context.bridge,pending};
}
test('out-of-order graph reads cannot replace a newer frontier or recover after disposal',async()=>{
 const {bridge,pending}=setup();let notifications=0;const off=bridge.subscribe(()=>notifications++);
 const a=bridge.refresh(),b=bridge.refresh();pending[1].resolve('new');await b;assert.equal(bridge.get().input,'new');pending[0].resolve('old');await a;assert.equal(bridge.get().input,'new');
 const c=bridge.refresh();assert.equal(bridge.get(),null);bridge.dispose();pending[2].resolve('late');await c;assert.equal(bridge.get(),null);const count=notifications;off();await bridge.refresh();assert.equal(notifications,count);assert.equal(pending.length,3);
});
test('auth/read failure clears cached projection and public or foreign tenant pages never read',async()=>{
 const {bridge,pending}=setup();const first=bridge.refresh();pending[0].resolve('confirmed');await first;assert.ok(bridge.get());const second=bridge.refresh();pending[1].reject(new Error('auth'));await second;assert.equal(bridge.get(),null);
 const publicPage=setup(false);await publicPage.bridge.refresh();assert.equal(publicPage.pending.length,0);
});
test('resume rereads through the same owner and unsubscribe stops automatic recomputation',async()=>{
 const {bridge,pending}=setup();let n=0;const off=bridge.subscribe(()=>n++);bridge.dispose();bridge.resume();off();const read=bridge.refresh();pending[0].resolve('fresh');await read;assert.equal(bridge.get().input,'fresh');assert.equal(n,1);
});
