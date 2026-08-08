import assert from 'node:assert/strict';
import { createHash, createSign, generateKeyPairSync, webcrypto } from 'node:crypto';
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
import type {
  PortfolioAdminActionQueueLike,
  PortfolioAdminActionStoreLike,
} from './portfolio-admin-actions.ts';
import { OPERATING_FABRIC_BOOT } from './page/operating-fabric/client.ts';
import { OPERATING_FABRIC_SCENES } from './page/operating-fabric/scaffold.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;
const NOW_MS = 1_750_000_000_000;
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const VIEWER_ID = '200000099';
const TEAM_DOMAIN = 'red-queen-4dfa.cloudflareaccess.com';
const ACCESS_AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';
const ACCESS_KID = 'portfolio-access-test-kid';
const PORTFOLIO_BYTES_RE = /portfolio-workbench@v4; hosted-admin|data-bundled="portfolio-cartographer"/;
const ROOT_DIGEST = '8a3b3bb07018ebbf44f4ad13e88b3f48f616d43daa1b7faf7d03f4ddfc6dafbe';
const SOURCE_DIGEST = '18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542';

const { publicKey: accessPublicKey, privateKey: accessPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const accessJwk = accessPublicKey.export({ format: 'jwk' });

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

function request(method: string, path: string, headers: Record<string, string> = {}, body?: unknown): SimpleRequest {
  return { method, path, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

function portfolioActionInput() {
  return {
    schema: 'thoughtseed.portfolio-admin-action.v1',
    kind: 'reconcile-work-object',
    portfolioId: 'thoughtseed',
    idempotencyKey: 'route-save-cambium-1',
    rootMapDigest: ROOT_DIGEST,
    sourceDigest: SOURCE_DIGEST,
    subject: { id: 'sapling:cambium', name: 'Cambium' },
    proposal: {
      repositorySourceRef: 'repo:Sheshiyer/cambium',
      repositoryDisposition: 'resolved',
      origin: 'thoughtseed-venture',
      clientFamilyId: '',
      planningAuthority: { kind: 'repository', repositoryId: 'R_cambium', fullName: 'Sheshiyer/cambium' },
      repositoryPlanningReviewed: true,
      githubIssuesReviewed: true,
      legacyEvidenceReviewed: true,
      note: 'Route integration evidence.',
    },
  };
}

function actionStores(events: string[] = []): {
  store: PortfolioAdminActionStoreLike;
  queue: PortfolioAdminActionQueueLike;
} {
  return {
    store: {
      async record() {
        events.push('r2');
        return { duplicate: false, recordedAt: '2026-08-07T09:30:00.000Z' };
      },
    },
    queue: {
      async enqueue() {
        events.push('queue');
        return { duplicate: false };
      },
    },
  };
}

function b64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function signAccessJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: ACCESS_KID, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(accessPrivateKey, 'base64url');
  return `${header}.${body}.${signature}`;
}

function validAccessPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: `https://${TEAM_DOMAIN}`,
    aud: ACCESS_AUD,
    email: 'founder@thoughtseed.space',
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  };
}

function plexusFetch(whoamiStatus = 200, whoamiBody: unknown = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...accessJwk, kid: ACCESS_KID }] }), { status: 200 });
    }
    if (url.includes('/v1/whoami')) {
      return new Response(JSON.stringify(whoamiBody), {
        status: whoamiStatus,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

function deps(
  gate?: GateConfig,
  overrides: Partial<HandlerDeps> = {},
): { value: HandlerDeps; writes: () => number } {
  let writeCount = 0;
  return {
    value: {
      kv: {
        async get() { return null; },
        async list() { return []; },
        async put() { writeCount += 1; },
      },
      gate,
      ...overrides,
    },
    writes: () => writeCount,
  };
}

test('public portfolio route preserves Telegram initData flow, falls back with location.replace, and page routes are GET-only', async () => {
  const fixture = deps();
  const response = await handle(request('GET', '/admin/portfolio'), fixture.value);
  assert.equal(response.status, 200);
  assert.equal(response.body, PORTFOLIO_WORKBENCH_LOADER);
  assert.match(String(response.body), /telegram-web-app\.js/);
  assert.match(String(response.body), /WebApp/);
  assert.match(String(response.body), /x-telegram-init-data/);
  assert.match(String(response.body), /fetch\('\/v1\/admin\/portfolio'/);
  assert.match(String(response.body), /location\.replace\('\/admin\/portfolio\/web'\)/);
  assert.doesNotMatch(String(response.body), /location\.replace\('\/admin\/portfolio'\)/);
  assert.doesNotMatch(String(response.body), /sapling:|client-branch|internal-program|portfolio-workbench\.v[23]/);
  assert.doesNotMatch(String(response.body), /localStorage|sessionStorage|console\./);
  assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
  for (const path of ['/admin/portfolio', '/admin/portfolio/web', '/v1/admin/portfolio']) {
    const denied = await handle(request('POST', path), fixture.value);
    assert.equal(denied.status, 405);
    assert.equal(denied.headers.allow, 'GET');
  }
  const actionRead = await handle(request('GET', '/v1/admin/portfolio/actions'), fixture.value);
  assert.equal(actionRead.status, 405);
  assert.equal(actionRead.headers.allow, 'POST');
  assert.equal(fixture.writes(), 0);
});

test('browser portfolio route requires configured Cloudflare Access before serving any protected bytes', async () => {
  const missing = await handle(request('GET', '/admin/portfolio/web'), deps().value);
  const partial = await handle(
    request('GET', '/admin/portfolio/web'),
    deps(undefined, { plexus: { teamDomain: TEAM_DOMAIN, aud: '' } }).value,
  );

  assert.equal(missing.status, 503);
  assert.equal(partial.status, 503);
  assert.doesNotMatch(String(missing.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(partial.body), PORTFOLIO_BYTES_RE);
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
  assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
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

test('browser portfolio route serves the exact bundle for a canonical founder Cloudflare Access identity', async () => {
  const jwt = signAccessJwt(validAccessPayload());
  const fixture = deps(undefined, {
    plexus: { teamDomain: TEAM_DOMAIN, aud: ACCESS_AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    plexusFetchImpl: plexusFetch(200, {
      ok: true,
      data: {
        email: ' Founder@Thoughtseed.Space ',
        role: 'admin',
        identityId: 'pid_founder',
      },
    }),
  });

  const response = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': jwt }),
    fixture.value,
  );

  assert.equal(response.status, 200);
  assert.equal(response.body, PORTFOLIO_WORKBENCH_HTML);
  assert.notEqual(response.body, PORTFOLIO_WORKBENCH_LOADER);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
  assert.equal(fixture.writes(), 0);
});

test('Cloudflare Access founder action records durable evidence before the governed trigger', async () => {
  const jwt = signAccessJwt(validAccessPayload());
  const events: string[] = [];
  const stores = actionStores(events);
  const fixture = deps(undefined, {
    plexus: { teamDomain: TEAM_DOMAIN, aud: ACCESS_AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    plexusFetchImpl: plexusFetch(200, {
      ok: true,
      data: { email: 'founder@thoughtseed.space', role: 'admin', identityId: 'pid_founder' },
    }),
    portfolioActionStore: stores.store,
    portfolioActionQueue: stores.queue,
    now: () => '2026-08-07T09:30:00.000Z',
  });
  const response = await handle(request(
    'POST',
    '/v1/admin/portfolio/actions',
    { 'cf-access-jwt-assertion': jwt, 'content-type': 'application/json' },
    portfolioActionInput(),
  ), fixture.value);

  assert.equal(response.status, 200);
  const body = JSON.parse(String(response.body));
  assert.equal(body.ok, true);
  assert.equal(body.receipt.status, 'queued');
  assert.equal(body.receipt.nextFlow, 'repository-intake-review');
  assert.deepEqual(events, ['r2', 'queue']);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('Telegram founder can queue an action while missing, non-founder, and unconfigured writers fail closed', async () => {
  const auth = await signedInitData(FOUNDER_ID);
  const gate: GateConfig = {
    botId: BOT_ID,
    pubKeyHex: auth.pubKeyHex,
    founderIds: [FOUNDER_ID],
    now: () => NOW_MS,
  };
  const stores = actionStores();
  const configured = deps(gate, {
    portfolioActionStore: stores.store,
    portfolioActionQueue: stores.queue,
    now: () => '2026-08-07T09:30:00.000Z',
  });
  const accepted = await handle(request(
    'POST',
    '/v1/admin/portfolio/actions',
    { 'x-telegram-init-data': auth.initData, 'content-type': 'application/json' },
    portfolioActionInput(),
  ), configured.value);
  assert.equal(accepted.status, 200);

  const missingIdentity = await handle(request(
    'POST', '/v1/admin/portfolio/actions', { 'content-type': 'application/json' }, portfolioActionInput(),
  ), configured.value);
  assert.equal(missingIdentity.status, 401);

  const missingStores = await handle(request(
    'POST',
    '/v1/admin/portfolio/actions',
    { 'x-telegram-init-data': auth.initData, 'content-type': 'application/json' },
    portfolioActionInput(),
  ), deps(gate).value);
  assert.equal(missingStores.status, 503);
});

test('portfolio action route rejects malformed and oversized input before storage', async () => {
  const jwt = signAccessJwt(validAccessPayload());
  const events: string[] = [];
  const stores = actionStores(events);
  const fixture = deps(undefined, {
    plexus: { teamDomain: TEAM_DOMAIN, aud: ACCESS_AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
    plexusFetchImpl: plexusFetch(200, {
      ok: true,
      data: { email: 'founder@thoughtseed.space', role: 'admin', identityId: 'pid_founder' },
    }),
    portfolioActionStore: stores.store,
    portfolioActionQueue: stores.queue,
  });
  const headers = { 'cf-access-jwt-assertion': jwt, 'content-type': 'application/json' };
  const malformed = await handle(request('POST', '/v1/admin/portfolio/actions', headers, { nope: true }), fixture.value);
  const oversized = await handle({
    method: 'POST',
    path: '/v1/admin/portfolio/actions',
    headers,
    body: JSON.stringify({ value: 'x'.repeat(20_000) }),
  }, fixture.value);
  assert.equal(malformed.status, 400);
  assert.equal(oversized.status, 413);
  assert.deepEqual(events, []);
});

test('browser portfolio route fails closed uniformly for missing, invalid, non-founder, and degraded identities', async () => {
  const basePlexus = { teamDomain: TEAM_DOMAIN, aud: ACCESS_AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' };
  const missing = await handle(
    request('GET', '/admin/portfolio/web'),
    deps(undefined, { plexus: basePlexus, plexusFetchImpl: plexusFetch() }).value,
  );
  const invalid = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': 'not-a-jwt' }),
    deps(undefined, { plexus: basePlexus, plexusFetchImpl: plexusFetch() }).value,
  );
  const malformedJwt = signAccessJwt(validAccessPayload());
  const malformed = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': malformedJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(200, 'not-an-object'),
    }).value,
  );
  const okFalseJwt = signAccessJwt(validAccessPayload());
  const okFalse = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': okFalseJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(200, {
        ok: false,
        data: {
          email: 'founder@thoughtseed.space',
          role: 'admin',
          isActive: true,
          identityId: 'pid_founder_ok_false',
        },
      }),
    }).value,
  );
  const missingDataJwt = signAccessJwt(validAccessPayload());
  const missingData = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': missingDataJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(200, { ok: true }),
    }).value,
  );
  const mismatchJwt = signAccessJwt(validAccessPayload());
  const mismatch = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': mismatchJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(200, {
        ok: true,
        data: {
          email: 'intruder@thoughtseed.space',
          role: 'admin',
          isActive: true,
          identityId: 'pid_intruder',
        },
      }),
    }).value,
  );
  const employeeJwt = signAccessJwt(validAccessPayload({ email: 'employee@thoughtseed.space' }));
  const nonFounder = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': employeeJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(200, {
        ok: true,
        data: {
          email: 'employee@thoughtseed.space',
          role: 'employee',
          identityId: 'pid_employee',
        },
      }),
    }).value,
  );
  const degradedJwt = signAccessJwt(validAccessPayload({ email: 'degraded@thoughtseed.space' }));
  const degraded = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': degradedJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(500, { error: 'degraded' }),
    }).value,
  );
  const inactiveJwt = signAccessJwt(validAccessPayload({ email: 'inactive@thoughtseed.space' }));
  const inactive = await handle(
    request('GET', '/admin/portfolio/web', { 'cf-access-jwt-assertion': inactiveJwt }),
    deps(undefined, {
      plexus: basePlexus,
      plexusFetchImpl: plexusFetch(200, {
        ok: true,
        data: {
          email: 'inactive@thoughtseed.space',
          role: 'admin',
          isActive: false,
          identityId: 'pid_inactive_admin',
        },
      }),
    }).value,
  );

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, missing.status);
  assert.equal(malformed.status, missing.status);
  assert.equal(okFalse.status, missing.status);
  assert.equal(missingData.status, missing.status);
  assert.equal(mismatch.status, missing.status);
  assert.equal(nonFounder.status, missing.status);
  assert.equal(degraded.status, missing.status);
  assert.equal(inactive.status, missing.status);
  assert.equal(invalid.body, missing.body);
  assert.equal(malformed.body, missing.body);
  assert.equal(okFalse.body, missing.body);
  assert.equal(missingData.body, missing.body);
  assert.equal(mismatch.body, missing.body);
  assert.equal(nonFounder.body, missing.body);
  assert.equal(degraded.body, missing.body);
  assert.equal(inactive.body, missing.body);
  assert.deepEqual(invalid.headers, missing.headers);
  assert.deepEqual(malformed.headers, missing.headers);
  assert.deepEqual(okFalse.headers, missing.headers);
  assert.deepEqual(missingData.headers, missing.headers);
  assert.deepEqual(mismatch.headers, missing.headers);
  assert.deepEqual(nonFounder.headers, missing.headers);
  assert.deepEqual(degraded.headers, missing.headers);
  assert.deepEqual(inactive.headers, missing.headers);
  assert.doesNotMatch(String(missing.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(invalid.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(malformed.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(okFalse.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(missingData.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(mismatch.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(nonFounder.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(degraded.body), PORTFOLIO_BYTES_RE);
  assert.doesNotMatch(String(inactive.body), PORTFOLIO_BYTES_RE);
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
