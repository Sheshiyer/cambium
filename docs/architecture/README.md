# Architecture

This directory contains current system design, service maps, and contracts. For binding runtime and data interfaces, start with [`contracts/`](contracts/); dated proof belongs in [`../evidence/`](../evidence/), not here.

## Starting points

- [The 8-node infrastructure spine](../../INTEGRATION.md#the-8-node-infrastructure-spine) — the full system topology
- [Visual flow diagram](../visual/cambium-infra-spine-flow.html) — browser-viewable SVG of the spine
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
