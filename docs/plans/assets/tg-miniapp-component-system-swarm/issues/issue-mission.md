### Context
- **Task ID:** `TG-MC-101`
- **Phase:** `p2`
- **Wave:** `w2`
- **Swarm:** `ui`
- **Area:** `frontend`
- **Primary owner agent:** `codex`
- **Execution profile:** `frontend-executor`
- **Quality profile:** `component-system-hardening`
- **Validation profile:** `viewport-proof + node:test`
- **Memory scope:** `page`
- **Memory URI:** `cambium://tg-miniapp/component-system/mission`
- **Owner role:** `UI / app implementation agent`
- **Estimated hours:** `8`

### Deliverable
Rebuild the Mission page so it is driven by the Cambium component system rather than placeholder symbols and generic cards. The page must map branch/mission data through `shared/cambium-visual-contract.ts` so each branch, questline stage, state row, proof row, and KPI pulse carries a real organ/glyph/state identity.

### Acceptance
- [ ] `MissionGlyph` variants for `genesis`, `taste`, `build`, `ops`, `cortex`, `arc`, `proof`, and `gate` are real reusable inline SVG/HTML primitives, not one-character placeholders.
- [ ] Branch chips derive their glyph from arc -> organ routing instead of branch index fallback.
- [ ] Questline stages render four to six founder-readable stages with rail-connected `StateToken` markers.
- [ ] `MissionCard` includes a compact branch map/rail texture and active organ signal.
- [ ] `MissionStateStack` renders `selected`, `blocked`, `proof-needed`, and `locked` with distinct state tokens.
- [ ] `ProofList` uses founder-readable proof text; raw route/source/schema copy stays out of the primary Mission page.
- [ ] `KpiPulse` uses orbit rings and packet bars rather than two-letter placeholder circles.
- [ ] `Review Gate` and `Open Proof` remain non-floating and open the correct mission sheets.
- [ ] No blocked/proof-only branch renders as ready, shipped, launched, or autonomous.

### Validation
- [ ] Add/extend `workers/quests/src/handler.test.ts` coverage for organ-driven mission glyphs and state rows.
- [ ] Add a no-placeholder regression check for the old `mcGlyphSvg()` character-only behavior.
- [ ] Run `node --test --test-name-pattern 'Mission scene|Mission Control visual primitives|branch mission sheet' workers/quests/src/handler.test.ts`.
- [ ] Regenerate `docs/plans/assets/tg-miniapp-viewport-proof/mission-control-mobile.png`.
- [ ] Regenerate `docs/plans/assets/tg-miniapp-viewport-proof/mission-actions-mobile.png`.
- [ ] Visually inspect both Mission screenshots against `02-mission-control-state-stack-mobile.png`.

### Dependencies
- Upstream task IDs: `TG-MC-000` contract freeze in the swarm plan.
- Blocking issues/PRs: none at creation.
- Contract dependencies: `component-map.md`, `shared/cambium-visual-contract.ts`, branch-story fixture.

### Execution Envelope
- **Branch:** `swarm/tg-miniapp/p2-w2/ui/TG-MC-101-codex`
- **Worktree:** `.worktrees/TG-MC-101-codex`
- **Memory inputs:** `MEMORY.md` Cambium TG mini app notes; modular component reference images.
- **Memory outputs:** page handoff comment with viewport proof paths.
- **Lock-zone files:** `workers/quests/src/page.ts`, `workers/quests/src/handler.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`
- **Allowed edit surface:** Mission rendering helpers, component primitives, Mission tests, Mission viewport capture entries, Mission proof screenshots.
- **Explicitly out of scope:** Gate queue mutation, Worker signed-action semantics, Hermes command behavior, live Telegram founder proof.

### Completion Protocol
When complete, comment with:
1. summary of Mission visual/component changes,
2. test and viewport proof evidence,
3. linked PR or commit,
4. any contract deviations,
5. handoff notes for Gate and validation swarms.
