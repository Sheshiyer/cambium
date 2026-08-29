import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import {
  assessLiveProofReadiness,
  captureWorkerProbe,
  createSignedActionReceiptTemplate,
  createWorkerProbeTemplate,
  parseArgs,
  validateSignedActionReceiptArtifact,
  validateWorkerProbeArtifact,
  writeReadinessManifest,
  writeSignedActionReceiptArtifact,
  writeSignedActionReceiptTemplate,
  writeWorkerProbeArtifact,
  writeWorkerProbeTemplate,
} from './live-proof-readiness.mjs';
import {
  assertViewportProofManifestSchema,
  buildQueuedActionRequestFixture,
  buildViewportProofManifest,
  MOBILE_CONTRACT_PROOF_PATHS,
  selectViewportProofCaptureSteps,
  shouldWriteCanonicalViewportArtifacts,
  touchDragNeedsRetry,
  viewportProofArtifactDirectory,
  VIEWPORT_PROOF_CAPTURE_STEPS,
} from './visual-viewport-proof.mjs';

const TEST_TELEGRAM_USER_ID = '1000000001';

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'cambium-live-proof-'));
  mkdirSync(join(root, 'workers/quests/src'), { recursive: true });
  mkdirSync(join(root, 'bin/quine/hyphae'), { recursive: true });
  mkdirSync(join(root, '.artifacts/tg-miniapp-live-proof'), { recursive: true });
  writeFileSync(join(root, 'workers/quests/src/page.ts'), 'const initData = TG && TG.initData || "";');
  writeFileSync(join(root, 'workers/quests/src/handler.ts'), 'export function validateInitData() {}');
  writeFileSync(join(root, 'workers/quests/src/handler.test.ts'), 'NPC history smoke flows from quine write to companion sheet');
  writeFileSync(join(root, 'bin/quine/hyphae/skills.ts'), 'export async function applySkillPromotionDecisions() {}');
  writeFileSync(join(root, 'bin/quine/hyphae/quests.ts'), 'export async function applySideQuestQueueDecisions() {}');
  return root;
}

function pastedInitData(capturedAt = '2026-06-22T00:01:00.000Z', ageSeconds = 30): string {
  const authDate = Math.floor(Date.parse(capturedAt) / 1000) - ageSeconds;
  return [
    'query_id=real-query',
    `user=${encodeURIComponent(JSON.stringify({ id: TEST_TELEGRAM_USER_ID }))}`,
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

function validReceiptV2(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'cambium.signed-action-smoke.v2',
    tenant: 'cambium',
    capturedAt: '2026-06-22T00:01:10.000Z',
    source: 'in-app-signed-gate-action',
    userIdHash: hashOf('telegram-user'),
    actionKind: 'approve',
    subjectHash: hashOf('cambium-founder-review'),
    idempotencyHash: hashOf('approve:cambium:cambium-founder-review'),
    workerVersionId: '42e74689-4907-4845-b5f4-664ff2cc540e',
    notes: ['Redacted in-app receipt; private identifiers omitted.'],
    ...overrides,
  };
}

function retiredDeviceProofV1(): Record<string, unknown> {
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
      path: '.artifacts/tg-miniapp-live-proof/founder-device.png',
    },
    notes: ['Retired manual WebView capture shape.'],
  };
}

test('live proof readiness stays blocked without real in-app receipt and Worker evidence', () => {
  const cwd = fixtureRepo();
  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:00:00.000Z',
  });

  assert.equal(report.schema, 'cambium.tg-live-proof-readiness.v2');
  assert.equal(report.status, 'blocked');
  assert.equal(report.summary.liveProofReady, false);
  assert.equal(report.items.find((item) => item.id === 'no-pasted-init-data')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'founder-device-receipt')?.state, 'blocked');
  assert.equal(report.items.find((item) => item.id === 'worker-network-probe')?.state, 'blocked');
  assert.equal(report.items.find((item) => item.id === 'promotion-consumer')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'side-quest-consumer')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'telegram-init-data'), undefined);
  assert.equal(report.items.find((item) => item.id === 'telegram-device-artifact'), undefined);
  assert.equal(report.capturePlan.schema, 'cambium.tg-live-proof-capture-plan.v2');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'in-app-signed-receipt')?.state, 'ready-to-capture');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'worker-list-proof')?.state, 'blocked');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'device-webview-proof'), undefined);
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'signed-action-smoke'), undefined);
  assert.match(report.invariant, /in-app signed action receipt/);
});

test('live proof readiness hard-blocks when pasted initData env vars are present', () => {
  for (const envName of ['TELEGRAM_INIT_DATA', 'TG_INIT_DATA']) {
    const cwd = fixtureRepo();
    const initData = pastedInitData();
    const report = assessLiveProofReadiness({
      cwd,
      home: join(cwd, 'home'),
      env: { [envName]: initData, CHROME_BIN: join(cwd, 'missing-chrome') },
      generatedAt: '2026-06-22T00:01:00.000Z',
    });

    const guard = report.items.find((item) => item.id === 'no-pasted-init-data');
    assert.equal(guard?.state, 'blocked');
    assert.match(guard?.detail ?? '', /pasted initData is rejected/);
    assert.match(guard?.missing.join(' ') ?? '', /unset TELEGRAM_INIT_DATA and TG_INIT_DATA/);
    assert.equal(report.summary.liveProofReady, false);
    assert.equal(report.capturePlan.steps.find((step) => step.id === 'in-app-signed-receipt')?.state, 'blocked');

    const text = JSON.stringify(report);
    assert.doesNotMatch(text, new RegExp(`query_id=|auth_date=|secret-hash|secret-signature|${TEST_TELEGRAM_USER_ID}|tgWebAppData`));
  }
});

test('readiness v2 rejects retired manual capture flags and keeps the Worker probe flag', () => {
  for (const flag of [
    '--capture-device-proof',
    '--capture-signed-smoke',
    '--screenshot',
    '--webview-url',
    '--platform',
    '--safe-area',
    '--action-kind',
    '--action-subject',
    '--action-idempotency-key',
    '--operator-command',
    '--operator-audit',
    '--miniapp-envelope',
    '--visible-marker',
    '--allow-mutation',
    '--device-proof',
    '--write-device-template',
  ]) {
    assert.throws(() => parseArgs([flag, 'value']), /is retired/);
  }

  const args = parseArgs(['--capture-worker-probe', '--allow-network', '--write', '--strict']);
  assert.equal(args.captureWorkerProbe, true);
  assert.equal(args.allowNetwork, true);
  assert.equal(args.write, true);
  assert.equal(args.strict, true);
});

test('signed action receipt v2 validates a redacted in-app artifact', () => {
  const cwd = fixtureRepo();
  const artifact = validReceiptV2();
  const verdict = validateSignedActionReceiptArtifact(artifact, {
    tenant: 'cambium',
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  assert.equal(verdict.ready, true);
  assert.ok(verdict.evidence.some((entry) => String(entry).startsWith('workerVersionId:42e74689')));

  const path = writeSignedActionReceiptArtifact(artifact, '.artifacts/tg-miniapp-live-proof/signed-action-smoke.json', cwd);
  const text = readFileSync(path, 'utf8');
  assert.match(text, /cambium\.signed-action-smoke\.v2/);
  assert.doesNotMatch(text, new RegExp(`query_id=|auth_date=|secret-hash|secret-signature|${TEST_TELEGRAM_USER_ID}|tgWebAppData|Bearer\\s+|initDataHash`));

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:02:00.000Z',
  });
  assert.equal(report.items.find((item) => item.id === 'founder-device-receipt')?.state, 'ready');
  assert.equal(report.capturePlan.steps.find((step) => step.id === 'in-app-signed-receipt')?.state, 'complete');
});

test('signed action receipt v2 hard-rejects pasted initData anywhere in the artifact', () => {
  const withInitDataField = validateSignedActionReceiptArtifact(
    validReceiptV2({ initData: pastedInitData() }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:02:00.000Z' },
  );
  assert.equal(withInitDataField.ready, false);
  assert.match(withInitDataField.missing.join(' '), /raw initData/);

  const withInitDataInNotes = validateSignedActionReceiptArtifact(
    validReceiptV2({ notes: [`captured with ${pastedInitData()}`] }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:02:00.000Z' },
  );
  assert.equal(withInitDataInNotes.ready, false);
  assert.match(withInitDataInNotes.missing.join(' '), /raw initData/);

  const withInitDataEnvValue = validateSignedActionReceiptArtifact(
    validReceiptV2({ captureEnv: 'TELEGRAM_INIT_DATA=query_id=real-query&auth_date=1782080030' }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:02:00.000Z' },
  );
  assert.equal(withInitDataEnvValue.ready, false);
  assert.match(withInitDataEnvValue.missing.join(' '), /raw initData/);

  const withRawUserId = validateSignedActionReceiptArtifact(
    validReceiptV2({ userIdHash: TEST_TELEGRAM_USER_ID }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:02:00.000Z' },
  );
  assert.equal(withRawUserId.ready, false);
  assert.match(withRawUserId.missing.join(' '), /userIdHash must be sha256/);
});

test('signed action receipt v2 rejects retired v1 proof artifacts', () => {
  const deviceProof = validateSignedActionReceiptArtifact(retiredDeviceProofV1(), {
    tenant: 'cambium',
    generatedAt: '2026-06-22T00:02:00.000Z',
  });
  assert.equal(deviceProof.ready, false);
  assert.match(deviceProof.missing.join(' '), /retired/);
  assert.match(deviceProof.missing.join(' '), /schema must be cambium\.signed-action-smoke\.v2/);

  const smokeV1 = validateSignedActionReceiptArtifact(
    validReceiptV2({ schema: 'cambium.signed-action-smoke.v1', telegram: { initDataHash: hashOf('init-data') }, phases: {} }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:02:00.000Z' },
  );
  assert.equal(smokeV1.ready, false);
  assert.match(smokeV1.missing.join(' '), /retired/);
});

test('signed action receipt v2 requires the full hash-only receipt shape', () => {
  const bad = validateSignedActionReceiptArtifact(
    validReceiptV2({
      capturedAt: 'not-a-timestamp',
      userIdHash: 'sha256:not-a-real-hash',
      actionKind: 'shell-out',
      subjectHash: '',
      idempotencyHash: 'deadbeef',
      workerVersionId: '  ',
    }),
    { tenant: 'cambium', generatedAt: '2026-06-22T00:02:00.000Z' },
  );

  assert.equal(bad.ready, false);
  assert.match(bad.missing.join(' '), /capturedAt must be a valid ISO timestamp/);
  assert.match(bad.missing.join(' '), /userIdHash must be sha256/);
  assert.match(bad.missing.join(' '), /actionKind must be one of/);
  assert.match(bad.missing.join(' '), /subjectHash must be sha256/);
  assert.match(bad.missing.join(' '), /idempotencyHash must be sha256/);
  assert.match(bad.missing.join(' '), /workerVersionId is required/);
});

test('receipt template writer creates a non-authoritative scaffold that never counts as proof', () => {
  const cwd = fixtureRepo();
  const template = createSignedActionReceiptTemplate({ tenant: 'cambium', generatedAt: '2026-06-22T00:03:00.000Z' });
  const path = writeSignedActionReceiptTemplate(template, '.artifacts/tg-miniapp-live-proof/signed-action-smoke.template.json', cwd);
  const text = readFileSync(path, 'utf8');

  assert.match(text, /cambium\.signed-action-smoke-template\.v2/);
  assert.match(text, /"writesAuthority": false/);
  assert.match(text, /"userIdHash"/);
  assert.match(text, /"actionKind"/);
  assert.match(text, /"subjectHash"/);
  assert.match(text, /"idempotencyHash"/);
  assert.match(text, /"workerVersionId"/);
  assert.doesNotMatch(text, /query_id=|auth_date=|tgWebAppData|Bearer should-not-be-stored|QUESTS_PUSH_TOKEN=|initDataHash/);

  writeSignedActionReceiptTemplate(template, '.artifacts/tg-miniapp-live-proof/signed-action-smoke.json', cwd);
  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: join(cwd, 'missing-chrome') },
    generatedAt: '2026-06-22T00:03:30.000Z',
  });
  const receipt = report.items.find((item) => item.id === 'founder-device-receipt');
  assert.equal(receipt?.state, 'blocked');
  assert.deepEqual(receipt?.evidence, []);
  assert.match(receipt?.missing.join(' ') || '', /replace template/);
});

test('live proof readiness becomes ready with an in-app receipt, Worker probe, and no pasted initData', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  writeFileSync(chrome, '');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  mkdirSync(viewportDir, { recursive: true });
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:01:00.000Z',
    proofs: [{ path: 'inspect-tapestry-audit-mobile.png', width: 780, height: 1688, bytes: 1000 }],
  }));
  writeFileSync(
    join(cwd, '.artifacts/tg-miniapp-live-proof/signed-action-smoke.json'),
    JSON.stringify(validReceiptV2()),
  );
  writeFileSync(
    join(cwd, '.artifacts/tg-miniapp-live-proof/worker-network-probe.json'),
    JSON.stringify(validWorkerProbe({ workerUrl: 'https://worker.test' })),
  );

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: {
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
  assert.equal(report.items.find((item) => item.id === 'no-pasted-init-data')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'founder-device-receipt')?.state, 'ready');
  assert.equal(report.items.find((item) => item.id === 'worker-network-probe')?.state, 'ready');
});

test('live proof readiness does not count a Worker probe template as production evidence', () => {
  const cwd = fixtureRepo();
  writeWorkerProbeTemplate(
    createWorkerProbeTemplate({
      tenant: 'cambium',
      workerUrl: 'https://curious.thoughtseed.space',
      generatedAt: '2026-06-22T00:00:00.000Z',
    }),
    '.artifacts/tg-miniapp-live-proof/worker-network-probe.json',
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

  const path = writeWorkerProbeArtifact(artifact, '.artifacts/tg-miniapp-live-proof/worker-network-probe.json', cwd);
  const text = readFileSync(path, 'utf8');
  assert.doesNotMatch(text, /secret-token|queued-action|founderId|Bearer/);

  const verdict = validateWorkerProbeArtifact(artifact, {
    tenant: 'cambium',
    workerUrl: 'https://worker.test',
    generatedAt: '2026-06-22T00:01:00.000Z',
  });
  assert.equal(verdict.ready, true);
});

test('Worker probe template writer creates a non-authoritative scaffold', () => {
  const cwd = fixtureRepo();
  const template = createWorkerProbeTemplate({
    tenant: 'cambium',
    workerUrl: 'https://curious.thoughtseed.space',
    generatedAt: '2026-06-22T00:04:00.000Z',
  });
  const path = writeWorkerProbeTemplate(template, '.artifacts/tg-miniapp-live-proof/worker-network-probe.template.json', cwd);
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

test('live proof readiness blocks stale viewport manifests after a newer failure receipt', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  const diagnosticsDir = join(cwd, '.artifacts/tg-miniapp-viewport');
  mkdirSync(viewportDir, { recursive: true });
  mkdirSync(diagnosticsDir, { recursive: true });
  writeFileSync(chrome, '');
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({ generatedAt: '2026-06-22T00:00:00.000Z' }));
  writeFileSync(join(diagnosticsDir, 'failure.json'), JSON.stringify({
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
  assert.ok(viewport?.evidence.includes('.artifacts/tg-miniapp-viewport/failure.json'));
});

test('live proof readiness orders viewport receipts by generatedAt instead of checkout mtime', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  const diagnosticsDir = join(cwd, '.artifacts/tg-miniapp-viewport');
  mkdirSync(viewportDir, { recursive: true });
  mkdirSync(diagnosticsDir, { recursive: true });
  writeFileSync(chrome, '');
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({ generatedAt: '2026-06-22T00:02:00.000Z' }));
  writeFileSync(join(diagnosticsDir, 'failure.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:01:00.000Z',
    error: 'Older diagnostic copied after the passing manifest',
  }));

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: { CHROME_BIN: chrome },
    generatedAt: '2026-06-22T00:03:00.000Z',
  });

  const viewport = report.items.find((item) => item.id === 'viewport-layout-proof');
  assert.equal(viewport?.state, 'ready');
  assert.match(viewport?.detail ?? '', /viewport manifest exists/);
});

test('live proof readiness blocks a viewport manifest from a different PAGE source', () => {
  const cwd = fixtureRepo();
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  const diagnosticsDir = join(cwd, '.artifacts/tg-miniapp-viewport');
  mkdirSync(viewportDir, { recursive: true });
  mkdirSync(diagnosticsDir, { recursive: true });
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:02:00.000Z',
    pageSourceSha256: 'a'.repeat(64),
  }));

  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: {},
    generatedAt: '2026-06-22T00:03:00.000Z',
    expectedPageSourceSha256: 'b'.repeat(64),
  });
  const viewport = report.items.find((entry: { id: string }) => entry.id === 'viewport-layout-proof');
  assert.equal(viewport?.state, 'blocked');
  assert.match(viewport?.detail ?? '', /different PAGE source/);
  assert.deepEqual(viewport?.missing, ['rerun npm run proof:tg-viewport from the current PAGE source']);
});

test('live proof readiness treats viewport browser diagnostics as evidence, not proof', () => {
  const cwd = fixtureRepo();
  const chrome = join(cwd, 'chrome');
  const viewportDir = join(cwd, 'docs/plans/assets/tg-miniapp-viewport-proof');
  const diagnosticsDir = join(cwd, '.artifacts/tg-miniapp-viewport');
  mkdirSync(viewportDir, { recursive: true });
  mkdirSync(diagnosticsDir, { recursive: true });
  writeFileSync(chrome, '');
  writeFileSync(join(viewportDir, 'manifest.json'), JSON.stringify({ generatedAt: '2026-06-22T00:00:00.000Z' }));
  writeFileSync(join(diagnosticsDir, 'failure.json'), JSON.stringify({
    generatedAt: '2026-06-22T00:01:00.000Z',
    error: 'No configured browser exposed a Chrome DevTools Protocol endpoint',
  }));
  writeFileSync(join(diagnosticsDir, 'browser-diagnostics.json'), JSON.stringify({
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
  assert.ok(viewport?.evidence.includes('.artifacts/tg-miniapp-viewport/browser-diagnostics.json'));
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
      { scene: 'mission', fixture: 'no-fake-progress', url: 'http://127.0.0.1:8787/?tenant=cambium&scene=mission', path: 'mission-control-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 900 },
      { scene: 'story', fixture: 'fresh', url: 'http://127.0.0.1:8787/?tenant=cambium&scene=story', path: 'story-feed-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 950 },
      { scene: 'inspect', fixture: 'no-fake-progress', path: 'inspect-tapestry-audit-mobile.png', intent: 'layout-proof', clickTargetCount: 14, width: 780, height: 1688, bytes: 1000 },
      { scene: 'inspect', fixture: 'no-fake-progress', path: 'inspect-live-proof-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 1200 },
      { scene: 'inspect', fixture: 'skill', path: 'inspect-skill-promotion-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 1400 },
      { scene: 'inspect', fixture: 'mira', path: 'inspect-companions-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 1500 },
      { scene: 'inspect', fixture: 'skill', path: 'sheet-inspect-skill-promotion-mobile.png', intent: 'clickability-proof', clickTargetSelector: '[data-skill="0"]', clickTargetCount: 1, clipSelector: '#sheet', sheet: { clipSelector: '#sheet' }, width: 780, height: 844, bytes: 2000 },
      { scene: 'gate', fixture: 'no-fake-progress', path: 'gate-empty-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 1550 },
      { scene: 'gate', fixture: 'gate', path: 'gate-consequence-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 1600 },
      { scene: 'gate', fixture: 'gate', path: 'sheet-gate-approve-preflight-mobile.png', intent: 'clickability-proof', clickTargetSelector: '[data-signed-action-entrypoint="approve"]', clickTargetCount: 1, clipSelector: '#sheet', sheet: { clipSelector: '#sheet' }, width: 780, height: 844, bytes: 2100 },
      { scene: 'gate', fixture: 'gate', path: 'sheet-gate-reroll-preflight-mobile.png', intent: 'clickability-proof', clickTargetSelector: '[data-signed-action-entrypoint="reroll"]', clickTargetCount: 1, clipSelector: '#sheet', sheet: { clipSelector: '#sheet' }, width: 780, height: 844, bytes: 2200 },
      { scene: 'tools', fixture: 'fresh', url: 'http://127.0.0.1:8787/?tenant=cambium&scene=tools&fixture=fresh', path: 'tools-mobile.png', intent: 'layout-proof', width: 780, height: 1688, bytes: 1700 },
      { scene: 'tools', fixture: 'fresh', url: 'http://127.0.0.1:8787/?tenant=cambium&scene=tools&fixture=fresh', path: 'sheet-tools-handoff-action-mobile.png', intent: 'clickability-proof', clickTargetSelector: '[data-tool-surface="handoffs"]', clickTargetCount: 1, clipSelector: '#sheet', sheet: { clipSelector: '#sheet' }, width: 780, height: 844, bytes: 2300 },
    ],
  });
  const artifact = JSON.parse(JSON.stringify(manifest));

  assert.equal(artifact.schema, 'cambium.tg-viewport-proof-manifest.v1');
  assert.match(artifact.pageSourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(artifact.browserMode, 'headless-new');
  assert.equal(artifact.chrome, 'Google Chrome');
  assert.deepEqual(artifact.browserCandidates, ['Google Chrome']);
  assert.deepEqual(artifact.proofIntentSummary, { 'layout-proof': 9, 'clickability-proof': 4 });
  assert.deepEqual(artifact.proofs.map((proof: { intent: string }) => proof.intent), ['layout-proof', 'layout-proof', 'layout-proof', 'layout-proof', 'layout-proof', 'layout-proof', 'clickability-proof', 'layout-proof', 'layout-proof', 'clickability-proof', 'clickability-proof', 'layout-proof', 'clickability-proof']);
  assert.equal(artifact.proofs.find((proof: { scene: string }) => proof.scene === 'mission')?.path, 'mission-control-mobile.png');
  assert.match(artifact.proofs.find((proof: { scene: string }) => proof.scene === 'mission')?.url ?? '', /\?tenant=cambium&scene=mission/);
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'mission-actions-mobile.png' && proof.scene === 'mission' && proof.fixture === 'branch-stories' && proof.intent === 'layout-proof' && proof.scrollSelector === '[data-component="GateActionRow"]'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'mission-utilities-mobile.png' && proof.scene === 'mission' && proof.fixture === 'branch-stories' && proof.intent === 'layout-proof' && proof.scrollSelector === '[data-component="MissionToolLink"]' && proof.assertExpression?.includes('compactActionsDoNotOverlap')));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'sheet-mission-review-gate-mobile.png' && proof.scene === 'mission' && proof.fixture === 'branch-stories' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-mission-action="gate"]'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'sheet-mission-open-proof-mobile.png' && proof.scene === 'mission' && proof.fixture === 'branch-stories' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-mission-action="proof"]'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'mission-vantyx-selected-mobile.png' && proof.scene === 'mission' && proof.fixture === 'branch-stories' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-mission-branch="1"]' && proof.tapTargetSelector === '[data-mission-branch="1"]' && proof.clipSelector === undefined && proof.touchDragTargetSelector === '.mc-branch-rail' && proof.assertExpression?.includes('drag.delta >= 24') && proof.assertExpression?.includes('document.activeElement === selected')));
  const missionProof320 = VIEWPORT_PROOF_CAPTURE_STEPS.find((proof) => proof.path === 'mission-control-320-mobile.png');
  assert.equal(missionProof320?.viewport?.width, 320);
  assert.equal(missionProof320?.exactViewport, true);
  assert.match(missionProof320?.assertExpression ?? '', /document\.documentElement\.scrollWidth <= document\.documentElement\.clientWidth \+ 1/);
  assert.match(missionProof320?.assertExpression ?? '', /questline\.scrollWidth <= questline\.clientWidth \+ 1/);
  assert.match(missionProof320?.assertExpression ?? '', /data-horizontal-scroll="branch-rail"/);
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'mission-control-mobile.png' && typeof proof.assertExpression === 'string'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'mission-control-430-mobile.png' && proof.viewport?.width === 430 && proof.exactViewport === true && typeof proof.assertExpression === 'string'));
  assert.equal(artifact.proofs.find((proof: { scene: string }) => proof.scene === 'story')?.path, 'story-feed-mobile.png');
  assert.match(artifact.proofs.find((proof: { scene: string }) => proof.scene === 'story')?.url ?? '', /\?tenant=cambium&scene=story/);
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'inspect-tapestry-audit-mobile.png')?.clickTargetCount, 14);
  const inspectProof320 = VIEWPORT_PROOF_CAPTURE_STEPS.find((proof) => proof.path === 'inspect-proof-320-mobile.png');
  assert.equal(inspectProof320?.viewport?.width, 320);
  assert.equal(inspectProof320?.exactViewport, true);
  assert.equal(typeof inspectProof320?.assertExpression, 'string');
  assert.match(inspectProof320?.assertExpression ?? '', /\.maphead \.mapbadge\[data-ecosystem-target="r3f"\]/);
  assert.match(inspectProof320?.assertExpression ?? '', /\[data-component="InspectProofSummaryAction"\] \[data-inspect-summary="1"\]/);
  assert.match(inspectProof320?.assertExpression ?? '', /frontierMapBadges\.length === 1/);
  assert.match(inspectProof320?.assertExpression ?? '', /proofDetailsButtons\.length === 1/);
  assert.match(inspectProof320?.assertExpression ?? '', /frontierMapBadge\.getBoundingClientRect\(\)\.height >= 44/);
  assert.match(inspectProof320?.assertExpression ?? '', /openProofDetails\.getBoundingClientRect\(\)\.height >= 44/);
  assert.match(inspectProof320?.assertExpression ?? '', /document\.documentElement\.scrollWidth <= document\.documentElement\.clientWidth \+ 1/);
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'inspect-system-overview-mobile.png' && proof.scene === 'inspect' && typeof proof.assertExpression === 'string' && proof.waitAfterExpression?.includes('document.activeElement')));
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'inspect-live-proof-mobile.png')?.scene, 'inspect');
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'inspect-live-proof-mobile.png' && proof.scene === 'inspect'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'story-feed-mobile.png' && proof.scene === 'story' && proof.fixture === 'fresh'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'inspect-skill-promotion-mobile.png' && proof.scene === 'inspect' && proof.fixture === 'skill'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'sheet-inspect-skill-promotion-mobile.png' && proof.scene === 'inspect' && proof.fixture === 'skill' && proof.intent === 'clickability-proof' && proof.clipSelector === '#sheet'));
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'inspect-skill-promotion-mobile.png')?.scene, 'inspect');
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'inspect-companions-mobile.png' && proof.scene === 'inspect' && proof.fixture === 'mira'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'inspect-mira-relationship-mobile.png' && proof.scene === 'inspect' && proof.fixture === 'mira' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-npc="0"]' && proof.clipSelector === '#sheet'));
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'inspect-companions-mobile.png')?.scene, 'inspect');
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'gate-empty-mobile.png' && proof.scene === 'gate' && proof.fixture === undefined && proof.intent === 'layout-proof'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'gate-consequence-mobile.png' && proof.scene === 'gate' && proof.fixture === 'gate'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'sheet-gate-approve-preflight-mobile.png' && proof.scene === 'gate' && proof.fixture === 'gate' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-signed-action-entrypoint="approve"]'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'sheet-gate-reroll-preflight-mobile.png' && proof.scene === 'gate' && proof.fixture === 'gate' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-signed-action-entrypoint="reroll"]'));
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'sheet-gate-approve-preflight-mobile.png')?.scene, 'gate');
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'sheet-gate-reroll-preflight-mobile.png')?.scene, 'gate');
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'tools-mobile.png')?.scene, 'tools');
  assert.match(artifact.proofs.find((proof: { path: string }) => proof.path === 'tools-mobile.png')?.url ?? '', /\?tenant=cambium&scene=tools&fixture=fresh/);
  assert.equal(artifact.proofs.find((proof: { path: string }) => proof.path === 'sheet-tools-handoff-action-mobile.png')?.scene, 'tools');
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'tools-mobile.png' && proof.scene === 'tools' && proof.fixture === 'fresh'));
  assert.ok(VIEWPORT_PROOF_CAPTURE_STEPS.some((proof) => proof.path === 'sheet-tools-handoff-action-mobile.png' && proof.scene === 'tools' && proof.fixture === 'fresh' && proof.intent === 'clickability-proof' && proof.clickTargetSelector === '[data-tool-surface="handoffs"]'));
  assert.equal(artifact.proofs.find((proof: { intent: string }) => proof.intent === 'clickability-proof')?.path, 'sheet-inspect-skill-promotion-mobile.png');
  assert.equal(artifact.proofs.find((proof: { intent: string }) => proof.intent === 'clickability-proof')?.clipSelector, '#sheet');
  assert.equal(artifact.proofs.find((proof: { intent: string }) => proof.intent === 'clickability-proof')?.clickTargetCount, 1);
  assert.match(artifact.invariant, /clipped real sheet proof/);
});

test('viewport proof manifest schema rejects missing clickability selectors or raw secret text', () => {
  assert.throws(
    () => assertViewportProofManifestSchema({
      schema: 'cambium.tg-viewport-proof-manifest.v1',
      generatedAt: '2026-06-22T00:01:00.000Z',
      chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      browserMode: 'headless-new',
      browserCandidates: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      viewport: { width: 390, height: 844 },
      proofIntentSummary: { 'clickability-proof': 1 },
      invariant: 'Screenshots use real PAGE export and clipped real sheet proof.',
      proofs: [
        { scene: 'gate', fixture: 'gate', path: 'sheet-gate-approve-preflight-mobile.png', intent: 'clickability-proof', url: 'https://example.test/?tgWebAppData=secret', width: 780, height: 844, bytes: 1200 },
      ],
    }),
    /clickTargetSelector|clipSelector|raw Telegram initData/,
  );
});

test('queued viewport fixture is redacted and filtered proofs cannot replace canonical artifacts', () => {
  const fixtureText = JSON.stringify(buildQueuedActionRequestFixture());
  assert.doesNotMatch(fixtureText, /QUESTS_PUSH_TOKEN|query_id=|auth_date=|tgWebAppData|Bearer\s+|secret-hash|secret-signature/);
  assert.equal(shouldWriteCanonicalViewportArtifacts(''), true);
  assert.equal(shouldWriteCanonicalViewportArtifacts('sheet-gate-queued-proof-detail-mobile.png'), false);
  assert.equal(shouldWriteCanonicalViewportArtifacts('', true), false);
  assert.match(viewportProofArtifactDirectory(), /docs\/plans\/assets\/tg-miniapp-viewport-proof$/);
  assert.match(viewportProofArtifactDirectory({ mobileContractOnly:true }), /\.artifacts\/tg-miniapp-viewport\/captures$/);
  assert.match(viewportProofArtifactDirectory({ proofPathFilter:'gate' }), /\.artifacts\/tg-miniapp-viewport\/captures$/);
});

test('mobile contract proof is focused, noncanonical, and required by CI plus release', () => {
  const steps = selectViewportProofCaptureSteps({ proofPathFilter:'', mobileContractOnly:true });
  assert.deepEqual(steps.map((proof) => proof.path), MOBILE_CONTRACT_PROOF_PATHS);
  assert.ok(steps.some((proof) => proof.fixture === 'action-request-queued' && proof.tapTargetSelector));
  assert.ok(steps.every((proof) => Boolean(proof.assertExpression) || Boolean(proof.tapTargetSelector)));

  const packageJson = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['proof:tg-mobile-contract'], 'CAMBIUM_RUN_VIEWPORT_PROOF=1 node workers/quests/src/visual-viewport-proof.mjs --mobile-contract');
  const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const release = readFileSync(new URL('../../../.github/workflows/release.yml', import.meta.url), 'utf8');
  const verifyRelease = readFileSync(new URL('../../../scripts/verify-release.mjs', import.meta.url), 'utf8');
  assert.match(verifyRelease, /proof:tg-mobile-contract/);
  assert.match(ci, /npm run verify:release/);
  assert.match(release, /npm run verify:release/);
});

test('mobile touch proof retries only when a real drag produced insufficient scroll', () => {
  assert.equal(touchDragNeedsRetry({ delta:0 }), true);
  assert.equal(touchDragNeedsRetry({ delta:23.99 }), true);
  assert.equal(touchDragNeedsRetry({ delta:24 }), false);
  assert.equal(touchDragNeedsRetry({ delta:96 }), false);
});

test('fresh viewport captures pin browser Date.now to the deterministic fixture proof clock', async () => {
  const viewportProof = await import('./visual-viewport-proof.mjs');
  assert.equal(typeof viewportProof.browserClockOverrideExpression, 'function');

  const expression = viewportProof.browserClockOverrideExpression('2026-06-22T10:00:00.000Z');
  const observed = runInNewContext(`${expression}; Date.now()`);
  assert.equal(observed, 1_782_122_400_000);
  assert.throws(() => viewportProof.browserClockOverrideExpression('not-a-clock'), /canonical ISO timestamp/);
});

test('live proof readiness writes a redacted manifest artifact', () => {
  const cwd = fixtureRepo();
  const report = assessLiveProofReadiness({
    cwd,
    home: join(cwd, 'home'),
    env: {},
    generatedAt: '2026-06-22T00:02:00.000Z',
  });

  const path = writeReadinessManifest(report, '.artifacts/tg-miniapp-live-proof/readiness.json', cwd);
  assert.match(path, /readiness\.json$/);
  const text = readFileSync(path, 'utf8');
  assert.match(text, /cambium\.tg-live-proof-readiness\.v2/);
  assert.doesNotMatch(text, /QUESTS_PUSH_TOKEN=.*|hash=redacted/);
});

test('Task 13 evidence template requires the full local gate plus approval-gated device/promotion/rollback/signoff sections, and release scripts wire the focused integration+readiness proof', () => {
  const template = readFileSync(
    new URL('../../../docs/plans/evidence/cambium-operating-fabric-proof-template.md', import.meta.url),
    'utf8',
  );
  const requiredSections = [
    '## 1. Deterministic local gate (Task 13)',
    '## 2. Proof-chain trace (mission-fabric-integration.test.ts)',
    '## 3. Stable digest across delivery timestamps and freshness',
    '## 4. Zero-gap shadow parity',
    '## 5. Zero D1/KV writes',
    '## 6. Allowlist, auth, and tenant fail-closed checks',
    '## 7. Task 12 mobile/accessibility proof (carried forward)',
    '## 8. Real Telegram device proof (Task 14 — approval-gated)',
    '## 9. Tenant promotion record (approval-gated, NOT PERFORMED until sign-off)',
    '## 10. Rollback rehearsal (approval-gated, NOT PERFORMED until sign-off)',
    '## 11. Reviewer and founder sign-off',
  ];
  for (const section of requiredSections) {
    assert.ok(template.includes(section), `evidence template is missing required section: ${section}`);
  }
  assert.match(template, /node --test workers\/quests\/src\/mission-fabric-integration\.test\.ts/, 'local gate row requires the integration proof to run');

  const verifyRelease = readFileSync(new URL('../../../scripts/verify-release.mjs', import.meta.url), 'utf8');
  const standaloneSmoke = readFileSync(new URL('../../../scripts/standalone-smoke.mjs', import.meta.url), 'utf8');
  for (const script of [verifyRelease, standaloneSmoke]) {
    assert.match(script, /mission-fabric-integration\.test\.ts/, 'release script wires the mission fabric integration proof');
    assert.match(script, /live-proof-readiness\.test\.ts/, 'release script wires this readiness test file');
  }
  assert.match(verifyRelease, /proof:tg-mobile-contract/, 'verify-release explicitly requires the mobile contract proof');
});
