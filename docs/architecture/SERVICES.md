# Services Inventory

> Source-backed architecture inventory refreshed 2026-07-22. The release hook scans the root package only;
> the nested Worker and R3F manifests are listed explicitly so the inventory does not hide runtime bindings.

## Maintained runtime surfaces

| Surface | Source/config | Resources or boundary | Status |
|---|---|---|---|
| Cambium Quests Worker | [`workers/quests/src/index.ts`](../../workers/quests/src/index.ts) · [`wrangler.jsonc`](../../workers/quests/wrangler.jsonc) | Cloudflare Worker; GitHub-backed routine knowledge from `Sheshiyer/thoughtseed-labs`, Vectorize `CAMBIUM_CORTEX`; D1 `cambium-bridge` and R2 `THOUGHTSEED_VAULT` remain non-knowledge operational stores | implemented; deployment remains separately governed |
| R3F visual engine | [`apps/cambium-r3f/package.json`](../../apps/cambium-r3f/package.json) | Vite + React + React Three Fiber desktop visual surface; shared generated source contract | published in v0.3.0; desktop QA boundary |
| Electron desktop shell | [`apps/cambium-r3f/desktop/main.cjs`](../../apps/cambium-r3f/desktop/main.cjs) · [`apps/cambium-r3f/package.json`](../../apps/cambium-r3f/package.json) | Secure `cambium://` local protocol, sandboxed BrowserWindow, narrow preload, macOS DMG/ZIP configuration | implemented on current `main`; signing/notarization separately governed |
| Composition/operator CLI | [`package.json`](../../package.json) · [`bin/compose.mjs`](../../bin/compose.mjs) · [`bin/operator/`](../../bin/operator/) | local zero-dependency plan/validate/run boundary and tenant-scoped operator loop | active |

## External and provider boundaries

| Boundary | Source/config | Authority and safety |
|---|---|---|
| NVIDIA context embeddings | Worker context bindings and `NVIDIA_API_KEY` | optional/provider-bound; tests use injected doubles and local fallbacks |
| GitHub knowledge source | [`github-backed-knowledge-plane.md`](./github-backed-knowledge-plane.md) | Plexus Worker mints repository-scoped GitHub-App reads for exact allowlisted paths; Cambium holds no GitHub credential |
| Plexus identity and knowledge gateway | Worker `PLEXUS_WHOAMI_URL` · `PLEXUS_KNOWLEDGE_URL` | D1 retains authorization/repository authority; Worker brokers bounded GitHub-App reads, never stores or infers knowledge |
| Explee IVerif observer | [`docs/adapters/iverif-explee.md`](../adapters/iverif-explee.md) | fixed campaign, GET-only, redacted, `sendEligible=false` |
| Marketing Create NVIDIA renderer | [`docs/architecture/marketing-create-worker-renderer.md`](./marketing-create-worker-renderer.md) | registered disabled, review-only draft output, not deployed |
| GitHub and Cloudflare CI | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) · [`.github/workflows/desktop.yml`](../../.github/workflows/desktop.yml) | deterministic release verification plus separate macOS packaging artifact and transient live-readiness evidence |

## Files and manifests reviewed

- `package.json`
- `.github/workflows/ci.yml`
- `apps/cambium-r3f/package.json`
- `apps/cambium-r3f/desktop/main.cjs`
- `apps/cambium-r3f/desktop/preload.cjs`
- `workers/quests/wrangler.jsonc`
- `workers/quests/src/index.ts`
- `composition/lead-adapters.v1.json`
- `docs/adapters/iverif-explee.md`
- `docs/architecture/marketing-create-worker-renderer.md`
