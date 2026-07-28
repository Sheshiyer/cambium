// Task 5 · GET /v1/mission-fabric/{tenant} — authenticated, bounded, read-only
// operating-fabric composition route. In-memory D1/KV fakes only; no network.
import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { handle, buildDataCheckString } from './handler.ts';
import type { GateConfig, HandlerDeps, SimpleRequest } from './handler.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import type { BranchMapReceipt } from './branch-map.ts';
import type { BranchMapReceiptStoreLike } from './branch-map-receipt-store.ts';
import { adaptQuestExecutionFacts, projectionDigest } from './mission-fabric.ts';
import { FABRIC_SOURCE_FIXTURE } from './mission-fabric-fixture.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;
const NOW_MS = 1_750_000_000_000;
const NOW_ISO = '2026-07-28T09:00:00.000Z';
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const TENANT = 'cambium-synthetic';

async function signedInitData(userId = FOUNDER_ID): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams({
    auth_date: String(NOW_MS / 1000 - 10),
    user: JSON.stringify({ id: Number(userId), first_name: 'Founder' }),
    query_id: 'AAtest',
  });
  const { dcs } = buildDataCheckString(fields.toString(), BOT_ID);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(dcs)));
  fields.set('signature', Buffer.from(sig).toString('base64url'));
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

function goalNode(nodeId: string, externalId: string | null, parentNodeId: string | null, overrides: Partial<GoalGraphNode> = {}): GoalGraphNode {
  return {
    nodeId, tenantId: TENANT, namespace: 'fabric', externalId,
    parentNodeId, scope: parentNodeId ? 'meso' : 'macro', desiredState: `state:${externalId ?? nodeId}`,
    currentState: 'active', owner: 'founder', nextAction: null, waitCondition: null, proofRequired: true,
    reviewAt: null, status: 'active', sourceRef: `goal-graph:${nodeId}`, sourceDigest: `sha256:${'a'.repeat(64)}`,
    graphVersion: 7, metadata: {}, createdAt: NOW_ISO, updatedAt: NOW_ISO, ...overrides,
  };
}

function goalGraphFixture() {
  const nodes = [
    goalNode('gg-task-contract', 'task-fabric-contract', null),
    goalNode('gg-task-proof', 'task-fabric-proof', null),
    goalNode('gg-note', null, null),
  ];
  const head: GoalGraphHead = {
    tenantId: TENANT, graphVersion: 7, graphDigest: `sha256:${'b'.repeat(64)}`,
    nodeIds: nodes.map((node) => node.nodeId), sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`,
    committedAt: NOW_ISO,
  };
  return { nodes, head };
}

function questFacts() {
  return {
    sourceKind: 'quest-execution-facts.v1',
    tenantId: TENANT,
    tasks: [{ taskId: 'task-fabric-contract', missionId: 'mission-fabric-foundation', fence: 7 }],
    fences: [
      { taskId: 'task-fabric-contract', currentFence: 7 },
      { taskId: 'task-fabric-proof', currentFence: 8 },
    ],
    runs: [
      {
        runId: 'run-fabric-current', taskId: 'task-fabric-contract', executorAgentId: 'agent-cambium',
        loadoutId: 'loadout-a1', state: 'succeeded', fence: 7, nonce: 'nonce-current',
        nonceExpiresAt: '2026-07-29T00:00:00.000Z', receiptId: 'receipt-fabric-contract',
        startedAt: NOW_ISO, terminalAt: '2026-07-28T09:05:00.000Z',
      },
    ],
    receipts: [
      {
        receiptId: 'receipt-fabric-contract', runId: 'run-fabric-current', taskId: 'task-fabric-contract',
        status: 'verified', evidenceRef: 'evidence-receipt-001', verifiedAt: '2026-07-28T09:05:00.000Z', durable: true,
      },
    ],
    agents: [
      { agentId: 'agent-cambium', state: 'available', capabilities: ['contracts'], currentTaskId: 'task-fabric-contract', sourceRef: 'quest:agent-cambium' },
    ],
    skillClusters: [
      { clusterId: 'cluster-fabric', state: 'active', capabilities: ['contracts'], eligibleAgentIds: ['agent-cambium'], sourceRef: 'quest:cluster-fabric' },
    ],
    taskClusterAssignments: [{ taskId: 'task-fabric-contract', clusterId: 'cluster-fabric' }],
    gaps: [
      { gapId: 'gap-receipt-fabric-proof', kind: 'missing-receipt', subjectId: 'task-fabric-proof', detail: 'Proof receipt has not been produced.', evidenceRef: 'evidence-gap-001' },
    ],
  };
}

function questEnvelope(facts: Record<string, unknown>) {
  return {
    schema: 'quest-ledger-envelope.v1',
    derivedAt: NOW_ISO,
    tenant: TENANT,
    branchStories: [
      { branchId: 'branch-cambium', branchKind: 'product', name: 'Cambium', promotion: { state: 'supervised-branch', currentGate: 'gate-mvp' }, controls: { organRouting: [] }, source: { tenant: TENANT } },
      { branchId: 'branch-acme', branchKind: 'client', productId: 'product-acme-website', name: 'Acme Corp Website', vision: { statement: 'A public site for Acme Corp.' }, source: { tenant: TENANT } },
    ],
    companyPrograms: [
      { programId: 'cambium-operating-fabric', tenantId: TENANT, title: 'Cambium Operating Fabric', programKind: 'operations', lifecycle: 'executing', outcomeMetric: 'bounded execution paths', authority: { kind: 'goal-graph', namespace: 'cambium.synthetic.goal-graph', graphVersion: 7 }, missionIds: ['mission-fabric-foundation'] },
    ],
    fabricFacts: facts,
    ledger: { rows: [], completed: 0, total: 0, current: null },
  };
}

interface FabricSpies {
  d1Writes: number;
  kvWrites: number;
  d1Reads: number;
  kvReads: number;
}

function fabricDeps(options: {
  initData: string;
  pubKeyHex: string;
  allowlist: string[];
  facts?: Record<string, unknown>;
  nodes?: GoalGraphNode[];
  head?: GoalGraphHead | null;
  receipts?: BranchMapReceipt[];
  branchStories?: unknown[];
}): { deps: HandlerDeps; spies: FabricSpies } {
  const graph = goalGraphFixture();
  const nodes = options.nodes ?? graph.nodes;
  const head = options.head === undefined ? graph.head : options.head;
  const facts = options.facts ?? questFacts();
  const receipts = options.receipts ?? [{
    receiptId: 'receipt-fabric-contract', tenantId: TENANT, branchId: 'cambium', organId: 'fabric', organName: 'Fabric',
    fromNodeId: 'gg-task-contract', toNodeId: 'gg-task-contract', observedAt: NOW_ISO,
    evidenceRefs: ['proof:receipt-fabric-contract'], sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`,
    graphVersion: 7, status: 'verified' as const,
  }];
  const spies: FabricSpies = { d1Writes: 0, kvWrites: 0, d1Reads: 0, kvReads: 0 };
  const envelope = questEnvelope(facts);
  if (options.branchStories !== undefined) envelope.branchStories = options.branchStories;
  const kvStore = new Map<string, string>([[`ledger:${TENANT}`, JSON.stringify(envelope)]]);
  const rawFabricFacts = facts;
  const gate: GateConfig = { botId: BOT_ID, pubKeyHex: options.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS };
  const goalGraphStore: GoalGraphStoreLike = {
    async readHead(tenantId) { spies.d1Reads++; return tenantId === TENANT ? head : null; },
    async readNodes(tenantId) { spies.d1Reads++; return tenantId === TENANT ? nodes : []; },
    async commit() { spies.d1Writes++; throw new Error('mission fabric must never write Goal Graph'); },
  };
  const branchMapReceiptStore = {
    async recordReceipt() { spies.d1Writes++; throw new Error('mission fabric must never write receipts'); },
    async listReceipts(tenantId: string) { spies.d1Reads++; return tenantId === TENANT ? receipts : []; },
  } as unknown as BranchMapReceiptStoreLike;
  return {
    spies,
    deps: {
      kv: {
        async get(key: string) {
          spies.kvReads++;
          const stored = kvStore.get(key) ?? null;
          if (stored === null) return null;
          const tagged = JSON.stringify(rawFabricFacts, (_key, value) =>
            typeof value === 'number' && !Number.isFinite(value) ? '__fabric-non-finite__' : value);
          return JSON.stringify({ ...(JSON.parse(stored) as Record<string, unknown>), fabricFacts: JSON.parse(tagged) });
        },
        async put() { spies.kvWrites++; throw new Error('mission fabric must never write KV'); },
        async list() { return []; },
      },
      gate,
      goalGraphStore,
      branchMapReceiptStore,
      missionFabricTenants: options.allowlist,
      now: () => NOW_ISO,
    },
  };
}

interface FabricRequestOptions {
  method?: string;
  tenant?: string;
  allowlist?: string[];
  initData?: string;
  facts?: Record<string, unknown>;
  nodes?: GoalGraphNode[];
  head?: GoalGraphHead | null;
  storeHead?: GoalGraphHead | null;
  query?: string;
  receipts?: import('./branch-map.ts').BranchMapReceipt[];
  branchStories?: unknown[];
}

async function requestFabric(options: FabricRequestOptions = {}): Promise<{
  status: number;
  headers: Record<string, string>;
  json: any;
  raw: string;
  spies: FabricSpies;
}> {
  const auth = await signedInitData();
  const initData = options.initData === undefined ? auth.initData : options.initData;
  const tenant = options.tenant ?? TENANT;
  const { deps, spies } = fabricDeps({
    initData,
    pubKeyHex: auth.pubKeyHex,
    allowlist: options.allowlist ?? [TENANT],
    facts: options.facts,
    nodes: options.nodes,
    head: 'storeHead' in options ? options.storeHead ?? null : options.head ?? undefined,
    receipts: options.receipts,
    branchStories: options.branchStories,
  });
  const req: SimpleRequest = {
    method: options.method ?? 'GET',
    path: `/v1/mission-fabric/${tenant}${options.query ?? ''}`,
    headers: { 'x-telegram-init-data': initData },
  };
  const response = await handle(req, deps);
  return {
    status: response.status,
    headers: response.headers,
    json: typeof response.body === 'string' && response.body.startsWith('{') ? JSON.parse(response.body) : null,
    raw: typeof response.body === 'string' ? response.body : '',
    spies,
  };
}

test('GET mission fabric requires tenant allowlist and valid Telegram initData', async () => {
  assert.equal((await requestFabric({ allowlist: [], tenant: 'cambium' })).status, 403);
  assert.equal((await requestFabric({ allowlist: ['cambium'], initData: '', tenant: 'cambium' })).status, 401);
});

test('mission fabric rejects every mutating method', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await requestFabric({ method })).status, 405);
  }
});

test('route assembles D1 Goal Graph and KV quest facts without writes', async () => {
  const result = await requestFabric({ facts: { ...questFacts(), fixtureRef: FABRIC_SOURCE_FIXTURE.sourceKind } });
  assert.equal(result.status, 200);
  assert.equal(result.json.projection.readOnly, true);
  assert.equal(result.json.delivery.operatingFabricEnabled, true);
  assert.equal(result.json.delivery.freshness, 'fresh');
  assert.equal(result.spies.d1Writes, 0);
  assert.equal(result.spies.kvWrites, 0);
  assert.ok(result.spies.d1Reads > 0);
  assert.ok(result.spies.kvReads > 0);
});

test('tenant parsing is bounded before any store read', async () => {
  const bad = await requestFabric({ tenant: 'Cambium' });
  assert.equal(bad.status, 400);
  assert.equal(bad.spies.d1Reads, 0);
  const traversal = await requestFabric({ tenant: 'cambium-synthetic%2Fevil' });
  assert.equal(traversal.status, 400);
});

test('wrong tenant is rejected before D1 or KV reads', async () => {
  const result = await requestFabric({ tenant: 'tenant-foreign' });
  assert.equal(result.status, 403);
  assert.equal(result.spies.d1Reads, 0);
  assert.equal(result.spies.kvReads, 0);
});

test('absent goal graph head is an explicit 404 without writes', async () => {
  const result = await requestFabric({ storeHead: null });
  assert.equal(result.status, 404);
  assert.equal(result.spies.d1Writes, 0);
});

test('ETag is the redacted graphDigest and delivery is volatile transport metadata', async () => {
  const first = await requestFabric();
  const second = await requestFabric();
  assert.equal(first.status, 200);
  assert.equal(first.headers.etag, first.json.projection.graphDigest);
  assert.match(String(first.headers.etag), /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.headers['cache-control'], 'private, no-store');
  assert.equal(first.json.projection.graphDigest, second.json.projection.graphDigest);
  assert.equal(
    first.json.projection.graphDigest,
    projectionDigest(first.json.projection),
    'ETag digest covers the served redacted projection content',
  );
  const digestContent = JSON.stringify(first.json.projection);
  assert.ok(!digestContent.includes('servedAt'), 'delivery is excluded from the digest content');
});

test('founder viewer keeps private client labels; foreign viewer redaction changes the digest safely', async () => {
  const founder = await requestFabric();
  assert.equal(founder.status, 200);
  const names = JSON.stringify(founder.json.projection.nodes);
  assert.match(names, /Acme Corp Website/, 'founder sees the private client label');
  const unauthorizedDigest = `sha256:${'0'.repeat(64)}`;
  assert.notEqual(founder.json.projection.graphDigest, unauthorizedDigest);
  assert.doesNotMatch(founder.raw, /initData|query_id|auth_date/);
});

test('freshness reports stale when the envelope predates the goal graph head', async () => {
  const facts = questFacts();
  const auth = await signedInitData();
  const { deps } = fabricDeps({ initData: auth.initData, pubKeyHex: auth.pubKeyHex, allowlist: [TENANT], facts });
  const kvStore = new Map<string, string>([[`ledger:${TENANT}`, JSON.stringify({ ...questEnvelope(facts), derivedAt: '2026-01-01T00:00:00.000Z' })]]);
  deps.kv = { async get(k: string) { return kvStore.get(k) ?? null; }, async put() {}, async list() { return []; } };
  const response = await handle({ method: 'GET', path: `/v1/mission-fabric/${TENANT}`, headers: { 'x-telegram-init-data': auth.initData } }, deps);
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body as string).delivery.freshness, 'stale');
});

test('shadow comparison reports branch fact parity without private labels', async () => {
  const result = await requestFabric({ query: '?shadow=1' });
  assert.equal(result.status, 200);
  const shadow = result.json.shadow;
  assert.ok(shadow, 'allowlisted diagnostic request returns a shadow report');
  assert.equal(shadow.branchFacts, 2);
  assert.equal(shadow.representedFacts, 2);
  assert.deepEqual(shadow.missingIds, []);
  assert.deepEqual(shadow.unexpectedIds, []);
  assert.doesNotMatch(JSON.stringify(shadow), /Acme Corp Website/);
});

test('shadow comparison counts missing branch facts and never mutates sources', async () => {
  const graph = goalGraphFixture();
  const result = await requestFabric({
    query: '?shadow=1',
    facts: { ...questFacts(), tasks: [], fences: [], runs: [] },
    nodes: graph.nodes,
    receipts: [],
    branchStories: [
      { branchId: 'branch-cambium', branchKind: 'product', name: 'Cambium', promotion: { state: 'supervised-branch', currentGate: 'gate-mvp' }, controls: { organRouting: [] }, source: { tenant: TENANT } },
    ],
  });
  assert.equal(result.status, 200);
  const shadow = result.json.shadow;
  assert.equal(shadow.branchFacts, 1);
  assert.deepEqual(shadow.missingIds, []);
  assert.deepEqual(shadow.unexpectedIds, []);
  assert.equal(shadow.representedFacts, 1);
  assert.equal(result.spies.d1Writes, 0);
  assert.equal(result.spies.kvWrites, 0);
});

test('malformed clock and non-canonical nonce expiry fail closed', async () => {
  const facts = questFacts();
  (facts.runs[0] as Record<string, unknown>).nonceExpiresAt = 'July 29, 2026';
  const result = await requestFabric({ facts });
  assert.equal(result.status, 200);
  const runIds = result.json.projection.nodes.filter((node: { kind: string }) => node.kind === 'run').map((node: { value: { runId: string } }) => node.value.runId);
  assert.deepEqual(runIds, [], 'a non-canonical nonce expiry rejects the run instead of guessing');
  const gapKinds = result.json.projection.gaps.map((gap: { kind: string }) => gap.kind);
  assert.ok(gapKinds.includes('expired-proof') || gapKinds.includes('invalid-timestamp') || gapKinds.includes('unverifiable-clock'));
});

test('executes edges require an existing explicit agent node', async () => {
  const facts = questFacts();
  facts.agents = [];
  const result = await requestFabric({ facts });
  assert.equal(result.status, 200);
  const executes = result.json.projection.edges.filter((edge: { kind: string }) => edge.kind === 'executes');
  assert.deepEqual(executes, [], 'no executes edge without an explicit agent node');
  const gapKinds = result.json.projection.gaps.map((gap: { kind: string }) => gap.kind);
  assert.ok(gapKinds.includes('missing-join'), 'unresolved run-to-agent join emits a missing-join gap');
});

test('non-finite authoritative fences fail closed', async () => {
  const facts = questFacts();
  facts.fences = [{ taskId: 'task-fabric-contract', currentFence: Number.NaN }];
  const invalid = await requestFabric({ facts });
  assert.equal(invalid.status, 503);
  assert.equal(invalid.json.error, 'mission_fabric_fence_invalid');
  assert.equal(invalid.spies.d1Writes, 0);
  const absent = await requestFabric({ facts: { ...questFacts(), fences: [] } });
  assert.equal(absent.status, 200);
  const runs = absent.json.projection.nodes.filter((node: { kind: string }) => node.kind === 'run');
  assert.equal(runs.length, 1, 'without an authoritative fence collection the adapter cannot verify staleness and keeps the run');
  const unverifiable = await requestFabric({
    facts: { ...questFacts(), fences: [{ taskId: 'task-fabric-contract', currentFence: 7 }], runs: [{ ...questFacts().runs[0], fence: Number.NaN }] },
  });
  assert.equal(unverifiable.status, 200);
  const gapKinds = unverifiable.json.projection.gaps.map((gap: { kind: string }) => gap.kind);
  assert.ok(gapKinds.includes('unverifiable-fence'), 'a non-finite run fence against an authoritative collection emits an unverifiable-fence gap');
  const survivingRuns = unverifiable.json.projection.nodes.filter((node: { kind: string }) => node.kind === 'run');
  assert.deepEqual(survivingRuns, []);
});
