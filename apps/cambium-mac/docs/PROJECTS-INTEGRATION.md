# Mapped projects in Cambium Native

This checkpoint covers the founder/operator Projects screen added on 2026-11-02.
It consumes the **served** `portfolioCatalogSummary`, founder-only
`portfolioCatalog`, and `portfolioJoinReport` sidecars from the existing scoped
`GET /v1/mission-fabric/cambium` read. No project list or tenant grant is
hardcoded into the standard app. The catalog remains `readOnly` with
`actionAdmission: none` and `render-and-proposal-only` status.

## Read and navigation path

1. The native session resolves a founder and exact `cambium` tenant at the owner.
2. The Mission Fabric decoder checks tenant, role, counts, digests, caps and
   catalog authority fields before returning the envelope.
3. `MappedPortfolioDecoder` maps every served record, preserves the display and
   action digests separately, and fails the read on malformed detail.
4. Canopy and Projects show source classifications, provenance, tenant labels,
   lifecycle, promotion state, links and mission-data gaps. Global search can
   select any mapped record. Viewer scope receives totals only.
5. A project opens operational Work only if an explicit `portfolioJoinReport`
   pair names its canonical ID and an existing Work node in the served graph.
   Names, aliases, equal IDs and catalog membership never create that link.
   Work review and launch retain their own existing admission checks.

The bundled demo is a **dated synthetic-owner replay**. Its fixture has 76
catalog records, 73 action records and one explicit Cambium runtime join. The
working catalog source in the checkout had 77 display and 74 action records at
this checkpoint. Counts are read from each served envelope; the app does not
claim the older fixture is the current production catalog.

## Local verification

- `swift test --package-path apps/cambium-mac`: all native and Core tests passed,
  including 14 new decoder and two new app integration tests.
- `node --test workers/quests/src/native-session-routes.test.ts`: 24 passed.
  The new assertion proves a scoped local founder session receives detailed
  records and a separate join report.
- `./apps/cambium-mac/build.sh`: release app bundle built and ad hoc signed.
  Embedded build proof reports revision `15ff5de` with clean app inputs and
  aggregate `f12bc1aa27dd51570c3515cb065ceafb3ca317682bf4d085fe296f97b9eb6641`.
  `codesign --verify --strict` and build-proof recheck passed.

These are local source, fixture, route-harness and bundle proofs. The Mac was
locked during the first visual inspection attempt; visual QA is pending an
unlocked session. An unauthenticated 2026-11-02 read-only probe saw health
`200` and Mission Fabric `401` on the direct Worker origin, and `401` on the
custom domain. That proves no founder catalog content. The deployed runtime
has not been proven to register the native client, compose a native session
host, enroll the founder, or serve this catalog to the Mac app. Production
configuration, migration, deployment and a real founder walkthrough retain
their separate owner gates.

## Reversal

Revert the three scoped commits `a62955b`, `d0defc5`, `15ff5de` to remove this
native project presentation and its test without touching catalog sources,
runtime configuration, deployment state or the other work in the shared tree.
