import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, webcrypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handle, buildDataCheckString } from './handler.ts';
import type { GateConfig } from './handler.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import type { BranchMapReceipt } from './branch-map.ts';
import { d1BranchMapReceiptStore } from './branch-map-receipt-store.ts';
import type { BranchMapReceiptD1DatabaseLike, BranchMapReceiptD1StatementLike, BranchMapReceiptStoreLike } from './branch-map-receipt-store.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;
const NOW_MS = 1_750_000_000_000;
const BOT_ID = '900000001';
const FOUNDER_ID = '200000001';

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

class SqliteReceiptD1 implements BranchMapReceiptD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');
  prepare(sql: string): BranchMapReceiptD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: BranchMapReceiptD1StatementLike = {
      bind: (...next: unknown[]) => { values = next; return api; },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
    };
    return api;
  }
}

async function signedInitData(userId = FOUNDER_ID, tamper = false): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams({
    auth_date: String(NOW_MS / 1000 - 10),
    user: JSON.stringify({ id: Number(userId), first_name: 'Founder' }),
    query_id: 'AAtest',
  });
  const { dcs } = buildDataCheckString(fields.toString(), BOT_ID);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(tamper ? `${dcs}tampered` : dcs)));
  fields.set('signature', Buffer.from(sig).toString('base64url'));
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

function node(nodeId: string, parentNodeId: string | null = null): GoalGraphNode {
  return {
    nodeId, tenantId: 'tenant-alpha', namespace: 'iverif', externalId: null,
    parentNodeId, scope: parentNodeId ? 'meso' : 'macro', desiredState: 'review', currentState: 'active',
    owner: 'founder', nextAction: 'inspect', waitCondition: null, proofRequired: true, reviewAt: null,
    status: 'active', sourceRef: `packet:${nodeId}`, sourceDigest: `sha256:${'a'.repeat(64)}`, graphVersion: 7,
    metadata: parentNodeId ? { organ: 'Hands' } : { branch: 'iverif' },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function fixture() {
  const nodes = [node('branch:iverif'), node('branch:iverif:organ:hands', 'branch:iverif')];
  const head: GoalGraphHead = {
    tenantId: 'tenant-alpha', graphVersion: 7, graphDigest: `sha256:${'b'.repeat(64)}`,
    nodeIds: nodes.map((item) => item.nodeId), sourceRef: 'd1:goal-graph:7', sourceDigest: `sha256:${'c'.repeat(64)}`,
    committedAt: '2026-01-01T00:00:00.000Z',
  };
  const receipt: BranchMapReceipt = {
    receiptId: 'receipt-1', tenantId: 'tenant-alpha', branchId: 'iverif', organId: 'hands', organName: 'Hands',
    fromNodeId: 'branch:iverif', toNodeId: 'branch:iverif:organ:hands', observedAt: '2026-01-02T00:00:00.000Z',
    evidenceRefs: ['proof:receipt-1'], sourceRef: nodes[1].sourceRef, sourceDigest: nodes[1].sourceDigest,
    graphVersion: 7, status: 'verified',
  };
  let reads = 0;
  const goalGraphStore: GoalGraphStoreLike = {
    async readHead(tenantId) { reads++; return tenantId === 'tenant-alpha' ? head : null; },
    async readNodes(tenantId) { reads++; return tenantId === 'tenant-alpha' ? nodes : []; },
    async commit() { throw new Error('route must never write Goal Graph'); },
  };
  const branchMapReceiptStore: BranchMapReceiptStoreLike = {
    async recordReceipt() { throw new Error('route must never write receipts'); },
    async appendReceipt() { throw new Error('route must never write receipts'); },
    async record() { throw new Error('route must never write receipts'); },
    async append() { throw new Error('route must never write receipts'); },
    async getReceipt(tenantId, receiptId) { reads++; return tenantId === 'tenant-alpha' && receiptId === receipt.receiptId ? receipt : null; },
    async read(tenantId, receiptId) { return this.getReceipt(tenantId, receiptId); },
    async listReceipts(tenantId) { reads++; return tenantId === 'tenant-alpha' ? [receipt] : []; },
    async list(tenantId) { return this.listReceipts(tenantId); },
  };
  return { goalGraphStore, branchMapReceiptStore, receipt, getReads: () => reads };
}

async function sqliteFixture() {
  const base = fixture();
  const db = new SqliteReceiptD1();
  db.db.exec(readFileSync(new URL('../migrations/0008_branch_transition_receipts.sql', import.meta.url), 'utf8'));
  const branchMapReceiptStore = d1BranchMapReceiptStore(db);
  const result = await branchMapReceiptStore.recordReceipt(base.receipt, '2026-01-02T00:00:00.000Z');
  assert.equal(result.status, 'stored');
  return { ...base, branchMapReceiptStore };
}

function request(path: string, headers: Record<string, string> = {}) {
  return { method: 'GET', path, headers } as const;
}

test('signed branch-map route returns projection, Telegram sheet, and bound proof', async () => {
  const auth = await signedInitData();
  const stores = await sqliteFixture();
  const gate: GateConfig = { botId: BOT_ID, pubKeyHex: auth.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS };
  const response = await handle(request('/v1/branch-map/tenant-alpha', { 'x-telegram-init-data': auth.initData }), {
    kv: { async get() { return null; }, async put() {}, async list() { return []; } },
    gate, goalGraphStore: stores.goalGraphStore, branchMapReceiptStore: stores.branchMapReceiptStore,
    branchMapTenants: ['tenant-alpha'], now: () => '2026-01-03T00:00:00.000Z',
  });
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.schema, 'cambium.telegram.branch-map-route.v1');
  assert.equal(body.projection.projectionDigest, body.proof.projectionDigest);
  assert.match(body.sheet.text, /Branch map · tenant-alpha · graph 7/);
  assert.match(body.sheet.text, /Hands/);
  assert.match(body.proof.proofDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(body.proof.sheetEnvelopeDigest, `sha256:${createHash('sha256').update(stableJson(body.sheet), 'utf8').digest('hex')}`);
  assert.equal(body.proof.sheetTextDigest, `sha256:${createHash('sha256').update(body.sheet.text, 'utf8').digest('hex')}`);
  const { proofDigest: _proofDigest, ...proofBody } = body.proof;
  assert.equal(body.proof.proofDigest, `sha256:${createHash('sha256').update(stableJson(proofBody), 'utf8').digest('hex')}`);
  assert.doesNotMatch(response.body, /rawInitData|query_id=|auth_date=|secret|Bearer/i);
  assert.equal(stores.getReads(), 2);
});

test('signature tampering fails before D1 reads', async () => {
  const auth = await signedInitData(FOUNDER_ID, true);
  const stores = fixture();
  const response = await handle(request('/v1/branch-map/tenant-alpha', { 'x-telegram-init-data': auth.initData }), {
    kv: { async get() { return null; }, async put() {}, async list() { return []; } },
    gate: { botId: BOT_ID, pubKeyHex: auth.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS },
    goalGraphStore: stores.goalGraphStore, branchMapReceiptStore: stores.branchMapReceiptStore,
    branchMapTenants: ['tenant-alpha'],
  });
  assert.equal(response.status, 401);
  assert.equal(stores.getReads(), 0);
});

test('tenant substitution is rejected before projection', async () => {
  const auth = await signedInitData();
  const stores = fixture();
  const response = await handle(request('/v1/branch-map/tenant-beta', { 'x-telegram-init-data': auth.initData }), {
    kv: { async get() { return null; }, async put() {}, async list() { return []; } },
    gate: { botId: BOT_ID, pubKeyHex: auth.pubKeyHex, founderIds: [FOUNDER_ID], now: () => NOW_MS },
    goalGraphStore: stores.goalGraphStore, branchMapReceiptStore: stores.branchMapReceiptStore,
    branchMapTenants: ['tenant-alpha'],
  });
  assert.equal(response.status, 403);
  assert.equal(stores.getReads(), 0);
});
