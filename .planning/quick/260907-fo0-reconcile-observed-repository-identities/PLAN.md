# Reconcile observed repository identities

GSD quick task: `260907-fo0`. Base: `9f85b41`.

## Scope and evidence

The intake compiler currently binds only observed local tuples. Three remote
observations have founder-reviewed Batch 3 mapping receipts already checked in:
Fitcheck landing (`R_kgDOSzF56w`) to `sapling:fitcheck`, IVerif wiki
(`R_kgDOSwXJ7Q`) to `sapling:iverif`, and Vantyx (`R_kgDOSzK35A`) to
`sapling:vantyx`. The receipt bundle remains `prepared-not-issued`; this work
projects reviewed identity evidence and makes no live issuance claim.

## Implementation

1. Add optional, closed `identityMappings` declarations to intake source v1,
   preserving existing sources and local tuple reconciliation.
2. Pin each declaration to its exact checked-in receipt ID and content digest.
   Validate the receipt's derived digest, repository full name and immutable ID,
   selected WorkObject, and current root-map eligibility. Reject ambiguous,
   stale, absent, conflicting, or held evidence. Never infer bindings by name.
3. Project only the selected WorkObject with explicit receipt provenance. Keep
   remote `local: null`, null proposal folder/path, repository-derived display
   name, and its missing-local-observation gap. Preserve Cambium
   Website and Codigo/Decodik semantics, all existing rows, and held identities.
4. Add only the three reviewed declarations and regenerate the intake snapshot.

## Verification

- Focused positive and negative tests: receipt mismatch and tampering, immutable
  ID/name/work binding, duplicate declarations, held or changed roots, explicit
  exclusions, no accidental additional Vantyx WorkObject, deterministic order,
  legacy source compatibility, current snapshot parity, and unchanged holds.
- Run intake `--check`, exact generated snapshot parity, portfolio-cartographer
  tests, and `git diff --check`.
- Record receipts and remaining holds in this task's SUMMARY.md. No STATE,
  root-map, catalog, inventory, commit, push, service, or external changes.
