import type { CuriousDb } from "./db.ts";
import type { Deps } from "./deps.ts";
import { json } from "./http.ts";
import { handleMuse } from "./muse.ts";
import { authenticate } from "./tokens.ts";

export async function handleMuseRequest(request: Request, db: CuriousDb | undefined, deps: Deps): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/v1/muse/")) return null;
  if (!db) return json(503, { ok: false, error: "store_unavailable" });
  const auth = await authenticate(db, request, deps.now());
  if ("error" in auth) return auth.error;
  return handleMuse(request, db, auth.principal, deps.now());
}
