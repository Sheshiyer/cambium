### Context
- **Task ID:** `TG-MC-105`
- **Phase:** `p3`
- **Wave:** `w3`
- **Swarm:** `ui`
- **Area:** `frontend`
- **Primary owner agent:** `codex`
- **Execution profile:** `frontend-executor`
- **Quality profile:** `proof-debug-layer-hardening`
- **Validation profile:** `architecture-copy-containment + viewport-proof`
- **Memory scope:** `page`
- **Memory URI:** `cambium://tg-miniapp/component-system/inspect`
- **Owner role:** `UI / app implementation agent`
- **Estimated hours:** `7`

### Deliverable
Reframe Inspect as the deliberate proof/debug layer for packets, freshness, policy, live proof, gates, tools, rails, and evidence. Inspect may expose architecture vocabulary, but it must organize it as proof detail rather than being the app's primary experience.

### Acceptance
- [ ] Visible page title and nav use `Inspect`, not `Map` or `Operator Map`.
- [ ] Inspect groups are `freshness`, `policy`, `live proof`, `branch packets`, `gates`, `tools`, `rails`, and `evidence`.
- [ ] Existing organ/rail contract cards remain available as proof/debug details.
- [ ] Inspect clearly explains stale envelope, missing branch stories, and live proof blockers.
- [ ] Inspect sheets preserve packet source, schema, visual envelope, policy, bridge/Fabric sources, and proof path details.
- [ ] Mission/Gate/Tools/Story primary cards can link to the relevant Inspect details.
- [ ] The old operator-map copy is removed from primary navigation and only survives as explicit proof detail where needed.
- [ ] Inspect does not make blocked live readiness look complete.

### Validation
- [ ] Extend `workers/quests/src/handler.test.ts` for Inspect grouping and allowed architecture-copy containment.
- [ ] Run `node --test --test-name-pattern 'Inspect|operator map|visual tapestry layer|live proof|branch packets' workers/quests/src/handler.test.ts`.
- [ ] Regenerate Inspect viewport proofs including `inspect-live-proof-mobile.png`, `inspect-policy-gap-mobile.png`, and related inspect screenshots.
- [ ] Run `npm run proof:tg-live-readiness` and confirm remaining founder Telegram blockers stay honest.

### Dependencies
- Upstream task IDs: `TG-MC-000`, `TG-MC-101`, `TG-MC-102`, `TG-MC-103`, `TG-MC-104`.
- Blocking issues/PRs: primary-page copy containment should be stable before final Inspect containment.
- Contract dependencies: visual contract, live readiness receipt, branch packet fixture, policy rows.

### Execution Envelope
- **Branch:** `swarm/tg-miniapp/p3-w3/ui/TG-MC-105-codex`
- **Worktree:** `.worktrees/TG-MC-105-codex`
- **Memory inputs:** Mission/Gate/Tools/Story handoffs; live readiness context; component map.
- **Memory outputs:** Inspect handoff comment with proof/debug screenshot set.
- **Lock-zone files:** `workers/quests/src/page.ts`, `workers/quests/src/handler.test.ts`, `workers/quests/src/live-proof-readiness.test.ts`, `workers/quests/src/visual-viewport-proof.mjs`
- **Allowed edit surface:** Inspect renderer/sheets, Inspect tests, live readiness assertions, Inspect viewport proof entries.
- **Explicitly out of scope:** Declaring live readiness green without Telegram initData and device proof, changing Worker auth, hiding proof blockers.

### Completion Protocol
When complete, comment with:
1. summary of Inspect proof/debug changes,
2. validation evidence and screenshots,
3. linked PR or commit,
4. live readiness boundary notes,
5. handoff notes for final integration/release.
