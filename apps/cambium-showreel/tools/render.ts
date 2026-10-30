// Headless capture: spawn Brave, let the page push raw RGBA frames to the local
// server, and stream them straight into ffmpeg. No Remotion, no Playwright.
//
//   bun tools/render.ts                       full 1920x1080@60 -> out/video.mp4
//   bun tools/render.ts --preview             960x540@30 -> out/preview.mp4
//   bun tools/render.ts --stills 0,120,450    PNG stills -> out/stills/
//   bun tools/render.ts --frames 300-509      partial range
//   bun tools/render.ts --hash tag [--shuffle] determinism manifest -> out/hashes-<tag>.json
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startServer } from './serve.ts';
import { cutSpec } from '../src/cuts/spec.ts';

const APP = resolve(import.meta.dir, '..');
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const cut = cutSpec(opt('--cut'));
const OUT = cut.id === 'reel' ? join(APP, 'out') : join(APP, 'out', cut.id);
const preview = flag('--preview');
const scale = preview ? 0.5 : Number(opt('--scale') ?? 1);
const step = preview ? 2 : 1;
const fps = 60 / step;
const W = Math.round(1920 * scale);
const H = Math.round(1080 * scale);
const stills = opt('--stills');
const hashTag = opt('--hash');
const shuffle = flag('--shuffle');
const dump = new Set((opt('--dump') ?? '').split(',').filter(Boolean).map(Number));
const outFile = opt('--out') ?? join(OUT, preview ? 'preview.mp4' : 'video.mp4');

let frames: number[] = [];
if (stills) frames = stills.split(',').map(Number);
else {
  const [a, b] = (opt('--frames') ?? `0-${cut.total - 1}`).split('-').map(Number);
  for (let f = a; f <= b; f += step) frames.push(f);
}
if (shuffle) {
  // deterministic shuffle so the run itself is reproducible
  let s = 1234567;
  for (let i = frames.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [frames[i], frames[j]] = [frames[j], frames[i]];
  }
}

mkdirSync(OUT, { recursive: true });
if (stills || dump.size) mkdirSync(join(OUT, 'stills'), { recursive: true });

function findBrowser() {
  const c = [
    process.env.REEL_BROWSER,
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean) as string[];
  const b = c.find((p) => existsSync(p));
  if (!b) throw new Error('No Chromium-family browser found; set REEL_BROWSER');
  return b;
}

// ---------------------------------------------------------------- ffmpeg sink
let ff: ReturnType<typeof Bun.spawn> | null = null;
const encodeMode = !stills && !hashTag;
if (encodeMode) {
  const codec = preview
    ? ['-c:v', 'h264_videotoolbox', '-b:v', '14M', '-profile:v', 'high']
    : ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(cut.crf ?? 14), '-tune', 'grain'];
  ff = Bun.spawn(
    [
      'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
      '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
      ...codec,
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', '-fflags', '+bitexact', '-map_metadata', '-1',
      outFile,
    ],
    { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit' },
  );
}

const hashes: Record<number, string> = {};
let booted = false;
// patience on shared machines: boot / stall windows in seconds (env-overridable)
const BOOT_S = Number(process.env.REEL_BOOT_TIMEOUT ?? 300);
const STALL_S = Number(process.env.REEL_STALL_TIMEOUT ?? 180);
let lastFrameAt = 0;
let bootAt = 0;
let received = 0;
const t0 = performance.now();
let expect = frames.slice();
let finish!: () => void;
let fail!: (e: Error) => void;
const done = new Promise<void>((res, rej) => {
  finish = res;
  fail = rej;
});

async function writeStill(f: number, data: Uint8Array) {
  const p = Bun.spawn(
    [
      'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-',
      '-vf', 'vflip', '-frames:v', '1', join(OUT, 'stills', `f${String(f).padStart(4, '0')}.png`),
    ],
    { stdin: 'pipe' },
  );
  p.stdin.write(data);
  await p.stdin.end();
  await p.exited;
}

const server = startServer({
  async onFrame(f, data) {
    if (data.length !== W * H * 4) throw new Error(`frame ${f}: got ${data.length} bytes`);
    if (expect[received] !== f) throw new Error(`out-of-order frame ${f}, expected ${expect[received]}`);
    received++;
    lastFrameAt = performance.now();
    if (hashTag) hashes[f] = new Bun.CryptoHasher('sha256').update(data).digest('hex');
    if (stills || dump.has(f)) await writeStill(f, data);
    if (ff) {
      (ff.stdin as any).write(data);
      await (ff.stdin as any).flush?.();
    }
    if (received % 60 === 0 || received === frames.length) {
      const s = (performance.now() - t0) / 1000;
      console.log(`  ${received}/${frames.length} frames  ${(s / received * 1000).toFixed(0)} ms/frame`);
    }
  },
  onDone: () => finish(),
  onError: (m) => fail(new Error(m)),
  onLog: (m) => {
    if (!booted) bootAt = performance.now();
    booted = true;
    console.log('[page]', m);
  },
  frames,
});

const q = new URLSearchParams({ render: '1', cut: cut.id, scale: String(scale) });
const url = `http://127.0.0.1:${server.port}/?${q}`;
const profile = join(APP, 'out', '.profile');
if (flag('--fresh')) rmSync(profile, { recursive: true, force: true });
const browser = Bun.spawn(
  [
    findBrowser(),
    '--headless',
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
    '--disable-accelerated-2d-canvas', // CPU canvas raster: deterministic text textures
    '--force-color-profile=srgb',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--hide-scrollbars',
    `--window-size=${W},${H}`,
    `--user-data-dir=${profile}`,
    url,
  ],
  { stdout: 'ignore', stderr: process.env.REEL_DEBUG ? 'inherit' : 'ignore' },
);

console.log(`render: ${frames.length} frames @ ${W}x${H} (${fps}fps) -> ${stills ? 'stills' : hashTag ? 'hash manifest' : outFile}`);
// generous ceiling: ~1 s per frame, never under 20 min (shared machines can be slow)
const timeout = setTimeout(() => fail(new Error('render timed out')), Math.max(20 * 60, frames.length) * 1000);
// watchdog: a page that never reports has not booted; fail fast instead of waiting out the render
const watchdog = setTimeout(() => {
  if (!booted) fail(new Error(`page did not boot within ${BOOT_S} s`));
}, BOOT_S * 1000);
// stall watchdog: a booted page that stops delivering frames has died quietly
const stall = setInterval(() => {
  const since = performance.now() - (lastFrameAt || bootAt);
  if (booted && since > STALL_S * 1000) fail(new Error(`stalled: no frame for ${(since / 1000).toFixed(0)} s after ${received} frames`));
}, 5_000);
try {
  await done;
} catch (e) {
  console.error('render failed:', (e as Error).message);
  clearInterval(stall);
  browser.kill(9);
  ff?.kill();
  server.stop(true);
  process.exit(1);
}
clearTimeout(timeout);
clearTimeout(watchdog);
clearInterval(stall);
browser.kill();
if (ff) {
  await (ff.stdin as any).end();
  const encoderExit = await ff.exited;
  if (encoderExit !== 0) {
    console.error(`render failed: encoder exited ${encoderExit}`);
    server.stop(true);
    process.exit(encoderExit || 1);
  }
}
if (hashTag) {
  // --merge accumulates segment manifests into one file
  const hp = join(OUT, `hashes-${hashTag}.json`);
  const prev = flag('--merge') && existsSync(hp) ? JSON.parse(await Bun.file(hp).text()) : {};
  await Bun.write(hp, JSON.stringify({ ...prev, ...hashes }, null, 0));
}
server.stop(true);
const secs = ((performance.now() - t0) / 1000).toFixed(1);
console.log(`done in ${secs}s (${received} frames)`);
process.exit(0);
