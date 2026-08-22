# Cambium documentation map

[`docs/LIFECYCLE.md`](LIFECYCLE.md) is the lifecycle and authority map for this
directory. This page is a discovery index; it does not replace root doctrine,
contracts, runbooks, evidence, the project ISA, or live GSD state.

## Stewardship reading order

1. Read the root [doctrine catalog](doctrine/README.md).
2. Use [`architecture/contracts/`](architecture/contracts/) for bounded
   contracts and [`runbooks/`](runbooks/) for current procedures.
3. Use the [lifecycle map](LIFECYCLE.md) and the
   [Documentation Inventory v1 contract](architecture/contracts/documentation-inventory-v1.md)
   to classify or inspect a caller-selected commit.
4. Trace proof through [`evidence/`](evidence/) and recover implementation
   history through [`plans/`](plans/) or [`archive/`](archive/).
5. Read root [`ISA.md`](../ISA.md) for approved goals and acceptance, and live
   [`.planning/STATE.md`](../.planning/STATE.md) for the current finite
   transition.

## Doctrine (repository root — not moved)

Root doctrine files are catalogued under [`doctrine/`](doctrine/) so they stay at repo root for agents while remaining discoverable from `docs/`.

| Need | Canonical location |
| --- | --- |
| Enduring Just Cause | [`../VISION.md`](../VISION.md) |
| Current Repository Mission | [`../MISSION.md`](../MISSION.md) |
| Six planes / organs | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Infinite operator | [`../INFINITE-GAME.md`](../INFINITE-GAME.md) |
| Finite-run coherence | [`../HOMEOSTASIS.md`](../HOMEOSTASIS.md) |
| Quest ledger + skill forge | [`../QUESTLOG.md`](../QUESTLOG.md) |
| Onboarding tutorial | [`../ONBOARDING-OCTALYSIS.md`](../ONBOARDING-OCTALYSIS.md) |
| 8-node integration spine | [`../INTEGRATION.md`](../INTEGRATION.md) |
| Business model | [`../BUSINESS-MODEL.md`](../BUSINESS-MODEL.md) |
| Loops → graphs (L1–L5) | [`architecture/loops-to-graphs.md`](architecture/loops-to-graphs.md) |
| GSD / planning spine | [`../.planning/README.md`](../.planning/README.md) |

## Current operating truth

| Need | Canonical location |
| --- | --- |
| Implementation acceptance and verification | [`../ISA.md`](../ISA.md) |
| Finite planning state | [live `../.planning/STATE.md`](../.planning/STATE.md) |
| Documentation lifecycle and authority | [`LIFECYCLE.md`](LIFECYCLE.md) |
| Documentation inventory contract | [`architecture/contracts/documentation-inventory-v1.md`](architecture/contracts/documentation-inventory-v1.md) |
| Provenance-preserving intent graph | Generated, read-only, non-authoritative inspection only: [machine JSON](architecture/intent-graph.v1.json) · [human readback](architecture/intent-graph.md) · [v1 contract](architecture/contracts/intent-graph-v1.md) · [source model](../scripts/intent-graph-sources.mjs) · [generator](../scripts/generate-intent-graph.mjs) · check with `node scripts/generate-intent-graph.mjs --check` |
| Runtime and data contracts | [`architecture/contracts/`](architecture/contracts/) |
| Operator procedures | [`runbooks/`](runbooks/) |
| System design and operating maps | [`architecture/`](architecture/) |
| Portfolio and repository coordination | [`project-management/`](project-management/) |
| Deep Cambium capability and surface map | [`guide/cambium-system-capability-map.md`](guide/cambium-system-capability-map.md) |
| Moosh UI/request-response/authority coverage model | [`guide/cambium-moosh-coverage-model.md`](guide/cambium-moosh-coverage-model.md) |
| Moosh multi-surface operator procedure | [`runbooks/cambium-moosh-multi-surface.md`](runbooks/cambium-moosh-multi-surface.md) |

Generate either inventory view, or verify both, for an explicit committed
revision. These commands write the selected view to stdout and do not publish a
readback file:

```bash
npm run --silent docs:inventory:json -- --source-revision <REV>
npm run --silent docs:inventory:markdown -- --source-revision <REV>
npm run --silent docs:inventory:check -- --source-revision <REV>
```

## Historical and proof material

| Need | Canonical location |
| --- | --- |
| Dated, immutable proof | [`evidence/`](evidence/) |
| Historical implementation plans and proof assets | [`plans/`](plans/) |
| Historical generated plans | [`superpowers/plans/`](superpowers/plans/) |
| Archived product-closeout material | [`archive/`](archive/) |
| Dated planning state | [`../.planning/`](../.planning/) |

Historical material may preserve old commands, interfaces, identifiers, or issue state. It is useful for audit and learning, but it is not an operator instruction. Start with the current surfaces above, then trace evidence backward when needed.

## Hygiene status

The 2026-08-10 retention review found that `plans/assets` is proof-heavy and directly referenced. Use [the retention inventory](../.planning/2026-08-10-documentation-retention-inventory.md) and [retention manifest](../.planning/2026-08-10-documentation-retention-manifest.v1.json) before proposing any asset change.
