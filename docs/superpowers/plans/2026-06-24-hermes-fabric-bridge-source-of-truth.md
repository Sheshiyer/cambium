# Hermes Fabric Bridge Source Of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the active Cambium source tree so it contains the same Hermes/Cambium/Plexus Fabric v1 bridge behavior that was live-proven on June 23, 2026.

**Architecture:** Keep `workers/quests/src/handler.ts` as the pure, Node-testable Worker handler. Rehydrate the bridge routes and storage abstractions from the verified backup patch into the active `origin/main` checkout, then wire Cloudflare D1 through `workers/quests/src/index.ts` while preserving KV fallback for tests and local bridge handoff flows. Hermes and Plexus remain verification surfaces only in this plan; this pass does not redesign the Fabric contract.

**Tech Stack:** TypeScript, Cloudflare Worker-style pure handler, `node:test`, Cloudflare KV, Cloudflare D1 binding `BRIDGE_DB`, scoped Worker secret `HERMES_ASSIGNMENT_TOKEN`, existing bridge HMAC helpers, preserved backup patch artifacts under `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/`.

## Global Constraints

- Preserve the Fabric v1 contract: `Cambium task -> Hermes directive -> Plexus task view -> employee report -> Hermes summary -> Cambium/Paperclip proof`.
- Keep assignments member-scoped; do not introduce role-pool assignment in this pass.
- Keep `workMode` limited to `manual | delegated`; lifecycle `status` remains separate.
- Keep Hermes/admin override audited and bounded; do not add a normal second work-mode picker.
- Keep v1 display/report only; do not add task execution to Plexus or Cambium in this pass.
- Do not expose Worker admin `BRIDGE_TOKEN` to Plexus or renderer code.
- Let scoped `HERMES_ASSIGNMENT_TOKEN` enqueue assignments and consume Fabric reports only; review/admin routes still require full admin token.
- Keep local Paperclip bridge health separate from remote Thoughtseed/Hermes bridge proof in docs and closeout.
- Treat note-only engineering completion as `weak_evidence`; upgrade only when stronger proof exists.
- Preserve dirty-worktree discipline; execute from a fresh branch or worktree and do not revert unrelated files.

---

## Scope Check

This is one Cambium-centered source-of-truth repair plan. Hermes and Plexus are referenced for verification only because the hosted proof and live handoff already exist. If execution discovers that Hermes or Plexus active source has drifted too, create separate plans in those repos instead of expanding this one.

## Current State Evidence

- Active repo: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium`
- Current `HEAD`: detached at `origin/main` commit `a6c39cd`.
- Active handler has `/v1/bridge/ingest`, `/v1/bridge/directive`, `/v1/bridge/directives/:memberId`, `/v1/bridge/ack`, and handoff token flow.
- Active schema already includes `bridge_assignments`, `fabric_tasks`, `fabric_task_events`, `fabric_evidence_candidates`, and `fabric_evidence_reviews`.
- Active handler does not currently expose `/v1/bridge/assign-task`, `/v1/fabric/consume`, Fabric review routes, D1 bridge store abstractions, `BRIDGE_DB`, or `HERMES_ASSIGNMENT_TOKEN` runtime wiring.
- Verified backup patch source: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch`
- Backup integrity proof: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/SHA256SUMS.checked.txt`
- Backup README says the dirty state is preserved and current main was kept because split lanes were reviewed separately.
- Live proof memory says deployed Cambium consumed `3`, conflicted `0`, upgraded `1`, and Worker version was `f51bbb48-f73b-482a-a8fe-fcaa5efcad34`.

## File Structure

- Modify `workers/quests/src/handler.ts`: add Fabric record types, bridge/fabric store interfaces, KV-backed bridge store fallback, assignment normalizers, Fabric consume/evidence review helpers, `/v1/bridge/assign-task`, `/v1/fabric/*` routes, and scoped assignment-token auth.
- Modify `workers/quests/src/handler.test.ts`: add in-memory Fabric ledger, assignment route tests, scoped token tests, consume idempotency/conflict tests, and evidence candidate review tests.
- Modify `workers/quests/src/index.ts`: add `BRIDGE_DB` and `HERMES_ASSIGNMENT_TOKEN` to the Worker Env, add D1 bridge/fabric store factories, and pass those stores into `handle`.
- Verify `workers/quests/schema/bridge.sql`: no schema rewrite is expected because the required Fabric tables already exist; only update it if a test proves an active source mismatch.
- Create `docs/evidence/2026-06-24-hermes-fabric-source-of-truth.md`: record source restoration, tests, live route probes, and the distinction between local Paperclip health and remote Thoughtseed/Hermes bridge status.

## Restoration Anchors

Use the backup patch as the exact implementation source, not as loose inspiration:

```bash
sed -n '7794,8275p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
sed -n '8316,8640p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
sed -n '8933,9385p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

The restored source must keep these names stable because tests and sibling handoff docs rely on them:

```ts
export type FabricEvidenceCandidateStatus = 'verified_evidence' | 'review_pending' | 'rejected_candidate';
export interface FabricLedgerTaskRecord { taskId: string; projectId: string; memberId: string; status: string; workMode?: string | null; evidenceStrength: string; title?: string | null; payload: Record<string, unknown>; updatedAt: string; }
export interface FabricLedgerEventRecord { eventId: string; taskId: string; projectId: string; memberId: string; type: string; source: string; payloadHash: string; payload: Record<string, unknown>; correlationId?: string | null; receivedAt: string; }
export interface FabricEvidenceCandidateRecord { candidateId: string; taskId: string; projectId: string; memberId: string; status: FabricEvidenceCandidateStatus; confidence: string; matchKind: string; evidence: Record<string, unknown>; reason: string; createdAt: string; reviewedAt?: string | null; reviewActor?: string | null; reviewReason?: string | null; }
export interface FabricEvidenceReviewRecord { reviewId: string; candidateId: string; outcome: string; actor: string; reason?: string | null; reviewedAt: string; }
export interface FabricLedgerStoreLike { getEvent(eventId: string): Promise<FabricLedgerEventRecord | null>; putEvent(record: FabricLedgerEventRecord): Promise<void>; getTask(taskId: string): Promise<FabricLedgerTaskRecord | null>; findTasks(): Promise<FabricLedgerTaskRecord[]>; upsertTask(record: FabricLedgerTaskRecord): Promise<void>; putEvidenceCandidate(record: FabricEvidenceCandidateRecord): Promise<void>; getEvidenceCandidate(candidateId: string): Promise<FabricEvidenceCandidateRecord | null>; listReviewItems(): Promise<FabricEvidenceCandidateRecord[]>; updateEvidenceCandidate(record: FabricEvidenceCandidateRecord): Promise<void>; putEvidenceReview(record: FabricEvidenceReviewRecord): Promise<void>; }
```

## Task 1: Rehydrate Assignment Directive Route

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: existing `handle(req, deps)`, `KvLike`, `bridgeSignature`, `canonicalJson`, `sha256hex`.
- Produces: `POST /v1/bridge/assign-task`, `HandlerDeps.assignmentToken?: string`, `BridgeStoreLike`, `BridgeAssignmentRecord`, `kvBridgeStore(deps.kv)`, `assignmentEventId(projectId, taskId)`, `normalizeAssignmentTask(raw, memberId)`.

- [ ] **Step 1: Write the failing assignment route test**

Add this test to `workers/quests/src/handler.test.ts` after `bridge · admin queues and Paperclip acknowledges directives`:

```ts
test('bridge · Cambium emits live project task assignment directives', async () => {
  const kv = fakeKv();
  let uuidIndex = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    now: () => '2026-06-22T08:00:00.000Z',
    uuid: () => `assign-${++uuidIndex}`,
  };
  const assignment = {
    memberId: 'mathis',
    task: {
      taskId: 'task-fitcheck-brief',
      projectId: 'fitcheck-product',
      projectName: 'FitCheck Product',
      questId: 'quest-77',
      clientId: 'fitcheck',
      clientName: 'FitCheck',
      title: 'Prepare branch proof packet',
      description: 'Collect branch, PR, and preview evidence before final report.',
      priority: 'high',
      taskType: 'engineering',
    },
  };

  const denied = await handle(req('POST', '/v1/bridge/assign-task', {
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(denied.status, 401);

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).id, 'assign-1');
  assert.equal(body(queued).eventId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const pendingBody = body(pending);
  assert.equal(pendingBody.count, 1);
  const directive = pendingBody.directives[0];
  assert.equal(directive.direction, 'downstream');
  assert.equal(directive.memberId, 'mathis');
  assert.equal(directive.payload.type, 'project_task_assignment');
  assert.equal(directive.payload.schema, 'thoughtseed.project_task_assignment.v1');
  assert.equal(directive.payload.source, 'cambium');
  assert.equal(directive.payload.target.memberId, 'mathis');
  assert.equal(directive.payload.task.taskId, 'task-fitcheck-brief');
  assert.equal(directive.payload.task.projectId, 'fitcheck-product');
  assert.equal(directive.payload.task.assigneeMemberId, 'mathis');
  assert.equal(directive.payload.task.priority, 'high');
  assert.equal(directive.payload.task.taskType, 'engineering');
  assert.equal(directive.payload.task.eventId, body(queued).eventId);
  assert.ok(directive.payloadHash);

  const duplicate = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).id, 'assign-1');
  assert.equal(body(duplicate).duplicate, true);

  kv.store.set('bridge:dir:mathis:corrupt', '<!DOCTYPE html>');
  const withCorruptRecord = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(withCorruptRecord.status, 200);
  assert.equal(body(withCorruptRecord).count, 1);
  assert.equal(body(withCorruptRecord).skipped, 1);

  const conflict = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ ...assignment, task: { ...assignment.task, title: 'Changed assignment title' } }),
  }), deps);
  assert.equal(conflict.status, 409);
  assert.equal(body(conflict).eventId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: FAIL with `no bridge route for POST /v1/bridge/assign-task` or missing `skipped` assertion.

- [ ] **Step 3: Restore the minimal assignment implementation**

Port the exact implementation blocks from the verified backup patch:

```bash
sed -n '7794,8050p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
sed -n '8461,8535p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
sed -n '8621,8633p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

Required code shapes in `workers/quests/src/handler.ts`:

```ts
export interface BridgeAssignmentRecord {
  id: string;
  memberId: string;
  taskId: string;
  projectId: string;
  eventId: string;
  correlationId?: string;
  payloadHash: string;
  enqueuedAt: string;
}

export interface BridgeStoreLike {
  putUpstream(tenantId: string, id: string, message: Record<string, unknown>): Promise<void>;
  listUpstream(tenantId: string, limit: number): Promise<any[]>;
  putDirective(memberId: string, id: string, directive: Record<string, unknown>): Promise<void>;
  listPendingDirectives(memberId: string, limit: number): Promise<{ directives: any[]; skipped: number }>;
  markDirectiveDelivered(memberId: string, id: string, deliveredAt: string): Promise<boolean>;
  getAssignment(memberId: string, eventId: string): Promise<BridgeAssignmentRecord | null>;
  putAssignment(record: BridgeAssignmentRecord): Promise<void>;
}

function assignmentEventId(projectId: string, taskId: string): string {
  return `cambium:${projectId}:${taskId}:assigned`;
}
```

`GET /v1/bridge/directives/:memberId` must return `{ member, count, directives, skipped }`, where `count` excludes corrupt records and `skipped` counts parse failures.

- [ ] **Step 4: Run the assignment test to verify it passes**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS, including the new assignment route test.

- [ ] **Step 5: Commit**

```bash
git add workers/quests/src/handler.ts workers/quests/src/handler.test.ts
git commit -m "feat: restore fabric assignment bridge route"
```

## Task 2: Add Scoped Hermes Assignment Token Guard

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `HandlerDeps.assignmentToken?: string` and Task 1 assignment route.
- Produces: assignment-only principal with `assignmentOnly: true`; scoped token can call `/v1/bridge/assign-task`; scoped token cannot call generic directives, inbox, handoff admin, or Fabric review routes.

- [ ] **Step 1: Write the failing scoped token test**

Add this test to `workers/quests/src/handler.test.ts` after the assignment route test:

```ts
test('bridge · scoped Hermes assignment token only enqueues task assignments', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-06-22T08:00:00.000Z',
    uuid: () => 'assign-1',
  };

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: { taskId: 'task-1', projectId: 'project-1', title: 'Scoped assignment proof' },
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).id, 'assign-1');

  const genericDirective = await handle(req('POST', '/v1/bridge/directive', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ memberId: 'mathis', payload: { type: 'manual' } }),
  }), deps);
  assert.equal(genericDirective.status, 403);

  const inbox = await handle(req('GET', '/v1/bridge/inbox/cambium', {
    headers: { authorization: 'Bearer assign-only' },
  }), deps);
  assert.equal(inbox.status, 403);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: FAIL because `assignmentToken` is not part of `HandlerDeps` and the bridge auth resolver rejects the scoped token.

- [ ] **Step 3: Implement the scoped principal**

In `workers/quests/src/handler.ts`, extend `HandlerDeps` and bridge auth with this exact shape:

```ts
export interface HandlerDeps {
  kv: KvLike;
  pushToken?: string;
  gate?: GateConfig;
  bridgeToken?: string;
  assignmentToken?: string;
  handoffSecret?: string;
  providerBroker?: ProviderBrokerConfig;
  uuid?: () => string;
  now?: () => string;
  nowMs?: () => number;
  publicBaseUrl?: string;
  bridgeStore?: BridgeStoreLike;
  fabricLedger?: FabricLedgerStoreLike;
}

let principal: { admin: boolean; assignmentOnly?: boolean; memberId?: string; tenantId?: string } | null = null;
if (_tok && deps.bridgeToken && _tok === deps.bridgeToken) {
  principal = { admin: true };
} else if (_tok && deps.assignmentToken && _tok === deps.assignmentToken) {
  principal = { admin: false, assignmentOnly: true };
}
```

Keep existing member-token lookup after the assignment-token branch. The assignment route guard must be:

```ts
if (!principal.admin && !principal.assignmentOnly) {
  return json(403, { error: 'only cofounders/Hermes may enqueue task assignments' });
}
```

- [ ] **Step 4: Run the scoped token test to verify it passes**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/quests/src/handler.ts workers/quests/src/handler.test.ts
git commit -m "feat: scope Hermes fabric assignment token"
```

## Task 3: Restore Fabric Consume Ledger

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `BridgeStoreLike.listUpstream`, `FabricLedgerStoreLike`, signed upstream bridge messages.
- Produces: `POST /v1/fabric/consume`, task projection into `fabricLedger`, idempotent event storage, conflict counts, `verified_evidence` upgrade for strong evidence.

- [ ] **Step 1: Add the in-memory Fabric ledger and consume test**

Port the in-memory ledger from backup patch lines `5928,5944` into `workers/quests/src/handler.test.ts`:

```bash
sed -n '5909,5944p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

Then add this focused consume test:

```ts
test('fabric ledger · consumes Plexus task reports idempotently', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };
  const upstream = await signBridge('bridge', {
    id: 'up-1',
    timestamp: '2026-06-23T10:00:00.000Z',
    direction: 'upstream',
    tenantId: 'cambium',
    memberId: 'mathis',
    payload: {
      type: 'fabric_task_report',
      schema: 'thoughtseed.fabric_task_report.v1',
      taskId: 'task-fitcheck-brief',
      projectId: 'fitcheck-product',
      title: 'Prepare branch proof packet',
      status: 'done',
      workMode: 'manual',
      evidenceStrength: 'weak_evidence',
      evidence: { type: 'github_pr', value: 'https://github.com/thoughtseed/fitcheck/pull/7' },
      historyEventId: 'plexus-done-1',
      historyPayloadHash: 'hash-done-1',
      correlationId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
    },
  });

  const ingest = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(upstream),
  }), deps);
  assert.equal(ingest.status, 200);

  const consumed = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(consumed.status, 200);
  assert.equal(body(consumed).consumed, 1);
  assert.equal(body(consumed).upgraded, 1);
  assert.equal(fabricLedger.events.get('plexus-done-1')?.payloadHash, 'hash-done-1');
  assert.equal(fabricLedger.tasks.get('task-fitcheck-brief')?.evidenceStrength, 'verified_evidence');

  const duplicate = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(body(duplicate).duplicates, 1);

  const scopedConsumer = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(scopedConsumer.status, 200);
  assert.equal(body(scopedConsumer).duplicates, 1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: FAIL with `no Fabric route for POST /v1/fabric/consume` or missing `fabricLedger` types.

- [ ] **Step 3: Restore Fabric consume helpers and route**

Port these exact implementation blocks into `workers/quests/src/handler.ts`:

```bash
sed -n '7794,8275p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
sed -n '8316,8388p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

The consume route must return this result shape:

```ts
{
  tenantId: string;
  checked: number;
  consumed: number;
  duplicates: number;
  conflicts: number;
  upgraded: number;
}
```

- [ ] **Step 4: Run the consume test to verify it passes**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS and the consume response includes `consumed`, `duplicates`, `conflicts`, and `upgraded`.

- [ ] **Step 5: Commit**

```bash
git add workers/quests/src/handler.ts workers/quests/src/handler.test.ts
git commit -m "feat: restore fabric consume ledger"
```

## Task 4: Restore Evidence Candidate Review Routes

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `FabricLedgerStoreLike`, `BridgeStoreLike.putDirective`.
- Produces: `POST /v1/fabric/evidence-candidates`, `POST /v1/fabric/evidence-candidates/review`, `GET /v1/fabric/review-items`, `GET /v1/fabric/tasks/:taskId`, review directives with `candidate_accepted` or `candidate_rejected` history events.

- [ ] **Step 1: Write the candidate review test**

Port the complete test from backup patch lines `7546,7790`:

```bash
sed -n '7546,7790p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

Keep these core assertions in the restored test:

```ts
assert.equal(body(review).directiveId, 'candidate-review:candidate-1:rejected');
assert.equal(body(pending).directives[0].payload.event.type, 'candidate_rejected');
assert.equal(body(reviewItems).count, 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: FAIL because candidate routes are missing.

- [ ] **Step 3: Restore candidate route helpers**

Port these exact implementation blocks into `workers/quests/src/handler.ts`:

```bash
sed -n '8133,8275p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
sed -n '8338,8388p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

`reviewDirective` must produce payload type `fabric_task_history_event` and must keep rejected candidates visible as `rejected_candidate`.

- [ ] **Step 4: Run the candidate tests to verify they pass**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/quests/src/handler.ts workers/quests/src/handler.test.ts
git commit -m "feat: restore fabric evidence review routes"
```

## Task 5: Wire D1 Runtime Stores

**Files:**
- Modify: `workers/quests/src/index.ts`
- Verify: `workers/quests/schema/bridge.sql`
- Test: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `BRIDGE_DB?: D1DatabaseLike`, Task 1 `BridgeStoreLike`, Task 3 `FabricLedgerStoreLike`.
- Produces: `d1BridgeStore(db)`, `d1FabricLedgerStore(db)`, Env binding `HERMES_ASSIGNMENT_TOKEN?: string`, handler deps `bridgeStore`, `fabricLedger`, `assignmentToken`.

- [ ] **Step 1: Write the runtime binding check**

Add this regression test to `workers/quests/src/handler.test.ts` to prove handler dependencies accept external stores:

```ts
test('fabric bridge · handler accepts external bridge and ledger stores', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const bridgeStore = {
    async putUpstream(tenantId: string, id: string, message: Record<string, unknown>) {
      await kv.put(`d1:up:${tenantId}:${id}`, JSON.stringify(message));
    },
    async listUpstream(tenantId: string) {
      const keys = await kv.list(`d1:up:${tenantId}:`);
      const out = [];
      for (const key of keys) out.push(JSON.parse((await kv.get(key)) || '{}'));
      return out;
    },
    async putDirective(memberId: string, id: string, directive: Record<string, unknown>) {
      await kv.put(`d1:dir:${memberId}:${id}`, JSON.stringify(directive));
    },
    async listPendingDirectives(memberId: string) {
      const keys = await kv.list(`d1:dir:${memberId}:`);
      const directives = [];
      for (const key of keys) directives.push(JSON.parse((await kv.get(key)) || '{}'));
      return { directives, skipped: 0 };
    },
    async markDirectiveDelivered() { return true; },
    async getAssignment() { return null; },
    async putAssignment() {},
  };
  const response = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), { kv, bridgeToken: 'bridge', assignmentToken: 'assign-only', bridgeStore, fabricLedger });
  assert.equal(response.status, 200);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: FAIL until `bridgeStore`, `fabricLedger`, and `assignmentToken` exist on `HandlerDeps`.

- [ ] **Step 3: Restore D1 glue in `workers/quests/src/index.ts`**

Port these exact implementation blocks from the backup patch:

```bash
sed -n '8933,9385p' /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium-backups/20260624T021305Z-feat-m5-phase-q-bridge-retirement-final/tracked-working-tree.patch
```

The final `handle(simple, ...)` call must pass:

```ts
assignmentToken: env.HERMES_ASSIGNMENT_TOKEN,
bridgeStore: env.BRIDGE_DB ? d1BridgeStore(env.BRIDGE_DB) : undefined,
fabricLedger: env.BRIDGE_DB ? d1FabricLedgerStore(env.BRIDGE_DB) : undefined,
```

- [ ] **Step 4: Run the runtime binding and full worker tests**

Run:

```bash
node --test workers/quests/src/handler.test.ts
npm test
```

Expected: PASS. If `npm test` includes unrelated suites that fail before this plan, capture the exact failing test names in the evidence doc and do not flatten unrelated failures into a bridge failure.

- [ ] **Step 5: Commit**

```bash
git add workers/quests/src/index.ts workers/quests/src/handler.ts workers/quests/src/handler.test.ts
git commit -m "feat: wire fabric bridge d1 stores"
```

## Task 6: Record Evidence And Live Route Probes

**Files:**
- Create: `docs/evidence/2026-06-24-hermes-fabric-source-of-truth.md`
- Modify: none expected outside docs after source commits

**Interfaces:**
- Consumes: local tests, live unauthenticated route probes, existing proof packet in Hermes repo.
- Produces: durable evidence note separating source restoration, local tests, hosted route protection, and remaining credential-gated proof.

- [ ] **Step 1: Create the evidence document**

Create `docs/evidence/2026-06-24-hermes-fabric-source-of-truth.md` with this structure:

```md
# Hermes Fabric Bridge Source Of Truth Evidence - 2026-06-24

## Source State

- Repo: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium`
- Branch/commit:
- Restored from backup patch:
- Backup integrity:

## Local Verification

- `node --test workers/quests/src/handler.test.ts`:
- `npm test`:

## Live Route Probes

- `GET https://curious.thoughtseed.space/healthz`:
- `POST https://curious.thoughtseed.space/v1/bridge/assign-task` without auth:
- `POST https://curious.thoughtseed.space/v1/fabric/consume` without auth:

## Handoff Boundary

- Remote Thoughtseed/Hermes bridge:
- Local Paperclip runtime:
- Plexus credential custody:

## Remaining Gated Proof

- Scoped `HERMES_ASSIGNMENT_TOKEN` live consume:
- Admin review routes:
```

- [ ] **Step 2: Run local verification**

Run:

```bash
node --test workers/quests/src/handler.test.ts
npm test
git diff --check
```

Expected: handler tests PASS, `git diff --check` exits 0, and `npm test` either PASSes or has documented unrelated failures.

- [ ] **Step 3: Run fail-closed live probes**

Run:

```bash
curl -s -i https://curious.thoughtseed.space/healthz
curl -s -i -X POST https://curious.thoughtseed.space/v1/bridge/assign-task -H 'content-type: application/json' -d '{"memberId":"mathis","task":{"taskId":"probe","projectId":"probe","title":"probe"}}'
curl -s -i -X POST https://curious.thoughtseed.space/v1/fabric/consume -H 'content-type: application/json' -d '{"tenantId":"cambium"}'
```

Expected:

```txt
/healthz: 200 with {"ok":true,"worker":"cambium-quests"}
/v1/bridge/assign-task: 401 bad or missing bridge credential
/v1/fabric/consume: 401 admin token required
```

- [ ] **Step 4: Update the evidence document with exact command output**

Paste only redacted status lines and response bodies. Do not paste bearer tokens, raw secrets, full signed bridge payloads, or personal identifiers beyond already-public `tenantId=cambium`.

- [ ] **Step 5: Commit**

```bash
git add docs/evidence/2026-06-24-hermes-fabric-source-of-truth.md
git commit -m "docs: record hermes fabric source restoration proof"
```

## Task 7: Cross-Repo Handoff Check

**Files:**
- Read only: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/plexus-ts/src/main/thoughtseed-bridge.ts`
- Read only: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/plexus-ts/src/renderer/components/AgentFabricPanel.tsx`
- Read only: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/handlers.ts`
- Read only: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/service.ts`
- Read only: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/docs/evidence/2026-06-23-hermes-cambium-assignment-proof.md`

**Interfaces:**
- Consumes: restored Cambium route shapes.
- Produces: no code unless drift is found; if drift is found, create a separate plan in the relevant sibling repo.

- [ ] **Step 1: Verify Plexus still sends supported payloads**

Run:

```bash
rg -n "project_task_assignment|fabric_task_report|workModeLocked|evidenceStrength|/v1/bridge/ingest|/v1/bridge/directives" /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/plexus-ts/src
```

Expected: Plexus parser and report code still name `project_task_assignment`, `fabric_task_report`, `workModeLocked`, and `evidenceStrength`.

- [ ] **Step 2: Verify Hermes still forwards assignment paths**

Run:

```bash
rg -n "/v1/fabric/tasks/assign|/v1/bridge/assign-task|override-work-mode|/v1/fabric/consume" /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/docs/evidence/2026-06-23-hermes-cambium-assignment-proof.md
```

Expected: Hermes source still forwards assignment/override to Cambium and the evidence doc still records `consumed=3`, `conflicts=0`, `upgraded=1`.

- [ ] **Step 3: Run the local deterministic Plexus bridge smoke**

Run:

```bash
npm --prefix /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/plexus-ts run smoke:thoughtseed-bridge
```

Expected: PASS. If the Plexus repo has unrelated dirty worktree issues, record the exact blocker in the Cambium evidence doc and stop short of changing Plexus.

- [ ] **Step 4: Commit only if docs changed**

If Task 7 adds a note to the evidence document:

```bash
git add docs/evidence/2026-06-24-hermes-fabric-source-of-truth.md
git commit -m "docs: add fabric sibling handoff check"
```

If no docs changed, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers active Cambium source drift, assignment route restoration, scoped token rules, Fabric consume projection, D1 runtime wiring, local tests, live fail-closed route probes, and sibling handoff checks.
- Placeholder scan: Clear.
- Type consistency: `BridgeStoreLike`, `FabricLedgerStoreLike`, `HandlerDeps.assignmentToken`, `bridgeStore`, and `fabricLedger` are named consistently across tasks.
- Scope control: Hermes and Plexus are read/probe-only unless a separate drift plan is created.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-hermes-fabric-bridge-source-of-truth.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
