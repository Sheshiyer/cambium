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
- **Status**: Tasks 1, 3, 4, 8, 9, 10 complete in Cambium. Task 5 merged via Skill-clusters PR #112 (`77303439`). Task 6 merged via Brandmint PR #180 (`80d7aa54`). Task 7 merged into the Snow Gloves dispatcher branch via PR #5 (`6f1fce39`).
- **Scope of remaining work**: run the end-to-end contract handoff rehearsal once the Cambium stack lands on the target integration branch and Snow Gloves' dispatcher branch is promoted as intended.
- **Risk**: the implementation now spans multiple repos and one non-main downstream base branch, so the next gate is integration-order verification rather than more local code.

## 3. W6 Paperclip archive ceremony — issue #26
- **Issue**: https://github.com/Sheshiyer/cambium/issues/26
- **Spec**: `docs/plans/2026-06-18-paperclip-archive-ceremony.md`
- **Status**: OPEN, ceremony spec + non-destructive receipt verb implemented; archive artifact, repo state, checksum verification, receipt, and vault companion docs completed in the 2026-06-18 ops pass. Runtime retirement remains blocked while Paperclip-adjacent processes are still active.
- **Scope**: Retire Paperclip server/postgres/loop-runner only after the soak is confirmed; archive `~/.paperclip/instances` + repo state; preserve/extract Hermes as the surviving channel layer; record the receipt with `quine write skills archive paperclip`.

## Recommended order

1. **Run an end-to-end variable-contract rehearsal** across Cambium, Skill-clusters, Brandmint, and Snow Gloves once the stack is integrated.
2. **W6 Paperclip archive (#26)** — stop/migrate the remaining Paperclip-adjacent runtime, then verify with `quine read skills archive paperclip --tenant cambium` before closing the issue.
3. **Lesson-miner L0–L1** — governance + `@bot` pickup. Defers L2+ until L0 is unblocked.
4. **Promote/merge stacked branches** only after their base branches land cleanly.

Each becomes its own implementation plan when picked up. None should bundle.

## Adjacent follow-on (caught at first-light, not requiring its own plan)

- **`readRepoSignals` in `bin/quine/hyphae/project-evidence.ts`** now derives repo existence and default-branch commit count from the current git worktree, so arc XII "The Build" can stand on live build evidence instead of honest zero.
- **`readDeploySignals` in `bin/quine/hyphae/project-evidence.ts`** now counts Cloudflare Worker deployments for the configured `workers/quests/wrangler.jsonc` script when `CLOUDFLARE_API_TOKEN` is present, so arc XV "The Launch" can stand on live deploy evidence instead of honest zero.
- **`readGateSignals` in `bin/quine/hyphae/project-evidence.ts`** now counts queued founder approvals from the Worker gate queue when `QUESTS_PUSH_TOKEN` is present, so arc XIV "The Gate" can stand on real approval evidence instead of honest zero.
- **Remaining evidence gaps** are no longer the local project-evidence stubs; the next work is operational closure: W6 runtime retirement (#26), end-to-end variable-contract rehearsal, and lesson-miner governance.
