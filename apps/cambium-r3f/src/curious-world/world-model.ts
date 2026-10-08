import { SYSTEM_ATLAS } from '../../../../shared/cambium-system-atlas.ts';
import type { AtlasConnection, AtlasLinkKind } from '../../../../shared/cambium-system-atlas.ts';
import { SYSTEM_ATLAS_PORTRAITS } from '../../../../shared/cambium-system-atlas-portraits.ts';

// Public source exploration only. Geometry and discovery never confer operational authority.
export interface Vec2 { x: number; z: number }
export interface District extends Vec2 {
  id: string; name: string; radius: number; color: string; tagline: string;
}
export interface WorldLink {
  to: string; label: string; kind: AtlasLinkKind; basis: AtlasConnection['basis'];
}
export interface WorldLandmark extends Vec2 {
  id: string; name: string; kind: 'organ' | 'system' | 'desk'; districtId: string;
  radius: number; color: string; verb: string; detail: string; boundary: string;
  source: string; links: WorldLink[]; portrait?: string;
}
export interface WorldPath { id: string; a: Vec2; b: Vec2; width: number }

export const HUB_RADIUS = 9;
export const DISTRICT_RADIUS = 8;
export const PATH_WIDTH = 4;
export const PLAYER_RADIUS = 0.45;
export const WALK_SPEED = 5.5;
export const RUN_SPEED = 8;
export const spawn: Readonly<Vec2> = Object.freeze({ x: 0, z: 3 });
export const SPAWN = spawn;

export const DISTRICTS: readonly District[] = [
  { id: 'purpose', name: 'Purpose', x: 0, z: -28, radius: 8, color: '#cdb580', tagline: 'Orientation and bounded choice' },
  { id: 'identity', name: 'Identity', x: 20, z: -20, radius: 8, color: '#91bcb4', tagline: 'Identity, role and owned intent' },
  { id: 'organs', name: 'Organs', x: 28, z: 0, radius: 8, color: '#ca947c', tagline: 'Form and quality judgment' },
  { id: 'plant', name: 'Plant', x: 20, z: 20, radius: 8, color: '#bda777', tagline: 'Admitted work and transport' },
  { id: 'evidence', name: 'Evidence', x: 0, z: 28, radius: 8, color: '#88aa94', tagline: 'Receipts, projections and learning' },
  { id: 'growth', name: 'Growth', x: -20, z: 20, radius: 8, color: '#b39cc3', tagline: 'Reviewable business proposals' },
  { id: 'knowledge', name: 'Knowledge', x: -28, z: 0, radius: 8, color: '#8da5bf', tagline: 'Scoped memory and source history' },
  { id: 'holds', name: 'Holds', x: -20, z: -20, radius: 8, color: '#a3a0a0', tagline: 'Health probes and eligibility' },
];

// Width is the complete capsule deck width, shared with the renderer.
export const PATHS: readonly WorldPath[] = [
  ...DISTRICTS.map((district) => ({
    id: `radial-${district.id}`, a: { x: 0, z: 0 }, b: { x: district.x, z: district.z }, width: PATH_WIDTH,
  })),
  ...DISTRICTS.map((district, index) => {
    const next = DISTRICTS[(index + 1) % DISTRICTS.length];
    return {
      id: `loop-${district.id}-${next.id}`, a: { x: district.x, z: district.z },
      b: { x: next.x, z: next.z }, width: PATH_WIDTH,
    };
  }),
];

const DISTRICT_MEMBERS: Record<string, readonly string[]> = {
  purpose: ['vestibule', 'curious', 'gate'],
  identity: ['adytum', 'access', 'plexus', 'd1'],
  organs: ['genesis', 'taste'],
  plant: ['hands', 'hermes', 'omniroute', 'broker'],
  evidence: ['nutrix', 'fabric', 'proof'],
  growth: ['will', ...SYSTEM_ATLAS.desks.map((desk) => desk.id)],
  knowledge: ['cortex', 'circulator', 'praeceptor', 'vault', 'github', 'speculum'],
  holds: ['auspex'],
};
const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (point: Vec2): boolean => Number.isFinite(point?.x) && Number.isFinite(point?.z);

function segmentDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
  return Math.hypot(point.x - a.x - dx * fraction, point.z - a.z - dz * fraction);
}

const publicLinks = [...SYSTEM_ATLAS.organLinks, ...SYSTEM_ATLAS.systemLinks];
const outgoing = (id: string): WorldLink[] => publicLinks.filter((link) => link.from === id)
  .map(({ to, label, kind, basis }) => ({ to, label, kind, basis }));
type LandmarkSource = Omit<WorldLandmark, 'districtId' | 'x' | 'z' | 'radius' | 'color'>;
const sources: LandmarkSource[] = [
  ...SYSTEM_ATLAS.organs.map((organ): LandmarkSource => ({
    id: organ.id, name: organ.name, kind: 'organ', verb: organ.verb, detail: organ.purpose,
    boundary: organ.boundary, source: organ.source, links: outgoing(organ.id),
    portrait: SYSTEM_ATLAS_PORTRAITS[organ.id],
  })),
  ...SYSTEM_ATLAS.systems.map((system): LandmarkSource => ({
    id: system.id, name: system.name, kind: 'system', verb: system.verb,
    detail: `${system.verb} · ${system.owner}`, boundary: system.owner,
    source: system.source, links: outgoing(system.id),
  })),
  ...SYSTEM_ATLAS.desks.map((desk): LandmarkSource => ({
    id: desk.id, name: desk.name, kind: 'desk', verb: desk.willDesk,
    detail: `${desk.input} → ${desk.output}`, boundary: `${desk.owner} · ${desk.executionState}`,
    source: desk.source, links: desk.organs.map((to) => ({
      to, label: 'source contract', kind: 'knowledge', basis: 'contract',
    })),
  })),
];

// A stable ring leaves the center and all incident route centerlines unobstructed.
function positionsFor(district: District, count: number): Vec2[] {
  const radius = 0.75;
  const candidates = Array.from({ length: 120 }, (_, index) => {
    const angle = index * Math.PI * 2 / 120;
    return { x: district.x + Math.cos(angle) * 5.6, z: district.z + Math.sin(angle) * 5.6 };
  }).filter((point) => PATHS.every((path) =>
    segmentDistance(point, path.a, path.b) > radius + PLAYER_RADIUS + 0.25));
  const result: Vec2[] = [];
  for (let index = 0; index < count; index++) {
    let best: Vec2 | undefined;
    let bestClearance = -Infinity;
    for (const candidate of candidates) {
      const clearance = result.length ? Math.min(...result.map((point) => distance(candidate, point))) : 100;
      if (clearance > bestClearance) { best = candidate; bestClearance = clearance; }
    }
    if (!best || bestClearance < (radius + PLAYER_RADIUS) * 2 + 0.1) {
      throw new Error(`Public atlas landmark layout cannot fit district ${district.id}`);
    }
    result.push(best);
  }
  return result;
}

const placements = new Map<string, { district: District; position: Vec2 }>();
for (const district of DISTRICTS) {
  const members = DISTRICT_MEMBERS[district.id];
  const positions = positionsFor(district, members.length);
  members.forEach((id, index) => placements.set(id, { district, position: positions[index] }));
}
export const WORLD_LANDMARKS: readonly WorldLandmark[] = sources.map((source) => {
  const placement = placements.get(source.id);
  if (!placement) throw new Error(`Unassigned public atlas identity ${source.id}`);
  return {
    ...source, districtId: placement.district.id, ...placement.position,
    radius: 0.75, color: placement.district.color,
  };
});

export function isWalkable(position: Vec2): boolean {
  if (!finite(position)) return false;
  if (WORLD_LANDMARKS.some((landmark) => distance(position, landmark) < landmark.radius + PLAYER_RADIUS)) return false;
  if (Math.hypot(position.x, position.z) <= HUB_RADIUS - PLAYER_RADIUS) return true;
  if (DISTRICTS.some((district) => distance(position, district) <= district.radius - PLAYER_RADIUS)) return true;
  return PATHS.some((path) => segmentDistance(position, path.a, path.b) <= path.width / 2 - PLAYER_RADIUS);
}

export function movePlayer(position: Vec2, axis: Vec2, dt: number, cameraYaw = 0, running = false): Vec2 {
  const current = finite(position) && isWalkable(position) ? { ...position } : { ...spawn };
  if (!finite(axis) || !Number.isFinite(dt) || !Number.isFinite(cameraYaw) || dt <= 0) return current;
  const length = Math.hypot(axis.x, axis.z);
  if (!Number.isFinite(length) || length === 0) return current;
  const divisor = Math.max(1, length);
  const localX = axis.x / divisor, localZ = axis.z / divisor;
  const duration = Math.min(0.05, dt);
  const travel = (running ? RUN_SPEED : WALK_SPEED) * duration;
  const dx = (localX * Math.cos(cameraYaw) + localZ * Math.sin(cameraYaw)) * travel;
  const dz = (-localX * Math.sin(cameraYaw) + localZ * Math.cos(cameraYaw)) * travel;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  const stepX = dx / steps, stepZ = dz / steps;
  for (let index = 0; index < steps; index++) {
    const next = { x: current.x + stepX, z: current.z + stepZ };
    if (isWalkable(next)) { current.x = next.x; current.z = next.z; continue; }
    const slideX = { x: current.x + stepX, z: current.z };
    if (isWalkable(slideX)) current.x = slideX.x;
    const slideZ = { x: current.x, z: current.z + stepZ };
    if (isWalkable(slideZ)) current.z = slideZ.z;
  }
  return current;
}

export function nearestLandmark(position: Vec2, maxDistance = 4): WorldLandmark | null {
  if (!finite(position) || !Number.isFinite(maxDistance) || maxDistance < 0) return null;
  let nearest: WorldLandmark | null = null;
  let closest = Infinity;
  for (const landmark of WORLD_LANDMARKS) {
    const surfaceDistance = Math.max(0, distance(position, landmark) - landmark.radius);
    if (surfaceDistance <= maxDistance + 1e-9 && surfaceDistance < closest) {
      closest = surfaceDistance; nearest = landmark;
    }
  }
  return nearest;
}

export function districtAt(position: Vec2): District | null {
  if (!finite(position)) return null;
  return DISTRICTS.find((district) => distance(position, district) <= district.radius) ?? null;
}

export function safeDistrictSpawn(id: string): Vec2 {
  const district = DISTRICTS.find((candidate) => candidate.id === id);
  // The layout reserves every district center and the path to the hub.
  return district ? { x: district.x, z: district.z } : { ...spawn };
}

export function collectDiscovery(stamps: ReadonlySet<string>, position: Vec2): Set<string> {
  const result = new Set(stamps);
  const district = districtAt(position);
  if (district) result.add(district.id);
  return result;
}

export function keyboardAxis(keys: ReadonlySet<string>): Vec2 {
  const pressed = (...codes: string[]) => codes.some((code) => keys.has(code));
  const x = Number(pressed('KeyD', 'ArrowRight', 'd', 'D')) - Number(pressed('KeyA', 'ArrowLeft', 'a', 'A'));
  const z = Number(pressed('KeyS', 'ArrowDown', 's', 'S')) - Number(pressed('KeyW', 'ArrowUp', 'w', 'W'));
  const length = Math.hypot(x, z);
  return length === 0 ? { x: 0, z: 0 } : { x: x / length, z: z / length };
}
