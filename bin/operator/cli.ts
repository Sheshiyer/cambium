#!/usr/bin/env node
// Cambium · the infinite-game operator CLI. Node v26 runs this .ts natively.
//   node bin/operator/cli.ts demo      — run a sample stream of moves
//   node bin/operator/cli.ts wake '{"id":"x","kind":"tweak"}'
//   node bin/operator/cli.ts state     — print the world-state
// Contract: INFINITE-GAME.md   ·   Onboarding: ONBOARDING-OCTALYSIS.md

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld } from './world.ts';
import { wake } from './operator.ts';
import type { WorldState, GameEvent, Decision } from './types.ts';
import { defaultCortex } from '../lib/cortex.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');   // the cambium repo root
const STATE_DIR = join(ROOT, '.operator');
const statePath = (tenant: string) => join(STATE_DIR, `${tenant}.world.json`);

function loadWorld(tenant: string): WorldState {
  const p = statePath(tenant);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  return createWorld({
    tenant,
    vision: 'turn complex requirements into coherent systems people can own',
    brand: { setpoint: [0, 0], label: 'founder-led systems studio', trustRegion: 0.25, coherence: 0.7 },
    business: { runwayDays: 120 },
  });
}
function saveWorld(w: WorldState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(w.tenant), JSON.stringify(w, null, 2));
}

function runWake(tenant: string, event: GameEvent): { decision: Decision } {
  const world = loadWorld(tenant);
  const cortex = defaultCortex(ROOT);              // the real ledger transport (deviations.jsonl)
  const { world: next, decision } = wake(world, event, { record: (l: string) => cortex.writeDeviation(l) });
  saveWorld(next);
  return { decision };
}

function fmt(d: Decision): string {
  const margins = d.viability.margins.map((m) => `${m.name}:${m.value.toFixed(2)}`).join(' ');
  return `  [${d.routing.class}${d.noesis ? ' · noesis' : ''}] ${d.action}` +
    `${d.setpointMoved ? ' ✓x*' : ''}${d.emergency ? ' ⚠' : ''}  margins{${margins}}`;
}

// a sample first-session stream (mirrors the Octalysis onboarding peaks)
const SAMPLE: GameEvent[] = [
  { id: '1·calling', kind: 'calling', drives: [1] },
  { id: '8·first-booster', kind: 'tweak', artifact: { id: 'cta', text: 'Bring the requirement.' } },
  { id: '16·reposition-no-ev', kind: 'reposition', direction: [0.3, 0.1], evidence: false },
  { id: '16·reposition-ev', kind: 'reposition', direction: [0.3, 0.1], evidence: true },
  { id: '15·redirect-intent', kind: 'redirect', intent: true, evidence: true, direction: [0.1, 0.2] },
  { id: '18·drift', kind: 'drift', drives: [8] },
];

const [cmd, ...rest] = process.argv.slice(2);
const tenant = process.env.TENANT || 'thoughtseed';

if (cmd === 'wake') {
  const event = JSON.parse(rest[0] ?? '{}') as GameEvent;
  console.log(`wake ${event.id ?? '?'} (${event.kind ?? '?'}):`);
  console.log(fmt(runWake(tenant, event).decision));
} else if (cmd === 'demo') {
  console.log(`operator demo · tenant=${tenant}  (state → .operator/${tenant}.world.json)\n`);
  for (const e of SAMPLE) {
    console.log(`#${e.id}`);
    console.log(fmt(runWake(tenant, e).decision));
  }
  console.log(`\nfinal version: ${loadWorld(tenant).version}`);
} else if (cmd === 'state') {
  console.log(JSON.stringify(loadWorld(tenant), null, 2));
} else {
  console.log('cambium operator — the infinite-game wake loop\n');
  console.log("usage:\n  node bin/operator/cli.ts demo");
  console.log("  node bin/operator/cli.ts wake '{\"id\":\"x\",\"kind\":\"tweak\"}'");
  console.log('  node bin/operator/cli.ts state');
  console.log('\ncontract: INFINITE-GAME.md   ·   onboarding: ONBOARDING-OCTALYSIS.md');
}
