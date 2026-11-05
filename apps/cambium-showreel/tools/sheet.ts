// Contact sheet from rendered stills: bun tools/sheet.ts <dir> <out.png> <f1,f2,...> [cols]
import { join } from 'node:path';

const [dir, out, list, colsArg] = process.argv.slice(2);
const frames = list.split(',').map(Number);
const cols = Number(colsArg ?? 3);
const w = 640;
const h = 360;
const inputs = frames.flatMap((f) => ['-i', join(dir, `f${String(f).padStart(4, '0')}.png`)]);
const fc =
  frames.map((_, i) => `[${i}:v]scale=${w}:${h}[s${i}]`).join(';') +
  ';' +
  frames.map((_, i) => `[s${i}]`).join('') +
  `xstack=inputs=${frames.length}:layout=${frames.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|')}:fill=black`;
const p = Bun.spawnSync(['ffmpeg', '-v', 'error', '-y', ...inputs, '-filter_complex', fc, '-frames:v', '1', out]);
if (p.exitCode !== 0) throw new Error(p.stderr.toString());
console.log(`sheet: ${out}`);
