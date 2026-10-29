// Resumable render for long cuts: the frame range is split into segments
// (default 10 s), each rendered by tools/render.ts with retries, then joined
// losslessly. Frames are a pure function of their number, so a resumed or
// retried segment is byte-identical to an uninterrupted run.
//
//   bun tools/render-segments.ts --cut long                 -> out/long/video.mp4
//   bun tools/render-segments.ts --cut long --hash a --fresh -> out/long/hashes-a.json
//   bun tools/render-segments.ts --cut long --hash shuffle --shuffle
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cutSpec } from '../src/cuts/spec.ts';

const APP = resolve(import.meta.dir, '..');
const args = process.argv.slice(2);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const flag = (n: string) => args.includes(n);
const cut = cutSpec(opt('--cut'));
const OUT = cut.id === 'reel' ? join(APP, 'out') : join(APP, 'out', cut.id);
const SEG = Number(opt('--seg') ?? 600);
const hashTag = opt('--hash');
const segDir = join(OUT, 'segments');
const ATTEMPTS = 5;
mkdirSync(segDir, { recursive: true });

const segments: [number, number][] = [];
for (let a = 0; a < cut.total; a += SEG) segments.push([a, Math.min(cut.total, a + SEG) - 1]);

function frameCount(file: string) {
  const p = Bun.spawnSync(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]);
  return Number(p.stdout.toString().trim() || 0);
}

async function run(cmd: string[]) {
  const p = Bun.spawn(cmd, { cwd: APP, stdout: 'pipe', stderr: 'pipe' });
  const out = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  return { code: await p.exited, out };
}

if (hashTag) {
  const hp = join(OUT, `hashes-${hashTag}.json`);
  if (flag('--restart')) rmSync(hp, { force: true });
  const have = existsSync(hp) ? JSON.parse(await Bun.file(hp).text()) : {};
  for (const [i, [a, b]] of segments.entries()) {
    if (Object.hasOwn(have, String(b)) && Object.hasOwn(have, String(a))) continue;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const extra = [...(flag('--shuffle') ? ['--shuffle'] : []), ...(flag('--fresh') && i === 0 && attempt === 1 ? ['--fresh'] : [])];
      const r = await run(['bun', 'tools/render.ts', '--cut', cut.id, '--frames', `${a}-${b}`, '--hash', hashTag, '--merge', ...extra]);
      if (r.code === 0) {
        console.log(`hash ${hashTag}: segment ${i + 1}/${segments.length} (${a}-${b}) ok`);
        break;
      }
      console.log(`hash ${hashTag}: segment ${i + 1} attempt ${attempt} failed: ${r.out.split('\n').filter((l) => /failed|stalled|boot/.test(l)).pop() ?? 'unknown'}`);
      if (attempt === ATTEMPTS) process.exit(1);
      await Bun.sleep(30_000); // back off: shared-machine load spikes pass
    }
  }
  const all = JSON.parse(await Bun.file(hp).text());
  console.log(`hash ${hashTag}: ${Object.keys(all).length}/${cut.total} frames`);
  process.exit(Object.keys(all).length === cut.total ? 0 : 1);
}

const files: string[] = [];
for (const [i, [a, b]] of segments.entries()) {
  const file = join(segDir, `seg-${String(i).padStart(3, '0')}.mp4`);
  files.push(file);
  if (existsSync(file) && frameCount(file) === b - a + 1) continue;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const r = await run(['bun', 'tools/render.ts', '--cut', cut.id, '--frames', `${a}-${b}`, '--out', file]);
    if (r.code === 0 && frameCount(file) === b - a + 1) {
      console.log(`segment ${i + 1}/${segments.length} (${a}-${b}) ok`);
      break;
    }
    console.log(`segment ${i + 1} attempt ${attempt} failed: ${r.out.split('\n').filter((l) => /failed|stalled|boot/.test(l)).pop() ?? 'frame count mismatch'}`);
    rmSync(file, { force: true });
    if (attempt === ATTEMPTS) process.exit(1);
    await Bun.sleep(30_000); // back off: shared-machine load spikes pass
  }
}

// lossless join: every segment shares encoder settings and starts on an IDR
const list = join(segDir, 'concat.txt');
writeFileSync(list, files.map((f) => `file '${f}'`).join('\n') + '\n');
const out = join(OUT, 'video.mp4');
const j = Bun.spawnSync(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', '-fflags', '+bitexact', '-map_metadata', '-1', out]);
if (j.exitCode !== 0) throw new Error(j.stderr.toString());
const n = frameCount(out);
console.log(`joined ${files.length} segments -> ${out.slice(APP.length + 1)} (${n}/${cut.total} frames)`);
process.exit(n === cut.total ? 0 : 1);
