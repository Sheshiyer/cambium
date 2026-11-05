import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {descriptionRows,DescriptiveMappingView} from './DescriptiveMappings.ts';
const data=()=>JSON.parse(readFileSync(new URL('../../../workers/quests/src/portfolio-descriptions.data.ts',import.meta.url),'utf8').split('export const DESCRIPTION_DATA: unknown = ')[1].slice(0,-2));
test('DTO is immutable, reference-only, source-bearing text with no actions or links',()=>{
 const v=data();const rows=descriptionRows(v);assert.ok(rows);assert.equal(rows.length,24);assert.ok(Object.isFrozen(rows));assert.ok(Object.isFrozen(rows[0].sources));
 const html=renderToStaticMarkup(createElement(DescriptiveMappingView,{rows}));
 assert.match(html,/Source provenance/);assert.match(html,/No action, admission/);assert.doesNotMatch(html,/<button|<form|<a[ >]|onclick|href=/i);
});
test('DTO rejects malformed, duplicate, getter, sparse and injected authority fields',()=>{
 for(const mutate of [(v:any)=>v.records[0].execute=true,(v:any)=>v.records[1]=v.records[0],(v:any)=>delete v.records[0],(v:any)=>v.audience='public',(v:any)=>v.records[0].description='<script>bad</script>']){
 const v=data();mutate(v);assert.equal(descriptionRows(v),null);
 }
 const v=data();let invoked=0;Object.defineProperty(v.records[0],'description',{enumerable:true,get(){invoked++;throw Error('no');}});assert.equal(descriptionRows(v),null);assert.equal(invoked,0);
});
test('safe rendering escapes text even for a forged view prop',()=>{
 const html=renderToStaticMarkup(createElement(DescriptiveMappingView,{rows:[{id:'x',name:'<script>x</script>',description:'<img src=x>',lifecycle:'unknown',date:'unknown',confidence:'uncertain',relationships:[],sources:[]}]}));
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script|<img/);
});
test('nested lifecycle/source enums, authority keys and array caps fail closed',()=>{
 for(const mutate of [(v:any)=>v.records[0].lifecycle.execute=true,(v:any)=>v.records[0].lifecycle.basis='javascript:bad',(v:any)=>v.records[0].sources[0].basis='execute',(v:any)=>v.records[0].sources=Array.from({length:9},()=>structuredClone(v.records[0].sources[0])),(v:any)=>v.records[0].relationships=Array.from({length:9},()=>({targetWorkObjectId:'sapling:cambium',relation:'component',basis:'reported'}))]){
 const v=data();mutate(v);assert.equal(descriptionRows(v),null);
 }
});
test('browser bundle excludes private four-annotation and24record payloads',()=>{
 const bundle=readFileSync(new URL('../bundle.html',import.meta.url),'utf8');
 assert.doesNotMatch(bundle,/Sentinel_[a-f0-9]{32}/);
 for(const row of data().records)assert.ok(!bundle.includes(row.description));
 assert.ok(!bundle.includes('Fitcheck backend retains HDILINT identity; landing remains primary.'));
});
