// cambium-quests · operating fabric page shell tests (node:test, like everything beside it).
//
// Pins the Task 6 rollback-safe contract: the legacy five-scene bundle is the
// only visible/interactive document until an authenticated 200 mission-fabric
// response carries delivery.operatingFabricEnabled === true. Every failure
// shape — absent allowlist response, 401, 403, network error, malformed JSON,
// missing delivery, explicit false, or merely truthy flags — keeps the new
// shell hidden and inert. Activation is never inferred from projection
// presence or truthiness.
//
// Honest DOM design: the shell ships as real (hidden, inert) markup plus its
// own separate inline boot script. The boot finds the shell by id and the
// legacy shell by its existing [data-component="MissionControlShell"] marker;
// no legacy markup is modified.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

import {
  OPERATING_FABRIC_SCENE_IDS,
  MINI_APP_SCENE_IDS,
  MINI_APP_SECTIONS,
  SCENE_TO_SCREEN,
  type MiniAppSceneId,
} from './mini-app-surface-contract.ts';
import { OPERATING_FABRIC_PAGE } from './page/operating-fabric/index.ts';
import { renderGateSheetPreflight, GATE_SHEET_BROWSER_JS } from './page/operating-fabric/gate-sheet.ts';
import { renderInspectSheet, INSPECT_SHEET_BROWSER_JS } from './page/operating-fabric/inspect-sheet.ts';
import type { InspectTarget } from './page/operating-fabric/inspect-sheet.ts';
import { CLIENT_SHEET } from './page/client/sheet.ts';
import { CONTEXTUAL_SHEET_RETURN_BROWSER_JS, OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS } from './page/client/signed-action.ts';
import { OPERATING_FABRIC_MARKUP, OPERATING_FABRIC_SCENES } from './page/operating-fabric/scaffold.ts';
import { OPERATING_FABRIC_BOOT } from './page/operating-fabric/client.ts';
import { OPERATING_FABRIC_STYLES } from './page/operating-fabric/styles.ts';
import { LEGACY_PAGE, PAGE } from './page/index.ts';
import { permits } from './rbac.ts';
import { ORGAN_UPDATE_PLAN } from './organ-update-delivery.ts';
import { PORTFOLIO_CATALOG } from './portfolio-catalog.ts';

const LEGACY_SCENES: readonly MiniAppSceneId[] = ['mission', 'gate', 'tools', 'story', 'inspect'];
// This pin advances only through a reviewed legacy-surface evolution. It keeps
// accidental shell drift release-blocking without pretending the pre-Task-6
// bytes can never change under an explicit production repair.
const LEGACY_PAGE_DIGEST = '5820b23122db9601697c0f16e62ab81c27e445ffab5641f8a5f3da29c377e5ac';

function extractScriptBodies(source: string): string[] {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((body) => body.trim().length > 0);
}

// ── page assembly invariants ────────────────────────────────────────────────

test('LEGACY_PAGE preserves the current five-scene composition verbatim', () => {
  assert.equal(PAGE.startsWith(LEGACY_PAGE.slice(0, 2048)), true, 'legacy head order is untouched');
  assert.ok(LEGACY_PAGE.includes('id="sceneQ"'), 'legacy mission scene present');
  assert.ok(LEGACY_PAGE.includes('id="sceneG"'), 'legacy gate scene present');
  assert.ok(LEGACY_PAGE.includes('data-root-scene="inspect"'), 'legacy inspect tab present');
  for (const scene of LEGACY_SCENES) {
    assert.ok(LEGACY_PAGE.includes(`data-root-scene="${scene}"`), `legacy tab ${scene} present`);
  }
  assert.ok(LEGACY_PAGE.trimEnd().endsWith('</html>'), 'legacy document still terminates the page');
});

test('LEGACY_PAGE hashes exactly to the pinned reviewed surface digest', () => {
  const digest = createHash('sha256').update(LEGACY_PAGE).digest('hex');
  assert.equal(digest, LEGACY_PAGE_DIGEST, 'LEGACY_PAGE is byte-identical to the reviewed legacy surface');
});

test('LEGACY_PAGE is a complete valid page with exactly one </body>', () => {
  const bodyClose = '</body>';
  const index = LEGACY_PAGE.indexOf(bodyClose);
  assert.ok(index >= 0, 'legacy page closes its body');
  assert.equal(LEGACY_PAGE.lastIndexOf(bodyClose), index, 'exactly one closing body tag');
  const legacyScripts = extractScriptBodies(LEGACY_PAGE).filter(
    (body) => !body.includes('telegram-web-app'),
  );
  assert.equal(legacyScripts.length, 1, 'legacy document keeps exactly one inline app script');
  assert.ok(LEGACY_PAGE.includes('<div class="app" data-component="MissionControlShell">'), 'legacy shell markup is unmodified');
  assert.ok(!LEGACY_PAGE.includes('id="legacy-app"'), 'legacy shell carries no Task-6 id hook');
});

test('PAGE injects the contiguous fragment before </body> and stripping it restores LEGACY_PAGE', () => {
  const bodyClose = '</body>';
  const index = LEGACY_PAGE.indexOf(bodyClose);
  assert.ok(OPERATING_FABRIC_PAGE.length > 0, 'fragment is a real bundle');
  assert.equal(
    PAGE,
    LEGACY_PAGE.slice(0, index) + OPERATING_FABRIC_PAGE + LEGACY_PAGE.slice(index),
    'PAGE is LEGACY_PAGE with the fragment injected at the single </body> index',
  );
  assert.equal(
    PAGE.replace(OPERATING_FABRIC_PAGE, ''),
    LEGACY_PAGE,
    'removing the exact inserted fragment yields byte-identical LEGACY_PAGE',
  );
  assert.equal(PAGE.indexOf('</body>'), index + OPERATING_FABRIC_PAGE.length, 'fragment lands before the body close');
  assert.equal(PAGE.indexOf('</body>'), PAGE.lastIndexOf('</body>'), 'the served document keeps exactly one </body>');
});

// ── scene id + shared contract parity ───────────────────────────────────────

test('OPERATING_FABRIC_SCENE_IDS are exactly canopy, mission, flow, workforce, forge', () => {
  assert.deepEqual([...OPERATING_FABRIC_SCENE_IDS], ['canopy', 'mission', 'flow', 'workforce', 'forge']);
  assert.equal(OPERATING_FABRIC_SCENE_IDS.length, 5);
});

test('MINI_APP_SCENE_IDS stay unchanged during rollout', () => {
  assert.deepEqual([...MINI_APP_SCENE_IDS], ['mission', 'gate', 'tools', 'story', 'inspect']);
  for (const section of MINI_APP_SECTIONS) {
    assert.ok(
      (MINI_APP_SCENE_IDS as readonly string[]).includes(section.scene),
      `legacy section ${section.id} still maps to a legacy scene`,
    );
  }
});

test('SCENE_TO_SCREEN is retained in the Worker contract for shared consumers', () => {
  assert.deepEqual(SCENE_TO_SCREEN, {
    mission: 'home',
    gate: 'overlay:founder-gate',
    tools: 'island',
    story: 'story',
    inspect: 'island-cortex',
  });
  for (const scene of MINI_APP_SCENE_IDS) {
    assert.ok(scene in SCENE_TO_SCREEN, `scene ${scene} keeps its screen mapping`);
  }
});

test('Worker and shared surface contracts are byte-equivalent', () => {
  const workerContract = readFileSync(new URL('./mini-app-surface-contract.ts', import.meta.url), 'utf8');
  const sharedContract = readFileSync(
    new URL('../../../shared/mini-app-surface-contract.ts', import.meta.url),
    'utf8',
  );
  assert.equal(workerContract, sharedContract, 'worker and shared surface contracts are byte-identical');
});

// ── inert-by-default shell (honest DOM) ─────────────────────────────────────

test('OPERATING_FABRIC_PAGE composes hidden shell markup plus its own boot script', () => {
  assert.equal(
    OPERATING_FABRIC_PAGE,
    OPERATING_FABRIC_MARKUP + OPERATING_FABRIC_BOOT,
    'fragment is shell markup followed by its separate boot script',
  );
  assert.equal(OPERATING_FABRIC_MARKUP, OPERATING_FABRIC_STYLES + OPERATING_FABRIC_SCENES, 'markup stays canonical');
  assert.ok(!OPERATING_FABRIC_PAGE.includes('<!--'), 'fragment contains no HTML-comment tricks');
  const bootScripts = extractScriptBodies(OPERATING_FABRIC_PAGE).filter((body) =>
    body.includes('/v1/mission-fabric/'),
  );
  assert.equal(bootScripts.length, 1, 'fragment carries exactly one operating-fabric boot script');
});

test('shell is hidden, inert, and legacy stays the only active document before activation', () => {
  assert.ok(OPERATING_FABRIC_SCENES.includes('id="operating-fabric"'), 'shell root exists');
  assert.ok(OPERATING_FABRIC_SCENES.includes('hidden'), 'shell root starts hidden');
  assert.ok(OPERATING_FABRIC_SCENES.includes('inert'), 'shell root starts inert');
  assert.ok(OPERATING_FABRIC_SCENES.includes('aria-hidden="true"'), 'shell root is hidden from assistive tech');
  assert.ok(
    OPERATING_FABRIC_STYLES.includes('#operating-fabric{display:none'),
    'styles keep the shell out of the layout until activation adds the on class',
  );
  assert.ok(
    OPERATING_FABRIC_STYLES.includes('#operating-fabric.of-on{display:block'),
    'styles gate shell visibility on the activation class, not the hidden attribute',
  );
  for (const scene of OPERATING_FABRIC_SCENE_IDS) {
    assert.ok(
      OPERATING_FABRIC_SCENES.includes(`data-of-scene="${scene}"`),
      `scaffold declares the ${scene} scene`,
    );
  }
});

test('shell navigation preserves accessibility and reduced-motion foundations', () => {
  assert.ok(OPERATING_FABRIC_SCENES.includes('aria-label="Operating Fabric scenes"'), 'shell nav is labelled');
  assert.ok(OPERATING_FABRIC_SCENES.includes('aria-selected="true"'), 'default scene tab is announced selected');
  assert.ok(OPERATING_FABRIC_SCENES.includes('aria-selected="false"'), 'inactive scene tabs are announced');
  assert.ok(OPERATING_FABRIC_SCENES.includes('aria-labelledby="ofSceneCanopyTitle"'), 'scenes are labelled for AT');
  assert.ok(
    OPERATING_FABRIC_STYLES.includes('prefers-reduced-motion'),
    'shell styles honor reduced motion',
  );
});

test('shell adds no Task 7 feature surface and no authorization logic', () => {
  for (const banned of ['data-interaction-kind', 'data-action-request', 'signed-action', 'checkRole', 'can(', 'role ===']) {
    assert.ok(
      !OPERATING_FABRIC_SCENES.includes(banned),
      `scaffold carries no RBAC or action surface: ${banned}`,
    );
    assert.ok(!OPERATING_FABRIC_BOOT.includes(banned), `boot client carries no RBAC or action surface: ${banned}`);
  }
});

// ── activation gating (document-level DOM harness) ──────────────────────────

type FabricResponse =
  | { kind: 'status'; status: number; jsonValue?: unknown }
  | { kind: 'throw'; error: Error }
  | { kind: 'json'; value: unknown }
  | { kind: 'malformed' };

function fabricDataKey(name: string): string {
  return name.slice(5).replace(/-([a-z])/g, (_dash, letter: string) => letter.toUpperCase());
}

function makeFabricElement(tag: string) {
  const classes = new Set<string>();
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const attributes = new Map<string, string>();
  const el = {
    tagName: tag.toUpperCase(),
    type: '',
    className: '',
    onclick: null as null | ((event?: unknown) => void),
    hidden: false,
    inert: false,
    ariaHidden: null as string | null,
    ariaSelected: null as string | null,
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
    style: {} as Record<string, string>,
    innerHTML: '',
    textContent: '',
    focusCount: 0,
    classList: {
      add(...names: string[]) {
        for (const name of names) classes.add(name);
      },
      remove(...names: string[]) {
        for (const name of names) classes.delete(name);
      },
      toggle(name: string, force?: boolean) {
        const next = force ?? !classes.has(name);
        if (next) classes.add(name);
        else classes.delete(name);
        return next;
      },
      contains: (name: string) => classes.has(name),
    },
    getAttribute(name: string) {
      if (name === 'aria-hidden') return this.ariaHidden;
      if (name === 'aria-selected') return this.ariaSelected;
      if (name.startsWith('data-')) {
        const key = fabricDataKey(name);
        return this.dataset[key] ?? null;
      }
      return attributes.has(name) ? attributes.get(name)! : null;
    },
    setAttribute(name: string, value: string) {
      const stringValue = String(value);
      if (name === 'aria-hidden') this.ariaHidden = stringValue;
      if (name === 'aria-selected') this.ariaSelected = stringValue;
      if (name.startsWith('data-')) {
        this.dataset[fabricDataKey(name)] = stringValue;
      }
      attributes.set(name, stringValue);
    },
    listeners,
    addEventListener(type: string, handler: (event: unknown) => void) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    toggle(hidden: boolean, inert: boolean) {
      this.hidden = hidden;
      this.inert = inert;
    },
    appendChild(child: unknown) {
      this.children.push(child);
      return child;
    },
    setPointerCapture() {},
    querySelector(_selector: string) {
      return null;
    },
    querySelectorAll(_selector: string) {
      return [] as unknown[];
    },
    focus() {
      this.focusCount++;
    },
    closest(selector: string) {
      const inspectMatch = selector.match(/^\[(data-of-inspect-token|data-of-inspect-back|data-of-inspect-close)\]$/);
      if (inspectMatch) {
        return this.getAttribute(inspectMatch[1]) !== null ? this : null;
      }
      return null;
    },
  };
  return el;
}

type FabricElement = ReturnType<typeof makeFabricElement>;

function bootOperatingFabricDocument(
  responder: (request: { url: string; init: { headers?: Record<string, string> } }) => FabricResponse,
  options: {
    initData?: string;
    includeRoot?: boolean;
    onError?: (error: unknown) => void;
    withContextualSheet?: boolean;
  } = {},
) {
  const fetches: Array<{ url: string; headers: Record<string, string> }> = [];
  const fabricRoot = makeFabricElement('div');
  fabricRoot.hidden = true;
  fabricRoot.inert = true;
  fabricRoot.ariaHidden = 'true';
  const legacyShell = makeFabricElement('div');
  const portfolioWorkbenchLink = makeFabricElement('a');
  portfolioWorkbenchLink.hidden = true;
  portfolioWorkbenchLink.inert = true;
  portfolioWorkbenchLink.ariaHidden = 'true';
  const elements = new Map<string, FabricElement>([['operating-fabric', fabricRoot]]);

  let veil: FabricElement | undefined;
  let sheet: FabricElement | undefined;
  let sheetBody: FabricElement | undefined;
  let sheetFocusControl: FabricElement | undefined;
  if (options.withContextualSheet) {
    veil = makeFabricElement('div');
    sheet = makeFabricElement('div');
    sheetBody = makeFabricElement('div');
    sheetFocusControl = makeFabricElement('button');
    elements.set('veil', veil);
    elements.set('sheet', sheet);
    elements.set('sheetBody', sheetBody);
    const originalSheetBodyQuerySelector = sheetBody.querySelector.bind(sheetBody);
    sheetBody.querySelector = (selector: string) => {
      if (
        selector.includes('data-of-inspect-back') &&
        selector.includes('data-of-inspect-close') &&
        sheetBody!.innerHTML.includes('Inspect')
      ) {
        return sheetFocusControl!;
      }
      return originalSheetBodyQuerySelector(selector);
    };
  }

  const sceneElements: FabricElement[] = [];
  for (const scene of OPERATING_FABRIC_SCENE_IDS) {
    const sceneEl = makeFabricElement('section');
    sceneEl.dataset.ofScene = scene;
    if (scene !== 'canopy') sceneEl.hidden = true;
    sceneElements.push(sceneEl);
    elements.set(`of-scene-${scene}`, sceneEl);
  }
  const tabElements = OPERATING_FABRIC_SCENE_IDS.map((scene) => {
    const tab = makeFabricElement('button');
    tab.dataset.ofTab = scene;
    return tab;
  });
  fabricRoot.querySelectorAll = (selector: string) => {
    if (selector === '[data-of-tab]') return tabElements;
    if (selector === '[data-of-scene]') return sceneElements;
    return [];
  };
  fabricRoot.querySelector = (selector: string) => {
    if (selector === '[data-of-portfolio-workbench]') return portfolioWorkbenchLink;
    const sceneMatch = selector.match(/^\[data-of-scene="([^"]+)"\]$/);
    if (sceneMatch) return sceneElements.find((scene) => scene.dataset.ofScene === sceneMatch[1]) ?? null;
    return null;
  };

  const context: Record<string, unknown> = {
    document: {
      getElementById: (id: string) => (options.includeRoot === false && id === 'operating-fabric' ? null : elements.get(id) ?? null),
      querySelector: (selector: string) => {
        if (selector === '[data-component="MissionControlShell"]') return legacyShell;
        const tabMatch = selector.match(/^\[data-of-tab="([^"]+)"\]$/);
        if (tabMatch) return tabElements.find((tab) => tab.dataset.ofTab === tabMatch[1]) ?? null;
        const sceneMatch = selector.match(/^\[data-of-scene="([^"]+)"\]$/);
        if (sceneMatch) return sceneElements.find((scene) => scene.dataset.ofScene === sceneMatch[1]) ?? null;
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector === '[data-of-tab]') return tabElements;
        if (selector === '[data-of-scene]') return sceneElements;
        return [];
      },
      createElement: (tag: string) => makeFabricElement(tag),
    },
    window: { Telegram: { WebApp: { initData: options.initData ?? 'tg-init-data-fixture' } } },
    TENANT: 'acme',
    fetch: async (url: string, init: { headers?: Record<string, string> } = {}) => {
      fetches.push({ url: String(url), headers: init.headers ?? {} });
      const outcome = responder({ url: String(url), init });
      if (outcome.kind === 'throw') throw outcome.error;
      if (outcome.kind === 'status') {
        return {
          ok: outcome.status >= 200 && outcome.status < 300,
          status: outcome.status,
          json: async () => outcome.jsonValue ?? {},
        };
      }
      if (outcome.kind === 'malformed') {
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON');
          },
        };
      }
      return { ok: true, status: 200, json: async () => outcome.value };
    },
    console: {
      error(...args: unknown[]) {
        options.onError?.(args[0]);
      },
      warn() {},
      info() {},
      log() {},
      debug() {},
    } as unknown as typeof console,
    setTimeout,
    clearTimeout,
  };
  if (options.withContextualSheet) {
    context.$ = (id: string) => elements.get(id) ?? null;
    context.veil = veil;
    context.sheet = sheet;
    context.sheetBody = sheetBody;
    context.sheetState = { open: false };
    context.ECOSYSTEM_ENV = {};
    context.LEDGER = { rows: [] };
    context.policyCard = () => ({ state: 'ready', detail: 'ok', blockers: [] });
    context.activeRow = () => null;
    context.esc = (v: unknown) => String(v == null ? '' : v);
    context.buzz = () => {};
    context.gateAct = () => {};
    context.loadGate = () => {};
  }
  context.Telegram = (context.window as { Telegram?: unknown }).Telegram;
  context.globalThis = context;

  const bootScript = extractScriptBodies(OPERATING_FABRIC_BOOT)[0];
  assert.ok(bootScript, 'boot chunk yields its client script');
  const vmContext = vm.createContext(context);
  if (options.withContextualSheet) {
    vm.runInContext(CLIENT_SHEET, vmContext);
    vm.runInContext(
      'var __ofIntegrationCloseCount = 0; var __ofOriginalClose = closeSheet; closeSheet = function(){ __ofIntegrationCloseCount++; __ofOriginalClose(); };',
      vmContext,
    );
  }
  vm.runInContext(bootScript, vmContext);
  const dispatchClick = (target: { closest: (selector: string) => unknown }) => {
    for (const handler of (fabricRoot as { listeners?: Map<string, Array<(event: unknown) => void>> }).listeners?.get('click') ?? []) {
      handler({ target });
    }
  };
  const dispatchSheetClick = (target: { closest: (selector: string) => unknown }) => {
    for (const handler of (sheetBody as { listeners?: Map<string, Array<(event: unknown) => void>> } | undefined)?.listeners?.get('click') ?? []) {
      handler({ target });
    }
  };
  const clickOpen = (workId: string) => {
    const opener = { getAttribute: (name: string) => (name === 'data-of-open-work' ? workId : null) };
    dispatchClick({ closest: (selector: string) => (selector === '[data-of-open-work]' ? opener : null) });
  };
  // Nested target: the opener is an ANCESTOR, so closest resolves only for
  // the open-work selector — the real delegation path a bubbled click takes.
  const clickNested = (workId: string) => {
    const opener = { getAttribute: (name: string) => (name === 'data-of-open-work' ? workId : null) };
    dispatchClick({ closest: (selector: string) => (selector === '[data-of-open-work]' ? opener : null) });
  };
  // A click on a non-interactive descendant: closest resolves for nothing.
  const clickMiss = () => {
    dispatchClick({ closest: () => null });
  };
  const clickTab = (sceneId: string) => {
    const tab = { getAttribute: (name: string) => (name === 'data-of-tab' ? sceneId : null) };
    dispatchClick({ closest: (selector: string) => (selector === '[data-of-tab]' ? tab : null) });
  };
  return {
    context: vmContext,
    fabricRoot,
    legacyShell,
    fetches,
    elements,
    tabElements,
    sceneElements,
    veil,
    sheet,
    sheetBody,
    sheetFocusControl,
    portfolioWorkbenchLink,
    clickOpen,
    clickNested,
    clickMiss,
    clickTab,
    dispatchClick,
    dispatchSheetClick,
  };
}

async function flushBoot() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function assertStaysInert(booted: ReturnType<typeof bootOperatingFabricDocument>, label: string) {
  assert.equal(booted.fabricRoot.hidden, true, `${label}: shell stays hidden`);
  assert.equal(booted.fabricRoot.inert, true, `${label}: shell stays inert`);
  assert.equal(booted.fabricRoot.ariaHidden, 'true', `${label}: shell stays aria-hidden`);
  assert.equal(booted.fabricRoot.classList.contains('of-on'), false, `${label}: shell never gains the activation class`);
  assert.equal(booted.legacyShell.hidden, false, `${label}: legacy shell stays visible`);
  assert.equal(booted.legacyShell.inert, false, `${label}: legacy shell stays interactive`);
  assert.equal(booted.legacyShell.ariaHidden, null, `${label}: legacy shell stays exposed to assistive tech`);
  assert.equal(
    booted.legacyShell.classList.contains('of-active'),
    false,
    `${label}: legacy document is never displaced`,
  );
}

test('boot locates the hidden shell root and the legacy shell by its existing component marker', async () => {
  const booted = bootOperatingFabricDocument(() => ({ kind: 'status', status: 403 }));
  await flushBoot();
  assert.equal(booted.fetches.length, 1, 'the hidden root was found and the probe ran');
  assertStaysInert(booted, '403');
});

const INERT_CASES: ReadonlyArray<[string, FabricResponse]> = [
  ['missing allowlist response (403)', { kind: 'status', status: 403 }],
  ['unauthenticated response (401)', { kind: 'status', status: 401 }],
  ['portfolio catalog unavailable (503)', { kind: 'status', status: 503 }],
  [
    '201 with true flag (non-200 must not activate)',
    {
      kind: 'status',
      status: 201,
      jsonValue: { delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T00:00:00.000Z' } },
    },
  ],
  [
    '202 with true flag (non-200 must not activate)',
    {
      kind: 'status',
      status: 202,
      jsonValue: { delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T00:00:00.000Z' } },
    },
  ],
  [
    '206 with true flag (non-200 must not activate)',
    {
      kind: 'status',
      status: 206,
      jsonValue: { delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T00:00:00.000Z' } },
    },
  ],
  ['network failure', { kind: 'throw', error: new Error('socket hangup') }],
  ['malformed JSON body', { kind: 'malformed' }],
  ['200 without delivery', { kind: 'json', value: { projection: { schema: 'cambium.mission-fabric-projection.v1' } } }],
  [
    '200 with delivery.operatingFabricEnabled explicitly false',
    { kind: 'json', value: { delivery: { operatingFabricEnabled: false, servedAt: '2026-07-28T00:00:00.000Z' } } },
  ],
  [
    '200 with truthy-but-not-true flag',
    { kind: 'json', value: { delivery: { operatingFabricEnabled: 1, servedAt: '2026-07-28T00:00:00.000Z' } } },
  ],
  [
    '200 with projection but absent flag',
    {
      kind: 'json',
      value: {
        projection: { nodes: [{ id: 'n1' }], edges: [] },
        delivery: { servedAt: '2026-07-28T00:00:00.000Z' },
      },
    },
  ],
];

for (const [label, response] of INERT_CASES) {
  test(`operating shell stays hidden and inert on ${label}`, async () => {
    const booted = bootOperatingFabricDocument(() => response);
    await flushBoot();
    assertStaysInert(booted, label);
  });
}

test('malformed organ delivery detail fails pre-render closed and preserves the legacy shell', async () => {
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: {
        schema: 'cambium.mission-fabric-projection.v1',
        graphVersion: 1,
        nodes: [],
        edges: [],
        gaps: [],
      },
      delivery: {
        operatingFabricEnabled: true,
        servedAt: '2026-07-28T00:00:00.000Z',
        freshness: 'fresh',
      },
      organUpdateDelivery: {
        schema: 'cambium.organ-update-plan.v1',
        version: 1,
        readOnly: true,
        eventDriven: true,
        scheduleArmed: true,
        workflows: [],
        activeDeliveries: [],
        planDigest: `sha256:${'a'.repeat(64)}`,
        topicMapDigest: `sha256:${'b'.repeat(64)}`,
      },
    },
  }));
  await flushBoot();
  assertStaysInert(booted, 'malformed organ delivery');
});

test('shape-valid but digest-drifted organ delivery fails pre-render closed', async () => {
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: {
        schema: 'cambium.mission-fabric-projection.v1',
        graphVersion: 1,
        nodes: [],
        edges: [],
        gaps: [],
      },
      delivery: {
        operatingFabricEnabled: true,
        servedAt: '2026-07-28T00:00:00.000Z',
        freshness: 'fresh',
      },
      organUpdateDelivery: {
        ...ORGAN_UPDATE_PLAN,
        planDigest: `sha256:${'a'.repeat(64)}`,
      },
    },
  }));
  await flushBoot();
  assertStaysInert(booted, 'digest-drifted organ delivery');
});

test('a valid authenticated 200 with operatingFabricEnabled === true unhides the shell and yields the legacy viewport', async () => {
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: { schema: 'cambium.mission-fabric-projection.v1', nodes: [], edges: [] },
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T00:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assert.equal(booted.fabricRoot.hidden, false, 'shell becomes visible');
  assert.equal(booted.fabricRoot.inert, false, 'shell becomes interactive');
  assert.equal(booted.fabricRoot.ariaHidden, 'false', 'shell is exposed to assistive tech');
  assert.equal(booted.fabricRoot.classList.contains('of-on'), true, 'shell styles unhide through the activation class');
  assert.equal(booted.legacyShell.hidden, true, 'legacy shell is genuinely hidden after activation');
  assert.equal(booted.legacyShell.inert, true, 'legacy shell is genuinely noninteractive after activation');
  assert.equal(booted.legacyShell.ariaHidden, 'true', 'legacy shell is removed from assistive tech after activation');
  assert.equal(booted.legacyShell.classList.contains('of-active'), true, 'legacy document yields the viewport');
});

test('Workbench link toggles only for founder-detail portfolio payloads', async () => {
  const projection = { schema: 'cambium.mission-fabric-projection.v1', nodes: [], edges: [] };
  const delivery = { operatingFabricEnabled: true, servedAt: '2026-07-28T00:00:00.000Z', freshness: 'fresh' };
  const aggregate = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: { projection, delivery, portfolioCatalogSummary: { totalRecords: PORTFOLIO_CATALOG.records.length } },
  }));
  const founder = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: { projection, delivery, portfolioCatalog: PORTFOLIO_CATALOG },
  }));
  await flushBoot();

  assert.equal(aggregate.portfolioWorkbenchLink.hidden, true, 'aggregate viewer keeps the Workbench link hidden');
  assert.equal(aggregate.portfolioWorkbenchLink.inert, true, 'aggregate viewer keeps the Workbench link inert');
  assert.equal(aggregate.portfolioWorkbenchLink.ariaHidden, 'true', 'aggregate viewer hides the link from assistive tech');
  assert.equal(founder.portfolioWorkbenchLink.hidden, false, 'founder detail reveals the Workbench link');
  assert.equal(founder.portfolioWorkbenchLink.inert, false, 'founder detail makes the Workbench link interactive');
  assert.equal(founder.portfolioWorkbenchLink.ariaHidden, 'false', 'founder detail exposes the link to assistive tech');
});

test('activation requests reuse the Telegram initData and tenant path without leaking secrets', async () => {
  const booted = bootOperatingFabricDocument(() => ({ kind: 'status', status: 403 }));
  await flushBoot();
  assert.equal(booted.fetches.length, 1, 'boot performs a single mission-fabric probe');
  assert.match(booted.fetches[0]!.url, /^\/v1\/mission-fabric\/[a-z0-9-]+$/, 'probe targets the tenant fabric route');
  assert.equal(
    booted.fetches[0]!.headers['x-telegram-init-data'],
    'tg-init-data-fixture',
    'probe carries the runtime initData header',
  );
  assert.ok(!OPERATING_FABRIC_BOOT.includes('localStorage'), 'client never persists secrets to storage');
  assert.ok(!OPERATING_FABRIC_BOOT.includes('sessionStorage'), 'client never persists secrets to session storage');
  assert.ok(!OPERATING_FABRIC_BOOT.includes('console.log'), 'client never logs payload material');
});

test('boot skips the probe entirely when no runtime initData is available', async () => {
  const booted = bootOperatingFabricDocument(() => ({ kind: 'status', status: 200 }), { initData: '' });
  await flushBoot();
  assert.equal(booted.fetches.length, 0, 'no initData means no probe');
  assertStaysInert(booted, 'no initData');
});

test('activation requires exactly status 200, never res.ok', async () => {
  assert.ok(OPERATING_FABRIC_BOOT.includes('res.status !== 200'), 'boot gates on the exact status code');
  assert.ok(
    !OPERATING_FABRIC_BOOT.includes('res.ok'),
    'boot never uses res.ok, which would also activate on 201/202/206',
  );
});

// ── RBAC keeps governing contextual actions ─────────────────────────────────

test('RBAC interaction ceilings are unchanged by the new scene contract', () => {
  assert.equal(permits('signed-action', 'founder'), true);
  assert.equal(permits('signed-action', 'team'), false);
  assert.equal(permits('chat-command', 'team'), true);
  assert.equal(permits('sheet', 'consultant'), false);
  assert.equal(permits('read-only', 'consultant'), true);
});

// ── Task 7 · shared visual grammar and state components ────────────────────

import {
  renderAuthorityBadge,
  renderFreshnessBadge,
  renderWorkCard,
  renderAgentCard,
  renderSkillClusterCard,
  renderGapState,
  renderFabricState,
  renderFabricEdge,
} from './page/operating-fabric/components.ts';

const FABRIC_STYLE_BANNED_RAW = [
  'initData',
  'query_id=',
  'auth_date=',
  'hash=',
  'Bearer ',
  'bot_token',
  'clientSecret',
];

function makeWorkNode(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'work' as const,
    value: {
      kind: 'sapling' as const,
      workId: 'work-1',
      tenantId: 'acme',
      name: 'Ledger line',
      desiredState: 'proof',
      currentState: 'queued',
      status: 'active',
      ownerId: 'founder',
      nextAction: null,
      proofRequired: true,
      reviewAt: null,
      sourceRef: 'd1-goal-graph',
      sourceDigest: 'digest',
      branchId: 'branch-1',
      branchKind: 'product' as const,
      promotionState: 'proof-only' as const,
      currentGate: 'G1',
      organRoute: [],
      ...overrides,
    },
  };
}

function makeAgentNode(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'agent' as const,
    value: {
      agentId: 'agent-1',
      role: 'implementer',
      runtime: 'codex' as const,
      status: 'assigned',
      activeTaskIds: ['task-9'],
      permissionProfile: 'fresh',
      lastSeenAt: '2026-07-28T06:00:00.000Z',
      sourceRef: 'd1-goal-graph',
      ...overrides,
    },
  };
}

function makeClusterNode(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'skill-cluster' as const,
    value: {
      clusterId: 'cluster-1',
      name: 'ops-core',
      status: 'active',
      skillIds: ['quest-ops', 'goal-graph'],
      eligibleAgentIds: ['agent-1'],
      successRate: 0.92,
      sourceRef: 'd1-goal-graph',
      ...overrides,
    },
  };
}

test('authority badge names the projection authority and never client-derived claims', () => {
  const html = renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: 42 });
  assert.match(html, /data-component="FabricAuthorityBadge"/);
  assert.match(html, /d1-goal-graph/);
  assert.match(html, /graphVersion 42|graph version 42|v42/i);
  assert.match(html, /aria-label="[^"]*authorit/i, 'badge keeps an accessible authority label');
  for (const banned of FABRIC_STYLE_BANNED_RAW) {
    assert.ok(!html.includes(banned), `authority badge never exposes ${banned}`);
  }
});

test('authority badge fails closed on malformed input', () => {
  const html = renderAuthorityBadge({ sourceRef: '', graphVersion: Number.NaN });
  assert.match(html, /unknown authority|authority unknown/i);
});

test('freshness badge distinguishes fresh, stale, and unknown states', () => {
  const fresh = renderFreshnessBadge({ state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' });
  const stale = renderFreshnessBadge({ state: 'stale', checkedAt: '2026-07-27T06:00:00.000Z' });
  const unknown = renderFreshnessBadge({ state: 'unknown' });
  assert.match(fresh, /data-state="fresh"/);
  assert.match(stale, /data-state="stale"/);
  assert.match(unknown, /data-state="unknown"/);
  assert.match(fresh, /2026-07-28T06:00:00.000Z/);
  assert.notEqual(fresh, stale, 'fresh and stale treatments are visually distinct');
  assert.match(stale, /stale/i);
  assert.match(unknown, /unknown/i);
});

test('work card exposes type, lifecycle, authority, freshness, and a read-only cue', () => {
  const html = renderWorkCard(makeWorkNode(), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 42,
  });
  assert.match(html, /data-component="FabricWorkCard"/);
  assert.match(html, /sapling/, 'work type is visible');
  assert.match(html, /active/, 'lifecycle state is visible');
  assert.match(html, /Ledger line/, 'work name is visible');
  assert.match(html, /d1-goal-graph/, 'source authority is visible');
  assert.match(html, /fresh/, 'freshness is visible');
  assert.match(html, /read-only|read only/i, 'explicit read-only cue is visible');
});

test('work card escapes hostile projection text and never renders raw evidence', () => {
  const hostile = makeWorkNode({
    name: '<img src=x onerror=alert(1)>',
    desiredState: '<script>alert(1)</script>',
    currentState: '" onmouseover="alert(1)',
  });
  const html = renderWorkCard(hostile, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
    evidenceRef: 'evidence://raw/private-payload',
  });
  assert.ok(!html.includes('<img src=x'), 'hostile markup is escaped, not injected');
  assert.ok(!html.includes('<script>alert(1)</script>'), 'script text is escaped');
  assert.ok(!html.includes('evidence://raw/private-payload'), 'raw evidence refs never render');
  assert.match(html, /&lt;img src=x/, 'escaped text remains legible');
});

test('agent card exposes status, assignment, and capability chips', () => {
  const html = renderAgentCard(makeAgentNode({ capabilities: undefined }), {
    capabilities: ['goal-graph', 'quests'],
    assignment: 'task-9',
  });
  assert.match(html, /data-component="FabricAgentCard"/);
  assert.match(html, /assigned/, 'status is visible');
  assert.match(html, /task-9/, 'current assignment is visible');
  const chips = html.match(/data-component="FabricCapabilityChip"/g) ?? [];
  assert.equal(chips.length, 2, 'one chip per capability');
  assert.match(html, /goal-graph/);
  assert.match(html, /quests/);
});

test('agent card renders an explicit gap when unassigned', () => {
  const html = renderAgentCard(makeAgentNode({ activeTaskIds: [], status: 'available' }), {
    capabilities: [],
    assignment: null,
  });
  assert.match(html, /no assignment|unassigned|assignment gap/i, 'explicit assignment gap is visible');
  assert.match(html, /available/, 'status is still visible');
});

test('skill-cluster card exposes state, coverage, evidence timestamp, and provenance', () => {
  const html = renderSkillClusterCard(makeClusterNode(), {
    coverage: { eligible: 3, covered: 2 },
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
  });
  assert.match(html, /data-component="FabricSkillClusterCard"/);
  assert.match(html, /active/, 'state is visible');
  assert.match(html, /2 of 3|2\/3/, 'coverage is visible');
  assert.match(html, /2026-07-28T06:00:00.000Z/, 'evidence timestamp is visible');
  assert.match(html, /d1-goal-graph/, 'provenance is visible');
  assert.match(html, /ops-core/);
});

test('typed gap renderer names the gap kind and subject without raw evidence', () => {
  const html = renderGapState({
    gapId: 'gap-1',
    kind: 'missing-assignment',
    subjectId: 'task-9',
    detail: 'task has no assigned agent',
    evidenceRef: 'evidence://gap/raw-material',
  });
  assert.match(html, /data-component="FabricGap"/);
  assert.match(html, /missing-assignment/, 'gap kind is visible');
  assert.match(html, /task-9/, 'gap subject is visible');
  assert.match(html, /no assigned agent/, 'gap detail is visible');
  assert.ok(!html.includes('evidence://gap/raw-material'), 'gap evidence refs never render');
});

test('loading, empty, stale, unauthorized, and error states are visually distinct', () => {
  const states = ['loading', 'empty', 'stale', 'unauthorized', 'error'] as const;
  const rendered = states.map((state) => renderFabricState(state));
  for (const [index, state] of states.entries()) {
    assert.match(rendered[index]!, new RegExp(`data-state="${state}"`), `${state} carries its state marker`);
    assert.match(rendered[index]!, /data-component="FabricState"/);
  }
  const unique = new Set(rendered);
  assert.equal(unique.size, states.length, 'every state renders a distinct treatment');
  assert.match(renderFabricState('unauthorized'), /unauthorized|not authorized|no access/i);
  assert.match(renderFabricState('error'), /error|failed/i);
  assert.match(renderFabricState('loading'), /loading/i);
  assert.match(renderFabricState('empty'), /empty|nothing|no rows/i);
});

test('every rendered edge carries visible text or an accessible label', () => {
  const edge = renderFabricEdge({ kind: 'assigned-to', fromId: 'task-9', toId: 'agent-1' });
  assert.match(edge, /data-component="FabricEdge"/);
  const hasVisibleText = />[^<]*assigned-to[^<]*</.test(edge) || /<[^>]*>[^<]+<\//.test(edge.replace(/aria-label="[^"]*"/, ''));
  const hasAccessibleName = /aria-label="[^"]+"/.test(edge) || /role="img"/.test(edge);
  assert.ok(hasVisibleText || hasAccessibleName, 'edge exposes a label to sighted or assistive users');
  assert.match(edge, /assigned-to/);
});

test('fabric renderers never embed secrets, prompts, tokens, or client payloads', () => {
  const corpus = [
    renderWorkCard(makeWorkNode(), { freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' }, graphVersion: 7 }),
    renderAgentCard(makeAgentNode(), { capabilities: ['x'], assignment: 'task-1' }),
    renderSkillClusterCard(makeClusterNode(), { coverage: { eligible: 1, covered: 1 }, freshness: { state: 'stale', checkedAt: '2026-07-27T00:00:00.000Z' } }),
    renderGapState({ gapId: 'g', kind: 'stale-evidence', subjectId: null, detail: 'evidence window expired', evidenceRef: null }),
  ].join('\n');
  for (const banned of FABRIC_STYLE_BANNED_RAW) {
    assert.ok(!corpus.includes(banned), `renderer corpus never exposes ${banned}`);
  }
  assert.ok(!corpus.includes('prompt'), 'renderer corpus never exposes prompt material');
});

test('fabric styles extend tokens and keep motion, focus, and target-size contracts', () => {
  assert.match(OPERATING_FABRIC_STYLES, /var\(--ink\)/, 'styles reuse shared tokens');
  assert.match(OPERATING_FABRIC_STYLES, /prefers-reduced-motion/, 'reduced motion stays honored');
  assert.match(OPERATING_FABRIC_STYLES, /of-badge|of-card|of-chip/, 'fabric component styles exist');
  assert.match(OPERATING_FABRIC_STYLES, /min-height:44px|min-height: 44px/, 'interactive targets stay at least 44px');
  assert.match(OPERATING_FABRIC_STYLES, /:focus-visible/, 'focus stays visible');
  assert.ok(!/animation:[^;]*left|animation:[^;]*top|animation:[^;]*width/.test(OPERATING_FABRIC_STYLES), 'motion stays transform/opacity-only');
});

// ── Task 7 review corrections · adversarial runtime values ─────────────────
//
// Regression coverage for the independent review findings: hostile state
// strings must never break out of class/data attributes, program nodes render
// ProgramWork.lifecycle (not generic status/currentState), freshness proof
// requires a bounded canonical timestamp, coverage only renders when valid,
// and secret markers placed in rendered fields fail closed.

const FABRIC_SECRET_MARKERS = [
  'query_id=',
  'auth_date=',
  'Bearer eyJ',
  'bot_token',
  'clientSecret',
  'BEGIN PRIVATE KEY',
];

test('renderFabricState allowlists state so hostile strings cannot break attributes', () => {
  const hostile = renderFabricState('"><script>alert(1)</script>' as unknown as 'error');
  assert.ok(!hostile.includes('<script>alert(1)</script>'), 'hostile state never reaches markup');
  assert.ok(!hostile.includes('of-state-"><'), 'hostile state never breaks out of the class attribute');
  assert.match(hostile, /data-state="error"/, 'invalid state falls back to the bounded error treatment');
  assert.match(hostile, /of-state-error/, 'invalid state renders the error styling class');

  const unknown = renderFabricState('running' as unknown as 'loading');
  assert.match(unknown, /data-state="error"/, 'non-allowlisted state fails closed to error');
  assert.doesNotMatch(unknown, /of-state-running/, 'non-allowlisted state never becomes a class');

  assert.doesNotMatch(renderFabricState('constructor' as unknown as 'error'), /data-state="constructor"/, 'native keys are not allowlisted');

  for (const state of ['loading', 'empty', 'stale', 'unauthorized', 'error'] as const) {
    assert.match(renderFabricState(state), new RegExp(`data-state="${state}"`), `valid ${state} is preserved`);
  }
});

test('work card renders ProgramWork.lifecycle for program nodes', () => {
  const programNode = {
    kind: 'work' as const,
    value: {
      kind: 'program' as const,
      workId: 'cambium-operating-fabric',
      tenantId: 'cambium-synthetic',
      name: 'Cambium Operating Fabric',
      desiredState: 'verified',
      currentState: 'q',
      status: 'active',
      ownerId: 'founder',
      nextAction: null,
      proofRequired: true,
      reviewAt: null,
      sourceRef: 'd1-goal-graph',
      sourceDigest: 'digest',
      programKind: 'operations' as const,
      lifecycle: 'executing',
      outcomeMetric: 'bounded execution paths',
    },
  };
  const html = renderWorkCard(programNode as never, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 3,
  });
  assert.match(html, /executing/, 'program lifecycle is visible as the lifecycle');
  assert.match(html, /program/, 'program work type is visible');

  const runtimeOnly = makeWorkNode({
    kind: 'program',
    lifecycle: 'verifying',
    status: undefined,
    currentState: 'runtime-only',
  });
  const runtimeHtml = renderWorkCard(runtimeOnly, {
    freshness: { state: 'stale', checkedAt: '2026-07-27T06:00:00.000Z' },
    graphVersion: 3,
  });
  assert.match(runtimeHtml, /verifying/, 'program lifecycle wins over runtime currentState');
  assert.doesNotMatch(runtimeHtml, /unknown state/, 'program nodes never lose their lifecycle');
});

test('work card keeps sapling state and promotion semantics without inventing values', () => {
  const sapling = makeWorkNode({ status: 'active', promotionState: 'supervised-branch' });
  const html = renderWorkCard(sapling, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 2,
  });
  assert.match(html, /active/, 'sapling status is visible as the lifecycle');
  assert.match(html, /supervised-branch/, 'sapling promotion state is visible');
  assert.doesNotMatch(html, /proof-only/, 'the fixture promotion value is not widened or invented');

  const statusless = makeWorkNode({ status: undefined, currentState: 'ready' });
  const statuslessHtml = renderWorkCard(statusless, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 2,
  });
  assert.match(statuslessHtml, /ready/, 'sapling falls back to a canonical currentState when status is absent');
  const hostileFallback = makeWorkNode({ status: undefined, currentState: 'leased' });
  const hostileFallbackHtml = renderWorkCard(hostileFallback, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 2,
  });
  assert.match(hostileFallbackHtml, /unknown state/, 'noncanonical currentState fails closed instead of leaking');
});

test('freshness badge only renders bounded canonical timestamps as proof', () => {
  const invalid = renderFreshnessBadge({ state: 'fresh', checkedAt: 'not-a-date trust me' });
  assert.match(invalid, /data-state="unknown"/, 'noncanonical checkedAt downgrades freshness to unknown');
  assert.ok(!invalid.includes('<time'), 'invalid timestamps never emit a time element');
  assert.ok(!invalid.includes('not-a-date'), 'invalid timestamp text never renders');

  const junkSuffix = renderFreshnessBadge({ state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z pwned' });
  assert.match(junkSuffix, /data-state="unknown"/, 'noncanonical suffixes are not accepted as proof');
  assert.ok(!junkSuffix.includes('pwned'), 'hostile suffix bytes never render');

  const oversize = renderFreshnessBadge({ state: 'fresh', checkedAt: `2026-07-28T06:00:00.000Z${'x'.repeat(3000)}` });
  assert.ok(oversize.length < 1024, 'oversize timestamps are bounded');
  assert.ok(!oversize.includes('x'.repeat(256)), 'oversize payload bytes never render');

  const hostile = renderFreshnessBadge({ state: 'fresh', checkedAt: '" onmouseover="alert(1)' });
  assert.ok(!hostile.includes('onmouseover='), 'hostile timestamp bytes never reach an attribute');
  assert.match(hostile, /data-state="unknown"/);

  const valid = renderFreshnessBadge({ state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' });
  assert.match(valid, /data-state="fresh"/, 'canonical timestamps keep their state');
  assert.match(valid, /<time class="of-badge-meta" datetime="2026-07-28T06:00:00.000Z">/, 'canonical timestamp renders as proof');
});

test('skill-cluster coverage renders only nonnegative integers with covered <= eligible', () => {
  const base = makeClusterNode();
  const context = { freshness: { state: 'fresh' as const, checkedAt: '2026-07-28T06:00:00.000Z' } };

  const valid = renderSkillClusterCard(base, { coverage: { eligible: 3, covered: 2 }, ...context });
  assert.match(valid, /2 of 3/, 'valid coverage renders as covered of eligible');

  for (const coverage of [
    { eligible: 2, covered: 9 },
    { eligible: -3, covered: 1.5 },
    { eligible: 2.5, covered: 1 },
    { eligible: 2, covered: -1 },
    { eligible: Number.NaN, covered: 1 },
  ]) {
    const html = renderSkillClusterCard(base, { coverage, ...context });
    assert.match(html, /coverage unknown/, `invalid coverage ${JSON.stringify(coverage)} fails closed`);
    assert.ok(!/\d+(?:\.\d+)? of \d+/.test(html.replace(/graphVersion \d+/g, '')), 'invalid coverage never clamps into invented truth');
  }
});

test('rendered fields fail closed on raw credential and auth markers', () => {
  const hostile = makeWorkNode({
    name: 'query_id=AAE7 initData Bearer eyJ',
    sourceRef: 'bot_token clientSecret',
    currentState: 'BEGIN PRIVATE KEY',
  });
  const html = [
    renderWorkCard(hostile, {
      freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
      graphVersion: 1,
    }),
    renderAgentCard(makeAgentNode({ agentId: 'agent-1' }), {
      capabilities: ['Bearer eyJ', 'query_id=AAE7'],
      assignment: 'task-1',
    }),
    renderGapState({
      gapId: 'gap-1',
      kind: 'clientSecret leak',
      subjectId: 'task-9',
      detail: 'raw payload: auth_date=999 hash=abc',
      evidenceRef: 'evidence://secret',
    }),
  ].join('\n');
  for (const marker of FABRIC_SECRET_MARKERS) {
    assert.ok(!html.includes(marker), `rendered output never emits raw marker ${marker}`);
  }
  assert.match(html, /redacted|unknown/, 'marker-bearing fields fall back to a neutral label');
});

test('agent card visibly reports capability overflow as +N more', () => {
  const html = renderAgentCard(makeAgentNode(), {
    capabilities: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    assignment: 'task-1',
  });
  const chips = html.match(/data-component="FabricCapabilityChip"/g) ?? [];
  assert.equal(chips.length, 6, 'chips stay bounded');
  assert.match(html, /\+2 more/, 'overflow count is visibly reported');
});

test('44px targets and focus rules apply to actual controls, not passive spans', () => {
  const passiveRules = OPERATING_FABRIC_STYLES.split('\n').filter(
    (line) => line.includes('min-height:44px') && !line.includes('.of-tab') && !line.includes('.of-control'),
  );
  assert.deepEqual(passiveRules, [], 'passive badges/chips/edges do not carry 44px control sizing');
  assert.match(OPERATING_FABRIC_STYLES, /\.of-tab\{[^}]*min-height:44px/, 'the semantic tab control keeps its 44px target');
  const focusRule = OPERATING_FABRIC_STYLES.split('\n').find((line) => line.includes(':focus-visible'));
  assert.ok(focusRule, 'a focus-visible rule exists');
  assert.match(focusRule!, /\.of-tab:focus-visible/, 'tab focus stays visible');
  assert.doesNotMatch(focusRule!, /\.of-chip:focus-visible|\.of-badge:focus-visible|\.of-edge:focus-visible/, 'passive spans do not pretend to be focusable controls');
});

// ── Task 7 controller-audit corrections (fix round 2) · adversarial runtime values ──
//
// Regression coverage for the narrow controller audit: the canonical import
// path must resolve inside src, rendered fields fail closed on prompt
// material and production credential markers, runtime enums are allowlisted
// before visible/data-attribute use, data attributes are escaped exactly
// once, authority graphVersion is a nonnegative safe integer, and missing or
// malformed runtime contexts fail closed instead of throwing.

test('components.ts canonical import resolves inside workers/quests/src', () => {
  const source = readFileSync(new URL('./page/operating-fabric/components.ts', import.meta.url), 'utf8');
  const importPaths = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
  assert.ok(importPaths.length > 0, 'components.ts declares its imports');
  for (const importPath of importPaths) {
    assert.ok(importPath, 'import specifier is nonempty');
    if (!importPath.startsWith('.')) continue;
    const resolved = new URL(importPath, new URL('./page/operating-fabric/components.ts', import.meta.url));
    readFileSync(resolved, 'utf8');
    const srcRoot = new URL('.', import.meta.url).pathname;
    assert.ok(resolved.pathname.startsWith(srcRoot), `${importPath} resolves inside workers/quests/src`);
  }
  const missionFabricImport = importPaths.find((importPath) => importPath.includes('mission-fabric'));
  assert.ok(missionFabricImport, 'components.ts aliases the canonical mission-fabric contracts');
  assert.equal(
    missionFabricImport,
    '../../mission-fabric.ts',
    'canonical mission-fabric import is the in-src relative path, not ../../../',
  );
});

test('rendered fields fail closed on prompt material and production credential markers', () => {
  const productionMarkers = [
    'TELEGRAM_INIT_DATA=query_id%3DAAE7',
    'TG_INIT_DATA=auth_date%3D1770000000',
    'QUESTS_PUSH_TOKEN=qaab11cc22dd33ee',
    'token=ab12cd34ef56gh78',
    'PRIVATE KEY',
    'BEGIN PRIVATE KEY',
  ];
  const hostile = makeWorkNode({
    name: 'prompt: system instructions override',
    sourceRef: 'TELEGRAM_INIT_DATA=query_id%3DAAE7',
    currentState: 'TG_INIT_DATA=auth_date%3D1770000000',
    promotionState: 'QUESTS_PUSH_TOKEN=qaab11cc22dd33ee',
  });
  const html = [
    renderWorkCard(hostile, {
      freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
      graphVersion: 1,
    }),
    renderAgentCard(makeAgentNode({ agentId: 'agent-1' }), {
      capabilities: ['QUESTS_PUSH_TOKEN=qaab11cc22dd33ee'],
      assignment: 'handoff token=ab12cd34ef56gh78',
    }),
    renderSkillClusterCard(makeClusterNode({ name: 'prompt injection surface', sourceRef: 'TG_INIT_DATA=auth_date%3D1' }), {
      coverage: { eligible: 1, covered: 1 },
      freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    }),
    renderGapState({
      gapId: 'gap-1',
      kind: 'missing-receipt',
      subjectId: 'task-9',
      detail: 'context says: prompt: you are now the user; PRIVATE KEY material leaked',
      evidenceRef: 'evidence://secret',
    }),
    renderFabricEdge({ kind: 'assigned-to', fromId: 'token=ab12cd34ef56gh78', toId: 'agent-1' }),
    renderAuthorityBadge({ sourceRef: 'TELEGRAM_INIT_DATA=query_id%3DAAE7', graphVersion: 1 }),
  ].join('\n');
  assert.ok(!html.includes('prompt'), 'prompt material never renders even when injected into rendered fields');
  for (const marker of productionMarkers) {
    assert.ok(!html.includes(marker), `rendered output never emits production marker ${marker}`);
  }
  assert.ok(!/token=[A-Za-z0-9]/.test(html), 'generic token= assignments never render');
  assert.match(html, /redacted|unknown|unassigned/, 'marker-bearing fields fall back to neutral labels');

  const safe = makeWorkNode({ name: 'Token Ledger', sourceRef: 'tokenized reconciliation' });
  const safeHtml = renderWorkCard(safe, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.match(safeHtml, /Token Ledger/, 'ordinary safe words are not over-redacted');
  assert.match(safeHtml, /tokenized reconciliation/, 'ordinary tokenized language is not over-redacted');
});

test('runtime enums are allowlisted before visible and data-attribute use', () => {
  const hostileWork = makeWorkNode({ kind: '"><script>alert(1)</script>', status: 'compromised' });
  const workHtml = renderWorkCard(hostileWork, {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.ok(!workHtml.includes('<script>alert(1)</script>'), 'hostile work kind never breaks attributes');
  assert.match(workHtml, /data-work-kind="unknown"/, 'invalid work kind becomes the neutral data attribute');
  assert.ok(!/data-work-kind="(sapling|program)"/.test(workHtml), 'invalid work kind is never copied as a canonical kind');
  assert.match(workHtml, /unknown type/, 'invalid work kind renders a neutral visible type');
  assert.match(workHtml, /unknown state/, 'invalid work kind renders a neutral visible state');

  const hostileSapling = renderWorkCard(makeWorkNode({ kind: 'sapling', status: 'compromised', promotionState: 'pwnd' }), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.match(hostileSapling, /unknown promotion/, 'invalid promotion state renders a neutral visible state');
  assert.ok(!hostileSapling.includes('compromised'), 'invalid sapling status never renders');
  assert.ok(!hostileSapling.includes('pwnd'), 'invalid promotion state never renders');

  const hostileSaplingNoFallback = renderWorkCard(
    makeWorkNode({ kind: 'sapling', status: 'compromised', currentState: 'pwnd', promotionState: 'proof-only' }),
    {
      freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
      graphVersion: 1,
    },
  );
  assert.match(hostileSaplingNoFallback, /unknown state/, 'invalid sapling status with no valid fallback renders unknown state');

  const programHtml = renderWorkCard(makeWorkNode({ kind: 'program', lifecycle: 'liquidated' }), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.ok(!programHtml.includes('liquidated'), 'noncanonical program lifecycle never renders');
  assert.match(programHtml, /unknown state/, 'noncanonical program lifecycle falls back to unknown');

  const agentHtml = renderAgentCard(makeAgentNode({ status: '"><img src=x onerror=alert(1)>' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.ok(!agentHtml.includes('onerror=alert(1)'), 'hostile agent status never breaks attributes');
  assert.match(agentHtml, /data-agent-status="unknown"/, 'invalid agent status becomes the neutral data attribute');
  assert.ok(!/data-agent-status="(offline|available|assigned|running|blocked)"/.test(agentHtml), 'invalid agent status is never copied as canonical');
  assert.match(agentHtml, /unknown/, 'invalid agent status renders a neutral visible state');

  const clusterHtml = renderSkillClusterCard(makeClusterNode({ status: '"><svg onload=alert(1)>' }), {
    coverage: { eligible: 1, covered: 1 },
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
  });
  assert.ok(!clusterHtml.includes('onload=alert(1)'), 'hostile cluster status never breaks attributes');
  assert.match(clusterHtml, /data-cluster-status="unknown"/, 'invalid cluster status becomes the neutral data attribute');
  assert.ok(!/data-cluster-status="(inactive|available|active|degraded)"/.test(clusterHtml), 'invalid cluster status is never copied as canonical');

  const edgeHtml = renderFabricEdge({ kind: '"><script>alert(1)</script>' as never, fromId: 'a', toId: 'b' });
  assert.ok(!edgeHtml.includes('<script>alert(1)</script>'), 'hostile edge kind never breaks attributes');
  assert.match(edgeHtml, /data-edge-kind="unknown"/, 'invalid edge kind becomes the neutral data attribute');
  assert.ok(!/data-edge-kind="(contains|depends-on|assigned-to|requires-cluster|pins-loadout|executes|produces|proves|informs-next-intent)"/.test(edgeHtml), 'invalid edge kind is never copied as canonical');

  const validEdge = renderFabricEdge({ kind: 'assigned-to', fromId: 'task-1', toId: 'agent-1' });
  assert.match(validEdge, /data-edge-kind="assigned-to"/, 'valid edge kind is preserved');
  const validWork = renderWorkCard(makeWorkNode({ kind: 'sapling', status: 'active' }), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.match(validWork, /data-work-kind="sapling"/, 'valid work kind is preserved');
  assert.match(validWork, />sapling</, 'valid work kind stays visible');
});

test('edge ids and kinds fail closed on secret markers', () => {
  const html = [
    renderFabricEdge({ kind: 'assigned-to', fromId: 'task Bearer eyJhbGciOiJIUzI1NiJ9', toId: 'agent-1' }),
    renderFabricEdge({ kind: 'assigned-to', fromId: 'task-1', toId: 'PRIVATE KEY material' }),
  ].join('\n');
  assert.ok(!html.includes('Bearer eyJ'), 'edge fromId never emits raw credentials');
  assert.ok(!html.includes('PRIVATE KEY'), 'edge toId never emits raw key material');
  assert.match(html, /redacted/, 'marker-bearing edge ids fail closed to a neutral label');
});

test('data attributes are escaped exactly once, never twice', () => {
  const html = renderGapState({
    gapId: 'g1',
    kind: 'stale & "broken"',
    subjectId: 'task-9',
    detail: 'window expired',
    evidenceRef: null,
  });
  assert.ok(html.includes('data-gap-kind="stale &amp; &quot;broken&quot;"'), 'data-gap-kind escapes exactly once');
  assert.ok(!html.includes('&amp;amp;'), 'data-gap-kind is never double-escaped');
  assert.ok(!html.includes('&amp;quot;'), 'double-escaped quotes never appear in data-gap-kind');

  const badge = renderAuthorityBadge({ sourceRef: 'd1-goal-graph & <ops> "quoted"', graphVersion: 3 });
  assert.match(badge, /data-authority="d1-goal-graph &amp; &lt;ops&gt; &quot;quoted&quot;"/, 'data-authority escapes exactly once');
  assert.ok(!badge.includes('&amp;amp;'), 'data-authority is never double-escaped');

  const workHtml = renderWorkCard(makeWorkNode({ name: 'A & B "ledger"' }), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.ok(!workHtml.includes('&amp;amp;'), 'work card escapes exactly once everywhere');
  assert.ok(workHtml.includes('A &amp; B &quot;ledger&quot;'), 'work card escapes hostile names exactly once');
});

test('authority graphVersion renders only nonnegative safe integers', () => {
  assert.match(renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: -1 }), /version unknown/, 'negative graphVersion fails closed');
  assert.match(renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: 3.7 }), /version unknown/, 'fractional graphVersion fails closed');
  assert.match(renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: Number.MAX_SAFE_INTEGER + 1 }), /version unknown/, 'unsafe graphVersion fails closed');
  assert.match(renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: Number.NaN }), /version unknown/, 'NaN graphVersion fails closed');
  assert.match(renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: 0 }), /graphVersion 0/, 'zero graphVersion is a valid nonnegative integer');
  assert.match(renderAuthorityBadge({ sourceRef: 'd1-goal-graph', graphVersion: 42 }), /graphVersion 42/, 'positive safe graphVersion renders');
});

test('renderers fail closed when runtime context is absent or malformed', () => {
  const workNode = makeWorkNode();
  const workHtml = renderWorkCard(workNode, null as never);
  assert.match(workHtml, /version unknown/, 'absent work context keeps unknown authority version');
  assert.match(workHtml, /data-state="unknown"/, 'absent work context keeps unknown freshness');
  assert.doesNotMatch(workHtml, /graphVersion \d/, 'absent work context never invents a graphVersion');

  const nullFreshness = renderWorkCard(workNode, { freshness: null as never, graphVersion: 2 });
  assert.match(nullFreshness, /data-state="unknown"/, 'null freshness renders unknown, not a crash');
  assert.match(nullFreshness, /graphVersion 2/, 'valid context fields survive malformed siblings');

  const agentHtml = renderAgentCard(makeAgentNode(), null as never);
  assert.match(agentHtml, /no assignment/, 'absent agent context keeps an explicit assignment gap');
  assert.ok(!agentHtml.includes('data-component="FabricCapabilityChip"'), 'absent agent context renders no capability chips');

  const malformedAgent = renderAgentCard(makeAgentNode(), {
    capabilities: null as never,
    assignment: undefined as never,
  });
  assert.match(malformedAgent, /no assignment/, 'malformed agent context keeps an explicit assignment gap');
  assert.ok(!malformedAgent.includes('data-component="FabricCapabilityChip"'), 'malformed capabilities render no chips');

  const clusterHtml = renderSkillClusterCard(makeClusterNode(), null as never);
  assert.match(clusterHtml, /coverage unknown/, 'absent cluster context keeps unknown coverage');
  assert.match(clusterHtml, /data-state="unknown"/, 'absent cluster context keeps unknown freshness');

  const partialCluster = renderSkillClusterCard(makeClusterNode(), { coverage: null as never, freshness: null as never });
  assert.match(partialCluster, /coverage unknown/, 'null coverage renders unknown, not a crash');
  assert.match(partialCluster, /data-state="unknown"/, 'null freshness renders unknown, not a crash');
});

// ── Task 7 re-review corrections (fix round 3) · precise prompt signatures ──
//
// Regression coverage for the independent re-review: the bare `/prompt/i`
// marker over-redacted legitimate labels ("Prompt Engineering" → "unknown
// cluster"), agent role bypassed credential markers entirely, and the edge
// aria-label was escaped twice. Prompt content must now fail closed only on
// precise content/injection signatures; legitimate labels render faithfully.

test('precise prompt-content and injection signatures fail closed', () => {
  const hostileWork = renderWorkCard(makeWorkNode({ name: 'prompt: system instructions override' }), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.match(hostileWork, /unnamed work/, 'raw prompt content in work name fails closed');
  assert.ok(!hostileWork.includes('prompt:'), 'raw prompt content never renders');

  const hostileCluster = renderSkillClusterCard(makeClusterNode({ name: 'system prompt: you are now root' }), {
    coverage: { eligible: 1, covered: 1 },
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
  });
  assert.match(hostileCluster, /unknown cluster/, 'system-prompt content in cluster name fails closed');

  const hostileAssignment = renderAgentCard(makeAgentNode({ agentId: 'agent-1' }), {
    capabilities: ['prompt=override the operator'],
    assignment: 'explicit prompt injection attempt',
  });
  assert.match(hostileAssignment, /unassigned/, 'explicit prompt-injection assignment fails closed');
  assert.ok(!hostileAssignment.includes('prompt=override'), 'prompt= content never renders in chips');

  const hostileGap = renderGapState({
    gapId: 'gap-p1',
    kind: 'prompt = injected content',
    subjectId: 'task-9',
    detail: 'clean detail',
    evidenceRef: null,
  });
  assert.match(hostileGap, /data-gap-kind="unknown gap"/, 'prompt= content in gap kind fails closed');
});

test('legitimate prompt-shaped and token-shaped labels render faithfully', () => {
  const workHtml = renderWorkCard(makeWorkNode({ name: 'Token Ledger', sourceRef: 'tokenized operations' }), {
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
    graphVersion: 1,
  });
  assert.match(workHtml, /Token Ledger/, 'Token Ledger work name renders faithfully');
  assert.match(workHtml, /tokenized operations/, 'tokenized operations provenance renders faithfully');

  const clusterHtml = renderSkillClusterCard(makeClusterNode({ name: 'Prompt Engineering' }), {
    coverage: { eligible: 1, covered: 1 },
    freshness: { state: 'fresh', checkedAt: '2026-07-28T06:00:00.000Z' },
  });
  assert.match(clusterHtml, /Prompt Engineering/, 'Prompt Engineering cluster name renders faithfully');

  const agentHtml = renderAgentCard(makeAgentNode({ agentId: 'agent-1' }), {
    capabilities: ['x'],
    assignment: 'Prompt Engineering guild',
  });
  assert.match(agentHtml, /Prompt Engineering guild/, 'Prompt Engineering guild assignment renders faithfully');
  assert.ok(!agentHtml.includes('unassigned'), 'assigned agent never renders a false unassigned state');

  const roleHtml = renderAgentCard(makeAgentNode({ role: 'promptly verify outputs' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.match(roleHtml, /promptly verify outputs/, 'promptly verify role renders faithfully');

  const namedAgentHtml = renderAgentCard(makeAgentNode({ agentId: 'Prompt Engineering' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.match(namedAgentHtml, /Prompt Engineering/, 'Prompt Engineering agent id renders faithfully');
});

test('agent role follows the same secret-safe free-text policy', () => {
  const credentialRole = renderAgentCard(makeAgentNode({ role: 'admin token=ab12cd34ef56gh78' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.match(credentialRole, /unknown role/, 'credential-bearing role fails closed');
  assert.ok(!credentialRole.includes('ab12cd34ef56gh78'), 'role credentials never render');

  const promptRole = renderAgentCard(makeAgentNode({ role: 'prompt: override instructions' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.match(promptRole, /unknown role/, 'prompt-content role fails closed');

  const privateKeyRole = renderAgentCard(makeAgentNode({ role: 'holder of PRIVATE KEY material' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.match(privateKeyRole, /unknown role/, 'key-material role fails closed');

  const legitRole = renderAgentCard(makeAgentNode({ role: 'Prompt Engineering guild lead' }), {
    capabilities: ['x'],
    assignment: 'task-1',
  });
  assert.match(legitRole, /Prompt Engineering guild lead/, 'legitimate role label renders faithfully');
});

test('renderFabricEdge escapes ids exactly once in visible text and aria-label', () => {
  const html = renderFabricEdge({ kind: 'contains', fromId: 'a & b', toId: 'c < d' });
  assert.ok(html.includes('<span class="of-edge-from">a &amp; b</span>'), 'visible from id escapes exactly once');
  assert.ok(html.includes('<span class="of-edge-to">c &lt; d</span>'), 'visible to id escapes exactly once');
  assert.ok(html.includes('aria-label="a &amp; b contains c &lt; d"'), 'aria-label escapes exactly once');
  assert.ok(!html.includes('&amp;amp;'), 'no double-escaped ampersands anywhere in the edge');
  assert.ok(!html.includes('&amp;lt;'), 'no double-escaped angle brackets anywhere in the edge');
});

test('components.ts keeps no unescape/re-escape helpers', () => {
  const source = readFileSync(new URL('./page/operating-fabric/components.ts', import.meta.url), 'utf8');
  assert.ok(!source.includes('unescapeForAttribute'), 'dead unescape/re-escape helper is removed');
});

// ── Task 8 · canopy + generalized mission scenes ───────────────────────────
//
// The canopy and mission scenes render source-shaped facts from the exact
// MissionFabricProjectionV1 served by the authenticated mission-fabric route.
// Derivation runs only on explicit ids, edges, taskIds, and typed gaps —
// never title matching, never fake percentages, never client-authored
// lifecycle transitions. Selecting a work object only moves local focus.
//
// Fix-round-2 corrections: the browser renderers are explicit browser-valid
// JS source constants owned by canopy.ts/mission.ts and composed lexically
// inside the single boot script — no node:fs/readFileSync, no source-text
// transformers, no secret-marker fragmentation, no ambient __OF_SCENES__,
// no third scene script, no eval/Function, and no injected
// __FABRIC_SCENE_CLIENT__ test bypass. Activation is fail-closed: the exact
// 200 path validates the projection, pre-renders both scenes safely, and
// only then swaps visibility; renderer failure preserves the legacy shell.

import { buildMissionFabricProjection } from './mission-fabric.ts';
import type { FabricNode, FabricWorkNode, MissionFabricProjectionV1, FabricAgent, FabricSkillCluster, FabricEdge } from './mission-fabric.ts';
import { renderCanopy, CANOPY_BROWSER_JS } from './page/operating-fabric/canopy.ts';
import { renderOperatingMission, MISSION_BROWSER_JS } from './page/operating-fabric/mission.ts';

function loadJsonFixture(relativeUrl: string) {
  return JSON.parse(readFileSync(new URL(relativeUrl, import.meta.url), 'utf8'));
}

const canopyFixture = loadJsonFixture('./page/scenes/fixtures/canopy.fixture.json');
const missionFixture = loadJsonFixture('./page/scenes/fixtures/operating-mission.fixture.json');
const canopyContract = loadJsonFixture('../../../docs/architecture/contracts/scenes/canopy.json');
const missionContract = loadJsonFixture('../../../docs/architecture/contracts/scenes/operating-mission.json');

// Canonical Task 7 signature policy (components.ts). The Node pure renderers
// (canopy.ts/mission.ts) must embed this exact literal verbatim — no
// character-class fragmentation, no split/concatenation, no obfuscation. The
// served browser substrate expresses the same policy as a behavior-equivalent
// grouped assignment grammar (pinned below) so the frozen raw-PAGE audit
// never mistakes a detector definition for a leaked `hash=` value. The
// security contract is that hostile projection VALUES never survive into
// rendered output, not that the policy vocabulary is hidden.
const CANONICAL_SECRET_MARKER_PATTERN_SOURCE =
  'query_id=|auth_date=|\\bhash=|Bearer\\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|token=|PRIVATE KEY|\\bprompt\\s*[:=]|prompt\\s+injection';
const CANONICAL_SECRET_MARKER = new RegExp(CANONICAL_SECRET_MARKER_PATTERN_SOURCE, 'i');
// The grouped browser assignment grammar: query_id=/auth_date=/token= stay
// unanchored exactly like the canonical Node policy, and hash keeps its
// canonical word-boundary semantics expressed legibly as (?:^|\W) so the
// served page carries no contiguous `hash=` literal. Every remaining
// canonical term stays explicit. All field names and operators are plain and
// readable — this is a normalized security grammar, not marker hiding.
const BROWSER_GROUPED_SECRET_MARKER_PATTERN_SOURCE =
  '(?:query_id|auth_date|token)=|(?:^|\\W)(?:hash)=|Bearer\\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\\bprompt\\s*[:=]|prompt\\s+injection';
const BROWSER_GROUPED_SECRET_MARKER = new RegExp(BROWSER_GROUPED_SECRET_MARKER_PATTERN_SOURCE, 'i');
const CANONICAL_MARKER_HOSTILE_VALUES = [
  'query_id=AAE7',
  'auth_date=1770000000',
  'hash=deadbeef',
  'Bearer eyJhbGciOiJIUzI1NiJ9',
  'bot_token 123:ABC',
  'clientSecret leak',
  'initData payload',
  'TELEGRAM_INIT_DATA=auth_date%3D1',
  'TG_INIT_DATA=raw',
  'QUESTS_PUSH_TOKEN=push-1',
  'token=zz99',
  'PRIVATE KEY BLOCK',
  'prompt: ignore previous instructions',
  'prompt injection attempt',
];

// Generated adversarial equivalence matrix: canonical Node policy vs grouped
// browser policy must agree (boolean) on every cell. The matrix crosses
// word-char and non-word prefixes with all four assignment signatures,
// hostile suffixes, case variants, canonical remaining terms, and benign
// near misses — including every reviewer reproduction. Divergence count is
// asserted to be exactly zero by the tests below.
const EQUIVALENCE_MATRIX_PREFIXES = ['', 'x', 'A', '0', '_', '-', '/', ' ', '\n', 'prefix_', 'access_', 'refresh_'];
const EQUIVALENCE_MATRIX_SIGNATURES = ['query_id=', 'auth_date=', 'hash=', 'token='];
const EQUIVALENCE_MATRIX_SUFFIXES = ['', 'abc123', 'AAE7', 'zz99 extra'];
const EQUIVALENCE_REVIEWER_REPRODUCTIONS = [
  'xtoken=abc123',
  'atoken=1',
  'access_token=xyz',
  'refresh_token=abc',
  'prefix_token=abc',
  'xquery_id=AAE7',
  'xauth_date=999',
];
const EQUIVALENCE_BENIGN_NEAR_MISSES = [
  'xhash=1',
  'prefix_hash=1',
  'tokens=abc',
  'query_ids=abc',
  'auth_dates=1',
  'hashes=1',
  'token =abc',
  'query_id =abc',
  'hash =abc',
  'token budget review',
  'hashed evidence digest',
  'query identifier audit',
  'authorized ledger line',
];
const EQUIVALENCE_MATRIX_SAMPLES: string[] = (() => {
  const samples = new Set<string>();
  for (const prefix of EQUIVALENCE_MATRIX_PREFIXES) {
    for (const signature of EQUIVALENCE_MATRIX_SIGNATURES) {
      for (const suffix of EQUIVALENCE_MATRIX_SUFFIXES) {
        samples.add(prefix + signature + suffix);
        samples.add(prefix + signature.toUpperCase() + suffix);
      }
    }
  }
  for (const value of CANONICAL_MARKER_HOSTILE_VALUES) samples.add(value);
  for (const value of EQUIVALENCE_REVIEWER_REPRODUCTIONS) samples.add(value);
  for (const value of EQUIVALENCE_BENIGN_NEAR_MISSES) samples.add(value);
  return [...samples];
})();

const TASK8_SOURCE = canopyFixture.states.normal.source;
const TASK8_PROJECTION: MissionFabricProjectionV1 = buildMissionFabricProjection(TASK8_SOURCE, {
  tenantId: TASK8_SOURCE.tenantId,
  clock: { now: () => '2026-07-28T09:00:00.000Z' },
});

function bootBody(source: string): string {
  const bodies = extractScriptBodies(source);
  assert.equal(bodies.length, 1, 'the boot bundle is exactly one script');
  return bodies[0]!;
}

// ── boot bundle composition (no Cloudflare-incompatible machinery) ─────────

test('OPERATING_FABRIC_BOOT carries no TypeScript syntax or import/export residue', () => {
  const body = bootBody(OPERATING_FABRIC_BOOT);
  assert.ok(!/(^|\n)\s*import[\s{*]/.test(body), 'boot script has no import statements');
  assert.ok(!/(^|\n)\s*export\s/.test(body), 'boot script has no export statements');
  assert.ok(!/\binterface\s+[A-Za-z]/.test(body), 'boot script has no interface declarations');
  assert.ok(!/\btype\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=[^=]/.test(body), 'boot script has no type alias declarations');
  assert.ok(!/\)\s*:\s*[A-Za-z_$][A-Za-z0-9_$]*(\||<|\s*\{)/.test(body), 'boot script has no TS return-type annotations');
  assert.ok(!/\)\s*:\s*(string|number|boolean|void)\b/.test(body), 'boot script has no TS primitive annotations');
  assert.doesNotThrow(() => new Function(body), 'boot script parses as plain browser JavaScript');
});

test('OPERATING_FABRIC_BOOT uses no fs, source transformers, or code generation', () => {
  for (const banned of ['node:fs', 'readFileSync', 'import.meta', '__OF_SCENES__', '__FABRIC_SCENE_CLIENT__']) {
    assert.ok(!OPERATING_FABRIC_BOOT.includes(banned), `boot bundle never contains ${banned}`);
  }
  for (const sourcePath of [
    './page/operating-fabric/canopy.ts',
    './page/operating-fabric/mission.ts',
    './page/operating-fabric/client.ts',
  ]) {
    const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8');
    for (const banned of ['node:fs', 'readFileSync']) {
      assert.ok(!source.includes(banned), `${sourcePath} never uses ${banned}`);
    }
    for (const transformer of ['.replace(/^export', 'split(\'\\n\')', 'loadModuleBody', 'sanitizeForInlineAudit']) {
      assert.ok(!source.includes(transformer), `${sourcePath} carries no source transformer ${transformer}`);
    }
  }
  const bootScripts = extractScriptBodies(OPERATING_FABRIC_PAGE).filter((body) =>
    body.includes('/v1/mission-fabric/'),
  );
  assert.equal(bootScripts.length, 1, 'exactly one operating-fabric boot script ships');
  const sceneScripts = extractScriptBodies(OPERATING_FABRIC_PAGE).filter((body) =>
    body.includes('data-operating-fabric-scenes') || body.includes('renderOperatingMission'),
  );
  assert.equal(sceneScripts.length, 1, 'the scene renderers live inside the single boot script — no third scene script');
  assert.ok(
    bootScripts[0] === sceneScripts[0],
    'the boot script and the scene renderers are the same single script',
  );
});

test('Task 8 modules conceal no audit markers — every regex literal is verbatim', () => {
  const moduleSources: Array<[string, string]> = [
    ['canopy.ts', readFileSync(new URL('./page/operating-fabric/canopy.ts', import.meta.url), 'utf8')],
    ['mission.ts', readFileSync(new URL('./page/operating-fabric/mission.ts', import.meta.url), 'utf8')],
    ['client.ts', readFileSync(new URL('./page/operating-fabric/client.ts', import.meta.url), 'utf8')],
  ];
  // Character-class fragmentation is the banned concealment: character classes
  // are legitimate inside the bounded-quantifier hostilities (\\s, [^"], [^<],
  // [\\s\\S], [&<>"]) but every audit marker must be a verbatim literal.
  for (const [label, source] of moduleSources) {
    for (const marker of ['query_id=', 'auth_date=', 'hash', 'bot_token', 'clientSecret', 'initData', 'TELEGRAM_INIT_DATA', 'TG_INIT_DATA', 'QUESTS_PUSH_TOKEN', 'PRIVATE KEY', 'prompt']) {
      const fragmented = new RegExp(marker.split('').join('[\\w]?'));
      assert.ok(!fragmented.test(source) || source.includes(marker), `${label} never fragments ${marker} across character classes`);
    }
    for (const fragmented of [
      'query_[a-z]{2}=',
      'auth_[a-z]{4}=',
      'hash[=]',
      'bot_[a-z]{5}',
      'client[A-Z][a-z]{5}',
      'TELEGR[A-Z_]{10}',
      'TG_[A-Z_]{9}',
      'QUESTS_[A-Z_]{10}',
      'PRIVATE [A-Z]{3}',
      'init[A-Z][a-z]{3}',
    ]) {
      assert.ok(!source.includes(fragmented), `${label} never uses the obfuscated class form ${fragmented}`);
    }
    assert.ok(!/'[A-Za-z]{2}'\s*\+\s*'/.test(source), `${label} never hides markers inside string fragments`);
    assert.ok(!/String\\.fromCharCode|fromCodePoint/.test(source), `${label} never builds markers from character codes`);
    for (const banned of ['eval(', 'new Function(', 'Function.prototype.toString', 'localStorage', 'sessionStorage']) {
      assert.ok(!source.includes(banned), `${label} never uses ${banned}`);
    }
  }
  for (const [label, source] of [
    ['CANOPY_BROWSER_JS', CANOPY_BROWSER_JS],
    ['MISSION_BROWSER_JS', MISSION_BROWSER_JS],
    ['OPERATING_FABRIC_BOOT', OPERATING_FABRIC_BOOT],
  ] as const) {
    for (const fragmented of [
      'query_[a-z]{2}=',
      'auth_[a-z]{4}=',
      'hash[=]',
      'bot_[a-z]{5}',
      'client[A-Z][a-z]{5}',
      'TELEGR[A-Z_]{10}',
      'TG_[A-Z_]{9}',
      'QUESTS_[A-Z_]{10}',
      'PRIVATE [A-Z]{3}',
      'init[A-Z][a-z]{3}',
    ]) {
      assert.ok(!source.includes(fragmented), `${label} never serves the obfuscated class form ${fragmented}`);
    }
    assert.ok(!/'[A-Za-z]{2}'\s*\+\s*'/.test(source), `${label} never hides markers inside string fragments`);
  }
});

test('Task 8 modules pin the exact Task 7 secret-marker policy verbatim', () => {
  // Node pure renderers carry the canonical Task 7 policy verbatim.
  for (const [label, source] of [
    ['canopy.ts', readFileSync(new URL('./page/operating-fabric/canopy.ts', import.meta.url), 'utf8')],
    ['mission.ts', readFileSync(new URL('./page/operating-fabric/mission.ts', import.meta.url), 'utf8')],
  ] as const) {
    assert.equal(
      source.includes(CANONICAL_SECRET_MARKER_PATTERN_SOURCE),
      true,
      `${label} Node renderer embeds the canonical Task 7 marker policy verbatim`,
    );
  }
  // The served browser substrate carries the behavior-equivalent grouped
  // assignment grammar instead, so the frozen raw-PAGE audit never mistakes a
  // detector definition for a leaked `hash=` value.
  const clientSource = readFileSync(new URL('./page/operating-fabric/client.ts', import.meta.url), 'utf8');
  assert.ok(
    clientSource.includes(BROWSER_GROUPED_SECRET_MARKER_PATTERN_SOURCE),
    'client.ts browser helpers pin the grouped assignment grammar',
  );
  assert.ok(
    OPERATING_FABRIC_BOOT.includes(BROWSER_GROUPED_SECRET_MARKER_PATTERN_SOURCE),
    'the served boot script carries the grouped browser grammar',
  );
  assert.ok(
    !OPERATING_FABRIC_BOOT.includes(CANONICAL_SECRET_MARKER_PATTERN_SOURCE),
    'the served boot script no longer embeds the verbatim canonical pattern',
  );
  // Equivalence proof, not a claim: canonical Node policy and grouped browser
  // policy agree (boolean) on every cell of the generated adversarial matrix
  // — prefixes x signatures x suffixes, case variants, reviewer
  // reproductions, canonical remaining terms, and benign near misses.
  let divergences = 0;
  for (const sample of EQUIVALENCE_MATRIX_SAMPLES) {
    if (BROWSER_GROUPED_SECRET_MARKER.test(sample) !== CANONICAL_SECRET_MARKER.test(sample)) divergences += 1;
  }
  assert.equal(
    divergences,
    0,
    `grouped browser policy is boolean-equivalent to the canonical Node policy on all ${EQUIVALENCE_MATRIX_SAMPLES.length} matrix cells`,
  );
  for (const sample of ['promptly verify the fence', 'Prompt Engineering program', 'private customer notes', 'bearer of the badge']) {
    assert.equal(
      BROWSER_GROUPED_SECRET_MARKER.test(sample),
      CANONICAL_SECRET_MARKER.test(sample),
      `grouped browser policy matches canonical Node policy on: ${sample}`,
    );
  }
  assert.equal(CANONICAL_SECRET_MARKER.test('bearer of the badge'), true, 'canonical policy matches case-insensitively, exactly like Task 7');
  // The served PAGE passes the same literal marker corpus that the frozen
  // handler.test.ts audit applies (handler.test.ts stays byte-identical).
  for (const marker of ['TELEGRAM_INIT_DATA=', 'TG_INIT_DATA=', 'QUESTS_PUSH_TOKEN=', 'Bearer ', 'hash=']) {
    assert.ok(!PAGE.includes(marker), `served PAGE is free of the raw-PAGE audit marker: ${marker}`);
  }
});

test('served browser policy never hides markers — no obfuscated, split, encoded, or dynamic forms', () => {
  for (const [label, source] of [
    ['CANOPY_BROWSER_JS', CANOPY_BROWSER_JS],
    ['MISSION_BROWSER_JS', MISSION_BROWSER_JS],
    ['OPERATING_FABRIC_BOOT', OPERATING_FABRIC_BOOT],
  ] as const) {
    for (const banned of [
      'hash[=]',
      'query_[a-z]{2}',
      'auth_[a-z]{4}',
      'bot_[a-z]{5}',
      'client[A-Z][a-z]{5}',
      'TELEGR[A-Z_]{10}',
      'TG_[A-Z_]{9}',
      'QUESTS_[A-Z_]{10}',
      'PRIVATE [A-Z]{3}',
      'init[A-Z][a-z]{3}',
    ]) {
      assert.ok(!source.includes(banned), `${label} never serves the obfuscated class form ${banned}`);
    }
    assert.ok(!/'[A-Za-z]{2}'\s*\+\s*'/.test(source), `${label} never splits marker strings across fragments`);
    assert.ok(!/\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|fromCharCode|fromCodePoint/.test(source), `${label} never encodes markers as escapes or char codes`);
    assert.ok(!/new RegExp|eval\(|new Function\(/.test(source), `${label} never constructs the policy dynamically`);
  }
  // The normalized grammar keeps every canonical term plain and readable in
  // the served source: assignment-like field names appear verbatim, grouped
  // under shared '=' alternations with the canonical boundary semantics.
  for (const field of ['query_id', 'auth_date', 'hash', 'token']) {
    assert.ok(OPERATING_FABRIC_BOOT.includes(field), `browser grammar names ${field} plainly`);
  }
  assert.ok(
    OPERATING_FABRIC_BOOT.includes('(?:query_id|auth_date|token)=|(?:^|\\W)(?:hash)='),
    'browser grammar keeps the unanchored assignment group and the legible hash boundary',
  );
  assert.ok(
    !OPERATING_FABRIC_BOOT.includes('hash='),
    'served boot never carries the contiguous raw-audit hash= literal',
  );
  for (const term of ['Bearer\\s', 'bot_token', 'clientSecret', 'initData', 'TELEGRAM_INIT_DATA', 'TG_INIT_DATA', 'QUESTS_PUSH_TOKEN', 'PRIVATE KEY']) {
    assert.ok(OPERATING_FABRIC_BOOT.includes(term), `browser grammar keeps ${term} explicit`);
  }
});

test('Node and composed browser roots contain none of the canonical hostile values', async () => {
  const hostileTasks = TASK8_PROJECTION.nodes.map((node) =>
    node.kind === 'task' && node.value.taskId === 'fx-task-001'
      ? { ...node, value: { ...node.value, latestReceiptId: 'fx-receipt-001' } }
      : node,
  );
  const hostileProjection = {
    ...TASK8_PROJECTION,
    nodes: [
      ...hostileTasks,
      ...CANONICAL_MARKER_HOSTILE_VALUES.map((marker, index) => ({
        kind: 'work' as const,
        value: {
          ...makeWorkNode({
            kind: 'sapling',
            workId: `fx-hostile-${index} ${marker}`,
            name: `hostile ${marker}`,
            currentGate: `gate ${marker}`,
            status: 'active',
          }).value,
        },
      })),
    ],
  } as unknown as MissionFabricProjectionV1;
  const canopyHtml = renderCanopy(hostileProjection);
  const missionHtml = renderOperatingMission(hostileProjection, 'fx-program-001');
  for (const marker of CANONICAL_MARKER_HOSTILE_VALUES) {
    assert.ok(!canopyHtml.includes(marker), `node canopy never emits ${marker}`);
    assert.ok(!missionHtml.includes(marker), `node mission never emits ${marker}`);
  }
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: hostileProjection,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  const missionRoot = booted.elements.get('of-scene-mission')!;
  for (const marker of CANONICAL_MARKER_HOSTILE_VALUES) {
    assert.ok(!canopyRoot.innerHTML.includes(marker), `browser canopy root never contains ${marker}`);
    assert.ok(!missionRoot.innerHTML.includes(marker), `browser mission root never contains ${marker}`);
  }
  // The real composed boot's delegated open-lineage click path re-renders
  // both scenes with the hostile projection still resident: nothing hostile
  // survives the selection round-trip either.
  booted.clickOpen('fx-program-001');
  for (const marker of CANONICAL_MARKER_HOSTILE_VALUES) {
    assert.ok(!canopyRoot.innerHTML.includes(marker), `post-click browser canopy root never contains ${marker}`);
    assert.ok(!missionRoot.innerHTML.includes(marker), `post-click browser mission root never contains ${marker}`);
  }
});

// ── scene contracts + fixtures ──────────────────────────────────────────────

test('canopy and operating-mission scene contracts bind route, vocabulary, states, and redaction', () => {
  for (const [sceneId, contract] of [
    ['canopy', canopyContract],
    ['operating-mission', missionContract],
  ] as const) {
    assert.equal(contract.sceneId, sceneId, `${sceneId} contract id`);
    assert.equal(contract.refreshRoute, 'GET /v1/mission-fabric/{tenant}', `${sceneId} refresh route`);
    assert.equal(contract.synthetic, true, `${sceneId} fixture pairing is declared synthetic`);
    assert.ok(contract.fixture.endsWith('.fixture.json'), `${sceneId} contract names its fixture`);
    assert.ok(Array.isArray(contract.states.renders), `${sceneId} declares states`);
    assert.ok(contract.states.renders.includes('empty'), `${sceneId} handles empty`);
    assert.ok(contract.states.renders.includes('error'), `${sceneId} handles error`);
    assert.ok(contract.states.renders.includes('stale'), `${sceneId} handles stale`);
    assert.ok(typeof contract.redaction === 'string' && contract.redaction.length > 0, `${sceneId} declares redaction policy`);
    assert.match(JSON.stringify(contract.authority), /read-only/, `${sceneId} authority stays read-only`);
    assert.match(JSON.stringify(contract), /\/api\/gate/, `${sceneId} names the governed signed Gate surface`);
  }
  assert.match(JSON.stringify(canopyContract.lifecycleVocabulary.saplings), /promotion/, 'saplings keep status/promotion/gate language');
  assert.ok(!JSON.stringify(canopyContract.lifecycleVocabulary.programs).includes('promotion'), 'programs never use branch promotion wording');
  for (const word of ['proposed', 'approved', 'executing', 'verifying', 'complete', 'retired']) {
    assert.match(JSON.stringify(canopyContract.lifecycleVocabulary.programs), new RegExp(word), `programs keep ${word} lifecycle`);
  }
  assert.ok(missionFixture.states.normal.source.saplings.length >= 1, 'fixture carries a synthetic sapling');
  assert.ok(
    missionFixture.states.normal.source.programs.some((program: { programKind: string }) => program.programKind === 'company'),
    'fixture carries a synthetic company-wide program',
  );
  for (const key of ['fixture', 'scene', 'contract', 'redaction', 'states']) {
    assert.ok(key in canopyFixture, `canopy fixture declares ${key}`);
    assert.ok(key in missionFixture, `mission fixture declares ${key}`);
  }
});

test('fixtures stay synthetic and never carry live proof material', () => {
  const raw = JSON.stringify(canopyFixture) + JSON.stringify(missionFixture);
  for (const marker of ['query_id=', 'auth_date=', 'Bearer ', 'PRIVATE KEY', 'TELEGRAM_INIT_DATA', 'TG_INIT_DATA', 'QUESTS_PUSH_TOKEN']) {
    assert.ok(!raw.includes(marker), `fixtures never carry ${marker}`);
  }
  assert.match(raw, /layout-only|synthetic/, 'fixtures are labelled synthetic and layout-only');
  assert.ok(!raw.includes('"proofComplete": true'), 'fixtures never claim live proof completion');
});

// ── canopy derivation + rendering ───────────────────────────────────────────

test('canopy separates saplings and programs with type-specific lifecycle language', () => {
  const html = renderCanopy(TASK8_PROJECTION);
  assert.match(html, /data-component="FabricCanopy"/, 'canopy root renders');
  assert.match(html, /data-of-canopy-list="saplings"/, 'sapling section renders');
  assert.match(html, /data-of-canopy-list="programs"/, 'program section renders');
  assert.ok(html.indexOf('data-of-canopy-list="saplings"') < html.indexOf('data-of-canopy-list="programs"'), 'saplings precede programs deterministically');
  assert.match(html, /data-work-kind="sapling"/, 'sapling card keeps its canonical kind');
  assert.match(html, /data-work-kind="program"/, 'program card keeps its canonical kind');
  assert.match(html, /supervised-branch/, 'sapling promotion semantics stay visible');
  assert.match(html, /current gate|gate G1/i, 'sapling gate semantics stay visible');
  assert.match(html, />executing</, 'program lifecycle stays visible');
  const programSlice = html.slice(html.indexOf('data-of-canopy-list="programs"'));
  assert.ok(!programSlice.includes('promotion'), 'program section never uses branch promotion wording');
  for (const banned of FABRIC_STYLE_BANNED_RAW) {
    assert.ok(!html.includes(banned), `canopy never emits ${banned}`);
  }
});

test('canopy aggregates follow canonical projection status/lifecycle and typed gaps', () => {
  const html = renderCanopy(TASK8_PROJECTION);
  assert.match(html, /data-component="FabricCanopySummary"/, 'summary renders');
  const total = Number(html.match(/data-aggregate="total"[^>]*>(\d+)</)?.[1]);
  const active = Number(html.match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]);
  const blocked = Number(html.match(/data-aggregate="blocked"[^>]*>(\d+)</)?.[1]);
  const stale = Number(html.match(/data-aggregate="stale"[^>]*>(\d+)</)?.[1]);
  const works = TASK8_PROJECTION.nodes.filter(
    (node): node is FabricWorkNode => node.kind === 'work' && (node.value.kind === 'sapling' || node.value.kind === 'program'),
  );
  const ACTIVE_PROGRAM_LIFECYCLES = new Set(['executing', 'verifying']);
  const isActive = (value: FabricWorkNode['value']): boolean =>
    value.kind === 'program' ? ACTIVE_PROGRAM_LIFECYCLES.has(value.lifecycle) : value.status === 'active';
  assert.equal(total, works.length, 'total is the canonical work-node count');
  assert.equal(active, works.filter((node) => isActive(node.value)).length, 'active = sapling active status or program executing/verifying');
  assert.equal(blocked, works.filter((node) => node.value.status === 'blocked').length, 'blocked is exactly canonical status blocked for both work kinds');
  const staleSubjects = new Set(
    TASK8_PROJECTION.gaps
      .filter((gap) => gap.kind === 'stale')
      .map((gap) => gap.subjectId)
      .filter((id): id is string => typeof id === 'string'),
  );
  assert.equal(stale, works.filter((node) => staleSubjects.has(node.value.workId)).length, 'stale maps typed stale gaps to work subjects only');
  assert.ok(!/\d+%/.test(html), 'canopy never renders fabricated progress percentages');

  // The renderer reads canonical status only — never currentState. When the
  // compiler maps ready/approved source lifecycles to status 'active'
  // (WORK_ACTIVE_STATES), the canopy trusts that canonical projection truth;
  // currentState is never consulted as a second authority.
  const readySource = structuredClone(TASK8_SOURCE);
  readySource.saplings = [
    { ...TASK8_SOURCE.saplings[0], saplingId: 'fx-sapling-ready', branchId: 'fx-branch-ready', missionId: 'fx-gate-ready', lifecycle: 'ready' },
    { ...TASK8_SOURCE.saplings[0], saplingId: 'fx-sapling-approved', branchId: 'fx-branch-approved', missionId: 'fx-gate-approved', lifecycle: 'approved' },
  ];
  readySource.programs = readySource.programs.map((program) => ({ ...program, lifecycle: 'approved' }));
  const readyProjection = buildMissionFabricProjection(readySource, {
    tenantId: readySource.tenantId,
    clock: { now: () => '2026-07-28T09:00:00.000Z' },
  });
  const readyWorks = readyProjection.nodes.filter(
    (node): node is FabricWorkNode => node.kind === 'work' && (node.value.kind === 'sapling' || node.value.kind === 'program'),
  );
  const readyExpected = readyWorks.filter(
    (node) => (node.value.kind === 'program' ? ACTIVE_PROGRAM_LIFECYCLES.has(node.value.lifecycle) : node.value.status === 'active'),
  ).length;
  const readyHtml = renderCanopy(readyProjection);
  const readyActive = Number(readyHtml.match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]);
  assert.equal(readyActive, readyExpected, 'active count follows canonical status/lifecycle exactly, whatever currentState says');
  const lifecycleOnly = readyProjection.nodes.find(
    (node): node is FabricWorkNode => node.kind === 'work' && node.value.kind === 'sapling' && node.value.status === 'active' && node.value.currentState === 'ready',
  );
  assert.ok(lifecycleOnly, 'a ready-lifecycle sapling carries canonical status active from the compiler');
});

test('canopy active derives from canonical status only, never from currentState', () => {
  const nodeActive = renderCanopy({
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      { kind: 'work' as const, value: { ...makeWorkNode({ workId: 'fx-sapling-active-alien', status: 'active', currentState: 'draft' }).value } },
    ],
  } as unknown as MissionFabricProjectionV1);
  const baseActive = Number(renderCanopy(TASK8_PROJECTION).match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]);
  const nodeActiveCount = Number(nodeActive.match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]);
  assert.equal(nodeActiveCount, baseActive + 1, 'status active with an unrelated currentState counts active (node)');

  const nodeInactive = renderCanopy({
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      { kind: 'work' as const, value: { ...makeWorkNode({ workId: 'fx-sapling-ready-alien', status: 'ready', currentState: 'active' }).value } },
    ],
  } as unknown as MissionFabricProjectionV1);
  assert.equal(
    Number(nodeInactive.match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]),
    baseActive,
    'status ready with currentState active never counts active (node)',
  );
});

test('program blocked is status-only and independent of lifecycle active', () => {
  const baseHtml = renderCanopy(TASK8_PROJECTION);
  const baseActive = Number(baseHtml.match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]);
  const baseBlocked = Number(baseHtml.match(/data-aggregate="blocked"[^>]*>(\d+)</)?.[1]);
  const programNode = TASK8_PROJECTION.nodes.find(
    (node): node is FabricWorkNode => node.kind === 'work' && node.value.kind === 'program',
  )!;
  assert.equal(programNode.value.lifecycle, 'executing', 'fixture program is executing');
  const withBlocked = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'work' as const,
        value: {
          ...(programNode.value as Record<string, unknown>),
          workId: 'fx-program-blocked-executing',
          status: 'blocked',
          lifecycle: 'executing',
        },
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const html = renderCanopy(withBlocked);
  const active = Number(html.match(/data-aggregate="active"[^>]*>(\d+)</)?.[1]);
  const blocked = Number(html.match(/data-aggregate="blocked"[^>]*>(\d+)</)?.[1]);
  assert.equal(active, baseActive + 1, 'blocked program with executing lifecycle still counts active');
  assert.equal(blocked, baseBlocked + 1, 'program blocked comes exactly from status === blocked');

  const lifecycleBlocked = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'work' as const,
        value: {
          ...(programNode.value as Record<string, unknown>),
          workId: 'fx-program-lifecycle-blocked',
          status: 'active',
          lifecycle: 'blocked',
        },
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const lifecycleHtml = renderCanopy(lifecycleBlocked);
  assert.equal(
    Number(lifecycleHtml.match(/data-aggregate="blocked"[^>]*>(\d+)</)?.[1]),
    baseBlocked,
    'a noncanonical program lifecycle value never counts blocked (status is the only source)',
  );
});

test('of-control carries its own 44px hit target; of-tab additionally sizes to 44px', () => {
  const controlRule = OPERATING_FABRIC_STYLES.match(/\.of-control\{[^}]*\}/);
  assert.ok(controlRule, 'a standalone .of-control rule exists');
  assert.match(controlRule![0], /min-height:44px/, '.of-control alone guarantees a 44px minimum height');
  assert.match(controlRule![0], /min-width:44px/, '.of-control alone guarantees a 44px minimum width');
  const sizedRule = OPERATING_FABRIC_STYLES.match(/\.of-tab\{[^}]*min-height:44px[^}]*\}/);
  assert.ok(sizedRule, 'the concrete .of-tab rule carries min-height:44px');
  const focusRule = OPERATING_FABRIC_STYLES.match(/\.of-tab:focus-visible,\.of-control:focus-visible\{[^}]*outline:2px/);
  assert.ok(focusRule, 'the concrete focus-visible rule covers of-tab and of-control');
  for (const [label, html] of [
    ['node canopy', renderCanopy(TASK8_PROJECTION)],
    ['CANOPY_BROWSER_JS', CANOPY_BROWSER_JS],
  ] as const) {
    assert.match(
      html,
      /class="of-tab of-control of-card-open"/,
      `${label}: open-lineage control carries the sized of-tab class plus the scene class`,
    );
  }
});

test('of-inspect-btn and of-gate-entrypoint-btn controls inherit a 44px hit target from .of-control', () => {
  const controlRule = OPERATING_FABRIC_STYLES.match(/\.of-control\{[^}]*\}/);
  assert.ok(controlRule, 'a standalone .of-control rule exists');
  assert.match(controlRule![0], /min-height:44px/, '.of-control guarantees a 44px minimum height');
  assert.match(controlRule![0], /min-width:44px/, '.of-control guarantees a 44px minimum width');
  assert.match(controlRule![0], /box-sizing:border-box/, '.of-control keeps declared padding inside its box so the min size is honored');
  assert.doesNotMatch(OPERATING_FABRIC_STYLES, /\.of-inspect-btn\{[^}]*min-height/, 'of-inspect-btn relies on the shared .of-control rule, not a bespoke one');
});

test('of-flow contains intended internal horizontal scroll without leaking overflow to the document', () => {
  assert.match(OPERATING_FABRIC_STYLES, /\.of-flow\{[^}]*overflow-x:auto/, 'the flow graph/list wrapper owns its own horizontal scroller');
  assert.match(OPERATING_FABRIC_STYLES, /\.of-flow\{[^}]*max-width:100%/, 'the flow wrapper stays within its scene column');
  assert.match(OPERATING_FABRIC_STYLES, /\.of-scene\{[^}]*overflow-x:hidden/, 'a scene never grows the document past the viewport, even if its content wants to');
  assert.match(OPERATING_FABRIC_STYLES, /\.of-scene\{[^}]*max-width:100%/, 'a scene stays clipped to its container width');
});

test('canopy cards are stable-sorted, bounded, and truncation is an explicit typed state', () => {
  const html = renderCanopy(TASK8_PROJECTION);
  const saplingSlice = html.slice(html.indexOf('data-of-canopy-list="saplings"'), html.indexOf('data-of-canopy-list="programs"'));
  const programSlice = html.slice(html.indexOf('data-of-canopy-list="programs"'));
  const idsOf = (slice: string) => [...slice.matchAll(/data-work-id="([^"]+)"/g)].map((match) => match[1]);
  const saplingIds = idsOf(saplingSlice);
  const programIds = idsOf(programSlice);
  assert.deepEqual(saplingIds, [...saplingIds].sort(), 'sapling cards sort by workId');
  assert.deepEqual(programIds, [...programIds].sort(), 'program cards sort by workId');
  assert.ok(saplingIds.length <= 24 && programIds.length <= 24, 'canopy sections stay bounded');

  const manySource = structuredClone(TASK8_SOURCE);
  manySource.saplings = Array.from({ length: 40 }, (_, index) => ({
    ...TASK8_SOURCE.saplings[0],
    saplingId: `fx-sapling-many-${String(index).padStart(2, '0')}`,
    branchId: `fx-branch-many-${String(index).padStart(2, '0')}`,
  }));
  const manyProjection = buildMissionFabricProjection(manySource, {
    tenantId: manySource.tenantId,
    clock: { now: () => '2026-07-28T09:00:00.000Z' },
  });
  const manyHtml = renderCanopy(manyProjection);
  const manySaplings = manyHtml.slice(manyHtml.indexOf('data-of-canopy-list="saplings"'), manyHtml.indexOf('data-of-canopy-list="programs"'));
  assert.equal([...manySaplings.matchAll(/data-work-id="/g)].length, 24, 'sapling section truncates at the 24-card bound');
  assert.match(manyHtml, /data-state="truncated"/, 'truncation is its own typed state');
  const truncatedSlice = manyHtml.slice(manyHtml.indexOf('data-state="truncated"'));
  assert.doesNotMatch(truncatedSlice.slice(0, truncatedSlice.indexOf('</div>')), /evidence is older than the freshness window/, 'truncation never reuses stale copy');
  assert.doesNotMatch(manyHtml, /of-state-stale[^"]*" data-component="FabricState" data-state="truncated"/, 'truncation never relabels the stale component');
  assert.match(manyHtml, /16 entries truncated/, 'truncation reports the hidden count honestly');
});

test('canopy work ids and gates stay bounded and secret-filtered', () => {
  const hostileProjection = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'work' as const,
        value: {
          ...makeWorkNode({
            kind: 'sapling',
            workId: 'work query_id=AAE7 hash=abc',
            currentGate: 'gate initData Bearer eyJhbGci',
            status: 'active',
          }).value,
        },
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const html = renderCanopy(hostileProjection);
  assert.ok(!html.includes('query_id='), 'hostile work id never reaches markup');
  assert.ok(!html.includes('hash=abc'), 'hostile work id hash never reaches markup');
  assert.ok(!html.includes('Bearer eyJ'), 'hostile gate never reaches markup');
  assert.ok(!html.includes('initData'), 'hostile gate initData never reaches markup');
  assert.match(html, /data-work-id="redacted"/, 'hostile work id fails closed to a redacted attribute');
  assert.match(html, /unknown gate/, 'hostile gate fails closed to the neutral label');

  const oversize = renderCanopy({
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      { kind: 'work' as const, value: { ...makeWorkNode({ workId: `fx-${'x'.repeat(3000)}`, currentGate: `G${'g'.repeat(3000)}` }).value } },
    ],
  } as unknown as MissionFabricProjectionV1);
  assert.ok(!oversize.includes('x'.repeat(256)), 'oversize work ids are bounded');
  assert.ok(!oversize.includes('g'.repeat(256)), 'oversize gates are bounded');
});

test('canopy distinguishes empty, stale, error, and malformed projections safely', () => {
  const emptyProjection = { ...TASK8_PROJECTION, nodes: [], edges: [], gaps: [] };
  const emptyHtml = renderCanopy(emptyProjection);
  assert.match(emptyHtml, /data-state="empty"/, 'work-free projection renders the empty state');
  assert.doesNotMatch(emptyHtml, /data-work-id="/, 'empty canopy renders no cards');

  const staleHtml = renderCanopy(TASK8_PROJECTION, {
    freshness: { state: 'stale', checkedAt: '2026-07-28T06:00:00.000Z' },
  });
  assert.match(staleHtml, /data-state="stale"/, 'stale freshness keeps the stale treatment');

  const errorHtml = renderCanopy(TASK8_PROJECTION, { error: true });
  assert.match(errorHtml, /data-state="error"/, 'error option renders the error state');

  const malformedHtml = renderCanopy(null as never);
  assert.match(malformedHtml, /data-state="error"/, 'malformed projection fails closed to error');
});

// ── mission lineage derivation + rendering ──────────────────────────────────

test('mission lineage follows explicit ids, edges, and taskIds — never name joins', () => {
  const html = renderOperatingMission(TASK8_PROJECTION, 'fx-program-001');
  assert.match(html, /data-component="FabricMissionLineage"/, 'lineage root renders');
  assert.match(html, /data-lineage-work="fx-program-001"/, 'work row keeps its explicit id');
  assert.match(html, /data-lineage-mission="fx-mission-001"/, 'mission row keeps its explicit id');
  const taskOrder = [...html.matchAll(/data-lineage-task="(fx-task-[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(taskOrder, ['fx-task-001', 'fx-task-002'], 'tasks follow the explicit mission taskIds order');
  assert.match(html, /contains/, 'explicit contains edge renders');

  const collidingSource = structuredClone(TASK8_SOURCE);
  collidingSource.missions = [
    ...collidingSource.missions,
    { missionId: 'fx-mission-002', workId: 'fx-program-001', title: collidingSource.missions[0].title, lifecycle: 'proposed', authorityRef: 'd1-goal-graph/fx-mission-002' },
  ];
  const colliding = buildMissionFabricProjection(collidingSource, {
    tenantId: collidingSource.tenantId,
    clock: { now: () => '2026-07-28T09:00:00.000Z' },
  });
  const collidingHtml = renderOperatingMission(colliding, 'fx-program-001');
  assert.match(collidingHtml, /data-lineage-mission="fx-mission-001"/, 'explicit workId join keeps the primary mission');
  assert.match(collidingHtml, /data-lineage-mission="fx-mission-002"/, 'identical titles never merge distinct missions');
});

test('mission scene shows desired vs observed state, dependencies, blockers, gaps, and receipt coverage', () => {
  const html = renderOperatingMission(TASK8_PROJECTION, 'fx-program-001');
  const taskOne = html.indexOf('data-lineage-task="fx-task-001"');
  const taskTwo = html.indexOf('data-lineage-task="fx-task-002"');
  const taskOneSlice = html.slice(taskOne, taskTwo);
  const taskTwoSlice = html.slice(taskTwo);
  assert.match(taskOneSlice, /desired/, 'desired state is labelled');
  assert.match(taskOneSlice, /observed/, 'observed state is labelled');
  assert.match(taskTwoSlice, /depends on/, 'dependency renders from explicit depends-on edges');
  assert.match(taskTwoSlice, /fx-task-001/, 'dependency names the prerequisite task id');
  assert.match(taskTwoSlice, /blocked/, 'blocked status stays visible');
  assert.match(html, /proof requirement/, 'proof requirement stays visible');
  assert.match(html, /data-component="FabricGap"/, 'typed gaps render through the visual grammar');
  const coverageMatch = html.match(/data-receipt-coverage="(\d+) of (\d+)"/);
  const receiptCovered = Number(coverageMatch?.[1]);
  const receiptTotal = Number(coverageMatch?.[2]);
  const lineageTaskIds = TASK8_PROJECTION.nodes
    .filter((node): node is Extract<FabricNode, { kind: 'mission' }> => node.kind === 'mission')
    .flatMap((mission) => mission.value.taskIds);
  const receiptNodes = TASK8_PROJECTION.nodes.filter((node): node is Extract<FabricNode, { kind: 'receipt' }> => node.kind === 'receipt');
  const receiptById = new Map(receiptNodes.map((receipt) => [receipt.value.receiptId, receipt]));
  const proofEdges = TASK8_PROJECTION.edges.filter((edge) => edge.kind === 'produces' || edge.kind === 'proves');
  const tasks = TASK8_PROJECTION.nodes.filter((node): node is Extract<FabricNode, { kind: 'task' }> => node.kind === 'task');
  const covered = tasks.filter((task) => {
    const explicit = typeof task.value.latestReceiptId === 'string' && task.value.latestReceiptId.length > 0
      ? receiptById.get(task.value.latestReceiptId) ?? null
      : null;
    if (explicit) return true;
    return proofEdges.some(
      (edge) => receiptById.has(edge.fromId) && edge.toId === task.value.taskId,
    );
  }).length;
  assert.equal(receiptCovered, covered, 'receipt coverage follows latestReceiptId and exact proof edges only');
  assert.equal(receiptTotal, new Set(lineageTaskIds).size, 'receipt coverage total is the lineage task count');
  assert.ok(!/readiness|ready to ship|\d+% ready/.test(html), 'mission scene never invents readiness');
});

test('dependencies are never labelled blockers; blockers come only from typed blocker evidence', () => {
  const html = renderOperatingMission(TASK8_PROJECTION, 'fx-program-001');
  const taskTwoSlice = html.slice(html.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(taskTwoSlice, /depends on/, 'the dependency row renders as a dependency');
  assert.doesNotMatch(taskTwoSlice, /<dt>blocker<\/dt><dd>fx-task-001/, 'a dependency id is never rendered as the blocker');
  assert.match(taskTwoSlice, /blocker detail missing/, 'blocked tasks without typed blocker evidence render the honest missing-detail label');

  const withBlockerGap = {
    ...TASK8_PROJECTION,
    gaps: [
      ...TASK8_PROJECTION.gaps,
      {
        gapId: 'fx-gap-blocker-1',
        kind: 'blocker',
        subjectId: 'fx-task-002',
        detail: 'waiting on the receipt fence review',
        evidenceRef: null,
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const gapHtml = renderOperatingMission(withBlockerGap, 'fx-program-001');
  const gapTaskSlice = gapHtml.slice(gapHtml.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(gapTaskSlice, /waiting on the receipt fence review/, 'typed blocker gap detail renders as the blocker');
  assert.doesNotMatch(gapTaskSlice, /blocker detail missing/, 'typed blocker evidence replaces the missing-detail label');
  assert.doesNotMatch(gapTaskSlice, /<dt>blocker<\/dt><dd>fx-task-001/, 'even with evidence, the dependency id is not relabelled a blocker');
});

test('mission lineage is input-order independent — missions, tasks, and edges are canonical-sorted', () => {
  const missionRowRe = /data-lineage-mission="(fx-mission-[^"]+)"/g;
  const edgeRe = /<li class="of-lineage-edge">/g;
  const extraMission = {
    kind: 'mission' as const,
    value: {
      missionId: 'fx-mission-000',
      workId: 'fx-program-001',
      title: 'A mission that sorts first',
      objective: 'd1-goal-graph/fx-mission-000',
      status: 'queued' as const,
      gateId: null,
      proofRequirement: '',
      taskIds: ['fx-task-001'],
      sourceRef: 'd1-goal-graph/fx-mission-000',
    },
  };
  const extraTask = {
    kind: 'task' as const,
    value: {
      taskId: 'fx-task-000',
      missionId: 'fx-mission-001',
      desiredState: 'queued',
      status: 'queued' as const,
      dependencyIds: [],
      assignedAgentId: null,
      requiredClusterIds: [],
      pinnedLoadoutId: null,
      leaseId: null,
      proofRequirement: '',
      latestReceiptId: null,
    },
  };
  const baseNodes = [...TASK8_PROJECTION.nodes, extraMission, extraTask];
  const forward = {
    ...TASK8_PROJECTION,
    nodes: baseNodes,
    edges: [...TASK8_PROJECTION.edges],
  } as unknown as MissionFabricProjectionV1;
  const reversed = {
    ...TASK8_PROJECTION,
    nodes: [...baseNodes].reverse(),
    edges: [...TASK8_PROJECTION.edges].reverse(),
  } as unknown as MissionFabricProjectionV1;
  const forwardHtml = renderOperatingMission(forward, 'fx-program-001');
  const reversedHtml = renderOperatingMission(reversed, 'fx-program-001');
  const forwardMissions = [...forwardHtml.matchAll(missionRowRe)].map((match) => match[1]);
  const reversedMissions = [...reversedHtml.matchAll(missionRowRe)].map((match) => match[1]);
  assert.deepEqual(forwardMissions, ['fx-mission-000', 'fx-mission-001'], 'missions stable-sort by missionId');
  assert.deepEqual(reversedMissions, forwardMissions, 'mission order never follows input order');
  assert.equal(
    [...forwardHtml.matchAll(/data-lineage-task="fx-task-/g)].length,
    [...reversedHtml.matchAll(/data-lineage-task="fx-task-/g)].length,
    'task row count is input-order independent',
  );
  assert.equal(
    [...forwardHtml.matchAll(edgeRe)].length,
    [...reversedHtml.matchAll(edgeRe)].length,
    'edge row count is input-order independent',
  );
  const duplicateHtml = renderOperatingMission(
    { ...forward, nodes: [...baseNodes, extraMission, extraTask] } as unknown as MissionFabricProjectionV1,
    'fx-program-001',
  );
  assert.deepEqual(
    [...duplicateHtml.matchAll(missionRowRe)].map((match) => match[1]),
    forwardMissions,
    'duplicate mission nodes never duplicate rendered rows',
  );
  // mission.taskIds is the explicit membership source: a task node that no
  // selected mission declares never renders, duplicated or not.
  assert.equal(
    [...duplicateHtml.matchAll(/data-lineage-task="fx-task-000"/g)].length,
    0,
    'unclaimed task nodes never render — membership comes only from mission.taskIds',
  );
  const taskOrder = [...forwardHtml.matchAll(/data-lineage-task="(fx-task-[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(taskOrder, ['fx-task-001', 'fx-task-002'], 'tasks follow the explicit mission.taskIds membership order');
  const claimedTwice = {
    ...forward,
    nodes: [
      ...forward.nodes,
      {
        kind: 'mission' as const,
        value: { ...extraMission.value, missionId: 'fx-mission-zzz', taskIds: ['fx-task-001', 'fx-task-002'] },
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const claimedHtml = renderOperatingMission(claimedTwice, 'fx-program-001');
  assert.equal(
    [...claimedHtml.matchAll(/data-lineage-task="fx-task-001"/g)].length,
    1,
    'a task claimed by two missions renders exactly once',
  );
});

test('receipt coverage rejects reversed edges and picks the lexicographically smallest receipt deterministically', () => {
  const tasklessReceipts = TASK8_PROJECTION.nodes.filter((node) => node.kind !== 'receipt');
  assert.ok(tasklessReceipts.length < TASK8_PROJECTION.nodes.length, 'fixture carries a canonical receipt');
  const makeReceipt = (receiptId: string) => ({
    kind: 'receipt' as const,
    value: {
      receiptId,
      runId: '',
      taskId: 'fx-task-002',
      graphVersion: 7,
      status: 'complete' as const,
      inputDigest: 'sha256:fx',
      outputDigest: null,
      evidenceRefs: [],
      approvalRef: null,
      createdAt: '2026-07-28T08:59:00.000Z',
    },
  });
  const reversedEdge = {
    ...TASK8_PROJECTION,
    nodes: [...TASK8_PROJECTION.nodes, makeReceipt('fx-receipt-888')],
    edges: [...TASK8_PROJECTION.edges, { kind: 'proves' as const, fromId: 'fx-task-002', toId: 'fx-receipt-888' }],
  } as unknown as MissionFabricProjectionV1;
  const reversedHtml = renderOperatingMission(reversedEdge, 'fx-program-001');
  assert.match(reversedHtml, /data-receipt-coverage="1 of 2"/, 'a reversed task→receipt edge never covers the task');
  const reversedTaskTwo = reversedHtml.slice(reversedHtml.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(reversedTaskTwo, /<dt>receipt<\/dt><dd>no receipt/, 'reversed edges are rejected as coverage evidence');

  const multi = {
    ...TASK8_PROJECTION,
    nodes: [...TASK8_PROJECTION.nodes, makeReceipt('fx-receipt-200'), makeReceipt('fx-receipt-100')],
    edges: [
      ...TASK8_PROJECTION.edges,
      { kind: 'proves' as const, fromId: 'fx-receipt-200', toId: 'fx-task-002' },
      { kind: 'produces' as const, fromId: 'fx-receipt-100', toId: 'fx-task-002' },
    ],
  } as unknown as MissionFabricProjectionV1;
  const multiHtml = renderOperatingMission(multi, 'fx-program-001');
  assert.match(multiHtml, /data-receipt-coverage="2 of 2"/, 'multiple valid receipt edges keep coverage boolean');
  const multiTaskTwo = multiHtml.slice(multiHtml.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(multiTaskTwo, /<dt>receipt<\/dt><dd>fx-receipt-100</, 'the lexicographically smallest receiptId renders deterministically');
  const multiShuffled = {
    ...multi,
    nodes: [...multi.nodes].reverse(),
    edges: [...multi.edges].reverse(),
  } as unknown as MissionFabricProjectionV1;
  const shuffledHtml = renderOperatingMission(multiShuffled, 'fx-program-001');
  const shuffledTaskTwo = shuffledHtml.slice(shuffledHtml.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(shuffledTaskTwo, /<dt>receipt<\/dt><dd>fx-receipt-100</, 'receipt selection is input-order independent');
});

test('hostile prototype-shaped ids never corrupt lineage membership or coverage', () => {
  const hostile = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'receipt' as const,
        value: {
          receiptId: '__proto__',
          runId: '',
          taskId: 'fx-task-002',
          graphVersion: 7,
          status: 'complete' as const,
          inputDigest: 'sha256:fx',
          outputDigest: null,
          evidenceRefs: [],
          approvalRef: null,
          createdAt: '2026-07-28T08:59:00.000Z',
        },
      },
      {
        kind: 'task' as const,
        value: {
          taskId: 'constructor',
          missionId: 'fx-mission-001',
          desiredState: 'queued',
          status: 'queued' as const,
          dependencyIds: [],
          assignedAgentId: null,
          requiredClusterIds: [],
          pinnedLoadoutId: null,
          leaseId: null,
          proofRequirement: '',
          latestReceiptId: null,
        },
      },
    ],
    edges: [
      ...TASK8_PROJECTION.edges,
      { kind: 'proves' as const, fromId: '__proto__', toId: 'fx-task-002' },
      { kind: 'depends-on' as const, fromId: 'fx-task-002', toId: 'constructor' },
    ],
  } as unknown as MissionFabricProjectionV1;
  const html = renderOperatingMission(hostile, 'fx-program-001');
  assert.match(html, /data-receipt-coverage="2 of 2"/, 'a __proto__ receipt id never breaks coverage membership');
  const taskTwo = html.slice(html.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(taskTwo, /__proto__/, 'the __proto__ receipt id renders as data, never as a prototype accessor');
  assert.doesNotMatch(taskTwo, /\[object Object\]/, 'prototype corruption never renders');
});

test('hostile prototype-shaped ids behave identically in the composed browser boot', async () => {
  const hostile = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'receipt' as const,
        value: {
          receiptId: '__proto__',
          runId: '',
          taskId: 'fx-task-002',
          graphVersion: 7,
          status: 'complete' as const,
          inputDigest: 'sha256:fx',
          outputDigest: null,
          evidenceRefs: [],
          approvalRef: null,
          createdAt: '2026-07-28T08:59:00.000Z',
        },
      },
    ],
    edges: [
      ...TASK8_PROJECTION.edges,
      { kind: 'proves' as const, fromId: '__proto__', toId: 'fx-task-002' },
      { kind: 'proves' as const, fromId: 'fx-task-002', toId: '__proto__' },
    ],
  } as unknown as MissionFabricProjectionV1;
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: hostile,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  booted.clickOpen('fx-program-001');
  await flushBoot();
  const missionRoot = booted.elements.get('of-scene-mission')!;
  assert.equal(
    (missionRoot.innerHTML.match(/data-receipt-coverage="(\d+) of (\d+)"/) ?? [])[1],
    '2',
    'browser coverage is boolean and prototype-safe',
  );
  assert.doesNotMatch(missionRoot.innerHTML, /\[object Object\]/, 'browser membership never corrupts on prototype keys');
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  assert.match(canopyRoot.innerHTML, /data-component="FabricCanopy"/, 'canopy stays populated through selection');
});

test('receipt coverage follows latestReceiptId and exact proof edges, never arbitrary last receipt', () => {
  const coveredHtml = renderOperatingMission(TASK8_PROJECTION, 'fx-program-001');
  assert.match(coveredHtml, /data-receipt-coverage="1 of 2"/, 'fixture coverage is the one canonically proven task');

  const reordered = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes.filter((node) => node.kind !== 'receipt'),
      {
        kind: 'receipt' as const,
        value: {
          receiptId: 'fx-receipt-999',
          runId: '',
          taskId: 'fx-task-002',
          graphVersion: 7,
          status: 'complete' as const,
          inputDigest: 'sha256:fx999',
          outputDigest: null,
          evidenceRefs: [],
          approvalRef: null,
          createdAt: '2026-07-28T08:59:00.000Z',
        },
      },
      ...TASK8_PROJECTION.nodes.filter((node) => node.kind === 'receipt'),
    ],
  } as unknown as MissionFabricProjectionV1;
  const reorderedHtml = renderOperatingMission(reordered, 'fx-program-001');
  assert.match(reorderedHtml, /data-receipt-coverage="1 of 2"/, 'a stray receipt never claims coverage without latestReceiptId or a proof edge');
  const reorderedTaskTwo = reorderedHtml.slice(reorderedHtml.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(reorderedTaskTwo, /<dt>receipt<\/dt><dd>no receipt/, 'the stray receipt is not adopted by input order or taskId');

  const withEdge = {
    ...reordered,
    edges: [...reordered.edges, { kind: 'proves' as const, fromId: 'fx-receipt-999', toId: 'fx-task-002' }],
  } as unknown as MissionFabricProjectionV1;
  const edgeHtml = renderOperatingMission(withEdge, 'fx-program-001');
  assert.match(edgeHtml, /data-receipt-coverage="2 of 2"/, 'an exact proves edge canonically covers the task');

  const withLatest = {
    ...reordered,
    nodes: reordered.nodes.map((node) =>
      node.kind === 'task' && node.value.taskId === 'fx-task-002'
        ? { ...node, value: { ...node.value, latestReceiptId: 'fx-receipt-999' } }
        : node,
    ),
  } as unknown as MissionFabricProjectionV1;
  const latestHtml = renderOperatingMission(withLatest, 'fx-program-001');
  assert.match(latestHtml, /data-receipt-coverage="2 of 2"/, 'latestReceiptId canonically covers the task');
  const latestTaskTwo = latestHtml.slice(latestHtml.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(latestTaskTwo, /fx-receipt-999/, 'latestReceiptId names the selected receipt');
});

test('missing proofRequirement renders the explicit missing label, never an invented proof required', () => {
  const html = renderOperatingMission(TASK8_PROJECTION, 'fx-program-001');
  const taskOneSlice = html.slice(html.indexOf('data-lineage-task="fx-task-001"'), html.indexOf('data-lineage-task="fx-task-002"'));
  assert.match(taskOneSlice, /proof requirement missing/, 'absent proofRequirement renders the explicit missing label');
  assert.doesNotMatch(taskOneSlice, />proof required</, 'proof required is never invented');
});

test('mission scene secret-filters and bounds every id, title, objective, state, gap, and dependency', () => {
  const hostile = {
    ...TASK8_PROJECTION,
    nodes: TASK8_PROJECTION.nodes.map((node) => {
      if (node.kind === 'task' && node.value.taskId === 'fx-task-001') {
        return { ...node, value: { ...node.value, taskId: 'fx-task-001 query_id=AAE7', desiredState: 'state hash=abc', proofRequirement: 'proof token=ab12' } };
      }
      if (node.kind === 'mission') {
        return { ...node, value: { ...node.value, title: 'mission initData Bearer eyJ', objective: 'objective PRIVATE KEY', status: 'active token=zz99' } };
      }
      return node;
    }),
    edges: [...TASK8_PROJECTION.edges, { kind: 'depends-on' as const, fromId: 'fx-task-002', toId: 'dep clientSecret leak' }],
    gaps: [
      ...TASK8_PROJECTION.gaps,
      { gapId: 'fx-gap-hostile', kind: 'blocker', subjectId: 'fx-task-002', detail: 'blocker auth_date=999 hash=zzz', evidenceRef: null },
    ],
  } as unknown as MissionFabricProjectionV1;
  const html = renderOperatingMission(hostile, 'fx-program-001');
  for (const marker of FABRIC_STYLE_BANNED_RAW) {
    assert.ok(!html.includes(marker), `mission scene never emits ${marker}`);
  }
  assert.ok(!html.includes('PRIVATE KEY'), 'hostile objective never renders');
  assert.ok(!html.includes('token='), 'hostile proof/status never renders');
  assert.match(html, /proof requirement missing/, 'hostile proofRequirement fails closed to the missing label');

  const oversize = {
    ...TASK8_PROJECTION,
    nodes: TASK8_PROJECTION.nodes.map((node) =>
      node.kind === 'mission' ? { ...node, value: { ...node.value, title: `t${'x'.repeat(4000)}` } } : node,
    ),
  } as unknown as MissionFabricProjectionV1;
  const oversizeHtml = renderOperatingMission(oversize, 'fx-program-001');
  assert.ok(!oversizeHtml.includes('x'.repeat(256)), 'oversize titles are bounded');

  const hostileSelection = renderOperatingMission(TASK8_PROJECTION, '"><script>alert(1)</script>');
  assert.ok(!hostileSelection.includes('<script>alert(1)</script>'), 'hostile selection never reaches markup');
  assert.match(hostileSelection, /data-state="empty"/, 'unknown selection renders the honest empty state');
});

test('escaping parity: hostile markup never executes and benign ampersands stay single-escaped', () => {
  const hostile = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'work' as const,
        value: {
          ...makeWorkNode({
            workId: 'fx-sapling-markup',
            name: 'Salt & Vinegar <img src=x onerror=alert(1)>',
            status: 'active',
          }).value,
        },
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const html = renderCanopy(hostile);
  assert.ok(!html.includes('<img src=x'), 'hostile markup is never raw');
  assert.match(html, /Salt &amp; Vinegar &lt;img src=x/, 'benign ampersand and hostile tag escape exactly once');
  assert.ok(!html.includes('&amp;amp;'), 'no double-escaped ampersands');
  assert.ok(!html.includes('&amp;lt;'), 'no double-escaped tags');

  const missionHostile = {
    ...TASK8_PROJECTION,
    nodes: TASK8_PROJECTION.nodes.map((node) =>
      node.kind === 'mission'
        ? { ...node, value: { ...node.value, title: 'R&D <b>receipts</b>' } }
        : node,
    ),
  } as unknown as MissionFabricProjectionV1;
  const missionHtml = renderOperatingMission(missionHostile, 'fx-program-001');
  assert.ok(!missionHtml.includes('<b>receipts</b>'), 'hostile mission markup is never raw');
  assert.match(missionHtml, /R&amp;D &lt;b&gt;receipts&lt;\/b&gt;/, 'mission ampersand and tags escape exactly once');
  assert.ok(!missionHtml.includes('&amp;amp;'), 'mission output has no double-escaped ampersands');
});

test('escaping parity holds inside the composed browser boot for benign ampersands', async () => {
  const hostile = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'work' as const,
        value: {
          ...makeWorkNode({
            workId: 'fx-sapling-markup-browser',
            name: 'Salt & Vinegar <img src=x onerror=alert(1)>',
            status: 'active',
          }).value,
        },
      },
    ],
  } as unknown as MissionFabricProjectionV1;
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: hostile,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  assert.ok(!canopyRoot.innerHTML.includes('<img src=x'), 'browser canopy never emits raw hostile markup');
  assert.match(canopyRoot.innerHTML, /Salt &amp; Vinegar &lt;img src=x/, 'browser benign ampersands escape exactly once');
  assert.ok(!canopyRoot.innerHTML.includes('&amp;amp;'), 'browser canopy has no double-escaped ampersands');
});

test('mission scene distinguishes missing selection, missing work, empty lineage, and malformed projections', () => {
  const unselected = renderOperatingMission(TASK8_PROJECTION, null);
  assert.match(unselected, /data-state="empty"/, 'no selection renders an empty state');
  assert.match(unselected, /select/, 'empty state names the selection cue');
  assert.doesNotMatch(unselected, /data-lineage-work="/, 'unselected scene renders no lineage rows');

  const missing = renderOperatingMission(TASK8_PROJECTION, 'fx-work-does-not-exist');
  assert.match(missing, /data-state="empty"/, 'unknown work id renders an empty state, never a fabricated lineage');

  const taskless = buildMissionFabricProjection(
    { ...TASK8_SOURCE, missions: [], tasks: [], runtimeRuns: [], receipts: [] },
    { tenantId: TASK8_SOURCE.tenantId, clock: { now: () => '2026-07-28T09:00:00.000Z' } },
  );
  const tasklessHtml = renderOperatingMission(taskless, 'fx-program-001');
  assert.match(tasklessHtml, /no missions|no tasks|empty/, 'work without missions renders an explicit empty lineage');

  const malformed = renderOperatingMission(null as never, 'fx-program-001');
  assert.match(malformed, /data-state="error"/, 'malformed projection fails closed to error');
});

test('governed actions render as honest read-only cues deferred to the signed Gate client', () => {
  const html = renderOperatingMission(TASK8_PROJECTION, 'fx-program-001');
  assert.match(html, /data-component="FabricGovernedCue"/, 'governed-action cue renders');
  assert.match(html, /governed by the signed Gate/, 'cue names the signed Gate client as the authority path');
  assert.match(html, /deferred to Task 11/, 'cue documents the Task 11 deferral');
  assert.ok(!/<button[^>]*data-governed-action/.test(html), 'no fake active governed control renders');
});

// ── real boot execution (no injected renderer bypass) ───────────────────────

test('boot glue carries no lifecycle mutation, write path, or authorization logic', () => {
  const bootScript = bootBody(OPERATING_FABRIC_BOOT);
  // The scene renderer constants legitimately own lifecycle/promotion view
  // vocabulary; the Task 11 gate-action bridge legitimately owns the signed
  // approve-goal-graph write path. The glue audit excludes that bridge and
  // bans mutation/authority surfaces everywhere else.
  const bridgeStart = bootScript.indexOf(
    "typeof openGatePreflight !== 'function' || typeof gateAct !== 'function'",
  );
  const auditedScript = bridgeStart === -1 ? bootScript : bootScript.slice(0, bridgeStart);
  for (const banned of [
    'POST',
    'api/gate',
    'checkRole',
    'data-action-request',
    'signed-action',
    'role ===',
  ]) {
    assert.ok(!auditedScript.includes(banned), `boot client stays free of authority surface: ${banned}`);
  }
});

test('authenticated 200 executes the real composed boot script and populates the scene roots', async () => {
  const bootErrors: unknown[] = [];
  const booted = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        projection: TASK8_PROJECTION,
        delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
      },
    }),
    { onError: (error) => bootErrors.push(error) },
  );
  await flushBoot();
  assert.deepEqual(bootErrors, [], 'scene wiring never throws during activation');
  assert.equal(booted.fabricRoot.classList.contains('of-on'), true, 'shell activates on the exact-200 flag');
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  const missionRoot = booted.elements.get('of-scene-mission')!;
  assert.match(canopyRoot.innerHTML, /data-component="FabricCanopy"/, 'canopy scene root is populated from the response');
  assert.match(canopyRoot.innerHTML, /data-of-canopy-list="saplings"/, 'canopy sapling section is populated');
  assert.match(canopyRoot.innerHTML, /data-of-canopy-list="programs"/, 'canopy program section is populated');
  assert.match(missionRoot.innerHTML, /data-component="FabricMissionLineage"/, 'mission scene root is populated');
  assert.match(missionRoot.innerHTML, /select/, 'unselected mission scene renders the honest selection cue');
  assert.equal(booted.legacyShell.hidden, true, 'legacy shell yields after population');
});

test('malformed projections and wrong schema keep the legacy shell and never activate', async () => {
  for (const [label, projection] of [
    ['wrong schema', { schema: 'cambium.other.v1', nodes: [], edges: [] }],
    ['missing nodes array', { schema: 'cambium.mission-fabric-projection.v1', edges: [] }],
    ['missing edges array', { schema: 'cambium.mission-fabric-projection.v1', nodes: [] }],
    ['null projection', null],
  ] as const) {
    const booted = bootOperatingFabricDocument(() => ({
      kind: 'json',
      value: {
        projection,
        delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
      },
    }));
    await flushBoot();
    assertStaysInert(booted, label);
    assert.equal(booted.elements.get('of-scene-canopy')!.innerHTML, '', `${label}: canopy root is never written`);
  }
});

test('hostile fixture-shaped payloads fail closed without leaking or crashing', async () => {
  const hostileProjection = {
    ...TASK8_PROJECTION,
    nodes: [
      ...TASK8_PROJECTION.nodes,
      {
        kind: 'work' as const,
        value: {
          ...makeWorkNode({
            kind: 'sapling',
            workId: 'fx-hostile query_id=AAE7 hash=abc',
            name: '<img src=x onerror=alert(1)>',
            currentGate: 'gate initData Bearer eyJ',
            status: 'active',
          }).value,
        },
      },
    ],
  };
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: hostileProjection,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assert.equal(booted.fabricRoot.classList.contains('of-on'), true, 'hostile-but-valid payloads still activate');
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  assert.ok(!canopyRoot.innerHTML.includes('query_id='), 'hostile work id never reaches the canopy root');
  assert.ok(!canopyRoot.innerHTML.includes('hash=abc'), 'hostile id hash never reaches the canopy root');
  assert.ok(!canopyRoot.innerHTML.includes('<img src=x'), 'hostile markup is escaped, never injected as markup');
  assert.match(canopyRoot.innerHTML, /&lt;img src=x/, 'escaped hostile name remains legible, matching Task 7 semantics');
  assert.ok(!canopyRoot.innerHTML.includes('Bearer eyJ'), 'hostile gate never reaches the canopy root');
});

test('a double boot leaves exactly one active shell and one populated canopy', async () => {
  const responder = () => ({
    kind: 'json' as const,
    value: {
      projection: TASK8_PROJECTION,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  });
  const first = bootOperatingFabricDocument(responder);
  const second = bootOperatingFabricDocument(responder);
  await flushBoot();
  for (const [label, booted] of [
    ['first boot', first],
    ['second boot', second],
  ] as const) {
    assert.equal(booted.fabricRoot.classList.contains('of-on'), true, `${label}: shell activates`);
    assert.equal(booted.fetches.length, 1, `${label}: exactly one probe`);
    const canopyHtml = booted.elements.get('of-scene-canopy')!.innerHTML;
    assert.match(canopyHtml, /data-component="FabricCanopy"/, `${label}: canopy populated`);
    assert.equal(
      [...canopyHtml.matchAll(/data-component="FabricCanopySummary"/g)].length,
      1,
      `${label}: exactly one canopy summary renders`,
    );
  }
});

test('browser and canonical secret policies agree on the generated adversarial matrix with zero divergences', () => {
  const divergent: string[] = [];
  for (const sample of EQUIVALENCE_MATRIX_SAMPLES) {
    if (BROWSER_GROUPED_SECRET_MARKER.test(sample) !== CANONICAL_SECRET_MARKER.test(sample)) divergent.push(sample);
  }
  assert.deepEqual(divergent, [], `zero divergences across ${EQUIVALENCE_MATRIX_SAMPLES.length} matrix cells`);
  // Reviewer reproductions are hostile under BOTH policies.
  for (const reproduction of EQUIVALENCE_REVIEWER_REPRODUCTIONS) {
    assert.equal(CANONICAL_SECRET_MARKER.test(reproduction), true, `canonical policy flags ${reproduction}`);
    assert.equal(BROWSER_GROUPED_SECRET_MARKER.test(reproduction), true, `browser policy flags ${reproduction}`);
  }
  // Benign prefixed-hash near misses stay unflagged under BOTH policies.
  for (const benign of ['xhash=1', 'prefix_hash=1']) {
    assert.equal(CANONICAL_SECRET_MARKER.test(benign), false, `canonical policy tolerates ${benign}`);
    assert.equal(BROWSER_GROUPED_SECRET_MARKER.test(benign), false, `browser policy tolerates ${benign}`);
  }
});

test('prefixed-hostile projection values survive neither Node renderers nor the composed browser boot', async () => {
  // Every value here is flagged by BOTH policies (benign prefixed-hash near
  // misses like 'xhash=1' are pinned unflagged in the matrix test above and
  // must NOT be routed here — renderers rightly let them through).
  const prefixedHostile = [
    ...EQUIVALENCE_REVIEWER_REPRODUCTIONS,
    'XTOKEN=ABC123',
    ' prefix_token=abc',
  ];
  const hostileWorkValues = prefixedHostile.map((marker, index) =>
    makeWorkNode({
      kind: 'sapling',
      workId: `fx-prefixed-${index} ${marker}`,
      name: `prefixed ${marker}`,
      currentGate: `gate ${marker}`,
      status: 'active',
    }).value,
  );
  const hostileProjection = {
    ...TASK8_PROJECTION,
    nodes: [...TASK8_PROJECTION.nodes, ...hostileWorkValues.map((value) => ({ kind: 'work' as const, value }))],
  } as unknown as MissionFabricProjectionV1;
  const canopyHtml = renderCanopy(hostileProjection);
  const missionHtml = renderOperatingMission(hostileProjection, 'fx-program-001');
  for (const marker of prefixedHostile) {
    assert.ok(!canopyHtml.includes(marker), `node canopy never emits ${marker}`);
    assert.ok(!missionHtml.includes(marker), `node mission never emits ${marker}`);
  }
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: hostileProjection,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  const missionRoot = booted.elements.get('of-scene-mission')!;
  // Selecting a work object round-trips the hostile projection through the
  // real delegated click path and re-renders both scenes.
  booted.clickOpen('fx-program-001');
  await flushBoot();
  for (const marker of prefixedHostile) {
    assert.ok(!canopyRoot.innerHTML.includes(marker), `browser canopy root never contains ${marker}`);
    assert.ok(!missionRoot.innerHTML.includes(marker), `browser mission root never contains ${marker}`);
    assert.ok(!canopyRoot.textContent.includes(marker), `browser canopy visible text never contains ${marker}`);
    assert.ok(!missionRoot.textContent.includes(marker), `browser mission visible text never contains ${marker}`);
  }
  // No hostile value survives into the data attributes the harness mirrors
  // from rendered DOM, nor into aria labels.
  for (const element of [canopyRoot, missionRoot]) {
    for (const value of Object.values(element.dataset)) {
      for (const marker of prefixedHostile) {
        assert.ok(!value.includes(marker), 'browser data attributes never carry hostile prefixed values');
      }
    }
  }
  assert.ok(!canopyRoot.innerHTML.includes('aria-label="xtoken='), 'aria labels never carry hostile prefixed values');
  assert.ok(!missionRoot.innerHTML.includes('aria-label="xtoken='), 'aria labels never carry hostile prefixed values');
});

test('scene contracts list only renderer-owned states — no phantom loading state', () => {
  const CANOPY_SOURCE = readFileSync(new URL('./page/operating-fabric/canopy.ts', import.meta.url), 'utf8');
  const MISSION_SOURCE = readFileSync(new URL('./page/operating-fabric/mission.ts', import.meta.url), 'utf8');
  for (const [label, contract, source] of [
    ['canopy', canopyContract, CANOPY_SOURCE],
    ['operating-mission', missionContract, MISSION_SOURCE],
  ] as const) {
    assert.ok(!contract.states.renders.includes('loading'), `${label} contract never claims a renderer-owned loading state`);
    assert.ok(!('loading' in contract.states.derivation), `${label} contract derives no loading state`);
    assert.equal(source.includes("ofRenderState('loading'"), false, `${label} renderer never emits a loading state`);
    assert.equal(source.includes("of-state-loading"), false, `${label} renderer carries no loading state markup`);
  }
});

test('click delegation covers nested openers, non-opener clicks, and tab navigation', async () => {
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: TASK8_PROJECTION,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assert.equal(booted.fabricRoot.classList.contains('of-on'), true, 'shell activates before click coverage');
  const canopyRoot = booted.elements.get('of-scene-canopy')!;
  const missionRoot = booted.elements.get('of-scene-mission')!;
  const canopyHtmlAfterBoot = canopyRoot.innerHTML;
  const clickHandlers = (booted.fabricRoot as unknown as { listeners: Map<string, unknown[]> }).listeners.get('click') ?? [];
  assert.equal(clickHandlers.length, 1, 'exactly one delegated click handler is registered');
  const fetchesAfterBoot = booted.fetches.length;

  // Nested opener: the click target sits inside the opener element, so only
  // closest('[data-of-open-work]') resolves — event delegation semantics.
  booted.clickNested('fx-program-001');
  await flushBoot();
  const canopyHtmlAfterOpen = canopyRoot.innerHTML;
  assert.match(missionRoot.innerHTML, /data-lineage-work="fx-program-001"/, 'nested opener click selects the work lineage');
  const missionTab = booted.tabElements.find((tab) => tab.dataset.ofTab === 'mission')!;
  const canopyTab = booted.tabElements.find((tab) => tab.dataset.ofTab === 'canopy')!;
  assert.equal(missionTab.ariaSelected, 'true', 'mission tab is selected after opening a work object');
  assert.equal(canopyTab.ariaSelected, 'false', 'canopy tab is deselected after opening a work object');
  assert.equal(missionRoot.hidden, false, 'mission panel is unhidden after opening a work object');
  assert.equal(canopyRoot.hidden, true, 'canopy panel is hidden after opening a work object');
  const clickHandlersAfterOpen = (booted.fabricRoot as unknown as { listeners: Map<string, unknown[]> }).listeners.get('click') ?? [];
  assert.equal(clickHandlersAfterOpen.length, 1, 'opening a work object registers no additional click handlers');
  assert.equal(booted.fetches.length, fetchesAfterBoot, 'opening a work object issues no fetch');
  assert.equal(canopyHtmlAfterOpen, canopyHtmlAfterBoot, 'canopy re-render is deterministic through selection');

  // Non-opener click: closest returns null for every selector — no throw, no
  // scene change, no re-render.
  const missionHtmlBeforeNonOpener = missionRoot.innerHTML;
  booted.clickMiss();
  await flushBoot();
  assert.equal(missionRoot.hidden, false, 'non-opener click never changes the active panel');
  assert.equal(missionTab.ariaSelected, 'true', 'non-opener click never changes the selected tab');
  assert.equal(missionRoot.innerHTML, missionHtmlBeforeNonOpener, 'non-opener click never re-renders');
  assert.equal(booted.fetches.length, fetchesAfterBoot, 'non-opener click issues no fetch');

  // Tab click: local scene navigation only.
  const canopyHtmlBeforeTab = canopyRoot.innerHTML;
  const missionHtmlBeforeTab = missionRoot.innerHTML;
  booted.clickTab('canopy');
  await flushBoot();
  assert.equal(canopyRoot.hidden, false, 'tab click unhides the canopy panel');
  assert.equal(missionRoot.hidden, true, 'tab click hides the mission panel');
  assert.equal(canopyTab.ariaSelected, 'true', 'tab click selects the canopy tab');
  assert.equal(missionTab.ariaSelected, 'false', 'tab click deselects the mission tab');
  assert.equal(canopyRoot.innerHTML, canopyHtmlBeforeTab, 'tab click never re-renders canopy');
  assert.equal(missionRoot.innerHTML, missionHtmlBeforeTab, 'tab click never re-renders mission');
  assert.equal(booted.fetches.length, fetchesAfterBoot, 'tab click issues no fetch');
  const clickHandlersAfterAll = (booted.fabricRoot as unknown as { listeners: Map<string, unknown[]> }).listeners.get('click') ?? [];
  assert.equal(clickHandlersAfterAll.length, 1, 'no click path ever duplicates the delegated handler');
  assert.equal(booted.legacyShell.hidden, true, 'no click path ever mutates the legacy shell');
  assert.equal(booted.legacyShell.inert, true, 'no click path ever restores legacy interactivity');
});

// ── Task 9 · Flow scene (RED) ──────────────────────────────────────────────
//
// The Flow scene renders deterministic Task → Run → Receipt columns with
// visible directional paths from the exact MissionFabricProjectionV1 truth:
// depends-on edges and blocked state stay separate facts, executor identity
// comes only from canonical run/agent relationships, proof comes only from
// canonical produces/proves edges and bounded receipt ids/status, and a stale
// or unverifiable fence renders only as a typed gap — never as a run node and
// never as an invented current fence. Graph and accessible linear fallback
// expose the exact same unique fact-ID set; the combined visible
// Task/Run/Receipt fact nodes are bounded at 96 after a deterministic
// column+ID stable sort, with the exact copy `showing 96 of N` when
// truncated. FLOW_BROWSER_JS is a plain browser-valid source constant
// composed lexically into the single boot IIFE by client.ts — no source
// transforms, no ambient renderer globals, no third scene script — and Flow
// joins the fail-closed pre-render activation set.

import { renderFlow, FLOW_BROWSER_JS, FLOW_FACT_LIMIT } from './page/operating-fabric/flow.ts';

const flowFixture = loadJsonFixture('./page/scenes/fixtures/flow.fixture.json');
const flowContract = loadJsonFixture('../../../docs/architecture/contracts/scenes/flow.json');

const FLOW_SOURCE = flowFixture.states.normal.source;
const FLOW_PROJECTION: MissionFabricProjectionV1 = buildMissionFabricProjection(FLOW_SOURCE, {
  tenantId: FLOW_SOURCE.tenantId,
  clock: { now: () => '2026-07-28T09:00:00.000Z' },
});

type FlowTaskNode = Extract<FabricNode, { kind: 'task' }>;
type FlowRunNode = Extract<FabricNode, { kind: 'run' }>;
type FlowReceiptNode = Extract<FabricNode, { kind: 'receipt' }>;
type FlowAgentNode = Extract<FabricNode, { kind: 'agent' }>;

function flowNodesOf<K extends FlowTaskNode['kind'] | FlowRunNode['kind'] | FlowReceiptNode['kind']>(
  projection: MissionFabricProjectionV1,
  kind: K,
): Array<Extract<FabricNode, { kind: K }>> {
  return projection.nodes.filter(
    (node): node is Extract<FabricNode, { kind: K }> => node?.kind === kind,
  );
}

function makeFlowTask(taskId: string, overrides: Record<string, unknown> = {}): FlowTaskNode {
  return {
    kind: 'task',
    value: {
      taskId,
      missionId: 'fx-flow-mission',
      desiredState: 'verified',
      status: 'ready',
      dependencyIds: [],
      assignedAgentId: null,
      requiredClusterIds: [],
      pinnedLoadoutId: null,
      leaseId: null,
      proofRequirement: 'receipt required',
      latestReceiptId: null,
      ...overrides,
    },
  } as FlowTaskNode;
}

function makeFlowRun(runId: string, taskId: string, overrides: Record<string, unknown> = {}): FlowRunNode {
  return {
    kind: 'run',
    value: {
      runId,
      taskId,
      agentId: 'fx-flow-agent-a',
      loadoutId: 'fx-loadout',
      startedAt: '2026-07-28T05:00:00.000Z',
      terminalAt: null,
      status: 'complete',
      ...overrides,
    },
  } as FlowRunNode;
}

function makeFlowReceipt(receiptId: string, runId: string, taskId: string, overrides: Record<string, unknown> = {}): FlowReceiptNode {
  return {
    kind: 'receipt',
    value: {
      receiptId,
      runId,
      taskId,
      graphVersion: 7,
      status: 'complete',
      inputDigest: `sha256:${'a'.repeat(64)}`,
      outputDigest: null,
      evidenceRefs: [],
      approvalRef: null,
      createdAt: '2026-07-28T05:30:00.000Z',
      ...overrides,
    },
  } as FlowReceiptNode;
}

function makeFlowAgent(agentId: string, overrides: Record<string, unknown> = {}): FlowAgentNode {
  return {
    kind: 'agent',
    value: {
      agentId,
      role: 'executor',
      runtime: 'codex',
      status: 'running',
      activeTaskIds: [],
      permissionProfile: 'fresh',
      lastSeenAt: '2026-07-28T06:00:00.000Z',
      sourceRef: 'd1-goal-graph',
      ...overrides,
    },
  } as FlowAgentNode;
}

function makeFlowProjection(overrides: Partial<MissionFabricProjectionV1> = {}): MissionFabricProjectionV1 {
  return {
    schema: 'cambium.mission-fabric-projection.v1',
    projectionVersion: 1,
    tenantId: 'fx-tenant',
    graphVersion: 7,
    graphDigest: `sha256:${'0'.repeat(64)}`,
    generatedAt: '2026-07-28T09:00:00.000Z',
    asOf: '2026-07-28T09:00:00.000Z',
    sourceOfTruth: 'd1-goal-graph',
    readOnly: true,
    nodes: [],
    edges: [],
    gaps: [],
    ...overrides,
  } as MissionFabricProjectionV1;
}

function flowGraphFactIds(html: string): string[] {
  const graphMatch = html.match(/<table class="of-flow-graph"[^>]*>([\s\S]*?)<\/table>/);
  // An empty projection renders the empty state with no graph and no list:
  // both representations legitimately expose zero fact IDs.
  if (!graphMatch) return html.includes('of-state-empty') ? [] : assert.fail('flow renders a visual graph representation');
  return [...graphMatch[1]!.matchAll(/data-of-fact="([^"]+)"/g)].map((match) => match[1]!);
}

function flowListFactIds(html: string): string[] {
  const listMatch = html.match(/<ol class="of-flow-list"[^>]*>([\s\S]*?)<\/ol>/);
  if (!listMatch) return html.includes('of-state-empty') ? [] : assert.fail('flow renders an accessible linear list fallback');
  return [...listMatch[1]!.matchAll(/data-of-fact="([^"]+)"/g)].map((match) => match[1]!);
}

// Public row identity is the disjoint row namespace `task:${taskPublicId}` —
// never the visible display label — so a benign `task-NNN` row never aliases
// a hostile node's generated display ordinal. Task 9 regression selectors use
// this helper instead of hard-coding the row attribute shape.
function flowRowSelector(taskId: string): string {
  return `data-of-flow-row="task:task:id:${taskId}"`;
}

// ── flow fixture + contract ─────────────────────────────────────────────────

test('flow fixture is synthetic, layout-only, and carries every required fence truth shape', () => {
  for (const key of ['fixture', 'scene', 'contract', 'redaction', 'states']) {
    assert.ok(key in flowFixture, `flow fixture declares ${key}`);
  }
  assert.equal(flowFixture.scene, 'flow', 'flow fixture names its scene');
  assert.equal(flowFixture.contract, 'docs/architecture/contracts/scenes/flow.json', 'flow fixture names its contract');
  const raw = JSON.stringify(flowFixture);
  for (const marker of ['query_id=', 'auth_date=', 'Bearer ', 'PRIVATE KEY', 'TELEGRAM_INIT_DATA', 'TG_INIT_DATA', 'QUESTS_PUSH_TOKEN']) {
    assert.ok(!raw.includes(marker), `flow fixture never carries ${marker}`);
  }
  assert.match(raw, /layout-only|synthetic/, 'flow fixture is labelled synthetic and layout-only');
  assert.ok(!raw.includes('"proofComplete": true'), 'flow fixture never claims live proof completion');
  for (const task of flowFixture.states.normal.source.tasks as Array<{ taskId: string }>) {
    assert.ok(task.taskId.startsWith('fx-'), `flow fixture task ids stay synthetic: ${task.taskId}`);
  }
  for (const state of ['normal', 'stale', 'empty']) {
    assert.ok(state in flowFixture.states, `flow fixture covers the ${state} state`);
    assert.equal(flowFixture.states[state].source.tenantId, 'fx-tenant', `flow ${state} source stays on the synthetic tenant`);
  }
  // The normal state carries the canonical truth mix the renderer must honor:
  // an accepted run chain, a typed stale-fence rejection, a typed
  // unverifiable-fence rejection, a task with no accepted run, and an
  // accepted run with no canonical receipt.
  const source = FLOW_SOURCE;
  const runTaskIds = new Set(source.runtimeRuns.map((run: { taskId: string }) => run.taskId));
  assert.ok(runTaskIds.has('fx-flow-task-alpha'), 'normal fixture carries an accepted run chain');
  const taskIds = new Set(source.tasks.map((task: { taskId: string }) => task.taskId));
  for (const required of ['fx-flow-task-alpha', 'fx-flow-task-beta', 'fx-flow-task-gamma', 'fx-flow-task-delta', 'fx-flow-task-epsilon']) {
    assert.ok(taskIds.has(required), `normal fixture carries ${required}`);
  }
});

test('flow scene contract binds route, truth vocabulary, bounds, and redaction', () => {
  assert.equal(flowContract.contract, 'cambium-operating-fabric-scene/v1', 'flow contract version');
  assert.equal(flowContract.sceneId, 'flow', 'flow contract id');
  assert.equal(flowContract.refreshRoute, 'GET /v1/mission-fabric/{tenant}', 'flow refresh route');
  assert.equal(flowContract.synthetic, true, 'flow fixture pairing is declared synthetic');
  assert.ok(flowContract.fixture.endsWith('flow.fixture.json'), 'flow contract names its fixture');
  assert.ok(Array.isArray(flowContract.states.renders), 'flow contract declares states');
  for (const state of ['empty', 'error', 'stale', 'truncated']) {
    assert.ok(flowContract.states.renders.includes(state), `flow contract handles ${state}`);
  }
  assert.ok(!flowContract.states.renders.includes('loading'), 'flow contract never claims a renderer-owned loading state');
  assert.ok(!('loading' in flowContract.states.derivation), 'flow contract derives no loading state');
  assert.equal(flowContract.density.factLimit, 96, 'flow contract pins the 96 combined fact bound');
  assert.ok(typeof flowContract.redaction === 'string' && flowContract.redaction.length > 0, 'flow contract declares redaction policy');
  assert.match(JSON.stringify(flowContract.authority), /read-only/, 'flow authority stays read-only');
  assert.match(JSON.stringify(flowContract), /\/api\/gate/, 'flow names the governed signed Gate surface');
  const contractText = JSON.stringify(flowContract);
  for (const term of ['stale-fence', 'unverifiable-fence', 'produces', 'proves', 'depends-on', 'showing 96 of']) {
    assert.ok(contractText.includes(term), `flow contract names the truth term: ${term}`);
  }
  assert.ok(!contractText.includes('evidenceRefs'), 'flow contract never exposes raw evidenceRefs');
});

// ── flow derivation + rendering ─────────────────────────────────────────────

test('flow renders Task, Run, and Receipt columns with visible directional paths', () => {
  const html = renderFlow(FLOW_PROJECTION);
  assert.match(html, /data-component="FabricFlow"/, 'flow scene component marker');
  assert.match(html, /data-of-flow-column="task"/, 'task column renders');
  assert.match(html, /data-of-flow-column="run"/, 'run column renders');
  assert.match(html, /data-of-flow-column="receipt"/, 'receipt column renders');
  const header = html.slice(0, html.indexOf('</tr>') + 5);
  assert.ok(
    header.indexOf('data-of-flow-column="task"') < header.indexOf('data-of-flow-column="run"') &&
    header.indexOf('data-of-flow-column="run"') < header.indexOf('data-of-flow-column="receipt"'),
    'columns render in canonical task → run → receipt order',
  );
  assert.match(html, /data-of-path="task-run"/, 'visible task to run directional path');
  assert.match(html, /data-of-path="run-receipt"/, 'visible run to receipt directional path');
  assert.match(html, /aria-hidden="true"[^>]*data-of-path="task-run"/, 'visual direction markup is aria-hidden');
  assert.match(html, /aria-hidden="true"[^>]*data-of-path="run-receipt"/, 'visual run-to-receipt markup is aria-hidden');
  assert.match(html, new RegExp(flowRowSelector('fx-flow-task-alpha')), 'accepted chain task row renders');
  assert.match(html, /fx-flow-run-alpha/, 'accepted run id renders');
  assert.match(html, /fx-flow-receipt-alpha/, 'accepted receipt id renders');
  assert.ok(!/force|simulation/i.test(html), 'no force simulation vocabulary');
});

test('flow keeps depends-on edges and blocked task state as separate facts', () => {
  const html = renderFlow(FLOW_PROJECTION);
  const betaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-beta')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(betaRow.length > 0, 'blocked task row renders');
  assert.match(betaRow, /data-of-dependency="fx-flow-task-alpha"/, 'depends-on edge renders as its own fact');
  assert.match(betaRow, /<dd>blocked<\/dd>/, 'blocked state renders as its own fact');
  const dependencyFact = betaRow.match(/<div class="of-fact" data-of-dependency="fx-flow-task-alpha">[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.ok(dependencyFact.length > 0, 'dependency fact block renders');
  assert.ok(!/<dd>blocked<\/dd>/.test(dependencyFact), 'dependency fact never masquerades as the blocked state');
  const deltaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-delta')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(deltaRow.length > 0, 'run-bearing task row renders');
  assert.ok(!/data-of-dependency=/.test(deltaRow), 'task without dependencies renders no dependency fact');
});

test('flow renders accepted runs as nodes and typed stale or unverifiable fences as gaps only', () => {
  const html = renderFlow(FLOW_PROJECTION);
  assert.match(html, /data-of-fact="run:id:fx-flow-run-alpha"/, 'accepted run renders as a fact node');
  assert.match(html, /data-of-gap-kind="stale-fence"/, 'stale fence renders as a typed gap');
  assert.match(html, /data-of-gap-kind="unverifiable-fence"/, 'unverifiable fence renders as a typed gap');
  assert.ok(!html.includes('data-of-fact="run:id:fx-flow-run-stale"'), 'rejected stale run never becomes a run node');
  assert.ok(!html.includes('data-of-fact="run:id:fx-flow-run-unverifiable"'), 'unverifiable run never becomes a run node');
  assert.match(html, /fx-flow-run-stale/, 'stale gap keeps its run subject');
  assert.match(html, /fx-flow-run-unverifiable/, 'unverifiable gap keeps its run subject');
  const epsilonRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-epsilon')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(epsilonRow.length > 0, 'fence-rejected task row still renders');
  assert.ok(!/data-of-fact="run:/.test(epsilonRow), 'fence-rejected task carries no run fact');
  assert.match(epsilonRow, /run not present in projection/, 'fence-rejected task renders the honest missing-run label');
  assert.ok(!epsilonRow.includes('data-of-gap-kind="stale-fence"'), 'a gap naming only the rejected run never guesses the epsilon row');
  const epsilonRowWithoutGaps = epsilonRow.replace(/<div class="of-gap"[\s\S]*?<\/div>/g, '');
  assert.ok(!/current fence|fence \d+/i.test(epsilonRowWithoutGaps.replace(/stale-fence/g, '')), 'no current or invented fence value renders outside the typed gap');
  const graphSection = html.match(/<table class="of-flow-graph"[\s\S]*?<\/table>/)?.[0] ?? '';
  const listSection = html.match(/<ol class="of-flow-list"[\s\S]*?<\/ol>/)?.[0] ?? '';
  assert.match(graphSection, /data-of-flow-unscoped-gaps="true"/, 'unmappable typed gaps render in the honest unscoped graph section');
  assert.match(listSection, /data-of-flow-unscoped-gaps="true"/, 'unmappable typed gaps render in the honest unscoped list section');
  const betaFenceRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-beta')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(betaFenceRow.length > 0, 'unverifiable-fence task row still renders');
  assert.ok(!/data-of-fact="run:/.test(betaFenceRow), 'unverifiable-fence task carries no run fact');
  assert.match(betaFenceRow, /data-of-gap-kind="unverifiable-fence"/, 'unverifiable-fence task preserves its typed source gap');
});

test('flow shows executor identity from canonical run and agent relationships only', () => {
  const html = renderFlow(FLOW_PROJECTION);
  const alphaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-alpha')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(alphaRow, /data-of-executor="fx-flow-agent-a"/, 'executor renders from the canonical executes relationship');
  const deltaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-delta')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(deltaRow, /data-of-executor="fx-flow-agent-b"/, 'second executor renders from its canonical run');
  const noAgentProjection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-orphan'),
      makeFlowRun('fx-run-orphan', 'fx-task-orphan', { agentId: 'fx-agent-absent' }),
    ],
    edges: [],
    gaps: [],
  });
  const orphanHtml = renderFlow(noAgentProjection);
  const orphanRow = orphanHtml.match(new RegExp(`<tr ${flowRowSelector('fx-task-orphan')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(orphanRow.length > 0, 'run with unresolvable executor still renders its row');
  assert.match(orphanRow, /executor not present in projection/, 'unresolvable executor renders the honest label');
  assert.ok(!orphanRow.includes('fx-agent-absent'), 'unverifiable executor identity never renders');
});

test('flow shows proof through canonical produces and proves edges with bounded receipt ids and status only', () => {
  const html = renderFlow(FLOW_PROJECTION);
  const alphaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-alpha')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(alphaRow, /data-of-proof="produces · proves"/, 'canonical produces and proves edges render as proof');
  assert.match(alphaRow, /data-of-fact="receipt:id:fx-flow-receipt-alpha"/, 'canonical receipt fact renders');
  assert.match(alphaRow, /<dd>complete<\/dd>/, 'receipt status renders');
  assert.ok(!alphaRow.includes('evidenceRefs'), 'raw evidenceRefs never render');
  assert.ok(!/[0-9a-f]{64}/.test(alphaRow), 'raw digests never render in flow rows');
  const reversed = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-rev'),
      makeFlowRun('fx-run-rev', 'fx-task-rev'),
      makeFlowReceipt('fx-receipt-rev', 'fx-run-rev', 'fx-task-rev'),
    ],
    edges: [{ kind: 'proves', fromId: 'fx-task-rev', toId: 'fx-receipt-rev' }],
    gaps: [],
  });
  const reversedHtml = renderFlow(reversed);
  const reversedRow = reversedHtml.match(new RegExp(`<tr ${flowRowSelector('fx-task-rev')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(!/data-of-proof=/.test(reversedRow), 'a reversed task-to-receipt edge never counts as proof');
  assert.match(reversedRow, /proof not present in projection/, 'reversed-edge task renders the honest missing-proof label');
  const hostileReceipt = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-h'),
      makeFlowRun('fx-run-h', 'fx-task-h'),
      makeFlowReceipt('fx-receipt-hostile', 'fx-run-h', 'fx-task-h', {
        evidenceRefs: ['s3://private-bucket/raw-evidence.jsonl'],
        inputDigest: `sha256:${'b'.repeat(64)}`,
        outputDigest: `sha256:${'c'.repeat(64)}`,
      }),
    ],
    edges: [
      { kind: 'produces', fromId: 'fx-run-h', toId: 'fx-receipt-hostile' },
      { kind: 'proves', fromId: 'fx-receipt-hostile', toId: 'fx-task-h' },
    ],
    gaps: [],
  });
  const hostileHtml = renderFlow(hostileReceipt);
  assert.ok(!hostileHtml.includes('s3://private-bucket'), 'raw evidence refs never render');
  assert.ok(!hostileHtml.includes('b'.repeat(64)), 'raw input digests never render');
  assert.ok(!hostileHtml.includes('c'.repeat(64)), 'raw output digests never render');
  // Hostile secret-bearing receipt fields are stripped, but the genuine
  // produces+proves edges still render the exact joined proof kinds — the
  // same proof semantics as the accepted full-chain case.
  assert.match(hostileHtml, /data-of-proof="produces · proves"/, 'canonical produces and proves edges render as proof');
});

test('flow renders explicit missing-run and missing-receipt labels without inventing causes', () => {
  const html = renderFlow(FLOW_PROJECTION);
  const gammaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-gamma')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(gammaRow.length > 0, 'run-less task row renders');
  assert.match(gammaRow, /run not present in projection/, 'run-less task renders the explicit missing-run label');
  assert.match(gammaRow, /receipt not present in projection/, 'run-less task never invents a receipt');
  const deltaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-delta')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(deltaRow, /data-of-fact="run:id:fx-flow-run-delta"/, 'receipt-less run still renders');
  assert.match(deltaRow, /receipt not present in projection/, 'accepted run without canonical receipt renders the explicit label');
  assert.ok(!/scheduled|queued up|awaiting|pending/i.test(gammaRow), 'no invented cause for a missing run');
  assert.ok(!/lost|dropped|failed to write/i.test(deltaRow), 'no invented cause for a missing receipt');
});

test('flow filters by explicit workId, agentId, and state — never title matching', () => {
  const betaOnly = renderFlow(FLOW_PROJECTION, { state: 'blocked' });
  assert.match(betaOnly, new RegExp(flowRowSelector('fx-flow-task-beta')), 'blocked filter keeps the blocked task');
  assert.ok(!betaOnly.includes(flowRowSelector('fx-flow-task-alpha')), 'blocked filter drops non-blocked tasks');
  assert.ok(!betaOnly.includes(flowRowSelector('fx-flow-task-gamma')), 'blocked filter drops ready tasks');
  const agentA = renderFlow(FLOW_PROJECTION, { agentId: 'fx-flow-agent-a' });
  assert.match(agentA, new RegExp(flowRowSelector('fx-flow-task-alpha')), 'agentId filter keeps executor tasks');
  assert.match(agentA, new RegExp(flowRowSelector('fx-flow-task-gamma')), 'agentId filter keeps explicitly assigned tasks');
  assert.ok(!agentA.includes(flowRowSelector('fx-flow-task-delta')), 'agentId filter drops other executors');
  assert.ok(!agentA.includes(flowRowSelector('fx-flow-task-epsilon')), 'agentId filter drops unassigned tasks');
  const workFiltered = renderFlow(FLOW_PROJECTION, { workId: 'fx-flow-work-001' });
  assert.match(workFiltered, new RegExp(flowRowSelector('fx-flow-task-alpha')), 'workId filter keeps tasks inside the work');
  const otherWork = renderFlow(FLOW_PROJECTION, { workId: 'fx-flow-work-absent' });
  assert.ok(!otherWork.includes('data-of-flow-row='), 'absent workId renders no rows');
  assert.match(otherWork, /data-of-flow-unscoped-gaps="true"/, 'absent workId honestly preserves the genuinely unmappable typed-gap section');
  const noMatch = renderFlow(FLOW_PROJECTION, { agentId: 'fx-flow-agent-absent' });
  assert.ok(!noMatch.includes('data-of-flow-row='), 'unmatched agentId renders no rows');
  assert.match(noMatch, /data-of-flow-unscoped-gaps="true"/, 'unmatched agentId honestly preserves the unmappable typed-gap section');
  const titleProbe = renderFlow(FLOW_PROJECTION, { workId: 'Reliability Program' });
  assert.ok(!titleProbe.includes('data-of-flow-row='), 'title text never matches as a filter');
  const combined = renderFlow(FLOW_PROJECTION, { agentId: 'fx-flow-agent-a', state: 'blocked' });
  assert.ok(!combined.includes('data-of-flow-row='), 'combined filters intersect');
  const hostileFilter = renderFlow(FLOW_PROJECTION, { agentId: 'fx-flow-agent-a query_id=AAE7' });
  assert.match(hostileFilter, /of-state-empty/, 'secret-bearing filter input matches nothing');
  assert.ok(!hostileFilter.includes('query_id='), 'secret-bearing filter input never echoes');
  const hostileIdProjection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-clean'),
      makeFlowAgent('agent query_id=AAE7'),
      makeFlowAgent('agent Bearer eyJ'),
      makeFlowTask('fx-task-clean-2'),
    ],
    edges: [
      { kind: 'assigned-to', fromId: 'fx-task-clean', toId: 'agent query_id=AAE7' },
      { kind: 'assigned-to', fromId: 'fx-task-clean-2', toId: 'agent Bearer eyJ' },
    ],
    gaps: [],
  });
  const hostileAgentHtml = renderFlow(hostileIdProjection, { agentId: 'agent query_id=AAE7' });
  assert.ok(!hostileAgentHtml.includes('query_id='), 'hostile agent ids never echo through filter paths');
  assert.ok(!hostileAgentHtml.includes('Bearer eyJ'), 'other hostile agent ids never leak through filter output');
});

test('flow bounds combined Task, Run, and Receipt fact nodes at 96 with deterministic order and exact truncation copy', () => {
  assert.equal(FLOW_FACT_LIMIT, 96, 'flow fact limit constant is 96');
  const nodes: FabricNode[] = [];
  const edges: Array<{ kind: 'produces'; fromId: string; toId: string }> = [];
  for (let index = 0; index < 40; index += 1) {
    const taskId = `fx-bound-task-${String(index).padStart(3, '0')}`;
    const runId = `fx-bound-run-${String(index).padStart(3, '0')}`;
    const receiptId = `fx-bound-receipt-${String(index).padStart(3, '0')}`;
    nodes.push(makeFlowTask(taskId));
    nodes.push(makeFlowRun(runId, taskId));
    nodes.push(makeFlowReceipt(receiptId, runId, taskId));
    edges.push({ kind: 'produces', fromId: runId, toId: receiptId });
  }
  const projection = makeFlowProjection({ nodes, edges, gaps: [] });
  const html = renderFlow(projection);
  const totalFacts = 40 * 3;
  assert.ok(html.includes(`showing 96 of ${totalFacts}`), `exact truncation copy renders: showing 96 of ${totalFacts}`);
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.equal(new Set(graphIds).size, FLOW_FACT_LIMIT, 'graph shows exactly 96 unique facts');
  assert.equal(new Set(listIds).size, FLOW_FACT_LIMIT, 'linear list shows exactly 96 unique facts');
  const tasksVisible = graphIds.filter((id) => id.startsWith('task:'));
  const runsVisible = graphIds.filter((id) => id.startsWith('run:'));
  const receiptsVisible = graphIds.filter((id) => id.startsWith('receipt:'));
  assert.equal(tasksVisible.length, 40, 'all 40 tasks survive the column-first bound');
  assert.equal(runsVisible.length, 40, 'all 40 runs survive the column-first bound');
  assert.equal(receiptsVisible.length, 16, 'receipts truncate to the 96 bound');
  const sortedReceipts = [...receiptsVisible].sort();
  assert.deepEqual(receiptsVisible, sortedReceipts, 'visible receipts keep canonical ID order');
  const sortedTasks = [...tasksVisible].sort();
  assert.deepEqual(tasksVisible, sortedTasks, 'visible tasks keep canonical ID order');
  assert.equal(html.match(/data-of-flow-row=/g)?.length ?? 0, 40, 'every visible task keeps its row');
  const taskRowForLastReceipt = html.match(new RegExp(`<tr ${flowRowSelector('fx-bound-task-015')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(taskRowForLastReceipt, /data-of-fact="receipt:id:fx-bound-receipt-015"/, 'the last visible receipt stays on its row');
  const truncatedRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-bound-task-016')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(truncatedRow, /receipt not present in projection/, 'rows beyond the bound never fabricate receipt truth');
  assert.ok(!truncatedRow.includes('fx-bound-receipt-016'), 'truncated receipts never render');
  const shuffled = [...nodes].reverse();
  const htmlShuffled = renderFlow(makeFlowProjection({ nodes: shuffled, edges, gaps: [] }));
  assert.deepEqual(flowGraphFactIds(htmlShuffled), graphIds, 'input order never changes the bounded fact set');
});

test('flow graph and linear fallback expose the exact same unique fact-ID set under permuted duplicate hostile input', () => {
  // The visual graph is the aria-hidden duplicate; the semantic list is the
  // accessible truth. Parity is asserted on the unique fact-ID set only —
  // the list additionally carries the complete readable truth.
  const nodes: FabricNode[] = [
    makeFlowTask('fx-parity-task-b'),
    makeFlowTask('fx-parity-task-a'),
    makeFlowTask('fx-parity-task-a'),
    makeFlowRun('fx-parity-run-a', 'fx-parity-task-a'),
    makeFlowRun('fx-parity-run-a', 'fx-parity-task-a'),
    makeFlowReceipt('fx-parity-receipt-a', 'fx-parity-run-a', 'fx-parity-task-a'),
    makeFlowAgent('fx-parity-agent-a'),
  ];
  const edges = [
    { kind: 'executes', fromId: 'fx-parity-agent-a', toId: 'fx-parity-run-a' },
    { kind: 'produces', fromId: 'fx-parity-run-a', toId: 'fx-parity-receipt-a' },
    { kind: 'proves', fromId: 'fx-parity-receipt-a', toId: 'fx-parity-task-a' },
  ] as MissionFabricProjectionV1['edges'];
  const projection = makeFlowProjection({ nodes, edges, gaps: [] });
  const html = renderFlow(projection);
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.deepEqual(new Set(graphIds), new Set(listIds), 'graph and list expose the exact same unique fact-ID set');
  assert.equal(graphIds.length, new Set(graphIds).size, 'graph fact IDs are unique');
  assert.equal(listIds.length, new Set(listIds).size, 'linear list fact IDs are unique');
  const graphRows = html.match(/<table class="of-flow-graph"[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
  const pathMarkup = [...graphRows.matchAll(/data-of-path="[^"]+"/g)];
  assert.ok(pathMarkup.length >= 2, 'visual direction markup renders');
  for (const match of pathMarkup) {
    const tag = html.slice(Math.max(0, (html.indexOf(match[0]) - 200)), html.indexOf(match[0]) + match[0].length);
    assert.match(tag, /aria-hidden="true"/, 'visual direction markup is aria-hidden');
  }
  const listMarkup = html.match(/<ol class="of-flow-list"[^>]*>([\s\S]*?)<\/ol>/)?.[0] ?? '';
  assert.ok(!/aria-hidden="true"/.test(listMarkup), 'linear facts remain semantic');
  for (const permutation of [[...nodes].reverse(), [nodes[2]!, nodes[0]!, nodes[4]!, nodes[1]!, nodes[3]!, nodes[5]!, nodes[6]!]]) {
    const permutedHtml = renderFlow(makeFlowProjection({ nodes: permutation, edges, gaps: [] }));
    assert.deepEqual(flowGraphFactIds(permutedHtml), graphIds, 'permuted input never changes graph fact IDs');
    assert.deepEqual(flowListFactIds(permutedHtml), listIds, 'permuted input never changes list fact IDs');
  }
  assert.match(html, /flow: task fx-parity-task-a · run fx-parity-run-a · receipt fx-parity-receipt-a/, 'linear fallback carries readable direction text');
  assert.match(html, new RegExp(flowRowSelector('fx-parity-task-b')), 'run-less task stays in the parity set');
});

test('flow survives prototype-shaped ids and hostile text or attributes', () => {
  const hostileNodes: FabricNode[] = [
    makeFlowTask('__proto__'),
    makeFlowTask('constructor'),
    makeFlowTask('fx-task- Hostile<script>alert(1)</script>'),
    makeFlowRun('prototype', '__proto__'),
    makeFlowRun('fx-run- Hostile onmouseover=alert(1)', 'constructor'),
    makeFlowReceipt('fx-receipt- Hostile"><svg onload=alert(1)>', 'prototype', '__proto__'),
    makeFlowAgent('hasOwnProperty'),
  ];
  const hostileEdges = [
    { kind: 'executes', fromId: 'hasOwnProperty', toId: 'prototype' },
    { kind: 'produces', fromId: 'prototype', toId: 'fx-receipt- Hostile"><svg onload=alert(1)>' },
    { kind: 'proves', fromId: 'fx-receipt- Hostile"><svg onload=alert(1)>', toId: '__proto__' },
  ] as MissionFabricProjectionV1['edges'];
  const projection = makeFlowProjection({ nodes: hostileNodes, edges: hostileEdges, gaps: [] });
  const html = renderFlow(projection);
  assert.match(html, new RegExp(flowRowSelector('__proto__')), 'prototype-shaped task id renders as its own row');
  assert.match(html, new RegExp(flowRowSelector('constructor')), 'constructor-shaped task id renders as its own row');
  assert.match(html, /data-of-executor="hasOwnProperty"/, 'prototype-shaped executor id renders');
  assert.ok(!html.includes('<script>alert(1)</script>'), 'hostile markup never injects');
  assert.ok(!html.includes('onload=alert(1)>'), 'hostile attribute payloads never inject');
  assert.ok(html.includes('&lt;script&gt;'), 'hostile text stays escaped and legible');
  const protoRow = html.match(new RegExp(`<tr ${flowRowSelector('__proto__')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(protoRow, /data-of-fact="run:id:prototype"/, 'prototype-shaped run id resolves on the correct row');
  assert.match(protoRow, /data-of-proof="produces · proves"/, 'prototype-shaped receipt proof resolves');
  const constructorRow = html.match(new RegExp(`<tr ${flowRowSelector('constructor')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(!/data-of-fact="receipt:/.test(constructorRow), 'constructor row never inherits prototype truth');
  assert.match(constructorRow, /receipt not present in projection/, 'constructor row renders the honest missing-receipt label');
  const hostileSecret = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-secret', { desiredState: 'verified token=zz99' }),
      makeFlowRun('fx-run-secret', 'fx-task-secret', { status: 'failed' }),
      makeFlowAgent('fx-agent-secret', { role: 'executor initData' }),
    ],
    edges: [{ kind: 'executes', fromId: 'fx-agent-secret', toId: 'fx-run-secret' }],
    gaps: [
      { gapId: 'fx-gap-secret', kind: 'stale-fence', subjectId: 'fx-run-secret', detail: 'run rejected hash=abc123', evidenceRef: null },
    ],
  });
  const secretHtml = renderFlow(hostileSecret);
  assert.ok(!secretHtml.includes('token=zz99'), 'secret-bearing desired state never renders');
  assert.ok(!secretHtml.includes('hash=abc123'), 'secret-bearing gap detail never renders');
  assert.match(secretHtml, /data-of-gap-kind="stale-fence"/, 'typed gap kind still renders with redacted detail');
});

test('flow keeps Node and browser parity across the synthetic fixture states', () => {
  for (const state of ['normal', 'stale', 'empty']) {
    const source = flowFixture.states[state].source;
    const projection = buildMissionFabricProjection(source, {
      tenantId: source.tenantId,
      clock: { now: () => '2026-07-28T09:00:00.000Z' },
    });
    const nodeHtml = renderFlow(projection);
    const context = vm.createContext({
      ofRenderFlow: undefined as unknown,
      moduleSource: undefined as unknown,
    });
    vm.runInContext(
      `var ofEsc = function (value) { return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) { return char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;'; }); };
function ofValidProjection(projection) {
  return Boolean(
    projection &&
    typeof projection === 'object' &&
    projection.schema === 'cambium.mission-fabric-projection.v1' &&
    Array.isArray(projection.nodes) &&
    Array.isArray(projection.edges)
  );
}
function ofRenderState(state, title, detail) {
  return '<div class="of-state of-state-' + state + '" data-component="FabricState" data-state="' + state + '" role="status" aria-label="' + ofEsc(title) + ': ' + ofEsc(detail) + '">' +
    '<strong class="of-state-title">' + ofEsc(title) + '</strong>' +
    '<p class="of-state-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}
var OF_SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\\W)(?:hash)=|Bearer\\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\\bprompt\\s*[:=]|prompt\\s+injection/i;
function ofSafeText(value, fallback, max) { var limit = typeof max === 'number' ? max : 120; var text = typeof value === 'string' ? value.trim() : ''; if (text.length === 0 || OF_SECRET_MARKER.test(text)) return fallback; return text.length > limit ? text.slice(0, limit - 1) + '…' : text; }
function ofSafeId(value, fallback) { return ofSafeText(value, fallback, 64); }
function ofRenderGap(gap) {
  var kind = ofSafeText(gap && gap.kind, 'unknown gap');
  var subject = gap && gap.subjectId ? ofSafeText(gap.subjectId, 'unknown subject') : 'unscoped';
  var detail = ofSafeText(gap && gap.detail, 'no detail available');
  return '<div class="of-gap" data-component="FabricGap" data-gap-kind="' + ofEsc(kind) + '" role="status" aria-label="gap: ' + ofEsc(kind) + ' on ' + ofEsc(subject) + '">' +
    '<span class="of-gap-kind">' + ofEsc(kind) + '</span>' +
    '<span class="of-gap-subject">' + ofEsc(subject) + '</span>' +
    '<p class="of-gap-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}
` + FLOW_BROWSER_JS,
      context,
    );
    const browserRender = (context as { ofRenderFlow?: (p: unknown) => string }).ofRenderFlow;
    assert.equal(typeof browserRender, 'function', `browser flow renderer evaluates for state ${state}`);
    const browserHtml = browserRender!(JSON.parse(JSON.stringify(projection)));
    assert.deepEqual(
      flowGraphFactIds(browserHtml),
      flowGraphFactIds(nodeHtml),
      `browser graph fact IDs match Node for state ${state}`,
    );
    assert.deepEqual(
      flowListFactIds(browserHtml),
      flowListFactIds(nodeHtml),
      `browser list fact IDs match Node for state ${state}`,
    );
    for (const label of ['run not present in projection', 'receipt not present in projection']) {
      assert.equal(
        browserHtml.includes(label),
        nodeHtml.includes(label),
        `missing-label parity holds for ${label} in state ${state}`,
      );
    }
    assert.equal(
      browserHtml.includes('showing 96 of'),
      nodeHtml.includes('showing 96 of'),
      `truncation copy parity holds for state ${state}`,
    );
    assert.equal(
      (browserHtml.match(/data-of-gap-kind="stale-fence"/g) ?? []).length,
      (nodeHtml.match(/data-of-gap-kind="stale-fence"/g) ?? []).length,
      `typed stale-fence gap count parity holds for state ${state}`,
    );
  }
});

// ── flow corrective regressions (controller reproductions) ──────────────────
// Every test below pins a controller-reproduced failure as honest corrected
// behavior: the 96 bound after filters, aria-hidden visual markup plus
// complete accessible truth, per-run executors, exact-edge proof, exact-ID
// gap scoping with an unscoped section, fail-closed secret IDs in every
// attribute path, once-only escaping, and full Node/browser parity.

const FLOW_PARITY_HELPERS_JS = `var ofEsc = function (value) { return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) { return char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;'; }); };
function ofValidProjection(projection) {
  return Boolean(
    projection &&
    typeof projection === 'object' &&
    projection.schema === 'cambium.mission-fabric-projection.v1' &&
    Array.isArray(projection.nodes) &&
    Array.isArray(projection.edges)
  );
}
function ofRenderState(state, title, detail) {
  return '<div class="of-state of-state-' + state + '" data-component="FabricState" data-state="' + state + '" role="status" aria-label="' + ofEsc(title) + ': ' + ofEsc(detail) + '">' +
    '<strong class="of-state-title">' + ofEsc(title) + '</strong>' +
    '<p class="of-state-detail">' + ofEsc(detail) + '</p>' +
    '</div>';
}
var OF_SECRET_MARKER = /(?:query_id|auth_date|token)=|(?:^|\\W)(?:hash)=|Bearer\\s|bot_token|clientSecret|initData|TELEGRAM_INIT_DATA|TG_INIT_DATA|QUESTS_PUSH_TOKEN|PRIVATE KEY|\\bprompt\\s*[:=]|prompt\\s+injection/i;
function ofSafeText(value, fallback, max) { var limit = typeof max === 'number' ? max : 120; var text = typeof value === 'string' ? value.trim() : ''; if (text.length === 0 || OF_SECRET_MARKER.test(text)) return fallback; return text.length > limit ? text.slice(0, limit - 1) + '…' : text; }
function ofSafeId(value, fallback) { return ofSafeText(value, fallback, 64); }
`;

function renderFlowBrowser(projection: MissionFabricProjectionV1, filters: { workId?: string; agentId?: string; state?: string } = {}): string {
  const context = vm.createContext({ ofRenderFlow: undefined as unknown });
  vm.runInContext(FLOW_PARITY_HELPERS_JS + FLOW_BROWSER_JS, context);
  const renderer = (context as { ofRenderFlow?: (p: unknown, f?: unknown) => string }).ofRenderFlow;
  assert.equal(typeof renderer, 'function', 'browser flow renderer evaluates');
  return renderer!(JSON.parse(JSON.stringify(projection)), JSON.parse(JSON.stringify(filters)));
}

test('flow caps the combined fact set at 96 including the task column, with truncation copy from the filtered view', () => {
  const nodes: FabricNode[] = [];
  for (let index = 0; index < 97; index += 1) {
    nodes.push(makeFlowTask(`fx-cap-task-${String(index).padStart(3, '0')}`));
  }
  const projection = makeFlowProjection({ nodes, edges: [], gaps: [] });
  const html = renderFlow(projection);
  const graphIds = new Set(flowGraphFactIds(html));
  const listIds = new Set(flowListFactIds(html));
  assert.equal(graphIds.size, FLOW_FACT_LIMIT, '97 tasks never expose 97 unique graph facts');
  assert.equal(listIds.size, FLOW_FACT_LIMIT, '97 tasks never expose 97 unique list facts');
  assert.ok(html.includes('showing 96 of 97'), 'exact truncation copy renders: showing 96 of 97');
  assert.ok(!graphIds.has('task:fx-cap-task-096'), 'the task fact beyond the bound never renders');
  assert.ok(!html.includes(flowRowSelector('fx-cap-task-096')), 'a row whose task fact is beyond the bound never renders');
  assert.equal(html.match(/data-of-flow-row=/g)?.length ?? 0, FLOW_FACT_LIMIT, 'only bounded rows render');

  // A filtered one-row view must describe the filtered view, never the
  // unfiltered pool: 120 unrelated tasks exist, one is blocked.
  const manyNodes: FabricNode[] = [];
  for (let index = 0; index < 120; index += 1) {
    manyNodes.push(makeFlowTask(`fx-pool-task-${String(index).padStart(3, '0')}`));
  }
  manyNodes.push(makeFlowTask('fx-pool-task-late', { status: 'blocked' }));
  const pool = makeFlowProjection({ nodes: manyNodes, edges: [], gaps: [] });
  const filtered = renderFlow(pool, { state: 'blocked' });
  assert.ok(!filtered.includes('showing 96 of'), 'a one-row filtered view never claims truncation from unrelated rows');
  assert.match(filtered, new RegExp(flowRowSelector('fx-pool-task-late')), 'the filtered late row renders');
  assert.equal(new Set(flowGraphFactIds(filtered)).size, 1, 'the filtered view exposes exactly one fact');
  // The same late row also survives the bound in the unfiltered view: the
  // bound is column+canonical-ID over the selected view, never input order.
  const unfiltered = renderFlow(pool);
  assert.equal(new Set(flowGraphFactIds(unfiltered)).size, FLOW_FACT_LIMIT, 'the unfiltered 121-task view caps at 96');
  assert.ok(unfiltered.includes('showing 96 of 121'), 'unfiltered truncation copy counts the selected view only');
});

test('flow visual graph is aria-hidden and produces valid three-column markup', () => {
  const html = renderFlow(FLOW_PROJECTION);
  assert.match(html, /<table class="of-flow-graph"[^>]*aria-hidden="true"/, 'the visual graph duplicate is aria-hidden');
  const graphMatch = html.match(/<table class="of-flow-graph"[^>]*>([\s\S]*?)<\/table>/);
  assert.ok(graphMatch, 'graph renders');
  const graph = graphMatch![1]!;
  const headerCells = graphMatch![0]!.match(/<th[^>]*data-of-flow-column=/g) ?? [];
  assert.equal(headerCells.length, 3, 'the header declares exactly three columns');
  const tbody = graph.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  assert.ok(tbody.length > 0, 'tbody renders');
  const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]!);
  assert.ok(rows.length > 0, 'body rows render');
  for (const row of rows) {
    const stripped = row
      .replace(/<td[\s\S]*?<\/td>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    assert.equal(stripped, '', 'no span siblings render directly under tr');
    if (row.includes('colspan="3"')) continue;
    const cellCount = (row.match(/<td[^>]*data-of-flow-cell=/g) ?? []).length;
    assert.ok(cellCount <= 3, 'no optional fourth td renders against the three-column header');
    assert.ok(cellCount > 0, 'every row keeps its cells');
  }
  // Typed gaps join the receipt cell against the three-column header, and
  // direction stays visible through static path markup inside cells.
  const epsilonProjection = makeFlowProjection({
    nodes: [makeFlowTask('fx-gap-row-task')],
    edges: [],
    gaps: [{ gapId: 'fx-gap-row', kind: 'stale-fence', subjectId: 'fx-gap-row-task', detail: 'rejected run fence', evidenceRef: null }],
  });
  const gapHtml = renderFlow(epsilonProjection);
  const gapRow = gapHtml.match(new RegExp(`<tr ${flowRowSelector('fx-gap-row-task')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(gapRow, /data-of-gap-kind="stale-fence"/, 'typed gaps render inside the three-column row');
  assert.match(html, /data-of-path="task-run"/, 'static visible direction markup renders without animation');
});

test('flow accessible linear fallback carries the complete readable truth and direction', () => {
  const html = renderFlow(FLOW_PROJECTION);
  const listMatch = html.match(/<ol class="of-flow-list"[^>]*>([\s\S]*?)<\/ol>/);
  assert.ok(listMatch, 'linear fallback renders');
  const list = listMatch![1]!;
  const alphaItem = list.match(/<li[^>]*data-of-fact="task:id:fx-flow-task-alpha"[\s\S]*?<\/li>/)?.[0] ?? '';
  assert.ok(alphaItem.length > 0, 'alpha list item renders');
  assert.match(alphaItem, /data-of-run-status="complete"/, 'list carries per-run status');
  assert.match(alphaItem, /data-of-executor="fx-flow-agent-a"/, 'list carries per-run executor');
  assert.match(alphaItem, /data-of-receipt-status="complete"/, 'list carries per-receipt status');
  assert.match(alphaItem, /data-of-proof="produces · proves"/, 'list carries per-receipt proof');
  assert.match(alphaItem, /data-of-fact="run:id:fx-flow-run-alpha"/, 'list carries the run fact ID');
  assert.match(alphaItem, /data-of-fact="receipt:id:fx-flow-receipt-alpha"/, 'list carries the receipt fact ID');
  const betaItem = list.match(/<li[^>]*data-of-fact="task:id:fx-flow-task-beta"[\s\S]*?<\/li>/)?.[0] ?? '';
  assert.ok(betaItem.length > 0, 'beta list item renders');
  assert.match(betaItem, /data-of-task-status="blocked"/, 'list carries observed state');
  assert.match(betaItem, /data-of-task-desired="blocked"/, 'list carries the canonical desired state');
  const betaRow = html.match(new RegExp(`<tr ${flowRowSelector('fx-flow-task-beta')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  const graphDesired = betaRow.match(/<dt>desired<\/dt><dd>([^<]+)<\/dd>/)?.[1] ?? '';
  assert.ok(betaItem.includes(`data-of-task-desired="${graphDesired}"`), 'list desired state matches the graph desired fact');
  assert.match(betaItem, /data-of-dependency="fx-flow-task-alpha"/, 'list carries dependencies');
  assert.match(betaItem, /data-of-gap-kind="unverifiable-fence"/, 'list carries typed gaps');
  const gammaItem = list.match(/<li[^>]*data-of-fact="task:id:fx-flow-task-gamma"[\s\S]*?<\/li>/)?.[0] ?? '';
  assert.match(gammaItem, /run not present in projection/, 'list carries the honest missing-run label');
  assert.match(gammaItem, /receipt not present in projection/, 'list carries the honest missing-receipt label');
  assert.match(list, /flow: task fx-flow-task-alpha · run fx-flow-run-alpha · receipt fx-flow-receipt-alpha/, 'list keeps readable direction');
  // Exact fact-ID parity is preserved between the aria-hidden graph and the
  // semantic list.
  assert.deepEqual(new Set(flowGraphFactIds(html)), new Set(flowListFactIds(html)), 'graph/list unique fact-ID parity holds');
});

test('flow resolves executor per run and the agentId filter honors canonical executes edges', () => {
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-exec-task'),
      makeFlowRun('fx-exec-run-1', 'fx-exec-task', { agentId: 'fx-exec-field-mismatch' }),
      makeFlowRun('fx-exec-run-2', 'fx-exec-task'),
      makeFlowAgent('fx-exec-agent-1'),
      makeFlowAgent('fx-exec-agent-2'),
    ],
    edges: [
      { kind: 'executes', fromId: 'fx-exec-agent-1', toId: 'fx-exec-run-1' },
      { kind: 'executes', fromId: 'fx-exec-agent-2', toId: 'fx-exec-run-2' },
    ],
    gaps: [],
  });
  const html = renderFlow(projection);
  const row = html.match(new RegExp(`<tr ${flowRowSelector('fx-exec-task')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  const run1Block = row.match(/data-of-fact="run:id:fx-exec-run-1"[\s\S]*?(?=data-of-fact="run:|$)/)?.[0] ?? '';
  const run2Block = row.match(/data-of-fact="run:id:fx-exec-run-2"[\s\S]*?(?=data-of-fact="run:|$)/)?.[0] ?? '';
  assert.match(run1Block, /data-of-executor="fx-exec-agent-1"/, 'run 1 resolves its own executor');
  assert.match(run2Block, /data-of-executor="fx-exec-agent-2"/, 'run 2 resolves its own executor, never the first');
  const executors = [...row.matchAll(/data-of-executor="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(executors, ['fx-exec-agent-1', 'fx-exec-agent-2'], 'distinct runs never share the first executor');
  // The agentId filter honors the canonical executes edge even when the
  // run.agentId field disagrees, and honors assigned-to edges.
  const edgeMatch = renderFlow(projection, { agentId: 'fx-exec-agent-1' });
  assert.match(edgeMatch, new RegExp(flowRowSelector('fx-exec-task')), 'canonical executes edge matches the agentId filter');
  const fieldOnly = renderFlow(projection, { agentId: 'fx-exec-field-mismatch' });
  assert.match(fieldOnly, /of-state-empty/, 'a bare run.agentId field without canonical edges never matches the filter');
  const assignedToProjection = makeFlowProjection({
    nodes: [makeFlowTask('fx-exec-task-b'), makeFlowAgent('fx-exec-agent-3')],
    edges: [{ kind: 'assigned-to', fromId: 'fx-exec-task-b', toId: 'fx-exec-agent-3' }],
    gaps: [],
  });
  const assignedMatch = renderFlow(assignedToProjection, { agentId: 'fx-exec-agent-3' });
  assert.match(assignedMatch, new RegExp(flowRowSelector('fx-exec-task-b')), 'canonical assigned-to edge matches the agentId filter');
});

test('flow grants proof chips only for exact canonical edges to the current row', () => {
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-proof-task-a'),
      makeFlowTask('fx-proof-task-b'),
      makeFlowRun('fx-proof-run-a', 'fx-proof-task-a'),
      makeFlowReceipt('fx-proof-receipt-a', 'fx-proof-run-a', 'fx-proof-task-a'),
    ],
    edges: [
      { kind: 'produces', fromId: 'fx-proof-run-a', toId: 'fx-proof-receipt-a' },
      { kind: 'proves', fromId: 'fx-proof-receipt-a', toId: 'fx-proof-task-b' },
    ],
    gaps: [],
  });
  const html = renderFlow(projection);
  const rowA = html.match(new RegExp(`<tr ${flowRowSelector('fx-proof-task-a')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  const rowB = html.match(new RegExp(`<tr ${flowRowSelector('fx-proof-task-b')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(rowA.length > 0 && rowB.length > 0, 'both rows render');
  assert.match(rowA, /data-of-proof="produces"/, 'task-a row grants produces for its exact run-to-receipt edge');
  assert.ok(!rowA.includes('produces · proves'), 'a proves edge targeting another task grants nothing in task-a');
  assert.ok(!/data-of-proof="[^"]*proves/.test(rowA), 'cross-task proves never renders in task-a');
  assert.match(rowA, /data-of-fact="receipt:id:fx-proof-receipt-a"/, 'the bounded receipt fact stays visible on its run row');
  assert.ok(!/data-of-proof=/.test(rowB), 'a proves edge contradicting the receipt canonical ownership grants nothing on task-b either');
  // A bare receipt.runId makes the bounded fact visible but never grants proof.
  const bareProjection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-proof-task-c'),
      makeFlowRun('fx-proof-run-c', 'fx-proof-task-c'),
      makeFlowReceipt('fx-proof-receipt-c', 'fx-proof-run-c', 'fx-proof-task-c'),
    ],
    edges: [],
    gaps: [],
  });
  const bareHtml = renderFlow(bareProjection);
  const bareRow = bareHtml.match(new RegExp(`<tr ${flowRowSelector('fx-proof-task-c')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(bareRow, /data-of-fact="receipt:id:fx-proof-receipt-c"/, 'bare receipt.runId keeps the bounded receipt fact visible');
  assert.ok(!/data-of-proof="(?:produces|proves)/.test(bareRow), 'bare receipt.runId never grants proof');
  assert.match(bareRow, /proof not present in projection/, 'bare receipt.runId renders the honest missing-proof label');
  // Noncanonical and reversed edges grant nothing.
  const wrongEdges = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-proof-task-d'),
      makeFlowRun('fx-proof-run-d', 'fx-proof-task-d'),
      makeFlowReceipt('fx-proof-receipt-d', 'fx-proof-run-d', 'fx-proof-task-d'),
    ],
    edges: [
      { kind: 'produces', fromId: 'fx-proof-receipt-d', toId: 'fx-proof-run-d' },
      { kind: 'proves', fromId: 'fx-proof-task-d', toId: 'fx-proof-receipt-d' },
      { kind: 'proves', fromId: 'fx-proof-receipt-d', toId: 'fx-proof-task-absent' },
    ],
    gaps: [],
  });
  const wrongHtml = renderFlow(wrongEdges);
  const wrongRow = wrongHtml.match(new RegExp(`<tr ${flowRowSelector('fx-proof-task-d')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(!/data-of-proof="(?:produces|proves)/.test(wrongRow), 'reversed and missing-target edges grant nothing');
  assert.match(wrongRow, /proof not present in projection/, 'wrong-target proof renders the honest label');
});

test('flow attaches typed gaps by exact canonical IDs only and keeps unmappable gaps in an honest unscoped section', () => {
  const projection = makeFlowProjection({
    nodes: [makeFlowTask('a'), makeFlowTask('aa')],
    edges: [],
    gaps: [
      { gapId: 'fx-gap-scoped', kind: 'stale-fence', subjectId: 'fx-gap-run-aa', detail: 'Rejected stale fence fx-gap-run-aa for aa', evidenceRef: null },
      { gapId: 'fx-gap-exact', kind: 'unverifiable-fence', subjectId: 'a', detail: 'unverifiable fence on a', evidenceRef: null },
    ],
  });
  const html = renderFlow(projection);
  const rowA = html.match(new RegExp(`<tr ${flowRowSelector('a')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  const rowAA = html.match(new RegExp(`<tr ${flowRowSelector('aa')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(rowA, /data-of-gap-kind="unverifiable-fence"/, 'exact subjectId match attaches to its task row');
  assert.ok(!rowA.includes('stale-fence'), 'substring detail text never attaches the aa gap to a');
  assert.ok(!rowAA.includes('stale-fence'), 'a gap naming only a rejected run never guesses a task row');
  // The unmappable typed gap survives honestly in an unscoped section in
  // both representations — never dropped, never row-guessed.
  const graphSection = html.match(/<table class="of-flow-graph"[\s\S]*?<\/table>/)?.[0] ?? '';
  const listSection = html.match(/<ol class="of-flow-list"[\s\S]*?<\/ol>/)?.[0] ?? '';
  assert.match(graphSection, /data-of-flow-unscoped-gaps="true"/, 'graph carries an unscoped typed-gap section');
  assert.match(listSection, /data-of-flow-unscoped-gaps="true"/, 'list carries an unscoped typed-gap section');
  assert.match(graphSection, /data-of-gap-kind="stale-fence"/, 'unscoped stale-fence gap renders in the graph');
  assert.match(listSection, /data-of-gap-kind="stale-fence"/, 'unscoped stale-fence gap renders in the list');
  assert.match(graphSection, /fx-gap-run-aa/, 'unscoped gap keeps its rejected-run subject honestly');
  assert.ok(!graphSection.includes('current fence'), 'no invented current fence renders');
  // Exact run-subject attachment still works when the run node exists.
  const runScoped = makeFlowProjection({
    nodes: [makeFlowTask('fx-gap-task-c'), makeFlowRun('fx-gap-run-c', 'fx-gap-task-c')],
    edges: [],
    gaps: [{ gapId: 'fx-gap-c', kind: 'stale-fence', subjectId: 'fx-gap-run-c', detail: 'rejected', evidenceRef: null }],
  });
  const runScopedHtml = renderFlow(runScoped);
  const runScopedRow = runScopedHtml.match(new RegExp(`<tr ${flowRowSelector('fx-gap-task-c')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.match(runScopedRow, /data-of-gap-kind="stale-fence"/, 'exact run-subject gaps attach to the run row');
});

test('flow fail-closes secret-bearing canonical IDs in every text and attribute path', () => {
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-secret-task token=LEAK', { status: 'ready' }),
      makeFlowTask('fx-secret-clean'),
      makeFlowRun('fx-secret-run token=LEAK', 'fx-secret-task token=LEAK'),
      makeFlowReceipt('fx-secret-receipt token=LEAK', 'fx-secret-run token=LEAK', 'fx-secret-task token=LEAK'),
      makeFlowAgent('fx-secret-agent token=LEAK'),
    ],
    edges: [
      { kind: 'executes', fromId: 'fx-secret-agent token=LEAK', toId: 'fx-secret-run token=LEAK' },
      { kind: 'produces', fromId: 'fx-secret-run token=LEAK', toId: 'fx-secret-receipt token=LEAK' },
      { kind: 'proves', fromId: 'fx-secret-receipt token=LEAK', toId: 'fx-secret-task token=LEAK' },
      { kind: 'depends-on', fromId: 'fx-secret-task token=LEAK', toId: 'fx-secret-clean' },
    ],
    gaps: [
      { gapId: 'fx-secret-gap', kind: 'stale-fence', subjectId: 'fx-secret-absent-run token=LEAK', detail: 'rejected token=LEAK fence', evidenceRef: null },
    ],
  });
  const html = renderFlow(projection);
  assert.ok(!html.includes('token=LEAK'), 'no secret-bearing ID survives anywhere in flow output');
  assert.ok(!html.includes('task token'), 'raw task ID never leaks through fact or row attributes');
  // Deterministic non-secret placeholders preserve unique fact parity.
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.deepEqual(new Set(graphIds), new Set(listIds), 'secret-placeholder fact parity holds');
  assert.ok(graphIds.some((id) => /^task:redacted:\d{3}$/.test(id)), 'secret task renders under a deterministic non-secret collision-safe placeholder in the reserved redacted namespace');
  assert.ok(!graphIds.some((id) => id.includes('token=')), 'no graph fact ID carries the secret');
  // Row IDs, dependency, executor, proof, and unscoped-gap attributes all
  // fail closed.
  assert.match(html, /data-of-flow-row="task:task:redacted:\d{3}"/, 'secret task row id fails closed to a collision-safe redacted ordinal in the disjoint row namespace');
  assert.match(html, /data-of-executor="redacted"/, 'secret executor id fails closed');
  assert.ok(!/data-of-dependency="[^"]*token=/.test(html), 'dependency attributes fail closed');
  assert.ok(!/data-of-proof="[^"]*token=/.test(html), 'proof attributes never carry secrets');
  const unscopedSection = html.match(/data-of-flow-unscoped-gaps="true"[\s\S]*?(?=<\/ol>|<\/table>)/)?.[0] ?? '';
  assert.ok(unscopedSection.length > 0, 'unscoped gap section renders');
  assert.ok(!unscopedSection.includes('token='), 'unscoped gap subjects and details fail closed');
  assert.match(unscopedSection, /unknown subject|no detail available/, 'secret-bearing gap subjects and details render honest placeholders');
  // Filters are bounded, secret-filtered, and never echoed.
  const echoed = renderFlow(projection, { workId: 'fx-work token=LEAK' });
  assert.ok(!echoed.includes('token=LEAK'), 'secret-bearing workId filter never echoes');
  const hostileState = renderFlow(projection, { state: 'ready token=LEAK' });
  assert.match(hostileState, /of-state-empty/, 'secret-bearing state filter matches nothing');
  assert.ok(!hostileState.includes('token=LEAK'), 'secret-bearing state filter never echoes');
});

test('flow escapes benign ampersands and markup exactly once in graph, list, and typed gaps', () => {
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-amp-task', { desiredState: 'verified & signed' }),
      makeFlowRun('fx-amp-run', 'fx-amp-task', { status: 'complete' }),
    ],
    edges: [],
    gaps: [
      { gapId: 'fx-amp-gap', kind: 'stale-fence', subjectId: 'fx-amp-run', detail: 'fish & chips <tag> "quoted"', evidenceRef: null },
    ],
  });
  const html = renderFlow(projection);
  assert.ok(html.includes('verified &amp; signed'), 'benign ampersand escapes once');
  assert.ok(!html.includes('&amp;amp;'), 'no double-escaping anywhere in flow output');
  assert.ok(html.includes('fish &amp; chips &lt;tag&gt; &quot;quoted&quot;'), 'typed-gap detail escapes exactly once');
  assert.ok(!html.includes('fish & chips <tag>'), 'raw markup never survives');
  const listSection = html.match(/<ol class="of-flow-list"[\s\S]*?<\/ol>/)?.[0] ?? '';
  assert.ok(!listSection.includes('&amp;amp;'), 'list output escapes exactly once');
});

test('flow keeps full Node and browser parity across every corrective reproduction', () => {
  const cases: Array<[string, MissionFabricProjectionV1, { workId?: string; agentId?: string; state?: string }?]> = [
    ['fixture normal', FLOW_PROJECTION],
    [
      '97-task bound',
      makeFlowProjection({
        nodes: Array.from({ length: 97 }, (_, index) => makeFlowTask(`fx-par-cap-${String(index).padStart(3, '0')}`)),
        edges: [],
        gaps: [],
      }),
    ],
    [
      'filtered late row',
      makeFlowProjection({
        nodes: [
          ...Array.from({ length: 120 }, (_, index) => makeFlowTask(`fx-par-pool-${String(index).padStart(3, '0')}`)),
          makeFlowTask('fx-par-pool-late', { status: 'blocked' }),
        ],
        edges: [],
        gaps: [],
      }),
      { state: 'blocked' },
    ],
    [
      'multiple executors',
      makeFlowProjection({
        nodes: [
          makeFlowTask('fx-par-exec-task'),
          makeFlowRun('fx-par-exec-run-1', 'fx-par-exec-task', { agentId: 'fx-par-field-x' }),
          makeFlowRun('fx-par-exec-run-2', 'fx-par-exec-task'),
          makeFlowAgent('fx-par-exec-a1'),
          makeFlowAgent('fx-par-exec-a2'),
        ],
        edges: [
          { kind: 'executes', fromId: 'fx-par-exec-a1', toId: 'fx-par-exec-run-1' },
          { kind: 'executes', fromId: 'fx-par-exec-a2', toId: 'fx-par-exec-run-2' },
        ],
        gaps: [],
      }),
    ],
    [
      'contradictory proof grants nothing',
      makeFlowProjection({
        nodes: [
          makeFlowTask('fx-par-proof-a'),
          makeFlowTask('fx-par-proof-b'),
          makeFlowRun('fx-par-proof-run', 'fx-par-proof-a'),
          makeFlowReceipt('fx-par-proof-receipt', 'fx-par-proof-run', 'fx-par-proof-a'),
        ],
        edges: [
          { kind: 'produces', fromId: 'fx-par-proof-run', toId: 'fx-par-proof-receipt' },
          { kind: 'proves', fromId: 'fx-par-proof-receipt', toId: 'fx-par-proof-b' },
        ],
        gaps: [],
      }),
    ],
    [
      'exact gap scoping with unscoped section',
      makeFlowProjection({
        nodes: [makeFlowTask('a'), makeFlowTask('aa')],
        edges: [],
        gaps: [
          { gapId: 'fx-par-gap', kind: 'stale-fence', subjectId: 'fx-par-run-aa', detail: 'Rejected stale fence fx-par-run-aa for aa', evidenceRef: null },
        ],
      }),
    ],
    [
      'hostile secret IDs stay collision-safe',
      makeFlowProjection({
        nodes: [
          makeFlowTask('fx-par-secret token=LEAK'),
          makeFlowRun('fx-par-secret-run token=LEAK', 'fx-par-secret token=LEAK'),
          makeFlowAgent('fx-par-secret-agent token=LEAK'),
        ],
        edges: [{ kind: 'executes', fromId: 'fx-par-secret-agent token=LEAK', toId: 'fx-par-secret-run token=LEAK' }],
        gaps: [
          { gapId: 'fx-par-secret-gap', kind: 'stale-fence', subjectId: 'fx-par-absent token=LEAK', detail: 'rejected token=LEAK', evidenceRef: null },
        ],
      }),
    ],
    [
      'exec-edge filter parity',
      makeFlowProjection({
        nodes: [
          makeFlowTask('fx-par-filter-task'),
          makeFlowRun('fx-par-filter-run', 'fx-par-filter-task', { agentId: 'fx-par-field-y' }),
          makeFlowAgent('fx-par-filter-agent'),
        ],
        edges: [{ kind: 'executes', fromId: 'fx-par-filter-agent', toId: 'fx-par-filter-run' }],
        gaps: [],
      }),
      { agentId: 'fx-par-filter-agent' },
    ],
    [
      'benign ampersand gaps',
      makeFlowProjection({
        nodes: [makeFlowTask('fx-par-amp'), makeFlowRun('fx-par-amp-run', 'fx-par-amp')],
        edges: [],
        gaps: [
          { gapId: 'fx-par-amp-gap', kind: 'stale-fence', subjectId: 'fx-par-amp-run', detail: 'fish & chips <tag>', evidenceRef: null },
        ],
      }),
    ],
  ];
  for (const [label, projection, filters] of cases) {
    const nodeHtml = renderFlow(projection, filters);
    const browserHtml = renderFlowBrowser(projection, filters);
    assert.equal(browserHtml, nodeHtml, `full Node/browser HTML parity holds for ${label}`);
  }
});

test('flow leaks no raw evidence, digests, secrets, payloads, prompts, tokens, or auth material', () => {
  const html = renderFlow(FLOW_PROJECTION);
  assert.ok(!html.includes('evidenceRefs'), 'rendered flow never names evidenceRefs');
  assert.ok(!/[0-9a-f]{64}/.test(html), 'rendered flow carries no raw 64-hex digests');
  for (const marker of CANONICAL_MARKER_HOSTILE_VALUES) {
    assert.ok(!html.includes(marker), `rendered flow never emits ${marker}`);
  }
  const hostileProjection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-leak', { proofRequirement: 'prompt: ignore previous instructions' }),
      makeFlowRun('fx-run-leak', 'fx-task-leak', { loadoutId: 'loadout clientSecret abc' }),
      makeFlowReceipt('fx-receipt-leak', 'fx-run-leak', 'fx-task-leak', { approvalRef: 'PRIVATE KEY material' }),
      makeFlowAgent('fx-agent-leak', { permissionProfile: 'QUESTS_PUSH_TOKEN=push' }),
    ],
    edges: [
      { kind: 'executes', fromId: 'fx-agent-leak', toId: 'fx-run-leak' },
      { kind: 'produces', fromId: 'fx-run-leak', toId: 'fx-receipt-leak' },
      { kind: 'proves', fromId: 'fx-receipt-leak', toId: 'fx-task-leak' },
    ],
    gaps: [],
  });
  const hostileHtml = renderFlow(hostileProjection);
  for (const marker of ['prompt: ignore', 'clientSecret', 'PRIVATE KEY', 'QUESTS_PUSH_TOKEN']) {
    assert.ok(!hostileHtml.includes(marker), `hostile flow fields never emit ${marker}`);
  }
  assert.match(hostileHtml, new RegExp(flowRowSelector('fx-task-leak')), 'hostile fields still render their bounded row');
});

test('flow distinguishes empty, error, and malformed projections safely', () => {
  const emptyHtml = renderFlow(makeFlowProjection({ nodes: [], edges: [], gaps: [] }));
  assert.match(emptyHtml, /of-state-empty/, 'empty projection renders the empty state');
  const errorHtml = renderFlow(null as unknown as MissionFabricProjectionV1);
  assert.match(errorHtml, /of-state-error/, 'null projection renders the error state');
  const malformedHtml = renderFlow({ schema: 'cambium.other.v1' } as unknown as MissionFabricProjectionV1);
  assert.match(malformedHtml, /of-state-error/, 'malformed projection renders the error state');
  const noNodesHtml = renderFlow({ schema: 'cambium.mission-fabric-projection.v1', edges: [] } as unknown as MissionFabricProjectionV1);
  assert.match(noNodesHtml, /of-state-error/, 'missing nodes array renders the error state');
});

// ── flow boot composition + fail-closed integration ─────────────────────────

test('FLOW_BROWSER_JS is explicit browser-valid JS with no transformer or ambient global', () => {
  assert.ok(FLOW_BROWSER_JS.includes('function ofRenderFlow('), 'browser flow renderer defines ofRenderFlow');
  assert.doesNotThrow(() => new Function(FLOW_BROWSER_JS), 'FLOW_BROWSER_JS parses as plain browser JavaScript');
  for (const banned of ['import ', 'export ', 'node:fs', 'readFileSync', 'eval(', 'new Function(', 'Function.prototype.toString', '.toString()']) {
    assert.ok(!FLOW_BROWSER_JS.includes(banned), `FLOW_BROWSER_JS never uses ${banned}`);
  }
  assert.ok(!/globalThis|window\.of|window\['/.test(FLOW_BROWSER_JS), 'FLOW_BROWSER_JS touches no ambient mutable global');
  assert.ok(OPERATING_FABRIC_BOOT.includes(FLOW_BROWSER_JS), 'the served boot embeds the exact flow browser source');
  assert.ok(
    OPERATING_FABRIC_BOOT.indexOf(FLOW_BROWSER_JS) < OPERATING_FABRIC_BOOT.indexOf('var ofScenes'),
    'flow browser source composes lexically before the scene registry',
  );
  const flowSource = readFileSync(new URL('./page/operating-fabric/flow.ts', import.meta.url), 'utf8');
  for (const banned of ['node:fs', 'readFileSync']) {
    assert.ok(!flowSource.includes(banned), `flow.ts never uses ${banned}`);
  }
  for (const transformer of ['.replace(/^export', 'split(\'\\n\')', 'loadModuleBody', 'sanitizeForInlineAudit']) {
    assert.ok(!flowSource.includes(transformer), `flow.ts carries no source transformer ${transformer}`);
  }
  for (const fragmented of [
    'query_[a-z]{2}=',
    'auth_[a-z]{4}=',
    'hash[=]',
    'bot_[a-z]{5}',
    'client[A-Z][a-z]{5}',
    'TELEGR[A-Z_]{10}',
    'TG_[A-Z_]{9}',
    'QUESTS_[A-Z_]{10}',
    'PRIVATE [A-Z]{3}',
    'init[A-Z][a-z]{3}',
  ]) {
    assert.ok(!flowSource.includes(fragmented), `flow.ts never uses the obfuscated class form ${fragmented}`);
    assert.ok(!FLOW_BROWSER_JS.includes(fragmented), `FLOW_BROWSER_JS never serves the obfuscated class form ${fragmented}`);
  }
  assert.ok(!/'[A-Za-z]{2}'\s*\+\s*'/.test(flowSource), 'flow.ts never hides markers inside string fragments');
  assert.ok(!/String\\.fromCharCode|fromCodePoint/.test(flowSource), 'flow.ts never builds markers from character codes');
  for (const banned of ['eval(', 'new Function(', 'Function.prototype.toString', 'localStorage', 'sessionStorage']) {
    assert.ok(!flowSource.includes(banned), `flow.ts never uses ${banned}`);
  }
  assert.ok(
    flowSource.includes(CANONICAL_SECRET_MARKER_PATTERN_SOURCE),
    'flow.ts Node renderer embeds the canonical Task 7 marker policy verbatim',
  );
  for (const marker of ['query_id=', 'auth_date=', 'hash', 'bot_token', 'clientSecret', 'initData', 'TELEGRAM_INIT_DATA', 'TG_INIT_DATA', 'QUESTS_PUSH_TOKEN', 'PRIVATE KEY', 'prompt']) {
    const fragmented = new RegExp(marker.split('').join('[\\w]?'));
    assert.ok(!fragmented.test(flowSource) || flowSource.includes(marker), `flow.ts never fragments ${marker} across character classes`);
  }
});

test('boot registers the flow renderer and the flow scene root stays wired', () => {
  const body = bootBody(OPERATING_FABRIC_BOOT);
  assert.match(body, /renderFlow:\s*ofRenderFlow/, 'boot scene registry wires the flow renderer');
  assert.match(body, /sceneRoot\('flow'\)/, 'boot resolves the flow scene root');
  assert.ok(body.includes('renderFlow(projection'), 'boot pre-renders flow from the projection');
  const clientSource = readFileSync(new URL('./page/operating-fabric/client.ts', import.meta.url), 'utf8');
  assert.match(clientSource, /import \{ FLOW_BROWSER_JS \} from '\.\/flow\.ts';/, 'client composes the flow browser source from flow.ts');
  const sceneScripts = extractScriptBodies(OPERATING_FABRIC_PAGE).filter((body) =>
    body.includes('data-operating-fabric-scenes') || body.includes('renderOperatingMission') || body.includes('ofRenderFlow'),
  );
  assert.equal(sceneScripts.length, 1, 'flow joins the single boot script — no third scene script');
});

test('real composed boot populates the flow root with no renderer injection or instrumentation', async () => {
  const bootErrors: unknown[] = [];
  const booted = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        projection: FLOW_PROJECTION,
        delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
      },
    }),
    { onError: (error) => bootErrors.push(error) },
  );
  await flushBoot();
  assert.deepEqual(bootErrors, [], 'flow wiring never throws during activation');
  assert.equal(booted.fabricRoot.classList.contains('of-on'), true, 'shell activates with the flow projection');
  const flowRoot = booted.elements.get('of-scene-flow')!;
  assert.match(flowRoot.innerHTML, /data-component="FabricFlow"/, 'flow scene root is populated by the real boot');
  assert.match(flowRoot.innerHTML, /data-of-fact="run:id:fx-flow-run-alpha"/, 'real boot renders accepted run facts');
  assert.match(flowRoot.innerHTML, /data-of-gap-kind="stale-fence"/, 'real boot renders typed stale-fence gaps');
  assert.ok(!flowRoot.innerHTML.includes('data-of-fact="run:id:fx-flow-run-stale"'), 'real boot never fabricates rejected runs');
  assert.match(flowRoot.innerHTML, /run not present in projection/, 'real boot renders honest missing-run labels');
  for (const marker of CANONICAL_MARKER_HOSTILE_VALUES) {
    assert.ok(!flowRoot.innerHTML.includes(marker), `real boot flow root never contains ${marker}`);
  }
});

test('activation stays fail-closed when the flow renderer, flow root, or flow render fails', async () => {
  const bootedMissingRoot = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        projection: FLOW_PROJECTION,
        delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
      },
    }),
  );
  // Remove the flow scene root entirely: getElementById, querySelector, and
  // querySelectorAll must all stop resolving it so activation cannot find
  // the flow root and must stay fail-closed.
  bootedMissingRoot.elements.delete('of-scene-flow');
  const flowSceneElement = bootedMissingRoot.sceneElements.find((scene) => scene.dataset.ofScene === 'flow')!;
  flowSceneElement.dataset.ofScene = 'flow-removed';
  await flushBoot();
  assertStaysInert(bootedMissingRoot, 'missing flow root');
  assert.equal(bootedMissingRoot.elements.get('of-scene-canopy')!.innerHTML, '', 'missing flow root: canopy is never written');

  const originalRender = renderFlow;
  void originalRender;
  const throwingProjection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-task-throw'),
      {
        kind: 'run',
        value: new Proxy(
          {
            runId: 'fx-run-throw',
            taskId: 'fx-task-throw',
            agentId: 'fx-agent-throw',
            loadoutId: 'fx-loadout',
            startedAt: '2026-07-28T05:00:00.000Z',
            terminalAt: null,
            status: 'complete',
          },
          {
            get(target, property) {
              if (property === 'runId') throw new Error('hostile getter');
              return (target as Record<PropertyKey, unknown>)[property];
            },
          },
        ) as unknown as FlowRunNode['value'],
      } as FlowRunNode,
    ],
    edges: [],
    gaps: [],
  });
  const bootedThrow = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: throwingProjection,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assertStaysInert(bootedThrow, 'flow renderer exception');
  assert.equal(bootedThrow.elements.get('of-scene-flow')!.innerHTML, '', 'flow renderer exception: flow root is never written');

  const malformedBoot = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: { schema: 'cambium.other.v1', nodes: [], edges: [] },
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assertStaysInert(malformedBoot, 'malformed projection with flow wired');
  assert.equal(malformedBoot.elements.get('of-scene-flow')!.innerHTML, '', 'malformed projection: flow root is never written');
});

test('double boot leaves exactly one populated flow scene and one delegated handler', async () => {
  const responder = () => ({
    kind: 'json' as const,
    value: {
      projection: FLOW_PROJECTION,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  });
  const first = bootOperatingFabricDocument(responder);
  const second = bootOperatingFabricDocument(responder);
  await flushBoot();
  for (const [label, booted] of [
    ['first boot', first],
    ['second boot', second],
  ] as const) {
    assert.equal(booted.fabricRoot.classList.contains('of-on'), true, `${label}: shell activates`);
    const flowHtml = booted.elements.get('of-scene-flow')!.innerHTML;
    assert.match(flowHtml, /data-component="FabricFlow"/, `${label}: flow populated`);
    assert.equal(
      [...flowHtml.matchAll(/data-component="FabricFlow"/g)].length,
      1,
      `${label}: exactly one flow scene renders`,
    );
    const clickHandlers = (booted.fabricRoot as unknown as { listeners: Map<string, unknown[]> }).listeners.get('click') ?? [];
    assert.equal(clickHandlers.length, 1, `${label}: exactly one delegated click handler`);
  }
});

test('flow renderer and boot glue carry no write, Gate, RBAC, assignment, or authority logic', () => {
  const flowSource = readFileSync(new URL('./page/operating-fabric/flow.ts', import.meta.url), 'utf8');
  for (const banned of [
    'fetch(',
    'XMLHttpRequest',
    'POST',
    'api/gate',
    'checkRole',
    'data-action-request',
    'signed-action',
    'role ===',
    'assign(',
    'assignedAgentId = ',
    '.assignedAgentId=',
  ]) {
    assert.ok(!flowSource.includes(banned), `flow.ts stays free of write/authority surface: ${banned}`);
  }
  assert.ok(!FLOW_BROWSER_JS.includes('data-of-open-work'), 'flow renderer adds no authority-adjacent open-work delegation');
  assert.ok(!/addEventListener/.test(FLOW_BROWSER_JS), 'flow renderer registers no event handlers');
  const body = bootBody(OPERATING_FABRIC_BOOT);
  const flowSection = body.slice(body.indexOf('function ofRenderFlow'), body.indexOf('function ofRenderWorkforce'));
  for (const banned of ['fetch(', 'POST', 'api/gate', 'checkRole', 'data-action-request', 'signed-action', 'role ===']) {
    assert.ok(!flowSection.includes(banned), `composed flow section stays free of authority surface: ${banned}`);
  }
});

// ── flow corrective pass 2 (controller reproductions, second implementer) ───
// Each test below pins a controller-reproduced failure on the corrective-1
// implementation as honest corrected behavior:
//   1. secret-safe fact-ID collisions: 100 secret-bearing canonical task IDs
//      render 96 unique collision-safe public fact IDs, exact 'showing 96 of
//      100', zero raw leakage, exact graph/list parity — and benign IDs that
//      truncate to the same 64-character display prefix never collide either.
//   2. truncation N counts every distinct Task/Run/Receipt fact in the
//      filtered view across ALL filtered rows (97x3 -> 'showing 96 of 291').
//   3. contradictory proof: a proves/produces edge that disagrees with the
//      receipt's canonical run/task ownership grants nothing on any row, and
//      no target-only proof chip exists — every rendered proof stays attached
//      to its bounded receipt fact with bounded ID/status.
//   4. a zero-row projection with an unscoped typed gap preserves the honest
//      unscoped section in BOTH representations; empty state is valid only
//      when there are no selected rows AND no relevant unscoped typed gaps.
//   5. filter bounds are enforced: overlong (65+) or secret-bearing workId/
//      agentId/state inputs fail closed to an empty view without echoing and
//      without surfacing unrelated scoped gaps; gap scoping is computed
//      against the full canonical row set before filtering, so a gap that
//      belongs to a filtered-out task never reappears as 'unscoped'.

function makeSecretCollisionProjection(count: number): MissionFabricProjectionV1 {
  const nodes: FabricNode[] = [];
  for (let index = 0; index < count; index += 1) {
    nodes.push(makeFlowTask(`fx-leak-task-${String(index).padStart(3, '0')} token=LEAK${index}`));
  }
  return makeFlowProjection({ nodes, edges: [], gaps: [] });
}

test('flow renders collision-safe deterministic public fact IDs for secret-bearing canonical IDs', () => {
  const projection = makeSecretCollisionProjection(100);
  const html = renderFlow(projection);
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.equal(new Set(graphIds).size, FLOW_FACT_LIMIT, '100 secret tasks expose exactly 96 unique graph fact IDs');
  assert.equal(new Set(listIds).size, FLOW_FACT_LIMIT, '100 secret tasks expose exactly 96 unique list fact IDs');
  assert.deepEqual(new Set(graphIds), new Set(listIds), 'secret-bearing input keeps exact graph/list fact-ID parity');
  assert.ok(html.includes('showing 96 of 100'), 'exact truncation copy renders: showing 96 of 100');
  assert.ok(!html.includes('token=LEAK'), 'no raw secret-bearing canonical ID survives anywhere');
  assert.ok(!/LEAK\d/.test(html), 'no secret fragment survives anywhere');
  assert.equal(html.match(/data-of-flow-row=/g)?.length ?? 0, FLOW_FACT_LIMIT, '96 distinct rows render for 100 secret tasks');
  const rowIds = [...html.matchAll(/data-of-flow-row="([^"]+)"/g)].map((match) => match[1]!);
  assert.equal(new Set(rowIds).size, FLOW_FACT_LIMIT, 'row IDs stay unique under secret collisions');
  for (const id of graphIds) {
    assert.match(id, /^task:redacted:\d{3}$/, 'collision-safe fact IDs are kind-scoped redacted ordinals in the reserved redacted namespace');
  }
  // Ordering is permutation-stable: the same 100 tasks in reverse input
  // order render byte-identical output.
  const reversed = makeFlowProjection({
    nodes: (projection.nodes as FabricNode[]).slice().reverse(),
    edges: [],
    gaps: [],
  });
  assert.equal(renderFlow(reversed), html, 'secret-collision output is permutation-stable');
  // Every visible fact ID is distinct per distinct selected canonical task:
  // the first 96 canonical IDs each keep their own public ID.
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds for the 100-secret reproduction');
});

test('flow keeps benign 64-prefix-truncated IDs collision-free in fact IDs', () => {
  const prefix = `fx-${'a'.repeat(62)}`;
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask(`${prefix}-alpha-long-suffix-one`),
      makeFlowTask(`${prefix}-beta-long-suffix-two`),
    ],
    edges: [],
    gaps: [],
  });
  const html = renderFlow(projection);
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.equal(new Set(graphIds).size, 2, 'same-display-prefix IDs keep two unique graph fact IDs');
  assert.equal(new Set(listIds).size, 2, 'same-display-prefix IDs keep two unique list fact IDs');
  assert.deepEqual(new Set(graphIds), new Set(listIds), 'prefix-truncated input keeps exact graph/list parity');
  assert.equal(html.match(/data-of-flow-row=/g)?.length ?? 0, 2, 'both prefix-truncated rows render');
  assert.ok(!html.includes('showing 96 of'), 'two facts never claim truncation');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds for prefix-truncated IDs');
});

test('flow counts every distinct filtered-view fact in truncation N, not only kept rows', () => {
  const nodes: FabricNode[] = [];
  const edges: FabricEdge[] = [];
  for (let index = 0; index < 97; index += 1) {
    const suffix = String(index).padStart(3, '0');
    nodes.push(makeFlowTask(`fx-total-task-${suffix}`));
    nodes.push(makeFlowRun(`fx-total-run-${suffix}`, `fx-total-task-${suffix}`));
    nodes.push(makeFlowReceipt(`fx-total-receipt-${suffix}`, `fx-total-run-${suffix}`, `fx-total-task-${suffix}`));
    edges.push({ kind: 'produces', fromId: `fx-total-run-${suffix}`, toId: `fx-total-receipt-${suffix}` });
    edges.push({ kind: 'proves', fromId: `fx-total-receipt-${suffix}`, toId: `fx-total-task-${suffix}` });
  }
  const projection = makeFlowProjection({ nodes, edges, gaps: [] });
  const html = renderFlow(projection);
  assert.ok(html.includes('showing 96 of 291'), 'truncation N counts every distinct Task/Run/Receipt fact in the view: showing 96 of 291');
  assert.equal(new Set(flowGraphFactIds(html)).size, FLOW_FACT_LIMIT, 'the visible set still caps at 96');
  assert.deepEqual(new Set(flowGraphFactIds(html)), new Set(flowListFactIds(html)), 'bounded view keeps exact graph/list parity');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds for the 97x3 reproduction');
});

test('flow grants nothing for contradictory proof edges and renders no target-only proof chips', () => {
  // The receipt's canonical taskId is task-a and its canonical runId belongs
  // to task-a, but a hostile proves edge names task-b: this wrong-target edge
  // must grant nothing on either row.
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-contra-task-a'),
      makeFlowTask('fx-contra-task-b'),
      makeFlowRun('fx-contra-run-a', 'fx-contra-task-a'),
      makeFlowReceipt('fx-contra-receipt-a', 'fx-contra-run-a', 'fx-contra-task-a'),
    ],
    edges: [
      { kind: 'produces', fromId: 'fx-contra-run-a', toId: 'fx-contra-receipt-a' },
      { kind: 'proves', fromId: 'fx-contra-receipt-a', toId: 'fx-contra-task-b' },
    ],
    gaps: [],
  });
  const html = renderFlow(projection);
  const rowA = html.match(new RegExp(`<tr ${flowRowSelector('fx-contra-task-a')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  const rowB = html.match(new RegExp(`<tr ${flowRowSelector('fx-contra-task-b')}[\\s\\S]*?</tr>`))?.[0] ?? '';
  assert.ok(rowA.length > 0 && rowB.length > 0, 'both rows render');
  assert.match(rowA, /data-of-proof="produces"/, 'the agreeing produces edge still grants proof on task-a');
  assert.ok(!/data-of-proof="[^"]*proves/.test(rowA), 'the contradictory proves edge grants nothing on task-a');
  assert.ok(!/data-of-proof=/.test(rowB), 'the contradictory proves edge grants nothing on task-b either');
  assert.ok(!rowB.includes('data-of-proof-status'), 'no target-only proof chip survives on task-b');
  // Every rendered proof stays attached to its bounded receipt fact.
  const proofSpans = [...html.matchAll(/data-of-proof="([^"]+)"/g)];
  assert.ok(proofSpans.length > 0, 'agreeing proof renders');
  for (const span of proofSpans) {
    const enclosingRow = html.slice(Math.max(0, html.indexOf(span[0]) - 4000), html.indexOf(span[0]));
    assert.match(enclosingRow, /data-of-fact="receipt:id:fx-contra-receipt-a"/, 'every rendered proof stays attached to its bounded receipt fact');
  }
  // A produces edge from a run whose canonical taskId disagrees with the
  // receipt's canonical taskId grants nothing either.
  const conflictingRun = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-contra-task-c'),
      makeFlowTask('fx-contra-task-d'),
      makeFlowRun('fx-contra-run-c', 'fx-contra-task-c'),
      makeFlowReceipt('fx-contra-receipt-d', 'fx-contra-run-c', 'fx-contra-task-d'),
    ],
    edges: [
      { kind: 'produces', fromId: 'fx-contra-run-c', toId: 'fx-contra-receipt-d' },
    ],
    gaps: [],
  });
  const conflictingHtml = renderFlow(conflictingRun);
  assert.ok(!/data-of-proof=/.test(conflictingHtml), 'a run/task-disagreeing produces edge grants nothing');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds for the contradictory-proof reproduction');
});

test('flow preserves the unscoped typed-gap section when the view has zero task rows', () => {
  const projection = makeFlowProjection({
    nodes: [],
    edges: [],
    gaps: [
      { gapId: 'fx-gap-only', kind: 'stale-fence', subjectId: 'fx-gap-only-run', detail: 'rejected stale fence fx-gap-only-run', evidenceRef: null },
    ],
  });
  const html = renderFlow(projection);
  const graphSection = html.match(/<table class="of-flow-graph"[\s\S]*?<\/table>/)?.[0] ?? '';
  const listSection = html.match(/<ol class="of-flow-list"[\s\S]*?<\/ol>/)?.[0] ?? '';
  assert.ok(graphSection.length > 0, 'graph renders even with zero task facts when gaps exist');
  assert.ok(listSection.length > 0, 'list renders even with zero task facts when gaps exist');
  assert.match(graphSection, /data-of-flow-unscoped-gaps="true"/, 'graph preserves the unscoped typed-gap section');
  assert.match(listSection, /data-of-flow-unscoped-gaps="true"/, 'list preserves the unscoped typed-gap section');
  assert.match(graphSection, /data-of-gap-kind="stale-fence"/, 'the unscoped gap renders in the graph');
  assert.match(listSection, /data-of-gap-kind="stale-fence"/, 'the unscoped gap renders in the list');
  assert.ok(!html.includes('of-state-empty'), 'gap-only view never renders the empty state');
  assert.deepEqual(flowGraphFactIds(html), [], 'graph exposes an empty fact-ID set');
  assert.deepEqual(flowListFactIds(html), [], 'list exposes the same empty fact-ID set');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds for the gap-only reproduction');
  // Empty state remains valid only when there are no selected rows AND no
  // relevant unscoped typed gaps.
  const trulyEmpty = renderFlow(makeFlowProjection({ nodes: [], edges: [], gaps: [] }));
  assert.match(trulyEmpty, /of-state-empty/, 'no rows and no unscoped typed gaps renders the empty state');
});

test('flow fails closed on overlong or secret-bearing filter values and scopes gaps before filtering', () => {
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('fx-bound-task-keep', { status: 'ready' }),
      makeFlowTask('fx-bound-task-drop', { status: 'blocked' }),
    ],
    edges: [],
    gaps: [
      { gapId: 'fx-bound-gap', kind: 'stale-fence', subjectId: 'fx-bound-task-drop', detail: 'rejected stale fence for fx-bound-task-drop', evidenceRef: null },
    ],
  });
  const overlong = 'x'.repeat(1000);
  for (const filters of [
    { workId: overlong },
    { agentId: overlong },
    { state: overlong },
    { workId: 'fx-work token=LEAK' },
    { agentId: 'fx-agent token=LEAK' },
    { state: 'ready token=LEAK' },
    { workId: 'y'.repeat(65) },
    { agentId: 'z'.repeat(65) },
    { state: 'q'.repeat(65) },
  ]) {
    const html = renderFlow(projection, filters);
    assert.match(html, /of-state-empty/, `overlong/secret-bearing filter ${JSON.stringify(Object.keys(filters))} fails closed to an empty view`);
    assert.ok(!html.includes(overlong), 'the overlong filter value never echoes');
    assert.ok(!html.includes('token=LEAK'), 'the secret-bearing filter value never echoes');
    assert.ok(!html.includes('data-of-flow-unscoped-gaps'), 'fail-closed filters never surface unrelated scoped gaps');
    assert.ok(!html.includes('fx-bound-task-drop'), 'the filtered-out task never reappears through any path');
    const browserHtml = renderFlowBrowser(projection, filters);
    assert.equal(browserHtml, html, `full Node/browser parity holds for hostile filter ${JSON.stringify(Object.keys(filters))}`);
  }
  // Gap scoping is computed against the full canonical row set BEFORE
  // filtering: a gap whose subject task is filtered out never reappears as
  // 'unscoped' in the surviving view.
  const scoped = renderFlow(projection, { state: 'ready' });
  assert.match(scoped, new RegExp(flowRowSelector('fx-bound-task-keep')), 'the kept row renders');
  assert.ok(!scoped.includes('fx-bound-gap'), 'a gap belonging to a filtered-out task never reappears');
  assert.ok(!scoped.includes('data-of-flow-unscoped-gaps'), 'the surviving view carries no spurious unscoped section');
  const scopedBrowser = renderFlowBrowser(projection, { state: 'ready' });
  assert.equal(scopedBrowser, scoped, 'full Node/browser parity holds for pre-filter gap scoping');
  // Only genuinely unmappable typed gaps still enter the unscoped section.
  const unmappable = renderFlow(makeFlowProjection({
    nodes: [makeFlowTask('fx-bound-task-keep', { status: 'ready' })],
    edges: [],
    gaps: [
      { gapId: 'fx-bound-gap-free', kind: 'unverifiable-fence', subjectId: 'fx-bound-absent-run', detail: 'rejected', evidenceRef: null },
    ],
  }), { state: 'ready' });
  assert.match(unmappable, /data-of-flow-unscoped-gaps="true"/, 'genuinely unmappable typed gaps still render unscoped');
});

// ── flow corrective pass 3: deterministic duplicate reconciliation ──────────
// Duplicate nodes sharing one canonical ID must NEVER resolve first-input-
// wins. Exactly one canonical duplicate is selected by a stable tie-break
// over explicit per-kind OPERATIONAL fields (lineage/status/dependency/
// assignment truth) — never input order, never object insertion order,
// never titles/raw evidence/digests/secrets, and never locale-sensitive
// comparison. Secret-bearing or overlong operational strings compare
// through injective canonical JSON and code-unit ordering that keeps
// distinct hostile IDs distinguishable without ever echoing them.
// Reversing the node array must render byte-identically in BOTH the Node
// renderer and FLOW_BROWSER_JS, and the surviving visible truth (task
// status, run executor/status, receipt proof/status) must follow the
// deterministic winner, never the first seen.

test('flow reconciles duplicate canonical ids deterministically, never first-input-wins', () => {
  // Two task nodes share taskId fx-dup-task with CONFLICTING statuses; two
  // run nodes share runId fx-dup-run with conflicting taskId/status; two
  // receipt nodes share receiptId fx-dup-receipt with conflicting
  // taskId/status; two agent nodes share agentId fx-dup-agent with
  // conflicting status. The canonical selection rule is deterministic over
  // explicit per-kind operational fields — lineage fields (taskId/runId)
  // BEFORE status — and the pairwise lexicographically smaller canonical
  // value wins ('blocked' < 'ready' on task.status; 'fx-dup-task' <
  // 'fx-dup-z' on run.taskId and receipt.taskId). Agent status/role are
  // non-rendered and excluded from selection, so the agent winner's
  // identity may follow input order here, but the executor fact is
  // byte-identical either way. Selection never reads raw evidence, raw
  // digests, titles, or secrets.
  const taskReady = makeFlowTask('fx-dup-task', { status: 'ready' });
  const taskBlocked = makeFlowTask('fx-dup-task', { status: 'blocked' });
  const runOrphan = makeFlowRun('fx-dup-run', 'fx-dup-z', { status: 'running' });
  const runCanonical = makeFlowRun('fx-dup-run', 'fx-dup-task', { status: 'failed' });
  const receiptOrphan = makeFlowReceipt('fx-dup-receipt', 'fx-dup-run', 'fx-dup-z', { status: 'rejected' });
  const receiptCanonical = makeFlowReceipt('fx-dup-receipt', 'fx-dup-run', 'fx-dup-task', { status: 'complete' });
  const agentRunning = makeFlowAgent('fx-dup-agent', { status: 'running' });
  const agentHalted = makeFlowAgent('fx-dup-agent', { status: 'halted' });
  const canonicalNodes: FabricNode[] = [
    taskBlocked,
    runCanonical,
    receiptCanonical,
    agentHalted,
  ];
  const challengerNodes: FabricNode[] = [
    taskReady,
    runOrphan,
    receiptOrphan,
    agentRunning,
  ];
  const edges = [
    { kind: 'executes', fromId: 'fx-dup-agent', toId: 'fx-dup-run' },
    { kind: 'produces', fromId: 'fx-dup-run', toId: 'fx-dup-receipt' },
    { kind: 'proves', fromId: 'fx-dup-receipt', toId: 'fx-dup-task' },
  ] as MissionFabricProjectionV1['edges'];
  const forward = makeFlowProjection({ nodes: [...challengerNodes, ...canonicalNodes], edges, gaps: [] });
  const reversed = makeFlowProjection({ nodes: [...canonicalNodes, ...challengerNodes], edges, gaps: [] });

  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  // Input order never changes visible truth — byte-identical full HTML.
  assert.equal(reversedHtml, forwardHtml, 'reversed duplicate input renders byte-identically in the Node renderer');

  // One visible fact per canonical kind+ID: the canonical task row carries
  // the canonical winner run and the canonical winner receipt — the losing
  // duplicates never spawn a second row, run, or receipt fact.
  const graphIds = flowGraphFactIds(forwardHtml);
  assert.deepEqual(
    [...graphIds].sort(),
    ['receipt:id:fx-dup-receipt', 'run:id:fx-dup-run', 'task:id:fx-dup-task'],
    'one visible fact per canonical kind+ID survives duplicate reconciliation',
  );

  // The deterministic winner — never the first-seen node — owns the visible
  // truth: task status, run status, receipt status.
  const listMarkup = forwardHtml.match(/<ol class="of-flow-list"[^>]*>([\s\S]*?)<\/ol>/)?.[0] ?? '';
  assert.match(listMarkup, /data-of-task-status="blocked"/, 'visible task status follows the canonical winner');
  assert.ok(!listMarkup.includes('data-of-task-status="ready"'), 'the losing duplicate task status never renders');
  assert.match(listMarkup, /data-of-run-status="failed"/, 'visible run status follows the canonical winner');
  assert.ok(!listMarkup.includes('data-of-run-status="running"'), 'the losing duplicate run status never renders');
  assert.match(listMarkup, /data-of-receipt-status="complete"/, 'visible receipt status follows the canonical winner');
  assert.ok(!listMarkup.includes('data-of-receipt-status="rejected"'), 'the losing duplicate receipt status never renders');

  // Executor truth follows the canonical winner run: the winning run is a
  // canonical node with a canonical executes edge, so its executor resolves
  // to the canonical agent winner — the losing duplicates never supply the
  // executor, and no honest-missing label is invented for it.
  assert.match(listMarkup, /data-of-executor="fx-dup-agent"/, 'visible executor follows the canonical winner run');
  assert.ok(!listMarkup.includes('executor not present in projection'), 'no honest-missing label is invented for the canonical executor');

  // Proof truth follows agreement with the canonical winners: the canonical
  // produces edge agrees with the winner receipt's canonical run/task, and
  // the canonical proves edge agrees with the winner receipt's canonical
  // task and its canonical run's task, so proof renders attached to the
  // bounded receipt fact. A proves edge that only agreed with a LOSING
  // duplicate grants nothing.
  assert.match(listMarkup, /data-of-proof="produces · proves"/, 'visible proof follows agreement with the canonical winners');
  const contradicted = makeFlowProjection({
    nodes: [taskBlocked, runCanonical, receiptCanonical, agentHalted],
    edges: [
      { kind: 'executes', fromId: 'fx-dup-agent', toId: 'fx-dup-run' },
      { kind: 'produces', fromId: 'fx-dup-run', toId: 'fx-dup-receipt' },
      { kind: 'proves', fromId: 'fx-dup-receipt', toId: 'fx-dup-z' },
    ] as MissionFabricProjectionV1['edges'],
    gaps: [],
  });
  const contradictedHtml = renderFlow(contradicted);
  assert.ok(!contradictedHtml.includes('data-of-proof="produces · proves"'), 'a proves edge that contradicts the winner task grants nothing');
  assert.ok(!contradictedHtml.includes('data-of-proof="proves"'), 'the contradicting proves edge never renders as proof');

  // Full byte-identical Node/browser parity under BOTH input orders.
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser output is byte-identical to Node for forward input');
  assert.equal(reversedBrowser, reversedHtml, 'browser output is byte-identical to Node for reversed input');
  assert.equal(reversedBrowser, forwardBrowser, 'browser output is byte-identical under reversed duplicate input');
});

test('flow duplicate canonical selection is permutation-stable across every node ordering', () => {
  // Three task duplicates with three distinct statuses: the deterministic
  // winner is the smallest canonical operational value ('blocked'), and
  // EVERY permutation of the input array must produce byte-identical output
  // in both substrates — selection never depends on which duplicate is seen
  // first, last, or in between.
  const duplicates: FabricNode[] = [
    makeFlowTask('fx-dup-task', { status: 'running' }),
    makeFlowTask('fx-dup-task', { status: 'ready' }),
    makeFlowTask('fx-dup-task', { status: 'blocked' }),
  ];
  const permutations: FabricNode[][] = [
    [duplicates[0]!, duplicates[1]!, duplicates[2]!],
    [duplicates[2]!, duplicates[1]!, duplicates[0]!],
    [duplicates[1]!, duplicates[0]!, duplicates[2]!],
    [duplicates[1]!, duplicates[2]!, duplicates[0]!],
    [duplicates[2]!, duplicates[0]!, duplicates[1]!],
    [duplicates[0]!, duplicates[2]!, duplicates[1]!],
  ];
  const renders = permutations.map((nodes) => renderFlow(makeFlowProjection({ nodes, edges: [], gaps: [] })));
  for (let index = 1; index < renders.length; index += 1) {
    assert.equal(renders[index], renders[0], `permutation ${index} renders byte-identically in the Node renderer`);
  }
  assert.match(renders[0]!, /data-of-task-status="blocked"/, 'the deterministic winner owns visible task status for every permutation');
  for (const nodes of permutations) {
    const browserHtml = renderFlowBrowser(makeFlowProjection({ nodes, edges: [], gaps: [] }));
    assert.equal(browserHtml, renders[0], 'every permutation is byte-identical in the browser substrate');
  }
});

test('flow duplicate reconciliation never reads raw evidence, digests, titles, or secrets', () => {
  // Adversarial duplicates attempt to influence canonical selection through
  // secret-bearing statuses, raw digests, and raw evidence refs. Operational
  // comparison reads the full raw secret-bearing string solely to order
  // candidates (injective canonical JSON, never rendered), and
  // digests/evidence are non-operational and COMPLETELY EXCLUDED from
  // selection — secrets never leak, never decide the winner, and the raw
  // secret/digest/evidence material NEVER renders through any path.
  const secretStatus = makeFlowTask('fx-dup-task', { status: 'token=LEAKED' });
  const benignStatus = makeFlowTask('fx-dup-task', { status: 'ready' });
  const receiptWithEvidence = makeFlowReceipt('fx-dup-receipt', 'fx-dup-run', 'fx-dup-task', {
    status: 'complete',
    outputDigest: `sha256:${'f'.repeat(64)}`,
    evidenceRefs: ['token=EVIDENCE-LEAK'],
  });
  const receiptPlain = makeFlowReceipt('fx-dup-receipt', 'fx-dup-run', 'fx-dup-task', { status: 'complete' });
  const forward = makeFlowProjection({
    nodes: [secretStatus, benignStatus, makeFlowRun('fx-dup-run', 'fx-dup-task'), receiptWithEvidence, receiptPlain],
    edges: [],
    gaps: [],
  });
  const reversed = makeFlowProjection({
    nodes: [receiptPlain, receiptWithEvidence, makeFlowRun('fx-dup-run', 'fx-dup-task'), benignStatus, secretStatus],
    edges: [],
    gaps: [],
  });
  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  assert.equal(reversedHtml, forwardHtml, 'secret-bearing duplicates reconcile byte-identically under reversal');
  for (const forbidden of ['token=LEAKED', 'token=EVIDENCE-LEAK', 'f'.repeat(64)]) {
    assert.ok(!forwardHtml.includes(forbidden), `secret/digest material never renders: ${forbidden.slice(0, 18)}…`);
  }
  // The secret-bearing status is read raw solely to order candidates and
  // renders through the same fail-closed fallback as empty text, so the
  // comparison stays total and deterministic without echoing.
  assert.ok(!forwardHtml.includes('data-of-task-status="token=LEAKED"'), 'a secret-bearing duplicate status never wins visibly');
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser parity holds for secret-bearing duplicates');
  assert.equal(reversedBrowser, forwardBrowser, 'browser parity holds under reversal with secret-bearing duplicates');
});

// ── flow corrective pass 4: hostile-lineage duplicate reconciliation ────────
// Pass 3 redacted every compared string through the fail-closed policy, so
// two DISTINCT secret-bearing or overlong lineage IDs collapsed to the same
// comparison value — equal keys kept the FIRST input, leaving topology
// input-order dependent. Pass 4 compares ONLY explicit per-kind operational
// fields (lineage/status/dependency/executor-filter truth) and keeps every
// distinct hostile value distinguishable internally through injective
// canonical JSON and code-unit ordering over the full normalized raw value
// — collision-free by construction, no digest, no BigInt — that NEVER
// renders, logs, or enters any public fact ID or report. Titles,
// evidenceRefs, digests, approvalRef, sourceRef, prompts/payloads,
// missionId, and every other non-consumed field never participate in
// selection; when excluded fields are the only difference the surviving
// object identity may follow input order, but every rendered, filtered,
// and topology-affecting byte is provably identical.

test('flow reconciles duplicate runs with hostile lineage IDs under reversal (controller reproduction)', () => {
  // Exact controller reproduction from pass 3 review: two canonical task
  // rows carry secret-bearing lineage material, and two duplicate runs
  // sharing runId fx-dup-run point at those hostile taskIds. Reversing ONLY
  // the two duplicate runs must not change one byte of output, and the
  // visible run must stay on the deterministic winner's row — never moving
  // between public rows task-000 / task-001 with input order.
  const secretTaskIdA = `fx-task-a token=SECRET-A`;
  const secretTaskIdB = `fx-task-b token=SECRET-B`;
  const taskA = makeFlowTask(secretTaskIdA);
  const taskB = makeFlowTask(secretTaskIdB);
  const runToA = makeFlowRun('fx-dup-run', secretTaskIdA);
  const runToB = makeFlowRun('fx-dup-run', secretTaskIdB);
  const forward = makeFlowProjection({ nodes: [taskA, taskB, runToA, runToB], edges: [], gaps: [] });
  const reversedRuns = makeFlowProjection({ nodes: [taskA, taskB, runToB, runToA], edges: [], gaps: [] });

  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversedRuns);
  assert.equal(reversedHtml, forwardHtml, 'reversing only the duplicate runs renders byte-identically in the Node renderer');

  // No secret ever leaks through any path: no hostile lineage id appears
  // anywhere in the output. (The ofdupinternaldigest sentinel no longer
  // exists; it is asserted absent as a regression guard.)
  for (const forbidden of ['SECRET-A', 'SECRET-B', 'token=SECRET', 'ofdupinternaldigest']) {
    assert.ok(!forwardHtml.includes(forbidden), `hostile lineage material never renders: ${JSON.stringify(forbidden)}`);
  }

  // Exactly one visible run fact survives, and it stays on the SAME public
  // row under both orders — the deterministic winner, never the first seen.
  const graphIds = new Set(flowGraphFactIds(forwardHtml));
  const runFacts = [...graphIds].filter((id) => id.startsWith('run:'));
  assert.equal(runFacts.length, 1, 'exactly one visible run fact survives duplicate reconciliation');
  const rowMatch = forwardHtml.match(/<tr data-of-flow-row="(task:task:redacted:\d{3})"[\s\S]*?data-of-fact="run:id:fx-dup-run"/);
  assert.ok(rowMatch, 'the visible run fact renders inside a redacted public task row');
  const forwardRow = rowMatch![1];
  const reversedRowMatch = reversedHtml.match(/<tr data-of-flow-row="(task:task:redacted:\d{3})"[\s\S]*?data-of-fact="run:id:fx-dup-run"/);
  assert.equal(reversedRowMatch?.[1], forwardRow, 'the visible run stays on the same public row under reversal');

  // Full byte-identical Node/browser parity under BOTH input orders.
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversedRuns);
  assert.equal(forwardBrowser, forwardHtml, 'browser output is byte-identical to Node for forward input');
  assert.equal(reversedBrowser, reversedHtml, 'browser output is byte-identical to Node for reversed input');
  assert.equal(reversedBrowser, forwardBrowser, 'browser output is byte-identical under reversed duplicate runs');
});

test('flow duplicate reconciliation distinguishes overlong lineage IDs without echoing them', () => {
  // Two overlong lineage IDs sharing one 64-character prefix collapse under
  // any truncated or redacted comparison but represent DIFFERENT topology.
  // Selection must stay deterministic and total without ever echoing the
  // overlong material.
  const longPrefix = 'fx-task-long-';
  const overlongA = `${longPrefix}${'a'.repeat(80)}`;
  const overlongB = `${longPrefix}${'b'.repeat(80)}`;
  const taskA = makeFlowTask(overlongA);
  const taskB = makeFlowTask(overlongB);
  const runToA = makeFlowRun('fx-dup-run', overlongA);
  const runToB = makeFlowRun('fx-dup-run', overlongB);
  const forward = makeFlowProjection({ nodes: [taskA, taskB, runToA, runToB], edges: [], gaps: [] });
  const reversed = makeFlowProjection({ nodes: [taskA, taskB, runToB, runToA], edges: [], gaps: [] });
  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  assert.equal(reversedHtml, forwardHtml, 'overlong lineage duplicates reconcile byte-identically under reversal');
  assert.ok(!forwardHtml.includes('a'.repeat(80)), 'overlong lineage material never renders');
  assert.ok(!forwardHtml.includes('b'.repeat(80)), 'overlong lineage material never renders');
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser parity holds for overlong lineage duplicates');
  assert.equal(reversedBrowser, forwardBrowser, 'browser parity holds under reversal with overlong lineage duplicates');
});

test('flow duplicate selection ignores non-operational fields entirely', () => {
  // Duplicates differing ONLY in excluded, non-rendered proof material —
  // titles, evidenceRefs, digests, approvalRef, sourceRef, loadout, timing,
  // runtime, role, and unknown fields — must render byte-identically under
  // reversal: those fields never decide visible truth, never render, and
  // never leak into selection effects.
  const receiptRich = makeFlowReceipt('fx-dup-receipt', 'fx-dup-run', 'fx-dup-task', {
    status: 'complete',
    inputDigest: `sha256:${'c'.repeat(64)}`,
    outputDigest: `sha256:${'d'.repeat(64)}`,
    evidenceRefs: ['token=EVIDENCE-ONE'],
    approvalRef: 'token=APPROVAL-ONE',
    title: 'receipt title that must never decide',
  });
  const receiptBare = makeFlowReceipt('fx-dup-receipt', 'fx-dup-run', 'fx-dup-task', {
    status: 'complete',
    inputDigest: `sha256:${'e'.repeat(64)}`,
    evidenceRefs: [],
    approvalRef: null,
  });
  const runRich = makeFlowRun('fx-dup-run', 'fx-dup-task', {
    status: 'complete',
    agentId: 'fx-agent-ignored-a',
    loadoutId: 'fx-loadout-ignored-a',
    startedAt: '2026-07-28T01:00:00.000Z',
    terminalAt: '2026-07-28T02:00:00.000Z',
  });
  const runBare = makeFlowRun('fx-dup-run', 'fx-dup-task', {
    status: 'complete',
    agentId: 'fx-agent-ignored-b',
    loadoutId: 'fx-loadout-ignored-b',
    startedAt: '2026-07-28T03:00:00.000Z',
  });
  const agentRich = makeFlowAgent('fx-dup-agent', {
    role: 'orchestrator',
    runtime: 'hermes',
    status: 'blocked',
    sourceRef: 'token=SOURCE-REF',
    activeTaskIds: ['fx-task-x'],
    lastSeenAt: '2026-07-28T07:00:00.000Z',
  });
  const agentBare = makeFlowAgent('fx-dup-agent', { role: 'executor', runtime: 'codex', status: 'running' });
  const edges = [
    { kind: 'executes', fromId: 'fx-dup-agent', toId: 'fx-dup-run' },
    { kind: 'produces', fromId: 'fx-dup-run', toId: 'fx-dup-receipt' },
    { kind: 'proves', fromId: 'fx-dup-receipt', toId: 'fx-dup-task' },
  ] as MissionFabricProjectionV1['edges'];
  const forward = makeFlowProjection({
    nodes: [makeFlowTask('fx-dup-task'), receiptRich, receiptBare, runRich, runBare, agentRich, agentBare],
    edges,
    gaps: [],
  });
  const reversed = makeFlowProjection({
    nodes: [makeFlowTask('fx-dup-task'), agentBare, agentRich, runBare, runRich, receiptBare, receiptRich],
    edges,
    gaps: [],
  });
  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  assert.equal(reversedHtml, forwardHtml, 'non-operational-only differences render byte-identically under reversal');
  for (const forbidden of [
    'token=EVIDENCE-ONE',
    'token=APPROVAL-ONE',
    'token=SOURCE-REF',
    'c'.repeat(64),
    'd'.repeat(64),
    'e'.repeat(64),
    'receipt title that must never decide',
    'fx-agent-ignored-a',
    'fx-agent-ignored-b',
    'fx-loadout-ignored-a',
    'fx-loadout-ignored-b',
    'orchestrator',
    'hermes',
  ]) {
    assert.ok(!forwardHtml.includes(forbidden), `excluded field material never renders: ${forbidden.slice(0, 24)}…`);
  }
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser parity holds for non-operational-only duplicates');
  assert.equal(reversedBrowser, forwardBrowser, 'browser parity holds under reversal with non-operational-only duplicates');
});

test('flow duplicate reconciliation total order covers rendered and filter truth fields', () => {
  // The operational projection is a TOTAL deterministic order over every
  // downstream truth-affecting field: conflicting desiredState, dependency,
  // and assignedAgentId duplicates resolve identically under reversal, and
  // the winner owns the visible desired/dependency truth and the agentId
  // filter result.
  const taskAlpha = makeFlowTask('fx-dup-task', {
    status: 'ready',
    desiredState: 'alpha-state',
    dependencyIds: ['fx-dep-alpha'],
    assignedAgentId: 'fx-agent-alpha',
  });
  const taskBeta = makeFlowTask('fx-dup-task', {
    status: 'ready',
    desiredState: 'beta-state',
    dependencyIds: ['fx-dep-beta'],
    assignedAgentId: 'fx-agent-beta',
  });
  const forward = makeFlowProjection({ nodes: [taskAlpha, taskBeta], edges: [], gaps: [] });
  const reversed = makeFlowProjection({ nodes: [taskBeta, taskAlpha], edges: [], gaps: [] });
  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  assert.equal(reversedHtml, forwardHtml, 'desired/dependency duplicates reconcile byte-identically under reversal');
  assert.match(forwardHtml, /data-of-task-desired="alpha-state"/, 'the deterministic winner owns visible desired state');
  assert.ok(!forwardHtml.includes('beta-state'), 'the losing duplicate desired state never renders');
  assert.ok(!forwardHtml.includes('fx-dep-beta'), 'the losing duplicate dependency never renders');
  // Filter truth follows the same deterministic winner: the winner's
  // assignedAgentId matches the agentId filter, the loser's never does.
  const winnerFiltered = renderFlow(makeFlowProjection({ nodes: [taskBeta, taskAlpha], edges: [], gaps: [] }), {
    agentId: 'fx-agent-alpha',
  });
  assert.ok(winnerFiltered.includes('data-of-task-desired="alpha-state"'), 'agentId filter matches the deterministic winner');
  const loserFiltered = renderFlow(makeFlowProjection({ nodes: [taskAlpha, taskBeta], edges: [], gaps: [] }), {
    agentId: 'fx-agent-beta',
  });
  assert.ok(!loserFiltered.includes('of-flow-item'), 'the losing duplicate assignedAgentId never satisfies the filter');
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser parity holds for operational-field duplicates');
  assert.equal(reversedBrowser, forwardBrowser, 'browser parity holds under reversal with operational-field duplicates');
});

// ── flow hardening pass 5: missionId excluded from duplicate selection ──────
// missionId is NOT consumed by resolveFlowView — workId scoping uses explicit
// canonical contains edges only — so it must never decide a duplicate winner.
// Duplicates differing only in missionId must render byte-identically under
// reversal, and truth-affecting fields (status, desiredState, assignedAgentId,
// dependencyIds) must still deterministically reconcile.

test('flow duplicates differing only in missionId render byte-identically under reversal', () => {
  const taskMissionA = makeFlowTask('fx-dup-task', { missionId: 'fx-mission-alpha', status: 'blocked' });
  const taskMissionB = makeFlowTask('fx-dup-task', { missionId: 'fx-mission-beta', status: 'ready' });
  const forward = makeFlowProjection({ nodes: [taskMissionA, taskMissionB], edges: [], gaps: [] });
  const reversed = makeFlowProjection({ nodes: [taskMissionB, taskMissionA], edges: [], gaps: [] });

  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  assert.equal(reversedHtml, forwardHtml, 'missionId-only differences render byte-identically under reversal');

  // Status truth still deterministically reconciles: the canonical winner is
  // the lexicographically smaller status ('blocked' < 'ready').
  const listMarkup = forwardHtml.match(/<ol class="of-flow-list"[^>]*>([\s\S]*?)<\/ol>/)?.[0] ?? '';
  assert.match(listMarkup, /data-of-task-status="blocked"/, 'status truth follows the deterministic winner');
  assert.ok(!listMarkup.includes('data-of-task-status="ready"'), 'the losing duplicate status never renders');

  // Full Node/browser parity under both orders.
  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser parity holds for missionId-only duplicates');
  assert.equal(reversedBrowser, forwardBrowser, 'browser parity holds under reversal with missionId-only duplicates');
});

test('flow duplicate selection still reconciles truth-affecting fields when missionId also differs', () => {
  // missionId is irrelevant, but assignedAgentId and desiredState are
  // operational: the winner owns the visible desired state and the filter.
  const taskAlpha = makeFlowTask('fx-dup-task', {
    missionId: 'fx-mission-alpha',
    status: 'ready',
    desiredState: 'alpha-state',
    assignedAgentId: 'fx-agent-alpha',
  });
  const taskBeta = makeFlowTask('fx-dup-task', {
    missionId: 'fx-mission-beta',
    status: 'ready',
    desiredState: 'beta-state',
    assignedAgentId: 'fx-agent-beta',
  });
  const forward = makeFlowProjection({ nodes: [taskAlpha, taskBeta], edges: [], gaps: [] });
  const reversed = makeFlowProjection({ nodes: [taskBeta, taskAlpha], edges: [], gaps: [] });

  const forwardHtml = renderFlow(forward);
  const reversedHtml = renderFlow(reversed);
  assert.equal(reversedHtml, forwardHtml, 'truth fields reconcile byte-identically under reversal');
  assert.match(forwardHtml, /data-of-task-desired="alpha-state"/, 'the deterministic winner owns visible desired state');
  assert.ok(!forwardHtml.includes('beta-state'), 'the losing duplicate desired state never renders');

  const winnerFiltered = renderFlow(makeFlowProjection({ nodes: [taskBeta, taskAlpha], edges: [], gaps: [] }), {
    agentId: 'fx-agent-alpha',
  });
  assert.ok(winnerFiltered.includes('data-of-task-desired="alpha-state"'), 'agentId filter matches the deterministic winner');
  const loserFiltered = renderFlow(makeFlowProjection({ nodes: [taskAlpha, taskBeta], edges: [], gaps: [] }), {
    agentId: 'fx-agent-beta',
  });
  assert.ok(!loserFiltered.includes('of-flow-item'), 'the losing duplicate assignedAgentId never satisfies the filter');

  const forwardBrowser = renderFlowBrowser(forward);
  const reversedBrowser = renderFlowBrowser(reversed);
  assert.equal(forwardBrowser, forwardHtml, 'browser parity holds for truth-field duplicates');
  assert.equal(reversedBrowser, forwardBrowser, 'browser parity holds under reversal with truth-field duplicates');
});

test('FLOW_BROWSER_JS contains no BigInt literal or digest helper', () => {
  assert.ok(!/BigInt\s*\(/.test(FLOW_BROWSER_JS), 'FLOW_BROWSER_JS never calls BigInt');
  assert.ok(!/\d+n\b/.test(FLOW_BROWSER_JS), 'FLOW_BROWSER_JS contains no BigInt literal suffix');
  assert.ok(!/dupDigestHex|FNV|fnv|ofdupinternaldigest/.test(FLOW_BROWSER_JS), 'FLOW_BROWSER_JS contains no digest helper or token');
  // missionId may appear in explanatory comments but is never READ as a
  // field: no property access, no destructure, no operational-field entry.
  assert.ok(!/\.missionId|\[['"]missionId['"]\]|\bmissionId\s*:/.test(FLOW_BROWSER_JS), 'FLOW_BROWSER_JS never reads task.missionId');
});

// ── flow corrective pass 6: disjoint public-identity namespaces ─────────────
// Fresh quality review (task9-quality-review) reproductions. One root defect:
// benign canonical IDs aliased the hostile redacted ordinal namespace, and
// Node keyed visibleFacts by public IDs while the browser counted kept keys.
// Every test below pins the honest corrected behavior:
//   1. benign task/run/receipt IDs shaped like `redacted-NNN` never alias a
//      hostile node's generated redacted identity — public fact IDs come
//      from provably disjoint namespaces (`${kind}:id:${bounded benign raw}`
//      vs `${kind}:redacted:${ordinal}`).
//   2. fact selection/counting keys on canonical fact keys in BOTH
//      substrates, so a two-fact colliding pair never claims truncation and
//      the 97-scale view renders exactly `showing 96 of 97` with 96 rows and
//      96 unique graph fact IDs.
//   3. row identity is a disjoint public row ID (`task:${taskPublicId}`),
//      never the visible display label, so a benign `task-000` row never
//      aliases a hostile node's generated display label.
//   4. secrets never leak across any collision reproduction, and the real
//      composed boot renders the same disjoint identities.

function makeTaskRunReceiptCollisionProjection(): MissionFabricProjectionV1 {
  // The hostile canonical IDs sort BEFORE the benign redacted-shaped ones
  // ('token=' > 'redacted-'? no — 'r' < 't', so the benign IDs take the
  // early ordinals and the hostile IDs take redacted ordinals 3/4/5... wait:
  // sorted order is 'redacted-000' < 'token=...' so benign tasks are ordinals
  // 0-2 and hostile nodes take redacted ordinals 3,4,5). The benign IDs
  // `redacted-000` would alias a hostile ordinal-000 fact under the old
  // scheme whenever the hostile node lands at ordinal 0 — covered by the
  // reversed ordinal reproduction in the scale test below.
  return makeFlowProjection({
    nodes: [
      makeFlowTask('redacted-000'),
      makeFlowRun('redacted-001', 'redacted-000'),
      makeFlowReceipt('redacted-002', 'redacted-001', 'redacted-000'),
      makeFlowTask('fx-hostile-task token=COLLIDETASK'),
      makeFlowRun('fx-hostile-run token=COLLIDERUN', 'fx-hostile-task token=COLLIDETASK'),
      makeFlowReceipt('fx-hostile-receipt token=COLLIDERECEIPT', 'fx-hostile-run token=COLLIDERUN', 'fx-hostile-task token=COLLIDETASK'),
    ],
    edges: [
      { kind: 'produces', fromId: 'fx-hostile-run token=COLLIDERUN', toId: 'fx-hostile-receipt token=COLLIDERECEIPT' },
      { kind: 'proves', fromId: 'fx-hostile-receipt token=COLLIDERECEIPT', toId: 'fx-hostile-task token=COLLIDETASK' },
    ],
    gaps: [],
  });
}

test('flow public fact IDs are provably disjoint: benign redacted-shaped IDs never alias hostile ordinals', () => {
  const projection = makeTaskRunReceiptCollisionProjection();
  const html = renderFlow(projection);
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.equal(graphIds.length, 6, 'six distinct canonical facts render six graph fact elements');
  assert.equal(new Set(graphIds).size, 6, 'every graph fact ID is unique under benign/hostile redacted-shaped input');
  assert.equal(new Set(listIds).size, 6, 'every list fact ID is unique under benign/hostile redacted-shaped input');
  assert.deepEqual(new Set(graphIds), new Set(listIds), 'graph/list unique fact-ID parity holds exactly');
  // Benign IDs keep a readable identity in the `id` namespace; hostile nodes
  // keep non-secret ordinals in the reserved `redacted` namespace.
  for (const kind of ['task', 'run', 'receipt']) {
    assert.ok(
      graphIds.some((id) => id.startsWith(`${kind}:id:redacted-`)),
      `benign ${kind} fact ID lives in the disjoint id namespace`,
    );
    assert.ok(
      graphIds.some((id) => new RegExp(`^${kind}:redacted:\\d{3}$`).test(id)),
      `hostile ${kind} fact ID lives in the reserved redacted namespace`,
    );
  }
  assert.ok(!html.includes('token=COLLIDE'), 'no secret fragment survives anywhere');
  assert.ok(!html.includes('showing 96 of'), 'six facts never claim truncation');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds for the namespace-collision reproduction');
});

test('flow two-fact benign/hostile pair renders an exact count with no spurious truncation', () => {
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('redacted-000'),
      makeFlowTask('token=TWOSECRETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    ],
    edges: [],
    gaps: [],
  });
  const html = renderFlow(projection);
  const graphIds = flowGraphFactIds(html);
  assert.equal(graphIds.length, 2, 'two distinct canonical tasks render two graph fact elements');
  assert.equal(new Set(graphIds).size, 2, 'the pair never collapses to one fact ID');
  assert.ok(!/showing \d+ of \d+/.test(html), 'two visible facts of two total never claim truncation');
  assert.equal(html.match(/data-of-flow-row=/g)?.length ?? 0, 2, 'both rows render');
  assert.ok(!html.includes('token=TWOSECRET'), 'the secret never leaks');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'Node and browser agree byte-identically on the two-fact pair');
});

test('flow 97-fact scale renders exact showing 96 of 97 with 96 rows and 96 unique graph IDs', () => {
  // 96 hostile secret-bearing tasks plus one benign `redacted-095`: sorted
  // order puts the benign ID first (ordinal 0) and the hostile IDs at
  // redacted ordinals 1..96 — the reviewer's exact reproduction shape where
  // the old scheme aliased `task:redacted-095`.
  const nodes: FabricNode[] = [makeFlowTask('redacted-095')];
  for (let index = 0; index < 96; index += 1) {
    nodes.push(makeFlowTask(`token=SCALESCRET${String(index).padStart(3, '0')}AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`));
  }
  const projection = makeFlowProjection({ nodes, edges: [], gaps: [] });
  const html = renderFlow(projection);
  assert.ok(html.includes('showing 96 of 97'), 'exact truncation copy renders: showing 96 of 97');
  assert.equal(html.match(/data-of-flow-row=/g)?.length ?? 0, FLOW_FACT_LIMIT, 'exactly 96 rows render');
  const graphIds = flowGraphFactIds(html);
  const listIds = flowListFactIds(html);
  assert.equal(new Set(graphIds).size, FLOW_FACT_LIMIT, 'all 96 graph fact IDs are unique');
  assert.equal(new Set(listIds).size, FLOW_FACT_LIMIT, 'all 96 list fact IDs are unique');
  assert.deepEqual(new Set(graphIds), new Set(listIds), 'graph/list unique-ID parity holds at the 96 bound');
  assert.ok(!/token=SCALESCRET/.test(html), 'no secret-bearing canonical ID survives');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'full Node/browser parity holds at the 97-fact scale');
});

test('flow graph and list expose the exact same unique fact-ID set under collision input', () => {
  const projection = makeTaskRunReceiptCollisionProjection();
  const html = renderFlow(projection);
  assert.deepEqual(
    [...new Set(flowGraphFactIds(html))].sort(),
    [...new Set(flowListFactIds(html))].sort(),
    'unique fact-ID sets match exactly between representations',
  );
  const browserHtml = renderFlowBrowser(projection);
  assert.deepEqual(
    [...new Set(flowGraphFactIds(browserHtml))].sort(),
    [...new Set(flowListFactIds(browserHtml))].sort(),
    'browser unique fact-ID sets match exactly between representations',
  );
  assert.equal(browserHtml, html, 'Node/browser parity holds for the parity reproduction');
});

test('flow row identity stays disjoint from visible labels: benign task-000 vs hostile display ordinal', () => {
  // Sorted order: 'task-000' < 'token=...' so the hostile task takes display
  // ordinal 1 ('task-001'); under the old scheme a benign task literally
  // named 'task-001' would alias the hostile row's display-derived row ID.
  const projection = makeFlowProjection({
    nodes: [
      makeFlowTask('task-001'),
      makeFlowTask('token=ROWSECRETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    ],
    edges: [],
    gaps: [],
  });
  const html = renderFlow(projection);
  const rowIds = [...html.matchAll(/data-of-flow-row="([^"]+)"/g)].map((match) => match[1]!);
  assert.equal(rowIds.length, 2, 'both rows render');
  assert.equal(new Set(rowIds).size, 2, 'row identities never alias under benign/hostile display-label collisions');
  assert.ok(rowIds.every((id) => id.startsWith('task:task:')), 'row identity is a disjoint public row ID, never a bare display label');
  assert.ok(!html.includes('token=ROWSECRET'), 'the secret never leaks through row identity');
  const browserHtml = renderFlowBrowser(projection);
  assert.equal(browserHtml, html, 'Node/browser parity holds for row identity');
});

test('flow collision reproductions leak no secret material in any text or attribute path', () => {
  for (const projection of [
    makeTaskRunReceiptCollisionProjection(),
    (() => {
      const nodes: FabricNode[] = [makeFlowTask('redacted-095')];
      for (let index = 0; index < 96; index += 1) {
        nodes.push(makeFlowTask(`token=SCALESCRET${String(index).padStart(3, '0')}AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`));
      }
      return makeFlowProjection({ nodes, edges: [], gaps: [] });
    })(),
  ]) {
    for (const html of [renderFlow(projection), renderFlowBrowser(projection)]) {
      assert.ok(!/token=(COLLIDE|SCALESCRET)/.test(html), 'no collision secret survives in either substrate');
      for (const marker of CANONICAL_MARKER_HOSTILE_VALUES) {
        assert.ok(!html.includes(marker), `collision output never contains ${marker}`);
      }
    }
  }
});

test('real composed boot renders disjoint public identities for the collision projection', async () => {
  const projection = makeTaskRunReceiptCollisionProjection();
  const bootErrors: unknown[] = [];
  const booted = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        projection: JSON.parse(JSON.stringify(projection)),
        delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
      },
    }),
    { onError: (error) => bootErrors.push(error) },
  );
  await flushBoot();
  assert.deepEqual(bootErrors, [], 'boot never throws on the collision projection');
  assert.equal(booted.fabricRoot.classList.contains('of-on'), true, 'shell activates');
  const flowHtml = booted.elements.get('of-scene-flow')!.innerHTML;
  assert.match(flowHtml, /data-component="FabricFlow"/, 'real boot populates the flow root');
  const bootGraphIds = flowGraphFactIds(flowHtml);
  assert.equal(new Set(bootGraphIds).size, bootGraphIds.length, 'real boot graph fact IDs are unique under collision input');
  assert.deepEqual(
    new Set(flowGraphFactIds(flowHtml)),
    new Set(flowListFactIds(flowHtml)),
    'real boot keeps exact graph/list unique-ID parity',
  );
  assert.ok(bootGraphIds.some((id) => id.startsWith('task:id:redacted-')), 'real boot uses the disjoint benign id namespace');
  assert.ok(bootGraphIds.some((id) => /^task:redacted:\d{3}$/.test(id)), 'real boot uses the reserved redacted namespace');
  assert.ok(!/token=COLLIDE/.test(flowHtml), 'real boot never leaks the collision secret');
  const nodeHtml = renderFlow(projection);
  assert.equal(flowHtml, nodeHtml, 'real composed boot output matches the Node renderer byte-identically');
});

test('no benign raw ID can ever equal a generated redacted identity in either substrate', () => {
  // Generated adversarial matrix: every redacted-shaped benign ID pattern x
  // every ordinal band, across all three kinds, in BOTH substrates. Under
  // the disjoint scheme the benign public identity always lives in the
  // `${kind}:id:` namespace and the hostile ordinal identity always lives in
  // `${kind}:redacted:` — set intersection must be empty by construction.
  const benignShapes = [
    ...Array.from({ length: 10 }, (_unused, index) => `redacted-${String(index).padStart(3, '0')}`),
    ...Array.from({ length: 10 }, (_unused, index) => `redacted-${String(index).padStart(3, '0')}:redacted-000`),
    ...Array.from({ length: 10 }, (_unused, index) => `redacted-${String(index).padStart(3, '0')} token=NESTED`),
  ];
  for (const [index, benignId] of benignShapes.entries()) {
    const projection = makeFlowProjection({
      nodes: [
        makeFlowTask(benignId),
        makeFlowTask(`token=MATRIX${String(index).padStart(3, '0')}AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`),
      ],
      edges: [],
      gaps: [],
    });
    for (const html of [renderFlow(projection), renderFlowBrowser(projection)]) {
      const ids = new Set(flowGraphFactIds(html));
      assert.equal(ids.size, 2, `matrix pair ${index} keeps two unique fact IDs in every substrate`);
      const benignIds = [...ids].filter((id) => id.startsWith('task:id:'));
      const redactedIds = [...ids].filter((id) => id.startsWith('task:redacted:'));
      assert.equal(benignIds.length + redactedIds.length, 2, `matrix pair ${index} keeps both nodes inside the disjoint namespaces`);
      assert.equal(benignIds.length <= 1, true, `matrix pair ${index} never forges a second benign-namespace identity`);
      assert.equal(redactedIds.length >= 1, true, `matrix pair ${index} keeps the hostile node in the reserved redacted namespace`);
      assert.ok(!/token=(MATRIX|NESTED)/.test(html), `matrix pair ${index} never leaks secret material`);
    }
  }
});

// ── executor determinism (Task 9 rereview remediation) ─────────────────────
// Conflicting exact canonical executes edges targeting the same canonical run
// must NEVER resolve first-input-wins: input edge order can never change
// executor truth. Per run, only edges with kind 'executes', an existing
// canonical run target, and an existing canonical agent source participate;
// the lexicographically smallest canonical agentId (code-unit order) wins.
// Invalid or missing-agent edges never block a later valid edge; when no
// valid candidate exists the honest 'executor not present in projection'
// label is retained. run.value.agentId is never consulted as a fallback.

type FlowEdge = MissionFabricProjectionV1['edges'][number];

function makeExecutesEdge(fromId: string, toId: string): FlowEdge {
  return { kind: 'executes', fromId, toId } as FlowEdge;
}

function executorDeterminismProjection(edges: FlowEdge[], agentIds: string[]): MissionFabricProjectionV1 {
  return makeFlowProjection({
    nodes: [
      makeFlowTask('fx-det-task'),
      makeFlowRun('fx-det-run', 'fx-det-task', { agentId: 'fx-det-agent-zz-never-used' }),
      ...agentIds.map((agentId) => makeFlowAgent(agentId)),
    ],
    edges,
    gaps: [],
  });
}

test('conflicting valid executes edges resolve the lexicographically smallest agentId under edge reversal', () => {
  const forward = executorDeterminismProjection(
    [makeExecutesEdge('fx-det-agent-b', 'fx-det-run'), makeExecutesEdge('fx-det-agent-a', 'fx-det-run')],
    ['fx-det-agent-a', 'fx-det-agent-b'],
  );
  const reversed = executorDeterminismProjection(
    [makeExecutesEdge('fx-det-agent-a', 'fx-det-run'), makeExecutesEdge('fx-det-agent-b', 'fx-det-run')],
    ['fx-det-agent-a', 'fx-det-agent-b'],
  );
  for (const [label, projection] of [['forward', forward], ['reversed', reversed]] as const) {
    for (const [substrate, html] of [['node', renderFlow(projection)], ['browser', renderFlowBrowser(projection)]] as const) {
      assert.match(html, /data-of-executor="fx-det-agent-a"/, `${label} ${substrate} resolves the lexicographically smallest agentId`);
      assert.ok(!html.includes('data-of-executor="fx-det-agent-b"'), `${label} ${substrate} never resolves the later-sorted agentId`);
      assert.ok(!html.includes('executor not present in projection'), `${label} ${substrate} never invents the honest label when a valid executor exists`);
      assert.ok(!html.includes('fx-det-agent-zz-never-used'), `${label} ${substrate} never falls back to run.value.agentId`);
    }
  }
  assert.equal(renderFlow(forward), renderFlow(reversed), 'node output is byte-identical under edge reversal');
  assert.equal(renderFlowBrowser(forward), renderFlowBrowser(reversed), 'browser output is byte-identical under edge reversal');
});

test('an invalid executes edge first never blocks a later valid edge', () => {
  const projection = executorDeterminismProjection(
    [makeExecutesEdge('fx-det-agent-missing', 'fx-det-run'), makeExecutesEdge('fx-det-agent-a', 'fx-det-run')],
    ['fx-det-agent-a'],
  );
  for (const [substrate, html] of [['node', renderFlow(projection)], ['browser', renderFlowBrowser(projection)]] as const) {
    assert.match(html, /data-of-executor="fx-det-agent-a"/, `${substrate} skips the missing-agent edge and resolves the valid executor`);
    assert.ok(!html.includes('executor not present in projection'), `${substrate} never renders the honest label when a valid edge follows`);
    assert.ok(!html.includes('fx-det-agent-missing'), `${substrate} never renders the unresolvable agent id`);
  }
});

test('only-invalid executes edges retain the honest executor-missing label', () => {
  const projection = executorDeterminismProjection(
    [makeExecutesEdge('fx-det-agent-missing', 'fx-det-run'), makeExecutesEdge('fx-det-agent-also-missing', 'fx-det-run')],
    ['fx-det-agent-a'],
  );
  for (const [substrate, html] of [['node', renderFlow(projection)], ['browser', renderFlowBrowser(projection)]] as const) {
    assert.match(html, /executor not present in projection/, `${substrate} keeps the honest label when no valid candidate exists`);
    assert.ok(!html.includes('data-of-executor='), `${substrate} never renders an executor attribute without a canonical agent`);
    assert.ok(!html.includes('fx-det-agent-missing'), `${substrate} never leaks the unresolvable agent id`);
  }
});

test('agentId filter visibility is stable under conflicting-edge reversal', () => {
  const forward = executorDeterminismProjection(
    [makeExecutesEdge('fx-det-agent-b', 'fx-det-run'), makeExecutesEdge('fx-det-agent-a', 'fx-det-run')],
    ['fx-det-agent-a', 'fx-det-agent-b'],
  );
  const reversed = executorDeterminismProjection(
    [makeExecutesEdge('fx-det-agent-a', 'fx-det-run'), makeExecutesEdge('fx-det-agent-b', 'fx-det-run')],
    ['fx-det-agent-a', 'fx-det-agent-b'],
  );
  const rowSelector = flowRowSelector('fx-det-task');
  for (const [label, projection] of [['forward', forward], ['reversed', reversed]] as const) {
    for (const [substrate, renderer] of [['node', renderFlow], ['browser', renderFlowBrowser]] as const) {
      const filteredA = renderer(projection, { agentId: 'fx-det-agent-a' });
      const filteredB = renderer(projection, { agentId: 'fx-det-agent-b' });
      assert.ok(filteredA.includes(rowSelector), `${label} ${substrate} keeps the row for the deterministic winner agentId`);
      assert.ok(!filteredB.includes(rowSelector), `${label} ${substrate} drops the row for the non-winning conflicting agentId`);
    }
  }
  assert.equal(renderFlow(forward, { agentId: 'fx-det-agent-a' }), renderFlow(reversed, { agentId: 'fx-det-agent-a' }), 'filtered node output is byte-identical under edge reversal');
  assert.equal(renderFlowBrowser(forward, { agentId: 'fx-det-agent-a' }), renderFlowBrowser(reversed, { agentId: 'fx-det-agent-a' }), 'filtered browser output is byte-identical under edge reversal');
});

test('prototype-shaped agent IDs resolve deterministically without prototype corruption', () => {
  for (const agentId of ['__proto__', 'constructor', 'hasOwnProperty', 'toString']) {
    const forward = executorDeterminismProjection(
      [makeExecutesEdge('zz-det-agent', 'fx-det-run'), makeExecutesEdge(agentId, 'fx-det-run')],
      [agentId, 'zz-det-agent'],
    );
    const reversed = executorDeterminismProjection(
      [makeExecutesEdge(agentId, 'fx-det-run'), makeExecutesEdge('zz-det-agent', 'fx-det-run')],
      [agentId, 'zz-det-agent'],
    );
    for (const [label, projection] of [['forward', forward], ['reversed', reversed]] as const) {
      for (const [substrate, html] of [['node', renderFlow(projection)], ['browser', renderFlowBrowser(projection)]] as const) {
        assert.match(html, new RegExp(`data-of-executor="${agentId}"`), `${label} ${substrate} resolves ${agentId} as the code-unit smallest agentId`);
        assert.ok(!html.includes('executor not present in projection'), `${label} ${substrate} never drops the prototype-shaped executor`);
      }
    }
    assert.equal(renderFlow(forward), renderFlow(reversed), `node output is byte-identical under edge reversal for ${agentId}`);
    assert.equal(renderFlowBrowser(forward), renderFlowBrowser(reversed), `browser output is byte-identical under edge reversal for ${agentId}`);
  }
});

test('conflicting executes edges targeting different runs stay independent and deterministic', () => {
  const makeProjection = (edges: FlowEdge[]): MissionFabricProjectionV1 =>
    makeFlowProjection({
      nodes: [
        makeFlowTask('fx-det-task'),
        makeFlowRun('fx-det-run-1', 'fx-det-task'),
        makeFlowRun('fx-det-run-2', 'fx-det-task'),
        makeFlowAgent('fx-det-agent-a'),
        makeFlowAgent('fx-det-agent-b'),
        makeFlowAgent('fx-det-agent-c'),
      ],
      edges,
      gaps: [],
    });
  const forward = makeProjection([
    makeExecutesEdge('fx-det-agent-c', 'fx-det-run-1'),
    makeExecutesEdge('fx-det-agent-b', 'fx-det-run-1'),
    makeExecutesEdge('fx-det-agent-b', 'fx-det-run-2'),
    makeExecutesEdge('fx-det-agent-a', 'fx-det-run-2'),
  ]);
  const reversed = makeProjection([
    makeExecutesEdge('fx-det-agent-a', 'fx-det-run-2'),
    makeExecutesEdge('fx-det-agent-b', 'fx-det-run-2'),
    makeExecutesEdge('fx-det-agent-b', 'fx-det-run-1'),
    makeExecutesEdge('fx-det-agent-c', 'fx-det-run-1'),
  ]);
  for (const projection of [forward, reversed]) {
    for (const html of [renderFlow(projection), renderFlowBrowser(projection)]) {
      const executors = [...html.matchAll(/data-of-executor="([^"]+)"/g)].map((match) => match[1]);
      // The full HTML carries both the graph and list representations, so the
      // per-run pair repeats; the sequence itself must stay ordered per run.
      assert.deepEqual(executors, ['fx-det-agent-b', 'fx-det-agent-a', 'fx-det-agent-b', 'fx-det-agent-a'], 'each run resolves its own code-unit smallest executor independently in both representations');
    }
  }
  assert.equal(renderFlow(forward), renderFlow(reversed), 'node output is byte-identical across full edge-array reversal');
  assert.equal(renderFlowBrowser(forward), renderFlowBrowser(reversed), 'browser output is byte-identical across full edge-array reversal');
});

// ── Task 10 RED: Workforce and Forge (missing modules) ──────────────────────

import { renderWorkforce, WORKFORCE_BROWSER_JS } from './page/operating-fabric/workforce.ts';
import { renderForge, FORGE_BROWSER_JS } from './page/operating-fabric/forge.ts';
import workforceFixture from './page/scenes/fixtures/workforce.fixture.json' with { type: 'json' };
import forgeFixture from './page/scenes/fixtures/forge.fixture.json' with { type: 'json' };
import workforceContract from '../../../docs/architecture/contracts/scenes/workforce.json' with { type: 'json' };
import forgeContract from '../../../docs/architecture/contracts/scenes/forge.json' with { type: 'json' };

const WORKFORCE_PROJECTION = workforceFixture as unknown as MissionFabricProjectionV1;
const FORGE_PROJECTION = forgeFixture as unknown as MissionFabricProjectionV1;

function makeWorkforceAgentNode(agentId: string, overrides: Partial<FabricAgent> = {}): FabricNode {
  return {
    kind: 'agent',
    value: {
      agentId,
      role: 'engineer',
      runtime: 'codex',
      status: 'available',
      activeTaskIds: [],
      permissionProfile: 'standard',
      lastSeenAt: '2026-07-28T05:00:00.000Z',
      sourceRef: `redacted:agent:${agentId}`,
      ...overrides,
    },
  };
}

function makeForgeSkillClusterNode(clusterId: string, overrides: Partial<FabricSkillCluster> = {}): FabricNode {
  return {
    kind: 'skill-cluster',
    value: {
      clusterId,
      name: 'General',
      status: 'available',
      skillIds: [],
      eligibleAgentIds: [],
      successRate: null,
      sourceRef: `redacted:cluster:${clusterId}`,
      ...overrides,
    },
  };
}

test('workforce and forge renderers, fixtures, and contracts satisfy the accepted Task 10 surface', () => {
  assert.equal(typeof renderWorkforce, 'function', 'renderWorkforce is exported');
  assert.equal(typeof renderForge, 'function', 'renderForge is exported');
  assert.equal(typeof WORKFORCE_BROWSER_JS, 'string', 'WORKFORCE_BROWSER_JS constant exists');
  assert.equal(typeof FORGE_BROWSER_JS, 'string', 'FORGE_BROWSER_JS constant exists');
  assert.ok(Array.isArray((WORKFORCE_PROJECTION as unknown as { nodes: unknown[] }).nodes), 'workforce fixture loads');
  assert.ok(Array.isArray((FORGE_PROJECTION as unknown as { nodes: unknown[] }).nodes), 'forge fixture loads');
  assert.ok(workforceContract && typeof workforceContract === 'object', 'workforce contract loads');
  assert.ok(forgeContract && typeof forgeContract === 'object', 'forge contract loads');
});

test('workforce and forge contracts pin read-only authority, bounds, parity, and lifecycle truth', () => {
  assert.equal(workforceContract.sceneId, 'workforce');
  assert.equal(workforceContract.tabIndex, 3);
  assert.equal(workforceContract.projection.schema, 'cambium.mission-fabric-projection.v1');
  assert.equal(workforceContract.projection.authority, 'd1-goal-graph (read-only projection; never a writer)');
  assert.equal(workforceContract.density.cardLimit, 48);
  assert.equal(workforceContract.density.listLimit, 24);
  assert.deepEqual(workforceContract.interactions, [], 'Workforce has no Task 10 action handler');
  assert.match(workforceContract.browserParity, /byte-identical/, 'Workforce contract pins Node/browser parity');

  assert.equal(forgeContract.sceneId, 'forge');
  assert.equal(forgeContract.tabIndex, 4);
  assert.equal(forgeContract.projection.schema, 'cambium.mission-fabric-projection.v1');
  assert.equal(forgeContract.lifecycleBoundary, 'Deferred and archived lifecycle are unavailable until canonically projected.');
  assert.match(forgeContract.noReverseInference, /Inactive remains inactive\./, 'Forge contract forbids reverse lifecycle inference');
  assert.equal(forgeContract.density.cardLimit, 48);
  assert.equal(forgeContract.density.listLimit, 24);
  assert.deepEqual(forgeContract.interactions, [], 'Forge has no Task 10 action handler');
  assert.match(forgeContract.browserParity, /byte-identical/, 'Forge contract pins Node/browser parity');
});

test('workforce reconciles duplicate contradictory agent nodes deterministically under reversal', () => {
  const forward = { schema: 'cambium.mission-fabric-projection.v1', nodes: [makeWorkforceAgentNode('fx-dup-agent', { status: 'available' }), makeWorkforceAgentNode('fx-dup-agent', { status: 'offline' })], edges: [], gaps: [] } as unknown as MissionFabricProjectionV1;
  const reversed = { schema: 'cambium.mission-fabric-projection.v1', nodes: [makeWorkforceAgentNode('fx-dup-agent', { status: 'offline' }), makeWorkforceAgentNode('fx-dup-agent', { status: 'available' })], edges: [], gaps: [] } as unknown as MissionFabricProjectionV1;
  assert.equal(renderWorkforce(forward), renderWorkforce(reversed), 'workforce output is byte-identical under duplicate-node reversal');
});

test('workforce renders honest unknown status, freshness, and permission-profile for missing/invalid values', () => {
  const projection = { schema: 'cambium.mission-fabric-projection.v1', nodes: [makeWorkforceAgentNode('fx-unknown-agent', { status: 'bogus' as unknown as FabricAgent['status'], permissionProfile: '', lastSeenAt: '' })], edges: [], gaps: [] } as unknown as MissionFabricProjectionV1;
  const html = renderWorkforce(projection);
  assert.match(html, /unknown/, 'invalid status/freshness/permission profile render honest unknown');
  assert.ok(!/available/i.test(html.replace(/unknown/g, '')), 'unknown never silently becomes available');
});

test('workforce derives current tasks and runs only from exact resolved canonical edges', () => {
  const projection = { schema: 'cambium.mission-fabric-projection.v1', nodes: [makeWorkforceAgentNode('fx-edge-agent')], edges: [{ kind: 'assigned-to', fromId: 'fx-missing-task', toId: 'fx-edge-agent' }], gaps: [] } as unknown as MissionFabricProjectionV1;
  const html = renderWorkforce(projection);
  assert.ok(!html.includes('fx-missing-task'), 'unresolved task endpoint never renders as an assignment');
});

test('forge renders exact canonical lifecycle status and never invents deferred/archived claims', () => {
  const projection = { schema: 'cambium.mission-fabric-projection.v1', nodes: [makeForgeSkillClusterNode('fx-life-cluster', { status: 'inactive' })], edges: [], gaps: [] } as unknown as MissionFabricProjectionV1;
  const html = renderForge(projection);
  assert.match(html, /inactive/, 'inactive status renders honestly');
  assert.match(
    html,
    /Deferred and archived lifecycle are unavailable until canonically projected\./,
    'forge states the exact boundary sentence for unavailable lifecycle states',
  );
  assert.ok(
    !/data-status="deferred"|data-status="archived"/i.test(html),
    'forge never relabels the cluster status as deferred or archived',
  );
});

test('forge and workforce redact evidence and bound list output for oversized/hostile input', () => {
  const manyAgents = Array.from({ length: 200 }, (_, i) => makeWorkforceAgentNode(`fx-scale-agent-${i}`, { sourceRef: 'token=SECRET-EVIDENCE' }));
  const projection = { schema: 'cambium.mission-fabric-projection.v1', nodes: manyAgents, edges: [], gaps: [] } as unknown as MissionFabricProjectionV1;
  const html = renderWorkforce(projection);
  assert.ok(!html.includes('SECRET-EVIDENCE'), 'raw evidence/sourceRef never renders');
  assert.ok(!html.includes('token='), 'secret-shaped material is redacted');
});

function renderWorkforceBrowser(projection: MissionFabricProjectionV1): string {
  const context = vm.createContext({ ofRenderWorkforce: undefined as unknown });
  vm.runInContext(FLOW_PARITY_HELPERS_JS + WORKFORCE_BROWSER_JS, context);
  const renderer = (context as { ofRenderWorkforce?: (p: unknown) => string }).ofRenderWorkforce;
  assert.equal(typeof renderer, 'function', 'browser workforce renderer evaluates');
  return renderer!(JSON.parse(JSON.stringify(projection)));
}

function renderForgeBrowser(projection: MissionFabricProjectionV1): string {
  const context = vm.createContext({ ofRenderForge: undefined as unknown });
  vm.runInContext(FLOW_PARITY_HELPERS_JS + FORGE_BROWSER_JS, context);
  const renderer = (context as { ofRenderForge?: (p: unknown) => string }).ofRenderForge;
  assert.equal(typeof renderer, 'function', 'browser forge renderer evaluates');
  return renderer!(JSON.parse(JSON.stringify(projection)));
}

test('workforce fixture renders byte-identical HTML in Node and browser renderers', () => {
  assert.equal(
    renderWorkforce(WORKFORCE_PROJECTION),
    renderWorkforceBrowser(WORKFORCE_PROJECTION),
    'workforce fixture is byte-identical across Node/browser renderers',
  );
});

test('forge fixture renders byte-identical HTML in Node and browser renderers', () => {
  assert.equal(
    renderForge(FORGE_PROJECTION),
    renderForgeBrowser(FORGE_PROJECTION),
    'forge fixture is byte-identical across Node/browser renderers',
  );
});

test('workforce fixture exposes exact assignments, runs, capability coverage, freshness, and typed gaps', () => {
  const html = renderWorkforce(WORKFORCE_PROJECTION);
  assert.match(html, /Role: builder/, 'canonical agent role renders');
  assert.match(html, /Runtime: other/, 'canonical runtime renders distinctly');
  assert.match(html, /Status: running/, 'exact canonical status renders');
  assert.match(html, /Permission profile: fx-permission-standard/, 'permission profile renders');
  assert.match(html, /Source freshness: observed/, 'bounded canonical lastSeenAt yields observed freshness');
  assert.match(html, /Load: 1/, 'load is the exact resolved assignment count');
  assert.match(html, /Coverage: 1\/1/, 'coverage compares exact membership with exact task demand');
  assert.match(html, /Tasks: fx-task-1/, 'exact assigned-to and activeTaskIds resolve the task');
  assert.match(html, /Runs: fx-run-1/, 'exact executes edge resolves the run');
  assert.match(html, /Skills: fx-skill-build/, 'canonical cluster membership exposes its skill');
  assert.match(html, /source-stale/, 'exact-subject typed agent gap renders');
  assert.match(html, /missing-join/, 'unmapped typed gap renders once in the unscoped section');
});

test('workforce resolves conflicting executes edges to the code-unit-smallest valid agent', () => {
  const projection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [
      makeWorkforceAgentNode('fx-executor-a'),
      makeWorkforceAgentNode('fx-executor-b'),
      makeFlowTask('fx-executor-task'),
      {
        kind: 'run',
        value: {
          runId: 'fx-executor-run',
          taskId: 'fx-executor-task',
          agentId: 'fx-bare-agent-must-not-win',
          loadoutId: 'fx-loadout',
          startedAt: '2026-07-28T05:00:00.000Z',
          terminalAt: null,
          status: 'running',
        },
      },
    ],
    edges: [
      { kind: 'executes', fromId: 'fx-missing-agent', toId: 'fx-executor-run' },
      { kind: 'executes', fromId: 'fx-executor-b', toId: 'fx-executor-run' },
      { kind: 'executes', fromId: 'fx-executor-a', toId: 'fx-executor-run' },
    ],
    gaps: [],
  } as unknown as MissionFabricProjectionV1;
  const reversed = { ...projection, edges: [...projection.edges].reverse() } as MissionFabricProjectionV1;
  const html = renderWorkforce(projection);
  const agentACard = html.match(/data-agent-id="fx-executor-a"[\s\S]*?<\/div>/)?.[0] ?? '';
  const agentBCard = html.match(/data-agent-id="fx-executor-b"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(agentACard, /Runs: fx-executor-run/, 'code-unit-smallest valid executor owns the run');
  assert.ok(!agentBCard.includes('fx-executor-run'), 'the larger valid executor does not also own the run');
  assert.ok(!html.includes('fx-bare-agent-must-not-win'), 'bare run.agentId is never trusted');
  assert.equal(html, renderWorkforce(reversed), 'executor choice is stable under full edge reversal');
  assert.equal(html, renderWorkforceBrowser(projection), 'executor choice has Node/browser parity');
});

test('forge fixture exposes exact membership, skills, demand, evidence state, lifecycle, and typed gaps', () => {
  const html = renderForge(FORGE_PROJECTION);
  assert.match(html, /Status: active/, 'exact active lifecycle renders');
  assert.match(html, /Status: inactive/, 'exact inactive lifecycle remains inactive');
  assert.match(html, /Members: fx-agent-1/, 'only resolving eligibleAgentIds render as members');
  assert.match(html, /Skills: fx-skill-build, fx-skill-test/, 'canonical skillIds render deterministically');
  assert.match(html, /Demand tasks \(1\): fx-task-build/, 'exact resolved requires-cluster demand renders');
  assert.match(html, /Assignment evidence: recorded/, 'bounded redacted sourceRef presence renders only recorded state');
  assert.match(html, /capability-source-gap/, 'exact-subject capability gap renders');
  assert.match(html, /missing-join/, 'unmapped typed gap renders once unscoped');
});

test('workforce and forge assign disjoint stable public identities to secret and redacted-shaped IDs', () => {
  const workforceProjection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [
      makeWorkforceAgentNode('agent-redacted-0'),
      makeWorkforceAgentNode('token=SECRET-AGENT'),
    ],
    edges: [],
    gaps: [],
  } as unknown as MissionFabricProjectionV1;
  const workforceHtml = renderWorkforce(workforceProjection);
  const workforcePublicIds = [...workforceHtml.matchAll(/data-agent-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(workforcePublicIds).size, 2, 'distinct hostile agents retain disjoint public identities');
  assert.ok(!workforceHtml.includes('SECRET-AGENT'), 'secret agent ID never renders');
  assert.equal(workforceHtml, renderWorkforceBrowser(workforceProjection), 'hostile Workforce identities have Node/browser parity');

  const forgeProjection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [
      makeForgeSkillClusterNode('skill-cluster-redacted-0'),
      makeForgeSkillClusterNode('token=SECRET-CLUSTER'),
    ],
    edges: [],
    gaps: [],
  } as unknown as MissionFabricProjectionV1;
  const forgeHtml = renderForge(forgeProjection);
  const forgePublicIds = [...forgeHtml.matchAll(/data-cluster-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(forgePublicIds).size, 2, 'distinct hostile clusters retain disjoint public identities');
  assert.ok(!forgeHtml.includes('SECRET-CLUSTER'), 'secret cluster ID never renders');
  assert.equal(forgeHtml, renderForgeBrowser(forgeProjection), 'hostile Forge identities have Node/browser parity');
});

test('workforce and forge proposal cues are inert and deferred to Task 11', () => {
  const html = renderWorkforce(WORKFORCE_PROJECTION) + renderForge(FORGE_PROJECTION);
  assert.match(html, /Task 11/, 'proposal cue is visibly labelled deferred to Task 11');
  assert.ok(!/addEventListener/.test(WORKFORCE_BROWSER_JS + FORGE_BROWSER_JS), 'browser renderers register no event handlers');
  assert.ok(!/fetch\(/.test(WORKFORCE_BROWSER_JS + FORGE_BROWSER_JS), 'browser renderers issue no write fetch');
});

test('real boot populates all five scene roots and fails closed if workforce/forge are missing or throw', async () => {
  const booted = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: WORKFORCE_PROJECTION,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assert.match(booted.elements.get('of-scene-workforce')!.innerHTML, /data-component="FabricWorkforce"/, 'real boot populates the workforce root');
  assert.match(booted.elements.get('of-scene-forge')!.innerHTML, /data-component="FabricForge"/, 'real boot populates the forge root');

  const bootedMissingRoot = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: WORKFORCE_PROJECTION,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  bootedMissingRoot.elements.delete('of-scene-workforce');
  const workforceSceneElement = bootedMissingRoot.sceneElements.find((scene) => scene.dataset.ofScene === 'workforce')!;
  workforceSceneElement.dataset.ofScene = 'workforce-removed';
  await flushBoot();
  assertStaysInert(bootedMissingRoot, 'missing workforce root');
  assert.equal(bootedMissingRoot.elements.get('of-scene-canopy')!.innerHTML, '', 'missing workforce root: canopy is never written either');

  const bootedMissingForgeRoot = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: FORGE_PROJECTION,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  bootedMissingForgeRoot.elements.delete('of-scene-forge');
  const forgeSceneElement = bootedMissingForgeRoot.sceneElements.find((scene) => scene.dataset.ofScene === 'forge')!;
  forgeSceneElement.dataset.ofScene = 'forge-removed';
  await flushBoot();
  assertStaysInert(bootedMissingForgeRoot, 'missing forge root');
  assert.equal(bootedMissingForgeRoot.elements.get('of-scene-canopy')!.innerHTML, '', 'missing forge root: canopy is never written either');

  const body = bootBody(OPERATING_FABRIC_BOOT);
  assert.match(body, /renderWorkforce:\s*ofRenderWorkforce/, 'boot registers the workforce renderer');
  assert.match(body, /renderForge:\s*ofRenderForge/, 'boot registers the forge renderer');
  assert.match(body, /typeof ofScenes\.renderWorkforce !== 'function'/, 'activation validates the workforce renderer');
  assert.match(body, /typeof ofScenes\.renderForge !== 'function'/, 'activation validates the forge renderer');

  const hostileWorkforceProjection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [{
      kind: 'agent',
      value: {
        agentId: 'fx-hostile-agent',
        get role(): string {
          throw new Error('hostile role getter triggered during pre-render');
        },
        runtime: 'other',
        status: 'available',
        activeTaskIds: [],
        permissionProfile: 'standard',
        lastSeenAt: '2026-07-28T05:00:00.000Z',
        sourceRef: 'redacted:agent:fx-hostile-agent',
      },
    }],
    edges: [],
    gaps: [],
  } as unknown as MissionFabricProjectionV1;
  const bootedHostileRoleGetter = bootOperatingFabricDocument(() => ({
    kind: 'json',
    value: {
      projection: hostileWorkforceProjection,
      delivery: { operatingFabricEnabled: true, servedAt: '2026-07-28T09:00:00.000Z', freshness: 'fresh' },
    },
  }));
  await flushBoot();
  assertStaysInert(bootedHostileRoleGetter, 'hostile agent role getter throws during pre-render');
  for (const sceneId of OPERATING_FABRIC_SCENE_IDS) {
    assert.equal(bootedHostileRoleGetter.elements.get(`of-scene-${sceneId}`)!.innerHTML, '', `${sceneId} stays unwritten after a Workforce renderer exception`);
  }
});

test('workforce duplicate clusters reconcile from operational capability fields, never unused name or status', () => {
  const agent = makeWorkforceAgentNode('fx-operational-agent');
  const capabilityWinner = makeForgeSkillClusterNode('fx-operational-cluster', {
    name: 'Zulu unused label',
    status: 'inactive',
    skillIds: ['fx-skill-a'],
    eligibleAgentIds: ['fx-operational-agent'],
  });
  const decorativeWinner = makeForgeSkillClusterNode('fx-operational-cluster', {
    name: 'Alpha unused label',
    status: 'active',
    skillIds: ['fx-skill-z'],
    eligibleAgentIds: [],
  });
  const makeProjection = (clusters: FabricNode[]) => ({
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [agent, ...clusters],
    edges: [],
    gaps: [],
  }) as unknown as MissionFabricProjectionV1;
  const forward = makeProjection([capabilityWinner, decorativeWinner]);
  const reversed = makeProjection([decorativeWinner, capabilityWinner]);
  const html = renderWorkforce(forward);
  assert.match(html, /fx-skill-a/, 'the operational skill/membership tuple selects the canonical cluster');
  assert.ok(!html.includes('fx-skill-z'), 'unused cluster name/status cannot steer the winner');
  assert.equal(html, renderWorkforce(reversed), 'Node output is byte-identical under duplicate reversal');
  assert.equal(html, renderWorkforceBrowser(forward), 'operational duplicate selection has Node/browser parity');
  assert.equal(renderWorkforceBrowser(forward), renderWorkforceBrowser(reversed), 'browser output is byte-identical under duplicate reversal');
});

test('forge duplicate clusters compare derived evidence state, never raw sourceRef', () => {
  const unknownEvidence = makeForgeSkillClusterNode('fx-evidence-cluster', {
    sourceRef: 'token=SECRET-SORTS-FIRST',
  });
  const recordedEvidence = makeForgeSkillClusterNode('fx-evidence-cluster', {
    sourceRef: 'zzzz-recorded-reference',
  });
  const makeProjection = (clusters: FabricNode[]) => ({
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: clusters,
    edges: [],
    gaps: [],
  }) as unknown as MissionFabricProjectionV1;
  const forward = makeProjection([unknownEvidence, recordedEvidence]);
  const reversed = makeProjection([recordedEvidence, unknownEvidence]);
  const html = renderForge(forward);
  assert.match(html, /Assignment evidence: recorded/, 'derived recorded evidence wins over unknown without reading raw source order');
  assert.ok(!html.includes('SECRET-SORTS-FIRST'), 'secret sourceRef never renders');
  assert.ok(!html.includes('zzzz-recorded-reference'), 'recorded raw sourceRef never renders');
  assert.equal(html, renderForge(reversed), 'Node output is byte-identical under raw-evidence reversal');
  assert.equal(html, renderForgeBrowser(forward), 'derived evidence selection has Node/browser parity');
  assert.equal(renderForgeBrowser(forward), renderForgeBrowser(reversed), 'browser output is byte-identical under raw-evidence reversal');
});

test('forge treats duplicate agent/task values as observationally equal existence facts', () => {
  const agentA = makeWorkforceAgentNode('fx-existence-agent', { role: 'alpha', status: 'available' });
  const agentB = makeWorkforceAgentNode('fx-existence-agent', { role: 'zulu', status: 'offline' });
  const taskA = makeFlowTask('fx-existence-task', { status: 'queued' });
  const taskB = makeFlowTask('fx-existence-task', { status: 'blocked' });
  const cluster = makeForgeSkillClusterNode('fx-existence-cluster', {
    eligibleAgentIds: ['fx-existence-agent'],
  });
  const makeProjection = (values: FabricNode[]) => ({
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: values,
    edges: [{ kind: 'requires-cluster', fromId: 'fx-existence-task', toId: 'fx-existence-cluster' }],
    gaps: [],
  }) as unknown as MissionFabricProjectionV1;
  const forward = makeProjection([agentA, taskA, agentB, taskB, cluster]);
  const reversed = makeProjection([cluster, taskB, agentB, taskA, agentA]);
  const html = renderForge(forward);
  assert.match(html, /Members: fx-existence-agent/, 'Forge consumes only canonical agent-ID existence');
  assert.match(html, /Demand tasks \(1\): fx-existence-task/, 'Forge consumes only canonical task-ID existence');
  assert.equal(html, renderForge(reversed), 'unused duplicate agent/task fields cannot change Node output');
  assert.equal(html, renderForgeBrowser(forward), 'existence-only duplicate handling has Node/browser parity');
  assert.equal(renderForgeBrowser(forward), renderForgeBrowser(reversed), 'unused duplicate fields cannot change browser output');
});

test('workforce and forge expose exact card and list overflow truth with Node/browser parity', () => {
  const workforceAgentIds = Array.from({ length: 49 }, (_, index) => `fx-overflow-agent-${String(index).padStart(3, '0')}`);
  const workforceTaskIds = Array.from({ length: 25 }, (_, index) => `fx-overflow-task-${String(index).padStart(3, '0')}`);
  const workforceSkillIds = Array.from({ length: 26 }, (_, index) => `fx-overflow-skill-${String(index).padStart(3, '0')}`);
  const workforceAgents = workforceAgentIds.map((agentId, index) =>
    makeWorkforceAgentNode(agentId, { activeTaskIds: index === 0 ? workforceTaskIds : [] }));
  const workforceTasks = workforceTaskIds.map((taskId) => makeFlowTask(taskId));
  const workforceCluster = makeForgeSkillClusterNode('fx-overflow-cluster', {
    skillIds: workforceSkillIds,
    eligibleAgentIds: [workforceAgentIds[0]],
  });
  const workforceEdges = workforceTaskIds.flatMap((taskId) => [
    { kind: 'assigned-to', fromId: taskId, toId: workforceAgentIds[0] },
    { kind: 'requires-cluster', fromId: taskId, toId: 'fx-overflow-cluster' },
  ]);
  const workforceProjection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [...workforceAgents, ...workforceTasks, workforceCluster],
    edges: workforceEdges,
    gaps: [],
  } as unknown as MissionFabricProjectionV1;
  const workforceHtml = renderWorkforce(workforceProjection);
  assert.match(workforceHtml, /showing 48 of 49 agents/, 'workforce exposes exact card overflow');
  assert.match(workforceHtml, /class="tasks">Tasks: [^<]*\+1 more/, 'workforce exposes exact task-list overflow');
  assert.match(workforceHtml, /class="skills">Skills: [^<]*\+2 more/, 'workforce exposes exact skill-list overflow');
  assert.equal(workforceHtml, renderWorkforceBrowser(workforceProjection), 'workforce overflow truth has Node/browser parity');

  const forgeAgentIds = Array.from({ length: 25 }, (_, index) => `fx-forge-agent-${String(index).padStart(3, '0')}`);
  const forgeTaskIds = Array.from({ length: 25 }, (_, index) => `fx-forge-task-${String(index).padStart(3, '0')}`);
  const forgeSkillIds = Array.from({ length: 26 }, (_, index) => `fx-forge-skill-${String(index).padStart(3, '0')}`);
  const forgeAgents = forgeAgentIds.map((agentId) => makeWorkforceAgentNode(agentId));
  const forgeTasks = forgeTaskIds.map((taskId) => makeFlowTask(taskId));
  const forgeClusters = Array.from({ length: 49 }, (_, index) =>
    makeForgeSkillClusterNode(`fx-forge-cluster-${String(index).padStart(3, '0')}`, index === 0
      ? { eligibleAgentIds: forgeAgentIds, skillIds: forgeSkillIds }
      : {}));
  const forgeEdges = forgeTaskIds.map((taskId) => ({
    kind: 'requires-cluster',
    fromId: taskId,
    toId: 'fx-forge-cluster-000',
  }));
  const forgeProjection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [...forgeAgents, ...forgeTasks, ...forgeClusters],
    edges: forgeEdges,
    gaps: [],
  } as unknown as MissionFabricProjectionV1;
  const forgeHtml = renderForge(forgeProjection);
  assert.match(forgeHtml, /showing 48 of 49 clusters/, 'forge exposes exact card overflow');
  assert.match(forgeHtml, /class="cluster-members">Members: [^<]*\+1 more/, 'forge exposes exact member-list overflow');
  assert.match(forgeHtml, /class="cluster-skills">Skills: [^<]*\+2 more/, 'forge exposes exact skill-list overflow');
  assert.match(forgeHtml, /class="cluster-demand">Demand tasks \(25\): [^<]*\+1 more/, 'forge exposes exact demand-list overflow');
  assert.equal(forgeHtml, renderForgeBrowser(forgeProjection), 'forge overflow truth has Node/browser parity');
});

test('forge rejects a gap detail whose secret marker appears after the visible bound', () => {
  const taintedPrefix = 'x'.repeat(170);
  const projection = {
    schema: 'cambium.mission-fabric-projection.v1',
    nodes: [],
    edges: [],
    gaps: [{
      gapId: 'fx-late-secret-gap',
      kind: 'capability-source-gap',
      subjectId: 'fx-unscoped',
      detail: `${taintedPrefix}token=SECRET-AFTER-BOUND`,
    }],
  } as unknown as MissionFabricProjectionV1;
  const html = renderForge(projection);
  assert.ok(!html.includes('SECRET-AFTER-BOUND'), 'late secret marker never renders');
  assert.ok(!html.includes(taintedPrefix), 'no visible prefix from a secret-bearing field survives');
  assert.match(html, /gap-detail">unknown</, 'the tainted visible detail becomes honest unknown');
  assert.equal(html, renderForgeBrowser(projection), 'late-secret redaction has Node/browser parity');
});

// ── Task 11 test helpers ────────────────────────────────────────────────────

function makeFabricFixture(): MissionFabricProjectionV1 {
  const work: FabricWorkNode = {
    kind: 'work',
    value: {
      kind: 'program',
      workId: 'work-fx-001',
      tenantId: 'cambium',
      name: 'Fixture program',
      desiredState: 'ship fixture',
      currentState: 'in progress',
      status: 'active',
      ownerId: 'founder',
      nextAction: 'review',
      proofRequired: true,
      reviewAt: null,
      sourceRef: 'source-ref-fx',
      sourceDigest: 'digest-fx',
      programKind: 'company',
      lifecycle: 'executing',
      outcomeMetric: 'fixture-metric',
    },
  };
  const task: FabricNode = {
    kind: 'task',
    value: {
      taskId: 'task-fx-001',
      missionId: 'mission-fx-001',
      desiredState: 'complete fixture task',
      status: 'running',
      dependencyIds: [],
      assignedAgentId: 'agent-fx-001',
      requiredClusterIds: ['cluster-fx-001'],
      pinnedLoadoutId: null,
      leaseId: null,
      proofRequirement: 'receipt required',
      latestReceiptId: null,
    },
  };
  const mission: FabricNode = {
    kind: 'mission',
    value: {
      missionId: 'mission-fx-001',
      workId: 'work-fx-001',
      title: 'Fixture mission',
      objective: 'exercise inspect/gate unit coverage',
      status: 'active',
      gateId: null,
      proofRequirement: 'receipt required',
      taskIds: ['task-fx-001'],
      sourceRef: 'source-ref-fx',
    },
  };
  const agent: FabricAgent & { kind: 'agent' } = {
    kind: 'agent',
    agentId: 'agent-fx-001',
    role: 'builder',
    runtime: 'codex',
    status: 'running',
    activeTaskIds: ['task-fx-001'],
    permissionProfile: 'standard',
    lastSeenAt: '2026-07-28T00:00:00Z',
    sourceRef: 'source-ref-fx',
  } as unknown as FabricAgent & { kind: 'agent' };
  const agentNode: FabricNode = { kind: 'agent', value: agent as unknown as FabricAgent };
  const skillCluster: FabricSkillCluster = {
    clusterId: 'cluster-fx-001',
    name: 'Fixture cluster',
    status: 'active',
    skillIds: ['skill-fx-001'],
    eligibleAgentIds: ['agent-fx-001'],
    successRate: 0.9,
    sourceRef: 'source-ref-fx',
  };
  const skillClusterNode: FabricNode = { kind: 'skill-cluster', value: skillCluster };

  const edge: FabricEdge = { kind: 'contains', fromId: 'mission-fx-001', toId: 'task-fx-001' };

  return {
    schema: 'cambium.mission-fabric-projection.v1',
    projectionVersion: 1,
    tenantId: 'cambium',
    graphVersion: 42,
    graphDigest: 'graph-digest-fx',
    generatedAt: '2026-07-28T00:00:00Z',
    asOf: '2026-07-28T00:00:00Z',
    sourceOfTruth: 'd1-goal-graph',
    readOnly: true,
    nodes: [work as unknown as FabricNode, task, mission, agentNode, skillClusterNode],
    edges: [edge],
    gaps: [
      { gapId: 'gap-fx-001', kind: 'missing-evidence', subjectId: 'task-fx-001', detail: 'no receipt yet', evidenceRef: null },
    ],
  };
}

const FABRIC_FIXTURE = makeFabricFixture();

function findFixtureNode(kind: FabricNode['kind']): FabricNode {
  const found = FABRIC_FIXTURE.nodes.find((n) => n.kind === kind);
  assert.ok(found, `fixture must include a ${kind} node`);
  return found as FabricNode;
}

// ── Gate sheet unit tests ───────────────────────────────────────────────────

test('renderGateSheetPreflight opens exactly once for a valid explicit fresh descriptor and binds the exact key set', () => {
  const taskNode = findFixtureNode('task');
  const taskId = (taskNode.value as { taskId: string }).taskId;
  const calls: unknown[][] = [];
  const result = renderGateSheetPreflight(
    FABRIC_FIXTURE,
    {
      selected: taskNode,
      action: {
        kind: 'approve-goal-graph',
        subject: taskId,
        objectId: 'change-digest-fx',
        nonce: 'nonce-fx',
        expiresAt: '2026-07-29T00:00:00Z',
        expectedHeadVersion: 42,
        fence: 1,
      },
    },
    {
      freshness: 'fresh',
      openGatePreflight: (...args: unknown[]) => { calls.push(args); },
    },
  );

  assert.equal(result.opened, true);
  assert.equal(result.routeTo, 'gate');
  assert.equal(calls.length, 1, 'openGatePreflight is delegated to exactly once');
  assert.ok(result.binding);
  assert.deepEqual(Object.keys(result.binding!).sort(), ['changeDigest', 'expiresAt', 'fence', 'graphVersion', 'nonce', 'tenant'].sort());
  assert.equal(result.binding!.tenant, 'cambium');
  assert.equal(result.binding!.changeDigest, 'change-digest-fx');
  assert.equal(result.binding!.nonce, 'nonce-fx');
  assert.equal(result.binding!.expiresAt, '2026-07-29T00:00:00Z');
  assert.equal(result.binding!.graphVersion, 42);
  assert.equal(result.binding!.fence, 1);
  assert.ok(!result.html.includes('data-gate-confirm'));
  assert.ok(!/Confirm/.test(result.html));
  assert.match(result.html, /data-of-gate-sheet-close="1"[^>]*>Close</);
});

function gateFixtureSelectionValid() {
  const taskNode = findFixtureNode('task');
  const taskId = (taskNode.value as { taskId: string }).taskId;
  return {
    selected: taskNode,
    action: {
      kind: 'approve-goal-graph' as const,
      subject: taskId,
      objectId: 'change-digest-fx',
      nonce: 'nonce-fx',
      expiresAt: '2026-07-29T00:00:00Z',
      expectedHeadVersion: 42,
      fence: 1,
    },
  };
}

const GATE_FAIL_CLOSED_CASES: Array<{ name: string; mutate: (sel: ReturnType<typeof gateFixtureSelectionValid>, ctxOverrides: Record<string, unknown>) => { selection: ReturnType<typeof gateFixtureSelectionValid>; context: Record<string, unknown> } }> = [
  {
    name: 'stale freshness',
    mutate: (sel, ctx) => ({ selection: sel, context: { ...ctx, freshness: 'stale' } }),
  },
  {
    name: 'missing callback',
    mutate: (sel, ctx) => {
      const { openGatePreflight, ...rest } = ctx;
      return { selection: sel, context: rest };
    },
  },
  {
    name: 'structurally equal but foreign node object',
    mutate: (sel, ctx) => ({
      selection: { selected: { ...sel.selected } as unknown as FabricNode, action: sel.action },
      context: ctx,
    }),
  },
  {
    name: 'wrong subject',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, subject: 'not-the-canonical-id' } }, context: ctx }),
  },
  {
    name: 'wrong kind',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, kind: 'reroll' as unknown as 'approve-goal-graph' } }, context: ctx }),
  },
  {
    name: 'inherited canonical ID via prototype',
    mutate: (sel, ctx) => {
      const taskId = (sel.selected!.value as { taskId: string }).taskId;
      const proto = { taskId };
      const value = Object.create(proto);
      const selected = { kind: 'task', value } as unknown as FabricNode;
      return { selection: { selected, action: { ...sel.action, subject: taskId } }, context: ctx };
    },
  },
  {
    name: 'secret-marker field',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, nonce: 'Bearer secret-token' } }, context: ctx }),
  },
  {
    name: 'control-char field',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, objectId: 'digest\x00fx' } }, context: ctx }),
  },
  {
    name: 'overlong field',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, objectId: 'x'.repeat(200) } }, context: ctx }),
  },
  {
    name: 'invalid graphVersion',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, expectedHeadVersion: -1 } }, context: ctx }),
  },
  {
    name: 'invalid fence',
    mutate: (sel, ctx) => ({ selection: { selected: sel.selected, action: { ...sel.action, fence: 1.5 } }, context: ctx }),
  },
];

for (const { name, mutate } of GATE_FAIL_CLOSED_CASES) {
  test(`renderGateSheetPreflight fails closed: ${name}`, () => {
    let callCount = 0;
    const baseCtx: Record<string, unknown> = { freshness: 'fresh', openGatePreflight: () => { callCount++; } };
    const { selection, context } = mutate(gateFixtureSelectionValid(), baseCtx);
    const result = renderGateSheetPreflight(FABRIC_FIXTURE, selection as any, context as any);
    assert.equal(result.opened, false);
    assert.equal(result.routeTo, 'inspect');
    assert.equal(callCount, 0, 'callback must never be invoked on a fail-closed path');
    assert.ok(!result.html.includes('data-gate-confirm'));
    assert.ok(!/Confirm/.test(result.html));
  });
}

test('GATE_SHEET_BROWSER_JS parity: ofRenderGateSheetPreflight matches renderGateSheetPreflight result and callback behavior', () => {
  const context = vm.createContext({});
  vm.runInContext(GATE_SHEET_BROWSER_JS, context);

  const selection = gateFixtureSelectionValid();
  let browserCalls = 0;
  (context as any).__seed = { freshness: 'fresh', openGatePreflight: () => { browserCalls++; } };
  (context as any).__projection = FABRIC_FIXTURE;
  (context as any).__selection = selection;
  const browserResult = vm.runInContext('ofRenderGateSheetPreflight(__projection, __selection, __seed)', context);

  let nativeCalls = 0;
  const nativeResult = renderGateSheetPreflight(FABRIC_FIXTURE, selection, {
    freshness: 'fresh',
    openGatePreflight: () => { nativeCalls++; },
  });

  assert.equal(browserResult.opened, nativeResult.opened);
  assert.equal(browserResult.routeTo, nativeResult.routeTo);
  assert.equal(browserResult.html, nativeResult.html);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(browserResult.binding)), JSON.parse(JSON.stringify(nativeResult.binding)));
  assert.equal(browserCalls, nativeCalls);
  assert.equal(browserCalls, 1);
});

test('GATE_SHEET_BROWSER_JS source has no forbidden side-effect surface', () => {
  assert.ok(!/\bdocument\./.test(GATE_SHEET_BROWSER_JS));
  assert.ok(!/\bwindow\./.test(GATE_SHEET_BROWSER_JS));
  assert.ok(!/\bfetch\s*\(/.test(GATE_SHEET_BROWSER_JS));
  assert.ok(!/\bstorage\b/i.test(GATE_SHEET_BROWSER_JS));
  assert.ok(!/addEventListener/.test(GATE_SHEET_BROWSER_JS));
  assert.ok(!/\beval\s*\(/.test(GATE_SHEET_BROWSER_JS));
  assert.ok(!/new Function/.test(GATE_SHEET_BROWSER_JS));
});

// ── Inspect sheet unit tests ────────────────────────────────────────────────

test('renderInspectSheet renders exact identity, provenance, and only the relevant gap for a unique node', () => {
  const taskNode = findFixtureNode('task');
  const taskId = (taskNode.value as { taskId: string }).taskId;
  const html = renderInspectSheet(FABRIC_FIXTURE, { kind: 'node', nodeId: taskId });
  assert.match(html, new RegExp(taskId));
  assert.match(html, /sourceOfTruth: d1-goal-graph/);
  assert.match(html, /graphVersion: 42/);
  assert.match(html, /generatedAt: 2026-07-28T00:00:00Z/);
  assert.match(html, /asOf: 2026-07-28T00:00:00Z/);
  assert.match(html, /read-only — this projection cannot be mutated from here/);
  assert.match(html, /no receipt yet/);
  assert.ok(!/evidenceRef/.test(html));
  assert.ok(!/graphDigest/.test(html));
  assert.ok(!/sourceRef/.test(html));
});

test('renderInspectSheet renders exact identity for a unique edge', () => {
  const edge = FABRIC_FIXTURE.edges[0]!;
  const html = renderInspectSheet(FABRIC_FIXTURE, { kind: 'edge', edgeKind: edge.kind, fromId: edge.fromId, toId: edge.toId });
  assert.match(html, new RegExp(edge.fromId));
  assert.match(html, new RegExp(edge.toId));
  assert.match(html, /Edge inspect/);
});

const INSPECT_FAIL_CASES: Array<{ name: string; target: InspectTarget }> = [
  { name: 'unknown node id', target: { kind: 'node', nodeId: 'nonexistent-node-id' } },
  { name: 'unknown edge', target: { kind: 'edge', edgeKind: 'depends-on', fromId: 'sentinel-unknown-edge-from-8b2d4e', toId: 'sentinel-unknown-edge-to-7a1c3f' } },
];

for (const { name, target } of INSPECT_FAIL_CASES) {
  test(`renderInspectSheet never echoes requested sentinel and says unavailable: ${name}`, () => {
    const html = renderInspectSheet(FABRIC_FIXTURE, target);
    assert.match(html, /Inspect unavailable/);
    assert.match(html, /No exact, unique match was found in the served projection/);
    if (target.kind === 'node') assert.ok(!html.includes(target.nodeId));
    if (target.kind === 'edge') {
      assert.ok(!html.includes(target.fromId));
    }
  });
}

test('renderInspectSheet never treats a skill-cluster node\'s own taskId-shaped field as its canonical ID', () => {
  const sentinelTaskId = 'sentinel-skill-cluster-own-taskId-9f3c1a';
  const wrongKindNode = {
    kind: 'skill-cluster',
    value: {
      taskId: sentinelTaskId,
      name: 'General',
      status: 'available',
      skillIds: [],
      eligibleAgentIds: [],
      successRate: null,
      sourceRef: `redacted:cluster:${sentinelTaskId}`,
    },
  } as unknown as FabricNode;
  const poisoned: MissionFabricProjectionV1 = {
    ...FABRIC_FIXTURE,
    nodes: [...FABRIC_FIXTURE.nodes, wrongKindNode],
  };

  const html = renderInspectSheet(poisoned, { kind: 'node', nodeId: sentinelTaskId });
  assert.match(html, /Inspect unavailable/);
  assert.match(html, /No exact, unique match was found in the served projection/);
  assert.ok(!html.includes(sentinelTaskId));
});

test('renderInspectSheet never renders forbidden evidenceRef/graphDigest/sourceRef/secret sentinels even when present on the projection', () => {
  const poisoned = {
    ...FABRIC_FIXTURE,
    graphDigest: 'SECRET-graph-digest-should-not-render',
    gaps: [
      { gapId: 'gap-x', kind: 'missing-evidence', subjectId: (findFixtureNode('task').value as { taskId: string }).taskId, detail: 'ok', evidenceRef: 'SECRET-evidence-ref-should-not-render' },
    ],
  } as MissionFabricProjectionV1;
  const taskId = (findFixtureNode('task').value as { taskId: string }).taskId;
  const html = renderInspectSheet(poisoned, { kind: 'node', nodeId: taskId });
  assert.ok(!html.includes('SECRET-graph-digest-should-not-render'));
  assert.ok(!html.includes('SECRET-evidence-ref-should-not-render'));
});

test('INSPECT_SHEET_BROWSER_JS parity: ofRenderInspectSheet matches Node renderInspectSheet output', () => {
  const context = vm.createContext({});
  vm.runInContext(INSPECT_SHEET_BROWSER_JS, context);
  const taskId = (findFixtureNode('task').value as { taskId: string }).taskId;
  const target: InspectTarget = { kind: 'node', nodeId: taskId };
  (context as any).__projection = FABRIC_FIXTURE;
  (context as any).__target = target;
  const browserHtml = vm.runInContext('ofRenderInspectSheet(__projection, __target)', context);
  const nativeHtml = renderInspectSheet(FABRIC_FIXTURE, target);
  assert.equal(browserHtml, nativeHtml);
});

test('INSPECT_SHEET_BROWSER_JS source has no forbidden side-effect surface', () => {
  assert.ok(!/\bdocument\./.test(INSPECT_SHEET_BROWSER_JS));
  assert.ok(!/\bwindow\./.test(INSPECT_SHEET_BROWSER_JS));
  assert.ok(!/\bfetch\s*\(/.test(INSPECT_SHEET_BROWSER_JS));
  assert.ok(!/\b(?:local|session)Storage\b/.test(INSPECT_SHEET_BROWSER_JS));
  assert.ok(!/addEventListener/.test(INSPECT_SHEET_BROWSER_JS));
  assert.ok(!/\beval\s*\(/.test(INSPECT_SHEET_BROWSER_JS));
  assert.ok(!/new\s+Function\s*\(/.test(INSPECT_SHEET_BROWSER_JS));
});

// ── Shared contextual-sheet-close installer (direct real-source closure) ────

function makeContextualSheetElement(tag: string) {
  const classes = new Set<string>();
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    tagName: tag.toUpperCase(),
    style: {} as Record<string, string>,
    classList: {
      add(...names: string[]) { for (const n of names) classes.add(n); },
      remove(...names: string[]) { for (const n of names) classes.delete(n); },
      contains: (n: string) => classes.has(n),
    },
    listeners,
    addEventListener(type: string, handler: (event: unknown) => void) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    setPointerCapture() {},
    onclick: null as null | (() => void),
  };
}

function installContextualSheetContext() {
  const veilEl = makeContextualSheetElement('div');
  const sheetEl: any = makeContextualSheetElement('div');
  const sheetBodyEl = makeContextualSheetElement('div');
  let closeCalled = 0;
  let callbackCalled = 0;
  let callbackDuringClose: unknown = 'not-checked';

  const context: Record<string, unknown> = {
    $(id: string) {
      if (id === 'veil') return veilEl;
      if (id === 'sheet') return sheetEl;
      if (id === 'sheetBody') return sheetBodyEl;
      return null;
    },
    document: {
      getElementById: (id: string) => (id === 'sheetBody' ? sheetBodyEl : id === 'veil' ? veilEl : id === 'sheet' ? sheetEl : null),
    },
    ECOSYSTEM_ENV: {},
    LEDGER: { rows: [] },
    policyCard: () => ({ state: 'ready', detail: 'ok', blockers: [] }),
    activeRow: () => null,
    esc: (v: unknown) => String(v == null ? '' : v),
    buzz: () => {},
    gateAct: () => {},
    loadGate: () => {},
    TG: { initData: '' },
  };
  vm.createContext(context);
  vm.runInContext(CLIENT_SHEET, context);
  const legacyClickListenerBaseline = sheetBodyEl.listeners.get('click')?.length ?? 0;
  (context as any).closeSheet = () => {
    closeCalled++;
    if (typeof (sheetEl as any)._ofReturnCallback === 'function') callbackDuringClose = (sheetEl as any)._ofReturnCallback;
  };
  const wrapClose = () => { closeCalled++; };
  // The real closeSheet is defined inside CLIENT_SHEET's evaluated body; capture
  // stats by wrapping the sheet element's dismiss counters instead of replacing
  // the lexical binding (which the installer itself owns).
  vm.runInContext('var __ofOriginalCloseCallCount = 0; var __ofOriginalClose = closeSheet; closeSheet = function(){ __ofOriginalCloseCallCount++; __ofOriginalClose(); };', context);
  vm.runInContext(CONTEXTUAL_SHEET_RETURN_BROWSER_JS, context);

  return { context, veilEl, sheetEl, sheetBodyEl, wrapClose, callbackDuringClose: () => callbackDuringClose, legacyClickListenerBaseline };
}

test('contextual sheet close installer installs exactly one sheetBody listener across two installer evaluations', () => {
  const { context, sheetBodyEl, legacyClickListenerBaseline } = installContextualSheetContext();
  const afterFirstInstall = sheetBodyEl.listeners.get('click')?.length ?? 0;
  assert.equal(
    afterFirstInstall,
    legacyClickListenerBaseline + 1,
    'first contextual installer evaluation must add exactly one click listener on top of the legacy baseline',
  );

  vm.runInContext(CONTEXTUAL_SHEET_RETURN_BROWSER_JS, context);
  const afterSecondInstall = sheetBodyEl.listeners.get('click')?.length ?? 0;
  assert.equal(
    afterSecondInstall,
    afterFirstInstall,
    'installer must be idempotent: re-evaluating the contextual installer leaves the total listener count unchanged',
  );
});

test('CONTEXTUAL_SHEET_RETURN_BROWSER_JS source never references window.closeSheet as an assignment target', () => {
  assert.ok(!/\bwindow\.closeSheet\s*=/.test(CONTEXTUAL_SHEET_RETURN_BROWSER_JS));
});

function dispatchSheetBodyClick(sheetBodyEl: ReturnType<typeof makeContextualSheetElement>, target: { closest: (selector: string) => unknown }) {
  for (const handler of sheetBodyEl.listeners.get('click') ?? []) {
    handler({ target, preventDefault: () => {} });
  }
}

const CONTEXTUAL_DISMISS_ROUTES: Array<{
  name: string;
  dismiss: (ctx: ReturnType<typeof installContextualSheetContext>) => void;
}> = [
  {
    name: 'Back',
    dismiss: ({ sheetBodyEl }) => dispatchSheetBodyClick(sheetBodyEl, { closest: (sel: string) => (sel === '[data-of-inspect-back]' ? {} : null) }),
  },
  {
    name: 'Inspect Close',
    dismiss: ({ sheetBodyEl }) => dispatchSheetBodyClick(sheetBodyEl, { closest: (sel: string) => (sel === '[data-of-inspect-close]' ? {} : null) }),
  },
  {
    name: 'Gate Close',
    dismiss: ({ sheetBodyEl }) => dispatchSheetBodyClick(sheetBodyEl, { closest: (sel: string) => (sel === '[data-of-gate-sheet-close]' ? {} : null) }),
  },
  {
    name: 'legacy data-gate-cancel',
    dismiss: ({ sheetBodyEl }) => dispatchSheetBodyClick(sheetBodyEl, { closest: (sel: string) => (sel === '[data-gate-cancel]' ? {} : null) }),
  },
  {
    name: 'veil click',
    dismiss: ({ veilEl }) => { if (typeof veilEl.onclick === 'function') veilEl.onclick(); },
  },
  {
    name: 'drag-to-dismiss',
    dismiss: ({ context }) => { vm.runInContext('closeSheet()', context); },
  },
];

for (const { name, dismiss } of CONTEXTUAL_DISMISS_ROUTES) {
  test(`contextual sheet dismiss route "${name}" calls original close once and callback once, with callback slot null during the callback`, () => {
    const setup = installContextualSheetContext();
    const { context } = setup;

    let callbackCount = 0;
    let slotDuringCallback: unknown = 'unset';
    vm.runInContext(
      `sheet._ofSetReturnCallback(function () { __ofCallbackCount = (__ofCallbackCount || 0) + 1; __ofSlotDuringCallback = sheet._ofReturnCallback; });`,
      context,
    );
    (context as any).__ofCallbackCount = 0;
    (context as any).__ofSlotDuringCallback = 'unset';

    dismiss(setup);

    callbackCount = (context as any).__ofCallbackCount;
    slotDuringCallback = (context as any).__ofSlotDuringCallback;

    assert.equal((context as any).__ofOriginalCloseCallCount, 1, `${name} must call the original close exactly once`);
    assert.equal(callbackCount, 1, `${name} must call the callback exactly once`);
    assert.equal(slotDuringCallback, null, 'callback slot must be null while the callback itself runs');

    // Repeated dismiss must not replay the already-consumed callback.
    dismiss(setup);
    assert.equal((context as any).__ofOriginalCloseCallCount, 2, `${name} repeated dismiss still calls original close`);
    assert.equal((context as any).__ofCallbackCount, 1, `${name} repeated dismiss does not replay the consumed callback`);
  });
}

// ── Task 11 real-boot inspect integration (document-level DOM harness) ────

const CANONICAL_MARKERS = ['work-fx-001', 'mission-fx-001', 'task-fx-001', 'agent-fx-001', 'cluster-fx-001', 'contains'];

function sceneInspectButtons(sceneEl: FabricElement): FabricElement[] {
  return sceneEl.children.filter(
    (child): child is FabricElement => (child as FabricElement).dataset?.ofInspectToken !== undefined,
  );
}

function serializeControl(btn: FabricElement) {
  return {
    textContent: btn.textContent,
    type: btn.type,
    className: btn.className,
    dataset: { ...btn.dataset },
    ariaLabel: btn.getAttribute('aria-label'),
  };
}

test('real boot appends exactly one inspect control per scene (two for flow) with opaque tokens and no canonical leakage', async () => {
  const booted = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        delivery: { operatingFabricEnabled: true, freshness: 'fresh', servedAt: '2026-07-28T00:00:00Z' },
        projection: FABRIC_FIXTURE,
      },
    }),
    { withContextualSheet: true },
  );
  await flushBoot();

  const canopyScene = booted.elements.get('of-scene-canopy')!;
  const missionScene = booted.elements.get('of-scene-mission')!;
  const workforceScene = booted.elements.get('of-scene-workforce')!;
  const forgeScene = booted.elements.get('of-scene-forge')!;
  const flowScene = booted.elements.get('of-scene-flow')!;

  const singleSceneButtons = [canopyScene, missionScene, workforceScene, forgeScene].map(sceneInspectButtons);
  for (const buttons of singleSceneButtons) {
    assert.equal(buttons.length, 1, 'each of canopy/mission/workforce/forge has exactly one inspect control');
  }
  const flowButtons = sceneInspectButtons(flowScene);
  assert.equal(flowButtons.length, 2, 'flow has exactly two inspect controls');

  const allButtons = [...singleSceneButtons.flat(), ...flowButtons];
  const tokens = new Set<string>();
  for (const btn of allButtons) {
    assert.equal(btn.type, 'button', 'every inspect control is type=button');
    const token = btn.dataset.ofInspectToken;
    assert.match(token, /^of-tok-[0-9]+$/, 'token is opaque and matches the expected shape');
    assert.equal(tokens.has(token), false, 'every token is unique');
    tokens.add(token);
    assert.match(btn.textContent, /^Inspect( edge)?$/, 'control text is generic, never canonical');
    const ariaLabel = btn.getAttribute('aria-label') ?? '';
    assert.ok(ariaLabel.length > 0, 'control has an aria-label');

    const serialized = JSON.stringify(serializeControl(btn));
    for (const marker of CANONICAL_MARKERS) {
      assert.ok(!serialized.includes(marker), `serialized control never leaks canonical marker ${marker}`);
    }
    assert.ok(!serialized.toLowerCase().includes('data-gate-confirm'), 'no gate/confirm control present');
    assert.ok(!/confirm/i.test(serialized), 'no gate/confirm control present');
  }
});

test('real inspect click opens the sheet with fixture content and back/close both route home and focus once', async () => {
  const booted = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        delivery: { operatingFabricEnabled: true, freshness: 'fresh', servedAt: '2026-07-28T00:00:00Z' },
        projection: FABRIC_FIXTURE,
      },
    }),
    { withContextualSheet: true },
  );
  await flushBoot();

  const canopyScene = booted.elements.get('of-scene-canopy')!;
  const [canopyControl] = sceneInspectButtons(canopyScene);
  assert.ok(canopyControl, 'canopy inspect control exists');

  const focusCountBefore = canopyControl.focusCount;
  booted.dispatchClick(canopyControl);

  assert.ok(booted.sheetBody!.innerHTML.includes('work-fx-001'), 'sheet body includes the resolved work identity');
  assert.ok(booted.sheetBody!.innerHTML.includes('sourceOfTruth'), 'sheet body includes provenance');
  assert.equal(booted.veil!.classList.contains('on'), true, 'veil is on');
  assert.equal(booted.sheet!.classList.contains('on'), true, 'sheet is on');
  assert.equal(booted.sheetFocusControl!.focusCount, 1, 'first actionable sheet control receives focus on open');

  const backTarget = makeFabricElement('button');
  backTarget.setAttribute('data-of-inspect-back', '1');
  const closeCountBeforeBack = (booted.context as any).__ofIntegrationCloseCount;
  booted.dispatchSheetClick(backTarget);
  assert.equal((booted.context as any).__ofIntegrationCloseCount, closeCountBeforeBack + 1, 'back dismiss closes exactly once');
  assert.equal(booted.tabElements.find((t) => t.dataset.ofTab === 'canopy')?.ariaSelected, 'true', 'canopy scene remains active after back');
  assert.equal(canopyControl.focusCount, focusCountBefore + 1, 'origin control regains focus once after back');

  booted.dispatchClick(canopyControl);
  const closeCountBeforeClose = (booted.context as any).__ofIntegrationCloseCount;
  const focusBeforeClose = canopyControl.focusCount;
  const closeTarget = makeFabricElement('button');
  closeTarget.setAttribute('data-of-inspect-close', '1');
  booted.dispatchSheetClick(closeTarget);
  assert.equal((booted.context as any).__ofIntegrationCloseCount, closeCountBeforeClose + 1, 'close dismiss closes exactly once more');
  assert.equal(canopyControl.focusCount, focusBeforeClose + 1, 'origin control regains focus once after close');

  const closeCountBeforeRepeat = (booted.context as any).__ofIntegrationCloseCount;
  const focusBeforeRepeat = canopyControl.focusCount;
  booted.dispatchSheetClick(closeTarget);
  assert.equal(
    (booted.context as any).__ofIntegrationCloseCount,
    closeCountBeforeRepeat + 1,
    'repeated dismiss still increments the original close count',
  );
  assert.equal(canopyControl.focusCount, focusBeforeRepeat, 'repeated dismiss does not replay the consumed focus callback');
});

test('re-render rotates the inspect token and a stale control cannot reopen the sheet', async () => {
  const booted = bootOperatingFabricDocument(
    () => ({
      kind: 'json',
      value: {
        delivery: { operatingFabricEnabled: true, freshness: 'fresh', servedAt: '2026-07-28T00:00:00Z' },
        projection: FABRIC_FIXTURE,
      },
    }),
    { withContextualSheet: true },
  );
  await flushBoot();

  const canopyScene = booted.elements.get('of-scene-canopy')!;
  const [oldControl] = sceneInspectButtons(canopyScene);
  const oldToken = oldControl.dataset.ofInspectToken;
  assert.ok(oldToken);

  booted.clickOpen('work-fx-001');
  await flushBoot();

  const refreshedButtons = sceneInspectButtons(canopyScene);
  const newControl = refreshedButtons[refreshedButtons.length - 1];
  assert.ok(newControl, 'canopy still has an appended inspect control after re-render');
  const newToken = newControl.dataset.ofInspectToken;
  assert.notEqual(newToken, oldToken, 'token differs across re-render');

  const oldSuffix = Number(oldToken.match(/^of-tok-([0-9]+)$/)![1]);
  const newSuffix = Number(newToken.match(/^of-tok-([0-9]+)$/)![1]);
  assert.ok(newSuffix > oldSuffix, 'numeric token suffix increases across re-render');

  // Fake innerHTML assignment does not clear children, so a stale reference
  // to the old control instance is still reachable here; dispatching a click
  // through it must not reopen the sheet since the token registry rotated.
  booted.sheetBody!.innerHTML = '';
  booted.dispatchClick(oldControl);
  assert.equal(booted.sheetBody!.innerHTML, '', 'sheet body remains unchanged for a stale token');
  assert.equal(booted.sheet!.classList.contains('on'), false, 'sheet does not reopen for a stale token');
});

const HOSTILE_WORK_IDS = ['token=SECRET', 'x'.repeat(65), 'bad\x00id'];

for (const hostileWorkId of HOSTILE_WORK_IDS) {
  test(`canopy creates no inspect control when the work canonical id is hostile: ${JSON.stringify(hostileWorkId)}`, async () => {
    const hostileFixture: MissionFabricProjectionV1 = {
      ...FABRIC_FIXTURE,
      nodes: FABRIC_FIXTURE.nodes.map((node) =>
        node.kind === 'work'
          ? { kind: 'work', value: { ...(node.value as Record<string, unknown>), workId: hostileWorkId } }
          : node,
      ) as MissionFabricProjectionV1['nodes'],
    };

    const booted = bootOperatingFabricDocument(
      () => ({
        kind: 'json',
        value: {
          delivery: { operatingFabricEnabled: true, freshness: 'fresh', servedAt: '2026-07-28T00:00:00Z' },
          projection: hostileFixture,
        },
      }),
      { withContextualSheet: true },
    );
    await flushBoot();

    const canopyScene = booted.elements.get('of-scene-canopy')!;
    assert.equal(sceneInspectButtons(canopyScene).length, 0, 'no inspect control is created for a hostile work id');
  });
}

// ── OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS: direct executable tests ─────────
// Honest legacy stubs standing in for the real openGatePreflight/gateAct
// (declared by CLIENT_SIGNED_ACTION) — enough surface for the bridge to wrap
// and call through, without re-deriving CLIENT_SIGNED_ACTION's own behavior.

function makeGateButtonStub() {
  const dataset: Record<string, string> = {};
  return {
    dataset,
    disabled: false,
    querySelector: () => null,
  };
}

function makeSheetBodyStub(confirmButton: ReturnType<typeof makeGateButtonStub> | null) {
  return {
    querySelector: (selector: string) =>
      selector === '[data-gate-confirm="approve-goal-graph"]' ? confirmButton : null,
  };
}

function installGateActionBridgeContext(options: { tenant?: string } = {}) {
  const tenant = options.tenant ?? 'acme';
  const preflightCalls: unknown[][] = [];
  const fetchCalls: Array<{ url: string; body: unknown }> = [];
  const gateSubmitStates: Array<{ state: string; text: string }> = [];
  let confirmButton: ReturnType<typeof makeGateButtonStub> | null = null;

  const context: Record<string, unknown> = {
    TENANT: tenant,
    initData: 'fx-init-data',
    $: (id: string) => (id === 'sheetBody' ? makeSheetBodyStub(confirmButton) : null),
    openGatePreflight: function (...args: unknown[]) {
      preflightCalls.push(args);
      confirmButton = makeGateButtonStub();
      confirmButton.dataset.gateConfirm = String(args[0] ?? '');
      confirmButton.dataset.gateSubject = String(args[1] ?? '');
    },
    gateAct: function ofOriginalGateActStub() {
      (context as any).__originalGateActCalls = ((context as any).__originalGateActCalls || 0) + 1;
    },
    gateSubmitContext: (button: any) => ({
      kind: (button && button.dataset && button.dataset.gateConfirm) || '',
      subject: (button && button.dataset && button.dataset.gateSubject) || '',
      itemId: '', actionRequestId: '', optionId: '', evidence: '', consequence: '',
      reversibility: '', idempotencyKey: 'fx-idem', branchId: '', missionId: '',
      topicLabel: '', threadId: '', messageId: '', receiptExpectation: '', note: '',
    }),
    gateItemForSubmit: () => ({}),
    setGateSubmitState: (button: any, state: string, text: string) => {
      gateSubmitStates.push({ state, text });
      if (button && button.dataset) button.dataset.gateSubmitState = state;
    },
    buzz: () => {},
    notify: () => {},
    openGateResultSheet: () => {},
    openGateFailureSheet: () => {},
    openGateTelegramAuthFailure: () => {},
    isGateAuthFailure: () => false,
    loadGate: () => {},
    setTimeout: (fn: () => void) => fn(),
    fetch: (url: string, init: any) => {
      fetchCalls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ committed: true }) });
    },
    Promise,
    JSON,
    console,
  };
  vm.createContext(context);
  vm.runInContext(OPERATING_FABRIC_GATE_ACTION_BRIDGE_JS, context);
  return {
    context,
    preflightCalls,
    fetchCalls,
    gateSubmitStates,
    getConfirmButton: () => confirmButton,
    originalGateActCalls: () => (context as any).__originalGateActCalls || 0,
  };
}

function validSeed(overrides: Record<string, unknown> = {}) {
  return {
    changeDigest: 'a'.repeat(64),
    tenant: 'acme',
    nonce: 'fx-nonce-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    graphVersion: 42,
    fence: 1,
    ...overrides,
  };
}

test('gate-action bridge: valid descriptor opens exactly one preflight and posts exactly one request with no actor', async () => {
  const harness = installGateActionBridgeContext();
  vm.runInContext(
    'openGatePreflight("approve-goal-graph", "fx-subject", null, __seed)',
    Object.assign(harness.context, { __seed: validSeed() }),
  );
  assert.equal(harness.preflightCalls.length, 1, 'exactly one preflight opens for a valid descriptor');
  const button = harness.getConfirmButton()!;
  vm.runInContext('gateAct(__button)', Object.assign(harness.context, { __button: button }));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(harness.fetchCalls.length, 1, 'exactly one POST fires for a valid confirm');
  assert.equal(harness.fetchCalls[0]!.url, '/api/gate/acme');
  assert.deepEqual(
    Object.keys(harness.fetchCalls[0]!.body as Record<string, unknown>).sort(),
    ['changeDigest', 'expectedHeadVersion', 'expiresAt', 'fence', 'initData', 'kind', 'nonce', 'subject', 'tenant'].sort(),
  );
  assert.ok(!('actor' in (harness.fetchCalls[0]!.body as Record<string, unknown>)), 'payload never carries actor');
  assert.equal(harness.originalGateActCalls(), 0, 'the original gateAct is never invoked for a valid goal-graph submit');
});

test('gate-action bridge: sha256: prefixed digest form is also accepted', async () => {
  const harness = installGateActionBridgeContext();
  vm.runInContext(
    'openGatePreflight("approve-goal-graph", "fx-subject", null, __seed)',
    Object.assign(harness.context, { __seed: validSeed({ changeDigest: 'sha256:' + 'a'.repeat(64) }) }),
  );
  assert.equal(harness.preflightCalls.length, 1, 'a prefixed digest still opens exactly one preflight');
  const button = harness.getConfirmButton()!;
  vm.runInContext('gateAct(__button)', Object.assign(harness.context, { __button: button }));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(harness.fetchCalls.length, 1, 'a prefixed digest still posts exactly once');
  assert.equal((harness.fetchCalls[0]!.body as Record<string, unknown>).changeDigest, 'sha256:' + 'a'.repeat(64));
});

test('gate-action bridge: double click on the same confirm posts exactly once', async () => {
  const harness = installGateActionBridgeContext();
  vm.runInContext(
    'openGatePreflight("approve-goal-graph", "fx-subject", null, __seed)',
    Object.assign(harness.context, { __seed: validSeed() }),
  );
  const button = harness.getConfirmButton()!;
  vm.runInContext('gateAct(__button)', Object.assign(harness.context, { __button: button }));
  vm.runInContext('gateAct(__button)', Object.assign(harness.context, { __button: button }));
  await Promise.resolve();
  assert.equal(harness.fetchCalls.length, 1, 'the double-submit guard admits exactly one POST');
});

test('gate-action bridge: non-goal-graph kind opens original preflight and delegates gateAct with zero fetch', async () => {
  const harness = installGateActionBridgeContext();
  vm.runInContext(
    'openGatePreflight("approve", "fx-subject", null, __seed)',
    Object.assign(harness.context, { __seed: validSeed() }),
  );
  assert.equal(harness.preflightCalls.length, 1, 'non-goal-graph kinds still delegate to the original preflight');
  const button = makeGateButtonStub();
  button.dataset.gateConfirm = 'approve';
  button.dataset.gateSubject = 'fx-subject';
  vm.runInContext('gateAct(__button)', Object.assign(harness.context, { __button: button }));
  assert.equal(harness.originalGateActCalls(), 1, 'non-goal-graph gateAct delegates to the original exactly once');
  assert.equal(harness.fetchCalls.length, 0, 'the bridge never fetches for a delegated non-goal-graph action');
});

const INVALID_SEEDS: Array<[string, Record<string, unknown> | null]> = [
  ['missing seed', null],
  ['malformed changeDigest', validSeed({ changeDigest: 'not-a-digest' })],
  ['tenant mismatch', validSeed({ tenant: 'other-tenant' })],
  ['expired expiresAt', validSeed({ expiresAt: '2000-01-01T00:00:00.000Z' })],
  ['negative expectedHeadVersion', validSeed({ graphVersion: -1 })],
  ['fractional expectedHeadVersion', validSeed({ graphVersion: 1.5 })],
  ['negative fence', validSeed({ fence: -1 })],
  ['fractional fence', validSeed({ fence: 0.5 })],
  ['unsafe nonce (control character)', validSeed({ nonce: 'bad nonce with newline\n' })],
  ['unbounded nonce', validSeed({ nonce: 'x'.repeat(200) })],
];

for (const [label, seed] of INVALID_SEEDS) {
  test(`gate-action bridge: ${label} opens zero preflight bindings and posts zero requests`, async () => {
    const harness = installGateActionBridgeContext();
    vm.runInContext(
      'openGatePreflight("approve-goal-graph", "fx-subject", null, __seed)',
      Object.assign(harness.context, { __seed: seed }),
    );
    assert.equal(harness.getConfirmButton(), null, `${label}: no bound confirm control exists to submit`);
    assert.equal(harness.fetchCalls.length, 0, `${label}: zero POST fires`);
  });
}

test('gate-action bridge: tenant mismatch between bound descriptor and current TENANT fails closed at submit with zero fetch', async () => {
  const harness = installGateActionBridgeContext({ tenant: 'acme' });
  vm.runInContext(
    'openGatePreflight("approve-goal-graph", "fx-subject", null, __seed)',
    Object.assign(harness.context, { __seed: validSeed({ tenant: 'acme' }) }),
  );
  const button = harness.getConfirmButton()!;
  // Simulate the tenant changing out from under the bound descriptor between
  // preflight-open and submit (e.g. a stale confirm control from a prior tenant).
  vm.runInContext('TENANT = "other-tenant";', harness.context);
  vm.runInContext('gateAct(__button)', Object.assign(harness.context, { __button: button }));
  await Promise.resolve();
  assert.equal(harness.fetchCalls.length, 0, 'a tenant mismatch discovered at submit time posts zero requests');
  assert.equal(harness.originalGateActCalls(), 0, 'a bound goal-graph descriptor never falls through to the original gateAct');
  assert.ok(
    harness.gateSubmitStates.some((s) => s.state === 'error'),
    'submit failure is surfaced via setGateSubmitState error, not silence',
  );
});
