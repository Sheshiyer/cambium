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

## Rollback

Rollback means redeploying the previous known-good release tag from an isolated clean clone. Do not reset, switch, or clean an active worktree, and do not use an untagged local branch as rollback authority. Record the current Worker version before starting.

```bash
ROLLBACK_TAG=v0.2.7
ROLLBACK_DIR="$(mktemp -d)/cambium-rollback"
git clone --shared --no-checkout "$(git rev-parse --show-toplevel)" "$ROLLBACK_DIR"
git -C "$ROLLBACK_DIR" checkout --detach "$ROLLBACK_TAG"
cd "$ROLLBACK_DIR"
npx --no-install wrangler deploy --config workers/quests/wrangler.jsonc
```

Keep the isolated clone until verification completes. A Worker rollback changes deployed code only; it does not reverse KV, D1, R2, Vectorize, or secret state. If a release includes a data migration, use that release's separately reviewed data rollback before redeploying older code.

Verify the new Worker version printed by Wrangler, then repeat both production probes:

```bash
curl -fsS "$CAMBIUM_QUESTS_BASE_URL/healthz/gate"
curl -sS -H 'content-type: application/json' \
  --data '{"kind":"confirm-action-request","subject":"rollback-probe","initData":""}' \
  -w '\nHTTP_STATUS:%{http_code}\n' \
  "$CAMBIUM_QUESTS_BASE_URL/api/gate/cambium"
```

Rollback is accepted only when health returns HTTP 200 with `"gateConfigured":true`, the auth-boundary probe returns HTTP 401 with `missing initData`, and the served page digest matches the selected rollback tag's `PAGE` export.
