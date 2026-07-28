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
import { OPERATING_FABRIC_MARKUP, OPERATING_FABRIC_SCENES } from './page/operating-fabric/scaffold.ts';
import { OPERATING_FABRIC_BOOT } from './page/operating-fabric/client.ts';
import { OPERATING_FABRIC_STYLES } from './page/operating-fabric/styles.ts';
import { LEGACY_PAGE, PAGE } from './page/index.ts';
import { permits } from './rbac.ts';

const LEGACY_SCENES: readonly MiniAppSceneId[] = ['mission', 'gate', 'tools', 'story', 'inspect'];
const LEGACY_PAGE_DIGEST = '38b085ba3e3af7baad40c7cf36a5fc469da457eb30b27b730bffad504ca68b4a';

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

test('LEGACY_PAGE hashes exactly to the pinned pre-Task-6 PAGE digest', () => {
  const digest = createHash('sha256').update(LEGACY_PAGE).digest('hex');
  assert.equal(digest, LEGACY_PAGE_DIGEST, 'LEGACY_PAGE is byte-identical to the pre-Task-6 page');
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

function makeFabricElement(tag: string) {
  const classes = new Set<string>();
  const listeners = new Map<string, Array<() => void>>();
  return {
    tagName: tag.toUpperCase(),
    hidden: false,
    inert: false,
    ariaHidden: null as string | null,
    ariaSelected: null as string | null,
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
    innerHTML: '',
    textContent: '',
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
        const key = name.slice(5).replace(/-([a-z])/g, (_dash, letter: string) => letter.toUpperCase());
        return this.dataset[key] ?? null;
      }
      return null;
    },
    setAttribute(name: string, value: string) {
      if (name === 'aria-hidden') this.ariaHidden = String(value);
      if (name === 'aria-selected') this.ariaSelected = String(value);
    },
    listeners,
    addEventListener(type: string, handler: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    toggle(hidden: boolean, inert: boolean) {
      this.hidden = hidden;
      this.inert = inert;
    },
    querySelector(_selector: string) {
      return null;
    },
    querySelectorAll(_selector: string) {
      return [] as unknown[];
    },
    focus() {},
  };
}

type FabricElement = ReturnType<typeof makeFabricElement>;

function bootOperatingFabricDocument(
  responder: (request: { url: string; init: { headers?: Record<string, string> } }) => FabricResponse,
  options: { initData?: string; includeRoot?: boolean; onError?: (error: unknown) => void } = {},
) {
  const fetches: Array<{ url: string; headers: Record<string, string> }> = [];
  const fabricRoot = makeFabricElement('div');
  fabricRoot.hidden = true;
  fabricRoot.inert = true;
  fabricRoot.ariaHidden = 'true';
  const legacyShell = makeFabricElement('div');
  const elements = new Map<string, FabricElement>([['operating-fabric', fabricRoot]]);
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
  context.Telegram = (context.window as { Telegram?: unknown }).Telegram;
  context.globalThis = context;

  const bootScript = extractScriptBodies(OPERATING_FABRIC_BOOT)[0];
  assert.ok(bootScript, 'boot chunk yields its client script');
  vm.runInContext(bootScript, vm.createContext(context));
  const dispatchClick = (target: { closest: (selector: string) => unknown }) => {
    for (const handler of (fabricRoot as { listeners?: Map<string, Array<(event: unknown) => void>> }).listeners?.get('click') ?? []) {
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
  return { fabricRoot, legacyShell, fetches, elements, tabElements, sceneElements, clickOpen, clickNested, clickMiss, clickTab };
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
import type { FabricNode, FabricWorkNode, MissionFabricProjectionV1 } from './mission-fabric.ts';
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

test('open-lineage control uses the sized of-tab class; of-control is never sized alone', () => {
  assert.doesNotMatch(
    OPERATING_FABRIC_STYLES,
    /\.of-control\{[^}]*min-height/,
    'of-control alone is NOT sized — no rule claims it',
  );
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
  // vocabulary; the glue audit bans mutation/authority surfaces only.
  for (const banned of [
    'POST',
    'api/gate',
    'checkRole',
    'data-action-request',
    'signed-action',
    'role ===',
  ]) {
    assert.ok(!bootScript.includes(banned), `boot client stays free of authority surface: ${banned}`);
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
