---
name: sapling-lifecycle
description: Review and advance new products or existing Cambium saplings through evidence, delivery, launch drafts, growth, and learning workflows, one selected step at a time.
---

# Sapling Lifecycle

Cambium owns this pack. It composes existing workflows; it does not create a second planner, acceptance ledger, operational graph, or scheduler.

## Start from the product

1. Resolve the selected product's packet, repositories and planning owner. Read the owning repository instructions and current evidence/gate ledgers. A missing identity stays a candidate; a repository name does not admit a tenant.
2. Refresh the relevant evidence before selecting a step. Show `shipped`, `draft`, `held`, or `gap` independently from whether the evidence is verified, stale, conflicting, or unverified. Cite the source and observation time. A local file, prepared graph, or HTTP success does not establish a live product outcome.
3. For a generic run, recommend a step and obtain the user's selection. If the request already names a specific authorized action, continue without asking for the same permission again.
4. Handle exactly one selected step, verify its actual result, and stop with its evidence or concrete blocker. Preserve all held gates. An uncertain external response means read status before any retry.

## Commands

| Intent | What to do |
| --- | --- |
| `review <product\|all>` | Review named workflow components and product evidence; show drift, conflicts, gaps and a recommendation. |
| `new <product>` | Prepare the seed and lifecycle plan. Reuse intake and provenance rules; unresolved identity remains a candidate. |
| `run <product> [step]` | Review first, then handle one selected authorized step. No implicit stage cascade. |
| `graph <product>` | Produce a read-only evidence graph and readable diagram. Import validation is independent of the model fence. |
| `draft <product> <channel>` | Prepare one channel draft from the product's proof and brand authority. External draft saving needs a request authorizing that destination. |
| `grow <product>` | Review search, content and GTM evidence; prepare one bounded experiment with a metric and stop rule. |
| `learn <product>` | Derive attributable lessons and a proposed next action. Do not update memory or providers automatically. |
| `status <product>` | Show evidence, held gates, last result, and the resume point without advancing it. |

Use [commands.md](references/commands.md) for client syntax and helper usage. The deterministic CLI prepares reports and dispatch briefs; the calling agent performs and verifies the selected authorized action. A `prepared` result is not completed work.

## Choose existing components

Read [workflows.md](references/workflows.md) to route by lifecycle stage. Look up only the relevant entries in [catalog.json](references/catalog.json); `review all` reads the full catalog. It records owners, source digests, inputs, outputs, writes, prerequisites, stops, and verification commands.

- Evidence and identity: product graph, branch packet contract, existing sapling intake, project birth/closeout preparation.
- Build, brand, media and release: the matching existing delivery pack and its specialist skills.
- Launch and growth: the product's brand pack, generic brand-case/search workflows, and bounded GTM contracts.
- Repetition and learning: the existing one-change branch loop and pure compilers.

Use [review-findings.md](references/review-findings.md) before trusting historical workflow claims. Keep canonical sources in place; do not copy vault notes, brand corpora, transcripts, or operational identifiers into this pack.

## Read-only graph route

For the existing authenticated founder graph, department planning, or owner measurements, use [operational-graph.md](references/operational-graph.md). Reuse its original WorkObject/node identities and the existing manual owner reader. Its operational graph schema differs from the product-evidence graph below; neither can stand in for the other.

Run the existing `sapling-product-loop` only with `record=false` and `approved=false`, read-only agent capabilities, and a bounded session that remains alive until terminal completion or explicit timeout. The source has a separate record branch: do not enter it from this route. A rejected or timed-out run has no accepted receipt.

Validate root containment, unique identities, allowed states, non-publishing rows, evidence provenance, and edge endpoints before using the graph. HTTPS syntax alone proves no observation. A graph's accepted fence is neither owner approval nor runtime admission.

For Codex trigger or callback work, read [codex-triggers.md](references/codex-triggers.md) and inspect the current native discovery before proposing a change. Command adapters invoke this skill manually; they are not lifecycle hooks. Preserve the existing startup, prompt and close owners.

## Proof and authority

- ISA owns acceptance, GSD owns finite planning, and D1 owns operational Goal Graph writes. Reports here remain projections.
- Generated reports and local resume state belong in ignored `.local` output. Track only reviewed public-safe source and bounded evidence summaries.
- Packet creation grants no promotion, tenant admission, dispatch, deployment, publication, spend, or provider authority.
- Resolve current routing from the host. Retired `te-*` aliases and Superset references in historical sources must not be activated.
- Preserve dirty source work and use isolated changes. Observe published versions from a pinned source, not a behind working checkout.
- Do not schedule loops or launches from this pack. A separate current request must cover any external action.

For the approved Temperance draft, read [temperance-draft.md](references/temperance-draft.md). Those values and holds are product-specific, not defaults for other saplings.
