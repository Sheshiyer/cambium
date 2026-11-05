// Regenerates the cross-language fixtures in this directory from the real
// TypeScript sources. Run from the repository root:
//   node apps/cambium-mac/Tests/CambiumCoreTests/Fixtures/generate-fixtures.mts
// Expected values come from the server code, never from the Swift algorithm.
import { webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../../../../workers/quests/src');
const load = (name: string) => import(join(src, name));

const { buildMissionFabricProjection } = await load('mission-fabric.ts');
const { FABRIC_SOURCE_FIXTURE } = await load('mission-fabric-fixture.ts');
const { handle, buildDataCheckString } = await load('handler.ts');
const { GOAL_GRAPH_LOADOUT_AUTHORITY } = await load('goal-graph-loadout-registry.ts');
const { founderDecisionHttp } = await load('founder-decision-transport.ts');
const { founderConfirmation } = await load('founder-decision.ts');
const { sha256 } = await load('goal-graph/identity.ts');
void GOAL_GRAPH_LOADOUT_AUTHORITY;

const write = (name: string, value: unknown) => writeFileSync(join(here, name), JSON.stringify(value, null, 2) + '\n');
const subtle = (globalThis.crypto ?? webcrypto).subtle;

// ── 1. Compiler projection over mission-fabric-fixture.ts ──────────────────
const projection = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE, { clock: { now: () => '2026-07-28T09:00:01.000Z' } });
write('mission-fabric-source-projection.json', projection);

// ── 2. Full route envelopes (founder and viewer) for tenant "cambium" ─────
const NOW_ISO = '2026-07-28T09:00:00.000Z';
const NOW_MS = 1_750_000_000_000;
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const VIEWER_ID = '200000099';
const TENANT = 'cambium';

async function signedInitData(userId: string) {
  const pair = (await subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams({ auth_date: String(NOW_MS / 1000 - 10), user: JSON.stringify({ id: Number(userId), first_name: 'Founder' }), query_id: 'AAtest' });
  const { dcs } = buildDataCheckString(fields.toString(), BOT_ID);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(dcs)));
  fields.set('signature', Buffer.from(sig).toString('base64url'));
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

const goalNode = (nodeId: string, externalId: string, parentNodeId: string | null) => ({
  nodeId, tenantId: TENANT, namespace: 'fabric', externalId, parentNodeId, scope: parentNodeId ? 'meso' : 'macro',
  desiredState: `state:${externalId}`, currentState: 'active', owner: 'founder', nextAction: null, waitCondition: null,
  proofRequired: true, reviewAt: null, status: 'active', sourceRef: `goal-graph:${nodeId}`, sourceDigest: `sha256:${'a'.repeat(64)}`,
  graphVersion: 7, metadata: {}, createdAt: NOW_ISO, updatedAt: NOW_ISO,
});
const nodes = [goalNode('gg-mission', 'mission-fabric-foundation', null), goalNode('gg-task', 'task-fabric-contract', 'gg-mission')];
const head = { tenantId: TENANT, graphVersion: 7, graphDigest: `sha256:${'b'.repeat(64)}`, nodeIds: nodes.map((n) => n.nodeId), sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`, committedAt: NOW_ISO };
const envelope = {
  schema: 'quest-ledger-envelope.v1', derivedAt: NOW_ISO, tenant: TENANT,
  branchStories: [
    { branchId: 'branch-cambium', branchKind: 'product', canonicalWorkId: 'sapling:cambium', name: 'Cambium', promotion: { state: 'supervised-branch', currentGate: 'gate-mvp' }, controls: { organRouting: [] }, source: { tenant: TENANT } },
    { branchId: 'branch-acme-client', branchKind: 'client', canonicalWorkId: 'branch:acme-client', name: 'Acme Corp Engagement', vision: { statement: 'acme confidential roadmap' }, arcId: 'arc-acme', source: { tenant: TENANT } },
  ],
  companyPrograms: [{ programId: 'cambium-operating-fabric', tenantId: TENANT, title: 'Cambium Operating Fabric', programKind: 'operations', lifecycle: 'executing', outcomeMetric: 'bounded execution paths', authority: { kind: 'goal-graph', namespace: 'cambium.synthetic.goal-graph', graphVersion: 7 }, missionIds: ['mission-fabric-foundation'] }],
  fabricFacts: {
    sourceKind: 'quest-execution-facts.v1', tenantId: TENANT,
    tasks: [{ taskId: 'task-fabric-contract', missionId: 'mission-fabric-foundation', fence: 7 }],
    fences: [{ taskId: 'task-fabric-contract', currentFence: 7 }],
    runs: [{ runId: 'run-fabric-current', taskId: 'task-fabric-contract', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1', state: 'succeeded', fence: 7, nonce: 'nonce-current', nonceExpiresAt: '2026-07-29T00:00:00.000Z', receiptId: 'receipt-fabric-contract', startedAt: NOW_ISO, terminalAt: '2026-07-28T09:05:00.000Z' }],
    receipts: [{ receiptId: 'receipt-fabric-contract', runId: 'run-fabric-current', taskId: 'task-fabric-contract', status: 'verified', evidenceRef: 'evidence-receipt-001', verifiedAt: '2026-07-28T09:05:00.000Z', durable: true }],
    agents: [{ agentId: 'agent-cambium', state: 'available', capabilities: ['contracts'], currentTaskId: 'task-fabric-contract', sourceRef: 'quest:agent-cambium', lastSeenAt: NOW_ISO }],
    skillClusters: [{ clusterId: 'cluster-fabric', state: 'active', capabilities: ['contracts'], eligibleAgentIds: ['agent-cambium'], sourceRef: 'quest:cluster-fabric' }],
    taskClusterAssignments: [{ taskId: 'task-fabric-contract', clusterId: 'cluster-fabric' }],
    gaps: [],
  },
  ledger: { rows: [], completed: 0, total: 0, current: null },
};
const receipts = [{ receiptId: 'receipt-fabric-contract', tenantId: TENANT, branchId: 'cambium', organId: 'fabric', organName: 'Fabric', fromNodeId: 'gg-task', toNodeId: 'gg-task', observedAt: NOW_ISO, evidenceRefs: ['proof:receipt-fabric-contract'], sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`, graphVersion: 7, status: 'verified' }];

async function route(userId: string) {
  const auth = await signedInitData(userId);
  const kv = new Map([[`ledger:${TENANT}`, JSON.stringify(envelope)]]);
  const deps = {
    kv: { async get(key: string) { return kv.get(key) ?? null; }, async put() { throw new Error('read-only'); }, async list() { return []; } },
    gate: { botId: BOT_ID, pubKeyHex: auth.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS },
    goalGraphStore: { async readHead() { return head; }, async readNodes() { return nodes; }, async commit() { throw new Error('read-only'); } },
    branchMapReceiptStore: { async recordReceipt() { throw new Error('read-only'); }, async listReceipts() { return receipts; } },
    missionFabricTenants: [TENANT], missionFabricViewerIds: [VIEWER_ID], now: () => NOW_ISO,
  };
  const response = await handle({ method: 'GET', path: `/v1/mission-fabric/${TENANT}`, headers: { 'x-telegram-init-data': auth.initData } }, deps as never);
  if (response.status !== 200) throw new Error(`route ${userId} -> ${response.status} ${response.body}`);
  return JSON.parse(response.body as string);
}
write('mission-fabric-envelope-founder.json', await route(FOUNDER_ID));
write('mission-fabric-envelope-viewer.json', await route(VIEWER_ID));

// ── 3. Founder Gate wire vectors from the real transport and decision code ─
const changeSetBody = {
  tenantId: TENANT, expectedHeadDigest: `sha256:${'b'.repeat(64)}`, graphVersion: 8,
  nodesToCreate: [{ nodeId: 'gg-new', externalId: 'task-new/ünï', desiredState: 'ship "it"' }], nodesToUpdate: [], nodesToRemove: [],
  sourceRef: 'telegram:intake/1', sourceDigest: `sha256:${'d'.repeat(64)}`,
};
const changeDigest = `sha256:${sha256(changeSetBody)}`;
const changeSet = { ...changeSetBody, changeDigest, isNoop: false };
const EXPIRES = '2026-07-28T10:00:00.000Z';
const review = {
  status: 'pending', summary: 'Add task-new', consequence: 'Creates one node', reversibility: 'Rejectable before commit',
  founderInspect: { consistent: true, head: { version: 7 }, note: 'path a/b \u2028 ✓' }, fence: 8, expectedHeadVersion: 7,
  approvalNonce: 'nonce-1', approvalExpiresAt: EXPIRES, changeSet,
};
const proposal = {
  id: `${TENANT}:${changeDigest}`, tenantId: TENANT, founderId: 'founder-1', version: 1, changeSet, nonce: 'nonce-1', expiresAt: EXPIRES,
  summary: `${review.summary} Consequence: ${review.consequence} Reversibility: ${review.reversibility}`, review,
};
const rows: any[] = [];
const host = {
  async authenticateRequest() { return { founderId: 'founder-1', tenantId: TENANT, channel: 'curious' }; },
  async readProposal(id: string) { return id === proposal.id ? proposal : null; },
  now: () => '2026-07-28T09:30:00.000Z',
  store: {
    async readDecisionReceipt() { return rows[0] ?? null; },
    async readHead() { return { graphDigest: changeSet.expectedHeadDigest }; },
    async commit(input: any) { rows.push({ tenant_id: TENANT, change_digest: changeDigest, nonce: 'nonce-1', decision: 'approved', intent_version: 1, approver_id: 'founder-1', expires_at: EXPIRES, decided_at: input.now, canonical_json: JSON.stringify({ channel: 'curious' }) }); },
    async reject() { throw new Error('unused'); },
  },
};
const post = async (path: string, body: unknown) => {
  const response = await founderDecisionHttp(new Request(`https://example.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), host as never);
  return { status: response.status, body: await response.json() };
};
const tuple = { proposalId: proposal.id, version: 1, changeDigest, nonce: 'nonce-1', expiresAt: EXPIRES };
const proposalResponse = await post('/v1/founder/proposal', { proposalId: proposal.id });
const confirmation = founderConfirmation(proposal as never, 'approved');
const pending = await post('/v1/founder/status', { ...tuple, decision: 'approved', confirmation: 'status-only' });
const approved = await post('/v1/founder/decision', { ...tuple, decision: 'approved', confirmation });
write('founder-proposal-response.json', proposalResponse);
write('founder-status-pending.json', pending);
write('founder-decision-approved.json', approved);
write('founder-vectors.json', {
  note: 'Produced by founderConfirmation() and sha256() in workers/quests/src.',
  proposalId: proposal.id, approveConfirmation: confirmation, rejectConfirmation: founderConfirmation(proposal as never, 'rejected'),
  reviewSha256: sha256(review), changeDigest,
});
console.log('fixtures written', { projection: projection.graphDigest, founder: proposalResponse.status, approved: approved.body.status, pending: pending.body.status });
