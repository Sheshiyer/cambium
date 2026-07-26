// cambium-quests · pure handler tests (node:test, like everything beside it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { handle, TELEGRAM_PROD_PUBKEY } from './handler.ts';
import worker, { d1BridgeBusinessTaskStore, d1BridgeExecutionStore, d1BridgeStore, d1FabricLedgerStore } from './index.ts';
import { d1MarketingRenderStore } from './marketing-render-store.ts';
import {
  MARKETING_CREATE_ADAPTER_ID,
  MARKETING_CREATE_EXPECTED_ACTIVATION,
  MARKETING_CREATE_PROVIDER_URL,
} from './marketing-renderer.ts';
import type {
  FabricEvidenceCandidateRecord,
  FabricEvidenceReviewRecord,
  FabricLedgerEventRecord,
  FabricLedgerStoreLike,
  FabricLedgerTaskRecord,
  KvLike,
  SimpleRequest,
} from './handler.ts';
import type { D1DatabaseLike, D1StatementLike } from './index.ts';
import type { IVerifExpleeObserver } from './iverif-explee.ts';
import { d1LeadRuntimeStore } from './lead-runtime-store.ts';
import { PAGE } from './page.ts';
import {
  FRESH_ECOSYSTEM_VISUAL_FIXTURE,
  IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE,
  NO_FAKE_PROGRESS_VISUAL_FIXTURE,
  OFFLINE_ECOSYSTEM_VISUAL_FIXTURE,
  STALE_ECOSYSTEM_VISUAL_FIXTURE,
} from './visual-fixtures.ts';
import {
  MINI_APP_ECOSYSTEM_TARGETS,
  MINI_APP_INTERACTION_KINDS,
  MINI_APP_MAP_SUBSECTIONS,
  MINI_APP_MAP_SUBSECTION_IDS,
  MINI_APP_SCENE_IDS,
  MINI_APP_SECTIONS,
  MINI_APP_SECTION_IDS,
} from './mini-app-surface-contract.ts';
import { CAMBIUM_LANES, CAMBIUM_SENSES, CAMBIUM_VISUAL_RAILS, CAMBIUM_VISUAL_STAGES, CAMBIUM_WAKE_STEPS } from '../../../shared/cambium-visual-contract.ts';

function fakeKv(): KvLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(k) { return store.get(k) ?? null; },
    async put(k, v) { store.set(k, v); },
    async list(prefix) { return [...store.keys()].filter((k) => k.startsWith(prefix)); },
  };
}

class FakeFabricLedger implements FabricLedgerStoreLike {
  readonly events = new Map<string, FabricLedgerEventRecord>();
  readonly tasks = new Map<string, FabricLedgerTaskRecord>();
  readonly candidates = new Map<string, FabricEvidenceCandidateRecord>();
  readonly reviews = new Map<string, FabricEvidenceReviewRecord>();

  tenantId(record: { tenantId?: string; payload?: Record<string, unknown> } | null | undefined) {
    return String(record?.tenantId ?? record?.payload?.tenantId ?? 'cambium');
  }
  eventKey(eventId: string, tenantId = 'cambium') { return tenantId === 'cambium' ? eventId : `${tenantId}:${eventId}`; }
  taskKey(taskId: string, tenantId = 'cambium') { return tenantId === 'cambium' ? taskId : `${tenantId}:${taskId}`; }
  candidateKey(candidateId: string, tenantId = 'cambium') { return tenantId === 'cambium' ? candidateId : `${tenantId}:${candidateId}`; }

  async getEvent(eventId: string, tenantId = 'cambium') { return this.events.get(this.eventKey(eventId, tenantId)) ?? null; }
  async putEvent(record: FabricLedgerEventRecord) {
    const key = this.eventKey(record.eventId, this.tenantId(record));
    if (this.events.has(key)) return false;
    this.events.set(key, record);
    return true;
  }
  async getTask(taskId: string, tenantId = 'cambium') { return this.tasks.get(this.taskKey(taskId, tenantId)) ?? null; }
  async findTasks(tenantId = 'cambium') { return [...this.tasks.values()].filter((task) => this.tenantId(task) === tenantId); }
  async upsertTask(record: FabricLedgerTaskRecord) { this.tasks.set(this.taskKey(record.taskId, this.tenantId(record)), record); }
  async putEvidenceCandidate(record: FabricEvidenceCandidateRecord) { this.candidates.set(this.candidateKey(record.candidateId, this.tenantId(record)), record); }
  async getEvidenceCandidate(candidateId: string, tenantId = 'cambium') { return this.candidates.get(this.candidateKey(candidateId, tenantId)) ?? null; }
  async listReviewItems(tenantId = 'cambium') { return [...this.candidates.values()].filter((candidate) => candidate.status === 'review_pending' && this.tenantId(candidate) === tenantId); }
  async updateEvidenceCandidate(record: FabricEvidenceCandidateRecord) { this.candidates.set(this.candidateKey(record.candidateId, this.tenantId(record)), record); }
  async putEvidenceReview(record: FabricEvidenceReviewRecord) { this.reviews.set(record.reviewId, record); }
}

class FakeD1Statement implements D1StatementLike {
  private values: unknown[] = [];
  private readonly db: FakeD1Database;
  private readonly sql: string;
  constructor(db: FakeD1Database, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T = unknown>() { return this.db.first(this.sql, this.values) as T | null; }
  async all<T = unknown>() { return { results: this.db.all(this.sql, this.values) as T[] }; }
  async run() { return { meta: { changes: this.db.run(this.sql, this.values) } }; }
}

class FakeD1Database implements D1DatabaseLike {
  readonly bridgeUp = new Map<string, any>();
  readonly directives = new Map<string, any>();
  readonly assignments = new Map<string, any>();
  readonly roleTaskClaims = new Map<string, any>();
  readonly tasks = new Map<string, any>();
  readonly events = new Map<string, any>();
  readonly candidates = new Map<string, any>();
  readonly reviews = new Map<string, any>();

  prepare(sql: string) { return new FakeD1Statement(this, sql); }
  private norm(sql: string) { return sql.replace(/\s+/g, ' ').trim().toLowerCase(); }
  private key(...parts: unknown[]) { return parts.map((part) => String(part)).join('\u0000'); }
  private insertUnique(rows: Map<string, any>, key: string, row: any, ignore: boolean): number {
    if (rows.has(key)) {
      if (ignore) return 0;
      throw new Error(`UNIQUE constraint failed for fake D1 key ${key}`);
    }
    rows.set(key, row);
    return 1;
  }

  all(sql: string, values: unknown[]): any[] {
    const q = this.norm(sql);
    if (q.includes('from bridge_up')) {
      const [tenantId, limit] = values;
      return [...this.bridgeUp.values()]
        .filter((row) => row.tenant_id === tenantId)
        .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
        .slice(0, Number(limit))
        .map((row) => ({ message_json: row.message_json }));
    }
    if (q.includes('from bridge_directives')) {
      const [memberId, limit] = values;
      return [...this.directives.values()]
        .filter((row) => row.member_id === memberId && row.delivered === 0)
        .sort((a, b) => String(a.enqueued_at).localeCompare(String(b.enqueued_at)))
        .slice(0, Number(limit))
        .map((row) => ({ directive_json: row.directive_json }));
    }
    if (q.includes('from fabric_tasks')) {
      const [tenantId] = values;
      return [...this.tasks.values()]
        .filter((row) => row.tenant_id === tenantId)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    }
    if (q.includes('from fabric_evidence_candidates')) {
      const [tenantId] = values;
      return [...this.candidates.values()]
        .filter((row) => row.tenant_id === tenantId && row.status === 'review_pending')
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .slice(0, 200);
    }
    throw new Error(`FakeD1 all() missing SQL: ${q}`);
  }

  first(sql: string, values: unknown[]): any | null {
    const q = this.norm(sql);
    if (q.includes('from bridge_directives')) {
      const [memberId, id] = values;
      const row = this.directives.get(this.key(memberId, id));
      if (!row || (q.includes('delivered = 0') && row.delivered !== 0)) return null;
      return { directive_json: row.directive_json, delivered: row.delivered, delivered_at: row.delivered_at };
    }
    if (q.includes('from bridge_assignments')) {
      const [memberId, eventId] = values;
      const row = this.assignments.get(this.key(memberId, eventId));
      return row ? {
        directive_id: row.directive_id,
        task_id: row.task_id,
        project_id: row.project_id,
        correlation_id: row.correlation_id,
        payload_hash: row.payload_hash,
        enqueued_at: row.enqueued_at,
      } : null;
    }
    if (q.includes('from bridge_role_task_claims')) {
      const [eventId] = values;
      return this.roleTaskClaims.get(String(eventId)) ?? null;
    }
    if (q.includes('from fabric_task_events')) {
      const [tenantId, eventId] = values;
      return this.events.get(this.key(tenantId, eventId)) ?? null;
    }
    if (q.includes('from fabric_tasks')) {
      const [tenantId, taskId] = values;
      return this.tasks.get(this.key(tenantId, taskId)) ?? null;
    }
    if (q.includes('from fabric_evidence_candidates')) {
      const [tenantId, candidateId] = values;
      return this.candidates.get(this.key(tenantId, candidateId)) ?? null;
    }
    throw new Error(`FakeD1 first() missing SQL: ${q}`);
  }

  run(sql: string, values: unknown[]): number {
    const q = this.norm(sql);
    if (q.startsWith('insert or replace into bridge_up')) {
      const [tenant_id, id, message_json, received_at] = values;
      this.bridgeUp.set(this.key(tenant_id, id), { tenant_id, id, message_json, received_at });
      return 1;
    }
    if (q.startsWith('insert into bridge_directives') || q.startsWith('insert or replace into bridge_directives') || q.startsWith('insert or ignore into bridge_directives')) {
      const [member_id, id, directive_json, enqueued_at] = values;
      const key = this.key(member_id, id);
      if (q.startsWith('insert or ignore') && this.directives.has(key)) return 0;
      const existing = this.directives.get(key);
      if (existing && q.startsWith('insert into bridge_directives')) {
        const existingPayload = JSON.parse(String(existing.directive_json)).payload as Record<string, unknown> | undefined;
        const incomingPayload = JSON.parse(String(directive_json)).payload as Record<string, unknown> | undefined;
        if (existingPayload?.type === 'native_execution' || incomingPayload?.type === 'native_execution') return 0;
      }
      this.directives.set(key, { member_id, id, directive_json, delivered: 0, enqueued_at, delivered_at: null });
      return 1;
    }
    if (q.startsWith('update bridge_directives')) {
      const [delivered_at, directive_json, member_id, id] = values;
      const key = this.key(member_id, id);
      const row = this.directives.get(key);
      if (!row || row.delivered !== 0) return 0;
      this.directives.set(key, { ...row, delivered: 1, delivered_at, directive_json });
      return 1;
    }
    if (q.startsWith('insert into bridge_assignments') || q.startsWith('insert or ignore into bridge_assignments')) {
      const [member_id, event_id, directive_id, task_id, project_id, correlation_id, payload_hash, enqueued_at] = values;
      return this.insertUnique(
        this.assignments,
        this.key(member_id, event_id),
        { member_id, event_id, directive_id, task_id, project_id, correlation_id, payload_hash, enqueued_at },
        q.startsWith('insert or ignore'),
      );
    }
    if (q.startsWith('insert or ignore into bridge_role_task_claims')) {
      const [event_id, role_id, member_id, project_id, binding_version, intent_hash, claimed_at] = values;
      return this.insertUnique(
        this.roleTaskClaims,
        String(event_id),
        { event_id, role_id, member_id, project_id, binding_version, intent_hash, claimed_at },
        true,
      );
    }
    if (q.startsWith('insert into fabric_task_events') || q.startsWith('insert or ignore into fabric_task_events')) {
      const [tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash, upstream_payload_hash, payload_json, correlation_id, received_at] = values;
      return this.insertUnique(
        this.events,
        this.key(tenant_id, event_id),
        { tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash, upstream_payload_hash, payload_json, correlation_id, received_at },
        q.startsWith('insert or ignore'),
      );
    }
    if (q.startsWith('insert into fabric_tasks')) {
      const [tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at] = values;
      this.tasks.set(this.key(tenant_id, task_id), { tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at });
      return 1;
    }
    if (q.startsWith('insert or replace into fabric_evidence_candidates')) {
      const [tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json, reason, created_at, reviewed_at, review_actor, review_reason] = values;
      this.candidates.set(this.key(tenant_id, candidate_id), { tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json, reason, created_at, reviewed_at, review_actor, review_reason });
      return 1;
    }
    if (q.startsWith('update fabric_evidence_candidates')) {
      const [status, confidence, match_kind, evidence_json, reason, reviewed_at, review_actor, review_reason, tenant_id, candidate_id] = values;
      const key = this.key(tenant_id, candidate_id);
      const row = this.candidates.get(key);
      if (!row) return 0;
      this.candidates.set(key, { ...row, status, confidence, match_kind, evidence_json, reason, reviewed_at, review_actor, review_reason });
      return 1;
    }
    if (q.startsWith('insert into fabric_evidence_reviews') || q.startsWith('insert or ignore into fabric_evidence_reviews')) {
      const [tenant_id, review_id, candidate_id, outcome, actor, reason, reviewed_at] = values;
      return this.insertUnique(
        this.reviews,
        this.key(tenant_id, review_id),
        { tenant_id, review_id, candidate_id, outcome, actor, reason, reviewed_at },
        q.startsWith('insert or ignore'),
      );
    }
    throw new Error(`FakeD1 run() missing SQL: ${q}`);
  }
}

class SqliteD1Statement implements D1StatementLike {
  private values: unknown[] = [];
  private readonly statement: any;
  constructor(statement: any) {
    this.statement = statement;
  }
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T = unknown>() {
    const row = this.statement.get(...this.values) as T | undefined;
    return row ?? null;
  }
  async all<T = unknown>() { return { results: this.statement.all(...this.values) as T[] }; }
  async run() {
    const result = this.statement.run(...this.values);
    return { meta: { changes: Number(result.changes ?? 0) } };
  }
}

class SqliteD1Database implements D1DatabaseLike {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }
  prepare(sql: string) { return new SqliteD1Statement(this.db.prepare(sql)); }
}

const questsMigrationDir = new URL('../migrations/', import.meta.url);
const legacyFabricTenantUpgradeSql = new URL('../schema/legacy/2026-06-24-fabric-tenant-upgrade.sql', import.meta.url);

function normalMigrationFiles() {
  return readdirSync(questsMigrationDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function applyNormalMigrations(db: DatabaseSync) {
  for (const file of normalMigrationFiles()) {
    db.exec(readFileSync(new URL(file, questsMigrationDir), 'utf8'));
  }
}

function executionClaim(overrides: Record<string, unknown> = {}) {
  const claim = {
    schema: 'thoughtseed.hermes.execution_claim.v1',
    memberId: 'shesh',
    directiveId: 'native-canary-1',
    idempotencyKey: 'native-canary-1',
    runnerId: 'hermes-ec2-runner-01',
    hostIdentity: 'hermes-ec2-01',
    ...overrides,
  };
  return {
    ...claim,
    executionId: typeof overrides.executionId === 'string'
      ? overrides.executionId
      : testExecutionId(String(claim.memberId), String(claim.directiveId), String(claim.idempotencyKey)),
  };
}

function testDigestCanonical(value: unknown) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function testExecutionId(memberId: string, directiveId: string, idempotencyKey: string) {
  return `exec_${createHash('sha256')
    .update(canonicalJson({ memberId, directiveId, idempotencyKey }))
    .digest('hex')
    .slice(0, 32)}`;
}

function executionOutcome(
  claim: Record<string, unknown>,
  claimResponse: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  const status = overrides.status === 'failed' || overrides.status === 'retryable' ? overrides.status : 'executed';
  const startedAt = String(overrides.startedAt ?? '2026-07-15T10:00:00.000Z');
  const finishedAt = String(overrides.finishedAt ?? '2026-07-15T10:00:01.000Z');
  const inputDigest = testDigestCanonical({ nonce: `nonce-${claim.directiveId}` });
  const outputDigest = status === 'executed' ? testDigestCanonical({
    schema: 'thoughtseed.hermes.canary_proof.v1',
    directiveId: claim.directiveId,
    idempotencyKey: claim.idempotencyKey,
    executionId: claim.executionId,
    command: 'canary.record',
    inputDigest,
  }) : undefined;
  const identity = {
    schema: 'thoughtseed.hermes.execution_attestation.v1',
    executionId: claim.executionId,
    directiveId: claim.directiveId,
    idempotencyKey: claim.idempotencyKey,
    runnerId: claim.runnerId,
    hostIdentity: claim.hostIdentity,
    command: 'canary.record',
    status,
    exitCode: status === 'executed' ? 0 : status === 'failed' ? 1 : null,
    inputDigest,
    ...(outputDigest ? { outputDigest } : {}),
    ...(status === 'executed' ? {} : { errorCode: String(overrides.errorCode ?? 'canary_failed') }),
    startedAt,
    finishedAt,
  };
  const attestation = {
    ...identity,
    id: `att_${createHash('sha256').update(canonicalJson(identity)).digest('hex').slice(0, 32)}`,
  };
  const { status: _status, errorCode: _errorCode, startedAt: _startedAt, finishedAt: _finishedAt, ...extra } = overrides;
  return {
    schema: 'thoughtseed.hermes.execution_outcome.v1',
    memberId: claim.memberId,
    directiveId: claim.directiveId,
    idempotencyKey: claim.idempotencyKey,
    executionId: claim.executionId,
    runnerId: claim.runnerId,
    claimId: claimResponse.claimId,
    fencingToken: claimResponse.fencingToken,
    attempt: claimResponse.attempt,
    status,
    attestation,
    ...extra,
  };
}

function nativeExecutionHarness(now: () => string) {
  const db = new DatabaseSync(':memory:');
  applyNormalMigrations(db);
  const sqliteD1 = new SqliteD1Database(db);
  const bridgeStore = d1BridgeStore(sqliteD1);
  const executionStore = d1BridgeExecutionStore(sqliteD1);
  const r2Objects = new Map<string, { bytes: Uint8Array; customMetadata: Record<string, string> }>();
  let r2Puts = 0;
  const r2 = {
    async get(key: string) {
      const object = r2Objects.get(key);
      if (!object) return null;
      return {
        key,
        size: object.bytes.byteLength,
        customMetadata: object.customMetadata,
        async text() { return new TextDecoder().decode(object.bytes); },
        async arrayBuffer() { return object.bytes.slice().buffer; },
      };
    },
    async head(key: string) {
      const object = r2Objects.get(key);
      if (!object) return null;
      return {
        key,
        size: object.bytes.byteLength,
        customMetadata: object.customMetadata,
        async text() { return ''; },
        async arrayBuffer() { return object.bytes.slice().buffer; },
      };
    },
    async put(key: string, value: Uint8Array, options?: { customMetadata?: Record<string, string> }) {
      if (r2Objects.has(key)) return null;
      r2Puts++;
      const object = { bytes: value.slice(), customMetadata: { ...(options?.customMetadata ?? {}) } };
      r2Objects.set(key, object);
      return {
        key,
        size: object.bytes.byteLength,
        customMetadata: object.customMetadata,
        async text() { return new TextDecoder().decode(object.bytes); },
        async arrayBuffer() { return object.bytes.slice().buffer; },
      };
    },
  };
  const businessStore = d1BridgeBusinessTaskStore(sqliteD1, r2);
  let uuidIndex = 0;
  return {
    db,
    bridgeStore,
    executionStore,
    businessStore,
    r2,
    r2Objects,
    r2Puts: () => r2Puts,
    deps: {
      kv: fakeKv(),
      bridgeToken: 'bridge',
      assignmentToken: 'assign-only',
      handoffSecret: 'handoff-secret',
      now,
      nowMs: () => Date.parse(now()),
      uuid: () => `native-${++uuidIndex}`,
      bridgeStore,
      executionStore,
      businessStore,
    },
  };
}

async function queueNativeDirective(
  deps: ReturnType<typeof nativeExecutionHarness>['deps'],
  overrides: Record<string, unknown> = {},
) {
  const id = String(overrides.id ?? 'native-canary-1');
  const memberId = String(overrides.memberId ?? 'shesh');
  const idempotencyKey = String(overrides.idempotencyKey ?? id);
  const response = await handle(req('POST', '/v1/bridge/directive', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      id,
      memberId,
      idempotencyKey,
      payload: {
        type: 'native_execution',
        schema: 'thoughtseed.hermes.native_execution.v1',
        command: 'canary.record',
        target: { memberId },
        input: { nonce: `nonce-${id}` },
      },
    }),
  }), deps);
  assert.equal(response.status, 200);
}

async function issueScopedMemberToken(
  deps: ReturnType<typeof nativeExecutionHarness>['deps'],
  memberId = 'shesh',
) {
  const add = await handle(req('POST', '/v1/handoff/members', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId, tenantId: 'cambium', email: `${memberId}@example.com` }),
  }), deps);
  assert.equal(add.status, 200);
  const invite = await handle(req('POST', '/v1/handoff/invite', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId, linkBase: 'https://curious.thoughtseed.space' }),
  }), deps);
  assert.equal(invite.status, 200);
  const redeem = await handle(req('POST', '/v1/handoff/redeem', {
    body: JSON.stringify({ invite: body(invite).invite }),
  }), deps);
  assert.equal(redeem.status, 200);
  return String(body(redeem).token);
}

function businessTaskIntake(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'thoughtseed.business_task_intake.v1',
    source: 'temperance-operator',
    action: 'service_agreement.draft.render',
    memberId: 'shesh',
    idempotencyKey: 'service-agreement-system-canary-20260717',
    synthetic: true,
    intent: 'Create an internal service agreement draft for the Thoughtseed D1 lease canary',
    project: {
      tenantId: 'thoughtseed',
      projectId: 'thoughtseed-system-canary',
      clientId: 'synthetic-client',
      clientDisplayName: 'Thoughtseed Systems Test Client',
      projectName: 'Thoughtseed D1 Lease Canary',
      projectSummary: 'A bounded proof connecting D1 leasing to Hermes, Temperance, DOCX rendering, durable storage, and authenticated readback.',
      deliverables: ['One D1-leased task', 'One pinned service-agreement DOCX draft'],
      outOfScope: ['External delivery or publication', 'Signature requests or legal commitment'],
    },
    commercial: { engagementType: 'fixed_price', currency: 'INR', feeMinor: 100000 },
    approval: {
      scope: 'internal_canary_draft_only',
      observationId: 'approval_draft_canary_20260717',
      observedAt: '2026-07-17T08:50:00.000Z',
    },
    externalAction: 'none',
    ...overrides,
  };
}

const req = (method: string, path: string, extra: Partial<SimpleRequest> = {}): SimpleRequest =>
  ({ method, path, headers: {}, ...extra });

const body = (r: { body: string }) => JSON.parse(r.body);
const IVERIF_TEST_READ_TOKEN = `iverif-read-v1.${'a'.repeat(64)}`;

function fakeIVerifExplee(overrides: Partial<IVerifExpleeObserver> = {}): IVerifExpleeObserver {
  const source = { provider: 'explee-public-api' as const, observedAt: '2026-07-16T07:00:00.000Z' };
  const project = {
    projectId: 16_763,
    period: 'all',
    emailsSent: 6_439,
    replies: 31,
    replyRatePercent: 0.5,
    hotLeads: 6,
    spendUsd: 193.17,
  };
  const campaign = {
    campaignId: 45_711,
    campaign: 'Public Agencies',
    status: 'outreach',
    statusReason: null,
    period: 'all',
    emailsSent: 2_921,
    replies: 17,
    replyRatePercent: 0.6,
    hotLeads: 6,
    spendUsd: 87.63,
    costPerLeadUsd: 14.61,
    dailyBudgetUsd: 9,
    poolUsed: 2_779,
    poolTotal: 2_887,
  };
  const autopilot = {
    projectId: 16_763,
    autopilotEnabled: true,
    autoReplyEnabled: true,
    autoReplyDelayMinutes: 1_440,
  };
  return {
    async getProjectAnalytics() { return { source, analytics: project }; },
    async getCampaignAnalytics() { return { source, analytics: campaign }; },
    async getAutopilot() { return { source, autopilot }; },
    async getSnapshot() { return { source, project, campaign, autopilot }; },
    async getNeedReplyInbox() {
      return {
        source,
        tab: 'need_reply',
        contacts: [{
          personId: 'person-1',
          latestIntent: 'hot_lead',
          sentCount: 2,
          replyCount: 1,
          latestSentAt: '2026-07-15T00:00:00.000Z',
          latestReplyAt: '2026-07-15T01:00:00.000Z',
        }],
        total: 1,
        omittedContacts: 0,
        pageCount: 1,
        truncated: false,
      };
    },
    async getThread(personId) {
      return {
        source,
        personId,
        canReply: true,
        replyBlockedReason: null,
        latestIntent: 'hot_lead',
        messageCount: 1,
        truncated: false,
        messages: [{
          messageId: 'message-1',
          type: 'reply',
          intent: 'hot_lead',
          status: null,
          timestamp: '2026-07-15T01:00:00.000Z',
        }],
      };
    },
    ...overrides,
  };
}

const roleTaskBindings = (
  version = '2026-07-14.1',
  binding: Record<string, unknown> = {},
): string => JSON.stringify({
  schema: 'cambium.role-task-bindings.v1',
  version,
  bindings: {
    ceo: { enabled: true, memberId: 'shesh', projectId: 'thoughtseed-ops', taskType: 'operations' },
    scientist: { enabled: true, memberId: 'shesh', projectId: 'thoughtseed-ops', taskType: 'research' },
    engineer: {
      enabled: true,
      memberId: 'shesh',
      projectId: 'thoughtseed-ops',
      taskType: 'engineering',
      ...binding,
    },
    designer: { enabled: true, memberId: 'shesh', projectId: 'thoughtseed-ops', taskType: 'design' },
    synthesist: { enabled: true, memberId: 'shesh', projectId: 'thoughtseed-ops', taskType: 'research' },
    hermes: { enabled: true, memberId: 'shesh', projectId: 'thoughtseed-ops', taskType: 'operations' },
  },
});

const roleTaskBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: 'hermes.role-task-intake.v1',
  source: 'telegram-manual',
  roleId: 'engineer',
  text: 'Prepare the native routing proof packet.',
  idempotencyKey: 'telegram-manual:engineer:proof-1',
  actorId: 'founder-1',
  ...overrides,
});

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertNoInertPseudoButtons(html: string) {
  const missing: string[] = [];
  const pseudoButton = /<(?<tag>[a-z][a-z0-9-]*)\b(?<attrs>[^>]*\bclass="[^"]*(?:\bcmd\b|\brail\b|\bbeat\b)[^"]*"[^>]*)>/gi;
  for (const match of html.matchAll(pseudoButton)) {
    const attrs = match.groups?.attrs ?? '';
    const className = attrs.match(/\bclass="([^"]*)"/)?.[1] ?? 'unknown';
    const interactionKind = attrs.match(/\bdata-interaction-kind="([^"]*)"/)?.[1] ?? '';
    const hasSource = /\bdata-(?:source|proof)="[^"]*"/.test(attrs);
    if (!interactionKind) missing.push(`${className}:missing-kind`);
    if (interactionKind === 'read-only' && !hasSource) missing.push(`${className}:missing-source`);
  }
  assert.deepEqual(missing, [], `inert pseudo-buttons missing data interaction markers: ${missing.join(', ')}`);
}

function assertSheetHasSource(sheet: string, source: string) {
  assert.match(sheet, new RegExp(`<b>source<\\/b><span>${escapeRegExp(source)}`));
}

function assertNoSecretLeak(html: string) {
  for (const marker of ['TELEGRAM_INIT_DATA=', 'TG_INIT_DATA=', 'QUESTS_PUSH_TOKEN=', 'Bearer ', 'hash=']) {
    assert.doesNotMatch(html, new RegExp(escapeRegExp(marker)), `secret marker leaked: ${marker}`);
  }
}

const PRIMARY_MISSION_COPY_DENYLIST = [
  'scene provenance',
  'ecosystem target',
  'R3F',
  'operator map',
  'tapestry audit',
  'contract',
  'schema',
  'envelope',
  'quest-ledger',
  'paperclipCommandsData',
  'signed queue',
  'no local state write',
  'source route',
  'no local operator writes',
  'real world-state',
  'no fake progress',
  'served beats',
  'operator narrative',
  'source detail',
  'debug layer',
  'back path',
  'trace action',
];

const PRIMARY_SCENE_SHEET_TELEMETRY_DENYLIST = [
  'reduced motion proof',
  'data-reduced-motion-proof',
  'data-sheet',
  'data-signed-action',
  'data-chat-command',
  'data-read-only',
  'scene state changes remain visible',
  'sheet=',
  'signed action=',
  'chat command=',
  'read-only=',
  'proof, packet, freshness, and system detail',
  'system detail behind the main Mission Control flow',
];

const CHROME_COPY_DENYLIST = [
  'real world-state',
  'no fake progress',
  'scene provenance',
  'ecosystem target',
  'source detail',
  'debug layer',
  'back path',
  'trace action',
  'operator narrative',
  'served beats',
  'local operator writes',
];

const STORY_PRIMARY_COPY_DENYLIST = [
  'story fallback',
  'served beats',
  'quest-ledger',
  'operator narrative',
  'source detail',
  'no fake story progress',
  'served proof',
  'operator lesson',
  'proof detail available in sheet',
];

function decodeHtmlText(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const NON_TEXT_TAGS = new Set(['script', 'style', 'svg']);
const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

function htmlAttributeValue(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function htmlTagName(tag: string): string | null {
  const match = tag.match(/^<\/?\s*([a-z][\w:-]*)/i);
  return match ? match[1].toLowerCase() : null;
}

function openingTagHidesText(tag: string, tagName: string): boolean {
  if (NON_TEXT_TAGS.has(tagName)) return true;
  if (/(?:^|[\s<])hidden(?:[\s=/>]|$)/i.test(tag)) return true;
  if ((htmlAttributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') return true;

  const className = htmlAttributeValue(tag, 'class');
  if (className?.split(/\s+/).includes('sr')) return true;

  const style = htmlAttributeValue(tag, 'style') ?? '';
  return /\bdisplay\s*:\s*none\b/i.test(style) || /\bvisibility\s*:\s*hidden\b/i.test(style);
}

function stripNonRenderedTextNodes(html: string): string {
  const stack: Array<{ tagName: string; hidden: boolean }> = [];
  let hiddenDepth = 0;
  let stripped = '';
  let offset = 0;

  for (const match of html.matchAll(/<!--[\s\S]*?-->|<\/?[a-z][^>]*>|<[^>]+>/gi)) {
    if (hiddenDepth === 0) stripped += html.slice(offset, match.index);

    const token = match[0];
    const tagName = htmlTagName(token);
    if (token.startsWith('<!--')) {
      if (hiddenDepth === 0) stripped += ' ';
    } else if (!tagName) {
      if (hiddenDepth === 0) stripped += token;
    } else if (/^<\s*\//.test(token)) {
      let closedHidden = false;
      while (stack.length > 0) {
        const frame = stack.pop()!;
        if (frame.hidden) {
          closedHidden = true;
          hiddenDepth = Math.max(0, hiddenDepth - 1);
        }
        if (frame.tagName === tagName) break;
      }
      if (!closedHidden && hiddenDepth === 0) stripped += token;
    } else {
      const hidden = hiddenDepth > 0 || openingTagHidesText(token, tagName);
      const selfClosing = /\/\s*>$/.test(token) || VOID_HTML_TAGS.has(tagName);
      if (!hidden) stripped += token;
      else if (hiddenDepth === 0) stripped += ' ';
      if (!selfClosing) {
        stack.push({ tagName, hidden });
        if (hidden) hiddenDepth += 1;
      }
    }

    offset = match.index + token.length;
  }

  if (hiddenDepth === 0) stripped += html.slice(offset);
  return stripped;
}

function visibleTextFromHtml(html: string): string {
  return decodeHtmlText(stripNonRenderedTextNodes(html)
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function pageFragment(name: string, pattern: RegExp): string {
  const match = PAGE.match(pattern);
  assert.ok(match, `PAGE has ${name}`);
  return match[0];
}

function assertNoPrimaryMetaCopy(html: string) {
  for (const term of PRIMARY_MISSION_COPY_DENYLIST) {
    assert.doesNotMatch(html, new RegExp(escapeRegExp(term), 'i'), `primary copy leaked meta term: ${term}`);
  }
}

function assertNoStoryPrimaryCopyLeak(html: string) {
  const text = visibleTextFromHtml(html);
  for (const term of STORY_PRIMARY_COPY_DENYLIST) {
    assert.doesNotMatch(text, new RegExp(escapeRegExp(term), 'i'), `Story primary copy leaked: ${term}`);
  }
}

function assertNoPrimarySceneSheetTelemetry(html: string) {
  for (const term of PRIMARY_SCENE_SHEET_TELEMETRY_DENYLIST) {
    assert.doesNotMatch(html, new RegExp(escapeRegExp(term), 'i'), `primary sheet leaked telemetry term: ${term}`);
  }
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signBridge(secret: string, msg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonicalJson(msg)));
  return { ...msg, signature: b64urlFromBytes(new Uint8Array(sig)) };
}

const ENVELOPE = JSON.stringify({
  schema: 1, derivedAt: '2026-06-10T18:00:00Z', source: 'push', tenant: 'cambium',
  ledger: { completed: 6, total: 7, current: { arc: 'VII', title: 'Many Gardens' }, rows: [] },
});

const PARTIAL_VISUAL_ENVELOPE = JSON.stringify({
  schema: 1,
  derivedAt: '2026-01-01T00:00:00Z',
  source: 'fixture',
  tenant: 'cambium',
  wake: { source: 'quest-ledger-envelope@v1', steps: [{ id: 'ingest', status: 'proved', detail: 'fixture' }] },
  lanes: { source: 'missing', total: 0, dominant: null, counts: { micro: 0, meso: 0, macro: 0, noesis: 0 }, gap: 'lane telemetry missing from world.log' },
  ledger: { completed: 0, total: 17, current: { arc: 'I', title: 'The Calling' }, rows: [] },
});

class FakeClassList {
  private readonly names = new Set<string>();

  add(...tokens: string[]) {
    for (const token of tokens) this.names.add(token);
  }

  remove(...tokens: string[]) {
    for (const token of tokens) this.names.delete(token);
  }

  toggle(token: string, force?: boolean) {
    const on = force ?? !this.names.has(token);
    if (on) this.names.add(token);
    else this.names.delete(token);
    return on;
  }

  has(token: string) {
    return this.names.has(token);
  }
}

function fakeStyle(): Record<string, string | ((name: string, value: string) => void)> {
  const style: Record<string, string | ((name: string, value: string) => void)> = {};
  style.setProperty = (name: string, value: string) => { style[name] = value; };
  return style;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function dataKey(name: string) {
  return name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function htmlAttributes(tag: string) {
  const attrs = new Map<string, string>();
  for (const match of tag.matchAll(/\s([a-zA-Z0-9_:-]+)(?:="([^"]*)")?/g)) {
    attrs.set(match[1], decodeHtmlAttribute(match[2] ?? ''));
  }
  return attrs;
}

function htmlMatchesSingleSelector(attrs: Map<string, string>, tagName: string, selector: string) {
  const normalized = selector.trim().toLowerCase();
  if (!normalized) return false;
  const classMatch = selector.match(/^\.([a-zA-Z0-9_-]+)$/);
  if (classMatch) return (attrs.get('class') || '').split(/\s+/).includes(classMatch[1]);
  const attrMatch = selector.match(/^\[([a-zA-Z0-9_:-]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, name, value] = attrMatch;
    if (!attrs.has(name)) return false;
    return value === undefined || attrs.get(name) === value;
  }
  return /^[a-z][a-z0-9-]*$/i.test(selector) && tagName.toLowerCase() === normalized;
}

function htmlMatchesSelector(attrs: Map<string, string>, tagName: string, selector: string) {
  return selector.split(',').some((part) => htmlMatchesSingleSelector(attrs, tagName, part));
}

function prepareFakeEvent(rawEvent: Record<string, any>, fallbackType: string, target: ReturnType<typeof makeElement>) {
  const event = rawEvent || {};
  event.type ||= fallbackType;
  event.target ||= target;
  event.bubbles = event.bubbles !== false;
  event.cancelBubble = false;
  event.defaultPrevented = Boolean(event.defaultPrevented);
  const originalPreventDefault = typeof event.preventDefault === 'function' ? event.preventDefault : null;
  event.preventDefault = () => {
    event.defaultPrevented = true;
    if (originalPreventDefault && originalPreventDefault !== event.preventDefault) originalPreventDefault.call(event);
  };
  const originalStopPropagation = typeof event.stopPropagation === 'function' ? event.stopPropagation : null;
  event.stopPropagation = () => {
    event.cancelBubble = true;
    if (originalStopPropagation && originalStopPropagation !== event.stopPropagation) originalStopPropagation.call(event);
  };
  return event;
}

function makeElement(id: string, tagName = 'div', initialAttrs: Map<string, string> = new Map()) {
  let html = '';
  let htmlVersion = 0;
  let disabled = initialAttrs.has('disabled');
  const attrs = new Map(initialAttrs);
  const listeners = new Map<string, Set<(event: Record<string, any>) => void>>();
  const pointerCaptureCalls: unknown[] = [];
  const focusCalls: unknown[] = [];
  const queryCache = new Map<string, ReturnType<typeof makeElement>[]>();
  const dataset = {} as Record<string, string>;
  for (const [name, value] of attrs) {
    if (name.startsWith('data-')) dataset[dataKey(name)] = value;
  }
  const element = {
    id,
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    parentElement: null as ReturnType<typeof makeElement> | null,
    get innerHTML() { return html; },
    set innerHTML(value: string) {
      html = String(value);
      htmlVersion += 1;
      queryCache.clear();
    },
    textContent: '',
    style: fakeStyle(),
    classList: new FakeClassList(),
    dataset,
    children: [] as unknown[],
    clientWidth: 390,
    scrollTop: 0,
    get disabled() { return disabled; },
    set disabled(value: boolean) {
      disabled = Boolean(value);
      if (disabled) attrs.set('disabled', '');
      else attrs.delete('disabled');
    },
    onclick: null as unknown,
    onkeydown: null as unknown,
    eventListeners: listeners,
    setPointerCaptureCalls: pointerCaptureCalls,
    focusCalls,
    addEventListener(type: string, listener: (event: Record<string, any>) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: (event: Record<string, any>) => void) {
      listeners.get(type)?.delete(listener);
    },
    setAttribute(name: string, value: string) {
      const normalizedValue = String(value);
      attrs.set(name, normalizedValue);
      if (name.startsWith('data-')) this.dataset[dataKey(name)] = normalizedValue;
      if (name === 'disabled') disabled = true;
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
    matches(selector: string) {
      return htmlMatchesSelector(attrs, tagName, selector);
    },
    closest(selector: string) {
      let node: ReturnType<typeof makeElement> | null = this;
      while (node) {
        if (node.matches(selector)) return node;
        node = node.parentElement;
      }
      return null;
    },
    setPointerCapture(pointerId: unknown) {
      pointerCaptureCalls.push(pointerId);
    },
    focus(options?: unknown) {
      focusCalls.push(options ?? null);
    },
    dispatchEvent(rawEvent: Record<string, any>) {
      const event = prepareFakeEvent(rawEvent, rawEvent?.type || 'event', this);
      let node: ReturnType<typeof makeElement> | null = this;
      while (node) {
        event.currentTarget = node;
        for (const listener of node.eventListeners.get(event.type) ?? []) listener.call(node, event);
        const propertyHandler = node[`on${event.type}` as keyof typeof node];
        if (typeof propertyHandler === 'function') propertyHandler.call(node, event);
        if (!event.bubbles || event.cancelBubble) break;
        node = node.parentElement;
      }
      return !event.defaultPrevented;
    },
    click() {
      if (disabled) return false;
      return this.dispatchEvent({ type: 'click', bubbles: true, cancelable: true });
    },
    querySelectorAll(selector: string) {
      const key = `${htmlVersion}\u0000${selector}`;
      if (!queryCache.has(key)) {
        const nodes: ReturnType<typeof makeElement>[] = [];
        for (const match of this.innerHTML.matchAll(/<([a-z0-9-]+)\b([^>]*)>/gi)) {
          const matchedTagName = match[1].toLowerCase();
          const attrs = htmlAttributes(match[0]);
          if (!htmlMatchesSelector(attrs, matchedTagName, selector)) continue;
          const node = makeElement(`${id}:query:${nodes.length}`, matchedTagName, attrs);
          node.parentElement = this;
          node.innerHTML = match[0];
          node.textContent = match[0];
          nodes.push(node);
        }
        queryCache.set(key, nodes);
      }
      return queryCache.get(key)!;
    },
    querySelector(selector: string) {
      const found = this.querySelectorAll(selector)[0];
      if (found) return found;
      const empty = makeElement(`${id}:query`);
      empty.parentElement = this;
      return empty;
    },
  };
  return element;
}

async function renderPageFixtureContext(
  envelope: unknown,
  options: {
    search?: string;
    rejectFetch?: boolean;
    now?: string;
    fetchSequence?: unknown[];
    clipboard?: boolean;
    telegramInitData?: string;
    onFetch?: (request: { url: string; init: RequestInit; index: number }) => void;
    fetchResponder?: (request: { url: string; init: RequestInit; index: number }) => unknown;
  } = {},
) {
  const scripts = [...PAGE.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim() && !script.includes('telegram-web-app'));
  assert.equal(scripts.length, 1, 'page has one inline app script');

  const elements = new Map<string, ReturnType<typeof makeElement>>();
  const getElementById = (id: string) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id)!;
  };
  for (const id of ['ten', 'fresh', 'sceneBadge', 'ptr', 'ptrProof', 'track', 'ind', 'tb0', 'tb1', 'tb2', 'tb3', 'tb4',
    'stem', 'fill', 'progress', 'here', 'mapwrap', 'beats', 'gauge', 'gate', 'cmds', 'veil', 'sheet', 'sheetBody']) {
    getElementById(id);
  }
  getElementById('sheetBody').parentElement = getElementById('sheet');

  const fetchCalls: string[] = [];
  const fetchRequests: Array<{ url: string; init: RequestInit; method: string; body?: BodyInit | null }> = [];
  const clipboardWrites: string[] = [];
  const fetchSequence = [...(options.fetchSequence ?? [])];
  const fixedNow = options.now ? Date.parse(options.now) : null;
  const telegramWebApp = options.telegramInitData
    ? {
        initData: options.telegramInitData,
        initDataUnsafe: {},
        ready() {},
        expand() {},
        setHeaderColor() {},
        setBackgroundColor() {},
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
      }
    : undefined;
  const context: Record<string, unknown> = {
    document: { getElementById, querySelectorAll: () => [] },
    window: { Telegram: telegramWebApp ? { WebApp: telegramWebApp } : undefined, addEventListener() {}, innerWidth: 390 },
    location: { search: options.search ?? '' },
    matchMedia: () => ({ matches: true }),
    navigator: options.clipboard ? { clipboard: { writeText: async (text: string) => { clipboardWrites.push(String(text)); } } } : {},
    fetch: async (url: string, init: RequestInit = {}) => {
      fetchCalls.push(String(url));
      const record = { url: String(url), init, method: String(init.method ?? 'GET'), body: init.body };
      fetchRequests.push(record);
      options.onFetch?.({ url: record.url, init, index: fetchRequests.length - 1 });
      if (options.rejectFetch) throw new Error('fixture fetch failed');
      const request = { url: record.url, init, index: fetchRequests.length - 1 };
      const supplied = options.fetchResponder?.(request);
      const next = supplied !== undefined ? supplied : fetchSequence.length ? fetchSequence.shift() : envelope;
      if (next instanceof Error) throw next;
      return { ok: true, json: async () => next };
    },
    requestAnimationFrame: (fn: (time: number) => void) => { fn(0); return 0; },
    performance: { now: () => 0 },
    Date: fixedNow === null ? Date : { parse: Date.parse, now: () => fixedNow },
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  context.Telegram = (context.window as { Telegram?: unknown }).Telegram;
  context.globalThis = context;
  vm.runInContext(scripts[0], vm.createContext(context));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { elements, context, fetchCalls, fetchRequests, clipboardWrites };
}

function selectInspectPane(
  rendered: Awaited<ReturnType<typeof renderPageFixtureContext>>,
  pane: 'proof' | 'system',
) {
  const map = rendered.elements.get('mapwrap')!;
  const tab = map.querySelectorAll('[data-inspect-pane-select]').find((node) => node.dataset.inspectPaneSelect === pane);
  assert.ok(tab, `Inspect ${pane} tab is rendered`);
  tab.click();
  assert.equal(map.querySelectorAll('[data-inspect-pane-select]').find((node) => node.dataset.inspectPaneSelect === pane)?.getAttribute('aria-selected'), 'true');
}

async function renderPageFixture(envelope: unknown) {
  const { elements } = await renderPageFixtureContext(envelope);
  return elements;
}

const TEST_TELEGRAM_INIT_DATA = 'query_id=AAE-test&user=%7B%22id%22%3A424242%7D&auth_date=1783632000&hash=secret-signature';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function flushPageAsync(rounds = 4) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

test('healthz · ok', async () => {
  const r = await handle(req('GET', '/healthz'), { kv: fakeKv() });
  assert.equal(r.status, 200);
  assert.match(r.body, /cambium-quests/);
});

test('healthz gate · fails closed until Telegram gate bindings are configured', async () => {
  const missing = await handle(req('GET', '/healthz/gate'), { kv: fakeKv() });
  assert.equal(missing.status, 503);
  assert.deepEqual(JSON.parse(missing.body), {
    ok: false,
    worker: 'cambium-quests',
    capability: 'telegram-signed-gate',
    gateConfigured: false,
    error: 'gate not configured',
  });

  const ready = await handle(req('GET', '/healthz/gate'), {
    kv: fakeKv(),
    gate: {
      botId: '123456',
      founderIds: ['42'],
      pubKeyHex: TELEGRAM_PROD_PUBKEY,
    },
  });
  assert.equal(ready.status, 200);
  assert.deepEqual(JSON.parse(ready.body), {
    ok: true,
    worker: 'cambium-quests',
    capability: 'telegram-signed-gate',
    gateConfigured: true,
  });
});

test('context routes · handler delegates context health to bounded module', async () => {
  const r = await handle(req('GET', '/v1/context/health', {
    headers: { authorization: 'Bearer context-token' },
  }), {
    kv: fakeKv(),
    contextRoutes: {
      token: 'context-token',
      now: () => '2026-06-25T12:00:00.000Z',
      routineContext: { getSnapshot: async () => ({ sections: [] }) },
      semanticRecall: { recall: async () => [] },
    },
  });
  assert.equal(r.status, 200);
  assert.match(r.body, /thoughtseed\.context-health\.v1/);
  const payload = body(r);
  assert.equal(payload.capabilities.routineSnapshot, true);
  assert.equal(payload.capabilities.semanticRecall, true);
});

test('provider broker · requires configured broker token', async () => {
  const r = await handle(req('GET', '/v1/providers'), { kv: fakeKv() });
  assert.equal(r.status, 503);
  assert.match(r.body, /provider broker not configured/);
});

test('provider broker · rejects missing bearer token', async () => {
  const r = await handle(req('GET', '/v1/providers'), {
    kv: fakeKv(),
    providerBroker: { token: 'broker', providers: {} },
  });
  assert.equal(r.status, 401);
  assert.match(r.body, /provider broker credential/);
});

test('provider broker · lists configured providers without exposing secrets', async () => {
  const r = await handle(req('GET', '/v1/providers', { headers: { authorization: 'Bearer broker' } }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      providers: {
        nebius: {
          baseUrl: 'https://api.tokenfactory.nebius.com/v1/',
          apiKey: 'secret-nebius-key',
          defaultModel: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
          models: ['Qwen/Qwen3-235B-A22B-Instruct-2507'],
        },
        nvidia: undefined,
      },
    },
  });
  assert.equal(r.status, 200);
  const payload = body(r);
  assert.equal(payload.ok, true);
  assert.equal(payload.count, 1);
  assert.equal(payload.providers[0].id, 'nebius');
  assert.equal(payload.providers[0].baseUrl, 'https://api.tokenfactory.nebius.com/v1');
  assert.doesNotMatch(r.body, /secret-nebius-key/);
});

test('provider broker · proxies OpenAI-compatible calls with upstream provider key', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'chatcmpl-test', choices: [{ message: { content: 'OK' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const bodyJson = JSON.stringify({ model: 'Qwen/Qwen3-235B-A22B-Instruct-2507', messages: [{ role: 'user', content: 'ping' }] });
  const r = await handle(req('POST', '/v1/providers/nebius/chat/completions', {
    headers: { authorization: 'Bearer broker', 'content-type': 'application/json' },
    body: bodyJson,
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: {
        nebius: {
          baseUrl: 'https://api.tokenfactory.nebius.com/v1',
          apiKey: 'secret-nebius-key',
        },
      },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(body(r).choices[0].message.content, 'OK');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.tokenfactory.nebius.com/v1/chat/completions');
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, 'Bearer secret-nebius-key');
  assert.equal(calls[0].init.body, bodyJson);
});

test('provider broker · proxies calls that carry a query string (e.g. ?stream=true)', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'chatcmpl-stream', choices: [{ message: { content: 'OK' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const bodyJson = JSON.stringify({ model: 'Qwen/Qwen3-235B-A22B-Instruct-2507', stream: true, messages: [{ role: 'user', content: 'ping' }] });
  const r = await handle(req('POST', '/v1/providers/nebius/chat/completions?stream=true', {
    headers: { authorization: 'Bearer broker', 'content-type': 'application/json' },
    body: bodyJson,
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: {
        nebius: {
          baseUrl: 'https://api.tokenfactory.nebius.com/v1',
          apiKey: 'secret-nebius-key',
        },
      },
    },
  });
  // Must route to the provider (200), not reject the query string with 400 'bad upstream provider path'.
  assert.equal(r.status, 200);
  assert.equal(body(r).choices[0].message.content, 'OK');
  assert.equal(calls.length, 1);
  // The query string is stripped for upstream-path matching (parity with origin/main behaviour).
  assert.equal(calls[0].url, 'https://api.tokenfactory.nebius.com/v1/chat/completions');
});

test('provider broker · rejects unknown providers and path traversal', async () => {
  const deps = {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      providers: { nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'secret' } },
    },
  };
  const unknown = await handle(req('GET', '/v1/providers/ollama/models', {
    headers: { authorization: 'Bearer broker' },
  }), deps);
  assert.equal(unknown.status, 404);

  const traversal = await handle(req('GET', '/v1/providers/nebius/../secrets', {
    headers: { authorization: 'Bearer broker' },
  }), deps);
  assert.equal(traversal.status, 400);
});

test('provider broker · streams SSE through without buffering it', async () => {
  // The upstream emits three frames with a gap between them. If the broker buffers,
  // nothing is readable until the stream closes and time-to-first-token becomes
  // full generation time — which the caller sees as a slot that timed out.
  let closed = false;
  const fakeFetch: typeof fetch = async () =>
    new Response(
      new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"one"}}]}\n\n'));
          await new Promise((r) => setTimeout(r, 20));
          controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"two"}}]}\n\n'));
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          closed = true;
          controller.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  const r = await handle(req('POST', '/v1/providers/nebius/chat/completions', {
    headers: { authorization: 'Bearer broker', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'q', stream: true, messages: [{ role: 'user', content: 'hi' }] }),
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: { nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'secret' } },
    },
  });

  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'text/event-stream');
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.ok(r.body instanceof ReadableStream, 'SSE body must stay a stream, not a buffered string');

  // The handler returned before the upstream finished — that is the whole point.
  assert.equal(closed, false, 'broker must not wait for the upstream stream to close');

  const reader = (r.body as ReadableStream).getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /one/);
  await reader.cancel();
});

test('provider broker · non-SSE responses still come back as buffered strings', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  const r = await handle(req('GET', '/v1/providers/nebius/models', {
    headers: { authorization: 'Bearer broker' },
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: { nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'secret' } },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(typeof r.body, 'string');
});

test('provider broker · a hung upstream returns 504 rather than hanging', async () => {
  // Never resolves on its own; only the broker's AbortController can end this.
  const fakeFetch: typeof fetch = (_url, init = {}) =>
    new Promise((_resolve, reject) => {
      const signal = (init as { signal?: AbortSignal }).signal;
      signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const r = await handle(req('GET', '/v1/providers/nebius/models', {
    headers: { authorization: 'Bearer broker' },
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      timeoutMs: 20,
      providers: { nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'secret' } },
    },
  });
  assert.equal(r.status, 504);
  assert.match(r.body, /timed out/);
});

test('provider broker · an unreachable upstream returns 502, not a crash', async () => {
  const fakeFetch: typeof fetch = async () => { throw new TypeError('network failure'); };
  const r = await handle(req('GET', '/v1/providers/nebius/models', {
    headers: { authorization: 'Bearer broker' },
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: { nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'secret' } },
    },
  });
  assert.equal(r.status, 502);
  assert.match(r.body, /unreachable/);
});

test('provider broker · authHeader x-api-key sets the key there and NOT in authorization', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const r = await handle(req('POST', '/v1/providers/kimi-coding/messages', {
    headers: {
      authorization: 'Bearer broker',
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'k3', messages: [] }),
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: {
        'kimi-coding': {
          baseUrl: 'https://api.kimi.com/coding/v1',
          apiKey: 'secret-kimi-key',
          authHeader: 'x-api-key',
        },
      },
    },
  });
  assert.equal(r.status, 200);
  const sent = calls[0].init.headers as Record<string, string>;
  assert.equal(sent['x-api-key'], 'secret-kimi-key');
  // The caller's own broker credential must never reach the upstream, and the key
  // must not be duplicated into a second header.
  assert.equal(sent.authorization, undefined);
  // Protocol header the Anthropic-shaped upstream needs, forwarded verbatim.
  assert.equal(sent['anthropic-version'], '2023-06-01');
});

test('provider broker · forwardHeaders passes protocol headers but never a credential', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const r = await handle(req('POST', '/v1/providers/proto-demo/alpha/generate', {
    headers: {
      authorization: 'Bearer broker',
      'content-type': 'application/json',
      'x-command-code-version': '0.33.2',
      'x-session-id': 'sess-abc',
      'x-project-slug': 'pi-cc',
      cookie: 'session=should-not-travel',
      'x-not-allowlisted': 'nope',
    },
    body: JSON.stringify({ model: 'deepseek/deepseek-v4-flash', messages: [], system: '' }),
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: {
        'proto-demo': {
          baseUrl: 'https://api.commandcode.ai',
          apiKey: 'secret-cc-key',
          // authorization/cookie are refused by the guard even though listed here.
          forwardHeaders: ['x-command-code-version', 'x-session-id', 'x-project-slug', 'authorization', 'cookie'],
        },
      },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, 'https://api.commandcode.ai/alpha/generate');
  const sent = calls[0].init.headers as Record<string, string>;
  // Protocol headers Command Code rejects requests without.
  assert.equal(sent['x-command-code-version'], '0.33.2');
  assert.equal(sent['x-session-id'], 'sess-abc');
  assert.equal(sent['x-project-slug'], 'pi-cc');
  // The upstream gets the REAL key, never the caller's broker credential — even
  // though 'authorization' was (wrongly) present in forwardHeaders.
  assert.equal(sent.authorization, 'Bearer secret-cc-key');
  assert.equal(sent.cookie, undefined);
  // Anything not allowlisted stays out.
  assert.equal(sent['x-not-allowlisted'], undefined);
});

test('provider broker · a provider without forwardHeaders forwards no x- headers', async () => {
  const calls: Array<{ init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (_u, init = {}) => {
    calls.push({ init });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await handle(req('POST', '/v1/providers/nebius/chat/completions', {
    headers: { authorization: 'Bearer broker', 'content-type': 'application/json', 'x-session-id': 'leak-me' },
    body: '{}',
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: { nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'k' } },
    },
  });
  assert.equal((calls[0].init.headers as Record<string, string>)['x-session-id'], undefined);
});

test('provider broker · command-code lane translates both directions end to end', async () => {
  // The caller speaks OpenAI chat and must never learn this provider is different.
  let sent: { url: string; headers: Record<string, string>; body: unknown } | null = null;
  const enc = new TextEncoder();
  const fakeFetch: typeof fetch = async (url, init = {}) => {
    sent = {
      url: String(url),
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    };
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(enc.encode('data: {"type":"text-delta","text":"hi"}\n'));
          c.enqueue(enc.encode('data: {"type":"finish","finishReason":"stop"}\n'));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };

  const r = await handle(req('POST', '/v1/providers/command-code/chat/completions', {
    headers: { authorization: 'Bearer broker', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'command-code/deepseek/deepseek-v4-flash',
      messages: [{ role: 'system', content: 'be terse' }, { role: 'user', content: 'hello' }],
      stream: false,
    }),
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: {
        'command-code': {
          baseUrl: 'https://api.commandcode.ai',
          apiKey: 'secret-cc-key',
          translate: 'command-code',
        },
      },
    },
  });

  assert.equal(r.status, 200);

  // Outbound: Command Code's shape, its endpoint, its protocol headers, real key.
  assert.equal(sent!.url, 'https://api.commandcode.ai/alpha/generate');
  assert.equal(sent!.headers.authorization, 'Bearer secret-cc-key');
  assert.equal(sent!.headers['x-command-code-version'], '0.33.2');
  assert.ok(sent!.headers['x-session-id']);
  const envelope = sent!.body as Record<string, any>;
  // Envelope required by the endpoint; params carries the generation request.
  assert.equal(envelope.memory, '');
  assert.equal(envelope.permissionMode, 'standard');
  const body = envelope.params;
  assert.equal(body.system, 'be terse');            // hoisted out of messages
  assert.equal(body.stream, true);                  // forced, despite stream:false
  assert.equal(body.model, 'deepseek/deepseek-v4-flash'); // command-code/ prefix stripped

  // Inbound: a plain OpenAI completion, not Command Code events.
  const payload = JSON.parse(r.body as string);
  assert.equal(payload.object, 'chat.completion');
  assert.equal(payload.choices[0].message.content, 'hi');
  assert.equal(payload.choices[0].finish_reason, 'stop');
});

test('provider broker · command-code streaming callers get OpenAI SSE, not CC events', async () => {
  const enc = new TextEncoder();
  const fakeFetch: typeof fetch = async () =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(enc.encode('data: {"type":"text-delta","text":"yo"}\n'));
          c.enqueue(enc.encode('data: {"type":"finish","finishReason":"stop"}\n'));
          c.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  const r = await handle(req('POST', '/v1/providers/command-code/chat/completions', {
    headers: { authorization: 'Bearer broker', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'x', messages: [{ role: 'user', content: 'q' }], stream: true }),
  }), {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: { 'command-code': { baseUrl: 'https://api.commandcode.ai', apiKey: 'k', translate: 'command-code' } },
    },
  });

  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'text/event-stream');
  assert.ok(r.body instanceof ReadableStream);
  const text = await new Response(r.body as ReadableStream).text();
  assert.ok(text.includes('"object":"chat.completion.chunk"'));
  assert.ok(text.includes('"content":"yo"'));
  assert.ok(text.trimEnd().endsWith('data: [DONE]'));
  assert.ok(!text.includes('text-delta'), 'raw Command Code events must not leak to the caller');
});

test('provider broker · health without probe reports config only; ?probe=1 probes upstream', async () => {
  let probes = 0;
  const fakeFetch: typeof fetch = async (url) => {
    probes += 1;
    // nebius answers, nvidia is down — a config-only view calls both "healthy".
    return String(url).includes('nebius')
      ? new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response('nope', { status: 503, headers: { 'content-type': 'text/plain' } });
  };
  const deps = {
    kv: fakeKv(),
    providerBroker: {
      token: 'broker',
      fetch: fakeFetch,
      providers: {
        nebius: { baseUrl: 'https://api.tokenfactory.nebius.com/v1', apiKey: 'k1' },
        nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: 'k2' },
      },
    },
  };

  const plain = await handle(req('GET', '/v1/providers/health', {
    headers: { authorization: 'Bearer broker' },
  }), deps);
  assert.equal(plain.status, 200);
  assert.equal(body(plain).probed, false);
  assert.equal(probes, 0, 'config-only health must not touch the network');

  const probed = await handle(req('GET', '/v1/providers/health?probe=1', {
    headers: { authorization: 'Bearer broker' },
  }), deps);
  assert.equal(probed.status, 200);
  const payload = body(probed);
  assert.equal(payload.probed, true);
  assert.equal(payload.ok, false, 'one upstream is down, so the broker is not ok');
  assert.equal(probes, 2);
  const byId = Object.fromEntries(payload.providers.map((p: { id: string }) => [p.id, p]));
  assert.equal(byId.nebius.ok, true);
  assert.equal(byId.nvidia.ok, false);
  assert.equal(byId.nvidia.status, 503);
  assert.doesNotMatch(probed.body, /k1|k2/);
});

test('quests · M3 isolation suite green — gate open to all valid tenants', async () => {
  const r = await handle(req('GET', '/api/quests/demo-org'), { kv: fakeKv() });
  assert.equal(r.status, 404);                       // open, just no ledger pushed yet
  assert.match(r.body, /quine write quests push/);
});

test('quests · 404 with push hint before any ledger exists', async () => {
  const r = await handle(req('GET', '/api/quests/cambium'), { kv: fakeKv() });
  assert.equal(r.status, 404);
  assert.match(r.body, /quine write quests push/);
});

test('push · requires configured token', async () => {
  const r = await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE }), { kv: fakeKv() });
  assert.equal(r.status, 503);
});

test('push · rejects bad bearer', async () => {
  const r = await handle(
    req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer wrong' } }),
    { kv: fakeKv(), pushToken: 'right' },
  );
  assert.equal(r.status, 401);
});

test('push · validates envelope fields', async () => {
  const r = await handle(
    req('POST', '/internal/ledger/cambium', { body: '{"schema":1}', headers: { authorization: 'Bearer t' } }),
    { kv: fakeKv(), pushToken: 't' },
  );
  assert.equal(r.status, 400);
  assert.match(r.body, /missing/);
});

test('push then get · round-trips the envelope verbatim', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  assert.match(put.body, /"derivedAt":"2026-06-10T18:00:00Z"/);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  assert.equal(get.body, ENVELOPE);
  assert.equal(get.headers['cache-control'], 'no-store');
});

test('push then get · includes redacted ActionRequests when bridge records exist', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', bridgeToken: 'bridge' };
  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const created = await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      ...iverifActionRequest(),
      status: 'needs_signed_confirmation',
      selectedOptionId: 'draft-follow-up',
      receipts: [
        { at: '2026-07-07T10:05:00.000Z', kind: 'callback', text: 'Needs signed confirmation in the Mini App before Draft follow-up can run.', telegramMessageId: 901 },
      ],
    }),
  }), deps);
  assert.equal(created.status, 200);

  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const projection = body(get);
  assert.equal(projection.actionRequests.schema, 'thoughtseed.action-request-list.v1');
  assert.equal(projection.actionRequests.count, 1);
  assert.equal(projection.actionRequests.rows[0].id, 'ar_iverif_autogtm_lead_gap');
  assert.equal(projection.actionRequests.rows[0].status, 'needs_signed_confirmation');
  assert.equal(projection.actionRequests.rows[0].selectedOptionId, 'draft-follow-up');
  assert.doesNotMatch(get.body, /-1002691202808|telegramMessageId|initData|tgWebAppData|Bearer|bridge-token/i);
});

test('push then get · redacts generic social proof from public quest JSON', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'social-proof',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'generic-social-proof',
          title: 'LEADERBOARD RANK',
          state: 'ready',
          detail: 'viral follower proof',
          proof: 'generic social proof',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [{ label: 'rank', status: 'ready', detail: 'popularity signal' }],
        },
        {
          id: 'hyphenated-proof',
          title: 'COORDINATION CLAIM',
          state: 'ready',
          detail: 'coordination claim without explicit handoff source',
          proof: 'generic social-proof copy',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.source, 'coordination-evidence@v1');
  assert.equal(stored.social.scope, 'tenant-handoff-only');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.match(stored.social.rows[0].detail, /not tenant handoff evidence/);
  assert.match(stored.social.rows[0].proof, /explicit bridge, handoff, or founder gate sources/);
  assert.doesNotMatch(get.body, /leaderboard|rank|follower|viral|popularity|social proof|social-proof/i);
});

test('push then get · canonicalizes social metadata when safe rows survive', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'social-proof',
      status: 'ready',
      scope: 'social-proof',
      gap: 'social-proof metadata gap',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: '1 open tenant handoff awaiting founder review',
          proof: 'THO-9: blocked owner served',
          source: 'social-proof',
          scope: 'social-proof',
          gap: 'social-proof row gap',
          evidence: [{ label: 'THO-9', status: 'blocked', detail: 'Review launch copy' }],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'ready');
  assert.equal(stored.social.source, 'coordination-evidence@v1');
  assert.equal(stored.social.scope, 'tenant-handoff-only');
  assert.equal(stored.social.rows[0].source, 'coordination-evidence@v1');
  assert.equal(stored.social.rows[0].scope, 'tenant-handoff-only');
  assert.equal(stored.social.rows[0].gap, undefined);
  assert.match(stored.social.rows[0].detail, /tenant handoff/);
  assert.doesNotMatch(get.body, /social proof|social-proof/i);
});

test('push then get · canonicalizes unsafe row metadata even when top-level metadata is safe', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: '1 open tenant handoff awaiting founder review',
          proof: 'THO-9: blocked owner served',
          source: 'social-proof',
          scope: 'social-proof',
          gap: 'social-proof row gap',
          evidence: [{ label: 'THO-9', status: 'blocked', detail: 'Review launch copy' }],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'ready');
  assert.equal(stored.social.rows[0].source, 'coordination-evidence@v1');
  assert.equal(stored.social.rows[0].scope, 'tenant-handoff-only');
  assert.equal(stored.social.rows[0].gap, undefined);
  assert.doesNotMatch(get.body, /social proof|social-proof/i);
});

test('push then get · sanitizes rowless social metadata before public read', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'social-proof',
      status: 'ready',
      scope: 'tenant-handoff-only',
      gap: 'social-proof metadata gap',
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.source, 'coordination-evidence@v1');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.doesNotMatch(get.body, /social proof|social-proof/i);
});

test('get · sanitizes stale KV social metadata before public read', async () => {
  const kv = fakeKv();
  kv.store.set('ledger:cambium', JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'social-proof',
      status: 'ready',
      scope: 'social-proof',
      gap: 'social-proof metadata gap',
    },
  }));

  const get = await handle(req('GET', '/api/quests/cambium'), { kv });
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.source, 'coordination-evidence@v1');
  assert.equal(stored.social.scope, 'tenant-handoff-only');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.doesNotMatch(get.body, /social proof|social-proof/i);
});

test('push then get · rejects unsafe nonstandard evidence fields', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: '1 open tenant handoff awaiting founder review',
          proof: 'THO-9: blocked owner served',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [{ label: 'THO-9', status: 'blocked', detail: 'Review launch copy', proof: 'viral follower count' }],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.doesNotMatch(get.body, /follower|viral/i);
});

test('push then get · strips arbitrary unsafe social metadata fields', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      title: 'LEADERBOARD RANK',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: '1 open tenant handoff awaiting founder review',
          proof: 'THO-9: blocked owner served',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          metadata: 'viral follower count',
          evidence: [{ label: 'THO-9', status: 'blocked', detail: 'Review launch copy' }],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'ready');
  assert.equal(stored.social.title, undefined);
  assert.equal(stored.social.rows[0].metadata, undefined);
  assert.equal(stored.social.rows[0].source, 'coordination-evidence@v1');
  assert.doesNotMatch(get.body, /leaderboard|rank|follower|viral/i);
});

test('push then get · rejects raw secret markers inside social rows', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: '1 open tenant handoff awaiting founder review',
          proof: 'Bearer secret-token',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [{ label: 'rawInitData', status: 'query_id', detail: 'auth_date=123' }],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.doesNotMatch(get.body, /Bearer|secret-token|rawInitData|query_id|auth_date|hash=/i);
});

test('push then get · rejects bare initData and hash markers inside social rows', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: 'initData stored in row',
          proof: 'hash=',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.doesNotMatch(get.body, /initData|hash=/i);
});

test('push then get · rejects raw marker keys and token user id fragments', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const envelope = JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rawInitData: 'present as unsafe key',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: 'user={"id":123}',
          proof: 'token=abc id=123',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          token: 'abc',
          evidence: [],
        },
      ],
    },
  });

  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: envelope, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.rawInitData, undefined);
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.equal(stored.social.rows[0].token, undefined);
  assert.doesNotMatch(get.body, /rawInitData|token=|user=|id=|\"id\":123/i);
});

test('get · sanitizes stale KV social gap fallback before public read', async () => {
  const kv = fakeKv();
  kv.store.set('ledger:cambium', JSON.stringify({
    schema: 1,
    derivedAt: '2026-06-10T18:00:00Z',
    source: 'test',
    tenant: 'cambium',
    ledger: { rows: [], completed: 0, total: 0, current: null },
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          gap: 'social-proof row gap',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [],
        },
      ],
    },
  }));

  const get = await handle(req('GET', '/api/quests/cambium'), { kv });
  assert.equal(get.status, 200);
  const stored = JSON.parse(get.body);
  assert.equal(stored.social.status, 'gap');
  assert.equal(stored.social.rows[0].id, 'social-gap');
  assert.doesNotMatch(get.body, /social proof|social-proof/i);
});

test('push · stale envelope cannot erase branchStories', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const fresh = JSON.stringify({
    ...JSON.parse(ENVELOPE),
    derivedAt: '2026-06-29T07:15:00.000Z',
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [
        {
          branchId: 'fitcheck',
          name: 'Fitcheck',
          arcTitle: 'Launch arc',
          missions: [{ title: 'Launch proof packet', gate: 'Founder review', proofRequired: 'Viewport capture' }],
        },
      ],
    },
  });
  const stale = JSON.stringify({
    ...JSON.parse(PARTIAL_VISUAL_ENVELOPE),
    derivedAt: '2026-06-29T07:10:00.000Z',
  });

  const freshPut = await handle(
    req('POST', '/internal/ledger/cambium', { body: fresh, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(freshPut.status, 200);
  const stalePut = await handle(
    req('POST', '/internal/ledger/cambium', { body: stale, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(stalePut.status, 409);
  assert.match(stalePut.body, /stale ledger push rejected/);

  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  assert.match(get.body, /"branchId":"fitcheck"/);
  assert.match(get.body, /"derivedAt":"2026-06-29T07:15:00.000Z"/);
});

test('push · branchStories cannot regress to missing rows', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const withBranchStories = JSON.stringify({
    ...JSON.parse(ENVELOPE),
    derivedAt: '2026-06-29T07:15:00.000Z',
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [
        {
          branchId: 'vantyx',
          name: 'Vantyx',
          arcTitle: 'Commerce intelligence arc',
          missions: [{ title: 'Proof packet normalization', gate: 'Founder review', proofRequired: 'Packet validation' }],
        },
      ],
    },
  });
  const newerWithoutBranchStories = JSON.stringify({
    ...JSON.parse(ENVELOPE),
    derivedAt: '2026-06-29T07:20:00.000Z',
  });

  const branchPut = await handle(
    req('POST', '/internal/ledger/cambium', { body: withBranchStories, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(branchPut.status, 200);
  const regressionPut = await handle(
    req('POST', '/internal/ledger/cambium', { body: newerWithoutBranchStories, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(regressionPut.status, 409);
  assert.match(regressionPut.body, /branchStories regression rejected/);

  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  assert.match(get.body, /"branchId":"vantyx"/);
  assert.match(get.body, /"derivedAt":"2026-06-29T07:15:00.000Z"/);
});

test('push · accepts stale partial visual envelopes without inventing missing sections', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const put = await handle(
    req('POST', '/internal/ledger/cambium', { body: PARTIAL_VISUAL_ENVELOPE, headers: { authorization: 'Bearer t' } }), deps,
  );
  assert.equal(put.status, 200);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  assert.equal(get.body, PARTIAL_VISUAL_ENVELOPE);
  const stored = JSON.parse(get.body);
  assert.equal(stored.derivedAt, '2026-01-01T00:00:00Z');
  assert.equal(stored.skills, undefined);
  assert.equal(stored.npc, undefined);
});

test('push · tenant mismatch in envelope rejected', async () => {
  const bad = ENVELOPE.replace('"tenant":"cambium"', '"tenant":"other"');
  const r = await handle(
    req('POST', '/internal/ledger/cambium', { body: bad, headers: { authorization: 'Bearer t' } }),
    { kv: fakeKv(), pushToken: 't' },
  );
  assert.equal(r.status, 400);
});

test('page · serves the Living Blueprint shell at /', async () => {
  const r = await handle(req('GET', '/'), { kv: fakeKv() });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.match(PAGE, /#00272B/);
  assert.match(PAGE, /#E0FF4F/);
  assert.doesNotMatch(PAGE, /every status derives|real world-state|no fake progress/i);
  assert.match(JSON.stringify(NO_FAKE_PROGRESS_VISUAL_FIXTURE), /visual-fixture:no-fake-progress/);
  assert.match(PAGE, /telegram-web-app\.js/);
});

test('page · chrome copy scan keeps infrastructure terms out of visible shell copy', () => {
  const chromeFragments = [
    ['root status', pageFragment('root status header', /<header\b[^>]*class="[^"]*\broot-status\b[^"]*"[\s\S]*?<\/header>/i)],
    ['root nav', pageFragment('root nav', /<nav\b[^>]*class="[^"]*\broot-nav\b[^"]*"[\s\S]*?<\/nav>/i)],
    ['scene badge', pageFragment('scene badge', /<button\b[^>]*id="sceneBadge"[\s\S]*?<\/button>/i)],
    ['freshness chip', pageFragment('freshness chip', /<button\b[^>]*id="fresh"[\s\S]*?<\/button>/i)],
  ];
  const footer = PAGE.match(/<footer\b[\s\S]*?<\/footer>/i);
  if (footer) chromeFragments.push(['footer', footer[0]]);

  const visibleChromeCopy = chromeFragments
    .map(([name, html]) => `${name}: ${visibleTextFromHtml(html)}`)
    .join('\n');

  assert.match(visibleChromeCopy, /root status: Mission Control cambium · branch arcs Mission syncing/);
  assert.match(visibleChromeCopy, /root nav: Mission next move Gate review Tools act Story signals Inspect proof/);
  assert.match(visibleChromeCopy, /scene badge: Mission/);
  assert.match(visibleChromeCopy, /freshness chip: syncing/);
  for (const term of CHROME_COPY_DENYLIST) {
    assert.doesNotMatch(visibleChromeCopy, new RegExp(escapeRegExp(term), 'i'), `chrome copy leaked meta term: ${term}`);
  }
});

test('page · chrome copy scan ignores hidden helper copy', () => {
  const visibleCopy = visibleTextFromHtml(`
    <header data-debug="served beats">
      <strong>Mission visible</strong>
      <span class="sr">real world-state</span>
      <span hidden>no fake progress</span>
      <span aria-hidden="true">scene provenance</span>
      <span style="display:none">debug layer</span>
      <span style="visibility: hidden">operator narrative</span>
      <span title="source detail">Gate visible</span>
    </header>
  `);

  assert.equal(visibleCopy, 'Mission visible Gate visible');
  for (const term of CHROME_COPY_DENYLIST) {
    assert.doesNotMatch(visibleCopy, new RegExp(escapeRegExp(term), 'i'), `hidden chrome copy leaked meta term: ${term}`);
  }
});

test('page · five scenes with Mission-first tabs and sliding indicator', () => {
  for (const m of ['Mission Control', 'root-tab-label">Mission<', 'root-tab-label">Gate<', 'root-tab-label">Tools<', 'root-tab-label">Story<', 'root-tab-label">Inspect<', 'class="ind root-nav-indicator"', 'translateX']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
});

test('page · root shell uses Mission Control component-system nav', () => {
  for (const m of [
    'data-component="MissionControlShell"',
    'data-component="RootStatusStack"',
    'data-component="RootNav"',
    'data-component="RootSceneTab"',
    'data-root-scene="mission"',
    'data-root-scene="gate"',
    'data-root-scene="tools"',
    'data-root-scene="story"',
    'data-root-scene="inspect"',
    'data-nav-glyph="genesis"',
    'data-nav-glyph="gate"',
    'data-nav-glyph="ops"',
    'data-nav-glyph="proof"',
    'data-nav-glyph="cortex"',
    'data-component="RootBrandGlyph"',
    'root-tab-glyph',
    'mc-signal-rail',
    'data-component="MissionStateStack"',
    'data-component="GateActionRow"',
  ]) {
    assert.ok(PAGE.includes(m), `page has root nav component ${m}`);
  }
  assert.doesNotMatch(PAGE, /<title>[^<]*quest log/i);
});

test('page · scene tabs expose source labels', () => {
  assert.equal(PAGE.match(/data-scene-source="tg-miniapp-scenes@v1"/g)?.length, 5);
});

test('page · scenes expose accessible titles', () => {
  for (const [sceneId, titleId] of [
    ['sceneQ', 'sceneQTitle'],
    ['sceneF', 'sceneFTitle'],
    ['sceneS', 'sceneSTitle'],
    ['sceneG', 'sceneGTitle'],
    ['sceneC', 'sceneCTitle'],
  ]) {
    assert.match(PAGE, new RegExp(`id="${sceneId}" aria-labelledby="${titleId}"`));
    assert.match(PAGE, new RegExp(`id="${titleId}" class="sr"`));
  }
});

test('page · active scene badge opens founder summary sheet for primary scenes', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const badge = rendered.elements.get('sceneBadge')!;
  const scenes: Array<[number, string]> = [
    [0, 'Mission'],
    [1, 'Gate'],
    [2, 'Tools'],
    [3, 'Story'],
  ];

  for (const [index, label] of scenes) {
    (rendered.context.go as (index: number) => void)(index);
    assert.equal(badge.textContent, label);
    (badge.onclick as () => void)();
    const sheet = rendered.elements.get('sheetBody')!.innerHTML;
    assert.match(sheet, new RegExp(`mission control · ${label.toLowerCase()}`));
    assert.match(sheet, /next<\/b><span>/);
    assert.match(sheet, /refresh<\/b><span>Pull to refresh updates \/api\/quests\/cambium/);
    assert.doesNotMatch(sheet, /Inspect keeps proof, packet, freshness, and system detail behind the main Mission Control flow/);
    assertNoPrimarySceneSheetTelemetry(sheet);
    assert.doesNotMatch(sheet, /view<\/b>|target<\/b>|source<\/b>/);
    assert.doesNotMatch(sheet, /tg-miniapp-scenes@v1|product-branches|operator-narrative|cambium-worker/);
    assert.doesNotMatch(sheet, /scene provenance|ecosystem target|local operator writes/);
  }
});

test('page · scene badge keeps canonical ecosystem target dataset values', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const badge = rendered.elements.get('sceneBadge')!;

  for (const [index, section] of MINI_APP_SECTIONS.entries()) {
    (rendered.context.go as (index: number) => void)(index);
    assert.equal(badge.textContent?.toLowerCase(), section.scene);
    assert.equal(badge.dataset.ecosystemTarget, section.target);
    assert.ok(MINI_APP_ECOSYSTEM_TARGETS.includes(section.target), `target ${section.target} is canonical`);
  }
});

test('page · scene badge Inspect behavior survives display label rename', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  vm.runInContext("SCENE_META[4].label = 'Proof Detail';", rendered.context as vm.Context);
  (rendered.context.go as (index: number) => void)(4);
  const badge = rendered.elements.get('sceneBadge')!;
  assert.equal(badge.textContent, 'Proof Detail');
  (badge.onclick as () => void)();
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /view details · inspect/);
  assert.match(sheet, /reduced motion proof<\/b><span data-reduced-motion-proof="1"/);
  assert.doesNotMatch(sheet, /mission control · proof detail/);
});

test('page · Inspect scene badge opens proof detail metadata sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.go as (index: number) => void)(4);
  const badge = rendered.elements.get('sceneBadge')!;
  assert.equal(badge.textContent, 'Inspect');
  (badge.onclick as () => void)();
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /view details · inspect/);
  assert.match(sheet, /Inspect keeps proof, packet, freshness, and system detail behind the main Mission Control flow/);
  assert.match(sheet, /view<\/b><span>tg-miniapp-scenes@v1/);
  assert.match(sheet, /target<\/b><span>cambium-worker/);
  assert.match(sheet, /refresh<\/b><span>Pull to refresh updates \/api\/quests\/cambium/);
  assert.match(sheet, /reduced motion proof<\/b><span data-reduced-motion-proof="1"/);
  assert.doesNotMatch(sheet, /scene provenance|ecosystem target|local operator writes/);
});

test('page · scene and refresh provenance follow the active tenant', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search: '?tenant=acme' });
  assert.equal(rendered.elements.get('ten')!.textContent, 'acme');
  assert.equal(rendered.elements.get('ptr')!.dataset.refreshRoute, '/api/quests/acme');
  assert.match(rendered.elements.get('ptrProof')!.textContent, /\/api\/quests\/acme/);
  assert.deepEqual(rendered.fetchCalls.slice(-1), ['/api/quests/acme']);
  (rendered.elements.get('sceneBadge')!.onclick as () => void)();
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /Pull to refresh updates \/api\/quests\/acme/);
});

test('mini app surface contract · exports current scene ids', () => {
  assert.deepEqual(MINI_APP_SCENE_IDS, ['mission', 'gate', 'tools', 'story', 'inspect']);
});

test('mini app surface contract · maps ecosystem targets', () => {
  for (const target of ['telegram', 'hermes', 'paperclip', 'cambium-worker', 'quine', 'quest-ledger', 'operator-policy', 'operator-skills', 'operator-narrative', 'cortex', 'r3f', 'github', 'skills', 'gtm', 'distribution', 'vault-via-paperclip', 'live-proof', 'product-branches', 'branch-loops', 'action-requests']) {
    assert.ok(MINI_APP_ECOSYSTEM_TARGETS.includes(target as never), `target ${target} is inventoried`);
  }
});

test('mini app surface contract · exports interaction kind ids', () => {
  assert.deepEqual(MINI_APP_INTERACTION_KINDS, ['sheet', 'signed-action', 'chat-command', 'read-only', 'external-proof']);
});

test('mini app surface contract · inventories current page sections', () => {
  assert.deepEqual(MINI_APP_SECTION_IDS, ['mission-control', 'founder-gate', 'operator-toolbelt', 'story-feed', 'inspect']);
});

test('mini app surface contract · inventories operator map subsections', () => {
  assert.deepEqual(MINI_APP_MAP_SUBSECTION_IDS, [
    'tapestry',
    'wake',
    'lanes',
    'stance',
    'policy',
    'decision-context',
    'live-proof',
    'branches',
    'branch-map',
    'branch-arcs',
    'branch-missions',
    'branch-kpis',
    'branch-gates',
    'branch-loops',
    'action-requests',
    'branch-proof',
    'side-quests',
    'coordination',
    'senses',
    'stages',
    'evidence-boxes',
    'skills',
    'companions',
    'rails',
  ]);
  assert.ok(MINI_APP_MAP_SUBSECTIONS.some((section) => section.id === 'branch-loops'));
});

test('mini app surface contract · records section interaction semantics', () => {
  const byId = Object.fromEntries(MINI_APP_SECTIONS.map((section) => [section.id, section]));
  assert.deepEqual(byId['mission-control'], {
    id: 'mission-control',
    scene: 'mission',
    target: 'product-branches',
    interactions: { primary: 'sheet' },
    source: 'product-branch-packets@v1 plus quest-ledger-envelope@v1',
  });
  assert.deepEqual(byId['operator-toolbelt'], {
    id: 'operator-toolbelt',
    scene: 'tools',
    target: 'hermes',
    interactions: {
      primary: 'sheet',
      secondary: ['chat-command', 'read-only'],
      controls: [
        { id: 'live-command-sheet', interaction: 'sheet', source: 'paperclipCommandsData' },
        { id: 'typed-chat-action', interaction: 'chat-command', source: 'curios.self-chat-command' },
        { id: 'command-reference', interaction: 'read-only', source: 'curios.self-command-reference' },
      ],
    },
    source: 'paperclipCommandsData plus curios.self command reference/action surface',
  });
  assert.deepEqual(byId['founder-gate'], {
    id: 'founder-gate',
    scene: 'gate',
    target: 'telegram',
    interactions: {
      primary: 'signed-action',
      controls: [
        { id: 'action-request-gate-row', interaction: 'signed-action', source: 'cambium-action-requests@v1', target: 'action-requests' },
      ],
    },
    source: 'telegram initData plus Worker gate queue plus cambium-action-requests@v1',
  });
  assert.deepEqual(byId['story-feed'], {
    id: 'story-feed',
    scene: 'story',
    target: 'operator-narrative',
    interactions: {
      primary: 'sheet',
      secondary: ['read-only'],
      controls: [
        { id: 'heartbeat-story-beat', interaction: 'sheet', source: 'world.log', target: 'quine' },
        { id: 'paperclip-story-beat', interaction: 'sheet', source: 'paperclipActivityBeats', target: 'paperclip' },
        { id: 'forge-story-beat', interaction: 'sheet', source: 'deviations', target: 'operator-skills' },
        { id: 'noesis-story-beat', interaction: 'sheet', source: 'operator-narrative', target: 'operator-narrative' },
        { id: 'quest-story-fallback', interaction: 'sheet', source: 'quest-ledger', target: 'quest-ledger' },
        { id: 'action-request-story-beat', interaction: 'sheet', source: 'cambium-action-requests@v1', target: 'action-requests' },
      ],
    },
    source: 'served beats, ActionRequests, or complete quest rows',
  });
  assert.deepEqual(byId.inspect, {
    id: 'inspect',
    scene: 'inspect',
    target: 'cambium-worker',
    interactions: {
      primary: 'sheet',
      controls: [
        { id: 'action-request-inspect-detail', interaction: 'sheet', source: 'cambium-action-requests@v1', target: 'action-requests' },
      ],
    },
    source: 'shared/cambium-visual-contract.ts, cambium-action-requests@v1, and served visual envelope proofs',
  });
});

test('mini app surface contract · records map subsection interaction semantics', () => {
  const byId = Object.fromEntries(MINI_APP_MAP_SUBSECTIONS.map((section) => [section.id, section]));
  assert.deepEqual(byId.branches, {
    id: 'branches',
    target: 'product-branches',
    interactions: { primary: 'sheet' },
    source: 'product-branch-packets@v1 branch stories',
  });
  assert.deepEqual(byId['branch-map'], {
    id: 'branch-map',
    target: 'product-branches',
    interactions: { primary: 'read-only' },
    source: 'cambium.goal-graph-branch-map.v1 versioned lineage projection',
  });
  assert.deepEqual(byId['branch-proof'], {
    id: 'branch-proof',
    target: 'product-branches',
    interactions: { primary: 'external-proof' },
    source: 'BranchStoryArc proof foldback',
  });
  assert.deepEqual(byId['action-requests'], {
    id: 'action-requests',
    target: 'action-requests',
    interactions: { primary: 'sheet' },
    source: 'cambium-action-requests@v1 redacted projection',
  });
  assert.deepEqual(byId.skills, {
    id: 'skills',
    target: 'skills',
    interactions: {
      primary: 'sheet',
      controls: [
        { id: 'promote-skill-review', interaction: 'signed-action', source: 'skill promotion review queue', target: 'skills' },
      ],
    },
    source: 'skill-registry visual envelope',
  });
  assert.deepEqual(byId['side-quests']?.interactions, {
    primary: 'sheet',
    controls: [
      { id: 'queue-side-quest', interaction: 'signed-action', source: 'side-quest queue action' },
    ],
  });
  assert.deepEqual(byId.rails?.interactions, { primary: 'sheet' });
});

test('page audit helper · detects inert pseudo-button cards', () => {
  assertNoInertPseudoButtons([
    '<div class="cmd" data-interaction-kind="read-only" data-source="curios.self-chat-command"></div>',
    '<button class="rail hot" data-interaction-kind="sheet" data-source="shared/cambium-visual-contract" data-rail="handoff"></button>',
    '<div class="beat noesis" data-interaction-kind="sheet" data-source="operator-narrative" data-beat="0"></div>',
  ].join(''));
  assert.throws(
    () => assertNoInertPseudoButtons('<div class="cmd"></div><div class="rail"></div><div class="beat"></div>'),
    /missing-kind/,
  );
  assert.throws(
    () => assertNoInertPseudoButtons('<div class="rail" data-interaction-kind="read-only" data-rail="handoff"></div>'),
    /missing-source/,
  );
});

test('page audit helper · real rendered pseudo-button rows declare interaction semantics', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.renderCommands as () => void)();
  (rendered.context.renderStory as (env: unknown) => void)({
    beats: [{ text: 'fixture beat', lane: 'quest' }],
  });
  const inspectProofHtml = rendered.elements.get('mapwrap')!.innerHTML;
  selectInspectPane(rendered, 'system');
  const inspectSystemHtml = rendered.elements.get('mapwrap')!.innerHTML;
  const html = [
    inspectProofHtml,
    inspectSystemHtml,
    rendered.elements.get('beats')!.innerHTML,
    rendered.elements.get('cmds')!.innerHTML,
  ].join('');

  assertNoInertPseudoButtons(html);
  assert.match(html, /class="rail [^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="shared\/cambium-visual-contract")/);
  assert.match(html, /class="beat[^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="mission-story@v1")/);
  // T-019: Tools action surfaces replace the retired act/chat-command and ref/read-only cards.
  // The no-fake-progress fixture serves no commands envelope, so surfaces render stale + read-only.
  assert.match(html, /class="cmd live[^"]*"(?=[^>]*data-interaction-kind="read-only")(?=[^>]*data-source="mission-toolbelt-live@v1")/);
  assert.doesNotMatch(html, /data-interaction-kind="chat-command"|curios\.self-chat-command|curios\.self-command-reference/);
});

test('page · story beats are clickable sheets with ecosystem provenance', async () => {
  const envelope = {
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    beats: [
      { text: 'Heartbeat swept the board', lane: 'heartbeat', source: 'world.log', noesis: false },
      { text: 'Paperclip carried THO-9', lane: 'paperclip', source: 'paperclipActivityBeats', noesis: false },
      { text: 'Forge skill telemetry changed', lane: 'forge', source: 'skill-registry', noesis: false },
      { text: 'The mid-brain woke', lane: 'noesis', source: 'deviations', noesis: true },
      { text: 'Quest evidence landed', lane: 'quest', source: 'quest-ledger', noesis: false },
    ],
  };
  // Pin `now` so the envelope stays fresh and the at-rest row cap keeps all five signal rows.
  const rendered = await renderPageFixtureContext(envelope, { now: '2026-06-22T00:05:00.000Z' });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  const rows = [...storyHtml.matchAll(/<button type="button" class="beat[^"]*"[^>]*>/g)].map((match) => match[0]);

  assert.equal(rows.length, envelope.beats.length);
  for (const group of ['mission-wins', 'new-signals', 'lessons', 'drift']) {
    assert.match(storyHtml, new RegExp(`data-component="StoryGroup"[^>]*data-story-group="${group}"`));
  }
  assert.match(storyHtml, /data-component="StoryBeatCard"/);
  assert.match(storyHtml, /data-component="StoryLatestChangeHero"/);
  assert.match(storyHtml, /data-component="StoryGroupControls"/);
  assert.match(storyHtml, /data-component="StoryBranchFilterChips"/);
  assert.match(storyHtml, /data-component="StoryDigestCards"/);
  assert.match(storyHtml, /data-component="StoryTimelineRail"/);
  // T-022: PacketFlow rails sit between the signal rows; dots live on the rails, never inside rows.
  assert.match(storyHtml, /data-component="StoryPacketRail"/);
  assert.match(storyHtml, /data-component="SignalRail"/);
  assert.match(storyHtml, /data-component="PacketFlow"/);
  assert.match(PAGE, /data-story-warning="contradiction"/);
  assert.match(storyHtml, /data-component="MissionGlyph"/);
  assert.match(storyHtml, /data-component="StateToken"/);
  assert.doesNotMatch(storyHtml, /quest-ledger|paperclipActivityBeats|deviations/);
  assertNoStoryPrimaryCopyLeak(storyHtml);
  const beatIndexes = rows.map((row) => row.match(/data-beat="(\d+)"/)?.[1]).sort();
  assert.deepEqual(beatIndexes, ['0', '1', '2', '3', '4']);
  for (const row of rows) {
    assert.match(row, /data-interaction-kind="sheet"/);
  }
  for (const lane of ['heartbeat', 'paperclip', 'forge', 'noesis', 'quest']) {
    assert.match(storyHtml, new RegExp(`data-lane="${lane}"(?=[^>]*data-ecosystem-target="operator-narrative")`));
  }

  (rendered.context.openStoryBeat as (index: number) => void)(3);
  const noesisSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(noesisSheet, /story beat · drift/);
  // T-021/frozen-06 S5: the sheet keeps the full beat text + a state token; the kv wall is gone.
  assert.match(noesisSheet, /The mid-brain woke/);
  assert.match(noesisSheet, /data-component="StateToken" data-state="stale"/);
  assert.match(noesisSheet, /refresh first/);
  assert.match(noesisSheet, /Open Proof/);
  assert.doesNotMatch(noesisSheet, /<div class="kv">/);
  assert.doesNotMatch(noesisSheet, /source summary|ecosystem target|context link|action<\/b>|Inspect source rows|Review source detail/);
  assert.doesNotMatch(noesisSheet, /data-kind="approve"|data-kind="reroll"|data-promote-skill|data-queue-side-quest/);

  (rendered.context.openStoryDigest as () => void)();
  const digestSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(digestSheet, /Story Digest/);
  assert.match(digestSheet, /data-story-digest-beat="0"/);

  (rendered.context.openStoryBeat as (index: number) => void)(1);
  const paperclipSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(paperclipSheet, /Paperclip carried THO-9/);
  assert.match(paperclipSheet, /paperclip activity stays read-only/);
  assert.doesNotMatch(paperclipSheet, /thoughtseed-vault|direct vault write action|data-kind=/i);
});

test('page · StoryGroup labels follow STORY_GROUPS runtime contract', async () => {
  const rendered = await renderPageFixtureContext({
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    beats: [
      { text: 'Mission win shipped', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
      { text: 'Signal heartbeat received', lane: 'heartbeat', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
      { text: 'Forge lesson captured', lane: 'forge', branchId: 'branch-a', source: 'skill-registry', noesis: false },
      { text: 'Drift contradiction noted', lane: 'noesis', branchId: 'branch-a', source: 'noesis', noesis: true },
    ],
  });
  assert.deepEqual(Array.from(vm.runInContext('STORY_GROUPS', rendered.context as vm.Context) as string[]), ['Mission wins', 'New signals', 'Lessons', 'Drift']);
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  for (const group of ['Mission wins', 'New signals', 'Lessons', 'Drift']) {
    // T-021: chip count renders as a mono count span (BranchArcChip canon), no separator word.
    assert.match(storyHtml, new RegExp(`data-story-filter="${group}">${group} <span class="mc-branch-count">1</span>`));
    assert.match(storyHtml, new RegExp(`<div class="cmdgrp">${group}</div>`));
  }
});

test('page · Story semantics handle ambiguous copy, signal proof, and explicit routing', async () => {
  const rendered = await renderPageFixtureContext({
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    beats: [
      { text: 'blocked by copy', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
      { text: 'lesson blocked earlier', lane: 'forge', branchId: 'branch-a', source: 'skill-registry', noesis: false },
      { text: 'Signal with receipt', lane: 'heartbeat', branchId: 'branch-a', proof: 'Receipt ready', source: 'world.log', noesis: false },
      { text: 'Gate approval phrasing variant', lane: 'beat', context: 'gate', branchId: 'branch-a', source: 'manual-story', noesis: false },
      { text: 'Use ts-status command phrasing variant', lane: 'beat', context: 'tools', branchId: 'branch-a', source: 'manual-story', noesis: false },
      { text: 'Proof receipt phrasing variant', lane: 'beat', context: 'proof', branchId: 'branch-a', source: 'manual-story', noesis: false },
    ],
  });
  const context = rendered.context as vm.Context;

  assert.equal(vm.runInContext("storyBeatGroup({ text:'blocked by copy', lane:'quest' })", context), 'Drift');
  assert.equal(vm.runInContext("storyBeatGroup({ text:'lesson blocked earlier', lane:'forge' })", context), 'Lessons');
  assert.equal(vm.runInContext("storyBeatState({ text:'Signal with receipt', lane:'heartbeat', proof:'Receipt ready' })", context), 'active');
  assert.equal(vm.runInContext("storyBeatContext('New signals', 'heartbeat', { context:'gate' })", context), 'gate');
  assert.equal(vm.runInContext("storyBeatContext('New signals', 'heartbeat', { context:'tools' })", context), 'tools');
  assert.equal(vm.runInContext("storyBeatContext('New signals', 'heartbeat', { context:'proof' })", context), 'inspect');

  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  assert.match(storyHtml, /data-story-digest-state="blocked"/);
  assertNoStoryPrimaryCopyLeak(storyHtml);

  (rendered.context.openStoryBeat as (index: number) => void)(3);
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /data-story-target="gate"/);
  (rendered.context.openStoryBeat as (index: number) => void)(4);
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /data-story-target="tools"/);
  (rendered.context.openStoryBeat as (index: number) => void)(5);
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /data-story-target="inspect"/);
});

test('page · story filter scopes hero digest and timeline while preserving beat indexes', async () => {
  const envelope = {
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    branchStories: {
      rows: [
        { branchId: 'branch-a', name: 'Branch A' },
        { branchId: 'branch-b', name: 'Branch B', freshness: { state: 'stale', detail: 'old packet' } },
      ],
    },
    beats: [
      { text: 'Branch A shipped intake win', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
      { text: 'Branch B recorded cortex lesson', lane: 'forge', branchId: 'branch-b', source: 'skill-registry', noesis: false },
    ],
  };
  const rendered = await renderPageFixtureContext(envelope);
  const renderedFilter = rendered.elements.get('beats')!.innerHTML.match(/data-story-branch-filter="(branch-b)"/)?.[1] ?? '';
  assert.equal(renderedFilter, 'branch-b');
  assert.doesNotMatch(rendered.elements.get('beats')!.innerHTML, /data-story-branch-filter="unassigned"/);

  const branchBChip = rendered.elements.get('beats')!.querySelectorAll('[data-story-branch-filter]').find((node) => node.dataset.storyBranchFilter === renderedFilter);
  assert.ok(branchBChip);
  assert.equal(branchBChip.dataset.storyBranchState, 'stale');
  assert.match(rendered.elements.get('beats')!.innerHTML, /is-stale" data-component="BranchArcChip" data-story-branch-filter="branch-b" data-story-branch-state="stale"/);
  assert.equal(typeof branchBChip.onclick, 'function');
  vm.runInContext("MISSION_BRANCH_FOCUS = 'branch-a';", rendered.context as vm.Context);
  (branchBChip.onclick as () => void)();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'branch-a');
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  const hero = storyHtml.match(/<button type="button" class="story-hero" data-component="StoryLatestChangeHero"[\s\S]*?<\/button>/)?.[0] ?? '';
  // T-021/frozen-06 S4: the hero carries the teaser, not the full beat text.
  assert.match(hero, /Lesson captured/);
  assert.match(hero, /Review evidence/);
  assert.doesNotMatch(hero, /Branch B recorded cortex lesson/);
  assert.doesNotMatch(hero, /Branch A shipped intake win/);
  assert.match(hero, /data-story-hero="1"/);

  const heroIndex = Number(hero.match(/data-story-hero="(\d+)"/)?.[1] ?? -1);
  (rendered.context.openStoryBeat as (index: number) => void)(heroIndex);
  const heroSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(heroSheet, /Branch B recorded cortex lesson/);
  assert.doesNotMatch(heroSheet, /Branch A shipped intake win/);

  const digest = storyHtml.match(/<button type="button" class="story-hero" data-component="StoryDigestCards"[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(digest, /Mission wins 0/);
  assert.match(digest, /Lessons 1/);
  assert.match(digest, /data-story-digest-state="active"/);
  assert.doesNotMatch(digest, /Mission wins 1/);
  assert.match(storyHtml, /data-story-filter="all">all <span class="mc-branch-count">1<\/span>/);
  assert.match(storyHtml, /data-story-filter="Mission wins">Mission wins <span class="mc-branch-count">0<\/span>/);
  assert.match(storyHtml, /data-story-filter="Lessons">Lessons <span class="mc-branch-count">1<\/span>/);

  const timeline = storyHtml.match(/<div class="story-timeline"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.equal((timeline.match(/<i /g) ?? []).length, 1);

  const beatsElement = rendered.elements.get('beats')!;
  const heroNode = beatsElement.querySelectorAll('[data-story-hero]')[0];
  assert.equal(heroNode.dataset.storyHero, '1');
  assert.equal(typeof heroNode.onclick, 'function');
  (heroNode.onclick as () => void)();
  const clickedHeroSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(clickedHeroSheet, /Branch B recorded cortex lesson/);
  assert.doesNotMatch(clickedHeroSheet, /Branch A shipped intake win/);

  const beatCards = storyHtml.match(/<button type="button" class="[^"]*beat[\s\S]*?<\/button>/g) ?? [];
  assert.equal(beatCards.length, 1);
  assert.match(beatCards[0], /data-component="StoryBeatCard"/);
  assert.match(beatCards[0], /data-beat="1"/);
  // T-021/frozen-06 S2: the signal row carries the evidence teaser, not the full beat text.
  assert.match(beatCards[0], /Lesson captured/);
  assert.match(beatCards[0], /Review evidence/);
  assert.match(beatCards[0], /data-component="StateToken" data-state="active"/);
  assert.doesNotMatch(beatCards[0], /Branch B recorded cortex lesson/);
  assert.doesNotMatch(beatCards[0], /Branch A shipped intake win/);
  const beatNode = beatsElement.querySelectorAll('.beat')[0];
  assert.equal(beatNode.dataset.beat, '1');
  assert.equal(typeof beatNode.onclick, 'function');
  (beatNode.onclick as () => void)();
  const clickedBeatSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(clickedBeatSheet, /Branch B recorded cortex lesson/);
  assert.doesNotMatch(clickedBeatSheet, /Branch A shipped intake win/);

  const digestNode = beatsElement.querySelectorAll('[data-story-digest]')[0];
  assert.equal(digestNode.dataset.storyDigest, '1');
  assert.equal(typeof digestNode.onclick, 'function');
  (digestNode.onclick as () => void)();
  const digestSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(digestSheet, /Branch B recorded cortex lesson/);
  assert.doesNotMatch(digestSheet, /Branch A shipped intake win/);
  assert.match(digestSheet, /data-story-digest-beat="1"/);
  assert.doesNotMatch(digestSheet, /data-story-digest-beat="0"/);
  const digestBeatNode = rendered.elements.get('sheetBody')!.querySelectorAll('[data-story-digest-beat]')[0];
  assert.equal(digestBeatNode.dataset.storyDigestBeat, '1');
  assert.equal(typeof digestBeatNode.onclick, 'function');
  (digestBeatNode.onclick as () => void)();
  const clickedDigestRowSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(clickedDigestRowSheet, /Branch B recorded cortex lesson/);
  assert.doesNotMatch(clickedDigestRowSheet, /Branch A shipped intake win/);
});

test('page · story filter unassigned BranchArcChip shows unassigned beats', async () => {
  const envelope = {
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    branchStories: { rows: [] },
    beats: [
      { text: 'Unassigned signal reached story', lane: 'beat', source: 'manual-story', noesis: false },
      { text: 'Assigned branch should stay hidden', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
    ],
  };
  const rendered = await renderPageFixtureContext(envelope);
  const unassignedFilter = rendered.elements.get('beats')!.innerHTML.match(/data-story-branch-filter="(unassigned)"/)?.[1] ?? '';
  assert.equal(unassignedFilter, 'unassigned');
  assert.doesNotMatch(rendered.elements.get('beats')!.innerHTML, /data-story-branch-filter="missing"/);

  const unassignedChip = rendered.elements.get('beats')!.querySelectorAll('[data-story-branch-filter]').find((node) => node.dataset.storyBranchFilter === unassignedFilter);
  assert.ok(unassignedChip);
  assert.equal(typeof unassignedChip.onclick, 'function');
  (unassignedChip.onclick as () => void)();
  const unassignedChipHtml = rendered.elements.get('beats')!.innerHTML;
  const selectedBranchChips = unassignedChipHtml.match(/<button type="button" class="is-selected mc-selected-halo" data-component="BranchArcChip" data-story-branch-filter="[^"]+"/g) ?? [];
  assert.deepEqual(selectedBranchChips.map((chip) => chip.match(/data-story-branch-filter="([^"]+)"/)?.[1]), ['unassigned']);
  // T-021: rows carry teasers; the full beat text only renders in the digest/beat sheets.
  assert.match(unassignedChipHtml, /New signal/);
  assert.doesNotMatch(unassignedChipHtml, /Unassigned signal reached story/);
  assert.doesNotMatch(unassignedChipHtml, /Assigned branch should stay hidden/);
  assert.match(unassignedChipHtml, /data-story-hero="0"/);
  assert.match(unassignedChipHtml, /data-beat="0"/);
  assert.match(unassignedChipHtml, /data-story-filter="all">all <span class="mc-branch-count">1<\/span>/);
  assert.match(unassignedChipHtml, /New signals 1/);
  assert.doesNotMatch(unassignedChipHtml, /Mission wins 1/);

  const unassignedDigestNode = rendered.elements.get('beats')!.querySelectorAll('[data-story-digest]')[0];
  assert.equal(typeof unassignedDigestNode.onclick, 'function');
  (unassignedDigestNode.onclick as () => void)();
  const unassignedDigestSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(unassignedDigestSheet, /Unassigned signal reached story/);
  assert.doesNotMatch(unassignedDigestSheet, /Assigned branch should stay hidden/);
  assert.match(unassignedDigestSheet, /data-story-digest-beat="0"/);

  vm.runInContext("STORY_BRANCH_FILTER = 'unassigned'; renderStory(ECOSYSTEM_ENV);", rendered.context as vm.Context);
  const unassignedHtml = rendered.elements.get('beats')!.innerHTML;
  assert.match(unassignedHtml, /New signal/);
  assert.doesNotMatch(unassignedHtml, /Unassigned signal reached story/);
  assert.doesNotMatch(unassignedHtml, /Assigned branch should stay hidden/);
  assert.match(unassignedHtml, /data-story-hero="0"/);

  vm.runInContext("STORY_BRANCH_FILTER = 'missing'; renderStory(ECOSYSTEM_ENV);", rendered.context as vm.Context);
  const legacyMissingHtml = rendered.elements.get('beats')!.innerHTML;
  const selectedLegacyChips = legacyMissingHtml.match(/<button type="button" class="is-selected mc-selected-halo" data-component="BranchArcChip" data-story-branch-filter="[^"]+"/g) ?? [];
  assert.deepEqual(selectedLegacyChips.map((chip) => chip.match(/data-story-branch-filter="([^"]+)"/)?.[1]), ['unassigned']);
  assert.match(legacyMissingHtml, /New signal/);

  const assignedOnly = await renderPageFixtureContext({
    ...envelope,
    beats: [{ text: 'Assigned-only story beat', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false }],
  });
  const assignedOnlyHtml = assignedOnly.elements.get('beats')!.innerHTML;
  assert.doesNotMatch(assignedOnlyHtml, /data-story-branch-filter="unassigned"/);
  assert.doesNotMatch(assignedOnlyHtml, /data-story-branch-filter="missing"/);
  vm.runInContext("STORY_BRANCH_FILTER = 'unassigned'; renderStory(ECOSYSTEM_ENV);", assignedOnly.context as vm.Context);
  const staleUnassignedHtml = assignedOnly.elements.get('beats')!.innerHTML;
  assert.match(staleUnassignedHtml, /data-story-branch-filter="all">all branches/);
  assert.match(staleUnassignedHtml, /Mission moved/);
  assert.match(staleUnassignedHtml, /data-story-filter="all">all <span class="mc-branch-count">1<\/span>/);
});

test('page · story filter keeps unassigned chip visible when branches arrive', async () => {
  const branchlessEnvelope = {
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    branchStories: { rows: [] },
    beats: [
      { text: 'Unassigned carry-forward beat', lane: 'quest', source: 'manual-story', noesis: false },
      { text: 'Branched carry-forward beat', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
    ],
  };
  const rendered = await renderPageFixtureContext(branchlessEnvelope);
  const unassignedChip = rendered.elements.get('beats')!.querySelectorAll('[data-story-branch-filter]').find((node) => node.dataset.storyBranchFilter === 'unassigned');
  assert.ok(unassignedChip);
  vm.runInContext("MISSION_BRANCH_FOCUS = 'branch-a';", rendered.context as vm.Context);
  (unassignedChip.onclick as () => void)();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'branch-a');

  const branchedEnvelope = {
    ...branchlessEnvelope,
    branchStories: {
      rows: [{ branchId: 'branch-a', name: 'Branch A' }],
    },
  };
  vm.runInContext(`ECOSYSTEM_ENV = ${JSON.stringify(branchedEnvelope)}; renderStory(ECOSYSTEM_ENV);`, rendered.context as vm.Context);
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  const selectedBranchChips = storyHtml.match(/<button type="button" class="is-selected mc-selected-halo" data-component="BranchArcChip" data-story-branch-filter="[^"]+"/g) ?? [];
  assert.deepEqual(selectedBranchChips.map((chip) => chip.match(/data-story-branch-filter="([^"]+)"/)?.[1]), ['unassigned']);
  assert.match(storyHtml, /data-story-branch-filter="unassigned">unassigned/);
  assert.match(storyHtml, /Branch A/);
  assert.match(storyHtml, /Mission moved/);
  assert.doesNotMatch(storyHtml, /Unassigned carry-forward beat/);
  assert.doesNotMatch(storyHtml, /Branched carry-forward beat/);
  assert.match(storyHtml, /data-story-filter="all">all <span class="mc-branch-count">1<\/span>/);
  assert.match(storyHtml, /data-story-hero="0"/);
  const heroNode = rendered.elements.get('beats')!.querySelectorAll('[data-story-hero]')[0];
  assert.equal(typeof heroNode.onclick, 'function');
  (heroNode.onclick as () => void)();
  const beatSheet = rendered.elements.get('sheetBody')!.innerHTML;
  // T-021/frozen-06 S5: the sheet carries the full text + state token, not the old kv wall.
  assert.match(beatSheet, /Unassigned carry-forward beat/);
  assert.match(beatSheet, /story beat · mission wins/);
  assert.doesNotMatch(beatSheet, /<div class="kv">/);
  const missionTarget = rendered.elements.get('sheetBody')!.querySelectorAll('[data-story-target]').find((node) => node.dataset.storyTarget === 'mission');
  assert.ok(missionTarget);
  assert.equal(missionTarget.dataset.storyBranchContext, '');
  vm.runInContext("MISSION_BRANCH_FOCUS = 'branch-a';", rendered.context as vm.Context);
  (missionTarget.onclick as () => void)();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), '');

  vm.runInContext("STORY_BRANCH_FILTER = 'unassigned'; renderStory(ECOSYSTEM_ENV);", rendered.context as vm.Context);
  const unassignedHtml = rendered.elements.get('beats')!.innerHTML;
  const selectedUnassignedChips = unassignedHtml.match(/<button type="button" class="is-selected mc-selected-halo" data-component="BranchArcChip" data-story-branch-filter="[^"]+"/g) ?? [];
  assert.deepEqual(selectedUnassignedChips.map((chip) => chip.match(/data-story-branch-filter="([^"]+)"/)?.[1]), ['unassigned']);
  assert.match(unassignedHtml, /Mission moved/);
  assert.doesNotMatch(unassignedHtml, /Unassigned carry-forward beat/);
  assert.doesNotMatch(unassignedHtml, /Branched carry-forward beat/);
});

test('page · Story-to-Mission MISSION_BRANCH_FOCUS sync only follows branch-scoped beats', async () => {
  const envelope = {
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    branchStories: {
      rows: [
        { branchId: 'branch-a', name: 'Branch A' },
        { branchId: 'branch-b', name: 'Branch B' },
      ],
    },
    beats: [
      { text: 'Unassigned mission beat', lane: 'quest', source: 'manual-story', noesis: false },
      { text: 'Branch A mission beat', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
    ],
  };
  const rendered = await renderPageFixtureContext(envelope);

  const branchBChip = rendered.elements.get('beats')!.querySelectorAll('[data-story-branch-filter]').find((node) => node.dataset.storyBranchFilter === 'branch-b');
  assert.ok(branchBChip);
  vm.runInContext("MISSION_BRANCH_FOCUS = '';", rendered.context as vm.Context);
  (branchBChip.onclick as () => void)();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), '');

  (rendered.context.openStoryBeat as (index: number) => void)(0);
  const unassignedMissionTarget = rendered.elements.get('sheetBody')!.querySelectorAll('[data-story-target]').find((node) => node.dataset.storyTarget === 'mission');
  assert.ok(unassignedMissionTarget);
  assert.equal(unassignedMissionTarget.dataset.storyBranchContext, '');
  vm.runInContext("MISSION_BRANCH_FOCUS = 'branch-b';", rendered.context as vm.Context);
  (unassignedMissionTarget.onclick as () => void)();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), '');

  (rendered.context.openStoryBeat as (index: number) => void)(1);
  const branchMissionTarget = rendered.elements.get('sheetBody')!.querySelectorAll('[data-story-target]').find((node) => node.dataset.storyTarget === 'mission');
  assert.ok(branchMissionTarget);
  assert.equal(branchMissionTarget.dataset.storyBranchContext, 'branch-a');
  (branchMissionTarget.onclick as () => void)();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'branch-a');
});

test('page · story hero empty branch filter has no beat index', async () => {
  const envelope = {
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    branchStories: {
      rows: [
        { branchId: 'branch-a', name: 'Branch A' },
        { branchId: 'branch-b', name: 'Branch B' },
      ],
    },
    beats: [
      { text: 'Only Branch A has a story beat', lane: 'quest', branchId: 'branch-a', source: 'quest-ledger', noesis: false },
    ],
  };
  const rendered = await renderPageFixtureContext(envelope);
  const branchBFilter = rendered.elements.get('beats')!.innerHTML.match(/data-story-branch-filter="(branch-b)"/)?.[1] ?? '';
  assert.equal(branchBFilter, 'branch-b');

  const branchBChip = rendered.elements.get('beats')!.querySelectorAll('[data-story-branch-filter]').find((node) => node.dataset.storyBranchFilter === branchBFilter);
  assert.ok(branchBChip);
  assert.equal(typeof branchBChip.onclick, 'function');
  (branchBChip.onclick as () => void)();
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  const hero = storyHtml.match(/<button type="button" class="story-hero is-empty" data-component="StoryLatestChangeHero"[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(hero, /No branch story yet/);
  assert.doesNotMatch(hero, /data-story-hero=/);
  assert.doesNotMatch(storyHtml, /Only Branch A has a story beat/);
  assert.equal(rendered.elements.get('beats')!.querySelectorAll('[data-story-hero]').length, 0);

  const digest = storyHtml.match(/<button type="button" class="story-hero" data-component="StoryDigestCards"[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(digest, /Mission wins 0/);
  assert.match(digest, /New signals 0/);
  assert.match(digest, /Lessons 0/);
  assert.match(digest, /Drift 0/);
  const timeline = storyHtml.match(/<div class="story-timeline"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.equal((timeline.match(/<i /g) ?? []).length, 0);

  const emptyDigestNode = rendered.elements.get('beats')!.querySelectorAll('[data-story-digest]')[0];
  assert.equal(typeof emptyDigestNode.onclick, 'function');
  (emptyDigestNode.onclick as () => void)();
  const digestSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(digestSheet, /No story beats served/);
  assert.doesNotMatch(digestSheet, /Only Branch A has a story beat/);
});

test('page · empty story names branch story wait state', async () => {
  const rendered = await renderPageFixtureContext({
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'fixture',
    beats: [],
    ledger: {
      completed: 0,
      total: 1,
      current: null,
      rows: [{ arc: 'I', id: 'q1', title: 'Wait for evidence', status: 'active', evidence: 'not complete yet' }],
    },
  });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;

  assert.match(storyHtml, /No branch story yet/);
  // frozen/06 S8: empty body is the five-word token line, not the old narrative sentence.
  assert.match(storyHtml, /beats land after branch evidence/);
  assert.doesNotMatch(storyHtml, /Wins, signals, lessons, and drift appear here/);
  assert.match(storyHtml, />Open Mission</);
  assert.match(storyHtml, />Open Proof</);
  assert.match(storyHtml, /data-source="mission-story@v1"/);
  assert.match(storyHtml, /data-story-empty-action="mission"/);
  assert.match(storyHtml, /data-story-empty-action="inspect"/);
  assertNoStoryPrimaryCopyLeak(storyHtml);
  assert.doesNotMatch(storyHtml, /class="beat/);
});

test('page · stale Story banner is human copy above filters', async () => {
  const rendered = await renderPageFixtureContext({
    schema: 1,
    tenant: 'cambium',
    derivedAt: '2026-01-01T00:00:00.000Z',
    source: 'fixture',
    ledger: { completed: 0, total: 0, current: null, rows: [] },
    beats: [
      { text: 'Stale branch signal landed', lane: 'heartbeat', branchId: 'branch-a', source: 'world.log', noesis: false },
    ],
  });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;

  assert.match(storyHtml, /data-component="StoryStaleBanner"/);
  // frozen/06 S7: token-led banner — stale token + 'story stale' + 'refresh before deciding'.
  assert.match(storyHtml, /story stale/);
  assert.match(storyHtml, /refresh before deciding/);
  assert.match(storyHtml, /data-component="StateToken" data-state="stale"/);
  assert.doesNotMatch(storyHtml, /Last story check is stale|Refresh before using these beats/);
  assert.ok(storyHtml.indexOf('data-component="StoryStaleBanner"') < storyHtml.indexOf('data-component="StoryGroupControls"'));
  const banner = storyHtml.match(/<section class="mission-stale-notice story-stale-notice"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.doesNotMatch(visibleTextFromHtml(banner), /source|envelope|no fake progress/i);
});

// T-021/T-022 scene-contract fixture (docs/architecture/contracts/scenes/story.json).
const STORY_SCENE_FIXTURE = JSON.parse(
  readFileSync(new URL('./page/scenes/fixtures/story.fixture.json', import.meta.url), 'utf8'),
) as { states: Record<string, { envelope: unknown }> };

test('page · story fixture normal state renders evidence-backed signal rows with PacketFlow rails (T-021/T-022)', async () => {
  const rendered = await renderPageFixtureContext(STORY_SCENE_FIXTURE.states.normal.envelope, { now: '2026-07-24T09:17:00.000Z' });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  // Five evidence-backed beats: 4 served + 1 projected ActionRequest, all inside the at-rest cap.
  const rows = [...storyHtml.matchAll(/<button type="button" class="beat[^"]*"[\s\S]*?<\/button>/g)].map((match) => match[0]);
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.match(row, /data-component="StoryBeatCard"/);
    assert.match(row, /data-component="MissionGlyph"/);
    assert.match(row, /data-component="StateToken"/);
    assert.match(row, /story-teaser-outcome/);
    assert.match(row, /story-teaser-proof/);
    assert.match(row, /data-interaction-kind="sheet"/);
    // T-022: packet dots never ride inside a row's text container.
    assert.doesNotMatch(row, /mc-packet|story-packet-rail/);
  }
  // Glyph-coded groups + canonical frozen/06 §2.3 state-token subtitles.
  assert.match(storyHtml, /data-glyph-kind="proof" data-state="complete"/);
  assert.match(storyHtml, /data-glyph-kind="gate" data-state="stale"/);
  assert.match(storyHtml, /aria-label="state: verified"/);
  assert.match(storyHtml, /aria-label="state: refresh first"/);
  // Evidence-backed teasers derive from served proof/evidence fields — no invented narrative.
  assert.match(storyHtml, /deploy receipt/);
  assert.match(storyHtml, /kpi snapshot/);
  // T-022: a rail connects every consecutive rendered row (5 rows → 4 rails).
  const railCount = (storyHtml.match(/data-component="StoryPacketRail"/g) ?? []).length;
  assert.equal(railCount, rows.length - 1);
  // Dots on rails only: every packet marker in the scene lives inside a rail segment.
  const railSegments = storyHtml.split('<span class="story-packet-rail"').slice(1);
  const scenePackets = (storyHtml.match(/mc-packet/g) ?? []).length;
  const railPackets = railSegments.reduce((count, segment) => count + ((segment.match(/mc-packet/g) ?? []).length), 0);
  assert.ok(scenePackets > 0, 'rails carry packet dots');
  assert.equal(scenePackets, railPackets);
  // frozen/03 rule 6: max one animated focal point — at most one active rail.
  const activeRails = (storyHtml.match(/data-rail-state="active"/g) ?? []).length;
  assert.ok(activeRails <= 1, `at most one active rail, got ${activeRails}`);
  // The harness forces prefers-reduced-motion: rails render static dots (frozen/03 rule 4).
  assert.doesNotMatch(storyHtml, /data-motion=/);
});

test('page · story fixture blocked state codes contradiction as blocked tokens and peach rails (T-021/T-022)', async () => {
  const rendered = await renderPageFixtureContext(STORY_SCENE_FIXTURE.states.blocked.envelope, { now: '2026-07-24T09:17:00.000Z' });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  assert.match(storyHtml, /data-story-warning="contradiction"/);
  assert.match(storyHtml, /data-glyph-kind="gate" data-state="blocked"/);
  assert.match(storyHtml, /data-component="StateToken" data-state="blocked"/);
  assert.match(storyHtml, /aria-label="state: blocked"/);
  // The rail touching blocked beats goes dashed peach with the end marker; it never animates.
  assert.match(storyHtml, /data-rail-state="blocked"/);
  assert.match(storyHtml, /mc-rail-end/);
  assert.doesNotMatch(storyHtml, /data-motion=/);
  assert.match(storyHtml, /data-story-digest-state="blocked"/);
  // frozen/06 S5: contradiction reads as the blocked token + Inspect link, never a prose warning.
  (rendered.context.openStoryBeat as (index: number) => void)(0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /data-component="StateToken" data-state="blocked"/);
  assert.match(sheet, /Open Proof/);
  assert.doesNotMatch(sheet, /<div class="kv">/);
});

test('page · story fixture empty state renders the frozen EMPTY panel (T-021)', async () => {
  const rendered = await renderPageFixtureContext(STORY_SCENE_FIXTURE.states.empty.envelope, { now: '2026-07-24T09:17:00.000Z' });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  assert.match(storyHtml, /data-component="StoryEmptyState"/);
  assert.match(storyHtml, /No branch story yet/);
  assert.match(storyHtml, /beats land after branch evidence/);
  assert.match(storyHtml, />Refresh</);
  assert.match(storyHtml, />Open Mission</);
  assert.match(storyHtml, />Open Proof</);
  assert.doesNotMatch(storyHtml, /class="beat|data-component="StoryPacketRail"/);
});

test('page · story fixture stays inside the 70-word copy budget in every state (frozen/05)', async () => {
  const countWords = (html: string) => visibleTextFromHtml(html).split(/\s+/).filter(Boolean).length;
  for (const state of ['normal', 'blocked', 'empty']) {
    const rendered = await renderPageFixtureContext(STORY_SCENE_FIXTURE.states[state].envelope, { now: '2026-07-24T09:17:00.000Z' });
    const words = countWords(rendered.elements.get('beats')!.innerHTML);
    assert.ok(words <= 70, `story ${state} renders ${words} words at rest (cap 70)`);
  }
  // Stale envelope: the banner lands and the row cap trims first (frozen/06 §4 trim order 1).
  const staleRendered = await renderPageFixtureContext(STORY_SCENE_FIXTURE.states.normal.envelope, { now: '2026-07-24T17:00:00.000Z' });
  const staleHtml = staleRendered.elements.get('beats')!.innerHTML;
  assert.match(staleHtml, /data-component="StoryStaleBanner"/);
  const staleRows = (staleHtml.match(/data-component="StoryBeatCard"/g) ?? []).length;
  assert.ok(staleRows <= 4, `stale envelope trims to <= 4 rows, got ${staleRows}`);
  const staleWords = countWords(staleHtml);
  assert.ok(staleWords <= 70, `story stale renders ${staleWords} words at rest (cap 70)`);
});

test('page audit helper · mini app shell does not expose secret markers', () => {
  assertNoSecretLeak(PAGE);
});

test('page · supports scene deep links for viewport proofs', () => {
  for (const m of ["PARAMS.get('scene')", 'START_SCENE', 'mission:0', 'gate:1', 'tools:2', 'commands:2', 'story:3', 'inspect:4', 'map:4', 'components:4', 'go(START_SCENE, true)']) {
    assert.ok(PAGE.includes(m), `page has scene deep link ${m}`);
  }
});

test('page · interaction layer: sheet, haptics, inspect cards', () => {
  assert.match(PAGE, /class="sheet"/);
  assert.match(PAGE, /HapticFeedback/);
  assert.match(PAGE, /openSheet/);
  assert.match(PAGE, /openMapSheet/);
  assert.match(PAGE, /querySelectorAll\('\.sense'\)\.forEach\(el => el\.onclick = \(\) => openSenseSheet/);
  assert.match(PAGE, /querySelectorAll\('\[data-lane\]'\)\.forEach\(el => el\.onclick = \(\) => openLaneSheet/);
  assert.match(PAGE, /function isInteractiveSceneTarget/);
  assert.match(PAGE, /if \(isInteractiveSceneTarget\(e\.target\)\) return;/);
  assert.match(PAGE, /\.mc-action-row\{position:static;/);
  assert.match(PAGE, /data-component="GateActionRow"/);
  assert.doesNotMatch(PAGE, /\.mc-action-row\{position:sticky/);
  assert.match(PAGE, /data-sense=\|data-lane=/);
  assert.match(PAGE, /renderInspect/);
  assert.match(PAGE, /Inspect/);
  assert.match(PAGE, /stage-card/);
});

test('page · Tools scene ships zero copy-paste command blocks', () => {
  // T-019 / frozen/05 §4.1: no chat syntax, copy buttons, or payload previews survive the redesign.
  assert.doesNotMatch(PAGE, /\/ts-(run|approve|reject|standup|digest|help|agent|project|vault|status|hermes|agents|projects|handoffs)\b/);
  // Banned strings are command-copy specific; Inspect's proof-summary copy (W3) keeps its own clipboard path.
  for (const banned of ['Copy command text', 'data-copy-command', 'chat syntax', 'payload preview', 'Mission effect', 'toolRecentStrip', 'data-tool-recent', 'data-tool-group']) {
    assert.ok(!PAGE.includes(banned), `Tools redesign dropped ${banned}`);
  }
  for (const marker of ['TOOL_SURFACES', "'Org status'", "'Services'", "'Agents'", "'Active work'", "'Handoffs'", 'toolHandoffAct', 'data-signed-action-entrypoint', 'ToolResultToken', 'ToolHandoffActionRow']) {
    assert.ok(PAGE.includes(marker), `Tools scene keeps ${marker}`);
  }
});

test('page · Tools renders live action surfaces with state tokens', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  (rendered.context.renderCommands as () => void)();
  const toolsHtml = rendered.elements.get('cmds')!.innerHTML;

  assert.equal((toolsHtml.match(/data-component="ToolActionCard"/g) || []).length, 5);
  for (const [id, label] of [['status', 'Org status'], ['hermes', 'Services'], ['agents', 'Agents'], ['work', 'Active work'], ['handoffs', 'Handoffs']] as const) {
    assert.match(toolsHtml, new RegExp(`data-tool-surface="${id}"`));
    assert.match(toolsHtml, new RegExp(`<span class="cname">${label}</span>`));
  }
  assert.match(toolsHtml, /data-component="ToolRecommendationPanel"/);
  assert.match(toolsHtml, /data-component="ToolContextChips"/);
  assert.doesNotMatch(toolsHtml, /data-component="ToolRecentStrip"|ToolGroupSegmentedControl/);
  assert.match(toolsHtml, /data-component="MissionGlyph"/);
  assert.match(toolsHtml, /data-component="StateToken"/);
  assert.match(toolsHtml, /data-interaction-kind="sheet"(?=[^>]*data-source="mission-toolbelt-live@v1")/);
  assert.match(toolsHtml, /data-inspect-target="tools"/);
  assertNoPrimaryMetaCopy(toolsHtml);
  assert.doesNotMatch(toolsHtml, /\/ts-|Copy command|data-copy-command|chat syntax|payload preview|paperclipCommandsData|gateway|debug/i);
});

test('page · Tools live surface sheets stay read-only with result tokens', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  const openToolSurfaceSheet = rendered.context.openToolSurfaceSheet as (id: string) => void;

  openToolSurfaceSheet('status');
  let sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /<h2>Org status<\/h2>/);
  assert.match(sheet, /data-component="ToolResultToken"/);
  assert.match(sheet, /3 agents · 2 open/);
  assert.match(sheet, /data-component="ToolSafetyRow"/);
  assert.match(sheet, /read-only · signed decisions stay in Gate/);
  assert.match(sheet, /data-tool-audit-link="tools"/);
  assert.doesNotMatch(sheet, /\/ts-|Copy|chat syntax|payload preview|class="kv|gatekv|data-copy-command/);

  openToolSurfaceSheet('hermes');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /<h2>Services<\/h2>/);
  assert.match(sheet, /2 services/);

  openToolSurfaceSheet('agents');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /<h2>Agents<\/h2>/);
  assert.match(sheet, /2 agents/);

  openToolSurfaceSheet('work');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /<h2>Active work<\/h2>/);
  assert.match(sheet, /1 open/);

  openToolSurfaceSheet('handoffs');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /<h2>Handoffs<\/h2>/);
  assert.match(sheet, /1 waiting/);
  assert.match(sheet, /data-component="ToolHandoffActionRow"/);
  assert.match(sheet, /Approve fresh viewport capture/);
  assert.match(sheet, /data-signed-action-entrypoint="approve"/);
  assert.match(sheet, /data-signed-action-entrypoint="reroll"/);
  assert.doesNotMatch(sheet, /\/ts-|Copy|chat syntax|class="kv|gatekv/);
});

test('page · Tools unavailable surface shows refresh-first token and retry', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.openToolSurfaceSheet as (id: string) => void)('status');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /refresh first/);
  assert.match(sheet, /live data unreachable · pull to refresh/);
  assert.match(sheet, /data-tool-retry="status"/);
  assert.doesNotMatch(sheet, /\/api\/gate|\/ts-|Copy command/);
  assertNoSecretLeak(sheet);
});

test('page · Tools handoffs surface posts signed actions via the gate client', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    fetchResponder: ({ init }) =>
      init.method === 'POST'
        ? { queued: 'gate-queue-1', id: 'HND-7', idempotencyKey: 'approve:cambium:HND-7' }
        : undefined,
  });
  (rendered.context.renderCommands as () => void)();
  (rendered.context.openToolSurfaceSheet as (id: string) => void)('handoffs');

  const approve = rendered.elements.get('sheetBody')!.querySelectorAll('[data-tool-act]').find((node) => node.dataset.toolAct === 'approve');
  assert.ok(approve, 'handoff row carries an in-app approve action');
  (approve.onclick as () => void)();

  const preflight = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(preflight, /gate preflight/);
  assert.match(preflight, /<h2>Approve gate item<\/h2>/);
  assert.match(preflight, /Queues founder approval for HND-7; nothing mutates until an operator consumes the queue\./);
  assert.match(preflight, />until consumed</);
  assert.match(preflight, /data-gate-confirm="approve"/);
  assert.match(preflight, /data-gate-subject="HND-7"/);
  assert.match(preflight, /data-gate-idempotency-key="approve:cambium:HND-7"/);
  assert.doesNotMatch(preflight, /class="kv|gatekv|initData status|\/ts-/);

  rendered.elements.get('sheetBody')!.querySelector('[data-gate-confirm]').click();
  await flushPageAsync();

  const post = rendered.fetchRequests.find((request) => request.method === 'POST' && /\/api\/gate\/cambium/.test(request.url));
  assert.ok(post, 'handoff action POSTs via the gate client in-app');
  const payload = JSON.parse(String(post!.body));
  assert.equal(payload.kind, 'approve');
  assert.equal(payload.subject, 'HND-7');
  assert.equal(payload.initData, TEST_TELEGRAM_INIT_DATA);
  assert.equal(payload.idempotencyKey, 'approve:cambium:HND-7');
  assert.ok(payload.evidence, 'payload carries evidence');
  assert.ok(payload.consequence, 'payload carries consequence');
  assert.ok(payload.reversibility, 'payload carries reversibility');

  // T-020: receipt token + state flip stay visible without leaving the Tools tab.
  const resultSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(resultSheet, /Founder decision queued/);
  assert.match(resultSheet, /data-component="GateReceiptToken"/);
  assert.match(resultSheet, /decision queued · receipt in Inspect/);
  assert.match(resultSheet, /approve:cambium:HND-7/);
  const card = rendered.elements.get('cmds')!.querySelector('[data-tool-surface="handoffs"]');
  assert.match(card.innerHTML, /queued · approve · approve:cambium:HND-7/);
  assertNoSecretLeak(resultSheet);
});

test('page · Tools handoff refusal and network failure keep state honest', async () => {
  const options = (responder: () => unknown) => ({
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    fetchResponder: ({ init }: { init: RequestInit }) =>
      init.method === 'POST' ? responder() : undefined,
  });
  const act = async (rendered: Awaited<ReturnType<typeof renderPageFixtureContext>>) => {
    (rendered.context.renderCommands as () => void)();
    (rendered.context.openToolSurfaceSheet as (id: string) => void)('handoffs');
    const approve = rendered.elements.get('sheetBody')!.querySelectorAll('[data-tool-act]').find((node) => node.dataset.toolAct === 'approve');
    (approve.onclick as () => void)();
    rendered.elements.get('sheetBody')!.querySelector('[data-gate-confirm]').click();
    await flushPageAsync();
  };

  const refusal = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE,
    options(() => ({ error: 'Worker refused with HTTP 409' })) as never);
  await act(refusal);
  assert.match(refusal.elements.get('sheetBody')!.innerHTML, /Decision not queued/);
  assert.match(refusal.elements.get('sheetBody')!.innerHTML, /worker refused · no queue write · proof unchanged/);
  assert.match(refusal.elements.get('cmds')!.querySelector('[data-tool-surface="handoffs"]')!.innerHTML, /refused · no write/);

  const network = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE,
    options(() => new Error('network failure')) as never);
  await act(network);
  assert.match(network.elements.get('sheetBody')!.innerHTML, /Decision not queued/);
  assert.match(network.elements.get('sheetBody')!.innerHTML, /network failure · no write/);
  assert.match(network.elements.get('cmds')!.querySelector('[data-tool-surface="handoffs"]')!.innerHTML, /network failure · no write/);
});

test('page · craft: skeleton, states, reduced motion, no pure black, no emoji icons', () => {
  assert.match(PAGE, /class="skel"/);
  assert.match(PAGE, /ledger unreachable/);
  assert.match(PAGE, /no ledger yet/);
  assert.match(PAGE, /prefers-reduced-motion/);
  assert.ok(!PAGE.includes('#000000'), 'no pure black');
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(PAGE), 'no emoji glyphs');
});

test('page · Mission Control visual primitives are named and reduced-motion safe', () => {
  for (const marker of [
    'data-component="RootNavGlyph"',
    'data-component="MissionGlyph"',
    'data-component="StateToken"',
    'data-component="OrbitProgress"',
    'data-component="SignalRail"',
    'data-component="PacketFlow"',
    'data-component="ComponentGallery"',
    'ComponentGlyphStateBoard',
    'ComponentStateBoard',
    'ComponentOrbitProgressBoard',
    'ComponentMissionComponentsBoard',
    'ComponentMotionPrimitives',
    'ComponentLegend',
    'data-component="GlyphAsset"',
    'data-component="StateAsset"',
    'data-component="OrbitProgressAsset"',
    'data-component="MotionPrimitive"',
    'data-component="LegendAsset"',
    'data-component="BranchArcChip"',
    'data-component="MissionCard"',
    'data-component="QuestlineTimeline"',
	    'data-component="ProofList"',
	    'data-component="KpiPulse"',
	    'data-component="ToolActionCard"',
	    'data-component="StoryGroup"',
	    'data-component="StoryBeatCard"',
	    'data-component="InspectGroupStack"',
	    'data-component="InspectGroup"',
	    'mc-branch-chip',
    'mc-glyph',
    'mc-state-token',
    'mc-orbit',
    'mc-signal-rail',
    'mc-packet-dots',
    'mc-mission-card',
    'mc-proof-list',
    'mc-kpi-bars',
    'mc-action-row',
    'mc-inspect-only',
    'MC_COMPONENT_REGISTRY',
    'MC_GLYPH_SVG',
    'data-glyph-kind',
    'mcStateKind',
    'mcClass',
    'mcGlyphSvg',
    'mcStateToken',
    'mcOrbitProgress',
    'mcSignalRail',
    'mcPacketDots',
    'mcBoardPanel',
    'renderComponentGallery',
    'renderComponentGlyphStateBoard',
    'renderComponentStateBoard',
    'renderComponentOrbitBoard',
    'renderComponentMissionComponentsBoard',
    'renderComponentMotionBoard',
    'renderComponentLegendBoard',
    'orbitSweep',
    'packetDrift',
    'glyphBreathe',
    'warningAttention',
    '.mc-orbit[data-motion="orbitSweep"] .mc-orbit-arc,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}',
  ]) assert.ok(PAGE.includes(marker), `PAGE has ${marker}`);

  for (const key of ['sourceRefs', 'propShapes', 'MissionGlyph', 'StateToken', 'OrbitProgress', 'SelectedHalo', 'SignalRail', 'PacketFlow', 'BranchArcChip', 'MissionCard', 'QuestlineTimeline', 'ProofList', 'KpiPulse', 'GateActionRow', 'Motion']) {
    assert.match(PAGE, new RegExp(`${key}:`), `registry has ${key}`);
  }
  for (const ref of ['component-map.md', '01-component-glyph-state-board.md', '02-mission-control-state-stack-mobile.md', '03-motion-storyboard-mobile.md']) {
    assert.match(PAGE, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `registry source ref ${ref}`);
  }

  const glyphHelper = PAGE.slice(PAGE.indexOf('function mcGlyphSvg'), PAGE.indexOf('function mcStateToken'));
  assert.match(glyphHelper, /MC_GLYPH_SVG\[glyph\]/);
  assert.doesNotMatch(glyphHelper, />[✦⊂△▱◖◌◎○]</);
  assert.doesNotMatch(PAGE, />[✦◇▱◌○]</);
  for (const glyph of ['genesis', 'taste', 'build', 'ops', 'cortex', 'arc', 'proof', 'gate']) {
    assert.match(PAGE, new RegExp(`${glyph}:'<svg viewBox="0 0 32 32"`));
  }
});

test('page · component registry helpers enforce orbit rail packet KPI contracts', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const orbit = rendered.context.mcOrbitProgress as (opts: Record<string, unknown>) => string;
  const rail = rendered.context.mcSignalRail as (opts: Record<string, unknown>) => string;
  const packets = rendered.context.mcPacketDots as (count: number, state: string, opts?: Record<string, unknown>) => string;
  const kpi = rendered.context.mcKpiPulse as (row: Record<string, unknown>, index: number) => string;

  assert.match(orbit({ value: -5, state: 'active' }), /data-value="0"[^>]*--mc-progress:0/);
  assert.match(orbit({ value: 140, state: 'complete' }), /data-value="100"[^>]*--mc-progress:100/);
  assert.match(orbit({ value: 35, state: 'proof-needed', label: 'proof', showPacketDots: true }), /data-state="proof-needed"[\s\S]*data-component="PacketFlow"/);
  assert.match(orbit({ value: 50, state: 'reduced-motion', label: 'RM' }), /data-state="reduced-motion"[\s\S]*>RM<\/span>/);

  assert.match(rail({ state: 'blocked', packetCount: 3 }), /data-component="SignalRail"[^>]*data-state="blocked"[\s\S]*mc-rail-end/);
  assert.equal((packets(99, 'active').match(/class="mc-packet"/g) || []).length, 7);
  assert.equal((packets(0, 'active').match(/class="mc-packet"/g) || []).length, 1);
  assert.match(packets(3, 'blocked', { mode: 'rail' }), /is-blocked[\s\S]*data-packet-mode="rail"/);

  const renderedKpi = kpi({ label: 'Qualified demo', currentState: 'blocked proof', survival: 'merchant demo', betterThanSurvival: 'paid pilot' }, 1);
  assert.match(renderedKpi, /data-component="KpiPulse"[^>]*data-kpi-kind="better-than-survival"/);
  assert.match(renderedKpi, /data-component="OrbitProgress"/);
  assert.match(renderedKpi, /class="mc-kpi-bars" data-component="PacketFlow"/);
  assert.doesNotMatch(renderedKpi, /mc-kpi-pulse/);
});

test('page · frozen T-013/T-014 anatomy: state icons, peach gate, orbit svg, KPI spark bars', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const token = rendered.context.mcStateToken as (state: string, label?: string) => string;
  const glyph = rendered.context.mcGlyphSvg as (kind: string, state: string) => string;
  const orbit = rendered.context.mcOrbitProgress as (opts: Record<string, unknown>) => string;
  const kpi = rendered.context.mcKpiPulse as (row: Record<string, unknown>, index: number) => string;

  // StateToken — every frozen state maps state -> class + icon (never color alone); proof-needed is the pending alias, not a 9th state.
  for (const state of ['idle', 'active', 'selected', 'complete', 'blocked', 'locked', 'stale', 'reduced-motion']) {
    const html = token(state, state);
    assert.match(html, new RegExp(`class="mc-state-token is-${state}"`), `token class for ${state}`);
    assert.match(html, /<i class="mc-token-icon" aria-hidden="true"><svg viewBox="0 0 12 12">/, `token icon for ${state}`);
  }
  assert.match(token('proof needed', 'proof'), /class="mc-state-token is-proof-needed"/);
  assert.match(token('proof-needed'), /stroke-dasharray="3 2\.2"/, 'proof-needed renders the pending dashed-ring icon');
  assert.match(PAGE, /\.mc-state-token\.is-proof-needed\{color:var\(--mc-mint\);border-style:dashed/, 'proof-needed styling is pending dashed mint, not peach');

  // MissionGlyph — all 8 variants render; gate is always peach regardless of state.
  for (const kind of ['genesis', 'taste', 'build', 'ops', 'cortex', 'arc', 'proof', 'gate']) {
    assert.match(glyph(kind, 'active'), new RegExp(`data-glyph-kind="${kind}"`), `glyph variant ${kind}`);
  }
  assert.match(glyph('gate', 'active'), /data-glyph-kind="gate" data-state="active"/);
  assert.match(PAGE, /\.mc-glyph\[data-glyph-kind="gate"\]\{color:var\(--mc-peach\)/, 'gate glyph forced peach');

  // OrbitProgress — dotted track + clockwise arc from 12 o'clock + 4 cardinal nodes; blocked = warning triangle, no fill.
  const mid = orbit({ value: 50, state: 'active', label: '50' });
  assert.match(mid, /<circle class="mc-orbit-track"/);
  assert.match(mid, /<circle class="mc-orbit-arc"[^>]*pathLength="100" style="stroke-dashoffset:50" transform="rotate\(-90 32 32\)"/);
  assert.equal((mid.match(/class="mc-orbit-node"/g) || []).length, 4, 'four cardinal node dots');
  const blockedOrbit = orbit({ value: 36, state: 'blocked', label: 'blocked' });
  assert.match(blockedOrbit, /class="mc-orbit-warning"/, 'blocked orbit carries warning triangle');
  assert.match(blockedOrbit, /stroke-dashoffset:100/, 'blocked orbit renders no fill');
  assert.match(orbit({ value: 18, state: 'stale' }), /stroke-dashoffset:100/, 'stale orbit renders no fill');

  // KpiPulse — dotted-ring badge + 2-line mono label + ~15 spark bars with deterministic varied heights.
  const pulse = kpi({ label: 'Qualified waitlist', currentState: 'signal served', survival: 'waitlist', betterThanSurvival: 'paid pilot' }, 0);
  assert.match(pulse, /data-component="OrbitProgress"/);
  assert.match(pulse, /<b>Survival: Qualified waitlist<\/b><span>signal served · survival: waitlist<\/span>/);
  assert.equal((pulse.match(/class="mc-kpi-bars" data-component="PacketFlow" data-packet-mode="packet-bar"/g) || []).length, 1);
  assert.equal((pulse.match(/--mc-spark-h:/g) || []).length, 15, '15 spark bars');
  const better = kpi({ label: 'Pilot' }, 1);
  assert.match(better, /<b>Better: Pilot<\/b><span>better-than-survival proof pending<\/span>/);

  // Reduced-motion fallback — static canonical states, animations removed.
  assert.match(PAGE, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(PAGE, /\.mc-orbit\.is-reduced-motion \.mc-orbit-track\{stroke:rgba\(214,255,246,\.6\);stroke-dasharray:none/, 'reducedMotion state = full solid thin mint ring');
});

test('page · component route renders the reference glyph state board as components', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const html = rendered.elements.get('mapwrap')!.innerHTML;

  assert.equal(rendered.elements.get('sceneBadge')!.textContent, 'Components');
  assert.equal(rendered.elements.get('sceneBadge')!.dataset.scene, 'components');
  for (const marker of [
    'data-component="ComponentGallery"',
    'data-source="01-component-glyph-state-board.png"',
    'data-component="ComponentGlyphStateBoard"',
    'data-component="ComponentStateBoard"',
    'data-component="ComponentOrbitProgressBoard"',
    'data-component="ComponentMissionComponentsBoard"',
    'data-component="ComponentMotionPrimitives"',
    'data-component="ComponentLegend"',
    'data-glyph-kind="genesis"',
    'data-glyph-kind="taste"',
    'data-glyph-kind="build"',
    'data-glyph-kind="ops"',
    'data-glyph-kind="cortex"',
    'data-glyph-kind="arc"',
    'data-glyph-kind="proof"',
    'data-glyph-kind="gate"',
    'data-state="reduced-motion"',
    'data-motion="orbitSweep"',
    'data-motion="packetDrift"',
    'data-motion="glyphBreathe"',
    'data-motion="warningAttention"',
    'data-motion="reducedMotion"',
    'data-component="BranchArcChip"',
    'data-component="MissionCard"',
    'data-component="QuestlineTimeline"',
    'data-component="ProofList"',
    'data-component="KpiPulse"',
    'data-component="GateActionRow"',
    'data-component="LegendAsset"',
  ]) assert.ok(html.includes(marker), `component board rendered ${marker}`);

  for (const label of ['Glyph State Board', 'Orbit Progress', 'Mission Components', 'Motion Primitives', 'Legend', 'Triangle aperture', 'Curled receipt']) {
    assert.match(html, new RegExp(label, 'i'));
  }
});

test('page · primary flow does not render the hidden component gallery as the app', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        questline: [{ id: 'proof', title: 'Collect proof', status: 'active' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [{ kpiId: 'proof', label: 'Proof', survival: 'viewport proof', currentState: 'pending' }],
        proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'proof-only', currentGate: 'Founder review', rule: 'proof first' },
        gaps: [{ id: 'proof-gap', status: 'blocked', detail: 'Viewport capture missing', source: 'packet' }],
      }],
    },
    beats: [{ text: 'Launch proof packet moved forward', lane: 'quest', source: 'quest-ledger' }],
  });
  const primaryHtml = [
    rendered.elements.get('stem')!.innerHTML,
    rendered.elements.get('mapwrap')!.innerHTML,
    rendered.elements.get('beats')!.innerHTML,
  ].join('');

  assert.doesNotMatch(primaryHtml, /data-component="ComponentGallery"/);
  assert.doesNotMatch(primaryHtml, /Glyph State Board|ComponentGlyphStateBoard|Motion Primitives|ComponentLegend/);
  assert.match(primaryHtml, /data-component="MissionCard"/);
  assert.match(primaryHtml, /data-component="StoryGroup"/);
  assert.match(primaryHtml, /data-component="InspectGroup"/);
});

test('page · shared visual mechanics remain available inside Inspect', () => {
  for (const m of ['const STAGES', 'const RAILS', 'stageForArc', 'proof · packets · freshness · evidence', 'Inspect keeps the low-level proof rows']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
  for (const stage of CAMBIUM_VISUAL_STAGES) {
    assert.match(PAGE, new RegExp(`"id":"${stage.id}"`));
    assert.match(PAGE, new RegExp(`"title":"${stage.title}"`));
  }
  for (const rail of CAMBIUM_VISUAL_RAILS) {
    assert.match(PAGE, new RegExp(`"id":"${rail.id}"`));
  }
});

test('page · Inspect groups proof detail without becoming primary flow', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  const map = rendered.elements.get('mapwrap')!;
  const inspectProofHtml = map.innerHTML;
  selectInspectPane(rendered, 'system');
  const inspectSystemHtml = map.innerHTML;
  const inspectHtml = [inspectProofHtml, inspectSystemHtml].join('\n');

  assert.match(inspectHtml, /data-component="InspectGroupStack"/);
  for (const group of ['freshness', 'live-proof', 'branch-packets', 'gates', 'policy', 'tools', 'rails', 'evidence']) {
    assert.match(inspectHtml, new RegExp(`data-component="InspectGroup"[^>]*data-inspect-group="${group}"`));
  }
  assert.doesNotMatch(inspectHtml.match(/data-component="InspectGroupStack"[\s\S]*?<\/section>/)?.[0] ?? '', /branch-fixtures|surface-contract/);
  assert.match(inspectHtml, /data-component="InspectSecondaryLinks"/);
  assert.match(inspectHtml, /data-component="InspectSecondaryLink"[^>]*data-inspect-group="branch-fixtures"/);
  assert.match(inspectHtml, /data-component="InspectSecondaryLink"[^>]*data-inspect-group="surface-contract"/);
  assert.ok(inspectHtml.indexOf('data-component="InspectProofSummaryAction"') < inspectHtml.indexOf('data-component="InspectGroupStack"'));
  assert.ok(inspectHtml.indexOf('data-component="InspectGroupStack"') < inspectHtml.indexOf('data-component="InspectSecondaryLinks"'));
  assert.ok(inspectHtml.indexOf('data-component="InspectSecondaryLinks"') < inspectHtml.indexOf('<div class="cmdgrp">freshness</div>'));
  assert.ok(inspectHtml.indexOf('<div class="cmdgrp">evidence</div>') < inspectHtml.indexOf('<div class="stagegrid">'));
  assert.match(inspectHtml, /data-inspect-group="freshness"[\s\S]*data-inspect-group="live-proof"[\s\S]*data-inspect-group="branch-packets"[\s\S]*data-inspect-group="gates"[\s\S]*data-inspect-group="policy"/);
  const firstViewportText = visibleTextFromHtml(inspectHtml.slice(0, inspectHtml.indexOf('data-component="InspectSecondaryLinks"')));
  assert.doesNotMatch(firstViewportText, /operator map|R3F|schema|envelope|contract/i);
  assert.match(firstViewportText, /proof · packets · freshness · evidence/i);
  assert.match(firstViewportText, /blockers|no live blockers/i);
  assert.match(inspectHtml, /data-inspect-target="tools"/);
  assert.match(inspectHtml, /data-component="InspectProofSummaryAction"/);
  assert.match(inspectHtml, /data-inspect-summary="1"/);
  assert.match(inspectHtml, /Open proof/);
  assert.match(inspectHtml, /Inspect keeps the low-level proof rows out of Mission, Gate, Tools, and Story/);
  assert.doesNotMatch(inspectHtml.match(/data-component="InspectGroupStack"[\s\S]*data-component="InspectSecondaryLinks"/)?.[0] ?? '', /Envelope|readiness rows|feed Mission/);
  // T-023/frozen-06 §1.6 I2: group details are ≤ 8-word flat declaratives from the canon.
  assert.match(inspectHtml, /proof window fresh · refresh after movement|stale proof window · refresh first/);
  assert.match(inspectHtml, /blockers need proof|no live blockers/);
  assert.match(inspectHtml, /packets trusted|branch state untrusted until packets arrive/);
  assert.match(inspectHtml, /decisions waiting|No founder approval is waiting/);
  assert.match(inspectHtml, /blocked actions explained first/);
  assert.match(inspectHtml, /surfaces live|surfaces stale/);

  const proofSummary = rendered.elements.get('mapwrap')!.querySelectorAll('[data-inspect-summary]')[0];
  assert.ok(proofSummary);
  assert.equal(typeof proofSummary.onclick, 'function');
  (proofSummary.onclick as () => void)();
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /<h2>Proof Summary<\/h2>/);

  (rendered.context.openInspectGroupSheet as (id: string, env: unknown) => void)('tools', FRESH_ECOSYSTEM_VISUAL_FIXTURE);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /inspect · tools/);
  assert.match(sheet, /proof layer<\/b><span>Inspect keeps proof and architecture details behind the main app flow/);
  assert.match(sheet, /related page<\/b><span>Tools -> Inspect/);
  assert.match(sheet, /surface availability<\/b><span>live action surfaces/);
  assert.match(sheet, /safe use<\/b><span>Tools open read-only sheets/);
  assert.match(sheet, /how to use this<\/b><span>Open the primary page/);
  assert.ok(sheet.indexOf('summary</b>') < sheet.indexOf('source</b><span>inspect-proof-layer@v1'));
  assert.doesNotMatch(sheet, /debug layer|back path|trace action/);
  assert.match(sheet, /related page<\/b><span>Tools/);
  assert.match(sheet, /data-inspect-page-link="tools"/);

  (rendered.context.openInspectGroupSheet as (id: string, env: unknown) => void)('surface-contract', FRESH_ECOSYSTEM_VISUAL_FIXTURE);
  const contractSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(contractSheet, /surface contract/);
  assert.match(contractSheet, /scene<\/b><span>Mission · Gate · Tools · Story · Inspect/);
  assert.match(contractSheet, /role<\/b><span>five-scene surface contract/);
  assert.match(contractSheet, /proof link<\/b><span>primary pages route here/);
  assert.match(contractSheet, /status summary<\/b><span>coverage exists/);

  (rendered.context.openInspectSummarySheet as (env: unknown) => void)(FRESH_ECOSYSTEM_VISUAL_FIXTURE);
  const summarySheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(summarySheet, /Proof Summary/);
  assert.match(summarySheet, /summary<\/b><span>Cambium mini app proof summary/);
  assert.match(summarySheet, /blocker names<\/b><span>/);
  assert.match(summarySheet, /redaction rule<\/b><span>no raw initData, bearer token, or secret value/);
  // Clipboard flag (frozen/05 §4.1): no copy affordance — the summary renders as a mono value inline.
  assert.doesNotMatch(summarySheet, /data-copy-proof-summary|Copy proof summary|Copy unavailable/);
});

test('page · visual tapestry layer exposes wake, lanes, stance, policy, decision context, live proof, branch stories, side quests, social, skills, companions, evidence boxes, and gaps', () => {
  for (const m of ['renderTapestryAudit', 'data-tapestry', 'completion definition · ', 'ACTIVE ORGAN', 'R3F CONTRACT', 'wakeSteps', 'wake', 'data-wake', 'wake step · ', 'wake history', 'operator wake events', 'latest snapshot, not a historical trace', 'renderLanes', 'lane · ', 'renderStance', 'tenant stance · ', 'renderPolicy', 'policy', 'POLICY GAP', 'caution ', 'renderDecisionContext', 'decision context', 'decision context · ', 'policy authority', 'renderLiveProof', 'live proof', 'data-live-proof', 'capture plan · not proof', 'proof only after', 'renderBranches', 'branch packets', 'missions', 'KPIs', 'gates', 'proof paths', 'openBranchMissionSheet', 'product-branch-packets@v1', 'product-branches', 'renderSideQuests', 'side quests', 'side quest · ', 'Queue side quest', 'queue-side-quest', 'side quest ledger remains unchanged', 'owner', 'action', 'target', 'lifetime', 'completion', 'trigger', 'proof', 'renderSocial', 'coordination', 'coordination · ', 'SOCIAL GAP', 'tenant-handoff-only', 'renderSenses', 'sense · ', 'senseEnv', 'renderInsightBoxes', 'evidence', 'insightEnv', 'no quest evidence rows served', 'source', 'skill labors', 'tierLabel', 'UNPROVEN', 'recentRate', 'promotion:', 'companions', 'companion · ', 'stage', 'scope', 'advice proof', 'history', 'no relationship events served', 'awaiting signal', 'explicit gap']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
  for (const step of CAMBIUM_WAKE_STEPS) assert.match(PAGE, new RegExp(`"id":"${step.id}"`));
  for (const lane of CAMBIUM_LANES) assert.match(PAGE, new RegExp(`"id":"${lane.id}"`));
  for (const sense of CAMBIUM_SENSES) assert.match(PAGE, new RegExp(`"id":"${sense.id}"`));
});

test('page · visual layer guards stale and partial envelopes', () => {
  for (const m of ['env.wake && Array.isArray', 'env.lanes || {}', 'env.senses || {}', 'env.insights || {}', 'env.stance || {}', 'env.policy || {}', 'env.decisionContext || {}', 'env.liveProof || {}', 'env.branchStories || {}', 'env.sideQuests || {}', 'env.social || {}', 'env.skills || {}', 'env.npc || {}', 'age > 360', 'no freshness']) {
    assert.ok(PAGE.includes(m), `page has partial/stale guard ${m}`);
  }
});

test('page · gate chamber previews consequence, reversibility, evidence, and idempotency', () => {
  for (const m of ['GateChamber', 'GateMissionCard', 'GateStateStack', 'GateOrbitProgress', 'GateActionCard', 'GateEmptyState', 'GateBranchFilterChips', 'GateDecisionStack', 'GateStackRow', 'GateAttentionStrip', 'GatePreflightConsequence', 'gateSource', 'gateOwner', 'gateUpdatedAt', 'gateEvidence', 'gateReversibility', 'gateQueueConsequence', 'renderGateItem', 'renderGateEmpty', 'renderGateFilters', 'isGateAuthFailure', 'gateConsequence', 'gateIdempotency', 'approveConsequence', 'rerollConsequence', 'idempotencyHint', 'idempotencyKey', 'reversible until consumed']) {
    assert.ok(PAGE.includes(m), `page has gate preview ${m}`);
  }
  assert.match(PAGE, /data-signed-action-entrypoint="approve"/);
  assert.match(PAGE, /data-signed-action-entrypoint="reroll"/);
  assert.match(PAGE, /data-signed-action-entrypoint="confirm-action-request"/);
  assert.match(PAGE, /querySelectorAll\('\[data-kind\]'\)/);
  assert.match(PAGE, /openGatePreflight\(kind, gateActionSubject\(kind, item\), node\)/);
});

test('page · empty gate names internal source and no open items', async () => {
  const rendered = await renderPageFixtureContext({ ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, openItems: [] }, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;

  assert.match(gate, /data-gate-state="empty"/);
  assert.match(gate, /no founder decisions waiting/);
  assert.match(gate, /data-gate-empty-nav="mission"/);
  assert.match(gate, /data-gate-empty-nav="inspect"/);
  assert.doesNotMatch(gate, /source route/);
});

test('page · unreachable gate names network failure and no local queue write', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search: '?tenant=cambium&scene=gate', rejectFetch: true });
  const gate = rendered.elements.get('gate')!.innerHTML;

  assert.match(gate, /data-gate-state="unreachable"/);
  assert.match(gate, /network failure/);
  assert.match(gate, /\/internal\/gate\/cambium unreachable/);
  assert.match(gate, /no local queue write/);
});

test('page · gate item cards show decision mission proof and queue-only fields', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    openItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      source: 'Paperclip · paperclip-open-items',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 blocked by launch copy review',
      approveConsequence: 'approve THO-9 for Paperclip execution',
      rerollConsequence: 'reroll THO-9 and request revision before execution',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked:2026-06-22T00:00:00.000Z',
    }],
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;
  (rendered.context.renderGateHeroDecision as (items: unknown[], source: string) => void)(envelope.openItems, 'paperclip-open-items');
  const heroEl = rendered.elements.get('gateHeroDecision')!;
  const hero = heroEl.innerHTML;

  assert.match(PAGE, /id="gateHeroDecision"[^>]*data-component="GateDecisionHeroCard"/);
  assert.equal(heroEl.dataset.gateHeroState, 'proof-needed');
  assert.match(hero, /<b>THO-9<\/b><span>branch not served · Review launch copy/);
  assert.match(gate, /data-component="GateDecisionStack"/);
  assert.match(gate, /data-component="GateStackRow"/);
  assert.match(gate, /class="gate-row-token is-proof-needed" data-component="StateToken" data-state="proof-needed"/);
  assert.match(gate, /<div class="gtitle">Review launch copy<\/div><div class="gsub-line">evidence missing<\/div>/);
  assert.match(gate, /class="gate-row-dot"/);
  assert.match(gate, /class="gate-proof-copy"><b>Proof<\/b><small>THO-9 blocked by launch copy review/);
  assert.match(gate, /signed decisions queue here · proof lives in Inspect/);
  assert.match(gate, /data-component="GateBranchFilterChips"/);
  assert.match(gate, /data-gate-proof="1"/);
  assert.match(gate, /data-risk-state="active"/);
  assert.match(gate, /data-gate-detail="1"/);
  assert.match(gate, /data-interaction-kind="signed-action"/);
  assert.match(gate, />Approve</);
  assert.match(gate, />Reroll</);
  assert.match(gate, />Inspect</);
  assert.doesNotMatch(gate, /Approve safely|Reroll safely|Confirm signed|Proof attached|>Details</);
  assert.doesNotMatch(gate, /GateRowExpansionDetails|gmeta|Approve consequence|Reroll consequence|Reversibility<\/b>/);
  assert.doesNotMatch(gate, /origin ·|Paperclip execution|before execution|executed by the org|source route|initData|\/api\/gate/);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', { dataset: { i: '0', id: 'THO-9' }, style: {} });
  const preflightSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(preflightSheet, /<h2>Approve gate item<\/h2>/);
  assert.match(preflightSheet, /Queues founder approval for THO-9; nothing mutates until an operator consumes the queue\./);
  assert.match(preflightSheet, />until consumed</);
  assert.match(preflightSheet, /data-gate-preflight-inspect="1"/);
  assert.doesNotMatch(preflightSheet, /class="kv|gatekv|initData status|source route|action kind<\/b>/);
});

test('page · iVerif ActionRequest fixture projects into Gate Story and Inspect', async () => {
  const initialEnvelope = cloneJson(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE);
  const refreshedEnvelope = cloneJson(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE);
  refreshedEnvelope.actionRequests.rows[0].selectedOptionId = 'make-branch-task';
  let currentEnvelope: unknown = initialEnvelope;
  const queuedResponse = {
    queued: 'ar_iverif_autogtm_followup_signed',
    duplicate: false,
    idempotencyKey: 'confirm-action-request:cambium:ar_iverif_autogtm_followup_signed:draft-follow-up',
    consequence: 'queue signed Mini App confirmation for Draft follow-up; no external mutation until operator consumes the queue',
    reversibility: 'withheld until signed Mini App confirmation; reversible by choosing another option',
  };
  let rendered: Awaited<ReturnType<typeof renderPageFixtureContext>>;
  const tapStatesAtFetch: Array<{ state: string; text: string }> = [];
  rendered = await renderPageFixtureContext(initialEnvelope, {
    search: '?tenant=cambium&scene=gate',
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    onFetch: ({ url, init }) => {
      if (url !== '/api/gate/cambium' || init.method !== 'POST') return;
      const status = rendered.elements.get('sheetBody')!.querySelector('[data-gate-submit-status]');
      tapStatesAtFetch.push({ state: status.dataset.gateSubmitStatus, text: status.textContent });
    },
    fetchResponder: ({ init }) => init.method === 'POST' ? queuedResponse : currentEnvelope,
  });
  const gate = rendered.elements.get('gate')!.innerHTML;
  const story = rendered.elements.get('beats')!.innerHTML;
  const inspect = rendered.elements.get('mapwrap')!.innerHTML;

  assert.match(gate, /data-action-request-id="ar_iverif_autogtm_followup_signed"/);
  assert.match(gate, /<div class="gtitle">Approval needed: Draft lead follow-up<\/div>/);
  assert.match(gate, /needs_signed_confirmation/);
  assert.match(gate, /data-signed-action-entrypoint="confirm-action-request"/);
  assert.match(gate, /data-kind="confirm-action-request"/);
  assert.match(gate, /data-action-request-selected-option-id="draft-follow-up"/);
  assert.match(gate, />Confirm</);
  assert.doesNotMatch(gate, /Confirm signed|GateRoutePill|GateLatestReceipt|GateReceiptSummary|Clients · topic 804 · message 1068|Needs signed confirmation in the Mini App/);
  assert.match(PAGE, /data-component="GateProgressSummary"[\s\S]*<div class="gauge" id="gauge" data-component="OrbitProgress"><\/div>/);
  const gateHeroMarkup = PAGE.match(/<section class="gate-hero"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.doesNotMatch(gateHeroMarkup, /id="gauge"/);
  assert.match(story, /data-ecosystem-target="action-requests"/);
  // T-021/frozen-06 S2: the ActionRequest beat projects as a teaser row; its full text lives in the digest sheet.
  assert.doesNotMatch(story, /IVerif ActionRequest needs_signed_confirmation/);
  (rendered.context.openStoryDigest as () => void)();
  const storyDigestSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(storyDigestSheet, /IVerif ActionRequest needs_signed_confirmation/);
  assert.match(storyDigestSheet, /data-story-digest-beat=/);
  assert.match(inspect, /data-component="ActionRequestProjectionCard"/);
  assert.match(inspect, /action requests/);
  assert.match(inspect, /ar_iverif_autogtm_make_task/);

  (rendered.context.openActionRequestBox as (env: unknown, index: number) => void)(initialEnvelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /action request · IVerif/);
  assert.match(sheet, /latest receipt<\/b><span>callback · Needs signed confirmation/);
  assert.match(sheet, /redaction<\/b><span>no raw initData, callback nonce, bearer token, or Telegram chat id rendered/);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('confirm-action-request', 'ar_iverif_autogtm_followup_signed', { dataset: { i: '0', id: 'ar_iverif_autogtm_followup_signed' }, style: {} });
  const preflight = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(preflight, /<h2>Confirm action request<\/h2>/);
  assert.match(preflight, /Queues signed confirmation for draft-follow-up; execution waits for operator consumption of the queue\./);
  assert.match(preflight, />until consumed</);
  assert.match(preflight, /data-gate-preflight-inspect="1"/);
  assert.doesNotMatch(preflight, /class="kv|gatekv|action kind<\/b>|selected option<\/b>|channel route<\/b>|latest receipt<\/b>|receipt expectation|source route|initData status|idempotency<\/b>/);
  assert.match(preflight, /data-gate-confirm="confirm-action-request"/);
  assert.match(preflight, /data-gate-subject="ar_iverif_autogtm_followup_signed"/);
  assert.match(preflight, /data-gate-action-request-id="ar_iverif_autogtm_followup_signed"/);
  assert.match(preflight, /data-gate-option-id="draft-follow-up"/);
  assert.match(preflight, /data-gate-idempotency-key="confirm-action-request:cambium:ar_iverif_autogtm_followup_signed:draft-follow-up"/);
  assert.match(preflight, /data-gate-submit-status="idle"/);
  assert.doesNotMatch(preflight, /query_id=|auth_date=|secret-signature|Bearer\s|callbackNonce|telegram chat id/i);
  assert.match(PAGE, /sheetBody\.addEventListener\('click'/);
  assert.doesNotMatch(PAGE, /confirm\.onclick/);

  const confirmButton = rendered.elements.get('sheetBody')!.querySelector('[data-gate-confirm]');
  const submitStatus = rendered.elements.get('sheetBody')!.querySelector('[data-gate-submit-status]');
  const sheetElement = rendered.elements.get('sheet')!;
  const sheetBody = rendered.elements.get('sheetBody')!;
  sheetBody.dispatchEvent({ type: 'pointerdown', pointerId: 7, clientY: 120, timeStamp: 1 });
  assert.equal(sheetElement.setPointerCaptureCalls.length, 1, 'non-interactive sheet background keeps drag capture');
  sheetBody.dispatchEvent({ type: 'pointerup', pointerId: 7, clientY: 120, timeStamp: 2 });
  const captureCount = sheetElement.setPointerCaptureCalls.length;
  confirmButton.dispatchEvent({ type: 'pointerdown', pointerId: 8, clientY: 120, timeStamp: 3 });
  assert.equal(sheetElement.setPointerCaptureCalls.length, captureCount, 'confirm pointerdown is never captured by sheet drag');

  currentEnvelope = refreshedEnvelope;
  (rendered.context.loadGate as () => void)();
  await flushPageAsync();

  const beforeConfirmPosts = rendered.fetchRequests.filter((request) => request.method === 'POST').length;
  confirmButton.click();
  confirmButton.dispatchEvent({ type: 'click', bubbles: true, cancelable: true });
  assert.equal(confirmButton.textContent, 'Queueing...');
  assert.equal((confirmButton as unknown as { disabled: boolean }).disabled, true);
  assert.equal(confirmButton.getAttribute('aria-busy'), 'true');
  assert.equal(confirmButton.dataset.gateSubmitState, 'request-sent');
  assert.equal(submitStatus.dataset.gateSubmitStatus, 'request-sent');
  assert.match(submitStatus.textContent, /sending…/);
  assert.deepEqual(tapStatesAtFetch, [{ state: 'tap-received', text: 'sending…' }]);

  const posts = rendered.fetchRequests.filter((request) => request.method === 'POST');
  assert.equal(posts.length, beforeConfirmPosts + 1);
  assert.equal(posts[0].url, '/api/gate/cambium');
  const payload = JSON.parse(String(posts[0].body));
  assert.equal(payload.kind, 'confirm-action-request');
  assert.equal(payload.subject, 'ar_iverif_autogtm_followup_signed');
  assert.equal(payload.actionRequestId, 'ar_iverif_autogtm_followup_signed');
  assert.equal(payload.optionId, 'draft-follow-up', 'preflight option stays frozen after Gate refresh');
  assert.equal(payload.idempotencyKey, 'confirm-action-request:cambium:ar_iverif_autogtm_followup_signed:draft-follow-up');
  assert.equal(payload.initData, TEST_TELEGRAM_INIT_DATA);

  await flushPageAsync();
  const resultSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(resultSheet, /ActionRequest confirmation queued/);
  assert.match(resultSheet, /decision queued · receipt in Inspect/);
  assert.doesNotMatch(resultSheet, /receipt expectation|channel route<\/b>/i);
  assert.match(resultSheet, /gatekv/);
  assert.match(resultSheet, /idempotency<\/b><span>confirm-action-request:cambium:ar_iverif_autogtm_followup_signed:draft-follow-up/);
  assert.match(resultSheet, /data-gate-result-refresh="1"/);
  assert.match(resultSheet, /class="gbtns gate-result-actions"/);
  assert.match(resultSheet, /data-gate-result-nav="mission"/);
  assert.match(resultSheet, /data-gate-result-nav="inspect"/);

  const refresh = rendered.elements.get('sheetBody')!.querySelector('[data-gate-result-refresh]');
  const beforeRefreshFetches = rendered.fetchRequests.length;
  refresh.click();
  assert.equal(refresh.textContent, 'Refreshing...');
  assert.equal(rendered.fetchRequests.length, beforeRefreshFetches + 1);
});

test('page · production ActionRequest projection renders message choice receipt and state-valid controls', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    now: () => '2026-07-10T11:35:41.833Z',
  };
  const created = await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      ...iverifActionRequest(),
      id: 'ar_iverif_w6_live_mrcwmcs3',
      idempotencyKey: 'action-request:iverif-w6-live-mrcwmcs3',
      status: 'queued',
      selectedOptionId: 'draft-follow-up',
      topic: {
        ...iverifActionRequest().topic,
        sourceMessageId: '1068',
      },
      receipts: [{
        at: '2026-07-10T11:35:41.833Z',
        kind: 'gate',
        text: 'Signed confirmation queued: Draft follow-up.',
      }],
    }),
  }), deps);
  assert.equal(created.status, 200);

  const listed = await handle(req('GET', '/v1/bridge/action-requests?tenantId=cambium&status=queued', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(listed.status, 200);
  const actionRequests = body(listed);
  assert.equal(actionRequests.rows[0].topic.sourceMessageId, '1068');
  assert.equal('telegram' in actionRequests.rows[0], false, 'public projection has no fixture-only telegram enrichment');
  assert.equal('receiptExpectation' in actionRequests.rows[0], false, 'public projection has no fixture-only receipt copy');

  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    actionRequests,
  }, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;
  const card = gate;

  assert.match(card, /data-component="GateQueuedState"/);
  assert.match(card, /<b>Queued<\/b><small>awaits operator<\/small>/);
  assert.match(card, /class="gate-proof-copy"><b>Proof<\/b>/);
  assert.doesNotMatch(card, /GateRoutePill|GateLatestReceipt|Selected option<\/b>|Latest receipt<\/b>|Clients · topic 804 · message 1068/);
  assert.doesNotMatch(card, /data-signed-action-entrypoint="confirm-action-request"/);
  assert.doesNotMatch(card, /query_id=|auth_date=|tgWebAppData|callbackNonce|Bearer\s|secret-signature/i);
});

test('page · queued ActionRequest renders proof and status without another mutation path', async () => {
  const envelope = cloneJson(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE) as any;
  const queued = envelope.actionRequests.rows.find((row: { status?: string }) => row.status === 'queued');
  assert.ok(queued, 'visual fixture has a queued ActionRequest');
  envelope.actionRequests.rows = [queued];
  envelope.actionRequests.actionRequests = [queued];
  envelope.actionRequests.count = 1;

  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;

  assert.match(gate, /data-action-request-status="queued"/);
  assert.match(gate, /data-component="GateQueuedState" data-state="queued"/);
  assert.match(gate, /<b>Queued<\/b><small>awaits operator<\/small>/);
  assert.match(gate, /<button type="button" class="gate-proof-row"[^>]*data-gate-proof="1"/);
  assert.match(gate, /class="gate-proof-copy"><b>Proof<\/b><small>low-risk founder callback queued a branch task and produced a receipt<\/small>/);
  assert.match(gate, /data-glyph-kind="proof"/);
  assert.match(gate, /class="gate-proof-open"/);
  assert.match(gate, /data-gate-detail="1"/);
  assert.doesNotMatch(gate, /Queued consequence|Execution boundary|<b>Sync<\/b>|gate detail · proof/);
  assert.equal((gate.match(/low-risk founder callback queued a branch task and produced a receipt/g) ?? []).length, 1, 'compact card renders one clamped proof preview');
  assert.doesNotMatch(gate, /Approve safely|Reroll safely|data-signed-action-entrypoint=|data-kind="/);
  assert.doesNotMatch(gate, /data-component="OrbitProgress"[^>]*>[\s\S]*?Proof/);
  assert.doesNotMatch(gate, /query_id=|auth_date=|tgWebAppData|callbackNonce|Bearer\s|secret-hash|secret-signature/i);
  /* no second mutation path: the proof row and Inspect button navigate to Inspect (go(4)); no detail sheet. */
  assert.match(PAGE, /node\.querySelectorAll\('\[data-gate-proof\]'\)\.forEach\(proof => proof\.onclick = \(\) => go\(4\)\)/);
  assert.match(PAGE, /node\.querySelectorAll\('\[data-gate-detail\]'\)\.forEach\(detail => detail\.onclick = \(\) => go\(4\)\)/);
});

test('page · iVerif ActionRequest projection does not render raw Telegram secrets', async () => {
  const rendered = await renderPageFixtureContext(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE, { search: '?tenant=cambium&scene=gate' });
  (rendered.context.openActionRequestBox as (env: unknown, index: number) => void)(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE, 0);
  const combined = [
    rendered.elements.get('gate')!.innerHTML,
    rendered.elements.get('beats')!.innerHTML,
    rendered.elements.get('mapwrap')!.innerHTML,
    rendered.elements.get('sheetBody')!.innerHTML,
  ].join('\n');

  assert.doesNotMatch(combined, /-1002691202808/);
  assert.doesNotMatch(combined, /query_id=|auth_date=|tgWebAppData|callbackNonce|telegramMessageId|Bearer\s+[A-Za-z0-9._-]{12,}|secret-hash|secret-signature/i);
  assert.match(combined, /redaction/);
});

test('page · gate consequence sanitizer rewrites direct Paperclip mutation wording', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    openItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      source: 'Paperclip · paperclip-open-items',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 blocked by launch copy review',
      consequence: 'queue founder decision changes Paperclip handling for THO-9; no org mutation until operator consumes queue',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked',
    }],
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;
  const node = { dataset: { i: '0', id: 'THO-9' }, style: {} };

  assert.doesNotMatch(gate, /changes Paperclip handling/);
  assert.doesNotMatch(gate, /queue founder decision changes/);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', node);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /data-gate-consequence="queue founder approval for THO-9; no Paperclip\/org mutation until the operator consumes the queue"/);
  assert.match(sheet, /Queues founder approval for THO-9; nothing mutates until an operator consumes the queue\./);
  assert.doesNotMatch(sheet, /changes Paperclip handling/);
  assert.doesNotMatch(sheet, /queue founder decision changes/);
});

test('page · approve and reroll gate preflight sheets do not POST before confirmation', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    openItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      source: 'Paperclip · paperclip-open-items',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 blocked by launch copy review',
      consequence: 'queue founder decision for THO-9',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked',
    }],
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=gate' });
  const fetchCount = rendered.fetchCalls.length;
  const node = { dataset: { i: '0', id: 'THO-9' }, style: {} };

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', node);
  const approveSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(approveSheet, /gate preflight/);
  assert.match(approveSheet, /<h2>Approve gate item<\/h2>/);
  assert.match(approveSheet, /Queues founder approval for THO-9; nothing mutates until an operator consumes the queue\./);
  assert.match(approveSheet, />until consumed</);
  assert.equal((approveSheet.match(/data-gate-preflight-inspect/g) || []).length, 1);
  assert.doesNotMatch(approveSheet, /class="kv|gatekv|initData status|source route|action kind<\/b>/);
  assert.match(approveSheet, /data-gate-confirm="approve"/);
  assert.match(approveSheet, /data-gate-idempotency-key="approve:cambium:THO-9:blocked"/);
  assert.equal(rendered.fetchCalls.length, fetchCount);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('reroll', 'THO-9', node);
  const rerollSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(rerollSheet, /<h2>Reroll gate item<\/h2>/);
  assert.match(rerollSheet, /Queues a reroll request for THO-9; current work stays unchanged until operator consumption\./);
  assert.match(rerollSheet, /data-gate-confirm="reroll"/);
  assert.match(rerollSheet, /data-gate-idempotency-key="reroll:cambium:THO-9:blocked"/);
  assert.equal(rendered.fetchCalls.length, fetchCount);
  rendered.elements.get('sheetBody')!.querySelector('[data-gate-cancel]').click();
  assert.equal(rendered.elements.get('sheet')!.classList.has('on'), false);
});

test('page · Gate warning attention rests after one pass', () => {
  // frozen/03: warningAttention = persistent peach stroke, runs exactly once, never pulses/loops.
  assert.match(PAGE, /warningAttention \.9s var\(--ease\) 1 both/);
  assert.doesNotMatch(PAGE, /warningAttention [^}]*infinite/);
});

test('page · gate auth and duplicate results open explicit sheets', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);

  (rendered.context.openGateTelegramAuthFailure as (error: string) => void)('missing initData (the gate opens inside Telegram)');
  const authSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(authSheet, /Telegram auth/);
  assert.match(authSheet, /Open inside Telegram/);
  assert.match(authSheet, /signed actions run inside Telegram with founder auth/);
  assert.doesNotMatch(authSheet, /queue write<\/b>/);

  (rendered.context.openGateResultSheet as (kind: string, subject: string, res: unknown, fallback: unknown) => void)('approve', 'THO-9', {
    queued: 'fixed-uuid',
    duplicate: true,
    idempotencyKey: 'approve:cambium:THO-9',
    consequence: 'queue founder approval for THO-9',
    reversibility: 'queued action can be superseded until consumed',
  }, { idempotencyKey: 'approve:cambium:THO-9', consequence: 'fallback', reversibility: 'fallback' });
  const duplicateSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(duplicateSheet, /Original queued action reused/);
  assert.match(duplicateSheet, /decision queued · original reused/);
  assert.match(duplicateSheet, /data-gate-result-nav="mission"/);
  assert.match(duplicateSheet, /data-gate-result-nav="inspect"/);
  assert.match(duplicateSheet, /queued action<\/b><span>fixed-uuid/);
  assert.match(duplicateSheet, /idempotency<\/b><span>approve:cambium:THO-9/);
});

test('page · signed gate auth failures from Worker open Telegram sheet', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    openItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      source: 'Paperclip · paperclip-open-items',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 blocked by launch copy review',
      consequence: 'queue founder decision for THO-9; no Paperclip mutation until consumed',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked',
    }],
  };
  const rendered = await renderPageFixtureContext(envelope, {
    search: '?tenant=cambium&scene=gate',
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    fetchResponder: ({ init }) => init.method === 'POST' ? { error: 'stale auth_date' } : envelope,
  });
  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', { dataset: { i: '0', id: 'THO-9' }, style: {} });
  rendered.elements.get('sheetBody')!.querySelector('[data-gate-confirm]').click();
  await flushPageAsync();

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Telegram auth/);
  assert.match(sheet, /founder auth/);
  assert.equal(rendered.fetchRequests.filter((request) => request.method === 'POST').length, 1);
});

test('page · delegated signed gate renders refused and network error sheets', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    openItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      source: 'Paperclip · paperclip-open-items',
      owner: 'Mathis',
      updatedAt: '2026-06-22T00:00:00.000Z',
      evidence: 'THO-9 blocked by launch copy review',
      consequence: 'queue founder decision for THO-9; no Paperclip mutation until consumed',
      reversibility: 'queued action can be superseded until consumed',
      idempotencyHint: 'THO-9:blocked',
    }],
  };
  const refusal = await renderPageFixtureContext(envelope, {
    search: '?tenant=cambium&scene=gate',
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    fetchResponder: ({ init }) => init.method === 'POST' ? { error: 'ActionRequest status proposed cannot be signed-confirmed' } : envelope,
  });
  (refusal.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', { dataset: { i: '0', id: 'THO-9' }, style: {} });
  refusal.elements.get('sheetBody')!.querySelector('[data-gate-confirm]').click();
  await flushPageAsync();
  const refusalSheet = refusal.elements.get('sheetBody')!.innerHTML;
  assert.match(refusalSheet, /Decision not queued/);
  assert.match(refusalSheet, /worker refused · no queue write · proof unchanged/);

  const network = await renderPageFixtureContext(envelope, {
    search: '?tenant=cambium&scene=gate',
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    fetchResponder: ({ init }) => init.method === 'POST' ? new Error('fixture gate network failure') : envelope,
  });
  (network.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', { dataset: { i: '0', id: 'THO-9' }, style: {} });
  network.elements.get('sheetBody')!.querySelector('[data-gate-confirm]').click();
  await flushPageAsync();
  const networkSheet = network.elements.get('sheetBody')!.innerHTML;
  assert.match(networkSheet, /Decision not queued/);
  assert.match(networkSheet, /network failure · no write/);
});

test('page · no-fake-progress visual fixture renders explicit gaps', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const inspectProofHtml = rendered.elements.get('mapwrap')!.innerHTML;
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = [inspectProofHtml, elements.get('mapwrap')!.innerHTML].join('\n');
  const stem = elements.get('stem')!.innerHTML;
  const progress = elements.get('progress')!.textContent;
  assert.match(stem, /Mission control is waiting for branch packets/);
  assert.match(stem, /branch packets have not reached this device/);
  assert.doesNotMatch(stem, /mc-mission-card/);
  assert.match(progress, /branch packets waiting/);
  assert.match(map, /Inspect/);
  assert.match(map, /proof · packets · freshness · evidence/);
  assert.match(map, /ACTIVE ORGAN/);
  assert.match(map, /GENESIS · I/);
  assert.match(map, /WAKE HEALTH/);
  assert.match(map, /0\/6 wake steps proved/);
  assert.match(map, /QUEST FRONTIER/);
  assert.match(map, /EVIDENCE BOXES/);
  assert.match(map, /SKILL MASTERY/);
  assert.match(map, /FOUNDER STANCE/);
  assert.match(map, /MIRA RELATIONSHIP/);
  assert.match(map, /GATE CONSEQUENCES/);
  assert.match(map, /COMMAND STATE/);
  assert.match(map, /MEMORY SENSE/);
  assert.match(map, /DECISION CONTEXT/);
  assert.match(map, /LIVE PROOF/);
  assert.match(map, /2\/8 readiness checks blocked/);
  assert.match(map, /R3F CONTRACT/);
  assert.match(map, /FRESHNESS GAPS/);
  assert.match(map, /lane telemetry missing from world\.log/);
  assert.match(map, /missing source/);
  assert.match(map, /no cortex rows/);
  assert.match(map, /16 quest risk traces/);
  assert.match(map, /ledger stale beyond 360m/);
  assert.match(map, /need 6 tenant events; found 0/);
  assert.match(map, /recommendation policy blocked/);
  assert.doesNotMatch(map, /NEXT ACTION/);
  assert.match(map, /skill registry missing/);
  assert.match(map, /npc relationship state not served yet/);
  assert.match(map, /MISSING/);
  assert.match(map, /WAKE PROOF/);
  assert.match(map, /STANCE SAMPLE/);
  assert.match(map, /SKILL REGISTRY/);
  assert.match(map, /POLICY UNBLOCK/);
  assert.match(map, /MIRA EVIDENCE/);
  assert.match(map, /SOCIAL GAP/);
  assert.match(map, /no tenant-scoped bridge or handoff evidence served/);
  assert.match(map, /FOUNDER PREFERENCE/);
  assert.match(map, /OWNER LOAD/);
  assert.match(map, /ECONOMIC RISK/);
  assert.match(map, /TEAM AVAILABILITY/);
  assert.match(map, /MEMBER REVOCATION/);
  assert.match(map, /CROSS-TENANT URGENCY/);
  assert.match(map, /live proof/);
  assert.match(map, /IN-APP SIGNED RECEIPT/);
  assert.match(map, /1\/2 prerequisites blocked/);
  assert.match(map, /WORKER LIST PROOF/);
  assert.match(map, /worker-network-probe\.json is stale or not trusted/);
  assert.doesNotMatch(map, /DEVICE WEBVIEW PROOF|SIGNED ACTION SMOKE/);
  assert.match(map, /first session unplayed/);
  assert.equal(elements.get('fresh')!.classList.has('stale'), true);
  assert.doesNotMatch(map, /100% success|founder affinity|relationship level|recommended next|live proof ready|verified founder device|reward unlocked|level up|leaderboard|social proof/i);
});

const MISSION_SCENE_BRANCH_ENVELOPE = {
  ledger: { completed: 9, total: 17, rows: [] },
  branchStories: {
    source: 'product-branch-packets@v1',
    rows: [{
      branchId: 'fitcheck',
      name: 'Fitcheck',
      arcTitle: 'Arc IV',
      missions: [{ missionId: 'm-1', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Hermes' }],
      gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
    }],
  },
};

test('page · mission progress summary carries the ledger count and opens the branch sheet', async () => {
  const envelope = { ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, ...MISSION_SCENE_BRANCH_ENVELOPE };
  const rendered = await renderPageFixtureContext(envelope);
  const progress = rendered.elements.get('progress')!;

  assert.equal(progress.textContent, '9/17 quests');
  assert.equal(progress.dataset.interactionKind, 'sheet');
  assert.equal(progress.dataset.source, 'product-branch-packets@v1');
  (progress.onclick as () => void)();

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /data-component="BranchMissionSheet"/);
  assert.match(sheet, /branch mission · fitcheck/);
});

test('page · mission frontier chip names the branch arc (M4)', async () => {
  const envelope = { ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, ...MISSION_SCENE_BRANCH_ENVELOPE };
  const rendered = await renderPageFixtureContext(envelope);
  const here = rendered.elements.get('here')!;

  assert.equal(here.textContent, 'frontier · Arc IV');
  assert.equal(here.dataset.interactionKind, 'sheet');
  assert.equal(here.dataset.source, 'product-branch-packets@v1');
  (here.onclick as () => void)();

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /data-component="BranchMissionSheet"/);
});

test('page · mission scene keeps ecosystem provenance on its actions', async () => {
  const envelope = { ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, ...MISSION_SCENE_BRANCH_ENVELOPE };
  const rendered = await renderPageFixtureContext(envelope);
  const stem = rendered.elements.get('stem')!.innerHTML;

  assert.match(stem, /data-ecosystem-target="product-branches"/);
  assert.match(stem, /data-source="product-branch-packets@v1"/);
  assert.match(stem, /data-interaction-kind="sheet"/);
  assert.doesNotMatch(stem, /class="q /);
});

test('page · empty ledger state shows push command without quest rows', async () => {
  const rendered = await renderPageFixtureContext({ schema: 1, tenant: 'cambium' });
  const stem = rendered.elements.get('stem')!.innerHTML;

  assert.match(stem, /no ledger yet/);
  assert.match(stem, /quine write quests push --tenant cambium/);
  assert.match(stem, /No quest rows are rendered until a real ledger arrives/);
  assert.doesNotMatch(stem, /class="q /);
});

test('page · empty ledger refresh clears stale quest summary handlers', async () => {
  const activeMissionFixture = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        missions: [{ title: 'Launch proof packet', gate: 'Founder review', proofRequired: 'Viewport capture' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(activeMissionFixture, {
    fetchSequence: [activeMissionFixture, { schema: 1, tenant: 'cambium' }],
  });
  const progress = rendered.elements.get('progress')!;
  const here = rendered.elements.get('here')!;

  assert.equal(progress.dataset.interactionKind, 'sheet');
  assert.equal(here.dataset.interactionKind, 'sheet');

  await (rendered.context.load as () => Promise<void>)();

  assert.equal(progress.textContent, 'empty ledger');
  assert.equal(here.textContent, 'push required');
  assert.equal(progress.onclick, null);
  assert.equal(here.onclick, null);
  assert.equal(progress.dataset.interactionKind, undefined);
  assert.equal(progress.dataset.source, undefined);
  assert.equal(here.dataset.interactionKind, undefined);
  assert.equal(here.dataset.source, undefined);
});

test('page · pull refresh keeps current branch story view when a stale envelope arrives', async () => {
  const fresh = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    derivedAt: '2026-06-29T07:15:00.000Z',
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        missions: [{ title: 'Launch proof packet', gate: 'Founder review', proofRequired: 'Viewport capture' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        gaps: [],
      }],
    },
  };
  const stale = { ...NO_FAKE_PROGRESS_VISUAL_FIXTURE, derivedAt: '2026-06-29T07:10:00.000Z' };
  const rendered = await renderPageFixtureContext(fresh, { fetchSequence: [fresh, stale] });

  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /Launch proof packet/);
  await (rendered.context.refresh as () => Promise<void>)();

  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /Launch proof packet/);
  assert.equal(rendered.elements.get('fresh')!.textContent, 'stale · refresh skipped');
  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /data-source="product-branch-packets@v1"/);
});

test('page · builds Mission Control view from branchStories without promoting missing proof', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [
          { id: 'seed', title: 'Seed', status: 'verified' },
          { id: 'packet', title: 'Packet', status: 'pending' },
          { id: 'proof', title: 'Proof', status: 'blocked' },
          { id: 'launch', title: 'Launch', status: 'queued' },
        ],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [{ kpiId: 'waitlist', label: 'Waitlist', survival: 'qualified waitlist', betterThanSurvival: 'paid pilot', currentState: 'not proven' }],
        proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: {
          approvals: [{ permission: 'Founder approval', status: 'blocked', requiredApproval: 'Founder approval missing', failureMode: 'claim cannot advance' }],
          dispatchHints: [{ route: 'plexus.branchProof', payloadHint: 'branchId + missionId', allowedWhen: 'proof packet ready', blockedWhen: 'Founder approval missing' }],
          organRouting: [{ organ: 'Taste', owner: 'Cambium taste loop', currentGate: 'pending visual/copy proof', proofPath: 'future Taste packet' }],
          ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' },
        },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [{ id: 'approval', status: 'blocked', detail: 'Founder approval missing', source: 'packet' }],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const view = (rendered.context.buildMissionControlView as (env: unknown) => any)(envelope);

  assert.equal(view.selectedBranchId, 'fitcheck');
  assert.equal(view.nextMission.title, 'Launch proof packet');
  assert.equal(view.nextMission.state, 'blocked');
  assert.equal(view.promotion.state, 'supervised-branch');
  assert.ok(view.blockers.some((row: any) => /Founder approval/.test(row.label)));
  assert.ok(view.proofNeeded.some((row: any) => row.label === 'Viewport capture'));
  assert.equal(view.kpis[0].label, 'Waitlist');
  assert.equal(view.controls.dispatchHints[0].route, 'plexus.branchProof');
  assert.equal(view.activeOrgan.glyph, 'taste');
  assert.equal(view.branches[0].organ.glyph, 'taste');
  assert.equal(view.branches[0].state, 'blocked');
  assert.match(view.inspect.packetFile, /fitcheck\.md/);
  assert.notEqual(view.nextMission.state, 'complete');
});

test('page · Mission Control renders branch loop controls as manual-first', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchLoops: {
      source: 'product-branch-packets@v1',
      status: 'blocked',
      total: 1,
      green: 0,
      yellow: 1,
      red: 0,
      rows: [{
        loopId: 'fitcheck-launch-gate-loop',
        branchId: 'fitcheck',
        productId: 'fitcheck',
        productName: 'Fitcheck',
        title: 'Fitcheck launch gate loop',
        cadence: 'manual weekly',
        objective: 'Move one launch blocker.',
        metric: 'One gate changes status.',
        boundaryColor: 'yellow',
        runMode: 'approval-required',
        oneChangeRule: 'Select exactly one launch gate.',
        stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
        stopRule: 'Stop after 3 rounds.',
        modelRoute: 'cheap-first',
        proofRequired: 'Updated gate row.',
        promotionState: 'supervised-branch',
        currentGate: 'Launch proof',
        packetFile: 'docs/plans/product-branches/fitcheck.md',
      }],
    },
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: {
          loops: [{ loopId: 'fitcheck-launch-gate-loop', title: 'Fitcheck launch gate loop', cadence: 'manual weekly', objective: 'Move one launch blocker.', metric: 'One gate changes status.', boundaryColor: 'yellow', oneChangeRule: 'Select exactly one launch gate.', stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md', stopRule: 'Stop after 3 rounds.', modelRoute: 'cheap-first', proofRequired: 'Updated gate row.' }],
          approvals: [],
          dispatchHints: [],
          organRouting: [],
          ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' },
        },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  assert.doesNotMatch(html, /Fitcheck launch gate loop/);
  assert.match(html, /manual weekly · yellow/);
  assert.match(html, /Loop controls/);
  assert.match(html, /data-mission-action="loops"/);
  assert.doesNotMatch(html, /autonomous loop scheduled/i);

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'loops');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /branch loops · fitcheck/);
  assert.match(sheet, /data-component="StateToken" data-state="proof-needed" aria-label="state: Loop control"/);
  assert.match(sheet, /Fitcheck launch gate loop · yellow · Stop after 3 rounds\./);
});

test('page · Mission Control derives manual-first loop run mode from branch controls when visual loop rows are missing', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: {
          loops: [{ loopId: 'fitcheck-launch-gate-loop', title: 'Fitcheck launch gate loop', cadence: 'manual weekly', objective: 'Move one launch blocker.', metric: 'One gate changes status.', boundaryColor: 'yellow', oneChangeRule: 'Select exactly one launch gate.', stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md', stopRule: 'Stop after 3 rounds.', modelRoute: 'cheap-first', proofRequired: 'Updated gate row.' }],
          approvals: [],
          dispatchHints: [],
          organRouting: [],
          ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' },
        },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  assert.doesNotMatch(html, /Fitcheck launch gate loop/);
  assert.match(html, /manual weekly · yellow/);
  assert.doesNotMatch(html, /undefined/);
  assert.doesNotMatch(html, /autonomous loop scheduled/i);
});

test('page · Mission Control loop sheet uses visual loop rows when branch-local loops are absent', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchLoops: {
      source: 'product-branch-packets@v1',
      status: 'blocked',
      total: 1,
      green: 0,
      yellow: 1,
      red: 0,
      rows: [{
        loopId: 'fitcheck-launch-gate-loop',
        branchId: 'fitcheck',
        title: 'Fitcheck launch gate loop',
        cadence: 'manual weekly',
        boundaryColor: 'yellow',
        runMode: 'approval-required',
        stopRule: 'Stop after 3 rounds.',
      }],
    },
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: { loops: [], approvals: [], dispatchHints: [], organRouting: [], ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' } },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  assert.match(html, /manual weekly · yellow/);
  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'loops');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Fitcheck launch gate loop · yellow · Stop after 3 rounds\./);
  assert.doesNotMatch(sheet, /loop controls missing/);
});

test('page · Mission Control sanitizes unsafe top-level loop run modes to manual-first copy', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchLoops: {
      source: 'product-branch-packets@v1',
      status: 'blocked',
      total: 2,
      green: 0,
      yellow: 1,
      red: 1,
      rows: [
        {
          loopId: 'fitcheck-launch-gate-loop',
          branchId: 'fitcheck',
          title: 'Fitcheck launch gate loop',
          cadence: 'scheduled weekly',
          boundaryColor: 'yellow',
          runMode: 'scheduled',
          stopRule: 'Stop after 3 rounds.',
        },
        {
          loopId: 'fitcheck-proof-loop',
          branchId: 'fitcheck',
          title: 'Fitcheck proof loop',
          cadence: 'autonomous hourly',
          boundaryColor: 'red',
          runMode: 'autonomous',
          stopRule: 'Stop after proof drift.',
        },
      ],
    },
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: { loops: [], approvals: [], dispatchHints: [], organRouting: [], ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' } },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  assert.match(html, /manual approval required · yellow/);
  assert.match(html, /manual approval required · red/);
  assert.match(html, /manual (approval required|review)/);
  assert.doesNotMatch(html, /scheduled|autonomous|unattended/i);

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'loops');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.doesNotMatch(sheet, /scheduled|autonomous|unattended/i);
});

test('page · Mission Control normalizes branch loop controls boundary colors before rendering', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchLoops: {
      source: 'product-branch-packets@v1',
      status: 'blocked',
      total: 3,
      green: 1,
      yellow: 1,
      red: 1,
      rows: [
        {
          loopId: 'fitcheck-launch-gate-loop',
          branchId: 'fitcheck',
          title: 'Fitcheck launch gate loop',
          cadence: 'manual weekly',
          boundaryColor: 'Yellow',
          runMode: 'scheduled',
          stopRule: 'Stop after 3 rounds.',
        },
        {
          loopId: 'fitcheck-read-loop',
          branchId: 'fitcheck',
          title: 'Fitcheck read loop',
          cadence: 'manual daily',
          boundaryColor: 'GREEN',
          stopRule: 'Stop after read drift.',
        },
        {
          loopId: 'fitcheck-invalid-loop',
          branchId: 'fitcheck',
          title: 'Fitcheck invalid loop',
          cadence: 'manual weekly',
          boundaryColor: 'amber is-unsafe',
          runMode: 'scheduled',
          stopRule: 'Stop after invalid boundary.',
        },
      ],
    },
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: { loops: [], approvals: [], dispatchHints: [], organRouting: [], ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' } },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  // M7: card rows render the mono cadence token only; loop titles stay in the Inspect loops sheet.
  assert.doesNotMatch(html, /Fitcheck (launch gate|read|invalid) loop/);
  assert.match(html, /manual weekly · yellow/);
  assert.match(html, /manual daily · green/);
  assert.match(html, /manual weekly · red/);
  assert.doesNotMatch(html, /Yellow|GREEN|amber|is-unsafe|scheduled/);

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'loops');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Fitcheck launch gate loop · yellow · Stop after 3 rounds\./);
  assert.match(sheet, /Fitcheck read loop · green · Stop after read drift\./);
  assert.match(sheet, /Fitcheck invalid loop · red · Stop after invalid boundary\./);
  assert.doesNotMatch(sheet, /Yellow|GREEN|amber|is-unsafe|scheduled/);
});

test('page · Mission Control enriches partial visual loop rows with branch control metadata', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchLoops: {
      source: 'product-branch-packets@v1',
      status: 'blocked',
      total: 1,
      green: 0,
      yellow: 1,
      red: 0,
      rows: [{
        loopId: 'fitcheck-launch-gate-loop',
        branchId: 'fitcheck',
        boundaryColor: 'yellow',
        runMode: 'scheduled',
      }],
    },
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'supervised-branch', currentGate: 'Founder review', rule: 'proof first' },
        controls: {
          loops: [{
            loopId: 'fitcheck-launch-gate-loop',
            title: 'Fitcheck launch gate loop',
            cadence: 'manual weekly',
            objective: 'Move one launch blocker.',
            metric: 'One gate changes status.',
            boundaryColor: 'yellow',
            oneChangeRule: 'Select exactly one launch gate.',
            stateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
            stopRule: 'Stop after 3 rounds.',
            modelRoute: 'cheap-first',
            proofRequired: 'Updated gate row.',
          }],
          approvals: [],
          dispatchHints: [],
          organRouting: [],
          ui: { currentFrontier: 'Founder approval is the current frontier.', blockedCopy: 'Do not claim launch proof until viewport evidence lands.' },
        },
        source: { packetFile: 'docs/plans/product-branches/fitcheck.md', indexFile: 'docs/plans/product-branches/index.md' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  // M7: card renders the enriched cadence token only; the loop title opens in the sheet.
  assert.doesNotMatch(html, /Fitcheck launch gate loop/);
  assert.match(html, /manual weekly · yellow/);
  assert.match(html, /data-mission-action="loops"[^>]*>Open controls<\/button>/);
  assert.doesNotMatch(html, /data-mission-action="loops"[^>]*>yellow · manual weekly<\/button>/);
  assert.doesNotMatch(html, /stop rule missing|manual review|undefined|scheduled|autonomous/i);

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'loops');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Fitcheck launch gate loop · yellow · Stop after 3 rounds\./);
  assert.doesNotMatch(sheet, /loop controls missing|stop rule missing|manual review|undefined|scheduled|autonomous/i);
});

test('page · Mission scene renders branch arcs, next mission, blockers, proof, KPIs, and actions', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        icp: { primary: 'Shopify founder validating fit check demand' },
        questline: [
          { id: 'seed', title: 'Seed', status: 'verified' },
          { id: 'packet', title: 'Packet', status: 'pending' },
          { id: 'proof', title: 'Proof', status: 'blocked' },
        ],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [{ kpiId: 'waitlist', label: 'Waitlist', survival: 'qualified waitlist', betterThanSurvival: 'paid pilot', currentState: 'not proven' }],
        proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'proof-only', currentGate: 'Founder review', rule: 'proof first' },
        controls: {
          organRouting: [{ organ: 'Taste', owner: 'Cambium taste loop', currentGate: 'pending visual/copy proof', proofPath: 'future Taste packet' }],
        },
        gaps: [{ id: 'approval', status: 'blocked', detail: 'Founder approval missing', source: 'packet' }],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  for (const text of ['Fitcheck', 'NEXT MISSION', 'Launch proof packet', 'State Stack', 'Blocked by', 'Proof needed', 'Waitlist', 'Review Gate', 'Open Proof']) {
    assert.match(html, new RegExp(text));
  }
  assert.match(html, /data-no-scene-drag="1" data-mission-action="gate" data-interaction-kind="sheet"/);
  assert.match(html, /data-no-scene-drag="1" data-mission-action="proof" data-interaction-kind="sheet"/);
  assert.match(html, /data-component="MissionStateStack"/);
  assert.match(html, /data-component="GateActionRow"/);
  assert.match(html, /data-component="MissionToolLink"/);
  assert.match(html, /data-mission-action="tools"/);
  assert.match(html, /data-mission-proof-row="1"/);
  // frozen/06: organ texture replaced by the constellation — organ survives as chip route + glyph only.
  assert.match(html, /data-organ-route="taste"/);
  assert.match(html, /data-glyph-kind="taste"/);
  assert.match(html, /data-selected-surface="branch-chip"/);
  assert.match(html, /data-selected-surface="mission-state-row"/);
  assert.equal((html.match(/mc-selected-halo/g) || []).length, 2);
  const selectedBranchChip = rendered.elements.get('stem')!.querySelectorAll('[data-selected-surface="branch-chip"]')[0]?.innerHTML ?? '';
  assert.match(selectedBranchChip, /data-component="BranchArcChip"/);
  assert.match(selectedBranchChip, /role="tab"/);
  assert.match(selectedBranchChip, /aria-selected="true"/);
  assert.doesNotMatch(selectedBranchChip, /data-motion="orbitSweep"|data-motion-primitive="orbitSweep"/);
  // frozen/03: orbitSweep is now a named animation — wired on OrbitProgress arcs only, never on halos/heroes.
  assert.match(PAGE, /@keyframes orbitSweep\{from\{stroke-dashoffset:100\}\}/);
  assert.match(PAGE, /\.mc-orbit\[data-motion="orbitSweep"\] \.mc-orbit-arc\{animation:orbitSweep 1\.4s var\(--ease\) both\}/);
  assert.match(PAGE, /data-motion="orbitSweep" data-motion-primitive="orbitSweep"/);
  assert.doesNotMatch(PAGE, /\.mc-selected-halo\[data-motion="orbitSweep"\]/);
  assert.doesNotMatch(PAGE, /\.gate-hero::after\{[\s\S]*?animation:orbitSweep|\.branch-sheet-hero::after\{[\s\S]*?animation:orbitSweep/);
  assert.match(html, /data-component="SignalRail"[^>]*data-state="blocked"[\s\S]*data-component="PacketFlow"/);
  assert.match(html, /data-mission-state-action="proof"/);
  const cardIndex = html.indexOf('data-component="MissionCard"');
  const stateStackIndex = html.indexOf('data-component="MissionStateStack"');
  const actionRowIndex = html.indexOf('data-component="GateActionRow"');
  const questlineIndex = html.indexOf('data-component="QuestlineTimeline"');
  const proofListIndex = html.indexOf('data-component="ProofList"');
  const toolLinkIndex = html.indexOf('data-component="MissionToolLink"');
  assert.ok(cardIndex > -1 && cardIndex < questlineIndex, 'mission card should wrap the questline timeline');
  assert.ok(questlineIndex < stateStackIndex, 'timeline should precede the state stack');
  assert.ok(stateStackIndex < proofListIndex, 'state summary should lead into proof rows');
  assert.ok(proofListIndex < actionRowIndex, 'proof should precede primary actions');
  assert.ok(actionRowIndex < toolLinkIndex, 'actions should precede secondary utilities');
  assert.match(html, /data-mission-state-action="gate"/);
  assert.match(html, /data-component="OrbitProgress"[^>]*>[\s\S]*<span class="mc-orbit-label">Proof<\/span>/);
  assert.match(html, /data-component="OrbitProgress"[^>]*>[\s\S]*<span class="mc-orbit-label">KPI<\/span>/);
  assert.match(html, /class="mc-kpi-bars" data-component="PacketFlow"/);
  assert.match(html, /data-component="KpiPulse"[^>]*data-kpi-kind="survival"/);
  assert.doesNotMatch(html, /mc-kpi-pulse/);
  assert.doesNotMatch(PAGE, /\.mc-action-row\{[^}]*position:sticky/);
  assert.doesNotMatch(PAGE, /data-mission-action="gate"[^;]+=> go\(1\)/);
  assert.ok(PAGE.includes("stem.querySelectorAll('[data-mission-action=\"gate\"]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'gate'));"));
  assert.ok(PAGE.includes("stem.querySelectorAll('[data-mission-proof-row]').forEach(el => el.onclick = () => openBranchMissionSheet(env, branchIndex, 0, 'proof'));"));

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'gate');
  const gateSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(gateSheet, /branch gate · fitcheck/);
  assert.match(gateSheet, /Review the active gate before this branch can advance/);
  assert.match(gateSheet, /Founder review/);
  assert.match(gateSheet, /data-component="SelectedHalo"[^>]*data-selected-surface="detail-sheet"/);

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number, focus?: string) => void)(envelope, 0, 0, 'proof');
  const proofSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(proofSheet, /branch proof · fitcheck/);
  assert.match(proofSheet, /Open the proof requirement for the next branch mission/);
  assert.match(proofSheet, /Viewport capture/);
  assert.match(proofSheet, /data-component="KpiPulse"[^>]*data-kpi-kind="survival"[\s\S]*data-component="OrbitProgress"[\s\S]*class="mc-kpi-bars" data-component="PacketFlow"/);
  assert.doesNotMatch(proofSheet, /mc-kpi-pulse/);
  assert.doesNotMatch(html, /autonomous ready|production verified|live proof ready|shipped|launched|100% success/i);
});

test('page · mission branch tab updates content in place and keeps the sheet closed', async () => {
  const branch = (branchId: string, name: string, title: string) => ({
    branchId,
    name,
    arcTitle: `${name} arc`,
    vision: { statement: `${name} keeps its next move visible in Mission.` },
    questline: [
      { id: 'confirm', title: `Confirm ${name} direction`, status: 'verified' },
      { id: 'run', title: title, status: 'pending' },
    ],
    missions: [{ missionId: `${branchId}-next`, title, owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Hermes' }],
    gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
    kpis: [],
    proofPaths: [{ proofId: `${branchId}-proof`, validates: 'Viewport capture', promotes: 'supervised branch' }],
    promotion: { state: 'proof-only', currentGate: 'Founder review', rule: 'proof first' },
    gaps: [{ id: `${branchId}-gap`, status: 'blocked', detail: 'Founder review pending', source: 'packet' }],
  });
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [
        branch('fitcheck', 'Fitcheck', 'Run authenticated Shopify widget QA'),
        branch('vantyx', 'Vantyx', 'Publish Vantyx proof packet'),
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const stem = rendered.elements.get('stem')!;
  const sheet = rendered.elements.get('sheet')!;
  const tabs = stem.querySelectorAll('[data-mission-branch]');

  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].getAttribute('role'), 'tab');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.match(stem.innerHTML, /<h3 class="mc-card-title">Run authenticated Shopify widget QA<\/h3>/);

  tabs[0].click();
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'fitcheck');
  assert.match(stem.innerHTML, /<h3 class="mc-card-title">Run authenticated Shopify widget QA<\/h3>/);
  assert.equal(sheet.classList.has('on'), false);

  stem.querySelectorAll('[data-mission-branch]')[1].click();

  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'vantyx');
  assert.match(stem.innerHTML, /<h3 class="mc-card-title">Publish Vantyx proof packet<\/h3>/);
  assert.equal(stem.querySelectorAll('[data-mission-branch]')[1].getAttribute('aria-selected'), 'true');
  assert.equal(sheet.classList.has('on'), false);
  assert.equal(vm.runInContext('sheetState.open', rendered.context as vm.Context), false);

  const vantyxTab = stem.querySelectorAll('[data-mission-branch]')[1];
  assert.equal(vantyxTab.dispatchEvent({ type:'keydown', key:'ArrowLeft', bubbles:true }), false);
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'fitcheck');
  assert.equal(stem.querySelector('[data-mission-branch="0"]').focusCalls.length, 1);

  const fitcheckTab = stem.querySelectorAll('[data-mission-branch]')[0];
  assert.equal(fitcheckTab.dispatchEvent({ type:'keydown', key:'End', bubbles:true }), false);
  assert.equal(vm.runInContext('MISSION_BRANCH_FOCUS', rendered.context as vm.Context), 'vantyx');
  assert.equal(stem.querySelector('[data-mission-branch="1"]').focusCalls.length, 1);
});

test('page · mission questline is a horizontal station timeline with readable labels', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        vision: { statement: 'Keep the complete mobile sequence readable.' },
        questline: [
          { id: 'confirm', title: 'Confirm Shopify credentials', status: 'verified' },
          { id: 'run', title: 'Run authenticated Shopify widget QA', status: 'current' },
          { id: 'patch', title: 'Patch only verified failures', status: 'pending' },
          { id: 'wire', title: 'Wire Dodo payment proof', status: 'pending' },
          { id: 'ingest', title: 'Ingest evidence receipts', status: 'pending' },
        ],
        missions: [{ missionId: 'qa', title: 'Run authenticated Shopify widget QA', owner: 'Build', gate: 'Credentials', proofRequired: 'Viewport capture', dispatchTarget: 'Hermes' }],
        gates: [{ gate: 'Credentials', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        promotion: { state: 'proof-only' },
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  assert.match(html, /class="mc-timeline"[^>]*data-component="QuestlineTimeline"[^>]*data-no-scene-drag="1"/);
  assert.equal((html.match(/mc-timeline-station/g) || []).length, 5);
  // Full labels stay readable via the station title attribute; visible caption is the ≤2-word short label.
  assert.match(html, /class="mc-timeline-name" title="Confirm Shopify credentials"/);
  assert.match(html, /class="mc-timeline-name" title="Ingest evidence receipts"/);
  // Current step = first non-complete station (the active one), marked for assistive tech.
  assert.match(html, /data-questline-stage-state="active" aria-current="step"/);
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
  // Connector grammar: solid behind complete→active (with packet dots), dashed muted past it.
  assert.equal((html.match(/mc-connector is-solid/g) || []).length, 1);
  assert.equal((html.match(/mc-connector is-dashed/g) || []).length, 3);
  assert.match(html, /mc-connector is-solid" data-connector-state="active"/);
  // Active station carries the orbit ring; harness matchMedia forces reduced motion, so
  // the orbitSweep animation hook is asserted through PAGE CSS only. The ring is an SVG
  // inside the station box (inset:0) sweeping via stroke-dashoffset, so its geometry can
  // never inflate scrollWidth past the card at 320px — the old rotating div orbit did.
  assert.match(html, /class="mc-station-orbit" aria-hidden="true"/);
  assert.doesNotMatch(html, /data-motion="orbitSweep"/);
  assert.match(PAGE, /\.mc-timeline\{display:flex/);
  assert.match(PAGE, /\.mc-connector\.is-solid\{[^}]*background:var\(--mc-chartreuse\)/);
  assert.match(PAGE, /\.mc-connector\.is-dashed\{/);
  assert.match(PAGE, /\.mc-station-orbit\{position:absolute;inset:0/);
  assert.match(PAGE, /\.mc-station-orbit\[data-motion="orbitSweep"\] \.mc-station-orbit-arc\{animation:orbitSweep 1\.4s var\(--ease\) both\}/);
  assert.doesNotMatch(PAGE, /mcOrbitSpin/);
  assert.match(PAGE, /\.app\{[^}]*max-width:100%[^}]*overflow:hidden/);
  assert.match(PAGE, /\.track\{[^}]*max-width:100%[^}]*display:flex/);
});

test('page · compact filter strips wrap instead of introducing hidden horizontal rails', () => {
  assert.match(PAGE, /\.tool-context-strip,\.tool-recent-strip,\.story-filter-strip,\.gate-filter-strip\{[^}]*flex-wrap:wrap[^}]*overflow:hidden/);
  assert.match(PAGE, /\.tool-context-strip span,\.tool-context-strip button,\.tool-recent-strip button,\.story-filter-strip button,\.gate-filter-strip button\{[^}]*min-width:0[^}]*max-width:100%/);
  assert.doesNotMatch(PAGE, /\.(?:tool-context-strip|tool-recent-strip|story-filter-strip|gate-filter-strip)\{[^}]*overflow-x:auto/);
});

test('page · mobile header keeps full-width brand and touch-safe chips through 430px', () => {
  assert.match(PAGE, /\.chip\{[^}]*min-height:44px[^}]*display:inline-flex/);
  assert.match(PAGE, /@media \(max-width:480px\)\{[\s\S]*?header\.root-status\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(PAGE, /@media \(max-width:480px\)\{[\s\S]*?\.root-chip-stack\{[^}]*width:100%[^}]*justify-content:flex-start/);
});

test('page · branch rail owns deterministic touch drag without leaking scene motion', async () => {
  assert.match(PAGE, /function bindMissionBranchRailTouch\(rail\)/);
  assert.match(PAGE, /rail\.addEventListener\('touchstart'/);
  assert.match(PAGE, /rail\.addEventListener\('touchmove'/);
  assert.match(PAGE, /event\.preventDefault\(\)/);
  assert.match(PAGE, /rail\.scrollLeft\s*=\s*startScrollLeft\s*\+\s*delta/);
  assert.match(PAGE, /bindMissionBranchRailTouch\(stem\.querySelector\('\.mc-branch-rail'\)\)/);

  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search:'?tenant=cambium&scene=mission' });
  const rail = rendered.elements.get('stem')!.querySelector('.mc-branch-rail') as any;
  const bindRailTouch = vm.runInContext('bindMissionBranchRailTouch', rendered.context as vm.Context);
  bindRailTouch(rail);
  rail.scrollLeft = 0;
  assert.equal(rail.dispatchEvent({ type:'touchstart', touches:[{ clientX:320 }], cancelable:true }), true);
  rail.dispatchEvent({ type:'touchmove', touches:[{ clientX:224 }], cancelable:true });
  assert.equal(rail.scrollLeft, 96);
});

test('page · mission proof previews are semantic buttons', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck', name: 'Fitcheck', vision: { statement: 'Proof stays reachable.' },
        questline: [{ id: 'proof', title: 'Attach viewport proof', status: 'blocked' }],
        missions: [{ missionId: 'proof', title: 'Attach viewport proof', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Hermes' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [], proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'proof-only' }, gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  assert.match(rendered.elements.get('stem')!.innerHTML, /<button type="button"[^>]*data-mission-proof-row="1"/);
});

test('page · Inspect keeps summary visible while Proof and System switch in place', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=inspect',
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  const map = rendered.elements.get('mapwrap')!;
  const controls = map.querySelectorAll('[data-inspect-pane-select]');

  assert.match(map.innerHTML, /data-component="InspectProofSummaryAction"/);
  assert.match(map.innerHTML, /data-component="InspectPaneSwitcher"/);
  assert.equal(controls.length, 2);
  assert.equal(controls[0].dataset.inspectPaneSelect, 'proof');
  assert.equal(controls[0].getAttribute('aria-selected'), 'true');
  assert.equal(controls[0].getAttribute('aria-controls'), 'inspect-proof-panel');
  assert.equal(controls[0].getAttribute('tabindex'), '0');
  assert.match(map.innerHTML, /data-inspect-pane="proof"[^>]*class="inspect-pane is-active"/);
  assert.match(map.innerHTML, /id="inspect-proof-panel"[^>]*aria-labelledby="inspect-proof-tab"/);
  assert.doesNotMatch(map.innerHTML, /data-inspect-pane="system"/);

  controls[1].click();

  assert.equal(vm.runInContext('INSPECT_PANE', rendered.context as vm.Context), 'system');
  assert.equal(map.querySelectorAll('[data-inspect-pane-select]')[1].getAttribute('aria-selected'), 'true');
  assert.equal(map.querySelectorAll('[data-inspect-pane-select]')[1].getAttribute('aria-controls'), 'inspect-system-panel');
  assert.match(map.innerHTML, /data-inspect-pane="system"[^>]*class="inspect-pane is-active"/);
  assert.match(map.innerHTML, /id="inspect-system-panel"[^>]*aria-labelledby="inspect-system-tab"/);
  assert.doesNotMatch(map.innerHTML, /data-inspect-pane="proof"/);
  assert.equal(rendered.elements.get('sheet')!.classList.has('on'), false);

  const systemTab = map.querySelectorAll('[data-inspect-pane-select]')[1];
  assert.equal(systemTab.dispatchEvent({ type:'keydown', key:'ArrowLeft', bubbles:true }), false);
  assert.equal(vm.runInContext('INSPECT_PANE', rendered.context as vm.Context), 'proof');
  assert.equal(map.querySelector('[data-inspect-pane-select="proof"]').focusCalls.length, 1);
  assert.match(map.innerHTML, /data-inspect-pane="proof"[^>]*class="inspect-pane is-active"/);
  assert.doesNotMatch(map.innerHTML, /data-inspect-pane="system"/);
});

test('page · primary copy Mission Gate Tools and Story denylist keeps meta language in Inspect', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        vision: { statement: 'Move launch proof from packet to founder-visible evidence.' },
        questline: [{ id: 'proof', title: 'Proof', status: 'blocked' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [{ kpiId: 'waitlist', label: 'Waitlist', survival: 'qualified waitlist', betterThanSurvival: 'paid pilot', currentState: 'not proven' }],
        proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'proof-only', currentGate: 'Founder review', rule: 'proof first' },
        gaps: [{ id: 'approval', status: 'blocked', detail: 'Founder approval missing', source: 'packet' }],
      }],
    },
    beats: [{ text: 'Proof moved forward', lane: 'quest', source: 'quest-ledger' }],
    openItems: [{
      id: 'THO-9',
      title: 'Review launch copy',
      source: 'Paperclip · paperclip-open-items',
      evidence: 'THO-9 blocked by launch copy review',
      consequence: 'queue founder approval for THO-9; no Paperclip/org mutation until the operator consumes the queue',
      reversibility: 'queued action can be superseded until consumed',
    }],
  };
  const rendered = await renderPageFixtureContext(envelope, { fetchSequence: [envelope, envelope, envelope] });
  assertNoPrimaryMetaCopy(rendered.elements.get('stem')!.innerHTML);
  assertNoPrimaryMetaCopy(rendered.elements.get('beats')!.innerHTML);

  (rendered.context.renderCommands as () => void)();
  assertNoPrimaryMetaCopy(rendered.elements.get('cmds')!.innerHTML);

  (rendered.context.go as (index: number) => void)(1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertNoPrimaryMetaCopy(rendered.elements.get('gate')!.innerHTML);
});

test('page · proof-only blocked branch primary UI does not overclaim readiness', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'iverif',
        name: 'IVerif',
        arcTitle: 'Verification arc',
        questline: [{ id: 'proof', title: 'Proof packet', status: 'blocked' }],
        missions: [{ missionId: 'proof', title: 'Collect verification proof', owner: 'Build', gate: 'Founder review', proofRequired: 'Signed viewport receipt', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Signed viewport receipt' }],
        kpis: [{ kpiId: 'pilot', label: 'Pilot proof', survival: 'one supervised pilot proof', betterThanSurvival: 'repeatable paid pilot', currentState: 'missing proof' }],
        proofPaths: [{ proofId: 'signed-viewport', validates: 'Signed viewport receipt', promotes: 'supervised branch only' }],
        promotion: { state: 'proof-only', currentGate: 'Founder review', rule: 'proof first' },
        gaps: [{ id: 'proof-missing', status: 'blocked', detail: 'Signed viewport receipt missing', source: 'packet' }],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const html = rendered.elements.get('stem')!.innerHTML;

  assert.match(html, /proof-only/);
  assert.match(html, /Signed viewport receipt/);
  assert.match(html, /Blocked by/);
  assert.doesNotMatch(html, /autonomous ready|production verified|live proof ready|shipped|launched|100% success/i);
});

test('page · IVerif gate copy keeps proof-only boundary before signed action', async () => {
  const env = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'iverif',
        name: 'IVerif',
        promotion: { state: 'proof-only', currentGate: 'Claim/proof separation before automation' },
        arcTitle: 'Claim Proof Separation',
        missions: [{ missionId: 'iverif-wiki-proof', title: 'Repair and run wiki build/route proof', gate: 'Build proof', proofRequired: '`verify:data`, `verify:routes`, and build receipt', dispatchTarget: 'hermes' }],
        gates: [{ gate: 'Public claims', status: 'blocked', requiredProof: 'source-linked claim table' }],
        kpis: [],
        proofPaths: [],
        gaps: [],
      }],
    },
    openItems: [{
      id: 'ar_iverif_w6_live_mrcwmcs3',
      title: 'IVerif: decision needed before action',
      branchId: 'iverif',
      missionId: 'iverif-wiki-proof',
      evidence: 'proof-only claim/proof separation before automation; post-lead enrichment and outreach are not configured',
      consequence: 'queue founder approval for ar_iverif_w6_live_mrcwmcs3; no Paperclip/org mutation and no outreach or client-facing send until signed confirmation and operator consume',
      approveConsequence: 'queue founder approval for ar_iverif_w6_live_mrcwmcs3; no Paperclip/org mutation and no outreach or client-facing send until signed confirmation and operator consume',
      rerollConsequence: 'queue founder reroll request for ar_iverif_w6_live_mrcwmcs3; no Paperclip/org mutation and no outreach or client-facing send until signed confirmation and operator consume',
      reversibility: 'withheld until signed Mini App confirmation',
      idempotencyHint: 'ar_iverif_w6_live_mrcwmcs3',
    }],
  };
  const rendered = await renderPageFixtureContext(env, { search: '?tenant=cambium&scene=gate' });
  const gate = rendered.elements.get('gate')!.innerHTML;

  assert.match(gate, /iverif/);
  assert.match(gate, /proof-only|claim\/proof separation|signed/i);
  assert.doesNotMatch(gate, /autonomous|outreach sent|client-facing send complete|live SaaS ready/i);

  // The proof-boundary consequence moved off the card into the signed preflight payload (frozen/06 §2.4).
  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'ar_iverif_w6_live_mrcwmcs3', { dataset: { i: '0', id: 'ar_iverif_w6_live_mrcwmcs3' }, style: {} });
  const preflight = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(preflight, /data-gate-consequence="[^"]*no outreach or client-facing send until signed confirmation and operator consume/);
});

test('page · unreachable ledger state names retry route and no local write', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { rejectFetch: true });
  const stem = rendered.elements.get('stem')!.innerHTML;

  assert.match(stem, /ledger unreachable/);
  assert.match(stem, /retry/);
  assert.match(stem, /\/api\/quests\/cambium/);
  assert.match(stem, /performs no local write/);
});

test('page · offline refresh clears stale quest summary handlers', async () => {
  const activeMissionFixture = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        missions: [{ title: 'Launch proof packet', gate: 'Founder review', proofRequired: 'Viewport capture' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [],
        proofPaths: [],
        gaps: [],
      }],
    },
  };
  const rendered = await renderPageFixtureContext(activeMissionFixture, {
    fetchSequence: [activeMissionFixture, new Error('offline')],
  });
  const progress = rendered.elements.get('progress')!;
  const here = rendered.elements.get('here')!;

  assert.equal(progress.dataset.interactionKind, 'sheet');
  assert.equal(here.dataset.interactionKind, 'sheet');

  await (rendered.context.load as () => Promise<void>)();

  assert.equal(progress.textContent, 'ledger offline');
  assert.equal(here.textContent, 'retry fetch');
  assert.equal(progress.onclick, null);
  assert.equal(here.onclick, null);
  assert.equal(progress.dataset.interactionKind, undefined);
  assert.equal(progress.dataset.source, undefined);
  assert.equal(here.dataset.interactionKind, undefined);
  assert.equal(here.dataset.source, undefined);
});

test('page · inspect header opens shared visual contract sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const map = rendered.elements.get('mapwrap')!.innerHTML;

  assert.match(map, /class="mapbadge"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="shared\/cambium-visual-contract")/);
  (rendered.context.openMapHeaderSheet as (ledger: unknown) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /inspect · active frontier/);
  assert.match(sheet, /Inspect Header/);
  assert.match(sheet, /active arc<\/b><span>I/);
  assert.match(sheet, /active organ<\/b><span>GENESIS/);
  assert.match(sheet, /source<\/b><span>shared\/cambium-visual-contract/);
});

test('page · rail rows carry data-rail and open rail sheets', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;

  for (const rail of CAMBIUM_VISUAL_RAILS) {
    assert.match(map, new RegExp(`data-rail="${rail.id}"`));
  }
  assert.match(map, /class="rail [^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="shared\/cambium-visual-contract")/);

  (rendered.context.openRailSheet as (railId: string, ledger: unknown) => void)(CAMBIUM_VISUAL_RAILS[0].id, NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /rail · genesis-to-taste/);
  assert.match(sheet, /data rail<\/b><span>genesis-to-taste/);
  assert.match(sheet, /source<\/b><span>shared\/cambium-visual-contract\.ts/);
  assert.match(sheet, /proof<\/b><span>shared\/cambium-visual-contract\.ts/);
  assert.match(sheet, /from organ<\/b><span>GENESIS/);
  assert.match(sheet, /to organ<\/b><span>TASTE/);
});

test('page · rail sheets map lanes to ecosystem targets and active frontier', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);

  (rendered.context.openRailSheet as (railId: string, ledger: unknown) => void)('genesis-to-taste', NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  let sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /ecosystem target<\/b><span>paperclip/);
  assert.match(sheet, /lane<\/b><span>handoff/);
  assert.match(sheet, /active organ<\/b><span>GENESIS/);
  assert.match(sheet, /active rail<\/b><span>yes · touches active organ/);

  (rendered.context.openRailSheet as (railId: string, ledger: unknown) => void)('build-to-ops', NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /ecosystem target<\/b><span>quine/);
  assert.match(sheet, /lane<\/b><span>runner/);
  assert.match(sheet, /active rail<\/b><span>no · does not touch active organ/);

  (rendered.context.openRailSheet as (railId: string, ledger: unknown) => void)('cortex-to-genesis', NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /ecosystem target<\/b><span>cortex/);
  assert.match(sheet, /lane<\/b><span>background-emitter/);
  assert.match(sheet, /active rail<\/b><span>yes · touches active organ/);
});

test('page · stage sheets map organs to ecosystem targets and stay read-only', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const expected = new Map([
    ['genesis', 'genesis'],
    ['taste', 'taste'],
    ['build', 'build'],
    ['ops', 'ops'],
    ['cortex', 'cortex'],
  ]);

  for (const [stageId, target] of expected) {
    (rendered.context.openMapSheet as (ledger: unknown, stageId: string) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger, stageId);
    const sheet = rendered.elements.get('sheetBody')!.innerHTML;
    assert.match(sheet, new RegExp(`inspect stage · ${stageId}`));
    assert.match(sheet, /data-component="VisualStageSheetHeader"/);
    assert.match(sheet, /data-component="MissionGlyph"/);
    assert.match(sheet, /data-component="StateToken"/);
    assert.match(sheet, new RegExp(`organ target<\\/b><span>${target}`));
    assert.match(sheet, /source<\/b><span>shared\/cambium-visual-contract\.ts/);
    assert.match(sheet, /interaction<\/b><span>read-only stage inspection; no signed action is queued from this sheet/);
    assert.doesNotMatch(sheet, /data-kind="approve"|data-kind="reroll"|data-promote-skill|data-queue-side-quest/);
  }
});

test('page · empty stage sheets name the shared contract source', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.openMapSheet as (ledger: unknown, stageId: string) => void)({
    rows: [],
    current: null,
    completed: 0,
    total: 0,
  }, 'taste');

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /no quest rows currently mapped to this organ/);
  assert.match(sheet, /shared\/cambium-visual-contract\.ts/);
  assert.match(sheet, /organ target<\/b><span>taste/);
});

test('page · freshness chip opens stale source proof sheet', async () => {
  assert.match(PAGE, /<button id="fresh" type="button" class="chip" data-interaction-kind="sheet"/);
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const fresh = rendered.elements.get('fresh')!;
  assert.equal(fresh.classList.has('stale'), true);
  assert.equal(fresh.dataset.interactionKind, 'sheet');
  assert.equal(fresh.dataset.source, 'visual-fixture:no-fake-progress');
  (fresh.onclick as () => void)();
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /stale data is not live proof/);
  assert.match(sheet, /derivedAt<\/b><span>2026-01-01T00:00:00.000Z/);
  assert.match(sheet, /source<\/b><span>visual-fixture:no-fake-progress/);
  assert.match(sheet, /stale threshold<\/b><span>360 minutes/);
  assert.match(sheet, /refresh command<\/b><span>quine write quests push --tenant cambium/);
});

test('page · freshness chip keeps interaction metadata for empty and offline states', async () => {
  const empty = await renderPageFixtureContext({ schema: 1, tenant: 'cambium' });
  assert.equal(empty.elements.get('fresh')!.textContent, 'empty');
  assert.equal(empty.elements.get('fresh')!.dataset.interactionKind, 'sheet');
  assert.equal(empty.elements.get('fresh')!.dataset.source, 'missing');
  (empty.elements.get('fresh')!.onclick as () => void)();
  assert.match(empty.elements.get('sheetBody')!.innerHTML, /stale data is not live proof/);

  const offline = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { rejectFetch: true });
  assert.equal(offline.elements.get('fresh')!.textContent, 'offline');
  assert.equal(offline.elements.get('fresh')!.dataset.interactionKind, 'sheet');
  assert.equal(offline.elements.get('fresh')!.dataset.source, '/api/quests/cambium');
  (offline.elements.get('fresh')!.onclick as () => void)();
  assert.match(offline.elements.get('sheetBody')!.innerHTML, /source<\/b><span>\/api\/quests\/cambium/);
});

test('page · pull-to-refresh provenance is read-only fetch', () => {
  assert.match(PAGE, /data-refresh-route="\/api\/quests\/cambium"/);
  assert.match(PAGE, /data-refresh-writes="signed-actions-only"/);
  assert.match(PAGE, /id="ptrProof" class="ptr-proof"/);
  assert.match(PAGE, /Pull to refresh updates \/api\/quests\/cambium; decisions stay behind signed actions/);
});

test('page · reduced motion keeps scene state and interactions visible', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.go as (index: number) => void)(4);
  selectInspectPane(rendered, 'system');
  (rendered.context.go as (index: number) => void)(3);
  assert.equal(rendered.elements.get('tb3')!.classList.has('on'), true);
  assert.equal(rendered.elements.get('sceneBadge')!.textContent, 'Story');
  (rendered.context.renderStory as (env: unknown) => void)({
    beats: [{ text: 'reduced motion story beat remains visible', lane: 'quest' }],
  });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  // T-021: the row stays visible as a teaser; the harness forces prefers-reduced-motion, so
  // T-022 rails render static — zero data-motion attributes anywhere in the scene.
  assert.match(storyHtml, /Mission moved/);
  assert.match(storyHtml, /Proof ready/);
  assert.match(storyHtml, /data-interaction-kind="sheet"/);
  assert.match(storyHtml, /data-component="StoryPacketRail"|data-component="StoryBeatCard"/);
  assert.doesNotMatch(storyHtml, /data-motion=/);

  const mapHtml = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(mapHtml, /data-signed-action-entrypoint="queue-side-quest"/);

  (rendered.context.renderCommands as () => void)();
  const commandHtml = rendered.elements.get('cmds')!.innerHTML;
  // T-019: surfaces render stale + read-only without a commands envelope; chat commands are gone.
  assert.match(commandHtml, /class="cmd live[^"]*"(?=[^>]*data-interaction-kind="read-only")/);
  assert.doesNotMatch(commandHtml, /data-interaction-kind="chat-command"/);

  (rendered.elements.get('sceneBadge')!.onclick as () => void)();
  const storySheet = rendered.elements.get('sheetBody')!.innerHTML;
  assertNoPrimarySceneSheetTelemetry(storySheet);

  (rendered.context.go as (index: number) => void)(4);
  (rendered.elements.get('sceneBadge')!.onclick as () => void)();
  const inspectSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(inspectSheet, /reduced motion proof<\/b><span[^>]*data-reduced-motion-proof="1"/);
  assert.match(inspectSheet, /data-sheet="true"/);
  assert.match(inspectSheet, /data-signed-action="true"/);
  // T-019 retired chat commands app-wide; read-only surfaces remain (stale Tools cards).
  assert.match(inspectSheet, /data-chat-command="false"/);
  assert.match(inspectSheet, /data-read-only="true"/);
});

test('visual fixtures · no-fake-progress visual fixture stays honest about missing proof', () => {
  assert.deepEqual(NO_FAKE_PROGRESS_VISUAL_FIXTURE.beats, []);
  assert.equal(NO_FAKE_PROGRESS_VISUAL_FIXTURE.derivedAt, '2026-01-01T00:00:00.000Z');
  assert.ok(
    Date.now() - Date.parse(NO_FAKE_PROGRESS_VISUAL_FIXTURE.derivedAt) > 360 * 60 * 1000,
    'no-fake-progress fixture remains stale by the six-hour proof window',
  );
  assert.equal(NO_FAKE_PROGRESS_VISUAL_FIXTURE.commands, null);
  assert.equal(NO_FAKE_PROGRESS_VISUAL_FIXTURE.liveProof.status, 'blocked');
  assert.equal(NO_FAKE_PROGRESS_VISUAL_FIXTURE.liveProof.summary.liveProofReady, false);
  assert.equal(NO_FAKE_PROGRESS_VISUAL_FIXTURE.liveProof.summary.blocked, 2);
  assert.equal(NO_FAKE_PROGRESS_VISUAL_FIXTURE.liveProof.rows.length, NO_FAKE_PROGRESS_VISUAL_FIXTURE.liveProof.summary.blocked);
  for (const row of NO_FAKE_PROGRESS_VISUAL_FIXTURE.liveProof.rows) {
    assert.equal(row.state, 'blocked', `${row.id} remains blocked`);
    assert.match(row.proof, /guidance, not proof|current readiness blocks/, `${row.id} proof does not overclaim readiness`);
  }
});

test('visual fixtures · fresh ecosystem fixture has live source proofs', () => {
  assert.equal(FRESH_ECOSYSTEM_VISUAL_FIXTURE.derivedAt, '2026-06-22T09:00:00.000Z');
  assert.equal(FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.status, 'fresh');
  assert.equal(FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock, '2026-06-22T10:00:00.000Z');
  const ageMinutes = Math.round((Date.parse(FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock) - Date.parse(FRESH_ECOSYSTEM_VISUAL_FIXTURE.derivedAt)) / 60000);
  assert.equal(ageMinutes, 60);
  assert.ok(ageMinutes < FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.staleAfterMinutes);
  assert.match(FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proof, /60 minutes before fixture proof clock/);
  assert.ok(FRESH_ECOSYSTEM_VISUAL_FIXTURE.commands, 'fresh fixture has command data');
  assert.ok(FRESH_ECOSYSTEM_VISUAL_FIXTURE.beats.length >= 2, 'fresh fixture has story beats');
  assert.match(FRESH_ECOSYSTEM_VISUAL_FIXTURE.rails.proof, /rails served from shared/);
  assert.ok(FRESH_ECOSYSTEM_VISUAL_FIXTURE.sourceProofs.some((proof) => proof.id === 'commands'));
});

test('visual fixtures · iVerif ActionRequest fixture is a reusable W5 branch projection', () => {
  assert.equal(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.source, 'visual-fixture:iverif-action-requests');
  assert.equal(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.schema, 'thoughtseed.action-request-list.v1');
  assert.equal(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.branchId, 'iverif');
  assert.deepEqual(
    IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.rows.map((row) => row.status),
    ['needs_signed_confirmation', 'queued', 'completed'],
  );
  assert.ok(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.rows.every((row) => row.branchId === 'iverif'));
  assert.ok(
    IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.rows.every((row) => !('telegram' in row)),
    'fixture must not add a telegram object that the public projection does not serve',
  );
  assert.ok(
    IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.rows.every((row) => !('receiptExpectation' in row)),
    'fixture must not add receipt copy that the public projection does not serve',
  );
  assert.deepEqual(
    IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE.actionRequests.rows.map((row) => row.topic.sourceMessageId),
    ['1068', '1069', '1070'],
    'message provenance uses the public topic.sourceMessageId field',
  );
  const fixtureText = JSON.stringify(IVERIF_ACTION_REQUESTS_VISUAL_FIXTURE);
  assert.doesNotMatch(fixtureText, /-1002691202808/);
  assert.doesNotMatch(fixtureText, /query_id=|auth_date=|tgWebAppData|callbackNonce|telegramMessageId|Bearer\s+[A-Za-z0-9._-]{12,}|secret-hash|secret-signature/i);
});

test('visual fixtures · fresh ecosystem fixture renders command and story proof', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  (rendered.context.renderCommands as () => void)();
  assert.match(rendered.elements.get('cmds')!.innerHTML, /data-tool-surface="hermes"/);
  assert.match(rendered.elements.get('cmds')!.innerHTML, /<span class="cname">Services<\/span>/);
  // T-021: the beat projects as a teaser row at rest; the digest sheet proves the full text landed.
  assert.match(rendered.elements.get('beats')!.innerHTML, /New signal/);
  (rendered.context.openStoryDigest as () => void)();
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /Hermes routed a fresh command snapshot/);
  assert.equal(rendered.elements.get('fresh')!.classList.has('stale'), false);
});

test('visual fixtures · stale ecosystem fixture records explicit stale reasons', () => {
  const ageMinutes = Math.round((Date.now() - Date.parse(STALE_ECOSYSTEM_VISUAL_FIXTURE.derivedAt)) / 60000);
  assert.ok(ageMinutes > 360, `stale fixture should be older than six hours, got ${ageMinutes}m`);
  assert.equal(STALE_ECOSYSTEM_VISUAL_FIXTURE.stale.staleAfterMinutes, 360);
  assert.ok(STALE_ECOSYSTEM_VISUAL_FIXTURE.stale.reasons.some((reason) => /stale data is not live proof/.test(reason)));
  assert.ok(STALE_ECOSYSTEM_VISUAL_FIXTURE.stale.reasons.some((reason) => /quine write quests push --tenant cambium/.test(reason)));
});

test('visual fixtures · stale ecosystem fixture renders stale freshness', async () => {
  const rendered = await renderPageFixtureContext(STALE_ECOSYSTEM_VISUAL_FIXTURE);
  assert.equal(rendered.elements.get('fresh')!.classList.has('stale'), true);
  (rendered.elements.get('fresh')!.onclick as () => void)();
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /stale data is not live proof/);
});

test('visual fixtures · offline ecosystem fixture keeps gaps explicit', () => {
  assert.equal(OFFLINE_ECOSYSTEM_VISUAL_FIXTURE.commands, null);
  assert.match(OFFLINE_ECOSYSTEM_VISUAL_FIXTURE.liveProof.gap, /live proof source offline/);
  assert.match(OFFLINE_ECOSYSTEM_VISUAL_FIXTURE.wake.gap, /commands, live proof, and Paperclip are unavailable/);
  assert.match(OFFLINE_ECOSYSTEM_VISUAL_FIXTURE.social.rows[0].detail, /Paperclip coordination evidence is unavailable/);
  assert.match(OFFLINE_ECOSYSTEM_VISUAL_FIXTURE.paperclip.gap, /Paperclip unavailable/);
});

test('visual fixtures · offline ecosystem fixture renders offline gaps', async () => {
  const rendered = await renderPageFixtureContext(OFFLINE_ECOSYSTEM_VISUAL_FIXTURE);
  const inspectProofHtml = rendered.elements.get('mapwrap')!.innerHTML;
  selectInspectPane(rendered, 'system');
  const map = [inspectProofHtml, rendered.elements.get('mapwrap')!.innerHTML].join('\n');
  assert.match(map, /PAPERCLIP OFFLINE/);
  assert.match(map, /offline gap: missing source/);
  assert.match(map, /live proof source offline/);
});

test('page · tapestry audit sheet maps completion requirements to source-backed proof', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const liveProofIndex = rows.findIndex((row) => row.id === 'live-proof');
  assert.ok(liveProofIndex >= 0, 'live-proof audit row exists');
  (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, liveProofIndex);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /live proof summary · blocked/);
  assert.match(sheet, /ready<\/b><span>6/);
  assert.match(sheet, /blocked<\/b><span>2/);
  assert.match(sheet, /total<\/b><span>8/);
  assert.match(sheet, /liveProofReady<\/b><span>false/);
  assert.match(sheet, /blocked row 1<\/b><span>IN-APP SIGNED RECEIPT/);
  assert.match(sheet, /blocked row 2<\/b><span>WORKER LIST PROOF/);
  assert.doesNotMatch(sheet, /blocked row 3/);
  assert.match(sheet, /pasted initData is rejected outright/);
  assert.doesNotMatch(sheet, /all requirements complete|production verified|live proof ready/i);
});

test('page · tapestry audit renders every row as a target-backed sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  selectInspectPane(rendered, 'system');
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  const targets = [
    ['active-organ', 'r3f'],
    ['wake-health', 'quine'],
    ['skill-mastery', 'operator-policy'],
    ['mira-relationship', 'cortex'],
    ['priority-signals', 'operator-policy'],
    ['coordination-source', 'paperclip'],
    ['npc-history', 'cortex'],
    ['command-state', 'hermes'],
    ['live-proof', 'live-proof'],
  ] as const;

  assert.equal((map.match(/data-tapestry="/g) ?? []).length, rows.length);
  for (const [id, target] of targets) {
    const index = rows.findIndex((row) => row.id === id);
    assert.ok(index >= 0, `${id} tapestry row exists`);
    assert.match(map, new RegExp(`data-tapestry="${index}"(?=[^>]*data-ecosystem-target="${target}")`));
    if (!['wake-health', 'mira-relationship', 'priority-signals', 'coordination-source', 'npc-history', 'command-state', 'live-proof'].includes(id)) {
      (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, index);
      assert.match(rendered.elements.get('sheetBody')!.innerHTML, new RegExp(`ecosystem target<\\/b><span>${target}`));
    }
  }
});

test('page · source-backed tapestry rows stay wait-state when proof is blocked', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  selectInspectPane(rendered, 'system');
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string; state: string; detail: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  const blockedRows = [
    ['priority-signals', 'PRIORITY SIGNALS', 'operator-priority-signals@v1 missing or incomplete'],
    ['coordination-source', 'COORDINATION SOURCE', 'SOCIAL GAP:wait'],
    ['npc-history', 'NPC HISTORY', 'operator-npc-events@v1 missing'],
  ] as const;

  for (const [id, title, proof] of blockedRows) {
    const row = rows.find((item) => item.id === id);
    assert.equal(row?.state, 'wait', `${id} remains wait without proof`);
    assert.match(map, new RegExp(title));
    assert.match(JSON.stringify(row), new RegExp(escapeRegExp(proof)));
  }
});

test('page · source-backed tapestry rows route to proof sheets', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const expectations = [
    ['wake-health', /wake step · missing/],
    ['evidence-boxes', /evidence box · wait/],
    ['priority-signals', /decision context · wait/],
    ['coordination-source', /coordination · wait/],
    ['npc-history', /companion · wait/],
  ] as const;

  for (const [id, pattern] of expectations) {
    const index = rows.findIndex((row) => row.id === id);
    assert.ok(index >= 0, `${id} row exists`);
    (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, index);
    assert.match(rendered.elements.get('sheetBody')!.innerHTML, pattern);
  }
});

test('page · freshness tapestry gap shows derivation and push command', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const index = rows.findIndex((row) => row.id === 'freshness-gaps');

  assert.ok(index >= 0, 'freshness gap row exists');
  (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, index);

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /FRESHNESS GAPS/);
  assert.match(sheet, /derivedAt<\/b><span>2026-01-01T00:00:00.000Z/);
  assert.match(sheet, /stale threshold<\/b><span>360 minutes/);
  assert.match(sheet, /refresh command<\/b><span>quine write quests push --tenant cambium/);
});

test('page · command-state tapestry row opens missing Commands source sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const index = rows.findIndex((row) => row.id === 'command-state');

  assert.ok(index >= 0, 'command-state row exists');
  (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, index);

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /tools · status/);
  assert.match(sheet, /<h2>Org status<\/h2>/);
  assert.match(sheet, /live data unreachable · pull to refresh/);
  assert.match(sheet, /data-tool-retry="status"/);
  assert.doesNotMatch(sheet, /\/ts-|Copy command/);
});

test('page · decision-context tapestry row opens first missing decision signal', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const index = rows.findIndex((row) => row.id === 'decision-context');

  assert.ok(index >= 0, 'decision-context row exists');
  (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, index);

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /decision context · wait/);
  assert.match(sheet, /FOUNDER PREFERENCE/);
  assert.match(sheet, /founder preference signal not served/);
  assert.match(sheet, /no served evidence rows for this decision signal; it remains context, not policy authority/);
});

test('page · live proof capture plan renders as guidance, not evidence', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /IN-APP SIGNED RECEIPT/);
  assert.match(map, /1\/2 prerequisites blocked/);
  (rendered.context.openLiveProofBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /capture plan · not proof · blocked/);
  assert.match(sheet, /tg-live-proof-capture-plan/);
  assert.match(sheet, /signed-action-smoke\.json/);
  assert.match(sheet, /--write-receipt-template/);
  assert.match(sheet, /receipt stores hashes only/);
  assert.match(sheet, /in-app signed gate action receipt/);
  assert.doesNotMatch(map + sheet, /live proof ready|verified founder device|raw initData stored|browser wrote/i);
  assert.doesNotMatch(map + sheet, /DEVICE WEBVIEW PROOF|--capture-device-proof|telegram-webview\.json/);
});

test('page · wake cards prefer served visual-envelope proof over local inference', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    source: 'local-source-would-win-if-derived',
    wake: {
      source: 'quest-ledger-envelope@v1',
      steps: [
        {
          id: 'ingest',
          status: 'missing',
          detail: 'served ingest gap from fixture',
          source: 'missing',
          proof: 'served wake proof should win over envelope source',
          evidence: [],
          gap: 'served ingest gap from fixture',
        },
      ],
    },
  });
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /served ingest gap from fixture/);
  assert.doesNotMatch(map, /local-source-would-win-if-derived/);
});

test('page · wake sheet renders operator wake history without changing latest status', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    wake: {
      source: 'quest-ledger-envelope@v1',
      steps: [
        {
          id: 'viability',
          status: 'missing',
          detail: 'latest viability proof still missing',
          source: 'missing',
          proof: 'no current viability evidence served',
          evidence: [],
          gap: 'viability step is missing in current envelope',
          history: {
            source: 'operator-wake-events@v1',
            total: 2,
            status: 'mixed',
            proof: 'latest operator note says viability still missing after refresh',
            latest: {
              id: 'acme:viability:missing:2',
              stepId: 'viability',
              status: 'missing',
              source: 'operator-note',
              detail: 'operator reran refresh and viability proof was absent',
              proof: 'refresh log has no viability row',
              createdAt: '2026-06-22T01:00:00.000Z',
              target: 'wake:viability',
            },
            rows: [
              {
                id: 'acme:viability:proved:1',
                stepId: 'viability',
                status: 'proved',
                source: 'operator-note',
                detail: 'operator observed margin sweep in refresh loop',
                proof: 'refresh log shows viability sweep completed',
                createdAt: '2026-06-22T00:00:00.000Z',
                target: 'wake:viability',
              },
              {
                id: 'acme:viability:missing:2',
                stepId: 'viability',
                status: 'missing',
                source: 'operator-note',
                detail: 'operator reran refresh and viability proof was absent',
                proof: 'refresh log has no viability row',
                createdAt: '2026-06-22T01:00:00.000Z',
                target: 'wake:viability',
              },
            ],
          },
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /latest viability proof still missing/);
  const viabilityIndex = CAMBIUM_WAKE_STEPS.findIndex((step) => step.id === 'viability');
  (rendered.context.openWakeBox as (env: unknown, index: number) => void)(envelope, viabilityIndex);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /wake step · missing/);
  assert.match(sheet, /wake history/);
  assert.match(sheet, /operator-wake-events@v1 · mixed · 2 event/);
  assert.match(sheet, /latest operator note says viability still missing after refresh/);
  assert.match(sheet, /operator observed margin sweep in refresh loop/);
  assert.doesNotMatch(map + sheet, /browser wrote|current step proved by history/i);
});

test('page · missing wake sheet maps to wake-proof quine command without crowding cards', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const wakeHtml = (rendered.context.renderWake as (env: unknown) => string)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const ingestIndex = CAMBIUM_WAKE_STEPS.findIndex((step) => step.id === 'ingest');

  assert.ok(ingestIndex >= 0, 'ingest wake step exists');
  assert.match(wakeHtml, /missing source/);
  assert.doesNotMatch(wakeHtml, /current status|history count|wake-proof|quine write quests wake-event/);

  (rendered.context.openWakeBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, ingestIndex);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /wake step · missing/);
  assert.match(sheet, /current status<\/b><span>missing/);
  assert.match(sheet, /history count<\/b><span>0/);
  assert.match(sheet, /side quest target<\/b><span>wake-proof/);
  assert.match(sheet, /quine command<\/b><span>quine write quests wake-event ingest missing/);
  assert.match(sheet, /--detail &quot;[^"]+&quot; --proof &quot;[^"]+&quot; --target &quot;wake:ingest&quot; --tenant &quot;cambium&quot;/);
  assert.doesNotMatch(sheet, /raw initData|browser wrote|current step proved by history/i);
});

test('page · wake event command follows current tenant parameter', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search: '?tenant=acme' });
  const ingestIndex = CAMBIUM_WAKE_STEPS.findIndex((step) => step.id === 'ingest');

  (rendered.context.openWakeBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, ingestIndex);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /quine write quests wake-event ingest missing/);
  assert.match(sheet, /--target &quot;wake:ingest&quot; --tenant &quot;acme&quot;/);
});

test('page · proved wake sheet keeps current proof separate from operator history', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    wake: {
      source: 'quest-ledger-envelope@v1',
      steps: [
        {
          id: 'ingest',
          status: 'proved',
          detail: 'current envelope confirms quest ingestion',
          source: 'quest-ledger-envelope@v1',
          proof: 'current wake proof came from quest-ledger-envelope@v1',
          evidence: [{ label: 'ingest proof', status: 'proved', detail: 'served from current envelope' }],
          history: {
            source: 'operator-wake-events@v1',
            total: 1,
            status: 'proved',
            proof: 'operator history recorded an earlier ingest refresh',
            rows: [
              {
                id: 'acme:ingest:proved:1',
                stepId: 'ingest',
                status: 'proved',
                source: 'operator-note',
                detail: 'operator observed an ingest refresh',
                proof: 'refresh log included ingest row',
                createdAt: '2026-06-22T00:00:00.000Z',
                target: 'wake:ingest',
              },
            ],
          },
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  (rendered.context.openWakeBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /wake step · proved/);
  assert.match(sheet, /current status<\/b><span>proved/);
  assert.match(sheet, /source<\/b><span>quest-ledger-envelope@v1/);
  assert.match(sheet, /proof<\/b><span>current wake proof came from quest-ledger-envelope@v1/);
  assert.match(sheet, /event command<\/b><span>quine write quests wake-event ingest proved --detail &quot;current envelope confirms quest ingestion&quot; --proof &quot;current wake proof came from quest-ledger-envelope@v1&quot; --target &quot;wake:ingest&quot; --tenant &quot;cambium&quot;/);
  assert.match(sheet, /wake event source<\/b><span>operator-wake-events@v1/);
  assert.match(sheet, /history count<\/b><span>1/);
  assert.match(sheet, /history relation<\/b><span>operator wake history is shown separately from the current served status/);
  assert.doesNotMatch(sheet, /current proof came from history|current step proved by history|history proves current/i);
});

test('page · evidence boxes prefer served visual-envelope insights over local inference', async () => {
  const elements = await renderPageFixture({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    insights: {
      source: 'quest-ledger-evidence@v1',
      status: 'ready',
      rows: [
        {
          id: 'served-insight',
          title: 'SERVED INSIGHT',
          state: 'ready',
          detail: 'served insight from fixture',
          proof: 'served proof should win over active row evidence',
          source: 'quest-ledger',
          origin: 'completed-quest',
          quest: { arc: 'II', id: 'served-insight', status: 'complete' },
          evidence: [{ label: 'II · Served Insight', status: 'complete', detail: 'served proof should win over active row evidence' }],
        },
      ],
    },
  });
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /SERVED INSIGHT/);
  assert.match(map, /served insight from fixture/);
  assert.doesNotMatch(map, /first session unplayed/);
});

test('page · insight sheet exposes durable source, proof, origin, and evidence rows', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    insights: {
      source: 'operator-insights@v1',
      status: 'ready',
      rows: [
        {
          id: 'operator-insight-1',
          title: 'OPERATOR INSIGHT',
          state: 'ready',
          detail: 'durable insight from operator source',
          proof: 'operator proof linked to reusable evidence fragment',
          source: 'operator-insights@v1',
          origin: 'operator-insight',
          evidence: [{ label: 'operator note', status: 'ready', detail: 'source row served' }],
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  (rendered.context.openInsightBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /evidence box · ready/);
  assert.match(sheet, /OPERATOR INSIGHT/);
  assert.match(sheet, /source<\/b><span>operator-insights@v1/);
  assert.match(sheet, /origin<\/b><span>operator-insight/);
  assert.match(sheet, /proof<\/b><span>operator proof linked to reusable evidence fragment/);
  assert.match(sheet, /evidence 1<\/b><span>operator note · ready · source row served/);
  assert.doesNotMatch(sheet, /missing insight source|random reward|leaderboard/i);
});

test('page · sense cards prefer served visual-envelope signals over local inference', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    senses: {
      source: 'quest-ledger-envelope@v1',
      status: 'ready',
      rows: [
        {
          id: 'signal',
          title: 'SIGNAL',
          on: false,
          detail: 'served signal gap from fixture',
          proof: 'served proof should win over active row inference',
          source: 'missing',
          evidence: [],
          gap: 'served signal gap from fixture',
        },
        {
          id: 'memory',
          title: 'MEMORY',
          on: true,
          detail: 'served cortex proof from fixture',
          proof: 'served memory evidence',
          source: 'cortex-count',
          evidence: [{ label: 'tenant cortex memory', status: 'served', detail: '1 record' }],
        },
      ],
    },
  });
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /served signal gap from fixture/);
  assert.match(map, /served cortex proof from fixture/);
  assert.doesNotMatch(map, /I · The Calling<\/button>/);
});

test('page · lane sheets expose world log counts, ratios, stance, and gaps', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    lanes: {
      source: 'world.log',
      total: 4,
      dominant: 'micro',
      counts: { micro: 3, meso: 1, macro: 0, noesis: 0 },
      gap: null,
    },
    stance: {
      source: 'world.log',
      status: 'ready',
      sampleSize: 4,
      window: 24,
      dominant: 'micro',
      label: 'MICRO',
      confidence: 0.75,
      ratios: { micro: 0.75, meso: 0.25, macro: 0, noesis: 0 },
      counts: { micro: 3, meso: 1, macro: 0, noesis: 0 },
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const laneHtml = (rendered.context.renderLanes as (env: unknown) => string)(envelope);
  assert.match(laneHtml, /data-interaction-kind="sheet" data-source="world\.log" data-lane="micro" data-ecosystem-target="operator-policy"/);
  (rendered.context.openLaneSheet as (env: unknown, laneId: string) => void)(envelope, 'micro');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /lane · micro/);
  assert.match(sheet, /source<\/b><span>world\.log/);
  assert.match(sheet, /world\.log<\/b><span>3 world\.log lane rows/);
  assert.match(sheet, /count<\/b><span>3/);
  assert.match(sheet, /ratio<\/b><span>75%/);
  assert.match(sheet, /sample size<\/b><span>4/);
  assert.match(sheet, /stance contribution<\/b><span>75% of tenant stance sample/);
  assert.match(sheet, /recommendation<\/b><span>read-only lane evidence; no browser action/);
});

test('page · missing lane sheet has missing source, zero sample, no recommendation', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    lanes: {
      source: 'world.log',
      total: 2,
      dominant: 'meso',
      counts: { micro: 0, meso: 2, macro: 0, noesis: 0 },
      gap: null,
    },
    stance: {
      source: 'world.log',
      status: 'ready',
      sampleSize: 2,
      window: 24,
      dominant: 'meso',
      label: 'MESO',
      confidence: 1,
      ratios: { micro: 0, meso: 1, macro: 0, noesis: 0 },
      counts: { micro: 0, meso: 2, macro: 0, noesis: 0 },
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const laneHtml = (rendered.context.renderLanes as (env: unknown) => string)(envelope);
  assert.match(laneHtml, /data-interaction-kind="sheet" data-source="missing" data-lane="micro" data-ecosystem-target="operator-policy"/);
  (rendered.context.openLaneSheet as (env: unknown, laneId: string) => void)(envelope, 'micro');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /lane · micro/);
  assert.match(sheet, /source<\/b><span>missing/);
  assert.match(sheet, /world\.log<\/b><span>missing/);
  assert.match(sheet, /count<\/b><span>0/);
  assert.match(sheet, /ratio<\/b><span>0%/);
  assert.match(sheet, /sample size<\/b><span>0/);
  assert.match(sheet, /stance contribution<\/b><span>no stance contribution/);
  assert.match(sheet, /recommendation<\/b><span>no recommendation/);
});

test('page · sense sheets map ecosystem targets and clarify memory empty state', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    ledger: {
      ...NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger,
      current: null,
      rows: [],
    },
    senses: {
      source: 'missing',
      status: 'blocked',
      rows: [],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const senseHtml = (rendered.context.renderSenses as (env: unknown) => string)(envelope);
  const mappings = [
    ['signal', 'quine'],
    ['memory', 'cortex'],
    ['risk', 'operator-policy'],
    ['drift', 'operator-policy'],
  ] as const;

  for (const [id, target] of mappings) {
    assert.match(senseHtml, new RegExp(`data-interaction-kind="sheet" data-source="missing" data-sense="${id}"`));
    assert.match(senseHtml, new RegExp(`data-sense="${id}" data-ecosystem-target="${target}"`));
    (rendered.context.openSenseSheet as (env: unknown, senseId: string) => void)(envelope, id);
    const sheet = rendered.elements.get('sheetBody')!.innerHTML;
    assert.match(sheet, new RegExp(`sense · ${id}`));
    assert.match(sheet, new RegExp(`ecosystem target<\\/b><span>${target}`));
  }

  (rendered.context.openSenseSheet as (env: unknown, senseId: string) => void)(envelope, 'memory');
  const memorySheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(memorySheet, /no tenant cortex rows served/);
  assert.doesNotMatch(memorySheet, /generic unavailable|unavailable|no cortex rows<\/span>/i);
});

test('page · side quest cards render only served pure-trigger predicates', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    sideQuests: {
      source: 'pure-trigger-predicates',
      status: 'ready',
      rows: [
        {
          id: 'gate-review',
          title: 'GATE REVIEW',
          status: 'triggered',
          trigger: 'gate.openItems',
          detail: '1 open handoff awaiting founder attention',
          proof: 'THO-9: blocked',
          origin: 'paperclip-open-items',
          owner: 'founder',
          action: { kind: 'founder-review', label: 'Open signed Gate chamber', target: 'THO-9' },
          lifetime: { scope: 'until-consumed', staleAfterMinutes: 1440, detail: 'remains open until the gate decision is consumed, rerolled, or superseded' },
          completion: { kind: 'queue-consumed', proof: 'gate action is consumed with a durable approve, reroll, or superseded result' },
        },
      ],
    },
  });
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /side quests/);
  assert.match(map, /GATE REVIEW/);
  assert.match(map, /1 open handoff awaiting founder attention/);
  assert.match(PAGE, /owner/);
  assert.match(PAGE, /completion/);
  assert.doesNotMatch(map, /side quest complete|bonus|reward|hidden quest/i);
});

test('page · served side quest rows strip overclaim terms from row and sheet', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    sideQuests: {
      source: 'pure-trigger-predicates',
      status: 'ready',
      rows: [
        {
          id: 'rank-reward-row',
          title: 'HIDDEN QUEST REWARD RANK',
          status: 'triggered',
          trigger: 'bonus.leaderboard',
          detail: 'bonus leaderboard social proof',
          proof: 'reward unlocked by social proof rank',
          origin: 'leaderboard',
          owner: 'rank watcher',
          action: { kind: 'refresh', label: 'Collect bonus reward', target: 'hidden quest leaderboard' },
          lifetime: { scope: 'until-consumed', staleAfterMinutes: 1440, detail: 'bonus remains until hidden quest reward is consumed' },
          completion: { kind: 'queue-consumed', proof: 'leaderboard rank reward consumed' },
          runtime: {
            source: 'operator-side-quests@v1',
            status: 'queued',
            total: 1,
            proof: 'social proof rank event queued',
            rows: [
              {
                id: 'hidden-quest-event',
                status: 'rank',
                source: 'leaderboard',
                detail: 'bonus reward queued from social proof',
                proof: 'rank proof',
              },
            ],
          },
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /SERVED TRIGGER/);
  assert.match(map, /side quest trigger active/);

  (rendered.context.openSideQuestBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /queue effect/);
  assert.match(sheet, /queued action only; side quest ledger and registry remain unchanged until the operator consumes the queued action/);
  assert.doesNotMatch(map + sheet, /reward|bonus|hidden quest|leaderboard|rank|social proof/i);
});

test('page · side quest sheet renders operator ledger history without browser writes', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    sideQuests: {
      source: 'pure-trigger-predicates',
      status: 'ready',
      rows: [
        {
          id: 'wake-proof',
          title: 'WAKE PROOF',
          status: 'queued',
          trigger: 'wake.steps.missing',
          detail: 'QUEUED · operator queued wake evidence refresh',
          proof: 'ingest: missing source',
          origin: 'visual-fixture:no-fake-progress',
          owner: 'operator',
          action: { kind: 'refresh', label: 'Refresh quest evidence', target: 'quine write quests push' },
          lifetime: { scope: 'until-next-refresh', staleAfterMinutes: 360, detail: 'expires when the next quest envelope is pushed or the envelope becomes stale' },
          completion: { kind: 'proof-arrives', proof: 'all wake steps referenced by this row become proved or explicitly absent' },
          runtime: {
            source: 'operator-side-quests@v1',
            status: 'queued',
            total: 1,
            proof: 'wake-proof branch assigned from current visual envelope',
            latest: {
              id: 'acme:wake-proof:queued:1',
              status: 'queued',
              source: 'operator-note',
              detail: 'operator queued wake evidence refresh',
              proof: 'wake-proof branch assigned from current visual envelope',
              createdAt: '2026-06-22T00:00:00.000Z',
              target: 'wake-proof',
            },
            rows: [
              {
                id: 'acme:wake-proof:queued:1',
                status: 'queued',
                source: 'operator-note',
                detail: 'operator queued wake evidence refresh',
                proof: 'wake-proof branch assigned from current visual envelope',
                createdAt: '2026-06-22T00:00:00.000Z',
                target: 'wake-proof',
              },
            ],
          },
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /WAKE PROOF/);
  assert.match(map, /QUEUED · operator queued wake evidence refresh/);
  (rendered.context.openSideQuestBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /side quest history/);
  assert.match(sheet, /operator-side-quests@v1 · queued · 1 event/);
  assert.match(sheet, /wake-proof branch assigned from current visual envelope/);
  assert.match(sheet, /queued action only; side quest ledger and registry remain unchanged until the operator consumes the queued action/);
  assert.match(sheet, /Queue side quest/);
  assert.match(sheet, /history 1/);
  assert.doesNotMatch(map + sheet, /browser wrote|side quest complete|reward unlocked|hidden quest|leaderboard|social proof/i);
});

test('page · social cards render only served tenant coordination evidence', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'handoff-queue',
          title: 'HANDOFF QUEUE',
          state: 'ready',
          detail: '1 open tenant handoff awaiting founder review',
          proof: 'THO-9: blocked · owner Mathis',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [{ label: 'THO-9', status: 'blocked', detail: 'Review launch copy · owner Mathis' }],
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /coordination/);
  assert.match(map, /HANDOFF QUEUE/);
  assert.match(map, /1 open tenant handoff awaiting founder review/);
  (rendered.context.openSocialBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /coordination · ready/);
  assert.match(sheet, /paperclip-open-items/);
  assert.match(sheet, /tenant-handoff-only/);
  assert.match(sheet, /THO-9: blocked · owner Mathis/);
  assert.doesNotMatch(map + sheet, /leaderboard|rank|follower|social proof|popularity/i);
});

test('page · social cards reject leaderboard and generic social-proof copy', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    social: {
      source: 'coordination-evidence@v1',
      status: 'ready',
      scope: 'tenant-handoff-only',
      rows: [
        {
          id: 'generic-social-proof',
          title: 'LEADERBOARD RANK',
          state: 'ready',
          detail: 'follower popularity increased',
          proof: 'generic social-proof copy is not tenant handoff evidence',
          source: 'paperclip-open-items',
          scope: 'tenant-handoff-only',
          evidence: [{ label: 'rank', status: 'ready', detail: 'popularity signal' }],
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /SOCIAL GAP/);
  assert.match(map, /coordination rows rejected because they were not tenant handoff evidence/);
  assert.doesNotMatch(map, /LEADERBOARD RANK|follower popularity|generic social proof|social-proof|leaderboard|rank|follower|popularity/i);

  (rendered.context.openSocialBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /coordination · wait/);
  assert.match(sheet, /tenant handoff evidence must come from explicit bridge, handoff, or founder gate sources/);
  assert.doesNotMatch(sheet, /LEADERBOARD RANK|follower popularity|generic social proof|social-proof|leaderboard|rank|follower|popularity|rank · ready/i);
});

test('page · decision context renders served and gap rows without changing policy', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    policy: {
      source: 'operator-policy',
      status: 'ready',
      action: 'Review gate item THO-9: Review launch copy',
      title: 'NEXT ACTION',
      detail: 'THO-9 · blocked · blocked queue priority · critical risk · blocks-delivery dependency',
      blockers: [],
      cautions: ['founder must still choose approve or reroll inside the signed Gate flow'],
      requiredSignals: ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal'],
      rulesVersion: 'operator-policy@v1.4',
    },
    decisionContext: {
      source: 'decision-context@v1',
      status: 'ready',
      served: 2,
      gaps: 1,
      rows: [
        {
          id: 'owner-load',
          title: 'OWNER LOAD',
          state: 'served',
          detail: 'Mathis 2 · Paperclip 1',
          proof: 'THO-9: owner Mathis · THO-8: owner Paperclip · THO-7: owner Mathis',
          source: 'paperclip-open-items',
          scope: 'tenant-only',
          evidence: [{ label: 'Mathis', status: 'served', detail: '2 open handoffs' }],
        },
        {
          id: 'economic-risk',
          title: 'ECONOMIC RISK',
          state: 'served',
          detail: 'brief accepted · contract signed · deposit pending · amount not served',
          proof: 'project evidence serves commitment state, but no amount/currency risk score',
          source: 'project-evidence',
          scope: 'project-only',
          evidence: [{ label: 'deposit', status: 'served', detail: 'deposit pending' }],
        },
        {
          id: 'founder-preference',
          title: 'FOUNDER PREFERENCE',
          state: 'gap',
          detail: 'founder preference signal not served',
          proof: 'no founder preference row exists in the current visual envelope',
          source: 'missing',
          scope: 'tenant-only',
          evidence: [],
          gap: 'founder preference missing',
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /decision context/);
  assert.match(map, /OWNER LOAD/);
  assert.match(map, /Mathis 2 · Paperclip 1/);
  assert.match(map, /ECONOMIC RISK/);
  assert.match(map, /brief accepted · contract signed · deposit pending · amount not served/);
  assert.match(map, /NEXT ACTION/);
  assert.match(map, /Review gate item THO-9: Review launch copy/);

  (rendered.context.openDecisionContextBox as (env: unknown, index: number) => void)(envelope, 0);
  const servedSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(servedSheet, /decision context · ready/);
  assert.match(servedSheet, /paperclip-open-items/);
  assert.match(servedSheet, /tenant-only/);
  assert.match(servedSheet, /THO-9: owner Mathis/);
  assert.match(servedSheet, /evidence 1/);

  (rendered.context.openDecisionContextBox as (env: unknown, index: number) => void)(envelope, 2);
  const gapSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(gapSheet, /decision context · wait/);
  assert.match(gapSheet, /not policy authority/);

  (rendered.context.openPolicyBox as (env: unknown) => void)(envelope);
  const policySheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(policySheet, /Review gate item THO-9: Review launch copy/);
  assert.doesNotMatch(policySheet, /Mathis 2|brief accepted|founder preference|economic risk/i);
});

test('page · branch stories render branches, arcs, missions, KPIs, gates, and proof without fake readiness', async () => {
  const branchGap = {
    id: 'credentials-blocked',
    status: 'blocked',
    detail: 'Credentials: Shopify storefront/admin access required',
    source: 'gate-ledger',
  };
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      status: 'partial',
      total: 1,
      active: 1,
      blocked: 1,
      activeBranchId: 'fitcheck',
      rows: [{
        branchId: 'fitcheck',
        productId: 'fitcheck',
        name: 'Fitcheck',
        role: 'Supervised product branch',
        arcId: 'fitcheck-supervised-launch-hardening',
        arcTitle: 'Supervised Launch Hardening',
        vision: { statement: 'Move a Shopify fashion merchant from demo interest to supervised pilot.' },
        icp: { primary: 'Shopify fashion brand founder' },
        kpis: [{
          kpiId: 'fitcheck-qualified-demo',
          label: 'Qualified merchant demo',
          survival: 'one qualified merchant completes demo or reservation flow',
          betterThanSurvival: 'one merchant schedules supervised pilot from the flow',
          source: 'lead handler and founder note',
          currentState: 'pending',
        }],
        questline: [{ id: 'quest-1', title: 'Run authenticated Shopify widget QA', status: 'queued' }],
        missions: [{
          missionId: 'fitcheck-shopify-qa',
          title: 'Run authenticated Shopify widget QA',
          type: 'proof',
          owner: 'founder/codex',
          gate: 'Credentials',
          proofRequired: 'screenshot plus widget event log',
          dispatchTarget: 'hermes',
        }],
        gates: [{ gate: 'Credentials', status: 'blocked', requiredProof: 'Shopify storefront/admin access and approved runtime action route' }],
        proofPaths: [{
          proofId: 'fitcheck-shopify-widget-proof',
          sourcePath: 'future Shopify QA screenshot and event receipt',
          validates: 'product-page try-on works under authenticated conditions',
          promotes: 'keeps supervised branch active; no autonomy promotion',
        }],
        promotion: {
          state: 'supervised-branch',
          currentGate: 'Shopify Dodo privacy QA outreach and first merchant proof',
          rule: 'Do not call Fitcheck autonomous until proof packet is complete.',
        },
        controls: {
          ui: {
            headline: 'Fitcheck',
            currentFrontier: 'Supervised launch hardening: Shopify, Dodo, privacy, QA, outreach, and first merchant proof remain the live gates.',
            missionVerb: 'Run authenticated Shopify widget QA',
            narrativeVoice: 'Precise operator voice',
            blockedCopy: 'Do not claim app-store approval, conversion lift, unattended operation, or real merchant outcome until evidenced.',
          },
          approvals: [{
            permission: 'Shopify storefront/admin access',
            status: 'blocked',
            requiredApproval: 'founder provides authenticated route/session',
            failureMode: 'widget QA cannot be verified live',
          }],
        },
        source: {
          tenant: 'cambium',
          schema: 'cambium.product_branch_packet.v1',
          indexFile: 'docs/plans/product-branches/index.md',
          packetFile: 'docs/plans/product-branches/fitcheck.md',
        },
        gaps: [branchGap],
      }],
      gaps: [branchGap],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const map = rendered.elements.get('mapwrap')!.innerHTML;

  assert.match(map, /branch packets/);
  assert.match(map, /missions/);
  assert.match(map, /KPIs/);
  assert.match(map, /gates/);
  assert.match(map, /proof paths/);
  assert.match(map, /Fitcheck/);
  assert.match(map, /Run authenticated Shopify widget QA/);
  assert.match(map, /Qualified merchant demo/);
  assert.match(map, /Credentials/);
  assert.match(map, /fitcheck-shopify-widget-proof/);
  assert.match(map, /data-interaction-kind="sheet"/);
  assert.match(map, /data-source="product-branch-packets@v1"/);
  assert.match(map, /data-ecosystem-target="product-branches"/);

  (rendered.context.openBranchMissionSheet as (env: unknown, branchIndex: number, missionIndex: number) => void)(envelope, 0, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /branch mission · fitcheck/);
  assert.match(sheet, /data-component="BranchMissionSheet"/);
  assert.match(sheet, /data-component="MissionCard"/);
  assert.match(sheet, /data-component="QuestlineTimeline"/);
  assert.match(sheet, /data-component="ProofList"/);
  assert.match(sheet, /data-component="KpiPulse"/);
  assert.match(sheet, /branch-sheet-glance/);
  assert.match(sheet, /Arc<\/b>Supervised Launch Hardening/);
  assert.match(sheet, /Mission<\/b>fitcheck-shopify-qa · Run authenticated Shopify widget QA/);
  assert.match(sheet, /KPI 1 · Qualified merchant demo/);
  assert.match(sheet, /Gate<\/b>Credentials · blocked/);
  assert.match(sheet, /Proof required<\/b>screenshot plus widget event log/);
  assert.match(sheet, /Promotion<\/b>supervised-branch/);
  assert.match(sheet, /Branch source<\/b><span>docs\/plans\/product-branches\/fitcheck\.md/);
  assert.match(sheet, /Gap 1 · blocked/);
  assert.match(sheet, /Credentials: Shopify storefront\/admin access required/);
  assert.doesNotMatch(map + sheet, /autonomous ready|organ service ready|production verified|live proof ready|all branches complete|100% success|shipped|launched/i);
});

test('page · gate priority renders as review-only next action', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    policy: {
      source: 'operator-policy',
      status: 'ready',
      action: 'Review gate item THO-9: Review launch copy',
      title: 'NEXT ACTION',
      detail: 'THO-9 · blocked · blocked queue priority · critical risk · blocks-delivery dependency',
      blockers: [],
      cautions: ['founder must still choose approve or reroll inside the signed Gate flow'],
      requiredSignals: ['gate item evidence', 'gate consequences', 'gate idempotency', 'gate queue priority', 'gate risk signal', 'gate dependency signal'],
      rulesVersion: 'operator-policy@v1.4',
    },
  });
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /NEXT ACTION/);
  assert.match(map, /Review gate item THO-9: Review launch copy/);
  assert.match(map, /critical risk · blocks-delivery dependency/);
  assert.doesNotMatch(map, /approve THO-9 for Paperclip execution/);
  assert.doesNotMatch(map, /reroll THO-9 and request revision before execution/);
});

test('page · skill labor cards render conservative tiers and sample gaps', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 2,
      rows: [
        {
          id: 'cambium-new-labor',
          status: 'candidate',
          uses: 1,
          successes: 1,
          failures: 0,
          successRate: 1,
          declining: false,
          tier: 'unproven',
          tierLabel: 'UNPROVEN',
          sampleSize: 1,
          minimum: 3,
          recentRate: 1,
          recentWindow: 1,
          promotion: {
            status: 'blocked',
            label: 'NO PROMOTION',
            detail: 'need 3 uses for tier; found 1',
            requiredApproval: true,
          },
          gap: 'need 3 uses for tier; found 1',
          updated: 4,
        },
        {
          id: 'cambium-declining-proof',
          status: 'validated',
          uses: 3,
          successes: 1,
          failures: 2,
          successRate: 0.33,
          declining: true,
          tier: 'declining',
          tierLabel: 'DECLINING',
          sampleSize: 3,
          minimum: 3,
          recentRate: 0.33,
          recentWindow: 3,
          promotion: {
            status: 'blocked',
            label: 'NO PROMOTION',
            detail: 'recent success 33% below 50% over 3 uses',
            requiredApproval: true,
          },
          gap: 'recent success 33% below 50% over 3 uses',
          updated: 3,
        },
      ],
    },
  });
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /UNPROVEN · need 3 uses for tier; found 1/);
  assert.match(map, /DECLINING · recent success 33% below 50% over 3 uses/);
  assert.match(map, /promotion: NO PROMOTION/);
  assert.doesNotMatch(map, /candidate · 1 uses · 100% success/);
});

test('page · skill promotion cards require founder approval before production', async () => {
  const rendered = await renderPageFixtureContext({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 2,
      rows: [
        {
          id: 'cambium-founder-review',
          status: 'validated',
          uses: 5,
          successes: 5,
          failures: 0,
          successRate: 1,
          declining: false,
          tier: 'reliable',
          tierLabel: 'RELIABLE',
          sampleSize: 5,
          minimum: 3,
          recentRate: 1,
          recentWindow: 5,
          promotion: {
            status: 'founder-review',
            label: 'FOUNDER REVIEW',
            detail: 'eligible for production review; founder approval required',
            requiredApproval: true,
          },
          updated: 5,
        },
        {
          id: 'cambium-production-approved',
          status: 'production',
          uses: 5,
          successes: 5,
          failures: 0,
          successRate: 1,
          declining: false,
          tier: 'production',
          tierLabel: 'PRODUCTION',
          sampleSize: 5,
          minimum: 3,
          recentRate: 1,
          recentWindow: 5,
          promotion: {
            status: 'approved',
            label: 'PRODUCTION',
            detail: 'founder-approved production skill with healthy telemetry',
            requiredApproval: false,
          },
          updated: 4,
        },
      ],
    },
  });
  selectInspectPane(rendered, 'system');
  const elements = rendered.elements;
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /cambium-founder-review/);
  assert.match(map, /promotion: FOUNDER REVIEW/);
  assert.match(map, /founder approval required/);
  assert.match(map, /cambium-production-approved/);
  assert.match(map, /promotion: PRODUCTION/);
  assert.doesNotMatch(map, /auto-promoted|automatic production|promoted automatically/i);
});

test('page · skill promotion sheet exposes signed founder review queue action', () => {
  for (const m of ['skillPromotionAct', 'promote-skill', 'Queue founder review', 'Queues skill promotion review', 'skill registry remains unchanged']) {
    assert.ok(PAGE.includes(m), `page has skill promotion queue marker ${m}`);
  }
});

test('page · skill labor sheet exposes full telemetry and source path', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 1,
      rows: [{
        id: 'cambium-founder-review',
        status: 'validated',
        uses: 5,
        successes: 5,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'reliable',
        tierLabel: 'RELIABLE',
        sampleSize: 5,
        minimum: 3,
        recentRate: 0.8,
        recentWindow: 5,
        promotion: {
          status: 'founder-review',
          label: 'FOUNDER REVIEW',
          detail: 'eligible for production review; founder approval required',
          requiredApproval: true,
        },
        updated: 5,
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /status<\/b><span>validated/);
  assert.match(sheet, /tier<\/b><span>RELIABLE/);
  assert.match(sheet, /uses<\/b><span>5/);
  assert.match(sheet, /success rate<\/b><span>100%/);
  assert.match(sheet, /recent rate<\/b><span>80%/);
  assert.match(sheet, /sample minimum<\/b><span>5\/3 uses/);
  assert.match(sheet, /promotion status<\/b><span>founder-review · FOUNDER REVIEW · founder approval required/);
  assert.match(sheet, /source path<\/b><span>\.operator\/cambium\.skills\.json/);
});

test('page · agent skill sheet exposes versioned role loadout details', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 1,
      rows: [{
        id: 'hermes-github-repo-issue-ops',
        status: 'candidate',
        uses: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        declining: false,
        tier: 'unproven',
        tierLabel: 'UNPROVEN',
        sampleSize: 0,
        minimum: 3,
        recentRate: 0,
        recentWindow: 0,
        promotion: {
          status: 'blocked',
          label: 'NO PROMOTION',
          detail: 'need 3 uses for tier; found 0',
          requiredApproval: true,
        },
        agentSkill: {
          format: 'cambium.skill-registry.agent-skill.v1',
          skillId: 'github-repo-issue-ops',
          version: '0.1.0',
          miniAppArea: 'skills',
          registryTarget: '.operator/<tenant>.skills.json',
          readCommands: ['github.repo.inspect', 'github.issue.read'],
          writeCommands: ['github.issue.create', 'github.issue.comment'],
          roleSubsets: {
            engineer: { version: '0.1.0', permissions: ['read', 'write'], commands: ['github.issue.create'] },
            hermes: { version: '0.1.0', permissions: ['read', 'dispatch'], commands: ['github.repo.inspect'] },
          },
          boundaries: ['Write operations require manual command context and audit receipt.'],
        },
        gap: 'need 3 uses for tier; found 0',
        updated: 1,
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /loadout version<\/b><span>0\.1\.0/);
  assert.match(sheet, /skill id<\/b><span>github-repo-issue-ops/);
  assert.match(sheet, /read commands<\/b><span>github\.repo\.inspect, github\.issue\.read/);
  assert.match(sheet, /write commands<\/b><span>github\.issue\.create, github\.issue\.comment/);
  assert.match(sheet, /engineer<\/b><span>v0\.1\.0 · read, write · github\.issue\.create/);
  assert.match(sheet, /hermes<\/b><span>v0\.1\.0 · read, dispatch · github\.repo\.inspect/);
  assert.match(sheet, /boundary 1<\/b><span>Write operations require manual command context and audit receipt\./);
});

test('page · skill cards show domain, game layer, and action groups', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 1,
      rows: [{
        id: 'hermes-gtm-distribution-ops',
        status: 'candidate',
        uses: 1,
        successes: 1,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'learning',
        tierLabel: 'LEARNING',
        sampleSize: 1,
        minimum: 3,
        recentRate: 1,
        recentWindow: 1,
        promotion: { status: 'observe', label: 'OBSERVE', detail: 'needs more proof', requiredApproval: true },
        agentSkill: {
          format: 'cambium.skill-registry.agent-skill.v1',
          skillId: 'gtm-distribution-ops',
          version: '0.1.0',
          domain: 'gtm',
          gameLayer: 'delivery',
          iconKey: 'megaphone',
          invocationKinds: ['topic-signal', 'approval-gate'],
          branches: ['fitcheck', 'client-delivery'],
          actionGroups: [{ id: 'distribution-loop', label: 'Distribution loop', purpose: 'Move proof into channel actions.', actionIds: ['gtm.channel.inspect', 'gtm.outreach.draft'], state: 'gated' }],
          miniAppArea: 'skills',
          registryTarget: '.operator/<tenant>.skills.json',
          readCommands: ['gtm.channel.inspect'],
          writeCommands: ['gtm.outreach.draft'],
          roleSubsets: {
            hermes: { version: '0.1.0', permissions: ['read', 'dispatch'], commands: ['gtm.channel.inspect'], purpose: 'Route GTM signals.' },
            synthesist: { version: '0.1.0', permissions: ['read', 'write'], commands: ['gtm.outreach.draft'], purpose: 'Draft supervised GTM handoffs.' },
          },
          boundaries: ['Public GTM publication requires founder approval.'],
        },
        updated: 1,
      }],
    },
  };

  const rendered = await renderPageFixtureContext(envelope);
  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /domain<\/b><span>gtm/);
  assert.match(sheet, /game layer<\/b><span>delivery/);
  assert.match(sheet, /invocations<\/b><span>topic-signal, approval-gate/);
  assert.match(sheet, /branches<\/b><span>fitcheck, client-delivery/);
  assert.match(sheet, /Distribution loop<\/b><span>gated · gtm\.channel\.inspect, gtm\.outreach\.draft/);
  assert.match(sheet, /hermes<\/b><span>v0\.1\.0 · read, dispatch · gtm\.channel\.inspect · Route GTM signals\./);
});

test('page · missing skill sheet maps gaps to operator store and quine write skills', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'missing',
      total: 0,
      rows: [],
      gap: 'skill registry missing',
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /skill registry missing/);
  assert.match(sheet, /source path<\/b><span>\.operator\/cambium\.skills\.json/);
  assert.match(sheet, /registry proof<\/b><span>missing registry proof; source path is a gap target only/);
  assert.match(sheet, /gap action · \.operator\/cambium\.skills\.json · quine write skills forge --tenant cambium/);
  assert.doesNotMatch(sheet, /data-promote-skill/);
});

test('page · skill promotion sheet explains consequence reversibility and founder approval', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 1,
      rows: [{
        id: 'cambium-founder-review',
        status: 'validated',
        uses: 5,
        successes: 5,
        failures: 0,
        successRate: 1,
        declining: false,
        tier: 'reliable',
        tierLabel: 'RELIABLE',
        sampleSize: 5,
        minimum: 3,
        recentRate: 1,
        recentWindow: 5,
        promotion: {
          status: 'founder-review',
          label: 'FOUNDER REVIEW',
          detail: 'eligible for production review; founder approval required',
          requiredApproval: true,
        },
        updated: 5,
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;

  assert.match(sheet, /consequence<\/b><span>founder review may promote cambium-founder-review to production after operator consumption/);
  assert.match(sheet, /reversibility<\/b><span>queued promotion can be superseded until consumed; skill registry remains unchanged/);
  assert.match(sheet, /idempotency key<\/b><span>promote-skill:cambium:cambium-founder-review/);
  assert.match(sheet, /founder approval<\/b><span>required before production; operator consumer re-checks telemetry/);
  assert.match(sheet, /data-promote-skill="1"/);
});

test('page · production and declining skill sheets stay read-only', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 2,
      rows: [
        {
          id: 'cambium-production-approved',
          status: 'production',
          uses: 8,
          successes: 8,
          failures: 0,
          successRate: 1,
          declining: false,
          tier: 'production',
          tierLabel: 'PRODUCTION',
          sampleSize: 8,
          minimum: 3,
          recentRate: 1,
          recentWindow: 5,
          promotion: {
            status: 'approved',
            label: 'PRODUCTION',
            detail: 'founder-approved production skill with healthy telemetry',
            requiredApproval: false,
          },
          updated: 6,
        },
        {
          id: 'cambium-declining-proof',
          status: 'validated',
          uses: 4,
          successes: 1,
          failures: 3,
          successRate: 0.25,
          declining: true,
          tier: 'declining',
          tierLabel: 'DECLINING',
          sampleSize: 4,
          minimum: 3,
          recentRate: 0.25,
          recentWindow: 4,
          promotion: {
            status: 'blocked',
            label: 'NO PROMOTION',
            detail: 'recent success 25% below 50% over 4 uses',
            requiredApproval: true,
          },
          gap: 'recent success 25% below 50% over 4 uses',
          updated: 5,
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const productionSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(productionSheet, /registry proof<\/b><span>\.operator\/cambium\.skills\.json/);
  assert.match(productionSheet, /read-only · skill registry remains the authority/);
  assert.doesNotMatch(productionSheet, /data-promote-skill/);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 1);
  const decliningSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(decliningSheet, /caution · declining skills cannot be promoted from the mini app/);
  assert.match(decliningSheet, /promotion status<\/b><span>blocked · NO PROMOTION · founder approval required/);
  assert.doesNotMatch(decliningSheet, /data-promote-skill/);
});

test('page · contradictory skill promotion markers stay read-only on cards and sheets', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    skills: {
      source: 'skill-registry',
      total: 2,
      rows: [
        {
          id: 'cambium-production-stale-review',
          status: 'production',
          uses: 8,
          successes: 8,
          failures: 0,
          successRate: 1,
          declining: false,
          tier: 'production',
          tierLabel: 'PRODUCTION',
          sampleSize: 8,
          minimum: 3,
          recentRate: 1,
          recentWindow: 5,
          promotion: {
            status: 'founder-review',
            label: 'FOUNDER REVIEW',
            detail: 'stale review marker should not reopen production action',
            requiredApproval: true,
          },
          updated: 6,
        },
        {
          id: 'cambium-declining-stale-review',
          status: 'validated',
          uses: 5,
          successes: 1,
          failures: 4,
          successRate: 0.2,
          declining: true,
          tier: 'declining',
          tierLabel: 'DECLINING',
          sampleSize: 5,
          minimum: 3,
          recentRate: 0.2,
          recentWindow: 5,
          promotion: {
            status: 'founder-review',
            label: 'FOUNDER REVIEW',
            detail: 'stale review marker should not override decline',
            requiredApproval: true,
          },
          gap: 'recent success 20% below 50% over 5 uses',
          updated: 6,
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  const map = rendered.elements.get('mapwrap')!.innerHTML;

  assert.doesNotMatch(map, /data-signed-action-entrypoint="promote-skill"/);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 0);
  const productionSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(productionSheet, /read-only · skill registry remains the authority/);
  assert.doesNotMatch(productionSheet, /data-promote-skill/);

  (rendered.context.openSkillBox as (env: unknown, index: number) => void)(envelope, 1);
  const decliningSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(decliningSheet, /caution · declining skills cannot be promoted from the mini app/);
  assert.doesNotMatch(decliningSheet, /data-promote-skill/);
});

test('page · Mira companion card renders only served relationship evidence', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    npc: {
      source: 'cortex-memory',
      relationships: [
        {
          id: 'mira',
          status: 'inferred',
          detail: '1/1 tenant cortex memories mention Mira or ICP signals',
          proof: 'acme:mira:resonance-1: positioning · mira',
          advice: {
            status: 'ready',
            label: 'REVIEW ADVICE',
            detail: 'review Mira positioning evidence',
            proof: 'operator note references Mira safely',
            action: { kind: 'review', label: 'Review Mira positioning', target: 'npc:mira' },
          },
          history: {
            source: 'operator-npc-events@v1',
            total: 1,
            contradictions: 0,
            rows: [{
              id: 'acme:mira:advice:1',
              kind: 'advice',
              source: 'operator-note',
              detail: 'Mira profile signal from founder positioning review',
              evidence: 'operator note references Mira safely',
              createdAt: '2026-06-22T00:00:00.000Z',
            }],
          },
          stage: {
            id: 'sighted',
            label: 'SIGHTED',
            detail: 'tenant cortex has one Mira/ICP evidence event',
            confidence: 1,
          },
          events: [
            {
              id: 'acme:mira:resonance-1',
              kind: 'positioning',
              source: 'tenant-cortex-memory',
              detail: 'mira',
              ts: 3,
            },
          ],
          sampleSize: 1,
          scope: 'tenant-cortex-only',
          evidence: ['acme:mira:resonance-1', 'positioning'],
        },
        {
          id: 'founder-npc',
          status: 'missing',
          detail: 'founder memory not served yet',
          proof: 'no inherited founder arcs served',
          advice: {
            status: 'blocked',
            label: 'NO ADVICE',
            detail: 'no durable founder NPC advice event served',
            proof: 'no durable founder NPC events served',
            action: { kind: 'collect-evidence', label: 'Record NPC evidence', target: 'quine write quests npc-event founder-npc' },
          },
          history: {
            source: 'missing',
            total: 0,
            contradictions: 0,
            rows: [],
          },
          stage: {
            id: 'missing',
            label: 'MISSING',
            detail: 'no inherited founder arc memory served',
            confidence: 0,
          },
          events: [],
          scope: 'founder-arcs',
        },
      ],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  const map = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(map, /MIRA/);
  assert.match(map, /SIGHTED/);
  assert.match(map, /1\/1 tenant cortex memories mention Mira or ICP signals/);
  assert.match(PAGE, /stage/);
  assert.match(PAGE, /proof/);
  assert.doesNotMatch(map, /relationship level|trusted advisor|partner|affinity/i);

  (rendered.context.openNpcBox as (env: unknown, index: number) => void)(envelope, 0);
  const miraSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(miraSheet, /ecosystem targets<\/b><span>cortex · operator-npc-events/);
  assert.match(miraSheet, /event count<\/b><span>1/);
  assert.match(miraSheet, /contradiction count<\/b><span>0/);
  assert.match(miraSheet, /scope<\/b><span>tenant-cortex-only/);
  assert.match(miraSheet, /proof<\/b><span>acme:mira:resonance-1: positioning · mira/);
  assert.match(miraSheet, /advice action<\/b><span>review · Review Mira positioning · npc:mira/);
  assert.match(miraSheet, /advice proof<\/b><span>operator note references Mira safely/);

  (rendered.context.openNpcBox as (env: unknown, index: number) => void)(envelope, 1);
  const founderSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(founderSheet, /ecosystem targets<\/b><span>quest-ledger · operator-npc-events/);
  assert.match(founderSheet, /advice action<\/b><span>collect-evidence · Record NPC evidence · quine write quests npc-event founder-npc/);
});

test('page · companion advice sheet renders served hold action with target and proof', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    npc: {
      source: 'operator-npc-events',
      relationships: [{
        id: 'mira',
        status: 'inferred',
        detail: 'durable NPC events ask the operator to hold advice',
        proof: 'operator hold note served',
        stage: {
          id: 'needs-review',
          label: 'NEEDS REVIEW',
          detail: 'operator hold event exists',
          confidence: 0,
        },
        events: [],
        history: {
          source: 'operator-npc-events@v1',
          total: 1,
          contradictions: 0,
          rows: [],
        },
        advice: {
          status: 'blocked',
          label: 'HOLD ADVICE',
          detail: 'hold advice until founder resolves missing evidence',
          proof: 'operator hold note served',
          action: { kind: 'hold', label: 'Hold advice', target: 'npc:mira' },
        },
        scope: 'tenant-cortex-only',
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope);

  (rendered.context.openNpcBox as (env: unknown, index: number) => void)(envelope, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /advice action<\/b><span>hold · Hold advice · npc:mira/);
  assert.match(sheet, /advice proof<\/b><span>operator hold note served/);
  assert.match(sheet, /review target<\/b><span>npc:mira/);
});

test('page · NPC history smoke flows from quine write to companion sheet', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { quests, buildVisualEnvelope } = await import('../../../bin/quine/hyphae/quests.ts');
  const { questLedger } = await import('../../../bin/operator/quests/quests.ts');
  const tmp = fs.mkdtempSync('/tmp/cambium-test-');
  const ctx = { root: tmp, vaultRoot: tmp } as any;
  const ledger = questLedger({});

  await quests.write?.([
    'npc-event',
    'mira',
    'advice',
    '--detail',
    'Mira profile signal from founder positioning review',
    '--evidence',
    'operator note references founder positioning review',
    '--advice',
    'review Mira positioning before the next founder handoff',
    '--target',
    'npc:mira',
    '--tenant',
    'acme',
  ], ctx);
  const visual = buildVisualEnvelope(ctx, 'acme', {}, ledger, { source: 'npc-history-smoke', derivedAt: '2026-06-22T00:00:00.000Z' });
  const envelope = {
    schema: 1,
    derivedAt: '2026-06-22T00:00:00.000Z',
    source: 'npc-history-smoke',
    tenant: 'acme',
    beats: [],
    openItems: [],
    commands: null,
    ...visual,
    ledger: {
      completed: ledger.completed,
      total: ledger.total,
      current: ledger.current ? { arc: ledger.current.arc, id: ledger.current.id, title: ledger.current.title, narration: ledger.current.narration } : null,
      rows: ledger.rows.map((r) => ({ arc: r.quest.arc, id: r.quest.id, title: r.quest.title, status: r.status, evidence: r.evidence })),
    },
  };
  const rendered = await renderPageFixtureContext(envelope);
  selectInspectPane(rendered, 'system');
  assert.match(rendered.elements.get('mapwrap')!.innerHTML, /SIGHTED/);
  (rendered.context.openNpcBox as (env: unknown, index: number) => void)(envelope, 0);
  const adviceSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(adviceSheet, /REVIEW ADVICE/);
  assert.match(adviceSheet, /operator-npc-events@v1/);
  assert.match(adviceSheet, /event count<\/b><span>1/);
  assert.match(adviceSheet, /contradiction count<\/b><span>0/);
  assert.match(adviceSheet, /scope<\/b><span>tenant-cortex-only/);
  assert.match(adviceSheet, /proof<\/b><span>acme:mira:advice:/);
  assert.match(adviceSheet, /advice action<\/b><span>review · Review advice · npc:mira/);
  assert.match(adviceSheet, /review target<\/b><span>npc:mira/);
  assert.match(adviceSheet, /history 1/);
  assert.match(adviceSheet, /review Mira positioning before the next founder handoff/);
  assert.doesNotMatch(adviceSheet, /relationship level|trusted advisor|partner|partnership|affinity/i);

  const first = JSON.parse(fs.readFileSync(path.join(tmp, '.operator', 'acme.npc-events.jsonl'), 'utf8').trim());
  await quests.write?.([
    'npc-event',
    'mira',
    'contradiction',
    '--detail',
    'Mira profile signal conflicts with newer founder note',
    '--evidence',
    'newer founder note rejects the previous ICP assumption',
    '--contradicts',
    first.id,
    '--tenant',
    'acme',
  ], ctx);
  const contradictionVisual = buildVisualEnvelope(ctx, 'acme', {}, ledger, { source: 'npc-history-smoke', derivedAt: '2026-06-22T00:00:00.000Z' });
  const contradictionEnvelope = { ...envelope, ...contradictionVisual };
  const contradictionRendered = await renderPageFixtureContext(contradictionEnvelope);
  selectInspectPane(contradictionRendered, 'system');
  assert.match(contradictionRendered.elements.get('mapwrap')!.innerHTML, /NEEDS REVIEW/);
  (contradictionRendered.context.openNpcBox as (env: unknown, index: number) => void)(contradictionEnvelope, 0);
  const blockedSheet = contradictionRendered.elements.get('sheetBody')!.innerHTML;
  assert.match(blockedSheet, /ADVICE BLOCKED/);
  assert.match(blockedSheet, /1 contradiction/);
  assert.match(blockedSheet, /contradiction count<\/b><span>1/);
  assert.match(blockedSheet, /advice is blocked by contradiction; review target npc:mira/);
  assert.match(blockedSheet, /advice action<\/b><span>review · Review NPC contradiction · npc:mira/);
  assert.match(blockedSheet, /newer founder note rejects the previous ICP assumption/);
});

test('page · animations ride transform and opacity only', () => {
  // keyframes must not animate layout properties
  const keyframeBodies = PAGE.match(/@keyframes[\s\S]*?\}\s*\}/g) ?? [];
  for (const k of keyframeBodies) {
    assert.ok(!/\b(top|left|width|height|margin)\s*:/.test(k), `layout prop animated in ${k.slice(0, 40)}`);
  }
  assert.ok(keyframeBodies.length >= 3, 'has the motion set');
});


// ── W4 · the founder gate (Ed25519 third-party validation) ──────────────

import { webcrypto } from 'node:crypto';
import { buildDataCheckString, validateInitData } from './handler.ts';
import type { GateConfig } from './handler.ts';

const subtle = (globalThis.crypto ?? webcrypto).subtle;

async function makeSignedInitData(opts: {
  botId: string; userId: string; authDate: number; tamper?: boolean;
}): Promise<{ initData: string; pubKeyHex: string }> {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fields = new URLSearchParams();
  fields.set('auth_date', String(opts.authDate));
  fields.set('user', JSON.stringify({ id: Number(opts.userId), first_name: 'Founder' }));
  fields.set('query_id', 'AAtest');
  const { dcs } = buildDataCheckString(fields.toString(), opts.botId);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(
    opts.tamper ? dcs + 'tampered' : dcs,
  )));
  const b64url = Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  fields.set('signature', b64url);
  fields.set('hash', 'deadbeef');
  return { initData: fields.toString(), pubKeyHex };
}

const NOW = 1_750_000_000_000;
const TEST_BOT_ID = '900000001';
const TEST_FOUNDER_A = '200000001';
const TEST_FOUNDER_B = '200000002';

const gateCfg = (pubKeyHex: string): GateConfig => ({
  botId: TEST_BOT_ID, pubKeyHex, founderIds: [TEST_FOUNDER_A, TEST_FOUNDER_B], now: () => NOW,
});

test('gate · valid founder signature passes and identifies the founder', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_A, authDate: NOW / 1000 - 30 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.deepEqual(verdict, { ok: true, userId: TEST_FOUNDER_A });
});

test('gate · tampered payload is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_A, authDate: NOW / 1000 - 30, tamper: true });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /bad signature/);
});

test('gate · stale auth_date is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_A, authDate: NOW / 1000 - 4000 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /stale/);
});

test('gate · non-founder with a valid signature is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: '555', authDate: NOW / 1000 - 30 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /not a founder/);
});

test('gate · queue → list → consume roundtrip over the worker routes', async () => {
  const kv = fakeKv();
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_B, authDate: NOW / 1000 - 10 });
  const deps = { kv, pushToken: 't', gate: gateCfg(pubKeyHex), uuid: () => 'fixed-uuid', now: () => '2026-06-22T00:00:00.000Z' };

  const queued = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'approve',
      subject: 'THO-9',
      note: 'ship it',
      evidence: 'handoff THO-9 is pending founder review',
      consequence: 'approve THO-9 for org execution',
      reversibility: 'reversible until consumed',
      idempotencyKey: 'approve:cambium:THO-9',
      initData,
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.match(queued.body, /fixed-uuid/);
  assert.equal(body(queued).idempotencyKey, 'approve:cambium:THO-9');
  assert.equal(body(queued).duplicate, false);

  const duplicate = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'approve',
      subject: 'THO-9',
      evidence: 'handoff THO-9 is pending founder review',
      consequence: 'approve THO-9 for org execution',
      reversibility: 'reversible until consumed',
      idempotencyKey: 'approve:cambium:THO-9',
      initData,
    }),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).queued, 'fixed-uuid');
  assert.equal(body(duplicate).duplicate, true);

  const unauth = await handle(req('GET', '/internal/gate/cambium'), deps);
  assert.equal(unauth.status, 401);

  const listed = await handle(req('GET', '/internal/gate/cambium', { headers: { authorization: 'Bearer t' } }), deps);
  assert.equal(listed.status, 200);
  const actions = JSON.parse(listed.body).actions;
  assert.equal(actions.length, 1);
  assert.equal(actions[0].founderId, TEST_FOUNDER_B);
  assert.equal(actions[0].kind, 'approve');
  assert.equal(actions[0].evidence, 'handoff THO-9 is pending founder review');
  assert.equal(actions[0].consequence, 'approve THO-9 for org execution');
  assert.equal(actions[0].reversibility, 'reversible until consumed');
  assert.equal(actions[0].idempotencyKey, 'approve:cambium:THO-9');

  const consumed = await handle(req('POST', '/internal/gate/cambium/consume', {
    headers: { authorization: 'Bearer t' }, body: JSON.stringify({ id: 'fixed-uuid', result: 'done' }),
  }), deps);
  assert.equal(consumed.status, 200);

  const relisted = await handle(req('GET', '/internal/gate/cambium', { headers: { authorization: 'Bearer t' } }), deps);
  assert.equal(JSON.parse(relisted.body).actions.length, 0, 'consumed actions leave the queue');
});

test('gate · signed skill promotion queues an idempotent founder review action', async () => {
  const kv = fakeKv();
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_B, authDate: NOW / 1000 - 10 });
  const deps = { kv, pushToken: 't', gate: gateCfg(pubKeyHex), uuid: () => 'skill-promote-uuid', now: () => '2026-06-22T00:00:00.000Z' };

  const queued = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'promote-skill',
      subject: 'cambium-founder-review',
      evidence: 'validated · RELIABLE · promotion: FOUNDER REVIEW · founder approval required',
      consequence: 'founder review may promote cambium-founder-review to production after operator consumption',
      reversibility: 'queued promotion can be superseded until consumed; skill registry remains unchanged',
      idempotencyKey: 'promote-skill:cambium:cambium-founder-review',
      initData,
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).queued, 'skill-promote-uuid');
  assert.equal(body(queued).kind, 'promote-skill');
  assert.equal(body(queued).duplicate, false);

  const duplicate = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'promote-skill',
      subject: 'cambium-founder-review',
      evidence: 'duplicate should not replace queued evidence',
      idempotencyKey: 'promote-skill:cambium:cambium-founder-review',
      initData,
    }),
  }), deps);
  assert.equal(body(duplicate).queued, 'skill-promote-uuid');
  assert.equal(body(duplicate).duplicate, true);

  const listed = await handle(req('GET', '/internal/gate/cambium', { headers: { authorization: 'Bearer t' } }), deps);
  const actions = JSON.parse(listed.body).actions;
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'promote-skill');
  assert.equal(actions[0].subject, 'cambium-founder-review');
  assert.match(actions[0].evidence, /FOUNDER REVIEW/);
  assert.match(actions[0].consequence, /promote cambium-founder-review to production/);
  assert.match(actions[0].reversibility, /registry remains unchanged/);
  assert.equal(actions[0].idempotencyKey, 'promote-skill:cambium:cambium-founder-review');
});

test('gate · signed side quest action queues without mutating side quest history', async () => {
  const kv = fakeKv();
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_B, authDate: NOW / 1000 - 10 });
  const deps = { kv, pushToken: 't', gate: gateCfg(pubKeyHex), uuid: () => 'side-quest-uuid', now: () => '2026-06-22T00:00:00.000Z' };

  const queued = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'queue-side-quest',
      subject: 'wake-proof',
      evidence: 'wake-proof: ingest missing · viability missing',
      consequence: 'queue side quest wake-proof for operator follow-up; no browser-side completion',
      reversibility: 'queued side quest can be superseded until consumed; side quest ledger remains unchanged',
      idempotencyKey: 'queue-side-quest:cambium:wake-proof',
      initData,
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).queued, 'side-quest-uuid');
  assert.equal(body(queued).kind, 'queue-side-quest');
  assert.equal(body(queued).duplicate, false);

  const duplicate = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'queue-side-quest',
      subject: 'wake-proof',
      evidence: 'duplicate should not replace side quest proof',
      idempotencyKey: 'queue-side-quest:cambium:wake-proof',
      initData,
    }),
  }), deps);
  assert.equal(body(duplicate).queued, 'side-quest-uuid');
  assert.equal(body(duplicate).duplicate, true);

  const listed = await handle(req('GET', '/internal/gate/cambium', { headers: { authorization: 'Bearer t' } }), deps);
  const actions = JSON.parse(listed.body).actions;
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'queue-side-quest');
  assert.equal(actions[0].subject, 'wake-proof');
  assert.match(actions[0].evidence, /wake-proof/);
  assert.match(actions[0].consequence, /no browser-side completion/);
  assert.match(actions[0].reversibility, /side quest ledger remains unchanged/);
  assert.equal(actions[0].idempotencyKey, 'queue-side-quest:cambium:wake-proof');
});

test('gate · missing initData (outside Telegram) is a clean 401', async () => {
  const kv = fakeKv();
  const { pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_B, authDate: NOW / 1000 });
  const r = await handle(req('POST', '/api/gate/cambium', { body: JSON.stringify({ kind: 'approve', subject: 'x' }) }),
    { kv, pushToken: 't', gate: gateCfg(pubKeyHex) });
  assert.equal(r.status, 401);
  assert.match(r.body, /inside Telegram/);
});

test('bridge · admin queues and Paperclip acknowledges directives', async () => {
  const kv = fakeKv();
  const deps = { kv, bridgeToken: 'bridge', now: () => '2026-06-21T00:00:00.000Z', uuid: () => 'dir-1' };

  const missingAuth = await handle(req('GET', '/v1/bridge/inbox/cambium'), deps);
  assert.equal(missingAuth.status, 401);

  const upstream = await signBridge('bridge', {
    id: 'up-1',
    timestamp: '2026-06-21T00:00:00.000Z',
    direction: 'upstream',
    tenantId: 'cambium',
    memberId: 'mathis',
    payload: { kind: 'status', text: 'ready' },
  });
  const unsignedIngest = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ ...upstream, signature: undefined }),
  }), deps);
  assert.equal(unsignedIngest.status, 401);

  const ingest = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(upstream),
  }), deps);
  assert.equal(ingest.status, 200);

  const inbox = await handle(req('GET', '/v1/bridge/inbox/cambium', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(inbox.status, 200);
  assert.equal(body(inbox).count, 1);
  assert.equal(body(inbox).messages[0].receivedAt, '2026-06-21T00:00:00.000Z');

  const directive = await handle(req('POST', '/v1/bridge/directive', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'mathis', payload: { kind: 'sync', target: { memberId: 'mathis' } } }),
  }), deps);
  assert.equal(directive.status, 200);
  assert.equal(body(directive).id, 'dir-1');

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(pending.status, 200);
  assert.equal(body(pending).count, 1);

  const ack = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'mathis', ids: ['dir-1'] }),
  }), deps);
  assert.equal(ack.status, 200);
  assert.equal(body(ack).acked, 1);

  const afterAck = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(body(afterAck).count, 0);
});

test('business slice · D1 lease renders one immutable task through authenticated artifact readback', async (t) => {
  const now = '2026-07-17T09:00:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  const intake = businessTaskIntake();
  const created = await handle(req('POST', '/v1/bridge/business-tasks', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(intake),
  }), harness.deps);
  assert.equal(created.status, 200, created.body);
  const taskIdentity = body(created);
  assert.equal(taskIdentity.status, 'queued');
  assert.equal(taskIdentity.businessTaskId, taskIdentity.gsdTaskId);
  assert.match(taskIdentity.gsdTaskId, /^gsd-service-agreement-[a-f0-9]{32}$/);

  const replay = await handle(req('POST', '/v1/bridge/business-tasks', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(intake),
  }), harness.deps);
  assert.equal(replay.status, 200);
  assert.equal(body(replay).duplicate, true);
  assert.equal(body(replay).directiveId, taskIdentity.directiveId);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_business_tasks').get() as any).count, 1);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_directives WHERE id = ?').get(taskIdentity.directiveId) as any).count, 1);

  const queuedOperatorReceipt = await handle(req(
    'GET',
    `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}/operator-receipt`,
    { headers: { authorization: 'Bearer assign-only' } },
  ), harness.deps);
  assert.equal(queuedOperatorReceipt.status, 200);
  assert.deepEqual(body(queuedOperatorReceipt), {
    ok: true,
    schema: 'thoughtseed.business_task_operator_receipt.v1',
    gsdTaskId: taskIdentity.gsdTaskId,
    workflowId: 'thoughtseed.legal.service-agreement.draft.v1',
    status: 'queued',
    synthetic: true,
    externalAction: 'none',
    updatedAt: now,
    artifact: null,
  });

  const directive = await harness.bridgeStore.getDirective('shesh', taskIdentity.directiveId) as any;
  assert.equal(directive.payload.command, 'service_agreement.draft.render');
  assert.equal(directive.payload.input.gsdTaskId, taskIdentity.gsdTaskId);
  const memberToken = await issueScopedMemberToken(harness.deps, 'shesh');
  const otherToken = await issueScopedMemberToken(harness.deps, 'mathis');
  const adminOperatorReceipt = await handle(req(
    'GET',
    `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}/operator-receipt`,
    { headers: { authorization: 'Bearer bridge' } },
  ), harness.deps);
  assert.equal(adminOperatorReceipt.status, 200);
  const memberOperatorReceipt = await handle(req(
    'GET',
    `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}/operator-receipt`,
    { headers: { authorization: `Bearer ${memberToken}` } },
  ), harness.deps);
  assert.equal(memberOperatorReceipt.status, 200);
  const claim = executionClaim({
    directiveId: taskIdentity.directiveId,
    idempotencyKey: intake.idempotencyKey,
    executionId: testExecutionId('shesh', taskIdentity.directiveId, String(intake.idempotencyKey)),
  });
  const claimed = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(claim),
  }), harness.deps);
  assert.equal(claimed.status, 200, claimed.body);
  assert.equal(body(claimed).status, 'claimed');
  assert.equal((harness.db.prepare('SELECT status FROM bridge_business_tasks').get() as any).status, 'leased');

  const artifactBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode('synthetic-docx-canary')]);
  const artifactDigest = `sha256:${createHash('sha256').update(artifactBytes).digest('hex')}`;
  const artifactId = `artifact_${createHash('sha256')
    .update(`${taskIdentity.gsdTaskId}\u0000thoughtseed.hermes.native_execution.v1`)
    .digest('hex')
    .slice(0, 32)}`;
  const upload = {
    schema: 'thoughtseed.hermes.business_artifact_upload.v1',
    memberId: 'shesh',
    directiveId: taskIdentity.directiveId,
    idempotencyKey: intake.idempotencyKey,
    executionId: claim.executionId,
    runnerId: claim.runnerId,
    hostIdentity: claim.hostIdentity,
    claimId: body(claimed).claimId,
    fencingToken: body(claimed).fencingToken,
    attempt: body(claimed).attempt,
    artifact: {
      id: artifactId,
      fileName: `Service_Agreement_${artifactId}_DRAFT.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      byteLength: artifactBytes.byteLength,
      digest: artifactDigest,
      base64: Buffer.from(artifactBytes).toString('base64'),
    },
    workflowId: 'thoughtseed.legal.service-agreement.draft.v1',
    gsdTaskId: taskIdentity.gsdTaskId,
    approvalState: 'awaiting_human_approval',
    synthetic: true,
    externalAction: 'none',
    policies: {
      contentPolicyId: 'anthropic-skills:thoughtseed-contract-generator@1',
      contentPolicyDigest: 'sha256:b34b87ac93681a9acb4127ebdeb3030eccf4f9b6e2f8119b21326fdf3ffe9a13',
      rendererPolicyId: 'thoughtseed.docx.legal.a4.v1',
      rendererPolicyDigest: 'sha256:ab11e39c744ac22dd6ee88b50f7fd275954ce4dd6bebd44590844b1f6ac6f453',
      fallbackPolicy: 'fail_closed',
    },
  };
  const staleUpload = structuredClone(upload);
  staleUpload.fencingToken = 'fence_stale';
  const stale = await handle(req('POST', '/v1/bridge/executions/artifact', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(staleUpload),
  }), harness.deps);
  assert.equal(stale.status, 409);
  assert.equal(body(stale).code, 'stale_fence');
  assert.equal(harness.r2Puts(), 0);

  const stored = await handle(req('POST', '/v1/bridge/executions/artifact', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(upload),
  }), harness.deps);
  assert.equal(stored.status, 200, stored.body);
  assert.equal(body(stored).stored, true);
  assert.equal(body(stored).duplicate, false);
  assert.equal(body(stored).receipt.digest, artifactDigest);
  assert.equal(harness.r2Puts(), 1);

  const duplicateArtifact = await handle(req('POST', '/v1/bridge/executions/artifact', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(upload),
  }), harness.deps);
  assert.equal(duplicateArtifact.status, 200);
  assert.equal(body(duplicateArtifact).duplicate, true);
  assert.equal(harness.r2Puts(), 1);

  const forbiddenTaskRead = await handle(req('GET', `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}`, {
    headers: { authorization: `Bearer ${otherToken}` },
  }), harness.deps);
  assert.equal(forbiddenTaskRead.status, 403);
  const assignmentRawTaskRead = await handle(req('GET', `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}`, {
    headers: { authorization: 'Bearer assign-only' },
  }), harness.deps);
  assert.equal(assignmentRawTaskRead.status, 403);
  const assignmentRawArtifactRead = await handle(req('GET', `/v1/bridge/business-artifacts/${taskIdentity.gsdTaskId}`, {
    headers: { authorization: 'Bearer assign-only' },
  }), harness.deps);
  assert.equal(assignmentRawArtifactRead.status, 403);
  const forbiddenOperatorReceipt = await handle(req(
    'GET',
    `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}/operator-receipt`,
    { headers: { authorization: `Bearer ${otherToken}` } },
  ), harness.deps);
  assert.equal(forbiddenOperatorReceipt.status, 403);
  const taskRead = await handle(req('GET', `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}`, {
    headers: { authorization: `Bearer ${memberToken}` },
  }), harness.deps);
  assert.equal(taskRead.status, 200);
  assert.equal(body(taskRead).task.status, 'artifact_stored');

  const artifactRead = await handle(req('GET', `/v1/bridge/business-artifacts/${taskIdentity.gsdTaskId}`, {
    headers: { authorization: `Bearer ${memberToken}` },
  }), harness.deps);
  assert.equal(artifactRead.status, 200);
  assert.equal(body(artifactRead).receipt.digest, artifactDigest);
  assert.deepEqual(Buffer.from(body(artifactRead).base64, 'base64'), Buffer.from(artifactBytes));

  const receipt = body(stored).receipt;
  const attestationIdentity = {
    schema: 'thoughtseed.hermes.execution_attestation.v1',
    executionId: claim.executionId,
    directiveId: claim.directiveId,
    idempotencyKey: claim.idempotencyKey,
    runnerId: claim.runnerId,
    hostIdentity: claim.hostIdentity,
    command: 'service_agreement.draft.render',
    status: 'executed',
    exitCode: 0,
    inputDigest: testDigestCanonical(directive.payload.input),
    outputDigest: artifactDigest,
    businessReceipt: receipt,
    startedAt: now,
    finishedAt: '2026-07-17T09:00:01.000Z',
  };
  const outcome = {
    schema: 'thoughtseed.hermes.execution_outcome.v1',
    memberId: 'shesh',
    directiveId: claim.directiveId,
    idempotencyKey: claim.idempotencyKey,
    executionId: claim.executionId,
    runnerId: claim.runnerId,
    claimId: body(claimed).claimId,
    fencingToken: body(claimed).fencingToken,
    attempt: body(claimed).attempt,
    status: 'executed',
    attestation: {
      ...attestationIdentity,
      id: `att_${createHash('sha256').update(canonicalJson(attestationIdentity)).digest('hex').slice(0, 32)}`,
    },
  };
  const recorded = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(outcome),
  }), harness.deps);
  assert.equal(recorded.status, 200, recorded.body);
  assert.equal(body(recorded).terminal, true);
  assert.equal((harness.db.prepare('SELECT status FROM bridge_business_tasks').get() as any).status, 'awaiting_human_approval');

  const terminalOperatorReceipt = await handle(req(
    'GET',
    `/v1/bridge/business-tasks/${taskIdentity.gsdTaskId}/operator-receipt`,
    { headers: { authorization: 'Bearer assign-only' } },
  ), harness.deps);
  assert.equal(terminalOperatorReceipt.status, 200);
  assert.deepEqual(body(terminalOperatorReceipt), {
    ok: true,
    schema: 'thoughtseed.business_task_operator_receipt.v1',
    gsdTaskId: taskIdentity.gsdTaskId,
    workflowId: 'thoughtseed.legal.service-agreement.draft.v1',
    status: 'awaiting_human_approval',
    synthetic: true,
    externalAction: 'none',
    updatedAt: now,
    artifact: {
      artifactId,
      digest: artifactDigest,
      byteLength: artifactBytes.byteLength,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      approvalState: 'awaiting_human_approval',
    },
  });

  const ack = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify({ memberId: 'shesh', ids: [taskIdentity.directiveId] }),
  }), harness.deps);
  assert.equal(ack.status, 200);
  assert.equal(body(ack).acked, 1);
  assert.equal(harness.r2Objects.size, 1);
});

test('business slice · intake rejects external actions and unknown fields before D1 writes', async (t) => {
  const harness = nativeExecutionHarness(() => '2026-07-17T09:10:00.000Z');
  t.after(() => harness.db.close());
  const external = await handle(req('POST', '/v1/bridge/business-tasks', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(businessTaskIntake({ intent: 'Send the agreement for signature' })),
  }), harness.deps);
  assert.equal(external.status, 400);
  assert.equal(body(external).code, 'external_action_forbidden');
  const unknown = await handle(req('POST', '/v1/bridge/business-tasks', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(businessTaskIntake({ arbitrary: 'forbidden' })),
  }), harness.deps);
  assert.equal(unknown.status, 400);
  const memberToken = await issueScopedMemberToken(harness.deps, 'shesh');
  const memberCreate = await handle(req('POST', '/v1/bridge/business-tasks', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(businessTaskIntake()),
  }), harness.deps);
  assert.equal(memberCreate.status, 403);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_business_tasks').get() as any).count, 0);
  assert.equal(harness.r2Puts(), 0);
});

test('business slice · Telegram operator source is additive and remains synthetic-only', async (t) => {
  const harness = nativeExecutionHarness(() => '2026-07-17T10:00:00.000Z');
  t.after(() => harness.db.close());
  const intake = businessTaskIntake({
    source: 'hermes-telegram-operator',
    memberId: 'hermes-runner',
    idempotencyKey: 'telegram-service-agreement-canary-20260717-default',
    approval: {
      scope: 'internal_canary_draft_only',
      observationId: 'approval_telegram_20260717_default',
      observedAt: '2026-07-17T00:00:00.000Z',
    },
  });
  const response = await handle(req('POST', '/v1/bridge/business-tasks', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(intake),
  }), harness.deps);
  assert.equal(response.status, 200, response.body);
  const stored = await harness.businessStore.getTask(body(response).gsdTaskId);
  assert.equal(stored?.request.source, 'hermes-telegram-operator');
  assert.equal(stored?.memberId, 'hermes-runner');
  assert.equal(stored?.synthetic, true);
  assert.equal(stored?.externalAction, 'none');
});

test('bridge execution · scoped member claim is atomic and replays the winning lease', async (t) => {
  const now = '2026-07-15T10:00:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  await queueNativeDirective(harness.deps, { id: 'native-race', idempotencyKey: 'native-race' });
  const memberToken = await issueScopedMemberToken(harness.deps);
  const claims = [
    executionClaim({
      directiveId: 'native-race',
      idempotencyKey: 'native-race',
      executionId: 'exec_native_race_a',
    }),
    executionClaim({
      directiveId: 'native-race',
      idempotencyKey: 'native-race',
      executionId: 'exec_native_race_b',
      runnerId: 'hermes-ec2-runner-02',
      hostIdentity: 'hermes-ec2-02',
    }),
  ];
  const responses = await Promise.all(claims.map((claim) => handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(claim),
  }), harness.deps)));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const winnerIndex = responses.findIndex((response) => response.status === 200);
  const winner = body(responses[winnerIndex]);
  const busy = body(responses[1 - winnerIndex]);
  assert.equal(winner.status, 'claimed');
  assert.ok(Date.parse(winner.leaseExpiresAt) > Date.parse(now));
  assert.equal(winner.runnerId, claims[winnerIndex].runnerId);
  assert.equal(winner.hostIdentity, claims[winnerIndex].hostIdentity);
  assert.equal(busy.status, 'busy');
  assert.ok(busy.retryAfterMs > 0);

  const replay = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(claims[winnerIndex]),
  }), harness.deps);
  assert.equal(replay.status, 200);
  assert.equal(body(replay).claimId, winner.claimId);
  assert.equal(body(replay).fencingToken, winner.fencingToken);
  assert.equal(body(replay).attempt, 1);
  assert.equal(body(replay).leaseExpiresAt, winner.leaseExpiresAt);

  const outOfScope = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(executionClaim({ memberId: 'mathis', directiveId: 'native-race', idempotencyKey: 'native-race' })),
  }), harness.deps);
  assert.equal(outOfScope.status, 403);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_executions').get() as any).count, 1);
});

test('bridge execution · live owner rotation stays busy without disclosing claim credentials', async (t) => {
  const now = '2026-07-15T10:03:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  await queueNativeDirective(harness.deps, { id: 'native-owner-live', idempotencyKey: 'native-owner-live' });
  const original = executionClaim({
    directiveId: 'native-owner-live',
    idempotencyKey: 'native-owner-live',
  });
  const first = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(original),
  }), harness.deps);
  assert.equal(first.status, 200);

  const rotated = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      ...original,
      runnerId: 'hermes-ec2-runner-02',
      hostIdentity: 'hermes-ec2-02',
    }),
  }), harness.deps);
  assert.equal(rotated.status, 409);
  assert.equal(body(rotated).status, 'busy');
  assert.ok(body(rotated).retryAfterMs > 0);
  assert.equal(body(rotated).claimId, undefined);
  assert.equal(body(rotated).fencingToken, undefined);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_execution_claims').get() as any).count, 1);
});

test('bridge execution · expired takeover rotates fencing and rejects the stale runner', async (t) => {
  let now = '2026-07-15T10:05:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  await queueNativeDirective(harness.deps, { id: 'native-fence', idempotencyKey: 'native-fence' });
  const firstClaim = executionClaim({
    directiveId: 'native-fence',
    idempotencyKey: 'native-fence',
    executionId: 'exec_native_fence_a',
  });
  const first = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(firstClaim),
  }), harness.deps);
  assert.equal(first.status, 200);

  now = '2026-07-15T10:06:01.000Z';
  const secondClaim = executionClaim({
    directiveId: 'native-fence',
    idempotencyKey: 'native-fence',
    executionId: 'exec_native_fence_b',
  });
  const second = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(secondClaim),
  }), harness.deps);
  assert.equal(second.status, 200);
  assert.equal(body(second).attempt, 2);
  assert.notEqual(body(second).fencingToken, body(first).fencingToken);
  assert.ok(Date.parse(body(second).leaseExpiresAt) > Date.parse(now));

  const supersededReplay = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(firstClaim),
  }), harness.deps);
  assert.equal(supersededReplay.status, 409);
  assert.equal(body(supersededReplay).status, 'busy');

  await queueNativeDirective(harness.deps, { id: 'native-fence-other', idempotencyKey: 'native-fence-other' });
  const reusedAcrossDirective = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionClaim({
      directiveId: 'native-fence-other',
      idempotencyKey: 'native-fence-other',
      executionId: firstClaim.executionId,
    })),
  }), harness.deps);
  assert.equal(reusedAcrossDirective.status, 409);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_execution_claims').get() as any).count, 2);

  const stale = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(firstClaim, body(first))),
  }), harness.deps);
  assert.equal(stale.status, 409);
  assert.equal(body(stale).error, 'fencing_conflict');
  assert.equal(body(stale).code, 'stale_fence');

  now = '2026-07-15T10:07:02.000Z';
  const renewed = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(secondClaim),
  }), harness.deps);
  assert.equal(renewed.status, 200, renewed.body);
  assert.equal(body(renewed).attempt, 3);
  assert.notEqual(body(renewed).fencingToken, body(second).fencingToken);
  assert.equal(body(renewed).runnerId, secondClaim.runnerId);
  assert.equal(body(renewed).hostIdentity, secondClaim.hostIdentity);

  const supersededSecondOutcome = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(secondClaim, body(second))),
  }), harness.deps);
  assert.equal(supersededSecondOutcome.status, 409);
  assert.equal(body(supersededSecondOutcome).code, 'stale_fence');

  const recorded = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(secondClaim, body(renewed))),
  }), harness.deps);
  assert.equal(recorded.status, 200);
  assert.equal(body(recorded).terminal, true);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_execution_claims').get() as any).count, 3);
});

test('bridge execution · outcome replay is idempotent and persists only redacted attestation', async (t) => {
  const now = '2026-07-15T10:10:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  await queueNativeDirective(harness.deps);
  const claim = executionClaim();
  const claimed = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(claim),
  }), harness.deps);
  assert.equal(claimed.status, 200);
  const outcome = executionOutcome(claim, body(claimed), {
    exceptionMessage: 'Bearer raw-secret-must-not-persist',
  });
  const attestationId = (outcome.attestation as any).id;
  const tampered = structuredClone(outcome) as any;
  tampered.attestation.inputDigest = `sha256:${'0'.repeat(64)}`;
  const rejectedTamper = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(tampered),
  }), harness.deps);
  assert.equal(rejectedTamper.status, 409);
  assert.equal(body(rejectedTamper).error, 'execution attestation verification failed');
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_execution_events').get() as any).count, 0);
  const first = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(outcome),
  }), harness.deps);
  const replay = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(outcome),
  }), harness.deps);
  assert.equal(first.status, 200);
  assert.deepEqual(body(first), { recorded: true, terminal: true });
  assert.equal(replay.status, 200);
  assert.deepEqual(body(replay), { recorded: true, terminal: true, duplicate: true });
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_execution_events').get() as any).count, 1);

  const stored = harness.db.prepare(`
    SELECT e.attestation_json, h.event_json
    FROM bridge_executions e
    JOIN bridge_execution_events h ON h.execution_id = e.execution_id
  `).get() as any;
  assert.doesNotMatch(`${stored.attestation_json}\n${stored.event_json}`, /Bearer|raw-secret|exception/i);

  const conflicting = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(claim, body(claimed), {
      status: 'failed',
      errorCode: 'conflicting_terminal_failure',
    })),
  }), harness.deps);
  assert.equal(conflicting.status, 409);
  assert.equal(body(conflicting).error, 'outcome_conflict');

  const mismatchedTerminalReplay = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionClaim({ executionId: 'exec_native_canary_terminal_replay' })),
  }), harness.deps);
  assert.equal(mismatchedTerminalReplay.status, 409);
  assert.equal(body(mismatchedTerminalReplay).error, 'execution_replay_mismatch');

  const terminalReplay = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionClaim({
      executionId: claim.executionId,
      runnerId: 'hermes-ec2-runner-02',
      hostIdentity: 'hermes-ec2-02',
    })),
  }), harness.deps);
  assert.equal(terminalReplay.status, 200);
  assert.equal(body(terminalReplay).status, 'terminal');
  assert.equal(body(terminalReplay).outcome.status, 'executed');
  assert.equal(body(terminalReplay).runnerId, claim.runnerId);
  assert.equal(body(terminalReplay).hostIdentity, claim.hostIdentity);
  assert.equal(body(terminalReplay).outcome.attestation.id, attestationId);
  assert.equal(body(terminalReplay).outcome.attestation.executionId, claim.executionId);
  assert.equal((harness.db.prepare('SELECT COUNT(*) AS count FROM bridge_execution_claims').get() as any).count, 1);

  const recoveredAck = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'shesh', ids: ['native-canary-1'] }),
  }), harness.deps);
  assert.equal(recoveredAck.status, 200);
  assert.equal(body(recoveredAck).acked, 1);
});

test('bridge execution · native directive identity is immutable and ACK binds the current contract', async (t) => {
  const now = '2026-07-15T10:12:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  const id = 'native-immutable';
  const originalDirective = {
    id,
    memberId: 'shesh',
    idempotencyKey: id,
    payload: {
      type: 'native_execution',
      schema: 'thoughtseed.hermes.native_execution.v1',
      command: 'canary.record',
      target: { memberId: 'shesh' },
      input: { nonce: `nonce-${id}` },
    },
  };
  const enqueue = async (directive: Record<string, unknown>) => handle(req('POST', '/v1/bridge/directive', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(directive),
  }), harness.deps);

  assert.equal((await enqueue(originalDirective)).status, 200);
  const exactReplay = await enqueue(originalDirective);
  assert.equal(exactReplay.status, 200);
  assert.equal(body(exactReplay).duplicate, true);
  assert.equal(body(exactReplay).queued, true);

  const conflicting = structuredClone(originalDirective) as any;
  conflicting.payload.input.nonce = 'nonce-conflicting-requeue';
  const conflict = await enqueue(conflicting);
  assert.equal(conflict.status, 409);
  assert.equal(body(conflict).error, 'native directive identity conflict');

  const legacyReplacement = await enqueue({
    id,
    memberId: 'shesh',
    payload: { kind: 'sync', target: { memberId: 'shesh' } },
  });
  assert.equal(legacyReplacement.status, 409);
  assert.equal(body(legacyReplacement).error, 'native directive identity conflict');
  assert.equal((await harness.bridgeStore.getDirective('shesh', id) as any).payload.input.nonce, `nonce-${id}`);

  const claim = executionClaim({ directiveId: id, idempotencyKey: id });
  const claimed = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(claim),
  }), harness.deps);
  assert.equal(claimed.status, 200);
  const outcome = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(claim, body(claimed))),
  }), harness.deps);
  assert.equal(outcome.status, 200);
  assert.equal(body(outcome).terminal, true);

  await harness.bridgeStore.putDirective('shesh', id, {
    ...conflicting,
    enqueuedAt: now,
  });
  assert.equal((await harness.bridgeStore.getDirective('shesh', id) as any).payload.input.nonce, `nonce-${id}`);

  harness.db.prepare(`
    UPDATE bridge_directives
    SET directive_json = ?
    WHERE member_id = 'shesh' AND id = ?
  `).run(JSON.stringify({ ...conflicting, enqueuedAt: now, delivered: false }), id);
  const staleProofAck = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'shesh', ids: [id] }),
  }), harness.deps);
  assert.equal(staleProofAck.status, 409);
  assert.deepEqual(body(staleProofAck).refused, [id]);
});

test('bridge execution · malformed native directives are rejected before storage', async (t) => {
  const now = '2026-07-15T10:14:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  const validPayload = {
    type: 'native_execution',
    schema: 'thoughtseed.hermes.native_execution.v1',
    command: 'canary.record',
    target: { memberId: 'shesh' },
    input: { nonce: 'nonce-valid' },
  };
  const malformed = [
    { id: 'native-bad-schema', payload: { ...validPayload, schema: 'thoughtseed.hermes.native_execution.v0' } },
    { id: 'native-bad-command', payload: { ...validPayload, command: 'shell.exec' } },
    { id: 'native-bad-target', payload: { ...validPayload, target: { memberId: 'mathis' } } },
    { id: 'native-bad-nonce', payload: { ...validPayload, input: { nonce: 'contains spaces' } } },
    { id: 'native-extra-input', payload: { ...validPayload, input: { nonce: 'valid', token: 'forbidden' } } },
    { id: 'native-bad-idempotency', idempotencyKey: 'contains spaces', payload: validPayload },
  ];
  for (const candidate of malformed) {
    const response = await handle(req('POST', '/v1/bridge/directive', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify({ memberId: 'shesh', idempotencyKey: candidate.id, ...candidate }),
    }), harness.deps);
    assert.equal(response.status, 400, `${candidate.id}: ${response.body}`);
    assert.equal(body(response).error, 'invalid native execution directive contract');
    assert.equal(await harness.bridgeStore.getDirective('shesh', candidate.id), null);
  }
});

test('bridge execution · native ACK waits for terminal outcome while legacy ACK remains compatible', async (t) => {
  const now = '2026-07-15T10:15:00.000Z';
  const harness = nativeExecutionHarness(() => now);
  t.after(() => harness.db.close());
  await queueNativeDirective(harness.deps, { id: 'native-ack', idempotencyKey: 'native-ack' });
  const legacy = await handle(req('POST', '/v1/bridge/directive', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ id: 'legacy-sync', memberId: 'shesh', payload: { kind: 'sync', target: { memberId: 'shesh' } } }),
  }), harness.deps);
  assert.equal(legacy.status, 200);

  const claim = executionClaim({
    directiveId: 'native-ack',
    idempotencyKey: 'native-ack',
  });
  const claimed = await handle(req('POST', '/v1/bridge/executions/claim', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(claim),
  }), harness.deps);
  assert.equal(claimed.status, 200);

  const mixedEarlyAck = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'shesh', ids: ['legacy-sync', 'native-ack'] }),
  }), harness.deps);
  assert.equal(mixedEarlyAck.status, 409);
  assert.deepEqual(body(mixedEarlyAck).refused, ['native-ack']);
  assert.equal((await harness.bridgeStore.listPendingDirectives('shesh', 10)).directives.length, 2);

  const legacyAck = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'shesh', ids: ['legacy-sync'] }),
  }), harness.deps);
  assert.equal(legacyAck.status, 200);
  assert.equal(body(legacyAck).acked, 1);

  const retryable = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(claim, body(claimed), {
      status: 'retryable',
      errorCode: 'temporary_canary_failure',
    })),
  }), harness.deps);
  assert.equal(retryable.status, 200);
  assert.equal(body(retryable).terminal, false);
  const retryableAck = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'shesh', ids: ['native-ack'] }),
  }), harness.deps);
  assert.equal(retryableAck.status, 409);

  const terminal = await handle(req('POST', '/v1/bridge/executions/outcome', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(executionOutcome(claim, body(claimed))),
  }), harness.deps);
  assert.equal(terminal.status, 200);
  assert.equal(body(terminal).terminal, true);

  const finalAck = await handle(req('POST', '/v1/bridge/ack', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'shesh', ids: ['native-ack'] }),
  }), harness.deps);
  assert.equal(finalAck.status, 200);
  assert.equal(body(finalAck).acked, 1);
  assert.equal((await harness.bridgeStore.listPendingDirectives('shesh', 10)).directives.length, 0);
  const stored = harness.db.prepare(`
    SELECT outcome_status, terminal, acknowledged_at
    FROM bridge_executions
    WHERE member_id = 'shesh' AND directive_id = 'native-ack'
  `).get() as any;
  assert.equal(stored.outcome_status, 'executed');
  assert.equal(stored.terminal, 1);
  assert.equal(stored.acknowledged_at, now);
});

test('bridge · Cambium emits live project task assignment directives', async () => {
  const kv = fakeKv();
  let uuidIndex = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    now: () => '2026-06-22T08:00:00.000Z',
    uuid: () => `assign-${++uuidIndex}`,
  };
  const assignment = {
    memberId: 'mathis',
    task: {
      taskId: 'task-fitcheck-brief',
      projectId: 'fitcheck-product',
      projectName: 'FitCheck Product',
      questId: 'quest-77',
      clientId: 'fitcheck',
      clientName: 'FitCheck',
      title: 'Prepare branch proof packet',
      description: 'Collect branch, PR, and preview evidence before final report.',
      priority: 'high',
      taskType: 'engineering',
      branchId: 'fitcheck',
      arcId: 'fitcheck-supervised-launch-hardening',
      missionId: 'fitcheck-shopify-qa',
      kpiIds: ['fitcheck-qualified-demo'],
      proofRequired: 'screenshot plus widget event log',
      gateId: 'credentials',
      promotionState: 'supervised-branch',
      proofFoldback: 'docs/plans/product-branches/fitcheck.md#proof-foldback',
      autonomyBoundary: 'founder approval gates remain required',
      loopId: 'fitcheck-launch-gate-loop',
      loopBoundaryColor: 'yellow',
      loopStateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
      loopStopRule: 'Stop after 3 rounds.',
      loopOneChangeRule: 'Select exactly one launch gate.',
      approvalsRequired: ['founder provides authenticated route/session'],
    },
  };

  const denied = await handle(req('POST', '/v1/bridge/assign-task', {
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(denied.status, 401);

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).id, 'assign-1');
  assert.equal(body(queued).eventId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const pendingBody = body(pending);
  assert.equal(pendingBody.count, 1);
  const directive = pendingBody.directives[0];
  assert.equal(directive.direction, 'downstream');
  assert.equal(directive.memberId, 'mathis');
  assert.equal(directive.payload.type, 'project_task_assignment');
  assert.equal(directive.payload.schema, 'thoughtseed.project_task_assignment.v1');
  assert.equal(directive.payload.source, 'cambium');
  assert.equal(directive.payload.target.memberId, 'mathis');
  assert.equal(directive.payload.task.taskId, 'task-fitcheck-brief');
  assert.equal(directive.payload.task.projectId, 'fitcheck-product');
  assert.equal(directive.payload.task.assigneeMemberId, 'mathis');
  assert.equal(directive.payload.task.priority, 'high');
  assert.equal(directive.payload.task.taskType, 'engineering');
  assert.equal(directive.payload.task.branchId, 'fitcheck');
  assert.equal(directive.payload.task.arcId, 'fitcheck-supervised-launch-hardening');
  assert.equal(directive.payload.task.missionId, 'fitcheck-shopify-qa');
  assert.deepEqual(directive.payload.task.kpiIds, ['fitcheck-qualified-demo']);
  assert.equal(directive.payload.task.proofRequired, 'screenshot plus widget event log');
  assert.equal(directive.payload.task.gateId, 'credentials');
  assert.equal(directive.payload.task.promotionState, 'supervised-branch');
  assert.equal(directive.payload.task.proofFoldback, 'docs/plans/product-branches/fitcheck.md#proof-foldback');
  assert.equal(directive.payload.task.autonomyBoundary, 'founder approval gates remain required');
  assert.equal(directive.payload.task.loopId, 'fitcheck-launch-gate-loop');
  assert.equal(directive.payload.task.loopBoundaryColor, 'yellow');
  assert.equal(directive.payload.task.loopStateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
  assert.equal(directive.payload.task.loopStopRule, 'Stop after 3 rounds.');
  assert.equal(directive.payload.task.loopOneChangeRule, 'Select exactly one launch gate.');
  assert.deepEqual(directive.payload.task.approvalsRequired, ['founder provides authenticated route/session']);
  assert.equal(directive.payload.task.eventId, body(queued).eventId);
  assert.ok(directive.payloadHash);

  const duplicate = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).id, 'assign-1');
  assert.equal(body(duplicate).duplicate, true);

  const missionConflict = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ ...assignment, task: { ...assignment.task, missionId: 'fitcheck-dodo-reservation' } }),
  }), deps);
  assert.equal(missionConflict.status, 409);
  assert.equal(body(missionConflict).eventId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');

  kv.store.set('bridge:dir:mathis:corrupt', '<!DOCTYPE html>');
  const withCorruptRecord = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(withCorruptRecord.status, 200);
  assert.equal(body(withCorruptRecord).count, 1);
  assert.equal(body(withCorruptRecord).skipped, 1);

  const conflict = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ ...assignment, task: { ...assignment.task, title: 'Changed assignment title' } }),
  }), deps);
  assert.equal(conflict.status, 409);
  assert.equal(body(conflict).eventId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');
});

test('bridge · project task assignments preserve branchMission loop metadata fallback', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    now: () => '2026-06-22T08:00:00.000Z',
    uuid: () => 'assign-loop-fallback-1',
  };
  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: {
        taskId: 'task-fitcheck-loop-fallback',
        projectId: 'fitcheck-product',
        title: 'Prepare loop fallback proof',
        branchMission: {
          loopId: 'fitcheck-launch-gate-loop',
          loopBoundaryColor: 'yellow',
          loopStateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
          loopStopRule: 'Stop after 3 rounds.',
          loopOneChangeRule: 'Select exactly one launch gate.',
        },
      },
    }),
  }), deps);
  assert.equal(queued.status, 200);

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const directive = body(pending).directives[0];
  assert.equal(directive.payload.task.loopId, 'fitcheck-launch-gate-loop');
  assert.equal(directive.payload.task.loopBoundaryColor, 'yellow');
  assert.equal(directive.payload.task.loopStateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
  assert.equal(directive.payload.task.loopStopRule, 'Stop after 3 rounds.');
  assert.equal(directive.payload.task.loopOneChangeRule, 'Select exactly one launch gate.');
});

test('bridge · scoped Hermes assignment token only enqueues task assignments', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-06-22T08:00:00.000Z',
    uuid: () => 'assign-1',
  };

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: { taskId: 'task-1', projectId: 'project-1', title: 'Scoped assignment proof' },
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).id, 'assign-1');

  const genericDirective = await handle(req('POST', '/v1/bridge/directive', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ memberId: 'mathis', payload: { type: 'manual' } }),
  }), deps);
  assert.equal(genericDirective.status, 403);

  const inbox = await handle(req('GET', '/v1/bridge/inbox/cambium', {
    headers: { authorization: 'Bearer assign-only' },
  }), deps);
  assert.equal(inbox.status, 403);
});

test('bridge · role task requires bridge auth and valid server-owned bindings before writes', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  const requestBody = JSON.stringify(roleTaskBody());
  const unauthorized = await handle(req('POST', '/v1/bridge/role-task', {
    body: requestBody,
  }), {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
    bridgeStore,
  });
  assert.equal(unauthorized.status, 401);

  const noDurableStore = await handle(req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: requestBody,
  }), {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
  });
  assert.equal(noDurableStore.status, 503);

  for (const roleTaskBindingsJson of [undefined, '{', roleTaskBindings('v1', { enabled: false })]) {
    const unavailable = await handle(req('POST', '/v1/bridge/role-task', {
      headers: { authorization: 'Bearer assign-only' },
      body: requestBody,
    }), {
      kv,
      bridgeToken: 'bridge',
      assignmentToken: 'assign-only',
      roleTaskBindingsJson,
      bridgeStore,
    });
    assert.equal(unavailable.status, 503);
  }
  const unbound = await handle(req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody({ roleId: 'research' })),
  }), {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
    bridgeStore,
  });
  assert.equal(unbound.status, 503);
  assert.equal(db.assignments.size, 0);
  assert.equal(db.directives.size, 0);
  assert.equal(db.roleTaskClaims.size, 0);
});

test('bridge · role task rejects caller routing overrides before writes', async () => {
  for (const override of [
    { memberId: 'mathis' },
    { projectId: 'other-project' },
    { binding: { memberId: 'mathis' } },
    { taskType: 'operations' },
    { task: { memberId: 'mathis' } },
  ]) {
    const kv = fakeKv();
    const db = new FakeD1Database();
    const bridgeStore = d1BridgeStore(db);
    const rejected = await handle(req('POST', '/v1/bridge/role-task', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(roleTaskBody(override)),
    }), {
      kv,
      bridgeToken: 'bridge',
      roleTaskBindingsJson: roleTaskBindings(),
      bridgeStore,
    });
    assert.equal(rejected.status, 400);
    assert.equal(db.roleTaskClaims.size, 0);
    assert.equal(db.assignments.size, 0);
    assert.equal(db.directives.size, 0);
  }
});

test('bridge · role task enforces exact schema source and bounded inputs', async () => {
  const invalidBodies = [
    roleTaskBody({ schema: 'hermes.role-task-intake.v2' }),
    roleTaskBody({ source: 'telegram-topic' }),
    roleTaskBody({ roleId: 'Engineering' }),
    roleTaskBody({ roleId: 'engineer ' }),
    roleTaskBody({ text: 'x'.repeat(1201) }),
    roleTaskBody({ idempotencyKey: 'x'.repeat(161) }),
    roleTaskBody({ idempotencyKey: 'line-one\nline-two' }),
    roleTaskBody({ actorId: 'x'.repeat(81) }),
  ];
  for (const invalidBody of invalidBodies) {
    const kv = fakeKv();
    const db = new FakeD1Database();
    const bridgeStore = d1BridgeStore(db);
    const rejected = await handle(req('POST', '/v1/bridge/role-task', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(invalidBody),
    }), {
      kv,
      bridgeToken: 'bridge',
      roleTaskBindingsJson: roleTaskBindings(),
      bridgeStore,
    });
    assert.equal(rejected.status, 400);
    assert.equal(db.roleTaskClaims.size, 0);
    assert.equal(db.assignments.size, 0);
    assert.equal(db.directives.size, 0);
  }
});

test('bridge · role task queues a bounded redacted receipt and trusted provenance', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  const fullText = 'Prepare the native routing proof packet.\nBearer super-secret must never appear in the receipt.';
  const queued = await handle(req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody({ text: fullText })),
  }), {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
    bridgeStore,
    now: () => '2026-07-14T08:00:00.000Z',
    uuid: () => 'role-task-directive-1',
  });
  assert.equal(queued.status, 200);
  const receipt = body(queued);
  assert.deepEqual(Object.keys(receipt).sort(), [
    'binding', 'correlationId', 'duplicate', 'eventId', 'id', 'idempotencyKey', 'ok', 'queued', 'schema', 'task',
  ]);
  assert.equal(receipt.schema, 'thoughtseed.role-task-receipt.v1');
  assert.equal(receipt.id, 'role-task-directive-1');
  assert.equal(receipt.queued, true);
  assert.equal(receipt.duplicate, false);
  assert.equal(receipt.binding.version, '2026-07-14.1');
  assert.equal(receipt.binding.roleId, 'engineer');
  assert.equal(receipt.binding.memberId, 'shesh');
  assert.equal(receipt.binding.projectId, 'thoughtseed-ops');
  assert.equal(receipt.task.taskType, 'engineering');
  assert.ok(receipt.task.taskId.startsWith('role-task-'));
  assert.doesNotMatch(queued.body, /super-secret|must never appear|description/i);

  const pending = await handle(req('GET', '/v1/bridge/directives/shesh', {
    headers: { authorization: 'Bearer bridge' },
  }), {
    kv,
    bridgeToken: 'bridge',
    bridgeStore,
  });
  assert.equal(pending.status, 200);
  const directive = body(pending).directives[0];
  assert.equal(directive.payload.task.description, fullText);
  assert.equal(directive.payload.task.assigneeMemberId, 'shesh');
  assert.equal(directive.payload.task.projectId, 'thoughtseed-ops');
  assert.equal(directive.payload.task.roleTaskProvenance.roleId, 'engineer');
  assert.equal(directive.payload.task.roleTaskProvenance.binding.version, '2026-07-14.1');
  assert.equal(directive.payload.task.roleTaskProvenance.idempotencyKeyHash.length, 64);
  assert.equal(directive.payload.task.roleTaskProvenance.idempotencyKey, undefined);
});

test('bridge · registry accepts all six canonical Hermes role slugs', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  const roles = ['ceo', 'scientist', 'engineer', 'designer', 'synthesist', 'hermes'];
  for (const roleId of roles) {
    const response = await handle(req('POST', '/v1/bridge/role-task', {
      headers: { authorization: 'Bearer assign-only' },
      body: JSON.stringify(roleTaskBody({
        roleId,
        idempotencyKey: `telegram-manual:${roleId}:canonical-proof`,
      })),
    }), {
      kv,
      bridgeToken: 'bridge',
      assignmentToken: 'assign-only',
      roleTaskBindingsJson: roleTaskBindings(),
      bridgeStore,
      now: () => '2026-07-14T08:03:00.000Z',
      uuid: () => `role-task-${roleId}`,
    });
    assert.equal(response.status, 200);
    assert.equal(body(response).binding.roleId, roleId);
  }
  assert.equal(db.roleTaskClaims.size, 6);
  assert.equal(db.assignments.size, 6);
  assert.equal(db.directives.size, 6);
});

test('bridge · role task replay is idempotent while payload or binding drift conflicts', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  let uuidIndex = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
    bridgeStore,
    now: () => '2026-07-14T08:05:00.000Z',
    uuid: () => `role-task-directive-${++uuidIndex}`,
  };
  const request = req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody()),
  });
  const first = await handle(request, deps);
  const replay = await handle(request, deps);
  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(body(replay).id, body(first).id);
  assert.equal(body(replay).duplicate, true);

  const changedText = await handle(req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody({ text: 'A different task for the same key.' })),
  }), deps);
  assert.equal(changedText.status, 409);

  const changedBinding = await handle(request, {
    ...deps,
    roleTaskBindingsJson: roleTaskBindings('2026-07-14.2', { memberId: 'mathis', projectId: 'other-project' }),
  });
  assert.equal(changedBinding.status, 409);
  assert.equal([...db.directives.values()].filter((row) => row.member_id === 'mathis').length, 0);
});

test('bridge · concurrent binding drift is fenced by one atomic role task claim', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const request = req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody()),
  });
  const shared = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-07-14T08:07:00.000Z',
  };
  const [first, second] = await Promise.all([
    handle(request, {
      ...shared,
      bridgeStore: d1BridgeStore(db),
      roleTaskBindingsJson: roleTaskBindings('2026-07-14.a'),
      uuid: () => 'role-task-concurrent-a',
    }),
    handle(request, {
      ...shared,
      bridgeStore: d1BridgeStore(db),
      roleTaskBindingsJson: roleTaskBindings('2026-07-14.b', { memberId: 'mathis', projectId: 'other-project' }),
      uuid: () => 'role-task-concurrent-b',
    }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(db.roleTaskClaims.size, 1);
  assert.equal(db.assignments.size, 1);
  assert.equal(db.directives.size, 1);
});

test('bridge · failed directive write repairs on retry without false queued receipt', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const inner = d1BridgeStore(db);
  let failNextDirective = true;
  const bridgeStore = {
    ...inner,
    async putDirectiveIfAbsent(memberId: string, id: string, directive: Record<string, unknown>) {
      if (failNextDirective) {
        failNextDirective = false;
        throw new Error('simulated directive write failure');
      }
      await inner.putDirectiveIfAbsent(memberId, id, directive);
    },
  };
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
    bridgeStore,
    now: () => '2026-07-14T08:10:00.000Z',
    uuid: () => 'role-task-repair-1',
  };
  const request = req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody()),
  });
  const failed = await handle(request, deps);
  assert.equal(failed.status, 500);
  assert.equal(db.assignments.size, 1);
  assert.equal(db.directives.size, 0);

  const repaired = await handle(request, deps);
  assert.equal(repaired.status, 200);
  assert.equal(body(repaired).duplicate, true);
  assert.equal(db.directives.size, 1);
  assert.equal((await inner.getDirective('shesh', 'role-task-repair-1'))?.payloadHash, [...db.assignments.values()][0].payload_hash);
});

test('bridge · delivered assignment replay never reopens its D1 directive', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    roleTaskBindingsJson: roleTaskBindings(),
    bridgeStore,
    now: () => '2026-07-14T08:15:00.000Z',
    uuid: () => 'role-task-delivered-1',
  };
  const request = req('POST', '/v1/bridge/role-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(roleTaskBody()),
  });
  const first = await handle(request, deps);
  assert.equal(first.status, 200);
  assert.equal(await bridgeStore.markDirectiveDelivered('shesh', body(first).id, '2026-07-14T08:16:00.000Z'), true);

  const replay = await handle(request, deps);
  assert.equal(replay.status, 200);
  assert.equal(body(replay).duplicate, true);
  assert.equal(body(replay).queued, false);
  assert.equal((await bridgeStore.getDirective('shesh', body(first).id))?.delivered, true);
  assert.equal((await bridgeStore.listPendingDirectives('shesh', 10)).directives.length, 0);
});

test('bridge · GitHub command route executes only through admin bridge token', async () => {
  const kv = fakeKv();
  const calls: any[] = [];
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    githubCommand: async (command: any) => {
      calls.push(command);
      return {
        ok: true,
        commandId: command.commandId,
        repo: command.repo,
        dryRun: command.dryRun === true,
        url: null,
        result: { wouldCall: '/repos/Sheshiyer/hermes-aws-ts/issues' },
      };
    },
  };
  const bodyJson = JSON.stringify({
    schema: 'hermes.github-agent-command.v1',
    skillId: 'github-repo-issue-ops',
    commandId: 'github.issue.create',
    source: 'telegram-manual',
    actorId: 'shesh',
    topicKey: 'dev',
    threadId: 862,
    repo: 'Sheshiyer/hermes-aws-ts',
    title: 'Manual command proof',
    body: 'Create the audit route',
    dryRun: true,
    approvalRequired: true,
    idempotencyKey: 'github.issue.create:sheshiyer/hermes-aws-ts:manual-command-proof',
  });

  const scopedDenied = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer assign-only' },
    body: bodyJson,
  }), deps);
  assert.equal(scopedDenied.status, 403);

  const executed = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: bodyJson,
  }), deps);
  assert.equal(executed.status, 200);
  assert.equal(body(executed).ok, true);
  assert.equal(body(executed).commandId, 'github.issue.create');
  assert.equal(body(executed).repo, 'Sheshiyer/hermes-aws-ts');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].approvalRequired, true);
  assert.equal(calls[0].topicKey, 'dev');
});

test('bridge · GitHub command route rejects bad command envelopes before execution', async () => {
  const kv = fakeKv();
  let called = false;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    githubCommand: async () => {
      called = true;
      return { ok: true, commandId: 'github.repo.inspect', repo: 'Other/repo', dryRun: true };
    },
  };

  const rejected = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      schema: 'hermes.github-agent-command.v1',
      skillId: 'github-repo-issue-ops',
      commandId: 'github.repo.inspect',
      source: 'telegram-manual',
      actorId: 'shesh',
      repo: 'Other/repo',
      dryRun: true,
      approvalRequired: false,
      idempotencyKey: 'github.repo.inspect:other/repo',
    }),
  }), deps);
  assert.equal(rejected.status, 400);
  assert.match(body(rejected).error, /allowlisted/);
  assert.equal(called, false);
});

test('bridge · GitHub command route honors injected repo allowlist and bounds executor errors', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    githubAllowedRepos: ['ThoughtseedLabs/*'],
    githubCommand: async () => {
      throw new Error('network unavailable');
    },
  };

  const response = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      schema: 'hermes.github-agent-command.v1',
      skillId: 'github-repo-issue-ops',
      commandId: 'github.repo.inspect',
      source: 'telegram-manual',
      actorId: 'shesh',
      repo: 'ThoughtseedLabs/hermes',
      dryRun: false,
      approvalRequired: false,
      idempotencyKey: 'github.repo.inspect:thoughtseedlabs/hermes',
    }),
  }), deps);

  assert.equal(response.status, 502);
  assert.equal(body(response).ok, false);
  assert.equal(body(response).repo, 'ThoughtseedLabs/hermes');
  assert.equal(body(response).error, 'GitHub command executor unreachable');
});

test('bridge · GitHub command route rejects repos outside injected allowlist', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    githubAllowedRepos: ['ThoughtseedLabs/*'],
    githubCommand: async () => {
      throw new Error('must not execute');
    },
  };

  const response = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      schema: 'hermes.github-agent-command.v1',
      skillId: 'github-repo-issue-ops',
      commandId: 'github.repo.inspect',
      source: 'telegram-manual',
      actorId: 'shesh',
      repo: 'Sheshiyer/hermes-aws-ts',
      dryRun: true,
      approvalRequired: false,
      idempotencyKey: 'github.repo.inspect:sheshiyer/hermes-aws-ts',
    }),
  }), deps);

  assert.equal(response.status, 400);
  assert.match(body(response).error, /allowlisted/);
});

const githubReadBody = JSON.stringify({
  schema: 'hermes.github-agent-command.v1',
  skillId: 'github-repo-issue-ops',
  commandId: 'github.repo.inspect',
  source: 'telegram-manual',
  actorId: 'shesh',
  repo: 'Sheshiyer/hermes-aws-ts',
  dryRun: true,
  idempotencyKey: 'github.repo.inspect:sheshiyer/hermes-aws-ts',
});

test('bridge · GitHub command route rejects missing or bad bridge credential', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    githubCommand: async () => ({ ok: true, commandId: 'github.repo.inspect', repo: 'Sheshiyer/hermes-aws-ts', dryRun: true }),
  };

  const noAuth = await handle(req('POST', '/v1/bridge/github-command', { body: githubReadBody }), deps);
  assert.equal(noAuth.status, 401);
  assert.match(body(noAuth).error, /credential/);

  const badAuth = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer not-the-bridge-token' },
    body: githubReadBody,
  }), deps);
  assert.equal(badAuth.status, 401);
});

test('bridge · GitHub command route returns 503 when no executor is configured', async () => {
  const deps = { kv: fakeKv(), bridgeToken: 'bridge' };
  const res = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: githubReadBody,
  }), deps);
  assert.equal(res.status, 503);
  assert.match(body(res).error, /executor not configured/);
});

test('bridge · GitHub command route 400s on a non-JSON body', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    githubCommand: async () => ({ ok: true, commandId: 'github.repo.inspect', repo: 'Sheshiyer/hermes-aws-ts', dryRun: true }),
  };
  const res = await handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: 'this is not json {',
  }), deps);
  assert.equal(res.status, 400);
  assert.equal(body(res).error, 'body is not JSON');
});

test('bridge · GitHub write command is idempotent across replays', async () => {
  const kv = fakeKv();
  let calls = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    githubCommand: async (c: any) => {
      calls++;
      return {
        ok: true,
        commandId: c.commandId,
        repo: c.repo,
        dryRun: false,
        status: 201,
        url: 'https://github.com/Sheshiyer/hermes-aws-ts/issues/7',
        result: { number: 7 },
      };
    },
  };
  const payload = {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      schema: 'hermes.github-agent-command.v1',
      skillId: 'github-repo-issue-ops',
      commandId: 'github.issue.create',
      source: 'telegram-manual',
      actorId: 'shesh',
      repo: 'Sheshiyer/hermes-aws-ts',
      title: 'Replay proof',
      body: 'create once',
      dryRun: false,
      approvalRequired: true,
      idempotencyKey: 'github.issue.create:replay-proof',
    }),
  };

  const first = await handle(req('POST', '/v1/bridge/github-command', payload), deps);
  assert.equal(first.status, 200);
  assert.equal(body(first).ok, true);
  assert.equal(body(first).duplicate, undefined);

  const second = await handle(req('POST', '/v1/bridge/github-command', payload), deps);
  assert.equal(second.status, 200);
  assert.equal(body(second).duplicate, true);
  assert.equal(body(second).url, 'https://github.com/Sheshiyer/hermes-aws-ts/issues/7');
  assert.equal(calls, 1); // executor fired once; the replay was served from KV
});

test('bridge · GitHub writes are rate-limited per actor and repo', async () => {
  const kv = fakeKv();
  let calls = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    nowMs: () => 1_000, // pin the window so the counter is deterministic
    githubCommand: async (c: any) => {
      calls++;
      return { ok: true, commandId: c.commandId, repo: c.repo, dryRun: false, status: 201, result: { count: calls } };
    },
  };
  const send = (idempotencyKey: string) => handle(req('POST', '/v1/bridge/github-command', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      schema: 'hermes.github-agent-command.v1',
      skillId: 'github-repo-issue-ops',
      commandId: 'github.issue.comment',
      source: 'telegram-manual',
      actorId: 'shesh',
      repo: 'Sheshiyer/hermes-aws-ts',
      issueNumber: 3,
      body: 'rate proof',
      dryRun: false,
      approvalRequired: true,
      idempotencyKey,
    }),
  }), deps);

  for (let i = 0; i < 10; i++) {
    const res = await send(`rate-${i}`);
    assert.equal(res.status, 200, `write ${i} should pass under the limit`);
  }
  const limited = await send('rate-over-limit');
  assert.equal(limited.status, 429);
  assert.match(body(limited).error, /rate limit/);
  assert.equal(calls, 10); // the over-limit write never reached the executor
});

test('bridge · scoped Hermes topic routing creates quest-linked assignments', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-06-25T13:00:00.000Z',
    uuid: () => 'assign-topic-dev-1',
  };

  const queued = await handle(req('POST', '/v1/bridge/topic-assignment', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({
      chatId: '-1002691202808',
      topicKey: 'dev',
      threadId: 862,
      sourceMessageId: '852',
      memberId: 'shesh',
      summary: 'Build route proof is stale and needs a fresh worker probe.',
      loopId: 'fitcheck-launch-gate-loop',
      loopBoundaryColor: 'yellow',
      loopStateFile: '.operator/branch-loops/fitcheck-launch-gate-loop.md',
      loopStopRule: 'Stop after 3 rounds.',
      loopOneChangeRule: 'Select exactly one launch gate.',
      skillHints: [{
        skillId: 'engineering-delivery-proof',
        domain: 'engineering',
        roleId: 'engineer',
        actionId: 'engineering.deploy.probe',
        approvalRequired: false,
        reason: 'engineering proof signal should route through delivery proof skill',
      }],
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).id, 'assign-topic-dev-1');
  assert.equal(body(queued).eventId, 'topic:thoughtseed-ops:dev:852:assigned');
  assert.deepEqual(body(queued).topic, { topicKey: 'dev', threadId: 862, questId: 'the-build' });

  const pending = await handle(req('GET', '/v1/bridge/directives/shesh', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const directive = body(pending).directives[0];
  assert.equal(directive.payload.type, 'project_task_assignment');
  assert.equal(directive.payload.task.questId, 'the-build');
  assert.equal(directive.payload.task.priority, 'high');
  assert.equal(directive.payload.task.taskType, 'engineering');
  assert.equal(directive.payload.task.assignedBy, 'hermes-topic-router');
  assert.equal(directive.payload.task.source, 'cambium-topic-routing');
  assert.equal(directive.payload.task.loopId, 'fitcheck-launch-gate-loop');
  assert.equal(directive.payload.task.loopBoundaryColor, 'yellow');
  assert.equal(directive.payload.task.loopStateFile, '.operator/branch-loops/fitcheck-launch-gate-loop.md');
  assert.equal(directive.payload.task.loopStopRule, 'Stop after 3 rounds.');
  assert.equal(directive.payload.task.loopOneChangeRule, 'Select exactly one launch gate.');
  assert.match(directive.payload.task.description, /Telegram Dev topic signal/);
  assert.deepEqual(directive.payload.task.skillHints, [{
    skillId: 'engineering-delivery-proof',
    domain: 'engineering',
    roleId: 'engineer',
    actionId: 'engineering.deploy.probe',
    approvalRequired: false,
    reason: 'engineering proof signal should route through delivery proof skill',
  }]);
});

test('bridge · topic routing validates the live Thoughtseed topic map', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-06-25T13:00:00.000Z',
    uuid: () => 'assign-topic-1',
  };

  const wrongThread = await handle(req('POST', '/v1/bridge/topic-assignment', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ topicKey: 'dev', threadId: 804, sourceMessageId: 'wrong-thread' }),
  }), deps);
  assert.equal(wrongThread.status, 400);
  assert.match(body(wrongThread).error, /topic thread mismatch/);

  const wrongChat = await handle(req('POST', '/v1/bridge/topic-assignment', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ topicKey: 'dev', chatId: '-1001', sourceMessageId: 'wrong-chat' }),
  }), deps);
  assert.equal(wrongChat.status, 400);
  assert.match(body(wrongChat).error, /not THOUGHTSEED LABS/);
});

test('bridge · Alerts topic signals become urgent operations assignments', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-06-25T13:00:00.000Z',
    uuid: () => 'assign-alerts-1',
  };

  const queued = await handle(req('POST', '/v1/bridge/topic-assignment', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({
      topicKey: 'alerts',
      threadId: 803,
      sourceMessageId: '856',
      summary: 'Cron delivery failed and needs acknowledgement.',
    }),
  }), deps);
  assert.equal(queued.status, 200);

  const pending = await handle(req('GET', '/v1/bridge/directives/shesh', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const task = body(pending).directives[0].payload.task;
  assert.equal(task.questId, 'the-ship-gate');
  assert.equal(task.priority, 'urgent');
  assert.equal(task.taskType, 'operations');
});

function iverifActionRequest() {
  return {
    schema: 'thoughtseed.action-request.v1',
    id: 'ar_iverif_autogtm_lead_gap',
    idempotencyKey: 'action-request:iverif-autogtm-leads-1',
    tenantId: 'cambium',
    status: 'proposed',
    source: 'hermes-routine-signal',
    createdAt: '2026-07-07T10:00:00.000Z',
    updatedAt: '2026-07-07T10:00:00.000Z',
    branchId: 'iverif',
    branchLabel: 'IVerif',
    projectId: 'iverif',
    projectName: 'IVerif',
    questId: 'the-handoff',
    topic: {
      chatId: '-1002691202808',
      topicKey: 'clients',
      threadId: 804,
      sourceMessageId: 'iverif-autogtm-leads-1',
    },
    title: 'Approval needed: Prepare client handoff signal',
    summary: 'iVerif AutoGTM by Explee triggered a batch of leads, but post-lead outreach/enrichment/follow-up is not configured yet. Need founder options before any send.',
    why: 'topic signal touches client, cofounder, external delivery, release, or approval-gated work',
    options: [
      {
        id: 'make-branch-task',
        label: 'Make branch task',
        consequence: 'turn the gap into a Cambium assignment with proof and stop rules',
        risk: 'low',
        requiresSignedConfirmation: false,
        resultKind: 'queue_task',
      },
      {
        id: 'draft-follow-up',
        label: 'Draft follow-up',
        consequence: 'prepare copy and next-step options for approval, with no automatic send',
        risk: 'high',
        requiresSignedConfirmation: true,
        resultKind: 'request_input',
      },
    ],
    receipts: [],
    redaction: 'safe',
  };
}

test('bridge · creates iVerif ActionRequest idempotently', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    now: () => '2026-07-07T10:00:00.000Z',
  };

  const first = await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(iverifActionRequest()),
  }), deps);
  assert.equal(first.status, 200);
  const created = body(first);
  assert.equal(created.ok, true);
  assert.equal(created.duplicate, false);
  assert.equal(created.actionRequest.branchId, 'iverif');
  assert.equal(created.actionRequest.topic.threadId, 804);

  const duplicate = await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(iverifActionRequest()),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).duplicate, true);
  assert.equal(body(duplicate).actionRequest.id, 'ar_iverif_autogtm_lead_gap');
});

test('bridge · resolves low-risk iVerif callback to queued with meaningful receipt', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    now: () => '2026-07-07T10:00:00.000Z',
  };
  await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(iverifActionRequest()),
  }), deps);

  const resolved = await handle(req('POST', '/v1/bridge/action-requests/ar_iverif_autogtm_lead_gap/resolve', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'cambium',
      optionId: 'make-branch-task',
      founderTelegramUserId: 'founder-1',
      actor: { telegramUserId: 'founder-1', chatId: '-1002691202808', threadId: 804 },
    }),
  }), deps);

  assert.equal(resolved.status, 200);
  const result = body(resolved);
  assert.equal(result.actionRequest.status, 'queued');
  assert.equal(result.actionRequest.selectedOptionId, 'make-branch-task');
  assert.equal(result.receipt.reply, 'Queued: Make branch task.');
  assert.equal(result.receipt.editCard, true);
  assert.equal(result.actionRequest.receipts.length, 1);

  const duplicate = await handle(req('POST', '/v1/bridge/action-requests/ar_iverif_autogtm_lead_gap/resolve', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'cambium',
      optionId: 'make-branch-task',
      founderTelegramUserId: 'founder-1',
      actor: { telegramUserId: 'founder-1', chatId: '-1002691202808', threadId: 804 },
    }),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).duplicate, true);
  assert.equal(body(duplicate).receipt.reply, undefined);
  assert.equal(body(duplicate).actionRequest.receipts.length, 1);
});

test('bridge · escalates high-risk iVerif callback and rejects wrong topic actor', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    now: () => '2026-07-07T10:00:00.000Z',
  };
  await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(iverifActionRequest()),
  }), deps);

  const wrongTopic = await handle(req('POST', '/v1/bridge/action-requests/ar_iverif_autogtm_lead_gap/resolve', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'cambium',
      optionId: 'draft-follow-up',
      founderTelegramUserId: 'founder-1',
      actor: { telegramUserId: 'founder-1', chatId: '-1002691202808', threadId: 797 },
    }),
  }), deps);
  assert.equal(wrongTopic.status, 403);
  assert.match(wrongTopic.body, /topic actor mismatch/);

  const escalated = await handle(req('POST', '/v1/bridge/action-requests/ar_iverif_autogtm_lead_gap/resolve', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'cambium',
      optionId: 'draft-follow-up',
      founderTelegramUserId: 'founder-1',
      actor: { telegramUserId: 'founder-1', chatId: '-1002691202808', threadId: 804 },
    }),
  }), deps);

  assert.equal(escalated.status, 200);
  const result = body(escalated);
  assert.equal(result.actionRequest.status, 'needs_signed_confirmation');
  assert.equal(result.miniAppGate.required, true);
  assert.equal(result.receipt.toast, 'Open Mini App confirmation');
  assert.match(result.receipt.reply, /Needs signed confirmation/);
});

test('gate · signed Mini App confirmation queues high-risk iVerif ActionRequest', async () => {
  const kv = fakeKv();
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: TEST_BOT_ID, userId: TEST_FOUNDER_B, authDate: NOW / 1000 - 10 });
  const deps = {
    kv,
    bridgeToken: 'bridge',
    gate: gateCfg(pubKeyHex),
    now: () => '2026-07-07T10:06:00.000Z',
  };
  await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(iverifActionRequest()),
  }), deps);
  const escalated = await handle(req('POST', '/v1/bridge/action-requests/ar_iverif_autogtm_lead_gap/resolve', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'cambium',
      optionId: 'draft-follow-up',
      founderTelegramUserId: 'founder-1',
      actor: { telegramUserId: 'founder-1', chatId: '-1002691202808', threadId: 804 },
    }),
  }), deps);
  assert.equal(body(escalated).actionRequest.status, 'needs_signed_confirmation');

  const confirmed = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'confirm-action-request',
      subject: 'ar_iverif_autogtm_lead_gap',
      actionRequestId: 'ar_iverif_autogtm_lead_gap',
      optionId: 'draft-follow-up',
      evidence: 'founder signed high-risk ActionRequest confirmation in the Mini App',
      consequence: 'queue signed Mini App confirmation for Draft follow-up; no external mutation until operator consumes the queue',
      reversibility: 'withheld until signed Mini App confirmation; reversible by choosing another option',
      idempotencyKey: 'confirm-action-request:cambium:ar_iverif_autogtm_lead_gap:draft-follow-up',
      initData,
    }),
  }), deps);
  assert.equal(confirmed.status, 200);
  const result = body(confirmed);
  assert.equal(result.queued, 'ar_iverif_autogtm_lead_gap');
  assert.equal(result.kind, 'confirm-action-request');
  assert.equal(result.duplicate, false);
  assert.equal(result.actionRequest.status, 'queued');
  assert.equal(result.actionRequest.selectedOptionId, 'draft-follow-up');
  assert.equal(result.actionRequest.receipts.length, 2);
  assert.equal(result.actionRequest.receipts[1].kind, 'gate');
  assert.equal(result.receipt.reply, 'Signed confirmation queued: Draft follow-up.');

  const duplicate = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'confirm-action-request',
      subject: 'ar_iverif_autogtm_lead_gap',
      actionRequestId: 'ar_iverif_autogtm_lead_gap',
      optionId: 'draft-follow-up',
      idempotencyKey: 'confirm-action-request:cambium:ar_iverif_autogtm_lead_gap:draft-follow-up',
      initData,
    }),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).duplicate, true);
  assert.equal(body(duplicate).actionRequest.receipts.length, 2);

  const listed = await handle(req('GET', '/v1/bridge/action-requests?tenantId=cambium&branchId=iverif', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(body(listed).rows[0].status, 'queued');
  assert.equal(body(listed).rows[0].receipts.latest.kind, 'gate');
});

test('operator gate · lists queued ActionRequests through the authenticated queue', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    pushToken: 'push',
    now: () => '2026-07-10T11:35:41.833Z',
  };
  await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      ...iverifActionRequest(),
      status: 'queued',
      selectedOptionId: 'make-branch-task',
      topic: { ...iverifActionRequest().topic, sourceMessageId: '1068' },
      receipts: [{ at: '2026-07-10T11:35:41.833Z', kind: 'callback', text: 'Queued: Make branch task.' }],
    }),
  }), deps);

  const listed = await handle(req('GET', '/internal/gate/cambium', {
    headers: { authorization: 'Bearer push' },
  }), deps);
  assert.equal(listed.status, 200);
  assert.equal(body(listed).actions.length, 1);
  assert.equal(body(listed).actions[0].kind, 'action-request');
  assert.equal(body(listed).actions[0].id, 'ar_iverif_autogtm_lead_gap');
  assert.equal(body(listed).actions[0].topic.sourceMessageId, '1068');
  assert.equal(body(listed).actions[0].status, 'queued');
});

test('operator gate · consumes queued ActionRequest once by durable request identity', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    pushToken: 'push',
    now: () => '2026-07-10T11:40:00.000Z',
  };
  await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      ...iverifActionRequest(),
      status: 'queued',
      selectedOptionId: 'make-branch-task',
      topic: { ...iverifActionRequest().topic, sourceMessageId: '1068' },
      receipts: [{ at: '2026-07-10T11:35:41.833Z', kind: 'callback', text: 'Queued: Make branch task.' }],
    }),
  }), deps);

  const first = await handle(req('POST', '/internal/gate/cambium/consume', {
    headers: { authorization: 'Bearer push' },
    body: JSON.stringify({ id: 'ar_iverif_autogtm_lead_gap', kind: 'action-request', result: 'accepted for bounded operator work' }),
  }), deps);
  assert.equal(first.status, 200);
  assert.equal(body(first).consumed, 'ar_iverif_autogtm_lead_gap');
  assert.equal(body(first).kind, 'action-request');
  assert.equal(body(first).duplicate, false);
  assert.equal(body(first).actionRequest.status, 'consumed');
  assert.equal(body(first).actionRequest.receipts.at(-1).kind, 'consume');
  assert.equal(body(first).actionRequest.receipts.at(-1).text, 'Operator consumed queued ActionRequest; no external mutation was performed by Cambium.');

  const second = await handle(req('POST', '/internal/gate/cambium/consume', {
    headers: { authorization: 'Bearer push' },
    body: JSON.stringify({ id: 'ar_iverif_autogtm_lead_gap', kind: 'action-request', result: 'different replay text must not append another receipt' }),
  }), deps);
  assert.equal(second.status, 200);
  assert.equal(body(second).duplicate, true);
  assert.equal(body(second).actionRequest.receipts.length, body(first).actionRequest.receipts.length);
  assert.equal(body(second).actionRequest.updatedAt, body(first).actionRequest.updatedAt);

  const projected = await handle(req('GET', '/v1/bridge/action-requests?tenantId=cambium', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(body(projected).rows[0].status, 'consumed');
  assert.equal(body(projected).rows[0].receipts.latest.kind, 'consume');

  const relisted = await handle(req('GET', '/internal/gate/cambium', {
    headers: { authorization: 'Bearer push' },
  }), deps);
  assert.equal(body(relisted).actions.length, 0, 'consumed ActionRequest leaves the active operator queue');
});

test('operator gate · rejects ActionRequest consumption before queued state', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    pushToken: 'push',
    now: () => '2026-07-10T11:40:00.000Z',
  };
  await handle(req('POST', '/v1/bridge/action-requests', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(iverifActionRequest()),
  }), deps);

  const rejected = await handle(req('POST', '/internal/gate/cambium/consume', {
    headers: { authorization: 'Bearer push' },
    body: JSON.stringify({ id: 'ar_iverif_autogtm_lead_gap', kind: 'action-request' }),
  }), deps);
  assert.equal(rejected.status, 409);
  assert.match(rejected.body, /status proposed cannot be consumed/);
});

test('bridge · lists redacted iVerif ActionRequests for Mini App projection', async () => {
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    now: () => '2026-07-07T10:00:00.000Z',
  };
  const records = [
    {
      ...iverifActionRequest(),
      id: 'ar_iverif_autogtm_followup_signed',
      idempotencyKey: 'action-request:iverif-autogtm-leads-signed',
      status: 'needs_signed_confirmation',
      updatedAt: '2026-07-07T10:05:00.000Z',
      selectedOptionId: 'draft-follow-up',
      receipts: [
        { at: '2026-07-07T10:05:00.000Z', kind: 'callback', text: 'Needs signed confirmation in the Mini App before Draft follow-up can run.', telegramMessageId: 901 },
      ],
    },
    {
      ...iverifActionRequest(),
      id: 'ar_iverif_autogtm_make_task',
      idempotencyKey: 'action-request:iverif-autogtm-leads-queued',
      status: 'queued',
      updatedAt: '2026-07-07T10:11:00.000Z',
      selectedOptionId: 'make-branch-task',
      receipts: [
        { at: '2026-07-07T10:11:00.000Z', kind: 'callback', text: 'Queued: Make branch task.', telegramMessageId: 902 },
      ],
    },
    {
      ...iverifActionRequest(),
      id: 'ar_iverif_autogtm_receipt_complete',
      idempotencyKey: 'action-request:iverif-autogtm-leads-complete',
      status: 'completed',
      updatedAt: '2026-07-07T10:30:00.000Z',
      selectedOptionId: 'make-branch-task',
      receipts: [
        { at: '2026-07-07T10:30:00.000Z', kind: 'complete', text: 'Completed: iVerif receipt retained for method replay.', telegramMessageId: 903 },
      ],
    },
  ];
  for (const record of records) {
    const created = await handle(req('POST', '/v1/bridge/action-requests', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(record),
    }), deps);
    assert.equal(created.status, 200);
  }

  const listed = await handle(req('GET', '/v1/bridge/action-requests?tenantId=cambium&branchId=iverif', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(listed.status, 200);
  const projection = body(listed);
  assert.equal(projection.schema, 'thoughtseed.action-request-list.v1');
  assert.equal(projection.count, 3);
  assert.equal(projection.rows[0].id, 'ar_iverif_autogtm_receipt_complete');
  assert.equal(projection.rows[1].status, 'queued');
  assert.equal(projection.rows[2].status, 'needs_signed_confirmation');
  assert.equal(projection.rows[2].topic.threadId, 804);
  assert.equal(projection.rows[2].priority.source, 'cambium-action-requests@v1');
  assert.match(projection.rows[2].rerollConsequence, /signed Mini App confirmation/);
  assert.equal(projection.rows[2].receipts.latest.kind, 'callback');

  const redacted = JSON.stringify(projection);
  assert.doesNotMatch(redacted, /-1002691202808/);
  assert.doesNotMatch(redacted, /telegramMessageId|callbackNonce|initData|tgWebAppData|Bearer|bridge-token/i);
});

test('fabric bridge · handler accepts external bridge and ledger stores', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  const fabricLedger = d1FabricLedgerStore(db);
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    bridgeStore,
    fabricLedger,
    now: () => '2026-06-24T09:00:00.000Z',
    uuid: () => 'assign-d1-1',
  };

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: { taskId: 'task-d1', projectId: 'project-d1', title: 'D1 store assignment proof' },
    }),
  }), deps);
  assert.equal(queued.status, 200);
  assert.equal(body(queued).id, 'assign-d1-1');

  const duplicate = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: { taskId: 'task-d1', projectId: 'project-d1', title: 'D1 store assignment proof' },
    }),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).duplicate, true);

  const pending = await bridgeStore.listPendingDirectives('mathis', 10);
  assert.equal(pending.directives.length, 1);
  assert.equal(pending.directives[0].payload.task.taskId, 'task-d1');
});

test('fabric bridge · normal D1 migrations apply to an empty database and back D1 stores', async () => {
  const db = new DatabaseSync(':memory:');
  applyNormalMigrations(db);

  const sqliteD1 = new SqliteD1Database(db);
  const bridgeStore = d1BridgeStore(sqliteD1);
  const fabricLedger = d1FabricLedgerStore(sqliteD1);

  await bridgeStore.putUpstream('cambium', 'up-1', { id: 'up-1', receivedAt: '2026-06-24T09:00:00.000Z' });
  await bridgeStore.putDirective('mathis', 'directive-1', {
    id: 'directive-1',
    memberId: 'mathis',
    enqueuedAt: '2026-06-24T09:01:00.000Z',
    payload: { taskId: 'task-empty-db' },
  });
  await bridgeStore.putAssignment({
    id: 'directive-1',
    memberId: 'mathis',
    eventId: 'event-empty-db',
    taskId: 'task-empty-db',
    projectId: 'project-empty-db',
    payloadHash: 'hash-empty-db',
    enqueuedAt: '2026-06-24T09:01:00.000Z',
  });
  await bridgeStore.putRoleTaskClaim({
    eventId: 'role-event-empty-db',
    roleId: 'engineer',
    memberId: 'mathis',
    projectId: 'project-empty-db',
    bindingVersion: 'v1',
    intentHash: 'intent-hash-first',
    claimedAt: '2026-06-24T09:01:30.000Z',
  });
  await bridgeStore.putRoleTaskClaim({
    eventId: 'role-event-empty-db',
    roleId: 'engineer',
    memberId: 'shesh',
    projectId: 'other-project',
    bindingVersion: 'v2',
    intentHash: 'intent-hash-conflict',
    claimedAt: '2026-06-24T09:01:31.000Z',
  });
  await fabricLedger.upsertTask({
    tenantId: 'tenant-b',
    taskId: 'task-empty-db',
    projectId: 'project-empty-db',
    memberId: 'mathis',
    status: 'assigned',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Fresh migration proof',
    payload: { tenantId: 'tenant-b' },
    updatedAt: '2026-06-24T09:02:00.000Z',
  });
  assert.equal(await fabricLedger.putEvent({
    tenantId: 'tenant-b',
    eventId: 'event-empty-db',
    taskId: 'task-empty-db',
    projectId: 'project-empty-db',
    memberId: 'mathis',
    type: 'fabric_task_report',
    source: 'plexus',
    payloadHash: 'hash-event-empty-db',
    upstreamPayloadHash: 'upstream-empty-db',
    payload: { tenantId: 'tenant-b', taskId: 'task-empty-db' },
    correlationId: 'corr-empty-db',
    receivedAt: '2026-06-24T09:03:00.000Z',
  }), true);
  await fabricLedger.putEvidenceCandidate({
    tenantId: 'tenant-b',
    candidateId: 'candidate-empty-db',
    taskId: 'task-empty-db',
    projectId: 'project-empty-db',
    memberId: 'mathis',
    status: 'review_pending',
    confidence: 'low',
    matchKind: 'note_only',
    evidence: { type: 'manual_note' },
    reason: 'fresh migration proof',
    createdAt: '2026-06-24T09:04:00.000Z',
  });
  await fabricLedger.putEvidenceReview({
    tenantId: 'tenant-b',
    reviewId: 'review-empty-db',
    candidateId: 'candidate-empty-db',
    outcome: 'accepted',
    actor: 'founder',
    reason: 'fresh migration proof',
    reviewedAt: '2026-06-24T09:05:00.000Z',
  });

  assert.deepEqual((await bridgeStore.listUpstream('cambium', 10)).map((message) => message.id), ['up-1']);
  assert.equal((await bridgeStore.listPendingDirectives('mathis', 10)).directives.length, 1);
  assert.equal((await bridgeStore.getAssignment('mathis', 'event-empty-db'))?.taskId, 'task-empty-db');
  assert.equal((await bridgeStore.getRoleTaskClaim('role-event-empty-db'))?.intentHash, 'intent-hash-first');
  assert.equal((await fabricLedger.getTask('task-empty-db', 'tenant-b'))?.tenantId, 'tenant-b');
  assert.equal((await fabricLedger.getEvent('event-empty-db', 'tenant-b'))?.upstreamPayloadHash, 'upstream-empty-db');
  assert.equal((await fabricLedger.listReviewItems('tenant-b')).length, 1);
  assert.equal((await fabricLedger.getEvidenceCandidate('candidate-empty-db', 'tenant-b'))?.tenantId, 'tenant-b');
  db.close();
});

test('fabric bridge · normal D1 migrations do not collapse current tenant-aware rows', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema/bridge.sql', import.meta.url), 'utf8'));
  db.exec(`
    INSERT INTO fabric_tasks (
      tenant_id, task_id, project_id, member_id, status, work_mode,
      evidence_strength, title, payload_json, updated_at
    ) VALUES (
      'tenant-b', 'tenant-task', 'tenant-project', 'mathis', 'done', 'manual',
      'strong_evidence', 'Tenant task', '{"tenantId":"tenant-b"}', '2026-06-24T09:10:00.000Z'
    );
    INSERT INTO fabric_task_events (
      tenant_id, event_id, task_id, project_id, member_id, type, source,
      payload_hash, upstream_payload_hash, payload_json, correlation_id, received_at
    ) VALUES (
      'tenant-b', 'tenant-event', 'tenant-task', 'tenant-project', 'mathis',
      'fabric_task_report', 'plexus', 'tenant-hash', 'tenant-upstream-hash',
      '{"tenantId":"tenant-b","taskId":"tenant-task"}', 'tenant-corr',
      '2026-06-24T09:11:00.000Z'
    );
  `);
  applyNormalMigrations(db);

  const fabricLedger = d1FabricLedgerStore(new SqliteD1Database(db));
  assert.equal((await fabricLedger.getTask('tenant-task', 'tenant-b'))?.tenantId, 'tenant-b');
  assert.equal((await fabricLedger.getTask('tenant-task', 'cambium')), null);
  assert.equal((await fabricLedger.getEvent('tenant-event', 'tenant-b'))?.upstreamPayloadHash, 'tenant-upstream-hash');
  assert.equal((await fabricLedger.getEvent('tenant-event', 'cambium')), null);
  db.close();
});

test('fabric bridge · manual legacy D1 upgrade preserves legacy Fabric rows under cambium tenant', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE fabric_tasks (
      task_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      status TEXT NOT NULL,
      work_mode TEXT,
      evidence_strength TEXT NOT NULL DEFAULT 'weak_evidence',
      title TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_fabric_tasks_project_member
      ON fabric_tasks (project_id, member_id, updated_at);
    CREATE TABLE fabric_task_events (
      event_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      correlation_id TEXT,
      received_at TEXT NOT NULL
    );
    CREATE INDEX idx_fabric_task_events_task_received
      ON fabric_task_events (task_id, received_at);
    CREATE TABLE fabric_evidence_candidates (
      candidate_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence TEXT NOT NULL,
      match_kind TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      review_actor TEXT,
      review_reason TEXT
    );
    CREATE INDEX idx_fabric_evidence_candidates_review
      ON fabric_evidence_candidates (status, created_at);
    CREATE TABLE fabric_evidence_reviews (
      review_id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      reviewed_at TEXT NOT NULL
    );
    INSERT INTO fabric_tasks VALUES (
      'legacy-task', 'legacy-project', 'mathis', 'done', 'manual', 'weak_evidence',
      'Legacy task', '{"clientName":"Legacy"}', '2026-06-23T10:00:00.000Z'
    );
    INSERT INTO fabric_task_events VALUES (
      'legacy-event', 'legacy-task', 'legacy-project', 'mathis', 'fabric_task_report',
      'plexus', 'hash-legacy', '{"tenantId":"cambium","taskId":"legacy-task"}',
      'corr-legacy', '2026-06-23T10:01:00.000Z'
    );
    INSERT INTO fabric_evidence_candidates VALUES (
      'legacy-candidate', 'legacy-task', 'legacy-project', 'mathis', 'review_pending',
      'low', 'note_only', '{"type":"manual_note"}', 'legacy note',
      '2026-06-23T10:02:00.000Z', NULL, NULL, NULL
    );
    INSERT INTO fabric_evidence_reviews VALUES (
      'legacy-review', 'legacy-candidate', 'rejected', 'founder', 'stale',
      '2026-06-23T10:03:00.000Z'
    );
  `);
  assert.ok(!normalMigrationFiles().includes('2026-06-24-fabric-tenant-upgrade.sql'));
  const migration = readFileSync(legacyFabricTenantUpgradeSql, 'utf8');
  db.exec(migration);

  const tableInfo = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; pk: number }>;
  assert.deepEqual(tableInfo('fabric_tasks').filter((col) => col.pk > 0).map((col) => col.name), ['tenant_id', 'task_id']);
  assert.deepEqual(tableInfo('fabric_task_events').filter((col) => col.pk > 0).map((col) => col.name), ['tenant_id', 'event_id']);
  assert.ok(tableInfo('fabric_task_events').some((col) => col.name === 'upstream_payload_hash'));
  assert.deepEqual(tableInfo('fabric_evidence_candidates').filter((col) => col.pk > 0).map((col) => col.name), ['tenant_id', 'candidate_id']);
  assert.deepEqual(tableInfo('fabric_evidence_reviews').filter((col) => col.pk > 0).map((col) => col.name), ['tenant_id', 'review_id']);

  const fabricLedger = d1FabricLedgerStore(new SqliteD1Database(db));
  assert.equal((await fabricLedger.getTask('legacy-task', 'cambium'))?.tenantId, 'cambium');
  assert.equal((await fabricLedger.getEvent('legacy-event', 'cambium'))?.upstreamPayloadHash, null);
  assert.equal((await fabricLedger.listReviewItems('cambium')).length, 1);
  assert.equal((await fabricLedger.getEvidenceCandidate('legacy-candidate', 'cambium'))?.tenantId, 'cambium');
  assert.equal(await fabricLedger.getTask('legacy-task', 'tenant-b'), null);
  db.close();
});

test('bridge · D1 pending directives over-fetches past corrupt rows', async () => {
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  db.directives.set('mathis\u0000corrupt', {
    member_id: 'mathis',
    id: 'corrupt',
    directive_json: '<!DOCTYPE html>',
    delivered: 0,
    enqueued_at: '2026-06-24T08:00:00.000Z',
    delivered_at: null,
  });
  await bridgeStore.putDirective('mathis', 'valid', { id: 'valid', memberId: 'mathis', enqueuedAt: '2026-06-24T08:01:00.000Z' });

  const pending = await bridgeStore.listPendingDirectives('mathis', 1);
  assert.equal(pending.skipped, 1);
  assert.deepEqual(pending.directives.map((directive) => directive.id), ['valid']);
});

test('bridge · assignment race repairs the winning D1 directive', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const inner = d1BridgeStore(db);
  let firstAssignmentRead = true;
  let directiveWrites = 0;
  const bridgeStore = {
    ...inner,
    async getAssignment(memberId: string, eventId: string) {
      if (firstAssignmentRead) {
        firstAssignmentRead = false;
        return null;
      }
      return inner.getAssignment(memberId, eventId);
    },
    async putAssignment(record: any) {
      await inner.putAssignment({ ...record, id: 'assign-race-winner' });
      await inner.putAssignment(record);
    },
    async putDirectiveIfAbsent(memberId: string, id: string, directive: Record<string, unknown>) {
      directiveWrites++;
      await inner.putDirectiveIfAbsent(memberId, id, directive);
    },
  };

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: { taskId: 'task-race', projectId: 'project-race', title: 'Race-proof assignment' },
    }),
  }), {
    kv,
    bridgeToken: 'bridge',
    bridgeStore,
    now: () => '2026-06-24T08:02:00.000Z',
    uuid: () => 'assign-race-loser',
  });

  assert.equal(queued.status, 200);
  assert.equal(body(queued).duplicate, true);
  assert.equal(body(queued).id, 'assign-race-winner');
  assert.equal(directiveWrites, 1);
  assert.equal(db.directives.size, 1);
  assert.equal((await inner.getDirective('mathis', 'assign-race-winner'))?.id, 'assign-race-winner');
});

test('fabric bridge · D1 duplicate events and reviews are ignored intentionally', async () => {
  const db = new FakeD1Database();
  const fabricLedger = d1FabricLedgerStore(db);
  const event: FabricLedgerEventRecord = {
    tenantId: 'cambium',
    eventId: 'event-replay',
    taskId: 'task-replay',
    projectId: 'project-replay',
    memberId: 'mathis',
    type: 'fabric_task_report',
    source: 'plexus',
    payloadHash: 'hash-replay',
    upstreamPayloadHash: 'upstream-hash',
    payload: { tenantId: 'cambium', taskId: 'task-replay' },
    correlationId: 'corr-replay',
    receivedAt: '2026-06-24T08:03:00.000Z',
  };
  assert.equal(await fabricLedger.putEvent(event), true);
  assert.equal(await fabricLedger.putEvent(event), false);
  assert.equal(await fabricLedger.putEvent({ ...event, payloadHash: 'hash-conflict' }), false);
  assert.equal(db.events.size, 1);
  assert.equal((await fabricLedger.getEvent('event-replay', 'cambium'))?.payloadHash, 'hash-replay');

  const review: FabricEvidenceReviewRecord = {
    tenantId: 'cambium',
    reviewId: 'review-replay',
    candidateId: 'candidate-replay',
    outcome: 'rejected',
    actor: 'founder',
    reason: 'duplicate review should be ignored',
    reviewedAt: '2026-06-24T08:04:00.000Z',
  };
  await fabricLedger.putEvidenceReview(review);
  await fabricLedger.putEvidenceReview(review);
  assert.equal(db.reviews.size, 1);
  assert.deepEqual(
    [...db.reviews.values()].map((row) => [row.tenant_id, row.review_id, row.outcome]),
    [['cambium', 'review-replay', 'rejected']],
  );
});

test('bridge · assignment idempotency ignores volatile issuedAt', async () => {
  const kv = fakeKv();
  const timestamps = [
    '2026-06-22T08:00:00.000Z',
    '2026-06-22T08:05:00.000Z',
  ];
  let nowIndex = 0;
  let uuidIndex = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    now: () => timestamps[nowIndex++] ?? timestamps[timestamps.length - 1],
    uuid: () => `assign-clock-${++uuidIndex}`,
  };
  const assignment = {
    memberId: 'mathis',
    task: {
      taskId: 'task-clock-stable',
      projectId: 'fitcheck-product',
      title: 'Prepare stable assignment packet',
      priority: 'high',
      taskType: 'engineering',
    },
  };

  const first = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(first.status, 200);
  assert.equal(body(first).id, 'assign-clock-1');

  const duplicate = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).id, 'assign-clock-1');
  assert.equal(body(duplicate).duplicate, true);
});

test('bridge · pending directives limit after delivered backlog filtering', async () => {
  const kv = fakeKv();
  let uuidIndex = 0;
  const deps = {
    kv,
    bridgeToken: 'bridge',
    now: () => '2026-06-22T08:00:00.000Z',
    uuid: () => `assign-backlog-${++uuidIndex}`,
  };
  for (let i = 0; i < 100; i++) {
    kv.store.set(`bridge:dir:mathis:delivered-${String(i).padStart(3, '0')}`, JSON.stringify({
      id: `delivered-${i}`,
      memberId: 'mathis',
      direction: 'downstream',
      payload: { kind: 'old' },
      delivered: true,
    }));
  }

  const queued = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      memberId: 'mathis',
      task: {
        taskId: 'task-after-backlog',
        projectId: 'fitcheck-product',
        title: 'Handle visible pending assignment',
      },
    }),
  }), deps);
  assert.equal(queued.status, 200);

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(pending.status, 200);
  assert.equal(body(pending).count, 1);
  assert.equal(body(pending).directives[0].id, 'assign-backlog-1');
});

test('fabric bridge · D1 stores isolate event task candidate and review rows by tenant', async () => {
  const kv = fakeKv();
  const db = new FakeD1Database();
  const bridgeStore = d1BridgeStore(db);
  const fabricLedger = d1FabricLedgerStore(db);
  const deps = {
    kv,
    bridgeToken: 'bridge',
    bridgeStore,
    fabricLedger,
    now: () => '2026-06-24T09:05:00.000Z',
    uuid: () => 'candidate-shared',
  };

  for (const tenantId of ['tenant-a', 'tenant-b']) {
    const upstream = await signBridge('bridge', {
      id: `up-${tenantId}`,
      timestamp: '2026-06-24T09:05:00.000Z',
      direction: 'upstream',
      tenantId,
      memberId: 'mathis',
      payload: {
        type: 'fabric_task_report',
        schema: 'thoughtseed.fabric_task_report.v1',
        tenantId,
        taskId: 'shared-task',
        projectId: `project-${tenantId}`,
        title: `Prepare ${tenantId} D1 packet`,
        status: 'done',
        workMode: 'manual',
        evidence: { type: 'github_pr', value: `https://github.com/thoughtseed/${tenantId}/pull/7` },
        historyEventId: 'shared-history-event',
        historyPayloadHash: `hash-${tenantId}`,
      },
    });
    const ingest = await handle(req('POST', '/v1/bridge/ingest', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(upstream),
    }), deps);
    assert.equal(ingest.status, 200);
  }

  for (const tenantId of ['tenant-a', 'tenant-b']) {
    const consumed = await handle(req('POST', '/v1/fabric/consume', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify({ tenantId }),
    }), deps);
    assert.equal(consumed.status, 200);
    assert.equal(body(consumed).consumed, 1);
    assert.equal(body(consumed).duplicates, 0);
  }

  assert.equal(db.events.size, 2);
  assert.equal(db.tasks.size, 2);
  assert.equal((await fabricLedger.getEvent('shared-history-event', 'tenant-a'))?.tenantId, 'tenant-a');
  assert.equal((await fabricLedger.getEvent('shared-history-event', 'tenant-b'))?.tenantId, 'tenant-b');
  assert.equal((await fabricLedger.getTask('shared-task', 'tenant-a'))?.projectId, 'project-tenant-a');
  assert.equal((await fabricLedger.getTask('shared-task', 'tenant-b'))?.projectId, 'project-tenant-b');

  await fabricLedger.upsertTask({
    tenantId: 'tenant-a',
    taskId: 'manual-review-task',
    projectId: 'project-tenant-a',
    memberId: 'mathis',
    status: 'done',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Manual review task',
    payload: { tenantId: 'tenant-a', clientName: 'Tenant A' },
    updatedAt: '2026-06-24T09:10:00.000Z',
  });
  await fabricLedger.upsertTask({
    tenantId: 'tenant-b',
    taskId: 'manual-review-task',
    projectId: 'project-tenant-b',
    memberId: 'mathis',
    status: 'done',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Manual review task',
    payload: { tenantId: 'tenant-b', clientName: 'Tenant B' },
    updatedAt: '2026-06-24T09:10:00.000Z',
  });

  const tenantACandidate = await handle(req('POST', '/v1/fabric/evidence-candidates', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'tenant-a',
      taskId: 'manual-review-task',
      evidence: { type: 'github_branch', branch: 'tenant-a-manual', clientName: 'Tenant A' },
    }),
  }), deps);
  assert.equal(tenantACandidate.status, 200);
  assert.equal(body(tenantACandidate).candidate.tenantId, 'tenant-a');

  const tenantBReviewItems = await handle(req('GET', '/v1/fabric/review-items?tenantId=tenant-b', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(tenantBReviewItems.status, 200);
  assert.equal(body(tenantBReviewItems).count, 0);

  const reviewed = await handle(req('POST', '/v1/fabric/evidence-candidates/review', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'tenant-a', candidateId: 'candidate-shared', outcome: 'rejected', actor: 'founder' }),
  }), deps);
  assert.equal(reviewed.status, 200);
  assert.equal(db.reviews.size, 1);
  assert.deepEqual(
    [...db.reviews.values()].map((review) => [review.tenant_id, review.candidate_id, review.outcome]),
    [['tenant-a', 'candidate-shared', 'rejected']],
  );
  assert.equal(await fabricLedger.getEvidenceCandidate('candidate-shared', 'tenant-b'), null);
});

test('fabric ledger · consumes Plexus task reports idempotently', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };
  const upstream = await signBridge('bridge', {
    id: 'up-1',
    timestamp: '2026-06-23T10:00:00.000Z',
    direction: 'upstream',
    tenantId: 'cambium',
    memberId: 'mathis',
    payload: {
      type: 'fabric_task_report',
      schema: 'thoughtseed.fabric_task_report.v1',
      taskId: 'task-fitcheck-brief',
      projectId: 'fitcheck-product',
      title: 'Prepare branch proof packet',
      status: 'done',
      workMode: 'manual',
      evidenceStrength: 'weak_evidence',
      evidence: { type: 'github_pr', value: 'https://github.com/thoughtseed/fitcheck/pull/7' },
      historyEventId: 'plexus-done-1',
      historyPayloadHash: 'hash-done-1',
      correlationId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
    },
  });

  const ingest = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(upstream),
  }), deps);
  assert.equal(ingest.status, 200);

  const consumed = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(consumed.status, 200);
  assert.equal(body(consumed).consumed, 1);
  assert.equal(body(consumed).upgraded, 1);
  assert.equal(fabricLedger.events.get('plexus-done-1')?.upstreamPayloadHash, 'hash-done-1');
  assert.ok(fabricLedger.events.get('plexus-done-1')?.payloadHash);
  assert.notEqual(fabricLedger.events.get('plexus-done-1')?.payloadHash, 'hash-done-1');
  assert.equal(fabricLedger.tasks.get('task-fitcheck-brief')?.evidenceStrength, 'verified_evidence');

  const duplicate = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(body(duplicate).duplicates, 1);

  const scopedConsumer = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(scopedConsumer.status, 200);
  assert.equal(body(scopedConsumer).duplicates, 1);
});

test('fabric ledger · isolates event ids by tenant during consume', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };

  for (const tenantId of ['tenant-a', 'tenant-b']) {
    const upstream = await signBridge('bridge', {
      id: `up-${tenantId}`,
      timestamp: '2026-06-23T10:00:00.000Z',
      direction: 'upstream',
      tenantId,
      memberId: 'mathis',
      payload: {
        type: 'fabric_task_report',
        schema: 'thoughtseed.fabric_task_report.v1',
        tenantId,
        taskId: `task-${tenantId}`,
        projectId: `project-${tenantId}`,
        title: `Prepare ${tenantId} packet`,
        status: 'done',
        workMode: 'manual',
        evidence: { type: 'github_pr', value: 'https://github.com/thoughtseed/fitcheck/pull/7' },
        historyEventId: 'shared-history-event',
        historyPayloadHash: `hash-${tenantId}`,
      },
    });
    const ingest = await handle(req('POST', '/v1/bridge/ingest', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(upstream),
    }), deps);
    assert.equal(ingest.status, 200);
  }

  const tenantA = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'tenant-a' }),
  }), deps);
  assert.equal(tenantA.status, 200);
  assert.equal(body(tenantA).consumed, 1);
  assert.equal(body(tenantA).duplicates, 0);
  assert.equal(body(tenantA).conflicts, 0);

  const tenantB = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'tenant-b' }),
  }), deps);
  assert.equal(tenantB.status, 200);
  assert.equal(body(tenantB).consumed, 1);
  assert.equal(body(tenantB).duplicates, 0);
  assert.equal(body(tenantB).conflicts, 0);

  assert.equal(fabricLedger.events.size, 2);
  assert.equal(fabricLedger.events.get('tenant-a:shared-history-event')?.tenantId, 'tenant-a');
  assert.equal(fabricLedger.events.get('tenant-b:shared-history-event')?.tenantId, 'tenant-b');
  assert.equal(fabricLedger.tasks.get('tenant-a:task-tenant-a')?.tenantId, 'tenant-a');
  assert.equal(fabricLedger.tasks.get('tenant-b:task-tenant-b')?.tenantId, 'tenant-b');
});

test('fabric ledger · reviews weak evidence candidates and emits task history directives', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  await fabricLedger.upsertTask({
    taskId: 'task-fitcheck-brief',
    projectId: 'fitcheck-product',
    memberId: 'mathis',
    status: 'done',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Prepare branch proof packet',
    payload: { clientName: 'FitCheck' },
    updatedAt: '2026-06-23T10:00:00.000Z',
  });
  const deps = {
    kv,
    fabricLedger,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    now: () => '2026-06-23T10:05:00.000Z',
    uuid: () => 'candidate-1',
  };

  const candidate = await handle(req('POST', '/v1/fabric/evidence-candidates', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      evidence: {
        type: 'github_branch',
        value: 'fitcheck-product/prepare-branch-proof-packet',
        branch: 'prepare-branch-proof-packet',
        clientName: 'FitCheck',
      },
    }),
  }), deps);
  assert.equal(candidate.status, 200);
  assert.equal(body(candidate).verified, false);
  assert.equal(body(candidate).candidate.candidateId, 'candidate-1');
  assert.equal(body(candidate).candidate.status, 'review_pending');

  const scopedReviewItems = await handle(req('GET', '/v1/fabric/review-items', {
    headers: { authorization: 'Bearer assign-only' },
  }), deps);
  assert.equal(scopedReviewItems.status, 401);

  const reviewItems = await handle(req('GET', '/v1/fabric/review-items', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(reviewItems.status, 200);
  assert.equal(body(reviewItems).count, 1);

  const review = await handle(req('POST', '/v1/fabric/evidence-candidates/review', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      candidateId: 'candidate-1',
      outcome: 'rejected',
      actor: 'founder',
      reason: 'branch belongs to a different proof packet',
    }),
  }), deps);
  assert.equal(review.status, 200);
  assert.equal(body(review).candidate.status, 'rejected_candidate');
  assert.equal(body(review).directiveId, 'candidate-review:candidate-1:rejected');
  assert.equal(fabricLedger.reviews.size, 1);

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(pending.status, 200);
  assert.equal(body(pending).count, 1);
  assert.equal(body(pending).directives[0].payload.type, 'fabric_task_history_event');
  assert.equal(body(pending).directives[0].payload.event.type, 'candidate_rejected');
  assert.equal(body(pending).directives[0].payload.event.payload.status, 'rejected_candidate');

  const afterReviewItems = await handle(req('GET', '/v1/fabric/review-items', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(afterReviewItems.status, 200);
  assert.equal(body(afterReviewItems).count, 0);

  const task = await handle(req('GET', '/v1/fabric/tasks/task-fitcheck-brief', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(task.status, 200);
  assert.equal(body(task).task.evidenceStrength, 'weak_evidence');
  assert.equal(body(task).candidates[0].status, 'rejected_candidate');
});

test('fabric ledger · isolates review data by tenant for list attach review and detail', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  await fabricLedger.upsertTask({
    tenantId: 'tenant-a',
    taskId: 'task-shared',
    projectId: 'project-a',
    memberId: 'mathis',
    status: 'done',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Tenant A task',
    payload: { tenantId: 'tenant-a', clientName: 'Tenant A' },
    updatedAt: '2026-06-23T10:00:00.000Z',
  });
  const deps = {
    kv,
    fabricLedger,
    bridgeToken: 'bridge',
    now: () => '2026-06-23T10:05:00.000Z',
    uuid: () => 'candidate-a',
  };

  const tenantACandidate = await handle(req('POST', '/v1/fabric/evidence-candidates', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'tenant-a',
      taskId: 'task-shared',
      evidence: { type: 'github_branch', branch: 'tenant-a-proof', clientName: 'Tenant A' },
    }),
  }), deps);
  assert.equal(tenantACandidate.status, 200);

  const tenantBList = await handle(req('GET', '/v1/fabric/review-items?tenantId=tenant-b', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(tenantBList.status, 200);
  assert.equal(body(tenantBList).count, 0);

  const tenantBDetail = await handle(req('GET', '/v1/fabric/tasks/task-shared?tenantId=tenant-b', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(tenantBDetail.status, 404);

  const tenantBAttach = await handle(req('POST', '/v1/fabric/evidence-candidates', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      tenantId: 'tenant-b',
      taskId: 'task-shared',
      evidence: { type: 'github_branch', branch: 'tenant-b-escape', clientName: 'Tenant A' },
    }),
  }), deps);
  assert.equal(tenantBAttach.status, 404);
  assert.equal(fabricLedger.candidates.size, 1);

  const tenantBReview = await handle(req('POST', '/v1/fabric/evidence-candidates/review', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'tenant-b', candidateId: 'candidate-a', outcome: 'accepted' }),
  }), deps);
  assert.equal(tenantBReview.status, 404);
  assert.equal(fabricLedger.candidates.get('tenant-a:candidate-a')?.status, 'review_pending');
  assert.equal(fabricLedger.reviews.size, 0);

  const tenantAList = await handle(req('GET', '/v1/fabric/review-items?tenantId=tenant-a', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(body(tenantAList).count, 1);
  assert.equal(body(tenantAList).candidates[0].tenantId, 'tenant-a');
});

test('fabric ledger · makes review replay idempotent and rejects opposite outcomes', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  await fabricLedger.upsertTask({
    taskId: 'task-fitcheck-review',
    projectId: 'fitcheck-product',
    memberId: 'mathis',
    status: 'done',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Prepare review replay packet',
    payload: { clientName: 'FitCheck' },
    updatedAt: '2026-06-23T10:00:00.000Z',
  });
  const deps = {
    kv,
    fabricLedger,
    bridgeToken: 'bridge',
    now: () => '2026-06-23T10:05:00.000Z',
    uuid: () => 'candidate-replay',
  };

  const candidate = await handle(req('POST', '/v1/fabric/evidence-candidates', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      taskId: 'task-fitcheck-review',
      evidence: { type: 'github_branch', branch: 'replay-proof', clientName: 'FitCheck' },
    }),
  }), deps);
  assert.equal(candidate.status, 200);

  const firstReject = await handle(req('POST', '/v1/fabric/evidence-candidates/review', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ candidateId: 'candidate-replay', outcome: 'rejected', actor: 'founder' }),
  }), deps);
  assert.equal(firstReject.status, 200);
  assert.equal(body(firstReject).candidate.status, 'rejected_candidate');

  const replayReject = await handle(req('POST', '/v1/fabric/evidence-candidates/review', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ candidateId: 'candidate-replay', outcome: 'rejected', actor: 'founder' }),
  }), deps);
  assert.equal(replayReject.status, 200);
  assert.equal(body(replayReject).duplicate, true);
  assert.equal(body(replayReject).directiveId, 'candidate-review:candidate-replay:rejected');

  const oppositeAccept = await handle(req('POST', '/v1/fabric/evidence-candidates/review', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ candidateId: 'candidate-replay', outcome: 'accepted', actor: 'founder' }),
  }), deps);
  assert.equal(oppositeAccept.status, 409);
  assert.equal(fabricLedger.candidates.get('candidate-replay')?.status, 'rejected_candidate');
  assert.equal(fabricLedger.reviews.size, 1);

  const pending = await handle(req('GET', '/v1/bridge/directives/mathis', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  assert.equal(body(pending).count, 1);
  assert.equal(body(pending).directives[0].payload.event.type, 'candidate_rejected');
});

test('fabric ledger · redacts review DTOs and hides forged raw payload strength', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  await fabricLedger.upsertTask({
    taskId: 'task-secret-proof',
    projectId: 'fitcheck-product',
    memberId: 'mathis',
    status: 'done',
    workMode: 'manual',
    evidenceStrength: 'weak_evidence',
    title: 'Handle secret evidence',
    payload: {
      clientName: 'FitCheck',
      description: 'Bearer task-secret',
      token: 'raw-task-token',
      evidenceStrength: 'verified_evidence',
    },
    updatedAt: '2026-06-23T10:00:00.000Z',
  });
  const deps = {
    kv,
    fabricLedger,
    bridgeToken: 'bridge',
    now: () => '2026-06-23T10:05:00.000Z',
    uuid: () => 'candidate-secret',
  };

  const candidate = await handle(req('POST', '/v1/fabric/evidence-candidates', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({
      taskId: 'task-secret-proof',
      evidence: {
        type: 'manual_note',
        value: 'Bearer candidate-secret',
        token: 'raw-candidate-token',
        clientName: 'FitCheck',
      },
    }),
  }), deps);
  assert.equal(candidate.status, 200);

  const reviewItems = await handle(req('GET', '/v1/fabric/review-items', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const reviewJson = reviewItems.body;
  assert.doesNotMatch(reviewJson, /Bearer candidate-secret|raw-candidate-token|token/i);
  assert.equal(body(reviewItems).candidates[0].evidence.value, '[redacted]');

  const task = await handle(req('GET', '/v1/fabric/tasks/task-secret-proof', {
    headers: { authorization: 'Bearer bridge' },
  }), deps);
  const taskJson = task.body;
  assert.doesNotMatch(taskJson, /Bearer task-secret|raw-task-token|Bearer candidate-secret|raw-candidate-token|payload|verified_evidence/i);
  assert.equal(body(task).task.evidenceStrength, 'weak_evidence');
  assert.equal(body(task).task.details.clientName, 'FitCheck');
  assert.equal(body(task).task.details.description, '[redacted]');
});

test('fabric ledger · rejects forged verified evidence claims without strong proof', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };

  const reports = [
    {
      id: 'up-note',
      payload: {
        taskId: 'task-note-only',
        projectId: 'fitcheck-product',
        title: 'Note-only completion',
        note: 'I am done',
      },
    },
    {
      id: 'up-manual',
      payload: {
        taskId: 'task-manual-note',
        projectId: 'fitcheck-product',
        title: 'Manual note completion',
        evidence: { type: 'manual_note', value: 'Done manually' },
      },
    },
    {
      id: 'up-unknown',
      payload: {
        taskId: 'task-unknown-proof',
        projectId: 'fitcheck-product',
        title: 'Unknown proof completion',
        evidence: { type: 'trust_me', value: 'Looks good' },
      },
    },
  ];

  for (const report of reports) {
    const upstream = await signBridge('bridge', {
      id: report.id,
      timestamp: '2026-06-23T10:00:00.000Z',
      direction: 'upstream',
      tenantId: 'cambium',
      memberId: 'mathis',
      payload: {
        type: 'fabric_task_report',
        schema: 'thoughtseed.fabric_task_report.v1',
        status: 'done',
        workMode: 'manual',
        evidenceStrength: 'verified_evidence',
        historyEventId: `event-${report.id}`,
        ...report.payload,
      },
    });
    const ingest = await handle(req('POST', '/v1/bridge/ingest', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(upstream),
    }), deps);
    assert.equal(ingest.status, 200);
  }

  const consumed = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(consumed.status, 200);
  assert.equal(body(consumed).consumed, 3);
  assert.equal(body(consumed).upgraded, 0);
  assert.equal(fabricLedger.tasks.get('task-note-only')?.evidenceStrength, 'weak_evidence');
  assert.equal(fabricLedger.tasks.get('task-manual-note')?.evidenceStrength, 'weak_evidence');
  assert.equal(fabricLedger.tasks.get('task-unknown-proof')?.evidenceStrength, 'weak_evidence');
  assert.deepEqual(
    [...fabricLedger.candidates.values()].map((candidate) => candidate.status),
    ['review_pending', 'review_pending', 'review_pending'],
  );
});

test('fabric ledger · treats ignored evidence strength changes as duplicates', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };

  for (const evidenceStrength of ['weak_evidence', 'verified_evidence']) {
    const upstream = await signBridge('bridge', {
      id: `up-strength-${evidenceStrength}`,
      timestamp: '2026-06-23T10:00:00.000Z',
      direction: 'upstream',
      tenantId: 'cambium',
      memberId: 'mathis',
      payload: {
        type: 'fabric_task_report',
        schema: 'thoughtseed.fabric_task_report.v1',
        taskId: 'task-strength-proof',
        projectId: 'fitcheck-product',
        title: 'Prepare branch proof packet',
        status: 'done',
        workMode: 'manual',
        evidenceStrength,
        evidence: { type: 'github_pr', value: 'https://github.com/thoughtseed/fitcheck/pull/7' },
        historyEventId: 'plexus-strength-1',
        historyPayloadHash: 'client-claimed-strength',
      },
    });
    const ingest = await handle(req('POST', '/v1/bridge/ingest', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(upstream),
    }), deps);
    assert.equal(ingest.status, 200);
  }

  const consumed = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(consumed.status, 200);
  assert.equal(body(consumed).consumed, 1);
  assert.equal(body(consumed).duplicates, 1);
  assert.equal(body(consumed).conflicts, 0);
});

test('fabric ledger · keeps local file path evidence pending review', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };

  const upstream = await signBridge('bridge', {
    id: 'up-file-path',
    timestamp: '2026-06-23T10:00:00.000Z',
    direction: 'upstream',
    tenantId: 'cambium',
    memberId: 'mathis',
    payload: {
      type: 'fabric_task_report',
      schema: 'thoughtseed.fabric_task_report.v1',
      taskId: 'task-file-proof',
      projectId: 'fitcheck-product',
      title: 'Claimed local proof',
      status: 'done',
      workMode: 'manual',
      evidenceStrength: 'verified_evidence',
      evidence: { type: 'file_path', value: '/tmp/claimed-proof' },
      historyEventId: 'plexus-file-path-1',
      historyPayloadHash: 'client-claimed-file-path',
    },
  });
  const ingest = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(upstream),
  }), deps);
  assert.equal(ingest.status, 200);

  const consumed = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(consumed.status, 200);
  assert.equal(body(consumed).consumed, 1);
  assert.equal(body(consumed).upgraded, 0);
  assert.equal(fabricLedger.tasks.get('task-file-proof')?.evidenceStrength, 'weak_evidence');
  const candidate = [...fabricLedger.candidates.values()][0];
  assert.equal(candidate.status, 'review_pending');
  assert.equal(candidate.confidence, 'low');
});

test('fabric ledger · detects conflicts with server-side payload hash', async () => {
  const kv = fakeKv();
  const fabricLedger = new FakeFabricLedger();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    fabricLedger,
    now: () => '2026-06-23T10:00:00.000Z',
  };

  for (const report of [
    { id: 'up-conflict-1', title: 'First payload', evidence: { type: 'github_pr', value: 'https://github.com/thoughtseed/fitcheck/pull/7' } },
    { id: 'up-conflict-2', title: 'Changed payload', evidence: { type: 'github_pr', value: 'https://github.com/thoughtseed/fitcheck/pull/8' } },
  ]) {
    const upstream = await signBridge('bridge', {
      id: report.id,
      timestamp: '2026-06-23T10:00:00.000Z',
      direction: 'upstream',
      tenantId: 'cambium',
      memberId: 'mathis',
      payload: {
        type: 'fabric_task_report',
        schema: 'thoughtseed.fabric_task_report.v1',
        taskId: 'task-conflict-proof',
        projectId: 'fitcheck-product',
        title: report.title,
        status: 'done',
        workMode: 'manual',
        evidenceStrength: 'weak_evidence',
        evidence: report.evidence,
        historyEventId: 'plexus-conflict-1',
        historyPayloadHash: 'client-claimed-same-hash',
      },
    });
    const ingest = await handle(req('POST', '/v1/bridge/ingest', {
      headers: { authorization: 'Bearer bridge' },
      body: JSON.stringify(upstream),
    }), deps);
    assert.equal(ingest.status, 200);
  }

  const consumed = await handle(req('POST', '/v1/fabric/consume', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ tenantId: 'cambium' }),
  }), deps);
  assert.equal(consumed.status, 200);
  assert.equal(body(consumed).consumed, 1);
  assert.equal(body(consumed).duplicates, 0);
  assert.equal(body(consumed).conflicts, 1);
  assert.equal(fabricLedger.events.get('plexus-conflict-1')?.upstreamPayloadHash, 'client-claimed-same-hash');
  assert.notEqual(fabricLedger.events.get('plexus-conflict-1')?.payloadHash, 'client-claimed-same-hash');
});

test('handoff · invite redemption issues a scoped bridge token', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    bridgeToken: 'bridge',
    handoffSecret: 'handoff-secret',
    now: () => '2026-06-21T00:00:00.000Z',
    nowMs: () => NOW,
    uuid: () => 'invite-1',
  };

  const add = await handle(req('POST', '/v1/handoff/members', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'mathis', tenantId: 'cambium', email: 'founder@example.com' }),
  }), deps);
  assert.equal(add.status, 200);

  const invite = await handle(req('POST', '/v1/handoff/invite', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ memberId: 'mathis', linkBase: 'https://curious.thoughtseed.space' }),
  }), deps);
  assert.equal(invite.status, 200);
  const inviteToken = body(invite).invite;
  assert.ok(inviteToken);

  const redeem = await handle(req('POST', '/v1/handoff/redeem', {
    body: JSON.stringify({ invite: inviteToken }),
  }), deps);
  assert.equal(redeem.status, 200);
  const memberToken = body(redeem).token;
  assert.ok(memberToken);

  const scopedMessage = await signBridge(memberToken, {
    id: 'member-up-1',
    timestamp: '2026-06-21T00:00:00.000Z',
    direction: 'upstream',
    tenantId: 'cambium',
    memberId: 'mathis',
    payload: { kind: 'status' },
  });
  const scopedIngest = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(scopedMessage),
  }), deps);
  assert.equal(scopedIngest.status, 200);

  const tenantEscape = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(await signBridge(memberToken, {
      id: 'member-up-tenant-escape',
      timestamp: '2026-06-21T00:00:00.000Z',
      direction: 'upstream',
      tenantId: 'other-tenant',
      memberId: 'mathis',
      payload: { kind: 'status' },
    })),
  }), deps);
  assert.equal(tenantEscape.status, 403);

  const outOfScope = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(await signBridge(memberToken, {
      id: 'member-up-2',
      timestamp: '2026-06-21T00:00:00.000Z',
      direction: 'upstream',
      tenantId: 'cambium',
      memberId: 'other-member',
      payload: { kind: 'status' },
    })),
  }), deps);
  assert.equal(outOfScope.status, 403);

  const rotate = await handle(req('POST', '/v1/handoff/rotate', {
    body: JSON.stringify({ token: memberToken }),
  }), deps);
  assert.equal(rotate.status, 200);
  assert.notEqual(body(rotate).token, memberToken);

  const oldTokenAfterRotate = await handle(req('POST', '/v1/bridge/ingest', {
    headers: { authorization: `Bearer ${memberToken}` },
    body: JSON.stringify(scopedMessage),
  }), deps);
  assert.equal(oldTokenAfterRotate.status, 401);
});

test('IVerif observer requires its dedicated configuration and rejects broad bridge auth', async () => {
  const kv = fakeKv();
  const path = '/v1/bridge/iverif/status';
  const unconfigured = await handle(req('GET', path, {
    headers: { authorization: 'Bearer bridge' },
  }), { kv, bridgeToken: 'bridge' });
  assert.equal(unconfigured.status, 503);
  assert.equal(body(unconfigured).error, 'iverif_observer_not_configured');

  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assignment',
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: fakeIVerifExplee(),
  };
  for (const credential of ['bridge', 'assignment', 'wrong']) {
    const rejected = await handle(req('GET', path, {
      headers: { authorization: `Bearer ${credential}` },
    }), deps);
    assert.equal(rejected.status, 401);
  }

  const accepted = await handle(req('GET', path, {
    headers: { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` },
  }), deps);
  assert.equal(accepted.status, 200);

  for (const collision of [
    { bridgeToken: IVERIF_TEST_READ_TOKEN },
    { assignmentToken: IVERIF_TEST_READ_TOKEN },
    { pushToken: IVERIF_TEST_READ_TOKEN },
    { providerBroker: { token: IVERIF_TEST_READ_TOKEN, providers: {} } },
    { contextRoutes: { token: IVERIF_TEST_READ_TOKEN } },
    { iverifProviderApiKey: IVERIF_TEST_READ_TOKEN },
  ]) {
    const rejected = await handle(req('GET', path, {
      headers: { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` },
    }), { ...deps, ...collision });
    assert.equal(rejected.status, 503);
    assert.equal(body(rejected).error, 'iverif_observer_not_configured');
  }

  const unnamespaced = await handle(req('GET', path, {
    headers: { authorization: 'Bearer otherwise-long-enough-but-unnamespaced-read-token' },
  }), {
    ...deps,
    iverifReadToken: 'otherwise-long-enough-but-unnamespaced-read-token',
  });
  assert.equal(unnamespaced.status, 503);
});

test('IVerif status exposes live one-writer conflict while remaining send-ineligible', async () => {
  const response = await handle(req('GET', '/v1/bridge/iverif/status', {
    headers: { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` },
  }), {
    kv: fakeKv(),
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: fakeIVerifExplee(),
  });

  assert.equal(response.status, 200);
  const payload = body(response);
  assert.equal(payload.schema, 'cambium.iverif-observer.status.v1');
  assert.equal(payload.grounding.binding.expleeProjectId, 16_763);
  assert.equal(payload.grounding.binding.expleeCampaignId, 45_711);
  assert.equal(payload.campaign.emailsSent, 2_921);
  assert.equal(payload.policy.mode, 'observe');
  assert.equal(payload.policy.proofState, 'proof-only');
  assert.deepEqual(payload.policy.allowedProviderMethods, ['GET']);
  assert.equal(payload.policy.autoReplyEnabled, true);
  assert.equal(payload.policy.oneWriterConflict, true);
  assert.equal(payload.policy.oneWriterConflictReason, 'provider-auto-reply-enabled');
  assert.equal(payload.policy.sendEligible, false);
  assert.doesNotMatch(response.body, /"(?:email|name|subject|body_text|reply_cc_emails|phone|linkedin_url|address)"\s*:/i);
});

test('IVerif inbox and thread routes preserve opaque state without enabling replies', async () => {
  const deps = {
    kv: fakeKv(),
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: fakeIVerifExplee(),
  };
  const headers = { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` };

  const inbox = await handle(req('GET', '/v1/bridge/iverif/inbox', { headers }), deps);
  assert.equal(inbox.status, 200);
  assert.equal(body(inbox).contacts[0].personId, 'person-1');
  assert.equal(body(inbox).policy.sendEligible, false);

  const thread = await handle(req('GET', '/v1/bridge/iverif/thread/person-1', { headers }), deps);
  assert.equal(thread.status, 200);
  assert.equal(body(thread).personId, 'person-1');
  assert.equal(body(thread).providerCanReply, true);
  assert.equal(body(thread).policy.sendEligible, false);
  assert.equal(body(thread).messages[0].messageRef, null);
  assert.doesNotMatch(thread.body, /message-1/);
  assert.doesNotMatch(thread.body, /"(?:email|name|subject|body_text|reply_cc_emails|phone|linkedin_url|address)"\s*:/i);
});

test('IVerif thread route emits only digest-shaped message references or null', async () => {
  const digest = `sha256:${'b'.repeat(64)}`;
  const observer = fakeIVerifExplee({
    async getThread(personId) {
      const thread = await fakeIVerifExplee().getThread(personId);
      return {
        ...thread,
        messageCount: 2,
        messages: [
          { ...thread.messages[0], messageId: 'raw-provider-message-identifier' },
          { ...thread.messages[0], messageId: digest },
        ],
      };
    },
  });
  const response = await handle(req('GET', '/v1/bridge/iverif/thread/person-1', {
    headers: { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` },
  }), {
    kv: fakeKv(),
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: observer,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body(response).messages.map((message: { messageRef: string | null }) => message.messageRef), [
    null,
    digest,
  ]);
  assert.doesNotMatch(response.body, /raw-provider-message-identifier/);
});

test('IVerif malformed thread ids and non-GET methods stop before provider access', async () => {
  let calls = 0;
  const observer = fakeIVerifExplee({
    async getThread(personId) {
      calls += 1;
      return fakeIVerifExplee().getThread(personId);
    },
    async getSnapshot() {
      calls += 1;
      return fakeIVerifExplee().getSnapshot();
    },
  });
  const deps = {
    kv: fakeKv(),
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: observer,
  };
  const headers = { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` };

  const malformed = await handle(req('GET', '/v1/bridge/iverif/thread/person%40example.invalid', { headers }), deps);
  assert.equal(malformed.status, 400);
  assert.equal(body(malformed).error, 'bad_person_id');

  const mutation = await handle(req('POST', '/v1/bridge/iverif/status', { headers, body: '{}' }), deps);
  assert.equal(mutation.status, 405);
  assert.equal(mutation.headers.allow, 'GET');
  assert.equal(calls, 0);
});

test('IVerif observer reads never create ActionRequests', async () => {
  const kv = fakeKv();
  const deps = {
    kv,
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: fakeIVerifExplee(),
  };
  const headers = { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` };

  for (const path of [
    '/v1/bridge/iverif/status',
    '/v1/bridge/iverif/inbox',
    '/v1/bridge/iverif/thread/person-1',
    '/v1/bridge/iverif/optimize',
  ]) {
    const response = await handle(req('GET', path, { headers }), deps);
    assert.equal(response.status, 200, path);
  }

  assert.deepEqual(await kv.list('action-request:'), []);
  assert.deepEqual(await kv.list('action-request-idempotency:'), []);
});

test('IVerif optimize combines grounded experiment and live analytics without thread content', async () => {
  const response = await handle(req('GET', '/v1/bridge/iverif/optimize', {
    headers: { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` },
  }), {
    kv: fakeKv(),
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: fakeIVerifExplee(),
  });

  assert.equal(response.status, 200);
  const payload = body(response);
  assert.equal(payload.schema, 'cambium.iverif-observer.optimize.v1');
  assert.equal(payload.live.emailsSent, 2_921);
  assert.equal(payload.experiment.variable, 'discovery-framing');
  assert.equal(payload.experiment.repliesClassified, 0);
  assert.equal(payload.experiment.winnerEligible, false);
  assert.equal(payload.claimStatus.verified, 0);
  assert.ok(payload.claimStatus.blocked.includes('compliance-guarantee'));
  assert.doesNotMatch(response.body, /"(?:messages|body_text|from_email|to_email|lead)"\s*:/i);
});

test('IVerif observer normalizes unexpected failures without leaking provider bodies', async () => {
  const response = await handle(req('GET', '/v1/bridge/iverif/status', {
    headers: { authorization: `Bearer ${IVERIF_TEST_READ_TOKEN}` },
  }), {
    kv: fakeKv(),
    iverifReadToken: IVERIF_TEST_READ_TOKEN,
    iverifExplee: fakeIVerifExplee({
      async getSnapshot() {
        throw new Error('pii-upstream-body-with-secret');
      },
    }),
  });

  assert.equal(response.status, 503);
  assert.equal(body(response).error, 'iverif_observer_unavailable');
  assert.doesNotMatch(response.body, /pii-|secret/);
});

test('lead runtime route executes one bounded IVerif capture/enrich run and replays durably', async () => {
  const db = new DatabaseSync(':memory:');
  applyNormalMigrations(db);
  const kv = fakeKv();
  let uuidIndex = 0;
  let inboxCalls = 0;
  let threadCalls = 0;
  const observer = fakeIVerifExplee({
    async getNeedReplyInbox() {
      inboxCalls += 1;
      return fakeIVerifExplee().getNeedReplyInbox();
    },
    async getThread(personId) {
      threadCalls += 1;
      return fakeIVerifExplee().getThread(personId);
    },
  });
  const deps = {
    kv,
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    iverifExplee: observer,
    leadRuntimeStore: d1LeadRuntimeStore(new SqliteD1Database(db)),
    now: () => '2026-07-20T18:00:00.000Z',
    uuid: () => `lead-route-${++uuidIndex}`,
  };
  const path = '/v1/bridge/lead-runs/iverif/capture-enrich';
  const request = (credential: string, payload: Record<string, unknown>) => handle(req('POST', path, {
    headers: { authorization: `Bearer ${credential}` },
    body: JSON.stringify(payload),
  }), deps);

  const scoped = await request('assign-only', { idempotencyKey: 'iverif-bounded-run-001' });
  assert.equal(scoped.status, 403);
  assert.equal(inboxCalls, 0);

  const malformed = await request('bridge', {
    idempotencyKey: 'iverif-bounded-run-001',
    provider: 'caller-override-forbidden',
  });
  assert.equal(malformed.status, 400);
  assert.equal(inboxCalls, 0);

  const unavailable = await handle(req('POST', path, {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ idempotencyKey: 'iverif-unavailable-run-001' }),
  }), {
    ...deps,
    leadRuntimeStore: {
      ...deps.leadRuntimeStore,
      async createTask() { throw new Error('sensitive-d1-diagnostic'); },
    },
  });
  assert.equal(unavailable.status, 503);
  assert.equal(body(unavailable).error, 'lead_runtime_unavailable');
  assert.doesNotMatch(unavailable.body, /sensitive|diagnostic/i);
  assert.equal(inboxCalls, 0);

  const completed = await request('bridge', { idempotencyKey: 'iverif-bounded-run-001' });
  assert.equal(completed.status, 200, completed.body);
  assert.equal(body(completed).status, 'completed');
  assert.equal(body(completed).receipt.spendUnits, 0);
  assert.equal(inboxCalls, 1);
  assert.equal(threadCalls, 1);

  const replay = await request('bridge', { idempotencyKey: 'iverif-bounded-run-001' });
  assert.equal(replay.status, 200, replay.body);
  assert.equal(body(replay).status, 'replay');
  assert.equal(body(replay).receipt.leadId, body(completed).receipt.leadId);
  assert.equal(inboxCalls, 1, 'terminal replay performs no provider read');
  assert.equal(threadCalls, 1, 'terminal replay performs no provider read');

  for (const table of [
    'lead_records',
    'lead_source_aliases',
    'lead_observation_receipts',
    'lead_loop_tasks',
    'lead_spend_reservations',
    'lead_provider_usage',
    'lead_cortex_foldbacks',
  ]) {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    assert.equal(Number(row.count), 1, table);
  }
  const spend = db.prepare(`
    SELECT reserved_units, settled_units, status FROM lead_spend_reservations
  `).get() as { reserved_units: number; settled_units: number; status: string };
  assert.deepEqual({ ...spend }, { reserved_units: 0, settled_units: 0, status: 'settled' });
  assert.deepEqual(await kv.list('action-request:'), []);
});

// ── Fixed-tenant marketing create renderer ──────────────────────────────

function marketingRoutePrepareInput(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'marketing-render-request-001',
    idempotencyKey: 'marketing-render-replay-001',
    actorId: 'operator-founder-001',
    budgetReservationId: 'budget-founder-article-001',
    expiresAt: '2026-07-18T14:00:00.000Z',
    brief: {
      briefId: 'asset-brief-founder-001',
      objective: 'Explain how governed organic media earns trust.',
      audience: 'Founder-led service businesses',
      callToAction: 'Review the workflow before adopting it.',
      productPacketId: 'thoughtseed-marketing@1.0.0',
      productPacketDigest: '2'.repeat(64),
      evidenceSnapshotDigest: '3'.repeat(64),
      seedDigest: '4'.repeat(64),
      facts: [{
        claimId: 'claim-governance-001',
        text: 'Every generated asset remains review-only until explicit approval.',
        sourceDigest: '5'.repeat(64),
      }],
    },
    ...overrides,
  };
}

function marketingRouteHarness(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  const db = new DatabaseSync(':memory:');
  applyNormalMigrations(db);
  const store = d1MarketingRenderStore(new SqliteD1Database(db));
  let uuidSequence = 0;
  const ids = ['approval-marketing-render-001', 'claim-marketing-render-001'];
  const deps = {
    kv: fakeKv(),
    bridgeToken: 'bridge',
    assignmentToken: 'assign-only',
    marketingRenderStore: store,
    marketingRenderer: {
      activation: MARKETING_CREATE_EXPECTED_ACTIVATION,
      apiKey: 'exclusive-worker-secret-value',
      fetchImpl,
    },
    now: () => '2026-07-18T13:00:00.000Z',
    uuid: () => ids[uuidSequence++] ?? `marketing-id-${uuidSequence}`,
    ...overrides,
  };
  return { db, store, deps };
}

async function prepareMarketingRoute(deps: any, payload = marketingRoutePrepareInput()) {
  return handle(req('POST', '/v1/bridge/marketing-renders/prepare', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(payload),
  }), deps);
}

test('marketing renderer route · only admin can prepare the immutable registered action', async () => {
  let fetches = 0;
  const { store, deps } = marketingRouteHarness(async () => {
    fetches += 1;
    return new Response('{}', { status: 500 });
  });

  const assignment = await handle(req('POST', '/v1/bridge/marketing-renders/prepare', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify(marketingRoutePrepareInput()),
  }), deps);
  assert.equal(assignment.status, 403);

  const override = await prepareMarketingRoute(deps, marketingRoutePrepareInput({ model: 'caller/model' }));
  assert.equal(override.status, 400);
  assert.equal(body(override).error, 'invalid_prepare_input');

  const prepared = await prepareMarketingRoute(deps);
  assert.equal(prepared.status, 200);
  assert.deepEqual(body(prepared), {
    ok: true,
    duplicate: false,
    requestId: 'marketing-render-request-001',
    adapterId: MARKETING_CREATE_ADAPTER_ID,
    actionDigest: body(prepared).actionDigest,
    status: 'awaiting_human_approval',
    nextAction: {
      route: '/api/gate/thoughtseed',
      kind: 'approve-marketing-render',
    },
  });
  assert.match(body(prepared).actionDigest, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(prepared.body, /exclusive-worker-secret-value|messages|promptTemplate/i);
  assert.ok(await store.getPrepared('marketing-render-request-001'));
  assert.equal(fetches, 0);
});

test('marketing renderer route · activation mismatch refuses before D1 preparation', async () => {
  let fetches = 0;
  const { store, deps } = marketingRouteHarness(async () => {
    fetches += 1;
    return new Response('{}');
  }, {
    marketingRenderer: {
      activation: 'wrong-activation',
      apiKey: 'exclusive-worker-secret-value',
    },
  });

  const response = await prepareMarketingRoute(deps);
  assert.equal(response.status, 503);
  assert.equal(body(response).error, 'renderer_disabled');
  assert.equal(await store.getPrepared('marketing-render-request-001'), null);
  assert.equal(fetches, 0);
});

test('marketing renderer route · missing exclusive secret refuses before D1 preparation', async () => {
  let storeCalls = 0;
  let fetches = 0;
  const { deps } = marketingRouteHarness(async () => {
    fetches += 1;
    return new Response('{}');
  }, {
    marketingRenderStore: {
      async prepare() {
        storeCalls += 1;
        throw new Error('prepare must not reach D1 without the renderer secret');
      },
    },
    marketingRenderer: {
      activation: MARKETING_CREATE_EXPECTED_ACTIVATION,
      apiKey: '   ',
      fetchImpl: async () => {
        fetches += 1;
        return new Response('{}');
      },
    },
  });

  const response = await prepareMarketingRoute(deps);
  assert.equal(response.status, 503);
  assert.deepEqual(body(response), { error: 'renderer_secret_missing' });
  assert.equal(storeCalls, 0);
  assert.equal(fetches, 0);
});

test('marketing renderer route · preparation normalizes D1 failures without leaking diagnostics', async () => {
  const { deps } = marketingRouteHarness(async () => new Response('{}'), {
    marketingRenderStore: {
      async prepare() { throw new Error('database-secret-diagnostic'); },
    },
  });
  const response = await prepareMarketingRoute(deps);
  assert.equal(response.status, 503);
  assert.equal(body(response).error, 'marketing_render_store_unavailable');
  assert.doesNotMatch(response.body, /database-secret-diagnostic/);
});

test('marketing renderer route · signed Thoughtseed founder approval is persisted and idempotent', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({
    botId: TEST_BOT_ID,
    userId: TEST_FOUNDER_A,
    authDate: NOW / 1000 - 30,
  });
  const { store, deps } = marketingRouteHarness(async () => new Response('{}'), {
    gate: gateCfg(pubKeyHex),
  });
  assert.equal((await prepareMarketingRoute(deps)).status, 200);

  deps.marketingRenderer.activation = 'wrong-activation';
  const disabled = await handle(req('POST', '/api/gate/thoughtseed', {
    body: JSON.stringify({
      kind: 'approve-marketing-render',
      requestId: 'marketing-render-request-001',
      subject: 'marketing-render-request-001',
      initData,
    }),
  }), deps);
  assert.equal(disabled.status, 503);
  assert.equal(body(disabled).error, 'renderer_disabled');
  assert.equal(await store.getApproval('approval-marketing-render-001'), null);
  deps.marketingRenderer.activation = MARKETING_CREATE_EXPECTED_ACTIVATION;

  const injectedAuthority = await handle(req('POST', '/api/gate/thoughtseed', {
    body: JSON.stringify({
      kind: 'approve-marketing-render',
      requestId: 'marketing-render-request-001',
      subject: 'marketing-render-request-001',
      actionDigest: '9'.repeat(64),
      initData,
    }),
  }), deps);
  assert.equal(injectedAuthority.status, 400);
  assert.equal(body(injectedAuthority).error, 'invalid_marketing_render_approval_input');
  assert.equal(await store.getApproval('approval-marketing-render-001'), null);

  const wrongTenant = await handle(req('POST', '/api/gate/cambium', {
    body: JSON.stringify({
      kind: 'approve-marketing-render',
      requestId: 'marketing-render-request-001',
      subject: 'marketing-render-request-001',
      initData,
    }),
  }), deps);
  assert.equal(wrongTenant.status, 403);

  const approved = await handle(req('POST', '/api/gate/thoughtseed', {
    body: JSON.stringify({
      kind: 'approve-marketing-render',
      requestId: 'marketing-render-request-001',
      subject: 'marketing-render-request-001',
      initData,
    }),
  }), deps);
  assert.equal(approved.status, 200);
  assert.deepEqual(body(approved), {
    ok: true,
    duplicate: false,
    requestId: 'marketing-render-request-001',
    approvalDecisionId: 'approval-marketing-render-001',
  });
  const persisted = await store.getApproval('approval-marketing-render-001');
  assert.equal(persisted?.approver_id, `telegram-founder-${TEST_FOUNDER_A}`);

  const duplicate = await handle(req('POST', '/api/gate/thoughtseed', {
    body: JSON.stringify({
      kind: 'approve-marketing-render',
      requestId: 'marketing-render-request-001',
      subject: 'marketing-render-request-001',
      initData,
    }),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).duplicate, true);
  assert.equal(body(duplicate).approvalDecisionId, 'approval-marketing-render-001');
});

test('marketing renderer route · persisted approval executes once and replays review-only output', async () => {
  let fetches = 0;
  const providerSecret = 'exclusive-worker-secret-value';
  const { initData, pubKeyHex } = await makeSignedInitData({
    botId: TEST_BOT_ID,
    userId: TEST_FOUNDER_B,
    authDate: NOW / 1000 - 30,
  });
  const { deps } = marketingRouteHarness(async (url, init) => {
    fetches += 1;
    assert.equal(String(url), MARKETING_CREATE_PROVIDER_URL);
    assert.equal((init?.headers as Record<string, string>).authorization, `Bearer ${providerSecret}`);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: 'Governed organic media',
        body: 'A review-only article grounded in verified facts.',
      }) } }],
      usage: { total_tokens: 321 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }, {
    gate: gateCfg(pubKeyHex),
  });
  assert.equal((await prepareMarketingRoute(deps)).status, 200);
  const approved = await handle(req('POST', '/api/gate/thoughtseed', {
    body: JSON.stringify({
      kind: 'approve-marketing-render',
      requestId: 'marketing-render-request-001',
      subject: 'marketing-render-request-001',
      initData,
    }),
  }), deps);
  const approvalDecisionId = body(approved).approvalDecisionId;

  const override = await handle(req('POST', '/v1/bridge/marketing-renders/marketing-render-request-001/execute', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ approvalDecisionId, model: 'caller/model' }),
  }), deps);
  assert.equal(override.status, 400);
  assert.equal(fetches, 0);

  const assignment = await handle(req('POST', '/v1/bridge/marketing-renders/marketing-render-request-001/execute', {
    headers: { authorization: 'Bearer assign-only' },
    body: JSON.stringify({ approvalDecisionId }),
  }), deps);
  assert.equal(assignment.status, 403);
  assert.equal(fetches, 0);

  const execute = () => handle(req('POST', '/v1/bridge/marketing-renders/marketing-render-request-001/execute', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ approvalDecisionId }),
  }), deps);
  const first = await execute();
  assert.equal(first.status, 200);
  assert.equal(body(first).status, 'succeeded');
  assert.equal(body(first).replayed, false);
  assert.equal(body(first).adapterId, MARKETING_CREATE_ADAPTER_ID);
  assert.equal(body(first).publishEligible, false);
  assert.equal(body(first).externalAction, 'none');
  assert.equal(body(first).artifact.status, 'draft');
  assert.equal(body(first).receipt.state, 'awaiting_human_approval');
  assert.doesNotMatch(first.body, new RegExp(providerSecret));

  const replay = await execute();
  assert.equal(replay.status, 200);
  assert.equal(body(replay).replayed, true);
  assert.equal(body(replay).artifactDigest, body(first).artifactDigest);
  assert.deepEqual(body(replay).artifact, body(first).artifact);
  assert.equal(fetches, 1);
});

test('marketing renderer route · missing exclusive secret fails closed without provider egress', async () => {
  let fetches = 0;
  const { deps } = marketingRouteHarness(async () => {
    fetches += 1;
    return new Response('{}');
  }, {
    marketingRenderer: {
      activation: MARKETING_CREATE_EXPECTED_ACTIVATION,
      fetchImpl: async () => {
        fetches += 1;
        return new Response('{}');
      },
    },
  });

  const response = await handle(req('POST', '/v1/bridge/marketing-renders/marketing-render-request-001/execute', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify({ approvalDecisionId: 'approval-marketing-render-001' }),
  }), deps);
  assert.equal(response.status, 503);
  assert.equal(body(response).error, 'renderer_secret_missing');
  assert.equal(fetches, 0);
});

test('marketing renderer runtime · Worker bindings stay exclusive and execute without generic NVIDIA authority', async () => {
  const db = new DatabaseSync(':memory:');
  applyNormalMigrations(db);
  const kvRows = new Map<string, string>();
  const { initData, pubKeyHex } = await makeSignedInitData({
    botId: TEST_BOT_ID,
    userId: TEST_FOUNDER_A,
    authDate: Math.floor(Date.now() / 1000) - 30,
  });
  const exclusiveSecret = 'exclusive-worker-secret-value';
  const genericSecret = 'generic-secret-must-not-be-used';
  let providerFetches = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    providerFetches += 1;
    assert.equal(String(url), MARKETING_CREATE_PROVIDER_URL);
    assert.equal((init?.headers as Record<string, string>).authorization, `Bearer ${exclusiveSecret}`);
    assert.notEqual((init?.headers as Record<string, string>).authorization, `Bearer ${genericSecret}`);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: 'Governed organic media',
        body: 'A review-only article grounded in verified facts.',
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const env = {
    QUESTS: {
      async get(key: string) { return kvRows.get(key) ?? null; },
      async put(key: string, value: string) { kvRows.set(key, value); },
      async list({ prefix }: { prefix: string }) {
        return { keys: [...kvRows.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })) };
      },
    },
    BRIDGE_DB: new SqliteD1Database(db),
    BRIDGE_TOKEN: 'bridge',
    GATE_BOT_ID: TEST_BOT_ID,
    GATE_FOUNDER_IDS: TEST_FOUNDER_A,
    GATE_TG_PUBKEY: pubKeyHex,
    MARKETING_CREATE_ACTIVATION: MARKETING_CREATE_EXPECTED_ACTIVATION,
    NVIDIA_MARKETING_CREATE_API_KEY: exclusiveSecret,
    NVIDIA_API_KEY: genericSecret,
  };
  try {
    const prepare = await worker.fetch(new Request('https://worker.example/v1/bridge/marketing-renders/prepare', {
      method: 'POST',
      headers: { authorization: 'Bearer bridge', 'content-type': 'application/json' },
      body: JSON.stringify(marketingRoutePrepareInput({
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })),
    }), env as any);
    assert.equal(prepare.status, 200);

    const approve = await worker.fetch(new Request('https://worker.example/api/gate/thoughtseed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'approve-marketing-render',
        requestId: 'marketing-render-request-001',
        subject: 'marketing-render-request-001',
        initData,
      }),
    }), env as any);
    assert.equal(approve.status, 200);
    const approvalDecisionId = (await approve.json() as any).approvalDecisionId;

    const execute = await worker.fetch(new Request('https://worker.example/v1/bridge/marketing-renders/marketing-render-request-001/execute', {
      method: 'POST',
      headers: { authorization: 'Bearer bridge', 'content-type': 'application/json' },
      body: JSON.stringify({ approvalDecisionId }),
    }), env as any);
    assert.equal(execute.status, 200);
    const result = await execute.json() as any;
    assert.equal(result.status, 'succeeded');
    assert.equal(result.publishEligible, false);
    assert.equal(result.externalAction, 'none');
    assert.equal(providerFetches, 1);
    assert.doesNotMatch(JSON.stringify(result), /exclusive-worker-secret-value|generic-secret-must-not-be-used/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const providerMap = source.match(/const providers:[\s\S]*?const workerFetch/)?.[0] ?? '';
  assert.doesNotMatch(providerMap, /NVIDIA_MARKETING_CREATE_API_KEY|MARKETING_CREATE_ACTIVATION/);
});
test('rbac · no principal keeps the founder envelope byte-verbatim and surface-free', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const get = await handle(req('GET', '/api/quests/cambium'), deps);
  assert.equal(get.status, 200);
  assert.equal(get.body, ENVELOPE);
  assert.equal(body(get).surface, undefined);
});

test('rbac · consultant principal receives filtered surface — no signed-action, no sheet-primary subsections', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const consultant = encodeURIComponent(JSON.stringify({
    id: 'c1', tenant: 'cambium', role: 'consultant', allow: ['tapestry', 'wake'], createdBy: 'founder-1',
  }));
  const get = await handle(req('GET', `/api/quests/cambium?principal=${consultant}`), deps);
  assert.equal(get.status, 200);
  const surface = body(get).surface;
  assert.ok(surface, 'surface present for consultant');
  const subsectionIds = surface.subsections.map((s: { id: string }) => s.id);
  assert.deepEqual(subsectionIds, ['tapestry', 'wake']);
  for (const sub of surface.subsections) {
    assert.equal(sub.interactions.primary, 'sheet');
    const signed = (sub.interactions.controls ?? []).filter((c: { interaction: string }) => c.interaction === 'signed-action');
    assert.equal(signed.length, 0, 'signed-action controls stripped');
  }
  assert.equal(surface.sections.length, 0, 'all section primaries exceed consultant ceiling');
});

test('rbac · team principal keeps chat-command but loses signed-action controls', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const team = JSON.stringify({ id: 't1', tenant: 'cambium', role: 'team', allow: [], createdBy: 'founder-1' });
  const get = await handle(req('GET', '/api/quests/cambium', { headers: { 'x-principal': team } }), deps);
  assert.equal(get.status, 200);
  const surface = body(get).surface;
  assert.ok(surface.subsections.length > 0, 'team sees subsections');
  for (const sub of surface.subsections) {
    const kinds = [sub.interactions.primary, ...(sub.interactions.secondary ?? []), ...(sub.interactions.controls ?? []).map((c: { interaction: string }) => c.interaction)];
    assert.ok(!kinds.includes('signed-action'), `subsection ${sub.id} carries no signed-action`);
  }
});

test('rbac · expired principal receives empty surface', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const expired = JSON.stringify({
    id: 'c2', tenant: 'cambium', role: 'consultant', allow: ['tapestry'], createdBy: 'founder-1',
    expiresAt: '2020-01-01T00:00:00.000Z',
  });
  const get = await handle(req('GET', '/api/quests/cambium', { headers: { 'x-principal': expired } }), deps);
  assert.equal(get.status, 200);
  const surface = body(get).surface;
  assert.deepEqual(surface.sections, []);
  assert.deepEqual(surface.subsections, []);
});

test('invites · founder issues an invite and verification round-trips', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', inviteSecret: 's', nowMs: () => 1_000_000 };
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: ['tapestry', 'wake'], createdBy: 'founder-1' }),
  }), deps);
  assert.equal(issue.status, 200);
  const issued = body(issue);
  assert.equal(issued.principal.role, 'consultant');
  assert.equal(issued.principal.tenant, 'cambium');
  assert.deepEqual(issued.principal.allow, ['tapestry', 'wake']);
  assert.equal(issued.principal.createdBy, 'founder-1');
  assert.equal(issued.inviteUrl, `/app?invite=${issued.token}`);

  const verify = await handle(req('GET', `/v1/invites/verify?token=${issued.token}`), deps);
  assert.equal(verify.status, 200);
  assert.equal(body(verify).ok, true);
  assert.deepEqual(body(verify).principal, issued.principal);
});

test('invites · consultant invite token filters the quest surface to the allow-list', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', inviteSecret: 's' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: ['tapestry', 'wake'], createdBy: 'founder-1' }),
  }), deps);
  assert.equal(issue.status, 200);
  const { token } = body(issue);
  const get = await handle(req('GET', `/api/quests/cambium?invite=${token}`), deps);
  assert.equal(get.status, 200);
  const surface = body(get).surface;
  assert.ok(surface, 'surface present for invite principal');
  const subsectionIds = surface.subsections.map((s: { id: string }) => s.id);
  assert.deepEqual(subsectionIds, ['tapestry', 'wake']);
  for (const sub of surface.subsections) {
    const signed = (sub.interactions.controls ?? []).filter((c: { interaction: string }) => c.interaction === 'signed-action');
    assert.equal(signed.length, 0, 'signed-action controls stripped');
  }
  assert.equal(surface.sections.length, 0, 'all section primaries exceed consultant ceiling');
});

test('invites · invite for another tenant is rejected with 403', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', inviteSecret: 's' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const issue = await handle(req('POST', '/v1/invites/acme', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: [], createdBy: 'founder-1' }),
  }), deps);
  assert.equal(issue.status, 200);
  const get = await handle(req('GET', `/api/quests/cambium?invite=${body(issue).token}`), deps);
  assert.equal(get.status, 403);
  assert.equal(body(get).error, 'invite tenant mismatch');
});

test('invites · tampered token is rejected with 401', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', inviteSecret: 's' };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: [], createdBy: 'founder-1' }),
  }), deps);
  assert.equal(issue.status, 200);
  const token = String(body(issue).token);
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  const verify = await handle(req('GET', `/v1/invites/verify?token=${tampered}`), deps);
  assert.equal(verify.status, 401);
  assert.equal(body(verify).ok, false);
  const get = await handle(req('GET', `/api/quests/cambium?invite=${tampered}`), deps);
  assert.equal(get.status, 401);
  assert.equal(body(get).error, 'invite invalid');
});

test('invites · expired invite is rejected with 401', async () => {
  const kv = fakeKv();
  let now = 1_000_000;
  const deps = { kv, pushToken: 't', inviteSecret: 's', nowMs: () => now };
  await handle(req('POST', '/internal/ledger/cambium', { body: ENVELOPE, headers: { authorization: 'Bearer t' } }), deps);
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: [], createdBy: 'founder-1', ttlMs: 1000 }),
  }), deps);
  assert.equal(issue.status, 200);
  const { token } = body(issue);
  now += 2000;
  const verify = await handle(req('GET', `/v1/invites/verify?token=${token}`), deps);
  assert.equal(verify.status, 401);
  assert.deepEqual(body(verify), { ok: false, reason: 'expired' });
  const get = await handle(req('GET', `/api/quests/cambium?invite=${token}`), deps);
  assert.equal(get.status, 401);
  assert.equal(body(get).error, 'invite expired');
});

test('invites · missing inviteSecret 503s the invite endpoints', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't' };
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: [], createdBy: 'founder-1' }),
  }), deps);
  assert.equal(issue.status, 503);
  const verify = await handle(req('GET', '/v1/invites/verify?token=x.y'), deps);
  assert.equal(verify.status, 503);
});

test('invites · bad bearer on the issue endpoint is rejected with 401', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', inviteSecret: 's' };
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer wrong' },
    body: JSON.stringify({ allow: [], createdBy: 'founder-1' }),
  }), deps);
  assert.equal(issue.status, 401);
});

test('invites · ttlMs over the 30 day cap is rejected with 400', async () => {
  const kv = fakeKv();
  const deps = { kv, pushToken: 't', inviteSecret: 's' };
  const issue = await handle(req('POST', '/v1/invites/cambium', {
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ allow: [], createdBy: 'founder-1', ttlMs: 31 * 24 * 3600 * 1000 }),
  }), deps);
  assert.equal(issue.status, 400);
});


// ── T-019/T-020 · Tools scene fixture states (docs/architecture/contracts/scenes/tools.json) ──
const TOOLS_SCENE_FIXTURE = JSON.parse(
  readFileSync(new URL('./page/scenes/fixtures/tools.fixture.json', import.meta.url), 'utf8'),
) as { states: Record<string, { envelope: Record<string, unknown> }> };

function toolsFixtureEnvelope(state: string) {
  // The scene fixture intentionally carries no quest ledger; add a minimal empty one so paint()
  // runs (load() short-circuits envelopes without a ledger before CMDDATA is set).
  return {
    ...TOOLS_SCENE_FIXTURE.states[state]!.envelope,
    ledger: { completed: 0, total: 0, current: null, rows: [] },
  };
}

test('tools fixture · normal state renders suggested handoffs action and live surfaces', async () => {
  const rendered = await renderPageFixtureContext(toolsFixtureEnvelope('normal'), { now: '2026-07-24T09:15:00.000Z' });
  (rendered.context.renderCommands as () => void)();
  const toolsHtml = rendered.elements.get('cmds')!.innerHTML;

  // Fixture expectation: founder decision context is the current blocker → Suggested → Handoffs.
  assert.match(toolsHtml, /data-tool-recommend-surface="handoffs"/);
  assert.match(toolsHtml, /a founder decision blocks this branch/);
  assert.match(toolsHtml, /3 agents · 5 open/);
  assert.match(toolsHtml, /data-tool-surface="handoffs"[\s\S]*1 waiting/);
  // Availability: live surfaces ready; handoffs active with one waiting founder decision.
  assert.match(toolsHtml, /data-tool-surface="handoffs"[\s\S]*aria-label="state: ready"/);
  assertNoPrimaryMetaCopy(toolsHtml);
  assert.doesNotMatch(toolsHtml, /\/ts-|Copy command|data-copy-command|chat syntax|payload preview/i);

  // frozen/05 §1: Tools tab word cap is 80 words at rest.
  const words = visibleTextFromHtml(toolsHtml).split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 80, `Tools tab renders ${words.length} words at rest (cap 80)`);
});

test('tools fixture · blocked state degrades handoffs to on hold and suggests proof receipt', async () => {
  const rendered = await renderPageFixtureContext(toolsFixtureEnvelope('blocked'), { now: '2026-07-24T09:18:00.000Z' });
  (rendered.context.renderCommands as () => void)();
  const toolsHtml = rendered.elements.get('cmds')!.innerHTML;

  // Fixture expectation: proof-needed rows should become a progress receipt; zero open gate
  // items → Handoffs locked ('on hold'), read-only.
  assert.match(toolsHtml, /data-tool-recommend-surface="status"/);
  assert.match(toolsHtml, /proof rows need a progress receipt/);
  assert.match(toolsHtml, /data-interaction-kind="read-only"(?=[^>]*data-tool-surface="handoffs")/);
  assert.match(toolsHtml, /data-tool-surface="handoffs"[\s\S]*aria-label="state: on hold"/);

  (rendered.context.openToolSurfaceSheet as (id: string) => void)('handoffs');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /no handoffs waiting/);
  assert.doesNotMatch(sheet, /data-signed-action-entrypoint|\/ts-/i);
});

test('tools fixture · empty state renders stale surfaces, idle suggestion, and retry recovery', async () => {
  const rendered = await renderPageFixtureContext(toolsFixtureEnvelope('empty'), { now: '2026-07-24T09:21:00.000Z' });
  (rendered.context.renderCommands as () => void)();
  const toolsHtml = rendered.elements.get('cmds')!.innerHTML;

  // Fixture expectation: commands envelope null → every live surface stale ('refresh first'),
  // recommendation panel EMPTY.
  assert.equal((toolsHtml.match(/aria-label="state: refresh first"/g) || []).length >= 5, true);
  assert.match(toolsHtml, /data-tool-recommend-state="empty"/);
  assert.match(toolsHtml, /no suggestion yet/);
  assert.match(toolsHtml, /data-tool-suggest-mission="1"/);
  assert.doesNotMatch(toolsHtml, /\/ts-|Copy command/i);

  (rendered.context.openToolSurfaceSheet as (id: string) => void)('hermes');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /live data unreachable · pull to refresh/);
  assert.match(sheet, /data-tool-retry="hermes"/);
  assert.doesNotMatch(sheet, /no Hermes service data|\/ts-/i);
  assertNoSecretLeak(sheet);
});

test('tools fixture · normal handoffs row approves in-app and flips the surface card', async () => {
  const rendered = await renderPageFixtureContext(toolsFixtureEnvelope('normal'), {
    now: '2026-07-24T09:15:00.000Z',
    telegramInitData: TEST_TELEGRAM_INIT_DATA,
    fetchResponder: ({ init }) =>
      init.method === 'POST'
        ? { queued: 'gate-queue-9', id: 'fx-handoff-001', idempotencyKey: 'approve:cambium:fx-handoff-001' }
        : undefined,
  });
  (rendered.context.renderCommands as () => void)();
  (rendered.context.openToolSurfaceSheet as (id: string) => void)('handoffs');

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /data-component="ToolHandoffActionRow"/);
  assert.match(sheet, /Approve proof packet dispatch/);
  const approve = rendered.elements.get('sheetBody')!.querySelectorAll('[data-tool-act]').find((node) => node.dataset.toolAct === 'approve');
  (approve.onclick as () => void)();
  const preflight = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(preflight, /Queues founder approval for fx-handoff-001; nothing mutates until an operator consumes the queue\./);
  assert.match(preflight, /data-gate-idempotency-key="approve:cambium:fx-handoff-001"/);

  rendered.elements.get('sheetBody')!.querySelector('[data-gate-confirm]').click();
  await flushPageAsync();

  const post = rendered.fetchRequests.find((request) => request.method === 'POST' && /\/api\/gate\/cambium/.test(request.url));
  assert.ok(post, 'fixture handoff POSTs through the gate client');
  const payload = JSON.parse(String(post!.body));
  assert.equal(payload.kind, 'approve');
  assert.equal(payload.subject, 'fx-handoff-001');
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /data-component="GateReceiptToken"/);
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /decision queued · receipt in Inspect/);
  assert.match(
    rendered.elements.get('cmds')!.querySelector('[data-tool-surface="handoffs"]')!.innerHTML,
    /queued · approve · approve:cambium:fx-handoff-001/,
  );
});

test('page · T-026 KpiPulse donut renders every frozen stop 0/25/50/75/100 with exact dash geometry', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const donut = rendered.context.mcKpiDonut as (opts: Record<string, unknown>) => string;
  const stopOf = rendered.context.mcKpiDonutStop as (value: unknown) => number;

  // frozen/04: dotted-ring gauges at 0/25/50/75/100 — pathLength 100, arc offset = 100 - stop.
  const matrix: Array<[number, string, number]> = [
    [0, 'idle', 100],
    [25, 'active', 75],
    [50, 'active', 50],
    [75, 'proof-needed', 25],
    [100, 'complete', 0],
  ];
  for (const [value, state, offset] of matrix) {
    const html = donut({ value, state });
    assert.match(html, new RegExp(`class="mc-kpi-donut is-${state}" data-component="KpiPulseDonut" data-donut-stop="${value}" data-state="${state}"`), `donut stop ${value} carries its state token`);
    assert.match(html, new RegExp(`pathLength="100" style="stroke-dashoffset:${offset}" transform="rotate\\(-90 32 32\\)"`), `stop ${value} dash geometry`);
    assert.match(html, /data-component="OrbitProgress"/, `stop ${value} builds on OrbitProgress`);
    assert.equal((html.match(/class="mc-orbit-node"/g) || []).length, 4, `stop ${value} keeps the 4 cardinal nodes`);
    assert.match(html, /aria-label="progress \d+% · \w[\w-]*"/, `stop ${value} pairs the ring with a readout (never color alone)`);
  }

  // served progress snaps to the nearest frozen stop (deterministic, ties resolve downward).
  assert.equal(stopOf(-5), 0);
  assert.equal(stopOf(12), 0);
  assert.equal(stopOf(13), 25);
  assert.equal(stopOf(28), 25);
  assert.equal(stopOf(42), 50);
  assert.equal(stopOf(64), 75);
  assert.equal(stopOf(87), 75);
  assert.equal(stopOf(88), 100);
  assert.equal(stopOf(140), 100);
});

test('page · T-026 KpiPulse donut state variants: blocked/stale render no fill, reduced-motion is static', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const donut = rendered.context.mcKpiDonut as (opts: Record<string, unknown>) => string;

  // blocked — peach dashed track + centered warning triangle, no fill (frozen/01 OrbitProgress).
  const blocked = donut({ value: 36, state: 'blocked' });
  assert.match(blocked, /class="mc-kpi-donut is-blocked" data-component="KpiPulseDonut" data-donut-stop="25" data-state="blocked"/);
  assert.match(blocked, /class="mc-orbit-warning"/, 'blocked donut carries the peach warning triangle');
  assert.match(blocked, /stroke-dashoffset:100/, 'blocked donut renders no fill');

  // stale — faint dashed track, dimmer nodes, no fill.
  const stale = donut({ value: 18, state: 'stale' });
  assert.match(stale, /data-donut-stop="25" data-state="stale"/);
  assert.match(stale, /stroke-dashoffset:100/, 'stale donut renders no fill');

  // reduced-motion — full solid thin mint ring, static: no fill arc, no motion attributes, no packets.
  const reduced = donut({ value: 50, state: 'reduced-motion' });
  assert.match(reduced, /class="mc-kpi-donut is-reduced-motion" data-component="KpiPulseDonut" data-donut-stop="50" data-state="reduced-motion"/);
  assert.match(reduced, /stroke-dashoffset:100/, 'reduced-motion donut renders the static ring (arc hidden by CSS)');
  assert.doesNotMatch(reduced, /data-motion=/, 'reduced-motion donut is static');
  assert.doesNotMatch(reduced, /data-component="PacketFlow"/, 'reduced-motion donut renders no packets');
  assert.match(PAGE, /\.mc-orbit\.is-reduced-motion \.mc-orbit-track\{stroke:rgba\(214,255,246,\.6\);stroke-dasharray:none/, 'reducedMotion state = full solid thin mint ring');
  assert.match(PAGE, /\.mc-orbit\.is-reduced-motion \.mc-orbit-arc\{display:none\}/);
  assert.match(PAGE, /@media \(prefers-reduced-motion: reduce\)/);

  // donut animation is stroke-dashoffset only; the concentric badge ring is absolute (zero geometry).
  assert.match(PAGE, /@keyframes orbitSweep\{from\{stroke-dashoffset:100\}\}/);
  assert.match(PAGE, /\.mc-kpi-donut::before\{content:"";position:absolute;inset:6px;border:1px dashed rgba\(214,255,246,\.2\);border-radius:50%;pointer-events:none\}/);
  assert.match(PAGE, /\.mc-kpi-donut\.is-blocked::before\{border-color:rgba\(255,199,161,\.34\)\}/);
});

test('page · T-026 KpiPulse packet bars render served values', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const bars = rendered.context.mcKpiBars as (progress: number, state: string) => string;

  // ~15 thin bars; lit count = round(served/100 × 15) — the served value, not the snapped donut stop.
  const served: Array<[number, number]> = [[0, 0], [25, 4], [50, 8], [75, 11], [100, 15]];
  for (const [progress, lit] of served) {
    const html = bars(progress, 'active');
    assert.match(html, /class="mc-kpi-bars" data-component="PacketFlow" data-packet-mode="packet-bar"/);
    assert.match(html, new RegExp(`data-signal-depth="${lit}" data-signal-total="15"`), `${progress}% reports depth ${lit}`);
    assert.equal((html.match(/data-active="true"/g) || []).length, lit, `${progress}% lights ${lit} bars`);
    assert.equal((html.match(/--mc-spark-h:/g) || []).length, 15, `${progress}% renders 15 bars`);
    assert.match(html, /aria-label="signal depth \d+ of 15"/, `${progress}% pairs bars with a readout`);
  }
  assert.match(bars(50, 'blocked'), /data-state="blocked"/);
  assert.match(PAGE, /\.mc-kpi-bars\.is-blocked i\[data-active="true"\]\{background:rgba\(255,199,161,\.66\)/, 'blocked bars tint peach');
});

test('page · T-026 KpiPulse metric card snaps the donut to a frozen stop while bars keep the served value', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const kpi = rendered.context.mcKpiPulse as (row: Record<string, unknown>, index: number, opts?: Record<string, unknown>) => string;

  // idle state → served progress 64 → donut snaps to stop 75; bars keep served 64 → 10 lit.
  const pulse = kpi({ label: 'Qualified waitlist', currentState: 'signal served', survival: 'waitlist', betterThanSurvival: 'paid pilot' }, 0);
  assert.match(pulse, /data-component="KpiPulse" data-kpi-kind="survival" data-state="idle" data-donut-stop="75"/);
  assert.match(pulse, /data-component="KpiPulseDonut" data-donut-stop="75" data-state="idle"/);
  assert.match(pulse, /stroke-dashoffset:25/, 'stop 75 dash geometry');
  assert.match(pulse, /data-signal-depth="10" data-signal-total="15"/, 'bars keep the served value');

  // backward-compatible default copy shaping (T-013/T-014 contract unchanged).
  assert.match(pulse, /<b>Survival: Qualified waitlist<\/b><span>signal served · survival: waitlist<\/span>/);
  const better = kpi({ label: 'Pilot' }, 1);
  assert.match(better, /<b>Better: Pilot<\/b><span>better-than-survival proof pending<\/span>/);

  // opts copy override (Mission scene M10 path): empty detail deletes the second line.
  const shaped = kpi({ label: 'Waitlist', currentState: 'not proven', survival: 'qualified waitlist' }, 0, { title: 'Survival: Waitlist', detail: 'not proven' });
  assert.match(shaped, /<b>Survival: Waitlist<\/b><span>not proven<\/span>/);
  assert.match(shaped, /data-donut-stop="50" data-state="proof-needed"/, 'proof-needed served KPI lands on stop 50');
  const noDetail = kpi({ label: 'Pilot' }, 1, { title: 'Better: Pilot', detail: '' });
  assert.match(noDetail, /<b>Better: Pilot<\/b><\/span>/, 'empty detail deletes the line (M10)');
  assert.doesNotMatch(pulse, /mc-kpi-pulse/);
});

test('page · T-026 component gallery renders the KpiPulse metric state matrix', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    search: '?tenant=cambium&scene=components',
  });
  const html = rendered.elements.get('mapwrap')!.innerHTML;

  assert.match(html, /data-component="ComponentKpiPulseBoard"/);
  assert.match(html, /7\. KpiPulse Matrix/);
  for (const stop of [0, 25, 50, 75, 100]) {
    assert.match(html, new RegExp(`data-component="KpiPulseDonutAsset" data-donut-stop="${stop}"`), `matrix covers stop ${stop}`);
  }
  for (const state of ['idle', 'active', 'proof-needed', 'complete', 'blocked', 'stale', 'reduced-motion']) {
    assert.match(html, new RegExp(`data-component="KpiPulseDonutAsset"[^>]*data-state="${state}"`), `matrix covers state ${state}`);
  }
  // 5 frozen stops + 3 state variants; every cell pairs donut + packet bars + caption.
  assert.equal((html.match(/data-component="KpiPulseDonutAsset"/g) || []).length, 8);
  const board = html.slice(html.indexOf('data-component="ComponentKpiPulseBoard"'));
  assert.equal((board.match(/data-component="KpiPulseDonut"/g) || []).length, 8);
  assert.equal((board.match(/class="mc-kpi-bars" data-component="PacketFlow"/g) || []).length, 8);
  assert.match(board, /0% · idle/);
  assert.match(board, /100% · complete/);
  assert.match(board, /50% · reduced-motion/);
});

test('page · T-026 Mission KPI row uses the shared KpiPulse metric card', async () => {
  const envelope = {
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    branchStories: {
      source: 'product-branch-packets@v1',
      rows: [{
        branchId: 'fitcheck',
        name: 'Fitcheck',
        arcTitle: 'Launch arc',
        questline: [{ id: 'proof', title: 'Collect proof', status: 'active' }],
        missions: [{ missionId: 'launch-proof', title: 'Launch proof packet', owner: 'Build', gate: 'Founder review', proofRequired: 'Viewport capture', dispatchTarget: 'Plexus' }],
        gates: [{ gate: 'Founder review', status: 'blocked', requiredProof: 'Viewport capture' }],
        kpis: [{ kpiId: 'waitlist', label: 'Waitlist', survival: 'qualified waitlist', betterThanSurvival: 'paid pilot', currentState: 'not proven' }],
        proofPaths: [{ proofId: 'viewport', validates: 'Viewport capture', promotes: 'supervised branch' }],
        promotion: { state: 'proof-only', currentGate: 'Founder review', rule: 'proof first' },
      }],
    },
  };
  const rendered = await renderPageFixtureContext(envelope, { search: '?tenant=cambium&scene=mission' });
  const html = rendered.elements.get('stem')!.innerHTML;

  // shared component: KpiPulse row → KpiPulseDonut badge → OrbitProgress, snapped stop, served bars.
  assert.match(html, /data-component="KpiPulse" data-kpi-kind="survival" data-state="proof-needed" data-donut-stop="50"/);
  assert.match(html, /class="mc-kpi-donut is-proof-needed" data-component="KpiPulseDonut" data-donut-stop="50" data-state="proof-needed"/);
  assert.match(html, /data-component="KpiPulseDonut"[\s\S]*?data-component="OrbitProgress"[\s\S]*?stroke-dashoffset:50/);
  assert.match(html, /class="mc-kpi-bars" data-component="PacketFlow" data-packet-mode="packet-bar" data-state="proof-needed" data-signal-depth="6" data-signal-total="15"/);
  assert.match(html, /<b>Survival: Waitlist<\/b><span>not proven<\/span>/);

  // layout regression guards — row structure + copy budget unchanged.
  assert.match(html, /<div data-component="KpiPulse"><div class="mc-section-title">KPIs<\/div><div class="mc-kpis">/);
  assert.equal((html.match(/class="mc-kpi-row"/g) || []).length, 1, 'one KPI row at rest (M10 trim)');
  assert.doesNotMatch(html, /mc-kpi-pulse/);
  assert.match(PAGE, /\.mc-kpi-row\{display:grid;grid-template-columns:auto minmax\(0,1fr\) auto/);
});
