# Cambium Native

Native macOS founder/operator surface built from the reviewed Cambium discovery
and the pinned [Bama template](source-provenance/BAMA.md). The opening job is to
see the whole system, inspect one work object, and choose the next meaningful
action. Tenant and role boundaries continue to belong to the operational owners.

This is a development build. The core owner adapters and local verification are
implemented; native screen integration is in progress. A local fixture result
does not establish a live founder decision, admitted execution, or release acceptance.

## Build and run

Use a Mac with Swift tools 6.2 or later and the macOS 26 SDK or later. The current
package targets macOS 26. Local verification has run on Apple Silicon; Intel and
universal distribution have not been verified. There are no remote Swift package
dependencies.

From the repository root:

```sh
swift test --package-path apps/cambium-mac
apps/cambium-mac/build.sh --debug
apps/cambium-mac/tools/verify-bundle.sh
```

The bundle is `apps/cambium-mac/build/Cambium Native.app`. Build output is ignored.
The development identifier is `space.thoughtseed.cambium.native.dev`, separate
from the existing Electron application. Building uses ad-hoc signing by default.
Installation and opening require explicit build-script flags; the default build
does neither. Developer ID signing, notarization and release installation remain
separate acceptance work.

Launch the executable with `--demo` or `CAMBIUM_NATIVE_DEMO=1` for visibly
synthetic fixture replay. Standard mode starts without identity or owner data.
Demo data is separate from standard-mode adapters and supplies no live authority.

## Source and owner boundaries

- [Brief](docs/BRIEF.md), [architecture](docs/ARCHITECTURE.md), and
  [stories](docs/STORIES.md) retain the reviewed product scope and release checks.
- [Native identity](docs/NATIVE-IDENTITY-CONTRACT.md) describes external-browser
  S256 sign-in, one-time exchange and short-lived scoped sessions. Tokens stay in
  memory. The source factory remains unconfigured without explicit owner bindings.
- [Native launch](docs/NATIVE-LAUNCH-CONTRACT.md) distinguishes read-only admission
  discovery, current capability checks, durable original request identity, and
  status-only recovery. A canonical approval does not create an admission.
- [Knowledge adapters](docs/KNOWLEDGE-ADAPTER-CONTRACT.md) distinguish Field Theory
  and Field Report. Their native reference-transfer formats do not assert an
  implemented external bridge or authorize corpus ingestion.
- The bundled organ portraits retain the exact source derivatives and their
  [lineage manifest](Sources/CambiumNative/Resources/Atlas/asset-lineage.json).
  They identify conceptual roles; they do not indicate runtime health.

Live activation still requires the reviewed client registry and callback,
current role/enrollment lookups, reachable native API paths under the Access
policy, an applied owner-side schema, and a concrete admitted execution owner.
This build does not activate those dependencies or supply a shared runner token.

## Artifact provenance

The build embeds `build-proof.json` before signing. It records the Git revision,
input hashes, input dirty state and toolchain. Only the executable target's
declared resource bundle ships; test resource bundles are rejected by verification.

`tools/snap.sh [output-directory] [page]` captures actual synthetic native windows
in light and dark appearances at default and minimum sizes. Snapshot manifests
use the embedded build stamp and the running executable's hash. Set
`CAMBIUM_NATIVE_EXPECTED_REVISION` to reject an unexpected build; this check never
relabels the binary. Hashes identify bytes and do not confer producer authority.
