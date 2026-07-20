import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { visualTokens } from '../scene/visual-tokens';

export interface ConstellationNode {
  id: string;
  parentId: string | null;
  label: string;
  scale: string;
  status: string;
  position: [number, number, number];
  depth: number;
  accent: string;
}

export interface ConstellationClusterLayout {
  hubId: string;
  accent: string;
  nodes: ConstellationNode[];
  edges: Array<[string, string]>;
}

interface ConstellationClusterProps {
  layout: ConstellationClusterLayout;
  focused?: boolean;
  onHubSelect?: (hubId: string) => void;
}

const brandHexByToken = visualTokens.colors as Record<string, string>;

function accentColor(token: string): string {
  return brandHexByToken[token] ?? visualTokens.colors.mist;
}

function ClusterEdge({
  from,
  to,
  color,
  opacity,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  opacity: number;
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from[0], from[1], from[2]),
      new THREE.Vector3(to[0], to[1], to[2]),
    ]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geometry, material);
  }, [color, from, opacity, to]);

  return <primitive object={line} />;
}

export function ConstellationCluster({ layout, focused = true, onHubSelect }: ConstellationClusterProps) {
  const accent = accentColor(layout.accent);
  const dim = focused ? 1 : 0.35;

  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);
  const hub = nodesById.get(layout.hubId) ?? layout.nodes.find((node) => node.parentId === null) ?? layout.nodes[0];

  const nodeGeometry = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);
  const hubRingGeometry = useMemo(() => new THREE.TorusGeometry(0.5, 0.018, 8, 72), []);
  const hubHaloGeometry = useMemo(() => new THREE.TorusGeometry(0.62, 0.006, 6, 72), []);
  const hubCoreGeometry = useMemo(() => new THREE.SphereGeometry(0.09, 16, 16), []);

  const hubEmissiveIntensity = 0.42 * dim;
  const hubHaloOpacity = 0.34 * dim;
  const nodeEmissiveIntensity = 0.2 * dim;
  const edgeOpacity = visualTokens.alpha.hairline * 1.4 * dim;

  const handleHubClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onHubSelect?.(layout.hubId);
  };

  if (!hub) return null;

  return (
    <group>
      <group position={hub.position}>
        <mesh geometry={hubRingGeometry} rotation={[-Math.PI / 2, 0, 0]} onClick={handleHubClick}>
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={hubEmissiveIntensity} roughness={0.5} />
        </mesh>
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
      {layout.edges.map(([fromId, toId]) => {
        const from = nodesById.get(fromId);
        const to = nodesById.get(toId);
        if (!from || !to) return null;

        return (
          <ClusterEdge
            key={`${fromId}->${toId}`}
            from={from.position}
            to={to.position}
            color={accent}
            opacity={edgeOpacity}
          />
        );
      })}
    </group>
  );
}
