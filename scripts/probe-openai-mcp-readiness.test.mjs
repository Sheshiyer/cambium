import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { probeOpenAiMcpReadiness } from './probe-openai-mcp-readiness.mjs'

const ENDPOINT = 'https://cortex.thoughtseed.space/mcp'
const TOOL_NAMES = [
  'get_connected_profile', 'read_infinite_game_node', 'compile_action_intent',
  'request_action_approval', 'get_action_approval_status', 'execute_approved_action',
]

function readyServer(version) {
  const methods = []
  return {
    methods,
    async fetchImpl(url, init = {}) {
      const path = new URL(url).pathname
      if (path === '/health') return Response.json({ ok: true })
      if (path.startsWith('/.well-known/')) return Response.json({
        resource: ENDPOINT,
        authorization_servers: ['https://identity.example.com'],
        scopes_supported: ['cortex:read', 'cambium:act'],
      })
      if (!init.body) return new Response(null, { status: 405, headers: { allow: 'POST' } })
      const body = JSON.parse(init.body)
      methods.push(body.method)
      assert.ok(['initialize', 'tools/list'].includes(body.method))
      const result = body.method === 'initialize'
        ? { protocolVersion: '2025-06-18', serverInfo: { name: 'cortex-mcp', version } }
        : { tools: TOOL_NAMES.map(name => ({ name })) }
      return Response.json({ jsonrpc: '2.0', id: body.id, result })
    },
  }
}

test('the reviewed server version controls readiness independently of a plugin release version', async () => {
  const server = readyServer('1.7.0')
  const result = await probeOpenAiMcpReadiness({ expectedVersion: '1.7.0', fetchImpl: server.fetchImpl })
  assert.equal(result.status, 'ready')
  assert.equal(result.expectedVersion, '1.7.0')
  assert.equal(result.probes.initialize.serverVersion, '1.7.0')
  assert.deepEqual(server.methods, ['initialize', 'tools/list'])
  assert.equal(result.credentialsSent, false)
  assert.equal(result.toolCallsPerformed, false)
  assert.equal(result.externalMutation, false)

  const wrongVersion = await probeOpenAiMcpReadiness({ expectedVersion: '1.9.0', fetchImpl: server.fetchImpl })
  assert.equal(wrongVersion.status, 'held')
  assert.deepEqual(wrongVersion.heldReasons, ['public_mcp_initialize_not_ready'])
})

test('CLI requires an explicit reviewed server version before any live probe', () => {
  const script = fileURLToPath(new URL('./probe-openai-mcp-readiness.mjs', import.meta.url))
  for (const args of [[], ['--expected-server-version']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 5_000 })
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(JSON.parse(result.stderr).error, /--expected-server-version is required/)
  }
})
