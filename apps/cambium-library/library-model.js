// Pure view model. No browser APIs, network requests, or credentials.
export const PAGE_SIZE = 36;
export const TOPICS = [
  {id:'ai',name:'AI & agents',color:'sage',mark:'✳',caption:'Tools that think with you'},
  {id:'build',name:'Build & code',color:'blue',mark:'⌘',caption:'Things worth building'},
  {id:'design',name:'Design & craft',color:'clay',mark:'◒',caption:'A little more possibility'},
  {id:'ideas',name:'Ideas & research',color:'gold',mark:'✧',caption:'Follow the interesting thread'},
  {id:'life',name:'Life & elsewhere',color:'rose',mark:'↗',caption:'The rest of your curiosity'}
];
export function safeUrl(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password ? u.href : null; } catch {return null;}
}
export function displayUrl(value) {
  try { const u=new URL(value);return u.hostname.replace(/^www\./,'')+decodeURI(u.pathname).replace(/\/$/,''); }catch{return 'Saved link';}
}
export function sourcesOf(item){return [...new Set([item.source,...(item.sources||[])].filter(Boolean))];}
export function topicOf(item) {
  const category=(item.category||'').toLowerCase(),tags=(item.tags||[]).join(' ').toLowerCase();
  if(/\bai\b|machine learning|agent|llm|prompt|neural/.test(category+' '+tags))return 'ai';
  if(/design|\bux\b|\bui\b|typograph|creative|craft|spatial/.test(category))return 'design';
  if(/program|dev|code|security|tool|technique|infra|software/.test(category))return 'build';
  if(/science|research|learn|philosoph|writing|knowledge|history/.test(category))return 'ideas';
  return 'life';
}
export function isExplored(item){return !!item.reviewedAt;}
export function textOf(item) {return [item.title,item.url,item.text,item.summary,item.note,item.potentialUse,item.category,item.collection,...(item.tags||[]),...(item.paths||[])].filter(Boolean).join(' ').toLocaleLowerCase();}
export function filterItems(items,filter={}) {
  const words=(filter.q||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let out=items.filter(i=>safeUrl(i.url));
  if(filter.source)out=out.filter(i=>filter.source==='personal'?sourcesOf(i).some(s=>s==='chrome'||s==='arc'):sourcesOf(i).includes(filter.source));
  if(filter.cat)out=out.filter(i=>(i.category||'Unsorted')===filter.cat);
  if(filter.topic)out=out.filter(i=>topicOf(i)===filter.topic);
  if(filter.collection)out=out.filter(i=>i.collection===filter.collection);
  if(filter.unexplored)out=out.filter(i=>!isExplored(i));
  if(filter.needsPurpose)out=out.filter(i=>!i.note?.trim());
  if(filter.noSet)out=out.filter(i=>!i.collection?.trim());
  if(words.length)out=out.filter(i=>{const text=textOf(i);return words.every(w=>text.includes(w));});
  const sort=filter.sort||'savedAt';
  return out.sort((a,b)=>sort==='title'?String(a.title||'').localeCompare(b.title||''):sort==='source'?String(a.source||'').localeCompare(b.source||''):(Number(b.addedAt??b.savedAt??0))-(Number(a.addedAt??a.savedAt??0))||String(a.id).localeCompare(String(b.id)));
}
export function workingSets(items){const map=new Map();for(const i of items){const name=i.collection?.trim();if(!name)continue;if(!map.has(name))map.set(name,[]);map.get(name).push(i);}return [...map].map(([name,items])=>({name,items,notes:items.filter(i=>i.note?.trim()).length})).sort((a,b)=>b.items.length-a.items.length||a.name.localeCompare(b.name));}
export function progressOf(items){
 const notes=items.filter(i=>i.note?.trim()).length,explored=items.filter(isExplored).length,sets=workingSets(items),largest=sets[0]?.items.length||0;
 return {notes,explored,sets:sets.length,largest,prepared:items.filter(i=>i.note?.trim()&&i.collection?.trim()).length,quests:[{id:'purpose',label:'Give three ideas a purpose',detail:'Add a note about what you could use them for.',done:Math.min(notes,3),goal:3},{id:'set',label:'Build a working set',detail:'Connect three saves to the same outcome.',done:Math.min(largest,3),goal:3},{id:'explore',label:'Rediscover five old saves',detail:'Read something, then mark it explored.',done:Math.min(explored,5),goal:5}]};
}
export function relatedItems(item,items,limit=4){const tags=new Set(item.tags||[]);return items.filter(i=>i.id!==item.id&&safeUrl(i.url)).map(i=>({item:i,score:(i.collection&&i.collection===item.collection?6:0)+(i.category&&i.category===item.category?2:0)+(i.tags||[]).filter(t=>tags.has(t)).length*3})).filter(i=>i.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(i=>i.item);}
export function pageItems(items,page=1,size=PAGE_SIZE){const count=Math.max(1,Math.ceil(items.length/size)),current=Math.max(1,Math.min(count,page));return {items:items.slice((current-1)*size,current*size),page:current,pages:count,total:items.length};}
export function fieldTheoryRecords(snapshot){
 if(snapshot?.format!=='field-theory-library-v1'||!Array.isArray(snapshot.items))throw new Error('Choose a Field Theory Library export.');
 if(snapshot.items.length>10000)throw new Error('This export is too large. Import up to 10,000 saves at once.');
 return snapshot.items.filter(i=>i&&safeUrl(i.url)).map(i=>{
  const text=(key,max)=>typeof i[key]==='string'?i[key].slice(0,max):'';
  return {url:safeUrl(i.url),title:text('title',300),text:text('text',1500),author:text('author',120),
   source:['x','reddit','github','chrome','arc','manual','shared'].includes(i.source)?i.source:'manual',
   category:text('category',80)||null,tags:Array.isArray(i.tags)?i.tags.filter(t=>typeof t==='string').map(t=>t.slice(0,60)).slice(0,12):[],
   paths:Array.isArray(i.paths)?i.paths.filter(p=>typeof p==='string').map(p=>p.slice(0,400)).slice(0,30):[],
   projectAssessment:['kimi-project-review.v1','kimi-project-review.v2'].includes(i.projectAssessment?.version)?i.projectAssessment:undefined,summary:text('summary',1500),potentialUse:text('potentialUse',1500),sourceRecordId:text('sourceRecordId',120),contentCoverage:text('contentCoverage',200),
   note:text('note',4000),collection:text('collection',100),categorizedBy:i.categorizedBy==='kimi'?'kimi':null,
   savedAt:Number.isFinite(i.savedAt)&&i.savedAt>0?i.savedAt:null};
 });
}
