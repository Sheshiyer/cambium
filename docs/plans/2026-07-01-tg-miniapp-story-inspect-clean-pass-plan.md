# TG Mini App Story And Inspect Clean Pass Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the Telegram mini app Story and Inspect pages so Story reads as branch progress, Inspect reads as a proof map, and app chrome no longer exposes the "real world-state / no fake progress" invariant as product copy.

**Architecture:** Keep the current single-page Worker surface in `workers/quests/src/page.ts` and preserve the five scenes `Mission / Gate / Tools / Story / Inspect`. Move proof/source/system wording into Inspect sheets and focused proof details, while primary Story copy stays branch-readable. Guard the change with focused handler tests first, then viewport proof after copy and hierarchy settle.

**Tech Stack:** TypeScript, Cloudflare Worker static `PAGE` template, Node test runner, local viewport proof runner, GitHub issue/spec traceability.

---

## References

- Story parent issue: `gh issue view 98 --comments`
- Inspect parent issue: `gh issue view 99 --comments`
- Design spec: `docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md`
- Plan baseline: `docs/plans/2026-06-29-tg-miniapp-mission-control-ui-upgrade-plan.md`
- Component foundation: `docs/plans/2026-06-30-tg-miniapp-component-foundation-plan.md`
- Component swarm: `docs/plans/2026-06-30-tg-miniapp-component-system-swarm-plan.md`
- Scope critique: `docs/superpowers/specs/2026-06-30-tg-miniapp-plan-vs-code-critique.md`
- Component map: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md`
- Viewport proof manifest: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json`

## Execution Rules

- Work on a branch such as `codex/tg-story-inspect-clean-pass`.
- Do not run parallel write agents against `workers/quests/src/page.ts`.
- Start with shared guardrails, then Story, then Inspect, then viewport proof.
- Keep `data-component` and interaction selectors stable unless a task explicitly updates the matching tests.
- Treat "no fake progress" as a validation invariant, not footer or product chrome.
- Do not revive the dropped v1 fractal ring map; keep tapestry as Inspect-only proof infrastructure.
- After each task, run the focused command listed in the task. After each phase, run:

```bash
node --test workers/quests/src/handler.test.ts
npm run validate:product-branches
npm run validate
git diff --check
```

## Shared Guardrail Tasks

### Task G01: Remove Footer Slogan Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Modify later: `workers/quests/src/page.ts`

**Step 1: Write the failing test**

Replace the shell assertion that expects `/no fake progress/` in `PAGE` with an assertion that app-wide chrome does not contain the footer slogan while fixtures/tests still encode blocked proof states.

```ts
assert.doesNotMatch(PAGE, /every status derives|real world-state|no fake progress/i);
assert.match(JSON.stringify(NO_FAKE_PROGRESS_VISUAL_FIXTURE), /visual-fixture:no-fake-progress/);
```

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'Living Blueprint shell|no fake progress' workers/quests/src/handler.test.ts`

Expected: FAIL while `page.ts` still contains the footer slogan.

**Step 3: Implement minimal code**

Delete the footer text from `workers/quests/src/page.ts`; either remove the `<footer>` element or leave an empty structural footer only if layout needs it.

**Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern 'Living Blueprint shell|no fake progress' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "fix(tg-miniapp): remove proof slogan from app chrome"
```

### Task G02: Expand Primary Copy Denylist

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing test**

Add these terms to `PRIMARY_MISSION_COPY_DENYLIST`: `real world-state`, `no fake progress`, `served beats`, `operator narrative`, `source detail`, `debug layer`, `back path`, `trace action`.

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'primary Mission Gate Tools and Story copy denylist' workers/quests/src/handler.test.ts`

Expected: FAIL until Story and scene-sheet copy are cleaned.

**Step 3: Implement minimal code**

Do not weaken the denylist. Fix the product copy in the later Story/shared tasks.

**Step 4: Run test to verify it passes**

Run after dependent copy tasks: `node --test --test-name-pattern 'primary Mission Gate Tools and Story copy denylist' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit with the copy task that makes the denylist pass.

### Task G03: Rescope Scene Badge Metadata

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing test**

Add assertions that Mission, Gate, Tools, and Story scene badge sheets do not expose `view`, `target`, raw source strings, or proof-system copy.

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'active scene badge opens view details sheet|scene badge' workers/quests/src/handler.test.ts`

Expected: FAIL because `openSceneSheet()` emits `view`, `target`, and `tg-miniapp-scenes@v1`.

**Step 3: Implement minimal code**

Change `SCENE_META` so non-Inspect entries use user-facing `summary`, `next`, and `refresh` fields. Keep raw source/target only for Inspect.

**Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern 'active scene badge opens view details sheet|scene badge' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "fix(tg-miniapp): contain scene metadata copy"
```

### Task G04: Preserve Inspect Metadata Allowance

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing test**

Assert the Inspect scene badge sheet still exposes proof/system details when `scene === 4`.

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'Inspect scene badge|scene badge' workers/quests/src/handler.test.ts`

Expected: FAIL until `openSceneSheet()` branches by scene.

**Step 3: Implement minimal code**

In `openSceneSheet()`, render a compact founder-facing sheet for primary scenes and a proof-detail sheet for Inspect.

**Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern 'Inspect scene badge|scene badge' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit with Task G03 if implemented together.

### Task G05: Add Chrome Copy Scan

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing test**

Add a test that extracts header, nav, footer, scene badge, and freshness chip markup from `PAGE` and rejects raw infrastructure terms outside Inspect/detail sheets.

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'chrome copy|primary copy' workers/quests/src/handler.test.ts`

Expected: FAIL before footer and badge cleanup.

**Step 3: Implement minimal code**

Clean only visible chrome copy. Do not delete proof/state data attributes required by tests.

**Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern 'chrome copy|primary copy' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit with the chrome cleanup bundle.

### Task G06: Keep No-Fake-Progress Fixture Honest

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Read: `workers/quests/src/visual-fixtures.ts`

**Step 1: Write the failing test**

Assert the no-fake-progress fixture still has `beats: []`, stale `derivedAt`, missing command data, and blocked live proof rows after footer removal.

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'no-fake-progress visual fixture|stale ecosystem|offline ecosystem' workers/quests/src/handler.test.ts`

Expected: PASS before implementation; keep as guard.

**Step 3: Implement minimal code**

If it fails, fix only accidental fixture overclaiming.

**Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern 'no-fake-progress visual fixture|stale ecosystem|offline ecosystem' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

Commit only if fixture/test code changes.

### Task G07: Update Design Spec With Invariant Boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md`

**Step 1: Write the doc change**

Add a note under testing/copy policy: `no fake progress` is a verification invariant and fixture name, not footer copy or primary product language.

**Step 2: Run check**

Run: `rg -n "no fake progress|footer|verification invariant" docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md`

Expected: The new boundary is discoverable.

**Step 3: Implement minimal code**

No code.

**Step 4: Run validation**

Run: `git diff --check`

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-29-tg-miniapp-mission-control-design.md
git commit -m "docs(tg-miniapp): clarify no-fake-progress copy boundary"
```

### Task G08: Document Tapestry Boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-06-30-tg-miniapp-plan-vs-code-critique.md`
- Modify optionally: this plan

**Step 1: Write the doc change**

Add or preserve the rule: v1 dropped the fractal ring map; `tapestry` remains Inspect-only proof infrastructure.

**Step 2: Run check**

Run: `rg -n "fractal ring map|dropped from v1|Inspect Tapestry|proof infrastructure" docs/superpowers/specs/2026-06-30-tg-miniapp-plan-vs-code-critique.md docs/plans/2026-07-01-tg-miniapp-story-inspect-clean-pass-plan.md`

Expected: The boundary is explicit.

**Step 3: Implement minimal code**

No app code.

**Step 4: Run validation**

Run: `git diff --check`

Expected: PASS.

**Step 5: Commit**

Commit only if the critique doc changes.

## Story Page Tasks

### Task S01: Create Visible Beats Helper

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1: Write the failing test**

Add a Story test where two branch-scoped beats exist, select one branch, and assert hero/digest/timeline use the filtered set.

**Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern 'story filter|story hero|story digest' workers/quests/src/handler.test.ts`

Expected: FAIL because hero/digest/timeline are fed raw `beats`.

**Step 3: Write minimal implementation**

Create a helper near `renderStory()`:

```js
function visibleStoryBeats(beats){
  if (STORY_BRANCH_FILTER === 'all') return beats;
  if (STORY_BRANCH_FILTER === 'unassigned') return beats.filter(beat => !storyBeatBranch(beat));
  return beats.filter(beat => storyBeatBranch(beat) === STORY_BRANCH_FILTER);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern 'story filter|story hero|story digest' workers/quests/src/handler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/handler.test.ts
git commit -m "fix(tg-story): derive visible beats once"
```

### Task S02: Feed Hero From Visible Beats

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert a branch-filtered Story hero opens the filtered beat.

**Step 2:** Run `node --test --test-name-pattern 'story hero' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Change `renderStoryHero(beats)` calls to pass `visibleBeats`.

**Step 4:** Re-run the command; expect PASS.

**Step 5:** Commit `fix(tg-story): align hero with filters`.

### Task S03: Feed Digest From Visible Beats

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert digest counts change after branch filter selection.

**Step 2:** Run `node --test --test-name-pattern 'Story Digest|story digest' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Pass `visibleBeats` to `renderStoryDigest()` and digest sheet construction.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): align digest with filters`.

### Task S04: Feed Group Controls From Visible Beats

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert group chip counts are scoped to the active branch filter.

**Step 2:** Run `node --test --test-name-pattern 'StoryGroupControls|story filter' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Pass `visibleBeats` into `renderStoryGroupControls()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): scope group counts`.

### Task S05: Feed Timeline From Visible Beats

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `StoryTimelineRail` dot count equals visible beat count.

**Step 2:** Run `node --test --test-name-pattern 'StoryTimelineRail|story filter' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Pass `visibleBeats` into `renderStoryTimeline()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): scope timeline rail`.

### Task S06: Remove Unscoped Beat Leakage

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert branch filters do not auto-include beats with no branch unless the unassigned chip is selected.

**Step 2:** Run `node --test --test-name-pattern 'unassigned|story filter' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Remove the `|| !storyBeatBranch(beat)` branch-filter bypass.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): isolate unassigned beats`.

### Task S07: Add Unassigned Story Chip

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert an `unassigned` branch chip appears only when unscoped beats exist.

**Step 2:** Run `node --test --test-name-pattern 'unassigned|BranchArcChip' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Add a compact `unassigned` chip to `renderStoryBranchFilters()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `feat(tg-story): add unassigned branch filter`.

### Task S08: Guard Mission Branch Focus Sync

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `MISSION_BRANCH_FOCUS` changes only when a real branch-scoped Story beat opens Mission.

**Step 2:** Run `node --test --test-name-pattern 'Story-to-Mission|MISSION_BRANCH_FOCUS' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Only set `MISSION_BRANCH_FOCUS` when `branchFocus` is non-empty and not `unassigned`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): guard mission focus handoff`.

### Task S09: Derive Group Labels Once

**Files:**
- Modify: `workers/quests/src/page.ts`

**Step 1:** Add a grep-backed test or assertion that Story group labels are sourced from one constant.

**Step 2:** Run `node --test --test-name-pattern 'StoryGroupControls|StoryGroup' workers/quests/src/handler.test.ts`; expect current behavior to pass before refactor.

**Step 3:** Add `const STORY_GROUPS = ['Mission wins','New signals','Lessons','Drift'];` and reuse it.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `refactor(tg-story): centralize story groups`.

### Task S10: Add Story Stale Banner Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Modify later: `workers/quests/src/page.ts`

**Step 1:** Add a stale fixture Story test asserting a Story-level stale banner appears above filters.

**Step 2:** Run `node --test --test-name-pattern 'stale Story|Story stale' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Implement in Task S11.

**Step 4:** Re-run after S11; expect PASS.

**Step 5:** Commit with S11.

### Task S11: Render Story Stale Banner

**Files:**
- Modify: `workers/quests/src/page.ts`

**Step 1:** Use the S10 failing test.

**Step 2:** Confirm it fails.

**Step 3:** In `renderStory(env)`, prepend a compact stale banner when `FRESHNESS_STATE.stale` or envelope age is stale.

**Step 4:** Run `node --test --test-name-pattern 'stale Story|Story stale' workers/quests/src/handler.test.ts`; expect PASS.

**Step 5:** Commit `feat(tg-story): show stale story state`.

### Task S12: Rewrite Stale Story Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert stale copy includes `Last story check is stale` and excludes `source`, `envelope`, `no fake progress`.

**Step 2:** Run focused Story stale test; expect FAIL.

**Step 3:** Use copy such as: `Last story check is stale. Refresh before using these beats for a decision.`

**Step 4:** Re-run focused Story stale test; expect PASS.

**Step 5:** Commit `fix(tg-story): humanize stale copy`.

### Task S13: Split Empty And Stale States

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert empty with fresh envelope and stale with old envelope render distinct headings.

**Step 2:** Run `node --test --test-name-pattern 'empty story|stale Story' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Add separate helpers `renderStoryEmptyState(env)` and `renderStoryStaleBanner(env)`.

**Step 4:** Re-run focused tests; expect PASS.

**Step 5:** Commit `refactor(tg-story): split empty and stale states`.

### Task S14: Rewrite Empty Story Heading

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Update empty Story test to expect `No branch story yet`.

**Step 2:** Run `node --test --test-name-pattern 'empty story' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Replace `Story is waiting for mission movement.` with `No branch story yet.`

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): simplify empty heading`.

### Task S15: Rewrite Empty Story Body

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Expect body copy: `Wins, signals, lessons, and drift appear here after a branch has evidence.`

**Step 2:** Run empty Story test; expect FAIL.

**Step 3:** Replace the current empty paragraph with the expected branch-readable copy.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): clarify empty body copy`.

### Task S16: Rename Empty Story Actions

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert empty actions read `Refresh`, `Open Mission`, and `Open Proof`.

**Step 2:** Run empty Story test; expect FAIL for current `Mission` and `Inspect`.

**Step 3:** Update button labels while keeping `data-story-empty-action` values.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): clarify empty actions`.

### Task S17: Remove Source Detail From Empty Groups

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert Story primary HTML does not contain `source detail`.

**Step 2:** Run `node --test --test-name-pattern 'copy denylist|story' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Replace empty-group paragraph with `Nothing in this lane yet. Refresh after branch evidence changes.`

**Step 4:** Re-run focused tests; expect PASS.

**Step 5:** Commit `fix(tg-story): remove source wording from empty groups`.

### Task S18: Rewrite Story Outcome Defaults

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert primary card outcomes exclude `served proof` and `operator lesson`.

**Step 2:** Run Story copy denylist test; expect FAIL.

**Step 3:** Update `storyBeatOutcome()` defaults to `Mission moved`, `Lesson captured`, `Needs follow-up`, and `New signal`.

**Step 4:** Re-run Story copy tests; expect PASS.

**Step 5:** Commit `fix(tg-story): humanize outcome defaults`.

### Task S19: Rewrite Proof Cue Defaults

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert primary Story HTML excludes `proof detail available in sheet`.

**Step 2:** Run Story copy denylist test; expect FAIL.

**Step 3:** Update `storyBeatProofCue()` defaults to `Proof ready`, `Proof needed`, or `Review evidence`.

**Step 4:** Re-run focused tests; expect PASS.

**Step 5:** Commit `fix(tg-story): simplify proof cues`.

### Task S20: Rewrite Follow-Up Defaults

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert sheet follow-ups exclude `Inspect source rows` and `Review source detail`.

**Step 2:** Run `node --test --test-name-pattern 'story beats are clickable sheets' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Update `storyBeatFollowup()` to founder-readable next actions.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): clarify follow-up copy`.

### Task S21: Contain Raw Story Source Labels

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert primary Story HTML excludes `Quest ledger`, `Operator narrative`, and raw source labels.

**Step 2:** Run Story copy test; expect FAIL if any primary copy leaks.

**Step 3:** Keep raw `source` rows only in `openStoryBeat()` or move them behind Inspect links.

**Step 4:** Re-run focused tests; expect PASS.

**Step 5:** Commit `fix(tg-story): contain source labels`.

### Task S22: Rename Story Sheet Meta Labels

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert Story sheet labels use `proof`, `from`, `related page`, and `next`, not `source summary`, `ecosystem target`, `context link`, or `action`.

**Step 2:** Run Story sheet test; expect FAIL.

**Step 3:** Rename labels in `openStoryBeat()` without changing data values.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): clean beat sheet labels`.

### Task S23: Harden Story Context Routing

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add fixture beats for gate/tool/proof phrasing variants.

**Step 2:** Run Story routing test; expect FAIL for brittle regex gaps.

**Step 3:** Add small helper rules that prefer explicit beat fields, then text fallback.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): stabilize context routing`.

### Task S24: Preserve Story Component Selectors

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `StoryGroupControls`, `BranchArcChip`, `StoryDigestCards`, `StoryTimelineRail`, and `StoryPacketTrail` still appear.

**Step 2:** Run `node --test --test-name-pattern 'story beats are clickable sheets' workers/quests/src/handler.test.ts`; expect PASS.

**Step 3:** If FAIL, restore selectors in `page.ts`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit only if selector repair was needed.

### Task S25: Review Story Group Heuristics

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add ambiguous text fixture so `blocked by copy` and `lesson blocked earlier` classify intentionally.

**Step 2:** Run `node --test --test-name-pattern 'story group|Drift' workers/quests/src/handler.test.ts`; expect FAIL if heuristic is accidental.

**Step 3:** Refine `storyBeatGroup()` with explicit field preference before regex.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): stabilize group classification`.

### Task S26: Review New Signal State

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert New signals state token uses the intended visual state and label.

**Step 2:** Run Story state test; expect current behavior to document or fail.

**Step 3:** If needed, change `storyBeatState()` for New signals from always `proof-needed` to `active` when proof exists.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): tune signal state`.

### Task S27: State-Aware Branch Chips

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert stale/blocked branch packets produce visible chip state treatment.

**Step 2:** Run `node --test --test-name-pattern 'BranchArcChip|story branch' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Add branch-chip state class/token using branch packet status.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `feat(tg-story): show branch chip state`.

### Task S28: State-Aware Digest Card

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert digest glyph state reflects drift/blockers when present.

**Step 2:** Run Story digest test; expect FAIL.

**Step 3:** Compute digest state from visible group counts and pass to `mcGlyphSvg()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): make digest state-aware`.

### Task S29: Rewrite Latest Change Hero Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert hero subcopy says `Open branch beat` or equivalent branch-progress wording.

**Step 2:** Run Story hero test; expect FAIL.

**Step 3:** Replace `open full beat detail` with cleaner founder-facing text.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): clean latest hero copy`.

### Task S30: Add Story-Specific Denylist Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add a Story-only denylist for `story fallback`, `served beats`, `quest-ledger`, `operator narrative`, `source detail`, and `no fake story progress`.

**Step 2:** Run `node --test --test-name-pattern 'Story copy denylist' workers/quests/src/handler.test.ts`; expect FAIL until S17-S22 land.

**Step 3:** Implement dependent copy fixes.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit with the final Story copy bundle.

### Task S31: Add Filtered Hero Click Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add test clicking filtered hero and asserting sheet text matches filtered beat.

**Step 2:** Run focused test; expect FAIL until S02/S03 land.

**Step 3:** Implement dependent filter fixes.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit with filter bundle.

### Task S32: Add Filtered Digest Click Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add test opening digest after branch filter and asserting hidden branch beat is absent.

**Step 2:** Run focused test; expect FAIL until S03 lands.

**Step 3:** Implement dependent filter fixes.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit with digest bundle.

### Task S33: Add Stale Refresh Persistence Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add test that stale refresh does not reset Story filter state unexpectedly.

**Step 2:** Run focused test; expect FAIL if state resets.

**Step 3:** Keep Story filters stable unless data removes the selected branch.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-story): preserve filter across stale refresh`.

### Task S34: Update Story Viewport Wait Text

**Files:**
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `workers/quests/src/live-proof-readiness.test.ts` if manifest expectations change

**Step 1:** Add or update Story wait condition to match final Story labels.

**Step 2:** Run `node --test workers/quests/src/live-proof-readiness.test.ts`; expect PASS or focused manifest failure.

**Step 3:** Update viewport runner selectors/text only after Story copy stabilizes.

**Step 4:** Run `npm run proof:tg-viewport:diagnose` then `npm run proof:tg-viewport`.

**Step 5:** Commit `test(tg-story): update viewport proof anchors`.

### Task S35: Capture Story Sheet Proof

**Files:**
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `docs/plans/assets/tg-miniapp-viewport-proof/README.md`

**Step 1:** Add a scripted Story beat sheet capture for a real beat.

**Step 2:** Run `npm run proof:tg-viewport`; expect new/updated screenshot.

**Step 3:** Add manifest entry and README row if runner does not do it automatically.

**Step 4:** Run `node --test workers/quests/src/live-proof-readiness.test.ts`.

**Step 5:** Commit proof artifacts deliberately.

### Task S36: Run Story Phase Gate

**Files:**
- Verify: `workers/quests/src/page.ts`
- Verify: `workers/quests/src/handler.test.ts`

**Step 1:** Run focused Story tests.

```bash
node --test --test-name-pattern 'story|Story|copy denylist' workers/quests/src/handler.test.ts
```

**Step 2:** Run full handler tests.

```bash
node --test workers/quests/src/handler.test.ts
```

**Step 3:** Run validation.

```bash
npm run validate:product-branches
npm run validate
git diff --check
```

**Step 4:** Review screenshots if regenerated.

**Step 5:** Commit `test(tg-story): complete story clean pass`.

## Inspect Page Tasks

### Task I01: Rename Render Function Internally

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add a test that `renderInspect` exists or that visible Inspect no longer relies on legacy operator-map naming in tests.

**Step 2:** Run `node --test --test-name-pattern 'Inspect|operator map' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Rename `renderOperatorMap(env)` to `renderInspect(env)` or add a wrapper while retiring primary test references to operator map.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `refactor(tg-inspect): name renderer for inspect`.

### Task I02: Tighten Inspect Header Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert header copy reads as proof hierarchy, not `Proof, packet, freshness, and system detail.`

**Step 2:** Run `node --test --test-name-pattern 'Inspect Header|Inspect groups' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Use copy such as `Proof map for blockers, packets, freshness, and evidence.`

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): sharpen header copy`.

### Task I03: Make Proof Summary First Scan

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `InspectProofSummaryAction` appears before `InspectGroupStack` or immediately after header.

**Step 2:** Run focused Inspect order test; expect FAIL if ordering differs.

**Step 3:** Reorder `renderInspectProofSummary()` before/alongside groups as the dominant first-scan row.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): promote proof summary`.

### Task I04: Rephrase Proof Summary Around Blockers

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert summary begins with blocker state, not branch count.

**Step 2:** Run proof summary test; expect FAIL.

**Step 3:** Change text to lead with `X live blocker(s)` or `No live blockers`.

**Step 4:** Re-run proof summary test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): lead proof summary with blockers`.

### Task I05: Rename Proof Summary CTA

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert CTA reads `Open proof details`.

**Step 2:** Run proof summary test; expect FAIL.

**Step 3:** Replace `Open proof summary` with `Open proof details`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): rename proof summary action`.

### Task I06: Reorder Inspect Groups

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert group order begins `freshness`, `live-proof`, `branch-packets`, `gates`, `policy`.

**Step 2:** Run `node --test --test-name-pattern 'Inspect groups proof detail' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Reorder the array returned by `inspectGroupSummaries()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): order proof groups by decision need`.

### Task I07: Move Branch Fixtures Out Of First View

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `branch-fixtures` is not in the first primary group stack or is marked secondary.

**Step 2:** Run focused Inspect group test; expect FAIL.

**Step 3:** Move branch fixtures into branch-packets sheet detail or secondary section.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): demote fixture details`.

### Task I08: Move Surface Contract Out Of First View

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `surface-contract` is secondary or sheet-only.

**Step 2:** Run Inspect group test; expect FAIL.

**Step 3:** Move surface contract rows into proof summary sheet or a secondary "surface" section.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): demote surface contract`.

### Task I09: Rewrite Freshness Group Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert group copy excludes `Envelope` and says refresh before trusting decisions.

**Step 2:** Run Inspect group test; expect FAIL.

**Step 3:** Update freshness details in `inspectGroupSummaries()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): humanize freshness group`.

### Task I10: Rewrite Live Proof Group Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert copy excludes `readiness rows` and names blockers plainly.

**Step 2:** Run Inspect group test; expect FAIL.

**Step 3:** Update live-proof group detail.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): humanize live proof group`.

### Task I11: Rewrite Branch Packets Group Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert copy says whether Mission can be trusted, not `feed Mission`.

**Step 2:** Run focused test; expect FAIL.

**Step 3:** Update branch-packets group detail.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify branch packet group`.

### Task I12: Rewrite Gates Group Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert copy emphasizes founder approval state.

**Step 2:** Run Inspect group test; expect FAIL.

**Step 3:** Update gates group detail.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify gates group`.

### Task I13: Rewrite Policy Group Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert copy explains blocked/bounded action before policy internals.

**Step 2:** Run Inspect group test; expect FAIL.

**Step 3:** Update policy group detail.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify policy group`.

### Task I14: Rewrite Tools Group Copy

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert copy starts with operator toolbelt availability.

**Step 2:** Run Inspect tools sheet/group test; expect FAIL.

**Step 3:** Update tools group detail.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify tools group`.

### Task I15: Convert First-Viewport Layout To Proof Stack

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert proof summary and proof groups appear before any `cmdgrp` legacy sections.

**Step 2:** Run `node --test --test-name-pattern 'first viewport|Inspect groups' workers/quests/src/handler.test.ts`; expect FAIL if order is loose.

**Step 3:** Keep first viewport as header, proof summary, proof groups; move legacy blocks after.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): make first viewport proof-first`.

### Task I16: Demote Stage Grid

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `stagegrid` appears after live proof, branch packets, policy, evidence.

**Step 2:** Run Inspect order test; expect FAIL.

**Step 3:** Move `stagegrid` lower in `renderInspect()`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): demote stage grid`.

### Task I17: Demote Rails Grid

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert `railgrid` appears after proof-critical sections.

**Step 2:** Run Inspect order test; expect FAIL.

**Step 3:** Move rails below core proof blocks.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): demote rail grid`.

### Task I18: Add Secondary Section Label

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert legacy/tapestry blocks are introduced by `System links` or `Tapestry proof links`.

**Step 2:** Run Inspect copy test; expect FAIL.

**Step 3:** Add a compact secondary heading before low-level blocks.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): label secondary proof links`.

### Task I19: Rename Debug Layer Label

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert Inspect group sheet excludes `debug layer`.

**Step 2:** Run `node --test --test-name-pattern 'Inspect groups proof detail' workers/quests/src/handler.test.ts`; expect FAIL.

**Step 3:** Replace label with `proof layer` or `details`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): rename debug label`.

### Task I20: Rename Back Path Label

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert sheet label is `related page` or `return path`, not `back path`.

**Step 2:** Run Inspect group sheet test; expect FAIL.

**Step 3:** Rename label while preserving value.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify return path label`.

### Task I21: Rename Trace Action Label

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert sheet excludes `trace action`.

**Step 2:** Run Inspect group sheet test; expect FAIL.

**Step 3:** Rename to `how to use this`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify trace label`.

### Task I22: Move Source Row Lower In Sheets

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert proof meaning rows precede source/provenance rows in group sheets.

**Step 2:** Run Inspect group sheet test; expect FAIL.

**Step 3:** Reorder `openInspectGroupSheet()` key/value rows.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): prioritize proof sheet meaning`.

### Task I23: Reorder Freshness Detail Rows

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert freshness sheet order is stale state, derived time, threshold, refresh route, then provenance.

**Step 2:** Run freshness Inspect sheet test; expect FAIL.

**Step 3:** Reorder rows in `inspectGroupDetailRows().freshness`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): order freshness details`.

### Task I24: Reorder Live Proof Detail Rows

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert blocked count and next human action precede command/source rows.

**Step 2:** Run live-proof Inspect sheet test; expect FAIL.

**Step 3:** Reorder rows in `inspectGroupDetailRows()['live-proof']`.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): order live proof details`.

### Task I25: Clarify Branch Packet Missing Diagnostics

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert missing branch packets explain what Mission lacks.

**Step 2:** Run branch packet Inspect test; expect FAIL.

**Step 3:** Update branch-packets detail rows.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify packet gaps`.

### Task I26: Clarify Gates Detail Rows

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert Gate detail rows explain Telegram proof before auth/idempotency.

**Step 2:** Run gates Inspect sheet test; expect FAIL.

**Step 3:** Reorder/reword gates rows.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify gate proof details`.

### Task I27: Clarify Tools Detail Rows

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert Tools detail rows start with command availability and safe use.

**Step 2:** Run tools Inspect sheet test; expect FAIL.

**Step 3:** Reorder/reword tools rows.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): clarify toolbelt proof details`.

### Task I28: Trim Surface Contract Sheet

**Files:**
- Modify: `workers/quests/src/page.ts`
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert surface contract sheet is compact and scene-coverage focused.

**Step 2:** Run surface-contract Inspect sheet test; expect FAIL.

**Step 3:** Reduce rows to scene, role, proof link, and status summary.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `fix(tg-inspect): compact surface contract details`.

### Task I29: Add First-Viewport Jargon Audit

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Add test that first Inspect viewport copy excludes accidental `operator map`, `R3F`, `schema`, `envelope`, `contract`, unless inside secondary/sheet details.

**Step 2:** Run `node --test --test-name-pattern 'Inspect first viewport jargon' workers/quests/src/handler.test.ts`; expect FAIL until copy cleanup lands.

**Step 3:** Implement dependent copy tasks.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit with final Inspect copy bundle.

### Task I30: Add Header Legacy Rejection Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert visible Inspect heading/sheet copy rejects `operator map`.

**Step 2:** Run focused test; expect current result to document any hidden reference.

**Step 3:** Remove visible legacy copy if needed; internal compatibility aliases may remain.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `test(tg-inspect): reject legacy map copy`.

### Task I31: Add Proof CTA Click Test

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Test clicking `data-inspect-summary` opens proof details without requiring scroll.

**Step 2:** Run focused proof summary test; expect PASS or FAIL depending current wiring.

**Step 3:** Repair selector or CTA order if needed.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit `test(tg-inspect): prove first proof action`.

### Task I32: Add Group Ordering Regression

**Files:**
- Modify: `workers/quests/src/handler.test.ts`

**Step 1:** Assert group IDs appear in founder-readable order.

**Step 2:** Run Inspect ordering test; expect FAIL until I06 lands.

**Step 3:** Implement I06.

**Step 4:** Re-run focused test; expect PASS.

**Step 5:** Commit with I06.

### Task I33: Update Inspect Viewport Capture Intent

**Files:**
- Modify: `workers/quests/src/visual-viewport-proof.mjs`
- Modify: `docs/plans/assets/tg-miniapp-viewport-proof/README.md`

**Step 1:** Update Inspect primary screenshot intent to prove proof hierarchy, not tapestry breadth.

**Step 2:** Run `npm run proof:tg-viewport:diagnose`; expect browser available or documented diagnostic.

**Step 3:** Run `npm run proof:tg-viewport`.

**Step 4:** Inspect regenerated `inspect-*.png` assets for first-viewport proof order.

**Step 5:** Commit viewport proof updates deliberately.

### Task I34: Update Manifest Expectations

**Files:**
- Modify: `workers/quests/src/live-proof-readiness.test.ts`
- Modify: `docs/plans/assets/tg-miniapp-viewport-proof/manifest.json` if regenerated

**Step 1:** Run `node --test workers/quests/src/live-proof-readiness.test.ts`.

**Step 2:** If FAIL, update expected screenshot names/intents for Inspect hierarchy.

**Step 3:** Re-run the test.

**Step 4:** Confirm `manifest.json` lists Story and Inspect proof artifacts.

**Step 5:** Commit `test(tg-inspect): refresh viewport manifest expectations`.

### Task I35: Preserve Tapestry Sheet Proofs

**Files:**
- Modify: `workers/quests/src/handler.test.ts`
- Verify: `workers/quests/src/page.ts`

**Step 1:** Run all tapestry sheet tests after Inspect hierarchy cleanup.

```bash
node --test --test-name-pattern 'tapestry|source-backed tapestry|freshness tapestry' workers/quests/src/handler.test.ts
```

**Step 2:** If FAIL, repair only sheet routing and proof rows, not first-viewport demotion.

**Step 3:** Re-run focused tests.

**Step 4:** Run `node --test --test-name-pattern 'Inspect|tapestry' workers/quests/src/handler.test.ts`.

**Step 5:** Commit `test(tg-inspect): preserve tapestry proof sheets`.

### Task I36: Run Inspect Phase Gate

**Files:**
- Verify: `workers/quests/src/page.ts`
- Verify: `workers/quests/src/handler.test.ts`

**Step 1:** Run focused Inspect tests.

```bash
node --test --test-name-pattern 'Inspect|inspect|proof summary|tapestry|first viewport' workers/quests/src/handler.test.ts
```

**Step 2:** Run full handler tests.

```bash
node --test workers/quests/src/handler.test.ts
```

**Step 3:** Run validation.

```bash
npm run validate:product-branches
npm run validate
git diff --check
```

**Step 4:** Run viewport proof after screenshots stabilize.

```bash
npm run proof:tg-viewport
```

**Step 5:** Commit `test(tg-inspect): complete inspect clean pass`.

## Final Integration Tasks

### Task F01: Full Copy Leak Scan

Run:

```bash
rg -n "every status derives|real world-state|no fake progress|operator map|source detail|debug layer|trace action|back path" workers/quests/src/page.ts workers/quests/src/handler.test.ts
```

Expected:
- No product chrome hits for footer slogan.
- No primary Story hits for meta terms.
- Any remaining hits are in tests, fixtures, or Inspect/detail sheet assertions.

### Task F02: Full Test Gate

Run:

```bash
node --test workers/quests/src/handler.test.ts
node --test workers/quests/src/live-proof-readiness.test.ts
npm run validate:product-branches
npm run validate
git diff --check
```

Expected: all PASS.

### Task F03: Viewport Proof Gate

Run:

```bash
npm run proof:tg-viewport:diagnose
npm run proof:tg-viewport
```

Expected:
- `story-feed-mobile.png` proves readable branch progress.
- Inspect screenshots prove proof hierarchy before secondary tapestry breadth.
- Manifest remains schema `cambium.tg-viewport-proof-manifest.v1`.

### Task F04: Issue/Plan Trace Note

Add a final PR or commit note mapping:

- Story cleanup to issue #98 and child issues #160-#179.
- Inspect cleanup to issue #99 and child issues #180-#199.
- Shared footer/copy guardrails to the design spec Copy Policy and Testing Plan.

## Execution Handoff

Plan complete and saved to `docs/plans/2026-07-01-tg-miniapp-story-inspect-clean-pass-plan.md`.

Two execution options:

1. **Subagent-Driven (this session)** - Dispatch a fresh subagent per small task cluster, review between clusters, and keep `page.ts` write ownership serialized.
2. **Parallel Session (separate)** - Open a new session with `superpowers:executing-plans` and execute this plan with checkpoints.

Recommended: Subagent-Driven for tests/docs/viewport sidecars, with one primary writer owning `workers/quests/src/page.ts`.
