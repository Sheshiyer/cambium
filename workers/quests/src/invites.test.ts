import test from 'node:test';
import assert from 'node:assert/strict';
import { createInvite, verifyInvite, makeInviteStore, revokeInvite } from './invites.ts';

const SECRET = 'test-secret-do-not-ship';
const NOW = new Date('2026-07-21T00:00:00.000Z');

function invite(overrides: Partial<Parameters<typeof createInvite>[0]> = {}) {
  return createInvite({
    tenant: 'demo-org',
    allow: ['tapestry', 'wake'],
    createdBy: 'founder-1',
    ttlMs: 60_000,
    now: NOW,
    secret: SECRET,
    ...overrides,
  });
}

test('create/verify round-trip returns consultant principal', () => {
  const { token, principal } = invite();
  assert.equal(principal.role, 'consultant');
  const result = verifyInvite(token, SECRET, NOW);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.principal.id, principal.id);
    assert.equal(result.principal.tenant, 'demo-org');
    assert.deepEqual(result.principal.allow, ['tapestry', 'wake']);
    assert.equal(result.principal.createdBy, 'founder-1');
  }
});

test('tampered payload is rejected with bad-signature', () => {
  const { token } = invite();
  const [payload, sig] = token.split('.');
  const forged = `${Buffer.from(JSON.stringify({ id: 'x', tenant: 'demo-org', allow: [], createdBy: 'evil', exp: Date.now() + 1e9, role: 'founder' })).toString('base64url')}.${sig}`;
  const result = verifyInvite(forged, SECRET, NOW);
  assert.deepEqual(result, { ok: false, reason: 'bad-signature' });
  assert.ok(payload);
});

test('wrong secret is rejected', () => {
  const { token } = invite();
  const result = verifyInvite(token, 'other-secret', NOW);
  assert.deepEqual(result, { ok: false, reason: 'bad-signature' });
});

test('expired token rejected; equal-to-now still valid', () => {
  const { token } = invite({ ttlMs: 60_000 });
  const after = new Date(NOW.getTime() + 60_001);
  assert.deepEqual(verifyInvite(token, SECRET, after), { ok: false, reason: 'expired' });
  const exact = new Date(NOW.getTime() + 60_000);
  assert.ok(verifyInvite(token, SECRET, exact).ok);
});

test('malformed tokens rejected', () => {
  assert.deepEqual(verifyInvite('nope', SECRET, NOW), { ok: false, reason: 'malformed' });
  assert.deepEqual(verifyInvite('.sig', SECRET, NOW), { ok: false, reason: 'malformed' });
  assert.deepEqual(verifyInvite('payload.', SECRET, NOW), { ok: false, reason: 'malformed' });
  const badJson = `${Buffer.from('not json').toString('base64url')}.${'x'}`;
  assert.equal(verifyInvite(badJson, SECRET, NOW).ok, false);
});

test('revoked token is flagged by the store', () => {
  const store = makeInviteStore();
  const { token } = invite();
  store.issue(token);
  assert.equal(store.isRevoked(token), false);
  revokeInvite(token, store);
  assert.equal(store.isRevoked(token), true);
});

test('store survives many issues without accidental revocation', () => {
  const store = makeInviteStore();
  const tokens = Array.from({ length: 50 }, () => invite().token);
  for (const t of tokens) store.issue(t);
  for (const t of tokens) assert.equal(store.isRevoked(t), false);
  revokeInvite(tokens[25]!, store);
  assert.equal(store.isRevoked(tokens[25]!), true);
  assert.equal(store.isRevoked(tokens[24]!), false);
});

test('principal from invite is always consultant even if claims say otherwise', () => {
  const { token } = invite();
  const result = verifyInvite(token, SECRET, NOW);
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.principal.role, 'consultant');
});
