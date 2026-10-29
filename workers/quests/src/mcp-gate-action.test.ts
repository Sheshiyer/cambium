import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approveMcpGateAction,
  approveMcpGateActionRequest,
  executeMcpGateAction,
  listPendingMcpGateActionRequests,
  readMcpGateActionApprovalStatus,
  requestMcpGateActionApproval,
  type McpGateActionKv,
} from './mcp-gate-action.ts';

const NOW = '2026-09-30T05:00:00.000Z';
const EXPIRY = '2026-09-30T05:10:00.000Z';
const CHANGE_DIGEST = `sha256:${'a'.repeat(64)}`;

function memoryKv(): McpGateActionKv & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
    async list(prefix) { return [...store.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${Buffer.from(digest).toString('hex')}`;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${canonical(source[key])}`).join(',')}}`;
}

async function fixture() {
  const args = { change_digest: CHANGE_DIGEST };
  const tuple = {
    schema: 'cambium.mcp.action_identity.v1',
    tenant: 'cambium',
    actor: 'founder-openai-subject',
    plugin_identity: 'cambium-openai-plugin',
    mcp_identity: 'https://cortex.thoughtseed.space',
    issuer: 'https://auth.thoughtseed.space',
    action_kind: 'goal-graph.apply-approved-change',
    argument_digest: await sha256(canonical(args)),
    graph_version: 1,
    nonce: `goal-graph-approval:cambium:${'a'.repeat(64)}`,
    expiry: EXPIRY,
    idempotency_key: 'telegram:cambium:message-42',
  };
  return {
    args,
    intent: {
      ...tuple,
      schema: 'cambium.mcp.action_intent.v1' as const,
      action_digest: await sha256(canonical(tuple)),
      status: 'compiled_not_authorized' as const,
      writer_authority: false as const,
      canonical_completion: false as const,
    },
  };
}

test('MCP Gate review request is immutable, idempotent, visible, and non-executing', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  let targetChecks = 0;
  const request = () => requestMcpGateActionApproval(kv, { intent, arguments: args }, {
    now: NOW,
    validateTarget: async (candidate, candidateArgs) => {
      targetChecks++;
      assert.deepEqual(candidate, intent);
      assert.deepEqual(candidateArgs, args);
      return { ok: true };
    },
  });

  const first = await request();
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'awaiting_founder_approval');
  assert.equal(first.body.duplicate, false);
  assert.equal(first.body.action_digest, intent.action_digest);
  assert.match(String(first.body.request_digest), /^sha256:[a-f0-9]{64}$/);
  assert.equal(targetChecks, 1);
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith('mcp-gate-request:')).length, 1);
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith('mcp-gate-action:')).length, 0);

  const replay = await request();
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  assert.equal(replay.body.request_digest, first.body.request_digest);
  assert.equal(targetChecks, 1, 'exact replay returns the stored request before target validation');

  const listed = await listPendingMcpGateActionRequests(kv, 'cambium', NOW);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].request_digest, first.body.request_digest);
  assert.equal(listed[0].intent.action_digest, intent.action_digest);

  const status = await readMcpGateActionApprovalStatus(kv, { intent }, NOW);
  assert.equal(status.status, 200);
  assert.equal(status.body.status, 'awaiting_founder_approval');
  assert.equal(status.body.approval_digest, null);
});

test('MCP Gate review request rejects drift, conflict, and expiry before persistence', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  const tampered = await requestMcpGateActionApproval(kv, {
    intent: { ...intent, action_digest: `sha256:${'f'.repeat(64)}` },
    arguments: args,
  }, { now: NOW, validateTarget: async () => ({ ok: true }) });
  assert.equal(tampered.status, 400);
  assert.equal(tampered.body.error, 'mcp_action_intent_digest_mismatch');

  const expired = await requestMcpGateActionApproval(kv, { intent, arguments: args }, {
    now: '2026-09-30T05:10:00.001Z',
    validateTarget: async () => ({ ok: true }),
  });
  assert.equal(expired.status, 409);
  assert.equal(expired.body.error, 'mcp_action_request_expired');
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith('mcp-gate-request:')).length, 0);
});

test('founder approves a stored review by digests without browser-visible intent arguments', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  const requested = await requestMcpGateActionApproval(kv, { intent, arguments: args }, {
    now: NOW,
    validateTarget: async () => ({ ok: true }),
  });
  const approved = await approveMcpGateActionRequest(kv, {
    action_digest: intent.action_digest,
    request_digest: requested.body.request_digest,
  }, {
    founderId: '200000001',
    now: NOW,
    validateTarget: async (candidate, candidateArgs) => {
      assert.deepEqual(candidate, intent);
      assert.deepEqual(candidateArgs, args);
      return { ok: true };
    },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'approved_not_executed');

  const staleDigest = await approveMcpGateActionRequest(kv, {
    action_digest: intent.action_digest,
    request_digest: `sha256:${'f'.repeat(64)}`,
  }, {
    founderId: '200000001', now: NOW, validateTarget: async () => ({ ok: true }),
  });
  assert.equal(staleDigest.status, 404);
  assert.equal(staleDigest.body.error, 'mcp_action_request_not_found');
});

test('MCP Gate approval persists one founder-signed exact tuple without executing', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  let targetChecks = 0;
  const approved = await approveMcpGateAction(kv, { intent, arguments: args }, {
    founderId: '200000001',
    now: NOW,
    validateTarget: async (candidate, candidateArgs) => {
      targetChecks++;
      assert.deepEqual(candidate, intent);
      assert.deepEqual(candidateArgs, args);
      return { ok: true };
    },
  });

  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'approved_not_executed');
  assert.equal(approved.body.action_digest, intent.action_digest);
  assert.match(String(approved.body.approval_digest), /^sha256:[a-f0-9]{64}$/);
  assert.equal(targetChecks, 1);
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith('mcp-gate-action:')).length, 1);
  assert.equal([...kv.store.keys()].filter((key) => key.startsWith('mcp-gate-idem:')).length, 1);
});

test('MCP Gate approval rejects tuple drift and changed idempotency with no target execution', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  let targetChecks = 0;
  const tampered = await approveMcpGateAction(kv, {
    intent: { ...intent, argument_digest: `sha256:${'b'.repeat(64)}` },
    arguments: args,
  }, {
    founderId: '200000001',
    now: NOW,
    validateTarget: async () => { targetChecks++; return { ok: true }; },
  });
  assert.equal(tampered.status, 400);
  assert.equal(tampered.body.error, 'mcp_action_intent_digest_mismatch');
  assert.equal(targetChecks, 0);

  const first = await approveMcpGateAction(kv, { intent, arguments: args }, {
    founderId: '200000001', now: NOW, validateTarget: async () => ({ ok: true }),
  });
  assert.equal(first.status, 200);
  const other = await fixture();
  const conflictingIntent = {
    ...other.intent,
    actor: 'other-founder-subject',
  };
  const identityTuple = { ...conflictingIntent, schema: 'cambium.mcp.action_identity.v1' } as Record<string, unknown>;
  delete identityTuple.action_digest;
  delete identityTuple.status;
  delete identityTuple.writer_authority;
  delete identityTuple.canonical_completion;
  conflictingIntent.action_digest = await sha256(canonical(identityTuple));
  const conflict = await approveMcpGateAction(kv, { intent: conflictingIntent, arguments: args }, {
    founderId: '200000001', now: NOW, validateTarget: async () => ({ ok: true }),
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'mcp_action_idempotency_conflict');
});

test('MCP Gate execute commits once and returns the original receipt on replay', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  const approved = await approveMcpGateAction(kv, { intent, arguments: args }, {
    founderId: '200000001', now: NOW, validateTarget: async () => ({ ok: true }),
  });
  const approvalDigest = String(approved.body.approval_digest);
  let mutations = 0;
  const execute = () => executeMcpGateAction(kv, {
    schema: 'cambium.mcp.gate_action_request.v1',
    intent,
    approval_digest: approvalDigest,
  }, {
    now: NOW,
    executeTarget: async (candidate, candidateArgs, founderId) => {
      mutations++;
      assert.deepEqual(candidate, intent);
      assert.deepEqual(candidateArgs, args);
      assert.equal(founderId, '200000001');
      return { ok: true, status: 'committed', terminalOutcome: `goal_graph_committed:${'c'.repeat(64)}` };
    },
  });

  const first = await execute();
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'committed');
  assert.equal((first.body.receipt as Record<string, unknown>).mutation_count, 1);
  assert.equal(mutations, 1);

  const replay = await execute();
  assert.equal(replay.status, 200);
  assert.equal(replay.body.status, 'duplicate');
  assert.deepEqual(replay.body.receipt, first.body.receipt);
  assert.equal(mutations, 1);

  const approvalReplay = await approveMcpGateAction(kv, { intent, arguments: args }, {
    founderId: '200000001',
    now: '2026-09-30T05:01:00.000Z',
    validateTarget: async () => { throw new Error('an existing exact approval must replay before target validation'); },
  });
  assert.equal(approvalReplay.status, 200);
  assert.equal(approvalReplay.body.status, 'already_executed');
  assert.equal(approvalReplay.body.approval_digest, approvalDigest);
});

test('MCP Gate execute rejects wrong approval, tuple drift, and expiry before mutation', async () => {
  const kv = memoryKv();
  const { args, intent } = await fixture();
  const approved = await approveMcpGateAction(kv, { intent, arguments: args }, {
    founderId: '200000001', now: NOW, validateTarget: async () => ({ ok: true }),
  });
  let mutations = 0;
  const options = {
    now: NOW,
    executeTarget: async () => { mutations++; return { ok: true as const, status: 'committed' as const, terminalOutcome: 'accepted' }; },
  };
  const unknown = await executeMcpGateAction(kv, {
    schema: 'cambium.mcp.gate_action_request.v1', intent, approval_digest: `sha256:${'f'.repeat(64)}`,
  }, options);
  assert.equal(unknown.status, 404);

  const drifted = await executeMcpGateAction(kv, {
    schema: 'cambium.mcp.gate_action_request.v1',
    intent: { ...intent, nonce: 'different-safe-nonce' },
    approval_digest: String(approved.body.approval_digest),
  }, options);
  assert.equal(drifted.status, 409);
  assert.equal(drifted.body.error, 'mcp_action_approval_mismatch');

  const expired = await executeMcpGateAction(kv, {
    schema: 'cambium.mcp.gate_action_request.v1', intent, approval_digest: String(approved.body.approval_digest),
  }, { ...options, now: '2026-09-30T05:10:00.001Z' });
  assert.equal(expired.status, 409);
  assert.equal(expired.body.error, 'mcp_action_approval_expired');
  assert.equal(mutations, 0);
});
