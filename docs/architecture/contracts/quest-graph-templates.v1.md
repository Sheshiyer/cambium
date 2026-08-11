# Quest graph templates v1

Schema: `cambium.quest-graph-templates.v1`  
Implementation: [`shared/quest-graph-templates.ts`](../../../shared/quest-graph-templates.ts)  
Source arcs: [`QUESTLOG.md`](../../../QUESTLOG.md) I–VII · `bin/operator/quests/quests.ts`

## Purpose

Formalize tutorial quest arcs **I–VII** as Goal Graph **templates** — nodes, edges,
specialties, and exit predicates — **without live D1 writes**.

`compileQuestGraphAdmissionProposal()` emits
`cambium.quest-graph-admission-proposal.v1` which always carries:

```json
{ "writesGoalGraph": false, "requires": ["founder-gate", "d1-cas"] }
```

## Forms

| Arc | questId | Form |
|---|---|---|
| I | the-calling | loop |
| II | first-mint | loop |
| III | taste-resonance | loop |
| IV | the-loop | loop (micro/meso/macro nodes) |
| V | viability | loop |
| VI | memory | loop |
| VII | many-gardens | **graph** (multi-tenant) |

## Non-goals

- Not a stored quest tracker (QUESTLOG pure-fold remains authoritative for display)
- Not automatic admission of templates into D1
- Arcs VIII+ (Paperclip / delivery) stay outside this pack until separately versioned
