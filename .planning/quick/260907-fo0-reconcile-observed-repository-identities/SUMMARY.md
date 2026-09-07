# Repository identity reconciliation verification

GSD quick task: `260907-fo0`. Base: `9f85b41`. Status: local implementation
and verification complete. Source commit: `1b287d0`; no external apply.

## Result

The optional `identityMappings` source field explicitly selects checked-in,
founder-reviewed mapping receipts. The compiler validates the receipt derivation,
exact receipt ID/content digest, repository full name and immutable ID,
WorkObject selection, and current root-map status, membership, and account.
Legacy sources still reconcile only observed local tuples.

| Observed repository | Existing WorkObject | Reviewed receipt |
| --- | --- | --- |
| Sheshiyer/fitcheck-landing | sapling:fitcheck | pmr_23d50a803ded382e2ee03af7 |
| Sheshiyer/iverif-wiki | sapling:iverif | pmr_ea8abcff3022be70d1a75222 |
| Sheshiyer/vantyx | sapling:vantyx | pmr_72f605f32bff2d595a9f7edb |

These projections remain `authority: observation-only`, with proposal status
`mapping-proposal` and explicit `receiptStatus: prepared`. The checked-in bundle
is `prepared-not-issued`; no live issuance or deployment is claimed. Each remote
row preserves `local: null`, null proposal folder/path, repository-derived display
name, and `local-observation-unavailable`. Vantyx does not acquire the Panaroma
folder/name or the separate Airdronauts delivery branch.

## Files

- `apps/portfolio-cartographer/scripts/repository-intake.mjs`
- `apps/portfolio-cartographer/scripts/repository-intake.test.mjs`
- `docs/project-management/repository-intake-source.v1.json`
- `docs/project-management/repository-intake.v1.json`
- This quick task's `PLAN.md` and `SUMMARY.md`.

## Verification receipts

- Focused intake tests: 21 passed, zero failures.
- `npm test --prefix apps/portfolio-cartographer`: 107 total, 106 passed,
  one pre-existing skipped test, zero failures.
- Intake CLI `--check`: passed after regeneration. It validates inputs without
  writing; exact generated-byte parity is separately asserted by the tests.
- Compared generated observations with `HEAD`: 41 observations preserved;
  exactly the three reviewed repository rows changed. Original repository,
  local-observation, activity, and root-map digest evidence is unchanged.
- `git diff --check`: passed.
- Source digest:
  `cab4fea095db2dd0af9b10acea6c9457b7dd8b5cdc76dc230d73b8a9a58340a4`.
- Observation digest:
  `a54b866b85435057fb1631602dab5033338ec88677bf67b1750761e0dc4fc1dd`.

Negative coverage includes mismatched source/observation identity, receipt pins,
modified receipt contents, wrong WorkObject, missing/duplicate receipts,
duplicate/injected declarations, stale root eligibility despite refreshed source
digest, and attempts to override excluded/dependency/held local observations.

## Preserved holds and boundaries

Session Atlas, Meristem, Somatic Canticles book trilogy, and Synchronocities
remain awaiting approved ownership mappings. Meristem's existing-program
candidate is unverified. Cambium Website and the nested Codigo/Decodik app
semantics remain unchanged. No WorkObject, root map, catalog, inventory, STATE,
runtime, provider, service, GitHub, or deployment changes were made.

## Coordinator review

The coordinator reviewed the source and generated diff and independently reran
all 21 intake tests, the offline CLI check, and whitespace checks. Review caught
inherited Panaroma/IVerif folder placement in remote identity projections; the
worker corrected it to null placement with repository-derived display names and
added regressions before source commit `1b287d0`.

The coordinator records this source completion in the GSD quick-task table.
The earlier no-STATE/no-commit boundary above describes the worker's actions;
the coordinator's exact-file checkpoint does not advance milestone acceptance,
publish repository headers, or issue the prepared mapping receipts.
