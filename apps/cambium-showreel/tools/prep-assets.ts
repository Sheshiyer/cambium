// Offline matting for the R3F specimen renders (gray studio background).
// Runs in bun with ffmpeg doing PNG decode/encode, so the browser never does
// canvas readback (immune to Brave shields) and results are deterministic.
//
// Model: per-channel radial background  bg(r) = a + b*r^2, fitted on the
// border ring. Objectness = colour distance from bg(r) or saturation. Then
// open/close, fill only *small* enclosed holes (cortex ring gaps stay open),
// soft rim alpha so contact shadows fade, and colour decontamination.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP = resolve(import.meta.dir, '..');
const SRC = resolve(APP, '../../docs/assets/visual-flow');
const OUT = join(APP, 'out/mattes');
const DBG = join(APP, 'out/debug');
mkdirSync(OUT, { recursive: true });
mkdirSync(DBG, { recursive: true });

export const SPECIMENS: Record<string, string> = {
  genesis: '1078--r3f--genesis.png',
  taste: '1097--r3f--taste.png',
  build: '1088--r3f--build.png',
  ops: '1093--r3f--ops.png',
  cortex: '1090--r3f--cortex.png',
  'rail-arc': '1079--r3f--rail-arc.png',
  'signal-packet': '1096--r3f--signal-packet.png',
  'emitter-node': '1091--r3f--emitter-node.png',
  'process-beacon': '1094--r3f--process-beacon.png',
  'control-dial': '1089--r3f--control-dial.png',
  'visualization-lens': '1098--r3f--visualization-lens.png',
};

async function decode(path: string) {
  const p = Bun.spawn(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdout: 'pipe' });
  const buf = new Uint8Array(await new Response(p.stdout).arrayBuffer());
  await p.exited;
  const probe = Bun.spawnSync(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path]);
  const [w, h] = probe.stdout.toString().trim().split(',').map(Number);
  return { w, h, rgb: buf };
}

async function encodePng(path: string, w: number, h: number, rgba: Uint8Array) {
  const p = Bun.spawn(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', path], { stdin: 'pipe' });
  p.stdin.write(rgba);
  await p.stdin.end();
  await p.exited;
}

function fitRadial(rgb: Uint8Array, w: number, h: number, ring: number) {
  // least squares per channel on border pixels: v = a + b*r2
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(cx, cy);
  const acc = [0, 1, 2].map(() => ({ n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
      const r2 = ((x - cx) ** 2 + (y - cy) ** 2) / (R * R);
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v = rgb[i + c];
        const a = acc[c];
        a.n++;
        a.sx += r2;
        a.sy += v;
        a.sxx += r2 * r2;
        a.sxy += r2 * v;
      }
    }
  }
  return acc.map((a) => {
    const b = (a.n * a.sxy - a.sx * a.sy) / (a.n * a.sxx - a.sx * a.sx);
    const a0 = (a.sy - b * a.sx) / a.n;
    return { a: a0, b };
  });
}

function morph(src: Uint8Array, w: number, h: number, r: number, dilate: boolean) {
  // separable square structuring element
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const s = src[y * w + xx];
        if (dilate ? s : !s) {
          v = dilate ? 1 : 0;
          break;
        }
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const s = tmp[yy * w + x];
        if (dilate ? s : !s) {
          v = dilate ? 1 : 0;
          break;
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function components(mask: Uint8Array, w: number, h: number, value: number) {
  const label = new Int32Array(mask.length).fill(-1);
  const comps: { area: number; border: boolean }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== value || label[i] >= 0) continue;
    const id = comps.length;
    const comp = { area: 0, border: false };
    comps.push(comp);
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      comp.area++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) comp.border = true;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q >= 0 && mask[q] === value && label[q] < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
  }
  return { label, comps };
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  }
  return out;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function matte(name: string, file: string) {
  const { w, h, rgb } = await decode(join(SRC, file));
  const fit = fitRadial(rgb, w, h, 18);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(cx, cy);
  const N = w * h;
  const dist = new Float32Array(N);
  const bgc = new Float32Array(N * 3);
  const hard = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const r2 = ((x - cx) ** 2 + (y - cy) ** 2) / (R * R);
      let d2 = 0;
      let mx = 0;
      let mn = 255;
      for (let c = 0; c < 3; c++) {
        const b = fit[c].a + fit[c].b * r2;
        bgc[p * 3 + c] = b;
        const v = rgb[p * 3 + c];
        d2 += (v - b) ** 2;
        mx = Math.max(mx, v);
        mn = Math.min(mn, v);
      }
      const d = Math.sqrt(d2);
      const sat = mx - mn;
      dist[p] = Math.max(d, sat * 1.4);
      hard[p] = dist[p] > 11 ? 1 : 0;
    }
  }
  // open (despeckle) then close (seal hairline cracks)
  let m = morph(morph(hard, w, h, 1, false), w, h, 1, true);
  m = morph(morph(m, w, h, 2, true), w, h, 2, false);
  // fill small enclosed background holes, drop small foreground specks
  const holes = components(m, w, h, 0);
  for (let i = 0; i < N; i++) {
    const c = holes.comps[holes.label[i]];
    if (m[i] === 0 && c && !c.border && c.area < 1800) m[i] = 1;
  }
  const specks = components(m, w, h, 1);
  for (let i = 0; i < N; i++) {
    const c = specks.comps[specks.label[i]];
    if (m[i] === 1 && c && c.area < 600) m[i] = 0;
  }
  const interior = morph(m, w, h, 7, false);
  const mf = new Float32Array(N);
  for (let i = 0; i < N; i++) mf[i] = m[i];
  const soft = boxBlur(boxBlur(mf, w, h, 1), w, h, 1);
  const rgba = new Uint8Array(N * 4);
  const check = new Uint8Array(N * 4);
  for (let p = 0; p < N; p++) {
    // rim pixels: low-contrast (shadow/AO) fades out, strong pixels stay solid
    let a = interior[p] ? 1 : Math.min(soft[p], Math.max(smooth(11, 42, dist[p]), interior[p]));
    if (a < 0.02) a = 0;
    for (let c = 0; c < 3; c++) {
      const C = rgb[p * 3 + c];
      const B = bgc[p * 3 + c];
      const F = a > 0.02 && a < 0.98 ? (C - (1 - a) * B) / a : C;
      rgba[p * 4 + c] = Math.max(0, Math.min(255, Math.round(F)));
    }
    rgba[p * 4 + 3] = Math.round(a * 255);
    // debug: composite over brand ink #00272B
    const ink = [0x00, 0x27, 0x2b];
    for (let c = 0; c < 3; c++) check[p * 4 + c] = Math.round(rgba[p * 4 + c] * a + ink[c] * (1 - a));
    check[p * 4 + 3] = 255;
  }
  await encodePng(join(OUT, `${name}.png`), w, h, rgba);
  await encodePng(join(DBG, `matte-${name}.png`), w, h, check);
  const bg0 = fit.map((f) => Math.round(f.a).toString(16).padStart(2, '0')).join('');
  console.log(`  ${name.padEnd(20)} bg centre #${bg0}  coverage ${(m.reduce((s, v) => s + v, 0) / N * 100).toFixed(1)}%`);
}

console.log('matting specimens ->', OUT);
for (const [name, file] of Object.entries(SPECIMENS)) await matte(name, file);

// contact sheet for eyeballing
const names = Object.keys(SPECIMENS);
const inputs = names.flatMap((n) => ['-i', join(DBG, `matte-${n}.png`)]);
const tiles = names.length;
const cols = 4;
const rows = Math.ceil(tiles / cols);
const filter =
  names.map((_, i) => `[${i}:v]scale=360:360[s${i}]`).join(';') +
  ';' +
  names.map((_, i) => `[s${i}]`).join('') +
  `xstack=inputs=${tiles}:layout=${names.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 360}`).join('|')}:fill=0x00272B`;
Bun.spawnSync(['ffmpeg', '-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', join(DBG, 'mattes-sheet.png')]);
console.log(`sheet: out/debug/mattes-sheet.png (${cols}x${rows})`);
