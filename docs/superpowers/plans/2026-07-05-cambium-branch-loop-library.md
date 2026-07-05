# Cambium Branch Loop Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proof-bound Cambium branch-loop library that turns product-branch packets into manual-first loop contracts with objectives, metrics, boundaries, state files, stop rules, and Mission Control visibility.

**Architecture:** Extend the existing product-branch packet contract rather than creating a second planning surface. Product packets define loop controls, the branch-story parser exposes them, a small loop-library module derives run safety and state-file targets, the visual envelope carries loop status, Mission Control renders it, and Cambium bridge assignments can preserve loop metadata when a supervised task is dispatched.

**Tech Stack:** Node ESM, TypeScript loaded by Node, `node:test`, Markdown packet parsing, existing Cambium product-branch validator, existing Telegram mini app renderer in `workers/quests/src/page.ts`.

## Global Constraints

- Do not activate scheduled unattended execution in this implementation; every loop is manual-first until a human approves scheduling.
- Preserve the existing ladder: `proof-only -> supervised branch -> autonomous branch`; no product skips a rung.
- Boundary colors are exact lowercase values: `green`, `yellow`, `red`.
- Green loops may only read repo/runtime state and write `.operator/branch-loops/*` runtime files.
- Yellow loops may draft actions, PRs, or assignments but require human approval before shipping.
- Red loops never run alone because they touch money, production, outbound messages, customer-visible claims, credentials, or spend.
- Every loop control row must include: `loop_id`, `title`, `cadence`, `objective`, `metric`, `boundary_color`, `one_change_rule`, `state_file`, `stop_rule`, `model_route`, `proof_required`.
- Each loop round must select exactly one change or one decision request; never batch multiple product gates in one run.
- Loop state files live under `.operator/branch-loops/` and remain ignored runtime state.
- No new npm dependencies.
- No secrets, auth tokens, Telegram init data, raw env values, customer PII, or provider keys may be written to packet docs, fixtures, generated loop reports, or UI output.
- Existing user changes in `workers/quests/src/page.ts` and `workers/quests/src/handler.test.ts` must be preserved; execution should start from a clean isolated worktree if these files are still dirty.

---

## Scope Check

This plan spans packet schema, parser types, loop derivation, visual envelope, mini app rendering, and Cambium bridge assignment metadata. These are one coupled subsystem because they all serve one contract: a branch packet loop must remain the same object from Markdown source to operator proof. Do not split this into independent plans unless execution needs to happen across sibling repos such as Hermes or Plexus.

## File Structure

- Modify `docs/plans/product-branches/schema.json`: require `Loop Control Inputs` and its exact columns.
- Modify `docs/plans/product-branches/fitcheck.md`: add Fitcheck launch-gate loop contract.
- Modify `docs/plans/product-branches/vantyx.md`: add Vantyx second-tenant proof loop contract.
- Modify `docs/plans/product-branches/snow-gloves-os.md`: add Snow Gloves OS approval-gate proof loop contract.
- Modify `docs/plans/product-branches/iverif.md`: add IVerif claim/proof separation loop contract.
- Create `docs/plans/product-branches/loop-library.md`: human-readable branch-loop library index and boundary rules.
- Modify `scripts/validate-product-branch-packets.mjs`: enforce loop table columns, boundary colors, and `.operator/branch-loops/` state-file prefix.
- Modify `package.json`: add `branch-loops:check`.
- Modify `bin/operator/quests/branch-stories.ts`: add `BranchLoop` types and expose loops through `BranchControlBundle`.
- Modify `bin/quine/hyphae/branch-stories.ts`: parse `Loop Control Inputs` into branch stories and produce gaps for malformed loop controls.
- Modify `bin/quine/hyphae/branch-stories.test.ts`: cover parser output and rejected loop state paths.
- Create `bin/operator/quests/branch-loop-library.ts`: derive loop rows, color counts, run permission, and state-file targets from branch stories.
- Create `bin/operator/quests/branch-loop-library.test.ts`: prove green/yellow/red semantics and one-change/stop-rule preservation.
- Modify `bin/quine/hyphae/quests.ts`: add `branchLoops` to the visual envelope.
- Modify `bin/quine/hyphae/quests.test.ts`: prove envelope loop summary does not alter quest ledger completion.
- Create `scripts/branch-loop-library.mjs`: manual checker that prints loop summary and writes `.operator/branch-loops/index.json`.
- Modify `workers/quests/src/mini-app-surface-contract.ts`: add the `branch-loops` target.
- Modify `workers/quests/src/page.ts`: render loop controls in Mission Control and branch sheets without making them look autonomous.
- Modify `workers/quests/src/handler.test.ts`: assert loop controls render and unsafe autonomy language is absent.
- Modify `workers/quests/src/handler.ts`: preserve loop metadata on supervised bridge assignments.
- Modify `workers/quests/src/handler.test.ts`: assert assignment payload includes `loopId`, `loopBoundaryColor`, `loopStateFile`, `loopStopRule`, and `loopOneChangeRule`.

## Task 1: Packet Loop Contract

**Files:**
- Modify: `docs/plans/product-branches/schema.json`
- Modify: `docs/plans/product-branches/fitcheck.md`
- Modify: `docs/plans/product-branches/vantyx.md`
- Modify: `docs/plans/product-branches/snow-gloves-os.md`
- Modify: `docs/plans/product-branches/iverif.md`
- Create: `docs/plans/product-branches/loop-library.md`

**Interfaces:**
- Consumes: existing packet schema `cambium.product_branch_packet.v1`.
- Produces: a `Loop Control Inputs` Markdown table with exact columns consumed by Task 2.

- [ ] **Step 1: Extend schema to require loop controls**

In `docs/plans/product-branches/schema.json`, add `"Loop Control Inputs"` after `"Quest Queue"` in `required_sections`, and add this object after the `Proof Foldback` control table:

```json
{
  "section": "Loop Control Inputs",
  "min_rows": 1,
  "required_columns": [
    "loop_id",
    "title",
    "cadence",
    "objective",
    "metric",
    "boundary_color",
    "one_change_rule",
    "state_file",
    "stop_rule",
    "model_route",
    "proof_required"
  ]
}
```

- [ ] **Step 2: Run validator to verify the new schema fails against old packets**

Run: `npm run validate:product-branches`

Expected: FAIL with packet errors that mention `Loop Control Inputs` missing from the existing packet files.

- [ ] **Step 3: Add Fitcheck loop controls**

Insert this section in `docs/plans/product-branches/fitcheck.md` immediately after `## Quest Queue` and its paragraph block, before `## Branch Story Controls`:

```markdown
## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fitcheck-launch-gate-loop | Fitcheck launch gate loop | manual weekly until first merchant proof begins | Move one Fitcheck launch blocker from blocked to evidenced or return a founder approval request. | One gate changes status or one approval request is recorded per round. | yellow | Select exactly one of Shopify QA, Dodo reservation env, privacy copy, outreach approval, or first merchant proof. | .operator/branch-loops/fitcheck-launch-gate-loop.md | Stop after 3 rounds, after first merchant proof is archived, or when missing credentials prevent the selected gate twice. | cheap-first; escalate only when validator or proof command fails | Updated Evidence Ledger row, Gate Ledger row, or founder approval request pasted into the loop state file. |
```

- [ ] **Step 4: Add Vantyx loop controls**

Insert this section in `docs/plans/product-branches/vantyx.md` immediately after `## Quest Queue` and its paragraph block, before `## Branch Story Controls`:

```markdown
## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| vantyx-second-tenant-loop | Vantyx second-tenant proof loop | manual weekly until second tenant proof closes | Advance one second-tenant onboarding, publish, rollback, or analytics proof gate without touching unrelated tenant config. | One route health, rollback, or analytics proof row is added per round. | yellow | Select exactly one tenant proof action and keep Cloudflare route/domain changes approval-gated. | .operator/branch-loops/vantyx-second-tenant-loop.md | Stop after 3 rounds, after rollback proof is verified, or when no approved second tenant candidate exists. | cheap-first; escalate for deploy log interpretation only | `new-client` receipt, `/api/config` health receipt, rollback receipt, or blocked approval note. |
```

- [ ] **Step 5: Add Snow Gloves OS loop controls**

Insert this section in `docs/plans/product-branches/snow-gloves-os.md` immediately after `## Quest Queue` and its paragraph block, before `## Branch Story Controls`:

```markdown
## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| snow-gloves-os-approval-loop | Snow Gloves OS approval-gate loop | manual weekly until Will-organ approval proof exists | Prove one clean service, approval-gate, or Paperclip foldback condition for the Will-organ service packet. | One clean smoke receipt, approval audit receipt, or foldback receipt is captured per round. | red | Select exactly one proof action and never execute high-risk tenant operations without explicit approval. | .operator/branch-loops/snow-gloves-os-approval-loop.md | Stop after 2 blocked approval checks, after a live approval-gate proof is archived, or before any connector activation request. | cheap-first; escalate for approval-policy reasoning only | Redacted smoke/test receipt, approval decision, queued task receipt, or foldback report path. |
```

- [ ] **Step 6: Add IVerif loop controls**

Insert this section in `docs/plans/product-branches/iverif.md` immediately after `## Quest Queue` and its paragraph block, before `## Branch Story Controls`:

```markdown
## Loop Control Inputs

| loop_id | title | cadence | objective | metric | boundary_color | one_change_rule | state_file | stop_rule | model_route | proof_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iverif-claim-proof-loop | IVerif claim/proof separation loop | manual weekly while packet remains proof-only | Move one public, compliance, privacy, performance, or build claim into verified, blocked, pending, or no-signal status. | One claim row receives a sourced status or one unsupported claim is removed from the candidate copy. | green | Select exactly one claim or route-proof check; do not draft outreach or compliance claims. | .operator/branch-loops/iverif-claim-proof-loop.md | Stop after 4 claim rows, after wiki build proof passes, or when source material is missing for the selected claim. | cheap-first; escalate only for conflicting evidence review | Source-linked claim row, build/route receipt, or blocked-control note in the state file. |
```

- [ ] **Step 7: Create the loop library index**

Create `docs/plans/product-branches/loop-library.md` with this exact content:

```markdown
# Cambium Branch Loop Library

This library adapts the loop principle to Cambium product branches. A branch loop is not a scheduler by itself. It is a proof-bound routine contract stored in the product packet and run manually until a founder approves scheduling.

## Boundary Colors

| color | autonomy | allowed action |
| --- | --- | --- |
| green | safe alone | Read packet/repo/runtime state and write `.operator/branch-loops/*` state files. |
| yellow | approval required | Draft one action, PR, assignment, or approval request; a human ships it. |
| red | never alone | Stop before money, production, outbound, credentials, spend, customer-visible claims, or high-risk tenant operations. |

## Required Loop Shape

Every loop has one objective, one metric, one boundary color, one state file, one stop rule, and one proof requirement.

Every round changes exactly one thing or records exactly one blocked approval request.

## Initial Library

| product | loop | boundary | state file |
| --- | --- | --- | --- |
| Fitcheck | `fitcheck-launch-gate-loop` | yellow | `.operator/branch-loops/fitcheck-launch-gate-loop.md` |
| Vantyx | `vantyx-second-tenant-loop` | yellow | `.operator/branch-loops/vantyx-second-tenant-loop.md` |
| Snow Gloves OS | `snow-gloves-os-approval-loop` | red | `.operator/branch-loops/snow-gloves-os-approval-loop.md` |
| IVerif | `iverif-claim-proof-loop` | green | `.operator/branch-loops/iverif-claim-proof-loop.md` |

## Scheduling Rule

Do not schedule any loop until it has passed one manual run with a readable state file and a reviewer accepts the stop rule.
```

- [ ] **Step 8: Run validator to verify packet shell passes**

Run: `npm run validate:product-branches`

Expected: PASS with `validated 4 product branch packet(s) against cambium.product_branch_packet.v1`.

- [ ] **Step 9: Commit packet loop contract**

```bash
git add docs/plans/product-branches/schema.json docs/plans/product-branches/fitcheck.md docs/plans/product-branches/vantyx.md docs/plans/product-branches/snow-gloves-os.md docs/plans/product-branches/iverif.md docs/plans/product-branches/loop-library.md
git commit -m "docs: add cambium branch loop contracts"
```

## Task 2: Validator Loop Guards

**Files:**
- Modify: `scripts/validate-product-branch-packets.mjs`

**Interfaces:**
- Consumes: `Loop Control Inputs` table from Task 1.
- Produces: fail-closed validation for boundary colors and state-file paths used by Tasks 3 and 4.

- [ ] **Step 1: Add failing invalid boundary fixture check**

Run this command before editing the validator:

```bash
tmp="$(mktemp -d)"
cp -R docs "$tmp/docs"
node - "$tmp/docs/plans/product-branches/fitcheck.md" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');
const file = process.argv[2];
const source = readFileSync(file, 'utf8').replace('| yellow | Select exactly one', '| blue | Select exactly one');
writeFileSync(file, source);
NODE
node scripts/validate-product-branch-packets.mjs --packet-dir "$tmp/docs/plans/product-branches"
```

Expected before implementation: PASS, proving the validator does not yet reject invalid loop colors.

- [ ] **Step 2: Add loop guard helpers**

In `scripts/validate-product-branch-packets.mjs`, add these helpers after `normalizeControlValue`:

```js
const LOOP_BOUNDARY_COLORS = new Set(['green', 'yellow', 'red']);

function validateLoopControlRows({ source, packetFile }) {
  const { rows } = parseSectionTable(source, 'Loop Control Inputs');
  rows.forEach((row, index) => {
    const rowLabel = `${packetFile}: Loop Control Inputs row ${index + 1}`;
    const color = normalizeControlValue(row.boundary_color || '');
    if (!LOOP_BOUNDARY_COLORS.has(color)) {
      throw new Error(`${rowLabel} has invalid boundary_color "${row.boundary_color}"`);
    }
    const stateFile = String(row.state_file || '').trim();
    if (!stateFile.startsWith('.operator/branch-loops/') || stateFile.includes('..') || stateFile.includes('\\')) {
      throw new Error(`${rowLabel} has unsafe state_file "${stateFile}"`);
    }
    const oneChangeRule = String(row.one_change_rule || '').toLowerCase();
    if (!oneChangeRule.includes('exactly one')) {
      throw new Error(`${rowLabel} one_change_rule must include "exactly one"`);
    }
    const stopRule = String(row.stop_rule || '').trim();
    if (!/stop/i.test(stopRule)) {
      throw new Error(`${rowLabel} stop_rule must describe when to stop`);
    }
  });
}
```

- [ ] **Step 3: Call loop guard from packet validation**

In `validatePacket`, immediately after `validateControlTables({ source, packetFile, schema });`, add:

```js
  validateLoopControlRows({ source, packetFile });
```

- [ ] **Step 4: Re-run invalid boundary fixture check**

Run the command from Step 1 again.

Expected: FAIL with `invalid boundary_color "blue"`.

- [ ] **Step 5: Add unsafe state-file fixture check**

Run:

```bash
tmp="$(mktemp -d)"
cp -R docs "$tmp/docs"
node - "$tmp/docs/plans/product-branches/fitcheck.md" <<'NODE'
const { readFileSync, writeFileSync } = require('node:fs');
const file = process.argv[2];
const source = readFileSync(file, 'utf8').replace('.operator/branch-loops/fitcheck-launch-gate-loop.md', '../fitcheck-loop.md');
writeFileSync(file, source);
NODE
node scripts/validate-product-branch-packets.mjs --packet-dir "$tmp/docs/plans/product-branches"
```

Expected: FAIL with `unsafe state_file "../fitcheck-loop.md"`.

- [ ] **Step 6: Run normal validator**

Run: `npm run validate:product-branches`

Expected: PASS with `validated 4 product branch packet(s) against cambium.product_branch_packet.v1`.

- [ ] **Step 7: Commit validator guards**

```bash
git add scripts/validate-product-branch-packets.mjs
git commit -m "test: guard branch loop packet controls"
```

## Task 3: Branch Story Loop Parser

**Files:**
- Modify: `bin/operator/quests/branch-stories.ts`
- Modify: `bin/quine/hyphae/branch-stories.ts`
- Modify: `bin/quine/hyphae/branch-stories.test.ts`

**Interfaces:**
- Consumes: validated `Loop Control Inputs` table.
- Produces: `BranchLoop[]` available as `story.loops` and `story.controls.loops`.

- [ ] **Step 1: Write failing parser test**

Append this test to `bin/quine/hyphae/branch-stories.test.ts`:

```ts
test('loads branch loop controls from product packets', () => {
  const stories = loadBranchStories({ root: process.cwd() }, 'cambium');
  const fitcheck = stories.find((story) => story.productId === 'fitcheck');

  assert.ok(fitcheck);
  assert.ok(fitcheck.loops);
  assert.equal(fitcheck.loops[0].loopId, 'fitcheck-launch-gate-loop');
  assert.equal(fitcheck.loops[0].boundaryColor, 'yellow');
  assert.match(fitcheck.loops[0].oneChangeRule, /exactly one/i);
  assert.equal(fitcheck.loops[0].stateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
  assert.match(fitcheck.loops[0].stopRule, /Stop after 3 rounds/i);
  assert.deepEqual(fitcheck.controls.loops, fitcheck.loops);
});
```

- [ ] **Step 2: Run parser test to verify it fails**

Run: `node --test bin/quine/hyphae/branch-stories.test.ts`

Expected: FAIL with `fitcheck.loops` missing or undefined.

- [ ] **Step 3: Add branch loop types**

In `bin/operator/quests/branch-stories.ts`, add this type after `BranchProofStatus`:

```ts
export type BranchLoopBoundaryColor = 'green' | 'yellow' | 'red';
```

Add this interface after `BranchMission`:

```ts
export interface BranchLoop {
  loopId: string;
  title: string;
  cadence: string;
  objective: string;
  metric: string;
  boundaryColor: BranchLoopBoundaryColor;
  oneChangeRule: string;
  stateFile: string;
  stopRule: string;
  modelRoute: string;
  proofRequired: string;
}
```

Add `loops: BranchLoop[];` inside `BranchControlBundle` after `dispatchHints: BranchDispatchHint[];`.

Add `loops: BranchLoop[];` inside `BranchStoryArc` after `missions: BranchMission[];`.

- [ ] **Step 4: Parse loop rows**

In `bin/quine/hyphae/branch-stories.ts`, add `BranchLoop` and `BranchLoopBoundaryColor` to the type import list.

Add these helpers after `normalizePromotionState`:

```ts
function normalizeLoopBoundaryColor(value: string): BranchLoopBoundaryColor {
  const color = clean(value).toLowerCase();
  if (color === 'green' || color === 'yellow' || color === 'red') return color;
  return 'red';
}

function loopControlGaps(loops: BranchLoop[]): BranchStoryGap[] {
  return loops.flatMap((loop) => {
    const gaps: BranchStoryGap[] = [];
    if (!loop.oneChangeRule.toLowerCase().includes('exactly one')) {
      gaps.push({
        id: `${slugify(loop.loopId)}-one-change-rule`,
        status: 'blocked',
        detail: `${loop.loopId} must select exactly one change per round`,
        source: 'loop-control-inputs',
      });
    }
    if (!loop.stateFile.startsWith('.operator/branch-loops/') || loop.stateFile.includes('..') || loop.stateFile.includes('\\')) {
      gaps.push({
        id: `${slugify(loop.loopId)}-state-file`,
        status: 'blocked',
        detail: `${loop.loopId} has unsafe loop state file ${loop.stateFile}`,
        source: 'loop-control-inputs',
      });
    }
    return gaps;
  });
}
```

Inside `storyFromPacket`, after `const dispatchHints = ...`, add:

```ts
  const loops = sectionRows(source, 'Loop Control Inputs').map((loop): BranchLoop => ({
    loopId: clean(loop.loop_id),
    title: clean(loop.title),
    cadence: clean(loop.cadence),
    objective: clean(loop.objective),
    metric: clean(loop.metric),
    boundaryColor: normalizeLoopBoundaryColor(loop.boundary_color),
    oneChangeRule: clean(loop.one_change_rule),
    stateFile: clean(loop.state_file),
    stopRule: clean(loop.stop_rule),
    modelRoute: clean(loop.model_route),
    proofRequired: clean(loop.proof_required),
  })).filter((loop) => loop.loopId);
```

In the returned story object, add `loops,` immediately after `missions,`.

Inside `controls`, add `loops,` immediately after `dispatchHints,`.

Inside `gaps`, add:

```ts
      ...loopControlGaps(loops),
```

- [ ] **Step 5: Run parser tests**

Run: `node --test bin/quine/hyphae/branch-stories.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit parser loop support**

```bash
git add bin/operator/quests/branch-stories.ts bin/quine/hyphae/branch-stories.ts bin/quine/hyphae/branch-stories.test.ts
git commit -m "feat: parse branch loop controls"
```

## Task 4: Loop Library Derivation

**Files:**
- Create: `bin/operator/quests/branch-loop-library.ts`
- Create: `bin/operator/quests/branch-loop-library.test.ts`

**Interfaces:**
- Consumes: `BranchStoryArc[]` with `loops`.
- Produces: `deriveBranchLoopLibrary(stories: BranchStoryArc[]): BranchLoopLibrary`.

- [ ] **Step 1: Write failing derivation test**

Create `bin/operator/quests/branch-loop-library.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveBranchLoopLibrary, loopCanRunUnattended } from './branch-loop-library.ts';
import type { BranchStoryArc } from './branch-stories.ts';

const stories = [{
  branchId: 'fitcheck',
  productId: 'fitcheck',
  name: 'Fitcheck',
  role: 'Supervised product branch',
  arcId: 'fitcheck-supervised-launch-hardening',
  arcTitle: 'Supervised Launch Hardening',
  vision: { statement: 'Launch proof.' },
  icp: { primary: 'Shopify founder.' },
  kpis: [],
  questline: [],
  missions: [],
  loops: [{
    loopId: 'fitcheck-launch-gate-loop',
    title: 'Fitcheck launch gate loop',
    cadence: 'manual weekly',
    objective: 'Move one launch blocker.',
    metric: 'One gate changes status.',
    boundaryColor: 'yellow',
    oneChangeRule: 'Select exactly one launch gate.',
    stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
    stopRule: 'Stop after 3 rounds.',
    modelRoute: 'cheap-first',
    proofRequired: 'Updated gate row.',
  }, {
    loopId: 'fitcheck-public-send-loop',
    title: 'Fitcheck public send loop',
    cadence: 'manual only',
    objective: 'Prepare outbound copy.',
    metric: 'One approval request.',
    boundaryColor: 'red',
    oneChangeRule: 'Select exactly one outbound decision.',
    stateFile: '.operator/branch-loops/fitcheck-public-send-loop.md',
    stopRule: 'Stop before sending.',
    modelRoute: 'cheap-first',
    proofRequired: 'Approval note.',
  }],
  gates: [],
  proofPaths: [],
  promotion: { state: 'supervised-branch', currentGate: 'Launch proof', rule: 'proof first' },
  controls: {
    productSeed: {},
    organRouting: [],
    variableContractPayloads: [],
    adapterServiceMap: [],
    evidenceLedger: [],
    approvals: [],
    autonomyBoundary: 'founder approval required',
    dispatchHints: [],
    loops: [],
    policySignals: [],
    ui: { headline: 'Fitcheck', currentFrontier: 'Launch proof', missionVerb: 'Launch', narrativeVoice: 'operator', blockedCopy: 'proof first' },
  },
  source: { tenant: 'cambium', schema: 'cambium.product_branch_packet.v1', indexFile: 'docs/plans/product-branches/index.md', packetFile: 'docs/plans/product-branches/fitcheck.md' },
  gaps: [],
}] satisfies BranchStoryArc[];

test('deriveBranchLoopLibrary counts boundary colors and run permissions', () => {
  const library = deriveBranchLoopLibrary(stories);

  assert.equal(library.source, 'product-branch-packets@v1');
  assert.equal(library.total, 2);
  assert.equal(library.green, 0);
  assert.equal(library.yellow, 1);
  assert.equal(library.red, 1);
  assert.equal(library.rows[0].runMode, 'approval-required');
  assert.equal(library.rows[1].runMode, 'never-alone');
  assert.equal(library.rows[0].stateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
});

test('loopCanRunUnattended only allows green loops', () => {
  assert.equal(loopCanRunUnattended(stories[0].loops[0]), false);
  assert.equal(loopCanRunUnattended({ ...stories[0].loops[0], boundaryColor: 'green' }), true);
  assert.equal(loopCanRunUnattended(stories[0].loops[1]), false);
});
```

- [ ] **Step 2: Run derivation test to verify it fails**

Run: `node --test bin/operator/quests/branch-loop-library.test.ts`

Expected: FAIL with module not found for `branch-loop-library.ts`.

- [ ] **Step 3: Implement derivation module**

Create `bin/operator/quests/branch-loop-library.ts`:

```ts
import type { BranchLoop, BranchStoryArc } from './branch-stories.ts';

export type BranchLoopRunMode = 'read-only' | 'approval-required' | 'never-alone';

export interface BranchLoopLibraryRow {
  loopId: string;
  branchId: string;
  productId: string;
  productName: string;
  title: string;
  cadence: string;
  objective: string;
  metric: string;
  boundaryColor: BranchLoop['boundaryColor'];
  runMode: BranchLoopRunMode;
  oneChangeRule: string;
  stateFile: string;
  stopRule: string;
  modelRoute: string;
  proofRequired: string;
  promotionState: BranchStoryArc['promotion']['state'];
  currentGate: string;
  packetFile: string;
}

export interface BranchLoopLibrary {
  source: 'product-branch-packets@v1';
  status: 'empty' | 'ready' | 'blocked';
  total: number;
  green: number;
  yellow: number;
  red: number;
  rows: BranchLoopLibraryRow[];
}

export function loopCanRunUnattended(loop: BranchLoop): boolean {
  return loop.boundaryColor === 'green';
}

export function loopRunMode(loop: BranchLoop): BranchLoopRunMode {
  if (loop.boundaryColor === 'green') return 'read-only';
  if (loop.boundaryColor === 'yellow') return 'approval-required';
  return 'never-alone';
}

export function deriveBranchLoopLibrary(stories: BranchStoryArc[]): BranchLoopLibrary {
  const rows = stories.flatMap((story) => story.loops.map((loop) => ({
    loopId: loop.loopId,
    branchId: story.branchId,
    productId: story.productId,
    productName: story.name,
    title: loop.title,
    cadence: loop.cadence,
    objective: loop.objective,
    metric: loop.metric,
    boundaryColor: loop.boundaryColor,
    runMode: loopRunMode(loop),
    oneChangeRule: loop.oneChangeRule,
    stateFile: loop.stateFile,
    stopRule: loop.stopRule,
    modelRoute: loop.modelRoute,
    proofRequired: loop.proofRequired,
    promotionState: story.promotion.state,
    currentGate: story.promotion.currentGate,
    packetFile: story.source.packetFile,
  })));

  return {
    source: 'product-branch-packets@v1',
    status: rows.length === 0 ? 'empty' : rows.some((row) => row.boundaryColor === 'red') ? 'blocked' : 'ready',
    total: rows.length,
    green: rows.filter((row) => row.boundaryColor === 'green').length,
    yellow: rows.filter((row) => row.boundaryColor === 'yellow').length,
    red: rows.filter((row) => row.boundaryColor === 'red').length,
    rows,
  };
}
```

- [ ] **Step 4: Run derivation tests**

Run: `node --test bin/operator/quests/branch-loop-library.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit derivation module**

```bash
git add bin/operator/quests/branch-loop-library.ts bin/operator/quests/branch-loop-library.test.ts
git commit -m "feat: derive branch loop library"
```

## Task 5: Visual Envelope Loop Summary

**Files:**
- Modify: `bin/quine/hyphae/quests.ts`
- Modify: `bin/quine/hyphae/quests.test.ts`

**Interfaces:**
- Consumes: `deriveBranchLoopLibrary(stories)`.
- Produces: `visual.branchLoops` for Mission Control and handler tests.

- [ ] **Step 1: Write failing visual envelope test**

Append this test to `bin/quine/hyphae/quests.test.ts`:

```ts
test('quests visual envelope exposes branch loop library without changing quest ledger completion', () => {
  const inputs = gatherQuestInputs({ root: process.cwd(), vaultRoot: join(process.cwd(), 'vault') }, 'cambium');
  const ledgerWithoutBranches = questLedger({});
  const ledgerWithBranches = questLedger({ branchStories: inputs.branchStories });
  const visual = buildVisualEnvelope(
    { root: process.cwd(), vaultRoot: join(process.cwd(), 'vault') },
    'cambium',
    { branchStories: inputs.branchStories },
    ledgerWithBranches,
    { source: 'test', derivedAt: '2026-07-05T00:00:00.000Z' },
  );

  assert.equal(ledgerWithBranches.completed, ledgerWithoutBranches.completed);
  assert.equal(visual.branchLoops.source, 'product-branch-packets@v1');
  assert.equal(visual.branchLoops.total, 4);
  assert.equal(visual.branchLoops.green, 1);
  assert.equal(visual.branchLoops.yellow, 2);
  assert.equal(visual.branchLoops.red, 1);
  assert.ok(visual.branchLoops.rows.some((row) => row.loopId === 'iverif-claim-proof-loop' && row.runMode === 'read-only'));
  assert.ok(visual.branchLoops.rows.some((row) => row.loopId === 'snow-gloves-os-approval-loop' && row.runMode === 'never-alone'));
});
```

- [ ] **Step 2: Run visual test to verify it fails**

Run: `node --test bin/quine/hyphae/quests.test.ts`

Expected: FAIL with `visual.branchLoops` missing.

- [ ] **Step 3: Import loop derivation**

At the top of `bin/quine/hyphae/quests.ts`, add:

```ts
import { deriveBranchLoopLibrary } from '../../operator/quests/branch-loop-library.ts';
import type { BranchLoopLibrary } from '../../operator/quests/branch-loop-library.ts';
```

In the `VisualEnvelope` interface block, add:

```ts
  branchLoops: BranchLoopLibrary;
```

Inside `buildVisualEnvelope`, after `const branchStories = deriveBranchStoriesEnvelope(inputs.branchStories);`, add:

```ts
  const branchLoops = deriveBranchLoopLibrary(inputs.branchStories ?? []);
```

In the returned visual envelope object, add:

```ts
    branchLoops,
```

- [ ] **Step 4: Run focused visual tests**

Run: `node --test bin/quine/hyphae/quests.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit visual envelope loop summary**

```bash
git add bin/quine/hyphae/quests.ts bin/quine/hyphae/quests.test.ts
git commit -m "feat: expose branch loops in visual envelope"
```

## Task 6: Manual Loop Checker

**Files:**
- Create: `scripts/branch-loop-library.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `loadBranchStories` and `deriveBranchLoopLibrary`.
- Produces: `.operator/branch-loops/index.json` and stdout summary.

- [ ] **Step 1: Write the manual checker script**

Create `scripts/branch-loop-library.mjs`:

```js
#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadBranchStories } from '../bin/quine/hyphae/branch-stories.ts';
import { deriveBranchLoopLibrary } from '../bin/operator/quests/branch-loop-library.ts';

const root = resolve(process.cwd());
const tenant = process.argv.includes('--tenant')
  ? process.argv[process.argv.indexOf('--tenant') + 1] || 'cambium'
  : 'cambium';
const write = process.argv.includes('--write');

const stories = loadBranchStories({ root }, tenant);
const library = deriveBranchLoopLibrary(stories);

const payload = {
  schema: 'cambium.branch_loop_library.v1',
  tenant,
  generatedAt: new Date().toISOString(),
  ...library,
};

console.log(`branch loops: total=${library.total} green=${library.green} yellow=${library.yellow} red=${library.red}`);
for (const row of library.rows) {
  console.log(`${row.boundaryColor} ${row.loopId} -> ${row.runMode} -> ${row.stateFile}`);
}

if (write) {
  const outDir = join(root, '.operator', 'branch-loops');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(payload, null, 2) + '\n');
  console.log(`wrote ${join('.operator', 'branch-loops', 'index.json')}`);
}
```

- [ ] **Step 2: Add package script**

In `package.json`, add this script after `validate:product-branches`:

```json
    "branch-loops:check": "node scripts/branch-loop-library.mjs --tenant cambium --write",
```

- [ ] **Step 3: Run manual checker**

Run: `npm run branch-loops:check`

Expected output includes:

```text
branch loops: total=4 green=1 yellow=2 red=1
green iverif-claim-proof-loop -> read-only -> .operator/branch-loops/iverif-claim-proof-loop.md
wrote .operator/branch-loops/index.json
```

- [ ] **Step 4: Verify generated runtime state is ignored**

Run:

```bash
git status --short .operator/branch-loops/index.json
```

Expected: no output, because `.operator/` is ignored.

- [ ] **Step 5: Commit manual checker**

```bash
git add package.json scripts/branch-loop-library.mjs
git commit -m "feat: add manual branch loop checker"
```

## Task 7: Mini App Loop Visibility

**Files:**
- Modify: `workers/quests/src/mini-app-surface-contract.ts`
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: `visual.branchLoops` and `branch.controls.loops`.
- Produces: founder-visible loop status without implying autonomous scheduling.

- [ ] **Step 1: Write failing page test**

Append this test near the existing branchStories Mission Control tests in `workers/quests/src/handler.test.ts`:

```ts
test('page · Mission Control renders branch loop controls as manual-first', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchLoops: {
      source: 'product-branch-packets@v1',
      status: 'blocked',
      total: 1,
      green: 0,
      yellow: 1,
      red: 0,
      rows: [{
        loopId: 'fitcheck-launch-gate-loop',
        branchId: 'fitcheck',
        productId: 'fitcheck',
        productName: 'Fitcheck',
        title: 'Fitcheck launch gate loop',
        cadence: 'manual weekly',
        objective: 'Move one launch blocker.',
        metric: 'One gate changes status.',
        boundaryColor: 'yellow',
        runMode: 'approval-required',
        oneChangeRule: 'Select exactly one launch gate.',
        stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
        stopRule: 'Stop after 3 rounds.',
        modelRoute: 'cheap-first',
        proofRequired: 'Updated gate row.',
        promotionState: 'supervised-branch',
        currentGate: 'Launch proof',
        packetFile: 'docs/plans/product-branches/fitcheck.md',
      }],
    },
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        loops: [{ loopId: 'fitcheck-launch-gate-loop', title: 'Fitcheck launch gate loop', cadence: 'manual weekly', objective: 'Move one launch blocker.', metric: 'One gate changes status.', boundaryColor: 'yellow', oneChangeRule: 'Select exactly one launch gate.', stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md', stopRule: 'Stop after 3 rounds.', modelRoute: 'cheap-first', proofRequired: 'Updated gate row.' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: { loops: [], approvals: [], dispatchHints: [], organRouting: [], ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' } },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /Fitcheck launch gate loop/);
  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /approval-required/);
  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /manual weekly/);
  assert.doesNotMatch(rendered.elements.get('mapwrap')!.innerHTML, /autonomous loop scheduled/i);
});
```

- [ ] **Step 2: Run page test to verify it fails**

Run: `node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"`

Expected: FAIL because Mission Control does not render loop controls yet.

- [ ] **Step 3: Add surface contract target**

In `workers/quests/src/mini-app-surface-contract.ts`, add `'branch-loops'` to the target list and add this row near the other branch targets:

```ts
  { id: 'branch-loops', target: 'product-branches', interactions: { primary: 'sheet' }, source: 'BranchLoopLibrary manual-first loop controls' },
```

- [ ] **Step 4: Add loop view helpers**

In `workers/quests/src/page.ts`, add these helpers after `mcControls`:

```js
function branchLoopEnvelope(env){
  return env && env.branchLoops ? env.branchLoops : { rows: [] };
}
function branchLoopRows(env, branchId){
  const rows = Array.isArray(branchLoopEnvelope(env).rows) ? branchLoopEnvelope(env).rows : [];
  return rows.filter(row => String(row.branchId || row.productId || '') === String(branchId || ''));
}
function mcLoopState(row){
  if (!row) return 'blocked';
  if (row.boundaryColor === 'green') return 'active';
  if (row.boundaryColor === 'yellow') return 'proof-needed';
  return 'blocked';
}
```

In `buildMissionControlView`, add `loops: branchLoopRows(env || {}, branch ? mcBranchId(branch, selectedIndex) : ''),` after `kpis:mcKpis(branch),`.

Add this renderer after `renderMissionToolLink`:

```js
function renderMissionLoops(view){
  const rows = view.loops && view.loops.length ? view.loops.slice(0, 3) : [];
  if (!rows.length) return '';
  return '<section class="mission-tool-link" data-component="BranchLoopControls" data-ecosystem-target="branch-loops">' +
    '<span><b>Loop controls</b><small>' + esc(rows.map(row => row.loopId + ' · ' + row.runMode).join(' / ')) + '</small></span>' +
    '<button type="button" class="secondary" data-mission-action="loops" data-no-scene-drag="1">' + esc(rows[0].boundaryColor + ' · ' + rows[0].cadence) + '</button>' +
  '</section>';
}
```

In `renderMissionControl`, insert `renderMissionLoops(view),` between `renderMissionToolLink(view),` and `renderMissionActions(view),`.

- [ ] **Step 5: Wire loop button to branch sheet**

In `renderMissionControl`, add this handler after the tools handler:

```js
  stem.querySelectorAll('[data-mission-action="loops"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'loops'));
```

In `branchMissionFocusLabel`, add:

```js
  if (focus === 'loops') return 'branch loops';
```

In `branchMissionFocusNarrative`, add this case before the final return:

```js
  if (focus === 'loops') {
    const loops = mcList(branch && branch.loops);
    return loops.length ? loops.map(loop => (loop.title || loop.loopId) + ' · ' + (loop.boundaryColor || 'yellow') + ' · ' + (loop.stopRule || 'stop rule missing')).join(' / ') : 'loop controls missing';
  }
```

- [ ] **Step 6: Run page test**

Run: `node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop controls"`

Expected: PASS.

- [ ] **Step 7: Commit mini app visibility**

```bash
git add workers/quests/src/mini-app-surface-contract.ts workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "feat: show branch loop controls in mission control"
```

## Task 8: Bridge Assignment Loop Metadata

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Interfaces:**
- Consumes: optional loop metadata from assignment request body or `branchMission`.
- Produces: assignment directive task fields for downstream member clients.

- [ ] **Step 1: Write failing bridge assignment test**

In the existing assignment test that asserts branch mission metadata, add these fields to the `assignment` object:

```ts
      loopId: 'fitcheck-launch-gate-loop',
      loopBoundaryColor: 'yellow',
      loopStateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
      loopStopRule: 'Stop after 3 rounds.',
      loopOneChangeRule: 'Select exactly one launch gate.',
```

Add these assertions after the existing `autonomyBoundary` assertions:

```ts
  assert.equal(directive.payload.task.loopId, 'fitcheck-launch-gate-loop');
  assert.equal(directive.payload.task.loopBoundaryColor, 'yellow');
  assert.equal(directive.payload.task.loopStateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
  assert.equal(directive.payload.task.loopStopRule, 'Stop after 3 rounds.');
  assert.equal(directive.payload.task.loopOneChangeRule, 'Select exactly one launch gate.');
```

- [ ] **Step 2: Run bridge assignment test to verify it fails**

Run: `node --test workers/quests/src/handler.test.ts --test-name-pattern "assign-task"`

Expected: FAIL because loop fields are missing from `directive.payload.task`.

- [ ] **Step 3: Preserve loop metadata in assignment normalization**

In `workers/quests/src/handler.ts`, inside `normalizeAssignmentTask`, add these fields to `branchMissionMeta`:

```ts
    loopId: optionalText(raw.loopId ?? branchMission.loopId, 160),
    loopBoundaryColor: optionalText(raw.loopBoundaryColor ?? branchMission.loopBoundaryColor, 24),
    loopStateFile: optionalText(raw.loopStateFile ?? branchMission.loopStateFile, 240),
    loopStopRule: optionalText(raw.loopStopRule ?? branchMission.loopStopRule, 500),
    loopOneChangeRule: optionalText(raw.loopOneChangeRule ?? branchMission.loopOneChangeRule, 500),
```

In `topicAssignmentPayload`, add the same optional fields inside `task`:

```ts
      ...(optionalText(raw.loopId, 160) ? { loopId: optionalText(raw.loopId, 160) } : {}),
      ...(optionalText(raw.loopBoundaryColor, 24) ? { loopBoundaryColor: optionalText(raw.loopBoundaryColor, 24) } : {}),
      ...(optionalText(raw.loopStateFile, 240) ? { loopStateFile: optionalText(raw.loopStateFile, 240) } : {}),
      ...(optionalText(raw.loopStopRule, 500) ? { loopStopRule: optionalText(raw.loopStopRule, 500) } : {}),
      ...(optionalText(raw.loopOneChangeRule, 500) ? { loopOneChangeRule: optionalText(raw.loopOneChangeRule, 500) } : {}),
```

- [ ] **Step 4: Run bridge assignment tests**

Run: `node --test workers/quests/src/handler.test.ts --test-name-pattern "assign-task"`

Expected: PASS.

- [ ] **Step 5: Commit bridge metadata**

```bash
git add workers/quests/src/handler.ts workers/quests/src/handler.test.ts
git commit -m "feat: preserve branch loop assignment metadata"
```

## Task 9: Full Verification

**Files:**
- Read: `package.json`
- Read: `docs/plans/product-branches/*.md`
- Read: `.gitignore`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: final proof bundle for the implementation branch.

- [ ] **Step 1: Run focused branch packet validator**

Run: `npm run validate:product-branches`

Expected: PASS with `validated 4 product branch packet(s) against cambium.product_branch_packet.v1`.

- [ ] **Step 2: Run focused parser and loop tests**

Run:

```bash
node --test bin/quine/hyphae/branch-stories.test.ts bin/operator/quests/branch-loop-library.test.ts bin/quine/hyphae/quests.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run focused Worker page and bridge tests**

Run:

```bash
node --test workers/quests/src/handler.test.ts --test-name-pattern "branch loop|assign-task|Mission Control"
```

Expected: PASS.

- [ ] **Step 4: Run manual loop checker**

Run: `npm run branch-loops:check`

Expected output includes `branch loops: total=4 green=1 yellow=2 red=1`.

- [ ] **Step 5: Confirm runtime output remains ignored**

Run: `git status --short .operator/branch-loops/index.json`

Expected: no output.

- [ ] **Step 6: Run full Cambium validation**

Run:

```bash
npm test
npm run validate
npm run validate:product-branches
npm run standalone:audit
npm run standalone:smoke
```

Expected: each command exits 0.

- [ ] **Step 7: Run anti-secret scan**

Run:

```bash
rg -n "AUTH_TOKEN|CT0|TELEGRAM_INIT_DATA|BRIDGE_TOKEN|HERMES_ASSIGNMENT_TOKEN|DODO_PAYMENT_LINK|SHOPIFY.*PASSWORD|-----BEGIN|sk-[A-Za-z0-9]" docs/plans/product-branches bin/operator/quests bin/quine/hyphae scripts workers/quests/src
```

Expected: no secret values. Documentation references to token names are acceptable only when they do not include values.

- [ ] **Step 8: Run autonomy overclaim scan**

Run:

```bash
rg -n "autonomous loop scheduled|runs unattended|fully autonomous|autonomy ready|customer proof complete" docs/plans/product-branches workers/quests/src bin
```

Expected: no new unsupported autonomy claim. Existing ladder text is acceptable when it says proof is required before autonomy.

- [ ] **Step 9: Commit verification notes if the repo pattern requires them**

If an evidence doc is expected for this branch, create `docs/evidence/YYYY-MM-DD-cambium-branch-loop-library.md` with command receipts and no secrets, then commit:

```bash
git add docs/evidence/YYYY-MM-DD-cambium-branch-loop-library.md
git commit -m "docs: record branch loop library proof"
```

If no evidence doc is created, record command results in the PR body instead.

## Self-Review

**Spec coverage:** The plan covers the deeper principle from the tweet: schedule/cadence, one change per round, repeated metric, state file, stop rule, color boundary, cheap-first routing, and readable proof. It maps that principle to existing Cambium product-branch packets, branch stories, visual envelope, Mission Control, and bridge assignment metadata.

**Placeholder scan:** No red-flag placeholder wording remains. Steps that change code include exact code blocks or exact insertion content.

**Type consistency:** The plan consistently uses `BranchLoop`, `BranchLoopBoundaryColor`, `BranchLoopLibrary`, `deriveBranchLoopLibrary`, `branchLoops`, `loopId`, `loopBoundaryColor`, `loopStateFile`, `loopStopRule`, and `loopOneChangeRule`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-cambium-branch-loop-library.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
