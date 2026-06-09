// Cambium operator · the two meso NPCs — self-play, grounded by reality (INFINITE-GAME.md §8).
// STUBS by default (deterministic, no model). The contract is what matters: they PROPOSE
// (pain-vectors, a resonance direction, an intent reading) but may not COMMIT — every setpoint
// move still needs REAL evidence + the gate (anti-echo-chamber).
//
// The real-ish ICP calls a real model — NVIDIA NIM (the cortex provider) preferred, Kimi/Moonshot
// fallback — and fails soft to the deterministic stub offline / on any error. Zero-dep (Node fetch).

import type { GameEvent, IcpReading, FounderReading } from './types.ts';

// tiny deterministic hash → a stable pseudo-vector, so the stub is reproducible (no Math.random).
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 0xffffffff;
}

/** ICP-NPC ("Mira") — the deterministic stub (the offline fallback). */
export function icpNpc(positioning: string): IcpReading {
  const r = seed(positioning);
  return {
    simulated: true,
    source: 'stub',
    pains: [
      'has to assemble coherence across single-slice vendors',
      'systems break at ownership transfer',
      'AI proposals are demos that never mature',
    ],
    direction: [Math.cos(r * 6.283), Math.sin(r * 6.283)],   // a unit step in brand-space (stub)
    directionLabel: 'toward owned, end-to-end delivery',
    resonance: Number((0.4 + 0.5 * r).toFixed(3)),
  };
}

/** Turn a direction phrase into a stub 2-D vector (deterministic) — the real vector needs the NIM embed. */
function dirFromLabel(label: string): number[] {
  const r = seed(label || 'resonance');
  return [Math.cos(r * 6.283), Math.sin(r * 6.283)];
}
const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5);

/** Robustly pull the JSON object out of a model reply (strip fences/prose). */
function parseLooseJson(text: string): any {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in model output');
  return JSON.parse(cleaned.slice(a, b + 1));
}

interface Provider { name: string; url: string; key: string; model: string; }

// NVIDIA NIM = the cortex provider (OpenAI-compatible). Kimi/Moonshot = the fallback.
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const KIMI_URL = 'https://api.moonshot.ai/v1/chat/completions';
const NVIDIA_DEFAULT_MODEL = 'meta/llama-3.1-70b-instruct';
const KIMI_DEFAULT_MODEL = 'kimi-k2-0905-preview';

function pickProvider(opts: { apiKey?: string; url?: string; model?: string }): Provider | null {
  if (opts.apiKey) {
    return { name: 'custom', url: opts.url ?? NVIDIA_URL, key: opts.apiKey, model: opts.model ?? NVIDIA_DEFAULT_MODEL };
  }
  const nvidia = process.env.NVIDIA_API_KEY;
  if (nvidia) return { name: 'nvidia-nim', url: NVIDIA_URL, key: nvidia, model: opts.model ?? process.env.ICP_MODEL ?? NVIDIA_DEFAULT_MODEL };
  const kimi = process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY;
  if (kimi) return { name: 'kimi', url: KIMI_URL, key: kimi, model: opts.model ?? process.env.ICP_MODEL ?? KIMI_DEFAULT_MODEL };
  return null;
}

/**
 * A real-ish ICP-NPC: a real model answers IN the persona's voice. Provider order: NVIDIA NIM → Kimi
 * → (no key) the deterministic stub. The direction VECTOR is still derived (the real one needs the NIM
 * embed) but the pains + direction LABEL + resonance are real.
 *
 * Anti-echo-chamber (INFINITE-GAME.md §8): this PROPOSES; a setpoint move still needs real evidence + the gate.
 */
export async function realIcp(
  positioning: string,
  opts: { persona?: string; model?: string; apiKey?: string; url?: string; fetchImpl?: typeof fetch; offline?: boolean } = {},
): Promise<IcpReading> {
  if (opts.offline) return icpNpc(positioning);
  const provider = pickProvider(opts);
  if (!provider) return icpNpc(positioning);                           // no NVIDIA/Kimi key → fallback
  const f = opts.fetchImpl ?? fetch;
  const persona = opts.persona ??
    'Mira — a founder / CTO with a lean senior team, skeptical of buzzwords, who needs one coherent partner ' +
    'instead of fragmented vendors and a system she can own after delivery';
  const system = 'You role-play a brand’s Ideal Customer. Output ONLY one minified JSON object — no markdown, no code fences, no prose.';
  const user =
    `You ARE this ICP: ${persona}.\n` +
    `A studio’s current positioning is: "${positioning}".\n` +
    `Return JSON: {"pains":["three short specific real pains in your own voice"],` +
    `"direction":"one short phrase — which way the positioning should move to resonate with you",` +
    `"resonance":0.0}  where resonance is 0..1 (how well the current positioning lands for you).`;
  try {
    const res = await f(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model, temperature: 0.4, max_tokens: 400,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) return icpNpc(positioning);
    const data: any = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const json: any = parseLooseJson(text);
    const pains: string[] = Array.isArray(json.pains) ? json.pains.slice(0, 3).map(String) : icpNpc(positioning).pains;
    const directionLabel: string = typeof json.direction === 'string' ? json.direction : '';
    return {
      simulated: true, source: 'llm', via: `${provider.name}:${provider.model}`,
      pains, directionLabel, direction: dirFromLabel(directionLabel), resonance: clamp01(Number(json.resonance)),
    };
  } catch {
    return icpNpc(positioning);                                        // any failure → fail soft to the stub
  }
}

/** Founder-NPC: the intent oracle for the error-vs-intent bit. Defaults to ERROR (fail-closed). */
export function founderNpc(event: GameEvent): FounderReading {
  return {
    simulated: true,
    source: 'stub',
    intentBit: event.intent ? 'intent' : 'error',
    confidence: event.intent ? 0.7 : 0.6,
  };
}

/**
 * A real-ish Founder-NPC: a real model role-plays the founder's operating logic to judge a deviation —
 * a bad step to REROLL, or the founder's new INTENT to move the goal. NVIDIA NIM → Kimi → stub. Fail-soft.
 */
export async function realFounder(
  event: GameEvent,
  context: { vision: string; mission: string },
  opts: { model?: string; apiKey?: string; url?: string; fetchImpl?: typeof fetch; offline?: boolean } = {},
): Promise<FounderReading> {
  if (opts.offline) return founderNpc(event);
  const provider = pickProvider(opts);
  if (!provider) return founderNpc(event);
  const f = opts.fetchImpl ?? fetch;
  const system = 'You role-play the FOUNDER of a studio — its operating logic, taste, and risk appetite. Output ONLY one minified JSON object.';
  const user =
    `Vision: "${context.vision}". Mission: "${context.mission}".\n` +
    `An event deviated from the current plan — kind="${event.kind}", note="${event.note ?? ''}", ` +
    `founder-flagged-intent=${!!event.intent}.\n` +
    `Is this a bad step to REROLL toward the same goal, or YOUR new INTENT to move the goal? ` +
    `Return JSON: {"intent":true|false,"confidence":0.0,"why":"one short phrase"} (confidence 0..1).`;
  try {
    const res = await f(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, temperature: 0.2, max_tokens: 200, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) return founderNpc(event);
    const data: any = await res.json();
    const json: any = parseLooseJson(data?.choices?.[0]?.message?.content ?? '');
    return {
      simulated: true, source: 'llm', via: `${provider.name}:${provider.model}`,
      intentBit: json.intent ? 'intent' : 'error',
      confidence: clamp01(Number(json.confidence)),
      rationale: typeof json.why === 'string' ? json.why : undefined,
    };
  } catch {
    return founderNpc(event);
  }
}
