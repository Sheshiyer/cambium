// Quine hypha · vault — the Obsidian knowledge vault. Read = grep the notes; write = append to the
// guarded agent-outputs zone (20-operations/agent-outputs/quine.md), honoring the vault write contract.

import { readFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag, positional } from '../types.ts';

const SKIP = new Set(['node_modules', '.git', '.obsidian', 'dist', 'build', '.astro', '.next', '.vercel']);

function markdownFiles(root: string, cap = 6000): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length && out.length < cap) {
    const dir = stack.pop()!;
    let entries: import('node:fs').Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.') { if (SKIP.has(e.name)) continue; }
      if (e.isDirectory()) { if (!SKIP.has(e.name)) stack.push(join(dir, e.name)); }
      else if (e.name.endsWith('.md')) out.push(join(dir, e.name));
    }
  }
  return out;
}

export const vault: Hypha = {
  name: 'vault',
  describe: 'the Obsidian knowledge vault — search notes (read) · append to the guarded quine zone (write)',
  help: 'quine read vault "<text>" [--limit 20]\n       quine write vault "<note>"   (→ 20-operations/agent-outputs/quine.md)',

  async status(ctx) {
    const ok = existsSync(ctx.vaultRoot);
    return { name: 'vault', reachable: ok, detail: ok ? ctx.vaultRoot : 'vault root not found (set QUINE_VAULT)' };
  },

  async read(args, ctx) {
    const q = positional(args).toLowerCase();
    const limit = Number(flag(args, '--limit', '20'));
    const files = markdownFiles(ctx.vaultRoot);
    const matches: { file: string; line: number; text: string }[] = [];
    for (const f of files) {
      let txt: string;
      try { txt = readFileSync(f, 'utf8'); } catch { continue; }
      const lines = txt.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (q && lines[i].toLowerCase().includes(q)) {
          matches.push({ file: relative(ctx.vaultRoot, f), line: i + 1, text: lines[i].trim().slice(0, 160) });
          if (matches.length >= limit) break;
        }
      }
      if (matches.length >= limit) break;
    }
    return { hypha: 'vault', query: q, scanned: files.length, matches };
  },

  async write(args, ctx) {
    const text = positional(args);
    const zone = join(ctx.vaultRoot, '20-operations', 'agent-outputs');
    mkdirSync(zone, { recursive: true });
    const path = join(zone, 'quine.md');
    appendFileSync(path, `\n- ${new Date().toISOString()} · ${text}`);
    return { hypha: 'vault', appended: relative(ctx.vaultRoot, path), text };
  },
};
