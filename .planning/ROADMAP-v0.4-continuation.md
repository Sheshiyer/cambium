# Roadmap v0.4 Continuation — From Integration-Complete to Deployment-Validated

> Drafted 2026-07-23 from a six-way review swarm against the OPUS D1 branch-map assessment.
> Supersedes nothing; extends the completed v0.3 slice (`.planning/ROADMAP.md`, Phases 1–2 done 2026-07-17).
> Core value (unchanged): an operator action counts only when its durable task, lease, artifact, outcome, and readback agree.

## Review verdict on the OPUS summary

**Holds:**
- Tests 1023/1023, D1 receipt/sheet/route/migration 18/18, 8 branch packets, 486-file audit, 6 pages / 91 components — all re-run and confirmed live.
- Integration-complete, deployment-unvalidated is the correct headline.

**Corrections (OPUS understated or stale):**
1. "Uncommitted/unpushed" is worse than stated: **zero commits exist** for the slice. 57 dirty files on `main`, no branch, no PR, 0 ahead of origin. A stray `git checkout .` destroys the Goal Graph + branch-map + D1 receipt work. Closure step 1 is urgent, not routine.
2. "No production Worker/D1 deployment proof" is contradicted: production deploy pipeline is proven (Worker Version 60 at 100% traffic, 2026-07-18, `docs/evidence/2026-07-19-marketing-create-failclosed-deploy.json`; secret activation 2026-07-20). What is missing is a deploy of the *current* slice.
3. "No founder-device Telegram capture" is partially stale: one exists (2026-06-30, `docs/evidence/tg-miniapp/2026-06-30/`) but for the mini-app home surface, not the branch-map route.
4. ISA.md records older gate counts (1009 tests / 480 files / 17 D1 tests) — must be updated to current numbers in the same commit that lands the slice.
5. The founder outcome (2–3 hrs/day, Telegram-first, display-closed Mac mini) is **not written in any vision-layer doc** (INFINITE-GAME, HOMEOSTASIS, QUESTLOG). It exists only in assessments.

## Open authority items carried forward

| Item | Source | Cleared by |
|------|--------|-----------|
| ISC-279 founder-device Telegram proof (branch-map route) | ISA.md:413,654 | Phase 4 |
| ISC-238 Goal Graph intake handler-route wiring | ISA.md:468 | Phase 5 |
| Dry-run-only deploy boundary | ISA.md:715 | Phase 4 |
| Open Q4 heartbeat / Arc V viability | INFINITE-GAME.md:385 | Phase 6 |
| Open Q5 Venn partition on ~20 real interactions | INFINITE-GAME.md:387 | Phase 7 (reuse live round-trips as corpus) |
| Open Q7 founder-NPC escalation policy | INFINITE-GAME.md:391 | later |
| QUESTLOG arc VII stale note vs M3 done | QUESTLOG.md:92 | Phase 3 (doc reconciliation) |
| VERSIONS.md missing post-v0.3.0 stanza | VERSIONS.md:14 | Phase 3 |

## Phases

### Phase 3: Release Durability (commit + push the authority/proof slice)
**Goal:** The Goal Graph / branch-map / D1 receipt slice exists as committed, pushed, tagged history — never again as a dirty tree.
**Depends on:** nothing. **Do first, this week.**
**Success criteria:**
1. Two atomic commits on `main`: (a) authority/proof slice (goal-graph, branch-map, migrations 0007–0008, ISA/docs); (b) desktop/Electron + lockfile churn separately. Pushed to origin.
2. ISA.md Verification updated to current counts (1023 / 18 / 8 / 486 / 6×91); VERSIONS.md gains the post-v0.3.0 "Unreleased" stanza; QUESTLOG arc VII reconciled with INFINITE-GAME M3.
3. Proof transcripts persisted per run into `.artifacts/` so verification is inspectable, not re-execution-only.
4. `verify-release.mjs` (or equivalent pre-deploy gate) requires clean-tree-or-committed state; all five quantitative gates wired as one command.
5. Policy decision recorded for the 12 stale `codex/*` worktree branches and 4 stashes (archive or delete).

### Phase 4: Production Deploy + One Real Telegram Round-Trip
**Goal:** The committed slice runs in production and a founder device reads a real branch-map sheet through Telegram.
**Depends on:** Phase 3.
**Success criteria:**
1. D1 migrations 0007–0008 applied to production `cambium-bridge`; `wrangler deploy` (not dry-run) of `cambium-quests` with the slice; evidence JSON in `docs/evidence/`.
2. Founder-device capture hitting `GET /v1/branch-map/{tenant}` via signed initData — clears ISC-279. Reuse `live-proof-readiness.mjs --capture-device-proof`.
3. Post-deploy health: Worker, gateway, timer green per `workers/quests/DEPLOY.md`.
4. ISA.md Verification records the deploy + capture; the dry-run boundary note is superseded.

### Phase 4 — CLOSED 2026-07-26 (by redesign, not by the retired ritual)
The TG Mini App mobile-first redesign (issues #266/#267/#268, plan
`docs/plans/2026-07-24-tg-miniapp-mobile-redesign-swarm-plan.md`) shipped all five scenes to
production (Worker version `203803d4`, git `88307e9`, 100% traffic) and the founder signed the
redesign sign-off in-app — the signed receipt is the founder-device proof (ISC-281), clearing
ISC-279 **by redesign**; criterion 4.2's `--capture-device-proof` path is retired and superseded.
Evidence: `docs/evidence/tg-miniapp/2026-07-26/`.

**Retro (T-038):** three phase-2 waves × (scene workers → proof regen → fidelity review → nit fix)
held the frozen spec without drift; every wave ended PASS-WITH-NITS with nits fixed same-wave.
Recurring cost: scene workers hit the 60-min ceiling (2–3 resumes each) and the viewport-proof
script collected stale-selector debt each wave — both priced into future wave estimates. The
text-density audit (T-028) is now a standing gate (`npm run audit:text-density`). Two frozen-spec
adjudications ride forward as named overrides: M12 empty-state word-cap conflict and the
unratified `Viewport capture` label — both need a founder ruling, neither blocks Phase 5.
**Re-sequencing:** none required — Phase 5 (Goal Graph intake) keeps its scope and dependency;
the redesign shipped read/act surfaces only, intake wiring was not pulled forward (per plan risk 5).

### Phase 5: Canonical Telegram Intake → Approval → Goal Graph Commit
**Goal:** One typed Telegram intake flows end-to-end: intake → D1 task → approval → Goal Graph commit → receipt readback.
**Depends on:** Phase 4.
**Success criteria:**
1. ISC-238 wired: Goal Graph intake handler route live behind the existing gate secrets, fail-closed.
2. One live end-to-end proof with replay-safety evidence (no duplicate directive/artifact).
3. Branch-map route and Phase-2 operator commands promoted into `docs/runbooks/` per `docs/LIFECYCLE.md`; `docs/adapters/telegram.md` updated (currently predates Phase 2).

### Phase 5 — CLOSED 2026-07-27
All three criteria met. Intake route + approval bridge shipped in `190284e`, gate-envelope
and Mini App Gate tab surfacing in `74fd709`; production Worker `ec7f080d` at 100% on
`https://curious.thoughtseed.space`. Live proof 2026-07-26: changeDigest
`394556383a1e31a0…` → founder-signed `approve-goal-graph` → D1 head `846400e1fa237048…`
graphVersion 1, replay-safe (`.artifacts/tg-miniapp-live-proof/t041-*.json`, local).
Docs close-out (issue #269 / T-042): `docs/runbooks/goal-graph-telegram-lifecycle.md`
flipped to live, `docs/adapters/telegram.md` gained the intake contract, branch-map
route + Phase-2 operator commands promoted into
`docs/runbooks/telegram-operator-surface.md`; ISA ISC-238..240 closed with evidence.

### Phase 6: Operator Health/Heartbeat Digest
**Goal:** The founder receives one bounded operator digest on a schedule — the first proactive surface.
**Depends on:** Phase 4 (needs deployed route state); can overlap Phase 5.
**Success criteria:**
1. Digest contract spec written first: schema + cadence + Telegram delivery, extending the `cambium.telegram.*.v1` envelope family (nothing active specs this today).
2. Digest is redacted/digest-bound like map sheets; delivery proven on founder device.
3. Clears INFINITE-GAME open Q4 / flips Arc V viability criteria.

### Phase 7: One Measured Feedback Iteration (gate before proactive schedules)
**Goal:** Close observe → propose → apply → verify once, with a number.
**Depends on:** Phase 6.
**Success criteria:**
1. Measurement plan written: what "one measured iteration" proves, success threshold, corpus.
2. One telemetry amendment is actually consumed (apply path does not exist today — `bin/operator/skills/telemetry.ts` only observes/proposes) and re-measured.
3. ~20 real Telegram interactions double as the Q5 Venn-partition validation corpus.
4. Only after this passes: enable proactive schedules.

### Phase 8: Unified Operating Fabric
**Goal:** Make every active sapling and company program legible through one read-only Mission Fabric, with missions, tasks, runs, receipts, agents, and skill clusters visible in the Telegram Mini App without creating a second workflow authority.
**Depends on:** Phase 5 for live Goal Graph intake and authenticated readback. Contract/projection work can overlap Phases 6–7; production promotion waits for the same release and founder-device proof gates.
**Canonical refs:** `docs/architecture/cambium-operating-fabric.md`, `docs/plans/2026-07-28-cambium-operating-fabric-implementation-plan.md`, `docs/visual/cambium-operating-fabric-flow.html`.
**Status:** design baseline complete; runtime implementation queued.
**Success criteria:**
1. A versioned `WorkObject` model distinguishes saplings from company programs; only saplings retain branch promotion semantics.
2. One deterministic `cambium.mission-fabric-projection.v1` joins Work → Mission → Task → Run → Receipt lineage with separate agent-assignment and skill-requirement edges.
3. D1 Goal Graph remains the sole operational writer; projections expose source, version, freshness, read-only state, and explicit gaps.
4. The Telegram Mini App serves `Canopy | Mission | Flow | Workforce | Forge`; Gate and Inspect remain governed contextual sheets with rollback-safe legacy navigation.
5. Synthetic schema, determinism, redaction, compatibility, viewport, reduced-motion, and text-density suites pass before deployment.
6. Production promotion requires a founder-device Canopy→Mission→Flow read proof and one contextual signed Gate receipt.

## Explicitly later (not in v0.4)
- R2 vault → contract update → Thoughtseed PDF → sign/send: new explicitly-scoped phase; stopping at `awaiting_human_approval` is intentional design, not a gap to patch casually.
- Hermes-on-EC2 live proof, Growth Cortex as a named service, Composio distribution (catalog-only today), Q7 escalation policy, PHASE-Q-BRIDGE deferred wings (GitHub/CF signal stubs, lesson-miner).
- Vision-layer task: write the founder outcome (2–3 hrs/day, Telegram-first, display-closed Mac mini) with measurable acceptance into INFINITE-GAME/HOMEOSTASIS — currently undocumented above the assessment layer.
