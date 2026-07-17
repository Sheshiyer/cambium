# Roadmap: Cambium Managerial Control Loop

## Overview

The v0.3 recovery milestone connects one narrow business command across the already-live D1 claim/outcome contract and EC2 Hermes runner. Completion requires a downloadable, non-signable DOCX draft with D1/R2 receipt parity and safe replay—not merely passing component tests.

## Phases

- [x] **Phase 1: D1-Leased Service-Agreement Draft** - Connect intake, lease, Temperance rendering, durable storage, outcome, and readback.

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

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. D1-Leased Service-Agreement Draft | 1/1 | Complete | 2026-07-17 |
