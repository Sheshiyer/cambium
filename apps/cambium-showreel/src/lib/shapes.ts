// Stroke ribbons (draw-on, dashed, dotted) and point-sprite dot fields.
// Everything renders premultiplied so strokes, dots and text composite alike.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CustomBlending,
  DoubleSide,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Points,
  ShaderMaterial,
  Sphere,
  Vector3,
  type Blending,
} from 'three';
import { COL, type Swatch } from '../tokens.ts';

export type V3 = [number, number, number];

const premult = (m: ShaderMaterial, additive = false) => {
  if (additive) {
    m.blending = AdditiveBlending as Blending;
  } else {
    m.blending = CustomBlending;
    m.blendSrc = OneFactor;
    m.blendDst = OneMinusSrcAlphaFactor;
  }
  m.transparent = true;
  m.depthWrite = false;
  return m;
};

const strokeVert = /* glsl */ `
  attribute float aU;
  attribute float aV;
  varying float vU;
  varying float vV;
  void main() {
    vU = aU;
    vV = aV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const strokeFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHeadColor;
  uniform float uOpacity;
  uniform float uStart;
  uniform float uEnd;
  uniform float uLen;
  uniform float uHalfW;
  uniform float uDash;     // period in world units (0 = solid)
  uniform float uDuty;     // fraction of period that is ink
  uniform float uDotted;   // 1 = round dots instead of dashes
  uniform float uSolid;    // 0..1 morph from dashed/dotted -> solid
  uniform float uOffset;   // dash phase (world units)
  uniform float uHead;     // brighten near the drawing head
  varying float vU;
  varying float vV;
  void main() {
    float aaU = fwidth(vU) * 1.5;
    float a = smoothstep(uStart - aaU, uStart, vU) * (1.0 - smoothstep(uEnd - aaU, uEnd, vU));
    if (a <= 0.0) discard;
    float aaV = max(fwidth(vV) * 1.25, 1e-4);
    float across = 1.0 - smoothstep(1.0 - aaV, 1.0, abs(vV));
    float patt = 1.0;
    if (uDash > 0.0) {
      float s = vU * uLen + uOffset;
      float ph = fract(s / uDash);
      if (uDotted > 0.5) {
        float along = (ph - 0.5) * uDash;
        float d = length(vec2(along, vV * uHalfW));
        float aa = fwidth(s) * 1.2;
        patt = 1.0 - smoothstep(uHalfW - aa, uHalfW, d);
        across = 1.0;
      } else {
        float aa = fwidth(s) / uDash * 1.5;
        patt = smoothstep(0.0, aa, ph) * (1.0 - smoothstep(uDuty - aa, uDuty, ph));
      }
    }
    patt = mix(patt, 1.0, uSolid);
    a *= across * patt * uOpacity;
    if (a <= 0.002) discard;
    float head = uHead * smoothstep(uEnd - 0.06, uEnd, vU);
    vec3 col = mix(uColor, uHeadColor, head);
    gl_FragColor = vec4(col * a, a);
  }
`;

export interface StrokeOpts {
  width: number;
  color?: Swatch | Color;
  /** plane normal used to extrude the ribbon; UI = +z, ground = +y */
  normal?: V3;
  dash?: number;
  duty?: number;
  dotted?: boolean;
  opacity?: number;
}

/** A ribbon along a polyline with draw-on, dashing and dotted modes. */
export class Stroke {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  length = 0;
  points: Vector3[] = [];

  constructor(points: V3[] | Vector3[], opts: StrokeOpts) {
    const mat = premult(
      new ShaderMaterial({
        uniforms: {
          uColor: { value: (opts.color instanceof Color ? opts.color : COL[opts.color ?? 'mist']).clone() },
          uHeadColor: { value: COL.paper.clone() },
          uOpacity: { value: opts.opacity ?? 1 },
          uStart: { value: 0 },
          uEnd: { value: 1.001 },
          uLen: { value: 1 },
          uHalfW: { value: opts.width / 2 },
          uDash: { value: opts.dash ?? 0 },
          uDuty: { value: opts.duty ?? 0.5 },
          uDotted: { value: opts.dotted ? 1 : 0 },
          uSolid: { value: 0 },
          uOffset: { value: 0 },
          uHead: { value: 0 },
        },
        vertexShader: strokeVert,
        fragmentShader: strokeFrag,
        side: DoubleSide,
        depthTest: false,
      }),
    );
    this.mesh = new Mesh(new BufferGeometry(), mat);
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
    this.setPoints(points, opts.width, opts.normal ?? [0, 0, 1]);
  }

  setPoints(points: V3[] | Vector3[], width: number, normal: V3 = [0, 0, 1]) {
    const pts = points.map((p) => (p instanceof Vector3 ? p.clone() : new Vector3(p[0], p[1], p[2])));
    this.points = pts;
    const n = pts.length;
    const N = new Vector3(...normal);
    const pos = new Float32Array(n * 2 * 3);
    const au = new Float32Array(n * 2);
    const av = new Float32Array(n * 2);
    const cum: number[] = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const L = cum[n - 1] || 1;
    this.length = L;
    const t = new Vector3();
    const side = new Vector3();
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      t.subVectors(b, a).normalize();
      side.crossVectors(t, N).normalize().multiplyScalar(width / 2);
      const p = pts[i];
      pos.set([p.x + side.x, p.y + side.y, p.z + side.z], i * 6);
      pos.set([p.x - side.x, p.y - side.y, p.z - side.z], i * 6 + 3);
      au[i * 2] = au[i * 2 + 1] = cum[i] / L;
      av[i * 2] = 1;
      av[i * 2 + 1] = -1;
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = this.mesh.geometry;
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aU', new BufferAttribute(au, 1));
    g.setAttribute('aV', new BufferAttribute(av, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    this.u.uLen.value = L;
    this.u.uHalfW.value = width / 2;
    return this;
  }

  get u() {
    return this.mesh.material.uniforms;
  }

  /** Visible window along the stroke: [start, end] in 0..1. */
  draw(end: number, start = 0) {
    this.u.uEnd.value = end <= 0 ? -1 : end >= 1 ? 1.001 : end;
    this.u.uStart.value = start;
    this.mesh.visible = end > start && this.u.uOpacity.value > 0.001;
    return this;
  }

  opacity(v: number) {
    this.u.uOpacity.value = v;
    this.mesh.visible = v > 0.001 && this.u.uEnd.value > this.u.uStart.value;
    return this;
  }

  color(c: Swatch | Color) {
    (this.u.uColor.value as Color).copy(c instanceof Color ? c : COL[c]);
    return this;
  }

  solid(v: number) {
    this.u.uSolid.value = v;
    return this;
  }

  /** Point at normalised arc position u (0..1). */
  pointAt(u: number, out = new Vector3()) {
    const pts = this.points;
    const target = Math.min(1, Math.max(0, u)) * this.length;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = pts[i].distanceTo(pts[i - 1]);
      if (acc + seg >= target) {
        const k = seg > 0 ? (target - acc) / seg : 0;
        return out.lerpVectors(pts[i - 1], pts[i], k);
      }
      acc += seg;
    }
    return out.copy(pts[pts.length - 1]);
  }
}

// ---------------------------------------------------------------- geometry

/** Points on a circle starting at 12 o'clock, clockwise as seen on screen. */
export function circlePts(cx: number, cy: number, r: number, n = 128, a0 = 0, a1 = Math.PI * 2, z = 0): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.sin(a), cy + r * Math.cos(a), z]);
  }
  return out;
}

/** Same, lying on the ground plane (XZ), 12 o'clock = -Z. */
export function groundCircle(cx: number, cz: number, r: number, n = 160, y = 0, a0 = 0, a1 = Math.PI * 2): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.sin(a), y, cz - r * Math.cos(a)]);
  }
  return out;
}

export function smoothPath(ctrl: V3[], n = 120): Vector3[] {
  const c = new CatmullRomCurve3(
    ctrl.map((p) => new Vector3(...p)),
    false,
    'centripetal',
  );
  return c.getSpacedPoints(n);
}

export function polyClosed(pts: [number, number][], ox = 0, oy = 0, s = 1): V3[] {
  const out: V3[] = pts.map(([x, y]) => [ox + x * s, oy + y * s, 0]);
  out.push(out[0]);
  return out;
}

// ---------------------------------------------------------------- dot field

const dotVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uScale;      // >0: perspective attenuation factor, 0: size in px
  uniform float uPixel;      // output pixels per UI px (preview renders at half size)
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = uScale > 0.0 ? aSize * uScale / -mv.z : aSize;
    gl_PointSize = max(s * uPixel, 0.0);
    if (aAlpha <= 0.001) gl_PointSize = 0.0;
  }
`;

// Packet sprite: solid core + small inset halo (brand rule: no neon outer glow).
const dotFrag = /* glsl */ `
  uniform float uCore;
  uniform float uHalo;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float aa = fwidth(r) * 1.2;
    float core = 1.0 - smoothstep(uCore - aa, uCore, r);
    float halo = uHalo * pow(1.0 - r, 2.0);
    float a = max(core, halo) * vAlpha;
    vec3 col = mix(vColor, vec3(1.0, 1.0, 0.95), core * 0.25 * smoothstep(uCore, 0.0, r));
    gl_FragColor = vec4(col * a, a);
  }
`;

export class DotField {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly cap: number;
  private pos: Float32Array;
  private size: Float32Array;
  private col: Float32Array;
  private alpha: Float32Array;
  private n = 0;

  constructor(cap: number, opts: { perspective?: number; core?: number; halo?: number; additive?: boolean } = {}) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.col = new Float32Array(cap * 3);
    this.alpha = new Float32Array(cap);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new BufferAttribute(this.size, 1));
    g.setAttribute('aColor', new BufferAttribute(this.col, 3));
    g.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1));
    // three depth-sorts transparents by geometry.boundingSphere; a lazily computed
    // sphere would depend on whichever frame rendered first, so pin it
    g.boundingSphere = new Sphere(new Vector3(0, 0, 0), 1e6);
    const m = premult(
      new ShaderMaterial({
        uniforms: {
          uScale: { value: opts.perspective ?? 0 },
          uPixel: { value: 1 },
          uCore: { value: opts.core ?? 0.42 },
          uHalo: { value: opts.halo ?? 0.3 },
        },
        vertexShader: dotVert,
        fragmentShader: dotFrag,
        depthTest: false,
      }),
      opts.additive,
    );
    this.points = new Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  begin() {
    this.n = 0;
    return this;
  }

  push(x: number, y: number, z: number, size: number, color: Color, alpha: number) {
    if (this.n >= this.cap || alpha <= 0.001) return this;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.size[i] = size;
    this.col[i * 3] = color.r;
    this.col[i * 3 + 1] = color.g;
    this.col[i * 3 + 2] = color.b;
    this.alpha[i] = alpha;
    return this;
  }

  end() {
    const g = this.points.geometry;
    for (const k of ['position', 'aSize', 'aColor', 'aAlpha']) (g.getAttribute(k) as BufferAttribute).needsUpdate = true;
    g.setDrawRange(0, this.n);
    this.points.visible = this.n > 0;
    return this;
  }
}

export const tmpColor = new Color();
