import { meshyAssetFor } from './meshy-assets.ts';

export const imageTo3dComparisonIds = ['genesis', 'rail-arc'] as const;
export type ImageTo3dComparisonId = typeof imageTo3dComparisonIds[number];

export interface ImageTo3dRuntimeAsset {
  title: string;
  model: string;
  thumbnail: string;
  source: 'text-to-3d-runtime';
}

export interface ImageTo3dMasterAsset {
  taskId: string;
  title: string;
  model: string;
  thumbnail: string;
  alphaThumbnail: string;
  sourceImage: string;
  sourceTexture: string;
  modelBytes: number;
  taskCredits: number;
}

export interface ImageTo3dOptimizedAsset {
  model: string;
  modelBytes: number;
  method: 'texture-1536' | 'texture-1536-grid256';
  report: string;
  runtimeBudgetStatus: 'pass';
  promotionStatus: 'not-promoted';
}

export interface ImageTo3dComparisonAsset {
  id: ImageTo3dComparisonId;
  label: string;
  role: 'island' | 'connector';
  verdict: 'master-candidate';
  promotionStatus: 'not-promoted';
  current?: ImageTo3dRuntimeAsset;
  master: ImageTo3dMasterAsset;
  optimized: ImageTo3dOptimizedAsset;
  scene: {
    currentTargetSize: number;
    masterTargetSize: number;
    rotation: [number, number, number];
  };
}

const genesisRuntime = meshyAssetFor('genesis');

export const imageTo3dComparisonAssets: readonly ImageTo3dComparisonAsset[] = [
  {
    id: 'genesis',
    label: 'GENESIS',
    role: 'island',
    verdict: 'master-candidate',
    promotionStatus: 'not-promoted',
    current: genesisRuntime
      ? {
          title: genesisRuntime.title,
          model: genesisRuntime.model,
          thumbnail: genesisRuntime.thumbnail,
          source: 'text-to-3d-runtime',
        }
      : undefined,
    master: {
      taskId: '019ebc10-4745-7225-912e-a304d8ef2425',
      title: 'Genesis seed island master',
      sourceImage: 'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/genesis.png',
      sourceTexture: '/assets/meshy/image-to-3d/source-plates/genesis.png',
      model: '/assets/meshy/image-to-3d/genesis/model.glb',
      thumbnail: '/assets/meshy/image-to-3d/genesis/thumbnail.png',
      alphaThumbnail: '/assets/meshy/image-to-3d/genesis/thumbnail-alpha.png',
      modelBytes: 71054312,
      taskCredits: 30,
    },
    optimized: {
      model: '/assets/meshy/image-to-3d/genesis/optimized/model.glb',
      modelBytes: 12317204,
      method: 'texture-1536-grid256',
      report: 'docs/plans/assets/cambium-r3f-game-engine-realignment/verification/master-comparison/genesis-optimize-1536-grid256.json',
      runtimeBudgetStatus: 'pass',
      promotionStatus: 'not-promoted',
    },
    scene: {
      currentTargetSize: 1.34,
      masterTargetSize: 1.68,
      rotation: [0, -0.18, 0],
    },
  },
  {
    id: 'rail-arc',
    label: 'RAIL ARC',
    role: 'connector',
    verdict: 'master-candidate',
    promotionStatus: 'not-promoted',
    master: {
      taskId: '019ebc10-9ca7-7a9f-a599-12fd4e4952ef',
      title: 'Curved rail connector master',
      sourceImage: 'docs/plans/assets/cambium-r3f-game-engine-realignment/image-source-pass/source-plates/rail-arc.png',
      sourceTexture: '/assets/meshy/image-to-3d/source-plates/rail-arc.png',
      model: '/assets/meshy/image-to-3d/rail-arc/model.glb',
      thumbnail: '/assets/meshy/image-to-3d/rail-arc/thumbnail.png',
      alphaThumbnail: '/assets/meshy/image-to-3d/rail-arc/thumbnail-alpha.png',
      modelBytes: 55987668,
      taskCredits: 30,
    },
    optimized: {
      model: '/assets/meshy/image-to-3d/rail-arc/optimized/model.glb',
      modelBytes: 15522024,
      method: 'texture-1536',
      report: 'docs/plans/assets/cambium-r3f-game-engine-realignment/verification/master-comparison/rail-arc-optimize-1536.json',
      runtimeBudgetStatus: 'pass',
      promotionStatus: 'not-promoted',
    },
    scene: {
      currentTargetSize: 1.16,
      masterTargetSize: 1.62,
      rotation: [0, 0.28, 0],
    },
  },
];

export function imageTo3dComparisonAssetFor(id: string): ImageTo3dComparisonAsset | undefined {
  return imageTo3dComparisonAssets.find((asset) => asset.id === id);
}
