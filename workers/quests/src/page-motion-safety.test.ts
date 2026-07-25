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
