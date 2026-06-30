### Context
- **Task ID:** `TG-MC-103`
- **Phase:** `p3`
- **Wave:** `w1`
- **Swarm:** `ui`
- **Area:** `frontend`
- **Primary owner agent:** `codex`
- **Execution profile:** `frontend-executor`
- **Quality profile:** `operator-toolbelt-polish`
- **Validation profile:** `copy-denylist + interaction-regression`
- **Memory scope:** `page`
- **Memory URI:** `cambium://tg-miniapp/component-system/tools`
- **Owner role:** `UI / app implementation agent`
- **Estimated hours:** `6`

### Deliverable
Rework Tools from a raw command list into a mission-aware operator toolbelt grouped by `Act`, `Ask`, `Report`, and `Coordinate`. The page should keep exact command syntax available while making the first line of each tool explain what it does for the current branch mission.

### Acceptance
- [ ] Visible heading and nav use `Tools`, not legacy `Commands`.
- [ ] Tool cards are grouped into `Act`, `Ask`, `Report`, and `Coordinate`.
- [ ] Each card has a component glyph/state token matching action type and availability.
- [ ] Primary card copy explains the mission effect before showing exact slash-command syntax.
- [ ] Raw source names such as `paperclipCommandsData` and gateway/debug labels move to detail sheets.
- [ ] Disabled/unavailable tools render as locked or stale, never as ready.
- [ ] Existing copy/click behavior for command syntax remains intact.
- [ ] Tools can deep-link from Mission where a safe command is relevant.

### Validation
- [ ] Extend `workers/quests/src/handler.test.ts` for Tools grouping, copy policy, and click behavior.
- [ ] Run `node --test --test-name-pattern 'tools|command|command chat|copy denylist' workers/quests/src/handler.test.ts`.
- [ ] Regenerate `tools-mobile.png`, `sheet-tools-command-chat-mobile.png`, and any command sheet proof affected.
- [ ] Confirm primary Tools surface does not expose forbidden architecture terms outside detail sheets.

### Dependencies
- Upstream task IDs: `TG-MC-000`, `TG-MC-101`.
- Blocking issues/PRs: Mission primitive/state contract should be stable.
- Contract dependencies: command data envelope, command sheet copy behavior, Telegram haptic/copy handling.

### Execution Envelope
- **Branch:** `swarm/tg-miniapp/p3-w1/ui/TG-MC-103-codex`
- **Worktree:** `.worktrees/TG-MC-103-codex`
- **Memory inputs:** Mission handoff; current command tests; Tools copy policy.
- **Memory outputs:** Tools handoff comment with command validation evidence.
- **Lock-zone files:** `workers/quests/src/page.ts`, `workers/quests/src/handler.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`
- **Allowed edit surface:** Tools renderer, command sheets, Tools tests, Tools viewport proof entries.
- **Explicitly out of scope:** Adding new command backends, changing Hermes/Paperclip command semantics, altering bot routing.

### Completion Protocol
When complete, comment with:
1. summary of Tools page changes,
2. validation evidence and screenshots,
3. linked PR or commit,
4. any command contract deviations,
5. handoff notes for Story/Inspect validation.
