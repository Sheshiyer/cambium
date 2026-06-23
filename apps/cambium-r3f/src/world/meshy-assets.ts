export const meshyIslandIds = ['genesis', 'taste', 'build', 'ops', 'cortex'] as const;
export type MeshyIslandId = typeof meshyIslandIds[number];

interface IslandAssetManifest {
  taskId: string;
  stage: 'preview' | 'refined';
  taskType: string;
  title: string;
  model: string;
  thumbnail: string;
  taskCredits: number;
}

export interface MeshyIslandAsset extends IslandAssetManifest {
  id: MeshyIslandId;
  sceneScale: number;
  scenePosition: [number, number, number];
  sceneRotation: [number, number, number];
}

export const meshyAssetManifestStatus = 'complete';

const manifestAssets: Record<MeshyIslandId, IslandAssetManifest> = {
  genesis: {
    taskId: '019ebab1-c1b1-7f5f-96c0-27cc305acdcd',
    stage: 'refined',
    taskType: 'text-to-3d-refine',
    title: 'Genesis seed island',
    model: '/assets/meshy/islands/genesis/model.glb',
    thumbnail: '/assets/meshy/islands/genesis/thumbnail.png',
    taskCredits: 10,
  },
  taste: {
    taskId: '019ebab1-fae0-7f83-bd1c-fbe632c894d3',
    stage: 'refined',
    taskType: 'text-to-3d-refine',
    title: 'Taste resonance island',
    model: '/assets/meshy/islands/taste/model.glb',
    thumbnail: '/assets/meshy/islands/taste/thumbnail.png',
    taskCredits: 10,
  },
  build: {
    taskId: '019ebab5-51a1-7467-a7d0-cf062c789ff4',
    stage: 'refined',
    taskType: 'text-to-3d-refine',
    title: 'Build forge island',
    model: '/assets/meshy/islands/build/model.glb',
    thumbnail: '/assets/meshy/islands/build/thumbnail.png',
    taskCredits: 10,
  },
  ops: {
    taskId: '019ebab2-3666-73d3-822a-9b1796f2e454',
    stage: 'refined',
    taskType: 'text-to-3d-refine',
    title: 'Ops loop island',
    model: '/assets/meshy/islands/ops/model.glb',
    thumbnail: '/assets/meshy/islands/ops/thumbnail.png',
    taskCredits: 10,
  },
  cortex: {
    taskId: '019ebab2-64aa-73dc-96f2-4ef7b50702dc',
    stage: 'refined',
    taskType: 'text-to-3d-refine',
    title: 'Cortex memory island',
    model: '/assets/meshy/islands/cortex/model.glb',
    thumbnail: '/assets/meshy/islands/cortex/thumbnail.png',
    taskCredits: 10,
  },
};

const assetTransforms: Record<MeshyIslandId, Pick<MeshyIslandAsset, 'sceneScale' | 'scenePosition' | 'sceneRotation'>> = {
  genesis: {
    sceneScale: 0.68,
    scenePosition: [0, 0.24, 0],
    sceneRotation: [0, -0.16, 0],
  },
  taste: {
    sceneScale: 0.62,
    scenePosition: [0, 0.2, 0],
    sceneRotation: [0, 0.18, 0],
  },
  build: {
    sceneScale: 0.58,
    scenePosition: [0, 0.18, 0],
    sceneRotation: [0, -0.08, 0],
  },
  ops: {
    sceneScale: 0.68,
    scenePosition: [0, 0.22, 0],
    sceneRotation: [0, 0.08, 0],
  },
  cortex: {
    sceneScale: 0.64,
    scenePosition: [0, 0.24, 0],
    sceneRotation: [0, -0.1, 0],
  },
};

export const meshyIslandAssets: Record<MeshyIslandId, MeshyIslandAsset> = Object.fromEntries(
  meshyIslandIds.map((islandId) => {
    return [
      islandId,
      {
        id: islandId,
        ...manifestAssets[islandId],
        ...assetTransforms[islandId],
      },
    ];
  }),
) as Record<MeshyIslandId, MeshyIslandAsset>;

export function meshyAssetFor(id: string): MeshyIslandAsset | undefined {
  if (!meshyIslandIds.includes(id as MeshyIslandId)) return undefined;
  return meshyIslandAssets[id as MeshyIslandId];
}
