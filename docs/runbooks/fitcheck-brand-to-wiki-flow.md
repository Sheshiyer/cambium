# Fitcheck brand-to-wiki workflow

**Status:** historical governed procedure; revalidation required before reuse
**Updated:** 2026-08-10
**Purpose:** turn verified Fitcheck product and brand evidence into a private Astro wiki and Portfolio Workbench mapping. This runbook does not authorize sending, deployment, registry migration, or copying raw Cortex state into Git.

## Authority and boundaries

Use this order when sources disagree:

1. Current product evidence: the Fitcheck landing, Shopify listing, and verified backend behaviour.
2. Dated research/evidence ledger and explicitly labelled reconciliations.
3. Meristem brand artefacts as a controlled interpretation layer.
4. The private wiki and generated Workbench artefacts as derived outputs.

This repository does not establish current commercial pricing. Re-read pricing
from an approved, dated product source and compare it with the public Shopify
display before publishing or changing any commercial claim.

## Flow

1. **Reconcile the intake.** Record sources, claim status, ICP, pricing, and open discrepancies. Keep public claims source-bound.
2. **Run Genesis only when evidence has changed.** Reuse the validated Meristem sourcebook when it remains current; do not regenerate research merely to make the workflow look complete.
3. **Research with evidence gates.** Use a separately approved research route. Save sources and a distilled finding, not raw provider prompts, responses, credentials, or personal data.
4. **Run Taste with explicit approval.** Store the structured design brief and acceptance result. Taste/Cortex runtime state remains runtime-only; write only reusable, reviewed lessons into repository documentation.
5. **Materialize the Build handoff.** Convert the Taste brief into a `tasks.md` or equivalent task manifest before calling the Hands resolver. The dated Fitcheck closure receipt reports a resolved manifest; current automation still needs a `taste-brief -> task-manifest` adapter rather than passing whole Taste JSON to the resolver.
6. **Create product-centred documentation.** Keep the private wiki focused on Fitcheck—the shopper and merchant problem, verified capabilities, pricing, safe claims, and operating context—not the recipe used to generate it.
7. **Build the Astro wiki.** Use the Astro core/publisher route, run static checks and a production build, and keep publishing separately owner-approved.
8. **Map the repository to the Workbench.** Attach the wiki to `sapling:fitcheck`, preserve the immutable GitHub repository identity, regenerate only the scoped catalogue evidence, and verify the Workbench build. The broader vault-derived catalogue is not currently a safe routine generator input; reconcile it before a broad regeneration.
9. **Record and retain lessons.** Put durable, non-sensitive lessons in this runbook and a dated `.planning` receipt. Keep raw Cortex, provider state, and private research material out of committed documentation.
10. **Back up only under a separate vault contract.** If separately approved,
    backup is durability evidence, not two-way workflow authority. This runbook
    does not claim or authorize a backup operation.

## Skill and capability map

| Capability | Role in this flow | This pass |
| --- | --- | --- |
| Temperance Engine | rail selection, governed orchestration, and evidence boundaries | used |
| Meristem Genesis | sourcebook and brand foundation | reused from validated pass |
| Research routing | source-backed market and competitor evidence | used upstream; retain citations |
| Taste Cortex | visual brief and quality direction | dated procedure records an approved pass; current `origin/main` projection remains pending |
| Hands / conductor resolver | build task resolution and verification | dated receipt reports a resolved closure; current projection remains pending |
| Astro core + wiki publisher | private documentation build and static verification | dated receipt reports a static build; re-run before any publish decision |
| README Generator / Documents cluster | structured repository or docs contract | optional; not activated for this pass |
| NotebookLM | sourcebook synthesis when it adds traceable value | upstream aid, not a wiki publishing requirement |
| Portfolio Cartographer | scoped Fitcheck repository mapping and generated evidence | mapping evidence exists; deployment remains separate |

## Acceptance conditions

- Every public claim links to current evidence or is clearly a hypothesis.
- Every pricing value has a dated approved source; discrepancies remain explicit.
- A claim discrepancy is labelled rather than silently harmonised.
- Taste approval has a reviewed source before it changes current organ state;
  raw Cortex/provider state is not committed.
- Build receives a materialized task manifest and reports its own verification.
- Astro `check` and `build` pass before a publishing decision.
- Wiki identity is mapped to `sapling:fitcheck` with immutable repository evidence.
- The learning record contains no credentials, session identifiers, raw prompts, or customer data.
- R2/Git actions follow their own approvals and are not treated as workflow authority.

## Current improvement held for implementation

Implement and test a `taste-brief -> task-manifest` adapter at the Taste-to-Hands seam. Until it exists, future automated runs must materialize and review the manifest before Build.
