// cambium-quests · pure handler tests (node:test, like everything beside it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handle } from './handler.ts';
import type {
  FabricEvidenceCandidateRecord,
  FabricEvidenceReviewRecord,
  FabricLedgerEventRecord,
  FabricLedgerStoreLike,
  FabricLedgerTaskRecord,
  KvLike,
  SimpleRequest,
} from './handler.ts';
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

  async getEvent(eventId: string) { return this.events.get(eventId) ?? null; }
  async putEvent(record: FabricLedgerEventRecord) { this.events.set(record.eventId, record); }
  async getTask(taskId: string) { return this.tasks.get(taskId) ?? null; }
  async findTasks() { return [...this.tasks.values()]; }
  async upsertTask(record: FabricLedgerTaskRecord) { this.tasks.set(record.taskId, record); }
  async putEvidenceCandidate(record: FabricEvidenceCandidateRecord) { this.candidates.set(record.candidateId, record); }
  async getEvidenceCandidate(candidateId: string) { return this.candidates.get(candidateId) ?? null; }
  async listReviewItems() { return [...this.candidates.values()].filter((candidate) => candidate.status === 'review_pending'); }
  async updateEvidenceCandidate(record: FabricEvidenceCandidateRecord) { this.candidates.set(record.candidateId, record); }
  async putEvidenceReview(record: FabricEvidenceReviewRecord) { this.reviews.set(record.reviewId, record); }
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

test('page · five scenes with map tab and sliding indicator', () => {
  for (const m of ['>Quests<', '>Map<', '>Story<', '>Gate<', '>Commands<', 'class="ind"', 'translateX']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
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

test('page · active scene badge opens provenance sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.go as (index: number) => void)(1);
  const badge = rendered.elements.get('sceneBadge')!;
  assert.equal(badge.textContent, 'Map');
  (badge.onclick as () => void)();
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /scene provenance · map/);
  assert.match(sheet, /scene source<\/b><span>tg-miniapp-scenes@v1/);
  assert.match(sheet, /ecosystem target<\/b><span>r3f/);
  assert.match(sheet, /refresh rule<\/b><span>pull-to-refresh re-fetches \/api\/quests\/cambium and does not write operator state/);
});

test('page · scene and refresh provenance follow the active tenant', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search: '?tenant=acme' });
  assert.equal(rendered.elements.get('ten')!.textContent, 'acme');
  assert.equal(rendered.elements.get('ptr')!.dataset.refreshRoute, '/api/quests/acme');
  assert.match(rendered.elements.get('ptrProof')!.textContent, /\/api\/quests\/acme/);
  assert.deepEqual(rendered.fetchCalls.slice(-1), ['/api/quests/acme']);
  (rendered.elements.get('sceneBadge')!.onclick as () => void)();
  assert.match(rendered.elements.get('sheetBody')!.innerHTML, /re-fetches \/api\/quests\/acme and does not write operator state/);
});

test('mini app surface contract · exports current scene ids', () => {
  assert.deepEqual(MINI_APP_SCENE_IDS, ['quests', 'map', 'story', 'gate', 'commands']);
});

test('mini app surface contract · maps ecosystem targets', () => {
  for (const target of ['telegram', 'hermes', 'paperclip', 'cambium-worker', 'quine', 'quest-ledger', 'operator-policy', 'operator-skills', 'operator-narrative', 'cortex', 'r3f', 'github', 'vault-via-paperclip', 'live-proof']) {
    assert.ok(MINI_APP_ECOSYSTEM_TARGETS.includes(target as never), `target ${target} is inventoried`);
  }
});

test('mini app surface contract · exports interaction kind ids', () => {
  assert.deepEqual(MINI_APP_INTERACTION_KINDS, ['sheet', 'signed-action', 'chat-command', 'read-only', 'external-proof']);
});

test('mini app surface contract · inventories current page sections', () => {
  assert.deepEqual(MINI_APP_SECTION_IDS, ['quest-line', 'operator-map', 'story-feed', 'founder-gate', 'command-center']);
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
  assert.deepEqual(byId['command-center'], {
    id: 'command-center',
    scene: 'commands',
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
});

test('mini app surface contract · records map subsection interaction semantics', () => {
  const byId = Object.fromEntries(MINI_APP_MAP_SUBSECTIONS.map((section) => [section.id, section]));
  assert.deepEqual(byId.skills, {
    id: 'skills',
    target: 'github',
    interactions: {
      primary: 'sheet',
      controls: [
        { id: 'promote-skill-review', interaction: 'signed-action', source: 'skill promotion review queue' },
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
  assert.match(html, /class="beat[^"]*"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="quest-ledger")/);
  assert.match(html, /class="cmd live"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="paperclipCommandsData")/);
  assert.match(html, /class="cmd act"(?=[^>]*data-interaction-kind="chat-command")(?=[^>]*data-source="curios\.self-chat-command")/);
  assert.match(html, /class="cmd ref"(?=[^>]*data-interaction-kind="read-only")(?=[^>]*data-source="curios\.self-command-reference")/);
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
  const rows = [...storyHtml.matchAll(/<div class="beat[^"]*"[^>]*>/g)].map((match) => match[0]);

  assert.equal(rows.length, envelope.beats.length);
  for (const [index, row] of rows.entries()) {
    assert.match(row, new RegExp(`data-beat="${index}"`));
    assert.match(row, /data-interaction-kind="sheet"/);
  }
  for (const [lane, target] of [
    ['heartbeat', 'quine'],
    ['paperclip', 'paperclip'],
    ['forge', 'operator-skills'],
    ['noesis', 'operator-narrative'],
    ['quest', 'quest-ledger'],
  ]) {
    assert.match(storyHtml, new RegExp(`data-lane="${lane}"(?=[^>]*data-ecosystem-target="${target}")`));
  }

  (rendered.context.openStoryBeat as (index: number) => void)(3);
  const noesisSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(noesisSheet, /story beat · noesis/);
  assert.match(noesisSheet, /lane<\/b><span>noesis/);
  assert.match(noesisSheet, /text<\/b><span>The mid-brain woke/);
  assert.match(noesisSheet, /source<\/b><span>deviations/);
  assert.match(noesisSheet, /action<\/b><span>read-only story row; no execution action/);
  assert.doesNotMatch(noesisSheet, /data-kind="approve"|data-kind="reroll"|data-promote-skill|data-queue-side-quest/);

  (rendered.context.openStoryBeat as (index: number) => void)(1);
  const paperclipSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(paperclipSheet, /source<\/b><span>paperclipActivityBeats/);
  assert.match(paperclipSheet, /vault write<\/b><span>no direct vault write/);
  assert.doesNotMatch(paperclipSheet, /thoughtseed-vault|direct vault write action|data-kind=/i);
});

test('page · empty story names complete quest fallback source', async () => {
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

  assert.match(storyHtml, /Story waiting for complete quest rows/);
  assert.match(storyHtml, /falls back to complete quest rows from quest-ledger/);
  assert.match(storyHtml, /data-source="quest-ledger"/);
  assert.doesNotMatch(storyHtml, /class="beat/);
});

test('page audit helper · mini app shell does not expose secret markers', () => {
  assertNoSecretLeak(PAGE);
});

test('page · supports scene deep links for viewport proofs', () => {
  for (const m of ["PARAMS.get('scene')", 'START_SCENE', 'map:1', 'gate:3', 'commands:4', 'go(START_SCENE, true)']) {
    assert.ok(PAGE.includes(m), `page has scene deep link ${m}`);
  }
});

test('page · interaction layer: sheet, haptics, operator map cards', () => {
  assert.match(PAGE, /class="sheet"/);
  assert.match(PAGE, /HapticFeedback/);
  assert.match(PAGE, /openSheet/);
  assert.match(PAGE, /openMapSheet/);
  assert.match(PAGE, /querySelectorAll\('\.sense'\)\.forEach\(el => el\.onclick = \(\) => openSenseSheet/);
  assert.match(PAGE, /querySelectorAll\('\[data-lane\]'\)\.forEach\(el => el\.onclick = \(\) => openLaneSheet/);
  assert.match(PAGE, /data-sense=\|data-lane=/);
  assert.match(PAGE, /renderOperatorMap/);
  assert.match(PAGE, /Operator Map/);
  assert.match(PAGE, /stage-card/);
});

test('page · commands track Hermes services in the mini app', () => {
  assert.match(PAGE, /ts-hermes/);
  assert.match(PAGE, /Hermes timers and Telegram brain/);
  assert.match(PAGE, /services/);
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

test('page · R3F mechanics ported as lightweight operator map', () => {
  for (const m of ['const STAGES', 'const RAILS', 'stageForArc', 'memory feed', 'no canvas, no heavy scene']) {
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

test('page · visual tapestry layer exposes wake, lanes, stance, policy, decision context, live proof, side quests, social, skills, companions, evidence boxes, and gaps', () => {
  for (const m of ['renderTapestryAudit', 'tapestry audit', 'data-tapestry', 'completion definition · ', 'ACTIVE ORGAN', 'R3F CONTRACT', 'wakeSteps', 'today wake', 'data-wake', 'wake step · ', 'wake history', 'operator wake events', 'latest snapshot, not a historical trace', 'renderLanes', 'lane · ', 'renderStance', 'tenant stance · ', 'renderPolicy', 'next action', 'POLICY GAP', 'caution ', 'renderDecisionContext', 'decision context', 'decision context · ', 'policy authority', 'renderLiveProof', 'live proof', 'data-live-proof', 'capture plan · not proof', 'proof only after', 'renderSideQuests', 'side quests', 'side quest · ', 'Queue side quest', 'queue-side-quest', 'side quest ledger remains unchanged', 'owner', 'action', 'target', 'lifetime', 'completion', 'trigger', 'proof', 'renderSocial', 'coordination', 'coordination · ', 'SOCIAL GAP', 'tenant-handoff-only', 'renderSenses', 'sense · ', 'senseEnv', 'renderInsightBoxes', 'evidence boxes', 'insightEnv', 'no quest evidence rows served', 'source', 'skill labors', 'tierLabel', 'UNPROVEN', 'recentRate', 'promotion:', 'companions', 'companion · ', 'stage', 'scope', 'advice proof', 'history', 'no relationship events served', 'awaiting signal', 'explicit gap']) {
    assert.ok(PAGE.includes(m), `page has ${m}`);
  }
  for (const step of CAMBIUM_WAKE_STEPS) assert.match(PAGE, new RegExp(`"id":"${step.id}"`));
  for (const lane of CAMBIUM_LANES) assert.match(PAGE, new RegExp(`"id":"${lane.id}"`));
  for (const sense of CAMBIUM_SENSES) assert.match(PAGE, new RegExp(`"id":"${sense.id}"`));
});

test('page · visual layer guards stale and partial envelopes', () => {
  for (const m of ['env.wake && Array.isArray', 'env.lanes || {}', 'env.senses || {}', 'env.insights || {}', 'env.stance || {}', 'env.policy || {}', 'env.decisionContext || {}', 'env.liveProof || {}', 'env.sideQuests || {}', 'env.social || {}', 'env.skills || {}', 'env.npc || {}', 'age > 360', 'freshness missing']) {
    assert.ok(PAGE.includes(m), `page has partial/stale guard ${m}`);
  }
});

test('page · gate chamber previews consequence, reversibility, evidence, and idempotency', () => {
  for (const m of ['gateSource', 'gateOwner', 'gateUpdatedAt', 'gateEvidence', 'gateReversibility', 'gateQueueConsequence', 'isGateAuthFailure', 'gateConsequence', 'gateIdempotency', 'approveConsequence', 'rerollConsequence', 'idempotencyHint', 'idempotencyKey', 'reversible until consumed']) {
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
  assert.match(gate, /source route \/internal\/gate\/cambium/);
  assert.match(gate, /no open items waiting/);
});

test('page · unreachable gate names network failure and no local queue write', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { search: '?tenant=cambium&scene=gate', rejectFetch: true });
  const gate = rendered.elements.get('gate')!.innerHTML;

  assert.match(gate, /data-gate-state="unreachable"/);
  assert.match(gate, /network failure/);
  assert.match(gate, /\/internal\/gate\/cambium unreachable/);
  assert.match(gate, /no local queue write/);
});

test('page · gate item cards show Paperclip source and queue-only fields', async () => {
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

  assert.match(gate, /Paperclip source<\/b><span>Paperclip · paperclip-open-items/);
  assert.match(gate, /owner<\/b><span>Mathis/);
  assert.match(gate, /updatedAt<\/b><span>2026-06-22T00:00:00.000Z/);
  assert.match(gate, /evidence<\/b><span>THO-9 blocked by launch copy review/);
  assert.match(gate, /consequence<\/b><span>approve: queue founder approval for THO-9/);
  assert.match(gate, /reversibility<\/b><span>queued action can be superseded until consumed/);
  assert.match(gate, /idempotency<\/b><span>approve:cambium:THO-9:blocked:2026-06-22T00:00:00.000Z/);
  assert.doesNotMatch(gate, /Paperclip execution|before execution|executed by the org/);
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

  assert.match(gate, /approve: queue founder approval for THO-9; no Paperclip\/org mutation until the operator consumes the queue/);
  assert.match(gate, /reroll: queue founder reroll request for THO-9; no Paperclip\/org mutation until the operator consumes the queue/);
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
  assert.match(approveSheet, /idempotency<\/b><span>approve:cambium:THO-9:blocked/);
  assert.match(approveSheet, /data-gate-confirm="approve"/);
  assert.equal(rendered.fetchCalls.length, fetchCount);

  (rendered.context.openGatePreflight as (kind: string, subject: string, node: unknown) => void)('reroll', 'THO-9', node);
  const rerollSheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(rerollSheet, /<h2>Reroll Gate Item<\/h2>/);
  assert.match(rerollSheet, /action kind<\/b><span>reroll/);
  assert.match(rerollSheet, /idempotency<\/b><span>reroll:cambium:THO-9:blocked/);
  assert.match(rerollSheet, /data-gate-confirm="reroll"/);
  assert.equal(rendered.fetchCalls.length, fetchCount);
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
  const progress = elements.get('progress')!.innerHTML;
  assert.match(stem, /first session unplayed/);
  assert.match(progress, /0<\/span>\/17 quests/);
  assert.match(map, /tapestry audit/);
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

test('page · quest rows and quest sheet expose Quine provenance', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
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
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    fetchSequence: [NO_FAKE_PROGRESS_VISUAL_FIXTURE, { schema: 1, tenant: 'cambium' }],
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

test('page · unreachable ledger state names retry route and no local write', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, { rejectFetch: true });
  const stem = rendered.elements.get('stem')!.innerHTML;

  assert.match(stem, /ledger unreachable/);
  assert.match(stem, /retry/);
  assert.match(stem, /\/api\/quests\/cambium/);
  assert.match(stem, /performs no local write/);
});

test('page · offline refresh clears stale quest summary handlers', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE, {
    fetchSequence: [NO_FAKE_PROGRESS_VISUAL_FIXTURE, new Error('offline')],
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

test('page · map header opens shared visual contract sheet', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const map = rendered.elements.get('mapwrap')!.innerHTML;

  assert.match(map, /class="mapbadge"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="shared\/cambium-visual-contract")/);
  (rendered.context.openMapHeaderSheet as (ledger: unknown) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE.ledger);

  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /operator map · active frontier/);
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
  assert.match(PAGE, /data-refresh-writes="none"/);
  assert.match(PAGE, /id="ptrProof" class="ptr-proof"/);
  assert.match(PAGE, /Pull to refresh re-fetches \/api\/quests\/cambium and does not write operator state/);
});

test('page · reduced motion keeps scene state and interactions visible', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  (rendered.context.go as (index: number) => void)(4);
  (rendered.context.go as (index: number) => void)(2);
  assert.equal(rendered.elements.get('tb2')!.classList.has('on'), true);
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
  assert.match(commandHtml, /class="cmd live"(?=[^>]*data-interaction-kind="sheet")/);
  assert.match(commandHtml, /class="cmd act"(?=[^>]*data-interaction-kind="chat-command")/);
  assert.match(commandHtml, /class="cmd ref"(?=[^>]*data-interaction-kind="read-only")/);

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
  assert.match(rendered.elements.get('cmds')!.innerHTML, /Hermes timers and Telegram brain/);
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
  assert.equal(directive.payload.task.eventId, body(queued).eventId);
  assert.ok(directive.payloadHash);

  const duplicate = await handle(req('POST', '/v1/bridge/assign-task', {
    headers: { authorization: 'Bearer bridge' },
    body: JSON.stringify(assignment),
  }), deps);
  assert.equal(duplicate.status, 200);
  assert.equal(body(duplicate).id, 'assign-1');
  assert.equal(body(duplicate).duplicate, true);

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
  assert.equal(fabricLedger.events.get('plexus-done-1')?.payloadHash, 'hash-done-1');
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
