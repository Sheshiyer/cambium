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
    const res = await handle(simple, { kv, pushToken: env.QUESTS_PUSH_TOKEN, gate });
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};
