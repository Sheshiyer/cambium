#!/bin/sh
# Synthetic current-source Worker/SQLite -> Swift signal contract proof.
set -eu
repo_root=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$repo_root"
CAMBIUM_SIGNALS_FIXTURE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cambium-signals-wire.XXXXXX")
export CAMBIUM_SIGNALS_FIXTURE_DIR
trap 'rm -rf -- "$CAMBIUM_SIGNALS_FIXTURE_DIR"' EXIT HUP INT TERM
node apps/cambium-mac/Tests/CambiumCoreTests/Fixtures/signals-generate.mts
swift test --package-path apps/cambium-mac --filter SignalsWireIntegrationTests
