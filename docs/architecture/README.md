# Architecture

This directory contains current system design, service maps, and contracts. For binding runtime and data interfaces, start with [`contracts/`](contracts/); dated proof belongs in [`../evidence/`](../evidence/), not here.

## Starting points

- [The connected system](system-atlas.md) — interactive eleven-organ atlas, six growth desks, identity boundaries and receipt strata
- [Visual field guide](../explainers/system-atlas-2026-10-07/index.html) — the same public source model used in the Mini App
- [The 8-node infrastructure spine](../../INTEGRATION.md#the-8-node-infrastructure-spine) — the full system topology
- [Printable system atlas](../explainers/system-atlas-2026-10-07/system-atlas.svg) — browser-viewable source map of the organ families and connected system
- [Services](SERVICES.md)
- [Dependency graph](DEPENDENCY-GRAPH.md)
- [Cambium operating fabric](cambium-operating-fabric.md)
- [Goal Graph operating model](goal-graph-operating-model.md)
- [Loops → graphs (L1–L5 → quests)](loops-to-graphs.md)
- [Fitcheck golden path](fitcheck-golden-path.md)
- [Branch traversal map](branch-traversal-map.md)

## Provenance-Preserving Intent Graph

The Intent Graph is a generated, read-only, non-authoritative inspection projection. Follow its boundary in this order: [machine JSON](intent-graph.v1.json), [human readback](intent-graph.md), [v1 contract](contracts/intent-graph-v1.md), [source declarations](../../scripts/intent-graph-sources.mjs), and [generator](../../scripts/generate-intent-graph.mjs). Verify the committed readbacks without writing them:

```bash
node scripts/generate-intent-graph.mjs --check
```

## Visual system atlas

[Contract](contracts/system-atlas-v1.md) · [Machine projection](system-atlas.v1.json) · [Portrait lineage](../assets/visual-flow/system-atlas/PORTRAITS.v1.json).
The atlas is an inspection projection. Current policy, membership, callback,
containment and outcome evidence remain with their owners. Verify the generated
edition with `node scripts/generate-system-atlas.mjs --check`.
