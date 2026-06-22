#!/usr/bin/env node
// Live-proof readiness audit for the Telegram mini app.
//
// This is intentionally not a live proof by itself. It records whether the
// specific evidence needed for a live Telegram WebView / production Worker
// smoke is present, so local deterministic smokes cannot be mistaken for
// founder-device proof.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUT = 'docs/plans/assets/tg-miniapp-live-proof/readiness.json';
const DEFAULT_DEVICE_PROOF = 'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json';
const DEFAULT_DEVICE_TEMPLATE = 'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.template.json';
const DEFAULT_WORKER_PROBE = 'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json';
const DEFAULT_WORKER_TEMPLATE = 'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.template.json';
const DEFAULT_SIGNED_SMOKE = 'docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json';
const DEFAULT_SIGNED_SMOKE_TEMPLATE = 'docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.template.json';
const DEFAULT_WORKER = 'https://curious.thoughtseed.space';
const DEFAULT_DEVICE_PROOF_MAX_AGE_SEC = 24 * 60 * 60;
const DEFAULT_WORKER_PROBE_MAX_AGE_SEC = 24 * 60 * 60;
const WORKER_INITDATA_MAX_AGE_SEC = 600;
const HASH_64 = /^sha256:[a-f0-9]{64}$/i;
const LIVE_PROOF_ASSET_DIR = 'docs/plans/assets/tg-miniapp-live-proof';
const SIGNED_SMOKE_KINDS = ['skill-promotion', 'side-quest', 'npc-history', 'gate-approval'];
const GATE_ACTION_KINDS = ['approve', 'reroll', 'promote-skill', 'queue-side-quest'];
const SMOKE_LEAK_KEY = /^(authorization|cookie|secret|token|pushToken|bearer|initData|rawInitData|telegramInitData|subject|idempotencyKey|queuedId|founderId|rawBody|responseBody|requestBody)$/i;
const RAW_INITDATA_MARKERS = [
  /(?:^|[?&\s])query_id=/i,
  /(?:^|[?&\s])auth_date=/i,
  /(?:^|[?&\s])hash=/i,
  /(?:^|[?&\s])signature=/i,
  /tgWebAppData=/i,
  /TELEGRAM_INIT_DATA=/i,
];
const SECRET_MARKERS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /QUESTS_PUSH_TOKEN/i,
  /authorization/i,
  /cookie/i,
  /secret/i,
  /token/i,
];

function readEnvFileTokenValue(home = homedir()) {
  try {
    const txt = readFileSync(join(home, '.claude', '.env'), 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('QUESTS_PUSH_TOKEN='));
    return line?.slice('QUESTS_PUSH_TOKEN='.length).replace(/^["']|["']$/g, '').trim() || '';
  } catch {
    return '';
  }
}

function readEnvFileToken(home = homedir()) {
  return !!readEnvFileTokenValue(home);
}

function resolvePushToken(env = process.env, home = homedir()) {
  const envToken = typeof env.QUESTS_PUSH_TOKEN === 'string' ? env.QUESTS_PUSH_TOKEN.trim() : '';
  return envToken || readEnvFileTokenValue(home);
}

function parseArgs(argv) {
  const out = {
    tenant: process.env.TENANT || 'cambium',
    cwd: process.cwd(),
    write: false,
    out: DEFAULT_OUT,
    deviceProofPath: DEFAULT_DEVICE_PROOF,
    deviceTemplateOut: DEFAULT_DEVICE_TEMPLATE,
    writeDeviceTemplate: false,
    workerProbePath: DEFAULT_WORKER_PROBE,
    workerTemplateOut: DEFAULT_WORKER_TEMPLATE,
    writeWorkerTemplate: false,
    signedSmokePath: DEFAULT_SIGNED_SMOKE,
    signedSmokeTemplateOut: DEFAULT_SIGNED_SMOKE_TEMPLATE,
    writeSignedSmokeTemplate: false,
    captureDeviceProof: false,
    captureSignedSmoke: false,
    screenshotPath: '',
    webViewUrl: process.env.TELEGRAM_WEBVIEW_URL || DEFAULT_WORKER,
    devicePlatform: process.env.TELEGRAM_WEBVIEW_PLATFORM || '',
    safeArea: process.env.TELEGRAM_WEBVIEW_SAFE_AREA || '',
    captureWorkerProbe: false,
    allowNetwork: false,
    allowMutation: false,
    workerUrl: process.env.QUESTS_WORKER_URL || DEFAULT_WORKER,
    smokeKind: process.env.SIGNED_SMOKE_KIND || '',
    actionKind: process.env.SIGNED_SMOKE_ACTION_KIND || '',
    actionSubject: process.env.SIGNED_SMOKE_ACTION_SUBJECT || '',
    actionEvidence: process.env.SIGNED_SMOKE_ACTION_EVIDENCE || '',
    actionConsequence: process.env.SIGNED_SMOKE_ACTION_CONSEQUENCE || '',
    actionReversibility: process.env.SIGNED_SMOKE_ACTION_REVERSIBILITY || '',
    actionIdempotencyKey: process.env.SIGNED_SMOKE_IDEMPOTENCY_KEY || '',
    operatorCommand: process.env.SIGNED_SMOKE_OPERATOR_COMMAND || '',
    operatorAuditPath: process.env.SIGNED_SMOKE_OPERATOR_AUDIT || '',
    operatorChecked: process.env.SIGNED_SMOKE_OPERATOR_CHECKED || '',
    operatorConsumed: process.env.SIGNED_SMOKE_OPERATOR_CONSUMED || '',
    operatorRejected: process.env.SIGNED_SMOKE_OPERATOR_REJECTED || '',
    miniAppEnvelopePath: process.env.SIGNED_SMOKE_MINIAPP_ENVELOPE || '',
    visibleMarker: process.env.SIGNED_SMOKE_VISIBLE_MARKER || '',
    strict: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tenant') out.tenant = argv[++i] || out.tenant;
    else if (arg === '--cwd') out.cwd = argv[++i] || out.cwd;
    else if (arg === '--out') out.out = argv[++i] || out.out;
    else if (arg === '--device-proof') out.deviceProofPath = argv[++i] || out.deviceProofPath;
    else if (arg === '--device-template-out') out.deviceTemplateOut = argv[++i] || out.deviceTemplateOut;
    else if (arg === '--worker-probe') out.workerProbePath = argv[++i] || out.workerProbePath;
    else if (arg === '--worker-template-out') out.workerTemplateOut = argv[++i] || out.workerTemplateOut;
    else if (arg === '--signed-smoke') out.signedSmokePath = argv[++i] || out.signedSmokePath;
    else if (arg === '--signed-smoke-template-out') out.signedSmokeTemplateOut = argv[++i] || out.signedSmokeTemplateOut;
    else if (arg === '--screenshot') out.screenshotPath = argv[++i] || out.screenshotPath;
    else if (arg === '--webview-url') out.webViewUrl = argv[++i] || out.webViewUrl;
    else if (arg === '--platform') out.devicePlatform = argv[++i] || out.devicePlatform;
    else if (arg === '--safe-area') out.safeArea = argv[++i] || out.safeArea;
    else if (arg === '--smoke-kind') out.smokeKind = argv[++i] || out.smokeKind;
    else if (arg === '--action-kind') out.actionKind = argv[++i] || out.actionKind;
    else if (arg === '--action-subject') out.actionSubject = argv[++i] || out.actionSubject;
    else if (arg === '--action-evidence') out.actionEvidence = argv[++i] || out.actionEvidence;
    else if (arg === '--action-consequence') out.actionConsequence = argv[++i] || out.actionConsequence;
    else if (arg === '--action-reversibility') out.actionReversibility = argv[++i] || out.actionReversibility;
    else if (arg === '--action-idempotency-key') out.actionIdempotencyKey = argv[++i] || out.actionIdempotencyKey;
    else if (arg === '--operator-command') out.operatorCommand = argv[++i] || out.operatorCommand;
    else if (arg === '--operator-audit') out.operatorAuditPath = argv[++i] || out.operatorAuditPath;
    else if (arg === '--operator-checked') out.operatorChecked = argv[++i] || out.operatorChecked;
    else if (arg === '--operator-consumed') out.operatorConsumed = argv[++i] || out.operatorConsumed;
    else if (arg === '--operator-rejected') out.operatorRejected = argv[++i] || out.operatorRejected;
    else if (arg === '--miniapp-envelope') out.miniAppEnvelopePath = argv[++i] || out.miniAppEnvelopePath;
    else if (arg === '--visible-marker') out.visibleMarker = argv[++i] || out.visibleMarker;
    else if (arg === '--write') out.write = true;
    else if (arg === '--write-device-template') out.writeDeviceTemplate = true;
    else if (arg === '--write-worker-template') out.writeWorkerTemplate = true;
    else if (arg === '--write-signed-smoke-template') out.writeSignedSmokeTemplate = true;
    else if (arg === '--capture-device-proof') out.captureDeviceProof = true;
    else if (arg === '--capture-signed-smoke') out.captureSignedSmoke = true;
    else if (arg === '--capture-worker-probe') out.captureWorkerProbe = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--allow-network') out.allowNetwork = true;
    else if (arg === '--allow-mutation') out.allowMutation = true;
    else if (arg === '--worker-url') out.workerUrl = argv[++i] || out.workerUrl;
  }
  return out;
}

function hasAnyEnv(env, names) {
  return names.some((name) => typeof env[name] === 'string' && env[name].trim().length > 0);
}

function fileHas(cwd, path, marker) {
  try {
    return readFileSync(resolve(cwd, path), 'utf8').includes(marker);
  } catch {
    return false;
  }
}

function artifactExists(cwd, path) {
  return existsSync(resolve(cwd, path));
}

function artifactMtimeMs(cwd, path) {
  try {
    return statSync(resolve(cwd, path)).mtimeMs;
  } catch {
    return 0;
  }
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasRawInitDataLeak(value) {
  return hasLeak(value, RAW_INITDATA_MARKERS, /^(initData|rawInitData|telegramInitData)$/i);
}

function hasSecretLeak(value) {
  return hasLeak(value, SECRET_MARKERS, /^(authorization|cookie|secret|token|pushToken|bearer)$/i);
}

function hasSignedSmokeLeak(value) {
  return hasLeak(value, [...RAW_INITDATA_MARKERS, ...SECRET_MARKERS], SMOKE_LEAK_KEY);
}

function hasLeak(value, stringMarkers, keyMarker) {
  const stack = [{ path: '', value }];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (typeof current.value === 'string') {
      if (stringMarkers.some((marker) => marker.test(current.value))) return true;
      continue;
    }
    if (!isObject(current.value) && !Array.isArray(current.value)) continue;
    for (const [key, child] of Object.entries(current.value)) {
      const nextPath = current.path ? `${current.path}.${key}` : key;
      if (keyMarker.test(key)) return true;
      stack.push({ path: nextPath, value: child });
    }
  }
  return false;
}

function parseJsonArtifact(cwd, path) {
  const absolute = resolve(cwd, path);
  try {
    return { exists: true, path, absolute, value: JSON.parse(readFileSync(absolute, 'utf8')) };
  } catch (error) {
    if (!existsSync(absolute)) return { exists: false, path, absolute, error: 'missing artifact' };
    return { exists: true, path, absolute, error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function sha256File(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function requiredString(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function requiredNonNegativeIntegerOption(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer`);
  return n;
}

function requiredExistingFile(cwd, path, label) {
  const relPath = requiredString(path, label);
  const absolute = resolve(cwd, relPath);
  if (!existsSync(absolute)) throw new Error(`${label} must point at an existing file`);
  return absolute;
}

function responseTextHash(text) {
  return sha256Text(text || '');
}

function proofAssetRelativePath(cwd, path, label) {
  if (!path) throw new Error(`${label} is required`);
  const proofAssetRoot = resolve(cwd, LIVE_PROOF_ASSET_DIR);
  const absolute = resolve(cwd, path);
  if (absolute !== proofAssetRoot && !absolute.startsWith(`${proofAssetRoot}${sep}`)) {
    throw new Error(`${label} must stay under ${LIVE_PROOF_ASSET_DIR}`);
  }
  return relative(cwd, absolute).split(sep).join('/');
}

function sanitizeWebViewUrl(value) {
  const parsed = new URL(value || DEFAULT_WORKER);
  if (parsed.protocol !== 'https:') throw new Error('webview URL must use https');
  return {
    origin: parsed.origin,
    path: parsed.pathname || '/',
  };
}

function initDataFromEnv(env = process.env) {
  return String(env.TELEGRAM_INIT_DATA || env.TG_INIT_DATA || '').trim();
}

function parseInitDataForProof(initData, capturedAt) {
  if (!initData) throw new Error('TELEGRAM_INIT_DATA or TG_INIT_DATA is required to capture the device proof');
  const fields = new URLSearchParams(initData);
  const authDate = Number(fields.get('auth_date') || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) throw new Error('Telegram initData auth_date is required');
  let userId = '';
  try {
    userId = String(JSON.parse(fields.get('user') || '{}').id || '');
  } catch {
    userId = '';
  }
  if (!userId) throw new Error('Telegram initData user.id is required');
  const capturedAtMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedAtMs)) throw new Error('capturedAt must be a valid ISO timestamp');
  const initDataAgeSeconds = Math.floor(capturedAtMs / 1000 - authDate);
  return {
    userIdHash: sha256Text(userId),
    initDataHash: sha256Text(initData),
    initDataAgeSeconds,
  };
}

export function createDeviceProofTemplate(options = {}) {
  const tenant = options.tenant || 'cambium';
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    schema: 'cambium.tg-device-proof-template.v1',
    generatedAt,
    tenant,
    writesAuthority: false,
    instruction: 'Copy sourceDocument to telegram-webview.json only after a real Telegram WebView capture. Store hashes only; never paste raw initData, query strings, or tokens.',
    sourceDocument: {
      schema: 'cambium.tg-device-proof.v1',
      tenant,
      capturedAt: 'TODO-ISO-8601',
      source: 'telegram-webview',
      telegram: {
        userIdHash: 'sha256:TODO_SHA256_OF_TELEGRAM_USER_ID',
        initDataHash: 'sha256:TODO_SHA256_OF_RAW_INITDATA',
        initDataAgeSeconds: 0,
      },
      webView: {
        platform: 'TODO-ios-android-desktop',
        urlOrigin: 'https://curious.thoughtseed.space',
        urlPath: '/',
        safeArea: 'TODO-top-right-bottom-left-or-notes',
      },
      screenshot: {
        sha256: 'sha256:TODO_SHA256_OF_SCREENSHOT',
        path: 'docs/plans/assets/tg-miniapp-live-proof/TODO-founder-device.png',
      },
      notes: [
        'TODO capture Telegram client, device class, and any shell/chrome anomaly without raw initData.',
      ],
    },
  };
}

export function captureDeviceProof(options = {}) {
  const cwd = options.cwd || process.cwd();
  const tenant = options.tenant || 'cambium';
  const env = options.env || process.env;
  const capturedAt = options.capturedAt || new Date().toISOString();
  const screenshotPath = proofAssetRelativePath(cwd, options.screenshotPath, 'screenshot path');
  const webView = sanitizeWebViewUrl(options.webViewUrl || DEFAULT_WORKER);
  const telegram = parseInitDataForProof(options.initData || initDataFromEnv(env), capturedAt);
  return {
    schema: 'cambium.tg-device-proof.v1',
    tenant,
    capturedAt,
    source: 'telegram-webview',
    telegram,
    webView: {
      platform: String(options.platform || '').trim(),
      urlOrigin: webView.origin,
      urlPath: webView.path,
      safeArea: String(options.safeArea || '').trim() || 'not recorded',
    },
    screenshot: {
      sha256: sha256File(resolve(cwd, screenshotPath)),
      path: screenshotPath,
    },
    notes: [
      'Captured by live-proof-readiness --capture-device-proof; raw initData, raw Telegram user id, and WebView query string omitted.',
    ],
  };
}

export function createWorkerProbeTemplate(options = {}) {
  const tenant = options.tenant || 'cambium';
  const workerUrl = options.workerUrl || DEFAULT_WORKER;
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    schema: 'cambium.worker-network-probe-template.v1',
    generatedAt,
    tenant,
    writesAuthority: false,
    instruction: 'Copy sourceDocument to worker-network-probe.json only after an authorized production Worker list probe. Store status, counts, and response digests only; never store bearer headers, tokens, cookies, or raw response bodies.',
    sourceDocument: {
      schema: 'cambium.worker-network-probe.v1',
      tenant,
      capturedAt: 'TODO-ISO-8601',
      source: 'production-worker',
      workerUrl,
      probes: [
        {
          name: 'internal-gate-list',
          method: 'GET',
          path: `/internal/gate/${tenant}`,
          status: 200,
          ok: true,
          responseShape: {
            tenantMatches: true,
            actionsArray: true,
          },
          queuedActionCount: 0,
          bodySha256: 'sha256:TODO_SHA256_OF_REDACTED_RESPONSE_BODY',
        },
      ],
      notes: [
        'TODO capture command timestamp and whether the probe used production Worker URL. Do not store credentials or raw queued action payloads here.',
      ],
    },
  };
}

export function createSignedActionSmokeTemplate(options = {}) {
  const tenant = options.tenant || 'cambium';
  const workerUrl = options.workerUrl || DEFAULT_WORKER;
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    schema: 'cambium.signed-action-smoke-template.v1',
    generatedAt,
    tenant,
    writesAuthority: false,
    instruction: 'Copy sourceDocument to signed-action-smoke.json only after a real Telegram signed action runs through Worker queue, operator consume, and mini app refresh. Store hashes and counts only; never store initData, bearer tokens, raw subjects, founder ids, queued ids, or response bodies.',
    sourceDocument: {
      schema: 'cambium.signed-action-smoke.v1',
      tenant,
      capturedAt: 'TODO-ISO-8601',
      source: 'telegram-worker-operator-smoke',
      workerUrl,
      smokeKind: 'TODO-skill-promotion-or-side-quest-or-npc-history-or-gate-approval',
      telegram: {
        userIdHash: 'sha256:TODO_SHA256_OF_TELEGRAM_USER_ID',
        initDataHash: 'sha256:TODO_SHA256_OF_RAW_INITDATA',
        initDataAgeSeconds: 0,
      },
      action: {
        kind: 'TODO-promote-skill-or-queue-side-quest-or-approve-or-reroll',
        subjectHash: 'sha256:TODO_SHA256_OF_REDACTED_SUBJECT',
        idempotencyKeyHash: 'sha256:TODO_SHA256_OF_IDEMPOTENCY_KEY',
      },
      phases: {
        telegramSubmit: {
          status: 200,
          queued: true,
          duplicate: false,
          queuedIdHash: 'sha256:TODO_SHA256_OF_WORKER_QUEUED_ID',
          responseSha256: 'sha256:TODO_SHA256_OF_REDACTED_TELEGRAM_SUBMIT_RESPONSE',
        },
        workerList: {
          status: 200,
          sawQueuedAction: true,
          queuedActionCount: 0,
          bodySha256: 'sha256:TODO_SHA256_OF_REDACTED_WORKER_LIST_RESPONSE',
        },
        operatorConsume: {
          command: 'TODO-quine-write-skills-apply-promotions-or-quine-write-quests-apply-side-quests',
          checked: 1,
          consumed: 1,
          rejected: 0,
          auditSha256: 'sha256:TODO_SHA256_OF_REDACTED_OPERATOR_AUDIT',
        },
        miniAppRefresh: {
          refreshed: true,
          envelopeSha256: 'sha256:TODO_SHA256_OF_REFRESHED_VISUAL_ENVELOPE',
          visibleMarkerHash: 'sha256:TODO_SHA256_OF_VISIBLE_CARD_MARKER',
        },
      },
      notes: [
        'TODO identify the user-facing card that changed without storing private action payloads.',
      ],
    },
  };
}

export function validateDeviceProofArtifact(value, options = {}) {
  const tenant = options.tenant || 'cambium';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const cwd = options.cwd || process.cwd();
  const maxAgeSec = options.maxAgeSec ?? DEFAULT_DEVICE_PROOF_MAX_AGE_SEC;
  const missing = [];

  if (!isObject(value)) {
    return { ready: false, state: 'blocked', missing: ['device proof artifact must be a JSON object'] };
  }
  if (value.schema === 'cambium.tg-device-proof-template.v1' || value.writesAuthority === false) {
    return {
      ready: false,
      state: 'blocked',
      missing: ['replace template with real cambium.tg-device-proof.v1 artifact'],
      evidence: [],
      detail: 'A non-authoritative template exists, but no real founder Telegram WebView proof has been captured.',
    };
  }
  if (value.schema !== 'cambium.tg-device-proof.v1') missing.push('schema must be cambium.tg-device-proof.v1');
  if (value.tenant !== tenant) missing.push(`tenant must match ${tenant}`);
  if (value.source !== 'telegram-webview') missing.push('source must be telegram-webview');
  if (hasRawInitDataLeak(value)) missing.push('artifact must not contain raw initData, auth_date, signature, hash, query_id, or tgWebAppData');

  const capturedAtMs = Date.parse(String(value.capturedAt || ''));
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(capturedAtMs)) {
    missing.push('capturedAt must be a valid ISO timestamp');
  } else if (Number.isFinite(generatedAtMs)) {
    const ageSec = Math.floor((generatedAtMs - capturedAtMs) / 1000);
    if (ageSec < -300) missing.push('capturedAt cannot be in the future');
    if (ageSec > maxAgeSec) missing.push(`capturedAt must be within ${maxAgeSec} seconds`);
  }

  const telegram = isObject(value.telegram) ? value.telegram : {};
  if (!HASH_64.test(String(telegram.userIdHash || ''))) missing.push('telegram.userIdHash must be sha256:<64 hex>');
  if (!HASH_64.test(String(telegram.initDataHash || ''))) missing.push('telegram.initDataHash must be sha256:<64 hex>');
  const initDataAgeSeconds = Number(telegram.initDataAgeSeconds);
  if (!Number.isFinite(initDataAgeSeconds) || initDataAgeSeconds < 0) {
    missing.push('telegram.initDataAgeSeconds must be a non-negative number');
  } else if (initDataAgeSeconds > WORKER_INITDATA_MAX_AGE_SEC) {
    missing.push(`telegram.initDataAgeSeconds must be <= ${WORKER_INITDATA_MAX_AGE_SEC}`);
  }

  const webView = isObject(value.webView) ? value.webView : {};
  if (webView.urlOrigin !== DEFAULT_WORKER && !String(webView.urlOrigin || '').startsWith('https://')) {
    missing.push('webView.urlOrigin must be an https origin');
  }
  if (!String(webView.platform || '').trim()) missing.push('webView.platform is required');

  const screenshot = isObject(value.screenshot) ? value.screenshot : {};
  if (!HASH_64.test(String(screenshot.sha256 || ''))) missing.push('screenshot.sha256 must be sha256:<64 hex>');
  const screenshotPath = String(screenshot.path || '').trim();
  if (!screenshotPath) {
    missing.push('screenshot.path is required');
  } else {
    const proofAssetRoot = resolve(cwd, LIVE_PROOF_ASSET_DIR);
    const screenshotAbsolute = resolve(cwd, screenshotPath);
    if (screenshotAbsolute !== proofAssetRoot && !screenshotAbsolute.startsWith(`${proofAssetRoot}${sep}`)) {
      missing.push(`screenshot.path must stay under ${LIVE_PROOF_ASSET_DIR}`);
    } else if (!existsSync(screenshotAbsolute)) {
      missing.push('screenshot.path must point at an existing file');
    } else if (HASH_64.test(String(screenshot.sha256 || ''))) {
      const actual = sha256File(screenshotAbsolute);
      if (actual.toLowerCase() !== String(screenshot.sha256).toLowerCase()) {
        missing.push('screenshot.sha256 must match the screenshot file');
      }
    }
  }

  const ready = missing.length === 0;
  return {
    ready,
    state: ready ? 'ready' : 'blocked',
    missing,
    evidence: ready
      ? [
          'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json',
          `capturedAt:${value.capturedAt}`,
          `telegram.initDataAgeSeconds:${initDataAgeSeconds}`,
          `screenshot.path:${screenshotPath}`,
          `screenshot:${screenshot.sha256}`,
        ]
      : [],
    detail: ready
      ? 'A redacted founder Telegram WebView proof artifact is present and fresh enough for the Worker initData gate.'
      : 'The Telegram WebView proof artifact exists, but it is incomplete, stale, mismatched, or unsafe to trust.',
  };
}

function normalizedUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function validateWorkerProbeArtifact(value, options = {}) {
  const tenant = options.tenant || 'cambium';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const workerUrl = normalizedUrl(options.workerUrl || DEFAULT_WORKER);
  const maxAgeSec = options.maxAgeSec ?? DEFAULT_WORKER_PROBE_MAX_AGE_SEC;
  const missing = [];

  if (!isObject(value)) {
    return { ready: false, state: 'blocked', missing: ['worker probe artifact must be a JSON object'] };
  }
  if (value.schema === 'cambium.worker-network-probe-template.v1' || value.writesAuthority === false) {
    return {
      ready: false,
      state: 'blocked',
      missing: ['replace template with real cambium.worker-network-probe.v1 artifact'],
      evidence: [],
      detail: 'A non-authoritative Worker probe template exists, but no production Worker list proof has been captured.',
    };
  }
  if (value.schema !== 'cambium.worker-network-probe.v1') missing.push('schema must be cambium.worker-network-probe.v1');
  if (value.tenant !== tenant) missing.push(`tenant must match ${tenant}`);
  if (value.source !== 'production-worker') missing.push('source must be production-worker');
  if (normalizedUrl(value.workerUrl) !== workerUrl) missing.push(`workerUrl must match ${workerUrl}`);
  if (hasSecretLeak(value)) missing.push('artifact must not contain bearer headers, tokens, cookies, authorization, or secrets');

  const capturedAtMs = Date.parse(String(value.capturedAt || ''));
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(capturedAtMs)) {
    missing.push('capturedAt must be a valid ISO timestamp');
  } else if (Number.isFinite(generatedAtMs)) {
    const ageSec = Math.floor((generatedAtMs - capturedAtMs) / 1000);
    if (ageSec < -300) missing.push('capturedAt cannot be in the future');
    if (ageSec > maxAgeSec) missing.push(`capturedAt must be within ${maxAgeSec} seconds`);
  }

  const probes = Array.isArray(value.probes) ? value.probes : [];
  if (!probes.length) missing.push('probes must include internal-gate-list');
  const gateList = probes.find((probe) => isObject(probe) && probe.name === 'internal-gate-list');
  if (!gateList) {
    missing.push('internal-gate-list probe is required');
  } else {
    if (gateList.method !== 'GET') missing.push('internal-gate-list.method must be GET');
    if (gateList.path !== `/internal/gate/${tenant}`) missing.push(`internal-gate-list.path must be /internal/gate/${tenant}`);
    if (Number(gateList.status) !== 200) missing.push('internal-gate-list.status must be 200');
    if (gateList.ok !== true) missing.push('internal-gate-list.ok must be true');
    const shape = isObject(gateList.responseShape) ? gateList.responseShape : {};
    if (shape.tenantMatches !== true) missing.push('internal-gate-list.responseShape.tenantMatches must be true');
    if (shape.actionsArray !== true) missing.push('internal-gate-list.responseShape.actionsArray must be true');
    const count = Number(gateList.queuedActionCount);
    if (!Number.isInteger(count) || count < 0) missing.push('internal-gate-list.queuedActionCount must be a non-negative integer');
    if (!HASH_64.test(String(gateList.bodySha256 || ''))) missing.push('internal-gate-list.bodySha256 must be sha256:<64 hex>');
  }

  const ready = missing.length === 0;
  const queuedActionCount = gateList ? Number(gateList.queuedActionCount) : 0;
  return {
    ready,
    state: ready ? 'ready' : 'blocked',
    missing,
    evidence: ready
      ? [
          'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json',
          `capturedAt:${value.capturedAt}`,
          `worker:${normalizedUrl(value.workerUrl)}`,
          `probe:GET /internal/gate/${tenant} -> 200`,
          `queuedActionCount:${queuedActionCount}`,
          `bodySha256:${gateList.bodySha256}`,
        ]
      : [],
    detail: ready
      ? 'A redacted production Worker internal gate-list probe artifact is present and fresh.'
      : 'The production Worker probe artifact is missing, stale, mismatched, or unsafe to trust.',
  };
}

function requireHash(value, field, missing) {
  if (!HASH_64.test(String(value || ''))) missing.push(`${field} must be sha256:<64 hex>`);
}

function requireNonNegativeInteger(value, field, missing) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) missing.push(`${field} must be a non-negative integer`);
}

export function validateSignedActionSmokeArtifact(value, options = {}) {
  const tenant = options.tenant || 'cambium';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const workerUrl = normalizedUrl(options.workerUrl || DEFAULT_WORKER);
  const maxAgeSec = options.maxAgeSec ?? DEFAULT_WORKER_PROBE_MAX_AGE_SEC;
  const missing = [];

  if (!isObject(value)) {
    return { ready: false, state: 'blocked', missing: ['signed action smoke artifact must be a JSON object'] };
  }
  if (value.schema === 'cambium.signed-action-smoke-template.v1' || value.writesAuthority === false) {
    return {
      ready: false,
      state: 'blocked',
      missing: ['replace template with real cambium.signed-action-smoke.v1 artifact'],
      evidence: [],
      detail: 'A non-authoritative signed-action smoke template exists, but no mutating Telegram action proof has been captured.',
    };
  }
  if (value.schema !== 'cambium.signed-action-smoke.v1') missing.push('schema must be cambium.signed-action-smoke.v1');
  if (value.tenant !== tenant) missing.push(`tenant must match ${tenant}`);
  if (value.source !== 'telegram-worker-operator-smoke') missing.push('source must be telegram-worker-operator-smoke');
  if (normalizedUrl(value.workerUrl) !== workerUrl) missing.push(`workerUrl must match ${workerUrl}`);
  if (!SIGNED_SMOKE_KINDS.includes(String(value.smokeKind))) missing.push(`smokeKind must be one of ${SIGNED_SMOKE_KINDS.join(', ')}`);
  if (hasSignedSmokeLeak(value)) missing.push('artifact must not contain initData, bearer headers, tokens, raw subjects, queued ids, founder ids, or raw bodies');

  const capturedAtMs = Date.parse(String(value.capturedAt || ''));
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(capturedAtMs)) {
    missing.push('capturedAt must be a valid ISO timestamp');
  } else if (Number.isFinite(generatedAtMs)) {
    const ageSec = Math.floor((generatedAtMs - capturedAtMs) / 1000);
    if (ageSec < -300) missing.push('capturedAt cannot be in the future');
    if (ageSec > maxAgeSec) missing.push(`capturedAt must be within ${maxAgeSec} seconds`);
  }

  const telegram = isObject(value.telegram) ? value.telegram : {};
  requireHash(telegram.userIdHash, 'telegram.userIdHash', missing);
  requireHash(telegram.initDataHash, 'telegram.initDataHash', missing);
  const initDataAgeSeconds = Number(telegram.initDataAgeSeconds);
  if (!Number.isFinite(initDataAgeSeconds) || initDataAgeSeconds < 0) {
    missing.push('telegram.initDataAgeSeconds must be a non-negative number');
  } else if (initDataAgeSeconds > WORKER_INITDATA_MAX_AGE_SEC) {
    missing.push(`telegram.initDataAgeSeconds must be <= ${WORKER_INITDATA_MAX_AGE_SEC}`);
  }

  const action = isObject(value.action) ? value.action : {};
  if (!GATE_ACTION_KINDS.includes(String(action.kind))) missing.push(`action.kind must be one of ${GATE_ACTION_KINDS.join(', ')}`);
  requireHash(action.subjectHash, 'action.subjectHash', missing);
  requireHash(action.idempotencyKeyHash, 'action.idempotencyKeyHash', missing);

  const phases = isObject(value.phases) ? value.phases : {};
  const telegramSubmit = isObject(phases.telegramSubmit) ? phases.telegramSubmit : {};
  if (Number(telegramSubmit.status) !== 200) missing.push('phases.telegramSubmit.status must be 200');
  if (telegramSubmit.queued !== true) missing.push('phases.telegramSubmit.queued must be true');
  if (typeof telegramSubmit.duplicate !== 'boolean') missing.push('phases.telegramSubmit.duplicate must be boolean');
  requireHash(telegramSubmit.queuedIdHash, 'phases.telegramSubmit.queuedIdHash', missing);
  requireHash(telegramSubmit.responseSha256, 'phases.telegramSubmit.responseSha256', missing);

  const workerList = isObject(phases.workerList) ? phases.workerList : {};
  if (Number(workerList.status) !== 200) missing.push('phases.workerList.status must be 200');
  if (workerList.sawQueuedAction !== true) missing.push('phases.workerList.sawQueuedAction must be true');
  requireNonNegativeInteger(workerList.queuedActionCount, 'phases.workerList.queuedActionCount', missing);
  requireHash(workerList.bodySha256, 'phases.workerList.bodySha256', missing);

  const operatorConsume = isObject(phases.operatorConsume) ? phases.operatorConsume : {};
  if (!String(operatorConsume.command || '').trim()) missing.push('phases.operatorConsume.command is required');
  requireNonNegativeInteger(operatorConsume.checked, 'phases.operatorConsume.checked', missing);
  const consumed = Number(operatorConsume.consumed);
  if (!Number.isInteger(consumed) || consumed < 1) missing.push('phases.operatorConsume.consumed must be an integer >= 1');
  requireNonNegativeInteger(operatorConsume.rejected, 'phases.operatorConsume.rejected', missing);
  requireHash(operatorConsume.auditSha256, 'phases.operatorConsume.auditSha256', missing);

  const miniAppRefresh = isObject(phases.miniAppRefresh) ? phases.miniAppRefresh : {};
  if (miniAppRefresh.refreshed !== true) missing.push('phases.miniAppRefresh.refreshed must be true');
  requireHash(miniAppRefresh.envelopeSha256, 'phases.miniAppRefresh.envelopeSha256', missing);
  requireHash(miniAppRefresh.visibleMarkerHash, 'phases.miniAppRefresh.visibleMarkerHash', missing);

  const ready = missing.length === 0;
  return {
    ready,
    state: ready ? 'ready' : 'blocked',
    missing,
    evidence: ready
      ? [
          'docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json',
          `smokeKind:${value.smokeKind}`,
          `action.kind:${action.kind}`,
          `capturedAt:${value.capturedAt}`,
          `worker:${normalizedUrl(value.workerUrl)}`,
          `consumed:${consumed}`,
          `visibleMarker:${miniAppRefresh.visibleMarkerHash}`,
        ]
      : [],
    detail: ready
      ? 'A redacted signed Telegram action smoke receipt proves queue, list, consume, and mini app refresh phases.'
      : 'No complete signed Telegram action smoke receipt exists yet; mutating live proof is still pending.',
  };
}

export async function captureWorkerProbe(options = {}) {
  const tenant = options.tenant || 'cambium';
  const workerUrl = normalizedUrl(options.workerUrl || DEFAULT_WORKER);
  const home = options.home || homedir();
  const env = options.env || process.env;
  if (!options.allowNetwork) throw new Error('refusing Worker probe capture without --allow-network');
  const token = options.token || resolvePushToken(env, home);
  if (!token) throw new Error('QUESTS_PUSH_TOKEN is required to capture the Worker probe');
  const fetchImpl = options.fetchImpl || fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable for Worker probe capture');

  const capturedAt = options.capturedAt || new Date().toISOString();
  const path = `/internal/gate/${tenant}`;
  const response = await fetchImpl(`${workerUrl}${path}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
  });
  const bodyText = await response.text();
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = null;
  }
  const actions = Array.isArray(body?.actions) ? body.actions : [];
  return {
    schema: 'cambium.worker-network-probe.v1',
    tenant,
    capturedAt,
    source: 'production-worker',
    workerUrl,
    probes: [
      {
        name: 'internal-gate-list',
        method: 'GET',
        path,
        status: Number(response.status || 0),
        ok: !!response.ok,
        responseShape: {
          tenantMatches: body?.tenant === tenant,
          actionsArray: Array.isArray(body?.actions),
        },
        queuedActionCount: actions.length,
        bodySha256: sha256Text(bodyText),
      },
    ],
    notes: [
      'Captured by live-proof-readiness --capture-worker-probe; credentials and raw response body omitted.',
    ],
  };
}

function defaultSmokeKindForAction(kind) {
  if (kind === 'promote-skill') return 'skill-promotion';
  if (kind === 'queue-side-quest') return 'side-quest';
  return 'gate-approval';
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function captureSignedActionSmoke(options = {}) {
  const cwd = options.cwd || process.cwd();
  const tenant = options.tenant || 'cambium';
  const workerUrl = normalizedUrl(options.workerUrl || DEFAULT_WORKER);
  const env = options.env || process.env;
  const home = options.home || homedir();
  if (!options.allowNetwork) throw new Error('refusing signed-action smoke capture without --allow-network');
  if (!options.allowMutation) throw new Error('refusing signed-action smoke capture without --allow-mutation');

  const token = options.token || resolvePushToken(env, home);
  if (!token) throw new Error('QUESTS_PUSH_TOKEN is required to capture the signed-action smoke');
  const fetchImpl = options.fetchImpl || fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable for signed-action smoke capture');

  const capturedAt = options.capturedAt || new Date().toISOString();
  const telegram = parseInitDataForProof(options.initData || initDataFromEnv(env), capturedAt);
  const actionKind = requiredString(options.actionKind, 'action kind');
  if (!GATE_ACTION_KINDS.includes(actionKind)) throw new Error(`action kind must be one of ${GATE_ACTION_KINDS.join(', ')}`);
  const smokeKind = String(options.smokeKind || defaultSmokeKindForAction(actionKind)).trim();
  if (!SIGNED_SMOKE_KINDS.includes(smokeKind)) throw new Error(`smoke kind must be one of ${SIGNED_SMOKE_KINDS.join(', ')}`);
  const subject = requiredString(options.actionSubject, 'action subject');
  const idempotencyKey = requiredString(options.actionIdempotencyKey, 'action idempotency key');
  const operatorCommand = requiredString(options.operatorCommand, 'operator command');
  const operatorAuditAbsolute = requiredExistingFile(cwd, options.operatorAuditPath, 'operator audit');
  const miniAppEnvelopeAbsolute = requiredExistingFile(cwd, options.miniAppEnvelopePath, 'mini app envelope');
  const visibleMarker = requiredString(options.visibleMarker, 'visible marker');
  const envelopeText = readFileSync(miniAppEnvelopeAbsolute, 'utf8');
  if (!envelopeText.includes(visibleMarker)) throw new Error('visible marker must appear in the mini app envelope file');

  const submitBody = {
    kind: actionKind,
    subject,
    initData: options.initData || initDataFromEnv(env),
    evidence: String(options.actionEvidence || '').trim() || 'live signed-action smoke capture',
    consequence: String(options.actionConsequence || '').trim() || `capture ${actionKind} smoke for ${subject}`,
    reversibility: String(options.actionReversibility || '').trim() || 'queued action can be superseded until operator consumption',
    idempotencyKey,
  };
  const submitResponse = await fetchImpl(`${workerUrl}/api/gate/${tenant}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(submitBody),
  });
  const submitText = await submitResponse.text();
  const submitJson = parseJsonText(submitText);
  const queuedId = String(submitJson?.queued || '');

  const listPath = `/internal/gate/${tenant}`;
  const listResponse = await fetchImpl(`${workerUrl}${listPath}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
  });
  const listText = await listResponse.text();
  const listJson = parseJsonText(listText);
  const actions = Array.isArray(listJson?.actions) ? listJson.actions : [];
  const sawQueuedAction = actions.some((action) => {
    if (!isObject(action)) return false;
    return String(action.id || '') === queuedId || String(action.idempotencyKey || '') === idempotencyKey;
  });

  return {
    schema: 'cambium.signed-action-smoke.v1',
    tenant,
    capturedAt,
    source: 'telegram-worker-operator-smoke',
    workerUrl,
    smokeKind,
    telegram,
    action: {
      kind: actionKind,
      subjectHash: sha256Text(subject),
      idempotencyKeyHash: sha256Text(idempotencyKey),
    },
    phases: {
      telegramSubmit: {
        status: Number(submitResponse.status || 0),
        queued: !!queuedId,
        duplicate: !!submitJson?.duplicate,
        queuedIdHash: sha256Text(queuedId),
        responseSha256: responseTextHash(submitText),
      },
      workerList: {
        status: Number(listResponse.status || 0),
        sawQueuedAction,
        queuedActionCount: actions.length,
        bodySha256: responseTextHash(listText),
      },
      operatorConsume: {
        command: operatorCommand,
        checked: requiredNonNegativeIntegerOption(options.operatorChecked, 'operator checked'),
        consumed: requiredNonNegativeIntegerOption(options.operatorConsumed, 'operator consumed'),
        rejected: requiredNonNegativeIntegerOption(options.operatorRejected, 'operator rejected'),
        auditSha256: sha256File(operatorAuditAbsolute),
      },
      miniAppRefresh: {
        refreshed: true,
        envelopeSha256: sha256File(miniAppEnvelopeAbsolute),
        visibleMarkerHash: sha256Text(visibleMarker),
      },
    },
    notes: [
      'Captured by live-proof-readiness --capture-signed-smoke; private inputs, queue identifiers, Worker bodies, and local audit/envelope contents omitted.',
    ],
  };
}

function assessDeviceProof(cwd, path, options) {
  const parsed = parseJsonArtifact(cwd, path);
  if (!parsed.exists) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'No live Telegram WebView proof artifact exists; local Chrome screenshots remain layout-only evidence.',
      evidence: [],
      missing: ['capture redacted cambium.tg-device-proof.v1 from a founder Telegram WebView session'],
    };
  }
  if (parsed.error) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'The Telegram WebView proof artifact could not be parsed.',
      evidence: [],
      missing: [parsed.error],
    };
  }
  const verdict = validateDeviceProofArtifact(parsed.value, { cwd, ...options });
  return {
    ...verdict,
    evidence: verdict.ready ? [path, ...(verdict.evidence || []).filter((entry) => entry !== path)] : [],
  };
}

function assessWorkerProbe(cwd, path, options) {
  const parsed = parseJsonArtifact(cwd, path);
  if (!parsed.exists) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'No redacted production Worker probe artifact exists; network authorization flags alone do not prove production KV behavior.',
      evidence: [],
      missing: ['capture redacted cambium.worker-network-probe.v1 from an authorized production Worker /internal/gate list probe'],
    };
  }
  if (parsed.error) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'The production Worker probe artifact could not be parsed.',
      evidence: [],
      missing: [parsed.error],
    };
  }
  const verdict = validateWorkerProbeArtifact(parsed.value, options);
  return {
    ...verdict,
    evidence: verdict.ready ? [path, ...(verdict.evidence || []).filter((entry) => entry !== path)] : [],
  };
}

function assessSignedActionSmoke(cwd, path, options) {
  const parsed = parseJsonArtifact(cwd, path);
  if (!parsed.exists) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'No redacted signed-action smoke receipt exists; queue/consume/refresh proof remains a live follow-up.',
      evidence: [],
      missing: ['capture redacted cambium.signed-action-smoke.v1 after Telegram signed action, Worker queue/list, operator consume, and mini app refresh'],
    };
  }
  if (parsed.error) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'The signed-action smoke receipt could not be parsed.',
      evidence: [],
      missing: [parsed.error],
    };
  }
  const verdict = validateSignedActionSmokeArtifact(parsed.value, options);
  return {
    ...verdict,
    evidence: verdict.ready ? [path, ...(verdict.evidence || []).filter((entry) => entry !== path)] : [],
  };
}

function item(id, label, state, detail, evidence, missing = []) {
  return { id, label, state, detail, evidence, missing };
}

function proofPathPrerequisite(cwd, path, id, label) {
  if (!String(path || '').trim()) return { id, state: 'blocked', detail: `${label} path is required` };
  try {
    const relPath = proofAssetRelativePath(cwd, path, label);
    const absolute = resolve(cwd, relPath);
    return existsSync(absolute)
      ? { id, state: 'ready', detail: `${relPath} exists under ${LIVE_PROOF_ASSET_DIR}` }
      : { id, state: 'blocked', detail: `${relPath} must exist under ${LIVE_PROOF_ASSET_DIR}` };
  } catch (error) {
    return { id, state: 'blocked', detail: error instanceof Error ? error.message : String(error) };
  }
}

function filePrerequisite(cwd, path, id, label) {
  if (!String(path || '').trim()) return { id, state: 'blocked', detail: `${label} path is required` };
  return existsSync(resolve(cwd, path))
    ? { id, state: 'ready', detail: `${path} exists` }
    : { id, state: 'blocked', detail: `${path} must exist` };
}

function valuePrerequisite(value, id, label) {
  return String(value || '').trim()
    ? { id, state: 'ready', detail: `${label} is supplied` }
    : { id, state: 'blocked', detail: `${label} is required` };
}

function flagPrerequisite(value, id, flagName) {
  return value
    ? { id, state: 'ready', detail: `${flagName} supplied` }
    : { id, state: 'blocked', detail: `${flagName} is required for this capture` };
}

function countPrerequisite(value, id, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { id, state: 'blocked', detail: `${label} must be supplied` };
  }
  const n = Number(value);
  return Number.isInteger(n) && n >= 0
    ? { id, state: 'ready', detail: `${label}=${n}` }
    : { id, state: 'blocked', detail: `${label} must be a non-negative integer` };
}

function visibleMarkerPrerequisite(cwd, envelopePath, visibleMarker) {
  const marker = String(visibleMarker || '').trim();
  if (!marker) return { id: 'visible-marker', state: 'blocked', detail: 'visible marker is required' };
  if (!String(envelopePath || '').trim()) return { id: 'visible-marker', state: 'blocked', detail: 'mini app envelope path is required before marker can be checked' };
  try {
    const text = readFileSync(resolve(cwd, envelopePath), 'utf8');
    return text.includes(marker)
      ? { id: 'visible-marker', state: 'ready', detail: 'visible marker appears in the mini app envelope' }
      : { id: 'visible-marker', state: 'blocked', detail: 'visible marker must appear in the mini app envelope' };
  } catch {
    return { id: 'visible-marker', state: 'blocked', detail: 'mini app envelope must be readable before marker can be checked' };
  }
}

function stepState(artifactReady, prerequisites) {
  if (artifactReady) return 'complete';
  return prerequisites.every((entry) => entry.state === 'ready') ? 'ready-to-capture' : 'blocked';
}

function buildCapturePlan(options) {
  const {
    cwd,
    hasInitData,
    hasToken,
    allowNetwork,
    allowMutation,
    deviceProof,
    workerProbe,
    signedSmoke,
    workerUrl,
    args,
  } = options;
  const envInit = { id: 'fresh-telegram-init-data', state: hasInitData ? 'ready' : 'blocked', detail: hasInitData ? 'TELEGRAM_INIT_DATA or TG_INIT_DATA is present' : 'capture fresh TELEGRAM_INIT_DATA or TG_INIT_DATA from a founder Telegram WebView' };
  const workerToken = { id: 'worker-token', state: hasToken ? 'ready' : 'blocked', detail: hasToken ? 'QUESTS_PUSH_TOKEN is available without printing it' : 'QUESTS_PUSH_TOKEN is required without storing it in artifacts' };
  const devicePrerequisites = [
    envInit,
    proofPathPrerequisite(cwd, args.screenshotPath, 'screenshot-under-proof-dir', 'founder-device screenshot'),
    valuePrerequisite(args.devicePlatform, 'device-platform', 'device platform'),
    valuePrerequisite(args.webViewUrl, 'webview-url', 'WebView URL'),
  ];
  const workerPrerequisites = [
    workerToken,
    flagPrerequisite(allowNetwork, 'allow-network', '--allow-network'),
  ];
  const signedPrerequisites = [
    envInit,
    workerToken,
    flagPrerequisite(allowNetwork, 'allow-network', '--allow-network'),
    flagPrerequisite(allowMutation, 'allow-mutation', '--allow-mutation'),
    valuePrerequisite(args.actionKind, 'action-kind', 'action kind'),
    valuePrerequisite(args.actionSubject, 'action-subject', 'action subject'),
    valuePrerequisite(args.actionIdempotencyKey, 'action-idempotency-key', 'action idempotency key'),
    valuePrerequisite(args.operatorCommand, 'operator-command', 'operator command'),
    filePrerequisite(cwd, args.operatorAuditPath, 'operator-audit', 'operator audit'),
    countPrerequisite(args.operatorChecked, 'operator-checked', 'operator checked'),
    countPrerequisite(args.operatorConsumed, 'operator-consumed', 'operator consumed'),
    countPrerequisite(args.operatorRejected, 'operator-rejected', 'operator rejected'),
    filePrerequisite(cwd, args.miniAppEnvelopePath, 'miniapp-envelope', 'mini app envelope'),
    visibleMarkerPrerequisite(cwd, args.miniAppEnvelopePath, args.visibleMarker),
  ];
  return {
    schema: 'cambium.tg-live-proof-capture-plan.v1',
    invariant: 'Capture commands create redacted receipts; they are proof only after their artifacts validate ready.',
    workerUrl,
    steps: [
      {
        id: 'device-webview-proof',
        writes: DEFAULT_DEVICE_PROOF,
        state: stepState(deviceProof.ready, devicePrerequisites),
        command: 'node workers/quests/src/live-proof-readiness.mjs --capture-device-proof --screenshot docs/plans/assets/tg-miniapp-live-proof/<founder-device>.png --platform <ios|android|desktop> --webview-url <current Telegram WebView URL> --safe-area <notes> --write',
        prerequisites: devicePrerequisites,
        privacy: ['raw initData comes only from env', 'artifact stores user/initData/screenshot hashes only', 'WebView query and hash are omitted'],
      },
      {
        id: 'worker-list-proof',
        writes: DEFAULT_WORKER_PROBE,
        state: stepState(workerProbe.ready, workerPrerequisites),
        command: 'node workers/quests/src/live-proof-readiness.mjs --capture-worker-probe --allow-network --write',
        prerequisites: workerPrerequisites,
        privacy: ['Worker credential is used only as an authorization header', 'artifact stores status, response shape, counts, and body digest only'],
      },
      {
        id: 'signed-action-smoke',
        writes: DEFAULT_SIGNED_SMOKE,
        state: stepState(signedSmoke.ready, signedPrerequisites),
        command: 'node workers/quests/src/live-proof-readiness.mjs --capture-signed-smoke --allow-network --allow-mutation --action-kind <kind> --action-subject <subject> --action-idempotency-key <key> --operator-command "<consumer command>" --operator-audit <audit-file> --operator-checked <n> --operator-consumed <n> --operator-rejected <n> --miniapp-envelope <refreshed-envelope-file> --visible-marker <visible-card-marker> --write',
        prerequisites: signedPrerequisites,
        privacy: ['raw initData is sent only in the Telegram submit body', 'Worker credential is used only for the internal list request', 'proof tool does not consume the queue', 'artifact stores hashes, counts, status codes, and digests only'],
      },
    ],
  };
}

export function assessLiveProofReadiness(options = {}) {
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const home = options.home || homedir();
  const tenant = options.tenant || env.TENANT || 'cambium';
  const allowNetwork = !!options.allowNetwork;
  const workerUrl = options.workerUrl || env.QUESTS_WORKER_URL || DEFAULT_WORKER;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const hasToken = hasAnyEnv(env, ['QUESTS_PUSH_TOKEN']) || readEnvFileToken(home);
  const hasInitData = hasAnyEnv(env, ['TELEGRAM_INIT_DATA', 'TG_INIT_DATA']);
  const deviceProofPath = options.deviceProofPath || DEFAULT_DEVICE_PROOF;
  const deviceProof = assessDeviceProof(cwd, deviceProofPath, {
    tenant,
    generatedAt,
    maxAgeSec: options.deviceProofMaxAgeSec ?? DEFAULT_DEVICE_PROOF_MAX_AGE_SEC,
  });
  const workerProbePath = options.workerProbePath || DEFAULT_WORKER_PROBE;
  const workerProbe = assessWorkerProbe(cwd, workerProbePath, {
    tenant,
    generatedAt,
    workerUrl,
    maxAgeSec: options.workerProbeMaxAgeSec ?? DEFAULT_WORKER_PROBE_MAX_AGE_SEC,
  });
  const signedSmokePath = options.signedSmokePath || DEFAULT_SIGNED_SMOKE;
  const signedSmoke = assessSignedActionSmoke(cwd, signedSmokePath, {
    tenant,
    generatedAt,
    workerUrl,
    maxAgeSec: options.signedSmokeMaxAgeSec ?? DEFAULT_WORKER_PROBE_MAX_AGE_SEC,
  });
  const chrome = env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const viewportManifestPath = 'docs/plans/assets/tg-miniapp-viewport-proof/manifest.json';
  const viewportFailurePath = 'docs/plans/assets/tg-miniapp-viewport-proof/failure.json';
  const viewportDiagnosticsPath = 'docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json';
  const viewportManifest = artifactExists(cwd, viewportManifestPath);
  const viewportFailure = artifactExists(cwd, viewportFailurePath);
  const viewportDiagnostics = artifactExists(cwd, viewportDiagnosticsPath);
  const viewportFailureNewer = viewportFailure && artifactMtimeMs(cwd, viewportFailurePath) >= artifactMtimeMs(cwd, viewportManifestPath);
  const viewportReady = viewportManifest && !viewportFailureNewer;
  const promotionConsumer = fileHas(cwd, 'bin/quine/hyphae/skills.ts', 'applySkillPromotionDecisions');
  const sideQuestConsumer = fileHas(cwd, 'bin/quine/hyphae/quests.ts', 'applySideQuestQueueDecisions');
  const npcLocalSmoke = fileHas(cwd, 'workers/quests/src/handler.test.ts', 'NPC history smoke flows from quine write to companion sheet');
  const pageUsesInitData = fileHas(cwd, 'workers/quests/src/page.ts', 'TG && TG.initData');
  const workerValidatesInitData = fileHas(cwd, 'workers/quests/src/handler.ts', 'validateInitData');

  const items = [
    item(
      'telegram-init-data',
      'Real Telegram initData available',
      hasInitData ? 'ready' : 'blocked',
      hasInitData
        ? 'A real Telegram WebView initData value is present in the environment; value is redacted.'
        : 'No real Telegram WebView initData is present, so signed founder actions cannot be proven live.',
      hasInitData ? ['env:TELEGRAM_INIT_DATA or env:TG_INIT_DATA present'] : [],
      hasInitData ? [] : ['TELEGRAM_INIT_DATA or TG_INIT_DATA from a founder Telegram WebView session'],
    ),
    item(
      'telegram-device-artifact',
      'Founder device WebView artifact captured',
      deviceProof.state,
      deviceProof.detail,
      deviceProof.evidence || [],
      deviceProof.missing || [],
    ),
    item(
      'worker-token',
      'Production Worker internal token available',
      hasToken ? 'ready' : 'blocked',
      hasToken
        ? 'QUESTS_PUSH_TOKEN is available without printing the secret.'
        : 'No Worker internal token is available, so production queue/list/consume cannot be probed.',
      hasToken ? ['QUESTS_PUSH_TOKEN present in env or ~/.claude/.env'] : [],
      hasToken ? [] : ['QUESTS_PUSH_TOKEN'],
    ),
    item(
      'worker-network-probe',
      'Production Worker network probe captured',
      workerProbe.state,
      workerProbe.ready
        ? workerProbe.detail
        : allowNetwork && hasToken
          ? `${workerProbe.detail} Network probing is authorized for ${workerUrl}; capture and save the probe receipt.`
          : `${workerProbe.detail} Network probing is disabled or lacks token in this run.`,
      workerProbe.evidence || [],
      workerProbe.ready
        ? []
        : [
            ...(workerProbe.missing || []),
            ...(allowNetwork && hasToken ? [] : ['rerun with --allow-network and a valid QUESTS_PUSH_TOKEN when capturing the probe']),
          ],
    ),
    item(
      'page-initdata-path',
      'Mini app sends Telegram initData to signed actions',
      pageUsesInitData ? 'ready' : 'blocked',
      pageUsesInitData
        ? 'The page reads Telegram WebApp initData before posting gate actions.'
        : 'The page does not expose the expected Telegram initData gate path.',
      pageUsesInitData ? ['workers/quests/src/page.ts contains TG initData usage'] : [],
      pageUsesInitData ? [] : ['restore page initData forwarding for gate actions'],
    ),
    item(
      'worker-initdata-validation',
      'Worker validates Telegram initData',
      workerValidatesInitData ? 'ready' : 'blocked',
      workerValidatesInitData
        ? 'The Worker route still validates Telegram initData before queueing gate actions.'
        : 'The Worker no longer exposes the expected initData validation path.',
      workerValidatesInitData ? ['workers/quests/src/handler.ts contains validateInitData'] : [],
      workerValidatesInitData ? [] : ['restore Worker validateInitData gate'],
    ),
    item(
      'promotion-consumer',
      'Skill promotion operator consumer exists',
      promotionConsumer ? 'ready' : 'blocked',
      promotionConsumer
        ? 'Skill promotions have an operator-owned queue consumer.'
        : 'Signed promotion actions can queue, but no local operator consumer is present.',
      promotionConsumer ? ['bin/quine/hyphae/skills.ts applySkillPromotionDecisions'] : [],
      promotionConsumer ? [] : ['implement applySkillPromotionDecisions'],
    ),
    item(
      'side-quest-consumer',
      'Side-quest operator consumer exists',
      sideQuestConsumer ? 'ready' : 'blocked',
      sideQuestConsumer
        ? 'Side quests have an operator-owned queue consumer with current-envelope re-checks.'
        : 'Signed side-quest actions can queue, but no local operator consumer is present.',
      sideQuestConsumer ? ['bin/quine/hyphae/quests.ts applySideQuestQueueDecisions'] : [],
      sideQuestConsumer ? [] : ['implement applySideQuestQueueDecisions'],
    ),
    item(
      'npc-local-smoke',
      'NPC local smoke remains deterministic-only',
      npcLocalSmoke ? 'ready' : 'blocked',
      npcLocalSmoke
        ? 'A local NPC history smoke exists; live device provenance still depends on Telegram and Worker proof items.'
        : 'No deterministic NPC history smoke marker was found.',
      npcLocalSmoke ? ['workers/quests/src/handler.test.ts NPC history smoke'] : [],
      npcLocalSmoke ? [] : ['restore deterministic NPC mini app smoke'],
    ),
    item(
      'viewport-layout-proof',
      'Local mobile viewport proof available',
      viewportReady ? 'ready' : 'blocked',
      viewportFailureNewer
        ? viewportDiagnostics
          ? 'The latest local viewport proof attempt failed; browser diagnostics are available, but screenshots remain stale until manifest.json is regenerated by a passing run.'
          : 'The latest local viewport proof attempt failed; existing screenshots are stale until manifest.json is regenerated by a passing run.'
        : viewportManifest
          ? 'A fresh-enough viewport manifest exists and no newer failure receipt supersedes it.'
          : existsSync(chrome)
            ? `Chrome binary exists at ${chrome}; npm run proof:tg-viewport can attempt a layout proof, but no manifest has been generated yet.`
            : `Chrome binary missing at ${chrome}; no local layout proof can run from this machine.`,
      [
        ...(existsSync(chrome) ? [`chrome:${chrome}`] : []),
        ...(viewportManifest ? [viewportManifestPath] : []),
        ...(viewportFailure ? [viewportFailurePath] : []),
        ...(viewportDiagnostics ? [viewportDiagnosticsPath] : []),
      ],
      viewportReady ? [] : [
        viewportFailureNewer
          ? 'repair local browser CDP and rerun npm run proof:tg-viewport to regenerate manifest.json'
          : 'run npm run proof:tg-viewport with CHROME_BIN pointing at a browser with CDP support to generate manifest.json',
      ],
    ),
  ];

  const ready = items.filter((entry) => entry.state === 'ready').length;
  const blocked = items.length - ready;
  const liveRequired = ['telegram-init-data', 'telegram-device-artifact', 'worker-token', 'worker-network-probe'];
  const liveReady = liveRequired.every((id) => items.find((entry) => entry.id === id)?.state === 'ready');
  const capturePlan = buildCapturePlan({
    cwd,
    hasInitData,
    hasToken,
    allowNetwork,
    allowMutation: !!options.allowMutation,
    deviceProof,
    workerProbe,
    signedSmoke,
    workerUrl,
    args: {
      screenshotPath: options.screenshotPath || '',
      devicePlatform: options.devicePlatform || options.platform || '',
      webViewUrl: options.webViewUrl || '',
      actionKind: options.actionKind || '',
      actionSubject: options.actionSubject || '',
      actionIdempotencyKey: options.actionIdempotencyKey || '',
      operatorCommand: options.operatorCommand || '',
      operatorAuditPath: options.operatorAuditPath || '',
      operatorChecked: options.operatorChecked,
      operatorConsumed: options.operatorConsumed,
      operatorRejected: options.operatorRejected,
      miniAppEnvelopePath: options.miniAppEnvelopePath || '',
      visibleMarker: options.visibleMarker || '',
    },
  });
  return {
    schema: 'cambium.tg-live-proof-readiness.v1',
    generatedAt,
    tenant,
    workerUrl,
    status: liveReady && blocked === 0 ? 'ready' : 'blocked',
    summary: {
      ready,
      blocked,
      total: items.length,
      liveProofReady: liveReady,
    },
    invariant: 'Local deterministic smokes and Chrome viewport screenshots do not prove live Telegram WebView or production Worker KV behavior.',
    items,
    capturePlan,
    followups: {
      signedActionSmoke: {
        schema: 'cambium.signed-action-smoke-readiness.v1',
        path: signedSmokePath,
        state: signedSmoke.state,
        detail: signedSmoke.detail,
        evidence: signedSmoke.evidence || [],
        missing: signedSmoke.missing || [],
        invariant: 'Signed action smoke receipts prove mutating Telegram queue/consume/refresh paths and are tracked separately from the base live WebView/Worker readiness gate.',
      },
    },
  };
}

export function writeReadinessManifest(report, outPath = DEFAULT_OUT, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(report, null, 2) + '\n');
  return absolute;
}

export function writeDeviceProofTemplate(template, outPath = DEFAULT_DEVICE_TEMPLATE, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(template, null, 2) + '\n');
  return absolute;
}

export function writeDeviceProofArtifact(artifact, outPath = DEFAULT_DEVICE_PROOF, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(artifact, null, 2) + '\n');
  return absolute;
}

export function writeWorkerProbeTemplate(template, outPath = DEFAULT_WORKER_TEMPLATE, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(template, null, 2) + '\n');
  return absolute;
}

export function writeWorkerProbeArtifact(artifact, outPath = DEFAULT_WORKER_PROBE, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(artifact, null, 2) + '\n');
  return absolute;
}

export function writeSignedActionSmokeTemplate(template, outPath = DEFAULT_SIGNED_SMOKE_TEMPLATE, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(template, null, 2) + '\n');
  return absolute;
}

export function writeSignedActionSmokeArtifact(artifact, outPath = DEFAULT_SIGNED_SMOKE, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(artifact, null, 2) + '\n');
  return absolute;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.captureDeviceProof) {
    const artifact = captureDeviceProof({
      cwd: args.cwd,
      tenant: args.tenant,
      env: process.env,
      screenshotPath: args.screenshotPath,
      webViewUrl: args.webViewUrl,
      platform: args.devicePlatform,
      safeArea: args.safeArea,
    });
    const verdict = validateDeviceProofArtifact(artifact, {
      cwd: args.cwd,
      tenant: args.tenant,
      generatedAt: artifact.capturedAt,
    });
    if (!verdict.ready) throw new Error(`captured device proof is incomplete: ${verdict.missing.join('; ')}`);
    writeDeviceProofArtifact(artifact, args.deviceProofPath, args.cwd);
  }
  if (args.captureWorkerProbe) {
    const artifact = await captureWorkerProbe({
      tenant: args.tenant,
      workerUrl: args.workerUrl,
      allowNetwork: args.allowNetwork,
      env: process.env,
      home: homedir(),
    });
    writeWorkerProbeArtifact(artifact, args.workerProbePath, args.cwd);
  }
  if (args.captureSignedSmoke) {
    const artifact = await captureSignedActionSmoke({
      cwd: args.cwd,
      tenant: args.tenant,
      workerUrl: args.workerUrl,
      allowNetwork: args.allowNetwork,
      allowMutation: args.allowMutation,
      env: process.env,
      home: homedir(),
      smokeKind: args.smokeKind,
      actionKind: args.actionKind,
      actionSubject: args.actionSubject,
      actionEvidence: args.actionEvidence,
      actionConsequence: args.actionConsequence,
      actionReversibility: args.actionReversibility,
      actionIdempotencyKey: args.actionIdempotencyKey,
      operatorCommand: args.operatorCommand,
      operatorAuditPath: args.operatorAuditPath,
      operatorChecked: args.operatorChecked,
      operatorConsumed: args.operatorConsumed,
      operatorRejected: args.operatorRejected,
      miniAppEnvelopePath: args.miniAppEnvelopePath,
      visibleMarker: args.visibleMarker,
    });
    const verdict = validateSignedActionSmokeArtifact(artifact, {
      tenant: args.tenant,
      workerUrl: args.workerUrl,
      generatedAt: artifact.capturedAt,
    });
    if (!verdict.ready) throw new Error(`captured signed-action smoke is incomplete: ${verdict.missing.join('; ')}`);
    writeSignedActionSmokeArtifact(artifact, args.signedSmokePath, args.cwd);
  }
  const report = assessLiveProofReadiness(args);
  if (args.write) writeReadinessManifest(report, args.out, args.cwd);
  if (args.writeDeviceTemplate) {
    writeDeviceProofTemplate(
      createDeviceProofTemplate({ tenant: args.tenant, generatedAt: report.generatedAt }),
      args.deviceTemplateOut,
      args.cwd,
    );
  }
  if (args.writeWorkerTemplate) {
    writeWorkerProbeTemplate(
      createWorkerProbeTemplate({ tenant: args.tenant, workerUrl: args.workerUrl, generatedAt: report.generatedAt }),
      args.workerTemplateOut,
      args.cwd,
    );
  }
  if (args.writeSignedSmokeTemplate) {
    writeSignedActionSmokeTemplate(
      createSignedActionSmokeTemplate({ tenant: args.tenant, workerUrl: args.workerUrl, generatedAt: report.generatedAt }),
      args.signedSmokeTemplateOut,
      args.cwd,
    );
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = args.strict && report.status !== 'ready' ? 2 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  });
}
