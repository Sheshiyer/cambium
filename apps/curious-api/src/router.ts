import type { D1Like } from "./db.ts";
import { fromD1 } from "./db.ts";
import { defaultDeps, type Deps } from "./deps.ts";
import { handleHealth } from "./health.ts";
import { json } from "./http.ts";
import type { QuestsService } from "./quests-client.ts";
import { handleQuestsHealth } from "./quests-route.ts";
import { handleFieldRequest } from "./field-routes.ts";
import { handleLibraryRequest } from "./library-routes.ts";
import { handleMcp } from "./mcp.ts";
import { handleMuseRequest } from "./muse-routes.ts";
import { handleTokenRequest } from "./token-routes.ts";

export interface WorkerEnv {
  SERVICE_NAME?: string;
  CURIOUS_DB?: D1Like;
  CAMBIUM_QUESTS?: QuestsService;
  MAGE_ACCESS_IDENTITY?: string;
  CURIOUS_ACCESS_HMAC_KEY?: string;
  CURIOUS_ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  CURIOUS_FIELD_KEY?: string;
}

export async function route(request: Request, env: WorkerEnv, deps: Deps = defaultDeps): Promise<Response> {
  const url = new URL(request.url);
  const db = deps.db ?? (env.CURIOUS_DB ? fromD1(env.CURIOUS_DB) : undefined);
  let response: Response;
  const tokenResponse = await handleTokenRequest(request, db, env, deps);
  const libraryResponse = tokenResponse ? null : await handleLibraryRequest(request, db, env.CURIOUS_FIELD_KEY, deps);
  const fieldResponse = tokenResponse || libraryResponse ? null : await handleFieldRequest(request, db, deps);
  const museResponse = tokenResponse || libraryResponse || fieldResponse ? null : await handleMuseRequest(request, db, deps);
  const mcpResponse = tokenResponse || libraryResponse || fieldResponse || museResponse ? null : await handleMcp(request, db, env.CURIOUS_FIELD_KEY, deps);
  if (tokenResponse) response = tokenResponse;
  else if (libraryResponse) response = libraryResponse;
  else if (fieldResponse) response = fieldResponse;
  else if (museResponse) response = museResponse;
  else if (mcpResponse) response = mcpResponse;
  else if (request.method === "GET" && url.pathname === "/healthz") response = handleHealth(env.SERVICE_NAME);
  else if (url.pathname === "/v1/quests/health") response = await handleQuestsHealth(request, env.CAMBIUM_QUESTS, deps);
  else response = json(404, { ok: false, error: "not_found" });
  console.log(JSON.stringify({ event: "request", method: request.method, path: url.pathname, status: response.status }));
  return response;
}
