# Milestone Context: D1 Admission and Hermes EC2 Activation

**Prepared:** 2026-08-30
**Status:** Draft planning input
**Source:** `.project/HANDOFF.md` 2026-08-30 Hermes Desktop to EC2 SSH compatibility checkpoint

## Milestone Intent

Create the next finite Cambium milestone for D1 admission and Hermes EC2 activation without bypassing the established authority chain. The milestone must begin from read-only compatibility and admission planning, then stop at each owner-controlled runtime, credential, D1, Telegram, deployment, DNS, and execution gate.

## Goal

Prepare one provenance-bound D1 admission and Hermes EC2 activation path that can later prove exactly one rollback-bounded runner canary, with all mutation and execution gates still held until separately approved.

## Target Features

- Read-only Hermes Desktop to EC2 compatibility inventory covering local Desktop version, EC2 Hermes Agent CLI support, package or version metadata, tracked-versus-dirty source state, service ownership, and rollback requirements.
- D1 admission preflight for one exact WorkObject candidate, including mapping receipt/readback, eligible task candidate, directive shape, expiry, rollback reference, and terminal verification receipt shape.
- Telegram transport preflight that verifies bot/channel/allowlist/topic-map/gateway ownership through approved secret paths and one inbound receipt, without printing credentials or enabling execution.
- Authenticated bridge and proactive-delivery dry-run plan that reads pending delivery intents only after the admission and bridge prerequisites are explicit.
- Owner-gated single runner canary plan that captures terminal outcome, ACK, foldback, and inbound Telegram receipts after admission is approved.

## Known Current Facts

- Cambium v0.4 is archived and the active GSD state is awaiting a new milestone.
- The private SSH alias `hermes-nous-ec2` reaches `hermes-runner-01` as `ubuntu` through AWS Session Manager without public SSH ingress.
- Hermes Desktop v0.20.6 can resolve the SSH alias and host identity, but the EC2 Hermes executable lacks the Desktop-required `ssh-session-token-file` and `ssh-owner-nonce` SSH-session flags.
- The separately saved Hermes Cloud gateway has a stale WebSocket-ticket failure that does not invalidate the EC2 SSH alias, the renewed `safvr` AWS session, or the SSM transport.
- The existing EC2 Hermes source tree is user-modified. Do not run `hermes update`, stash, restart services, or overwrite that tree without a separate owner-approved compatibility procedure.
- The active EC2 Nous gateway's previous Telegram credential was rejected upstream. Treat that as invalid transport configuration, not proof of a usable channel or token.
- `HERMES_RUNNER_EXECUTE_DIRECTIVES=false` and `HERMES_RUNNER_LEGACY_ACK_WITHOUT_EXECUTION=false` must remain preserved until the relevant approvals are recorded.

## Planning Boundaries

### Autonomous and Read-Only

- Inspect local Desktop version and EC2 Hermes Agent CLI/source/service contracts.
- Produce compatibility, backup, rollback, and upgrade/tunnel decision plans.
- Inspect repository-local Cambium admission contracts and identify candidate evidence requirements.
- Draft D1 admission, Telegram preflight, dry-run consumer, and canary verification requirements.

### Owner-Gated

- EC2 update, stash, backup, source rewrite, package install, or service restart.
- Bot API token write, Telegram gateway restart, inbound or outbound Telegram proof, or bot ownership changes.
- D1, KV, R2, Worker, Cloudflare Access, wrangler, DNS, domain, public ingress, deployment, or directive-execution mutation.
- Saving or reconnecting Hermes Desktop to the EC2 gateway while the protocol mismatch remains unresolved.
- Using Desktop Remote Gateway mode except as a separately approved, time-bounded operator-plane experiment after API compatibility proof.

## Required Human Decision Before Executable Admission Planning

Select the exact WorkObject candidate for the first D1 admission path. The prior handoff explicitly did not select `fitcheck-shopify-widget-qa` as a live candidate. The candidate must include:

- WorkObject identity and kind.
- Mapping receipt/readback reference.
- Eligible task or directive candidate.
- Expiry window.
- Rollback reference.
- Verification receipt shape.

## Suggested Milestone Shape

### Phase 8: Compatibility and Admission Preflight

Read-only source and runtime-contract inventory. Output a concrete compatibility/rollback plan plus one selected D1 admission candidate packet. No EC2, D1, Telegram, deployment, DNS, or directive mutation.

### Phase 9: Transport and Dry-Run Proof

Prepare Telegram and bridge proof requirements while preserving disabled execution flags. Verify only approved secret names, allowlists, topic mapping, gateway ownership, authenticated bridge preflight, and dry-run consumer behavior.

### Phase 10: Single Canary Execution Gate

After separate owner approval, execute one rollback-bounded runner canary and capture terminal outcome, ACK, foldback, inbound Telegram receipt, and rollback evidence. Stop on any mismatch.

## Verification Requirements

- Repository planning artifacts preserve `VISION.md`, `MISSION.md`, `ISA.md`, GSD, D1 Goal Graph, and read-only projection authority separation.
- Compatibility plan names exact EC2 source/service evidence and does not hide dirty remote state.
- Admission plan proves candidate identity, mapping receipt/readback, directive shape, expiry, rollback, and receipt schema before any mutation.
- Telegram plan proves single-poller ownership and no-secret-printing constraints.
- Canary plan distinguishes configured services, healthy timers, and status endpoints from end-to-end proof.
- `git diff --check` must pass for planning artifacts before handoff.
