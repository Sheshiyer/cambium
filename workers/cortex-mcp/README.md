# Cortex MCP production connections

| Surface | Endpoint | Owner and authentication |
|---|---|---|
| Founder and approved OAuth clients | `https://cortex.thoughtseed.space/mcp` | `cortex-mcp` in Thoughtseed Labs. Discover the issuer from the protected-resource metadata. |
| Hosted Hermes default profile | `https://cortex.thoughtseed.space/v1/mcp` | `cortex-mcp` with the existing Hermes bearer credential. Preserve this route while the installed profile uses it. |
| OAuth issuer | `https://forge.thoughtseed.space` | Labs `teamforge-api`. Authorization and consent use Cloudflare Access. Forge issues `cortex:read` via authorization code with S256 PKCE. |
| Cambium browser and native session surface | `https://curious.thoughtseed.space` | Labs `cambium-quests`. Quests also supplies Cortex's private provenance and Gate service bindings. |
| Cortex project lookup | `https://curious.thoughtseed.space/v1/portfolio` | Public read-only Workbench map from Labs `cambium-quests`. Pass the exact `workId`. |

Resolve the project before running scoped Cortex research. The Workbench returns
the WorkObject ID, display name, and classification. For Relovo, use
[`branch:relovo`](https://curious.thoughtseed.space/v1/portfolio?workId=branch%3Arelovo).
Cortex tool calls still use the verified MCP resource and its issued scopes.

Verify the current issuer and scopes through OAuth discovery. Cortex advertises
`cambium:act` for its Gate tools. Forge issues `cortex:read` only.
[Cortex resource metadata](https://cortex.thoughtseed.space/.well-known/oauth-protected-resource/mcp) · [Forge issuer metadata](https://forge.thoughtseed.space/.well-known/oauth-authorization-server)

The bounded J1 verification uses the registered public client `cambium-cortex-j1`.
Forge registers `http://127.0.0.1:18888/callback` for the existing verifier and
`http://127.0.0.1:18888/callback/P9PXuRuq2UXG` for native Codex. Each verification
requires a fresh founder consent request and an active listener on the browser's
machine.
Open the local start page supplied by the running listener, then continue to
Forge. The callback is where Forge sends the browser after consent. If the
browser reports a connection error at `127.0.0.1`, check that the listener
is running on the same machine and restart from its start page.
The completed November 4 verification revoked its token and closed its listener.
Workspace plugin installation and acceptance have their own gates. [Live gates](../../openai/cambium-infinite-game/live-gates/README.md)

The `workers.dev` hostname is useful for health checks. Use the exact custom
domain resource for OAuth. Before a release, reconcile the reviewed source and
configuration with the active Labs version and its bindings through the existing
release owner. A public MCP readiness check exercises discovery and tool listing.
Use the reviewed server version as its input.

```sh
node scripts/probe-openai-mcp-readiness.mjs --expected-server-version 1.7.0
```

Run the command from the repository root. `1.7.0` was the serving MCP version
on 18 November 2026. Client sign-in and source reads require separate evidence.
