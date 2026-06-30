# TG Mini App Root Nav Component System Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the legacy text-tab mini app shell with a Mission Control root navigation that uses the planned component-system glyph, state, and orbit language.

**Architecture:** Keep the existing five-scene order, swipe engine, Telegram WebApp hooks, and signed Gate paths. Add a root-shell presentation layer inside `workers/quests/src/page.ts` with explicit `MissionControlShell`, `RootNav`, `RootSceneTab`, and `RootStatusStack` markers, then update tests and viewport proof so the shell cannot drift back into the old tab treatment.

**Tech Stack:** TypeScript/Node ESM, inline Cloudflare Worker mini app renderer in `workers/quests/src/page.ts`, `node:test`, local Chrome viewport proof via `workers/quests/src/visual-viewport-proof.mjs`.

---

### Task 1: Root Shell Contract Tests

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Read: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md`
- Read: `docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md`

**Step 1: Write failing tests for root shell components**

Add expectations near `page · five scenes with Mission-first tabs and sliding indicator`:

```ts
test('page · root shell uses Mission Control component-system nav', () => {
  for (const m of [
    'data-component="MissionControlShell"',
    'data-component="RootStatusStack"',
    'data-component="RootNav"',
    'data-component="RootSceneTab"',
    'data-root-scene="mission"',
    'data-root-scene="gate"',
    'data-root-scene="tools"',
    'data-root-scene="story"',
    'data-root-scene="inspect"',
    'data-nav-glyph="mission"',
    'data-nav-glyph="gate"',
    'data-nav-glyph="tools"',
    'data-nav-glyph="story"',
    'data-nav-glyph="inspect"',
    'mc-signal-rail',
  ]) {
    assert.ok(PAGE.includes(m), `page has root nav component ${m}`);
  }
});
```

**Step 2: Add primary Gate copy guard**

Extend the primary-copy denylist test so the visible Gate shell no longer relies on `signed queue`, `no local state write`, or `source route` outside sheet/audit detail.

**Step 3: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern 'root shell|five scenes|primary Mission Gate Tools' workers/quests/src/handler.test.ts
```

Expected: FAIL until `page.ts` exposes the new root component markers and copy.

### Task 2: Root Shell And Nav Renderer

**Files:**
- Modify: `workers/quests/src/page.ts`
- Test: `workers/quests/src/handler.test.ts`

**Step 1: Replace legacy header/nav classes with root components**

In the static `PAGE` HTML:

- Wrap `.app` with `data-component="MissionControlShell"`.
- Add `data-component="RootStatusStack"` to `header`.
- Add a `root-brand` glyph block before `Mission Control`.
- Change `nav` to `class="root-nav"` and `data-component="RootNav"`.
- Change each nav button to `class="root-tab"` and `data-component="RootSceneTab"`.
- Add `data-root-scene`, `data-nav-glyph`, and short captions per scene.

**Step 2: Use component-system glyphs in tabs**

Use stable text plus ornamental glyph spans:

```html
<button id="tb0" class="root-tab on" data-component="RootSceneTab" data-root-scene="mission" data-nav-glyph="mission" data-scene-source="tg-miniapp-scenes@v1">
  <span class="root-tab-glyph" aria-hidden="true">✦</span>
  <span class="root-tab-label">Mission</span>
  <small>next move</small>
</button>
```

Use these tab glyphs:

- Mission: `✦`
- Gate: `◇`
- Tools: `▱`
- Story: `◌`
- Inspect: `○`

**Step 3: Add CSS without introducing new layout instability**

Add CSS for:

- `.app[data-component="MissionControlShell"]`
- `.root-brand`
- `.root-brand-glyph`
- `.root-status`
- `.root-nav`
- `.root-tab`
- `.root-tab-glyph`
- `.root-tab-label`
- `.root-nav-indicator`

Rules:

- No nested cards in header.
- Keep touch targets at least `48px`.
- Use existing chartreuse, mint, and peach palette.
- Use transform/opacity-only animation.
- Keep nav labels readable on 390px mobile.

**Step 4: Keep existing scene engine API**

Update JS references from `ind` to the new indicator element only if the `id` changes. Prefer keeping `id="ind"` to minimize behavior risk.

**Step 5: Run focused tests**

Run:

```bash
node --test --test-name-pattern 'root shell|scene tabs|active scene badge|reduced motion|animations ride' workers/quests/src/handler.test.ts
```

Expected: PASS.

### Task 3: Gate Primary Copy Alignment

**Files:**
- Modify: `workers/quests/src/page.ts`
- Test: `workers/quests/src/handler.test.ts`

**Step 1: Reword Gate hero and strip**

Replace primary Gate copy:

- `The Gate · signed queue` -> `Gate · decisions`
- `Approve or reroll evidence-backed work items...` -> `Review founder decisions tied to branches, missions, proof, consequence, and reversibility.`
- `Founder auth` -> `Decision`
- `Queue mode` -> `Effect`
- `Proof rule` -> `Proof`
- `no local state write` -> `held until operator consumption`

**Step 2: Keep technical language in sheets**

Do not remove signed-action, idempotency, initData, or queue detail from preflight/result/audit sheets. Those are needed for proof and Inspect.

**Step 3: Run Gate tests**

Run:

```bash
node --test --test-name-pattern 'gate chamber|empty gate|gate item cards|approve and reroll|primary Mission Gate Tools' workers/quests/src/handler.test.ts
```

Expected: PASS with signed actions still clickable.

### Task 4: Viewport Proof Refresh

**Files:**
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `workers/quests/src/live-proof-readiness.test.ts`
- Modify: `docs/plans/assets/tg-miniapp-viewport-proof/README.md`
- Regenerate: `docs/plans/assets/tg-miniapp-viewport-proof/*.png`
- Regenerate: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`

**Step 1: Add root-shell wait conditions where useful**

For Mission and Gate layout captures, ensure the proof waits for `RootNav`:

```js
waitFor: "document.querySelector('[data-component=\"RootNav\"]') && document.querySelector('[data-component=\"MissionControlShell\"]')"
```

**Step 2: Regenerate viewport proof**

Run:

```bash
npm run proof:tg-viewport
```

Expected: PASS and regenerated Mission/Gate screenshots show component-system nav.

**Step 3: Inspect screenshots**

Open:

- `docs/plans/assets/tg-miniapp-viewport-proof/mission-control-mobile.png`
- `docs/plans/assets/tg-miniapp-viewport-proof/gate-empty-mobile.png`
- `docs/plans/assets/tg-miniapp-viewport-proof/gate-consequence-mobile.png`

Expected: header/nav use glyph tabs and the Gate primary copy reads as a decision surface, not endpoint trace.

### Task 5: Final Verification And Stage

**Files:**
- Stage changed source, tests, plan, README, manifest, and viewport PNGs.
- Leave `ISA.md` untracked.

**Step 1: Run focused and full checks**

Run:

```bash
node --test workers/quests/src/handler.test.ts workers/quests/src/live-proof-readiness.test.ts
npm run validate
npm run validate:product-branches
npm run proof:tg-live-readiness
npm test
git diff --check
git diff --cached --check
```

Expected:

- Focused tests pass.
- `npm test` remains `620/620` or higher if new tests are added.
- Live readiness remains honest if founder Telegram proof is still missing.
- Diff checks pass.

**Step 2: Secret scan proof artifacts**

Run:

```bash
rg -n "(query_id=|tgWebAppData=|Bearer [A-Za-z0-9._~-]{8,}|hash=[A-Za-z0-9._~-]+|signature=[A-Za-z0-9._~-]+)" docs/plans/assets/tg-miniapp-viewport-proof docs/plans/assets/tg-miniapp-live-proof docs/plans/product-branches
```

Expected: exit code `1` with no matches.

**Step 3: Stage**

Run:

```bash
git add -u
git add docs/plans/2026-06-29-tg-miniapp-root-nav-component-system-plan.md
git status --short
```

Expected: root nav plan and regenerated proof bundle staged; `ISA.md` remains untracked.
