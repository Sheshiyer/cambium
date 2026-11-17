// Placement is a local review layer. Imported tags and categories stay intact.
export const ORGANS=Object.freeze([
 {id:'taste',name:'Taste',mark:'◒',caption:'Form, brand and creative judgment'},
 {id:'will',name:'Will',mark:'△',caption:'Direction, decisions and priorities'},
 {id:'hands',name:'Hands',mark:'⌘',caption:'Build, tools and execution'},
 {id:'cortex',name:'Cortex',mark:'✳',caption:'Memory, research and connections'},
 {id:'signals',name:'Signals',mark:'◎',caption:'Feedback, measurement and learning'},
 {id:'unplaced',name:'Unplaced inlet',mark:'⌁',caption:'References awaiting a grounded placement'}
]);
const names=new Set(ORGANS.filter(o=>o.id!=='unplaced').map(o=>o.id));
const patterns={
 taste:/design|brand|visual|creative|\bart\b|\bartwork\b|\bartist\b|typograph|aesthetic|illustrat|\bux\b|\bui\b|video|film|image/,
 will:/strategy|business|startup|growth|market|planning|decision|leadership|finance|product management/,
 hands:/program|software|developer|cod(?:e|ing)|engineering|automation|agent tool|\bmcp\b|infrastructure|security|\bapi\b|framework/,
 cortex:/research|knowledge|memory|learn|science|education|wiki|philosoph|writing|history|retriev/,
 signals:/analytic|metric|observab|monitor|feedback|experiment|evaluation|benchmark|testing|telemetry/
};
export function suggestedOrgan(item){
 const explicit=(item?.tags||[]).find(tag=>typeof tag==='string'&&tag.startsWith('cambium:'))?.slice(8).toLowerCase();
 if(names.has(explicit))return {organ:explicit,status:'source',reason:'Source organ hint'};
 for(const [text,reason] of [[item?.category,'Suggested from saved category'],[[item?.summary,item?.potentialUse,item?.title,item?.text,item?.note,...(item?.tags||[])].filter(Boolean).join(' '),'Suggested from saved context']]){
  const scores=Object.fromEntries(Object.entries(patterns).map(([organ,pattern])=>[organ,((text||'').toLowerCase().match(new RegExp(pattern.source,'g'))||[]).length]));
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  if(ranked[0]?.[1]&&ranked[0][1]!==ranked[1]?.[1])return {organ:ranked[0][0],status:'suggested',reason};
 }
 return {organ:'unplaced',status:'unplaced',reason:'No clear organ signal'};
}
export function placementFor(item,review={}){
 const decision=review?.[item?.id];
 if(decision?.status==='confirmed'&&names.has(decision.organ))return {organ:decision.organ,status:'confirmed',reason:'Your placement'};
 if(decision?.status==='held')return {organ:'unplaced',status:'held',reason:'You held this placement for review'};
 return suggestedOrgan(item);
}
export function organCounts(items,review={}){
 const counts=Object.fromEntries(ORGANS.map(organ=>[organ.id,{total:0,suggested:0}]));
 for(const item of items){const placement=placementFor(item,review);counts[placement.organ].total++;if(placement.status==='suggested')counts[placement.organ].suggested++;}
 return counts;
}
