import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";
import { digestCanonicalJson } from "./provenance-read.ts";

const ROUTE_TOKEN = "streamable-route-token";
const RESOURCE = "https://cortex.example.com/mcp";
const ISSUER = "https://identity.example.com";
const ACTION_SCOPE = "cambium:act";
const PLUGIN_CLIENT_ID = "chatgpt-cambium-private";
const FOUNDER_SUBJECT = "subject-1";
const PROFILE_KEY = "connected-profile-test-key-material-00000001";
const STREAMABLE_ACCEPT = "application/json, text/event-stream";

function currentFreshnessWindow() {
  const now = Date.now();
  return {
    observed_at: new Date(now - 60_000).toISOString(),
    stale_after: new Date(now + 60 * 60_000).toISOString(),
  };
}

function baseEnv(overrides: Record<string, unknown> = {}) {
  return {
    CONTEXT_ROUTE_TOKEN: ROUTE_TOKEN,
    ENVIRONMENT: "test",
    AI: { run: async () => ({ data: [Array(768).fill(1)] }) },
    TASTE_CORTEX: { query: async () => ({ matches: [] }) },
    ...overrides,
  };
}

function oauthEnv(overrides: Record<string, unknown> = {}) {
  return baseEnv({
    MCP_AUTH_MODE: "oauth",
    MCP_RESOURCE_URL: RESOURCE,
    MCP_AUTHORIZATION_SERVER: ISSUER,
    MCP_REQUIRED_SCOPES: "cortex:read",
    MCP_ACTION_SCOPE: ACTION_SCOPE,
    MCP_PLUGIN_CLIENT_ID: PLUGIN_CLIENT_ID,
    MCP_FOUNDER_SUBJECTS: FOUNDER_SUBJECT,
    MCP_PROFILE_ID_KEY: PROFILE_KEY,
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 4_102_444_800,
          scope: "cortex:read",
          sub: FOUNDER_SUBJECT,
          client_id: PLUGIN_CLIENT_ID,
          tenants: ["cambium"],
        });
      },
    },
    ...overrides,
  });
}

function oauthEnvForTenants(tenants: string[], overrides: Record<string, unknown> = {}) {
  return oauthEnv({
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 4_102_444_800,
          scope: "cortex:read",
          sub: FOUNDER_SUBJECT,
          client_id: PLUGIN_CLIENT_ID,
          tenants,
        });
      },
    },
    ...overrides,
  });
}

function oauthActionEnv(overrides: Record<string, unknown> = {}) {
  return oauthEnv({
    MCP_GATE_ADAPTER_TOKEN: "test-mcp-gate-binding-token-00000001",
    MCP_GATE_ADAPTER: { fetch: async () => Response.json({ error: "not exercised" }, { status: 503 }) },
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 4_102_444_800,
          scope: `cortex:read ${ACTION_SCOPE}`,
          sub: FOUNDER_SUBJECT,
          client_id: PLUGIN_CLIENT_ID,
          tenants: ["cambium"],
        });
      },
    },
    ...overrides,
  });
}

function actionInput() {
  return {
    tenant: "cambium",
    action_kind: "goal-graph.apply-approved-change",
    arguments: { change_digest: `sha256:${"c".repeat(64)}` },
    graph_version: 42,
    nonce: "gate-nonce-0001",
    expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
    idempotency_key: "openai-goal-change-0001",
  };
}

function rpcRequest(
  method: string,
  params: Record<string, unknown> = {},
  options: { oauth?: boolean; accept?: string; contentType?: string; id?: number } = {}
) {
  const headers = new Headers({
    authorization: options.oauth ? "Bearer oauth-access-token" : `Bearer ${ROUTE_TOKEN}`,
    "content-type": options.contentType ?? "application/json",
  });
  if (options.accept !== undefined) headers.set("accept", options.accept);
  return new Request(RESOURCE, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: options.id ?? 1, method, params }),
  });
}

test("SDK Streamable HTTP negotiates initialization and returns server instructions", async () => {
  const response = await worker.fetch(
    rpcRequest("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "cortex-test", version: "1.0.0" },
    }),
    baseEnv() as any
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^application\/json/);
  const payload = await response.json() as any;
  assert.equal(payload.result.protocolVersion, "2025-06-18");
  assert.equal(payload.result.serverInfo.name, "cortex-mcp");
  assert.equal(payload.result.serverInfo.version, "1.7.0");
  assert.equal(payload.result.capabilities.tools.listChanged, undefined);
  assert.match(payload.result.instructions, /Gate-backed actions/);
});

test("legacy bearer requests gain only the missing transport Accept header", async () => {
  const response = await worker.fetch(rpcRequest("tools/list"), baseEnv() as any);
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.tools.length, 8);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("OAuth requests must satisfy the Streamable HTTP Accept contract", async () => {
  const response = await worker.fetch(
    rpcRequest("tools/list", {}, { oauth: true, accept: "application/json" }),
    oauthEnv() as any
  );
  assert.equal(response.status, 406);
  const payload = await response.json() as any;
  assert.equal(payload.error.code, -32000);
  assert.match(payload.error.message, /both application\/json and text\/event-stream/);
});

test("OAuth tool denial returns the OpenAI linking challenge without dispatch", async () => {
  let verifierCalls = 0;
  const env = oauthEnv({
    MCP_TOKEN_VERIFIER: { fetch: async () => { verifierCalls++; return new Response(null, { status: 401 }); } },
  });
  const request = new Request(RESOURCE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: STREAMABLE_ACCEPT },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "cortex_health", arguments: {} },
    }),
  });
  const response = await worker.fetch(request, env as any);
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.id, 9);
  assert.equal(payload.result.isError, true);
  const challenges = payload.result._meta["mcp/www_authenticate"];
  assert.equal(challenges.length, 1);
  assert.match(challenges[0], /resource_metadata=/);
  assert.match(challenges[0], /error="invalid_token"/);
  assert.match(challenges[0], /error_description="Authentication required or access token invalid"/);
  assert.equal(verifierCalls, 0, "missing bearer must not call the verifier binding");
});

test("insufficient-scope tool denial preserves the OpenAI relinking challenge", async () => {
  const env = oauthEnv({
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 4_102_444_800,
          scope: "profile",
          tenants: ["cambium"],
        });
      },
    },
  });
  const response = await worker.fetch(
    rpcRequest("tools/call", {
      name: "cortex_health",
      arguments: {},
    }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 10 }),
    env as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.isError, true);
  const challenge = payload.result._meta["mcp/www_authenticate"][0];
  assert.match(challenge, /error="insufficient_scope"/);
  assert.match(challenge, /error_description="Access token lacks required scopes"/);
  assert.equal(response.headers.get("www-authenticate"), challenge);
});

test("OAuth initialization and tool discovery are public for account linking", async () => {
  let verifierCalls = 0;
  const env = oauthEnv({
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        verifierCalls++;
        return new Response(null, { status: 401 });
      },
    },
  });
  const request = new Request(RESOURCE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: STREAMABLE_ACCEPT },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "unauthenticated", version: "1.0.0" },
      },
    }),
  });
  const response = await worker.fetch(request, env as any);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as any).result.serverInfo.name, "cortex-mcp");

  const list = await worker.fetch(new Request(RESOURCE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: STREAMABLE_ACCEPT },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  }), env as any);
  assert.equal(list.status, 200);
  const listed = await list.json() as any;
  assert.equal(listed.result.tools.length, 13);
  assert.deepEqual(listed.result.tools[0].securitySchemes, [
    { type: "oauth2", scopes: ["cortex:read"] },
  ]);
  assert.equal(verifierCalls, 0, "protocol discovery must not invoke the verifier");
});

test("OpenAI profile discovery uses the standard read-only empty-input contract", async () => {
  const response = await worker.fetch(
    rpcRequest("tools/list", {}, { oauth: true, accept: STREAMABLE_ACCEPT }),
    oauthEnv() as any,
  );
  const payload = await response.json() as any;
  const profile = payload.result.tools.find((tool: any) => tool.name === "get_connected_profile");

  assert.ok(profile);
  assert.deepEqual(profile.inputSchema, {
    type: "object",
    additionalProperties: false,
    properties: {},
  });
  assert.deepEqual(profile.outputSchema, {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: "^prf_[a-f0-9]{64}$" },
      name: { type: "string" },
      email: { type: "string" },
      nickname: { type: "string" },
    },
    required: ["id"],
  });
  assert.equal(profile._meta["openai/profile"], true);
  assert.equal(profile.annotations.readOnlyHint, true);
  assert.equal(profile.annotations.destructiveHint, false);
  assert.equal(profile.annotations.openWorldHint, false);
  assert.equal(profile._meta["cambium/capability"].writer_authority, false);
  assert.deepEqual(profile.securitySchemes, [{ type: "oauth2", scopes: ["cortex:read"] }]);
});

test("connected profile stays stable across tokens and separates verified subjects", async () => {
  let providerCalls = 0;
  let gateCalls = 0;
  const environmentForSubject = (subject: string) => oauthEnv({
    AI: { run: async () => { providerCalls++; return { data: [Array(768).fill(1)] }; } },
    TASTE_CORTEX: { query: async () => { providerCalls++; return { matches: [] }; } },
    MCP_PROVENANCE_READER: { fetch: async () => { providerCalls++; return Response.json({}); } },
    MCP_GATE_ADAPTER: { fetch: async () => { gateCalls++; return Response.json({}); } },
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 4_102_444_800,
          scope: "cortex:read",
          sub: subject,
          client_id: PLUGIN_CLIENT_ID,
          tenants: ["cambium"],
        });
      },
    },
  });
  const call = async (env: ReturnType<typeof oauthEnv>, id: number) => {
    const response = await worker.fetch(
      rpcRequest("tools/call", { name: "get_connected_profile", arguments: {} }, {
        oauth: true,
        accept: STREAMABLE_ACCEPT,
        id,
      }),
      env as any,
    );
    const payload = await response.json() as any;
    assert.equal(payload.result.isError, undefined);
    assert.deepEqual(payload.result.structuredContent, JSON.parse(payload.result.content[0].text));
    return payload.result.structuredContent;
  };

  const first = await call(environmentForSubject("subject-1"), 30);
  const refreshedToken = await call(environmentForSubject("subject-1"), 31);
  const otherSubject = await call(environmentForSubject("subject-2"), 32);

  assert.deepEqual(first, refreshedToken);
  assert.notEqual(first.id, otherSubject.id);
  assert.match(first.id, /^prf_[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(first), ["id"]);
  assert.equal(providerCalls, 0);
  assert.equal(gateCalls, 0);
});

test("missing profile key withholds the tool and missing subject fails closed", async () => {
  const missingKeyResponse = await worker.fetch(
    rpcRequest("tools/list", {}, { oauth: true, accept: STREAMABLE_ACCEPT }),
    oauthEnv({ MCP_PROFILE_ID_KEY: undefined }) as any,
  );
  const missingKeyTools = (await missingKeyResponse.json() as any).result.tools;
  assert.equal(missingKeyTools.some((tool: any) => tool.name === "get_connected_profile"), false);

  const missingSubjectResponse = await worker.fetch(
    rpcRequest("tools/call", { name: "get_connected_profile", arguments: {} }, {
      oauth: true,
      accept: STREAMABLE_ACCEPT,
      id: 33,
    }),
    oauthEnv({
      MCP_TOKEN_VERIFIER: {
        async fetch() {
          return Response.json({
            active: true,
            iss: ISSUER,
            aud: RESOURCE,
            exp: 4_102_444_800,
            scope: "cortex:read",
            client_id: PLUGIN_CLIENT_ID,
            tenants: ["cambium"],
          });
        },
      },
    }) as any,
  );
  const denied = await missingSubjectResponse.json() as any;
  assert.equal(denied.result.isError, true);
  assert.deepEqual(JSON.parse(denied.result.content[0].text), {
    status: "unavailable",
    code: "verified_profile_identity_required",
  });
  assert.equal(JSON.stringify(denied).includes("oauth-access-token"), false);
});

test("incomplete OAuth configuration fails before public protocol discovery", async () => {
  const response = await worker.fetch(new Request(RESOURCE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: STREAMABLE_ACCEPT },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "incomplete", version: "1.0.0" },
      },
    }),
  }), { MCP_AUTH_MODE: "oauth" } as any);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("unauthenticated batch tool calls receive only the HTTP challenge", async () => {
  let verifierCalls = 0;
  const response = await worker.fetch(new Request(RESOURCE, {
    method: "POST",
    headers: { "content-type": "application/json", accept: STREAMABLE_ACCEPT },
    body: JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "cortex_health", arguments: {} } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "cortex_health", arguments: {} } },
    ]),
  }), oauthEnv({
    MCP_TOKEN_VERIFIER: { fetch: async () => { verifierCalls++; return new Response(null, { status: 401 }); } },
  }) as any);
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") || "", /^Bearer resource_metadata=/);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(verifierCalls, 0);
});

test("standard SDK rejects the retired nonstandard server/discover method", async () => {
  const response = await worker.fetch(rpcRequest("server/discover"), baseEnv() as any);
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.error.code, -32601);
  assert.match(payload.error.message, /Method not found/);
});

test("stateless transport uses a fresh server and transport for every request", async () => {
  const first = await worker.fetch(rpcRequest("ping", {}, { id: 1 }), baseEnv() as any);
  const second = await worker.fetch(rpcRequest("ping", {}, { id: 2 }), baseEnv() as any);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstPayload = await first.json() as any;
  const secondPayload = await second.json() as any;
  assert.equal(firstPayload.id, 1);
  assert.equal(secondPayload.id, 2);
  assert.deepEqual(firstPayload.result, {});
  assert.deepEqual(secondPayload.result, {});
});

test("stateless MCP endpoint rejects GET and advertises POST", async () => {
  const response = await worker.fetch(new Request(RESOURCE), baseEnv() as any);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("browser origins are denied unless exactly allowlisted", async () => {
  const request = rpcRequest("tools/list");
  request.headers.set("origin", "https://attacker.example");
  const denied = await worker.fetch(request, baseEnv() as any);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);

  const allowedRequest = rpcRequest("tools/list");
  allowedRequest.headers.set("origin", "https://chatgpt.example");
  const allowed = await worker.fetch(
    allowedRequest,
    baseEnv({ MCP_ALLOWED_ORIGINS: "https://chatgpt.example" }) as any
  );
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://chatgpt.example");
  assert.match(allowed.headers.get("vary") || "", /Origin/);
});

test("OAuth aliases cannot contradict the configured resource identifier", async () => {
  const aliasRequest = new Request("https://cortex.example.com/v1/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer oauth-access-token",
      "content-type": "application/json",
      accept: STREAMABLE_ACCEPT,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list", params: {} }),
  });
  const response = await worker.fetch(aliasRequest, oauthEnv() as any);
  assert.equal(response.status, 404);
});

test("OAuth semantic recall is bound to verifier-authorized tenants", async () => {
  let aiCalls = 0;
  const request = rpcRequest("tools/call", {
    name: "semantic_recall",
    arguments: { tenant: "thoughtseed", query: "private memory" },
  }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 8 });
  const response = await worker.fetch(request, oauthEnv({
    AI: { run: async () => { aiCalls++; return { data: [Array(768).fill(1)] }; } },
    CONTEXT_ALLOWED_TENANTS: "cambium,thoughtseed",
  }) as any);
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.isError, true);
  assert.match(payload.result.content[0].text, /unauthorized_tenant/);
  assert.equal(aiCalls, 0);
});

test("SDK transport rejects non-JSON media before any handler", async () => {
  const response = await worker.fetch(
    rpcRequest("tools/list", {}, { contentType: "text/plain" }),
    baseEnv() as any
  );
  assert.equal(response.status, 415);
  const payload = await response.json() as any;
  assert.equal(payload.error.code, -32000);
});

test("every advertised tool carries a complete Cambium capability contract", async () => {
  const response = await worker.fetch(
    rpcRequest("tools/list", {}, { oauth: true, accept: STREAMABLE_ACCEPT }),
    oauthEnv() as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.tools.length, 13);
  for (const tool of payload.result.tools) {
    assert.equal(typeof tool.title, "string");
    assert.ok(tool.title.length > 0);
    const contract = tool._meta["cambium/capability"];
    assert.equal(contract.schema, "cambium.openai.tool_capability.v1");
    assert.equal(contract.name, tool.name);
    assert.match(contract.classification, /^(read|approval-gated-action)$/);
    assert.equal(typeof contract.resource, "string");
    assert.ok(contract.resource.length > 0);
    assert.equal(typeof contract.tenant.mode, "string");
    assert.equal(contract.credential_owner, ISSUER);
    if (contract.classification === "read") {
      assert.equal(contract.approval_requirement, "none");
      assert.equal(contract.idempotency, "safe-repeat");
      assert.equal(contract.terminal_receipt, "none:read-envelope-is-not-canonical-completion");
    } else {
      assert.match(contract.approval_requirement, /founder/);
      assert.match(contract.idempotency, /replay/);
      if (tool.name === "compile_action_intent") {
        assert.match(contract.terminal_receipt, /none:compiled/);
      } else if (tool.name === "request_action_approval") {
        assert.match(contract.terminal_receipt, /none:review-request/);
      } else if (tool.name === "get_action_approval_status") {
        assert.match(contract.terminal_receipt, /none:status/);
      } else {
        assert.match(contract.terminal_receipt, /authoritative-readback/);
      }
    }
    assert.equal(contract.writer_authority, false);
  }
});

test("every tool denies an unauthorized tenant before provider dispatch", async () => {
  const calls = [
    { name: "taste_cortex_query", arguments: { intent: "test" } },
    { name: "taste_cortex_compose", arguments: { intent: "test" } },
    { name: "taste_cortex_get_blob", arguments: { id: "test" } },
    { name: "read_infinite_game_node", arguments: { tenant: "cambium", node_kind: "mission", node_id: "current" } },
    { name: "semantic_recall", arguments: { tenant: "cambium", query: "test" } },
    { name: "organ_atlas_lookup", arguments: { organId: "cambium.taste" } },
    {
      name: "capability_hit_evaluate",
      arguments: {
        taskFingerprint: "task",
        taskSummary: "test",
        topicKey: "dev",
        candidateCapabilityId: "cambium.taste",
      },
    },
    { name: "cortex_health", arguments: {} },
  ];
  for (const [tenantCase, tenants] of [["mismatched", ["unrelated"]], ["missing", []]] as const) {
    let providerCalls = 0;
    const env = oauthEnvForTenants([...tenants], {
      AI: { run: async () => { providerCalls++; return { data: [Array(768).fill(1)] }; } },
      TASTE_CORTEX: {
        query: async () => { providerCalls++; return { matches: [] }; },
        getByIds: async () => { providerCalls++; return []; },
      },
      TASTE_BLOBS: {
        get: async () => { providerCalls++; return null; },
      },
      MCP_PROVENANCE_READER: {
        fetch: async () => { providerCalls++; return Response.json({}); },
      },
    });
    for (const [index, call] of calls.entries()) {
      const response = await worker.fetch(
        rpcRequest("tools/call", call, { oauth: true, accept: STREAMABLE_ACCEPT, id: 40 + index }),
        env as any
      );
      assert.equal(response.status, 200);
      const payload = await response.json() as any;
      assert.equal(payload.result.isError, true, `${call.name} must fail closed for ${tenantCase} claims`);
      assert.match(payload.result.content[0].text, /unauthorized_tenant/);
    }
    assert.equal(providerCalls, 0, `${tenantCase} tenant claims must produce zero provider calls`);
  }
});

test("authenticated infinite-game read returns structured provenance", async () => {
  const body = { status: "active", summary: "Mission evidence" };
  const freshness = currentFreshnessWindow();
  let readerCalls = 0;
  const env = oauthEnv({
    MCP_PROVENANCE_READER: {
      async fetch(_input: Request | string, init?: RequestInit) {
        readerCalls++;
        const requested = JSON.parse(String(init?.body));
        assert.equal(requested.tenant, "cambium");
        return Response.json({
          schema: "cambium.provenance_source.v1",
          tenant: "cambium",
          node_kind: "mission",
          node_id: "current",
          source_authority: "mission",
          source_reference: "repo:MISSION.md",
          source_version: "git:abc123",
          graph_version: "42",
          ...freshness,
          content_digest: await digestCanonicalJson(body),
          omissions: [],
          body,
        });
      },
    },
  });
  const response = await worker.fetch(
    rpcRequest("tools/call", {
      name: "read_infinite_game_node",
      arguments: {
        tenant: "cambium",
        node_kind: "mission",
        node_id: "current",
        graph_version: "42",
        max_bytes: 4096,
      },
    }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 21 }),
    env as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.isError, undefined);
  assert.equal(payload.result.structuredContent.schema, "cambium.mcp.read_envelope.v1");
  assert.equal(payload.result.structuredContent.tenant, "cambium");
  assert.equal(payload.result.structuredContent.content_digest, await digestCanonicalJson(body));
  assert.equal(payload.result.structuredContent.writer_authority, false);
  assert.equal(readerCalls, 1);
});

test("infinite-game read rejects sensitive source content without reflecting it", async () => {
  const secret = "sk-provenance-must-never-escape";
  const body = { summary: secret };
  const freshness = currentFreshnessWindow();
  const response = await worker.fetch(
    rpcRequest("tools/call", {
      name: "read_infinite_game_node",
      arguments: {
        tenant: "cambium",
        node_kind: "mission",
        node_id: "current",
      },
    }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 24 }),
    oauthEnv({
      MCP_PROVENANCE_READER: {
        async fetch() {
          return Response.json({
            schema: "cambium.provenance_source.v1",
            tenant: "cambium",
            node_kind: "mission",
            node_id: "current",
            source_authority: "mission",
            source_reference: "repo:MISSION.md",
            source_version: "git:abc123",
            graph_version: null,
            ...freshness,
            content_digest: await digestCanonicalJson(body),
            omissions: [],
            body,
          });
        },
      },
    }) as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.isError, true);
  assert.match(payload.result.content[0].text, /sensitive_content/);
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(secret));
});

test("infinite-game read denies cross-tenant calls before reader dispatch", async () => {
  let readerCalls = 0;
  const response = await worker.fetch(
    rpcRequest("tools/call", {
      name: "read_infinite_game_node",
      arguments: {
        tenant: "thoughtseed",
        node_kind: "mission",
        node_id: "current",
      },
    }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 22 }),
    oauthEnv({
      MCP_PROVENANCE_READER: {
        async fetch() {
          readerCalls++;
          return Response.json({});
        },
      },
    }) as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.isError, true);
  assert.match(payload.result.content[0].text, /unauthorized_tenant/);
  assert.equal(readerCalls, 0);
});

test("infinite-game read fails closed when the source binding is absent", async () => {
  const response = await worker.fetch(
    rpcRequest("tools/call", {
      name: "read_infinite_game_node",
      arguments: {
        tenant: "cambium",
        node_kind: "mission",
        node_id: "current",
      },
    }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 23 }),
    oauthEnv() as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.isError, true);
  assert.match(payload.result.content[0].text, /read_plane_unavailable/);
});

test("OAuth discovery exposes compile, review, status, and execute with distinct safe annotations and action scope", async () => {
  const response = await worker.fetch(
    rpcRequest("tools/list", {}, { oauth: true, accept: STREAMABLE_ACCEPT, id: 61 }),
    oauthActionEnv() as any,
  );
  const payload = await response.json() as any;
  const compile = payload.result.tools.find((tool: any) => tool.name === "compile_action_intent");
  const requestApproval = payload.result.tools.find((tool: any) => tool.name === "request_action_approval");
  const approvalStatus = payload.result.tools.find((tool: any) => tool.name === "get_action_approval_status");
  const execute = payload.result.tools.find((tool: any) => tool.name === "execute_approved_action");
  assert.ok(compile);
  assert.ok(requestApproval);
  assert.ok(approvalStatus);
  assert.ok(execute);
  assert.equal(compile.annotations.readOnlyHint, true);
  assert.equal(compile.annotations.destructiveHint, false);
  assert.equal(requestApproval.annotations.readOnlyHint, false);
  assert.equal(requestApproval.annotations.destructiveHint, false);
  assert.equal(approvalStatus.annotations.readOnlyHint, true);
  assert.equal(approvalStatus.annotations.destructiveHint, false);
  assert.equal(execute.annotations.readOnlyHint, false);
  assert.equal(execute.annotations.destructiveHint, true);
  assert.equal(execute.annotations.idempotentHint, true);
  assert.deepEqual(execute.securitySchemes, [{ type: "oauth2", scopes: ["cortex:read", ACTION_SCOPE] }]);
  assert.deepEqual(execute._meta.securitySchemes, execute.securitySchemes);
  assert.equal(execute.inputSchema.additionalProperties, false);
  assert.equal(execute.inputSchema.properties.actor, undefined);
  assert.equal(execute.inputSchema.properties.argument_digest, undefined);
});

test("read-only and legacy credentials cannot dispatch any action", async () => {
  for (const [label, env, oauth] of [
    ["read-only", oauthEnv(), true],
    ["legacy", baseEnv(), false],
  ] as const) {
    let gateCalls = 0;
    (env as any).MCP_GATE_ADAPTER = { fetch: async () => { gateCalls++; return Response.json({}); } };
    const response = await worker.fetch(
      rpcRequest("tools/call", {
        name: "execute_approved_action",
        arguments: { ...actionInput(), approval_digest: `sha256:${"a".repeat(64)}` },
      }, { oauth, accept: oauth ? STREAMABLE_ACCEPT : undefined, id: 62 }),
      env as any,
    );
    const payload = await response.json() as any;
    assert.equal(payload.result.isError, true, label);
    assert.match(payload.result.content[0].text, /oauth_action_required|action_scope_required/, label);
    if (label === "read-only") {
      assert.match(payload.result._meta["mcp/www_authenticate"][0], /scope="cortex:read cambium:act"/);
    }
    assert.equal(gateCalls, 0, label);
  }
});

test("founder, client, tenant, and closed-schema admission all run before Gate dispatch", async () => {
  const cases = [
    {
      label: "non-founder",
      claims: { sub: "not-founder", client_id: PLUGIN_CLIENT_ID, tenants: ["cambium"] },
      args: { ...actionInput(), approval_digest: `sha256:${"a".repeat(64)}` },
      code: "founder_required",
    },
    {
      label: "wrong client",
      claims: { sub: FOUNDER_SUBJECT, client_id: "other-plugin", tenants: ["cambium"] },
      args: { ...actionInput(), approval_digest: `sha256:${"a".repeat(64)}` },
      code: "plugin_identity_mismatch",
    },
    {
      label: "cross-tenant",
      claims: { sub: FOUNDER_SUBJECT, client_id: PLUGIN_CLIENT_ID, tenants: ["other-tenant"] },
      args: { ...actionInput(), approval_digest: `sha256:${"a".repeat(64)}` },
      code: "unauthorized_tenant",
    },
    {
      label: "unknown field",
      claims: { sub: FOUNDER_SUBJECT, client_id: PLUGIN_CLIENT_ID, tenants: ["cambium"] },
      args: { ...actionInput(), approval_digest: `sha256:${"a".repeat(64)}`, actor: FOUNDER_SUBJECT },
      code: "bad_input",
    },
  ];
  for (const [index, entry] of cases.entries()) {
    let gateCalls = 0;
    const env = oauthActionEnv({
      MCP_TOKEN_VERIFIER: {
        async fetch() {
          return Response.json({
            active: true,
            iss: ISSUER,
            aud: RESOURCE,
            exp: 4_102_444_800,
            scope: `cortex:read ${ACTION_SCOPE}`,
            ...entry.claims,
          });
        },
      },
      MCP_GATE_ADAPTER: { fetch: async () => { gateCalls++; return Response.json({}); } },
    });
    const response = await worker.fetch(
      rpcRequest("tools/call", { name: "execute_approved_action", arguments: entry.args }, {
        oauth: true,
        accept: STREAMABLE_ACCEPT,
        id: 70 + index,
      }),
      env as any,
    );
    const payload = await response.json() as any;
    assert.equal(payload.result.isError, true, entry.label);
    assert.match(payload.result.content[0].text, new RegExp(entry.code), entry.label);
    assert.equal(gateCalls, 0, entry.label);
  }
});

test("action-scoped founder can request and read approval without executing", async () => {
  const requestDigest = `sha256:${"d".repeat(64)}`;
  const approvalDigest = `sha256:${"a".repeat(64)}`;
  const targets: string[] = [];
  const gate = {
    async fetch(target: Request | string, init?: RequestInit) {
      targets.push(String(target));
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-mcp-gate-binding-token-00000001");
      const request = JSON.parse(String(init?.body));
      const intent = request.intent;
      if (String(target).endsWith("/request-approval")) {
        assert.deepEqual(request.arguments, actionInput().arguments);
        return Response.json({
          schema: "cambium.gate.action_review_response.v1",
          status: "awaiting_founder_approval",
          duplicate: false,
          tenant: intent.tenant,
          action_digest: intent.action_digest,
          request_digest: requestDigest,
          approval_digest: null,
          expiry: intent.expiry,
        });
      }
      assert.equal(String(target).endsWith("/approval-status"), true);
      assert.equal(request.arguments, undefined);
      return Response.json({
        schema: "cambium.gate.action_review_status.v1",
        status: "approved",
        tenant: intent.tenant,
        action_digest: intent.action_digest,
        request_digest: requestDigest,
        approval_digest: approvalDigest,
        receipt_digest: null,
        expiry: intent.expiry,
        writer_authority: false,
        canonical_completion: false,
      });
    },
  };
  const env = oauthActionEnv({ MCP_GATE_ADAPTER: gate });
  const tuple = actionInput();
  const requestedResponse = await worker.fetch(
    rpcRequest("tools/call", { name: "request_action_approval", arguments: tuple }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 78 }),
    env as any,
  );
  const requested = (await requestedResponse.json() as any).result;
  assert.equal(requested.isError, undefined);
  assert.equal(requested.structuredContent.status, "awaiting_founder_approval");
  assert.equal(requested.structuredContent.writer_authority, false);
  assert.equal(requested.structuredContent.canonical_completion, false);

  const statusResponse = await worker.fetch(
    rpcRequest("tools/call", { name: "get_action_approval_status", arguments: tuple }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 79 }),
    env as any,
  );
  const status = (await statusResponse.json() as any).result;
  assert.equal(status.isError, undefined);
  assert.equal(status.structuredContent.status, "approved");
  assert.equal(status.structuredContent.approval_digest, approvalDigest);
  assert.equal(status.structuredContent.canonical_completion, false);
  assert.deepEqual(targets, [
    "https://cambium-gate.internal/mcp/actions/request-approval",
    "https://cambium-gate.internal/mcp/actions/approval-status",
  ]);
});

test("action-scoped founder compiles and executes only through matching authoritative Gate readback", async () => {
  let gateCalls = 0;
  const gate = {
    async fetch(_target: Request | string, init?: RequestInit) {
      gateCalls++;
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-mcp-gate-binding-token-00000001");
      const request = JSON.parse(String(init?.body));
      const intent = request.intent;
      const receiptDigest = `sha256:${"b".repeat(64)}`;
      return Response.json({
        schema: "cambium.gate.action_response.v1",
        status: "committed",
        receipt: {
          schema: "cambium.gate.action_receipt.v1",
          tenant: intent.tenant,
          actor: intent.actor,
          plugin_identity: intent.plugin_identity,
          mcp_identity: intent.mcp_identity,
          issuer: intent.issuer,
          action_kind: intent.action_kind,
          argument_digest: intent.argument_digest,
          action_digest: intent.action_digest,
          graph_version: intent.graph_version,
          nonce: intent.nonce,
          expiry: intent.expiry,
          idempotency_key: intent.idempotency_key,
          approval_digest: request.approval_digest,
          mutation_count: 1,
          terminal_outcome: "accepted",
          receipt_digest: receiptDigest,
          authoritative_readback: {
            schema: "cambium.gate.authoritative_readback.v1",
            tenant: intent.tenant,
            actor: intent.actor,
            action_digest: intent.action_digest,
            graph_version: intent.graph_version,
            terminal_outcome: "accepted",
            receipt_digest: receiptDigest,
          },
        },
      });
    },
  };
  const env = oauthActionEnv({ MCP_GATE_ADAPTER: gate });

  const compiledResponse = await worker.fetch(
    rpcRequest("tools/call", { name: "compile_action_intent", arguments: actionInput() }, {
      oauth: true,
      accept: STREAMABLE_ACCEPT,
      id: 80,
    }),
    env as any,
  );
  const compiled = (await compiledResponse.json() as any).result;
  assert.equal(compiled.structuredContent.actor, FOUNDER_SUBJECT);
  assert.equal(compiled.structuredContent.plugin_identity, PLUGIN_CLIENT_ID);
  assert.equal(compiled.structuredContent.writer_authority, false);
  assert.equal(gateCalls, 0, "compile must not call Gate or write state");

  const executedResponse = await worker.fetch(
    rpcRequest("tools/call", {
      name: "execute_approved_action",
      arguments: { ...actionInput(), approval_digest: `sha256:${"a".repeat(64)}` },
    }, { oauth: true, accept: STREAMABLE_ACCEPT, id: 81 }),
    env as any,
  );
  const executed = (await executedResponse.json() as any).result;
  assert.equal(executed.isError, undefined);
  assert.equal(executed.structuredContent.status, "committed");
  assert.equal(executed.structuredContent.canonical_completion, true);
  assert.equal(executed.structuredContent.writer_authority, false);
  assert.equal(gateCalls, 1);
});
