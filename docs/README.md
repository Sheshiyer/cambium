# Cambium documentation map

`docs/LIFECYCLE.md` is the authority map for this directory. This page is a discovery index; it does not replace contracts, runbooks, evidence, or the project ISA.

## Doctrine (repository root — not moved)

Root doctrine files are catalogued under [`doctrine/`](doctrine/) so they stay at repo root for agents while remaining discoverable from `docs/`.

| Need | Canonical location |
| --- | --- |
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
| Runtime and data contracts | [`architecture/contracts/`](architecture/contracts/) |
| Operator procedures | [`runbooks/`](runbooks/) |
| System design and operating maps | [`architecture/`](architecture/) |
| Portfolio and repository coordination | [`project-management/`](project-management/) |

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
