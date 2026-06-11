#!/usr/bin/env bash
# refresh-quests.sh — scheduled re-derive + push of the quest ledger(s) so the
# curios.self miniapp story stays LIVE: each push re-pulls MultiCA agent activity,
# the TeamForge agent-feed (forge lane), and current cambium world/deviation state,
# then stores a fresh envelope in KV. The miniapp shows the derivedAt freshness.
#
# Runs on the founder Mac via launchd (ai.hermes.cambium-quests-refresh, 5-min cycle).
# Secrets are sourced from the founder's existing .env files — never embedded here:
#   ~/.claude/.env                 → QUESTS_PUSH_TOKEN (push to the serving Worker)
#   thoughtseed-paperclip/.env     → TF_WEBHOOK_HMAC_SECRET (+ CF_ACCESS_* if set) for the forge lane
# The push verb also reads ~/.claude/.env in-process; sourcing here makes the forge
# lane's token available to the teamforge hypha too.

CAMBIUM="/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium"
PAPERCLIP_ENV="/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-paperclip/.env"
LOG="/tmp/cambium-quests-refresh.log"

[ -f "$HOME/.claude/.env" ] && { set -a; . "$HOME/.claude/.env" 2>/dev/null; set +a; }
[ -f "$PAPERCLIP_ENV" ] && { set -a; . "$PAPERCLIP_ENV" 2>/dev/null; set +a; }

cd "$CAMBIUM" || exit 1
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
for tenant in cambium mathis; do
  # each tenant independent — one failing must not block the other
  out="$(node bin/quine/quine.ts write quests push --tenant "$tenant" 2>&1)"
  status="$(printf '%s' "$out" | grep -oE '"pushed": *(true|false)|"completed": *"[^"]*"|"derivedAt": *"[^"]*"' | tr '\n' ' ')"
  echo "[$ts] $tenant: ${status:-$(printf '%s' "$out" | tail -1)}" >> "$LOG"
done
