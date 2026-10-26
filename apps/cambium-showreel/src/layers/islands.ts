// Real 3D: the image-to-3d Genesis island GLB (apps/cambium-r3f public assets),
// lit with a neutral studio environment plus brand-tinted key/rim lights.
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  Vector3,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { COL } from '../tokens.ts';

export async function loadIsland(url: string): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  // normalise: centre on origin, unit radius in XZ
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  root.position.sub(centre);
  // inner group carries the normalisation so callers can freely set g.scale
  const inner = new Group();
  inner.add(root);
  const s = 1 / Math.max(size.x, size.z);
  inner.scale.setScalar(s);
  const g = new Group();
  g.add(inner);
  g.userData.height = size.y * s;
  root.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | undefined;
    if (m && 'emissiveIntensity' in m) {
      m.emissiveIntensity = 0.18;
      m.color.multiplyScalar(0.72);
      m.envMapIntensity = 0.55;
      m.metalness = Math.min(m.metalness, 0.35);
    }
  });
  return g;
}

/** Studio rig: env for reflections, warm key, cool mist fill, signal rim. */
export function lightIsland(scene: Scene, renderer: WebGLRenderer) {
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const key = new DirectionalLight(new Color('#fff3df'), 2.0);
  key.position.set(-2, 3.2, 2.4);
  const fill = new HemisphereLight(COL.mist.clone(), COL.ink.clone(), 0.55);
  const rim = new DirectionalLight(COL.signal.clone(), 1.4);
  rim.position.set(2.4, 1.2, -2.6);
  const amb = new AmbientLight(COL.substrate.clone(), 0.4);
  scene.add(key, fill, rim, amb);
  return { key, fill, rim, amb };
}
