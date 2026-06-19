# Follow-on plans (non-visual queue after M5 Phase Q Bridge)

> Drafted 2026-06-16 after M5 Phase Q + Bridge writers landed and external pilot went first-light. Three independent subsystems that the user named as in-scope but that warrant separate implementation plans rather than bundling.

## 1. Lesson-miner agent — arc XVII closure
- **Spec**: `docs/plans/2026-06-11-group-memory-lesson-agent.md`
- **Status**: SPEC complete; local `quine write lessons mint` groundwork implemented so proposed lessons can enter the skill registry and project evidence. Live group ingestion is not started.
- **Gating decisions to resolve before build**: G1 (founder group chat_id), G2 (BotFather privacy mode), G3 (host: Hermes skill vs cambium agent), G4 (model via MultiCA gateway), G5 (privacy of group content), G6 (dedup threshold).
- **Waves**: L0 (governance) → L1 (`@bot` pickup) → L2 (daily read) → L3 (the miner) → L4 (miniapp panel) → L5 (approve → routine).
- **Reuse**: rides the existing Hermes poller, gate-consumer queue, skill forge, miniapp, launchd. New parts still needed are Telegram pickup/daily read, miner logic, and miniapp surfacing.

## 2. Variable-contracts runtime validation — composition layer hardening
- **Spec**: `docs/plans/2026-06-09-capability-alignment-variable-contracts.md`
- **Status**: Tasks 1, 3, 4, 8, 9, 10 complete in Cambium. Task 5 merged via Skill-clusters PR #112 (`77303439`). Task 6 merged via Brandmint PR #180 (`80d7aa54`). Task 7 is mainline in Snow Gloves via PR #4 (`3353e52`) after PR #5 (`6f1fce39`) supplied the contract preservation layer.
- **Verification**: end-to-end contract rehearsal passed on 2026-06-18: `npm run plan -- acme`; Skill-clusters variable-contract tests (7 pass); Brandmint downstream contract/hydrator/design-memory/template tests (56 pass); Snow Gloves contract/routing/agent-plane/GTM tests (17 pass), full tests (36 pass), and smoke (pass).
- **Remaining work**: no implementation or rehearsal work remains for the variable-contract bridge; future changes should treat this as baseline behavior.

## 3. W6 agent-plane archive ceremony — issue #26
- **Issue**: https://github.com/Sheshiyer/cambium/issues/26
- **Spec**: `docs/plans/2026-06-18-agent-plane-archive-ceremony.md`
- **Status**: OPEN, ceremony spec + non-destructive receipt verb implemented; archive artifact, repo state, checksum verification, receipt, and vault companion docs completed in the 2026-06-18 ops pass. Runtime retirement remains blocked while agent-plane-adjacent processes are still active.
- **Scope**: Retire agent-plane server/postgres/loop-runner only after the soak is confirmed; archive `~/.agent-plane/instances` + repo state; preserve/extract Hermes as the surviving channel layer; record the receipt with `quine write skills archive agent-plane`.

## Recommended order

1. **W6 agent-plane archive (#26)** — stop/migrate the remaining agent-plane-adjacent runtime, then verify with `quine read skills archive agent-plane --tenant cambium` before closing the issue.
2. **Lesson-miner L0–L1** — governance + `@bot` pickup. Defers L2+ until L0 is unblocked.
3. **R3F Game Engine Realignment (#44-#52)** — continue in the separate visual branch/session and close via visual-QA evidence.

Each becomes its own implementation plan when picked up. None should bundle.

## Adjacent follow-on (caught at first-light, not requiring its own plan)

- **`readRepoSignals` in `bin/quine/hyphae/project-evidence.ts`** now derives repo existence and default-branch commit count from the current git worktree, so arc XII "The Build" can stand on live build evidence instead of honest zero.
- **`readDeploySignals` in `bin/quine/hyphae/project-evidence.ts`** now counts Cloudflare Worker deployments for the configured `workers/quests/wrangler.jsonc` script when `CLOUDFLARE_API_TOKEN` is present, so arc XV "The Launch" can stand on live deploy evidence instead of honest zero.
- **`readGateSignals` in `bin/quine/hyphae/project-evidence.ts`** now counts queued founder approvals from the Worker gate queue when `QUESTS_PUSH_TOKEN` is present, so arc XIV "The Gate" can stand on real approval evidence instead of honest zero.
- **Remaining evidence gaps** are no longer the local project-evidence stubs or the variable-contract bridge; the next non-visual work is operational closure: W6 runtime retirement (#26) and lesson-miner governance.
