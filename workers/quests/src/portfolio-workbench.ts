// Public Telegram bootstrap and protected response contracts for the hosted
// Portfolio Workbench. The bootstrap carries no catalog bytes and keeps the
// signed Telegram initData in one local variable for the single authenticated
// fetch. Authorization remains entirely server-side.

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
        window.location.replace('/admin/portfolio/web');
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
