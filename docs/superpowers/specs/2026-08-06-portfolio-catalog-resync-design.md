# Portfolio Catalog Resync — Design

## Goal

Close the drift between `cambium`'s frozen portfolio catalog projection
(`workers/quests/src/portfolio-catalog-data.ts` and its byte-identical
mirror in `apps/portfolio-cartographer/src/portfolio-catalog-data.ts`) and
the canonical source of truth, `thoughtseed-labs/00-meta/work-object-registry.v1.json`,
which has moved from 54 WorkObjects (16 unresolved) to 72 WorkObjects (0
unresolved) since the catalog was last generated on 2026-07-29.

## Background

`portfolio-catalog.ts` is a self-validating module: at import time it
builds a `PortfolioCatalogV1` object from the `RAW_*` data arrays, computes
a canonical-JSON SHA-256 digest over it (`sha256(canonicalJson(...))`), and
asserts that digest against a hardcoded `EXPECTED_CATALOG_DIGEST` constant.
It also asserts six pinned counts (`records.length !== 54`, etc.) and a
separate `PORTFOLIO_CLASSIFICATION_DIGEST` constant that must match the
*source* registry's own `classificationDigest.value`. This makes the module
fail closed on any drift — which is exactly what is currently blocking
PR-adjacent work (a stashed WIP change touching `program:company-website`
surfaced this when its `thoughtseed-brand-atlas` reference had nowhere to
resolve, and investigating why revealed the entire catalog is stale, not
just missing one record).

A parallel, independently-declared `CLASSIFICATION_DIGEST` constant lives in
`apps/portfolio-cartographer/src/domain.ts`, used to tag/validate founder
decision records. It must stay byte-identical to
`PORTFOLIO_CLASSIFICATION_DIGEST` but is not derived from it in code today.

An auto-generated offline bundle, `workers/quests/src/portfolio-workbench.generated.ts`
(plus `apps/portfolio-cartographer/bundle.html`), embeds a built copy of the
catalog data via the existing `pnpm bundle` script
(`apps/portfolio-cartographer/scripts/bundle.mjs`, invoked as
`pnpm build && node scripts/bundle.mjs`). This must be regenerated, not
hand-edited, after the source data changes.

## Out of scope

- Changing the *shape* of the canonical registry itself (already finalized
  this session; `unresolvedCandidates` is empty and stays that way).
- Any change to Mission Fabric, D1 Goal Graph, or other runtime/operational
  systems the catalog explicitly has no authority over.
- Building a fully automated CI-driven resync (e.g. a scheduled job that
  re-runs the generator on registry changes). This piece produces a
  manually-invoked script; automating its triggering is future work if
  drift recurs often enough to justify it.
- Fixing the pre-existing, unrelated stashed WIP changes on the `cambium`
  repo (the `program:company-website` relaunch) beyond what's needed for
  it to validate against the resynced catalog — that stash gets reviewed
  and applied separately, after this piece lands.

## Architecture

A new script, `scripts/generate-portfolio-catalog-data.mjs` (repo root),
reads the canonical registry JSON from its vault path, transforms each
section into the `RAW_*` shapes `portfolio-catalog-data.ts` already defines,
and writes the result to both mirrored files byte-identical — preserving
the existing "copied byte-for-byte" convention documented in the apps
mirror's own header comment.

The two digest constants (`PORTFOLIO_CLASSIFICATION_DIGEST` in
`portfolio-catalog.ts`, `CLASSIFICATION_DIGEST` in `domain.ts`) and the six
pinned counts + `PortfolioCatalogSummary` interface literals stay
hand-maintained plain constants, updated as a manual step after running the
generator. This keeps the generator single-purpose (it only ever produces
data, never edits TypeScript logic files) and avoids it needing a
TypeScript-aware patcher. The generator prints the registry's
`classificationDigest.value` so this step is a copy-paste, not a
recomputation.

`EXPECTED_CATALOG_DIGEST` cannot be computed ahead of time by design (it is
a hash over the *fully assembled* catalog object, including the other
constants above) — after updating the data files and pinned constants, a
one-off script imports the module's own `canonicalJson`/`sha256` logic
against the new `RAW_*` data to read off the real digest, which then gets
hardcoded. This is a deterministic read of the module's own output, not a
guess.

## Schema change

`RawSapling` gains an optional 9th tuple slot, `commercialReuse?:
'white-labelable'`, mirroring what `RawProgram` already has. This is a
minimal, additive change: `materializeRecords()`'s sapling-mapping branch
starts passing `commercialReuse` through, and `validateRecord()`'s Sapling
branch gets the same `expectEnum(record.commercialReuse, ['white-labelable'], ...)`
check the Program branch already has. No existing Sapling record is
affected except `sapling:hostscale`, which is the one that needs this field
today (`commercialReuse: 'white-labelable'` in the registry, from being
white-labelable to `branch:co-property`).

## Data flow (registry → catalog)

For each of the registry's 72 `workObjects`:

- `kind: "sapling"` → `RawSapling` tuple: `workId`, `name`,
  `promotionState`, `tenantIdentity.status` (mapped to the 3-value
  `RawSapling` tenant enum), `tenantIdentity.tenantId`, `sourceRefs` →
  `provenance`, `linkedWorkIds`, `identityAliases` → `aliases`,
  `commercialReuse` (new slot, only `sapling:hostscale` uses it today).
- `kind: "program"` → `RawProgram` tuple: `workId`, `name`, `programKind`,
  `lifecycle`, `tenantIdentity.status` (5-value enum), `tenantIdentity.tenantId`,
  `sourceRefs` → `provenance`, `accountId`, `linkedWorkIds`,
  `operationalStatus === "paused"` → `overlay: 'paused'`,
  `commercialReuse`.
- `historicalProductSurfaces` (20 entries) → `RAW_HISTORICAL_PRODUCTS`:
  `id`, `name`, `status`, `linkedWorkId ?? null`, `sourceRef` (registry
  already stores exactly one, matching the catalog's `provenance.length
  === 1` requirement).
- `unresolvedCandidates` (currently empty) → `RAW_CLASSIFICATION_REVIEW`
  (currently empty array; the pinned count becomes `0`, not decremented).
- `operationalGaps[].workId` (48 entries) → `RAW_OPERATIONAL_GAP_WORK_IDS`
  (flat list; the catalog's simplified gap model already drops the
  registry's extra `tenantActivation` field, matching the file header's
  "operational payloads are intentionally omitted" note — no change in
  behavior there, just more entries).

`sourceRefs` values already follow this session's own established
convention (document/repo/vault paths, never bare domains or absolute
filesystem paths), so no additional filtering is needed to satisfy
`rejectForbiddenMaterial`'s absolute-path check — this gets verified by
running the validator, not assumed.

## Error handling

The existing `validatePortfolioCatalog()` is the primary safety net — it
already fails closed on count drift, digest mismatch, malformed records,
duplicate identities, and forbidden material (absolute paths, live
operational field names). The generator script itself does no independent
validation; it produces data and lets the existing module validate it on
next import, which is the same fail-closed contract the codebase already
relies on elsewhere.

If the generator encounters a registry `workObject` whose shape it cannot
map (e.g. an unrecognized `programKind`, a `tenantIdentity.status` outside
either enum), it throws immediately naming the offending `workId` rather
than emitting partial or guessed data.

## Testing / verification

No new business logic is being tested — this is a data-projection step,
and `validatePortfolioCatalog()` running at module load *is* the test.
Verification is: run both packages' existing test/check commands and
confirm green, plus a manual diff review of the generated data against the
registry (to catch a wrong `accountId` or similar mapping mistake the
schema validator has no way to catch on its own).

Concretely, after the generator runs and the manual constant updates land:

1. `node --experimental-strip-types --test workers/quests/src/portfolio-catalog.test.ts`
2. Confirm `operating-fabric-organ-update.test.ts` and
   `operating-fabric-portfolio.test.ts`'s `classificationDigest` fixture
   values — read their usage first to determine whether they need the real
   digest or are inert fixtures, and update only if needed.
3. `pnpm bundle` in `apps/portfolio-cartographer` (regenerates
   `portfolio-workbench.generated.ts` and `bundle.html`).
4. `pnpm check` in `apps/portfolio-cartographer` (test, lint, bundle,
   standalone audits).
5. The root `deterministic release verification` suite (the same CI gate
   from PR #278), run locally before pushing.
