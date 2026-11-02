# Mapped projects in Cambium Native

This checkpoint covers the founder/operator Projects screen added on 2026-11-02.
It consumes the **served** `portfolioCatalogSummary`, founder-only
`portfolioCatalog`, and `portfolioJoinReport` sidecars from the existing scoped
`GET /v1/mission-fabric/cambium` read. No project list or tenant grant is
hardcoded into the standard app. The catalog remains `readOnly` with
`actionAdmission: none` and `render-and-proposal-only` status.

## Read and navigation path

1. When activated, the native session resolves a founder and exact `cambium`
   tenant at the owner.
2. The Mission Fabric decoder checks tenant, role, counts, digests, caps and
   catalog authority fields before returning the envelope.
3. `MappedPortfolioDecoder` maps every served active record, historical product,
   and classification review row. It preserves display and action digests
   separately and fails the read on malformed detail.
4. Canopy and Projects show source classifications, provenance, tenant labels,
   lifecycle, promotion state, source links and mission-data gaps. Historical
   products remain separate display records. Global search can select current
   and historical records. Viewer scope receives totals only.
5. A project opens operational Work only if an explicit `portfolioJoinReport`
   pair names its canonical ID and an existing Work node in the served graph.
   Names, aliases, equal IDs and catalog membership never create that link.
   Work review and launch retain their own existing admission checks.

The bundled demo is a **dated synthetic-owner replay**. Its fixture has 76
current records, 20 historical products, 73 action records and one explicit
Cambium runtime join. The uncommitted working catalog source in the checkout
had 77 current records, 20 historical products, zero classification reviews,
50 mission-data gaps and 74 action records at this checkpoint. Counts are read
from each served envelope; the app does not claim the older fixture is the
current production catalog.

## Local verification

- `swift test --package-path apps/cambium-mac`: 31 native and 246 Core tests
  passed. Focused historical mapping passed 18 tests; three app integration
  tests passed.
- `node --test workers/quests/src/native-session-routes.test.ts`: 24 passed.
  The new assertion proves a scoped local founder session receives detailed
  current and historical records, classification questions, and a separate
  join report.
- `./apps/cambium-mac/build.sh`: release app bundle built and ad hoc signed.
  Embedded build proof reports revision `7ff409f` with clean app inputs and
  aggregate `8b2e8bd9ade7be974711963d6eec71e456512ce695d1cbba38dd069d2dd2f3c8`.
  `codesign --verify --strict` and build-proof recheck passed.
- `./apps/cambium-mac/tools/probe-current-portfolio.sh`: generates a fresh
  Mission Fabric founder response through the TypeScript handler in a temporary
  directory, decodes it with the Swift Core mapper, then removes the temporary
  files. On 2026-11-02 it passed with 77 current records, 20 historical, zero
  classification reviews, 50 reported gaps and one explicit runtime join;
  display digest `sha256:42e1dd2b1aa672b6bb43b15c997dfb4cb1b3130181fca2e19a4a7e11c2374a94`.
  This probes the current **working source**, including uncommitted catalog
  edits from another lane. It does not prove that source was deployed.

These are local source, fixture, route-harness and bundle proofs. The Mac was
locked during the first visual inspection attempt; visual QA is pending an
unlocked session. An unauthenticated 2026-11-02 read-only probe saw health
`200` and Mission Fabric `401` on the direct Worker origin, and `401` on the
custom domain. The native session path returned `404` on the direct origin.
That proves no founder catalog content or usable native sign-in route. The deployed runtime
has not been proven to register the native client, compose a native session
host, enroll the founder, or serve this catalog to the Mac app. Production
configuration, migration, deployment and a real founder walkthrough retain
their separate owner gates.

## Reversal

Revert the scoped implementation commits `a62955b`, `d0defc5`, `15ff5de`,
`334c9a6`, `8a24b94`, `e5fe1f1` and `7ff409f` to remove the native project
presentation and tests without touching catalog sources, runtime
configuration, deployment state or the other work in the shared tree.
