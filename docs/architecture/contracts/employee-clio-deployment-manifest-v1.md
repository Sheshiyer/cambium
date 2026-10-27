# Employee Clio deployment manifest v1

Type: contract. Status: draft. Fan-out item E1 of the vault plan
`20-operations/growth/2026-10-27-growth-gap-fanout.md`.

The growth execution map (vault `department/execution-map.md`, 2026-10-23
reconciliation) says deployment of the employee Clio path "must pin the actual
realm, audience, workspace, protected credentials and hostname together, then
prove an authenticated employee stream." This file is that pin. It is a
reviewed manifest, not a deployment: nothing in it enables a unit, sets a
Worker variable, enrolls a binding, or claims the path is live. Items E2–E5
consume it. Every `TBD-founder` is a value the founder must supply or confirm
before E2 may start; no agent fills it by guessing.

No secret values appear here. Credentials are named so a reviewer can check
presence, scope and owner, never contents.

## 1. Path being deployed

```text
Plexus Clio (desktop)
  → authenticated Clio relay (EC2, loopback listener)
  → Phloem (OmniRoute, hosted or loopback per §6)
  → Cambium /v1/bridge/growth/* (admission, D1, member identity)
  → Hermes runner claims growth.request.draft
  → member-scoped draft receipt read back in Plexus
```

Sources: `docs/architecture/contracts/employee-growth-workflow-v1.md`,
`workers/quests/src/growth-workflow.ts`, vault `department/execution-map.md`.

## 2. Access realm (explicit, no fallback)

The relay supports a legacy realm and a Labs realm, selected explicitly, with
no issuer fallback. Exactly one is pinned here.

| Field | Value |
|---|---|
| Realm selected | `TBD-founder` (one of: `legacy`, `labs`) |
| Access team domain (name of setting) | `TF_ACCESS_TEAM_DOMAIN` |
| Access application audience (name of setting) | `TF_ACCESS_AUD` |
| Audience value | `TBD-founder` |
| Issuer URL | derived from the selected realm's team domain; never both |
| Plexus whoami endpoint (name of setting) | `PLEXUS_WHOAMI_URL` (or default) |

Rule: the relay refuses to start if the realm is unset or if both realms'
audiences are present in its config. The Worker's `TF_ACCESS_TEAM_DOMAIN` /
`TF_ACCESS_AUD` must match the relay's selected realm; a mismatch is a
deployment failure, not a runtime fallback.

## 3. Audience and membership

| Field | Value |
|---|---|
| Who may open a Clio stream | active Plexus members of the admitted organization, verified by whoami on the selected realm |
| Admitted tenant IDs (name of setting) | `GROWTH_WORKFLOW_TENANTS_JSON` |
| Tenant list value | `TBD-founder` (expected: one tenant, the Thoughtseed organization id) |
| Runner member (name of setting) | `GROWTH_WORKFLOW_RUNNER_MEMBER_ID` |
| Runner member value | `TBD-founder` (canonical member id of the Hermes runner; must share the tenant) |
| Pending quota (name of setting) | `GROWTH_WORKFLOW_MAX_PENDING` — default 10 |
| Daily quota (name of setting) | `GROWTH_WORKFLOW_MAX_DAILY` — default 50 |
| Excluded from employee context | founder, HR, finance, arbitrary client data (per execution map) |

Admin and assignment tokens cannot impersonate an employee on these routes;
identity comes from the member binding only.

## 4. Workspace

| Field | Value |
|---|---|
| Cloudflare account / Worker | the existing quests Worker that serves `/v1/bridge/growth/*`; name per `cambium-cloudflare-resource-map.v1.json` |
| D1 binding | `BRIDGE_DB` with migration `0011_growth_workflow.sql` applied |
| KV binding | `QUESTS` (existing) |
| Vault checkout on EC2 | `/home/ubuntu/repos/thoughtseed-labs`, transport `origin` → `Sheshiyer/thoughtseed-vault` |
| Hermes runtime working directory | `/opt/hermes-aws-ts` (observed 2026-10-23; confirm unchanged) |
| Hermes source checkout | separate path, `TBD-founder` (record the exact path and commit at E2) |
| Growth context projection digest | `TBD-founder` (pinned after fan-out A1/A5 land; must equal `GET /v1/bridge/growth/context` `projectionDigest`) |
| Vault source commit for the projection | `TBD-founder` (the A1 commit on `origin/main`) |
| Cambium Worker version to deploy | `TBD-founder` (a reviewed candidate containing `growth-workflow.ts` at or after `eb181c6`) |
| Rollback Worker version | `TBD-founder` (refresh at release time; the 2026 Founder Gate handoff values are stale) |

## 5. Protected credentials (names only)

| Name | Holder | Purpose | Must not |
|---|---|---|---|
| `CAMBIUM_BRIDGE_MEMBER_TOKEN` (per member, issued by Cambium) | Plexus member session | employee calls to `/v1/bridge/growth/*` | be shared, logged, or held by the relay beyond the request |
| Phloem shared credential (OmniRoute API key; setting name on the relay `TBD-founder`) | Clio relay on EC2 | relay → hosted Phloem | be present on any desktop; be reused as Hermes' key |
| Hermes runner bridge credential (existing runner member token) | `hermes-runner.service` | claim and attest `growth.request.draft` | be the same token as any employee's |
| `FOUNDER_GATE_BINDINGS_JSON` | Worker setting | founder decisions only; unrelated to employee streams | be widened to admit employees |
| Cloudflare Access service token for the relay (if hosted upstream) | Clio relay | pass Access in front of `omniroute.thoughtseed.space` | be committed or printed in a receipt |
| AWS profile `safvr` | operator laptop | read-only EC2 inspection | be installed on EC2 or used by any employee runtime |

Storage location for relay-side credentials on EC2: `TBD-founder`
(expected: a root-owned env file with mode 600 read by the systemd unit via
`EnvironmentFile=`; the path is recorded at E2, the contents never are).

## 6. Hostname and upstream mode

| Field | Value |
|---|---|
| Clio relay host | EC2 Hermes host (`hermes-runner-01`); listener bound to `127.0.0.1` only |
| Clio relay listener port | `20130` (loopback; see §7) |
| Public hostname for the relay | none. Clio reaches the relay through an authenticated tunnel, `TBD-founder` (expected: a `cloudflared` route under the selected Access realm; the existing `cloudflared-omniroute-ec2.service` is Phloem's and must not be reused for the relay) |
| Upstream mode | `TBD-founder` (one of: `loopback` → OmniRoute at `127.0.0.1:20128`; `hosted` → `https://omniroute.thoughtseed.space`) |
| Reviewed candidate per execution map | `hosted` Phloem with canonical `noesis-*` combos; `te-*` labels are compatibility input only |
| Cambium origin | `TBD-founder` (the production quests Worker origin; same value the Founder Gate CLI uses as `CAMBIUM_ORIGIN`) |

Phloem and the Clio door are distinct security boundaries whichever upstream
mode is chosen.

## 7. Port rule

- `:20130` is the Clio door. It is loopback-only on EC2 and is reached from
  outside only through the authenticated tunnel in §6.
- Hermes inference never uses `:20130`. The Hermes runner's inference base
  URL stays OmniRoute `:20128` (loopback) or hosted Phloem per its own
  config, never the relay.
- The relay never becomes the company worker `base_url`, a publisher, or
  Hermes' default (vault `execute-plan.md` Move 4, restated).
- E2 acceptance includes an external probe proving `20130` is not reachable
  from outside the host.

## 8. Unit and timer state at each step

| Unit | Before E2 (observed 2026-10-23) | After E2 | After E3 |
|---|---|---|---|
| Clio relay unit (name `TBD-founder`, expected `clio-relay.service`) | absent | installed, `disabled`, health answers on loopback | enabled only by a separate founder ask |
| `gate-consumer.timer` | inactive, mode unreconciled | unchanged | reconciled mode recorded here, then active |
| `hermes-runner.timer` | active | unchanged | unchanged |
| `omniroute.service` | active | unchanged | unchanged |
| `cloudflared-omniroute-ec2.service` | active | unchanged | unchanged |

Legacy ACK must not be enabled to work around missing execution proof.

## 9. Acceptance probes (E4)

All six must pass with receipts in vault `agent-outputs/`. A passing test
suite or a returned chat completion counts for none of them.

| # | Probe | Pass condition | Receipt |
|---|---|---|---|
| P1 | Authenticated employee stream | A real Plexus member on the selected realm opens a Clio stream through the relay; whoami resolves the member; an unauthenticated or wrong-realm session is refused | relay log line with member id hash, realm, no token |
| P2 | Admitted request | `POST /v1/bridge/growth/requests` from that member returns a stable `growth_<digest>` id; D1 has exactly one `bridge_growth_requests` row; pins match the §4 projection digest and source commit | D1 readback, request id |
| P3 | Hermes claim | The actual `hermes-runner.service` claims the `growth.request.draft` directive, validates pinned context and source digests, runs inference through its own OmniRoute door (not `:20130`), and attests a `thoughtseed.growth.result.v1` with `approvalState: draft`, `externalAction: none` | runner journal excerpt, attestation digest |
| P4 | Member-scoped receipt | The requesting member reads `draft_ready` with content and `sources[{path,digest}]` in Plexus | screenshot or readback with member id hash |
| P5 | Cross-member denial | A second active member of the same tenant reads the same request id and receives 404; an admin token receives 404 or 403 on the employee routes | two HTTP transcripts |
| P6 | Replay | The exact original request is re-POSTed under the same `requestId` and returns the original id with no new D1 row; the same `requestId` with altered `objective` conflicts | D1 row count before/after, conflict status |

Plus the port probe from §7 and a rollback rehearsal: disable the relay unit
and confirm Hermes drafting on existing paths is unaffected.

## 10. Rollback

- Relay: `systemctl disable --now` the unit; remove the tunnel route. No
  data to reverse; the relay holds no state.
- Worker: redeploy the §4 rollback version. `0011_growth_workflow.sql` is
  additive and stays applied.
- Capability: unset `GROWTH_WORKFLOW_TENANTS_JSON` to fail the routes closed
  without a redeploy.

## 11. What this manifest does not do

- It does not deploy, enable, bind, or set any value marked `TBD-founder`.
- It does not grant publication, canonical vault edits, payroll, client or
  external-messaging authority to any employee draft.
- It does not merge PR #391; that waits for the P1–P6 receipts (E5).
- It does not change edge Access policies or enroll a founder binding.

## References

- vault `20-operations/growth/department/execution-map.md` (2026-10-23 reconciliation; to add a pointer to this file under A1 or a follow-up)
- vault `20-operations/growth/department/execute-plan.md` Move 4 and anti-goals
- `docs/architecture/contracts/employee-growth-workflow-v1.md`
- `docs/architecture/contracts/founder-gate-cli-v1.md` (Access/whoami prerequisites reused by name)
- `workers/quests/src/growth-workflow.ts`
- `scripts/employee-growth-workerd-smoke.mjs` (local, synthetic; not acceptance)
