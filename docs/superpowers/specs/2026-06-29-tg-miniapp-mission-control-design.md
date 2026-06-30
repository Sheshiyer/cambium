# TG Mini App Mission Control Design

Date: 2026-06-29
Status: proposed design
Scope: Cambium Telegram mini app UI flow and visible language

## Context

The Telegram mini app already has useful infrastructure under it: branch story packets, quest ledger state, operator policy, gate queues, proof foldback, Hermes command data, and Plexus/Fabric task reporting. The current UI still exposes those systems as the experience. A founder sees words like scene provenance, source, ecosystem target, R3F mechanics, operator map, rails, organs, contracts, envelope, and read-only proof language before they see the product branch, the mission, the blocker, or the decision needed.

The desired direction is Mission Control first:

- First screen: active branch arcs, current questline, next mission, blockers, proof needed, promotion state.
- Second screen: Gate for approvals and rerolls.
- Commands: operator toolbelt, not the center of the product experience.
- Story and proof remain available, but they stop being the primary reading order.

This design preserves the upgraded infrastructure. It changes what the app says first, not what the proof system knows.

## Design Goal

Make the Telegram mini app feel like a playable founder control surface for Cambium branches. Each branch is a story arc. Each arc has a questline, missions, gates, proof requirements, KPIs, and promotion state. The app should answer, in order:

1. What branch is alive right now?
2. What mission is next?
3. What blocks it?
4. What proof unlocks it?
5. What decision or command can I take?
6. What has changed since the last check?

Architecture details should be inspectable on demand, but they should not be the default language of the app.

## Approaches Considered

### Approach A: Mission Control Shell With Inspector Sheets

This is the recommended path.

Keep the existing ledger, branch story, policy, gate, command, and proof data paths. Add a Mission Control view model and use it as the first scene. Primary cards speak in branch and mission language. Existing source/proof/system details move into sheet sections named "Proof", "Why this is blocked", "Audit trail", or "Packet details".

Trade-off: this touches the most UI copy and render grouping, but it matches the upgraded branch-story infrastructure and fixes the actual product experience.

### Approach B: Copy Polish Only

Rename the current tabs and replace the most visible meta copy while leaving the operator-map structure mostly intact.

Trade-off: faster, but it leaves branch missions scattered across architecture groups. The user would still have to infer the product story from internal sections.

### Approach C: Add A Separate Branches Tab

Leave Quests, Map, Story, Gate, and Commands intact, then add a new Branches surface for product arcs.

Trade-off: lower risk to existing UI, but it makes branch arcs feel like another module instead of the app's core control layer. It also increases navigation weight inside a Telegram viewport.

## Recommended Design

Use Approach A.

The visible app becomes five user-facing scenes while preserving internal route and data contracts:

| Visible scene | Purpose | Current surface reused |
| --- | --- | --- |
| Mission | Branch arcs, active questline, next mission, blockers, proof needed, promotion state | Quests plus branch story sections |
| Gate | Approvals, rerolls, promotion decisions, signed founder actions | Current Gate scene |
| Tools | Commands, shortcuts, Hermes actions, bridge task controls | Current Commands scene |
| Story | Timeline of completed missions, evidence changes, learning beats | Current Story scene |
| Inspect | Proof/audit/debug details for sources, packets, freshness, policy, rails | Current Map/operator-map material |

The implementation can keep internal scene IDs where useful, but the visible labels and primary order should follow the table above.

## Mission Scene

The Mission scene is the first screen and default entry point.

Primary elements:

- Header: "Mission Control" with the active tenant/branch status.
- Active branch rail: one compact card per branch story arc.
- Current questline: stage list for the selected branch.
- Next mission: one dominant card with title, owner, gate, dispatch target, and proof required.
- Blockers: explicit "Blocked by" rows, not generic policy/source rows.
- Proof needed: human-facing requirements tied to proof paths.
- Promotion state: proof-only, supervised branch, autonomous branch, or organ service, shown with caution when not fully promoted.
- KPI pulse: survival and better-than-survival thresholds from the branch packet.

Primary actions:

- Review gate: opens the Gate scene or a gate sheet.
- Copy command: copies the safest relevant command or Hermes tool action.
- Open proof: opens proof/audit sheet for the selected mission.
- Refresh: re-fetches current envelope and reports freshness in product language.

## Gate Scene

Gate becomes the approval table for branch progression.

Visible copy should answer:

- What decision is waiting?
- Which branch or mission does it affect?
- What happens if approved?
- What proof is attached?
- Is the action reversible?

Internal phrases such as signed queue, initData, source route, queue write, idempotency key, and Worker gate queue should move into an audit accordion or sheet row. The primary card should read like a decision, not like an endpoint trace.

## Tools Scene

Commands become the operator toolbelt.

Visible groups:

- Act: commands that move work.
- Ask: commands that retrieve status.
- Report: commands that capture or fold back evidence.
- Coordinate: Hermes/Plexus/Fabric task and handoff commands.

The command sheet can still show exact syntax, but the first line should say what the command does for the mission. Source names such as `paperclipCommandsData`, `curios.self-command-reference`, and gateway labels should be secondary audit rows.

## Story Scene

Story remains a narrative and evidence feed, but it should favor branch progress over raw ledger fallback language.

Visible groups:

- Mission wins: completed mission evidence.
- New signals: branch-relevant changes from Hermes, Paperclip, or Fabric.
- Lessons: durable learning or packet changes.
- Drift: stale, missing, or contradictory information that needs attention.

Copy rule: do not say "story fallback", "served beats", "quest-ledger", or "operator narrative" on primary cards. Those belong in Inspect.

## Inspect Scene

Inspect holds the necessary architecture. It is not a dumping ground; it is the proof/debug layer.

Allowed here:

- Packet source and schema.
- Visual envelope freshness.
- Policy source.
- Bridge and Fabric event sources.
- Branch packet gaps.
- Proof path details.
- R3F/shared visual contract references.
- Mini app surface contract coverage.

Inspect should be reachable from every major card through "Proof" or "Details", but it should not be the first scene.

## Copy Policy

Primary UI must not use these terms unless the user opens Inspect:

- scene provenance
- ecosystem target
- source, when used as a raw implementation label
- R3F
- rail or rails
- organ, unless the product packet explicitly needs an organ route
- contract, schema, envelope
- read-only story row
- no local operator writes
- operator map
- tapestry audit
- paperclipCommandsData
- quest-ledger fallback

Primary UI should prefer:

- Mission
- Branch
- Arc
- Questline
- Next move
- Blocked by
- Proof needed
- Ready for review
- Waiting on evidence
- Promotion state
- Tool
- Report evidence
- Refresh status

The rule is not to hide the architecture. The rule is to put it behind the decision the founder is trying to make.

## Data Flow

The Mission Control surface should derive from existing data rather than inventing a parallel state model.

Inputs:

- `VisualEnvelope.branchStories`
- `VisualEnvelope.ledger`
- `VisualEnvelope.policy`
- `VisualEnvelope.decisionContext`
- `VisualEnvelope.liveProof`
- `VisualEnvelope.sideQuests`
- Gate API rows
- Command data from the existing command surface

New view-model layer:

```ts
type MissionControlView = {
  branches: MissionBranchCard[];
  selectedBranchId: string;
  currentQuestline: MissionQuestStage[];
  nextMission: MissionCard | null;
  blockers: MissionBlocker[];
  proofNeeded: MissionProofRequirement[];
  promotion: MissionPromotionState;
  kpis: MissionKpiPulse[];
  toolbelt: MissionToolShortcut[];
  inspect: MissionInspectLink[];
};
```

This view model can live beside the page renderer or be extracted into a small module during implementation. It should not mutate `QuestInputs`, `VisualEnvelope`, or the packet parser. It is a presentation adapter.

## Error And Empty States

No branch stories:

- Primary: "Mission control is waiting for branch packets."
- Action: show refresh and Inspect link.
- Inspect: show which packet/index field is missing.

Stale envelope:

- Primary: "Last check is stale. Pull to refresh before deciding."
- Inspect: show `derivedAt`, freshness threshold, and refresh route.

Policy blocked:

- Primary: "Blocked by missing proof or founder approval."
- Action: open proof or Gate.
- Inspect: show policy source and raw reason.

Gate unavailable outside Telegram:

- Primary: "Open in Telegram to approve."
- Inspect: show route/auth details.

Live API overwritten by stale refresh:

- Primary: "Branch data disappeared after refresh."
- Inspect: show latest `derivedAt`, missing `branchStories`, and refresh source.
- Implementation note: this must be treated as a pipeline problem, not a UI-only problem, because a scheduled or alternate refresh can erase the branch story layer after deploy.

## Testing And Verification

Implementation should verify the design with:

- Unit tests for the Mission Control view model.
- Contract tests that `branchStories` still reaches the envelope.
- Copy denylist tests or focused assertions that primary UI no longer exposes meta terms.
- Worker tests for root URLs with Telegram query params.
- Mobile viewport proof for Mission, Gate, Tools, Story, and Inspect.
- Live API check proving `branchStories` persists after refresh.
- No-fake-progress scan: blocked proof cannot render as ready.
- No-autonomy-overclaim scan: supervised branch readiness cannot render as autonomous unless promotion data says so.

## Visual Reference

Use the generated mobile reference as the first implementation target:

- Image: `docs/plans/assets/tg-miniapp-mission-control-reference/mission-control-mobile-reference.png`
- Prompt: `docs/plans/assets/tg-miniapp-mission-control-reference/prompt.md`
- Reference notes: `docs/plans/assets/tg-miniapp-mission-control-reference/README.md`
- Modular component map: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/component-map.md`
- Component/state reference: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/01-component-glyph-state-board.png`
- Mobile state-stack reference: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/02-mission-control-state-stack-mobile.png`
- Motion storyboard reference: `docs/plans/assets/tg-miniapp-mission-control-reference/modular-components/images/03-motion-storyboard-mobile.png`

This reference preserves the current deep-teal Telegram mini app shell and Cambium chartreuse/mint palette, while replacing the architecture-first "Quest Log" surface with a Mission-first mobile control view.

## Implementation Boundaries

Do:

- Preserve `questLedger` as the global readiness spine.
- Preserve branch packet source artifacts.
- Preserve Gate as signed founder action path.
- Preserve Commands as typed Telegram/bot action surface.
- Preserve Inspect as architecture/proof visibility.
- Reuse branch mission IDs across UI, gate, and assignment paths.

Do not:

- Replace the ledger with branch stories.
- Flatten branch packets to only a few fields.
- Turn proof-only branches into autonomous claims.
- Hide proof gaps.
- Expose raw source/proof implementation copy on primary cards.
- Add a separate task schema when existing bridge/Fabric assignment can carry branch mission metadata.

## Self Review

- Unfinished-marker scan: no unresolved markers remain.
- Consistency check: Mission first, Gate second, Tools as toolbelt, Story/Inspect secondary.
- Scope check: this is a single UI-flow redesign plan, not a full Cambium/Hermes/Plexus contract rewrite.
- Ambiguity check: primary UI copy and Inspect/debug copy are explicitly separated.

## Approval Gate

If this design is approved, the next step is a writing-plans pass that breaks implementation into tasks:

1. Mission Control view model.
2. Scene/tab relabeling and order.
3. Primary card rendering.
4. Gate copy rewrite.
5. Tools copy rewrite.
6. Story copy rewrite.
7. Inspect sheet consolidation.
8. Copy denylist and viewport proof.
9. Live refresh persistence check for `branchStories`.
