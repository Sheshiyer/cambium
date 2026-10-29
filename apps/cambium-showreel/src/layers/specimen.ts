// Specimen plates: the matted R3F renders as textured quads. A light grade
// pulls their neutral stone toward the brand's teal ink while leaving the
// chartreuse veins and brass studs untouched. Supports a scanline wipe.
import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, type Texture } from 'three';
import { COL } from '../tokens.ts';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  uniform float uGrade;
  uniform float uBright;
  uniform float uWipe;      // 1 = fully shown
  uniform float uFromTop;   // 1 = reveal top -> bottom (screens), 0 = bottom -> top
  uniform float uDim;       // 0..1 pushes toward ink (depth / inactive)
  uniform vec3 uInk;
  uniform vec3 uSub;
  uniform vec3 uMist;
  uniform vec3 uSignal;
  uniform vec3 uTint;       // state tint (signal / warning) multiplied into veins
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < 0.004) discard;
    vec3 c = t.rgb;
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = (mx - mn) / max(mx, 1e-3);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // neutral stone -> ink/substrate/mist ramp
    vec3 ramp = l < 0.08 ? mix(uInk * 0.35, uInk, l / 0.08) : mix(uSub * 1.4, uMist * 0.85, clamp((l - 0.08) / 0.7, 0.0, 1.0));
    float neutral = 1.0 - smoothstep(0.18, 0.45, sat);
    c = mix(c, mix(c, ramp, 0.55), uGrade * neutral);
    // veins: keep chartreuse but let state tint shift it
    float vein = smoothstep(0.35, 0.7, sat) * smoothstep(0.15, 0.45, l);
    c = mix(c, c * uTint, vein);
    c *= uBright;
    c = mix(c, uInk * 0.6, uDim);
    float a = t.a * uOpacity;
    // scan wipe with a signal line on the leading edge
    float edge = (uFromTop > 0.5 ? 1.0 - vUv.y : vUv.y) - uWipe;
    a *= 1.0 - smoothstep(-0.004, 0.0, edge);
    float line = (1.0 - smoothstep(0.0, 0.0045, abs(edge))) * step(uWipe, 0.999) * step(0.001, uWipe) * t.a;
    c = mix(c, uSignal, line);
    a = max(a, line * uOpacity * 0.9);
    if (a <= 0.003) discard;
    gl_FragColor = vec4(c * a, a);
  }
`;

export function makeSpecimen(map: Texture, size: number, height = size) {
  const mat = new ShaderMaterial({
    uniforms: {
      map: { value: map },
      uOpacity: { value: 1 },
      uGrade: { value: 1 },
      uBright: { value: 1.08 },
      uWipe: { value: 1 },
      uFromTop: { value: 0 },
      uDim: { value: 0 },
      uInk: { value: COL.ink.clone() },
      uSub: { value: COL.substrate.clone() },
      uMist: { value: COL.mist.clone() },
      uSignal: { value: COL.signal.clone() },
      uTint: { value: COL.paper.clone().setRGB(1, 1, 1) },
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
  const mesh = new Mesh(new PlaneGeometry(size, height), mat);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return mesh;
}

export type Specimen = ReturnType<typeof makeSpecimen>;
