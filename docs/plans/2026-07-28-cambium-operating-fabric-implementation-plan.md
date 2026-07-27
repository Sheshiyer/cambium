# Cambium Operating Fabric Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a rollback-safe Telegram Mini App operating fabric where saplings and company programs share truthful Mission → Task → Run → Receipt lineage, and agents plus skill clusters are visible as read-only execution overlays.

**Architecture:** Existing D1 Goal Graph, fenced runtime stores, branch packets, and quest envelopes remain authoritative. A pure deterministic compiler adapts those sources into a bounded `cambium.mission-fabric-projection.v1`; an authenticated Worker route serves it; a second Mini App bundle renders Canopy, Mission, Flow, Workforce, and Forge while the current five-scene bundle remains the default and rollback surface until promotion evidence is accepted.

**Tech Stack:** TypeScript ES modules, Node built-in test runner, Cloudflare Workers, D1, KV, Wrangler, inline HTML/CSS/JavaScript, Telegram `initData`, Headless Chrome viewport proof.

---

## Execution contract

Read these before editing:

- [`docs/architecture/cambium-operating-fabric.md`](../architecture/cambium-operating-fabric.md)
- [`docs/architecture/contracts/branch-mission-fabric-contract.md`](../architecture/contracts/branch-mission-fabric-contract.md)
- [`docs/visual/cambium-operating-fabric-flow.html`](../visual/cambium-operating-fabric-flow.html)
- [`docs/plans/assets/cambium-operating-fabric-moodboard/`](assets/cambium-operating-fabric-moodboard/)
- [`workers/quests/src/branch-map.ts`](../../workers/quests/src/branch-map.ts)
- [`workers/quests/src/handler.ts`](../../workers/quests/src/handler.ts)
- [`workers/quests/src/lead-runtime-store.ts`](../../workers/quests/src/lead-runtime-store.ts)
- [`workers/quests/src/goal-graph/compiler.ts`](../../workers/quests/src/goal-graph/compiler.ts)
- [`workers/quests/src/page/index.ts`](../../workers/quests/src/page/index.ts)
- [`workers/quests/src/visual-viewport-proof.mjs`](../../workers/quests/src/visual-viewport-proof.mjs)

Use these skills during execution:

- `@superpowers:using-git-worktrees` before Task 1.
- `@superpowers:test-driven-development` for Tasks 2–13.
- `@superpowers:verification-before-completion` before every task commit and Task 14.
- `@superpowers:executing-plans` to execute this document in a separate session.

Rules for every implementation task:

1. Add one failing behavior test.
2. Run the focused test and observe the stated RED failure.
3. Write only the minimum production code needed for GREEN.
4. Re-run the focused and adjacent regression tests.
5. Run `git diff --check`.
6. Commit only the task's listed paths.

The canonical test runtime is the repository's current Node v26+ runtime,
whose built-in type stripping is already exercised by `package.json` through
`node --test '*.test.ts'`. Do not add `tsx`, `ts-node`, or another loader. Task
1 proves that runtime with an existing `.ts` test before any new RED signal is
interpreted.

All new TypeScript must remain erasable-syntax-only for Node's native
type stripping: no enums, namespaces, parameter properties, or runtime
assumptions from type-only imports. Use `import type` for type-only imports.

Tasks 2–13 are implementation tasks and follow the RED/GREEN sequence above.
Task 1 is a baseline/worktree gate; Task 14 is a human-controlled promotion
gate.

Do not deploy, mutate production data, broaden an allowlist, or remove the legacy Mini App without explicit founder approval.

## Authority and migration decisions

This feature creates no new writer.

| Fact | Authoritative writer | Fabric behavior |
| --- | --- | --- |
| goals, missions, task intent, approvals | D1 Goal Graph and existing signed Gate handlers | read, adapt, link |
| task leases, attempts, runs, outcomes | existing fenced runtime handlers | read, adapt, reject stale fences |
| receipts and proof | existing receipt stores and proof handlers | read, verify, redact |
| sapling lifecycle | existing `BranchStoryArc` and branch packet flow | adapt to `SaplingWork`; never widen the source type |
| company program lifecycle | versioned company-program packets plus Goal Graph namespace | validate packet, then adapt |
| agents and skills | existing quest/operator telemetry and skill registry | overlay availability and assignment |

There is no D1 migration or destructive backfill in this plan. Existing records are mapped virtually in the projection. Before pilot promotion, a shadow comparison reports legacy branch-map facts that cannot be represented. If a canonical field is truly unavailable, stop and write a separate expand-only migration ADR; do not add a table or rewrite records inside this plan.

Rollback is:

1. Remove the tenant from `MISSION_FABRIC_TENANTS`.
2. The static page stays on the legacy five-scene bundle.
3. `GET /v1/mission-fabric/{tenant}` fails closed for that tenant.
4. No schema revert or data restoration is required.

## Source-shaped fixture

Freeze one cross-layer fixture before independent adapters exist. It must contain:

- one sapling with a branch mission;
- one company program with a program mission;
- one ready task and one blocked task;
- one current fenced run and one stale-fence run;
- one verified receipt and one missing receipt;
- two agents with overlapping capabilities;
- two skill clusters with one capability gap;
- deterministic `asOf`, `generatedAt`, nonce, fence, version, and evidence
  references;
- only synthetic tenant and actor identifiers.

The same fixture feeds schema validation, compiler goldens, route assembly, UI scenes, and browser proof. Do not copy or reshape it per layer.

## Traceability

| Task | Contract rows | Outcome |
| --- | --- | --- |
| 1 | OF-001..008 | baseline, worktree, contracts, visual budgets |
| 2 | OF-009..013 | program packets and compatibility adapter |
| 3 | OF-014..018 | deterministic projection compiler |
| 4 | OF-019..025 | runtime facts, gaps, provenance, redaction |
| 5 | OF-026..033 | authenticated route and shadow comparison |
| 6 | OF-034..040 | additive page bundle, flag, mirrored contracts |
| 7 | OF-041..046 | shared visual grammar and shell |
| 8 | OF-047..050 | Canopy and Mission scenes |
| 9 | OF-051..053 | Flow scene |
| 10 | OF-054..056 | Workforce and Forge scenes |
| 11 | OF-057..058 | contextual Gate and Inspect sheets |
| 12 | OF-059..060 | integration, accessibility, bounded layouts |
| 13 | OF-061..062 | deterministic browser and release proof |
| 14 | OF-063 | pilot promotion, rollback rehearsal, handoff |

## Task 1: Preserve the design baseline and create the implementation worktree

**Files:**

- Modify: `ISA.md`
- Modify: `.planning/ROADMAP-v0.4-continuation.md`
- Modify: `docs/visual/README.md`
- Create: `docs/architecture/cambium-operating-fabric.md`
- Create: `docs/plans/2026-07-28-cambium-operating-fabric-implementation-plan.md`
- Create: `docs/visual/cambium-operating-fabric-flow.html`
- Create: `docs/visual/cambium-operating-fabric-flow.png`
- Create: `docs/plans/assets/cambium-operating-fabric-moodboard/`
- Do not stage: `_PROJECT-STATUS.md`, `_tmp-menu2.png`, `_tmp-shot3.png`, `_tmp-shot4.png`

**Step 1: Verify the approved baseline**

Run:

```bash
git status --short
git diff --check
node --version
npm run render-docs:check
node --test workers/quests/src/branch-map.test.ts
```

Expected: the design and planning artifacts are present, whitespace validation
passes, `node --version` reports v26.x or a later compatible runtime, docs
render without drift, and the existing `.ts` test is GREEN under that runtime.

**Step 2: Commit only the reviewed design baseline**

Run:

```bash
git add \
  ISA.md \
  .planning/ROADMAP-v0.4-continuation.md \
  docs/architecture/cambium-operating-fabric.md \
  docs/plans/2026-07-28-cambium-operating-fabric-implementation-plan.md \
  docs/plans/assets/cambium-operating-fabric-moodboard \
  docs/visual/README.md \
  docs/visual/cambium-operating-fabric-flow.html \
  docs/visual/cambium-operating-fabric-flow.png
git diff --cached --check
git commit -m "docs: freeze Cambium operating fabric design"
```

Expected: unrelated local files remain unstaged.

**Step 3: Create an isolated worktree**

From the repository root:

```bash
git worktree add \
  /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/cambium-operating-fabric \
  -b codex/cambium-operating-fabric
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/cambium-operating-fabric
npm test
```

Expected: the branch starts at the approved baseline and the unchanged suite is GREEN.

## Task 2: Freeze company-program packets and the shared source fixture

**Files:**

- Create: `docs/architecture/contracts/company-program-packet.schema.json`
- Create: `docs/plans/company-programs/index.json`
- Create: `docs/plans/company-programs/cambium-operating-fabric.json`
- Create: `bin/operator/quests/program-stories.ts`
- Create: `bin/operator/quests/program-stories.test.ts`
- Create: `workers/quests/src/mission-fabric-fixture.ts`

**Step 1: Write the failing packet tests**

Add tests proving the packet parser and the complete cross-layer fixture:

```ts
test('parseCompanyProgram rejects unknown keys and missing authority', () => {
  assert.throws(
    () => parseCompanyProgram({ schema: 'company-program-packet.v1', surprise: true }),
    /unknown key|authority/i,
  );
});

test('company program fixtures are versioned, synthetic, and deterministic', () => {
  assert.equal(PROGRAM_FIXTURE.schema, 'company-program-packet.v1');
  assert.equal(PROGRAM_FIXTURE.authority.kind, 'goal-graph');
  assert.equal(PROGRAM_FIXTURE.lifecycle, 'executing');
  assert.doesNotMatch(JSON.stringify(PROGRAM_FIXTURE), /initData|token|secret/i);
});

test('the frozen source fixture spans every projection adapter', () => {
  assert.deepEqual(FABRIC_SOURCE_FIXTURE.coverage, [
    'sapling', 'program', 'mission', 'task', 'run',
    'receipt', 'agent', 'skill-cluster', 'gap',
  ]);
  assert.equal(FABRIC_SOURCE_FIXTURE.runtimeRuns.some((run) => run.staleFence), true);
});
```

Run:

```bash
node --test bin/operator/quests/program-stories.test.ts
```

Expected RED: `ERR_MODULE_NOT_FOUND` for `program-stories.ts`.

**Step 2: Add the smallest strict parser**

Implement:

```ts
export type CompanyProgramKind = 'company' | 'client' | 'capability' | 'operations';

export interface CompanyProgramPacketV1 {
  schema: 'company-program-packet.v1';
  programId: string;
  tenantId: string;
  title: string;
  programKind: CompanyProgramKind;
  lifecycle: 'proposed' | 'approved' | 'executing' | 'verifying' | 'complete' | 'retired';
  outcomeMetric: string;
  authority: { kind: 'goal-graph'; namespace: string; graphVersion: number };
  missionIds: readonly string[];
}

export function parseCompanyProgram(input: unknown): CompanyProgramPacketV1;
```

Require exact keys, bounded strings, unique sorted mission IDs, and a positive
integer `graphVersion`. Keep `BranchStoryArc` unchanged.

In the same RED/GREEN cycle, create the complete
`FABRIC_SOURCE_FIXTURE` described in “Source-shaped fixture,” including all
runtime, agent, skill, gap, nonce, fence, and receipt cases. After this task,
later layers may import the fixture but must not reshape or extend it.

**Step 3: Run GREEN and adjacent validation**

Run:

```bash
node --test bin/operator/quests/program-stories.test.ts
node --test bin/operator/quests/branch-stories.test.ts
git diff --check
```

Expected: both test files pass.

**Step 4: Commit**

```bash
git add docs/architecture/contracts/company-program-packet.schema.json \
  docs/plans/company-programs \
  bin/operator/quests/program-stories.ts \
  bin/operator/quests/program-stories.test.ts \
  workers/quests/src/mission-fabric-fixture.ts
git commit -m "feat: define company program packets"
```

## Task 3: Build the deterministic Mission Fabric projection compiler

**Files:**

- Create: `docs/architecture/contracts/mission-fabric-v1.md`
- Create: `workers/quests/src/mission-fabric.ts`
- Create: `workers/quests/src/mission-fabric.test.ts`
- Use: `workers/quests/src/mission-fabric-fixture.ts`
- Reference: `workers/quests/src/branch-map.ts`

**Step 1: Write failing compiler tests**

Cover:

```ts
test('compiles identical source facts to an identical digest', () => {
  const a = buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE);
  const b = buildMissionFabricProjection(structuredClone(FABRIC_SOURCE_FIXTURE));
  assert.deepEqual(a, b);
  assert.equal(projectionDigest(a), projectionDigest(b));
});

test('never accepts a projection as an authority source', () => {
  assert.throws(
    () => buildMissionFabricProjection({ ...FABRIC_SOURCE_FIXTURE, sourceKind: 'projection' }),
    /projection.*authority/i,
  );
});

test('sorts nodes and edges before digesting', () => {
  const shuffled = reverseSourceCollections(FABRIC_SOURCE_FIXTURE);
  assert.equal(
    projectionDigest(buildMissionFabricProjection(shuffled)),
    projectionDigest(buildMissionFabricProjection(FABRIC_SOURCE_FIXTURE)),
  );
});
```

Run:

```bash
node --test workers/quests/src/mission-fabric.test.ts
```

Expected RED: `ERR_MODULE_NOT_FOUND` for `mission-fabric.ts`.

**Step 2: Define the complete v1 public shape**

Implement the exact public contract already frozen in
`docs/architecture/cambium-operating-fabric.md`; do not rename its fields or
edge vocabulary:

```ts
export type FabricNode =
  | { kind: 'work'; value: SaplingWork | ProgramWork }
  | { kind: 'mission'; value: FabricMission }
  | { kind: 'task'; value: FabricTask }
  | { kind: 'agent'; value: FabricAgent }
  | { kind: 'skill-cluster'; value: FabricSkillCluster }
  | { kind: 'run'; value: FabricRun }
  | { kind: 'receipt'; value: FabricReceipt };

export type FabricEdgeKind =
  | 'contains'
  | 'depends-on'
  | 'assigned-to'
  | 'requires-cluster'
  | 'pins-loadout'
  | 'executes'
  | 'produces'
  | 'proves'
  | 'informs-next-intent';

export interface MissionFabricProjectionV1 {
  schema: 'cambium.mission-fabric-projection.v1';
  projectionVersion: 1;
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  asOf: string;
  sourceOfTruth: 'd1-goal-graph';
  readOnly: true;
  nodes: readonly FabricNode[];
  edges: readonly FabricEdge[];
  gaps: readonly FabricGap[];
}

export type FabricWorkNode = Extract<FabricNode, { kind: 'work' }>;
```

Use canonical stable JSON before SHA-256. Cap nodes at 512, edges at 1,024, gaps at 128, evidence references per node at 32, and all display strings at 512 characters. Deterministic overflow records a `projection-truncated` gap; it never silently drops facts.

`asOf` is the newest authoritative source timestamp and is deterministic input.
`generatedAt` is supplied through the compiler clock. `graphDigest` hashes the
viewer-redacted canonical graph content—projection version, tenant, graph
version, source-of-truth marker, nodes, edges, and gaps—while excluding
`graphDigest`, `generatedAt`, and transport metadata. Wall-clock `servedAt` and
derived `freshness: 'fresh' | 'stale'` live only in the route's `delivery`
envelope.

**Step 3: Run GREEN and compiler regressions**

```bash
node --test workers/quests/src/mission-fabric.test.ts
node --test workers/quests/src/branch-map.test.ts
git diff --check
```

Expected: deterministic, rejection, bounds, and branch-map regression tests pass.

**Step 4: Commit**

```bash
git add docs/architecture/contracts/mission-fabric-v1.md \
  workers/quests/src/mission-fabric.ts \
  workers/quests/src/mission-fabric.test.ts
git commit -m "feat: compile mission fabric projections"
```

## Task 4: Adapt saplings, programs, agents, skills, runs, and receipts

**Files:**

- Modify: `workers/quests/src/mission-fabric.ts`
- Modify: `workers/quests/src/mission-fabric.test.ts`
- Use unchanged: `workers/quests/src/mission-fabric-fixture.ts`
- Reference: `bin/operator/quests/branch-stories.ts`
- Reference: `bin/operator/quests/quests.ts`
- Reference: `workers/quests/src/lead-runtime-store.ts`
- Reference: `workers/quests/src/branch-map-receipt-store.ts`

**Step 1: Write failing adapter tests**

Tests must prove:

- a `product` branch becomes `WorkObject.kind = 'sapling'` and retains
  promotion metadata;
- a `client` branch becomes `WorkObject.kind = 'program'` with
  `programKind = 'client'`, never sapling promotion UI;
- an `internal-service` branch requires an explicit `capability | operations`
  mapping; an absent mapping becomes a gap;
- company/client/capability/operations packets become `ProgramWork`;
- a missing source becomes a typed gap, never a fabricated node;
- the highest valid fence wins and a stale-fence run is rejected;
- agent/skill relations come from quest facts, never title matching;
- private client labels and raw evidence are redacted for unauthorized viewers;
- `task → run → receipt` links terminate at durable receipt IDs.
- redacting a private field recomputes `graphDigest`, and the recomputed
  digest remains stable for the same fixed viewer.

Before writing the RED test, inspect `BranchStoryArc` and the quest envelope
to confirm the exact branch-kind vocabulary, promotion fields, and explicit
agent/skill IDs. If a required canonical field does not exist, stop this task
and write the separate expand-only ADR required by the plan; do not fabricate
an identifier or infer one from a title.

Run:

```bash
node --test workers/quests/src/mission-fabric.test.ts
```

Expected RED: assertions fail because source adapters and gap records do not exist.

**Step 2: Add pure adapters**

Implement these pure functions in `mission-fabric.ts`:

```ts
export function adaptBranchStories(input: unknown): readonly FabricNode[];
export function adaptCompanyPrograms(input: unknown): readonly FabricNode[];
export function adaptGoalGraph(input: GoalGraphProjection): readonly FabricNode[];
export function adaptQuestExecutionFacts(input: unknown): {
  nodes: readonly FabricNode[];
  edges: readonly FabricEdge[];
  gaps: readonly FabricGap[];
};
export function redactMissionFabricProjection(
  projection: MissionFabricProjectionV1,
  viewer: MissionFabricViewer,
): MissionFabricProjectionV1;
```

Adapters may normalize identifiers and state vocabulary. They may not create goals, assign agents, score skills, advance state, or write receipts.

**Step 3: Add reconciliation rules**

Apply rules in this order:

1. Reject wrong tenant.
2. Reject projection-shaped input.
3. Reject expired nonce/proof metadata.
4. Reject stale fence versions.
5. Join only explicit typed IDs.
6. Emit gaps for missing joins.
7. Redact the viewer response, then recompute `graphDigest` over that redacted
   canonical graph content.

**Step 4: Run GREEN and receipt-store regressions**

```bash
node --test workers/quests/src/mission-fabric.test.ts
node --test workers/quests/src/lead-runtime-store.test.ts
node --test workers/quests/src/branch-map-receipt-store.test.ts
git diff --check
```

Expected: the source-shaped fixture passes, stale fences fail closed, and existing runtime tests remain GREEN.

**Step 5: Commit**

```bash
git add workers/quests/src/mission-fabric.ts \
  workers/quests/src/mission-fabric.test.ts
git commit -m "feat: adapt operating fabric source facts"
```

## Task 5: Serve an authenticated, bounded, read-only projection

**Files:**

- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/index.ts`
- Create: `workers/quests/src/mission-fabric-route.test.ts`
- Modify: `workers/quests/src/handler.test.ts`
- Reference: `workers/quests/src/goal-graph-store.ts`
- Use for D1/KV fakes: `workers/quests/src/mission-fabric-fixture.ts`

**Step 1: Write failing route tests**

Cover:

```ts
test('GET mission fabric requires tenant allowlist and valid Telegram initData', async () => {
  assert.equal((await requestFabric({ allowlist: [] })).status, 403);
  assert.equal((await requestFabric({ allowlist: ['cambium'], initData: '' })).status, 401);
});

test('mission fabric rejects every mutating method', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await requestFabric({ method })).status, 405);
  }
});

test('route assembles D1 Goal Graph and KV quest facts without writes', async () => {
  const result = await requestFabric({ source: FABRIC_SOURCE_FIXTURE });
  assert.equal(result.status, 200);
  assert.equal(result.json.projection.readOnly, true);
  assert.equal(result.json.delivery.operatingFabricEnabled, true);
  assert.equal(result.json.delivery.freshness, 'fresh');
  assert.equal(spies.d1Writes, 0);
  assert.equal(spies.kvWrites, 0);
});
```

Run:

```bash
node --test workers/quests/src/mission-fabric-route.test.ts
```

Expected RED: route returns 404 and `missionFabricTenants` is not in `HandlerDeps`.

**Step 2: Add the server-owned allowlist**

In `workers/quests/src/index.ts`:

```ts
interface Env {
  MISSION_FABRIC_TENANTS?: string;
}

missionFabricTenants: parseAllowedTenants(env.MISSION_FABRIC_TENANTS),
```

In `HandlerDeps`:

```ts
missionFabricTenants?: string[];
```

An absent or empty allowlist means disabled for all tenants. Do not default to `cambium`.

**Step 3: Add the route**

Implement `GET /v1/mission-fabric/{tenant}` by following `handleBranchMapRoute`:

1. parse and bound tenant;
2. require allowlist membership;
3. validate Telegram `initData`;
4. resolve the viewer through existing RBAC;
5. read Goal Graph head/nodes from D1;
6. read the existing quest envelope from `kv.get(ledgerKey(tenant))`;
7. read existing branch/runtime receipts;
8. compile, redact, hash, and return
   `{ projection, delivery: { operatingFabricEnabled: true, servedAt, freshness } }`;
9. set `ETag` to the redacted projection's recomputed `graphDigest` and
   `Cache-Control: private, no-store`;
10. perform no write or mutation.

`delivery` is volatile transport metadata and is excluded from the projection
digest. `ETag` is computed over the viewer-redacted projection, so it is a
per-viewer response validator rather than a tenant-global canonical digest.

**Step 4: Add shadow comparison**

For allowlisted diagnostic requests only, compute a non-persisted comparison:

```ts
export interface FabricShadowReport {
  branchFacts: number;
  representedFacts: number;
  missingIds: readonly string[];
  unexpectedIds: readonly string[];
}
```

Never include private labels. The report compares legacy branch facts only;
company programs have no legacy counterpart. A nonempty `missingIds` blocks
promotion but does not mutate or backfill.

**Step 5: Run GREEN and route regressions**

```bash
node --test workers/quests/src/mission-fabric-route.test.ts
node --test workers/quests/src/handler.test.ts
node --test workers/quests/src/goal-graph-store.test.ts
git diff --check
```

Expected: auth, allowlist, no-write, bounds, redaction, digest, and route regression tests pass.

**Step 6: Commit**

```bash
git add workers/quests/src/handler.ts \
  workers/quests/src/index.ts \
  workers/quests/src/mission-fabric-route.test.ts \
  workers/quests/src/handler.test.ts
git commit -m "feat: serve authenticated mission fabric"
```

## Task 6: Add the new page bundle without replacing the legacy bundle

**Files:**

- Create: `workers/quests/src/page/operating-fabric/index.ts`
- Create: `workers/quests/src/page/operating-fabric/scaffold.ts`
- Create: `workers/quests/src/page/operating-fabric/client.ts`
- Create: `workers/quests/src/page/operating-fabric/styles.ts`
- Modify: `workers/quests/src/page/index.ts`
- Modify: `workers/quests/src/mini-app-surface-contract.ts`
- Modify: `shared/mini-app-surface-contract.ts`
- Create: `workers/quests/src/operating-fabric-page.test.ts`
- Modify: `workers/quests/src/rbac.test.ts`

**Step 1: Write failing boot and parity tests**

Prove:

- the initial document renders the legacy bundle;
- no `MISSION_FABRIC_TENANTS` response or a 401/403 keeps legacy active;
- an authenticated 200 response with
  `delivery.operatingFabricEnabled: false` keeps legacy active;
- a valid authenticated response with
  `delivery.operatingFabricEnabled: true` activates the new bundle;
- new scene IDs are exactly `canopy`, `mission`, `flow`, `workforce`, `forge`;
- Worker and shared surface contracts are byte-equivalent;
- RBAC continues to govern contextual actions.
- `LEGACY_PAGE` contains exactly one `</body>` marker;
- removing the inserted `OPERATING_FABRIC_PAGE` fragment from `PAGE` yields
  byte-identical `LEGACY_PAGE`.

Run:

```bash
node --test workers/quests/src/operating-fabric-page.test.ts workers/quests/src/rbac.test.ts
```

Expected RED: the operating-fabric module and scene contract do not exist.

**Step 2: Add an additive page assembler**

Preserve the current concatenation as `LEGACY_PAGE`, assert a unique closing
body marker, inject the inert operating fabric fragment at that exact index,
and keep `PAGE` as the handler's only document export:

```ts
import { OPERATING_FABRIC_PAGE } from './operating-fabric/index.ts';

export const LEGACY_PAGE =
  STYLE_TOKENS +
  /* the existing composition, in its existing order */ +
  CLIENT_DATA;

const bodyClose = '</body>';
const bodyCloseIndex = LEGACY_PAGE.indexOf(bodyClose);
if (bodyCloseIndex < 0 || bodyCloseIndex !== LEGACY_PAGE.lastIndexOf(bodyClose)) {
  throw new Error('legacy page must contain exactly one closing body tag');
}

export const PAGE =
  LEGACY_PAGE.slice(0, bodyCloseIndex) +
  OPERATING_FABRIC_PAGE +
  LEGACY_PAGE.slice(bodyCloseIndex);
```

Do not move or reorder existing chunks. `OPERATING_FABRIC_PAGE` is hidden and
its client starts inert. It activates only after an authenticated 200 response
carrying `delivery.operatingFabricEnabled: true`; otherwise the visible and
interactive document remains `LEGACY_PAGE`.

**Step 3: Synchronize the mirrored contract**

Both contract files must export:

```ts
export const OPERATING_FABRIC_SCENE_IDS =
  ['canopy', 'mission', 'flow', 'workforce', 'forge'] as const;
```

Preserve `MINI_APP_SCENE_IDS` during rollout. Add a parity assertion instead of introducing a code generator in this slice.

**Step 4: Run GREEN and legacy regressions**

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
node --test workers/quests/src/handler.test.ts
node --test workers/quests/src/rbac.test.ts
git diff --check
```

Expected: the new shell activates only from an authenticated allowlisted response; the legacy five-scene behavior is unchanged.

**Step 5: Commit**

```bash
git add workers/quests/src/page/operating-fabric \
  workers/quests/src/page/index.ts \
  workers/quests/src/mini-app-surface-contract.ts \
  shared/mini-app-surface-contract.ts \
  workers/quests/src/operating-fabric-page.test.ts \
  workers/quests/src/rbac.test.ts
git commit -m "feat: add rollback-safe operating fabric shell"
```

## Task 7: Build the shared visual grammar and state components

**Files:**

- Create: `workers/quests/src/page/operating-fabric/components.ts`
- Modify: `workers/quests/src/page/operating-fabric/styles.ts`
- Modify: `workers/quests/src/operating-fabric-page.test.ts`
- Reference: `workers/quests/src/page/styles/tokens.ts`
- Reference: `workers/quests/src/page/components/mission-control.ts`

**Step 1: Write failing component contract tests**

Require:

- every work card shows type, lifecycle, authority, freshness, and read-only state;
- every agent card shows status, current assignment, and capability chips;
- every skill cluster shows state, coverage, and evidence timestamp;
- every edge has visible text or an accessible label;
- missing, stale, loading, unauthorized, and error states are distinct;
- no card exposes raw evidence, secrets, Telegram auth, or prompts.

Run:

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
```

Expected RED: required component markers and state labels are absent.

**Step 2: Implement reusable renderers**

Add pure string renderers:

```ts
export function renderAuthorityBadge(authority: AuthorityRef): string;
export function renderFreshnessBadge(value: Freshness): string;
export function renderWorkCard(node: FabricWorkNode): string;
export function renderAgentCard(node: FabricAgentNode): string;
export function renderSkillClusterCard(node: FabricSkillClusterNode): string;
export function renderGapState(gap: FabricGap): string;
```

Use existing tokens. Keep motion transform/opacity-only, disable nonessential motion under `prefers-reduced-motion`, use 44px minimum targets, and keep node labels within the frozen density budget.

**Step 3: Run GREEN**

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
npm run audit:text-density
git diff --check
```

Expected: component contract passes and existing density audit stays GREEN.

**Step 4: Commit**

```bash
git add workers/quests/src/page/operating-fabric/components.ts \
  workers/quests/src/page/operating-fabric/styles.ts \
  workers/quests/src/operating-fabric-page.test.ts
git commit -m "feat: add operating fabric visual grammar"
```

## Task 8: Implement Canopy and the generalized Mission scene

**Files:**

- Create: `workers/quests/src/page/operating-fabric/canopy.ts`
- Create: `workers/quests/src/page/operating-fabric/mission.ts`
- Modify: `workers/quests/src/page/operating-fabric/client.ts`
- Create: `workers/quests/src/page/scenes/fixtures/canopy.fixture.json`
- Create: `workers/quests/src/page/scenes/fixtures/operating-mission.fixture.json`
- Create: `docs/architecture/contracts/scenes/canopy.json`
- Create: `docs/architecture/contracts/scenes/operating-mission.json`
- Modify: `workers/quests/src/operating-fabric-page.test.ts`

**Step 1: Write failing scene tests**

Canopy must:

- separate Saplings and Programs visually;
- show aggregate active/blocked/stale counts;
- open a work object without mutating it;
- preserve type-specific lifecycle terms.

Mission must:

- render Work → Mission → Task lineage;
- show blockers, dependencies, receipt coverage, and gaps;
- distinguish desired state from observed execution;
- delegate every governed action to the existing signed Gate client.

Run:

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
```

Expected RED: scene fixtures, contracts, and renderers are missing.

**Step 2: Implement the minimum scene renderers**

```ts
export function renderCanopy(projection: MissionFabricProjectionV1): string;
export function renderOperatingMission(
  projection: MissionFabricProjectionV1,
  selectedWorkId: string | null,
): string;
```

No title matching, fake progress percentages, or client-authored lifecycle transitions.

**Step 3: Run GREEN and scene contract checks**

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
npm run render-docs:check
npm run audit:text-density
git diff --check
```

Expected: both scenes render source-shaped facts and bounded empty/error states.

**Step 4: Commit**

```bash
git add workers/quests/src/page/operating-fabric/canopy.ts \
  workers/quests/src/page/operating-fabric/mission.ts \
  workers/quests/src/page/operating-fabric/client.ts \
  workers/quests/src/page/scenes/fixtures/canopy.fixture.json \
  workers/quests/src/page/scenes/fixtures/operating-mission.fixture.json \
  docs/architecture/contracts/scenes/canopy.json \
  docs/architecture/contracts/scenes/operating-mission.json \
  workers/quests/src/operating-fabric-page.test.ts
git commit -m "feat: render canopy and mission lineage"
```

## Task 9: Implement the Flow scene

**Files:**

- Create: `workers/quests/src/page/operating-fabric/flow.ts`
- Create: `workers/quests/src/page/scenes/fixtures/flow.fixture.json`
- Create: `docs/architecture/contracts/scenes/flow.json`
- Modify: `workers/quests/src/page/operating-fabric/client.ts`
- Modify: `workers/quests/src/operating-fabric-page.test.ts`

**Step 1: Write failing Flow tests**

Require visible:

- Task → Run → Receipt paths;
- `depends-on` edges and blocked task state;
- current versus stale fences;
- executor and evidence links;
- gaps where a run or receipt is missing;
- a linear accessible list fallback for the graph.

Run:

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
```

Expected RED: Flow contracts and accessibility fallback are absent.

**Step 2: Implement bounded graph layout**

```ts
export function renderFlow(
  projection: MissionFabricProjectionV1,
  filters: { workId?: string; agentId?: string; state?: string },
): string;
```

Use deterministic columns, no force simulation, a maximum of 96 visible nodes, explicit “showing 96 of N” copy, and no animation required to understand dependency direction.

**Step 3: Run GREEN**

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
npm run audit:text-density
git diff --check
```

Expected: graph and linear fallback expose identical fact IDs.

**Step 4: Commit**

```bash
git add workers/quests/src/page/operating-fabric/flow.ts \
  workers/quests/src/page/operating-fabric/client.ts \
  workers/quests/src/page/scenes/fixtures/flow.fixture.json \
  docs/architecture/contracts/scenes/flow.json \
  workers/quests/src/operating-fabric-page.test.ts
git commit -m "feat: render task run receipt flow"
```

## Task 10: Implement Workforce and Forge

**Files:**

- Create: `workers/quests/src/page/operating-fabric/workforce.ts`
- Create: `workers/quests/src/page/operating-fabric/forge.ts`
- Create: `workers/quests/src/page/scenes/fixtures/workforce.fixture.json`
- Create: `workers/quests/src/page/scenes/fixtures/forge.fixture.json`
- Create: `docs/architecture/contracts/scenes/workforce.json`
- Create: `docs/architecture/contracts/scenes/forge.json`
- Modify: `workers/quests/src/page/operating-fabric/client.ts`
- Modify: `workers/quests/src/operating-fabric-page.test.ts`

**Step 1: Write failing agent and skill tests**

Workforce must show agent status, current task/run, capability coverage, source freshness, and unknown state without inventing availability. Forge must show cluster membership, active/deferred/archived state, capability demand, assignment evidence, and gaps without scoring, promoting, activating, or editing skills.

Run:

```bash
node --test workers/quests/src/operating-fabric-page.test.ts workers/quests/src/handler.test.ts
```

Expected RED: Workforce/Forge scenes and fixtures do not exist.

**Step 2: Implement read-only renderers**

```ts
export function renderWorkforce(projection: MissionFabricProjectionV1): string;
export function renderForge(projection: MissionFabricProjectionV1): string;
```

For governed skill or assignment requests, render a proposal link that opens the signed Gate flow. Never call the registry, task store, or agent runtime directly from these scenes.

**Step 3: Run GREEN**

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
node --test workers/quests/src/handler.test.ts
npm run audit:text-density
git diff --check
```

Expected: known/unknown/stale states are truthful and no scene contains a mutation fetch.

**Step 4: Commit**

```bash
git add workers/quests/src/page/operating-fabric/workforce.ts \
  workers/quests/src/page/operating-fabric/forge.ts \
  workers/quests/src/page/operating-fabric/client.ts \
  workers/quests/src/page/scenes/fixtures/workforce.fixture.json \
  workers/quests/src/page/scenes/fixtures/forge.fixture.json \
  docs/architecture/contracts/scenes/workforce.json \
  docs/architecture/contracts/scenes/forge.json \
  workers/quests/src/operating-fabric-page.test.ts
git commit -m "feat: render workforce and skill forge"
```

## Task 11: Move Gate and Inspect into contextual sheets

**Files:**

- Create: `workers/quests/src/page/operating-fabric/gate-sheet.ts`
- Create: `workers/quests/src/page/operating-fabric/inspect-sheet.ts`
- Modify: `workers/quests/src/page/operating-fabric/client.ts`
- Modify: `workers/quests/src/page/client/signed-action.ts`
- Modify: `workers/quests/src/operating-fabric-page.test.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write failing sheet tests**

Prove:

- Gate opens only from a governed object/action;
- proposal digest, nonce, expiry, tenant, actor, and head version remain bound;
- Inspect opens from a selected node/edge and shows source authority plus freshness;
- back/close restores the originating scene and focus;
- expired, replayed, or wrong-fence approvals fail closed;
- legacy Gate and Inspect root scenes remain available while the flag is off.

Run:

```bash
node --test workers/quests/src/operating-fabric-page.test.ts workers/quests/src/handler.test.ts
```

Expected RED: contextual sheets and focus restoration are missing.

**Step 2: Reuse the signed client**

The new Gate sheet must call the existing signed-action functions. Do not fork signing or approval logic. Inspect accepts only projection IDs and performs no raw arbitrary source lookup.

**Step 3: Run GREEN and security regressions**

```bash
node --test workers/quests/src/operating-fabric-page.test.ts
node --test workers/quests/src/handler.test.ts
node --test workers/quests/src/rbac.test.ts
git diff --check
```

Expected: nonce, expiry, tenant, actor, digest, head-version, and fence protections remain GREEN.

**Step 4: Commit**

```bash
git add workers/quests/src/page/operating-fabric/gate-sheet.ts \
  workers/quests/src/page/operating-fabric/inspect-sheet.ts \
  workers/quests/src/page/operating-fabric/client.ts \
  workers/quests/src/page/client/signed-action.ts \
  workers/quests/src/operating-fabric-page.test.ts \
  workers/quests/src/handler.test.ts
git commit -m "feat: add contextual gate and inspect sheets"
```

## Task 12: Prove mobile layout, reduced motion, accessibility, and bounded density

**Files:**

- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `workers/quests/src/page-motion-safety.test.ts`
- Modify: `scripts/text-density-audit.test.mjs`
- Modify: `workers/quests/src/operating-fabric-page.test.ts`
- Create: `docs/architecture/contracts/operating-fabric-visual-budget.md`

**Step 1: Add failing viewport and motion assertions**

Add 320px, 390px, and 430px checks for all five new scenes plus both sheets:

- no horizontal document overflow;
- sheet close/back controls remain visible;
- 44px minimum interactive targets;
- visible focus and logical tab order;
- semantic `<nav>`, `aria-current`, landmark, and heading hierarchy;
- reduced-motion mode removes nonessential transitions;
- graph has a linear fallback;
- scene copy stays within frozen character/row budgets;
- loading, empty, stale, unauthorized, and error states render safely.

Run:

```bash
node --test workers/quests/src/page-motion-safety.test.ts scripts/text-density-audit.test.mjs
npm run proof:tg-mobile-contract
```

Expected RED: new scene selectors are not in the proof matrix.

**Step 2: Implement proof selectors and safe responsive rules**

Reuse the current canonical/diagnostic artifact split. Do not make screenshots the only accessibility assertion.

**Step 3: Run GREEN**

```bash
node --test workers/quests/src/page-motion-safety.test.ts scripts/text-density-audit.test.mjs
npm run audit:text-density
npm run proof:tg-mobile-contract
git diff --check
```

Expected: all widths and reduced-motion checks pass.

**Step 4: Commit**

```bash
git add workers/quests/src/visual-viewport-proof.mjs \
  workers/quests/src/page-motion-safety.test.ts \
  scripts/text-density-audit.test.mjs \
  workers/quests/src/operating-fabric-page.test.ts \
  docs/architecture/contracts/operating-fabric-visual-budget.md
git commit -m "test: prove operating fabric mobile safety"
```

## Task 13: Add deterministic integration and release evidence

**Files:**

- Modify: `workers/quests/src/live-proof-readiness.test.ts`
- Create: `workers/quests/src/mission-fabric-integration.test.ts`
- Modify: `scripts/standalone-audit.mjs`
- Modify: `scripts/standalone-smoke.mjs`
- Modify: `scripts/verify-release.mjs`
- Create: `docs/plans/evidence/cambium-operating-fabric-proof-template.md`

**Step 1: Write the failing end-to-end contract test**

The test must trace:

```text
company program packet / branch story
  → Goal Graph mission/task IDs
  → fenced run
  → durable receipt
  → mission-fabric projection
  → authenticated route
  → scene node and contextual Inspect sheet
```

Also assert:

- the same frozen source, fixed viewer, and source `asOf` yield the same
  redacted `graphDigest` across compiler, route, and page, regardless of
  `generatedAt`, transport `servedAt`, or derived freshness;
- shadow report has zero missing branch fact IDs;
- no D1/KV writer fires during projection;
- allowlist off returns legacy UI and a closed route;
- invalid auth never activates the operating-fabric bundle.

Run:

```bash
node --test workers/quests/src/mission-fabric-integration.test.ts
```

Expected RED: release scripts do not yet recognize the new evidence contract.

**Step 2: Add the three mandatory release gates**

Update audit/smoke/release scripts so promotion requires:

```bash
npm test
npm run standalone:audit
npm run standalone:smoke
```

The release verifier must also require a successful mobile-contract proof and a zero-gap shadow report for the pilot fixture.

**Step 3: Run GREEN across the complete local gate**

```bash
npm test
npm run render-docs:check
npm run drift:audit
npm run audit:text-density
npm run standalone:audit
npm run standalone:smoke
npm run proof:tg-mobile-contract
npm run verify:release
git diff --check
```

Expected: every command exits 0. Record command, commit SHA, timestamp, and artifact paths in the proof template; never paste secrets or Telegram `initData`.

**Step 4: Commit**

```bash
git add workers/quests/src/live-proof-readiness.test.ts \
  workers/quests/src/mission-fabric-integration.test.ts \
  scripts/standalone-audit.mjs \
  scripts/standalone-smoke.mjs \
  scripts/verify-release.mjs \
  docs/plans/evidence/cambium-operating-fabric-proof-template.md
git commit -m "test: gate operating fabric promotion"
```

## Task 14: Prove on a real Telegram device, promote one tenant, and rehearse rollback

**Files:**

- Create from template: `docs/plans/evidence/cambium-operating-fabric-<date>.md`
- Modify after acceptance: `.planning/ROADMAP-v0.4-continuation.md`
- Modify after acceptance: `docs/visual/README.md`
- Modify after acceptance: `docs/architecture/cambium-operating-fabric.md`

This task pauses for explicit founder approval before any deployment or allowlist change.

**Step 1: Prepare a staging candidate**

Run the complete Task 13 gate on the exact candidate SHA. Confirm `MISSION_FABRIC_TENANTS` remains unset in production.

**Step 2: Deploy only after approval**

Use the repository's existing staging procedure. Do not invent a new environment or change D1 schema. On a real Telegram client at 320px-class and 390px-class widths, capture:

- authenticated route status and digest;
- all five new scenes;
- one sapling and one company program;
- one Task → Run → Receipt trace;
- one agent/skill assignment;
- one missing-data gap;
- one valid contextual Gate proposal;
- one rejected replay or stale-fence attempt;
- reduced-motion behavior;
- zero-gap shadow comparison.

Record founder-device read proof and signed Gate proof as two independent
acceptance gates. One never substitutes for the other.

**Step 3: Obtain proof acceptance before exposure**

The proof document must be reviewed and accepted before adding even the pilot tenant to production `MISSION_FABRIC_TENANTS`. Code availability alone is not promotion.

**Step 4: Promote one tenant**

Add only the approved pilot tenant. Re-run:

```bash
npm run standalone:smoke
npm run proof:tg-mobile-contract
npm run verify:release
```

Verify legacy behavior for a non-allowlisted tenant.

**Step 5: Rehearse rollback**

Remove the pilot tenant from `MISSION_FABRIC_TENANTS`, confirm:

- legacy five-scene page is active;
- mission-fabric route is closed;
- no data or schema operation is required;
- signed Gate and existing quest routes remain healthy.

Re-add the pilot only if the rehearsal passes and the founder confirms.

**Step 6: Complete the handoff**

Update the roadmap and architecture status with exact commit, evidence, pilot tenant, rollback result, known gaps, and follow-up decision. Keep legacy scene removal as a separate later plan after multi-tenant evidence.

```bash
git add docs/plans/evidence/cambium-operating-fabric-<date>.md \
  .planning/ROADMAP-v0.4-continuation.md \
  docs/visual/README.md \
  docs/architecture/cambium-operating-fabric.md
git commit -m "docs: record operating fabric pilot proof"
```

## Definition of done

- The Mission Fabric compiler is deterministic, bounded, versioned, gap-explicit, and projection-origin rejecting.
- Saplings and programs share visual lineage without sharing lifecycle types or source packet schemas.
- Agents and skill clusters are overlays; they gain no project, scoring, registry, or assignment authority.
- The authenticated route is tenant-scoped, redacted, no-store, GET-only, and performs zero writes.
- The legacy five-scene UI remains the default when auth, allowlist, fetch, or proof conditions fail.
- Canopy, Mission, Flow, Workforce, Forge, Gate sheet, and Inspect sheet pass contract, mobile, motion, density, and accessibility checks.
- Existing nonce, expiry, tenant, actor, digest, head-version, and fence checks stay intact.
- No D1 migration is required. Any discovered canonical-data gap stops promotion and produces a separate expand-only ADR.
- `npm test`, `standalone:audit`, `standalone:smoke`, mobile proof, and release verification pass on the exact candidate SHA.
- One real-device Telegram pilot, zero-gap shadow comparison, and rollback rehearsal are documented before broader rollout.

## Execution choice

After the design baseline is committed, choose one:

1. **Subagent-Driven (this session)** — use `superpowers:subagent-driven-development`, execute one task at a time, and review between tasks.
2. **Parallel Session (separate)** — open the isolated worktree in a new session and use `superpowers:executing-plans` with checkpoints after Tasks 5, 8, 11, and 13.
