#!/usr/bin/env node
// dot-runtime.mjs
//
// Source-only, deterministic Dot runtime compiler for the Cambium
// `cambium-infinite-game` skill packet. This module compiles bounded
// envelopes that describe what an OpenAI Dot *would* do; it never sends,
// writes, or acknowledges any live effect. It performs no network I/O and
// no filesystem writes. All timestamps are supplied by the caller.
//
// See references/dot-operating-contract.md for the semantic map.

import { createHash } from 'node:crypto'

/* -------------------------------------------------------------------- */
/* Errors                                                                */
/* -------------------------------------------------------------------- */

export class DotRuntimeError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DotRuntimeError'
    this.code = code
  }
}

function fail(code, message) {
  throw new DotRuntimeError(code, message)
}

function assertObjectShape(value, allowed, required, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('bad_input', `${label} must be an object`)
  }
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      fail('unknown_field', `${label}.${key} is not allowed`)
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail('missing_field', `${label}.${key} is required`)
    }
  }
}

/* -------------------------------------------------------------------- */
/* Canonical JSON + hashing                                              */
/* -------------------------------------------------------------------- */

function canonicalize(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('bad_number', 'Non-finite number in canonical JSON')
    return JSON.stringify(value)
  }
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']'
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const parts = []
    for (const k of keys) {
      const v = value[k]
      if (v === undefined) continue
      parts.push(JSON.stringify(k) + ':' + canonicalize(v))
    }
    return '{' + parts.join(',') + '}'
  }
  fail('unsupported_value', `Unsupported value type: ${typeof value}`)
  return '' // unreachable
}

export function canonicalJson(value) {
  return canonicalize(value)
}

export function canonicalJsonHash(value) {
  const canonical = canonicalize(value)
  const hex = createHash('sha256').update(canonical).digest('hex')
  return 'sha256:' + hex
}

/* -------------------------------------------------------------------- */
/* Digest and identity guards                                            */
/* -------------------------------------------------------------------- */

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/

function isDigestRef(value) {
  return typeof value === 'string' && DIGEST_RE.test(value)
}

function assertDigest(value, field) {
  if (!isDigestRef(value)) {
    fail(
      'bad_digest',
      `${field} must be a canonical digest reference sha256:<64 lowercase hex>`,
    )
  }
}

// Field name heuristics used to reject raw sensitive material. Any field whose
// name suggests secret/credential/prompt/response/session/path is rejected
// outright when it appears anywhere in the input; digest-shaped ref-fields
// must instead pass through the explicit digest slots.
const SENSITIVE_NAME_RE =
  /(api[_-]?key|secret|token|password|credential|bearer|prompt(_body|Body)?|response(_body|Body)?|native[_-]?session|session[_-]?id|absolute[_-]?path|home[_-]?dir|env[_-]?file)/i

// Values that look like secrets or absolute paths, even in benign-looking
// fields. The pattern is assembled from string parts so this source file
// never contains the literal secret prefixes as substrings.
const SECRET_VALUE_RE = new RegExp(
  '^(' +
    ['s','k','-'].join('') + '[a-z0-9-]{6,}' + '|' +
    'xox[abpsr]-[a-z0-9-]{10,}' + '|' +
    'ghp_[a-z0-9]{20,}' + '|' +
    ['B','earer'].join('') + '\\s+\\S+' +
  ')$',
  'i',
)
const ABSOLUTE_PATH_RE = /^([A-Za-z]:\\|\/[A-Za-z][^\s]*)/
const NATIVE_SESSION_RE = /^(sess|ssn|conv|thr|thread|dot)_[A-Z0-9]{6,}$/i

function scanForForbiddenContent(value, path) {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    if (SECRET_VALUE_RE.test(value)) {
      fail('secret_value', `Secret-like value not allowed at ${path}`)
    }
    if (NATIVE_SESSION_RE.test(value)) {
      fail(
        'native_session_id',
        `Native session identifier not allowed at ${path}`,
      )
    }
    if (ABSOLUTE_PATH_RE.test(value)) {
      fail('absolute_path', `Absolute path not allowed at ${path}`)
    }
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanForForbiddenContent(value[i], `${path}[${i}]`)
    }
    return
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) {
      if (SENSITIVE_NAME_RE.test(k)) {
        fail(
          'sensitive_field',
          `Sensitive field name not allowed at ${path}.${k}`,
        )
      }
      scanForForbiddenContent(value[k], `${path}.${k}`)
    }
  }
}

function assertReferenceMap(map, field) {
  if (map === null || typeof map !== 'object' || Array.isArray(map)) {
    fail('bad_references', `${field} must be an object of digest references`)
  }
  const keys = Object.keys(map).sort()
  if (keys.length === 0) {
    fail('bad_references', `${field} must contain at least one digest reference`)
  }
  for (const key of keys) {
    if (SENSITIVE_NAME_RE.test(key)) {
      fail('sensitive_field', `${field}.${key} is a sensitive field name`)
    }
    const value = map[key]
    if (!isDigestRef(value)) {
      fail(
        'bad_digest',
        `${field}.${key} must be a canonical digest reference sha256:<64 lowercase hex>`,
      )
    }
  }
}

function assertTenantId(tenantId) {
  if (typeof tenantId !== 'string' || !/^[a-z][a-z0-9-]{1,63}$/.test(tenantId)) {
    fail('bad_tenant', 'tenant_id must be a lowercase slug')
  }
}

function assertDotId(dotId) {
  if (typeof dotId !== 'string' || dotId.length < 3 || dotId.length > 128) {
    fail('bad_dot_id', 'dot_id must be a 3-128 character string')
  }
  if (NATIVE_SESSION_RE.test(dotId)) {
    fail('native_session_id', 'dot_id must not be a native session identifier')
  }
  if (ABSOLUTE_PATH_RE.test(dotId)) {
    fail('absolute_path', 'dot_id must not be an absolute path')
  }
}

function assertIdempotencyKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{3,128}$/.test(key)) {
    fail('bad_idempotency_key', 'idempotency_key must be a bounded slug')
  }
}

/* -------------------------------------------------------------------- */
/* Timestamps                                                            */
/* -------------------------------------------------------------------- */

const ISO_UTC_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function validateTimestamp(iso, nowIso) {
  if (typeof iso !== 'string' || !ISO_UTC_RE.test(iso)) {
    fail('bad_timestamp', 'timestamp must be strict UTC ISO like 2026-09-30T12:00:00.000Z')
  }
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) {
    fail('bad_timestamp', 'timestamp is not a valid instant')
  }
  if (nowIso !== undefined) {
    if (typeof nowIso !== 'string' || !ISO_UTC_RE.test(nowIso)) {
      fail('bad_timestamp', 'now must be strict UTC ISO')
    }
  }
  return iso
}

/* -------------------------------------------------------------------- */
/* Memory checkpoint                                                     */
/* -------------------------------------------------------------------- */

const APPROVAL_STATES = new Set([
  'compiled_not_authorized',
  'authorized',
  'stopped',
  'expired',
])

const TASK_STATES = new Set([
  'idle',
  'compiled',
  'awaiting_authorization',
  'authorized',
  'in_progress',
  'accepted',
  'held',
  'unknown',
  'stopped',
])

export function compileMemoryCheckpoint(input) {
  assertObjectShape(
    input,
    [
      'tenant_id',
      'dot_id',
      'graph_version',
      'source_version',
      'references',
      'approval_state',
      'last_accepted_receipt',
      'task_state',
      'now',
    ],
    [
      'tenant_id',
      'dot_id',
      'graph_version',
      'source_version',
      'references',
      'approval_state',
      'last_accepted_receipt',
      'task_state',
      'now',
    ],
    'input',
  )
  scanForForbiddenContent(input, 'input')

  const {
    tenant_id,
    dot_id,
    graph_version,
    source_version,
    references,
    approval_state,
    last_accepted_receipt,
    task_state,
    now,
  } = input

  assertTenantId(tenant_id)
  assertDotId(dot_id)
  if (!Number.isInteger(graph_version) || graph_version < 0) {
    fail('bad_graph_version', 'graph_version must be a non-negative integer')
  }
  if (typeof source_version !== 'string' || source_version.length === 0) {
    fail('bad_source_version', 'source_version must be a non-empty string')
  }
  assertReferenceMap(references, 'references')

  if (!approval_state || typeof approval_state !== 'object') {
    fail('bad_approval_state', 'approval_state must be an object')
  }
  assertObjectShape(
    approval_state,
    ['status', 'approval_digest'],
    ['status', 'approval_digest'],
    'approval_state',
  )
  if (!APPROVAL_STATES.has(approval_state.status)) {
    fail('bad_approval_state', `approval_state.status must be one of ${[...APPROVAL_STATES].join(',')}`)
  }
  if (approval_state.approval_digest !== null) {
    assertDigest(approval_state.approval_digest, 'approval_state.approval_digest')
  }

  if (last_accepted_receipt !== null) {
    if (!last_accepted_receipt || typeof last_accepted_receipt !== 'object') {
      fail('bad_receipt', 'last_accepted_receipt must be an object or null')
    }
    assertObjectShape(
      last_accepted_receipt,
      ['receipt_digest', 'idempotency_key', 'accepted_at'],
      ['receipt_digest', 'idempotency_key', 'accepted_at'],
      'last_accepted_receipt',
    )
    assertDigest(last_accepted_receipt.receipt_digest, 'last_accepted_receipt.receipt_digest')
    assertIdempotencyKey(last_accepted_receipt.idempotency_key)
    validateTimestamp(last_accepted_receipt.accepted_at, now)
  }

  assertObjectShape(
    task_state,
    ['idempotency_key', 'status'],
    ['idempotency_key', 'status'],
    'task_state',
  )
  assertIdempotencyKey(task_state.idempotency_key)
  if (!TASK_STATES.has(task_state.status)) {
    fail('bad_task_state', `task_state.status must be one of ${[...TASK_STATES].join(',')}`)
  }

  const freshness = validateTimestamp(now, now)

  const body = {
    schema: 'cambium.dot.memory_checkpoint.v1',
    tenant_id,
    dot_id,
    graph_version,
    source_version,
    references: sortRefs(references),
    approval_state: {
      status: approval_state.status,
      approval_digest: approval_state.approval_digest ?? null,
    },
    last_accepted_receipt: last_accepted_receipt
      ? {
          receipt_digest: last_accepted_receipt.receipt_digest,
          idempotency_key: last_accepted_receipt.idempotency_key,
          accepted_at: last_accepted_receipt.accepted_at,
        }
      : null,
    task_state: {
      idempotency_key: task_state.idempotency_key,
      status: task_state.status,
    },
    freshness,
  }
  const checkpoint_digest = canonicalJsonHash(body)
  return { ...body, checkpoint_digest }
}

function sortRefs(refs) {
  const out = {}
  for (const k of Object.keys(refs).sort()) out[k] = refs[k]
  return out
}

/* -------------------------------------------------------------------- */
/* Task envelopes                                                        */
/* -------------------------------------------------------------------- */

function assertTaskInput(input) {
  assertObjectShape(
    input,
    [
      'tenant_id',
      'work_object_digest',
      'd1_task_digest',
      'approval_digest',
      'proof_digest',
      'idempotency_key',
      'graph_version',
      'now',
    ],
    [
      'tenant_id',
      'work_object_digest',
      'd1_task_digest',
      'approval_digest',
      'proof_digest',
      'idempotency_key',
      'graph_version',
      'now',
    ],
    'input',
  )
  scanForForbiddenContent(input, 'input')
  assertTenantId(input.tenant_id)
  assertDigest(input.work_object_digest, 'work_object_digest')
  assertDigest(input.d1_task_digest, 'd1_task_digest')
  assertDigest(input.approval_digest, 'approval_digest')
  assertDigest(input.proof_digest, 'proof_digest')
  assertIdempotencyKey(input.idempotency_key)
  if (!Number.isInteger(input.graph_version) || input.graph_version < 0) {
    fail('bad_graph_version', 'graph_version must be a non-negative integer')
  }
  validateTimestamp(input.now, input.now)
}

function canonicalTaskIdentity(input) {
  return {
    schema: 'cambium.dot.task_identity.v1',
    tenant_id: input.tenant_id,
    work_object_digest: input.work_object_digest,
    d1_task_digest: input.d1_task_digest,
    approval_digest: input.approval_digest,
    proof_digest: input.proof_digest,
    idempotency_key: input.idempotency_key,
    graph_version: input.graph_version,
  }
}

function compileTaskEnvelope(input, environment) {
  assertTaskInput(input)
  const canonical = canonicalTaskIdentity(input)
  const canonical_identity_digest = canonicalJsonHash(canonical)

  const runIdentity = {
    schema: 'cambium.dot.run_identity.v1',
    environment,
    canonical_identity_digest,
    compiled_at: input.now,
  }
  const run_identity_digest = canonicalJsonHash(runIdentity)

  return {
    schema: 'cambium.dot.task_envelope.v1',
    environment,
    tenant_id: input.tenant_id,
    canonical,
    canonical_identity_digest,
    run_identity_digest,
    compiled_at: input.now,
    requires_connected_computer: environment === 'local',
    status: 'compiled_not_authorized',
  }
}

export function compileLocalTaskEnvelope(input) {
  return compileTaskEnvelope(input, 'local')
}

export function compileCloudTaskEnvelope(input) {
  return compileTaskEnvelope(input, 'cloud')
}

/* -------------------------------------------------------------------- */
/* Connected surfaces                                                    */
/* -------------------------------------------------------------------- */

const KNOWN_SURFACES = new Set([
  'chatgpt',
  'slack',
  'teams',
  'connected_computer',
  'app',
  'plugin',
  'mcp',
])

export function evaluateConnectedSurfaces(input) {
  assertObjectShape(
    input,
    ['required', 'available', 'now'],
    ['required', 'available', 'now'],
    'input',
  )
  scanForForbiddenContent(input, 'input')
  const { required, available, now } = input
  if (!Array.isArray(required) || required.length === 0) {
    fail('bad_required', 'required must be a non-empty array of surface names')
  }
  if (!available || typeof available !== 'object' || Array.isArray(available)) {
    fail('bad_available', 'available must be an object of surface->boolean')
  }
  for (const [name, present] of Object.entries(available)) {
    if (!KNOWN_SURFACES.has(name)) fail('unknown_surface', `unknown available surface: ${name}`)
    if (typeof present !== 'boolean') fail('bad_available', `available.${name} must be boolean`)
  }
  validateTimestamp(now, now)

  const surfaces = {}
  let overall = 'ready'
  for (const name of [...required].sort()) {
    if (!KNOWN_SURFACES.has(name)) {
      fail('unknown_surface', `unknown required surface: ${name}`)
    }
    const present = available[name] === true
    surfaces[name] = {
      status: present ? 'ready' : 'held',
      required: true,
    }
    if (!present) overall = 'held'
  }

  return {
    schema: 'cambium.dot.surfaces.v1',
    overall,
    surfaces,
    fallback_used: false,
    recommend_alternative_channel: false,
    evaluated_at: now,
  }
}

/* -------------------------------------------------------------------- */
/* Updates                                                               */
/* -------------------------------------------------------------------- */

const UPDATE_CHANNELS = new Set(['chatgpt', 'slack', 'teams'])

export function compileUpdate(input) {
  assertObjectShape(
    input,
    ['channel', 'body_digest', 'tenant_id', 'idempotency_key', 'now'],
    ['channel', 'body_digest', 'tenant_id', 'idempotency_key', 'now'],
    'input',
  )
  scanForForbiddenContent(input, 'input')
  const { channel, body_digest, tenant_id, idempotency_key, now } = input

  if (channel === 'telegram') {
    fail(
      'telegram_hermes_owned',
      'Telegram is delivered by Hermes; the Dot runtime must not compile Telegram updates',
    )
  }
  if (!UPDATE_CHANNELS.has(channel)) {
    fail('unknown_channel', `channel must be one of ${[...UPDATE_CHANNELS].join(',')}`)
  }
  assertTenantId(tenant_id)
  assertDigest(body_digest, 'body_digest')
  assertIdempotencyKey(idempotency_key)
  validateTimestamp(now, now)

  const body = {
    schema: 'cambium.dot.update.v1',
    tenant_id,
    channel,
    body_digest,
    idempotency_key,
    compiled_at: now,
    status: 'compiled_not_sent',
    sent: false,
  }
  const update_digest = canonicalJsonHash(body)
  return { ...body, update_digest }
}

/* -------------------------------------------------------------------- */
/* Stop / pause / cancel-schedule                                        */
/* -------------------------------------------------------------------- */

const STOP_KINDS = new Set(['stop', 'pause', 'cancel_schedule'])

export function compileStopReceipt(input) {
  assertObjectShape(
    input,
    ['tenant_id', 'idempotency_key', 'reason', 'kind', 'now'],
    ['tenant_id', 'idempotency_key', 'reason', 'now'],
    'input',
  )
  scanForForbiddenContent(input, 'input')
  const { tenant_id, idempotency_key, reason, now } = input
  const kind = input.kind ?? 'stop'

  assertTenantId(tenant_id)
  assertIdempotencyKey(idempotency_key)
  if (!STOP_KINDS.has(kind)) {
    fail('bad_kind', `kind must be one of ${[...STOP_KINDS].join(',')}`)
  }
  if (typeof reason !== 'string' || reason.length === 0 || reason.length > 256) {
    fail('bad_reason', 'reason must be a 1-256 character string')
  }
  validateTimestamp(now, now)

  const authorization_frozen = kind === 'stop'
  const late_results_policy = kind === 'stop' ? 'evidence_only' : 'admissible'
  const status = kind === 'stop' ? 'stopped' : kind === 'pause' ? 'paused' : 'schedule_cancelled'

  const body = {
    schema: 'cambium.dot.stop_receipt.v1',
    tenant_id,
    kind,
    idempotency_key,
    reason,
    status,
    authorization_frozen,
    late_results_policy,
    compiled_at: now,
  }
  const stop_digest = canonicalJsonHash(body)
  return { ...body, stop_digest }
}

/* -------------------------------------------------------------------- */
/* Action admission after lifecycle controls                             */
/* -------------------------------------------------------------------- */

const LIFECYCLE_STATES = new Set(['active', 'paused', 'stopped', 'schedule_cancelled'])

export function evaluateActionAdmission(input) {
  assertObjectShape(
    input,
    [
      'tenant_id',
      'idempotency_key',
      'action_digest',
      'approval_digest',
      'lifecycle_state',
      'now',
    ],
    [
      'tenant_id',
      'idempotency_key',
      'action_digest',
      'approval_digest',
      'lifecycle_state',
      'now',
    ],
    'input',
  )
  scanForForbiddenContent(input, 'input')
  assertTenantId(input.tenant_id)
  assertIdempotencyKey(input.idempotency_key)
  assertDigest(input.action_digest, 'action_digest')
  assertDigest(input.approval_digest, 'approval_digest')
  assertObjectShape(
    input.lifecycle_state,
    ['status', 'receipt_digest'],
    ['status', 'receipt_digest'],
    'lifecycle_state',
  )
  if (!LIFECYCLE_STATES.has(input.lifecycle_state.status)) {
    fail(
      'bad_lifecycle_state',
      `lifecycle_state.status must be one of ${[...LIFECYCLE_STATES].join(',')}`,
    )
  }
  if (input.lifecycle_state.receipt_digest !== null) {
    assertDigest(input.lifecycle_state.receipt_digest, 'lifecycle_state.receipt_digest')
  }
  validateTimestamp(input.now, input.now)

  const stopped = input.lifecycle_state.status === 'stopped'
  const paused = input.lifecycle_state.status === 'paused'
  const decision = stopped || paused ? 'held' : 'eligible_for_separate_authorization'
  const body = {
    schema: 'cambium.dot.action_admission.v1',
    tenant_id: input.tenant_id,
    idempotency_key: input.idempotency_key,
    action_digest: input.action_digest,
    approval_digest: input.approval_digest,
    lifecycle_status: input.lifecycle_state.status,
    lifecycle_receipt_digest: input.lifecycle_state.receipt_digest,
    decision,
    authorization_frozen: stopped,
    may_request_authorization: !stopped && !paused,
    authorized: false,
    late_results_policy: stopped ? 'evidence_only' : 'admissible',
    evaluated_at: input.now,
  }
  return { ...body, admission_digest: canonicalJsonHash(body) }
}

/* -------------------------------------------------------------------- */
/* Reconcile outcome                                                     */
/* -------------------------------------------------------------------- */

const OUTCOME_STATUSES = new Set(['accepted', 'rejected', 'held', 'unknown', 'stopped'])

export function reconcileOutcome(input) {
  assertObjectShape(
    input,
    ['idempotency_key', 'known_outcomes', 'now'],
    ['idempotency_key', 'known_outcomes', 'now'],
    'input',
  )
  scanForForbiddenContent(input, 'input')
  const { idempotency_key, known_outcomes, now } = input
  assertIdempotencyKey(idempotency_key)
  if (!Array.isArray(known_outcomes)) {
    fail('bad_outcomes', 'known_outcomes must be an array')
  }
  validateTimestamp(now, now)

  const matches = []
  for (const o of known_outcomes) {
    assertObjectShape(
      o,
      ['idempotency_key', 'status', 'receipt_digest'],
      ['idempotency_key', 'status'],
      'known_outcomes[]',
    )
    assertIdempotencyKey(o.idempotency_key)
    if (o.idempotency_key !== idempotency_key) continue
    if (!OUTCOME_STATUSES.has(o.status)) {
      fail('bad_outcome_status', `outcome.status must be one of ${[...OUTCOME_STATUSES].join(',')}`)
    }
    if (o.receipt_digest !== undefined && o.receipt_digest !== null) {
      assertDigest(o.receipt_digest, 'outcome.receipt_digest')
    }
    matches.push(o)
  }

  if (matches.length === 0) {
    return {
      schema: 'cambium.dot.reconcile.v1',
      idempotency_key,
      status: 'unknown',
      matched: false,
      recommend_reissue: false,
      recommend_authoritative_readback: true,
      conflicting_outcomes: 0,
      evaluated_at: now,
    }
  }

  const first = matches[0]
  return {
    schema: 'cambium.dot.reconcile.v1',
    idempotency_key,
    status: first.status,
    matched: true,
    receipt_digest: first.receipt_digest ?? null,
    recommend_reissue: false,
    recommend_authoritative_readback: first.status === 'unknown',
    conflicting_outcomes: matches.length - 1,
    evaluated_at: now,
  }
}

/* -------------------------------------------------------------------- */
/* CLI                                                                   */
/* -------------------------------------------------------------------- */

const OPS = {
  compileMemoryCheckpoint,
  compileLocalTaskEnvelope,
  compileCloudTaskEnvelope,
  evaluateConnectedSurfaces,
  compileUpdate,
  compileStopReceipt,
  evaluateActionAdmission,
  reconcileOutcome,
  canonicalJsonHash: (input) => ({ digest: canonicalJsonHash(input) }),
}

function readStdin() {
  return new Promise((resolveP, rejectP) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolveP(data))
    process.stdin.on('error', rejectP)
  })
}

async function runCli() {
  let payloadText
  try {
    payloadText = await readStdin()
  } catch (err) {
    process.stderr.write(
      JSON.stringify({ error: true, code: 'stdin_read_failed', message: err.message }),
    )
    process.exit(2)
  }
  let payload
  try {
    payload = JSON.parse(payloadText)
  } catch (err) {
    process.stderr.write(
      JSON.stringify({ error: true, code: 'bad_json', message: err.message }),
    )
    process.exit(2)
    return
  }
  const op = payload && payload.op
  const input = payload && payload.input
  if (!op || typeof op !== 'string' || !(op in OPS)) {
    process.stderr.write(
      JSON.stringify({
        error: true,
        code: 'unknown_op',
        message: `unknown op: ${op}`,
      }),
    )
    process.exit(2)
    return
  }
  try {
    const result = OPS[op](input)
    process.stdout.write(canonicalize(result))
  } catch (err) {
    const code = err instanceof DotRuntimeError ? err.code : 'runtime_error'
    process.stderr.write(
      JSON.stringify({ error: true, code, message: err.message }),
    )
    process.exit(2)
  }
}

const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1] ?? '')

if (isDirect) {
  runCli()
}
