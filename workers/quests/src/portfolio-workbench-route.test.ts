import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildDataCheckString, handle } from './handler.ts';
import type { GateConfig, HandlerDeps, SimpleRequest } from './handler.ts';
import {
  PORTFOLIO_WORKBENCH_HTML,
  PORTFOLIO_WORKBENCH_SHA256,
} from './portfolio-workbench.generated.ts';
import { PORTFOLIO_WORKBENCH_LOADER } from './portfolio-workbench.ts';
import { PORTFOLIO_WORKBENCH_CSP } from './portfolio-workbench.ts';
import { OPERATING_FABRIC_BOOT } from './page/operating-fabric/client.ts';
import { OPERATING_FABRIC_SCENES } from './page/operating-fabric/scaffold.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;
const NOW_MS = 1_750_000_000_000;
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const VIEWER_ID = '200000099';

async function signedInitData(userId: string): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams({
    auth_date: String(NOW_MS / 1000 - 10),
    user: JSON.stringify({ id: Number(userId), first_name: 'Founder' }),
    query_id: 'AAportfolio',
  });
  const { dcs } = buildDataCheckString(fields.toString(), BOT_ID);
  const signature = new Uint8Array(
    await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(dcs)),
  );
  fields.set('signature', Buffer.from(signature).toString('base64url'));
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

function request(method: string, path: string, headers: Record<string, string> = {}): SimpleRequest {
  return { method, path, headers };
}

function deps(gate?: GateConfig): { value: HandlerDeps; writes: () => number } {
  let writeCount = 0;
  return {
    value: {
      kv: {
        async get() { return null; },
        async list() { return []; },
        async put() { writeCount += 1; },
      },
      gate,
    },
    writes: () => writeCount,
  };
}

test('public portfolio route serves only a Telegram bootstrap and both routes are GET-only', async () => {
  const fixture = deps();
  const response = await handle(request('GET', '/admin/portfolio'), fixture.value);
  assert.equal(response.status, 200);
  assert.equal(response.body, PORTFOLIO_WORKBENCH_LOADER);
  assert.match(String(response.body), /telegram-web-app\.js/);
  assert.match(String(response.body), /WebApp/);
  assert.match(String(response.body), /x-telegram-init-data/);
  assert.doesNotMatch(String(response.body), /sapling:|client-branch|internal-program|portfolio-workbench\.v2/);
  assert.doesNotMatch(String(response.body), /localStorage|sessionStorage|console\./);
  assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
  for (const path of ['/admin/portfolio', '/v1/admin/portfolio']) {
    const denied = await handle(request('POST', path), fixture.value);
    assert.equal(denied.status, 405);
    assert.equal(denied.headers.allow, 'GET');
  }
  assert.equal(fixture.writes(), 0);
});

test('protected portfolio endpoint fails closed for configuration and Telegram founder authorization', async () => {
  assert.equal((await handle(request('GET', '/v1/admin/portfolio'), deps().value)).status, 503);
  assert.equal((await handle(request('GET', '/v1/admin/portfolio'), deps({
    botId: BOT_ID,
    pubKeyHex: '',
    founderIds: [FOUNDER_ID],
    now: () => NOW_MS,
  }).value)).status, 503);
  assert.equal((await handle(request('GET', '/v1/admin/portfolio'), deps({
    botId: BOT_ID,
    pubKeyHex: 'not-an-ed25519-public-key',
    founderIds: [FOUNDER_ID],
    now: () => NOW_MS,
  }).value)).status, 503);

  const founder = await signedInitData(FOUNDER_ID);
  const gate: GateConfig = {
    botId: BOT_ID,
    pubKeyHex: founder.pubKeyHex,
    founderIds: [FOUNDER_ID],
    now: () => NOW_MS,
  };
  const missing = await handle(request('GET', '/v1/admin/portfolio'), deps(gate).value);
  assert.equal(missing.status, 401);
  const invalid = await handle(
    request('GET', '/v1/admin/portfolio', { 'x-telegram-init-data': 'auth_date=1' }),
    deps(gate).value,
  );
  assert.equal(invalid.status, 401);

  const viewer = await signedInitData(VIEWER_ID);
  const viewerGate: GateConfig = {
    ...gate,
    pubKeyHex: viewer.pubKeyHex,
  };
  const denied = await handle(
    request('GET', '/v1/admin/portfolio', { 'x-telegram-init-data': viewer.initData }),
    deps(viewerGate).value,
  );
  assert.equal(denied.status, 401);
  assert.equal(invalid.body, missing.body);
  assert.equal(denied.body, missing.body);
  assert.deepEqual(invalid.headers, missing.headers);
  assert.deepEqual(denied.headers, missing.headers);
  assert.doesNotMatch(String(denied.body), /founder|allowlist|reason/i);
});

test('founder receives the exact generated bundle with strict no-store and CSP headers and zero writes', async () => {
  const auth = await signedInitData(FOUNDER_ID);
  const fixture = deps({
    botId: BOT_ID,
    pubKeyHex: auth.pubKeyHex,
    founderIds: [FOUNDER_ID],
    now: () => NOW_MS,
  });
  const response = await handle(
    request('GET', '/v1/admin/portfolio', { 'x-telegram-init-data': auth.initData }),
    fixture.value,
  );
  const diskBundle = readFileSync(
    new URL('../../../apps/portfolio-cartographer/bundle.html', import.meta.url),
    'utf8',
  );
  assert.equal(response.status, 200);
  assert.equal(response.body, PORTFOLIO_WORKBENCH_HTML);
  assert.equal(response.body, diskBundle);
  assert.equal(
    createHash('sha256').update(String(response.body), 'utf8').digest('hex'),
    PORTFOLIO_WORKBENCH_SHA256,
  );
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.match(response.headers['content-security-policy'], /default-src 'none'/);
  assert.match(response.headers['content-security-policy'], /connect-src 'none'/);
  const documentCsp = PORTFOLIO_WORKBENCH_CSP
    .split('; ')
    .filter((directive) => !directive.startsWith('frame-ancestors '))
    .join('; ');
  assert.match(String(response.body), new RegExp(
    `<meta http-equiv="Content-Security-Policy" content="${documentCsp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
  ));
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(fixture.writes(), 0);
});

test('operating fabric exposes the Workbench link only when founder detail exists', () => {
  assert.match(
    OPERATING_FABRIC_SCENES,
    /data-of-portfolio-workbench hidden inert aria-label="Open Portfolio Workbench"/,
  );
  assert.match(OPERATING_FABRIC_SCENES, /href="\/admin\/portfolio"/);
  assert.match(
    OPERATING_FABRIC_BOOT,
    /founderDetail = Boolean\(catalog && Array\.isArray\(catalog\.records\)\)/,
  );
  assert.match(OPERATING_FABRIC_BOOT, /link\.hidden = !founderDetail/);
  assert.match(OPERATING_FABRIC_BOOT, /link\.inert = !founderDetail/);
});
