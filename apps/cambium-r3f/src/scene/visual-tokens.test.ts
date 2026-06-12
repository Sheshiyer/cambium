import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedBrandHexes, visualTokens } from './visual-tokens.ts';

const cortexPalette = ['#00272B', '#012F34', '#E0FF4F', '#D6FFF6', '#231651'];

test('visual tokens stay inside the Cortex palette lock', () => {
  assert.deepEqual([...allowedBrandHexes].sort(), cortexPalette.sort());
});

test('motion contract is transform and opacity only', () => {
  assert.deepEqual(visualTokens.motion.allowedProperties, ['transform', 'opacity']);
  assert.equal(visualTokens.motion.reducedMotionQuery, '(prefers-reduced-motion: reduce)');
});

test('glyph metadata keeps every organ as an abstract object, not a building', () => {
  for (const glyph of Object.values(visualTokens.glyphs)) {
    assert.match(glyph.coolshapeIntent, /object/);
    assert.doesNotMatch(glyph.coolshapeIntent, /house|city|tower|building/i);
  }
});

test('fog and material tokens are present for a game-engine scene pass', () => {
  assert.equal(visualTokens.materials.fog.color, visualTokens.colors.ink);
  assert.ok(visualTokens.materials.fog.far > visualTokens.materials.fog.near);
});
