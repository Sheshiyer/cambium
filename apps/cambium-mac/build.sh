#!/bin/zsh
# Builds Cambium Native into a local, git-ignored app bundle:
#   apps/cambium-mac/build/Cambium Native.app
# Adapted from the Bama new-mac-app template build script (MIT, see
# source-provenance/BAMA.md). Unlike the template, this script never installs or
# opens anything unless asked, and it never signs with a discovered identity.
#
# Usage: ./build.sh [options]
#   --debug                 debug configuration (default: release)
#   --sign-identity NAME    codesign identity (default: "-", ad hoc).
#                           SIGN_IDENTITY=NAME is accepted as well.
#   --install               also copy the bundle to ~/Applications/Cambium Native.app.
#                           Refuses to replace a bundle with another identifier.
#   --open                  open the built (or installed, with --install) bundle
#   --help                  show this help
set -euo pipefail

here=${0:A:h}
product="CambiumNative"
display="Cambium Native"
bundle_id="space.thoughtseed.cambium.native.dev"
scratch="$here/.build"
out_dir="$here/build"
app="$out_dir/$display.app"
config=release
identity="${SIGN_IDENTITY:--}"
do_install=false
do_open=false

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; }

while (( $# > 0 )); do
  case "$1" in
    --debug) config=debug ;;
    --sign-identity)
      (( $# >= 2 )) || { echo "build: --sign-identity needs a value" >&2; exit 2; }
      identity="$2"; shift ;;
    --install) do_install=true ;;
    --open) do_open=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "build: unknown option $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

[[ -n "$identity" ]] || { echo "build: empty signing identity" >&2; exit 2; }

# Input digest before compile; the stamp must describe the bytes that were compiled.
pre_digest=$(python3 "$here/tools/build-proof.py" inputs-digest)
echo "build: swift build -c $config"
swift build -c "$config" --package-path "$here" --scratch-path "$scratch" --product "$product"
bin_dir=$(swift build -c "$config" --package-path "$here" --scratch-path "$scratch" --show-bin-path)
bin="$bin_dir/$product"
[[ -x "$bin" ]] || { echo "build failed: no executable at $bin" >&2; exit 1; }
# swift build can report success while an edited file failed to compile (Bama note).
stale=$(find "$here/Sources" -name '*.swift' -newer "$bin" | head -1)
[[ -z "$stale" ]] || { echo "build failed: executable is older than $stale" >&2; exit 1; }

# Assemble a fresh bundle so no file from an earlier build survives.
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$bin" "$app/Contents/MacOS/$product"
sed -e "s/__BUILD__/$(date -u +%Y%m%d%H%M)/" "$here/Info.plist.in" > "$app/Contents/Info.plist"
plutil -lint -s "$app/Contents/Info.plist"

# Only the executable target's declared resource bundle ships. A previous test
# run may leave test bundles beside it; those are not application resources.
resource_bundle="$bin_dir/CambiumNative_CambiumNative.bundle"
[[ -d "$resource_bundle" ]] || { echo "build failed: application resources missing" >&2; exit 1; }
cp -R "$resource_bundle" "$app/Contents/Resources/"

# Build proof (tools/build-proof.py): source revision, dirty state and input hashes,
# written before codesign so the signature covers it. It never holds the signed
# executable's own hash; snapshots record that outside the bundle.
[[ "$identity" == "-" ]] && identity_kind=adhoc || identity_kind=named-identity
python3 "$here/tools/build-proof.py" generate --config "$config" --identity-kind "$identity_kind" \
  --out "$app/Contents/Resources/build-proof.json"
post_digest=$(python3 "$here/tools/build-proof.py" check "$app/Contents/Resources/build-proof.json" | awk -F'aggregate=' '{print $2}')
if [[ "$post_digest" != "$pre_digest" ]]; then
  rm -rf "$app"
  echo "build failed: build inputs changed during compile; bundle removed, rebuild" >&2
  exit 1
fi
# Optional icon, produced by tools/make_icon.sh when an Icon/ source exists.
for icon in "$here/Resources/AppIcon.icns" "$here/Resources/Assets.car"; do
  [[ -f "$icon" ]] && cp -X "$icon" "$app/Contents/Resources/"
done

xattr -cr "$app"
codesign --force --sign "$identity" --timestamp=none "$app" 2>&1 | grep -v "replacing existing signature" || true
codesign --verify --strict "$app"
echo "build: $app"
echo "build: signed with ${identity/#-/ad hoc (-)}"

target="$app"
if [[ "$do_install" == true ]]; then
  dest="$HOME/Applications/$display.app"
  if [[ -d "$dest" ]]; then
    existing=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$dest/Contents/Info.plist" 2>/dev/null || true)
    if [[ "$existing" != "$bundle_id" ]]; then
      echo "build: refusing to replace $dest (identifier '${existing:-unknown}')" >&2
      exit 1
    fi
  fi
  mkdir -p "$HOME/Applications"
  rm -rf "$dest"
  ditto "$app" "$dest"
  echo "build: installed $dest"
  target="$dest"
fi

if [[ "$do_open" == true ]]; then
  osascript -e "quit app id \"$bundle_id\"" 2>/dev/null || true
  sleep 0.5
  open "$target"
  echo "build: opened $target"
fi
