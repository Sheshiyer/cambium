// Public Telegram bootstrap and protected response contracts for the hosted
// Portfolio Workbench. The bootstrap carries no catalog bytes and keeps the
// signed Telegram initData in one local variable for the single authenticated
// fetch. Authorization remains entirely server-side.
import { PORTFOLIO_DISPLAY_CATALOG } from './portfolio-catalog.ts';

const projects = PORTFOLIO_DISPLAY_CATALOG.records.map(({ workId, name, classification }) => ({
  workId,
  name,
  classification,
}));

export const PORTFOLIO_PROJECT_MAP = {
  schema: 'cambium.portfolio-project-map.v1',
  readOnly: true,
  projects,
} as const;

const classificationLabel = {
  'client-branch': 'Client branch',
  'internal-program': 'Internal program',
  sapling: 'Sapling',
};
const escapeText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export const PORTFOLIO_PUBLIC_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const PORTFOLIO_PUBLIC_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thoughtseed Portfolio Workbench</title>
  <link rel="alternate" type="application/json" href="/v1/portfolio">
  <style>
    :root { color-scheme: dark; background: #071410; color: #f2ecd8; font-family: system-ui, sans-serif; }
    body { max-width: 68rem; margin: 0 auto; padding: clamp(1rem, 4vw, 3rem); }
    nav { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; }
    a { color: #e0ff4f; display: inline-flex; align-items: center; min-height: 44px; }
    a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
    h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .75rem .5rem; border-bottom: 1px solid #2b4038; text-align: left; vertical-align: top; }
    thead th { color: #b8c6bd; font-weight: 500; }
    code { display: block; margin-top: .2rem; color: #b8c6bd; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <nav aria-label="Portfolio links">
    <a href="/">Curious</a>
    <a href="/v1/portfolio">Project map JSON</a>
    <a href="/admin/portfolio/web">Manage portfolio</a>
  </nav>
  <main>
    <h1>Portfolio Workbench</h1>
    <table aria-label="Portfolio projects">
      <thead><tr><th scope="col">Project</th><th scope="col">Type</th></tr></thead>
      <tbody>${projects.map(({ workId, name, classification }) =>
        `<tr><th scope="row">${escapeText(name)}<code>${escapeText(workId)}</code></th><td>${classificationLabel[classification]}</td></tr>`,
      ).join('')}</tbody>
    </table>
  </main>
</body>
</html>`;

export const PORTFOLIO_WORKBENCH_LOADER_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://telegram.org",
  "style-src 'unsafe-inline'",
  "connect-src 'self'",
  "img-src data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self' https://*.telegram.org",
].join('; ');

export const PORTFOLIO_WORKBENCH_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self' https://*.telegram.org",
].join('; ');

export const PORTFOLIO_WORKBENCH_LOADER = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Thoughtseed Portfolio Workbench</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#071410;color:#f2ecd8}
    *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#071410}
    main{width:min(100%,420px);padding:28px;border:1px solid rgba(226,237,218,.18);background:#0d1d17}
    span{display:inline-grid;place-items:center;width:42px;height:42px;margin-bottom:18px;border-radius:50%;background:#dfff4f;color:#071410;font-weight:800}
    h1{margin:0 0 10px;font-size:24px;line-height:1.1}p{margin:0;color:#a9b7aa;line-height:1.55}
  </style>
</head>
<body>
  <main aria-labelledby="portfolioLoaderTitle">
    <span aria-hidden="true">TS</span>
    <h1 id="portfolioLoaderTitle">Opening Portfolio Workbench</h1>
    <p id="portfolioLoaderStatus" role="status" aria-live="polite">Verifying this Telegram session…</p>
  </main>
  <script>
    (function () {
      'use strict';
      var webApp = window.Telegram && window.Telegram.WebApp;
      var initData = webApp && typeof webApp.initData === 'string' ? webApp.initData : '';
      var status = document.getElementById('portfolioLoaderStatus');
      if (webApp && typeof webApp.ready === 'function') webApp.ready();
      if (!initData) {
        window.location.replace('/portfolio');
        return;
      }
      fetch('/v1/admin/portfolio', {
        method: 'GET',
        headers: { 'x-telegram-init-data': initData },
        cache: 'no-store',
        credentials: 'same-origin'
      }).then(function (response) {
        if (response.status !== 200) {
          status.textContent = response.status === 503
            ? 'Portfolio preview is not configured yet.'
            : 'This Telegram account cannot open the portfolio preview.';
          return null;
        }
        return response.text();
      }).then(function (html) {
        if (typeof html !== 'string') return;
        document.open();
        document.write(html);
        document.close();
      }).catch(function () {
        status.textContent = 'Portfolio preview could not be loaded. Try again.';
      });
    })();
  </script>
</body>
</html>`;

export const PORTFOLIO_WORKBENCH_ACCESS_DENIED = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Portfolio Access Required</title>
  <style>
    :root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#071410;color:#f2ecd8}
    *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#071410}
    main{width:min(100%,420px);padding:28px;border:1px solid rgba(226,237,218,.18);background:#0d1d17}
    span{display:inline-grid;place-items:center;width:42px;height:42px;margin-bottom:18px;border-radius:50%;background:#dfff4f;color:#071410;font-weight:800}
    h1{margin:0 0 10px;font-size:24px;line-height:1.1}p{margin:0;color:#a9b7aa;line-height:1.55}
  </style>
</head>
<body>
  <main aria-labelledby="portfolioDeniedTitle">
    <span aria-hidden="true">TS</span>
    <h1 id="portfolioDeniedTitle">Portfolio access required</h1>
    <p role="status">Sign in with the authorized founder identity to continue.</p>
  </main>
</body>
</html>`;
