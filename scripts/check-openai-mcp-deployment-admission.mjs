#!/usr/bin/env node

// Read-only deployment admission for the reviewed Cambium OpenAI MCP runtime.
// It validates either the checked-in policy alone or an owner-produced,
// redacted snapshot. It never reads Wrangler state, credentials, or networks;
// writes nothing; and never prints configuration values.

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
export const defaultPolicyPath = resolve(
  repoRoot,
  'openai/cambium-infinite-game/deployment-admission.policy.json',
)
export const defaultManifestPath = resolve(
  repoRoot,
  'openai/cambium-infinite-game/compatibility.manifest.json',
)

const POLICY_KEYS = new Set([
  'schema',
  'scriptName',
  'endpoint',
  'auth',
  'requiredServiceBindings',
  'requiredSecrets',
  'forbiddenBindingTypes',
  'admission',
  'snapshotContract',
])
const SNAPSHOT_KEYS = new Set([
  'schema',
  'scriptName',
  'endpoint',
  'vars',
  'serviceBindings',
  'secrets',
  'deployedVersionDigest',
  'rollbackReferenceDigest',
])
const VAR_KEYS = new Set([
  'MCP_AUTH_MODE',
  'MCP_RESOURCE_URL',
  'MCP_AUTHORIZATION_SERVER',
  'MCP_REQUIRED_SCOPES',
  'MCP_ACTION_SCOPE',
  'MCP_PLUGIN_CLIENT_ID',
  'MCP_FOUNDER_SUBJECTS',
  'MCP_ALLOWED_ORIGINS',
])
const SHA256 = /^sha256:[a-f0-9]{64}$/
const CANONICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/
const SCOPE = /^[A-Za-z0-9._:/-]+$/

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function closedKeys(value, allowed, label, errors) {
  if (!object(value)) {
    errors.push(`${label}:object_required`)
    return false
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label}:unknown_field`)
  }
  return true
}

function uniqueStrings(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item)) {
    errors.push(`${label}:nonempty_string_array_required`)
    return []
  }
  if (new Set(value).size !== value.length) errors.push(`${label}:duplicates_forbidden`)
  return value
}

function exactHttpsIdentifier(value, label, errors, { originOnly = false } = {}) {
  if (typeof value !== 'string' || value.trim() !== value) {
    errors.push(`${label}:exact_https_identifier_required`)
    return false
  }
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      errors.push(`${label}:exact_https_identifier_required`)
      return false
    }
    if (originOnly && (parsed.pathname !== '/' || parsed.origin !== value)) {
      errors.push(`${label}:https_origin_required`)
      return false
    }
    return true
  } catch {
    errors.push(`${label}:exact_https_identifier_required`)
    return false
  }
}

function parseTokens(value, label, pattern, errors) {
  if (typeof value !== 'string' || value.trim() !== value) {
    errors.push(`${label}:token_list_required`)
    return []
  }
  const tokens = value.split(/[\s,]+/).filter(Boolean)
  if (tokens.length === 0 || tokens.some((token) => !pattern.test(token))) {
    errors.push(`${label}:token_list_required`)
    return []
  }
  if (new Set(tokens).size !== tokens.length) errors.push(`${label}:duplicates_forbidden`)
  return tokens
}

function parseCommaTokens(value, label, pattern, errors) {
  if (typeof value !== 'string' || value.trim() !== value) {
    errors.push(`${label}:comma_list_required`)
    return []
  }
  const tokens = value.split(',').map((token) => token.trim()).filter(Boolean)
  if (tokens.length === 0 || tokens.some((token) => !pattern.test(token))) {
    errors.push(`${label}:comma_list_required`)
    return []
  }
  if (new Set(tokens).size !== tokens.length) errors.push(`${label}:duplicates_forbidden`)
  return tokens
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}

export function configurationDigest(snapshot) {
  return `sha256:${createHash('sha256').update(canonicalJson(snapshot)).digest('hex')}`
}

export function reviewedRuntimeDigest(manifest) {
  const sources = Array.isArray(manifest?.runtime_sources)
    ? manifest.runtime_sources.filter((source) => typeof source?.path === 'string' && source.path.startsWith('workers/'))
    : []
  if (sources.length === 0 || sources.some((source) => !SHA256.test(source.digest || ''))) {
    throw new Error('manifest:reviewed_worker_runtime_sources_required')
  }
  const hash = createHash('sha256')
  for (const source of sources.slice().sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(source.path)
    hash.update('\0')
    hash.update(source.digest)
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

export function validatePolicy(policy) {
  const errors = []
  if (!closedKeys(policy, POLICY_KEYS, 'policy', errors)) return errors
  if (policy.schema !== 'cambium.openai-mcp-deployment-admission.v1') errors.push('policy.schema:unsupported')
  if (policy.scriptName !== 'cortex-mcp') errors.push('policy.scriptName:unexpected')
  if (policy.endpoint !== 'https://cortex.thoughtseed.space/mcp') errors.push('policy.endpoint:unexpected')
  exactHttpsIdentifier(policy.endpoint, 'policy.endpoint', errors)

  const authKeys = new Set(['mode', 'requiredScopes', 'actionScope', 'maxFounderSubjects', 'maxAllowedOrigins'])
  if (closedKeys(policy.auth, authKeys, 'policy.auth', errors)) {
    if (policy.auth.mode !== 'oauth') errors.push('policy.auth.mode:oauth_required')
    const scopes = uniqueStrings(policy.auth.requiredScopes, 'policy.auth.requiredScopes', errors)
    if (scopes.length !== 1 || scopes[0] !== 'cortex:read') errors.push('policy.auth.requiredScopes:exact_read_scope_required')
    if (policy.auth.actionScope !== 'cambium:act') errors.push('policy.auth.actionScope:unexpected')
    if (!Number.isInteger(policy.auth.maxFounderSubjects) || policy.auth.maxFounderSubjects < 1 || policy.auth.maxFounderSubjects > 64) {
      errors.push('policy.auth.maxFounderSubjects:bounded_integer_required')
    }
    if (!Number.isInteger(policy.auth.maxAllowedOrigins) || policy.auth.maxAllowedOrigins < 1 || policy.auth.maxAllowedOrigins > 16) {
      errors.push('policy.auth.maxAllowedOrigins:bounded_integer_required')
    }
  }

  const bindings = uniqueStrings(policy.requiredServiceBindings, 'policy.requiredServiceBindings', errors)
  if (bindings.join('\0') !== ['MCP_TOKEN_VERIFIER', 'MCP_PROVENANCE_READER', 'MCP_GATE_ADAPTER'].join('\0')) {
    errors.push('policy.requiredServiceBindings:exact_ordered_set_required')
  }
  const secrets = uniqueStrings(policy.requiredSecrets, 'policy.requiredSecrets', errors)
  if (secrets.join('\0') !== ['MCP_GATE_ADAPTER_TOKEN', 'MCP_PROFILE_ID_KEY'].join('\0')) {
    errors.push('policy.requiredSecrets:exact_ordered_set_required')
  }
  const forbidden = uniqueStrings(policy.forbiddenBindingTypes, 'policy.forbiddenBindingTypes', errors)
  if (!forbidden.includes('d1_database') || !forbidden.includes('d1_databases')) {
    errors.push('policy.forbiddenBindingTypes:d1_required')
  }
  const admissionKeys = new Set([
    'configurationDigestAlgorithm',
    'reviewedRuntimeDigestAlgorithm',
    'ownerApprovedConfigurationDigestRequired',
    'referenceDigestsMustBeDistinct',
  ])
  if (closedKeys(policy.admission, admissionKeys, 'policy.admission', errors)) {
    if (policy.admission.configurationDigestAlgorithm !== 'sha256-canonical-json-v1') {
      errors.push('policy.admission.configurationDigestAlgorithm:unsupported')
    }
    if (policy.admission.reviewedRuntimeDigestAlgorithm !== 'sha256-sorted-worker-runtime-sources-v1') {
      errors.push('policy.admission.reviewedRuntimeDigestAlgorithm:unsupported')
    }
    if (policy.admission.ownerApprovedConfigurationDigestRequired !== true) {
      errors.push('policy.admission.ownerApprovedConfigurationDigestRequired:true_required')
    }
    if (policy.admission.referenceDigestsMustBeDistinct !== true) {
      errors.push('policy.admission.referenceDigestsMustBeDistinct:true_required')
    }
  }
  const contractKeys = new Set(['secrets', 'bindings', 'receipts', 'output'])
  if (closedKeys(policy.snapshotContract, contractKeys, 'policy.snapshotContract', errors)) {
    for (const key of contractKeys) {
      if (typeof policy.snapshotContract[key] !== 'string' || !policy.snapshotContract[key]) {
        errors.push(`policy.snapshotContract.${key}:nonempty_string_required`)
      }
    }
  }
  return errors
}

export function validateSnapshot(snapshot, policy, options = {}) {
  const errors = [...validatePolicy(policy)]
  if (errors.length) return errors
  if (!closedKeys(snapshot, SNAPSHOT_KEYS, 'snapshot', errors)) return errors
  if (snapshot.schema !== 'cambium.openai-mcp-deployment-snapshot.v1') errors.push('snapshot.schema:unsupported')
  if (snapshot.scriptName !== policy.scriptName) errors.push('snapshot.scriptName:mismatch')
  if (snapshot.endpoint !== policy.endpoint) errors.push('snapshot.endpoint:mismatch')

  if (closedKeys(snapshot.vars, VAR_KEYS, 'snapshot.vars', errors)) {
    for (const key of VAR_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(snapshot.vars, key)) errors.push(`snapshot.vars.${key}:required`)
    }
    if (snapshot.vars.MCP_AUTH_MODE !== policy.auth.mode) errors.push('snapshot.vars.MCP_AUTH_MODE:mismatch')
    if (snapshot.vars.MCP_RESOURCE_URL !== policy.endpoint) errors.push('snapshot.vars.MCP_RESOURCE_URL:mismatch')
    exactHttpsIdentifier(snapshot.vars.MCP_AUTHORIZATION_SERVER, 'snapshot.vars.MCP_AUTHORIZATION_SERVER', errors)
    const requiredScopes = parseTokens(snapshot.vars.MCP_REQUIRED_SCOPES, 'snapshot.vars.MCP_REQUIRED_SCOPES', SCOPE, errors)
    if (requiredScopes.join('\0') !== policy.auth.requiredScopes.join('\0')) errors.push('snapshot.vars.MCP_REQUIRED_SCOPES:exact_set_required')
    if (snapshot.vars.MCP_ACTION_SCOPE !== policy.auth.actionScope) errors.push('snapshot.vars.MCP_ACTION_SCOPE:mismatch')
    if (typeof snapshot.vars.MCP_PLUGIN_CLIENT_ID !== 'string' || !CANONICAL_ID.test(snapshot.vars.MCP_PLUGIN_CLIENT_ID)) {
      errors.push('snapshot.vars.MCP_PLUGIN_CLIENT_ID:canonical_id_required')
    }
    const founders = parseCommaTokens(snapshot.vars.MCP_FOUNDER_SUBJECTS, 'snapshot.vars.MCP_FOUNDER_SUBJECTS', CANONICAL_ID, errors)
    if (founders.length > policy.auth.maxFounderSubjects) errors.push('snapshot.vars.MCP_FOUNDER_SUBJECTS:limit_exceeded')
    const origins = parseCommaTokens(snapshot.vars.MCP_ALLOWED_ORIGINS, 'snapshot.vars.MCP_ALLOWED_ORIGINS', /^https:\/\/[^*]+$/, errors)
    if (origins.length > policy.auth.maxAllowedOrigins) errors.push('snapshot.vars.MCP_ALLOWED_ORIGINS:limit_exceeded')
    for (const origin of origins) exactHttpsIdentifier(origin, 'snapshot.vars.MCP_ALLOWED_ORIGINS', errors, { originOnly: true })
  }

  if (!Array.isArray(snapshot.serviceBindings)) {
    errors.push('snapshot.serviceBindings:array_required')
  } else {
    const seen = new Set()
    for (const binding of snapshot.serviceBindings) {
      const bindingKeys = new Set(['name', 'type', 'targetRefDigest'])
      if (!closedKeys(binding, bindingKeys, 'snapshot.serviceBindings.entry', errors)) continue
      if (typeof binding.name !== 'string') errors.push('snapshot.serviceBindings.name:string_required')
      else if (seen.has(binding.name)) errors.push('snapshot.serviceBindings:duplicates_forbidden')
      else seen.add(binding.name)
      if (binding.type !== 'service') errors.push('snapshot.serviceBindings.type:service_required')
      if (!SHA256.test(binding.targetRefDigest || '')) errors.push('snapshot.serviceBindings.targetRefDigest:sha256_required')
    }
    if (snapshot.serviceBindings.length !== policy.requiredServiceBindings.length
      || policy.requiredServiceBindings.some((name) => !seen.has(name))) {
      errors.push('snapshot.serviceBindings:exact_required_set')
    }
    if (snapshot.serviceBindings.some((binding) => policy.forbiddenBindingTypes.includes(binding?.type))) {
      errors.push('snapshot.serviceBindings:d1_forbidden')
    }
  }

  if (!Array.isArray(snapshot.secrets)) {
    errors.push('snapshot.secrets:array_required')
  } else {
    const seen = new Set()
    for (const secret of snapshot.secrets) {
      const secretKeys = new Set(['name', 'configured', 'secretRefDigest'])
      if (!closedKeys(secret, secretKeys, 'snapshot.secrets.entry', errors)) continue
      if (typeof secret.name !== 'string') errors.push('snapshot.secrets.name:string_required')
      else if (seen.has(secret.name)) errors.push('snapshot.secrets:duplicates_forbidden')
      else seen.add(secret.name)
      if (secret.configured !== true) errors.push('snapshot.secrets.configured:true_required')
      if (!SHA256.test(secret.secretRefDigest || '')) errors.push('snapshot.secrets.secretRefDigest:sha256_required')
    }
    if (snapshot.secrets.length !== policy.requiredSecrets.length
      || policy.requiredSecrets.some((name) => !seen.has(name))) {
      errors.push('snapshot.secrets:exact_required_set')
    }
  }

  if (!SHA256.test(snapshot.deployedVersionDigest || '')) errors.push('snapshot.deployedVersionDigest:sha256_required')
  if (!SHA256.test(snapshot.rollbackReferenceDigest || '')) errors.push('snapshot.rollbackReferenceDigest:sha256_required')
  if (snapshot.deployedVersionDigest === snapshot.rollbackReferenceDigest) {
    errors.push('snapshot.rollbackReferenceDigest:must_differ_from_deployed_version')
  }
  if (!SHA256.test(options.reviewedRuntimeDigest || '')) {
    errors.push('admission.reviewedRuntimeDigest:required')
  } else if (snapshot.deployedVersionDigest !== options.reviewedRuntimeDigest) {
    errors.push('snapshot.deployedVersionDigest:reviewed_runtime_mismatch')
  }
  const references = [
    ...(Array.isArray(snapshot.serviceBindings) ? snapshot.serviceBindings.map((entry) => entry?.targetRefDigest) : []),
    ...(Array.isArray(snapshot.secrets) ? snapshot.secrets.map((entry) => entry?.secretRefDigest) : []),
    snapshot.deployedVersionDigest,
    snapshot.rollbackReferenceDigest,
  ].filter((value) => SHA256.test(value || ''))
  if (new Set(references).size !== references.length) {
    errors.push('admission.referenceDigests:distinct_required')
  }
  if (options.requireApproval !== false) {
    if (!SHA256.test(options.approvedConfigurationDigest || '')) {
      errors.push('admission.approvedConfigurationDigest:required')
    } else if (configurationDigest(snapshot) !== options.approvedConfigurationDigest) {
      errors.push('admission.approvedConfigurationDigest:mismatch')
    }
  }
  return errors
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'))
  } catch {
    throw new Error(`${label}:unreadable_json`)
  }
}

export function runCli(argv) {
  let policyPath = defaultPolicyPath
  let snapshotPath = null
  let checkPolicy = false
  let printConfigurationDigest = false
  let approvedConfigurationDigest = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--policy') policyPath = argv[++i]
    else if (arg === '--snapshot') snapshotPath = argv[++i]
    else if (arg === '--check-policy') checkPolicy = true
    else if (arg === '--print-configuration-digest') printConfigurationDigest = true
    else if (arg === '--approved-configuration-digest') approvedConfigurationDigest = argv[++i]
    else throw new Error('arguments:unsupported')
  }
  if (!checkPolicy && !snapshotPath) throw new Error('arguments:check_policy_or_snapshot_required')
  const policy = parseJson(policyPath, 'policy')
  const snapshot = snapshotPath ? parseJson(snapshotPath, 'snapshot') : null
  const runtimeDigest = reviewedRuntimeDigest(parseJson(defaultManifestPath, 'manifest'))
  const errors = snapshot
    ? validateSnapshot(snapshot, policy, {
        approvedConfigurationDigest,
        reviewedRuntimeDigest: runtimeDigest,
        requireApproval: !printConfigurationDigest,
      })
    : validatePolicy(policy)
  if (errors.length) {
    process.stderr.write(`openai-mcp-deployment-admission: HELD (${errors.length})\n`)
    for (const error of errors) process.stderr.write(`- ${error}\n`)
    return 2
  }
  if (snapshot && printConfigurationDigest) {
    process.stdout.write(`${configurationDigest(snapshot)}\n`)
    return 0
  }
  process.stdout.write(`openai-mcp-deployment-admission: ${snapshotPath ? 'READY' : 'POLICY_READY'}\n`)
  return 0
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCli(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`openai-mcp-deployment-admission: ERROR ${error.message}\n`)
    process.exitCode = 1
  }
}
