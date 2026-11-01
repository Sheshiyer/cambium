# Phase 10 Research: Allowlisted Reconciliation and Retirement

Status: contract-only. No Cloudflare API, rclone, Wrangler remote, or live inventory call was performed while writing this note.

## Sources consulted

| Source | Role |
| --- | --- |
| `.planning/REQUIREMENTS.md` | Active `COPY-01`, `PARITY-01`, `RETIRE-01` definitions and held status |
| `.planning/v0.5-MILESTONE-CONTEXT.md` | Milestone authority: Labs production, `9d9d` read-only, exact inventory before allowlist |
| `.planning/phases/09-source-inventory-and-classification/09-CONTEXT.md` | Prefix scope, classification rules, private evidence boundary |
| `.planning/phases/09-source-inventory-and-classification/09-01-PLAN.md` | Exact Phase 9 gates a Phase 10 allowlist must inherit |
| `docs/architecture/contracts/cambium-cloudflare-resource-map.v1.json` | Profile IDs, bucket strategies, reconciliation matrix, retirement gates |
| `scripts/quests-wrangler-profile.mjs` | Fail-closed `labs-production` / `legacy-source` resolution and operation allowlists |
| `docs/evidence/cambium-cloudflare-r2-inventory-phase-9.v1.json` | Current repository receipt is a Task-1 placeholder; `INV-01` / `CLASS-01` remain held |

## Resource-map reconciliation matrix

From `cambium.cloudflare-resource-map.v1`:

- Approved prefixes only: `portfolio/thoughtseed/workobjects/` and `context/v1/daily-standup-digest/standups/`.
- `matched` → `no-copy`
- `target_newer` → `preserve-target`
- `source_only` → `require-founder-per-key-allowlist`
- `digest_conflict` → `stop-for-review`
- `bulk_copy` → `forbidden`

Production R2 strategies are `per-key-reconcile`. Legacy R2 strategies remain `approved-prefix-inventory-only` until Phase 10 copy gates open. KV `SECRETS` strategy is `target-only-never-copy-values`. D1 strategy is `preserve-target-authority` / `inventory-only-never-overwrite-target`. Vectorize stays rebuild-from-provenance / retain-as-rollback-evidence.

## Retirement gates already declared

The resource map lists, in order of dependency:

1. `fresh-authenticated-source-key-inventory`
2. `per-key-classification-and-digest-readback`
3. `zero-source-writers`
4. `zero-source-traffic`
5. `authenticated-labs-flow-proof`
6. `founder-approved-rollback-window`

Phase 10 plans must treat these as hard prerequisites, not prose suggestions.

## Profile resolver constraints

`quests-wrangler-profile.mjs` resolves:

- `labs-production` → `thoughtseed-labs` + `workers/quests/wrangler.labs.jsonc`
- `legacy-source` → `9d9d` + `workers/quests/wrangler.jsonc`

Legacy write and deploy operations are rejected before a Wrangler command is constructed. Phase 10 copy tooling must keep that fail-closed boundary: legacy profile may supply read of approved source-only keys; Labs is the only write target for allowlisted puts; retirement remains a later destructive gate.

## Phase 9 evidence boundary Phase 10 inherits

- Exact keys, sizes, timestamps, ETags, and per-object digests stay in private ephemeral evidence outside both repositories and the Labs vault.
- Committed Phase 9 success receipts contain only schema/version, approved scopes, timestamps, aggregate counts, inventory digest, and classification totals.
- The current checked-in `docs/evidence/cambium-cloudflare-r2-inventory-phase-9.v1.json` reports `status: phase-9-task-1-placeholder` with both inventory requirements held. It is not a success receipt and cannot seed a key allowlist.
- Unresolved vault or projection comparisons block Phase 9 completion and therefore block every Phase 10 wave.

## Implications for Phase 10 plans

1. `COPY-01` tooling and authorization artifacts must refuse to emit or act on keys unless a Phase 9 success receipt validates and the private inventory digest matches the private evidence set.
2. Only `source-only` classifications on proven logical keys from the two approved prefixes are allowlist candidates. `identical`, `target-newer`, `conflicting`, `unresolved`, and projection `derived-rebuild` rows are never copy candidates under the vault rules.
3. `PARITY-01` begins only after an approved copy receipt or an explicit zero-copy decision recorded when there were zero source-only candidates.
4. `RETIRE-01` cannot share the copy authorization artifact. It requires parity proof plus the founder-approved rollback window before any destructive legacy action.

## Open execution blockers (not resolved by this research)

- Authenticated Phase 9 inventory has not run; founder read authorization remains required.
- Private exact-key evidence path does not yet exist for a success receipt.
- No founder per-key copy allowlist or retirement decision exists.
- Live Cloudflare mutation remains outside this planning packet.
