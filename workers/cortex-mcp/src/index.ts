import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { ORGAN_ATLAS } from "./organ-atlas.ts";
import { evaluateCapabilityHit } from "./capability-hits.ts";
import {
  composeStructuredPack,
  renderPackMarkdown,
  type ComposeHit,
  type ComposeTarget,
} from "./taste-compose.ts";

import { recallOperatorMemory } from "./semantic-recall.ts";
import {
  INFINITE_GAME_NODE_KINDS,
  ProvenanceReadError,
  readInfiniteGameNode,
  type ProvenanceReaderBinding,
} from "./provenance-read.ts";
import {
  GateActionError,
  compileActionIntent,
  executeApprovedAction,
  readActionApprovalStatus,
  requestActionApproval,
  type GateActionBinding,
  type GateActionIdentity,
} from "./gate-action.ts";
import {
  authorizeMcpRequest,
  oauthChallenge,
  oauthSecuritySchemes,
  oauthToolChallenge,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  resolveAuthConfig,
  type TokenVerifierBinding,
} from "./openai-auth.ts";
import {
  ConnectedProfileError,
  deriveConnectedProfile,
  resolveConnectedProfileConfig,
} from "./connected-profile.ts";

export interface Env {
  NVIDIA_API_KEY?: string;
  CORTEX_EMBED_MODEL?: string;
  CONTEXT_ROUTE_TOKEN?: string;
  MCP_AUTH_MODE?: string;
  MCP_RESOURCE_URL?: string;
  MCP_AUTHORIZATION_SERVER?: string;
  MCP_REQUIRED_SCOPES?: string;
  MCP_ACTION_SCOPE?: string;
  MCP_PLUGIN_CLIENT_ID?: string;
  MCP_FOUNDER_SUBJECTS?: string;
  MCP_ALLOWED_ORIGINS?: string;
  MCP_TOKEN_VERIFIER?: TokenVerifierBinding;
  MCP_PROVENANCE_READER?: ProvenanceReaderBinding;
  MCP_GATE_ADAPTER?: GateActionBinding;
  MCP_GATE_ADAPTER_TOKEN?: string;
  MCP_PROFILE_ID_KEY?: string;
  ENVIRONMENT: string;
  CONTEXT_ALLOWED_TENANTS?: string;
  AI: {
    run: (model: string, input: { text: string[] }) => Promise<{ data: number[][] }>;
  };
  TASTE_CORTEX: {
    query: (
      vector: number[],
      options: { topK?: number; returnMetadata?: string; filter?: Record<string, unknown> }
    ) => Promise<{
      matches: Array<{
        id: string;
        score: number;
        metadata?: Record<string, unknown>;
      }>;
    }>;
    getByIds?: (ids: string[]) => Promise<Array<{
      id: string;
      metadata?: Record<string, unknown>;
    }>>;
  };
  CAMBIUM_CORTEX?: {
    query: (
      vector: number[],
      options: { topK?: number; returnMetadata?: string; filter?: Record<string, unknown> }
    ) => Promise<{
      matches: Array<{
        id: string;
        score: number;
        metadata?: Record<string, unknown>;
      }>;
    }>;
  };
  TASTE_BLOBS?: {
    get: (key: string) => Promise<{ text: () => Promise<string> } | null>;
    put?: (key: string, value: string) => Promise<void>;
  };
  MOTIONSITES_PROMPTS?: {
    query: (
      vector: number[],
      options: { topK?: number; returnMetadata?: string }
    ) => Promise<{
      matches: Array<{
        id: string;
        score: number;
        metadata?: Record<string, unknown>;
      }>;
    }>;
  };
}

interface ActionRuntimeConfig {
  scope: string;
  requiredScopes: readonly string[];
  pluginIdentity: string;
  founderSubjects: ReadonlySet<string>;
  mcpIdentity: string;
  issuer: string;
  gateAuthorization: string | null;
}

function resolveActionRuntimeConfig(env: Env): ActionRuntimeConfig | null {
  if (env.MCP_AUTH_MODE?.trim().toLowerCase() !== "oauth") return null;
  let auth: ReturnType<typeof resolveAuthConfig>;
  try {
    auth = resolveAuthConfig(env);
  } catch {
    return null;
  }
  if (auth.mode !== "oauth") return null;
  const scope = env.MCP_ACTION_SCOPE?.trim() || "";
  const pluginIdentity = env.MCP_PLUGIN_CLIENT_ID?.trim() || "";
  const founderSubjects = new Set((env.MCP_FOUNDER_SUBJECTS || "")
    .split(",")
    .map((subject) => subject.trim())
    .filter(Boolean));
  const gateAuthorizationValue = env.MCP_GATE_ADAPTER_TOKEN?.trim() || "";
  const gateAuthorization = gateAuthorizationValue.length >= 32
    && gateAuthorizationValue.length <= 512
    && !/[\u0000-\u0020\u007f]/.test(gateAuthorizationValue)
    ? gateAuthorizationValue
    : null;
  const canonicalId = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/;
  if (!/^[A-Za-z0-9._:/-]+$/.test(scope)
      || !canonicalId.test(pluginIdentity)
      || founderSubjects.size === 0
      || [...founderSubjects].some((subject) => !canonicalId.test(subject))) {
    return null;
  }
  return {
    scope,
    requiredScopes: [...new Set([...auth.requiredScopes, scope])],
    pluginIdentity,
    founderSubjects,
    mcpIdentity: auth.resource,
    issuer: auth.authorizationServer,
    gateAuthorization,
  };
}

export function createCortexMcpServer(env: Env) {
  const securitySchemes = oauthSecuritySchemes(env);
  const actionConfig = resolveActionRuntimeConfig(env);
  const profileConfig = env.MCP_AUTH_MODE?.trim().toLowerCase() === "oauth"
    ? resolveConnectedProfileConfig(env.MCP_PROFILE_ID_KEY)
    : null;
  const actionSecuritySchemes = actionConfig
    ? [{ type: "oauth2" as const, scopes: [...actionConfig.requiredScopes] }]
    : undefined;
  const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  let credentialOwner = "hermes-context-route";
  try {
    const config = resolveAuthConfig(env);
    if (config.mode === "oauth") credentialOwner = config.authorizationServer;
  } catch {
    if (env.MCP_AUTH_MODE?.trim().toLowerCase() === "oauth") credentialOwner = "unconfigured-oauth";
  }
  const capabilityDescriptor = (
    name: string,
    resource: string,
    tenant: Record<string, string>
  ) => {
    const capability = {
      schema: "cambium.openai.tool_capability.v1",
      name,
      resource,
      tenant,
      classification: "read",
      credential_owner: credentialOwner,
      approval_requirement: "none",
      idempotency: "safe-repeat",
      terminal_receipt: "none:read-envelope-is-not-canonical-completion",
      writer_authority: false,
    };
    return {
      ...(securitySchemes ? { securitySchemes } : {}),
      _meta: {
        ...(securitySchemes ? { securitySchemes } : {}),
        "cambium/capability": capability,
      },
    };
  };
  const actionCapabilityDescriptor = (
    name: string,
    approvalRequirement: string,
    terminalReceipt: string,
  ) => {
    const capability = {
      schema: "cambium.openai.tool_capability.v1",
      name,
      resource: "cambium://gate",
      tenant: {
        mode: "argument",
        field: "tenant",
        source: "verified-token-claim",
      },
      classification: "approval-gated-action",
      credential_owner: credentialOwner,
      approval_requirement: approvalRequirement,
      idempotency: "exact-replay-original-receipt;conflict-fails-closed",
      terminal_receipt: terminalReceipt,
      writer_authority: false,
    };
    return {
      ...(actionSecuritySchemes ? { securitySchemes: actionSecuritySchemes } : {}),
      _meta: {
        ...(actionSecuritySchemes ? { securitySchemes: actionSecuritySchemes } : {}),
        "cambium/capability": capability,
      },
    };
  };
  const actionInputProperties = {
    tenant: { type: "string" as const, pattern: "^[a-z][a-z0-9-]{1,63}$" },
    action_kind: { type: "string" as const, pattern: "^[a-z][a-z0-9._:-]{1,127}$" },
    arguments: { type: "object" as const, additionalProperties: true },
    graph_version: { type: "integer" as const, minimum: 0 },
    nonce: { type: "string" as const, minLength: 8, maxLength: 128 },
    expiry: { type: "string" as const, format: "date-time" },
    idempotency_key: { type: "string" as const, minLength: 3, maxLength: 128 },
  };
  const actionTupleOutputProperties = {
    tenant: { type: "string" as const },
    actor: { type: "string" as const },
    plugin_identity: { type: "string" as const },
    mcp_identity: { type: "string" as const },
    issuer: { type: "string" as const },
    action_kind: { type: "string" as const },
    argument_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
    action_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
    graph_version: { type: "integer" as const, minimum: 0 },
    nonce: { type: "string" as const },
    expiry: { type: "string" as const },
    idempotency_key: { type: "string" as const },
  };
  const server = new Server(
    {
      name: "cortex-mcp",
      version: "1.7.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "Cortex MCP provides bounded read tools plus source-gated, Gate-backed actions. Cortex never receives direct D1 writer authority; action success requires exact founder OAuth identity, approval-bound Gate execution, and matching authoritative readback.",
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...(profileConfig ? [{
          name: "get_connected_profile",
          title: "Get Connected Cambium Profile",
          description:
            "Return the stable opaque profile identifier for the already verified OAuth principal. The result exposes no raw subject, email, token, tenant, session, credential, or writer authority.",
          inputSchema: {
            type: "object" as const,
            additionalProperties: false,
            properties: {},
          },
          outputSchema: {
            type: "object" as const,
            additionalProperties: false,
            properties: {
              id: { type: "string" as const, pattern: "^prf_[a-f0-9]{64}$" },
              name: { type: "string" as const },
              email: { type: "string" as const },
              nickname: { type: "string" as const },
            },
            required: ["id"],
          },
          annotations: readOnlyAnnotations,
          ...(() => {
            const descriptor = capabilityDescriptor(
              "get_connected_profile",
              "cambium://connected-profile",
              { mode: "credential-derived", source: "verified-oauth-issuer-and-subject" },
            );
            return {
              ...descriptor,
              _meta: { ...descriptor._meta, "openai/profile": true },
            };
          })(),
        }] : []),
        {
          name: "taste_cortex_query",
          title: "Search Taste Cortex",
          description:
            "Query Taste Cortex (aesthetic prompts, techniques, and visual references) using semantic similarity (768-dim bge).",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                description: "Aesthetic intent or design style (e.g. 'luxury brutalist motion linear')",
              },
              category: {
                type: "string",
                description: "Optional category filter",
                enum: ["prompts", "techniques", "media-refs"],
              },
              top_k: {
                type: "number",
                description: "Number of nearest neighbor blobs to retrieve (default: 6, max: 20)",
                default: 6,
              },
            },
            required: ["intent"],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("taste_cortex_query", "cortex://taste", { mode: "fixed", value: "thoughtseed" }),
        },
        {
          name: "taste_cortex_compose",
          title: "Compose a Taste Prompt Pack",
          description:
            "Compose a MotionSites-structured prompt pack: build brief, asset plan with real image/video URLs, extracted skill-cluster handles, and a paste-ready prompt. Uses ingested MotionSites corpus + Taste Cortex + design skills.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                description: "What to generate (scene, brand, motion, product, UI mood)",
              },
              target: {
                type: "string",
                description: "Generator target",
                enum: ["image", "video", "ui", "copy"],
                default: "image",
              },
              per_category: {
                type: "number",
                description: "Max blobs to pull per category (default 2, max 4)",
                default: 2,
              },
            },
            required: ["intent"],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("taste_cortex_compose", "cortex://taste", { mode: "fixed", value: "thoughtseed" }),
        },
        {
          name: "taste_cortex_get_blob",
          title: "Get a Taste Cortex Source",
          description: "Retrieve full markdown of a taste blob from R2. Pass metadata.slug from taste_cortex_query (preferred) or the vector id — both resolve.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", description: "metadata.slug from taste_cortex_query, or the vector id" },
              category: {
                type: "string",
                description: "Category: prompts, techniques, or media-refs. Optional if id is a vector id.",
                enum: ["prompts", "techniques", "media-refs"],
              },
            },
            required: ["id"],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("taste_cortex_get_blob", "cortex://taste", { mode: "fixed", value: "thoughtseed" }),
        },
        {
          name: "read_infinite_game_node",
          title: "Read an Infinite Game Node",
          description:
            "Read one canonical Cambium Vision, Mission, ISA, GSD, D1, run, receipt, or Cortex-learning node through the injected provenance service. Returns a bounded, tenant-authorized, digest-verified, fresh envelope. It never writes state or establishes canonical completion.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              tenant: { type: "string", pattern: "^[a-z][a-z0-9-]{1,63}$" },
              node_kind: { type: "string", enum: [...INFINITE_GAME_NODE_KINDS] },
              node_id: { type: "string", minLength: 1, maxLength: 256 },
              graph_version: { type: "string", minLength: 1, maxLength: 128 },
              max_bytes: { type: "integer", minimum: 1, maximum: 65536, default: 16384 },
            },
            required: ["tenant", "node_kind", "node_id"],
          },
          outputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              schema: { type: "string", const: "cambium.mcp.read_envelope.v1" },
              tenant: { type: "string" },
              node_kind: { type: "string", enum: [...INFINITE_GAME_NODE_KINDS] },
              node_id: { type: "string" },
              source_authority: { type: "string", enum: ["vision", "mission", "isa", "gsd", "d1", "hermes", "cambium_gate", "cortex"] },
              source_reference: { type: "string" },
              source_version: { type: "string" },
              graph_version: { anyOf: [{ type: "string" }, { type: "null" }] },
              content_digest: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
              freshness: {
                type: "object",
                additionalProperties: false,
                properties: {
                  observed_at: { type: "string" },
                  stale_after: { type: "string" },
                  status: { type: "string", const: "fresh" },
                },
                required: ["observed_at", "stale_after", "status"],
              },
              omissions: {
                type: "array",
                maxItems: 32,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { field: { type: "string" }, reason: { type: "string" } },
                  required: ["field", "reason"],
                },
              },
              body: { type: "object" },
              writer_authority: { type: "boolean", const: false },
              canonical_completion: { type: "boolean", const: false },
            },
            required: [
              "schema", "tenant", "node_kind", "node_id", "source_authority",
              "source_reference", "source_version", "graph_version", "content_digest",
              "freshness", "omissions", "body", "writer_authority", "canonical_completion",
            ],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("read_infinite_game_node", "cambium://infinite-game", {
            mode: "argument",
            field: "tenant",
            source: "verified-token-claim-or-legacy-allowlist",
          }),
        },
        {
          name: "semantic_recall",
          title: "Recall Cambium Memory",
          description: "Recall situational memory and decisions from Cambium Cortex with strict tenant isolation.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              tenant: { type: "string", description: "Tenant slug (e.g. 'cambium', 'thoughtseed')" },
              query: { type: "string", description: "Search query for memory recall" },
              kind: {
                type: "string",
                description: "Memory kind filter",
                enum: ["decision", "evidence", "handoff", "heartbeat", "memory", "note", "routine", "standup", "task"],
              },
              top_k: { type: "number", description: "Number of matches (default: 5)", default: 5 },
            },
            required: ["tenant", "query"],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("semantic_recall", "cortex://operator-memory", {
            mode: "argument",
            field: "tenant",
            source: "verified-token-claim-or-legacy-allowlist",
          }),
        },
        {
          name: "organ_atlas_lookup",
          title: "Look Up an Organ Contract",
          description: "Authoritative lookup of any of the 5 Cambium or 6 Temperance organs and their contracts.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              organId: {
                type: "string",
                description: "Organ identifier (e.g. 'cambium.taste', 'temperance.adytum', 'cambium.will')",
              },
            },
            required: ["organId"],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("organ_atlas_lookup", "cambium://organ-atlas", { mode: "fixed", value: "cambium" }),
        },
        {
          name: "capability_hit_evaluate",
          title: "Evaluate a Capability Candidate",
          description:
            "Evaluate whether a capability card should be proposed for a task based on the 2026-09-03 selection formula (relevance, freshness, readiness, ownerMatch, novelty, evidenceQuality). Silence returned if score < 0.68.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              taskFingerprint: { type: "string", description: "Unique task identifier or hash" },
              taskSummary: { type: "string", description: "Short summary of active task" },
              topicKey: {
                type: "string",
                description: "Telegram topic route",
                enum: ["hermes", "digests", "dev", "inbox", "calendar", "agent_ops", "alerts", "clients", "adytum"],
              },
              candidateCapabilityId: {
                type: "string",
                description: "Organ ID to score (e.g. 'cambium.taste', 'temperance.adytum')",
              },
              relevance: { type: "number", description: "0..1 score of task relevance" },
              freshness: { type: "number", description: "0..1 score of evidence freshness" },
              readiness: { type: "number", description: "0..1 score of organ readiness" },
              ownerMatch: { type: "number", description: "0..1 score of owner/role alignment" },
              novelty: { type: "number", description: "0..1 score of non-repetition" },
              evidenceQuality: { type: "number", description: "0..1 score of evidence grounding" },
            },
            required: ["taskFingerprint", "taskSummary", "topicKey", "candidateCapabilityId"],
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("capability_hit_evaluate", "cambium://capability-registry", { mode: "fixed", value: "cambium" }),
        },
        {
          name: "cortex_health",
          title: "Check Cortex Health",
          description: "Health probe for Cortex MCP bindings (Vectorize, Workers AI, R2).",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {},
          },
          annotations: readOnlyAnnotations,
          ...capabilityDescriptor("cortex_health", "cortex://health", { mode: "fixed", value: "cambium" }),
        },
        ...(actionConfig ? [
          {
            name: "compile_action_intent",
            title: "Compile a Cambium Action Intent",
            description:
              "Compile an exact founder-bound Cambium action tuple without writing state. The server derives actor, plugin identity, MCP identity, and canonical argument digest from verified OAuth context and the supplied arguments. Use the returned action digest to obtain a separate Gate approval before execution.",
            inputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: actionInputProperties,
              required: ["tenant", "action_kind", "arguments", "graph_version", "nonce", "expiry", "idempotency_key"],
            },
            outputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: {
                schema: { type: "string" as const, const: "cambium.mcp.action_intent.v1" },
                ...actionTupleOutputProperties,
                status: { type: "string" as const, const: "compiled_not_authorized" },
                writer_authority: { type: "boolean" as const, const: false },
                canonical_completion: { type: "boolean" as const, const: false },
              },
              required: [
                "schema", ...Object.keys(actionTupleOutputProperties), "status",
                "writer_authority", "canonical_completion",
              ],
            },
            annotations: {
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false,
            },
            ...actionCapabilityDescriptor(
              "compile_action_intent",
              "founder-oauth-action-scope;execution-separately-approved",
              "none:compiled-intent-is-not-authorization-or-completion",
            ),
          },
          {
            name: "request_action_approval",
            title: "Request Founder Approval for a Cambium Action",
            description:
              "Persist one exact compiled action for founder review in Cambium Gate. This performs no Goal Graph write. The request becomes visible in the Telegram founder decision queue; approval and execution remain separate steps.",
            inputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: actionInputProperties,
              required: ["tenant", "action_kind", "arguments", "graph_version", "nonce", "expiry", "idempotency_key"],
            },
            outputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: {
                schema: { type: "string" as const, const: "cambium.mcp.action_review_request.v1" },
                status: { type: "string" as const, enum: ["awaiting_founder_approval", "approved", "executed"] },
                duplicate: { type: "boolean" as const },
                tenant: { type: "string" as const },
                action_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
                request_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
                approval_digest: { anyOf: [{ type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" }, { type: "null" as const }] },
                expiry: { type: "string" as const, format: "date-time" },
                writer_authority: { type: "boolean" as const, const: false },
                canonical_completion: { type: "boolean" as const, const: false },
              },
              required: ["schema", "status", "duplicate", "tenant", "action_digest", "request_digest", "approval_digest", "expiry", "writer_authority", "canonical_completion"],
            },
            annotations: {
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false,
            },
            ...actionCapabilityDescriptor(
              "request_action_approval",
              "creates-review-request;founder-signature-still-required",
              "none:review-request-is-not-authorization-or-completion",
            ),
          },
          {
            name: "get_action_approval_status",
            title: "Read Cambium Action Approval Status",
            description:
              "Read the exact founder-review state for a compiled Cambium action. This is non-writing and never treats approval as execution or canonical completion.",
            inputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: actionInputProperties,
              required: ["tenant", "action_kind", "arguments", "graph_version", "nonce", "expiry", "idempotency_key"],
            },
            outputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: {
                schema: { type: "string" as const, const: "cambium.gate.action_review_status.v1" },
                status: { type: "string" as const, enum: ["awaiting_founder_approval", "approved", "executed", "expired"] },
                tenant: { type: "string" as const },
                action_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
                request_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
                approval_digest: { anyOf: [{ type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" }, { type: "null" as const }] },
                receipt_digest: { anyOf: [{ type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" }, { type: "null" as const }] },
                expiry: { type: "string" as const, format: "date-time" },
                writer_authority: { type: "boolean" as const, const: false },
                canonical_completion: { type: "boolean" as const, const: false },
              },
              required: ["schema", "status", "tenant", "action_digest", "request_digest", "approval_digest", "receipt_digest", "expiry", "writer_authority", "canonical_completion"],
            },
            annotations: readOnlyAnnotations,
            ...actionCapabilityDescriptor(
              "get_action_approval_status",
              "reads-founder-review-state-only",
              "none:status-is-not-canonical-completion",
            ),
          },
          {
            name: "execute_approved_action",
            title: "Execute a Founder-Approved Cambium Action",
            description:
              "Submit one exact approval-bound action tuple to the injected Cambium Gate. Requires verified founder OAuth identity, the dedicated action scope, matching plugin client identity, a Gate-issued approval digest, replay-safe idempotency, and authoritative terminal readback. Cortex never writes D1 directly.",
            inputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: {
                ...actionInputProperties,
                approval_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
              },
              required: [
                "tenant", "action_kind", "arguments", "graph_version", "nonce",
                "expiry", "idempotency_key", "approval_digest",
              ],
            },
            outputSchema: {
              type: "object" as const,
              additionalProperties: false,
              properties: {
                schema: { type: "string" as const, const: "cambium.mcp.action_receipt.v1" },
                status: { type: "string" as const, enum: ["committed", "duplicate"] },
                ...actionTupleOutputProperties,
                approval_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
                mutation_count: { type: "integer" as const, const: 1 },
                terminal_outcome: { type: "string" as const },
                receipt_digest: { type: "string" as const, pattern: "^sha256:[a-f0-9]{64}$" },
                authoritative_readback: { type: "object" as const },
                execution_authority: { type: "string" as const, const: "cambium-gate" },
                writer_authority: { type: "boolean" as const, const: false },
                canonical_completion: { type: "boolean" as const, const: true },
              },
              required: [
                "schema", "status", ...Object.keys(actionTupleOutputProperties), "approval_digest",
                "mutation_count", "terminal_outcome", "receipt_digest", "authoritative_readback",
                "execution_authority", "writer_authority", "canonical_completion",
              ],
            },
            annotations: {
              readOnlyHint: false,
              destructiveHint: true,
              idempotentHint: true,
              openWorldHint: false,
            },
            ...actionCapabilityDescriptor(
              "execute_approved_action",
              "exact-founder-gate-approval",
              "required:matching-authoritative-readback",
            ),
          },
        ] : []),
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, context) => {
    const { name, arguments: args } = request.params;

    if (name === "get_connected_profile") {
      const profileError = () => ({
        isError: true,
        content: [{
          type: "text" as const,
          text: JSON.stringify({ status: "unavailable", code: "verified_profile_identity_required" }),
        }],
      });
      if (!profileConfig || env.MCP_AUTH_MODE?.trim().toLowerCase() !== "oauth" || !context.authInfo) {
        return profileError();
      }
      const extra = context.authInfo.extra || {};
      const issuer = typeof extra.issuer === "string" ? extra.issuer : "";
      const subject = typeof extra.subject === "string" ? extra.subject : "";
      try {
        const profile = await deriveConnectedProfile(profileConfig.key, issuer, subject);
        return {
          structuredContent: profile,
          content: [{ type: "text" as const, text: JSON.stringify(profile) }],
        };
      } catch (error) {
        if (error instanceof ConnectedProfileError) return profileError();
        return profileError();
      }
    }

    const tenantAuthorized = (tenant: unknown) => {
      if (typeof tenant !== "string") return false;
      if (env.MCP_AUTH_MODE?.trim().toLowerCase() === "oauth") {
        const authorizedTenants = context.authInfo?.extra?.authorizedTenants;
        return Array.isArray(authorizedTenants) && authorizedTenants.includes(tenant);
      }
      const allowed = (env.CONTEXT_ALLOWED_TENANTS || "cambium")
        .split(",")
        .map((candidate) => candidate.trim())
        .filter(Boolean);
      return allowed.includes(tenant);
    };

    const fixedTenantByTool: Record<string, string> = {
      taste_cortex_query: "thoughtseed",
      taste_cortex_compose: "thoughtseed",
      taste_cortex_get_blob: "thoughtseed",
      organ_atlas_lookup: "cambium",
      capability_hit_evaluate: "cambium",
      cortex_health: "cambium",
    };
    const isActionTool = name === "compile_action_intent"
      || name === "request_action_approval"
      || name === "get_action_approval_status"
      || name === "execute_approved_action";
    const requiredTenant = name === "read_infinite_game_node" || name === "semantic_recall" || isActionTool
      ? args?.tenant
      : fixedTenantByTool[name];
    if (requiredTenant !== undefined && !tenantAuthorized(requiredTenant)) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: JSON.stringify({ status: "unavailable", code: "unauthorized_tenant" }),
        }],
      };
    }

    if (isActionTool) {
      const actionError = (code: string, challenge?: string) => ({
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ status: "unavailable", code }) }],
        ...(challenge ? { _meta: { "mcp/www_authenticate": [challenge] } } : {}),
      });
      if (!actionConfig || env.MCP_AUTH_MODE?.trim().toLowerCase() !== "oauth" || !context.authInfo) {
        return actionError("oauth_action_required");
      }
      const scopes = new Set(context.authInfo.scopes || []);
      if (!scopes.has(actionConfig.scope)) {
        const config = resolveAuthConfig(env);
        const challenge = config.mode === "oauth"
          ? `${oauthChallenge(config, config.resource, actionConfig.requiredScopes)}, error="insufficient_scope", error_description="Action scope required"`
          : undefined;
        return actionError("action_scope_required", challenge);
      }
      const extra = context.authInfo.extra || {};
      const subject = typeof extra.subject === "string" ? extra.subject : "";
      const clientIdentity = typeof extra.authorizedClientId === "string" ? extra.authorizedClientId : "";
      const issuer = typeof extra.issuer === "string" ? extra.issuer : "";
      if (!actionConfig.founderSubjects.has(subject)) return actionError("founder_required");
      if (clientIdentity !== actionConfig.pluginIdentity) return actionError("plugin_identity_mismatch");
      if (issuer !== actionConfig.issuer) return actionError("issuer_identity_mismatch");
      const identity: GateActionIdentity = {
        actor: subject,
        plugin_identity: actionConfig.pluginIdentity,
        mcp_identity: actionConfig.mcpIdentity,
        issuer,
      };
      try {
        if (name === "compile_action_intent") {
          const result = await compileActionIntent(args as any, identity);
          return {
            structuredContent: result,
            content: [{
              type: "text" as const,
              text: `Compiled action ${result.action_digest}; it is not authorized and no state was written.`,
            }],
          };
        }
        if (!env.MCP_GATE_ADAPTER || !actionConfig.gateAuthorization) {
          return actionError("gate_unavailable");
        }
        if (name === "request_action_approval") {
          const result = await requestActionApproval(
            env.MCP_GATE_ADAPTER,
            args as any,
            identity,
            Date.now(),
            5_000,
            actionConfig.gateAuthorization,
          );
          return {
            structuredContent: result,
            content: [{
              type: "text" as const,
              text: `Cambium Gate recorded review request ${result.request_digest}; founder approval and execution remain separate.`,
            }],
          };
        }
        if (name === "get_action_approval_status") {
          const result = await readActionApprovalStatus(
            env.MCP_GATE_ADAPTER,
            args as any,
            identity,
            Date.now(),
            5_000,
            actionConfig.gateAuthorization,
          );
          return {
            structuredContent: result,
            content: [{
              type: "text" as const,
              text: `Cambium Gate reports ${result.status} for action ${result.action_digest}.`,
            }],
          };
        }
        const result = await executeApprovedAction(
          env.MCP_GATE_ADAPTER!,
          args as any,
          identity,
          Date.now(),
          5_000,
          actionConfig.gateAuthorization,
        );
        return {
          structuredContent: result,
          content: [{
            type: "text" as const,
            text: `Cambium Gate returned ${result.status} with authoritative receipt ${result.receipt_digest}.`,
          }],
        };
      } catch (error) {
        const code = error instanceof GateActionError ? error.code : "action_plane_error";
        return actionError(code);
      }
    }

    if (name === "read_infinite_game_node") {
      if (!env.MCP_PROVENANCE_READER) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ status: "unavailable", code: "read_plane_unavailable" }) }],
        };
      }
      try {
        const envelope = await readInfiniteGameNode(env.MCP_PROVENANCE_READER, args as any);
        return {
          structuredContent: envelope,
          content: [{
            type: "text",
            text: `Verified ${envelope.node_kind} ${envelope.node_id} from ${envelope.source_reference} at ${envelope.content_digest}. This read is evidence, not canonical completion.`,
          }],
        };
      } catch (error) {
        const code = error instanceof ProvenanceReadError ? error.code : "read_plane_error";
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ status: "unavailable", code }) }],
        };
      }
    }

    if (name === "taste_cortex_compose") {
      const intent = String(args?.intent || args?.query || "").trim();
      const target = (String(args?.target || "image") as ComposeTarget) || "image";
      const perCat = Math.min(Math.max(Number(args?.per_category || 2), 1), 4);

      if (!intent) {
        return {
          isError: true,
          content: [{ type: "text", text: "intent is required" }],
        };
      }

      const aiRes = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: [intent.slice(0, 2000)],
      });
      const queryVector = aiRes.data[0];

      const tasteResults = await env.TASTE_CORTEX.query(queryVector, {
        topK: 10,
        returnMetadata: "all",
      });

      const buckets: Record<string, NonNullable<typeof tasteResults.matches>> = {
        prompts: [],
        techniques: [],
        "media-refs": [],
      };
      for (const m of tasteResults.matches || []) {
        const cat = String(m.metadata?.category || "");
        if (buckets[cat] && buckets[cat].length < perCat) buckets[cat].push(m);
      }
      const selectedTaste = [...buckets.prompts, ...buckets["media-refs"], ...buckets.techniques];

      const tasteHits: ComposeHit[] = [];
      for (const m of selectedTaste) {
        const meta = m.metadata || {};
        const slug = String(meta.slug || "");
        const cat = String(meta.category || "");
        let body = "";
        if (env.TASTE_BLOBS && slug && cat) {
          const obj = await env.TASTE_BLOBS.get(`taste/${cat}/${slug}.md`);
          if (obj) body = await obj.text();
        }
        tasteHits.push({
          id: m.id,
          score: m.score,
          category: cat,
          slug,
          author: String(meta.author || "unknown"),
          title: String(meta.title || slug),
          r2_key: slug && cat ? `taste/${cat}/${slug}.md` : undefined,
          body,
          source: "taste",
        });
      }

      const msHits: ComposeHit[] = [];
      if (env.MOTIONSITES_PROMPTS) {
        const msResults = await env.MOTIONSITES_PROMPTS.query(queryVector, {
          topK: 3,
          returnMetadata: "all",
        });
        for (const m of msResults.matches || []) {
          const meta = m.metadata || {};
          const id = String(m.id || meta.id || "");
          let body = String(meta.excerpt || "");
          if (env.TASTE_BLOBS && id) {
            const obj = await env.TASTE_BLOBS.get(`taste/motionsites/${id}.md`);
            if (obj) body = await obj.text();
          }
          msHits.push({
            id,
            score: m.score,
            category: String(meta.category || meta.page_type || "hero"),
            slug: id,
            author: "motionsites",
            title: String(meta.title || id),
            r2_key: id ? `taste/motionsites/${id}.md` : undefined,
            body,
            video_url: String(meta.video_preview_url || "") || undefined,
            image_url: String(meta.image_preview_url || "") || undefined,
            source: "motionsites",
          });
        }
      }

      let grokfilmTechniques: import("./taste-compose.ts").GrokFilmTechnique[] = [];
      if (env.TASTE_BLOBS) {
        try {
          const obj = await env.TASTE_BLOBS.get("taste/grokfilm/techniques.json");
          if (obj) {
            const raw = await obj.text();
            const parsed = JSON.parse(raw);
            grokfilmTechniques = parsed.techniques || [];
          }
        } catch {
          grokfilmTechniques = [];
        }
      }

      const pack = composeStructuredPack(intent, target, tasteHits, msHits, [], grokfilmTechniques);
      const markdown = renderPackMarkdown(pack);
      return {
        content: [
          {
            type: "text",
            text: markdown + "\n\n## JSON\n\n```json\n" + JSON.stringify(pack, null, 2) + "\n```",
          },
        ],
      };
    }

    if (name === "cortex_health") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "healthy",
                environment: env.ENVIRONMENT,
                bindings: {
                  ai: Boolean(env.AI),
                  taste_cortex: Boolean(env.TASTE_CORTEX),
                  cambium_cortex: Boolean(env.CAMBIUM_CORTEX),
                  taste_blobs_r2: Boolean(env.TASTE_BLOBS),
                },
                organsCount: Object.keys(ORGAN_ATLAS).length,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "organ_atlas_lookup") {
      const organId = String(args?.organId || "");
      const organ = ORGAN_ATLAS[organId];
      if (!organ) {
        return {
          isError: true,
          content: [{ type: "text", text: `Organ not found: ${organId}. Available: ${Object.keys(ORGAN_ATLAS).join(", ")}` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(organ, null, 2) }],
      };
    }

    if (name === "capability_hit_evaluate") {
      const scores = ["relevance", "freshness", "readiness", "ownerMatch", "novelty", "evidenceQuality"].map((key) => {
        const n = Number(args?.[key] ?? 0);
        return Number.isFinite(n) ? n : Number.NaN;
      });
      if (scores.some((n) => !Number.isFinite(n))) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ eligible: false, refusalReason: "invalid_score" }) }],
        };
      }
      const result = evaluateCapabilityHit({
        taskFingerprint: String(args?.taskFingerprint || ""),
        taskSummary: String(args?.taskSummary || ""),
        topicKey: args?.topicKey as any,
        candidateCapabilityId: String(args?.candidateCapabilityId || ""),
        relevance: scores[0],
        freshness: scores[1],
        readiness: scores[2],
        ownerMatch: scores[3],
        novelty: scores[4],
        evidenceQuality: scores[5],
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "taste_cortex_query") {
      const intent = String(args?.intent || args?.query || "");
      const category = args?.category ? String(args.category) : undefined;
      const topK = Math.min(Number(args?.top_k ?? args?.topK ?? 6), 20);

      const aiRes = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: [intent.slice(0, 2000)],
      });
      const queryVector = aiRes.data[0];

      const filter = category ? { category: { $eq: category } } : undefined;
      const results = await env.TASTE_CORTEX.query(queryVector, {
        topK,
        returnMetadata: "all",
        filter,
      });

      const hits = (results.matches || []).map((m) => {
        const meta = m.metadata || {};
        const slug = String(meta.slug || "");
        const cat = String(meta.category || category || "");
        return {
          ...m,
          blob_id: slug || m.id,
          r2_key: slug && cat ? `taste/${cat}/${slug}.md` : undefined,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(hits, null, 2),
          },
        ],
      };
    }

    if (name === "taste_cortex_get_blob") {
      const rawId = String(args?.id || "").trim();
      let category = args?.category ? String(args.category) : "";

      if (!env.TASTE_BLOBS) {
        throw new Error("R2 TASTE_BLOBS binding not configured");
      }

      const cats = category ? [category] : ["prompts", "techniques", "media-refs"];
      const candidates: string[] = [];
      for (const cat of cats) {
        candidates.push(`taste/${cat}/${rawId}.md`);
        if (rawId.startsWith(`${cat}-`)) {
          candidates.push(`taste/${cat}/${rawId.slice(cat.length + 1)}.md`);
        }
      }

      let slugFromIndex = "";
      if (env.TASTE_CORTEX.getByIds) {
        try {
          const rows = await env.TASTE_CORTEX.getByIds([rawId]);
          const meta = rows?.[0]?.metadata || {};
          slugFromIndex = String(meta.slug || "");
          const catFromIndex = String(meta.category || category || "");
          if (slugFromIndex && catFromIndex) {
            candidates.unshift(`taste/${catFromIndex}/${slugFromIndex}.md`);
          }
        } catch {
          // getByIds is optional; fall through to key guesses
        }
      }

      let obj: { text: () => Promise<string> } | null = null;
      let hitKey = "";
      for (const key of candidates) {
        obj = await env.TASTE_BLOBS.get(key);
        if (obj) {
          hitKey = key;
          break;
        }
      }

      if (!obj) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Blob not found for id=${rawId}. Tried: ${candidates.join(", ")}. Prefer metadata.slug from taste_cortex_query.`,
            },
          ],
        };
      }

      const content = await obj.text();
      return {
        content: [{ type: "text", text: content }],
      };
    }

    if (name === "semantic_recall") {
      return recallOperatorMemory(env, args || {});
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
  }
  headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAllowedRequestOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin || !["https:", "http:"].includes(parsed.protocol)) return false;
  const allowed = (env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function normalizeLegacyAccept(request: Request): Request {
  const headers = new Headers(request.headers);
  const accept = headers.get("accept") || "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    headers.set("Accept", "application/json, text/event-stream");
  }
  return new Request(request, { headers });
}

type RpcEnvelope = {
  id: unknown;
  method?: string;
  batch: boolean;
};

async function inspectRpcEnvelope(request: Request): Promise<RpcEnvelope> {
  try {
    const payload = await request.clone().json() as any;
    if (Array.isArray(payload)) {
      return { id: null, batch: true };
    }
    return {
      id: payload && typeof payload === "object" ? payload.id ?? null : null,
      method: payload && typeof payload === "object" && typeof payload.method === "string"
        ? payload.method
        : undefined,
      batch: false,
    };
  } catch {
    return { id: null, batch: false };
  }
}

const OAUTH_PUBLIC_PROTOCOL_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "ping",
  "tools/list",
]);

function oauthAuthInfo(env: Env, claims: NonNullable<Extract<Awaited<ReturnType<typeof authorizeMcpRequest>>, { ok: true }>['claims']>): AuthInfo {
  const config = resolveAuthConfig(env);
  if (config.mode !== "oauth") throw new Error("OAuth auth info requires OAuth mode");
  const scopes = new Set([
    ...(typeof claims.scope === "string" ? claims.scope.split(/\s+/) : []),
    ...(Array.isArray(claims.scopes) ? claims.scopes : []),
  ].filter(Boolean));
  return {
    // Handlers need proof that middleware validated a token, never the raw bearer.
    token: "[validated-redacted]",
    clientId: claims.sub || claims.iss,
    scopes: [...scopes],
    expiresAt: claims.exp,
    resource: new URL(config.resource),
    extra: {
      issuer: claims.iss,
      subject: claims.sub || null,
      authorizedClientId: claims.client_id || claims.azp || null,
      authorizedTenants: [...new Set([
        ...(typeof claims.tenant === "string" ? [claims.tenant] : []),
        ...(Array.isArray(claims.tenants) ? claims.tenants : []),
      ].filter((tenant) => typeof tenant === "string" && /^[a-z0-9][a-z0-9_-]{1,79}$/.test(tenant)))],
    },
  };
}

async function oauthToolChallengeResponse(
  request: Request,
  env: Env,
  authorizationChallenge?: string
): Promise<Response | null> {
  let payload: any;
  try {
    payload = await request.clone().json();
  } catch {
    return null;
  }
  if (!payload || Array.isArray(payload) || payload.method !== "tools/call" || payload.id === undefined) {
    return null;
  }
  const config = resolveAuthConfig(env);
  if (config.mode !== "oauth") return null;
  const challenge = authorizationChallenge?.includes('error="')
    ? authorizationChallenge
    : oauthToolChallenge(config, request.url);
  return withCors(new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: payload.id,
    result: {
      content: [{ type: "text", text: "Authentication required before this tool can run." }],
      _meta: { "mcp/www_authenticate": [challenge] },
      isError: true,
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": challenge,
    },
  }), request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!isAllowedRequestOrigin(request, env)) {
      return new Response(JSON.stringify({ error: "request origin is not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, {
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
          "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate",
        },
      }), request);
    }

    if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
      try {
        const config = resolveAuthConfig(env);
        if (config.mode !== "oauth") {
          return new Response("Not Found", { status: 404 });
        }
        const metadataPath = new URL(protectedResourceMetadataUrl(config.resource)).pathname;
        if (url.pathname !== metadataPath || url.search) {
          return new Response("Not Found", { status: 404 });
        }
        return withCors(new Response(JSON.stringify(protectedResourceMetadata(config)), {
          headers: {
            "Content-Type": "application/json",
          },
        }), request);
      } catch {
        return withCors(new Response(JSON.stringify({ error: "MCP authentication is not configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }), request);
      }
    }

    if (url.pathname === "/health" || url.pathname === "/v1/health") {
      return new Response(JSON.stringify({ ok: true, service: "cortex-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/mcp" || url.pathname === "/v1/mcp" || url.pathname === "/") {
      // Stateless JSON response mode intentionally supports POST only.
      if (request.method !== "POST") {
        return withCors(new Response("MCP endpoint requires POST", {
          status: 405,
          headers: { Allow: "POST" },
        }), request);
      }
      const envelope = await inspectRpcEnvelope(request);
      let auth: Awaited<ReturnType<typeof authorizeMcpRequest>>;
      if (env.MCP_AUTH_MODE?.trim().toLowerCase() === "oauth") {
        try {
          const config = resolveAuthConfig(env);
          if (config.mode !== "oauth") throw new Error("OAuth mode required");
          const requestedResource = `${url.origin}${url.pathname}${url.search}`;
          if (requestedResource !== config.resource) {
            return new Response("Not Found", { status: 404 });
          }
          const isPublicProtocolRequest = !envelope.batch
            && envelope.method !== undefined
            && OAUTH_PUBLIC_PROTOCOL_METHODS.has(envelope.method);
          auth = isPublicProtocolRequest
            ? { ok: true, mode: "oauth" }
            : await authorizeMcpRequest(request, env);
        } catch {
          auth = { ok: false, status: 503, error: "MCP authentication is not configured" };
        }
      } else {
        auth = await authorizeMcpRequest(request, env);
      }
      if (auth.ok === false) {
        if ((auth.status === 401 || auth.status === 403) && env.MCP_AUTH_MODE?.trim().toLowerCase() === "oauth") {
          const challengeResult = await oauthToolChallengeResponse(request, env, auth.challenge);
          if (challengeResult) return challengeResult;
        }
        const headers = new Headers({ "Content-Type": "application/json" });
        if (auth.challenge) headers.set("WWW-Authenticate", auth.challenge);
        return withCors(new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers,
        }), request);
      }

      try {
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        const server = createCortexMcpServer(env);
        await server.connect(transport);
        const transportRequest = auth.mode === "legacy" ? normalizeLegacyAccept(request) : request;
        const authInfo = auth.mode === "oauth" && auth.claims
          ? oauthAuthInfo(env, auth.claims)
          : undefined;
        return withCors(await transport.handleRequest(transportRequest, { authInfo }), request);
      } catch {
        return withCors(new Response(
          JSON.stringify({ jsonrpc: "2.0", id: envelope.id ?? null, error: { code: -32603, message: "Internal error" } }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        ), request);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
