// cambium · scripts/onboard-live.ts — the self-onboarding driver (dogfood lane).
// Plays the 20-interaction first session for a tenant with REAL founder inputs:
// the content artifacts (#3 seed · #6 positioning · #14 cta) come from ONE live
// chat call grounded in the tenant's main-world brand DNA, and the two one-bit
// redirects (#8 · #15) are judged live by the Founder-NPC intent oracle
// (realFounder). Refuses to run on stubs — a key is a hard prerequisite.
// Additive driver: zero edits to bin/operator/*. Usage:
//   TENANT=cambium node scripts/onboard-live.ts

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { runOnboard } from '../bin/operator/onboarding/run.ts';
import { ONBOARDING_SCRIPT } from '../bin/operator/onboarding/script.ts';
import { realFounder } from '../bin/operator/npc.ts';
import { makeEmbedder } from '../bin/operator/embed.ts';
import { vectorizeCortex } from '../bin/operator/vectorize-cortex.ts';
import { sqliteCortex } from '../bin/operator/cortex-sqlite.ts';
import type { MemoryRecord } from '../bin/operator/cortex-memory.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TENANT = process.env.TENANT || 'cambium';

// Secrets are read IN-PROCESS from the founder env file — never sourced into a
// shell, never echoed. Only the names this driver needs are lifted.
function loadEnvFile(path: string, names: string[]): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (!names.includes(k) || process.env[k]) continue;
    process.env[k] = raw.replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(join(homedir(), '.claude', '.env'),
  ['NVIDIA_API_KEY', 'KIMI_API_KEY', 'MOONSHOT_API_KEY', 'CF_ACCOUNT_ID', 'CF_API_TOKEN']);
if (process.env.CF_ACCOUNT_ID && !process.env.CLOUDFLARE_ACCOUNT_ID) process.env.CLOUDFLARE_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
if (process.env.CF_API_TOKEN && !process.env.CLOUDFLARE_API_TOKEN) process.env.CLOUDFLARE_API_TOKEN = process.env.CF_API_TOKEN;

const NIM_KEY = process.env.NVIDIA_API_KEY ?? process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY;
if (!NIM_KEY) {
  console.error('onboard-live: no model API key found — refusing to run the first session on stubs.');
  process.exit(1);
}

// The tenant's REAL brand DNA comes from its main operator world (read-only).
const worldPath = join(ROOT, '.operator', `${TENANT}.world.json`);
const main = JSON.parse(readFileSync(worldPath, 'utf8'));
const dna = {
  vision: main.vision as string,
  label: main.brand.label as string,
  trustRegion: main.brand.trustRegion as number,
  coherence: main.brand.coherence as number,
  runwayDays: main.business.runwayDays as number,
  hero: (main.artifacts?.hero ?? '') as string,
};

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const KIMI_URL = 'https://api.moonshot.ai/v1/chat/completions';
const url = process.env.NVIDIA_API_KEY ? NVIDIA_URL : KIMI_URL;
const model = process.env.NVIDIA_API_KEY ? 'meta/llama-3.1-70b-instruct' : 'kimi-k2-0905-preview';

function parseLooseJson(text: string): any {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}

// ONE batched live call: the founder (the company itself, in its own voice)
// answers the three content slots of its first session.
async function founderContent(): Promise<{ seedIdea: string; positioningEdit: string; ctaWord: string; via: string }> {
  const system = 'You ARE the founder of this company, speaking in its own brand voice. Output ONLY one minified JSON object — no markdown, no fences, no prose.';
  const user =
    `Your company: ${dna.label}.\n` +
    `Vision (the Just Cause): "${dna.vision}". Hero line: "${dna.hero}".\n` +
    'You are playing your own onboarding — answer as yourself. Return:\n' +
    '{"seedIdea":"the raw thoughtseed — your company idea in ONE plain sentence (max 140 chars)",' +
    '"positioningEdit":"ONE founder edit of your positioning — one sharp sentence in your voice",' +
    '"ctaWord":"exactly ONE word — the call-to-action verb on your site"}';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${NIM_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0.5, max_tokens: 300,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    console.error(`onboard-live: live founder call failed (${res.status}) — refusing stubs.`);
    process.exit(1);
  }
  const data: any = await res.json();
  const json = parseLooseJson(data?.choices?.[0]?.message?.content ?? '');
  const ctaWord = String(json.ctaWord ?? '').trim().split(/\s+/)[0] || 'plant';
  return {
    seedIdea: String(json.seedIdea ?? '').trim(),
    positioningEdit: String(json.positioningEdit ?? '').trim(),
    ctaWord,
    via: `${url === NVIDIA_URL ? 'nvidia-nim' : 'kimi'}:${model}`,
  };
}

// Idempotent re-entry: an already-complete persisted session means the live
// answers are folded into the world — no new calls; replay panel + receipt only.
const sessionPath = join(ROOT, '.operator', `${TENANT}.onboarding.json`);
const saved = !process.env.RESTART && existsSync(sessionPath)
  ? JSON.parse(readFileSync(sessionPath, 'utf8'))
  : null;
const alreadyComplete = !!saved && saved.stepIndex >= 20;

// reroll = the founder bit was 'error'; absorb / goal-move = 'intent'.
const bitFromLog = (log: string[], n: number): 'error' | 'intent' =>
  log.find((l) => l.startsWith(`#${n} `))?.includes('reroll') ? 'error' : 'intent';

let content: { seedIdea: string; positioningEdit: string; ctaWord: string; via: string };
let bit8: 'error' | 'intent';
let bit15: 'error' | 'intent';

if (alreadyComplete) {
  const a = saved.world.artifacts ?? {};
  content = { seedIdea: a.seed ?? '', positioningEdit: a.positioning ?? '', ctaWord: a.cta ?? '', via: 'persisted (live answers folded in the completed session)' };
  bit8 = bitFromLog(saved.world.log ?? [], 8);
  bit15 = bitFromLog(saved.world.log ?? [], 15);
  console.log(`\n  founder answers · ${content.via}`);
} else {
  content = await founderContent();
  console.log(`\n  founder answers · live ${content.via}`);
}
console.log(`    #3 seed: ${content.seedIdea}`);
console.log(`    #6 positioning edit: ${content.positioningEdit}`);
console.log(`    #14 cta: ${content.ctaWord}`);

if (!alreadyComplete) {
  // The two one-bit redirects are judged by the Founder-NPC — the intent oracle
  // answering its OWN onboarding (the quine, literally).
  const ctx = { vision: dna.vision, mission: 'pursue the vision now' };
  const f8 = await realFounder(ONBOARDING_SCRIPT[7].event, ctx);
  const f15 = await realFounder(ONBOARDING_SCRIPT[14].event, ctx);
  const describe = (n: number, f: Awaited<ReturnType<typeof realFounder>>) =>
    `    #${n} founder-NPC: ${f.intentBit} (conf ${f.confidence}${f.rationale ? ` · "${f.rationale}"` : ''}) [${f.source}${f.via ? ` · ${f.via}` : ''}]`;
  console.log(describe(8, f8));
  console.log(describe(15, f15));
  if (f8.source !== 'llm' || f15.source !== 'llm') {
    console.error('onboard-live: founder oracle fell back to the stub — refusing a fake first session.');
    process.exit(1);
  }
  bit8 = f8.intentBit;
  bit15 = f15.intentBit;
} else {
  console.log(`    #8 founder bit: ${bit8!} · #15 founder bit: ${bit15!} (from the session log)`);
}

let redirectSeen = 0;
const input = async (prompt: string): Promise<string> => {
  if (prompt.includes('set seed?')) return content.seedIdea;
  if (prompt.includes('set positioning?')) return content.positioningEdit;
  if (prompt.includes('set cta?')) return content.ctaWord;
  if (prompt.includes('error or intent?')) {
    redirectSeen += 1;
    return (redirectSeen === 1 ? bit8 : bit15) === 'intent' ? 'i' : 'e';
  }
  return ''; // scripted brand-dna artifacts, Enter-to-continue, noesis holds
};

const state = await runOnboard({
  restart: !alreadyComplete,
  tenant: TENANT,
  seed: {
    tenant: TENANT,
    vision: dna.vision,
    brand: { setpoint: [0, 0], label: dna.label, trustRegion: dna.trustRegion, coherence: dna.coherence },
    business: { runwayDays: dna.runwayDays },
  },
  input,
  stateDir: join(ROOT, '.operator'),
});

const artifactsJson = JSON.stringify(state.world.artifacts);
const checks: Array<[string, boolean]> = [
  ['stepIndex === 20', state.stepIndex === 20],
  ['drives 8/8', state.drivesActivated.length === 8],
  ['noesis >= 3', state.noesisMoments >= 3],
  ['world version >= 20', state.world.version >= 20],
  ['vision is the real vision', state.world.vision === dna.vision],
  ['label is the real label', state.world.brand.label === dna.label],
  ['no placeholder artifacts', !artifactsJson.includes('<')],
];
console.log('\n  self-check:');
for (const [name, ok] of checks) console.log(`    ${ok ? '✓' : '✗'} ${name}`);
if (!checks.every(([, ok]) => ok)) process.exit(1);

// Cortex receipt: the operator remembers completing its own first session.
const embedder = makeEmbedder();
const summary =
  `tenant ${TENANT} completed its own 20-interaction first session with real founder inputs: ` +
  `seed="${content.seedIdea}" · positioning="${content.positioningEdit}" · cta="${content.ctaWord}" · ` +
  `#8=${bit8} · #15=${bit15} · drives 8/8 · noesis ${state.noesisMoments} · v${state.world.version}`;
const [vector] = await embedder.embed([summary]);
const rec: MemoryRecord = {
  id: `${TENANT}:onboarding:first-session-real`,
  kind: 'decision',
  tenant: TENANT,
  vector,
  payload: {
    summary, steps: 20, drives: state.drivesActivated,
    noesis: state.noesisMoments, version: state.world.version,
  },
  ts: Date.now(),
};
const wantVectorize = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) && vector.length === 1024;
let transport = wantVectorize ? 'vectorize' : 'sqlite';
try {
  const store = wantVectorize ? vectorizeCortex() : sqliteCortex({ path: join(ROOT, '.operator', 'cortex.db') });
  await store.init();
  await store.upsert(rec);
} catch (err) {
  if (!wantVectorize) throw err;
  transport = 'sqlite (vectorize failed → fallback)';
  const store = sqliteCortex({ path: join(ROOT, '.operator', 'cortex.db') });
  await store.init();
  await store.upsert(rec);
}
console.log(`\n  cortex receipt: upserted ${rec.id} · ${transport} · ${vector.length}d`);
console.log(`  session state: .operator/${TENANT}.onboarding.json`);
