export interface TokenVerifierBinding {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface AuthEnv {
  CONTEXT_ROUTE_TOKEN?: string;
  MCP_AUTH_MODE?: string;
  MCP_RESOURCE_URL?: string;
  MCP_AUTHORIZATION_SERVER?: string;
  MCP_REQUIRED_SCOPES?: string;
  MCP_ACTION_SCOPE?: string;
  MCP_TOKEN_VERIFIER?: TokenVerifierBinding;
}

export type AuthConfig =
  | { mode: "legacy"; routeToken: string }
  | {
      mode: "oauth";
      resource: string;
      authorizationServer: string;
      requiredScopes: string[];
      supportedScopes: string[];
      verifier: TokenVerifierBinding;
    };

export interface VerifiedTokenClaims {
  active: true;
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  scope?: string;
  scopes?: string[];
  sub?: string;
  client_id?: string;
  azp?: string;
  tenant?: string;
  tenants?: string[];
}

export type AuthDecision =
  | { ok: true; mode: AuthConfig["mode"]; claims?: VerifiedTokenClaims }
  | { ok: false; status: 401 | 403 | 429 | 503; error: string; challenge?: string };

const SCOPE_PATTERN = /^[A-Za-z0-9._:/-]+$/;

function validatedHttpsIdentifier(value: string, label: string): string {
  const exact = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(exact);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https`);
  }
  if (parsed.hash) {
    throw new Error(`${label} must not contain a fragment`);
  }
  if (parsed.search) {
    throw new Error(`${label} must not contain a query`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain credentials`);
  }
  // OAuth issuer and resource identifiers are exact strings. Validation must
  // not silently rewrite trailing slashes, casing, paths, or percent-encoding.
  return exact;
}

function parseScopes(value: string | undefined, label = "MCP_REQUIRED_SCOPES"): string[] {
  const scopes = (value || "")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (scopes.length === 0 || scopes.some((scope) => !SCOPE_PATTERN.test(scope))) {
    throw new Error(`${label} must contain valid scope tokens`);
  }
  return [...new Set(scopes)];
}

export function resolveAuthConfig(env: AuthEnv): AuthConfig {
  const mode = env.MCP_AUTH_MODE?.trim().toLowerCase();

  // Preserve the existing Hermes contract only when OAuth has not been selected.
  if (!mode || mode === "legacy") {
    if (!env.CONTEXT_ROUTE_TOKEN) {
      throw new Error("legacy MCP auth requires CONTEXT_ROUTE_TOKEN");
    }
    return { mode: "legacy", routeToken: env.CONTEXT_ROUTE_TOKEN };
  }

  if (mode !== "oauth") {
    throw new Error("MCP_AUTH_MODE must be legacy or oauth");
  }

  if (
    !env.MCP_RESOURCE_URL ||
    !env.MCP_AUTHORIZATION_SERVER ||
    !env.MCP_REQUIRED_SCOPES ||
    !env.MCP_TOKEN_VERIFIER ||
    typeof env.MCP_TOKEN_VERIFIER.fetch !== "function"
  ) {
    throw new Error(
      "oauth MCP auth requires MCP_RESOURCE_URL, MCP_AUTHORIZATION_SERVER, MCP_REQUIRED_SCOPES, and MCP_TOKEN_VERIFIER"
    );
  }

  const requiredScopes = parseScopes(env.MCP_REQUIRED_SCOPES);
  const actionScopes = env.MCP_ACTION_SCOPE
    ? parseScopes(env.MCP_ACTION_SCOPE, "MCP_ACTION_SCOPE")
    : [];
  return {
    mode: "oauth",
    resource: validatedHttpsIdentifier(env.MCP_RESOURCE_URL, "MCP_RESOURCE_URL"),
    authorizationServer: validatedHttpsIdentifier(
      env.MCP_AUTHORIZATION_SERVER,
      "MCP_AUTHORIZATION_SERVER"
    ),
    requiredScopes,
    supportedScopes: [...new Set([...requiredScopes, ...actionScopes])],
    verifier: env.MCP_TOKEN_VERIFIER,
  };
}

export function protectedResourceMetadata(config: Extract<AuthConfig, { mode: "oauth" }>) {
  return {
    resource: config.resource,
    authorization_servers: [config.authorizationServer],
    scopes_supported: config.supportedScopes,
    bearer_methods_supported: ["header"],
  };
}

export function protectedResourceMetadataUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}/.well-known/oauth-protected-resource${path}`;
}

export function oauthChallenge(
  config: Extract<AuthConfig, { mode: "oauth" }>,
  requestUrl: string,
  scopes: readonly string[] = config.requiredScopes,
): string {
  return `Bearer resource_metadata="${protectedResourceMetadataUrl(requestUrl)}", scope="${scopes.join(" ")}"`;
}

export function oauthToolChallenge(
  config: Extract<AuthConfig, { mode: "oauth" }>,
  requestUrl: string,
  scopes: readonly string[] = config.requiredScopes,
): string {
  return `${oauthChallenge(config, requestUrl, scopes)}, error="invalid_token", error_description="Authentication required or access token invalid"`;
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+([^\s]+)\s*$/i.exec(header);
  return match?.[1] || null;
}

function claimScopes(claims: VerifiedTokenClaims): Set<string> {
  const scopes = [
    ...(typeof claims.scope === "string" ? claims.scope.split(/\s+/) : []),
    ...(Array.isArray(claims.scopes) ? claims.scopes : []),
  ].filter(Boolean);
  return new Set(scopes);
}

function validateVerifiedIdentityClaims(
  claims: unknown,
  config: Extract<AuthConfig, { mode: "oauth" }>,
  nowEpochSeconds: number
): claims is VerifiedTokenClaims {
  if (!claims || typeof claims !== "object") return false;
  const candidate = claims as Partial<VerifiedTokenClaims>;
  if (candidate.active !== true || candidate.iss !== config.authorizationServer) return false;
  if (!Number.isFinite(candidate.exp) || Number(candidate.exp) <= nowEpochSeconds) return false;
  if (candidate.nbf !== undefined && (!Number.isFinite(candidate.nbf) || Number(candidate.nbf) > nowEpochSeconds)) {
    return false;
  }

  const audiences = Array.isArray(candidate.aud) ? candidate.aud : [candidate.aud];
  if (!audiences.includes(config.resource)) return false;
  if (candidate.client_id !== undefined && (typeof candidate.client_id !== "string" || !SCOPE_PATTERN.test(candidate.client_id))) return false;
  if (candidate.azp !== undefined && (typeof candidate.azp !== "string" || !SCOPE_PATTERN.test(candidate.azp))) return false;
  if (candidate.client_id !== undefined && candidate.azp !== undefined && candidate.client_id !== candidate.azp) return false;
  return true;
}

function hasRequiredScopes(
  claims: VerifiedTokenClaims,
  config: Extract<AuthConfig, { mode: "oauth" }>
): boolean {
  const scopes = claimScopes(claims);
  return config.requiredScopes.every((scope) => scopes.has(scope));
}

export function validateVerifiedClaims(
  claims: unknown,
  config: Extract<AuthConfig, { mode: "oauth" }>,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): claims is VerifiedTokenClaims {
  return validateVerifiedIdentityClaims(claims, config, nowEpochSeconds)
    && hasRequiredScopes(claims, config);
}

export async function authorizeMcpRequest(
  request: Request,
  env: AuthEnv,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): Promise<AuthDecision> {
  let config: AuthConfig;
  try {
    config = resolveAuthConfig(env);
  } catch {
    return { ok: false, status: 503, error: "MCP authentication is not configured" };
  }

  const token = readBearerToken(request);
  if (config.mode === "legacy") {
    return token === config.routeToken
      ? { ok: true, mode: "legacy" }
      : { ok: false, status: 401, error: "bad or missing context route credential" };
  }

  const challenge = oauthChallenge(config, request.url);
  if (!token) {
    return { ok: false, status: 401, error: "OAuth access token required", challenge };
  }

  let response: Response;
  try {
    response = await config.verifier.fetch("https://mcp-token-verifier.internal/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resource: config.resource,
        required_scopes: config.requiredScopes,
      }),
    });
  } catch {
    return { ok: false, status: 503, error: "OAuth token verifier unavailable" };
  }

  if (response.status >= 500) {
    return { ok: false, status: 503, error: "OAuth token verifier unavailable" };
  }

  if (response.status === 429) {
    return { ok: false, status: 429, error: "OAuth token verifier rate limited" };
  }

  if (response.status === 403) {
    return {
      ok: false,
      status: 403,
      error: "OAuth access token lacks required scopes",
      challenge: `${oauthChallenge(config, request.url)}, error="insufficient_scope", error_description="Access token lacks required scopes"`,
    };
  }

  if (!response.ok) {
    return { ok: false, status: 401, error: "OAuth access token rejected", challenge };
  }

  let claims: unknown;
  try {
    claims = await response.json();
  } catch {
    return { ok: false, status: 503, error: "OAuth token verifier returned an invalid response" };
  }

  if (!validateVerifiedIdentityClaims(claims, config, nowEpochSeconds)) {
    return { ok: false, status: 401, error: "OAuth access token claims rejected", challenge };
  }

  if (!hasRequiredScopes(claims, config)) {
    return {
      ok: false,
      status: 403,
      error: "OAuth access token lacks required scopes",
      challenge: `${challenge}, error="insufficient_scope", error_description="Access token lacks required scopes"`,
    };
  }

  return { ok: true, mode: "oauth", claims };
}

export function oauthSecuritySchemes(env: AuthEnv) {
  try {
    const config = resolveAuthConfig(env);
    return config.mode === "oauth"
      ? [{ type: "oauth2" as const, scopes: config.requiredScopes }]
      : undefined;
  } catch {
    return undefined;
  }
}
