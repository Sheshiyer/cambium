---
task: "Probe production, review dirty tree, park D1 Fitcheck"
slug: 20260820-182800_cambium-vault-handoff
project: Cambium
effort: E4
effort_source: context-override
phase: plan
progress: 8/24
mode: interactive
started: 2026-08-20T18:28:00Z
updated: 2026-08-20T18:40:00Z
---

## Problem

A thoughtseed-vault handoff asked Cambium to close the remaining Fitcheck Goal Graph gap, but this Mac cwd sits on rejected Worker SHA `8360c04`, which reintroduced `CONTEXT_PROJECTIONS`. Production is a different Version. Dirty docs and planning files sit on that rejected line. Phase 7 documentation-safety discussion lives on another Cambium GSD branch, not here.

## Vision

The founder can see, in one sitting, that production did not move, that this cwd cannot upload, that Fitcheck is still unanchored on D1 tenant `cambium`, and that the dirty tree is reviewed into an explicit commit bucket that never rides the rejected SHA.

## Out of Scope

- No wrangler versions upload, deploy, secret put, or traffic change from this cwd.
- No Vectorize ingest of vault markdown into `cambium-cortex`.
- No treatment of either `thoughtseed-vault` R2 bucket as note sync.
- No `getfitcheck` tenant mint. No invented TeamForge `project_id`.
- No D1 CAS write until a founder Gate envelope exists against live Version `089181f6`.
- No checkout that silently discards the dirty tree.
- No Phase 7 discuss/plan execution on this rejected SHA.

## Principles

- Runtime outranks issue prose; live Worker Version outranks cwd git.
- An R2 mapping receipt is evidence, not a Goal Graph node.
- Origin precedes WorkObject kind; kind precedes a second TeamForge slug.
- Fail closed on account, SHA, and binding mismatch.
- Historical GSD STATE Complete does not hide a later v0.4 phase on another branch.

## Constraints

- Wrangler profile `thoughtseed-labs`, account `9d7cec1b5a32b2df8c6cdc1321ccd00b`.
- Unset `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Personal OAuth account `9d9d23b27f32e70ae3afb6a1aa2c0f10` is forbidden for production.
- Production config is `workers/quests/wrangler.labs.jsonc`.
- Live Version `089181f6-ed60-4710-aab6-cd10855360e0` at 100 percent, git-21d4908, rollback `bc990526-3588-44ad-8116-8d6ec9d9fa35` retained.
- Fitcheck identity is `sapling:fitcheck` under tenant `cambium`.
- D1 Goal Graph is the only operational writer; writes are founder CAS plus signed Gate.
- Packet remains `reviewed-held`; this session does not authorize relocation or registry writes.

## Goal

Prove cwd SHA is the rejected `8360c04` so no upload occurs; prove live Worker `089181f6` remains 100 percent on git-21d4908; prove live `cambium-bridge` has no `sapling:fitcheck` node; review the dirty tree; and leave a founder-chosen GSD commit path that cannot carry `CONTEXT_PROJECTIONS` or junk files onto production.

## Criteria

- [x] ISC-1: `git rev-parse HEAD` equals `8360c04874d1737d5c3de1860166ee3fa4e030bc`.
- [x] ISC-2: Anti: no `wrangler versions upload` or `wrangler deploy` ran in this session.
- [x] ISC-3: `wrangler.jsonc` on HEAD binds `CONTEXT_PROJECTIONS` to `thoughtseed-context-projections`.
- [x] ISC-4: `21d4908` `wrangler.labs.jsonc` does not bind `CONTEXT_PROJECTIONS`.
- [x] ISC-5: `wrangler deployments status --config workers/quests/wrangler.labs.jsonc` shows Version `089181f6-ed60-4710-aab6-cd10855360e0` at 100 percent.
- [x] ISC-6: That Version annotation is `git:21d49089ae2a1344317fc92a83a0ac828f577806` / `git-21d4908`.
- [x] ISC-7: Version `bc990526-3588-44ad-8116-8d6ec9d9fa35` remains listed as rollback.
- [x] ISC-8: Wrangler whoami lists Labs account `9d7cec1b5a32b2df8c6cdc1321ccd00b` and profile `thoughtseed-labs`.
- [ ] ISC-9: Anti: default `wrangler versions list` against dirty `wrangler.jsonc` must not be treated as production proof (it targets `9d9d…`).
- [x] ISC-10: Live `goal_graph_nodes` for tenant `cambium` has exactly one unanchored telegram root and zero `work_object_id = 'sapling:fitcheck'`.
- [x] ISC-11: Live `goal_graph_heads` for `cambium` is graph_version 1 digest `846400e1fa23704849d48a3ae0d3bf26b7e96d47e353abc0e26075f1cf89b05e`.
- [x] ISC-12: Migration 0009 columns `work_object_id`, `work_object_kind`, `pinned_loadout_id` exist and are NULL on the live root.
- [ ] ISC-13: Anti: no Vectorize upsert into `cambium-cortex` from vault markdown.
- [ ] ISC-14: Anti: no R2 put to either thoughtseed-vault bucket from this session.
- [ ] ISC-15: Reviewer artifact exists for the local dirty tree and names `CONTEXT_PROJECTIONS` / junk-path hazards.
- [ ] ISC-16: Commit bucket excludes `0`, `<absolute path>`, `MEMORY/WORK/**`, and Temperance ephemeral `.planning/NEXT-WAVE.json`.
- [ ] ISC-17: Any commit lands on a branch whose merge-base is `origin/main` or `21d4908`, never as a new commit whose parent is only `8360c04` with labs `CONTEXT_PROJECTIONS`.
- [ ] ISC-18: Phase 7 discuss pickup cites branch `codex/phase-5-decisions` @ `95634db` and next command `/gsd:discuss-phase 7`.
- [ ] ISC-19: Anti: no `getfitcheck` tenant or invented TeamForge project_id appears in any write.
- [ ] ISC-20: Fitcheck D1 admission, if later approved, uses founder CAS against live head digest in ISC-11 on Worker `089181f6`.
- [ ] ISC-21: ParkArea / Tirak / Cambium dual product-client folders require a WorkObject kind before a second TeamForge slug (documented, not minted).
- [ ] ISC-22: `.project/HANDOFF.md` checkpoint records probe SHAs, live Version, D1 gap, and the no-upload hold.
- [ ] ISC-23: `git diff --check` on the proposed commit set is clean.
- [ ] ISC-24: Anti: no production traffic percentage change from 100 percent on `089181f6`.

## Test Strategy

| isc | type | check | threshold | tool |
|---|---|---|---|---|
| ISC-1 | git | HEAD SHA | exact 8360c04… | `git rev-parse HEAD` |
| ISC-2 | anti-ops | no upload in session | zero matching commands | session tool log |
| ISC-5 | wrangler | deployments status | 089181f6 @ 100 | wrangler.labs.jsonc |
| ISC-10 | d1-read | fitcheck rows | 0 | wrangler d1 execute --remote |
| ISC-11 | d1-read | graph_digest | 846400e1… | wrangler d1 execute --remote |
| ISC-15 | review | review file exists | non-empty | Read grok-review-*.md |
| ISC-17 | git | parent of commit | not 8360c04+CONTEXT | `git log -1 --format=%P` |
| ISC-18 | git | phase-6 security file | 06-SECURITY.md @ 95634db | `git show 95634db --stat` |

## Features

```yaml
- name: ProductionProbe
  description: SHA, Wrangler identity, live Version, rollback retention
  satisfies: [ISC-1, ISC-2, ISC-3, ISC-4, ISC-5, ISC-6, ISC-7, ISC-8, ISC-9, ISC-24]
  depends_on: []
  parallelizable: false

- name: FitcheckD1Gap
  description: Read-only cambium-bridge proof that sapling:fitcheck is unanchored
  satisfies: [ISC-10, ISC-11, ISC-12, ISC-19, ISC-20, ISC-21]
  depends_on: [ProductionProbe]
  parallelizable: false

- name: DirtyTreeReview
  description: GSD/local review of uncommitted files with forbidden-path exclusion
  satisfies: [ISC-13, ISC-14, ISC-15, ISC-16]
  depends_on: [ProductionProbe]
  parallelizable: true

- name: GsdCommitPath
  description: Founder-gated commit onto a clean base, not 8360c04
  satisfies: [ISC-17, ISC-22, ISC-23]
  depends_on: [DirtyTreeReview]
  parallelizable: false

- name: Phase7Handoff
  description: Point Phase 7 discuss at codex/phase-5-decisions, not this cwd
  satisfies: [ISC-18]
  depends_on: []
  parallelizable: true
```

## Decisions

- 2026-08-20 18:28: Probe first. Cwd IS 8360c04, so upload is blocked even though the user asked to confirm inequality.
- 2026-08-20 18:32: Production proof must use `wrangler.labs.jsonc` (Labs `9d7cec1b`). Dirty `wrangler.jsonc` is pinned to forbidden `9d9d…` as a fail-closed default-deploy trap.
- 2026-08-20 18:35: Live D1 `cambium-bridge` `c0aba88a-…` has graph_version 1, one unanchored telegram root, zero Fitcheck anchors. Migration 0009 columns exist unused.
- 2026-08-20 18:36: Phase 6 closed on `codex/phase-5-decisions` @ `95634db` (`06-SECURITY.md`). origin/main ROADMAP still shows Phase 5–7 open. This cwd is not that GSD line.
- 2026-08-20 18:37: refined: do not commit “all changes” onto 8360c04. Review first, then founder-pick a clean-base branch.
- 2026-08-20 18:38: ISC floor 24 < E4 soft 128. Documented under-decomposition: this is a bounded ops handoff, not a 128-criterion app rewrite. Project `ISA.md` remains the long-lived ledger.
- 2026-08-20 18:39: Delegation: one reviewer subagent for the dirty tree. No fleet Execute. No D1 write.

## Changelog

- conjectured: cwd SHA would already differ from 8360c04 so a versions list would be safe
- refuted by: `git rev-parse HEAD` returned `8360c04874d1737d5c3de1860166ee3fa4e030bc` and labs config on that SHA binds `CONTEXT_PROJECTIONS`
- learned: the first probe is a stop, not a green light; live proof is a separate Labs-config read
- criterion now: ISC-1 plus ISC-2 plus ISC-5

## Verification

- ISC-1: `HEAD=8360c04874d1737d5c3de1860166ee3fa4e030bc` (BLOCK).
- ISC-2: session ran `versions list` / `deployments list` / `deployments status` / `d1 execute` SELECT/PRAGMA only.
- ISC-5: deployment `87c97ad0-bfd4-468f-89e4-9e24e7a3449c`, version `089181f6-ed60-4710-aab6-cd10855360e0` at 100 percent, created 2026-08-19T08:16:58Z.
- ISC-6: annotations `git:21d49089ae2a1344317fc92a83a0ac828f577806` and `git-21d4908`.
- ISC-7: versions list includes `bc990526-3588-44ad-8116-8d6ec9d9fa35` number 47.
- ISC-8: whoami Thoughtseed Labs `9d7cec1b5a32b2df8c6cdc1321ccd00b`, profile `thoughtseed-labs`.
- ISC-10/11/12: remote D1 read; Fitcheck rows empty; head digest `846400e1…`; 0009 columns present NULL.
- ISC-15..24: pending review + founder commit gate.
