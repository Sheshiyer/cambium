---
phase: 01-d1-leased-service-agreement-draft
plan: 01
status: complete
completed: 2026-07-17
requirements: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06]
---

# Summary: D1-Leased Service-Agreement Draft

## Outcome

One synthetic business request now travels through strict Cambium intake, D1
leasing, the EC2 Hermes runner, a pinned immutable Temperance release,
deterministic DOCX rendering, create-if-absent R2 storage, terminal attestation,
ACK, and task-scoped readback. It stops at `awaiting_human_approval` and exposes
no send, sign, publish, or delivery action.

## Live Identity

- Business task: `gsd-service-agreement-8ef779b7327174aeb1efe06f349280b7`
- Directive: `business-service-agreement-8ef779b7327174aeb1efe06f349280b7`
- Execution: `exec_74f7a22de34cb9f613d62e354251f405`
- Artifact: `artifact_7eaca4c8b5a05b1aa596fe2d20346536`
- DOCX SHA-256: `sha256:36bbea38456515f57b07df90d1b3188758c20d17d786b2dcf5388e67fb40caf7`
- DOCX bytes: `11857`
- Terminal state: `awaiting_human_approval`

## Release Proof

- Cambium Worker version: `108f7550-2a5a-43ea-bff4-6aefd6716988`
- Cambium source: `3b21b46` (business slice source at `e9887e4`)
- Hermes source: `de63b1aedceb3f3f3481e271314aa989e47f1227`
- Temperance release: `0.2.0-business.1-46118fed4663`
- Temperance source: `46118fed466301736d12bbfa6ad34c94424d5724`
- Temperance content digest: `sha256:4749e28c5068e075b6eda6176353c6cfc1a0dbf8b683c360485b94daafb959f6`
- Renderer policy digest: `sha256:ab11e39c744ac22dd6ee88b50f7fd275954ce4dd6bebd44590844b1f6ac6f453`
- Content policy digest: `sha256:b34b87ac93681a9acb4127ebdeb3030eccf4f9b6e2f8119b21326fdf3ffe9a13`

## Verification

- D1 migration `0004_business_artifacts.sql` applied after a private `0600`
  export with SHA-256 `b277e2164553b5921229c78786f60cb5e9e32f2bc57e8b99da67f0f27c186ae7`.
- D1 contains one business task, one delivered directive, one terminal executed
  lease, one execution history event, and one distinct artifact key.
- R2 readback bytes match the D1 receipt SHA-256 and byte length exactly; the
  downloaded file passes ZIP validation and contains the draft warning plus
  `SIGNATURES DISABLED`.
- Exact intake replay returns `duplicate: true` with the same task/directive and
  creates no second artifact identity.
- A prohibited `Send the agreement for signature` intent returns HTTP `400`
  with `external_action_forbidden` before a D1 write.
- Member-scoped artifact readback returns HTTP `200`; the assignment-only token
  returns HTTP `403` for readback.
- Rollback rehearsal ran prior Hermes commit `62bfaf78...` against the new
  Worker/schema with zero business tasks, then restored `de63b1ae...`.
- Hermes gateway and runner timer are active. Native execution is `true`; legacy
  ACK-without-execution is `false`; both Temperance paths are immutable release paths.
- The temporary operator SSH rule `sgr-02469c3d525231ae1` was revoked after
  remote verification; AWS returned `Return: true` and exact rule readback now
  returns `InvalidSecurityGroupRuleId.NotFound`.
- Post-deliverable Advisor initially challenged the stored-byte, replay, and
  access evidence. Raw readback and D1/AWS probes closed those concerns; its
  re-call found no remaining completion blocker.

## Test Gates

- Cambium: full suite `742/742`; focused bridge/migration suite `251/251` after
  the final authorization correction; Wrangler dry-run bundle passed.
- Hermes: full Node/Python suite passed; focused native runner suite `32/32`;
  runner smoke passed; the live release repeated the remote gates.
- Temperance: `11/11`, standalone audit, standalone smoke, root verify, and two
  fresh output directories producing byte-identical DOCX archives.

## Recovered Gaps

The slice exposed and closed three integration gaps before completion:

1. DOCX ZIP/core timestamps made clean re-renders nondeterministic; the pinned
   JSZip canonicalization now derives timestamps from approval observation time.
2. EC2 holds the scoped Hermes assignment credential rather than an admin
   secret; intake now admits only admin or assignment-only principals while
   readback remains member-scoped.
3. The live runner member is `hermes-runner`, not `shesh`; the untouched queued
   synthetic orphan was verified claim-free/artifact-free and rolled back before
   the successful canary was created.
