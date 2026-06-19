#!/usr/bin/env bash
# refresh-quests.sh — scheduled re-derive + push of quest ledgers for one or more
# Cambium tenants. This script is intentionally product-neutral: callers provide
# repo location, tenants, and optional env files instead of relying on a founder
# machine or a specific company deployment.
#
# Environment:
#   CAMBIUM_ROOT       repo path; defaults to the current working directory
#   CAMBIUM_TENANTS    space-delimited tenant ids; defaults to "demo-org"
#   CAMBIUM_ENV_FILES  optional space-delimited env files to source
#   CAMBIUM_LOG        optional log path; defaults to /tmp/cambium-quests-refresh.log
#
# Required by the push verb when targeting a deployed Worker:
#   QUESTS_PUSH_TOKEN
#   QUESTS_PUSH_URL

set -euo pipefail

CAMBIUM_ROOT="${CAMBIUM_ROOT:-$(pwd)}"
CAMBIUM_TENANTS="${CAMBIUM_TENANTS:-demo-org}"
CAMBIUM_LOG="${CAMBIUM_LOG:-/tmp/cambium-quests-refresh.log}"

for env_file in ${CAMBIUM_ENV_FILES:-}; do
  [ -f "$env_file" ] && { set -a; . "$env_file" 2>/dev/null; set +a; }
done

cd "$CAMBIUM_ROOT"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
for tenant in $CAMBIUM_TENANTS; do
  out="$(node bin/quine/quine.ts write quests push --tenant "$tenant" 2>&1 || true)"
  status="$(printf '%s' "$out" | grep -oE '"pushed": *(true|false)|"completed": *"[^"]*"|"derivedAt": *"[^"]*"' | tr '\n' ' ')"
  echo "[$ts] $tenant: ${status:-$(printf '%s' "$out" | tail -1)}" >> "$CAMBIUM_LOG"
done
