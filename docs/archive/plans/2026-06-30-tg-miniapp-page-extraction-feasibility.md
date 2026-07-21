# TG Mini App · `page.ts` Mission Control Extraction Feasibility (TG-MC-407)

## 1. Status

Feasibility investigation only — no code changes. **Verdict: DEFER (with a thin partial-extraction escape hatch).** The render helpers and `buildMissionControlView` are deeply welded to page-scope globals (`RM`, `ECOSYSTEM_ENV`, `PARAMS`, `MISSION_BRANCH_FOCUS`, `TENANT`, `TOOL_FOCUS`, `TOOL_CONTEXT_BRANCH`) and to the `handler.test.ts` runInContext harness that asserts everything exists on the same `context` bag. The markers-as-extraction contract pinned in TG-MC-405 already satisfies the audit lane; a real module split is a P3 refactor whose cost (test-harness rewrite + Worker bundle re-plumbing) does not pencil out against the lock-zone reduction it would buy. The one safe carve-out is a tiny leaf-helper module of pure functions (no `RM`, no DOM, no `$`) — that is "partial" and is sketched in §8.

## 2. Candidate functions

All line numbers from `workers/quests/src/page.ts` at HEAD (4046 lines total).

| Function | Lines in `page.ts` | Depends on (globals / helpers) | Called by | Tested via |
|---|---|---|---|---|
| `mcStateKind(raw)` | 723–734 | pure (no globals) | every `mc*` helper, `renderMissionStateStack`, `renderQuestlineTimeline`, gate code | exposed on `rendered.context.mcStateKind`; marker-asserted in `handler.test.ts` :1814 |
| `mcClass(base, state, extra)` | 735–738 | `mcStateKind` | every render helper that emits a `data-state` className | exposed on `context.mcClass` (:1815) |
| `mcGlyphSvg(kind, state, opts)` | 739–744 | `MC_COMPONENT_REGISTRY`, `MC_GLYPH_SVG`, `RM` (line 670), `mcStateKind`, `mcClass`, `esc` | `renderBranchArcRail`, `renderMissionCard`, `renderQuestlineTimeline`, `renderMissionProofNeeded`, `renderMissionStateStack`, component-gallery boards | `context.mcGlyphSvg`; slice assertion at :1843 (`PAGE.slice(PAGE.indexOf('function mcGlyphSvg'), PAGE.indexOf('function mcStateToken'))`) |
| `mcStateToken(state, label)` | 745–748 | `mcStateKind`, `mcClass`, `esc` | every mission render helper | `context.mcStateToken` (:1817) — and the slice boundary above keys off its literal definition |
| `mcPacketDots(count, state, opts)` | 749–755 | `RM`, `mcStateKind`, `mcClass`, `esc` | `mcOrbitProgress`, `mcSignalRail`, `renderMissionCard` | `context.mcPacketDots` (:1820, :1858) |
| `mcOrbitProgress(opts)` | 756–764 | `RM`, `mcPacketDots`, `mcStateKind`, `mcClass`, `esc` | `mcKpiPulse`, `renderMissionCard`, `renderMissionStateStack`, empty-state actions | `context.mcOrbitProgress` (:1818, :1856) |
| `mcSignalRail(opts)` | 765–770 | `mcStateKind`, `mcClass`, `mcPacketDots`, `esc` | `renderMissionCard`, `renderQuestlineTimeline` | `context.mcSignalRail` (:1819, :1857) |
| `buildMissionControlView(env)` | 2495–2565 | `branchEnvelope`, `branchRows`, `branchActiveMission`, `mcText`, `mcBranchId`, `mcOrganMetaForBranch`, `mcMissionState`, `mcBranchEnvelopeStale`, `mcQuestline`, `mcBlockers`, `mcProofNeeded`, `mcKpis`, `mcControls`, `mcShortLabel`, `branchCardState`, `MISSION_BRANCH_FOCUS`, `PARAMS`, `TENANT` | `renderMissionControl`, `handler.test.ts` :2465 (`rendered.context.buildMissionControlView`) | exposed on context — the test pulls it back out to assert view shape |
| `renderBranchArcRail(view)` | 2566–2574 | `mcClass`, `mcGlyphSvg`, `mcStateToken`, `RM`, `esc` | `renderMissionControl` :2658 | DOM/marker assertion via the full `renderMissionControl` path |
| `renderMissionCard(view)` | 2575–2588 | `mcClass`, `mcStateToken`, `mcOrbitProgress`, `mcGlyphSvg`, `mcPacketDots`, `mcSignalRail`, `esc` | `renderMissionControl` :2659 | marker assertion `mc-mission-card` (:1806) |
| `renderQuestlineTimeline(view)` | 2589–2593 | `mcGlyphSvg`, `mcGlyphForQuestStage`, `mcShortLabel`, `mcStateToken`, `mcSignalRail`, `mcQuestlineRailState`, `mcStateKind`, `esc` | `renderMissionControl` :2660 | marker assertion (registry includes `QuestlineTimeline`) |
| `renderMissionBlockers(view)` | 2617–2622 | `mcClass`, `esc` | (currently dead in `renderMissionControl` — note the assembly at :2656 inlines proof but skips this) | not directly asserted; reachable via dead-code path |
| `renderMissionProofNeeded(view)` | 2623–2627 | `mcClass`, `mcGlyphSvg`, `esc` | `renderMissionControl` :2662 | marker `mc-proof-list`/`ProofList` (:1807, :1836) |
| `renderMissionKpis(view)` | 2628–2631 | `mcKpiPulse` (→ `mcOrbitProgress`, `mcKpiBars`, `mcStateKind`, `esc`) | `renderMissionControl` :2665 | marker `mc-kpi-pulse` (:1808); `context.mcKpiPulse` (:1859) |
| `renderMissionActions(view)` | 2632–2636 | `esc` | `renderMissionControl` :2664 | marker `mc-action-row` (:1809) |
| `renderMissionControl(env)` | 2644–2687 | everything above + `$` (DOM helper :669), `buildMissionControlView`, `branchRows`, `resetQuestSummary`, `refresh`, `go`, `openBranchMissionSheet`, `renderCommands`, `TOOL_FOCUS`, `TOOL_CONTEXT_BRANCH`, `cmdsDrawn` (mutates) | `paint(env)` (:4004) — the top-level lifecycle | indirectly via every `renderPageFixtureContext` call (40+ tests) |

## 3. Shared state inventory

| Global | Where defined | Read by | Mutated by | Threading cost |
|---|---|---|---|---|
| `RM` | const :670 (`matchMedia(...).matches`) | `mcGlyphSvg`, `mcPacketDots`, `mcOrbitProgress`, `renderBranchArcRail` | never | Cheap as constructor arg; **but** the test harness sets `matchMedia: () => ({ matches: true })`, so RM is true in fixtures — moving evaluation off page-init breaks that assumption unless the module re-reads from `globalThis.matchMedia` on import. |
| `ECOSYSTEM_ENV` | `let` :939 | every render helper indirectly (via `paint(env)` re-entry on refresh) | `paint(env)` (:4004) writes it before each render | If render helpers move, they must keep receiving `env` by argument only (already true for the candidate set — none read `ECOSYSTEM_ENV` directly). Low cost. |
| `paint(env)` | :4004 | top-level lifecycle — `renderMissionControl` is one branch | n/a | Stays in `page.ts`; the module exports `renderMissionControl(env, deps)` and `paint` calls it. Easy. |
| `fetchSequence` | test-only option (`renderPageFixtureContext` :432, :451) — **not a page.ts global** | the fixture `fetch` closure | n/a | Irrelevant to extraction (lives in test). |
| `PARAMS`, `TENANT`, `MISSION_BRANCH_FOCUS`, `TOOL_FOCUS`, `TOOL_CONTEXT_BRANCH`, `cmdsDrawn` | top-level page state | `buildMissionControlView` and `renderMissionControl` | mutated by `renderMissionControl` (`TOOL_FOCUS = 'ts-status'; TOOL_CONTEXT_BRANCH = ...; cmdsDrawn = false;` at :2686) | Either pass a `pageState` ref bag or expose setters. **This is the real cost** — `renderMissionControl` *writes back* into page state. |
| `$` (DOM `getElementById`) :669 | `renderMissionControl` (`$('stem')`, `$('fill')`, `$('progress')`, `$('here')`) | n/a | Pass as dep, or pass the elements themselves. Annoying but tractable. |

## 4. Test hook impact

`renderPageFixtureContext` (`handler.test.ts` :430) runs the page's inline `<script>` inside `vm.runInContext` with a stitched-together `context` bag, then returns `{ elements, context, fetchCalls, clipboardWrites }`. Test code reaches into `rendered.context.mcOrbitProgress`, `rendered.context.mcSignalRail`, `rendered.context.mcPacketDots`, `rendered.context.mcKpiPulse`, `rendered.context.buildMissionControlView` and calls them directly (see :1856–1859, :2465).

Any extraction must preserve this: the functions must end up bound to the same global object the script evaluates in. Options:

1. **Inline transclusion at bundle time.** Keep `mission-control/*.ts` as source but concatenate into the inline `<script>` so the runInContext sandbox still sees the names at top level. Requires changing the page-builder pipeline; the test slice assertion at :1843 (`PAGE.slice(PAGE.indexOf('function mcGlyphSvg'), PAGE.indexOf('function mcStateToken'))`) further requires the *literal text* `function mcGlyphSvg` to still appear in the bundled output.
2. **Module import inside the script.** The Worker bundles `page.ts` and ships the inline script as a string; there is no runtime ES-module loader at fixture eval time. This option is closed unless we also rewrite the bundler.
3. **Stop testing the helpers via `context`.** Convert :1814–1820 marker checks and :1856–1859 callable checks into module-level unit tests. This is the cleanest end-state but invalidates the regression contract these tests encode (they exist precisely to prove the helpers are wired into the live page script).

Net: option 1 is the only one that does not delete existing coverage, and it requires bundler work that pure code extraction does not.

## 5. Estimated impact

- Leaf helpers (`mcStateKind`, `mcClass`, `mcGlyphSvg`, `mcStateToken`, `mcPacketDots`, `mcOrbitProgress`, `mcSignalRail`): lines 723–770 = **~48 lines** removable, replaced by ~5 import/glue lines.
- View + render helpers (`buildMissionControlView` through `renderMissionControl`, plus `renderMissionStateStack`/`renderMissionStaleNotice`/`renderMissionToolLink` which the contract didn't list but live in the same band): roughly **lines 2495–2687 = ~193 lines**.
- Total removable from `page.ts`: ~240 lines = **5.9 %** of the 4046-line file.
- New module footprint: ~260 lines (240 + dep-injection scaffolding + types).
- Lock-zone reduction: real, but small. `page.ts` would still be ~3.8 KLOC and still own Gate, Tools, Story, scenes, sheets, and `paint`. The contributors blocked by the lock are blocked on those other surfaces too.

## 6. Risk inventory

1. **Test harness breakage.** The `vm.runInContext` model assumes every named helper lives on the eval-time global. Any extraction that does not also keep the original `function name(...)` strings inside the inline `<script>` will fail the marker assertions at :1814–1834 and the slice probe at :1843. Re-tooling the bundler to preserve those strings is more work than the extraction itself.
2. **Page-state write-back.** `renderMissionControl` mutates `TOOL_FOCUS`, `TOOL_CONTEXT_BRANCH`, `cmdsDrawn` (line 2686). Threading these as setters changes the public surface of every call site, and a wrong signature here silently breaks the Tools-from-Mission entry point with no fixture coverage.
3. **`RM` semantics drift.** `RM` is captured once at page-init. If a module re-reads `matchMedia('(prefers-reduced-motion: reduce)').matches` on every call, the fixture's `matchMedia: () => ({ matches: true })` still works, but a real device with a runtime preference change would now respond to it — a behaviour change disguised as a refactor. If the module captures at import time instead, fixtures still pass but Worker cold-start in a non-DOM context (which the Worker runtime is) throws.
4. **Worker runtime semantics.** `page.ts` is currently a single TS file that emits an HTML string with one inline `<script>`. Splitting source into `mission-control/*.ts` does not split the runtime artifact unless the bundler is told to keep them inlined. A naive split that imports at module top-level *inside* the worker's TS will still work, but a split that tries to `import()` at the *browser* script level will not — there is no module loader on the inlined script.
5. **No-op perf regression.** Extra function-call indirection (deps bag, getter functions for `RM`) per render is invisible in benchmark but adds GC pressure on Telegram low-end devices. Plausibly negligible; worth measuring before committing.
6. **Dead-code carry-over.** `renderMissionBlockers` is in the contract list but `renderMissionControl` :2656 does *not* call it. Moving it as-is would freeze that dead path into the new module. Either prune at extraction time (adds review surface) or carry the dead code forward (smells).

## 7. Recommendation

**c. Defer** with one carve-out toward (b) if and only if a contributor independently needs the lock released. Concretely:

- The markers-as-extraction contract (TG-MC-405) is already what `#200`–`#219` closures are signed against. The audit lane has what it needs.
- The real lock-zone problem is not the 240 lines of Mission Control — it is the other 3.8 KLOC. Extracting Mission Control alone does not unblock a parallel Gate/Tools/Story rewrite; those surfaces have their own dense state.
- The honest cost of extraction is bundler work (option 1 in §4) plus a test-harness migration (option 3 in §4), not the line-moving itself. Neither has been scoped.
- TG-MC-407 was filed P3. The investigation confirms P3.

If a contributor lands here later forced to release the lock, the smallest defensible move is the partial sketched below — it carries the lowest risk because the carved-out functions are pure.

## 8. If proceeding: sequencing sketch (partial extraction only)

Order, smallest-blast-radius first. Stop after step 2 unless the bundler work in step 3 has independent funding.

1. **Step 1 — leaf helpers, source-only.** Create `workers/quests/src/mission-control/state.ts` exporting `mcStateKind`, `mcClass`, `esc`. These are pure. In `page.ts`, replace the function bodies with re-exports that the page-builder concatenates back into the inline `<script>` (so the marker and slice tests still see `function mcStateKind` literal text in `PAGE`). Add a unit test file `mission-control/state.test.ts` that calls them directly. Verify: `npm test` and `standalone:audit` still pass; `handler.test.ts` :1814–1815 markers still found.

2. **Step 2 — glyph/orbit/rail helpers.** Add `mission-control/glyphs.ts` with `mcGlyphSvg`, `mcStateToken`, `mcPacketDots`, `mcOrbitProgress`, `mcSignalRail`. These read `RM` and `MC_GLYPH_SVG`/`MC_COMPONENT_REGISTRY`. Two viable shapes: (a) inject `RM` as a factory arg `makeGlyphHelpers({ rm: boolean })` called once at page init; (b) read `matchMedia` lazily inside each helper. Pick (a) — it preserves the captured-once semantics. Same bundling trick: concatenate text back into the inline script so the slice probe at :1843 still finds `function mcGlyphSvg ... function mcStateToken`. Verify: :1856–1859 callable tests still pass.

3. **Step 3 (NOT RECOMMENDED without independent scope) — view builder + render helpers.** `buildMissionControlView` is portable as a pure function over `env` *if* `MISSION_BRANCH_FOCUS`, `PARAMS`, `TENANT` are passed as args. `renderMissionControl` is not portable without addressing the page-state write-back (§6 risk 2). Defer this until Gate or Tools is also being extracted — at that point the page-state bag is being refactored anyway and the marginal cost drops.

Tests required at each step: keep every existing `renderPageFixtureContext` test green; add module-level unit tests for the carved-out functions; add a `standalone:audit` rule that the inline script still defines `mcGlyphSvg`, `mcStateToken`, `buildMissionControlView` (closing the regression that the marker checks today encode).

---

**Audit trail.** Inputs read: `workers/quests/src/page.ts` lines 669–826 and 2495–2687; `workers/quests/src/handler.test.ts` lines 420–484, 1800–1880, 2460–2470. No code modified.
