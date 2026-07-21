import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { visualTokens } from '../scene/visual-tokens';
import type { ConstellationClusterLayout } from './constellation-layout';

export type { ConstellationClusterLayout, ConstellationNode } from './constellation-layout';

interface ConstellationClusterProps {
  layout: ConstellationClusterLayout;
  focused?: boolean;
  onHubSelect?: (hubId: string) => void;
}

const brandHexByToken = visualTokens.colors as Record<string, string>;

function accentColor(token: string): string {
  return brandHexByToken[token] ?? visualTokens.colors.mist;
}

type HubGlyphKind = 'star' | 'capsule' | 'triangle' | 'slab' | 'wheel';

function glyphKindForHub(hubId: string): HubGlyphKind {
  if (hubId.includes('genesis')) return 'star';
  if (hubId.includes('taste')) return 'capsule';
  if (hubId.includes('build')) return 'triangle';
  if (hubId.includes('ops') || hubId.includes('will')) return 'slab';
  return 'wheel';
}

function makeStarGeometry(points: number, outer: number, inner: number, depth: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeTriangleGeometry(radius: number, depth: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

const CHAIN_BEAD_SPACING = 0.16;
const CHAIN_BEAD_OFFSET = 0.032;

function HubGlyph({ kind, accent, emissiveIntensity, onHubClick }: {
  kind: HubGlyphKind;
  accent: string;
  emissiveIntensity: number;
  onHubClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const starGeometry = useMemo(
    () => (kind === 'star' ? makeStarGeometry(6, 0.52, 0.24, 0.1) : null),
    [kind],
  );
  const triangleGeometry = useMemo(
    () => (kind === 'triangle' ? makeTriangleGeometry(0.52, 0.12) : null),
    [kind],
  );
  const material = (
    <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={emissiveIntensity} roughness={0.5} />
  );

  if (kind === 'star' && starGeometry) {
    return <mesh geometry={starGeometry} rotation={[-Math.PI / 2, 0, 0]} onClick={onHubClick}>{material}</mesh>;
  }

  if (kind === 'capsule') {
    return (
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh onClick={onHubClick}>
          <capsuleGeometry args={[0.2, 0.52, 6, 16]} />
          {material}
        </mesh>
      </group>
    );
  }

  if (kind === 'triangle' && triangleGeometry) {
    return <mesh geometry={triangleGeometry} rotation={[-Math.PI / 2, 0, 0]} onClick={onHubClick}>{material}</mesh>;
  }

  if (kind === 'slab') {
    return (
      <mesh scale={[1, 0.42, 1]} onClick={onHubClick}>
        <dodecahedronGeometry args={[0.5, 0]} />
        {material}
      </mesh>
    );
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onHubClick}>
        <torusGeometry args={[0.48, 0.05, 10, 72]} />
        {material}
      </mesh>
      {Array.from({ length: 6 }).map((_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh
            key={`wheel-spoke-${index}`}
            position={[Math.cos(angle) * 0.24, 0, Math.sin(angle) * 0.24]}
            rotation={[0, -angle + Math.PI / 2, Math.PI / 2]}
            onClick={onHubClick}
          >
            <cylinderGeometry args={[0.022, 0.022, 0.48, 6]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={emissiveIntensity * 0.8} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

export function ConstellationCluster({ layout, focused = true, onHubSelect }: ConstellationClusterProps) {
  const accent = accentColor(layout.accent);
  const dim = focused ? 1 : 0.35;

  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);
  const hub = nodesById.get(layout.hubId) ?? layout.nodes.find((node) => node.parentId === null) ?? layout.nodes[0];

  const nodeGeometry = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);
  const hubHaloGeometry = useMemo(() => new THREE.TorusGeometry(0.68, 0.006, 6, 72), []);
  const hubCoreGeometry = useMemo(() => new THREE.SphereGeometry(0.09, 16, 16), []);
  const glyphKind = glyphKindForHub(layout.hubId);

  const hubEmissiveIntensity = 0.42 * dim;
  const hubHaloOpacity = 0.34 * dim;
  const nodeEmissiveIntensity = 0.2 * dim;
  const chainOpacity = Math.min(1, visualTokens.alpha.hairline * 3.4) * dim;

  const chainBeadMesh = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const perp = new THREE.Vector3();
    const point = new THREE.Vector3();

    for (const [fromId, toId] of layout.edges) {
      const fromNode = nodesById.get(fromId);
      const toNode = nodesById.get(toId);
      if (!fromNode || !toNode) continue;
      from.set(fromNode.position[0], fromNode.position[1], fromNode.position[2]);
      to.set(toNode.position[0], toNode.position[1], toNode.position[2]);
      dir.subVectors(to, from);
      const length = dir.length();
      if (length < 0.001) continue;
      dir.divideScalar(length);
      perp.set(-dir.z, 0, dir.x);
      const count = Math.max(2, Math.floor(length / CHAIN_BEAD_SPACING));
      for (let i = 1; i < count; i += 1) {
        const t = i / count;
        point.copy(from).lerp(to, t).addScaledVector(perp, (i % 2 === 0 ? 1 : -1) * CHAIN_BEAD_OFFSET);
        matrices.push(new THREE.Matrix4().makeTranslation(point.x, point.y, point.z));
      }
    }

    const geometry = new THREE.SphereGeometry(0.032, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: chainOpacity });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(matrices.length, 1));
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [accent, chainOpacity, layout.edges, nodesById]);

  const handleHubClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onHubSelect?.(layout.hubId);
  };

  if (!hub) return null;

  return (
    <group>
      <group position={hub.position}>
        <HubGlyph kind={glyphKind} accent={accent} emissiveIntensity={hubEmissiveIntensity} onHubClick={handleHubClick} />
        <mesh geometry={hubHaloGeometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={accent} transparent opacity={hubHaloOpacity} />
        </mesh>
        <mesh geometry={hubCoreGeometry} onClick={handleHubClick}>
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={hubEmissiveIntensity * 1.3} roughness={0.42} />
        </mesh>
        <pointLight color={accent} intensity={focused ? 0.55 : 0.18} distance={2.6} decay={2} position={[0, 0.3, 0]} />
      </group>
      {layout.nodes.map((node) => {
        if (node.id === hub.id) return null;
        const radius = 0.09 / (node.depth + 1);
        const placeholder = node.status === 'placeholder';
        const opacity = (placeholder ? 0.4 : 1) * dim;

        return (
          <mesh
            key={node.id}
            geometry={nodeGeometry}
            position={node.position}
            scale={[radius, radius, radius]}
          >
            <meshStandardMaterial
              color={visualTokens.colors.mist}
              emissive={visualTokens.colors.mist}
              emissiveIntensity={nodeEmissiveIntensity}
              roughness={0.5}
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}
      <primitive object={chainBeadMesh} />
    </group>
  );
}
