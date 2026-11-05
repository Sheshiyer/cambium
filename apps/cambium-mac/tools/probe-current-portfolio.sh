#!/bin/sh
# Local cross-language probe of the current Mission Fabric source. No network,
# owner credentials, committed fixtures, or production state are touched.
set -eu

repo_root=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$repo_root"
CAMBIUM_FABRIC_FIXTURE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cambium-fabric-current.XXXXXX")
export CAMBIUM_FABRIC_FIXTURE_DIR
trap 'rm -rf -- "$CAMBIUM_FABRIC_FIXTURE_DIR"' EXIT HUP INT TERM

node apps/cambium-mac/Tests/CambiumCoreTests/Fixtures/fabric-generate.mts
swift test --package-path apps/cambium-mac \
  --filter PortfolioProjectsTests.testCurrentSourceGeneratedFounderEnvelopeWhenProvided
node -e '
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const p = JSON.parse(readFileSync(join(process.env.CAMBIUM_FABRIC_FIXTURE_DIR, "fabric-route-cambium-founder-shadow.json"), "utf8"));
console.log(JSON.stringify({
  catalogDigest: p.portfolioCatalogSummary.catalogDigest,
  current: p.portfolioCatalog.records.length,
  historical: p.portfolioCatalog.historicalProducts.length,
  classificationReview: p.portfolioCatalog.classificationReview.length,
  operationalGaps: p.portfolioCatalogSummary.operationalGaps,
  explicitRuntimeJoins: p.portfolioJoinReport.matches.length,
}));
'
