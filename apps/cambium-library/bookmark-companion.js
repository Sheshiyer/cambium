import {itemId,upsert,withLibraryWrite} from './library.js';
import {safeUrl} from './library-model.js';
export const fingerprint=n=>JSON.stringify([n.id,n.parentId,n.index,n.title,n.url]);
export async function reconcileBookmarks(){return withLibraryWrite(async()=>{
 const tree=await chrome.bookmarks.getTree(),nodes=[];const walk=n=>{if(n.url&&safeUrl(n.url))nodes.push(n);for(const c of n.children||[])walk(c);};tree.forEach(walk);
 let {libraryDeviceId,bookmarkBindings={}}=await chrome.storage.local.get(['libraryDeviceId','bookmarkBindings']);if(!libraryDeviceId){libraryDeviceId=crypto.randomUUID();await chrome.storage.local.set({libraryDeviceId});}
 const next={...bookmarkBindings};for(const[k,b]of Object.entries(next))if(b.deviceId===libraryDeviceId)next[k]={...b,present:false};
 for(const n of nodes)next[libraryDeviceId+':'+n.id]={deviceId:libraryDeviceId,nodeId:n.id,itemId:itemId(n.url),url:n.url,title:n.title,parentId:n.parentId,index:n.index,fingerprint:fingerprint(n),present:true};
 await upsert(nodes.map(n=>({url:n.url,title:n.title,source:'chrome',sourceRecordId:libraryDeviceId+':'+n.id,contentCoverage:'Bookmark title and URL only'})));
 await chrome.storage.local.set({bookmarkBindings:next});return{count:nodes.length};
 });}
export async function bookmarkAction(msg){
 const {libraryDeviceId,bookmarkBindings={}}=await chrome.storage.local.get(['libraryDeviceId','bookmarkBindings']);
 if(msg.action==='list'){const folders=[];const walk=(n,path=[])=>{if(!n.url&&n.id!=='0')folders.push({id:n.id,title:[...path,n.title].filter(Boolean).join(' / ')});for(const c of n.children||[])walk(c,[...path,n.title].filter(Boolean));};(await chrome.bookmarks.getTree()).forEach(n=>walk(n));return{deviceId:libraryDeviceId,bindings:Object.values(bookmarkBindings).filter(b=>b.deviceId===libraryDeviceId&&b.present&&(!msg.itemId||b.itemId===msg.itemId)),folders};}
 if(msg.action==='create'){if(!safeUrl(msg.url))throw Error('Invalid bookmark URL');const parent=(await chrome.bookmarks.get(String(msg.parentId)))[0];if(!parent||parent.url||parent.id==='0')throw Error('Choose a bookmark folder');const n=await chrome.bookmarks.create({parentId:parent.id,url:msg.url,title:String(msg.title||msg.url).slice(0,300)});await reconcileBookmarks();return{id:n.id};}
 if(!['edit','move','delete'].includes(msg.action))throw Error('Unknown bookmark action');
 if(!Array.isArray(msg.targets)||msg.targets.length<1||msg.targets.length>50)throw Error('Choose 1–50 original bookmarks');
 const nodes=[];for(const target of msg.targets){if(target.deviceId!==libraryDeviceId)throw Error('Bookmark belongs to another Chrome profile');const n=(await chrome.bookmarks.get(String(target.nodeId)))[0];if(!n?.url||fingerprint(n)!==target.fingerprint)throw Error('Original bookmark changed. Refresh the preview before applying.');nodes.push(n);}
 if(msg.action==='delete'&&msg.confirmed!==true)throw Error('Confirm the original bookmark deletion');
 const result={completed:[],failed:[]};
 for(const n of nodes)try{
 // Check again immediately before each side effect, including index changes caused by earlier deletes.
 const current=(await chrome.bookmarks.get(n.id))[0];if(!current||current.url!==n.url||current.title!==n.title||current.parentId!==n.parentId)throw Error('Bookmark changed during operation');
 if(msg.action==='delete')await chrome.bookmarks.remove(n.id);
 if(msg.action==='edit'){if(msg.url&&!safeUrl(msg.url))throw Error('Invalid URL');await chrome.bookmarks.update(n.id,{title:String(msg.title??n.title).slice(0,300),url:msg.url||n.url});}
 if(msg.action==='move'){const p=(await chrome.bookmarks.get(String(msg.parentId)))[0];if(p.url||p.id==='0')throw Error('Choose a bookmark folder');await chrome.bookmarks.move(n.id,{parentId:p.id});}
 result.completed.push(n);
 }catch(e){result.failed.push({id:n.id,error:e.message});}
 if(msg.action==='delete'&&result.completed.length){const {bookmarkDeleteHistory=[]}=await chrome.storage.local.get('bookmarkDeleteHistory');await chrome.storage.local.set({bookmarkDeleteHistory:[{at:Date.now(),nodes:result.completed},...bookmarkDeleteHistory].slice(0,50)});}
 await reconcileBookmarks();return result;
}
