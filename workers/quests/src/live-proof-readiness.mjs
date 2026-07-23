#!/usr/bin/env node
// Live-proof readiness audit for the Telegram mini app (readiness schema v2).
//
// This is intentionally not a live proof by itself. It records whether the
// specific evidence needed for a live Telegram WebView / production Worker
// smoke is present, so local deterministic smokes cannot be mistaken for
// founder-device proof.
//
// Readiness v2 contract (2026-07-24 mobile redesign freeze):
// - Runtime initData auth inside the Telegram WebView stays unchanged and is
//   validated server-side; this tool never needs raw initData.
// - The manual initData verification ritual is RETIRED. Telegram desktop no
//   longer exposes WebView inspect, so pasted initData is impossible here:
//   TELEGRAM_INIT_DATA / TG_INIT_DATA env vars hard-block readiness, retired
//   CLI capture flags are rejected, and validators hard-fail any artifact
//   containing raw initData markers.
// - Founder-device proof is an IN-APP signed gate action whose redacted
//   receipt artifact (cambium.signed-action-smoke.v2: userIdHash, actionKind,
//   subjectHash, idempotencyHash, workerVersionId, capturedAt — hashes only)
//   validates under this readiness schema. The CLI never submits signed
//   actions; it only validates redacted receipts produced by the in-app flow.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE } from './page.ts';

const DEFAULT_OUT = '.artifacts/tg-miniapp-live-proof/readiness.json';
const DEFAULT_RECEIPT = '.artifacts/tg-miniapp-live-proof/signed-action-smoke.json';
const DEFAULT_RECEIPT_TEMPLATE = '.artifacts/tg-miniapp-live-proof/signed-action-smoke.template.json';
const DEFAULT_WORKER_PROBE = '.artifacts/tg-miniapp-live-proof/worker-network-probe.json';
const DEFAULT_WORKER_TEMPLATE = '.artifacts/tg-miniapp-live-proof/worker-network-probe.template.json';
const DEFAULT_WORKER = 'https://curious.thoughtseed.space';
const DEFAULT_RECEIPT_MAX_AGE_SEC = 24 * 60 * 60;
const DEFAULT_WORKER_PROBE_MAX_AGE_SEC = 24 * 60 * 60;
const HASH_64 = /^sha256:[a-f0-9]{64}$/i;
const RECEIPT_SCHEMA = 'cambium.signed-action-smoke.v2';
const RECEIPT_TEMPLATE_SCHEMA = 'cambium.signed-action-smoke-template.v2';
const RECEIPT_SOURCE = 'in-app-signed-gate-action';
const RETIRED_RECEIPT_SCHEMAS = ['cambium.tg-device-proof.v1', 'cambium.signed-action-smoke.v1'];
const RETIRED_INITDATA_ENV_NAMES = ['TELEGRAM_INIT_DATA', 'TG_INIT_DATA'];
const GATE_ACTION_KINDS = ['approve', 'reroll', 'promote-skill', 'queue-side-quest', 'confirm-action-request'];
const CURRENT_PAGE_SOURCE_SHA256 = createHash('sha256').update(PAGE).digest('hex');
const RAW_INITDATA_MARKERS = [
  /(?:^|[?&\s])query_id=/i,
  /(?:^|[?&\s])auth_date=/i,
  /(?:^|[?&\s])hash=/i,
  /(?:^|[?&\s])signature=/i,
  /tgWebAppData=/i,
  /TELEGRAM_INIT_DATA=/i,
  /TG_INIT_DATA=/i,
];
const SECRET_MARKERS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /QUESTS_PUSH_TOKEN/i,
  /authorization/i,
  /cookie/i,
  /secret/i,
  /token/i,
];
const RETIRED_FLAGS = new Set([
  '--capture-device-proof',
  '--capture-signed-smoke',
  '--device-proof',
  '--device-template-out',
  '--write-device-template',
  '--screenshot',
  '--webview-url',
  '--platform',
  '--safe-area',
  '--smoke-kind',
  '--action-kind',
  '--action-subject',
  '--action-evidence',
  '--action-consequence',
  '--action-reversibility',
  '--action-idempotency-key',
  '--operator-command',
  '--operator-audit',
  '--operator-checked',
  '--operator-consumed',
  '--operator-rejected',
  '--miniapp-envelope',
  '--visible-marker',
  '--allow-mutation',
]);

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

export function parseArgs(argv) {
  const out = {
    tenant: process.env.TENANT || 'cambium',
    cwd: process.cwd(),
    write: false,
    out: DEFAULT_OUT,
    receiptPath: DEFAULT_RECEIPT,
    receiptTemplateOut: DEFAULT_RECEIPT_TEMPLATE,
    writeReceiptTemplate: false,
    workerProbePath: DEFAULT_WORKER_PROBE,
    workerTemplateOut: DEFAULT_WORKER_TEMPLATE,
    writeWorkerTemplate: false,
    captureWorkerProbe: false,
    allowNetwork: false,
    workerUrl: process.env.QUESTS_WORKER_URL || DEFAULT_WORKER,
    strict: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (RETIRED_FLAGS.has(arg)) {
      throw new Error(`${arg} is retired: the manual initData capture flow was removed in readiness v2; founder-device proof is the in-app signed action receipt artifact`);
    }
    if (arg === '--tenant') out.tenant = argv[++i] || out.tenant;
    else if (arg === '--cwd') out.cwd = argv[++i] || out.cwd;
    else if (arg === '--out') out.out = argv[++i] || out.out;
    else if (arg === '--receipt') out.receiptPath = argv[++i] || out.receiptPath;
    else if (arg === '--receipt-template-out') out.receiptTemplateOut = argv[++i] || out.receiptTemplateOut;
    else if (arg === '--worker-probe') out.workerProbePath = argv[++i] || out.workerProbePath;
    else if (arg === '--worker-template-out') out.workerTemplateOut = argv[++i] || out.workerTemplateOut;
    else if (arg === '--write') out.write = true;
    else if (arg === '--write-receipt-template') out.writeReceiptTemplate = true;
    else if (arg === '--write-worker-template') out.writeWorkerTemplate = true;
    else if (arg === '--capture-worker-probe') out.captureWorkerProbe = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--allow-network') out.allowNetwork = true;
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

function artifactReceiptTimeMs(cwd, path) {
  const artifact = parseJsonArtifact(cwd, path);
  const generatedAtMs = Date.parse(String(artifact.value?.generatedAt || ''));
  return Number.isFinite(generatedAtMs) ? generatedAtMs : artifactMtimeMs(cwd, path);
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

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function normalizedUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function requireHash(value, field, missing) {
  if (!HASH_64.test(String(value || ''))) missing.push(`${field} must be sha256:<64 hex>`);
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
    instruction: 'Copy sourceDocument to worker-network-probe.json only after an authorized production Worker list probe. Store status, counts, and response digests only; never store bearer headers, credentials, cookies, or raw response bodies.',
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

export function createSignedActionReceiptTemplate(options = {}) {
  const tenant = options.tenant || 'cambium';
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    schema: RECEIPT_TEMPLATE_SCHEMA,
    generatedAt,
    tenant,
    writesAuthority: false,
    instruction: 'Copy sourceDocument to signed-action-smoke.json only after a real in-app signed gate action emits its redacted receipt. Store hashes only; never paste raw initData, query strings, Telegram user ids, or credentials.',
    sourceDocument: {
      schema: RECEIPT_SCHEMA,
      tenant,
      capturedAt: 'TODO-ISO-8601',
      source: RECEIPT_SOURCE,
      userIdHash: 'sha256:TODO_SHA256_OF_TELEGRAM_USER_ID',
      actionKind: 'TODO-approve-or-reroll-or-promote-skill-or-queue-side-quest-or-confirm-action-request',
      subjectHash: 'sha256:TODO_SHA256_OF_REDACTED_SUBJECT',
      idempotencyHash: 'sha256:TODO_SHA256_OF_IDEMPOTENCY_KEY',
      workerVersionId: 'TODO-WORKER-VERSION-ID',
      notes: [
        'TODO record the gate action context without storing private action payloads.',
      ],
    },
  };
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
  if (hasSecretLeak(value)) missing.push('artifact must not contain bearer headers, credentials, cookies, authorization, or secrets');

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
          '.artifacts/tg-miniapp-live-proof/worker-network-probe.json',
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

export function validateSignedActionReceiptArtifact(value, options = {}) {
  const tenant = options.tenant || 'cambium';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const maxAgeSec = options.maxAgeSec ?? DEFAULT_RECEIPT_MAX_AGE_SEC;
  const missing = [];

  if (!isObject(value)) {
    return { ready: false, state: 'blocked', missing: ['signed action receipt artifact must be a JSON object'] };
  }
  if (value.schema === RECEIPT_TEMPLATE_SCHEMA || value.writesAuthority === false) {
    return {
      ready: false,
      state: 'blocked',
      missing: [`replace template with real ${RECEIPT_SCHEMA} artifact`],
      evidence: [],
      detail: 'A non-authoritative receipt template exists, but no in-app signed gate action receipt has been captured.',
    };
  }
  if (RETIRED_RECEIPT_SCHEMAS.includes(String(value.schema))) {
    missing.push(`${value.schema} artifacts are retired; founder-device proof is the in-app signed action receipt (${RECEIPT_SCHEMA})`);
  }
  if (value.schema !== RECEIPT_SCHEMA) missing.push(`schema must be ${RECEIPT_SCHEMA}`);
  if (value.tenant !== tenant) missing.push(`tenant must match ${tenant}`);
  if (value.source !== RECEIPT_SOURCE) missing.push(`source must be ${RECEIPT_SOURCE}`);

  // Hard fail: pasted initData, query strings, credentials, or retired v1
  // proof fields make the artifact unsafe to trust no matter what else it
  // contains. Pasted initData must be impossible under readiness v2.
  if (hasRawInitDataLeak(value)) missing.push('artifact must not contain raw initData, auth_date, signature, hash, query_id, tgWebAppData, or initData env values');
  if (hasSecretLeak(value)) missing.push('artifact must not contain bearer headers, credentials, cookies, authorization, or secrets');
  for (const retiredField of ['telegram', 'phases', 'screenshot', 'webView', 'initDataHash', 'initDataAgeSeconds']) {
    if (Object.prototype.hasOwnProperty.call(value, retiredField)) {
      missing.push(`retired v1 proof field ${retiredField} must not appear in a ${RECEIPT_SCHEMA} receipt`);
    }
  }

  const capturedAtMs = Date.parse(String(value.capturedAt || ''));
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(capturedAtMs)) {
    missing.push('capturedAt must be a valid ISO timestamp');
  } else if (Number.isFinite(generatedAtMs)) {
    const ageSec = Math.floor((generatedAtMs - capturedAtMs) / 1000);
    if (ageSec < -300) missing.push('capturedAt cannot be in the future');
    if (ageSec > maxAgeSec) missing.push(`capturedAt must be within ${maxAgeSec} seconds`);
  }

  requireHash(value.userIdHash, 'userIdHash', missing);
  if (!GATE_ACTION_KINDS.includes(String(value.actionKind))) missing.push(`actionKind must be one of ${GATE_ACTION_KINDS.join(', ')}`);
  requireHash(value.subjectHash, 'subjectHash', missing);
  requireHash(value.idempotencyHash, 'idempotencyHash', missing);
  if (!String(value.workerVersionId || '').trim()) missing.push('workerVersionId is required');

  const ready = missing.length === 0;
  return {
    ready,
    state: ready ? 'ready' : 'blocked',
    missing,
    evidence: ready
      ? [
          '.artifacts/tg-miniapp-live-proof/signed-action-smoke.json',
          `capturedAt:${value.capturedAt}`,
          `actionKind:${value.actionKind}`,
          `workerVersionId:${value.workerVersionId}`,
          `userIdHash:${value.userIdHash}`,
          `subjectHash:${value.subjectHash}`,
          `idempotencyHash:${value.idempotencyHash}`,
        ]
      : [],
    detail: ready
      ? 'A redacted in-app signed gate action receipt proves the founder device ran a real Telegram WebView action.'
      : 'No complete redacted in-app signed gate action receipt exists yet; founder-device proof is still pending.',
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

function assessSignedActionReceipt(cwd, path, options) {
  const parsed = parseJsonArtifact(cwd, path);
  if (!parsed.exists) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'No redacted in-app signed action receipt exists; founder-device proof remains a live follow-up.',
      evidence: [],
      missing: [`perform one signed gate action inside the Telegram mini app and save the redacted ${RECEIPT_SCHEMA} receipt`],
    };
  }
  if (parsed.error) {
    return {
      ready: false,
      state: 'blocked',
      detail: 'The in-app signed action receipt could not be parsed.',
      evidence: [],
      missing: [parsed.error],
    };
  }
  const verdict = validateSignedActionReceiptArtifact(parsed.value, options);
  return {
    ...verdict,
    evidence: verdict.ready ? [path, ...(verdict.evidence || []).filter((entry) => entry !== path)] : [],
  };
}

function item(id, label, state, detail, evidence, missing = []) {
  return { id, label, state, detail, evidence, missing };
}

function flagPrerequisite(value, id, flagName) {
  return value
    ? { id, state: 'ready', detail: `${flagName} supplied` }
    : { id, state: 'blocked', detail: `${flagName} is required for this capture` };
}

function stepState(artifactReady, prerequisites) {
  if (artifactReady) return 'complete';
  return prerequisites.every((entry) => entry.state === 'ready') ? 'ready-to-capture' : 'blocked';
}

function buildCapturePlan(options) {
  const {
    hasPastedInitData,
    hasToken,
    allowNetwork,
    receipt,
    workerProbe,
    workerUrl,
  } = options;
  const noPastedInitData = {
    id: 'no-pasted-init-data',
    state: hasPastedInitData ? 'blocked' : 'ready',
    detail: hasPastedInitData
      ? 'retired TELEGRAM_INIT_DATA or TG_INIT_DATA is present; unset it — pasted initData is rejected under readiness v2'
      : 'no pasted initData env vars are present',
  };
  const workerToken = { id: 'worker-token', state: hasToken ? 'ready' : 'blocked', detail: hasToken ? 'QUESTS_PUSH_TOKEN is available without printing it' : 'QUESTS_PUSH_TOKEN is required without storing it in artifacts' };
  const receiptPrerequisites = [noPastedInitData];
  const workerPrerequisites = [
    workerToken,
    flagPrerequisite(allowNetwork, 'allow-network', '--allow-network'),
  ];
  return {
    schema: 'cambium.tg-live-proof-capture-plan.v2',
    invariant: 'Founder-device proof is an in-app signed gate action receipt; the CLI never submits Telegram actions and pasted initData is rejected outright.',
    workerUrl,
    steps: [
      {
        id: 'in-app-signed-receipt',
        writes: DEFAULT_RECEIPT,
        state: stepState(receipt.ready, receiptPrerequisites),
        command: 'Open the mini app inside Telegram, perform one signed gate action, and save the redacted receipt emitted by the in-app flow to .artifacts/tg-miniapp-live-proof/signed-action-smoke.json (--write-receipt-template scaffolds the shape)',
        prerequisites: receiptPrerequisites,
        privacy: [
          'receipt stores hashes only: userIdHash, actionKind, subjectHash, idempotencyHash, workerVersionId, capturedAt',
          'no raw initData, raw user ids, or query strings are accepted',
        ],
      },
      {
        id: 'worker-list-proof',
        writes: DEFAULT_WORKER_PROBE,
        state: stepState(workerProbe.ready, workerPrerequisites),
        command: 'node workers/quests/src/live-proof-readiness.mjs --capture-worker-probe --allow-network --write',
        prerequisites: workerPrerequisites,
        privacy: ['Worker credential is used only as an authorization header', 'artifact stores status, response shape, counts, and body digest only'],
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
  const hasPastedInitData = hasAnyEnv(env, RETIRED_INITDATA_ENV_NAMES);
  const receiptPath = options.receiptPath || DEFAULT_RECEIPT;
  const receipt = assessSignedActionReceipt(cwd, receiptPath, {
    tenant,
    generatedAt,
    maxAgeSec: options.receiptMaxAgeSec ?? DEFAULT_RECEIPT_MAX_AGE_SEC,
  });
  const workerProbePath = options.workerProbePath || DEFAULT_WORKER_PROBE;
  const workerProbe = assessWorkerProbe(cwd, workerProbePath, {
    tenant,
    generatedAt,
    workerUrl,
    maxAgeSec: options.workerProbeMaxAgeSec ?? DEFAULT_WORKER_PROBE_MAX_AGE_SEC,
  });
  const chrome = env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const viewportManifestPath = 'docs/plans/assets/tg-miniapp-viewport-proof/manifest.json';
  const viewportFailurePath = '.artifacts/tg-miniapp-viewport/failure.json';
  const viewportDiagnosticsPath = '.artifacts/tg-miniapp-viewport/browser-diagnostics.json';
  const viewportManifestArtifact = parseJsonArtifact(cwd, viewportManifestPath);
  const viewportManifest = viewportManifestArtifact.exists && !viewportManifestArtifact.error;
  const viewportFailure = artifactExists(cwd, viewportFailurePath);
  const viewportDiagnostics = artifactExists(cwd, viewportDiagnosticsPath);
  const expectedPageSourceSha256 = String(options.expectedPageSourceSha256 || (resolve(cwd) === resolve(process.cwd()) ? CURRENT_PAGE_SOURCE_SHA256 : ''))
    .replace(/^sha256:/i, '')
    .toLowerCase();
  const manifestPageSourceSha256 = String(viewportManifestArtifact.value?.pageSourceSha256 || '').replace(/^sha256:/i, '').toLowerCase();
  const viewportPageSourceMismatch = Boolean(viewportManifest && expectedPageSourceSha256 && manifestPageSourceSha256 !== expectedPageSourceSha256);
  const viewportFailureNewer = viewportFailure && artifactReceiptTimeMs(cwd, viewportFailurePath) >= artifactReceiptTimeMs(cwd, viewportManifestPath);
  const viewportReady = viewportManifest && !viewportFailureNewer && !viewportPageSourceMismatch;
  const promotionConsumer = fileHas(cwd, 'bin/quine/hyphae/skills.ts', 'applySkillPromotionDecisions');
  const sideQuestConsumer = fileHas(cwd, 'bin/quine/hyphae/quests.ts', 'applySideQuestQueueDecisions');
  const npcLocalSmoke = fileHas(cwd, 'workers/quests/src/handler.test.ts', 'NPC history smoke flows from quine write to companion sheet');
  const pageUsesInitData = fileHas(cwd, 'workers/quests/src/page.ts', 'TG && TG.initData');
  const workerValidatesInitData = fileHas(cwd, 'workers/quests/src/handler.ts', 'validateInitData');

  const items = [
    item(
      'no-pasted-init-data',
      'Manual initData ritual retired',
      hasPastedInitData ? 'blocked' : 'ready',
      hasPastedInitData
        ? 'TELEGRAM_INIT_DATA or TG_INIT_DATA is present in the environment; pasted initData is rejected under readiness v2.'
        : 'No pasted Telegram initData is present; founder-device proof comes from the in-app signed action receipt.',
      hasPastedInitData ? ['retired initData env variable present (value never read)'] : [],
      hasPastedInitData ? ['unset TELEGRAM_INIT_DATA and TG_INIT_DATA; capture the in-app signed action receipt instead'] : [],
    ),
    item(
      'founder-device-receipt',
      'Founder device in-app signed receipt captured',
      receipt.state,
      receipt.detail,
      receipt.evidence || [],
      receipt.missing || [],
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
        : viewportPageSourceMismatch
          ? 'The viewport manifest was generated from a different PAGE source and cannot prove the current Mini App.'
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
        viewportPageSourceMismatch
          ? 'rerun npm run proof:tg-viewport from the current PAGE source'
          : viewportFailureNewer
          ? 'repair local browser CDP and rerun npm run proof:tg-viewport to regenerate manifest.json'
          : 'run npm run proof:tg-viewport with CHROME_BIN pointing at a browser with CDP support to generate manifest.json',
      ],
    ),
  ];

  const ready = items.filter((entry) => entry.state === 'ready').length;
  const blocked = items.length - ready;
  const liveRequired = ['no-pasted-init-data', 'founder-device-receipt', 'worker-token', 'worker-network-probe'];
  const liveReady = liveRequired.every((id) => items.find((entry) => entry.id === id)?.state === 'ready');
  const capturePlan = buildCapturePlan({
    hasPastedInitData,
    hasToken,
    allowNetwork,
    receipt,
    workerProbe,
    workerUrl,
  });
  return {
    schema: 'cambium.tg-live-proof-readiness.v2',
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
    invariant: 'Local deterministic smokes and Chrome viewport screenshots do not prove live Telegram WebView or production Worker KV behavior; founder-device proof is the redacted in-app signed action receipt.',
    items,
    capturePlan,
  };
}

export function writeReadinessManifest(report, outPath = DEFAULT_OUT, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(report, null, 2) + '\n');
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

export function writeSignedActionReceiptTemplate(template, outPath = DEFAULT_RECEIPT_TEMPLATE, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(template, null, 2) + '\n');
  return absolute;
}

export function writeSignedActionReceiptArtifact(artifact, outPath = DEFAULT_RECEIPT, cwd = process.cwd()) {
  const absolute = resolve(cwd, outPath);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(artifact, null, 2) + '\n');
  return absolute;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  const report = assessLiveProofReadiness(args);
  if (args.write) writeReadinessManifest(report, args.out, args.cwd);
  if (args.writeWorkerTemplate) {
    writeWorkerProbeTemplate(
      createWorkerProbeTemplate({ tenant: args.tenant, workerUrl: args.workerUrl, generatedAt: report.generatedAt }),
      args.workerTemplateOut,
      args.cwd,
    );
  }
  if (args.writeReceiptTemplate) {
    writeSignedActionReceiptTemplate(
      createSignedActionReceiptTemplate({ tenant: args.tenant, generatedAt: report.generatedAt }),
      args.receiptTemplateOut,
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
