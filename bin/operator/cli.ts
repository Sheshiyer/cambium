#!/usr/bin/env node
// Cambium · the infinite-game operator CLI. Node v26 runs this .ts natively.
//   node bin/operator/cli.ts demo                 — run a sample stream of moves
//   node bin/operator/cli.ts wake '{"id":"x","kind":"tweak"}'
//   node bin/operator/cli.ts heartbeat            — one viability sweep
//   node bin/operator/cli.ts run [ms] [maxTicks]  — the heartbeat daemon
//   node bin/operator/cli.ts icp ["positioning"]  — ask the (real-ish) ICP-NPC
//   node bin/operator/cli.ts state
// Contract: INFINITE-GAME.md   ·   Onboarding: ONBOARDING-OCTALYSIS.md

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld } from './world.ts';
import { wake } from './operator.ts';
import { probeEvent, runHeartbeat } from './heartbeat.ts';
import { realIcp } from './npc.ts';
import type { WorldState, GameEvent, Decision } from './types.ts';
import { defaultCortex } from '../lib/cortex.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');   // the cambium repo root
const STATE_DIR = join(ROOT, '.operator');
const statePath = (tenant: string) => join(STATE_DIR, `${tenant}.world.json`);
const cortex = defaultCortex(ROOT);                                       // the real ledger transport
const deps = { record: (l: string) => cortex.writeDeviation(l) };

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
function runWake(tenant: string, event: GameEvent): Decision {
  const { world, decision } = wake(loadWorld(tenant), event, deps);
  saveWorld(world);
  return decision;
}
function fmt(d: Decision): string {
  const margins = d.viability.margins.map((m) => `${m.name}:${m.value.toFixed(2)}${m.warn ? '⚠' : ''}`).join(' ');
  return `  [${d.routing.class}${d.noesis ? ' · noesis' : ''}] ${d.action}` +
    `${d.setpointMoved ? ' ✓x*' : ''}${d.emergency ? ' 🛑' : ''}  margins{${margins}}`;
}

// a sample first-session stream (mirrors the Octalysis onboarding peaks) + a heartbeat
const SAMPLE: GameEvent[] = [
  { id: '1·calling', kind: 'calling', drives: [1] },
  { id: '8·first-booster', kind: 'tweak', artifact: { id: 'cta', text: 'Bring the requirement.' } },
  { id: '16·reposition-no-ev', kind: 'reposition', direction: [0.3, 0.1], evidence: false },
  { id: '16·reposition-ev', kind: 'reposition', direction: [0.3, 0.1], evidence: true },
  { id: '15·redirect-intent', kind: 'redirect', intent: true, evidence: true, direction: [0.1, 0.2] },
  { id: '18·drift', kind: 'drift', drives: [8] },
  { id: '♥·heartbeat', kind: 'probe' },
];

const [cmd, ...rest] = process.argv.slice(2);
const tenant = process.env.TENANT || 'thoughtseed';

if (cmd === 'wake') {
  const event = JSON.parse(rest[0] ?? '{}') as GameEvent;
  console.log(`wake ${event.id ?? '?'} (${event.kind ?? '?'}):`);
  console.log(fmt(runWake(tenant, event)));
} else if (cmd === 'demo') {
  console.log(`operator demo · tenant=${tenant}  (state → .operator/${tenant}.world.json)\n`);
  for (const e of SAMPLE) { console.log(`#${e.id}`); console.log(fmt(runWake(tenant, e))); }
  console.log(`\nfinal version: ${loadWorld(tenant).version}`);
} else if (cmd === 'heartbeat') {
  console.log('heartbeat:');
  console.log(fmt(runWake(tenant, probeEvent(1))));
} else if (cmd === 'run') {
  const intervalMs = Number(rest[0] ?? 2000);
  const maxTicks = rest[1] ? Number(rest[1]) : undefined;
  console.log(`operator running · tenant=${tenant} · every ${intervalMs}ms` +
    (maxTicks ? ` · ${maxTicks} ticks` : ' (Ctrl-C to stop)'));
  runHeartbeat({ intervalMs, maxTicks, deps, load: () => loadWorld(tenant), step: (w, d) => { saveWorld(w); console.log(fmt(d)); } });
} else if (cmd === 'icp') {
  const positioning = rest[0] ?? loadWorld(tenant).brand.label;
  const r = await realIcp(positioning);
  console.log(`ICP-NPC (${r.source}${r.via ? ' · ' + r.via : ''}) on "${positioning}":`);
  for (const p of r.pains) console.log(`  · ${p}`);
  console.log(`  → direction: ${r.directionLabel ?? '(vector)'}   ·   resonance: ${r.resonance}`);
  if (r.source === 'stub') console.log('  (offline stub — set NVIDIA_API_KEY or KIMI_API_KEY for a real model)');
} else if (cmd === 'state') {
  console.log(JSON.stringify(loadWorld(tenant), null, 2));
} else {
  console.log('cambium operator — the infinite-game wake loop\n');
  console.log('usage:');
  console.log('  node bin/operator/cli.ts demo');
  console.log("  node bin/operator/cli.ts wake '{\"id\":\"x\",\"kind\":\"tweak\"}'");
  console.log('  node bin/operator/cli.ts heartbeat            # one viability sweep');
  console.log('  node bin/operator/cli.ts run [ms] [maxTicks]  # the heartbeat daemon');
  console.log('  node bin/operator/cli.ts icp ["positioning"]  # ask the real-ish ICP-NPC');
  console.log('  node bin/operator/cli.ts state');
  console.log('\ncontract: INFINITE-GAME.md   ·   onboarding: ONBOARDING-OCTALYSIS.md');
}
