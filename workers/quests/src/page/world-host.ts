import { CLIENT_CURIOUS_DEPARTMENT_BRIDGE } from './client/curious-department-bridge.ts';
import { CLIENT_CURIOUS_READ_BRIDGE } from './client/curious-read-bridge.ts';
import { CLIENT_CURIOUS_GATE_BRIDGE } from './client/curious-gate-bridge.ts';

export const WORLD_HYDRATION_MARKER = '/* cambium:field-atlas-initial-hydration */';

// The page owns reads and authentication; the world receives the same sanitized bridges.
export const WORLD_HOST_CLIENT = `<script>
'use strict';
let TG = null;
const PARAMS = new URLSearchParams(location.search);
let TENANT = (PARAMS.get('tenant') || 'cambium').replace(/[^a-z0-9-]/gi, '') || 'cambium';
const FOUNDER_PATH = String(location.pathname || '');
const FOUNDER_WEB = FOUNDER_PATH === '/founder' || FOUNDER_PATH.indexOf('/founder/') === 0;
const API_BASE = FOUNDER_WEB ? '/founder' : '';
let REFRESH_ROUTE = API_BASE + '/api/quests/' + TENANT;
let initData = '';
let QUEST_READ_REVISION = 0;
let ECOSYSTEM_ENV = null;
let disposed = false;
const readControllers = new Set();
${CLIENT_CURIOUS_READ_BRIDGE}
${CLIENT_CURIOUS_GATE_BRIDGE}
${CLIENT_CURIOUS_DEPARTMENT_BRIDGE}
function hold(state, revision) {
  ECOSYSTEM_ENV = null;
  CuriousReadBridge.hold(state, revision);
  CuriousGateBridge.hold(state, revision);
}
function validEnvelope(env) {
  return !!env && typeof env === 'object' && !Array.isArray(env) && env.schema === 1 && env.tenant === TENANT
    && !!env.ledger && typeof env.ledger === 'object' && Array.isArray(env.ledger.rows)
    && typeof env.derivedAt === 'string' && Number.isFinite(Date.parse(env.derivedAt))
    && Date.parse(env.derivedAt) <= Date.now() + 60000;
}
function paint(env) {
  if (!validEnvelope(env)) { hold('empty', QUEST_READ_REVISION); return; }
  const time = Date.parse(env.derivedAt);
  if ((ECOSYSTEM_ENV && time < Date.parse(ECOSYSTEM_ENV.derivedAt)) || Date.now() - time > 360 * 60000) {
    hold('stale', QUEST_READ_REVISION); return;
  }
  ECOSYSTEM_ENV = env;
  CuriousReadBridge.quest(env, QUEST_READ_REVISION);
  CuriousGateBridge.quest(env, QUEST_READ_REVISION);
}
async function load() {
  if (disposed) return;
  void CuriousDepartmentBridge.refresh();
  const revision = ++QUEST_READ_REVISION;
  CuriousReadBridge.pending(revision);
  CuriousGateBridge.pending(revision);
  const controller = new AbortController();
  readControllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(REFRESH_ROUTE, { signal:controller.signal, credentials:'same-origin', headers:initData ? {'x-telegram-init-data':initData} : {} });
    if (disposed || revision !== QUEST_READ_REVISION) return;
    if (response.status === 401 || response.status === 403) { hold('auth', revision); return; }
    if (response.status === 404) { hold('missing', revision); return; }
    if (!response.ok) { hold(response.status >= 500 ? 'error' : 'offline', revision); return; }
    const env = await response.json();
    if (!disposed && revision === QUEST_READ_REVISION) paint(env);
  } catch (_) { if (!disposed && revision === QUEST_READ_REVISION) hold('offline', revision); }
  finally { clearTimeout(timeout); readControllers.delete(controller); }
}
function refresh() { return load(); }
window.addEventListener('pagehide', () => { disposed = true; CuriousDepartmentBridge.dispose(); readControllers.forEach(controller => controller.abort()); readControllers.clear(); });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; CuriousDepartmentBridge.resume(); refresh(); } });
function startSession(app) {
  if (disposed) return;
  TG = app;
  initData = (TG && TG.initData) || '';
  TENANT = (PARAMS.get('tenant') || (TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || 'cambium').replace(/[^a-z0-9-]/gi, '') || 'cambium';
  REFRESH_ROUTE = API_BASE + '/api/quests/' + TENANT;
  if (TG) { TG.ready(); TG.expand(); }
  ${WORLD_HYDRATION_MARKER}
  load();
}
const suppliedTelegram = !FOUNDER_WEB && window.Telegram && window.Telegram.WebApp;
const hasTelegramSession = suppliedTelegram && typeof suppliedTelegram.initData === 'string' && suppliedTelegram.initData.length > 0;
const telegramParams = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
const needsTelegramSdk = !FOUNDER_WEB && (telegramParams.has('tgWebAppData') || PARAMS.has('tgWebAppData'));
if (hasTelegramSession) startSession(suppliedTelegram);
else if (needsTelegramSdk) {
  const sdk = document.createElement('script');
  let timer = setTimeout(() => { sdk.onload = null; sdk.onerror = null; sdk.remove(); if (!disposed) hold('auth', ++QUEST_READ_REVISION); }, 10000);
  sdk.src = 'https://telegram.org/js/telegram-web-app.js';
  sdk.onload = () => { clearTimeout(timer); const app = window.Telegram && window.Telegram.WebApp; if (app && typeof app.initData === 'string' && app.initData.length > 0) startSession(app); else if (!disposed) hold('auth', ++QUEST_READ_REVISION); };
  sdk.onerror = () => { clearTimeout(timer); if (!disposed) hold('auth', ++QUEST_READ_REVISION); };
  document.head.append(sdk);
} else startSession(null);
</script>`;

export const WORLD_HOST_HEAD = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#00272B">
<title>Cambium · Field Atlas</title>
<style>
:root{color-scheme:dark;--bg:#00272B;--ink:#E0FF4F;--soft:#D6FFF6;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:var(--bg);color:var(--soft)}
body{font:15px/1.6 system-ui,sans-serif;overflow:hidden}button{font:inherit}button:focus-visible{outline:3px solid var(--ink);outline-offset:4px}
</style></head><body>`;
