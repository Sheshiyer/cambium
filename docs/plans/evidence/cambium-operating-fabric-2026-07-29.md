# Cambium Operating Fabric Pre-Activation Baseline Receipt

Lifecycle: current T-028 evidence. This path is retained because issue #331
assigns `docs/plans/evidence/cambium-operating-fabric-2026-07-29.md` as the
sole owner for the production-baseline receipt. It supersedes the older July
29 promotion packet that no longer matched the terminal validation task.

Evidence date: 2026-08-16
Repository head reviewed: `111c5f9423edd9878212627d20e268304a6acc31`
Task scope: T-028 only — record the reproducible pre-activation `403` and
ledger/workbench baseline without any deployment, provider, tenant, or
credential mutation.

## Red/current gap

Before this update, the owned evidence file still held a local July 29
promotion-readiness packet. T-028 remained open because no checked-in receipt
captured the current pre-activation baseline as one reproducible fact set with
an exact digest.

## Source set

This receipt is derived only from read-only inputs:

- Live unauthenticated GET probes on 2026-08-16 against the current direct
  Worker origin `https://cambium-quests.thoughtseedlabs.workers.dev`
- Live unauthenticated GET probes on 2026-08-16 against the current custom
  domain `https://curious.thoughtseed.space`
- Checked-in authenticated read-only receipt
  [docs/evidence/2026-08-13-portfolio-tg-flow-linkage.v1.json](../../evidence/2026-08-13-portfolio-tg-flow-linkage.v1.json)
- Checked-in direct-origin baseline receipt
  [docs/evidence/2026-08-14-gate-descriptor-inert-candidate-upload.v1.json](../../evidence/2026-08-14-gate-descriptor-inert-candidate-upload.v1.json)

No raw Telegram `initData`, Cloudflare Access token, provider credential, or
founder identifier is copied into this document. Only statuses, counts, and
SHA-256 digests are recorded.

## Live direct-origin baseline

Observation window (UTC): `2026-08-16T16:59:23Z` through
`2026-08-16T16:59:25Z`

| Surface | Status | Body SHA-256 | Notes |
| --- | --- | --- | --- |
| `GET /healthz` | `200` | `97c166cbf5a83f38be0ed99af0888f0da6b19626d231d609806af18724738b4c` | Healthy Worker probe |
| `GET /api/quests/cambium` | `401` | `2dfe068f35e60a0ce66019274b6f9d7c5d76e0fcc572501c65ec40eaf1f97039` | Fail-closed Access identity requirement |
| `GET /admin/portfolio/web` | `401` | `a42e4ca2d4c4b985ffdb51e157cffdd9ea199ae7a1583d9e96ba042e5ef43edd` | Read-only founder-workbench gate remains closed without identity |
| `GET /v1/mission-fabric/cambium` | `403` | `df6a299f55612ab5ff8f8895f5c90007f924795b0bf6f08bfad88c29173c95a3` | Exact pre-activation baseline: `mission fabric tenant is not enabled` |

Captured response bodies:

- `/healthz` → `{"ok":true,"worker":"cambium-quests"}`
- `/api/quests/cambium` → `{"error":"access_identity_required","message":"A verified Cloudflare Access identity is required."}`
- `/admin/portfolio/web` → bounded static `Portfolio access required` HTML gate
- `/v1/mission-fabric/cambium` → `{"error":"mission fabric tenant is not enabled"}`

## Live custom-domain unauthenticated baseline

The production custom domain remains behind Cloudflare Access when probed
without credentials on 2026-08-16:

| Surface | Status | Boundary |
| --- | --- | --- |
| `GET https://curious.thoughtseed.space/healthz` | `302` | Cloudflare Access login redirect |
| `GET https://curious.thoughtseed.space/v1/mission-fabric/cambium` | `302` | Cloudflare Access login redirect |

This confirms there is no public custom-domain bypass around the closed
activation state.

## Authenticated read-only ledger/workbench baseline

The latest checked-in authenticated read-only receipt remains:

- Receipt:
  [docs/evidence/2026-08-13-portfolio-tg-flow-linkage.v1.json](../../evidence/2026-08-13-portfolio-tg-flow-linkage.v1.json)
- Surface: `/admin/portfolio/web`
- `founderWorkbenchVisible: true`
- `renderedActiveWorkObjects: 71`
- `consoleWarnings: 0`
- `consoleErrors: 0`
- `serverActionsInvoked: 0`

This is the authenticated read-only ledger/workbench baseline carried forward
into T-028. It proves that authenticated visibility exists without any durable
action execution.

## Checked-in direct-origin parity source

The checked-in 2026-08-14 direct-origin receipt still matches the live
pre-activation shape:

```json
{
  "/healthz": 200,
  "/api/quests/cambium": 401,
  "/v1/admin/portfolio": 401,
  "/admin/portfolio/web": 401,
  "/v1/mission-fabric/cambium": 403
}
```

Source:
[docs/evidence/2026-08-14-gate-descriptor-inert-candidate-upload.v1.json](../../evidence/2026-08-14-gate-descriptor-inert-candidate-upload.v1.json)

## Canonical normalized receipt and digest

Canonical normalized JSON:

```json
{"authenticatedReadOnlyWorkbench":{"consoleErrors":0,"consoleWarnings":0,"founderWorkbenchVisible":true,"receipt":"docs/evidence/2026-08-13-portfolio-tg-flow-linkage.v1.json","renderedActiveWorkObjects":71,"serverActionsInvoked":0,"surface":"/admin/portfolio/web"},"baselineVerdict":"pre-activation closed; authenticated ledger/workbench remains read-only","checkedInDirectOriginBaseline":{"probes":{"/admin/portfolio/web":401,"/api/quests/cambium":401,"/healthz":200,"/v1/admin/portfolio":401,"/v1/mission-fabric/cambium":403},"receipt":"docs/evidence/2026-08-14-gate-descriptor-inert-candidate-upload.v1.json"},"directOrigin":"https://cambium-quests.thoughtseedlabs.workers.dev","liveCustomDomainUnauthenticatedGet":{"https://curious.thoughtseed.space/healthz":{"cloudflareAccessRedirect":true,"status":302},"https://curious.thoughtseed.space/v1/mission-fabric/cambium":{"cloudflareAccessRedirect":true,"status":302}},"liveDirectOriginGet":{"/admin/portfolio/web":{"bodySha256":"a42e4ca2d4c4b985ffdb51e157cffdd9ea199ae7a1583d9e96ba042e5ef43edd","status":401},"/api/quests/cambium":{"bodySha256":"2dfe068f35e60a0ce66019274b6f9d7c5d76e0fcc572501c65ec40eaf1f97039","status":401},"/healthz":{"bodySha256":"97c166cbf5a83f38be0ed99af0888f0da6b19626d231d609806af18724738b4c","status":200},"/v1/mission-fabric/cambium":{"bodySha256":"df6a299f55612ab5ff8f8895f5c90007f924795b0bf6f08bfad88c29173c95a3","status":403}},"observedAtUtc":"2026-08-16T16:59:25Z","repoHead":"111c5f9423edd9878212627d20e268304a6acc31","schema":"cambium.operating-fabric.pre-activation-baseline.v1"}
```

Verified SHA-256 of the exact JSON above:

- `23ad193fbad07b0d5b8c7d012e6c55d380568bf43ee4eba7cdcdc6c15ed46f3a`

Reproduction command:

```bash
jq -n -cS '{
  schema:"cambium.operating-fabric.pre-activation-baseline.v1",
  observedAtUtc:"2026-08-16T16:59:25Z",
  repoHead:"111c5f9423edd9878212627d20e268304a6acc31",
  directOrigin:"https://cambium-quests.thoughtseedlabs.workers.dev",
  liveDirectOriginGet:{
    "/healthz":{status:200,bodySha256:"97c166cbf5a83f38be0ed99af0888f0da6b19626d231d609806af18724738b4c"},
    "/api/quests/cambium":{status:401,bodySha256:"2dfe068f35e60a0ce66019274b6f9d7c5d76e0fcc572501c65ec40eaf1f97039"},
    "/admin/portfolio/web":{status:401,bodySha256:"a42e4ca2d4c4b985ffdb51e157cffdd9ea199ae7a1583d9e96ba042e5ef43edd"},
    "/v1/mission-fabric/cambium":{status:403,bodySha256:"df6a299f55612ab5ff8f8895f5c90007f924795b0bf6f08bfad88c29173c95a3"}
  },
  liveCustomDomainUnauthenticatedGet:{
    "https://curious.thoughtseed.space/healthz":{status:302,cloudflareAccessRedirect:true},
    "https://curious.thoughtseed.space/v1/mission-fabric/cambium":{status:302,cloudflareAccessRedirect:true}
  },
  authenticatedReadOnlyWorkbench:{
    receipt:"docs/evidence/2026-08-13-portfolio-tg-flow-linkage.v1.json",
    surface:"/admin/portfolio/web",
    founderWorkbenchVisible:true,
    renderedActiveWorkObjects:71,
    consoleWarnings:0,
    consoleErrors:0,
    serverActionsInvoked:0
  },
  checkedInDirectOriginBaseline:{
    receipt:"docs/evidence/2026-08-14-gate-descriptor-inert-candidate-upload.v1.json",
    probes:{
      "/healthz":200,
      "/api/quests/cambium":401,
      "/v1/admin/portfolio":401,
      "/admin/portfolio/web":401,
      "/v1/mission-fabric/cambium":403
    }
  },
  baselineVerdict:"pre-activation closed; authenticated ledger/workbench remains read-only"
}' | shasum -a 256
```

## Acceptance result

T-028 is satisfied by this receipt:

- the pre-activation Mission Fabric route is reproducibly closed with a live
  `403` and a verified body digest;
- the unauthenticated direct-origin and custom-domain baselines are explicit;
- the authenticated workbench/ledger baseline is read-only and source-backed;
- one canonical normalized receipt now has a checked-in SHA-256.

## Authority boundary

No deployment, tenant activation, allowlist change, Worker version mutation,
provider write, credential use, or authenticated live founder session was
performed for this receipt. A fresh authenticated live workbench replay would
require separate session authority, but it is not required to close this
pre-activation baseline task because the current authenticated read-only facts
are already recorded in the checked-in 2026-08-13 receipt referenced above.
