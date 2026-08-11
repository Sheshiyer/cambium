# Three-Sapling Operational Cohort

Status: mapping receipts issued and read back; D1 admission pending.

## Purpose

This contract binds the first three named Saplings to one canonical parent
tenant, immutable repository evidence, and issued mapping receipts. It remains
narrower than activation: byte-identical R2 readback is proven, while no live
Goal Graph WorkObject/loadout anchor is admitted before founder-signed CAS.

## Canonical cohort

| WorkObject | Canonical parent tenant | Exact repository | Immutable GitHub ID | Root disposition | Authority status |
| --- | --- | --- | --- | --- | --- |
| `sapling:fitcheck` | `cambium` | `Sheshiyer/fitcheck-landing` | `R_kgDOSzF56w` | Existing `fitcheck-landing` root-map proposal | Mapping receipt issued/read back; D1 anchor held |
| `sapling:iverif` | `cambium` | `Sheshiyer/iverif-wiki` | `R_kgDOSwXJ7Q` | Existing `iverif` root-map proposal | Mapping receipt issued/read back; D1 anchor held |
| `sapling:dlock` | `cambium` | `thoughtseed-labs/lockwell-portal` | `R_kgDOP5AZyQ` | Folderless; no `dlock` or `lockwell` shallow folder | Mapping receipt issued/read back; D1 anchor/loadout registry held |

`cambium` is the parent tenant for the cohort. A packet-local namespace,
product slug, display alias, or repository name is not a tenant selector and
cannot override that binding.

## Local proof versus live admission

The activation-wave proof establishes that the WorkObject, canonical parent,
repository identity, packet, root disposition, and immutable R2 mapping receipt
agree. It grants none of the following:

- a live tenant admission or approval consumption;
- a D1 Goal Graph WorkObject/loadout anchor or terminal Hermes foldback proof;
- a Sapling promotion or provider mutation; or
- a shallow project folder for DLOCK.

Live admission remains a separate, owner-approved step. It must consume a
founder signature against the exact immutable mapping evidence and current D1
head, then perform and read back the CAS commit. An issued receipt, packet, or
repository alone cannot be treated as Goal Graph admission.

The local dispatch compiler therefore requires an injected external-authority
readback verifier for both the issued mapping receipt and admitted activation.
Self-consistent hashes and locally constructed claims are not admission. The
foldback adapter applies the same rule: an activation envelope can produce
Cortex, agent-memory, or next-intent projections only after an injected
external admission readback verifier accepts it. Receipt-only compatibility
without those derived projections remains available for legacy callers.

## DLOCK folderless planning rule

`thoughtseed-labs/lockwell-portal` (`R_kgDOP5AZyQ`) is DLOCK's exact planning
authority. The current GitHub principal has verified admin, push, and pull
access to the private, unarchived `main` repository, and DLOCK's folderless
mapping receipt is issued with byte-identical readback. DLOCK still lacks a
reviewed shallow folder, merged loadout registry entry, and Goal Graph
WorkObject/loadout anchor. The `folderless`
disposition is intentional: it is not an empty
slot to be filled by an inferred `dlock/` or `lockwell/` project directory.
Any future folder admission is a separately reviewed root-map change and does
not follow from repository identity.

## Preflight contract

The machine-readable companion is
[`three-sapling-operational-cohort-preflight.v1.json`](../project-management/three-sapling-operational-cohort-preflight.v1.json).
It retains the v1 field contract while recording issued/readback-verified
mapping receipts, deployed Cortex/Hermes capability, the applied D1 anchor
schema, unconsumed approvals, and uncommitted Goal Graph anchors. Consumers
must continue to treat receipt issuance and D1 admission as separate gates.
