# Project/R2 evidence prefixes

Status: proposal only. This file defines where Workbench mapping/intake/closeout receipts should be stored once a founder-approved action writes R2 evidence.

Related mapping proposal:

- `docs/project-management/project-r2-mapping-proposals.v1.json`
- `docs/project-management/project-r2-mapping-proposals.md`

## Core rule

R2 is immutable/idempotent evidence and encrypted durability. It is not:

- live project state;
- code history;
- repository ownership;
- folder movement authority;
- planning authority;
- the D1 Goal Graph writer;
- native client session migration.

## Prefix template

```text
portfolio/thoughtseed/workobjects/<work-id>/<receipt-kind>/<receipt-id>.json
```

Receipt kinds:

| Kind | Prefix | Payload shape |
| --- | --- | --- |
| `mapping` | `portfolio/thoughtseed/workobjects/<work-id>/mapping/` | root-map digest, catalog digest, folder proposal, repository identity, grammar disposition, founder decision status |
| `intake` | `portfolio/thoughtseed/workobjects/<work-id>/intake/` | project birth or repository intake intent, source actor, Founder Gate status, handoff pointer, repository packet pointer |
| `closeout` | `portfolio/thoughtseed/workobjects/<work-id>/closeout/` | closeout disposition, handoff pointer, agent-aware memory projection pointer, active-index delta, confirmation checklist |
| `finished-index` | `portfolio/thoughtseed/workobjects/<work-id>/finished-index/` | finished index delta, successor WorkObject if any, archive visibility, review status |

## Example prefixes from the gap settlement

```text
portfolio/thoughtseed/workobjects/branch:airdronauts-panorama-viewer-delivery/mapping/
portfolio/thoughtseed/workobjects/program:meristem-brand-system/mapping/
portfolio/thoughtseed/workobjects/program:explee-capabilities/mapping/
portfolio/thoughtseed/workobjects/branch:safvr-landing-page/mapping/
```

The SAFVR prefix is a future candidate only. It must not be written until founder review confirms the relationship and repository access.

## Validation gates before any R2 write

Workbench should reject the action before storage unless the server validates:

1. exact root-map digest;
2. exact catalog digest;
3. canonical WorkObject identity;
4. canonical repository identity or explicit gap;
5. allowed receipt kind;
6. idempotent receipt id;
7. no absolute local paths;
8. no credentials, tokens, provider secret names, or raw prompt/response bodies.

Any R2-primary or two-way-sync behavior is out of scope until a separate founder-approved contract replaces this evidence-only role.
