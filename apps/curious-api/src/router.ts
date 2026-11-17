import type { D1Like } from "./db.ts";
import { fromD1 } from "./db.ts";
import { defaultDeps, type Deps } from "./deps.ts";
import { handleHealth } from "./health.ts";
import { json } from "./http.ts";
import type { QuestsService } from "./quests-client.ts";
import { handleQuestsHealth } from "./quests-route.ts";
import { handleTokenRequest } from "./token-routes.ts";

export interface WorkerEnv {
  SERVICE_NAME?: string;
  CURIOUS_DB?: D1Like;
  CAMBIUM_QUESTS?: QuestsService;
  MAGE_ACCESS_IDENTITY?: string;
  CURIOUS_ACCESS_HMAC_KEY?: string;
  CURIOUS_ACCESS_AUD?: string;
}

export async function route(request: Request, env: WorkerEnv, deps: Deps = defaultDeps): Promise<Response> {
  const url = new URL(request.url);
  const db = deps.db ?? (env.CURIOUS_DB ? fromD1(env.CURIOUS_DB) : undefined);
  let response: Response;
  const tokenResponse = await handleTokenRequest(request, db, env, deps);
  if (tokenResponse) response = tokenResponse;
  else if (request.method === "GET" && url.pathname === "/healthz") response = handleHealth(env.SERVICE_NAME);
  else if (url.pathname === "/v1/quests/health") response = await handleQuestsHealth(request, env.CAMBIUM_QUESTS, deps);
  else response = json(404, { ok: false, error: "not_found" });
  console.log(JSON.stringify({ event: "request", method: request.method, path: url.pathname, status: response.status }));
  return response;
}
