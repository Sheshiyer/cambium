#!/usr/bin/env bash
# Usage: bash scripts/release.sh <version> <Codename>
set -euo pipefail

VERSION="${1:?usage: release.sh <version> <Codename>}"
CODENAME="${2:?usage: release.sh <version> <Codename>}"
TAG="v${VERSION}"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "invalid semantic version: $VERSION" >&2; exit 1; }
[ "$(git branch --show-current)" = "main" ] || { echo "release must run from main" >&2; exit 1; }
git diff --quiet -- package.json VERSIONS.md || { echo "package.json or VERSIONS.md has unstaged edits" >&2; exit 1; }
git diff --cached --quiet -- package.json VERSIONS.md || { echo "package.json or VERSIONS.md has staged edits" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "release requires a clean worktree" >&2; exit 1; }
git fetch origin main --quiet
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main is not aligned with origin/main" >&2; exit 1; }
git rev-parse "$TAG" >/dev/null 2>&1 && { echo "tag $TAG already exists" >&2; exit 1; }
git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1 && { echo "remote tag $TAG already exists" >&2; exit 1; }
grep -q "^### ${TAG} " VERSIONS.md || { echo "add the ${TAG} release stanza to VERSIONS.md first" >&2; exit 1; }

npm run verify:release

node -e "const fs=require('fs');const p=require('./package.json');p.version='${VERSION}';p.codename='${CODENAME}';fs.writeFileSync('./package.json',JSON.stringify(p,null,2)+'\n');"

git add package.json VERSIONS.md
git commit -m "release: ${TAG} · ${CODENAME}"
git tag -a "$TAG" -m "${TAG} · ${CODENAME}"
git push origin main
git push origin "$TAG"
echo "pushed $TAG; the Release workflow will re-run deterministic gates and publish separate live-readiness evidence"
