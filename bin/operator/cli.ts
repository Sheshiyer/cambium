#!/usr/bin/env node
// Cambium · the infinite-game operator CLI. Node v26 runs this .ts natively.
//   demo                       run a sample stream of moves
//   wake '{"id":"x","kind":"tweak"}'
//   heartbeat                  one viability sweep
//   run [ms] [maxTicks]        the heartbeat daemon
//   onboard [--auto] [--restart]  the 20-step first session (ONBOARDING-OCTALYSIS.md)
//   icp ["positioning"]        ask the (real-ish) ICP-NPC (pains)
//   resonance ["positioning"]  the ICP gradient: pains + real cosine resonance (NIM embeddings)
//   state
// Contract: INFINITE-GAME.md  ·  Onboarding: ONBOARDING-OCTALYSIS.md
// Models: NVIDIA NIM (NVIDIA_API_KEY) → Kimi (KIMI_API_KEY); offline → deterministic stubs.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld } from './world.ts';
import { probeEvent, runHeartbeat } from './heartbeat.ts';
import { realIcp } from './npc.ts';
import { makeEmbedder, cosine } from './embed.ts';
import { resolveIcp, ensureSetpoint } from './resonance.ts';
import { wakeAsync } from './orchestrate.ts';
import { runOnboard } from './onboarding/run.ts';
import { sqliteCortex } from './cortex-sqlite.ts';
import { vectorizeCortex } from './vectorize-cortex.ts';
import type { WorldState, GameEvent, Decision } from './types.ts';
import type { CortexStore } from './cortex-memory.ts';
import { defaultCortex } from '../lib/cortex.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE_DIR = join(ROOT, '.operator');
const statePath = (tenant: string) => join(STATE_DIR, `${tenant}.world.json`);
const cortex = defaultCortex(ROOT);
const record = (l: string) => cortex.writeDeviation(l);
const embedder = makeEmbedder({ root: ROOT });           // real NIM if NVIDIA_API_KEY, else stub
let _cortexStore: CortexStore | null = null;
async function cortexStore(): Promise<CortexStore> {     // node:sqlite (B2) local · Vectorize (B3) prod, lazy
  if (_cortexStore) return _cortexStore;
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    try { const v = vectorizeCortex(); await v.init(); _cortexStore = v; return v; }       // production
    catch (e) { console.error(`cortex: Vectorize unavailable (${(e as Error).message}) → node:sqlite fallback`); }
  }
  _cortexStore = sqliteCortex({ path: join(STATE_DIR, 'cortex.db') });
  await _cortexStore.init();
  return _cortexStore;
}

function loadWorld(tenant: string): WorldState {
  const p = statePath(tenant);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  return createWorld({
    tenant,
    vision: 'turn complex requirements into coherent systems people can own',
    brand: { setpoint: [], label: 'founder-led systems studio, requirement to handoff', trustRegion: 0.25, coherence: 0.7 },
    business: { runwayDays: 120 },
  });
}
function saveWorld(w: WorldState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(w.tenant), JSON.stringify(w, null, 2));
}
async function runEvent(tenant: string, event: GameEvent): Promise<Decision> {
  const { world, decision } = await wakeAsync(loadWorld(tenant), event, { record, embedder, store: await cortexStore() });
  saveWorld(world);
  return decision;
}
function fmt(d: Decision): string {
  const m = d.viability.margins.map((x) => `${x.name}:${x.value.toFixed(2)}${x.warn ? '⚠' : ''}`).join(' ');
  return `  [${d.routing.class}${d.noesis ? ' · noesis' : ''}] ${d.action}` +
    `${d.setpointMoved ? ' ✓x*' : ''}${d.emergency ? ' 🛑' : ''}${d.recall ? ` ↺${d.recall.count}` : ''}  margins{${m}}`;
}

const SAMPLE: GameEvent[] = [
  { id: '1·calling', kind: 'calling', drives: [1] },
  { id: '8·first-booster', kind: 'tweak', artifact: { id: 'cta', text: 'Bring the requirement.' } },
  { id: '16·reposition-no-ev', kind: 'reposition', direction: [0.3, 0.1], evidence: false },
  { id: '16·reposition-ev', kind: 'reposition', direction: [0.3, 0.1], evidence: true },
  { id: '15·redirect-intent', kind: 'redirect', intent: true, evidence: true },
  { id: '18·drift', kind: 'drift', drives: [8] },
  { id: '♥·heartbeat', kind: 'probe' },
];

const [cmd, ...rest] = process.argv.slice(2);
const tenant = process.env.TENANT || 'thoughtseed';

if (cmd === 'wake') {
  const event = JSON.parse(rest[0] ?? '{}') as GameEvent;
  console.log(`wake ${event.id ?? '?'} (${event.kind ?? '?'}):`);
  console.log(fmt(await runEvent(tenant, event)));
} else if (cmd === 'demo') {
  console.log(`operator demo · tenant=${tenant} · embeddings=${embedder.source}(${embedder.dims}d)\n`);
  for (const e of SAMPLE) { console.log(`#${e.id}`); console.log(fmt(await runEvent(tenant, e))); }
  console.log(`\nfinal version: ${loadWorld(tenant).version}`);
} else if (cmd === 'heartbeat') {
  console.log('heartbeat:');
  console.log(fmt(await runEvent(tenant, probeEvent(1))));
} else if (cmd === 'run') {
  const intervalMs = Number(rest[0] ?? 2000);
  const maxTicks = rest[1] ? Number(rest[1]) : undefined;
  console.log(`operator running · tenant=${tenant} · every ${intervalMs}ms` + (maxTicks ? ` · ${maxTicks} ticks` : ' (Ctrl-C to stop)'));
  runHeartbeat({ intervalMs, maxTicks, deps: { record }, load: () => loadWorld(tenant), step: (w, d) => { saveWorld(w); console.log(fmt(d)); } });
} else if (cmd === 'icp') {
  const positioning = rest[0] ?? loadWorld(tenant).brand.label;
  const r = await realIcp(positioning);
  console.log(`ICP-NPC (${r.source}${r.via ? ' · ' + r.via : ''}) on "${positioning}":`);
  for (const p of r.pains) console.log(`  · ${p}`);
  console.log(`  → direction: ${r.directionLabel ?? '(vector)'}   ·   resonance(self): ${r.resonance}`);
  if (r.source === 'stub') console.log('  (offline stub — set NVIDIA_API_KEY or KIMI_API_KEY for a real model)');
} else if (cmd === 'resonance') {
  const base = loadWorld(tenant);
  if (rest[0]) base.brand.label = rest[0];
  const w = await ensureSetpoint(base, embedder);
  const r = await resolveIcp(w, { embedder });
  console.log(`ICP resonance (${r.source}${r.via ? ' · ' + r.via : ''} · embeddings=${embedder.source}/${r.dims}d) on "${w.brand.label}":`);
  (r.painVectors ?? []).forEach((pv, i) => console.log(`  · [rel ${cosine(w.brand.setpoint, pv).toFixed(2)}] ${r.pains[i]}`));
  console.log(`  → target: "${r.directionLabel}"   ·   resonance(cosine): ${r.resonance.toFixed(3)}   ·   ‖gradient‖=${Math.hypot(...r.direction).toFixed(2)}`);
} else if (cmd === 'onboard') {
  const auto = rest.includes('--auto');
  const restart = rest.includes('--restart');
  await runOnboard({ auto, restart, tenant, stateDir: STATE_DIR });
} else if (cmd === 'state') {
  const w = loadWorld(tenant);
  console.log(JSON.stringify({ ...w, brand: { ...w.brand, setpoint: `[${w.brand.setpoint.length}d vector]` } }, null, 2));
} else {
  console.log('cambium operator — the infinite-game wake loop\n');
  console.log('usage:');
  console.log('  node bin/operator/cli.ts demo');
  console.log("  node bin/operator/cli.ts wake '{\"id\":\"x\",\"kind\":\"tweak\"}'");
  console.log('  node bin/operator/cli.ts heartbeat              # one viability sweep');
  console.log('  node bin/operator/cli.ts run [ms] [maxTicks]    # the heartbeat daemon');
  console.log('  node bin/operator/cli.ts onboard [--auto]       # the 20-step first session');
  console.log('  node bin/operator/cli.ts icp ["positioning"]    # the ICP-NPC (pains)');
  console.log('  node bin/operator/cli.ts resonance ["pos"]      # pains + real cosine gradient (NIM)');
  console.log('  node bin/operator/cli.ts state');
  console.log('\ncontract: INFINITE-GAME.md   ·   models: NVIDIA NIM → Kimi → stub');
}
