# Field Atlas as the sole browser surface

Date: 2026-11-02. Base: `8261d4840988e2e1c6fa6c2eb85cee96d4344b58`.
Status: source candidate for review; no production deployment.

## Problem and owner direction

The served PAGE still assembled the retired Mission Control five-scene desk,
Operating Fabric, and Field Atlas into one document. The world launcher allowed
old scene flags to avoid mounting the world and offered the desk after failure.
The founder requested removal of the retired 2D UI from the build.

The applicable UI retirement decision is the October 23
[in-world founder Gate contract](../architecture/in-world-founder-gate.md),
section 5. The September 27 visual retirement record concerns three generated
visual documents; it is not permission to delete services or canonical data.

## Exact source sequence

1. Preserve the dirty primary checkout and start an isolated branch from current
   remote main. Read ownership instructions, current Gate/read contracts and the
   retirement records before editing.
2. Separate the old composed document and additive launcher into explicit
   `page/retired.ts` and `components/retired-curious-world.ts` fixtures. Historical
   UI tests import those fixtures; the serving entrypoint does not.
3. Replace `page/index.ts` with the Field Atlas head, minimal host and maintained
   world. Extract initial hydration into its own serving module. The handler
   changes only the hydration import.
4. Keep the existing read and Gate bridge source, generated world payload,
   in-world Gate folios, authentication, routes, decision checks and canonical
   stores unchanged. The host retains selected-tenant reads, runtime Telegram
   headers, founder prefix, request revision checks, initial hydration and
   fail-closed reads. The world receives sanitized accessors only.
5. Remove the unconditional Telegram SDK and theme initialization from ordinary and founder web. Only an actual Telegram launch context may load the optional SDK before the existing authenticated read; founder web uses Access.
6. Remove query-flag desk exits and the legacy fallback. Renderer failure offers
   retry. Pagehide cancels owned reads and disposes rendering; restoring a cached
   page refreshes and remounts the same world.
7. Test current serving behavior separately from historical artifact behavior.
   Check the actual Worker bundle and build metadata for retired UI inputs and
   markers. Regenerate source-atlas fingerprints after the import/entry change;
   retain the atlas model and canonical authority.

## Verification

- Serving PAGE: 812,435 bytes, previously 1,644,052 bytes. Removed: 831,617 bytes.
- PAGE SHA-256: `3e374efcc4eb651ea3496ed3ef3f69ff2910a4c8afbd560e0266d4e07f5061ae`.
- Wrangler 4.156.1 dry-run builds a 2,438,529-byte Worker. No upload or traffic
  promotion occurs. Build guard finds zero retired UI inputs/markers and the
  maintained world plus both bridges.
- Existing bridge implementations, generated world and in-world source remain
  byte-identical to base. The current Gate suites keep nonce, identity, tenant,
  review, receipt, renewal and uncertain-outcome behavior intact.
- The new host tests cover scoped reads, invalid/cross-tenant/stale/future data,
  HTTP failures, hydration, cancellation, no SDK on web/founder, optional Telegram adapter failure, old query flags, synchronous/throwing
  renderer failure, retry and cached-page restoration.
- Root IAB observed one canvas, Field Atlas title, Enter world, eight-district
  chart, founder Gate folio and empty synthetic decision journal. Old query flags
  still showed the world with no retired tabs or desk text. This is local browser
  evidence with synthetic data and no writes, not authenticated production proof.
- Full suite first pass: 2,509/2,536 passed. Historical serving-page assertions
  exposed by retirement were moved to explicit retired fixtures; their 68-test
  focused rerun passes. The source-atlas fingerprint was regenerated with the
  canonical generator and its check passes. Six repository/Git-ref snapshot tests
  encountered concurrent Codex turn-diff ref movement. The canonical viewport
  fingerprint remains stale and is not repinned or represented as new proof.

Reproduce the build check without an upload:

```sh
wrangler deploy --dry-run --config workers/quests/wrangler.labs.jsonc \
  --outdir .artifacts/field-atlas-3d-only \
  --metafile .artifacts/field-atlas-3d-only/bundle-meta.json
node scripts/check-field-atlas-build.mjs \
  workers/quests/.artifacts/field-atlas-3d-only/index.js \
  .artifacts/field-atlas-3d-only/bundle-meta.json
node scripts/generate-system-atlas.mjs --check
```

Some `scenes/story.ts` and `scenes/tools.ts` pure parsers remain Worker inputs
because server projections use them. Their client UI strings and renderers are
absent from the emitted bundle; removing those parsers would change API behavior.

## Remaining gates and rollback

Owner review and a fresh environment/deployment readback precede any remote
version upload. A compiled candidate can use an existing Worker preview version
without production traffic only after its authentication and exposure boundary
are reviewed; this source change creates no preview service or bypass.

Production promotion, live founder sign-in, a real Gate decision and canonical
mobile/trusted-touch proof are separate. The old canonical capture plan still targets retired desk selectors and needs an owner-reviewed3D successor; a changed hash alone would not establish that coverage. No decision was submitted or simulated
as a real result. Existing viewport evidence and its stale fingerprint are
retained honestly. The local preview rejects writes.

Rollback before deployment is to leave the current Worker untouched. Source
rollback reverts this branch's entrypoint/host/hydration and fixture-import
changes as a reviewed unit. After a later authorized rollout, use the separately
recorded previous Worker version. Do not change binding, identity, data,
provider, scheduler or canonical store state as part of this UI rollback.
