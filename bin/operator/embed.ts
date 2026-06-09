// Cambium operator · embeddings — real NIM vectors (the cortex), or a deterministic fallback offline.
// The fallback lets cosine/gradient math run with no key and in tests (no network, no Math.random).

import { nimTransport } from '../lib/cortex.mjs';

export interface Embedder {
  dims: number;
  source: 'nim' | 'stub';
  embed: (texts: string[]) => Promise<number[][]>;
}

const FALLBACK_DIMS = 64;
const NIM_DIMS = 1024;     // nvidia/nv-embedqa-e5-v5

function hash(s: string, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;            // [-1, 1]
}
function stubEmbed(text: string, dims: number): number[] {
  return l2normalize(Array.from({ length: dims }, (_, i) => hash(text, i + 1)));
}

export function l2normalize(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}
export function cosine(a: number[], b: number[]): number {
  const k = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < k; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}
export function sub(a: number[], b: number[]): number[] {
  const k = Math.min(a.length, b.length);
  return Array.from({ length: k }, (_, i) => a[i] - b[i]);
}

/** Real NIM embedder when NVIDIA_API_KEY (or opts.apiKey) is present, else the deterministic stub. */
export function makeEmbedder(opts: { apiKey?: string; root?: string; fetchImpl?: typeof fetch; offline?: boolean } = {}): Embedder {
  const apiKey = opts.offline ? undefined : (opts.apiKey ?? process.env.NVIDIA_API_KEY);
  if (!apiKey) {
    return { dims: FALLBACK_DIMS, source: 'stub', embed: async (texts) => texts.map((t) => stubEmbed(t, FALLBACK_DIMS)) };
  }
  const t = nimTransport({ root: opts.root ?? process.cwd(), apiKey, fetchImpl: opts.fetchImpl });
  return {
    dims: NIM_DIMS,
    source: 'nim',
    embed: async (texts) => {
      try {
        const out = await t.embed(texts) as number[][];
        return out.map((v) => l2normalize(v));
      } catch {
        return texts.map((x) => stubEmbed(x, NIM_DIMS));   // fail soft, but keep the 1024-dim contract
      }
    },
  };
}
