#!/bin/zsh
# Renders light and dark window snapshots of Cambium Native in demo mode.
# Usage: tools/snap.sh [output-dir] [page]
#   page  optional AppSection to capture, one of: canopy work trace evidence proposal
#         launch knowledge connections preferences. Default keeps the Canopy capture.
#         Filenames and snapshot-manifest.json record the page. Data is synthetic demo data.
# Captures only the built app bundle; nothing is installed, opened or deleted.
set -euo pipefail
here=${0:A:h}
app_dir="$here/../build/Cambium Native.app"
app_bin="$app_dir/Contents/MacOS/CambiumNative"
shots_dir="${1:-/tmp/cambium-native-shots}"
page="${2:-}"

pages=(canopy work trace evidence proposal launch knowledge connections preferences)
if [[ -n "$page" && ${pages[(Ie)$page]} -eq 0 ]]; then
  echo "snap: unknown page '$page'. Use one of: ${pages[*]}" >&2
  exit 2
fi

if [[ ! -x "$app_bin" ]]; then
  echo "snap: app binary not found at $app_bin. Run ./build.sh first." >&2
  exit 1
fi

mkdir -p "$shots_dir"

echo "snap: capturing ${page:-default page} (demo, synthetic data) into $shots_dir..."
CAMBIUM_NATIVE_DEMO=1 \
CAMBIUM_NATIVE_SNAPSHOT="$shots_dir" \
CAMBIUM_NATIVE_SCREEN="$page" \
CAMBIUM_NATIVE_REVISION="$(git -C "$here" rev-parse --short HEAD 2>/dev/null || echo local)" \
  "$app_bin"
echo "snap: done"
find "$shots_dir" -maxdepth 2 -ls
