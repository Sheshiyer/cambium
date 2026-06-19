import { buildCambiumScene } from './scene-data.ts';
import { defaultScreenId } from './route-registry.ts';
import type { CameraMode, CambiumSceneModel, EmitterLane, SceneNodeState, SceneRail, ScreenId } from './types.ts';

export type TapestrySnapshotNodeStatus = 'complete' | 'active' | 'pending' | 'memory';
export type TapestrySnapshotRailLane = 'handoff' | 'runner' | 'memory';

export interface TapestrySnapshotNode {
  id: string;
  organ: string;
  title: string;
  status: TapestrySnapshotNodeStatus;
  x?: number;
  z?: number;
  inputs?: readonly string[];
  outputs?: readonly string[];
}

export interface TapestrySnapshotRail {
  id: string;
  from: string;
  to: string;
  lane: TapestrySnapshotRailLane;
}

export interface TapestrySnapshotQuest {
  id: string;
  arc?: string;
  status: 'complete' | 'active' | 'locked' | string;
  evidence?: string;
}

export interface TapestrySnapshot {
  schema: 'cambium.fractal-tapestry.snapshot.v1';
  standalone: true;
  tenant: {
    id: string;
    label: string;
    vision: string;
    mission: string;
  };
  recursion: readonly ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio'];
  nodes: readonly TapestrySnapshotNode[];
  rails: readonly TapestrySnapshotRail[];
  telemetry: {
    worldVersion: number;
    completedQuestCount: number;
    totalQuestCount: number;
    onboardingSteps: number;
    projectArchived: boolean;
    source: string;
  };
  quests: readonly TapestrySnapshotQuest[];
}

function assertStandaloneSnapshot(snapshot: TapestrySnapshot): void {
  if (snapshot.schema !== 'cambium.fractal-tapestry.snapshot.v1') {
    throw new Error(`unsupported tapestry snapshot schema: ${snapshot.schema}`);
  }
  if (snapshot.standalone !== true) {
    throw new Error('tapestry snapshot must be standalone');
  }
  if (snapshot.recursion.join('>') !== 'skill>cluster>organ>venture>company>portfolio') {
    throw new Error('tapestry snapshot must preserve the six-scale recursion');
  }
}

const nodeState = (status: TapestrySnapshotNodeStatus): SceneNodeState => status;

function ringForState(state: SceneNodeState, selected: boolean) {
  if (selected || state === 'active') return 'breathing' as const;
  if (state === 'memory') return 'dashed' as const;
  return 'solid' as const;
}

function toneForLane(lane: TapestrySnapshotRailLane): SceneRail['tone'] {
  if (lane === 'memory') return 'memory';
  if (lane === 'runner') return 'secondary';
  return 'primary';
}

function sceneLaneForSnapshotLane(lane: TapestrySnapshotRailLane): SceneRail['lane'] {
  if (lane === 'memory') return 'background-emitter';
  return lane;
}

function emitterLanesFromRails(rails: readonly SceneRail[]): EmitterLane[] {
  return rails.map((rail) => ({
    id: `${rail.id}-emitter`,
    from: rail.from,
    to: rail.to,
    label: rail.lane === 'background-emitter' ? 'MEMORY FEED' : rail.lane === 'runner' ? 'RUNNER LOOP' : 'HANDOFF',
    cadence: rail.lane === 'background-emitter' ? 'ambient' : 'pulse',
    intensity: rail.packetCount / 4,
  }));
}

function activeQuest(snapshot: TapestrySnapshot): TapestrySnapshotQuest | undefined {
  return snapshot.quests.find((quest) => quest.status === 'active')
    ?? snapshot.quests.find((quest) => quest.status !== 'complete');
}

export function buildCambiumSceneFromTapestrySnapshot(
  snapshot: TapestrySnapshot,
  activeScreenId: ScreenId = defaultScreenId,
  cameraMode?: CameraMode,
): CambiumSceneModel {
  assertStandaloneSnapshot(snapshot);

  const base = buildCambiumScene(activeScreenId, cameraMode);
  const snapshotNodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const snapshotRails = new Map(snapshot.rails.map((rail) => [rail.id, rail]));
  const active = activeQuest(snapshot);

  const nodes = base.nodes.map((node) => {
    const fromSnapshot = snapshotNodes.get(node.id);
    if (!fromSnapshot) return node;
    const state = nodeState(fromSnapshot.status);
    return {
      ...node,
      organ: fromSnapshot.organ,
      title: fromSnapshot.title,
      state,
      x: fromSnapshot.x ?? node.x,
      z: fromSnapshot.z ?? node.z,
      ring: ringForState(state, node.selected),
      inputs: fromSnapshot.inputs ?? node.inputs,
      outputs: fromSnapshot.outputs ?? node.outputs,
    };
  });

  const rails = base.rails.map((rail) => {
    const fromSnapshot = snapshotRails.get(rail.id);
    if (!fromSnapshot) return rail;
    return {
      ...rail,
      from: fromSnapshot.from,
      to: fromSnapshot.to,
      tone: toneForLane(fromSnapshot.lane),
      lane: sceneLaneForSnapshotLane(fromSnapshot.lane),
    };
  });

  return {
    ...base,
    nodes,
    rails,
    emitterLanes: emitterLanesFromRails(rails),
    telemetry: {
      progressLabel: `${snapshot.tenant.label} · ${snapshot.telemetry.completedQuestCount}/${snapshot.telemetry.totalQuestCount} quests`,
      completedQuests: snapshot.telemetry.completedQuestCount,
      totalQuests: snapshot.telemetry.totalQuestCount,
      activeArc: active?.arc ?? base.telemetry.activeArc,
      activeQuestId: active?.id ?? base.telemetry.activeQuestId,
      freshness: 'live',
      derivedAtLabel: `snapshot · ${snapshot.telemetry.source} · world v${snapshot.telemetry.worldVersion}`,
    },
  };
}
