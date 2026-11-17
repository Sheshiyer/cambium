import { defaultDeps, type Deps } from "./deps.ts";
import { handleHealth } from "./health.ts";
import { json } from "./http.ts";
import type { QuestsService } from "./quests-client.ts";
import { handleQuestsHealth } from "./quests-route.ts";

export interface WorkerEnv {
  SERVICE_NAME?: string;
  CURIOUS_DB?: unknown;
  CAMBIUM_QUESTS?: QuestsService;
}

export async function route(request: Request, env: WorkerEnv, deps: Deps = defaultDeps): Promise<Response> {
  const url = new URL(request.url);
  let response: Response;
  if (request.method === "GET" && url.pathname === "/healthz") response = handleHealth(env.SERVICE_NAME);
  else if (url.pathname === "/v1/quests/health") response = await handleQuestsHealth(request, env.CAMBIUM_QUESTS, deps);
  else response = json(404, { ok: false, error: "not_found" });
  console.log(JSON.stringify({ event: "request", method: request.method, path: url.pathname, status: response.status }));
  return response;
}
