---
phase: 08-labs-authority-and-profile-safety
plan: 01
subsystem: cloudflare-authority
tags: [cloudflare, wrangler, access, d1, kv, r2, vectorize, fail-closed]
phase_base_sha: 5caca954be9d7b646286773be7e1dccf03cfad7c

requires:
  - phase: 07-deterministic-safety-and-handoff
    provides: authority, freshness, privacy, and reviewed-handoff validation
provides:
  - fail-closed Labs production and legacy read-only Wrangler resolver
  - source-bound Worker, route, Access, D1, KV, R2, and Vectorize map
  - canonical Labs production and legacy inspection runbook
  - held Phase 9 authenticated source-inventory transition
affects: [09-source-inventory-and-classification, 10-allowlisted-reconciliation-and-retirement]

requirements-completed: [AUTH-01, MAP-01, RUN-01]
completed: 2026-08-31
---

# Phase 8 Plan 1: Labs Authority and Profile Safety Summary

## Outcome

Repository authority now fails closed around two explicit profiles:

- `thoughtseed-labs` with `workers/quests/wrangler.labs.jsonc` is the only
  production write and deploy authority for `curious.thoughtseed.space`.
- `9d9d` with `workers/quests/wrangler.jsonc` is read-only source and rollback
  evidence. Its known write-capable helper paths reject before credentials,
  network access, or Wrangler command construction.

The machine-readable resource map binds both configurations to Worker,
account, route, Access team and audience set, D1, KV, R2, and Vectorize
identities. Unknown semantic names and hostnames for the legacy Access audience
set remain explicitly unresolved until an authenticated Phase 9 source read.

## Commits

- `2aad38a` — profile resolver, stable resource map, runbook, legacy guards,
  and their tests.
- `d8d3ae6` — v0.5 GSD, ISA, goal, generated readbacks, design, and plan.
- `4753af1` — independent-review repair that pins both Access audience sets.

## Verification evidence

- The profile/map TDD gate demonstrated RED on the omitted Access receipt and
  map assertions, then GREEN at 9/9 after `4753af1`.
- The combined resolver, map, release, legacy-helper, and standalone-audit
  suites pass 36/36 after the review repair.
- The exact committed pre-repair tree passed `npm test` twice at 1974/1974,
  including one independent reviewer run.
- Independent re-review of `4753af1` found no remaining actionable findings.
- Phase closeout exposed a historical adapter assumption that the first handoff
  checkpoint always belonged to Phase 5. The adapter now selects the first
  Phase 5 match from the handoff's newest-first order; its Ralph and flow
  suites pass 32/32 with a newer Phase 8 checkpoint present.

## Held gates

This completed repository phase did not perform or authorize Cloudflare
mutation, Worker upload or promotion, DNS, Access, tunnel, R2 copy or deletion,
D1/KV/Vectorize writes, source retirement, merge, push, or PR creation. Phase 9
execution remains blocked until explicit owner approval permits authenticated
read-only source inventory; repository planning may continue.
