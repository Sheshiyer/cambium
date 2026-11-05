import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const modulePath = resolve(
  repoRoot,
  'openai',
  'cambium-infinite-game',
  'skills',
  'cambium-infinite-game',
  'scripts',
  'dot-runtime.mjs',
)

const mod = await import(modulePath)
const {
  canonicalJsonHash,
  compileMemoryCheckpoint,
  compileLocalTaskEnvelope,
  compileCloudTaskEnvelope,
  evaluateConnectedSurfaces,
  compileUpdate,
  compileStopReceipt,
  evaluateActionAdmission,
  reconcileOutcome,
  validateTimestamp,
  DotRuntimeError,
} = mod

const DIGEST_A = 'sha256:' + 'a'.repeat(64)
const DIGEST_B = 'sha256:' + 'b'.repeat(64)
const DIGEST_C = 'sha256:' + 'c'.repeat(64)
const DIGEST_D = 'sha256:' + 'd'.repeat(64)
const DIGEST_E = 'sha256:' + 'e'.repeat(64)
const DIGEST_F = 'sha256:' + 'f'.repeat(64)
const NOW = '2026-09-30T12:00:00.000Z'

function baseMemoryInput(overrides = {}) {
  return {
    tenant_id: 'cambium',
    dot_id: 'dot-infinite-game',
    graph_version: 42,
    source_version: 'v0.5.0',
    references: {
      isa_digest: DIGEST_A,
      mission_digest: DIGEST_B,
      vision_digest: DIGEST_C,
    },
    approval_state: {
      status: 'compiled_not_authorized',
      approval_digest: null,
    },
    last_accepted_receipt: null,
    task_state: {
      idempotency_key: 'idem-001',
      status: 'idle',
    },
    now: NOW,
    ...overrides,
  }
}

function baseTaskInput(overrides = {}) {
  return {
    tenant_id: 'cambium',
    work_object_digest: DIGEST_A,
    d1_task_digest: DIGEST_B,
    approval_digest: DIGEST_C,
    proof_digest: DIGEST_D,
    idempotency_key: 'idem-task-001',
    graph_version: 42,
    now: NOW,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/* canonicalJsonHash                                                   */
/* ------------------------------------------------------------------ */

test('canonicalJsonHash produces stable digest across key order', () => {
  const a = canonicalJsonHash({ b: 1, a: [2, { y: 3, x: 4 }] })
  const b = canonicalJsonHash({ a: [2, { x: 4, y: 3 }], b: 1 })
  assert.equal(a, b)
  assert.match(a, /^sha256:[0-9a-f]{64}$/)
})

test('canonicalJsonHash distinguishes different values', () => {
  const a = canonicalJsonHash({ a: 1 })
  const b = canonicalJsonHash({ a: 2 })
  assert.notEqual(a, b)
})

test('canonicalJsonHash matches direct sha256 of canonical form', () => {
  const value = { z: 1, a: 2 }
  const canonical = '{"a":2,"z":1}'
  const expected =
    'sha256:' + createHash('sha256').update(canonical).digest('hex')
  assert.equal(canonicalJsonHash(value), expected)
})

/* ------------------------------------------------------------------ */
/* validateTimestamp                                                   */
/* ------------------------------------------------------------------ */

test('validateTimestamp accepts strict UTC ISO from caller', () => {
  const t = validateTimestamp('2026-09-30T12:00:00.000Z', NOW)
  assert.equal(t, '2026-09-30T12:00:00.000Z')
})

test('validateTimestamp rejects non-UTC or malformed', () => {
  assert.throws(() => validateTimestamp('2026-09-30 12:00:00', NOW), DotRuntimeError)
  assert.throws(() => validateTimestamp('2026-09-30T12:00:00+02:00', NOW), DotRuntimeError)
  assert.throws(() => validateTimestamp('not-a-date', NOW), DotRuntimeError)
})

test('validateTimestamp does not read wall clock', () => {
  const future = '2099-01-01T00:00:00.000Z'
  assert.equal(validateTimestamp(future, future), future)
})

/* ------------------------------------------------------------------ */
/* compileMemoryCheckpoint                                             */
/* ------------------------------------------------------------------ */

test('compileMemoryCheckpoint accepts digest references only', () => {
  const cp = compileMemoryCheckpoint(baseMemoryInput())
  assert.equal(cp.tenant_id, 'cambium')
  assert.equal(cp.graph_version, 42)
  assert.equal(cp.source_version, 'v0.5.0')
  assert.equal(cp.references.isa_digest, DIGEST_A)
  assert.equal(cp.approval_state.status, 'compiled_not_authorized')
  assert.equal(cp.last_accepted_receipt, null)
  assert.equal(cp.task_state.status, 'idle')
  assert.equal(cp.freshness, NOW)
  assert.match(cp.checkpoint_digest, /^sha256:[0-9a-f]{64}$/)
})

test('compileMemoryCheckpoint rejects raw prompts, secrets, and paths', () => {
  assert.throws(
    () => compileMemoryCheckpoint(baseMemoryInput({ references: { isa_digest: 'the raw prompt body' } })),
    DotRuntimeError,
  )
  assert.throws(
    () => compileMemoryCheckpoint(baseMemoryInput({ references: { isa_digest: '/Users/x/secret' } })),
    DotRuntimeError,
  )
  assert.throws(
    () => compileMemoryCheckpoint(baseMemoryInput({ references: { isa_digest: 'sha256:short' } })),
    DotRuntimeError,
  )
  assert.throws(
    () => compileMemoryCheckpoint(baseMemoryInput({ references: { isa_digest: 'SHA256:' + 'A'.repeat(64) } })),
    DotRuntimeError,
  )
})

test('compileMemoryCheckpoint rejects native session identifiers and credentials', () => {
  assert.throws(
    () => compileMemoryCheckpoint(baseMemoryInput({ dot_id: 'sess_01ABCDEF' })),
    DotRuntimeError,
  )
  assert.throws(
    () =>
      compileMemoryCheckpoint(
        baseMemoryInput({ references: { api_key: 'sk-live-XYZ' } }),
      ),
    DotRuntimeError,
  )
})

test('compileMemoryCheckpoint is deterministic', () => {
  const a = compileMemoryCheckpoint(baseMemoryInput())
  const b = compileMemoryCheckpoint(baseMemoryInput())
  assert.deepEqual(a, b)
  assert.equal(a.checkpoint_digest, b.checkpoint_digest)
})

test('runtime operations reject unknown fields instead of silently persisting them', () => {
  assert.throws(
    () => compileMemoryCheckpoint(baseMemoryInput({ raw_content: 'benign but unbounded' })),
    (error) => error instanceof DotRuntimeError && error.code === 'unknown_field',
  )
  assert.throws(
    () => compileUpdate({
      channel: 'chatgpt',
      body_digest: DIGEST_A,
      tenant_id: 'cambium',
      idempotency_key: 'idem-u-shape',
      now: NOW,
      audience: 'unbound',
    }),
    (error) => error instanceof DotRuntimeError && error.code === 'unknown_field',
  )
})

/* ------------------------------------------------------------------ */
/* compileLocalTaskEnvelope / compileCloudTaskEnvelope                 */
/* ------------------------------------------------------------------ */

test('local and cloud envelopes share canonical identity but differ in env/run', () => {
  const local = compileLocalTaskEnvelope(baseTaskInput())
  const cloud = compileCloudTaskEnvelope(baseTaskInput())
  assert.equal(local.canonical.work_object_digest, cloud.canonical.work_object_digest)
  assert.equal(local.canonical.d1_task_digest, cloud.canonical.d1_task_digest)
  assert.equal(local.canonical.approval_digest, cloud.canonical.approval_digest)
  assert.equal(local.canonical.proof_digest, cloud.canonical.proof_digest)
  assert.equal(local.canonical_identity_digest, cloud.canonical_identity_digest)
  assert.notEqual(local.environment, cloud.environment)
  assert.equal(local.environment, 'local')
  assert.equal(cloud.environment, 'cloud')
  assert.notEqual(local.run_identity_digest, cloud.run_identity_digest)
})

test('task envelopes require full digest set', () => {
  assert.throws(
    () => compileLocalTaskEnvelope(baseTaskInput({ work_object_digest: null })),
    DotRuntimeError,
  )
  assert.throws(
    () => compileCloudTaskEnvelope(baseTaskInput({ approval_digest: 'not-a-digest' })),
    DotRuntimeError,
  )
})

test('local envelope requires connected computer, cloud does not', () => {
  const local = compileLocalTaskEnvelope(baseTaskInput())
  assert.equal(local.requires_connected_computer, true)
  const cloud = compileCloudTaskEnvelope(baseTaskInput())
  assert.equal(cloud.requires_connected_computer, false)
})

/* ------------------------------------------------------------------ */
/* evaluateConnectedSurfaces                                           */
/* ------------------------------------------------------------------ */

test('evaluateConnectedSurfaces returns held outcome with no fallback', () => {
  const out = evaluateConnectedSurfaces({
    required: ['chatgpt', 'connected_computer'],
    available: { chatgpt: true, connected_computer: false, slack: true },
    now: NOW,
  })
  assert.equal(out.overall, 'held')
  assert.equal(out.surfaces.chatgpt.status, 'ready')
  assert.equal(out.surfaces.connected_computer.status, 'held')
  assert.equal(out.fallback_used, false)
  // slack was available but not required — must not be used as fallback
  assert.equal(out.surfaces.slack, undefined)
})

test('evaluateConnectedSurfaces returns ready only when all required present', () => {
  const out = evaluateConnectedSurfaces({
    required: ['chatgpt', 'connected_computer'],
    available: { chatgpt: true, connected_computer: true },
    now: NOW,
  })
  assert.equal(out.overall, 'ready')
  assert.equal(out.fallback_used, false)
})

test('evaluateConnectedSurfaces never recommends cross-channel substitution', () => {
  const out = evaluateConnectedSurfaces({
    required: ['slack'],
    available: { slack: false, teams: true, chatgpt: true },
    now: NOW,
  })
  assert.equal(out.overall, 'held')
  assert.equal(out.surfaces.slack.status, 'held')
  assert.equal(out.recommend_alternative_channel, false)
})

test('plugin and MCP are independent connected surfaces', () => {
  const out = evaluateConnectedSurfaces({
    required: ['plugin', 'mcp'],
    available: { plugin: true, mcp: false },
    now: NOW,
  })
  assert.equal(out.surfaces.plugin.status, 'ready')
  assert.equal(out.surfaces.mcp.status, 'held')
  assert.equal(out.overall, 'held')
})

/* ------------------------------------------------------------------ */
/* compileUpdate                                                       */
/* ------------------------------------------------------------------ */

test('compileUpdate produces envelopes for chatgpt, slack, teams', () => {
  for (const channel of ['chatgpt', 'slack', 'teams']) {
    const u = compileUpdate({
      channel,
      body_digest: DIGEST_A,
      tenant_id: 'cambium',
      idempotency_key: 'idem-u-1',
      now: NOW,
    })
    assert.equal(u.channel, channel)
    assert.equal(u.status, 'compiled_not_sent')
    assert.equal(u.body_digest, DIGEST_A)
    assert.match(u.update_digest, /^sha256:[0-9a-f]{64}$/)
  }
})

test('compileUpdate rejects telegram as Hermes-owned', () => {
  assert.throws(
    () =>
      compileUpdate({
        channel: 'telegram',
        body_digest: DIGEST_A,
        tenant_id: 'cambium',
        idempotency_key: 'idem-u-2',
        now: NOW,
      }),
    /Hermes/,
  )
})

test('compileUpdate rejects unknown channels', () => {
  assert.throws(
    () =>
      compileUpdate({
        channel: 'sms',
        body_digest: DIGEST_A,
        tenant_id: 'cambium',
        idempotency_key: 'idem-u-3',
        now: NOW,
      }),
    DotRuntimeError,
  )
})

test('compileUpdate never sends — no network side effect indicated', () => {
  const u = compileUpdate({
    channel: 'chatgpt',
    body_digest: DIGEST_A,
    tenant_id: 'cambium',
    idempotency_key: 'idem-u-4',
    now: NOW,
  })
  assert.equal(u.sent, false)
  assert.equal(u.status, 'compiled_not_sent')
})

/* ------------------------------------------------------------------ */
/* compileStopReceipt                                                  */
/* ------------------------------------------------------------------ */

test('compileStopReceipt freezes authorization and marks late results evidence-only', () => {
  const stop = compileStopReceipt({
    tenant_id: 'cambium',
    idempotency_key: 'idem-task-001',
    reason: 'operator_stop',
    now: NOW,
  })
  assert.equal(stop.status, 'stopped')
  assert.equal(stop.authorization_frozen, true)
  assert.equal(stop.late_results_policy, 'evidence_only')
  assert.match(stop.stop_digest, /^sha256:[0-9a-f]{64}$/)
})

test('a stopped lifecycle prevents any later authorization request', () => {
  const stop = compileStopReceipt({
    tenant_id: 'cambium',
    idempotency_key: 'idem-task-001',
    reason: 'operator_stop',
    now: NOW,
  })
  const admission = evaluateActionAdmission({
    tenant_id: 'cambium',
    idempotency_key: 'idem-task-001',
    action_digest: DIGEST_A,
    approval_digest: DIGEST_B,
    lifecycle_state: {
      status: stop.status,
      receipt_digest: stop.stop_digest,
    },
    now: NOW,
  })
  assert.equal(admission.decision, 'held')
  assert.equal(admission.authorization_frozen, true)
  assert.equal(admission.may_request_authorization, false)
  assert.equal(admission.authorized, false)
  assert.equal(admission.late_results_policy, 'evidence_only')
})

test('active lifecycle is only eligible for a separate authorization', () => {
  const admission = evaluateActionAdmission({
    tenant_id: 'cambium',
    idempotency_key: 'idem-task-002',
    action_digest: DIGEST_A,
    approval_digest: DIGEST_B,
    lifecycle_state: { status: 'active', receipt_digest: null },
    now: NOW,
  })
  assert.equal(admission.decision, 'eligible_for_separate_authorization')
  assert.equal(admission.may_request_authorization, true)
  assert.equal(admission.authorized, false)
})

test('compileStopReceipt distinguishes stop from pause and cancel-schedule', () => {
  const stop = compileStopReceipt({
    tenant_id: 'cambium',
    idempotency_key: 'idem-x',
    reason: 'operator_stop',
    now: NOW,
  })
  assert.equal(stop.kind, 'stop')
  const pause = compileStopReceipt({
    tenant_id: 'cambium',
    idempotency_key: 'idem-x',
    reason: 'operator_pause',
    kind: 'pause',
    now: NOW,
  })
  assert.equal(pause.kind, 'pause')
  assert.equal(pause.authorization_frozen, false)
  const cancel = compileStopReceipt({
    tenant_id: 'cambium',
    idempotency_key: 'idem-x',
    reason: 'operator_cancel_schedule',
    kind: 'cancel_schedule',
    now: NOW,
  })
  assert.equal(cancel.kind, 'cancel_schedule')
  assert.equal(cancel.authorization_frozen, false)
})

test('compileStopReceipt rejects unknown kind', () => {
  assert.throws(
    () =>
      compileStopReceipt({
        tenant_id: 'cambium',
        idempotency_key: 'idem-x',
        reason: 'x',
        kind: 'delete',
        now: NOW,
      }),
    DotRuntimeError,
  )
})

/* ------------------------------------------------------------------ */
/* reconcileOutcome                                                    */
/* ------------------------------------------------------------------ */

test('reconcileOutcome keys results by idempotency_key', () => {
  const r = reconcileOutcome({
    idempotency_key: 'idem-1',
    known_outcomes: [
      { idempotency_key: 'idem-1', status: 'accepted', receipt_digest: DIGEST_A },
    ],
    now: NOW,
  })
  assert.equal(r.status, 'accepted')
  assert.equal(r.recommend_reissue, false)
})

test('reconcileOutcome reports unknown without recommending reissue', () => {
  const r = reconcileOutcome({
    idempotency_key: 'idem-missing',
    known_outcomes: [],
    now: NOW,
  })
  assert.equal(r.status, 'unknown')
  assert.equal(r.recommend_reissue, false)
  assert.equal(r.recommend_authoritative_readback, true)
})

test('reconcileOutcome is deterministic and ignores duplicate matches beyond first', () => {
  const r1 = reconcileOutcome({
    idempotency_key: 'idem-1',
    known_outcomes: [
      { idempotency_key: 'idem-1', status: 'accepted', receipt_digest: DIGEST_A },
      { idempotency_key: 'idem-1', status: 'rejected', receipt_digest: DIGEST_B },
    ],
    now: NOW,
  })
  const r2 = reconcileOutcome({
    idempotency_key: 'idem-1',
    known_outcomes: [
      { idempotency_key: 'idem-1', status: 'accepted', receipt_digest: DIGEST_A },
      { idempotency_key: 'idem-1', status: 'rejected', receipt_digest: DIGEST_B },
    ],
    now: NOW,
  })
  assert.deepEqual(r1, r2)
  assert.equal(r1.status, 'accepted')
  assert.equal(r1.conflicting_outcomes, 1)
})

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function runCli(payload) {
  const res = spawnSync(process.execPath, [modulePath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  })
  return res
}

test('CLI compiles memory checkpoint from stdin JSON', () => {
  const res = runCli({ op: 'compileMemoryCheckpoint', input: baseMemoryInput() })
  assert.equal(res.status, 0, res.stderr)
  const out = JSON.parse(res.stdout)
  assert.equal(out.tenant_id, 'cambium')
  assert.match(out.checkpoint_digest, /^sha256:[0-9a-f]{64}$/)
})

test('CLI is deterministic across invocations', () => {
  const a = runCli({ op: 'compileMemoryCheckpoint', input: baseMemoryInput() })
  const b = runCli({ op: 'compileMemoryCheckpoint', input: baseMemoryInput() })
  assert.equal(a.stdout, b.stdout)
})

test('CLI exits nonzero with machine-readable error on invalid input', () => {
  const res = runCli({ op: 'compileMemoryCheckpoint', input: { bogus: true } })
  assert.notEqual(res.status, 0)
  const err = JSON.parse(res.stderr || res.stdout)
  assert.equal(err.error, true)
  assert.equal(typeof err.code, 'string')
  assert.equal(typeof err.message, 'string')
})

test('CLI exits nonzero on unknown op', () => {
  const res = runCli({ op: 'nope', input: {} })
  assert.notEqual(res.status, 0)
  const err = JSON.parse(res.stderr || res.stdout)
  assert.equal(err.error, true)
  assert.equal(err.code, 'unknown_op')
})

test('CLI rejects telegram update with machine-readable error', () => {
  const res = runCli({
    op: 'compileUpdate',
    input: {
      channel: 'telegram',
      body_digest: DIGEST_A,
      tenant_id: 'cambium',
      idempotency_key: 'idem-u-t',
      now: NOW,
    },
  })
  assert.notEqual(res.status, 0)
  const err = JSON.parse(res.stderr || res.stdout)
  assert.equal(err.error, true)
  assert.match(err.message, /Hermes/)
})
