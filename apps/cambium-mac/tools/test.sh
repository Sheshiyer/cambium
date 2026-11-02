#!/bin/zsh
# Runs unit tests for the CambiumCore package.
# Usage: ./tools/test.sh
set -euo pipefail
here=${0:A:h}
root="$here/.."
echo "test: swift test (CambiumCoreTests)"
swift test --package-path "$root" --scratch-path "$root/.build"
