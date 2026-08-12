// T-xxx · page client data load transport-state handling
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { PAGE } from '../index.ts';

type FetchPlan =
  | { status: number; body: unknown; malformed?: boolean }
  | Error
  | ((request: { index: number; url: string; init: RequestInit }) => unknown);

type RenderedPage = {
  elements: Map<string, ReturnType<typeof makeElement>>;
  context: Record<string, unknown>;
  requests: Array<{ url: string; init: RequestInit; index: number }>;
};

class FakeClassList {
  #names = new Set<string>();
  add(...tokens: string[]) { for (const token of tokens) this.#names.add(token); }
  remove(...tokens: string[]) { for (const token of tokens) this.#names.delete(token); }
  toggle(token: string, force?: boolean) {
    const on = force ?? !this.#names.has(token);
    if (on) this.#names.add(token); else this.#names.delete(token);
    return on;
  }
  has(token: string) { return this.#names.has(token); }
}

function fakeStyle() {
  const style: Record<string, string> = {};
  style.setProperty = (name: string, value: string) => { style[name] = value; };
  return style as CSSStyleDeclaration & Record<string, string>;
}

function dataKey(name: string) {
  return name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => String(letter).toUpperCase());
}

function makeElement(id: string) {
  let html = '';
  let htmlVersion = 0;
  const classList = new FakeClassList();
  const dataset: Record<string, string> = {};
  const listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  const element: {
    id: string;
    nodeType: number;
    parentElement: null | Record<string, unknown>;
    innerHTML: string;
    textContent: string;
    style: ReturnType<typeof fakeStyle>;
    classList: FakeClassList;
    dataset: Record<string, string>;
    onclick: ((...args: unknown[]) => unknown) | null;
    children: unknown[];
    clientWidth: number;
    scrollTop: number;
    disabled: boolean;
    eventListeners: typeof listeners;
    addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => void;
    removeEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => void;
    setAttribute: (name: string, value: string) => void;
    getAttribute: (name: string) => string | null;
    hasAttribute: (name: string) => boolean;
    matches: (selector: string) => boolean;
    dispatchEvent: (event: Record<string, unknown>) => boolean;
    click: () => boolean;
    focus: () => void;
  } = {
    id,
    nodeType: 1,
    parentElement: null,
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = String(value);
      htmlVersion += 1;
      queryCache.clear();
    },
    textContent: '',
    style: fakeStyle(),
    classList,
    dataset,
    onclick: null,
    children: [],
    clientWidth: 390,
    scrollTop: 0,
    disabled: false,
    eventListeners: listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    setAttribute(name, value) {
      if (name.startsWith('data-')) {
        dataset[dataKey(name)] = String(value);
      }
    },
    getAttribute(name) {
      if (name.startsWith('data-')) return dataset[dataKey(name)] ?? null;
      return null;
    },
    hasAttribute(name) {
      if (name.startsWith('data-')) return dataKey(name) in dataset;
      return false;
    },
    matches(selector: string) { return selector === `#${id}`; },
    dispatchEvent(rawEvent) {
      const event = rawEvent || {};
      let node: typeof element | null = element;
      while (node) {
        const eventListeners = node.eventListeners.get(String(event.type ?? '')) ?? new Set();
        for (const listener of eventListeners) listener(event);
        const handler = node[`on${String(event.type ?? '')}` as keyof typeof node];
        if (typeof handler === 'function') (handler as (...args: unknown[]) => unknown)(event);
        if (event.cancelBubble || event.defaultPrevented) break;
        node = null;
      }
      return !Boolean(event.defaultPrevented);
    },
    click() {
      if (element.disabled) return false;
      return element.dispatchEvent({ type: 'click', bubbles: true, cancelable: true });
    },
    focus() {},
  };
  const queryCache = new Map<string, ReturnType<typeof makeElement>[]>();
  return element;
}

async function renderPageState({
  tenant = 'cambium',
  search = '',
  fetchPlan = [{ status: 200, body: { schema: 1, tenant } }],
  expireDeadline = false,
}: { tenant?: string; search?: string; fetchPlan?: FetchPlan[]; expireDeadline?: boolean } = {}): Promise<RenderedPage> {
  const scripts = [...PAGE.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim() && !script.includes('telegram-web-app'));
  const bootScripts = scripts.filter((script) => script.includes('/v1/mission-fabric/'));
  assert.equal(bootScripts.length, 1);
  const appScripts = scripts.filter((script) => !script.includes('/v1/mission-fabric/'));
  assert.equal(appScripts.length, 1);

  const elements = new Map<string, ReturnType<typeof makeElement>>();
  const getElementById = (id: string) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id)!;
  };
  for (const id of [
    'ten', 'fresh', 'sceneBadge', 'ptr', 'ptrProof', 'track', 'ind', 'tb0', 'tb1', 'tb2', 'tb3', 'tb4',
    'stem', 'fill', 'progress', 'here', 'mapwrap', 'beats', 'gauge', 'gate', 'cmds', 'veil', 'sheet', 'sheetBody',
  ]) {
    getElementById(id);
  }
  getElementById('sheetBody').parentElement = getElementById('sheet');

  const requests: Array<{ url: string; init: RequestInit; index: number }> = [];
  const sequence = [...fetchPlan];
  const context: Record<string, unknown> = {
    document: { getElementById, querySelectorAll: () => [] },
    window: { Telegram: undefined, addEventListener() {}, innerWidth: 390 },
    location: { search: search || `?tenant=${tenant}` },
    matchMedia: () => ({ matches: true }),
    navigator: {},
    fetch: async (url: string, init: RequestInit = {}) => {
      const index = requests.length;
      requests.push({ url: String(url), init, index });
      const responder = sequence.length ? sequence.shift()! : { status: 200, body: { schema: 1, tenant } };
      if (responder instanceof Error) throw responder;
      const value = typeof responder === 'function' ? responder({ index, url: String(url), init }) : responder;
      if (value instanceof Promise) return value;
      const plan = value as { status: number; body: unknown; malformed?: boolean };
      const status = Number(plan.status || 0);
      return {
        ok: status >= 200 && status <= 299,
        status,
        async json() {
          if (plan.malformed) throw new Error('malformed-json');
          return plan.body;
        },
      };
    },
    requestAnimationFrame: (fn: (time: number) => void) => { fn(0); return 0; },
    performance: { now: () => 0 },
    URLSearchParams,
    AbortController,
    console,
    setTimeout: (fn: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      if (expireDeadline && delay === 10000) {
        queueMicrotask(() => fn(...args));
        return 1;
      }
      return setTimeout(fn, delay, ...args);
    },
    clearTimeout,
  };
  context.globalThis = context;
  vm.runInContext(appScripts[0], vm.createContext(context));
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  return { elements, context, requests };
}

function assertLedgerUnreachable(stem: string, refreshRoute: string) {
  assert.match(stem, /ledger unreachable/);
  assert.match(stem, /pull down to retry/);
  assert.match(stem, new RegExp(escapeRegExp(refreshRoute)));
}

function assertNoAuthOrBodyLeakage(stem: string) {
  const noised = `${stem} `;
  assert.doesNotMatch(noised, /Bearer\s+\S+/i);
  assert.doesNotMatch(noised, /\b(auth|authorization|token|initData)\b/i);
  assert.doesNotMatch(noised, /{"|}/);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('page data load · 200 without ledger stays honest empty', async () => {
  const { elements, requests } = await renderPageState({ tenant: 'cambium', fetchPlan: [{ status: 200, body: { schema: 1, tenant: 'cambium' } }] });
  assert.equal(requests[0].url, '/api/quests/cambium');
  assert.equal(elements.get('fresh')!.textContent, 'empty');
  assert.equal(elements.get('fresh')!.dataset.interactionKind, 'sheet');
  assert.match(elements.get('stem')!.innerHTML, /no ledger yet/);
  assert.match(elements.get('stem')!.innerHTML, /push --tenant cambium/);
});

test('page data load · 401 / 403 both render bounded auth guidance', async () => {
  const unauthorized = await renderPageState({ tenant: 'cambium', fetchPlan: [{ status: 401, body: { ok: false, reason: 'blocked' } }] });
  const forbidden = await renderPageState({ tenant: 'cambium', fetchPlan: [{ status: 403, body: { ok: false, reason: 'forbidden' } }] });

  assert.match(unauthorized.elements.get('stem')!.innerHTML, /authenticated access needed/);
  assert.match(forbidden.elements.get('stem')!.innerHTML, /authenticated access needed/);
  assert.equal(unauthorized.elements.get('fresh')!.textContent, 'auth');
  assert.equal(forbidden.elements.get('fresh')!.textContent, 'auth');
  assert.equal(unauthorized.elements.get('fresh')!.dataset.interactionKind, 'sheet');
});

test('page data load · 404 renders route unavailable guidance', async () => {
  const { elements } = await renderPageState({ tenant: 'cambium', fetchPlan: [{ status: 404, body: { ok: false } }] });
  assert.match(elements.get('stem')!.innerHTML, /route unavailable/);
  assert.match(elements.get('stem')!.innerHTML, /requested tenant route/);
  assert.equal(elements.get('fresh')!.textContent, 'missing');
});

test('page data load · 5xx renders service-unavailable guidance', async () => {
  const { elements } = await renderPageState({ tenant: 'acme', fetchPlan: [{ status: 503, body: 'service unavailable' }] });
  assert.match(elements.get('stem')!.innerHTML, /service unavailable/);
  assert.equal(elements.get('fresh')!.textContent, 'error');
  assert.equal(elements.get('fresh')!.dataset.source, '/api/quests/acme');
});

test('page data load · malformed JSON is retryable unreachable', async () => {
  const { elements, requests } = await renderPageState({
    tenant: 'cambium',
    fetchPlan: [{ status: 200, body: { schema: 1 }, malformed: true }],
  });
  assertLedgerUnreachable(elements.get('stem')!.innerHTML, requests[0].url);
  assertNoAuthOrBodyLeakage(elements.get('stem')!.innerHTML);
});

test('page data load · fetch rejection is retryable unreachable', async () => {
  const { elements, requests } = await renderPageState({
    tenant: 'cambium',
    fetchPlan: [new Error('fixture fetch failed')],
  });
  assertLedgerUnreachable(elements.get('stem')!.innerHTML, requests[0].url);
  assertNoAuthOrBodyLeakage(elements.get('stem')!.innerHTML);
});

test('page data load · abort and timeout are retryable unreachable', async () => {
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  const timeout = Object.assign(new Error('timeout while contacting server'), { name: 'TimeoutError' });
  const aborted = await renderPageState({ tenant: 'cambium', fetchPlan: [abort] });
  const timed = await renderPageState({ tenant: 'cambium', fetchPlan: [timeout] });
  assertLedgerUnreachable(aborted.elements.get('stem')!.innerHTML, aborted.requests[0].url);
  assertLedgerUnreachable(timed.elements.get('stem')!.innerHTML, timed.requests[0].url);
});

test('page data load · request carries an abortable deadline signal', async () => {
  const { requests } = await renderPageState({
    tenant: 'cambium',
    fetchPlan: [{ status: 200, body: { schema: 1, tenant: 'cambium' } }],
  });
  assert.ok(requests[0].init.signal instanceof AbortSignal);
});

test('page data load · ten-second deadline aborts a hanging request', async () => {
  const { elements, requests } = await renderPageState({
    tenant: 'cambium',
    expireDeadline: true,
    fetchPlan: [({ init }) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('deadline'), { name: 'AbortError' })));
    })],
  });
  assert.ok(requests[0].init.signal?.aborted);
  assertLedgerUnreachable(elements.get('stem')!.innerHTML, requests[0].url);
});

test('page data load · tenant isolation is preserved in fetch route', async () => {
  await renderPageState({ tenant: 'acme', fetchPlan: [{ status: 200, body: { schema: 1, tenant: 'acme' } }] });
  await renderPageState({ tenant: 'the-calling', search: '?tenant=the-calling', fetchPlan: [{ status: 200, body: { schema: 1, tenant: 'the-calling' } }] });
  const { requests } = await renderPageState({ tenant: 'acme-ops', search: '?tenant=acme-ops', fetchPlan: [{ status: 401, body: {} }] });
  assert.match(requests[0].url, /\/api\/quests\/acme-ops$/);
});
