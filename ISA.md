---
project: Cambium
task: "Expose a verifiable branch-to-organ map for Telegram operations"
effort: advanced
effort_source: classifier
phase: complete
progress: 280/280
mode: interactive
started: 2026-07-22T08:55:00Z
updated: 2026-07-23T12:24:00Z
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

### Current consolidation audit

- [x] ISC-129: A baseline records the primary checkout, branches, worktrees, stashes, PRs, and remote main SHA.
- [x] ISC-130: The primary checkout's pre-audit dirty file set and content digests remain recoverable throughout consolidation.
- [x] ISC-131: Every registered worktree has a recorded path, HEAD, branch or detached state, dirty count, and prunable status.
- [x] ISC-132: Every local and remote branch is classified as merged, pending, duplicate, or intentionally preserved against fetched `origin/main`.
- [x] ISC-133: Every open PR has recorded head, base, state, mergeability, and check evidence before mutation.
- [x] ISC-134: PR #254 is verified as the single reviewed child commit stacked on PR #253.
- [x] ISC-135: PR #253's conflict against current `origin/main` is reproduced with the actual merge result, not inferred from prose.
- [x] ISC-136: The unique content in `stash@{0}` is classified file-by-file before any selective recovery.
- [x] ISC-137: Existing stashes remain retained and content-addressable until every candidate is resolved.
- [x] ISC-138: The reviewed IVerif stack is integrated in dependency order on a fresh branch from fetched `origin/main`.
- [x] ISC-139: The integrated IVerif stack preserves fixed bindings, redaction, GET-only provider access, and fail-closed mutation policy.
- [x] ISC-140: Any selectively recovered validator logic passes the repository's product-branch packet validation tests.
- [x] ISC-141: Any recovered live-readiness artifact reports blocked evidence truthfully and never claims founder-device proof.
- [x] ISC-142: Dirty architecture assets are either safely included with provenance or preserved as an explicit excluded candidate.
- [x] ISC-143: Active architecture instructions contain no destructive tag deletion, force-push, or implicit release mutation command.
- [x] ISC-144: The integrated tree passes the full repository test suite before remote merge.
- [x] ISC-145: The post-merge `main` head has a successful required CI run for its exact SHA.
- [x] ISC-146: Current `main` contains every selected reviewed commit and no unreviewed feature commit.
- [x] ISC-147: Open PRs are merged or explicitly closed with a recorded reason, leaving no unresolved selected code path.
- [x] ISC-148: No local or remote branch with unique unclassified code remains after consolidation.
- [x] ISC-149: Only confirmed missing-gitdir worktree records are pruned after their paths are independently verified absent.
- [x] ISC-150: No force-push, stash drop, branch reset, or destructive worktree removal occurs during consolidation.
- [x] ISC-151: Anti: the primary checkout's user-owned dirty blobs change except for explicitly documented ISA edits.
- [x] ISC-152: Anti: any existing stash reference or its content digest disappears without explicit user authorization.
- [x] ISC-153: Anti: a PR is called merged from local ancestry alone without GitHub state and CI evidence.
- [x] ISC-154: Anti: consolidation performs any live Explee/provider mutation or exposes provider credentials.

### Documentation synchronization audit

- [x] ISC-155: The active source inventory identifies the composition/operator plane and the runtime/visual plane.
- [x] ISC-156: The root README names the maintained Worker runtime and R3F visual engine.
- [x] ISC-157: The root README states the fixed, read-only, redacted, send-ineligible IVerif boundary.
- [x] ISC-158: The root README states that Marketing Create is review-only, disabled, and not deployed.
- [x] ISC-159: The root README distinguishes the published v0.3.0 tag from post-tag `main` changes.
- [x] ISC-160: The root README quick start includes composition validation, product-branch validation, and release qualification commands.
- [x] ISC-161: The root README command reference includes compose, Quine, and deterministic release commands.
- [x] ISC-162: The root README documentation table links the current runtime, adopter, release, and architecture surfaces.
- [x] ISC-163: The root package description names the operator, runtime, cortex, and constellation scope.
- [x] ISC-164: Root architecture documentation dates the composition layer to current main and states its gated execution boundary.
- [x] ISC-165: Root architecture documentation lists Worker, R3F, lead, IVerif, and Marketing Create current truth.
- [x] ISC-166: Integration documentation no longer implies that every external organ is a continuously deployed service.
- [x] ISC-167: Release documentation has an explicit unreleased-on-main section after v0.3.0.
- [x] ISC-168: Release-time verification counts remain historical and current-main verification points to the release gate.
- [x] ISC-169: Active current documentation contains no forbidden committed live-readiness path.
- [x] ISC-170: The architecture service inventory enumerates D1, KV, R2, and Vectorize from nested Worker configuration.
- [x] ISC-171: The architecture service inventory includes R3F, provider, adapter, and CI boundaries with status.
- [x] ISC-172: The refreshed architecture HTML exists and links its source-backed current architecture references.
- [x] ISC-173: The refreshed NotebookLM architecture prompt exists and names its source set and safety boundaries.
- [x] ISC-174: The architecture refresh marker is removed only after both reviewed generated assets exist.
- [x] ISC-175: The R3F README describes the maintained Urania constellation surface and its desktop/offline boundaries.
- [x] ISC-176: The adopter runbook describes current local/invite identity behavior and the remaining remote-directory boundary.
- [x] ISC-177: The Quine README is release-neutral and does not describe the current tool as v0.2.0.
- [x] ISC-178: The adapter index links the current lead-runtime and Marketing Create governance docs.
- [x] ISC-179: The technical reference points readers to current architecture/integration docs and labels dated plans historical.
- [x] ISC-180: The completed `.planning` slice is explicitly labeled historical and points to current acceptance surfaces.
- [x] ISC-181: README generation metadata records the current documentation refresh date.
- [x] ISC-182: Active documentation makes no unsupported live-provider, publication, outreach, or recurring-schedule claim.
- [x] ISC-183: Links introduced or changed by the documentation update resolve to repository files.
- [x] ISC-184: The current tree passes the deterministic test, documentation, release, and standalone verification gates.
- [x] ISC-185: Architecture asset status, timestamps, and generated/source-backed provenance agree across ISA and docs.
- [x] ISC-186: Anti: no dated historical plan is rewritten to masquerade as current runtime truth.

### Electron desktop packaging

- [x] ISC-187: The source map identifies R3F/Vite/React as the desktop renderer.
- [x] ISC-188: The source map identifies Electron main, preload, and renderer responsibilities.
- [x] ISC-189: The source map identifies the Worker as an optional remote boundary.
- [x] ISC-190: The supported desktop policy names macOS as the first distribution target.
- [x] ISC-191: The local demo remains offline-capable with synthetic data and no Worker.
- [x] ISC-192: The packaged window policy preserves the 1280×800 minimum desktop viewport.
- [x] ISC-193: Hash routes resolve correctly when the app is packaged locally.
- [x] ISC-194: The packaged app boots without a Vite dev server or preview server.
- [x] ISC-195: Packaged local assets include tapestry JSON, textures, and generated GLBs.
- [x] ISC-196: The Electron renderer enables context isolation explicitly.
- [x] ISC-197: The Electron renderer disables Node.js integration explicitly.
- [x] ISC-198: The Electron renderer enables process sandboxing explicitly.
- [x] ISC-199: The preload bridge exposes only a narrow, documented API surface.
- [x] ISC-200: Renderer code has no direct Node.js or Electron module access.
- [x] ISC-201: Packaged navigation and new-window creation fail closed.
- [x] ISC-202: Optional Worker settings require an explicit governed remote boundary.
- [x] ISC-203: Renderer bundles and packaged files contain no secrets or provider tokens.
- [x] ISC-204: Packaged DevTools access is disabled or explicitly review-gated.
- [x] ISC-205: The renderer and Electron shell share one deterministic build output.
- [x] ISC-206: Root commands expose desktop development, build, test, and distribution flows.
- [x] ISC-207: Electron dependency ownership and lockfile policy are documented.
- [x] ISC-208: Distribution configuration pins app identity, targets, and artifact naming.
- [x] ISC-209: The packaged app has stable product metadata and a documented icon policy.
- [x] ISC-210: A local packaged smoke test proves boot and local asset availability.
- [x] ISC-211: Existing R3F tests and production build remain green after packaging changes.
- [x] ISC-212: The deterministic release verification remains green after packaging changes.
- [x] ISC-213: A macOS unpacked or installer artifact is generated successfully.
- [x] ISC-214: Updates remain explicitly governed and are not auto-enabled without authority.
- [x] ISC-215: CI packaging runs on macOS or records an explicit deferred boundary.
- [x] ISC-216: Root and R3F documentation describe current packaging commands and limits.
- [x] ISC-217: Packaging troubleshooting documents WebGL, GPU, signing, and quarantine paths.
- [x] ISC-218: Anti: no credentials, API tokens, or secret-bearing environment files are bundled.

### Durable Goal Graph authority

- [x] ISC-219: Goal Graph nodes carry desired/current state, scope, owner, next action, proof requirement, review time, status, and provenance.
- [x] ISC-220: External Goal Graph identities are deterministic for tenant, namespace, and external ID.
- [x] ISC-221: Identity-less Goal Graph nodes use deterministic source provenance and content digest without timestamps or input order.
- [x] ISC-222: Goal Graph validation rejects more than one parentless root per tenant.
- [x] ISC-223: Goal Graph validation rejects missing or cross-tenant parent references.
- [x] ISC-224: Pure compilation emits a proposal change-set without mutating graph state.
- [x] ISC-225: Recompiling unchanged input produces byte-equal no-op output.
- [x] ISC-226: Compilation rejects a stale expected graph head before producing a proposal.
- [x] ISC-227: Migration classification covers unchanged, replaced, retired, split, merged, and unmapped lineages.
- [x] ISC-228: Projection envelopes carry origin, graph version, graph digest, tenant, source reference, and payload.
- [x] ISC-229: Goal Graph projections are rejected when presented as fresh authoritative input.
- [x] ISC-230: Split and merged lineages return explicit review-required proof dispositions.
- [x] ISC-231: D1 migration creates tenant graph heads and versioned graph nodes.
- [x] ISC-232: D1 graph events are immutable under update and delete attempts.
- [x] ISC-233: D1 graph nodes enforce one tenant root with a unique partial index.
- [x] ISC-234: D1 commit CAS binds a canonical approved change digest, intent version, approver, and expiry to one graph revision.
- [x] ISC-235: A stale D1 commit produces no node, head, approval, or event mutation, and replay is idempotent.
- [x] ISC-236: Telegram-shaped intent is a total, bounded parser that compiles into a provenance-bound Goal Graph proposal.
- [x] ISC-237: Telegram intent rejects provider routing, credentials, unbounded payloads, projection-shaped inputs, and malformed input without throwing.
- [x] ISC-238: No Telegram or Worker integration is described as complete before its route and receipt tests exist.
- [x] ISC-239: The default repository test command includes Goal Graph contract tests.
- [x] ISC-240: Anti: a generated Goal Graph projection can never re-enter the authoritative writer through a round trip.

### Branch traversal map and Telegram projection

- [x] ISC-241: A canonical branch registry names iverif, fitcheck/getfitcheck, getleads, and explee with explicit alias and evidence status.
- [x] ISC-242: Branch packet metadata and Organ Routing rows compile into stable branch and organ node identities.
- [x] ISC-243: A transition receipt requires tenant, branch, from-node, to-node, organ, status, observed time, source reference, source digest, and evidence references.
- [x] ISC-244: Projection ordering is deterministic and independent of receipt ingest order.
- [x] ISC-245: Lineage validation rejects dangling nodes, cycles, duplicate transition identity, and cross-tenant references.
- [x] ISC-246: Authoritative node status derives from packet and transition evidence; campaign overlays cannot mutate it.
- [x] ISC-247: A branch without a canonical packet renders an explicit unknown or pending gap instead of an invented story.
- [x] ISC-248: Campaign overlays distinguish observed-active, observed-paused, claimed-paused, and unknown with source and freshness.
- [x] ISC-249: Wiki overlays distinguish linked, missing, and stale evidence without becoming lineage authority.
- [x] ISC-250: The branch-map envelope carries schema, projection version, graph/source digest, tenant, generated time, and source reference.
- [x] ISC-251: Telegram branch-map projection is read-only, tenant-scoped, and excludes credentials, raw customer data, and provider mutation controls.
- [x] ISC-252: The mini-app contract exposes a branch-map subsection with read-only sheet semantics and provenance.
- [x] ISC-253: Fixtures cover IVerif and Fitcheck packet paths plus unmapped GetLeads and Explee aliases.
- [x] ISC-254: Focused tests use synthetic receipts and overlays only; no external campaign, wiki, or provider mutation occurs.
- [x] ISC-255: Handler wiring is not described as complete until route, authorization, and receipt tests exist.
- [x] ISC-256: Anti: a generated branch-map projection cannot be accepted as a fresh authoritative branch or transition input.

### D1 receipt-to-Telegram proof slice

- [x] ISC-257: D1 stores branch transition receipts under a tenant-scoped composite identity.
- [x] ISC-258: Receipt writes validate branch, node, graph version, provenance, status, timestamp, and evidence bounds.
- [x] ISC-259: Receipt replay with identical canonical bytes is idempotent and returns the original receipt.
- [x] ISC-260: Receipt replay with semantic drift fails closed without overwriting the original row.
- [x] ISC-261: Receipt identity, provenance, and evidence fields are immutable under update and delete attempts.
- [x] ISC-262: Receipt listing is tenant-scoped, bounded, deterministic, and ordered by observed time then receipt ID.
- [x] ISC-263: D1 migration and canonical schema contain the same receipt table, indexes, and immutability triggers.
- [x] ISC-264: Worker map route requires a valid signed Telegram Mini App initData envelope.
- [x] ISC-265: Worker map route rejects stale, malformed, non-founder, and cross-tenant authentication.
- [x] ISC-266: Worker map route reads Goal Graph head/nodes plus receipts without mutating authority state.
- [x] ISC-267: Worker map route returns the versioned branch-map envelope and projection digest.
- [x] ISC-268: Worker map route returns explicit unavailable or not-found states rather than invented branch data.
- [x] ISC-269: Route responses contain no raw initData, tokens, provider credentials, or customer payloads.
- [x] ISC-270: Telegram map sheet renders bounded branch, organ, receipt, overlay, source, and gap rows.
- [x] ISC-271: Telegram map sheet is deterministic for byte-equivalent projections.
- [x] ISC-272: Telegram map sheet exposes no mutation control or provider action affordance.
- [x] ISC-273: Telegram map sheet preserves authoritative node status separately from campaign/wiki overlays.
- [x] ISC-274: A signed synthetic route fixture reaches D1 receipts, projection, sheet rendering, and digest verification end to end.
- [x] ISC-275: Synthetic signature tampering fails before D1 reads and leaves authority state unchanged.
- [x] ISC-276: Tenant substitution fails before projection and cannot disclose another tenant's receipts.
- [x] ISC-277: Receipt digest, projection digest, and proof digest bind one canonical end-to-end evidence chain.
- [x] ISC-278: Focused D1, route, sheet, and proof tests run without network or live provider calls.
- [x] ISC-279: Live founder-device Telegram proof remains explicitly deferred until a current device capture exists.
- [x] ISC-280: Anti: no route or renderer claims branch traversal complete without persisted receipt evidence.

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
| ISC-129..133 | inventory | baseline and complete branch/worktree/PR evidence | `git`, `gh`, digest script |
| ISC-134..135 | stack diagnosis | child relationship and real conflict reproduction | `gh pr view`, `git merge-tree` |
| ISC-136..143 | preservation/safety | stash classification and safe documentation selection | `git stash`, `git diff`, `rg` |
| ISC-144..146 | integration | tests, CI, and selected commit reachability | `npm test`, `gh run`, `git merge-base` |
| ISC-147..150 | cleanup | PR, branch, worktree, and operation hygiene | `gh`, `git`, filesystem probes |
| ISC-151..154 | anti-probes | no silent loss, destructive mutation, or false merge claim | before/after digests and GitHub evidence |
| ISC-155..162 | README continuity | current capabilities, boundaries, commands, and links agree with source | `rg`, link probe, README review |
| ISC-163..171 | architecture continuity | package, root architecture, integration, and service inventory describe current planes and bindings | `rg`, manifest review |
| ISC-172..174 | generated architecture assets | reviewed HTML/prompt exist, source links resolve, refresh marker is absent | filesystem probe + HTML/link inspection |
| ISC-175..181 | local guide continuity | R3F, adopter, Quine, adapter, technical-reference, planning, and generator metadata are current | `rg`, file review |
| ISC-182..186 | docs safety and release proof | no unsupported live claim, no forbidden readiness path, links resolve, gates pass, history remains historical | `rg`, `npm test`, `npm run verify:release`, `git diff --check` |
| ISC-187..191 | source and stakeholder map | renderer, shell, Worker, macOS, and offline boundaries agree across source and docs | source review + README review |
| ISC-192..195 | packaged runtime | window floor, hash-route renderer, serverless boot, and local asset payload pass | packaged smoke + `desktop:test` |
| ISC-196..204 | Electron security | isolation, sandbox, denied authority, navigation policy, and secret exclusion pass | source assertions + payload scan |
| ISC-205..209 | release configuration | one build output, root commands, lock ownership, metadata, targets, and icon policy agree | package/lock/workflow review |
| ISC-210..215 | release evidence | packaged smoke, regression gates, macOS artifacts, update boundary, and CI path pass | `desktop:smoke:packaged`, `npm run verify:release`, workflow review |
| ISC-216..218 | documentation and anti-probes | packaging docs, troubleshooting, and no-secret bundle rules pass | docs review + `desktop:test` |
| ISC-219..225 | Goal Graph pure contracts | node fields, deterministic identity, roots, compiler proposals, and no-op replay pass | `node --test workers/quests/src/goal-graph/compiler.test.ts` |
| ISC-226..230 | Goal Graph authority boundaries | stale heads, migration classes, projection envelopes, and feedback rejection pass | `node --test workers/quests/src/goal-graph/*.test.ts` |
| ISC-231..233 | Goal Graph D1 schema | heads, nodes, immutable events, and root index parse and enforce constraints | `sqlite3 :memory: < workers/quests/migrations/0007_goal_graph.sql` |
| ISC-234..235 | Goal Graph commit authority | approved CAS commit changes one revision or leaves every table unchanged | D1 store tests with concurrent stale writes |
| ISC-236..237 | Telegram Goal Graph intake | total bounded parser uses canonical hashing/idempotency and rejects authority drift | intake tests; handler route tests remain deferred under ISC-238 |
| ISC-238..240 | integration anti-probes | no unverified route claim and no projection feedback loop remain | `rg`, focused tests, `npm test` |
| ISC-241..243 | branch registry and receipts | named aliases, packet-derived nodes, and provenance-bound transitions parse and validate | branch-map contract tests + packet inventory |
| ISC-244..246 | lineage projection | deterministic fold, cycle/dangling rejection, and status authority remain stable | branch-map unit tests |
| ISC-247..249 | evidence overlays | unmapped branches and campaign/wiki freshness remain explicit and non-authoritative | branch-map fixture tests |
| ISC-250..252 | Telegram surface contract | versioned digest envelope and read-only tenant-scoped subsection are declared | contract tests + mini-app surface inspection |
| ISC-253..256 | branch-map safety | four named aliases are covered without external mutation or projection feedback | focused tests, `rg`, `npm test` |
| ISC-257..263 | D1 receipt authority | append-only tenant-scoped transition receipts validate, replay, list, and match canonical schema | migration/store tests with SQLite D1 fixture |
| ISC-264..269 | authenticated Worker route | signed Telegram auth gates a read-only tenant projection with fail-closed errors and redaction | handler route tests with synthetic initData |
| ISC-270..273 | Telegram map sheet | bounded deterministic read-only rows retain authority/overlay separation and gaps | sheet renderer tests |
| ISC-274..278 | signed end-to-end proof | one synthetic signature binds receipt, projection, sheet, and proof digests; tampering and tenant swaps fail | end-to-end route/store/sheet test |
| ISC-279..280 | live boundary | device proof is deferred and no unsupported completion claim is emitted | ISA/README inspection and anti-probe |

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
- `GitStateInventory` | Capture and classify every branch, worktree, stash, and PR before mutation | satisfies ISC-129..137 | depends_on ProviderRiskAndScheduling | parallelizable true
- `IVerifStackIntegration` | Resolve and verify the reviewed child/parent PR stack on current main | satisfies ISC-134..139, ISC-144..146 | depends_on GitStateInventory | parallelizable false
- `PendingArtifactRecovery` | Selectively recover unique safe stash content and sanitize active generated instructions | satisfies ISC-136, ISC-140..143 | depends_on GitStateInventory | parallelizable true
- `GitHubAndWorktreeCloseout` | Merge selected work, classify residual refs, and prune only stale records | satisfies ISC-147..150 | depends_on IVerifStackIntegration, PendingArtifactRecovery | parallelizable false
- `PreservationProof` | Prove primary dirt, stashes, safety boundary, and no live provider mutation | satisfies ISC-130, ISC-151..154 | depends_on GitStateInventory, GitHubAndWorktreeCloseout | parallelizable false
- `DocumentationContinuity` | Reconcile current implementation, release state, architecture assets, guides, and historical boundaries | satisfies ISC-155..186 | depends_on PreservationProof | parallelizable false
- `ElectronDesktopPackage` | Package the R3F renderer behind a secure macOS-first Electron shell with artifact evidence | satisfies ISC-187..218 | depends_on DocumentationContinuity | parallelizable false
- `GoalGraphAuthority` | Persist the approved operational Goal Graph with deterministic compilation and migration proof | satisfies ISC-219..235 | depends_on ElectronDesktopPackage | parallelizable true
- `TelegramGoalGraphIntake` | Convert bounded Telegram intent into approval-bound proposals without granting routing authority | satisfies ISC-236..240 | depends_on GoalGraphAuthority | parallelizable true
- `BranchTraversalMap` | Compile branch packets and transition receipts into a deterministic, read-only organ traversal projection | satisfies ISC-241..256 | depends_on GoalGraphAuthority, TelegramGoalGraphIntake | parallelizable true
- `D1ReceiptAuthority` | Persist immutable branch transition receipts with idempotent tenant-scoped reads | satisfies ISC-257..263 | depends_on BranchTraversalMap | parallelizable true
- `AuthenticatedBranchMapRoute` | Expose the Goal Graph and receipt projection behind signed Telegram auth | satisfies ISC-264..269 | depends_on D1ReceiptAuthority | parallelizable false
- `TelegramMapSheet` | Render bounded read-only branch and organ traversal rows for Telegram | satisfies ISC-270..273 | depends_on AuthenticatedBranchMapRoute | parallelizable true
- `SignedEndToEndProof` | Prove receipt storage, route auth, projection, rendering, and digest binding synthetically | satisfies ISC-274..280 | depends_on D1ReceiptAuthority, AuthenticatedBranchMapRoute, TelegramMapSheet | parallelizable false

## Architecture

<!-- arch-assets:start -->

_Maintained during the 2026-07-22 architecture refresh; source-backed inventory plus reviewed LLM-generated assets._
_Last refreshed: 2026-07-22T09:00:00Z_

| Asset | Status | How it's generated |
|---|---|---|
| [`docs/architecture/SERVICES.md`](docs/architecture/SERVICES.md) | ✅ current | auto (file scan) |
| [`docs/architecture/DEPENDENCY-GRAPH.md`](docs/architecture/DEPENDENCY-GRAPH.md) | ✅ current | auto (file scan) |
| [`docs/architecture/architecture.html`](docs/architecture/architecture.html) | ✅ current | architecture-diagram skill, reviewed against source |
| [`docs/architecture/notebooklm-prompt.md`](docs/architecture/notebooklm-prompt.md) | ✅ current | architecture refresh prompt, reviewed against source |

**To refresh LLM-generated assets:** invoke `/refresh-architecture` in any Claude Code session.

<!-- arch-assets:end -->

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
- 2026-07-22 07:30: The active checkout is dirty on a branch whose tree matches released `origin/main` but whose tip is not an ancestor because PR #264 was merged with a distinct release commit; no second feature merge is warranted.
- 2026-07-22 07:30: The only open code path is the stacked IVerif pair: #254 is the reviewed child of #253, while #253 conflicts with current main and must be resolved on a fresh integration branch.
- 2026-07-22 07:30: The dirty architecture assets are newer generated output; the stash contains older generated variants plus unique validator/readiness candidates. Recovery will be selective and stashes will remain retained.
- 2026-07-22 07:30: Delegation floor is relaxed with show-your-math: each inventory probe is a direct bounded Git/GitHub lookup, while parallel write agents would contend on shared worktree metadata and complicate preservation proof.
- 2026-07-22 08:40: Documentation reconciliation keeps the authored README voice and historical plans intact; current surfaces are updated by source-backed additions and explicit status labels rather than destructive regeneration.
- 2026-07-22 08:40: The project is documented as two connected planes: composition/operator and runtime/visual. The Worker, R3F app, lead runtime, IVerif observer, and Marketing Create renderer are named with their independent deployment and side-effect boundaries.
- 2026-07-22 08:40: The architecture refresh marker is removed only after reviewed `architecture.html` and `notebooklm-prompt.md` assets are present; the service inventory supplements the shallow hook scan with nested Worker bindings.
- 2026-07-22 08:40: Release history remains immutable in meaning: v0.3.0 counts are labeled release-time, current `main` is explicitly unreleased, and the forbidden committed live-readiness path is not restored.
- 2026-07-22 09:35: The desktop target is reconstructed as a thin shell around the existing R3F renderer rather than a second application. A relative Vite build, secure `cambium://` protocol, narrow preload, and optional Worker URL preserve the local-first demo while making the macOS artifact independently verifiable.
- 2026-07-22 09:35: electron-builder is the distribution tool because the repository needs explicit macOS DMG/ZIP and unpacked-app targets; the package owns pinned Electron dependencies and signing/notarization are not inferred from local keychain state.
- 2026-07-23 04:57: The current ActionRequest KV queue is a UI/projection lane, not a desired-state authority. The next slice therefore separates a D1 approval-bound CAS writer from a pure Telegram-shaped parser; handler wiring remains deferred until route and receipt contracts exist.
- 2026-07-23 04:57: Approval binding is the tuple `(content_hash, intent_version, approver_id, nonce_or_expiry)` over canonical serialization. Telegram update/content idempotency, total parser rejection, and a single atomic D1 batch are mandatory before integration.
- 2026-07-23 04:57: Premortem controls are explicit: conditional CAS statements must leave zero writes on stale heads; approval TTL and graph-version binding block reuse; projection-origin input is rejected; bootstrap races fail closed; unknown or oversized Telegram keys are rejected.
- 2026-07-23 05:20: The pure next slice is verified locally: D1 approval witnesses are immutable, valid commits read back one revision, stale/bootstrap races leave all authority tables unchanged, and Telegram redelivery has a canonical SHA-256/idempotency key. Handler wiring remains a separate unverified edge.
- 2026-07-23: Root-cause-at-ingestion checkpoint — the Telegram view cannot show branch traversal because current BranchStoryArc packets describe desired organ routing but no durable branch-to-organ transition receipt ledger exists. The first map slice therefore derives a read-only projection from packet metadata plus explicit receipts; campaign and wiki records remain evidence overlays, never desired-state writers.
- 2026-07-23: Advisor review selected a versioned on-read projection for the first branch-map slice. Deterministic ordering, DAG validation, receipt/lineage parity, tenant authorization, unresolved references, freshness, and projection-origin rejection are mandatory before handler wiring.
- 2026-07-23: Verification completed for the first branch-map contract slice. At that slice's boundary, live route wiring remained explicitly deferred because no production receipt source was served; the subsequent D1-to-route slice is recorded below.
- 2026-07-23: Cato cross-vendor audit passed the D1 receipt, bounded route read, full-sheet digest, tenant-authentication, redaction, and truthful live-proof boundaries after the mandatory fixes.
- 2026-07-23: conjectured: a deterministic sheet over a pure projection was sufficient for operational branch traversal
  refuted by: the projection had no durable D1 receipt boundary or authenticated Worker read seam, so a Telegram view could not prove which evidence it consumed
  learned: ingestion, tenant-authenticated read, bounded rendering, and digest binding must be one verifiable chain; founder-device capture remains a separate live boundary
  criterion now: ISC-257..280 require append-only receipts, signed route auth, bounded redacted sheets, full-envelope proof digests, and an explicit live-proof deferment

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
- 2026-07-22 | conjectured: Every open PR represented unique code still absent from current main
  refuted by: PR #254's exact `bfb0e8c` commit is not an ancestor, but its observer surface and child test contract were superseded by the hardened commits merged through PR #257; only PR #253 required integration
  learned: PR state must be compared with current-tree content and test reachability, not branch lineage alone
  criterion now: ISC-134, ISC-146, ISC-147, and ISC-148 require stacked-PR and residual-branch classification against fetched main
- 2026-07-22 | conjectured: Every dirty or stashed readiness artifact should be promoted into active documentation
  refuted by: `scripts/drift-audit.mjs` forbids `docs/plans/assets/tg-miniapp-live-proof/readiness.json`, and its blocked report was already classified as stale evidence
  learned: preserve excluded evidence with local archive refs while honoring the repository's own safety gates
 criterion now: ISC-141..143 and ISC-152 require truthful exclusion, safe instructions, and retained recovery refs
- 2026-07-22 | conjectured: Updating the README alone would be enough to realign project truth
  refuted by: the package description, architecture inventory, nested Worker bindings, app/CLI READMEs, and generated-asset marker carried independent drift
  learned: documentation continuity requires a source map across narrative, generated, release, adopter, and historical surfaces
 criterion now: ISC-155..185 require cross-surface status, provenance, links, and verification; ISC-186 preserves historical boundaries
- 2026-07-23 | conjectured: A pure parser and CAS store could be considered complete without end-to-end handler wiring
  refuted by: route and receipt evidence is not present yet, and the project explicitly separates pure authority contracts from Telegram/Worker edges
  learned: complete the durable boundaries first, but preserve a visible deferred integration criterion rather than claiming the workflow is live
  criterion now: ISC-234..240 mark the store/intake contracts complete while ISC-238 keeps route and receipt wiring deferred
- 2026-07-23 | conjectured: Directly wiring Telegram into the existing ActionRequest handler would quickly create the operational workflow
  refuted by: the handler currently exposes UI queue and worker-store seams but no single approval-bound desired-state writer
  learned: operational workflows need one Goal Graph authority before projections or intake routes are connected
  criterion now: ISC-234..240 require canonical approval binding, atomic CAS, total bounded intake, and explicit deferred integration
- 2026-07-23 | conjectured: Adding another Telegram sheet over the existing branch stories would reveal how products move through organs
  refuted by: BranchStoryArc packets contain intended Organ Routing and gate state but no durable transition receipt, while the current packet index omits getleads and explee
  learned: traversal is an evidence-backed lineage projection, not a campaign/wiki lookup or a visual-only component
  criterion now: ISC-241..256 require a canonical alias registry, receipt-bound DAG projection, non-authoritative campaign/wiki overlays, and deferred route claims

## Verification

- Consolidation audit: ISC-129..154 are complete (`26/26`), with baseline, provenance, classification, preservation, integration, cleanup, and anti-criteria evidence recorded above.
- Main parity: local `main` and `origin/main` both resolve to `f4868c8c8d9b57367b0ae43279d5fbc0879791de`; the checkout is clean after this ISA update is committed.
- Pull requests: #253 merged to `main` as `c5991f0e`; #254's exact `bfb0e8c` commit is not an ancestor, but its observer surface was superseded by merged PR #257 and its closure is recorded; #265 merged the reviewed pending architecture/ISA state as `61b9f9a`; no PRs remain open.
- CI and local gates: exact-head main run `29902402351` passed successfully for `f4868c8`; final main passed `npm test` (978/978), standalone audit (452 publishable files), and standalone smoke; the integration branch also passed product-branch validation, drift audit, and docs render check.
- Preservation: four stashes remain present and five `archive/cambium-consolidation-*` tags retain recovery points; all twelve retained non-primary worktrees are clean and reachable from `origin/main`.
- Stash dispositions: the current dirty-checkout archive retains ISA and architecture provenance already integrated through #265; `wip-before-rebase` retains superseded generated docs, a drift-forbidden readiness report, and validator candidates already present in `main`; the two June stashes retain older generated architecture variants. None was dropped.
- Archive boundary: consolidation tags remain local-only because pushing them would publish user-owned stash blobs and proof assets; the exact refs and four stash objects remain recoverable on this machine.
- Cleanup boundary: only three clean consolidation worktrees and two missing-gitdir records were removed; no branch deletion, stash drop, reset, force-push, or live provider mutation occurred.

- Primary checkout preservation: status digest `eed44f76e58b130fbbb25849421cc93a56662feb143096dec17fcdb306669460` and stash digest `b45c285aa8d1d51b4df0b41cdfd7b0e2e803bdb50c2950c996449874859d7627` match their pre-cleanup values; six worktrees remain.
- Branch provenance: cleanup and merge-base both resolve to fetched `origin/main` `84f616152f05885369b97a18c8ac4318bb21b23a`.
- Runtime and drift: focused Worker, routing, readiness, release-contract, standalone-audit, and mutation tests pass. Deliberate production-shape, fixed-instruction, touch, and PNG-digest failures were observed before their implementations passed.
- Canonical browser proof: 38 captures pass (27 layout, 11 clickability), PAGE SHA-256 `db1351564dd64741582ea8888698de663dcd005105ac0d856b0c6b2b3e97a77c`; the manifest binds every canonical PNG to its current SHA-256 and focused runs write only ignored diagnostics.
- Deterministic release verification passes: 702 core tests, six CI mobile stories including settled real touch drag and a hit-tested queued ActionRequest proof tap, 52 R3F tests, R3F build, docs synchronization, standalone audit, smoke, and drift audit.
- Goal Graph next-slice verification: focused compiler/projection/intake/store contracts pass (25/25); SQLite migration parses; `npm test` passes with the default Goal Graph glob including intake/store tests (1003/1003); `npm run standalone:audit` passes 476 publishable files; `npm run standalone:smoke` and `npm run render-docs:check` pass; no Worker/Telegram route or external provider mutation was performed.
- Branch traversal map verification: the packet projection and read-only subsection remain green; the D1 receipt store, authenticated Worker route, bounded Telegram sheet, and signed synthetic proof now pass their focused suites. The inventory and architecture contract contain no credentials or live mutation path; founder-device Telegram evidence remains deferred under ISC-279.
- Final repository verification after the branch-map slice: `npm test` passes 1009/1009, `npm run standalone:audit` passes 480 publishable files, `npm run render-docs:check` passes 6 pages/91 components, and `git diff --check` is clean. No live Telegram, R2, Explee, campaign, wiki, Composio, or provider mutation was performed.
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
- Documentation synchronization evidence: ISC-155..186 are complete (`32/32`). README, package metadata, root architecture, integration roadmap, release notes, R3F/Quine/adopter guides, adapter index, technical reference, planning state, service inventory, and architecture assets now describe the current implementation and preserve historical boundaries.
- Electron packaging evidence: ISC-187..218 are complete (`32/32`). The R3F renderer now builds with relative asset paths; Electron loads it through a secure custom protocol with context isolation, sandboxing, no Node integration, denied permissions, blocked new windows, narrow preload, and no bundled secret names. `desktop:test` passes, the packaged arm64 executable emits `CAMBIUM_DESKTOP_READY`, and the local DMG/ZIP/unpacked macOS artifacts were generated with signing explicitly disabled after the local keychain signing path stalled.
- Electron release evidence: `npm run verify:release` passes with 978 core tests, 99 R3F tests, production build, standalone audit, docs synchronization, and the Electron packaging contract. `npm run desktop:smoke:packaged` passes against the actual bundled executable. The macOS workflow runs the unpacked artifact build and packaged smoke on `macos-latest`; Developer ID signing, notarization, and automatic updates remain separately governed.
- Current local release verification: `npm run verify:release` passed with 978 core tests, 99 R3F tests, R3F production build, six-page docs synchronization, standalone audit, standalone smoke, drift audit, retired-runtime guard, and Telegram mobile proof. `npm run validate`, `npm run validate:product-branches`, and `npm run render-docs:check` also passed.
- Architecture asset evidence: `docs/architecture/architecture.html` and `docs/architecture/notebooklm-prompt.md` exist, their source links resolve, `SERVICES.md` enumerates nested Worker bindings, and `REFRESH-NEEDED.md` is absent after refresh.
- Safety evidence: the forbidden committed `docs/plans/assets/tg-miniapp-live-proof/readiness.json` path is absent from active current documentation; IVerif remains GET-only and send-ineligible, Marketing Create remains review-only/disabled, and dated plans remain historical.
- Working-tree boundary: documentation changes remain uncommitted and unpushed for user review; no runtime source, provider secret, deployment, branch, stash, or historical evidence was mutated by this task. This boundary is being closed by the release-durability action of 2026-07-23, which commits and pushes this state in the same working session.
- D1 receipt-to-Telegram slice: `node --test workers/quests/src/branch-map-receipt-store.test.ts workers/quests/src/branch-map-sheet.test.ts workers/quests/src/branch-map-route.test.ts workers/quests/src/migration.test.ts` passes 17/17 after composite tenant identity and bounded observed-time listing fixes.
- Signed proof chain: synthetic Ed25519 Telegram initData authenticates the route, a real SQLite-backed D1 receipt store feeds the projection, the sheet is redacted/bounded, and the proof digest recomputes over the full sheet envelope plus text digest.
- Worker bundle: `npx wrangler deploy --dry-run --config workers/quests/wrangler.jsonc` exits zero with `nodejs_compat`; no live deployment or provider request was made. This dry-run-only deploy boundary is being closed by the release-durability action of 2026-07-23 in the same working session.
- 2026-07-23 release-durability verification: `npm test` passes 1023/1023; the D1 receipt/sheet/route/migration focused suite passes 18/18; all 8 product branch packets validate; `npm run standalone:audit` passes 486 publishable files; `npm run render-docs:check` passes 6 pages/91 components. These counts supersede the 1009/1009 full-test, 17/17 D1, and 480 publishable-file counts recorded for the branch-map slice above.
