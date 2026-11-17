// Arcify content script: in-page command bar (⌘K) + per-site Boosts + "Save to Library" chord
(() => {
  if (window.__arcify) return; window.__arcify = true;
  const ORIGIN = location.origin;

  // ---------- Boosts ----------
  let styleEl = null;
  function applyBoost(b) {
    if (!b) { styleEl?.remove(); styleEl = null; return; }
    styleEl ??= document.documentElement.appendChild(Object.assign(document.createElement("style"), { id: "arcify-boost" }));
    const filters = [];
    if (b.hue) filters.push(`hue-rotate(${b.hue}deg)`);
    if (b.sat != null && b.sat !== 100) filters.push(`saturate(${b.sat / 100})`);
    if (b.bright != null && b.bright !== 100) filters.push(`brightness(${b.bright / 100})`);
    if (b.invert) filters.push("invert(1) hue-rotate(180deg)");
    styleEl.textContent = `
      ${filters.length ? `html { filter: ${filters.join(" ")} !important; background: #fff; }` : ""}
      ${b.invert ? `img, video, picture, canvas, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }` : ""}
      ${b.font ? `html, body, body * { font-family: "${b.font}", system-ui, sans-serif !important; }` : ""}
      ${b.css || ""}`;
  }
  chrome.runtime.sendMessage({ type: "get-boost", url: location.href }).then(applyBoost).catch(() => {});

  // ---------- Command bar ----------
  let host = null, shadow = null, input = null, list = null, results = [], sel = 0;
  function ensureBar() {
    if (host) return;
    host = document.createElement("arcify-bar"); host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;display:none";
    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      :host{all:initial}
      .scrim{position:fixed;inset:0;background:rgba(10,8,20,.25);backdrop-filter:blur(8px);display:flex;justify-content:center;align-items:flex-start;padding-top:14vh;font-family:-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;animation:in .14s ease}
      @media(prefers-reduced-motion:reduce){.scrim{animation:none}}
      @keyframes in{from{opacity:0;transform:translateY(8px)}}
      .card{width:min(680px,92vw);background:rgba(250,248,255,.92);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.4) inset;overflow:hidden}
      @media(prefers-color-scheme:dark){.card{background:rgba(30,28,42,.94);color:#eee}}
      input{all:unset;display:block;width:100%;box-sizing:border-box;padding:18px 20px;font-size:20px;color:inherit}
      input::placeholder{color:rgba(120,116,140,.7)}
      ul{list-style:none;margin:0;padding:6px;border-top:1px solid rgba(120,116,140,.15);max-height:52vh;overflow:auto}
      li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;font-size:14px}
      li.sel{background:rgba(120,110,200,.16)}
      img{width:18px;height:18px;border-radius:4px}
      .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .u{font-size:11px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .k{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.5}
      .hint{display:flex;gap:14px;padding:8px 16px;font-size:11px;opacity:.55;border-top:1px solid rgba(120,116,140,.15)}
      kbd{font:inherit;padding:1px 5px;border-radius:4px;background:rgba(120,116,140,.15)}
    </style>
    <div class="scrim"><div class="card"><input placeholder="Search tabs, history, bookmarks — or type a URL" spellcheck="false"><ul></ul>
    <div class="hint"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>⇧↵</kbd> save to Library</span><span><kbd>esc</kbd> close</span></div></div></div>`;
    input = shadow.querySelector("input"); list = shadow.querySelector("ul");
    shadow.querySelector(".scrim").addEventListener("mousedown", (e) => { if (e.target.classList.contains("scrim")) hide(); });
    input.addEventListener("input", search);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hide();
      else if (e.key === "ArrowDown") { sel = Math.min(sel + 1, results.length - 1); paint(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); paint(); e.preventDefault(); }
      else if (e.key === "Enter") {
        const r = results[sel]; if (!r) return;
        if (e.shiftKey) { chrome.runtime.sendMessage({ type: "lib:save", item: { url: r.url, title: r.title, source: "manual" } }); toast("Saved to Library ✦"); hide(); return; }
        chrome.runtime.sendMessage({ type: "open", tabId: r.tabId, url: r.tabId ? undefined : r.url }); hide();
      }
    });
    document.documentElement.appendChild(host);
  }
  function show() { ensureBar(); host.style.display = "block"; input.value = ""; results = []; sel = 0; paint(); search(); setTimeout(() => input.focus(), 0); }
  function hide() { if (host) host.style.display = "none"; }
  async function search() {
    const q = input.value.trim();
    results = await chrome.runtime.sendMessage({ type: "search", q }).catch(() => []) || []; sel = 0; paint();
  }
  function paint() {
    list.innerHTML = "";
    results.forEach((r, i) => {
      const li = document.createElement("li"); li.className = i === sel ? "sel" : "";
      const img = document.createElement("img"); if (r.url?.startsWith("http")) img.src = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(r.url)}&size=32`);
      const t = document.createElement("div"); t.className = "t"; t.textContent = r.title || r.url;
      const u = document.createElement("div"); u.className = "u"; u.textContent = r.url; t.appendChild(u);
      const k = document.createElement("span"); k.className = "k"; k.textContent = (r.space || "") + " " + r.kind;
      li.append(img, t, k); li.onclick = () => { chrome.runtime.sendMessage({ type: "open", tabId: r.tabId, url: r.tabId ? undefined : r.url }); hide(); };
      list.appendChild(li);
    });
  }
  function toast(msg) {
    const t = document.createElement("div"); t.textContent = msg;
    t.style.cssText = "all:initial;position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;background:rgba(30,28,42,.92);color:#fff;padding:10px 16px;border-radius:12px;font:13px -apple-system,system-ui;box-shadow:0 10px 30px rgba(0,0,0,.3)";
    document.documentElement.appendChild(t); setTimeout(() => t.remove(), 1800);
  }

  // Keyboard: ⌘/Ctrl+K opens bar; ⌘/Ctrl+Shift+D saves the current page to Library
  window.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;

  }, true);
  function isEditable(el) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }

  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m.type === "toggle-command-bar") { host && host.style.display === "block" ? hide() : show(); reply(true); }
    if (m.type === "apply-boost") { applyBoost(m.boost); reply(true); }
  });
})();
