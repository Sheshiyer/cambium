import * as THREE from 'three';

export type TravelerDesignId = 'courier' | 'cartographer' | 'gardener';
type Palette = { coat: string; trim: string; lining: string; skin: string; hair: string; hat: string; leather: string; boots: string };
export type TravelerDesign = { id: TravelerDesignId; name: string; description: string; colors: Readonly<Palette> };

/** Cosmetic expedition clothing only; these designs grant no agent role or operational state. */
export const TRAVELER_DESIGNS: readonly Readonly<TravelerDesign>[] = Object.freeze([
  Object.freeze({ id: 'courier', name: 'Courier', description: 'Tailored petrol coat, copper trim and a compact messenger satchel.',
    colors: Object.freeze({ coat: '#173F45', trim: '#C59A68', lining: '#D9AC87', skin: '#D9A785', hair: '#293A38', hat: '#43585A', leather: '#765C45', boots: '#293C3C' }) }),
  Object.freeze({ id: 'cartographer', name: 'Cartographer', description: 'Limestone field coat, sage waistcoat, brimmed hat and rolled maps.',
    colors: Object.freeze({ coat: '#C9C6AD', trim: '#9B7554', lining: '#779589', skin: '#C39272', hair: '#394745', hat: '#667F78', leather: '#7E6246', boots: '#354843' }) }),
  Object.freeze({ id: 'gardener', name: 'Gardener', description: 'Moss workcoat, ochre apron, straw cloche and a small garden tool.',
    colors: Object.freeze({ coat: '#647451', trim: '#B89962', lining: '#B99A63', skin: '#AA7859', hair: '#514539', hat: '#BDAE7B', leather: '#715B40', boots: '#3B4C3A' }) }),
]);

type Joint = 'body' | 'head' | 'leftArm' | 'rightArm' | 'leftForearm' | 'rightForearm' | 'leftThigh' | 'rightThigh' | 'leftShin' | 'rightShin';
type V3 = [number, number, number];
type BakedPart = { positions: Float32Array; normals: Float32Array; colors: Float32Array };
type BakedDesign = Record<Joint, BakedPart>;
const JOINTS: readonly Joint[] = ['body', 'head', 'leftArm', 'rightArm', 'leftForearm', 'rightForearm', 'leftThigh', 'rightThigh', 'leftShin', 'rightShin'];

/** Bake colored primitives into one main-pass mesh per moving segment. Temporary geometry is disposed immediately. */
function partBaker() {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [];
  function add(geometry: THREE.BufferGeometry, color: string, position: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0]): void {
    const object = new THREE.Object3D(); object.position.set(...position); object.scale.set(...scale); object.rotation.set(...rotation); object.updateMatrix();
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    try {
      flat.applyMatrix4(object.matrix);
      const vertex = flat.getAttribute('position'), normal = flat.getAttribute('normal'), tint = new THREE.Color(color);
      for (let index = 0; index < vertex.count; index++) {
        positions.push(vertex.getX(index), vertex.getY(index), vertex.getZ(index));
        normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
        colors.push(tint.r, tint.g, tint.b);
      }
    } finally { if (flat !== geometry) flat.dispose(); geometry.dispose(); }
  }
  return { add, finish: (): BakedPart => ({ positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors) }) };
}

const sphere = (width = 8, height = 5) => new THREE.SphereGeometry(1, width, height);
const cylinder = (top = 1, bottom = 1, sides = 8) => new THREE.CylinderGeometry(top, bottom, 1, sides, 1);

function roundedPanel(width: number, height: number, depth: number): THREE.BufferGeometry {
  const r = Math.min(width, height) * .16, x = -width / 2, y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + width - r, y); shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r); shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2, steps: 1 });
  geometry.translate(0, 0, -depth / 2); return geometry;
}

function bakeDesign(design: Readonly<TravelerDesign>): BakedDesign {
  const c = design.colors, courier = design.id === 'courier', gardener = design.id === 'gardener';
  const parts = {} as BakedDesign;
  const body = partBaker();
  const coat = new THREE.LatheGeometry([
    new THREE.Vector2(0, -.35), new THREE.Vector2(.13, -.35), new THREE.Vector2(.178, -.31),
    new THREE.Vector2(.166, -.02), new THREE.Vector2(.206, .23), new THREE.Vector2(.178, .31),
    new THREE.Vector2(.105, .355), new THREE.Vector2(0, .355),
  ], 12);
  body.add(coat, c.coat, [0, 0, 0], [1, courier ? 1 : .94, .63]);
  body.add(roundedPanel(.195, gardener ? .33 : .26, .018), c.lining, [0, -.09, .109]);
  body.add(cylinder(.8, 1, 10), c.leather, [0, -.16, 0], [.173, .045, .113]);
  body.add(roundedPanel(.038, .043, .024), c.trim, [0, -.16, .118]);
  body.add(sphere(10, 4), c.coat, [0, .24, -.005], [.223, courier ? .14 : .078, .14]);
  body.add(cylinder(.77, 1, 10), c.lining, [0, .32, 0], [.09, .07, .08]);
  body.add(roundedPanel(.06, courier ? .16 : .08, .018), c.lining, [.038, .235, .13], undefined, [0, 0, -.14]);
  // Tailored lapels, closure and leather sling are colored into the body mesh.
  for (const side of [-1, 1]) body.add(roundedPanel(.046, .14, .016), c.trim, [side * .07, .22, .105], undefined, [0, 0, side * -.38]);
  body.add(cylinder(1, 1, 6), c.leather, [0, .035, .124], [.012, .54, .009], [0, 0, -.46]);
  for (const y of [.13, .035, -.06]) body.add(sphere(6, 4), c.trim, [.043, y, .121], [.011, .011, .006]);
  // Rounded compact satchel and its lid give the rear silhouette a recognizable expedition detail.
  body.add(roundedPanel(.19, .22, .105), c.leather, [.095, -.025, -.15]);
  body.add(roundedPanel(.195, .085, .012), c.trim, [.095, .045, -.211]);
  body.add(roundedPanel(.025, .045, .016), c.trim, [.095, -.018, -.21]);
  for (const side of [-1, 1]) body.add(cylinder(1, 1, 7), gardener ? c.leather : c.lining,
    [.095 + side * .055, .12, -.157], [.027, gardener ? .15 : .20, .027], [.13, 0, side * .06]);
  body.add(sphere(6, 4), gardener ? c.lining : c.trim, [.14, .17, -.16], [.04, gardener ? .065 : .032, .012]);
  parts.body = body.finish();

  const head = partBaker();
  head.add(cylinder(.85, 1, 8), c.skin, [0, -.035, 0], [.048, .105, .045]);
  head.add(sphere(12, 8), c.skin, [0, .105, 0], [.123, .155, .112]);
  head.add(sphere(8, 5), c.skin, [0, .007, .024], [.092, .071, .08]);
  for (const side of [-1, 1]) {
    head.add(sphere(6, 4), c.skin, [side * .119, .079, .002], [.022, .036, .018]);
    head.add(sphere(6, 4), c.hair, [side * .041, .10, .107], [.012, .017, .008]);
    head.add(sphere(6, 3), c.hair, [side * .04, .133, .103], [.025, .005, .006]);
  }
  head.add(sphere(6, 4), c.skin, [0, .074, .124], [.018, .023, .026]);
  head.add(sphere(6, 3), c.hair, [0, .027, .107], [.025, .004, .005]);
  head.add(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * .38), c.hair,
    [0, .108, 0], [.129, .159, .119]);
  head.add(new THREE.SphereGeometry(1, 10, 5, Math.PI, Math.PI, Math.PI * .35, Math.PI * .52), c.hair,
    [0, .103, -.005], [.13, .158, .12]);
  const brim = courier ? .155 : gardener ? .218 : .205;
  head.add(cylinder(1, 1, 12), c.hat, [0, .257, -.005], [brim, .018, brim * .86]);
  head.add(sphere(12, 6), c.hat, [0, .274, -.012], [.139, gardener ? .06 : .075, .124]);
  head.add(cylinder(.98, 1, 12), c.trim, [0, .273, -.012], [.141, .023, .126]);
  head.add(sphere(6, 4), gardener ? c.coat : c.trim, [.091, .292, .087], [.021, .03, .008], [0, 0, -.38]);
  parts.head = head.finish();

  for (const side of ['left', 'right'] as const) {
    const arm = partBaker();
    arm.add(sphere(8, 6), c.coat, [0, -.055, 0], [.068, .10, .072]);
    arm.add(cylinder(.98, .83, 8), c.coat, [0, -.155, 0], [.064, .24, .065]);
    arm.add(sphere(8, 5), c.coat, [0, -.275, 0], [.055, .065, .058]);
    parts[`${side}Arm`] = arm.finish();
    const forearm = partBaker();
    forearm.add(cylinder(.95, .8, 8), c.coat, [0, -.095, 0], [.052, .19, .053]);
    forearm.add(cylinder(1, 1, 8), c.trim, [0, -.175, 0], [.047, .04, .05]);
    forearm.add(sphere(8, 5), c.skin, [0, -.24, .005], [.044, .073, .038]);
    forearm.add(sphere(6, 4), c.skin, [side === 'left' ? .036 : -.036, -.216, .014], [.014, .036, .018], [0, 0, side === 'left' ? .25 : -.25]);
    parts[`${side}Forearm`] = forearm.finish();
    const thigh = partBaker();
    thigh.add(cylinder(1, .83, 8), c.hair, [0, -.15, 0], [.073, .30, .081]);
    thigh.add(sphere(8, 5), c.hair, [0, -.275, .006], [.063, .058, .067]);
    parts[`${side}Thigh`] = thigh.finish();
    const shin = partBaker();
    shin.add(cylinder(.91, 1, 8), c.boots, [0, -.12, 0], [.056, .25, .06]);
    shin.add(cylinder(1, 1, 8), c.trim, [0, -.047, 0], [.058, .025, .062]);
    shin.add(sphere(8, 5), c.boots, [0, -.278, .035], [.074, .061, .095]);
    shin.add(roundedPanel(.128, .018, .166), c.leather, [0, -.323, .031]);
    parts[`${side}Shin`] = shin.finish();
  }
  return parts;
}

export type TravelerMetrics = Readonly<{ triangles: number; drawCalls: number; materials: number; geometryBuffers: number;
  height: number; footprint: number; variantBytes: number }>;
export interface TravelerRig {
  root: THREE.Group; metrics: TravelerMetrics;
  setDesign(id: TravelerDesignId): void; getDesign(): TravelerDesignId;
  pose(distanceDelta: number, moving: boolean, reduced: boolean): void;
  resetPose(): void; dispose(): void;
}

export function createTraveler(options: { trackGeometry: (geometry: THREE.BufferGeometry) => void; trackMaterial: (material: THREE.Material) => void }): TravelerRig {
  const variants = new Map<TravelerDesignId, BakedDesign>(TRAVELER_DESIGNS.map(design => [design.id, bakeDesign(design)]));
  let designId: TravelerDesignId = 'courier', disposed = false, phase = 0;
  const root = new THREE.Group(); root.name = 'cosmetic-expedition-traveler';
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .74, metalness: .08 });
  options.trackMaterial(material);
  const joints = {} as Record<Joint, THREE.Group>, buffers = {} as Record<Joint, THREE.BufferGeometry>;
  const restPositions = {} as Record<Joint, THREE.Vector3>;
  for (const id of JOINTS) {
    const data = variants.get('courier')![id], geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions.slice(), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals.slice(), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors.slice(), 3));
    options.trackGeometry(geometry); buffers[id] = geometry;
    const joint = new THREE.Group(); joint.name = `traveler-${id}`;
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `${id}-merged`; mesh.receiveShadow = true;
    // Static scene shadows supply depth; this rig adds no extra shadow draw pass.
    mesh.castShadow = false; joint.add(mesh); joints[id] = joint;
  }
  root.add(joints.body, joints.head, joints.leftArm, joints.rightArm, joints.leftThigh, joints.rightThigh);
  joints.body.position.set(0, 1.015, 0); joints.head.position.set(0, 1.43, 0);
  for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
    joints[`${side}Arm`].position.set(sign * .235, 1.255, 0);
    joints[`${side}Arm`].add(joints[`${side}Forearm`]); joints[`${side}Forearm`].position.set(0, -.278, 0);
    joints[`${side}Thigh`].position.set(sign * .085, .68, 0);
    joints[`${side}Thigh`].add(joints[`${side}Shin`]); joints[`${side}Shin`].position.set(0, -.32, 0);
  }
  for (const id of JOINTS) restPositions[id] = joints[id].position.clone();
  const contactGeometry = new THREE.CircleGeometry(.26, 18); options.trackGeometry(contactGeometry);
  const contactMaterial = new THREE.MeshBasicMaterial({ color: '#082B2D', transparent: true, opacity: .20, depthWrite: false }); options.trackMaterial(contactMaterial);
  const contact = new THREE.Mesh(contactGeometry, contactMaterial); contact.name = 'traveler-ground-contact'; contact.rotation.x = -Math.PI / 2; contact.position.y = .006; root.add(contact);

  function install(id: TravelerDesignId): void {
    const data = variants.get(id);
    if (!data) throw new Error(`Unknown traveler design: ${String(id)}`);
    for (const joint of JOINTS) {
      const geometry = buffers[joint], variant = data[joint];
      for (const [name, values] of [['position', variant.positions], ['normal', variant.normals], ['color', variant.colors]] as const) {
        const attribute = geometry.getAttribute(name);
        if (attribute.array.length !== values.length) throw new Error('Traveler variant changes its geometry budget');
        (attribute.array as Float32Array).set(values); attribute.needsUpdate = true;
      }
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    }
    designId = id; root.userData.travelerDesign = id;
  }
  let height = 0, footprint = 0;
  for (const design of TRAVELER_DESIGNS) {
    install(design.id); root.updateMatrixWorld(true);
    for (const id of JOINTS) {
      const vertices = buffers[id].getAttribute('position'), point = new THREE.Vector3();
      for (let index = 0; index < vertices.count; index++) {
        point.fromBufferAttribute(vertices, index).applyMatrix4(joints[id].matrixWorld);
        height = Math.max(height, point.y); footprint = Math.max(footprint, Math.hypot(point.x, point.z) * 2);
      }
    }
  }
  install('courier');
  const triangles = JOINTS.reduce((total, id) => total + buffers[id].getAttribute('position').count / 3, 0) + contactGeometry.index!.count / 3;
  const variantBytes = [...variants.values()].reduce((total, variant) => total + JOINTS.reduce((bytes, id) => bytes + variant[id].positions.byteLength + variant[id].normals.byteLength + variant[id].colors.byteLength, 0), 0);
  const measuredGeometries = new Set<THREE.BufferGeometry>(), measuredMaterials = new Set<THREE.Material>();
  let drawCalls = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    measuredGeometries.add(object.geometry);
    const assigned = Array.isArray(object.material) ? object.material : [object.material];
    assigned.forEach(item => measuredMaterials.add(item));
    drawCalls += Array.isArray(object.material) ? object.geometry.groups.length : 1;
  });
  const metrics = Object.freeze({ triangles, drawCalls, materials: measuredMaterials.size, geometryBuffers: measuredGeometries.size, height, footprint, variantBytes });
  function resetPose(): void {
    if (disposed) return;
    for (const id of JOINTS) { joints[id].rotation.set(0, 0, 0); joints[id].position.copy(restPositions[id]); }
  }
  return {
    root, metrics,
    getDesign: () => designId,
    setDesign(id) { if (disposed) throw new Error('Traveler is disposed'); if (id !== designId) install(id); },
    pose(distanceDelta, moving, reduced) {
      if (disposed) return;
      if (!moving || !Number.isFinite(distanceDelta) || distanceDelta <= 0) { resetPose(); return; }
      phase = (phase + Math.min(distanceDelta, .5) * 8.2) % (Math.PI * 2);
      const swing = Math.sin(phase), stride = .32 * swing;
      joints.leftThigh.rotation.x = stride; joints.rightThigh.rotation.x = -stride;
      joints.leftShin.rotation.x = Math.max(0, -swing) * .13; joints.rightShin.rotation.x = Math.max(0, swing) * .13;
      joints.leftArm.rotation.x = -stride * .80; joints.rightArm.rotation.x = stride * .80;
      joints.leftForearm.rotation.x = -.10 - Math.max(0, swing) * .10;
      joints.rightForearm.rotation.x = -.10 - Math.max(0, -swing) * .10;
      const bob = reduced ? 0 : Math.abs(Math.sin(phase * 2)) * .006;
      joints.body.position.y = restPositions.body.y + bob; joints.head.position.y = restPositions.head.y + bob;
      joints.body.rotation.z = reduced ? 0 : swing * .018;
      joints.head.rotation.y = reduced ? 0 : swing * .03;
    },
    resetPose,
    // Renderer owns tracked GPU disposal. This rig releases scene/CPU ownership exactly once.
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); root.clear(); variants.clear(); },
  };
}
