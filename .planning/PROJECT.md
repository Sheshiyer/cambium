# Cambium Managerial Control Loop

## What This Is

Cambium is the operator-facing projection and durable Cloudflare control plane for Thoughtseed managerial workflows. This recovery milestone proves one real business flow—a synthetic, internal-only service-agreement draft—from typed intake through D1 leasing, Hermes execution, Temperance policy and rendering, durable artifact storage, and authenticated readback.

## Core Value

An operator action counts only when its authoritative task, lease, artifact, outcome, and readback are durable and replay-safe.

## Requirements

### Validated

- ✓ D1 owns native execution claims, fencing, terminal outcomes, and ACK eligibility — native execution proof release.
- ✓ Hermes polls the Worker on a durable timer and persists local attempt state — native execution proof release.
- ✓ REQ-01–REQ-06 prove one replay-safe D1-leased synthetic service-agreement draft from strict intake through immutable artifact readback.
- ✓ REQ-07–REQ-11 expose that same slice through feature-gated Telegram intake and a redacted D1 status projection, with live replay, rollback, allowlist, and access-revocation proof.

### Out of Scope

- External delivery, email, publication, e-signature, or signature requests — this slice stops at awaiting human approval.
- A real client agreement — the live canary uses a synthetic counterparty and creates no legal commitment.
- General-purpose shell or model execution — only one typed document command is enabled.
- Replacing Hermes, D1, Cambium, GSD, or the existing headless Temperance shadow runtime.

## Context

The July ecosystem audit found that direct agent and CLI primitives work while the operator path breaks at routing, state, renderer selection, and proof foldback. Native D1 claim/outcome and a route-only Temperance release are already live; this milestone connects the next bounded business command across those existing seams.

## Constraints

- **Authority**: D1 owns task identity, lease, fencing, and terminal status.
- **Execution**: Hermes remains the only durable EC2 poller and supervisor.
- **Rendering**: Temperance must pin the Thoughtseed Contract Generator and DOCX renderer policies.
- **Safety**: The canary must remain synthetic, non-signable, and internal-only.
- **Storage**: D1 stores metadata and R2 stores immutable document bytes.
- **Compatibility**: Existing `canary.record` behavior and all legacy Worker routes must remain green.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use one typed `service_agreement.draft.render` command | Prevents general executor scope and makes validation exhaustive | ✓ Proven |
| Stop at `awaiting_human_approval` | Proves the business pipeline without authorizing a legal side effect | ✓ Proven |
| Store bytes in `thoughtseed-vault` R2 and receipts in D1 | Separates artifact storage from transactional authority | ✓ Proven |
| Keep legacy `.planning` GSD for this milestone | Matches existing project and recovery architecture | ✓ Proven |
| Treat Telegram as an adapter over the existing D1 loop | Avoids creating another orchestrator or execution authority | ✓ Proven |

## Next Milestone: Unfinished Planning Continuity

**Goal:** Preserve and close the 23 unfinished brand, Cloudflare, Hermes, quest,
contact, and website-delivery source IDs without turning historical claims into
runtime truth.

**Canonical continuity record:**
`docs/continuity/unfinished-brand-cf-hermes-board.md`

**Execution surface:** Parent GitHub issue #285; outcome issues #280–#284;
existing directive and weekly-context issues #249 and #252.

The milestone keeps the core value intact: work counts only when authoritative
state and durable receipts agree. Every source item therefore carries an evidence
class, dependency, approval gate, owner issue, and revalidation probe. Planning
this milestone authorizes no provider, runtime, registry, session, credential, or
deployment mutation.

## Parallel Preparation Milestone: Cambium Relocation and Portfolio Reconciliation

**Goal:** Prepare Cambium's complete Git graph for a future move into the
portfolio code root, then close the still-separate canonical project-record
reconciliation without treating R2 as code sync.

**Canonical continuity record:**
`docs/continuity/cambium-relocation-portfolio-reconciliation-prep.md`

**GitHub surface:** Issue #287. **Roadmap surface:** Phase 10 of
`.planning/ROADMAP-v0.4-continuation.md`.

Current evidence holds execution: live GitHub main owns the merged portfolio
implementation, the old portfolio worktree is absent, the primary checkout is
on a merged-but-divergent source branch with protected working bytes, four
linked worktrees remain attached, and the destination does not yet exist.
Twenty-five destination directories currently represent 32 logical repository
records, of which 31 remain `reconciling` and one is `reconciled`.

The preparation deliverable now also defines a read-only Portfolio Workbench
mapping-session packet. It preserves containers, standalone repositories,
nested primaries, and linked worktrees as different topology facts; joins only
through stable TeamForge and verified GitHub identity; and permits browser-local
review/export without filesystem, Git, Vault, registry, R2, or provider writes.
The current 72-record Workbench does not yet implement that topology overlay.

This milestone produces an owner-reviewable graph and manifest contract only.
It authorizes no move, rename, branch/worktree change, registry transition, R2
restore, provider call, session migration, commit, push, or deployment.

---
*Last updated: 2026-08-07 after relocation-preparation continuity capture*
