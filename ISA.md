---
project: Cambium
task: "Consolidate lead stack and build durable runtime spine"
effort: advanced
effort_source: context-override
phase: complete
progress: 128/128
mode: interactive
started: 2026-07-13T09:04:49Z
updated: 2026-07-20T18:36:22Z
---

## Problem

Cambium can report green proofs while the founder cannot find the named control because production data, visual fixtures, plans, and GitHub checklists can each carry a different version of operational truth. The July ActionRequest incident exposed the full failure: production served `topic.sourceMessageId`, the renderer expected an enriched `telegram.messageId`, the fixture supplied fields production never supplied, and issue #230 kept instructing a state transition that had already happened.

This is not only a stale-document problem. It is an ownership and feedback problem: runtime contracts, generated proof, human runbooks, repository configuration, cross-repository Telegram routing, milestones, and releases do not currently converge through one machine-checked lifecycle.

The July lead-ecosystem stack added another form of the same problem: seven dependent pull requests describe provider contracts, a read-only Explee observer, marketing capabilities, and a fail-closed renderer, but child branches had no CI rollup and the runtime still lacked canonical lead identity, durable task ownership, reservation/usage accounting, and replay-safe foldback.

## Vision

A future maintainer can begin from current main, run one drift audit, and know which operational facts are canonical, generated, historical, deferred, or blocked. Production-shaped fixtures drive the UI proofs; state-specific controls appear only when valid; plans cannot masquerade as current runbooks; and GitHub milestones, issues, releases, and deployment receipts describe the same state without requiring founder memory.

The surprising outcome is subtraction: fewer checklists and fewer copied constants produce stronger proof because every remaining instruction is derived from a current state machine or protected by a failing test.

For the lead runtime, the corresponding subtraction is that provider breadth becomes declarative. One bounded Iverif capture/enrich run can be replayed without duplicate leads, hidden spend, or provider egress; every higher-risk adapter remains inert until the same durable authority spine proves it is safe.

## Out of Scope

- No removal of authentication, signed-action, secret-redaction, idempotency, or no-fake-progress controls.
- No deletion, reset, stash, cleanup, or rewriting of unrelated local work in the primary checkout.
- No client-facing send, spend, deploy outside Cambium, or Telegram action on the founder's behalf.
- No execution of the nine M7 game-engine issues unless live audit selects go-now.
- No claim that deterministic browser captures substitute for founder-device Telegram evidence.
- No wholesale deletion of historical plans merely because they are old; history must be clearly non-operational or archived.
- No cross-repository runtime change without an explicit owning contract and repository-specific verification.
- No broad provider activation, live paid rendering, automatic engagement, or recurring schedule arming in the lead-runtime milestone.
- No second lead-contract registry alongside the canonical `lead-ecosystem.v1.json`, `lead-ops.v1.json`, and adapter catalogs.

## Principles

- Runtime state outranks issue prose; issue prose must be regenerated or reconciled when runtime state changes.
- Fixtures must be consumers of production contracts, never privileged sources with display-critical fields production does not emit.
- Operational instructions describe state transitions, not one message number, one screenshot, or one remembered click path.
- Historical plans preserve decisions but never function as current runbooks.
- Configuration has one owner; every copy is generated, validated, or rejected.
- Proof is provenance plus freshness plus behavior, not a green command alone.
- Deletion requires classification; dangerous stale instructions are removed, while security boundaries and durable history remain.
- The dirty primary checkout is user property and remains untouched.

## Constraints

- Cleanup changes are authored only in the clean `codex/drift-proof-cleanup` worktree based on fetched `origin/main`.
- The Cloudflare Worker remains the production surface at `curious.thoughtseed.space`.
- Telegram signed actions continue to require valid Mini App `initData`; raw authentication material is never stored.
- `npm test`, focused Worker tests, mobile proof contracts, and docs synchronization remain release gates.
- GitHub mutations are limited to issue #230, the verified Hermes mismatch tracker, M5/M7 hygiene, the cleanup PR, and its release.
- Existing committed visual proof assets remain generated artifacts unless evidence shows their retention itself causes drift.
- ISC identifiers remain stable; refinements use child identifiers rather than renumbering.
- Lead identity and dedupe precede subgraph execution; spend reservations precede metered calls; usage settlement follows provider receipts.
- Durable task state, idempotency keys, receipts, stop rules, and accounting precede recurring schedules.
- Explee read parity remains GET-only and no-spend, with observer authorization separated from provider credentials.

## Goal

Make operational drift mechanically difficult by aligning the ActionRequest runtime contract, renderer, fixtures, tests, runbooks, configuration ownership, GitHub state, and release evidence. The cleanup is complete only when production-shaped tests fail on the exact former mismatch, stale actionable instructions are removed from operational surfaces, deferred roadmap work is explicit, and current main can be released without touching unrelated local work.

For the lead-runtime milestone, land PRs #255–#261 on `main`, obtain a successful CI run for the consolidated main SHA, and ship a tested durable runtime that proves one bounded Iverif Explee capture/enrich path while engagement, media generation, and recurring schedules remain fail-closed.

## Criteria

### Protected execution boundary

- [x] ISC-1: Primary-checkout status digest equals its pre-cleanup digest.
- [x] ISC-2: Primary-checkout stash digest equals its pre-cleanup digest.
- [x] ISC-3: Cleanup branch starts exactly from fetched `origin/main`.
- [x] ISC-4: Existing worktree count is not reduced by cleanup.
- [x] ISC-5: Project-level `ISA.md` exists on the cleanup branch.

### ActionRequest runtime contract

- [x] ISC-6: Public ActionRequest projection serves `topic.sourceMessageId` unchanged.
- [x] ISC-7: Gate route derivation accepts `topic.sourceMessageId` as message provenance.
- [x] ISC-8: Production-shaped Gate markup contains `Clients · topic 804 · message 1068`.
- [x] ISC-9: A queued Gate card visibly names its selected option.
- [x] ISC-10: A queued Gate card visibly names its latest receipt.
- [x] ISC-11: A queued Gate card renders no signed-confirm mutation control.
- [x] ISC-12: A `needs_signed_confirmation` Gate card renders one signed-confirm control.
- [x] ISC-13: A Gate card visibly identifies itself as an ActionRequest.
- [x] ISC-14: ActionRequest details display the source topic and thread.
- [x] ISC-15: ActionRequest rendering exposes no raw Telegram authentication material.

### Fixture and proof parity

- [x] ISC-16: The iVerif fixture contains no display-only `telegram.messageId` enrichment.
- [x] ISC-17: The iVerif fixture contains no manually authored `receiptExpectation` enrichment.
- [x] ISC-18: The iVerif fixture carries message provenance only through `topic.sourceMessageId`.
- [x] ISC-19: The queued proof fixture matches the public ActionRequest row shape.
- [x] ISC-20: Fixture parity validation rejects display-critical fields absent from the public schema.
- [x] ISC-21: Production-shaped tests fail when `sourceMessageId` mapping is removed.
- [x] ISC-22: Production-shaped tests fail when selected-option rendering is removed.
- [x] ISC-23: Production-shaped tests fail when latest-receipt rendering is removed.
- [x] ISC-24: Queued-state tests reject any confirm-action entrypoint.
- [x] ISC-25: Signed-confirmation tests require the confirm-action entrypoint.

### Operational documentation lifecycle

- [x] ISC-26: One canonical Telegram ActionRequest lifecycle runbook exists.
- [x] ISC-27: The canonical runbook maps every ActionRequest state to its valid next action.
- [x] ISC-28: The canonical runbook separates channel provenance from Mini App launch provenance.
- [x] ISC-29: The canonical runbook contains no fixed live message number in an instruction.
- [x] ISC-30: The obsolete June live-proof checklist is absent from active plan surfaces.
- [x] ISC-31: The July implementation plan is explicitly marked historical and non-operational.
- [x] ISC-32: `docs/plans/README.md` defines active, generated, historical, and archived classes.
- [x] ISC-33: Proof-asset documentation states browser captures are not live Telegram proof.
- [x] ISC-34: README links the canonical lifecycle runbook instead of a dated checklist.
- [x] ISC-35: Repository search finds no active instruction to reopen the Mini App from message 1068.

### Configuration ownership and drift detection

- [x] ISC-36: Telegram routing ownership is named in one canonical repository contract.
- [x] ISC-37: Cambium topic constants are validated against the canonical routing contract.
- [x] ISC-38: Hermes topic constants are tracked against the same canonical routing contract.
- [x] ISC-39: The Dev-topic mismatch has one GitHub owner and acceptance contract.
- [x] ISC-40: A local drift-audit command exits zero on current canonical files.
- [x] ISC-41: The drift audit exits nonzero when a production-required field exists only in fixtures.
- [x] ISC-42: The drift audit exits nonzero when an active runbook embeds a fixed ActionRequest state.
- [x] ISC-43: CI runs the drift audit on every pull request.

### GitHub roadmap and lifecycle hygiene

- [x] ISC-44: Issue #230 receives the live queued-state correction.
- [x] ISC-45: Issue #230 is closed as superseded rather than falsely proven.
- [x] ISC-46: M5 milestone state is closed with zero open issues.
- [x] ISC-47: M7 has an explicit execute-now or defer decision.
- [x] ISC-48: Every M7 issue state agrees with the recorded M7 decision.
- [x] ISC-49: Deferred M7 work has a binary restart condition.
- [x] ISC-50: The Hermes routing mismatch tracker links both repositories and exact sources.
- [x] ISC-51: The cleanup pull request links the drift incident and verification evidence.
- [x] ISC-52: GitHub reports zero open cleanup pull requests after merge.

### Verification, deployment, and release

- [x] ISC-53: Focused Worker handler tests exit zero.
- [x] ISC-54: Full `npm test` exits zero.
- [x] ISC-55: Mobile contract proof exits zero at 320, 390, and 430 pixels.
- [x] ISC-56: Documentation synchronization check exits zero.
- [x] ISC-57: CI completes all required checks on the cleanup pull request.
- [x] ISC-58: Production health reports `gateConfigured: true` after deployment.
- [x] ISC-59: Production HTML digest matches the released page digest.
- [x] ISC-60: Released tag resolves exactly to merged cleanup main.

### Anti-criteria

- [x] ISC-61: Anti: cleanup modifies any primary-checkout dirty blob.
- [x] ISC-62: Anti: cleanup removes authentication, idempotency, redaction, or no-fake-progress gates.
- [x] ISC-63: Anti: a fixture can pass UI proof using display-critical fields production never emits.
- [x] ISC-64: Anti: any active instruction asks for a control invalid in the current ActionRequest state.
- [x] ISC-65: Anti: completion claims founder-device proof that was not freshly captured.

### Queued ActionRequest consumption

- [x] ISC-66: Operator listing includes queued ActionRequests alongside generic gate decisions.
- [x] ISC-67: Operator consumption transitions one queued ActionRequest to `consumed`.
- [x] ISC-68: ActionRequest consumption appends one redacted consumption receipt.
- [x] ISC-69: Repeated consumption returns the original idempotent result.
- [x] ISC-70: ActionRequest consumption performs no client-facing send or external mutation.
- [x] ISC-71: Consumed ActionRequests disappear from the active Gate list.

### Additional drift gates

- [x] ISC-72: One runtime routing module owns Cambium chat and topic identifiers.
- [x] ISC-73: Dead `CAMBIUM_PUBLIC_BASE_URL` configuration is removed or wired end-to-end.
- [x] ISC-74: Release automation reports live-readiness separately and never labels it deterministic release proof.
- [x] ISC-75: CI preserves the live-readiness result as an inspectable artifact.
- [x] ISC-76: CI mobile proof includes a production-shaped Gate ActionRequest story.
- [x] ISC-77: R3F release scope contains no hardcoded permanently-open issue list.
- [x] ISC-78: CI installs, tests, and builds the retained R3F application.
- [x] ISC-79: Duplicate generated M7 issue bodies are absent after milestone closeout.
- [x] ISC-80: Anti: UI or API promises operator consumption without an implemented consumer.

### Lead-stack consolidation

- [x] ISC-81: PR #255 reports `MERGED`.
- [x] ISC-82: PR #256 reports `MERGED`.
- [x] ISC-83: PR #257 reports `MERGED`.
- [x] ISC-84: PR #258 reports `MERGED`.
- [x] ISC-85: PR #259 reports `MERGED`.
- [x] ISC-86: PR #260 reports `MERGED`.
- [x] ISC-87: PR #261 reports `MERGED`.
- [x] ISC-88: `origin/main` contains PR #257 head `fc1812c`.
- [x] ISC-89: `origin/main` contains PR #261 head `9a53dcf`.
- [x] ISC-90: Consolidated `main` CI concludes success for its head SHA.

### Explee read parity

- [x] ISC-91: Explee status remains a GET-only observer route.
- [x] ISC-92: Explee need-reply inbox remains a GET-only observer route.
- [x] ISC-93: Explee person thread remains a GET-only observer route.
- [x] ISC-94: Explee optimize projection remains a GET-only observer route.
- [x] ISC-95: Observer authorization rejects the Explee provider key as a read token.
- [x] ISC-96: Explee observer requests cannot create action requests.

### Canonical lead runtime

- [x] ISC-97: The durable schema contains one canonical lead-record table.
- [x] ISC-98: Source identity aliases have a database uniqueness constraint.
- [x] ISC-99: Replaying one source identity returns the same canonical lead ID.
- [x] ISC-100: Conflicting normalized email identities fail closed.
- [x] ISC-101: Source observations persist immutable receipt metadata.
- [x] ISC-102: A declared lead subgraph is validated before execution.
- [x] ISC-103: Stage dependencies execute in topological order.
- [x] ISC-104: A failed stage prevents dependent stages from running.
- [x] ISC-105: One bounded Iverif capture/enrich run persists one canonical lead.
- [x] ISC-106: Replaying the Iverif run produces no duplicate lead.
- [x] ISC-107: The Iverif run records one read-only Explee receipt.

### Spend, tasks, and foldback

- [x] ISC-108: The durable schema contains spend reservation records.
- [x] ISC-109: The durable schema contains provider usage records.
- [x] ISC-110: A metered stage without a reservation fails before adapter invocation.
- [x] ISC-111: One idempotency key cannot reserve spend twice.
- [x] ISC-112: Provider usage cannot exceed its settled reservation.
- [x] ISC-113: A no-spend Explee read settles at zero usage.
- [x] ISC-114: Loop tasks persist pending, running, completed, failed, and stopped states.
- [x] ISC-115: Task claiming is lease-bound and compare-and-set safe.
- [x] ISC-116: Replaying a completed task returns its prior receipt.
- [x] ISC-117: A stop rule prevents the next adapter invocation.
- [x] ISC-118: A completed lead run persists one derived cortex foldback projection.
- [x] ISC-119: Cortex foldback excludes raw lead identity.

### Provider risk and scheduling

- [x] ISC-120: ScrapeGraphAI, getleads, and Explee occupy the lower-risk discover/capture/read adapter tier.
- [x] ISC-121: Apollo enrichment has higher risk than discovery/read adapters.
- [x] ISC-122: Apollo and Composio engagement require approval and spend gates.
- [x] ISC-123: ElevenLabs and Runway are highest-risk gated adapters.
- [x] ISC-124: Recurring schedule arming is false by default.
- [x] ISC-125: Schedule arming fails without durable task state.
- [x] ISC-126: Schedule arming fails without receipt persistence.
- [x] ISC-127: Schedule arming fails without spend accounting.
- [x] ISC-128: Anti: tests and proofs perform zero live paid-provider calls.

## Test Strategy

| ISC range | Type | Binary check | Tool |
|---|---|---|---|
| ISC-1..4, ISC-61 | preservation | before/after digests and worktree count match | `git status`, `git stash list`, `git worktree list`, `shasum` |
| ISC-5 | file | project ISA parses and contains twelve sections | `sed`, `rg` |
| ISC-6 | live API | public row retains source message provenance | `curl` + `jq` |
| ISC-7..15, ISC-62 | DOM contract | production-shaped render includes only state-valid controls and redacted fields | `node --test workers/quests/src/handler.test.ts` |
| ISC-16..20, ISC-63 | schema parity | fixture keys are a subset of public display contract | drift-audit script |
| ISC-21..25 | mutation tests | deliberate contract removal fails focused tests | test assertions and source inspection |
| ISC-26..35, ISC-64 | docs lifecycle | canonical runbook present; stale actionable phrases absent | `rg`, docs audit script |
| ISC-36..43 | configuration | routing sources and CI drift command agree | drift-audit script + workflow inspection |
| ISC-44..52 | GitHub | live issue, milestone, tracker, and PR state matches decision | `gh issue`, `gh api`, `gh pr` |
| ISC-53 | focused test | Worker tests exit 0 | `node --test workers/quests/src/handler.test.ts` |
| ISC-54 | regression | full suite exits 0 | `npm test` |
| ISC-55 | mobile proof | recursive overflow/gesture contract passes | `npm run proof:tg-mobile-contract` |
| ISC-56 | docs | rendered docs match sources | `npm run render-docs:check` |
| ISC-57 | CI | every required PR check succeeds | `gh pr checks --watch` |
| ISC-58 | live health | HTTP 200 and gate configured | `curl /healthz/gate` |
| ISC-59 | provenance | production and released page digests match | `curl`, SHA-256 |
| ISC-60 | release | tag target equals merged main | `git rev-list`, `gh release view` |
| ISC-65 | proof boundary | no fresh founder-device claim appears in evidence | issue/PR text inspection |
| ISC-66..71, ISC-80 | state machine | queued ActionRequest lists, consumes, receipts, deduplicates, and leaves active Gate | focused handler tests |
| ISC-72..73 | config | one imported routing module; no unused Wrangler variable | `rg`, focused tests |
| ISC-74..76 | release/CI | deterministic gates and separate live evidence remain distinguishable; Gate story is captured | workflow tests and CI logs |
| ISC-77..79 | roadmap hygiene | stale issue-number configs and duplicate bodies absent | `rg`, filesystem probe, R3F tests |
| ISC-81..90 | GitHub integration | PR states, head ancestry, consolidated main CI | `gh`, `git` |
| ISC-91..96 | Explee contract | four GET routes and separated fail-closed authorization | focused Worker tests |
| ISC-97..107 | runtime integration | schema, dedupe, DAG order, bounded Iverif replay | migration/store/executor tests |
| ISC-108..119 | accounting and durability | reservations, usage, leased tasks, stop rules, derived foldback | focused runtime tests |
| ISC-120..128 | provider policy | risk order and inert recurring schedules | catalog and scheduler tests |

## Features

- `ProtectedWorktree` | Isolate cleanup and prove unrelated local work unchanged | satisfies ISC-1..5, ISC-61 | depends_on none | parallelizable false
- `ActionRequestContract` | Align public projection, Gate rendering, state controls, selected option, receipt, and provenance | satisfies ISC-6..15, ISC-62 | depends_on ProtectedWorktree | parallelizable false
- `FixtureParity` | Remove fixture-only enrichments and add production-shape failure tests | satisfies ISC-16..25, ISC-63 | depends_on ActionRequestContract | parallelizable false
- `DocsLifecycle` | Replace dated actionable checklists with one state-driven runbook and lifecycle policy | satisfies ISC-26..35, ISC-64 | depends_on FixtureParity | parallelizable true
- `RoutingGovernance` | Name canonical Telegram routing ownership and automate mismatch detection | satisfies ISC-36..43 | depends_on FixtureParity | parallelizable true
- `GitHubHygiene` | Correct #230, close M5, decide M7, and track Hermes mismatch | satisfies ISC-44..52 | depends_on DocsLifecycle, RoutingGovernance | parallelizable false
- `ReleaseProof` | Run the complete verification, merge, deploy, and publish aligned release evidence | satisfies ISC-53..60, ISC-65 | depends_on all prior features | parallelizable false
- `ActionRequestConsumption` | Implement the bounded queued-to-consumed lifecycle already promised by the public contract | satisfies ISC-66..71, ISC-80 | depends_on ActionRequestContract | parallelizable false
- `AdditionalDriftGates` | Remove dead config, strictify release proof, cover Gate in CI, and retire R3F issue mirrors | satisfies ISC-72..79 | depends_on FixtureParity, RoutingGovernance | parallelizable true
- `LeadStackConsolidation` | Merge the seven reviewed PRs and prove consolidated main | satisfies ISC-81..90 | depends_on AdditionalDriftGates | parallelizable false
- `ExpleeReadParity` | Preserve four GET observers and hardened credential separation | satisfies ISC-91..96 | depends_on LeadStackConsolidation | parallelizable false
- `CanonicalLeadRuntime` | Persist identity, dedupe, observations, and execute one bounded subgraph | satisfies ISC-97..107 | depends_on ExpleeReadParity | parallelizable false
- `LeadAuthoritySpine` | Reserve spend, settle usage, lease tasks, stop safely, and fold back derived learning | satisfies ISC-108..119 | depends_on CanonicalLeadRuntime | parallelizable false
- `ProviderRiskAndScheduling` | Declare adapter risk and keep recurring schedules inert | satisfies ISC-120..128 | depends_on LeadAuthoritySpine | parallelizable false

## Decisions

- 2026-07-13 09:04: Cleanup uses the existing clean worktree based on `origin/main`; the primary dirty checkout is a protected read-only source.
- 2026-07-13 09:04: E5 Interview completed from explicit conversation evidence: broken state is stale operational truth; durable principle is runtime contracts over prose; anti-goal is another manual checklist; done means CI rejects the same drift class.
- 2026-07-13 09:04: The E5 256-ISC floor is intentionally not manufactured. Sixty-five atomic probes cover the actual bounded surfaces; further splitting would create ceremony rather than independent failure signals.
- 2026-07-13 09:04: Historical plans are classified, not blindly deleted. Only dangerous actionable instructions leave active surfaces; durable decision history remains marked non-operational.
- 2026-07-13 09:04: Issue #230 may be closed only as superseded by observed queued state, never as successful fresh founder-device proof.
- 2026-07-13 09:08: CheckCompleteness passed all hard E5 gates: twelve sections present, Interview recorded, 65 unique criteria, five anti-criteria, and no experiential antecedent required for this verifiable operational goal.
- 2026-07-13 09:07: refined: Multi-angle, first-principles, iceberg, fishbone, and scientific analysis converged on three levers: production-shape parity, document lifecycle classification, and explicit configuration ownership. Deleting old files or patching the renderer alone cannot satisfy the Goal.
- 2026-07-13 09:09: refined: Repository audit found no ActionRequest operator consumer although live copy promises one. ISC-66..71 and ISC-80 now require an idempotent queued-to-consumed path with no external side effect.
- 2026-07-13 09:09: refined: Audit expanded the drift surface to dead Wrangler config, non-strict release readiness, missing Gate CI capture, stale R3F issue-number policy, and duplicate generated issue bodies. ISC-72..79 cover these structural sources.
- 2026-07-13 09:35: Advisor review selected durable-ID consumption over a source-message shortcut. `topic.sourceMessageId` remains provenance; the operator consumes a queued ActionRequest by its own ID without a Telegram side effect.
- 2026-07-13 09:35: Architecture review separated deterministic release qualification from live founder-device evidence. A blocked live-readiness report is preserved and visible, but it cannot invalidate deterministic release proof or masquerade as live proof.
- 2026-07-13 09:35: M7 is retired rather than re-executed. Implemented issues will close after the cleanup CI gate passes; the partial settings issue is deferred with a binary restart condition based on a fixed human-reference acceptance gap.
- 2026-07-13 09:35: Hermes owns the future canonical Telegram routing manifest under issue Sheshiyer/hermes-aws-ts#88. Cambium pins the current source commit and validates its local runtime snapshot until that manifest exists.
- 2026-07-13 10:26: Protected CI run `29242583053` passed the settled-touch contract on Linux. M5 closed empty; M7 closed with eight completed slices and settings issue #47 retired `not planned` behind its fixed-reference, binary-acceptance restart condition.
- 2026-07-13 10:43: v0.2.8 is released and Worker version `a46651f5-972c-4999-8ed2-e886cd77f1f7` is production-proven. Deterministic release is complete; founder-device Telegram evidence remains a separate live-readiness blocker, not cleanup debt.
- 2026-07-13 10:47: `archive/m5-phase-q-local` remains intact as the recovery boundary for seven Phase Q commits. Its tagged tip tree equals merged remote-main commit `a6c39cd`, so that historical local line is intentionally preserved but excluded from v0.2.8 runtime scope.
- 2026-07-20 17:48: refined: The lead-runtime milestone extends the project ISA at stable IDs ISC-81..128; it does not replace the completed 80-criterion drift milestone.
- 2026-07-20 17:50: Advisor selected serial original-PR merges over a synthetic consolidation PR to preserve review linkage and rollback granularity. A disposable full-stack merge passed 913 tests, the 407-file standalone audit, and standalone smoke before GitHub mutation.
- 2026-07-20 17:55: PRs #255..261 merged with merge commits in dependency order. The first consolidated main CI failed because the proof-helper test reached a missing Wrangler prerequisite before input-validation assertions; this is now the release-blocking ingestion-order defect.
- 2026-07-20 17:56: Root-cause-at-ingestion checkpoint — unsafe lead execution enters when a task exists without canonical identity, durable ownership, and a spend reservation. The runtime fix belongs at task creation and adapter invocation, not in output post-processing.
- 2026-07-20 18:28: Independent review blocked the first runtime draft on ambiguous lease replay and caller-authored foldback metrics. Expired takeovers now reconcile only from a durable observation or fail before provider replay; foldback inputs are reduced to identity and all metrics derive from a DB-validated completed receipt.
- 2026-07-20 18:34: PR #262 merged the reviewed runtime as `6c5c5fdbed3c5b419386db4a679b43923b9403d9` after exact-head PR CI run `29768161661` passed all deterministic release gates.
- 2026-07-20 18:36: Consolidated-main CI run `29768331726` passed for merge SHA `6c5c5fdbed3c5b419386db4a679b43923b9403d9`; ISC-90 is satisfied and the 128-criterion lead-runtime milestone is complete.

## Changelog

- 2026-07-13 | conjectured: Fresh proof screenshots and a page digest were sufficient to keep the Telegram closeout instructions trustworthy
  refuted by: production served a queued ActionRequest through `topic.sourceMessageId` while the renderer fixture depended on extra `telegram.messageId` and the open issue still requested the earlier confirmation state
  learned: proof freshness must cover the runtime data shape and state transition, not only the page source and viewport geometry
  criterion now: ISC-16..25 enforce production-shaped fixture parity and state-specific controls; ISC-44..45 require an honest superseded closeout
- 2026-07-13 | conjectured: A focused mobile proof could avoid canonical drift by withholding only the manifest write
  refuted by: the focused proof still overwrote canonical PNGs, allowing screenshots and their manifest metadata to diverge
  learned: canonical proof requires both output-path isolation and per-artifact content binding
  criterion now: ISC-40 and ISC-76 include ignored focused captures plus SHA-256 verification for every canonical PNG
- 2026-07-13 | conjectured: One synthetic touch dispatch was deterministic enough for the release gate
  refuted by: one full release run produced zero branch-rail scroll under both Chrome headless modes
  learned: retrying the real gesture is valid stabilization; setting the success state programmatically is not
  criterion now: ISC-55 requires bounded real-touch retries followed by the same isolation and hit-test assertions
- 2026-07-13 | conjectured: Generated organ docs could remain deterministic while reading ambient sibling repositories
  refuted by: cleanup PR CI rendered five pages differently because a clean checkout has no sibling organ trees
  learned: cross-repository inventory must be an explicit refresh into a committed snapshot, never an implicit release input
  criterion now: ISC-56 checks pages rendered exclusively from `docs/organs/source-snapshot.json`; `render-docs:refresh` is the bounded cross-repository update path
- 2026-07-13 | conjectured: A bounded real-touch retry plus a production touch handler was sufficient to prove branch-rail motion
  refuted by: Chrome delivered one touch start and seven moves across 96 pixels, but proximity snapping returned the rail to zero before the assertion
  learned: interaction proof must observe the settled user-visible state; a self-defeating snap rule can hide after valid event delivery
  criterion now: ISC-55 requires stable settled scroll plus unchanged scene, sheet, and track state before the hit-tested branch tap
- 2026-07-13 | conjectured: A clean main worktree made R3F contract synchronization deterministic for release
  refuted by: ignored `.operator/branch-loops` state changed the generated quest summary while CI, which had no local runtime state, stayed green
  learned: ignored runtime state must never become an implicit generated release input; local ledger refresh is an explicit reviewed operation
  criterion now: ISC-78 includes deterministic R3F contract sync plus `sync:contracts:refresh` as the only operator-ledger import path
- 2026-07-13 | conjectured: The one-line workflow command escaped Node's codename expression safely
  refuted by: release run `29243290350` passed every deterministic gate and uploaded live readiness, then Bash rejected the escaped command substitution before GitHub Release creation
  learned: release metadata plumbing needs a tested multiline shell contract just like build and proof steps
  criterion now: ISC-60 includes shell-safe codename resolution before an existing tag can become a published GitHub Release
- 2026-07-20 | conjectured: Green stacked branches and complete local release gates were sufficient evidence that the consolidated main head would pass CI
  refuted by: consolidated-main run `29765512088` failed because the marketing-create proof test depended on ambient Wrangler availability before reaching its input-validation assertions
  learned: portable tests must supply their own tool fixture and prove wrong-version behavior fails closed; local tool installations are not release evidence
  criterion now: ISC-90 requires a successful consolidated-main CI head, with the hermetic Wrangler fixture exercised by the same deterministic release workflow

## Verification

- Primary checkout preservation: status digest `eed44f76e58b130fbbb25849421cc93a56662feb143096dec17fcdb306669460` and stash digest `b45c285aa8d1d51b4df0b41cdfd7b0e2e803bdb50c2950c996449874859d7627` match their pre-cleanup values; six worktrees remain.
- Branch provenance: cleanup and merge-base both resolve to fetched `origin/main` `84f616152f05885369b97a18c8ac4318bb21b23a`.
- Runtime and drift: focused Worker, routing, readiness, release-contract, standalone-audit, and mutation tests pass. Deliberate production-shape, fixed-instruction, touch, and PNG-digest failures were observed before their implementations passed.
- Canonical browser proof: 38 captures pass (27 layout, 11 clickability), PAGE SHA-256 `db1351564dd64741582ea8888698de663dcd005105ac0d856b0c6b2b3e97a77c`; the manifest binds every canonical PNG to its current SHA-256 and focused runs write only ignored diagnostics.
- Deterministic release verification passes: 702 core tests, six CI mobile stories including settled real touch drag and a hit-tested queued ActionRequest proof tap, 52 R3F tests, R3F build, docs synchronization, standalone audit, smoke, and drift audit.
- GitHub: Cambium #230 is closed `not planned` with the queued-state correction; Hermes #88 owns the cross-repository routing manifest. M5 and M7 are closed with zero open issues. Cleanup PR #235 and drift follow-ups #236 and #237 are merged; GitHub reports zero open pull requests.
- Cleanup CI run `29240965478` correctly failed ambient generated-doc synchronization; run `29241191160` then passed docs and 700 tests but exposed branch-rail snap-back after genuine touch delivery. The committed snapshot and settled-scroll contract now pass 701 core tests and the complete local release gate.
- Protected CI run `29242583053` passed at `d829dbb1e712065304c6aee5041d906b9a0d1372` and uploaded `tg-miniapp-live-readiness-ac3d2568f858588b949f0221876b7f48e9ec08ec`; the artifact remains blocked evidence, not founder-device proof.
- The first v0.2.8 release attempt stopped before package mutation because ignored local `.operator` state changed R3F output and the worktree lacked R3F dependencies. After dependency installation and the explicit-refresh guard, the complete deterministic release gate passes locally with 52 R3F tests while `.operator/branch-loops` remains present.
- Release: annotated tag `v0.2.8` resolves to guarded release commit `977ca2fff790ec4e1ace1bb88ef84af29b1850c1`; GitHub Release `v0.2.8 · Thalia .8` published after successful workflow run `29243540695`, whose separate live-readiness artifact remains blocked.
- Deployment: Cloudflare Worker version `a46651f5-972c-4999-8ed2-e886cd77f1f7` is live. Both `curious.thoughtseed.space` and the workers.dev endpoint report `gateConfigured:true`, return `401` for missing Telegram `initData`, and serve HTML SHA-256 `db1351564dd64741582ea8888698de663dcd005105ac0d856b0c6b2b3e97a77c`, exactly matching the released PAGE digest.
- Rollback: `workers/quests/DEPLOY.md` now restores only from a previous known-good tag in an isolated clean clone, records Wrangler's replacement version, repeats health/auth/digest probes, and explicitly excludes persistent data rollback from an older-code redeploy.
- Proof boundary: no fresh founder-device Telegram proof is claimed. Fresh `initData` and a current founder-device artifact remain separate live-readiness blockers.
- ISC-91: focused Worker test — `IVerif status exposes live one-writer conflict while remaining send-ineligible` passed.
- ISC-92: focused Worker test — `IVerif inbox and thread routes preserve opaque state without enabling replies` passed.
- ISC-93: focused Worker test — `IVerif thread route emits only digest-shaped message references or null` passed.
- ISC-94: focused Worker test — `IVerif optimize combines grounded experiment and live analytics without thread content` passed.
- ISC-95: focused Worker test — `IVerif observer requires its dedicated configuration and rejects broad bridge auth` passed.
- ISC-96: focused Worker test — `IVerif observer reads never create ActionRequests` passed; the 288-test observer/handler suite reported zero failures.
- ISC-120: adapter catalog validation — `lead adapters are registered in the requested increasing-risk order` passed with Explee, ScrapeGraphAI, and getleads in the first tier.
- ISC-121: adapter catalog validation — `apollo-enrichment@1.0.0` is risk order 40 after the three lower-risk adapters.
- ISC-122: adapter catalog validation — Apollo and Composio engagement both require approval, reservation, usage settlement, and receipts.
- ISC-123: adapter catalog validation — ElevenLabs and Runway are orders 70 and 80 and carry explicit provider side-effect authority while disabled.
- ISC-124: adapter catalog validation — `recurring_schedule.armed` and every adapter `schedule_enabled` remain `false`.
- ISC-125: scheduler policy test — omission of `durable_task_state` returns `allowed: false`.
- ISC-126: scheduler policy test — omission of `provider_receipts` returns `allowed: false`.
- ISC-127: scheduler policy test — omission of `spend_accounting` returns `allowed: false`.
- ISC-128: focused catalog/composition tests — 33 tests passed using local JSON and injected data only; no provider client is imported or invoked.
- ISC-97: schema and migration test — `lead_records` exists once in migration `0006` and the canonical bridge schema.
- ISC-98: database constraint test — `(tenant_id, provider_id, source_id)` is unique in `lead_source_aliases`.
- ISC-99: store test — source-alias replay returns the original lead ID; deterministic-ID crash repair also passes.
- ISC-100: store test — normalized-email collision returns `normalized_email_conflict` and persists no second lead.
- ISC-101: database trigger test — GET observation updates and deletes both fail with `immutable`.
- ISC-102: executor test — bounded DAG validation rejects duplicate, missing, cyclic, and oversized graphs before execution.
- ISC-103: executor test — `discover`, `capture`, and `enrich` execute in deterministic topological order.
- ISC-104: executor test — a failed capture records enrich as `dependency_not_completed` without invoking it.
- ISC-105: runtime and handler tests — one admin-only IVerif run persists exactly one canonical lead and one alias.
- ISC-106: runtime and handler tests — terminal replay returns the same lead ID with no second inbox/thread call or duplicate record.
- ISC-107: runtime test — the persisted Explee observation is method `GET`, provider `explee-public-api`, and source `person-a`.
- ISC-108: schema test — `lead_spend_reservations` is present in migration and canonical schema.
- ISC-109: schema test — `lead_provider_usage` is present in migration and canonical schema.
- ISC-110: executor test — a metered stage without `reservationId` returns `spend_reservation_required` before its adapter function runs.
- ISC-111: store test — a repeated reservation idempotency key returns the original reservation; semantic drift conflicts.
- ISC-112: schema and store tests — usage above reservation is rejected and settled reservation identity is immutable.
- ISC-113: bounded IVerif test — reservation, settlement, usage, and operator receipt all record zero spend units.
- ISC-114: store tests — pending, running, completed, failed, and stopped states are persisted and terminal states are immutable.
- ISC-115: store test — active claims return busy, expired takeover increments fencing, and a stale fence cannot complete.
- ISC-116: runtime test — completed-task replay returns the persisted receipt with `replayed: true` and no provider call.
- ISC-117: executor/runtime tests — stop is checked before adapter invocation and persists `stopped` with zero observer calls.
- ISC-118: runtime test — one completed task records exactly one immutable numeric `lead_cortex_foldbacks` row.
- ISC-119: schema test — foldback columns contain no email, phone, alias, source ID, lead ID, identity, payload, or text field.
- ISC-115: adversarial replay test — an expired lease with a persisted observation finishes without provider reads; one without an observation fails `lead_run_reconciliation_required` before provider access.
- ISC-118: adversarial derivation tests — caller-supplied and direct-SQL poisoned foldbacks fail; valid foldback metrics and time are derived from the immutable completed receipt.
- ISC-90: PR CI run `29768161661` passed on exact runtime head `bccf7a88c7e1c06025fe40080991a0e3a3008b34`; consolidated-main push run `29768331726` then passed on merge SHA `6c5c5fdbed3c5b419386db4a679b43923b9403d9`.
- Final deterministic release evidence: 937 core tests, the 416-file standalone audit, standalone smoke, Telegram mobile proof, 52 R3F tests, and the R3F production build all passed in GitHub CI. Paid engagement/media adapters and every recurring schedule remain disabled; no live paid-provider call was made.
