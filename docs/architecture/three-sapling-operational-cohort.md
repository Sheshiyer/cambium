# Three-Sapling Operational Cohort

Status: Fitcheck mapping readback verified; no live admission.

## Purpose

This contract binds the first three named Saplings to one canonical parent
tenant and immutable repository evidence without changing any operational
system. It is intentionally narrower than activation: identity and planning
evidence may be prepared locally, and Fitcheck now has an issued mapping
receipt with immutable readback, but no live tenant is admitted.

## Canonical cohort

| WorkObject | Canonical parent tenant | Exact repository | Immutable GitHub ID | Root disposition | Authority status |
| --- | --- | --- | --- | --- | --- |
| `sapling:fitcheck` | `cambium` | `Sheshiyer/fitcheck-landing` | `R_kgDOSzF56w` | Existing `fitcheck-landing` root-map proposal | Mapping receipt issued and read back |
| `sapling:iverif` | `cambium` | `Sheshiyer/iverif-wiki` | `R_kgDOSwXJ7Q` | Existing `iverif` root-map proposal | Prepared product-source evidence only |
| `sapling:dlock` | `cambium` | `thoughtseed-labs/lockwell-portal` | `R_kgDOP5AZyQ` | Folderless; no `dlock` or `lockwell` shallow folder | Repository identity known; authenticated authority recheck access-held pending cofounder grant |

`cambium` is the parent tenant for the cohort. A packet-local namespace,
product slug, display alias, or repository name is not a tenant selector and
cannot override that binding.

## Local proof versus live admission

Prepared local proof establishes only that the WorkObject, canonical parent,
repository name, immutable repository ID, packet, and root disposition agree.
For IVerif and DLOCK, prepared proof grants none of the following:

- an issued mapping receipt or R2 object;
- a live tenant admission or approval consumption;
- a D1/Goal Graph, Hermes, Cortex, agent-memory, provider, or deployment
  write; or
- a shallow project folder for DLOCK.

Fitcheck's mapping receipt is the only issued object in this cohort. Evidence
lives at
[`fitcheck-mapping-receipt-readback-2026-08-09.v1.json`](../project-management/fitcheck-mapping-receipt-readback-2026-08-09.v1.json).

Live admission is still a separate, owner-approved step. It must consume an
appropriate approval against the exact immutable mapping evidence, issue the
mapping receipt through the authorized writer when it is still missing, and
perform a fresh admission check. A prepared file, a packet, a repository, or
Fitcheck's issued mapping receipt alone cannot be treated as that admission.

The local dispatch compiler therefore requires an injected external-authority
readback verifier for both the issued mapping receipt and admitted activation.
Self-consistent hashes and locally constructed claims are not admission. The
foldback adapter applies the same rule: an activation envelope can produce
Cortex, agent-memory, or next-intent projections only after an injected
external admission readback verifier accepts it. Receipt-only compatibility
without those derived projections remains available for legacy callers.

## DLOCK folderless planning rule

`thoughtseed-labs/lockwell-portal` (`R_kgDOP5AZyQ`) is DLOCK's reviewed repository identity. Authenticated operational access remains held until the cofounder grants the required Thoughtseed Labs GitHub access, so no receipt may be issued from public identity evidence alone. The `folderless` disposition is intentional: it is not an empty
slot to be filled by an inferred `dlock/` or `lockwell/` project directory.
Any future folder admission is a separately reviewed root-map change and does
not follow from repository identity.

## Preflight contract

The machine-readable companion is
[`three-sapling-operational-cohort-preflight.v1.json`](../project-management/three-sapling-operational-cohort-preflight.v1.json).
It records Fitcheck's mapping receipt as issued/readback-verified, keeps
IVerif and DLOCK unissued, keeps all approvals unconsumed, and keeps tenant
admission false. Consumers must fail closed if any admission, approval,
dispatch, or D1 property changes without a separately reviewed admission
record.
