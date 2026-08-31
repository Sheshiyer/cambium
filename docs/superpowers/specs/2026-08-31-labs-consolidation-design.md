# Thoughtseed Labs Consolidation Design

**Status:** Approved for repository implementation on 2026-08-31

## Purpose

Make the Thoughtseed Labs Cloudflare account the only production authority for
`curious.thoughtseed.space`, preserve the personal `9d9d` account as a
read-only rollback source, and define the finite evidence gates that must pass
before any source object transfer or retirement.

## Authority model

| Plane | Authority | Permitted behavior |
| --- | --- | --- |
| Production edge | `thoughtseed-labs` + `wrangler.labs.jsonc` | Read, write, deploy after an explicit gate |
| Legacy source | `9d9d` + `wrangler.jsonc` | Read-only inventory and rollback evidence |
| Operational state | Labs D1 Goal Graph | Sole task, lease, gate, outcome, and receipt writer |
| Telegram transport | Hermes EC2 | Intake and receipt delivery; never task authority |
| Evidence storage | Labs R2 | Durable evidence and reviewed object copies |
| Semantic projection | Labs Vectorize | Derived index rebuilt from provenance-bearing inputs |
| Repository planning | ISA + GSD | Acceptance and finite implementation sequencing |

Cloudflare account resources are recreated rather than moved in place. Stable
logical binding names may match across accounts, while account-scoped IDs must
remain explicit and different.

## Repository components

### Profile resolver

`scripts/quests-wrangler-profile.mjs` exposes:

```js
resolveQuestsWranglerProfile({
  profile: 'labs-production' | 'legacy-source',
  operation: 'read' | 'write' | 'deploy',
})
```

The resolver parses the checked-in JSONC files, validates the complete
Worker/D1/KV/R2/Vectorize/route identity, and emits a bounded receipt. The Labs
profile permits all three operations. The legacy profile permits only
`read`; `write` and `deploy` fail before a Wrangler command can be
constructed.

### Resource map

`docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json`
records stable profile, account, Worker, route, Access team, D1, KV, R2, and
Vectorize mappings. It records strategy and authority, not secret values or
mutable bucket counts.

### Deployment runbook

`workers/quests/DEPLOY-LABS.md` becomes the concise production entrypoint.
Every production command names both `--config
workers/quests/wrangler.labs.jsonc` and `--profile thoughtseed-labs`.
`workers/quests/DEPLOY.md` retains historical detail but opens with a
fail-closed authority notice and points operators to the Labs runbook.

### GSD milestone

Milestone v0.5 is **Thoughtseed Labs Consolidation and Governed 9d9d
Retirement**:

1. Phase 8 freezes repository/profile authority and the complete resource map.
2. Phase 9 obtains an authenticated source-key inventory and classifies exact
   objects.
3. Phase 10 performs separately approved, allowlisted copy verification and a
   later retirement window.

Phase 8 is repository-only. Phases 9 and 10 remain held until their own
founder and external-service gates are recorded.

## Data reconciliation rules

- Matching key and digest: no copy.
- Target-newer object: preserve the target.
- Source-only object: require an explicit per-key allowlist.
- Same key with different digest: stop for human review.
- Derived projection: rebuild from canonical provenance where possible.
- D1, KV secrets, and whole buckets are never bulk copied.
- Current bucket totals are observations, not a transfer manifest.

## Branch integration

- Preserve dirty `main` unchanged.
- Review the two-commit Telegram branch as an independent PR.
- Hold the admission branch until the canonical project manifest and
  enrollment identity are regenerated together.
- Deliver this Labs consolidation branch independently from both.
- Treat v0.4 closeout and the old divergent/stash branches as historical or
  recovery references, never as a combined merge source.

## External gates

Repository implementation does not authorize:

- R2 copy, overwrite, deletion, or bulk synchronization;
- D1/KV/Vectorize mutation;
- Worker deployment or traffic change;
- DNS, Access application, policy, service-token, or tunnel mutation;
- source Worker, bucket, Access, or tunnel retirement;
- merge to `main`.

## Acceptance

- A tested resolver rejects every legacy write/deploy request.
- A machine-readable map matches both Wrangler configs.
- Production documentation uses the Labs config/profile explicitly.
- v0.5 state, roadmap, requirements, ISA, and goal all describe the same
  milestone and held gates.
- Focused tests, full `npm test`, deterministic planning checks, and
  `git diff --check` pass from the isolated worktree.
