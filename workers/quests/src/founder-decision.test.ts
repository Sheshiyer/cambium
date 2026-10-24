import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { compileGoalGraph } from './goal-graph/compiler.ts';
import { buildNode } from './goal-graph/identity.ts';
import {
  canonicalizeGoalGraphApproval,
  d1GoalGraphStore,
  goalGraphApprovalDigest,
} from './goal-graph-store.ts';
import type { GoalGraphD1DatabaseLike, GoalGraphD1StatementLike, GoalGraphApproval } from './goal-graph-store.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';

const TENANT = 'tenant-alpha';
const NOW = '2026-07-23T00:00:00.000Z';
const EXPIRES = '2026-07-23T01:00:00.000Z';

class SqliteD1 implements GoalGraphD1DatabaseLike {
  readonly db = new DatabaseSync(':memory:');

  prepare(sql: string): GoalGraphD1StatementLike {
    const statement = this.db.prepare(sql);
    let values: unknown[] = [];
    const api: GoalGraphD1StatementLike = {
      bind: (...next: unknown[]) => {
        values = next;
        return api;
      },
      first: async <T>() => (statement.get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: statement.all(...values) as T[] }),
      run: async () => {
        const result = statement.run(...values);
        return { meta: { changes: Number(result.changes) } };
      },
    };
    return api;
  }

  async batch(statements: GoalGraphD1StatementLike[]): Promise<unknown[]> {
    this.db.exec('BEGIN');
    try {
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

async function harness() {
  const db = new SqliteD1();
  db.db.exec(await readFile(new URL('../migrations/0007_goal_graph.sql', import.meta.url), 'utf8'));
  db.db.exec(await readFile(new URL('../migrations/0009_goal_graph_operational_anchors.sql', import.meta.url), 'utf8'));
  return { db, store: d1GoalGraphStore(db) };
}

function rootNode(overrides: Partial<GoalGraphNode> = {}): GoalGraphNode {
  return buildNode({
    tenantId: TENANT,
    namespace: 'manual',
    externalId: 'root',
    parentNodeId: null,
    scope: 'macro',
    desiredState: 'operate Cambium',
    currentState: 'draft',
    owner: 'founder',
    nextAction: 'review',
    waitCondition: null,
    proofRequired: true,
    reviewAt: null,
    status: 'active',
    sourceRef: 'test:root',
    sourceDigest: `sha256:${'1'.repeat(64)}`,
    graphVersion: 1,
    metadata: {},
    now: NOW,
    ...overrides,
  });
}

function proposal(nodes: readonly GoalGraphNode[], expectedHeadDigest: string | null, graphVersion: number, sourceRef = 'test:proposal') {
  const result = compileGoalGraph({
    tenantId: TENANT,
    expectedHeadDigest,
    actualHead: expectedHeadDigest ? { tenantId: TENANT, graphVersion: graphVersion - 1, graphDigest: expectedHeadDigest, nodeIds: nodes.map((node) => node.nodeId), sourceRef: null, sourceDigest: null, committedAt: NOW } : null,
    currentNodes: nodes,
    proposedNodes: nodes,
    graphVersion,
    sourceRef,
    sourceDigest: `sha256:${'2'.repeat(64)}`,
    now: NOW,
  });
  assert.equal(result.status, 'compiled');
  if (result.status !== 'compiled') throw new Error('proposal did not compile');
  return result.changeSet;
}

function approval(changeDigest: string, overrides: Partial<GoalGraphApproval> = {}): GoalGraphApproval {
  const value = {
    tenantId: TENANT,
    changeDigest,
    intentVersion: 1,
    approverId: 'founder',
    decision: 'approved' as const,
    expiresAt: EXPIRES,
    nonce: `nonce-${changeDigest.slice(0, 8)}`,
    ...overrides,
  };
  return {
    ...value,
    canonical: canonicalizeGoalGraphApproval(value),
    approvalDigest: goalGraphApprovalDigest(value),
  };
}


import { founderDecision, founderConfirmation } from './founder-decision.ts';

async function setup() {
 const { db, store } = await harness();
 const p = { id: 'proposal-1', tenantId: TENANT, founderId: 'founder', version: 1,
 changeSet: proposal([rootNode()], null, 1), nonce: 'nonce-proposal-1', expiresAt: EXPIRES, summary: 'Create reviewed root.' };
 const deps = { store, readProposal: async () => p, authenticate: async () => ({ founderId: 'founder', tenantId: TENANT, channel: 'plugin' as const }), now: () => NOW };
 const input = { proposalId: p.id, version: 1, changeDigest: p.changeSet.changeDigest, nonce: p.nonce, expiresAt: EXPIRES, decision: 'approved' as const, confirmation: founderConfirmation(p, 'approved') };
 return { db, store, p, deps, input };
}
test('cross-channel approve once returns original channel receipt', async () => {
 const { db, deps, input } = await setup();
 assert.equal((await founderDecision(deps, input)).status, 'approved');
 const second = await founderDecision({ ...deps, authenticate: async () => ({ founderId: 'founder', tenantId: TENANT, channel: 'telegram' }) }, input);
 assert.equal(second.status, 'approved'); assert.equal(second.receipt?.channel, 'plugin');
 assert.equal(db.db.prepare('SELECT count(*) AS n FROM goal_graph_approvals').get()?.n, 1);
});
test('opposite concurrent decisions settle through existing D1 primary key', async () => {
 const { db, deps, p, input } = await setup();
 const reject = { ...input, decision: 'rejected' as const, confirmation: founderConfirmation(p, 'rejected') };
 const outcomes = await Promise.all([founderDecision(deps, input), founderDecision(deps, reject)]);
 assert.equal(db.db.prepare('SELECT count(*) AS n FROM goal_graph_approvals').get()?.n, 1);
 const row = db.db.prepare('SELECT decision FROM goal_graph_approvals').get();
 assert.ok(row?.decision === 'approved' || row?.decision === 'rejected');
 const final = await founderDecision(deps, input, true); assert.equal(final.status, row?.decision);
 assert.ok(outcomes.every(x => ['approved','rejected','conflict'].includes(x.status)));
 assert.equal(outcomes.filter(x=>x.status==='conflict').length,1);
});
test('changed, expired, wrong founder/tenant and broad direction cause zero writes', async () => {
 const { db, deps, input } = await setup();
 assert.equal((await founderDecision(deps, { ...input, version: 2 })).status, 'changed');
 assert.equal((await founderDecision(deps, { ...input, changeDigest: 'changed' })).status, 'changed');
 assert.equal((await founderDecision(deps, { ...input, confirmation: 'go ahead' })).status, 'confirmation_required');
 assert.equal((await founderDecision({ ...deps, now: () => EXPIRES }, input)).status, 'expired');
 for (const identity of [{founderId:'other',tenantId:TENANT},{founderId:'founder',tenantId:'other'}])
 assert.equal((await founderDecision({...deps,authenticate:async()=>({...identity,channel:'curious'})},input)).status,'forbidden');
 assert.equal(db.db.prepare('SELECT count(*) AS n FROM goal_graph_approvals').get()?.n, 0);
});
test('lost write response reconciles through authoritative D1 readback', async () => {
 const { deps, input, store } = await setup(); let writes = 0;
 deps.store = { ...store, commit: async args => { writes++; await store.commit(args); throw Error('response lost'); } };
 assert.equal((await founderDecision(deps,input)).status,'approved');
 assert.equal((await founderDecision(deps,input)).status,'approved'); assert.equal(writes,1);
});
test('unknown readback never retries a write; status can later reconcile', async () => {
 const { deps, input, store } = await setup(); let reads=0, writes=0;
 deps.store = { ...store, commit: async args => { writes++; return store.commit(args); }, readDecisionReceipt: async (...args) => { if (++reads===2) throw Error('read lost'); return store.readDecisionReceipt(...args); } };
 assert.equal((await founderDecision(deps,input)).status,'unknown');
 assert.equal((await founderDecision(deps,input,true)).status,'approved'); assert.equal(writes,1);
});
test('stale head rejects without a second decision', async () => {
 const { deps, input, store } = await setup();
 deps.store={...store,readHead:async()=>({graphDigest:'changed'} as any)};
 assert.equal((await founderDecision(deps,input)).status,'stale');
});

test('rejection first is canonical across channels and conflicts with approval', async () => {
 const { deps, input, p, db } = await setup();
 const rejected = await founderDecision(deps, {...input,decision:'rejected',confirmation:founderConfirmation(p,'rejected')});
 assert.equal(rejected.status,'rejected');
 const replay = await founderDecision({...deps,authenticate:async()=>({founderId:'founder',tenantId:TENANT,channel:'curious'})},input,true);
 assert.equal(replay.status,'rejected'); assert.equal(replay.receiptDigest,rejected.receiptDigest);
 assert.equal((await founderDecision(deps,input)).status,'conflict');
 assert.equal(db.db.prepare('SELECT count(*) AS n FROM goal_graph_nodes').get()?.n,0);
});
test('unauthenticated caller cannot inspect or decide', async () => {
 const { deps, input } = await setup(); let reads=0;
 deps.readProposal=async()=>{reads++;throw Error('must not read');};
 assert.equal((await founderDecision({...deps,authenticate:async()=>null},input)).status,'unauthorized'); assert.equal(reads,0);
});

test('closed decision input refuses extra authority claims', async () => {
 const { deps, input } = await setup();
 assert.equal((await founderDecision(deps,{...input,founderId:'founder'} as any)).status,'invalid');
});

import { founderDecisionHttp, founderDecisionTool } from './founder-decision-transport.ts';
test('MCP decision then HTTP status reads one canonical receipt across transports', async () => {
 const { deps, input, db } = await setup();
 const host = { ...deps, authenticateRequest: async (req: Request) => req.headers.get('x-test-auth') === 'verified'
   ? {founderId:'founder',tenantId:TENANT,channel:'plugin' as const} : null };
 const request = new Request('https://example.invalid/mcp',{headers:{'x-test-auth':'verified'}});
 const first = await founderDecisionTool('decide_founder_proposal',input,request,host);
 assert.equal(first.status,200); const original=await first.json();
 const status=await founderDecisionHttp(new Request('https://example.invalid/v1/founder/status',{
 method:'POST',headers:{'content-type':'application/json','x-test-auth':'verified'},body:JSON.stringify(input)}),{
 ...host,authenticateRequest:async()=>({founderId:'founder',tenantId:TENANT,channel:'curious'})});
 assert.equal(status.status,200);assert.equal((await status.json()).receiptDigest,original.receiptDigest);
 assert.equal(db.db.prepare('SELECT count(*) AS n FROM goal_graph_approvals').get()?.n,1);
});
test('HTTP and MCP fail closed without host or authenticated principal', async () => {
 const { deps,input,db } = await setup();
 const request=new Request('https://example.invalid/mcp');
 assert.equal((await founderDecisionTool('decide_founder_proposal',input,request)).status,503);
 assert.equal((await founderDecisionTool('decide_founder_proposal',input,request,{...deps,authenticateRequest:async()=>null})).status,401);
 assert.equal(db.db.prepare('SELECT count(*) AS n FROM goal_graph_approvals').get()?.n,0);
});
