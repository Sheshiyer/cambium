#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const EXACT_ENDPOINT = 'https://cortex.thoughtseed.space/mcp'
const DEFAULT_TIMEOUT_MS = 10_000
const STREAMABLE_ACCEPT = 'application/json, text/event-stream'
const REQUIRED_TOOLS = [
  'get_connected_profile',
  'read_infinite_game_node',
  'compile_action_intent',
  'request_action_approval',
  'get_action_approval_status',
  'execute_approved_action',
]

function assertEndpoint(endpoint) {
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('endpoint must be an absolute HTTPS URL')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('endpoint must be HTTPS without credentials, query, or fragment')
  }
  if (url.href !== EXACT_ENDPOINT) {
    throw new Error(`endpoint must be exactly ${EXACT_ENDPOINT}`)
  }
  return url
}

async function fetchBounded(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function readJsonBounded(response, maxBytes = 128 * 1024) {
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new Error('response exceeded readiness-probe byte limit')
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function rpcBody(id, method, params = {}) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params })
}

function safeToolNames(payload) {
  const tools = payload?.result?.tools
  if (!Array.isArray(tools)) return []
  return [...new Set(tools
    .map((tool) => typeof tool?.name === 'string' ? tool.name : '')
    .filter((name) => /^[a-z][a-z0-9_]{0,127}$/.test(name)))]
    .sort()
    .slice(0, 64)
}

export async function probeOpenAiMcpReadiness({
  endpoint = EXACT_ENDPOINT,
  expectedVersion,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const endpointUrl = assertEndpoint(endpoint)
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required')
  if (typeof expectedVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
    throw new Error('expectedVersion must be strict semver')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error('timeoutMs must be an integer from 100 through 30000')
  }

  const origin = endpointUrl.origin
  const metadataUrl = `${origin}/.well-known/oauth-protected-resource${endpointUrl.pathname}`
  const probes = {}
  const heldReasons = []

  const health = await fetchBounded(fetchImpl, `${origin}/health`, { method: 'GET' }, timeoutMs)
  probes.health = { status: health.status, ready: health.status === 200 }
  if (!probes.health.ready) heldReasons.push('health_not_ready')

  const postOnly = await fetchBounded(fetchImpl, endpoint, { method: 'GET' }, timeoutMs)
  probes.post_only = {
    status: postOnly.status,
    allowPost: (postOnly.headers.get('allow') || '').split(',').map((v) => v.trim().toUpperCase()).includes('POST'),
  }
  probes.post_only.ready = probes.post_only.status === 405 && probes.post_only.allowPost
  if (!probes.post_only.ready) heldReasons.push('streamable_http_post_contract_missing')

  const metadataResponse = await fetchBounded(fetchImpl, metadataUrl, { method: 'GET' }, timeoutMs)
  const metadata = await readJsonBounded(metadataResponse)
  const authorizationServers = Array.isArray(metadata?.authorization_servers)
    ? metadata.authorization_servers.filter((value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      } catch {
        return false
      }
    })
    : []
  const scopes = Array.isArray(metadata?.scopes_supported)
    ? metadata.scopes_supported.filter((scope) => typeof scope === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(scope)).sort()
    : []
  probes.oauth_metadata = {
    status: metadataResponse.status,
    resourceMatches: metadata?.resource === endpoint,
    authorizationServerCount: authorizationServers.length,
    scopes,
  }
  probes.oauth_metadata.ready = metadataResponse.status === 200
    && probes.oauth_metadata.resourceMatches
    && authorizationServers.length === 1
    && scopes.includes('cortex:read')
    && scopes.includes('cambium:act')
  if (!probes.oauth_metadata.ready) heldReasons.push('oauth_protected_resource_metadata_missing_or_incomplete')

  const rpcHeaders = { 'content-type': 'application/json', accept: STREAMABLE_ACCEPT }
  const initializeResponse = await fetchBounded(fetchImpl, endpoint, {
    method: 'POST',
    headers: rpcHeaders,
    body: rpcBody(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'cambium-openai-readiness', version: '1.0.0' },
    }),
  }, timeoutMs)
  const initialize = await readJsonBounded(initializeResponse)
  probes.initialize = {
    status: initializeResponse.status,
    protocolVersion: initialize?.result?.protocolVersion,
    serverName: initialize?.result?.serverInfo?.name,
    serverVersion: initialize?.result?.serverInfo?.version,
  }
  probes.initialize.ready = initializeResponse.status === 200
    && probes.initialize.protocolVersion === '2025-06-18'
    && probes.initialize.serverName === 'cortex-mcp'
    && probes.initialize.serverVersion === expectedVersion
  if (!probes.initialize.ready) heldReasons.push('public_mcp_initialize_not_ready')

  const toolsResponse = await fetchBounded(fetchImpl, endpoint, {
    method: 'POST',
    headers: rpcHeaders,
    body: rpcBody(2, 'tools/list'),
  }, timeoutMs)
  const toolsPayload = await readJsonBounded(toolsResponse)
  const toolNames = safeToolNames(toolsPayload)
  const missingTools = REQUIRED_TOOLS.filter((name) => !toolNames.includes(name))
  probes.tools_list = {
    status: toolsResponse.status,
    toolCount: toolNames.length,
    toolNames,
    missingRequiredTools: missingTools,
  }
  probes.tools_list.ready = toolsResponse.status === 200 && missingTools.length === 0
  if (!probes.tools_list.ready) heldReasons.push('public_tool_discovery_not_ready')

  return {
    schema: 'cambium.openai-mcp-readiness.v1',
    endpoint,
    status: heldReasons.length === 0 ? 'ready' : 'held',
    expectedVersion,
    probes,
    heldReasons,
    credentialsSent: false,
    toolCallsPerformed: false,
    externalMutation: false,
  }
}

function parseArgs(argv) {
  let endpoint = EXACT_ENDPOINT
  let timeoutMs = DEFAULT_TIMEOUT_MS
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--endpoint') endpoint = argv[++i]
    else if (argv[i] === '--timeout-ms') timeoutMs = Number(argv[++i])
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  return { endpoint, timeoutMs }
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const plugin = JSON.parse(readFileSync(resolve(here, '..', 'openai', 'cambium-infinite-game', 'plugin.json'), 'utf8'))
  const args = parseArgs(process.argv.slice(2))
  const result = await probeOpenAiMcpReadiness({ ...args, expectedVersion: plugin.version })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.status === 'ready' ? 0 : 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ schema: 'cambium.openai-mcp-readiness.error.v1', error: error.message })}\n`)
    process.exitCode = 1
  })
}
