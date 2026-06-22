// cambium-quests · Workers runtime glue. All logic lives in handler.ts (pure, node:test-covered).

import { handle, TELEGRAM_PROD_PUBKEY } from './handler.ts';
import type { SimpleRequest } from './handler.ts';

interface Env {
  QUESTS: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
  };
  QUESTS_PUSH_TOKEN?: string;
  GATE_BOT_ID?: string;
  GATE_FOUNDER_IDS?: string;
  GATE_TG_PUBKEY?: string;
  BRIDGE_TOKEN?: string;
  HANDOFF_SECRET?: string;
  PROVIDER_BROKER_TOKEN?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_DEFAULT_MODEL?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_BASE_URL?: string;
  NVIDIA_DEFAULT_MODEL?: string;
  NEBIUS_API_KEY?: string;
  NEBIUS_BASE_URL?: string;
  NEBIUS_DEFAULT_MODEL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const simple: SimpleRequest = {
      method: request.method,
      path: url.pathname,
      headers,
      body: ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined,
    };
    const kv = {
      get: (key: string) => env.QUESTS.get(key),
      put: (key: string, value: string) => env.QUESTS.put(key, value),
      list: async (prefix: string) => (await env.QUESTS.list({ prefix })).keys.map((k) => k.name),
    };
    const gate = env.GATE_BOT_ID && env.GATE_FOUNDER_IDS ? {
      botId: env.GATE_BOT_ID,
      pubKeyHex: env.GATE_TG_PUBKEY || TELEGRAM_PROD_PUBKEY,
      founderIds: env.GATE_FOUNDER_IDS.split(',').map((s) => s.trim()),
    } : undefined;
    const providerBroker = env.PROVIDER_BROKER_TOKEN ? {
      token: env.PROVIDER_BROKER_TOKEN,
      providers: {
        ollama: env.OLLAMA_API_KEY ? {
          apiKey: env.OLLAMA_API_KEY,
          baseUrl: env.OLLAMA_BASE_URL || 'https://ollama.com/v1',
          defaultModel: env.OLLAMA_DEFAULT_MODEL || 'kimi-k2.7-code:cloud',
          models: env.OLLAMA_DEFAULT_MODEL ? [env.OLLAMA_DEFAULT_MODEL] : ['kimi-k2.7-code:cloud'],
        } : undefined,
        nvidia: env.NVIDIA_API_KEY ? {
          apiKey: env.NVIDIA_API_KEY,
          baseUrl: env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
          defaultModel: env.NVIDIA_DEFAULT_MODEL || 'meta/llama-3.1-70b-instruct',
          models: env.NVIDIA_DEFAULT_MODEL ? [env.NVIDIA_DEFAULT_MODEL] : ['meta/llama-3.1-70b-instruct'],
        } : undefined,
        nebius: env.NEBIUS_API_KEY ? {
          apiKey: env.NEBIUS_API_KEY,
          baseUrl: env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1',
          defaultModel: env.NEBIUS_DEFAULT_MODEL || 'Qwen/Qwen3-235B-A22B-Instruct-2507',
          models: env.NEBIUS_DEFAULT_MODEL ? [env.NEBIUS_DEFAULT_MODEL] : ['Qwen/Qwen3-235B-A22B-Instruct-2507'],
        } : undefined,
      },
      fetch: fetch.bind(globalThis),
    } : undefined;
    const res = await handle(simple, {
      kv,
      pushToken: env.QUESTS_PUSH_TOKEN,
      gate,
      bridgeToken: env.BRIDGE_TOKEN,
      handoffSecret: env.HANDOFF_SECRET,
      providerBroker,
    });
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};
