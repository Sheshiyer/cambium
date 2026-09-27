# Cambium Fractal Synthesis: Wind Meets Rain + Oddities & Senses

## The Infinite Game as a Living, Breathing Tapestry

**Date:** 2026-06-22  
**Purpose:** Map Wind Meets Rain's quest flow, character upgrades, tools, oddities, and senses onto Cambium's fractal tapestry — not as features to bolt on, but as natural expressions of the architecture that already exists.  
**Core Principle:** *The game patterns are not additions. They are the shape the fractal wants to take.*

---

## The Thesis

Cambium already has the bones of everything we need:

- **The Wake Loop** = one move in an infinite game (already built)
- **The Fractal** = same pattern at 6 scales, self-similar across skill → cluster → organ → venture → company → portfolio (already designed)
- **The Cortex** = 1024-d semantic memory, kNN search, tenant-scoped (already implemented)
- **NPC Self-Play** = ICP-NPC "Mira" + Founder-NPC (already stubbed)
- **Homeostasis** = Banach contraction toward brand-DNA + Lyapunov self-healing (already mathed)
- **Event Sourcing** = every event folds into world-state deterministically (already working)

What Wind Meets Rain and the oddities/senses research gives us is **the flesh** — the specific shapes, rhythms, and textures that make the infinite game *feel alive*. Not new systems. New *expressions* of existing systems.

This document is organized by Cambium's existing architectural layers, with game patterns mapped as their natural expression:

| Cambium Layer | Game Pattern Expression |
|---------------|------------------------|
| The Wake Loop | Gift Box progression + Forbidden Forest router |
| The Fractal | Echo system (affinites at every scale) |
| The Cortex | Witcher Senses + Ship Log + Thought Cabinet |
| NPC Self-Play | AI Chat NPCs (Where Winds Meet) + Disco Elysium voices |
| Homeostasis | Rotating professor tasks + allostatic setpoint |
| Viability Kernel | Odradek scanner + Guiding Wind navigation |
| The R3F Engine | Marauder's Map + diegetic discovery |
| Event Sourcing | Bloodstains + memory reconstruction |

---

## 1. The Wake Loop as Gift Box + Forbidden Forest

### 1.1 What Cambium Has

The wake loop is a pure function: `[dormant] → event arrives → INGEST → ROUTE → ACT → VIABILITY → LEARN → PERSIST → [dormant]`.

Each wake is one move. Between moves, the system sleeps. This is the infinite game's heartbeat.

### 1.2 What Wind Meets Rain Does: Gift Box Progression

In Harry Potter: Magic Awakened, **any gameplay activity** (PvP duel, PvE exploration, class attendance, dancing) generates Gift Boxes. These boxes accumulate on a timeline and, when enough are collected, unlock the next story chapter [^21^].

The key mechanic: **all play feeds one progression pool.** The player chooses their activity, but the system doesn't care which — it only cares that *something* happened.

### 1.3 The Synthesis: Wake Loop as Gift Box Generator

The wake loop already works this way. Every event (ingest, route, act, viability check, learn, persist) is a *move*. What we need is the **Gift Box layer** — a visible accumulation that makes the player *feel* their moves adding up.

**Implementation:**

```typescript
// bin/operator/world.ts — add to the wake loop

interface WakeGifts {
  cycleId: string;          // e.g., "2026-06-22"
  earned: number;           // total gifts earned this cycle
  opened: number;           // gifts opened (revealed their contents)
  threshold: number;        // gifts needed to unlock next "chapter"
  contents: GiftContent[];  // what's inside each opened gift
}

interface GiftContent {
  id: string;
  type: 'insight' | 'echo' | 'fragment' | 'oddity' | 'sense';
  source: 'micro' | 'meso' | 'macro' | 'noesis';
  payload: unknown;
  discovered: boolean;      // false until "opened"
}

// Every wake move generates gifts based on the route classification:
function earnGifts(event: GameEvent, route: RouteClassification): GiftContent[] {
  const gifts: GiftContent[] = [];
  
  // Micro moves = small gifts (insights, fragments)
  if (route.micro) {
    gifts.push({ type: 'insight', source: 'micro', payload: event.payload });
    if (Math.random() < 0.1) gifts.push({ type: 'fragment', source: 'micro' });
  }
  
  // Meso moves = medium gifts (echo resonance, oddities)
  if (route.meso) {
    gifts.push({ type: 'echo', source: 'meso', payload: event.npcResponse });
    if (Math.random() < 0.15) gifts.push({ type: 'oddity', source: 'meso' });
  }
  
  // Macro moves = large gifts (senses, major fragments)
  if (route.macro) {
    gifts.push({ type: 'sense', source: 'macro', payload: event.setpointMove });
    if (Math.random() < 0.2) gifts.push({ type: 'fragment', source: 'macro' });
  }
  
  // Noesis (mid-brain bypass) = rare gifts (oddities, full echoes)
  if (route.noesis) {
    gifts.push({ type: 'oddity', source: 'noesis', payload: event.callingMoment });
    gifts.push({ type: 'echo', source: 'noesis' });
  }
  
  return gifts;
}
```

**The cycle:** Every 24 hours (or when threshold is reached), gifts are "opened" — their contents revealed. The player experiences a moment of anticipation → reveal → collection. This is the **famine/feast rhythm** that Magic Awakened masters: dormancy builds anticipation, the reveal creates delight.

### 1.4 What Wind Meets Rain Does: The Forbidden Forest

The Forbidden Forest is a **non-linear roguelike router** [^187^][^188^]:
- 7 event types per stage: Battle, Hard Battle, Forest Merchant, Crisis, Gathering Spot, Free Exploration, Resting Spot
- Players choose from 2-3 options at each stage
- Card Enhancement Buffs: choose 1 of 3 buffs per event
- NPC Companions bring pre-built decks with unique skills
- Two difficulty tiers: daily (HAUNTED HOLLOW) and weekly (DEATHLY DELL)

### 1.5 The Synthesis: The Wake Loop as Non-Linear Forest

The wake loop's `ROUTE → ACT` step becomes the **Forbidden Forest stage**. Instead of a deterministic action, the router presents 2-3 options based on the event classification:

```typescript
// bin/operator/router.ts — the Forest Stage

interface ForestStage {
  stageId: string;
  options: ForestOption[];
  companionAvailable: CompanionNPC[];
  buffChoices?: BuffChoice[];
}

interface ForestOption {
  id: string;
  label: string;
  type: 'battle' | 'merchant' | 'crisis' | 'gather' | 'explore' | 'rest';
  preview: string;           // what the option looks like (not the outcome)
  requirements?: string[];   // e.g., need specific skill or echo
  riskLevel: 'safe' | 'risky' | 'dangerous';
}

// The router, now a Forest generator:
export function generateForestStage(world: WorldState, event: GameEvent): ForestStage {
  const vennPosition = classifyOnVenn(event);
  
  // Options emerge from the Venn position:
  // Center (all three) = crisis (high stakes, all hands)
  // micro∩meso = battle (situational conflict)
  // macro∩meso = merchant (strategic trade)
  // macro∩micro = gather (systematic collection)
  // solo micro = explore (individual investigation)
  // solo meso = rest (social recovery)
  // solo macro = ??? (noesis trigger — existential moment)
  
  const options = vennToOptions(vennPosition, world);
  const companions = availableCompanions(world);
  
  return { stageId: generateStageId(), options, companionAvailable: companions };
}
```

**The fractal unfold:** The same Forest Stage pattern repeats at every scale:
- **Skill scale:** A skill encounter presents 2-3 ways to apply the skill (battle = stress test, gather = collect feedback, rest = refine)
- **Cluster scale:** A cluster challenge presents 2-3 collaborative approaches
- **Organ scale:** An organ run presents 2-3 execution strategies
- **Venture scale:** A venture decision presents 2-3 market paths
- **Portfolio scale:** A portfolio move presents 2-3 allocation strategies

---

## 2. The Fractal as Echo System

### 2.1 What Cambium Has

The fractal: `Φ_skill ≈ Φ_cluster ≈ Φ_organ ≈ Φ_venture ≈ Φ_company ≈ Φ_portfolio`. Same pattern at every scale — hub-and-spoke + conductor + spec-kit + cortex.

### 2.2 What Wind Meets Rain Does: Echo System

In HP Magic Awakened, every deck has an **Echo** — a character from the Harry Potter universe that provides a unique special ability and stat bonuses [^167^][^170^]. Each Echo buffs specific cards, creating deck-defining synergies. There are 19+ Echoes: Harry, Hermione, Dobby, Bellatrix, Snape, etc.

The key: **"You should have a variety of good Echoes instead of a single perfect Echo"** [^170^]. The Echo shapes what the deck *wants* to do.

### 2.3 The Synthesis: Echo as Fractal Affinity

Every scale in Cambium's fractal has an **Echo** — a dominant thesis/character that shapes what that scale "wants" to do:

```typescript
// bin/operator/types.ts — Echo system

interface Echo {
  id: string;
  name: string;
  archetype: string;
  ability: string;           // unique special ability
  buffs: EchoBuff[];         // what gets buffed
  affinity: number[];        // 1024-d embedding of the echo's "character"
}

interface EchoBuff {
  target: string;            // skill ID, cluster ID, organ ID, etc.
  buffType: 'power' | 'speed' | 'depth' | 'resilience';
  magnitude: number;
}

// Echoes at different scales:
const ECHO_TEMPLATES = {
  // Skill-scale Echoes (micro-personalities within a skill)
  skill: [
    { id: 'the-perfectionist', archetype: 'precision', ability: 'Triple-check outputs', buffs: [{target: 'quality', buffType: 'power', magnitude: 0.3}] },
    { id: 'the-hacker', archetype: 'speed', ability: 'Ship fast, fix later', buffs: [{target: 'velocity', buffType: 'speed', magnitude: 0.4}] },
    { id: 'the-scholar', archetype: 'depth', ability: 'Research before acting', buffs: [{target: 'understanding', buffType: 'depth', magnitude: 0.35}] },
  ],
  
  // Venture-scale Echoes (market theses)
  venture: [
    { id: 'the-purist', archetype: 'mission-first', ability: 'Mission coherence > revenue', buffs: [{target: 'brand-alignment', buffType: 'power', magnitude: 0.25}] },
    { id: 'the-opportunist', archetype: 'market-first', ability: 'Follow demand signals', buffs: [{target: 'resonance', buffType: 'speed', magnitude: 0.3}] },
    { id: 'the-builder', archetype: 'product-first', ability: 'Build what users ask for', buffs: [{target: 'product-fit', buffType: 'depth', magnitude: 0.35}] },
  ],
};
```

**The fractal law:** At every scale, you must build your "deck" (team, skills, strategy) around your Echo's buffs. The Echo is not a restriction — it's a *direction*. A venture with "the-purist" Echo should load up on brand-alignment skills. A venture with "the-opportunist" Echo should load up on market-sensing skills.

**Echo resonance:** When an Echo's affinity vector (in the 1024-d cortex) aligns with the brand-DNA setpoint, all buffs are amplified. When they diverge, buffs decay — signaling that the Echo (thesis) may need to evolve (allostatic setpoint move).

### 2.4 Companion Cards = NPC Self-Play

HP Magic Awakened's Companion Cards [^213^][^219^] map directly to Cambium's NPC system:

| Companion Card | Ability | Cambium NPC Equivalent |
|---------------|---------|----------------------|
| Hermione | Copies your spell cards | Mira mirrors your ICP approach |
| Ron | Gathers enemies into chessboard | Founder-NPC consolidates problems |
| Daniel | Heals all friendly units | Viability monitor restores margins |
| Hagrid | +5 movement cards, ride motorbike | Macro router accelerates allostasis |
| Harry | Protection bubble, removes control effects | Emergency viability defense |
| Ivy | Vanishing Curse (instakill non-boss) | Skill forge eliminates weak patterns |
| Draco | Attacks stunned enemies faster | ICP-NPC exploits market gaps |
| McGonagall | Transfigures enemies to critters | Taste cortex transforms off-brand outputs |

**The rule:** Companion cards trigger **once per wake loop move**. Their timing and synergy with your "spells" (actions) determines success. You choose which companion to bring into each Forest Stage.

---

## 3. The Cortex as Sensory Organ

### 3.1 What Cambium Has

The cortex: 1024-dim NIM embedding space, kNN search, tenant-scoped. It stores every event as a vector. It answers "what is closest to X?"

### 3.2 What Games Do: Witcher Senses + Odradek + Guiding Wind

Three complementary sense systems from games:

**Witcher Senses** — multi-modal perception: red highlights (interactive), yellow (examined), scent trails (directional wisps), sound waves (proximity) [^161^].

**Odradek Scanner** (Death Stranding) — terrain scanning: blue circles (shallow/safe), yellow squares (deep/careful), red squares (danger), BT detection with color-coded proximity states [^163^].

**Guiding Wind** (Ghost of Tsushima) — environmental navigation: wind blows toward objectives using heightmap-aware vorticle particles [^190^][^193^].

### 3.3 The Synthesis: Cortex as Multi-Modal Sensory System

The cortex is not just a memory store. It is Cambium's **sensory organ** — a multi-modal perception system that surfaces different types of signals from the embedding space:

```typescript
// bin/operator/cortex-memory.ts — Sensory modes

type SenseMode = 'revelio' | 'accio' | 'levioso' | 'alohomora' | 'guiding-wind' | 'odradek';

interface SenseResult {
  mode: SenseMode;
  signals: Signal[];
  confidence: number;
}

interface Signal {
  vector: number[];
  source: string;            // event ID, skill ID, NPC ID
  type: 'urgent' | 'opportunity' | 'examined' | 'hidden' | 'danger';
  color: 'red' | 'yellow' | 'blue' | 'orange' | 'green';
  intensity: number;         // 0-1, how strong the signal
  direction?: number[];      // for guiding-wind, the vector toward this signal
}

// Each sense mode reveals different things:
const SENSE_MODES: Record<SenseMode, { description: string; reveals: string[]; requires: string }> = {
  'revelio': {
    description: 'Reveal hidden patterns near the setpoint',
    reveals: ['unseen-insights', 'nearby-opportunities', 'latent-connections'],
    requires: 'cortex-count >= 1',  // basic sense, always available
  },
  'accio': {
    description: 'Pull flying insights from the embedding space',
    reveals: ['scattered-insights', 'loose-connections', 'orphan-events'],
    requires: 'skill-validated >= 3',
  },
  'levioso': {
    description: 'Lift buried signals to visibility',
    reveals: ['suppressed-warnings', 'old-patterns', 'forgotten-insights'],
    requires: 'memory-arc-complete',
  },
  'alohomora': {
    description: 'Unlock sealed understanding',
    reveals: ['gated-knowledge', 'locked-insights', 'sealed-patterns'],
    requires: 'insight-fragments >= 9',  // tiered gating like HL
  },
  'guiding-wind': {
    description: 'Feel the direction toward viability',
    reveals: ['viability-path', 'setpoint-direction', 'gradient-ascent'],
    requires: 'viability-checks >= 10',
  },
  'odradek': {
    description: 'Scan terrain for obstacles and hazards',
    reveals: ['cash-flow-rocks', 'market-rivers', 'competition-BTs'],
    requires: 'heartbeat-survived >= 30',
  },
};
```

**The Guiding Wind implementation:** Instead of explicit quest markers in the R3F engine, use particle flows:

```typescript
// apps/cambium-r3f/src/scene/senses/GuidingWind.ts

// Vorticle-based wind system (from Ghost of Tsushima)
class GuidingWind {
  private vorticles: Vorticle[] = [];
  private target: Vector3;        // the viability direction
  
  update(worldState: WorldStateSnapshot) {
    // Compute viability gradient from current state
    const gradient = computeViabilityGradient(worldState);
    this.target = gradient.direction;
    
    // Spawn vorticles along the gradient path
    this.vorticles = this.generateVorticles(gradient);
  }
  
  render() {
    // Particles follow vorticle paths
    // Different elements based on terrain: pampas in open fields, leaves in clusters, ash in burnt ventures
    // Wind does NOT pathfind around obstacles — aims directly, leaves pathfinding to the player
  }
}
```

**The Odradek implementation:** Business terrain scanning:

```typescript
// bin/operator/senses/Odradek.ts

interface TerrainScan {
  location: string;          // which scale: skill, cluster, organ, venture
  terrain: 'smooth' | 'rocky' | 'deep-water' | 'cliff';
  obstacles: Obstacle[];
  resources: Resource[];
  btProximity: 'safe' | 'aware' | 'close' | 'danger';  // BT = Business Threat
}

function scanTerrain(world: WorldState, scale: FractalScale): TerrainScan {
  return {
    terrain: assessSurface(world, scale),
    obstacles: findRocks(world, scale),      // cash flow rocks, talent rocks
    resources: findCargo(world, scale),      // missed opportunities
    btProximity: detectThreats(world, scale), // competition, market shifts
  };
}
```

### 3.4 The Thought Cabinet (Disco Elysium) = Cortex Self-Model

Disco Elysium's Thought Cabinet [^427^] — thoughts discovered through play, equipped, evolve over time, change how the character perceives the world. This maps to the cortex's **self-model layer**:

```typescript
// bin/operator/cortex-memory.ts — Thought Cabinet

interface Thought {
  id: string;
  name: string;
  description: string;
  slot: number;              // 1-12, limited slots
  status: 'dormant' | 'internalizing' | 'integrated';
  effects: ThoughtEffect[];
  internalizationTime: number; // ms until integrated
}

interface ThoughtEffect {
  target: string;
  modifier: number;
  condition?: string;
}

// Thoughts discovered through play (not purchased):
const THOUGHT_CATALOG: Thought[] = [
  {
    id: 'rigorous-self-critique',
    name: 'Rigorous Self-Critique',
    description: 'You question every output. Failure teaches more than success.',
    effects: [{target: 'skill-amendment-rate', modifier: 2.0}],
    internalizationTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  {
    id: 'the-infinite-player',
    name: 'The Infinite Player',
    description: 'There is no winning. There is only staying in the game.',
    effects: [{target: 'viability-panic-threshold', modifier: -0.3}],
    internalizationTime: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  {
    id: 'red-queen-awareness',
    name: 'Red Queen Awareness',
    description: 'You must run to stay in place. The market never stops moving.',
    effects: [{target: 'co-evolution-rate', modifier: 1.5}],
    internalizationTime: 14 * 24 * 60 * 60 * 1000,
  },
];

// Thoughts are discovered when the cortex detects a recurring pattern:
function discoverThoughts(world: WorldState): Thought[] {
  const discoveries: Thought[] = [];
  
  if (world.skillAmendments > 10 && !world.thoughts.find(t => t.id === 'rigorous-self-critique')) {
    discoveries.push(THOUGHT_CATALOG[0]);
  }
  
  if (world.wakeCount > 100 && !world.thoughts.find(t => t.id === 'the-infinite-player')) {
    discoveries.push(THOUGHT_CATALOG[1]);
  }
  
  return discoveries;
}
```

---

## 4. NPC Self-Play as AI Chat + Internal Voices

### 4.1 What Cambium Has

Two NPCs: ICP-NPC "Mira" (returns pain[], direction, resonance) and Founder-NPC (returns intentBit). Deterministic stubs by default. Real: NVIDIA NIM → Kimi fallback.

### 4.2 What Wind Meets Rain Does: AI Chat NPCs

Where Winds Meet uses LLM-powered NPCs with [^287^][^288^][^291^]:
- **Free-text chat box** (not dialogue wheels)
- **Real-time voice responses** with conversation memory
- **Emergent outcomes**: rewards, combat triggers, reputation changes, quest bypasses
- **Personality-driven**: each NPC has consistent character
- **Befriending mechanics**: relationships unlock tangible rewards

Players have convinced NPCs they were pregnant, bypassed quests using the "Metal Gear method," and engaged in genuine emotional roleplay [^287^][^289^].

### 4.3 The Synthesis: Mira as AI Chat NPC

```typescript
// bin/operator/npc.ts — AI Chat NPC system

interface ChatNPC {
  id: 'mira' | 'founder' | 'gossamer' | 'advisor';
  personality: PersonalityVector;
  memory: ConversationMemory[];
  relationship: RelationshipLevel;
  voice: 'analytical' | 'empathetic' | 'challenging' | 'supportive';
}

interface ConversationMemory {
  timestamp: number;
  playerInput: string;
  npcResponse: string;
  emotionalTone: string;
  outcome: string;
}

type RelationshipLevel = 
  | 'stranger'      // level 1
  | 'acquaintance'  // level 2
  | 'colleague'     // level 3
  | 'trusted'       // level 4
  | 'advisor'       // level 5
  | 'partner'       // level 6
  | 'confidant'     // level 7
  | 'ally'          // level 8
  | 'mentor'        // level 9
  | 'co-founder';   // level 10

// Mira's befriending rewards:
const MIRA_RELATIONSHIP_REWARDS: Record<RelationshipLevel, string[]> = {
  'stranger': ['basic-pain-query'],
  'acquaintance': ['resonance-reading', 'market-overview'],
  'colleague': ['competitive-insight', 'trend-detection'],
  'trusted': ['proactive-suggestion', 'early-warning'],
  'advisor': ['market-forecast', 'scenario-planning'],
  'partner': ['auto-validate-moves', 'co-decision-rights'],
  'confidant': ['hidden-opportunity-reveal', 'insider-perspective'],
  'ally': ['crisis-prediction', 'viability-insurance'],
  'mentor': ['founder-growth-path', 'leadership-coaching'],
  'co-founder': ['full-autonomy-mode', 'silent-partner-rights'],
};
```

**The anti-echo-chamber doctrine:** NPCs propose but never commit. A setpoint move requires **real-player evidence** before the gate opens. This is exactly What Wind Meets Meet's design philosophy: "NPCs may propose but may not commit."

### 4.4 Disco Elysium's 24 Skills = Cortex Voices

Disco Elysium's 24 skills function as **internal voices** — each skill has its own personality, notices different things, sometimes conflicts with other skills [^427^]. This maps to the cortex's **multi-voice analysis**:

| Disco Elysium Skill | Cambium Voice | What It Notices |
|-------------------|---------------|----------------|
| Logic | Data Synthesis | Inconsistencies, patterns, connections |
| Empathy | ICP-NPC Mira | Emotional undercurrents in market signals |
| Visual Calculus | Viability Monitor | Quantitative anomalies in metrics |
| Inland Empire | Intuition Engine | Gut feelings, inexplicable hunches |
| Shivers | Market Mood | The "temperature" of the market |
| Drama | Stakeholder Tracker | Lies, theatrical moves, posturing |
| Electrochemistry | Opportunity Radar | Pleasure/pain signals in data |
| Half Light | Threat Detector | Fight-or-flight signals from competition |
| Encyclopedia | Context Engine | Historical parallels, precedent |
| Conceptualization | Vision Mapper | Big picture connections |

**Implementation:** Each "voice" is an embedding projection in the cortex. When querying the cortex, you don't just get nearest neighbors — you get a **panel of voices**, each weighing in on what they see:

```typescript
// bin/operator/cortex-memory.ts — Multi-voice query

interface VoiceOpinion {
  voice: string;
  confidence: number;
  observation: string;
  vector: number[];
}

function queryCortexWithVoices(
  cortex: CortexStore,
  query: number[],
  voices: string[],
  tenant: string
): VoiceOpinion[] {
  const opinions: VoiceOpinion[] = [];
  
  for (const voice of voices) {
    const voiceProjection = getVoiceProjection(voice);  // each voice projects differently
    const projectedQuery = project(query, voiceProjection);
    const neighbors = cortex.knn(projectedQuery, 5, tenant);
    
    opinions.push({
      voice,
      confidence: computeConfidence(neighbors),
      observation: synthesizeObservation(neighbors, voice),
      vector: centroid(neighbors.map(n => n.vector)),
    });
  }
  
  return opinions;
}
```

---

## 5. Homeostasis as Rotating Professors

### 5.1 What Cambium Has

Homeostasis: Banach contraction toward brand-DNA setpoint `x*`. Lyapunov function `V(x) = d(x, x*)`. The why-handler for error-vs-intent disambiguation.

### 5.2 What Wind Meets Rain Does: Rotating Professor Tasks

Daily Tasks in HP Magic Awakened rotate weekly between five professors [^250^]:
- **McGonagall** (True Transformation) — structural changes
- **Hagrid** (Field Study) — exploration and discovery
- **Slughorn** (Potions Mastery) — crafting and preparation
- **Flitwick** (Like a Charm) — tactical execution
- **Trelawney** (Sight Unseen) — intuition and prediction

### 5.3 The Synthesis: Professor Rotation = Allostatic Lenses

The homeostatic contraction can be viewed through different "professor lenses" — each applies a different contraction function:

```typescript
// bin/operator/homeostasis.ts — Professor system

type Professor = 'mcgonagall' | 'hagrid' | 'slughorn' | 'flitwick' | 'trelawney';

interface ProfessorLens {
  name: string;
  focus: string;
  contraction: (x: Vector, xStar: Vector) => Vector;
  lyapunovWeight: number;
}

const PROFESSORS: Record<Professor, ProfessorLens> = {
  mcgonagall: {
    name: 'The Transformer',
    focus: 'Structural alignment — does the architecture match the vision?',
    contraction: structuralContraction,
    lyapunovWeight: 1.2,
  },
  hagrid: {
    name: 'The Explorer',
    focus: 'Field discovery — what have we missed in the market?',
    contraction: exploratoryContraction,
    lyapunovWeight: 0.8,
  },
  slughorn: {
    name: 'The Alchemist',
    focus: 'Crafting — what can we prepare before the next move?',
    contraction: preparatoryContraction,
    lyapunovWeight: 1.0,
  },
  flitwick: {
    name: 'The Duelist',
    focus: 'Tactical execution — are we hitting our marks?',
    contraction: tacticalContraction,
    lyapunovWeight: 1.1,
  },
  trelawney: {
    name: 'The Seer',
    focus: 'Prediction — what signals suggest future threats?',
    contraction: predictiveContraction,
    lyapunovWeight: 0.9,
  },
};

// Weekly rotation:
function currentProfessor(weekNumber: number): Professor {
  const professors: Professor[] = ['mcgonagall', 'hagrid', 'slughorn', 'flitwick', 'trelawney'];
  return professors[weekNumber % 5];
}
```

**Why this matters:** The same homeostatic system, viewed through different lenses, produces different corrections. One week the system prioritizes structural alignment (McGonagall); the next, market exploration (Hagrid). This prevents the Banach contraction from getting stuck in a local minimum — it *shifts its perspective* periodically.

**The fractal law:** Each scale has its own professor rotation. The skill scale rotates through different verification lenses. The venture scale rotates through different market lenses. The portfolio scale rotates through different strategic lenses.

---

## 6. The R3F Engine as Marauder's Map + Diegetic Discovery

### 6.1 What Cambium Has

A React Three Fiber 2.5D visual engine with 5 island nodes connected by rails. Read-only — no interactive gameplay.

### 6.2 The Synthesis: Living Process Map

The R3F engine should become a **Marauder's Map** — a living, real-time updating map of the founder's journey:

**Footprints (activity trails):** Every wake move leaves a visible trail on the map. The trails fade over time but never fully disappear — creating a visible history of movement. Dense trail regions = high activity areas. Sparse regions = unexplored territory.

**Fog-of-War (progressive reveal):** Islands start shrouded in fog. As the founder completes arcs, the fog lifts — not all at once, but in a gradual, organic way. The fog responds to the Guiding Wind — it parts in the direction of viability.

**NPC Avatars:** Mira walks the map. Founder-NPC walks the map. Advisor-NPC walks the map. When you see Mira moving toward an island, she's "sensing" something there. When she's stationary, she's dormant. Her movement IS the Guiding Wind.

**Diegetic Discovery:** No popups. No quest markers. Information is embedded in the world:
- A glowing node = an insight waiting to be collected (Revelio-style)
- A flying spark = a connection between two ideas (Accio-style)
- A floating orb = a suppressed warning (Levioso-style)
- A locked door = understanding that requires more fragments (Alohomora-style)

**Content Sharing Walls:** Each island has a "wall" where the cortex surfaces relevant insights, artifacts, and reflections from past wakes. The wall is not a menu — it's a physical surface in the 3D space.

### 6.3 Spell-Based Discovery (Hogwarts Legacy Field Guide)

The Field Guide Pages in Hogwarts Legacy [^197^][^198^] require different spells to discover:
- Revelio → invisible pages appear
- Accio → flying pages pulled down
- Lumos → moth paintings reveal their secret
- Levioso → orb statues reveal pages
- Incendio → dragon braziers light up

This maps to Cambium's **sense-mode discovery**:

```typescript
// apps/cambium-r3f/src/scene/discovery.ts

interface DiscoveryNode {
  id: string;
  position: Vector3;
  discoveryMethod: SenseMode;
  content: InsightFragment;
  discovered: boolean;
}

// Revelio nodes: invisible until you "cast" revelio near them
// Accio nodes: flying around, need to "pull" them
// Lumos nodes: dark until you shine light on them
// Levioso nodes: buried, need to "lift" them
// Incendio nodes: frozen, need to "warm" them

function discoverNode(node: DiscoveryNode, activeSense: SenseMode): boolean {
  if (node.discoveryMethod === activeSense) {
    node.discovered = true;
    triggerDiscoveryAnimation(node);
    return true;
  }
  return false;
}
```

---

## 7. Event Sourcing as Bloodstains + Memory Reconstruction

### 7.1 What Cambium Has

Every event is logged to `deviations.jsonl`. Full deterministic replay. The replay log is the venture's complete life history.

### 7.2 What Games Do: Elden Ring Bloodstains + Obra Dinn

**Elden Ring Bloodstains** [^208^]: asynchronous echoes of other players' deaths — warnings of dangers ahead. The community acts as a distributed sense organ.

**Return of the Obra Dinn** [^255^][^256^]: reconstruct what happened to a venture (ship) from fragmented traces — the Memento Mortem pocket watch shows the moment of death, but you must deduce the full story.

### 7.3 The Synthesis: The Replay Log as Living Memory

The event log is not just a debugging tool. It is Cambium's **collective memory**:

**Bloodstains:** Failed ventures leave traces in the cortex that warn future operators. When you approach a strategy that has failed before, the R3F engine shows a "bloodstain" — a visual echo of the past failure. The community (past operators) has left a message: "hidden path ahead" or "be wary of trap."

**Memory Reconstruction:** When something goes wrong (viability margin collapses), the operator uses the replay log to reconstruct what happened. Not just "event A happened" but "event A, combined with setpoint move B, in market condition C, led to collapse D." This is the Obra Dinn method applied to business forensics.

**The Ship Log (Outer Wilds):** The cortex organizes information by location and topic, tracking:
- Customer research findings
- Competitor locations and states
- Environmental discoveries (market shifts)
- Clue connections between disparate events [^176^][^183^]

Just as Outer Wilds' Ship Log "records but doesn't solve" [^176^], the cortex captures events but the wake loop synthesizes. The system doesn't hand you answers — it hands you the pieces.

---

## 8. Oddities: The System's Altered Items

### 8.1 What Games Do: Control's Altered Items

Control's Altered Items [^230^][^232^] are ordinary objects infused with paranatural energies — a refrigerator that kills if you look away, a rubber duck that teleports, a Christmas tree that mimics words. They are contained in the Panopticon with ritualistic care processes.

### 8.2 The Synthesis: Oddities in the Business World

Cambium's "oddities" are **data sources or capabilities that behave unpredictably**:

- A customer segment that suddenly grows 10x (the teleporting rubber duck)
- A competitor that copies your every move (the mimicking Christmas tree)
- A cash flow pattern that looks healthy but collapses overnight (the killer refrigerator)
- A skill that works in one market but fails in another (the Object of Power)

These are not bugs. They are **Altered Items** — elements of the business world that have developed unexpected properties. The Panopticon = the cortex's containment system for these anomalies.

```typescript
// bin/operator/oddities.ts — Altered Item containment

interface Oddity {
  id: string;
  name: string;
  mundaneForm: string;       // what it appears to be
  alteredProperty: string;   // what it actually does
  containmentLevel: 'safe' | 'caution' | 'dangerous';
  careProtocol: string[];    // how to manage it
  discoveryVector: number[]; // cortex embedding of the oddity
}

const ODDITY_CATALOG: Oddity[] = [
  {
    id: 'viral-segment',
    name: 'The Viral Customer',
    mundaneForm: 'A small, loyal customer segment',
    alteredProperty: 'Grows 10x overnight, consuming all resources',
    containmentLevel: 'caution',
    careProtocol: ['Monitor daily', 'Cap allocation at 30%', 'Prepare scaling plan'],
  },
  {
    id: 'mimic-competitor',
    name: 'The Mimic',
    mundaneForm: 'A distant competitor in another market',
    alteredProperty: 'Copies your every move within 48 hours',
    containmentLevel: 'dangerous',
    careProtocol: ['Accelerate iteration', 'Keep strategy confidential', 'Diversify approaches'],
  },
  {
    id: 'smooth-cashflow',
    name: 'The Deceptive River',
    mundaneForm: 'Healthy, predictable cash flow',
    alteredProperty: 'Collapses when a single large customer churns',
    containmentLevel: 'dangerous',
    careProtocol: ['Diversify revenue', 'Monitor concentration', 'Build reserves'],
  },
];
```

---

## 9. The Implementation Priority (Fractal Unfold Order)

The implementation follows the fractal's natural unfold — from the innermost scale (skill) to the outermost (portfolio):

### Phase 1: Skill-Scale Senses (Weeks 1-2)
- **Revelio mode** — highlight hidden patterns in skill data
- **Gift Box accumulation** — every wake move generates visible gifts
- **Thought Cabinet** — first 3 thoughts (Rigorous Self-Critique, The Infinite Player, Red Queen Awareness)

### Phase 2: Cluster-Scale Echoes (Weeks 3-4)
- **Echo assignment** — each cluster gets an Echo (archetype)
- **Companion NPC integration** — Mira + Founder-NPC as companion cards
- **Forest Stage router** — 2-3 options per cluster challenge

### Phase 3: Organ-Scale Professors (Weeks 5-6)
- **Professor rotation** — 5 lenses, weekly rotation
- **Odradek scanning** — terrain scan per organ
- **Guiding Wind** — viability direction in R3F

### Phase 4: Venture-Scale Oddities (Weeks 7-8)
- **Oddity catalog** — detect and contain business anomalies
- **Bloodstain system** — failed ventures leave warnings
- **Ship Log** — venture history as navigable knowledge graph

### Phase 5: Portfolio-Scale Community (Weeks 9-10)
- **Content sharing walls** — cross-venture insight streams
- **Guild voting** — collective opportunity selection
- **Dormitory pods** — 4-person venture teams

### Phase 6: Emergent Systems (Weeks 11-12)
- **AI Chat NPCs** — free-text dialogue with Mira
- **Mental worlds** — enter different analytical frames
- **Illusory walls** — barriers that fall with insight, not force

---

## 10. The Fractal Checklist

Every pattern in this document must satisfy the fractal law — it must work at ALL six scales:

| Pattern | Skill | Cluster | Organ | Venture | Company | Portfolio |
|---------|-------|---------|-------|---------|---------|-----------|
| Gift Box | Skill practice rewards | Cluster milestone rewards | Organ run completion | Venture phase unlock | Company milestone | Portfolio event |
| Echo | Skill personality | Cluster thesis | Organ operating model | Venture market thesis | Company culture | Portfolio strategy |
| Companion | Skill helper | Cluster advisor | Organ consultant | Venture co-founder | Company board | Portfolio advisor |
| Revelio | Hidden patterns in data | Unseen cluster dynamics | Latent organ risks | Hidden market signals | Unseen cultural patterns | Portfolio blind spots |
| Guiding Wind | Skill improvement direction | Cluster alignment | Organ viability path | Venture market direction | Company vision direction | Portfolio allocation |
| Odradek | Skill terrain scan | Cluster health scan | Organ obstacle scan | Venture market scan | Company risk scan | Portfolio threat scan |
| Thought | Skill belief | Cluster assumption | Organ doctrine | Venture thesis | Company values | Portfolio philosophy |
| Professor | Verification lens | Exploration lens | Preparation lens | Execution lens | Strategy lens | Governance lens |
| Forest Stage | Skill challenge options | Cluster approach options | Organ execution options | Venture strategy options | Company pivot options | Portfolio allocation options |
| Bloodstain | Failed skill attempts | Failed cluster experiments | Failed organ runs | Failed ventures | Failed companies | Failed portfolio bets |
| Oddity | Anomalous skill behavior | Anomalous cluster dynamics | Anomalous organ output | Market anomaly | Cultural anomaly | Economic anomaly |
| Deck Marking | Skill context modes | Cluster context modes | Organ context modes | Venture context modes | Company context modes | Portfolio context modes |

---

## Appendix: Quick-Reference Game → Cambium Mapping

| Game | Mechanic | Cambium Expression |
|------|----------|-------------------|
| HP Magic Awakened | Gift Box progression | Wake Loop gift accumulation |
| HP Magic Awakened | Echo system | Fractal affinity at every scale |
| HP Magic Awakened | Companion cards | NPC Self-Play characters |
| HP Magic Awakened | Forbidden Forest | Non-linear wake router |
| HP Magic Awakened | Rotating professors | Allostatic lens rotation |
| HP Magic Awakened | Dormitory (4-person) | Venture pod system |
| HP Magic Awakened | Deck marking | Context-aware configuration |
| HP Magic Awakened | Guild voting | Collective opportunity selection |
| HP Magic Awakened | Content sharing walls | Cross-venture insight streams |
| HP Magic Awakened | Flying Ford Anglia (idle) | Dormant-state value accumulation |
| Where Winds Meet | AI Chat NPCs | Mira free-text dialogue |
| Where Winds Meet | NPC befriending | Relationship level unlocks |
| Where Winds Meet | Emergent narrative | Cortex-driven storytelling |
| Witcher 3 | Witcher Senses | Cortex multi-modal perception |
| Ghost of Tsushima | Guiding Wind | Viability gradient navigation |
| Death Stranding | Odradek scanner | Business terrain scanning |
| Elden Ring | Bloodstains/messages | Failed venture warnings |
| Disco Elysium | Thought Cabinet | Cortex self-model |
| Disco Elysium | 24 skill voices | Multi-voice cortex analysis |
| Outer Wilds | Ship Log | Navigable knowledge graph |
| Control | Altered Items | Business anomaly containment |
| Hollow Knight | Hunter's Journal | Entity catalog system |
| Hogwarts Legacy | Field Guide Pages | Spell-based discovery |
| Hogwarts Legacy | Demiguise Moon gating | Fragment-threshold unlocking |
| Return of Obra Dinn | Memory reconstruction | Event log forensics |
| Tunic | Manual pages | Diegetic documentation |
| Psychonauts | Mental worlds | Analytical frame switching |
| Planescape: Torment | Stat-based dialogue | Wisdom-unlocked resolution |
| RDR2 | Living world | Independent agent simulation |
| BOTW | Environmental puzzles | Pattern recognition discovery |
