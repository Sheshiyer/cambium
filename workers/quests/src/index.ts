// cambium-quests · Workers runtime glue. All logic lives in handler.ts (pure, node:test-covered).

import { handle } from './handler.ts';
import type { SimpleRequest } from './handler.ts';

interface Env {
  QUESTS: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };
  QUESTS_PUSH_TOKEN?: string;
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
    const res = await handle(simple, { kv: env.QUESTS, pushToken: env.QUESTS_PUSH_TOKEN });
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};
