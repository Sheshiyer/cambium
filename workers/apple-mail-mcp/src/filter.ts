import { isAllowedTool } from "./allowlist.ts";

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

export type FilterDecision =
  | { action: "proxy"; body: string }
  | { action: "reject"; id: JsonRpcId; message: string };

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toolNameFromCall(params: unknown): string | null {
  const obj = asObject(params);
  if (!obj) return null;
  return typeof obj.name === "string" ? obj.name : null;
}

function rejectCall(id: JsonRpcId, name: string): FilterDecision {
  return {
    action: "reject",
    id: id ?? null,
    message: `Tool "${name}" is not enabled on this gateway (read-only allowlist).`,
  };
}

function inspectRequest(msg: JsonRpcRequest): FilterDecision | null {
  if (msg.method !== "tools/call") return null;
  const name = toolNameFromCall(msg.params);
  if (!name) {
    return {
      action: "reject",
      id: msg.id ?? null,
      message: "tools/call requires params.name",
    };
  }
  if (!isAllowedTool(name)) return rejectCall(msg.id ?? null, name);
  return null;
}

/** Block disallowed tools/call on the way to the Mac origin. */
export function filterOutboundBody(body: string): FilterDecision {
  const trimmed = body.trim();
  if (!trimmed) return { action: "proxy", body };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { action: "proxy", body };
  }
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const blocked = inspectRequest(asObject(item) ?? {});
      if (blocked) return blocked;
    }
    return { action: "proxy", body };
  }
  const blocked = inspectRequest(asObject(parsed) ?? {});
  if (blocked) return blocked;
  return { action: "proxy", body };
}

function filterListedTools(result: unknown): unknown {
  const obj = asObject(result);
  if (!obj || !Array.isArray(obj.tools)) return result;
  return { ...obj, tools: obj.tools.filter((tool) => isAllowedTool(asObject(tool)?.name)) };
}

function filterMessage(msg: unknown): unknown {
  const obj = asObject(msg);
  if (!obj) return msg;
  const result = asObject(obj.result);
  if (result && Array.isArray(result.tools)) {
    return { ...obj, result: filterListedTools(result) };
  }
  return msg;
}

/** Drop disallowed tools from a JSON tools/list result. */
export function filterInboundJson(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return body;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return body;
  }
  if (Array.isArray(parsed)) {
    return JSON.stringify(parsed.map(filterMessage));
  }
  return JSON.stringify(filterMessage(parsed));
}

/** Filter `data:` JSON-RPC payloads in a finite SSE POST response. */
export function filterInboundSse(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      if (!line.startsWith("data:")) return line;
      const prefix = line.slice(0, 5);
      const json = line.slice(5).trim();
      if (!json) return line;
      return `${prefix} ${filterInboundJson(json)}`;
    })
    .join("\n");
}

export function mcpJsonRpcError(id: JsonRpcId, message: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: -32603, message },
  });
}
