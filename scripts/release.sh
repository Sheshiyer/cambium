#!/usr/bin/env bash
# Cut a Muse-codenamed Cambium release.
#   Usage:  bash scripts/release.sh <version> <Codename>
#   e.g.    bash scripts/release.sh 0.3.0 Urania
#
# Bumps package.json (version + codename), gates on the release suite, commits, creates the annotated
# tag vX.Y.Z, and pushes it — which triggers .github/workflows/release.yml (re-runs the same gates +
# cuts the GitHub Release "vX.Y.Z · <Codename>"). Update the VERSIONS.md "Current" stanza BEFORE running.
set -euo pipefail

VERSION="${1:?usage: release.sh <version> <Codename>  (e.g. 0.3.0 Urania)}"
CODENAME="${2:?usage: release.sh <version> <Codename>  (e.g. 0.3.0 Urania)}"
TAG="v${VERSION}"

# bump package.json (version + codename) — no extra deps
node -e "const fs=require('fs');const p=require('./package.json');p.version='${VERSION}';p.codename='${CODENAME}';fs.writeFileSync('./package.json',JSON.stringify(p,null,2)+'\n');"
echo "→ package.json bumped to ${VERSION} · ${CODENAME}"

# gate on the release suite before tagging anything
run_gate() {
  local label="$1"
  shift
  echo "→ ${label}…"
  "$@" || { echo "✘ ${label} failed — aborting release"; git checkout -- package.json; exit 1; }
  echo "✓ ${label} green"
}

run_gate "tests" npm test
run_gate "standalone audit" npm run standalone:audit
run_gate "standalone smoke" npm run standalone:smoke
run_gate "TG mini app readiness proof (non-strict)" npm run proof:tg-live-readiness

# guard: readiness ledger must not be older than the HEAD commit we are about to tag
READINESS_LEDGER="docs/plans/assets/tg-miniapp-live-proof/readiness.json"
if [ ! -f "${READINESS_LEDGER}" ]; then
  echo "✘ release blocked: ${READINESS_LEDGER} is missing; run 'npm run proof:tg-live-readiness' first."
  git checkout -- package.json
  exit 1
fi
HEAD_TS="$(git log -1 --format=%ct HEAD)"
LEDGER_TS="$(stat -f %m "${READINESS_LEDGER}" 2>/dev/null || stat -c %Y "${READINESS_LEDGER}")"
if [ "${LEDGER_TS}" -lt "${HEAD_TS}" ]; then
  echo "✘ release blocked: ${READINESS_LEDGER} is older than HEAD; run 'npm run proof:tg-live-readiness' first."
  git checkout -- package.json
  exit 1
fi
echo "✓ readiness ledger is fresh (mtime ≥ HEAD commit time)"

git add package.json VERSIONS.md 2>/dev/null || git add package.json
git commit -m "release: v${VERSION} · ${CODENAME}"
git tag -a "${TAG}" -m "v${VERSION} · ${CODENAME}"
git push origin HEAD
git push origin "${TAG}"
echo "✓ pushed ${TAG} — the Release workflow will re-test and cut the GitHub Release."
