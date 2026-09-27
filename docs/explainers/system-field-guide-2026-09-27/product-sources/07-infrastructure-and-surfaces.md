# Cambium — infrastructure, ownership and surfaces

## An infrastructure map a founder can reason about
The Quests Worker is the API and read-model boundary. It validates tenant scope and Telegram context, projects Mission Fabric, handles bounded action envelopes, and connects to D1, KV, R2 and Vectorize. D1 Goal Graph owns operational intent and version-bound changes. KV holds runtime state where the declared contract uses it. R2 holds evidence and artifacts. Vectorize supports retrieval. Storage services do not possess approval authority.

Portfolio Workbench (Cartographer) reconciles project identity, repository provenance, planned missions and gaps. It prepares a bounded action. Telegram Mini App presents current context through Mission, Flow, Workforce, Forge, Gate and Inspect; its newer Operating Fabric also includes Canopy. Both should explain the same source projection. Selection, inspection and opening a sheet cannot count as approval. A stale or incorrectly bound proposal should remain inspect-only.

R3F expresses the topology as islands, rails, packets and instruments. Its routes include Genesis, Taste, Build, Ops, Cortex and visualizations. Synthetic fallback rendering is useful for design but does not prove the remote Worker is live. Electron wraps that renderer as a desktop application; browser proof does not prove installation, signing, notarization or updates.

Hermes is the topic-aware execution and delivery boundary for admitted assignments. Telegram is a transport and operator surface. A delivered message proves transport only; successful meaning requires a separate outcome check. Plexus supplies identity, tenant and RBAC boundaries. The repository describes optional MCP/AWS and observation adapters; optional adjacency must not be presented as a universally active dependency.

## The local operator substrate
Temperance coordinates phase context, skills and governed execution. Manifest projects project identity, workflow capabilities and approval state. OmniRoute transports model requests and resolves the configured provider route. Superset provides an execution host where declared. These are distinct from the Cambium operational writer. A bridge health response proves reachability at that moment; it does not prove freshness, provider credentials, correct model execution, or successful work. A proposed worker map is not a dispatched fleet.

The cognition loop reads sovereign memory planes with provenance. Organizational truth, local learning signals and projections have different authority. Federation means tagged reads across these planes; it does not mean flattening them into one writeable store.

## A bounded request
A useful request names exact WorkObject, task, current intent/version, approved scope, loadout, evidence references, budget and stopping condition. Request and approval identifiers are bounded and idempotency-aware. The owning API checks freshness, expiry and fence/version bindings. The executor emits terminal evidence. A new intended state must return through the appropriate approval path.

## Source implementation versus an accepted system
The repository contains finite composition adapters, Worker and Goal Graph code, projection and action contracts, onboarding and quest folds, Cortex ingestion and multiple visual surfaces. These are concrete source assets. Conversely, their presence is not a claim that every tenant or deployment has completed admission, pinning, execution and foldback. No new live service, production action, provider change or operational flow is proved by this explanation.

## Cloud authority
The reviewed project planning identifies Thoughtseed Labs as the production configuration authority and the legacy profile as read-only source/rollback evidence. Source inventory, asset transfer, parity, retirement and deployment remain separate operations. This guide does not suggest changing the live account or moving data.

Source anchors: ARCHITECTURE.md; INTEGRATION.md; docs/guide/cambium-system-capability-map.md; docs/guide/cambium-surface-inventory.json; workers/quests/src/cortex-ingestion.ts; workers/quests/src/goal-graph; workers/quests/src/mission-fabric.ts; .planning/STATE.md. Host services are described by their contracts, not by fresh runtime probes.
