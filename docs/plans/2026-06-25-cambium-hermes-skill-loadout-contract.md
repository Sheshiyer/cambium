# Cambium Hermes Skill Loadout Contract Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generalize the GitHub skill-loadout pattern into a reusable Cambium/Hermes skill contract for GTM, distribution, product, design, engineering, and ops, with Hermes aware of the skills as a game-master layer over the fractal tapestry.

**Architecture:** Hermes remains the skill owner and router: it defines versioned agent skills, projects them into Cambium registry records, and adds skill hints to branch/topic decisions. Cambium remains the skill telemetry, quest, and visual surface: it preserves runtime registry truth in `.operator/<tenant>.skills.json`, derives a bounded visual envelope, and renders per-agent loadouts in the Telegram mini app. The first implementation must stay supervised: it exposes capabilities, routing hints, approval gates, and proof surfaces, but does not create new autonomous external writes beyond existing approved routes.

**Tech Stack:** TypeScript on Node 22, `node:test`, Hermes `hermes.agent-skills.v1`, Cambium `.operator/<tenant>.skills.json`, Cambium Worker mini app, Cloudflare Worker tests, GitHub/Cambium draft PR stack.

---

## Execution Base

Run this in a dedicated worktree or branch stacked after the current bridge work:

- Hermes repo: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts`
- Cambium repo: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium`
- Prefer base: after Hermes PR `#13` and Cambium PR `#90`, or explicitly stack on `codex/github-command-bridge`.

Recommended setup:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts
git status --short --branch
git switch -c codex/skill-loadout-contract

cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium
git status --short --branch
git switch -c codex/skill-loadout-contract
```

Boundaries:

- Do not reintroduce TeamForge or MultiCA vocabulary into active surfaces.
- Do not make Paperclip an active runtime owner; it remains provenance or historical source only.
- Do not add silent autonomous writes. New skills may recommend, prepare, assign, or request approval.
- Do not print, store, or render raw tokens.
- Keep registry truth separate from runtime truth: Hermes defines skill contracts; Cambium records telemetry and visual state.

Relevant skills:

- @engineering:system-design for the contract boundary.
- @product-management for GTM/product capability grouping.
- @engineering:testing-strategy for TDD and visual-envelope regression coverage.
- @design:ux-writing for concise loadout labels in the mini app.

## Current Anchor Files

Hermes:

- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.test.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/branch-brain.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/branch-brain.test.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/org-topology.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/scripts/agent-skill-registry-smoke.mjs`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/scripts/install-agent-skills-to-cambium.mjs`

Cambium:

- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/bin/operator/skills/forge.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/bin/operator/quests/quests.test.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/bin/quine/hyphae/quests.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/workers/quests/src/mini-app-surface-contract.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/workers/quests/src/page.ts`
- `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/workers/quests/src/handler.test.ts`

## Target Contract Shape

The reusable loadout contract extends the existing `cambium.skill-registry.agent-skill.v1` shape without breaking the GitHub fields already rendered by the mini app.

```ts
type AgentSkillDomain =
  | "github"
  | "gtm"
  | "distribution"
  | "product"
  | "design"
  | "engineering"
  | "ops";

type AgentSkillGameLayer =
  | "signal"
  | "quest"
  | "branch"
  | "delivery"
  | "approval"
  | "proof";

type AgentSkillInvocationKind =
  | "manual-command"
  | "topic-signal"
  | "cron-routine"
  | "approval-gate"
  | "context-recall"
  | "quest-assignment";

interface AgentSkillActionGroup {
  id: string;
  label: string;
  purpose: string;
  actionIds: string[];
  state: "active" | "gated" | "future";
}

interface AgentSkillLoadout {
  domain: AgentSkillDomain;
  gameLayer: AgentSkillGameLayer;
  iconKey: string;
  invocationKinds: AgentSkillInvocationKind[];
  branches: string[];
  actionGroups: AgentSkillActionGroup[];
}
```

Projected Cambium `output_contract` keeps current fields:

```ts
{
  format: "cambium.skill-registry.agent-skill.v1",
  location: ".operator/<tenant>.skills.json",
  hermesSchema: "hermes.agent-skills.v1",
  skillId: "gtm-distribution-ops",
  version: "0.1.0",
  domain: "gtm",
  gameLayer: "delivery",
  iconKey: "megaphone",
  invocationKinds: ["topic-signal", "approval-gate", "quest-assignment"],
  branches: ["fitcheck", "thoughtseed", "client-delivery"],
  miniAppArea: "skills",
  registryTarget: ".operator/<tenant>.skills.json",
  readCommands: ["gtm.channel.inspect", "gtm.offer.review"],
  writeCommands: ["gtm.outreach.draft"],
  actionGroups: [
    {
      id: "distribution-loop",
      label: "Distribution loop",
      purpose: "Turn product proof into channel-specific GTM next actions.",
      actionIds: ["gtm.channel.inspect", "gtm.outreach.draft"],
      state: "gated"
    }
  ],
  roleSubsets: {
    hermes: {
      version: "0.1.0",
      permissions: ["read", "dispatch"],
      commands: ["gtm.channel.inspect", "gtm.offer.review"],
      purpose: "Notice GTM signals and propose the next distribution action."
    }
  },
  boundaries: ["Public-facing distribution changes require founder approval."]
}
```

### Task 1: Extend Hermes Skill Types With Reusable Loadout Metadata

**Files:**

- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.test.ts`

**Step 1: Write the failing test**

Add this test to `src/agent-skills.test.ts`:

```ts
test("Agent skills expose reusable loadout metadata for the game-master surface", () => {
  for (const skill of [GITHUB_REPO_ISSUE_AGENT_SKILL]) {
    assert.ok(skill.loadout.domain, `${skill.skillId} missing loadout domain`);
    assert.ok(skill.loadout.gameLayer, `${skill.skillId} missing game layer`);
    assert.ok(skill.loadout.iconKey, `${skill.skillId} missing icon key`);
    assert.ok(skill.loadout.invocationKinds.length > 0, `${skill.skillId} missing invocation kinds`);
    assert.ok(skill.loadout.actionGroups.length > 0, `${skill.skillId} missing action groups`);
  }
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts
node --test src/agent-skills.test.ts
```

Expected: FAIL with a missing `loadout` property or TypeScript runtime error.

**Step 3: Write minimal implementation**

Add the reusable types near the top of `src/agent-skills.ts`:

```ts
export type AgentSkillDomain =
  | "github"
  | "gtm"
  | "distribution"
  | "product"
  | "design"
  | "engineering"
  | "ops";

export type AgentSkillGameLayer = "signal" | "quest" | "branch" | "delivery" | "approval" | "proof";
export type AgentSkillInvocationKind =
  | "manual-command"
  | "topic-signal"
  | "cron-routine"
  | "approval-gate"
  | "context-recall"
  | "quest-assignment";

export interface AgentSkillActionGroup {
  id: string;
  label: string;
  purpose: string;
  actionIds: string[];
  state: AgentSkillCommandState;
}

export interface AgentSkillLoadout {
  domain: AgentSkillDomain;
  gameLayer: AgentSkillGameLayer;
  iconKey: string;
  invocationKinds: AgentSkillInvocationKind[];
  branches: string[];
  actionGroups: AgentSkillActionGroup[];
}
```

Extend `AgentSkillDefinition`:

```ts
export interface AgentSkillDefinition {
  // existing fields stay unchanged
  loadout: AgentSkillLoadout;
}
```

Add this to `GITHUB_REPO_ISSUE_AGENT_SKILL`:

```ts
loadout: {
  domain: "github",
  gameLayer: "proof",
  iconKey: "github",
  invocationKinds: ["manual-command", "approval-gate", "quest-assignment"],
  branches: ["thoughtseed", "fitcheck", "client-delivery"],
  actionGroups: [
    {
      id: "repo-issue-proof-loop",
      label: "Repo issue proof loop",
      purpose: "Inspect repo state and create audited issue proof for branch work.",
      actionIds: ["github.repo.inspect", "github.issue.read", "github.issue.create", "github.issue.comment"],
      state: "gated",
    },
  ],
},
```

**Step 4: Run test to verify it passes**

Run:

```bash
node --test src/agent-skills.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/agent-skills.ts src/agent-skills.test.ts
git commit -m "feat: add Hermes skill loadout metadata"
```

### Task 2: Add Seed Skills For GTM, Distribution, Product, Design, Engineering, And Ops

**Files:**

- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.test.ts`

**Step 1: Write the failing test**

Add this to `src/agent-skills.test.ts`:

```ts
const expectedLoadoutSkillIds = [
  "github-repo-issue-ops",
  "gtm-distribution-ops",
  "product-branch-growth",
  "design-taste-review",
  "engineering-delivery-proof",
  "ops-routine-orchestration",
];

test("Hermes registry includes the first reusable skill loadout set", () => {
  const snapshot = cambiumAgentSkillRegistrySnapshot({
    tenant: "thoughtseed-labs",
    generatedAt: "2026-06-25T00:00:00.000Z",
  });
  const ids = snapshot.skills.map((skill) => skill.skill_id).sort();

  assert.deepEqual(
    ids,
    expectedLoadoutSkillIds.map((id) => `hermes-${id}`).sort(),
  );
});

test("GTM and delivery skills stay supervised and approval-aware", () => {
  const gtm = findAgentSkill("gtm-distribution-ops");
  const engineering = findAgentSkill("engineering-delivery-proof");

  assert.ok(gtm);
  assert.ok(engineering);
  assert.equal(gtm.status, "candidate");
  assert.ok(gtm.commands.some((command) => command.requiresApproval));
  assert.ok(engineering.commands.some((command) => command.auditRequired));
  assert.ok(gtm.boundaries.some((boundary) => /approval/i.test(boundary)));
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test src/agent-skills.test.ts
```

Expected: FAIL because only `github-repo-issue-ops` exists.

**Step 3: Write minimal implementation**

Add helper builders in `src/agent-skills.ts` below `GITHUB_REPO_ISSUE_AGENT_SKILL`:

```ts
function roleSubsetsFor(
  commands: Record<AgentSkillRoleId, string[]>,
  writeRoles: AgentSkillRoleId[] = [],
): Record<AgentSkillRoleId, AgentSkillSubset> {
  const purpose: Record<AgentSkillRoleId, string> = {
    ceo: "Approve public, financial, or client-facing changes.",
    scientist: "Audit evidence quality and promotion readiness.",
    engineer: "Prepare and verify implementation or integration work.",
    designer: "Review taste, UX, and visible product quality.",
    synthesist: "Turn signals into briefs, packets, and handoffs.",
    hermes: "Route signals, dispatch assignments, and keep proof visible.",
  };
  return Object.fromEntries(
    (["ceo", "scientist", "engineer", "designer", "synthesist", "hermes"] as AgentSkillRoleId[]).map((roleId) => [
      roleId,
      {
        roleId,
        version: "0.1.0",
        permissions: writeRoles.includes(roleId) ? ["read", "write"] : roleId === "ceo" ? ["read", "approve"] : ["read", "dispatch"],
        commands: commands[roleId] ?? commands.hermes ?? [],
        purpose: purpose[roleId],
      },
    ]),
  ) as Record<AgentSkillRoleId, AgentSkillSubset>;
}
```

Add five new constants. Keep the text short and explicit:

```ts
export const GTM_DISTRIBUTION_AGENT_SKILL: AgentSkillDefinition = {
  schema: AGENT_SKILL_REGISTRY_SCHEMA,
  skillId: "gtm-distribution-ops",
  name: "GTM Distribution Ops",
  version: "0.1.0",
  status: "candidate",
  category: "delivery",
  provider: "hermes-cambium",
  purpose: "Turn product proof, channel signals, and founder intent into supervised GTM next actions.",
  notFor: ["Sending public campaigns without approval.", "Inventing customer claims without source proof."],
  triggerSignals: ["launch channel gap", "distribution proof missing", "offer needs review", "client-facing GTM handoff"],
  manualTriggers: ["topic-signal:gtm", "approval-gate:gtm.outreach.draft"],
  requiredInputs: ["product branch id", "offer or proof packet", "target channel", "approval boundary"],
  commands: [
    { id: "gtm.channel.inspect", label: "Inspect channel fit", access: "read", state: "active", manualTrigger: "topic-signal:gtm", requiresApproval: false, auditRequired: true, scopes: ["channel:read"] },
    { id: "gtm.offer.review", label: "Review offer packet", access: "read", state: "active", manualTrigger: "topic-signal:offer", requiresApproval: false, auditRequired: true, scopes: ["offer:read"] },
    { id: "gtm.outreach.draft", label: "Draft outreach action", access: "write", state: "gated", manualTrigger: "approval-gate:gtm.outreach.draft", requiresApproval: true, auditRequired: true, scopes: ["draft:write"] },
  ],
  agentSubsets: roleSubsetsFor({
    ceo: ["gtm.channel.inspect", "gtm.offer.review", "gtm.outreach.draft"],
    scientist: ["gtm.channel.inspect", "gtm.offer.review"],
    engineer: ["gtm.channel.inspect"],
    designer: ["gtm.offer.review"],
    synthesist: ["gtm.channel.inspect", "gtm.offer.review", "gtm.outreach.draft"],
    hermes: ["gtm.channel.inspect", "gtm.offer.review"],
  }, ["synthesist"]),
  tokenPolicy: { preferredEnv: "NONE", scopes: ["no external token in v0.1"], neverExposeSecret: true, rotationOwner: "founder/operator", notes: "v0.1 prepares supervised GTM work only." },
  cambiumMap: { registryTarget: ".operator/<tenant>.skills.json", miniAppArea: "skills", questId: "the-handoff", visualMetaphor: "GTM loadout card with channel, offer, and approval state", invocationPath: "Telegram topic signal -> Hermes skill hint -> Cambium quest assignment", auditPath: "Cambium BRIDGE_DB/Fabric audit and skill telemetry" },
  loadout: { domain: "gtm", gameLayer: "delivery", iconKey: "megaphone", invocationKinds: ["topic-signal", "approval-gate", "quest-assignment"], branches: ["fitcheck", "client-delivery", "thoughtseed"], actionGroups: [{ id: "distribution-loop", label: "Distribution loop", purpose: "Move proof into channel-specific next actions.", actionIds: ["gtm.channel.inspect", "gtm.offer.review", "gtm.outreach.draft"], state: "gated" }] },
  promotionRule: "candidate -> validated after one approved GTM draft and one channel-fit review; production requires founder approval.",
  verificationSteps: ["channel fit is tied to a product branch", "draft remains non-public until approval", "Cambium audit receipt exists"],
  boundaries: ["Public GTM publication requires founder approval.", "No fabricated customer claims.", "No external-send action in v0.1."],
};
```

Use the same shape to add:

```ts
export const PRODUCT_BRANCH_GROWTH_AGENT_SKILL: AgentSkillDefinition = {
  /* skillId: "product-branch-growth"; domain: "product"; gameLayer: "branch"; commands:
     product.branch.seed, product.proof.packet, product.backlog.shape */
};

export const DESIGN_TASTE_REVIEW_AGENT_SKILL: AgentSkillDefinition = {
  /* skillId: "design-taste-review"; domain: "design"; gameLayer: "proof"; commands:
     design.reference.capture, design.critique, design.ship-ready-review */
};

export const ENGINEERING_DELIVERY_PROOF_AGENT_SKILL: AgentSkillDefinition = {
  /* skillId: "engineering-delivery-proof"; domain: "engineering"; gameLayer: "proof"; commands:
     engineering.repo.inspect, engineering.issue.plan, engineering.deploy.probe */
};

export const OPS_ROUTINE_ORCHESTRATION_AGENT_SKILL: AgentSkillDefinition = {
  /* skillId: "ops-routine-orchestration"; domain: "ops"; gameLayer: "signal"; commands:
     ops.routine.heartbeat, ops.cron.review, ops.context.snapshot */
};
```

Replace the registry export:

```ts
export const AGENT_SKILL_REGISTRY: AgentSkillDefinition[] = [
  GITHUB_REPO_ISSUE_AGENT_SKILL,
  GTM_DISTRIBUTION_AGENT_SKILL,
  PRODUCT_BRANCH_GROWTH_AGENT_SKILL,
  DESIGN_TASTE_REVIEW_AGENT_SKILL,
  ENGINEERING_DELIVERY_PROOF_AGENT_SKILL,
  OPS_ROUTINE_ORCHESTRATION_AGENT_SKILL,
];
```

**Step 4: Run test to verify it passes**

Run:

```bash
node --test src/agent-skills.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/agent-skills.ts src/agent-skills.test.ts
git commit -m "feat: seed Hermes loadout skill set"
```

### Task 3: Project Loadout Metadata Into Cambium Skill Records

**Files:**

- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/agent-skills.test.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/scripts/agent-skill-registry-smoke.mjs`

**Step 1: Write the failing test**

Add to `src/agent-skills.test.ts`:

```ts
test("Cambium projection carries reusable game loadout fields", () => {
  const record = toCambiumSkillRecord(GTM_DISTRIBUTION_AGENT_SKILL, "2026-06-25T00:00:00.000Z");

  assert.equal(record.output_contract.format, "cambium.skill-registry.agent-skill.v1");
  assert.equal(record.output_contract.domain, "gtm");
  assert.equal(record.output_contract.gameLayer, "delivery");
  assert.equal(record.output_contract.iconKey, "megaphone");
  assert.deepEqual(record.output_contract.invocationKinds, ["topic-signal", "approval-gate", "quest-assignment"]);
  assert.ok(Array.isArray(record.output_contract.actionGroups));
  assert.equal((record.output_contract.actionGroups as any[])[0].id, "distribution-loop");
  assert.equal((record.output_contract.roleSubsets as any).hermes.purpose.includes("Route"), true);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test src/agent-skills.test.ts
```

Expected: FAIL because `domain`, `gameLayer`, `iconKey`, `invocationKinds`, `actionGroups`, and role `purpose` are not projected yet.

**Step 3: Write minimal implementation**

Update `toCambiumSkillRecord` output contract:

```ts
output_contract: {
  format: "cambium.skill-registry.agent-skill.v1",
  location: skill.cambiumMap.registryTarget,
  hermesSchema: skill.schema,
  skillId: skill.skillId,
  version: skill.version,
  domain: skill.loadout.domain,
  gameLayer: skill.loadout.gameLayer,
  iconKey: skill.loadout.iconKey,
  invocationKinds: skill.loadout.invocationKinds,
  branches: skill.loadout.branches,
  actionGroups: skill.loadout.actionGroups,
  miniAppArea: skill.cambiumMap.miniAppArea,
  registryTarget: skill.cambiumMap.registryTarget,
  readCommands: readCommands.map((command) => command.id),
  writeCommands: writeCommands.map((command) => command.id),
  roleSubsets: Object.fromEntries(
    Object.entries(skill.agentSubsets).map(([roleId, subset]) => [
      roleId,
      {
        version: subset.version,
        permissions: subset.permissions,
        commands: subset.commands,
        purpose: subset.purpose,
      },
    ]),
  ),
  boundaries: skill.boundaries,
},
```

Update `scripts/agent-skill-registry-smoke.mjs`:

```js
assert.ok(snapshot.skills.length >= 6);
for (const projected of snapshot.skills) {
  assert.ok(projected.output_contract.domain);
  assert.ok(projected.output_contract.gameLayer);
  assert.ok(Array.isArray(projected.output_contract.actionGroups));
}
```

**Step 4: Run tests and smoke**

Run:

```bash
node --test src/agent-skills.test.ts
npm run smoke:agent-skills
```

Expected: both PASS and smoke JSON lists six `hermes-*` skills.

**Step 5: Commit**

```bash
git add src/agent-skills.ts src/agent-skills.test.ts scripts/agent-skill-registry-smoke.mjs
git commit -m "feat: project loadout metadata to Cambium"
```

### Task 4: Add Hermes Game-Master Skill Hints To Branch Decisions

**Files:**

- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/branch-brain.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/branch-brain.test.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/src/service.test.ts`

**Step 1: Write the failing test**

Add to `src/branch-brain.test.ts`:

```ts
test("branch brain attaches GTM loadout hints to distribution signals", () => {
  const decision = classifyTopicSignal(defaultBranchBrainProfile(), {
    chatId: THOUGHTSEED_TELEGRAM_CHAT_ID,
    topicKey: "clients",
    threadId: 804,
    messageId: "gtm-1",
    text: "Fitcheck launch needs GTM channel review and an outreach draft after founder approval.",
  });

  assert.equal(decision.kind, "approval_request");
  assert.deepEqual(decision.skillHints, [{
    skillId: "gtm-distribution-ops",
    domain: "gtm",
    roleId: "synthesist",
    actionId: "gtm.outreach.draft",
    approvalRequired: true,
    reason: "distribution or GTM signal needs supervised next action",
  }]);
});

test("branch brain attaches engineering proof skill hints to Dev deploy signals", () => {
  const decision = classifyTopicSignal(defaultBranchBrainProfile(), {
    chatId: THOUGHTSEED_TELEGRAM_CHAT_ID,
    topicKey: "dev",
    threadId: 862,
    messageId: "dev-1",
    text: "Worker deploy probe failed and needs repo issue plus live proof.",
  });

  assert.equal(decision.kind, "assignment");
  assert.equal(decision.skillHints?.[0]?.skillId, "engineering-delivery-proof");
  assert.equal(decision.skillHints?.[0]?.actionId, "engineering.deploy.probe");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test src/branch-brain.test.ts
```

Expected: FAIL because `skillHints` does not exist.

**Step 3: Write minimal implementation**

Add a hint type to `src/branch-brain.ts`:

```ts
export interface BranchSkillHint {
  skillId: string;
  domain: string;
  roleId: string;
  actionId: string;
  approvalRequired: boolean;
  reason: string;
}
```

Extend `BranchDecision`:

```ts
skillHints?: BranchSkillHint[];
```

Add a helper:

```ts
function skillHintsForSignal(text: string, route: BranchTopicRoute): BranchSkillHint[] {
  const normalized = text.toLowerCase();
  if (/\b(gtm|distribution|launch|channel|outreach|offer)\b/.test(normalized)) {
    return [{
      skillId: "gtm-distribution-ops",
      domain: "gtm",
      roleId: "synthesist",
      actionId: /outreach|send|campaign/.test(normalized) ? "gtm.outreach.draft" : "gtm.channel.inspect",
      approvalRequired: /outreach|send|campaign|client|public/.test(normalized),
      reason: "distribution or GTM signal needs supervised next action",
    }];
  }
  if (route.topicKey === "dev" || /\b(deploy|repo|proof|issue|build|worker)\b/.test(normalized)) {
    return [{
      skillId: "engineering-delivery-proof",
      domain: "engineering",
      roleId: "engineer",
      actionId: /deploy|probe|worker/.test(normalized) ? "engineering.deploy.probe" : "engineering.issue.plan",
      approvalRequired: false,
      reason: "engineering proof signal should route through delivery proof skill",
    }];
  }
  if (/\b(design|taste|visual|reference|ux)\b/.test(normalized)) {
    return [{
      skillId: "design-taste-review",
      domain: "design",
      roleId: "designer",
      actionId: "design.critique",
      approvalRequired: false,
      reason: "visible product quality signal needs design review",
    }];
  }
  if (/\b(cron|routine|heartbeat|context|r2|vectorize)\b/.test(normalized)) {
    return [{
      skillId: "ops-routine-orchestration",
      domain: "ops",
      roleId: "hermes",
      actionId: "ops.routine.heartbeat",
      approvalRequired: false,
      reason: "runtime routine signal needs operations loadout",
    }];
  }
  return [];
}
```

When constructing each `BranchDecision`, include:

```ts
const skillHints = skillHintsForSignal(signal.text, route);
```

For `approval_request`, `heartbeat`, `digest_item`, and `assignment`, set:

```ts
skillHints,
```

Do not add hints to `blocked` decisions unless the topic was valid and the text was redacted.

**Step 4: Run tests**

Run:

```bash
node --test src/branch-brain.test.ts src/service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/branch-brain.ts src/branch-brain.test.ts src/service.test.ts
git commit -m "feat: add Hermes game-master skill hints"
```

### Task 5: Teach Cambium To Preserve Expanded Loadout Fields

**Files:**

- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/bin/operator/skills/forge.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/bin/quine/hyphae/quests.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/bin/operator/quests/quests.test.ts`

**Step 1: Write the failing test**

Extend the existing `quests visual envelope preserves Hermes agent skill loadout details` test in `bin/operator/quests/quests.test.ts`:

```ts
assert.equal(skill?.agentSkill?.domain, "gtm");
assert.equal(skill?.agentSkill?.gameLayer, "delivery");
assert.equal(skill?.agentSkill?.iconKey, "megaphone");
assert.deepEqual(skill?.agentSkill?.invocationKinds, ["topic-signal", "approval-gate"]);
assert.deepEqual(skill?.agentSkill?.branches, ["fitcheck", "client-delivery"]);
assert.equal(skill?.agentSkill?.actionGroups[0].id, "distribution-loop");
assert.equal(skill?.agentSkill?.roleSubsets.hermes.purpose, "Route GTM signals into supervised next actions.");
```

Update the fixture `output_contract` in that test to include:

```ts
domain: "gtm",
gameLayer: "delivery",
iconKey: "megaphone",
invocationKinds: ["topic-signal", "approval-gate"],
branches: ["fitcheck", "client-delivery"],
actionGroups: [{
  id: "distribution-loop",
  label: "Distribution loop",
  purpose: "Move proof into channel-specific next actions.",
  actionIds: ["gtm.channel.inspect", "gtm.outreach.draft"],
  state: "gated",
}],
roleSubsets: {
  hermes: {
    version: "0.1.0",
    permissions: ["read", "dispatch"],
    commands: ["gtm.channel.inspect"],
    purpose: "Route GTM signals into supervised next actions.",
  },
},
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium
node --test bin/operator/quests/quests.test.ts
```

Expected: FAIL because `agentSkillLoadout` drops the expanded fields.

**Step 3: Write minimal implementation**

In `bin/operator/skills/forge.ts`, loosen the output contract type:

```ts
output_contract: { format: string; location: string; [key: string]: unknown };
```

In `bin/quine/hyphae/quests.ts`, extend the `agentSkill` type:

```ts
domain?: string;
gameLayer?: string;
iconKey?: string;
invocationKinds: string[];
branches: string[];
actionGroups: Array<{
  id: string;
  label: string;
  purpose: string;
  actionIds: string[];
  state: string;
}>;
```

Add helpers:

```ts
function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function actionGroups(value: unknown): Array<{ id: string; label: string; purpose: string; actionIds: string[]; state: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) return [];
    return [{
      id,
      label: typeof raw.label === "string" ? raw.label : id,
      purpose: typeof raw.purpose === "string" ? raw.purpose : "",
      actionIds: stringArray(raw.actionIds),
      state: typeof raw.state === "string" ? raw.state : "future",
    }];
  });
}
```

Update `agentSkillLoadout`:

```ts
return {
  format: String(contract.format),
  skillId: String(contract.skillId ?? skill.skill_id),
  version: String(contract.version ?? ""),
  domain: typeof contract.domain === "string" ? contract.domain : undefined,
  gameLayer: typeof contract.gameLayer === "string" ? contract.gameLayer : undefined,
  iconKey: typeof contract.iconKey === "string" ? contract.iconKey : undefined,
  invocationKinds: stringArray(contract.invocationKinds),
  branches: stringArray(contract.branches),
  actionGroups: actionGroups(contract.actionGroups),
  miniAppArea: typeof contract.miniAppArea === "string" ? contract.miniAppArea : undefined,
  registryTarget: typeof contract.registryTarget === "string" ? contract.registryTarget : undefined,
  readCommands: stringArray(contract.readCommands),
  writeCommands: stringArray(contract.writeCommands),
  roleSubsets,
  boundaries: stringArray(contract.boundaries),
};
```

Also include `purpose` when copying `roleSubsets`:

```ts
purpose: typeof rawSubset.purpose === "string" ? rawSubset.purpose : "",
```

**Step 4: Run test to verify it passes**

Run:

```bash
node --test bin/operator/quests/quests.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add bin/operator/skills/forge.ts bin/quine/hyphae/quests.ts bin/operator/quests/quests.test.ts
git commit -m "feat: preserve expanded skill loadouts"
```

### Task 6: Render Per-Agent Loadouts And Overall Hermes Skill Tree In The TG Mini App

**Files:**

- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/workers/quests/src/page.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/workers/quests/src/mini-app-surface-contract.ts`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/workers/quests/src/handler.test.ts`

**Step 1: Write the failing tests**

Add to `workers/quests/src/handler.test.ts` near the existing agent skill sheet test:

```ts
test("page · skill cards show domain, game layer, and action groups", async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: "skill-registry",
      total: 1,
      rows: [{
        id: "hermes-gtm-distribution-ops",
        status: "candidate",
        uses: 1,
        successes: 1,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: "learning",
        tierLabel: "LEARNING",
        sampleSize: 1,
        minimum: 3,
        recentRate: 1,
        recentWindow: 1,
        promotion: { status: "observe", label: "OBSERVE", detail: "needs more proof", requiredApproval: true },
        agentSkill: {
          format: "cambium.skill-registry.agent-skill.v1",
          skillId: "gtm-distribution-ops",
          version: "0.1.0",
          domain: "gtm",
          gameLayer: "delivery",
          iconKey: "megaphone",
          invocationKinds: ["topic-signal", "approval-gate"],
          branches: ["fitcheck", "client-delivery"],
          actionGroups: [{ id: "distribution-loop", label: "Distribution loop", purpose: "Move proof into channel actions.", actionIds: ["gtm.channel.inspect", "gtm.outreach.draft"], state: "gated" }],
          miniAppArea: "skills",
          registryTarget: ".operator/<tenant>.skills.json",
          readCommands: ["gtm.channel.inspect"],
          writeCommands: ["gtm.outreach.draft"],
          roleSubsets: {
            hermes: { version: "0.1.0", permissions: ["read", "dispatch"], commands: ["gtm.channel.inspect"], purpose: "Route GTM signals." },
            synthesist: { version: "0.1.0", permissions: ["read", "write"], commands: ["gtm.outreach.draft"], purpose: "Draft supervised GTM handoffs." },
          },
          boundaries: ["Public GTM publication requires founder approval."],
        },
        updated: 1,
      }],
    },
  };

  const rendered = await renderPageFixtureContext(envelope);
  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get("sheetBody")!.innerHTML;

  assert.match(sheet, /domain<\/b><span>gtm/);
  assert.match(sheet, /game layer<\/b><span>delivery/);
  assert.match(sheet, /invocations<\/b><span>topic-signal, approval-gate/);
  assert.match(sheet, /branches<\/b><span>fitcheck, client-delivery/);
  assert.match(sheet, /Distribution loop<\/b><span>gated · gtm\.channel\.inspect, gtm\.outreach\.draft/);
  assert.match(sheet, /hermes<\/b><span>v0\.1\.0 · read, dispatch · gtm\.channel\.inspect · Route GTM signals\./);
});
```

Update the surface contract test expectation:

```ts
for (const target of ["skills", "gtm", "distribution"]) {
  assert.ok(MINI_APP_ECOSYSTEM_TARGETS.includes(target as any));
}
```

**Step 2: Run tests to verify they fail**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: FAIL because the page does not render expanded loadout metadata and ecosystem targets are missing.

**Step 3: Write minimal implementation**

In `workers/quests/src/mini-app-surface-contract.ts`, add targets:

```ts
"skills",
"gtm",
"distribution",
```

Change the skills subsection target from `github` to `skills`:

```ts
{
  id: "skills",
  target: "skills",
  interactions: {
    primary: "sheet",
    controls: [
      { id: "promote-skill-review", interaction: "signed-action", source: "skill promotion review queue", target: "skills" },
    ],
  },
  source: "skill-registry visual envelope",
},
```

In `workers/quests/src/page.ts`, update `agentSkillRoles`:

```js
return Object.entries(subsets).map(([roleId, subset]) => {
  const permissions = Array.isArray(subset.permissions) ? subset.permissions.join(', ') : '';
  const commands = Array.isArray(subset.commands) ? subset.commands.join(', ') : '';
  const purpose = subset.purpose || '';
  return { roleId, version: subset.version || '', permissions, commands, purpose };
});
```

Update `agentSkillDetail`:

```js
return (agent.domain || 'skill') + ' · ' + (agent.gameLayer || 'layer') + ' · loadout v' + (agent.version || 'unknown') + ' · ' + roles.length + ' roles · ' + readCount + ' read · ' + writeCount + ' write gated';
```

Update `renderAgentSkillLoadout`:

```js
const actionGroups = Array.isArray(agent.actionGroups) && agent.actionGroups.length
  ? '<div class="kv">' + agent.actionGroups.slice(0, 6).map(group => '<b>' + esc(group.label || group.id) + '</b><span>' + esc((group.state || 'future') + ' · ' + (Array.isArray(group.actionIds) ? group.actionIds.join(', ') : '') + (group.purpose ? ' · ' + group.purpose : '')) + '</span>').join('') + '</div>'
  : '';

const roleRows = roles.length
  ? '<div class="kv">' + roles.slice(0, 8).map(role => '<b>' + esc(role.roleId) + '</b><span>v' + esc(role.version || 'unknown') + ' · ' + esc(role.permissions || 'no permissions') + ' · ' + esc(role.commands || 'no commands') + (role.purpose ? ' · ' + esc(role.purpose) : '') + '</span>').join('') + '</div>'
  : '<div class="nar">no role subsets served for this agent skill.</div>';

return '<div class="kv"><b>domain</b><span>' + esc(agent.domain || 'unknown') + '</span><b>game layer</b><span>' + esc(agent.gameLayer || 'unknown') + '</span><b>loadout version</b><span>' + esc(agent.version || 'unknown') + '</span><b>skill id</b><span>' + esc(agent.skillId || 'unknown') + '</span><b>mini app area</b><span>' + esc(agent.miniAppArea || 'skills') + '</span><b>registry target</b><span>' + esc(agent.registryTarget || '.operator/<tenant>.skills.json') + '</span><b>invocations</b><span>' + esc(Array.isArray(agent.invocationKinds) ? agent.invocationKinds.join(', ') : 'none') + '</span><b>branches</b><span>' + esc(Array.isArray(agent.branches) ? agent.branches.join(', ') : 'none') + '</span><b>read commands</b><span>' + esc(Array.isArray(agent.readCommands) ? agent.readCommands.join(', ') : 'none') + '</span><b>write commands</b><span>' + esc(Array.isArray(agent.writeCommands) ? agent.writeCommands.join(', ') : 'none') + '</span></div>' + actionGroups + roleRows + boundaries;
```

**Step 4: Run tests**

Run:

```bash
node --test workers/quests/src/handler.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/page.ts workers/quests/src/mini-app-surface-contract.ts workers/quests/src/handler.test.ts
git commit -m "feat: render agent skill trees in mini app"
```

### Task 7: Add Contract Docs And Runtime Install Proof

**Files:**

- Create: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/docs/contracts/skill-loadout-contract.md`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/docs/contracts/github-agent-skill-contract.md`
- Modify: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts/docs/evidence/2026-06-25-github-agent-skill-map.md`

**Step 1: Write the docs**

Create `docs/contracts/skill-loadout-contract.md`:

```md
# Skill Loadout Contract

Date: 2026-06-25
Schema: `hermes.agent-skills.v1` projected as `cambium.skill-registry.agent-skill.v1`

## Purpose

Commands are invocation surfaces. Skills are versioned operational capabilities.
Hermes owns the contract and skill hints. Cambium owns telemetry, quest proof,
promotion state, and the Telegram mini app visual layer.

## Skill Families

- GitHub: repo and issue proof.
- GTM: distribution loops, offer review, outreach draft preparation.
- Product: branch seed, proof packet, backlog shaping.
- Design: reference capture, critique, ship-readiness review.
- Engineering: repo inspection, issue planning, deploy probing.
- Ops: routine heartbeat, cron review, context snapshot.

## Runtime Rules

- Candidate skills can be visible before they can execute.
- Validated skills require evidence-backed successful use.
- Production skills require founder approval.
- Public/client-facing writes always require approval.
- The mini app may show env names, skill ids, versions, roles, and proof. It must not show token values.
```

Update `github-agent-skill-contract.md` with:

```md
This GitHub skill is the first concrete instance of the reusable skill loadout contract. New GTM/product/design/engineering/ops skills should follow `docs/contracts/skill-loadout-contract.md`.
```

**Step 2: Run docs-safe checks**

Run:

```bash
rg -n "ghp_|github_pat_|Bearer\\s+[A-Za-z0-9._-]{20,}|TOKEN=.*" docs/contracts docs/evidence || true
npm run smoke:agent-skills
```

Expected: no raw secrets; smoke passes.

**Step 3: Install dry-run into Cambium registry**

Run from Hermes:

```bash
npm run agent-skills:install -- --registry /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/.operator/cambium.skills.json --tenant cambium --dry-run --generated-at 2026-06-25T00:00:00.000Z
```

Expected: JSON output with `ok: true`, `dryRun: true`, six `hermes-*` skills, and no token values.

**Step 4: Commit**

```bash
git add docs/contracts/skill-loadout-contract.md docs/contracts/github-agent-skill-contract.md docs/evidence/2026-06-25-github-agent-skill-map.md scripts/agent-skill-registry-smoke.mjs
git commit -m "docs: define reusable skill loadout contract"
```

### Task 8: End-To-End Local Verification Across Hermes And Cambium

**Files:**

- No new code files unless a previous test exposes a real gap.
- Optional evidence: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium/docs/plans/assets/skill-loadout-contract/local-proof.json`

**Step 1: Run Hermes full suite**

Run:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts
npm test
npm run smoke:agent-skills
```

Expected:

- `npm test` passes all tests.
- `npm run smoke:agent-skills` outputs all projected skills and no secret values.

**Step 2: Run Cambium full suite**

Run:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium
npm test
```

Expected: all tests pass.

**Step 3: Optional local registry proof**

Run:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts
npm run agent-skills:install -- --registry /tmp/cambium.skills.json --tenant cambium --generated-at 2026-06-25T00:00:00.000Z
node -e 'const skills=require("/tmp/cambium.skills.json"); console.log(JSON.stringify({total:skills.length, ids:skills.map(s=>s.skill_id), domains:skills.map(s=>s.output_contract.domain)}, null, 2))'
```

Expected:

```json
{
  "total": 6,
  "ids": [
    "hermes-github-repo-issue-ops",
    "hermes-gtm-distribution-ops",
    "hermes-product-branch-growth",
    "hermes-design-taste-review",
    "hermes-engineering-delivery-proof",
    "hermes-ops-routine-orchestration"
  ],
  "domains": ["github", "gtm", "product", "design", "engineering", "ops"]
}
```

**Step 4: Final commits if any verification docs changed**

If an evidence file was added:

```bash
git add docs/plans/assets/skill-loadout-contract/local-proof.json
git commit -m "docs: record skill loadout local proof"
```

**Step 5: PR handoff**

Open stacked PRs:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-labs/hermes-aws-ts
git push -u origin codex/skill-loadout-contract
gh pr create --draft --base codex/github-command-bridge --head codex/skill-loadout-contract --title "Generalize Hermes skill loadouts" --body "Adds reusable skill loadout metadata, seed skills, and game-master skill hints. Tests: npm test; npm run smoke:agent-skills."

cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/cambium
git push -u origin codex/skill-loadout-contract
gh pr create --draft --base codex/github-command-bridge --head codex/skill-loadout-contract --title "Render Cambium agent skill loadouts" --body "Preserves expanded skill loadout metadata and renders per-agent/domain/action groups in the TG mini app. Tests: npm test."
```

Expected:

- Two draft PRs.
- Hermes PR depends on the GitHub command bridge base.
- Cambium PR depends on the GitHub command bridge base.
- Neither PR claims live deployment until Worker deploy and AWS Hermes route proof are captured.

## Final Acceptance Criteria

- Hermes registry has at least six skill loadouts: GitHub, GTM, product, design, engineering, ops.
- Each skill has `domain`, `gameLayer`, `iconKey`, `invocationKinds`, `branches`, and `actionGroups`.
- Cambium projection preserves those fields under `output_contract`.
- Branch decisions can carry `skillHints` for the game-master layer.
- Cambium visual envelope preserves expanded loadout fields.
- TG mini app renders per-agent role subsets, action groups, domain, game layer, invocation kinds, branch scope, and boundaries.
- Public/client-facing actions remain approval-gated.
- No raw tokens are added to docs, tests, audit logs, or UI.
- `npm test` passes in Hermes and Cambium.

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-25-cambium-hermes-skill-loadout-contract.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration

2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
