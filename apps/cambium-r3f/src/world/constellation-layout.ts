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

export interface ConstellationMapLayout {
  center: [number, number, number];
  clusters: ConstellationClusterLayout[];
}

export interface TapestrySnapshotNode {
  id: string;
  organ: string;
  title: string;
  scale: string;
  x: number;
  z: number;
  status: string;
  inputs?: string[];
  outputs?: string[];
}

export interface TapestrySnapshot {
  tenant: { id: string; label: string; vision?: string; mission?: string };
  recursion?: string[];
  field: { id: string; width: number; depth: number };
  nodes: TapestrySnapshotNode[];
}

export const CONSTELLATION_ACCENTS = [
  'signal',
  'mist',
  'depth',
  'ember',
  'verdant',
  'amber',
  'violet',
] as const;

const MAX_DENDRITE_DEPTH = 4;
const CHILD_RING_RADIUS = 1.1;
const DEPTH_STEP = 0.85;

function hashNodeId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function jitterFromId(id: string, range: number): number {
  const hash = hashNodeId(id);
  return ((hash % 1000) / 1000 - 0.5) * 2 * range;
}

function isCortexNode(node: TapestrySnapshotNode): boolean {
  return node.organ === 'cortex' || node.id.includes('cortex');
}

function accentForCluster(index: number, cortex: boolean): string {
  if (cortex) return 'depth';
  return CONSTELLATION_ACCENTS[index % CONSTELLATION_ACCENTS.length];
}

function synthesizePlaceholders(hub: TapestrySnapshotNode, vision: string | undefined): string[] {
  const keywords = [...(hub.inputs ?? []), ...(hub.outputs ?? [])];
  if (vision) {
    keywords.push(...vision.split(/\s+/).filter((word) => word.length > 5).slice(0, 3));
  }
  const unique = [...new Set(keywords.map((word) => word.toLowerCase()))].filter(Boolean);
  const count = Math.min(Math.max(unique.length, 3), 5);
  const labels: string[] = [];
  for (let i = 0; i < count; i += 1) {
    labels.push(unique[i] ?? `branch-${i + 1}`);
  }
  return labels;
}

export function buildConstellationLayout(snapshot: TapestrySnapshot): ConstellationMapLayout {
  const center: [number, number, number] = [0, 0, 0];
  const hubs = snapshot.nodes.filter((node) => node.scale === 'organ');
  if (hubs.length === 0) {
    return { center, clusters: [] };
  }

  const ringRadius = snapshot.field.width / 2.2;
  const cortexHub = hubs.find(isCortexNode);
  const ringHubs = cortexHub ? hubs.filter((hub) => hub !== cortexHub) : hubs;

  const hubPosition = new Map<string, [number, number, number]>();
  const hubAccent = new Map<string, string>();
  if (cortexHub) {
    hubPosition.set(cortexHub.id, [0, 0, 0]);
    hubAccent.set(cortexHub.id, 'depth');
  }
  ringHubs.forEach((hub, index) => {
    const angle = (index / ringHubs.length) * Math.PI * 2;
    hubPosition.set(hub.id, [
      Math.cos(angle) * ringRadius,
      0,
      Math.sin(angle) * ringRadius,
    ]);
    hubAccent.set(hub.id, accentForCluster(index, false));
  });

  const clusterOf = new Map<string, string>();
  for (const node of snapshot.nodes) {
    if (node.scale === 'organ') continue;
    const direct = hubs.find((hub) => hub.organ === node.organ);
    if (direct) {
      clusterOf.set(node.id, direct.id);
      continue;
    }
    let nearest = hubs[0];
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const hub of hubs) {
      const dx = hub.x - node.x;
      const dz = hub.z - node.z;
      const dist = dx * dx + dz * dz;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = hub;
      }
    }
    clusterOf.set(node.id, nearest.id);
  }

  const childrenByHub = new Map<string, TapestrySnapshotNode[]>();
  for (const node of snapshot.nodes) {
    if (node.scale === 'organ') continue;
    const hubId = clusterOf.get(node.id);
    if (!hubId) continue;
    const list = childrenByHub.get(hubId) ?? [];
    list.push(node);
    childrenByHub.set(hubId, list);
  }

  const clusters: ConstellationClusterLayout[] = hubs.map((hub) => {
    const accent = hubAccent.get(hub.id) ?? CONSTELLATION_ACCENTS[0];
    const hubPos = hubPosition.get(hub.id) ?? [0, 0, 0];
    const nodes: ConstellationNode[] = [
      {
        id: hub.id,
        parentId: null,
        label: hub.title,
        scale: hub.scale,
        status: hub.status,
        position: hubPos,
        depth: 0,
        accent,
      },
    ];
    const edges: Array<[string, string]> = [];

    let children = childrenByHub.get(hub.id) ?? [];
    if (children.length === 0) {
      const labels = synthesizePlaceholders(hub, snapshot.tenant.vision);
      children = labels.map((label, index) => ({
        id: `${hub.id}::placeholder-${index + 1}`,
        organ: hub.organ,
        title: label,
        scale: 'placeholder',
        x: hub.x,
        z: hub.z,
        status: 'placeholder',
        inputs: [],
        outputs: [],
      }));
    }

    const outwardAngle =
      hubPos[0] === 0 && hubPos[2] === 0
        ? 0
        : Math.atan2(hubPos[2], hubPos[0]);

    const queue: Array<{ parent: TapestrySnapshotNode; remaining: TapestrySnapshotNode[]; depth: number; angle: number }> = [
      { parent: hub, remaining: children, depth: 1, angle: outwardAngle },
    ];

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const { parent, remaining, depth, angle } = item;
      if (depth > MAX_DENDRITE_DEPTH) continue;
      remaining.forEach((child, index) => {
        const fan = remaining.length === 1 ? 0 : (index / (remaining.length - 1) - 0.5) * Math.PI * 0.9;
        const jitter = jitterFromId(child.id, 0.18);
        const childAngle = angle + fan + jitter;
        const radius = CHILD_RING_RADIUS + (depth - 1) * DEPTH_STEP;
        const position: [number, number, number] = [
          hubPos[0] + Math.cos(childAngle) * radius,
          0,
          hubPos[2] + Math.sin(childAngle) * radius,
        ];
        const childNode: ConstellationNode = {
          id: child.id,
          parentId: parent.id,
          label: child.title,
          scale: child.scale,
          status: child.status,
          position,
          depth,
          accent,
        };
        nodes.push(childNode);
        edges.push([parent.id, child.id]);

        if (depth < MAX_DENDRITE_DEPTH && child.scale !== 'placeholder') {
          const grandchildCount = 2 + (hashNodeId(child.id) % 2);
          const grandchildren: TapestrySnapshotNode[] = [];
          for (let i = 0; i < grandchildCount; i += 1) {
            grandchildren.push({
              id: `${child.id}::leaf-${i + 1}`,
              organ: child.organ,
              title: `${child.title} leaf ${i + 1}`,
              scale: 'leaf',
              x: child.x,
              z: child.z,
              status: 'leaf',
              inputs: [],
              outputs: [],
            });
          }
          queue.push({ parent: child, remaining: grandchildren, depth: depth + 1, angle: childAngle });
        }
      });
    }

    return { hubId: hub.id, accent, nodes, edges };
  });

  return { center, clusters };
}
