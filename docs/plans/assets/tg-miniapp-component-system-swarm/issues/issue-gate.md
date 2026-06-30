### Context
- **Task ID:** `TG-MC-102`
- **Phase:** `p2`
- **Wave:** `w3`
- **Swarm:** `ui`
- **Area:** `frontend`
- **Primary owner agent:** `codex`
- **Execution profile:** `frontend-executor`
- **Quality profile:** `decision-surface-hardening`
- **Validation profile:** `signed-action-safety + viewport-proof`
- **Memory scope:** `page`
- **Memory URI:** `cambium://tg-miniapp/component-system/gate`
- **Owner role:** `UI / app implementation agent`
- **Estimated hours:** `8`

### Deliverable
Rebuild the Gate page as a branch-aware decision chamber using the component-system Gate aperture, warning attention, proof/reversibility rows, and signed-action preflight. The primary view should explain the decision, affected branch/mission, proof attached, consequence, and reversibility before exposing route/idempotency details in sheets.

### Acceptance
- [ ] Empty Gate state uses a component-system chamber with Gate glyph, state stack, and honest no-decision copy.
- [ ] Open Gate rows show branch/mission context, proof attached, approve consequence, reroll consequence, reversibility, and state token.
- [ ] Gate warning states use peach warning aperture/stroke, not success color.
- [ ] Signed approve/reroll action buttons remain Telegram-gated and preflighted.
- [ ] Route, idempotency key, initData, and source details remain in audit/preflight sheets, not primary cards.
- [ ] Gate page includes `GateMissionCard`, `GateStateStack`, `GateOrbitProgress`, `GateActionCard`, and `GateEmptyState` markers.
- [ ] Gate attention animation appears once and rests; reduced-motion mode remains legible.
- [ ] No fake successful Gate copy appears when no founder decision is waiting.

### Validation
- [ ] Extend `workers/quests/src/handler.test.ts` for branch-aware Gate copy and component markers.
- [ ] Run `node --test --test-name-pattern 'gate chamber|empty gate|gate item cards|approve and reroll|signed action' workers/quests/src/handler.test.ts`.
- [ ] Regenerate `gate-empty-mobile.png`, `gate-consequence-mobile.png`, `sheet-gate-approve-preflight-mobile.png`, and `sheet-gate-reroll-preflight-mobile.png`.
- [ ] Run a primary-copy denylist against Gate excluding audit/preflight sheets.
- [ ] Confirm `Review Gate` from Mission opens the Gate-focused branch sheet.

### Dependencies
- Upstream task IDs: `TG-MC-000`, `TG-MC-101`.
- Blocking issues/PRs: Mission component primitives should land first.
- Contract dependencies: signed Gate path, branch mission sheet contract, Gate API rows.

### Execution Envelope
- **Branch:** `swarm/tg-miniapp/p2-w3/ui/TG-MC-102-codex`
- **Worktree:** `.worktrees/TG-MC-102-codex`
- **Memory inputs:** Mission issue handoff; Gate signed-action tests; component motion storyboard.
- **Memory outputs:** Gate handoff comment with preflight proof paths.
- **Lock-zone files:** `workers/quests/src/page.ts`, `workers/quests/src/handler.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`
- **Allowed edit surface:** Gate renderer, Gate sheets, Gate tests, Gate viewport proof entries.
- **Explicitly out of scope:** Changing signed queue storage, Telegram auth validation, backend approval semantics.

### Completion Protocol
When complete, comment with:
1. summary of Gate decision-surface changes,
2. validation evidence and screenshots,
3. linked PR or commit,
4. any contract deviations,
5. downstream notes for Tools/Story/Inspect.
