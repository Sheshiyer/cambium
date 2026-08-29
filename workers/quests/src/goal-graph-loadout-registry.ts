import type { GoalGraphLoadoutAuthority, GoalGraphLoadoutAuthorityRecord } from './goal-graph/types.ts';

const RECORDS: readonly GoalGraphLoadoutAuthorityRecord[] = Object.freeze([
  Object.freeze({
    loadoutId: 'loadout:fitcheck-launch',
    eligibleWorkObjectIds: Object.freeze(['sapling:fitcheck']),
    authorizedClusterIds: Object.freeze(['cluster:fitcheck-no-spend']),
    authorityDigest: 'sha256:0da82992502ada3151891060306c1603c3fb692e3ec5487599143e6dfd67f522',
    sourceRef: 'docs/project-management/hermes-execution-foldback-preflight.v1.json',
  }),
  Object.freeze({
    loadoutId: 'loadout:iverif-observer',
    eligibleWorkObjectIds: Object.freeze(['sapling:iverif']),
    authorizedClusterIds: Object.freeze(['cluster:iverif-observer']),
    authorityDigest: 'sha256:59ab598321cbaa4e9438ae4bd1496e2688eec6ed414733a266b39e175b1a4a72',
    sourceRef: 'docs/project-management/hermes-execution-foldback-preflight-iverif.v1.json',
  }),
]);

const BY_ID = new Map(RECORDS.map((record) => [record.loadoutId, record] as const));

export const GOAL_GRAPH_LOADOUT_AUTHORITY: GoalGraphLoadoutAuthority = Object.freeze({
  resolve(loadoutId: string): GoalGraphLoadoutAuthorityRecord | null {
    return BY_ID.get(loadoutId) ?? null;
  },
});

export const GOAL_GRAPH_LOADOUT_RECORDS = RECORDS;
