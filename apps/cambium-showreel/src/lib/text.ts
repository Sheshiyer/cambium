// Canvas2D text rendered into its own tightly-sized CanvasTexture.
// The canvas is only redrawn when the string actually changes; motion is
// done with transforms + uniforms so text never re-rasterises mid-animation.
import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
} from 'three';
import { COL, FONT, type Swatch } from '../tokens.ts';

export interface TextOpts {
  font?: 'display' | 'mono';
  weight?: number;
  size: number; // px
  tracking?: number; // em
  color?: Swatch | Color;
  align?: 'left' | 'center' | 'right';
  /** extra raster scale for crispness when the sprite will be scaled up */
  oversample?: number;
}

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// uReveal: horizontal wipe (0..1, left to right, soft edge)
// uRise: vertical mask — glyphs slide up inside their own box
const frag = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uRise;
  uniform float uSoft;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    uv.y -= uRise;
    if (uv.y < 0.0 || uv.y > 1.0) discard;
    float a = texture2D(map, uv).a;
    float edge = smoothstep(uReveal + uSoft, uReveal, vUv.x);
    a *= edge * uOpacity;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class TextSprite {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: CanvasTexture;
  private text = '';
  private opts: Required<Omit<TextOpts, 'color'>> & { color: Color };
  width = 0;
  height = 0;

  constructor(text: string, opts: TextOpts) {
    this.opts = {
      font: opts.font ?? 'mono',
      weight: opts.weight ?? (opts.font === 'display' ? 700 : 500),
      size: opts.size,
      tracking: opts.tracking ?? 0,
      align: opts.align ?? 'left',
      oversample: opts.oversample ?? 2,
      color: opts.color instanceof Color ? opts.color : COL[opts.color ?? 'mist'],
    };
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.tex.minFilter = LinearFilter;
    this.tex.magFilter = LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.premultiplyAlpha = false;
    const mat = new ShaderMaterial({
      uniforms: {
        map: { value: this.tex },
        uColor: { value: this.opts.color.clone() },
        uOpacity: { value: 1 },
        uReveal: { value: 1.2 },
        uRise: { value: 0 },
        uSoft: { value: 0.08 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      premultipliedAlpha: true,
    });
    // premultiplied output -> ONE, ONE_MINUS_SRC_ALPHA
    mat.blending = 5; // CustomBlending
    mat.blendSrc = 201; // OneFactor
    mat.blendDst = 205; // OneMinusSrcAlphaFactor
    this.mesh = new Mesh(new PlaneGeometry(1, 1), mat);
    this.mesh.renderOrder = 10;
    this.set(text);
  }

  private fontString() {
    const fam = this.opts.font === 'display' ? FONT.display : FONT.mono;
    return `${this.opts.weight} ${this.opts.size * this.opts.oversample}px "${fam}"`;
  }

  set(text: string) {
    if (text === this.text && this.width > 0) return this;
    this.text = text;
    const os = this.opts.oversample;
    const ctx = this.ctx;
    ctx.font = this.fontString();
    (ctx as any).letterSpacing = `${this.opts.tracking * this.opts.size * os}px`;
    const m = ctx.measureText(text || ' ');
    const pad = Math.ceil(this.opts.size * 0.25 * os);
    const asc = this.opts.font === 'display' ? 0.78 : 0.8;
    const desc = this.opts.font === 'display' ? 0.06 : 0.22;
    // trailing letter-spacing is included by measureText; trim it so alignment is optical
    const trackPx = this.opts.tracking * this.opts.size * os;
    const tw = Math.max(1, m.width - (text.length ? trackPx : 0));
    const cw = Math.ceil(tw + pad * 2);
    const ch = Math.ceil(this.opts.size * os * (asc + desc) + pad * 2);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.tex.dispose();
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.font = this.fontString();
    (ctx as any).letterSpacing = `${trackPx}px`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, pad, pad + this.opts.size * os * asc);
    this.tex.needsUpdate = true;
    this.width = cw / os;
    this.height = ch / os;
    this.mesh.scale.set(this.width, this.height, 1);
    this.pad = pad / os;
    return this;
  }

  pad = 0;

  /** Place by the text's left baseline-box corner in centred y-up UI space. */
  at(x: number, y: number, z = 0) {
    const a = this.opts.align;
    const ox = a === 'left' ? this.width / 2 - this.pad : a === 'right' ? -this.width / 2 + this.pad : 0;
    this.mesh.position.set(x + ox, y, z);
    return this;
  }

  get u() {
    return this.mesh.material.uniforms;
  }

  opacity(v: number) {
    this.u.uOpacity.value = v;
    this.mesh.visible = v > 0.001;
    return this;
  }

  reveal(v: number) {
    this.u.uReveal.value = v * (1 + this.u.uSoft.value) - this.u.uSoft.value;
    return this;
  }

  rise(v: number) {
    this.u.uRise.value = v;
    return this;
  }

  color(c: Swatch | Color) {
    (this.u.uColor.value as Color).copy(c instanceof Color ? c : COL[c]);
    return this;
  }
}

/** Load the reel's two faces; abort loudly if either silently falls back. */
export async function loadFonts() {
  const faces = [
    new FontFace(FONT.display, 'url(/fonts/display.ttf)', { weight: '700' }),
    new FontFace(FONT.mono, 'url(/fonts/mono-500.woff2)', { weight: '500' }),
    new FontFace(FONT.mono, 'url(/fonts/mono-400.woff2)', { weight: '400' }),
    new FontFace(FONT.mono, 'url(/fonts/mono-700.woff2)', { weight: '700' }),
  ];
  for (const f of faces) {
    await f.load();
    document.fonts.add(f);
  }
  await document.fonts.ready;
  const c = document.createElement('canvas').getContext('2d')!;
  const probe = 'CAMBIUM 0123456789';
  c.font = `700 40px "${FONT.display}"`;
  const dw = c.measureText(probe).width;
  c.font = '700 40px sans-serif';
  const fw = c.measureText(probe).width;
  c.font = `500 40px "${FONT.mono}"`;
  const mw = c.measureText(probe).width;
  c.font = '500 40px serif';
  const sw = c.measureText(probe).width;
  if (!document.fonts.check(`700 40px "${FONT.display}"`) || Math.abs(dw - fw) < 1 || Math.abs(mw - sw) < 1) {
    throw new Error(`font self-test failed: display=${dw} fallback=${fw} mono=${mw}`);
  }
}

/**
 * A static Canvas2D drawing (ruler, panel chrome, icons) as a sprite with the
 * same reveal/rise/opacity uniforms as text. `paint` draws in UI px; the
 * canvas is oversampled for crispness.
 */
export class PaintSprite {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly width: number;
  readonly height: number;
  constructor(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void, oversample = 2, color: Swatch | Color = new Color(1, 1, 1)) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * oversample);
    canvas.height = Math.ceil(h * oversample);
    const c = canvas.getContext('2d')!;
    c.scale(oversample, oversample);
    paint(c);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    const mat = new ShaderMaterial({
      uniforms: {
        map: { value: tex },
        uColor: { value: (color instanceof Color ? color : COL[color]).clone() },
        uOpacity: { value: 1 },
        uReveal: { value: 1.2 },
        uRise: { value: 0 },
        uSoft: { value: 0.04 },
      },
      vertexShader: vert,
      fragmentShader: paintFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    mat.blending = 5;
    mat.blendSrc = 201;
    mat.blendDst = 205;
    this.mesh = new Mesh(new PlaneGeometry(w, h), mat);
    this.mesh.renderOrder = 9;
    this.width = w;
    this.height = h;
  }
  get u() {
    return this.mesh.material.uniforms;
  }
  opacity(v: number) {
    this.u.uOpacity.value = v;
    this.mesh.visible = v > 0.001;
    return this;
  }
  reveal(v: number) {
    this.u.uReveal.value = v * (1 + this.u.uSoft.value) - this.u.uSoft.value;
    return this;
  }
}

// Paint sprites keep their own colours (canvas RGB, sRGB) and are tinted by uColor.
const paintFrag = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uRise;
  uniform float uSoft;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    uv.y -= uRise;
    if (uv.y < 0.0 || uv.y > 1.0) discard;
    vec4 t = texture2D(map, uv);
    float edge = smoothstep(uReveal + uSoft, uReveal, vUv.x);
    float a = t.a * edge * uOpacity;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(t.rgb * uColor * a, a);
  }
`;
