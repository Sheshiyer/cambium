import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_ATLAS_CAPTURE_STEPS, FIELD_ATLAS_SOURCE_SHA256, FIELD_ATLAS_PLAN_SHA256, jpegDimensions, validateFieldAtlasViewportProof } from './field-atlas-viewport-proof.mjs';

// In-memory validation fixtures only; never written as canonical browser evidence.
function receipt() {
  return { schema:'cambium.field-atlas-viewport-proof.v1', scope:'local-synthetic', productionAcceptance:false,
    physicalDevice:false, adapter:'codex-iab', status:'passed', capturedAt:new Date().toISOString(),
    pageSourceSha256:FIELD_ATLAS_SOURCE_SHA256, planSha256:FIELD_ATLAS_PLAN_SHA256,
    proofs:FIELD_ATLAS_CAPTURE_STEPS.map(step=>({id:step.id,path:step.path,input:'native-browser-ui',
      viewport:{width:step.width||1280,height:900},sha256:'a'.repeat(64),checks:Object.fromEntries(step.checks.map(key=>[key,true]))})) };
}
test('3D viewport contract requires current source, native observations and local evidence scope', () => {
  assert.deepEqual(validateFieldAtlasViewportProof(receipt()),[]);
  for (const change of [{pageSourceSha256:'a'.repeat(64)},{planSha256:'b'.repeat(64)},{productionAcceptance:true},{scope:'production'},{adapter:'configured-chrome'},{status:'prepared'}]) {
    assert.ok(validateFieldAtlasViewportProof({...receipt(),...change}).length);
  }
});
test('3D viewport contract rejects missing/reordered states, false assertions and non-320 mobile evidence', () => {
  for (const mutate of [
    value=>value.proofs.pop(), value=>value.proofs.reverse(),
    value=>{value.proofs[0].checks.telegramSdkAbsent=false;},
    value=>{value.proofs[3].viewport.width=319;},
    value=>{value.proofs[1].input='script-dispatch';},
  ]) { const value=receipt();mutate(value);assert.ok(validateFieldAtlasViewportProof(value).length); }
});
test('3D viewport contract does not accept metadata in place of actual screenshot artifacts', () => {
  const result=validateFieldAtlasViewportProof(receipt(),'/nonexistent-field-atlas-capture-test');
  assert.match(result.join('\n'),/screenshot directory is missing/);
  assert.match(result.join('\n'),/actual JPEG is missing/);
});

test('native JPEG frame dimensions are inspected without interpreting PNG offsets or transcoding', () => {
  const data=Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x04,0x00,0x00,0xff,0xc0,0x00,0x0b,0x08,0x03,0x20,0x01,0x40,0x01,0x01,0x11,0x00,0xff,0xd9]);
  assert.deepEqual(jpegDimensions(data),{width:320,height:800});
  assert.throws(()=>jpegDimensions(Buffer.from('89504e470d0a1a0a','hex')));
  assert.throws(()=>jpegDimensions(data.subarray(0,10)));
});
