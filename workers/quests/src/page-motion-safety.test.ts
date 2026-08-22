// T-027 — cross-scene safe-area + prefers-reduced-motion pass (frozen/03, frozen/04).
// Static contract assertions over the served PAGE plus per-scene behavioral renders through
// the shared VM page harness (scripts/text-density-audit.mjs), which forces
// prefers-reduced-motion: reduce unless told otherwise. The browser-level viewport proofs
// (320/390/430 containment) live in the orchestrator-owned visual-viewport-proof.mjs; these
// tests cover what that harness does not: RM variants for every scene × fixture state, the
// motion gate actually toggling, warningAttention run-once semantics, safe-area vars, and
// fixed-width overflow guards.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PAGE } from './page.ts';
import {
  mergeProductionEnvelope,
  renderPageFixtureContext,
} from '../../../scripts/text-density-audit.mjs';
import { renderFabricState } from './page/operating-fabric/components.ts';
import { renderGateEntrypoint } from './page/operating-fabric/gate-sheet.ts';
import type { GatePendingItem } from './page/operating-fabric/gate-sheet.ts';

const FIXTURE_NOW = '2026-07-24T09:17:00.000Z';

function sceneFixture(name: string) {
  return JSON.parse(
    readFileSync(new URL(`./page/scenes/fixtures/${name}.fixture.json`, import.meta.url), 'utf8'),
  ) as { states: Record<string, { envelope: Record<string, unknown> }> };
}

const INSPECT_BASELINE = sceneFixture('inspect').states.normal.envelope;

// Scene fixtures are minimal per-scene envelopes; production serves one complete envelope, so
// merge over the inspect baseline (and give tools its empty ledger) exactly like the T-028
// audit. paint() is all-or-nothing — a partial envelope throws before later painters run.
function productionEnvelope(scene: string, state: string) {
  const fixture = sceneFixture(scene);
  const stateEnvelope = fixture.states[state]!.envelope;
  const withLedger = scene === 'tools'
    ? { ...stateEnvelope, ledger: { completed: 0, total: 0, current: null, rows: [] } }
    : stateEnvelope;
  return mergeProductionEnvelope(INSPECT_BASELINE, withLedger);
}

const SCENE_ROOTS: Array<{ scene: string; roots: string[] }> = [
  { scene: 'mission', roots: ['stem', 'progress', 'here'] },
  { scene: 'gate', roots: ['gate', 'gauge', 'gateHeroDecision'] },
  { scene: 'tools', roots: ['cmds'] },
  { scene: 'story', roots: ['beats'] },
  { scene: 'inspect', roots: ['mapwrap'] },
];

async function renderScene(scene: string, state: string, options: { reducedMotion?: boolean } = {}) {
  const rendered = await renderPageFixtureContext(productionEnvelope(scene, state), {
    now: FIXTURE_NOW,
    search: `?scene=${scene}`,
    reducedMotion: options.reducedMotion,
  });
  const roots = SCENE_ROOTS.find((entry) => entry.scene === scene)!;
  return roots.roots.map((id) => rendered.elements.get(id)!.innerHTML || rendered.elements.get(id)!.textContent).join('\n');
}

async function renderMissionWithBranch(branch: Record<string, unknown>) {
  const envelope = productionEnvelope('mission', 'normal') as Record<string, unknown>;
  const stories = envelope.branchStories as Record<string, unknown>;
  const rendered = await renderPageFixtureContext({
    ...envelope,
    branchStories: { ...stories, rows: [branch] },
  }, {
    now: FIXTURE_NOW,
    search: '?scene=mission',
    reducedMotion: true,
  });
  return rendered.elements.get('stem')!.innerHTML;
}

test('T-027 · safe-area contract: viewport-fit cover, env insets, and chrome/scene/sheet usage', () => {
  assert.match(PAGE, /viewport-fit=cover/);
  assert.match(PAGE, /--sat:env\(safe-area-inset-top\)/);
  assert.match(PAGE, /--sab:env\(safe-area-inset-bottom\)/);
  assert.match(PAGE, /--mc-safe-top:var\(--sat\)/);
  assert.match(PAGE, /--mc-safe-bottom:var\(--sab\)/);
  // header clears the top inset; scrolling scenes, footer, and the sheet clear the bottom inset.
  assert.match(PAGE, /header\.root-status\{padding:calc\(var\(--sat\) \+ 14px\)/);
  assert.match(PAGE, /\.scene\{[^}]*padding:18px 18px calc\(var\(--sab\) \+ 118px\)/);
  assert.match(PAGE, /footer\{flex:none;padding:8px 18px calc\(var\(--sab\) \+ 12px\)/);
  assert.match(PAGE, /\.sheet\{[^}]*padding:14px 20px calc\(var\(--sab\) \+ 24px\)/);
  assert.match(PAGE, /max-height:calc\(100dvh - var\(--sat\) - var\(--sab\) - 70px\)/);
});

test('T-027 · reduced-motion CSS gate neutralizes every frozen named animation', () => {
  const rmBlock = PAGE.match(/@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n\}\n/);
  assert.ok(rmBlock, 'PAGE has a prefers-reduced-motion block');
  const body = rmBlock![1]!;
  // universal neutralizer collapses every animation/transition to an instant static end state
  assert.match(body, /\*\{animation-duration:\.01ms!important;animation-iteration-count:1!important;transition-duration:\.01ms!important\}/);
  // frozen/03 rule 4: the named data-motion animations are removed outright — static dots,
  // zero translation; state stays readable as icon + dash/border, never color alone.
  for (const named of ['orbitSweep', 'packetDrift', 'glyphBreathe']) {
    assert.match(body, new RegExp(`data-motion="${named}"`), `RM block covers ${named}`);
  }
  assert.match(body, /animation:none!important/);
});

test('T-027 · warningAttention always runs once — never pulses (frozen/03 rule 2)', () => {
  const uses = [...PAGE.matchAll(/animation:[^;}]*warningAttention[^;}]*/g)].map((match) => match[0]);
  assert.ok(uses.length >= 2, 'warningAttention is wired to blocked tokens + gate attention strip');
  for (const use of uses) assert.match(use, /\s1\s/, `${use} must use iteration count 1`);
});

test('T-027 · no fixed width beyond the 320px viewport floor in scene styles', () => {
  for (const match of PAGE.matchAll(/[^a-z-]width:\s*(\d+)px/g)) {
    const px = Number(match[1]);
    assert.ok(px <= 320, `fixed width ${px}px exceeds the 320px viewport floor`);
  }
});

test('T-027 · Mission Control renders source-shaped Sapling and Program variants', async () => {
  const fixture = productionEnvelope('mission', 'normal') as Record<string, unknown>;
  const sourceBranch = ((fixture.branchStories as { rows: Array<Record<string, unknown>> }).rows[0])!;
  const cases = [
    { branchKind: 'product', expected: 'sapling', label: 'Sapling', glyph: 'genesis' },
    { branchKind: 'client', expected: 'client-program', label: 'Client program', glyph: 'taste' },
    { branchKind: 'internal-service', programKind: 'capability', expected: 'service-program', label: 'Capability program', glyph: 'cortex' },
    { branchKind: 'internal-service', programKind: 'operations', expected: 'service-program', label: 'Operations program', glyph: 'ops' },
    { branchKind: 'unmapped', expected: 'classification-gap', label: 'Classification needed', glyph: 'gate' },
  ];
  for (const variant of cases) {
    const html = await renderMissionWithBranch({
      ...sourceBranch,
      branchId: `fx-${variant.expected}-${variant.glyph}`,
      name: variant.label,
      productId: variant.expected,
      ...variant,
    });
    assert.match(html, new RegExp(`data-work-variant="${variant.expected}"`), `${variant.label} emits its explicit work variant`);
    assert.match(html, new RegExp(`data-component="MissionCardEyebrow">${variant.label}<`), `${variant.label} is visible in the mission hero`);
    assert.match(html, /class="mc-next-label">NEXT MISSION</, 'the next-mission cue remains independently visible');
    assert.match(html, new RegExp(`data-glyph-kind="${variant.glyph}"`), `${variant.label} uses the semantic glyph`);
  }
});

test('T-027 · Mission Control stacks the existing timeline under the 520px mobile boundary', () => {
  assert.match(PAGE, /@media \(max-width:520px\)\{[\s\S]*?\.mc-timeline\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(PAGE, /\.mc-timeline-station\{grid-template-columns:28px minmax\(0,1fr\)[^}]*min-height:44px/);
  assert.match(PAGE, /\.mc-eyebrow,\.mc-card-head,\.mc-meta-grid,\.mc-info\{max-width:100%\}/);
});

test('T-027 · reduced-motion variants render state statically in every scene and state', async () => {
  for (const { scene } of SCENE_ROOTS) {
    for (const state of Object.keys(sceneFixture(scene).states)) {
      const html = await renderScene(scene, state);
      assert.doesNotMatch(html, /data-motion=/, `${scene}/${state} emits motion hooks under prefers-reduced-motion`);
      assert.doesNotMatch(html, /<animate\b/, `${scene}/${state} emits SMIL animation under prefers-reduced-motion`);
    }
  }
});

test('T-027 · motion-allowed render emits the gated motion hooks (the gate toggles)', async () => {
  // story normal has one active rail: packetDrift emits exactly there (frozen/03 rule 6 —
  // max one animated focal point per screen), and vanishes under reduced motion.
  const story = await renderScene('story', 'normal', { reducedMotion: false });
  const drifts = story.match(/data-motion="packetDrift"/g) ?? [];
  assert.equal(drifts.length, 1, 'motion-allowed story animates exactly one active rail');
  const storyRm = await renderScene('story', 'normal');
  assert.doesNotMatch(storyRm, /data-motion=/, 'reduced-motion story renders static dots');
  const gate = await renderScene('gate', 'normal', { reducedMotion: false });
  assert.match(gate, /<animate\b/, 'motion-allowed gate gauge grows via SMIL');
  const gateRm = await renderScene('gate', 'normal');
  assert.doesNotMatch(gateRm, /<animate\b/, 'reduced-motion gauge renders its static arc');
});

test('T-027 · blocked and stale states stay icon-coded under reduced motion (never color alone)', async () => {
  for (const { scene } of SCENE_ROOTS) {
    const html = await renderScene(scene, 'blocked');
    const tokens = html.match(/data-component="StateToken"/g) ?? [];
    const icons = html.match(/mc-token-icon/g) ?? [];
    assert.equal(tokens.length, icons.length, `${scene}/blocked state tokens all carry an icon`);
    // dash/border treatment rides the class hook; the RM block never strips state classes.
    if (/is-blocked/.test(html)) {
      assert.match(html, /data-state="blocked"/, `${scene}/blocked keeps its blocked state hook`);
    }
  }
});

// ── Task 12: operating fabric motion/accessibility contract ────────────────
// Static source assertions over the operating-fabric scaffold/styles/client
// modules bundled into PAGE — no browser required. Responsive containment at
// 320/390/430px lives in the orchestrator-owned visual-viewport-proof.mjs.

test('T-12 · operating fabric fixed widths stay within the 320px viewport floor', () => {
  const shellStart = PAGE.indexOf('#operating-fabric{display:none}');
  assert.ok(shellStart >= 0, 'PAGE bundles the operating-fabric shell styles');
  const shellEnd = PAGE.indexOf('</style>', shellStart);
  const shellCss = PAGE.slice(shellStart, shellEnd);
  for (const match of shellCss.matchAll(/[^a-z-]width:\s*(\d+)px/g)) {
    const px = Number(match[1]);
    assert.ok(px <= 320, `operating fabric fixed width ${px}px exceeds the 320px viewport floor`);
  }
});

test('T-12 · operating fabric reduced-motion gate strips shell transitions and animations', () => {
  assert.match(
    PAGE,
    /#operating-fabric, #operating-fabric \*\{transition:none !important;animation:none !important\}/,
    'operating fabric RM block removes nonessential transitions/animations under its own shell',
  );
});

test('T-12 · operating fabric controls carry a 44px minimum target and visible focus', () => {
  assert.match(PAGE, /\.of-tab\{[^}]*min-height:44px/, '.of-tab declares the 44px minimum control height');
  assert.match(
    PAGE,
    /\.of-tab:focus-visible,\.of-control:focus-visible\{outline:2px solid var\(--ink\);outline-offset:2px\}/,
    'operating fabric tabs and controls get a visible focus-visible outline',
  );
});

test('T-12 · operating fabric scene nav is semantic with aria-current-equivalent selection state', () => {
  assert.match(PAGE, /<nav class="of-nav"[^>]*aria-label="Operating Fabric scenes">/, 'scene nav is a labelled <nav> landmark');
  assert.match(PAGE, /class="of-tab"[^>]*aria-selected="true"/, 'the active scene tab is marked selected');
  assert.match(PAGE, /class="of-tab"[^>]*aria-selected="false"/, 'inactive scene tabs are marked unselected');
});

test('T-12 · every operating fabric scene is a landmark section with a heading', () => {
  const sceneIds = ['canopy', 'mission', 'flow', 'workforce', 'forge'];
  for (const sceneId of sceneIds) {
    const sectionRe = new RegExp(
      `<section class="of-scene" data-of-scene="${sceneId}" aria-labelledby="ofScene${sceneId[0]!.toUpperCase()}${sceneId.slice(1)}Title"[^>]*>` +
        `<h2 id="ofScene${sceneId[0]!.toUpperCase()}${sceneId.slice(1)}Title"`,
    );
    assert.match(PAGE, sectionRe, `${sceneId} scene is a labelled landmark section with a heading`);
  }
});

test('T-12 · flow graph carries an accessible linear fallback', () => {
  assert.match(
    PAGE,
    /<table class="of-flow-graph" data-of-flow-representation="graph" aria-hidden="true">/,
    'the visual flow graph is hidden from assistive tech',
  );
  assert.match(
    PAGE,
    /<ol class="of-flow-list" data-of-flow-fallback="linear">/,
    'flow provides a linear <ol> fallback carrying the same content',
  );
});

test('T-12 · operating fabric renders honest safety states for loading/empty/stale/unauthorized/error', () => {
  const expectations: Record<'loading' | 'empty' | 'stale' | 'unauthorized' | 'error', { title: string; detail: string }> = {
    loading: { title: 'loading', detail: 'fetching the operating fabric' },
    empty: { title: 'empty', detail: 'no rows in this view' },
    stale: { title: 'stale', detail: 'evidence is older than the freshness window' },
    unauthorized: { title: 'unauthorized', detail: 'not authorized to view this fabric' },
    error: { title: 'error', detail: 'failed to load the operating fabric' },
  };
  for (const state of Object.keys(expectations) as Array<keyof typeof expectations>) {
    const { title, detail } = expectations[state];
    const html = renderFabricState(state);
    assert.match(html, new RegExp(`data-state="${state}"`), `${state} carries its data-state`);
    assert.match(html, /role="status"/, `${state} carries role="status"`);
    assert.match(html, new RegExp(`aria-label="${title}: ${detail}"`), `${state} carries its exact aria-label`);
    assert.match(html, new RegExp(`>${title}</strong>`), `${state} carries its exact title`);
    assert.match(html, new RegExp(`>${detail}</p>`), `${state} carries its exact detail`);
  }
});

test('T-12 · Gate entrypoint renders an honest disabled state for no-pending/invalid/expired', () => {
  const noPending = renderGateEntrypoint(null);
  assert.equal(noPending.reason, 'no-pending');
  assert.equal(noPending.disabled, true);
  assert.equal(noPending.opened, false);
  assert.match(noPending.html, /class="of-control of-gate-entrypoint-btn" disabled aria-disabled="true" data-of-gate-entrypoint="1" data-of-gate-entrypoint-state="no-pending"/);

  const malformed = renderGateEntrypoint({} as unknown as GatePendingItem);
  assert.equal(malformed.reason, 'invalid');
  assert.equal(malformed.disabled, true);
  assert.equal(malformed.opened, false);
  assert.match(malformed.html, /data-of-gate-entrypoint-state="invalid"/);

  const expiredItem: GatePendingItem = {
    changeDigest: 'digest-1',
    tenant: 'tenant-1',
    nonce: 'nonce-1',
    expiresAt: '2000-01-01T00:00:00.000Z',
    expectedHeadVersion: 1,
    fence: 1,
    evidence: 'evidence',
    consequence: 'consequence',
    reversibility: 'reversible',
  };
  const expired = renderGateEntrypoint(expiredItem, { now: () => Date.parse('2026-07-24T09:17:00.000Z') });
  assert.equal(expired.reason, 'expired');
  assert.equal(expired.disabled, true);
  assert.equal(expired.opened, false);
  assert.match(expired.html, /data-of-gate-entrypoint-state="expired"/);

  let callCount = 0;
  const validItem: GatePendingItem = {
    changeDigest: 'digest-2',
    tenant: 'tenant-2',
    nonce: 'nonce-2',
    expiresAt: '2099-01-01T00:00:00.000Z',
    expectedHeadVersion: 1,
    fence: 1,
    evidence: 'evidence',
    consequence: 'consequence',
    reversibility: 'reversible',
  };
  const opened = renderGateEntrypoint(validItem, {
    now: () => Date.parse('2026-07-24T09:17:00.000Z'),
    openGatePreflight: () => {
      callCount += 1;
    },
  });
  assert.equal(opened.reason, 'opened');
  assert.equal(opened.disabled, false);
  assert.equal(opened.opened, true);
  assert.equal(callCount, 1, 'openGatePreflight is called exactly once');
  assert.match(
    opened.html,
    /class="of-control of-gate-entrypoint-btn" data-of-gate-entrypoint="1" data-of-gate-entrypoint-state="ready"/,
  );
});

test('T-12 · Gate entrypoint click handler disables the button before the in-flight request resolves', () => {
  assert.match(
    PAGE,
    /if \(ofGateEntrypointBusy \|\| !btn \|\| btn\.disabled\) return;/,
    'Gate entrypoint click handler guards against double-submission while busy',
  );
  assert.match(
    PAGE,
    /btn\.disabled = true;/,
    'Gate entrypoint disables the button before the in-flight request resolves',
  );
});

test('T-12 · Inspect sheet exposes back/close controls with an <h2> heading', () => {
  assert.match(PAGE, /<button type="button" class="detail" data-of-inspect-back="1">Back<\/button>/, 'Inspect sheet has a back control');
  assert.match(PAGE, /<button type="button" class="reroll" data-of-inspect-close="1">Close<\/button>/, 'Inspect sheet has a close control');
});
