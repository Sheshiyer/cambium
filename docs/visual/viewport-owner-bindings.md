# Viewport owner bindings

VPG-01 freezes source owners for the eight later behavior groups. These are
source contracts, not evidence of a fresh authenticated owner or a live device.
The accepted finite packet is under `.planning/viewport-proof-20261104/remaining-behaviors/`.
Only VPG-01 is admitted. Version 95 remains the planning baseline; deployment,
traffic and real owner writes remain held.

| Group | Existing owner and envelope/schema | Read or action authority | Unavailable-state obligation |
| --- | --- | --- | --- |
| VPG-02 Mission, branches and proof | `mission-fabric.ts` and `handler.ts`: `/v1/mission-fabric/{tenant}`, `cambium.mission-fabric-projection.v1`; quest `ledger`, `branchStories`, `branchLoops` and `branchMap` preserve their recorded source. Current `mission-dossier.ts` is the presentation analog. | Existing Worker viewer authorization and Telegram read context; the separate `/founder` page owns Access-authenticated reads. Mission exploration grants no planning, dispatch or progress authority. | Missing source, branch identity, proof, freshness or projection is a visible held capability. Future adapter must preserve the exact WorkObject and original whole-step predicates. |
| VPG-03 Story and Tools/Handoff | Shared `scenes/story.ts` parses `beats` with `storyProjection.schema=cambium.story-event-projection.v1`; `StoryEventContract` binds event/WorkObject/source/time/receipt. Shared `scenes/tools.ts` parses `commands:ToolsCommandProjection` with exact status/services/agents/activeWork/handoffs panels and source/freshness. `docs/architecture/contracts/scenes/{story,tools}.json` names the quest fields. | Existing quest reads; Handoff review retains the existing signed Gate kind and exact subject/idempotency/payload from `client/signed-action.ts` and `/api/gate/{tenant}`. Non-goal actions require existing Telegram validation, never a goal approval substitute. | Missing event identity/receipt or typed panel/freshness stays missing or stale. Missing current 3D Handoff adapter blocks VPG-03; no renderer or new owner is restored. |
| VPG-04 Proof, system, tapestry, policy and readiness | Existing quest-envelope fields read by historical `scenes/inspect.ts`: `ledger`, `wake`, `senses`, `lanes`, `stance`, `policy`, `decisionContext`, `liveProof` and `insights`. Their scene contract is `tg-miniapp-scene/v1` in `docs/architecture/contracts/scenes/inspect.json`; do not invent one new common runtime schema for these distinct projections. | Existing Worker-normalized quest reads and each served field's source/time; source proof, live-proof readiness and actual execution remain distinct. | Absent policy/proof/runtime data stays explicitly unavailable or blocked. Fourteen original tapestry targets and exact proof controls need their current 3D adapter in VPG-04. |
| VPG-05 Skill and actor relationships | Quest `skills.rows` with registry source/path and promotion evidence; `npc.relationships` with stage/events/history/advice/source, consumed by `skillCards`/`npcCards` in historical Inspect. Exact existing field contracts remain owned by their source producers, not by cosmetic traveler selection. | Read-only source projections; promotion reuses the existing Telegram-signed `promote-skill` Gate kind and owner validation. | No telemetry, registry proof, relationship stage or durable event means a missing/blocked result. No implicit activation or fabricated companion progress. Current adapters remain VPG-05 work. |
| VPG-06 ActionRequest identity | `action-requests.ts`: `thoughtseed.action-request.v1` and `thoughtseed.action-request-list-item.v1` in quest `actionRequests`; existing owner binds tenant/id/selected option/source/status/receipts. | Existing quest/Gate reads; no action on inspection. Exact same request must survive Gate, Story and Inspect. | Missing/foreign/stale request or selected option remains held. Pending, queued, consumed and completed are distinct. |
| VPG-07 Signed ActionRequest lifecycle | `handler.ts` `/api/gate/{tenant}` `confirm-action-request` → `confirmSignedActionRequestRecord` in `action-requests.ts`. Payload: kind, subject/actionRequestId, optionId, idempotencyKey, evidence/consequence/reversibility and host-owned Telegram initData. Tenant and founder identity come from the existing route and verified signer. | Telegram-signed non-goal owner only. Current `CuriousGateBridge.sign` and `GateKind` are goal-only; `CuriousReadBridge` is display-only and maintained `world-host.ts` omits historical `CLIENT_SIGNED_ACTION`. VPG-07 owns its separate typed adapter inside the existing page Gate transport and component/mount wiring. | Missing signer, exact owner context, identity/freshness or original-status read blocks confirmation. Request-sent precedes settlement; uncertain outcomes require original-status readback and no duplicate submit. A queue receipt never proves consumption/completion. |
| VPG-08 Reroll | Existing Telegram Gate `reroll` kind in `handler.ts` and original preflight semantics in `client/signed-action.ts`; exact subject, evidence, consequence/reversibility and idempotency remain required. | Existing Telegram verification and Worker queue owner. No non-goal Access signing or goal-kind cast. | Missing exact source candidate or signer blocks reroll. Preflight/cancel are distinct from an actual signature or queued result. |
| VPG-09 Portfolio and organ plan | `portfolio-catalog.ts`: `cambium.portfolio-catalog.v1`, `cambium.portfolio-display-catalog.v1`, `cambium.portfolio-action-authority.v1`; existing mission-fabric response includes `portfolioCatalog`, summaries and `organUpdateDelivery`. `shared/portfolio-catalog-authority.ts` owns catalog authority. | Existing server-owned viewer/catalog projection and organ-update plan identity; read-only in this package. Historical operating-fabric modules are semantic reference only. | Missing authority, stale catalog or incomplete organ plan stays held. Original 4-zone/93-card and 5-organ fixture counts describe synthetic input only; never substitute the historical 132-node graph or assert live counts. |

## Fixture and proof boundaries

`scripts/field-atlas-founder-fixture.mjs` remains byte-identical and read-only:
goal decision and renewal POSTs are hard denied. All old 44 case counters remain
unchanged. The separate `field-atlas-operational-fixture.mjs` is a passive,
explicitly injected loopback synthetic ActionRequest owner. It never fetches,
signs, stores, authenticates or contacts an owner. It binds an exact HTTP
127.0.0.1 origin and checks origin/Host/peer, method, route and exact closed body
before a transition. Its fixture-only version/digest/freshness envelope is not a
new backend fence or authentication channel. Normal Access/guest sessions cannot
select it through a query parameter unless the local harness was explicitly
given that fixture object. Wrong/expired context and duplicate confirmation fail
closed; one held response exposes request-sent before an explicit synthetic
settlement. Its counters are source-test receipts, never live acceptance.

All 47 historical steps, PNGs and manifest bytes are checked through the existing
`validateRetainedAssertions` implementation. All 43 retained intents remain
required, with the same four gallery retirements. VPG-01 adds only four
430×844 full-frame supplements, retaining the 430×932 cases. Existing 11
equivalents remain registered exactly as before; no row is newly qualified.

Observed crop receipts bind actual CSS/visual viewport, visible clip bounds,
device scale and actual PNG dimensions/bytes/hash. They cannot exempt text,
hit-testing or full-frame checks. No clipped gap journey is introduced in VPG-01;
later packages must bind their original clip selector to an explicit current
dialog selector and independently prove every original predicate.
