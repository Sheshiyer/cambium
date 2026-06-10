#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Quine Engine — the mycelial CLI. One command surface threaded through everything we have.
//
// The mycelium is a network of HYPHAE (threads), each reaching into one subsystem and reading/writing
// it. The quine knows itself: `quine self` outputs the network's own structure. Node v26 native TS,
// zero-dep — it sits beside the cambium operator and imports it directly.
//
//   quine                          the map (default)
//   quine map                      the mycelial network — every hypha + what it connects to
//   quine status                   reachability of every hypha (parallel)
//   quine self                     the quine — the network describes its own structure
//   quine read  <hypha> <args…>    read through a hypha
//   quine write <hypha> <args…>    write through a hypha
//   quine <hypha> <args…>          shorthand for `read <hypha>`
//   quine help
// ════════════════════════════════════════════════════════════════════════════════════════════════

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Hypha, QuineCtx } from './types.ts';
import { cortex } from './hyphae/cortex.ts';
import { code } from './hyphae/code.ts';
import { operator } from './hyphae/operator.ts';
import { vault } from './hyphae/vault.ts';
import { github } from './hyphae/gh.ts';
import { cf } from './hyphae/cf.ts';
import { quests } from './hyphae/quests.ts';
import { skills } from './hyphae/skills.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');                                  // the cambium repo root
const VAULT = process.env.QUINE_VAULT || join(ROOT, '..', 'thoughtseed-labs');
const ctx: QuineCtx = { root: ROOT, vaultRoot: VAULT };

/** The mycelium — every hypha, keyed by name. Grow the network by adding a module here. */
const HYPHAE: Record<string, Hypha> = { cortex, code, operator, vault, gh: github, cf, quests, skills };

const out = (x: unknown) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 2));

function map() {
  return {
    quine: 'the mycelial network', root: ROOT, vault: VAULT,
    hyphae: Object.values(HYPHAE).map((h) => ({ name: h.name, describe: h.describe, writes: !!h.write })),
  };
}

async function status() {
  const rows = await Promise.all(Object.values(HYPHAE).map((h) =>
    h.status(ctx).catch((e) => ({ name: h.name, reachable: false, detail: String((e as Error).message ?? e) }))));
  return { quine: 'network status', reachable: rows.filter((r) => r.reachable).length + '/' + rows.length, hyphae: rows };
}

/** The quine: the network outputs a description of its own structure (verbs + hyphae). */
function self() {
  return {
    quine: 'I am the mycelial network. I read and write through hyphae.',
    verbs: ['map', 'status', 'self', 'read <hypha> <args>', 'write <hypha> <args>', '<hypha> <args>', 'help'],
    hyphae: Object.fromEntries(Object.values(HYPHAE).map((h) => [h.name, { describe: h.describe, help: h.help, writes: !!h.write }])),
  };
}

function helpText() {
  const rows = Object.values(HYPHAE).map((h) => `  ${h.name.padEnd(9)} ${h.describe}`).join('\n');
  return [
    'quine — the mycelial CLI. Threaded through everything we have.',
    '',
    'usage:',
    '  quine [map]                  the network',
    '  quine status                 reachability of every hypha',
    '  quine self                   the network describes itself',
    '  quine read  <hypha> <args>   read through a hypha',
    '  quine write <hypha> <args>   write through a hypha',
    '  quine <hypha> <args>         shorthand for read',
    '',
    'hyphae:',
    rows,
    '',
    'env: QUINE_VAULT (vault root) · QUINE_GH_REPO · CLOUDFLARE_API_TOKEN+ACCOUNT_ID (→ Vectorize) · NVIDIA_API_KEY (→ 1024-d)',
  ].join('\n');
}

async function run(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === 'map') return out(map());
  if (cmd === 'status') return out(await status());
  if (cmd === 'self' || cmd === 'quine') return out(self());
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return out(helpText());

  if (cmd === 'read' || cmd === 'write') {
    const h = HYPHAE[rest[0]];
    if (!h) { console.error(`quine: unknown hypha "${rest[0]}". Try: quine map`); process.exit(1); }
    if (cmd === 'write' && !h.write) { console.error(`quine: ${h.name} is read-only`); process.exit(1); }
    return out(await (cmd === 'read' ? h.read(rest.slice(1), ctx) : h.write!(rest.slice(1), ctx)));
  }

  if (HYPHAE[cmd]) return out(await HYPHAE[cmd].read(rest, ctx));   // shorthand: `quine cortex "<q>"`

  console.error(`quine: unknown command "${cmd}". Try: quine help`);
  process.exit(1);
}

run().catch((e) => { console.error('quine error:', (e as Error).message); process.exit(1); });
