#!/bin/zsh
# Verifies the locally built Cambium Native .app bundle: structure, plist keys,
# executable, signature, and layout invariants.
# Usage: ./tools/verify-bundle.sh
set -euo pipefail
here=${0:A:h}
app="$here/../build/Cambium Native.app"

[[ -d "$app" ]] || { echo "verify-bundle: bundle not found at $app. Run ./build.sh first." >&2; exit 1; }

echo "verify-bundle: checking structure..."
[[ -f "$app/Contents/Info.plist" ]]
[[ -x "$app/Contents/MacOS/CambiumNative" ]]
[[ -d "$app/Contents/Resources/CambiumNative_CambiumNative.bundle" ]]
for resource in "$app/Contents/Resources"/*.bundle(N); do
  [[ "${resource:t}" == "CambiumNative_CambiumNative.bundle" ]] || {
    echo "verify-bundle: unexpected resource bundle ${resource:t}" >&2; exit 1;
  }
done

echo "verify-bundle: checking Info.plist bundle identifier..."
id=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$app/Contents/Info.plist")
expected="space.thoughtseed.cambium.native.dev"
[[ "$id" == "$expected" ]] || { echo "verify-bundle: expected bundle id $expected, got $id" >&2; exit 1; }

echo "verify-bundle: checking code signature..."
codesign --verify --strict "$app"

echo "verify-bundle: PASS ($app)"
