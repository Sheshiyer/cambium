import test from 'node:test'
import assert from 'node:assert/strict'

import { probeOpenAiMcpReadiness } from '../../scripts/probe-openai-mcp-readiness.mjs'

const ENDPOINT = 'https://cortex.thoughtseed.space/mcp'
const TOOLS = [
  'get_connected_profile',
  'read_infinite_game_node',
  'compile_action_intent',
  'request_action_approval',
  'get_action_approval_status',
  'execute_approved_action',
]

function json(value, init = {}) {
  return Response.json(value, init)
}

function readyFetch(calls) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers, body: init.body })
    if (url === 'https://cortex.thoughtseed.space/health') return json({ ok: true })
    if (url === ENDPOINT && init.method === 'GET') {
      return new Response('POST only', { status: 405, headers: { allow: 'POST' } })
    }
    if (url === 'https://cortex.thoughtseed.space/.well-known/oauth-protected-resource/mcp') {
      return json({
        resource: ENDPOINT,
        authorization_servers: ['https://identity.thoughtseed.space'],
        scopes_supported: ['cambium:act', 'cortex:read'],
        bearer_methods_supported: ['header'],
      })
    }
    const body = JSON.parse(init.body)
    if (body.method === 'initialize') {
      return json({ jsonrpc: '2.0', id: body.id, result: {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'cortex-mcp', version: '1.7.0' },
        capabilities: { tools: {} },
      } })
    }
    if (body.method === 'tools/list') {
      return json({ jsonrpc: '2.0', id: body.id, result: { tools: TOOLS.map((name) => ({ name })) } })
    }
    throw new Error(`unexpected request ${url}`)
  }
}

test('readiness probe passes only the exact public OAuth and MCP discovery contract', async () => {
  const calls = []
  const result = await probeOpenAiMcpReadiness({
    expectedVersion: '1.7.0',
    fetchImpl: readyFetch(calls),
  })
  assert.equal(result.status, 'ready')
  assert.deepEqual(result.heldReasons, [])
  assert.equal(result.credentialsSent, false)
  assert.equal(result.toolCallsPerformed, false)
  assert.equal(result.externalMutation, false)
  assert.equal(calls.length, 5)
  for (const call of calls) {
    assert.equal(call.headers?.authorization, undefined)
    if (call.body) {
      assert.doesNotMatch(call.body, /tools\/call/)
      assert.doesNotMatch(call.body, /token|secret|credential/i)
    }
  }
})

test('legacy bearer deployment remains held without reflecting response bodies', async () => {
  const result = await probeOpenAiMcpReadiness({
    expectedVersion: '1.7.0',
    fetchImpl: async (url, init = {}) => {
      if (url.endsWith('/health')) return json({ ok: true })
      if (url === ENDPOINT && init.method === 'GET') {
        return new Response('POST only', { status: 405, headers: { allow: 'POST' } })
      }
      if (url.includes('/.well-known/')) return new Response('private marker SECRET_SENTINEL', { status: 404 })
      return json({ error: 'private marker SECRET_SENTINEL' }, { status: 401 })
    },
  })
  assert.equal(result.status, 'held')
  assert.deepEqual(result.heldReasons, [
    'oauth_protected_resource_metadata_missing_or_incomplete',
    'public_mcp_initialize_not_ready',
    'public_tool_discovery_not_ready',
  ])
  assert.doesNotMatch(JSON.stringify(result), /SECRET_SENTINEL/)
})

test('readiness probe rejects endpoint substitution before network access', async () => {
  for (const endpoint of [
    'http://cortex.thoughtseed.space/mcp',
    'https://user:pass@cortex.thoughtseed.space/mcp',
    'https://cortex.thoughtseed.space/mcp?token=x',
    'https://cortex.thoughtseed.space/mcp#fragment',
    'https://other.example.com/mcp',
  ]) {
    let calls = 0
    await assert.rejects(
      probeOpenAiMcpReadiness({
        endpoint,
        expectedVersion: '1.7.0',
        fetchImpl: async () => { calls += 1; return json({}) },
      }),
      /endpoint/,
    )
    assert.equal(calls, 0)
  }
})

test('readiness probe rejects version and timeout ambiguity before network access', async () => {
  for (const options of [
    { expectedVersion: 'latest' },
    { expectedVersion: '1.7.0', timeoutMs: 99 },
    { expectedVersion: '1.7.0', timeoutMs: 30_001 },
  ]) {
    let calls = 0
    await assert.rejects(
      probeOpenAiMcpReadiness({ ...options, fetchImpl: async () => { calls += 1; return json({}) } }),
    )
    assert.equal(calls, 0)
  }
})

test('tool discovery requires every Cambium read and governed-action tool', async () => {
  const fetchImpl = readyFetch([])
  const result = await probeOpenAiMcpReadiness({
    expectedVersion: '1.7.0',
    fetchImpl: async (url, init) => {
      const response = await fetchImpl(url, init)
      if (url === ENDPOINT && init?.method === 'POST') {
        const body = JSON.parse(init.body)
        if (body.method === 'tools/list') {
          return json({ jsonrpc: '2.0', id: body.id, result: { tools: TOOLS.slice(0, -1).map((name) => ({ name })) } })
        }
      }
      return response
    },
  })
  assert.equal(result.status, 'held')
  assert.deepEqual(result.probes.tools_list.missingRequiredTools, ['execute_approved_action'])
})
