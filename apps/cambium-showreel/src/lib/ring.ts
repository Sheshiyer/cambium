// Analytic ring (SDF on a quad): the orbitSweep primitive. Arcs start at
// 12 o'clock and grow clockwise; an optional clip window lets one ring be
// split into a back half (behind an object) and a front half (in front).
import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { COL, type Swatch } from '../tokens.ts';

const vert = /* glsl */ `
  varying vec2 vP;
  uniform float uSize;
  void main() {
    vP = position.xy * uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy * uSize, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uR;
  uniform float uW;
  uniform float uA0;
  uniform float uA1;
  uniform float uC0;
  uniform float uC1;
  uniform float uDash;    // dashes around full circle (0 = solid)
  uniform float uDotted;
  uniform float uSolid;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHead;
  uniform vec3 uHeadColor;
  varying vec2 vP;
  const float TAU = 6.28318530718;
  bool inArc(float t, float a, float b) {
    if (b - a >= 0.9999) return true;
    a = fract(a); b = fract(b);
    return a <= b ? (t >= a && t <= b) : (t >= a || t <= b);
  }
  void main() {
    float r = length(vP);
    float t = fract(atan(vP.x, vP.y) / TAU);
    if (uA1 - uA0 <= 0.0) discard;
    if (!inArc(t, uA0, uA1)) discard;
    if (!inArc(t, uC0, uC1)) discard;
    float aa = fwidth(r) * 1.25;
    float band = 1.0 - smoothstep(uW * 0.5 - aa, uW * 0.5, abs(r - uR));
    float patt = 1.0;
    if (uDash > 0.0) {
      float s = t * uDash;
      float ph = fract(s);
      if (uDotted > 0.5) {
        float along = (ph - 0.5) * (TAU * uR / uDash);
        float d = length(vec2(along, r - uR));
        patt = 1.0 - smoothstep(uW * 0.5 - aa, uW * 0.5, d);
        band = 1.0;
      } else {
        float a2 = fwidth(s) * 1.5;
        patt = smoothstep(0.0, a2, ph) * (1.0 - smoothstep(0.5 - a2, 0.5, ph));
      }
    }
    patt = mix(patt, 1.0, uSolid);
    float a = band * patt * uOpacity;
    if (a <= 0.002) discard;
    float head = uHead * smoothstep(0.04, 0.0, fract(uA1) - t) * step(t, fract(uA1) + 0.0001);
    vec3 col = mix(uColor, uHeadColor, head);
    gl_FragColor = vec4(col * a, a);
  }
`;

export interface RingOpts {
  r: number;
  w: number;
  color?: Swatch | Color;
  dash?: number;
  dotted?: boolean;
  opacity?: number;
}

export class Ring {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  constructor(o: RingOpts) {
    const mat = new ShaderMaterial({
      uniforms: {
        uSize: { value: 1 },
        uR: { value: o.r },
        uW: { value: o.w },
        uA0: { value: 0 },
        uA1: { value: 1 },
        uC0: { value: 0 },
        uC1: { value: 1 },
        uDash: { value: o.dash ?? 0 },
        uDotted: { value: o.dotted ? 1 : 0 },
        uSolid: { value: 0 },
        uColor: { value: (o.color instanceof Color ? o.color : COL[o.color ?? 'signal']).clone() },
        uOpacity: { value: o.opacity ?? 1 },
        uHead: { value: 0 },
        uHeadColor: { value: COL.paper.clone() },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    mat.blending = 5;
    mat.blendSrc = 201;
    mat.blendDst = 205;
    this.mesh = new Mesh(new PlaneGeometry(1, 1), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.radius(o.r);
  }
  get u() {
    return this.mesh.material.uniforms;
  }
  radius(r: number, w = this.u.uW.value as number) {
    this.u.uR.value = r;
    this.u.uW.value = w;
    this.u.uSize.value = 2 * (r + w + 4);
    return this;
  }
  /** Arc window in turns from 12 o'clock, clockwise. */
  arc(a1: number, a0 = 0) {
    this.u.uA0.value = a0;
    this.u.uA1.value = a1;
    this.mesh.visible = a1 > a0 && this.u.uOpacity.value > 0.001;
    return this;
  }
  clip(c0: number, c1: number) {
    this.u.uC0.value = c0;
    this.u.uC1.value = c1;
    return this;
  }
  opacity(v: number) {
    this.u.uOpacity.value = v;
    this.mesh.visible = v > 0.001 && this.u.uA1.value > this.u.uA0.value;
    return this;
  }
  color(c: Swatch | Color) {
    (this.u.uColor.value as Color).copy(c instanceof Color ? c : COL[c]);
    return this;
  }
}
