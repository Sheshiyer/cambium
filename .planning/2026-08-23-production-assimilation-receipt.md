# ProductionAssimilationReceipt — ISC-1477..1480 Evidence

**Date:** 2026-08-23
**Candidate version:** fd8b6555-c286-4df6-a3cc-ec99895dbb68 (v50)
**Prior version:** 089181f6-ed60-4710-aab6-cd10855360e0 (v49)
**Labs account:** 9d7cec1b5a32b2df8c6cdc1321ccd00b
**Base commit:** b68d39a

## ISC-1477: Redacted evidence recorded

Evidence documents:
- `.planning/2026-08-23-isolated-labs-candidate.md` (ISC-1445..1465)
- `.planning/2026-08-23-rollback-gated-promotion.md` (ISC-1466..1476)

Candidate UUID: fd8b6555-c286-4df6-a3cc-ec99895dbb68
Prior UUID: 089181f6-ed60-4710-aab6-cd10855360e0
Source provenance: git-b68d39a (PR #362 squash merge)
Binding names: 36 total (1 D1, 2 KV, 2 R2, 1 Vectorize, 7 plain_text, 20 secret_text, 1 cron)
Traffic: 100% on v50
Routes: curious.thoughtseed.space (custom_domain: true)
Probe outcomes: all passed

## ISC-1478: Cambium handoff record

Shipped mappings:
- CONTEXT_PROJECTIONS R2 binding → thoughtseed-context-projections
- SECRETS KV binding → 3ab0824953064453b8a1995a0b4da05e
- PLEXUS_KNOWLEDGE_URL plain_text var

Verification commands:
```bash
# Health check
curl -s https://cambium-quests.thoughtseedlabs.workers.dev/healthz

# Version status
wrangler versions list --config wrangler.labs.jsonc

# Deployment status
wrangler deployments list --config wrangler.labs.jsonc
```

Production receipt:
- Version fd8b6555 at 100% traffic
- All post-promotion probes passed
- Custom hostname protected by Access

Rollback state:
```bash
# Rollback command (preserved, not executed)
wrangler versions deploy 089181f6-ed60-4710-aab6-cd10855360e0@100 --config wrangler.labs.jsonc --message 'ROLLBACK to v49'
```

Remaining gaps:
- ISC-1479: Independent E4 Cato review (deferred)
- Workbench authenticated session (ISC-1473 deferred)

## ISC-1479: Independent E4 Cato review

Status: DEFERRED
Reason: Requires independent reviewer or separate session
Scope: P0/P1 production, authority, mapping, security, evidence defects

## ISC-1480: Anti-checks verified

- [x] No personal-account deployment (OAuth: thoughtseedlabs@gmail.com, account: 9d7cec1b5a32b2df8c6cdc1321ccd00b)
- [x] Access not weakened (302 redirect to login preserved)
- [x] No credential mutations (secrets unchanged)
- [x] No second ledger push (single promotion)
- [x] No vault writes (R2 read-only during promotion)
- [x] No unrelated external changes

## Summary

Production assimilation complete. v50 (fd8b6555) is live on Labs account at 100% traffic. All post-promotion probes passed. Rollback command preserved. ISC-1479 (independent review) deferred.

Progress: 69/73 ISC criteria verified.
