# Cambium Managerial Control Loop

## What This Is

Cambium is the operator-facing projection and durable control plane for Thoughtseed's living venture system. Milestone v0.3 proved one synthetic, internal-only service-agreement flow from typed intake through D1 leasing, Hermes execution, Temperance rendering, durable storage, and authenticated readback. The next milestone makes the enduring vision, renewable mission, finite goals, and evidence feedback loop explicit without creating another operational writer.

## Core Value

An operator action counts only when its authoritative task, lease, artifact, outcome, and readback are durable and replay-safe.

## Requirements

### Validated

- ✓ D1 owns native execution claims, fencing, terminal outcomes, and ACK eligibility — native execution proof release.
- ✓ Hermes polls the Worker on a durable timer and persists local attempt state — native execution proof release.
- ✓ REQ-01–REQ-06 prove one replay-safe D1-leased synthetic service-agreement draft from strict intake through immutable artifact readback.
- ✓ REQ-07–REQ-11 expose that same slice through feature-gated Telegram intake and a redacted D1 status projection, with live replay, rollback, allowlist, and access-revocation proof.
- ✓ ANCHOR-01–ANCHOR-04 establish canonical root `VISION.md` and renewable `MISSION.md`, distinguish repository Mission from bounded `FabricMission` records, and make supporting doctrine reference rather than duplicate those authorities — Phase 3 verification.
- ✓ GRAPH-01–GRAPH-05 establish a deterministic 19-node/25-edge read-only Intent Graph with source provenance, canonical overlay references, explicit lifecycle/gate semantics, and a shared boundary that prevents derived projections from re-entering the operational Goal Graph authority lane — Phase 4 verification.
- ✓ FLOW-01–FLOW-04 establish one deterministic Temperance next-action projection, a bounded execute/verify/CAS-persist/exit Ralph lifecycle, receipt-gated host attribution, and fail-closed non-authority boundaries without adding a mutable ledger or operational writer — Phase 5 verification.
- ✓ DOCS-01–DOCS-04 establish one five-class lifecycle map, exhaustive explicit-commit JSON/Markdown inventory readbacks, direct-owner navigation, recoverable historical evidence, and privacy-safe non-destructive stewardship — Phase 6 verification.

### Out of Scope

- External delivery, email, publication, e-signature, or signature requests — this slice stops at awaiting human approval.
- A real client agreement — the live canary uses a synthetic counterparty and creates no legal commitment.
- General-purpose shell or model execution — only one typed document command is enabled.
- Replacing Hermes, D1, Cambium, GSD, or the existing headless Temperance shadow runtime.

## Context

The July ecosystem audit found that direct agent and CLI primitives work while the operator path breaks at routing, state, renderer selection, and proof foldback. Native D1 claim/outcome and a route-only Temperance release are already live; this milestone connects the next bounded business command across those existing seams.

## Current State

- **Shipped:** v0.3 Managerial Control Loop on 2026-08-17.
- **Historical proof:** two completed v0.3 phases, two plans, and eleven checked requirements.
- **Accepted process debt:** the historical phases predate current GSD `VERIFICATION.md` files; their live evidence remains summary-attested and is archived in the milestone audit.
- **Active authority:** the root `ISA.md` owns the approved infinite-game documentation goal. This planning file does not replace it.
- **Phase 3 complete:** canonical Vision and Mission anchors, inherited doctrine overlays, Mission terminology boundaries, and deterministic anchor validation shipped on 2026-08-18.
- **Phase 4 shipped:** the provenance-preserving Intent Graph and shared projection foldback boundary passed independent verification 5/5, landed through protected PR #351 as `f1da858618bae5e15f4ac9a5fdd2141cabf76b6d`, and passed exact-main CI run `32152942949` on 2026-08-18.
- **Phase 5 complete:** Ralph and Temperance Flow Projection passed independent verification 4/4, completed FLOW-01–FLOW-04, and closed an 18-file code review with zero findings. Host command installation remains separately owner-approved and the repository fails closed when it is absent.
- **Phase 6 complete:** Documentation Stewardship passed independent verification 4/4 after closing the live STATE coherence gap; its review fixed all five Critical/Warning findings, and the final repository suite passed 1900/1900.
- **Next transition:** Run the Phase 6 security audit before beginning Phase 7 context gathering. Deployment, host/provider mutation, relocation, deletion, and externalization remain separately held.

## Current Milestone: v0.4 Cambium Infinite-Game Doctrine and Intent Graph

**Goal:** Consolidate Cambium's doctrine into a provenance-preserving infinite-game architecture anchored by canonical `VISION.md` and renewable `MISSION.md`, with ISA and GSD remaining the only goal and planning authorities.

**Target features:**

- Establish canonical root vision and mission anchors with explicit renewal rules and a clear distinction between repository Mission and bounded `FabricMission` nodes.
- Project vision → mission → finite goals → tasks → evidence → learning as a deterministic, provenance-preserving graph.
- Expose Ralph next actions, GSD transitions, skill-cluster and OmniRoute routes, gates, freshness, and stop conditions through Temperance without copying doctrine into generated manifests.
- Consolidate the named root, `MEMORY/`, and `docs/` corpus through an authority and lifecycle map that preserves historical evidence.
- Add deterministic validation that rejects duplicated doctrine, a third operational writer, stale projections, secrets, and machine-local paths.

## Active Requirements

- Keep ISA and GSD as the only goal and planning authorities.
- Add Phase 7 deterministic safety and handoff checks without creating a new authority or weakening the repository-only boundary.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Move invalidated requirements to Out of Scope with a reason.
2. Move validated requirements to Validated with a phase reference.
3. Add newly discovered requirements to Active.
4. Record material decisions in Key Decisions.
5. Recheck that What This Is still describes the product truthfully.

**After each milestone:**
1. Review every section against shipped evidence.
2. Recheck that Core Value remains the right priority.
3. Re-audit Out of Scope and its reasons.
4. Update Context and Current State from durable proof.

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
| Root-anchor plus inherited-overlay doctrine | Keeps one canonical vision and mission while allowing bounded contexts to inherit without copying authority | Approved for v0.4 |
| ISA and GSD remain the only goal/planning authorities | Prevents the manifest, Ralph loop, or documentation graph from becoming a third writer | Approved for v0.4 |
| Continue roadmap numbering at Phase 3 | Preserves the historical v0.3 phase lineage and avoids deleting retained phase evidence | Approved for v0.4 |
| Keep the Intent Graph a deterministic read-only projection | Preserves ISA/GSD/doctrine authority and prevents generated evidence from becoming a third writer | ✓ Proven in Phase 4 |
| Reject Goal Graph and Intent Graph projections at the shared fresh-authority boundary | Prevents derived evidence from folding back as a new operational command while ordinary authoritative intake remains accepted | ✓ Proven in Phase 4 |
| Keep Temperance flow and Ralph iteration read-only, finite, and content-addressed | Derives one approved action or fail-closed stop without creating a planner, queue, or mutable ledger | ✓ Proven in Phase 5 |
| Keep host/provider resolution outside Cambium and receipt-gated | Preserves owner-protected runtime policy while binding repository actions to verified task, route, snapshot, checkout, and evidence | ✓ Proven in Phase 5 |
| Generate documentation inventories only on demand from an explicit committed revision | Avoids recursively stale committed readbacks while preserving deterministic machine/human parity and zero writes | ✓ Proven in Phase 6 |
| Let historical directory precedence yield only to source-backed item exceptions | Keeps retained plans and evidence recoverable without allowing filename lookalikes to self-promote into current authority | ✓ Proven in Phase 6 |

---
*Last updated: 2026-08-20 after Phase 6 independent verification and review-fix closure*
