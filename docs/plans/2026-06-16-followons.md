# Follow-on plans (non-visual queue after M5 Phase Q Bridge)

> Drafted 2026-06-16 after M5 Phase Q + Bridge writers landed and Mathis went first-light. Three independent subsystems that the user named as in-scope but that warrant separate implementation plans rather than bundling.

## 1. Lesson-miner agent — arc XVII closure
- **Spec**: `docs/plans/2026-06-11-group-memory-lesson-agent.md`
- **Status**: SPEC complete, implementation not started
- **Gating decisions to resolve before build**: G1 (founder group chat_id), G2 (BotFather privacy mode), G3 (host: Hermes skill vs cambium agent), G4 (model via MultiCA gateway), G5 (privacy of group content), G6 (dedup threshold).
- **Waves**: L0 (governance) → L1 (`@bot` pickup) → L2 (daily read) → L3 (the miner) → L4 (miniapp panel) → L5 (approve → routine).
- **Reuse**: rides the existing Hermes poller, gate-consumer queue, skill forge, miniapp, launchd. New parts are the miner logic (L3) and `quine write lessons mint`.

## 2. Variable-contracts runtime validation — composition layer hardening
- **Spec**: `docs/plans/2026-06-09-capability-alignment-variable-contracts.md`
- **Status**: Tasks 1, 3, 4, 8, 9, 10 complete in Cambium. Task 5 is open as Skill-clusters PR #112 (`codex/rich-variable-contracts`). Task 6 is open as Brandmint PR #180 (`codex/downstream-variable-contracts`). Task **7 (Snow Gloves)** remains open.
- **Scope of remaining work**: cross-repo organ changes in `../snow-gloves-os`. Out-of-repo touches require coordination.
- **Risk**: Task 7 crosses repo boundaries and requires its own PR in the target repo.

## 3. W6 Paperclip archive ceremony — issue #26
- **Issue**: https://github.com/Sheshiyer/cambium/issues/26
- **Status**: OPEN, no spec yet
- **Scope (likely small)**: Document the closure ritual for completed Paperclip work; ties to the broader skill-cluster archive convention (`~/.agents/skill-clusters` archived spoke handling). May fold into `bin/quine/hyphae/skills.ts` as a `quine write skills archive --routine <id>` verb.
- **First action**: read the issue body when GitHub access is live; draft a one-page spec before planning.

## Recommended order

1. **Variable-contracts Task 7** — Snow Gloves/Paperclip orchestration adoption of the contract surface.
2. **W6 Paperclip archive (#26)** — small, clears the M5-adjacent open issue.
3. **Lesson-miner L0–L1** — governance + `@bot` pickup. Defers L2+ until L0 is unblocked.
4. **Merge Skill-clusters PR #112 and Brandmint PR #180** once reviewed; then continue Snow Gloves adoption.

Each becomes its own implementation plan when picked up. None should bundle.

## Adjacent follow-on (caught at first-light, not requiring its own plan)

- **`readRepoSignals` and `readDeploySignals` in `bin/quine/hyphae/project-evidence.ts`** are honest-zero stubs today. Wiring them via `bin/quine/hyphae/gh.ts` and `bin/quine/hyphae/cf.ts` is a small follow-on — once landed, arcs XII "The Build" and XV "The Launch" will derive from real GitHub commits and Cloudflare deploys instead of standing on honest zeros. ~1 task each.
