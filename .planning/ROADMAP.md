# Roadmap: Cambium Managerial Control Loop

## Overview

The v0.3 recovery milestone connects one narrow business command across the already-live D1 claim/outcome contract and EC2 Hermes runner. Completion requires a downloadable, non-signable DOCX draft with D1/R2 receipt parity and safe replay—not merely passing component tests.

## Phases

- [x] **Phase 1: D1-Leased Service-Agreement Draft** - Connect intake, lease, Temperance rendering, durable storage, outcome, and readback.
- [ ] **Phase 2: Telegram Operator Intake** - Expose the proven synthetic slice through bounded draft and redacted status commands.

## Phase Details

### Phase 1: D1-Leased Service-Agreement Draft
**Goal**: An operator can submit one synthetic service-agreement draft request and read back the same immutable artifact after D1-leased Hermes/Temperance execution.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06
**Canonical refs**: ecosystem-recovery ISA iteration 4; Cambium Worker `origin/main`; Hermes `origin/main`; Temperance `codex/ec2-headless-shadow`.
**Prerequisites**: Existing D1 native execution proof and EC2 headless Temperance shadow release.
**Success Criteria** (what must be TRUE):
  1. One strict intake creates one D1 task and one leased directive.
  2. Hermes invokes the pinned Temperance renderer and produces a valid non-signable DOCX.
  3. R2 bytes, D1 receipt, terminal attestation, and downloaded digest agree.
  4. Replay creates no second directive or artifact.
  5. The terminal workflow state is awaiting human approval and no external delivery occurs.
**Plans**: 1 plan

Plans:
- [x] 01-01: Implement, deploy, and live-prove the D1-leased draft slice.

### Phase 2: Telegram Operator Intake
**Goal**: A founder can submit and reconcile the proven synthetic service-agreement canary from the allowlisted Telegram surface without JSON, a coding CLI, or SSH.
**Depends on**: Phase 1
**Requirements**: REQ-07, REQ-08, REQ-09, REQ-10, REQ-11
**Canonical refs**: ecosystem-recovery ISA iteration 5; Cambium `codex/operator-intake-service-agreement`; Hermes `codex/operator-intake-service-agreement`.
**Prerequisites**: Proven D1-leased service-agreement slice and active Hermes Telegram plugin.
**Success Criteria** (what must be TRUE):
  1. `/ts-agreement-draft canary [request-key]` creates or replays one stable D1 task through the scoped assignment credential.
  2. `/ts-agreement-status <task-id>` returns an allowlisted D1 receipt without raw task data, artifact bytes, R2 keys, or broader credentials.
  3. The task reaches `awaiting_human_approval` with one artifact whose digest and length match the redacted receipt.
  4. Registration is default-off, the live founder/group allowlist remains enforced, and one-version rollback leaves no orphan.
  5. Worker, gateway, timer, and SSH security-group state are healthy after proof.
**Plans**: 1 plan

Plans:
- [ ] 02-01: Implement, deploy, and live-prove Telegram operator intake and status.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. D1-Leased Service-Agreement Draft | 1/1 | Complete | 2026-07-17 |
| 2. Telegram Operator Intake | 0/1 | In progress | — |
