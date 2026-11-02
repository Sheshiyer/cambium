// Regenerates the fabric-* contract vectors from the real TypeScript sources.
// Run from the repository root:
//   node apps/cambium-mac/Tests/CambiumCoreTests/Fixtures/fabric-generate.mts
// Every expected value comes from server code (handler route, compiler,
// redactor, canonicalizer, portfolio pair digest). Swift never supplies one.
import { webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../../../../workers/quests/src');
const load = (name: string) => import(join(src, name));

const { canonicalizeGraphContent, projectionDigest, redactMissionFabricProjection } = await load('mission-fabric.ts');
const { handle, buildDataCheckString } = await load('handler.ts');
const { portfolioPairDigest } = await load('portfolio-catalog.ts');

const write = (name: string, value: unknown) => writeFileSync(join(here, name), JSON.stringify(value, null, 2) + '\n');
const subtle = (globalThis.crypto ?? webcrypto).subtle;

// ── 1. Canonical JSON edge vectors through canonicalizeGraphContent ───────
// `json` is the exact wire text; Swift parses the same text.
const node = (inner: string) => `{"projectionVersion":1,"tenantId":"t","graphVersion":1,"sourceOfTruth":"d1-goal-graph","readOnly":true,"nodes":[${inner}],"edges":[],"gaps":[]}`;
const vectorTexts: Array<{ name: string; json: string; swiftRejects?: string }> = [
  { name: 'integers', json: node('{"n":[0,1,-1,7,9007199254740991,9007199254740993,-9007199254740993]}') },
  { name: 'negative-zero', json: node('{"n":-0,"m":-0.0}') },
  { name: 'fractions', json: node('{"n":[1.5,0.1,0.2,-2.25,1.0,100.0,3.141592653589793]}') },
  { name: 'exponent-thresholds', json: node('{"n":[1e20,1e21,123456789012345680000,1e-6,1e-7,0.000001,0.0000001,1.5e-10,2e300,5e-324,1.7976931348623157e308]}') },
  { name: 'large-integer-forms', json: node('{"n":[1e15,1e16,12345678901234567890,4294967296,1E3]}') },
  { name: 'booleans-null', json: node('{"t":true,"f":false,"z":null,"a":[true,false,null,0,1]}') },
  { name: 'string-escapes', json: node('{"s":"q\\"b\\\\s/\\b\\f\\n\\r\\t\\u0000\\u001f\\u007f"}') },
  { name: 'unicode-text', json: node('{"s":["é","e\\u0301","\\u2028\\u2029","😀","\\ud83d\\ude00","ſ","İ"]}') },
  { name: 'utf16-key-order', json: node('{"\\uFFFD":1,"😀":2,"z":3,"Z":4,"é":5,"ﬁ":6,"a":7}') },
  { name: 'nested-sort', json: node('{"b":{"y":1,"x":[{"k2":1,"k1":2}]},"a":[]}') },
  { name: 'canonically-equivalent-keys', json: node('{"é":1,"e\\u0301":2}'), swiftRejects: 'Swift String keys are canonically equivalent, so the decoder fails closed on this object.' },
];
const vectors = vectorTexts.map((vector) => {
  const parsed = JSON.parse(vector.json);
  return { ...vector, canonical: canonicalizeGraphContent(parsed), digest: projectionDigest(parsed) };
});
write('fabric-canonical-vectors.json', { note: 'canonicalizeGraphContent()/projectionDigest() from workers/quests/src/mission-fabric.ts', vectors });

// ── 2. Route envelopes beyond the existing founder/viewer pair ──────────────
const NOW_ISO = '2026-07-28T09:00:00.000Z';
const NOW_MS = 1_750_000_000_000;
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';
const VIEWER_ID = '200000099';

async function signedInitData(userId: string) {
  const pair = (await subtle.generateKey('Ed25519', true, ['sign', 'verify'])) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams({ auth_date: String(NOW_MS / 1000 - 10), user: JSON.stringify({ id: Number(userId), first_name: 'Reader' }), query_id: 'AAtest' });
  const { dcs } = buildDataCheckString(fields.toString(), BOT_ID);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(dcs)));
  fields.set('signature', Buffer.from(sig).toString('base64url'));
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

function routeInputs(tenant: string, extraTasks = 0) {
  const goalNode = (nodeId: string, externalId: string, parentNodeId: string | null) => ({
    nodeId, tenantId: tenant, namespace: 'fabric', externalId, parentNodeId, scope: parentNodeId ? 'meso' : 'macro',
    desiredState: `state:${externalId}`, currentState: 'active', owner: 'founder', nextAction: null, waitCondition: null,
    proofRequired: true, reviewAt: null, status: 'active', sourceRef: `goal-graph:${nodeId}`, sourceDigest: `sha256:${'a'.repeat(64)}`,
    graphVersion: 7, metadata: {}, createdAt: NOW_ISO, updatedAt: NOW_ISO,
  });
  const nodes = [goalNode('gg-mission', 'mission-fabric-foundation', null), goalNode('gg-task', 'task-fabric-contract', 'gg-mission')];
  const head = { tenantId: tenant, graphVersion: 7, graphDigest: `sha256:${'b'.repeat(64)}`, nodeIds: nodes.map((n) => n.nodeId), sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`, committedAt: '2026-07-27T09:00:00.000Z' };
  const envelope = {
    schema: 'quest-ledger-envelope.v1', derivedAt: NOW_ISO, tenant,
    branchStories: [
      { branchId: `branch-${tenant}`, branchKind: 'product', canonicalWorkId: `sapling:${tenant}`, name: tenant, promotion: { state: 'proof-only', currentGate: 'gate-mvp' }, controls: { organRouting: [{ organ: 'hands' }, { organ: 'genesis' }] }, source: { tenant } },
      { branchId: 'branch-acme-client', branchKind: 'client', canonicalWorkId: 'branch:acme-client', name: 'Acme Corp Engagement', vision: { statement: 'acme confidential roadmap' }, arcId: 'arc-acme', source: { tenant } },
      { branchId: 'branch-missing-identity', branchKind: 'product', name: 'No canonical id', source: { tenant } },
    ],
    companyPrograms: [],
    fabricFacts: {
      sourceKind: 'quest-execution-facts.v1', tenantId: tenant,
      tasks: [
        { taskId: 'task-fabric-contract', missionId: 'mission-fabric-foundation', fence: 7 },
        ...Array.from({ length: extraTasks }, (_, i) => ({ taskId: `task-cap-${String(i).padStart(3, '0')}`, missionId: 'mission-fabric-foundation', fence: 7 })),
      ],
      fences: [{ taskId: 'task-fabric-contract', currentFence: 7 }],
      runs: [
        { runId: 'run-fabric-current', taskId: 'task-fabric-contract', executorAgentId: 'agent-cambium', loadoutId: 'loadout-a1', state: 'succeeded', fence: 7, nonce: 'nonce-current', nonceExpiresAt: '2026-07-29T00:00:00.000Z', receiptId: 'receipt-fabric-contract', startedAt: NOW_ISO, terminalAt: '2026-07-28T09:05:00.000Z' },
        { runId: 'run-fabric-orphan', taskId: 'task-fabric-contract', executorAgentId: 'agent-ghost', loadoutId: 'loadout-a1', state: 'running', fence: 7, nonce: 'nonce-orphan', nonceExpiresAt: '2026-07-29T00:00:00.000Z', receiptId: '', startedAt: NOW_ISO, terminalAt: null },
      ],
      receipts: [{ receiptId: 'receipt-fabric-contract', runId: 'run-fabric-current', taskId: 'task-fabric-contract', status: 'verified', evidenceRef: 'evidence-receipt-001', verifiedAt: '2026-07-28T09:05:00.000Z', durable: true }],
      agents: [{ agentId: 'agent-cambium', state: 'available', capabilities: ['contracts'], currentTaskId: 'task-fabric-contract', sourceRef: 'quest:agent-cambium', lastSeenAt: NOW_ISO }],
      skillClusters: [{ clusterId: 'cluster-fabric', state: 'active', capabilities: ['contracts'], eligibleAgentIds: ['agent-cambium'], sourceRef: 'quest:cluster-fabric' }],
      taskClusterAssignments: [{ taskId: 'task-fabric-contract', clusterId: 'cluster-fabric' }],
      gaps: [],
    },
    ledger: { rows: [], completed: 0, total: 0, current: null },
  };
  const receipts = [{ receiptId: 'receipt-fabric-contract', tenantId: tenant, branchId: tenant, organId: 'fabric', organName: 'Fabric', fromNodeId: 'gg-task', toNodeId: 'gg-task', observedAt: NOW_ISO, evidenceRefs: ['proof:receipt-fabric-contract'], sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`, graphVersion: 7, status: 'verified' }];
  return { nodes, head, envelope, receipts };
}

async function route(tenant: string, userId: string, query = '', extraTasks = 0) {
  const auth = await signedInitData(userId);
  const { nodes, head, envelope, receipts } = routeInputs(tenant, extraTasks);
  const kv = new Map([[`ledger:${tenant}`, JSON.stringify(envelope)]]);
  const deps = {
    kv: { async get(key: string) { return kv.get(key) ?? null; }, async put() { throw new Error('read-only'); }, async list() { return []; } },
    gate: { botId: BOT_ID, pubKeyHex: auth.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS },
    goalGraphStore: { async readHead() { return head; }, async readNodes() { return nodes; }, async commit() { throw new Error('read-only'); } },
    branchMapReceiptStore: { async recordReceipt() { throw new Error('read-only'); }, async listReceipts() { return receipts; } },
    missionFabricTenants: [tenant], missionFabricViewerIds: [VIEWER_ID], now: () => NOW_ISO,
  };
  const response = await handle({ method: 'GET', path: `/v1/mission-fabric/${tenant}${query}`, headers: { 'x-telegram-init-data': auth.initData } }, deps as never);
  if (response.status !== 200) throw new Error(`route ${tenant} ${userId} -> ${response.status} ${response.body}`);
  return { body: JSON.parse(response.body as string), etag: response.headers.etag };
}

const shadow = await route('cambium', FOUNDER_ID, '?shadow=1');
write('fabric-route-cambium-founder-shadow.json', shadow.body);
const acmeFounder = await route('acme', FOUNDER_ID);
const acmeViewer = await route('acme', VIEWER_ID);
write('fabric-route-acme-founder.json', acmeFounder.body);
write('fabric-route-acme-viewer.json', acmeViewer.body);
// Over-cap composition: the handler slices sorted nodes and edges independently
// and reports `projection-truncated`, so some retained edges name omitted nodes.
const capTruncation = await route('acme', FOUNDER_ID, '', 600);
write('fabric-route-cap-truncation.json', capTruncation.body);

// ── 3. Server-computed expectations for the Swift tests ──────────────────────
const redactedShadow = redactMissionFabricProjection(shadow.body.projection, { role: 'viewer', tenantId: 'cambium' });
write('fabric-expectations.json', {
  note: 'etag/graph digests from handle(); redaction from redactMissionFabricProjection(); pair from portfolioPairDigest().',
  cambiumShadow: {
    etag: shadow.etag,
    graphDigest: shadow.body.projection.graphDigest,
    viewerRedactedGraphDigest: redactedShadow.graphDigest,
    pairDigest: portfolioPairDigest(shadow.body.projection.graphDigest, shadow.body.portfolioCatalogSummary.actionCatalogDigest),
  },
  acme: {
    founderEtag: acmeFounder.etag,
    viewerEtag: acmeViewer.etag,
    founderGraphDigest: acmeFounder.body.projection.graphDigest,
    viewerGraphDigest: acmeViewer.body.projection.graphDigest,
    founderRedactedForViewer: redactMissionFabricProjection(acmeFounder.body.projection, { role: 'viewer', tenantId: 'acme' }).graphDigest,
  },
  capTruncation: {
    graphDigest: capTruncation.body.projection.graphDigest,
    nodeCount: capTruncation.body.projection.nodes.length,
    truncationGapIds: capTruncation.body.projection.gaps.filter((gap: { kind: string }) => gap.kind === 'projection-truncated').map((gap: { gapId: string }) => gap.gapId),
  },
});
console.log('fabric fixtures written', { vectors: vectors.length, shadow: shadow.etag, acme: acmeFounder.etag });
