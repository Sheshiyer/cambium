import { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TacticalCameraRig } from '../engine/camera-rig';
import { fogPreset, materialPresets } from '../materials/cambium-materials';
import { createAtmosphereMaterial, createIslandShaderMaterial } from '../materials/shader-studies';
import { imageTo3dComparisonAssets, type ImageTo3dComparisonAsset } from '../world/image-to-3d-assets';
import { meshyAssetFor, type MeshyIslandAsset } from '../world/meshy-assets';
import { createProceduralIslandGeometry } from '../world/procedural-islands';
import type { CameraMode, CambiumSceneModel, SceneNode, SceneRail } from './types';
import { visualTokens } from './visual-tokens';

interface SceneProps {
  scene: CambiumSceneModel;
  cameraMode: CameraMode;
}

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

function TacticalSubstrate({ mode }: { mode: CameraMode }) {
  const flat = mode === 'flat';

  return (
    <group position={[0, -0.08, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[15.4, 10.2, 40, 28]} />
        <meshStandardMaterial
          color={materialPresets.substrate.color}
          transparent
          opacity={flat ? 0.94 : materialPresets.substrate.opacity}
          roughness={materialPresets.substrate.roughness}
          metalness={materialPresets.substrate.metalness}
        />
      </mesh>
      <gridHelper args={[15.4, 34, visualTokens.colors.signal, visualTokens.colors.mist]} position={[0, 0.012, 0]} />
      {Array.from({ length: 9 }).map((_, index) => (
        <mesh key={`contour-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025 + index * 0.002, -0.35]}>
          <torusGeometry args={[1.2 + index * 0.58, 0.006, 6, 128]} />
          <meshBasicMaterial color={materialPresets.contour.color} transparent opacity={0.11 + index * 0.012} />
        </mesh>
      ))}
    </group>
  );
}

function railMaterial(rail: SceneRail) {
  if (rail.tone === 'primary') return materialPresets.railPrimary;
  if (rail.tone === 'memory') return materialPresets.railMemory;
  return materialPresets.railSecondary;
}

function RailNetwork({ rails, nodes }: { rails: SceneRail[]; nodes: SceneNode[] }) {
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

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

        return (
          <group key={rail.id}>
            <LinePrimitive points={points} color={material.color} opacity={material.opacity} />
            {Array.from({ length: rail.packetCount + 1 }).map((_, index) => {
              const t = (index + 1) / (rail.packetCount + 2);
              const x = THREE.MathUtils.lerp(from.x, to.x, t);
              const z = THREE.MathUtils.lerp(from.z, to.z, t);
              const y = 0.34 + Math.sin(t * Math.PI) * 0.16 + index * 0.012;
              return (
                <mesh key={`${rail.id}-packet-${index}`} position={[x, y, z]}>
                  <sphereGeometry args={[rail.lane === 'background-emitter' ? 0.035 : 0.048, 14, 14]} />
                  <meshStandardMaterial
                    color={rail.lane === 'background-emitter' ? visualTokens.colors.mist : visualTokens.colors.signal}
                    emissive={rail.lane === 'background-emitter' ? visualTokens.colors.mist : visualTokens.colors.signal}
                    emissiveIntensity={0.24}
                  />
                </mesh>
              );
            })}
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

function OrganIsland({ node, focused = false }: { node: SceneNode; focused?: boolean }) {
  const scale = node.worldScale * (focused ? 1.26 : 1);
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
      {authoredAsset ? (
        <Suspense fallback={<IslandCore node={node} />}>
          <AuthoredIslandModel asset={authoredAsset} selected={selected} />
        </Suspense>
      ) : (
        <IslandCore node={node} />
      )}
      <WorldLabel
        title={node.title}
        detail={`${node.biome} // ${node.state}`}
        position={[0.08, selected ? 2.15 : 1.72, 0.2]}
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
  return (
    <group>
      {scene.visualizationLayers.map((layer, index) => {
        const x = -4.1 + index * 1.62;
        const z = 2.22 + Math.sin(index * 1.4) * 0.36;
        const color = layer.tone === 'signal' ? visualTokens.colors.signal : layer.tone === 'depth' ? visualTokens.colors.depth : visualTokens.colors.mist;
        return (
          <group key={layer.id} position={[x, 0.4, z]}>
            <mesh scale={[0.58, 0.18 + index * 0.025, 0.58]} rotation={[0, index * 0.22, 0]}>
              <octahedronGeometry args={[0.62, 1]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={layer.tone === 'signal' ? 0.16 : 0.05} roughness={0.62} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
              <torusGeometry args={[0.78 + index * 0.08, 0.008, 6, 72]} />
              <meshBasicMaterial color={color} transparent opacity={0.34} />
            </mesh>
          </group>
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

export function CambiumScene({ scene, cameraMode }: SceneProps) {
  const mode = scene.activeScreen.mode;
  const activeNode = scene.nodes.find((node) => node.id === scene.activeScreen.focusNode);

  return (
    <>
      <TacticalCameraRig scene={scene} mode={cameraMode} />
      <fog attach="fog" args={[fogPreset.color, fogPreset.near, fogPreset.far]} />
      <ambientLight intensity={0.48} />
      <directionalLight position={[3.2, 7.4, 4.8]} intensity={1.28} />
      <pointLight position={[activeNode?.x ?? -1.5, 2.8, activeNode?.z ?? 0.4]} intensity={1.1} color={visualTokens.colors.signal} />
      <AtmosphereStack />
      <TacticalSubstrate mode={cameraMode} />
      {mode === 'asset-comparison' ? (
        <AssetComparisonField />
      ) : (
        <>
          <RailNetwork rails={scene.rails} nodes={scene.nodes} />
          {scene.nodes.map((node) => (
            <OrganIsland key={node.id} node={node} focused={mode === 'island' && node.id === scene.activeScreen.focusNode} />
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
