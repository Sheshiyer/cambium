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
