# Cambium architecture briefing prompt

Use this prompt with the committed Cambium architecture sources as the NotebookLM source set:

```text
Create a concise 8–10 slide architecture briefing for Cambium, the on-brand venture operator.

Audience: maintainers, technical collaborators, and adopters deciding which surfaces are safe to run.
Tone: clear, grounded, and plain-spoken. Separate implementation facts from roadmap or deployment claims.
Do not invent providers, routes, credentials, production deployments, or user outcomes.

Use these source-backed sections:
1. Product shape: composition/operator plane and runtime/visual plane.
2. Composition contracts: registry, pipeline, adapters, spend gates, and the Quine/operator seam.
3. Worker boundary: private GitHub knowledge reads, Vectorize retrieval, Plexus authorization-only role resolution, KV, and separately scoped D1/R2 actions and receipts.
4. R3F boundary: desktop constellation surface, shared generated contract, MAP/SHEETS/WORKFORCE, and synthetic fallback.
5. Lead runtime: durable task/lease/identity/observation/usage/foldback sequence.
6. IVerif safety: fixed campaign, GET-only, redacted projections, and sendEligible=false.
7. Marketing Create safety: review-only draft artifact, signed founder approval, disabled registration, no publication authority.
8. Verification: npm run verify:release, npm test, npm run r3f:test, npm run r3f:build, docs drift, standalone checks.
9. Current-main versus v0.3.0: clearly label post-tag work as unreleased.
10. Next governed decisions: remote principal directory, provider promotion gates, and separately approved deployments.

For every slide, name the source file used. Use diagrams for the two-plane flow and the Worker data boundary.
End with an explicit “what this does not claim” slide: no automatic outreach, no publication, no recurring schedule,
no unreviewed paid-provider call, and no founder-device readiness claim.
```

Source set: [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`README.md`](../../README.md),
[`SERVICES.md`](./SERVICES.md), [`lead-runtime-spine.md`](./lead-runtime-spine.md),
[`iverif-explee.md`](../adapters/iverif-explee.md), and
[`marketing-create-worker-renderer.md`](./marketing-create-worker-renderer.md).
