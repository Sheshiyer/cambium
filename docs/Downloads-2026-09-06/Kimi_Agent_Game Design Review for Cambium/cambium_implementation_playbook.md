# Cambium Game Mechanics Integration Playbook

**From:** AAA Story Mode Game Design Patterns  
**To:** Specific Implementations in the Cambium Codebase  
**Date:** 2026-06-22  
**Based On:** Deep analysis of Harry Potter games (Magic Awakened, Hogwarts Legacy) + 8 AAA titles (Witcher 3, Zelda, Elden Ring, God of War, Horizon, AC Valhalla, Ghost of Tsushima, RDR2)

---

## How to Read This Document

Each section follows this structure:
1. **What Cambium Has Now** — current implementation, files, functions
2. **The Game Pattern** — what we learned from AAA games (brief, focused)
3. **What to Build** — specific changes to Cambium's code
4. **Files to Modify** — exact file paths and functions
5. **Implementation Notes** — gotchas, dependencies, validation approach

---

## 1. Quest System — From Linear to Living

### 1.1 Current State

**File:** `bin/operator/quests/quests.ts`

Cambium has a 17-arc quest line implemented as a **pure function fold**:

```typescript
export function questLedger(inputs: QuestInputs): QuestLedger {
  const results = QUEST_LINE.map((q) => ({ quest: q, ...q.doneWhen(inputs) }));
  // Status: complete | active | locked
  // Current: first incomplete quest
  return { rows, completed, total, current };
}
```

The `QUEST_LINE` array is flat and strictly linear. Each quest has a `doneWhen` predicate that checks real world-state (onboarding completion, log entries, tenant count, etc.). This is Cambium's unfair advantage — quest progress derives from REAL business activity, not a stored counter.

**Arcs I-IX** are the founder tutorial. **Arcs X-XVII** are project delivery phases. Status is ternary: `complete | active | locked`. No partial progress, no branching, no side content.

**Render file:** `bin/operator/quests/panel.ts` renders the quest panel. **R3F display:** `apps/cambium-r3f/src/scene/scene-data.ts` composes the scene but quests are text-only in the HUD — no quest visualization in the 3D space.

### 1.2 What AAA Games Do Differently

**Hogwarts Legacy** has 4 quest types (Main, Side, Relationship, Assignments) totaling 94+ quests. The companion questlines (Sebastian's 10-quest Dark Arts arc, Poppy's beast rights arc) create emotional investment that drives players to complete side content. **Witcher 3** uses a mystery framework where quests are investigations with partial info. **Zelda** lets players tackle main quests in any order.

The key insight: **variety of quest types + emotional NPC questlines + player agency = sustained engagement.**

### 1.3 Integration: Side-Quests (Easy)

**What to build:** Add a `SIDE_QUEST_LINE` alongside `QUEST_LINE`. Side-quests auto-activate when world-state conditions are met. They are optional, have small rewards, and expire when conditions change.

**Code changes:**

```typescript
// bin/operator/quests/quests.ts — Add to existing file

interface SideQuest {
  id: string;
  title: string;
  description: string;
  trigger: (inputs: QuestInputs) => boolean;      // when it appears
  doneWhen: (inputs: QuestInputs) => { done: boolean; evidence: string };
  rewards: QuestReward[];
  expiresWhen?: (inputs: QuestInputs) => boolean;  // optional: when it disappears
}

const SIDE_QUEST_LINE: SideQuest[] = [
  {
    id: 'resonance-hunter',
    title: 'The Resonance Hunter',
    description: 'Your ICP resonance has dropped below 30%. Time to rediscover what the market truly wants.',
    trigger: (i) => i.icpReading.resonance < 0.3,
    doneWhen: (i) => ({ done: i.icpReading.resonance > 0.6, evidence: `Resonance at ${i.icpReading.resonance}` }),
    rewards: [{ type: 'buff', target: 'icp-clarity', value: 0.1, duration: 7 * 24 * 60 * 60 * 1000 }], // 7 days
    expiresWhen: (i) => i.icpReading.resonance > 0.8, // expires if resonance recovers without completing
  },
  {
    id: 'memory-keeper',
    title: 'The Memory Keeper',
    description: 'You have gathered 10+ memories. Review and organize them to sharpen your decision-making.',
    trigger: (i) => i.cortexCount >= 10,
    doneWhen: (i) => ({ done: i.cortexReviewed >= 5, evidence: `${i.cortexReviewed} memories reviewed` }),
    rewards: [{ type: 'unlock', target: 'cortex-insight-mode' }],
  },
  {
    id: 'gate-keeper',
    title: 'The Gate Keeper',
    description: 'You have passed 5 ship gates. Establish a formal review process to scale quality.',
    trigger: (i) => i.gateApprovals >= 5,
    doneWhen: (i) => ({ done: i.reviewProcessDefined, evidence: i.reviewProcessDefined ? 'Process defined' : 'Pending' }),
    rewards: [{ type: 'title', target: 'Quality Guardian' }],
  },
  {
    id: 'triple-threat',
    title: 'Triple Threat',
    description: 'Use micro, meso, and macro moves all in one day to master the full operating range.',
    trigger: (i) => i.microToday > 0 || i.mesoToday > 0 || i.macroToday > 0,
    doneWhen: (i) => ({ done: i.microToday > 0 && i.mesoToday > 0 && i.macroToday > 0, evidence: `Micro: ${i.microToday}, Meso: ${i.mesoToday}, Macro: ${i.macroToday}` }),
    rewards: [{ type: 'xp', value: 50 }],
    expiresWhen: (i) => i.dayElapsed, // expires at end of day
  },
  // Add 6-8 more side-quests following this pattern
];
```

**Modify `questLedger` to include side-quests:**

```typescript
export interface QuestLedger {
  rows: QuestLedgerRow[];           // main quest line
  sideQuests: SideQuestLedgerRow[]; // NEW: active side quests
  completed: number;
  total: number;
  current: Quest | null;
}

export function questLedger(inputs: QuestInputs): QuestLedger {
  // ... existing main quest logic ...
  
  const sideQuests = SIDE_QUEST_LINE
    .filter((sq) => sq.trigger(inputs) && !sq.expiresWhen?.(inputs))
    .map((sq) => ({
      quest: sq,
      status: sq.doneWhen(inputs).done ? 'complete' : 'active',
      progress: computeSideQuestProgress(sq, inputs), // 0-1
      evidence: sq.doneWhen(inputs).evidence,
    }));
  
  return { rows, sideQuests, completed, total, current };
}
```

**Files to modify:**
- `bin/operator/quests/quests.ts` — Add `SideQuest` interface, `SIDE_QUEST_LINE`, modify `questLedger()` return type
- `bin/operator/quests/panel.ts` — Render side-quests in a separate section below main quests
- `bin/operator/types.ts` — Add `QuestReward` type
- `apps/cambium-r3f/src/scene/SceneHud.tsx` — Show active side-quest indicators

**Validation:** Side-quests must auto-appear when trigger conditions are met and disappear when expired. Test with synthetic quest inputs.

### 1.4 Integration: Quest Progress Bars (Easy)

**What to build:** Each main quest gets a `progress: (inputs) => number` function that returns 0-1 based on quantifiable evidence.

**Code changes:**

```typescript
// bin/operator/quests/quests.ts

interface Quest {
  id: string;
  title: string;
  doneWhen: (inputs: QuestInputs) => { done: boolean; evidence: string };
  progress: (inputs: QuestInputs) => number; // NEW: 0-1 based on evidence
  rewards: QuestReward[];                    // NEW
}

// Example progress functions for existing arcs:
const QUEST_LINE: Quest[] = [
  {
    id: 'the-calling',
    // ... existing fields ...
    progress: (i) => Math.min(i.onboarding.stepIndex / 20, 1),
    rewards: [{ type: 'title', target: 'Called' }],
  },
  {
    id: 'taste-resonance',
    // ... existing fields ...
    progress: (i) => Math.min(count(i.log, 'meso') / 3, 1),
    rewards: [{ type: 'unlock', target: 'icp-deep-dive' }],
  },
  {
    id: 'the-loop',
    // ... existing fields ...
    progress: (i) => {
      let p = 0;
      if (i.microExercised) p += 0.34;
      if (i.mesoExercised) p += 0.33;
      if (i.macroExercised) p += 0.33;
      return p;
    },
    rewards: [{ type: 'buff', target: 'allostatic-range', value: 0.1 }],
  },
  {
    id: 'viability',
    progress: (i) => {
      const heartbeats = count(i.log, 'heartbeat');
      const sweeps = count(i.log, 'viability');
      return heartbeats > 0 || sweeps > 0 ? 1 : 0; // binary for this one
    },
    rewards: [{ type: 'unlock', target: 'viability-dashboard' }],
  },
  // ... apply to all 17 arcs
];
```

**R3F rendering:** Render quest nodes with partial-fill rings. Active quest = pulsing ring at `progress * 360` degrees. Complete quest = full ring with particle burst.

**Files to modify:**
- `bin/operator/quests/quests.ts` — Add `progress` to `Quest`, implement for all 17 arcs
- `bin/operator/quests/panel.ts` — Show progress bars in quest panel
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` — Render partial-fill rings on quest nodes
- `apps/cambium-r3f/src/scene/visual-tokens.ts` — Add `progressPartial` color variant

### 1.5 Integration: Quest Rewards (Easy)

**What to build:** Each quest has tangible rewards beyond status reveal. 4 reward types: `unlock` (feature/tool), `buff` (temporary boost), `title` (cosmetic), `ability` (new action).

**Code changes:**

```typescript
// bin/operator/types.ts

interface QuestReward {
  type: 'unlock' | 'buff' | 'title' | 'ability';
  target: string;           // what it unlocks
  value?: number;           // buff magnitude
  duration?: number;        // temporary buff duration (ms)
}

// Add to WorldState
interface WorldState {
  // ... existing fields ...
  unlockedRewards: string[];    // list of unlocked reward IDs
  activeBuffs: ActiveBuff[];    // currently active temporary buffs
  titles: string[];             // unlocked titles
}

interface ActiveBuff {
  id: string;
  target: string;
  value: number;
  expiresAt: number; // epoch ms
}
```

**Apply rewards on quest completion:**

```typescript
// bin/operator/quests/quests.ts — in questLedger or a new function

export function applyRewards(
  world: WorldState,
  newlyCompletedQuests: Quest[]
): { world: WorldState; rewardsApplied: QuestReward[] } {
  const rewardsApplied: QuestReward[] = [];
  let next = { ...world };
  
  for (const quest of newlyCompletedQuests) {
    for (const reward of quest.rewards) {
      switch (reward.type) {
        case 'unlock':
          if (!next.unlockedRewards.includes(reward.target)) {
            next.unlockedRewards = [...next.unlockedRewards, reward.target];
            rewardsApplied.push(reward);
          }
          break;
        case 'buff':
          next.activeBuffs = [...next.activeBuffs, {
            id: `${quest.id}-${reward.target}`,
            target: reward.target,
            value: reward.value ?? 0.1,
            expiresAt: Date.now() + (reward.duration ?? 7 * 24 * 60 * 60 * 1000),
          }];
          rewardsApplied.push(reward);
          break;
        case 'title':
          if (!next.titles.includes(reward.target)) {
            next.titles = [...next.titles, reward.target];
            rewardsApplied.push(reward);
          }
          break;
      }
    }
  }
  
  // Clean expired buffs
  next.activeBuffs = next.activeBuffs.filter((b) => b.expiresAt > Date.now());
  
  return { world: next, rewardsApplied };
}
```

**Example reward mapping for all 17 arcs:**

| Arc | Reward | Type | What It Does |
|-----|--------|------|-------------|
| I · The Calling | Title: "Called" | title | Cosmetic |
| II · First Mint | Unlock: brand-editor | unlock | Edit brand DNA fields |
| III · Taste & Resonance | Buff: +10% ICP clarity | buff | Better resonance readings for 7 days |
| IV · The Loop | Unlock: allostatic-viz | unlock | See allostatic range in R3F |
| V · Viability | Unlock: viab-dashboard | unlock | Full viability margins board |
| VI · Memory | Unlock: cortex-search | unlock | Search past decisions |
| VII · Many Gardens | Title: "Gardener" + Theme: multi-tenant | title + cosmetic | Visual skin for islands |
| VIII+ | TBD per project arc | — | — |

**Files to modify:**
- `bin/operator/types.ts` — Add `QuestReward`, `ActiveBuff`, extend `WorldState`
- `bin/operator/quests/quests.ts` — Add `applyRewards`, add `rewards[]` to each Quest
- `bin/operator/world.ts` — Add `unlockedRewards`, `activeBuffs`, `titles` to world state
- `bin/operator/quests/panel.ts` — Show reward summary on quest completion
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` — Particle burst on quest complete

### 1.6 Integration: Branching Quest Paths (Medium)

**What to build:** Replace the flat `QUEST_LINE` array with a **DAG (directed acyclic graph)**. Quests can have prerequisites (`requires`) and branch exclusivity (`branches` — only one branch can be active).

**Code changes:**

```typescript
// bin/operator/quests/quests.ts

interface Quest {
  id: string;
  title: string;
  requires?: string[];        // quest IDs that must be complete first
  branches?: string[];        // mutually exclusive quest IDs (only one active)
  doneWhen: (inputs: QuestInputs) => { done: boolean; evidence: string };
  progress: (inputs: QuestInputs) => number;
  rewards: QuestReward[];
}

// Resolution algorithm (replaces linear iteration):
export function questLedger(inputs: QuestInputs): QuestLedger {
  // Build dependency graph
  const completed = new Set<string>();
  const results = new Map<string, { done: boolean; evidence: string; progress: number }>();
  
  // First pass: evaluate all quests
  for (const quest of QUEST_LINE) {
    const doneResult = quest.doneWhen(inputs);
    results.set(quest.id, {
      done: doneResult.done,
      evidence: doneResult.evidence,
      progress: quest.progress(inputs),
    });
    if (doneResult.done) completed.add(quest.id);
  }
  
  // Second pass: determine status considering prerequisites and branches
  const rows: QuestLedgerRow[] = [];
  let current: Quest | null = null;
  
  for (const quest of QUEST_LINE) {
    const result = results.get(quest.id)!;
    let status: QuestStatus;
    
    if (result.done) {
      status = 'complete';
    } else if (quest.requires?.some((r) => !completed.has(r))) {
      status = 'locked';
    } else if (quest.branches?.some((b) => b !== quest.id && !completed.has(b) && isActive(b))) {
      // Another branch is active — this one is locked
      status = 'locked';
    } else if (!current) {
      status = 'active';
      current = quest;
    } else {
      status = 'pending'; // NEW: available but not the current focus
    }
    
    rows.push({ quest, status, progress: result.progress, evidence: result.evidence });
  }
  
  return { rows, completed: completed.size, total: QUEST_LINE.length, current };
}
```

**Files to modify:**
- `bin/operator/quests/quests.ts` — DAG resolution (larger change)
- `bin/operator/quests/panel.ts` — Handle `pending` status (available side paths)
- `apps/cambium-r3f/src/scene/scene-data.ts` — Visualize branching paths

---

## 2. Skill Forge — From Flat List to Mastery Tree

### 2.1 Current State

**Files:** `bin/operator/skills/forge.ts`, `bin/operator/skills/telemetry.ts`

The Skill Forge has three lifecycle stages: `candidate -> validated -> production`. Skills are auto-detected when a pattern repeats >= 3x. Telemetry tracks uses, successes, failures, scenarios, gotchas, and auto-amendments when success rate drops below 0.5.

**Current skill record:**

```typescript
interface SkillRecord {
  skill_id: string;
  status: 'candidate' | 'validated' | 'production';
  category: 'delivery' | 'governance';
  description: string;        // USE WHEN ... NOT FOR ...
  trigger_signals: string[];
  required_inputs: Array<{name, source, required}>;
  output_contract: {format, location};
  verification_steps: string[];
  promotion_rule: string;
  source: {signature, from, occurrences};
  telemetry: {uses, successes, failures, scenarios, gotchas, amendments};
}
```

**Key gap:** The system is flat. No tree, no prerequisites, no visual representation, no mastery levels.

### 2.2 What God of War Ragnarok Does

Skill Labors: each move has Bronze -> Silver -> Gold tiers reached by USING it enough times. "I saw the tier goals as mini-progression hooks, giving me a set of checklists to strive toward" [^60^]. Gold tier unlocks one of three enhancement options (Damage, Stun, Protection).

### 2.3 Integration: Skill Labors — Mastery Tiers (Easy)

**What to build:** Add `mastery_tier` to `SkillRecord` based on existing telemetry counters. Bronze at 10 uses, Silver at 50, Gold at 100. Gold unlocks enhancement options.

**Code changes:**

```typescript
// bin/operator/skills/forge.ts — extend SkillRecord

interface SkillRecord {
  // ... existing fields ...
  mastery_tier: 'none' | 'bronze' | 'silver' | 'gold';
  enhancement?: 'precision' | 'speed' | 'depth'; // unlocked at gold
}

// Add to mintSkill:
export function mintSkill(candidate: SkillCandidate, now: number): SkillRecord {
  return {
    // ... existing fields ...
    mastery_tier: 'none',
    enhancement: undefined,
  };
}

// Add tier computation (pure function):
export function computeMasteryTier(telemetry: SkillRecord['telemetry']): 'none' | 'bronze' | 'silver' | 'gold' {
  if (telemetry.uses >= 100) return 'gold';
  if (telemetry.uses >= 50) return 'silver';
  if (telemetry.uses >= 10) return 'bronze';
  return 'none';
}

// In the telemetry update path:
export function updateMastery(skill: SkillRecord): SkillRecord {
  const newTier = computeMasteryTier(skill.telemetry);
  if (newTier === skill.mastery_tier) return skill;
  
  return {
    ...skill,
    mastery_tier: newTier,
    // Enhancement unlock prompt at gold tier
    enhancement: newTier === 'gold' ? undefined : skill.enhancement,
  };
}
```

**R3F visualization:** Render skills as nodes. Bronze = dim copper glow. Silver = bright silver. Gold = golden halo with particle effect. Connection lines to parent skills glow based on tier.

**Files to modify:**
- `bin/operator/skills/forge.ts` — Add `mastery_tier`, `computeMasteryTier()`, `updateMastery()`
- `bin/operator/skills/telemetry.ts` — Call `updateMastery()` after recording use
- `bin/operator/types.ts` — Update `SkillRecord` interface
- `apps/cambium-r3f/src/scene/` — New `SkillNodes.tsx` component for 3D skill visualization

### 2.4 Integration: Skill Tree Structure (Medium)

**What to build:** Add `parent`/`children` fields to create a tree. Root nodes = categories (delivery, governance). Branch nodes = domains (brand, code, ops, GTM). Leaf nodes = individual skills.

**Code changes:**

```typescript
// bin/operator/skills/forge.ts

interface SkillRecord {
  // ... existing fields ...
  parent?: string;           // parent skill_id
  children: string[];        // child skill_ids
  tier_depth: number;        // 0 = root, 1 = domain, 2 = leaf
  domain: 'brand' | 'code' | 'ops' | 'gtm' | 'memory';
}

// Tree layout for R3F (hierarchical):
export function layoutSkillTree(skills: SkillRecord[]): SkillTreeNode[] {
  const byId = new Map(skills.map((s) => [s.skill_id, s]));
  const roots = skills.filter((s) => !s.parent);
  
  function layoutNode(skill: SkillRecord, depth: number, angle: number, spread: number): SkillTreeNode {
    const children = skill.children.map((c) => byId.get(c)!).filter(Boolean);
    const childSpread = spread / Math.max(children.length, 1);
    
    return {
      skill,
      position: {
        x: Math.cos(angle) * depth * 2,
        y: Math.sin(angle) * depth * 2,
        z: 0,
      },
      children: children.map((child, i) =>
        layoutNode(child, depth + 1, angle - spread/2 + i * childSpread, childSpread)
      ),
    };
  }
  
  return roots.map((root, i) => layoutNode(root, 0, (i / roots.length) * Math.PI * 2, Math.PI * 2 / roots.length));
}
```

**Files to modify:**
- `bin/operator/skills/forge.ts` — Add tree fields, `layoutSkillTree()`
- `bin/operator/types.ts` — Update `SkillRecord` with tree fields
- `apps/cambium-r3f/src/scene/` — New `SkillTreeScene.tsx`

---

## 3. Progression System — From Binary to Curved

### 3.1 Current State

Cambium has no explicit progression system. Quests are complete/active/locked. Skills are candidate/validated/production. There's no "level," no XP, no power curve. The founder doesn't "level up."

### 3.2 What Games Do

**Elden Ring** uses exponential scaling (Level 50 = early game, Level 150 = endgame, each level costs more). **Ghost of Tsushima** ties progression to narrative reputation — Jin becomes more legendary. **Hogwarts Legacy** gates content behind spell acquisition (Alohomora 3-tier system).

### 3.3 Integration: Founder Level + XP (Easy)

**What to build:** Add a `FounderLevel` to `WorldState`. XP is derived from all existing events. Levels unlock perks.

**Code changes:**

```typescript
// bin/operator/types.ts

interface FounderLevel {
  level: number;       // 1-50 (derived from XP)
  xp: number;          // cumulative
  xpToNext: number;    // XP needed for next level
  title: string;       // e.g., "Seed Planter", "Brand Smith"
}

// XP sources (derived from existing events):
const XP_TABLE = {
  questComplete: 100,
  skillValidate: 50,
  skillProduction: 200,
  onboardingStep: 10,
  heartbeatSurvive: 5,
  microMove: 2,
  mesoMove: 5,
  macroMove: 10,
  noesisMoment: 25,
  sideQuestComplete: 75,
  challengeComplete: 30,
  streak3Day: 50,
  streak7Day: 150,
  streak30Day: 500,
};

// Level curve (exponential):
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8));
}

// Title per level bracket:
const TITLES = [
  { min: 1, title: 'Seed Planter' },
  { min: 5, title: 'Sprout' },
  { min: 10, title: 'Brand Smith' },
  { min: 15, title: 'Venture Walker' },
  { min: 20, title: 'Loop Master' },
  { min: 25, title: 'Cortex Navigator' },
  { min: 30, title: 'Multi-Gardener' },
  { min: 40, title: 'Infinite Player' },
  { min: 50, title: 'Venture Architect' },
];

// Compute level from XP (pure function):
export function computeLevel(xp: number): FounderLevel {
  let level = 1;
  while (xp >= xpForLevel(level + 1) && level < 50) {
    level++;
  }
  return {
    level,
    xp,
    xpToNext: xpForLevel(level + 1) - xp,
    title: TITLES.findLast((t) => level >= t.min)?.title ?? 'Beginner',
  };
}
```

**Files to modify:**
- `bin/operator/types.ts` — Add `FounderLevel`, `XP_TABLE`
- `bin/operator/world.ts` — Add XP calculation to `commit()` or as a pure fold
- `bin/operator/quests/quests.ts` — Add XP to quest rewards
- `bin/operator/skills/telemetry.ts` — Award XP on validation/production
- `apps/cambium-r3f/src/scene/SceneHud.tsx` — Render XP bar + level badge

### 3.4 Integration: Insight Fragments (Alohomora-Style Gating)

**What to build:** Instead of generic XP, use "insight fragments" collected through business activities. Fragments unlock specific capabilities at thresholds (like collecting 9 Demiguise Moons upgrades Alohomora to Level 2).

**Code changes:**

```typescript
// bin/operator/types.ts

interface InsightFragment {
  id: string;
  category: 'customer' | 'product' | 'brand' | 'market' | 'operations';
  count: number;
  thresholds: number[]; // e.g., [9, 22] for 3 tiers
}

// Tier unlocks:
const FRAGMENT_UNLOCKS: Record<string, Record<number, string>> = {
  customer: {
    9: 'customer-persona-tool',      // 9 customer interactions
    22: 'jtbd-framework',             // 22 interactions
    50: 'pricing-validation-model',   // 50 interactions
  },
  product: {
    9: 'velocity-tracker',
    22: 'quality-gate-automation',
    50: 'release-orchestrator',
  },
  brand: {
    9: 'brand-health-monitor',
    22: 'competitive-positioning-radar',
    50: 'market-share-tracker',
  },
};

// Award fragments on relevant events:
export function awardFragments(
  world: WorldState,
  event: GameEvent
): { world: WorldState; newUnlocks: string[] } {
  const fragments = { ...world.insightFragments };
  const newUnlocks: string[] = [];
  
  if (event.kind === 'icp_interaction') {
    fragments.customer = (fragments.customer ?? 0) + 1;
    const unlock = FRAGMENT_UNLOCKS.customer[fragments.customer];
    if (unlock && !world.unlockedRewards.includes(unlock)) {
      newUnlocks.push(unlock);
    }
  }
  
  if (event.kind === 'deploy') {
    fragments.product = (fragments.product ?? 0) + 1;
    const unlock = FRAGMENT_UNLOCKS.product[fragments.product];
    if (unlock && !world.unlockedRewards.includes(unlock)) {
      newUnlocks.push(unlock);
    }
  }
  
  // ... etc for each fragment category
  
  return { world: { ...world, insightFragments: fragments }, newUnlocks };
}
```

**Files to modify:**
- `bin/operator/types.ts` — Add `InsightFragment`, fragment types
- `bin/operator/world.ts` — Add `insightFragments` to `WorldState`
- `bin/operator/operator.ts` — Call `awardFragments()` in the wake loop
- `apps/cambium-r3f/src/scene/SceneHud.tsx` — Fragment counters per category

---

## 4. NPC System — From Stateless to Living

### 4.1 Current State

**File:** `bin/operator/npc.ts`

Two NPCs:
- **ICP-NPC "Mira":** Returns pains[], direction, resonance. Deterministic stub by default (seeded hash). Real: NVIDIA NIM -> Kimi fallback.
- **Founder-NPC:** Returns intentBit ('error' | 'intent'). Deterministic stub reads `event.intent` bit.

**Critical gap:** NPCs are **stateless**. No memory of past interactions, no relationship progression, no emotional states.

### 4.2 What Hogwarts Legacy Does

Sebastian Sallow has a 10-quest arc where he evolves from a curious student to a Dark Arts practitioner. Each quest changes his dialogue, unlocks new spells, and affects the world's perception of the player. By the final quest, players feel a genuine emotional connection.

### 4.3 Integration: NPC Relationship System (Medium)

**What to build:** Add a 10-level relationship progression for Mira. Each level unlocks new capabilities and dialogue. Use the cortex to store interaction history.

**Code changes:**

```typescript
// bin/operator/types.ts

interface NpcRelationship {
  npcId: 'mira' | 'founder';
  level: number;              // 1-10
  interactions: number;       // total conversation count
  lastTopic?: string;
  affinity: number;           // -1 to 1 (how much NPC likes founder's style)
  unlockedDialogues: string[];
  memoryVector?: number[];    // 1024-d embedding of conversation history
}

// Level capabilities:
const MIRA_LEVELS: Record<number, { title: string; unlocks: string[] }> = {
  1: { title: 'Stranger', unlocks: ['basic-pain-query'] },
  2: { title: 'Acquaintance', unlocks: ['resonance-reading'] },
  3: { title: 'Colleague', unlocks: ['competitive-insight'] },
  4: { title: 'Trusted', unlocks: ['proactive-suggestion'] },
  5: { title: 'Advisor', unlocks: ['market-forecast'] },
  6: { title: 'Partner', unlocks: ['auto-validate-moves'] },
  7: { title: 'Confidant', unlocks: ['hidden-opportunity-reveal'] },
  8: { title: 'Ally', unlocks: ['crisis-prediction'] },
  9: { title: 'Mentor', unlocks: ['founder-growth-path'] },
  10: { title: 'Co-Founder', unlocks: ['full-autonomy-mode'] },
};

// Level up triggers:
function computeMiraLevel(relationship: NpcRelationship): number {
  if (relationship.interactions >= 200) return 10;
  if (relationship.interactions >= 150) return 9;
  if (relationship.interactions >= 100) return 8;
  if (relationship.interactions >= 75) return 7;
  if (relationship.interactions >= 50) return 6;
  if (relationship.interactions >= 35) return 5;
  if (relationship.interactions >= 20) return 4;
  if (relationship.interactions >= 10) return 3;
  if (relationship.interactions >= 5) return 2;
  return 1;
}
```

**Store interactions in cortex:**

```typescript
// bin/operator/npc.ts — before generating response

export async function queryMira(
  event: GameEvent,
  world: WorldState,
  deps: WakeDeps
): Promise<MiraResponse> {
  // 1. Query cortex for past interactions with Mira
  const pastInteractions = await deps.cortex.search(
    await deps.embed(`${event.kind} ${JSON.stringify(event.payload)}`),
    5,
    { kind: 'npc_interaction', tenant: world.tenant, npcId: 'mira' }
  );
  
  // 2. Get current relationship
  const relationship = world.npcRelationships?.mira ?? {
    npcId: 'mira',
    level: 1,
    interactions: 0,
    affinity: 0,
    unlockedDialogues: [],
  };
  
  // 3. Build prompt with memory context
  const memoryContext = pastInteractions
    .map((r) => `Previous: ${r.payload.topic} -> ${r.payload.insight}`)
    .join('\n');
  
  const prompt = `You are Mira, an ICP-NPC with a ${MIRA_LEVELS[relationship.level].title} relationship with this founder.\n${memoryContext}\nCurrent event: ${JSON.stringify(event)}`;
  
  // 4. Generate response via LLM
  const response = await deps.llm.complete(prompt);
  
  // 5. Store interaction in cortex
  await deps.cortex.upsert({
    id: `${world.tenant}:npc_interaction:${event.id}`,
    kind: 'npc_interaction',
    tenant: world.tenant,
    vector: await deps.embed(response.text),
    payload: { npcId: 'mira', topic: event.kind, insight: response.text, level: relationship.level },
    ts: Date.now(),
  });
  
  return parseMiraResponse(response.text);
}
```

**Files to modify:**
- `bin/operator/types.ts` — Add `NpcRelationship`, `MiraResponse`
- `bin/operator/npc.ts` — Add relationship querying, cortex memory integration
- `bin/operator/cortex-memory.ts` — Ensure `npc_interaction` kind is supported
- `bin/operator/operator.ts` — Update relationship on each NPC interaction
- `apps/cambium-r3f/src/scene/` — Relationship meter UI

---

## 5. Discovery & Exploration — From Exposed to Revealed

### 5.1 Current State

All 10 R3F screens are always visible. All features are documented. No secrets, no collectibles, no fog-of-war, no progressive discovery.

### 5.2 What Games Do

**Hogwarts Legacy:** 95 Merlin Trials (9 puzzle types), 30 Demiguise Moons, 150+ Field Guide Pages. Collecting moons UPGRADES Alohomora, which UNLOCKS new areas. **Elden Ring:** Players collectively map secrets — "many players completely missed an entire underground city" [^59^]. **Ghost of Tsushima:** Wind guides players without explicit markers.

### 5.3 Integration: Fog-of-War for Screens (Easy)

**What to build:** Add `unlockCondition` to `ScreenSpec`. Undiscovered screens show as "???" in the route dock. Undiscovered islands in R3F render as fog/mist.

**Code changes:**

```typescript
// apps/cambium-r3f/src/scene/route-registry.ts

interface ScreenSpec {
  id: string;
  label: string;
  route: string;
  unlockCondition?: (worldState: WorldStateSnapshot) => boolean; // NEW
}

export const SCREENS: ScreenSpec[] = [
  { id: 'home', label: 'Overview', route: '/' }, // always unlocked
  { id: 'genesis', label: 'Genesis', route: '/genesis', unlockCondition: (w) => w.arcsCompleted >= 1 },
  { id: 'taste', label: 'Taste', route: '/taste', unlockCondition: (w) => w.arcsCompleted >= 2 },
  { id: 'build', label: 'Build', route: '/build', unlockCondition: (w) => w.arcsCompleted >= 3 },
  { id: 'ops', label: 'Ops', route: '/ops', unlockCondition: (w) => w.arcsCompleted >= 4 },
  { id: 'cortex', label: 'Cortex', route: '/cortex', unlockCondition: (w) => w.cortexCount >= 1 },
  { id: 'visualizations', label: 'Viz', route: '/viz', unlockCondition: (w) => w.arcsCompleted >= 4 },
  { id: 'quests', label: 'Quests', route: '/quests', unlockCondition: (w) => w.arcsCompleted >= 1 },
  { id: 'skills', label: 'Skills', route: '/skills', unlockCondition: (w) => w.skillsValidated >= 1 },
  { id: 'settings', label: 'Settings', route: '/settings' }, // always unlocked
];
```

**R3F fog rendering:**

```typescript
// apps/cambium-r3f/src/scene/CambiumScene.tsx — in node rendering

function IslandNode({ node, worldState }: { node: SceneNode; worldState: WorldStateSnapshot }) {
  const isUnlocked = !node.unlockCondition || node.unlockCondition(worldState);
  
  if (!isUnlocked) {
    return (
      <mesh position={node.position}>
        <boxGeometry args={[node.size, node.size, node.size * 0.3]} />
        <fogMaterial opacity={0.3} color="#8B9DA0" /> {/* misty grey */}
        <Html center>
          <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>???</span>
        </Html>
      </mesh>
    );
  }
  
  // ... existing rendering ...
}
```

**Files to modify:**
- `apps/cambium-r3f/src/scene/route-registry.ts` — Add `unlockCondition`, `WorldStateSnapshot` type
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` — Fog rendering for locked nodes
- `apps/cambium-r3f/src/scene/SceneHud.tsx` — Hide/show route dock items based on unlock state
- `apps/cambium-r3f/src/scene/visual-tokens.ts` — Add fog material

### 5.4 Integration: Secrets & Collectibles (Easy)

**What to build:** Hidden achievements that trigger on unusual world-state combinations. Collectibles stored in `WorldState.artifacts`.

**Code changes:**

```typescript
// bin/operator/quests/quests.ts — Secret definitions

interface Secret {
  id: string;
  name: string;
  description: string;      // shown when discovered
  hint: string;             // vague clue before discovery
  trigger: (world: WorldState) => boolean;
  reward?: QuestReward;
}

const SECRETS: Secret[] = [
  {
    id: 'the-hidden-path',
    name: 'The Hidden Path',
    description: 'You have walked all three lanes extensively. True mastery lies in balance.',
    hint: 'Balance your approach to find what others miss.',
    trigger: (w) => w.microCount > 100 && w.mesoCount > 100 && w.macroCount > 100,
    reward: { type: 'title', target: 'The Balanced' },
  },
  {
    id: 'the-echo',
    name: 'The Echo',
    description: 'Your memory runs deep. The past speaks to those who listen.',
    hint: 'Collect memories and listen for echoes.',
    trigger: (w) => w.cortexCount > 50 && w.noesisMoments > 10,
    reward: { type: 'unlock', target: 'cortex-time-travel' },
  },
  {
    id: 'the-perfect-loop',
    name: 'The Perfect Loop',
    description: 'Flawless execution. Every skill, every time.',
    hint: 'Perfection is not a destination but a habit.',
    trigger: (w) => w.skills.every((s) => s.telemetry.successes > 0 && s.telemetry.failures === 0),
    reward: { type: 'title', target: 'The Flawless' },
  },
  {
    id: 'the-sleepless',
    name: 'The Sleepless',
    description: '30 consecutive days of heartbeat. The operator never rests.',
    hint: 'Consistency is the mark of the committed.',
    trigger: (w) => w.heartbeatStreak >= 30,
    reward: { type: 'buff', target: 'resilience', value: 0.2, duration: 30 * 24 * 60 * 60 * 1000 },
  },
  {
    id: 'the-pivot',
    name: 'The Pivot',
    description: 'You have redirected your vision and survived. Adaptation is evolution.',
    hint: 'Sometimes the bravest move is to change direction.',
    trigger: (w) => w.repositionCount >= 3 && w.viabilitySurvived >= 3,
    reward: { type: 'title', target: 'The Adaptable' },
  },
];

// Check secrets in questLedger or as a separate pure function:
export function checkSecrets(world: WorldState): { discovered: Secret[]; newlyDiscovered: Secret[] } {
  const previouslyDiscovered = new Set(world.discoveredSecrets ?? []);
  const discovered = SECRETS.filter((s) => s.trigger(world));
  const newlyDiscovered = discovered.filter((s) => !previouslyDiscovered.has(s.id));
  return { discovered, newlyDiscovered };
}
```

**Files to modify:**
- `bin/operator/quests/quests.ts` — Add `Secret` interface, `SECRETS`, `checkSecrets()`
- `bin/operator/types.ts` — Add `discoveredSecrets` to `WorldState`
- `bin/operator/world.ts` — Add `discoveredSecrets` initialization
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` — Secret discovery animation (particle burst + UI toast)

---

## 6. Engagement Loops — From Heartbeat to Ritual

### 6.1 Current State

Only the heartbeat (`heartbeat.ts`) provides regular engagement. No daily challenges, no streaks, no achievements, no leaderboards.

### 6.2 What Games Do

**Fortnite:** 3 daily challenges. **Duolingo:** Streak tracking with recovery. **Magic Awakened:** Gift boxes from any gameplay that unlock story. **Hogwarts Legacy:** Field Guide challenge categories (Exploration, Combat, Quests, Collection).

### 6.3 Integration: Daily Challenges (Easy)

**What to build:** Extend `heartbeat.ts` to generate 3 daily challenges. Challenges are stored in world state and checked on each wake.

**Code changes:**

```typescript
// bin/operator/types.ts

interface Challenge {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly';
  criteria: (world: WorldState) => boolean;
  reward: QuestReward;
  expiresAt: number;       // epoch ms
  completedAt?: number;    // epoch ms
}

// bin/operator/heartbeat.ts

const DAILY_CHALLENGE_POOL = [
  {
    id: 'micro-moves',
    title: 'Fine Tuner',
    description: 'Make 3 micro moves today.',
    criteria: (w) => w.microToday >= 3,
    reward: { type: 'xp', value: 30 },
  },
  {
    id: 'check-viability',
    title: 'Vigilant',
    description: 'Run one viability check.',
    criteria: (w) => w.viabilityChecksToday >= 1,
    reward: { type: 'xp', value: 20 },
  },
  {
    id: 'review-skill',
    title: 'Skill Sharpening',
    description: 'Review one skill in the forge.',
    criteria: (w) => w.skillReviewsToday >= 1,
    reward: { type: 'xp', value: 25 },
  },
  {
    id: 'consult-mira',
    title: 'Market Pulse',
    description: 'Ask Mira about the ICP.',
    criteria: (w) => w.miraQueriesToday >= 1,
    reward: { type: 'xp', value: 35 },
  },
  {
    id: 'meso-move',
    title: 'Course Corrector',
    description: 'Make one meso move today.',
    criteria: (w) => w.mesoToday >= 1,
    reward: { type: 'xp', value: 40 },
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    description: 'Spend 2 hours in focused work (no micro moves).',
    criteria: (w) => w.deepWorkMinutesToday >= 120,
    reward: { type: 'xp', value: 50 },
  },
];

export function generateDailyChallenges(world: WorldState, count: number = 3): Challenge[] {
  // Deterministic seed based on tenant + date for reproducibility
  const seed = `${world.tenant}:${new Date().toISOString().split('T')[0]}`;
  const rng = seededRandom(seed);
  
  // Shuffle and pick
  const shuffled = [...DAILY_CHALLENGE_POOL].sort(() => rng() - 0.5);
  const expiresAt = new Date().setHours(23, 59, 59, 999);
  
  return shuffled.slice(0, count).map((template) => ({
    id: `${template.id}:${seed}`,
    title: template.title,
    description: template.description,
    frequency: 'daily' as const,
    criteria: template.criteria,
    reward: template.reward,
    expiresAt,
  }));
}
```

**Files to modify:**
- `bin/operator/types.ts` — Add `Challenge`
- `bin/operator/heartbeat.ts` — Add `generateDailyChallenges()`, challenge completion checking
- `bin/operator/world.ts` — Add `activeChallenges` to `WorldState`
- `apps/cambium-r3f/src/scene/SceneHud.tsx` — Challenge display panel

### 6.4 Integration: Streaks (Easy)

**What to build:** Track consecutive days with activity. Check event log timestamps.

**Code changes:**

```typescript
// bin/operator/types.ts

interface Streak {
  type: 'daily_login' | 'heartbeat' | 'skill_use';
  count: number;
  lastDate: string;    // ISO date
  best: number;        // personal best
}

// bin/operator/world.ts — compute from event log

export function computeStreaks(events: GameEvent[]): Streak[] {
  const byDate = (ts: number) => new Date(ts).toISOString().split('T')[0];
  
  // Login streak: days with any event
  const eventDates = [...new Set(events.map((e) => byDate(e.ts)))].sort();
  let loginStreak = 0;
  let lastDate = eventDates[eventDates.length - 1];
  for (let i = eventDates.length - 1; i >= 0; i--) {
    const expectedDate = new Date(lastDate);
    expectedDate.setDate(expectedDate.getDate() - (eventDates.length - 1 - i));
    if (eventDates[i] === expectedDate.toISOString().split('T')[0]) {
      loginStreak++;
    } else break;
  }
  
  // Heartbeat streak: days with heartbeat events
  const heartbeatDates = [...new Set(
    events.filter((e) => e.kind === 'heartbeat').map((e) => byDate(e.ts))
  )].sort();
  // ... similar logic ...
  
  return [
    { type: 'daily_login', count: loginStreak, lastDate, best: 0 }, // track best separately
  ];
}
```

**Files to modify:**
- `bin/operator/types.ts` — Add `Streak`
- `bin/operator/world.ts` — Add streak computation
- `apps/cambium-r3f/src/scene/SceneHud.tsx` — Streak counter display

---

## 7. Visual & Customization — From Fixed to Expressive

### 7.1 Current State

R3F uses a fixed palette (5 colors: ink, substrate, signal, mist, depth). No customization. No player identity expression. The visual engine is read-only — no interactive gameplay in the 3D scene.

### 7.2 Integration: Visual Themes (Easy)

**What to build:** Unlockable color themes for the R3F scene. Themes are rewards from quest completion.

**Code changes:**

```typescript
// apps/cambium-r3f/src/scene/visual-tokens.ts

interface VisualTheme {
  name: string;
  unlockQuest?: string;     // quest ID that unlocks this theme
  colors: {
    ink: string;
    substrate: string;
    signal: string;
    mist: string;
    depth: string;
  };
  materials: {
    roughness: number;
    metalness: number;
  };
  particles: {
    color: string;
    speed: number;
  };
}

export const THEMES: Record<string, VisualTheme> = {
  cambium: {
    name: 'Cambium',
    colors: { ink: '#00272B', substrate: '#012F34', signal: '#E0FF4F', mist: '#D6FFF6', depth: '#231651' },
    materials: { roughness: 0.92, metalness: 0.02 },
    particles: { color: '#E0FF4F', speed: 1 },
  },
  ocean: {
    name: 'Ocean',
    unlockQuest: 'viability', // unlocked after Arc V
    colors: { ink: '#001F3F', substrate: '#003366', signal: '#7FDBFF', mist: '#B3E5FC', depth: '#0D47A1' },
    materials: { roughness: 0.7, metalness: 0.1 },
    particles: { color: '#7FDBFF', speed: 0.8 },
  },
  ember: {
    name: 'Ember',
    unlockQuest: 'the-loop', // unlocked after Arc IV
    colors: { ink: '#2D0A0A', substrate: '#4A1414', signal: '#FF6B35', mist: '#FFCCBC', depth: '#3E2723' },
    materials: { roughness: 0.85, metalness: 0.05 },
    particles: { color: '#FF6B35', speed: 1.2 },
  },
  forest: {
    name: 'Forest',
    unlockQuest: 'many-gardens', // unlocked after Arc VII
    colors: { ink: '#1B2E1B', substrate: '#2D4A2D', signal: '#69F0AE', mist: '#C8E6C9', depth: '#1B5E20' },
    materials: { roughness: 0.9, metalness: 0.03 },
    particles: { color: '#69F0AE', speed: 0.9 },
  },
  void: {
    name: 'Void',
    unlockQuest: 'memory', // unlocked after Arc VI
    colors: { ink: '#0A0A0A', substrate: '#141414', signal: '#E040FB', mist: '#F3E5F5', depth: '#4A148C' },
    materials: { roughness: 0.6, metalness: 0.15 },
    particles: { color: '#E040FB', speed: 1.5 },
  },
};
```

**Files to modify:**
- `apps/cambium-r3f/src/scene/visual-tokens.ts` — Add `VisualTheme`, `THEMES`
- `apps/cambium-r3f/src/App.tsx` — Pass active theme to scene
- `apps/cambium-r3f/src/scene/CambiumScene.tsx` — Use theme colors/materials

### 7.3 Integration: Founder Profile (Easy)

**What to build:** A founder identity derived from event history — archetype, stats, titles, specialties.

**Code changes:**

```typescript
// bin/operator/types.ts

interface FounderProfile {
  archetype: 'engineer' | 'salesperson' | 'designer' | 'operator' | null;
  stats: {
    microMastery: number;
    mesoMastery: number;
    macroMastery: number;
    noesisDepth: number;
    socialSkill: number;    // ICP interaction quality
    exploration: number;    // secrets discovered
  };
  titles: string[];
  specialties: string[];   // top 3 most-used skills
  joinedAt: number;        // epoch ms
}

// Derive from event history (pure function):
export function deriveProfile(events: GameEvent[], skills: SkillRecord[]): FounderProfile {
  const microCount = events.filter((e) => e.kind === 'tweak').length;
  const mesoCount = events.filter((e) => ['redirect', 'objection', 'metric'].includes(e.kind)).length;
  const macroCount = events.filter((e) => e.kind === 'reposition').length;
  const noesisCount = events.filter((e) => e.kind === 'calling' || e.kind === 'drift').length;
  
  // Archetype from dominant lane
  const max = Math.max(microCount, mesoCount, macroCount);
  let archetype: FounderProfile['archetype'] = null;
  if (max === microCount) archetype = 'engineer';
  else if (max === mesoCount) archetype = 'operator';
  else if (max === macroCount) archetype = 'salesperson';
  // Designer is a blend — requires balanced creativity usage
  
  return {
    archetype,
    stats: {
      microMastery: Math.min(microCount / 100, 1),
      mesoMastery: Math.min(mesoCount / 100, 1),
      macroMastery: Math.min(macroCount / 100, 1),
      noesisDepth: Math.min(noesisCount / 20, 1),
      socialSkill: 0, // computed from ICP interaction quality
      exploration: 0, // computed from secrets discovered
    },
    titles: [], // populated from quest rewards
    specialties: skills.sort((a, b) => b.telemetry.uses - a.telemetry.uses).slice(0, 3).map((s) => s.skill_id),
    joinedAt: events[0]?.ts ?? Date.now(),
  };
}
```

**Files to modify:**
- `bin/operator/types.ts` — Add `FounderProfile`
- `bin/operator/operator.ts` — Compute/update profile on each wake
- `bin/operator/world.ts` — Add profile to `WorldState`
- `apps/cambium-r3f/src/scene/` — New `ProfileScreen.tsx`

---

## 8. Priority Implementation Order

### Week 1-2: Foundation (Feel the Progress)
1. **Quest progress bars** (`quests.ts`, `CambiumScene.tsx`) — 1 day
2. **XP + level system** (`types.ts`, `world.ts`, `SceneHud.tsx`) — 2 days
3. **Quest rewards** (`quests.ts`, `types.ts`, `world.ts`) — 2 days
4. **Achievement system** (`types.ts`, `operator.ts`) — 2 days
5. **Visual effects on quest complete** (`CambiumScene.tsx`) — 1 day

### Week 3-4: Ritual (Daily Engagement)
1. **Daily challenges** (`heartbeat.ts`, `types.ts`) — 2 days
2. **Streak tracking** (`world.ts`, `SceneHud.tsx`) — 2 days
3. **Challenge rewards** — 1 day
4. **Fog-of-war progressive reveal** (`route-registry.ts`, `CambiumScene.tsx`) — 2 days

### Week 5-6: Depth (Discovery)
1. **Side-quests** (`quests.ts`, 10 initial side-quests) — 3 days
2. **Secrets** (`quests.ts`, 5 easter eggs) — 2 days
3. **Collectibles** (`types.ts`, `world.ts`) — 2 days
4. **Secret discovery animations** (R3F scene) — 1 day

### Week 7-8: Identity (Character)
1. **Founder profile** (`types.ts`, `operator.ts`) — 2 days
2. **Visual themes** (`visual-tokens.ts`, `App.tsx`) — 2 days
3. **Titles** (integrate with quest rewards) — 1 day
4. **Skill Labors** (`forge.ts`, `telemetry.ts`) — 2 days

### Week 9-10: Life (NPCs)
1. **NPC relationship system** (`types.ts`, `npc.ts`) — 3 days
2. **Cortex memory for NPCs** (`cortex-memory.ts`) — 2 days
3. **Mira relationship arc** (`npc.ts`, prompt engineering) — 2 days
4. **Relationship UI** (R3F) — 1 day

### Week 11-12: Social
1. **Leaderboards** (`workers/quests/handler.ts`) — 3 days
2. **Team dashboard** (R3F) — 2 days
3. **Shared achievements** — 2 days

---

## Appendix: Harry Potter -> Cambium Mapping (Quick Reference)

| HP Game Mechanic | Cambium Equivalent | Implementation File | Effort |
|-----------------|-------------------|---------------------|--------|
| Gift Box unlocks story | Any business activity -> insight fragments | `operator.ts`, `world.ts` | Easy |
| Alohomora 3-tier gating | Insight fragment thresholds unlock tools | `types.ts`, `world.ts` | Easy |
| Yearbook entries | Quest arcs with progress bars | `quests.ts`, `panel.ts` | Easy |
| Sebastian's companion arc | Mira 10-level relationship | `npc.ts`, `cortex-memory.ts` | Medium |
| Merlin Trials (9 types x 95) | Forge pattern -> challenge templates | `forge.ts`, `quests.ts` | Medium |
| Demiguise Moons | Hidden secrets with unusual triggers | `quests.ts` | Easy |
| Field Guide Pages | Collectibles tied to world knowledge | `types.ts`, `world.ts` | Easy |
| Spell Set loadouts | Tool configuration presets | future feature | Medium |
| Transmog (look vs stats) | Visual themes separate from function | `visual-tokens.ts` | Easy |
| Sorting Hat | Founder archetype selection | `onboarding/script.ts` | Easy |
| Marauder's Map | R3F living process map | `CambiumScene.tsx` | Easy |
| Pensieve | Cortex memory exploration | `cortex-memory.ts` | Medium |
| Time-Turner | Event log replay | `world.ts` | Easy |
| Daily Prophet puzzles | Daily challenges from heartbeat | `heartbeat.ts` | Easy |
| House Cup | Leaderboard between tenants | `workers/quests/handler.ts` | Medium |
| O.W.L. exam results | Skill proficiency ranking | `forge.ts`, `telemetry.ts` | Easy |
| Chocolate Frog cards | Collectible lore fragments | `quests.ts`, R3F scene | Easy |
