// Deliverable checks: container/stream spec, exact frame count, colour tags,
// faststart, loudness, strobe safety, and determinism manifests when present.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cutSpec } from '../src/cuts/spec.ts';

const argv = process.argv.slice(2);
const cut = cutSpec(argv.includes('--cut') ? argv[argv.indexOf('--cut') + 1] : undefined);
const OUT = cut.id === 'reel' ? join(resolve(import.meta.dir, '..'), 'out') : join(resolve(import.meta.dir, '..'), 'out', cut.id);
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--cut');
const file = positional[0] ?? join(OUT, `${cut.stem}.mp4`);
const SECS = cut.total / 60;
let failures = 0;
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

const probe = (args: string[]) => JSON.parse(Bun.spawnSync(['ffprobe', '-v', 'error', '-of', 'json', ...args, file]).stdout.toString());

const v = probe(['-count_frames', '-select_streams', 'v:0', '-show_entries',
  'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,color_primaries,color_transfer,color_space,color_range']).streams[0];
check(v.codec_name === 'h264' && v.profile === 'High', 'video h264 High', `${v.codec_name} ${v.profile}`);
check(v.width === 1920 && v.height === 1080, '1920x1080', `${v.width}x${v.height}`);
check(v.pix_fmt === 'yuv420p', 'yuv420p', v.pix_fmt);
check(v.r_frame_rate === '60/1', '60 fps', v.r_frame_rate);
check(Number(v.nb_read_frames) === cut.total, `${cut.total} frames`, v.nb_read_frames);
check(v.color_primaries === 'bt709' && v.color_transfer === 'bt709' && v.color_space === 'bt709' && v.color_range === 'tv', 'bt709 tv tags',
  `${v.color_primaries}/${v.color_transfer}/${v.color_space}/${v.color_range}`);

const a = probe(['-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels']).streams[0];
check(a?.codec_name === 'aac' && a.sample_rate === '48000' && a.channels === 2, 'audio aac 48k stereo', a ? `${a.codec_name} ${a.sample_rate} ${a.channels}ch` : 'none');

const fmt = probe(['-show_entries', 'format=duration']).format;
check(Math.abs(Number(fmt.duration) - SECS) <= 1 / 60 + 0.03, `duration ${SECS.toFixed(3)} s`, fmt.duration);

// faststart: moov box must precede mdat
const head = readFileSync(file).subarray(0, 1 << 20).toString('latin1');
const moov = head.indexOf('moov');
const mdat = head.indexOf('mdat');
check(moov >= 0 && (mdat < 0 || moov < mdat), 'faststart (moov before mdat)', `moov@${moov} mdat@${mdat}`);

// loudness
const lo = Bun.spawnSync(['ffmpeg', '-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stderr: 'pipe' }).stderr.toString();
const I = Number(lo.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop()?.match(/-?[\d.]+/)?.[0]);
const TP = Number(lo.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop()?.match(/-?[\d.]+/)?.[0]);
check(Math.abs(I + 14) <= 1, 'integrated -14 ±1 LUFS', `${I}`);
check(TP <= -1, 'true peak <= -1 dBTP', `${TP}`);
const st = Bun.spawnSync(['ffmpeg', '-hide_banner', '-nostats', '-i', file, '-af', 'astats=metadata=0', '-f', 'null', '-'], { stderr: 'pipe' }).stderr.toString();
const dc = Math.max(...[...st.matchAll(/DC offset:\s+(-?[\d.]+)/g)].map((m) => Math.abs(Number(m[1]))));
check(dc < 0.001, 'no DC offset', `${dc}`);

// strobe safety: no full-frame luma jump > 20% within 3 frames
const sig = [...Bun.spawnSync(['ffmpeg', '-hide_banner', '-v', 'error', '-i', file, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'])
  .stdout.toString().matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
check(sig.length === cut.total, 'luma samples for every frame', String(sig.length));
let maxJump = 0;
for (let i = 3; i < sig.length; i++) maxJump = Math.max(maxJump, Math.abs(sig[i] - sig[i - 3]));
check(maxJump / 219 < 0.2, 'no strobe (luma jump < 20% / 3 frames)', `${((maxJump / 219) * 100).toFixed(1)}%`);

// determinism
const runs = ['a', 'b', 'shuffle'].map((t) => join(OUT, `hashes-${t}.json`)).filter(existsSync);
if (runs.length >= 2) {
  const ref = JSON.parse(readFileSync(runs[0], 'utf8'));
  for (const r of runs.slice(1)) {
    const other = JSON.parse(readFileSync(r, 'utf8'));
    const keys = Object.keys(ref);
    const diff = keys.filter((k) => ref[k] !== other[k]);
    check(diff.length === 0 && keys.length === Object.keys(other).length, `deterministic vs ${r.split('/').pop()}`, `${keys.length} frames, ${diff.length} differ`);
  }
} else console.log('SKIP  determinism (run render --hash a / --hash b / --hash shuffle --shuffle)');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
