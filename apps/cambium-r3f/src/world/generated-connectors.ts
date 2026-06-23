import { imageTo3dComparisonAssetFor } from './image-to-3d-assets.ts';

const railArc = imageTo3dComparisonAssetFor('rail-arc');

export const generatedRailConnectorContract = {
  id: 'rail-arc',
  role: 'physical-island-connector',
  integrationMode: 'scene-preview',
  promotedRuntimeAsset: false,
  source: 'image-to-3d-optimized-candidate',
  model: railArc?.optimized.model ?? '/assets/meshy/image-to-3d/rail-arc/optimized/model.glb',
  sourcePlate: railArc?.master.sourceTexture ?? '/assets/meshy/image-to-3d/source-plates/rail-arc.png',
  scaleStatus: railArc?.review.readiness ?? 'needs-art-pass',
  blocker: railArc?.review.blockers[0] ?? 'connector scale needs scene-side approval',
  designRules: [
    'connect islands with physical basalt slabs instead of abstract line-only rails',
    'keep chartreuse signal lane visible on top of each connector',
    'use generated rail-arc silhouette as the connector specimen while scale remains under review',
    'do not mark the asset as promoted until user visual approval clears the hold',
  ],
} as const;

export function railConnectorCanPromote() {
  return Boolean(generatedRailConnectorContract.promotedRuntimeAsset);
}
