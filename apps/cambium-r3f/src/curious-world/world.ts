import * as THREE from 'three';
import { createArtBuilder } from './art-geometry.ts';
import { createArtMaterials } from './art-materials.ts';
import { buildLandscape } from './art-landscape.ts';
import { buildArchitecture } from './art-organs.ts';
import { buildFocalGeology } from './art-focal.ts';
import { createTraveler, TRAVELER_DESIGNS, type TravelerDesignId } from './character.ts';
import { createRenderScheduler, createCameraTail } from './render-scheduler.ts';
import { calculateRenderBudget } from './render-budget.ts';
import {
  DISTRICTS, WORLD_LANDMARKS,
  movePlayer, nearestLandmark, districtAt, safeDistrictSpawn,
} from './world-model.ts';

export type WorldLandmark = (typeof WORLD_LANDMARKS)[number];
export type WorldDistrict = (typeof DISTRICTS)[number];
export type WorldState = {
  x: number; z: number; yaw: number; heading: number; district: string | null; nearby: string | null;
  frames: number; drawCalls: number; triangles: number;
  character: TravelerDesignId; renderActive: boolean; rafPending: boolean; rafTicks: number;
  geometries: number; textures: number; programs: number; pixelRatio: number; backbufferPixels: number;
  shadowMaps: number; shadowMapSize: number;
};
export type WorldCallbacks = {
  onNearby: (landmark: WorldLandmark | null) => void;
  onDistrict: (district: WorldDistrict | null) => void;
  onDiscover: (id: string) => void;
  onInteract?: (landmark: WorldLandmark) => void;
  onError: (message: string) => void;
  onState?: (state: WorldState) => void;
};
export interface WorldAPI {
  start(): void;
  pause(): void;
  dispose(): void;
  setInput(axis: { x: number; z: number }, running?: boolean): void;
  clearInput(): void;
  teleport(districtId: string): void;
  setBlocked(blocked: boolean): void;
  interact(): WorldLandmark | null;
  getState(): WorldState;
  setReducedMotion(reduced: boolean): void;
  setCharacter(id: string): void;
}

const C = { petrol: '#00272B', raised: '#012F34', acid: '#E0FF4F', mint: '#D6FFF6',
  peach: '#FFC7A1', copper: '#B88763', stone: '#536E68', light: '#AFBFB0', dark: '#254A47' };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const finite = (n: number) => Number.isFinite(n) ? n : 0;

/** Original, local geometry. This world projects source relationships and has no writer authority. */
export function createWorld(host: HTMLElement, callbacks: WorldCallbacks,
  options: { reducedMotion?: boolean } = {}): WorldAPI {
  let reduced = !!options.reducedMotion, disposed = false, failed = false, started = false, blocked = false;
  let frames = 0, drawCalls = 0, triangles = 0, heading = 0, focused = true, pixelRatio = 1;
  let player = { x: 0, z: 3 }, yaw = 0, pitch = .57, distance = 10.2, running = false;
  let entered = false, entryProgress = 0;
  let axis = { x: 0, z: 0 }, nearby: WorldLandmark | null = null, district: WorldDistrict | null = null;
  let nearbyId: string | null | undefined, districtId: string | null | undefined;
  let cameraDirty = true, wasMoving = false, wasSettling = false;
  const cameraTail = createCameraTail();
  const discovered = new Set<string>(), keys = new Set<string>();
  const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>(), removers: Array<() => void> = [];
  const environmentTargets = new Set<THREE.WebGLRenderTarget>();
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const attributes = ['playerX', 'playerZ', 'cameraYaw', 'frameCount', 'drawCalls', 'triangles', 'district', 'nearby', 'worldReady',
    'characterDesign', 'renderActive', 'rafPending', 'rafTicks', 'geometryCount', 'textureCount', 'programCount',
    'pixelRatio', 'backbufferPixels', 'shadowMaps', 'shadowMapSize'];
  const previousAttributes = new Map(attributes.map(key => [key, host.dataset[key]]));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.petrol);
  scene.fog = new THREE.Fog(C.petrol, 44, 112);
  const camera = new THREE.PerspectiveCamera(46, 1, .15, 280);
  const target = new THREE.Vector3(player.x, 1.22, player.z);
  const desired = new THREE.Vector3(), walkEye = new THREE.Vector3(), openingTarget = new THREE.Vector3();
  const openingEye = new THREE.Vector3(), lookTarget = new THREE.Vector3();
  const overviewDirection = new THREE.Vector3(-.52, .58, .72).normalize();
  let renderer: THREE.WebGLRenderer | null = null;
  let observer: ResizeObserver | null = null;
  let shadowLight: THREE.DirectionalLight | null = null;
  const mobile = () => window.matchMedia('(pointer: coarse)').matches || host.clientWidth < 720;
  const getState = (): WorldState => {
    const status = scheduler.getState();
    return { x: player.x, z: player.z, yaw, heading, district: district?.id ?? null, nearby: nearby?.id ?? null,
      frames, drawCalls, triangles, character: traveler.getDesign(), ...status,
      geometries: renderer?.info.memory.geometries ?? 0, textures: renderer?.info.memory.textures ?? 0,
      programs: renderer?.info.programs?.length ?? 0, pixelRatio,
      backbufferPixels: renderer ? renderer.domElement.width * renderer.domElement.height : 0,
      shadowMaps: !disposed && shadowLight?.shadow.map ? 1 : 0, shadowMapSize: disposed ? 0 : shadowLight?.shadow.mapSize.x ?? 0 };
  };
  const diagnostics = () => {
    const state = getState();
    host.dataset.playerX = player.x.toFixed(3); host.dataset.playerZ = player.z.toFixed(3);
    host.dataset.cameraYaw = yaw.toFixed(4); host.dataset.frameCount = String(frames);
    host.dataset.drawCalls = String(drawCalls); host.dataset.triangles = String(triangles);
    host.dataset.district = district?.id ?? ''; host.dataset.nearby = nearby?.id ?? '';
    host.dataset.worldReady = String(!failed && !!renderer && !disposed);
    host.dataset.characterDesign = state.character; host.dataset.renderActive = String(state.renderActive);
    host.dataset.rafPending = String(state.rafPending); host.dataset.rafTicks = String(state.rafTicks);
    host.dataset.geometryCount = String(state.geometries); host.dataset.textureCount = String(state.textures);
    host.dataset.programCount = String(state.programs); host.dataset.pixelRatio = String(pixelRatio);
    host.dataset.backbufferPixels = String(state.backbufferPixels); host.dataset.shadowMaps = String(state.shadowMaps);
    host.dataset.shadowMapSize = String(state.shadowMapSize); callbacks.onState?.(state);
  };
  const releaseInput = () => {
    const changed = axis.x !== 0 || axis.z !== 0 || running || wasMoving;
    axis = { x: 0, z: 0 }; running = false; keys.clear();
    if (wasMoving) { traveler.resetPose(); wasMoving = false; cameraDirty = true; }
    return changed;
  };
  const clearInput = () => { if (releaseInput()) invalidate(); };
  const refreshContext = () => {
    nearby = nearestLandmark(player, 4); district = districtAt(player);
    if (nearbyId !== (nearby?.id ?? null)) { nearbyId = nearby?.id ?? null; callbacks.onNearby(nearby); }
    if (districtId !== (district?.id ?? null)) { districtId = district?.id ?? null; callbacks.onDistrict(district); }
  };
  const interact = () => {
    if (disposed || failed || blocked) return null;
    refreshContext();
    if (nearby && !discovered.has(nearby.id)) { discovered.add(nearby.id); callbacks.onDiscover(nearby.id); }
    if (nearby) callbacks.onInteract?.(nearby);
    return nearby;
  };
  const fail = () => {
    if (failed || disposed) return;
    failed = true; scheduler.setEnabled(false); scheduler.cancel(); releaseInput(); diagnostics();
    callbacks.onError('The 3D world is unavailable on this device. The 2D atlas remains available.');
  };
  const listen = (surface: EventTarget, name: string, handler: EventListener, options?: AddEventListenerOptions) => {
    surface.addEventListener(name, handler, options);
    removers.push(() => surface.removeEventListener(name, handler, options));
  };
  const mat = (color: string, metal = 0, opacity = 1) => {
    const key = `${color}:${metal}:${opacity}`;
    if (!materialCache.has(key)) {
      const material = new THREE.MeshStandardMaterial({ color, roughness: .8 - metal * .38,
        metalness: metal, opacity, transparent: opacity < 1, depthWrite: opacity === 1 });
      materials.add(material); materialCache.set(key, material);
    }
    return materialCache.get(key)!;
  };
  const geo = <T extends THREE.BufferGeometry>(geometry: T) => { geometries.add(geometry); return geometry; };
  const geometry = {
    box: geo(new THREE.BoxGeometry(1, 1, 1)), cyl: geo(new THREE.CylinderGeometry(1, 1, 1, 12)),
    ring: geo(new THREE.TorusGeometry(1, .09, 5, 20)),
  };
  type Primitive = keyof typeof geometry;
  type Bucket = { geo: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; shadow: boolean };
  const buckets = new Map<string, Bucket>();
  const dummy = new THREE.Object3D();
  const part = (shape: Primitive, color: string, x: number, y: number, z: number,
    sx: number, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, metal = 0, shadow = true) => {
    const material = mat(color, metal), meshGeometry = geometry[shape];
    const key = `${shape}:${material.uuid}:${shadow}`;
    if (!buckets.has(key)) buckets.set(key, { geo: meshGeometry, material, matrices: [], shadow });
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    buckets.get(key)!.matrices.push(dummy.matrix.clone());
  };
  // Link traces are static and dashed. They communicate source contracts, never live traffic.
  const sourceTraces = () => {
    const coordinates = new Map(WORLD_LANDMARKS.map(item => [item.id, item]));
    const seen = new Set<string>(), points: number[] = [];
    for (const landmark of WORLD_LANDMARKS) for (const value of landmark.links) {
      let to: string | undefined;
      if (typeof value === 'string' && coordinates.has(value)) to = value;
      else if (value && typeof value === 'object' && 'to' in value && typeof value.to === 'string') to = value.to;
      if (!to || to === landmark.id || !coordinates.has(to)) continue;
      const key = [landmark.id, to].sort().join(':'); if (seen.has(key)) continue; seen.add(key);
      const end = coordinates.get(to)!;
      points.push(landmark.x, .06, landmark.z, end.x, .06, end.z);
    }
    if (!points.length) return;
    const g = geo(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const m = new THREE.LineDashedMaterial({ color: C.mint, transparent: true, opacity: .035,
      dashSize: .36, gapSize: .48, depthWrite: false }); materials.add(m);
    const lines = new THREE.LineSegments(g, m); lines.computeLineDistances(); scene.add(lines);
  };
  const traveler = createTraveler({ trackGeometry: g => geometries.add(g), trackMaterial: m => materials.add(m) });
  const courier = traveler.root; courier.rotation.y = Math.PI;
  const placeCamera = (dt: number, immediate = false) => {
    desired.set(player.x, 1.22, player.z);
    target.lerp(desired, immediate || reduced ? 1 : 1 - Math.exp(-dt * 11));
    const walkingDistance = distance * (mobile() ? 1.4 : 1), horizontal = walkingDistance * Math.cos(pitch);
    walkEye.set(target.x + Math.sin(yaw) * horizontal,
      target.y + Math.sin(pitch) * walkingDistance, target.z + Math.cos(yaw) * horizontal);
    if (entered && !blocked) entryProgress = immediate || reduced ? 1 : Math.min(1, entryProgress + dt / 1.4);
    const t = entered ? entryProgress * entryProgress * (3 - 2 * entryProgress) : 0;
    if (mobile()) openingTarget.set(0, 0, -5); else openingTarget.set(-8, 0, 0);
    openingEye.copy(overviewDirection).multiplyScalar(mobile() ? 57 : 89).add(openingTarget);
    camera.position.copy(openingEye).lerp(walkEye, t); lookTarget.copy(openingTarget).lerp(target, t); camera.lookAt(lookTarget);
    if (scene.fog instanceof THREE.Fog) { scene.fog.near = 42 + (1 - t) * 35; scene.fog.far = 112 + (1 - t) * 65; }
  };
  const draw = () => {
    if (!renderer || disposed || failed || document.hidden) return;
    renderer.render(scene, camera); frames++; drawCalls = renderer.info.render.calls; triangles = renderer.info.render.triangles;
    cameraDirty = false; diagnostics();
  };
  const invalidate = () => {
    if (disposed || failed) return;
    cameraDirty = true;
    scheduler.setEnabled(focused);
    scheduler.invalidate();
  };
  const resize = () => {
    if (!renderer || failed || disposed) return;
    const budget = calculateRenderBudget(host.clientWidth, host.clientHeight, window.devicePixelRatio || 1, mobile());
    // Resize ordering avoids a transient oversized buffer when the new viewport permits a higher DPR.
    if (budget.pixelRatio <= pixelRatio) { renderer.setPixelRatio(budget.pixelRatio); renderer.setSize(budget.width, budget.height, false); }
    else { renderer.setSize(budget.width, budget.height, false); renderer.setPixelRatio(budget.pixelRatio); }
    pixelRatio = budget.pixelRatio; camera.aspect = budget.width / budget.height; camera.fov = mobile() ? 62 : 46;
    camera.updateProjectionMatrix(); invalidate();
  };
  const frame = (_time: number, dt: number) => {
    if (disposed || failed || document.hidden || !focused || !renderer) return false;
    if (!started || blocked) { placeCamera(0); draw(); return false; }
    const inputActive = axis.x !== 0 || axis.z !== 0;
    const next = inputActive ? movePlayer(player, axis, dt, yaw, running) : player;
    const dx = next.x - player.x, dz = next.z - player.z, distanceDelta = Math.hypot(dx, dz), moving = distanceDelta > .00001;
    const poseChanged = moving || wasMoving;
    player = next;
    if (moving) {
      courier.position.set(player.x, 0, player.z); courier.rotation.y = Math.atan2(dx, dz);
      heading = Math.atan2(-dx, -dz); cameraTail.reset(); refreshContext();
    }
    if (poseChanged) traveler.pose(distanceDelta, moving, reduced);
    const entryChanging = entered && entryProgress < 1;
    const error = target.distanceToSquared(desired.set(player.x, 1.22, player.z));
    const settling = cameraTail.advance(error, dt, reduced);
    if (!moving && !settling) target.copy(desired);
    if (cameraDirty || moving || poseChanged || settling || wasSettling !== settling || entryChanging) { placeCamera(dt); draw(); }
    wasMoving = moving; wasSettling = settling;
    return (inputActive && (moving || dt <= 0)) || settling || (entered && entryProgress < 1);
  };
  const scheduler = createRenderScheduler({ frame, onState: () => diagnostics(), onError: () => fail() });
  const schedule = () => {
    scheduler.setVisible(!document.hidden); scheduler.setEnabled(focused && !failed && !disposed);
    if (!failed && !disposed) scheduler.invalidate();
  };
  const api: WorldAPI = {
    start: () => { if (disposed || failed) return; started = true; if (!blocked) entered = true; schedule(); },
    pause: () => { started = false; scheduler.setEnabled(false); scheduler.cancel(); releaseInput(); diagnostics(); },
    setInput: (value, sprint = false) => {
      if (disposed || failed || blocked || !focused || document.hidden) return;
      const x = clamp(finite(value.x), -1, 1), z = clamp(finite(value.z), -1, 1);
      if (x === axis.x && z === axis.z && sprint === running) return;
      axis = { x, z }; running = sprint; invalidate();
    },
    clearInput, interact, getState,
    teleport: id => {
      if (disposed || failed) return; releaseInput(); player = { ...safeDistrictSpawn(id) }; entered = true; entryProgress = 1;
      courier.position.set(player.x, 0, player.z); traveler.resetPose(); cameraTail.advance(0, 0, true);
      placeCamera(0, true); refreshContext(); invalidate();
    },
    setBlocked: value => {
      if (disposed || failed) return; blocked = value; releaseInput(); scheduler.setEnabled(false); scheduler.cancel();
      if (!value) entered = true; schedule(); diagnostics();
    },
    setReducedMotion: value => { if (disposed || failed || value === reduced) return; reduced = value; invalidate(); },
    setCharacter: id => {
      if (disposed || failed || id === traveler.getDesign() || !TRAVELER_DESIGNS.some(design => design.id === id)) return;
      traveler.setDesign(id as TravelerDesignId); invalidate(); diagnostics();
    },
    dispose: () => {
      if (disposed) return; disposed = true; started = false; scheduler.dispose(); releaseInput(); traveler.dispose();
      observer?.disconnect(); removers.forEach(remove => remove());
      scene.traverse(object => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
        if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
      });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      environmentTargets.forEach(t => t.dispose()); environmentTargets.clear();
      scene.environment = null; scene.clear(); if (renderer) {
        const canvas = renderer.domElement, contextLost = renderer.getContext().isContextLost();
        renderer.dispose(); if (!contextLost) renderer.forceContextLoss(); canvas.remove(); renderer = null;
      }
      geometries.clear(); materials.clear(); textures.clear(); materialCache.clear(); discovered.clear(); removers.length = 0;
      for (const key of attributes) { const old = previousAttributes.get(key); if (old === undefined) delete host.dataset[key]; else host.dataset[key] = old; }
    },
  };
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !mobile(), alpha: false, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    const canvas = renderer.domElement; canvas.className = 'curious-world-canvas'; canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Walkable Cambium world. Use W A S D or arrow keys to walk, Shift to run, E to inspect. Drag to look and scroll to zoom.');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px'; host.appendChild(canvas);
    const artMaterials = createArtMaterials(m => materials.add(m), t => textures.add(t));
    const environment = new THREE.Scene(); environment.background = new THREE.Color('#91A59C');
    const reflector = new THREE.Mesh(geo(new THREE.BoxGeometry(80, 80, 80)), new THREE.MeshBasicMaterial({ color: '#A9BAA5', side: THREE.BackSide }));
    materials.add(reflector.material); environment.add(reflector);
    const panel = new THREE.Mesh(geo(new THREE.PlaneGeometry(30, 40)), new THREE.MeshBasicMaterial({ color: '#EED4AA' }));
    materials.add(panel.material); panel.position.set(-25, 12, 20); panel.lookAt(0, 0, 0); environment.add(panel);
    const pmrem = new THREE.PMREMGenerator(renderer), environmentTarget = pmrem.fromScene(environment, .03);
    environmentTargets.add(environmentTarget); scene.environment = environmentTarget.texture; scene.environmentIntensity = .55; pmrem.dispose(); environment.clear();
    const water = new THREE.Mesh(geo(new THREE.CircleGeometry(150, 64)), artMaterials.get('water'));
    water.rotation.x = -Math.PI / 2; water.position.y = -5; water.receiveShadow = true; scene.add(water);
    const art = createArtBuilder(scene, surface => artMaterials.get(surface)!, g => geometries.add(g));
    buildLandscape(art); buildArchitecture(art); buildFocalGeology(art); art.flush();
    for (const d of DISTRICTS) {
      const length = Math.hypot(d.x, d.z) || 1, x = d.x - d.x / length * (d.radius - 1.1), z = d.z - d.z / length * (d.radius - 1.1);
      part('cyl', C.copper, x, .22, z, .025, .44, .025, 0, 0, 0, .5);
      part('box', d.color, x, .44, z, .22, .08, .1, 0, 0, 0, .7);
    }
    // Quiet landing plaza and its radial compass: orientation, never a health gauge.
    part('ring', C.copper, 0, .014, 0, .65, .65, .035, -Math.PI / 2, 0, 0, .55, false);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4;
      part('box', C.copper, Math.sin(a) * .8, .018, Math.cos(a) * .8, .018, .01, .17, 0, a, 0, .4, false); }
    for (const bucket of buckets.values()) {
      const mesh = new THREE.InstancedMesh(bucket.geo, bucket.material, bucket.matrices.length);
      bucket.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = bucket.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); scene.add(mesh);
    }
    buckets.clear(); sourceTraces();
    courier.position.set(player.x, 0, player.z); scene.add(courier);
    scene.add(new THREE.HemisphereLight('#D6FFF6', '#152B25', 1.25));
    const sun = new THREE.DirectionalLight('#FFE8CB', 2.6); shadowLight = sun; sun.position.set(18, 34, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(mobile() ? 512 : 1024, mobile() ? 512 : 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -46; sun.shadow.camera.right = sun.shadow.camera.top = 46;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 100; sun.shadow.normalBias = .04; sun.shadow.bias = -.00015; scene.add(sun);
    const rim = new THREE.DirectionalLight('#A6DDD2', .8); rim.position.set(-24, 12, -20); scene.add(rim);
    let pointer: { id: number; x: number; y: number; startX: number; startY: number; dragged: boolean } | null = null;
    listen(canvas, 'pointerdown', event => {
      const e = event as PointerEvent; if (blocked || e.button !== 0) return; canvas.focus({ preventScroll: true });
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragged: false };
      canvas.setPointerCapture(e.pointerId);
    });
    listen(canvas, 'pointermove', event => {
      const e = event as PointerEvent; if (!pointer || e.pointerId !== pointer.id || blocked) return;
      if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 6) pointer.dragged = true;
      if (pointer.dragged) { yaw -= (e.clientX - pointer.x) * .005; pitch = clamp(pitch + (e.clientY - pointer.y) * .004, .27, 1.02); invalidate(); }
      pointer.x = e.clientX; pointer.y = e.clientY;
    });
    const release = (event: Event, cancelled = false) => {
      const e = event as PointerEvent; if (!pointer || pointer.id !== e.pointerId) return;
      const click = !pointer.dragged && !cancelled; pointer = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (click) interact();
    };
    listen(canvas, 'pointerup', event => release(event)); listen(canvas, 'pointercancel', event => release(event, true));
    listen(canvas, 'lostpointercapture', () => { pointer = null; });
    listen(canvas, 'wheel', event => { if (blocked) return; const e = event as WheelEvent; e.preventDefault();
      distance = clamp(distance + clamp(e.deltaY, -120, 120) * .018, 7.5, 24); invalidate(); }, { passive: false });
    const updateKeys = () => {
      axis = { x: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        z: Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) };
      running = keys.has('ShiftLeft') || keys.has('ShiftRight'); invalidate();
    };
    listen(canvas, 'keydown', event => { const e = event as KeyboardEvent; if (blocked) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        e.preventDefault(); keys.add(e.code); updateKeys();
      } else if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); interact(); }
    });
    listen(canvas, 'keyup', event => { const e = event as KeyboardEvent; keys.delete(e.code); updateKeys(); });
    listen(canvas, 'blur', () => { clearInput(); pointer = null; });
    listen(window, 'blur', () => {
      focused = false; releaseInput(); pointer = null; cameraTail.advance(0, 0, true);
      scheduler.setEnabled(false); scheduler.cancel(); diagnostics();
    });
    listen(window, 'focus', () => { focused = true; schedule(); });
    listen(document, 'visibilitychange', () => {
      releaseInput(); pointer = null; scheduler.setVisible(!document.hidden);
      if (document.hidden) { scheduler.cancel(); diagnostics(); }
      else { resize(); schedule(); }
    });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); fail(); });
    listen(window, 'resize', resize);
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize); observer.observe(host); }
    schedule(); resize(); refreshContext(); diagnostics();
  } catch { fail(); }
  return api;
}
