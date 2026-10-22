import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { CLIENT_CURIOUS_READ_BRIDGE } from './page/client/curious-read-bridge.ts';

function harness() {
  const context = vm.createContext({TENANT:'cambium'});
  vm.runInContext(CLIENT_CURIOUS_READ_BRIDGE, context);
  return {
    run: (code:string) => vm.runInContext(code, context),
    get: () => JSON.parse(vm.runInContext('JSON.stringify(CuriousReadBridge.get())', context)),
  };
}
const envelope = () => ({schema:1,tenant:'cambium',derivedAt:new Date().toISOString(),ledger:{rows:[]}});
test('world read bridge shows a scoped display only after a valid current tenant read', () => {
  const h=harness();
  h.run(`CuriousReadBridge.quest(${JSON.stringify(envelope())},1)`);
  assert.equal(h.get().state,'read');
  assert.deepEqual(Object.keys(h.get()).sort(), ['label','state']);
});
test('world read bridge rejects cross-tenant, missing rows and malformed dates', () => {
  for (const bad of [{...envelope(),tenant:'other'}, {...envelope(),ledger:{}}, {...envelope(),derivedAt:'bad'}, {...envelope(),derivedAt:new Date(Date.now()+120000).toISOString()}, {...envelope(),schema:2}]) {
    const h=harness(); h.run(`CuriousReadBridge.quest(${JSON.stringify(bad)},1)`);
    assert.equal(h.get().state,'held');
  }
});
test('world read bridge clears old success while checking or holding and rejects older callbacks', () => {
  const h=harness(); const e=JSON.stringify(envelope());
  h.run(`CuriousReadBridge.quest(${e},1);CuriousReadBridge.pending(2)`);
  assert.equal(h.get().state,'source');
  h.run('CuriousReadBridge.hold("auth",2)');
  h.run(`CuriousReadBridge.quest(${e},1)`);
  assert.equal(h.get().state,'auth');
  h.run(`CuriousReadBridge.quest(${e},3)`);
  assert.equal(h.get().state,'read');
});
test('world read subscription invalidates synchronously and releases its owner', () => {
  const h=harness();
  h.run('var seen=[];var unsubscribe=CuriousReadBridge.subscribe(s=>seen.push(s.state));CuriousReadBridge.hold("offline",1);unsubscribe();CuriousReadBridge.pending(2)');
  assert.equal(h.run('JSON.stringify(seen)'), '["source","held"]');
});
test('old source receipts stay stale rather than acquiring a current read badge', () => {
  const h=harness();h.run(`CuriousReadBridge.quest(${JSON.stringify({...envelope(),derivedAt:'2020-01-01T00:00:00Z'})},1)`);
  assert.equal(h.get().state,'stale');
});
