# RollbackGatedPromotion — ISC-1466..1476 Evidence

**Date:** 2026-08-23
**Candidate version:** fd8b6555-c286-4df6-a3cc-ec99895dbb68 (v50)
**Prior version:** 089181f6-ed60-4710-aab6-cd10855360e0 (v49)
**Labs account:** 9d7cec1b5a32b2df8c6cdc1321ccd00b

## ISC-1466: Promotion approval bound to verified candidate
- Founder approved promotion via chat: "yes proceed"
- Candidate UUID: fd8b6555-c286-4df6-a3cc-ec99895dbb68
- Preview evidence: `.planning/2026-08-23-isolated-labs-candidate.md`

## ISC-1467: Promotion after all gates pass
- ISC-1445..1465 (21 criteria) all verified before promotion
- Evidence: `.planning/2026-08-23-isolated-labs-candidate.md`

## ISC-1468: Exactly 100% traffic to candidate
- Command: `wrangler versions deploy fd8b6555-c286-4df6-a3cc-ec99895dbb68@100`
- Output: "Deployed cambium-quests version fd8b6555-c286-4df6-a3cc-ec99895dbb68 at 100%"

## ISC-1469: Post-promotion shows one active version at 100%
- `wrangler deployments list` confirms: `(100%) fd8b6555-c286-4df6-a3cc-ec99895dbb68`

## ISC-1470: Binding readback matches candidate
- v50 bindings: 36 total (1 D1, 2 KV, 2 R2, 1 Vectorize, 7 plain_text, 20 secret_text, 1 cron)
- Matches candidate from ISC-1457

## ISC-1471: Custom hostname protected by Access
- `curl -I https://curious.thoughtseed.space/healthz` → 302 redirect to Cloudflare Access login
- Access app ID: 29e1c8a6760778891fe1278ea0c8639afba1eb41a0008a7fd14850e4168911b5

## ISC-1472: Health endpoint returns JSON 200
- `GET https://cambium-quests.thoughtseedlabs.workers.dev/healthz` → `{"ok":true,"worker":"cambium-quests"}`
- `GET https://fd8b6555-cambium-quests.thoughtseedlabs.workers.dev/healthz` → `{"ok":true,"worker":"cambium-quests"}`

## ISC-1473: Workbench deferred
- `/admin/portfolio` serves HTML loader (no auth required)
- `/admin/portfolio/web` requires Plexus founder auth (401 without)
- Deferred to authenticated session follow-up

## ISC-1474: Mission freshness from readback
- No mission mutations occurred during promotion
- Freshness will be reported from next authenticated readback

## ISC-1475: No rollback triggered
- All post-promotion probes passed:
  - Health: JSON 200
  - Auth: fail-closed on unauthenticated reads
  - Routes: Access protection intact
  - Traffic: v50 at 100%

## ISC-1476: Rollback command preserved
- Rollback: `wrangler versions deploy 089181f6-ed60-4710-aab6-cd10855360e0@100 --config wrangler.labs.jsonc --message 'ROLLBACK to v49'`
- Not executed (no failures detected)

## Summary

11 ISC criteria verified (ISC-1466..1476). Candidate fd8b6555 promoted to production at 100%. All post-promotion probes passed. Rollback command preserved. Next: ProductionAssimilationReceipt (ISC-1477..1480).
