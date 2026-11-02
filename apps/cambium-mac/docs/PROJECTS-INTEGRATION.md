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
   source account/family labels when supplied, lifecycle, promotion state,
   source links and mission-data gaps. Historical
   products remain separate display records. Global search can select current
   and historical records, including catalog aliases and historical source
   links. Filtering keeps the visible dossier aligned with the results; opening
   a linked source record reveals it even when a prior filter hid it. Viewer
   scope receives totals only.
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

- `swift test --package-path apps/cambium-mac`: 34 native and 247 Core tests
  passed, with one existing opt-in fixture skip. Focused historical mapping
  and app integration tests passed.
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
- The opt-in current-source mapper now asserts the named project anchors
  `sapling:cambium`, `program:cambium-operating-fabric`, and `branch:relovo`,
  including their provenance, tenant/classification fields, and the single
  explicit `sapling:cambium` runtime join. Aggregate counts alone are not
  accepted as proof of project identity wiring. The probe additionally pins
  exact names and provenance for the mapped `branch:heyzack`,
  `branch:parkarea`, `branch:tirak`, and `sapling:dlock` records, while
  requiring all four to remain unjoined. The concurrent working catalog also
  contains `sapling:lumen-bar`; that dirty source lane is intentionally not
  promoted or treated as committed live proof here.
- The 2026-11-02 navigation follow-up at clean app-input revision `85068da`
  makes alias search find the mapped `DLOCK` source record through its distinct
  `Lockwell` alias, keeps filtered results and dossier aligned, and reveals
  linked records after navigation. Five focused native Projects tests pass;
  the current-source TypeScript-to-Swift probe still passes at 77 current,
  20 historical, zero review, 50 gap and one explicit join. This is local
  navigation and compatibility evidence, not an interactive walkthrough.
- `tools/snap.sh` now accepts `projects` directly. The rebuilt ad hoc signed
  bundle passes strict signature, bundle verifier and embedded clean-input
  proof (`f069378b`). Its four synthetic Projects captures at 1280×820 and
  880×612 in light and dark report no failures; minimum-size images were
  inspected after this change. The signed window cannot prove search typing,
  link activation or Work navigation without the unlocked interactive pass.
- The signed synthetic demo bundle was rebuilt at clean app-input revision
  `55ca159` (aggregate `e59dfd948bc58eef4b866c7a81c3cecd982a7ffcc2d38c5636d48e247a6ea642`).
  Its own snapshot mode captured the Projects page at 1280×820 and 880×612 in
  distinct light and dark appearances with no manifest failures. Direct image
  inspection confirmed that the source date renders, a project row and dossier
  are visible at minimum size, and the demo label remains prominent. The first
  captures exposed an unreadable whole-second source date and a below-fold list;
  both were fixed in `41eb7a8`/`0020e3a`. Snapshot color labels were initially
  false because the SwiftUI model overrode AppKit appearance; `55ca159` now
  drives both together. Four focused Projects tests and the full Swift suite
  pass (the opt-in current-source probe is skipped in the default suite).

These are local source, fixture, route-harness, synthetic window and bundle
proofs. An unlocked interactive walkthrough on the rebuilt bundle then
verified Connections prefill, `Cambium` search, the exact Work join, bounded
Work navigation, and return to unconfigured standard mode; no session was
applied. A second spot-check searched `HeyZack`, showed 11 matching mapped
client-branch records, and opened its provenance-bearing dossier with no
served runtime join. An unauthenticated
2026-11-02 read-only probe saw health
`200` and Mission Fabric `401` on the direct Worker origin, and `401` on the
custom domain. The native session path returned `404` on the direct origin.
That proves no founder catalog content or usable native sign-in route. The deployed runtime
has not been proven to register the native client, compose a native session
host, enroll the founder, or serve this catalog to the Mac app. Production
configuration, migration, deployment and a real founder walkthrough retain
their separate owner gates.

The ordinary Cambium Plexus adapter (`workers/quests/src/lib/plexus-principal.ts`)
still resolves a role only from a verified browser Access JWT forwarded to
`/v1/whoami`; its principal has wildcard tenant scope and is not used for
cookie-free native exchange or later bearer reads. The new
`workers/quests/src/plexus-native-identity.ts` adapter consumes the separately
scoped `plexus.native-identity.v1` contract from ready-for-review TeamForge PR #105,
mapping only active `admin` identities to native `founder` and rechecking the
exact `cambium` enrollment on every callback. This is source wiring, not live
authority: the PR, endpoint, dedicated token, tenant/workspace map, client,
origin, Access verifier and D1 bindings still need owner readback. A static
founder list or the display catalog must not stand in for these checks.

## Reversal

Revert the scoped implementation commits `a62955b`, `d0defc5`, `15ff5de`,
`334c9a6`, `8a24b94`, `e5fe1f1`, `7ff409f` and `af5c636` to remove the native project
presentation and tests without touching catalog sources, runtime
configuration, deployment state or the other work in the shared tree.
