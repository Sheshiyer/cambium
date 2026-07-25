#!/usr/bin/env node

// T-028 automated string-count audit — frozen/05 §5 measurement method.
// Renders each scene from workers/quests/src/page/scenes/fixtures/*.fixture.json (every fixture
// state) through the same VM page-harness approach as workers/quests/src/handler.test.ts
// (renderPageFixtureContext), walks the served HTML per scene root, and enforces:
//   1. per-tab word caps (docs/architecture/contracts/scenes/*.json `wordCap`, frozen/05 §1)
//   2. shared chrome ≤ 25 words, counted once (frozen/05 §1)
//   3. per-element string caps (frozen/05 §2), classified via component data-*/class hooks
//   4. the frozen/05 §4 BANNED list (copy blocks, text walls, AI-copy vocabulary, kv grids
//      outside Inspect, initData ritual copy, redaction violations, emoji, `!` in state labels)
// Counting conventions (frozen/05 §5): visible rendered strings only — text inside
// display:none / visibility:hidden / hidden / aria-hidden="true" / .sr subtrees is excluded,
// collapsed <details> bodies at rest are excluded (their <summary> stays visible), words split
// on whitespace after trimming, mono tokens and numbers each count as one word. SVG text is
// excluded: glyph artwork is aria-hidden and the one readable dial (gate gauge) restates its
// value in the StateToken caption + aria-label. Reduced-motion is forced in the harness, which
// is the static at-rest rendering; motion variants carry no extra text.
// Zero dependencies. Usage: node scripts/text-density-audit.mjs [--write]

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const CHROME_WORD_CAP = 25;
const FIXTURE_NOW = '2026-07-24T09:17:00.000Z';

// frozen/05 §4.4 — generic AI copy (case-insensitive substring match).
export const BANNED_AI_COPY = [
  'powerful', 'seamless', 'modern and elegant', 'cutting-edge',
  'leverage', 'unlock', 'supercharge', 'delight',
];
// frozen/05 §4.7 — manual-initData ritual copy must never be visible.
const BANNED_INITDATA_COPY = /TELEGRAM_INIT_DATA|TG_INIT_DATA|initData/i;
// frozen/05 §4.1 — copy-paste command blocks.
const BANNED_COPY_COMMAND_COPY = /copy command|chat syntax|payload preview|\/ts-[a-z]/i;
// frozen/05 §4.8 — redaction violations in rendered strings (hashes only, never raw material).
const BANNED_REDACTION_COPY = /[?&](?:query_id|auth_date|hash)=|Bearer\s+\S/i;
// frozen/05 §4.5 — no emoji as list markers or state indicators (glyphs + state tokens only).
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

// ── visible-text extraction (ported from workers/quests/src/handler.test.ts) ──────────────

function decodeHtmlText(value) {
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

function htmlAttributeValue(tag, attr) {
  const match = tag.match(new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function htmlTagName(tag) {
  const match = tag.match(/^<\/?\s*([a-z][\w:-]*)/i);
  return match ? match[1].toLowerCase() : null;
}

function openingTagHidesText(tag, tagName) {
  if (NON_TEXT_TAGS.has(tagName)) return true;
  if (/(?:^|[\s<])hidden(?:[\s=/>]|$)/i.test(tag)) return true;
  if ((htmlAttributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') return true;
  const className = htmlAttributeValue(tag, 'class');
  if (className?.split(/\s+/).includes('sr')) return true;
  const style = htmlAttributeValue(tag, 'style') ?? '';
  return /\bdisplay\s*:\s*none\b/i.test(style) || /\bvisibility\s*:\s*hidden\b/i.test(style);
}

export function stripNonRenderedTextNodes(html) {
  const stack = [];
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
        const frame = stack.pop();
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

// frozen/05 §5: collapsed <details>/info-sheet bodies at rest are not visible; the <summary>
// line stays visible. Closed details bodies are dropped before the DOM walk.
export function collapseClosedDetails(html) {
  let result = String(html);
  for (let i = 0; i < 8; i += 1) {
    const next = result.replace(/<details\b(?![^>]*\bopen\b)[^>]*>([\s\S]*?)<\/details>/gi, (match, inner) => {
      const summary = inner.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/i);
      return summary ? summary[0] : ' ';
    });
    if (next === result) return next;
    result = next;
  }
  return result;
}

export function visibleTextFromHtml(html) {
  return decodeHtmlText(stripNonRenderedTextNodes(collapseClosedDetails(html))
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(html) {
  const text = visibleTextFromHtml(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

// ── element classification helpers (frozen/05 §2 per-element caps) ────────────────────────

// Extracts inner HTML of elements carrying a class token. Non-greedy same-tag close is safe
// for the audited hooks (b/span/i/div/button leaves with no nested same-tag children).
export function extractElementsByClass(html, className) {
  const out = [];
  const re = new RegExp(`<([a-z][a-z0-9]*)\\b(?=[^>]*\\bclass="[^"]*\\b${className}\\b)[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
  for (const match of html.matchAll(re)) out.push(match[2]);
  return out;
}

function firstTagText(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? visibleTextFromHtml(match[1]) : '';
}

function words(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

// Leaf buttons = pure-text labels (card-buttons carry nested markup and are classified by
// their own component hooks instead). Pure-glyph labels (chevrons) carry no alphanumerics.
export function leafButtonLabels(html) {
  const labels = [];
  for (const match of html.matchAll(/<button\b[^>]*>([^<]+)<\/button>/gi)) {
    const label = visibleTextFromHtml(match[1]);
    if (label && /[a-z0-9]/i.test(label)) labels.push(label);
  }
  return labels;
}

export function auditElementCaps(html, context) {
  const failures = [];
  const check = (label, text, cap, rule) => {
    const count = words(text);
    if (count > cap) failures.push(`${context}: ${rule} "${text}" renders ${count} words (cap ${cap})`);
  };

  for (const el of extractElementsByClass(html, 'mc-eyebrow')) check('eyebrow', visibleTextFromHtml(el), 2, 'eyebrow');
  for (const cls of ['cmdgrp', 'mc-section-title', 'gate-stack-header', 'inspect-pane-heading']) {
    for (const el of extractElementsByClass(html, cls)) check('section header', visibleTextFromHtml(el), 2, `section header .${cls}`);
  }
  for (const match of html.matchAll(/aria-label="state: ([^"]*)"/g)) {
    const label = decodeHtmlText(match[1]);
    check('state-token subtitle', label, 3, 'state-token subtitle');
    if (label.includes('!')) failures.push(`${context}: state label "${label}" carries an exclamation mark (frozen/05 §4.6)`);
  }
  for (const el of extractElementsByClass(html, 'mc-token-label')) {
    const label = visibleTextFromHtml(el);
    if (label.includes('!')) failures.push(`${context}: state label "${label}" carries an exclamation mark (frozen/05 §4.6)`);
  }
  for (const row of extractElementsByClass(html, 'mc-proof-row')) check('ProofList row label', firstTagText(row, 'b'), 4, 'ProofList row label');
  for (const row of extractElementsByClass(html, 'mc-meta-row')) {
    check('meta row label', firstTagText(row, 'b'), 2, 'meta row label');
    check('meta row value', firstTagText(row, 'span'), 4, 'meta row value');
  }
  for (const row of extractElementsByClass(html, 'mc-kpi-copy')) {
    check('KPI label', firstTagText(row, 'b'), 3, 'KPI label');
    check('KPI value', firstTagText(row, 'span'), 5, 'KPI value');
  }
  for (const chip of extractElementsByClass(html, 'mc-branch-copy')) check('chip label', firstTagText(chip, 'b'), 2, 'chip label');
  for (const label of leafButtonLabels(html)) check('button label', label, 3, 'button label');
  for (const cls of ['mission-empty', 'gate-empty', 'gate-error']) {
    // frozen/05 §2: ≤ 12 words + action button(s) — buttons are excluded from the count
    // (frozen/04 EMPTY pattern: 11-word title+body + outline CTA; frozen/06 G10/M12 keep buttons).
    for (const el of extractElementsByClass(html, cls)) {
      check('empty/error state', visibleTextFromHtml(el.replace(/<button\b[\s\S]*?<\/button>/gi, ' ')), 12, `empty/error state .${cls}`);
    }
  }
  return failures;
}

// frozen/06 verbatim tables are the more specific copy authority. Where a ratified verbatim
// string exceeds a general frozen/05 §2 element cap, the audit keeps the copy, waives the
// element failure, and reports the conflict as an OVERRIDE line for orchestrator adjudication.
export const RATIFIED_VERBATIM_OVERRIDES = [
  {
    pattern: /^mission\/empty: empty\/error state \.mission-empty /,
    reason: 'frozen/06 M12 ratifies this exact empty state (title KEEP `Mission control is waiting for branch packets.` + rewritten body `branch packets have not reached this device` + buttons KEEP) while citing the §2 12-word cap in the same row; title+body renders 14 words. Verbatim copy kept; spec conflict flagged for orchestrator adjudication.',
  },
];

function partitionElementFailures(failures) {
  const kept = [];
  const waived = [];
  for (const failure of failures) {
    const override = RATIFIED_VERBATIM_OVERRIDES.find((entry) => entry.pattern.test(failure));
    if (override) waived.push({ failure, reason: override.reason });
    else kept.push(failure);
  }
  return { kept, waived };
}

// ── banned-list checks (frozen/05 §4) ─────────────────────────────────────────────────────

export function auditBannedPatterns(html, context, { inspectSurface = false } = {}) {
  const failures = [];
  const text = visibleTextFromHtml(html);
  for (const banned of BANNED_AI_COPY) {
    if (text.toLowerCase().includes(banned)) failures.push(`${context}: banned AI-copy term "${banned}" (frozen/05 §4.4)`);
  }
  if (BANNED_INITDATA_COPY.test(text)) failures.push(`${context}: initData ritual copy is visible (frozen/05 §4.7)`);
  if (BANNED_REDACTION_COPY.test(text)) failures.push(`${context}: redaction violation in rendered strings (frozen/05 §4.8)`);
  if (BANNED_COPY_COMMAND_COPY.test(text) || /data-copy-command/.test(html)) {
    failures.push(`${context}: copy-paste command affordance (frozen/05 §4.1)`);
  }
  if (EMOJI_PATTERN.test(text)) failures.push(`${context}: emoji in rendered strings (frozen/05 §4.5)`);
  if (!inspectSurface && /<div class="kv[">]/.test(html)) failures.push(`${context}: kv grid outside Inspect (frozen/05 §4.3)`);
  if (!inspectSurface && /class="nar"/.test(html)) failures.push(`${context}: paragraph narrative on a primary surface (frozen/05 §4.2)`);
  return failures;
}

// ── minimal page harness (mirror of renderPageFixtureContext in handler.test.ts) ──────────

class FakeClassList {
  #names = new Set();
  add(...tokens) { for (const token of tokens) this.#names.add(token); }
  remove(...tokens) { for (const token of tokens) this.#names.delete(token); }
  toggle(token, force) {
    const on = force ?? !this.#names.has(token);
    if (on) this.#names.add(token); else this.#names.delete(token);
    return on;
  }
  has(token) { return this.#names.has(token); }
}

function fakeStyle() {
  const style = {};
  style.setProperty = (name, value) => { style[name] = value; };
  return style;
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function dataKey(name) {
  return name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function htmlAttributes(tag) {
  const attrs = new Map();
  for (const match of tag.matchAll(/\s([a-zA-Z0-9_:-]+)(?:="([^"]*)")?/g)) {
    attrs.set(match[1], decodeHtmlAttribute(match[2] ?? ''));
  }
  return attrs;
}

function htmlMatchesSingleSelector(attrs, tagName, selector) {
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

function htmlMatchesSelector(attrs, tagName, selector) {
  return selector.split(',').some((part) => htmlMatchesSingleSelector(attrs, tagName, part));
}

function prepareFakeEvent(rawEvent, fallbackType, target) {
  const event = rawEvent || {};
  event.type ||= fallbackType;
  event.target ||= target;
  event.bubbles = event.bubbles !== false;
  event.cancelBubble = false;
  event.defaultPrevented = Boolean(event.defaultPrevented);
  event.preventDefault = () => { event.defaultPrevented = true; };
  event.stopPropagation = () => { event.cancelBubble = true; };
  return event;
}

function makeElement(id, tagName = 'div', initialAttrs = new Map()) {
  let html = '';
  let htmlVersion = 0;
  let disabled = initialAttrs.has('disabled');
  const attrs = new Map(initialAttrs);
  const listeners = new Map();
  const queryCache = new Map();
  const dataset = {};
  for (const [name, value] of attrs) {
    if (name.startsWith('data-')) dataset[dataKey(name)] = value;
  }
  const element = {
    id,
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    parentElement: null,
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = String(value);
      htmlVersion += 1;
      queryCache.clear();
    },
    textContent: '',
    style: fakeStyle(),
    classList: new FakeClassList(),
    dataset,
    children: [],
    clientWidth: 390,
    scrollTop: 0,
    get disabled() { return disabled; },
    set disabled(value) {
      disabled = Boolean(value);
      if (disabled) attrs.set('disabled', ''); else attrs.delete('disabled');
    },
    onclick: null,
    onkeydown: null,
    eventListeners: listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    setAttribute(name, value) {
      const normalizedValue = String(value);
      attrs.set(name, normalizedValue);
      if (name.startsWith('data-')) this.dataset[dataKey(name)] = normalizedValue;
      if (name === 'disabled') disabled = true;
    },
    getAttribute(name) { return attrs.get(name) ?? null; },
    hasAttribute(name) { return attrs.has(name); },
    matches(selector) { return htmlMatchesSelector(attrs, tagName, selector); },
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches(selector)) return node;
        node = node.parentElement;
      }
      return null;
    },
    setPointerCapture() {},
    focus() {},
    dispatchEvent(rawEvent) {
      const event = prepareFakeEvent(rawEvent, rawEvent?.type || 'event', this);
      let node = this;
      while (node) {
        event.currentTarget = node;
        for (const listener of node.eventListeners.get(event.type) ?? []) listener.call(node, event);
        const propertyHandler = node[`on${event.type}`];
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
    querySelectorAll(selector) {
      const key = `${htmlVersion} ${selector}`;
      if (!queryCache.has(key)) {
        const nodes = [];
        for (const match of this.innerHTML.matchAll(/<([a-z0-9-]+)\b([^>]*)>/gi)) {
          const matchedTagName = match[1].toLowerCase();
          const matchedAttrs = htmlAttributes(match[0]);
          if (!htmlMatchesSelector(matchedAttrs, matchedTagName, selector)) continue;
          const node = makeElement(`${id}:query:${nodes.length}`, matchedTagName, matchedAttrs);
          node.parentElement = this;
          node.innerHTML = match[0];
          node.textContent = match[0];
          nodes.push(node);
        }
        queryCache.set(key, nodes);
      }
      return queryCache.get(key);
    },
    querySelector(selector) {
      const found = this.querySelectorAll(selector)[0];
      if (found) return found;
      const empty = makeElement(`${id}:query`);
      empty.parentElement = this;
      return empty;
    },
  };
  return element;
}

let PAGE_PROMISE = null;
function loadPage() {
  if (!PAGE_PROMISE) PAGE_PROMISE = import(pathToFileURL(join(REPO_ROOT, 'workers/quests/src/page.ts')).href);
  return PAGE_PROMISE;
}

export async function renderPageFixtureContext(envelope, options = {}) {
  const { PAGE } = await loadPage();
  const scripts = [...PAGE.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => script.trim() && !script.includes('telegram-web-app'));
  if (scripts.length !== 1) throw new Error(`page has ${scripts.length} inline app scripts, expected 1`);

  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  for (const id of ['ten', 'fresh', 'sceneBadge', 'ptr', 'ptrProof', 'track', 'ind', 'tb0', 'tb1', 'tb2', 'tb3', 'tb4',
    'stem', 'fill', 'progress', 'here', 'mapwrap', 'beats', 'gauge', 'gate', 'cmds', 'veil', 'sheet', 'sheetBody']) {
    getElementById(id);
  }
  getElementById('sheetBody').parentElement = getElementById('sheet');

  const fixedNow = options.now ? Date.parse(options.now) : null;
  const context = {
    document: { getElementById, querySelectorAll: () => [] },
    window: { Telegram: undefined, addEventListener() {}, innerWidth: 390 },
    location: { search: options.search ?? '' },
    matchMedia: () => ({ matches: options.reducedMotion !== false }),
    navigator: {},
    fetch: async () => ({ ok: true, json: async () => envelope }),
    requestAnimationFrame: (fn) => { fn(0); return 0; },
    performance: { now: () => 0 },
    Date: fixedNow === null ? Date : { parse: Date.parse, now: () => fixedNow },
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  context.Telegram = context.window.Telegram;
  context.globalThis = context;
  vm.runInContext(scripts[0], vm.createContext(context));
  const flushRounds = options.flushRounds ?? 5;
  for (let i = 0; i < flushRounds; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  return { elements, context };
}

// ── scene assembly: static scaffold section + rendered dynamic roots ──────────────────────

async function loadScaffold() {
  const { SCAFFOLD } = await import(pathToFileURL(join(REPO_ROOT, 'workers/quests/src/page/scaffold.ts')).href);
  return SCAFFOLD;
}

// The scaffold carries no nested scene sections; slice each <section class="scene"> block by
// marker offsets so the gate hero's nested <section class="gate-hero"> stays intact.
export function extractSceneSection(scaffold, sceneElementId) {
  const markers = [...scaffold.matchAll(/<section class="scene" id="(scene[A-Z])"[^>]*>/g)];
  for (const [index, marker] of markers.entries()) {
    if (marker[1] !== sceneElementId) continue;
    const start = marker.index;
    const end = index + 1 < markers.length ? markers[index + 1].index : scaffold.indexOf('<div class="veil"');
    return scaffold.slice(start, end);
  }
  throw new Error(`scaffold is missing scene section ${sceneElementId}`);
}

function swapElementInner(html, id, content) {
  const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)<\\/\\2>`, 'i');
  return html.replace(re, (match, open, tag) => open + content + `</${tag}>`);
}

const SCENE_TARGETS = [
  { id: 'mission', sceneElementId: 'sceneQ', inner: ['stem'], text: ['progress', 'here'] },
  { id: 'gate', sceneElementId: 'sceneG', inner: ['gate', 'gauge', 'gateHeroDecision'], text: [] },
  { id: 'tools', sceneElementId: 'sceneC', inner: ['cmds'], text: [] },
  { id: 'story', sceneElementId: 'sceneS', inner: ['beats'], text: [] },
  { id: 'inspect', sceneElementId: 'sceneF', inner: ['mapwrap'], text: [] },
];

export async function renderSceneHtml(sceneId, envelope, scaffold, options = {}) {
  const target = SCENE_TARGETS.find((scene) => scene.id === sceneId);
  if (!target) throw new Error(`unknown scene ${sceneId}`);
  const rendered = await renderPageFixtureContext(envelope, { ...options, search: `?scene=${sceneId}` });
  let html = extractSceneSection(scaffold, target.sceneElementId);
  for (const id of target.inner) html = swapElementInner(html, id, rendered.elements.get(id).innerHTML);
  for (const id of target.text) html = swapElementInner(html, id, rendered.elements.get(id).textContent);
  return { html, rendered };
}

export async function renderChromeHtml(scaffold, rendered) {
  const header = scaffold.match(/<header class="root-status"[\s\S]*?<\/header>/);
  const nav = scaffold.match(/<nav class="root-nav"[\s\S]*?<\/nav>/);
  if (!header || !nav) throw new Error('scaffold is missing chrome header/nav');
  let html = header[0] + nav[0];
  for (const id of ['ten', 'fresh', 'sceneBadge']) html = swapElementInner(html, id, rendered.elements.get(id).textContent);
  return html;
}

// ── audit driver ──────────────────────────────────────────────────────────────────────────

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function toolsEnvelope(fixture, state) {
  // The scene fixture intentionally carries no quest ledger; add a minimal empty one so
  // paint() runs (load() short-circuits envelopes without a ledger before CMDDATA is set).
  return {
    ...fixture.states[state].envelope,
    ledger: { completed: 0, total: 0, current: null, rows: [] },
  };
}

export function mergeProductionEnvelope(baseline, stateEnvelope) {
  const envelope = { ...baseline, ...stateEnvelope };
  if (envelope.ledger && !Array.isArray(envelope.ledger.rows)) {
    envelope.ledger = { ...envelope.ledger, rows: Array.isArray(baseline.ledger?.rows) ? baseline.ledger.rows : [] };
  }
  return envelope;
}

export async function auditTextDensity(rootValue = REPO_ROOT) {
  const root = rootValue instanceof URL ? fileURLToPath(rootValue) : String(rootValue);
  const scaffold = await loadScaffold();
  const failures = [];
  const overrides = [];
  const sceneReports = [];

  // Scene fixtures are per-scene minimal envelopes, but production always serves one complete
  // envelope and paint() is all-or-nothing: a partial envelope throws in another scene's
  // painter before the gauge/freshness chrome renders. Merge each fixture state over the
  // richest baseline (inspect normal) so every painter completes; the fixture's own fields
  // always win, so scene-relevant data stays fixture-calibrated. A served quest ledger always
  // carries rows (quest-ledger-envelope@v1), so a fixture ledger without rows inherits the
  // baseline rows — this mirrors production shape, never the scene copy under audit.
  const inspectBaseline = (await readJson(join(root, 'workers/quests/src/page/scenes/fixtures/inspect.fixture.json'))).states.normal.envelope;
  const productionEnvelope = (stateEnvelope) => mergeProductionEnvelope(inspectBaseline, stateEnvelope);

  for (const target of SCENE_TARGETS) {
    const contract = await readJson(join(root, `docs/architecture/contracts/scenes/${target.id}.json`));
    const fixture = await readJson(join(root, `workers/quests/src/page/scenes/fixtures/${target.id}.fixture.json`));
    const cap = Number(contract.wordCap);
    if (!Number.isFinite(cap) || cap < 1) failures.push(`${target.id}: contract wordCap is missing`);

    const stateReports = {};
    for (const state of Object.keys(fixture.states)) {
      const stateEnvelope = target.id === 'tools' ? toolsEnvelope(fixture, state) : fixture.states[state].envelope;
      const envelope = productionEnvelope(stateEnvelope);
      const context = `${target.id}/${state}`;
      const { html } = await renderSceneHtml(target.id, envelope, scaffold, { now: FIXTURE_NOW });
      const count = countWords(html);
      const stateFailures = [];
      if (count > cap) stateFailures.push(`${context}: renders ${count} words at rest (cap ${cap})`);
      stateFailures.push(...auditElementCaps(collapseClosedDetails(html), context));
      stateFailures.push(...auditBannedPatterns(html, context, { inspectSurface: target.id === 'inspect' }));
      const partitioned = partitionElementFailures(stateFailures);
      failures.push(...partitioned.kept);
      overrides.push(...partitioned.waived);
      stateReports[state] = { words: count, cap, ok: partitioned.kept.length === 0, failures: partitioned.kept };
    }
    sceneReports.push({ scene: target.id, cap, states: stateReports });
  }

  // Shared chrome (header/nav/chip rail) is counted once against its own ≤25-word budget.
  const missionFixture = await readJson(join(root, 'workers/quests/src/page/scenes/fixtures/mission.fixture.json'));
  const chromeRendered = await renderPageFixtureContext(
    productionEnvelope(missionFixture.states.normal.envelope),
    { now: FIXTURE_NOW, search: '?scene=mission' },
  );
  const chromeHtml = await renderChromeHtml(scaffold, chromeRendered);
  const chromeWords = countWords(chromeHtml);
  const chromeFailures = [];
  if (chromeWords > CHROME_WORD_CAP) chromeFailures.push(`chrome: renders ${chromeWords} words (cap ${CHROME_WORD_CAP})`);
  chromeFailures.push(...auditBannedPatterns(chromeHtml, 'chrome'));
  failures.push(...chromeFailures);

  return {
    ok: failures.length === 0,
    failures,
    overrides,
    scenes: sceneReports,
    chrome: { words: chromeWords, cap: CHROME_WORD_CAP, ok: chromeFailures.length === 0, failures: chromeFailures },
  };
}

export function formatReport(report) {
  const lines = [];
  lines.push('text-density audit (frozen/05 §5) — visible words at rest vs contract caps');
  lines.push('');
  lines.push('scene    state    words   cap  result');
  lines.push('───────  ───────  ──────  ───  ──────');
  for (const scene of report.scenes) {
    for (const [state, info] of Object.entries(scene.states)) {
      lines.push(
        `${scene.scene.padEnd(7)}  ${state.padEnd(7)}  ${String(info.words).padStart(6)}  ${String(info.cap).padStart(3)}  ${info.ok ? 'ok' : 'FAIL'}`,
      );
    }
  }
  lines.push(`${'chrome'.padEnd(7)}  ${'shared'.padEnd(7)}  ${String(report.chrome.words).padStart(6)}  ${String(report.chrome.cap).padStart(3)}  ${report.chrome.ok ? 'ok' : 'FAIL'}`);
  lines.push('');
  if (report.overrides.length > 0) {
    lines.push(`${report.overrides.length} ratified-verbatim override(s) — spec conflict flagged for orchestrator adjudication:`);
    for (const override of report.overrides) {
      lines.push(`  OVERRIDE: ${override.failure}`);
      lines.push(`    reason: ${override.reason}`);
    }
    lines.push('');
  }
  if (report.failures.length === 0) {
    lines.push('Text-density audit passed: every scene within cap, no element over cap, no banned-list hits.');
  } else {
    lines.push(`${report.failures.length} failure(s):`);
    for (const failure of report.failures) lines.push(`  DENSITY: ${failure}`);
  }
  return lines.join('\n');
}

async function main() {
  const report = await auditTextDensity(REPO_ROOT);
  process.stdout.write(`${formatReport(report)}\n`);
  if (process.argv.includes('--write')) {
    const outPath = join(REPO_ROOT, 'docs/plans/assets/tg-miniapp-viewport-proof/text-density-report.json');
    await writeFile(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
    process.stdout.write(`Report archived to ${outPath}\n`);
  }
  if (!report.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
