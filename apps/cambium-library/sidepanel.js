import { getState, setState, THEMES, themeFor, faviconUrl, originOf } from "./shared.js";

const $ = (s) => document.querySelector(s);
let state, tabs = [], activeTab = null, winId = null;

async function refresh() {
  state = await getState();
  const win = await chrome.windows.getCurrent();
  winId = win.id;
  tabs = await chrome.tabs.query({ windowId: winId });
  activeTab = tabs.find(t => t.active) || null;
  render();
}

function render() {
  const space = state.spaces.find(s => s.id === state.activeSpace) || state.spaces[0];
  const th = themeFor(space.theme);
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.style.setProperty("--c1", dark ? th.dark1 : th.c1);
  document.documentElement.style.setProperty("--c2", dark ? th.dark2 : th.c2);

  // URL pill
  if (activeTab) { $("#url-text").textContent = prettyUrl(activeTab.url); $("#url-fav").src = activeTab.url?.startsWith("http") ? faviconUrl(activeTab.url) : ""; }

  // Favorites grid
  const fav = $("#favorites"); fav.innerHTML = "";
  for (const f of space.favorites) {
    const live = tabs.find(t => sameSite(t.url, f.url));
    const el = document.createElement("div"); el.className = "fav-tile" + (live ? " live" : ""); el.title = f.title || f.url;
    el.innerHTML = `<img src="${faviconUrl(f.url, 64)}" alt=""><span class="x" title="Remove favorite">×</span>`;
    el.onclick = (e) => { if (e.target.classList.contains("x")) return removeFav(space, f); live ? chrome.tabs.update(live.id, { active: true }) : chrome.tabs.create({ url: f.url }); };
    el.ondragover = (e) => { e.preventDefault(); }; el.ondrop = onDropToFavorites(space);
    fav.appendChild(el);
  }
  if (space.favorites.length < 8) { const add = document.createElement("div"); add.className = "fav-tile"; add.innerHTML = `<span style="opacity:.5;font-size:18px">+</span>`; add.title = "Add current page to favorites (or drop a tab here)"; add.onclick = () => activeTab && addFav(space, activeTab); add.ondragover = (e) => { e.preventDefault(); add.classList.add("drop-target"); }; add.ondragleave = () => add.classList.remove("drop-target"); add.ondrop = onDropToFavorites(space); fav.appendChild(add); }

  // Pinned tabs (Arc: persistent, stays even when closed; opens on click)
  const pinned = $("#pinned"); pinned.innerHTML = "";
  for (const p of space.pinned) {
    const live = tabs.find(t => sameSite(t.url, p.url));
    const el = tabRow({ title: p.title || p.url, url: p.url, id: live?.id, active: live && live.active, pinnedRow: true, stale: !live, audible: live?.audible });
    el.onclick = (e) => { if (e.target.closest(".close")) return; live ? chrome.tabs.update(live.id, { active: true }) : chrome.tabs.create({ url: p.url }); };
    el.querySelector(".close").onclick = () => unpin(space, p);
    el.querySelector(".close").title = "Unpin";
    pinned.appendChild(el);
  }
  pinned.ondragover = (e) => { e.preventDefault(); pinned.classList.add("drop-target"); }; pinned.ondragleave = () => pinned.classList.remove("drop-target");
  pinned.ondrop = (e) => { e.preventDefault(); pinned.classList.remove("drop-target"); const id = +e.dataTransfer.getData("text/tab"); const t = tabs.find(x => x.id === id); if (t) pin(space, t); };

  // Today
  const today = $("#today"); today.innerHTML = "";
  const pinnedUrls = new Set(space.pinned.map(p => p.url));
  const todayTabs = tabs.filter(t => !t.pinned && (state.tabSpace[t.id] || state.activeSpace) === space.id && !pinnedUrls.has(t.url) && ![...pinnedUrls].some(u => sameSite(t.url, u)));
  if (!todayTabs.length) today.innerHTML = `<div class="empty">No open tabs in ${space.name}. Press ⌘T or + to start.</div>`;
  for (const t of todayTabs) {
    const el = tabRow({ title: t.title || prettyUrl(t.url), url: t.url, id: t.id, active: t.active, audible: t.audible, muted: t.mutedInfo?.muted });
    el.onclick = (e) => { if (e.target.closest(".close")) return; chrome.tabs.update(t.id, { active: true }); };
    el.querySelector(".close").onclick = () => chrome.tabs.remove(t.id);
    el.oncontextmenu = (e) => { e.preventDefault(); pin(space, t); };
    el.title = "Right-click to pin";
    today.appendChild(el);
  }

  // Space dots
  const dots = $("#dots"); dots.innerHTML = "";
  for (const s of state.spaces) {
    const b = document.createElement("button"); b.className = "dot" + (s.id === state.activeSpace ? " active" : ""); b.textContent = s.emoji; b.title = s.name + " (double-click to edit)";
    b.onclick = () => setState({ activeSpace: s.id });
    b.ondblclick = () => openSpaceSheet(s);
    dots.appendChild(b);
  }
}

function tabRow({ title, url, id, active, pinnedRow, stale, audible, muted }) {
  const el = document.createElement("div");
  el.className = "tab" + (active ? " active" : "") + (pinnedRow ? " pinned" : "") + (stale ? " stale" : "");
  el.draggable = !!id;
  el.innerHTML = `<img class="fav" src="${url?.startsWith("http") ? faviconUrl(url) : ""}" alt=""><span class="title">${esc(title)}</span>${audible ? `<span class="audio">${muted ? "🔇" : "🔊"}</span>` : ""}<span class="close" title="Close">×</span>`;
  if (id) { el.ondragstart = (e) => { e.dataTransfer.setData("text/tab", String(id)); el.classList.add("dragging"); }; el.ondragend = () => el.classList.remove("dragging"); }
  return el;
}

const onDropToFavorites = (space) => (e) => { e.preventDefault(); const id = +e.dataTransfer.getData("text/tab"); const t = tabs.find(x => x.id === id); if (t) addFav(space, t); };
async function addFav(space, t) { if (!t.url?.startsWith("http") || space.favorites.some(f => sameSite(f.url, t.url))) return; space.favorites.push({ url: originOf(t.url) + "/", title: new URL(t.url).hostname }); await setState({ spaces: state.spaces }); }
async function removeFav(space, f) { space.favorites = space.favorites.filter(x => x !== f); await setState({ spaces: state.spaces }); }
async function pin(space, t) { if (!t.url?.startsWith("http") || space.pinned.some(p => p.url === t.url)) return; space.pinned.push({ url: t.url, title: t.title }); await setState({ spaces: state.spaces }); }
async function unpin(space, p) { space.pinned = space.pinned.filter(x => x !== p); await setState({ spaces: state.spaces }); }

function sameSite(a, b) { try { return a && b && new URL(a).origin === new URL(b).origin && (new URL(b).pathname === "/" || a.split("#")[0] === b.split("#")[0]); } catch { return false; } }
function prettyUrl(u) { try { const x = new URL(u); return x.hostname.replace(/^www\./, "") + (x.pathname !== "/" ? x.pathname : ""); } catch { return u || ""; } }
function esc(s) { return (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---- Top bar ----
$("#back").onclick = () => activeTab && chrome.tabs.goBack(activeTab.id).catch(() => {});
$("#fwd").onclick = () => activeTab && chrome.tabs.goForward(activeTab.id).catch(() => {});
$("#reload").onclick = () => activeTab && chrome.tabs.reload(activeTab.id);
$("#newtab").onclick = () => openSearch();
$("#urlpill").onclick = () => openSearch(activeTab?.url);
$("#clear").onclick = async () => { const space = state.spaces.find(s => s.id === state.activeSpace); const pinnedUrls = new Set(space.pinned.map(p => p.url)); const ids = tabs.filter(t => !t.pinned && (state.tabSpace[t.id] || state.activeSpace) === space.id && !pinnedUrls.has(t.url) && !t.active).map(t => t.id); const archived = [...state.archived]; for (const id of ids) { const t = tabs.find(x => x.id === id); archived.unshift({ url: t.url, title: t.title, spaceId: space.id, at: Date.now() }); } await setState({ archived: archived.slice(0, 500) }); if (ids.length) chrome.tabs.remove(ids); };
$("#add-space").onclick = () => openSpaceSheet(null);
$("#archive-btn").onclick = openArchive;
$("#boost").onclick = openBoost;
// Library shortcut lives on the archive button's neighbor: long-press archive = library
$("#archive-btn").oncontextmenu = (e) => { e.preventDefault(); chrome.runtime.sendMessage({ type: "lib:open" }); };
const libBtn = document.createElement("button"); libBtn.className = "icon-btn"; libBtn.id = "library-btn"; libBtn.title = "Library (AI bookmarks)"; libBtn.textContent = "◈"; libBtn.onclick = () => chrome.runtime.sendMessage({ type: "lib:open" });
$("#archive-btn").after(libBtn);

// ---- Search sheet ----
let results = [], sel = 0;
function openSearch(prefill = "") { $("#search-sheet").classList.remove("hidden"); const i = $("#search"); i.value = prefill || ""; i.focus(); i.select(); runSearch(); }
function closeSheets() { document.querySelectorAll(".sheet").forEach(s => s.classList.add("hidden")); }
$("#search").oninput = runSearch;
async function runSearch() {
  const q = $("#search").value.trim();
  results = await chrome.runtime.sendMessage({ type: "search", q }) || []; sel = 0;
  const ul = $("#results"); ul.innerHTML = "";
  results.forEach((r, i) => { const li = document.createElement("li"); li.className = i === sel ? "sel" : ""; li.innerHTML = `<img class="fav" src="${r.url?.startsWith("http") ? faviconUrl(r.url) : ""}" alt=""><div class="t">${esc(r.title)}<div class="u">${esc(r.url)}</div></div><span class="kind">${r.space || ""} ${r.kind}</span>`; li.onclick = () => choose(r); ul.appendChild(li); });
}
function choose(r) { chrome.runtime.sendMessage({ type: "open", tabId: r.tabId, url: r.tabId ? undefined : r.url }); closeSheets(); }
$("#search").onkeydown = (e) => {
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, results.length - 1); } else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); }
  else if (e.key === "Enter") { if (results[sel]) choose(results[sel]); return; } else if (e.key === "Escape") { closeSheets(); return; } else return;
  e.preventDefault(); [...$("#results").children].forEach((li, i) => li.classList.toggle("sel", i === sel));
};
document.querySelectorAll(".sheet").forEach(s => s.addEventListener("click", (e) => { if (e.target === s) closeSheets(); }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheets(); if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); } });
chrome.runtime.onMessage.addListener((m) => { if (m.type === "focus-search") openSearch(); });

// ---- Space sheet ----
let editing = null, chosenTheme = "lavender";
function openSpaceSheet(space) {
  editing = space; chosenTheme = space?.theme || THEMES[Math.floor(Math.random() * THEMES.length)].id;
  $("#space-sheet-title").textContent = space ? "Edit space" : "New space";
  $("#sp-name").value = space?.name || ""; $("#sp-emoji").value = space?.emoji || "✨";
  $("#sp-delete").style.visibility = space && state.spaces.length > 1 ? "visible" : "hidden";
  const g = $("#theme-grid"); g.innerHTML = "";
  for (const t of THEMES) { const d = document.createElement("div"); d.className = "swatch" + (t.id === chosenTheme ? " sel" : ""); d.style.background = `linear-gradient(135deg, ${t.c1}, ${t.c2})`; d.onclick = () => { chosenTheme = t.id; [...g.children].forEach(c => c.classList.remove("sel")); d.classList.add("sel"); }; g.appendChild(d); }
  $("#space-sheet").classList.remove("hidden"); $("#sp-name").focus();
}
$("#sp-cancel").onclick = closeSheets;
$("#sp-save").onclick = async () => {
  const name = $("#sp-name").value.trim() || "Space", emoji = $("#sp-emoji").value.trim() || "✨";
  if (editing) Object.assign(editing, { name, emoji, theme: chosenTheme });
  else { const id = "s" + Date.now().toString(36); state.spaces.push({ id, name, emoji, theme: chosenTheme, favorites: [], pinned: [] }); state.activeSpace = id; }
  await setState({ spaces: state.spaces, activeSpace: state.activeSpace }); closeSheets();
};
$("#sp-delete").onclick = async () => { state.spaces = state.spaces.filter(s => s !== editing); if (state.activeSpace === editing.id) state.activeSpace = state.spaces[0].id; await setState({ spaces: state.spaces, activeSpace: state.activeSpace }); closeSheets(); };

// ---- Boost sheet ----
let boostOrigin = null;
async function openBoost() {
  if (!activeTab?.url?.startsWith("http")) return;
  boostOrigin = originOf(activeTab.url); $("#boost-origin").textContent = new URL(boostOrigin).hostname;
  const b = state.boosts[boostOrigin] || {};
  $("#b-hue").value = b.hue ?? 0; $("#b-sat").value = b.sat ?? 100; $("#b-bright").value = b.bright ?? 100; $("#b-invert").checked = !!b.invert; $("#b-font").value = b.font || ""; $("#b-css").value = b.css || "";
  $("#boost-sheet").classList.remove("hidden");
}
function readBoost() { return { hue: +$("#b-hue").value, sat: +$("#b-sat").value, bright: +$("#b-bright").value, invert: $("#b-invert").checked, font: $("#b-font").value, css: $("#b-css").value }; }
const liveBoost = () => activeTab && chrome.tabs.sendMessage(activeTab.id, { type: "apply-boost", boost: readBoost() }).catch(() => {});
["#b-hue", "#b-sat", "#b-bright", "#b-invert", "#b-font"].forEach(s => $(s).oninput = liveBoost);
$("#b-save").onclick = async () => { await chrome.runtime.sendMessage({ type: "set-boost", origin: boostOrigin, boost: readBoost() }); closeSheets(); };
$("#b-remove").onclick = async () => { await chrome.runtime.sendMessage({ type: "set-boost", origin: boostOrigin, boost: null }); closeSheets(); };
$("#b-cancel").onclick = () => { chrome.tabs.sendMessage(activeTab.id, { type: "apply-boost", boost: state.boosts[boostOrigin] || null }).catch(() => {}); closeSheets(); };

// ---- Archive sheet ----
function openArchive() {
  const ul = $("#archive-list"); ul.innerHTML = "";
  if (!state.archived.length) ul.innerHTML = `<div class="empty">Nothing archived yet. Today tabs auto-archive after ${state.archiveHours}h.</div>`;
  for (const a of state.archived.slice(0, 100)) { const li = document.createElement("li"); li.innerHTML = `<img class="fav" src="${a.url?.startsWith("http") ? faviconUrl(a.url) : ""}" alt=""><div class="t">${esc(a.title || a.url)}<div class="u">${esc(a.url)} · ${timeAgo(a.at)}</div></div>`; li.onclick = () => { chrome.tabs.create({ url: a.url }); closeSheets(); }; ul.appendChild(li); }
  $("#archive-sheet").classList.remove("hidden");
}
$("#archive-close").onclick = closeSheets;
function timeAgo(t) { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + "m ago" : m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"; }

// ---- Live updates ----
for (const ev of [chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated, chrome.tabs.onActivated, chrome.tabs.onMoved]) ev.addListener(() => refresh());
chrome.storage.onChanged.addListener(() => refresh());
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
refresh();
