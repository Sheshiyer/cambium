# Cambium — the system behind the sourcebook

This sourcebook describes Cambium’s documented operating architecture, source implementations and visual system as reviewed on 27 September 2026. Doctrine, source implementation, local verification, observed runtime and human acceptance are different evidence levels. Current deployment and runtime acceptance require separate evidence; this is not a live infrastructure audit.

## The goal
Cambium coordinates finite work so ventures can continue meaningful participation, learning and renewal. A brand run, a build, a campaign or a delivery must have an owner, inputs, outputs, bounds, evidence and a stopping condition. The continuing operator chooses the next finite game; it does not keep all agents running forever. Dormancy between useful events is healthy. Revenue and growth are fuel and evidence. Solvency, consent, capacity and mission coherence constrain the next move.

## Two organ families
Cambium's five finite composition organs are Genesis, Taste, Hands, Will and Cortex. Temperance's six cognitive organs are Vestibule, Adytum, Nutrix, Auspex, Circulator and Praeceptor. They serve related but different responsibilities. A visual connection does not merge their authority. Cortex preserves and retrieves venture evidence; Nutrix distills session learning. Vestibule orients; Adytum synthesizes a bounded suggestion. Taste evaluates product quality; Auspex assesses substrate health. Circulator summarizes patterns; Praeceptor proposes capability changes. Each distinction prevents one convenient component from quietly taking over another's decisions.

## The six authority planes
| Plane | Owns | Cannot silently become |
|---|---|---|
| Portfolio | Exact WorkObject identity, repository roots, provenance | A live task assignment |
| Planning | Reviewed packets, missions, target KPIs, organ hints | Achieved metrics or admitted execution |
| Operational | Versioned D1 Goal Graph intent, approvals and tasks | Narrative authorship |
| Projection | Tenant-scoped Mission Fabric read model, freshness and gaps | Another operational writer |
| Execution | Admitted directives, pinned loadouts, runs and terminal results | Authority to rewrite intent |
| Evidence | Receipts, source-linked learning and next-intent proposals | Automatic approval or promotion |

The invariant is one canonical identity → reviewed intent → admitted task → pinned loadout → execution lineage → immutable evidence → bounded next proposal. Only a signed Gate plus the current graph version and D1 compare-and-swap can apply the appropriate operational change. Aliases help discovery but do not grant identity.

## Four clocks that must not be confused
Vision is the near-invariant cause. Repository Mission is the renewable doctrine horizon. ISA records approved goals and acceptance. GSD records finite delivery planning. A FabricMission is a bounded child inside a WorkObject, not the repository Mission. The reviewed root Mission still names the v0.4 horizon while planning names v0.5 consolidation; this is a visible renewal question, not license for an explainer to rewrite doctrine.

## Evidence language
“Source-backed” means a named source supports the explanation. “Local” requires actual repository implementation or bounded local checks. “Production” requires observed deployed behavior through the governed path. “Historical” is dated evidence. “Illustrative” is a teaching scenario or generated image. “Held” names a missing prerequisite. “Unverified” names a seam not checked here. Never turn counts of files, reachable services, selected images or completed generation jobs into universal system health.

## Root reading map
VISION and MISSION anchor purpose. ARCHITECTURE and INTEGRATION define the operating planes and their joins. INFINITE-GAME supplies supporting theory. HOMEOSTASIS limits claims about drift and convergence. QUESTLOG and ONBOARDING-OCTALYSIS define evidence-led progress. BUSINESS-MODEL describes the free-composition/paid-capability economic thesis, not measured business success. README introduces implemented surfaces. VERSIONS supplies dated history. PROJECT identifies repository authority. ISA owns acceptance. AGENTS and CLAUDE are operating adapters rather than product content.

Source anchors: Cambium root documents named above; docs/doctrine/README.md; docs/guide/cambium-system-capability-map.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md and src/data/atlas.ts.


---

# Cambium — infrastructure, ownership and surfaces

## An infrastructure map a founder can reason about
The Quests Worker is the API and read-model boundary. It validates tenant scope and Telegram context, projects Mission Fabric, handles bounded action envelopes, and connects to D1, KV, R2 and Vectorize. D1 Goal Graph owns operational intent and version-bound changes. KV holds runtime state where the declared contract uses it. R2 holds evidence and artifacts. Vectorize supports retrieval. Storage services do not possess approval authority.

Portfolio Workbench (Cartographer) reconciles project identity, repository provenance, planned missions and gaps. It prepares a bounded action. Telegram Mini App presents current context through Mission, Flow, Workforce, Forge, Gate and Inspect; its newer Operating Fabric also includes Canopy. Both should explain the same source projection. Selection, inspection and opening a sheet cannot count as approval. A stale or incorrectly bound proposal should remain inspect-only.

R3F expresses the topology as islands, rails, packets and instruments. Its routes include Genesis, Taste, Build, Ops, Cortex and visualizations. Synthetic fallback rendering is useful for design but does not prove the remote Worker is live. Electron wraps that renderer as a desktop application; browser proof does not prove installation, signing, notarization or updates.

Hermes is the topic-aware execution and delivery boundary for admitted assignments. Telegram is a transport and operator surface. A delivered message proves transport only; successful meaning requires a separate outcome check. Plexus supplies identity, tenant and RBAC boundaries. The repository describes optional MCP/AWS and observation adapters; optional adjacency must not be presented as a universally active dependency.

## The local operator substrate
Temperance coordinates phase context, skills and governed execution. Manifest projects project identity, workflow capabilities and approval state. OmniRoute transports model requests and resolves the configured provider route. Superset provides an execution host where declared. These are distinct from the Cambium operational writer. A bridge health response proves reachability at that moment; it does not prove freshness, provider credentials, correct model execution, or successful work. A proposed worker map is not a dispatched fleet.

The cognition loop reads sovereign memory planes with provenance. Organizational truth, local learning signals and projections have different authority. Federation means tagged reads across these planes; it does not mean flattening them into one writeable store.

## A bounded request
A useful request names exact WorkObject, task, current intent/version, approved scope, loadout, evidence references, budget and stopping condition. Request and approval identifiers are bounded and idempotency-aware. The owning API checks freshness, expiry and fence/version bindings. The executor emits terminal evidence. A new intended state must return through the appropriate approval path.

## Source implementation versus an accepted system
The repository contains finite composition adapters, Worker and Goal Graph code, projection and action contracts, onboarding and quest folds, Cortex ingestion and multiple visual surfaces. These are concrete source assets. Conversely, their presence is not a claim that every tenant or deployment has completed admission, pinning, execution and foldback. No new live service, production action, provider change or operational flow is proved by this explanation.

## Cloud authority
The reviewed project planning identifies Thoughtseed Labs as the production configuration authority and the legacy profile as read-only source/rollback evidence. Source inventory, asset transfer, parity, retirement and deployment remain separate operations. This guide does not suggest changing the live account or moving data.

Source anchors: ARCHITECTURE.md; INTEGRATION.md; docs/guide/cambium-system-capability-map.md; docs/guide/cambium-surface-inventory.json; workers/quests/src/cortex-ingestion.ts; workers/quests/src/goal-graph; workers/quests/src/mission-fabric.ts; .planning/STATE.md. Host services are described by their contracts, not by fresh runtime probes.


---

# Cambium — Octalysis as a teaching and decision framework

Cambium's ONBOARDING-OCTALYSIS.md defines a twenty-interaction ethical tutorial. It is an experience contract with Doctrine, Local and Held labels, not a transcript of a universally deployed user journey. The purpose is a clearer, safer next decision. Engagement time is not the objective.

| Core drive | What the founder experiences | Honest system expression | Failure to avoid |
|---|---|---|---|
| 1 Epic meaning | Why this venture deserves to continue | Vision, Calling, return to purpose | Invented grandiosity or compulsory engagement |
| 2 Accomplishment | Evidence of a completed bounded step | Receipts, quest arcs, stage-specific progress rings | Target KPIs or planned tasks shown as achievements |
| 3 Creativity and feedback | One reversible change and its consequences | Proposal, Taste review, Hands artifact, drift feedback | Automatic rewrite of intent after a suggestion |
| 4 Ownership | Identity, decisions and authority remain legible | Canonical WorkObject, versioned Gate, inspectable lineage | A UI selection treated as approval |
| 5 Relatedness | Real customers and accountable collaborators | Grounded observations and scoped work ownership | Synthetic personas treated as observed customer truth |
| 6 Scarcity | Real time, spend and solvency bounds | Budget/freshness/expiry warnings backed by data | Fake countdowns or manufactured urgency |
| 7 Curiosity | Meaningful uncertainty becomes inspectable | Source drilldown, gap labels, contradictory evidence | Mystery rewards or hiding material holds |
| 8 Loss avoidance | An actual viability or integrity threat | Named boundary escalation and human decision | Fear messaging without a real signal |

## The twenty interactions
| # | Interaction | Founder experience | Drive | Layer | State |
|---|---|---|---|---|---|
| 1 | The Calling | Choose one identified project and state why it should continue. | 1 | macro/noesis | Doctrine |
| 2 | Confirm identity | See its canonical WorkObject, parent, aliases, and provenance. | 4 | macro | Local · Workbench |
| 3 | Read the frontier | See the current problem without a fabricated task. | 7 | macro→meso | Local · Fitcheck packet |
| 4 | Read the story | Inspect ICP, value hypothesis, and anti-claims together. | 1·4 | meso | Local · Fitcheck Operate |
| 5 | See the missions | Reveal three bounded missions and their proof burden. | 2 | meso | Local · both UIs |
| 6 | See target KPIs | Show target evidence separately from achieved metrics. | 2·4 | meso | Local · both UIs |
| 7 | Inspect authority | Distinguish WorkObject, repositories, dependent programs, services, packet, D1, execution, and proof owners. | 4 | macro | Local · both UIs |
| 8 | Find the hold | Treat mapping-receipt readback or the first later missing stage as the next frontier. | 7 | meso | Local · both UIs |
| 9 | Meet the merchant | Review a grounded Shopify merchant hypothesis. | 5 | meso | Doctrine / packet |
| 10 | Ask what hurts | Capture a real conversation, not a simulated answer as truth. | 5·7 | meso | Held · external evidence |
| 11 | Propose one change | Convert the signal into one falsifiable next-intent proposal. | 3 | meso | Local contract |
| 12 | Meet the mirror | Surface assumptions, risk, taste, and claim boundaries. | 4·5 | meso | Doctrine |
| 13 | Face an objection | Preserve contradictory evidence instead of smoothing it away. | 7 | meso | Local packet pattern / held live evidence |
| 14 | Make a micro move | Prepare one reversible change against the same intent version. | 2·3 | micro | Local proposal path |
| 15 | Error or intent? | Classify divergence; default to error and hold. | 3·7 | meso | Local why-handler seam |
| 16 | Move the goal | Show evidence, trust boundary, graph version, and signed Gate. | 4 | macro | Local contract / held live action |
| 17 | Read viability | Inspect actual margins and missing evidence without synthetic certainty. | 6 | macro | Doctrine; partial local signals |
| 18 | Do not drop out | Escalate a real integrity, solvency, or mission boundary. | 8 | meso/noesis | Held · requires real signal |
| 19 | Replay the proof | Read task, loadout, run, receipt, and foldback lineage. | 2·4 | cross-run | Local contracts / held live Fitcheck proof |
| 20 | The game continues | Return evidence to a bounded next intent; then rest. | 1·4 | macro/noesis | Local contract / held live loop |

Exactly three noesis peaks sit above routine micro/meso/macro activity: interaction 1 (Calling), 18 (Do not drop out), and 20 (The game continues). Do not invent a noesis peak at every scene change.

## What progression means
A verified identity anchor does not prove a pinned loadout. A pin does not prove execution. Execution does not prove learning was accepted. Progress must follow the evidence owned by that stage. The quest log is an evidence fold over operator state. Its skill forge detects repeated signatures and proposes candidates; validation and founder-approved production promotion remain distinct. A celebration or ring may reflect proof, but cannot create it.

## Organ connections — explanatory interpretation
Genesis makes purpose and identity concrete (drives 1/4). Taste and Hands make creativity testable (3) and achievement evidential (2). Will connects work to real counterparts (5) under real bounds (6/8). Cortex makes proof inspectable (4/7). Vestibule and Adytum improve orientation and curiosity (7). Nutrix and Circulator make learning legible (2/7). Auspex surfaces real integrity threats (8). Praeceptor offers a reviewable improvement proposal (3/4). These organ-to-drive associations are an explanatory interpretation of the documented tutorial, not separate implemented gamification features or scores.

Source anchors: ONBOARDING-OCTALYSIS.md; QUESTLOG.md; bin/operator/onboarding/octalysis.ts; bin/operator/onboarding/octalysis.test.ts; HOMEOSTASIS.md.


---

# Cambium — how the visuals explain the system

## Three visual layers with different jobs
The established Organ Console gives the eleven organs their identities: weathered stone, oxidized copper, black-ink contours, bounded openings and restrained cyan/evidence light. The R3F and Telegram corpus supplies the product interaction grammar: deep teal terrain, thin rails, signal packets, progress rings, states and inspectable controls. The newer Living Ledger supplies an editorial brand layer: bone paper, lichen, copper consequence marks, serif reading rhythm and stewardship photography. These layers can coexist, but the new brand work has not automatically replaced the established organ or interface system.

The source-backed product tokens include deep #00272B, surface #012F34, accent #E0FF4F and highlight #D6FFF6. The sculpture brand-lock document separately names #1A237E depth, #00897B teal, #37474F scaffolding, #B8E986 evidence and #F57C00 ignition. Keep token ownership explicit; do not mix them into an undifferentiated palette. Existing interface headings use a condensed display voice and telemetry uses mono. The new editorial serif belongs to the sourcebook/brand layer pending explicit reconciliation of interface changes.

## Visual grammar
Glyphs identify owners. Rails express relationships and typed handoffs. Packets represent bounded work or data. Rings communicate progress, selection or focus according to the declared label. A moving packet is an illustration unless a real execution receipt supports it. States distinguish idle, active, stale, warning, selected, held and unknown. A glow cannot stand for both permission and success. Identity, freshness, lifecycle and authority remain independently readable.

Each organ must retain its own silhouette, nucleus and semantic mark. The two families remain recognizable. A component specimen or an unnamed R3F preview cannot be reassigned as an organ simply because its form looks suitable. Praeceptor's detached authority gate is especially important: the proposal and the authority to adopt it must remain visually separate.

## Semantic connectors
Typed Handoff marks a contract crossing. Identity Seam separates owners/families without disconnecting relationships. Evidence Socket attaches proof to a claim. Receipt Strata keeps permission, transport and semantic outcome distinct. Stream Continuity maintains the narrative/thread. Listener Sensor communicates observation; Multi-clock distinguishes time scales; Provider Evidence binds a provider claim to actual evidence; Work Shoreline bounds a work area; Responsive Compression preserves meaning across sizes. Run River and Held Gate have held geometry and must not be promoted from attractive substitutes.

## Pages as explanation scenes
Canopy orients the viewer in the terrain. Organ Atlas identifies owners. Flow follows a bounded signal. Work shows the finite task. Plant Health distinguishes independent instruments and their evidence. Actions reveals the permission boundary. Receipts lets the viewer inspect what actually happened. In the existing export, Canopy, Work and Receipts have selected wide/narrow images. Flow and Actions remain upstream-held; Organ Atlas and Plant Health failed bounded visual QA. Their absence is information, not permission to fabricate an approved image.

## Verified corpus
The reviewed asset maps contain 140 Organ Console records: 97 exported reference images (81 selected, 16 generated), 43 held/non-exported records and 23 review boards. The separate source library maps 46 numbered originals: 10 Telegram and 36 R3F, with four explicit duplicate relationships and five unresolved model previews. “Selected” here is a design-provenance state, not runtime admission or blanket founder approval. The twelve newer Living Ledger assets are another dated generated corpus; they do not replace either library.

## Storyboard and accessibility
A useful explanation proceeds Canopy → Flow → Workforce → Mission → Proof. Begin with purpose, follow one signal, inspect the responsible organ, inspect a proposal, then separate the three proof strata. Use the actual organ concept images supplied as sources, retaining labels and silhouette. Static diagrams need arrow direction, input/output and hold labels. Motion should communicate flow or status; reduced-motion and still-image versions must carry the same meaning. Text, symbols and patterns supplement color. Image numerals and example telemetry on design boards are illustrative, not live measurements.

Source anchors: docs/assets/visual-flow/README.md; organ-console/ASSET-MAP.v1.json and README.md; source-library/SOURCE-ASSET-MAP.v1.json and README.md; cambium-telegram-showcase/DESIGN.md; cambium-telegram-showcase/docs/SHOWCASE-NARRATIVE-SCOPE.md; earlier sourcebook 04-visual-system.md. Reconciliation of the three layers is editorial guidance for this explainer, not a changed product design contract.


---

# Cambium — follow one signal through the system

The following scenario is illustrative. A founder wants to improve a venture's product explanation after a real customer reports confusion. It teaches contracts without claiming that a live run has happened.

## 1 Observe and orient
Vestibule reads the prior session, current project truth and route context. Adytum can synthesize a bounded suggestion while retaining the authority of each memory plane. The customer signal enters with source, time, subject and owner. Cortex retrieves relevant evidence; it does not decide the new goal.

## 2 Identify and propose
The exact canonical WorkObject anchors the request. Portfolio provenance and reviewed packet establish what the project is. Mission Fabric combines facts without guessing aliases or writing operational intent. The proposal states a falsifiable change, an owner, required proof, a budget and a stop condition. A planned organ route is still only a hint.

## 3 Admit and pin
The founder inspects scope, evidence and consequence. A valid signed Gate, current graph version and compare-and-swap admit the appropriate D1 change. A governed loadout is pinned to that task. These are distinct steps; no animation or selected card can substitute for either receipt.

## 4 Execute the admitted finite work
Hermes consumes the admitted directive with its pinned loadout before the governed organ work begins. Execution remains bound to that intent and scope.

Genesis supplies the structured brand, copy and visual system when the task needs it. Taste checks the proposed direction against that brief and claim constraints. Hands resolves the bounded implementation work and builds the artifact. Will prepares an approved business or distribution move where relevant. The route may use a subset of organs; it is not mandatory to rerun every organ for every request. Each handoff validates the previous output against the next contract.

## 5 Verify before consequence
Structural validation asks whether identity, required fields and bounds match. Semantic review asks whether the artifact solves the actual problem and preserves brand meaning. Homeostasis treats contraction as a design obligation; embedding similarity is not proof of quality. A deviation defaults to error/hold. A deliberate change of intent becomes a new proposal rather than a silent rewrite.

## 6 Deliver or release within scope
Completed artifact verification does not by itself authorize external delivery or release. The named delivery adapter may carry a resulting message after the relevant permission exists. Keep three receipts separate: permission proves the action was allowed; transport proves a named channel carried it; semantic evidence proves the intended outcome. A Telegram sent receipt cannot prove customer comprehension.

## 7 Fold back and rest
Terminal evidence is preserved with lineage and digests. Cortex makes relevant evidence retrievable. Nutrix distills session learning. Auspex describes substrate health within its bounded contract, not product success. Circulator summarizes recurring signals. Praeceptor may draft an improvement. Each remains within its own authority. Evidence informs the next intent, which must pass a fresh appropriate gate. The completed finite run stops.

## A smaller Telegram capability-card flow
The existing showcase separately describes Collect → Normalize → Contextualize → Select → Taste fence → Render → Propose → Deliver → Foldback. Collection and normalization bind source/topic/task; contextualization uses bounded context; selection can refuse; Taste constrains claims; rendering creates a card; proposal remains disabled pending founder review; delivery requires explicit arming and a transport receipt; foldback captures learning. This explanatory card flow is not equivalent to the whole D1 admission lifecycle.

## Failure scenes worth showing
Missing source: retain uncertainty. Identity mismatch: stop the join. Stale graph: refresh and re-propose. Missing loadout: do not execute. Provider unavailable: expose degradation without claiming task failure or success prematurely. Delivery succeeded, outcome unknown: show transport proof and an unresolved semantic layer. Proposed improvement: keep the authority gate detached. These are meaningful system states, not cosmetic errors.

Source anchors: ARCHITECTURE.md; INTEGRATION.md; HOMEOSTASIS.md; docs/architecture/fitcheck-golden-path.md; cambium-telegram-showcase/src/data/atlas.ts (selectionGates, organs, receiptStatuses and proofRules).


---

# Genesis — Turn an idea into a coherent, bounded brand system.

Family: Cambium. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
The birth of a finite undertaking needs more than a logo. Genesis records who the venture serves, what it promises, how it speaks and what its visuals may claim. Its outputs give downstream organs a versioned point of reference.

## Inputs
Idea and declared scope; approved source material; Meristem skill outputs and asset manifest.

## Outputs
Structured brand_system, copy_system and visual_system groups, plus asset lineage.

## Infrastructure connection
Meristem is the active source organ. Cambium’s meristem-genesis-contract.mjs reads a completed brand run; the composition shim does not itself run the Meristem waves.

## Decision and failure boundary
Validate required output groups, source completion and asset existence/digests. Missing canonical fields are contract drift. Paid generation and external publishing remain separately scoped.

## A concrete teaching example
Illustrative scenario: A request for an organ explainer begins by preserving the existing organ vocabulary in the brief. A new attractive hero image cannot silently redefine the product.

## Neighbours and handoffs
Taste consumes the declared brand system; Hands consumes the resulting brief; Will can derive an approved business brief; Cortex retains relevant evidence.

## How to read the visual
The accompanying genesis-concept-reference.png is the exact existing Genesis concept study, canonical asset TSOC-ORG-GENESIS-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Genesis receives, what it emits, who uses the result and which decision it cannot make. Do not confuse the Genesis no-spend contract mapping with free execution of every upstream generation capability.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: ARCHITECTURE.md; docs/organs/organs.meta.json; scripts/meristem-genesis-contract.mjs; composition/CONTRACTS.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Taste — Make quality and meaning inspectable before accepting an artifact.

Family: Cambium. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Taste translates brand intent into a testable brief, evaluates outputs and exposes semantic drift. A page can match the colors while misidentifying the product or making an unsupported promise. Taste must catch that difference.

## Inputs
Brand system, audience, aesthetic and semantic constraints, candidate artifact and claim boundaries.

## Outputs
Taste brief, precision/per-case evaluation or bounded verdict, and a repair/hold recommendation.

## Infrastructure connection
Governed design/taste skills and the taste evaluation seam supply the source implementation. Provider retrieval and generated asset quality require their own evidence.

## Decision and failure boundary
Preserve source-linked expectations and human acceptance. Similarity scores and schema checks cannot establish semantic convergence. Provider-backed evaluation may have explicit spend gates.

## A concrete teaching example
Illustrative scenario: If a drawing merges Nutrix and Cortex into one generic memory brain, Taste flags the lost ownership distinction even if the palette is perfect.

## Neighbours and handoffs
Reads Genesis intent and relevant Cortex evidence; constrains Hands implementation and Will messaging.

## How to read the visual
The accompanying taste-concept-reference.png is the exact existing Taste concept study, canonical asset TSOC-ORG-TASTE-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Taste receives, what it emits, who uses the result and which decision it cannot make. Evaluation does not authorize publication, paid rerolls or unlimited generation. Contraction is a design requirement, not a measured theorem.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: ARCHITECTURE.md; HOMEOSTASIS.md; INTEGRATION.md; cambium-telegram-showcase/src/data/atlas.ts; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Hands — Build a bounded artifact using the right declared capability.

Family: Cambium. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Hands is the execution organ for finite work. A conductor resolves a task into the appropriate skill cluster or spoke and produces an inspectable artifact. The important unit is a scoped task with exit evidence, not an endlessly busy agent.

## Inputs
Admitted task, versioned brief, acceptance criteria and governed skill/loadout selection.

## Outputs
Bounded dispatch, artifact, verification results and terminal evidence.

## Infrastructure connection
Skill-cluster task resolution and conductor/ship-gate contracts underpin this role. Superset is an execution host in the mapped ecosystem, not another source of operational authority.

## Decision and failure boundary
Separate resolving a capability from dispatching it; separate local tests from deployment. A loadout hint is not a pinned executable assignment.

## A concrete teaching example
Illustrative scenario: Implement a reviewed explainer layout against the correct organ assets, then stop at the declared verification boundary rather than automatically deploying it.

## Neighbours and handoffs
Receives Taste constraints and Genesis groups, emits artifact evidence to Cortex and an appropriately scoped downstream Will task.

## How to read the visual
The accompanying hands-concept-reference.png is the exact existing Hands concept study, canonical asset TSOC-ORG-HANDS-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Hands receives, what it emits, who uses the result and which decision it cannot make. Source code, a successful build and an installed or deployed experience are different proofs. Shipping remains governed.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: ARCHITECTURE.md; INTEGRATION.md; docs/organs/organs.meta.json; cambium-telegram-showcase/src/data/atlas.ts; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Will — Turn approved intent and artifacts into accountable business operations.

Family: Cambium. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Will connects the finite output to the venture’s actual operating context: audience, offer, market evidence and distribution. It is not generic ambition or permission to contact customers. Its business decisions inherit the current scope and approvals.

## Inputs
Approved brand-to-GTM brief, artifact, real audience evidence, operational bounds and permitted channel.

## Outputs
Bounded business/marketing plan or approved move, plus outcome evidence when execution occurs.

## Infrastructure connection
The documented business-operations role references Snow Gloves and brand_to_gtm/derive_brief seams. Repository source and newer local GTM work must not be promoted to universal live activation.

## Decision and failure boundary
Approval must precede paid search or consequential outreach. Budgets, target identity, claims and delivery permissions remain explicit.

## A concrete teaching example
Illustrative scenario: Prepare an explanation for a named internal audience. The completed PDF does not authorize sending a campaign or treating targets as customers.

## Neighbours and handoffs
Consumes Genesis identity and Taste claim boundaries; uses Hands artifacts; returns observations and outcomes to Cortex.

## How to read the visual
The accompanying will-concept-reference.png is the exact existing Will concept study, canonical asset TSOC-ORG-WILL-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Will receives, what it emits, who uses the result and which decision it cannot make. A prepared marketing brief is not a launched campaign, contacted lead or revenue result. Commercial outcomes require real observation.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: ARCHITECTURE.md; INTEGRATION.md; docs/organs/organs.meta.json; docs/runbooks/sapling-multi-prong-gtm-sop.md; cambium-telegram-showcase/src/data/atlas.ts; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Cortex — Preserve and retrieve relevant venture evidence without rewriting intent.

Family: Cambium. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Cortex gives finite runs continuity. It ingests usable material, derives bounded chunks and digests, and supports tenant-scoped retrieval. It is a memory contract, not a particular vendor and not the authority to decide what the organization should do.

## Inputs
Source material, tenant context, content/idempotency digest and evidence lineage.

## Outputs
Validated chunks, retrieval context, ingestion receipt or a truthful empty result for unusable input.

## Infrastructure connection
Cambium Worker Cortex ingestion and provider-neutral memory interfaces are source implementations; hosted storage/provider state is a separate seam.

## Decision and failure boundary
Keep tenant boundaries, source identity, redaction and provenance. An empty or stale result is not a license to invent context.

## A concrete teaching example
Illustrative scenario: Retrieve the source that says the organ sculpture is selected-for-derivation. Present that status instead of claiming the asset was runtime-approved.

## Neighbours and handoffs
Supports Genesis/Taste/Will and projection with relevant evidence; works beside Nutrix without merging organizational truth with session signals.

## How to read the visual
The accompanying cortex-concept-reference.png is the exact existing Cortex concept study, canonical asset TSOC-ORG-CORTEX-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Cortex receives, what it emits, who uses the result and which decision it cannot make. Retrieved evidence can inform a proposal. Only the owning signed Gate and operational writer can change the current intent.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: ARCHITECTURE.md; INTEGRATION.md; workers/quests/src/cortex-ingestion.ts; docs/guide/cambium-system-capability-map.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Vestibule — Orient a new session before it starts making decisions.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Vestibule is the threshold: it looks backward to the prior session and forward to the current project, phase and route. Its value is reducing context loss without creating another planner. It should disclose partial information when a source is unavailable.

## Inputs
Prior-session learning, current project/planning facts, recent changes and phase/route context, with memory-plane authority tags.

## Outputs
Read-only orientation, phase/rail display and grounded suggestions.

## Infrastructure connection
The installed Vestibule contract describes a shared session-start core for native and gateway-oriented surfaces. This explanation reads the contract; it does not prove each client hook is currently firing.

## Decision and failure boundary
Never merge memory planes, mutate routing, claim a work lane, write memory or gate execution. Missing context degrades orientation rather than blocking session start.

## A concrete teaching example
Illustrative scenario: A returning founder sees the previous hold and the current task authority instead of receiving a fabricated new plan.

## Neighbours and handoffs
Reads Nutrix’s prior signals and sovereign project truth; can feed Adytum’s contextual synthesis.

## How to read the visual
The accompanying vestibule-concept-reference.png is the exact existing Vestibule concept study, canonical asset TSOC-ORG-VESTIBULE-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Vestibule receives, what it emits, who uses the result and which decision it cannot make. Orientation is advisory. Reading an issue or suggesting a next move is not approval, scheduling or execution.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Vestibule.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Adytum — Turn oriented context into one bounded next-action suggestion.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Adytum is the inner chamber after the threshold. It combines perspectives while keeping their authority labels intact. Its product is a small inspectable thought, not a merged memory store and not a client intake channel.

## Inputs
Vestibule orientation; local learning signals; organizational truth; routing signals; an allowed Hermes projection.

## Outputs
A bounded next-action card for the internal operator route.

## Infrastructure connection
The installed contract describes read-only synthesis and stdout card output. Delivery belongs to the existing separately governed transport.

## Decision and failure boundary
No memory writes, Bot API calls, Goal Graph writes, client inflow handling or automatic promotion. Missing sources yield a partial card.

## A concrete teaching example
Illustrative scenario: Suggest reviewing a recurring gap in an explainer, citing the source and uncertainty, without sending a message or assigning a task.

## Neighbours and handoffs
Reads Vestibule and federated evidence; may supply a proposal for human inspection through a separately authorized delivery path.

## How to read the visual
The accompanying adytum-concept-reference.png is the exact existing Adytum concept study, canonical asset TSOC-ORG-ADYTUM-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Adytum receives, what it emits, who uses the result and which decision it cannot make. A next-action card is a suggestion. It is neither a sent message nor a changed task state.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Adytum.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Nutrix — Distill a completed session into bounded learning signals.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Nutrix tends what the session learned. It reads decisions, failures, rejected changes and rollbacks, then records structured signals that can improve later interpretation. It harvests evidence rather than declaring policy.

## Inputs
Session-scoped decision events, fence rejections, rollbacks, failures, heal reports and tagged prior signals.

## Outputs
Structured learning signals and shadow proposals in the local learning plane.

## Infrastructure connection
The installed contract names session-end harvesting with bounded execution and signal schemas. It is distinct from Cortex’s venture evidence ingestion.

## Decision and failure boundary
Do not rewrite the decision ledger, alter live routes or automatically write organizational truth. Federated memory reads retain separate authority tiers.

## A concrete teaching example
Illustrative scenario: Record that repeated drafts erased the distinction between selected imagery and runtime acceptance. The resulting lesson is a signal awaiting the appropriate downstream use.

## Neighbours and handoffs
Vestibule reads its signals next session; Circulator synthesizes recurring patterns; Praeceptor may use them to draft an improvement.

## How to read the visual
The accompanying nutrix-concept-reference.png is the exact existing Nutrix concept study, canonical asset TSOC-ORG-NUTRIX-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Nutrix receives, what it emits, who uses the result and which decision it cannot make. A harvested lesson is not an approved rule, a promoted skill or a live router change.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Nutrix.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Auspex — Expose substrate health and bounded recovery evidence.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Auspex reads signs in the event, notification and routing substrate. It separates reachability, degradation and repeated failure so the operator can respond. Its health assessment concerns infrastructure seams; it cannot certify a business outcome.

## Inputs
Declared health probes, provider evidence, failure classifications and bounded recent heal/incident evidence.

## Outputs
Heal reports, degradation/recovery signals and escalation after defined failures.

## Infrastructure connection
The installed contract describes probes and bounded recovery through owned helpers. This explainer does not invoke those probes or recoveries or claim they are enabled.

## Decision and failure boundary
No indefinite retry loops, direct provider-store mutation, automatic provider promotion or application-success claim. Any current containment/activation hold remains in force.

## A concrete teaching example
Illustrative scenario: A model gateway answers health but a provider request lacks a receipt. Show gateway reachability and unverified provider execution as separate states.

## Neighbours and handoffs
Consumes relevant Nutrix failure signals; produces reports for Circulator and the human operator.

## How to read the visual
The accompanying auspex-concept-reference.png is the exact existing Auspex concept study, canonical asset TSOC-ORG-AUSPEX-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Auspex receives, what it emits, who uses the result and which decision it cannot make. A green infrastructure light is not a successful artifact, an active execution fleet or permission to change the provider.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Auspex.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Circulator — Make recurring evidence understandable across a longer period.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Circulator turns a period of decisions, lessons, health reports and proposed improvements into an operator-readable digest. It provides perspective without silently applying its recommendations. This longer cadence complements a single session’s learning.

## Inputs
Nutrix signals, shadow proposals, decision evidence, Auspex incidents, evaluation results and Praeceptor suggestions.

## Outputs
A digest with traceable observations and recommendation-only improvement candidates.

## Infrastructure connection
The installed contract describes a weekly synthesis role. A schedule in a contract is not fresh proof that the scheduled job ran or delivered this week.

## Decision and failure boundary
Do not flip flags, mutate provider state, promote skills or become the project planner. Preserve contradictory observations and evidence age.

## A concrete teaching example
Illustrative scenario: Show that several sessions encountered the same boundary and recommend a review, rather than automatically routing future work differently.

## Neighbours and handoffs
Synthesizes Nutrix, Auspex and Praeceptor material; returns recommendations to human review.

## How to read the visual
The accompanying circulator-concept-reference.png is the exact existing Circulator concept study, canonical asset TSOC-ORG-CIRCULATOR-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Circulator receives, what it emits, who uses the result and which decision it cannot make. A digest is interpretation over evidence. Its existence does not prove adoption of any recommendation.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Circulator.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.


---

# Praeceptor — Propose better capabilities while leaving adoption to the proper authority.

Family: Temperance. Evidence class: source-backed role and design reference; current runtime activation is not asserted.

## Why this organ exists
Praeceptor is the teacher: it reads repeated patterns and drafts improvements to skills, agents, workflows or classification. Its distinction is the separation between a useful proposal and permission to change the live system.

## Inputs
Recent decision patterns, learning, failures, heal reports, stop reasons and capability context.

## Outputs
Bounded proposed drafts with source references and an operator-facing rationale.

## Infrastructure connection
The installed contract describes proposal outputs under a held proposal area. It does not establish live catalog or routing mutation.

## Decision and failure boundary
Never edit live catalogs, auto-promote a skill, flip a route or rewrite doctrine. Adoption requires the owning review and verification gate.

## A concrete teaching example
Illustrative scenario: Draft an asset-provenance review skill after recurring confusion, but keep it outside active capability selection until reviewed.

## Neighbours and handoffs
Learns from Nutrix and Auspex; offers proposals that Circulator can summarize and a human can consider.

## How to read the visual
The accompanying praeceptor-concept-reference.png is the exact existing Praeceptor concept study, canonical asset TSOC-ORG-PRAECEPTOR-CONCEPT-V1. Preserve this exclusive organ identity. Its manifest says selected / selected-for-derivation; that is a reference/derivation status. It does not prove implementation, current health or permission. Show input → named organ → output as a labelled contract. Show a hold at the boundary if evidence is absent. Do not substitute another organ, a generic brain, or a component specimen.

## Goal of the explanation
A reader should be able to say what Praeceptor receives, what it emits, who uses the result and which decision it cannot make. The detached authority gate in the visual identity must stay separate. A compelling draft is not an installed capability.

## Verification question
If this organ displays a result, what separate receipt would be needed before calling the next consequential stage complete? Answer using the boundary above, not the visual glow.

Source anchors: cambium-telegram-showcase/src/data/atlas.ts; Temperance installed agent specification Praeceptor.md; cambium-telegram-showcase/docs/ORGAN-SYSTEM-MAP.md; Cambium docs/assets/visual-flow/organ-console/ASSET-MAP.v1.json.
