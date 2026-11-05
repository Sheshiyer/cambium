import assert from 'node:assert/strict';
import test from 'node:test';

import { handle, type HandlerDeps, type KvLike } from './handler.ts';
import { approveMcpGateActionRequest } from './mcp-gate-action.ts';

const NOW = '2026-10-30T12:00:00.000Z';
const EXPIRY = '2026-10-30T12:15:00.000Z';
const TOKEN = 'adapter-token';
const CHANGE = `sha256:${'a'.repeat(64)}`;
const APPROVAL = `sha256:${'b'.repeat(64)}`;

function memoryKv(): KvLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
    async list(prefix) { return [...store.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${canonical(source[key])}`).join(',')}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${Buffer.from(digest).toString('hex')}`;
}

async function compiled(changeDigest = CHANGE, nonce = 'gate-nonce-0007', idempotencyKey = 'telegram-cambium-message-42') {
  const args = { change_digest: changeDigest };
  const tuple = {
    schema: 'cambium.mcp.action_identity.v1',
    tenant: 'cambium',
    actor: 'founder-openai-subject',
    plugin_identity: 'cambium-openai-plugin',
    mcp_identity: 'https://cortex.thoughtseed.space',
    issuer: 'https://auth.thoughtseed.space',
    action_kind: 'goal-graph.apply-approved-change',
    argument_digest: await sha256(canonical(args)),
    graph_version: 7,
    nonce,
    expiry: EXPIRY,
    idempotency_key: idempotencyKey,
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

function pendingTask(intent: Awaited<ReturnType<typeof compiled>>['intent'], changeDigest = CHANGE) {
  return {
    schema: 'cambium.goal-graph-intake-task.v1',
    tenantId: intent.tenant,
    status: 'pending',
    changeDigest,
    approvalNonce: intent.nonce,
    approvalExpiresAt: intent.expiry,
    graphVersion: intent.graph_version,
    idempotencyKey: intent.idempotency_key,
  };
}

function deps(kv: KvLike, extra: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    kv,
    now: () => NOW,
    mcpGateAdapterToken: TOKEN,
    ...extra,
  };
}

function post(path: string, body: unknown, token?: string) {
  return {
    method: 'POST',
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  };
}

test('MCP Gate adapter routes require the dedicated bearer and a pending goal-graph target', async () => {
  const kv = memoryKv();
  const { args, intent } = await compiled();
  await kv.put(`goal-graph-intake-task:cambium:${CHANGE}`, JSON.stringify(pendingTask(intent)));
  const bound = deps(kv);

  const unconfigured = await handle(post('/mcp/actions/request-approval', { intent, arguments: args }, TOKEN), deps(kv, { mcpGateAdapterToken: undefined }));
  assert.equal(unconfigured.status, 503);
  assert.equal(JSON.parse(String(unconfigured.body)).error, 'mcp_gate_adapter_unconfigured');

  const unauthorized = await handle(post('/mcp/actions/request-approval', { intent, arguments: args }, 'other-token'), bound);
  assert.equal(unauthorized.status, 401);
  assert.equal(JSON.parse(String(unauthorized.body)).error, 'mcp_gate_adapter_unauthorized');

  const method = await handle({ method: 'GET', path: '/mcp/actions/execute', headers: { authorization: `Bearer ${TOKEN}` } }, bound);
  assert.equal(method.status, 405);

  const requested = await handle(post('/mcp/actions/request-approval', { intent, arguments: args }, TOKEN), bound);
  assert.equal(requested.status, 200);
  const requestedBody = JSON.parse(String(requested.body));
  assert.equal(requestedBody.status, 'awaiting_founder_approval');
  assert.equal(requestedBody.duplicate, false);
  assert.equal(requestedBody.action_digest, intent.action_digest);

  const drifted = await compiled(CHANGE, 'gate-nonce-9999', 'telegram-cambium-message-43');
  const mismatch = await handle(post('/mcp/actions/request-approval', { intent: drifted.intent, arguments: drifted.args }, TOKEN), bound);
  assert.equal(mismatch.status, 409);
  assert.equal(JSON.parse(String(mismatch.body)).error, 'mcp_action_target_mismatch');

  const missing = await compiled(`sha256:${'d'.repeat(64)}`, 'gate-nonce-0008', 'telegram-cambium-message-44');
  const absent = await handle(post('/mcp/actions/request-approval', { intent: missing.intent, arguments: missing.args }, TOKEN), bound);
  assert.equal(absent.status, 404);
  assert.equal(JSON.parse(String(absent.body)).error, 'mcp_action_target_not_found');

  const approved = await approveMcpGateActionRequest(kv, {
    action_digest: intent.action_digest,
    request_digest: requestedBody.request_digest,
  }, {
    founderId: '1371522080',
    now: NOW,
    validateTarget: async () => ({ ok: true }),
  });
  assert.equal(approved.status, 200);

  const executed = await handle(post('/mcp/actions/execute', {
    schema: 'cambium.mcp.gate_action_request.v1',
    intent,
    approval_digest: approved.body.approval_digest,
  }, TOKEN), bound);
  assert.equal(executed.status, 503);
  assert.equal(JSON.parse(String(executed.body)).error, 'goal graph authority is not configured');
  const stored = JSON.parse((await kv.get(`mcp-gate-action:${String(approved.body.approval_digest).slice('sha256:'.length)}`)) ?? '{}');
  assert.equal(stored.status, 'approved');
});

test('an expired committed MCP action replays its receipt before a new goal-graph write', async () => {
  const kv = memoryKv();
  const { args, intent } = await compiled();
  await kv.put(`mcp-gate-action:${APPROVAL.slice('sha256:'.length)}`, JSON.stringify({
    schema: 'cambium.gate.action_approval_record.v1',
    status: 'committed',
    founder_id: '1371522080',
    approved_at: NOW,
    approval_digest: APPROVAL,
    intent,
    arguments: args,
    receipt: { receipt_digest: `sha256:${'c'.repeat(64)}`, terminal_outcome: 'goal-graph.apply-approved-change' },
  }));
  let touched = false;
  const response = await handle(post('/mcp/actions/execute', {
    schema: 'cambium.mcp.gate_action_request.v1',
    intent,
    approval_digest: APPROVAL,
  }, TOKEN), deps(kv, {
    now: () => '2026-10-30T12:16:00.000Z',
    goalGraphStore: new Proxy({}, { get() { touched = true; throw new Error('duplicate replay must not open the goal graph'); } }) as HandlerDeps['goalGraphStore'],
  }));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(String(response.body)).status, 'duplicate');
  assert.equal(touched, false);
});

test('approve-mcp-action is a Telegram gate kind addressed by action digest', async () => {
  const kv = memoryKv();
  const gate = { botId: '1', pubKeyHex: 'ab'.repeat(32), founderIds: ['1371522080'] };
  const unsigned = await handle(post('/api/gate/cambium', {
    kind: 'approve-mcp-action',
    action_digest: CHANGE,
    request_digest: APPROVAL,
  }), deps(kv, { gate }));
  assert.equal(unsigned.status, 401);

  const bare = await handle(post('/api/gate/cambium', { kind: 'approve-mcp-action' }), deps(kv, { gate }));
  assert.equal(bare.status, 400);
  assert.equal(JSON.parse(String(bare.body)).error, 'need a supported gate kind and subject');
});
