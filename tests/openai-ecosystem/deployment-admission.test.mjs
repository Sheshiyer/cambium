import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  configurationDigest,
  defaultManifestPath,
  defaultPolicyPath,
  reviewedRuntimeDigest,
  validatePolicy,
  validateSnapshot,
} from '../../scripts/check-openai-mcp-deployment-admission.mjs'

const policy = JSON.parse(readFileSync(defaultPolicyPath, 'utf8'))
const manifest = JSON.parse(readFileSync(defaultManifestPath, 'utf8'))
const runtimeDigest = reviewedRuntimeDigest(manifest)
const digest = (char) => `sha256:${char.repeat(64)}`

function validSnapshot() {
  return {
    schema: 'cambium.openai-mcp-deployment-snapshot.v1',
    scriptName: 'cortex-mcp',
    endpoint: 'https://cortex.thoughtseed.space/mcp',
    vars: {
      MCP_AUTH_MODE: 'oauth',
      MCP_RESOURCE_URL: 'https://cortex.thoughtseed.space/mcp',
      MCP_AUTHORIZATION_SERVER: 'https://identity.example.test',
      MCP_REQUIRED_SCOPES: 'cortex:read',
      MCP_ACTION_SCOPE: 'cambium:act',
      MCP_PLUGIN_CLIENT_ID: 'cambium-private-plugin',
      MCP_FOUNDER_SUBJECTS: 'founder-primary',
      MCP_ALLOWED_ORIGINS: 'https://chatgpt.example.test',
    },
    serviceBindings: [
      { name: 'MCP_TOKEN_VERIFIER', type: 'service', targetRefDigest: digest('1') },
      { name: 'MCP_PROVENANCE_READER', type: 'service', targetRefDigest: digest('2') },
      { name: 'MCP_GATE_ADAPTER', type: 'service', targetRefDigest: digest('3') },
    ],
    secrets: [
      { name: 'MCP_GATE_ADAPTER_TOKEN', configured: true, secretRefDigest: digest('4') },
      { name: 'MCP_PROFILE_ID_KEY', configured: true, secretRefDigest: digest('5') },
    ],
    deployedVersionDigest: runtimeDigest,
    rollbackReferenceDigest: digest('7'),
  }
}

function admit(snapshot, approvedConfigurationDigest = configurationDigest(snapshot)) {
  return validateSnapshot(snapshot, policy, {
    approvedConfigurationDigest,
    reviewedRuntimeDigest: runtimeDigest,
  })
}

test('checked-in deployment admission policy is closed and internally valid', () => {
  assert.deepEqual(validatePolicy(policy), [])
  assert.equal(resolve(defaultPolicyPath).endsWith('deployment-admission.policy.json'), true)
})

test('complete redacted snapshot is admitted without live access', () => {
  assert.deepEqual(admit(validSnapshot()), [])
})

test('snapshot cannot self-authorize without a separately approved digest', () => {
  const snapshot = validSnapshot()
  const errors = validateSnapshot(snapshot, policy, { reviewedRuntimeDigest: runtimeDigest }).join('\n')
  assert.match(errors, /approvedConfigurationDigest:required/)
})

test('snapshot rejects widened auth, endpoint, identities, and origins', () => {
  const cases = [
    ['legacy mode', (s) => { s.vars.MCP_AUTH_MODE = 'legacy' }],
    ['resource drift', (s) => { s.vars.MCP_RESOURCE_URL = 'https://other.example.test/mcp' }],
    ['issuer downgrade', (s) => { s.vars.MCP_AUTHORIZATION_SERVER = 'http://identity.example.test' }],
    ['scope widening', (s) => { s.vars.MCP_REQUIRED_SCOPES = 'cortex:read admin:all' }],
    ['action scope drift', (s) => { s.vars.MCP_ACTION_SCOPE = 'admin:all' }],
    ['plugin identity whitespace', (s) => { s.vars.MCP_PLUGIN_CLIENT_ID = 'not valid' }],
    ['founder identity whitespace', (s) => { s.vars.MCP_FOUNDER_SUBJECTS = 'not valid' }],
    ['wildcard origin', (s) => { s.vars.MCP_ALLOWED_ORIGINS = 'https://*.example.test' }],
    ['origin path', (s) => { s.vars.MCP_ALLOWED_ORIGINS = 'https://chatgpt.example.test/path' }],
  ]
  for (const [label, mutate] of cases) {
    const snapshot = validSnapshot()
    mutate(snapshot)
    assert.notDeepEqual(admit(snapshot), [], label)
  }
})

test('well-formed identity and origin substitutions fail against the approved configuration digest', () => {
  const baseline = validSnapshot()
  const approved = configurationDigest(baseline)
  const cases = [
    (s) => { s.vars.MCP_AUTHORIZATION_SERVER = 'https://other-identity.example.test' },
    (s) => { s.vars.MCP_PLUGIN_CLIENT_ID = 'other-private-plugin' },
    (s) => { s.vars.MCP_FOUNDER_SUBJECTS = 'other-founder' },
    (s) => { s.vars.MCP_ALLOWED_ORIGINS = 'https://other-chatgpt.example.test' },
  ]
  for (const mutate of cases) {
    const snapshot = structuredClone(baseline)
    mutate(snapshot)
    assert.match(admit(snapshot, approved).join('\n'), /approvedConfigurationDigest:mismatch/)
  }
})

test('snapshot requires exactly three service bindings and forbids D1', () => {
  const missing = validSnapshot()
  missing.serviceBindings.pop()
  assert.match(admit(missing).join('\n'), /exact_required_set/)

  const d1 = validSnapshot()
  d1.serviceBindings[0] = { name: 'GOAL_GRAPH', type: 'd1_database', targetRefDigest: digest('8') }
  const errors = admit(d1).join('\n')
  assert.match(errors, /service_required/)
  assert.match(errors, /d1_forbidden/)
  assert.match(errors, /exact_required_set/)
})

test('snapshot accepts secret references only and rejects values or missing configuration', () => {
  const valueLeak = validSnapshot()
  valueLeak.secrets[0].value = 'must-never-be-accepted'
  const valueLeakErrors = admit(valueLeak).join('\n')
  assert.match(valueLeakErrors, /snapshot.secrets.entry:unknown_field/)
  assert.doesNotMatch(valueLeakErrors, /must-never-be-accepted/)

  const missing = validSnapshot()
  missing.secrets[1].configured = false
  assert.match(admit(missing).join('\n'), /configured:true_required/)

  const rawReference = validSnapshot()
  rawReference.secrets[1].secretRefDigest = 'profile-key-name'
  assert.match(admit(rawReference).join('\n'), /sha256_required/)
})

test('snapshot requires distinct deployed-version and rollback digests', () => {
  const absent = validSnapshot()
  delete absent.rollbackReferenceDigest
  assert.match(admit(absent).join('\n'), /rollbackReferenceDigest:sha256_required/)

  const same = validSnapshot()
  same.rollbackReferenceDigest = same.deployedVersionDigest
  assert.match(admit(same).join('\n'), /must_differ/)
})

test('deployed version is bound to reviewed Worker sources and all reference digests are distinct', () => {
  const unrelated = validSnapshot()
  unrelated.deployedVersionDigest = digest('8')
  assert.match(admit(unrelated).join('\n'), /reviewed_runtime_mismatch/)

  const reused = validSnapshot()
  reused.secrets[0].secretRefDigest = reused.serviceBindings[0].targetRefDigest
  assert.match(admit(reused).join('\n'), /distinct_required/)
})

test('snapshot rejects unknown fields at every security-sensitive layer', () => {
  const root = validSnapshot()
  root.credentials = {}
  assert.match(admit(root).join('\n'), /snapshot:unknown_field/)

  const vars = validSnapshot()
  vars.vars.CONTEXT_ROUTE_TOKEN = 'legacy'
  assert.match(admit(vars).join('\n'), /snapshot.vars:unknown_field/)

  const binding = validSnapshot()
  binding.serviceBindings[0].target = 'raw-service-name'
  assert.match(admit(binding).join('\n'), /snapshot.serviceBindings.entry:unknown_field/)
})

test('unknown field names and values are never reflected into admission errors', () => {
  const snapshot = validSnapshot()
  snapshot['private-token-marker'] = 'private-value-marker'
  snapshot.secrets[0]['private-secret-marker'] = 'private-secret-value-marker'
  const errors = admit(snapshot).join('\n')
  assert.match(errors, /unknown_field/)
  assert.doesNotMatch(errors, /private-token-marker|private-value-marker|private-secret-marker|private-secret-value-marker/)
})
