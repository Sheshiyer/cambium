import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCortexFetch } from './mcp-http.ts';

test('Hermes legacy alias and OAuth resource never exchange credentials or identity', async () => {
  let verifierCalls = 0;
  let toolCalls = 0;
  const env = {
    MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: 'https://cortex.example/mcp',
    MCP_AUTHORIZATION_SERVER: 'https://forge.example', MCP_REQUIRED_SCOPES: 'cortex:read',
    CONTEXT_ROUTE_TOKEN: 'legacy-key', MCP_LEGACY_PATH: '/v1/mcp' as const,
    MCP_TOKEN_VERIFIER: { async fetch(input: Request | string, init?: RequestInit) {
      verifierCalls++;
      const request = input instanceof Request ? input : new Request(input, init);
      return Response.json(request.headers.get('authorization') === 'Bearer user-token'
        ? { active: true, iss: 'https://forge.example', aud: 'https://cortex.example/mcp', exp: 4102444800, scope: 'cortex:read', sub: 'founder', tenants: ['cambium'] }
        : { active: false });
    } },
  };
  const deps = { legacyTools: async () => [{ name: 'probe_read' }], callTool: async () => { toolCalls++; return { ok: true }; } };
  const call = (path: string, token: string, overrides = {}) => handleCortexFetch(new Request('https://cortex.example' + path, {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'probe_read', arguments: {} } }),
  }), { ...env, ...overrides }, deps);
  assert.equal((await call('/v1/mcp', 'legacy-key')).status, 200);
  assert.equal(verifierCalls, 0);
  assert.equal(toolCalls, 1);
  assert.equal((await call('/v1/mcp', 'user-token')).status, 401);
  const rejected = await call('/mcp', 'legacy-key');
  assert.equal((await rejected.json()).result.isError, true);
  assert.match(rejected.headers.get('www-authenticate') || '', /Bearer/);
  assert.equal(toolCalls, 1);
  assert.equal((await call('/mcp', 'user-token')).status, 200);
  assert.equal(toolCalls, 2);
  assert.equal((await call('/v1/mcp/', 'legacy-key')).status, 404);
  assert.equal((await call('/v1/mcp', 'legacy-key', { MCP_LEGACY_PATH: undefined })).status, 404);
  assert.equal((await call('/v1/mcp', 'legacy-key', { MCP_TOKEN_VERIFIER: undefined })).status, 503);
  assert.equal((await call('/v1/mcp', 'legacy-key', { CONTEXT_ROUTE_TOKEN: undefined })).status, 503);
});
