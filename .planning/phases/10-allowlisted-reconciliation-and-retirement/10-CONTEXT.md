---
phase: "10"
name: Allowlisted Reconciliation and Retirement
created: 2026-11-01
status: pending
---

# Phase 10: Allowlisted Reconciliation and Retirement — Context

## Decisions

- `thoughtseed-labs` and `workers/quests/wrangler.labs.jsonc` remain the only production authority. `9d9d` and `workers/quests/wrangler.jsonc` remain read-only source and rollback evidence until a separate retirement gate fires.
- Phase 10 may not invent keys. A founder-approved per-key allowlist can be proposed only from a Phase 9 success receipt whose private exact-key evidence still exists outside both repositories and the Labs vault, with `INV-01` and `CLASS-01` complete and zero unresolved vault or projection comparisons.
- The resource-map reconciliation contract is authoritative: matched objects are `no-copy`, target-newer objects are `preserve-target`, source-only objects require a founder per-key allowlist, digest conflicts stop for review, and bulk copy is forbidden.
- Only founder-approved `source-only` keys from the two approved prefixes may be considered for copy. Bulk bucket, D1 overwrite, KV-secret copy, Vectorize mutation, overwrite of existing target objects, and any key outside the approved prefixes remain forbidden.
- `CONTEXT_PROJECTIONS` keys classified `derived-rebuild` are rebuilt from provenance under their producer contract; they are never treated as vault source-only copy candidates.
- Parity requires authenticated Labs production flow proof plus exact resource readback that shows zero source writers and zero source production traffic. A copy receipt alone does not prove parity.
- Retirement of the legacy Worker, bucket, Access, tunnel, and account resources is a separate destructive-action gate after a founder-approved rollback observation window. Copy approval cannot authorize retirement.
- No Cloudflare write, object copy, overwrite, delete, Worker deploy, DNS change, Access change, tunnel change, D1/KV/Vectorize mutation, source retirement, or merge is authorized by creating these plans. Each executable wave remains behind its own owner authorization artifact.
- Preserve both repositories' existing dirty work and exact checkout heads. Do not stage or commit generated planning files while either checkout contains pre-existing user changes unrelated to this planning packet.

## Discretion Areas

- The private Phase 9 row-level inventory path is owner-supplied at execution time. Plans must never hard-code machine-local absolute paths, secrets, object keys, or payload digests into repository artifacts.
- Exact transfer transport (rclone crypt path versus a temporary local Worker put) may be selected only after profile resolution proves the mapped account, bucket, and prefix, and only for keys on the approved allowlist. Prefer the least-privilege path that can prove source logical bytes and target stored-byte agreement.
- If Phase 9 evidence is missing, declined, stale, mismatched, or still held, stop before any allowlist proposal or copy. Record a sanitized blocker and leave `COPY-01`, `PARITY-01`, and `RETIRE-01` held.

## Deferred Ideas

- Cambium/Hermes Telegram incident remediation remains a supplemental follow-up and must not retarget Phase 10.
- Broader account consolidation beyond the two approved R2 prefixes.
- Public release or traffic promotion gated on unrelated milestones.
