#!/bin/zsh
# Renders light and dark window snapshots of Cambium Native in demo mode.
# Usage: tools/snap.sh [output-dir] [page]
#   page  optional AppSection to capture, one of: canopy projects work trace evidence
#         proposal launch knowledge connections preferences. Default keeps the Canopy capture.
#         Filenames and snapshot-manifest.json record the page. Data is synthetic demo data.
# Captures only the built app bundle; nothing is installed, opened or deleted.
set -euo pipefail
here=${0:A:h}
app_dir="$here/../build/Cambium Native.app"
app_bin="$app_dir/Contents/MacOS/CambiumNative"
shots_dir="${1:-/tmp/cambium-native-shots}"
page="${2:-}"

pages=(canopy projects work trace evidence proposal launch knowledge connections preferences)
if [[ -n "$page" && ${pages[(Ie)$page]} -eq 0 ]]; then
  echo "snap: unknown page '$page'. Use one of: ${pages[*]}" >&2
  exit 2
fi

if [[ ! -x "$app_bin" ]]; then
  echo "snap: app binary not found at $app_bin. Run ./build.sh first." >&2
  exit 1
fi

mkdir -p "$shots_dir"

# The revision reported in the snapshot comes from the build stamp embedded in
# the bundle, never from the current checkout. A different expected revision is
# a check: the app refuses the capture instead of relabelling the binary.
env_args=(CAMBIUM_NATIVE_DEMO=1 CAMBIUM_NATIVE_SNAPSHOT="$shots_dir")
[[ -n "$page" ]] && env_args+=(CAMBIUM_NATIVE_SCREEN="$page")
if [[ -n "${CAMBIUM_NATIVE_EXPECTED_REVISION:-}" ]]; then
  env_args+=(CAMBIUM_NATIVE_EXPECTED_REVISION="$CAMBIUM_NATIVE_EXPECTED_REVISION")
fi

echo "snap: capturing ${page:-default page} (demo, synthetic data) into $shots_dir..."
env "${env_args[@]}" "$app_bin"
echo "snap: done"
find "$shots_dir" -maxdepth 2 -ls
