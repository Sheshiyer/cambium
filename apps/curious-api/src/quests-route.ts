import type { Deps } from "./deps.ts";
import { json } from "./http.ts";
import { callQuests, QuestsClientError, type QuestsService } from "./quests-client.ts";

export async function handleQuestsHealth(request: Request, binding: QuestsService | undefined, deps: Deps): Promise<Response> {
  if (request.method !== "GET") return json(405, { ok: false, error: "method_not_allowed" });
  try {
    const response = await callQuests(binding, "/healthz", { method: "GET" });
    void deps;
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const failure = error instanceof QuestsClientError ? error.failure : "denied";
    return json(503, { ok: false, error: "fail_closed", failure });
  }
}
