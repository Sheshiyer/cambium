import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { PAGE } from './page/index.ts';
import { CURIOUS_WORLD_PAGE } from './page/components/curious-world.ts';
import { OPERATING_FABRIC_PAGE } from './page/operating-fabric/index.ts';
import { CURIOUS_WORLD_JS, CURIOUS_WORLD_CSS, CURIOUS_WORLD_SHA256, CURIOUS_WORLD_BYTES } from './page/components/curious-world.generated.ts';

test('Field Atlas is the single-body default document without either retired desk', () => {
  assert.equal(PAGE.split('data-component="CuriousPocketWorld"').length, 2);
  assert.equal(PAGE.split('</body>').length, 2);
  assert.ok(PAGE.includes('<title>Cambium · Field Atlas</title>'));
  assert.doesNotMatch(PAGE, /MissionControlShell|RootNav|data-root-scene|id="operating-fabric"|curious-world-launch|2D workbench/);
  assert.ok(!PAGE.includes(OPERATING_FABRIC_PAGE));
  assert.ok(PAGE.includes(CURIOUS_WORLD_PAGE));
});
test('world payload is a deterministic self-contained bounded bundle with a retained Three license', () => {
  assert.equal(createHash('sha256').update(CURIOUS_WORLD_JS).update('\0').update(CURIOUS_WORLD_CSS).digest('hex'),CURIOUS_WORLD_SHA256);
  assert.equal(Buffer.byteLength(CURIOUS_WORLD_JS)+Buffer.byteLength(CURIOUS_WORLD_CSS),CURIOUS_WORLD_BYTES.total);
  assert.ok(CURIOUS_WORLD_BYTES.total<2_100_000);
  assert.match(CURIOUS_WORLD_JS,/MIT License/);
  assert.doesNotMatch(CURIOUS_WORLD_JS,/<\/script/i);
  assert.doesNotMatch(CURIOUS_WORLD_CSS,/<\/style/i);
  assert.doesNotMatch(CURIOUS_WORLD_JS,/\bimport\s*\(/);
  assert.doesNotMatch(CURIOUS_WORLD_JS,/\/Users\/|\/Volumes\/|BEGIN PRIVATE KEY|snowgloves-cloudflare/);
});
test('world IIFE initializes in a script context without starting a renderer or creating network reads', () => {
  const scope=vm.createContext({console});
  vm.runInContext(CURIOUS_WORLD_JS,scope,{timeout:3000});
  assert.equal(vm.runInContext('typeof CuriousPocketWorld.mountCuriousWorld',scope),'function');
});
