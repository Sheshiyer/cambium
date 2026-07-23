// Visual regression harness for the Telegram mini app mobile surface.
// Renders the real Worker-served PAGE export through a local HTTP fixture
// server (same technique as workers/quests/src/visual-viewport-proof.mjs),
// captures a state-matrix of mobile screenshots with headless Chrome via CDP,
// and writes a manifest with viewport, state, and sha256 per shot.
//
// Usage:
//   node scripts/visual-regression.mjs                      # capture into .artifacts/tg-miniapp-visual/captures/
//   node scripts/visual-regression.mjs --mode baseline      # capture into .artifacts/tg-miniapp-visual/baseline/
//   node scripts/visual-regression.mjs --states idle,stale --viewport 390x844
//
// npm scripts:
//   npm run visual:capture
//   npm run visual:baseline

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PAGE } from '../workers/quests/src/page.ts';
import {
  FRESH_ECOSYSTEM_VISUAL_FIXTURE,
  IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE,
  NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  STALE_ECOSYSTEM_VISUAL_FIXTURE,
} from '../workers/quests/src/visual-fixtures.ts';
import { loadBranchStories } from '../bin/quine/hyphae/branch-stories.ts';

const MANIFEST_SCHEMA = 'cambium.tg-visual-baseline-manifest.v1';
const PAGE_SOURCE_SHA256 = createHash('sha256').update(PAGE).digest('hex');
const proofPage = PAGE.replace('https://telegram.org/js/telegram-web-app.js', '/telegram-web-app.js');

// ---------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const options = {
    mode: 'capture',
    out: resolve('.artifacts/tg-miniapp-visual'),
    viewports: [],
    states: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') options.mode = String(argv[++index] || 'capture');
    else if (arg === '--out') options.out = resolve(String(argv[++index]));
    else if (arg === '--viewport') options.viewports.push(String(argv[++index]));
    else if (arg === '--states') options.states = String(argv[++index] || '').split(',').map((state) => state.trim()).filter(Boolean);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['capture', 'baseline'].includes(options.mode)) throw new Error(`--mode must be capture or baseline, got ${options.mode}`);
  if (options.viewports.length === 0) options.viewports = ['390x844', '430x932'];
  options.viewports = options.viewports.map((spec) => {
    const match = /^(\d+)x(\d+)$/.exec(spec);
    if (!match) throw new Error(`--viewport must be WxH, got ${spec}`);
    return { width: Number(match[1]), height: Number(match[2]) };
  });
  return options;
}

const HELP = `visual-regression.mjs — Telegram mini app mobile state-matrix captures

Options:
  --mode capture|baseline   Output tier: captures/ (working) or baseline/ (named reference). Default capture.
  --out <dir>               Root output directory. Default .artifacts/tg-miniapp-visual
  --viewport <WxH>          Repeatable mobile viewport. Default 390x844 and 430x932
  --states <a,b,c>          Comma-separated state filter. Default: full state matrix
  --help                    Show this help
`;

// ---------------------------------------------------------------------------
// State matrix

function buildBranchStoriesFixture() {
  const rows = loadBranchStories({ root: process.cwd() }, 'cambium');
  const gaps = rows.flatMap((row) => (Array.isArray(row.gaps) ? row.gaps : []));
  const activeRow = rows.find((row) => row.promotion.state === 'supervised-branch' || row.promotion.state === 'organ-service') ?? rows[0];
  return {
    ...FRESH_ECOSYSTEM_VISUAL_FIXTURE,
    source: 'visual-fixture:branch-stories',
    derivedAt: new Date().toISOString(),
    branchStories: {
      source: 'product-branch-packets@v1',
      status: gaps.length > 0 ? 'partial' : 'ready',
      total: rows.length,
      active: rows.filter((row) => row.promotion.state !== 'proof-only').length,
      blocked: gaps.filter((gap) => gap.status === 'blocked').length,
      activeBranchId: activeRow?.branchId,
      rows,
      gaps,
    },
  };
}

const SHELL_WAIT = "document.querySelector('[data-component=\"MissionControlShell\"]') && document.querySelector('[data-component=\"RootNav\"]')";

const STATE_MATRIX = [
  {
    state: 'idle',
    fixture: 'no-fake-progress',
    scene: 'mission',
    waitFor: SHELL_WAIT,
  },
  {
    state: 'active',
    fixture: 'fresh',
    scene: 'mission',
    waitFor: `${SHELL_WAIT} && document.body.textContent.includes('The Calling')`,
  },
  {
    state: 'selected',
    fixture: 'branch-stories',
    scene: 'mission',
    waitFor: "document.querySelector('[data-mission-branch=\"1\"]')",
    tapSelector: '[data-mission-branch="1"]',
    waitAfter: "document.querySelector('[data-mission-branch=\"1\"][aria-selected=\"true\"]') && !document.querySelector('#sheet.on')",
  },
  {
    state: 'complete',
    fixture: 'action-requests',
    scene: 'inspect',
    sceneIndex: 4,
    prepare: `(() => {
      const tab = document.querySelector('[data-inspect-pane-select="proof"]');
      if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
      const active = document.querySelector('[data-inspect-pane="proof"]');
      const details = active && [...active.querySelectorAll('details')].find((node) => node.querySelector('summary')?.textContent.includes('Decisions and receipts'));
      if (details) details.open = true;
    })()`,
    waitFor: "document.querySelector('[data-action-request-id=\"ar_iverif_autogtm_receipt_complete\"]')",
    scrollSelector: '[data-action-request-id="ar_iverif_autogtm_receipt_complete"]',
  },
  {
    state: 'blocked',
    fixture: 'no-fake-progress',
    scene: 'inspect',
    sceneIndex: 4,
    prepare: "document.querySelector('[data-inspect-pane-select=\"system\"]')?.click()",
    waitFor: "document.querySelector('[data-policy]') && document.body.textContent.includes('POLICY GAP')",
    scrollSelector: '[data-policy]',
  },
  {
    // The locked visual state is captured from the branch arc chips in the
    // Inspect scene (deterministic locked StateToken from branch packets).
    state: 'locked',
    fixture: 'branch-stories',
    scene: 'inspect',
    sceneIndex: 4,
    waitFor: "document.querySelector('.mc-state-token.is-locked') && document.body.textContent.includes('Locked')",
    scrollSelector: '.mc-state-token.is-locked',
  },
  {
    // The stale freshness sheet carries the explicit stale reasons (the base
    // no-fake-progress envelope is itself stale, so the chip alone is not a
    // distinctive capture; the opened sheet is).
    state: 'stale',
    fixture: 'stale',
    scene: 'mission',
    waitFor: "document.querySelector('#fresh') && document.querySelector('#fresh').classList.contains('stale')",
    tapSelector: '#fresh',
    waitAfter: "document.querySelector('#sheet.on') && document.querySelector('#sheet').textContent.includes('stale data is not live proof')",
  },
  {
    state: 'reduced-motion',
    fixture: 'fresh',
    scene: 'mission',
    media: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    waitFor: `${SHELL_WAIT} && matchMedia('(prefers-reduced-motion: reduce)').matches`,
  },
];

// ---------------------------------------------------------------------------
// Browser discovery (mirrors visual-viewport-proof.mjs)

function playwrightHeadlessShellCandidates() {
  const cacheDir = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  try {
    return readdirSync(cacheDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium_headless_shell-'))
      .map((entry) => join(cacheDir, entry.name, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
      .filter((path) => existsSync(path))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

const explicitChrome = String(process.env.CHROME_BIN || '').trim();
const DEFAULT_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ...playwrightHeadlessShellCandidates(),
];
const BROWSER_CANDIDATES = explicitChrome
  ? [explicitChrome]
  : DEFAULT_BROWSER_CANDIDATES.filter((path) => existsSync(path));
const browserModes = [
  { id: 'headless-new', args: ['--headless=new'] },
  { id: 'headless-old', args: ['--headless'] },
];
const CDP_TIMEOUT_MS = Number(process.env.CDP_TIMEOUT_MS || 30_000);
let activeBrowser = BROWSER_CANDIDATES[0];
let activeBrowserMode = 'headless-new';

// ---------------------------------------------------------------------------
// Local fixture server

async function withServer(fixtures, fn) {
  let activeFixture = NO_FAKE_PROGRESS_VISUAL_FIXTURE;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      activeFixture = fixtures[url.searchParams.get('fixture')] || NO_FAKE_PROGRESS_VISUAL_FIXTURE;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(proofPage);
      return;
    }
    if (url.pathname === '/telegram-web-app.js') {
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end('window.Telegram={WebApp:{initData:"",initDataUnsafe:{},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};');
      return;
    }
    if (url.pathname === '/api/quests/cambium') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(activeFixture));
      return;
    }
    if (url.pathname === '/api/gate/cambium' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ queued: 'visual-regression-stub', duplicate: false }));
      return;
    }
    res.writeHead(204);
    res.end();
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolvePromise();
    });
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture server did not bind to a TCP port');
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
}

// ---------------------------------------------------------------------------
// CDP plumbing

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolvePromise();
    });
  });
  const address = server.address();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!address || typeof address === 'string') throw new Error('could not allocate a TCP port');
  return address.port;
}

async function waitForDebugger(port, timeoutMs = CDP_TIMEOUT_MS) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) return await res.json();
    } catch {
      // retry until timeout
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}

async function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  await new Promise((resolvePromise, reject) => {
    ws.addEventListener('open', resolvePromise, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data));
    if (!msg.id) return;
    const handlers = pending.get(msg.id);
    if (!handlers) return;
    pending.delete(msg.id);
    if (msg.error) handlers.reject(new Error(JSON.stringify(msg.error)));
    else handlers.resolve(msg.result);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject }));
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`Chrome evaluation failed: ${result.exceptionDetails.text || expression}`);
  return result.result?.value;
}

async function waitForExpression(cdp, expression, timeoutMs = 8_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function tapSelector(cdp, selector) {
  await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('missing tap selector ${selector}');
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
  })()`);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  const point = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none' });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function stopBrowserProcess(child) {
  if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  if (child.exitCode !== null) return;
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 2_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

function pngSize(path) {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: statSync(path).size };
}

// ---------------------------------------------------------------------------
// Capture

async function captureWithBrowser(browser, mode, url, file, spec, viewport) {
  const profile = mkdtempSync(join(tmpdir(), 'cambium-tg-visual-'));
  const port = await freePort();
  const chrome = spawn(browser, [
    ...mode.args,
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--touch-events=enabled',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-address=127.0.0.1`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  try {
    const targets = await waitForDebugger(port);
    const pageTarget = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error('Chrome did not expose a page target');
    const cdp = await cdpClient(pageTarget.webSocketDebuggerUrl);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 2,
        mobile: true,
      });
      if (Array.isArray(spec.media)) {
        await cdp.send('Emulation.setEmulatedMedia', { features: spec.media });
      }
      await cdp.send('Page.navigate', { url });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_500));
      if (spec.prepare) {
        await waitForExpression(cdp, SHELL_WAIT);
        await evaluate(cdp, `${spec.prepare}; undefined`);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
      }
      if (spec.waitFor) await waitForExpression(cdp, spec.waitFor);
      if (spec.scrollSelector) {
        const sceneIndex = Number.isFinite(spec.sceneIndex) ? spec.sceneIndex : 0;
        const selector = JSON.stringify(spec.scrollSelector);
        await evaluate(cdp, `(() => {
          const scene = document.querySelectorAll('.scene')[${sceneIndex}];
          const node = (scene && scene.querySelector(${selector})) || document.querySelector(${selector});
          if (!node) throw new Error('missing scroll selector ' + ${selector});
          if (scene) {
            const rect = node.getBoundingClientRect();
            const sceneRect = scene.getBoundingClientRect();
            scene.scrollTo(0, Math.max(0, scene.scrollTop + rect.top - sceneRect.top - 16));
          } else {
            node.scrollIntoView({ block: 'center', inline: 'nearest' });
          }
        })()`);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
      }
      if (spec.tapSelector) {
        await tapSelector(cdp, spec.tapSelector);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
      }
      if (spec.waitAfter) await waitForExpression(cdp, spec.waitAfter);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
    } finally {
      cdp.close();
    }
  } finally {
    await stopBrowserProcess(chrome);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function capture(url, file, spec, viewport) {
  const candidates = [activeBrowser, ...BROWSER_CANDIDATES.filter((browser) => browser !== activeBrowser)].filter(Boolean);
  const modes = [
    browserModes.find((mode) => mode.id === activeBrowserMode),
    ...browserModes.filter((mode) => mode.id !== activeBrowserMode),
  ].filter(Boolean);
  const failures = [];
  for (const browser of candidates) {
    for (const mode of modes) {
      try {
        await captureWithBrowser(browser, mode, url, file, spec, viewport);
        activeBrowser = browser;
        activeBrowserMode = mode.id;
        return;
      } catch (error) {
        failures.push(`${browser} (${mode.id}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  throw new Error(['No configured browser captured the shot', ...failures.map((line) => `- ${line}`)].join('\n'));
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (BROWSER_CANDIDATES.length === 0) {
    throw new Error(`No Chromium-family browser found. Set CHROME_BIN. Checked: ${DEFAULT_BROWSER_CANDIDATES.join(', ')}`);
  }

  const specs = options.states ? STATE_MATRIX.filter((spec) => options.states.includes(spec.state)) : STATE_MATRIX;
  if (specs.length === 0) throw new Error(`No state matrix entries matched: ${(options.states || []).join(', ')}`);

  const outDir = join(options.out, options.mode === 'baseline' ? 'baseline' : 'captures');
  mkdirSync(outDir, { recursive: true });

  const fixtures = {
    'no-fake-progress': NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    fresh: FRESH_ECOSYSTEM_VISUAL_FIXTURE,
    stale: STALE_ECOSYSTEM_VISUAL_FIXTURE,
    'action-requests': IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE,
    'branch-stories': buildBranchStoriesFixture(),
  };

  const shots = [];
  await withServer(fixtures, async (base) => {
    for (const spec of specs) {
      for (const viewport of options.viewports) {
        const name = `${spec.state}-${viewport.width}x${viewport.height}.png`;
        const file = join(outDir, name);
        const url = `${base}/?tenant=cambium&scene=${spec.scene}&fixture=${spec.fixture}`;
        await capture(url, file, spec, viewport);
        const size = pngSize(file);
        shots.push({
          state: spec.state,
          fixture: spec.fixture,
          scene: spec.scene,
          viewport: { width: viewport.width, height: viewport.height },
          ...(Array.isArray(spec.media) ? { emulatedMedia: spec.media } : {}),
          path: name,
          sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
          ...size,
        });
        console.log(`captured ${name} (${size.bytes} bytes)`);
      }
    }
  });

  const manifest = {
    schema: MANIFEST_SCHEMA,
    mode: options.mode,
    generatedAt: new Date().toISOString(),
    pageSourceSha256: PAGE_SOURCE_SHA256,
    chrome: activeBrowser,
    browserMode: activeBrowserMode,
    viewports: options.viewports,
    states: specs.map((spec) => spec.state),
    shots,
    invariant: 'Baseline screenshots use the real PAGE export and local API fixtures at mobile emulation; the manifest records viewport, state, and sha256 per shot. Screenshots are layout/state references, never live proof.',
  };
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ manifest: manifestPath, shots: shots.length, mode: options.mode }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
