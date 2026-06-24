// cambium-quests · Workers runtime glue. All logic lives in handler.ts (pure, node:test-covered).

import { handle, TELEGRAM_PROD_PUBKEY } from './handler.ts';
import type {
  BridgeAssignmentRecord,
  BridgeStoreLike,
  FabricEvidenceCandidateRecord,
  FabricEvidenceReviewRecord,
  FabricLedgerEventRecord,
  FabricLedgerStoreLike,
  FabricLedgerTaskRecord,
  SimpleRequest,
} from './handler.ts';

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

interface Env {
  QUESTS: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
  };
  BRIDGE_DB?: D1DatabaseLike;
  QUESTS_PUSH_TOKEN?: string;
  GATE_BOT_ID?: string;
  GATE_FOUNDER_IDS?: string;
  GATE_TG_PUBKEY?: string;
  BRIDGE_TOKEN?: string;
  HERMES_ASSIGNMENT_TOKEN?: string;
  HANDOFF_SECRET?: string;
  PROVIDER_BROKER_TOKEN?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_DEFAULT_MODEL?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_BASE_URL?: string;
  NVIDIA_DEFAULT_MODEL?: string;
  NEBIUS_API_KEY?: string;
  NEBIUS_BASE_URL?: string;
  NEBIUS_DEFAULT_MODEL?: string;
}

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function d1BridgeStore(db: D1DatabaseLike): BridgeStoreLike {
  return {
    async putUpstream(tenantId, id, message) {
      const receivedAt = typeof message.receivedAt === 'string' ? message.receivedAt : new Date().toISOString();
      await db.prepare(`
        INSERT OR REPLACE INTO bridge_up (tenant_id, id, message_json, received_at)
        VALUES (?, ?, ?, ?)
      `).bind(tenantId, id, JSON.stringify(message), receivedAt).run();
    },
    async listUpstream(tenantId, limit) {
      const rows = (await db.prepare(`
        SELECT message_json
        FROM bridge_up
        WHERE tenant_id = ?
        ORDER BY received_at DESC
        LIMIT ?
      `).bind(tenantId, limit).all<{ message_json: string }>()).results ?? [];
      const messages: any[] = [];
      for (const row of rows.reverse()) {
        try { messages.push(JSON.parse(row.message_json)); } catch { /* skip corrupt D1 inbox records */ }
      }
      return messages;
    },
    async putDirective(memberId, id, directive) {
      const enqueuedAt = typeof directive.enqueuedAt === 'string' ? directive.enqueuedAt : new Date().toISOString();
      await db.prepare(`
        INSERT OR REPLACE INTO bridge_directives (member_id, id, directive_json, delivered, enqueued_at, delivered_at)
        VALUES (?, ?, ?, 0, ?, NULL)
      `).bind(memberId, id, JSON.stringify(directive), enqueuedAt).run();
    },
    async listPendingDirectives(memberId, limit) {
      const rows = (await db.prepare(`
        SELECT directive_json
        FROM bridge_directives
        WHERE member_id = ? AND delivered = 0
        ORDER BY enqueued_at ASC
        LIMIT ?
      `).bind(memberId, limit).all<{ directive_json: string }>()).results ?? [];
      const directives: any[] = [];
      let skipped = 0;
      for (const row of rows) {
        try { directives.push(JSON.parse(row.directive_json)); } catch { skipped++; }
      }
      return { directives, skipped };
    },
    async markDirectiveDelivered(memberId, id, deliveredAt) {
      const row = await db.prepare(`
        SELECT directive_json
        FROM bridge_directives
        WHERE member_id = ? AND id = ? AND delivered = 0
      `).bind(memberId, id).first<{ directive_json: string }>();
      if (!row) return false;
      let directive: Record<string, unknown>;
      try { directive = parseJsonRecord(row.directive_json); } catch { directive = { id, memberId }; }
      directive.delivered = true;
      directive.deliveredAt = deliveredAt;
      const result = await db.prepare(`
        UPDATE bridge_directives
        SET delivered = 1, delivered_at = ?, directive_json = ?
        WHERE member_id = ? AND id = ? AND delivered = 0
      `).bind(deliveredAt, JSON.stringify(directive), memberId, id).run();
      return (result.meta?.changes ?? 0) > 0;
    },
    async getAssignment(memberId, eventId) {
      const row = await db.prepare(`
        SELECT directive_id, task_id, project_id, correlation_id, payload_hash, enqueued_at
        FROM bridge_assignments
        WHERE member_id = ? AND event_id = ?
      `).bind(memberId, eventId).first<{
        directive_id: string;
        task_id: string;
        project_id: string;
        correlation_id: string | null;
        payload_hash: string;
        enqueued_at: string;
      }>();
      if (!row) return null;
      return {
        id: row.directive_id,
        memberId,
        taskId: row.task_id,
        projectId: row.project_id,
        eventId,
        correlationId: row.correlation_id ?? undefined,
        payloadHash: row.payload_hash,
        enqueuedAt: row.enqueued_at,
      };
    },
    async putAssignment(record: BridgeAssignmentRecord) {
      await db.prepare(`
        INSERT INTO bridge_assignments (
          member_id, event_id, directive_id, task_id, project_id, correlation_id, payload_hash, enqueued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.memberId,
        record.eventId,
        record.id,
        record.taskId,
        record.projectId,
        record.correlationId ?? null,
        record.payloadHash,
        record.enqueuedAt,
      ).run();
    },
  };
}

function fabricTenant(record: { tenantId?: string; payload?: Record<string, unknown> }): string {
  const payloadTenant = record.payload && typeof record.payload.tenantId === 'string' ? record.payload.tenantId : undefined;
  return record.tenantId ?? payloadTenant ?? 'cambium';
}

export function d1FabricLedgerStore(db: D1DatabaseLike): FabricLedgerStoreLike {
  const taskFromRow = (row: any): FabricLedgerTaskRecord => ({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    projectId: row.project_id,
    memberId: row.member_id,
    status: row.status,
    workMode: row.work_mode,
    evidenceStrength: row.evidence_strength,
    title: row.title,
    payload: parseJsonRecord(row.payload_json),
    updatedAt: row.updated_at,
  });
  const eventFromRow = (row: any): FabricLedgerEventRecord => ({
    tenantId: row.tenant_id,
    eventId: row.event_id,
    taskId: row.task_id,
    projectId: row.project_id,
    memberId: row.member_id,
    type: row.type,
    source: row.source,
    payloadHash: row.payload_hash,
    upstreamPayloadHash: row.upstream_payload_hash,
    payload: parseJsonRecord(row.payload_json),
    correlationId: row.correlation_id,
    receivedAt: row.received_at,
  });
  const candidateFromRow = (row: any): FabricEvidenceCandidateRecord => ({
    tenantId: row.tenant_id,
    candidateId: row.candidate_id,
    taskId: row.task_id,
    projectId: row.project_id,
    memberId: row.member_id,
    status: row.status,
    confidence: row.confidence,
    matchKind: row.match_kind,
    evidence: parseJsonRecord(row.evidence_json),
    reason: row.reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewActor: row.review_actor,
    reviewReason: row.review_reason,
  });
  return {
    async getEvent(eventId, tenantId = 'cambium') {
      const row = await db.prepare(`
        SELECT tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash,
          upstream_payload_hash, payload_json, correlation_id, received_at
        FROM fabric_task_events
        WHERE tenant_id = ? AND event_id = ?
      `).bind(tenantId, eventId).first<any>();
      return row ? eventFromRow(row) : null;
    },
    async putEvent(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        INSERT INTO fabric_task_events (
          tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash,
          upstream_payload_hash, payload_json, correlation_id, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        record.eventId,
        record.taskId,
        record.projectId,
        record.memberId,
        record.type,
        record.source,
        record.payloadHash,
        record.upstreamPayloadHash ?? null,
        JSON.stringify(record.payload),
        record.correlationId ?? null,
        record.receivedAt,
      ).run();
    },
    async getTask(taskId, tenantId = 'cambium') {
      const row = await db.prepare(`
        SELECT tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
        FROM fabric_tasks
        WHERE tenant_id = ? AND task_id = ?
      `).bind(tenantId, taskId).first<any>();
      return row ? taskFromRow(row) : null;
    },
    async findTasks(tenantId = 'cambium') {
      const rows = (await db.prepare(`
        SELECT tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
        FROM fabric_tasks
        WHERE tenant_id = ?
        ORDER BY updated_at DESC
        LIMIT 500
      `).bind(tenantId).all<any>()).results ?? [];
      return rows.map(taskFromRow);
    },
    async upsertTask(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        INSERT INTO fabric_tasks (
          tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, task_id) DO UPDATE SET
          project_id = excluded.project_id,
          member_id = excluded.member_id,
          status = excluded.status,
          work_mode = excluded.work_mode,
          evidence_strength = excluded.evidence_strength,
          title = excluded.title,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).bind(
        tenantId,
        record.taskId,
        record.projectId,
        record.memberId,
        record.status,
        record.workMode ?? null,
        record.evidenceStrength,
        record.title ?? null,
        JSON.stringify({ ...record.payload, tenantId }),
        record.updatedAt,
      ).run();
    },
    async putEvidenceCandidate(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        INSERT OR REPLACE INTO fabric_evidence_candidates (
          tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json,
          reason, created_at, reviewed_at, review_actor, review_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        record.candidateId,
        record.taskId,
        record.projectId,
        record.memberId,
        record.status,
        record.confidence,
        record.matchKind,
        JSON.stringify(record.evidence),
        record.reason,
        record.createdAt,
        record.reviewedAt ?? null,
        record.reviewActor ?? null,
        record.reviewReason ?? null,
      ).run();
    },
    async getEvidenceCandidate(candidateId, tenantId = 'cambium') {
      const row = await db.prepare(`
        SELECT tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json,
          reason, created_at, reviewed_at, review_actor, review_reason
        FROM fabric_evidence_candidates
        WHERE tenant_id = ? AND candidate_id = ?
      `).bind(tenantId, candidateId).first<any>();
      return row ? candidateFromRow(row) : null;
    },
    async listReviewItems(tenantId = 'cambium') {
      const rows = (await db.prepare(`
        SELECT tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json,
          reason, created_at, reviewed_at, review_actor, review_reason
        FROM fabric_evidence_candidates
        WHERE tenant_id = ? AND status = 'review_pending'
        ORDER BY created_at ASC
        LIMIT 200
      `).bind(tenantId).all<any>()).results ?? [];
      return rows.map(candidateFromRow);
    },
    async updateEvidenceCandidate(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        UPDATE fabric_evidence_candidates
        SET status = ?, confidence = ?, match_kind = ?, evidence_json = ?, reason = ?,
          reviewed_at = ?, review_actor = ?, review_reason = ?
        WHERE tenant_id = ? AND candidate_id = ?
      `).bind(
        record.status,
        record.confidence,
        record.matchKind,
        JSON.stringify(record.evidence),
        record.reason,
        record.reviewedAt ?? null,
        record.reviewActor ?? null,
        record.reviewReason ?? null,
        tenantId,
        record.candidateId,
      ).run();
    },
    async putEvidenceReview(record: FabricEvidenceReviewRecord) {
      const tenantId = record.tenantId ?? 'cambium';
      await db.prepare(`
        INSERT INTO fabric_evidence_reviews (tenant_id, review_id, candidate_id, outcome, actor, reason, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        record.reviewId,
        record.candidateId,
        record.outcome,
        record.actor,
        record.reason ?? null,
        record.reviewedAt,
      ).run();
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const simple: SimpleRequest = {
      method: request.method,
      path: url.pathname,
      headers,
      body: ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined,
    };
    const kv = {
      get: (key: string) => env.QUESTS.get(key),
      put: (key: string, value: string) => env.QUESTS.put(key, value),
      list: async (prefix: string) => (await env.QUESTS.list({ prefix })).keys.map((k) => k.name),
    };
    const gate = env.GATE_BOT_ID && env.GATE_FOUNDER_IDS ? {
      botId: env.GATE_BOT_ID,
      pubKeyHex: env.GATE_TG_PUBKEY || TELEGRAM_PROD_PUBKEY,
      founderIds: env.GATE_FOUNDER_IDS.split(',').map((s) => s.trim()),
    } : undefined;
    const providerBroker = env.PROVIDER_BROKER_TOKEN ? {
      token: env.PROVIDER_BROKER_TOKEN,
      providers: {
        ollama: env.OLLAMA_API_KEY ? {
          apiKey: env.OLLAMA_API_KEY,
          baseUrl: env.OLLAMA_BASE_URL || 'https://ollama.com/v1',
          defaultModel: env.OLLAMA_DEFAULT_MODEL || 'kimi-k2.7-code:cloud',
          models: env.OLLAMA_DEFAULT_MODEL ? [env.OLLAMA_DEFAULT_MODEL] : ['kimi-k2.7-code:cloud'],
        } : undefined,
        nvidia: env.NVIDIA_API_KEY ? {
          apiKey: env.NVIDIA_API_KEY,
          baseUrl: env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
          defaultModel: env.NVIDIA_DEFAULT_MODEL || 'meta/llama-3.1-70b-instruct',
          models: env.NVIDIA_DEFAULT_MODEL ? [env.NVIDIA_DEFAULT_MODEL] : ['meta/llama-3.1-70b-instruct'],
        } : undefined,
        nebius: env.NEBIUS_API_KEY ? {
          apiKey: env.NEBIUS_API_KEY,
          baseUrl: env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1',
          defaultModel: env.NEBIUS_DEFAULT_MODEL || 'Qwen/Qwen3-235B-A22B-Instruct-2507',
          models: env.NEBIUS_DEFAULT_MODEL ? [env.NEBIUS_DEFAULT_MODEL] : ['Qwen/Qwen3-235B-A22B-Instruct-2507'],
        } : undefined,
      },
      fetch: fetch.bind(globalThis),
    } : undefined;
    const res = await handle(simple, {
      kv,
      pushToken: env.QUESTS_PUSH_TOKEN,
      gate,
      bridgeToken: env.BRIDGE_TOKEN,
      assignmentToken: env.HERMES_ASSIGNMENT_TOKEN,
      bridgeStore: env.BRIDGE_DB ? d1BridgeStore(env.BRIDGE_DB) : undefined,
      fabricLedger: env.BRIDGE_DB ? d1FabricLedgerStore(env.BRIDGE_DB) : undefined,
      handoffSecret: env.HANDOFF_SECRET,
      providerBroker,
    });
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};
