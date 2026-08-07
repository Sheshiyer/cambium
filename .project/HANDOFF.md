# Project handoff

## Checkpoint

- Status: `draft-held`
- Portfolio: `thoughtseed`
- Repository: `cambium`
- Registry WorkObject: `sapling:cambium`
- GitHub: `Sheshiyer/cambium`

### 2026-08-07 repository-first intake checkpoint

- Packet status remains `draft-held`; this checkpoint does not satisfy the human-review gate.
- Clean implementation branch: `codex/portfolio-repository-first-intake`, rooted at current `origin/main` in an isolated checkout.
- Design: `docs/plans/2026-08-07-portfolio-repository-first-intake-design.md`.
- Execution plan: `docs/plans/2026-08-07-portfolio-repository-first-intake-implementation.md`.
- GitHub Project: [Cambium — Repository-First Portfolio & Relocation](https://github.com/users/Sheshiyer/projects/14).
- Preserved continuity: issues #280–#285 and relocation preparation #287.
- New bounded tracking: implementation #289, repository/origin audit #290, planning-authority migration #291, packet review #292, and later promotion #293.
- Grammar is fixed: only Thoughtseed-originated ventures become Saplings; client-originated projects remain Client Branches even when new; shared Thoughtseed work is an Internal Program; unknown origin remains Needs Review.
- Project-local planning belongs to the owning GitHub repository; Cambium owns cross-portfolio coordination; tool/session/date files are historical evidence to reconcile.
- Known mapping-review focus includes Nimbus Gate, WanderFruit, Kristudios, Klear Karma, and mixed client-derived surfaces. No canonical reclassification has been applied by this checkpoint.
- Relocation is still preparation-only. No project folder was moved, copied, deleted, or nested; no Vault/R2, registry, native store, provider, or deployment state was changed.
- Production promotion remains issue #293 and is blocked by packet review issue #292.
- Implementation verification: `pnpm check` passes 34 active focused tests with one fixture-dependent skip; the exact Worker route passes 7/7 tests; deterministic `npm run verify:release` passes after locked R3F dependencies are installed.
- Generated evidence: 44 catalog repository refs = 15 resolved by immutable GitHub identity, 12 unverified owner/name candidates, and 17 unmatched gaps; evidence SHA-256 `486ac53f21320e7ad9ac386b4a030f44a90eba6de8fd5a01bc3a9329f6f5f7ad`.
- Exact offline artifact: 329,053 bytes; SHA-256 `8514e7a7e0637d6f2cc687f2098ea4606d995d50988dd6bdf4f61107d1e4f3f6`; generated Worker embed matches the same digest.
- Browser proof covers reconciliation, scheduling lock/unlock, reload persistence, zero console warnings/errors, and 390, 768, and 1440 pixel layouts. The unverified Nimbus Gate candidate remains locked and cannot select `no-repository`.
- Independent review initially found two high-priority intake bypasses; both were fixed and the final re-audit reports no remaining P0–P2 findings.

### 2026-08-07 portfolio-ingestion headers checkpoint

- Branch: `codex/portfolio-ingestion-headers`, based on merged repository-first main.
- Thoughtseed WorkObjects now show proposal folder receipts; Unplanned cards expose one `Review repository & map` action and no horizon shortcuts.
- Tryambakam · Noesis has a separate 30-card `Projects` header and intake-only drawer; it never uses Client Branch grammar.
- Root map: `docs/project-management/portfolio-roots.v1.json`, SHA-256 `588f136a14cac55dbba30b11394288943c56bfebba2b700b4c2d25590747c52b`.
- Destination headers were written to both `<projects-root>/<portfolio>/` roots. Only `PORTFOLIO.md` and `portfolio-map.v1.json` were created per root; the directory/inode digest stayed identical before and after and no grouping directory was created.
- `thoughtseed-labs` is recorded as the R2-synced vault infrastructure context, never as a WorkObject folder. Tryambakam `_archive` and `selemene-engine-worktrees` remain outside the 30 active Projects.
- The offline Import/Copy/JSON/Markdown/Reset header is retired. Thoughtseed intake now exposes `Save & queue repository review`; Tryambakam Project intake exposes `Start project ingestion`.
- Founder actions POST only to `/v1/admin/portfolio/actions`; the Worker validates a closed schema against the exact shipped root-map/catalog digests, canonical WorkObject identities, and reviewed shallow Tryambakam Project paths before writing immutable/idempotent R2 evidence and then a bounded `pending-governed-intake` trigger. R2 is evidence, not workflow authority; D1 Goal Graph remains the sole operational writer.
- Hosted action tracking: issue #296 in GitHub Project #14.
- `pnpm check` passes 47 active focused tests with one historical fixture skip; eight action/store tests and ten exact Worker route tests pass. Exact hosted artifact is 352,037 bytes, SHA-256 `a195927aaa9dff17326e52022a1f868a13e375456ff2e2df911124fe460b2348`.
- Local browser proof covers the portfolio structure at 390, 768, and 1440 pixels with zero horizontal overflow; the exact final artifact smoke separately proves both hosted action labels, the same-origin endpoint, CSP allowance, and retired export controls. Live production action proof remains promotion-gated.
- Production remains unchanged and issue #293 remains blocked by human packet review #292.

This packet was drafted by the packet-authoring tool from registry and
repository evidence. It has not been reviewed by a human and is not
committed.

## Completed

- Registry WorkObject matched via `sourceInventory`.
- Packet drafted: all six files present.
- No fields were flagged for review.

## Next action

Close implementation #289 through its reviewed pull request, resolve the 12
unverified and 17 unmatched repository gaps plus origin mismatches under #290,
and migrate project-local planning authority through #291. Then review this
draft packet under #292, resolve any review findings, commit the six packet
files coherently, and move `packet_status` to `reviewed-held`. Production
promotion #293, relocation-manifest approval, and live-apply approval remain
separate later steps.

## Verification

```bash
npm install
npm run test
git status --short
```

No registry, capsule, relocation, session, Paseo, provider, or deployment
mutation has been performed by drafting this packet.
