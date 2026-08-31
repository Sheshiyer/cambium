# Requirements: Thoughtseed Labs Consolidation and Governed 9d9d Retirement

## Active requirements

### Phase 8 — Labs Authority and Profile Safety

- [x] **AUTH-01** — A tested resolver names `thoughtseed-labs` as production,
  permits legacy `9d9d` reads, and rejects every legacy write or deploy
  request before a Wrangler command is constructed.
- [x] **MAP-01** — One machine-readable contract maps Worker, route, Access
  team and audience sets, D1, KV, R2, and Vectorize identities for both
  profiles without secrets or mutable object counts.
- [x] **RUN-01** — One canonical production runbook uses the Labs config and
  `thoughtseed-labs` profile explicitly and treats `9d9d` as read-only.

### Phase 9 — Source Inventory and Classification

- [ ] **INV-01** — Authenticated read-only source inventory records exact R2
  keys, sizes, modification metadata, and content digests without copying.
- [ ] **CLASS-01** — Every exact source/target pair is classified as identical,
  target-newer, source-only, conflicting, or derived-rebuild.

### Phase 10 — Allowlisted Reconciliation and Retirement

- [ ] **COPY-01** — Only founder-approved, source-only keys are copied; bulk
  bucket, D1, KV-secret, and overwrite operations remain forbidden.
- [ ] **PARITY-01** — Authenticated production flows and exact resource
  readbacks prove target parity with zero source writers and zero source
  production traffic.
- [ ] **RETIRE-01** — The legacy Worker, bucket, Access, tunnel, and account
  resources remain available through a founder-approved rollback window and
  are retired only through a separate destructive-action gate.

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| AUTH-01 | Phase 8 | Complete |
| MAP-01 | Phase 8 | Complete |
| RUN-01 | Phase 8 | Complete |
| INV-01 | Phase 9 | Held |
| CLASS-01 | Phase 9 | Held |
| COPY-01 | Phase 10 | Held |
| PARITY-01 | Phase 10 | Held |
| RETIRE-01 | Phase 10 | Held |

## Held external actions

This requirements file does not authorize Cloudflare mutation, Worker upload
or promotion, DNS or Access changes, R2 copy or deletion, D1/KV/Vectorize
writes, tunnel changes, source retirement, or merge to `main`. The `9d9d`
profile stays read-only until the later requirements and gates are satisfied.
