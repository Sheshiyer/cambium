import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PAGE, LEGACY_PAGE } from './page/index.ts';
import { SYSTEM_ATLAS_BROWSER, SYSTEM_ATLAS_CSS } from './page/components/system-atlas.ts';
import { NO_FAKE_PROGRESS_VISUAL_FIXTURE } from './visual-fixtures.ts';

// A small document harness evaluates the actual served scripts together. It
// keeps mounted descendants and bubbled clicks so the shared atlas is tested
// through both page seams, including the existing contextual close wrapper.
const dataKey = (name: string) => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

class TestElement {
  tagName: string;
  parentElement: TestElement | null = null;
  children: TestElement[] = [];
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  listeners = new Map<string, Array<(event: any) => void>>();
  onclick: ((event: any) => void) | null = null;
  onkeydown: ((event: any) => void) | null = null;
  hidden = false;
  inert = false;
  disabled = false;
  nodeType = 1;
  clientWidth = 390;
  scrollWidth = 390;
  scrollTop = 0;
  scrollLeft = 0;
  focusCount = 0;
  textContent = '';
  style: Record<string, any> = { setProperty(name: string, value: string) { this[name] = value; } };
  html = '';

  constructor(tagName = 'div') { this.tagName = tagName.toUpperCase(); }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(value: string) { this.setAttribute('id', value); }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(value: string) { this.setAttribute('class', value); }
  get classList() {
    const element = this;
    return {
      has: (name: string) => element.className.split(/\s+/).includes(name),
      contains: (name: string) => element.className.split(/\s+/).includes(name),
      add(...names: string[]) { element.className = [...new Set([...element.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove(...names: string[]) { element.className = element.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle(name: string, force?: boolean) {
        const next = force ?? !this.contains(name);
        if (next) this.add(name); else this.remove(name);
        return next;
      },
    };
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value);
    if (name === 'hidden') this.hidden = true;
    if (name === 'inert') this.inert = true;
    if (name === 'disabled') this.disabled = true;
  }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string) { return this.attributes.has(name); }
  removeAttribute(name: string) { this.attributes.delete(name); if (name === 'disabled') this.disabled = false; }
  get innerHTML() { return this.html; }
  set innerHTML(value: string) {
    this.html = String(value);
    this.children = [];
    const stack: TestElement[] = [this];
    for (const match of this.html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
      const token = match[0], tag = match[1].toLowerCase();
      if (token.startsWith('</')) {
        while (stack.length > 1) { if (stack.pop()!.tagName.toLowerCase() === tag) break; }
        continue;
      }
      const child = new TestElement(tag);
      for (const attribute of token.matchAll(/\s([a-zA-Z0-9_:-]+)(?:="([^"]*)"|'([^']*)'|([^\s>]+))?/g)) {
        child.setAttribute(attribute[1], decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''));
      }
      stack.at(-1)!.appendChild(child);
      if (!voidTags.has(tag) && !token.endsWith('/>')) stack.push(child);
    }
  }
  appendChild(child: TestElement) { child.parentElement = this; this.children.push(child); return child; }
  replaceChildren() { this.children = []; this.html = ''; }
  contains(target: TestElement) {
    for (let node: TestElement | null = target; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
  matches(selector: string): boolean {
    return selector.split(',').some(part => {
      part = part.trim();
      if (!part) return false;
      const tag = part.match(/^[a-z][a-z0-9-]*/i)?.[0];
      if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      const id = part.match(/#([a-zA-Z0-9_-]+)/)?.[1];
      if (id && this.id !== id) return false;
      for (const name of part.matchAll(/\.([a-zA-Z0-9_-]+)/g)) if (!this.classList.contains(name[1])) return false;
      for (const attribute of part.matchAll(/\[([a-zA-Z0-9_:-]+)(?:="([^"]*)")?\]/g)) {
        if (!this.hasAttribute(attribute[1])) return false;
        if (attribute[2] !== undefined && this.getAttribute(attribute[1]) !== attribute[2]) return false;
      }
      return true;
    });
  }
  closest(selector: string): TestElement | null {
    for (let node: TestElement | null = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector: string): TestElement[] {
    const matches: TestElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]);
  }
  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(row => row !== listener));
  }
  dispatchEvent(event: any) {
    event.target ??= this;
    event.preventDefault = () => { event.defaultPrevented = true; };
    event.stopPropagation = () => { event.cancelBubble = true; };
    for (let node: TestElement | null = this; node; node = event.cancelBubble ? null : node.parentElement) {
      for (const listener of node.listeners.get(event.type) ?? []) listener(event);
      const handler = event.type === 'click' ? node.onclick : event.type === 'keydown' ? node.onkeydown : null;
      handler?.(event);
    }
    return !event.defaultPrevented;
  }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click' }); }
  focus() { this.focusCount += 1; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 44 }; }
}

const ENABLED_FABRIC = {
  projection: { schema: 'cambium.mission-fabric-projection.v1', nodes: [], edges: [] },
  delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T00:00:00.000Z', freshness: 'fresh' },
};

async function boot({ search = '?tenant=cambium&scene=inspect&pane=system', initData = '', fabricStatus = initData ? 200 : 401,
  fabricBody = ENABLED_FABRIC, malformedFabric = false, questStatus = 200 }:
  { search?: string; initData?: string; fabricStatus?: number; fabricBody?: unknown; malformedFabric?: boolean; questStatus?: number } = {}) {
  const documentRoot = new TestElement('document');
  documentRoot.innerHTML = PAGE.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const tg = initData ? { initData, ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} } } : undefined;
  const context = vm.createContext({
    Element: TestElement,
    document: {
      getElementById: (id: string) => documentRoot.querySelector(`#${id}`),
      querySelector: (selector: string) => documentRoot.querySelector(selector),
      querySelectorAll: (selector: string) => documentRoot.querySelectorAll(selector),
      createElement: (tag: string) => new TestElement(tag),
    },
    window: { Telegram: tg ? { WebApp: tg } : undefined, addEventListener() {}, innerWidth: 390 },
    Telegram: tg ? { WebApp: tg } : undefined,
    location: { search },
    matchMedia: () => ({ matches: true }),
    navigator: {},
    requestAnimationFrame: (fn: (time: number) => void) => { fn(0); return 0; },
    performance: { now: () => 0 },
    URLSearchParams, AbortController, console, setTimeout, clearTimeout,
    fetch: async (url: string, init: RequestInit = {}) => {
      requests.push({ url: String(url), init });
      const fabric = String(url).startsWith('/v1/mission-fabric/');
      const status = fabric ? fabricStatus : questStatus;
      return {
        status, ok: status >= 200 && status <= 299,
        json: async () => { if (fabric && malformedFabric) throw new SyntaxError('fixture JSON'); return fabric ? fabricBody : NO_FAKE_PROGRESS_VISUAL_FIXTURE; },
      };
    },
  });
  for (const match of PAGE.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (match[1].trim()) vm.runInContext(match[1], context, { timeout: 2000 });
  }
  for (let index = 0; index < 4; index += 1) await new Promise(resolve => setTimeout(resolve, 0));
  const find = (selector: string) => {
    const element = documentRoot.querySelector(selector);
    assert.ok(element, `expected mounted element ${selector}`);
    return element;
  };
  return { context, documentRoot, requests, find };
}

test('page assembles the shared atlas once inside its existing style and app script', () => {
  assert.equal(LEGACY_PAGE.split(SYSTEM_ATLAS_BROWSER).length, 2);
  assert.equal(LEGACY_PAGE.split(SYSTEM_ATLAS_CSS).length, 2);
  const style = LEGACY_PAGE.match(/<style>([\s\S]*?)<\/style>/)![1];
  const app = [...LEGACY_PAGE.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('const CambiumSystemAtlas'))![1];
  assert.ok(style.includes(SYSTEM_ATLAS_CSS));
  assert.ok(app.includes(SYSTEM_ATLAS_BROWSER));
});

test('Inspect/System deep link mounts the actual public-safe atlas and handles selected contracts', async () => {
  const page = await boot();
  const atlas = page.find('#inspect-system-atlas');
  assert.equal(atlas.querySelector('[data-component="SystemAtlas"]')!.getAttribute('data-authority'), 'read_only');
  assert.equal(atlas.querySelector('[data-component="SystemAtlas"]')!.getAttribute('data-evidence'), 'source');
  const before = page.requests.length;
  atlas.querySelector('[data-atlas-organ="will"]')!.click();
  assert.ok(atlas.querySelector('[data-atlas-detail="will"]'));
  atlas.querySelector('[role="tab"][data-atlas-view="organs"]')!.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  assert.equal(atlas.querySelector('[role="tab"][data-atlas-view="connections"]')!.getAttribute('aria-selected'), 'true');
  assert.equal(atlas.querySelector('[role="tab"][data-atlas-view="connections"]')!.focusCount, 1);
  atlas.querySelector('[data-atlas-system="plexus"]')!.click();
  assert.match(atlas.innerHTML, /email alone is insufficient/);
  atlas.querySelector('[role="tab"][data-atlas-view="evidence"]')!.click();
  assert.match(atlas.innerHTML, /DISTINCT RECEIPT/);
  assert.equal(page.requests.length, before, 'source inspection performs no requests');
  assert.equal(vm.runInContext('INSPECT_PANE', page.context), 'system');
  assert.equal(page.find('#operating-fabric').hidden, true, 'a denied browser principal cannot activate Fabric');
  assert.deepEqual(page.requests.map(row => row.url), ['/api/quests/cambium','/v1/mission-fabric/cambium']);
});

test('default and unknown panes retain Proof, and the System tab mounts and remounts the atlas', async () => {
  for (const pane of ['', '&pane=unknown']) {
    const page = await boot({ search: '?tenant=cambium&scene=inspect' + pane });
    assert.equal(vm.runInContext('INSPECT_PANE', page.context), 'proof');
    assert.equal(page.documentRoot.querySelector('#inspect-system-atlas'), null);
    page.find('[data-inspect-pane-select="system"]').click();
    assert.ok(page.find('#inspect-system-atlas').querySelector('[data-atlas-detail="genesis"]'));
    page.find('[data-inspect-pane-select="proof"]').click();
    assert.equal(page.documentRoot.querySelector('#inspect-system-atlas'), null);
    page.find('[data-inspect-pane-select="system"]').click();
    page.find('[data-atlas-organ="cortex"]').click();
    assert.ok(page.find('#inspect-system-atlas').querySelector('[data-atlas-detail="cortex"]'));
  }
});

test('atlas pane parameter cannot change a different scene or authenticate a failed quest read', async () => {
  const mission = await boot({ search: '?tenant=cambium&scene=mission&pane=system' });
  assert.equal(vm.runInContext('INSPECT_PANE', mission.context), 'proof');
  assert.equal(vm.runInContext('START_SCENE', mission.context), 0);
  const denied = await boot({ questStatus: 401 });
  assert.match(denied.find('#stem').innerHTML, /authenticated access needed/);
  assert.equal(vm.runInContext('ECOSYSTEM_ENV', denied.context), null);
  assert.equal(denied.find('#inspect-system-atlas').querySelector('[data-component="SystemAtlas"]')!.getAttribute('data-authority'), 'read_only');
  assert.equal(denied.find('#inspect-system-atlas').querySelector('[data-component="SystemAtlas"]')!.getAttribute('data-evidence'), 'source');
});

test('enabled Fabric exposes the atlas in Canopy and Flow with contextual close and focus return', async () => {
  const page = await boot({ initData: 'telegram-signed-fixture' });
  assert.equal(page.find('#operating-fabric').hidden, false);
  assert.equal(page.find('[data-component="MissionControlShell"]').hidden, true);
  const canopy = page.find('[data-of-scene="canopy"]');
  const entry = canopy.querySelector('[data-of-system-atlas]')!;
  assert.ok(entry);
  assert.equal(entry.getAttribute('data-read-only'), '1');
  const before = page.requests.length;
  entry.click();
  const atlas = page.find('#fabric-system-atlas');
  assert.ok(atlas.querySelector('[data-atlas-detail="genesis"]'));
  atlas.querySelector('[data-atlas-organ="adytum"]')!.click();
  assert.ok(atlas.querySelector('[data-atlas-detail="adytum"]'));
  assert.equal(vm.runInContext('sheetState.open', page.context), true);
  page.find('[data-of-inspect-close]').click();
  assert.equal(vm.runInContext('sheetState.open', page.context), false);
  assert.equal(canopy.hidden, false);
  assert.equal(entry.focusCount, 1);
  page.find('[data-of-tab="flow"]').click();
  const flow = page.find('[data-of-scene="flow"]');
  const flowEntry = flow.querySelector('[data-of-system-atlas]')!;
  flowEntry.click();
  page.find('[data-of-inspect-back]').click();
  assert.equal(flow.hidden, false);
  assert.equal(flowEntry.focusCount, 1);
  assert.equal(page.requests.length, before, 'open, selection, close and back never fetch or post');
  assert.equal(page.requests.filter(row => row.url === '/v1/mission-fabric/cambium').length, 1);
  assert.equal((page.requests.find(row => row.url.startsWith('/v1/mission-fabric/'))!.init.headers as Record<string, string>)['x-telegram-init-data'], 'telegram-signed-fixture');
});

test('Fabric atlas controls are absent for unauthenticated, disabled and invalid activation responses', async () => {
  const cases = [
    { initData: '', fabricStatus: 401 },
    { fabricStatus: 401 },
    { fabricStatus: 403 },
    { fabricStatus: 201 },
    { malformedFabric: true },
    { fabricBody: { ...ENABLED_FABRIC, delivery: { operatingFabricEnabled: false } } },
    { fabricBody: { ...ENABLED_FABRIC, delivery: { operatingFabricEnabled: 1 } } },
    { fabricBody: { ...ENABLED_FABRIC, projection: { nodes: [], edges: [] } } },
  ];
  for (const overrides of cases) {
    const page = await boot({ initData: 'telegram-signed-fixture', ...overrides });
    const fabric = page.find('#operating-fabric');
    const legacy = page.find('[data-component="MissionControlShell"]');
    assert.equal(fabric.hidden, true);
    assert.equal(fabric.inert, true);
    assert.equal(legacy.hidden, false);
    assert.equal(legacy.inert, false);
    assert.ok(fabric.querySelector('[data-of-system-atlas]'), 'the static header control stays inside a hidden inert shell');
    assert.equal(page.documentRoot.querySelector('#fabric-system-atlas'), null);
    assert.ok(page.find('#inspect-system-atlas').querySelector('[data-component="SystemAtlas"]'), 'source atlas remains independent of Fabric health');
  }
});
