// Quine hypha · operator — the cambium infinite-game wake loop. Read = the world-state; write = a move.
// Shells out to the operator CLI (reuse, don't reimplement) so quine stays a thin connective thread.

import { execFile } from 'node:child_process';
import { join } from 'node:path';
import type { Hypha } from '../types.ts';
import { positional } from '../types.ts';

function run(root: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('node', [join(root, 'bin/operator/cli.ts'), ...args], { cwd: root, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({ ok: !err, stdout: stdout ?? '', stderr: stderr ?? '' }));
  });
}

export const operator: Hypha = {
  name: 'operator',
  describe: 'the infinite-game wake loop — read the world-state, write a move',
  help: 'quine read operator            (the world-state)\n       quine write operator \'{"id":"x","kind":"tweak"}\'',

  async status(ctx) {
    const r = await run(ctx.root, ['state']);
    return { name: 'operator', reachable: r.ok, detail: r.ok ? 'wake loop reachable' : (r.stderr.trim().slice(0, 80) || 'unreachable') };
  },

  async read(_args, ctx) {
    const r = await run(ctx.root, ['state']);
    try { return { hypha: 'operator', state: JSON.parse(r.stdout) }; }
    catch { return { hypha: 'operator', raw: r.stdout.trim() || r.stderr.trim() }; }
  },

  async write(args, ctx) {
    const event = args.find((a) => a.trim().startsWith('{')) ?? positional(args) ?? '{}';
    const r = await run(ctx.root, ['wake', event]);
    return { hypha: 'operator', wrote: event, decision: (r.stdout.trim() || r.stderr.trim()) };
  },
};
