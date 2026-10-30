// Topographic contour field — the dotted iso-lines that sit under every
// Cambium board. Each dot is placed on a lattice cell that a contour passes
// through, which gives true stippled contours rather than a dashed texture.
import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import { COL } from '../tokens.ts';

const noise = /* glsl */ `
  // Ashima / Stefan Gustavson 3D simplex noise (MIT)
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float field(vec2 p, float t){
    vec3 q = vec3(p, t);
    float n = snoise(q) * 0.72;
    n += snoise(q * 1.97 + vec3(11.7, 3.1, 0.0)) * 0.21;
    n += snoise(q * 4.03 + vec3(-5.3, 9.4, 0.0)) * 0.07;
    return n;
  }
`;

const vert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uFreq;
  uniform float uLevels;
  uniform float uCell;
  uniform float uDotR;
  uniform vec2 uRippleC;
  uniform float uRippleR;
  uniform float uRippleW;
  uniform float uReveal;
  uniform float uRevealSoft;
  uniform float uAlpha;
  uniform float uBg;
  uniform float uGrid;
  uniform float uGridSize;
  uniform vec3 uInk;
  uniform vec3 uSub;
  uniform vec3 uDepth;
  uniform vec3 uMist;
  uniform vec3 uSignal;
  varying vec2 vP;
  ${noise}
  void main() {
    vec3 bg = vec3(0.0);
    if (uBg > 0.5) {
      // apps/cambium-r3f/src/styles.css:48 — #00272b -> #012f34 64% -> #17123e
      float y = 1.0 - gl_FragCoord.y / uRes.y;
      bg = y < 0.64 ? mix(uInk, uSub, y / 0.64) : mix(uSub, uDepth * 0.72, (y - 0.64) / 0.36);
    }

    // Each lattice cell owns at most one dot, snapped onto the contour that
    // crosses it; checking the 2x2 nearest cells keeps snapped dots whole.
    float t = uTime;
    vec2 g0 = floor(vP / uCell - 0.5);
    float dotA = 0.0;
    float ring = 0.0;
    float reveal = 0.0;
    float idxMin = 1.0;
    for (int j = 0; j < 2; j++) {
      for (int i = 0; i < 2; i++) {
        vec2 cell = g0 + vec2(float(i), float(j));
        vec2 c = (cell + 0.5) * uCell;
        vec2 q = c * uFreq;
        float v = field(q, t) * uLevels;
        float e = 0.25 * uCell * uFreq;
        float vx = field(q + vec2(e, 0.0), t) * uLevels;
        float vy = field(q + vec2(0.0, e), t) * uLevels;
        vec2 grad = vec2(vx - v, vy - v) / (e / uFreq);
        float gl = max(length(grad), 1e-4);
        float sd = (fract(v + 0.5) - 0.5) / gl;          // signed world distance to contour
        if (abs(sd) > uCell * 0.5) continue;
        vec2 cp = c - grad / gl * sd;                      // snap onto the contour
        float idx = mod(floor(v + 0.5), 4.0);
        float rd = length(cp - uRippleC);
        float rv = smoothstep(uReveal, uReveal - uRevealSoft, rd);
        float rg = exp(-pow((rd - uRippleR) / max(uRippleW, 1.0), 2.0));
        float r = uDotR * (idx < 0.5 ? 1.3 : 1.0) * (1.0 + rg * 0.6);
        float d = length(vP - cp);
        float aa = fwidth(vP.x) * 1.2;
        float da = (1.0 - smoothstep(r - aa, r + aa * 0.25, d)) * rv;
        if (da > dotA) { dotA = da; ring = rg; reveal = rv; idxMin = idx < 0.5 ? 0.0 : 1.0; }
      }
    }
    float base = uAlpha * (idxMin < 0.5 ? 1.6 : 1.0);
    float a = dotA * clamp(base + ring * 0.75, 0.0, 1.0);
    vec3 dc = mix(uMist, uSignal, clamp(ring * 1.4, 0.0, 1.0));

    // premultiplied overlay: grid first, dots over it
    vec3 pm = vec3(0.0);
    float pa = 0.0;
    if (uGrid > 0.0) {
      vec2 gp = abs(fract(vP / uGridSize + 0.5) - 0.5) * uGridSize;
      float gw = fwidth(vP.x) * 0.9;
      float gr = smoothstep(uReveal, uReveal - uRevealSoft, length(vP - uRippleC));
      float gl = (1.0 - smoothstep(0.0, gw, min(gp.x, gp.y))) * uGrid * gr;
      pm = uMist * gl;
      pa = gl;
    }
    pm = dc * a + pm * (1.0 - a);
    pa = a + pa * (1.0 - a);
    if (uBg > 0.5) gl_FragColor = vec4(bg * (1.0 - pa) + pm, 1.0);
    else gl_FragColor = vec4(pm, pa);
  }
`;

export interface TopoOpts {
  w: number;
  h: number;
  bg?: boolean;
}

export function makeTopo(opts: TopoOpts) {
  const mat = new ShaderMaterial({
    uniforms: {
      uRes: { value: new Vector2(1920, 1080) },
      uTime: { value: 0 },
      uFreq: { value: 1 / 820 },
      uLevels: { value: 8 },
      uCell: { value: 7 },
      uDotR: { value: 1.25 },
      uRippleC: { value: new Vector2(0, 0) },
      uRippleR: { value: 0 },
      uRippleW: { value: 60 },
      uReveal: { value: 1e5 },
      uRevealSoft: { value: 240 },
      uAlpha: { value: 0.22 },
      uBg: { value: opts.bg === false ? 0 : 1 },
      uGrid: { value: 0 },
      uGridSize: { value: 64 },
      uInk: { value: COL.ink.clone() },
      uSub: { value: COL.substrate.clone() },
      uDepth: { value: new Color('#17123e') },
      uMist: { value: COL.mist.clone() },
      uSignal: { value: COL.signal.clone() },
    },
    vertexShader: vert,
    fragmentShader: frag,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
    transparent: opts.bg === false,
  });
  if (opts.bg === false) {
    mat.blending = 5;
    mat.blendSrc = 201;
    mat.blendDst = 205;
  }
  const mesh = new Mesh(new PlaneGeometry(opts.w, opts.h), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

export type Topo = ReturnType<typeof makeTopo>;
