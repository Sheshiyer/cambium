# Project handoff

## Checkpoint

- Status: `reviewed-held`
- Portfolio: `thoughtseed`
- Repository: `cambium`
- Registry WorkObject: `sapling:cambium`
- GitHub: `Sheshiyer/cambium`

### 2026-08-11 Plexus GitHub-App knowledge-gateway checkpoint

- Approved knowledge authority: private GitHub repository `Sheshiyer/thoughtseed-labs`; the local Labs checkout is not a runtime source.
- Routine knowledge reads enter through Plexus's existing GitHub App control plane. The Worker validates one verified TeamForge project, mints a numeric-repository-scoped short-lived read token, resolves one commit, and fetches only exact routine-allowlisted paths.
- Cambium receives only bounded excerpts and commit/file-SHA provenance through `PLEXUS_KNOWLEDGE_URL`; it holds no GitHub credential. Plexus D1 remains identity/repository authority, not a knowledge store or inference backend.
- `CONTEXT_PROJECTIONS` R2 binding and its projection-write route are retired for the knowledge plane; `CAMBIUM_CORTEX` remains the Vectorize retrieval index. Existing `BRIDGE_DB` and `THOUGHTSEED_VAULT` bindings remain only for separately governed operational/evidence paths.
- No deployment, Vectorize upsert, R2/D1 mutation, or secret provisioning was performed by this checkpoint. User-facing Plexus role enforcement for context retrieval remains a follow-up, fail-closed wiring task.

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
- Root map: `docs/project-management/portfolio-roots.v1.json`, SHA-256 `d272bca5eee3c863bf351a8dfa4bbe144147ff813a55fde5f413c00356e6acbf`.
- Destination headers were written to both `<projects-root>/<portfolio>/` roots. Only `PORTFOLIO.md` and `portfolio-map.v1.json` were created per root; the directory/inode digest stayed identical before and after and no grouping directory was created.
- `thoughtseed-labs` is recorded as the R2-synced vault infrastructure context, never as a WorkObject folder. Tryambakam `_archive` and `selemene-engine-worktrees` remain outside the 30 active Projects.
- The offline Import/Copy/JSON/Markdown/Reset header is retired. Thoughtseed intake now exposes `Save & queue repository review`; Tryambakam Project intake exposes `Start project ingestion`.
- Founder actions POST only to `/v1/admin/portfolio/actions`; the Worker validates a closed schema against the exact shipped root-map/catalog digests, canonical WorkObject identities, and reviewed shallow Tryambakam Project paths before writing immutable/idempotent R2 evidence and then a bounded `pending-governed-intake` trigger. R2 is evidence, not workflow authority; D1 Goal Graph remains the sole operational writer.
- Hosted action tracking: issue #296 in GitHub Project #14.
- `pnpm check` passes 47 active focused tests with one historical fixture skip; eight action/store tests and ten exact Worker route tests pass. Exact hosted artifact is 352,037 bytes, SHA-256 `a195927aaa9dff17326e52022a1f868a13e375456ff2e2df911124fe460b2348`.
- Local browser proof covers the portfolio structure at 390, 768, and 1440 pixels with zero horizontal overflow; the exact final artifact smoke separately proves both hosted action labels, the same-origin endpoint, CSP allowance, and retired export controls. Live production action proof remains promotion-gated.
- Production remains unchanged and issue #293 remains blocked by human packet review #292.

### 2026-08-07 Thoughtseed governed project-birth checkpoint

- This checkpoint supersedes the earlier active Tryambakam Workbench behavior without deleting its reviewed static root evidence. The active Workbench now renders Thoughtseed only; Tryambakam · Noesis folders, root headers, and snapshots remain unchanged outside the UI.
- Branch: `codex/portfolio-ingestion-headers`; pull request [#297](https://github.com/Sheshiyer/cambium/pull/297); governed-project-birth tracking [#298](https://github.com/Sheshiyer/cambium/issues/298) is In Progress in GitHub Project #14.
- The visible `New Thoughtseed project` form fixes request source to `local-founder`, collects name, safe slug, explicit origin, and conditional client family, and displays the origin-derived Sapling, Internal Program, or Client Branch classification without a type override or caller-selected path.
- Explicit local-founder intents may become execution-ready after closed validation. Agent, RBAC, dgchat, and system intents remain Founder-Gate-pending unless the Worker resolves `gate:thoughtseed:<receipt-id>` from its authoritative KV binding and verifies an active founder `approve` record whose subject is the exact normalized intent digest. Inline receipt claims are references, never authority.
- The standalone executor is local-founder-only unless a trusted host injects the authoritative Gate resolver. It pins root map `d272bca5eee3c863bf351a8dfa4bbe144147ff813a55fde5f413c00356e6acbf` and catalog `18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542`, derives only `thoughtseed/<slug>`, rejects symlink/existing/nested/traversal destinations, initializes Git without a remote, materializes the selected workflow, and cleans its exact new target after partial failure.
- Successful local execution creates the seven-document project/workflow packet plus `.project/project-ingestion-receipt.v1.json` and `.project/project-index-proposal.v1.json`, both honestly held at `pending-cambium-ingestion` until GitHub repository identity and Cambium index reconciliation occur.
- `pnpm --dir apps/portfolio-cartographer check` passes 47 active tests with one historical skip plus lint, build, bundle, source audit, CSP, and hosted smoke. The exact hosted artifact is 347,261 bytes, SHA-256 `95c1ef259c3de88911ee02b983b3add23cbbdc099030e1a87a2f4e5c8140820e`, and matches the generated Worker embed.
- Focused Worker/action-route verification passes 21/21; temporary-root executor verification passes 7/7, including authoritative Gate mismatch, stale digest, symlink, and rollback denial paths. The deterministic release gate passes across core, 37 integration, mobile viewport, 99 R3F, R3F build, and 5 desktop packaging tests.
- Direct browser proof shows no active Tryambakam marker, correct Sapling and Client Branch derivation, conditional client-family input, shallow destination preview, disabled unauthenticated local writes, and zero browser errors. The updated local proof remains at `http://127.0.0.1:4178/bundle.html` for founder review.
- Independent re-audit reports no remaining findings. The first audit's two P2 findings—self-asserted Gate authority and unpinned executor digests—and the later P3 test gap for symlink/rollback behavior are closed.
- No project folder, portfolio root, Vault/R2 copy, production Worker, Goal Graph, registry, provider, remote repository, or deployment state was created, moved, or mutated. Production remains separately blocked by human packet review #292 and promotion gate #293.

### 2026-08-08 packet review checkpoint

- Owner approval was given in the active Codex task to merge PR #297 and make
  the reviewed Portfolio Workbench edits live on production.
- The six-file repository packet was re-read: `PROJECT.md`, `AGENTS.md`,
  `CLAUDE.md`, `.project/CONTEXT.md`, `.project/HANDOFF.md`, and
  `.project/project.yaml`.
- No packet fields were flagged for correction. Registry evidence, repository
  identity, governance boundaries, and the relocation hold remain intact.
- Packet status is moved from `draft-held` to `reviewed-held`.
- This review does not authorize filesystem relocation, Vault/R2 copy changes,
  registry transition, session migration, provider changes, Goal Graph writes,
  project-folder creation, or GitHub repository creation.
- Production promotion remains governed by issue #293, exact Worker Version
  proof, binding parity, rollback preservation, and post-promotion readback.

### 2026-08-08 Thoughtseed project-closeout workflow checkpoint

- Branch: `codex/portfolio-closeout-workflow`, based on production `main` in
  an isolated clean checkout.
- The Workbench now includes terminal `Completed / Closed` workflow grammar.
  Receipt-backed closeouts leave active views and remain visible only in the
  `Completed / Closed` view.
- Every focused Thoughtseed WorkObject has a `Closeout` tab for disposition,
  final summary, handoff Markdown path, closeout receipt JSON path, agent
  memory JSON path, R2 vault prefix, active-index disposition, optional
  successor, and six required confirmations.
- Hosted admin actions now accept `close-work-object`, validate
  `thoughtseed.project-closeout.v1`, write immutable/idempotent R2 evidence
  before the bounded `project-closeout` trigger, and preserve Goal Graph
  isolation.
- Local executor command: `npm run project:closeout`. It supports dry-run
  planning and, in execute mode, writes `.project/HANDOFF.md`,
  `.project/project-closeout-receipt.v1.json`,
  `.project/agent-memory-projection.v1.json`, and
  `.project/finished-index-delta.v1.json` for the selected project root.
- Contract: `docs/project-management/thoughtseed-project-closeout.v1.json`.
  Design and execution:
  `docs/plans/2026-08-08-thoughtseed-project-closeout-workflow-design.md` and
  `docs/plans/2026-08-08-thoughtseed-project-closeout-workflow-implementation.md`.
- Verification: `pnpm --dir apps/portfolio-cartographer check` passed 49
  active tests with one historical skip, lint, build, bundle, standalone audit,
  CSP smoke, and hosted artifact smoke. Generated hosted artifact is 358,803
  bytes, SHA-256
  `1d15866bbe085091b13a482e254a10094b49ea25f0c6c3c3af0a2d7a2d0e3540`, and
  the generated Worker embed was refreshed from that bundle.
- Verification: `npm test` passed 1568/1568 and `git diff --check` passed.
- The closeout executor tests prove dry-run no-write behavior, execute-mode
  temporary-root handoff/memory/index outputs, stale digest rejection,
  incomplete confirmation rejection, unsafe path rejection, and symlink-root
  rejection.
- No project folder was moved, copied, nested, deleted, or reorganized. No
  Vault/R2 copy, GitHub issue, production Worker, Goal Graph, provider,
  canonical registry, or deployment state was mutated by this checkpoint.

### 2026-08-08 closeout discoverability production follow-up

- Branch: `codex/portfolio-closeout-discoverability`, after PR #300 production
  promotion.
- Production browser readback proved the closeout workflow was present in the
  shipped bundle, but founder-visible affordances were too hidden: `Closeout`
  appeared only inside focused detail and `Completed / Closed` did not read as
  project archive / finished work.
- The Workbench now labels the terminal smart view as
  `Project Archive / Finished Work`, labels the drawer tab as
  `Finish / Closeout`, and shows a visible `Finish / close work` action on each
  active WorkObject card. That action opens the existing receipt-backed
  closeout drawer; it does not bypass handoff, R2 manifest, memory, active-index,
  downstream-flow, or server-action readiness gates.
- Verification: `pnpm --dir apps/portfolio-cartographer check` passed 49 active
  tests with one historical skip, lint, build, bundle, standalone audit, CSP
  smoke, and hosted artifact smoke. Generated hosted artifact is 359,330 bytes,
  SHA-256 `d46076f15da758ccba7ab3edb863000a48b5057296079ae7550730c4e941ebea`,
  and the generated Worker embed was refreshed from that bundle.

### 2026-08-08 project/R2 mapping execution-plan checkpoint

- Branch: `codex/project-r2-mapping-plan`, rooted at production `main` commit
  `9de273ebf4aefa24f037a0c87bf3194500066e67`.
- A fresh shallow GitHub checkout was created for new-root Cambium pickup. The
  pre-existing new-root `cambium` folder was left untouched because it was not
  an exact Git checkout.
- Execution plan:
  `docs/plans/2026-08-08-project-r2-mapping-execution.md`.
- The plan converts `docs/project-management/portfolio-root-ingestion-issue.md`
  into bite-sized reviewed batches for Workbench-driven project/R2 mapping.
- First batch is evidence-only: active authority proof, read-only folder
  inventory, and Temperance/OmniRoute/Ollama/ClinePass rail preflight.
- The plan preserves shallow folder grammar and keeps `thoughtseed-labs` as
  R2/vault infrastructure context, never as a WorkObject folder.
- The current R2 role remains immutable/idempotent evidence and encrypted
  durability. Any R2-primary or two-way-sync change is explicitly separated as
  a future owner-approved contract update.
- No worker dispatch, R2 object write, folder move, registry transition,
  provider setting change, Goal Graph write, production deployment, or GitHub
  issue mutation was performed by this checkpoint.

### 2026-08-08 project/R2 mapping first-batch evidence checkpoint

- Executed Tasks 1–3 from
  `docs/plans/2026-08-08-project-r2-mapping-execution.md` only, then stopped at
  the plan's founder feedback gate.
- Active checkout proof: branch `codex/project-r2-mapping-plan`, remote
  `https://github.com/Sheshiyer/cambium.git`, local HEAD
  `7578696d4f5a26772d696a46068f9cc45a151fa0`, and GitHub `main` HEAD
  `9de273ebf4aefa24f037a0c87bf3194500066e67`.
- Production Worker proof: `cambium-quests` newest deployment is 100% on
  version `c30ee312-832b-47d5-843c-0372c143920c`; rollback version
  `2b8ab00a-97ed-4160-a3ce-ecc5f87d722d` remains visible.
- Authenticated Workbench browser proof: production
  `/admin/portfolio/web` exposes `Portfolio Workbench`, `New Thoughtseed
  project`, `Project Archive / Finished Work`, `Finish / close work`, and, in
  the Unplanned view, 18 `Review repository & map` buttons and 18
  `Finish / close work` buttons.
- Root-map proof: root headers exist under the Thoughtseed project root,
  `portfolio-map.v1.json` carries snapshot digest
  `d272bca5eee3c863bf351a8dfa4bbe144147ff813a55fde5f413c00356e6acbf`, and the
  committed root-map file SHA-256 is
  `f2f7385405754a913bcf4f11443ce86f6c3e18483f978c674e29180b68578aff`.
- Exact Git top-level proof: the existing shallow `cambium` folder is not an
  exact Git checkout and must not be silently treated as authoritative. The
  temporary `cambium-authoritative` folder is an exact Git checkout, but remains
  an unmapped physical gap until a founder-approved promotion/swap decision.
- Folder inventory evidence:
  `docs/evidence/2026-08-08-project-r2-folder-inventory.json` and
  `docs/evidence/2026-08-08-project-r2-folder-inventory.md`.
- Folder inventory counts: 59 depth-one physical folders, 47 mapped folders,
  1 infrastructure folder, 8 exact Git roots, 0 linked-worktree Git files,
  8 folders with nested repositories, 10 nested repositories, 43 non-Git
  folders, 11 unmapped physical gaps, 1 mapped-folder identity gap, and 0
  missing mapped folders.
- Dispatch preflight evidence:
  `docs/evidence/2026-08-08-temperance-dispatch-preflight.md`.
- Dispatch result: `temperance-batch`, `temperance-claude`, `te-dispatch`, and
  `clinepass` are missing. `omniroute`, `ollama`, `codex`, and `gh` are
  available. No Temperance batch, ClinePass, OmniRoute, Ollama, or external
  worker output was accepted because the governed batch rail and model-output
  receipt gates were not satisfied.
- No worker dispatch, R2 object write, folder move, registry transition,
  provider setting change, OmniRoute setting change, Goal Graph write,
  production deployment, or GitHub issue mutation was performed by this
  evidence batch.

### 2026-08-08 project/R2 mapping gap-settlement checkpoint

- Continued from the first-batch evidence at founder request to review and
  settle the 11 unmapped physical folders plus the 1 mapped identity gap.
- Settlement artifacts:
  `docs/project-management/project-r2-mapping-proposals.v1.json` and
  `docs/project-management/project-r2-mapping-proposals.md`.
- R2 evidence-prefix artifacts:
  `docs/project-management/project-r2-evidence-prefixes.v1.json` and
  `docs/project-management/project-r2-evidence-prefixes.md`.
- Grammar applied: only Thoughtseed-originated ventures may become Saplings;
  client-originated work remains Client Branch; shared capability tooling,
  brand systems, and operator surfaces remain Internal Programs; cleanup
  archives, temporary checkouts, external/vendor clones, and unowned dependency
  references do not become WorkObjects.
- Settled mapping decisions:
  `Airdronauts` maps as nested client branch evidence for
  `branch:airdronauts-panorama-viewer-delivery`;
  `brandmint-oracle-aleph` maps to `program:meristem-brand-system`;
  `motionsites-skills` maps to internal Meristem/skill capability programs;
  `professional-headshot-suite` and `readme-skill` map to capability/operator
  internal programs; `website` is only a container and its nested Temperance
  landing page repo maps to `program:temperance-hermes`.
- Settled exclusions: `_home-cleanup-2026-08-08` is a cleanup archive,
  `openfang` is an external/vendor reference, and `cambium-authoritative` is a
  temporary exact Cambium checkout, not a second WorkObject.
- Mapped identity gap: `cambium` remains `sapling:cambium` /
  `program:cambium-operating-fabric`, but physical authority is the exact
  `cambium-authoritative` checkout until a separate founder-approved
  promote/swap handles the stale non-Git `cambium` folder.
- Remaining founder-review decisions before action wiring: whether
  `plugins/conducty-codex` gets its own GitHub identity or folds into operator
  utilities, how Airdronauts overlaps with `panaroma-webapp`, and how to
  physically de-duplicate the nested Temperance landing page. SAFVR is no
  longer a founder-review item; it is approved as a closed Client Branch.
- R2 remains immutable/idempotent evidence and durability only. No R2-primary
  or two-way-sync behavior is introduced by this checkpoint.
- No folder move, registry write, R2 object write, GitHub issue mutation,
  provider setting change, OmniRoute setting change, Goal Graph write,
  production deployment, or Workbench runtime change was performed by this
  settlement batch.

### 2026-08-08 project/R2 mapping execution checkpoint

- Founder approval in the active Codex task executed the gap settlement into
  repository-owned Workbench data. No physical folder move, live R2 write,
  registry write, GitHub issue mutation, provider change, Goal Graph write, or
  production deployment was performed by this local execution.
- The Thoughtseed root map now accounts for all 59 depth-one physical folders:
  54 WorkObject/proposal folders plus 5 explicit infrastructure/exclusion
  folders (`_home-cleanup-2026-08-08`, `cambium-authoritative`, `openfang`,
  `thoughtseed-labs`, and `website`).
- Thoughtseed-only directory comparison against
  `/Volumes/madara/2026/Projects/thoughtseed` passes with zero missing and zero
  unexpected folders. Full root-header writing still stops on separate
  Tryambakam-Noesis drift, which is intentionally outside this Workbench pass.
- New root-map digest:
  `d272bca5eee3c863bf351a8dfa4bbe144147ff813a55fde5f413c00356e6acbf`.
- New catalog/source digest:
  `18d5efd69376923be383043894124e7cdda27958a5f47aafe4a6db6342afe542`;
  catalog summary is now 73 WorkObjects, including 38 client branches.
- SAFVR is recorded as `branch:safvr-landing-page`, classified as a Client
  Branch, and seeded as completed/closed with receipt
  `pa_55d6162386ed202608080001`. It should stay out of active workflows unless
  a new founder-gated SAFVR branch is opened.
- Closeout seed files:
  `docs/project-management/closeouts/safvr-landing-page-handoff.md`,
  `docs/project-management/closeouts/safvr-landing-page-closeout.v1.json`, and
  `docs/project-management/closeouts/safvr-landing-page-agent-memory.v1.json`.
- Regenerated app and Worker embeds: `apps/portfolio-cartographer/bundle.html`
  and `workers/quests/src/portfolio-workbench.generated.ts`.
- Verification: `pnpm --dir apps/portfolio-cartographer test`,
  `pnpm --dir apps/portfolio-cartographer lint`,
  `pnpm --dir apps/portfolio-cartographer bundle`,
  `pnpm --dir apps/portfolio-cartographer standalone:smoke`, and focused
  Worker portfolio/admin-action/workbench route tests all pass.

### 2026-08-08 GitHub repository mapping audit checkpoint

- Continued the project/R2 mapping preparation with a read-only authenticated
  GitHub inventory pass across `Sheshiyer`, `thoughtseedlabs`,
  `thoughtseed-labs`, and all repositories visible through the current
  authenticated account.
- Evidence artifact:
  `docs/evidence/2026-08-08-github-repository-mapping-audit.v1.json`.
- Founder-review batch proposal:
  `docs/project-management/github-repository-mapping-batch-proposals.md`.
- Audit counts: 303 affiliated repositories visible to the authenticated
  account, 259 explicit repositories across the three requested owners, 312
  unique repositories after combining both views, 285 repositories still
  unmapped by the conservative exact-match signal, 268 non-fork unmapped
  repositories, 204 non-fork unmapped repositories pushed since 2025-01-01, and
  20 unmapped `thoughtseedlabs` / `thoughtseed-labs` repositories.
- The audit intentionally does not commit the complete private repository
  inventory. It records bounded counts, the 20 Thoughtseed org rows, the
  owner-level distribution, and review batches only.
- The next batches are separated into Thoughtseed org history, client-branch
  repository clusters, Sapling provenance, internal programs/vault context, and
  root-map/catalog repair.
- Root-map/catalog repair found one immediate identity bug:
  `virtualtryon-3d` references `sapling:virtualtryon`, but that WorkObject does
  not exist in the current catalog. It should stay needs-review until founder
  confirmation or catalog repair.
- Grammar reaffirmed: only Thoughtseed-originated ventures may become Saplings;
  client-originated work remains Client Branch even when new; completed or
  closed work requires the handoff/receipt/memory/finished-index closeout
  packet before it leaves active workflow.
- R2 remains immutable/idempotent evidence and durability only. No R2-primary
  or two-way-sync behavior is introduced by this checkpoint.
- No GitHub issue, GitHub Project item, repository setting, folder move, R2
  object write, registry write, provider change, Goal Graph write, production
  deployment, or Workbench runtime change was performed by this audit.

### 2026-08-08 Temperance GitHub mapping dispatch checkpoint

- Founder asked to proceed with `temperance-parallel-dispatch` after the
  GitHub repository mapping audit.
- External Temperance rail was checked first. `temperance-batch` was installed
  but unusable because it printed `dispatch-tasklist.sh not found`;
  `temperance-claude`, `te-dispatch-paid`, `te-dispatch`, and `clinepass` were
  unavailable. No external batch output was accepted and no Sol-family model
  was used.
- Fallback used the skill-approved in-session subagent rail with four
  independent read-only lanes: Thoughtseed org history, client branch clusters,
  Sapling provenance/catalog repair, and internal programs/vault context.
- Dispatch receipt:
  `docs/evidence/2026-08-08-temperance-github-mapping-dispatch.md`.
- Executable founder-review queue:
  `docs/project-management/github-repository-mapping-action-queue.v1.json`.
- Batch 1 result: all 20 `thoughtseedlabs` / `thoughtseed-labs` repositories
  were classified with immutable GitHub IDs. Most are historical/archive/fork
  evidence; `DezinerAI` and `lockwell-portal` remain needs-review;
  `Vibrasonix-Website` is Sapling evidence only because it is a fork/site row.
- Batch 2 result: 70 client-branch candidate repository rows were grouped
  across 10 client families with zero Sapling promotions. Symphonics needs
  root-map/account coverage review.
- Batch 3 result: direct Sapling evidence candidates are separated from
  founder-hold rows. Klear Karma, Kristudios, ParkArea, and Tirak still require
  origin/product-vs-client split decisions. `virtualtryon-3d` remains blocked
  because `sapling:virtualtryon` is absent from the current catalog.
- Batch 4 result: internal program/vault mapping remains evidence-only.
  `thoughtseed-labs` is R2/vault infrastructure context, not an active
  WorkObject folder. Multi-bind program rows require one idempotent receipt per
  WorkObject prefix.
- The queue specifies required payload fields for later mutation:
  founder approval, WorkObject id/kind, origin assertion, repository immutable
  identity, root-map state, lifecycle, catalog/root-map digests, R2 receipt id,
  idempotency key, prefix, and blocked reason where applicable.
- No GitHub issue, GitHub Project item, repository setting, folder move, R2
  object write, registry write, provider change, Goal Graph write, production
  deployment, Workbench runtime change, or catalog/generated UI change was
  performed by this dispatch.

This packet was drafted by the packet-authoring tool from registry and
repository evidence. It was reviewed under GitHub issue #292 and moved to
`reviewed-held` by owner-approved commit.

### 2026-08-11 TeamForge GitHub knowledge-plane rollout checkpoint

- The Labs Cloudflare account is now the deployment authority for both
  `teamforge-api` and `cambium-quests`; the knowledge caller uses the direct
  `teamforge-api.thoughtseedlabs.workers.dev` origin, never the Access-gated
  custom hostname.
- Labs D1 records the canonical `teamforge` project and its verified
  `Sheshiyer/thoughtseed-labs` GitHub-App repository binding. The TeamForge
  Worker has the fixed `daily-standup` routine policy, while Cambium has only
  the matching gateway bearer; neither worker holds a GitHub PAT.
- Both Workers were deployed and a bearer-authenticated direct-origin probe
  now succeeds: it returns one allowlisted, bounded document from
  `Sheshiyer/thoughtseed-labs` with a commit pin. The GitHub App private key,
  client secret, webhook secret, and state-signing secret were restored as
  Labs Worker secrets; their values are neither recorded nor recoverable here.
- Hermes-to-Vectorize remains intentionally unstarted: it requires a separate
  bounded ingestion implementation using the now-proven provenance-bearing
  snapshot. R2 and D1 retain operational/evidence and authorization roles
  only; neither is the company-knowledge source.

## Completed

- Registry WorkObject matched via `sourceInventory`.
- Packet drafted: all six files present.
- No fields were flagged for review.

## Next action

Close any remaining repository/origin audit gaps under #290 and migrate
project-local planning authority through #291. Production promotion #293,
relocation-manifest approval, and live-apply approval remain separate steps.

## Verification

```bash
npm install
npm run test
git status --short
```

No registry, capsule, relocation, session, Paseo, provider, or deployment
mutation has been performed by drafting this packet.
