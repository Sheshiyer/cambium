import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SYSTEM_ATLAS, atlasEvidence } from '../../../shared/cambium-system-atlas.ts';
import { SYSTEM_ATLAS_BROWSER, SYSTEM_ATLAS_CSS } from './page/components/system-atlas.ts';

const context = vm.createContext({});
vm.runInContext(SYSTEM_ATLAS_BROWSER,context,{timeout:1000});
const render = (view: string, selected: string, id='test-atlas') => vm.runInContext(
  `CambiumSystemAtlas.render(${JSON.stringify(view)},${JSON.stringify(selected)},${JSON.stringify(id)})`,context,{timeout:1000});

test('atlas has the exact eleven owner identities in two source families', () => {
  assert.deepEqual(SYSTEM_ATLAS.organs.map(row=>row.id),['genesis','taste','hands','will','cortex','vestibule','adytum','nutrix','auspex','circulator','praeceptor']);
  assert.equal(SYSTEM_ATLAS.organs.filter(row=>row.family==='cambium').length,5);
  assert.equal(SYSTEM_ATLAS.organs.filter(row=>row.family==='temperance').length,6);
  assert.equal(SYSTEM_ATLAS.authority,'read_only');
  for(const row of SYSTEM_ATLAS.organs){assert.equal(row.assetId,`TSOC-ORG-${row.id.toUpperCase()}-CONCEPT-V1`);assert.ok(row.inputs.length && row.outputs.length && row.boundary);}
});
test('all typed connections join known owners and carry propositions', () => {
  for(const [nodes,links] of [[SYSTEM_ATLAS.organs,SYSTEM_ATLAS.organLinks],[SYSTEM_ATLAS.systems,SYSTEM_ATLAS.systemLinks]] as const){
    const ids=new Set(nodes.map(row=>row.id));
    for(const link of links){assert.ok(ids.has(link.from) && ids.has(link.to));assert.ok(link.label);assert.ok(['knowledge','execution','evidence','projection','command'].includes(link.kind));}
  }
  assert.equal(SYSTEM_ATLAS.desks.length,6);
  assert.equal(new Set(SYSTEM_ATLAS.desks.map(row=>row.id)).size,6);
});
test('every relationship binds its own literal source and fingerprint', () => {
  const root=new URL('../../../',import.meta.url);
  const projection=JSON.parse(readFileSync(new URL('docs/architecture/system-atlas.v1.json',root),'utf8'));
  const rows=[...SYSTEM_ATLAS.organLinks,...SYSTEM_ATLAS.systemLinks,...SYSTEM_ATLAS.desks];
  assert.equal(projection.relationshipBindings.length,rows.length);
  for(const row of rows){
    const body=readFileSync(new URL(row.source,root),'utf8');
    assert.ok(body.includes(row.selector),`${row.source}: ${row.selector}`);
    const binding=projection.relationshipBindings.find((x: any)=>x.source===row.source&&x.selector===row.selector);
    assert.ok(binding,`Missing own binding: ${row.selector}`);
    assert.equal(binding.sourceSha256,'sha256:'+createHash('sha256').update(body).digest('hex'));
  }
});
test('proof returns to a new Gate and optional transport cannot imply an installed chain', () => {
  assert.ok(SYSTEM_ATLAS.systemLinks.some(row=>row.from==='proof'&&row.to==='gate'));
  assert.ok(!SYSTEM_ATLAS.systemLinks.some(row=>row.from==='proof'&&row.to==='d1'));
  assert.ok(!SYSTEM_ATLAS.systemLinks.some(row=>row.from==='omniroute'&&row.to==='broker'));
  const optional=SYSTEM_ATLAS.systemLinks.find(row=>row.from==='omniroute'&&row.to==='hermes');
  assert.equal(optional?.basis,'conceptual');assert.match(optional?.boundary||'',/held/);
  const html=render('connections','hermes');
  assert.match(html,/separate signed founder\/viewer read/);
  assert.ok(html.includes(optional!.source));
  assert.match(html,/Conceptual relationship · installed hop held/);
  assert.ok(render('connections','access').includes('const identity = await verifyAccessJwt(headers, cfg, fetchImpl);'));
});
test('growth document ownership, principal organs and goal bindings remain distinct', () => {
  assert.deepEqual(SYSTEM_ATLAS.desks.map(row=>row.principalOrgan),['genesis','hands','taste','will','hands','cortex']);
  for(const row of SYSTEM_ATLAS.desks){
    assert.equal(row.documentOwner,'CEO');assert.equal(row.executionState,'goal / candidate');
    assert.ok(row.organs.includes('will'));const html=render('growth',row.id);
    assert.ok(html.includes(row.owner));assert.match(html,/runtime assignment held/);
    assert.ok(html.includes(row.source)&&html.includes(row.selector));
  }
});
test('missing and loose status aliases are held, not ready or complete', () => {
  for(const value of [undefined,null,'ready','approved','active','done','complete',{},'<script>']) assert.equal(atlasEvidence(value),'held');
  for(const value of ['source','local','production','held','retired'])assert.equal(atlasEvidence(value),value);
});
test('each selected organ yields its own contract and canonical portrait', () => {
  for(const row of SYSTEM_ATLAS.organs){const html=render('organs',row.id);assert.ok(html.includes(`data-atlas-detail="${row.id}"`));assert.ok(html.includes(row.assetId));assert.ok(html.includes(row.source));assert.match(html,/data-evidence="source"/);assert.doesNotMatch(html,/data-evidence="production"/);}
});
test('untrusted selector arguments cannot inject markup or select unknown identities', () => {
  const html=render('</script><script>bad()</script>','constructor','evil" onclick="bad()');
  assert.ok(html.includes('data-atlas-detail="genesis"'));assert.ok(html.includes('id="system-atlas-panel"'));
  assert.doesNotMatch(html,/<script|onclick=|bad\(\)|constructor/);
});
test('source paths exist and metadata excludes private identities and machine paths', () => {
  const root=new URL('../../../',import.meta.url);
  for(const row of [...SYSTEM_ATLAS.organs,...SYSTEM_ATLAS.systems])assert.ok(readFileSync(new URL(row.source,root)).length>0,row.source);
  const json=JSON.stringify(SYSTEM_ATLAS);
  assert.doesNotMatch(json,/thoughtseedlabs@gmail|\/Users\/|\/Volumes\/|Bearer\s|query_id=|auth_date=|PRIVATE KEY|https?:\/\/[^" ]+\?/i);
});
test('bundled source renderer cannot fetch, queue, message, or mutate state', () => {
  assert.doesNotMatch(SYSTEM_ATLAS_BROWSER,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|postMessage|gateAct|signedAction|\/api\//);
  for(const view of ['connections','growth','evidence'])assert.ok(render(view,'').includes('data-authority="read_only"'));
  assert.match(render('connections','plexus'),/email alone is insufficient/);
  assert.match(render('connections','gate'),/cannot substitute/);
});
test('permission, transport and semantic receipts remain distinct', () => {
  assert.deepEqual(SYSTEM_ATLAS.receiptStrata.map(row=>row.id),['permission','transport','semantic']);
  const html=render('evidence','');
  for(const row of SYSTEM_ATLAS.receiptStrata)assert.ok(html.includes(row.question));
  for(const row of SYSTEM_ATLAS.holds)assert.ok(html.includes(row.name));
  assert.ok(html.includes('Historical only'));assert.ok(html.includes('Constellation'));
});
test('atlas styles preserve mobile navigation, 44px targets and reduced motion', () => {
  assert.match(SYSTEM_ATLAS_CSS,/max-width:700px/);assert.match(SYSTEM_ATLAS_CSS,/prefers-reduced-motion:reduce/);
  assert.match(SYSTEM_ATLAS_CSS,/min-height:44px/);assert.match(SYSTEM_ATLAS_CSS,/focus-visible/);
  assert.doesNotMatch(SYSTEM_ATLAS_CSS,/@keyframes|animation:.*infinite/);
  assert.match(render('organs','genesis'),/role="tablist"/);assert.match(render('organs','genesis'),/role="tabpanel"/);
});
test('portrait lineage binds originals and small bundled derivatives', () => {
  const root=new URL('../../../',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('docs/assets/visual-flow/system-atlas/PORTRAITS.v1.json',root),'utf8'));
  assert.equal(manifest.portraits.length,11);assert.ok(manifest.bytes<160000);
  for(const row of manifest.portraits){for(const [path,digest] of [[row.sourcePath,row.sourceSha256],[row.derivativePath,row.sha256]])assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),digest);assert.equal(row.authority,'reference-only');}
});
