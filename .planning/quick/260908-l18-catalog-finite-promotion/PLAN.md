---
type: quick-continuation
status: in-progress
parent: 260908-l18
---

# Finite catalog promotion: proposal display inventory

## Objective

Add exactly three source-backed identities to a read-only presentation/proposal inventory while preserving the existing 72-record approved action catalog, action root, eligible identities, classification facts, and tenant semantics.

## Frozen inputs

- Canonical source revision: `4ab895653a3b5bc575dffb0b2360a70062221697`
- Canonical file digest: `1e6d2a3779c5ea901ae1135cb549c4e71fd803eb7bcc385a25a1edbc2e3a4aa3`
- Canonical classification digest: `08bdef05f45f948cfee07da2b64982a7f76487cee609ac900a3a6e485db24757`
- Preserved action catalog: 72 records, digest `sha256:311ead84a1e533f86e34f15a9d783e0350ac327d51d2c51c10d236d107ab96ca`
- Preserved action root: `e2abef8080c6ababab7a41e1803fa1eccc08b58a4dbf7876e586df78493bf351`
- Exact selection digest: `ce7c129bd24fd173089c069956b9d5cc18f8d829239ce32cbd2a6798252473ca`

## Tasks

1. Introduce an explicit proposal/display authority that contains only `branch:codigo-olimpo`, `branch:codigo-olimpo-creator-platform`, and `program:thoughtseed-organ-console`, with frozen provenance and no action authority.
2. Project the 72 reviewed records plus those three records for rendering while keeping all action admission and approved pins bound to the 72-record authority.
3. Add focused regression coverage for 75 unique display identities, immutable legacy projection, tenant/classification preservation, deterministic provenance, and failure of display-only action attempts.
4. Run the relevant generator/catalog/action-admission checks and record the result in a scoped summary and handoff checkpoint.

## Boundaries

No live Vault, Worker, D1, provider, tenant, approval, deployment, catalog-source, or approved-action mutation. The remaining source delta stays explicitly unresolved.
