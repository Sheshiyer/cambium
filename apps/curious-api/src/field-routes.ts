import type { CuriousDb } from "./db.ts";
import type { Deps } from "./deps.ts";
import { syncFieldReport } from "./field-sync.ts";
import { json } from "./http.ts";
import { authenticate } from "./tokens.ts";

export async function handleFieldRequest(request: Request, db: CuriousDb | undefined, deps: Deps): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/api/library/sync") return null;
  if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  if (!db) return json(503, { ok: false, error: "store_unavailable" });
  const auth = await authenticate(db, request, deps.now());
  if ("error" in auth) return auth.error;
  const payload = await request.json().catch(() => null);
  return syncFieldReport(db, auth.principal, payload, deps.now());
}
