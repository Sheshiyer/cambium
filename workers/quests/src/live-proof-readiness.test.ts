import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assessLiveProofReadiness,
  captureDeviceProof,
  captureSignedActionSmoke,
  captureWorkerProbe,
  createDeviceProofTemplate,
  createSignedActionSmokeTemplate,
  createWorkerProbeTemplate,
  validateDeviceProofArtifact,
  validateSignedActionSmokeArtifact,
  validateWorkerProbeArtifact,
  writeDeviceProofArtifact,
  writeDeviceProofTemplate,
  writeReadinessManifest,
  writeSignedActionSmokeArtifact,
  writeSignedActionSmokeTemplate,
  writeWorkerProbeArtifact,
  writeWorkerProbeTemplate,
} from './live-proof-readiness.mjs';
import { buildViewportProofManifest } from './visual-viewport-proof.mjs';

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'cambium-live-proof-'));
  mkdirSync(join(root, 'workers/quests/src'), { recursive: true });
  mkdirSync(join(root, 'bin/quine/hyphae'), { recursive: true });
  mkdirSync(join(root, 'docs/plans/assets/tg-miniapp-live-proof'), { recursive: true });
  writeFileSync(join(root, 'workers/quests/src/page.ts'), 'const initData = TG && TG.initData || "";');
  writeFileSync(join(root, 'workers/quests/src/handler.ts'), 'export function validateInitData() {}');
  writeFileSync(join(root, 'workers/quests/src/handler.test.ts'), 'NPC history smoke flows from quine write to companion sheet');
  writeFileSync(join(root, 'bin/quine/hyphae/skills.ts'), 'export async function applySkillPromotionDecisions() {}');
  writeFileSync(join(root, 'bin/quine/hyphae/quests.ts'), 'export async function applySideQuestQueueDecisions() {}');
  return root;
}

function validDeviceProof(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'cambium.tg-device-proof.v1',
    tenant: 'cambium',
    capturedAt: '2026-06-22T00:00:30.000Z',
    source: 'telegram-webview',
    telegram: {
      userIdHash: `sha256:${'a'.repeat(64)}`,
      initDataHash: `sha256:${'b'.repeat(64)}`,
      initDataAgeSeconds: 90,
    },
    webView: {
      platform: 'ios',
      urlOrigin: 'https://curious.thoughtseed.space',
      urlPath: '/',
      safeArea: 'top=54,right=0,bottom=34,left=0',
    },
    screenshot: {
      sha256: `sha256:${'c'.repeat(64)}`,
      path: 'docs/plans/assets/tg-miniapp-live-proof/founder-device.png',
    },
    notes: ['Captured inside Telegram WebView without storing raw initData.'],
    ...overrides,
  };
}

function writeScreenshotFixture(cwd: string, body = 'founder telegram webview screenshot bytes'): { path: string; sha256: string } {
  const path = 'docs/plans/assets/tg-miniapp-live-proof/founder-device.png';
  writeFileSync(join(cwd, path), body);
  return {
    path,
    sha256: `sha256:${createHash('sha256').update(body).digest('hex')}`,
  };
}

function signedInitData(capturedAt = '2026-06-22T00:01:00.000Z', ageSeconds = 30): string {
  const authDate = Math.floor(Date.parse(capturedAt) / 1000) - ageSeconds;
  return [
    'query_id=real-query',
    `user=${encodeURIComponent(JSON.stringify({ id: '1371522080' }))}`,
    `auth_date=${authDate}`,
    'hash=secret-hash',
    'signature=secret-signature',
  ].join('&');
}

function validWorkerProbe(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const body = '{"tenant":"cambium","actions":[]}';
  return {
    schema: 'cambium.worker-network-probe.v1',
    tenant: 'cambium',
    capturedAt: '2026-06-22T00:00:45.000Z',
    source: 'production-worker',
    workerUrl: 'https://curious.thoughtseed.space',
    probes: [
      {
        name: 'internal-gate-list',
        method: 'GET',
        path: '/internal/gate/cambium',
        status: 200,
        ok: true,
        responseShape: {
          tenantMatches: true,
          actionsArray: true,
        },
        queuedActionCount: 0,
        bodySha256: `sha256:${createHash('sha256').update(body).digest('hex')}`,
      },
    ],
    notes: ['Captured from production Worker list route with credentials omitted.'],
    ...overrides,
  };
}

function hashOf(label: string): string {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

function validSignedSmoke(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'cambium.signed-action-smoke.v1',
    tenant: 'cambium',
    capturedAt: '2026-06-22T00:01:10.000Z',
    source: 'telegram-worker-operator-smoke',
    workerUrl: 'https://curious.thoughtseed.space',
    smokeKind: 'skill-promotion',
    telegram: {
      userIdHash: hashOf('telegram-user'),
      initDataHash: hashOf('init-data'),
      initDataAgeSeconds: 95,
    },
    action: {
      kind: 'promote-skill',
      subjectHash: hashOf('cambium-founder-review'),
      idempotencyKeyHash: hashOf('promote-skill:cambium:cambium-founder-review'),
    },
    phases: {
      telegramSubmit: {
        status: 200,
        queued: true,
        duplicate: false,
        queuedIdHash: hashOf('queued-id'),
        responseSha256: hashOf('submit-response'),
      },
      workerList: {
        status: 200,
        sawQueuedAction: true,
        queuedActionCount: 1,
        bodySha256: hashOf('worker-list-response'),
      },
      operatorConsume: {
        command: 'quine write skills apply-promotions',
        checked: 1,
        consumed: 1,
        rejected: 0,
        auditSha256: hashOf('operator-audit'),
      },
      miniAppRefresh: {
        refreshed: true,
        envelopeSha256: hashOf('visual-envelope'),
        visibleMarkerHash: hashOf('production-card-marker'),
      },
    },
    notes: ['Redacted lifecycle receipt; private identifiers omitted.'],
    ...overrides,
  };
}

test('live proof readiness stays blocked without real Telegram and Worker evidence', () => {
  const cwd = fixtureRepo();
  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:00:00.000Z',
  });

  assert.equal(report.schema, 'cambium.tg-live-proof-readiness.v1');
  assert.equal(report.status, 'blocked');
  assert.equal(report.summary.liveProofReady, false);
  assert.equal(report.items.find((item) => item.id === 'telegram-init-data')?.state, 'blocked');
  assert.equal(report.items.find((item) => item.id === 'telegram-device-artifact')?.state, 'blocked');
  assert.equal(report.items.find((item) => item.id === 'worker-network-probe')?.state, 'blocked');
  assert.equal(report.items.find((item) => item.id === 'promotion-consumer')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'side-quest-consumer')?.state, 'ready');
  assert.equal(report.followups.signedActionSmoke.state, 'blocked');
  assert.equal(report.capturePlan.schema, 'cambium.tg-live-proof-capture-plan.v1');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'device-webview-proof')?.state, 'blocked');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'worker-list-proof')?.state, 'blocked');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'signed-action-smoke')?.state, 'blocked');
  assert.match(report.invariant, /Local deterministic smokes/);
});

test('live proof readiness blocks stale viewport manifests after a newer failure receipt', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  mkdirSync(viewportDir, { recursive: true });
  writeFileSync(chrome, '');
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({ generatedAt: '2026-06-22T00:00:00.000Z' }));
  writeFileSync(join(viewportDir, 'failure.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:01:00.000Z',
    error: 'No configured browser exposed a Chrome DevTools Protocol endpoint',
  }));

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: chrome },
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  const viewport = report.items.find((item) => item.id === 'viewport-layout-proof');
  assert.equal(viewport?.state, 'blocked');
  assert.match(viewport?.detail ?? '', /latest local viewport proof attempt failed/);
  assert.deepEqual(viewport?.missing, ['repair local browser CDP and rerun npm run proof:tg-viewport to regenerate manifest.json']);
  assert.ok(viewport?.evidence.includes('docs/plans/assets/tg-miniapp-viewport-proof/failure.json'));
});

test('live proof readiness treats viewport browser diagnostics as evidence, not proof', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  mkdirSync(viewportDir, { recursive: true });
  writeFileSync(chrome, '');
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({ generatedAt: '2026-06-22T00:00:00.000Z' }));
  writeFileSync(join(viewportDir, 'failure.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:01:00.000Z',
    error: 'No configured browser exposed a Chrome DevTools Protocol endpoint',
  }));
  writeFileSync(join(viewportDir, 'browser-diagnostics.json'), JSON.stringify({
    schema: 'cambium.tg-viewport-browser-diagnostics.v1',
    summary: { ready: 0, blocked: 2, total: 2, cdpReady: false },
  }));

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: chrome },
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  const viewport = report.items.find((item) => item.id === 'viewport-layout-proof');
  assert.equal(viewport?.state, 'blocked');
  assert.match(viewport?.detail ?? '', /browser diagnostics are available/);
  assert.ok(viewport?.evidence.includes('docs/plans/assets/tg-miniapp-viewport-proof/browser-diagnostics.json'));
  assert.deepEqual(viewport?.missing, ['repair local browser CDP and rerun npm run proof:tg-viewport to regenerate manifest.json']);
});

test('live proof readiness does not count a Chrome binary as viewport proof', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  writeFileSync(chrome, '');

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: chrome },
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  const viewport = report.items.find((item) => item.id === 'viewport-layout-proof');
  assert.equal(viewport?.state, 'blocked');
  assert.match(viewport?.detail ?? '', /can attempt a layout proof, but no manifest has been generated yet/);
  assert.deepEqual(viewport?.missing, ['run npm run proof:tg-viewport with CHROME_BIN pointing at a browser with CDP support to generate manifest.json']);
});

test('viewport proof manifest distinguishes layout and clickability proof intent', () => {
  const manifest = buildViewportProofManifest({
    generatedAt: '2026-06-22T00:01:00.000Z',
    chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    browserMode: 'headless-new',
    browserCandidates: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    viewport: { width: 390, height: 844 },
    proofs: [
      { scene: 'quests', url: 'http://127.0.0.1:8787/?tenant=cambium&scene=quests', path: 'quests-line-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 900 },
      { scene: 'map', path: 'map-tapestry-audit-mobile.png', intent: 'layout-proof', clickabilityTargetCount: 14, width: 780, height: 1688, bytes: 1000 },
      { scene: 'map', path: 'sheet-skill-promotion-mobile.png', intent: 'clickability-proof', width: 780, height: 844, bytes: 2000 },
    ],
  });
  const artifact = JSON.parse(JSON.stringify(manifest));

  assert.deepEqual(artifact.proofIntentSummary, { 'layout-proof': 2, 'clickability-proof': 1 });
  assert.deepEqual(artifact.proofs.map((proof: { intent: string }) => proof.intent), ['layout-proof', 'layout-proof', 'clickability-proof']);
  assert.equal(artifact.proofs.find((proof: { scene: string }) => proof.scene === 'quests')?.path, 'quests-line-mobile.png');
  assert.match(artifact.proofs.find((proof: { scene: string }) => proof.scene === 'quests')?.url ?? '', /\?tenant=cambium&scene=quests/);
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'map-tapestry-audit-mobile.png')?.clickabilityTargetCount, 14);
  assert.equal(artifact.proofs.find((proof: { intent: string }) => proof.intent === 'clickability-proof')?.path, 'sheet-skill-promotion-mobile.png');
  assert.match(artifact.invariant, /clipped real sheet proof/);
});

test('live proof readiness marks capture steps ready-to-capture when prerequisites are supplied', () => {
  const cwd = fixtureRepo();
  const screenshot = writeScreenshotFixture(cwd);
  const operatorAuditPath = 'docs/plans/assets/tg-miniapp-live-proof/operator-audit.json';
  const miniAppEnvelopePath = 'docs/plans/assets/tg-miniapp-live-proof/miniapp-envelope.json';
  writeFileSync(join(cwd, operatorAuditPath), JSON.stringify({ consumed: 1 }));
  writeFileSync(join(cwd, miniAppEnvelopePath), JSON.stringify({ marker: 'production-card-marker' }));

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: {
      TELEGRAM_INIT_DATA: signedInitData(),
      QUESTS_PUSH_TOKEN: 'redacted',
      CHROME_BIN: join(cwd, 'missing-chrome'),
    },
    allowNetwork: true,
    allowMutation: true,
    screenshotPath: screenshot.path,
    devicePlatform: 'ios',
    webViewUrl: 'https://curious.thoughtseed.space/?tgWebAppData=secret',
    actionKind: 'promote-skill',
    actionSubject: 'cambium-founder-review',
    actionIdempotencyKey: 'promote-skill:cambium:cambium-founder-review',
    operatorCommand: 'quine write skills apply-promotions',
    operatorAuditPath,
    operatorChecked: 1,
    operatorConsumed: 1,
    operatorRejected: 0,
    miniAppEnvelopePath,
    visibleMarker: 'production-card-marker',
    generatedAt: '2026-06-22T00:01:00.000Z',
  });

  assert.equal(report.capturePlan.steps.find((step) => step.id === 'device-webview-proof')?.state, 'ready-to-capture');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'worker-list-proof')?.state, 'ready-to-capture');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'signed-action-smoke')?.state, 'ready-to-capture');
  const text = JSON.stringify(report);
  assert.doesNotMatch(text, /query_id=|auth_date=|secret-hash|secret-signature|1371522080|tgWebAppData|QUESTS_PUSH_TOKEN=/);
});

test('live proof readiness does not count a device proof template as live evidence', () => {
  const cwd = fixtureRepo();
  writeDeviceProofTemplate(
    createDeviceProofTemplate({ tenant: 'cambium', generatedAt: '2026-06-22T00:00:00.000Z' }),
    'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json',
    cwd,
  );

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:01:00.000Z',
  });

  const device = report.items.find((item) => item.id === 'telegram-device-artifact');
  assert.equal(device?.state, 'blocked');
  assert.deepEqual(device?.evidence, []);
  assert.match(device?.missing.join(' ') || '', /replace template/);
});

test('live proof readiness does not count a Worker probe template as production evidence', () => {
  const cwd = fixtureRepo();
  writeWorkerProbeTemplate(
    createWorkerProbeTemplate({
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:00:00.000Z',
    }),
    'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json',
    cwd,
  );

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome'), QUESTS_PUSH_TOKEN: 'redacted' },
    allowNetwork: true,
    generatedAt: '2026-06-22T00:01:00.000Z',
  });

  const worker = report.items.find((item) => item.id === 'worker-network-probe');
  assert.equal(worker?.state, 'blocked');
  assert.deepEqual(worker?.evidence, []);
  assert.match(worker?.missing.join(' ') || '', /replace template/);
});

test('live proof readiness reports a signed-action smoke template as a follow-up, not base live proof', () => {
  const cwd = fixtureRepo();
  writeSignedActionSmokeTemplate(
    createSignedActionSmokeTemplate({
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:00:00.000Z',
    }),
    'docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json',
    cwd,
  );

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:01:00.000Z',
  });

  assert.equal(report.followups.signedActionSmoke.state, 'blocked');
  assert.match(report.followups.signedActionSmoke.missing.join(' '), /replace template/);
});

test('device proof validation rejects raw initData leakage', () => {
  const verdict = validateDeviceProofArtifact(
    validDeviceProof({
      telegram: {
        userIdHash: `sha256:${'a'.repeat(64)}`,
        initDataHash: `sha256:${'b'.repeat(64)}`,
        initDataAgeSeconds: 90,
        initData: 'query_id=real&auth_date=1782080000&hash=secret&signature=secret',
      },
    }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:01:00.000Z' },
  );

  assert.equal(verdict.ready, false);
  assert.match(verdict.missing.join(' '), /raw initData/);
});

test('device proof capture refuses missing initData and screenshots outside the proof directory', () => {
  const cwd = fixtureRepo();
  assert.throws(
    () => captureDeviceProof({
      cwd,
      tenant: 'cambium',
      env: {},
      screenshotPath: 'docs/plans/assets/tg-miniapp-live-proof/founder-device.png',
      platform: 'ios',
      webViewUrl: 'https://curious.thoughtseed.space/?tgWebAppData=secret',
      capturedAt: '2026-06-22T00:01:00.000Z',
    }),
    /TELEGRAM_INIT_DATA or TG_INIT_DATA/,
  );

  assert.throws(
    () => captureDeviceProof({
      cwd,
      tenant: 'cambium',
      env: { TELEGRAM_INIT_DATA: signedInitData() },
      screenshotPath: 'outside-proof.png',
      platform: 'ios',
      webViewUrl: 'https://curious.thoughtseed.space/?tgWebAppData=secret',
      capturedAt: '2026-06-22T00:01:00.000Z',
    }),
    /must stay under/,
  );
});

test('device proof capture writes a valid redacted artifact from env initData and screenshot bytes', () => {
  const cwd = fixtureRepo();
  const screenshot = writeScreenshotFixture(cwd);
  const initData = signedInitData();
  const artifact = captureDeviceProof({
    cwd,
    tenant: 'cambium',
    env: { TELEGRAM_INIT_DATA: initData },
    screenshotPath: screenshot.path,
    platform: 'ios',
    safeArea: 'top=54,right=0,bottom=34,left=0',
    webViewUrl: 'https://curious.thoughtseed.space/?tgWebAppData=secret&query_id=leak',
    capturedAt: '2026-06-22T00:01:00.000Z',
  });

  assert.equal((artifact.telegram as Record<string, unknown>).initDataAgeSeconds, 30);
  assert.equal((artifact.webView as Record<string, unknown>).urlOrigin, 'https://curious.thoughtseed.space');
  assert.equal((artifact.webView as Record<string, unknown>).urlPath, '/');
  assert.equal((artifact.screenshot as Record<string, unknown>).sha256, screenshot.sha256);

  const path = writeDeviceProofArtifact(artifact, 'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json', cwd);
  const text = readFileSync(path, 'utf8');
  assert.doesNotMatch(text, /query_id=|auth_date=|secret-hash|secret-signature|1371522080|tgWebAppData/);

  const verdict = validateDeviceProofArtifact(artifact, {
    cwd,
    tenant: 'cambium',
    generatedAt: '2026-06-22T00:01:00.000Z',
  });
  assert.equal(verdict.ready, true);
});

test('signed-action smoke validation rejects raw lifecycle leakage', () => {
  const verdict = validateSignedActionSmokeArtifact(
    validSignedSmoke({
      action: {
        kind: 'promote-skill',
        subject: 'cambium-founder-review',
        subjectHash: hashOf('cambium-founder-review'),
        idempotencyKeyHash: hashOf('promote-skill:cambium:cambium-founder-review'),
      },
      leaked: 'Bearer should-not-be-stored query_id=real&auth_date=1782080000',
    }),
    {
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:02:00.000Z',
    },
  );

  assert.equal(verdict.ready, false);
  assert.match(verdict.missing.join(' '), /raw subjects/);
});

test('signed-action smoke validation requires queue, consume, and refresh phases', () => {
  const bad = validateSignedActionSmokeArtifact(
    validSignedSmoke({
      phases: {
        telegramSubmit: {
          status: 401,
          queued: false,
          duplicate: 'no',
          queuedIdHash: 'sha256:not-a-real-hash',
          responseSha256: hashOf('submit-response'),
        },
        workerList: {
          status: 200,
          sawQueuedAction: false,
          queuedActionCount: -1,
          bodySha256: hashOf('worker-list-response'),
        },
        operatorConsume: {
          command: '',
          checked: 0,
          consumed: 0,
          rejected: 0,
          auditSha256: hashOf('operator-audit'),
        },
        miniAppRefresh: {
          refreshed: false,
          envelopeSha256: hashOf('visual-envelope'),
          visibleMarkerHash: hashOf('production-card-marker'),
        },
      },
    }),
    {
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:02:00.000Z',
    },
  );

  assert.equal(bad.ready, false);
  assert.match(bad.missing.join(' '), /telegramSubmit.status must be 200/);
  assert.match(bad.missing.join(' '), /operatorConsume.consumed/);
  assert.match(bad.missing.join(' '), /miniAppRefresh.refreshed/);

  const good = validateSignedActionSmokeArtifact(validSignedSmoke(), {
    tenant: 'cambium',
    workerUrl: 'https://curious.thoughtseed.space',
    generatedAt: '2026-06-22T00:02:00.000Z',
  });
  assert.equal(good.ready, true);
});

test('signed-action smoke capture refuses without explicit network and mutation authorization', async () => {
  await assert.rejects(
    captureSignedActionSmoke({
      tenant: 'cambium',
      workerUrl: 'https://worker.test',
      token: 'secret-token',
      fetchImpl: async () => ({ status: 200, ok: true, text: async () => '{}' }),
    }),
    /--allow-network/,
  );

  await assert.rejects(
    captureSignedActionSmoke({
      tenant: 'cambium',
      workerUrl: 'https://worker.test',
      allowNetwork: true,
      token: 'secret-token',
      fetchImpl: async () => ({ status: 200, ok: true, text: async () => '{}' }),
    }),
    /--allow-mutation/,
  );
});

test('signed-action smoke capture refuses a refresh marker missing from the mini app envelope', async () => {
  const cwd = fixtureRepo();
  const operatorAuditPath = 'docs/plans/assets/tg-miniapp-live-proof/operator-audit.json';
  const miniAppEnvelopePath = 'docs/plans/assets/tg-miniapp-live-proof/miniapp-envelope.json';
  writeFileSync(join(cwd, operatorAuditPath), JSON.stringify({ consumed: 1 }));
  writeFileSync(join(cwd, miniAppEnvelopePath), JSON.stringify({ marker: 'different-card-marker' }));

  await assert.rejects(
    captureSignedActionSmoke({
      cwd,
      tenant: 'cambium',
      workerUrl: 'https://worker.test',
      token: 'secret-token',
      allowNetwork: true,
      allowMutation: true,
      env: { TELEGRAM_INIT_DATA: signedInitData() },
      capturedAt: '2026-06-22T00:01:00.000Z',
      actionKind: 'promote-skill',
      actionSubject: 'cambium-founder-review',
      actionIdempotencyKey: 'promote-skill:cambium:cambium-founder-review',
      operatorCommand: 'quine write skills apply-promotions',
      operatorAuditPath,
      operatorChecked: 1,
      operatorConsumed: 1,
      operatorRejected: 0,
      miniAppEnvelopePath,
      visibleMarker: 'production-card-marker',
      fetchImpl: async () => ({ status: 200, ok: true, text: async () => '{}' }),
    }),
    /visible marker/,
  );
});

test('signed-action smoke capture writes only redacted queue, consume, and refresh proof', async () => {
  const cwd = fixtureRepo();
  const operatorAuditPath = 'docs/plans/assets/tg-miniapp-live-proof/operator-audit.json';
  const miniAppEnvelopePath = 'docs/plans/assets/tg-miniapp-live-proof/miniapp-envelope.json';
  writeFileSync(join(cwd, operatorAuditPath), JSON.stringify({ consumed: 1, action: 'queued-id', subject: 'cambium-founder-review' }));
  writeFileSync(join(cwd, miniAppEnvelopePath), JSON.stringify({ marker: 'production-card-marker', subject: 'cambium-founder-review' }));
  const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
  const submitBody = JSON.stringify({
    queued: 'queued-id',
    duplicate: false,
    kind: 'promote-skill',
    subject: 'cambium-founder-review',
    idempotencyKey: 'promote-skill:cambium:cambium-founder-review',
  });
  const listBody = JSON.stringify({
    tenant: 'cambium',
    actions: [
      {
        id: 'queued-id',
        kind: 'promote-skill',
        subject: 'cambium-founder-review',
        founderId: '1371522080',
        idempotencyKey: 'promote-skill:cambium:cambium-founder-review',
      },
    ],
  });

  const artifact = await captureSignedActionSmoke({
    cwd,
    tenant: 'cambium',
    workerUrl: 'https://worker.test',
    token: 'secret-token',
    allowNetwork: true,
    allowMutation: true,
    env: { TELEGRAM_INIT_DATA: signedInitData() },
    capturedAt: '2026-06-22T00:01:00.000Z',
    actionKind: 'promote-skill',
    actionSubject: 'cambium-founder-review',
    actionEvidence: 'validated founder approval for cambium-founder-review',
    actionConsequence: 'operator may promote cambium-founder-review after re-check',
    actionReversibility: 'queued promotion can be superseded until consumed',
    actionIdempotencyKey: 'promote-skill:cambium:cambium-founder-review',
    operatorCommand: 'quine write skills apply-promotions',
    operatorAuditPath,
    operatorChecked: 1,
    operatorConsumed: 1,
    operatorRejected: 0,
    miniAppEnvelopePath,
    visibleMarker: 'production-card-marker',
    fetchImpl: async (url: string, init: Record<string, unknown>) => {
      calls.push({ url, init });
      if (url.endsWith('/api/gate/cambium')) return { status: 200, ok: true, text: async () => submitBody };
      return { status: 200, ok: true, text: async () => listBody };
    },
  });

  assert.equal(calls[0].url, 'https://worker.test/api/gate/cambium');
  assert.match(String(calls[0].init.body), /query_id=real-query/);
  assert.equal(calls[1].url, 'https://worker.test/internal/gate/cambium');
  assert.equal((calls[1].init.headers as Record<string, string>).authorization, 'Bearer secret-token');
  assert.equal((artifact.phases as Record<string, any>).workerList.sawQueuedAction, true);
  assert.equal((artifact.phases as Record<string, any>).operatorConsume.consumed, 1);

  const path = writeSignedActionSmokeArtifact(artifact, 'docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.json', cwd);
  const text = readFileSync(path, 'utf8');
  assert.doesNotMatch(text, /secret-token|query_id=|auth_date=|secret-hash|secret-signature|1371522080|cambium-founder-review|queued-id|founderId|tgWebAppData/);

  const verdict = validateSignedActionSmokeArtifact(artifact, {
    tenant: 'cambium',
    workerUrl: 'https://worker.test',
    generatedAt: '2026-06-22T00:01:00.000Z',
  });
  assert.equal(verdict.ready, true);
});

test('Worker probe validation rejects bearer or token leakage', () => {
  const verdict = validateWorkerProbeArtifact(
    validWorkerProbe({
      requestHeaders: {
        authorization: 'Bearer should-not-be-stored',
      },
    }),
    {
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:01:00.000Z',
    },
  );

  assert.equal(verdict.ready, false);
  assert.match(verdict.missing.join(' '), /bearer headers/);
});

test('Worker probe validation requires the internal gate list response shape', () => {
  const bad = validateWorkerProbeArtifact(
    validWorkerProbe({
      probes: [
        {
          name: 'internal-gate-list',
          method: 'POST',
          path: '/internal/gate/cambium/consume',
          status: 200,
          ok: true,
          responseShape: { tenantMatches: false, actionsArray: false },
          queuedActionCount: -1,
          bodySha256: 'sha256:not-a-real-hash',
        },
      ],
    }),
    {
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:01:00.000Z',
    },
  );

  assert.equal(bad.ready, false);
  assert.match(bad.missing.join(' '), /method must be GET/);
  assert.match(bad.missing.join(' '), /actionsArray must be true/);

  const good = validateWorkerProbeArtifact(validWorkerProbe(), {
    tenant: 'cambium',
    workerUrl: 'https://curious.thoughtseed.space',
    generatedAt: '2026-06-22T00:01:00.000Z',
  });
  assert.equal(good.ready, true);
});

test('Worker probe capture refuses without explicit network authorization', async () => {
  await assert.rejects(
    captureWorkerProbe({
      tenant: 'cambium',
      workerUrl: 'https://worker.test',
      token: 'secret-token',
      fetchImpl: async () => ({ status: 200, ok: true, text: async () => '{}' }),
    }),
    /without --allow-network/,
  );
});

test('Worker probe capture writes only redacted status, count, and digest metadata', async () => {
  const cwd = fixtureRepo();
  const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
  const body = '{"tenant":"cambium","actions":[{"id":"queued-action","founderId":"private"}]}';
  const artifact = await captureWorkerProbe({
    tenant: 'cambium',
    workerUrl: 'https://worker.test',
    token: 'secret-token',
    allowNetwork: true,
    capturedAt: '2026-06-22T00:00:50.000Z',
    fetchImpl: async (url: string, init: Record<string, unknown>) => {
      calls.push({ url, init });
      return { status: 200, ok: true, text: async () => body };
    },
  });

  assert.equal(calls[0].url, 'https://worker.test/internal/gate/cambium');
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, 'Bearer secret-token');
  assert.equal((artifact.probes as Array<Record<string, unknown>>)[0].queuedActionCount, 1);
  assert.equal((artifact.probes as Array<Record<string, unknown>>)[0].bodySha256, `sha256:${createHash('sha256').update(body).digest('hex')}`);

  const path = writeWorkerProbeArtifact(artifact, 'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json', cwd);
  const text = readFileSync(path, 'utf8');
  assert.doesNotMatch(text, /secret-token|queued-action|founderId|Bearer/);

  const verdict = validateWorkerProbeArtifact(artifact, {
    tenant: 'cambium',
    workerUrl: 'https://worker.test',
    generatedAt: '2026-06-22T00:01:00.000Z',
  });
  assert.equal(verdict.ready, true);
});

test('device proof validation requires an existing screenshot with a matching hash', () => {
  const cwd = fixtureRepo();
  const screenshot = writeScreenshotFixture(cwd);
  const bad = validateDeviceProofArtifact(
    validDeviceProof({
      screenshot: { ...screenshot, sha256: `sha256:${'d'.repeat(64)}` },
    }),
    { cwd, tenant: 'cambium', generatedAt: '2026-06-22T00:01:00.000Z' },
  );
  assert.equal(bad.ready, false);
  assert.match(bad.missing.join(' '), /match the screenshot file/);

  const good = validateDeviceProofArtifact(
    validDeviceProof({ screenshot }),
    { cwd, tenant: 'cambium', generatedAt: '2026-06-22T00:01:00.000Z' },
  );
  assert.equal(good.ready, true);
});

test('live proof readiness becomes ready only when live-proof prerequisites are supplied', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  writeFileSync(chrome, '');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  mkdirSync(viewportDir, { recursive: true });
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:01:00.000Z',
    proofs: [{ path: 'map-tapestry-audit-mobile.png', width: 780, height: 1688, bytes: 1000 }],
  }));
  const screenshot = writeScreenshotFixture(cwd);
  writeFileSync(
    join(cwd, 'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.json'),
    JSON.stringify(validDeviceProof({ screenshot })),
  );
  writeFileSync(
    join(cwd, 'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.json'),
    JSON.stringify(validWorkerProbe({ workerUrl: 'https://worker.test' })),
  );

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: {
      TELEGRAM_INIT_DATA: 'query_id=real&user=%7B%22id%22%3A1371522080%7D&auth_date=1782080000&hash=redacted',
      QUESTS_PUSH_TOKEN: 'redacted',
      CHROME_BIN: chrome,
    },
    allowNetwork: true,
    workerUrl: 'https://worker.test',
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.summary.liveProofReady, true);
  assert.equal(report.summary.blocked, 0);
  assert.equal(report.items.find((item) => item.id === 'telegram-device-artifact')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'worker-network-probe')?.state, 'ready');
  assert.equal(report.followups.signedActionSmoke.state, 'blocked');
});

test('device proof template writer creates a non-authoritative scaffold', () => {
  const cwd = fixtureRepo();
  const template = createDeviceProofTemplate({ tenant: 'cambium', generatedAt: '2026-06-22T00:03:00.000Z' });
  const path = writeDeviceProofTemplate(template, 'docs/plans/assets/tg-miniapp-live-proof/telegram-webview.template.json', cwd);
  const text = readFileSync(path, 'utf8');

  assert.match(text, /cambium\.tg-device-proof-template\.v1/);
  assert.match(text, /"writesAuthority": false/);
  assert.doesNotMatch(text, /query_id=|auth_date=|hash=secret|signature=secret/);

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:03:30.000Z',
  });
  assert.equal(report.items.find((item) => item.id === 'telegram-device-artifact')?.state, 'blocked');
});

test('Worker probe template writer creates a non-authoritative scaffold', () => {
  const cwd = fixtureRepo();
  const template = createWorkerProbeTemplate({
    tenant: 'cambium',
    workerUrl: 'https://curious.thoughtseed.space',
    generatedAt: '2026-06-22T00:04:00.000Z',
  });
  const path = writeWorkerProbeTemplate(template, 'docs/plans/assets/tg-miniapp-live-proof/worker-network-probe.template.json', cwd);
  const text = readFileSync(path, 'utf8');

  assert.match(text, /cambium\.worker-network-probe-template\.v1/);
  assert.match(text, /"writesAuthority": false/);
  assert.doesNotMatch(text, /Bearer should-not-be-stored|QUESTS_PUSH_TOKEN=/);

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome'), QUESTS_PUSH_TOKEN: 'redacted' },
    allowNetwork: true,
    generatedAt: '2026-06-22T00:04:30.000Z',
  });
  assert.equal(report.items.find((item) => item.id === 'worker-network-probe')?.state, 'blocked');
});

test('signed-action smoke template writer creates a non-authoritative scaffold', () => {
  const cwd = fixtureRepo();
  const template = createSignedActionSmokeTemplate({
    tenant: 'cambium',
    workerUrl: 'https://curious.thoughtseed.space',
    generatedAt: '2026-06-22T00:05:00.000Z',
  });
  const path = writeSignedActionSmokeTemplate(template, 'docs/plans/assets/tg-miniapp-live-proof/signed-action-smoke.template.json', cwd);
  const text = readFileSync(path, 'utf8');

  assert.match(text, /cambium\.signed-action-smoke-template\.v1/);
  assert.match(text, /"writesAuthority": false/);
  assert.doesNotMatch(text, /Bearer should-not-be-stored|query_id=|founderId|queued-action/);
});

test('live proof readiness writes a redacted manifest artifact', () => {
  const cwd = fixtureRepo();
  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: {},
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  const path = writeReadinessManifest(report, 'docs/plans/assets/tg-miniapp-live-proof/readiness.json', cwd);
  assert.match(path, /readiness\.json$/);
  const text = readFileSync(path, 'utf8');
  assert.match(text, /cambium\.tg-live-proof-readiness\.v1/);
  assert.doesNotMatch(text, /QUESTS_PUSH_TOKEN=.*|hash=redacted/);
});
