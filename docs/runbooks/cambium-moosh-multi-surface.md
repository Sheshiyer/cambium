# Cambium Moosh multi-surface runbook

This is the current operator procedure for explaining and preparing Moosh
coverage across Cambium. It is intentionally request-oriented: preparation,
validation, and reporting are local; capture, hosted access, deployment, and
worker launch remain approval-gated.

## Read first

1. Read [`../LIFECYCLE.md`](../LIFECYCLE.md), the root [`../../ISA.md`](../../ISA.md), and the current checkpoint in [`../../.project/HANDOFF.md`](../../.project/HANDOFF.md).
2. Read the [deep capability map](../guide/cambium-system-capability-map.md).
3. Read the machine-readable [surface inventory](../guide/cambium-surface-inventory.json), the [stage coverage contract](../guide/cambium-moosh-coverage.json), and the [truth-tiered coverage model](../guide/cambium-moosh-coverage-model.md).
4. Re-read the Manifest workflow projection before requesting anything.

## State model

| State | Meaning | Allowed operation |
| --- | --- | --- |
| Observed | Registry, routes, docs, or health were read | Explain and map |
| Prepared | Local guide/config/FilmSpec contracts validate | Review and request |
| Approved | A matching bounded `approval_id` exists | Request the next governed stage |
| Captured | Evidence exists for the named surface | Compose or report |
| Delivered | An owner-approved output was published | Handoff and learn |

Planning and a mapped swarm are not execution. A request-only workflow does
not launch workers, open provider sessions, capture screenshots, or mutate
runtime state.

## Bounded preparation

From the repository root, the safe local checks are:

```bash
npm test
npm run validate
npm run render-docs:check
node -e "JSON.parse(require('fs').readFileSync('docs/guide/cambium-surface-inventory.json','utf8')); JSON.parse(require('fs').readFileSync('docs/guide/cambium-moosh-coverage.json','utf8')); console.log('coverage JSON valid')"
temperance-manifest doctor --json
```

The exact available scripts remain authoritative in `package.json` and
`PROJECT.md`; do not copy a historical command from `docs/plans/` into an
operator action without checking those files.

## Surface order

Use breadth first, then depth:

1. Manifest console: establish cluster, skill, stage, and blocker truth.
2. R3F web and Electron: explain the visual engine as two shells over one
   visual product surface.
3. Cartographer local preview and hosted Workbench: separate read-only
   inspection from authenticated Founder Gate actions.
4. Legacy Mini App and Operating Fabric: cover both the compatibility scenes
   and the Canopy/Mission/Flow/Workforce/Forge operating model.
5. Quests API/read model and CLI: prove contracts and local validation with
   terminal evidence rather than pretending services are browser pages.
6. Hermes, Plexus, Cloudflare, Cortex, Explee, GitHub/CI, and MCP/AWS:
   document authority and handoffs as connected boundaries.

## Capture request gate

Before a capture request is even eligible, the operator must have:

- a bounded `request_id`;
- an existing matching `approval_id`;
- an explicit list of surface IDs and routes;
- a declared evidence type per surface;
- no arbitrary command, checkout path, secret, prompt body, or implicit worker
  instruction in the request;
- a rollback or discard path for any generated artifact.

If any condition is missing, keep the trigger disabled and report the blocker.
Do not manufacture an approval receipt from a plan, a prior session, or a
browser tab.

## Evidence discipline

- Read each surface's lane from the coverage model first; do not let a UI
  capture stand in for request/response or execution evidence.
- Use `L3-request-response` evidence for projections and APIs; use
  `L2-terminal` for tests, validators, and CLI contracts.
- Use `L4-ui-screenshot` only after the surface is live and capture is
  approved; label synthetic fixtures as fixtures, not production data.
- Use `L6-video` only after guide evidence is accepted and the FilmSpec is
  bounded; motion cannot fill a missing still or response.
- Mark unavailable probes as pending or deferred with a named follow-up, never
  as successful because the code appears complete.

## Stop conditions

Stop before execution when the Manifest reports no matching approval receipt,
when a browser attachment is unavailable for a screenshot-required claim, or
when a protected surface requires credentials outside this repository. Those
are truthful gates, not failures of the explanatory workflow.
