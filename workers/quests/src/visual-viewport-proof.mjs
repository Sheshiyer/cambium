// Headless Chrome viewport proof for the Telegram mini app visual surface.
// This deliberately uses the real PAGE export and local HTTP routes so the
// screenshots exercise the same inline app script the Worker serves.

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PAGE } from './page.ts';
import { NO_FAKE_PROGRESS_VISUAL_FIXTURE } from './visual-fixtures.ts';

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

const DEFAULT_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Arc.app/Contents/MacOS/Arc',
  ...playwrightHeadlessShellCandidates(),
];
const explicitChrome = String(process.env.CHROME_BIN || '').trim();
const BROWSER_CANDIDATES = explicitChrome
  ? [explicitChrome]
  : DEFAULT_BROWSER_CANDIDATES.filter((path) => existsSync(path));
const CHROME = BROWSER_CANDIDATES[0] || DEFAULT_BROWSER_CANDIDATES[0];
const CDP_TIMEOUT_MS = Number(process.env.CDP_TIMEOUT_MS || 30_000);
const CDP_PROBE_TIMEOUT_MS = Number(process.env.CDP_PROBE_TIMEOUT_MS || 3_500);
const argv = new Set(process.argv.slice(2));
const DIAGNOSE_BROWSER = argv.has('--diagnose-browser');
const INCLUDE_HEADED_BROWSER_PROBE = argv.has('--include-headed-browser-probe') || process.env.INCLUDE_HEADED_BROWSER_PROBE === '1';
let activeBrowser = CHROME;
let activeBrowserMode = 'headless-new';

const outDir = resolve('docs/plans/assets/tg-miniapp-viewport-proof');
const viewport = { width: 390, height: 844 };
const proofPage = PAGE.replace('https://telegram.org/js/telegram-web-app.js', '/telegram-web-app.js');

const gateFixture = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  openItems: [
    {
      id: 'THO-9',
      title: 'Review launch copy',
      status: 'blocked',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 is blocked · owner Mathis · updated 2026-06-22T00:00:00.000Z',
      consequence: 'founder decision changes Paperclip handling for THO-9',
      approveConsequence: 'approve THO-9 for Paperclip execution',
      rerollConsequence: 'reroll THO-9 and request revision before execution',
      reversibility: 'queued action can be superseded until consumed; reroll keeps the item open',
      idempotencyHint: 'THO-9:blocked:2026-06-22T00:00:00.000Z',
      priority: {
        source: 'paperclip-priority@v1',
        risk: 'critical',
        dependency: 'blocks-delivery',
        score: 24,
        reasons: ['status/title indicates blocked or critical risk', 'item can block delivery or founder handoff'],
      },
    },
  ],
  policy: {
    source: 'operator-policy',
    status: 'ready',
    action: 'Review gate item THO-9: Review launch copy',
    title: 'NEXT ACTION',
    detail: 'THO-9 · blocked · blocked queue priority · critical risk · blocks-delivery dependency',
    blockers: [],
    cautions: ['founder must still choose approve or reroll inside the signed Gate flow'],
    requiredSignals: ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal'],
    rulesVersion: 'operator-policy@v1.4',
  },
  senses: {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE.senses,
    rows: NO_FAKE_PROGRESS_VISUAL_FIXTURE.senses.rows.map((sense) => sense.id === 'risk'
      ? {
          ...sense,
          on: true,
          detail: '16 quest risk traces · 1 gate risk',
          proof: `${sense.proof} · THO-9: critical risk · blocks-delivery dependency`,
          source: 'paperclip-open-items',
          evidence: [
            ...sense.evidence,
            { label: 'THO-9', status: 'blocked', detail: 'critical risk · blocks-delivery dependency' },
          ],
        }
      : sense),
  },
};

const skillFixture = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  skills: {
    source: 'skill-registry',
    total: 2,
    rows: [
      {
        id: 'cambium-founder-review',
        status: 'validated',
        uses: 5,
        successes: 5,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'reliable',
        tierLabel: 'RELIABLE',
        sampleSize: 5,
        minimum: 3,
        recentRate: 1,
        recentWindow: 5,
        promotion: {
          status: 'founder-review',
          label: 'FOUNDER REVIEW',
          detail: 'eligible for production review; founder approval required',
          requiredApproval: true,
        },
        updated: 5,
      },
      {
        id: 'cambium-production-approved',
        status: 'production',
        uses: 5,
        successes: 5,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'production',
        tierLabel: 'PRODUCTION',
        sampleSize: 5,
        minimum: 3,
        recentRate: 1,
        recentWindow: 5,
        promotion: {
          status: 'approved',
          label: 'PRODUCTION',
          detail: 'founder-approved production skill with healthy telemetry',
          requiredApproval: false,
        },
        updated: 4,
      },
    ],
  },
  policy: {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE.policy,
    blockers: ['need 6 tenant events; found 0'],
    gap: 'need 6 tenant events; found 0',
  },
};

const miraFixture = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  npc: {
    source: 'cortex-memory',
    relationships: [
      {
        id: 'mira',
        status: 'inferred',
        detail: '1/1 tenant cortex memories mention Mira or ICP signals',
        proof: 'acme:mira:resonance-1: positioning · mira',
        stage: {
          id: 'sighted',
          label: 'SIGHTED',
          detail: 'tenant cortex has one Mira/ICP evidence event',
          confidence: 1,
        },
        events: [
          {
            id: 'acme:mira:resonance-1',
            kind: 'positioning',
            source: 'tenant-cortex-memory',
            detail: 'mira',
            ts: 3,
          },
        ],
        history: {
          source: 'operator-npc-events@v1',
          total: 1,
          contradictions: 0,
          rows: [
            {
              id: 'acme:mira:advice:1',
              kind: 'advice',
              source: 'operator-note',
              detail: 'review Mira positioning before the next founder handoff',
              evidence: 'operator note references acme:mira:resonance-1',
              createdAt: '2026-06-22T00:00:00.000Z',
              advice: {
                detail: 'review Mira positioning before the next founder handoff',
                action: { kind: 'review', label: 'Review Mira positioning', target: 'npc:mira' },
              },
            },
          ],
        },
        advice: {
          status: 'ready',
          label: 'REVIEW ADVICE',
          detail: 'review Mira positioning before the next founder handoff',
          proof: 'operator note references acme:mira:resonance-1',
          action: { kind: 'review', label: 'Review Mira positioning', target: 'npc:mira' },
        },
        sampleSize: 1,
        scope: 'tenant-cortex-only',
        evidence: ['acme:mira:resonance-1', 'positioning'],
      },
      {
        id: 'founder-npc',
        status: 'missing',
        detail: 'founder memory not served yet',
        proof: 'no inherited founder arcs served',
        stage: {
          id: 'missing',
          label: 'MISSING',
          detail: 'no inherited founder arc memory served',
          confidence: 0,
        },
        events: [],
        history: { source: 'missing', total: 0, contradictions: 0, rows: [] },
        advice: {
          status: 'blocked',
          label: 'NO ADVICE',
          detail: 'no durable NPC advice event served',
          proof: 'no durable NPC events served',
          action: { kind: 'collect-evidence', label: 'Record NPC evidence', target: 'quine write quests npc-event founder-npc' },
        },
        sampleSize: 0,
        scope: 'founder-arcs',
      },
    ],
  },
};

function assertBrowserAvailable() {
  if (BROWSER_CANDIDATES.length === 0) {
    throw new Error(`No Chromium-family browser found. Set CHROME_BIN to run this proof. Checked: ${DEFAULT_BROWSER_CANDIDATES.join(', ')}`);
  }
}

function pngSize(path) {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: statSync(path).size };
}

async function withServer(fn) {
  let activeFixture = NO_FAKE_PROGRESS_VISUAL_FIXTURE;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const fixture = url.searchParams.get('fixture');
      activeFixture = url.searchParams.get('scene') === 'gate' || fixture === 'gate'
        ? gateFixture
        : fixture === 'skill'
          ? skillFixture
          : fixture === 'mira'
            ? miraFixture
          : NO_FAKE_PROGRESS_VISUAL_FIXTURE;
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
    res.writeHead(204);
    res.end();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server did not bind to a TCP port');
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  if (!address || typeof address === 'string') throw new Error('could not allocate a TCP port');
  return address.port;
}

const debuggerHosts = ['127.0.0.1', 'localhost', '[::1]'];
const browserProbeModes = [
  { id: 'headless-new', args: ['--headless=new'] },
  { id: 'headless-old', args: ['--headless'] },
  ...(INCLUDE_HEADED_BROWSER_PROBE ? [{ id: 'headed', args: [] }] : []),
];

function debuggerSocketDiagnostics(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
    timeout: 2_000,
  });
  if (result.error) return `cdp listener check failed: ${result.error.message}`;
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return output ? `cdp listener check:\n${output}` : `cdp listener check: no process is listening on TCP ${port}`;
}

async function waitForDebugger(port, timeoutMs = 30_000, diagnostics = () => '') {
  const start = Date.now();
  const attempts = new Map(debuggerHosts.map((host) => [host, 'not attempted']));
  while (Date.now() - start < timeoutMs) {
    for (const host of debuggerHosts) {
      const endpoint = `http://${host}:${port}/json/list`;
      try {
        const res = await fetch(endpoint);
        attempts.set(host, `${endpoint} -> HTTP ${res.status}`);
        if (res.ok) return await res.json();
      } catch (error) {
        attempts.set(host, `${endpoint} -> ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const extra = diagnostics();
  throw new Error([
    'Chrome DevTools endpoint did not become ready',
    'debugger probes:',
    ...[...attempts.values()].map((line) => `- ${line}`),
    debuggerSocketDiagnostics(port),
    extra,
  ].filter(Boolean).join('\n'));
}

async function quickDebuggerProbe(port) {
  const probes = [];
  for (const host of debuggerHosts) {
    const endpoint = `http://${host}:${port}/json/list`;
    try {
      const res = await fetch(endpoint);
      probes.push({ endpoint, status: res.status, ok: res.ok });
    } catch (error) {
      probes.push({ endpoint, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return probes;
}

async function probeBrowserDebugging(browser, mode) {
  const profile = mkdtempSync(join(tmpdir(), 'cambium-tg-cdp-probe-'));
  const port = await freePort();
  let stderr = '';
  const child = spawn(browser, [
    ...mode.args,
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-logging=stderr',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr?.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-1600);
  });
  await new Promise((resolve) => setTimeout(resolve, Number.isFinite(CDP_PROBE_TIMEOUT_MS) && CDP_PROBE_TIMEOUT_MS > 0 ? CDP_PROBE_TIMEOUT_MS : 3_500));
  const listener = debuggerSocketDiagnostics(port);
  const endpointProbes = await quickDebuggerProbe(port);
  const endpointReady = endpointProbes.some((probe) => probe.ok === true);
  const listenerReady = /cdp listener check:\n/.test(listener);
  const result = {
    browser,
    mode: mode.id,
    state: endpointReady ? 'ready' : 'blocked',
    exitCode: child.exitCode,
    listenerReady,
    listener,
    endpointProbes,
    stderr: stderr.trim(),
  };
  await stopBrowserProcess(child);
  rmSync(profile, { recursive: true, force: true });
  return result;
}

async function writeBrowserDiagnosticsArtifact() {
  mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const browser of BROWSER_CANDIDATES) {
    for (const mode of browserProbeModes) {
      try {
        results.push(await probeBrowserDebugging(browser, mode));
      } catch (error) {
        results.push({
          browser,
          mode: mode.id,
          state: 'blocked',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  const ready = results.filter((result) => result.state === 'ready').length;
  const artifact = {
    schema: 'cambium.tg-viewport-browser-diagnostics.v1',
    generatedAt: new Date().toISOString(),
    browserCandidates: BROWSER_CANDIDATES,
    probeModes: browserProbeModes.map((mode) => mode.id),
    probeTimeoutMs: Number.isFinite(CDP_PROBE_TIMEOUT_MS) && CDP_PROBE_TIMEOUT_MS > 0 ? CDP_PROBE_TIMEOUT_MS : 3_500,
    summary: {
      ready,
      blocked: results.length - ready,
      total: results.length,
      cdpReady: ready > 0,
    },
    results,
    invariant: 'Browser diagnostics are not layout proof; viewport proof remains blocked until manifest.json is regenerated by a passing screenshot run.',
  };
  writeFileSync(join(outDir, 'browser-diagnostics.json'), JSON.stringify(artifact, null, 2) + '\n');
  return artifact;
}

async function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
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
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`Chrome evaluation failed: ${result.exceptionDetails.text || expression}`);
  }
  return result.result?.value;
}

async function waitForExpression(cdp, expression, timeoutMs = 5_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function screenshotParams(cdp, options = {}) {
  const params = {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  };
  if (!options.clipSelector) return params;
  const rect = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(options.clipSelector)});
    if (!node) throw new Error('missing clip selector ${options.clipSelector}');
    const rect = node.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  })()`);
  params.captureBeyondViewport = true;
  params.clip = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    scale: 1,
  };
  return params;
}

async function stopBrowserProcess(browserProcess) {
  if (browserProcess.exitCode === null && !browserProcess.killed) browserProcess.kill('SIGTERM');
  if (browserProcess.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    browserProcess.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function captureWithBrowser(browser, mode, url, file, options = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'cambium-tg-proof-'));
  const port = await freePort();
  let chromeStderr = '';
  const chrome = spawn(browser, [
    ...mode.args,
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-logging=stderr',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    `--window-size=${viewport.width},${viewport.height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr?.on('data', (chunk) => {
    chromeStderr = (chromeStderr + String(chunk)).slice(-4000);
  });
  try {
    const targets = await waitForDebugger(port, Number.isFinite(CDP_TIMEOUT_MS) && CDP_TIMEOUT_MS > 0 ? CDP_TIMEOUT_MS : 30_000, () => [
      `browser: ${browser}`,
      `browser mode: ${mode.id}`,
      chrome.exitCode !== null ? `chrome exit code: ${chrome.exitCode}` : '',
      chromeStderr ? `chrome stderr: ${chromeStderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
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
      await cdp.send('Page.navigate', { url });
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (options.waitFor) {
        await waitForExpression(cdp, options.waitFor);
      }
      if (options.scrollSelector) {
        const sceneIndex = Number.isFinite(options.sceneIndex) ? options.sceneIndex : 0;
        const selector = JSON.stringify(options.scrollSelector);
        const offset = Number.isFinite(options.scrollOffset) ? Number(options.scrollOffset) : 16;
        await evaluate(cdp, `(() => {
          const scene = document.querySelectorAll('.scene')[${sceneIndex}];
          if (!scene) throw new Error('missing scene index ${sceneIndex}');
          const node = scene.querySelector(${selector}) || document.querySelector(${selector});
          if (!node) throw new Error('missing scroll selector ' + ${selector});
          const rect = node.getBoundingClientRect();
          const sceneRect = scene.getBoundingClientRect();
          scene.scrollTo(0, Math.max(0, scene.scrollTop + rect.top - sceneRect.top - ${offset}));
        })()`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else if (Number.isFinite(options.scrollTop)) {
        const sceneIndex = Number.isFinite(options.sceneIndex) ? options.sceneIndex : 0;
        await evaluate(cdp, `document.querySelectorAll('.scene')[${sceneIndex}]?.scrollTo(0, ${options.scrollTop}); undefined`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (options.expression) {
        await evaluate(cdp, `${options.expression}; undefined`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (options.waitAfterExpression) {
        await waitForExpression(cdp, options.waitAfterExpression);
      }
      const shot = await cdp.send('Page.captureScreenshot', await screenshotParams(cdp, options));
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
    } finally {
      cdp.close();
    }
  } finally {
    await stopBrowserProcess(chrome);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function capture(url, file, options = {}) {
  const candidates = activeBrowser ? [activeBrowser, ...BROWSER_CANDIDATES.filter((browser) => browser !== activeBrowser)] : BROWSER_CANDIDATES;
  const modes = activeBrowserMode
    ? [browserProbeModes.find((mode) => mode.id === activeBrowserMode), ...browserProbeModes.filter((mode) => mode.id !== activeBrowserMode)].filter(Boolean)
    : browserProbeModes;
  const failures = [];
  for (const browser of candidates) {
    for (const mode of modes) {
      try {
        await captureWithBrowser(browser, mode, url, file, options);
        activeBrowser = browser;
        activeBrowserMode = mode.id;
        return;
      } catch (error) {
        failures.push({ browser, mode: mode.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  throw new Error([
    'No configured browser exposed a Chrome DevTools Protocol endpoint',
    ...failures.map((failure) => `- ${failure.browser} (${failure.mode}): ${failure.error}`),
  ].join('\n'));
}

function writeFailureArtifact(error) {
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'failure.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      browserCandidates: BROWSER_CANDIDATES,
      browserModes: browserProbeModes.map((mode) => mode.id),
      error: error instanceof Error ? error.message : String(error),
      invariant: 'Viewport proof failure artifacts are diagnostics only; existing screenshots remain stale until manifest.json is regenerated by a passing run.',
    }, null, 2) + '\n');
  } catch {
    // Keep the original proof failure visible.
  }
}

async function main() {
if (DIAGNOSE_BROWSER) {
const diagnostics = await writeBrowserDiagnosticsArtifact();
console.log(JSON.stringify(diagnostics, null, 2));
return;
}
assertBrowserAvailable();
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'no-fake-progress-fixture.json'), JSON.stringify(NO_FAKE_PROGRESS_VISUAL_FIXTURE, null, 2) + '\n');
writeFileSync(join(outDir, 'gate-fixture.json'), JSON.stringify(gateFixture, null, 2) + '\n');
writeFileSync(join(outDir, 'skill-promotion-fixture.json'), JSON.stringify(skillFixture, null, 2) + '\n');
writeFileSync(join(outDir, 'mira-relationship-fixture.json'), JSON.stringify(miraFixture, null, 2) + '\n');

const proofs = [];
await withServer(async (base) => {
  for (const proof of [
    { scene: 'map', path: 'map-tapestry-audit-mobile.png', waitFor: "document.querySelector('[data-tapestry=\"0\"]')" },
    { scene: 'map', path: 'map-no-fake-progress-mobile.png', sceneIndex: 1, scrollSelector: '[data-wake="0"]' },
    { scene: 'map', path: 'map-policy-gap-mobile.png', sceneIndex: 1, scrollSelector: '[data-policy]' },
    { scene: 'map', fixture: 'gate', path: 'map-gate-priority-mobile.png', sceneIndex: 1, scrollSelector: '[data-policy]' },
    { scene: 'map', fixture: 'skill', path: 'map-skill-promotion-mobile.png', sceneIndex: 1, scrollSelector: '[data-skill="0"]' },
    {
      scene: 'map',
      fixture: 'skill',
      path: 'sheet-skill-promotion-mobile.png',
      sceneIndex: 1,
      scrollSelector: '[data-skill="0"]',
      waitFor: "document.querySelector('[data-skill=\"0\"]')",
      expression: "(() => { const el = document.querySelector('[data-skill=\"0\"]'); if (!el) throw new Error('missing founder-review skill card'); el.click(); })()",
      waitAfterExpression: "document.querySelector('#sheet.on [data-promote-skill]') && document.querySelector('#sheet').getBoundingClientRect().top < window.innerHeight - 40",
      clipSelector: '#sheet',
    },
    { scene: 'map', fixture: 'mira', path: 'map-mira-relationship-mobile.png', sceneIndex: 1, scrollSelector: '[data-npc="0"]' },
    { scene: 'gate', path: 'gate-consequence-mobile.png' },
  ]) {
    const file = join(outDir, proof.path);
    const fixture = proof.fixture ? `&fixture=${proof.fixture}` : '';
    const url = `${base}/?tenant=cambium&scene=${proof.scene}${fixture}`;
    await capture(url, file, proof);
    proofs.push({ scene: proof.scene, url, path: proof.path, ...pngSize(file) });
  }
});

const manifest = {
  generatedAt: new Date().toISOString(),
  chrome: activeBrowser,
  browserMode: activeBrowserMode,
  browserCandidates: BROWSER_CANDIDATES,
  viewport,
  proofs,
  invariant: 'Screenshots use real PAGE export, local API fixtures, mobile emulation, and a clipped real sheet proof for bottom-sheet actions.',
};

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  writeFailureArtifact(error);
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
