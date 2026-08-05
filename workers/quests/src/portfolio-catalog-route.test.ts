import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

import { buildDataCheckString, handle } from './handler.ts';
import type { GateConfig, HandlerDeps, SimpleRequest } from './handler.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import type { BranchMapReceiptStoreLike } from './branch-map-receipt-store.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;
const TENANT = 'cambium';
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const VIEWER_ID = '200000099';
const NOW_MS = 1_750_000_000_000;
const NOW = '2026-07-29T08:30:00.000Z';

async function signedInitData(userId: string): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams({
    auth_date: String(NOW_MS / 1000 - 10),
    user: JSON.stringify({ id: Number(userId), first_name: 'Synthetic' }),
    query_id: 'AAportfolio',
  });
  const { dcs } = buildDataCheckString(fields.toString(), BOT_ID);
  const signature = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(dcs)));
  fields.set('signature', Buffer.from(signature).toString('base64url'));
  fields.set('hash', 'synthetic-hash');
  return { initData: fields.toString(), pubKeyHex };
}

function fixtureDeps(pubKeyHex: string): { deps: HandlerDeps; writes: { d1: number; kv: number } } {
  const writes = { d1: 0, kv: 0 };
  const nodes: GoalGraphNode[] = [{
    nodeId: 'goal-portfolio',
    tenantId: TENANT,
    namespace: 'portfolio',
    externalId: 'task-portfolio-read',
    parentNodeId: null,
    scope: 'macro',
    desiredState: 'portfolio remains read-only',
    currentState: 'active',
    owner: 'founder',
    nextAction: null,
    waitCondition: null,
    proofRequired: true,
    reviewAt: null,
    status: 'active',
    sourceRef: 'goal-graph:portfolio',
    sourceDigest: `sha256:${'a'.repeat(64)}`,
    graphVersion: 9,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
  }];
  const head: GoalGraphHead = {
    tenantId: TENANT,
    graphVersion: 9,
    graphDigest: `sha256:${'b'.repeat(64)}`,
    nodeIds: nodes.map((node) => node.nodeId),
    sourceRef: 'd1:goal-graph:9',
    sourceDigest: `sha256:${'c'.repeat(64)}`,
    committedAt: NOW,
  };
  const envelope = {
    schema: 'quest-ledger-envelope.v1',
    derivedAt: NOW,
    tenant: TENANT,
    branchStories: [{
      branchId: 'sapling-cambium',
      branchKind: 'product',
      name: 'Cambium',
      promotion: { state: 'supervised-branch', currentGate: 'gate-mvp' },
      controls: { organRouting: [] },
      source: { tenant: TENANT },
    }],
    companyPrograms: [{
      programId: 'cambium-operating-fabric',
      tenantId: TENANT,
      title: 'Cambium Operating Fabric',
      programKind: 'operations',
      lifecycle: 'executing',
      outcomeMetric: 'bounded execution paths',
      authority: { kind: 'goal-graph', namespace: 'cambium.goal-graph', graphVersion: 9 },
      missionIds: [],
    }],
    fabricFacts: {
      sourceKind: 'quest-execution-facts.v1',
      tenantId: TENANT,
      tasks: [],
      fences: [],
      runs: [],
      receipts: [],
      agents: [],
      skillClusters: [],
      taskClusterAssignments: [],
      gaps: [],
    },
    ledger: { rows: [], completed: 0, total: 0, current: null },
  };
  const goalGraphStore: GoalGraphStoreLike = {
    async readHead(tenantId) { return tenantId === TENANT ? head : null; },
    async readNodes(tenantId) { return tenantId === TENANT ? nodes : []; },
    async commit() {
      writes.d1 += 1;
      throw new Error('portfolio route must not write Goal Graph');
    },
  };
  const branchMapReceiptStore = {
    async listReceipts() { return []; },
    async recordReceipt() {
      writes.d1 += 1;
      throw new Error('portfolio route must not write receipts');
    },
  } as unknown as BranchMapReceiptStoreLike;
  const gate: GateConfig = {
    botId: BOT_ID,
    pubKeyHex,
    founderIds: [FOUNDER_ID],
    now: () => NOW_MS,
  };
  return {
    writes,
    deps: {
      kv: {
        async get(key) { return key === `ledger:${TENANT}` ? JSON.stringify(envelope) : null; },
        async put() {
          writes.kv += 1;
          throw new Error('portfolio route must not write KV');
        },
        async list() { return []; },
      },
      gate,
      goalGraphStore,
      branchMapReceiptStore,
      missionFabricTenants: [TENANT],
      missionFabricViewerIds: [VIEWER_ID],
      now: () => NOW,
    },
  };
}

async function requestPortfolio(userId: string) {
  const auth = await signedInitData(userId);
  const { deps, writes } = fixtureDeps(auth.pubKeyHex);
  const request: SimpleRequest = {
    method: 'GET',
    path: `/v1/mission-fabric/${TENANT}`,
    headers: { 'x-telegram-init-data': auth.initData },
  };
  const response = await handle(request, deps);
  return {
    response,
    json: JSON.parse(String(response.body)),
    writes,
  };
}

test('Cambium founder route serves the complete bounded catalog and exact join report', async () => {
  const result = await requestPortfolio(FOUNDER_ID);
  assert.equal(result.response.status, 200);
  assert.equal(result.json.portfolioCatalogSummary.total, 54);
  assert.equal(result.json.portfolioCatalogSummary.saplings, 12);
  assert.equal(result.json.portfolioCatalogSummary.clientBranches, 28);
  assert.equal(result.json.portfolioCatalogSummary.internalPrograms, 14);
  assert.equal(result.json.portfolioCatalogSummary.classificationReview, 16);
  assert.equal(result.json.portfolioCatalogSummary.historicalProducts, 19);
  assert.equal(result.json.portfolioCatalogSummary.operationalGaps, 47);
  assert.equal(result.json.portfolioCatalog.status, 'proposed-read-only');
  assert.equal(result.json.portfolioCatalog.records.length, 54);
  assert.equal(result.json.portfolioCatalog.classificationReview.length, 16);
  assert.equal(result.json.portfolioCatalog.historicalProducts.length, 19);
  assert.equal(result.json.portfolioCatalog.operationalGaps.length, 47);
  assert.deepEqual(
    {
      matched: result.json.portfolioJoinReport.matchedCount,
      catalogOrphans: result.json.portfolioJoinReport.catalogOrphanCount,
      runtimeOrphans: result.json.portfolioJoinReport.runtimeOrphanCount,
    },
    { matched: 2, catalogOrphans: 52, runtimeOrphans: 0 },
  );
  const fitcheck = result.json.portfolioCatalog.records.find((record: { workId: string }) => record.workId === 'sapling:fitcheck');
  assert.equal(fitcheck.parentTenant, 'cambium');
  assert.deepEqual(fitcheck.aliases.map((alias: { value: string; tenantAuthority: boolean }) => [alias.value, alias.tenantAuthority]), [
    ['FitCheck', false],
    ['getfitcheck', false],
  ]);
  assert.equal(result.response.headers.etag, result.json.delivery.portfolioPairDigest);
  assert.notEqual(result.response.headers.etag, result.json.projection.graphDigest);
  assert.equal(result.json.organUpdateDelivery.schema, 'cambium.organ-update-plan.v1');
  assert.equal(result.json.organUpdateDelivery.workflows.length, 5);
  assert.deepEqual(
    result.json.organUpdateDelivery.workflows.map((workflow: { name: string; defaultTopic: { topicName: string } }) => [
      workflow.name,
      workflow.defaultTopic.topicName,
    ]),
    [
      ['Genesis', 'Inbox'],
      ['Taste', 'Digests'],
      ['Hands', 'Dev'],
      ['Will', 'Clients'],
      ['Cortex', 'Agent Ops'],
    ],
  );
  assert.deepEqual(result.json.organUpdateDelivery.activeDeliveries, []);
  assert.equal(result.json.organUpdateDelivery.scheduleArmed, false);
  assert.equal(result.json.organUpdateDeliverySummary, undefined);
  assert.equal(result.writes.d1, 0);
  assert.equal(result.writes.kv, 0);
  assert.doesNotMatch(String(result.response.body), /\/Volumes\/|\/Users\/|query_id|auth_date|synthetic-hash/);
});

test('allowlisted non-founder receives aggregate catalog proof but no identities or join detail', async () => {
  const result = await requestPortfolio(VIEWER_ID);
  assert.equal(result.response.status, 200);
  assert.equal(result.json.portfolioCatalogSummary.total, 54);
  assert.match(result.json.portfolioCatalogSummary.catalogDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.json.delivery.portfolioPairDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.response.headers.etag, result.json.delivery.portfolioPairDigest);
  assert.equal(result.json.portfolioCatalog, undefined);
  assert.equal(result.json.portfolioJoinReport, undefined);
  assert.equal(result.json.organUpdateDelivery, undefined);
  assert.deepEqual(result.json.organUpdateDeliverySummary, {
    schema: 'cambium.organ-update-delivery-summary.v1',
    version: 1,
    readOnly: true,
    eventDriven: true,
    scheduleArmed: false,
    workflowCount: 5,
    defaultTopicCount: 5,
    escalationTopicCount: 1,
    approvalRequiredWorkflowCount: 1,
    planDigest: result.json.organUpdateDeliverySummary.planDigest,
  });
  assert.match(result.json.organUpdateDeliverySummary.planDigest, /^sha256:[0-9a-f]{64}$/);
  assert.doesNotMatch(String(result.response.body), /Fitcheck|ParkArea|SeedForge|getfitcheck/);
  assert.equal(result.writes.d1, 0);
  assert.equal(result.writes.kv, 0);
});

test('bridge compiles one receipt-backed organ update without writing or sending', async () => {
  const auth = await signedInitData(FOUNDER_ID);
  const { deps, writes } = fixtureDeps(auth.pubKeyHex);
  deps.bridgeToken = 'bridge-secret';
  const response = await handle({
    method: 'POST',
    path: '/v1/bridge/organ-update-delivery',
    headers: { authorization: 'Bearer bridge-secret' },
    body: JSON.stringify({
      schema: 'cambium.organ-update-signal.v1',
      tenantId: TENANT,
      workObjectId: 'sapling:fitcheck',
      organ: 'hands',
      trigger: 'verification',
      status: 'complete',
      audience: 'internal',
      summary: 'Verification receipt is ready.',
      observedAt: NOW,
      proof: { ref: 'receipt:fitcheck-verification', digest: `sha256:${'d'.repeat(64)}` },
    }),
  }, deps);
  const body = JSON.parse(String(response.body));
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.organUpdateDelivery.schema, 'cambium.organ-update-delivery.v1');
  assert.equal(body.organUpdateDelivery.route.topicKey, 'dev');
  assert.equal(body.organUpdateDelivery.route.threadId, 862);
  assert.equal(body.organUpdateDelivery.eventDriven, true);
  assert.equal(body.organUpdateDelivery.scheduleArmed, false);
  assert.equal(writes.d1, 0);
  assert.equal(writes.kv, 0);
});

test('bridge rejects unverified approval, foreign tenant, assignment token, and bad auth without writes', async () => {
  const auth = await signedInitData(FOUNDER_ID);
  const fixture = fixtureDeps(auth.pubKeyHex);
  fixture.deps.bridgeToken = 'bridge-secret';
  fixture.deps.assignmentToken = 'assignment-secret';
  const request: SimpleRequest = {
    method: 'POST',
    path: '/v1/bridge/organ-update-delivery',
    headers: { authorization: 'Bearer bridge-secret' },
    body: JSON.stringify({
      schema: 'cambium.organ-update-signal.v1',
      tenantId: TENANT,
      workObjectId: 'client:axtech',
      organ: 'will',
      trigger: 'client-delivery',
      status: 'ready',
      audience: 'client',
      summary: 'Client delivery is ready.',
      observedAt: NOW,
      proof: { ref: 'receipt:axtech-delivery', digest: `sha256:${'e'.repeat(64)}` },
      approvalRef: 'gate:made-up-approval',
    }),
  };
  const rejected = await handle(request, fixture.deps);
  assert.equal(rejected.status, 403);
  assert.match(String(rejected.body), /approval_not_verified/);

  const foreignTenant = await handle({
    ...request,
    body: String(request.body).replace('"tenantId":"cambium"', '"tenantId":"othertenant"'),
  }, fixture.deps);
  assert.equal(foreignTenant.status, 403);
  assert.match(String(foreignTenant.body), /fixed to the cambium tenant/);

  const assignmentOnly = await handle({
    ...request,
    headers: { authorization: 'Bearer assignment-secret' },
  }, fixture.deps);
  assert.equal(assignmentOnly.status, 403);
  assert.match(String(assignmentOnly.body), /admin bridge credential/);

  const unauthorized = await handle({ ...request, headers: { authorization: 'Bearer wrong' } }, fixture.deps);
  assert.equal(unauthorized.status, 401);
  assert.equal(fixture.writes.d1, 0);
  assert.equal(fixture.writes.kv, 0);
});

test('bridge accepts client Will delivery only with a matching founder Gate approval', async () => {
  const auth = await signedInitData(FOUNDER_ID);
  const fixture = fixtureDeps(auth.pubKeyHex);
  fixture.deps.bridgeToken = 'bridge-secret';
  const get = fixture.deps.kv.get.bind(fixture.deps.kv);
  fixture.deps.kv.get = async (key) => key === `gate:${TENANT}:approval-001`
    ? JSON.stringify({
        id: 'approval-001',
        founderId: FOUNDER_ID,
        kind: 'approve',
        subject: 'client:axtech',
        status: 'queued',
      })
    : get(key);
  const response = await handle({
    method: 'POST',
    path: '/v1/bridge/organ-update-delivery',
    headers: { authorization: 'Bearer bridge-secret' },
    body: JSON.stringify({
      schema: 'cambium.organ-update-signal.v1',
      tenantId: TENANT,
      workObjectId: 'client:axtech',
      organ: 'will',
      trigger: 'client-delivery',
      status: 'ready',
      audience: 'client',
      summary: 'Client delivery is ready.',
      observedAt: NOW,
      proof: { ref: 'receipt:axtech-delivery', digest: `sha256:${'f'.repeat(64)}` },
      approvalRef: 'gate:approval-001',
    }),
  }, fixture.deps);
  const body = JSON.parse(String(response.body));
  assert.equal(response.status, 200);
  assert.equal(body.organUpdateDelivery.route.topicKey, 'clients');
  assert.equal(body.organUpdateDelivery.approvalRef, 'gate:approval-001');
  assert.equal(fixture.writes.d1, 0);
  assert.equal(fixture.writes.kv, 0);
});
