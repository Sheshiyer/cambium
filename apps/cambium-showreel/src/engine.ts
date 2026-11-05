// Director + compositor. Each frame: render the active shot(s) into MSAA
// targets, blend transitions (grid wipe / iris), lay the global HUD on top,
// then a finishing pass converts to sRGB with grain + vignette.
import {
  Camera,
  Color,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { COL } from './tokens.ts';
import { H, W } from './timeline.ts';

export interface Ctx {
  renderer: WebGLRenderer;
  /** output pixel scale (1 = 1920x1080, .5 = preview) */
  scale: number;
  uiCam: OrthographicCamera;
  tex: Record<string, import('three').Texture>;
  assets: Record<string, unknown>;
}

export interface Act {
  id: string;
  scene: Scene;
  camera: Camera;
  ui: Scene;
  init(ctx: Ctx): Promise<void> | void;
  /** Pure function of (frame, variant). Must fully define visible state. */
  update(f: number, variant: number): void;
}

export interface Shot {
  act: Act;
  variant: number;
  start: number;
  end: number;
}

export type TransitionKind = 'grid' | 'iris';

export interface Transition {
  at: number;
  len: number;
  kind: TransitionKind;
}

export interface Overlay {
  scene: Scene;
  update(f: number): void;
}

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;

const compositeFrag = /* glsl */ `
  uniform sampler2D tA;
  uniform sampler2D tB;
  uniform float uP;
  uniform float uKind;     // 0 grid, 1 iris
  uniform vec2 uRes;       // UI px (1920x1080)
  uniform vec3 uSignal;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec4 a = texture2D(tA, vUv);
    vec4 b = texture2D(tB, vUv);
    vec2 px = vUv * uRes;
    if (uKind < 0.5) {
      // 8x8-unit (64px) cells flip in a diagonal wave — the 8px grid as a transition
      float cs = 64.0;
      vec2 cell = floor(px / cs);
      vec2 n = cell / floor(uRes / cs);
      float th = (n.x * 0.62 + (1.0 - n.y) * 0.38) * 0.78 + hash(cell) * 0.16;
      float k = clamp((uP * 1.12 - th) / 0.12, 0.0, 1.0);
      vec2 lp = fract(px / cs) - 0.5;
      // incoming cell grows from its centre
      float box = max(abs(lp.x), abs(lp.y));
      float inB = step(box, k * 0.5 + 0.0001);
      vec4 col = mix(a, b, inB);
      // signal outline on cells mid-flip
      float edge = (1.0 - smoothstep(0.0, 0.02, abs(box - k * 0.5))) * step(0.02, k) * step(k, 0.98);
      col.rgb = mix(col.rgb, uSignal, edge * 0.85);
      gl_FragColor = vec4(col.rgb, 1.0);
    } else {
      // iris: outgoing shot collapses into a point, ringed in signal
      vec2 d = px - uRes * 0.5;
      float r = length(d);
      float R = (1.0 - uP) * (1.0 - uP) * length(uRes) * 0.56;
      float aa = 1.5;
      float inA = 1.0 - smoothstep(R - aa, R, r);
      vec4 col = mix(b, a, inA);
      float ring = (1.0 - smoothstep(0.0, 3.0, abs(r - R))) * step(0.001, uP) * step(uP, 0.999);
      col.rgb = mix(col.rgb, uSignal, ring * 0.9);
      gl_FragColor = vec4(col.rgb, 1.0);
    }
  }
`;

const finalFrag = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uOut;
  uniform float uFrame;
  uniform float uGrain;
  uniform float uVig;
  uniform float uCA;
  uniform float uFade;
  varying vec2 vUv;
  float h12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec3 toSRGB(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    vec2 d = vUv - 0.5;
    vec2 off = d * uCA / uOut.x * 2.0;
    vec3 col;
    col.r = texture2D(tSrc, vUv + off).r;
    col.g = texture2D(tSrc, vUv).g;
    col.b = texture2D(tSrc, vUv - off).b;
    float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.82)) * 1.15);
    col *= mix(1.0 - uVig, 1.0, v);
    col *= uFade;
    vec3 s = toSRGB(col);
    vec2 px = floor(vUv * uOut);
    float n = h12(px + vec2(uFrame * 37.0, uFrame * 11.0)) - 0.5;
    float l = dot(s, vec3(0.299, 0.587, 0.114));
    s += n * uGrain * (0.55 + 0.45 * (1.0 - abs(l * 2.0 - 1.0)));
    s += (h12(px * 1.37 + uFrame) - 0.5) / 255.0;  // dither against 8-bit banding
    gl_FragColor = vec4(s, 1.0);
  }
`;

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly ctx: Ctx;
  readonly outW: number;
  readonly outH: number;
  private rtA: WebGLRenderTarget;
  private rtB: WebGLRenderTarget;
  private rtC: WebGLRenderTarget;
  private quadScene = new Scene();
  private quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private composite: ShaderMaterial;
  private final: ShaderMaterial;
  private quad: Mesh;
  shots: Shot[] = [];
  transitions: Transition[] = [];
  overlays: Overlay[] = [];
  /** frames where a hard cut lands; the finishing pass adds a brief chromatic hit */
  impacts: number[] = [];
  /** finishing-pass grain amplitude */
  set grain(v: number) {
    this.final.uniforms.uGrain.value = v;
  }
  private pixels: Uint8Array;

  constructor(canvas: HTMLCanvasElement, scale: number) {
    this.outW = Math.round(W * scale);
    this.outH = Math.round(H * scale);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.outW, this.outH, false);
    this.renderer.outputColorSpace = LinearSRGBColorSpace; // finishing pass encodes sRGB itself
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.autoClear = false;
    const mk = () =>
      new WebGLRenderTarget(this.outW, this.outH, {
        type: HalfFloatType,
        samples: 4,
        depthBuffer: true,
      });
    this.rtA = mk();
    this.rtB = mk();
    this.rtC = mk();
    const uiCam = new OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1000, 1000);
    uiCam.position.z = 10;
    this.ctx = { renderer: this.renderer, scale, uiCam, tex: {}, assets: {} };
    this.composite = new ShaderMaterial({
      uniforms: {
        tA: { value: null },
        tB: { value: null },
        uP: { value: 0 },
        uKind: { value: 0 },
        uRes: { value: new Vector2(W, H) },
        uSignal: { value: COL.signal.clone() },
      },
      vertexShader: quadVert,
      fragmentShader: compositeFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.final = new ShaderMaterial({
      uniforms: {
        tSrc: { value: null },
        uOut: { value: new Vector2(this.outW, this.outH) },
        uFrame: { value: 0 },
        uGrain: { value: 0.022 },
        uVig: { value: 0.32 },
        uCA: { value: 0 },
        uFade: { value: 1 },
      },
      vertexShader: quadVert,
      fragmentShader: finalFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(1, 1), this.composite);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.pixels = new Uint8Array(this.outW * this.outH * 4);
  }

  private clearColor = new Color();

  private renderShot(shot: Shot, f: number, target: WebGLRenderTarget) {
    const r = this.renderer;
    shot.act.update(f, shot.variant);
    r.setRenderTarget(target);
    this.clearColor.copy(COL.ink);
    r.setClearColor(this.clearColor, 1);
    r.clear(true, true, true);
    r.render(shot.act.scene, shot.act.camera);
    r.clearDepth();
    r.render(shot.act.ui, this.ctx.uiCam);
  }

  private shotAt(f: number) {
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (f >= s.start && f < s.end) return i;
    }
    return this.shots.length - 1;
  }

  render(f: number) {
    const r = this.renderer;
    const i = this.shotAt(f);
    let src = this.rtA;
    // is f inside a transition window that straddles shot boundary?
    const tr = this.transitions.find((t) => f >= t.at - Math.floor(t.len / 2) && f < t.at + Math.ceil(t.len / 2));
    if (tr) {
      const before = this.shotAt(tr.at - 1);
      const after = this.shotAt(tr.at);
      this.renderShot(this.shots[before], f, this.rtA);
      this.renderShot(this.shots[after], f, this.rtB);
      const p = (f - (tr.at - Math.floor(tr.len / 2)) + 0.5) / tr.len;
      this.composite.uniforms.tA.value = this.rtA.texture;
      this.composite.uniforms.tB.value = this.rtB.texture;
      this.composite.uniforms.uP.value = p;
      this.composite.uniforms.uKind.value = tr.kind === 'grid' ? 0 : 1;
      this.quad.material = this.composite;
      r.setRenderTarget(this.rtC);
      r.clear(true, true, true);
      r.render(this.quadScene, this.quadCam);
      src = this.rtC;
    } else {
      this.renderShot(this.shots[i], f, this.rtA);
      src = this.rtA;
    }
    // global HUD
    r.setRenderTarget(src);
    for (const o of this.overlays) {
      o.update(f);
      r.clearDepth();
      r.render(o.scene, this.ctx.uiCam);
    }
    // finishing
    const u = this.final.uniforms;
    u.tSrc.value = src.texture;
    u.uFrame.value = f;
    let ca = 0;
    for (const at of this.impacts) {
      const k = f - at;
      if (k >= 0 && k < 8) ca = Math.max(ca, 2.2 * Math.pow(1 - k / 8, 2));
    }
    u.uCA.value = ca;
    u.uFade.value = Math.min(1, Math.max(0, f / 10));
    this.quad.material = this.final;
    r.setRenderTarget(null);
    r.clear(true, true, true);
    r.render(this.quadScene, this.quadCam);
  }

  read(): Uint8Array {
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, this.outW, this.outH, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    return this.pixels;
  }

  /** Brave shields can perturb readbacks; prove an exact round trip first. */
  selfTest() {
    const gl = this.renderer.getContext();
    this.renderer.setRenderTarget(null);
    gl.clearColor(51 / 255, 102 / 255, 153 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const px = this.read();
    let bad = 0;
    for (let k = 0; k < px.length; k += 4) {
      if (px[k] !== 51 || px[k + 1] !== 102 || px[k + 2] !== 153 || px[k + 3] !== 255) bad++;
    }
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
    return { bad, renderer: String(renderer) };
  }
}
