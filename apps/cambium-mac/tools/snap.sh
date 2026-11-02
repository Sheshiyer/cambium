#!/bin/zsh
# Renders light and dark window snapshots of Cambium Native in demo mode.
# Usage: tools/snap.sh [output-dir]
set -euo pipefail
here=${0:A:h}
app_dir="$here/../build/Cambium Native.app"
app_bin="$app_dir/Contents/MacOS/CambiumNative"
shots_dir="${1:-/tmp/cambium-native-shots}"

if [[ ! -x "$app_bin" ]]; then
  echo "snap: app binary not found at $app_bin. Run ./build.sh first." >&2
  exit 1
fi

mkdir -p "$shots_dir"

echo "snap: capturing into $shots_dir..."
CAMBIUM_NATIVE_DEMO=1 CAMBIUM_NATIVE_SNAPSHOT="$shots_dir" CAMBIUM_NATIVE_REVISION="$(git rev-parse --short HEAD 2>/dev/null || echo local)" "$app_bin"
echo "snap: done"
find "$shots_dir" -maxdepth 2 -ls
