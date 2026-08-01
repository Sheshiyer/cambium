# Portfolio Client Families and Guided Triage

## Purpose

Make the Portfolio Workbench easier to scan and decide in without changing the canonical WorkObject registry. Client relationship, WorkObject kind, lifecycle, planning signal, and review uncertainty remain separate dimensions.

## Architecture

The canonical registry remains unchanged. A pure `groupWorkObjects` projection derives client families from the exact `accountId` of canonical client Branches. The stable display key is `client:<accountId>` and its provenance is `source-account`. No name matching, prefix matching, or local override can move a canonical WorkObject between source families. Saplings and internal Programs render as separate portfolio groups.

The local packet advances from v2 to v3. It retains `plans` and adds `reviewDecisions`, keyed by the stable `review:*` source IDs. v2 and legacy v1 packets migrate explicitly; unknown versions fail closed. Review decisions carry a proposed type, bounded optional client-family ID, bounded note, and the suggestion-rule version used when the decision was made. The source review records never become WorkObjects.

## Interaction model

Family layout is the default overview, beside the existing flat grid and horizon board. Each family is an accessible disclosure header with member count and effective signal rollup. Multi-project families such as HeyZack and Axdis Group start expanded; search temporarily reveals every matching group. Work cards remain the same independently focusable planning objects inside the family.

Unplanned cards gain five compact decisions: Now, Next, Later, Park, and Needs Review. These write only local plan fields and expose Undo. They do not change source lifecycle or classification.

Needs Review becomes a triage desk. Each of the 16 source records shows what evidence is missing, a deterministic suggestion with rationale and provenance, one-tap Sapling / Client Branch / internal Program / Keep Reviewing choices, and optional client-family plus note fields. Decided and remaining counts make queue progress visible. Locally flagged WorkObjects remain a separate section and keep their canonical identities.

## Data flow and authority

`Vault snapshot → canonical WorkObjects/review records → pure family + suggestion projections → local v3 proposal state → JSON/Markdown export`.

Nothing flows back to Vault, Cambium D1, Hermes, Telegram, a tenant registry, or any provider. The generated single-file artifact remains zero-network and is embedded byte-for-byte in the existing founder-only Worker route.

## Error handling

- Unknown packet schemas or versions are rejected rather than partially imported.
- Unknown WorkObject and review IDs are rejected.
- Client-family and notes are normalized and length-bounded.
- Existing unreadable local state remains untouched until explicit reset/import.
- Every fast action supports local undo or reset.
- Search and collapsed state cannot hide matching results.

## Verification

- Domain tests prove HeyZack has eleven members, Axdis Group has two, and every client Branch has exactly one source family.
- Migration tests prove v1 and v2 plans survive v3 import and invalid newer packets fail.
- Suggestion tests prove all 16 records receive stable rule/digest provenance.
- Round-trip tests prove review decisions survive JSON and appear in Markdown.
- Browser tests exercise family disclosure, search reveal, Unplanned quick actions, Needs Review choice/reset, persistence, and mobile overflow.
- Static audit proves canonical catalog hashing is unchanged and no network or writer primitive enters the artifact.
- Bundle and Worker tests prove the embedded document is byte-identical and the founder wall is unchanged.
