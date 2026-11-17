import './companion-worker.js';
import {runLibraryRequest} from "./library-service.js";
import {refreshProjectFitIndex} from "./project-fit.js";
import { safeUrl } from "./library-model.js";
import { getState, setState, originOf, fuzzy, DEFAULT_STATE } from "./shared.js";
import { getLibrary, saveSettings, syncSource, upsert, categorizePending, askLibrary, saveItems, log, withLibraryWrite, parseArcMarkdown, fetchChromeBookmarks, heuristicCategory, itemId } from "./library.js";

// Chrome owns the browser UI. This companion opens only a saved-links Library.
async function openLibrary(suffix = "") {
  const url = chrome.runtime.getURL("library.html");
  const existing = (await chrome.tabs.query({})).find(t=>t.url?.startsWith(url));
  if (existing) { await chrome.tabs.update(existing.id,{active:true,...(suffix ? {url:url+suffix} : {})}); await chrome.windows.update(existing.windowId,{focused:true}); }
  else await chrome.tabs.create({url:url+suffix});
}
chrome.action.onClicked.addListener(()=>openLibrary());


chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get("spaces");
  if (!cur.spaces) await chrome.storage.local.set({ spaces: DEFAULT_STATE.spaces, activeSpace: "personal", archiveHours: 12, archived: [], boosts: {} });
  chrome.alarms.create("archive-sweep", { periodInMinutes: 15 });
  chrome.alarms.create("library-sync", { periodInMinutes: 60 });
  chrome.alarms.create("library-fit-review", { periodInMinutes: 60 });
  await chrome.contextMenus?.removeAll();
  chrome.contextMenus?.create({ id: "save-to-library", title: "Save to Library", contexts: ["page", "link"] });
  chrome.contextMenus?.create({ id: "site-boost", title: "Customize this site (Boost)", contexts: ["page"], documentUrlPatterns:["http://*/*","https://*/*"] });
  // Assign all existing tabs to the active space
  const st = await getState();
  const tabs = await chrome.tabs.query({});
  const tabSpace = { ...st.tabSpace }, tabSeen = { ...st.tabSeen };
  for (const t of tabs) { tabSpace[t.id] ??= st.activeSpace; tabSeen[t.id] ??= Date.now(); }
  await setState({ tabSpace, tabSeen });
});

// ---- Tab bookkeeping: which space a tab belongs to, when it was last seen ----
chrome.tabs.onCreated.addListener(async (tab) => {
  const st = await getState();
  await setState({ tabSpace: { ...st.tabSpace, [tab.id]: st.activeSpace }, tabSeen: { ...st.tabSeen, [tab.id]: Date.now() } });
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const st = await getState();
  const tabSeen = { ...st.tabSeen, [tabId]: Date.now() };
  const tabSpace = { ...st.tabSpace };
  tabSpace[tabId] ??= st.activeSpace;
  await setState({ tabSeen, tabSpace });
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const st = await getState();
  const tabSpace = { ...st.tabSpace }, tabSeen = { ...st.tabSeen };
  delete tabSpace[tabId]; delete tabSeen[tabId];
  await setState({ tabSpace, tabSeen });
});

// ---- Auto-archive: Arc's "Today" tabs disappear after N hours ----
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === "archive-sweep") await sweep();
  if (a.name === "library-fit-review") { try { await withLibraryWrite(refreshProjectFitIndex); } catch (error) { await log("field-report-fit","error",error.message); } }
  if (a.name === "library-sync") {
    const lib = await getLibrary(); if (!lib.settings.autoSync) return;
    for (const k of ["chrome", "github"]) { try { await withLibraryWrite(()=>syncSource(k)); } catch {} }   // silent sources only; X/Reddit/IG open tabs, so they stay manual
  }
});
chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "site-boost") { await openLibrary("?boost="+tab.id); return; }
  if (info.menuItemId !== "save-to-library") return;
  await withLibraryWrite(async()=>{ await upsert([{ url: info.linkUrl || info.pageUrl, title: info.linkUrl ? info.linkUrl : tab?.title, source: "manual" }]);
  await categorizePending(); });
});

async function sweep() {
  const st = await getState();
  if (!st.autoArchive) return;
  const cutoff = Date.now() - st.archiveHours * 3600e3;
  const tabs = await chrome.tabs.query({ pinned: false, active: false, audible: false, groupId: -1 });
  const pinnedUrls = new Set(st.spaces.flatMap(s => s.pinned.map(p => p.url)));
  const archived = [...st.archived];
  for (const t of tabs) {
    const seen = st.tabSeen[t.id] ?? Date.now();
    if (seen < cutoff && !pinnedUrls.has(t.url) && /^https?:/.test(t.url || "")) {
      const record = {url:t.url,title:t.title,spaceId:st.tabSpace[t.id] || st.activeSpace,at:Date.now()};
      // Persist the restore record before closing the tab.
      archived.unshift(record);
      await setState({archived:archived.slice(0,500)});
      try { await chrome.tabs.remove(t.id); } catch { archived.shift(); }
    }
  }
  await setState({ archived: archived.slice(0, 500) });
}

// ---- Keyboard commands ----
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd === "command-bar") {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active) return;
    try { await chrome.tabs.sendMessage(active.id, { type: "toggle-command-bar" }); }
    catch { await openLibrary("#search"); }
  } else if (cmd === "open-library") {
    await openLibrary();
  } else if (cmd === "save-library") {
    const [active] = await chrome.tabs.query({active:true,currentWindow:true});
    if (active && /^https?:/.test(active.url || "")) await withLibraryWrite(async()=>{ await upsert([{url:active.url,title:active.title,source:"manual"}]); await categorizePending(); });
  } else if (cmd === "next-space") {
    const groups = await chrome.tabGroups.query({windowId:chrome.windows.WINDOW_ID_CURRENT});
    const [active] = await chrome.tabs.query({active:true,currentWindow:true});
    const next = groups[(groups.findIndex(g=>g.id===active?.groupId)+1)%groups.length];
    if(next) { await chrome.tabGroups.update(next.id,{collapsed:false}); const [tab] = await chrome.tabs.query({groupId:next.id}); if(tab) await chrome.tabs.update(tab.id,{active:true}); }
  }
});

// ---- Message API for side panel + content scripts ----
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if(msg.type?.startsWith("companion:"))return false;
  const handle = async () => {
    if (sender.tab && !sender.url?.startsWith(chrome.runtime.getURL("")) && msg.type?.startsWith("lib:") && msg.type !== "lib:save") throw new Error("Library settings are only available in the Library tab");
    if(msg.type?.startsWith('lib:')){reply(await runLibraryRequest(msg,sender));return;}
    switch (msg.type) {
      case "search": reply(await search(msg.q)); break;
      case "get-boost": reply((await getState()).boosts[originOf(sender.tab?.url || msg.url)] || null); break;
      case "set-boost": {
        const st = await getState(); const boosts = { ...st.boosts };
        if (msg.boost) boosts[msg.origin] = msg.boost; else delete boosts[msg.origin];
        await setState({ boosts });
        const tabs = await chrome.tabs.query({ url: msg.origin + "/*" });
        for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: "apply-boost", boost: msg.boost }).catch(() => {});
        reply(true); break;
      }
      case "open": {
        if (msg.tabId) { await chrome.tabs.update(msg.tabId, { active: true }); const t = await chrome.tabs.get(msg.tabId); await chrome.windows.update(t.windowId, { focused: true }); }
        else if (safeUrl(msg.url)) await chrome.tabs.create({ url:safeUrl(msg.url),...(sender.tab?.windowId?{windowId:sender.tab.windowId}:{}) });
        else throw new Error("Use an HTTP or HTTPS link.");
        reply(true); break;
      }
      case "sweep": await sweep(); reply(true); break;
      default: reply(null);
    }
  };
  handle().catch(e => reply({error:e.message}));
  return true;
});

async function search(q) {
  const st = await getState();
  const out = [];
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    const s = Math.max(fuzzy(q, t.title), fuzzy(q, t.url) * 0.9);
    if (s) out.push({ kind: "tab", score: s + 2, title: t.title, url: t.url, tabId: t.id, space: st.spaces.find(x => x.id === st.tabSpace[t.id])?.emoji });
  }
  if (q.length > 1) {
    const [hist, bms] = await Promise.all([
      chrome.history.search({ text: q, maxResults: 15, startTime: 0 }),
      chrome.bookmarks.search(q)
    ]);
    for (const h of hist) { const s = Math.max(fuzzy(q, h.title), fuzzy(q, h.url) * 0.9); if (s) out.push({ kind: "history", score: s + Math.min(1, (h.visitCount || 1) / 20), title: h.title || h.url, url: h.url }); }
    for (const b of bms.slice(0, 10)) if (b.url) out.push({ kind: "bookmark", score: fuzzy(q, b.title) + 1, title: b.title, url: b.url });
  }
  out.sort((a, b) => b.score - a.score);
  const seen = new Set(); const dedup = [];
  for (const r of out) { const k = r.kind === "tab" ? "t" + r.tabId : r.url; if (!seen.has(k)) { seen.add(k); dedup.push(r); } }
  if (q) {
    const looksUrl = /^(https?:\/\/|[\w-]+\.[a-z]{2,})/i.test(q);
    dedup.push(looksUrl
      ? { kind: "url", score: 0, title: "Open " + q, url: q.startsWith("http") ? q : "https://" + q }
      : { kind: "search", score: 0, title: `Search Google for “${q}”`, url: "https://www.google.com/search?q=" + encodeURIComponent(q) });
  }
  return dedup.slice(0, 12);
}
