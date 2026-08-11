# Cambium Branch Packets

This index lists Cambium branch packets that can enter the branch loop. A branch can be a product, a client delivery stream, or an internal service; each packet is a proof-bound operational contract, not a marketing brief.

| product_id | canonical_work_id | identity_scope | branch_kind | name | role | promotion_state | current_gate | packet |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fitcheck | sapling:fitcheck | canonical-work-object | product | Fitcheck | Supervised product branch | supervised-branch | Shopify Dodo privacy QA outreach and first merchant proof | fitcheck.md |
| vantyx | sapling:vantyx | canonical-work-object | product | Vantyx | Tenant onboarding and publishing branch | supervised-branch | Tenant proof and rollback proof | vantyx.md |
| snow-gloves-os | program:snow-gloves-os | canonical-work-object | internal-service | Snow Gloves OS | Will-organ service | organ-service | Service contract and GTM approval gate | snow-gloves-os.md |
| iverif | sapling:iverif | canonical-work-object | product | IVerif | Compliance and proof product candidate | proof-only | Claim/proof separation and live campaign reconciliation before automation | iverif.md |
| dlock | sapling:dlock | canonical-work-object | product | DLOCK | Smart lock and self-storage software product candidate | proof-only | Map live landing, repository, hardware assets, and TUYA integration evidence before supervised launch work | dlock.md |
| client-delivery | none | template | client | Client Delivery | Client delivery branch template | supervised-branch | Client scope acceptance and handoff proof | client-delivery.md |

## Branch Kinds

- `product`: branch is a product, product candidate, or productized offer.
- `client`: branch is a client delivery stream, handoff, or acceptance loop.
- `internal-service`: branch is an internal organ/service that supports ecosystem work without claiming standalone product autonomy.

## Promotion States

- `proof-only`: packet is allowed to record evidence and gates, but not operate as a branch.
- `supervised-branch`: cofounder-operated branch work can run with human approvals.
- `autonomous-branch`: branch work may run unattended only after live customer proof and app-action portability.
- `organ-service`: internal organ/service packet, not a standalone product autonomy claim.

The ladder is always `proof-only -> supervised branch -> autonomous branch`; no branch skips a rung when autonomy is relevant.
