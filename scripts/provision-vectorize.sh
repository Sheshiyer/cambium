#!/usr/bin/env bash
# Provision the Cambium cortex on Cloudflare Vectorize (M2 / B3, issue #17).
#
# Requires a FULL-SCOPE token in your env (NEVER commit it; never paste it into chat):
#   export CLOUDFLARE_API_TOKEN=...                                  # the token with Vectorize R/W
#   export CLOUDFLARE_ACCOUNT_ID=9d9d23b27f32e70ae3afb6a1aa2c0f10
# Then:
#   bash scripts/provision-vectorize.sh
#
# After this, `node bin/operator/cli.ts demo` auto-selects Vectorize (the env vars are present);
# unset them to fall back to the local node:sqlite store.
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN (full-scope, Vectorize R/W) in your env first}"
INDEX="${CORTEX_INDEX:-cambium-cortex}"

echo "→ Creating Vectorize index '$INDEX' (1024-d, cosine — matches NIM nv-embedqa-e5-v5)…"
wrangler vectorize create "$INDEX" --dimensions=1024 --metric=cosine || echo "  (already exists?)"

echo "→ Creating filterable metadata indexes (tenant, kind) for per-venture isolation…"
wrangler vectorize create-metadata-index "$INDEX" --property-name=tenant --type=string || echo "  (already exists?)"
wrangler vectorize create-metadata-index "$INDEX" --property-name=kind   --type=string || echo "  (already exists?)"

echo "→ Index info:"
wrangler vectorize info "$INDEX" || true

echo
echo "✓ Done. The operator will use Vectorize while CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID are set."
echo "  Smoke test:  NVIDIA_API_KEY=... node bin/operator/cli.ts demo   (writes + recalls via Vectorize)"
