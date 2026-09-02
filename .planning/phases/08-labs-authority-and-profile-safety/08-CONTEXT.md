# Phase 8 Context: Labs Authority and Profile Safety

## Outcome

Repository operators have one fail-closed path for
`curious.thoughtseed.space`: `thoughtseed-labs` is production, `9d9d` is
read-only source evidence, and the complete Cloudflare resource relationship
is visible before any command is assembled.

## Decisions

- Production commands must name both
  `--config workers/quests/wrangler.labs.jsonc` and
  `--profile thoughtseed-labs`.
- Legacy inspection must name both
  `--config workers/quests/wrangler.jsonc` and `--profile 9d9d`.
- Legacy write or deploy intent is rejected by the repository resolver.
- Stable account-scoped IDs belong in the resource map; secrets and mutable
  object counts do not.
- D1 Goal Graph and Hermes retain their existing authority boundaries.

## Scope

Phase 8 owns source code, tests, the resource map, canonical production
runbook, and coherent ISA/GSD state. It performs no Cloudflare write, deploy,
traffic change, copy, DNS/Access/tunnel mutation, or source retirement.

## Acceptance mapping

- AUTH-01 → ISC-2470
- MAP-01 → ISC-2471
- RUN-01 → ISC-2472
- coherent planning and branch handoff → ISC-2473
