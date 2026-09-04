import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ORGAN_ATLAS } from "./organ-atlas.ts";
import { evaluateCapabilityHit } from "./capability-hits.ts";
import {
  composePack,
  renderPackMarkdown,
  type ComposeHit,
  type ComposeTarget,
} from "./taste-compose.ts";

export interface Env {
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
  };
}

export function createCortexMcpServer(env: Env) {
  const server = new Server(
    {
      name: "cortex-mcp",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "taste_cortex_query",
          description:
            "Query Taste Cortex (aesthetic prompts, techniques, and visual references) using semantic similarity (768-dim bge).",
          inputSchema: {
            type: "object",
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
        },
        {
          name: "taste_cortex_compose",
          description:
            "Build an optimized, paste-ready generation prompt plus relevant assets from Taste Cortex. Searches prompts, techniques, and media-refs, then composes one prompt pack — not a raw blob dump.",
          inputSchema: {
            type: "object",
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
        },
        {
          name: "taste_cortex_get_blob",
          description: "Retrieve full markdown of a taste blob from R2. Pass metadata.slug from taste_cortex_query (preferred) or the vector id — both resolve.",
          inputSchema: {
            type: "object",
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
        },
        {
          name: "semantic_recall",
          description: "Recall situational memory and decisions from Cambium Cortex with strict tenant isolation.",
          inputSchema: {
            type: "object",
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
        },
        {
          name: "organ_atlas_lookup",
          description: "Authoritative lookup of any of the 5 Cambium or 6 Temperance organs and their contracts.",
          inputSchema: {
            type: "object",
            properties: {
              organId: {
                type: "string",
                description: "Organ identifier (e.g. 'cambium.taste', 'temperance.adytum', 'cambium.will')",
              },
            },
            required: ["organId"],
          },
        },
        {
          name: "capability_hit_evaluate",
          description:
            "Evaluate whether a capability card should be proposed for a task based on the 2026-09-03 selection formula (relevance, freshness, readiness, ownerMatch, novelty, evidenceQuality). Silence returned if score < 0.68.",
          inputSchema: {
            type: "object",
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
        },
        {
          name: "cortex_health",
          description: "Health probe for Cortex MCP bindings (Vectorize, Workers AI, R2).",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

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
      const results = await env.TASTE_CORTEX.query(queryVector, {
        topK: 12,
        returnMetadata: "all",
      });

      const buckets: Record<string, typeof results.matches> = {
        prompts: [],
        techniques: [],
        "media-refs": [],
      };
      for (const m of results.matches || []) {
        const cat = String(m.metadata?.category || "");
        if (buckets[cat] && buckets[cat].length < perCat) buckets[cat].push(m);
      }
      const selected = [...buckets.prompts, ...buckets["media-refs"], ...buckets.techniques];

      const hits: ComposeHit[] = [];
      for (const m of selected) {
        const meta = m.metadata || {};
        const slug = String(meta.slug || "");
        const cat = String(meta.category || "");
        let body = "";
        if (env.TASTE_BLOBS && slug && cat) {
          const obj = await env.TASTE_BLOBS.get(`taste/${cat}/${slug}.md`);
          if (obj) body = await obj.text();
        }
        hits.push({
          id: m.id,
          score: m.score,
          category: cat,
          slug,
          author: String(meta.author || "unknown"),
          title: String(meta.title || slug),
          r2_key: slug && cat ? `taste/${cat}/${slug}.md` : undefined,
          body,
        });
      }

      const pack = composePack(intent, target, hits);
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
      const result = evaluateCapabilityHit({
        taskFingerprint: String(args?.taskFingerprint || ""),
        taskSummary: String(args?.taskSummary || ""),
        topicKey: args?.topicKey as any,
        candidateCapabilityId: String(args?.candidateCapabilityId || ""),
        relevance: Number(args?.relevance ?? 1),
        freshness: Number(args?.freshness ?? 1),
        readiness: Number(args?.readiness ?? 1),
        ownerMatch: Number(args?.ownerMatch ?? 1),
        novelty: Number(args?.novelty ?? 1),
        evidenceQuality: Number(args?.evidenceQuality ?? 1),
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
      const tenant = String(args?.tenant || "");
      const query = String(args?.query || "");
      const kind = args?.kind ? String(args.kind) : undefined;
      const topK = Math.min(Number(args?.top_k || 5), 10);

      if (!env.CAMBIUM_CORTEX) {
        throw new Error("CAMBIUM_CORTEX binding not configured");
      }

      const allowedTenants = (env.CONTEXT_ALLOWED_TENANTS || "cambium").split(",").map((t) => t.trim());
      if (!allowedTenants.includes(tenant)) {
        throw new Error(`Unauthorized tenant: ${tenant}`);
      }

      const aiRes = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: [query.slice(0, 1000)],
      });
      const queryVector = aiRes.data[0];

      const filter: Record<string, unknown> = { tenant: { $eq: tenant } };
      if (kind) filter.kind = { $eq: kind };

      const results = await env.CAMBIUM_CORTEX.query(queryVector, {
        topK,
        returnMetadata: "all",
        filter,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results.matches, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/v1/health") {
      return new Response(JSON.stringify({ ok: true, service: "cortex-mcp" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/mcp" || url.pathname === "/v1/mcp" || url.pathname === "/") {
      if (request.method !== "POST") {
        return new Response("MCP endpoint requires POST", { status: 405 });
      }

      try {
        const body = await request.json();
        const server = createCortexMcpServer(env);

        const { id, method, params } = body as any;
        const rpcHeaders = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        };
        const rpcOk = (result: unknown) =>
          new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { headers: rpcHeaders });
        const rpcErr = (code: number, message: string, status = 200) =>
          new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
            headers: rpcHeaders,
            status,
          });

        // MCP handshake — Hermes (and Claude) call initialize before tools/list.
        // Missing this parks cortex as MCPError: Method not found.
        if (method === "initialize") {
          const requested = String(params?.protocolVersion || "2024-11-05");
          return rpcOk({
            protocolVersion: requested || "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "cortex-mcp", version: "1.1.1" },
            instructions:
              "Read-only Cortex MCP. Tools: taste_cortex_query, taste_cortex_get_blob, semantic_recall, organ_atlas_lookup, capability_hit_evaluate, cortex_health.",
          });
        }

        if (method === "notifications/initialized" || method === "initialized") {
          return new Response(null, { status: 202, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        if (method === "ping") {
          return rpcOk({});
        }

        // Hermes 2026-07-28 fallback after initialize is rejected
        if (method === "server/discover") {
          return rpcOk({
            protocolVersion: "2025-06-18",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "cortex-mcp", version: "1.1.1" },
          });
        }

        if (method === "tools/list") {
          const res = await (server as any)._requestHandlers.get("tools/list")({ method, params });
          return rpcOk(res);
        }

        if (method === "tools/call") {
          const res = await (server as any)._requestHandlers.get("tools/call")({ method, params });
          return rpcOk(res);
        }

        return rpcErr(-32601, `Method not found: ${method}`);
      } catch (err: any) {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: err.message || "Internal error" } }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
