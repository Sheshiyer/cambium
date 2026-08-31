# Cambium Worker deployment — Thoughtseed Labs

This is the production entrypoint for `curious.thoughtseed.space`.
`thoughtseed-labs` with `workers/quests/wrangler.labs.jsonc` is the only
production authority. The `9d9d` profile is a read-only source and rollback
evidence surface; it must never be used for a write or deploy command.

The resource contract is
`docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json`.
This runbook never prints or stores credential values.

## Resolve the production identity

Run from an isolated clean checkout of the exact reviewed commit:

```bash
set -euo pipefail
PROFILE_RECEIPT="$(node scripts/quests-wrangler-profile.mjs \
  --profile labs-production --operation read)"
test "$(printf '%s' "$PROFILE_RECEIPT" | jq -r '.status')" = accepted
test "$(printf '%s' "$PROFILE_RECEIPT" | jq -r '.wranglerProfile')" = thoughtseed-labs
test "$(printf '%s' "$PROFILE_RECEIPT" | jq -r '.config')" = workers/quests/wrangler.labs.jsonc
test "$(printf '%s' "$PROFILE_RECEIPT" | jq -r '.accountId')" = 9d7cec1b5a32b2df8c6cdc1321ccd00b
npx --no-install wrangler whoami --profile thoughtseed-labs
```

Stop if the displayed account does not match the receipt. A configured profile
or successful `whoami` does not authorize mutation.

## Read-only production inventory

```bash
node scripts/quests-wrangler-profile.mjs \
  --profile labs-production --operation read
npx --no-install wrangler deployments status \
  --name cambium-quests \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs
npx --no-install wrangler d1 info cambium-bridge \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs
npx --no-install wrangler r2 bucket info thoughtseed-vault \
  --profile thoughtseed-labs
npx --no-install wrangler vectorize get cambium-cortex \
  --profile thoughtseed-labs
```

Record the current deployment version and binding readback. Do not treat HTTP
health, a deployment percentage, or bucket totals as end-to-end migration
proof.

## Deterministic preflight

```bash
npm run verify:release
git diff --check
node scripts/quests-wrangler-profile.mjs \
  --profile labs-production --operation deploy
OUTDIR="$(mktemp -d)"
npx --no-install wrangler versions upload \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs \
  --dry-run --outdir "$OUTDIR"
test -n "$(find "$OUTDIR" -type f -print -quit)"
```

The temporary bundle may be removed after its contents and digest are recorded.
The dry run creates no Worker version.

## Explicit promotion gate

Uploading a version, changing secrets, applying D1 migrations, and assigning
traffic are separate operations. Each requires an exact reviewed commit,
current deployment readback, rollback version, operator approval, and a
post-action receipt.

```bash
node scripts/quests-wrangler-profile.mjs \
  --profile labs-production --operation deploy
npx --no-install wrangler versions upload \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs
```

Do not run that upload merely because the preflight passed. After an approved
upload, inspect its version and bindings before a separately approved traffic
assignment:

```bash
npx --no-install wrangler versions view "${REVIEWED_VERSION_ID:?}" \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs
npx --no-install wrangler versions deploy "${REVIEWED_VERSION_ID:?}@100%" \
  --name cambium-quests \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs \
  --message "${REVIEWED_RELEASE_MESSAGE:?}" --yes
```

## Labs rollback

Rollback changes Labs Worker traffic to a previously recorded Labs version. It
does not deploy the legacy `9d9d` Worker and does not reverse D1, KV, R2,
Vectorize, Access, or tunnel state.

```bash
node scripts/quests-wrangler-profile.mjs \
  --profile labs-production --operation deploy
npx --no-install wrangler versions deploy "${PREVIOUS_LABS_VERSION_ID:?}@100%" \
  --name cambium-quests \
  --config workers/quests/wrangler.labs.jsonc \
  --profile thoughtseed-labs \
  --message "${REVIEWED_ROLLBACK_MESSAGE:?}" --yes
```

Verify the deployment receipt, authenticated application behavior, service
identity boundary, `/healthz/gate`, and the expected HTTP 401 denial for a
missing Telegram `initData` action.

## Read-only 9d9d inventory

```bash
node scripts/quests-wrangler-profile.mjs \
  --profile legacy-source --operation read
npx --no-install wrangler whoami --profile 9d9d
npx --no-install wrangler deployments status \
  --name cambium-quests \
  --config workers/quests/wrangler.jsonc \
  --profile 9d9d
npx --no-install wrangler r2 bucket info thoughtseed-vault \
  --profile 9d9d
```

Stop unless the resolver and `whoami` both identify account
`9d9d23b27f32e70ae3afb6a1aa2c0f10`. The legacy resolver rejects `write`
and `deploy`. Source object work is
limited to the two approved prefixes and requires authenticated keys, digests,
classification, and a founder-reviewed per-key allowlist. There is no bulk
copy command in this runbook.

## Retirement gate

Do not delete or mute the legacy Worker, Access applications, tunnel, D1, KV,
R2, or Vectorize index until all gates in the resource map pass and a separate
founder-approved rollback window authorizes exact destructive targets.
