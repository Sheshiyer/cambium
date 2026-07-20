import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MARKETING_CREATE_ADAPTER_ID,
  MARKETING_CREATE_CATALOG_DIGEST,
  MARKETING_CREATE_EXPECTED_ACTIVATION,
  MARKETING_CREATE_MODEL,
  MARKETING_CREATE_PROVIDER_URL,
  MARKETING_CREATE_RECIPE_ID,
  MARKETING_CREATE_SECRET_BINDING,
  MARKETING_CREATE_TENANT_ID,
  MARKETING_PROMPT_TEMPLATE_DIGEST,
  MarketingRendererError,
  canonicalMarketingJson,
  executeMarketingRender,
  parseMarketingExecuteInput,
  parseMarketingPrepareInput,
  prepareMarketingRender,
  sha256MarketingHex,
  validateMarketingApproval,
} from './marketing-renderer.ts';
import type {
  MarketingApprovalDecision,
  MarketingPreparedRender,
  MarketingRenderClaimInput,
  MarketingRenderClaimResult,
  MarketingRenderStoreLike,
} from './marketing-renderer.ts';

const DIGEST = {
  catalog: MARKETING_CREATE_CATALOG_DIGEST,
  product: '2'.repeat(64),
  evidence: '3'.repeat(64),
  seed: '4'.repeat(64),
  source: '5'.repeat(64),
};

const NOW = '2026-07-18T13:00:00.000Z';
const EXPIRES = '2026-07-18T14:00:00.000Z';

function validPrepareInput() {
  return {
    requestId: 'marketing-render-request-001',
    idempotencyKey: 'marketing-render-replay-001',
    actorId: 'operator-founder-001',
    budgetReservationId: 'budget-founder-article-001',
    expiresAt: EXPIRES,
    brief: {
      briefId: 'asset-brief-founder-001',
      objective: 'Explain how governed organic media earns trust.',
      audience: 'Founder-led service businesses',
      callToAction: 'Review the workflow before adopting it.',
      productPacketId: 'thoughtseed-marketing@1.0.0',
      productPacketDigest: DIGEST.product,
      evidenceSnapshotDigest: DIGEST.evidence,
      seedDigest: DIGEST.seed,
      facts: [
        {
          claimId: 'claim-governance-001',
          text: 'Every generated asset remains review-only until explicit approval.',
          sourceDigest: DIGEST.source,
        },
      ],
    },
  };
}

function approvalFor(prepared: MarketingPreparedRender, overrides: Partial<MarketingApprovalDecision> = {}): MarketingApprovalDecision {
  return {
    schema_version: 'approval_decision@1.0.0',
    tenant: {
      tenant_id: 'thoughtseed',
      purpose: 'marketing_create_render',
      data_classification: 'public_business',
      processing_region: 'global',
      retention_days: 30,
    },
    record_id: 'approval-marketing-render-001',
    action_request_id: prepared.requestId,
    action_digest: prepared.actionDigest,
    approver_id: 'telegram-founder-12345',
    scope: 'exact_action',
    decision: 'approved',
    decided_at: NOW,
    expires_at: EXPIRES,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

interface MemoryStoreOptions {
  claimResult?: MarketingRenderClaimResult;
  beginResult?: 'confirmed' | 'reconciliation_required';
}

function memoryStore(prepared: MarketingPreparedRender, approval: MarketingApprovalDecision, options: MemoryStoreOptions = {}) {
  const calls: Array<{ name: string; value?: unknown }> = [];
  const artifact = {
    schema_version: 'asset_draft@1.0.0',
    tenant: {
      tenant_id: 'thoughtseed',
      purpose: 'marketing_create_render',
      data_classification: 'public_business',
      processing_region: 'global',
      retention_days: 30,
    },
    record_id: 'asset-draft-replay-001',
    brief_id: prepared.input.brief.briefId,
    recipe_id: MARKETING_CREATE_RECIPE_ID,
    title: 'Stored title',
    body: 'Stored body',
    claim_ids: ['claim-governance-001'],
    evidence_snapshot_digest: DIGEST.evidence,
    rights_state: 'review_required',
    status: 'draft',
    created_at: NOW,
    content_digest: '6'.repeat(64),
  } as const;
  const receipt = {
    schema_version: 'operator_receipt@1.0.0',
    tenant: artifact.tenant,
    record_id: 'receipt-marketing-render-001',
    task_id: prepared.requestId,
    state: 'awaiting_human_approval',
    artifact_count: 1,
    next_action: 'review',
    replayed: true,
    redaction_applied: true,
    updated_at: NOW,
  } as const;
  const claimResult = options.claimResult ?? {
    status: 'claimed',
    requestId: prepared.requestId,
    claimId: 'claim-render-001',
    fencingToken: 1,
    leaseExpiresAt: '2026-07-18T13:05:00.000Z',
  } as const;

  const store: MarketingRenderStoreLike = {
    async prepare(record) {
      calls.push({ name: 'prepare', value: record });
      return { status: 'prepared', record };
    },
    async getPrepared(requestId) {
      calls.push({ name: 'getPrepared', value: requestId });
      return requestId === prepared.requestId ? prepared : null;
    },
    async approvePrepared(input) {
      calls.push({ name: 'approvePrepared', value: input });
      return { status: 'approved', approval };
    },
    async getApproval(approvalDecisionId) {
      calls.push({ name: 'getApproval', value: approvalDecisionId });
      return approvalDecisionId === approval.record_id ? approval : null;
    },
    async claim(input: MarketingRenderClaimInput) {
      calls.push({ name: 'claim', value: input });
      return claimResult;
    },
    async beginInvocation(input) {
      calls.push({ name: 'beginInvocation', value: input });
      return options.beginResult ?? 'confirmed';
    },
    async complete(input) {
      calls.push({ name: 'complete', value: input });
      return 'recorded';
    },
    async fail(input) {
      calls.push({ name: 'fail', value: input });
      return 'recorded';
    },
    async markIndeterminate(input) {
      calls.push({ name: 'markIndeterminate', value: input });
      return 'recorded';
    },
  };
  return { store, calls, artifact, receipt };
}

async function preparedFixture(): Promise<MarketingPreparedRender> {
  return prepareMarketingRender(validPrepareInput(), { now: () => NOW });
}

test('pins one tenant, adapter, recipe, provider, model, secret, and prompt digest', () => {
  assert.equal(MARKETING_CREATE_TENANT_ID, 'thoughtseed');
  assert.equal(MARKETING_CREATE_ADAPTER_ID, 'founder-article-nvidia@1.0.0');
  assert.equal(MARKETING_CREATE_RECIPE_ID, 'founder-article-draft@1.0.0');
  assert.equal(MARKETING_CREATE_PROVIDER_URL, 'https://integrate.api.nvidia.com/v1/chat/completions');
  assert.equal(MARKETING_CREATE_MODEL, 'meta/llama-3.1-70b-instruct');
  assert.equal(MARKETING_CREATE_SECRET_BINDING, 'NVIDIA_MARKETING_CREATE_API_KEY');
  assert.equal(MARKETING_PROMPT_TEMPLATE_DIGEST, 'd1d1db81ae9b1eaeb9ba3f799a9a7fdeb61e87bc2805fdab4b29761274963a80');
  assert.equal(MARKETING_CREATE_CATALOG_DIGEST, 'ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f');
  assert.equal(
    MARKETING_CREATE_EXPECTED_ACTIVATION,
    'founder-article-nvidia@1.0.0:ae1d60e951f6d6c18041581ddb018b53b162ebfb49bf9370f3185c38e03fc12f',
  );
});

test('prepare input parser accepts one bounded public-business brief', () => {
  const parsed = parseMarketingPrepareInput(validPrepareInput());
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.brief.facts.length, 1);
});

test('prepare input parser matches the committed catalog boundaries exactly', () => {
  const uppercaseReplay = parseMarketingPrepareInput({
    ...validPrepareInput(),
    idempotencyKey: 'ReplayA1',
    brief: {
      ...validPrepareInput().brief,
      objective: 'o'.repeat(512),
      audience: 'a'.repeat(256),
      callToAction: 'c'.repeat(256),
      productPacketId: 'packet@custom',
      facts: [{
        claimId: 'claim-boundary-001',
        text: 'f'.repeat(1000),
        sourceDigest: DIGEST.source,
      }],
    },
  });
  assert.equal(uppercaseReplay.ok, true);
  assert.equal(parseMarketingPrepareInput({ ...validPrepareInput(), requestId: 'bad@request' }).ok, false);
  assert.equal(parseMarketingPrepareInput({ ...validPrepareInput(), idempotencyKey: 'short' }).ok, false);
  for (const [field, length] of [['objective', 513], ['audience', 257], ['callToAction', 257]] as const) {
    const brief = { ...validPrepareInput().brief, [field]: 'x'.repeat(length) };
    assert.equal(parseMarketingPrepareInput({ ...validPrepareInput(), brief }).ok, false, field);
  }
  const tooLongFact = {
    ...validPrepareInput().brief,
    facts: [{ claimId: 'claim-boundary-001', text: 'f'.repeat(1001), sourceDigest: DIGEST.source }],
  };
  assert.equal(parseMarketingPrepareInput({ ...validPrepareInput(), brief: tooLongFact }).ok, false);
});

test('preparation ignores injected catalog digests and pins the committed digest', async () => {
  const prepared = await prepareMarketingRender(validPrepareInput(), {
    now: () => NOW,
    catalogDigest: '9'.repeat(64),
  } as any);
  assert.equal(prepared.adapterCatalogDigest, MARKETING_CREATE_CATALOG_DIGEST);
  assert.equal(prepared.action.adapterCatalogDigest, MARKETING_CREATE_CATALOG_DIGEST);
});

test('prepare input parser rejects every caller-owned routing override', () => {
  for (const key of ['tenant', 'tenantId', 'provider', 'model', 'baseUrl', 'endpoint', 'prompt', 'messages', 'apiKey', 'credential', 'temperature', 'maxTokens']) {
    const parsed = parseMarketingPrepareInput({ ...validPrepareInput(), [key]: 'override' });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_prepare_input', reason: `unknown field: ${key}` });
  }
});

test('execute input parser accepts only one persisted approval identifier', () => {
  assert.deepEqual(parseMarketingExecuteInput({ approvalDecisionId: 'approval-marketing-render-001' }), {
    ok: true,
    value: { approvalDecisionId: 'approval-marketing-render-001' },
  });
  for (const key of ['approval', 'tenantId', 'provider', 'model', 'prompt', 'apiKey']) {
    const parsed = parseMarketingExecuteInput({ approvalDecisionId: 'approval-marketing-render-001', [key]: {} });
    assert.deepEqual(parsed, { ok: false, code: 'invalid_execute_input', reason: `unknown field: ${key}` });
  }
});

test('prepared action binds every immutable execution input without secret values', async () => {
  const prepared = await preparedFixture();
  assert.deepEqual(prepared.action, {
    schema: 'thoughtseed.marketing-render-action.v1',
    tenantId: 'thoughtseed',
    requestId: 'marketing-render-request-001',
    adapterId: MARKETING_CREATE_ADAPTER_ID,
    adapterCatalogDigest: DIGEST.catalog,
    recipeId: MARKETING_CREATE_RECIPE_ID,
    providerId: 'nvidia',
    providerUrl: MARKETING_CREATE_PROVIDER_URL,
    model: MARKETING_CREATE_MODEL,
    generation: { stream: false, temperature: 0.2, maxTokens: 1800 },
    promptTemplateId: 'thoughtseed-founder-article@1.0.0',
    promptTemplateDigest: MARKETING_PROMPT_TEMPLATE_DIGEST,
    inputDigest: prepared.inputDigest,
    evidenceSnapshotDigest: DIGEST.evidence,
    productPacketDigest: DIGEST.product,
    budgetReservationId: 'budget-founder-article-001',
    actorId: 'operator-founder-001',
    idempotencyKey: 'marketing-render-replay-001',
    expiresAt: EXPIRES,
    credentialDescriptor: { kind: 'cloudflare_worker_secret', binding: MARKETING_CREATE_SECRET_BINDING },
  });
  assert.equal(prepared.actionDigest, await sha256MarketingHex(canonicalMarketingJson(prepared.action)));
  assert.doesNotMatch(JSON.stringify(prepared), /Bearer|provider-secret-value/i);
  assert.equal(prepared.action.credentialDescriptor.binding, MARKETING_CREATE_SECRET_BINDING);
});

test('every immutable action field contributes to its exact digest', async () => {
  const prepared = await preparedFixture();
  const original = prepared.actionDigest;
  const mutations: Array<[string, (value: any) => void]> = [
    ['tenant', (value) => { value.tenantId = 'other'; }],
    ['request', (value) => { value.requestId = 'other-request'; }],
    ['adapter', (value) => { value.adapterId = 'other@1.0.0'; }],
    ['catalog', (value) => { value.adapterCatalogDigest = '9'.repeat(64); }],
    ['recipe', (value) => { value.recipeId = 'other@1.0.0'; }],
    ['provider', (value) => { value.providerId = 'other'; }],
    ['url', (value) => { value.providerUrl = 'https://example.invalid/v1'; }],
    ['model', (value) => { value.model = 'other/model'; }],
    ['generation', (value) => { value.generation.maxTokens = 1799; }],
    ['prompt', (value) => { value.promptTemplateDigest = '8'.repeat(64); }],
    ['input', (value) => { value.inputDigest = '7'.repeat(64); }],
    ['evidence', (value) => { value.evidenceSnapshotDigest = '6'.repeat(64); }],
    ['product', (value) => { value.productPacketDigest = '5'.repeat(64); }],
    ['budget', (value) => { value.budgetReservationId = 'other-budget'; }],
    ['actor', (value) => { value.actorId = 'other-actor'; }],
    ['idempotency', (value) => { value.idempotencyKey = 'other-replay'; }],
    ['expiry', (value) => { value.expiresAt = '2026-07-18T15:00:00.000Z'; }],
    ['credential descriptor', (value) => { value.credentialDescriptor.binding = 'OTHER_SECRET'; }],
  ];
  for (const [label, mutate] of mutations) {
    const changed = structuredClone(prepared.action);
    mutate(changed);
    assert.notEqual(await sha256MarketingHex(canonicalMarketingJson(changed)), original, label);
  }
});

test('approval validator requires persisted exact approved unexpired authority', async () => {
  const prepared = await preparedFixture();
  assert.equal(validateMarketingApproval(prepared, approvalFor(prepared), NOW), null);
  assert.equal(validateMarketingApproval(prepared, approvalFor(prepared, { action_digest: '9'.repeat(64) }), NOW), 'approval_action_digest_mismatch');
  assert.equal(validateMarketingApproval(prepared, approvalFor(prepared, { action_request_id: 'other-request' }), NOW), 'approval_request_mismatch');
  assert.equal(validateMarketingApproval(prepared, approvalFor(prepared, { decision: 'rejected' }), NOW), 'approval_rejected');
  assert.equal(validateMarketingApproval(prepared, approvalFor(prepared, { expires_at: '2026-07-18T12:59:59.000Z' }), NOW), 'approval_expired');
});

test('activation mismatch refuses before store access or provider egress', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  let fetches = 0;
  await assert.rejects(
    executeMarketingRender(prepared.requestId, approval.record_id, {
      store,
      activation: 'wrong',
      apiKey: 'provider-secret-value',
      fetchImpl: async () => { fetches++; return jsonResponse({}); },
      now: () => NOW,
      uuid: () => 'claim-render-001',
    }),
    (error: unknown) => error instanceof MarketingRendererError && error.code === 'renderer_disabled',
  );
  assert.equal(calls.length, 0);
  assert.equal(fetches, 0);
});

test('colluding alternate activation values cannot redefine the committed adapter', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  const alternate = `${MARKETING_CREATE_ADAPTER_ID}:${'9'.repeat(64)}`;
  let fetches = 0;
  await assert.rejects(
    executeMarketingRender(prepared.requestId, approval.record_id, {
      store,
      activation: alternate,
      expectedActivation: alternate,
      apiKey: 'provider-secret-value',
      fetchImpl: async () => {
        fetches += 1;
        return jsonResponse({ choices: [{ message: { content: JSON.stringify({ title: 'Title', body: 'Body' }) } }] });
      },
      now: () => NOW,
      uuid: () => 'claim-render-001',
    } as any),
    (error: unknown) => error instanceof MarketingRendererError && error.code === 'renderer_disabled',
  );
  assert.equal(calls.length, 0);
  assert.equal(fetches, 0);
});

test('missing exclusive Worker secret refuses before provider egress', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store } = memoryStore(prepared, approval);
  let fetches = 0;
  await assert.rejects(
    executeMarketingRender(prepared.requestId, approval.record_id, {
      store,
      activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
      fetchImpl: async () => { fetches++; return jsonResponse({}); },
      now: () => NOW,
      uuid: () => 'claim-render-001',
    }),
    (error: unknown) => error instanceof MarketingRendererError && error.code === 'renderer_secret_missing',
  );
  assert.equal(fetches, 0);
});

test('authorized execution performs one fixed provider call and stores review-only output', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  const providerSecret = 'provider-secret-value';
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: providerSecret,
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      return jsonResponse({ choices: [{ message: { content: JSON.stringify({ title: 'Governed organic media', body: 'A review-only article grounded in verified facts.' }) } }], usage: { total_tokens: 321 } });
    },
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, MARKETING_CREATE_PROVIDER_URL);
  assert.equal((fetchCalls[0].init?.headers as Record<string, string>).authorization, `Bearer ${providerSecret}`);
  const upstreamBody = JSON.parse(String(fetchCalls[0].init?.body));
  assert.equal(upstreamBody.model, MARKETING_CREATE_MODEL);
  assert.equal(upstreamBody.stream, false);
  assert.equal(upstreamBody.temperature, 0.2);
  assert.equal(upstreamBody.max_tokens, 1800);
  assert.equal(result.status, 'succeeded');
  if (result.status !== 'succeeded') return;
  assert.equal(result.artifact.status, 'draft');
  assert.equal(result.receipt.state, 'awaiting_human_approval');
  assert.equal(result.receipt.next_action, 'review');
  assert.equal(result.adapterId, MARKETING_CREATE_ADAPTER_ID);
  assert.equal(result.artifactDigest, result.artifact.content_digest);
  assert.equal(result.publishEligible, false);
  assert.equal(result.externalAction, 'none');
  assert.doesNotMatch(JSON.stringify({ result, calls }), new RegExp(providerSecret));
  assert.deepEqual(calls.map(({ name }) => name), ['getPrepared', 'getApproval', 'claim', 'beginInvocation', 'complete']);
});

test('completed replay returns stored output without another provider call', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const base = memoryStore(prepared, approval);
  const replay = memoryStore(prepared, approval, {
    claimResult: {
      status: 'terminal',
      outcome: 'succeeded',
      artifact: base.artifact,
      receipt: base.receipt,
    },
  });
  let fetches = 0;
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store: replay.store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => { fetches++; return jsonResponse({}); },
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.equal(result.status, 'succeeded');
  if (result.status === 'succeeded') assert.equal(result.replayed, true);
  assert.equal(fetches, 0);
});

test('busy claims suppress provider egress', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store } = memoryStore(prepared, approval, { claimResult: { status: 'busy', retryAfterMs: 5000 } });
  let fetches = 0;
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => { fetches++; return jsonResponse({}); },
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.deepEqual(result, { status: 'busy', retryAfterMs: 5000 });
  assert.equal(fetches, 0);
});

test('ambiguous invoking transition suppresses provider egress', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store } = memoryStore(prepared, approval, { beginResult: 'reconciliation_required' });
  let fetches = 0;
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => { fetches++; return jsonResponse({}); },
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.deepEqual(result, { status: 'reconciliation_required', code: 'invoking_not_confirmed' });
  assert.equal(fetches, 0);
});

test('invoking replay requires reconciliation without provider egress', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store } = memoryStore(prepared, approval, { claimResult: { status: 'reconciliation_required', state: 'invoking' } });
  let fetches = 0;
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => { fetches++; return jsonResponse({}); },
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.deepEqual(result, { status: 'reconciliation_required', code: 'invoking' });
  assert.equal(fetches, 0);
});

test('provider fetch exception records an indeterminate non-retryable outcome', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => { throw new Error('provider leaked raw diagnostics'); },
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.deepEqual(result, { status: 'reconciliation_required', code: 'provider_outcome_indeterminate' });
  const indeterminate = calls.find(({ name }) => name === 'markIndeterminate');
  assert.ok(indeterminate);
  assert.doesNotMatch(JSON.stringify(indeterminate), /leaked raw diagnostics/);
});

test('the fixed timeout remains armed through bounded provider body consumption', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store } = memoryStore(prepared, approval);
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let timeoutActive = false;
  let timeoutCallback: (() => void) | undefined;
  let abortObserved = false;
  globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
    assert.equal(delay, 30_000);
    timeoutActive = true;
    timeoutCallback = callback as () => void;
    return 1 as any;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((_: any) => {
    timeoutActive = false;
  }) as typeof clearTimeout;
  try {
    const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
      store,
      activation: MARKETING_CREATE_EXPECTED_ACTIVATION,
      apiKey: 'provider-secret-value',
      fetchImpl: async (_url, init) => {
        const signal = init?.signal as AbortSignal;
        return new Response(new ReadableStream({
          pull(controller) {
            if (timeoutActive) timeoutCallback?.();
            abortObserved = signal.aborted;
            controller.error(new Error('simulated bounded body interruption'));
          },
        }, { highWaterMark: 0 }), { status: 200 });
      },
      now: () => NOW,
      uuid: () => 'claim-render-001',
    });
    assert.deepEqual(result, { status: 'failed', code: 'provider_response_timeout' });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
  assert.equal(abortObserved, true);
  assert.equal(timeoutActive, false);
});

test('a fetch timeout records a classified indeterminate outcome without retry', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let fetches = 0;
  globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
    assert.equal(delay, 30_000);
    queueMicrotask(callback as () => void);
    return 1 as any;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((_: any) => undefined) as typeof clearTimeout;
  try {
    const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
      store,
      activation: MARKETING_CREATE_EXPECTED_ACTIVATION,
      apiKey: 'provider-secret-value',
      fetchImpl: async (_url, init) => {
        fetches += 1;
        return new Promise<Response>((_resolve, reject) => {
          (init?.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      },
      now: () => NOW,
      uuid: () => 'claim-render-001',
    });
    assert.deepEqual(result, { status: 'reconciliation_required', code: 'provider_timeout_indeterminate' });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
  assert.equal(fetches, 1);
  assert.equal(calls.filter(({ name }) => name === 'markIndeterminate').length, 1);
  assert.equal((calls.find(({ name }) => name === 'markIndeterminate')?.value as any).errorCode, 'provider_timeout_indeterminate');
});

test('oversized provider response records a bounded terminal failure', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => new Response('x'.repeat(65_537), { status: 200 }),
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.deepEqual(result, { status: 'failed', code: 'provider_response_too_large' });
  const failure = calls.find(({ name }) => name === 'fail');
  assert.ok(failure);
  assert.ok(JSON.stringify(failure).length < 1000);
});

test('malformed provider content records a classified terminal failure', async () => {
  const prepared = await preparedFixture();
  const approval = approvalFor(prepared);
  const { store, calls } = memoryStore(prepared, approval);
  const result = await executeMarketingRender(prepared.requestId, approval.record_id, {
    store,
    activation: `${MARKETING_CREATE_ADAPTER_ID}:${DIGEST.catalog}`,
    apiKey: 'provider-secret-value',
    fetchImpl: async () => jsonResponse({ choices: [] }),
    now: () => NOW,
    uuid: () => 'claim-render-001',
  });
  assert.deepEqual(result, { status: 'failed', code: 'provider_response_invalid' });
  assert.ok(calls.some(({ name }) => name === 'fail'));
});
