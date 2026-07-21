import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY_STORAGE_KEY,
  clearIdentity,
  founderIdentity,
  identityToPrincipalHeader,
  loadIdentity,
  roleBadge,
  saveIdentity,
  type Identity,
  type IdentityStorage,
} from './identity-model.ts';

function fakeStorage(initial: Record<string, string> = {}): IdentityStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

test('round-trip persists and reloads identity', () => {
  const storage = fakeStorage();
  const identity: Identity = {
    principal: {
      id: 'shesh',
      tenant: 'demo-org',
      role: 'consultant',
      allow: ['map', 'sheets'],
      createdBy: 'founder',
      expiresAt: '2026-08-01T00:00:00Z',
    },
    via: 'invite',
  };
  saveIdentity(identity, storage);
  assert.ok(storage.data[IDENTITY_STORAGE_KEY]);
  assert.deepEqual(loadIdentity(storage), identity);
});

test('corrupt JSON returns null', () => {
  const storage = fakeStorage({ [IDENTITY_STORAGE_KEY]: '{nope' });
  assert.equal(loadIdentity(storage), null);
});

test('invalid shape returns null', () => {
  const storage = fakeStorage({
    [IDENTITY_STORAGE_KEY]: JSON.stringify({ principal: { id: 'x', role: 'overlord', allow: 'all' }, via: 'magic' }),
  });
  assert.equal(loadIdentity(storage), null);
});

test('clearIdentity removes the stored key', () => {
  const identity = founderIdentity('demo-org');
  const storage = fakeStorage();
  saveIdentity(identity, storage);
  clearIdentity(storage);
  assert.equal(loadIdentity(storage), null);
});

test('founderIdentity shape is founder scoped to tenant', () => {
  const identity = founderIdentity('acme');
  assert.equal(identity.via, 'local-founder');
  assert.equal(identity.principal.role, 'founder');
  assert.equal(identity.principal.tenant, 'acme');
  assert.deepEqual(identity.principal.allow, ['*']);
  assert.equal(identity.principal.expiresAt, undefined);
});

test('roleBadge labels match role', () => {
  assert.deepEqual(roleBadge(founderIdentity('acme')), { label: 'FOUNDER · LOCAL', tone: 'signal' });
  const team: Identity = { principal: { id: 't', tenant: 'acme', role: 'team', allow: ['*'], createdBy: 'founder' }, via: 'invite' };
  assert.equal(roleBadge(team).label, 'TEAM');
  const consultant: Identity = { principal: { id: 'c', tenant: 'acme', role: 'consultant', allow: ['map'], createdBy: 'founder' }, via: 'invite' };
  assert.equal(roleBadge(consultant).label, 'CONSULTANT · SCOPED');
});

test('principal header JSON parses back to the principal', () => {
  const identity = founderIdentity('demo-org');
  const parsed = JSON.parse(identityToPrincipalHeader(identity));
  assert.deepEqual(parsed, identity.principal);
});

test('missing storage is a no-op, never throws', () => {
  assert.equal(loadIdentity(), null);
  saveIdentity(founderIdentity('demo-org'));
  clearIdentity();
});
