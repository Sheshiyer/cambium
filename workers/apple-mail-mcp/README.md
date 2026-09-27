# Apple Mail MCP gateway (Labs)

Cloudflare Worker in front of the founder Mac mini Apple Mail MCP.

```
Hermes --Bearer--> mail-mcp.thoughtseed.space/mcp
                 Worker (auth + read-only tool allowlist)
                 --X-Thoughtseed-Origin--> mail-mcp-origin.thoughtseed.space
                 Cloudflare Tunnel --> 127.0.0.1:20141 origin-gate
                 --> 127.0.0.1:20140 mcp-proxy --> apple-mail-mcp --> Mail.app
```

- Profile: `thoughtseed-labs` (`account_id` `9d7cec1b5a32b2df8c6cdc1321ccd00b`)
- Unset `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `CF_*` before Wrangler
- Secrets: `MCP_BEARER`, `ORIGIN_SECRET` (`wrangler secret put`, never vault)
- Not Phloem, not `cambium-quests`, and not the deployed Cambium Worker origin

```bash
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_KEY CLOUDFLARE_EMAIL CF_API_TOKEN CF_ACCOUNT_ID
node --test --experimental-strip-types src/*.test.ts
npx wrangler deploy --profile thoughtseed-labs --config wrangler.labs.jsonc
```
