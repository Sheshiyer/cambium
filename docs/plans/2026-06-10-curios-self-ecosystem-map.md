# Quest Miniapp Ecosystem Map — Sanitized Pilot Lessons

Status: archived and sanitized during the standalone Cambium cleanup.

This file used to contain a live pilot ecosystem map. The map proved the quest
miniapp pattern, but the original version mixed product architecture with
company-specific bot identities, hostnames, storage buckets, local paths, and
operational topology. Cambium now keeps only the portable lessons in-repo.

## Portable Pattern

Cambium's quest miniapp can attach to any founder-approved command surface:

- A messaging channel gives founders a familiar control point.
- A Worker serves derived quest ledger envelopes from a non-secret store.
- The miniapp reads quests, the fractal map, and story beats.
- A founder gate queues approvals, rerolls, and handoff decisions.
- A local or hosted consumer executes approved writes through the operator.
- The operator folds the result back into world state and refreshes the ledger.

## Hard Boundaries

- The miniapp must not read private vaults, backups, exports, or raw operational
  memory.
- Serving storage holds derived non-secret ledgers only.
- Writes must go through a gate with founder identity validation.
- Adapters are optional and replaceable: messaging, project-feed, gateway,
  agent-plane, storage, model, and delivery providers are all implementation
  choices.
- Case-study deployments are evidence, not default configuration.

## Generic Runtime Inventory

| Adapter | Role | Product contract |
|---|---|---|
| Messaging channel | Founder control surface | optional; validates user identity before writes |
| Cambium Worker | Quest ledger + gate API | serves derived envelopes and queues gated actions |
| KV/document store | Non-secret serving store | no private vault or backup data |
| Gateway adapter | Agent/session feed | fail-soft narrative and handoff signals |
| Project-feed adapter | Project lifecycle feed | optional story beats and open work |
| Agent-plane bridge | Downstream execution plane | polls directives and acknowledges results |
| Cortex | Tenant memory | tenant-scoped semantic/structural recall |
| Model provider | Mining and synthesis | configured by environment, never checked in |

## Reference Flow

```text
founder opens miniapp
  -> Worker returns quest ledger + story envelope
  -> founder queues a gated action
  -> Worker validates identity and stores the action
  -> agent-plane consumer polls the directive
  -> operator folds the approved event
  -> quine refreshes evidence and pushes a new envelope
```

## Remaining Product Work

1. Document adapter contracts without provider-specific names.
2. Add synthetic demo fixtures for the Worker and gate flow.
3. Keep live case-study evidence outside release-facing defaults.
4. Expand `npm run standalone:audit` as new adapters land.
