# Cambium Architecture Analysis & Game Mechanics Integration Plan

> **Analysis Date:** 2026-06-21
> **Source Repository:** https://github.com/Sheshiyer/cambium
> **Branch:** main (commit 4ac28a6)
> **Version:** v0.2.5 Thalia .5
> **Analyst:** Technical Architect / Game Systems Integrator

---

## 1. Codebase Overview

### 1.1 Directory Structure

```
cambium/
├── .github/workflows/          # CI/CD smoke gates, release gates
├── .planning/                  # Planning documents
├── apps/cambium-r3f/           # React Three Fiber 2.5D visual engine
│   ├── src/engine/             # Camera rig, tactical controls
│   ├── src/generated/          # Auto-generated source contract
│   ├── src/materials/          # Shader studies, Cambium materials
│   ├── src/scene/              # Scene composition, HUD, route registry
│   ├── src/world/              # Island registry, island definitions
│   └── public/                 # Static assets
├── bin/operator/               # Core operator - the wake loop
│   ├── narrative/              # Story mapper (W3) - logs to prose
│   ├── onboarding/             # 20-interaction Octalysis tutorial
│   ├── quests/                 # Quest system (7 arcs + 10 project arcs)
│   ├── skills/                 # Skill forge + telemetry
│   ├── cli.ts                  # CLI entry point
│   ├── operator.ts             # Wake loop (pure function)
│   ├── router.ts               # Micro/meso/macro Venn router
│   ├── world.ts                # Event-sourced world state
│   ├── npc.ts                  # ICP-NPC + Founder-NPC
│   ├── embed.ts                # NIM embeddings (1024-d / 64-d stub)
│   ├── resonance.ts            # ICP resonance resolution
│   ├── heartbeat.ts            # Self-scheduled viability sweeps
│   ├── cortex-memory.ts        # Cortex store contract + tenant scoping
│   ├── cortex-sqlite.ts        # SQLite-backed cortex (B2)
│   ├── vectorize-cortex.ts     # Cloudflare Vectorize cortex (B3)
│   ├── tenant.ts               # Multi-tenancy identity contract (M3)
│   └── types.ts                # Shared type definitions
├── composition/                # Pipeline composition layer
│   ├── pipeline.json           # Genesis -> Taste -> Build -> Ops + Cortex
│   └── CONTRACTS.md            # Stage I/O contracts
├── workers/quests/             # Cloudflare Worker - quest ledger serving
│   └── src/
│       ├── handler.ts          # Pure handler (quest API + bridge + handoff)
│       ├── index.ts            # Workers runtime glue
│       └── page.ts             # Landing page HTML
├── docs/                       # Documentation
├── examples/                   # Usage examples
├── scripts/                    # Build/deployment scripts
├── tasks/                      # Task tracking
├── ARCHITECTURE.md             # Architecture overview
├── INFINITE-GAME.md            # Game design doctrine
├── ONBOARDING-OCTALYSIS.md     # 20-interaction onboarding spec
├── QUESTLOG.md                 # Quest line specification
├── HOMEOSTASIS.md              # System homeostasis design
├── INTEGRATION.md              # Integration roadmap (I1-I3, B1-B3)
├── BUSINESS-MODEL.md           # Business model
├── registry.json               # 5-organ registry
└── adapters.json               # Adapter configurations
```

### 1.2 Key Files & Their Roles

| File | Role | Game System Equivalent |
|------|------|----------------------|
| `bin/operator/quests/quests.ts` | 17-arc quest line, pure fold, evidence-based | Quest log / main storyline |
| `bin/operator/skills/forge.ts` | Pattern detection >=3x, skill minting, vault schema | Crafting / skill tree |
| `bin/operator/skills/telemetry.ts` | Use-tracking, success rate, gotcha capture, amendments | Skill proficiency / mastery |
| `bin/operator/onboarding/script.ts` | 20-step Octalysis interaction design | Tutorial / prologue |
| `bin/operator/onboarding/session.ts` | Session state machine over wake loop | Save/load system |
| `bin/operator/onboarding/octalysis.ts` | 8-drive progress meter, panel rendering | Achievement tracker |
| `bin/operator/onboarding/run.ts` | Interactive runner with held noesis frames | Cutscene system |
| `bin/operator/operator.ts` | Wake loop: ingest->route->act->viability->learn->persist | Game loop / tick system |
| `bin/operator/router.ts` | Micro/meso/macro Venn + mid-brain bypass | Input routing / classification |
| `bin/operator/world.ts` | Event-sourced world state, setpoint moves, viability | Game state manager |
| `bin/operator/npc.ts` | ICP-NPC "Mira" + Founder-NPC (stub + real LLM) | NPC dialogue system |
| `bin/operator/cortex-memory.ts` | Semantic memory contract, kNN search, tenant isolation | Memory / recall system |
| `bin/operator/embed.ts` | NIM 1024-d embeddings, cosine similarity, L2 normalize | Vector math backend |
| `bin/operator/heartbeat.ts` | Self-scheduled viability sweeps, multi-tenant | Background daemon / auto-save |
| `bin/operator/narrative/narrative.ts` | World-log -> prose beats, lane-aware | Quest journal / lore |
| `bin/operator/tenant.ts` | Tenant registry, identity contract, path authority | Profile/account system |
| `bin/operator/cli.ts` | CLI commands: demo, wake, heartbeat, onboard, icp, state | Command console |
| `apps/cambium-r3f/src/App.tsx` | R3F Canvas, screen routing, camera modes | Main game window |
| `apps/cambium-r3f/src/scene/scene-data.ts` | Scene composition from pipeline + island registry | Level builder |
| `apps/cambium-r3f/src/scene/CambiumScene.tsx` | 3D scene rendering, nodes, rails, emitters | Scene renderer |
| `apps/cambium-r3f/src/scene/SceneHud.tsx` | HUD overlay, telemetry, instruments, camera dial | UI overlay system |
| `apps/cambium-r3f/src/scene/route-registry.ts` | 10 screens (islands + viz + settings + QA) | Navigation map |
| `apps/cambium-r3f/src/engine/camera-rig.tsx` | Tactical camera with drift, lerp, 3 modes | Camera controller |
| `apps/cambium-r3f/src/world/island-registry.ts` | 5 island definitions (biome, silhouette, camera) | World map data |
| `apps/cambium-r3f/src/scene/visual-tokens.ts` | Color palette, materials, typography, motion | Art style guide |
| `workers/quests/src/handler.ts` | Quest ledger API, founder gate, bridge, handoff | Backend API server |
| `composition/pipeline.json` | Genesis->Taste->Build->Ops + Cortex cross-cutting | Pipeline definition |

### 1.3 Architecture Patterns

**The Fractal Pattern:** `hub-and-spoke clusters + conducty loop + spec-kit + 1024-d memory` recurs at six scales: skill -> cluster -> organ -> venture -> company -> portfolio. This is documented in `ARCHITECTURE.md`.

**The Five Organs (Registry):**
1. **genesis** (brand brain) - Mint the brand
2. **taste** (taste cortex) - Set the taste
3. **hands** (build organ) - Build on-brand
4. **will** (operator) - Operate + GTM
5. **cortex** (memory) - Aesthetic memory (cross-cutting)

**Composition Pipeline:** `genesis -> taste -> build -> ops` with `cortex` feeding all stages. Defined in `composition/pipeline.json`.

**Event Sourcing:** Every event is folded into world-state via `wake()`. World version = number of events folded. Full replay determinism via `replay(world, events, deps)`.

**Pure Functions:** The wake loop, quest fold, skill forge, narrative mapper, and Octalysis panel are all pure functions with injected dependencies. This makes them fully testable and deterministic.

**Tenant Isolation (M3):** Every data path is tenant-scoped via `tenantScopedStore()`. Registry derives from existing worlds (registration-from-reality). Cross-tenant reads are impossible through the scoped API.

---

## 2. Current Game Systems Deep Dive

### 2.1 Quest System (17 arcs, pure fold, rendering)

**Location:** `bin/operator/quests/quests.ts`, `panel.ts`, `quests.test.ts`
**Worker:** `workers/quests/src/handler.ts` (serving layer)

**Current Design:**

The quest system is a **pure fold**: `(QuestInputs) -> QuestLedger`. There is no stored quest tracker that drifts - every quest's status DERIVES from actual world-state and logs.

**The 17 Arcs:**

| Arc | ID | Title | Evidence Source |
|-----|-----|-------|----------------|
| I | `the-calling` | The Calling | `onboarding.stepIndex >= 20 && drivesActivated >= 8 && noesisMoments >= 3` |
| II | `first-mint` | First Mint | `placeholderFree(seed) && placeholderFree(positioning) && placeholderFree(cta)` |
| III | `taste-resonance` | Taste & Resonance | `count(log, 'meso') >= 3` |
| IV | `the-loop` | The Loop | `micro >= 1 && meso >= 1 && macro >= 1` |
| V | `viability` | Viability | `count(log, 'heartbeat') + count(log, 'viability') >= 1` |
| VI | `memory` | Memory | `cortexCount >= 1` |
| VII | `many-gardens` | Many Gardens | `tenants.length > 1 && isolationSuite === true` |
| VIII | `living-org` | The Living Org | `multica.reachable && multica.agents >= 1` |
| IX | `the-gate` | The Gate | `multica.issuesDone >= 1` |
| X | `the-brief` | The Brief | `briefStatus === 'accepted' && contractExists && depositReceived` |
| XI | `the-scaffold` | The Scaffold | `repoExists && tenantProvisioned && specsFrozen` |
| XII | `the-build` | The Build | `buildCommits >= 1` |
| XIII | `the-review` | The Review | `reviewEvents >= 1` |
| XIV | `the-ship-gate` | The Ship Gate | `gateApprovals >= 1` |
| XV | `the-launch` | The Launch | `deployEvents >= 1` |
| XVI | `the-handoff` | The Handoff | `clientSignOff === true` |
| XVII | `the-garden` | The Garden | `lessonsMinted >= 1 && projectArchived` |

**Quest Types:**
- **Arcs I-IX:** Founder-level tutorial (operator tutorial) - completion inherited by all tenants
- **Arcs X-XVII:** Tenant-specific project/delivery phases

**Quest Status Machine:** `complete | active | locked` - the "frontier" is the first incomplete quest whose predecessor is complete.

**Quest Ledger Function:**
```typescript
export function questLedger(inputs: QuestInputs): QuestLedger {
  const results = QUEST_LINE.map((q) => ({ quest: q, ...q.doneWhen(inputs) }));
  const rows: QuestLedgerRow[] = [];
  let current: Quest | null = null;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    let status: QuestStatus;
    if (r.done) status = 'complete';
    else if (!current) { status = 'active'; current = r.quest; }
    else status = 'locked';
    rows.push({ quest: r.quest, status, evidence: r.evidence });
  }
  return { rows, completed: ..., total: ..., current };
}
```

**Key Observations for Integration:**
- The quest system is **strictly linear** - each arc unlocks the next
- Status is **binary** (complete/active/locked) - no partial progress visualization
- No **rewards** beyond status reveal - no loot, buffs, or cosmetic items
- No **side quests** - every quest is part of the main line
- Evidence strings are **text only** - could be enriched with visual progress bars
- The `founderCompleted()` mechanism allows inheritance but doesn't create branching

---

### 2.2 Skill Forge (detection, minting, telemetry)

**Location:** `bin/operator/skills/forge.ts`, `telemetry.ts`, `skills.test.ts`

**Pattern Detection Pipeline:**

1. **Signal Extraction:** `signaturesFromDeviations()` and `signaturesFromWorldLog()` extract `stage|kind|action` and `lane|action` signatures
2. **Candidate Detection:** `detectCandidates(signals, threshold=3)` - signatures repeating >= 3x become candidates
3. **Skill Minting:** `mintSkill(candidate)` produces a `SkillRecord` with vault schema fields
4. **Registry Merge:** `upsertSkills(existing, minted)` merges without resetting telemetry

**Skill Lifecycle:** `candidate -> validated -> production`
- `candidate -> validated`: On first verified OK use (automatic)
- `validated -> production`: Requires founder approval (never automatic)

**Telemetry System:**
- **Uses counter:** Total invocations
- **Success/failure tracking:** Binary outcomes per use
- **Scenarios:** Timestamped notes per use
- **Gotchas:** Deduplicated failure lessons
- **Amendments:** Auto-generated when success rate drops below 0.5 over last 5 uses (ONE per decline streak, no spam)
- **Success rate:** `successes / (successes + failures)`

**Skill Record Schema:**
```typescript
interface SkillRecord {
  skill_id: string;          // cambium-<kebab>
  status: SkillStatus;       // candidate | validated | production
  category: 'delivery' | 'governance';
  description: string;       // USE WHEN ... NOT FOR ...
  trigger_signals: string[];
  required_inputs: Array<{name, source, required}>;
  output_contract: {format, location};
  verification_steps: string[];
  promotion_rule: string;
  source: {signature, from, occurrences};
  telemetry: {uses, successes, failures, scenarios, gotchas, amendments};
}
```

**Key Observations for Integration:**
- The skill system is **flat** - no skill tree, no prerequisites, no categories beyond delivery/governance
- No **visual representation** of skills in the R3F engine
- No **skill XP/progress bar** - just a binary ok/fail per use
- No **skill synergies** or **combo effects**
- The telemetry data is rich but **not visualized** - could power skill trees, proficiency bars, mastery levels
- Skills are **auto-detected** from real behavior patterns - this is genuinely innovative

---

### 2.3 Onboarding (20 interactions, Octalysis, noesis)

**Location:** `bin/operator/onboarding/script.ts`, `session.ts`, `run.ts`, `octalysis.ts`

**The 20-Interaction Script:**

| Phase | Steps | Core Drives | Purpose |
|-------|-------|-------------|---------|
| A - Discovery/Calling | 1-3 | 1 (Epic Meaning), 4 (Ownership), 7 (Curiosity) | Why should I play? |
| B - First Mint | 4-8 | 2 (Accomplishment), 4 (Ownership), 3 (Creativity) | The first win |
| C - Meet the Players | 9-13 | 5 (Social), 7 (Unpredictability), 3 (Creativity) | Who's in my game? |
| D - The Loop | 14-17 | 3 (Creativity), 6 (Scarcity), 8 (Loss) | How do I play? |
| E - The Infinite Hook | 18-20 | 8 (Loss), 4 (Ownership), 1 (Epic Meaning) | Why I'll come back |

**Octalysis Coverage:**
- Drive 1 (Epic Meaning): Steps 1, 2, 3, 20 - **bookends** (opens and closes White Hat)
- Drive 2 (Accomplishment): Steps 4, 5, 7, 11, 14, 18, 19 - heavy
- Drive 3 (Creativity): Steps 6, 7, 8, 11, 14, 15 - heavy
- Drive 4 (Ownership): Steps 2, 5, 6, 12, 16, 19, 20 - heavy
- Drive 5 (Social): Steps 9, 10, 12 - moderate
- Drive 6 (Scarcity): Steps 17, 20 - light & grounded
- Drive 7 (Unpredictability): Steps 3, 4, 9, 10, 13, 15 - moderate
- Drive 8 (Loss): Steps 13, 16, 17, 18 - light & grounded

**Design Doctrine:** White-Hat dominant (1-2-3-4 carry the spine), Black Hat present but late and grounded. **Opens and closes on Epic Meaning** - the correct shape for an infinite game.

**The Mid-Brain -> Noesis Bypass:**
- Drives 1 and 8 (the vertical axis) activate `noesis` - the operator steps OUT of the routine tick
- Steps #1, #18, #20 are mid-brain beats with held frames (distinct render blocks)
- The `route()` function detects mid-brain events via `MID_BRAIN_DRIVES = {1, 8}` and `MID_BRAIN_KINDS = {'calling', 'drift'}`

**Session State Machine:**
```typescript
interface OnboardingState {
  stepIndex: number;         // 0..20
  drivesActivated: Drive[];  // drives that fired, in order
  noesisMoments: number;     // count of mid-brain beats
  world: WorldState;         // live event-sourced world
}
```

**Key Observations for Integration:**
- The onboarding is **brilliantly designed** - one of the most sophisticated game tutorials in any business tool
- No **progress persistence across sessions** beyond stepIndex - no "completion badges" or replay value
- No **skip tutorial** option for experienced users (besides --auto)
- No **onboarding replay** or "New Game+" mode
- The held noesis frames could be **dramatically enhanced** with visual effects
- No **social onboarding** - could benefit from multiplayer/team tutorial

---

### 2.4 Micro/Meso/Macro Router

**Location:** `bin/operator/router.ts`

**The Venn Router:**
```typescript
const LANE_BY_KIND: Record<string, Lane> = {
  tweak: 'micro',      // reversible fine-tune
  redirect: 'meso',    // founder redirect
  objection: 'meso',   // ICP objection
  metric: 'meso',      // real-world signal
  reposition: 'macro', // setpoint move
};
```

**Routing Classes:**
- `micro` - reversible tweak, no gate
- `meso` - error-vs-intent resolution, ICP-NPC consulted, setpoint may move if intent + evidence
- `macro` - evidence-gated setpoint move, trust-region clamped
- `midbrain` - noesis bypass (drives 1, 8), existential moments
- `heartbeat` - scheduled viability sweep

**Gate Rules:**
- Macro moves require `event.evidence === true` (fail-closed)
- Mid-brain events always gated (escalate to human)
- Micro moves never gated (reversible)

**Key Observations for Integration:**
- The router is elegant but **could support more lanes** (e.g., `social`, `exploration`, `crafting`)
- No **combo system** for multi-lane events
- No **lane mastery** - using a lane more often doesn't unlock bonuses
- The `EventKind` union is extensible - new kinds can be added for new game mechanics

---

### 2.5 NPC Self-Play

**Location:** `bin/operator/npc.ts`

**ICP-NPC "Mira":**
- Default: deterministic stub (seeded hash -> pseudo-vector)
- Real: NVIDIA NIM (preferred) -> Kimi fallback -> stub fail-soft
- Returns: pains[], direction (vector), directionLabel, resonance (0-1)
- Persona: "founder/CTO with lean senior team, skeptical of buzzwords"

**Founder-NPC:**
- Default: deterministic stub (reads `event.intent` bit)
- Real: LLM role-plays founder's operating logic
- Returns: intentBit ('error' | 'intent'), confidence, rationale

**Key Observations for Integration:**
- NPCs are **stateless** - no memory of past interactions
- No **relationship progression** with NPCs
- No **NPC quest givers** - Mira doesn't give quests, just provides data
- No **NPC emotional states** - always returns the same persona
- Could be dramatically enhanced with **memory-equipped NPCs** (via cortex)
- Could support **NPC relationship trees** (friendly -> trusted -> partner)

---

### 2.6 Visual Engine (R3F)

**Location:** `apps/cambium-r3f/src/`

**Architecture:**
- React Three Fiber with orthographic camera (2.5D tactical view)
- 5 island nodes (genesis, taste, build, ops, cortex) in fixed layout
- Rails (connections) with packet emitters (animated particles)
- Coolshape glyphs for each organ
- Scene HUD with telemetry, instruments, camera dial
- 3 camera modes: overview, node, flat
- 10 screens navigable via route dock

**Visual Tokens:**
- Colors: ink (#00272B), substrate (#012F34), signal (#E0FF4F), mist (#D6FFF6), depth (#231651)
- Materials: substrate (rough 0.92, metal 0.02), node states (complete/active/pending/memory)
- Motion: orbit 90s, packet 18s, reduced-motion aware
- Typography: Arial Narrow / mono

**Scene Composition:**
```typescript
interface CambiumSceneModel {
  nodes: SceneNode[];           // 5 islands + cortex
  rails: SceneRail[];           // 7 connections
  emitterLanes: EmitterLane[];  // animated packet flows
  engineControls: EngineControl[];
  visualizationLayers: VisualizationLayer[];
  screens: ScreenSpec[];        // 10 navigable screens
  telemetry: SceneTelemetry;    // quest progress, freshness
  // ...
}
```

**Key Observations for Integration:**
- The visual engine is **read-only** - no interactive gameplay within the 3D scene
- No **quest visualization** in the 3D space - quests are text-only in the HUD
- No **skill visualization** - skills exist only in JSON/registry
- No **NPC avatars** in the 3D space - Mira is text-only
- No **particle effects** tied to game events (achievements, level-ups)
- The island metaphor is **perfect for RPG-style progression** - islands could "level up"
- Coolshape integration is clever but could be enhanced with **custom 3D models** per skill/quest

---

### 2.7 Memory/Cortex System

**Location:** `bin/operator/cortex-memory.ts`, `embed.ts`, `cortex-sqlite.ts`, `vectorize-cortex.ts`

**The Cortex Contract:**
```typescript
interface CortexStore {
  init(): void | Promise<void>;
  ready(): boolean;
  upsert(record: MemoryRecord): void | Promise<void>;
  search(vector: number[], k?: number, opts?: SearchOpts): ScoredRecord[];
  count(opts?: SearchOpts): number | Promise<number>;
  close(): void | Promise<void>;
}
```

**Memory Record:**
```typescript
interface MemoryRecord {
  id: string;              // tenant:kind:eventId
  kind: MemoryKind;        // event | decision | deviation | positioning | pain
  tenant: string;          // isolation key
  vector: number[];        // 1024-d NIM / 64-d stub
  payload: Record<string, unknown>;
  ts: number;              // epoch ms
}
```

**Embedding Pipeline:**
- Real: NVIDIA NIM (nv-embedqa-e5-v5) via OpenAI-compatible API
- Fallback: deterministic 64-d stub (hash-based, reproducible)
- Normalized L2, cosine similarity for ranking

**Two Backends:**
1. **node:sqlite** (B2): Local SQLite with WAL, FTS5, zero deps. Used in development.
2. **Cloudflare Vectorize** (B3): Production vector DB over HTTP. Async.

**Tenant Isolation:** `tenantScopedStore(store, tenant)` stamps every record and filters every search.

**Key Observations for Integration:**
- The cortex is **underutilized for gameplay** - primarily used for ICP resonance and code recall
- Could power **NPC memory** ("Mira remembers you asked about X")
- Could power **procedural quest generation** ("based on your past decisions...")
- Could support **discovery mechanics** ("similar past situations suggest...")
- The semantic search is a natural fit for **lore/hint systems**

---

### 2.8 Event Sourcing

**Location:** `bin/operator/world.ts`, `operator.ts`

**The Wake Loop:**
```
ingest -> route -> act -> viability -> learn -> persist
```

**World State:**
```typescript
interface WorldState {
  tenant: string;
  version: number;         // event count
  vision: string;          // near-invariant anchor
  mission: string;         // evolves allostatically
  goals: string[];
  brand: BrandDNA;         // setpoint x*, trust region alpha
  artifacts: Record<string, string>;
  business: { runwayDays: number };
  log: string[];           // audit trail
}
```

**Event Sourcing Guarantees:**
- Every event produces a new world (immutable)
- Version = number of events folded
- Full replay: `replay(world, events, deps)` returns deterministic final world
- No stored state that can drift from events

**Key Observations for Integration:**
- The event log is **the perfect foundation** for replay features, save states, and time travel
- No **branching timelines** - events are linear
- No **save slots** - only one world per tenant
- The log is **text-only** - could store richer event data for replay visualization

---

## 3. Integration Opportunities

### 3.1 Quest System Enhancements

#### 3.1.1 Branching Quest Paths (vs Current Linear 17 Arcs)

**Current State:** The quest line in `bin/operator/quests/quests.ts` defines `QUEST_LINE` as a flat array. The `questLedger()` function computes status by iterating in order: first incomplete = active, rest = locked.

**Integration Point:** The `Quest` interface already has `doneWhen: (i: QuestInputs) => {done: boolean; evidence: string}`. This can be extended to support branching.

**How to Implement:**
1. Add `prerequisites: string[]` to the `Quest` interface - quest IDs that must be complete
2. Add `branches: string[]` - mutually exclusive quest IDs (only one can be active)
3. Modify `questLedger()` to resolve the quest DAG instead of linear iteration:
   - Compute all quests whose prerequisites are satisfied
   - Apply branch exclusivity (first available branch wins or player choice)
   - Multiple quests can be `active` simultaneously

**Files to Change:**
- `bin/operator/quests/quests.ts` - Add prerequisites/branching fields, modify `questLedger()`
- `bin/operator/quests/quests.test.ts` - Add DAG resolution tests
- `apps/cambium-r3f/src/scene/scene-data.ts` - Visualize branching paths in 3D

**AAA Game Reference:** The Witcher 3 quest system (intertwining main/side quests with consequence chains)

**Feasibility:** Medium. The pure fold architecture supports this well, but requires careful DAG resolution and cycle detection.

---

#### 3.1.2 Optional Side-Quests Tied to World-State

**Current State:** No side-quest system exists. Every quest is part of the main 17-arc line.

**Integration Point:** The `QuestInputs` interface already accepts world-state data. Side-quests would add new quest types that trigger on world-state conditions.

**How to Implement:**
1. Create a new `SIDE_QUEST_LINE` array alongside `QUEST_LINE`
2. Add `trigger: (i: QuestInputs) => boolean` to side-quest definition
3. Side-quests auto-activate when their trigger condition is met
4. Add `sideQuests: Quest[]` to `QuestLedger` output

**Example Side-Quests:**
- "The Resonance Hunter" - triggered when `icpReading.resonance < 0.3` (find what the market truly wants)
- "The Memory Keeper" - triggered when `cortexCount > 10` (review and organize past decisions)
- "The Gate Keeper" - triggered when `gateApprovals > 5` (establish a review process)

**Files to Change:**
- `bin/operator/quests/quests.ts` - Add `SIDE_QUEST_LINE`, modify `questLedger()`
- `bin/operator/types.ts` - Add side-quest trigger type
- `apps/cambium-r3f/src/scene/scene-data.ts` - Render side-quests as optional markers

**AAA Game Reference:** Skyrim's radiant quest system (procedurally generated based on player state)

**Feasibility:** Easy. The existing evidence-based pattern maps perfectly to side-quests.

---

#### 3.1.3 Quest Rewards (Loot, Buffs, Cosmetic)

**Current State:** Quest rewards are purely informational (`reveals: string`). Completing "The Calling" reveals "the onboarding organ" - but there's no tangible reward.

**Integration Point:** The `Quest` interface can be extended with a `rewards` field. The R3F visual engine can display reward unlocks.

**How to Implement:**
1. Add to `Quest` interface:
```typescript
interface QuestReward {
  type: 'unlock' | 'buff' | 'cosmetic' | 'title' | 'ability';
  target: string;          // what it unlocks
  value?: number;          // buff magnitude
  duration?: number;       // temporary buff duration (ms)
}
```
2. Add `rewards: QuestReward[]` to `Quest`
3. Create a reward registry that tracks unlocked rewards per tenant
4. In R3F: render reward unlocks as particle bursts, new UI elements, or scene changes

**Example Rewards:**
- Complete Arc I: Unlock "First Steps" title, +10% resonance on next ICP reading
- Complete Arc VII: Unlock "multi-tenant" visual skin (islands glow differently)
- Complete Arc XII: Unlock "Builder" buff (+5% commit velocity tracking)

**Files to Change:**
- `bin/operator/quests/quests.ts` - Add reward field to `Quest`
- `bin/operator/types.ts` - Add `QuestReward` type
- `bin/operator/world.ts` - Add `unlockedRewards` to `WorldState`
- `apps/cambium-r3f/src/` - Reward visualization effects

**AAA Game Reference:** World of Warcraft quest rewards (gear, reputation, titles)

**Feasibility:** Easy. Self-contained addition with clear event-sourcing integration.

---

#### 3.1.4 Quest Chains with Dependencies

**Current State:** Dependencies are implicit (arc order). No explicit prerequisite chains.

**Integration Point:** The `QuestInputs` interface and `doneWhen` function already support complex dependency checking.

**How to Implement:**
1. Add `requires: string[]` (quest IDs) and `unlocks: string[]` to `Quest`
2. Modify `questLedger()` to build a dependency graph
3. Add `QuestChain` type for named chains (e.g., "The Delivery Chain" = arcs X-XVII)
4. Chain progress visualized in R3F as connected path highlights

**Files to Change:**
- `bin/operator/quests/quests.ts` - Add chain metadata
- `bin/operator/quests/panel.ts` - Render chain progress in quest panel
- `apps/cambium-r3f/src/scene/scene-data.ts` - Chain visualization as glowing paths

**Feasibility:** Easy. Mostly metadata additions to existing structure.

---

### 3.2 Progression & Level Feel

#### 3.2.1 XP/Level Visualization (Beyond Binary Complete/Active/Locked)

**Current State:** Quest status is ternary: complete/active/locked. No granular progress.

**Integration Point:** Most quests have quantifiable evidence (e.g., `meso count`, `commits`, `deploys`). This can be normalized to a 0-100% progress bar.

**How to Implement:**
1. Add `progress: (i: QuestInputs) => number` to `Quest` (returns 0-1)
2. Modify `QuestLedgerRow` to include `progress: number`
3. In R3F: render quest nodes with partial-fill rings
4. In HUD: show progress bars alongside quest names

**Example Progress Functions:**
- Arc III (Taste & Resonance): `min(count(log, 'meso') / 3, 1)`
- Arc XII (The Build): `min(buildCommits / 10, 1)` (10 commits = 100%)
- Arc VII (Many Gardens): `(tenants.length > 1 ? 0.5 : 0) + (isolationSuite ? 0.5 : 0)`

**Files to Change:**
- `bin/operator/quests/quests.ts` - Add `progress` function to each quest
- `bin/operator/quests/panel.ts` - Render progress bars
- `apps/cambium-r3f/src/scene/visual-tokens.ts` - Add partial-state colors
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` - Render partial-fill rings

**AAA Game Reference:** Destiny 2's quest progress bars with milestone markers

**Feasibility:** Easy. Quantitative evidence already exists for most quests.

---

#### 3.2.2 Skill Trees (vs Current Flat Skill List)

**Current State:** Skills are a flat list with status (candidate/validated/production). No tree structure, no dependencies.

**Integration Point:** The `SkillRecord` interface has `category` (delivery/governance). Categories could become tree roots.

**How to Implement:**
1. Add `parent?: string` and `children: string[]` to `SkillRecord`
2. Add `tier: number` (1-5) for visual tree depth
3. Create a `SkillTree` renderer in R3F:
   - Root nodes = categories (delivery, governance)
   - Branch nodes = skill domains (brand, code, ops)
   - Leaf nodes = individual skills
4. Tree layout algorithm (radial or hierarchical)
5. Connection lines glow based on skill status

**Visual Design:**
- Candidate: dim gray node
- Validated: pulsing signal-colored node
- Production: bright with particle halo
- Connection: solid if parent is production, dashed if candidate

**Files to Change:**
- `bin/operator/skills/forge.ts` - Add tree fields to `SkillRecord`
- `bin/operator/skills/telemetry.ts` - Add `tier` to minted skills
- `apps/cambium-r3f/src/scene/types.ts` - Add `SkillTreeNode` type
- `apps/cambium-r3f/src/scene/` - New `SkillTreeScene.tsx` component
- `apps/cambium-r3f/src/scene/route-registry.ts` - Add `skill-tree` screen

**AAA Game Reference:** Path of Exile's passive skill tree (massive, interconnected)

**Feasibility:** Medium. Requires tree data structure + R3F rendering, but skill data is already rich.

---

#### 3.2.3 Power Curve Feeling (Gradual Empowerment)

**Current State:** No explicit power progression. The founder doesn't "level up."

**Integration Point:** The `WorldState` can accumulate an `experience` or `level` field derived from quest completion, skill validation, and world-events.

**How to Implement:**
1. Add to `WorldState`:
```typescript
interface FounderLevel {
  level: number;           // 1-50 (derived from XP)
  xp: number;              // cumulative experience
  title: string;           // "Seed Planter", "Brand Smith", etc.
  perks: string[];         // unlocked abilities
}
```
2. XP sources:
   - Quest completion: +100 XP per arc
   - Skill validation: +50 XP
   - Skill production: +200 XP
   - Onboarding step: +10 XP
   - Heartbeat survival: +5 XP per sweep
3. Level thresholds: exponential curve (100, 250, 500, 1000, ...)
4. Perks unlock at levels: faster trust-region (L5), extra memory slots (L10), etc.

**Files to Change:**
- `bin/operator/types.ts` - Add `FounderLevel` type
- `bin/operator/world.ts` - Add XP calculation to `commit()`
- `bin/operator/quests/quests.ts` - Add XP rewards to quest definitions
- `bin/operator/skills/telemetry.ts` - Add XP on validation/production
- `apps/cambium-r3f/src/scene/SceneHud.tsx` - Render level badge + XP bar

**AAA Game Reference:** Diablo 3's paragon levels (infinite progression with diminishing returns)

**Feasibility:** Easy. Derivative calculation from existing events.

---

### 3.3 Customization & Agency

#### 3.3.1 Player Profile/Build Expression

**Current State:** No player profile beyond tenant ID. The founder is an implicit role.

**Integration Point:** The `WorldState` can carry a `founderProfile` field that persists across sessions.

**How to Implement:**
1. Create `FounderProfile` interface:
```typescript
interface FounderProfile {
  archetype: 'visionary' | 'craftsman' | 'diplomat' | 'strategist';
  specialties: string[];    // derived from most-used lanes
  stats: {
    microMastery: number;   // count of micro moves
    mesoMastery: number;    // count of meso moves
    macroMastery: number;   // count of macro moves
    noesisDepth: number;    // count of noesis moments
    socialSkill: number;    // ICP interaction quality
  };
  titles: string[];         // unlocked titles
  avatar?: string;          // visual identifier
}
```
2. Profile is derived from event history (pure fold)
3. Archetype is determined by dominant stat
4. Titles unlock at milestones

**Files to Change:**
- `bin/operator/types.ts` - Add `FounderProfile`
- `bin/operator/operator.ts` - Update stats on each wake
- `bin/operator/world.ts` - Add profile to world state
- `apps/cambium-r3f/src/scene/` - Profile display screen

**AAA Game Reference:** Fallout's SPECIAL system, Mass Effect's class system

**Feasibility:** Easy. Purely derivative from existing events.

---

#### 3.3.2 Cosmetic Customization of the Visual Space

**Current State:** The R3F visual engine has a fixed palette (5 Cambium colors). No customization.

**Integration Point:** The `visualTokens` object in `apps/cambium-r3f/src/scene/visual-tokens.ts` defines all colors and materials. This can be made dynamic.

**How to Implement:**
1. Add `visualTheme` to `WorldState`:
```typescript
interface VisualTheme {
  name: string;
  colors: { ink: string; substrate: string; signal: string; mist: string; depth: string };
  materials: { roughness: number; metalness: number };
}
```
2. Pre-defined themes: "Cambium" (default), "Ocean", " Ember", "Forest", "Void"
3. Themes unlock based on quest progress
4. Custom theme builder (color picker for each slot)

**Files to Change:**
- `bin/operator/types.ts` - Add `VisualTheme`
- `apps/cambium-r3f/src/scene/visual-tokens.ts` - Make tokens dynamic
- `apps/cambium-r3f/src/App.tsx` - Pass theme to scene
- `apps/cambium-r3f/src/scene/` - Theme application layer

**AAA Game Reference:** Fortnite's locker system (character skins, pickaxe, glider)

**Feasibility:** Easy. CSS/Three.js color swaps. Mostly frontend work.

---

#### 3.3.3 Choice Consequences That Persist

**Current State:** The `WorldState` log records every decision, but there's no explicit consequence system.

**Integration Point:** The event log is perfect for replaying decisions and showing their consequences. The `decision.action` field records what happened.

**How to Implement:**
1. Add `consequences: Consequence[]` to `Decision`:
```typescript
interface Consequence {
  id: string;
  trigger: string;        // what decision triggered it
  effect: string;         // human-readable effect
  worldDelta: Partial<WorldState>;  // state change
  visible: boolean;       // shown to player immediately?
}
```
2. Consequences can be immediate (setpoint move) or delayed ("in 5 heartbeats, X happens")
3. Consequence browser in R3F: decision tree visualization

**Files to Change:**
- `bin/operator/types.ts` - Add `Consequence`
- `bin/operator/operator.ts` - Generate consequences in wake loop
- `bin/operator/world.ts` - Apply delayed consequences
- `apps/cambium-r3f/src/scene/` - Consequence tree visualization

**AAA Game Reference:** Detroit: Become Human's flowchart system (decision + consequence visualization)

**Feasibility:** Medium. Requires consequence generation logic and delayed application.

---

### 3.4 Discovery & Exploration

#### 3.4.1 Hidden Features/Secrets to Discover

**Current State:** All features are documented and exposed. No hidden content.

**Integration Point:** The `QuestInputs` and `WorldState` can carry hidden flags that unlock when specific conditions are met.

**How to Implement:**
1. Add `secrets: Secret[]` to the quest system:
```typescript
interface Secret {
  id: string;
  name: string;
  description: string;     // revealed when found
  trigger: (world: WorldState, inputs: QuestInputs) => boolean;
  reward?: QuestReward;
}
```
2. Example secrets:
   - "The Hidden Path" - triggered when `micro > 100 && meso > 100 && macro > 100` (used all lanes extensively)
   - "The Echo" - triggered when `cortexCount > 50 && noesisMoments > 10`
   - "The Perfect Loop" - triggered when `successRate == 1.0` across all skills

**Files to Change:**
- `bin/operator/quests/quests.ts` - Add secret registry
- `bin/operator/types.ts` - Add `Secret` type
- `apps/cambium-r3f/src/scene/` - Secret discovery animations

**AAA Game Reference:** Hollow Knight's hidden areas, Zelda's secret rooms

**Feasibility:** Easy. Condition-checking against existing state.

---

#### 3.4.2 Collectibles Tied to World-State

**Current State:** No collectible system.

**Integration Point:** The `WorldState.artifacts` field is a key-value store. Collectibles can be stored here.

**How to Implement:**
1. Define `Collectible` type:
```typescript
interface Collectible {
  id: string;
  name: string;
  description: string;
  category: 'lore' | 'achievement' | 'rare';
  trigger: (world: WorldState) => boolean;
  visual: string;          // 3D model identifier for R3F
}
```
2. Categories: Lore fragments (narrative snippets), Achievement tokens (milestones), Rare drops (unlikely events)
3. Display in R3F as floating orbs or cards in a "trophy room" screen

**Files to Change:**
- `bin/operator/types.ts` - Add `Collectible`
- `bin/operator/world.ts` - Add `collectibles` to `WorldState`
- `bin/operator/quests/quests.ts` - Define collectible triggers
- `apps/cambium-r3f/src/scene/` - Collectible display screen

**AAA Game Reference:** Horizon Zero Dawn's data points, Assassin's Creed's feathers

**Feasibility:** Easy. Condition-checking + artifact storage.

---

#### 3.4.3 Map Fog-of-War / Progressive Reveal

**Current State:** All 10 screens are always visible in the route dock. No progressive discovery.

**Integration Point:** The `route-registry.ts` defines all screens. Discovery can gate screen visibility.

**How to Implement:**
1. Add `unlockCondition: (world: WorldState) => boolean` to `ScreenSpec`
2. Default screens: home, elements-settings (always visible)
3. Island screens unlock when corresponding organ is "revealed" (quest completion)
4. Visualizations screen unlocks after arc IV
5. Unlocked screens appear in the route dock; locked ones show as "???"
6. In R3F: undiscovered islands render as fog/mist instead of clear geometry

**Files to Change:**
- `apps/cambium-r3f/src/scene/route-registry.ts` - Add unlock conditions
- `apps/cambium-r3f/src/scene/SceneHud.tsx` - Hide locked screens
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` - Fog rendering for undiscovered nodes
- `apps/cambium-r3f/src/scene/visual-tokens.ts` - Add fog material

**AAA Game Reference:** Civilization's fog of war, Hollow Knight's map system

**Feasibility:** Easy. Conditional rendering based on world state.

---

### 3.5 NPC Depth & Relationships

#### 3.5.1 NPC Relationship Progression

**Current State:** ICP-NPC "Mira" and Founder-NPC are stateless. No relationship tracking.

**Integration Point:** The `cortex-memory.ts` system can store interaction history with NPCs. The `npc.ts` module can query this history.

**How to Implement:**
1. Add `Relationship` type:
```typescript
interface NpcRelationship {
  npcId: string;           // 'mira' | 'founder'
  level: number;           // 1-10 (friendship/trust)
  interactions: number;    // count of conversations
  lastTopic?: string;      // what was last discussed
  affinity: number;        // -1 to 1 (likes/dislikes founder's style)
  unlockedDialogues: string[];
}
```
2. Level up triggers:
   - L1-3: Basic interactions (pain queries)
   - L4-6: Mira offers suggestions proactively
   - L7-9: Mira reveals market insights before they're obvious
   - L10: Mira becomes a "partner" - auto-validates certain decisions
3. Affinity affects NPC's confidence in readings
4. Relationship stored in cortex with `kind: 'npc_interaction'`

**Files to Change:**
- `bin/operator/types.ts` - Add `NpcRelationship`
- `bin/operator/npc.ts` - Query relationship before generating response
- `bin/operator/cortex-memory.ts` - Store interactions with `kind: 'npc_interaction'`
- `bin/operator/operator.ts` - Update relationship on each NPC interaction
- `apps/cambium-r3f/src/scene/` - Relationship meter UI

**AAA Game Reference:** Persona 5's Social Link system, Fire Emblem's support conversations

**Feasibility:** Medium. Requires NPC memory integration with cortex and response modification.

---

#### 3.5.2 NPC Memory of Past Interactions

**Current State:** NPCs are stateless. Each call is independent.

**Integration Point:** The `CortexStore` with `kind: 'npc_interaction'` can store every NPC conversation.

**How to Implement:**
1. Before generating an NPC response, search the cortex for past interactions:
```typescript
const pastInteractions = await store.search(queryVector, 5, { kind: 'npc_interaction', tenant });
```
2. Include past interaction summaries in the LLM prompt
3. Mira remembers: "Last time you asked about pricing, I suggested..."
4. Founder-NPC learns the founder's decision patterns over time

**Files to Change:**
- `bin/operator/npc.ts` - Add cortex query before response generation
- `bin/operator/cortex-memory.ts` - Ensure `npc_interaction` kind exists
- `bin/operator/embed.ts` - Embed NPC interaction texts

**AAA Game Reference:** Dwarf Fortress's historical figure memory system

**Feasibility:** Medium. Requires async cortex queries in the NPC flow.

---

#### 3.5.3 Social Quests/Activities

**Current State:** No social/multiplayer features. Single-founder only.

**Integration Point:** The `multi-tenancy` system (M3) already isolates tenants. Social features would add cross-tenant interactions.

**How to Implement:**
1. Add `SocialQuest` type:
```typescript
interface SocialQuest {
  id: string;
  title: string;
  participants: string[];  // tenant IDs
  sharedGoal: string;      // e.g., " collectively achieve 10 commits"
  progress: Record<string, number>;  // per-participant progress
  deadline?: number;       // epoch ms
}
```
2. Social quest types:
   - "The Guild" - tenants share a skill (all validate the same skill)
   - "The Relay" - tenants pass a "baton" (each completes one arc)
   - "The Summit" - all founders vote on a shared decision
3. Handled via the bridge API in `workers/quests/src/handler.ts`

**Files to Change:**
- `bin/operator/types.ts` - Add `SocialQuest`
- `bin/operator/tenant.ts` - Add cross-tenant interaction (read-only)
- `workers/quests/src/handler.ts` - Add social quest endpoints
- `apps/cambium-r3f/src/scene/` - Social quest UI

**AAA Game Reference:** Destiny 2's clan activities, MMORPG raid mechanics

**Feasibility:** Hard. Requires cross-tenant data sharing (carefully scoped) and real-time coordination.

---

### 3.6 Engagement Loops

#### 3.6.1 Daily/Weekly Challenges

**Current State:** Only the heartbeat provides regular engagement. No challenge system.

**Integration Point:** The heartbeat system (`heartbeat.ts`) can be extended to generate challenges.

**How to Implement:**
1. Add `Challenge` type:
```typescript
interface Challenge {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly';
  criteria: (world: WorldState) => boolean;
  reward: QuestReward;
  expiresAt: number;       // epoch ms
}
```
2. Challenge examples:
   - Daily: "Make 3 micro moves" / "Check viability once" / "Review one skill"
   - Weekly: "Complete one project arc" / "Validate a new skill" / "Reach 5 noesis moments"
3. Challenges are generated by the heartbeat worker
4. Stored in world state, checked on each wake

**Files to Change:**
- `bin/operator/types.ts` - Add `Challenge`
- `bin/operator/heartbeat.ts` - Generate challenges on heartbeat
- `bin/operator/world.ts` - Add `activeChallenges` to world state
- `bin/operator/operator.ts` - Check challenge completion on wake
- `apps/cambium-r3f/src/scene/SceneHud.tsx` - Challenge display

**AAA Game Reference:** Fortnite's daily challenges, World of Warcraft's daily quests

**Feasibility:** Easy. Heartbeat integration + condition checking.

---

#### 3.6.2 Streaks/Achievements

**Current State:** No streak or achievement system.

**Integration Point:** The event log records every action. Streaks can be computed by analyzing consecutive days with activity.

**How to Implement:**
1. Add `Achievement` and `Streak` types:
```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  trigger: (world: WorldState, history: GameEvent[]) => boolean;
}

interface Streak {
  type: string;            // 'daily_login' | 'heartbeat' | 'skill_use'
  count: number;           // consecutive days
  lastDate: string;        // ISO date of last activity
}
```
2. Achievement examples:
   - "First Light" (common): Complete onboarding
   - "Triple Threat" (rare): Use micro, meso, and macro in one day
   - "Infinite Loop" (epic): Complete arcs I-IX
   - "The Operator" (legendary): Run 365 days of heartbeats
3. Streak tracking:
   - Daily login streak (check world.log timestamps)
   - Heartbeat streak (consecutive days with heartbeat events)
   - Skill use streak (use a skill every day for N days)

**Files to Change:**
- `bin/operator/types.ts` - Add `Achievement`, `Streak`
- `bin/operator/world.ts` - Add `achievements`, `streaks` to world state
- `bin/operator/operator.ts` - Check achievements on each wake
- `apps/cambium-r3f/src/scene/` - Achievement unlocked animation, streak counter

**AAA Game Reference:** Steam achievements, Xbox Gamerscore, Duolingo streaks

**Feasibility:** Easy. Condition checking against event history.

---

#### 3.6.3 Leaderboards (Across Tenants)

**Current State:** Tenants are fully isolated. No cross-tenant visibility.

**Integration Point:** The `workers/quests/src/handler.ts` already serves quest ledgers. A leaderboard endpoint can aggregate anonymized data.

**How to Implement:**
1. Add leaderboard types:
```typescript
interface LeaderboardEntry {
  tenantHash: string;      // anonymized tenant ID
  score: number;
  arcsCompleted: number;
  skillsValidated: number;
  daysActive: number;
  updatedAt: string;
}
```
2. Score formula: weighted combination of quest progress, skill mastery, and activity
3. Endpoints:
   - `GET /api/leaderboard/global` - top 50 across all tenants
   - `GET /api/leaderboard/weekly` - top 50 this week
   - `GET /api/leaderboard/nearby?score=X` - tenants near your score
4. Privacy: only anonymized hashes, opt-in only

**Files to Change:**
- `workers/quests/src/handler.ts` - Add leaderboard endpoints
- `workers/quests/src/handler.test.ts` - Add leaderboard tests
- `bin/operator/cli.ts` - Add `--leaderboard` flag
- `apps/cambium-r3f/src/scene/` - Leaderboard screen

**AAA Game Reference:** League of Legends ranked ladders, Steam global achievements

**Feasibility:** Medium. Requires cross-tenant aggregation with privacy controls.

---

## 4. Technical Feasibility Matrix

### 4.1 Quick Wins (Low Effort, High Impact)

| Integration | Effort | Impact | Files Changed | Notes |
|-------------|--------|--------|---------------|-------|
| **Quest progress bars** (3.2.1) | Easy | High | `quests.ts`, `panel.ts`, R3F materials | Quantitative evidence already exists |
| **XP/level system** (3.2.3) | Easy | High | `types.ts`, `world.ts`, `SceneHud.tsx` | Derivative from existing events |
| **Daily challenges** (3.6.1) | Easy | High | `heartbeat.ts`, `types.ts`, `SceneHud.tsx` | Natural heartbeat extension |
| **Streaks/achievements** (3.6.2) | Easy | High | `types.ts`, `operator.ts`, R3F | Event history analysis |
| **Side-quests** (3.1.2) | Easy | High | `quests.ts`, `types.ts` | Evidence triggers already work |
| **Quest rewards** (3.1.3) | Easy | Medium | `quests.ts`, `types.ts`, R3F | Self-contained addition |
| **Hidden secrets** (3.4.1) | Easy | Medium | `quests.ts`, R3F | Condition checking |
| **Collectibles** (3.4.2) | Easy | Medium | `types.ts`, `world.ts`, R3F | Artifact storage |
| **Fog-of-war screens** (3.4.3) | Easy | Medium | `route-registry.ts`, `SceneHud.tsx` | Conditional rendering |
| **Visual themes** (3.3.2) | Easy | Medium | `visual-tokens.ts`, `App.tsx` | CSS/material swaps |
| **Founder profile** (3.3.1) | Easy | Medium | `types.ts`, `operator.ts` | Stats aggregation |
| **Quest chains** (3.1.4) | Easy | Low | `quests.ts` | Metadata additions |

### 4.2 Medium-Term Integrations

| Integration | Effort | Impact | Files Changed | Notes |
|-------------|--------|--------|---------------|-------|
| **Skill trees** (3.2.2) | Medium | High | `forge.ts`, R3F scene | Requires tree data + 3D rendering |
| **NPC relationships** (3.5.1) | Medium | High | `npc.ts`, `cortex-memory.ts`, R3F | Cortex integration for memory |
| **NPC memory** (3.5.2) | Medium | High | `npc.ts`, `cortex-memory.ts` | Async cortex queries |
| **Choice consequences** (3.3.3) | Medium | Medium | `types.ts`, `operator.ts`, R3F | Consequence generation logic |
| **Branching quests** (3.1.1) | Medium | Medium | `quests.ts`, R3F | DAG resolution + visualization |
| **Leaderboards** (3.6.3) | Medium | Low | `handler.ts`, privacy layer | Cross-tenant aggregation |

### 4.3 Long-Term Vision

| Integration | Effort | Impact | Files Changed | Notes |
|-------------|--------|--------|---------------|-------|
| **Social quests** (3.5.3) | Hard | High | `handler.ts`, `tenant.ts`, R3F | Cross-tenant coordination |
| **Procedural quest generation** | Hard | High | New module + cortex | AI-generated quests from memory |
| **Full RPG progression system** | Hard | High | Core system changes | Integrates all above features |
| **Multiplayer founder mode** | Hard | Very High | Architecture changes | Real-time collaborative operation |
| **AI dungeon-master mode** | Hard | Very High | New module | LLM-driven narrative adaptation |

### 4.4 File-Level Implementation Map

#### Phase 1: Foundation (Weeks 1-2)
```
bin/operator/types.ts
  + Add: QuestReward, FounderLevel, FounderProfile, Challenge, 
         Achievement, Streak, Secret, Collectible, VisualTheme,
         NpcRelationship, Consequence

bin/operator/world.ts
  + Modify: createWorld() - add new fields
  + Add: XP calculation, streak checking

bin/operator/quests/quests.ts
  + Add: progress() to each Quest
  + Add: rewards[] to each Quest  
  + Add: SIDE_QUEST_LINE, SECRET_LINE
  + Modify: questLedger() - include progress, side quests

apps/cambium-r3f/src/scene/visual-tokens.ts
  + Add: partial-state colors, theme variants
```

#### Phase 2: Progression (Weeks 3-4)
```
bin/operator/operator.ts
  + Add: XP award on wake, achievement checks
  + Add: Profile stat updates

bin/operator/heartbeat.ts
  + Add: Challenge generation

bin/operator/skills/forge.ts
  + Add: parent/children/tier to SkillRecord

apps/cambium-r3f/src/scene/SceneHud.tsx
  + Add: XP bar, level badge, achievement toasts
  + Add: Challenge display, streak counter
  + Add: Profile summary
```

#### Phase 3: Depth (Weeks 5-8)
```
bin/operator/npc.ts
  + Add: Relationship querying
  + Add: Cortex memory integration

bin/operator/cortex-memory.ts
  + Add: 'npc_interaction' MemoryKind

apps/cambium-r3f/src/scene/
  + New: SkillTreeScene.tsx
  + New: CollectibleScreen.tsx
  + New: ProfileScreen.tsx
  + Modify: CambiumScene.tsx - reward effects

workers/quests/src/handler.ts
  + Add: Leaderboard endpoints
```

#### Phase 4: Polish (Weeks 9-10)
```
apps/cambium-r3f/src/scene/CambiumScene.tsx
  + Add: Fog rendering, progressive reveal
  + Add: Secret discovery animations
  + Add: Theme switching

apps/cambium-r3f/src/scene/route-registry.ts
  + Add: Unlock conditions to screens

Full integration testing + performance optimization
```

---

## 5. Recommended Priority Roadmap

### Sprint 1: "Feel the Progress" (Weeks 1-2)
**Goal:** Make progress visible and rewarding immediately.

1. **Quest progress bars** - Every quest shows % completion based on evidence
2. **XP + level system** - Founder earns XP from every meaningful action
3. **Achievement system** - 20 core achievements for milestone moments
4. **Visual effects on quest complete** - Particle burst in R3F when arc completes

**Success metric:** Users can see their progress increasing session-over-session.

---

### Sprint 2: "Daily Ritual" (Weeks 3-4)
**Goal:** Create daily engagement hooks.

1. **Daily challenges** - 3 auto-generated challenges per day
2. **Streak tracking** - Login streak + heartbeat streak
3. **Challenge rewards** - XP bonuses for completing challenges
4. **Streak recovery** - Allow 1 "miss" per week without breaking streak

**Success metric:** 50%+ of active users check in daily.

---

### Sprint 3: "Deepen the World" (Weeks 5-6)
**Goal:** Make the game world feel alive and discoverable.

1. **Side-quests** - 10 auto-triggered side-quests based on world-state
2. **Hidden secrets** - 5 easter eggs for dedicated players
3. **Collectibles** - Lore fragments from narrative system
4. **Fog-of-war** - Progressive screen discovery

**Success metric:** Users discover at least 1 side-quest per session.

---

### Sprint 4: "Build Your Character" (Weeks 7-8)
**Goal:** Let founders express their identity.

1. **Founder profile** - Archetype + stats + specialties
2. **Visual themes** - 5 unlockable color palettes
3. **Titles** - Equippable titles unlocked by achievements
4. **Skill tree visualization** - R3F-rendered skill progression

**Success metric:** 80%+ of users have a defined archetype after 2 weeks.

---

### Sprint 5: "Living NPCs" (Weeks 9-10)
**Goal:** Make Mira and the Founder-NPC feel like real characters.

1. **Relationship system** - Mira remembers past conversations
2. **Relationship levels** - 10 levels with unlockable dialogue
3. **NPC memory** - Cortex-powered conversation history
4. **Relationship UI** - Progress bar + affinity indicator

**Success metric:** Users report feeling "connected" to Mira in feedback.

---

### Sprint 6: "Social Layer" (Weeks 11-12)
**Goal:** Add light social features for team/multi-founder use.

1. **Leaderboards** - Opt-in anonymized rankings
2. **Shared achievements** - Team-wide achievement unlocks
3. **Social quests** - Cross-tenant collaborative challenges
4. **Team dashboard** - Multi-founder progress view

**Success metric:** Team tenants show 2x engagement vs solo tenants.

---

## Appendix A: Key Code References

### The Wake Loop (bin/operator/operator.ts)
```typescript
export function wake(world: WorldState, event: GameEvent, deps: WakeDeps): 
  { world: WorldState; decision: Decision } {
  // 1. INGEST
  let next = ingest(world, event);
  // 2. ROUTE (micro/meso/macro + mid-brain bypass)
  const routing = route(event);
  // 3. ACT (lane-specific actions + NPC consultation)
  // 4. VIABILITY (margin checking + emergency moves)
  // 5. LEARN + 6. PERSIST (event sourcing)
  next = commit(next, event.id, action);
  return { world: next, decision: { ... } };
}
```

### The Quest Fold (bin/operator/quests/quests.ts)
```typescript
export function questLedger(inputs: QuestInputs): QuestLedger {
  const results = QUEST_LINE.map((q) => ({ quest: q, ...q.doneWhen(inputs) }));
  // Status: complete | active | locked
  // Current: first incomplete quest
  return { rows, completed, total, current };
}
```

### The Skill Forge (bin/operator/skills/forge.ts)
```typescript
export function detectCandidates(signals: RepetitionSignal[], threshold = 3): SkillCandidate[] {
  // Group by signature, filter >= threshold occurrences
}
export function mintSkill(c: SkillCandidate, now: number): SkillRecord {
  // Produce vault-schema-aligned skill spec
}
```

### The Octalysis Panel (bin/operator/onboarding/octalysis.ts)
```typescript
export function renderOctalysisPanel(state: OnboardingState, out: (s: string) => void): void {
  // 8 core drives with meter bars
  // Hat balance: white vs neutral vs black
  // Brain axis: left vs right vs mid
  // Noesis moments count
}
```

### The Router (bin/operator/router.ts)
```typescript
export function route(event: GameEvent): Routing {
  // Mid-brain bypass: drives 1,8 -> noesis
  // Heartbeat: probe events
  // Lane: micro/meso/macro based on event kind
  // Gate: macro + mid-brain are gated
}
```

---

## Appendix B: Harry Potter Game Mechanics Cross-Reference

| Cambium System | Harry Potter Equivalent | Integration Opportunity |
|----------------|------------------------|------------------------|
| 17 Quest Arcs | Main story chapters (Year 1-7) | Branching year paths with house points |
| Skill Forge | Spell learning (class + practice) | Spell tree with wand motions (visual) |
| Octalysis Onboarding | Sorting Hat ceremony | Personality-driven founder archetype |
| Micro/Meso/Macro | Spell casting (swish/flick) | Gesture-based input for different lanes |
| ICP-NPC "Mira" | Hogwarts professors | Professor relationship + office hours |
| Founder-NPC | Mirror of Erised | Reflects founder's deepest ambitions |
| Cortex Memory | Pensieve | Visually explore past decisions |
| Heartbeat | Daily Prophet | Daily updates + challenges delivered |
| Multi-tenancy | Hogwarts houses | House cup leaderboard between tenants |
| Viability Board | House Points | Visible scoreboard with consequences |
| R3F Visual Engine | Marauder's Map | Living map that updates in real-time |
| Narrative System | Tom Riddle's diary | Conversational log that learns from you |
| Event Sourcing | Time-Turner | Replay any past moment |
| Setpoint Gate | protective enchantments | Evidence requirements as spell components |
| Skill Telemetry | O.W.L. exam results | Skill proficiency ranking |
| Noesis Frames | Dumbledore's office moments | Held frames for existential dialogue |
| Island Nodes | Hogwarts locations | Each island as a discoverable location |
| Quest Rewards | Chocolate Frogs / collectibles | Collectible cards with lore |
| Fog of War | Uncharted corridors | Progressive map discovery |
| Daily Challenges | Daily Prophet puzzles | Time-limited brain teasers |

---

*This analysis is based on thorough code review of the Cambium repository at commit 4ac28a6. All file paths, function names, and code references are accurate as of the analysis date.*
