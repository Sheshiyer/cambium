# LumenBar and Temperance department pilot

This source slice adds department facets and daily/monthly/quarterly views inside Cambium’s current 3D folio. It reuses the existing Goal Graph identities, org role references, Will desks, Taste composer and Cortex learning boundary. No new agent organization is registered.

## Reused organization

| Department facet | Existing profile reference | Selected cluster references |
| --- | --- | --- |
| Product & research | tsscientist | gsd-orchestrator, research-knowledge-orchestrator |
| Engineering | tsengineer | quality-eval-orchestrator |
| Design & experience | tsdesigner | design-orchestrator |
| Growth & content | tssynthesist | growth-content-orchestrator |
| Operations & reliability | default (tsceo display identity) | agentic-ops-orchestrator, quality-eval-orchestrator |
| Finance & governance | default; private cfoevidence/cfostrategy remain reference-only | agentic-ops-orchestrator |

These mappings are provisional source bindings. The org source is the dated October 8 proposal in thoughtseed-labs, not current runtime registry proof. A host must resolve admitted runtime assignments independently. The six Will desks remain desks: head-of-marketing, copywriter, creative-strategist, launch-lead, seo-lead and analyst. The existing growth-index reader already understands their cells; this pilot adds no vault crawler.

Canonical cluster IDs remain references resolved on demand. Selected Copywriter and Launch Lead categories carry existing copywriting, copy-editing and launch-strategy spoke IDs, SHA-256 content pins and library origin names. Other spokes remain on-demand/unresolved. The pilot installs no skills and does not change the founder-selected hot capabilities, launch pool, provider or model.

## Manual source projection

Node 26 can run the existing TypeScript modules directly:

```sh
npm run department:pilot -- --graph /absolute/path/graph-readback.json --out /absolute/path/new-pilot-packet.json
npm run department:pilot:test
```

The input is the existing `cambium.founder.bookkeeping-graph.v1` file readback. `--now` supports deterministic review; `--expected-head` permits a separately supplied frontier check. Without a fresh independent head read, the packet remains a dated supplied readback. The CLI records its input hash and never presents a file as a new live canonical receipt. Output uses exclusive creation and refuses to overwrite an existing file.

An optional `--eligibility` file has `{ "sourceRef": "accepted-GSD-reader-reference", "taskIds": ["existing-id"] }`. It is an explicit reader contract; arbitrary `metadata.approved=true`, a due date or a role reference is insufficient. No launch or execution authority follows from this selection.

Daily selection preserves supplied eligible order, holds stale/changed frontiers, invalid dates, unresolved ancestry, blocked tasks and missing mappings, and caps the view at five per product/department and ten globally. Explicit null dates are undated; malformed supplied dates are held. Monthly views show the unchanged existing dates. Quarterly review shows outcome questions and candidate-only Cortex learning. No milestones or numerical targets are invented.

## Host integration contract

`CuriousWorldBridge` adds two optional methods:

```ts
getDepartmentState?: () => DepartmentPilotReader | null;
subscribeDepartment?: (listener: () => void) => () => void;
```

`DepartmentPilotReader.input` supplies a bounded `PilotInput`: tenant, current clock, expected head, graph readback and optional accepted GSD eligibility. The folio recomputes its read-only projection on host notifications, selection and manual refresh. It owns no fetch, signer, timer or scheduler. Closing the folio disposes its subscription. An older host displays an explicit reader-unavailable message.

A host may supply separately sourced `KpiObservation[]`. Each observation must match the frozen definition version, product, cohort and monthly window, include provenance, have a valid nonzero denominator and remain within its freshness threshold. Conflicting observations remain unavailable until the reader selects a revision. Reporting a measured ratio does not accept a target or declare success. LumenBar receives no telemetry.

For Taste, call existing `prepareTasteContext(intent, target, scopedHits)`; it delegates to `workers/cortex-mcp/src/taste-compose.ts`. Pass only its bounded lineage into the folio. It does not fetch or copy a Taste corpus. `learningCandidate` creates a product/department proposal with evidence, evaluation and rollback references, following the Cortex candidate lane; it grants no memory write and performs no promotion. Missing Taste/KPI sources stay unavailable.

## Boundaries and next integration

`classifyPilotChange` permits automatic **read-only** view refresh, deduplication, eligible selection and draft learning. All canonical writes, goal/target changes, launch-slot or copy changes, budgets, permissions, publication, deployment and skill promotion remain with the existing HITL owner. There is no new standing-policy acceptance, D1 writer, lease, runtime admission, recurring job, resident organ or hook.

MISSION.md still describes a v0.4 horizon. Existing approved product records can be classified; a new departmental objective cascade needs mission review. Long-term questions are explicitly candidates, not accepted department missions or quantitative KPIs.

This branch does not reconcile the unmerged production founder host into maintained main. The authenticated host reader, owned persistence/CAS policy evaluation, actual runtime registry resolution, measured KPI adapters and admitted cadence activation remain separate integration work. The source pilot is locally reviewable without changing the live founder graph, retired 2D removal, social schedules or publication receipts.

See [PLAN.md](PLAN.md) for acceptance criteria and [VERIFICATION.md](VERIFICATION.md) for this slice’s evidence.

## Live integration continuation

The optional authenticated host is now implemented as a review candidate. See [LIVE-INTEGRATION.md](LIVE-INTEGRATION.md) for maintained/serving reconciliation, owner-reader validation, actual unavailable GSD/KPI sources, authenticated candidate proof, release delta and rollback. Production promotion remains separately held. Earlier source-pilot limits above describe the original slice.
