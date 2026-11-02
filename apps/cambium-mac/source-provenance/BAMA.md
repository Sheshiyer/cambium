# Bama template provenance

Upstream: `daveebbelaar/bama`, commit `639893c397278256f1ae204dd8f837eb82bd6527`
(1 November 2026), MIT License. The full license text is in
[`BAMA-LICENSE.txt`](BAMA-LICENSE.txt) and applies to the adapted portions below.

The template was read as a reference. Its `new-app.sh` script was not run, so no
nested Git repository, automatic staging or commit happened. No Bama plugin,
skill link or remote package is a build dependency.

## Adapted portions

| Cambium file | Template source | What changed |
| --- | --- | --- |
| `Package.swift` | `template/Package.swift` | Cambium targets `CambiumCore` and `CambiumNative`, processed resources, test target `CambiumCoreTests`. Kept Swift tools 6.2, macOS 26 and main-actor default isolation. |
| `Info.plist.in` | `template/Info.plist.in` | Dev identity `space.thoughtseed.cambium.native.dev`, display name Cambium Native. Distinct from the Electron app's `space.thoughtseed.cambium`. |
| `build.sh` | `template/build.sh` | Output goes to the ignored `build/` folder. Ad hoc signing by default, explicit `--sign-identity` option, and no keychain identity lookup. Install and open happen only with flags, and install refuses to replace a bundle with another identifier. |
| `.gitignore` | `template/.gitignore` | Adds the local bundle output, snapshot and scratch folders. |
| `Sources/CambiumNative/CambiumNativeApp.swift` | `template/Sources/__APP_NAME__/App.swift`, `Snapshot.swift` | Activation-policy delegate, window snapshot loop with display-wake assertions, `screencapture -l` capture and view-cache fallback. Cambium uses its own root view, demo-mode labelling and a snapshot manifest. |
| `tools/snap.sh` | `template/tools/snap.sh` | Runs the local bundle with `CAMBIUM_NATIVE_DEMO=1` and writes captures into the selected output directory. |

## Not adopted

- The template's `Item` model, SwiftData store, seed data, sidebar pages,
  theme/accent picker and self-test views. Cambium's operational graph is
  server-owned, and local storage stays preferences and disposable cache.
- Automatic signing with the first Apple Development certificate found.
- Installing to `~/Applications` and reopening on every build.
- `git init` and the automatic initial commit.
