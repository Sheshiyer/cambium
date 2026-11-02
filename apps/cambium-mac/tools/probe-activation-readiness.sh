#!/bin/sh
# Emit a bounded, read-only activation packet for the Cambium Native surface.
#
# The packet joins local source proof to current live readback without turning
# either one into the other. It never sends credentials, follows redirects,
# writes Cloudflare/D1/TeamForge state, merges a PR, or registers a client.
# Wrangler is intentionally opt-in because even a dry-run can contact the
# Cloudflare control plane; set CAMBIUM_RUN_WRANGLER_DRY_RUN=1 when that proof
# is wanted in an owner environment.
set -eu

repo_root=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$repo_root"

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/cambium-activation-readiness.XXXXXX")
trap 'rm -rf -- "$tmp_dir"' EXIT HUP INT TERM

observed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
source_head=$(git rev-parse HEAD)
dirty_count=$(git status --porcelain --untracked-files=all -- \
  apps/cambium-mac workers/quests shared/portfolio-catalog-authority.ts \
  shared/portfolio-catalog-display-proposal.ts workers/quests/src/portfolio-catalog-data.ts \
  workers/quests/src/portfolio-catalog.ts | wc -l | tr -d ' ')

./apps/cambium-mac/tools/probe-live-owner.sh > "$tmp_dir/live.json"
./apps/cambium-mac/tools/probe-current-portfolio.sh > "$tmp_dir/current.log"
portfolio_json=$(tail -n 1 "$tmp_dir/current.log")
printf '%s\n' "$portfolio_json" | jq -e 'type == "object" and (.catalogDigest|type == "string")' >/dev/null

migration_0100=$(shasum -a 256 workers/quests/migrations/0100_native_sessions.sql | awk '{print $1}')
migration_0101=$(shasum -a 256 workers/quests/migrations/0101_native_consent.sql | awk '{print $1}')

if [ "${CAMBIUM_RUN_WRANGLER_DRY_RUN:-0}" = "1" ]; then
  wrangler_log="$tmp_dir/wrangler.log"
  if npx --no-install wrangler versions upload --dry-run --profile thoughtseed-labs \
      --config workers/quests/wrangler.labs.jsonc >"$wrangler_log" 2>&1; then
    wrangler_status=pass
  else
    wrangler_status=fail
  fi
  wrangler_tail=$(tail -n 12 "$wrangler_log" | tr '\n' ' ' | sed 's/[[:space:]][[:space:]]*/ /g')
else
  wrangler_status=not_run
  wrangler_tail='set CAMBIUM_RUN_WRANGLER_DRY_RUN=1 to collect candidate binding proof'
fi

binding_status=not_run
deployment_json='{}'
remote_migration_names='[]'
remote_secret_count=0
native_identity_secret_present=false
if [ "${CAMBIUM_RUN_LIVE_BINDING_READBACK:-0}" = "1" ]; then
  if npx --no-install wrangler deployments status --name cambium-quests --json \
      --profile thoughtseed-labs --config workers/quests/wrangler.labs.jsonc \
      > "$tmp_dir/deployment.json" 2>/dev/null \
      && jq -e 'type == "object" and (.versions|type == "array")' "$tmp_dir/deployment.json" >/dev/null; then
    deployment_json=$(cat "$tmp_dir/deployment.json")
  fi

  if npx --no-install wrangler d1 migrations list cambium-bridge --remote \
      --profile thoughtseed-labs --config workers/quests/wrangler.labs.jsonc \
      > "$tmp_dir/migrations.log" 2>/dev/null; then
    remote_migration_names=$(grep -Eo '[0-9]{4}_[a-z0-9_]+\.sql' "$tmp_dir/migrations.log" \
      | sort -u | jq -Rsc 'split("\n") | map(select(length > 0))')
  fi

  if npx --no-install wrangler secret list --name cambium-quests --format json \
      --profile thoughtseed-labs --config workers/quests/wrangler.labs.jsonc \
      > "$tmp_dir/secrets.json" 2>/dev/null \
      && jq -e 'type == "array"' "$tmp_dir/secrets.json" >/dev/null; then
    remote_secret_count=$(jq 'length' "$tmp_dir/secrets.json")
    native_identity_secret_present=$(jq 'any(.[]; .name == "PLEXUS_NATIVE_IDENTITY_TOKEN")' "$tmp_dir/secrets.json")
  fi
  binding_status=read
fi

if command -v gh >/dev/null 2>&1 && gh pr view 105 --repo Sheshiyer/team-forge-ts \
    --json state,isDraft,mergeable,reviewDecision,updatedAt,url,headRefName,baseRefName \
    > "$tmp_dir/pr.json" 2>/dev/null; then
  pr_status=read
else
  pr_status=unavailable
  printf '%s\n' '{}' > "$tmp_dir/pr.json"
fi

jq -n \
  --arg observedAt "$observed_at" \
  --arg sourceHead "$source_head" \
  --arg dirtyCount "$dirty_count" \
  --arg migration0100 "$migration_0100" \
  --arg migration0101 "$migration_0101" \
  --arg wranglerStatus "$wrangler_status" \
  --arg wranglerTail "$wrangler_tail" \
  --arg bindingStatus "$binding_status" \
  --arg remoteSecretCount "$remote_secret_count" \
  --argjson nativeIdentitySecretPresent "$native_identity_secret_present" \
  --argjson remoteMigrationNames "$remote_migration_names" \
  --argjson deployment "$deployment_json" \
  --arg prStatus "$pr_status" \
  --slurpfile live "$tmp_dir/live.json" \
  --argjson portfolio "$portfolio_json" \
  --slurpfile pr "$tmp_dir/pr.json" \
  '{
    schema: "cambium.native-activation-readiness.v1",
    observedAt: $observedAt,
    readOnly: true,
    source: {
      head: $sourceHead,
      dirtyScopedFiles: ($dirtyCount|tonumber),
      currentPortfolio: $portfolio
    },
    migrations: [
      {path: "workers/quests/migrations/0100_native_sessions.sql", sha256: $migration0100},
      {path: "workers/quests/migrations/0101_native_consent.sql", sha256: $migration0101}
    ],
    candidate: {
      wranglerDryRun: {
        status: $wranglerStatus,
        summary: $wranglerTail
      }
    },
    runtimeReadback: {
      status: $bindingStatus,
      deployment: $deployment,
      unappliedMigrations: $remoteMigrationNames,
      remoteSecretCount: ($remoteSecretCount|tonumber),
      dedicatedNativeIdentitySecretPresent: $nativeIdentitySecretPresent
    },
    teamforgePullRequest: {
      readback: $prStatus,
      details: ($pr[0] // {})
    },
    live: $live[0],
    gates: [
      {id: "source-mapper", status: "ready", reason: "current TypeScript handler envelope decoded by Swift"},
      {id: "atomic-founder-authority", status: "ready", reason: "production Worker composition uses one owner snapshot"},
      {id: "native-session-route", status: "blocked", reason: "live readback must expose the native session route"},
      {id: "teamforge-identity-route", status: "blocked", reason: "live owner lookup must be deployed and secret-bound"},
      {id: "d1-migrations", status: "owner-review", reason: "local migration hashes are recorded; live apply/readback is separate"},
      {id: "founder-acceptance", status: "owner-review", reason: "real browser consent, exact catalog, decision and admitted launch remain unproved"}
    ]
  }'
