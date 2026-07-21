# TG Mini App Mission Control UI Upgrade Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the Cambium Telegram mini app into a Mission Control surface that makes branch arcs, missions, blockers, proof, KPIs, and promotion state primary while moving architecture/meta language into Inspect.

**Architecture:** Preserve the existing quest ledger, branch story parser, Worker gate, command, and proof systems. Add a Mission Control presentation layer inside the current five-scene mini app shell, backed by a small `mc-` visual primitive grammar and server/client freshness guards so `branchStories` cannot disappear during refresh. Keep Inspect as the place for provenance, source paths, and proof/audit detail.

**Tech Stack:** TypeScript/Node ESM, Cloudflare Worker-style handler tests with `node:test`, inline Telegram mini app renderer in `workers/quests/src/page.ts`, visual references under `docs/plans/assets/tg-miniapp-mission-control-reference`, viewport proof scripts, JSON asset provenance.

---

## Source References

Use these as the visual and copy contract:

- `docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md`
- `docs/plans/assets/tg-miniapp-mission-control-reference/mission-control-mobile-reference.png`
- `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md`
- `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/01-component-glyph-state-board.png`
- `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/02-mission-control-state-stack-mobile.png`
- `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/03-motion-storyboard-mobile.png`

The older branch-story adapter plan remains the data/packet plan:

- `docs/plans/2026-06-29-branch-story-adapter-miniapp-plan.md`

This plan supersedes that plan only for the TG mini app UI flow.

## Current State

- `branchStories` already exists in `QuestInputs` and `VisualEnvelope`.
- `workers/quests/src/page.ts` already has branch helper functions, but they render inside the old Map/operator surface.
- The live API can still be overwritten by stale or partial pushes because `/internal/ledger/:tenant` currently stores any sanitized envelope unconditionally.
- The current visible UI still says `Quest Log`, `Map`, `Commands`, `scene provenance`, `ecosystem target`, `R3F`, and other architecture-first phrases.
- The saved Mission Control image references are now covered by `docs/assets/provenance.json`; `node --test bin/asset-governance.test.mjs` passes.

## Parallel Execution Model

Use parallel agents only where file ownership is disjoint.

| Lane | Owner | Files | Can run in parallel? |
| --- | --- | --- | --- |
| Freshness and branch retention | Backend/Worker agent | `workers/quests/src/handler.ts`, focused sections of `workers/quests/src/handler.test.ts` | Yes, before page work |
| Visual primitive grammar | UI agent | `workers/quests/src/page.ts`, focused tests | No, `page.ts` lock zone |
| Scene contract and copy | UI agent | `workers/quests/src/page.ts`, `workers/quests/src/mini-app-surface-contract.ts`, focused tests | Sequential with page work |
| Viewport and live proof | Validation agent | `workers/quests/src/live-proof-readiness.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`, proof docs | After UI render shape exists |
| Asset provenance/docs | Documentation agent | `docs/assets/provenance.json`, reference READMEs, plan docs | Yes, already started |

Lock zones:

- Only one agent edits `workers/quests/src/page.ts` at a time.
- Only one agent edits `workers/quests/src/handler.test.ts` at a time.
- Do not touch Hermes or Plexus in this UI slice unless a later plan explicitly expands scope.

## Task 1: Baseline And Saved Reference Gate

**Files:**
- Read: `docs/plans/assets/tg-miniapp-mission-control-reference/README.md`
- Read: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/README.md`
- Read: `docs/assets/provenance.json`
- Test: `bin/asset-governance.test.mjs`

**Step 1: Capture dirty state**

Run:

```bash
git status --short --branch
```

Expected: existing branch-story and viewport proof changes are visible. Do not revert unrelated edits.

**Step 2: Verify visual references are saved**

Run:

```bash
find docs/plans/assets/tg-miniapp-mission-control-reference -maxdepth 4 -type f | sort
```

Expected: source references, the first Mission Control mockup, the three modular images, prompts, READMEs, and `component-map.md` are listed.

**Step 3: Verify asset provenance**

Run:

```bash
node --test bin/asset-governance.test.mjs
```

Expected: PASS, 4 tests. This has already passed once after adding `tg-miniapp-mission-control-reference-pack`.

## Task 2: Add Worker Freshness And Branch Retention Guards

**Files:**
- Modify: `workers/quests/src/handler.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add stale overwrite tests**

Add tests near the existing `/internal/ledger` push tests:

```ts
test('push · stale envelope cannot erase branchStories', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const fresh = JSON.stringify({
    ...JSON.parse(ENVELOPE),
    derivedAt: '2026-06-29T07:15:00.000Z',
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{ branchId: 'fitcheck', name: 'Fitcheck', missions: [] }],
    },
  });
  const stale = JSON.stringify({
    ...JSON.parse(PARTIAL_VISUAL_ENVELOPE),
    derivedAt: '2026-06-29T07:10:00.000Z',
  });

  assert.equal((await handle(req('POST', '/internal/ledger/cambium', { body: fresh, headers: { authorization: 'Bearer t' } }), deps)).status, 200);
  const stalePut = await handle(req('POST', '/internal/ledger/cambium', { body: stale, headers: { authorization: 'Bearer t' } }), deps);
  assert.equal(stalePut.status, 409);

  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.match(get.body, /"branchId":"fitcheck"/);
});
```

Add a second test:

```ts
test('push · branchStories cannot regress to missing rows', async () => {
  // Existing envelope has branchStories.rows.
  // Incoming envelope has newer derivedAt but omits branchStories.
  // Expected: 409 and stored branchStories remain visible.
});
```

**Step 2: Run failing tests**

Run:

```bash
node --test --test-name-pattern 'branchStories|stale envelope' workers/quests/src/handler.test.ts
```

Expected: FAIL before implementation.

**Step 3: Implement monotonic and branch retention guard**

In `workers/quests/src/handler.ts`, before `deps.kv.put(ledgerKey(tenant), body)`:

- Load existing stored body with `await deps.kv.get(ledgerKey(tenant))`.
- Parse existing JSON defensively.
- Compare `derivedAt` timestamps.
- Reject older incoming envelopes with `409`.
- Reject branch-story regression when existing has `branchStories.rows.length > 0` and incoming lacks non-empty `branchStories.rows`.

Suggested helper names:

```ts
function parsedTime(value: unknown): number | null
function hasBranchStoryRows(envelope: unknown): boolean
function wouldRegressBranchStories(existing: unknown, incoming: unknown): boolean
function staleLedgerPush(existing: unknown, incoming: unknown): boolean
```

Return shape:

```ts
return json(409, {
  ok: false,
  tenant,
  error: 'stale ledger push rejected',
  existingDerivedAt,
  incomingDerivedAt: envelope.derivedAt,
});
```

**Step 4: Verify focused tests pass**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 3: Add Client-Side Stale Refresh Defense

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add page refresh regression test**

Add a test using `renderPageFixtureContext` and `fetchSequence`:

```ts
test('page · pull refresh keeps current Mission Control view when a stale envelope arrives', async () => {
  const fresh = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    derivedAt: '2026-06-29T07:15:00.000Z',
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{ branchId: 'fitcheck', name: 'Fitcheck', arcTitle: 'Launch arc', missions: [{ title: 'Launch proof packet', gate: 'Founder review', proofRequired: 'Viewport capture' }], gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }], kpis: [], proofPaths: [], gaps: [] }],
    },
  };
  const stale = { ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, derivedAt: '2026-06-29T07:10:00.000Z' };
  const rendered = await renderPageFixtureContext(fresh, { fetchSequence: [fresh, stale] });
  await (rendered.context.refresh as () => Promise<void>)();
  assert.match(rendered.elements.get('stem')!.innerHTML, /Launch proof packet/);
});
```

**Step 2: Implement stale client guard**

Add helpers in `page.ts` near `FRESHNESS_STATE`:

```js
function envelopeTime(env){ ... }
function shouldPaintEnvelope(nextEnv){ ... }
```

In `load()`, before `paint(env)`, skip repaint if:

- `ECOSYSTEM_ENV` exists.
- next `derivedAt` parses older than current `ECOSYSTEM_ENV.derivedAt`.

Update the freshness chip to a stale warning, but keep the current painted Mission UI.

**Step 3: Verify focused page tests**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 4: Update Surface Contract To Mission/Gate/Tools/Story/Inspect

**Files:**
- Modify: `workers/quests/src/mini-app-surface-contract.ts`
- Modify: `workers/quests/src/handler.test.ts`
- Modify: `workers/quests/src/page.ts`

**Step 1: Update contract tests first**

Change expected scene IDs from:

```ts
['quests', 'map', 'story', 'gate', 'commands']
```

to:

```ts
['mission', 'gate', 'tools', 'story', 'inspect']
```

Change section IDs to:

```ts
['mission-control', 'founder-gate', 'operator-toolbelt', 'story-feed', 'inspect']
```

Keep ecosystem targets broad enough to include `product-branches`, `telegram`, `hermes`, `operator-narrative`, and proof/inspection targets.

**Step 2: Run contract tests and confirm failure**

Run:

```bash
node --test --test-name-pattern 'mini app surface contract|five scenes' workers/quests/src/handler.test.ts
```

Expected: FAIL before contract/page updates.

**Step 3: Update surface contract**

In `workers/quests/src/mini-app-surface-contract.ts`:

- Replace `quest-line` with `mission-control`.
- Replace `command-center` with `operator-toolbelt`.
- Replace `operator-map` with `inspect`.
- Keep map subsection IDs as inspect subsections if still used by the Inspect scene.

**Step 4: Update page shell labels and scene aliases**

In `workers/quests/src/page.ts`:

- Header brand: `Mission Control`.
- Subtitle: `tenant <span id="ten">cambium</span> · branch arcs`.
- Nav labels: `Mission`, `Gate`, `Tools`, `Story`, `Inspect`.
- Deep-link aliases:

```js
{
  mission: 0, quests: 0, quest: 0, q: 0,
  gate: 1,
  tools: 2, commands: 2,
  story: 3,
  inspect: 4, map: 4
}
```

- Update `SCENE_META` to the same visible order.
- Update `go()` so it calls `loadGate()` for Gate and `renderCommands()` for Tools using scene metadata, not hard-coded old indices.

**Step 5: Verify focused scene tests**

Run:

```bash
node --test --test-name-pattern 'five scenes|scene deep links|mini app surface contract' workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 5: Add `mc-` Visual Primitive Grammar

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add primitive grammar assertion**

Add a test:

```ts
test('page · Mission Control visual primitives are named and reduced-motion safe', () => {
  for (const marker of [
    'mc-branch-chip',
    'mc-glyph',
    'mc-state-token',
    'mc-orbit',
    'mc-signal-rail',
    'mc-packet-dots',
    'mc-mission-card',
    'mc-proof-list',
    'mc-kpi-pulse',
    'orbitSweep',
    'packetDrift',
    'glyphBreathe',
    'warningAttention',
  ]) assert.ok(PAGE.includes(marker), `PAGE has ${marker}`);
});
```

**Step 2: Add CSS primitives**

In `page.ts` CSS, add `mc-` classes based on `component-map.md`:

- `mc-branch-rail`
- `mc-branch-chip`
- `mc-glyph`
- `mc-state-token`
- `mc-orbit`
- `mc-selected-halo`
- `mc-signal-rail`
- `mc-packet-dots`
- `mc-mission-card`
- `mc-questline`
- `mc-proof-list`
- `mc-kpi-pulse`
- `mc-action-row`
- `mc-inspect-only`

Use existing palette tokens. Keep corners at `8px` or below unless matching the current chip style.

**Step 3: Add JS render helpers**

Add helper functions:

```js
function mcStateKind(raw){ ... }
function mcClass(base, state, extra){ ... }
function mcGlyphSvg(kind, state){ ... }
function mcStateToken(state, label){ ... }
function mcOrbitProgress(opts){ ... }
function mcSignalRail(opts){ ... }
function mcPacketDots(count, state){ ... }
```

Reduced motion rule:

- Animated state must remain visible when `RM` is true.
- Do not rely on color alone; include icon or text.

**Step 4: Verify primitive grammar**

Run:

```bash
node --test --test-name-pattern 'Mission Control visual primitives' workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 6: Build Mission Control View Model

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add view-model test**

Add a test that calls `buildMissionControlView` from the rendered VM context:

```ts
test('page · builds Mission Control view from branchStories without promoting missing proof', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        questline: [
          { id: 'seed', title: 'Seed', status: 'verified' },
          { id: 'packet', title: 'Packet', status: 'pending' },
          { id: 'proof', title: 'Proof', status: 'blocked' },
          { id: 'launch', title: 'Launch', status: 'queued' },
        ],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [{ kpiId: 'waitlist', label: 'Waitlist', survival: 'qualified waitlist', betterThanSurvival: 'paid pilot', currentState: 'not proven' }],
        proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        gaps: [{ id: 'approval', status: 'blocked', detail: 'Founder approval missing', source: 'packet' }],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const view = (rendered.context.buildMissionControlView as (env: unknown) => any)(envelope);
  assert.equal(view.nextMission.title, 'Launch proof packet');
  assert.equal(view.promotion.state, 'supervised-branch');
  assert.ok(view.blockers.some((row: any) => /Founder approval/.test(row.label)));
  assert.notEqual(view.nextMission.state, 'complete');
});
```

**Step 2: Implement `buildMissionControlView(env)`**

Derive:

- `branches` from `branchRows(env)`.
- `selectedBranchId` from `?branch=` if present, else first row.
- `nextMission` from `branchActiveMission`.
- `questline` from `branch.questline`, falling back to mission/gate states.
- `blockers` from branch gaps, non-verified gates, policy blocked state, and live proof blocked state.
- `proofNeeded` from mission/gate/proof path requirements.
- `kpis` from branch KPIs.
- `promotion` from branch promotion, defaulting to `proof-only` when missing.
- `inspect` links for packet/source details.

**Step 3: Verify**

Run:

```bash
node --test --test-name-pattern 'Mission Control view' workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 7: Render The Mission Scene

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add primary render test**

Add:

```ts
test('page · Mission scene renders branch arcs, next mission, blockers, proof, KPIs, and actions', async () => {
  const rendered = await renderPageFixtureContext(/* branch story fixture */, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;
  for (const text of ['Fitcheck', 'Next Mission', 'Launch proof packet', 'Blocked by', 'Proof needed', 'Review Gate', 'Open Proof']) {
    assert.match(html, new RegExp(text));
  }
});
```

**Step 2: Replace `renderQuests` primary output**

Keep the legacy quest line as a fallback or lower-priority Inspect/detail path, but make `sceneQ` render:

- branch chip rail
- dominant Mission card
- questline timeline
- blockers
- proof needed
- KPI pulse
- action row

Suggested helpers:

```js
function renderMissionControl(env){ ... }
function renderBranchArcRail(view){ ... }
function renderMissionCard(view){ ... }
function renderQuestlineTimeline(view){ ... }
function renderMissionBlockers(view){ ... }
function renderMissionProofNeeded(view){ ... }
function renderMissionKpis(view){ ... }
```

**Step 3: Empty state**

When no branch stories exist, render:

- `Mission control is waiting for branch packets.`
- refresh action
- Inspect link
- no fake progress

**Step 4: Verify**

Run:

```bash
node --test --test-name-pattern 'Mission scene|Mission Control view' workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 8: Reframe Inspect From The Old Operator Map

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Update tests**

Rename expectations from `Map` / `Operator Map` to `Inspect` where the visible UI is primary. Keep architecture terms allowed inside Inspect.

**Step 2: Update renderer**

Either rename `renderOperatorMap(env)` to `renderInspect(env)` or keep the function and change its visible output:

- Heading: `Inspect`
- Intro: `Proof, packet, freshness, and system detail.`
- Groups: `freshness`, `policy`, `live proof`, `branch packets`, `gates`, `tools`, `rails`, `evidence`

Remove the primary sentence:

```text
R3F island mechanics, reduced to Telegram-native cards and rails.
```

Architecture terms may remain only inside Inspect sheets or detail rows.

**Step 3: Verify**

Run:

```bash
node --test --test-name-pattern 'Inspect|operator map|visual tapestry layer' workers/quests/src/handler.test.ts
```

Expected: PASS after tests are intentionally updated.

## Task 9: Reword Gate, Tools, And Story Primary Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Gate**

Change primary Gate copy to answer:

- what decision is waiting
- affected branch/mission
- consequence
- proof attached
- reversibility

Move route/idempotency/source details into sheets.

**Step 2: Tools**

Rename Commands to Tools. Group command cards as:

- Act
- Ask
- Report
- Coordinate

Primary cards should say what the command does for the mission. Exact `/ts-*` syntax may remain visible, but raw `paperclipCommandsData` belongs in detail sheets only.

**Step 3: Story**

Favor:

- Mission wins
- New signals
- Lessons
- Drift

Primary cards must not say `quest-ledger fallback`, `served beats`, or `operator narrative`.

**Step 4: Verify**

Run:

```bash
node --test --test-name-pattern 'gate|command|story' workers/quests/src/handler.test.ts
```

Expected: PASS after intentional test updates.

## Task 10: Add Primary Copy Denylist And No-Overclaim Tests

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add denylist helper**

Add near page tests:

```ts
const PRIMARY_MISSION_COPY_DENYLIST = [
  'scene provenance',
  'ecosystem target',
  'R3F',
  'operator map',
  'tapestry audit',
  'contract',
  'schema',
  'envelope',
  'quest-ledger',
  'paperclipCommandsData',
  'no local operator writes',
];
```

**Step 2: Add primary scene tests**

Render Mission, Gate, Tools, and Story primary surfaces and assert no denylist terms appear there. Do not run this denylist against Inspect.

**Step 3: Add no-overclaim assertions**

Use a fixture with:

- `promotion.state: 'proof-only'`
- blocked gate
- missing proof

Assert the primary UI does not include:

- `autonomous ready`
- `production verified`
- `live proof ready`
- `shipped`
- `launched`
- `100% success`

**Step 4: Verify**

Run:

```bash
node --test --test-name-pattern 'copy denylist|overclaim|fake readiness' workers/quests/src/handler.test.ts
```

Expected: PASS.

## Task 11: Update Viewport Proof Capture For Mission/Gate/Tools/Story/Inspect

**Files:**
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `workers/quests/src/live-proof-readiness.test.ts`
- Output after manual proof run: `docs/plans/assets/tg-miniapp-viewport-proof/*.png`
- Output after manual proof run: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`

**Step 1: Update capture step names**

Replace old visible scene names:

- `quests` -> `mission`
- `map` -> `inspect`
- `commands` -> `tools`

Keep backward-compatible query aliases only if needed for old proof assets.

**Step 2: Update expected proof paths**

Use names like:

- `mission-control-mobile.png`
- `tools-mobile.png`
- `story-feed-mobile.png`
- `inspect-tapestry-audit-mobile.png`
- `inspect-live-proof-mobile.png`
- `gate-consequence-mobile.png`
- `sheet-gate-approve-preflight-mobile.png`
- `sheet-tools-command-chat-mobile.png`
- `sheet-inspect-skill-promotion-mobile.png`

**Step 3: Verify tests**

Run:

```bash
node --test workers/quests/src/live-proof-readiness.test.ts
```

Expected: PASS.

**Step 4: Run browser preflight**

Run:

```bash
npm run proof:tg-viewport:diagnose
```

Expected: writes diagnostics. If `summary.cdpReady` is false, report blocked environment and do not claim viewport proof.

**Step 5: Run viewport proof only when browser is ready**

Run:

```bash
npm run proof:tg-viewport
```

Expected: regenerated Mission/Gate/Tools/Story/Inspect screenshots and manifest. If this modifies existing proof PNGs, include them deliberately in the final change summary.

## Task 12: Final Local Verification

**Files:**
- All touched files

**Step 1: Focused mini app tests**

Run:

```bash
node --test 'workers/quests/src/*.test.ts'
```

Expected: PASS.

**Step 2: Branch packet validation**

Run:

```bash
npm run validate:product-branches
```

Expected: validates Fitcheck, Vantyx, Snow Gloves OS, and IVerif packets.

**Step 3: Asset governance**

Run:

```bash
node --test bin/asset-governance.test.mjs
```

Expected: PASS.

**Step 4: Full regression**

Run:

```bash
npm test
```

Expected: PASS. If live/environment-dependent tests are blocked, record exact failing test and reason.

**Step 5: Contract validation**

Run:

```bash
npm run validate
```

Expected: `registry + pipeline valid` with all stages/organs resolving.

## Task 13: Live And Deployment Verification

**Files:**
- Read/write only if deploying: Worker deployment config and proof receipts

**Step 1: Deploy only after local tests pass**

Use the repo's existing Worker deploy flow. Do not deploy from a dirty unrelated worktree without summarizing unrelated changes.

**Step 2: Verify live shell**

Run:

```bash
curl -fsS https://curious.thoughtseed.space/?tenant=cambium\&scene=mission | rg 'Mission Control|Next Mission|Review Gate'
```

Expected: visible Mission Control shell is served.

**Step 3: Verify live API keeps branch stories**

Run:

```bash
curl -fsS https://curious.thoughtseed.space/api/quests/cambium \
  | jq -e '.tenant=="cambium" and (.branchStories.rows | length) >= 4'
```

Expected: PASS after a fresh branch-story push.

**Step 4: Recheck after refresh window**

Wait at least one suspected refresh interval, then run the same API command again.

Expected: `branchStories.rows` is still present. If missing, stop and find the writer that is pushing stale data.

**Step 5: Live readiness boundary**

Run:

```bash
npm run proof:tg-live-readiness
```

Expected: receipt written. Do not claim live-ready unless strict readiness is green.

## Execution Handoff

Recommended execution order:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
11. Task 11
12. Task 12
13. Task 13

Recommended parallelism:

- Task 2 can be handled by a Worker/backend agent.
- Task 5 can be prepared by a UI agent only after Task 4 decides scene names.
- Task 11 can be planned by a validation agent, but should execute only after Task 7 through Task 10.
- Task 12 and Task 13 are integration-owner tasks, not parallel write tasks.

Completion criteria:

- Mission Control is first screen.
- Gate is second screen.
- Tools is the operator toolbelt.
- Story is branch-progress narrative, not ledger fallback copy.
- Inspect holds architecture/provenance details.
- `branchStories` persists across stale/partial refresh attempts.
- Primary UI has no meta/self-description language.
- Visual primitives match the saved reference packet.
- Local focused tests and asset governance pass.
- Viewport proof is regenerated or explicitly reported blocked by browser environment.
