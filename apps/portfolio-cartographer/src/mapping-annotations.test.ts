import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAPPING_ANNOTATIONS } from '../../../workers/quests/src/portfolio-four-annotations.data.ts';
import { annotationFor, parseAnnotations } from '../../../workers/quests/src/portfolio-four-annotations.ts';
const examples = structuredClone(MAPPING_ANNOTATIONS) as any;
test('four known annotations resolve as descriptive immutable DTOs', () => {
 const dto = annotationFor(examples, 'program:hdilint'); assert.ok(dto); assert.equal(dto.label, 'Mapping note · founder-confirmed'); assert.match(dto.description, /landing remains primary/); assert.ok(Object.isFrozen(dto));
 assert.equal(parseAnnotations(examples).length, 4); assert.equal(annotationFor(examples, 'branch:relovo'), null);
});
test('rejects unknown or duplicate identities and unsupported relations', () => {
 for (const change of [(x:any)=>x.records[0].workId='program:invented',(x:any)=>x.records[1]=x.records[0],(x:any)=>x.records[0].relatedWorkIds=['program:invented'],(x:any)=>x.records[0].repositoryIds=['R_fake'],(x:any)=>x.records[0].relation='admitted']) { const x=structuredClone(examples);change(x);assert.deepEqual(parseAnnotations(x),[]); }
});
test('fails closed on authority injection and runtime acceptance', () => {
 for (const key of ['admission','tenantId','planningAuthority','catalogDigest','classificationDigest','receiptId','execute','primary','__proto__']) { const x=structuredClone(examples);Object.defineProperty(x.records[0],key,{value:true,enumerable:true});assert.deepEqual(parseAnnotations(x),[]); }
 for(const key of ['authority','actionability','runtimeVerification']) {const x=structuredClone(examples);x.records[0][key]='accepted';assert.deepEqual(parseAnnotations(x),[]);}
});
test('rejects malicious content and arbitrary source links', () => {
 for(const text of ['<img src=x onerror=alert(1)>','javascript:alert(1)','abc\u202edef','abc\u0000']) {const x=structuredClone(examples);x.records[0].description=text;assert.deepEqual(parseAnnotations(x),[]);}
 const x=structuredClone(examples);x.records[0].sourceRefs=['https://evil.test'];assert.deepEqual(parseAnnotations(x),[]);
});
test('does not mutate inputs and rejects malformed envelopes', () => {
 const bytes=JSON.stringify(examples);parseAnnotations(examples);assert.equal(JSON.stringify(examples),bytes);
 for(const value of [null,[],{}, {...examples,execute:true},{...examples,status:'admitted'},{...examples,records:[examples.records[0]]}]) assert.deepEqual(parseAnnotations(value),[]);
});

test('presentation contains no action controls or source links and leaves packets intact', async () => {
 const { createElement } = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server');
 const { MappingAnnotationView } = await import('./MappingAnnotation.ts');
 const before=JSON.stringify(examples); const html=renderToStaticMarkup(createElement(MappingAnnotationView,{note:annotationFor(examples,'program:hdilint')!}));
 assert.match(html,/Descriptive mapping annotation/);assert.match(html,/no action or admission authority/);assert.doesNotMatch(html,/<(?:a|button|form|input|script)\b|vault:|onClick|href=/i);
 assert.equal(renderToStaticMarkup(createElement(MappingAnnotationView,{note:null})),''); assert.equal(JSON.stringify(examples),before);
});

test('sparse identifier arrays fail closed instead of skipping holes', () => {
 for(const key of ['relatedWorkIds','repositoryIds','sourceRefs']) {const x=structuredClone(examples);x.records[0][key]=Array(x.records[0][key].length);assert.deepEqual(parseAnnotations(x),[]);}
});
test('accessor objects and arrays are rejected without invoking getters', () => {
 let calls=0;
 for(const target of ['description','records','index']) {
  const x=structuredClone(examples);const getter=()=>{calls++;throw new Error('must not execute')};
  if(target==='description')Object.defineProperty(x.records[0],'description',{get:getter,enumerable:true});
  if(target==='records')Object.defineProperty(x,'records',{get:getter,enumerable:true});
  if(target==='index')Object.defineProperty(x.records[0].relatedWorkIds,'0',{get:getter,enumerable:true});
  assert.deepEqual(parseAnnotations(x),[]);
 }
 assert.equal(calls,0);
});
test('all four authored descriptions and source message IDs are absent from browser assets',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../bundle.html',import.meta.url),'utf8');
 for(const r of examples.records){assert.ok(!html.includes(r.description));assert.ok(!html.includes(r.sourceMessage));}
});
test('four annotation client DTO rejects injected fields, getter and oversized arrays',async()=>{
 const {annotationDTOs}=await import('./MappingAnnotation.ts');
 const response=()=>({schema:'cambium.mapping-annotation-dtos.v1',notes:structuredClone(parseAnnotations(examples)) as any});
 assert.ok(annotationDTOs(response()));
 for(const mutate of [(v:any)=>v.notes[0].execute=true,(v:any)=>v.notes[0].repositoryIds=Array(9).fill('x'),(v:any)=>v.notes[0].description='<img>',(v:any)=>v.notes[1]=v.notes[0]]){
 const v=response();mutate(v);assert.equal(annotationDTOs(v),null);
 }
});
