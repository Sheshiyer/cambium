# Branch Story Adapter Mini App Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a branch story adapter that turns Cambium product/service ingestion packets into branch arcs, questlines, missions, gates, proof signals, KPI inputs, and mini app control surfaces without replacing the existing quest ledger.

**Architecture:** Preserve the global `questLedger` as the Cambium readiness spine, then add a typed branch-story layer beside `project` evidence in `QuestInputs` and `VisualEnvelope`. Treat the branch packet as a rich control-input bundle, like a AAA game input stack: narrative, goals, player/entity state, mission queue, progression locks, proof triggers, KPI telemetry, routing, permissions, and dispatch commands all enter through one normalized adapter, then drive the Telegram mini app, operator policy, and bridge assignments.

**Tech Stack:** TypeScript/Node ESM, `node:test`, Markdown packet parsing, JSON schema validation, Cambium `QuestInputs`, visual envelope derivation, Telegram mini app inline renderer, Worker bridge assignment routes.

---

## Current State

- `docs/plans/product-branches/schema.json` validates the first product-branch packet contract, but it only asserts metadata and required sections.
- `docs/plans/product-branches/*.md` carry richer branch context: seed, organ routing, variable contract payloads, service maps, evidence, gates, quest queue, promotion rule, autonomy boundary, approvals, and proof states.
- `bin/operator/quests/quests.ts` has one global quest fold with generic `project` delivery evidence.
- `bin/quine/hyphae/quests.ts` gathers evidence, builds the `VisualEnvelope`, and derives policy, side quests, live proof, NPC, skills, senses, lanes, and decision context.
- `workers/quests/src/page.ts` renders a large Telegram mini app surface that currently speaks mostly in Cambium architecture vocabulary.
- `workers/quests/src/handler.ts` already supports bridge task assignments through `thoughtseed.project_task_assignment.v1`.

## Integrated Current State Across Cambium, Hermes, TG Mini App, And Plexus

This plan is not starting from a blank stack. The already-proven system is:

```text
Telegram founder/topic signal
  -> Hermes branch-brain + skill hints
  -> Hermes service forwards assignment/topic payloads
  -> Cambium Worker queues project_task_assignment directives in D1/bridge storage
  -> Plexus Agent Fabric syncs member-scoped directives
  -> Plexus member chooses manual|delegated workMode once
  -> Plexus reports status/evidence upstream
  -> Cambium consumes fabric_task_event/fabric_task_report
  -> Cambium evidence candidates/reviews fold proof back into the ledger
  -> TG mini app shows quest/policy/proof/gate state
```

Existing proof and code surfaces to preserve:

| Surface | Already done | Current contract to preserve |
| --- | --- | --- |
| Cambium quest fold | `questLedger`, `gatherQuestInputs`, `refreshProjectEvidence`, `operator-policy`, and `VisualEnvelope` already derive proof-backed state. | Do not replace the global ledger; add branch stories beside it. |
| Cambium Worker bridge | `/v1/bridge/assign-task`, `/v1/bridge/topic-assignment`, `/v1/fabric/consume`, evidence candidate review, D1 `BRIDGE_DB` schema. | Keep idempotent `eventId` behavior and scoped-token boundaries. |
| TG mini app | `workers/quests/src/page.ts` renders quest, map, policy, live proof, side quest, skill, gate, command, and sheet surfaces. | Main surface should become branch/arc/mission-first; architecture vocabulary stays in inspection sheets. |
| Hermes branch brain | `src/branch-brain.ts` already maps live Thoughtseed Telegram topics to quest assignments, approval requests, heartbeat/digest items, and skill hints. | Branch mission metadata must pass through topic assignments instead of being dropped. |
| Hermes service | `src/service.ts` forwards assignments to Cambium `/v1/bridge/assign-task` and topic decisions to `/v1/bridge/topic-assignment`. | Audit must remain redacted; EC2 remains execution body, not state authority. |
| Hermes skills | `docs/contracts/skill-loadout-contract.md` and `src/agent-skills.ts` model product, GTM, design, engineering, ops, GitHub loadouts. | Branch stories should reuse skill hints/loadouts, not invent a second skill vocabulary. |
| Plexus bridge | `src/main/thoughtseed-bridge.ts` stores scoped member token with `safeStorage`, polls/acks directives, reports events/evidence. | Plexus never stores Worker admin tokens and remains member-scoped. |
| Plexus Agent Fabric | `src/shared/thoughtseed-fabric-task.ts` parses `project_task_assignment`; `AgentFabricPanel.tsx` displays tasks and reports proof. | `workMode` is `manual | delegated`, chosen once; lifecycle `status` stays separate. |
| Live readiness | Hermes/Cambium/Plexus Fabric proof moved active bridge state off exhausted KV into D1 and proved assignment, override, report, consume, and review paths. | Do not collapse supervised readiness into 24/7 autonomy. App-action portability remains a later gate. |

Deep-pass gap found:

- Hermes `BranchDecision` has `branchId`, but `decisionToTopicAssignmentPayload` currently does not carry the branch story/mission control metadata forward.
- Cambium `normalizeAssignmentTask` currently preserves `taskId`, `projectId`, `questId`, client fields, priority, type, and skill hints, but would drop new `branchId`, `arcId`, `missionId`, `kpiIds`, `proofRequired`, `gateId`, and `promotionState` unless explicitly extended.
- Plexus `taskFromThoughtseedDirective` currently parses the assignment into `ThoughtseedFabricTask` without branch mission fields, so the member UI would still see generic project tasks unless the shared type and renderer are extended.
- The TG mini app can display branch missions only after the normalized branch story envelope and assignment path agree on the same mission IDs.

## Target State

- Product/service ingestion produces a normalized `BranchStoryArc[]` control packet.
- Each branch arc preserves far more than `branchId`, `arcId`, `vision`, `icp`, `kpis`, `questline`, `missions`, `gates`, `proofPaths`, and `promotionState`.
- The normalized model also carries organ routing, variable-contract groups, adapter/service dependencies, evidence ledgers, autonomy boundary, approvals, permission gates, dispatch hints, owner/capacity, risk/dependency priority signals, proof foldback rules, and UI copy primitives.
- `QuestInputs` receives branch story input without changing the existing global ledger behavior.
- `VisualEnvelope` gains a `branches` or `branchStories` section derived from product packets.
- The mini app gets a primary Branches/Arcs/Missions reading surface that uses product names and mission verbs instead of ontology-first labels.
- Operator policy can prioritize branch missions when their gates and evidence are complete.
- Bridge assignment can dispatch branch missions without inventing a second task schema.
- Existing no-fake-progress rules remain: missing packet data becomes an explicit gap, never fake readiness.

## Core Model

Add a branch story model with a narrow stable spine and an extensible `controls` payload:

```ts
export interface BranchStoryArc {
  branchId: string;
  productId: string;
  name: string;
  role: string;
  arcId: string;
  arcTitle: string;
  vision: BranchVision;
  icp: BranchIcp;
  kpis: BranchKpi[];
  questline: BranchQuestStage[];
  missions: BranchMission[];
  gates: BranchGate[];
  proofPaths: BranchProofPath[];
  promotion: BranchPromotionState;
  controls: BranchControlBundle;
  source: BranchStorySource;
  gaps: BranchStoryGap[];
}

export interface BranchControlBundle {
  productSeed: Record<string, string>;
  organRouting: BranchOrganRoute[];
  variableContractPayloads: BranchVariableContractGroup[];
  adapterServiceMap: BranchAdapterService[];
  evidenceLedger: BranchEvidenceRow[];
  approvals: BranchApproval[];
  autonomyBoundary: string;
  dispatchHints: BranchDispatchHint[];
  policySignals: BranchPolicySignal[];
  ui: {
    headline: string;
    currentFrontier: string;
    missionVerb: string;
    blockedCopy: string;
  };
}
```

This keeps the primary app model readable while preserving the full branch-control input surface.

## Implementation Notes

- Run this in a dedicated Cambium worktree if possible.
- Do not replace `QUEST_LINE` in this slice.
- Do not flatten product packets into only a few fields.
- Do not claim autonomous readiness from supervised packet data.
- Keep product packets as source artifacts; the adapter may emit `.operator/<tenant>.branch-stories.json` as derived state.
- Treat branch missions as product work; keep existing side quests as system/support work.
- The first slice should support the existing four packets: Fitcheck, Vantyx, Snow Gloves OS, and IVerif.
- Freeze the branch mission assignment contract before parallel work starts; otherwise Cambium, Hermes, and Plexus can each "support" missions while silently disagreeing on the payload.
- Treat `package.json`, bridge schemas, shared task types, and mini app surface contract files as lock zones. Only one integration owner should touch them in a wave.

## Swarm Architect Execution Overlay

Discovery summary:

- Planning depth: deeply detailed.
- Delivery mode: hardening, because the bridge/Fabric loop is already live-proven and must not regress.
- Release model: phased rollout.
- Quality bar: tests, validators, D1/schema proof, viewport proof, live-proof boundary notes, and no-secret/no-fake-progress scans.
- Team topology: small swarm with one orchestrator, one Cambium/TG mini app executor, one Hermes/backend executor, one Plexus/app executor, and one validation reviewer.
- Constraints: Cloudflare remains authority; EC2 remains execution body; Plexus remains scoped member client; Telegram remains untrusted intent ingress; supervised branch readiness must not be called autonomy.

Agent ownership model:

| Concern | Primary owner | Secondary reviewer | Lock-zone notes |
| --- | --- | --- | --- |
| Orchestration and contracts | Planner / orchestrator | Human lead | Owns phase/wave boundaries, GitHub issue graph, and cross-repo contract packets. |
| Cambium quest, Worker, TG mini app | UI/app implementation agent | Validation agent | Owns `bin/operator`, `bin/quine`, `workers/quests`, and branch packet validators. |
| Hermes routing and EC2 bridge path | Backend/cloud agent | Planner / orchestrator | Owns `src/branch-brain.ts`, `src/service.ts`, skill loadout docs, and hosted-route proof. |
| Plexus member task surface | UI/app implementation agent | Validation agent | Owns bridge task parsing, safeStorage boundary, Agent Fabric task display/reporting. |
| Validation and adversarial review | Validation agent | Planner / orchestrator | Owns no-fake-progress, no-secret, payload compatibility, and regression proof. |

Phase map:

### Phase 1 - Contract Freeze And Proven Loop Alignment

Goal: freeze a branch mission contract that spans packets, Cambium, Hermes, Plexus, and the TG mini app before parallel implementation.

Exit criteria:

- Branch story contract names source packet fields and assignment metadata.
- Cambium/Hermes/Plexus payload fields are listed in one shared contract packet.
- Existing Fabric v1 rules remain explicit: member-scoped tasks only, `workMode` once, `status` separate, weak evidence reviewable, verified evidence proof-backed.
- GitHub issue/task ownership can be generated without lock-zone collisions.

Waves:

- Wave 1A - contract inventory: read current code/docs and produce shared contract packet.
- Wave 1B - schema freeze: branch story, assignment metadata, and proof foldback types.
- Wave 1C - baseline validation: run existing Cambium/Hermes/Plexus focused tests and record pass/fail.

### Phase 2 - Parallel Implementation

Goal: implement branch story inputs and mission metadata on disjoint surfaces.

Exit criteria:

- Cambium parses branch packets and emits `branchStories` in the visual envelope.
- Hermes preserves branch mission metadata and skill hints when forwarding topic/assignment payloads.
- Plexus parses and renders branch mission metadata while keeping member-token and work-mode rules intact.
- TG mini app renders branch arcs/missions from the same IDs used by assignments.

Waves:

- Wave 2A - Cambium data/model/parser.
- Wave 2B - Hermes routing/skill-hint payload.
- Wave 2C - Plexus task metadata/display/reporting.
- Wave 2D - TG mini app branch mission surface.

### Phase 3 - Integration, Proof, And Rollout Handoff

Goal: prove one branch mission travels through the whole engine and returns evidence without overclaiming autonomy.

Exit criteria:

- Synthetic end-to-end proof: packet mission -> Cambium assignment -> Plexus task -> upstream report -> Cambium consume/review -> TG mini app proof state.
- Existing bridge/Fabric tests still pass in all three repos.
- Viewport proof captures branch mission UI, while live Telegram proof remains separately gated.
- Handoff lists remaining app-action portability gaps.

Wave-level validation rules:

- No wave closes without test output or file read-back evidence.
- No worker session edits shared contracts without orchestrator approval.
- No product branch can promote from blocked/pending proof.
- No secret-bearing token, Telegram init data, or raw auth header may appear in docs, payload fixtures, logs, mini app UI, or validation artifacts.

### Task 1: Baseline Guards And Current Surface Inventory

**Files:**
- Read: `docs/plans/product-branches/schema.json`
- Read: `docs/plans/product-branches/index.md`
- Read: `docs/plans/product-branches/fitcheck.md`
- Read: `docs/plans/product-branches/vantyx.md`
- Read: `docs/plans/product-branches/snow-gloves-os.md`
- Read: `docs/plans/product-branches/iverif.md`
- Read: `bin/operator/quests/quests.ts`
- Read: `bin/quine/hyphae/quests.ts`
- Read: `workers/quests/src/page.ts`
- Read: `workers/quests/src/handler.ts`
- Read: `<hermes-aws-ts-root>/src/branch-brain.ts`
- Read: `<hermes-aws-ts-root>/src/service.ts`
- Read: `<hermes-aws-ts-root>/docs/contracts/skill-loadout-contract.md`
- Read: `<plexus-ts-root>/src/shared/thoughtseed-fabric-task.ts`
- Read: `<plexus-ts-root>/src/main/thoughtseed-bridge.ts`
- Read: `<plexus-ts-root>/src/renderer/components/AgentFabricPanel.tsx`

**Step 1: Capture dirty worktree state**

Run:

```bash
git status --short --branch
```

Expected: note existing packet/schema changes and preserve them.

**Step 2: Run existing branch packet validator**

Run:

```bash
npm run validate:product-branches
```

Expected: PASS. If the script is not on the current branch, run `node scripts/validate-product-branch-packets.mjs`.

**Step 3: Run focused quest and mini app tests**

Run:

```bash
node --test bin/operator/quests/quests.test.ts bin/quine/hyphae/quests.test.ts workers/quests/src/handler.test.ts
```

Expected: current baseline behavior is known before adding branch stories.

**Step 4: Run existing sibling bridge baselines**

Run from Hermes:

```bash
cd <hermes-aws-ts-root>
node --test src/branch-brain.test.ts src/service.test.ts
npm run smoke:branch-brain
```

Run from Plexus:

```bash
cd <plexus-ts-root>
npm run smoke:thoughtseed-bridge
npm run typecheck
```

Expected: baseline route/parse/report behavior is known before branch mission metadata changes.

### Task 1A: Freeze The Cross-Repo Branch Mission Contract

**Files:**
- Create: `docs/architecture/contracts/branch-mission-fabric-contract.md`
- Modify: `docs/plans/2026-06-29-branch-story-adapter-miniapp-plan.md`
- Read: `<hermes-aws-ts-root>/docs/contracts/skill-loadout-contract.md`
- Read: `<plexus-ts-root>/docs/evidence/2026-06-23-plexus-cambium-assignment-release-prep.md`

**Step 1: Document the frozen assignment metadata**

Add this stable task metadata contract:

```ts
export interface BranchMissionAssignmentMeta {
  branchId: string;
  arcId: string;
  missionId: string;
  kpiIds: string[];
  gateId?: string;
  proofRequired: string;
  proofFoldback: string;
  promotionState: 'proof-only' | 'supervised-branch' | 'autonomous-branch' | 'organ-service';
  autonomyBoundary: string;
  approvalsRequired: string[];
  skillHints?: BranchSkillHint[];
}
```

Expected: this contract becomes the shared source for Tasks 4-8.

**Step 2: Document existing preserved Fabric rules**

Record:

- assignment directives remain `thoughtseed.project_task_assignment.v1`;
- `fabric_task_event` and `fabric_task_report` remain upstream evidence paths;
- `workMode` remains `manual | delegated`;
- `workModeLocked` remains true after first choice;
- `status` remains separate from `workMode`;
- note-only `done` remains `weak_evidence`;
- verified proof can become `verified_evidence` only through accepted evidence/review rules.

Expected: downstream agents can implement without reopening these rules.

**Step 3: Add lock-zone declaration**

List lock-zone files:

- `package.json` in each repo;
- `workers/quests/schema/bridge.sql`;
- `workers/quests/src/handler.ts`;
- `src/shared/types.ts` in Plexus;
- any shared schema/contract docs used by more than one swarm.

Expected: parallel work cannot edit these without a named integration owner.

**Execution note (2026-06-29):** The first shared contract is frozen at `docs/architecture/contracts/branch-mission-fabric-contract.md`. It preserves `thoughtseed.project_task_assignment.v1`, member-scoped Fabric rules, one-time `workMode`, separate lifecycle `status`, weak-evidence review, branch mission metadata, skill hints, and lock-zone ownership before Hermes/Plexus implementation waves.

### Task 2: Extend The Product Packet Schema For Game-Control Inputs

**Files:**
- Modify: `docs/plans/product-branches/schema.json`
- Modify: `scripts/validate-product-branch-packets.mjs`
- Test: `scripts/validate-product-branch-packets.mjs`

**Step 1: Add richer required packet sections**

Extend `required_sections` to include:

```json
"Branch Story Controls",
"Mission Control Inputs",
"KPI Control Inputs",
"Policy / Permission Inputs",
"Dispatch Inputs",
"Proof Foldback"
```

Expected: validation fails until all packet docs add these sections.

**Step 2: Add validation for branch-control rows**

In `scripts/validate-product-branch-packets.mjs`, require each packet to expose at least one mission, one KPI, one policy/permission input, one dispatch input, and one proof foldback rule.

Expected: missing sections fail with actionable packet names.

**Step 3: Run validator and confirm failure**

Run:

```bash
npm run validate:product-branches
```

Expected: FAIL listing missing new control sections for all four packets.

### Task 3: Enrich Existing Product Packets

**Files:**
- Modify: `docs/plans/product-branches/fitcheck.md`
- Modify: `docs/plans/product-branches/vantyx.md`
- Modify: `docs/plans/product-branches/snow-gloves-os.md`
- Modify: `docs/plans/product-branches/iverif.md`
- Test: `scripts/validate-product-branch-packets.mjs`

**Step 1: Add `Branch Story Controls`**

For each packet, add a table:

```markdown
## Branch Story Controls

| Control | Value |
| --- | --- |
| arc_title | `Supervised Launch Hardening` |
| vision | One sentence describing the world this branch makes true. |
| icp | The first customer/operator persona this branch serves. |
| current_frontier | The real branch frontier, not a generic Cambium arc. |
| narrative_voice | Operator-facing voice for this branch. |
| anti_claims | Claims the mini app must not make yet. |
```

Expected: Fitcheck uses supervised launch language; Vantyx, Snow Gloves OS, and IVerif keep proof-only boundaries unless packet evidence says otherwise.

**Step 2: Add `Mission Control Inputs`**

For each packet, add mission rows:

```markdown
## Mission Control Inputs

| mission_id | title | type | owner | gate | proof_required | dispatch_target |
| --- | --- | --- | --- | --- | --- | --- |
| fitcheck-shopify-qa | Run authenticated Shopify widget QA | proof | founder/codex | Credentials | screenshot plus event log | hermes |
```

Expected: mission IDs are stable, product-prefixed, and dispatchable.

**Step 3: Add KPI, policy, dispatch, and foldback sections**

Use these tables:

```markdown
## KPI Control Inputs

| kpi_id | label | survival | better_than_survival | source | current_state |
| --- | --- | --- | --- | --- | --- |

## Policy / Permission Inputs

| permission | status | required_approval | failure_mode |
| --- | --- | --- | --- |

## Dispatch Inputs

| route | payload_hint | allowed_when | blocked_when |
| --- | --- | --- | --- |

## Proof Foldback

| proof_id | source_path | validates | promotes |
| --- | --- | --- | --- |
```

Expected: the packet preserves the broader branch-control output surface.

**Step 4: Run packet validation**

Run:

```bash
npm run validate:product-branches
```

Expected: PASS.

### Task 4: Add The Branch Story Parser

**Files:**
- Create: `bin/quine/hyphae/branch-stories.ts`
- Create: `bin/quine/hyphae/branch-stories.test.ts`
- Read: `docs/plans/product-branches/*.md`

**Step 1: Write failing parser tests**

Test that the parser:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBranchStories } from './branch-stories.ts';

test('loads branch stories from product packets without flattening controls', () => {
  const stories = loadBranchStories({ root: process.cwd() }, 'cambium');
  const fitcheck = stories.find((story) => story.productId === 'fitcheck');
  assert.ok(fitcheck);
  assert.equal(fitcheck?.promotion.state, 'supervised-branch');
  assert.ok(fitcheck?.controls.organRouting.length);
  assert.ok(fitcheck?.controls.variableContractPayloads.length);
  assert.ok(fitcheck?.controls.adapterServiceMap.length);
  assert.ok(fitcheck?.missions.length);
  assert.ok(fitcheck?.kpis.length);
  assert.ok(fitcheck?.proofPaths.length);
});
```

**Step 2: Run and verify failure**

Run:

```bash
node --test bin/quine/hyphae/branch-stories.test.ts
```

Expected: FAIL because `branch-stories.ts` does not exist.

**Step 3: Implement parser with fail-soft gaps**

Implement:

```ts
export function loadBranchStories(ctx: { root: string }, tenant: string): BranchStoryArc[] {
  // Read docs/plans/product-branches/index.md and each listed packet.
  // Parse YAML frontmatter and required markdown tables.
  // Convert missing optional values into BranchStoryGap rows.
  // Convert missing required control sections into blocked gaps.
  // Never infer verified evidence from pending or blocked rows.
}
```

Expected: packets become normalized branch stories and missing proof remains visible.

**Step 4: Run parser tests**

Run:

```bash
node --test bin/quine/hyphae/branch-stories.test.ts
```

Expected: PASS.

### Task 5: Wire Branch Stories Into Quest Inputs And Visual Envelope

**Files:**
- Modify: `bin/operator/quests/quests.ts`
- Modify: `bin/quine/hyphae/quests.ts`
- Modify: `bin/quine/hyphae/quests.test.ts`
- Test: `bin/operator/quests/quests.test.ts`
- Test: `bin/quine/hyphae/quests.test.ts`

**Step 1: Add branch story input type**

In `QuestInputs`, add:

```ts
branchStories?: BranchStoryArc[];
```

Expected: existing quest ledger tests still pass because global `QUEST_LINE` ignores branch stories for now.

**Step 2: Gather branch stories fail-soft**

In `gatherQuestInputs`, call:

```ts
const branchStories = loadBranchStories(ctx, tenant);
```

Return it as part of `QuestInputs`; on parser failure, return no stories and emit a gap through the visual branch envelope.

**Step 3: Add `branchStories` to `VisualEnvelope`**

Add:

```ts
branchStories: {
  source: 'product-branch-packets' | 'missing';
  status: 'ready' | 'partial' | 'empty';
  rows: BranchStoryArc[];
  activeBranchId?: string;
  gaps?: BranchStoryGap[];
};
```

**Step 4: Derive active branch frontier**

Implement `deriveBranchStoryEnvelope(inputs)` that:
- sorts supervised branches before proof-only branches when proof is actionable;
- keeps autonomous claims blocked unless `promotion_state` says autonomous and proof agrees;
- selects the first mission whose gate is not complete as active;
- exposes KPI and proof gaps.

**Step 5: Run focused tests**

Run:

```bash
node --test bin/operator/quests/quests.test.ts bin/quine/hyphae/quests.test.ts
```

Expected: PASS with new branch story assertions.

### Task 6: Teach Operator Policy About Branch Missions

**Files:**
- Modify: `bin/operator/quests/operator-policy.ts`
- Modify: `bin/operator/quests/operator-policy.test.ts`
- Modify: `bin/quine/hyphae/quests.ts`
- Test: `bin/operator/quests/operator-policy.test.ts`

**Step 1: Write failing policy test**

Add a test proving an evidence-complete branch mission can outrank a generic frontier action, while blocked permissions prevent recommendation.

Expected: FAIL until policy accepts branch mission candidates.

**Step 2: Add branch mission candidate input**

Extend policy evaluation to accept normalized branch mission candidates:

```ts
{
  missionId: string;
  branchId: string;
  title: string;
  gateStatus: 'ready' | 'blocked' | 'pending' | 'complete';
  proofRequired: string;
  risk?: string;
  dependency?: string;
  dispatchTarget?: string;
}
```

**Step 3: Preserve approval gates**

Policy must block missions when:
- permission status is blocked;
- proof required is missing;
- autonomy boundary says founder approval is required;
- dispatch target is not allowed.

**Step 4: Run policy tests**

Run:

```bash
node --test bin/operator/quests/operator-policy.test.ts
```

Expected: PASS.

### Task 7: Render Branches, Arcs, And Missions In The Mini App

**Files:**
- Modify: `workers/quests/src/mini-app-surface-contract.ts`
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`
- Test: `workers/quests/src/handler.test.ts`

**Step 1: Add branch/missions surface contract IDs**

Add scene or section IDs:

```ts
'branches'
'branch-arcs'
'branch-missions'
'branch-kpis'
'branch-gates'
'branch-proof'
```

Expected: contract tests fail until page renders these markers.

**Step 2: Add branch renderer**

In `page.ts`, add render functions:

```js
function renderBranches(env) {}
function renderBranchArcCard(branch) {}
function renderBranchMissionCard(mission, branch) {}
function openBranchMissionSheet(env, branchIndex, missionIndex) {}
```

Expected: the first screen names real product branches and mission frontiers.

**Step 3: Keep architecture vocabulary secondary**

Replace primary user-facing labels like `R3F CONTRACT`, `packet rails`, and `shared/cambium-visual-contract.ts` on the main path with product work language:
- Branch
- Arc
- Mission
- Gate
- Proof
- KPI
- Next move

Keep raw contract/source labels in sheets and audit rows.

**Step 4: Add no-fake-progress UI tests**

Test that missing branch data renders explicit gaps and does not say ready, autonomous, shipped, launched, or approved unless packet proof allows it.

**Step 5: Run mini app tests**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

### Task 8: Map Branch Missions To Bridge Assignments

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`
- Modify: `<hermes-aws-ts-root>/src/branch-brain.ts`
- Modify: `<hermes-aws-ts-root>/src/branch-brain.test.ts`
- Modify: `<hermes-aws-ts-root>/src/service.ts`
- Modify: `<hermes-aws-ts-root>/src/service.test.ts`
- Modify: `<plexus-ts-root>/src/shared/types.ts`
- Modify: `<plexus-ts-root>/src/shared/thoughtseed-fabric-task.ts`
- Modify: `<plexus-ts-root>/src/main/thoughtseed-bridge.ts`
- Modify: `<plexus-ts-root>/src/renderer/components/AgentFabricPanel.tsx`
- Test: `workers/quests/src/handler.test.ts`
- Test: `<hermes-aws-ts-root>/src/branch-brain.test.ts`
- Test: `<hermes-aws-ts-root>/src/service.test.ts`
- Test: `<plexus-ts-root>/scripts/smoke-thoughtseed-bridge.mjs`

**Step 1: Extend assignment normalization without changing schema**

Keep `thoughtseed.project_task_assignment.v1`, but allow mission metadata inside `task`:

```ts
{
  projectId: 'fitcheck',
  questId: 'fitcheck-shopify-qa',
  branchId: 'fitcheck',
  arcId: 'supervised-launch-hardening',
  missionId: 'fitcheck-shopify-qa',
  kpiIds: ['merchant-demo'],
  proofRequired: 'screenshot plus event log',
  gateId: 'credentials',
  promotionState: 'supervised-branch'
}
```

Expected: `normalizeAssignmentTask` preserves this metadata in the directive payload and still rejects missing `taskId`, `projectId`, or `title`.

**Step 2: Add conflict/idempotency tests**

Test same `eventId` + same mission payload returns duplicate; same `eventId` + different mission payload returns `409`.

Expected: mission metadata participates in payload hash, so idempotency protects branch mission identity.

**Step 3: Preserve Hermes branch mission metadata**

Extend Hermes `BranchDecision` and `CambiumTopicAssignmentRequest` so `branchId`, optional `arcId`, optional `missionId`, `skillHints`, and branch proof context survive `decisionToTopicAssignmentPayload`.

Add tests:

```ts
test("branch brain forwards branch mission metadata to Cambium topic assignment", () => {
  const decision = classifyTopicSignal(defaultBranchBrainProfile({ branchId: "fitcheck" }), {
    chatId: THOUGHTSEED_TELEGRAM_CHAT_ID,
    topicKey: "dev",
    threadId: 862,
    messageId: "m-fitcheck-qa",
    text: "Fitcheck product branch needs Shopify widget QA proof packet.",
  });
  const payload = decisionToTopicAssignmentPayload(decision);
  assert.equal(payload?.branchId, "fitcheck");
  assert.equal(payload?.skillHints?.[0]?.skillId, "product-branch-growth");
});
```

Expected: Hermes does not collapse branch work into generic `thoughtseed-ops`.

**Step 4: Preserve Plexus branch mission metadata**

Extend Plexus shared task types and parser to retain:

```ts
branchId?: string;
arcId?: string;
missionId?: string;
kpiIds?: string[];
gateId?: string;
proofRequired?: string;
proofFoldback?: string;
promotionState?: string;
autonomyBoundary?: string;
approvalsRequired?: string[];
skillHints?: unknown[];
```

Expected: Agent Fabric task cards can show branch mission context, but reporting remains unchanged: member chooses `manual | delegated`, reports `status`, and attaches evidence.

**Step 5: Update Plexus card copy without changing authority**

In `AgentFabricPanel.tsx`, show branch/arc/mission/KPI/proof context as task metadata. Do not add external action buttons. Use existing report/proof controls.

Expected: Plexus becomes the member mission surface, not a new authority plane.

**Step 6: Run bridge tests**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

Run from Hermes:

```bash
cd <hermes-aws-ts-root>
node --test src/branch-brain.test.ts src/service.test.ts
npm run smoke:branch-brain
```

Expected: PASS.

Run from Plexus:

```bash
cd <plexus-ts-root>
npm run smoke:thoughtseed-bridge
npm run typecheck
```

Expected: PASS.

### Task 9: Add Branch Story Validation Command

**Files:**
- Create: `scripts/validate-branch-stories.mjs`
- Modify: `package.json`
- Test: `scripts/validate-branch-stories.mjs`

**Step 1: Add CLI validator**

The validator should:
- parse all product packets;
- load branch stories;
- assert every branch has at least one mission, KPI, gate, proof foldback rule, and promotion rule;
- assert blocked/pending proof cannot promote a branch;
- emit JSON summary when `--json` is passed.

**Step 2: Add package script**

In `package.json`, add:

```json
"validate:branch-stories": "node scripts/validate-branch-stories.mjs"
```

**Step 3: Run validator**

Run:

```bash
npm run validate:branch-stories
```

Expected: PASS.

### Task 10: Viewport And Live-Proof Readiness Pass

**Files:**
- Modify: `workers/quests/src/visual-fixtures.ts`
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `docs/plans/assets/tg-miniapp-viewport-proof/README.md`
- Test: `workers/quests/src/visual-viewport-proof.mjs`

**Step 1: Add branch story fixture**

Create a fixture with:
- Fitcheck supervised branch active;
- Vantyx, Snow Gloves OS, and IVerif proof-only;
- one blocked permission;
- one ready mission;
- one KPI gap;
- one proof foldback gap.

**Step 2: Capture viewport proof**

Run:

```bash
npm run proof:tg-viewport
```

Expected: manifest includes branch, mission, gate, KPI, and proof screenshots.

**Step 3: Keep live-proof boundary explicit**

Update README wording so viewport screenshots remain layout proof only. Live Telegram founder-device proof still requires the existing live-proof readiness path.

### Task 11: Documentation And Handoff

**Files:**
- Create: `docs/architecture/contracts/branch-story-adapter-contract.md`
- Modify: `docs/plans/product-branches/index.md`
- Modify: `docs/plans/2026-06-22-tg-miniapp-visual-engine-execution.md`

**Step 1: Document the adapter contract**

Explain:
- branch packet in;
- normalized branch story out;
- mission/control surfaces;
- policy rules;
- proof foldback;
- no-fake-progress constraints.

**Step 2: Update product branch index**

Add columns:
- active_arc;
- active_mission;
- kpi_frontier;
- proof_foldback;
- miniapp_status.

**Step 3: Update TG mini app ledger**

Add a slice note that the mini app now presents product branch missions as first-class work while retaining architecture/proof sheets as inspection layers.

### Task 12: Full Verification Gate

**Files:**
- Test: `package.json`
- Test: `docs/plans/product-branches/*.md`
- Test: `bin/operator/quests/*.test.ts`
- Test: `bin/quine/hyphae/*.test.ts`
- Test: `workers/quests/src/*.test.ts`
- Test: `<hermes-aws-ts-root>/package.json`
- Test: `<plexus-ts-root>/package.json`

**Step 1: Run branch validators**

Run:

```bash
npm run validate:product-branches
npm run validate:branch-stories
```

Expected: both PASS.

**Step 2: Run focused tests**

Run:

```bash
node --test bin/operator/quests/quests.test.ts bin/operator/quests/operator-policy.test.ts bin/quine/hyphae/quests.test.ts bin/quine/hyphae/branch-stories.test.ts workers/quests/src/handler.test.ts
```

Expected: PASS.

**Step 3: Run full repo gate**

Run:

```bash
npm test
```

Expected: PASS.

**Step 4: Run sibling bridge gates**

Run:

```bash
cd <hermes-aws-ts-root>
node --test src/branch-brain.test.ts src/service.test.ts src/agent-skills.test.ts
npm run smoke:branch-brain
npm run smoke:assignment
```

Expected: PASS, with no token values in audit output.

Run:

```bash
cd <plexus-ts-root>
npm run smoke:thoughtseed-bridge
npm run typecheck
npm run build:preload
npm exec vite -- build
```

Expected: PASS, with existing parent-workspace Vite warning allowed only if it remains non-fatal.

**Step 5: Run synthetic end-to-end branch mission proof**

Use a redacted synthetic Fitcheck mission payload:

```json
{
  "memberId": "shesh",
  "task": {
    "taskId": "fitcheck-shopify-qa-proof",
    "projectId": "fitcheck",
    "projectName": "Fitcheck",
    "questId": "fitcheck-shopify-qa",
    "branchId": "fitcheck",
    "arcId": "supervised-launch-hardening",
    "missionId": "fitcheck-shopify-qa",
    "kpiIds": ["merchant-demo"],
    "gateId": "credentials",
    "proofRequired": "authenticated product-page screenshot plus widget event log",
    "proofFoldback": "Cambium branch proof packet and Fabric evidence candidate",
    "promotionState": "supervised-branch",
    "title": "Run authenticated Shopify widget QA",
    "priority": "high",
    "taskType": "engineering"
  }
}
```

Expected proof path:

1. Cambium queues a `project_task_assignment` with branch mission metadata.
2. Plexus parser retains branch mission metadata.
3. Plexus report returns `fabric_task_report`.
4. Cambium `/v1/fabric/consume` creates or updates task/evidence rows.
5. TG mini app envelope references the same `missionId`.

**Step 6: Review no-fake-progress language**

Run:

```bash
rg -n "autonomous|approved|launched|ready|shipped|verified_evidence|weak_evidence" \
  workers/quests/src/page.ts \
  docs/plans/product-branches \
  <hermes-aws-ts-root>/src \
  <plexus-ts-root>/src
```

Expected: every readiness claim is backed by packet proof or presented as blocked/pending; every weak/verified evidence boundary remains visible.

**Step 7: Secret and retired-vocabulary scan**

Run:

```bash
rg -n "BRIDGE_TOKEN=|HERMES_ASSIGNMENT_TOKEN=|Authorization: Bearer|telegram_init_data|initData=|downstream_multica|multica_agent|TeamForge" \
  docs/plans/2026-06-29-branch-story-adapter-miniapp-plan.md \
  docs/architecture/contracts \
  workers/quests/src \
  <hermes-aws-ts-root>/src \
  <plexus-ts-root>/src
```

Expected: no raw secrets; retired vocabulary appears only in explicitly legacy/provenance text.

**Step 8: Commit final slice**

Run:

```bash
git add docs/plans/product-branches docs/architecture/contracts/branch-story-adapter-contract.md docs/architecture/contracts/branch-mission-fabric-contract.md bin/operator/quests bin/quine/hyphae workers/quests/src scripts/validate-branch-stories.mjs package.json docs/plans/2026-06-22-tg-miniapp-visual-engine-execution.md docs/plans/2026-06-29-branch-story-adapter-miniapp-plan.md
git commit -m "feat: add branch story mission adapter"
```

Expected: commit succeeds with only branch story adapter work.

## Execution Order

1. Validate current packets, Cambium quest/mini app tests, Hermes branch/service tests, and Plexus bridge smoke.
2. Freeze the branch mission Fabric contract before any parallel implementation.
3. Expand packet schema and packet docs with branch control inputs.
4. Build the Cambium parser and normalized branch story model.
5. Feed `QuestInputs` and `VisualEnvelope`.
6. Teach policy branch mission priority.
7. Preserve mission metadata through Hermes branch-brain and service forwarding.
8. Preserve mission metadata through Cambium assignment normalization and D1 idempotency.
9. Preserve mission metadata through Plexus task parsing, display, and reports.
10. Render branch missions in the TG mini app.
11. Add validators, proof fixtures, viewport proof, and synthetic end-to-end branch mission proof.
12. Document the contract and handoff.
13. Run full cross-repo verification.

## Non-Goals

- Do not remove global `QUEST_LINE`.
- Do not make the app claim autonomous operation from supervised packets.
- Do not dispatch real external actions from the mini app without signed, idempotent, permission-gated routes.
- Do not replace live Telegram proof with viewport screenshots.
- Do not collapse rich packet controls into a tiny schema just because the UI only renders a few cards first.
- Do not move Cloudflare authority into EC2 Hermes.
- Do not put Worker admin tokens, Hermes assignment tokens, or member tokens into Plexus renderer code, mini app payloads, docs, logs, or fixtures.
- Do not reintroduce TeamForge/MultiCA vocabulary into active surfaces except as explicitly marked legacy/provenance.
- Do not treat branch missions as external app actions until Composio/app-action portability is separately proven.

## First Slice Recommendation

Start with Tasks 1, 1A, 2, 3, 4, and 5. That freezes the cross-repo mission contract and gives Cambium the branch story input layer plus visual envelope without risking the large inline mini app renderer first. Once the data contract is proven, run the Hermes/Plexus metadata preservation work before the final TG mini app mission board, because otherwise the UI will show missions that cannot travel through the live Fabric loop.
