#!/usr/bin/env bash
# refresh-quests.sh — scheduled re-derive + push of the quest ledger(s) so the
# curios.self miniapp story stays LIVE: each push re-pulls Paperclip agent activity,
# Hermes service health, and current tenant world/deviation state,
# then stores a fresh envelope in KV. The miniapp shows the derivedAt freshness.
#
# Runs on the founder Mac via launchd (ai.hermes.cambium-quests-refresh, 5-min cycle).
# Secrets are sourced from the founder's existing .env files — never embedded here:
#   ~/.claude/.env                 → QUESTS_PUSH_TOKEN (push to the serving Worker)
#   thoughtseed-paperclip/.env     → PAPERCLIP_* / local org runtime settings
# The push verb also reads ~/.claude/.env in-process; sourcing here keeps the local
# Paperclip lane aligned with the scheduled refresh job.

set -euo pipefail

CAMBIUM_ROOT="${CAMBIUM_ROOT:-$(pwd)}"
CAMBIUM_TENANTS="${CAMBIUM_TENANTS:-demo-org}"
CAMBIUM_LOG="${CAMBIUM_LOG:-/tmp/cambium-quests-refresh.log}"

cd "$CAMBIUM" || exit 1
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

tenants="$(
  node --input-type=module - <<'NODE'
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const valid = (id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);

try {
  const registry = JSON.parse(readFileSync(join('.operator', 'tenants.json'), 'utf8'));
  const ids = [...new Set(registry.map((t) => String(t.id ?? '')).filter(valid))];
  if (ids.length) {
    console.log(ids.join('\n'));
    process.exit(0);
  }
} catch {}

try {
  const ids = readdirSync('.operator')
    .map((f) => f.match(/^(.+)\.world\.json$/)?.[1])
    .filter((id) => id && !id.startsWith('_') && valid(id));
  console.log([...new Set(ids)].join('\n'));
} catch {
  console.log('cambium');
}
NODE
)"

while IFS= read -r tenant; do
  [ -n "$tenant" ] || continue
  # each tenant independent — one failing must not block the other
  promo="$(node bin/quine/quine.ts write skills apply-promotions --tenant "$tenant" 2>&1)"
  promo_status="$(printf '%s' "$promo" | grep -oE '"checked": *[0-9]+|"applied": *[0-9]+|"rejected": *[0-9]+|"consumed": *[0-9]+|"error": *"[^"]*"' | tr '\n' ' ')"
  echo "[$ts] $tenant promotions: ${promo_status:-$(printf '%s' "$promo" | tail -1)}" >> "$LOG"
  sideq="$(node bin/quine/quine.ts write quests apply-side-quests --tenant "$tenant" 2>&1)"
  sideq_status="$(printf '%s' "$sideq" | grep -oE '"checked": *[0-9]+|"queued": *[0-9]+|"rejected": *[0-9]+|"alreadyQueued": *[0-9]+|"consumed": *[0-9]+|"error": *"[^"]*"' | tr '\n' ' ')"
  echo "[$ts] $tenant side-quests: ${sideq_status:-$(printf '%s' "$sideq" | tail -1)}" >> "$LOG"
  priority="$(node bin/quine/quine.ts write quests priority-signals --tenant "$tenant" 2>&1)"
  priority_status="$(printf '%s' "$priority" | grep -oE '"status": *"[^"]*"|"signalFile": *"[^"]*"|"missing": *\[[^]]*\]' | tr '\n' ' ')"
  echo "[$ts] $tenant priority-signals: ${priority_status:-$(printf '%s' "$priority" | tail -1)}" >> "$LOG"
  out="$(node bin/quine/quine.ts write quests push --tenant "$tenant" 2>&1)"
  status="$(printf '%s' "$out" | grep -oE '"pushed": *(true|false)|"completed": *"[^"]*"|"derivedAt": *"[^"]*"' | tr '\n' ' ')"
  echo "[$ts] $tenant: ${status:-$(printf '%s' "$out" | tail -1)}" >> "$LOG"
done <<< "$tenants"
