import type { CuriousDb } from "./db.ts";
import type { Deps } from "./deps.ts";
import { json } from "./http.ts";
import { putLibraryNode, readLibraryNode, tombstoneLibraryNode, wipeExpired } from "./library.ts";
import { authenticate } from "./tokens.ts";

export async function handleLibraryRequest(request: Request, db: CuriousDb | undefined, fieldKey: string | undefined, deps: Deps): Promise<Response | null> {
  const url = new URL(request.url);
  const match = /^\/v1\/library\/nodes(?:\/([^/]+))?$/.exec(url.pathname);
  const wipe = url.pathname === "/v1/library/maintenance/wipe";
  if (!match && !wipe) return null;
  if (!db) return json(503, { ok: false, error: "store_unavailable" });
  const auth = await authenticate(db, request, deps.now());
  if ("error" in auth) return auth.error;
  if (wipe && request.method === "POST") return wipeExpired(db, auth.principal, deps.now());
  if (!match) return json(405, { ok: false, error: "method_not_allowed" });
  if (!match[1] && request.method === "POST") {
    const payload = await request.json().catch(() => null);
    return putLibraryNode(db, auth.principal, payload, deps.now(), fieldKey);
  }
  if (match[1] && request.method === "GET") return readLibraryNode(db, auth.principal, decodeURIComponent(match[1]), fieldKey);
  if (match[1] && request.method === "DELETE") return tombstoneLibraryNode(db, auth.principal, decodeURIComponent(match[1]), deps.now());
  return json(405, { ok: false, error: "method_not_allowed" });
}
