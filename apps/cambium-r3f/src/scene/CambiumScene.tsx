import { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TacticalCameraRig } from '../engine/camera-rig';
import { fogPreset, materialPresets } from '../materials/cambium-materials';
import { createAtmosphereMaterial, createIslandShaderMaterial } from '../materials/shader-studies';
import { createCambiumFieldContours, createCambiumFieldGeometry, createCambiumFieldSeams } from '../world/cambium-field';
import { generatedRailConnectorContract } from '../world/generated-connectors';
import { imageTo3dComparisonAssets, type ImageTo3dComparisonAsset } from '../world/image-to-3d-assets';
import {
  activeProcessNode,
  createIslandPorts,
  createRailPacketMarkers,
  createVisualizationOverlaySpecs,
  type IslandPort,
  type RailPacketMarker,
  type VisualizationOverlaySpec,
} from '../world/living-flow-assets';
import { meshyAssetFor, type MeshyIslandAsset } from '../world/meshy-assets';
import { createProceduralIslandGeometry } from '../world/procedural-islands';
import type { CameraMode, CambiumSceneModel, SceneNode, SceneRail } from './types';
import { visualTokens } from './visual-tokens';

interface SceneProps {
  scene: CambiumSceneModel;
  cameraMode: CameraMode;
}

type SceneVariant = 'standard' | 'reference-overview';

function LinePrimitive({ points, color, opacity }: { points: THREE.Vector3[]; color: string; opacity: number }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geometry, material);
  }, [color, opacity, points]);

  return <primitive object={line} />;
}

function makeLabelTexture(title: string, detail: string, tone: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = tone;
  context.fillRect(0, 0, 10, 126);
  context.fillStyle = 'rgba(0, 39, 43, 0.72)';
  context.fillRect(14, 12, 470, 108);
  context.strokeStyle = 'rgba(214, 255, 246, 0.28)';
  context.strokeRect(14.5, 12.5, 469, 107);
  context.font = '700 44px Arial Narrow, sans-serif';
  context.fillStyle = '#D6FFF6';
  context.fillText(title.toUpperCase(), 34, 62);
  context.font = '24px monospace';
  context.fillStyle = tone;
  context.fillText(detail.toUpperCase(), 34, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function WorldLabel({ title, detail, position, tone = visualTokens.colors.signal }: {
  title: string;
  detail: string;
  position: [number, number, number];
  tone?: string;
}) {
  const texture = useMemo(() => makeLabelTexture(title, detail, tone), [detail, title, tone]);

  return (
    <sprite position={position} scale={[1.52, 0.48, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function AtmosphereStack() {
  const nearMaterial = useMemo(() => createAtmosphereMaterial(0.16), []);
  const farMaterial = useMemo(() => createAtmosphereMaterial(0.11), []);

  return (
    <group>
      <mesh position={[0, 1.2, -4.6]} rotation={[-0.32, 0, 0]}>
        <planeGeometry args={[16, 3.2, 1, 1]} />
        <primitive object={farMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0.86, 3.65]} rotation={[-0.52, 0, 0]}>
        <planeGeometry args={[16, 2.8, 1, 1]} />
        <primitive object={nearMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function CambiumField({ mode }: { mode: CameraMode }) {
  const flat = mode === 'flat';
  const fieldGeometry = useMemo(() => createCambiumFieldGeometry(mode), [mode]);
  const contours = useMemo(() => createCambiumFieldContours(mode), [mode]);
  const seams = useMemo(() => createCambiumFieldSeams(mode), [mode]);

  return (
    <group position={[0, -0.12, 0]}>
      <mesh geometry={fieldGeometry} receiveShadow>
        <meshStandardMaterial
          color={materialPresets.substrate.color}
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={flat ? 0.96 : 0.92}
          roughness={materialPresets.substrate.roughness}
          metalness={materialPresets.substrate.metalness}
        />
      </mesh>
      {contours.map((contour) => (
        <LinePrimitive
          key={contour.id}
          points={contour.points}
          color={materialPresets.contour.color}
          opacity={contour.opacity}
        />
      ))}
      {seams.map((seam) => (
        <LinePrimitive
          key={seam.id}
          points={seam.points}
          color={seam.id.endsWith('0') ? visualTokens.colors.signal : visualTokens.colors.depth}
          opacity={seam.opacity}
        />
      ))}
    </group>
  );
}

function railMaterial(rail: SceneRail) {
  if (rail.tone === 'primary') return materialPresets.railPrimary;
  if (rail.tone === 'memory') return materialPresets.railMemory;
  return materialPresets.railSecondary;
}

function RailConnectorPreview({
  length,
  position,
  rotationY,
  rail,
}: {
  length: number;
  position: [number, number, number];
  rotationY: number;
  rail: SceneRail;
}) {
  const gltf = useLoader(GLTFLoader, generatedRailConnectorContract.model);
  const normalized = useMemo(() => normalizeGltfScene(gltf.scene, 1), [gltf.scene]);
  const connectorScale = rail.lane === 'background-emitter' ? 0.42 : Math.min(0.74, Math.max(0.42, length * 0.12));
  const tone = rail.tone === 'memory' ? visualTokens.colors.depth : visualTokens.colors.signal;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, 0.16, 0]} scale={[connectorScale * normalized.scale, connectorScale * normalized.scale * 0.32, connectorScale * normalized.scale * 0.54]}>
        <primitive object={normalized.model} />
      </group>
      <mesh position={[0, 0.34, 0]} scale={[connectorScale * 0.92, 0.014, 0.06]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={tone} transparent opacity={rail.lane === 'background-emitter' ? 0.22 : 0.42} />
      </mesh>
    </group>
  );
}

function RailBody({ rail, from, to }: { rail: SceneRail; from: SceneNode; to: SceneNode }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const midX = (from.x + to.x) / 2;
  const midZ = (from.z + to.z) / 2;
  const rotationY = Math.atan2(-dz, dx);
  const material = railMaterial(rail);
  const bodyOpacity = rail.lane === 'background-emitter' ? 0.28 : 0.46;
  const laneOpacity = rail.lane === 'background-emitter' ? 0.2 : 0.72;

  return (
    <group position={[midX, 0.18, midZ]} rotation={[0, rotationY, 0]}>
      <mesh scale={[length, 0.08, rail.lane === 'background-emitter' ? 0.08 : 0.16]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={visualTokens.colors.substrate}
          transparent
          opacity={bodyOpacity}
          roughness={0.86}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, 0.062, 0]} scale={[length * 0.92, 0.018, rail.lane === 'background-emitter' ? 0.022 : 0.044]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={material.color} transparent opacity={laneOpacity} />
      </mesh>
      <mesh position={[-length / 2, 0.08, 0]} scale={[0.16, 0.04, 0.22]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={material.color} transparent opacity={0.38} />
      </mesh>
      <mesh position={[length / 2, 0.08, 0]} scale={[0.16, 0.04, 0.22]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={material.color} transparent opacity={0.38} />
      </mesh>
    </group>
  );
}

function quadraticRailPoint(from: SceneNode, to: SceneNode, t: number, lift: number) {
  const mid = new THREE.Vector3((from.x + to.x) / 2, lift, (from.z + to.z) / 2);
  const a = new THREE.Vector3(from.x, 0.34, from.z).lerp(mid, t);
  const b = mid.clone().lerp(new THREE.Vector3(to.x, 0.34, to.z), t);
  return a.lerp(b, t);
}

function quadraticRailPoints(from: SceneNode, to: SceneNode, lift: number, count: number) {
  return Array.from({ length: count }, (_, index) => quadraticRailPoint(from, to, index / (count - 1), lift));
}

function SignalPacket({ packet }: { packet: RailPacketMarker }) {
  const tone = packet.lane === 'background-emitter' ? visualTokens.colors.mist : visualTokens.colors.signal;

  return (
    <group position={packet.position} rotation={[0.42, packet.t * Math.PI, 0.18]}>
      <mesh scale={[packet.size * 1.55, packet.size * 0.82, packet.size * 0.82]}>
        <octahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.3} roughness={0.52} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[packet.size * 1.95, packet.size * 1.95, packet.size * 0.22]}>
        <torusGeometry args={[1, 0.09, 6, 24]} />
        <meshBasicMaterial color={visualTokens.colors.mist} transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function EmitterNode({ port }: { port: IslandPort }) {
  const tone = port.kind === 'memory' ? visualTokens.colors.depth : visualTokens.colors.signal;

  return (
    <group position={port.position} rotation={[0, port.rotationY, 0]}>
      <mesh position={[0, 0.06, 0]} scale={[0.18, 0.09, 0.18]}>
        <cylinderGeometry args={[1, 1.12, 1, 8]} />
        <meshStandardMaterial color={visualTokens.colors.substrate} emissive={tone} emissiveIntensity={0.07} roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.17, 0]} scale={[0.1, 0.06, 0.1]}>
        <cylinderGeometry args={[1, 0.72, 1, 8]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.24} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.006, 6, 36]} />
        <meshBasicMaterial color={tone} transparent opacity={0.44} />
      </mesh>
    </group>
  );
}

function ProcessBeacon({ node, showLabel = true }: { node: SceneNode; showLabel?: boolean }) {
  return (
    <group position={[node.x, 0.48, node.z]}>
      <mesh rotation={[0, Math.PI / 4, 0]} scale={[0.48, 0.08, 0.48]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color={visualTokens.colors.ink} emissive={visualTokens.colors.signal} emissiveIntensity={0.08} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, -Math.PI / 4]} scale={[0.18, 0.18, 0.18]}>
        <tetrahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.34} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.012, 6, 72]} />
        <meshBasicMaterial color={visualTokens.colors.signal} transparent opacity={0.58} />
      </mesh>
      {showLabel ? (
        <WorldLabel title="YOU ARE HERE" detail={`${node.title} // ${node.state}`} position={[0.24, 1.12, 0.22]} tone={visualTokens.colors.signal} />
      ) : null}
    </group>
  );
}

function IslandConnectionPorts({ nodes, rails }: { nodes: SceneNode[]; rails: SceneRail[] }) {
  const ports = useMemo(() => createIslandPorts(nodes, rails), [nodes, rails]);

  return (
    <group>
      {ports.map((port) => (
        <EmitterNode key={port.id} port={port} />
      ))}
    </group>
  );
}

function ReferenceRailNetwork({
  rails,
  nodes,
  particleMultiplier,
}: {
  rails: SceneRail[];
  nodes: SceneNode[];
  particleMultiplier: number;
}) {
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <group>
      {rails.map((rail) => {
        const from = nodesById.get(rail.from);
        const to = nodesById.get(rail.to);
        if (!from || !to) return null;
        const material = railMaterial(rail);
        const lift = rail.lane === 'background-emitter' ? 0.92 : 0.74;
        const curvePoints = quadraticRailPoints(from, to, lift, 28);
        const beadCount = rail.packetCount * particleMultiplier + (rail.lane === 'background-emitter' ? 8 : 5);
        const ghostOffset = rail.tone === 'memory' ? 0.18 : -0.14;

        return (
          <group key={`${rail.id}-reference-flow`}>
            <LinePrimitive points={curvePoints} color={material.color} opacity={rail.tone === 'memory' ? 0.34 : 0.72} />
            <LinePrimitive
              points={curvePoints.map((point) => point.clone().add(new THREE.Vector3(ghostOffset, 0.025, -ghostOffset * 0.42)))}
              color={rail.tone === 'memory' ? visualTokens.colors.depth : visualTokens.colors.signal}
              opacity={rail.tone === 'memory' ? 0.22 : 0.46}
            />
            {Array.from({ length: beadCount }).map((_, index) => {
              const t = (index + 0.45) / (beadCount + 0.9);
              const position = quadraticRailPoint(from, to, t, lift + Math.sin(index * 0.7) * 0.12);
              const size = rail.lane === 'background-emitter' ? 0.035 : index % 4 === 0 ? 0.075 : 0.048;
              const tone = rail.tone === 'memory' ? visualTokens.colors.depth : visualTokens.colors.signal;

              return (
                <group key={`${rail.id}-bead-${index}`} position={position}>
                  <mesh>
                    <sphereGeometry args={[size, 10, 10]} />
                    <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.48} roughness={0.42} />
                  </mesh>
                  {index % 5 === 0 ? (
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[size * 2.8, size * 0.12, 5, 24]} />
                      <meshBasicMaterial color={tone} transparent opacity={0.34} />
                    </mesh>
                  ) : null}
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function RailNetwork({
  rails,
  nodes,
  variant = 'standard',
  particleMultiplier = 1,
}: {
  rails: SceneRail[];
  nodes: SceneNode[];
  variant?: SceneVariant;
  particleMultiplier?: number;
}) {
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  if (variant === 'reference-overview') {
    return <ReferenceRailNetwork rails={rails} nodes={nodes} particleMultiplier={particleMultiplier} />;
  }

  return (
    <group>
      {rails.map((rail) => {
        const from = nodesById.get(rail.from);
        const to = nodesById.get(rail.to);
        if (!from || !to) return null;
        const middle = new THREE.Vector3((from.x + to.x) / 2, 0.42 + rail.packetCount * 0.025, (from.z + to.z) / 2);
        const material = railMaterial(rail);
        const points = [
          new THREE.Vector3(from.x, 0.28, from.z),
          middle,
          new THREE.Vector3(to.x, 0.28, to.z),
        ];
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.max(0.001, Math.hypot(dx, dz));
        const rotationY = Math.atan2(-dz, dx);
        const packets = createRailPacketMarkers(nodes, rail);

        return (
          <group key={rail.id}>
            <RailBody rail={rail} from={from} to={to} />
            <LinePrimitive points={points} color={material.color} opacity={material.opacity * 0.46} />
            <Suspense fallback={null}>
              <RailConnectorPreview
                length={length}
                position={[middle.x, 0.24, middle.z]}
                rotationY={rotationY}
                rail={rail}
              />
            </Suspense>
            {packets.map((packet) => <SignalPacket key={packet.id} packet={packet} />)}
          </group>
        );
      })}
    </group>
  );
}

function IslandCore({ node }: { node: SceneNode }) {
  if (node.silhouette === 'seed-crystal') {
    return (
      <group>
        <mesh rotation={[0.2, 0.55, 0.1]} position={[0, 0.78, 0]}>
          <tetrahedronGeometry args={[0.72, 1]} />
          <meshStandardMaterial {...materialPresets.islandSignal} roughness={0.54} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.35, 0]} scale={[0.9, 0.2, 0.9]}>
          <sphereGeometry args={[0.62, 24, 12]} />
          <meshStandardMaterial color={visualTokens.colors.mist} transparent opacity={0.22} roughness={0.9} />
        </mesh>
      </group>
    );
  }

  if (node.silhouette === 'taste-knot') {
    return (
      <group>
        <mesh rotation={[0.76, 0.18, 0.38]} position={[0, 0.68, 0]}>
          <torusKnotGeometry args={[0.48, 0.085, 112, 10]} />
          <meshStandardMaterial color={visualTokens.colors.mist} emissive={visualTokens.colors.signal} emissiveIntensity={0.12} roughness={0.62} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.44, 0]}>
          <torusGeometry args={[0.92, 0.018, 8, 96]} />
          <meshBasicMaterial color={visualTokens.colors.signal} transparent opacity={0.72} />
        </mesh>
      </group>
    );
  }

  if (node.silhouette === 'forge-anvil') {
    return (
      <group>
        <mesh position={[0, 0.42, 0]} scale={[1.15, 0.38, 0.72]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={visualTokens.colors.mist} roughness={0.7} metalness={0.18} />
        </mesh>
        <mesh rotation={[0.4, 0.78, 0.08]} position={[0.02, 0.95, 0]}>
          <octahedronGeometry args={[0.56, 1]} />
          <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.16} roughness={0.52} />
        </mesh>
      </group>
    );
  }

  if (node.silhouette === 'ops-loop') {
    return (
      <group>
        <mesh rotation={[Math.PI / 2.8, 0.4, 0.15]} position={[0, 0.64, 0]}>
          <torusGeometry args={[0.58, 0.08, 16, 96]} />
          <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.14} roughness={0.64} />
        </mesh>
        <mesh position={[0, 0.64, 0]}>
          <sphereGeometry args={[0.2, 18, 18]} />
          <meshStandardMaterial color={visualTokens.colors.ink} emissive={visualTokens.colors.mist} emissiveIntensity={0.1} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.65, 0]}>
        <icosahedronGeometry args={[0.58, 2]} />
        <meshStandardMaterial {...materialPresets.memory} roughness={0.58} metalness={0.16} />
      </mesh>
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh key={`memory-satellite-${index}`} position={[Math.cos(angle) * 0.88, 0.72 + Math.sin(index) * 0.06, Math.sin(angle) * 0.88]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.22} />
          </mesh>
        );
      })}
    </group>
  );
}

function ReferenceOverviewGlyph({ node, selected }: { node: SceneNode; selected: boolean }) {
  const tone = selected ? visualTokens.colors.signal : visualTokens.colors.mist;
  const baseMaterial = {
    color: visualTokens.colors.substrate,
    roughness: 0.48,
    metalness: 0.28,
    emissive: tone,
    emissiveIntensity: selected ? 0.16 : 0.07,
  };

  if (node.id === 'genesis') {
    return (
      <group position={[0, 0.78, 0]}>
        {Array.from({ length: 8 }).map((_, index) => {
          const angle = (index / 8) * Math.PI * 2;
          return (
            <mesh key={`genesis-ray-${index}`} position={[Math.cos(angle) * 0.34, 0.02, Math.sin(angle) * 0.34]} rotation={[0, -angle, Math.PI / 2]} scale={[0.5, 1, 1]}>
              <coneGeometry args={[0.18, 1.02, 3]} />
              <meshStandardMaterial {...baseMaterial} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.24, 24, 16]} />
          <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.55} roughness={0.38} />
        </mesh>
      </group>
    );
  }

  if (node.id === 'taste') {
    return (
      <group position={[0, 0.72, 0]} rotation={[0.12, -0.28, -0.08]}>
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[1.16, 0.56, 0.56]}>
          <cylinderGeometry args={[0.42, 0.42, 1.4, 32]} />
          <meshStandardMaterial {...baseMaterial} />
        </mesh>
        <mesh position={[-0.82, 0, 0]} scale={[0.44, 0.44, 0.44]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial {...baseMaterial} />
        </mesh>
        <mesh position={[0.82, 0, 0]} scale={[0.44, 0.44, 0.44]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial {...baseMaterial} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.018, 8, 72]} />
          <meshBasicMaterial color={tone} transparent opacity={0.7} />
        </mesh>
      </group>
    );
  }

  if (node.id === 'build') {
    return (
      <group position={[0, 0.74, 0]} rotation={[0.08, -0.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
          <ringGeometry args={[0.52, 0.84, 3]} />
          <meshStandardMaterial {...baseMaterial} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
          <circleGeometry args={[0.38, 3]} />
          <meshBasicMaterial color={tone} transparent opacity={0.36} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  if (node.id === 'ops') {
    return (
      <group position={[0, 0.7, 0]} rotation={[0.08, -0.56, 0.05]}>
        <mesh position={[-0.22, 0.04, 0]} rotation={[0.16, 0, -0.24]} scale={[0.78, 0.18, 0.82]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...baseMaterial} />
        </mesh>
        <mesh position={[0.34, 0.13, 0]} rotation={[-0.18, 0, 0.3]} scale={[0.72, 0.18, 0.82]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...baseMaterial} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.78, 0.03, 8, 96]} />
          <meshBasicMaterial color={tone} transparent opacity={0.62} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, 0.72, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.82, 0.08, 12, 120]} />
        <meshStandardMaterial {...baseMaterial} />
      </mesh>
      {Array.from({ length: 12 }).map((_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return (
          <mesh key={`cortex-spoke-${index}`} position={[Math.cos(angle) * 0.38, 0, Math.sin(angle) * 0.38]} rotation={[0, -angle, 0]} scale={[0.46, 0.055, 0.035]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={tone} transparent opacity={0.56} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.16, 18, 12]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.46} roughness={0.42} />
      </mesh>
    </group>
  );
}

function AuthoredIslandModel({ asset, selected }: { asset: MeshyIslandAsset; selected: boolean }) {
  const gltf = useLoader(GLTFLoader, asset.model);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene]);

  return (
    <group
      position={asset.scenePosition}
      rotation={asset.sceneRotation}
      scale={selected ? asset.sceneScale * 1.08 : asset.sceneScale}
    >
      <primitive object={model} />
    </group>
  );
}

function normalizeGltfScene(source: THREE.Group, targetSize: number) {
  const clone = source.clone(true);
  clone.traverse((child: THREE.Object3D) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  clone.position.set(-center.x, -center.y, -center.z);

  const largestAxis = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetSize / largestAxis;

  return {
    model: clone,
    scale,
    yLift: size.y * scale * 0.5 + 0.28,
  };
}

function ComparisonModel({
  modelPath,
  targetSize,
  rotation,
}: {
  modelPath: string;
  targetSize: number;
  rotation: [number, number, number];
}) {
  const gltf = useLoader(GLTFLoader, modelPath);
  const normalized = useMemo(() => normalizeGltfScene(gltf.scene, targetSize), [gltf.scene, targetSize]);

  return (
    <group position={[0, normalized.yLift, 0]} rotation={rotation} scale={normalized.scale}>
      <primitive object={normalized.model} />
    </group>
  );
}

function SourcePlate({ asset }: { asset: ImageTo3dComparisonAsset }) {
  const texture = useLoader(THREE.TextureLoader, asset.master.sourceTexture);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <sprite position={[0, 1.24, 0]} scale={[1.7, 1.7, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function ComparisonCellFrame({ tone = visualTokens.colors.mist }: { tone?: string }) {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} scale={[1.72, 0.08, 1.46]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={visualTokens.colors.ink} transparent opacity={0.58} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.19, 0]}>
        <planeGeometry args={[1.78, 1.5, 1, 1]} />
        <meshBasicMaterial color={tone} transparent opacity={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
        <torusGeometry args={[0.93, 0.005, 6, 96]} />
        <meshBasicMaterial color={tone} transparent opacity={0.42} />
      </mesh>
    </group>
  );
}

function EmptyComparisonCell({ label }: { label: string }) {
  return (
    <group>
      <ComparisonCellFrame tone={visualTokens.colors.depth} />
      <mesh position={[0, 0.58, 0]} rotation={[0.4, 0.4, 0]}>
        <octahedronGeometry args={[0.36, 1]} />
        <meshStandardMaterial color={visualTokens.colors.depth} transparent opacity={0.42} roughness={0.84} />
      </mesh>
      <WorldLabel title={label} detail="NO CURRENT RUNTIME" position={[0, 1.34, 0]} tone={visualTokens.colors.depth} />
    </group>
  );
}

function ReviewScoreBar({ index, score, tone }: { index: number; score: number; tone: string }) {
  const width = 0.96;
  const fill = Math.max(0.08, (score / 5) * width);

  return (
    <group position={[0, 0.88 - index * 0.14, 0.42]}>
      <mesh scale={[width, 0.018, 0.018]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={visualTokens.colors.mist} transparent opacity={0.18} />
      </mesh>
      <mesh position={[-(width - fill) / 2, 0.015, 0]} scale={[fill, 0.038, 0.038]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={tone} transparent opacity={0.76} />
      </mesh>
    </group>
  );
}

function ReviewInstrument({ asset }: { asset: ImageTo3dComparisonAsset }) {
  const tone = asset.review.readiness === 'review-ready' ? visualTokens.colors.signal : visualTokens.colors.depth;
  const blockerLabel = asset.review.blockers.length > 0 ? 'SCALE HOLD' : 'REFERENCE REVIEW';
  const readinessLabel = asset.review.readiness.replace('-', ' ');

  return (
    <group>
      <ComparisonCellFrame tone={tone} />
      <WorldLabel title="REVIEW" detail={`${asset.review.score}/${asset.review.threshold} // HOLD`} position={[0, 2.28, 0]} tone={tone} />
      <WorldLabel title={readinessLabel} detail={blockerLabel} position={[0.12, 1.66, 0.72]} tone={tone} />
      {asset.review.criteria.map((criterion, index) => (
        <ReviewScoreBar key={criterion.id} index={index} score={criterion.score} tone={tone} />
      ))}
      <mesh position={[0, 0.34, -0.28]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color={tone} emissive={tone} emissiveIntensity={0.18} roughness={0.62} />
      </mesh>
    </group>
  );
}

function ComparisonRow({ asset, z }: { asset: ImageTo3dComparisonAsset; z: number }) {
  const sourceX = -4.08;
  const currentX = -0.2;
  const masterX = 3.68;
  const reviewX = 6.12;
  const masterMb = Math.round(asset.master.modelBytes / (1024 * 1024));
  const optimizedMb = (asset.optimized.modelBytes / (1024 * 1024)).toFixed(1);

  return (
    <group position={[0, 0, z]}>
      <WorldLabel
        title={asset.label}
        detail={`${asset.role} // ${asset.promotionStatus.replace('-', ' ')}`}
        position={[-6.02, 1.8, 0]}
        tone={visualTokens.colors.signal}
      />
      <LinePrimitive
        points={[
          new THREE.Vector3(sourceX + 0.95, 0.42, 0),
          new THREE.Vector3(currentX - 0.95, 0.5, 0),
          new THREE.Vector3(currentX + 0.95, 0.5, 0),
          new THREE.Vector3(masterX - 0.95, 0.42, 0),
          new THREE.Vector3(masterX + 0.95, 0.5, 0),
          new THREE.Vector3(reviewX - 0.95, 0.42, 0),
        ]}
        color={visualTokens.colors.signal}
        opacity={0.34}
      />

      <group position={[sourceX, 0, 0]}>
        <ComparisonCellFrame tone={visualTokens.colors.signal} />
        <Suspense fallback={null}>
          <SourcePlate asset={asset} />
        </Suspense>
        <WorldLabel title="SOURCE" detail="GPT IMAGE PLATE" position={[0, 2.28, 0]} tone={visualTokens.colors.signal} />
      </group>

      <group position={[currentX, 0, 0]}>
        {asset.current ? (
          <>
            <ComparisonCellFrame tone={visualTokens.colors.mist} />
            <Suspense fallback={null}>
              <ComparisonModel
                modelPath={asset.current.model}
                targetSize={asset.scene.currentTargetSize}
                rotation={asset.scene.rotation}
              />
            </Suspense>
            <WorldLabel title="CURRENT" detail={asset.current.source.replaceAll('-', ' ')} position={[0, 2.28, 0]} tone={visualTokens.colors.mist} />
          </>
        ) : (
          <EmptyComparisonCell label="CURRENT" />
        )}
      </group>

      <group position={[masterX, 0, 0]}>
        <ComparisonCellFrame tone={visualTokens.colors.depth} />
        <Suspense fallback={null}>
          <ComparisonModel
            modelPath={asset.optimized.model}
            targetSize={asset.scene.masterTargetSize}
            rotation={asset.scene.rotation}
          />
        </Suspense>
        <WorldLabel title="MASTER" detail={`${masterMb}MB // PRESERVED`} position={[0, 2.28, 0]} tone={visualTokens.colors.depth} />
        <WorldLabel title="OPTIMIZED" detail={`${optimizedMb}MB // NOT PROMOTED`} position={[0.22, 1.78, 0.68]} tone={visualTokens.colors.signal} />
      </group>

      <group position={[reviewX, 0, 0]}>
        <ReviewInstrument asset={asset} />
      </group>
    </group>
  );
}

function AssetComparisonField() {
  return (
    <group>
      <WorldLabel title="ASSET QA" detail="SOURCE // CURRENT // MASTER // REVIEW" position={[-5.74, 2.64, -2.82]} tone={visualTokens.colors.signal} />
      <WorldLabel title="NOT PROMOTED" detail="MANUAL VISUAL APPROVAL REQUIRED" position={[5.18, 2.64, -2.82]} tone={visualTokens.colors.depth} />
      {imageTo3dComparisonAssets.map((asset, index) => (
        <ComparisonRow key={asset.id} asset={asset} z={-1.82 + index * 2.5} />
      ))}
    </group>
  );
}

function OrganIsland({
  node,
  focused = false,
  variant = 'standard',
  glyphScale = 1,
}: {
  node: SceneNode;
  focused?: boolean;
  variant?: SceneVariant;
  glyphScale?: number;
}) {
  const scale = node.worldScale * (focused ? 1.26 : 1) * (variant === 'reference-overview' ? glyphScale : 1);
  const selected = node.selected || focused;
  const authoredAsset = meshyAssetFor(node.id);
  const terrainGeometry = useMemo(() => createProceduralIslandGeometry(node), [node]);
  const terrainMaterial = useMemo(() => createIslandShaderMaterial(node.biome, selected), [node.biome, selected]);

  return (
    <group position={[node.x, 0, node.z]} scale={[scale, scale, scale]}>
      <mesh geometry={terrainGeometry} position={[0, 0.04, 0]} rotation={[0, selected ? 0.08 : 0, 0]}>
        <primitive object={terrainMaterial} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]}>
        <torusGeometry args={[1.12, selected ? 0.018 : 0.012, 8, selected ? 120 : 72]} />
        <meshBasicMaterial color={selected ? visualTokens.colors.signal : visualTokens.colors.mist} transparent opacity={selected ? 0.82 : 0.34} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, 0]}>
        <torusGeometry args={[1.42, 0.006, 6, 96]} />
        <meshBasicMaterial color={visualTokens.colors.mist} transparent opacity={0.18} />
      </mesh>
      {variant === 'reference-overview' ? (
        <ReferenceOverviewGlyph node={node} selected={selected} />
      ) : authoredAsset ? (
        <Suspense fallback={<IslandCore node={node} />}>
          <AuthoredIslandModel asset={authoredAsset} selected={selected} />
        </Suspense>
      ) : (
        <IslandCore node={node} />
      )}
      <WorldLabel
        title={node.title}
        detail={`${node.biome} // ${node.state}`}
        position={[0.08, variant === 'reference-overview' ? 2.28 : selected ? 2.15 : 1.72, 0.2]}
        tone={selected ? visualTokens.colors.signal : visualTokens.colors.mist}
      />
      {selected ? (
        <group>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.38} />
          </mesh>
          <LinePrimitive
            points={[new THREE.Vector3(0, 1.46, 0), new THREE.Vector3(0, 2.4, 0)]}
            color={visualTokens.colors.signal}
            opacity={0.72}
          />
        </group>
      ) : null}
      {Array.from({ length: selected ? 7 : 4 }).map((_, index) => {
        const angle = (index / (selected ? 7 : 4)) * Math.PI * 2 + 0.18;
        const inner = 0.28;
        const outer = selected ? 1.5 : 1.16;
        return (
          <LinePrimitive
            key={`${node.id}-terrain-seam-${index}`}
            points={[
              new THREE.Vector3(Math.cos(angle) * inner, 0.25, Math.sin(angle) * inner),
              new THREE.Vector3(Math.cos(angle) * outer, 0.2, Math.sin(angle) * outer),
            ]}
            color={selected ? visualTokens.colors.signal : visualTokens.colors.mist}
            opacity={selected ? 0.32 : 0.13}
          />
        );
      })}
    </group>
  );
}

function LocalIslandSystems({ scene }: { scene: CambiumSceneModel }) {
  const focus = scene.nodes.find((node) => node.id === scene.activeScreen.focusNode);
  if (!focus) return null;

  return (
    <group position={[focus.x, 0, focus.z]}>
      {scene.activeScreen.panels.map((panel, index) => {
        const angle = (index / scene.activeScreen.panels.length) * Math.PI * 2 + 0.3;
        const radius = 1.82 + (index % 2) * 0.38;
        const color = panel.tone === 'signal' ? visualTokens.colors.signal : panel.tone === 'depth' ? visualTokens.colors.depth : visualTokens.colors.mist;
        return (
          <group key={panel.title} position={[Math.cos(angle) * radius, 0.32, Math.sin(angle) * radius]}>
            <mesh scale={[0.64 + panel.value.length * 0.015, 0.11, 0.34]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={color} transparent opacity={panel.tone === 'depth' ? 0.48 : 0.68} roughness={0.8} />
            </mesh>
            <LinePrimitive
              points={[new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(-Math.cos(angle) * radius, 0.12, -Math.sin(angle) * radius)]}
              color={color}
              opacity={0.38}
            />
          </group>
        );
      })}
      {Array.from({ length: 18 }).map((_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        return (
          <mesh key={`local-packet-${index}`} position={[Math.cos(angle) * 2.48, 0.48 + Math.sin(index) * 0.08, Math.sin(angle) * 2.48]}>
            <sphereGeometry args={[index % 5 === 0 ? 0.05 : 0.028, 10, 10]} />
            <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.18} />
          </mesh>
        );
      })}
    </group>
  );
}

function ControlBay({ scene }: { scene: CambiumSceneModel }) {
  return (
    <group>
      {scene.engineControls.map((control, index) => {
        const column = index - 2;
        const color = control.kind === 'material' || control.kind === 'emitter' ? visualTokens.colors.signal : visualTokens.colors.mist;
        return (
          <group key={control.id} position={[column * 1.38, 0.34, -2.35 + (index % 2) * 0.75]}>
            <mesh scale={[1.04, 0.16, 0.42]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={color} transparent opacity={0.58} roughness={0.76} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <sphereGeometry args={[0.08 + index * 0.006, 12, 12]} />
              <meshStandardMaterial color={visualTokens.colors.signal} emissive={visualTokens.colors.signal} emissiveIntensity={0.22} />
            </mesh>
          </group>
        );
      })}
      {Object.values(visualTokens.colors).map((color, index) => (
        <mesh key={color} position={[-2.7 + index * 1.35, 0.42, 2.15]}>
          <cylinderGeometry args={[0.26, 0.32, 0.14, 6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={color === visualTokens.colors.signal ? 0.18 : 0.03} />
        </mesh>
      ))}
    </group>
  );
}

function VisualizationField({ scene }: { scene: CambiumSceneModel }) {
  const overlays = useMemo(() => createVisualizationOverlaySpecs(scene.visualizationLayers), [scene.visualizationLayers]);

  return (
    <group>
      {overlays.map((overlay, index) => {
        const layer = scene.visualizationLayers.find((candidate) => candidate.id === overlay.layerId) ?? scene.visualizationLayers[index];
        const color = layer.tone === 'signal' ? visualTokens.colors.signal : layer.tone === 'depth' ? visualTokens.colors.depth : visualTokens.colors.mist;
        return (
          <VisualizationLens key={overlay.id} overlay={overlay} color={color} />
        );
      })}
      {Array.from({ length: 26 }).map((_, index) => (
        <mesh key={`heat-cell-${index}`} position={[-5.6 + index * 0.45, 0.18 + (index % 5) * 0.05, -0.18 + Math.sin(index * 0.9) * 0.42]}>
          <boxGeometry args={[0.24, 0.12 + (index % 4) * 0.05, 0.18]} />
          <meshStandardMaterial color={index % 3 === 0 ? visualTokens.colors.signal : visualTokens.colors.mist} transparent opacity={0.64} />
        </mesh>
      ))}
    </group>
  );
}

function VisualizationLens({ overlay, color }: { overlay: VisualizationOverlaySpec; color: string }) {
  const isGraph = overlay.role === 'dependency-graph';
  const isHeat = overlay.role === 'process-heat';

  return (
    <group position={overlay.anchor}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[overlay.scale * 1.12, overlay.scale * 0.78, 1]}>
        <torusGeometry args={[0.74, 0.018, 8, 72]} />
        <meshBasicMaterial color={color} transparent opacity={0.44} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[overlay.scale * 1.3, overlay.scale * 0.88, 1]}>
        <circleGeometry args={[0.66, 48]} />
        <meshBasicMaterial color={color} transparent opacity={isHeat ? 0.16 : 0.08} />
      </mesh>
      <mesh scale={[0.58, 0.18, 0.58]} rotation={[0, overlay.scale * 0.4, 0]}>
        <octahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHeat ? 0.2 : 0.08} roughness={0.62} />
      </mesh>
      {Array.from({ length: isGraph ? 5 : 3 }).map((_, index) => {
        const angle = (index / (isGraph ? 5 : 3)) * Math.PI * 2;
        return (
          <group key={`${overlay.id}-pin-${index}`} position={[Math.cos(angle) * overlay.scale * 0.6, 0.06, Math.sin(angle) * overlay.scale * 0.4]}>
            <mesh scale={[0.045, 0.045, 0.045]}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshBasicMaterial color={color} transparent opacity={0.74} />
            </mesh>
            <LinePrimitive
              points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(-Math.cos(angle) * overlay.scale * 0.3, 0.02, -Math.sin(angle) * overlay.scale * 0.2)]}
              color={color}
              opacity={0.22}
            />
          </group>
        );
      })}
    </group>
  );
}

function ComponentSpecimens({ scene }: { scene: CambiumSceneModel }) {
  return (
    <group>
      {scene.nodes.map((node, index) => (
        <group key={`${node.id}-specimen`} position={[-4.9 + index * 2.45, 0, -1.6]}>
          <OrganIsland node={{ ...node, x: 0, z: 0, selected: index === 1 }} focused={index === 1} />
        </group>
      ))}
      {Array.from({ length: 15 }).map((_, index) => {
        const x = -5.2 + (index % 5) * 2.55;
        const z = 0.78 + Math.floor(index / 5) * 0.72;
        const tone = index % 3;
        const color = tone === 0 ? visualTokens.colors.signal : tone === 1 ? visualTokens.colors.mist : visualTokens.colors.depth;
        return (
          <mesh key={`design-token-${index}`} position={[x, 0.26, z]} scale={[1.1, 0.1, 0.26]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} transparent opacity={tone === 2 ? 0.48 : 0.68} roughness={0.76} />
          </mesh>
        );
      })}
    </group>
  );
}

function OverviewWorldStatus({ scene }: { scene: CambiumSceneModel }) {
  return (
    <group>
      <WorldLabel
        title="CAMBIUM"
        detail={`${scene.activeScreen.eyebrow} // ARC ${scene.telemetry.activeArc} // ${scene.telemetry.completedQuests}/${scene.telemetry.totalQuests}`}
        position={[-5.72, 2.72, -3.06]}
        tone={visualTokens.colors.signal}
      />
      <WorldLabel
        title="2.5D OVERVIEW"
        detail="ORGAN MAP // RAIL FLOW // LIVE"
        position={[2.82, 2.58, 1.86]}
        tone={visualTokens.colors.signal}
      />
      <WorldLabel
        title="FLAT NODE VIEW"
        detail="CORTEX // GENESIS // TASTE // BUILD // OPS"
        position={[5.28, 2.14, -1.98]}
        tone={visualTokens.colors.mist}
      />
      {Array.from({ length: 42 }).map((_, index) => {
        const column = index % 14;
        const row = Math.floor(index / 14);
        const x = -5.9 + column * 0.34;
        const z = 2.4 + row * 0.28 + Math.sin(index * 1.7) * 0.08;
        const y = 0.58 + Math.cos(index * 0.9) * 0.18;
        const tone = index % 5 === 0 ? visualTokens.colors.signal : visualTokens.colors.mist;

        return (
          <mesh key={`overview-data-speck-${index}`} position={[x, y, z]}>
            <sphereGeometry args={[index % 5 === 0 ? 0.032 : 0.018, 8, 8]} />
            <meshBasicMaterial color={tone} transparent opacity={index % 5 === 0 ? 0.72 : 0.28} />
          </mesh>
        );
      })}
    </group>
  );
}

export function CambiumScene({ scene, cameraMode }: SceneProps) {
  const mode = scene.activeScreen.mode;
  const activeNode = scene.nodes.find((node) => node.id === scene.activeScreen.focusNode);
  const isReferenceOverview = scene.activeScreen.id === scene.overviewArtDirection.routeId;

  return (
    <>
      <TacticalCameraRig scene={scene} mode={cameraMode} />
      <fog attach="fog" args={[fogPreset.color, fogPreset.near, fogPreset.far]} />
      <ambientLight intensity={isReferenceOverview ? 0.38 : 0.48} />
      <directionalLight position={[3.2, 7.4, 4.8]} intensity={isReferenceOverview ? 1.76 : 1.28} />
      <pointLight position={[activeNode?.x ?? -1.5, 2.8, activeNode?.z ?? 0.4]} intensity={isReferenceOverview ? 1.7 : 1.1} color={visualTokens.colors.signal} />
      {isReferenceOverview ? (
        <>
          <pointLight position={[-4.8, 2.7, -1.2]} intensity={1.08} color={visualTokens.colors.signal} />
          <pointLight position={[0.2, 2.6, -3.1]} intensity={0.88} color={visualTokens.colors.mist} />
        </>
      ) : null}
      <AtmosphereStack />
      <CambiumField mode={cameraMode} />
      {mode === 'asset-comparison' ? (
        <AssetComparisonField />
      ) : (
        <>
          {isReferenceOverview ? <OverviewWorldStatus scene={scene} /> : null}
          <RailNetwork
            rails={scene.rails}
            nodes={scene.nodes}
            variant={isReferenceOverview ? 'reference-overview' : 'standard'}
            particleMultiplier={scene.overviewArtDirection.railParticleMultiplier}
          />
          <IslandConnectionPorts rails={scene.rails} nodes={scene.nodes} />
          <ProcessBeacon node={activeProcessNode(scene.nodes)} showLabel={!isReferenceOverview} />
          {scene.nodes.map((node) => (
            <OrganIsland
              key={node.id}
              node={node}
              focused={mode === 'island' && node.id === scene.activeScreen.focusNode}
              variant={isReferenceOverview ? 'reference-overview' : 'standard'}
              glyphScale={scene.overviewArtDirection.islandGlyphScale}
            />
          ))}
          {mode === 'island' ? <LocalIslandSystems scene={scene} /> : null}
          {mode === 'settings' ? <ControlBay scene={scene} /> : null}
          {mode === 'visualizations' ? <VisualizationField scene={scene} /> : null}
          {mode === 'components' ? <ComponentSpecimens scene={scene} /> : null}
        </>
      )}
    </>
  );
}
