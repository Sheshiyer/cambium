import {fieldTheoryRecords,safeUrl} from './library-model.js';
import {getLibrary,saveSettings,syncSource,upsert,categorizePending,askLibrary,saveItems,withLibraryWrite,parseArcMarkdown,fetchChromeBookmarks,heuristicCategory,itemId} from './library.js';
import {refreshProjectFitIndex,recordFitFeedback,projectReviewQueue,bulkProjectReviews,prepareProjectHandoff} from './project-fit.js';
import {ORGANS} from './organ-atlas.js';
// Shared by the Library tab and worker. No message listener or background bootstrap.
function sameGroupUrl(left,right){
 if(!safeUrl(left)||!safeUrl(right))return false;
 const a=new URL(left),b=new URL(right);
 const host=url=>url.hostname.replace(/^www\./,'').toLowerCase();
 if(host(a)!==host(b))return false;
 if(host(a)==='figma.com'){
  const file=url=>url.pathname.match(/^\/(?:file|design)\/([^/]+)/)?.[1];
  if(file(a)&&file(a)===file(b))return true;
 }
 const key=url=>{url.hash='';url.pathname=url.pathname.replace(/\/$/,'')||'/';for(const k of [...url.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid)$/.test(k))url.searchParams.delete(k);url.searchParams.sort();return `${host(url)}${url.pathname}${url.search}`;};
 return key(a)===key(b);
}
export async function runLibraryRequest(msg,sender={}){
 let response;const reply=value=>{response=value;};
 const handle=async()=>{switch(msg.type){
      case "lib:capabilities": reply({version:"0.6.2",bulk:true,personal:true,projectReview:true,agentHandoffs:true});break;
      case "lib:project-review-queue": reply(await projectReviewQueue());break;
      case "lib:bulk-fit-feedback": reply(await bulkProjectReviews(msg.entries));break;
      case "lib:prepare-project-handoff": reply(await prepareProjectHandoff(msg.selection,msg.options));break;
      case "lib:fit-index": reply(await refreshProjectFitIndex());break;
      case "lib:refresh-fits": reply(await refreshProjectFitIndex());break;
      case "lib:fit-feedback": reply(await recordFitFeedback(msg.itemId,msg.productId,msg.decision));break;
      case "lib:organ-placement": {
        const lib=await getLibrary();if(!lib.items[msg.id])throw new Error('This save is no longer in your Library.');
        if(!['confirmed','held','clear'].includes(msg.status))throw new Error('Unknown placement response.');
        if(msg.status==='confirmed'&&!ORGANS.some(o=>o.id===msg.organ&&o.id!=='unplaced'))throw new Error('Unknown organ.');
        const {organPlacements={}}=await chrome.storage.local.get('organPlacements');
        if(msg.status==='clear')delete organPlacements[msg.id];
        else organPlacements[msg.id]={organ:msg.status==='confirmed'?msg.organ:'unplaced',status:msg.status,at:Date.now()};
        await chrome.storage.local.set({organPlacements});reply(organPlacements[msg.id]||null);break;
      }
      case "lib:prepare-shared": {
        const {sharedReferenceImport}=await chrome.storage.local.get("sharedReferenceImport");
        if(sharedReferenceImport?.version===1){reply(sharedReferenceImport);break;}
        const response=await fetch(chrome.runtime.getURL("shared-links.json"));
        if(!response.ok)throw new Error("Shared reference list is unavailable.");
        const batch=await response.json(),groups=batch?.groups;
        if(batch.version!==1||!groups||typeof groups!=="object")throw new Error("Shared reference list is invalid.");
        const categories={Taste:"Design & UX",Will:"Startups & Business",Hands:"Programming & Dev Tools",Cortex:"Learning & Courses",Signals:"Personal & Misc"};
        const records=[];
        for(const [organ,links] of Object.entries(groups)){
          if(!categories[organ]||!Array.isArray(links))throw new Error("Unknown reference group.");
          for(const [index,url] of links.entries()){
            if(!safeUrl(url))throw new Error("Shared reference URL is invalid.");
            const parsed=new URL(url),tail=decodeURIComponent(parsed.pathname.split("/").filter(Boolean).slice(-2).join(" / ")||parsed.hostname);
            records.push({url,title:tail.replace(/[-_]/g," ").slice(0,300),source:"shared",sourceRecordId:`conversation-2026-10-27:${organ}:${index+1}`,category:categories[organ],tags:[`cambium:${organ.toLowerCase()}`],collection:`Cambium · ${organ}`,contentCoverage:"URL only; linked page not reviewed",potentialUse:`Candidate reference for the ${organ} lane. Review the original before reuse.`});
          }
        }
        if(records.length>100)throw new Error("Shared reference list is too large.");
        const added=await upsert(records);
        const status={version:1,found:records.length,added,at:Date.now()};
        await chrome.storage.local.set({sharedReferenceImport:status});reply(status);break;
      }
      case "lib:prepare-personal": {
        const {personalCollection}=await chrome.storage.local.get("personalCollection");
        if(personalCollection?.version===1&&personalCollection.complete!==false&&!msg.force){reply(personalCollection);break;}
        const errors=[];let arc=[],chromeRecords=[],arcRead=null,chromeRead=null;
        try{const response=await fetch(chrome.runtime.getURL("personal-arc-export.md"));if(!response.ok)throw new Error("Export file unavailable");arc=parseArcMarkdown(await response.text());arcRead=arc.length;}catch(error){errors.push("Arc: "+error.message);}
        try{chromeRecords=await fetchChromeBookmarks();chromeRead=chromeRecords.length;}catch(error){errors.push("Chrome bookmarks: "+error.message);}
        const records=[...arc,...chromeRecords],added=await upsert(records);
        const lib=await getLibrary();let categorized=0;
        for(const r of records){const item=lib.items[itemId(r.url)];if(item&&!item.category){item.category=heuristicCategory(item);item.categorizedBy="heuristic";categorized++;}}
        await saveItems(lib.items);
        const status={version:1,complete:!errors.length,errors,at:Date.now(),arcRead,chromeRead,added,categorized};
        await chrome.storage.local.set({personalCollection:status});reply(status);break;
      }
      case "lib:import-arc": {
        const records=parseArcMarkdown(String(msg.markdown || ""));
        const added=await upsert(records); const cat=await categorizePending(); reply({found:records.length,added,...cat});break;
      }
      case "lib:import-field": {
        const records=fieldTheoryRecords(msg.snapshot);
        const added=await upsert(records);
        await chrome.storage.local.set({fieldTheoryImport:{at:Date.now(),generatedAt:msg.snapshot.generatedAt,counts:msg.snapshot.counts||{},found:records.length,added}});
        reply({found:records.length,added});break;
      }
      case "lib:group": {
        const lib=await getLibrary();const ids=[...new Set(msg.ids || [])].slice(0,12);
        const entries=ids.map(id=>lib.items[id]).filter(i=>i&&safeUrl(i.url));
        if(!entries.length)throw new Error("Choose at least one saved link.");
        const windowId=sender.tab?.windowId ?? (await chrome.windows.getCurrent()).id;
        const title=String(msg.name || "Working set").trim().slice(0,80);
        const existing=(await chrome.tabGroups.query({windowId})).find(g=>g.title===title);
        const opened=existing ? await chrome.tabs.query({groupId:existing.id}) : [];
        const groupKey=`${windowId}:${title}`;
        const {libraryGroupTabMap={}}=await chrome.storage.local.get('libraryGroupTabMap');
        const mapped=libraryGroupTabMap[groupKey]||{};
        const created=[],tabForItem={};
        const inGroup=new Set(opened.map(t=>t.id));
        let reused=0;
        try {
          for(const item of entries){
            const match=opened.find(t=>t.id===mapped[item.id]||[t.url,t.pendingUrl].some(url=>sameGroupUrl(url,item.url)));
            if(match&&inGroup.has(match.id)){tabForItem[item.id]=match.id;reused++;continue;}
            const tab=await chrome.tabs.create({url:item.url,active:false,windowId});created.push(tab);tabForItem[item.id]=tab.id;
          }
          const groupId=created.length ? await chrome.tabs.group({tabIds:created.map(t=>t.id),...(existing?{groupId:existing.id}:{createProperties:{windowId}})}) : existing.id;
          await chrome.tabGroups.update(groupId,{title,color:"green",collapsed:false});
          libraryGroupTabMap[groupKey]=tabForItem;
          const keys=Object.keys(libraryGroupTabMap);if(keys.length>100)for(const key of keys.slice(0,keys.length-100))delete libraryGroupTabMap[key];
          await chrome.storage.local.set({libraryGroupTabMap});
          const first=opened[0]||created[0];if(first)await chrome.tabs.update(first.id,{active:true});
          reply({opened:created.length,reused,groupName:title});
        }catch(error){if(created.length)await chrome.tabs.remove(created.map(t=>t.id)).catch(()=>{});throw error;}
        break;
      }
      case "lib:get": reply(await getLibrary()); break;
      case "lib:settings": await saveSettings(msg.settings); reply(true); break;
      case "lib:sync": try { reply({ ok: true, ...(await syncSource(msg.source)) }); } catch (e) { reply({ ok: false, error: e.message }); } break;
      case "lib:save": {
        if(!safeUrl(msg.item?.url))throw new Error("Use an HTTP or HTTPS link.");
        const id=itemId(msg.item.url),{libraryRemoved={},libraryTrash=[]}=await chrome.storage.local.get(["libraryRemoved","libraryTrash"]);
        const removed=libraryTrash.find(e=>e.item.id===id);
        if(libraryRemoved[id]){const lib=await getLibrary();if(removed)lib.items[id]=removed.item;delete libraryRemoved[id];await chrome.storage.local.set({items:lib.items,libraryRemoved,libraryTrash:libraryTrash.filter(e=>e.item.id!==id)});}
        const added=await upsert([msg.item]),lib=await getLibrary();
        if(lib.items[id]&&msg.item.source==="manual"){for(const key of ["note","collection"])if(typeof msg.item[key]==="string"&&msg.item[key].trim())lib.items[id][key]=msg.item[key].trim().slice(0,key==="note"?4000:100);await saveItems(lib.items);}
        const c=await categorizePending();reply({added,id,...c});break;
      }
      case "lib:categorize": try { reply(await categorizePending()); } catch (e) { reply({ error: e.message }); } break;
      case "lib:bulk": {
        const ids=[...new Set(Array.isArray(msg.ids)?msg.ids:[])];if(!ids.length||ids.length>500)throw new Error("Select between 1 and 500 saves.");
        const allowed=["category","clear-set","explore","unexplore","remove","restore"];
        if(!allowed.includes(msg.operation))throw new Error("Unknown bulk action.");
        const lib=await getLibrary(),{libraryTrash=[],libraryRemoved={}}=await chrome.storage.local.get(["libraryTrash","libraryRemoved"]);let changed=0,trash=libraryTrash;
        if(msg.operation==="restore"){
          for(const entry of libraryTrash)if(ids.includes(entry.item.id)&&!lib.items[entry.item.id]){lib.items[entry.item.id]=entry.item;delete libraryRemoved[entry.item.id];changed++;}
          trash=libraryTrash.filter(e=>!ids.includes(e.item.id));
        }else{
          const category=typeof msg.category==="string"?msg.category.trim().slice(0,80):"";
          if(msg.operation==="category"&&!category)throw new Error("Choose a category.");
          const removed=[];
          for(const id of ids){const item=lib.items[id];if(!item)continue;
            if(msg.operation==="category"){item.category=category;item.categorizedBy="user";}
            if(msg.operation==="clear-set")item.collection="";
            if(msg.operation==="explore")item.reviewedAt=item.reviewedAt||Date.now();
            if(msg.operation==="unexplore")item.reviewedAt=null;
            if(msg.operation==="remove"){removed.push({item,removedAt:Date.now()});libraryRemoved[id]=Date.now();delete lib.items[id];}
            changed++;
          }
          if(removed.length)trash=[...removed,...libraryTrash.filter(e=>!ids.includes(e.item.id))].slice(0,500);
        }
        await chrome.storage.local.set({items:lib.items,libraryTrash:trash,libraryRemoved});reply({changed});break;
      }
      case "lib:update": {
        const lib=await getLibrary();if(!lib.items[msg.id])throw new Error("This save is no longer in your Library.");
        const patch=msg.patch||{},allowed={};
        for(const [key,max] of [["category",80],["categorizedBy",40],["collection",100],["note",4000]])if(key in patch){if(typeof patch[key]!=="string")throw new Error("Invalid "+key);allowed[key]=patch[key].trim().slice(0,max);}
        if("pinned" in patch)allowed.pinned=!!patch.pinned;
        if("reviewedAt" in patch)allowed.reviewedAt=Number.isFinite(patch.reviewedAt)&&patch.reviewedAt>0?patch.reviewedAt:null;
        if("tags" in patch)allowed.tags=Array.isArray(patch.tags)?[...new Set(patch.tags.filter(t=>typeof t==="string").map(t=>t.trim().slice(0,60)).filter(Boolean))].slice(0,20):[];
        Object.assign(lib.items[msg.id],allowed);await saveItems(lib.items);reply(true);break;
      }
      case "lib:delete": {
        const lib=await getLibrary(),item=lib.items[msg.id];if(!item)throw new Error("This save was already removed.");
        const {libraryTrash=[],libraryRemoved={}}=await chrome.storage.local.get(["libraryTrash","libraryRemoved"]);libraryRemoved[item.id]=Date.now();
        await chrome.storage.local.set({libraryRemoved,libraryTrash:[{item,removedAt:Date.now()},...libraryTrash.filter(t=>t.item.id!==item.id)].slice(0,500)});
        delete lib.items[msg.id];await saveItems(lib.items);reply({removed:true,id:msg.id});break;
      }
      case "lib:restore": {
        const {libraryTrash=[],libraryRemoved={}}=await chrome.storage.local.get(["libraryTrash","libraryRemoved"]);const entry=libraryTrash.find(t=>t.item.id===msg.id);if(!entry)throw new Error("That save is no longer in the recent trash.");
        const lib=await getLibrary();lib.items[entry.item.id]=entry.item;await saveItems(lib.items);delete libraryRemoved[msg.id];await chrome.storage.local.set({libraryRemoved,libraryTrash:libraryTrash.filter(t=>t.item.id!==msg.id)});reply(true);break;
      }
      case "lib:recategorize": { const lib = await getLibrary(); for (const it of Object.values(lib.items)) if (msg.all || it.categorizedBy === "heuristic") it.category = null; await saveItems(lib.items); reply(await categorizePending()); break; }
      case "lib:ask": try { reply(await askLibrary(msg.q, (await getLibrary()).settings)); } catch (e) { reply({ error: e.message }); } break;
      case "lib:open": await openLibrary(); reply(true); break;
      default:throw new Error('Unsupported Library action: '+msg.type);
 }};
 const mutates=!["lib:get","lib:project-review-queue","lib:fit-index","lib:ask","lib:open","lib:capabilities"].includes(msg.type);
 if(mutates)await withLibraryWrite(handle);else await handle();
 return response;
}
async function openLibrary(){const url=chrome.runtime.getURL('library.html'),tabs=await chrome.tabs.query({}),existing=tabs.find(t=>t.url?.startsWith(url));if(existing)await chrome.tabs.update(existing.id,{active:true});else await chrome.tabs.create({url});}
