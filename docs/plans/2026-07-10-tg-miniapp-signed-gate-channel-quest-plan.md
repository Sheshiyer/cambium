# TG Mini App Signed Gate Channel Quest Implementation Plan

> Lifecycle: historical; non-operational. Do not execute this plan as a runbook. Current state transitions live in `docs/runbooks/telegram-action-request-lifecycle.md`.

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make channel-originated Telegram ActionRequests read clearly inside the Cambium TG Mini App Gate, require a signed founder confirmation before queueing, and return an honest queued/receipt state without treating Telegram channels as execution authority.

**Architecture:** Keep the existing single Worker-rendered Mini App in `workers/quests/src/page.ts`, with `Mission / Gate / Tools / Story / Inspect` intact. Gate remains the only primary signed decision surface; Telegram topics/channels remain signal and receipt lanes. The work is split into a UI lock-zone lane, a contract/docs lane, a live-proof lane, and a bridge-metadata inventory lane so independent work can proceed in parallel without multiple agents editing `page.ts`.

**Tech Stack:** TypeScript/Node ESM, Cloudflare Worker static Mini App renderer, `node:test`, Playwright-backed viewport proof via `npm run proof:tg-viewport`, live readiness proof via `npm run proof:tg-live-readiness`, GitHub issue tracking via `gh`.

---

## Implementation Status - 2026-07-10

Completed in worktree `codex/tg-signed-gate-channel-quest`:

- Task 1 baseline: focused Gate handler tests, live-proof readiness tests, and product branch validation passed before edits.
- Task 2 contract/docs lane: Mini App Gate ActionRequest display contract, Telegram topic boundary, adapter boundary, and live proof runbook marker guidance were updated.
- Task 4/5/6 UI lane: Gate card now shows redacted Telegram route and receipt expectation, moves orbit progress out of the hero decision card, carries route/receipt into detail and preflight sheets, and adds a post-queue `Refresh receipt` control.
- Task 7 viewport proof: refreshed the Gate fixture around `ar_iverif_w6_live_mrcwmcs3`, `clients:804`, and Telegram message `1068`; regenerated the mobile Gate, preflight sheet, and manifest artifacts.
- Task 8 live-proof lane: signed smoke capture/validation now accepts `confirm-action-request`, stores a redacted `visibleMarkerBinding`, and refuses generic refresh markers.
- Task 9 IVerif boundary: added a regression that keeps the Gate copy proof-only and prevents the Mini App from implying outreach/client-facing send completion before signed confirmation and operator consume.
- Task 10 GitHub tracking: created `https://github.com/Sheshiyer/cambium/issues/226` for signed Gate UX on channel-origin ActionRequests.
- Task 11 full verification: focused Gate tests, live-proof readiness tests, product-branch validation, repo validation, viewport proof, non-strict live-readiness, full `npm test`, and `git diff --check` passed.
- Task 12 PR handoff: opened `https://github.com/Sheshiyer/cambium/pull/227` from `codex/tg-signed-gate-channel-quest`.
- Follow-up confirm UX: the preflight `Confirm signed` tap now keeps the sheet open, shows `Queueing...`, disables the tapped button, posts to `/api/gate/cambium`, and falls through to queued/refused sheets instead of looking inert while the Worker responds.

Still not completed in this pass:

- Deployment handoff remains pending after merge/deploy.
- Bridge metadata inventory found a sibling Hermes/Cambium mismatch for the `dev` topic id and missing downstream preservation of topic/message receipt metadata; that is a follow-up outside this Mini App UI lock zone.

## Source Anchors

- Runtime Mini App: `workers/quests/src/page.ts`
- Gate tests: `workers/quests/src/handler.test.ts`
- Viewport proof: `workers/quests/src/visual-viewport-proof.mjs`
- Live proof readiness: `workers/quests/src/live-proof-readiness.mjs`
- Live proof tests: `workers/quests/src/live-proof-readiness.test.ts`
- Mini App contract: `docs/architecture/contracts/tg-miniapp-ecosystem-contract.md`
- Telegram topic routing contract: `docs/architecture/contracts/hermes-topic-routing-to-quests.md`
- Branch mission Fabric contract: `docs/architecture/contracts/branch-mission-fabric-contract.md`
- IVerif packet: `docs/plans/product-branches/iverif.md`
- Live proof runbook: `docs/plans/2026-06-30-tg-miniapp-live-proof-unblock-runbook.md`

## Current Problem

The Mini App has the right building blocks but the Gate decision moment is visually and conceptually muddy:

- The Gate hero currently gives dashboard progress too much room, so the active founder decision is not the first-viewport center of gravity.
- The active item can overlap chips and title text on small Telegram WebView widths.
- The proof block is too dense and low-contrast for a founder deciding whether to sign.
- The details state becomes an audit table and loses the primary action.
- The channel/topic route, Telegram message id, ActionRequest id, and queued receipt expectation are not prominent enough.
- Pull-to-refresh exists, but the Gate scene does not present an obvious post-queue "refresh receipt" control.

The product boundary is important: Telegram groups/channels can trigger topic signals and receive receipts, but they cannot substitute for Mini App signed founder authority.

## Non-Goals

- Do not redesign all five Mini App scenes.
- Do not revive the old Map surface.
- Do not change Paperclip or operator state directly from UI code.
- Do not claim live Telegram proof from local viewport screenshots.
- Do not promote IVerif from `proof-only`.
- Do not edit Hermes or Plexus in the UI task unless the contract inventory task finds a real missing metadata field and that follow-up is explicitly approved.
- Do not dispatch multiple write agents against `workers/quests/src/page.ts` or `workers/quests/src/handler.test.ts`.

## Dispatching Parallel Agents

Use `@dispatching-parallel-agents` only after Task 1 records baseline state. The safe split is:

| Lane | Scope | Can run in parallel? | Lock zones | Output |
| --- | --- | --- | --- | --- |
| A - Gate UI | `workers/quests/src/page.ts`, focused parts of `workers/quests/src/handler.test.ts`, viewport proof | No, single owner only | `page.ts`, `handler.test.ts` | Gate card, preflight, result, refresh UX |
| B - Contract/docs | `docs/architecture/contracts/*.md`, live proof runbook, this plan follow-up notes | Yes, after field names are frozen | Shared contract docs only | Doc updates and `rg` proof |
| C - Live proof readiness | `workers/quests/src/live-proof-readiness.test.ts`, optional `live-proof-readiness.mjs`, proof artifacts docs | Yes, if it does not edit `page.ts` | Live proof files | Queue-consume-refresh checks stay redacted |
| D - Bridge metadata inventory | Read-only review of Cambium/Hermes/Plexus metadata paths | Yes, read-only only | No writes in first pass | Gap report for branchMission/ActionRequest route fields |

Suggested read-only subagent prompts:

```markdown
Agent B - Contract/docs lane:
Read the TG Mini App ecosystem contract, Hermes topic routing contract, branch mission Fabric contract, Telegram adapter doc, live proof runbook, and IVerif packet. Return the smallest doc changes needed so channel/topic signals are explicitly signal/receipt lanes, while signed founder authority stays in the Mini App Gate. Do not edit files.
```

```markdown
Agent C - Live proof lane:
Read workers/quests/src/live-proof-readiness.test.ts and workers/quests/src/live-proof-readiness.mjs. Return whether signed-action smoke already proves queue, operator consume, and Mini App refresh, and identify any missing visible marker for Telegram card receipt proof. Do not edit files.
```

```markdown
Agent D - Metadata inventory lane:
Read only. In Cambium, inspect branch mission and gate open item shapes. In Hermes/Plexus sibling repos, inspect where topic assignments and project_task_assignment metadata are forwarded or parsed. Return whether ActionRequest id, topic/thread id, message id, branchId, missionId, proofRequired, and receipt status are preserved end-to-end. Do not edit files.
```

Agent A must not start while any other agent is editing `page.ts` or the Gate cluster in `handler.test.ts`.

## Task 1: Dedicated Worktree And Baseline

**Files:**
- Read: `git status`
- Read: `package.json`
- Test: `workers/quests/src/handler.test.ts`
- Test: `workers/quests/src/live-proof-readiness.test.ts`

**Step 1: Create or enter a clean worktree**

Run from the Cambium repo parent:

```bash
git worktree add ../cambium-tg-signed-gate-channel-quest -b codex/tg-signed-gate-channel-quest main
cd ../cambium-tg-signed-gate-channel-quest
```

Expected: new worktree on `codex/tg-signed-gate-channel-quest`.

If a worktree already exists, run:

```bash
cd ../cambium-tg-signed-gate-channel-quest
git status --short --branch
```

Expected: either clean, or only known local plan/docs changes for this task.

**Step 2: Verify package scripts**

Run:

```bash
rg -n '"test"|"validate"|"validate:product-branches"|"proof:tg-viewport"|"proof:tg-live-readiness"' package.json
```

Expected: scripts for `npm test`, `npm run validate`, `npm run validate:product-branches`, `npm run proof:tg-viewport`, and `npm run proof:tg-live-readiness`.

**Step 3: Run focused Gate baseline**

Run:

```bash
node --test --test-name-pattern 'gate|Gate|pull refresh|signed-action' workers/quests/src/handler.test.ts
```

Expected: PASS before changes. If it fails, stop and record the failure before editing.

**Step 4: Run live proof baseline**

Run:

```bash
node --test workers/quests/src/live-proof-readiness.test.ts
```

Expected: PASS before changes.

**Step 5: Run product packet baseline**

Run:

```bash
npm run validate:product-branches
```

Expected: PASS. If it fails due unrelated packet work, record and do not repair in this slice.

**Step 6: Commit**

No commit for baseline-only work.

## Task 2: Freeze The Gate ActionRequest Display Contract

**Files:**
- Modify: `docs/architecture/contracts/tg-miniapp-ecosystem-contract.md`
- Modify: `docs/architecture/contracts/hermes-topic-routing-to-quests.md`
- Modify: `docs/adapters/telegram.md`

**Step 1: Write the contract text**

Add a short `Gate ActionRequest Display Contract` section to `docs/architecture/contracts/tg-miniapp-ecosystem-contract.md`:

```markdown
## Gate ActionRequest Display Contract

An open Gate item that originated from Telegram must display these redacted, founder-safe fields before any signed confirmation:

- `actionRequestId`: stable ActionRequest id or redacted equivalent.
- `branchId` and `missionId`: the product branch and mission the decision belongs to.
- `telegram.topicLabel`: human label such as `Clients`.
- `telegram.threadId`: Telegram topic id, such as `804`, never the private chat id.
- `telegram.messageId`: Telegram message id for the card that should receive a receipt.
- `receiptExpectation`: what changes after queueing, for example `Telegram card edit plus queued receipt`.
- `proofSummary`: bounded evidence summary.
- `approveConsequence`, `rerollConsequence`, `reversibility`, and `idempotencyHint`.

The Mini App may show topic/thread/message ids as routing context, but it must not show raw private chat ids, raw founder ids, raw `initData`, bearer tokens, or queued ids.
```

Add one sentence to `docs/architecture/contracts/hermes-topic-routing-to-quests.md` under Boundaries:

```markdown
- Telegram topic buttons and group/channel callbacks may create or route review signals, but founder-signed approval still requires the Mini App Gate path with valid Telegram WebView `initData`.
```

Add one sentence to `docs/adapters/telegram.md`:

```markdown
Group/channel messages can become evidence or ActionRequests; they do not replace the signed Mini App approval lane.
```

**Step 2: Verify docs mention the boundary**

Run:

```bash
rg -n "Gate ActionRequest Display Contract|receiptExpectation|threadId|messageId|Mini App Gate path|do not replace the signed Mini App" docs/architecture/contracts/tg-miniapp-ecosystem-contract.md docs/architecture/contracts/hermes-topic-routing-to-quests.md docs/adapters/telegram.md
```

Expected: all new phrases are found.

**Step 3: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: PASS.

**Step 4: Commit**

```bash
git add docs/architecture/contracts/tg-miniapp-ecosystem-contract.md docs/architecture/contracts/hermes-topic-routing-to-quests.md docs/adapters/telegram.md
git commit -m "docs(tg-miniapp): freeze signed gate channel contract"
```

## Task 3: Add Failing Tests For Channel-Origin Gate Card UX

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Read: `workers/quests/src/page.ts`

**Step 1: Add a channel-origin fixture to the existing Gate card test**

In `workers/quests/src/handler.test.ts`, update or add a new test near `page · gate item cards show decision mission proof and queue-only fields`.

Use this fixture:

```ts
const channelGateEnvelope = {
  ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  openItems: [{
    id: 'ar_iverif_w6_live_mrcwmcs3',
    title: 'IVerif: decision needed before action',
    branchId: 'iverif',
    missionId: 'iverif-wiki-proof',
    questId: 'iverif-wiki-proof',
    source: 'Telegram · Clients · 804 · msg 1068',
    telegram: {
      topicLabel: 'Clients',
      threadId: 804,
      messageId: '1068',
    },
    owner: 'founder',
    updatedAt: '2026-07-10T08:15:00.000Z',
    evidence: 'AutoGTM by Explee triggered leads, but post-lead enrichment and outreach are not configured.',
    approveConsequence: 'queue founder approval for ar_iverif_w6_live_mrcwmcs3; no Paperclip/org mutation until the operator consumes the queue',
    rerollConsequence: 'queue founder reroll request for ar_iverif_w6_live_mrcwmcs3; no Paperclip/org mutation until the operator consumes the queue',
    reversibility: 'withheld until signed Mini App confirmation; reversible by choosing another option before consume',
    idempotencyHint: 'ar_iverif_w6_live_mrcwmcs3:clients:804:1068',
    receiptExpectation: 'Telegram message 1068 receives a queued receipt after the Worker accepts the signed action.',
    priority: { risk: 'high', dependency: 'signed-confirmation', score: 18 },
  }],
};
```

Add assertions:

```ts
const rendered = await renderPageFixtureContext(channelGateEnvelope, { search: '?tenant=cambium&scene=gate' });
const gate = rendered.elements.get('gate')!.innerHTML;

assert.match(gate, /ar_iverif_w6_live_mrcwmcs3/);
assert.match(gate, /IVerif: decision needed before action/);
assert.match(gate, /Clients · 804 · msg 1068/);
assert.match(gate, /iverif · iverif-wiki-proof/);
assert.match(gate, /Telegram message 1068 receives a queued receipt/);
assert.match(gate, /Confirm signed|Approve safely/);
assert.match(gate, /Details/);
assert.doesNotMatch(gate, /raw chat id|initData|bearer|queued-id|founder id/i);
```

**Step 2: Add a first-viewport hierarchy test**

Add a static `PAGE` assertion:

```ts
test('page · Gate hero does not place orbit progress before the active decision card', () => {
  assert.doesNotMatch(PAGE, /<section class="gate-hero"[\s\S]*<div class="gauge" id="gauge"[\s\S]*<div id="gateHeroDecision"/);
  assert.match(PAGE, /id="gateHeroDecision"[^>]*data-component="GateDecisionHeroCard"/);
});
```

If the implementation chooses to keep the gauge in the hero but after the decision, adjust the first regex so it only rejects the current order that visually dominates the decision.

**Step 3: Run tests to verify failure**

Run:

```bash
node --test --test-name-pattern 'channel-origin|Gate hero|gate item cards' workers/quests/src/handler.test.ts
```

Expected: FAIL because route/receipt display and hero ordering are not implemented yet.

**Step 4: Commit**

Do not commit failing tests alone unless the team intentionally wants red/green commits. Prefer committing with Task 4.

## Task 4: Implement The Gate Card Layout And Route Fields

**Files:**
- Modify: `workers/quests/src/page.ts:446-514`
- Modify: `workers/quests/src/page.ts:636-654`
- Modify: `workers/quests/src/page.ts:1456-1762`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Add small helper functions**

Near `gateSource`, add:

```js
function gateTelegramRoute(it){
  const tg = it && it.telegram ? it.telegram : {};
  const topic = tg.topicLabel || it.topicLabel || it.topic || it.clientName;
  const thread = tg.threadId || it.threadId || it.topicThreadId;
  const message = tg.messageId || it.messageId || it.sourceMessageId;
  if (topic && thread && message) return topic + ' · ' + thread + ' · msg ' + message;
  if (/Telegram · /.test(String(gateSource(it)))) return String(gateSource(it)).replace(/^Telegram · /, '');
  return 'channel route not served';
}
function gateReceiptExpectation(it){
  return (it && it.receiptExpectation) || 'Queued receipt appears after the Worker accepts the signed action and the operator consumes it.';
}
```

**Step 2: Move the gauge out of the decision-first hero**

Change the Gate shell from:

```html
<div class="gauge" id="gauge" data-component="OrbitProgress"></div>
```

inside `.gate-hero` to a compact progress summary after `.gate-state-strip`, or keep the element after `gateHeroDecision` with CSS that makes the active decision dominant.

Preferred minimal structure:

```html
<div id="gateProgressSummary" class="gate-progress-summary" data-component="GateProgressSummary">
  <div class="gauge" id="gauge" data-component="OrbitProgress"></div>
</div>
```

placed after `.gate-state-strip`.

**Step 3: Replace the dense card body with decision-first sections**

In `renderGateItem`, keep existing selectors but add readable sections:

```js
'<div class="gate-route-row" data-component="GateRoutePill">' + esc(gateTelegramRoute(it)) + '</div>' +
'<div class="gate-proof-summary" data-component="GateProofSummary"><b>Proof</b><span>' + esc(evidence) + '</span></div>' +
'<div class="gate-receipt-summary" data-component="GateReceiptSummary"><b>Receipt</b><span>' + esc(gateReceiptExpectation(it)) + '</span></div>' +
```

Keep `data-signed-action-entrypoint="approve"`, `data-signed-action-entrypoint="reroll"`, `data-gate-detail="1"`, and `data-gate-proof="1"` stable for viewport proof.

**Step 4: Adjust CSS for mobile Telegram WebView**

Add CSS near the Gate block:

```css
.gate-hero{grid-template-columns:minmax(0,1fr);gap:10px}
.gate-progress-summary{display:grid;justify-items:end;min-height:0}
.gate-progress-summary .gauge{min-height:0}
.gate-route-row{display:inline-flex;max-width:100%;width:max-content;border:1px solid rgba(224,255,79,.36);border-radius:999px;padding:4px 8px;color:var(--ink);font:10.5px/1.2 var(--mono);overflow-wrap:anywhere}
.gate-proof-summary,.gate-receipt-summary{border:1px solid var(--line);border-radius:8px;padding:8px;background:rgba(1,47,52,.34);font-size:12px;line-height:1.42}
.gate-proof-summary b,.gate-receipt-summary b{display:block;color:var(--ink);font:10px var(--mono);text-transform:uppercase;margin-bottom:3px}
.gate-actions{position:sticky;bottom:calc(var(--sab) + 6px);z-index:2;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,35,39,.88) 26%);padding-top:8px}
```

Do not use viewport-width font scaling. Do not introduce decorative gradient orbs.

**Step 5: Run focused tests**

Run:

```bash
node --test --test-name-pattern 'channel-origin|Gate hero|gate item cards|gate chamber' workers/quests/src/handler.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "fix(tg-miniapp): clarify signed gate decision cards"
```

## Task 5: Make Signed Preflight Read Like A Real Confirmation

**Files:**
- Modify: `workers/quests/src/page.ts:1694-1708`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing test**

In `page · approve and reroll gate preflight sheets do not POST before confirmation`, add expectations:

```ts
assert.match(approveSheet, /Confirm signed/);
assert.match(approveSheet, /Clients · 804 · msg 1068|source<\/b><span>Telegram/);
assert.match(approveSheet, /queued receipt|receipt/i);
assert.doesNotMatch(approveSheet, /raw chat id|founder id|queued-id|bearer|initData=/i);
```

For reroll:

```ts
assert.match(rerollSheet, /Confirm signed/);
assert.match(rerollSheet, /queue founder reroll request/);
```

**Step 2: Run test to verify failure**

Run:

```bash
node --test --test-name-pattern 'approve and reroll gate preflight' workers/quests/src/handler.test.ts
```

Expected: FAIL because current button labels are `Confirm approve` and `Confirm reroll`.

**Step 3: Implement minimal copy/layout change**

In `openGatePreflight`, change the confirm button label to:

```js
'<button type="button" class="approve" data-gate-confirm="' + esc(kind) + '">Confirm signed</button>'
```

Add rows:

```js
['channel route', gateTelegramRoute(item)],
['receipt', gateReceiptExpectation(item)],
```

Keep `action kind`, `subject`, `evidence`, `consequence`, `reversibility`, `source route`, `initData status`, and `idempotency`.

**Step 4: Verify**

Run:

```bash
node --test --test-name-pattern 'approve and reroll gate preflight|gate auth and duplicate' workers/quests/src/handler.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "fix(tg-miniapp): make gate preflight explicitly signed"
```

## Task 6: Add Post-Queue Receipt And Refresh UX

**Files:**
- Modify: `workers/quests/src/page.ts:1645-1667`
- Modify: `workers/quests/src/page.ts:1710-1762`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing result-sheet test**

Extend `page · gate auth and duplicate results open explicit sheets` or add:

```ts
test('page · queued gate result offers receipt refresh without claiming consume', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search: '?tenant=cambium&scene=gate' });

  (rendered.context.openGateResultSheet as (kind: string, subject: string, res: unknown, fallback: unknown, item: unknown) => void)('approve', 'ar_iverif_w6_live_mrcwmcs3', {
    queued: 'queued-id',
    duplicate: false,
    idempotencyKey: 'approve:cambium:ar_iverif_w6_live_mrcwmcs3',
    consequence: 'queue founder approval for ar_iverif_w6_live_mrcwmcs3',
    reversibility: 'queued action can be superseded until consumed',
  }, {
    idempotencyKey: 'approve:cambium:ar_iverif_w6_live_mrcwmcs3',
    consequence: 'fallback',
    reversibility: 'fallback',
  }, {
    telegram: { topicLabel: 'Clients', threadId: 804, messageId: '1068' },
    receiptExpectation: 'Telegram message 1068 receives a queued receipt.',
  });

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Founder Decision Queued/);
  assert.match(sheet, /Telegram message 1068 receives a queued receipt/);
  assert.match(sheet, /operator consumes the queue/);
  assert.match(sheet, /data-gate-result-refresh="1"/);
  assert.doesNotMatch(sheet, /completed|consumed already|live proof ready/i);
});
```

**Step 2: Run test to verify failure**

Run:

```bash
node --test --test-name-pattern 'queued gate result|gate auth and duplicate' workers/quests/src/handler.test.ts
```

Expected: FAIL until the result sheet has a refresh receipt action.

**Step 3: Implement result-sheet refresh action**

In `openGateResultSheet`, add:

```js
['channel route', gateTelegramRoute(item)],
['receipt', gateReceiptExpectation(item)],
['consume state', 'queued; waiting for operator consume and refreshed envelope proof'],
```

Add button:

```html
<button type="button" class="approve" data-gate-result-refresh="1">Refresh receipt</button>
```

Wire it:

```js
const refreshButton = $('sheetBody').querySelector('[data-gate-result-refresh]');
if (refreshButton) refreshButton.onclick = () => refresh();
```

Do not remove the Mission/Inspect navigation buttons.

**Step 4: Make successful `gateAct` keep the result visible**

When `res.queued` is true, do not replace the entire card with only a note if that makes refresh impossible. Either keep the card visible with a queued state or replace it with a queued summary that includes:

- action kind
- subject
- channel route
- receipt expectation
- refresh receipt button

**Step 5: Verify**

Run:

```bash
node --test --test-name-pattern 'queued gate result|signed gate auth failures|pull refresh' workers/quests/src/handler.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "fix(tg-miniapp): show queued gate receipt refresh"
```

## Task 7: Update Viewport Proof For The New Gate Shape

**Files:**
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Generated: `docs/plans/assets/tg-miniapp-viewport-proof/gate-consequence-mobile.png`
- Generated: `docs/plans/assets/tg-miniapp-viewport-proof/sheet-gate-approve-preflight-mobile.png`
- Generated: `docs/plans/assets/tg-miniapp-viewport-proof/sheet-gate-reroll-preflight-mobile.png`
- Generated: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`

**Step 1: Update the gate fixture**

In `workers/quests/src/visual-viewport-proof.mjs`, update the `gateFixture.openItems[0]` item to include:

```js
id: 'ar_iverif_w6_live_mrcwmcs3',
title: 'IVerif: decision needed before action',
branchId: 'iverif',
missionId: 'iverif-wiki-proof',
source: 'Telegram · Clients · 804 · msg 1068',
telegram: { topicLabel: 'Clients', threadId: 804, messageId: '1068' },
receiptExpectation: 'Telegram message 1068 receives a queued receipt after the Worker accepts the signed action.',
```

Keep any existing proof, consequence, reversibility, and idempotency fields.

**Step 2: Strengthen clickability wait expressions**

Keep the existing `data-signed-action-entrypoint` selectors. Add visible route checks to the gate consequence capture:

```js
waitFor: "document.querySelector('[data-signed-action-entrypoint=\"approve\"]') && document.body.textContent.includes('Clients') && document.body.textContent.includes('msg 1068')"
```

**Step 3: Run viewport proof**

Run:

```bash
npm run proof:tg-viewport
```

Expected: PASS and regenerated manifest/screenshots. Inspect the generated `gate-consequence-mobile.png` manually before committing.

**Step 4: Diagnose if browser fails**

Run only if Step 3 fails:

```bash
npm run proof:tg-viewport:diagnose
```

Expected: diagnostic JSON updated with the real browser failure.

**Step 5: Commit**

```bash
git add workers/quests/src/visual-viewport-proof.mjs docs/plans/assets/tg-miniapp-viewport-proof
git commit -m "test(tg-miniapp): refresh signed gate viewport proof"
```

## Task 8: Preserve Live Proof Honesty

**Files:**
- Modify: `workers/quests/src/live-proof-readiness.test.ts`
- Modify only if test requires: `workers/quests/src/live-proof-readiness.mjs`
- Modify: `docs/plans/2026-06-30-tg-miniapp-live-proof-unblock-runbook.md`

**Step 1: Add ActionRequest marker coverage to signed smoke**

In `workers/quests/src/live-proof-readiness.test.ts`, extend the valid signed-smoke fixture or add a new test that requires the Mini App refresh marker to identify the ActionRequest without exposing raw queued id.

Test expectation:

```ts
assert.match(JSON.stringify(good.evidence || good), /visibleMarkerHash|miniAppRefresh/);
assert.doesNotMatch(JSON.stringify(good), /queued-id|raw subject|TELEGRAM_INIT_DATA|initData=/i);
```

If the helper exposes only `ready`, assert against the written artifact in the capture test.

**Step 2: Run the test to verify current behavior**

Run:

```bash
node --test --test-name-pattern 'signed-action smoke' workers/quests/src/live-proof-readiness.test.ts
```

Expected: PASS if current redaction already covers it, or FAIL with a missing marker assertion.

**Step 3: Implement minimal readiness change only if needed**

If failing because the capture allows a generic marker, update validation so `visibleMarker` must be one of:

- ActionRequest id
- stable idempotency marker
- branch/mission marker plus Telegram message id

Do not store raw queued ids, raw founder ids, raw `initData`, or tokens.

**Step 4: Update the live proof runbook**

In `docs/plans/2026-06-30-tg-miniapp-live-proof-unblock-runbook.md`, add a note under signed action smoke:

```markdown
For channel-origin ActionRequests, use a visible marker that appears in the refreshed Mini App envelope and ties the receipt to the redacted ActionRequest, for example `ar_iverif_w6_live_mrcwmcs3` or `Clients 804 msg 1068`. Do not use raw queued ids or raw Telegram `initData`.
```

**Step 5: Verify**

Run:

```bash
node --test workers/quests/src/live-proof-readiness.test.ts
npm run proof:tg-live-readiness
```

Expected: tests pass. Non-strict readiness may still report live blockers until a real founder-device session exists.

**Step 6: Commit**

```bash
git add workers/quests/src/live-proof-readiness.test.ts workers/quests/src/live-proof-readiness.mjs docs/plans/2026-06-30-tg-miniapp-live-proof-unblock-runbook.md
git commit -m "test(tg-miniapp): preserve signed gate receipt proof"
```

If `live-proof-readiness.mjs` was not modified, omit it from `git add`.

## Task 9: Keep IVerif Proof-Only In The Mini App Copy

**Files:**
- Modify if needed: `docs/plans/product-branches/iverif.md`
- Modify if needed: `workers/quests/src/handler.test.ts`
- Modify if needed: `workers/quests/src/page.ts`

**Step 1: Add a regression assertion**

Add or extend a test near the branch-story Mission tests:

```ts
test('page · IVerif gate copy keeps proof-only boundary before signed action', async () => {
  const env = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'iverif',
        name: 'IVerif',
        promotion: { state: 'proof-only', currentGate: 'Claim/proof separation before automation' },
        arcTitle: 'Claim Proof Separation',
        missions: [{ missionId: 'iverif-wiki-proof', title: 'Repair and run wiki build/route proof', gate: 'Build proof', proofRequired: '`verify:data`, `verify:routes`, and build receipt', dispatchTarget: 'hermes' }],
        gates: [{ gate: 'Public claims', status: 'blocked', requiredProof: 'source-linked claim table' }],
        kpis: [],
        proofPaths: [],
        gaps: [],
      }],
    },
    openItems: [{
      id: 'ar_iverif_w6_live_mrcwmcs3',
      title: 'IVerif: decision needed before action',
      branchId: 'iverif',
      missionId: 'iverif-wiki-proof',
      evidence: 'post-lead enrichment and outreach are not configured',
      reversibility: 'withheld until signed Mini App confirmation',
      idempotencyHint: 'ar_iverif_w6_live_mrcwmcs3',
    }],
  };
  const rendered = await renderPageFixtureContext(env, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;

  assert.match(gate, /iverif/);
  assert.match(gate, /proof|claim|route|signed/i);
  assert.doesNotMatch(gate, /autonomous|outreach sent|client-facing send complete|live SaaS ready/i);
});
```

**Step 2: Run test to verify behavior**

Run:

```bash
node --test --test-name-pattern 'IVerif gate copy|branchStories' workers/quests/src/handler.test.ts
```

Expected: PASS after the Gate card uses existing proof-only packet wording and does not overclaim.

**Step 3: Implement only if needed**

If the test fails because UI copy overclaims, adjust `gateBranchMission`, card copy, or IVerif packet wording so the Gate says:

- `proof-only`
- `claim/proof separation before automation`
- `no outreach or client-facing send until signed confirmation and operator consume`

**Step 4: Verify**

Run:

```bash
npm run validate:product-branches
node --test --test-name-pattern 'IVerif gate copy|gate item cards' workers/quests/src/handler.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts docs/plans/product-branches/iverif.md
git commit -m "fix(tg-miniapp): keep iverif signed gate proof-only"
```

Only add files that actually changed.

## Task 10: Create Or Update The GitHub Tracking Issue

**Files:**
- No repo file required unless adding a docs issue export.
- GitHub issue board via `gh`.

**Step 1: Confirm no open issue already tracks this slice**

Run:

```bash
gh issue list --limit 40 --state open --search "signed gate channel ActionRequest receipt Mini App"
```

Expected: no exact open duplicate.

**Step 2: Create the issue**

Run:

```bash
gh issue create \
  --title "TG Mini App: signed Gate UX for channel-origin ActionRequests" \
  --label tg-miniapp \
  --label mission-control \
  --label area:frontend \
  --body-file /tmp/tg-signed-gate-issue.md
```

Create `/tmp/tg-signed-gate-issue.md` with:

```markdown
## Goal

Channel-origin ActionRequests should read clearly inside the TG Mini App Gate, require signed founder confirmation, and show queued/receipt state without treating Telegram channels as execution authority.

## Acceptance

- Gate first viewport centers the active decision, not dashboard progress.
- Gate card shows ActionRequest id, branch/mission, Telegram topic/thread/message route, proof, consequence, reversibility, idempotency, and receipt expectation.
- Preflight uses `Confirm signed` and does not POST before explicit confirmation.
- Queued result sheet offers receipt refresh and does not claim operator consume or live proof until evidence exists.
- Viewport proof covers gate card and approve/reroll preflight.
- Live proof readiness remains redacted and still requires queue, consume, and Mini App refresh phases.
```

**Step 3: Record the issue number**

Add the issue number to the PR body later. Do not add noisy issue references to runtime copy.

**Step 4: Commit**

No commit unless a docs issue export is created.

## Task 11: Full Verification

**Files:**
- Test all touched files and scripts.

**Step 1: Run focused tests**

Run:

```bash
node --test --test-name-pattern 'gate|Gate|signed-action|pull refresh|IVerif' workers/quests/src/handler.test.ts
node --test workers/quests/src/live-proof-readiness.test.ts
```

Expected: PASS.

**Step 2: Run product and composition validators**

Run:

```bash
npm run validate:product-branches
npm run validate
```

Expected: PASS.

**Step 3: Run viewport proof**

Run:

```bash
npm run proof:tg-viewport
```

Expected: PASS with updated Gate screenshots and manifest.

**Step 4: Run non-strict live readiness**

Run:

```bash
npm run proof:tg-live-readiness
```

Expected: command exits successfully. It may still report real live blockers if founder-device `initData`, Telegram WebView proof, or signed production smoke is absent.

**Step 5: Run full tests**

Run:

```bash
npm test
```

Expected: PASS. If unrelated tests fail, record exact failing tests and do not hide the failure.

**Step 6: Check diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional files modified.

## Task 12: PR And Deployment Handoff

**Files:**
- PR body only.
- Optional: update this plan with completion notes after merge.

**Step 1: Push branch**

Run:

```bash
git push -u origin codex/tg-signed-gate-channel-quest
```

Expected: branch pushed.

**Step 2: Open PR**

Run:

```bash
gh pr create \
  --title "Fix TG Mini App signed Gate UX for channel ActionRequests" \
  --body-file /tmp/tg-signed-gate-pr.md
```

Use this PR body:

```markdown
## Summary

- makes channel-origin ActionRequests readable in the Gate scene
- keeps Telegram channels as signal/receipt lanes, not signing authority
- adds signed preflight, queued result, receipt refresh, viewport, and live-proof guards

## Verification

- [ ] node --test --test-name-pattern 'gate|Gate|signed-action|pull refresh|IVerif' workers/quests/src/handler.test.ts
- [ ] node --test workers/quests/src/live-proof-readiness.test.ts
- [ ] npm run validate:product-branches
- [ ] npm run validate
- [ ] npm run proof:tg-viewport
- [ ] npm run proof:tg-live-readiness
- [ ] npm test

## Live Proof Boundary

Local tests and viewport proof do not prove the real Telegram signed callback. Full proof still requires founder-device Mini App confirmation, Worker queue acceptance, operator consume, refreshed Mini App marker, and Telegram card receipt/card edit evidence.
```

**Step 3: Deployment handoff**

After merge/deploy, record:

- deployed git SHA
- Worker URL
- Telegram topic/thread/message used for proof
- ActionRequest id
- signed action result
- operator consume receipt
- Mini App refresh marker
- Telegram card edit or queued receipt evidence

Do not mark live proof complete until all of those are present.

## Final Acceptance Checklist

- Gate card is decision-first on mobile.
- No title/chip overlap at Telegram WebView width.
- ActionRequest id, branch/mission, topic/thread/message route, proof, consequence, reversibility, idempotency, and receipt expectation are visible before signing.
- `Confirm signed` is the explicit preflight action.
- Group/channel callback is described as signal/receipt, not signing authority.
- Queued result does not claim operator consume.
- Refresh receipt action is visible after queue.
- IVerif remains proof-only.
- No raw Telegram `initData`, bearer token, raw private chat id, raw founder id, raw queued id, or direct secret appears in UI, fixtures, docs, or proof artifacts.
- Viewport proof is updated.
- Non-strict live readiness remains honest about remaining live blockers.
