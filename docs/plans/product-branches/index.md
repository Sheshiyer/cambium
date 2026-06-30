# Cambium Product Branch Packets

This index lists product packets that can enter the Cambium branch loop. Each packet is a proof-bound operational contract, not a marketing brief.

| product_id | name | role | promotion_state | current_gate | packet |
| --- | --- | --- | --- | --- | --- |
| fitcheck | Fitcheck | Supervised product branch | supervised-branch | Shopify, Dodo, privacy, QA, outreach, and first merchant proof | fitcheck.md |
| vantyx | Vantyx | Tenant onboarding and publishing branch | supervised-branch | Tenant proof and rollback proof | vantyx.md |
| snow-gloves-os | Snow Gloves OS | Will-organ service | organ-service | Service contract and GTM approval gate | snow-gloves-os.md |
| iverif | IVerif | Compliance/proof product candidate | proof-only | Claim/proof separation before automation | iverif.md |

## Promotion States

- `proof-only`: packet is allowed to record evidence and gates, but not operate as a branch.
- `supervised-branch`: cofounder-operated branch work can run with human approvals.
- `autonomous-branch`: branch work may run unattended only after live customer proof and app-action portability.
- `organ-service`: internal organ/service packet, not a standalone product autonomy claim.

The ladder is always `proof-only -> supervised branch -> autonomous branch`; no product skips a rung.
