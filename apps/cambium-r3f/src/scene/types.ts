export type SceneNodeState = 'complete' | 'active' | 'pending' | 'memory';
export type CameraMode = 'overview' | 'node' | 'flat';
export type ScreenMode = 'overview' | 'island' | 'settings' | 'visualizations' | 'components' | 'asset-comparison';
export type IslandBiome = 'seed' | 'resonance' | 'forge' | 'loop' | 'memory';
export type IslandSilhouette = 'seed-crystal' | 'taste-knot' | 'forge-anvil' | 'ops-loop' | 'memory-orbit';
export type ScreenId =
  | 'home'
  | 'island-genesis'
  | 'island-taste'
  | 'island-build'
  | 'island-ops'
  | 'island-cortex'
  | 'elements-settings'
  | 'visualizations'
  | 'figma-components'
  | 'asset-comparison';

export interface SceneReference {
  taskId: string;
  screen: string;
  label: string;
  image: string;
  prompt: string;
  sha256: string;
}

export interface SceneNode {
  id: string;
  organ: string;
  title: string;
  state: SceneNodeState;
  x: number;
  z: number;
  height: number;
  ring: 'solid' | 'breathing' | 'dashed';
  glyph: 'seed' | 'taste' | 'hands' | 'will' | 'cortex';
  coolshapeIntent: string;
  coolshape: { shapeType: 'star' | 'flower' | 'ellipse' | 'wheel' | 'moon' | 'misc' | 'triangle' | 'polygon' | 'rectangle'; index: number };
  biome: IslandBiome;
  silhouette: IslandSilhouette;
  worldScale: number;
  cameraTarget: { x: number; y: number; z: number; zoom: number };
  selected: boolean;
  inputs: readonly string[];
  outputs: readonly string[];
  reference?: SceneReference;
}

export interface SceneRail {
  id: string;
  from: string;
  to: string;
  packetCount: number;
  tone: 'primary' | 'secondary' | 'memory';
  lane: 'runner' | 'handoff' | 'background-emitter';
}

export interface EmitterLane {
  id: string;
  from: string;
  to: string;
  label: string;
  cadence: string;
  intensity: number;
}

export interface SceneTelemetry {
  progressLabel: string;
  completedQuests: number;
  totalQuests: number;
  activeArc: string;
  activeQuestId: string;
  freshness: 'live' | 'stale';
  derivedAtLabel: string;
}

export interface ScenePanel {
  title: string;
  value: string;
  detail: string;
  tone: 'signal' | 'mist' | 'depth';
}

export interface ScreenSpec {
  id: ScreenId;
  taskId: string;
  issue: number;
  title: string;
  eyebrow: string;
  mode: ScreenMode;
  focusNode?: string;
  exactLabels: readonly string[];
  description: string;
  defaultCamera: CameraMode;
  panels: readonly ScenePanel[];
  reference?: SceneReference;
}

export interface OverviewArtDirection {
  routeId: 'home';
  mapOccupancyTarget: number;
  cameraZoom: number;
  islandGlyphScale: number;
  railParticleMultiplier: number;
  domChrome: 'minimal-world-first';
  heroGlyphs: Record<'genesis' | 'taste' | 'build' | 'ops' | 'cortex', string>;
}

export interface DesktopViewport {
  id: string;
  label: string;
  width: number;
  height: number;
  role: 'primary-review' | 'secondary-review';
}

export interface VisualFeedbackGate {
  status: 'awaiting-user-flow-feedback';
  reviewer: 'user';
  browserVisualE2E: 'skipped-by-user-request';
  acceptanceMode: 'human-perceptual-flow-review';
  automatedProof: readonly string[];
  explicitNonGoals: readonly string[];
}

export interface ElectronReadiness {
  targetShell: 'electron-macos-laptop';
  minWindow: { width: number; height: number };
  routeMode: 'hash-route-scene-states';
  inputs: readonly ('keyboard' | 'mouse' | 'trackpad')[];
  outOfScope: readonly string[];
}

export interface CambiumQaPolicy {
  desktopViewports: readonly DesktopViewport[];
  visualFeedbackGate: VisualFeedbackGate;
  electronReadiness: ElectronReadiness;
}

export interface EngineControl {
  id: string;
  label: string;
  value: string;
  kind: 'quality' | 'material' | 'emitter' | 'camera' | 'accessibility';
}

export interface VisualizationLayer {
  id: string;
  label: string;
  value: string;
  tone: 'signal' | 'mist' | 'depth';
}

export interface CambiumSceneModel {
  nodes: SceneNode[];
  rails: SceneRail[];
  emitterLanes: EmitterLane[];
  engineControls: EngineControl[];
  visualizationLayers: VisualizationLayer[];
  references: SceneReference[];
  screens: ScreenSpec[];
  activeScreen: ScreenSpec;
  cameraMode: CameraMode;
  overviewArtDirection: OverviewArtDirection;
  telemetry: SceneTelemetry;
  qaPolicy: CambiumQaPolicy;
  acceptanceChecks: readonly { name: string; pass: string; owner: string; consequence: string }[];
  interactionPlan: Record<string, unknown>;
}
