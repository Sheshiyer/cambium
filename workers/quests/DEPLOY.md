# Quest Worker Deployment

## Telegram Signed Gate

The signed Mini App gate is available only when both Cloudflare Worker bindings exist:

- `GATE_BOT_ID`: numeric Telegram bot id used for third-party `initData` validation.
- `GATE_FOUNDER_IDS`: comma-separated Telegram user ids allowed to sign founder actions.

Keep their values out of the repository. `GATE_TG_PUBKEY` is optional; the Worker otherwise uses Telegram's production public key.

Confirm the binding names after deployment without reading their values:

```bash
npx wrangler secret list --config workers/quests/wrangler.jsonc
```

Then run the fail-closed capability probe:

```bash
curl -fsS "$CAMBIUM_QUESTS_BASE_URL/healthz/gate"
```

The probe must return HTTP 200 with `"gateConfigured":true`. HTTP 503 means the Mini App can render but every signed action will be refused before Telegram authentication.

An optional non-mutating auth-boundary probe can verify that the route advances past configuration and fails at missing Telegram authentication:

```bash
curl -sS -H 'content-type: application/json' \
  --data '{"kind":"confirm-action-request","subject":"deploy-probe","initData":""}' \
  "$CAMBIUM_QUESTS_BASE_URL/api/gate/cambium"
```

The expected response is HTTP 401 with `missing initData`. Never put real `initData`, tokens, founder ids, or bot ids in deployment logs or proof artifacts.

## Hermes Native Execution Order

Native execution is fail-closed until D1 owns claims and terminal outcomes. Keep
both Hermes flags false while this Worker release is staged:

```dotenv
HERMES_RUNNER_EXECUTE_DIRECTIVES=false
HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION=false
```

Record the current Worker version and take a private, non-empty export of the
`cambium-bridge` D1 database before applying the additive execution migration.
The restrictive umask must be set before either the export or its SHA receipt
is created:

```bash
umask 077
BACKUP_ROOT="${CAMBIUM_BACKUP_ROOT:-$HOME/.local/state/cambium/d1-backups}"
BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
D1_BACKUP="$BACKUP_ROOT/cambium-bridge-$BACKUP_STAMP.sql"
D1_RECEIPT="$D1_BACKUP.sha256"
install -d -m 700 "$BACKUP_ROOT"
npx --no-install wrangler d1 export cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc \
  --output "$D1_BACKUP"
test -s "$D1_BACKUP"
shasum -a 256 "$D1_BACKUP" > "$D1_RECEIPT"
chmod 600 "$D1_BACKUP" "$D1_RECEIPT"
test -s "$D1_RECEIPT"
```

Keep the export and receipt outside the repository and never paste their
contents into CI, PR, or chat logs. Only after both `test -s` probes pass may
the migration and Worker deploy proceed:

```bash
npx --no-install wrangler d1 migrations apply cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc
npx --no-install wrangler d1 execute cambium-bridge \
  --remote \
  --config workers/quests/wrangler.jsonc \
  --command "SELECT name FROM sqlite_master WHERE name IN ('bridge_executions','bridge_execution_identities','bridge_execution_claims','bridge_execution_events','bridge_execution_claim_history_insert','bridge_execution_claim_history_takeover','bridge_execution_ack_timestamp') ORDER BY name"
npx --no-install wrangler deploy --config workers/quests/wrangler.jsonc
```

The schema probe must return all four tables and all three triggers. With
delivery disabled, use the scoped member credential from the Hermes host to
prove this sequence against a single `native_execution` canary:

```text
poll -> claim -> outcome -> ACK
```

The claim must have a future `leaseExpiresAt`; a second live claimant must get
`busy`; an expired takeover must change the fencing token; the stale outcome
must get HTTP 409; and ACK must get HTTP 409 until a persisted `executed` or
`failed` outcome exists. Confirm the D1 row has `terminal = 1` and a non-null
`acknowledged_at` without selecting attestation JSON or credentials.

Only after that delivery-disabled canary passes may Hermes set
`HERMES_RUNNER_EXECUTE_DIRECTIVES=true`. Leave
`HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION=false`. A Worker-code rollback may
leave migration `0003_bridge_execution_proof.sql` in place because it is
additive; do not drop execution rows during rollback.

## Rollback

Rollback means redeploying the previous known-good release tag from an isolated clean clone. Do not reset, switch, or clean an active worktree, and do not use an untagged local branch as rollback authority. Record the current Worker version before starting.

Before rolling back to any Worker release that predates the native execution
guard, stop the Hermes runner and force both execution flags false on the
Hermes host. This happens before the old Worker code is deployed, so no poller
can ACK through the pre-guard route during the rollback window:

```bash
sudo systemctl stop hermes-runner.timer
sudo systemctl stop hermes-runner.service || true
sudo python3 - <<'PY'
from pathlib import Path

path = Path('/etc/hermes/hermes-runner.env')
updates = {
    'HERMES_RUNNER_EXECUTE_DIRECTIVES': 'false',
    'HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION': 'false',
}
lines = path.read_text(encoding='utf-8').splitlines()
seen = set()
result = []
for line in lines:
    key = line.split('=', 1)[0] if '=' in line else ''
    if key in updates:
        if key not in seen:
            result.append(f'{key}={updates[key]}')
        seen.add(key)
    else:
        result.append(line)
for key, value in updates.items():
    if key not in seen:
        result.append(f'{key}={value}')
path.write_text('\n'.join(result) + '\n', encoding='utf-8')
PY
sudo grep -E '^HERMES_RUNNER_(EXECUTE_DIRECTIVES|LEGACY_ACK_WITHOUT_EXECUTION)=false$' \
  /etc/hermes/hermes-runner.env
```

The grep must print exactly both false settings. Keep the runner stopped and
leave both flags false if the rollback target lacks native outcome-before-ACK
enforcement.

```bash
ROLLBACK_TAG=v0.2.7
ROLLBACK_DIR="$(mktemp -d)/cambium-rollback"
git clone --shared --no-checkout "$(git rev-parse --show-toplevel)" "$ROLLBACK_DIR"
git -C "$ROLLBACK_DIR" checkout --detach "$ROLLBACK_TAG"
cd "$ROLLBACK_DIR"
npx --no-install wrangler deploy --config workers/quests/wrangler.jsonc
```

Keep the isolated clone until verification completes. A Worker rollback changes deployed code only; it does not reverse KV, D1, R2, Vectorize, or secret state. Migration `0003_bridge_execution_proof.sql` is additive and remains in place; do not drop its execution rows during rollback. If another release includes a non-additive data migration, use that release's separately reviewed data rollback before redeploying older code.

Verify the new Worker version printed by Wrangler, then repeat both production probes:

```bash
curl -fsS "$CAMBIUM_QUESTS_BASE_URL/healthz/gate"
curl -sS -H 'content-type: application/json' \
  --data '{"kind":"confirm-action-request","subject":"rollback-probe","initData":""}' \
  -w '\nHTTP_STATUS:%{http_code}\n' \
  "$CAMBIUM_QUESTS_BASE_URL/api/gate/cambium"
```

Rollback is accepted only when health returns HTTP 200 with `"gateConfigured":true`, the auth-boundary probe returns HTTP 401 with `missing initData`, and the served page digest matches the selected rollback tag's `PAGE` export.
