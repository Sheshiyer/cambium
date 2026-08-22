# Cambium architecture briefing prompt

Use this prompt with the committed Cambium architecture sources as the NotebookLM source set:

```text
Create a concise 9–12 slide architecture briefing that explains how Cambium works today,
for a non-technical stakeholder (an owner or executive who will never read code).

Audience: non-technical stakeholders evaluating what Cambium is, what it safely does today,
and how it stays under control.
Tone: plain-spoken and concrete. Use everyday analogies for machinery, but never invent
facts. Separate what is built and verified from what is deliberately held back.
Do not invent providers, routes, credentials, production deployments, or user outcomes.
Translate every technical term on first use (e.g., "a goal graph — a shared map of what
the company is trying to do and what has been proven").

Use these source-backed sections:
1. What Cambium is: a venture operator that takes an idea in and grows an on-brand,
   self-running business out of it. Two halves: one builds the business once
   (composition), one keeps it running forever (operator).
2. The build half: a contract-driven pipeline of specialist "organs" (Genesis → Taste →
   Hands → Will) that turns an idea into a brand system and live surfaces; spending is
   gated behind explicit human approval.
3. The run half: an event-sourced wake loop that handles one move at a time through
   ingest → route → act → viability check → learn → persist, so any run can be replayed
   exactly and nothing drifts silently.
4. The runtime boundary: a tenant-scoped Cloudflare Worker holds quests, directives,
   action receipts, lead runs, and context retrieval across D1 (database), KV (fast
   state), R2 (evidence vault), and Vectorize (semantic memory).
5. Where knowledge comes from: bounded company-knowledge reads through a separate
   GitHub-App gateway with short-lived scoped tokens and commit-level provenance;
   Cambium itself never holds a GitHub credential.
6. The goal graph: D1 is the sole writer of operational truth. Every commit binds an
   approval digest to the exact tenant, source reference, node set, actor, and expiry;
   stale or mismatched revisions simply do not write. Projections observe — they can
   never feed themselves back in as fresh authority (fail-closed by design).
7. The intent graph and Temperance flow: read-only maps that show vision → mission →
   finite goals → tasks → evidence → learning, plus the single next safe action with its
   gates, freshness, and stop conditions. Ambiguity shows up as "blocked," never as a
   guessed plan.
8. How work is governed: GSD phases 3–7 — canonical anchors, provenance-preserving
   intent graph, dependency-safe next-action derivation, documentation stewardship, and
   deterministic safety checks that reject authority drift and stale or sensitive data.
9. Visual surfaces: a desktop 3D constellation view and Telegram Mini App pages consume
   shared contracts only; they display signed actions and fall back to synthetic demo
   data offline.
10. Safety posture: the lead observer is read-only and send-ineligible; marketing drafts
    are review-only and disabled; no automatic outreach, publication, recurring
    schedules, or unreviewed paid calls anywhere in the system.
11. Business objective: consolidate doctrine into a provenance-preserving infinite-game
    architecture — vision and mission anchored, ISA and GSD as the only planning
    authorities — so growth compounds without losing brand or control.

For every slide, name the source file used. Use diagrams for: the two-plane flow
(build vs run), the worker data boundary, and the propose → approve → execute → receipt
→ learn loop with its approval gate.
End with an explicit "what this does not claim" slide: no automatic outreach, no
publication, no recurring schedule, no unreviewed paid-provider call, and no production
deployment claim — deployment remains a separately approved action.
```

Source set: [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`README.md`](../../README.md),
[`SERVICES.md`](./SERVICES.md), [`DEPENDENCY-GRAPH.md`](./DEPENDENCY-GRAPH.md),
[`goal-graph-operating-model.md`](./goal-graph-operating-model.md),
[`intent-graph.md`](./intent-graph.md), [`temperance-flow.md`](./temperance-flow.md),
[`lead-runtime-spine.md`](./lead-runtime-spine.md),
[`iverif-explee.md`](../adapters/iverif-explee.md), and
[`marketing-create-worker-renderer.md`](./marketing-create-worker-renderer.md).
