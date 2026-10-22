import type { GoalGraphLoadoutAuthority, GoalGraphLoadoutAuthorityRecord } from './goal-graph/types.ts';

const RECORDS: readonly GoalGraphLoadoutAuthorityRecord[] = Object.freeze([
  // Finite source policy only: this registry entry does not issue admission or a Gate approval.
  Object.freeze({
    loadoutId: 'loadout:wtfmedia-source-audit',
    eligibleWorkObjectIds: Object.freeze(['branch:wtfmedia']),
    authorizedClusterIds: Object.freeze(['cluster:wtfmedia-source-verification']),
    authorityDigest: 'sha256:86a41489579215fc1fa597c645b1c61d6a5cdbd2e0f28227a5d611c1a0e64064',
    sourceRef: 'docs/project-management/wtfmedia-source-audit-loadout.v1.json',
  }),
  // Finite source policy only, same terms as WTFMedia: ParkArea de-holidays audit (parkarea-aleph).
  Object.freeze({
    loadoutId: 'loadout:parkarea-source-audit',
    eligibleWorkObjectIds: Object.freeze(['branch:parkarea']),
    authorizedClusterIds: Object.freeze(['cluster:parkarea-source-verification']),
    authorityDigest: 'sha256:9e8b683b15bfb3de1485bca004bc79951bc0f783f525f956aa3a8d20d0b38d85',
    sourceRef: 'docs/project-management/parkarea-source-audit-loadout.v1.json',
  }),
  // Finite source policy only, same terms as WTFMedia: Relovo api-client audit (Sheshiyer/relovo).
  Object.freeze({
    loadoutId: 'loadout:relovo-source-audit',
    eligibleWorkObjectIds: Object.freeze(['branch:relovo']),
    authorizedClusterIds: Object.freeze(['cluster:relovo-source-verification']),
    authorityDigest: 'sha256:51d13e1e61510aeacfa430d104fea72e74759c4922f1e45b505c31d93bab7000',
    sourceRef: 'docs/project-management/relovo-source-audit-loadout.v1.json',
  }),
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
