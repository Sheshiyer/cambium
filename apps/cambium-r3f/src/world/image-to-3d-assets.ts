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

export type ImageTo3dReviewCriterionId =
  | 'source-fidelity'
  | 'silhouette-richness'
  | 'material-depth'
  | 'scale-legibility'
  | 'runtime-derivative'
  | 'scene-fit';

export interface ImageTo3dReviewCriterion {
  id: ImageTo3dReviewCriterionId;
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  weight: number;
  note: string;
}

export interface ImageTo3dReview {
  gate: 'perceptual-reference-comparison';
  gateStatus: 'manual-approval-required';
  readiness: 'review-ready' | 'needs-art-pass';
  score: number;
  threshold: number;
  blockers: readonly string[];
  nextAction: string;
  criteria: readonly ImageTo3dReviewCriterion[];
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
  review: ImageTo3dReview;
  scene: {
    currentTargetSize: number;
    masterTargetSize: number;
    rotation: [number, number, number];
  };
}

const genesisRuntime = meshyAssetFor('genesis');
const reviewThreshold = 86;

function buildReview(
  criteria: readonly ImageTo3dReviewCriterion[],
  blockers: readonly string[],
  nextAction: string,
): ImageTo3dReview {
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const weightedScore = criteria.reduce((sum, criterion) => sum + (criterion.score / 5) * criterion.weight, 0);
  const score = Math.round((weightedScore / totalWeight) * 100);

  return {
    gate: 'perceptual-reference-comparison',
    gateStatus: 'manual-approval-required',
    readiness: score >= reviewThreshold && blockers.length === 0 ? 'review-ready' : 'needs-art-pass',
    score,
    threshold: reviewThreshold,
    blockers,
    nextAction,
    criteria,
  };
}

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
    review: buildReview(
      [
        { id: 'source-fidelity', label: 'SOURCE FIT', score: 5, weight: 18, note: 'matches the seed plate silhouette and palette' },
        { id: 'silhouette-richness', label: 'SILHOUETTE', score: 4, weight: 22, note: 'stronger than current runtime mesh' },
        { id: 'material-depth', label: 'MATERIAL', score: 4, weight: 20, note: 'visible substrate ridges survive optimization' },
        { id: 'scale-legibility', label: 'SCALE READ', score: 4, weight: 14, note: 'reads as an island from tactical camera height' },
        { id: 'runtime-derivative', label: 'RUNTIME', score: 5, weight: 14, note: 'optimized candidate fits the runtime budget' },
        { id: 'scene-fit', label: 'SCENE FIT', score: 4, weight: 12, note: 'fits the Cambium map language without literal architecture' },
      ],
      [],
      'Human visual approval can compare Genesis against the reference pack before promotion.',
    ),
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
    review: buildReview(
      [
        { id: 'source-fidelity', label: 'SOURCE FIT', score: 4, weight: 18, note: 'keeps the arc language but loses some plate thickness' },
        { id: 'silhouette-richness', label: 'SILHOUETTE', score: 4, weight: 22, note: 'clear connector profile in isolation' },
        { id: 'material-depth', label: 'MATERIAL', score: 4, weight: 20, note: 'texture survives but needs stronger edge contrast' },
        { id: 'scale-legibility', label: 'SCALE READ', score: 3, weight: 14, note: 'can read too fine beside organ islands' },
        { id: 'runtime-derivative', label: 'RUNTIME', score: 5, weight: 14, note: 'optimized candidate fits the runtime budget' },
        { id: 'scene-fit', label: 'SCENE FIT', score: 4, weight: 12, note: 'works as a rail specimen but needs in-world spacing checks' },
      ],
      ['connector scale needs scene-side approval'],
      'Review rail thickness and spacing in the full tactical overview before promotion.',
    ),
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
