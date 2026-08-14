# Fitcheck Founder Evidence Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one authenticated, Gate-approved Fitcheck evidence flow whose committed outcome is visible in Mission and Goal Graph readback.

**Architecture:** A pure closed-schema parser accepts references only. A founder-authenticated Worker route converts that intent into the existing KV-backed Goal Graph intake task with a server-derived evidence candidate and change set. The existing Gate CAS commit remains the only D1 mutation; founder-only quest-envelope projection drives the refreshed Mission UI.

**Tech Stack:** TypeScript, Cloudflare Worker pure handler, KV task records, D1 Goal Graph store, generated single-page Telegram Mini App, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-14-fitcheck-founder-evidence-pilot-design.md`

**Implementation status:** Tasks 1–4 are complete at candidate code head
`405664abfc9490529710c14e88d356f7f21ad602`. Task 5 release proof is complete
locally; upload, promotion, and a real founder submission remain separately
authorized production operations.

## Global Constraints

- Exact pilot identity is `cambium` / `sapling:fitcheck` / `fitcheck` / `fitcheck-shopify-qa` / `fitcheck-shopify-widget-qa`.
- Telegram runtime `initData` is validated and never persisted, echoed, logged, or rendered.
- Browser input cannot choose Goal Graph parent, head, loadout, status, descriptor, route, or execution state.
- D1 receives no write before existing `approve-goal-graph` Gate approval succeeds.
- Hermes execution, Telegram transport, Mission Fabric activation, Cloudflare promotion, and external writes remain out of scope.
- Every implementation step starts RED, becomes GREEN, and preserves the clean isolated worktree.

---

### Task 1: Closed founder-outcome contract

**Files:**
- Create: `workers/quests/src/founder-outcome-intake.ts`
- Create: `workers/quests/src/founder-outcome-intake.test.ts`

**Interfaces:**
- Consumes: untrusted JSON without authentication material.
- Produces: `parseFounderOutcomeIntent(input): FounderOutcomeParseResult` and `deriveFounderOutcomeTransition(value, parentNodeId): FounderOutcomeTransition`.

- [ ] **Step 1: Write the failing parser tests**

```ts
test('accepts the exact Fitcheck proof-reference envelope', () => {
  const parsed = parseFounderOutcomeIntent(validFounderOutcome());
  assert.equal(parsed.accepted, true);
  assert.equal(parsed.value.questId, 'fitcheck-shopify-widget-qa');
});

test('rejects identity drift, unknown keys, secrets, raw payloads, and local paths', () => {
  for (const value of hostileFounderOutcomes()) {
    assert.equal(parseFounderOutcomeIntent(value).accepted, false);
  }
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test workers/quests/src/founder-outcome-intake.test.ts`

Expected: FAIL because the module and parser do not exist.

- [ ] **Step 3: Implement the minimal pure parser and transition derivation**

```ts
export type FounderObservedOutcome = 'passed' | 'failed' | 'blocked' | 'needs-review';
export function parseFounderOutcomeIntent(input: unknown): FounderOutcomeParseResult;
export function deriveFounderOutcomeTransition(
  value: FounderOutcomeIntent,
  parentNodeId: string,
): FounderOutcomeTransition;
```

The transition fixes the Fitcheck loadout, WorkObject, branch, mission, quest,
node namespace, desired state, and outcome-to-status mapping defined by the
spec. It returns data only and has no Worker, KV, D1, or Telegram dependency.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run: `node --test workers/quests/src/founder-outcome-intake.test.ts`

Expected: all parser, bounds, redaction, and transition cases PASS.

### Task 2: Authenticated pending candidate route

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `POST /api/founder-outcomes/:tenant`, the Task 1 parser, existing `validateInitData`, KV, and Goal Graph reads.
- Produces: a pending `cambium.goal-graph-intake-task.v1` containing a bounded `cambium.founder-evidence-candidate.v1` projection and the existing Gate approval descriptor, persisted through one shared replay/reconciliation primitive.

- [ ] **Step 1: Write failing route-boundary tests**

```ts
test('founder outcome creates one pending candidate and zero D1 writes', async () => {
  const response = await postFounderOutcome(validBodyWithSignedInitData());
  assert.equal(response.status, 200);
  assert.equal(body(response).candidate.status, 'review_pending');
  assert.equal(goalStore.commits.length, 0);
});
```

Add separate tests for missing, invalid, expired, and non-founder auth; tenant
and pilot-identity drift; absent and ambiguous Fitcheck anchors; duplicate
replay; same-key conflict; each partial KV-write failure followed by retry; and
secret-free responses. Retries must converge on one candidate and task.

- [ ] **Step 2: Run the focused route tests and confirm RED**

Run: `node --test --test-name-pattern='founder outcome' workers/quests/src/handler.test.ts`

Expected: FAIL with route-not-found and missing candidate assertions.

- [ ] **Step 3: Implement the authenticated intake adapter**

The handler must remove `initData` before pure parsing, require the exact
founder verdict, read D1 head/nodes, select exactly one `sapling:fitcheck`
anchor, derive the proposal, and use one shared existing-intake persistence
primitive that can complete or reconcile a task/idempotency partial write. It
must return only candidate ID/status, change digest, graph version, and
Gate/readback routes.

- [ ] **Step 4: Run the focused route tests and confirm GREEN**

Run: `node --test --test-name-pattern='founder outcome' workers/quests/src/handler.test.ts`

Expected: every authentication, idempotency, authority, and no-write case PASS.

### Task 3: Exact Gate consequence and D1 readback

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: the candidate-bearing intake task from Task 2 and existing `approve-goal-graph` CAS commit.
- Produces: a Fitcheck-specific Gate row and founder-only `goalGraphOutcomes` quest-envelope projection.

- [ ] **Step 1: Write failing Gate and readback tests**

```ts
assert.equal(row.candidateId, candidate.candidateId);
assert.match(row.evidence, /screenshot .* widget event/);
assert.equal(row.consequence.includes('Hermes execution'), true);
assert.equal(founderEnvelope.goalGraphOutcomes.rows[0].questId, 'fitcheck-shopify-widget-qa');
```

Also prove an unsigned candidate leaves head/version/nodes unchanged, a stale
head refuses with no write, successful approval updates the task candidate to
`accepted`, a D1-success/KV-failure replay reconciles acceptance without a
second D1 commit, committed D1 state outranks stale pending KV, and team/public
envelopes omit both candidate existence and outcome detail.

- [ ] **Step 2: Run focused Gate/readback tests and confirm RED**

Run: `node --test --test-name-pattern='founder outcome|Goal Graph readback' workers/quests/src/handler.test.ts`

Expected: FAIL because candidate descriptors and founder readback are absent.

- [ ] **Step 3: Implement stored-descriptor rendering and founder projection**

The Gate row may render only server-stored bounded values. The approval body
cannot alter the candidate. The founder projection reads D1 head/nodes and
returns bounded outcome fields plus head digest/version; failure omits the
projection or emits a bounded unavailable state without exposing D1 rows.

- [ ] **Step 4: Run focused Gate/readback tests and confirm GREEN**

Run: `node --test --test-name-pattern='founder outcome|Goal Graph readback' workers/quests/src/handler.test.ts`

Expected: pending, committed, stale, replay, redaction, and visibility cases PASS.

### Task 4: Fitcheck Mission founder action sheet

**Files:**
- Modify: `workers/quests/src/page/scenes/mission.ts`
- Modify: `workers/quests/src/page/styles/mission.ts`
- Modify: `workers/quests/src/page/styles/sheet.ts`
- Modify: `workers/quests/src/page/client/sheet.ts`
- Modify: `workers/quests/src/page/client/signed-action.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `goalGraphIntake` pending rows, `goalGraphOutcomes` committed rows, and the Task 2 route.
- Produces: `Add proof`, `Report outcome`, pending-Gate status, and D1-backed Mission/quest readback.

- [ ] **Step 1: Write failing browser-harness tests**

```ts
assert.match(stem.innerHTML, /data-founder-outcome-action="add-proof"/);
addProof.click();
assert.equal(sheet.querySelectorAll('input').length, 2);
assert.equal(sheet.querySelectorAll('select').length, 1);
```

Exercise exact request JSON, disabled submit while pending, no runtime auth in
markup, Gate navigation after success, approval refresh, passed/blocked quest
projection, failure messages, and accessibility labels.

- [ ] **Step 2: Run focused page tests and confirm RED**

Run: `node --test --test-name-pattern='Fitcheck founder outcome' workers/quests/src/handler.test.ts`

Expected: FAIL because no founder action or sheet exists.

- [ ] **Step 3: Implement the minimal Mission and sheet UI**

Only the exact Fitcheck quest gets actions. The sheet posts references, outcome,
note, `clientRequestId`, and runtime `initData`; it never renders or persists
`initData`. A successful intake refreshes the envelope and Gate. A successful
Gate commit refreshes Mission as well as Gate.

- [ ] **Step 4: Run focused page tests and confirm GREEN**

Run: `node --test --test-name-pattern='Fitcheck founder outcome' workers/quests/src/handler.test.ts`

Expected: all action, pending, approval, refresh, failure, and readback cases PASS.

### Task 5: Release proof and handoff

**Files:**
- Modify: `ISA.md`
- Modify: `.project/HANDOFF.md`
- Add: `docs/evidence/2026-08-14-fitcheck-founder-evidence-pilot.v1.json`

**Interfaces:**
- Consumes: exact clean candidate source and all Task 1–4 tests.
- Produces: bounded local candidate receipt with no deployment claim.

- [ ] **Step 1: Run focused and full deterministic gates**

Run:

```bash
node --test workers/quests/src/founder-outcome-intake.test.ts workers/quests/src/handler.test.ts
npm test
npm run proof:tg-mobile-contract
npm run proof:tg-viewport
npm run verify:release
git diff --check
git status --short
```

Expected: every command exits zero; the status contains only reviewed pilot
files before the candidate commit.

- [ ] **Step 2: Run secret and authority scans**

Run:

```bash
rg -n 'query_id=|auth_date=|Bearer |TELEGRAM_INIT_DATA|TG_INIT_DATA|PRIVATE KEY|/Users/|/Volumes/' \
  workers/quests/src docs/evidence/2026-08-14-fitcheck-founder-evidence-pilot.v1.json
```

Expected: no pilot artifact contains authentication material or machine-local
paths; source-only guard expressions are reviewed separately from evidence.

- [ ] **Step 3: Record the exact local evidence and handoff**

The receipt records base/head commits, changed files, test counts, bundle/page
digests, parser/route/Gate/readback proofs, production Version 47 as prior
read-only context, and explicit false values for production upload, promotion,
D1/KV/R2, Telegram, Hermes, Mission Fabric, and provider mutations.

- [ ] **Step 4: Commit the reviewed candidate**

```bash
git add workers/quests/src docs/superpowers ISA.md .project/HANDOFF.md docs/evidence
git commit -m "feat: add Fitcheck founder evidence gate"
```

Expected: reviewed commits above evidence checkpoint `20a816d17cf961d62fb50e1535c97ab984e8d4c3`, squashed to one clean local candidate before final handoff.
