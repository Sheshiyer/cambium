import type { CambiumSceneModel } from './types';

export const perceptualReferenceCriteria = [
  {
    id: 'silhouette-richness',
    target: 'Each organ island has a distinct procedural silhouette and biome.',
    weight: 18,
  },
  {
    id: 'material-depth',
    target: 'Island terrain uses shader studies, contour bands, and biome-specific material roles.',
    weight: 18,
  },
  {
    id: 'atmosphere-depth',
    target: 'Scene includes fog, haze sheets, vignette/scanline post-process styling, and layered substrate depth.',
    weight: 16,
  },
  {
    id: 'in-world-typography',
    target: 'Island labels and route state exist inside the world, not only in the DOM HUD.',
    weight: 14,
  },
  {
    id: 'camera-choreography',
    target: 'Camera movement has overview/node/flat choreography, drift, focus targets, and route transitions.',
    weight: 16,
  },
  {
    id: 'game-map-legibility',
    target: 'The user/process position, rails, emitters, and active frontier remain legible as a tactical map.',
    weight: 18,
  },
] as const;

export function scorePerceptualReferenceGate(scene: CambiumSceneModel) {
  const uniqueSilhouettes = new Set(scene.nodes.map((node) => node.silhouette));
  const uniqueBiomes = new Set(scene.nodes.map((node) => node.biome));
  const hasCameraTargets = scene.nodes.every((node) => node.cameraTarget.zoom >= 100);
  const hasEmitterNetwork = scene.emitterLanes.length >= scene.rails.length;
  const hasSceneNativeLayers = scene.visualizationLayers.length >= 6;

  const checks = [
    uniqueSilhouettes.size === scene.nodes.length && uniqueBiomes.size === scene.nodes.length,
    scene.nodes.every((node) => node.worldScale > 1 && node.coolshapeIntent.includes('object')),
    scene.acceptanceChecks.length > 0 && hasSceneNativeLayers,
    scene.nodes.every((node) => node.title.length > 0) && scene.screens.every((screen) => screen.exactLabels.length >= 5),
    hasCameraTargets && ['overview', 'node', 'flat'].every((mode) => scene.screens.some((screen) => screen.defaultCamera === mode)),
    hasEmitterNetwork && scene.rails.some((rail) => rail.lane === 'background-emitter'),
  ];

  const score = perceptualReferenceCriteria.reduce((sum, criterion, index) => sum + (checks[index] ? criterion.weight : 0), 0);

  return {
    score,
    passed: score >= 86,
    checks: perceptualReferenceCriteria.map((criterion, index) => ({
      ...criterion,
      passed: checks[index],
    })),
  };
}
