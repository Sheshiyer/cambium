# Project handoff

## Checkpoint

- Status: `draft-held`
- Portfolio: `thoughtseed`
- Repository: `cambium`
- Registry WorkObject: `sapling:cambium`
- GitHub: `Sheshiyer/cambium`

This packet was drafted by the packet-authoring tool from registry and
repository evidence. It has not been reviewed by a human and is not
committed.

## Completed

- Registry WorkObject matched via `sourceInventory`.
- Packet drafted: all six files present.
- No fields were flagged for review.

## Next action

Review this draft packet, resolve any items flagged in the review summary,
commit the six files as a single repository change, and move
`packet_status` to `reviewed-held`. A relocation manifest approval and a
live-apply approval both remain separate, later steps.

## Verification

```bash
npm install
npm run test
git status --short
```

No registry, capsule, relocation, session, Paseo, provider, or deployment
mutation has been performed by drafting this packet.

## 2026-08-07 continuity preservation checkpoint

The unfinished brand, Cloudflare, Hermes, quest, contact, and website-delivery
board is now preserved as an active, non-operational continuity record at
`docs/continuity/unfinished-brand-cf-hermes-board.md`.

- Eight source-claimed completions remain provenance assertions, not re-certified
  runtime facts.
- All 23 open source IDs (B1–B8, C1–C4, H1–H8, S1–S3) have exactly one
  disposition row, evidence class, dependency path, revalidation probe, and
  owning issue.
- `PROJECT.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, and Phase 9 of
  `.planning/ROADMAP-v0.4-continuation.md` point to the continuity record.
- GitHub parent #285 maps the full board to outcome issues #280–#284 and reuses
  existing issues #249 and #252 instead of duplicating them.
- `docs/LIFECYCLE.md` classifies continuity records as current coordination
  surfaces that cannot contain mutation instructions.
- The packet remains `draft-held`. This checkpoint authorizes no registry,
  relocation, session, provider, mailbox, credential, cron, directive, or
  deployment mutation.

Verification performed:

```text
continuity map: 23 rows, 23 unique IDs, zero missing, zero duplicates
source completion table: 8 rows
GitHub parent map: 23 IDs, 23 unique, zero missing, zero duplicates
GitHub issue state: #249, #252, and #280–#285 open and cross-linked
npm run drift:audit: passed
git diff --check: passed
npm test: 1125 passed, 3 unrelated baseline failures
```

The three suite failures are outside this checkpoint's changed files: two
context-binding fixtures expired on 2026-07-28, and two already-tracked operating-
fabric moodboard images lack asset-provenance group coverage. No asset, runtime,
or test source was changed to conceal those failures.

## 2026-08-07 Cambium relocation preparation checkpoint

Active preparation is preserved at
`docs/continuity/cambium-relocation-portfolio-reconciliation-prep.md` and owned
by GitHub issue #287 / Phase 10 of the continuation roadmap.

Observed corrections and topology:

- The earlier `cambium-portfolio-registry` worktree path is absent. Its code is
  not lost: PR #278 merged the named Cartographer, Worker, plan, and ISA paths
  into GitHub main.
- PR #286 merged the relocation records, but this checkout remains on the
  source branch at `be41feb`; live main was `ca6a7a7` at observation and the
  histories are divergent because the reviewed outcome was merged separately.
- Cambium currently has one primary checkout and four linked worktrees. The
  primary has protected documentation/planning bytes and the detached parity
  worktree has two dirty paths; no cleanup or disposition was attempted.
- The proposed Cambium destination is absent. The current packet contains all
  six required files, but packet completeness does not override the worktree-
  graph hold.
- The destination Thoughtseed root has 25 top-level directories: 22 standalone
  repositories and three non-Git containers holding ten nested primary
  repositories. The resulting 32 logical repositories have one-to-one Cambium
  registry entries. Parkarea also has one linked worktree, correctly excluded
  from the project count.
- Registry accounting is 31 `reconciling` and one `reconciled`. Physical
  presence is therefore not treated as completed project mapping.
- R2 is recorded as encrypted one-way backup evidence with `.git` excluded,
  not as code sync, Git history, or a live restoration source.

Future pickup must begin with fresh read-only probes, preserve dirty work,
resolve every worktree, obtain approval for one exact Phase A manifest, then
perform Phase B canonical-record write/readback before reconciliation closes.

This checkpoint is documentation and coordination only. No repository moved;
no branch, worktree, registry transition, R2 object, provider, session,
deployment, stage, commit, or push was changed by this preparation.

## 2026-08-07 Portfolio Workbench production repair and mapping-session checkpoint

The founder-authorized Workbench repair is complete. This deployment was a
separate bounded production action; it did not broaden the relocation packet's
authority and did not execute any Phase 10 move or reconciliation transition.

Production repair evidence:

- The authenticated custom route originally returned the Worker's generic
  `{"error":"not found"}` response because the Labs deployment predated the
  Workbench route.
- After the route-bearing build was promoted, Plexus authorization still failed
  because the configured custom TeamForge hostname has its own Cloudflare Access
  application. That application intercepted the forwarded Curious JWT before
  TeamForge could validate it.
- PR #288 changed only the Labs `PLEXUS_WHOAMI_URL` origin to TeamForge's direct
  Workers endpoint and added a regression test. It merged as
  `648523f46055588f2b6719c613f3d7d56f438eed`.
- The exact production Worker Version is
  `858d7234-da0c-4d9f-800b-315cd095d08e`, served by deployment
  `cb031f40-62a8-4db2-82b4-d1a22c583a9f` at 100 percent traffic.
- Immediate rollback Version `5829e431-2db2-47b5-9c02-d5490d8baf76`
  remains resolvable. The pre-Workbench historical Version
  `66bfd34b-0eaf-430b-84e1-b43f0d550835` also remains resolvable.
- All 21 existing secret bindings remained present. The sole intentional
  binding-value change was `PLEXUS_WHOAMI_URL`; candidate and production each
  exposed the same 34 binding names and types.
- The merged checkout passed 21 focused Workbench tests, the complete
  deterministic release gate, a strict Labs-config Wrangler dry run, candidate
  health and fail-closed route probes, and post-promotion direct health.
- The already authenticated Codex browser tab now renders title
  `Thoughtseed Portfolio Workbench`, artifact
  `portfolio-workbench@v3; offline; proposal-only`, heading
  `Plan the portfolio72`, and the 72-record catalog with zero console errors.

Mapping-session preparation is recorded in
`docs/continuity/cambium-relocation-portfolio-reconciliation-prep.md` and
commented on GitHub issue #287. It defines the proposal schema
`thoughtseed.portfolio-folder-mapping-proposal.v1`, the stable identity join,
the read-only review flow, and the exact observed portfolio accounting:

- 25 top-level directories: 22 standalone repositories plus three non-Git
  containers.
- Ten nested primary repositories inside those containers, for 32 logical
  repositories total.
- One Parkarea linked worktree, excluded from logical-project counting.
- Registry state of 31 `reconciling` and one `reconciled`.

The current 72-record Workbench remains offline and proposal-only; the topology
overlay described by the mapping-session contract is prepared planning, not a
claim that this UI feature is already implemented. Future implementation must
join TeamForge/stable identity, verified GitHub identity, packet digest,
registry evidence, topology, and current path without treating a folder name as
canonical identity.

No repository, project folder, linked worktree, registry transition, R2 object,
session, or native client store was moved or mutated by the mapping preparation.
The packet remains `draft-held`; relocation still requires reviewed-held status,
an exact manifest, owner approval, and post-move canonical write/readback.
