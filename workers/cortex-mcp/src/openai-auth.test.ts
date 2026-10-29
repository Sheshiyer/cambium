import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";
import {
  authorizeMcpRequest,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  resolveAuthConfig,
  validateVerifiedClaims,
} from "./openai-auth.ts";

const RESOURCE = "https://cortex.example.com/mcp";
const ISSUER = "https://identity.example.com";
const PROFILE_KEY = "connected-profile-test-key-material-00000001";

function oauthEnv(overrides: Record<string, unknown> = {}) {
  return {
    MCP_AUTH_MODE: "oauth",
    MCP_RESOURCE_URL: RESOURCE,
    MCP_AUTHORIZATION_SERVER: ISSUER,
    MCP_REQUIRED_SCOPES: "cortex:read profile",
    MCP_PROFILE_ID_KEY: PROFILE_KEY,
    MCP_TOKEN_VERIFIER: {
      async fetch() {
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 4_102_444_800,
          scope: "cortex:read profile",
          sub: "subject-1",
          tenants: ["cambium"],
        });
      },
    },
    ...overrides,
  };
}

test("auth config preserves legacy mode and fails closed for incomplete OAuth", () => {
  assert.deepEqual(resolveAuthConfig({ CONTEXT_ROUTE_TOKEN: "route-secret" }), {
    mode: "legacy",
    routeToken: "route-secret",
  });
  assert.throws(
    () => resolveAuthConfig({ MCP_AUTH_MODE: "oauth", CONTEXT_ROUTE_TOKEN: "route-secret" }),
    /oauth MCP auth requires/
  );
  assert.throws(() => resolveAuthConfig({ MCP_AUTH_MODE: "mixed" }), /legacy or oauth/);
});

test("OAuth metadata names the external issuer without impersonating its discovery document", () => {
  const config = resolveAuthConfig(oauthEnv());
  assert.equal(config.mode, "oauth");
  if (config.mode !== "oauth") throw new Error("expected oauth config");
  assert.deepEqual(protectedResourceMetadata(config), {
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: ["cortex:read", "profile"],
    bearer_methods_supported: ["header"],
  });
  assert.equal(
    protectedResourceMetadataUrl(RESOURCE),
    "https://cortex.example.com/.well-known/oauth-protected-resource/mcp"
  );
});

test("verified claims require exact issuer, audience, time window, and every scope", () => {
  const config = resolveAuthConfig(oauthEnv());
  if (config.mode !== "oauth") throw new Error("expected oauth config");
  const valid = {
    active: true as const,
    iss: ISSUER,
    aud: ["another-audience", RESOURCE],
    exp: 200,
    nbf: 50,
    scope: "profile cortex:read",
  };
  assert.equal(validateVerifiedClaims(valid, config, 100), true);
  assert.equal(validateVerifiedClaims({ ...valid, iss: "https://attacker.invalid" }, config, 100), false);
  assert.equal(validateVerifiedClaims({ ...valid, aud: "another-audience" }, config, 100), false);
  assert.equal(validateVerifiedClaims({ ...valid, exp: 100 }, config, 100), false);
  assert.equal(validateVerifiedClaims({ ...valid, nbf: 101 }, config, 100), false);
  assert.equal(validateVerifiedClaims({ ...valid, scope: "cortex:read" }, config, 100), false);
});

test("OAuth identifiers preserve exact trailing-slash semantics", () => {
  const exactIssuer = `${ISSUER}/`;
  const exactResource = `${RESOURCE}/`;
  const config = resolveAuthConfig(oauthEnv({
    MCP_AUTHORIZATION_SERVER: exactIssuer,
    MCP_RESOURCE_URL: exactResource,
  }));
  if (config.mode !== "oauth") throw new Error("expected oauth config");
  assert.equal(config.authorizationServer, exactIssuer);
  assert.equal(config.resource, exactResource);

  const claims = {
    active: true as const,
    iss: exactIssuer,
    aud: exactResource,
    exp: 200,
    scope: "cortex:read profile",
  };
  assert.equal(validateVerifiedClaims(claims, config, 100), true);
  assert.equal(validateVerifiedClaims({ ...claims, iss: ISSUER }, config, 100), false);
  assert.equal(validateVerifiedClaims({ ...claims, aud: RESOURCE }, config, 100), false);
});

test("OAuth identifiers reject fragments, embedded credentials, and non-HTTPS URLs", () => {
  assert.throws(
    () => resolveAuthConfig(oauthEnv({ MCP_AUTHORIZATION_SERVER: `${ISSUER}/#fragment` })),
    /must not contain a fragment/
  );
  assert.throws(
    () => resolveAuthConfig(oauthEnv({ MCP_AUTHORIZATION_SERVER: "https://user:pass@identity.example.com" })),
    /must not contain credentials/
  );
  assert.throws(
    () => resolveAuthConfig(oauthEnv({ MCP_RESOURCE_URL: "http://cortex.example.com/mcp" })),
    /must use https/
  );
  assert.throws(
    () => resolveAuthConfig(oauthEnv({ MCP_AUTHORIZATION_SERVER: `${ISSUER}?tenant=one` })),
    /must not contain a query/
  );
  assert.throws(
    () => resolveAuthConfig(oauthEnv({ MCP_TOKEN_VERIFIER: {} })),
    /requires MCP_RESOURCE_URL/
  );
});

test("OAuth authorization delegates verification and refuses legacy-token downgrade", async () => {
  let calls = 0;
  const env = oauthEnv({
    CONTEXT_ROUTE_TOKEN: "legacy-route-token",
    MCP_TOKEN_VERIFIER: {
      async fetch(input: Request | string, init?: RequestInit) {
        calls++;
        assert.equal(String(input), "https://mcp-token-verifier.internal/verify");
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer oauth-access-token");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          resource: RESOURCE,
          required_scopes: ["cortex:read", "profile"],
        });
        return Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 200,
          scopes: ["cortex:read", "profile"],
        });
      },
    },
  });
  const accepted = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "Bearer oauth-access-token" } }),
    env,
    100
  );
  assert.equal(accepted.ok, true);
  assert.equal(calls, 1);

  const rejected = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "Bearer legacy-route-token" } }),
    oauthEnv({ CONTEXT_ROUTE_TOKEN: "legacy-route-token", MCP_TOKEN_VERIFIER: { fetch: async () => new Response(null, { status: 401 }) } }),
    100
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 401);
});

test("OAuth denial carries protected-resource discovery challenge", async () => {
  const denied = await authorizeMcpRequest(new Request(RESOURCE), oauthEnv(), 100);
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 401);
  assert.match(denied.challenge || "", /^Bearer resource_metadata=/);
  assert.match(denied.challenge || "", /scope="cortex:read profile"/);
});

test("bearer parsing is case-insensitive and permits RFC whitespace", async () => {
  let verifierCalls = 0;
  const decision = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "bEaReR   oauth-access-token  " } }),
    oauthEnv({
      MCP_TOKEN_VERIFIER: {
        async fetch(_input: Request | string, init?: RequestInit) {
          verifierCalls++;
          assert.equal(new Headers(init?.headers).get("authorization"), "Bearer oauth-access-token");
          return Response.json({
            active: true,
            iss: ISSUER,
            aud: RESOURCE,
            exp: 200,
            scope: "cortex:read profile",
          });
        },
      },
    }),
    100
  );
  assert.equal(decision.ok, true);
  assert.equal(verifierCalls, 1);
});

test("verifier outages remain service failures rather than account-linking denials", async () => {
  const decision = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "Bearer oauth-access-token" } }),
    oauthEnv({ MCP_TOKEN_VERIFIER: { fetch: async () => new Response(null, { status: 503 }) } }),
    100
  );
  assert.deepEqual(decision, {
    ok: false,
    status: 503,
    error: "OAuth token verifier unavailable",
  });
});

test("insufficient scope and verifier throttling preserve distinct HTTP semantics", async () => {
  const missingScope = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "Bearer oauth-access-token" } }),
    oauthEnv({
      MCP_TOKEN_VERIFIER: {
        fetch: async () => Response.json({
          active: true,
          iss: ISSUER,
          aud: RESOURCE,
          exp: 200,
          scope: "cortex:read",
        }),
      },
    }),
    100
  );
  assert.equal(missingScope.ok, false);
  assert.equal(missingScope.status, 403);
  assert.match(missingScope.challenge || "", /error="insufficient_scope"/);

  const forbidden = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "Bearer oauth-access-token" } }),
    oauthEnv({ MCP_TOKEN_VERIFIER: { fetch: async () => new Response(null, { status: 403 }) } }),
    100
  );
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.status, 403);

  const throttled = await authorizeMcpRequest(
    new Request(RESOURCE, { headers: { authorization: "Bearer oauth-access-token" } }),
    oauthEnv({ MCP_TOKEN_VERIFIER: { fetch: async () => new Response(null, { status: 429 }) } }),
    100
  );
  assert.deepEqual(throttled, {
    ok: false,
    status: 429,
    error: "OAuth token verifier rate limited",
  });
});

test("worker publishes protected-resource metadata only in complete OAuth mode", async () => {
  const url = "https://cortex.example.com/.well-known/oauth-protected-resource/mcp";
  const oauth = await worker.fetch(new Request(url), oauthEnv() as any);
  assert.equal(oauth.status, 200);
  assert.equal((await oauth.json()).resource, RESOURCE);

  const rootAlias = await worker.fetch(
    new Request("https://cortex.example.com/.well-known/oauth-protected-resource"),
    oauthEnv() as any
  );
  assert.equal(rootAlias.status, 404);

  const legacy = await worker.fetch(new Request(url), { CONTEXT_ROUTE_TOKEN: "legacy" } as any);
  assert.equal(legacy.status, 404);

  const incomplete = await worker.fetch(
    new Request(url),
    { MCP_AUTH_MODE: "oauth", CONTEXT_ROUTE_TOKEN: "legacy" } as any
  );
  assert.equal(incomplete.status, 503);
});

test("OAuth tools advertise read-only annotations and matching security schemes", async () => {
  const response = await worker.fetch(
    new Request(RESOURCE, {
      method: "POST",
      headers: {
        authorization: "Bearer oauth-access-token",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
    oauthEnv() as any
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as any;
  assert.equal(payload.result.tools.length, 9);
  for (const tool of payload.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.deepEqual(tool.securitySchemes, [{ type: "oauth2", scopes: ["cortex:read", "profile"] }]);
    assert.deepEqual(tool._meta.securitySchemes, tool.securitySchemes);
  }
  assert.equal(
    payload.result.tools.find((tool: any) => tool.name === "semantic_recall").annotations.openWorldHint,
    false
  );
  const infiniteGameRead = payload.result.tools.find((tool: any) => tool.name === "read_infinite_game_node");
  assert.ok(infiniteGameRead.outputSchema);
  assert.equal(infiniteGameRead.outputSchema.additionalProperties, false);
  for (const field of ["node_kind", "node_id", "source_authority", "source_reference", "source_version", "graph_version", "content_digest", "freshness", "omissions", "body"]) {
    assert.ok(infiniteGameRead.outputSchema.properties[field], field);
  }
  assert.equal(infiniteGameRead.outputSchema.properties.freshness.additionalProperties, false);
  assert.equal(infiniteGameRead.outputSchema.properties.omissions.maxItems, 32);
});
