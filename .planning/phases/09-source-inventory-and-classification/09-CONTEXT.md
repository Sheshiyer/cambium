# Phase 9 Context: Source Inventory and Classification

**Milestone:** v0.5 Thoughtseed Labs Consolidation and Governed 9d9d Retirement
**Status:** Planning only; authenticated read access and every mutation remain gated
**Source:** `.planning/v0.5-MILESTONE-CONTEXT.md`, Phase 8 verification, and the D1/Hermes downstream draft

## Goal

Produce an exact, authenticated, read-only comparison of the legacy `9d9d`
Cloudflare source and the canonical `thoughtseed-labs` target. Every observed
object must be classified from key, metadata, and digest evidence before any
allowlist, copy, deletion, retirement, or deployment proposal is considered.

## Why this is the immediate step

The D1/Hermes EC2 draft is retained as the next finite horizon, but it does not
replace the active v0.5 milestone. Phase 9 establishes the source and rollback
evidence needed to keep Cambium's production authority truthful. D1 admission,
Hermes compatibility, Telegram transport, and runner execution have separate
authority and approval boundaries and are not folded into this phase's runtime
work.

## Authority and scope

- `thoughtseed-labs` and `workers/quests/wrangler.labs.jsonc` remain the sole
  production authority for `curious.thoughtseed.space`.
- `9d9d` and `workers/quests/wrangler.jsonc` remain read-only source and
  rollback evidence.
- Exact source-only keys, target-only keys, matching keys, target-newer keys,
  and digest conflicts must be represented separately.
- Bucket totals, configured profiles, health responses, and deployment success
  are observations only; none is a transfer manifest or parity proof.
- No Cloudflare write, deploy, copy, delete, DNS, Access, tunnel, D1, KV, R2,
  Vectorize, Telegram, EC2, Hermes, or directive-execution operation belongs
  to Phase 9.

## Required evidence

1. A documented authenticated read-only access preflight with secret names but
   no secret values, tokens, headers, or session identifiers in artifacts.
2. A deterministic source manifest containing exact keys, relevant metadata,
   object sizes, modification evidence, and content digests.
3. A deterministic target manifest obtained through the Labs profile with the
   same bounded fields and the same redaction rules.
4. A classification readback that names every delta and preserves conflicts as
   blockers rather than selecting a winner.
5. A review packet that records the source revision, commands, authority, held
   gates, and the exact next planning or approval action.

## Downstream handoff

After Phase 9 is independently verified, the D1/Hermes draft becomes the
candidate context for v0.6: compatibility and admission preflight, transport
and dry-run proof, and one separately approved runner canary. The exact
WorkObject candidate must be selected before executable admission planning.
Phase 10's allowlisted reconciliation and 9d9d retirement remain a distinct
v0.5 gate and are not implied by this handoff.

## Open decision

The first D1 admission candidate remains intentionally unselected. Planning
may specify the evidence contract, but execution cannot begin until the owner
names the exact WorkObject identity and kind, mapping receipt, eligible task or
directive, expiry, rollback reference, and terminal verification receipt shape.
