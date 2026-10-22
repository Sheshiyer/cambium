import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  assertViewportCaptureReceipt,
  buildViewportProofManifest,
  selectViewportProofCaptureSteps,
  validateViewportCaptureReceipt,
  viewportCaptureStepDigest,
  withServer,
} from './visual-viewport-proof.mjs';

// Synthetic unit-test envelopes exercise validation only. These fixtures are
// never written to the canonical proof directory or presented as UI evidence.
function crc32(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function png(width: number, height: number): Buffer {
  const chunk = (kind: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const content = Buffer.concat([Buffer.from(kind), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(content));
    return Buffer.concat([length, content, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function fixture(t: any, mobileContractOnly = false) {
  const directory = mkdtempSync(join(tmpdir(), 'cambium-iab-capture-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const steps = selectViewportProofCaptureSteps({ mobileContractOnly });
  const now = Date.now();
  const startedAt = new Date(now - 60_000).toISOString();
  const completedAt = new Date(now).toISOString();
  const images = new Map<string, Buffer>();
  const proofs = steps.map((step: any) => {
    const viewport = { width: 390, height: 844, ...step.viewport };
    const clip = step.clipSelector ? { x: 0, y: 422, width: viewport.width, height: 422 } : undefined;
    const width = clip?.width ?? viewport.width;
    const height = clip?.height ?? viewport.height;
    const sizeKey = `${width}x${height}`;
    if (!images.has(sizeKey)) images.set(sizeKey, png(width, height));
    const bytes = images.get(sizeKey)!;
    writeFileSync(join(directory, step.path), bytes);
    const capture: any = {
      status: 'passed', stepSha256: viewportCaptureStepDigest(step),
      viewport: { ...viewport, devicePixelRatio: 1 },
      ...(step.waitFor ? { waitForPassed: true } : {}),
      ...(step.prepareWaitFor ? { prepareWaitForPassed: true } : {}),
      ...(step.prepareExpression ? { preparePassed: true } : {}),
      ...(step.expression ? { expressionPassed: true } : {}),
      ...(step.scrollSelector || Number.isFinite(step.scrollTop) ? { scrollPassed: true } : {}),
      ...(step.waitAfterExpression ? { waitAfterPassed: true } : {}),
      ...(step.assertExpression ? { assertionResult: { ok: true } } : {}),
      ...(clip ? { clip } : {}),
      input: {},
    };
    if (step.tapTargetSelector) capture.input.tap = {
      kind: 'native', selector: step.tapTargetSelector, trustedEvents: 1, pointerType: 'touch',
    };
    if (step.touchDragTargetSelector) capture.input.touch = {
      selector: step.touchDragTargetSelector,
      beforeScrollLeft: 0, afterScrollLeft: 96, delta: 96,
      sceneBefore: 'tb0', sceneAfter: 'tb0', sheetBefore: false, sheetAfter: false,
      trackBefore: 'matrix(1, 0, 0, 1, 0, 0)', trackAfter: 'matrix(1, 0, 0, 1, 0, 0)',
      touchStarts: 1, touchMoves: 8, trustedTouchStarts: 1, trustedTouchMoves: 8,
    };
    return {
      scene: step.scene, fixture: step.fixture || 'no-fake-progress',
      url: `http://127.0.0.1:1234/?tenant=cambium&scene=${step.scene}`,
      path: step.path, intent: step.intent, viewport, viewportMode: 'iab-emulated-touch',
      ...(step.assertExpression ? { browserAssertions: true } : {}),
      ...(step.intent === 'clickability-proof' ? { interactionSurface: clip ? 'sheet' : 'page' } : {}),
      ...(step.clickTargetSelector ? { clickTargetSelector: step.clickTargetSelector } : {}),
      ...(step.clickTargetCount ? { clickTargetCount: step.clickTargetCount } : {}),
      ...(clip ? { clipSelector: step.clipSelector, sheet: { clipSelector: step.clipSelector } } : {}),
      ...(Number.isFinite(Number(step.expectedWorkerPostCount)) ? {
        expectedWorkerPostCount: step.expectedWorkerPostCount, workerPostCount: step.expectedWorkerPostCount,
      } : {}),
      width, height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), capture,
    };
  });
  const manifest: any = buildViewportProofManifest({
    generatedAt: completedAt, chrome: 'codex-iab', browserMode: 'iab-emulated-touch',
    browserCandidates: ['codex-iab'], viewport: { width: 390, height: 844 }, proofs,
  });
  manifest.capture = {
    schema: 'cambium.tg-viewport-capture.v1', adapter: 'codex-iab', mode: 'iab-emulated-touch',
    status: 'passed', physicalDevice: false, startedAt, completedAt,
    stepSourceSha256: viewportCaptureStepDigest(steps),
  };
  const options = { artifactDirectory: directory, mobileContractOnly, now };
  return { directory, manifest, options, now };
}

test('IAB receipt verification accepts complete canonical or exact mobile coverage', (t) => {
  const full = fixture(t);
  assert.equal(full.manifest.proofs.length, 47);
  assert.deepEqual(validateViewportCaptureReceipt(full.manifest, full.options), []);
  assert.deepEqual(validateViewportCaptureReceipt(full.manifest, { ...full.options, mobileContractOnly: true }), []);
  const mobile = fixture(t, true);
  assert.equal(mobile.manifest.proofs.length, 15);
  assert.deepEqual(validateViewportCaptureReceipt(mobile.manifest, mobile.options), []);
  assert.match(validateViewportCaptureReceipt(mobile.manifest, { ...mobile.options, mobileContractOnly: false }).join('\n'), /capture paths and ordering/);
});

test('IAB receipt rejects incomplete, duplicate, reordered or unrelated rows', (t) => {
  const { manifest, options } = fixture(t);
  for (const mutate of [
    (copy: any) => copy.proofs.pop(),
    (copy: any) => { copy.proofs[1] = copy.proofs[0]; },
    (copy: any) => copy.proofs.reverse(),
    (copy: any) => copy.proofs.push({ ...copy.proofs[0], path: '../unrelated.png' }),
  ]) {
    const copy = structuredClone(manifest);
    mutate(copy);
    assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /capture paths and ordering/);
  }
});

test('IAB receipt binds exact PAGE and capture instruction digests', (t) => {
  const { manifest, options } = fixture(t);
  for (const mutate of [
    (copy: any) => { copy.pageSourceSha256 = 'a'.repeat(64); },
    (copy: any) => { copy.capture.stepSourceSha256 = 'b'.repeat(64); },
    (copy: any) => { copy.proofs[0].capture.stepSha256 = 'c'.repeat(64); },
  ]) {
    const copy = structuredClone(manifest);
    mutate(copy);
    assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /digest is stale/);
  }
});

test('IAB receipt rejects held outcomes and physical-device claims', (t) => {
  const { manifest, options } = fixture(t);
  for (const mutate of [
    (copy: any) => { copy.capture.status = 'held'; },
    (copy: any) => { copy.capture.held = true; },
    (copy: any) => { copy.proofs[0].capture.status = 'held'; },
    (copy: any) => { copy.capture.physicalDevice = true; },
    (copy: any) => { copy.capture.mode = 'physical-touch'; },
  ]) {
    const copy = structuredClone(manifest);
    mutate(copy);
    assert.ok(validateViewportCaptureReceipt(copy, options).length > 0);
  }
});

test('IAB receipt requires every existing wait, preparation and browser assertion outcome', (t) => {
  const { manifest, options } = fixture(t);
  for (const property of ['waitForPassed', 'prepareWaitForPassed', 'preparePassed', 'expressionPassed', 'scrollPassed', 'waitAfterPassed', 'assertionResult']) {
    const copy = structuredClone(manifest);
    const row = copy.proofs.find((proof: any) => property in proof.capture);
    delete row.capture[property];
    assert.ok(validateViewportCaptureReceipt(copy, options).length > 0, property);
  }
  const copy = structuredClone(manifest);
  copy.proofs[0].capture.assertionResult = { ok: false };
  assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /browser assertion did not pass/);
});

test('IAB receipt binds observed viewport and exact target/fixture metadata', (t) => {
  const { manifest, options } = fixture(t);
  for (const mutate of [
    (copy: any) => { copy.proofs[0].capture.viewport.width = 321; },
    (copy: any) => { copy.proofs[0].viewport.height = 900; },
    (copy: any) => { copy.proofs[0].fixture = 'different-fixture'; },
    (copy: any) => { copy.proofs.find((proof: any) => proof.clickTargetSelector).clickTargetSelector = '#different'; },
    (copy: any) => { copy.proofs.find((proof: any) => proof.intent === 'clickability-proof').clickTargetCount = 2; },
  ]) {
    const copy = structuredClone(manifest);
    mutate(copy);
    assert.ok(validateViewportCaptureReceipt(copy, options).length > 0);
  }
});

test('IAB receipt rejects missing images, extra images and changed PNG bytes or dimensions', (t) => {
  const { directory, manifest, options } = fixture(t);
  const row = manifest.proofs[0];
  const original = readFileSync(join(directory, row.path));
  writeFileSync(join(directory, row.path), Buffer.concat([original, Buffer.from('changed')]));
  assert.match(validateViewportCaptureReceipt(manifest, options).join('\n'), /PNG digest mismatch|PNG dimensions and byte count/);
  writeFileSync(join(directory, row.path), png(321, 844));
  assert.match(validateViewportCaptureReceipt(manifest, options).join('\n'), /PNG dimensions and byte count|PNG width/);
  rmSync(join(directory, row.path));
  assert.match(validateViewportCaptureReceipt(manifest, options).join('\n'), /PNG cannot be verified|capture PNG set/);
  writeFileSync(join(directory, row.path), original);
  writeFileSync(join(directory, 'extra.png'), original);
  assert.match(validateViewportCaptureReceipt(manifest, options).join('\n'), /capture PNG set/);
});

test('IAB receipt rejects fabricated or insufficient drag and untrusted touch evidence', (t) => {
  const { manifest, options } = fixture(t);
  for (const property of ['trustedTouchStarts', 'trustedTouchMoves', 'touchStarts', 'touchMoves']) {
    const copy = structuredClone(manifest);
    copy.proofs.find((proof: any) => proof.capture.input.touch).capture.input.touch[property] = 0;
    assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /requires measured, trusted touch drag/);
  }
  for (const mutate of [
    (touch: any) => { touch.afterScrollLeft = 0; },
    (touch: any) => { touch.delta = 23; touch.afterScrollLeft = 23; },
    (touch: any) => { touch.sceneAfter = 'tb1'; },
    (touch: any) => { touch.sheetAfter = true; },
    (touch: any) => { touch.trackAfter = 'changed'; },
    (touch: any) => { touch.trustedTouchMoves = touch.touchMoves + 1; },
  ]) {
    const copy = structuredClone(manifest);
    mutate(copy.proofs.find((proof: any) => proof.capture.input.touch).capture.input.touch);
    assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /requires measured, trusted touch drag/);
  }
});

test('IAB receipt requires native trusted tap and exact Worker POST readback', (t) => {
  const { manifest, options } = fixture(t);
  const copy = structuredClone(manifest);
  copy.proofs.find((proof: any) => proof.capture.input.tap).capture.input.tap.trustedEvents = 0;
  assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /trusted native tap/);
  const postCopy = structuredClone(manifest);
  postCopy.proofs.find((proof: any) => proof.expectedWorkerPostCount === 1).workerPostCount = 0;
  assert.match(validateViewportCaptureReceipt(postCopy, options).join('\n'), /observed Worker posts/);
});

test('IAB receipt requires clipped actual sheet dimensions and byte counts', (t) => {
  const { manifest, options } = fixture(t);
  const copy = structuredClone(manifest);
  const row = copy.proofs.find((proof: any) => proof.clipSelector);
  row.capture.clip.height -= 10;
  assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /PNG height does not match/);
  const metadataCopy = structuredClone(manifest);
  metadataCopy.proofs[0].bytes += 1;
  assert.match(validateViewportCaptureReceipt(metadataCopy, options).join('\n'), /PNG dimensions and byte count/);
});

test('IAB receipt rejects offscreen clips and permits bounded fractional-pixel rounding', (t) => {
  const { manifest, options } = fixture(t);
  for (const mutate of [
    (clip: any) => { clip.x = 2; },
    (clip: any) => { clip.y += 2; },
    (clip: any) => { clip.x = 1000; },
    (clip: any) => { clip.y = 1000; },
    (clip: any) => { clip.width += 2; },
    (clip: any) => { clip.height += 2; },
  ]) {
    const copy = structuredClone(manifest);
    mutate(copy.proofs.find((proof: any) => proof.clipSelector).capture.clip);
    assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /observed sheet clip must stay inside the viewport/);
  }
  const rounded = structuredClone(manifest);
  const clip = rounded.proofs.find((proof: any) => proof.clipSelector).capture.clip;
  clip.x += 0.5;
  clip.y += 0.5;
  assert.deepEqual(validateViewportCaptureReceipt(rounded, options), []);
});

test('IAB receipt rejects stale, future or unordered capture timestamps', (t) => {
  const { manifest, options, now } = fixture(t);
  assert.match(validateViewportCaptureReceipt(manifest, { ...options, now: now + 3_600_001 }).join('\n'), /stale or future/);
  assert.match(validateViewportCaptureReceipt(manifest, { ...options, now: now - 6000 }).join('\n'), /stale or future/);
  const copy = structuredClone(manifest);
  copy.capture.startedAt = new Date(now + 1000).toISOString();
  assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /orderly and bounded/);
  copy.capture.startedAt = 'not-a-time';
  assert.match(validateViewportCaptureReceipt(copy, options).join('\n'), /canonical ISO/);
  assert.throws(() => assertViewportCaptureReceipt(copy, options), /Viewport capture verification failed/);
});

test('explicit IAB verification CLI checks a receipt without launching configured browser', (t) => {
  const { directory, manifest } = fixture(t, true);
  const file = join(directory, 'manifest.json');
  writeFileSync(file, JSON.stringify(manifest));
  const modulePath = fileURLToPath(new URL('./visual-viewport-proof.mjs', import.meta.url));
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = spawnSync(process.execPath, [modulePath, '--mobile-contract', `--verify-capture=${file}`], {
    cwd: root, env: { ...process.env, CHROME_BIN: join(directory, 'browser-must-never-launch') }, encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.proofCount, 15);
  assert.equal(report.physicalDevice, false);
  assert.equal(report.adapter, 'codex-iab');
});

test('malformed IAB verification option fails before any browser launch', (t) => {
  const { directory } = fixture(t, true);
  const modulePath = fileURLToPath(new URL('./visual-viewport-proof.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [modulePath, '--verify-capture'], {
    cwd: directory, env: { ...process.env, CHROME_BIN: join(directory, 'browser-must-never-launch') }, encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--verify-capture requires an explicit manifest path/);
  assert.doesNotMatch(result.stderr, /Chrome|browser binary|spawn/);
});

test('exported fixture server serves actual PAGE and closes after callback completion', async () => {
  let base = '';
  await withServer(async (url: string, metrics: { gatePostCount(): number }) => {
    base = url;
    const response = await fetch(`${url}/?tenant=cambium&scene=mission&fixture=branch-stories`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /MissionControlShell/);
    assert.equal(metrics.gatePostCount(), 0);
  });
  await assert.rejects(() => fetch(base));
});

test('fixture server pins the fresh clock before PAGE scripts and leaves other fixtures unchanged', async () => {
  await withServer(async (url: string) => {
    const fresh = await fetch(`${url}/?tenant=cambium&scene=story&fixture=fresh`).then((response) => response.text());
    const ordinary = await fetch(`${url}/?tenant=cambium&scene=mission&fixture=branch-stories`).then((response) => response.text());
    assert.match(fresh, /<head><script data-viewport-proof-clock="fixture-only">Object\.defineProperty\(Date, 'now'/);
    assert.ok(fresh.indexOf('data-viewport-proof-clock') < fresh.indexOf('src="/telegram-web-app.js"'));
    assert.doesNotMatch(ordinary, /data-viewport-proof-clock/);
  });
});
