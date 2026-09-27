import { authorizeRequest } from "./auth.ts";
import { filterInboundJson, filterInboundSse, filterOutboundBody, mcpJsonRpcError } from "./filter.ts";

export interface Env {
  MCP_BEARER?: string;
  ORIGIN_SECRET?: string;
  ORIGIN_URL: string;
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "authorization",
  "cf-access-jwt-assertion",
  "cookie",
]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function forwardHeaders(request: Request, originSecret: string): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("x-thoughtseed-origin", originSecret);
  if (!headers.has("accept")) {
    headers.set("accept", "application/json, text/event-stream");
  }
  return headers;
}

async function proxyToOrigin(
  request: Request,
  env: Env,
  body: string | null,
): Promise<Response> {
  if (!env.ORIGIN_URL || !env.ORIGIN_SECRET) {
    return json(503, { error: "origin_unconfigured" });
  }
  const origin = new URL("/mcp", env.ORIGIN_URL);
  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders(request, env.ORIGIN_SECRET),
  };
  if (body !== null && request.method !== "GET" && request.method !== "HEAD") {
    init.body = body;
  }
  const upstream = await fetch(origin, init);
  const contentType = upstream.headers.get("content-type") ?? "";
  const outHeaders = new Headers(upstream.headers);
  if (request.method === "POST" && contentType.includes("application/json")) {
    const text = await upstream.text();
    return new Response(filterInboundJson(text), {
      status: upstream.status,
      headers: outHeaders,
    });
  }
  if (request.method === "POST" && contentType.includes("text/event-stream")) {
    const text = await upstream.text();
    return new Response(filterInboundSse(text), {
      status: upstream.status,
      headers: outHeaders,
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/mcp") {
      return json(404, { error: "not_found" });
    }
    const auth = await authorizeRequest(request, env.MCP_BEARER);
    if (!auth.ok) {
      return json(auth.status, { error: auth.error });
    }
    if (request.method === "POST") {
      const raw = await request.text();
      const decision = filterOutboundBody(raw);
      if (decision.action === "reject") {
        return new Response(mcpJsonRpcError(decision.id, decision.message), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return proxyToOrigin(request, env, decision.body);
    }
    if (request.method === "GET" || request.method === "DELETE") {
      return proxyToOrigin(request, env, null);
    }
    return json(405, { error: "method_not_allowed" });
  },
};
