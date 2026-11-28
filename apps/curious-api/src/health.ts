import { json } from "./http.ts";

export function handleHealth(serviceName: string | undefined): Response {
  return json(200, { ok: true, worker: serviceName || "curious-api-dev" });
}
