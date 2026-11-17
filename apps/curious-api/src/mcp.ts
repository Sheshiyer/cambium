import type { CuriousDb } from "./db.ts";
import type { Deps } from "./deps.ts";
import { json } from "./http.ts";
import { putLibraryNode, readLibraryNode, tombstoneLibraryNode, wipeExpired } from "./library.ts";
import { authenticate } from "./tokens.ts";

const TOOLS = [
  { name: "library_put", description: "Write a library node. Personal fields need library:personal:write." },
  { name: "library_get", description: "Read a library node. Personal plaintext needs library:personal:read." },
  { name: "library_tombstone", description: "Tombstone a shared or personal library node for 30 days." },
  { name: "library_wipe_expired", description: "Wipe library nodes whose tombstone has reached 30 days." },
];

function rpc(id: unknown, result: unknown): Response {
  return json(200, { jsonrpc: "2.0", id, result });
}

export async function handleMcp(request: Request, db: CuriousDb | undefined, fieldKey: string | undefined, deps: Deps): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/mcp") return null;
  if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const message = await request.json().catch(() => null) as { id?: unknown; method?: string; params?: { name?: string; arguments?: unknown } } | null;
  if (!message || message.method === undefined) return json(400, { ok: false, error: "invalid_body" });
  if (message.method === "initialize") {
    return rpc(message.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "curious-api", version: "0.1.0" } });
  }
  if (!db) return json(503, { ok: false, error: "store_unavailable" });
  const auth = await authenticate(db, request, deps.now());
  if ("error" in auth) return auth.error;
  if (message.method === "tools/list") return rpc(message.id, { tools: TOOLS });
  if (message.method !== "tools/call") return rpc(message.id, { error: "method_not_found" });
  const name = message.params?.name;
  const args = message.params?.arguments;
  let response: Response;
  if (name === "library_put") response = await putLibraryNode(db, auth.principal, args, deps.now(), fieldKey);
  else if (name === "library_get") response = await readLibraryNode(db, auth.principal, String((args as { id?: string } | undefined)?.id ?? ""), fieldKey);
  else if (name === "library_tombstone") response = await tombstoneLibraryNode(db, auth.principal, String((args as { id?: string } | undefined)?.id ?? ""), deps.now());
  else if (name === "library_wipe_expired") response = await wipeExpired(db, auth.principal, deps.now());
  else return rpc(message.id, { isError: true, content: [{ type: "text", text: "unknown_tool" }] });
  const body = await response.json();
  return rpc(message.id, { isError: response.status >= 400, content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body });
}
