// cambium-quests · pure handler tests (node:test, like everything beside it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { handle } from './handler.ts';
import { d1BridgeStore, d1FabricLedgerStore } from './index.ts';
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
import { PAGE } from './page.ts';
import {
  FRESH_ECOSYSTEM_VISUAL_FIXTURE,
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
      return row && row.delivered === 0 ? { directive_json: row.directive_json } : null;
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
    if (q.startsWith('insert or replace into bridge_directives')) {
      const [member_id, id, directive_json, enqueued_at] = values;
      this.directives.set(this.key(member_id, id), { member_id, id, directive_json, delivered: 0, enqueued_at, delivered_at: null });
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

const req = (method: string, path: string, extra: Partial<SimpleRequest> = {}): SimpleRequest =>
  ({ method, path, headers: {}, ...extra });

const body = (r: { body: string }) => JSON.parse(r.body);

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
];

function assertNoPrimaryMetaCopy(html: string) {
  for (const term of PRIMARY_MISSION_COPY_DENYLIST) {
    assert.doesNotMatch(html, new RegExp(escapeRegExp(term), 'i'), `primary copy leaked meta term: ${term}`);
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

function makeElement(id: string) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    style: fakeStyle(),
    classList: new FakeClassList(),
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
    clientWidth: 390,
    scrollTop: 0,
    onclick: null as unknown,
    addEventListener() {},
    setPointerCapture() {},
    querySelectorAll() { return []; },
    querySelector() { return makeElement(`${id}:query`); },
  };
}

async function renderPageFixtureContext(
  envelope: unknown,
  options: { search?: string; rejectFetch?: boolean; now?: string; fetchSequence?: unknown[]; clipboard?: boolean } = {},
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

  const fetchCalls: string[] = [];
  const clipboardWrites: string[] = [];
  const fetchSequence = [...(options.fetchSequence ?? [])];
  const fixedNow = options.now ? Date.parse(options.now) : null;
  const context: Record<string, unknown> = {
    document: { getElementById, querySelectorAll: () => [] },
    window: { Telegram: undefined, addEventListener() {}, innerWidth: 390 },
    location: { search: options.search ?? '' },
    matchMedia: () => ({ matches: true }),
    navigator: options.clipboard ? { clipboard: { writeText: async (text: string) => { clipboardWrites.push(String(text)); } } } : {},
    fetch: async (url: string) => {
      fetchCalls.push(String(url));
      if (options.rejectFetch) throw new Error('fixture fetch failed');
      const next = fetchSequence.length ? fetchSequence.shift() : envelope;
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
  context.globalThis = context;
  vm.runInContext(scripts[0], vm.createContext(context));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { elements, context, fetchCalls, clipboardWrites };
}

async function renderPageFixture(envelope: unknown) {
  const { elements } = await renderPageFixtureContext(envelope);
  return elements;
}

test('healthz · ok', async () => {
  const r = await handle(req('GET', '/healthz'), { kv: fakeKv() });
  assert.equal(r.status, 200);
  assert.match(r.body, /cambium-quests/);
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
  assert.match(PAGE, /no fake progress/);
  assert.match(PAGE, /telegram-web-app\.js/);
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

test('page · active scene badge opens view details sheet', async () => {
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
  for (const target of ['telegram', 'hermes', 'paperclip', 'cambium-worker', 'quine', 'quest-ledger', 'operator-policy', 'operator-skills', 'operator-narrative', 'cortex', 'r3f', 'github', 'skills', 'gtm', 'distribution', 'vault-via-paperclip', 'live-proof', 'product-branches']) {
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
    'branch-arcs',
    'branch-missions',
    'branch-kpis',
    'branch-gates',
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
  assert.deepEqual(byId['founder-gate']?.interactions, { primary: 'signed-action' });
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
      ],
    },
    source: 'served beats or complete quest rows',
  });
  assert.deepEqual(byId.inspect, {
    id: 'inspect',
    scene: 'inspect',
    target: 'cambium-worker',
    interactions: { primary: 'sheet' },
    source: 'shared/cambium-visual-contract.ts and served visual envelope proofs',
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
  assert.deepEqual(byId['branch-proof'], {
    id: 'branch-proof',
    target: 'product-branches',
    interactions: { primary: 'external-proof' },
    source: 'BranchStoryArc proof foldback',
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
  const html = [
    rendered.elements.get('mapwrap')!.innerHTML,
    rendered.elements.get('beats')!.innerHTML,
    rendered.elements.get('cmds')!.innerHTML,
  ].join('');

  assertNoInertPseudoButtons(html);
  assert.match(html, /class="rail [^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="shared\/cambium-visual-contract")/);
  assert.match(html, /class="beat[^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="mission-story@v1")/);
  assert.match(html, /class="cmd live[^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="mission-toolbelt-live@v1")/);
  assert.match(html, /class="cmd act[^"]*"(?=[^>]*data-interaction-kind="chat-command")(?=[^>]*data-source="curios\.self-chat-command")/);
  assert.match(html, /class="cmd ref[^"]*"(?=[^>]*data-interaction-kind="read-only")(?=[^>]*data-source="curios\.self-command-reference")/);
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
  const rendered = await renderPageFixtureContext(envelope);
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
  assert.match(storyHtml, /data-component="StoryPacketTrail"/);
  assert.match(PAGE, /data-story-warning="contradiction"/);
  assert.match(storyHtml, /data-component="MissionGlyph"/);
  assert.match(storyHtml, /data-component="StateToken"/);
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
  assert.match(noesisSheet, /group<\/b><span>Drift/);
  assert.match(noesisSheet, /lane<\/b><span>noesis/);
  assert.match(noesisSheet, /text<\/b><span>The mid-brain woke/);
  assert.match(noesisSheet, /source<\/b><span>deviations/);
  assert.match(noesisSheet, /context link<\/b><span>inspect/);
  assert.match(noesisSheet, /Open Inspect/);
  assert.match(noesisSheet, /action<\/b><span>read-only story row; no execution action/);
  assert.doesNotMatch(noesisSheet, /data-kind="approve"|data-kind="reroll"|data-promote-skill|data-queue-side-quest/);

  (rendered.context.openStoryBeat as (index: number) => void)(1);
  const paperclipSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(paperclipSheet, /source<\/b><span>paperclipActivityBeats/);
  assert.match(paperclipSheet, /vault write<\/b><span>no direct vault write/);
  assert.doesNotMatch(paperclipSheet, /thoughtseed-vault|direct vault write action|data-kind=/i);
});

test('page · empty story names mission movement wait state', async () => {
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

  assert.match(storyHtml, /Story is waiting for mission movement/);
  assert.match(storyHtml, /New wins, signals, lessons, and drift/);
  assert.match(storyHtml, /data-source="mission-story@v1"/);
  assert.match(storyHtml, /data-story-empty-action="mission"/);
  assert.match(storyHtml, /data-story-empty-action="inspect"/);
  assert.doesNotMatch(storyHtml, /class="beat/);
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
  assert.match(PAGE, /renderOperatorMap/);
  assert.match(PAGE, /Inspect/);
  assert.match(PAGE, /stage-card/);
});

test('page · commands track Hermes services in the mini app', () => {
  assert.match(PAGE, /ts-hermes/);
  assert.match(PAGE, /Check timers and service health/);
  assert.match(PAGE, /Ask/);
  assert.match(PAGE, /Act/);
  assert.match(PAGE, /Coordinate/);
  assert.match(PAGE, /Report/);
});

test('page · Tools renders mission-effect cards before command syntax', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  (rendered.context.renderCommands as () => void)();
  const toolsHtml = rendered.elements.get('cmds')!.innerHTML;

  for (const group of ['Act', 'Ask', 'Report', 'Coordinate']) {
    assert.match(toolsHtml, new RegExp(`<div class="cmdgrp">${group}<\\/div>`));
  }
  assert.match(toolsHtml, /data-component="ToolActionCard"/);
  assert.match(toolsHtml, /data-component="ToolRecommendationPanel"/);
  assert.match(toolsHtml, /data-component="ToolGroupSegmentedControl"/);
  assert.match(toolsHtml, /data-component="ToolContextChips"/);
  assert.match(toolsHtml, /data-component="ToolRecentStrip"/);
  assert.match(toolsHtml, /data-tool-group="Act"/);
  assert.match(PAGE, /data-disabled-reason="live command data unavailable"/);
  assert.match(toolsHtml, /data-inspect-target="tools"/);
  assert.match(toolsHtml, /data-component="MissionGlyph"/);
  assert.match(toolsHtml, /data-component="StateToken"/);
  assert.match(toolsHtml, /Mission effect<\/b>Assign the next mission step[\s\S]*<span class="cname">\/ts-run<\/span>/);
  assert.match(toolsHtml, /Mission effect<\/b>Check timers and service health[\s\S]*<span class="cname">\/ts-hermes<\/span>/);
  assertNoPrimaryMetaCopy(toolsHtml);
  assert.doesNotMatch(toolsHtml, /paperclipCommandsData|gateway|debug/i);
});

test('page · command reference, action, and digest cards open inspectable copy sheets', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
    clipboard: true,
  });
  const openCommandCardSheet = rendered.context.openCommandCardSheet as (name: string) => void;

  openCommandCardSheet('ts-agent');
  let sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /command · read-only/);
  assert.match(sheet, /chat syntax<\/b><span>\/ts-agent &lt;name&gt;/);
  assert.match(sheet, /source<\/b><span>curios\.self-command-reference/);
  assert.match(sheet, /payload preview<\/b><span>\/ts-agent &lt;name&gt;/);
  assert.match(sheet, /data-component="ToolSafetyRow"/);
  assert.match(sheet, /Copy command text/);
  assert.doesNotMatch(sheet, /data-gate-confirm|data-signed-action-entrypoint|\/api\/gate|bot response|sent to bot/i);

  for (const name of ['ts-project', 'ts-vault']) {
    openCommandCardSheet(name);
    sheet = rendered.elements.get('sheetBody')!.innerHTML;
    assert.match(sheet, /command · read-only/);
    assert.match(sheet, new RegExp(`chat syntax<\\/b><span>\\/${name}`));
    assert.match(sheet, /source<\/b><span>curios\.self-command-reference/);
  }

  for (const name of ['ts-run', 'ts-approve', 'ts-reject']) {
    openCommandCardSheet(name);
    sheet = rendered.elements.get('sheetBody')!.innerHTML;
    assert.match(sheet, /interaction<\/b><span>chat-command/);
    assert.match(sheet, /source<\/b><span>curios\.self-chat-command/);
    assert.match(sheet, /mini app writes<\/b><span>none; copy only, no signed gate endpoint/);
    assert.doesNotMatch(sheet, /data-gate-confirm|data-signed-action-entrypoint|\/api\/gate|bot response|sent to bot/i);
  }

  for (const name of ['ts-standup', 'ts-digest', 'ts-help']) {
    openCommandCardSheet(name);
    sheet = rendered.elements.get('sheetBody')!.innerHTML;
    assert.match(sheet, /interaction<\/b><span>chat-command/);
    assert.match(sheet, /signed action button<\/b><span>not rendered for command sheets/);
    assert.doesNotMatch(sheet, /data-gate-confirm|data-signed-action-entrypoint|data-promote-skill|data-queue-side-quest/i);
  }

  const beforeCopyFetches = rendered.fetchCalls.length;
  const copyCommandToClipboard = rendered.context.copyCommandToClipboard as (text: string) => Promise<{ ok: boolean; copied?: string }>;
  const result = await copyCommandToClipboard('/ts-run Mira refresh proof');
  assert.equal(result.ok, true);
  assert.deepEqual(rendered.clipboardWrites, ['/ts-run Mira refresh proof']);
  assert.equal(rendered.fetchCalls.length, beforeCopyFetches);
  assert.ok(!rendered.fetchCalls.some((url) => /\/api\/gate/.test(url)));
});

test('page · command copy falls back to read-only text without clipboard API', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  (rendered.context.openCommandCardSheet as (name: string) => void)('ts-vault');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /command text<\/b><span>\/ts-vault &lt;path&gt;/);
  assert.match(sheet, /clipboard unavailable; select and copy this read-only command text/);
  assert.doesNotMatch(sheet, /Copy command text|data-copy-command/);
});

test('page · command live sheets name Paperclip and Hermes data sources', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
    clipboard: true,
  });
  const openCmdSheet = rendered.context.openCmdSheet as (key: string) => void;

  openCmdSheet('status');
  let sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /source<\/b><span>Paperclip command data · paperclipCommandsData/);
  assert.match(sheet, /agents<\/b><span>3/);
  assert.match(sheet, /work open<\/b><span>2/);
  assert.match(sheet, /work done<\/b><span>7/);
  assert.match(sheet, /arcs<\/b><span>3\/17/);
  assert.match(sheet, /Hermes<\/b><span>ready/);
  assert.match(sheet, /Copy command text/);
  assert.match(sheet, /data-copy-command="\/ts-status"/);

  openCmdSheet('hermes');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /source<\/b><span>Hermes runtime · paperclipCommandsData/);
  assert.match(sheet, /service statuses<\/b><span>2/);
  assert.match(sheet, /Hermes Telegram brain/);
  assert.match(sheet, /curios\.self command bridge reachable/);
  assert.match(sheet, /data-copy-command="\/ts-hermes"/);

  openCmdSheet('agents');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /source<\/b><span>paperclipCommandsData/);
  assert.match(sheet, /Mira/);
  assert.match(sheet, /model · operator-npc-events@v1 · source paperclipCommandsData/);
  assert.match(sheet, /data-copy-command="\/ts-agents"/);

  openCmdSheet('work');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /THO-42/);
  assert.match(sheet, /active/);
  assert.match(sheet, /title Refresh mini app proof surface · owner operator · source paperclipCommandsData/);
  assert.match(sheet, /data-copy-command="\/ts-projects"/);

  openCmdSheet('handoffs');
  sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /HND-7/);
  assert.match(sheet, /waiting-founder/);
  assert.match(sheet, /title Approve fresh viewport capture · source paperclipCommandsData · gate relation founder gate review context only/);
  assert.match(sheet, /data-copy-command="\/ts-handoffs"/);
});

test('page · unavailable command sheet names Paperclip gateway and refresh-only recovery', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.openCmdSheet as (key: string) => void)('status');
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Paperclip gateway unreachable/);
  assert.match(sheet, /Pull-to-refresh only/);
  assert.match(sheet, /does not write local state/);
  assert.match(sheet, /synthesize command results/);
  assert.match(sheet, /command text<\/b><span>\/ts-status/);
  assert.doesNotMatch(sheet, /\/api\/gate/);
  assertNoSecretLeak(sheet);
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
    'mc-kpi-pulse',
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
    '.mc-orbit::after,.mc-orbit[data-motion="orbitSweep"]::after,.mc-selected-halo[data-motion="orbitSweep"]::after,.mc-packet-dots[data-motion="packetDrift"],.mc-glyph[data-motion="glyphBreathe"] svg,.mc-state-token{animation:none!important}',
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
  for (const m of ['const STAGES', 'const RAILS', 'stageForArc', 'Proof, packet, freshness, and system detail', 'Inspect keeps the low-level proof rows']) {
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
  const inspectHtml = rendered.elements.get('mapwrap')!.innerHTML;

  assert.match(inspectHtml, /data-component="InspectGroupStack"/);
  for (const group of ['freshness', 'policy', 'live-proof', 'branch-packets', 'gates', 'tools', 'rails', 'evidence']) {
    assert.match(inspectHtml, new RegExp(`data-component="InspectGroup"[^>]*data-inspect-group="${group}"`));
  }
  assert.match(inspectHtml, /data-inspect-target="tools"/);
  assert.match(inspectHtml, /data-component="InspectProofSummaryAction"/);
  assert.match(inspectHtml, /data-inspect-summary="1"/);
  assert.match(inspectHtml, /Inspect keeps the low-level proof rows out of Mission, Gate, Tools, and Story/);
  (rendered.context.openInspectGroupSheet as (id: string, env: unknown) => void)('tools', FRESH_ECOSYSTEM_VISUAL_FIXTURE);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /inspect · tools/);
  assert.match(sheet, /debug layer<\/b><span>Inspect keeps proof and architecture details behind the main app flow/);
  assert.match(sheet, /related page<\/b><span>Tools/);
  assert.match(sheet, /data-inspect-page-link="tools"/);

  (rendered.context.openInspectSummarySheet as (env: unknown) => void)(FRESH_ECOSYSTEM_VISUAL_FIXTURE);
  const summarySheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(summarySheet, /Proof Summary/);
  assert.match(summarySheet, /redaction rule<\/b><span>no raw initData, bearer token, or secret value/);
  assert.match(summarySheet, /data-copy-proof-summary=/);
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
  for (const m of ['env.wake && Array.isArray', 'env.lanes || {}', 'env.senses || {}', 'env.insights || {}', 'env.stance || {}', 'env.policy || {}', 'env.decisionContext || {}', 'env.liveProof || {}', 'env.branchStories || {}', 'env.sideQuests || {}', 'env.social || {}', 'env.skills || {}', 'env.npc || {}', 'age > 360', 'freshness missing']) {
    assert.ok(PAGE.includes(m), `page has partial/stale guard ${m}`);
  }
});

test('page · gate chamber previews consequence, reversibility, evidence, and idempotency', () => {
  for (const m of ['GateChamber', 'GateMissionCard', 'GateStateStack', 'GateOrbitProgress', 'GateActionCard', 'GateEmptyState', 'GateBranchFilterChips', 'GateRowExpansionDetails', 'gateSource', 'gateOwner', 'gateUpdatedAt', 'gateEvidence', 'gateReversibility', 'gateQueueConsequence', 'renderGateItem', 'renderGateEmpty', 'renderGateFilters', 'openGateDetailSheet', 'isGateAuthFailure', 'gateConsequence', 'gateIdempotency', 'approveConsequence', 'rerollConsequence', 'idempotencyHint', 'idempotencyKey', 'reversible until consumed']) {
    assert.ok(PAGE.includes(m), `page has gate preview ${m}`);
  }
  assert.match(PAGE, /data-signed-action-entrypoint="approve"/);
  assert.match(PAGE, /data-signed-action-entrypoint="reroll"/);
  assert.match(PAGE, /openGatePreflight\('approve'/);
  assert.match(PAGE, /openGatePreflight\('reroll'/);
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

  assert.match(gate, /Decision waiting<\/b><span>THO-9/);
  assert.match(gate, /Branch \/ mission<\/b><span>branch not served · Review launch copy/);
  assert.match(gate, /Proof attached<\/b><span>THO-9 blocked by launch copy review/);
  assert.match(gate, /Approve consequence<\/b><span>queue founder approval for THO-9/);
  assert.match(gate, /Reroll consequence<\/b><span>queue founder reroll request for THO-9/);
  assert.match(gate, /Reversibility<\/b><span>queued action can be superseded until consumed/);
  assert.match(gate, /detail sheets carry audit proof/);
  assert.match(gate, /data-component="GateBranchFilterChips"/);
  assert.match(gate, /data-component="GateRowExpansionDetails"/);
  assert.match(gate, /data-gate-detail="1"/);
  assert.match(gate, /data-interaction-kind="signed-action"/);
  assert.doesNotMatch(gate, /origin ·|Paperclip execution|before execution|executed by the org|source route|initData|\/api\/gate/);

  (rendered.context.openGateDetailSheet as (node: unknown) => void)({ dataset: { i: '0', id: 'THO-9' } });
  const detailSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(detailSheet, /gate detail · proof/);
  assert.match(detailSheet, /proof attached<\/b><span>THO-9 blocked by launch copy review/);
  assert.match(detailSheet, /sync state<\/b><span>ready for founder review|sync state<\/b><span>blocked until proof resolves/);
  assert.match(detailSheet, /data-gate-detail-nav="mission"/);
  assert.match(detailSheet, /data-gate-detail-nav="inspect"/);
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

  assert.match(gate, /queue founder approval for THO-9; no Paperclip\/org mutation until the operator consumes the queue/);
  assert.doesNotMatch(gate, /changes Paperclip handling/);
  assert.doesNotMatch(gate, /queue founder decision changes/);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', node);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /queue founder approval for THO-9; no Paperclip\/org mutation until the operator consumes the queue/);
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
  assert.match(approveSheet, /gate preflight · explicit confirmation/);
  assert.match(approveSheet, /<h2>Approve Gate Item<\/h2>/);
  assert.match(approveSheet, /action kind<\/b><span>approve/);
  assert.match(approveSheet, /subject<\/b><span>THO-9/);
  assert.match(approveSheet, /evidence<\/b><span>THO-9 blocked by launch copy review/);
  assert.match(approveSheet, /consequence<\/b><span>queue founder approval for THO-9; no Paperclip\/org mutation until the operator consumes the queue/);
  assert.match(approveSheet, /reversibility<\/b><span>queued action can be superseded until consumed/);
  assert.match(approveSheet, /source<\/b><span>Paperclip/);
  assert.match(approveSheet, /source route<\/b><span>\/api\/gate\/cambium/);
  assert.match(approveSheet, /initData status<\/b><span>missing until opened inside Telegram/);
  assert.match(approveSheet, /idempotency<\/b><span>approve:cambium:THO-9:blocked/);
  assert.match(approveSheet, /data-gate-confirm="approve"/);
  assert.equal(rendered.fetchCalls.length, fetchCount);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('reroll', 'THO-9', node);
  const rerollSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(rerollSheet, /<h2>Reroll Gate Item<\/h2>/);
  assert.match(rerollSheet, /action kind<\/b><span>reroll/);
  assert.match(rerollSheet, /consequence<\/b><span>queue founder reroll request for THO-9; no Paperclip\/org mutation until the operator consumes the queue/);
  assert.match(rerollSheet, /idempotency<\/b><span>reroll:cambium:THO-9:blocked/);
  assert.match(rerollSheet, /data-gate-confirm="reroll"/);
  assert.equal(rendered.fetchCalls.length, fetchCount);
});

test('page · Gate warning attention rests after one pass', () => {
  assert.match(PAGE, /warningAttention 2\.4s var\(--ease\) 1 both/);
  assert.doesNotMatch(PAGE, /warningAttention 2\.4s var\(--ease\) infinite/);
});

test('page · gate auth and duplicate results open explicit sheets', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);

  (rendered.context.openGateTelegramAuthFailure as (error: string) => void)('missing initData (the gate opens inside Telegram)');
  const authSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(authSheet, /Telegram auth · blocked/);
  assert.match(authSheet, /Open inside Telegram/);
  assert.match(authSheet, /must run inside Telegram/);
  assert.match(authSheet, /queue write<\/b><span>none/);

  (rendered.context.openGateResultSheet as (kind: string, subject: string, res: unknown, fallback: unknown) => void)('approve', 'THO-9', {
    queued: 'fixed-uuid',
    duplicate: true,
    idempotencyKey: 'approve:cambium:THO-9',
    consequence: 'queue founder approval for THO-9',
    reversibility: 'queued action can be superseded until consumed',
  }, { idempotencyKey: 'approve:cambium:THO-9', consequence: 'fallback', reversibility: 'fallback' });
  const duplicateSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(duplicateSheet, /Original Queued Action Reused/);
  assert.match(duplicateSheet, /does not imply a new write/);
  assert.match(duplicateSheet, /queued action<\/b><span>fixed-uuid/);
  assert.match(duplicateSheet, /idempotency<\/b><span>approve:cambium:THO-9/);
  assert.match(duplicateSheet, /data-gate-result-nav="mission"/);
  assert.match(duplicateSheet, /data-gate-result-nav="inspect"/);
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
    fetchSequence: [envelope, envelope, { error: 'stale auth_date' }],
  });
  const node = { dataset: { i: '0', id: 'THO-9' }, style: {}, innerHTML: '' };

  (rendered.context.gateAct as (kind: string, subject: string, node: unknown) => void)('approve', 'THO-9', node);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /Telegram auth · blocked/);
  assert.match(sheet, /valid founder auth/);
  assert.match(sheet, /response<\/b><span>stale auth_date/);
  assert.match(sheet, /queue write<\/b><span>none/);
  assert.match(String(node.innerHTML), /refused: stale auth_date · no local queue write/);
});

test('page · no-fake-progress visual fixture renders explicit gaps', async () => {
  const elements = await renderPageFixture(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const map = elements.get('mapwrap')!.innerHTML;
  const stem = elements.get('stem')!.innerHTML;
  const progress = elements.get('progress')!.textContent;
  assert.match(stem, /Mission control is waiting for branch packets/);
  assert.match(stem, /No fake progress/);
  assert.match(progress, /branch packets waiting/);
  assert.match(map, /Inspect/);
  assert.match(map, /Proof, packet, freshness, and system detail/);
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
  assert.match(map, /3\/10 readiness checks blocked/);
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
  assert.match(map, /DEVICE WEBVIEW PROOF/);
  assert.match(map, /3\/4 prerequisites blocked/);
  assert.match(map, /WORKER LIST PROOF/);
  assert.match(map, /SIGNED ACTION SMOKE/);
  assert.match(map, /first session unplayed/);
  assert.equal(elements.get('fresh')!.classList.has('stale'), true);
  assert.doesNotMatch(map, /100% success|founder affinity|relationship level|recommended next|live proof ready|verified founder device|reward unlocked|level up|leaderboard|social proof/i);
});

test('page · quest progress summary opens source-backed sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.renderQuests as (ledger: unknown) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  const progress = rendered.elements.get('progress')!;

  assert.equal(progress.dataset.interactionKind, 'sheet');
  assert.equal(progress.dataset.source, 'visual-fixture:no-fake-progress');
  (progress.onclick as () => void)();

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /quest progress · quine/);
  assert.match(sheet, /completed count<\/b><span>0/);
  assert.match(sheet, /total count<\/b><span>17/);
  assert.match(sheet, /source<\/b><span>visual-fixture:no-fake-progress/);
  assert.match(sheet, /active quest id<\/b><span>the-calling/);
});

test('page · frontier summary opens active quest evidence sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.renderQuests as (ledger: unknown) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  const here = rendered.elements.get('here')!;

  assert.equal(here.dataset.interactionKind, 'sheet');
  assert.equal(here.dataset.source, 'visual-fixture:no-fake-progress');
  (here.onclick as () => void)();

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /quest frontier · quine/);
  assert.match(sheet, /current arc<\/b><span>I/);
  assert.match(sheet, /quest title<\/b><span>The Calling/);
  assert.match(sheet, /evidence<\/b><span>first session unplayed/);
});

test('page · legacy quest rows and quest sheet expose Quine provenance', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.renderQuests as (ledger: unknown) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);
  const stem = rendered.elements.get('stem')!.innerHTML;
  const questRows = stem.match(/class="q /g) ?? [];
  const quineTargets = stem.match(/data-ecosystem-target="quine"/g) ?? [];

  assert.equal(questRows.length, NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger.rows.length);
  assert.equal(quineTargets.length, questRows.length);

  (rendered.context.openSheet as (row: unknown) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger.rows[0]);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /source<\/b><span>visual-fixture:no-fake-progress/);
  assert.match(sheet, /status<\/b><span class="status-active">active/);
  assert.match(sheet, /arc<\/b><span>I/);
  assert.match(sheet, /quest id<\/b><span>the-calling/);
  assert.match(sheet, /evidence<\/b><span>first session unplayed/);
  assert.match(sheet, /next action source<\/b><span>policy gap:/);
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
  assert.equal(rendered.elements.get('fresh')!.textContent, 'stale refresh ignored');
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

  for (const text of ['Fitcheck', 'Next Mission', 'Launch proof packet', 'State Stack', 'Blocked by', 'Proof needed', 'Waitlist', 'Review Gate', 'Open Proof']) {
    assert.match(html, new RegExp(text));
  }
  assert.match(html, /data-no-scene-drag="1" data-mission-action="gate" data-interaction-kind="sheet"/);
  assert.match(html, /data-no-scene-drag="1" data-mission-action="proof" data-interaction-kind="sheet"/);
  assert.match(html, /data-component="MissionStateStack"/);
  assert.match(html, /data-component="GateActionRow"/);
  assert.match(html, /data-component="MissionToolLink"/);
  assert.match(html, /data-mission-action="tools"/);
  assert.match(html, /data-mission-proof-row="1"/);
  assert.match(html, /data-component="MissionOrganSignal"/);
  assert.match(html, /data-organ-route="taste"/);
  assert.match(html, /data-glyph-kind="taste"/);
  assert.match(html, /data-selected-surface="branch-chip"/);
  assert.match(html, /data-selected-surface="mission-state-row"/);
  assert.equal((html.match(/mc-selected-halo/g) || []).length, 2);
  assert.match(html, /data-component="SignalRail"[^>]*data-state="blocked"[\s\S]*data-component="PacketFlow"/);
  assert.match(html, /data-packet-mode="texture"/);
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

test('page · primary Mission Gate Tools and Story copy denylist keeps meta language in Inspect', async () => {
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
    assert.match(sheet, new RegExp(`operator map · ${stageId}`));
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
  (rendered.context.go as (index: number) => void)(3);
  assert.equal(rendered.elements.get('tb3')!.classList.has('on'), true);
  assert.equal(rendered.elements.get('sceneBadge')!.textContent, 'Story');
  (rendered.context.renderStory as (env: unknown) => void)({
    beats: [{ text: 'reduced motion story beat remains visible', lane: 'quest' }],
  });
  const storyHtml = rendered.elements.get('beats')!.innerHTML;
  assert.match(storyHtml, /reduced motion story beat remains visible/);
  assert.match(storyHtml, /data-interaction-kind="sheet"/);

  const mapHtml = rendered.elements.get('mapwrap')!.innerHTML;
  assert.match(mapHtml, /data-signed-action-entrypoint="queue-side-quest"/);

  (rendered.context.renderCommands as () => void)();
  const commandHtml = rendered.elements.get('cmds')!.innerHTML;
  assert.match(commandHtml, /class="cmd live[^"]*"(?=[^>]*data-interaction-kind="sheet")/);
  assert.match(commandHtml, /class="cmd act[^"]*"(?=[^>]*data-interaction-kind="chat-command")/);
  assert.match(commandHtml, /class="cmd ref[^"]*"(?=[^>]*data-interaction-kind="read-only")/);

  (rendered.elements.get('sceneBadge')!.onclick as () => void)();
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /reduced motion proof<\/b><span[^>]*data-reduced-motion-proof="1"/);
  assert.match(sheet, /data-sheet="true"/);
  assert.match(sheet, /data-signed-action="true"/);
  assert.match(sheet, /data-chat-command="true"/);
  assert.match(sheet, /data-read-only="true"/);
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

test('visual fixtures · fresh ecosystem fixture renders command and story proof', async () => {
  const rendered = await renderPageFixtureContext(FRESH_ECOSYSTEM_VISUAL_FIXTURE, {
    now: FRESH_ECOSYSTEM_VISUAL_FIXTURE.freshness.proofClock,
  });
  (rendered.context.renderCommands as () => void)();
  assert.match(rendered.elements.get('cmds')!.innerHTML, /Check timers and service health/);
  assert.match(rendered.elements.get('beats')!.innerHTML, /Hermes routed a fresh command snapshot/);
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
  const map = rendered.elements.get('mapwrap')!.innerHTML;
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
  assert.match(sheet, /ready<\/b><span>7/);
  assert.match(sheet, /blocked<\/b><span>3/);
  assert.match(sheet, /total<\/b><span>10/);
  assert.match(sheet, /liveProofReady<\/b><span>false/);
  assert.match(sheet, /blocked row 1<\/b><span>DEVICE WEBVIEW PROOF/);
  assert.match(sheet, /blocked row 2<\/b><span>WORKER LIST PROOF/);
  assert.match(sheet, /blocked row 3<\/b><span>SIGNED ACTION SMOKE/);
  assert.match(sheet, /proof only after their artifacts validate ready/);
  assert.doesNotMatch(sheet, /all requirements complete|production verified|live proof ready/i);
});

test('page · tapestry audit renders every row as a target-backed sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
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
  assert.match(sheet, /<h2>commands<\/h2>/);
  assert.match(sheet, /org data unavailable/);
  assert.match(sheet, /gateway was unreachable at the last refresh/);
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
  assert.match(map, /DEVICE WEBVIEW PROOF/);
  assert.match(map, /3\/4 prerequisites blocked/);
  (rendered.context.openLiveProofBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, 0);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /capture plan · not proof · blocked/);
  assert.match(sheet, /tg-live-proof-capture-plan/);
  assert.match(sheet, /telegram-webview\.json/);
  assert.match(sheet, /--capture-device-proof/);
  assert.match(sheet, /artifact stores user\/initData\/screenshot hashes only/);
  assert.match(sheet, /Capture commands create redacted receipts; they are proof only after their artifacts validate ready/);
  assert.doesNotMatch(map + sheet, /live proof ready|verified founder device|raw initData stored|browser wrote/i);
});

test('page · wake cards prefer served visual-envelope proof over local inference', async () => {
  const elements = await renderPageFixture({
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
  const elements = await renderPageFixture({
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
  const elements = await renderPageFixture({
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
  const elements = await renderPageFixture({
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
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /NEXT ACTION/);
  assert.match(map, /Review gate item THO-9: Review launch copy/);
  assert.match(map, /critical risk · blocks-delivery dependency/);
  assert.doesNotMatch(map, /approve THO-9 for Paperclip execution/);
  assert.doesNotMatch(map, /reroll THO-9 and request revision before execution/);
});

test('page · skill labor cards render conservative tiers and sample gaps', async () => {
  const elements = await renderPageFixture({
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
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /UNPROVEN · need 3 uses for tier; found 1/);
  assert.match(map, /DECLINING · recent success 33% below 50% over 3 uses/);
  assert.match(map, /promotion: NO PROMOTION/);
  assert.doesNotMatch(map, /candidate · 1 uses · 100% success/);
});

test('page · skill promotion cards require founder approval before production', async () => {
  const elements = await renderPageFixture({
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
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /cambium-founder-review/);
  assert.match(map, /promotion: FOUNDER REVIEW/);
  assert.match(map, /founder approval required/);
  assert.match(map, /cambium-production-approved/);
  assert.match(map, /promotion: PRODUCTION/);
  assert.doesNotMatch(map, /auto-promoted|automatic production|promoted automatically/i);
});

test('page · skill promotion sheet exposes signed founder review queue action', () => {
  for (const m of ['skillPromotionAct', 'promote-skill', 'Queue founder review', 'promotion queued for', 'skill registry remains unchanged']) {
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
      threadId: 799,
      sourceMessageId: '852',
      memberId: 'shesh',
      summary: 'Build route proof is stale and needs a fresh worker probe.',
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
  assert.deepEqual(body(queued).topic, { topicKey: 'dev', threadId: 799, questId: 'the-build' });

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

test('bridge · assignment race does not enqueue orphan D1 directives', async () => {
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
    async putDirective(memberId: string, id: string, directive: Record<string, unknown>) {
      directiveWrites++;
      await inner.putDirective(memberId, id, directive);
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
  assert.equal(directiveWrites, 0);
  assert.equal(db.directives.size, 0);
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
