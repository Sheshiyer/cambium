import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlexusNativeIdentityAuthority,
  PLEXUS_NATIVE_IDENTITY_CONTRACT,
} from './plexus-native-identity.ts';

const config = {
  url: 'https://teamforge.example/v1/native/identity',
  token: 'dedicated-token',
  tenantId: 'cambium',
};

test('native identity authority stays unbound without exact owner bindings', () => {
  assert.equal(createPlexusNativeIdentityAuthority(undefined), undefined);
  assert.equal(createPlexusNativeIdentityAuthority({ ...config, url: 'http://teamforge.example/identity' }), undefined);
  assert.equal(createPlexusNativeIdentityAuthority({ ...config, tenantId: 'CAMBIUM' }), undefined);
});

test('native identity authority consumes the scoped TeamForge contract', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const authority = createPlexusNativeIdentityAuthority({
    ...config,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true, data: {
        contractVersion: PLEXUS_NATIVE_IDENTITY_CONTRACT,
        identityId: 'pid_admin_thoughtseed_labs',
        tenantId: 'cambium',
        workspaceId: 'ws_thoughtseed',
        role: 'admin',
        active: true,
        enrolled: true,
      } }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  })!;

  assert.equal(await authority.currentRole('pid_admin_thoughtseed_labs'), 'founder');
  assert.deepEqual(await authority.enrolledTenants('pid_admin_thoughtseed_labs'), ['cambium']);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /\/pid_admin_thoughtseed_labs\?tenant_id=cambium$/);
  assert.equal((requests[0].init?.headers as Record<string, string>).authorization, 'Bearer dedicated-token');
  assert.equal((requests[0].init?.headers as Record<string, string>)['cache-control'], 'no-store');
});

test('missing identities floor to no role and no enrollment', async () => {
  const authority = createPlexusNativeIdentityAuthority({
    ...config,
    fetchImpl: async () => new Response('', { status: 404 }),
  })!;
  assert.equal(await authority.currentRole('pid_missing'), null);
  assert.deepEqual(await authority.enrolledTenants('pid_missing'), []);
});

test('degraded or malformed upstream responses are unavailable, not founder', async () => {
  const degraded = createPlexusNativeIdentityAuthority({
    ...config,
    fetchImpl: async () => new Response('', { status: 503 }),
  })!;
  await assert.rejects(() => degraded.currentRole('pid_admin_thoughtseed_labs'), /unavailable/);

  const malformed = createPlexusNativeIdentityAuthority({
    ...config,
    fetchImpl: async () => new Response(JSON.stringify({ ok: true, data: { role: 'admin' } }), { status: 200 }),
  })!;
  await assert.rejects(() => malformed.currentRole('pid_admin_thoughtseed_labs'), /invalid_response/);
});
