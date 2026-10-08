import test from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_ATLAS } from '../../../../shared/cambium-system-atlas.ts';
import { SYSTEM_ATLAS_PORTRAITS } from '../../../../shared/cambium-system-atlas-portraits.ts';
import {
  DISTRICTS, WORLD_LANDMARKS, PATHS, HUB_RADIUS, DISTRICT_RADIUS, PATH_WIDTH,
  PLAYER_RADIUS, WALK_SPEED, RUN_SPEED, spawn, isWalkable, movePlayer,
  nearestLandmark, districtAt, safeDistrictSpawn, collectDiscovery, keyboardAxis,
} from './world-model.ts';
import type { Vec2 } from './world-model.ts';

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('all thirty landmarks retain canonical public identity, source, relations and portraits', () => {
  const canonical = [
    ...SYSTEM_ATLAS.organs.map((entry) => ({ entry, kind: 'organ' })),
    ...SYSTEM_ATLAS.systems.map((entry) => ({ entry, kind: 'system' })),
    ...SYSTEM_ATLAS.desks.map((entry) => ({ entry, kind: 'desk' })),
  ];
  assert.equal(canonical.length, 30);
  assert.equal(WORLD_LANDMARKS.length, 30);
  const ids = new Set(WORLD_LANDMARKS.map((landmark) => landmark.id));
  assert.equal(ids.size, 30);
  assert.deepEqual([...ids].sort(), canonical.map(({ entry }) => entry.id).sort());
  const placement: Record<string, readonly string[]> = {
    purpose: ['vestibule', 'curious', 'gate'],
    identity: ['adytum', 'access', 'plexus', 'd1'],
    organs: ['genesis', 'taste'],
    plant: ['hands', 'hermes', 'omniroute', 'broker'],
    evidence: ['nutrix', 'fabric', 'proof'],
    growth: ['will', ...SYSTEM_ATLAS.desks.map((desk) => desk.id)],
    knowledge: ['cortex', 'circulator', 'praeceptor', 'vault', 'github', 'speculum'],
    holds: ['auspex'],
  };
  const positions = new Set<string>();
  for (const { entry, kind } of canonical) {
    const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === entry.id)!;
    assert.equal(landmark.name, entry.name);
    assert.equal(landmark.kind, kind);
    assert.equal(landmark.source, entry.source);
    assert.ok(placement[landmark.districtId]?.includes(entry.id));
    assert.ok(landmark.detail.length > 3 && landmark.boundary.length > 3);
    assert.ok(Number.isFinite(landmark.x) && Number.isFinite(landmark.z));
    const district = DISTRICTS.find((candidate) => candidate.id === landmark.districtId)!;
    assert.ok(distance(landmark, district) + landmark.radius < district.radius);
    const key = `${landmark.x},${landmark.z}`;
    assert.ok(!positions.has(key), `duplicate placement: ${landmark.id}`);
    positions.add(key);
    for (const link of landmark.links) assert.ok(ids.has(link.to), `missing target ${link.to}`);
    if (kind === 'organ' || kind === 'system') {
      const expected = [...SYSTEM_ATLAS.organLinks, ...SYSTEM_ATLAS.systemLinks]
        .filter((link) => link.from === entry.id)
        .map(({ to, label, kind: linkKind, basis }) => ({ to, label, kind: linkKind, basis }));
      assert.deepEqual(landmark.links, expected);
    } else {
      const desk = SYSTEM_ATLAS.desks.find((candidate) => candidate.id === entry.id)!;
      assert.deepEqual(landmark.links.map((link) => link.to), [...desk.organs]);
      assert.ok(landmark.links.every((link) => link.basis === 'contract'));
    }
    assert.equal(landmark.portrait, kind === 'organ' ? SYSTEM_ATLAS_PORTRAITS[entry.id] : undefined);
  }
});

test('eight exact districts connect to the hub and one closed outer loop', () => {
  const expected = [
    ['purpose', 0, -28], ['identity', 20, -20], ['organs', 28, 0], ['plant', 20, 20],
    ['evidence', 0, 28], ['growth', -20, 20], ['knowledge', -28, 0], ['holds', -20, -20],
  ];
  assert.deepEqual(DISTRICTS.map(({ id, x, z }) => [id, x, z]), expected);
  assert.equal(HUB_RADIUS, 9);
  assert.equal(DISTRICT_RADIUS, 8);
  assert.equal(PATH_WIDTH, 4);
  assert.equal(PATHS.length, 16);
  assert.equal(new Set(PATHS.map((path) => path.id)).size, 16);
  const at = (point: Vec2, target: Vec2) => point.x === target.x && point.z === target.z;
  const connects = (path: typeof PATHS[number], a: Vec2, b: Vec2) =>
    (at(path.a, a) && at(path.b, b)) || (at(path.a, b) && at(path.b, a));
  for (let index = 0; index < DISTRICTS.length; index++) {
    const district = DISTRICTS[index];
    assert.equal(district.radius, 8);
    assert.ok(PATHS.some((path) => connects(path, { x: 0, z: 0 }, district)));
    assert.ok(PATHS.some((path) => connects(path, district, DISTRICTS[(index + 1) % 8])));
  }
  assert.ok(PATHS.every((path) => path.width === 4));
});

test('independent sampled floor search reaches every collision-free district spawn', () => {
  const step = 0.5;
  const start = { x: spawn.x, z: spawn.z };
  assert.ok(isWalkable(start));
  const key = (point: Vec2) => `${point.x},${point.z}`;
  const visited = new Set([key(start)]);
  const queue: Vec2[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (Math.abs(next.x) > 36 || Math.abs(next.z) > 36 || visited.has(key(next))) continue;
      // Sampling intermediate points prevents jumping across a collider or edge.
      if (![0.25, 0.5, 0.75, 1].every((fraction) => isWalkable({
        x: current.x + dx * fraction, z: current.z + dz * fraction,
      }))) continue;
      visited.add(key(next));
      queue.push(next);
    }
  }
  assert.ok(visited.size > 500, 'search must traverse more than the central hub');
  for (const district of DISTRICTS) {
    const destination = safeDistrictSpawn(district.id);
    assert.ok(isWalkable(destination), `unsafe spawn ${district.id}`);
    assert.equal(districtAt(destination)?.id, district.id);
    assert.ok(queue.some((point) => distance(point, destination) < step), `unreachable ${district.id}`);
  }
});

test('floor has boundaries and clears solids with finite guards', () => {
  assert.deepEqual(spawn, { x: 0, z: 3 });
  assert.ok(isWalkable({ x: 0, z: 0 }));
  assert.ok(isWalkable(spawn));
  assert.ok(!isWalkable({ x: 100, z: 100 }));
  assert.ok(!isWalkable({ x: 10, z: 6 }));
  const offPathEdge = HUB_RADIUS - PLAYER_RADIUS + 0.01;
  assert.ok(!isWalkable({ x: Math.cos(Math.PI / 8) * offPathEdge, z: Math.sin(Math.PI / 8) * offPathEdge }));
  for (const position of [{ x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: -Infinity, z: 0 }]) {
    assert.equal(isWalkable(position), false);
    assert.equal(districtAt(position), null);
    assert.equal(nearestLandmark(position), null);
    const moved = movePlayer(position, { x: 1, z: 0 }, 0.05);
    assert.ok(Number.isFinite(moved.x) && Number.isFinite(moved.z) && isWalkable(moved));
  }
  for (const landmark of WORLD_LANDMARKS) assert.ok(!isWalkable(landmark), landmark.id);
});

test('movement normalizes diagonals, caps time, runs and uses camera yaw', () => {
  assert.equal(WALK_SPEED, 5.5);
  assert.equal(RUN_SPEED, 8);
  const base = { x: 0, z: 0 };
  near(distance(base, movePlayer(base, { x: 1, z: 0 }, 0.05)), 5.5 * 0.05);
  near(distance(base, movePlayer(base, { x: 1, z: -1 }, 0.05)), 5.5 * 0.05);
  near(distance(base, movePlayer(base, { x: 1, z: 0 }, 50)), 5.5 * 0.05);
  near(distance(base, movePlayer(base, { x: 1, z: 0 }, 0.05, 0, true)), 8 * 0.05);
  const forward = movePlayer(base, { x: 0, z: -1 }, 0.05, Math.PI / 2);
  near(forward.x, -5.5 * 0.05);
  near(forward.z, 0);
  assert.deepEqual(movePlayer(base, { x: 1, z: 0 }, -1), base);
  assert.deepEqual(movePlayer(base, { x: 1, z: 0 }, NaN), base);
  assert.deepEqual(movePlayer(base, { x: Infinity, z: 0 }, 0.05), base);
  assert.deepEqual(movePlayer(base, { x: 1, z: 0 }, 0.05, NaN), base);
  const edge = { x: HUB_RADIUS - PLAYER_RADIUS - 0.03, z: 1 };
  if (isWalkable(edge)) assert.ok(isWalkable(movePlayer(edge, { x: 1, z: 0 }, 0.05, 0, true)));
});

test('movement respects collider clearance and slides around an obstructed approach', () => {
  const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === 'auspex')!;
  const clearance = landmark.radius + PLAYER_RADIUS;
  const cardinal = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
  const normal = cardinal.find((direction) => isWalkable({
    x: landmark.x + direction.x * (clearance + 0.02),
    z: landmark.z + direction.z * (clearance + 0.02),
  }))!;
  assert.ok(normal, 'landmark must have an accessible interaction edge');
  const start = { x: landmark.x + normal.x * (clearance + 0.02), z: landmark.z + normal.z * (clearance + 0.02) };
  const straight = movePlayer(start, { x: -normal.x, z: -normal.z }, 0.05, 0, true);
  assert.ok(isWalkable(straight));
  assert.ok(distance(straight, landmark) >= clearance - 1e-9);
  assert.ok(distance(straight, start) <= 0.021, 'straight approach must stop before the solid');
  const tangent = { x: -normal.z, z: normal.x };
  const sliding = movePlayer(start, { x: -normal.x + tangent.x * 0.8, z: -normal.z + tangent.z * 0.8 }, 0.05, 0, true);
  assert.ok(isWalkable(sliding));
  assert.ok(distance(sliding, landmark) >= clearance - 1e-9);
  assert.ok((sliding.x - start.x) * tangent.x + (sliding.z - start.z) * tangent.z > 0.05);
  assert.ok(distance(start, sliding) <= RUN_SPEED * 0.05 + 1e-9);
});

test('surface interaction is inclusive, deterministic, finite and handles unknown IDs', () => {
  const landmark = WORLD_LANDMARKS.find((candidate) => candidate.id === 'auspex')!;
  const point = { x: landmark.x + landmark.radius + 4, z: landmark.z };
  assert.equal(nearestLandmark(point, 4)?.id, landmark.id);
  assert.equal(nearestLandmark(point, 3.99), null);
  assert.equal(nearestLandmark(landmark, 0)?.id, landmark.id);
  assert.equal(nearestLandmark(point, -1), null);
  assert.equal(nearestLandmark(point, NaN), null);
  const result = nearestLandmark({ x: 0, z: 0 }, 100);
  const distances = WORLD_LANDMARKS.map((entry) => Math.max(0, distance(entry, { x: 0, z: 0 }) - entry.radius));
  assert.equal(result?.id, WORLD_LANDMARKS[distances.indexOf(Math.min(...distances))].id);
  assert.equal(districtAt({ x: 0, z: 0 }), null);
  assert.equal(districtAt(landmark)?.id, 'holds');
  const unknown = safeDistrictSpawn('missing');
  assert.deepEqual(unknown, spawn);
  assert.notEqual(unknown, spawn);
});

test('keyboard opposing inputs cancel and discovery remains an immutable local stamp', () => {
  assert.deepEqual(keyboardAxis(new Set()), { x: 0, z: 0 });
  assert.deepEqual(keyboardAxis(new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD'])), { x: 0, z: 0 });
  assert.deepEqual(keyboardAxis(new Set(['ArrowUp'])), { x: 0, z: -1 });
  const diagonal = keyboardAxis(new Set(['KeyW', 'KeyD']));
  near(Math.hypot(diagonal.x, diagonal.z), 1);
  assert.ok(diagonal.x > 0 && diagonal.z < 0);
  const original = new Set<string>();
  const stamped = collectDiscovery(original, safeDistrictSpawn('growth'));
  assert.deepEqual([...original], []);
  assert.deepEqual([...stamped], ['growth']);
  assert.notEqual(stamped, original);
  assert.deepEqual([...collectDiscovery(stamped, { x: 0, z: 0 })], ['growth']);
  assert.deepEqual([...collectDiscovery(stamped, { x: NaN, z: 0 })], ['growth']);
});
