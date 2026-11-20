# Source reconciliation proposal for owner v108

`8073b294` (v108) was the latest upload and served 100% at the 5 November
13:42 IST readback. It has the 54 baseline bindings and the same runtime,
exports, settings, schedules and exposure. `5a9c7565` (v106) retains its exact
module and 56 bindings at 0%. The v106 map attestation approval is recorded
with application held under the live pin check.
[Readback evidence](FINITE-SSM-STAGE1-OWNER108-READBACK-20261105.json)

The v108 module returned without a source map. Its bytes equal the ETag-bound
v107 module with one exact substitution in the Gate client. The uploaded
module matches the local release artifact, and all 107 reconstructed source
files match the owner checkout. Use this verified source set for reconciliation.
The v107 receipt and map remain evidence for that version.
[Prior drift receipt](FINITE-SSM-STAGE1-OWNER-DRIFT-20261105.json)

## Source work for approval

Create a separate worktree from reviewed pilot source `c2bf7775`. Use the captured
v105 source as the common base. Retain the two v108 Fitcheck scope reconciliation
files byte for byte, and merge the v108 handler, entry point and Gate client
changes with the pilot. The three-way comparison identified five conflicts.

| Area | Resolution |
| --- | --- |
| Handler imports | Retain the Fitcheck schema, parsers and scope checks alongside the pilot patch contract and direction admission imports. |
| Gate proposal summary and source | Preserve renewal precedence. Route Fitcheck reconciliation and native direction execution to their distinct existing source tags and review text. Keep Fitcheck `identityChanges` and `executionGranted: false`, and preserve the validated pilot `directionExecution` review. |
| Gate proposal consequence | Preserve Fitcheck’s identity-only consequence and the pilot’s separate approval, admission and launch stages. Retain the existing consequences for renewals, claims, Work and bookkeeping. |
| Worker entry point | Retain both import sets and wire the existing Fitcheck D1 reference read alongside the finite pilot’s direction store and launch owner. |
| Gate client row filter | Require the Access signer for rows tagged `fitcheck-scope-reconciliation@v1`. Retain the pilot’s `native-direction-execution@v1` entry in the existing allowlist and preserve the pending, stale, tenant and digest checks. |

## Evidence needed for the revised rollout

- Carry the verified Fitcheck baseline tests into the isolated reconciliation.
  They passed three checks on the owner checkout for admin-only intake, pending
  replay and fail-closed reference and source checks. Run them with the existing
  direction execution and native launch tests on the combined source.
- Exercise both Gate row types in the combined handler and client. Verify that
  an Access signer can see the tagged Fitcheck row, other signers cannot, and
  native direction review still uses its own pinned payload. Confirm that the
  Fitcheck identity review cannot supply an execution admission.
- Run the Worker typecheck and repository test suite with the existing
  toolchain. Compare the local bundle source inventory with the verified v108
  sources, checking exact content for retained paths and reviewing every
  remaining pilot delta.
- Recheck the serving and latest-uploaded pins. Present the exact candidate
  source, bundle, map and configuration digests with the 54 retained bindings
  and two pilot additions. A new owner change holds the revised rollout.

Approval would cover local source work, tests and a revised rollout proposal.
The existing v106 upload and background runner are preservation baselines.
Upload, preview invocation, migration, traffic, installation and job execution
remain separate gates.
