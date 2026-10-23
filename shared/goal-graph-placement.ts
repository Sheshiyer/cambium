// Where a founder decision lives in the Field Atlas (reviewed 2026-10-23).
//
// Placement is keyed by the pinned loadout, never by work-object kind alone:
// `branch:` and `sapling:` both host source audits and GTM work. Each row cites
// the growth model (thoughtseed-labs/20-operations/growth): Hands carries
// admitted, finite source-verification packets; Launch Lead is Will's dispatch
// desk for approval-bound outreach. A loadout without a row stays at the Gate.
//
// Placement is display only. It never confers signing authority: the Worker
// verifies every decision, and a beacon signs through the same /api/gate
// contract as the Gate itself.

export const GOAL_GRAPH_PLACEMENT_SCHEMA = 'cambium.goal-graph-placement.v1';

export type GoalGraphPlacementLandmark = 'gate' | 'hands' | 'launch-lead';

export interface GoalGraphPlacement {
  readonly schema: typeof GOAL_GRAPH_PLACEMENT_SCHEMA;
  readonly landmarkId: GoalGraphPlacementLandmark;
  readonly districtId: 'purpose' | 'plant' | 'growth';
  readonly basis: 'loadout' | 'fallback';
}

interface PlacementRow {
  readonly loadoutId: string;
  readonly landmarkId: Exclude<GoalGraphPlacementLandmark, 'gate'> | 'gate';
  readonly rationale: string;
}

/** Every registered loadout has exactly one row; a test enforces parity with the loadout registry. */
export const GOAL_GRAPH_PLACEMENT_ROWS: readonly PlacementRow[] = Object.freeze([
  Object.freeze({ loadoutId: 'loadout:wtfmedia-source-audit', landmarkId: 'hands', rationale: 'finite source verification is Hands work' }),
  Object.freeze({ loadoutId: 'loadout:parkarea-source-audit', landmarkId: 'hands', rationale: 'finite source verification is Hands work' }),
  Object.freeze({ loadoutId: 'loadout:relovo-source-audit', landmarkId: 'hands', rationale: 'finite source verification is Hands work' }),
  Object.freeze({ loadoutId: 'loadout:fitcheck-launch', landmarkId: 'launch-lead', rationale: 'approval-bound launch outreach is the Launch Lead desk inside Will' }),
  Object.freeze({ loadoutId: 'loadout:iverif-observer', landmarkId: 'gate', rationale: 'no reviewed organ or desk yet; stays at the Gate' }),
] as const);

const DISTRICT_BY_LANDMARK: Readonly<Record<GoalGraphPlacementLandmark, GoalGraphPlacement['districtId']>> = Object.freeze({
  gate: 'purpose',
  hands: 'plant',
  'launch-lead': 'growth',
});

const ROW_BY_LOADOUT = new Map(GOAL_GRAPH_PLACEMENT_ROWS.map((row) => [row.loadoutId, row] as const));

export const GATE_PLACEMENT: GoalGraphPlacement = Object.freeze({
  schema: GOAL_GRAPH_PLACEMENT_SCHEMA, landmarkId: 'gate', districtId: 'purpose', basis: 'fallback',
});

/**
 * Resolve a decision's subject landmark. `authorized` must be the caller's
 * loadout-authority verdict (work object eligible and cluster authorized); a
 * mismatch, a missing loadout or an unmapped loadout stays at the Gate.
 */
export function resolveGoalGraphPlacement(pinnedLoadoutId: unknown, authorized: boolean): GoalGraphPlacement {
  if (!authorized || typeof pinnedLoadoutId !== 'string') return GATE_PLACEMENT;
  const row = ROW_BY_LOADOUT.get(pinnedLoadoutId);
  if (!row || row.landmarkId === 'gate') return GATE_PLACEMENT;
  return Object.freeze({
    schema: GOAL_GRAPH_PLACEMENT_SCHEMA,
    landmarkId: row.landmarkId,
    districtId: DISTRICT_BY_LANDMARK[row.landmarkId],
    basis: 'loadout',
  });
}

// ── After a decision: the real path the work takes ─────────────────────────
// Stage order follows the system atlas edges (gate→d1→hermes→proof, hands/will
// →cortex) and INTEGRATION.md. A stage lights only when live state proves it.

export const GOAL_GRAPH_PATH_SCHEMA = 'cambium.goal-graph-path.v1';

export type GoalGraphPathStage = 'committed' | 'directive-queued' | 'runner-claimed' | 'receipt' | 'learning';

export const GOAL_GRAPH_PATH_STAGES: readonly { readonly stage: GoalGraphPathStage; readonly from: string; readonly to: string }[] = Object.freeze([
  Object.freeze({ stage: 'committed', from: 'gate', to: 'd1' }),
  Object.freeze({ stage: 'directive-queued', from: 'd1', to: 'hermes' }),
  Object.freeze({ stage: 'runner-claimed', from: 'hermes', to: 'hermes' }),
  Object.freeze({ stage: 'receipt', from: 'hermes', to: 'proof' }),
  Object.freeze({ stage: 'learning', from: 'proof', to: 'cortex' }),
] as const);

export interface GoalGraphPathSegment {
  readonly stage: GoalGraphPathStage | 'rejected';
  readonly from: string;
  readonly to: string;
}

/**
 * The segments to light for a decision. `reached` is the furthest proven stage
 * (or null when nothing is proven yet); a rejection lights Gate→D1 only.
 */
export function goalGraphPathSegments(decision: 'approved' | 'rejected', reached: GoalGraphPathStage | null): GoalGraphPathSegment[] {
  if (decision === 'rejected') return [{ stage: 'rejected', from: 'gate', to: 'd1' }];
  if (!reached) return [];
  const last = GOAL_GRAPH_PATH_STAGES.findIndex((item) => item.stage === reached);
  if (last < 0) return [];
  return GOAL_GRAPH_PATH_STAGES.slice(0, last + 1).map((item) => ({ stage: item.stage, from: item.from, to: item.to }));
}
