import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDirectionDraft } from './shared-directions.ts';
const draft=()=>({title:'Next meaningful action',body:'Line one\nLine two',workObjectId:'sapling:cambium',workNodeId:'goal_'+'a'.repeat(64),graphHeadDigest:'b'.repeat(64),signalPins:[{id:'signal-1',revision:3}]});
test('direction draft bounds exact fields, identifiers and immutable source pins',()=>{
 assert.equal(validateDirectionDraft(draft()),true);assert.equal(validateDirectionDraft({...draft(),body:''}),true);
 for(const change of [{extra:true},{title:' '},{title:'x'.repeat(201)},{body:'x'.repeat(16001)},{body:'\u0000'},{workObjectId:'sapling:other'},
 {workNodeId:'bad/path'},{graphHeadDigest:'b'},{signalPins:[]},{signalPins:[{id:'a',revision:0}]},{signalPins:[{id:'a',revision:'1'}]},
 {signalPins:[{id:'a',revision:1.1}]},{signalPins:[{id:'a',revision:Number.MAX_SAFE_INTEGER+1}]},{signalPins:[{id:'a',revision:1,secret:true}]},
 {signalPins:[{id:'a',revision:1},{id:'a',revision:2}]},{signalPins:Array.from({length:17},(_,i)=>({id:'s'+i,revision:1}))}])assert.equal(validateDirectionDraft({...draft(),...change}),false,JSON.stringify(change));
});
