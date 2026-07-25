// cambium-quests · miniapp page chunk — shared bottom sheet CSS
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_SHEET = `  /* ── sheet ──────────────────────────────────── */
  .veil{position:fixed;inset:0;background:rgba(0,20,23,.55);opacity:0;pointer-events:none;
    transition:opacity .35s var(--ease);z-index:10}
  .veil.on{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:0;right:0;bottom:0;z-index:11;padding:14px 20px calc(var(--sab) + 24px);
    background:var(--glass);backdrop-filter:blur(16px);
    border:1px solid var(--line2);border-bottom:0;border-radius:22px 22px 0 0;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 -18px 50px rgba(0,10,12,.45);
    max-height:calc(100dvh - var(--sat) - 10px);overflow:hidden;
    transform:translateY(105%);transition:transform .5s var(--pop);will-change:transform;touch-action:pan-y}
  .sheet.on{transform:translateY(0)}
  .grab{width:38px;height:4px;border-radius:99px;background:rgba(214,255,246,.25);margin:2px auto 16px}
  #sheetBody{max-height:calc(100dvh - var(--sat) - var(--sab) - 70px);overflow-y:auto;overscroll-behavior:contain;padding:0 1px 6px;scrollbar-width:none}
  #sheetBody::-webkit-scrollbar{display:none}
  .sheet .arc{font:12px var(--mono);color:var(--ink);opacity:.9}
  .sheet h2{font-size:19px;letter-spacing:0;margin:4px 0 8px;overflow-wrap:anywhere}
  .sheet .nar{opacity:.85;margin-bottom:12px;line-height:1.55}
  .kv{display:grid;grid-template-columns:84px minmax(0,1fr);gap:7px 10px;font-size:13px}
  .kv b{font:11px var(--mono);opacity:.55;font-weight:500;letter-spacing:0;text-transform:uppercase;padding-top:2px}
  .kv span{min-width:0;font-family:var(--mono);font-size:12.5px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word}
  /* T-018 gate preflight sheet (frozen/05 §3 + frozen/06 §2.4): glyph + title + ONE consequence line
     + reversibility state token + ONE Inspect link + Confirm/Cancel. No kv walls — detail lives in Inspect. */
  .gate-preflight-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;margin:4px 0 8px}
  .gate-preflight-head .mc-glyph{width:34px;height:34px}
  .gate-preflight-head h2{margin:0}
  .gate-preflight-line{font:12.5px/1.5 var(--mono);color:var(--soft);margin:10px 0 12px;overflow-wrap:anywhere}
  .gate-preflight-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px}
  .gate-inspect-link{appearance:none;background:none;border:0;padding:0;min-height:24px;color:var(--ink);
    font:11px var(--mono);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
  .gate-result-line{display:flex;align-items:center;gap:10px;margin:10px 0 14px;font:12px/1.45 var(--mono);color:var(--soft);overflow-wrap:anywhere}
  /* receipt token label never breaks mid-word; long values (idempotency keys) wrap anywhere on the value span */
  .gate-result-line .mc-state-token{flex:0 0 auto;white-space:nowrap;overflow-wrap:normal}
  .gate-result-line>span{min-width:0;overflow-wrap:anywhere}
  /* T-018 gate result sheet receipt rows (frozen/06 G19): queued id + mono idempotency key. Compact receipt
     kv is allowed on this Inspect-adjacent receipt surface; the no-kv-wall rule governs the preflight only. */
  .gatekv{display:grid;grid-template-columns:92px minmax(0,1fr);gap:6px 10px;margin:0 0 14px;padding:9px 10px;
    border:1px solid var(--line);border-radius:10px;background:rgba(1,47,52,.28)}
  .gatekv b{font:10.5px var(--mono);opacity:.55;font-weight:500;letter-spacing:0;text-transform:uppercase;padding-top:2px}
  .gatekv span{min-width:0;font:12px/1.5 var(--mono);overflow-wrap:anywhere}
  .status-complete,.status-active{color:var(--ink)} .status-locked{opacity:.6}
  .branch-sheet{display:grid;gap:11px;min-width:0}
  .branch-sheet-hero{position:relative;overflow:hidden;border:1px solid rgba(224,255,79,.27);border-radius:12px;padding:13px;
    background:linear-gradient(145deg,rgba(224,255,79,.055),rgba(1,47,52,.4) 62%);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .branch-sheet-hero::after{content:"";position:absolute;right:-28px;top:-24px;width:120px;height:120px;border-radius:50%;
    border:1px dashed rgba(224,255,79,.22);opacity:.8;pointer-events:none}
  .branch-sheet-head{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:10px;align-items:center;z-index:1}
  .branch-sheet-head h2{margin:2px 0 1px;font-size:20px;line-height:1.12;color:var(--soft)}
  .branch-sheet-head .arc{opacity:.72;font-size:11px}
  .branch-sheet-hero .nar{position:relative;margin:10px 0 0;max-width:60ch;font-size:13.5px;z-index:1}
  .branch-sheet-glance{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
  .branch-sheet-glance span{min-width:0;border:1px solid var(--line);border-radius:9px;padding:8px;background:rgba(1,47,52,.28);
    font:11px/1.35 var(--mono);overflow-wrap:anywhere}
  .branch-sheet-glance b{display:block;color:var(--ink);font-weight:650;margin-bottom:3px;text-transform:uppercase;letter-spacing:0}
  .branch-claim-guard{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;margin-top:10px;padding:9px;
    border:1px dashed rgba(255,199,161,.38);border-radius:10px;background:rgba(255,199,161,.045);font:12px/1.45 var(--mono)}
  .branch-claim-guard b{display:block;color:var(--warn);font-weight:650;margin-bottom:2px}
  .branch-claim-guard span{display:block;overflow-wrap:anywhere;opacity:.82}
  .branch-sheet-section{display:grid;gap:7px}
  .branch-sheet-section h3{font:11px var(--mono);letter-spacing:0;text-transform:uppercase;color:var(--ink);margin:0}
  .branch-sheet-timeline{display:grid;gap:7px;border-left:1px solid var(--line2);padding-left:10px}
  .branch-stage{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;min-height:42px}
  .branch-stage b{display:block;font-size:13px;overflow-wrap:anywhere}
  .branch-stage small{display:block;font:10.5px var(--mono);opacity:.58;margin-top:2px;overflow-wrap:anywhere}
  .branch-row-list{display:grid;gap:7px}
  .branch-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;border:1px solid var(--line);border-radius:10px;
    padding:9px;background:rgba(1,47,52,.28);font:12px/1.42 var(--mono);overflow:hidden}
  .branch-row.is-blocked{border-color:rgba(255,199,161,.42);background:rgba(255,199,161,.045)}
  .branch-row.is-proof-needed{border-color:rgba(255,199,161,.34)}
  .branch-row b{display:block;color:var(--soft);font-weight:650;margin-bottom:2px;overflow-wrap:anywhere}
  .branch-row span{display:block;opacity:.76;overflow-wrap:anywhere}
  .branch-row small{display:block;color:var(--ink);opacity:.58;margin-top:4px;overflow-wrap:anywhere}
  .branch-row .mc-state-token{min-height:22px;padding:3px 7px}
  .branch-kpi-grid{display:grid;grid-template-columns:1fr;gap:7px}
  .branch-kpi{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;border:1px solid var(--line);
    border-radius:10px;padding:9px;background:rgba(1,47,52,.28);font:12px/1.4 var(--mono)}
  .branch-kpi b{display:block;color:var(--soft);font-weight:650;overflow-wrap:anywhere}
  .branch-kpi span:last-child{display:block;opacity:.75;overflow-wrap:anywhere}
  .branch-inspect{display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px 9px;border-top:1px solid var(--line);padding-top:10px;
    font:11px/1.45 var(--mono);opacity:.72}
  .branch-inspect b{color:var(--ink);font-weight:650;text-transform:uppercase;letter-spacing:0}
  .branch-inspect span{overflow-wrap:anywhere}

`;
