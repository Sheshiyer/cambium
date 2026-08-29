# 2026-08-12 GitHub Issue Reconciliation Proposal

No GitHub mutation APIs were called for this proposal.

## Evidence corpus used for all issue actions

- `.planning/execution/2026-08-12-source-reconciliation.v1.json` issue ledger and task-state matrix.
- `.planning/execution/2026-08-12-source-reconciliation.md` for issue-row evidence formatting.
- `docs/project-management/portfolio-root-ingestion-issue.md` for repository/origin and planning-authority linkage.
- `.project/HANDOFF.md` current checkpoint and preserved continuity context.
- `docs/plans/2026-08-07-portfolio-continuity-board-and-repository-map.md` for continuity-task status evidence.
- `docs/plans/2026-08-12-github-planning-reconciliation-execution.md` for the active execution lane and task authority boundaries.
- `docs/architecture/contracts/tg-miniapp-contract-v2.md` and `docs/architecture/contracts/mission-fabric-v1.md` for runtime auth/proof and projection boundaries.
- `docs/runbooks/telegram-operator-surface.md` and `docs/runbooks/goal-graph-telegram-lifecycle.md` for runtime/approval lanes when mapped to execution mode.

## Issue-level execution posture (14 open issues)

1. `#275` **[enhancement] One-line agency-grade website stack (Claude Code)**
   - **Current state**: `inbox-triage`, evidenced by `source-reconciliation.v1.json` missingAuthority text noting no active execution mapping.
   - **Action**: keep in scoped intake triage until a bounded product lane and owner authority are created; no residual execution starts without a new issue-level intake brief.

2. `#276` **[enhancement] Reusable animation character-sheet prompt template**
   - **Current state**: `inbox-triage`, with no design/asset ownership or runtime ticket in source evidence.
   - **Action**: hold as product-brief backlog triage and convert only if a concrete ownership contract and `ownedFiles` ownership matrix are added in a future scoped issue.

3. `#277` **[enhancement] Design skills for AI agents (curated list + Refactoring UI plugin)**
   - **Current state**: `inbox-triage`, classified as general enhancement backlog in source evidence.
   - **Action**: keep triage-only until mapped to a specific product authority boundary and an explicit request to code.

4. `#249` **Reconcile preserved pending role-task directives before native runner enablement**
   - **Current state**: `residual`, owner/provider/runtime-gated per source reconciliation and unchanged in continuity board context.
   - **Proposed action**: execute a residual cleanup only after runtime owner + provider approval is present and receipt-backed proof is available for pending directives.
   - **Source cites**: `.planning/execution/2026-08-12-source-reconciliation.v1.json` (missingAuthority notes no merged runtime/test/receipt closure), `.project/HANDOFF.md` (issue families #280-#285 preserved), continuity-board plan section H4.

5. `#252` **reporting: publish curated client-contract projections for weekly routines**
   - **Current state**: `residual`, owner/provider/runtime-gated.
   - **Proposed action**: route to residual reporting lane with explicit ownership boundaries and a validated provider approval receipt before attempting any publish/emit task.
   - **Source cites**: `source-reconciliation.v1.json` missingAuthority, `source-reconciliation.md` no implemented runbook closure.

6. `#280` **continuity: prove approval-gated contact and mailbox operations**
   - **Current state**: `approval-gated` in source reconciliation; explicitly says no approved external-provider proof.
   - **Proposed action**: preserve as runtime-gated residual: block any progress until provider owner decisions and provider-issued receipts are captured.
   - **Source cites**: `source-reconciliation.v1.json` missingAuthority, continuity plan board row B5/B6, plus `.project/HANDOFF.md` continuity retention context.

7. `#281` **continuity: close founder brand truth → atlas → public site loop**
   - **Current state**: `residual`, owner/provider/runtime-gated.
   - **Proposed action**: continue residual execution for Brand truth synchronization and site-loop closure only after issue-owner and provider bounds are explicit in evidence.
   - **Source cites**: `source-reconciliation.v1.json` and continuity plan B1/B2/S2 entries.

8. `#282` **continuity: decide and prove Cloudflare ownership and hygiene cleanup**
   - **Current state**: `blocked` with source-ID drift; source corpus indicates pre-provider rewrite is required.
   - **Proposed action**: perform source-ID rewrite and boundary cleanup first, then provider operations only if account/zone ownership and approval receipts are available.
   - **Source cites**: `source-reconciliation.v1.json` and `portfolio-root-ingestion-issue.md` dependency chain for authority migration context.

9. `#283` **continuity: prove Hermes execute → outcome → ACK and restore signal**
   - **Current state**: `blocked`, owner/provider/runtime-gated.
   - **Proposed action**: treat as residual closed-loop proof task; do not close or close out runbook lanes until execute→outcome→ACK evidence path is live and replay-validated.
   - **Source cites**: `source-reconciliation.v1.json` missingAuthority, continuity plan H2, runbook `goal-graph-telegram-lifecycle.md` authority steps.

10. `#284` **continuity: close company-website quest definition → ledger → delivery loop**
    - **Current state**: `residual`, active ledger-delivery proof needed.
    - **Proposed action**: execute only as ledger-delivery proof lane (task and evidence for quest definition, ledger row, and delivery action must be in source-reconciliation-eligible form).
    - **Source cites**: `source-reconciliation.v1.json`, continuity plan H3/S3, and `mission-fabric-v1.md` projection-read-only boundaries.

11. `#285` **continuity: preserve and close the unfinished brand/CF/Hermes board**
    - **Current state**: stale umbrella; its work is already decomposed into independently open child issues and its claimed canonical source file is absent.
    - **Proposed action**: close the umbrella now with links to the still-open children. Closing the umbrella must not close or relabel any child.
    - **Source cites**: `.planning/execution/2026-08-12-source-reconciliation.md` + `.project/HANDOFF.md` continuity checkpoint notes.

12. `#287` **relocation: prepare Cambium Git-graph move and portfolio reconciliation**
    - **Current state**: stale after the recorded Cambium phase-one and Temperance phase-two relocation receipts.
    - **Proposed action**: close the preparation issue, preserve the apply receipts, and keep unresolved repository/classification work only in `#290`/`#291`. No new relocation mutation is authorized.
    - **Source cites**: `source-reconciliation.v1.json`, Handoff continuity + relocation checkpoints in `docs/project-management/relocation-manifests/*` and `HANDOFF.md`.

13. `#290` **portfolio: audit repository origin and classification mismatches**
    - **Current state**: residual mapping holds.
    - **Proposed action**: continue residual mapping audit in `portfolio-root-ingestion` packet with explicit per-folder holds and only close items with verified evidence attachments.
    - **Source cites**: `portfolio-root-ingestion-issue.md` and source-reconciliation residual entry.

14. `#291` **planning: migrate project-local authority into GitHub repositories**
    - **Current state**: `residual`, active authority migration lane.
    - **Proposed action**: keep active migration track residual and scoped to reviewed runbook + packet authority boundaries (no repository write operations without governance authority).
    - **Source cites**: `portfolio-root-ingestion-issue.md`, `.project/HANDOFF.md` checkpoint note, and active execution plan task list.

## Reviewed execution order

1. Apply the 14 issue actions and verify GitHub readback (`GIP-001`).
2. Resolve repository/classification holds and reduce the 80-task map in parallel (`GIP-002`, `GIP-003`).
3. Route raw intake and active branch packets to owning repositories (`GIP-007`, `GIP-008`).
4. Execute the owner-approved runtime chain: company website ledger, Hermes canary, then curated weekly context (`GIP-004` → `GIP-005` → `GIP-006`).

Provider cleanup, mailbox actions, public-site decisions, deployment, Telegram sends, and relocation remain outside this reviewed local batch.

## Validation notes

- Proposal covers all 14 issues; the manifest distinguishes ready, triage, runtime-gated, and content-gated work.
- No code or runtime mutations were proposed.
- This file and companion `.planning/2026-08-12-cambium-execution-wave.tasks.json` are the only files to create.
