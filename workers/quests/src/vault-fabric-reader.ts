// Track A · vault-side Mission Fabric reader.
//
// A thin, reads-only caller that composes the Phase G read client into the
// shape a vault/Hermes-side consumer wants: "give me this tenant's operating
// picture, or tell me why you can't." It never writes and never throws.
//
// This is the seam a founder-facing surface (or a Hermes read step) binds to:
// pass a resolved MissionFabricReadConfig; get back a compact summary or a
// gap. The heavy lifting (transport, digest check, caps, graceful fallback)
// stays in mission-fabric-read-client.ts.

import {
  readMissionFabric,
  type MissionFabricReadConfig,
  type MissionFabricReadResult,
  type GapReason,
} from './mission-fabric-read-client.ts';
import type { FabricNode, MissionFabricProjectionV1 } from './mission-fabric.ts';

export interface VaultFabricSummary {
  ok: true;
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  counts: {
    nodes: number;
    edges: number;
    gaps: number;
    byKind: Record<string, number>;
  };
  /** Open gaps surfaced by the projection, for founder attention. */
  openGaps: { gapId: string; kind: string; detail: string }[];
  projection: MissionFabricProjectionV1;
}

export interface VaultFabricGap {
  ok: false;
  tenantId: string;
  reason: GapReason;
  detail: string;
}

export type VaultFabricView = VaultFabricSummary | VaultFabricGap;

function countByKind(nodes: readonly FabricNode[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const node of nodes) out[node.kind] = (out[node.kind] ?? 0) + 1;
  return out;
}

function summarize(result: MissionFabricReadResult): VaultFabricView {
  if (!result.ok) {
    return { ok: false, tenantId: result.tenantId, reason: result.reason, detail: result.detail };
  }
  const { projection } = result;
  return {
    ok: true,
    tenantId: result.tenantId,
    graphVersion: result.graphVersion,
    graphDigest: result.graphDigest,
    counts: {
      nodes: projection.nodes.length,
      edges: projection.edges.length,
      gaps: projection.gaps.length,
      byKind: countByKind(projection.nodes),
    },
    openGaps: projection.gaps.map((g) => ({ gapId: g.gapId, kind: g.kind, detail: g.detail })),
    projection,
  };
}

/**
 * Read one tenant's Mission Fabric and reduce it to a vault-side view. When
 * live reads are disabled or anything fails, returns a gap view — callers
 * render "no live picture" rather than crashing.
 */
export async function readVaultFabricView(config: MissionFabricReadConfig): Promise<VaultFabricView> {
  const result = await readMissionFabric(config);
  return summarize(result);
}
