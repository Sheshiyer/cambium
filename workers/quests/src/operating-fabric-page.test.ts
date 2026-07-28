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
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
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
      return null;
    },
    setAttribute(name: string, value: string) {
      if (name === 'aria-hidden') this.ariaHidden = String(value);
    },
    addEventListener(type: string, handler: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    toggle(hidden: boolean, inert: boolean) {
      this.hidden = hidden;
      this.inert = inert;
    },
  };
}

type FabricElement = ReturnType<typeof makeFabricElement>;

function bootOperatingFabricDocument(
  responder: (request: { url: string; init: { headers?: Record<string, string> } }) => FabricResponse,
  options: { initData?: string; includeRoot?: boolean } = {},
) {
  const fetches: Array<{ url: string; headers: Record<string, string> }> = [];
  const fabricRoot = makeFabricElement('div');
  fabricRoot.hidden = true;
  fabricRoot.inert = true;
  fabricRoot.ariaHidden = 'true';
  const legacyShell = makeFabricElement('div');
  const elements = new Map<string, FabricElement>([['operating-fabric', fabricRoot]]);

  const context: Record<string, unknown> = {
    document: {
      getElementById: (id: string) => (options.includeRoot === false && id === 'operating-fabric' ? null : elements.get(id) ?? null),
      querySelector: (selector: string) =>
        selector === '[data-component="MissionControlShell"]' ? legacyShell : null,
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
    console,
    setTimeout,
    clearTimeout,
  };
  context.Telegram = (context.window as { Telegram?: unknown }).Telegram;
  context.globalThis = context;

  const bootScript = extractScriptBodies(OPERATING_FABRIC_BOOT)[0];
  assert.ok(bootScript, 'boot chunk yields its client script');
  vm.runInContext(bootScript, vm.createContext(context));
  return { fabricRoot, legacyShell, fetches };
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
