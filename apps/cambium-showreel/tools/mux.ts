// Mux picture + synthesized audio into the deliverable, then copy it to
// ~/Downloads for preview. Bit-exact flags keep repeat runs byte-identical.
import { copyFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { cutSpec } from '../src/cuts/spec.ts';

const argv = process.argv.slice(2);
const cut = cutSpec(argv.includes('--cut') ? argv[argv.indexOf('--cut') + 1] : undefined);
const OUT = cut.id === 'reel' ? join(resolve(import.meta.dir, '..'), 'out') : join(resolve(import.meta.dir, '..'), 'out', cut.id);
const video = join(OUT, 'video.mp4');
const audio = join(OUT, 'audio.wav');
const final = join(OUT, `${cut.stem}.mp4`);
for (const p of [video, audio]) if (!existsSync(p)) throw new Error(`missing ${p} — run render and audio first`);

const p = Bun.spawnSync([
  'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
  '-i', video, '-i', audio,
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
  '-movflags', '+faststart', '-fflags', '+bitexact', '-map_metadata', '-1',
  '-t', String(cut.total / 60),
  final,
]);
if (p.exitCode !== 0) throw new Error(p.stderr.toString());
const dest = join(homedir(), 'Downloads', `${cut.stem}.mp4`);
copyFileSync(final, dest);
console.log(`muxed: ${cut.stem}.mp4 -> ~/Downloads/${cut.stem}.mp4`);

// lighter share copy (Telegram / web): same picture, CRF 21; audio encoded
// from the WAV source (an AAC->AAC transcode would push true peak over -1 dBTP)
const web = join(OUT, `${cut.stem}-web.mp4`);
const w = Bun.spawnSync([
  'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
  '-i', final, '-i', audio,
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '21', '-tune', 'grain',
  ...(cut.webMaxrate ? ['-maxrate', cut.webMaxrate, '-bufsize', String(parseInt(cut.webMaxrate) * 2) + 'M'] : []),
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(cut.total / 60),
  '-movflags', '+faststart', '-fflags', '+bitexact', '-map_metadata', '-1',
  web,
]);
if (w.exitCode !== 0) throw new Error(w.stderr.toString());
copyFileSync(web, join(homedir(), 'Downloads', `${cut.stem}-web.mp4`));
console.log(`web copy: ${cut.stem}-web.mp4 -> ~/Downloads/${cut.stem}-web.mp4`);

// phone-sized share copy for long cuts: 720p, kept under 30 MiB so it can be
// sent to any device (the full-quality files stay the masters)
if (cut.id === 'long') {
  const share = join(OUT, `${cut.stem}-720p.mp4`);
  const kbps = Math.floor((28 * 1024 * 8) / (cut.total / 60)) - 160; // ~28 MiB budget minus audio
  const s = Bun.spawnSync([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-i', final, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-vf', 'scale=1280:720:flags=lanczos',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-tune', 'film',
    '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.4)}k`, '-bufsize', `${kbps * 3}k`,
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-t', String(cut.total / 60),
    '-movflags', '+faststart', '-fflags', '+bitexact', '-map_metadata', '-1',
    share,
  ]);
  if (s.exitCode !== 0) throw new Error(s.stderr.toString());
  copyFileSync(share, join(homedir(), 'Downloads', `${cut.stem}-720p.mp4`));
  console.log(`share copy: ${cut.stem}-720p.mp4 (${(Bun.file(share).size / 1048576).toFixed(1)} MiB) -> ~/Downloads`);
}
