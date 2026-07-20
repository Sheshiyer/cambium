---
phase: 02-telegram-operator-intake
plan: 01
status: complete
completed: 2026-07-17
requirements: [REQ-07, REQ-08, REQ-09, REQ-10, REQ-11]
---

# Summary: Telegram Operator Intake

## Outcome

The proven synthetic service-agreement draft is now exposed through the
allowlisted Hermes Telegram plugin. A founder can queue or replay the bounded
canary and read its redacted D1 status without JSON, a coding CLI, SSH, raw
task data, the runner credential, or document bytes.

## Commands

- `/ts-agreement-draft canary [request-key]`
- `/ts-agreement-status <gsd-task-id>`

Registration is off by default and requires
`HERMES_SERVICE_AGREEMENT_OPERATOR_ENABLED=true`.

## Live Identity

- Task: `gsd-service-agreement-efd78b1f1351fb7d491615e19968eb3a`
- Artifact: `artifact_03164d589c92b1d2ace220ff0a231100`
- Digest: `sha256:077e248732a365a2f56de17c84b3d30ef55a11d1d933f16436cc5b794c99458f`
- Bytes: `11745`
- State: `awaiting_human_approval`
- External action: `none`

## Releases

- Cambium source: `187de554114ae0517fe3b452c9a8573339e4c309`
- Worker version: `584888fb-2684-4618-838a-fe152f02c29b`
- Hermes source: `e41065aecaba6291579860a6a49a78d0259fff21`
- Telegram plugin: `1.1.0`

## Verification

- First installed-handler intake returned queued with `duplicate:false`.
- The runner completed one leased attempt; status returned the safe artifact
  digest/length and human-approval boundary.
- Exact replay returned the same task with `duplicate:true`.
- D1 contains one task, one directive, one execution event, one distinct
  execution, and one artifact identity.
- Assignment-token raw task and artifact reads remain HTTP 403. The redacted
  operator receipt is HTTP 200 and contains only its explicit field allowlist.
- Live disabled registration was 0/0; enabled registration was exactly 1/1.
- Gateway `allow_from` contains two authorized senders; chat and group chat
  allowlists each contain one hard-gated chat.
- Previous Hermes/plugin rollback ran successfully against the new Worker with
  zero operator-task residue before the new release was restored.
- Final Worker, gateway, timer, runner, and execution flags are healthy.
- Cambium passed 743/743; Hermes passed 153/153 plus plugin 30/30; remote native
  runner passed 32/32 and all deployment smokes.
- Temporary SSH ingress was revoked and exact rule readback is NotFound.

## Boundary

This remains a synthetic internal canary. It does not create a real-client
agreement, approve legal terms, expose document bytes, request signature, or
send/deliver anything.
