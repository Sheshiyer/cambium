// cambium-quests · miniapp page chunk — design tokens, base reset, substrate, root header/nav chrome
// Verbatim slice of the served PAGE string (T-009 pure refactor of the page.ts monolith).
// Moves only: no copy, style, behavior, or ordering changes. Assembly order: page/index.ts.
export const STYLE_TOKENS = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Cambium · Mission Control</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{
    --bg:#00272B; --bg2:#012F34; --ink:#E0FF4F; --soft:#D6FFF6; --violet:#231651;
    --line:rgba(214,255,246,.09); --line2:rgba(214,255,246,.16); --glass:rgba(1,47,52,.72);
    /* frozen palette (design-tokens.json, zero-delta verified): peach warning is #FFC7A1 */
    --warn:#FFC7A1;
    --mc-bg:#00272B; --mc-panel:#012F34; --mc-panel-glass:rgba(1,47,52,.72);
    --mc-chartreuse:#E0FF4F; --mc-mint:#D6FFF6; --mc-warn:#FFC7A1;
    --mc-peach:#FFC7A1; --mc-peach-rgb:255,199,161; --mc-void:#231651; --mc-paper:#F5F3E8;
    --mc-line:rgba(214,255,246,.09); --mc-line-strong:rgba(214,255,246,.16);
    --mc-active-fill:rgba(224,255,79,.08); --mc-warning-fill:rgba(255,199,161,.055);
    --mc-radius:8px; --mc-radius-compact:4px; --mc-safe-top:var(--sat); --mc-safe-bottom:var(--sab);
    --ease:cubic-bezier(.16,1,.3,1); --pop:cubic-bezier(.34,1.56,.64,1);
    --mono:ui-monospace,'JetBrains Mono',SFMono-Regular,Menlo,monospace;
    --sat:env(safe-area-inset-top); --sab:env(safe-area-inset-bottom);
  }
  *{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
  html,body{height:100%}
  body{
    background:var(--bg); color:var(--soft); overflow:hidden; overscroll-behavior:none;
    font:15px/1.5 -apple-system,'Satoshi','Euclid Circular A',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  /* mycelium substrate — fixed, non-scrolling, pointer-inert contour field. */
  .substrate{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0;
    background:
      linear-gradient(90deg,rgba(214,255,246,.035) 1px,transparent 1px) 0 0/24px 24px,
      linear-gradient(0deg,rgba(214,255,246,.026) 1px,transparent 1px) 0 0/24px 24px,
      repeating-radial-gradient(ellipse at 62% 38%,rgba(214,255,246,.045) 0 1px,transparent 1px 18px)}
  .substrate::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,39,43,.08),rgba(0,39,43,.88));opacity:.82}
  .blob{display:none}
  .grain{position:absolute;inset:0;opacity:.05;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
  .app{position:relative;width:100%;max-width:100%;min-width:0;height:100dvh;display:flex;flex-direction:column;overflow:hidden;z-index:1}

  header.root-status{padding:calc(var(--sat) + 14px) 18px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}
  .root-brand{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center}
  .root-brand-glyph{width:38px;height:38px;border:1px solid rgba(224,255,79,.32);border-radius:12px;display:grid;place-items:center;color:var(--ink);
    background:rgba(224,255,79,.055);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .root-brand-glyph svg{width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
  .root-brand-glyph .mc-fill{fill:currentColor;opacity:.16;stroke:currentColor}
  .root-brand-glyph .mc-core{fill:currentColor;stroke:none;opacity:.86}
  .root-brand-glyph .mc-soft{opacity:.42}
  .brand{min-width:0;font-size:21px;font-weight:750;letter-spacing:0;line-height:1.05}
  .brand small{display:block;font-size:11px;font-weight:400;opacity:.66;letter-spacing:0;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .root-chip-stack{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0}
  .chip{min-height:44px;display:inline-flex;align-items:center;justify-content:center;font:11px/1 var(--mono);padding:5px 10px;border:1px solid rgba(224,255,79,.32);
    border-radius:999px;color:var(--ink);white-space:nowrap;transition:color .4s var(--ease),border-color .4s var(--ease)}
  button.chip{appearance:none;background:transparent;cursor:pointer}
  .chip.stale{border-color:var(--warn);color:var(--warn)}

  /* pull-to-refresh — liquid droplet, lives above the track */
  .ptr{position:absolute;top:calc(var(--sat) + 56px);left:50%;z-index:3;pointer-events:none;
    transform:translate(-50%,-30px) scale(.4);opacity:0;transition:opacity .25s var(--ease)}
  .ptr.show{opacity:1}
  .ptr .drop{width:26px;height:26px;border-radius:50%;
    border:2px solid var(--ink);border-top-color:transparent}
  .ptr.spin .drop{animation:spin .7s linear infinite}
  .ptr-proof{position:absolute;top:31px;left:50%;transform:translateX(-50%);width:250px;text-align:center;
    font:10.5px/1.35 var(--mono);color:var(--ink);background:rgba(0,39,43,.9);
    border:1px solid var(--line);border-radius:8px;padding:6px 8px}

  .root-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:relative;margin:4px 16px 0;
    border-bottom:1px solid var(--line);gap:0;background:transparent}
  .root-tab{appearance:none;min-width:0;min-height:54px;background:none;border:0;color:var(--soft);opacity:.62;
    display:grid;grid-template-rows:auto auto auto;justify-items:center;align-content:center;gap:2px;
    font:650 11px/1 inherit;letter-spacing:0;padding:7px 2px 9px;cursor:pointer;
    transition:opacity .3s var(--ease),color .3s var(--ease),transform .2s var(--ease)}
  .root-tab-glyph{width:21px;height:21px;border:1px solid var(--line2);border-radius:50%;display:grid;place-items:center;
    color:var(--soft);background:rgba(1,47,52,.28);font:12px var(--mono)}
  .root-tab-glyph svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
  .root-tab-glyph .mc-fill{fill:currentColor;opacity:.12;stroke:currentColor}
  .root-tab-glyph .mc-core{fill:currentColor;stroke:none;opacity:.88}
  .root-tab-glyph .mc-soft,.root-tab-glyph .mc-dash{opacity:.42}
  .root-tab-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .root-tab small{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:8.5px/1.1 var(--mono);opacity:.55}
  .root-tab.on{opacity:1;color:var(--ink)}
  .root-tab.on .root-tab-glyph{color:var(--ink);border-color:rgba(224,255,79,.52);box-shadow:0 0 0 1px rgba(224,255,79,.18)}
  .root-tab:active{transform:scale(.97)}
  .ind.root-nav-indicator{position:absolute;bottom:-1px;left:0;width:20%;height:2px;background:var(--ink);
    border-radius:2px;transition:transform .45s var(--ease);box-shadow:0 0 8px rgba(224,255,79,.4)}

`;
