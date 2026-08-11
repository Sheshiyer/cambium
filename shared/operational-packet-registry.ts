import { FITCHECK_GOLDEN_PATH } from './fitcheck-golden-path.ts';
import { IVERIF_GOLDEN_PATH } from './iverif-golden-path.ts';
import type { OperationalPacketProjection } from './operational-packet-projection.ts';

export const OPERATIONAL_PACKET_PROJECTIONS: readonly OperationalPacketProjection[] = Object.freeze([
  FITCHECK_GOLDEN_PATH,
  IVERIF_GOLDEN_PATH,
]);

const projectionsByWorkId = new Map(
  OPERATIONAL_PACKET_PROJECTIONS.map((projection) => [projection.identity.workId, projection] as const),
);

if (projectionsByWorkId.size !== OPERATIONAL_PACKET_PROJECTIONS.length) {
  throw new Error('operational packet registry contains duplicate WorkObject IDs');
}

export function operationalPacketProjectionFor(workId: string): OperationalPacketProjection | null {
  return projectionsByWorkId.get(workId) ?? null;
}
