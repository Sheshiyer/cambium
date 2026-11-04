# Cambium finite Hermes pilot — next session

The founder selected a finite operator-triggered Hermes run through existing AWS
SSM for the first pilot. Preserve the current background runner. This choice is
not deployment approval, a founder direction decision, or a job launch receipt.

## Pinned source and artifact

- Cambium Worker/native source:71557699a924b896a65a4abdf7a6882472998d3f,
  draftPR429. Later handoff-only commits do not change this source pin.
- Hermes source:22b3e8276d3b4c2b74041920f3cd559071e16773, draftPR169.
- Exact scope, file hashes, migration hashes, policy and bundle hashes:
  `FINITE-SSM-ROLLOUT-20261104.json` beside this handoff.
- Prepared artifacts remain in ignored `.local/finite-ssm-rollout/` in the
  owned Cambium checkout. Runtime archive:8files,30299bytes,
  SHA256f2b5ec371ee0cac4e973f27cdce92e9185f7c383aa99038a8d14787b489eed34.
- The archive can be reproduced with `git archive --format=tar` at the exact
  Hermes commit for package.json and src/{cambium-pilot-once,
  cambium-patch-contract,cambium-patch-executor,contracts,crypto,
  native-execution,runner}.ts, then gzip with mtime0. Verify the recorded hash.
- The new one-shot entrypoint was independently reviewed with no findings;
  three finite-boundary tests and all388Hermes Node tests pass.
- Prior Cambium source checks:2732repository tests,270Core(two skips),44native;
  five direction wire checks and Worker dry-run pass. Actual local amd64 Docker
  proof is baselineRED/candidate8PASS/exact diff. This is not hosted acceptance.

## Live preflight before any approval request

Refresh only read-only state first. Use AWS profile safvr and the existing SSM
instance from the rollout manifest. Recheck the current runner source hashes,
service/timer settings and existing source object store. Do not run the generic
runner or deploy script as a probe. Last readback: growth release09b3369,
service userhermes, NoNewPrivileges, no Docker supplementary group, private tmp,
and readonly home. Node22.23.0, Docker29.1.3 and systemd255 are present.

The existing source store contains the pinned Cambium base commit, has no object
alternates, and produces a7,976,960byte bounded archive. The background account
cannot read it; the separately approved transient root pilot can. Do not change
background permissions or add it to Docker groups.

Refresh the thoughtseed-labs Cloudflare profile only if its current read fails.
Last management read had authentication10000. Fetch the current Worker version,
all binding identities/values, runtime settings and migration state. The last
observed version2971a905 and52bindings are historical baselines, not current
proof. If any source/settings/bindings drifted, stop and reconcile the candidate
before asking approval. Do not overwrite newer growth/native behavior.

## Exact installation scope to present for separate approval

1. Worker: only pinned Cambium source, migration0099 then0104 if each is proven
   absent, and two non-secret variables from the manifest.0103 is already
   applied: never repeat it. No admission rows are seeded or manually written.
2. Preserve every existing binding and runtime setting. The prepared candidate
   inherits all52retained binding identities and adds only the pilot policy and
   runner-member variables (54total if the live baseline still matches).
   Generate a fresh inheritance config from the actual current version; do not
   deploy the old47-binding checked-in inheritance file. Prepared dry-run passed.
3. Host: stage only the exact8-file Hermes archive into a NEW immutable pilot
   release named in the manifest; include the exact source policy separately.
   Transfer bounded base64 chunks through existing SSM or another already
   approved transfer; verify the complete archive hash and exact entry list
   before extraction into an empty directory. No npm install is required for
   this builtin-only runtime closure. Pull only the pinned amd64 image digest
   into Docker cache. Do not execute a job while staging.
4. Do not modify the existing growth release, service, timer, environment files,
   credentials, provider routing, plugins, hooks or resident processes. No new
   bridge, scheduler, resident helper or standing privilege grant.
5. Capture the actual pre-upload Worker version as rollback. The old2971a905
   cannot be assumed to remain the rollback version. Database changes are
   additive and retained; rollback never drops tables, receipts or admissions.

Only after fresh equality checks, provide the concrete source/artifact/settings
comparison and obtain the required owner rollout approval. Do not treat this
handoff or the prior approach choice as that approval.

## One job after rollout, human decision and native launch

Build/sign the native app once the whole approved stack is ready, recording its
source/input digest. Only then ask for one native login. Keep OTPs and consent
human-controlled. Re-read the real mapped Cambium Work and saved direction.
Do not recreate the already approved Work proposal55efd3d72733… or use demo data.

Walk the real native flow: mapped signal -> saved direction -> fresh complete
review -> founder manually approves -> Prepare launch derives an admission ->
resolve the exact admission -> explicit native launch reserves the original
request/attempt and queues one directive. Approval, admission and launch remain
separate. Do not agent-click the founder's Approve action.

Derive the one-shot operator manifest from canonical review and original
reservation readback: member, directive, idempotency key, input digest, policy
and policy digest. Do not invent IDs, update mutable pins or mint another
request after an uncertain reply. The CLI selection schema is in
`src/cambium-pilot-once.ts`. Its input must contain the exact strict policy,
existing source-store path and a SEPARATE retained pilot-state directory.
The per-job values cannot be bound until the actual decision/reservation exist.

Run one reviewed SSM command that creates a finite transient systemd unit for
this exact execution, from the isolated pilot release, invoking:

```sh
/usr/bin/node PILOT_RELEASE/src/cambium-pilot-once.ts OPERATOR_MANIFEST
```

Use a deterministic unit name derived from the execution identity, --wait and
--collect, existing base EnvironmentFile plus identity override, and ONLY the
two existing Access LoadCredential references. Exclude growth runtime/model
credentials. The transient process uses root only for this bounded pilot and
Docker access; no background account permission changes. Set NoNewPrivileges,
PrivateTmp, ProtectSystem=strict, ProtectHome=read-only, TimeoutStartSec=300,
KillMode=control-group, with write access only to the separate pilot state.
This root execution itself remains separately owner-admitted; record the exact
SSM command ID and selected request/attempt before invocation.

The entrypoint filters the queue to one digest-verified code directive and
fences all claim/outcome/ACK effects to it. Heartbeat, Cortex and unrelated queue
execution are disabled. Docker gets the existing fixed no-network, readonly,
nonroot, bounded policy. No model inference runs inside this verification job.
SSM success or an executed transport status is not semantic acceptance.

Read the original native request status, then its bound result: exact diff,
base/patch/input/policy/image digests, baseline exit1 and candidate exit0, logs,
review-required acceptance, no external actions. Confirm persistence through a
second read without redispatch. The candidate patch is not merged or deployed.
On uncertainty, recover original state/status; never choose a new execution ID
merely to bypass a claim. A missing ACK target after completion means use result
readback, not a new job. Retain all state and proof.

Rollback: restore only the captured Worker version if necessary. Stop only the
exact transient pilot unit and, if needed, its deterministically named container.
Keep state/results and immutable release artifacts. Never stop or swap the
existing Hermes background runner or delete shared Docker resources.

## Temperance and hosted free/promo source work

Keep the native coordinator's actual platform model. For any hosted source or
review worker, select noesis-free at CLI launch through the installed wrapper:

```sh
~/.temperance_engine/bin/te-codex --pool noesis-free exec --cd OWNED_CHECKOUT 'BOUNDED_SOURCE_TASK'
```

Hosted Phloem is https://omniroute.thoughtseed.space; safvr is AWS auth, not an
inference login. Promotions qualify only if already admitted to noesis-free at
zero incremental cost. No paid fallback, protected S/A entitlement consumption,
provider/account changes or routing writes. Verify provider-attributed receipts;
a pool label is not serving-model or billing proof. An unavailable free worker
is held, not rerouted to paid capacity. Minimal Temperance state is advisory;
its stale compatibility defaults do not authorize local20128 or override this
bound hosted pool. No broad skill install or automatic fleet dispatch.

## Session completion evidence

Update only this finite task's handoff and existing ISA3683..3687 when the
specific required evidence exists. Source, local Docker, deployment, real native
interaction, founder decision, hosted execution and result acceptance are
separate receipts. No closure based on a green fixture or SSM exit alone.
