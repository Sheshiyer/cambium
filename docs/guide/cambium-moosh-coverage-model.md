# Cambium Moosh truth-tiered coverage model

This is the canonical coverage contract for explaining Cambium through the
`product-guides` Moosh workflow. It corrects the earlier single-route capture
model: Cambium is not one console, and no single screenshot or projection can
represent the whole operating spine.

The machine-readable version is
[`cambium-moosh-coverage-model.json`](cambium-moosh-coverage-model.json). The
surface list and its dated readiness snapshot stay in
[`cambium-surface-inventory.json`](cambium-surface-inventory.json) and
[`cambium-moosh-coverage.json`](cambium-moosh-coverage.json).

## One-line model

Every surface has exactly one **UI evidence lane** and exactly one
**connected-system evidence lane**. A UI artifact proves what was rendered; a
request/response proves what that endpoint returned; neither proves execution.
Projections are read models and are never execution authority.

## Authority tiers

| Tier | Name | Authorizes | Does not authorize | Must label |
| --- | --- | --- | --- | --- |
| `T0-reference` | Reference / declared intent | explanation, preparation, local read-only inspection | capture, execution, deployment, provider mutation, operational writes | source path, version, freshness timestamp |
| `T1-observed` | Observed local evidence | bounded local explanation and validation | hosted, connected, or authenticated runtime claims | exact command/output, route, or artifact hash |
| `T2-connected` | Connected request/response | a claim about that exact endpoint response | UI interpretation of the response, downstream state, or writes | status, headers, bounded body, timestamp, credential boundary |
| `T3-execution` | Execution / write authority | only the exact admitted operational action | a prior projection, plan, request, or UI state | admitted task, gate receipt, rollback/discard path, terminal receipt |

The tier is the ceiling. Rendering a `T0` projection in a browser does not
make it `T2`. A `T2` response does not become `T3` because a UI displays a
green checkmark. A mapped planning wave stays below execution evidence.

## Evidence lanes

| Lane | Name | Proves | Does not prove | Probe |
| --- | --- | --- | --- | --- |
| `L1-documentation` | Documentation contract | a reviewed contract exists at the named source | runtime behavior, live deployment, UI rendering, execution | `rg` against source, JSON parse |
| `L2-terminal` | Local terminal verification | local tests, validators, or CLI contracts exited as recorded | hosted, connected, deployed, or browser-rendered behavior | declared `package.json`/`PROJECT.md` command |
| `L3-request-response` | Live request/response evidence | the named endpoint returned the recorded status, headers, and bounded body | the consuming UI, downstream writes, semantic acceptance | `curl -i` or authenticated client |
| `L4-ui-screenshot` | Captured UI evidence | the named surface rendered the captured pixels at that viewport/time | backend success, connected liveness, or projection authority | approved Playwright capture |
| `L5-boundary-map` | Boundary map only | the repository documents the connected system's ownership and handoff | reachability, authentication, or any action by that system | source/contract `rg` |
| `L6-video` | Composed video evidence | accepted guide evidence was assembled into bounded motion | any claim beyond the accepted guide evidence | FilmSpec + accepted guide evidence + composition approval |
| `L7-approval` | Approval receipt | an owner issued a matching bounded approval | the approved operation was requested, ran, or succeeded | `approval_id` against governing receipt |
| `L8-request` | Request-only evidence | a typed, idempotent request was submitted and acknowledged | workers, capture tools, providers, or runtime effects launched | typed POST + response envelope, zero side effects |

`L6` cannot appear before `L4`/`L3` evidence for the underlying claims.
`L7` and `L8` are ordering evidence, not completion evidence.

## Invariants

1. **UI evidence is visual only.** A screenshot proves rendering at a time, not
   that a Worker, D1, KV, R2, Vectorize, Hermes, Plexus, Cortex, Explee, or CI
   system is live or correct.
2. **Request/response evidence is boundary-only.** A `curl` proves that exact
   response; it does not prove the UI that consumes it, the write it proposes,
   or the connected system behind an adjacent adapter.
3. **Projections are never authority.** Mission Fabric, the Manifest bridge,
   Cartographer, branch maps, and planning waves are read models. They can
   describe a proposed action, never admit or execute it.
4. **Approval, request, and execution are distinct.** A receipt is not a
   request; a request is not a run; a run is not a deployment.
5. **Boundary-map mode is the honest default for connected systems.** Until an
   owner-authenticated probe exists, describe ownership and handoff only.
6. **Local is not hosted.** `bundle.html` preview is not `/admin/portfolio`
   Founder Gate evidence. R3F synthetic fallback is not Worker data.
7. **Synthetic data must be labeled synthetic.** A fixture proves a renderer,
   not the production source shape.
8. **Video derives from accepted guide evidence.** Motion cannot fill a
   missing still, response, or approval gap.

## Coverage matrix

### UI surfaces

| Surface | UI lane | System lane | Authority | Does not prove |
| --- | --- | --- | --- | --- |
| Manifest console | `L4-ui-screenshot` | `L3-request-response` | `T0-reference` | capture or worker execution |
| R3F web | `L4-ui-screenshot` | `L2-terminal`; optional `L3-request-response` when the in-app Worker URL is configured and a live response is recorded | `T1-observed` | live Worker or connected-store truth |
| R3F Electron | `L4-ui-screenshot` | `L2-terminal` | `T1-observed` | browser/web or hosted runtime parity |
| Cartographer hosted Workbench | `L4-ui-screenshot` | `L3-request-response` | `T2-connected` | Goal Graph writes or executed closeout/intake |
| Cartographer local preview | `L4-ui-screenshot` | `L2-terminal` | `T1-observed` | hosted auth, actions, or production state |
| Mini App legacy scenes | `L4-ui-screenshot` | `L3-request-response` | `T2-connected` | signed Gate actions or Hermes delivery |
| Operating Fabric | `L4-ui-screenshot` | `L3-request-response` | `T2-connected` | Goal Graph admission or signed execution |

### Service, operator, and connected boundaries

| Surface | UI lane | System lane | Authority | Does not prove |
| --- | --- | --- | --- | --- |
| Quests read model | `L1-documentation` | `L3-request-response` | `T2-connected` | UI rendering, deployment, provider behavior |
| Operator CLI | `L1-documentation` | `L2-terminal` | `T1-observed` | hosted or connected system state |
| Hermes transport | `L1-documentation` | `L5-boundary-map` | `T3-execution` | local acceptance or a delivered artifact |
| Plexus identity | `L1-documentation` | `L5-boundary-map`; optional `L3-request-response` with authenticated principal/role evidence | `T2-connected` | product content identity or Goal Graph authority |
| Cloudflare runtime | `L1-documentation` | `L5-boundary-map`; optional `L3-request-response` for deployment/binding/version readback only | `T3-execution` | any local UI or connected-provider behavior |
| Cortex memory | `L1-documentation` | `L5-boundary-map`; optional `L3-request-response` for bounded tenant-scoped recall/health | `T2-connected` | product identity, intent, or Goal Graph writes |
| Explee IVerif | `L1-documentation` | `L5-boundary-map`; optional `L3-request-response` for GET-only observer read | `T2-connected` | mutation, campaign authority, or execution |
| GitHub/Cloudflare CI | `L1-documentation` | `L2-terminal` | `T3-execution` | owner-approved production deployment |
| MCP/AWS | `L1-documentation` | `L5-boundary-map` | `T3-execution` | product identity or local acceptance |

The complete per-surface entries live in
[`cambium-moosh-coverage-model.json`](cambium-moosh-coverage-model.json).

## Evidence precedence

For a given surface, prefer the highest honest tier available:

1. `T3` only when an admitted task and terminal receipt exist.
2. `T2` only when an exact, recorded endpoint response exists.
3. `T1` when a local command, test, or artifact check exists.
4. `T0` otherwise, with the source and freshness stated.

Never fill a higher tier with a lower-tier artifact. If the prerequisite is
unavailable, record the surface as `deferred` with a named follow-up. That is
more truthful than checking the criterion by inspection.

## Truth upgrade path

```text
T0 reference ──read/validate──▶ T1 observed
T1 observed ──live endpoint──▶ T2 connected
T2 connected ──admitted task + approval + terminal receipt──▶ T3 execution
```

`T3` is the only tier that describes operational writes, deployment, delivery,
or provider mutation. Moosh normally stops at `T0`/`T1`/`T2` evidence
preparation and reports the `T3` gate without claiming it.

## Acceptance checks

The current contract is considered locally valid when all of these hold:

- the coverage model JSON parses and has one entry for every surface in
  `cambium-surface-inventory.json`;
- every entry names a `ui_evidence`, `system_evidence`, `authority`,
  `does_not_prove`, and `live_probe`;
- no entry asserts a lane/tier above the probe it names;
- no `T0` or `T1` entry is marked execution-eligible;
- the runbook, capability map, and guide reference this model as the
  canonical evidence separator.

## Handoff boundary

This model is repository-local documentation and preparation. It does not
authorize capture, hosted access, worker dispatch, deployment, registry
mutation, provider action, or public claims. Those remain separate
owner-approved gates with their own receipts and rollback paths.
