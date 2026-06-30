# Branch Mission Fabric Contract

Date: 2026-06-29
Schema: `cambium.branch-mission-fabric.v1`
Status: frozen for first branch story adapter slice

## Purpose

Product branch packets are the source artifacts. Cambium normalizes them into branch arcs and missions, Hermes may route those missions from Telegram/topic signals, and Plexus receives member-scoped tasks through the existing Fabric directive path.

This contract freezes the shared mission metadata before Cambium, Hermes, Plexus, and the Telegram mini app add branch-story behavior in parallel.

## Preserved Fabric Spine

- Assignment directives remain `thoughtseed.project_task_assignment.v1`.
- Assignment payloads remain member-scoped and use the Cambium Worker bridge path.
- Upstream proof remains `fabric_task_event` and `fabric_task_report`.
- Plexus stores only scoped member tokens, never Worker admin tokens.
- `workMode` remains `manual | delegated`.
- `workModeLocked` remains true after the first member choice.
- Lifecycle `status` remains separate from `workMode`.
- Note-only `done` remains `weak_evidence`.
- Verified proof can become `verified_evidence` only after accepted evidence/review rules.
- Supervised branch readiness must not be presented as unattended autonomy.

## Assignment Metadata

The branch mission layer extends the existing project task assignment payload with a metadata object. Downstream systems must preserve unknown metadata keys and must not promote a mission based on metadata alone.

```ts
export interface BranchMissionAssignmentMeta {
  branchId: string;
  arcId: string;
  missionId: string;
  kpiIds: string[];
  gateId?: string;
  proofRequired: string;
  proofFoldback: string;
  promotionState: 'proof-only' | 'supervised-branch' | 'autonomous-branch' | 'organ-service';
  autonomyBoundary: string;
  approvalsRequired: string[];
  skillHints?: BranchSkillHint[];
}

export interface BranchSkillHint {
  skillId: string;
  domain: 'github' | 'gtm' | 'product' | 'design' | 'engineering' | 'ops';
  invocationKind: 'topic-signal' | 'approval-gate' | 'quest-assignment' | 'proof-report';
  state: 'candidate' | 'validated' | 'production';
  boundary: string;
}
```

Recommended placement inside existing assignment payloads:

```ts
{
  type: 'project_task_assignment',
  schema: 'thoughtseed.project_task_assignment.v1',
  task: {
    taskId: 'fitcheck-shopify-qa',
    projectId: 'fitcheck',
    questId: 'fitcheck-shopify-qa',
    title: 'Run authenticated Shopify widget QA',
    branchMission: {
      branchId: 'fitcheck',
      arcId: 'fitcheck-supervised-launch-hardening',
      missionId: 'fitcheck-shopify-qa',
      kpiIds: ['fitcheck-first-merchant-proof'],
      gateId: 'credentials',
      proofRequired: 'screenshot plus widget event log',
      proofFoldback: 'fabric_task_report -> Cambium evidence candidate -> review',
      promotionState: 'supervised-branch',
      autonomyBoundary: 'Founder approval remains required for customer contact, spend, payments, public claims, and app submission.',
      approvalsRequired: ['Shopify access', 'privacy wording', 'public proof claims']
    }
  }
}
```

## Cross-System Responsibilities

| System | Must do | Must not do |
| --- | --- | --- |
| Product packets | Name branch arcs, missions, gates, KPI inputs, dispatch hints, proof foldback, approvals, and autonomy boundary. | Hide missing proof behind aspirational copy. |
| Cambium | Parse packet controls, keep global `questLedger`, expose `branchStories` beside existing project evidence, and review proof before promotion. | Replace the global readiness ledger or infer verified evidence from blocked/pending rows. |
| Hermes | Preserve `branchMission` metadata and skill hints when topic signals become assignment payloads. | Execute public/client-facing writes without approval. |
| Plexus | Parse and render branch mission metadata while preserving `workMode`, `status`, token, and evidence boundaries. | Store admin tokens or treat member status updates as verified proof. |
| Telegram mini app | Show branch arcs and missions as the playable primary layer, with architecture details in inspection surfaces. | Claim autonomous readiness from supervised or proof-only packet states. |

## Lock Zones

Only the named integration owner for a wave should touch these files:

- Cambium `package.json`
- Cambium `docs/plans/product-branches/schema.json`
- Cambium `scripts/validate-product-branch-packets.mjs`
- Cambium `workers/quests/schema/bridge.sql`
- Cambium `workers/quests/src/handler.ts`
- Cambium `workers/quests/src/page.ts`
- Hermes `package.json`
- Hermes `src/branch-brain.ts`
- Hermes `src/service.ts`
- Plexus `package.json`
- Plexus `src/shared/types.ts`
- Plexus `src/shared/thoughtseed-fabric-task.ts`
- Plexus `src/main/thoughtseed-bridge.ts`
- Plexus `src/renderer/components/AgentFabricPanel.tsx`
- Any shared schema or contract doc consumed by more than one swarm.

## Validation Rules

- Every branch mission assignment must include `branchId`, `arcId`, and `missionId`.
- `missionId` values must be stable, product-prefixed, and match packet mission rows.
- `promotionState` must match the product packet unless a reviewed Cambium evidence event explicitly promotes it.
- `proofRequired` and `proofFoldback` must be visible to operators before dispatch.
- Missing permissions, credentials, or approvals must block dispatch, not silently downgrade proof.
- Unknown metadata keys must be preserved through bridge parsing where possible.
- Secret values, Telegram init data, auth headers, and raw customer data must not appear in packet docs, fixtures, logs, or mini app UI.
