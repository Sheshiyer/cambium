# Phase 5: Ralph and Temperance Flow Projection - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `05-CONTEXT.md`; this log preserves the analysis.

**Date:** 2026-08-19
**Phase:** 05-ralph-and-temperance-flow-projection
**Mode:** assumptions
**Areas analyzed:** Authority and Next-Action Precedence, Ralph Iteration Lifecycle, Skill/Combo/Provider Attribution, Dedicated Read-Only Flow Projection

## Assumptions Presented

### Authority and Next-Action Precedence
| Assumption | Confidence | Evidence |
|------------|------------|----------|
| Phase 5 derives the approved goal from `ISA.md`, the exact GSD transition from live `.planning/STATE.md`, and executable work only from the active phase plan; ambiguity produces `blocked`. | Confident | `ISA.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/README.md` |

### Ralph Iteration Lifecycle
| Assumption | Confidence | Evidence |
|------------|------------|----------|
| Ralph rereads durable state, selects one dependency-ready unit, verifies and persists through existing GSD/handoff surfaces, then exits without owning a mutable ledger. | Confident | `.planning/REQUIREMENTS.md`, `.planning/config.json`, `.planning/execution/2026-08-12-source-reconciliation.v1.json`, `docs/architecture/loops-to-graphs.md` |

### Skill, Combo, and Provider Attribution
| Assumption | Confidence | Evidence |
|------------|------------|----------|
| Cambium records route intent; fresh host Temperance receipts provide resolved provider attribution and freshness; provider policy stays host-owned. | Likely | `AGENTS.md`, `.temperance/project.json`, `.planning/config.json`, `PROJECT.md`, verified host-contract inspection |

### Dedicated Read-Only Flow Projection
| Assumption | Confidence | Evidence |
|------------|------------|----------|
| Phase 5 creates a separate deterministic machine/human flow projection that references but does not extend the closed Phase 4 Intent Graph vocabulary. | Likely | `docs/architecture/contracts/intent-graph-v1.md`, `scripts/intent-graph.mjs`, `scripts/intent-graph-sources.mjs`, `.planning/phases/04-provenance-preserving-intent-graph/04-VERIFICATION.md` |

## Corrections Made

No corrections — the user explicitly selected **Yes, proceed** and confirmed all four assumptions as Phase 5 decisions.

## External Research

- Host contract inspection confirmed `temperance-next-wave` remains proposal-only and approval-gated.
- Host contract inspection confirmed `te-dispatch-paid` is the bounded parallel execution route.
- Manifest receipts expose status, freshness, evidence pointers, routes, and redacted resolved-provider attribution while runtime/provider configuration remains host-owned.
