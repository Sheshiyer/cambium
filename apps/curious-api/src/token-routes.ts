import type { Deps } from "./deps.ts";
import type { CuriousDb } from "./db.ts";
import { json } from "./http.ts";
import { authenticate, handleApprove, issueToken, revokeToken, sessionResponse } from "./tokens.ts";

export interface AccessEnv {
  MAGE_ACCESS_IDENTITY?: string;
  CURIOUS_ACCESS_HMAC_KEY?: string;
  CURIOUS_ACCESS_AUD?: string;
}

export async function handleTokenRequest(request: Request, db: CuriousDb | undefined, env: AccessEnv, deps: Deps): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tokenRoute = path === "/v1/tokens/issue" || path === "/v1/tokens/revoke" || path === "/v1/session" || path === "/v1/approve";
  if (!tokenRoute) return null;
  if (!db) return json(503, { ok: false, error: "store_unavailable" });
  if (request.method === "POST" && path === "/v1/approve") return handleApprove(db, request, env, deps);
  if (request.method !== "POST" && !(request.method === "GET" && path === "/v1/session")) return json(405, { ok: false, error: "method_not_allowed" });
  const auth = await authenticate(db, request, deps.now());
  if ("error" in auth) return auth.error;
  if (request.method === "GET" && path === "/v1/session") return sessionResponse(auth.principal);
  if (request.method === "POST" && path === "/v1/tokens/issue") return issueToken(db, request, auth.principal, deps);
  if (request.method === "POST" && path === "/v1/tokens/revoke") return revokeToken(db, request, auth.principal, deps);
  return json(405, { ok: false, error: "method_not_allowed" });
}
