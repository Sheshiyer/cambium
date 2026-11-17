// Shared data model + helpers (used by background and side panel)
export const THEMES = [
  { id: "lavender", c1: "#c7b8ff", c2: "#ffd1e8", dark1: "#2b2140", dark2: "#3a2a4a" },
  { id: "ocean",    c1: "#9ad8ff", c2: "#c6f2e4", dark1: "#102a3a", dark2: "#163b45" },
  { id: "sunset",   c1: "#ffc3a0", c2: "#ffafbd", dark1: "#3a1f1a", dark2: "#4a2630" },
  { id: "mint",     c1: "#b8f0c8", c2: "#e4f5a8", dark1: "#17301f", dark2: "#243a1c" },
  { id: "peach",    c1: "#ffe0b5", c2: "#ffc6ff", dark1: "#3a2a16", dark2: "#3a2040" },
  { id: "slate",    c1: "#d6dbe4", c2: "#eef1f6", dark1: "#1e2229", dark2: "#2a2f38" },
  { id: "lemon",    c1: "#fff0a8", c2: "#c8f7d6", dark1: "#3a3214", dark2: "#1c3a2a" },
  { id: "rose",     c1: "#ffb7c5", c2: "#c9b6ff", dark1: "#3d1a2a", dark2: "#2a1a40" }
];

export const DEFAULT_STATE = {
  spaces: [
    { id: "personal", name: "Personal", emoji: "🏠", theme: "lavender", favorites: [], pinned: [] },
    { id: "work",     name: "Work",     emoji: "💼", theme: "ocean",    favorites: [], pinned: [] }
  ],
  activeSpace: "personal",
  archiveHours: 12,
  autoArchive: false,
  archived: [],          // { url, title, favIconUrl, spaceId, at }
  boosts: {},            // origin -> { hue, sat, bright, invert, font, css }
  tabSpace: {},          // tabId -> spaceId (persisted in session storage)
  tabSeen: {}            // tabId -> last active timestamp
};

export async function getState() {
  const s = await chrome.storage.local.get(null);
  const sess = await chrome.storage.session.get(["tabSpace", "tabSeen"]);
  return { ...structuredClone(DEFAULT_STATE), ...s, tabSpace: sess.tabSpace || {}, tabSeen: sess.tabSeen || {} };
}

export async function setState(patch) {
  const { tabSpace, tabSeen, ...rest } = patch;
  if (Object.keys(rest).length) await chrome.storage.local.set(rest);
  const sess = {};
  if (tabSpace) sess.tabSpace = tabSpace;
  if (tabSeen) sess.tabSeen = tabSeen;
  if (Object.keys(sess).length) await chrome.storage.session.set(sess);
}

export function themeFor(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }

export function originOf(url) { try { return new URL(url).origin; } catch { return null; } }

export function faviconUrl(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", String(size));
  return u.href;
}

// Lightweight fuzzy scorer: subsequence match with bonuses for word starts
export function fuzzy(query, text) {
  if (!query) return 1;
  query = query.toLowerCase(); text = (text || "").toLowerCase();
  let qi = 0, score = 0, lastIdx = -2;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      score += (i === lastIdx + 1 ? 3 : 1) + (i === 0 || /[\s\/\.\-_]/.test(text[i - 1]) ? 2 : 0);
      lastIdx = i; qi++;
    }
  }
  if (qi < query.length) return 0;
  return score / (1 + text.length / 40);
}
