import {
  authorizeMcpRequest,
  oauthChallenge,
  oauthToolChallenge,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  resolveAuthConfig,
  type AuthConfig,
  type AuthEnv,
  type VerifiedTokenClaims,
} from "./openai-auth.ts";
import {
  ConnectedProfileError,
  deriveConnectedProfile,
  resolveConnectedProfileConfig,
} from "./connected-profile.ts";
import {
  ProvenanceReadError,
  readInfiniteGameNode,
  type ProvenanceReaderBinding,
} from "./provenance-read.ts";
import {
  compileActionIntent,
  executeApprovedAction,
  GateActionError,
  readActionApprovalStatus,
  requestActionApproval,
  type GateActionBinding,
  type GateActionIdentity,
} from "./gate-action.ts";

const SERVER_VERSION = "1.7.0";
const FIXED_CAMBIUM_TOOLS = new Set([
  "taste_cortex_query",
  "taste_cortex_compose",
  "taste_cortex_get_blob",
  "organ_atlas_lookup",
  "capability_hit_evaluate",
  "cortex_health",
]);
const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

export interface CortexHttpEnv extends AuthEnv {
  CONTEXT_ALLOWED_TENANTS?: string;
  MCP_ALLOWED_ORIGINS?: string;
  MCP_PLUGIN_CLIENT_ID?: string;
  MCP_FOUNDER_SUBJECTS?: string;
  MCP_PROFILE_ID_KEY?: string;
  MCP_GATE_ADAPTER?: GateActionBinding;
  MCP_GATE_ADAPTER_TOKEN?: string;
  MCP_PROVENANCE_READER?: ProvenanceReaderBinding;
}

interface ListedTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CortexHttpDeps {
  legacyTools(): Promise<ListedTool[]>;
  callTool(name: string, args: Record<string, unknown> | undefined): Promise<unknown>;
}

function readBearer(request: Request): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("authorization") || "");
  return match?.[1] ?? null;
}

function acceptsStreamable(value: string | null): boolean {
  const types = (value || "")
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);
  return types.includes("application/json") && types.includes("text/event-stream");
}

function jsonResponse(body: unknown, status: number, headers: HeadersInit = {}): Response {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function rpcResult(id: unknown, result: unknown, headers: HeadersInit = {}): Response {
  return jsonResponse({ jsonrpc: "2.0", id, result }, 200, headers);
}

function rpcError(id: unknown, code: number, message: string, status = 200, headers: HeadersInit = {}): Response {
  return jsonResponse({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status, headers);
}

function toolError(id: unknown, text: string, headers: HeadersInit = {}, challenge?: string): Response {
  const responseHeaders = new Headers(headers);
  const result: Record<string, unknown> = {
    isError: true,
    content: [{ type: "text", text }],
  };
  if (challenge) {
    result._meta = { "mcp/www_authenticate": [challenge] };
    responseHeaders.set("www-authenticate", challenge);
  }
  return rpcResult(id, result, responseHeaders);
}

function toolValue(id: unknown, value: unknown, headers: HeadersInit = {}): Response {
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
  }, headers);
}

function claimTenants(claims: VerifiedTokenClaims): Set<string> {
  const tenants: string[] = [];
  if (typeof claims.tenant === "string") tenants.push(claims.tenant);
  if (Array.isArray(claims.tenants)) {
    for (const tenant of claims.tenants) {
      if (typeof tenant === "string") tenants.push(tenant);
    }
  }
  return new Set(tenants);
}

function claimScopeSet(claims: VerifiedTokenClaims): Set<string> {
  return new Set([
    ...(typeof claims.scope === "string" ? claims.scope.split(/\s+/) : []),
    ...(Array.isArray(claims.scopes) ? claims.scopes : []),
  ].filter(Boolean));
}

function legacyAllowlist(env: CortexHttpEnv): Set<string> {
  return new Set((env.CONTEXT_ALLOWED_TENANTS || "cambium").split(",").map((tenant) => tenant.trim()).filter(Boolean));
}

function corsFor(request: Request, env: CortexHttpEnv): { headers: Record<string, string>; denied: boolean } {
  const origin = request.headers.get("origin");
  if (!origin) return { headers: {}, denied: false };
  const allowed = (env.MCP_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return { headers: {}, denied: true };
  return {
    denied: false,
    headers: {
      "access-control-allow-origin": origin,
      vary: "Origin",
    },
  };
}

function isLegacyMcpPath(pathname: string): boolean {
  return pathname === "/mcp" || pathname === "/v1/mcp" || pathname === "/";
}

function capability(
  config: Extract<AuthConfig, { mode: "oauth" }>,
  name: string,
  classification: "read" | "approval-gated-action",
  resource: string,
  tenantMode: string,
  approval: string,
  idempotency: string,
  receipt: string,
) {
  return {
    schema: "cambium.openai.tool_capability.v1",
    name,
    classification,
    resource,
    tenant: { mode: tenantMode },
    credential_owner: config.authorizationServer,
    approval_requirement: approval,
    idempotency,
    terminal_receipt: receipt,
    writer_authority: false,
  };
}

function readCapability(config: Extract<AuthConfig, { mode: "oauth" }>, name: string, resource: string, tenantMode: string) {
  return capability(
    config,
    name,
    "read",
    resource,
    tenantMode,
    "none",
    "safe-repeat",
    "none:read-envelope-is-not-canonical-completion",
  );
}

function oauthReadTool(
  config: Extract<AuthConfig, { mode: "oauth" }>,
  tool: ListedTool,
  resource: string,
  tenantMode: string,
  extraMeta: Record<string, unknown> = {},
) {
  const schemes = [{ type: "oauth2" as const, scopes: config.requiredScopes }];
  return {
    ...tool,
    title: tool.title || tool.name,
    inputSchema: { ...(tool.inputSchema || { type: "object", properties: {} }), additionalProperties: false },
    annotations: { ...READ_ANNOTATIONS, ...(tool.annotations || {}) },
    securitySchemes: schemes,
    _meta: {
      "cambium/capability": readCapability(config, tool.name, resource, tenantMode),
      securitySchemes: schemes,
      ...extraMeta,
    },
  };
}

const READ_RESOURCES: Record<string, string> = {
  taste_cortex_query: "cambium://taste-cortex",
  taste_cortex_compose: "cambium://taste-cortex",
  taste_cortex_get_blob: "cambium://taste-cortex",
  semantic_recall: "cambium://semantic-recall",
  organ_atlas_lookup: "cambium://organ-atlas",
  capability_hit_evaluate: "cambium://capability-hit",
  cortex_health: "cambium://cortex-health",
};

const ACTION_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["tenant", "action_kind", "arguments", "graph_version", "nonce", "expiry", "idempotency_key"],
  properties: {
    tenant: { type: "string", pattern: "^[a-z][a-z0-9-]{1,63}$" },
    action_kind: { type: "string", minLength: 1, maxLength: 128 },
    arguments: { type: "object" },
    graph_version: { type: "integer", minimum: 0 },
    nonce: { type: "string", minLength: 8, maxLength: 128 },
    expiry: { type: "string", format: "date-time" },
    idempotency_key: { type: "string", minLength: 3, maxLength: 128 },
  },
};

const EXECUTE_INPUT = {
  ...ACTION_INPUT,
  required: [...ACTION_INPUT.required, "approval_digest"],
  properties: {
    ...ACTION_INPUT.properties,
    approval_digest: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
  },
};

const INFINITE_GAME_TOOL: ListedTool = {
  name: "read_infinite_game_node",
  title: "Read infinite-game node",
  description: "Read one canonical infinite-game node as a non-authoritative provenance envelope.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["tenant", "node_kind", "node_id"],
    properties: {
      tenant: { type: "string", pattern: "^[a-z][a-z0-9-]{1,63}$" },
      node_kind: { type: "string" },
      node_id: { type: "string" },
      graph_version: { type: "string" },
      max_bytes: { type: "integer", minimum: 1, maximum: 65536 },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      schema: { type: "string" },
      tenant: { type: "string" },
      writer_authority: { type: "boolean" },
      canonical_completion: { type: "boolean" },
    },
  },
};

function profileTool(config: Extract<AuthConfig, { mode: "oauth" }>) {
  return oauthReadTool(config, {
    name: "get_connected_profile",
    title: "Connected profile",
    description: "Return the stable opaque id of the verified OAuth principal.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", pattern: "^prf_[a-f0-9]{64}$" },
        name: { type: "string" },
        email: { type: "string" },
        nickname: { type: "string" },
      },
      required: ["id"],
    },
  }, "cambium://connected-profile", "none", { "openai/profile": true });
}

function actionTools(config: Extract<AuthConfig, { mode: "oauth" }>) {
  const readSchemes = [{ type: "oauth2" as const, scopes: config.requiredScopes }];
  const actionSchemes = [{ type: "oauth2" as const, scopes: config.supportedScopes }];
  const specs = [
    ["compile_action_intent", "Compile action intent", "Compile one founder-bound action without executing it.", READ_ANNOTATIONS, readSchemes, "founder-oauth-action-scope", "replay-stable", "none:compiled-intent", ACTION_INPUT],
    ["request_action_approval", "Request action approval", "Submit one compiled action for founder review.", { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, readSchemes, "founder-review-request", "exact-replay", "none:review-request", ACTION_INPUT],
    ["get_action_approval_status", "Read action approval", "Read the founder review state for one compiled action.", READ_ANNOTATIONS, readSchemes, "founder-review-status", "status-replay", "none:status", ACTION_INPUT],
    ["execute_approved_action", "Execute approved action", "Execute one founder-approved action through Gate readback.", { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }, actionSchemes, "exact-founder-gate-approval", "replay-safe", "required:authoritative-readback", EXECUTE_INPUT],
  ] as const;
  return specs.map(([name, title, description, annotations, schemes, approval, idempotency, receipt, inputSchema]) => ({
    name,
    title,
    description,
    inputSchema,
    annotations,
    securitySchemes: schemes,
    _meta: {
      "cambium/capability": capability(config, name, "approval-gated-action", "cambium://gate-action", "argument", approval, idempotency, receipt),
      securitySchemes: schemes,
    },
  }));
}

async function advertisedTools(env: CortexHttpEnv, config: AuthConfig, deps: CortexHttpDeps) {
  const legacy = await deps.legacyTools();
  if (config.mode === "legacy") return [...legacy, INFINITE_GAME_TOOL];
  const reads = legacy.map((tool) => oauthReadTool(
    config,
    tool,
    READ_RESOURCES[tool.name] || "cambium://cortex",
    tool.name === "semantic_recall" ? "argument" : "fixed",
  ));
  const profile = resolveConnectedProfileConfig(env.MCP_PROFILE_ID_KEY) ? [profileTool(config)] : [];
  const provenance = [oauthReadTool(config, INFINITE_GAME_TOOL, "cambium://infinite-game", "argument")];
  const actions = config.supportedScopes.some((scope) => !config.requiredScopes.includes(scope))
    ? actionTools(config)
    : [];
  return [...reads, ...profile, ...provenance, ...actions];
}

function identityFor(config: Extract<AuthConfig, { mode: "oauth" }>, claims: VerifiedTokenClaims): GateActionIdentity {
  return {
    actor: String(claims.sub || ""),
    plugin_identity: String(claims.client_id || ""),
    mcp_identity: config.resource,
    issuer: config.authorizationServer,
  };
}

async function runTool(
  request: Request,
  env: CortexHttpEnv,
  config: AuthConfig,
  deps: CortexHttpDeps,
  id: unknown,
  name: string,
  args: Record<string, unknown> | undefined,
  claims: VerifiedTokenClaims | undefined,
  headers: HeadersInit,
): Promise<Response> {
  if (config.mode === "oauth" && FIXED_CAMBIUM_TOOLS.has(name)) {
    if (!claims || !claimTenants(claims).has("cambium")) return toolError(id, "unauthorized_tenant", headers);
  }

  if (name === "get_connected_profile") {
    if (config.mode !== "oauth" || !claims) return toolError(id, "oauth_action_required", headers);
    try {
      const profile = await deriveConnectedProfile(env.MCP_PROFILE_ID_KEY || "", config.authorizationServer, claims.sub || "");
      return toolValue(id, profile, headers);
    } catch (error) {
      if (error instanceof ConnectedProfileError) {
        return toolError(id, JSON.stringify({ status: "unavailable", code: error.code }), headers);
      }
      throw error;
    }
  }

  if (name === "read_infinite_game_node") {
    const tenant = typeof args?.tenant === "string" ? args.tenant : "";
    const allowed = config.mode === "oauth"
      ? Boolean(claims && claimTenants(claims).has(tenant))
      : legacyAllowlist(env).has(tenant);
    if (!allowed) return toolError(id, "unauthorized_tenant", headers);
    try {
      const envelope = await readInfiniteGameNode(env.MCP_PROVENANCE_READER as ProvenanceReaderBinding, args as never);
      return toolValue(id, envelope, headers);
    } catch (error) {
      if (error instanceof ProvenanceReadError) return toolError(id, error.code, headers);
      return toolError(id, "read_plane_unavailable", headers);
    }
  }

  if (name === "compile_action_intent" || name === "request_action_approval" || name === "get_action_approval_status" || name === "execute_approved_action") {
    if (config.mode !== "oauth" || !claims) return toolError(id, "oauth_action_required", headers);
    const actionScopes = config.supportedScopes.filter((scope) => !config.requiredScopes.includes(scope));
    const granted = claimScopeSet(claims);
    if (actionScopes.length === 0 || actionScopes.some((scope) => !granted.has(scope))) {
      const challenge = `${oauthChallenge(config, request.url, config.supportedScopes)}, error="insufficient_scope", error_description="Access token lacks required scopes"`;
      return toolError(id, "action_scope_required", headers, challenge);
    }
    const founders = new Set((env.MCP_FOUNDER_SUBJECTS || "").split(/[\s,]+/).map((value) => value.trim()).filter(Boolean));
    if (!claims.sub || !founders.has(claims.sub)) return toolError(id, "founder_required", headers);
    if (!env.MCP_PLUGIN_CLIENT_ID || claims.client_id !== env.MCP_PLUGIN_CLIENT_ID) {
      return toolError(id, "plugin_identity_mismatch", headers);
    }
    const tenant = typeof args?.tenant === "string" ? args.tenant : "";
    if (!claimTenants(claims).has(tenant)) return toolError(id, "unauthorized_tenant", headers);
    try {
      const identity = identityFor(config, claims);
      const binding = env.MCP_GATE_ADAPTER as GateActionBinding;
      const gateToken = env.MCP_GATE_ADAPTER_TOKEN;
      const value = name === "compile_action_intent"
        ? await compileActionIntent(args as never, identity)
        : name === "request_action_approval"
          ? await requestActionApproval(binding, args as never, identity, Date.now(), 5_000, gateToken)
          : name === "get_action_approval_status"
            ? await readActionApprovalStatus(binding, args as never, identity, Date.now(), 5_000, gateToken)
            : await executeApprovedAction(binding, args as never, identity, Date.now(), 5_000, gateToken);
      return toolValue(id, value, headers);
    } catch (error) {
      if (error instanceof GateActionError) return toolError(id, error.code, headers);
      return toolError(id, "gate_unavailable", headers);
    }
  }

  if (config.mode === "oauth" && name === "semantic_recall") {
    const tenant = typeof args?.tenant === "string" ? args.tenant : "";
    if (!claims || !claimTenants(claims).has(tenant)) return toolError(id, "unauthorized_tenant", headers);
  }

  try {
    return rpcResult(id, await deps.callTool(name, args), headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return rpcError(id, -32603, message, 500, headers);
  }
}

async function handleMessage(
  request: Request,
  env: CortexHttpEnv,
  config: AuthConfig,
  deps: CortexHttpDeps,
  message: Record<string, unknown>,
  headers: HeadersInit,
): Promise<Response> {
  const id = message.id ?? null;
  const method = typeof message.method === "string" ? message.method : "";
  const params = (message.params && typeof message.params === "object" ? message.params : {}) as Record<string, unknown>;

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "cortex-mcp", version: SERVER_VERSION },
      instructions: "Read-only Cortex MCP. Gate-backed actions compile, review, and execute only after founder approval. Tools: taste_cortex_query, taste_cortex_compose, taste_cortex_get_blob, semantic_recall, organ_atlas_lookup, capability_hit_evaluate, cortex_health, read_infinite_game_node.",
    }, headers);
  }
  if (method === "ping") return rpcResult(id, {}, headers);
  if (method === "notifications/initialized" || method === "initialized") {
    return new Response(null, { status: 202, headers });
  }
  if (method === "tools/list") {
    return rpcResult(id, { tools: await advertisedTools(env, config, deps) }, headers);
  }
  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    const args = (params.arguments && typeof params.arguments === "object"
      ? params.arguments
      : {}) as Record<string, unknown>;
    if (config.mode === "oauth") {
      if (!readBearer(request)) {
        return toolError(id, "authentication_required", headers, oauthToolChallenge(config, request.url));
      }
      const decision = await authorizeMcpRequest(request, env);
      if (!decision.ok) {
        if (decision.status === 401 || decision.status === 403) {
          const challenge = decision.challenge || oauthToolChallenge(config, request.url);
          return toolError(id, decision.error, headers, challenge);
        }
        return jsonResponse({ error: decision.error }, decision.status, headers);
      }
      return runTool(request, env, config, deps, id, name, args, decision.claims, headers);
    }
    return runTool(request, env, config, deps, id, name, args, undefined, headers);
  }
  return rpcError(id, -32601, `Method not found: ${method}`, 200, headers);
}

export async function handleCortexFetch(request: Request, env: CortexHttpEnv, deps: CortexHttpDeps): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    const cors = corsFor(request, env);
    if (cors.denied) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...cors.headers,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization, Accept",
      },
    });
  }
  if (url.pathname === "/health" || url.pathname === "/v1/health") {
    return jsonResponse({ ok: true, service: "cortex-mcp" }, 200);
  }

  const requestedMode = env.MCP_AUTH_MODE?.trim().toLowerCase();
  let config: AuthConfig;
  try {
    config = resolveAuthConfig(env);
  } catch {
    if (requestedMode === "oauth") {
      return jsonResponse({ error: "MCP authentication is not configured" }, 503);
    }
    if (isLegacyMcpPath(url.pathname) && request.method === "POST") {
      return jsonResponse({ error: "bad or missing context route credential" }, 401);
    }
    return new Response("Not Found", { status: 404 });
  }

  if (url.pathname.startsWith("/.well-known/")) {
    if (config.mode !== "oauth") return new Response("Not Found", { status: 404 });
    const expected = new URL(protectedResourceMetadataUrl(config.resource));
    if (request.method === "GET" && url.origin === expected.origin && url.pathname === expected.pathname) {
      return jsonResponse(protectedResourceMetadata(config), 200);
    }
    return new Response("Not Found", { status: 404 });
  }

  const mcpPath = config.mode === "oauth"
    ? `${url.origin}${url.pathname}` === config.resource
    : isLegacyMcpPath(url.pathname);
  if (!mcpPath) return new Response("Not Found", { status: 404 });
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }

  const cors = corsFor(request, env);
  if (cors.denied) return new Response("Origin denied", { status: 403 });
  const headers = cors.headers;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return rpcError(null, -32000, "Unsupported Media Type", 415, headers);
  }
  if (config.mode === "oauth" && !acceptsStreamable(request.headers.get("accept"))) {
    return rpcError(null, -32000, "Streamable HTTP requests must accept both application/json and text/event-stream", 406, headers);
  }
  if (config.mode === "legacy" && readBearer(request) !== config.routeToken) {
    return jsonResponse({ error: "bad or missing context route credential" }, 401, headers);
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400, headers);
  }

  if (Array.isArray(parsed)) {
    if (config.mode === "oauth" && !readBearer(request)) {
      return jsonResponse({ error: "OAuth access token required" }, 401, {
        ...headers,
        "www-authenticate": oauthChallenge(config, request.url),
      });
    }
    if (config.mode === "oauth") {
      const decision = await authorizeMcpRequest(request, env);
      if (!decision.ok) {
        const responseHeaders = { ...headers };
        if (decision.challenge) responseHeaders["www-authenticate"] = decision.challenge;
        return jsonResponse({ error: decision.error }, decision.status, responseHeaders);
      }
    }
    return rpcError(null, -32600, "Batch requests are not accepted", 400, headers);
  }

  if (!parsed || typeof parsed !== "object") return rpcError(null, -32600, "Invalid Request", 400, headers);
  return handleMessage(request, env, config, deps, parsed as Record<string, unknown>, headers);
}
