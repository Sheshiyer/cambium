### Context
- **Task ID:** `TG-MC-104`
- **Phase:** `p3`
- **Wave:** `w2`
- **Swarm:** `ui`
- **Area:** `frontend`
- **Primary owner agent:** `codex`
- **Execution profile:** `frontend-executor`
- **Quality profile:** `mission-narrative-polish`
- **Validation profile:** `copy-denylist + timeline-proof`
- **Memory scope:** `page`
- **Memory URI:** `cambium://tg-miniapp/component-system/story`
- **Owner role:** `UI / app implementation agent`
- **Estimated hours:** `6`

### Deliverable
Rework Story into a branch progress feed with `Mission wins`, `New signals`, `Lessons`, and `Drift` groups. The page should tell what changed for the branch while preserving evidence/provenance details behind sheets or Inspect links.

### Acceptance
- [ ] Story primary groups are `Mission wins`, `New signals`, `Lessons`, and `Drift`.
- [ ] Story beats prioritize branch/mission progress over raw ledger fallback language.
- [ ] Each beat uses component glyph/state treatment for win, signal, lesson, or drift.
- [ ] Stale, missing, or contradictory information renders as drift with non-success state.
- [ ] Primary Story copy does not say `story fallback`, `served beats`, `quest-ledger`, or `operator narrative`.
- [ ] Beat sheets keep source/proof details available without polluting primary cards.
- [ ] Story remains scrollable, touch-friendly, and readable on the mobile viewport.
- [ ] Story links can send the user to relevant Mission, Gate, or Inspect context.

### Validation
- [ ] Extend `workers/quests/src/handler.test.ts` for Story groups and primary-copy denylist.
- [ ] Run `node --test --test-name-pattern 'story|beats|copy denylist|drift' workers/quests/src/handler.test.ts`.
- [ ] Regenerate `story-feed-mobile.png`.
- [ ] Inspect the Story screenshot against the Mission Control component palette and no-overclaim rules.

### Dependencies
- Upstream task IDs: `TG-MC-000`, `TG-MC-101`.
- Blocking issues/PRs: Mission narrative/state language should be stable.
- Contract dependencies: story beat data, branch stories, live proof/stale envelope status.

### Execution Envelope
- **Branch:** `swarm/tg-miniapp/p3-w2/ui/TG-MC-104-codex`
- **Worktree:** `.worktrees/TG-MC-104-codex`
- **Memory inputs:** Mission handoff; Story design copy policy; viewport proof manifest.
- **Memory outputs:** Story handoff comment with feed proof path.
- **Lock-zone files:** `workers/quests/src/page.ts`, `workers/quests/src/handler.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`
- **Allowed edit surface:** Story renderer, beat sheets, Story tests, Story viewport proof entry.
- **Explicitly out of scope:** Changing ledger generation, rewriting narrative source pipelines, adding external event sources.

### Completion Protocol
When complete, comment with:
1. summary of Story page changes,
2. validation evidence and screenshot,
3. linked PR or commit,
4. any narrative contract deviations,
5. handoff notes for Inspect and validation swarms.
