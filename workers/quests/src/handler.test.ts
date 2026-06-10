// cambium-quests · pure handler tests (node:test, like everything beside it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, ALLOWED_TENANTS } from './handler.ts';
import type { KvLike, SimpleRequest } from './handler.ts';
import { PAGE } from './page.ts';

function fakeKv(): KvLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(k) { return store.get(k) ?? null; },
    async put(k, v) { store.set(k, v); },
    async list(prefix) { return [...store.keys()].filter((k) => k.startsWith(prefix)); },
  };
}

const req = (method: string, path: string, extra: Partial<SimpleRequest> = {}): SimpleRequest =>
  ({ method, path, headers: {}, ...extra });

const ENVELOPE = JSON.stringify({
  schema: 1, derivedAt: '2026-06-10T18:00:00Z', source: 'push', tenant: 'cambium',
  ledger: { completed: 6, total: 7, current: { arc: 'VII', title: 'Many Gardens' }, rows: [] },
});

test('healthz · ok', async () => {
  const r = await handle(req('GET', '/healthz'), { kv: fakeKv() });
  assert.equal(r.status, 200);
  assert.match(r.body, /cambium-quests/);
});

test('quests · tenant gate locks non-cambium until M3', async () => {
  assert.deepEqual(ALLOWED_TENANTS, ['cambium']);
  const r = await handle(req('GET', '/api/quests/thoughtseed'), { kv: fakeKv() });
  assert.equal(r.status, 403);
  assert.match(r.body, /M3 isolation suite/);
});

test('quests · 404 with push hint before any ledger exists', async () => {
  const r = await handle(req('GET', '/api/quests/cambium'), { kv: fakeKv() });
  assert.equal(r.status, 404);
  assert.match(r.body, /quine write quests push/);
});

test('push · requires configured token', async () => {
  const r = await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE }), { kv: fakeKv() });
  assert.equal(r.status, 503);
});

test('push · rejects bad bearer', async () => {
  const r = await handle(
    req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer wrong' } }),
    { kv: fakeKv(), pushToken: 'right' },
  );
  assert.equal(r.status, 401);
});

test('push · validates envelope fields', async () => {
  const r = await handle(
    req('POST', '/internal/ledger/cambium', { body: '{"schema":1}', headers: { authorization: 'Bearer t' } }),
    { kv: fakeKv(), pushToken: 't' },
  );
  assert.equal(r.status, 400);
  assert.match(r.body, /missing/);
});

test('push then get · round-trips the envelope verbatim', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  assert.match(put.body, /"derivedAt":"2026-06-10T18:00:00Z"/);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  assert.equal(get.body, ENVELOPE);
  assert.equal(get.headers['cache-control'], 'no-store');
});

test('push · tenant mismatch in envelope rejected', async () => {
  const bad = ENVELOPE.replace('"tenant":"cambium"', '"tenant":"other"');
  const r = await handle(
    req('POST', '/internal/ledger/cambium', { body: bad, headers: { authorization: 'Bearer t' } }),
    { kv: fakeKv(), pushToken: 't' },
  );
  assert.equal(r.status, 400);
});

test('page · serves the Living Blueprint shell at /', async () => {
  const r = await handle(req('GET', '/'), { kv: fakeKv() });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.match(PAGE, /#00272B/);
  assert.match(PAGE, /#E0FF4F/);
  assert.match(PAGE, /no fake progress/);
  assert.match(PAGE, /telegram-web-app\.js/);
});

test('page · three scenes with tab bar and sliding indicator', () => {
  for (const m of ['>Quests<', '>Fractal<', '>Story<', 'class="ind"', 'translateX']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
});

test('page · interaction layer: sheet, haptics, tappable rings', () => {
  assert.match(PAGE, /class="sheet"/);
  assert.match(PAGE, /HapticFeedback/);
  assert.match(PAGE, /openSheet/);
  assert.match(PAGE, /renderFractal/);
  assert.match(PAGE, /cambium — you are here/);
});

test('page · craft: skeleton, states, reduced motion, no pure black, no emoji icons', () => {
  assert.match(PAGE, /class="skel"/);
  assert.match(PAGE, /ledger unreachable/);
  assert.match(PAGE, /no ledger yet/);
  assert.match(PAGE, /prefers-reduced-motion/);
  assert.ok(!PAGE.includes('#000000'), 'no pure black');
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(PAGE), 'no emoji glyphs');
});

test('page · taste-brief lushness markers present (W2.5)', () => {
  for (const m of ['feTurbulence', 'radialGradient id="heart"', 'url(#edge)', 'class="orbit"', 'blob a', 'class="grain"', '#beats::before']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
});

test('page · animations ride transform and opacity only', () => {
  // keyframes must not animate layout properties
  const keyframeBodies = PAGE.match(/@keyframes[\s\S]*?\}\s*\}/g) ?? [];
  for (const k of keyframeBodies) {
    assert.ok(!/\b(top|left|width|height|margin)\s*:/.test(k), `layout prop animated in ${k.slice(0, 40)}`);
  }
  assert.ok(keyframeBodies.length >= 3, 'has the motion set');
});


// ── W4 · the founder gate (Ed25519 third-party validation) ──────────────

import { webcrypto } from 'node:crypto';
import { buildDataCheckString, validateInitData } from './handler.ts';
import type { GateConfig } from './handler.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;

async function makeSignedInitData(opts: {
  botId: string; userId: string; authDate: number; tamper?: boolean;
}): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams();
  fields.set('auth_date', String(opts.authDate));
  fields.set('user', JSON.stringify({ id: Number(opts.userId), first_name: 'Founder' }));
  fields.set('query_id', 'AAtest');
  const { dcs } = buildDataCheckString(fields.toString(), opts.botId);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(
    opts.tamper ? dcs + 'tampered' : dcs,
  )));
  const b64url = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  fields.set('signature', b64url);
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

const NOW = 1_750_000_000_000;
const gateCfg = (pubKeyHex: string): GateConfig => ({
  botId: '1571615655', pubKeyHex, founderIds: ['1371522080', '926168615'], now: () => NOW,
});

test('gate · valid founder signature passes and identifies the founder', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '1371522080', authDate: NOW / 1000 - 30 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.deepEqual(verdict, { ok: true, userId: '1371522080' });
});

test('gate · tampered payload is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '1371522080', authDate: NOW / 1000 - 30, tamper: true });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /bad signature/);
});

test('gate · stale auth_date is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '1371522080', authDate: NOW / 1000 - 4000 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /stale/);
});

test('gate · non-founder with a valid signature is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '555', authDate: NOW / 1000 - 30 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /not a founder/);
});

test('gate · queue → list → consume roundtrip over the worker routes', async () => {
  const kv = fakeKv();
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '926168615', authDate: NOW / 1000 - 10 });
  const deps = { kv, pushToken: 't', gate: gateCfg(pubKeyHex), uuid: () => 'fixed-uuid' };

  const queued = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({ kind: 'approve', subject: 'THO-9', note: 'ship it', initData }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.match(queued.body, /fixed-uuid/);

  const unauth = await handle(req('GET', '/internal/gate/cambium'), deps);
  assert.equal(unauth.status, 401);

  const listed = await handle(req('GET', '/internal/gate/cambium', { headers: { authorization: 'Bearer t' } }), deps);
  assert.equal(listed.status, 200);
  const actions = JSON.parse(listed.body).actions;
  assert.equal(actions.length, 1);
  assert.equal(actions[0].founderId, '926168615');
  assert.equal(actions[0].kind, 'approve');

  const consumed = await handle(req('POST', '/internal/gate/cambium/consume', {
    headers: { authorization: 'Bearer t' }, body: JSON.stringify({ id: 'fixed-uuid', result: 'done' }),
  }), deps);
  assert.equal(consumed.status, 200);

  const relisted = await handle(req('GET', '/internal/gate/cambium', { headers: { authorization: 'Bearer t' } }), deps);
  assert.equal(JSON.parse(relisted.body).actions.length, 0, 'consumed actions leave the queue');
});

test('gate · missing initData (outside Telegram) is a clean 401', async () => {
  const kv = fakeKv();
  const { pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '926168615', authDate: NOW / 1000 });
  const r = await handle(req('POST', '/api/gate/cambium', { body: JSON.stringify({ kind: 'approve', subject: 'x' }) }),
    { kv, pushToken: 't', gate: gateCfg(pubKeyHex) });
  assert.equal(r.status, 401);
  assert.match(r.body, /inside Telegram/);
});
