// Task 13 · end-to-end proof-chain integration test.
//
// Traces the exact contract chain required for operating-fabric promotion:
//
//   company program packet / sapling branch story
//     -> Goal Graph canonical mission/task IDs
//     -> fenced run
//     -> durable receipt
//     -> mission-fabric projection
//     -> authenticated /v1/mission-fabric/{tenant} route
//     -> operating scene (Canopy) and contextual Inspect sheet
//
// All fixtures are synthetic and secret-free. Every step reuses the real
// production compiler/handler/renderer modules (mission-fabric.ts,
// handler.ts, canopy.ts, inspect-sheet.ts) — nothing here re-implements the
// contract in a parallel fake path.
import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

import { handle, buildDataCheckString } from './handler.ts';
import type { GateConfig, HandlerDeps, SimpleRequest } from './handler.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import type { BranchMapReceipt } from './branch-map.ts';
import type { BranchMapReceiptStoreLike } from './branch-map-receipt-store.ts';
import { projectionDigest } from './mission-fabric.ts';
import type { MissionFabricProjectionV1 } from './mission-fabric.ts';
import { renderCanopy } from './page/operating-fabric/canopy.ts';
import type { Freshness } from './page/operating-fabric/components.ts';
import { renderInspectSheet } from './page/operating-fabric/inspect-sheet.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;
const NOW_MS = 1_750_000_000_000;
const NOW_ISO = '2026-07-28T09:00:00.000Z';
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const NON_FOUNDER_ID = '200000099';
const TENANT = 'cambium-synthetic';
const MISSION_ID = 'mission-fabric-foundation';

async function signedInitData(userId = FOUNDER_ID): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = (await subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
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
  // Macro parent node whose externalId is the canonical mission ID (its
  // nodeId is just a Goal Graph storage id, gg-mission-fabric-foundation —
  // only externalId is canonical), and a meso child node whose externalId
  // is the canonical task ID with parentNodeId pointing at the parent's D1
  // storage identity. The adapter resolves that storage ID to the parent's
  // canonical external mission ID.
  // adaptGoalGraph maps both into FabricTask nodes (there is no
  // FabricMission kind in this route's live composition), so the
  // mission-shaped node is asserted via its own taskId/missionId fields,
  // not via a 'mission' node kind.
  const nodes = [
    goalNode('gg-mission-fabric-foundation', MISSION_ID, null),
    goalNode('gg-task-contract', 'task-fabric-contract', 'gg-mission-fabric-foundation'),
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
    tasks: [{ taskId: 'task-fabric-contract', missionId: MISSION_ID, fence: 7 }],
    fences: [{ taskId: 'task-fabric-contract', currentFence: 7 }],
    runs: [
      {
        runId: 'run-fabric-current', taskId: 'task-fabric-contract', executorAgentId: 'agent-cambium',
        loadoutId: 'loadout-a1', state: 'succeeded', fence: 7, nonce: 'nonce-current',
        nonceExpiresAt: '2026-07-29T00:00:00.000Z', receiptId: 'receipt-fabric-contract',
        // Explicit stable timestamps: these are the actual content inputs to
        // the digest, so they must never depend on contentAsOf for this
        // fixture to prove digest stability across derivedAt changes.
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
      {
        agentId: 'agent-cambium', state: 'available', capabilities: ['contracts'], currentTaskId: 'task-fabric-contract',
        sourceRef: 'quest:agent-cambium', lastSeenAt: NOW_ISO,
      },
    ],
    skillClusters: [
      { clusterId: 'cluster-fabric', state: 'active', capabilities: ['contracts'], eligibleAgentIds: ['agent-cambium'], sourceRef: 'quest:cluster-fabric' },
    ],
    taskClusterAssignments: [{ taskId: 'task-fabric-contract', clusterId: 'cluster-fabric' }],
    gaps: [] as Array<Record<string, unknown>>,
  };
}

function questEnvelope(facts: Record<string, unknown>, derivedAt = NOW_ISO) {
  return {
    schema: 'quest-ledger-envelope.v1',
    derivedAt,
    tenant: TENANT,
    branchStories: [
      { branchId: 'branch-cambium', branchKind: 'product', canonicalWorkId: 'sapling:cambium', name: 'Cambium', promotion: { state: 'supervised-branch', currentGate: 'gate-mvp' }, controls: { organRouting: [] }, source: { tenant: TENANT } },
      // Private client branch: covers redaction (requirement #5) only. Its
      // productId matches its represented workId so shadow parity stays
      // zero-gap for every viewer role (redaction never removes the work
      // node itself, only its client-identifying fields).
      { branchId: 'branch-acme-client', branchKind: 'client', canonicalWorkId: 'branch:acme-client', productId: 'acme-client-program', name: 'Acme Corp Engagement', vision: { statement: 'acme confidential roadmap' }, arcId: 'arc-acme', source: { tenant: TENANT } },
    ],
    companyPrograms: [
      {
        programId: 'cambium-operating-fabric', tenantId: TENANT, title: 'Cambium Operating Fabric',
        programKind: 'operations', lifecycle: 'executing', outcomeMetric: 'bounded execution paths',
        authority: { kind: 'goal-graph', namespace: 'cambium.synthetic.goal-graph', graphVersion: 7 },
        missionIds: [MISSION_ID],
      },
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
  derivedAt?: string;
  viewerIds?: string[];
}): { deps: HandlerDeps; spies: FabricSpies } {
  const graph = goalGraphFixture();
  const facts = options.facts ?? questFacts();
  const receipts: BranchMapReceipt[] = [{
    receiptId: 'receipt-fabric-contract', tenantId: TENANT, branchId: 'cambium', organId: 'fabric', organName: 'Fabric',
    fromNodeId: 'gg-task-contract', toNodeId: 'gg-task-contract', observedAt: NOW_ISO,
    evidenceRefs: ['proof:receipt-fabric-contract'], sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`,
    graphVersion: 7, status: 'verified' as const,
  }];
  const spies: FabricSpies = { d1Writes: 0, kvWrites: 0, d1Reads: 0, kvReads: 0 };
  const envelope = questEnvelope(facts, options.derivedAt ?? NOW_ISO);
  const kvStore = new Map<string, string>([[`ledger:${TENANT}`, JSON.stringify(envelope)]]);
  const gate: GateConfig = { botId: BOT_ID, pubKeyHex: options.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS };
  const goalGraphStore: GoalGraphStoreLike = {
    async readHead(tenantId) { spies.d1Reads++; return tenantId === TENANT ? graph.head : null; },
    async readNodes(tenantId) { spies.d1Reads++; return tenantId === TENANT ? graph.nodes : []; },
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
        async get(key: string) { spies.kvReads++; return kvStore.get(key) ?? null; },
        async put() { spies.kvWrites++; throw new Error('mission fabric must never write KV'); },
        async list() { return []; },
      },
      gate,
      goalGraphStore,
      branchMapReceiptStore,
      missionFabricTenants: options.allowlist,
      missionFabricViewerIds: options.viewerIds,
      now: () => NOW_ISO,
    },
  };
}

async function requestFabric(options: {
  allowlist?: string[];
  initData?: string;
  facts?: Record<string, unknown>;
  derivedAt?: string;
  now?: () => string;
  query?: string;
  tenant?: string;
  userId?: string;
  viewerIds?: string[];
}): Promise<{ status: number; headers: Record<string, string>; json: any; raw: string; spies: FabricSpies }> {
  const auth = await signedInitData(options.userId);
  const initData = options.initData === undefined ? auth.initData : options.initData;
  const tenant = options.tenant ?? TENANT;
  const { deps, spies } = fabricDeps({
    initData,
    pubKeyHex: auth.pubKeyHex,
    allowlist: options.allowlist ?? [TENANT],
    facts: options.facts,
    derivedAt: options.derivedAt,
    viewerIds: options.viewerIds,
  });
  if (options.now) deps.now = options.now;
  const req: SimpleRequest = {
    method: 'GET',
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

test('full proof chain: program+sapling -> Goal Graph IDs -> fenced run -> receipt -> projection -> route -> scene -> Inspect', async () => {
  const result = await requestFabric({});
  assert.equal(result.status, 200);
  assert.equal(result.spies.d1Writes, 0, 'zero D1 writes across the whole chain');
  assert.equal(result.spies.kvWrites, 0, 'zero KV writes across the whole chain');

  const projection: MissionFabricProjectionV1 = result.json.projection;
  assert.equal(projection.readOnly, true);
  assert.equal(result.json.delivery.operatingFabricEnabled, true);

  // Company program and sapling both survived into work nodes with the
  // exact canonical IDs sourced from the branch story / program packet,
  // and are distinguishable by kind (sapling vs program).
  const workNodes = projection.nodes.filter(
    (node): node is Extract<typeof node, { kind: 'work' }> => node.kind === 'work',
  );
  const saplingIds = workNodes.filter((node) => node.value.kind === 'sapling').map((node) => node.value.workId).sort();
  const programIds = workNodes.filter((node) => node.value.kind === 'program').map((node) => node.value.workId).sort();
  assert.deepEqual(saplingIds, ['sapling:cambium'], 'sapling work is present and distinguishable');
  assert.deepEqual(programIds, ['branch:acme-client', 'cambium-operating-fabric'], 'company-wide and client programs are present and distinguishable');

  // Goal Graph canonical mission and task IDs both reached the projection as
  // task-shaped nodes. The execution-fact copy of the task reconciles into the
  // D1-authoritative task node, and the D1 parent storage ID resolves to the
  // parent's canonical external mission ID.
  const taskNodes = projection.nodes.filter(
    (node): node is Extract<typeof node, { kind: 'task' }> => node.kind === 'task',
  );
  const missionShapedNode = taskNodes.find((node) => node.value.taskId === MISSION_ID);
  assert.ok(missionShapedNode, 'Goal Graph macro (mission) node reached the projection with its exact externalId');
  const childTaskNodes = taskNodes.filter((node) => node.value.taskId === 'task-fabric-contract');
  assert.equal(childTaskNodes.length, 1, 'one canonical task node survives D1/execution reconciliation');
  for (const childTask of childTaskNodes) {
    assert.equal(childTask.value.missionId, MISSION_ID, 'child task carries exact mission parentage');
  }

  // Task->Run->Receipt edges and agent<->skill-cluster assignment, using the
  // actual served projection edges (this route's real edge kinds — there is
  // no 'contains' edge in the live v1 composition; parentage is proven via
  // the missionId field above instead).
  const edgeSet = projection.edges.map((edge) => `${edge.kind}:${edge.fromId}:${edge.toId}`);
  assert.ok(edgeSet.includes('assigned-to:task-fabric-contract:agent-cambium'), 'task<->agent assignment edge present');
  assert.ok(edgeSet.includes('executes:agent-cambium:run-fabric-current'), 'agent executes the fenced run');
  assert.ok(edgeSet.includes('produces:run-fabric-current:receipt-fabric-contract'), 'run produces the durable receipt');
  assert.ok(edgeSet.includes('proves:receipt-fabric-contract:task-fabric-contract'), 'receipt proves the task');
  assert.ok(edgeSet.includes('requires-cluster:task-fabric-contract:cluster-fabric'), 'task<->skill-cluster requirement edge present');

  // Fenced run reached the projection.
  const run = projection.nodes.find(
    (node): node is Extract<typeof node, { kind: 'run' }> => node.kind === 'run' && node.value.runId === 'run-fabric-current',
  );
  assert.ok(run, 'fenced run reached the projection');
  assert.equal(run!.value.taskId, 'task-fabric-contract');
  assert.equal(run!.value.status, 'complete', 'run fence 7 matched authoritative fence 7 and was accepted as succeeded');

  // Durable receipt reached the projection, with observedAt sourced from the
  // branch-map receipt store rather than fabricated from the envelope.
  const receipt = projection.nodes.find(
    (node): node is Extract<typeof node, { kind: 'receipt' }> => node.kind === 'receipt' && node.value.receiptId === 'receipt-fabric-contract',
  );
  assert.ok(receipt, 'durable receipt reached the projection');
  assert.equal(receipt!.value.createdAt, NOW_ISO);

  // ETag / digest is exactly the projection digest of the served content.
  assert.equal(result.headers.etag, projection.graphDigest);
  assert.equal(projection.graphDigest, projectionDigest(projection));

  // Operating scene: Canopy renders the sapling and program work cards with
  // a real, correctly-typed Freshness value (no `as any`).
  const freshness: Freshness = { state: result.json.delivery.freshness === 'fresh' ? 'fresh' : 'stale' };
  const canopyHtml = renderCanopy(projection, { freshness });
  assert.match(canopyHtml, /data-work-id="sapling:cambium"/);
  assert.match(canopyHtml, /data-work-id="cambium-operating-fabric"/);
  assert.match(canopyHtml, /data-work-id="branch:acme-client"/);

  const taskInspect = renderInspectSheet(projection, { kind: 'node', nodeId: 'task-fabric-contract' });
  assert.doesNotMatch(taskInspect, /Inspect unavailable/, 'reconciled task identity remains inspectable');
  assert.ok(
    projection.gaps.some((gap) => gap.kind === 'task-overlay-reconciled' && gap.subjectId === 'task-fabric-contract'),
    'the discarded execution-fact task copy remains visible as a typed reconciliation gap',
  );

  const runInspectHtml = renderInspectSheet(projection, { kind: 'node', nodeId: 'run-fabric-current' });
  assert.doesNotMatch(runInspectHtml, /Inspect unavailable/);
  assert.match(runInspectHtml, /run-fabric-current/);
  assert.match(runInspectHtml, new RegExp(`sourceOfTruth: ${projection.sourceOfTruth}`));
  assert.match(runInspectHtml, new RegExp(`graphVersion: ${projection.graphVersion}`));
  assert.match(runInspectHtml, new RegExp(`asOf: ${projection.asOf}`));
  assert.match(runInspectHtml, /read-only — this projection cannot be mutated from here/);
  assert.match(runInspectHtml, /no gaps attached/);
  // Inspect intentionally never renders graphDigest/evidenceRef/sourceRef;
  // graphDigest is instead verified against the projection/ETag above.
  assert.doesNotMatch(runInspectHtml, new RegExp(projection.graphDigest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // Inspecting a non-existent ID resolves to the generic unavailable state,
  // never echoing the requested (possibly hostile) target back.
  const missingInspect = renderInspectSheet(projection, { kind: 'node', nodeId: 'not-a-real-id' });
  assert.match(missingInspect, /Inspect unavailable/);
  assert.doesNotMatch(missingInspect, /not-a-real-id/);
});

test('graphDigest stays stable across servedAt and stale/fresh freshness changes for unchanged frozen content', async () => {
  const first = await requestFabric({ now: () => '2026-07-28T09:00:00.000Z' });
  const second = await requestFabric({ now: () => '2026-07-28T10:30:00.000Z' });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.notEqual(first.json.delivery.servedAt, second.json.delivery.servedAt, 'servedAt varies across requests');
  assert.equal(first.json.delivery.freshness, second.json.delivery.freshness, 'freshness unchanged when derivedAt is fixed and both servedAt values are before nonce expiry');
  assert.equal(
    first.json.projection.graphDigest,
    second.json.projection.graphDigest,
    'graphDigest is stable when only generatedAt/servedAt change for the same frozen source',
  );

  // Fresh vs stale: derivedAt itself moves across the 24h clock-skew
  // boundary, which legitimately flips delivery.freshness — but every
  // content-affecting timestamp in the quest facts (run.startedAt,
  // agent.lastSeenAt) is explicit, so contentAsOf (which only backfills
  // MISSING timestamps) never touches the digest content either way.
  const fresh = await requestFabric({ derivedAt: NOW_ISO });
  const stale = await requestFabric({ derivedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(fresh.json.delivery.freshness, 'fresh');
  assert.equal(stale.json.delivery.freshness, 'stale');
  assert.equal(
    stale.json.projection.graphDigest,
    fresh.json.projection.graphDigest,
    'graphDigest is unaffected by a stale/fresh freshness change when frozen source content is unchanged',
  );

  const digestContent = JSON.stringify(first.json.projection);
  assert.ok(!digestContent.includes('servedAt'), 'delivery/freshness metadata is excluded from the digest content');

  const founderDigest = first.json.projection.graphDigest;
  assert.match(founderDigest, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(founderDigest, `sha256:${'0'.repeat(64)}`);
});

test('non-founder viewer without the fail-closed viewer allowlist is rejected before any authority read', async () => {
  const rejected = await requestFabric({ userId: NON_FOUNDER_ID });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.spies.d1Reads, 0, 'no Goal Graph/receipt reads happen for an unauthorized non-founder');
  assert.equal(rejected.spies.kvReads, 0, 'no KV envelope read happens for an unauthorized non-founder');

  const emptyAllowlist = await requestFabric({ userId: NON_FOUNDER_ID, viewerIds: [] });
  assert.equal(emptyAllowlist.status, 401, 'an empty viewer allowlist authorizes founders only');
});

test('non-founder viewer receives real redaction with a valid signed initData proof', async () => {
  const founder = await requestFabric({});
  const viewer = await requestFabric({ userId: NON_FOUNDER_ID, viewerIds: [NON_FOUNDER_ID] });
  assert.equal(founder.status, 200);
  assert.equal(viewer.status, 200);

  const founderProjection: MissionFabricProjectionV1 = founder.json.projection;
  const viewerProjection: MissionFabricProjectionV1 = viewer.json.projection;

  // Private client label is redacted for the non-founder viewer.
  const founderClientWork = founderProjection.nodes.find(
    (node): node is Extract<typeof node, { kind: 'work' }> =>
      node.kind === 'work' && node.value.kind === 'program' && node.value.workId === 'branch:acme-client',
  );
  assert.ok(founderClientWork, 'founder sees the real client program node');
  assert.equal((founderClientWork!.value as { name: string }).name, 'Acme Corp Engagement');

  const viewerClientWork = viewerProjection.nodes.find(
    (node): node is Extract<typeof node, { kind: 'work' }> =>
      node.kind === 'work' && node.value.kind === 'program' && node.value.workId === 'branch:acme-client',
  );
  assert.ok(viewerClientWork, 'client program node still exists for the viewer (redacted, not removed)');
  assert.equal((viewerClientWork!.value as { name: string }).name, '[private client]', 'private client label is redacted for non-founder viewers');
  assert.equal((viewerClientWork!.value as { desiredState: string }).desiredState, '');
  assert.equal((viewerClientWork!.value as { outcomeMetric: string }).outcomeMetric, '');

  // Sensitive source/evidence refs are absent/redacted for the viewer.
  const viewerReceipt = viewerProjection.nodes.find(
    (node): node is Extract<typeof node, { kind: 'receipt' }> => node.kind === 'receipt' && node.value.receiptId === 'receipt-fabric-contract',
  );
  assert.ok(viewerReceipt);
  assert.deepEqual(viewerReceipt!.value.evidenceRefs, [], 'evidence refs are stripped for non-founder viewers');
  assert.equal(viewerReceipt!.value.outputDigest, null, 'output digest is stripped for non-founder viewers');
  const viewerCluster = viewerProjection.nodes.find(
    (node): node is Extract<typeof node, { kind: 'skill-cluster' }> => node.kind === 'skill-cluster' && node.value.clusterId === 'cluster-fabric',
  );
  assert.ok(viewerCluster);
  assert.match(viewerCluster!.value.sourceRef, /^redacted:cluster:cluster-fabric$/);
  assert.doesNotMatch(JSON.stringify(viewerProjection), /evidence-receipt-001/, 'no raw evidence ref leaks into the redacted projection');

  // Founder digest reflects real content; it is not merely asserted to have
  // sha256 shape — it must differ from the redacted viewer digest, and the
  // redacted digest must itself be sha256 and recompute/stay stable.
  assert.match(founderProjection.graphDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(viewerProjection.graphDigest, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(founderProjection.graphDigest, viewerProjection.graphDigest, 'redaction changes the served digest');
  assert.equal(viewerProjection.graphDigest, projectionDigest(viewerProjection), 'redacted digest recomputes exactly');

  const viewerAgain = await requestFabric({ userId: NON_FOUNDER_ID, viewerIds: [NON_FOUNDER_ID] });
  assert.equal(viewerAgain.json.projection.graphDigest, viewerProjection.graphDigest, 'redacted digest is stable across repeated requests for the same viewer');
});

test('zero-gap shadow parity for the pilot fixture', async () => {
  const result = await requestFabric({ query: '?shadow=1' });
  assert.equal(result.status, 200);
  const shadow = result.json.shadow;
  assert.ok(shadow, 'shadow report is present for an allowlisted diagnostic request');
  assert.equal(shadow.branchFacts, 2);
  assert.equal(shadow.representedFacts, 2);
  assert.deepEqual(shadow.missingIds, []);
  assert.deepEqual(shadow.unexpectedIds, []);
  assert.equal(result.json.promotionBlocked, false, 'zero-gap parity explicitly sets promotionBlocked to false, not undefined');
  assert.equal(result.spies.d1Writes, 0);
  assert.equal(result.spies.kvWrites, 0);
});

test('zero D1/KV writes hold even under shadow diagnostics and repeated reads', async () => {
  const a = await requestFabric({ query: '?shadow=1' });
  const b = await requestFabric({});
  assert.equal(a.spies.d1Writes, 0);
  assert.equal(a.spies.kvWrites, 0);
  assert.equal(b.spies.d1Writes, 0);
  assert.equal(b.spies.kvWrites, 0);
});

test('allowlist-off closes the route and never activates the operating-fabric bundle', async () => {
  const result = await requestFabric({ allowlist: [] });
  assert.equal(result.status, 403);
  assert.equal(result.json.error, 'mission fabric tenant is not enabled');
  assert.equal(result.spies.d1Reads, 0, 'closed route never reaches D1');
  assert.equal(result.spies.kvReads, 0, 'closed route never reaches KV');
});

test('invalid auth never activates the bundle regardless of allowlist state', async () => {
  const noAuth = await requestFabric({ initData: '' });
  assert.equal(noAuth.status, 401);
  assert.equal(noAuth.json.error, 'telegram authentication failed');

  const garbageAuth = await requestFabric({ initData: 'user=not-json&auth_date=1&hash=x&signature=y' });
  assert.equal(garbageAuth.status, 401);
});

test('route/tenant boundaries stay fail-closed', async () => {
  const badTenant = await requestFabric({ tenant: 'Cambium' });
  assert.equal(badTenant.status, 400);
  assert.equal(badTenant.spies.d1Reads, 0);

  const traversal = await requestFabric({ tenant: 'cambium-synthetic%2Fevil' });
  assert.equal(traversal.status, 400);

  const foreignTenant = await requestFabric({ tenant: 'tenant-foreign' });
  assert.equal(foreignTenant.status, 403);
  assert.equal(foreignTenant.spies.d1Reads, 0);
  assert.equal(foreignTenant.spies.kvReads, 0);
});

test('mutating methods are rejected before any authority read', async () => {
  const auth = await signedInitData();
  const { deps, spies } = fabricDeps({ initData: auth.initData, pubKeyHex: auth.pubKeyHex, allowlist: [TENANT] });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await handle(
      { method, path: `/v1/mission-fabric/${TENANT}`, headers: { 'x-telegram-init-data': auth.initData } },
      deps,
    );
    assert.equal(response.status, 405);
  }
  assert.equal(spies.d1Reads, 0);
  assert.equal(spies.kvReads, 0);
});
