// cambium-quests · pure handler tests (node:test, like everything beside it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handle } from './handler.ts';
import type { KvLike, SimpleRequest } from './handler.ts';
import { PAGE } from './page.ts';
import { NO_FAKE_PROGRESS_VISUAL_FIXTURE } from './visual-fixtures.ts';
import {
  MINI_APP_ECOSYSTEM_TARGETS,
  MINI_APP_INTERACTION_KINDS,
  MINI_APP_MAP_SUBSECTION_IDS,
  MINI_APP_SCENE_IDS,
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

async function renderPageFixtureContext(envelope: unknown) {
  const scripts = [...PAGE.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim() && !script.includes('telegram-web-app'));
  assert.equal(scripts.length, 1, 'page has one inline app script');

  const elements = new Map<string, ReturnType<typeof makeElement>>();
  const getElementById = (id: string) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id)!;
  };
  for (const id of ['ten', 'fresh', 'ptr', 'track', 'ind', 'tb0', 'tb1', 'tb2', 'tb3', 'tb4',
    'stem', 'fill', 'progress', 'here', 'mapwrap', 'beats', 'gauge', 'gate', 'cmds', 'veil', 'sheet', 'sheetBody']) {
    getElementById(id);
  }

  const context: Record<string, unknown> = {
    document: { getElementById, querySelectorAll: () => [] },
    window: { Telegram: undefined, addEventListener() {}, innerWidth: 390 },
    location: { search: '' },
    matchMedia: () => ({ matches: true }),
    fetch: async () => ({ ok: true, json: async () => envelope }),
    requestAnimationFrame: (fn: (time: number) => void) => { fn(0); return 0; },
    performance: { now: () => 0 },
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  vm.runInContext(scripts[0], vm.createContext(context));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { elements, context };
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
  const r = await handle(req('GET', '/api/quests/thoughtseed'), { kv: fakeKv() });
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

test('mini app surface contract · exports current scene ids', () => {
  assert.deepEqual(MINI_APP_SCENE_IDS, ['quests', 'map', 'story', 'gate', 'commands']);
});

test('mini app surface contract · maps ecosystem targets', () => {
  for (const target of ['telegram', 'hermes', 'paperclip', 'cambium-worker', 'quine', 'operator-policy', 'cortex', 'r3f', 'github', 'vault-via-paperclip', 'live-proof']) {
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

test('page audit helper · detects inert pseudo-button cards', () => {
  assertNoInertPseudoButtons([
    '<div class="cmd" data-interaction-kind="read-only" data-source="curios.self-chat-command"></div>',
    '<div class="rail hot" data-interaction-kind="read-only" data-source="shared/cambium-visual-contract" data-rail="handoff"></div>',
    '<div class="beat noesis" data-interaction-kind="read-only" data-source="operator-narrative" data-beat="0"></div>',
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
  assert.match(html, /class="rail [^"]*"(?=[^>]*data-interaction-kind="read-only")(?=[^>]*data-source="shared\/cambium-visual-contract")/);
  assert.match(html, /class="beat[^"]*"(?=[^>]*data-interaction-kind="read-only")(?=[^>]*data-source="operator-narrative")/);
  assert.match(html, /class="cmd live"(?=[^>]*data-interaction-kind="sheet")(?=[^>]*data-source="paperclipCommandsData")/);
  assert.match(html, /class="cmd act"(?=[^>]*data-interaction-kind="chat-command")(?=[^>]*data-source="curios\.self-chat-command")/);
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
  assert.match(PAGE, /renderOperatorMap/);
  assert.match(PAGE, /Operator Map/);
  assert.match(PAGE, /stage-card/);
});

test('page · commands track Hermes services in the mini app', () => {
  assert.match(PAGE, /ts-hermes/);
  assert.match(PAGE, /Hermes timers and Telegram brain/);
  assert.match(PAGE, /services/);
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
  for (const m of ['gateEvidence', 'gateReversibility', 'gateConsequence', 'gateIdempotency', 'approveConsequence', 'rerollConsequence', 'idempotencyHint', 'idempotencyKey', 'reversible until consumed']) {
    assert.ok(PAGE.includes(m), `page has gate preview ${m}`);
  }
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

test('page · tapestry audit sheet maps completion requirements to source-backed proof', async () => {
  const rendered = await renderPageFixtureContext(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const rows = (rendered.context.tapestryRows as (env: unknown) => Array<{ id: string }>)(NO_FAKE_PROGRESS_VISUAL_FIXTURE);
  const liveProofIndex = rows.findIndex((row) => row.id === 'live-proof');
  assert.ok(liveProofIndex >= 0, 'live-proof audit row exists');
  (rendered.context.openTapestryBox as (env: unknown, index: number) => void)(NO_FAKE_PROGRESS_VISUAL_FIXTURE, liveProofIndex);
  const sheet = rendered.elements.get('sheetBody')!.innerHTML;
  assert.match(sheet, /completion definition · wait/);
  assert.match(sheet, /LIVE PROOF/);
  assertSheetHasSource(sheet, 'liveProof');
  assert.match(sheet, /proof only after their artifacts validate ready/);
  assert.doesNotMatch(sheet, /all requirements complete|production verified|live proof ready/i);
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

test('page · Mira companion card renders only served relationship evidence', async () => {
  const elements = await renderPageFixture({
    ...NO_FAKE_PROGRESS_VISUAL_FIXTURE,
    npc: {
      source: 'cortex-memory',
      relationships: [
        {
          id: 'mira',
          status: 'inferred',
          detail: '1/1 tenant cortex memories mention Mira or ICP signals',
          proof: 'acme:mira:resonance-1: positioning · mira',
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
  });
  const map = elements.get('mapwrap')!.innerHTML;
  assert.match(map, /MIRA/);
  assert.match(map, /SIGHTED/);
  assert.match(map, /1\/1 tenant cortex memories mention Mira or ICP signals/);
  assert.match(PAGE, /stage/);
  assert.match(PAGE, /proof/);
  assert.doesNotMatch(map, /relationship level|trusted advisor|partner|affinity/i);
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
const gateCfg = (pubKeyHex: string): GateConfig => ({
  botId: '1571615655', pubKeyHex, founderIds: ['1371522080', '926168615'], now: () => NOW,
});

test('gate · valid founder signature passes and identifies the founder', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '1371522080', authDate: NOW / 1000 - 30 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.deepEqual(verdict, { ok: true, userId: '1371522080' });
});

test('gate · tampered payload is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '1371522080', authDate: NOW / 1000 - 30, tamper: true });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /bad signature/);
});

test('gate · stale auth_date is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '1371522080', authDate: NOW / 1000 - 4000 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /stale/);
});

test('gate · non-founder with a valid signature is rejected', async () => {
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '555', authDate: NOW / 1000 - 30 });
  const verdict = await validateInitData(initData, gateCfg(pubKeyHex));
  assert.equal(verdict.ok, false);
  assert.match((verdict as any).reason, /not a founder/);
});

test('gate · queue → list → consume roundtrip over the worker routes', async () => {
  const kv = fakeKv();
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '926168615', authDate: NOW / 1000 - 10 });
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
  assert.equal(actions[0].founderId, '926168615');
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
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '926168615', authDate: NOW / 1000 - 10 });
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
  const { initData, pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '926168615', authDate: NOW / 1000 - 10 });
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
  const { pubKeyHex } = await makeSignedInitData({ botId: '1571615655', userId: '926168615', authDate: NOW / 1000 });
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
